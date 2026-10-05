/**
 * Operation 8 `signInWithBiometric`: a session from the token that the device's biometric prompt
 * released (plan row W41; spec §4.7, §5.4, §5.6 steps 4 to 6, §7.3 line 9, §8.2 ENG-23 to ENG-25;
 * SR-36, SR-37, SR-71, SR-72, SR-74; database contract §5.2, §5.6 AT-1 to AT-4, AT-C4; decision
 * D16, review SD-04 and SD-10).
 *
 * The server never hears that a biometric check passed. It is handed a secret that the device can
 * read only after its operating system released it, and it decides on that secret alone. The
 * request names no operator: the token does.
 *
 * A SIGN-IN IS ONE UNIT OF WORK of the serial pipeline, one PostgreSQL transaction:
 *
 *   1  `lockout.take`            ONE ATTEMPT IS TAKEN from the device's lockout counter, the one
 *                                the password sign-in of that device counts on, before anything
 *                                is read (ENG-24). Locked: nothing is looked up; `AUTH_LOCKED`; 423.
 *   2  CLAIM_TOKEN               THE CONSUMING COMPARE-AND-SET (ENG-25): the token becomes used
 *                                only where it is this device's, not used, not revoked and not
 *                                past its time. Its row count decides who owns the use.
 *   3a one row                   the device is still PAIRED; the operator is still enabled (the
 *                                compare-and-set of the password sign-in, AT-C1); THE NEXT TOKEN
 *                                of the family; the session, method `BIOMETRIC`; `AUTH_SUCCESS`.
 *                                After the commit the device's count is cleared. No session is
 *                                ended: none is presented with the request (below).
 *   3b no row                    READ_TOKEN_STATE says why. A token that WAS USED BEFORE is a
 *                                reuse: its family is revoked and the open BIOMETRIC sessions of
 *                                its device and operator are ended (`TOKEN_REUSE`), in this
 *                                unit; `session.ended` is published after the commit. A LIVE
 *                                token that ANOTHER DEVICE presents is handled as the same
 *                                reuse (below). Whatever the reason: the failure is counted,
 *                                `AUTH_FAILED` is written.
 *
 * A LIVE TOKEN IN THE HANDS OF ANOTHER PAIRED DEVICE (security checkpoint CPS1-7). A token is
 * issued to one device and is never sent to another, so a device that presents the live token of
 * another one shows that the token has left its device. Refusing it and leaving it live would
 * keep it good for whoever also holds that device's credential. It is therefore handled exactly
 * as a used token presented again: the family is revoked and the open BIOMETRIC sessions of the
 * TOKEN's device and operator are ended, reason `TOKEN_REUSE`, in this unit; the row and the
 * count are the presenting device's. Only a holder of the token's value can cause it: the value
 * is 256 random bits and no request names a token in any other way. A token of another device
 * that is no longer live (revoked or expired) has nothing left to end and stays a plain refusal.
 *
 * NO SESSION IS PRESENTED WITH A BIOMETRIC SIGN-IN (finding F77, decision D118). The registry's
 * rule of operation 8 carries the condition `DEVICE_CREDENTIAL`: stage 6 lets only the device's
 * own credential reach this unit, and a request that presents it has no session (stage 4 resolves
 * one credential to one principal). The session token of an operator who is signed in on the
 * device is refused there, before the body is read: 403 `DEVICE_NOT_PAIRED` with
 * `details.reason: DEVICE_CREDENTIAL_REQUIRED`, no row, no attempt, no place in the denial
 * budget. So a session that is still open cannot renew itself through the biometric chain (enrol
 * in the session, then sign in with the token while the session is open), and this unit has no
 * presented session to end: the rotation of ID-6 (`ROTATED`) is the password sign-in's alone.
 * The branch that ended a presented session here was removed with that decision; nothing in this
 * file reads a session of the request.
 *
 * HOW THIS DIFFERS FROM THE PASSWORD SIGN-IN, which is two units with the Argon2id derivation
 * between them: a token is not derived, it is looked up. The SHA-256 of what was sent is
 * computed before the unit (microseconds, the same for every value), and the statement that
 * finds the token is the statement that uses it. So nothing has to run outside the pipeline, the
 * attempt and the use are one unit, and there is no window between "verified" and "issued".
 *
 * WHY TIMING TELLS NOTHING. The token is 256 random bits. It is never compared byte by byte: it
 * is hashed, and the hash is an equality probe on a unique index, so no prefix of a guess can be
 * confirmed. A value that matches no row, a revoked and an expired token, of this device or of
 * another, run the same two statements. A reuse (a used token, or a live one of another device)
 * runs two more; that tells the presenter only what the presenter holds already, that this value
 * is or was a token, and by then the token is dead.
 *
 * ONE FAILURE ANSWER. Unknown, expired, revoked, another device's, used before, a disabled
 * operator: 401 `INVALID_CREDENTIALS` with the same text and `details.attemptsRemaining`. The
 * failure that locks the device answers 423 `LOCKED`, as every attempt during the lock does.
 *
 * TWO CONCURRENT USES OF ONE TOKEN (AC-B-78). The claim returns a row to exactly one of them: one
 * session. The other finds the token used and is handled as the reuse it is: the family, with the
 * token that was just issued, is revoked, and the session that was just issued is ended.
 *
 * THE DENIAL BUDGET (SR-71). `AUTH_FAILED` and `AUTH_LOCKED` are audited refusals: each takes its
 * place in the budget of the caller's key before its row is written. Whether an attempt is a
 * refusal is known only inside the unit, so the place is taken there, and the 429 of a budget
 * with no place left is thrown after the unit committed what it counted. One row is written
 * whatever the budget says: the row of a refusal that CHANGED what is stored (a reuse that ended
 * sessions or revoked tokens). It is the audit row of that change (spec §5.4), and the lockout
 * bounds it to five per window and device.
 *
 * THE TOKENS. The presented value goes to the hash and nowhere else. The next token and the
 * session token are generated here, returned ONCE in the answer, and stored as SHA-256. None
 * reaches a row, an event, a publication or a log line.
 */
import { ApiErrorCode, type AuthSessionInfo } from '@dems/shared/api';
import { AuthMethod } from '@dems/shared/sim';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { ApiFailure } from '../../../plugins/error-envelope';
import { appendActivity } from '../activity';
import type { ConsoleLockout, FailureOutcome, LockRefusal } from '../lockout';
import { markSignedIn, readRolePermissions } from '../session-store';
import { issueSession } from '../sessions';
import { authSessionInfo, consoleLocked } from '../sign-in';
import { TokenRefusalReason, lockedOut, tokenRefused, tokenSignedIn } from './activity';
import { claimToken, insertToken, readTokenState, revokeBiometricTokens, type TokenState } from './store';
import { BIOMETRIC_TOKEN_LIFETIME_MS, biometricTokenHash, newBiometricToken } from './tokens';

/** The label of the unit. It appears in the pipeline's log lines. */
export const SIGN_IN_UNIT_LABEL = 'identity.biometric.signIn';

/** The one answer of a token that was not accepted. It says nothing about why. */
export function tokenNotAccepted(attemptsRemaining: number): ApiFailure {
  return new ApiFailure(401, ApiErrorCode.INVALID_CREDENTIALS, 'Biometric sign-in was not accepted. Sign in with the password.', {
    details: { attemptsRemaining },
  });
}

/** Why a presented value signs nobody in, as the audit row words it. */
export interface TokenRefusal {
  /** The operator of the stored token the value matched; null when it matched none. */
  readonly operatorId: string | null;
  readonly reason: TokenRefusalReason | null;
  /**
   * Set when the refusal is a reuse (the token was used before, or it is live and another device
   * presented it): the family, the device and the operator of that token.
   */
  readonly reused: Pick<TokenState, 'familyId' | 'deviceId' | 'operatorId'> | null;
}

/**
 * What a failed claim was refused for, from what is stored under the presented hash. The order
 * is fixed: a token that was used before is a reuse whoever presents it and whatever else is
 * true of it; then a token of another device, which is the same reuse while it is live (not
 * revoked, not past its time) and a plain refusal once it is dead; then revoked; then expired.
 */
export function refusalOfToken(found: TokenState | null, deviceId: string, now: number): TokenRefusal {
  if (found === null) return { operatorId: null, reason: null, reused: null };
  const { operatorId } = found;
  const reuse: TokenRefusal = {
    operatorId,
    reason: TokenRefusalReason.TOKEN_REUSE,
    reused: { familyId: found.familyId, deviceId: found.deviceId, operatorId },
  };
  if (found.usedAt !== null) return reuse;
  if (found.deviceId !== deviceId) {
    // Live, and presented by a device it was never issued to: it has left its device (CPS1-7).
    const live = found.revokedAt === null && found.expiresAt > now;
    return live ? reuse : { operatorId, reason: TokenRefusalReason.OTHER_DEVICE, reused: null };
  }
  if (found.revokedAt !== null) {
    const reason = found.revokeReason === 'USER_DISABLED' ? TokenRefusalReason.USER_DISABLED : TokenRefusalReason.TOKEN_REVOKED;
    return { operatorId, reason, reused: null };
  }
  if (found.expiresAt <= now) return { operatorId, reason: TokenRefusalReason.TOKEN_EXPIRED, reused: null };
  // Usable by what is stored now, and yet not claimed: the claim did not see this state. No use.
  return { operatorId, reason: null, reused: null };
}

/** What the sign-in needs from the identity module: the lockout the password sign-in counts on. */
export interface BiometricServices {
  readonly lockout: ConsoleLockout;
}

export interface BiometricSignIn {
  /** Returned once: the bearer value of the new session. */
  readonly sessionToken: string;
  /** Returned once: the token for the next biometric sign-in. */
  readonly biometricToken: string;
  readonly info: AuthSessionInfo;
}

/** What the unit decided. `limited` is the 429 of the denial budget when a refusal found no place left. */
type SignInOutcome =
  | ({ readonly kind: 'SIGNED_IN' } & BiometricSignIn)
  | { readonly kind: 'FAILED'; readonly failure: FailureOutcome; readonly limited: unknown }
  | { readonly kind: 'LOCKED'; readonly refusal: LockRefusal; readonly limited: unknown };

/** What a refused attempt did to what is stored, and what its row says. */
interface Refused {
  readonly operatorId: string | null;
  readonly reason: TokenRefusalReason | null;
  readonly sessionsEnded: number | null;
  /** True when the refusal revoked a token, ended a session or used the token up. */
  readonly changed: boolean;
}

export async function signInWithBiometricToken(
  app: FastifyInstance,
  services: BiometricServices,
  request: FastifyRequest,
  deviceId: string,
  presentedToken: string,
): Promise<BiometricSignIn> {
  const { lockout } = services;
  const tokenHash = biometricTokenHash(presentedToken);

  /** One place in the denial budget for one refusal row. Null: taken. Otherwise the 429 to answer after the unit. */
  const placeInBudget = async (): Promise<unknown> => {
    try {
      await app.denialBudget.consume(request);
      return null;
    } catch (refused) {
      return refused;
    }
  };

  const outcome = await app.pipeline.run(SIGN_IN_UNIT_LABEL, async (unit): Promise<SignInOutcome> => {
    const now = app.clock.now();

    // 1. The attempt is taken BEFORE anything is read (ENG-24).
    const attempt = await lockout.take(deviceId, now);
    if (attempt.kind === 'LOCKED') {
      const limited = await placeInBudget();
      // Not verified, and not looked up: the row names the device and nobody else.
      if (limited === null) {
        await appendActivity(unit, lockedOut({ operatorId: null, deviceId, lockedUntil: attempt.lockedUntil, retryInMs: attempt.retryInMs }));
      }
      return { kind: 'LOCKED', refusal: attempt, limited };
    }

    // 2. The consuming compare-and-set (ENG-25): its row count decides.
    const claimed = await claimToken(unit, tokenHash, deviceId, now);
    let refused: Refused;

    if (claimed !== null) {
      // 3a. This request owns the use. The device first (a read), the operator last: its
      // statement writes the time of the sign-in, and only where the operator is enabled.
      const deviceState = await app.deviceResolver.deviceState(unit, deviceId);
      const operator = deviceState === 'PAIRED' ? await markSignedIn(unit, claimed.operatorId, now) : null;
      if (operator !== null) {
        const permissions = await readRolePermissions(unit, operator.role);
        const biometricToken = newBiometricToken();
        await insertToken(unit, {
          tokenHash: biometricTokenHash(biometricToken),
          familyId: claimed.familyId,
          deviceId,
          operatorId: operator.id,
          issuedAt: now,
          expiresAt: now + BIOMETRIC_TOKEN_LIFETIME_MS,
        });
        const issued = await issueSession(unit, { operatorId: operator.id, deviceId, method: AuthMethod.BIOMETRIC, now });
        await appendActivity(unit, tokenSignedIn({ operatorId: operator.id, displayName: operator.displayName, deviceId }));
        // A success clears the device's count and its lock. It ends no session and publishes
        // nothing: no session is presented with a biometric sign-in (the registry's condition
        // `DEVICE_CREDENTIAL` on operation 8).
        unit.afterCommit(() => lockout.succeed(deviceId));
        return {
          kind: 'SIGNED_IN',
          sessionToken: issued.token,
          biometricToken,
          info: authSessionInfo(app, issued.session, operator, permissions),
        };
      }
      // The token was right and nobody may sign in with it: it stays used, and its family ends.
      const paired = deviceState === 'PAIRED';
      await revokeBiometricTokens(
        unit,
        { scope: 'FAMILY', familyId: claimed.familyId, reason: paired ? 'USER_DISABLED' : deviceState === 'UNPAIRED' ? 'DEVICE_UNPAIRED' : 'DEVICE_REVOKED' },
        now,
      );
      refused = {
        operatorId: claimed.operatorId,
        reason: paired ? TokenRefusalReason.USER_DISABLED : TokenRefusalReason.DEVICE_NOT_PAIRED,
        sessionsEnded: null,
        changed: true,
      };
    } else {
      // 3b. No row: read why. Only a reuse changes anything: a token that was used before, or a
      // live token of another device.
      const refusal = refusalOfToken(await readTokenState(unit, tokenHash), deviceId, now);
      if (refusal.reused === null) {
        refused = { operatorId: refusal.operatorId, reason: refusal.reason, sessionsEnded: null, changed: false };
      } else {
        const { familyId, deviceId: tokenDevice, operatorId: tokenOperator } = refusal.reused;
        const revoked = await revokeBiometricTokens(unit, { scope: 'FAMILY', familyId, reason: 'TOKEN_REUSE' }, now);
        const sessionIds = await app.sessionRegistry.endBiometricSessions(unit, tokenDevice, tokenOperator);
        if (sessionIds.length > 0) unit.afterCommit(() => app.publish({ kind: 'session.ended', sessionIds, reason: 'TOKEN_REUSE' }));
        refused = {
          operatorId: refusal.operatorId,
          reason: refusal.reason,
          sessionsEnded: sessionIds.length,
          changed: revoked > 0 || sessionIds.length > 0,
        };
      }
    }

    // The failure is counted, then audited.
    const failure = await lockout.fail(deviceId, attempt, now);
    const limited = await placeInBudget();
    if (limited === null || refused.changed) {
      await appendActivity(
        unit,
        tokenRefused({
          operatorId: refused.operatorId,
          deviceId,
          attemptsRemaining: failure.attemptsRemaining,
          lockedUntil: failure.lockedUntil,
          reason: refused.reason,
          sessionsEnded: refused.sessionsEnded,
        }),
      );
    }
    return { kind: 'FAILED', failure, limited };
  });

  if (outcome.kind === 'SIGNED_IN') return { sessionToken: outcome.sessionToken, biometricToken: outcome.biometricToken, info: outcome.info };
  // The unit has committed what it counted and changed. No place in the denial budget: 429.
  if (outcome.limited !== null) throw outcome.limited;
  if (outcome.kind === 'LOCKED') throw consoleLocked(outcome.refusal.lockedUntil, outcome.refusal.retryInMs);
  const { failure } = outcome;
  throw failure.lockedUntil === null ? tokenNotAccepted(failure.attemptsRemaining) : consoleLocked(failure.lockedUntil, failure.retryInMs);
}
