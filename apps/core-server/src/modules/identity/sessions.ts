/**
 * Server-side sessions (plan row W24; spec §5.1 ID-P4 to ID-P9, §5.2 ID-6 to ID-10, ID-13, §5.4;
 * SR-09 to SR-13, SR-17; database contract §4.6, §5.2, §5.3, §5.6).
 *
 * A session is a row of `auth_sessions`: opaque, server-side, found by the hash of the token
 * that was presented. It holds no role and no permission; both are read from PostgreSQL with
 * every lookup (RB-3, SR-13). Rows survive a restart, and an ended session stays as a row with
 * its reason (SR-17).
 *
 *   idle limit      15 minutes after the last activity (a POST or `touchSession`, ID-P9);
 *   absolute limit  8 hours after the issue, whatever the activity.
 *
 * Both are decided by the server clock, at two places (SR-11): when a token is presented
 * (`resolve`), and by the sweeper (`sweep`). Whoever comes first ends the session with one
 * compare-and-set statement, writes `AUTH_EXPIRED` in the same unit of work and publishes
 * `session.ended` after the commit; the other finds nothing to end and writes nothing.
 *
 * Reads run on the pool. Every change is one unit of the serial pipeline (ENG-23).
 */
import type { Permission } from '@dems/shared/sim';
import type { FastifyInstance } from 'fastify';
import type { Pool } from 'pg';
import { unitContextOf, type UnitContext, type UnitOfWork } from '../../core';
import type { SessionEndReason } from '../../db/schema';
import type { ReadContext } from '../../plugins/db';
import type { SessionEndedReason } from '../../realtime';
import { appendActivities, appendActivity, sessionExpired, signedOut, type Activity, type ExpiryReason } from './activity';
import { SESSION_ABSOLUTE_TIMEOUT_MS, SESSION_IDLE_TIMEOUT_MS } from './limits';
import {
  anyExpiredSession,
  endBiometricSessions,
  endSession,
  endSessionsOfDevice,
  endSessionsOfOperator,
  expireSession,
  expireSessions,
  findSession,
  insertSession,
  readSessionState,
  touchSession,
  type AuthSession,
  type EndedSession,
  type FoundSession,
  type OperatorProfile,
  type Queryable,
  type SessionTransport,
} from './session-store';
import { newSessionToken, sessionTokenHash } from './tokens';

/** An open session with its operator as read for this request. */
export interface OpenSession extends AuthSession {
  readonly operator: OperatorProfile;
  /** The permissions of the operator's role, read with the session (RB-3). */
  readonly permissions: readonly Permission[];
}

/** What a presented token resolves to on its transport. */
export type SessionResolution =
  | { readonly status: 'OPEN'; readonly session: OpenSession }
  /** No session has this token on this transport (also: a token of the other transport, ID-13). */
  | { readonly status: 'UNKNOWN' }
  /** The session ended before, or was past a limit and is ended now. */
  | {
      readonly status: 'ENDED';
      readonly sessionId: string;
      readonly deviceId: string | null;
      readonly endReason: SessionEndReason;
    }
  /** The session is open but its operator is disabled: it resolves to nothing. */
  | { readonly status: 'OPERATOR_DISABLED'; readonly sessionId: string; readonly deviceId: string | null };

export type TouchOutcome =
  /** Activity was recorded, or was recorded already at this instant. */
  | { readonly status: 'TOUCHED' | 'UNCHANGED'; readonly lastSeenAt: number }
  /** The session ended meanwhile, or was past a limit and is ended now. */
  | { readonly status: 'ENDED' };

/** The reasons another module may end sessions with. */
export type OperatorEndReason = Extract<SessionEndReason, 'USER_DISABLED'>;
export type DeviceEndReason = Extract<SessionEndReason, 'DEVICE_REVOKED' | 'DEVICE_UNPAIRED'>;

/**
 * The seam `app.sessionRegistry` (P25): what the `authenticate` stage, the administration
 * module, the pairing module, the biometric operations and the realtime channel need from the
 * auth sessions.
 */
export interface SessionRegistry {
  /**
   * Stage 4: the session a presented token belongs to. `transport` is where the token was
   * presented; a cookie finds only a session without a device, a bearer value only one with a
   * device (ID-13). A session past its idle or absolute limit is ended here, with its
   * `AUTH_EXPIRED` row. The token itself is never stored, logged or returned.
   */
  resolve(token: string, transport: SessionTransport): Promise<SessionResolution>;
  /** Records activity on a session (ID-P9), in a unit of its own. Never revives an expired session. */
  touch(sessionId: string): Promise<TouchOutcome>;
  /**
   * Ends every open session of one operator inside the CALLER's unit of work (a disabled user,
   * spec §4.7). Returns the IDs of the ended sessions: the caller counts them into its audit row
   * (`sessionsEnded`) and publishes `session.ended` after its commit. No row is written here.
   */
  endForOperator(unit: UnitOfWork, operatorId: string, reason: OperatorEndReason): Promise<readonly string[]>;
  /** The same for one paired device (a revoked or unpaired device). */
  endForDevice(unit: UnitOfWork, deviceId: string, reason: DeviceEndReason): Promise<readonly string[]>;
  /**
   * The same for the open BIOMETRIC sessions of one device and operator, with the reason
   * `TOKEN_REUSE` (a reused biometric token, spec §5.6 step 6). Password sessions stay open.
   */
  endBiometricSessions(unit: UnitOfWork, deviceId: string, operatorId: string): Promise<readonly string[]>;
  /**
   * One expiry sweep at the server clock's time: ends every open session past a limit, with one
   * `AUTH_EXPIRED` row each, and publishes `session.ended`. The timer of a listening server calls
   * it every 5 s; a test calls it after moving the clock.
   */
  sweep(): Promise<readonly EndedSession[]>;
}

/** The reason of the `session.ended` publication for an expiry. */
const EXPIRY_PUBLICATION: Readonly<Record<'IDLE_EXPIRED' | 'ABSOLUTE_EXPIRED', { publish: SessionEndedReason; audit: ExpiryReason }>> = {
  IDLE_EXPIRED: { publish: 'IDLE_EXPIRED', audit: 'IDLE' },
  ABSOLUTE_EXPIRED: { publish: 'ABSOLUTE_EXPIRED', audit: 'ABSOLUTE' },
};

function isExpiryReason(reason: SessionEndReason): reason is 'IDLE_EXPIRED' | 'ABSOLUTE_EXPIRED' {
  return reason === 'IDLE_EXPIRED' || reason === 'ABSOLUTE_EXPIRED';
}

/** The pool as a connection of the statements. Read through `app.db.pool` each time: a reset replaces the pool. */
export function onPool(pool: Pool): Queryable {
  return { query: (text, values) => pool.query(text, values === undefined ? [] : [...values]) };
}

/**
 * A read on the pool, through the one helper of the pool plugin (`app.db.read`; review finding
 * CPB1-8): `work` gets the current pool as a connection of this module's statements. A failure
 * is the database's, not the caller's: the helper logs it by its code (never by its message,
 * which can quote a statement), persists it, tells readiness, and answers 503 `NOT_READY`.
 * `source` names the read for the log, for example `identity.sessions.resolve`. `context` is
 * the request the read belongs to, when the caller has one: the helper's line and entry then
 * carry its request ID.
 */
export function readDatabase<T>(app: FastifyInstance, source: string, work: (db: Queryable) => Promise<T>, context?: ReadContext): Promise<T> {
  return app.db.read(source, (pool) => work(onPool(pool)), context);
}

export interface IssuedSession {
  /** Returned once to the caller of the sign-in; only its hash is stored. */
  readonly token: string;
  readonly session: AuthSession;
}

/**
 * Issues a session inside the caller's unit of work: a new token, and the row with its hash.
 * For the password sign-in here and for the biometric sign-in (`biometric/`).
 */
export async function issueSession(
  unit: UnitContext,
  input: { readonly operatorId: string; readonly deviceId: string | null; readonly method: AuthSession['method']; readonly now: number },
): Promise<IssuedSession> {
  const token = newSessionToken();
  const session = await insertSession(unit, {
    tokenHash: sessionTokenHash(token),
    operatorId: input.operatorId,
    deviceId: input.deviceId,
    method: input.method,
    issuedAt: input.now,
    absoluteExpiresAt: input.now + SESSION_ABSOLUTE_TIMEOUT_MS,
  });
  return { token, session };
}

export function createSessionRegistry(app: FastifyInstance): SessionRegistry {
  const idleCutoff = (now: number): number => now - SESSION_IDLE_TIMEOUT_MS;
  const pastLimit = (session: FoundSession, now: number): boolean =>
    now >= session.absoluteExpiresAt || session.lastSeenAt <= idleCutoff(now);

  function expiryOf(ended: EndedSession): Activity | null {
    if (!isExpiryReason(ended.endReason)) return null;
    return sessionExpired({
      operatorId: ended.operatorId,
      deviceId: ended.deviceId,
      reason: EXPIRY_PUBLICATION[ended.endReason].audit,
    });
  }

  /** After the commit, in commit order: one publication per reason. */
  function publishExpired(unit: UnitContext, ended: readonly EndedSession[]): void {
    for (const reason of ['IDLE_EXPIRED', 'ABSOLUTE_EXPIRED'] as const) {
      const sessionIds = ended.filter((session) => session.endReason === reason).map((session) => session.id);
      if (sessionIds.length === 0) continue;
      unit.afterCommit(() => app.publish({ kind: 'session.ended', sessionIds, reason: EXPIRY_PUBLICATION[reason].publish }));
    }
  }

  /** Inside a unit: ends this session if it is open and past a limit, with its row and event. */
  async function expireIn(unit: UnitContext, sessionId: string, now: number): Promise<EndedSession | null> {
    const ended = await expireSession(unit, sessionId, now, idleCutoff(now));
    if (ended === null) return null;
    const activity = expiryOf(ended);
    if (activity !== null) await appendActivity(unit, activity);
    publishExpired(unit, [ended]);
    return ended;
  }

  const lookup = (token: string, transport: SessionTransport): Promise<FoundSession | null> =>
    readDatabase(app, 'identity.sessions.resolve', (db) => findSession(db, sessionTokenHash(token), transport));

  return {
    async resolve(token, transport) {
      let found = await lookup(token, transport);
      if (found === null) return { status: 'UNKNOWN' };

      if (found.endedAt === null && pastLimit(found, app.clock.now())) {
        const sessionId = found.id;
        const ended = await app.pipeline.run('identity.expireSession', (unit) => expireIn(unit, sessionId, app.clock.now()));
        if (ended !== null) {
          return { status: 'ENDED', sessionId: ended.id, deviceId: ended.deviceId, endReason: ended.endReason };
        }
        // The statement ended nothing: another unit ended the session, or activity arrived
        // first. What is stored now decides.
        found = await lookup(token, transport);
        if (found === null) return { status: 'UNKNOWN' };
        if (found.endedAt === null && pastLimit(found, app.clock.now())) {
          // Open and past a limit, and yet not ended by the statement: that cannot be. Whatever
          // made it so, a session past its limit never resolves; the sweeper ends the row.
          return { status: 'ENDED', sessionId: found.id, deviceId: found.deviceId, endReason: 'IDLE_EXPIRED' };
        }
      }

      if (found.endedAt !== null) {
        return { status: 'ENDED', sessionId: found.id, deviceId: found.deviceId, endReason: found.endReason ?? 'SIGNED_OUT' };
      }
      if (!found.operatorEnabled) return { status: 'OPERATOR_DISABLED', sessionId: found.id, deviceId: found.deviceId };
      return {
        status: 'OPEN',
        session: {
          id: found.id,
          operatorId: found.operatorId,
          deviceId: found.deviceId,
          method: found.method,
          issuedAt: found.issuedAt,
          lastSeenAt: found.lastSeenAt,
          absoluteExpiresAt: found.absoluteExpiresAt,
          operator: found.operator,
          permissions: found.permissions,
        },
      };
    },

    touch(sessionId) {
      return app.pipeline.run('identity.touch', async (unit): Promise<TouchOutcome> => {
        const now = app.clock.now();
        const touched = await touchSession(unit, sessionId, now, idleCutoff(now));
        if (touched !== null) return { status: 'TOUCHED', lastSeenAt: touched };
        // No row: ended, past a limit, or touched at this very instant. Each has its answer.
        if ((await expireIn(unit, sessionId, now)) !== null) return { status: 'ENDED' };
        const state = await readSessionState(unit, sessionId);
        if (state === null || state.endedAt !== null) return { status: 'ENDED' };
        return { status: 'UNCHANGED', lastSeenAt: state.lastSeenAt };
      });
    },

    async endForOperator(unit, operatorId, reason) {
      const ended = await endSessionsOfOperator(unitContextOf(unit), operatorId, app.clock.now(), reason);
      return ended.map((session) => session.id);
    },

    async endForDevice(unit, deviceId, reason) {
      const ended = await endSessionsOfDevice(unitContextOf(unit), deviceId, app.clock.now(), reason);
      return ended.map((session) => session.id);
    },

    async endBiometricSessions(unit, deviceId, operatorId) {
      const ended = await endBiometricSessions(unitContextOf(unit), deviceId, operatorId, app.clock.now());
      return ended.map((session) => session.id);
    },

    async sweep() {
      const asked = app.clock.now();
      // A read first: a sweep that finds nothing opens no transaction and takes no chain lock.
      // It decides nothing: the unit's statement states the predicate again.
      const pending = await readDatabase(app, 'identity.sessions.sweep', (db) => anyExpiredSession(db, asked, idleCutoff(asked)));
      if (!pending) return [];
      return app.pipeline.run('identity.sweep', async (unit) => {
        const now = app.clock.now();
        const ended = await expireSessions(unit, now, idleCutoff(now));
        const activities = ended.map(expiryOf).filter((activity): activity is Activity => activity !== null);
        await appendActivities(unit, activities);
        publishExpired(unit, ended);
        return ended;
      });
    },
  };
}

/**
 * Sign-out: ends the caller's own session with one compare-and-set statement. The session that
 * was open gets its `AUTH_SIGNED_OUT` row and its publication; a session that was ended already
 * (a sign-out that raced another one, the sweeper, a disable) gets no second row.
 */
export async function signOutSession(
  app: FastifyInstance,
  session: Pick<AuthSession, 'id' | 'operatorId' | 'deviceId'>,
  reason: 'USER' | 'LOCK',
): Promise<boolean> {
  return app.pipeline.run('identity.signOut', async (unit) => {
    const ended = await endSession(unit, session.id, app.clock.now(), 'SIGNED_OUT');
    if (ended === null) return false;
    await appendActivity(unit, signedOut({ operatorId: ended.operatorId, deviceId: ended.deviceId, reason }));
    unit.afterCommit(() => app.publish({ kind: 'session.ended', sessionIds: [ended.id], reason: 'SIGNED_OUT' }));
    return true;
  });
}
