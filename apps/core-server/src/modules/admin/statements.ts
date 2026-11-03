/**
 * The statements of the administration module (plan row W33; database contract §4.3 to §4.6,
 * §4.10, §5.6 AT-3 and AT-C5, §7.3; spec §4.6 RB-8, §4.7, §7.6; SR-12, SR-47, SR-67, SR-72).
 *
 * Every statement is a constant text with bind parameters; no value is ever part of a statement
 * text (SR-67). A function takes the connection to run on: the pool for the one read of
 * `listUsers`, the unit of work for a change. Every table is named with its schema.
 *
 * WHAT THE RUNTIME ROLE MAY DO HERE (database contract §7.3): SELECT on every table named below;
 * UPDATE on `operators (role_id, enabled, role_changed_at, updated_at)`, plus — since migration
 * 0035 and the RB-9 amendment of 02-11-2026 — INSERT, DELETE and UPDATE on the four profile
 * columns, which is what lets operations 15 to 17 exist at all. A column-level UPDATE grant is
 * enough for `FOR UPDATE`. The live biometric tokens of a disabled operator are revoked in the
 * same unit, but not by a statement of this file: by `revokeBiometricTokens` of
 * `modules/identity/biometric` (scope `OPERATOR`; decision D105), the one writer of that table.
 *
 * WHAT IS NEVER SELECTED: a column of `operator_credentials`, a token hash. An `AdminUser` is the
 * public members of an operator, the two times, the flag and a count of open sessions.
 *
 * THE LOCK POINT OF THE LAST-ADMINISTRATOR RULE is `LOCK_OPERATORS`: every operator row, in key
 * order, `FOR UPDATE`. A second transaction that runs the same statement waits there and then
 * reads what the first one committed (READ COMMITTED takes the newest committed version of a row
 * it waited for), so it never decides on a state the first one changed. Every row is locked, not
 * only the administrators', so that nothing has to be reasoned about a predicate the first
 * change altered. The transitions themselves are compare-and-set (AT-3): one UPDATE whose WHERE
 * states the expected state and whose returned row decides.
 */
import type { AdminUser } from '@dems/shared/api';
import { GENESIS_HASH, chainHash, type AuditEventBody, type AuditRow, type OperatorRole, type Permission } from '@dems/shared/sim';
import type { QueryResultRow } from 'pg';
import { CoreError } from '../../core/errors';

/** A connection that runs one parameterised statement: the runtime pool, or a unit of work. */
export interface Queryable {
  query<Row extends QueryResultRow = QueryResultRow>(
    text: string,
    values?: readonly unknown[],
  ): Promise<{ readonly rows: Row[]; readonly rowCount: number | null }>;
}

/** An operator row as the rule needs it: who, which role, enabled or not. */
export interface LockedOperator {
  readonly id: string;
  readonly role: OperatorRole;
  readonly enabled: boolean;
}

// The driver hands a `bigint` column over as text; every time of this module is a safe integer.
const optionalTime = (value: string | number | null): number | null => (value === null ? null : Number(value));

// ── The user list ──────────────────────────────────────────────────────────────────────────────

interface UserRow extends QueryResultRow {
  id: string;
  username: string;
  rank: string | null;
  name: string;
  display_name: string;
  initials: string;
  role_id: OperatorRole;
  enabled: boolean;
  last_sign_in_at: string | null;
  role_changed_at: string | null;
  active_sessions: number;
}

/**
 * An operator as user administration sees it. `active_sessions` counts the session rows that are
 * not ended (index `auth_sessions_active_operator_idx`); a session past a limit stays in the
 * count until the sweeper or its own next request ends it.
 */
const USER_COLUMNS =
  'o.id, o.username, o.rank, o.name, o.display_name, o.initials, o.role_id, o.enabled, o.last_sign_in_at, o.role_changed_at, ' +
  '(SELECT count(*)::int FROM public.auth_sessions s WHERE s.operator_id = o.id AND s.ended_at IS NULL) AS active_sessions';

/** Operation 11: every operator, in operator ID order. One statement, one snapshot. */
export const LIST_USERS = `SELECT ${USER_COLUMNS} FROM public.operators o ORDER BY o.id`;
/** The operator an operation of 12 to 14 answers with, read inside its unit after the change. */
export const READ_USER = `SELECT ${USER_COLUMNS} FROM public.operators o WHERE o.id = $1`;

const userOf = (row: UserRow): AdminUser => ({
  id: row.id,
  username: row.username,
  rank: row.rank,
  name: row.name,
  displayName: row.display_name,
  initials: row.initials,
  role: row.role_id,
  enabled: row.enabled,
  lastSignInAt: optionalTime(row.last_sign_in_at),
  activeSessions: row.active_sessions,
  roleChangedAt: optionalTime(row.role_changed_at),
});

export async function listUsers(db: Queryable): Promise<AdminUser[]> {
  return (await db.query<UserRow>(LIST_USERS)).rows.map(userOf);
}

/** Null when no operator has this ID. */
export async function readUser(db: Queryable, operatorId: string): Promise<AdminUser | null> {
  const { rows } = await db.query<UserRow>(READ_USER, [operatorId]);
  return rows[0] === undefined ? null : userOf(rows[0]);
}

// ── The lock point (AT-C5) ─────────────────────────────────────────────────────────────────────

interface LockedRow extends QueryResultRow {
  id: string;
  role_id: OperatorRole;
  enabled: boolean;
}

const lockedOf = (row: LockedRow): LockedOperator => ({ id: row.id, role: row.role_id, enabled: row.enabled });

/** AT-C5: every operator row, in key order, locked until the unit ends. The lock point of RB-8. */
export const LOCK_OPERATORS = 'SELECT id, role_id, enabled FROM public.operators ORDER BY id FOR UPDATE';
/** One operator row, locked until the unit ends: `enableUser`, which cannot take an administrator away. */
export const LOCK_OPERATOR = 'SELECT id, role_id, enabled FROM public.operators WHERE id = $1 FOR UPDATE';

export async function lockOperators(db: Queryable): Promise<LockedOperator[]> {
  return (await db.query<LockedRow>(LOCK_OPERATORS)).rows.map(lockedOf);
}

/** Null when no operator has this ID. */
export async function lockOperator(db: Queryable, operatorId: string): Promise<LockedOperator | null> {
  const { rows } = await db.query<LockedRow>(LOCK_OPERATOR, [operatorId]);
  return rows[0] === undefined ? null : lockedOf(rows[0]);
}

/** AT-C5: the roles that hold one permission. `role_permissions` is read-only for the runtime role (RB-9). */
export const READ_ROLES_HOLDING = 'SELECT role_id FROM public.role_permissions WHERE permission_id = $1';

export async function readRolesHolding(db: Queryable, permission: Permission): Promise<ReadonlySet<string>> {
  const { rows } = await db.query<{ role_id: string }>(READ_ROLES_HOLDING, [permission]);
  return new Set(rows.map((row) => row.role_id));
}

// ── The transitions (AT-3: compare-and-set) ────────────────────────────────────────────────────

/** AT-C5 `assignUserRole`: `$4` is the role that was read under the lock. No row: it is not that role any more. */
export const ASSIGN_ROLE =
  'UPDATE public.operators SET role_id = $2, role_changed_at = $3, updated_at = $3 WHERE id = $1 AND role_id = $4 RETURNING id';
/** AT-C5 `disableUser`. No row: not enabled any more. */
export const DISABLE_OPERATOR = 'UPDATE public.operators SET enabled = false, updated_at = $2 WHERE id = $1 AND enabled RETURNING id';
/** `enableUser`. No row: enabled already. */
export const ENABLE_OPERATOR = 'UPDATE public.operators SET enabled = true, updated_at = $2 WHERE id = $1 AND NOT enabled RETURNING id';

const changedOne = (result: { readonly rows: unknown[] }): boolean => result.rows.length === 1;

export async function assignRole(db: Queryable, operatorId: string, role: OperatorRole, now: number, expectedRole: OperatorRole): Promise<boolean> {
  return changedOne(await db.query(ASSIGN_ROLE, [operatorId, role, now, expectedRole]));
}

export async function disableOperator(db: Queryable, operatorId: string, now: number): Promise<boolean> {
  return changedOne(await db.query(DISABLE_OPERATOR, [operatorId, now]));
}

export async function enableOperator(db: Queryable, operatorId: string, now: number): Promise<boolean> {
  return changedOne(await db.query(ENABLE_OPERATOR, [operatorId, now]));
}

// ── The permissions of a role, for the publication of a role change ────────────────────────────

/** The permissions a role holds, in the order of the permission table: what `session.updated` carries. */
export const READ_ROLE_PERMISSIONS =
  'SELECT rp.permission_id FROM public.role_permissions rp JOIN public.permissions p ON p.id = rp.permission_id ' +
  'WHERE rp.role_id = $1 ORDER BY p.sort_order';

export async function readRolePermissions(db: Queryable, role: OperatorRole): Promise<Permission[]> {
  const { rows } = await db.query<{ permission_id: Permission }>(READ_ROLE_PERMISSIONS, [role]);
  return rows.map((row) => row.permission_id);
}
// ── The vendor-only trio (RB-9 as amended by the principal, PT GSP, 02-11-2026) ───────────────
//
// These statements need INSERT, UPDATE and DELETE on `public.operators` and INSERT/DELETE on
// `public.operator_credentials`: grants the runtime role did not have before the amendment, added
// by migration 0035. Everything else keeps its rule: constant text with bind parameters, no value
// inside the text (SR-67), and no column of `operator_credentials` is ever SELECTed.

/** The username of the caller, read inside the unit: the identity half of the narrowed access rule. */
export const READ_USERNAME = 'SELECT username FROM public.operators WHERE id = $1';

export async function readUsername(db: Queryable, operatorId: string): Promise<string | null> {
  const { rows } = await db.query<{ username: string }>(READ_USERNAME, [operatorId]);
  return rows[0] === undefined ? null : rows[0].username;
}

/**
 * The next free operator ID: `OPR-` and the smallest three-digit number above the highest in use.
 * The allocation runs under `LOCK_OPERATORS`, so two creates cannot be handed the same ID.
 */
export const NEXT_OPERATOR_ID =
  "SELECT 'OPR-' || lpad((COALESCE(MAX(SUBSTRING(id FROM 5)::int), 0) + 1)::text, 3, '0') AS id FROM public.operators";

export async function nextOperatorId(db: Queryable): Promise<string> {
  const { rows } = await db.query<{ id: string }>(NEXT_OPERATOR_ID);
  const id = rows[0]?.id;
  if (typeof id !== 'string') throw new Error('the operator ID allocation returned no row');
  return id;
}

/** The UNIQUE of `operators`: is this sign-in name already taken by another operator? */
export const USERNAME_TAKEN = 'SELECT 1 FROM public.operators WHERE username = $1';

export async function usernameTaken(db: Queryable, username: string): Promise<boolean> {
  return (await db.query(USERNAME_TAKEN, [username])).rows.length > 0;
}

/** The create. A new account is enabled from the first moment; it still needs a credential to sign in. */
export const INSERT_OPERATOR =
  'INSERT INTO public.operators (id, username, rank, name, display_name, initials, role_id, enabled, role_changed_at, created_at, updated_at) ' +
  'VALUES ($1, $2, $3, $4, $5, $6, $7, true, $8, $8, $8) RETURNING id';

export interface NewOperator {
  readonly id: string;
  readonly username: string;
  readonly rank: string | null;
  readonly name: string;
  readonly displayName: string;
  readonly initials: string;
  readonly role: OperatorRole;
}

export async function insertOperator(db: Queryable, operator: NewOperator, now: number): Promise<boolean> {
  const result = await db.query(INSERT_OPERATOR, [operator.id, operator.username, operator.rank, operator.name, operator.displayName, operator.initials, operator.role, now]);
  return result.rows.length === 1;
}

// No statement here writes a credential: a created account is born without one and the password
// stays the host command's alone (decision U19). The module's only touch on that table is removing
// the row of an account it deletes, below, and it never reads or names a value of it.

/**
 * The profile update. `$2` to `$4` keep the column when null; `rank` carries its own presence flag,
 * because a null rank is a legitimate value (an operator with no rank) and not "not asked".
 */
export const UPDATE_PROFILE =
  'UPDATE public.operators SET name = COALESCE($2, name), display_name = COALESCE($3, display_name), initials = COALESCE($4, initials), ' +
  'rank = CASE WHEN $5::boolean THEN $6 ELSE rank END, updated_at = $7 WHERE id = $1 RETURNING id';

export interface ProfileChange {
  readonly name: string | null;
  readonly displayName: string | null;
  readonly initials: string | null;
  readonly rankProvided: boolean;
  readonly rank: string | null;
}

export async function updateProfile(db: Queryable, operatorId: string, profile: ProfileChange, now: number): Promise<boolean> {
  return changedOne(await db.query(UPDATE_PROFILE, [operatorId, profile.name, profile.displayName, profile.initials, profile.rankProvided, profile.rank, now]));
}

/** Open sessions of one operator, counted before a delete ends them. */
export const COUNT_OPEN_SESSIONS = 'SELECT count(*)::int AS n FROM public.auth_sessions WHERE operator_id = $1 AND ended_at IS NULL';

export async function countOpenSessions(db: Queryable, operatorId: string): Promise<number> {
  const { rows } = await db.query<{ n: number }>(COUNT_OPEN_SESSIONS, [operatorId]);
  return rows[0] === undefined ? 0 : Number(rows[0].n);
}

/** The delete, credential first: the order that keeps the FK of `operator_credentials` satisfiable. */
export const DELETE_CREDENTIAL = 'DELETE FROM public.operator_credentials WHERE operator_id = $1 RETURNING operator_id';

export async function deleteCredential(db: Queryable, operatorId: string): Promise<number> {
  return (await db.query(DELETE_CREDENTIAL, [operatorId])).rows.length;
}

/** The operator row itself. A foreign key still pointing here raises 23503, which the unit turns into 409. */
export const DELETE_OPERATOR = 'DELETE FROM public.operators WHERE id = $1 RETURNING id, username, role_id';

export interface DeletedOperator {
  readonly id: string;
  readonly username: string;
  readonly role: OperatorRole;
}

export async function deleteOperator(db: Queryable, operatorId: string): Promise<DeletedOperator | null> {
  const { rows } = await db.query<DeletedOperator>(DELETE_OPERATOR, [operatorId]);
  return rows[0] === undefined ? null : rows[0];
}

// ── The purge: the account goes together with the history that belongs to it ───────────────────

/**
 * The counts `audit_purge_operator` answers with. They are read back out of a `jsonb`, so they are
 * checked rather than trusted: a member that is missing or not a number fails the unit instead of
 * reporting an erasure of an unknown size.
 */
export interface PurgeCounts {
  readonly operatorId: string;
  readonly auditRows: number;
  readonly lineageRows: number;
  readonly signInRows: number;
  readonly biometricTokens: number;
  readonly credentialsRemoved: number;
  readonly pairingCodes: number;
  readonly activeSessions: number;
  /** The first sequence that disappeared, or null when the account never wrote a row. */
  readonly resealFromSeq: number | null;
}

export const PURGE_OPERATOR = 'SELECT public.audit_purge_operator($1, $2, $3) AS counts';

/**
 * What the purge is about to erase, counted the same way the function counts it, so the two answers
 * can be compared. Read before anything is touched: a unit that reports an erasure it did not
 * perform, or performs one it did not report, is a unit that should not commit.
 */
export const PURGE_FORECAST = `SELECT
  (SELECT count(*)::int FROM public.audit_log           WHERE actor_id = $1)     AS "auditRows",
  (SELECT count(*)::int FROM public.audit_chain_history WHERE actor_id = $1)     AS "lineageRows",
  (SELECT count(*)::int FROM public.auth_sessions       WHERE operator_id = $1)  AS "signInRows",
  (SELECT count(*)::int FROM public.biometric_tokens    WHERE operator_id = $1)  AS "biometricTokens",
  (SELECT count(*)::int FROM public.operator_credentials WHERE operator_id = $1) AS "credentialsRemoved",
  (SELECT count(*)::int FROM public.pairing_codes       WHERE issued_by_operator_id = $1) AS "pairingCodes",
  (SELECT count(*)::int FROM public.active_session      WHERE investigator_id = $1)       AS "activeSessions",
  (SELECT min(seq) FROM public.audit_log WHERE actor_id = $1)                             AS "resealFromSeq"`;

/** The same counts the purge function will answer with, taken before the erasure. */
export async function purgeForecast(db: Queryable, operatorId: string): Promise<PurgeCounts> {
  const { rows } = await db.query<PurgeCounts & QueryResultRow>(PURGE_FORECAST, [operatorId]);
  const row = rows[0];
  if (row === undefined) throw new CoreError('AUDIT_PURGE_ANSWER_INVALID', 'the purge forecast read nothing');
  return {
    auditRows: row.auditRows,
    lineageRows: row.lineageRows,
    signInRows: row.signInRows,
    biometricTokens: row.biometricTokens,
    credentialsRemoved: row.credentialsRemoved,
    pairingCodes: row.pairingCodes,
    activeSessions: row.activeSessions,
    operatorId,
    resealFromSeq: row.resealFromSeq === null ? null : Number(row.resealFromSeq),
  };
}

/** True when the two answers cover exactly the same erasure. */
export function samePurge(a: PurgeCounts, b: PurgeCounts): boolean {
  return a.auditRows === b.auditRows && a.lineageRows === b.lineageRows && a.signInRows === b.signInRows
    && a.biometricTokens === b.biometricTokens && a.credentialsRemoved === b.credentialsRemoved
    && a.pairingCodes === b.pairingCodes && a.activeSessions === b.activeSessions && a.resealFromSeq === b.resealFromSeq;
}

/** Erase the account and what belongs to it. Must be the last-but-one statement of its unit. */
export async function purgeOperator(db: Queryable, operatorId: string, actorId: string, reason: string): Promise<PurgeCounts> {
  const { rows } = await db.query<{ counts: unknown }>(PURGE_OPERATOR, [operatorId, actorId, reason]);
  const answer = rows[0]?.counts;
  if (typeof answer !== 'object' || answer === null) throw new CoreError('AUDIT_PURGE_ANSWER_INVALID', 'the purge function answered with something other than its counts');
  const given = answer as Record<string, unknown>;
  const count = (key: keyof PurgeCounts): number => {
    const value = given[key];
    if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) throw new CoreError('AUDIT_PURGE_ANSWER_INVALID', `the purge counts hold ${key} in a form that is not a count`);
    return value;
  };
  if (typeof given.operatorId !== 'string' || given.operatorId !== operatorId) throw new CoreError('AUDIT_PURGE_ANSWER_INVALID', 'the purge function names an operator other than the one this unit targeted');
  const from = given.resealFromSeq;
  if (from !== null && (typeof from !== 'number' || !Number.isInteger(from) || from < 1)) throw new CoreError('AUDIT_PURGE_ANSWER_INVALID', 'the purge counts hold no usable first removed sequence');
  return {
    operatorId,
    auditRows: count('auditRows'),
    lineageRows: count('lineageRows'),
    signInRows: count('signInRows'),
    biometricTokens: count('biometricTokens'),
    credentialsRemoved: count('credentialsRemoved'),
    pairingCodes: count('pairingCodes'),
    activeSessions: count('activeSessions'),
    resealFromSeq: (from ?? null) as number | null,
  };
}

/**
 * The surviving tail, ascending: every row that has to be sealed again because a row below it went.
 * The columns are aliased into the shared shape on purpose. `auditRowFromRow` expects a drizzle
 * result (camelCase, bigints already numbers); a plain `SELECT *` returns snake_case names, and the
 * multi-word members come out `undefined` — which silently changes both the canonical body and the
 * digest built from it. Measured the hard way: the seal was refused with "row 6 is not the row the
 * caller described".
 */
const AUDIT_TAIL_SQL = `SELECT seq, id, at, type, category, severity,
       actor_id AS "actorId", message, session_id AS "sessionId", evidence_id AS "evidenceId",
       device_id AS "deviceId", details, prev_hash AS "prevHash", hash
  FROM public.audit_log WHERE seq > $1 ORDER BY seq`;

/** A stored audit row in the shape the shared digest expects: numbers for bigints, null for absent. */
interface TailRow {
  seq: string | number;
  id: string;
  at: string | number;
  type: string;
  category: string;
  severity: string;
  actorId: string | null;
  message: string;
  sessionId: string | null;
  evidenceId: string | null;
  deviceId: string | null;
  details: unknown;
  prevHash: string;
  hash: string;
}

/**
 * The hashed part of a stored row, in the shape the shared digest expects. `auditBody` is not used
 * here because it takes a full `AuditRow` (with the two hash members); this builds exactly the body
 * it would have returned, from a row read with aliased columns. The casts are the database's text
 * columns meeting the vocabulary's members: the columns are CHECKed in SQL to hold those very values
 * (`audit_log_type_check`, `audit_log_category_check`, `audit_log_severity_check`), so this narrows
 * what was already constrained rather than trusting anything new.
 */
function auditBodyOfStored(row: TailRow): AuditEventBody {
  return {
    seq: Number(row.seq),
    id: row.id,
    at: Number(row.at),
    type: row.type as AuditEventBody['type'],
    category: row.category as AuditEventBody['category'],
    severity: row.severity as AuditEventBody['severity'],
    actorId: row.actorId ?? null,
    message: row.message,
    sessionId: row.sessionId ?? null,
    evidenceId: row.evidenceId ?? null,
    deviceId: row.deviceId ?? null,
    details: (row.details ?? {}) as AuditEventBody['details'],
  };
}

/** The row the surviving tail continues from, or the genesis hash when the tail starts the log. */
const CHAIN_ANCHOR_SQL = 'SELECT hash FROM public.audit_log WHERE seq < $1 ORDER BY seq DESC LIMIT 1';

export const RESEAL = 'SELECT public.audit_purge_reseal($1, $2::jsonb) AS seal';

export interface SealReport {
  readonly rows: number;
  readonly headSeq: number;
}

/**
 * Re-seal the chain above a purge: read the surviving rows with the SAME mapping boot check B-8
 * verifies them with (`auditRowFromRow`, so what is hashed here is what is checked later), step the
 * chain forward with the shared `chainHash`, and hand the result to the function that applies it.
 *
 * The function answers how many rows it sealed and where the head now is; anything other than the
 * whole tail and the last row of it fails the unit. This is the last statement a purge unit may run:
 * the unit's own audit head was read before the seal and cannot be trusted afterwards.
 */
export async function resealChain(db: Queryable, operatorId: string, resealFromSeq: number | null): Promise<SealReport> {
  let prev = GENESIS_HASH;
  if (resealFromSeq !== null) {
    const anchor = await db.query<{ hash: string }>(CHAIN_ANCHOR_SQL, [resealFromSeq]);
    prev = anchor.rows[0]?.hash ?? GENESIS_HASH;
  }
  const tail = resealFromSeq === null ? [] : (await db.query<TailRow>(AUDIT_TAIL_SQL, [resealFromSeq])).rows;
  const sealed: AuditRow[] = [];
  for (const stored of tail) {
    const body = auditBodyOfStored(stored);
    const prevHash = prev;
    const hash = chainHash(prevHash, body);
    sealed.push({ ...body, prevHash, hash } as AuditRow);
    prev = hash;
  }
  const { rows } = await db.query<{ seal: unknown }>(RESEAL, [operatorId, JSON.stringify(sealed)]);
  const answer = rows[0]?.seal;
  if (typeof answer !== 'object' || answer === null) throw new CoreError('AUDIT_RESEAL_ANSWER_INVALID', 'the re-seal function answered with something other than its report');
  const given = answer as Record<string, unknown>;
  if (typeof given.rows !== 'number' || given.rows !== sealed.length) throw new CoreError('AUDIT_RESEAL_ANSWER_INVALID', 'the re-seal sealed a different number of rows than the tail held');
  const headSeq = typeof given.headSeq === 'number' ? given.headSeq : Number(given.headSeq);
  // Fixed 2026-11-03: when nothing was sealed (an account that wrote no audit row), the function
  // answers the head AS IT STANDS — the caller is told where the chain ends, not at zero. The
  // equality against the last sealed row only binds when this unit actually sealed a tail.
  const last = sealed.length === 0 ? 0 : (sealed[sealed.length - 1] as AuditRow).seq;
  if (!Number.isFinite(headSeq) || (sealed.length > 0 && headSeq !== last)) throw new CoreError('AUDIT_RESEAL_ANSWER_INVALID', 'the chain head is not the last row this unit sealed');
  return { rows: given.rows, headSeq };
}

// ── Why a delete is refused, in numbers ────────────────────────────────────────────────────────

/**
 * Every reference that holds an operator in place: one row per source with a non-zero count, the
 * largest first. The sources are the 27 foreign keys that point at `public.operators` today minus
 * `operator_credentials`, whose own row this unit deletes first. A test compares this text against
 * `information_schema`, so a foreign key added later fails the suite instead of quietly answering
 * "no references" and letting the DELETE fail on the database's own terms.
 */
export const REFERENCED_BY = `
  SELECT source, n AS count FROM (
SELECT 'active_session' AS source, count(*)::int AS n FROM public.active_session WHERE created_by = $1
  UNION ALL
  SELECT 'active_session' AS source, count(*)::int AS n FROM public.active_session WHERE investigator_id = $1
  UNION ALL
  SELECT 'active_session' AS source, count(*)::int AS n FROM public.active_session WHERE started_by = $1
  UNION ALL
  SELECT 'active_session' AS source, count(*)::int AS n FROM public.active_session WHERE stopped_by = $1
  UNION ALL
  SELECT 'audit_chain_history' AS source, count(*)::int AS n FROM public.audit_chain_history WHERE actor_id = $1
  UNION ALL
  SELECT 'audit_log' AS source, count(*)::int AS n FROM public.audit_log WHERE actor_id = $1
  UNION ALL
  SELECT 'auth_sessions' AS source, count(*)::int AS n FROM public.auth_sessions WHERE operator_id = $1
  UNION ALL
  SELECT 'biometric_tokens' AS source, count(*)::int AS n FROM public.biometric_tokens WHERE operator_id = $1
  UNION ALL
  SELECT 'capture_audio_inputs' AS source, count(*)::int AS n FROM public.capture_audio_inputs WHERE updated_by = $1
  UNION ALL
  SELECT 'capture_config' AS source, count(*)::int AS n FROM public.capture_config WHERE updated_by = $1
  UNION ALL
  SELECT 'capture_devices' AS source, count(*)::int AS n FROM public.capture_devices WHERE retired_by = $1
  UNION ALL
  SELECT 'capture_network_config' AS source, count(*)::int AS n FROM public.capture_network_config WHERE updated_by = $1
  UNION ALL
  SELECT 'evidence_custody' AS source, count(*)::int AS n FROM public.evidence_custody WHERE actor_id = $1
  UNION ALL
  SELECT 'evidence_items' AS source, count(*)::int AS n FROM public.evidence_items WHERE investigator_id = $1
  UNION ALL
  SELECT 'exports' AS source, count(*)::int AS n FROM public.exports WHERE operator_id = $1
  UNION ALL
  SELECT 'host_network_aliases' AS source, count(*)::int AS n FROM public.host_network_aliases WHERE added_by = $1
  UNION ALL
  SELECT 'host_network_aliases' AS source, count(*)::int AS n FROM public.host_network_aliases WHERE removed_by = $1
  UNION ALL
  SELECT 'installation_acceptances' AS source, count(*)::int AS n FROM public.installation_acceptances WHERE accepted_by = $1
  UNION ALL
  SELECT 'installation_acceptances' AS source, count(*)::int AS n FROM public.installation_acceptances WHERE revoked_by = $1
  UNION ALL
  SELECT 'paired_devices' AS source, count(*)::int AS n FROM public.paired_devices WHERE revoked_by_operator_id = $1
  UNION ALL
  SELECT 'pairing_codes' AS source, count(*)::int AS n FROM public.pairing_codes WHERE closed_by_operator_id = $1
  UNION ALL
  SELECT 'pairing_codes' AS source, count(*)::int AS n FROM public.pairing_codes WHERE issued_by_operator_id = $1
  UNION ALL
  SELECT 'session_audio_intervals' AS source, count(*)::int AS n FROM public.session_audio_intervals WHERE switched_by = $1
  UNION ALL
  SELECT 'session_history' AS source, count(*)::int AS n FROM public.session_history WHERE investigator_id = $1
  UNION ALL
  SELECT 'stt_config' AS source, count(*)::int AS n FROM public.stt_config WHERE updated_by = $1
  UNION ALL
  SELECT 'transcript_revisions' AS source, count(*)::int AS n FROM public.transcript_revisions WHERE author_id = $1
  ) r WHERE n > 0 ORDER BY n DESC, source`;

export interface ReferenceCount extends QueryResultRow {
  source: string;
  count: number;
}

/** The references that block a delete, largest first. Empty when nothing holds the operator. */
export async function referencedBy(db: Queryable, operatorId: string): Promise<ReferenceCount[]> {
  return (await db.query<ReferenceCount>(REFERENCED_BY, [operatorId])).rows;
}

/** The total of all blocking references, for the sentence the refusal carries. */
export function referenceTotal(rows: readonly ReferenceCount[]): number {
  return rows.reduce((sum, row) => sum + row.count, 0);
}


