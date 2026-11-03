// What a refusal of stage 6 answers and writes (plan row W28; spec §4.6 RB-4 to RB-6, §7.2,
// §13.1; SR-45; decisions D13 DEPARTURE-3, D64 DN-12, D78 DN-9). Pure: no app, no database.
import {
  ApiErrorSchema,
  CORE_API_EXAMPLES,
  CORE_API_OPERATIONS,
  CoreApiAccessCondition,
  DEVICE_CREDENTIAL_REQUIRED_REASON,
  validateCoreApiResponse,
} from '@dems/shared/api';
import { AuditType, DEMO_OPERATOR_PASSWORD, OPERATORS, OperatorRole, ROLE_PERMISSIONS, createManualClock, createSim, type Permission } from '@dems/shared/sim';
import { describe, expect, it } from 'vitest';
import { detailRulesOf, looksLikeSecret } from '../../../core';
import type { Principal } from '../../authenticate';
import { ApiFailure, errorBody } from '../../error-envelope';
import {
  AccessRefusalKind,
  RETIRED_DEVICE_REASON,
  createRuleBook,
  decideAccess,
  denialRecordOf,
  isAccessRule,
  isAudited,
  refusalAnswer,
  type AccessCaller,
  type AccessRefusal,
  type AccessRule,
} from '../index';

const book = createRuleBook();

function ruleOf(operationId: string): AccessRule {
  const resolved = book.ruleOf(operationId);
  if (!isAccessRule(resolved)) throw new Error(`${operationId} has no rule`);
  return resolved;
}

const OPERATOR_OF: Record<OperatorRole, string> = { INVESTIGATOR: 'OPR-001', SUPERVISOR: 'OPR-002', TECHNICIAN: 'OPR-003' };
const operator = (role: OperatorRole, deviceId: string | null = null, permissions: readonly Permission[] = ROLE_PERMISSIONS[role]): Principal => ({
  kind: 'OPERATOR',
  operatorId: OPERATOR_OF[role],
  sessionId: 'session',
  deviceId,
  role,
  permissions,
});
const ANONYMOUS: Principal = { kind: 'ANONYMOUS', retiredDeviceId: null };
const RETIRED: Principal = { kind: 'ANONYMOUS', retiredDeviceId: 'DEV-0007' };

function refusalOf(operationId: string, caller: Partial<AccessCaller> & { principal: Principal }): AccessRefusal {
  const decision = decideAccess(ruleOf(operationId), { consoleIdentity: true, demoControls: true, sessionCreatorId: null, ...caller });
  if (decision.allowed) throw new Error(`${operationId} was allowed`);
  return decision.refusal;
}

/** The body an answer has on the wire. */
function bodyOf(failure: ApiFailure): unknown {
  return errorBody({ id: '00000000-0000-4000-8000-000000000000' } as Parameters<typeof errorBody>[0], failure);
}

describe('the answer of a refusal (spec §7.2)', () => {
  it('a missing permission: 403 NOT_PERMITTED with operationId, permission and role in details', () => {
    const answer = refusalAnswer(ruleOf('startSession'), refusalOf('startSession', { principal: operator('TECHNICIAN') }));
    expect(answer).toBeInstanceOf(ApiFailure);
    expect(answer).toMatchObject({ statusCode: 403, code: 'NOT_PERMITTED', message: 'Your role does not allow this action. The attempt was audited.' });
    expect(answer.details).toEqual({ operationId: 'startSession', permission: 'SESSION_START', role: 'TECHNICIAN' });
    expect(answer.headers).toBeUndefined();
  });

  it('the any-of: the same three details, the permission as one code (the text the contract example must use)', () => {
    const answer = refusalAnswer(ruleOf('setStoragePolicy'), refusalOf('setStoragePolicy', { principal: operator('INVESTIGATOR') }));
    expect(answer).toMatchObject({ statusCode: 403, code: 'NOT_PERMITTED' });
    expect(answer.details).toEqual({ operationId: 'setStoragePolicy', permission: 'EVIDENCE_REVIEW_OR_MAINTENANCE', role: 'INVESTIGATOR' });
    expect(bodyOf(answer)).toEqual({
      error: {
        code: 'NOT_PERMITTED',
        message: 'Your role does not allow this action. The attempt was audited.',
        details: { operationId: 'setStoragePolicy', permission: 'EVIDENCE_REVIEW_OR_MAINTENANCE', role: 'INVESTIGATOR' },
        requestId: '00000000-0000-4000-8000-000000000000',
      },
    });
  });

  it('RB-5: exportEvidence keeps the code FORBIDDEN; the audit export and the log export answer NOT_PERMITTED', () => {
    const evidence = refusalAnswer(ruleOf('exportEvidence'), refusalOf('exportEvidence', { principal: operator('INVESTIGATOR') }));
    expect(evidence).toMatchObject({ statusCode: 403, code: 'FORBIDDEN', message: 'Your role cannot export evidence (RBAC). The attempt was audited.' });
    expect(evidence.details).toEqual({ operationId: 'exportEvidence', permission: 'EVIDENCE_EXPORT', role: 'INVESTIGATOR' });
    for (const operationId of ['exportAudit', 'exportLogs']) {
      const answer = refusalAnswer(ruleOf(operationId), refusalOf(operationId, { principal: operator('TECHNICIAN') }));
      expect(answer).toMatchObject({ statusCode: 403, code: 'NOT_PERMITTED' });
      expect(answer.details).toEqual({ operationId, permission: 'AUDIT_EXPORT', role: 'TECHNICIAN' });
    }
  });

  it('no principal: 401 NOT_SIGNED_IN, worded for an operator or for a device, without details', () => {
    const session = refusalAnswer(ruleOf('getAuthSession'), refusalOf('getAuthSession', { principal: ANONYMOUS }));
    expect(session).toMatchObject({ statusCode: 401, code: 'NOT_SIGNED_IN', message: 'Sign in first.' });
    expect(session.details).toBeUndefined();
    const device = refusalAnswer(ruleOf('unpairDevice'), refusalOf('unpairDevice', { principal: ANONYMOUS }));
    expect(device).toMatchObject({ statusCode: 401, code: 'NOT_SIGNED_IN', message: 'This operation needs the credential of a paired device.' });
    expect(device.details).toBeUndefined();
  });

  it('a retired device: 403 DEVICE_REVOKED with details.reason, the answer the identity module gives as well', () => {
    const answer = refusalAnswer(ruleOf('signIn'), refusalOf('signIn', { principal: RETIRED }));
    expect(answer).toMatchObject({ statusCode: 403, code: 'DEVICE_REVOKED', message: 'This device is no longer paired with the Core.' });
    expect(answer.details).toEqual({ reason: 'DEVICE_REVOKED' });
  });

  it('DEVICE_NOT_PAIRED: the sign-in text without a console identity, another text for a device-only operation', () => {
    const signIn = refusalAnswer(ruleOf('signIn'), refusalOf('signIn', { principal: ANONYMOUS, consoleIdentity: false }));
    expect(signIn).toMatchObject({ statusCode: 403, code: 'DEVICE_NOT_PAIRED', message: 'Pair this device with the Core before signing in.' });
    for (const operationId of ['setBiometricEnrollment', 'unpairDevice']) {
      const answer = refusalAnswer(ruleOf(operationId), refusalOf(operationId, { principal: operator('SUPERVISOR') }));
      expect(answer).toMatchObject({ statusCode: 403, code: 'DEVICE_NOT_PAIRED', message: 'This operation is available on a paired device only.' });
      expect(answer.details).toBeUndefined();
    }
  });

  it("CPS1-3: the device's own credential is needed: 403 DEVICE_NOT_PAIRED with the contract's text and details.reason; no row; a web console session keeps the marker's answer, without the reason", () => {
    const operationId = 'rotateDeviceCredential';
    const refusal = refusalOf(operationId, { principal: operator('INVESTIGATOR', 'DEV-0001') });
    expect(refusal).toEqual({ kind: AccessRefusalKind.DEVICE_NOT_PAIRED, cause: CoreApiAccessCondition.DEVICE_CREDENTIAL });

    const answer = refusalAnswer(ruleOf(operationId), refusal);
    expect(answer).toMatchObject({ statusCode: 403, code: 'DEVICE_NOT_PAIRED', message: "This operation needs the device's own credential." });
    expect(answer.details).toEqual({ reason: DEVICE_CREDENTIAL_REQUIRED_REASON });
    expect(DEVICE_CREDENTIAL_REQUIRED_REASON).toBe('DEVICE_CREDENTIAL_REQUIRED');
    // The same code, message and details as the example the contract documents for the operation.
    const body = bodyOf(answer) as { error: { code: string; message: string; details?: unknown } };
    const example = CORE_API_EXAMPLES[operationId]?.responses[403]?.['deviceCredentialRequired']?.value as { error: { code: string; message: string; details?: unknown } };
    expect([body.error.code, body.error.message, body.error.details]).toEqual([example.error.code, example.error.message, example.error.details]);
    expect(validateCoreApiResponse(operationId, 403, body)).toEqual({ ok: true });
    // Like every other DEVICE_NOT_PAIRED: no row, so no place in the denial budget.
    expect(isAudited(refusal)).toBe(false);
    expect(denialRecordOf(ruleOf(operationId), refusal, null)).toBeNull();

    // The marker's own refusal, of a web console session, is the old one: another text, no details.
    const web = refusalAnswer(ruleOf(operationId), refusalOf(operationId, { principal: operator('SUPERVISOR') }));
    expect(web).toMatchObject({ statusCode: 403, code: 'DEVICE_NOT_PAIRED', message: 'This operation is available on a paired device only.' });
    expect(web.details).toBeUndefined();
    // And the answer depends on the cause alone, not on the operation: the same for any rule.
    const elsewhere = refusalAnswer(ruleOf('getDeviceRegistration'), refusal);
    expect([elsewhere.statusCode, elsewhere.code, elsewhere.message, elsewhere.details]).toEqual([answer.statusCode, answer.code, answer.message, answer.details]);
  });

  it('DEMO_DISABLED: 403 for a permitted caller while the flag is off', () => {
    const answer = refusalAnswer(ruleOf('resetDemo'), refusalOf('resetDemo', { principal: operator('SUPERVISOR'), demoControls: false }));
    expect(answer).toMatchObject({ statusCode: 403, code: 'DEMO_DISABLED', message: 'Demo controls are not enabled on this server.' });
  });

  it('every answer is an error envelope of the contract, and a status the operation documents', () => {
    const callers: Array<Partial<AccessCaller> & { principal: Principal }> = [
      { principal: ANONYMOUS },
      { principal: ANONYMOUS, consoleIdentity: false },
      { principal: RETIRED },
      { principal: { kind: 'DEVICE', deviceId: 'DEV-0001' } },
      ...Object.values(OperatorRole).flatMap((role) => [{ principal: operator(role) }, { principal: operator(role, 'DEV-0001') }, { principal: operator(role), demoControls: false }]),
    ];
    let refusals = 0;
    for (const operation of CORE_API_OPERATIONS) {
      for (const caller of callers) {
        const decision = decideAccess(ruleOf(operation.operationId), { consoleIdentity: true, demoControls: true, sessionCreatorId: null, ...caller });
        if (decision.allowed) continue;
        refusals += 1;
        const answer = refusalAnswer(ruleOf(operation.operationId), decision.refusal);
        const body = bodyOf(answer);
        expect(ApiErrorSchema.safeParse(body).success).toBe(true);
        expect([operation.operationId, answer.statusCode, validateCoreApiResponse(operation.operationId, answer.statusCode, body)]).toEqual([
          operation.operationId,
          answer.statusCode,
          { ok: true },
        ]);
      }
    }
    expect(refusals).toBeGreaterThan(400);
  });
});

describe('the row of an audited refusal (RB-4, RB-6; spec §13.1)', () => {
  it('a missing permission: ACCESS_DENIED naming the actor, the operation, the permission and the role; no event', () => {
    const rule = ruleOf('startSession');
    const record = denialRecordOf(rule, refusalOf('startSession', { principal: operator('TECHNICIAN') }), null);
    expect(record).toEqual({
      audit: {
        type: 'ACCESS_DENIED',
        severity: 'WARNING',
        message: 'Access denied: role TECHNICIAN lacks SESSION_START (startSession)',
        actorId: 'OPR-003',
        deviceId: null,
        details: { operationId: 'startSession', permission: 'SESSION_START', role: 'TECHNICIAN' },
      },
      event: null,
    });
  });

  it('names the device of a device session; the any-of names both permissions as one code and in words', () => {
    const record = denialRecordOf(ruleOf('setStoragePolicy'), refusalOf('setStoragePolicy', { principal: operator('INVESTIGATOR', 'DEV-0001') }), null);
    expect(record?.audit).toEqual({
      type: 'ACCESS_DENIED',
      severity: 'WARNING',
      message: 'Access denied: role INVESTIGATOR holds none of EVIDENCE_REVIEW, MAINTENANCE (setStoragePolicy)',
      actorId: 'OPR-001',
      deviceId: 'DEV-0001',
      details: { operationId: 'setStoragePolicy', permission: 'EVIDENCE_REVIEW_OR_MAINTENANCE', role: 'INVESTIGATOR' },
    });
  });

  it('a retired device: ACCESS_DENIED with no actor, the device ID and reason DEVICE_REVOKED', () => {
    const record = denialRecordOf(ruleOf('getSignInStatus'), refusalOf('getSignInStatus', { principal: RETIRED }), null);
    expect(RETIRED_DEVICE_REASON).toBe('DEVICE_REVOKED');
    expect(record).toEqual({
      audit: {
        type: 'ACCESS_DENIED',
        severity: 'WARNING',
        message: 'Access denied: device DEV-0007 is no longer paired (getSignInStatus)',
        actorId: null,
        deviceId: 'DEV-0007',
        details: { operationId: 'getSignInStatus', reason: 'DEVICE_REVOKED' },
      },
      event: null,
    });
  });

  it('the refusals that are not audited have no row: 401, DEVICE_NOT_PAIRED, DEMO_DISABLED', () => {
    const unaudited: AccessRefusal[] = [
      refusalOf('getAuthSession', { principal: ANONYMOUS }),
      refusalOf('unpairDevice', { principal: ANONYMOUS }),
      refusalOf('signIn', { principal: ANONYMOUS, consoleIdentity: false }),
      refusalOf('unpairDevice', { principal: operator('SUPERVISOR') }),
      refusalOf('setBiometricEnrollment', { principal: operator('SUPERVISOR') }),
      refusalOf('resetDemo', { principal: operator('SUPERVISOR'), demoControls: false }),
    ];
    expect(unaudited.map((refusal) => refusal.kind)).toEqual([
      AccessRefusalKind.NOT_SIGNED_IN,
      AccessRefusalKind.NOT_SIGNED_IN,
      AccessRefusalKind.DEVICE_NOT_PAIRED,
      AccessRefusalKind.DEVICE_NOT_PAIRED,
      AccessRefusalKind.DEVICE_NOT_PAIRED,
      AccessRefusalKind.DEMO_DISABLED,
    ]);
    for (const refusal of unaudited) {
      expect(isAudited(refusal)).toBe(false);
      expect(denialRecordOf(ruleOf('getAuthSession'), refusal, 'EV-20261001-0001')).toBeNull();
    }
  });

  it('for every operation and every role: an audited refusal has a row, the row passes the audit writer list for its type, and it holds no credential form', () => {
    const accessDenied = detailRulesOf(AuditType.ACCESS_DENIED) ?? {};
    let rows = 0;
    for (const operation of CORE_API_OPERATIONS) {
      const rule = ruleOf(operation.operationId);
      const principals = [RETIRED, ...Object.values(OperatorRole).map((role) => operator(role, 'DEV-0001'))];
      for (const principal of principals) {
        const decision = decideAccess(rule, { principal, consoleIdentity: true, demoControls: true, sessionCreatorId: null });
        if (decision.allowed) continue;
        const record = denialRecordOf(rule, decision.refusal, null);
        expect(record !== null).toBe(isAudited(decision.refusal));
        if (record === null) continue;
        rows += 1;
        const { audit } = record;
        expect(audit.type).toBe(principal.kind === 'OPERATOR' ? operation.audit.denial : AuditType.ACCESS_DENIED);
        expect(audit.details['operationId']).toBe(operation.operationId);
        expect(audit.actorId).toBe(principal.kind === 'OPERATOR' ? principal.operatorId : null);
        expect(audit.message.length).toBeLessThanOrEqual(500);
        expect(looksLikeSecret(JSON.stringify(record))).toBe(false);
        if (audit.type !== AuditType.ACCESS_DENIED) continue;
        // The closed list of the audit writer: every key is on it, every value has its form,
        // and the required key is there.
        for (const [key, value] of Object.entries(audit.details)) {
          expect([operation.operationId, key, accessDenied[key]?.accepts(value)]).toEqual([operation.operationId, key, true]);
        }
        for (const [key, rule_] of Object.entries(accessDenied)) {
          if (rule_.required) expect(Object.keys(audit.details)).toContain(key);
        }
      }
    }
    // R3 (ruling D44): the total is RE-DERIVED from the landed sources, not a v1 spec formula.
    // From the registry: every operation a retired device may not call writes its ACCESS_DENIED
    // row. From the shared role table: an operation denies a role when the rule names permissions
    // the role holds none of, and every such refusal is audited under the rule's denial. Plus the
    // SESSION_HOLDER refusals of C3 §5.3: this caller states `sessionCreatorId: null`, so every
    // holder-conditioned operation the role is otherwise allowed to call still writes its row -
    // for a SUPERVISOR never, since the holder rule names it as a holder (SEC35-18).
    const retiredRows = CORE_API_OPERATIONS.filter((operation) => ruleOf(operation.operationId).refusesRetiredDevice).length;
    const deniedByRoleTable = (role: OperatorRole): number =>
      CORE_API_OPERATIONS.filter((operation) => {
        const rule = ruleOf(operation.operationId);
        return rule.permissions.length > 0 && !rule.permissions.some((permission) => (ROLE_PERMISSIONS[role] as readonly Permission[]).includes(permission));
      }).length;
    const holderRows = (role: OperatorRole): number =>
      role === OperatorRole.SUPERVISOR
        ? 0
        : CORE_API_OPERATIONS.filter((operation) => {
            const rule = ruleOf(operation.operationId);
            const allowedByMarker = rule.permissions.length === 0 || rule.permissions.some((permission) => (ROLE_PERMISSIONS[role] as readonly Permission[]).includes(permission));
            return allowedByMarker && rule.conditions.includes(CoreApiAccessCondition.SESSION_HOLDER);
          }).length;
    // Plus the WEB_CONSOLE_SESSION refusals of C3 §0, §2.6 (D80(3)): the operators of this walk are
    // signed in on a paired device, so a HOLDER of the permission is refused on the three operations
    // whose body carries a camera credential, and that refusal writes its row too.
    const webOnlyRows = (role: OperatorRole): number =>
      CORE_API_OPERATIONS.filter((operation) => {
        const rule = ruleOf(operation.operationId);
        const allowedByMarker = rule.permissions.some((permission) => (ROLE_PERMISSIONS[role] as readonly Permission[]).includes(permission));
        return allowedByMarker && rule.conditions.includes(CoreApiAccessCondition.WEB_CONSOLE_SESSION);
      }).length;
    expect(Object.fromEntries(Object.values(OperatorRole).map((role) => [role, webOnlyRows(role)]))).toEqual({ INVESTIGATOR: 0, SUPERVISOR: 0, TECHNICIAN: 17 }); // 3 + the two sound-card operations of task 4 row 63 + the re-address of row 194 + the stored-credential connection test of row V3; the TECHNICIAN also holds the permission of the seven commissioning operations of row 102 and of the two installation-acceptance operations of row 116 (14 -> 16) and of the retirement of row RD2 (16 -> 17)
    const expectedRows = retiredRows + Object.values(OperatorRole).reduce((sum, role) => sum + deniedByRoleTable(role) + holderRows(role) + webOnlyRows(role), 0);
    expect(rows).toBe(expectedRows);
  });

  it('WEB_CONSOLE_SESSION (C3 §0, §2.6; SEC35-45 (3)): the answer and the one ACCESS_DENIED row carry `reason: WEB_CONSOLE_ONLY`, name the session\'s device, and hold nothing of a body', () => {
    for (const operationId of ['setCaptureDeviceCredential', 'testCaptureCandidateConnection', 'adoptCaptureCandidate']) {
      const rule = ruleOf(operationId);
      const refusal = refusalOf(operationId, { principal: operator('TECHNICIAN', 'DEV-0001') });
      expect(isAudited(refusal)).toBe(true);
      const answer = refusalAnswer(rule, refusal);
      expect([answer.statusCode, answer.code]).toEqual([403, 'NOT_PERMITTED']);
      expect(answer.details).toEqual({ operationId, permission: 'CAPTURE_CONFIG', role: 'TECHNICIAN', reason: 'WEB_CONSOLE_ONLY' });
      expect(answer.message).toBe('This action is available on the web console only. The attempt was audited.');
      // The path ID of the request is not asked for and not written: the row names the operation only.
      const record = denialRecordOf(rule, refusal, 'CND-4F2A91C0D377');
      expect(record?.event).toBeNull();
      expect(record?.audit).toEqual({
        type: AuditType.ACCESS_DENIED,
        severity: 'WARNING',
        message: `Access denied: a session of a paired device called a web-console-only operation (${operationId})`,
        actorId: 'OPR-003',
        deviceId: 'DEV-0001',
        details: { operationId, permission: 'CAPTURE_CONFIG', role: 'TECHNICIAN', reason: 'WEB_CONSOLE_ONLY' },
      });
      // Negative control: the same operator on the web console is not refused at all.
      expect(decideAccess(rule, { principal: operator('TECHNICIAN'), consoleIdentity: true, demoControls: true, sessionCreatorId: null }).allowed).toBe(true);
    }
  });
});

describe('RB-5: the export refusals keep the simulator row and event', () => {
  const START = Date.UTC(2026, 9, 1, 3, 0, 0);
  const INVESTIGATOR = OPERATORS[0]!;

  /** The shared simulator with the INVESTIGATOR signed in: what Simulated mode writes for a denied export. */
  function simulated() {
    const sim = createSim({ clock: createManualClock(START), storage: null, authStorage: null, scenario: 'idle' });
    sim.actions.signIn(INVESTIGATOR.username, DEMO_OPERATOR_PASSWORD);
    const last = () => ({ audit: sim.store.getState().audit.rows.at(-1), event: sim.store.getState().events.at(-1) });
    return { sim, last, evidenceId: sim.store.getState().evidence[0]?.id ?? '' };
  }

  const investigator = operator('INVESTIGATOR');

  it('exportEvidence: the same type, severity, message, actor, evidence ID, event and params; the details gain operationId and permission', () => {
    const { sim, last, evidenceId } = simulated();
    expect(evidenceId).toMatch(/^EV-\d{8}-\d{4}$/);
    expect(sim.actions.exportEvidence(evidenceId, { reason: 'A reason of the test', destination: 'The archive of the test' })).toEqual({ ok: false, status: 403, reason: 'FORBIDDEN' });
    const shared = last();

    const record = denialRecordOf(ruleOf('exportEvidence'), refusalOf('exportEvidence', { principal: investigator }), evidenceId);
    expect(record?.audit).toEqual({
      type: shared.audit?.type,
      severity: shared.audit?.severity,
      message: shared.audit?.message,
      actorId: shared.audit?.actorId,
      deviceId: null,
      evidenceId: shared.audit?.evidenceId,
      details: { ...shared.audit?.details, operationId: 'exportEvidence', permission: 'EVIDENCE_EXPORT' },
    });
    expect(record?.audit).toMatchObject({ type: 'EXPORT_DENIED', actorId: INVESTIGATOR.id, evidenceId, details: { role: 'INVESTIGATOR', eventKind: 'UNAUTHORIZED_EXPORT' } });
    expect(record?.event).toEqual({
      type: shared.event?.type,
      severity: shared.event?.severity,
      message: shared.event?.message,
      params: shared.event?.params,
      deviceId: null,
    });
    expect(record?.event?.type).toBe('EXPORT_DENIED');
  });

  it.each([
    ['exportAudit', 'AUDIT'],
    ['exportLogs', 'LOGS'],
  ] as const)('%s: the same row and event, with scope %s', (operationId, scope) => {
    const { sim, last } = simulated();
    const result = operationId === 'exportAudit' ? sim.actions.exportAudit({ reason: 'A reason of the test' }) : sim.actions.exportLogs({ reason: 'A reason of the test' });
    expect(result).toEqual({ ok: false, status: 403, reason: 'FORBIDDEN' });
    const shared = last();

    const record = denialRecordOf(ruleOf(operationId), refusalOf(operationId, { principal: investigator }), null);
    expect(record?.audit).toEqual({
      type: shared.audit?.type,
      severity: shared.audit?.severity,
      message: shared.audit?.message,
      actorId: shared.audit?.actorId,
      deviceId: null,
      details: { ...shared.audit?.details, operationId, permission: 'AUDIT_EXPORT' },
    });
    expect(record?.audit.details).toMatchObject({ scope, role: 'INVESTIGATOR', eventKind: 'UNAUTHORIZED_EXPORT' });
    expect(record?.event).toEqual({ type: shared.event?.type, severity: shared.event?.severity, message: shared.event?.message, params: shared.event?.params, deviceId: null });
  });

  it('an export whose path names no evidence ID of the right form writes the row without one: nothing of the path is stored', () => {
    const record = denialRecordOf(ruleOf('exportEvidence'), refusalOf('exportEvidence', { principal: operator('TECHNICIAN', 'DEV-0001') }), null);
    expect(record?.audit).toMatchObject({
      type: 'EXPORT_DENIED',
      evidenceId: null,
      deviceId: 'DEV-0001',
      message: 'Export of an evidence package denied: role TECHNICIAN lacks EVIDENCE_EXPORT',
    });
    expect(record?.event).toEqual({ type: 'EXPORT_DENIED', severity: 'WARNING', message: 'Export denied', params: { role: 'TECHNICIAN' }, deviceId: 'DEV-0001' });
  });
});
