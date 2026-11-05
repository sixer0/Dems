// The last-administrator rule as arithmetic (plan row W33; spec §4.6 RB-8; SR-47; AC-B-21; edge
// case E4). No database and no app: the rows are given, the change is applied in memory, the
// enabled holders are counted. That the rows are the locked, committed ones is the database
// test's subject (`last-admin.db.test.ts`).
import { OperatorRole, Permission, ROLE_PERMISSIONS, UNATTRIBUTED_OPERATOR_ID } from '@dems/shared/sim';
import { describe, expect, it } from 'vitest';
import { administratorsOf, applyChange, isSystemPrincipal, leavesNoAdministrator, partyOfActiveSession, SYSTEM_PRINCIPAL_OPERATOR_IDS, SYSTEM_PRINCIPAL_USERNAMES, type OperatorChange } from '../rule';
import type { LockedOperator } from '../statements';

/** The roles that hold USER_ADMIN in the shared table: SUPERVISOR alone. */
const holds = (role: OperatorRole, permission: Permission): boolean => (ROLE_PERMISSIONS[role] as readonly Permission[]).includes(permission);
const ADMIN_ROLES: ReadonlySet<string> = new Set(Object.values(OperatorRole).filter((role) => holds(role, Permission.USER_ADMIN)));

const operator = (id: string, role: OperatorRole, enabled = true): LockedOperator => ({ id, username: `user.${id.toLowerCase()}`, role, enabled });

/** The seeded three. */
const SEEDED: readonly LockedOperator[] = [operator('OPR-001', 'INVESTIGATOR'), operator('OPR-002', 'SUPERVISOR'), operator('OPR-003', 'TECHNICIAN')];
/** Two enabled administrators and one disabled one. */
const TWO: readonly LockedOperator[] = [
  operator('OPR-001', 'SUPERVISOR'),
  operator('OPR-002', 'SUPERVISOR'),
  operator('OPR-003', 'TECHNICIAN'),
  operator('OPR-004', 'SUPERVISOR', false),
];

const role = (operatorId: string, to: OperatorRole): OperatorChange => ({ kind: 'ROLE', operatorId, role: to });
const disable = (operatorId: string): OperatorChange => ({ kind: 'DISABLE', operatorId });

describe('the roles of the rule', () => {
  it('in the shared table exactly one role holds USER_ADMIN: SUPERVISOR', () => {
    expect([...ADMIN_ROLES]).toEqual(['SUPERVISOR']);
  });
});

describe('administratorsOf: the enabled operators whose role holds the permission', () => {
  it('counts an enabled SUPERVISOR and nobody else', () => {
    expect(administratorsOf(SEEDED, ADMIN_ROLES)).toEqual(['OPR-002']);
    expect(administratorsOf(TWO, ADMIN_ROLES)).toEqual(['OPR-001', 'OPR-002']);
  });

  it('a disabled SUPERVISOR is no administrator; an enabled operator of another role is none either', () => {
    expect(administratorsOf([operator('OPR-001', 'SUPERVISOR', false)], ADMIN_ROLES)).toEqual([]);
    expect(administratorsOf([operator('OPR-001', 'TECHNICIAN'), operator('OPR-002', 'INVESTIGATOR')], ADMIN_ROLES)).toEqual([]);
  });

  it('follows the stored matrix, not a role name: a matrix that gives the permission to another role counts that role', () => {
    expect(administratorsOf(SEEDED, new Set(['TECHNICIAN']))).toEqual(['OPR-003']);
    expect(administratorsOf(SEEDED, new Set(['TECHNICIAN', 'SUPERVISOR']))).toEqual(['OPR-002', 'OPR-003']);
    expect(administratorsOf(SEEDED, new Set())).toEqual([]);
  });
});

describe('applyChange: the rows as they would be once the change is written', () => {
  it('a role change touches the role of the one operator and nothing else', () => {
    expect(applyChange(SEEDED, role('OPR-003', 'SUPERVISOR'))).toEqual([SEEDED[0], SEEDED[1], operator('OPR-003', 'SUPERVISOR')]);
  });

  it('a disable touches the flag of the one operator and nothing else', () => {
    expect(applyChange(SEEDED, disable('OPR-002'))).toEqual([SEEDED[0], operator('OPR-002', 'SUPERVISOR', false), SEEDED[2]]);
  });

  it('leaves the rows it was given as they are, and changes nothing for an ID that no row has', () => {
    const before = structuredClone(SEEDED);
    applyChange(SEEDED, disable('OPR-002'));
    applyChange(SEEDED, role('OPR-002', 'TECHNICIAN'));
    expect(SEEDED).toEqual(before);
    expect(applyChange(SEEDED, disable('OPR-999'))).toEqual(SEEDED);
  });
});

describe('leavesNoAdministrator (RB-8)', () => {
  it('AC-B-21: demoting or disabling the only enabled SUPERVISOR is refused, to either other role', () => {
    expect(leavesNoAdministrator(SEEDED, ADMIN_ROLES, role('OPR-002', 'INVESTIGATOR'))).toBe(true);
    expect(leavesNoAdministrator(SEEDED, ADMIN_ROLES, role('OPR-002', 'TECHNICIAN'))).toBe(true);
    expect(leavesNoAdministrator(SEEDED, ADMIN_ROLES, disable('OPR-002'))).toBe(true);
  });

  it('a change of somebody else is not refused while an administrator stays', () => {
    expect(leavesNoAdministrator(SEEDED, ADMIN_ROLES, role('OPR-003', 'INVESTIGATOR'))).toBe(false);
    expect(leavesNoAdministrator(SEEDED, ADMIN_ROLES, role('OPR-001', 'SUPERVISOR'))).toBe(false);
    expect(leavesNoAdministrator(SEEDED, ADMIN_ROLES, disable('OPR-001'))).toBe(false);
  });

  it('with two enabled administrators either one may go, by a role change or by a disable', () => {
    for (const id of ['OPR-001', 'OPR-002']) {
      expect(leavesNoAdministrator(TWO, ADMIN_ROLES, role(id, 'INVESTIGATOR'))).toBe(false);
      expect(leavesNoAdministrator(TWO, ADMIN_ROLES, disable(id))).toBe(false);
    }
  });

  it('a disabled SUPERVISOR does not count: with it as the only other holder, the enabled one may not go', () => {
    const rows = [operator('OPR-002', 'SUPERVISOR'), operator('OPR-004', 'SUPERVISOR', false)];
    expect(leavesNoAdministrator(rows, ADMIN_ROLES, role('OPR-002', 'TECHNICIAN'))).toBe(true);
    expect(leavesNoAdministrator(rows, ADMIN_ROLES, disable('OPR-002'))).toBe(true);
    // Demoting the disabled one takes nobody away.
    expect(leavesNoAdministrator(rows, ADMIN_ROLES, role('OPR-004', 'TECHNICIAN'))).toBe(false);
  });

  it('AC-B-79 as arithmetic: after the first of two demotions is in the rows, the second is refused', () => {
    const afterFirst = applyChange(TWO, role('OPR-001', 'INVESTIGATOR'));
    expect(leavesNoAdministrator(afterFirst, ADMIN_ROLES, role('OPR-002', 'INVESTIGATOR'))).toBe(true);
    expect(leavesNoAdministrator(afterFirst, ADMIN_ROLES, disable('OPR-002'))).toBe(true);
    // Decided on the rows BEFORE the first one, both would pass: why the check needs the lock.
    expect(leavesNoAdministrator(TWO, ADMIN_ROLES, role('OPR-002', 'INVESTIGATOR'))).toBe(false);
  });

  it('is about the state after the change: a change that leaves nobody is refused also when nobody was left before', () => {
    const none = [operator('OPR-001', 'INVESTIGATOR'), operator('OPR-003', 'TECHNICIAN')];
    expect(leavesNoAdministrator(none, ADMIN_ROLES, role('OPR-001', 'TECHNICIAN'))).toBe(true);
    // The one change that is let through there is the one that makes an administrator.
    expect(leavesNoAdministrator(none, ADMIN_ROLES, role('OPR-001', 'SUPERVISOR'))).toBe(false);
  });

  it('a self-change is a change like any other: the caller is not part of the arithmetic', () => {
    // The functions take no actor at all.
    expect(leavesNoAdministrator.length).toBe(3);
    expect(leavesNoAdministrator(TWO, ADMIN_ROLES, disable('OPR-002'))).toBe(false);
  });
});

// Decision D43 (row 95): a purge whose target takes part in the active session is refused before
// any write. The rule is arithmetic on the one row of `active_session`; the refusal itself and its
// place before the first write are `vendor-root.test.ts` and the static test of this folder.
describe('D43: a party of the active session', () => {
  const session = { sessionId: 'SES-20261105-0001', investigatorId: 'OPR-003', createdBy: 'OPR-004', startedBy: 'OPR-005', stoppedBy: null };

  it('names every column that holds the operator, in column order', () => {
    expect(partyOfActiveSession(session, 'OPR-003')).toEqual(['INVESTIGATOR']);
    expect(partyOfActiveSession(session, 'OPR-004')).toEqual(['CREATED_BY']);
    expect(partyOfActiveSession(session, 'OPR-005')).toEqual(['STARTED_BY']);
    expect(partyOfActiveSession({ ...session, stoppedBy: 'OPR-003', createdBy: 'OPR-003' }, 'OPR-003')).toEqual(['INVESTIGATOR', 'CREATED_BY', 'STOPPED_BY']);
  });

  it('is empty for an operator the session does not name, and when no session is active', () => {
    expect(partyOfActiveSession(session, 'OPR-006')).toEqual([]);
    expect(partyOfActiveSession(null, 'OPR-003')).toEqual([]);
    // An empty column never matches anything.
    expect(partyOfActiveSession({ ...session, createdBy: null, startedBy: null }, 'OPR-004')).toEqual([]);
  });
});

describe('DF-29 / D20(d): the system principals, defined here once (decision D38 DR-4, row 133)', () => {
  it('the reserved id is the shared UNATTRIBUTED_OPERATOR_ID (OPR-000, the auto-attach actor); the reserved username is `system`; both lists are frozen', () => {
    expect(UNATTRIBUTED_OPERATOR_ID).toBe('OPR-000');
    expect(SYSTEM_PRINCIPAL_OPERATOR_IDS).toEqual([UNATTRIBUTED_OPERATOR_ID]);
    expect(SYSTEM_PRINCIPAL_USERNAMES).toEqual(['system']);
    expect(Object.isFrozen(SYSTEM_PRINCIPAL_OPERATOR_IDS)).toBe(true);
    expect(Object.isFrozen(SYSTEM_PRINCIPAL_USERNAMES)).toBe(true);
  });

  it('a row is a system principal by the reserved id OR the reserved username in any case; real operators and look-alikes are not', () => {
    expect(isSystemPrincipal({ operatorId: 'OPR-000', username: 'system' })).toBe(true);
    expect(isSystemPrincipal({ operatorId: 'OPR-000', username: 'anything' })).toBe(true);
    expect(isSystemPrincipal({ operatorId: 'OPR-123', username: 'SYSTEM' })).toBe(true);
    expect(isSystemPrincipal({ operatorId: 'OPR-001', username: 'root' })).toBe(false);
    expect(isSystemPrincipal({ operatorId: 'OPR-0001', username: 'systemd' })).toBe(false);
    expect(isSystemPrincipal({ operatorId: 'OPR-002', username: '' })).toBe(false);
  });
});
