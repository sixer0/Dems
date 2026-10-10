// The access rules compiled from the contract registry (plan row W28; spec §4.2, §4.6 RB-1 and
// RB-5, §6.6, §7.1 API-8; SR-43; decision D64 DN-12). Pure: no app, no database.
import {
  CORE_API_OPERATIONS,
  CoreApiAccessCondition,
  CoreApiAccessKind,
  CoreApiAuditNone,
  WS_PATH,
  type CoreApiOperation,
} from '@dems/shared/api';
import { AuditType, Permission } from '@dems/shared/sim';
import { describe, expect, it } from 'vitest';
import { detailRulesOf } from '../../../core';
import {
  ANY_OF_SEPARATOR,
  AccessRuleError,
  AccessRuleErrorCode,
  EVIDENCE_MEDIA_ROUTE_URL,
  EVIDENCE_MEDIA_SESSION_OPERATION,
  EVIDENCE_MEDIA_STREAM_ID,
  EXPORT_DENIALS,
  FORBIDDEN_OPERATION,
  REALTIME_CHANNEL_ID,
  REALTIME_CHANNEL_RULE,
  RETIRED_DEVICE_OPERATIONS,
  compileAccessRule,
  createRuleBook,
  denialPermissionCode,
  isAccessRule,
  permissionsOfDenialCode,
  routeOfOperation,
  routePatternOf,
  type AccessRule,
  type AccessRuleProblem,
} from '../index';
import { operationOf } from '../../../../test/support/guard';

const book = createRuleBook();
const rules = book.operationIds.map((operationId) => book.ruleOf(operationId));
const compiled = rules.filter(isAccessRule);

function ruleOf(operationId: string): AccessRule {
  const resolved = book.ruleOf(operationId);
  if (!isAccessRule(resolved)) throw new Error(`${operationId} has no rule: ${resolved.code}`);
  return resolved;
}

function problemOf(resolved: AccessRule | AccessRuleProblem): AccessRuleProblem {
  if (isAccessRule(resolved)) throw new Error(`a rule was compiled for ${resolved.operationId}`);
  return resolved;
}

/** A registry entry with some members replaced or removed, as a careless edit would leave it. */
function entry(operationId: string, change: Record<string, unknown>): CoreApiOperation {
  return { ...operationOf(operationId), ...change } as CoreApiOperation;
}

describe('the rule book of the contract registry', () => {
  it('compiles a rule for every one of the 97 operations: none lacks an access rule or an audit rule', () => {
    // C3 §2.5 (blueprint row 113): 89 + the STT configuration operations 90-92 = 92.
    // C3 §2.6, §10.1 (blueprint row 132, decision D106): + the camera-search operations 93-97 = 97.
    expect(book.operationIds).toHaveLength(97);
    expect(rules.filter((rule) => !isAccessRule(rule))).toEqual([]);
    expect(new Set(compiled.map((rule) => rule.operationId)).size).toBe(97);
  });

  it('holds 4 PUBLIC, 5 DEVICE, 30 AUTHENTICATED, 57 with one permission and 1 any-of (spec §7, D13; C3 §2.5, §2.6)', () => {
    const count = (kind: string): number => compiled.filter((rule) => rule.kind === kind).length;
    expect({
      PUBLIC: count(CoreApiAccessKind.PUBLIC),
      DEVICE: count(CoreApiAccessKind.DEVICE),
      AUTHENTICATED: count(CoreApiAccessKind.AUTHENTICATED),
      PERMISSION: count(CoreApiAccessKind.PERMISSION),
      ANY_OF: count(CoreApiAccessKind.ANY_OF),
    }).toEqual({ PUBLIC: 4, DEVICE: 5, AUTHENTICATED: 30, PERMISSION: 57, ANY_OF: 1 });
  });

  it('takes method, path, permissions and conditions from the registry entry, and nothing from anywhere else', () => {
    for (const operation of CORE_API_OPERATIONS) {
      const rule = ruleOf(operation.operationId);
      expect(rule.method).toBe(operation.method.toUpperCase());
      expect(rule.url).toBe(operation.path.replace('{id}', ':id'));
      expect(rule.kind).toBe(operation.access.kind);
      expect(rule.conditions).toEqual(operation.access.conditions ?? []);
      const named =
        operation.access.kind === CoreApiAccessKind.PERMISSION
          ? [operation.access.permission]
          : operation.access.kind === CoreApiAccessKind.ANY_OF
            ? [...operation.access.permissions]
            : [];
      expect(rule.permissions).toEqual(named);
      expect(rule.denial === null).toBe(named.length === 0);
      expect(rule.denial?.auditType ?? AuditType.ACCESS_DENIED).toBe(operation.audit.denial);
    }
  });

  it('the conditions are those of the registry, in its order: CONSOLE_IDENTITY on signIn, DEVICE_SESSION on setBiometricEnrollment, DEVICE_CREDENTIAL on rotateDeviceCredential, DEMO_FLAG on the five demo operations', () => {
    const conditioned = compiled.filter((rule) => rule.conditions.length > 0).map((rule) => [rule.operationId, ...rule.conditions]);
    // The registry is the one source: a rule carries exactly the conditions of its entry, in the registry's order.
    expect(conditioned).toEqual(
      CORE_API_OPERATIONS.filter((operation) => (operation.access.conditions ?? []).length > 0).map((operation) => [operation.operationId, ...(operation.access.conditions ?? [])]),
    );
    // Finding CPS1-3, decision D113: operation 23 needs the device's own credential, and it stands
    // between setBiometricEnrollment and the demo operations. Decision D118 puts the same condition
    // on another DEVICE operation in a later step, so the holders of THIS condition are asked for
    // by name and by their marker, not as a closed list (the registry's own test closes it).
    const order = conditioned.map(([operationId]) => operationId);
    expect(order.indexOf('setBiometricEnrollment')).toBeLessThan(order.indexOf('rotateDeviceCredential'));
    expect(order.indexOf('rotateDeviceCredential')).toBeLessThan(order.indexOf('getDemoStatus'));
    const ownCredential = conditioned.filter(([, condition]) => condition === CoreApiAccessCondition.DEVICE_CREDENTIAL);
    expect(ownCredential).toContainEqual(['rotateDeviceCredential', CoreApiAccessCondition.DEVICE_CREDENTIAL]);
    for (const [operationId] of ownCredential) expect(ruleOf(operationId ?? '').kind, operationId).toBe(CoreApiAccessKind.DEVICE);
    expect(conditioned.filter(([, condition]) => condition !== CoreApiAccessCondition.DEVICE_CREDENTIAL)).toEqual([
      ['signIn', CoreApiAccessCondition.CONSOLE_IDENTITY],
      ['setBiometricEnrollment', CoreApiAccessCondition.DEVICE_SESSION],
      ['getDemoStatus', CoreApiAccessCondition.DEMO_FLAG],
      ['loadScenario', CoreApiAccessCondition.DEMO_FLAG],
      ['injectFault', CoreApiAccessCondition.DEMO_FLAG],
      ['clearFault', CoreApiAccessCondition.DEMO_FLAG],
      ['resetDemo', CoreApiAccessCondition.DEMO_FLAG],
      ['switchAudioSource', CoreApiAccessCondition.SESSION_HOLDER],
      // Task 3 R-9 (blueprint row 132, D106; C3 §0, §3.1): web console only, in registry order.
      ['setCaptureDeviceCredential', CoreApiAccessCondition.WEB_CONSOLE_SESSION],
      ['testCaptureCandidateConnection', CoreApiAccessCondition.WEB_CONSOLE_SESSION],
      ['adoptCaptureCandidate', CoreApiAccessCondition.WEB_CONSOLE_SESSION],
    ]);
  });

  it('RB-5: the three exports are refused with EXPORT_DENIED, exportEvidence alone with the code FORBIDDEN', () => {
    const exports = compiled.filter((rule) => rule.denial?.auditType === AuditType.EXPORT_DENIED);
    expect(exports.map((rule) => rule.operationId).sort()).toEqual(Object.keys(EXPORT_DENIALS).sort());
    expect(exports.map((rule) => [rule.operationId, rule.denial?.errorCode, rule.denial?.export?.scope ?? null])).toEqual([
      ['exportEvidence', 'FORBIDDEN', null],
      ['exportAudit', 'NOT_PERMITTED', 'AUDIT'],
      ['exportLogs', 'NOT_PERMITTED', 'LOGS'],
    ]);
    expect(compiled.filter((rule) => rule.denial?.errorCode === 'FORBIDDEN').map((rule) => rule.operationId)).toEqual([FORBIDDEN_OPERATION]);
    // Every other rule with a permission writes ACCESS_DENIED and has no export shape.
    for (const rule of compiled) {
      if (rule.denial === null || rule.denial.auditType === AuditType.EXPORT_DENIED) continue;
      expect(rule.denial).toMatchObject({ auditType: AuditType.ACCESS_DENIED, errorCode: 'NOT_PERMITTED', export: null });
    }
  });

  it('only exportEvidence carries the pattern of its path ID into the rule that writes a row with it', () => {
    expect(ruleOf('exportEvidence').idPattern?.test('EV-20261001-0001')).toBe(true);
    expect(ruleOf('exportEvidence').idPattern?.test('EV-1')).toBe(false);
    expect(ruleOf('exportAudit').idPattern).toBeNull();
  });
});

describe('spec §6.6: what a retired device may still call', () => {
  it('is health and the pairing redeem, both PUBLIC; every other operation refuses it', () => {
    expect([...RETIRED_DEVICE_OPERATIONS]).toEqual(['getServiceHealth', 'redeemPairingCode']);
    const open = compiled.filter((rule) => !rule.refusesRetiredDevice).map((rule) => rule.operationId);
    expect(open.sort()).toEqual([...RETIRED_DEVICE_OPERATIONS].sort());
    for (const operationId of open) expect(ruleOf(operationId).kind).toBe(CoreApiAccessKind.PUBLIC);
    // Decision D78 DN-9: the two other PUBLIC operations refuse it.
    expect(ruleOf('signIn').refusesRetiredDevice).toBe(true);
    expect(ruleOf('getSignInStatus').refusesRetiredDevice).toBe(true);
  });

  it('agrees with the contract: a PUBLIC operation documents 403 DEVICE_REVOKED exactly when its rule refuses a retired device', () => {
    const publicOperations: string[] = [];
    for (const operation of CORE_API_OPERATIONS) {
      const refuses = ruleOf(operation.operationId).refusesRetiredDevice;
      if (operation.access.kind !== CoreApiAccessKind.PUBLIC) {
        // Whatever needs a device, a session or a permission refuses a retired device.
        expect([operation.operationId, refuses]).toEqual([operation.operationId, true]);
        continue;
      }
      publicOperations.push(operation.operationId);
      const documented = operation.responses[403]?.description.includes('DEVICE_REVOKED') ?? false;
      expect([operation.operationId, refuses]).toEqual([operation.operationId, documented]);
    }
    expect(publicOperations).toEqual(['getServiceHealth', 'signIn', 'getSignInStatus', 'redeemPairingCode']);
  });
});

describe('details.permission of a denial (decision D64 DN-12, ruled here)', () => {
  it('is the permission of the rule; for the any-of its alternatives in registry order joined with _OR_', () => {
    expect(ruleOf('startSession').denial?.permission).toBe('SESSION_START');
    expect(ruleOf('setStoragePolicy').permissions).toEqual([Permission.EVIDENCE_REVIEW, Permission.MAINTENANCE]);
    expect(ruleOf('setStoragePolicy').denial?.permission).toBe('EVIDENCE_REVIEW_OR_MAINTENANCE');
    expect(denialPermissionCode(['A', 'B', 'C'])).toBe('A_OR_B_OR_C');
  });

  it('splits back into the permissions: no permission of the vocabulary holds the separator', () => {
    expect(ANY_OF_SEPARATOR).toBe('_OR_');
    expect(Object.values(Permission).filter((permission) => permission.includes(ANY_OF_SEPARATOR))).toEqual([]);
    expect(permissionsOfDenialCode('EVIDENCE_REVIEW_OR_MAINTENANCE')).toEqual(['EVIDENCE_REVIEW', 'MAINTENANCE']);
    for (const rule of compiled) {
      if (rule.denial !== null) expect(permissionsOfDenialCode(rule.denial.permission)).toEqual(rule.permissions);
    }
  });

  it('is a value the audit writer accepts for ACCESS_DENIED, for every rule; the marker ANY-OF(A, B) is not', () => {
    const accepted = detailRulesOf(AuditType.ACCESS_DENIED)?.['permission'];
    expect(accepted).toBeDefined();
    for (const rule of compiled) {
      if (rule.denial !== null) expect([rule.operationId, accepted?.accepts(rule.denial.permission)]).toEqual([rule.operationId, true]);
    }
    expect(accepted?.accepts(ruleOf('setStoragePolicy').marker)).toBe(false);
    expect(ruleOf('setStoragePolicy').marker).toBe('ANY-OF(EVIDENCE_REVIEW, MAINTENANCE)');
  });
});

describe('which route gets which rule (RB-1: deny by default)', () => {
  it('a route that is a registry operation by method, path and operation ID gets that operation rule', () => {
    for (const operation of CORE_API_OPERATIONS) {
      const route = routeOfOperation(operation);
      const resolved = book.resolve({ method: route.method, url: route.url, operationId: route.config.operationId });
      expect(isAccessRule(resolved) && resolved.operationId).toBe(operation.operationId);
    }
  });

  it('the method is matched whatever its letter case; the path is matched exactly', () => {
    expect(isAccessRule(book.resolve({ method: 'get', url: '/api/v1/health', operationId: 'getServiceHealth' }))).toBe(true);
    expect(problemOf(book.resolve({ method: 'GET', url: '/api/v1/health/', operationId: 'getServiceHealth' })).code).toBe(
      AccessRuleErrorCode.ROUTE_NOT_THE_OPERATION,
    );
    expect(problemOf(book.resolve({ method: 'GET', url: '/API/V1/HEALTH', operationId: undefined })).code).toBe(AccessRuleErrorCode.ROUTE_WITHOUT_RULES);
  });

  it('a route that is no registry operation has no rule, whatever it says about itself', () => {
    for (const operationId of [undefined, 'scratchRead', 'anything']) {
      const problem = problemOf(book.resolve({ method: 'GET', url: '/api/v1/scratch', operationId }));
      expect(problem).toMatchObject({ code: AccessRuleErrorCode.ROUTE_WITHOUT_RULES, operationId: null, route: 'GET /api/v1/scratch' });
    }
  });

  it('a route cannot borrow a rule by naming a registry operation on another path or method', () => {
    // A PUBLIC operation named on a path of its own choosing: that would open the path to everybody.
    expect(problemOf(book.resolve({ method: 'GET', url: '/api/v1/secret', operationId: 'getServiceHealth' }))).toMatchObject({
      code: AccessRuleErrorCode.ROUTE_NOT_THE_OPERATION,
      operationId: 'getServiceHealth',
      route: 'GET /api/v1/secret',
    });
    // The right path with the other method.
    expect(problemOf(book.resolve({ method: 'POST', url: '/api/v1/health', operationId: 'getServiceHealth' })).code).toBe(
      AccessRuleErrorCode.ROUTE_NOT_THE_OPERATION,
    );
  });

  it('a registry route whose config.operationId is missing or names another operation is refused', () => {
    expect(problemOf(book.resolve({ method: 'GET', url: '/api/v1/admin/users', operationId: undefined }))).toMatchObject({
      code: AccessRuleErrorCode.OPERATION_ID_MISMATCH,
      operationId: 'listUsers',
    });
    // The route of a USER_ADMIN operation that calls itself a PUBLIC one keeps nothing of it.
    expect(problemOf(book.resolve({ method: 'GET', url: '/api/v1/admin/users', operationId: 'getServiceHealth' })).code).toBe(
      AccessRuleErrorCode.OPERATION_ID_MISMATCH,
    );
  });

  it('the one route outside the registry is the socket, GET /ws: open at the handshake, no permission, no row, a retired device included', () => {
    for (const operationId of [undefined, 'whatever']) {
      expect(book.resolve({ method: 'GET', url: WS_PATH, operationId })).toBe(REALTIME_CHANNEL_RULE);
    }
    expect(book.ruleAt('GET', WS_PATH)).toBe(REALTIME_CHANNEL_RULE);
    expect(REALTIME_CHANNEL_RULE).toMatchObject({
      operationId: REALTIME_CHANNEL_ID,
      kind: CoreApiAccessKind.PUBLIC,
      permissions: [],
      conditions: [],
      denial: null,
      refusesRetiredDevice: false,
    });
    expect(book.operationIds).not.toContain(REALTIME_CHANNEL_ID);
    // Only that method on that path.
    expect(problemOf(book.resolve({ method: 'POST', url: WS_PATH, operationId: undefined })).code).toBe(AccessRuleErrorCode.ROUTE_WITHOUT_RULES);
    expect(problemOf(book.resolve({ method: 'GET', url: `${WS_PATH}/other`, operationId: undefined })).code).toBe(AccessRuleErrorCode.ROUTE_WITHOUT_RULES);
  });

  it('row 90, ruling D140: the evidence media route, GET /media/:token, is the second route outside the registry and gets THE RULE OF OPERATION 88 - never an open one', () => {
    const session = book.ruleOf(EVIDENCE_MEDIA_SESSION_OPERATION);
    if (!isAccessRule(session)) throw new Error('operation 88 has no rule');
    expect(EVIDENCE_MEDIA_SESSION_OPERATION).toBe('createEvidenceMediaSession');
    expect(EVIDENCE_MEDIA_ROUTE_URL).toBe('/media/:token');
    const rule = book.ruleAt('GET', EVIDENCE_MEDIA_ROUTE_URL);
    if (!isAccessRule(rule)) throw new Error('the evidence media route has no rule');
    for (const operationId of [undefined, 'whatever', EVIDENCE_MEDIA_SESSION_OPERATION]) {
      expect(book.resolve({ method: 'GET', url: EVIDENCE_MEDIA_ROUTE_URL, operationId })).toBe(rule);
    }
    // Everything of operation 88's rule but its name, its method, its path and its path parameter.
    expect(rule).toEqual({ ...session, operationId: EVIDENCE_MEDIA_STREAM_ID, method: 'GET', url: EVIDENCE_MEDIA_ROUTE_URL, idPattern: null });
    expect(rule).toMatchObject({
      kind: CoreApiAccessKind.PERMISSION,
      permissions: ['EVIDENCE_VIEW'],
      denial: { auditType: 'ACCESS_DENIED', errorCode: 'NOT_PERMITTED', permission: 'EVIDENCE_VIEW', export: null },
      refusesRetiredDevice: true,
    });
    expect(Object.isFrozen(rule)).toBe(true);
    expect(book.operationIds).not.toContain(EVIDENCE_MEDIA_STREAM_ID);
    // Only that method on that path: nothing beside it inherits the rule.
    for (const [method, url] of [['POST', EVIDENCE_MEDIA_ROUTE_URL], ['GET', '/media'], ['GET', '/media/:token/other'], ['GET', '/media/:id'], ['GET', '/api/v1/media/:token']] as const) {
      expect(problemOf(book.resolve({ method, url, operationId: undefined })).code, `${method} ${url}`).toBe(AccessRuleErrorCode.ROUTE_WITHOUT_RULES);
    }
    // A registry WITHOUT operation 88 gives the route no rule at all: it cannot fall back to an open one.
    const without = createRuleBook(book.operationIds.filter((id) => id !== EVIDENCE_MEDIA_SESSION_OPERATION).map((id) => operationOf(id)));
    expect(problemOf(without.resolve({ method: 'GET', url: EVIDENCE_MEDIA_ROUTE_URL, operationId: undefined })).code).toBe(AccessRuleErrorCode.ROUTE_WITHOUT_RULES);
    expect(problemOf(without.ruleAt('GET', EVIDENCE_MEDIA_ROUTE_URL)).code).toBe(AccessRuleErrorCode.ROUTE_WITHOUT_RULES);
    // The rule follows the registry: a registry in which operation 88 asks for another permission gives the route that one.
    const moved = createRuleBook(book.operationIds.map((id) => (id === EVIDENCE_MEDIA_SESSION_OPERATION ? { ...operationOf(id), access: operationOf('exportEvidence').access } : operationOf(id))));
    expect(moved.ruleAt('GET', EVIDENCE_MEDIA_ROUTE_URL)).toMatchObject({ permissions: ['EVIDENCE_EXPORT'], operationId: EVIDENCE_MEDIA_STREAM_ID });
  });

  it('ruleAt holds a route to the registry by method and path alone, for a route whose configuration cannot be read', () => {
    expect(isAccessRule(book.ruleAt('GET', '/api/v1/admin/users'))).toBe(true);
    expect(problemOf(book.ruleAt('GET', '/api/v1/scratch')).code).toBe(AccessRuleErrorCode.ROUTE_WITHOUT_RULES);
    expect(problemOf(book.ruleAt('DELETE', '/api/v1/admin/users')).code).toBe(AccessRuleErrorCode.ROUTE_WITHOUT_RULES);
  });

  it('routePatternOf turns the registry path into the router pattern', () => {
    expect(routePatternOf('/api/v1/session/{id}/start')).toBe('/api/v1/session/:id/start');
    expect(routePatternOf('/api/v1/health')).toBe('/api/v1/health');
    expect(routeOfOperation(operationOf('assignUserRole'))).toEqual({
      method: 'POST',
      url: '/api/v1/admin/users/:id/role',
      config: { operationId: 'assignUserRole' },
    });
  });
});

describe('a registry entry that cannot be compiled (AC-B-12, at the level of the entry)', () => {
  const cases: ReadonlyArray<readonly [label: string, operation: CoreApiOperation, code: AccessRuleErrorCode]> = [
    ['no access rule', entry('listUsers', { access: undefined }), AccessRuleErrorCode.ACCESS_RULE_MISSING],
    ['no audit rule', entry('listUsers', { audit: undefined }), AccessRuleErrorCode.AUDIT_RULE_MISSING],
    ['an access rule that is no object', entry('listUsers', { access: 'USER_ADMIN' }), AccessRuleErrorCode.ACCESS_RULE_MISSING],
    ['an unknown access kind', entry('listUsers', { access: { kind: 'EVERYBODY' } }), AccessRuleErrorCode.ACCESS_RULE_INVALID],
    ['an access rule without a kind', entry('listUsers', { access: {} }), AccessRuleErrorCode.ACCESS_RULE_INVALID],
    [
      'a permission outside the vocabulary',
      entry('listUsers', { access: { kind: CoreApiAccessKind.PERMISSION, permission: 'ROOT' } }),
      AccessRuleErrorCode.PERMISSION_NOT_IN_VOCABULARY,
    ],
    ['a permission rule without a permission', entry('listUsers', { access: { kind: CoreApiAccessKind.PERMISSION } }), AccessRuleErrorCode.PERMISSION_NOT_IN_VOCABULARY],
    [
      'an any-of with one permission',
      entry('setStoragePolicy', { access: { kind: CoreApiAccessKind.ANY_OF, permissions: [Permission.MAINTENANCE] } }),
      AccessRuleErrorCode.ACCESS_RULE_INVALID,
    ],
    [
      'an any-of that names an unknown permission',
      entry('setStoragePolicy', { access: { kind: CoreApiAccessKind.ANY_OF, permissions: [Permission.MAINTENANCE, 'ROOT'] } }),
      AccessRuleErrorCode.PERMISSION_NOT_IN_VOCABULARY,
    ],
    [
      'an unknown condition',
      entry('listUsers', { access: { kind: CoreApiAccessKind.AUTHENTICATED, conditions: ['ON_TUESDAYS'] } }),
      AccessRuleErrorCode.ACCESS_RULE_INVALID,
    ],
    ['a success rule that is no audit type and no marker', entry('listUsers', { audit: { success: 'NOTHING', denial: AuditType.ACCESS_DENIED } }), AccessRuleErrorCode.AUDIT_RULE_INVALID],
    ['no denial type', entry('listUsers', { audit: { success: CoreApiAuditNone.READ } }), AccessRuleErrorCode.AUDIT_RULE_INVALID],
    ['a denial type the guard cannot write', entry('listUsers', { audit: { success: CoreApiAuditNone.READ, denial: AuditType.AUTH_FAILED } }), AccessRuleErrorCode.AUDIT_RULE_INVALID],
    [
      'EXPORT_DENIED on an operation that is no export',
      entry('listUsers', { audit: { success: CoreApiAuditNone.READ, denial: AuditType.EXPORT_DENIED } }),
      AccessRuleErrorCode.AUDIT_RULE_INVALID,
    ],
  ];

  it.each(cases)('%s: no rule, and the problem names the operation', (_label, operation, code) => {
    const problem = problemOf(compileAccessRule(operation));
    expect(problem.code).toBe(code);
    expect(problem.operationId).toBe(operation.operationId);
    expect(problem.route).toMatch(/^(GET|POST) \/api\/v1\//);
  });

  it('a book built from a defective table refuses the route of the defective entry and keeps every other rule', () => {
    const defective = createRuleBook([entry('getServiceHealth', {}), entry('listUsers', { audit: undefined }), entry('getRoleMatrix', {})]);
    const route = routeOfOperation(operationOf('listUsers'));
    expect(problemOf(defective.resolve({ method: route.method, url: route.url, operationId: 'listUsers' }))).toMatchObject({
      code: AccessRuleErrorCode.AUDIT_RULE_MISSING,
      operationId: 'listUsers',
    });
    expect(problemOf(defective.ruleOf('listUsers')).code).toBe(AccessRuleErrorCode.AUDIT_RULE_MISSING);
    expect(isAccessRule(defective.ruleOf('getRoleMatrix'))).toBe(true);
    // An operation the table does not hold has no rule either.
    expect(problemOf(defective.ruleOf('signIn')).code).toBe(AccessRuleErrorCode.ROUTE_WITHOUT_RULES);
  });

  it('an AccessRuleError carries the code of its first problem and every problem; its text names operations and routes only', () => {
    const problems = [problemOf(compileAccessRule(entry('listUsers', { audit: undefined }))), problemOf(book.resolve({ method: 'GET', url: '/api/v1/scratch', operationId: undefined }))];
    const error = new AccessRuleError([problems[0]!, problems[1]!]);
    expect(error.name).toBe('AccessRuleError');
    expect(error.code).toBe(AccessRuleErrorCode.AUDIT_RULE_MISSING);
    expect(error.problems).toHaveLength(2);
    expect(error.message).toContain('listUsers');
    expect(error.message).toContain('GET /api/v1/scratch');
  });
});
