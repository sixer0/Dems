/**
 * The statements of the identity module (plan row W24; database contract §4.4 to §4.6, §5.2,
 * §5.6 AT-3, AT-C1; spec §5, RB-3; SR-09, SR-12, SR-13, SR-67).
 *
 * Every statement is a constant text with bind parameters; no value is ever part of a statement
 * text (SR-67, NL-3). A function takes the connection to run on: the pool for a read, the unit of
 * work for a change. Every table is named with its schema.
 *
 * WHAT IS NEVER SELECTED INTO AN ANSWER OR A LOG (NL-1, NL-6): `auth_sessions.token_hash`, and
 * every column of `operator_credentials`. The token hash is a WHERE parameter only. The hash set
 * of an operator is read by `findSignInCandidate` alone and goes to the password-hash wrapper
 * and nowhere else.
 *
 * TRANSITIONS ARE COMPARE-AND-SET (AT-3): one UPDATE whose WHERE states the expected state and
 * whose returned rows decide. The server never decides from a value that an earlier statement
 * read without a lock: who ends a session, and why, is decided by the statement that ends it.
 */
import type { OperatorRole, Permission } from '@dems/shared/sim';
import type { QueryResultRow } from 'pg';
import type { AuthMethodValue, SessionEndReason } from '../../db/schema';
import type { PasswordHashRecord, StoredPasswordHash } from './password-hash';

/** A connection that runs one parameterised statement: the runtime pool, or a unit of work. */
export interface Queryable {
  query<Row extends QueryResultRow = QueryResultRow>(
    text: string,
    values?: readonly unknown[],
  ): Promise<{ readonly rows: Row[]; readonly rowCount: number | null }>;
}

/** The public members of an operator: the members of the simulator's `operators` slice. */
export interface OperatorProfile {
  readonly id: string;
  readonly username: string;
  readonly rank: string | null;
  readonly name: string;
  readonly displayName: string;
  readonly initials: string;
  readonly role: OperatorRole;
}

/** A row of `auth_sessions` without its token hash. Times are epoch milliseconds. */
export interface AuthSession {
  /** The row's UUID: safe to log (NL-7), never the token. */
  readonly id: string;
  readonly operatorId: string;
  /** Null for a web console session; the paired device of a bearer session. */
  readonly deviceId: string | null;
  readonly method: AuthMethodValue;
  readonly issuedAt: number;
  readonly lastSeenAt: number;
  readonly absoluteExpiresAt: number;
}

/** A session row as found by a presented token, with its operator as read for this request (RB-3). */
export interface FoundSession extends AuthSession {
  readonly endedAt: number | null;
  readonly endReason: SessionEndReason | null;
  readonly operator: OperatorProfile;
  readonly operatorEnabled: boolean;
  /** The permissions of the operator's role, in the order of the permission table. */
  readonly permissions: readonly Permission[];
}

/** The transport a token was presented on. It is half of the lookup (ID-13). */
export type SessionTransport = 'COOKIE' | 'BEARER';

/** A session that a statement ended, with what its audit row and its publication need. */
export interface EndedSession {
  readonly id: string;
  readonly operatorId: string;
  readonly deviceId: string | null;
  readonly endReason: SessionEndReason;
}

// The driver hands a `bigint` column over as text; every time of this module is a safe integer.
const time = (value: string | number): number => Number(value);
const optionalTime = (value: string | number | null): number | null => (value === null ? null : Number(value));

// ── Sessions: the lookup of stage 4 ────────────────────────────────────────────────────────────

interface FoundSessionRow extends QueryResultRow {
  id: string;
  operator_id: string;
  device_id: string | null;
  method: AuthMethodValue;
  issued_at: string;
  last_seen_at: string;
  absolute_expires_at: string;
  ended_at: string | null;
  end_reason: SessionEndReason | null;
  username: string;
  rank: string | null;
  name: string;
  display_name: string;
  initials: string;
  role_id: OperatorRole;
  enabled: boolean;
  permissions: Permission[];
}

const FIND_SESSION =
  'SELECT s.id, s.operator_id, s.device_id, s.method, s.issued_at, s.last_seen_at, s.absolute_expires_at, s.ended_at, s.end_reason, ' +
  'o.username, o.rank, o.name, o.display_name, o.initials, o.role_id, o.enabled, ' +
  'ARRAY(SELECT rp.permission_id FROM public.role_permissions rp JOIN public.permissions p ON p.id = rp.permission_id ' +
  'WHERE rp.role_id = o.role_id ORDER BY p.sort_order) AS permissions ' +
  'FROM public.auth_sessions s JOIN public.operators o ON o.id = s.operator_id WHERE s.token_hash = $1 AND ';

/**
 * The two lookups of database contract §5.2. The transport is part of the predicate: a cookie
 * finds only a session without a device, a bearer value only a session with one (ID-13). A
 * token presented on the other transport is "not found", and its row is not touched.
 */
export const FIND_SESSION_BY_TRANSPORT: Readonly<Record<SessionTransport, string>> = {
  COOKIE: `${FIND_SESSION}s.device_id IS NULL`,
  BEARER: `${FIND_SESSION}s.device_id IS NOT NULL`,
};

export async function findSession(db: Queryable, tokenHash: Buffer, transport: SessionTransport): Promise<FoundSession | null> {
  const { rows } = await db.query<FoundSessionRow>(FIND_SESSION_BY_TRANSPORT[transport], [tokenHash]);
  const row = rows[0];
  if (row === undefined) return null;
  return {
    id: row.id,
    operatorId: row.operator_id,
    deviceId: row.device_id,
    method: row.method,
    issuedAt: time(row.issued_at),
    lastSeenAt: time(row.last_seen_at),
    absoluteExpiresAt: time(row.absolute_expires_at),
    endedAt: optionalTime(row.ended_at),
    endReason: row.end_reason,
    operator: {
      id: row.operator_id,
      username: row.username,
      rank: row.rank,
      name: row.name,
      displayName: row.display_name,
      initials: row.initials,
      role: row.role_id,
    },
    operatorEnabled: row.enabled,
    permissions: row.permissions,
  };
}

// ── Sessions: issue, end, touch, expire ────────────────────────────────────────────────────────

export interface NewSession {
  readonly tokenHash: Buffer;
  readonly operatorId: string;
  readonly deviceId: string | null;
  readonly method: AuthMethodValue;
  readonly issuedAt: number;
  readonly absoluteExpiresAt: number;
}

export const INSERT_SESSION =
  'INSERT INTO public.auth_sessions (token_hash, operator_id, device_id, method, issued_at, last_seen_at, absolute_expires_at) ' +
  'VALUES ($1, $2, $3, $4, $5, $5, $6) RETURNING id';

export async function insertSession(db: Queryable, session: NewSession): Promise<AuthSession> {
  const { rows } = await db.query<{ id: string }>(INSERT_SESSION, [
    session.tokenHash,
    session.operatorId,
    session.deviceId,
    session.method,
    session.issuedAt,
    session.absoluteExpiresAt,
  ]);
  const id = rows[0]?.id;
  if (id === undefined) throw new Error('the session insert returned no row');
  return {
    id,
    operatorId: session.operatorId,
    deviceId: session.deviceId,
    method: session.method,
    issuedAt: session.issuedAt,
    lastSeenAt: session.issuedAt,
    absoluteExpiresAt: session.absoluteExpiresAt,
  };
}

interface EndedRow extends QueryResultRow {
  id: string;
  operator_id: string;
  device_id: string | null;
  end_reason: SessionEndReason;
}

const ended = (row: EndedRow): EndedSession => ({
  id: row.id,
  operatorId: row.operator_id,
  deviceId: row.device_id,
  endReason: row.end_reason,
});

const RETURNING_ENDED = 'RETURNING id, operator_id, device_id, end_reason';

/** AT-3: no row means the session was ended before; no second audit row is then written. */
export const END_SESSION =
  `UPDATE public.auth_sessions SET ended_at = $2, end_reason = $3 WHERE id = $1 AND ended_at IS NULL ${RETURNING_ENDED}`;

export async function endSession(db: Queryable, sessionId: string, now: number, reason: SessionEndReason): Promise<EndedSession | null> {
  const { rows } = await db.query<EndedRow>(END_SESSION, [sessionId, now, reason]);
  return rows[0] === undefined ? null : ended(rows[0]);
}

export const END_SESSIONS_OF_OPERATOR =
  `UPDATE public.auth_sessions SET ended_at = $2, end_reason = $3 WHERE operator_id = $1 AND ended_at IS NULL ${RETURNING_ENDED}`;
export const END_SESSIONS_OF_DEVICE =
  `UPDATE public.auth_sessions SET ended_at = $2, end_reason = $3 WHERE device_id = $1 AND ended_at IS NULL ${RETURNING_ENDED}`;
/** AT-C4: the open BIOMETRIC sessions of one device and operator, after a reused biometric token. */
export const END_BIOMETRIC_SESSIONS =
  "UPDATE public.auth_sessions SET ended_at = $3, end_reason = 'TOKEN_REUSE' " +
  `WHERE device_id = $1 AND operator_id = $2 AND method = 'BIOMETRIC' AND ended_at IS NULL ${RETURNING_ENDED}`;

export async function endSessionsOfOperator(db: Queryable, operatorId: string, now: number, reason: SessionEndReason): Promise<EndedSession[]> {
  return (await db.query<EndedRow>(END_SESSIONS_OF_OPERATOR, [operatorId, now, reason])).rows.map(ended);
}

export async function endSessionsOfDevice(db: Queryable, deviceId: string, now: number, reason: SessionEndReason): Promise<EndedSession[]> {
  return (await db.query<EndedRow>(END_SESSIONS_OF_DEVICE, [deviceId, now, reason])).rows.map(ended);
}

export async function endBiometricSessions(db: Queryable, deviceId: string, operatorId: string, now: number): Promise<EndedSession[]> {
  return (await db.query<EndedRow>(END_BIOMETRIC_SESSIONS, [deviceId, operatorId, now])).rows.map(ended);
}

/**
 * The expiry predicate, in the statement and nowhere else: `$now` has reached the absolute
 * limit, or the last activity is `$idleCutoff` (now minus 15 minutes) or older. The reason is
 * decided by the same statement, on the row it holds locked; the absolute limit wins when both
 * hold. A session that was touched or ended meanwhile is not matched (PG re-checks the WHERE on
 * the locked row at READ COMMITTED).
 */
const EXPIRE =
  "UPDATE public.auth_sessions SET ended_at = $1, end_reason = CASE WHEN absolute_expires_at <= $1 THEN 'ABSOLUTE_EXPIRED' ELSE 'IDLE_EXPIRED' END " +
  'WHERE ended_at IS NULL AND (absolute_expires_at <= $1 OR last_seen_at <= $2)';
/** The sweeper: every open session that is past a limit. */
export const EXPIRE_SESSIONS = `${EXPIRE} ${RETURNING_ENDED}`;
/** A request after the limit: this one session, if it is still open and still past a limit. */
export const EXPIRE_SESSION = `${EXPIRE} AND id = $3 ${RETURNING_ENDED}`;
/** The sweeper's question before it takes a unit: is there anything to end? A read; it decides nothing. */
export const ANY_EXPIRED_SESSION =
  'SELECT 1 AS found FROM public.auth_sessions WHERE ended_at IS NULL AND (absolute_expires_at <= $1 OR last_seen_at <= $2) LIMIT 1';

export async function expireSessions(db: Queryable, now: number, idleCutoff: number): Promise<EndedSession[]> {
  return (await db.query<EndedRow>(EXPIRE_SESSIONS, [now, idleCutoff])).rows.map(ended);
}

export async function expireSession(db: Queryable, sessionId: string, now: number, idleCutoff: number): Promise<EndedSession | null> {
  const { rows } = await db.query<EndedRow>(EXPIRE_SESSION, [now, idleCutoff, sessionId]);
  return rows[0] === undefined ? null : ended(rows[0]);
}

export async function anyExpiredSession(db: Queryable, now: number, idleCutoff: number): Promise<boolean> {
  return (await db.query(ANY_EXPIRED_SESSION, [now, idleCutoff])).rows.length > 0;
}

/**
 * AT-3 "touch", with the expiry predicate added: activity is recorded only on a session that is
 * open, not past a limit, and whose last activity is older than `$2`. So a touch never brings an
 * expired session back, and never moves the last activity backwards.
 */
export const TOUCH_SESSION =
  'UPDATE public.auth_sessions SET last_seen_at = $2 ' +
  'WHERE id = $1 AND ended_at IS NULL AND last_seen_at < $2 AND last_seen_at > $3 AND absolute_expires_at > $2 ' +
  'RETURNING last_seen_at';
export const READ_SESSION_STATE = 'SELECT last_seen_at, ended_at FROM public.auth_sessions WHERE id = $1';

export async function touchSession(db: Queryable, sessionId: string, now: number, idleCutoff: number): Promise<number | null> {
  const { rows } = await db.query<{ last_seen_at: string }>(TOUCH_SESSION, [sessionId, now, idleCutoff]);
  return rows[0] === undefined ? null : time(rows[0].last_seen_at);
}

/** The last activity and the end of one session; null when no such row exists. */
export async function readSessionState(db: Queryable, sessionId: string): Promise<{ lastSeenAt: number; endedAt: number | null } | null> {
  const { rows } = await db.query<{ last_seen_at: string; ended_at: string | null }>(READ_SESSION_STATE, [sessionId]);
  const row = rows[0];
  return row === undefined ? null : { lastSeenAt: time(row.last_seen_at), endedAt: optionalTime(row.ended_at) };
}

// ── Operators: the sign-in ─────────────────────────────────────────────────────────────────────

/** The operator a username names, with the hash set its password is verified against. */
export interface SignInCandidate {
  readonly operatorId: string;
  /** Every member is a column of `operator_credentials`: never logged, never returned (NL-1). */
  readonly record: StoredPasswordHash;
}

interface CandidateRow extends QueryResultRow {
  id: string;
  algorithm: string;
  memory_kib: number;
  passes: number;
  parallelism: number;
  salt: Buffer;
  hash: Buffer;
}

/** Database contract §5.2 "Password": by the unique username. Enabled or not is NOT asked here (ID-2). */
export const FIND_SIGN_IN_CANDIDATE =
  'SELECT o.id, c.algorithm, c.memory_kib, c.passes, c.parallelism, c.salt, c.hash ' +
  'FROM public.operators o JOIN public.operator_credentials c ON c.operator_id = o.id WHERE o.username = $1';

export async function findSignInCandidate(db: Queryable, username: string): Promise<SignInCandidate | null> {
  const { rows } = await db.query<CandidateRow>(FIND_SIGN_IN_CANDIDATE, [username]);
  const row = rows[0];
  if (row === undefined) return null;
  return {
    operatorId: row.id,
    record: {
      algorithm: row.algorithm,
      memoryKib: row.memory_kib,
      passes: row.passes,
      parallelism: row.parallelism,
      salt: row.salt,
      hash: row.hash,
    },
  };
}

interface ProfileRow extends QueryResultRow {
  id: string;
  username: string;
  rank: string | null;
  name: string;
  display_name: string;
  initials: string;
  role_id: OperatorRole;
}

/**
 * AT-C1: the re-check of unit 2. The hash was computed between the two units, and the operator
 * may have been disabled meanwhile. No row: disabled; no session is issued.
 */
export const MARK_SIGNED_IN =
  'UPDATE public.operators SET last_sign_in_at = $2, updated_at = $2 WHERE id = $1 AND enabled ' +
  'RETURNING id, username, rank, name, display_name, initials, role_id';

export async function markSignedIn(db: Queryable, operatorId: string, now: number): Promise<OperatorProfile | null> {
  const { rows } = await db.query<ProfileRow>(MARK_SIGNED_IN, [operatorId, now]);
  const row = rows[0];
  if (row === undefined) return null;
  return {
    id: row.id,
    username: row.username,
    rank: row.rank,
    name: row.name,
    displayName: row.display_name,
    initials: row.initials,
    role: row.role_id,
  };
}

export const FIND_OPERATOR_ID = 'SELECT id FROM public.operators WHERE username = $1';

/** The operator a username names, for the audit row of an attempt that is not verified (ID-4). */
export async function findOperatorId(db: Queryable, username: string): Promise<string | null> {
  const { rows } = await db.query<{ id: string }>(FIND_OPERATOR_ID, [username]);
  return rows[0]?.id ?? null;
}

export const READ_OPERATOR_ENABLED = 'SELECT enabled FROM public.operators WHERE id = $1';

/** Null when no such operator exists. For the detail `reason: USER_DISABLED` of a failed attempt (ID-4). */
export async function readOperatorEnabled(db: Queryable, operatorId: string): Promise<boolean | null> {
  const { rows } = await db.query<{ enabled: boolean }>(READ_OPERATOR_ENABLED, [operatorId]);
  return rows[0]?.enabled ?? null;
}

export const READ_ROLE_PERMISSIONS =
  'SELECT rp.permission_id FROM public.role_permissions rp JOIN public.permissions p ON p.id = rp.permission_id ' +
  'WHERE rp.role_id = $1 ORDER BY p.sort_order';

export async function readRolePermissions(db: Queryable, role: OperatorRole): Promise<Permission[]> {
  const { rows } = await db.query<{ permission_id: Permission }>(READ_ROLE_PERMISSIONS, [role]);
  return rows.map((row) => row.permission_id);
}

/**
 * SR-06: a row with older parameters is replaced after a successful sign-in. Compare-and-set on
 * the hash that was verified, so two sign-ins of one operator write one new record.
 */
export const REPLACE_CREDENTIALS =
  'UPDATE public.operator_credentials SET algorithm = $2, memory_kib = $3, passes = $4, parallelism = $5, salt = $6, hash = $7, hashed_at = $8 ' +
  'WHERE operator_id = $1 AND hash = $9 RETURNING operator_id';

export async function replaceCredentials(
  db: Queryable,
  operatorId: string,
  record: PasswordHashRecord,
  verifiedHash: Uint8Array,
  now: number,
): Promise<boolean> {
  const { rows } = await db.query(REPLACE_CREDENTIALS, [
    operatorId,
    record.algorithm,
    record.memoryKib,
    record.passes,
    record.parallelism,
    record.salt,
    record.hash,
    now,
    Buffer.from(verifiedHash),
  ]);
  return rows.length === 1;
}
