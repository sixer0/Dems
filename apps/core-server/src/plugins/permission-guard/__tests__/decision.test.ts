// The decision of stage 6 (plan row W28; spec §4.1, §4.2, §4.4, §4.6 RB-2 to RB-6, §6.6, §7.3,
// §12.1; SR-13, SR-44 to SR-46; AC-B-16 in unit form). Pure: no app, no database. The same table
// is read against the STORED matrix in `matrix.db.test.ts`.
import { CORE_API_OPERATIONS, CoreApiAccessCondition, CoreApiAccessKind, type CoreApiRegistryOperation } from '@dems/shared/api';
import { OperatorRole, Permission, ROLE_PERMISSIONS } from '@dems/shared/sim';
import { describe, expect, it } from 'vitest';
import type { Principal } from '../../authenticate';
import { AccessRefusalKind, createRuleBook, decideAccess, isAccessRule, isAudited, type AccessCaller, type AccessDecision, type AccessRule } from '../index';

const book = createRuleBook();

function ruleOf(operationId: string): AccessRule {
  const resolved = book.ruleOf(operationId);
  if (!isAccessRule(resolved)) throw new Error(`${operationId} has no rule`);
  return resolved;
}

// ── The callers of spec §4.1 ───────────────────────────────────────────────────────────────────

const ANONYMOUS: Principal = { kind: 'ANONYMOUS', retiredDeviceId: null };
const RETIRED: Principal = { kind: 'ANONYMOUS', retiredDeviceId: 'DEV-0009' };
const DEVICE: Principal = { kind: 'DEVICE', deviceId: 'DEV-0001' };
const ROLES = Object.values(OperatorRole);
const OPERATOR_OF: Record<OperatorRole, string> = { INVESTIGATOR: 'OPR-001', SUPERVISOR: 'OPR-002', TECHNICIAN: 'OPR-003' };

/** An OPERATOR as stage 4 builds it: the role and the permissions of that role as they were read. */
function operator(role: OperatorRole, deviceId: string | null, permissions: readonly Permission[] = ROLE_PERMISSIONS[role]): Principal {
  return { kind: 'OPERATOR', operatorId: OPERATOR_OF[role], sessionId: `session-of-${role}`, deviceId, role, permissions };
}

/** Everything a condition could ask for is given: what is left is the access kind and the permission. */
const granted = (principal: Principal): AccessCaller => ({
  principal,
  consoleIdentity: true,
  demoControls: true,
  // SESSION_HOLDER is satisfied too: the caller created the open session it acts on (D4 OD-09),
  // so this helper isolates the access kind and the permission from every condition.
  sessionCreatorId: principal.kind === 'OPERATOR' ? principal.operatorId : null,
});

type Outcome = 'ALLOW' | '401' | '403 DEVICE_REVOKED' | '403 NOT_PERMITTED' | '403 DEVICE_NOT_PAIRED' | '403 DEMO_DISABLED';

function outcomeOf(decision: AccessDecision): Outcome {
  if (decision.allowed) return 'ALLOW';
  switch (decision.refusal.kind) {
    case AccessRefusalKind.NOT_SIGNED_IN:
      return '401';
    case AccessRefusalKind.DEVICE_REVOKED:
      return '403 DEVICE_REVOKED';
    case AccessRefusalKind.NOT_PERMITTED:
      return '403 NOT_PERMITTED';
    case AccessRefusalKind.DEVICE_NOT_PAIRED:
      return '403 DEVICE_NOT_PAIRED';
    case AccessRefusalKind.DEMO_DISABLED:
      return '403 DEMO_DISABLED';
  }
}

/**
 * The table of spec §4.2 and §6.6, stated here without the code under test: what an operation
 * of the registry answers a caller, from its access rule and the permissions the caller holds.
 */
function expected(operation: CoreApiRegistryOperation, principal: Principal): Outcome {
  const { access } = operation;
  const retiredMayCall = operation.operationId === 'getServiceHealth' || operation.operationId === 'redeemPairingCode';
  if (principal.kind === 'ANONYMOUS' && principal.retiredDeviceId !== null && !retiredMayCall) return '403 DEVICE_REVOKED';
  if (access.kind === CoreApiAccessKind.PUBLIC) return 'ALLOW';
  if (access.kind === CoreApiAccessKind.DEVICE) {
    if (principal.kind === 'DEVICE') return 'ALLOW';
    if (principal.kind === 'OPERATOR') {
      if (principal.deviceId === null) return '403 DEVICE_NOT_PAIRED';
      // Whichever operation needs the device's own credential (decision D113): an operator's
      // session is not the device, on the device or not. Read from the registry, none is named.
      return (access.conditions ?? []).includes(CoreApiAccessCondition.DEVICE_CREDENTIAL) ? '403 DEVICE_NOT_PAIRED' : 'ALLOW';
    }
    return '401';
  }
  if (principal.kind !== 'OPERATOR') return '401';
  // Operation 7 alone: the session must be bound to a device (spec §7.5).
  const deviceSession = (access.conditions ?? []).includes(CoreApiAccessCondition.DEVICE_SESSION);
  if (access.kind === CoreApiAccessKind.AUTHENTICATED) return deviceSession && principal.deviceId === null ? '403 DEVICE_NOT_PAIRED' : 'ALLOW';
  const needed = access.kind === CoreApiAccessKind.PERMISSION ? [access.permission] : [...access.permissions];
  if (!needed.some((permission) => principal.permissions.includes(permission))) return '403 NOT_PERMITTED';
  // C3 §0, §2.6 (D80(3)): the operations whose body carries a camera credential are web console
  // only. A holder of the permission whose session is bound to a paired device is refused, audited.
  const webOnly = (access.conditions ?? []).includes(CoreApiAccessCondition.WEB_CONSOLE_SESSION);
  return webOnly && principal.deviceId !== null ? '403 NOT_PERMITTED' : 'ALLOW';
}

const CALLERS: ReadonlyArray<readonly [label: string, principal: Principal]> = [
  ['an anonymous caller', ANONYMOUS],
  ['a retired device', RETIRED],
  ['a paired device, signed out', DEVICE],
  ...ROLES.map((role) => [`${role} on the web console`, operator(role, null)] as const),
  ...ROLES.map((role) => [`${role} on a paired device`, operator(role, 'DEV-0001')] as const),
];

describe('AC-B-16, unit form: all 97 operations for nine callers', () => {
  it.each(CALLERS)('%s: every operation answers what its access rule and the role matrix say', (_label, principal) => {
    const wrong: string[] = [];
    for (const operation of CORE_API_OPERATIONS) {
      const got = outcomeOf(decideAccess(ruleOf(operation.operationId), granted(principal)));
      const want = expected(operation, principal);
      if (got !== want) wrong.push(`${operation.operationId}: ${got}, expected ${want}`);
    }
    expect(wrong).toEqual([]);
  });

  it('the cells are 97 x 9 = 873; the denied cells of an operator are re-derived from the registry and the role table (34 INVESTIGATOR, 3 SUPERVISOR, 34 TECHNICIAN at 97 operations), as spec AC-B-16 counts them', () => {
    const cells = CORE_API_OPERATIONS.length * CALLERS.length;
    // C3 §2.5 (blueprint row 113): 92 operations x 9 callers. C3 §10.1 (blueprint row 132, D106): 97 x 9.
    expect(cells).toBe(873);
    const denied = (role: OperatorRole): string[] =>
      CORE_API_OPERATIONS.filter((operation) => outcomeOf(decideAccess(ruleOf(operation.operationId), granted(operator(role, null)))) === '403 NOT_PERMITTED').map(
        (operation) => operation.operationId,
      );
    // R3 (ruling D44): the denied cells are RE-DERIVED from the landed sources - the 89-operation
    // registry and the shared 14-permission role table - never pinned as v1 spec literals. An
    // operation denies a role exactly when its rule names permissions and the role holds none of
    // them (the any-of reading of the decision; SESSION_HOLDER never refuses a `granted()` caller,
    // whose sessionCreatorId is its own). The per-operation matrix above already proves the
    // decision agrees with each rule cell by cell; this closes the count over the whole table.
    const deniedByRoleTable = (role: OperatorRole): string[] =>
      CORE_API_OPERATIONS.filter((operation) => {
        const rule = ruleOf(operation.operationId);
        return rule.permissions.length > 0 && !rule.permissions.some((permission) => (ROLE_PERMISSIONS[role] as readonly Permission[]).includes(permission));
      }).map((operation) => operation.operationId);
    for (const role of ROLES) expect(denied(role), role).toEqual(deniedByRoleTable(role));
    console.log(`[ac-b-16] denied cells over ${CORE_API_OPERATIONS.length} operations: ${ROLES.map((role) => `${role} ${denied(role).length}`).join(', ')}`);
    expect(Object.fromEntries(ROLES.map((role) => [role, denied(role).length]))).toEqual({ INVESTIGATOR: 34, SUPERVISOR: 3, TECHNICIAN: 34 });
    // The same on a device: the transport changes no permission. What it adds is the one condition
    // that names the transport (C3 §0 `WEB_CONSOLE_SESSION`, D80(3)): the three operations whose body
    // carries a camera credential refuse a HOLDER of their permission there too.
    const WEB_ONLY = ['setCaptureDeviceCredential', 'testCaptureCandidateConnection', 'adoptCaptureCandidate'];
    for (const role of ROLES) {
      const onDevice = CORE_API_OPERATIONS.filter(
        (operation) => outcomeOf(decideAccess(ruleOf(operation.operationId), granted(operator(role, 'DEV-0001')))) === '403 NOT_PERMITTED',
      ).map((operation) => operation.operationId);
      const inRegistryOrder = CORE_API_OPERATIONS.map((operation) => operation.operationId).filter((id) => denied(role).includes(id) || WEB_ONLY.includes(id));
      expect(onDevice, role).toEqual(inRegistryOrder);
      expect(onDevice.filter((id) => !denied(role).includes(id)), role).toEqual(role === 'INVESTIGATOR' ? [] : WEB_ONLY);
    }
  });

  it('what the plain-language table of spec §4.5 says of each role', () => {
    const may = (role: OperatorRole, operationId: string): boolean => decideAccess(ruleOf(operationId), granted(operator(role, null))).allowed;
    const row = (operationId: string): boolean[] => ROLES.map((role) => may(role, operationId));
    // Columns: INVESTIGATOR, SUPERVISOR, TECHNICIAN.
    expect(row('createSession')).toEqual([true, true, false]);
    expect(row('stopSession')).toEqual([true, true, false]);
    expect(row('addSessionNote')).toEqual([true, true, false]);
    expect(row('archiveEvidence')).toEqual([false, true, false]);
    expect(row('exportEvidence')).toEqual([false, true, false]);
    expect(row('exportAudit')).toEqual([false, true, false]);
    expect(row('exportLogs')).toEqual([false, true, false]);
    expect(row('setStoragePolicy')).toEqual([false, true, true]);
    expect(row('runDiagnostics')).toEqual([true, true, true]);
    expect(row('restartDevice')).toEqual([false, false, true]);
    expect(row('restartServices')).toEqual([false, false, true]);
    expect(row('startSoftwareUpdate')).toEqual([false, false, true]);
    expect(row('acknowledgeAlert')).toEqual([true, true, true]);
    expect(row('issuePairingCode')).toEqual([false, true, false]);
    expect(row('listPairedDevices')).toEqual([false, true, false]);
    expect(row('revokeDevice')).toEqual([false, true, false]);
    expect(row('listUsers')).toEqual([false, true, false]);
    expect(row('assignUserRole')).toEqual([false, true, false]);
    expect(row('resetDemo')).toEqual([false, true, false]);
    expect(row('getRoleMatrix')).toEqual([true, true, true]);
    expect(row('listEvidence')).toEqual([true, true, true]);
    expect(row('verifyEvidence')).toEqual([true, true, true]);
    expect(row('listAuditRows')).toEqual([true, true, true]);
  });
});

describe('RB-3: the permissions of the principal are the one truth of the decision', () => {
  it('a role that holds a permission in the shared table is still refused when the principal of this request does not carry it', () => {
    // What a revoked grant looks like to stage 6: the lookup of this request no longer returns it.
    const stripped = operator('SUPERVISOR', null, ROLE_PERMISSIONS.SUPERVISOR.filter((permission) => permission !== Permission.USER_ADMIN));
    expect(outcomeOf(decideAccess(ruleOf('listUsers'), granted(stripped)))).toBe('403 NOT_PERMITTED');
    expect(outcomeOf(decideAccess(ruleOf('issuePairingCode'), granted(stripped)))).toBe('ALLOW');
  });

  it('a role that lacks a permission in the shared table is allowed when the principal of this request carries it', () => {
    const widened = operator('TECHNICIAN', null, [...ROLE_PERMISSIONS.TECHNICIAN, Permission.SESSION_START]);
    expect(outcomeOf(decideAccess(ruleOf('startSession'), granted(widened)))).toBe('ALLOW');
    expect(outcomeOf(decideAccess(ruleOf('addSessionNote'), granted(widened)))).toBe('403 NOT_PERMITTED');
  });

  it('an operator without any permission passes exactly the operations that name none', () => {
    const none = operator('INVESTIGATOR', null, []);
    for (const operation of CORE_API_OPERATIONS) {
      const names = operation.access.kind === CoreApiAccessKind.PERMISSION || operation.access.kind === CoreApiAccessKind.ANY_OF;
      const deviceOnly = operation.access.kind === CoreApiAccessKind.DEVICE || operation.operationId === 'setBiometricEnrollment';
      const want: Outcome = names ? '403 NOT_PERMITTED' : deviceOnly ? '403 DEVICE_NOT_PAIRED' : 'ALLOW';
      expect([operation.operationId, outcomeOf(decideAccess(ruleOf(operation.operationId), granted(none)))]).toEqual([operation.operationId, want]);
    }
  });

  it('F-8 of the contract row: EVIDENCE_VIEW and DIAGNOSTICS_RUN are held by every seeded role, and their six operations are refused once the grant is gone', () => {
    const six = ['listEvidence', 'getEvidence', 'verifyEvidence', 'testDeviceSignal', 'identifyDevice', 'runDiagnostics'];
    for (const role of ROLES) for (const operationId of six) expect(decideAccess(ruleOf(operationId), granted(operator(role, null))).allowed).toBe(true);
    const without = operator('TECHNICIAN', null, [Permission.DEVICE_MANAGE, Permission.MAINTENANCE]);
    for (const operationId of six) expect(outcomeOf(decideAccess(ruleOf(operationId), granted(without)))).toBe('403 NOT_PERMITTED');
  });

  it('gives the same answer for the same arguments, however often it is asked: nothing is kept between two decisions', () => {
    const rule = ruleOf('startSession');
    const technician = granted(operator('TECHNICIAN', null));
    const investigator = granted(operator('INVESTIGATOR', null));
    const answers = [technician, investigator, technician, investigator, technician].map((caller) => outcomeOf(decideAccess(rule, caller)));
    expect(answers).toEqual(['403 NOT_PERMITTED', 'ALLOW', '403 NOT_PERMITTED', 'ALLOW', '403 NOT_PERMITTED']);
  });
});

describe('the any-of rule (setStoragePolicy)', () => {
  const rule = ruleOf('setStoragePolicy');
  const holding = (...permissions: Permission[]): AccessCaller => granted(operator('INVESTIGATOR', null, permissions));

  it('lets a holder of either permission through, and of both', () => {
    expect(decideAccess(rule, holding(Permission.EVIDENCE_REVIEW)).allowed).toBe(true);
    expect(decideAccess(rule, holding(Permission.MAINTENANCE)).allowed).toBe(true);
    expect(decideAccess(rule, holding(Permission.EVIDENCE_REVIEW, Permission.MAINTENANCE)).allowed).toBe(true);
  });

  it('refuses a holder of neither, and the refusal names both permissions as one code', () => {
    const decision = decideAccess(rule, holding(Permission.SESSION_START, Permission.EVIDENCE_VIEW));
    expect(decision).toEqual({
      allowed: false,
      refusal: {
        kind: AccessRefusalKind.NOT_PERMITTED,
        operatorId: 'OPR-001',
        role: 'INVESTIGATOR',
        deviceId: null,
        denial: { auditType: 'ACCESS_DENIED', errorCode: 'NOT_PERMITTED', permission: 'EVIDENCE_REVIEW_OR_MAINTENANCE', export: null },
      },
    });
  });
});

describe('what a refusal says, and which refusals are audited (RB-4, RB-6)', () => {
  it('a missing permission names the operator, the role, the session device and the denial of the rule', () => {
    const decision = decideAccess(ruleOf('startSession'), granted(operator('TECHNICIAN', 'DEV-0001')));
    expect(decision).toEqual({
      allowed: false,
      refusal: {
        kind: AccessRefusalKind.NOT_PERMITTED,
        operatorId: 'OPR-003',
        role: 'TECHNICIAN',
        deviceId: 'DEV-0001',
        denial: { auditType: 'ACCESS_DENIED', errorCode: 'NOT_PERMITTED', permission: 'SESSION_START', export: null },
      },
    });
  });

  it('a retired device names its device ID; a 401 says whether an operator or a device is asked for', () => {
    expect(decideAccess(ruleOf('getAuthSession'), granted(RETIRED))).toEqual({ allowed: false, refusal: { kind: AccessRefusalKind.DEVICE_REVOKED, deviceId: 'DEV-0009' } });
    expect(decideAccess(ruleOf('getAuthSession'), granted(ANONYMOUS))).toEqual({ allowed: false, refusal: { kind: AccessRefusalKind.NOT_SIGNED_IN, needs: 'OPERATOR' } });
    expect(decideAccess(ruleOf('getAuthSession'), granted(DEVICE))).toEqual({ allowed: false, refusal: { kind: AccessRefusalKind.NOT_SIGNED_IN, needs: 'OPERATOR' } });
    expect(decideAccess(ruleOf('unpairDevice'), granted(ANONYMOUS))).toEqual({ allowed: false, refusal: { kind: AccessRefusalKind.NOT_SIGNED_IN, needs: 'DEVICE' } });
  });

  it('exactly two refusals are audited: a missing permission and a retired device', () => {
    const audited = (decision: AccessDecision): boolean => !decision.allowed && isAudited(decision.refusal);
    expect(audited(decideAccess(ruleOf('startSession'), granted(operator('TECHNICIAN', null))))).toBe(true);
    expect(audited(decideAccess(ruleOf('getAuthSession'), granted(RETIRED)))).toBe(true);
    expect(audited(decideAccess(ruleOf('getAuthSession'), granted(ANONYMOUS)))).toBe(false);
    expect(audited(decideAccess(ruleOf('unpairDevice'), granted(operator('SUPERVISOR', null))))).toBe(false);
    expect(audited(decideAccess(ruleOf('signIn'), { principal: ANONYMOUS, consoleIdentity: false, demoControls: true, sessionCreatorId: null }))).toBe(false);
    expect(audited(decideAccess(ruleOf('resetDemo'), { principal: operator('SUPERVISOR', null), consoleIdentity: true, demoControls: false, sessionCreatorId: null }))).toBe(false);
    expect(audited(decideAccess(ruleOf('startSession'), granted(operator('INVESTIGATOR', null))))).toBe(false);
  });

  it('a retired device is an anonymous caller on what it may still call: health and the pairing redeem pass, and it is still not signed in', () => {
    expect(decideAccess(ruleOf('getServiceHealth'), granted(RETIRED)).allowed).toBe(true);
    expect(decideAccess(ruleOf('redeemPairingCode'), granted(RETIRED)).allowed).toBe(true);
    // Decision D78 DN-9: the two other PUBLIC operations refuse it.
    expect(outcomeOf(decideAccess(ruleOf('signIn'), granted(RETIRED)))).toBe('403 DEVICE_REVOKED');
    expect(outcomeOf(decideAccess(ruleOf('getSignInStatus'), granted(RETIRED)))).toBe('403 DEVICE_REVOKED');
  });
});

describe('the conditions of a rule (spec §7.3 line 7)', () => {
  it('CONSOLE_IDENTITY: signIn without a console identity answers 403 DEVICE_NOT_PAIRED, whoever the caller is', () => {
    const rule = ruleOf('signIn');
    for (const principal of [ANONYMOUS, DEVICE, operator('SUPERVISOR', null), operator('SUPERVISOR', 'DEV-0001')]) {
      expect(decideAccess(rule, { principal, consoleIdentity: false, demoControls: false, sessionCreatorId: null })).toEqual({
        allowed: false,
        refusal: { kind: AccessRefusalKind.DEVICE_NOT_PAIRED, cause: CoreApiAccessCondition.CONSOLE_IDENTITY },
      });
      expect(decideAccess(rule, { principal, consoleIdentity: true, demoControls: false, sessionCreatorId: null }).allowed).toBe(true);
    }
    // No other operation asks for it.
    expect(decideAccess(ruleOf('getSignInStatus'), { principal: ANONYMOUS, consoleIdentity: false, demoControls: false, sessionCreatorId: null }).allowed).toBe(true);
  });

  it('DEVICE_SESSION: setBiometricEnrollment needs a session that is bound to a device', () => {
    const rule = ruleOf('setBiometricEnrollment');
    expect(decideAccess(rule, granted(operator('INVESTIGATOR', 'DEV-0001'))).allowed).toBe(true);
    expect(decideAccess(rule, granted(operator('INVESTIGATOR', null)))).toEqual({
      allowed: false,
      refusal: { kind: AccessRefusalKind.DEVICE_NOT_PAIRED, cause: CoreApiAccessCondition.DEVICE_SESSION },
    });
    // The session comes first: without one the answer is 401, not 403.
    expect(outcomeOf(decideAccess(rule, granted(DEVICE)))).toBe('401');
  });

  it('a DEVICE operation called by a web console session answers 403 DEVICE_NOT_PAIRED; the device is allowed, and so is an operator on the device unless the rule needs the device\'s own credential', () => {
    const deviceOperations = CORE_API_OPERATIONS.filter((operation) => operation.access.kind === CoreApiAccessKind.DEVICE);
    expect(deviceOperations.map((operation) => operation.operationId)).toEqual(['signInWithBiometric', 'reportBiometricFailure', 'getDeviceRegistration', 'unpairDevice', 'rotateDeviceCredential']);
    for (const { operationId, access } of deviceOperations) {
      expect(decideAccess(ruleOf(operationId), granted(operator('SUPERVISOR', null)))).toEqual({
        allowed: false,
        refusal: { kind: AccessRefusalKind.DEVICE_NOT_PAIRED, cause: 'DEVICE_OPERATION' },
      });
      expect(decideAccess(ruleOf(operationId), granted(DEVICE)).allowed).toBe(true);
      const ownCredential = (access.conditions ?? []).includes(CoreApiAccessCondition.DEVICE_CREDENTIAL);
      expect(decideAccess(ruleOf(operationId), granted(operator('SUPERVISOR', 'DEV-0001'))).allowed, operationId).toBe(!ownCredential);
    }
    // Today that is the session operations of a device without the rotation (decision D113).
    expect(decideAccess(ruleOf('unpairDevice'), granted(operator('SUPERVISOR', 'DEV-0001'))).allowed).toBe(true);
    expect(decideAccess(ruleOf('rotateDeviceCredential'), granted(operator('SUPERVISOR', 'DEV-0001'))).allowed).toBe(false);
  });

  it('DC-1, DC-2: the permission is decided before the demo flag; a permitted caller gets DEMO_DISABLED while the flag is off', () => {
    const demo = ['getDemoStatus', 'loadScenario', 'injectFault', 'clearFault', 'resetDemo'];
    for (const operationId of demo) {
      const rule = ruleOf(operationId);
      for (const demoControls of [false, true]) {
        // Whatever the flag, a caller without DEMO_CONTROL is refused for the permission (DC-1).
        expect(outcomeOf(decideAccess(rule, { principal: operator('INVESTIGATOR', null), consoleIdentity: true, demoControls, sessionCreatorId: null }))).toBe('403 NOT_PERMITTED');
        expect(outcomeOf(decideAccess(rule, { principal: ANONYMOUS, consoleIdentity: true, demoControls, sessionCreatorId: null }))).toBe('401');
      }
      expect(decideAccess(rule, { principal: operator('SUPERVISOR', null), consoleIdentity: true, demoControls: false, sessionCreatorId: null })).toEqual({
        allowed: false,
        refusal: { kind: AccessRefusalKind.DEMO_DISABLED },
      });
      expect(decideAccess(rule, { principal: operator('SUPERVISOR', null), consoleIdentity: true, demoControls: true, sessionCreatorId: null }).allowed).toBe(true);
    }
    // The flag touches nothing else.
    expect(decideAccess(ruleOf('listUsers'), { principal: operator('SUPERVISOR', null), consoleIdentity: true, demoControls: false, sessionCreatorId: null }).allowed).toBe(true);
  });

  it('the socket handshake is open to every caller, a retired device included: the channel decides what a socket may see', () => {
    const channel = book.ruleAt('GET', '/ws');
    if (!isAccessRule(channel)) throw new Error('the channel has no rule');
    for (const principal of [ANONYMOUS, RETIRED, DEVICE, operator('TECHNICIAN', null), operator('TECHNICIAN', 'DEV-0001')]) {
      expect(decideAccess(channel, { principal, consoleIdentity: false, demoControls: false, sessionCreatorId: null }).allowed).toBe(true);
    }
  });

  it('a rule that names a permission and has none to check lets nobody through: it throws', () => {
    const broken: AccessRule = { ...ruleOf('listUsers'), permissions: [], denial: null };
    expect(() => decideAccess(broken, granted(operator('SUPERVISOR', null)))).toThrow(/has none to check/);
    // Without a principal the 401 still comes first.
    expect(outcomeOf(decideAccess(broken, granted(ANONYMOUS)))).toBe('401');
  });
});

describe('WEB_CONSOLE_SESSION: the operations whose body carries a camera credential are web console only (C3 §0, §2.6; D80(3); SEC35-45)', () => {
  const WEB_ONLY = ['setCaptureDeviceCredential', 'testCaptureCandidateConnection', 'adoptCaptureCandidate'];
  const refusalOf = (operationId: string, principal: Principal) => {
    const decision = decideAccess(ruleOf(operationId), granted(principal));
    return decision.allowed ? null : decision.refusal;
  };

  it('operations 89, 95 and 96 carry it, each on the permission CAPTURE_CONFIG; no other operation does', () => {
    const carriers = CORE_API_OPERATIONS.filter((operation) => ruleOf(operation.operationId).conditions.includes(CoreApiAccessCondition.WEB_CONSOLE_SESSION));
    expect(carriers.map((operation) => operation.operationId)).toEqual(WEB_ONLY);
    for (const operationId of WEB_ONLY) {
      expect(ruleOf(operationId).kind).toBe(CoreApiAccessKind.PERMISSION);
      expect(ruleOf(operationId).permissions).toEqual([Permission.CAPTURE_CONFIG]);
    }
  });

  it('a web console session of a holder passes; the same holder on a paired device is refused 403 NOT_PERMITTED with the reason WEB_CONSOLE_ONLY, audited', () => {
    for (const operationId of WEB_ONLY) {
      for (const role of ['SUPERVISOR', 'TECHNICIAN'] as const) {
        expect(decideAccess(ruleOf(operationId), granted(operator(role, null))).allowed, `${operationId} ${role} web`).toBe(true);
        const refusal = refusalOf(operationId, operator(role, 'DEV-0001'));
        expect(refusal, `${operationId} ${role} device`).toEqual({
          kind: AccessRefusalKind.NOT_PERMITTED,
          operatorId: OPERATOR_OF[role],
          role,
          deviceId: 'DEV-0001',
          denial: ruleOf(operationId).denial,
          reason: 'WEB_CONSOLE_ONLY',
        });
        expect(refusal !== null && isAudited(refusal)).toBe(true);
      }
    }
  });

  it('the permission is decided first: a role without CAPTURE_CONFIG is refused for the permission on either console, with no reason', () => {
    for (const operationId of WEB_ONLY) {
      for (const deviceId of [null, 'DEV-0001']) {
        const refusal = refusalOf(operationId, operator('INVESTIGATOR', deviceId));
        expect(refusal?.kind, operationId).toBe(AccessRefusalKind.NOT_PERMITTED);
        expect(refusal !== null && 'reason' in refusal ? refusal.reason : undefined, operationId).toBeUndefined();
      }
    }
  });

  it('the device itself, an anonymous caller and a retired device are answered by the marker, before the condition', () => {
    for (const operationId of WEB_ONLY) {
      expect(outcomeOf(decideAccess(ruleOf(operationId), granted(DEVICE)))).toBe('401');
      expect(outcomeOf(decideAccess(ruleOf(operationId), granted(ANONYMOUS)))).toBe('401');
      expect(outcomeOf(decideAccess(ruleOf(operationId), granted(RETIRED)))).toBe('403 DEVICE_REVOKED');
    }
  });

  it('nothing but the session binding is asked: the console identity, the demo flag and the session holder change no answer; the three that are open to a tablet stay open', () => {
    const technician = operator('TECHNICIAN', 'DEV-0001');
    for (const operationId of WEB_ONLY) {
      for (const consoleIdentity of [true, false]) {
        for (const demoControls of [true, false]) {
          for (const sessionCreatorId of [null, 'OPR-003', 'OPR-001']) {
            const caller: AccessCaller = { principal: technician, consoleIdentity, demoControls, sessionCreatorId };
            expect(outcomeOf(decideAccess(ruleOf(operationId), caller))).toBe('403 NOT_PERMITTED');
            expect(decideAccess(ruleOf(operationId), { ...caller, principal: operator('TECHNICIAN', null) }).allowed).toBe(true);
          }
        }
      }
    }
    // Operations 93, 94 and 97 take the same permission and no condition: a tablet may search and read.
    for (const operationId of ['startCaptureDiscovery', 'getCaptureDiscovery', 'rescanCaptureInputs']) {
      expect(ruleOf(operationId).conditions).toEqual([]);
      expect(decideAccess(ruleOf(operationId), granted(technician)).allowed, operationId).toBe(true);
      expect(outcomeOf(decideAccess(ruleOf(operationId), granted(operator('INVESTIGATOR', 'DEV-0001')))), operationId).toBe('403 NOT_PERMITTED');
    }
  });
});

describe("DEVICE_CREDENTIAL: an operation that needs the device's own credential (finding CPS1-3; decisions D113, D118)", () => {
  /** Whatever the registry puts the condition on. No test below names an operation to decide it. */
  const OWN_CREDENTIAL = CORE_API_OPERATIONS.filter((operation) => (operation.access.conditions ?? []).includes(CoreApiAccessCondition.DEVICE_CREDENTIAL)).map(
    (operation) => operation.operationId,
  );
  const REFUSED: AccessDecision = { allowed: false, refusal: { kind: AccessRefusalKind.DEVICE_NOT_PAIRED, cause: CoreApiAccessCondition.DEVICE_CREDENTIAL } };

  it('operation 23 carries it, and every operation that carries it is a DEVICE operation', () => {
    expect(OWN_CREDENTIAL).toContain('rotateDeviceCredential');
    for (const operationId of OWN_CREDENTIAL) {
      expect(ruleOf(operationId).kind, operationId).toBe(CoreApiAccessKind.DEVICE);
      expect(ruleOf(operationId).conditions, operationId).toEqual([CoreApiAccessCondition.DEVICE_CREDENTIAL]);
    }
  });

  it('the device itself holds it; the session of an operator who is signed in on the device does not, whatever the role and whatever it is granted; the refusal is not audited', () => {
    for (const operationId of OWN_CREDENTIAL) {
      const rule = ruleOf(operationId);
      expect(decideAccess(rule, granted(DEVICE)), operationId).toEqual({ allowed: true });
      for (const role of ROLES) {
        const decision = decideAccess(rule, granted(operator(role, 'DEV-0001')));
        expect(decision, `${operationId} as ${role}`).toEqual(REFUSED);
        expect(!decision.allowed && isAudited(decision.refusal)).toBe(false);
      }
      // The condition asks who the caller IS: holding every permission of the vocabulary changes nothing.
      expect(decideAccess(rule, granted(operator('SUPERVISOR', 'DEV-0001', Object.values(Permission)))), operationId).toEqual(REFUSED);
    }
  });

  it('the order of stage 6 is unchanged: a retired device, a caller without a principal and a web console session are answered by the marker, before the condition', () => {
    for (const operationId of OWN_CREDENTIAL) {
      const rule = ruleOf(operationId);
      expect(decideAccess(rule, granted(RETIRED)), operationId).toEqual({ allowed: false, refusal: { kind: AccessRefusalKind.DEVICE_REVOKED, deviceId: 'DEV-0009' } });
      expect(decideAccess(rule, granted(ANONYMOUS)), operationId).toEqual({ allowed: false, refusal: { kind: AccessRefusalKind.NOT_SIGNED_IN, needs: 'DEVICE' } });
      expect(decideAccess(rule, granted(operator('SUPERVISOR', null))), operationId).toEqual({
        allowed: false,
        refusal: { kind: AccessRefusalKind.DEVICE_NOT_PAIRED, cause: 'DEVICE_OPERATION' },
      });
    }
  });

  it('nothing else is asked: the console identity and the demo flag change no answer', () => {
    for (const operationId of OWN_CREDENTIAL) {
      const rule = ruleOf(operationId);
      for (const consoleIdentity of [false, true]) {
        for (const demoControls of [false, true]) {
          expect(decideAccess(rule, { principal: DEVICE, consoleIdentity, demoControls, sessionCreatorId: null })).toEqual({ allowed: true });
          expect(decideAccess(rule, { principal: operator('INVESTIGATOR', 'DEV-0001'), consoleIdentity, demoControls, sessionCreatorId: null })).toEqual(REFUSED);
        }
      }
    }
  });

  it('decision D118: the evaluation names no operation. Any other DEVICE rule that is given the condition is decided the same way, with no change of the source', () => {
    const others = CORE_API_OPERATIONS.filter((operation) => operation.access.kind === CoreApiAccessKind.DEVICE && !OWN_CREDENTIAL.includes(operation.operationId));
    for (const { operationId } of others) {
      const today = ruleOf(operationId);
      // Without the condition the marker DEVICE takes the session of an operator on the device.
      expect(decideAccess(today, granted(operator('INVESTIGATOR', 'DEV-0001'))).allowed, operationId).toBe(true);
      const withCondition: AccessRule = { ...today, conditions: [CoreApiAccessCondition.DEVICE_CREDENTIAL] };
      expect(decideAccess(withCondition, granted(DEVICE)), operationId).toEqual({ allowed: true });
      expect(decideAccess(withCondition, granted(operator('INVESTIGATOR', 'DEV-0001'))), operationId).toEqual(REFUSED);
      expect(outcomeOf(decideAccess(withCondition, granted(operator('INVESTIGATOR', null)))), operationId).toBe('403 DEVICE_NOT_PAIRED');
      expect(outcomeOf(decideAccess(withCondition, granted(ANONYMOUS))), operationId).toBe('401');
    }
  });

  it('a condition that stage 6 does not evaluate lets nobody through: it throws, and the refusals of the marker still come first', () => {
    const unevaluated = { ...ruleOf('getDeviceRegistration'), conditions: ['A_CONDITION_OF_TOMORROW'] } as unknown as AccessRule;
    expect(() => decideAccess(unevaluated, granted(DEVICE))).toThrow(/a condition that stage 6 does not evaluate: A_CONDITION_OF_TOMORROW/);
    expect(() => decideAccess(unevaluated, granted(operator('SUPERVISOR', 'DEV-0001')))).toThrow(/does not evaluate/);
    expect(outcomeOf(decideAccess(unevaluated, granted(ANONYMOUS)))).toBe('401');
    expect(outcomeOf(decideAccess(unevaluated, granted(RETIRED)))).toBe('403 DEVICE_REVOKED');
  });
});
