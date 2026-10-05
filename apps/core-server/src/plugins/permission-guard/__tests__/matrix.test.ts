// The check of the stored matrix (plan row W28; spec §4.3, §4.4, §4.6 RB-7; decision D88). Pure:
// no app, no database. The same check against PostgreSQL, at boot and at a reload, is in
// `src/modules/rbac/__tests__/matrix.db.test.ts`.
import { OperatorRole, Permission, ROLE_PERMISSIONS } from '@dems/shared/sim';
import { describe, expect, it } from 'vitest';
import {
  AccessRuleErrorCode,
  checkStoredMatrix,
  createRuleBook,
  firstGrantDifference,
  isAccessRule,
  roleMatrixOf,
  type AccessRule,
  type StoredGrant,
  type StoredMatrix,
} from '../index';

const ROLES = Object.values(OperatorRole);
const PERMISSIONS = Object.values(Permission);

/** The grants of the shared role table, as the stored matrix orders them: by role, then by permission. */
const SHARED_GRANTS: StoredGrant[] = ROLES.flatMap((role) =>
  PERMISSIONS.filter((permission) => (ROLE_PERMISSIONS[role] as readonly Permission[]).includes(permission)).map((permission) => ({ role, permission })),
);

const matrix = (change: Partial<StoredMatrix> = {}): StoredMatrix => ({ roles: ROLES, permissions: PERMISSIONS, grants: SHARED_GRANTS, ...change });
const without = (role: string, permission: string): StoredGrant[] => SHARED_GRANTS.filter((grant) => !(grant.role === role && grant.permission === permission));

const book = createRuleBook();
const RULES: AccessRule[] = book.operationIds.map((operationId) => book.ruleOf(operationId)).filter(isAccessRule);

describe('the stored matrix that passes', () => {
  it('is the shared vocabulary with exactly the 18 grants of the shared role table, for the rules of all 75 operations', () => {
    expect(SHARED_GRANTS).toHaveLength(18);
    expect(RULES).toHaveLength(75);
    expect(checkStoredMatrix(matrix(), RULES)).toEqual([]);
    expect(firstGrantDifference(SHARED_GRANTS)).toBeNull();
  });

  it('whatever the order the grants are stored in', () => {
    expect(firstGrantDifference([...SHARED_GRANTS].reverse())).toBeNull();
    expect(checkStoredMatrix(matrix({ grants: [...SHARED_GRANTS].reverse() }), RULES)).toEqual([]);
  });
});

describe('decision D88: the stored grants must be exactly the shared role table', () => {
  it('a stored grant the shared table lacks: STORED_GRANTS_MISMATCH, naming the direction, the role and the permission, and nothing else', () => {
    const problems = checkStoredMatrix(matrix({ grants: [...SHARED_GRANTS, { role: 'INVESTIGATOR', permission: 'MAINTENANCE' }] }), RULES);
    expect(problems).toEqual([{ code: AccessRuleErrorCode.STORED_GRANTS_MISMATCH, operationId: null, route: null, detail: 'extra grant: INVESTIGATOR MAINTENANCE' }]);
  });

  it('a grant of the shared table that is not stored: the same code, direction missing', () => {
    const problems = checkStoredMatrix(matrix({ grants: without('TECHNICIAN', 'MAINTENANCE') }), RULES);
    expect(problems).toEqual([{ code: AccessRuleErrorCode.STORED_GRANTS_MISMATCH, operationId: null, route: null, detail: 'missing grant: TECHNICIAN MAINTENANCE' }]);
  });

  it('only the FIRST difference is named: a missing grant before an extra one, by role and then by permission in the order of the vocabulary', () => {
    expect(firstGrantDifference(without('SUPERVISOR', 'USER_ADMIN').filter((grant) => grant.role !== 'TECHNICIAN'))).toEqual({
      direction: 'missing',
      role: 'SUPERVISOR',
      permission: 'USER_ADMIN',
    });
    expect(firstGrantDifference([{ role: 'TECHNICIAN', permission: 'USER_ADMIN' }, ...without('INVESTIGATOR', 'SESSION_NOTE')])).toEqual({
      direction: 'missing',
      role: 'INVESTIGATOR',
      permission: 'SESSION_NOTE',
    });
    expect(firstGrantDifference([...SHARED_GRANTS, { role: 'TECHNICIAN', permission: 'USER_ADMIN' }, { role: 'INVESTIGATOR', permission: 'DEMO_CONTROL' }])).toEqual({
      direction: 'extra',
      role: 'TECHNICIAN',
      permission: 'USER_ADMIN',
    });
    expect(firstGrantDifference([])).toEqual({ direction: 'missing', role: 'INVESTIGATOR', permission: 'SESSION_START' });
    // One problem, however many grants differ.
    expect(checkStoredMatrix(matrix({ grants: [] }), RULES)).toHaveLength(1);
  });

  it('every single grant of the shared table is needed, and every single other pair is refused', () => {
    for (const grant of SHARED_GRANTS) {
      expect(firstGrantDifference(without(grant.role, grant.permission))).toEqual({ direction: 'missing', ...grant });
    }
    let extras = 0;
    for (const role of ROLES) {
      for (const permission of PERMISSIONS) {
        if ((ROLE_PERMISSIONS[role] as readonly Permission[]).includes(permission)) continue;
        extras += 1;
        expect(firstGrantDifference([...SHARED_GRANTS, { role, permission }])).toEqual({ direction: 'extra', role, permission });
      }
    }
    expect(extras).toBe(3 * 12 - 18);
  });

  it('a grant of a role or a permission the vocabulary does not hold is an extra one', () => {
    expect(firstGrantDifference([...SHARED_GRANTS, { role: 'AUDITOR', permission: 'EVIDENCE_VIEW' }])).toEqual({ direction: 'extra', role: 'AUDITOR', permission: 'EVIDENCE_VIEW' });
    expect(firstGrantDifference([...SHARED_GRANTS, { role: 'SUPERVISOR', permission: 'WARP_DRIVE' }])).toEqual({ direction: 'extra', role: 'SUPERVISOR', permission: 'WARP_DRIVE' });
    // Nor a name that every object answers to: the role is looked up among the table's OWN members.
    for (const role of ['constructor', 'toString', '__proto__', 'hasOwnProperty']) {
      expect(firstGrantDifference([...SHARED_GRANTS, { role, permission: 'EVIDENCE_VIEW' }])).toEqual({ direction: 'extra', role, permission: 'EVIDENCE_VIEW' });
    }
  });

  it('the grants are compared only once the vocabulary is the shared one: a missing permission or role is the cause, and is what is reported', () => {
    const noDemo = matrix({ permissions: PERMISSIONS.filter((permission) => permission !== 'DEMO_CONTROL'), grants: without('SUPERVISOR', 'DEMO_CONTROL') });
    const problems = checkStoredMatrix(noDemo, []);
    expect(problems.map((problem) => [problem.code, problem.detail])).toEqual([[AccessRuleErrorCode.STORED_MATRIX_MISMATCH, 'permissions not stored: DEMO_CONTROL']]);
    const noRole = matrix({ roles: ['INVESTIGATOR', 'SUPERVISOR'], grants: SHARED_GRANTS.filter((grant) => grant.role !== 'TECHNICIAN') });
    expect(checkStoredMatrix(noRole, []).map((problem) => [problem.code, problem.detail])).toEqual([[AccessRuleErrorCode.STORED_MATRIX_MISMATCH, 'roles not stored: TECHNICIAN']]);
  });
});

describe('the other two checks, as before', () => {
  it('a permission that the rule of a route names is not stored: one problem per route and permission, naming the operation, then the mismatch', () => {
    const users = RULES.filter((rule) => rule.permissions.includes(Permission.USER_ADMIN));
    const stored = matrix({ permissions: PERMISSIONS.filter((permission) => permission !== 'USER_ADMIN'), grants: without('SUPERVISOR', 'USER_ADMIN') });
    const problems = checkStoredMatrix(stored, users);
    expect(problems.map((problem) => [problem.code, problem.operationId])).toEqual([
      ...users.map((rule) => [AccessRuleErrorCode.PERMISSION_NOT_STORED, rule.operationId]),
      [AccessRuleErrorCode.STORED_MATRIX_MISMATCH, null],
    ]);
    expect(users.map((rule) => rule.operationId)).toEqual(['listUsers', 'assignUserRole', 'enableUser', 'disableUser']);
  });

  it('a stored name the server does not know, and an empty matrix', () => {
    expect(checkStoredMatrix(matrix({ permissions: [...PERMISSIONS, 'WARP_DRIVE'] }), []).map((problem) => problem.detail)).toEqual([
      'permissions stored and unknown to the server: WARP_DRIVE',
    ]);
    expect(checkStoredMatrix({ roles: [], permissions: [], grants: [] }, []).map((problem) => problem.code)).toEqual([
      AccessRuleErrorCode.STORED_MATRIX_MISMATCH,
      AccessRuleErrorCode.STORED_MATRIX_MISMATCH,
    ]);
  });

  it('roleMatrixOf hands the stored lists on in their order, with editable false', () => {
    expect(roleMatrixOf(matrix())).toEqual({ roles: ROLES, permissions: PERMISSIONS, grants: SHARED_GRANTS, editable: false });
  });
});
