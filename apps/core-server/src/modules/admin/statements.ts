/**
 * The statements of the administration module (plan row W33; database contract §4.3 to §4.6,
 * §4.10, §5.6 AT-3 and AT-C5, §7.3; spec §4.6 RB-8, §4.7, §7.6; SR-12, SR-47, SR-67, SR-72).
 *
 * Every statement is a constant text with bind parameters; no value is ever part of a statement
 * text (SR-67). A function takes the connection to run on: the pool for the one read of
 * `listUsers`, the unit of work for a change. Every table is named with its schema.
 *
 * WHAT THE RUNTIME ROLE MAY DO HERE (database contract §7.3): SELECT on every table named below;
 * UPDATE on `operators (role_id, enabled, role_changed_at, updated_at)`. It has no INSERT and no
 * DELETE on `operators`: no operation creates or deletes a user. A column-level UPDATE grant is
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
import type { OperatorRole, Permission } from '@dems/shared/sim';
import type { QueryResultRow } from 'pg';

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
