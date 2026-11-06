/**
 * The password sign-in (plan row W24; spec §5.2 ID-1 to ID-7, §8.2 ENG-23 to ENG-26; SR-05 to
 * SR-10, SR-22, SR-23, SR-72; database contract §5.2, §5.6 AT-C1; decision D30).
 *
 * THE SEQUENCE. Two units of work of the serial pipeline with the hash computation between them:
 *
 *   unit 1   `identity.signIn.attempt`   ONE ATTEMPT IS TAKEN from the console's lockout counter
 *                                        (ENG-24). A locked console stops here: 423, `AUTH_LOCKED`,
 *                                        nothing is verified.
 *   between  outside the pipeline        the operator's hash set is read by the username, and
 *                                        THE ARGON2ID DERIVATION RUNS, ALWAYS, BEFORE ANY BRANCH
 *                                        (ID-2): against the stored record of a known operator,
 *                                        enabled or disabled, or against a fixed dummy record
 *                                        when the username matches nobody. Exactly one
 *                                        derivation per verified attempt.
 *   unit 2   `identity.signIn.decide`    the operator is read AGAIN by a compare-and-set
 *                                        statement (it may have been disabled meanwhile), and
 *                                        the unit writes either the session with `AUTH_SUCCESS`,
 *                                        or (`identity.signIn.failed`) the `AUTH_FAILED` row.
 *
 * Only the derivation runs outside the pipeline (ENG-26): it takes far longer than a tick.
 *
 * ONE FAILURE ANSWER (ID-3). An unknown username, a wrong password and a disabled operator get
 * the same status, the same code and the same text: 401 `INVALID_CREDENTIALS` with
 * `details.attemptsRemaining`. Nothing in the answer, and no difference in the work done, says
 * which it was. The failure that locks the console answers 423 `LOCKED`, as every attempt during
 * the lock does; that depends on the console's count only, never on the username.
 *
 * ONE AUDIT ROW PER ATTEMPT (ID-4, SR-23): `AUTH_SUCCESS`, `AUTH_FAILED` or `AUTH_LOCKED`. A
 * refusal takes its place in the denial budget first (`app.denialBudget.consume`). When the
 * budget of the caller's key is used up, the answer is the budget's 429 (SR-71), and:
 *
 *   - an attempt during the lock, which nothing verified, writes no row;
 *   - A VERIFIED FAILURE WRITES ITS `AUTH_FAILED` ROW ALL THE SAME (security checkpoint CPS1-6).
 *     The password was derived and compared, and the 429 tells the caller that it was wrong; a
 *     guess whose result the caller learns is in the trail. Only an attempt that passed the
 *     throttle stage before the budget was full gets this far, and the lockout bounds how many
 *     do: at most five attempts are verified per lock cycle of a console. For a caller who
 *     cannot sign in that is at most 20 rows inside the budget of a key and five beyond it in
 *     one window. The biometric sign-in does the same for a refusal that changed what is stored.
 *
 * The work is the same inside and beyond the budget: one derivation, one unit, the same
 * statements (SR-08).
 *
 * ROTATION (ID-6). Every success issues a new session and a new token. A valid session that was
 * presented with the request is ended in the same unit, reason `ROTATED`.
 *
 * The password is taken as sent: not trimmed, not folded. It goes to the hash wrapper and
 * nowhere else; it is never logged, stored or echoed (SR-07). The username is trimmed and
 * lower-cased for the lookup and is never written to a row or a log line (SR-54).
 */
import { ApiErrorCode, type AuthSessionInfo } from '@dems/shared/api';
import { effectivePermissions } from '@dems/shared/sim';
import type { Permission } from '@dems/shared/sim';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { authenticationOf } from '../../plugins/authenticate';
import { ApiFailure } from '../../plugins/error-envelope';
import { describeError } from '../../plugins/logger';
import { appendActivity, attemptFailed, attemptLocked, signedIn } from './activity';
import type { ConsoleIdentity } from './console';
import { SESSION_IDLE_TIMEOUT_MS } from './limits';
import type { AttemptTicket, ConsoleLockout, LockRefusal } from './lockout';
import type { PasswordHasher } from './password-hash';
import {
  endSession,
  findOperatorId,
  findSignInCandidate,
  markSignedIn,
  readOperatorEnabled,
  readRolePermissions,
  replaceCredentials,
  type AuthSession,
  type OperatorProfile,
  type SignInCandidate,
} from './session-store';
import { issueSession, publishDeviceSessions, readDatabase } from './sessions';

const PASSWORD = 'PASSWORD';
/** An operator ID that no row has (the CHECK wants `OPR-NNN`). */
const NO_OPERATOR = '';

/** What the sign-in needs from the module. `hasher` is read each time: a test may replace it. */
export interface SignInServices {
  readonly lockout: ConsoleLockout;
  readonly hasher: () => PasswordHasher;
}

export interface SignInInput {
  readonly username: string;
  readonly password: string;
}

export interface SignInOutcome {
  /** Returned once: in the cookie of a web console, in the body for a paired device. */
  readonly token: string;
  readonly info: AuthSessionInfo;
}

/** The lookup form of a username (ID-2): trimmed and lower-cased, as the operators table stores it. */
export function normalizeUsername(username: string): string {
  return username.trim().toLowerCase();
}

/** The one answer of a failed sign-in (ID-3). */
export function invalidCredentials(attemptsRemaining: number): ApiFailure {
  return new ApiFailure(401, ApiErrorCode.INVALID_CREDENTIALS, 'The username or the password is not correct.', {
    details: { attemptsRemaining },
  });
}

/** The answer while the console is locked, and of the failure that locked it. */
export function consoleLocked(lockedUntil: number, retryInMs: number): ApiFailure {
  return new ApiFailure(423, ApiErrorCode.LOCKED, 'Too many failed attempts. Try again shortly.', {
    details: { lockedUntil, retryInMs },
  });
}

/** The caller's session as the contract's `AuthSessionInfo`. No token, no hash. */
export function authSessionInfo(
  app: FastifyInstance,
  session: AuthSession,
  operator: OperatorProfile,
  permissions: readonly Permission[],
): AuthSessionInfo {
  return {
    operator: {
      id: operator.id,
      username: operator.username,
      rank: operator.rank,
      name: operator.name,
      displayName: operator.displayName,
      initials: operator.initials,
      role: operator.role,
    },
    permissions: [...permissions],
    method: session.method,
    issuedAt: session.issuedAt,
    lastActivityAt: session.lastSeenAt,
    idleExpiresAt: session.lastSeenAt + SESSION_IDLE_TIMEOUT_MS,
    absoluteExpiresAt: session.absoluteExpiresAt,
    deviceId: session.deviceId,
    demoControls: app.config.demoControls,
    serverTime: app.clock.now(),
  };
}

export async function signInWithPassword(
  app: FastifyInstance,
  services: SignInServices,
  request: FastifyRequest,
  consoleIdentity: ConsoleIdentity,
  input: SignInInput,
): Promise<SignInOutcome> {
  const { lockout } = services;
  const { lockoutKey, deviceId } = consoleIdentity;
  const username = normalizeUsername(input.username);

  /** An attempt during the lock: not verified. The row names the operator only if the username matched one (ID-4). */
  async function refuseLocked(refusal: LockRefusal): Promise<never> {
    await app.denialBudget.consume(request);
    const operatorId = await readDatabase(app, 'identity.signIn.locked', (db) => findOperatorId(db, username), request);
    await app.pipeline.run('identity.signIn.locked', (unit) =>
      appendActivity(
        unit,
        attemptLocked({ method: PASSWORD, operatorId, deviceId, lockedUntil: refusal.lockedUntil, retryInMs: refusal.retryInMs }),
      ),
    );
    throw consoleLocked(refusal.lockedUntil, refusal.retryInMs);
  }

  /** One place in the denial budget for one refusal row. Null: taken. Otherwise the 429 to answer after the unit. */
  const placeInBudget = async (): Promise<unknown> => {
    try {
      await app.denialBudget.consume(request);
      return null;
    } catch (refused) {
      return refused;
    }
  };

  /**
   * A verified attempt that is refused: counted, audited, answered. `operatorId` is null for an
   * unknown username. The row is written whatever the denial budget says (SR-23, CPS1-6); with no
   * place left the answer is the budget's 429, after the unit committed the count and the row.
   */
  async function refuseFailed(ticket: AttemptTicket, operatorId: string | null): Promise<never> {
    const limited = await placeInBudget();
    const failure = await app.pipeline.run('identity.signIn.failed', async (unit) => {
      const counted = await lockout.fail(lockoutKey, ticket, app.clock.now());
      // The same statements whether the username matched an operator or not: an unknown
      // username asks for an ID that no operator has.
      const disabled = (await readOperatorEnabled(unit, operatorId ?? NO_OPERATOR)) === false;
      await appendActivity(
        unit,
        attemptFailed({
          method: PASSWORD,
          operatorId,
          deviceId,
          attemptsRemaining: counted.attemptsRemaining,
          lockedUntil: counted.lockedUntil,
          disabled,
        }),
      );
      return counted;
    });
    if (limited !== null) throw limited;
    throw failure.lockedUntil === null
      ? invalidCredentials(failure.attemptsRemaining)
      : consoleLocked(failure.lockedUntil, failure.retryInMs);
  }

  // ── Unit 1: the attempt is taken BEFORE it is verified (ENG-24) ────────────────────────────
  const attempt = await app.pipeline.run('identity.signIn.attempt', () => lockout.take(lockoutKey, app.clock.now()));
  if (attempt.kind === 'LOCKED') return refuseLocked(attempt);

  // ── Between the units: the derivation, always, before any branch (ID-2) ─────────────────────
  const hasher = services.hasher();
  const candidate: SignInCandidate | null = await readDatabase(app, 'identity.signIn.candidate', (db) => findSignInCandidate(db, username), request);
  const verified =
    candidate === null
      ? await hasher.verifyAgainstDummy(input.password)
      : await hasher.verifyPassword(input.password, candidate.record);
  if (candidate === null || !verified) return refuseFailed(attempt, candidate?.operatorId ?? null);

  // ── Unit 2: read the operator again, decide, write (ENG-26; AT-C1) ─────────────────────────
  const presented = authenticationOf(request).session;
  const decided = await app.pipeline.run('identity.signIn.decide', async (unit) => {
    const now = app.clock.now();
    const operator = await markSignedIn(unit, candidate.operatorId, now);
    // No row: the operator is disabled. Nothing was changed; the attempt fails like any other.
    if (operator === null) return null;
    // D55: the sign-in answer names the account's permissions (vendor root carries CAPTURE_CONFIG).
    const permissions = effectivePermissions(operator.username, await readRolePermissions(unit, operator.role));
    const replaced = presented === null ? null : await endSession(unit, presented.id, now, 'ROTATED');
    const issued = await issueSession(unit, { operatorId: operator.id, deviceId, method: PASSWORD, now });
    await appendActivity(
      unit,
      signedIn({ operatorId: operator.id, displayName: operator.displayName, method: PASSWORD, deviceId, replaced: replaced !== null }),
    );
    unit.afterCommit(() => {
      // A success clears the console's count and its lock.
      lockout.succeed(lockoutKey);
      if (replaced !== null) app.publish({ kind: 'session.ended', sessionIds: [replaced.id], reason: 'ROTATED' });
    });
    // A sign-in on a paired device changes the operator Paired Devices shows for it (R4, E2E-S-2).
    publishDeviceSessions(app, unit, [issued.session]);
    return { issued, operator, permissions };
  });
  if (decided === null) return refuseFailed(attempt, candidate.operatorId);

  await rehashIfWeaker(app, hasher, request, candidate, input.password);

  return {
    token: decided.issued.token,
    info: authSessionInfo(app, decided.issued.session, decided.operator, decided.permissions),
  };
}

const REHASH_FAILED = 'the password hash could not be renewed; the sign-in stands';

/**
 * SR-06: a stored record with weaker parameters than the current ones is replaced after a
 * successful sign-in. The new derivation runs outside the pipeline, the write is one
 * compare-and-set statement on the hash that was just verified. A failure here never fails the
 * sign-in: it is logged by its code and the old record stays.
 */
async function rehashIfWeaker(
  app: FastifyInstance,
  hasher: PasswordHasher,
  request: FastifyRequest,
  candidate: SignInCandidate,
  password: string,
): Promise<void> {
  if (!hasher.needsRehash(candidate.record)) return;
  try {
    const record = await hasher.hashPassword(password);
    await app.pipeline.run('identity.rehash', (unit) =>
      replaceCredentials(unit, candidate.operatorId, record, candidate.record.hash, app.clock.now()),
    );
  } catch (error) {
    const description = describeError(error);
    request.log.error({ code: description.code ?? description.errorName, operatorId: candidate.operatorId }, REHASH_FAILED);
    app.errorLog.append({
      level: 'error',
      source: 'identity.signIn.rehash',
      message: REHASH_FAILED,
      ...description,
      context: { requestId: request.id, operatorId: candidate.operatorId },
    });
  }
}
