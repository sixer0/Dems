/**
 * The last-administrator rule (plan row W33; spec §4.6 RB-8; SR-47; AC-B-21, AC-B-79; edge case
 * E4): a role change or a disable is refused when it would leave no ENABLED operator whose role
 * holds user administration.
 *
 * This file is the arithmetic only, with no database and no request: the rows are those the unit
 * read under the lock (`LOCK_OPERATORS`), the roles are those the stored matrix gives the
 * permission, and the change is applied to the rows in memory before anything is written
 * (database contract §5.6 AT-C5: "the server applies the requested change to the locked rows and
 * counts"). The rule is about the state AFTER the change, whoever asks for it: an operator may
 * change the own role or disable the own account like any other, unless that leaves nobody.
 *
 * It is not an access check. Who may call the operations is the access rule of the registry,
 * applied by stage 6; this is a rule about the data the operations change.
 */
import { isVendorRoot, VENDOR_ROOT_USERNAME } from '@dems/shared/sim';
import { UNATTRIBUTED_OPERATOR_ID } from '@dems/shared/sim';
import type { OperatorRole } from '@dems/shared/sim';
import type { ActiveSessionParties, LockedOperator } from './statements';

// ── The system principals (DF-29, decision D20(d); D38 DR-4: defined here, once) ──────────────

/**
 * THE SYSTEM PRINCIPALS (DF-29, decision D20(d), 2026-11-05). `OPR-000` is the operator id the
 * auto-attach path acts as (`SYSTEM_OPERATOR_ID` of `capture-discovery/connect`, the same value as
 * the shared `UNATTRIBUTED_OPERATOR_ID`; the sequence of real operators starts at OPR-001). The D62
 * installer provisions its row as `system` WITHOUT a credential: "it can never sign in". A row is a
 * system principal by its reserved id OR by the reserved username (any case), so a row provisioned
 * under another id is held as well. The row itself is never touched: adoption needs it as its actor
 * key, and the audit rows it wrote (CAPTURE_CONNECTION_TESTED, CAPTURE_CANDIDATE_ADOPTED) stay.
 *
 * Two places refuse it, both through this one predicate (decision D38 DR-4, row 133): the host
 * command `operator:set-password` (no credential is ever written for it) and the units of this
 * module (no role change, no disable, no profile edit, no purge of it).
 */
export const SYSTEM_PRINCIPAL_OPERATOR_IDS: readonly string[] = Object.freeze([UNATTRIBUTED_OPERATOR_ID]);
export const SYSTEM_PRINCIPAL_USERNAMES: readonly string[] = Object.freeze(['system']);
export function isSystemPrincipal(operator: { readonly operatorId: string; readonly username: string }): boolean {
  return SYSTEM_PRINCIPAL_OPERATOR_IDS.includes(operator.operatorId) || SYSTEM_PRINCIPAL_USERNAMES.includes(operator.username.toLowerCase());
}

/**
 * The username of the vendor account that alone may create, edit or delete an operator (RB-9 as
 * amended by the principal, PT GSP, 02-11-2026). It is an identity, not a permission: the matrix
 * has no role that means "vendor", and a client's supervisor holds the very same USER_ADMIN that
 * root does. The check therefore reads the caller's own username, inside the unit, under the same
 * lock as the change. The identity itself lives in `@dems/shared/sim` (D55, 2026-11-03), because
 * the same username now also CARRIES a permission - re-exported here for the module's callers.
 */
export { VENDOR_ROOT_USERNAME, isVendorRoot };

/** What `assignUserRole` or `disableUser` is about to do to one operator. `enableUser` cannot take an administrator away. */
export type OperatorChange =
  | { readonly kind: 'ROLE'; readonly operatorId: string; readonly role: OperatorRole }
  | { readonly kind: 'DISABLE'; readonly operatorId: string }
  /** RB-9 as amended (02-11-2026): a delete takes the row away, so RB-8 counts the rows that stay. */
  | { readonly kind: 'DELETE'; readonly operatorId: string };

/** The operator rows as they would be once `change` is written. */
export function applyChange(operators: readonly LockedOperator[], change: OperatorChange): LockedOperator[] {
  if (change.kind === 'DELETE') return operators.filter((operator) => operator.id !== change.operatorId);
  return operators.map((operator) => {
    if (operator.id !== change.operatorId) return operator;
    return change.kind === 'ROLE' ? { ...operator, role: change.role } : { ...operator, enabled: false };
  });
}

/** The enabled operators whose role is one of `administratorRoles`, by ID. */
export function administratorsOf(operators: readonly LockedOperator[], administratorRoles: ReadonlySet<string>): string[] {
  return operators.filter((operator) => operator.enabled && administratorRoles.has(operator.role)).map((operator) => operator.id);
}

/** True when `change` would leave no enabled operator holding user administration (RB-8). */
export function leavesNoAdministrator(
  operators: readonly LockedOperator[],
  administratorRoles: ReadonlySet<string>,
  change: OperatorChange,
): boolean {
  return administratorsOf(applyChange(operators, change), administratorRoles).length === 0;
}

// ── Decision D43: no purge under the active session ────────────────────────────────────────────

/** How an operator takes part in the active session: the columns of `active_session` that name one. */
export type SessionPartyRole = 'INVESTIGATOR' | 'CREATED_BY' | 'STARTED_BY' | 'STOPPED_BY';

/**
 * The ways `operatorId` takes part in the active session, in column order; empty when it takes no
 * part or no session is active. A purge of a party is refused before anything is written (D43): the
 * purge would otherwise delete the session row under a running recording, or strip its attribution.
 * Any state counts, not only RECORDING: the row exists until the session is done with, and the
 * database guard of migration 0043 (SQLSTATE ZA007) applies the same rule.
 */
export function partyOfActiveSession(session: ActiveSessionParties | null, operatorId: string): SessionPartyRole[] {
  if (session === null) return [];
  const columns: ReadonlyArray<readonly [SessionPartyRole, string | null]> = [
    ['INVESTIGATOR', session.investigatorId],
    ['CREATED_BY', session.createdBy],
    ['STARTED_BY', session.startedBy],
    ['STOPPED_BY', session.stoppedBy],
  ];
  return columns.filter(([, id]) => id !== null && id === operatorId).map(([role]) => role);
}
