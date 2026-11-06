// Backend task 2026-10-04, plan row W27 (contract C): the examples of areas 4 to 11 follow the real
// simulator. `src/api/state-examples.ts` holds the idle state of the example instant as plain data
// (the contract does not import the simulator); this file builds that state and compares.
import { describe, expect, it } from 'vitest';
import {
  CORE_API_EXAMPLES,
  CORE_API_OPERATIONS,
  CORE_API_SCHEMAS,
  EXAMPLE_ALERT,
  EXAMPLE_AUDIT,
  EXAMPLE_EVENTS,
  EXAMPLE_EVIDENCE_ITEM,
  EXAMPLE_IDS,
  EXAMPLE_SESSION_HISTORY,
  EXAMPLE_SLICES,
  LIST_CURSOR_PATTERN,
  REPLICATED_SLICE_SCHEMAS,
  STATE_EXAMPLE_IDS,
  STATE_EXAMPLE_SERIES_POINTS,
  coreApiAccessPermissions,
  findCoreApiOperation,
  type AuditChainStatus,
  type AuditExportAccepted,
  type AuditPage,
  type CaseNumberScan,
  type DiagnosticsRunStarted,
  type EvidenceDetail,
  type EvidenceVerifyResultBody,
  type ReplicatedSliceName,
  type ServicesRestarted,
  type SessionHistoryPage,
} from '../src/api';
import { EXAMPLE_INSTANT_MS } from '../src/api/example-parts';
import { demoIdSuffix, getDemoEvidencePackage } from '../src/demo-data';
import {
  DEFAULT_SEED,
  DEMO_OPERATOR_PASSWORD,
  OperatorRole,
  ROLE_PERMISSIONS,
  createIdleState,
  createManualClock,
  createSim,
  verifyAuditChain,
  type Permission,
  type SimState,
} from '../src/sim';

const AT = EXAMPLE_INSTANT_MS;
const idle = (): SimState => createIdleState({ now: AT, seed: DEFAULT_SEED });
const newest = <T,>(list: readonly T[]): T[] => list.slice(-STATE_EXAMPLE_SERIES_POINTS);

function example<T>(operationId: string, status: number, name: string): T {
  const found = CORE_API_EXAMPLES[operationId]?.responses[status]?.[name];
  expect(found, `${operationId} ${status} ${name}`).toBeDefined();
  return found!.value as T;
}

function rig(username?: string) {
  const clock = createManualClock(AT);
  const sim = createSim({ clock, storage: null, authStorage: null, scenario: 'idle' });
  if (username) expect(sim.actions.signIn(username, DEMO_OPERATOR_PASSWORD)).toMatchObject({ ok: true });
  return { actions: sim.actions, state: () => sim.store.getState() };
}

describe('the example slices are the idle simulator\'s at the example instant', () => {
  it('eighteen slices equal the state, with the four long series cut to their newest points', () => {
    const state = idle();
    expect(STATE_EXAMPLE_SERIES_POINTS).toBe(2);
    // What the simulator holds, with the same cut the examples document.
    const expected: Record<string, unknown> = {
      device: state.device,
      tabletLink: state.tabletLink,
      activeCameraId: state.activeCameraId,
      cameras: state.cameras,
      mics: state.mics,
      otherDevices: state.otherDevices,
      ports: state.ports,
      storage: { ...state.storage, history: newest(state.storage.history), writeRateHistory: newest(state.storage.writeRateHistory ?? []) },
      storagePolicy: state.storagePolicy,
      time: { ...state.time, history: newest(state.time.history) },
      network: { ...state.network, bandwidth: { ...state.network.bandwidth, history: newest(state.network.bandwidth.history) } },
      security: state.security,
      services: state.services,
      update: state.update,
      diagnostics: state.diagnostics,
      settings: state.settings,
      // Task 3 M2-W6 (SH-16): the two capture slices ops 76/77 answer.
      captureConfig: state.captureConfig,
      captureDevices: state.captureDevices,
    };
    expect(Object.keys(EXAMPLE_SLICES)).toEqual(Object.keys(expected));
    for (const [name, value] of Object.entries(expected)) {
      expect(EXAMPLE_SLICES[name as keyof typeof EXAMPLE_SLICES], name).toEqual(value);
      // And each parses with the schema of its slice.
      const schema = REPLICATED_SLICE_SCHEMAS[name as ReplicatedSliceName];
      expect(schema.safeParse(EXAMPLE_SLICES[name as keyof typeof EXAMPLE_SLICES]).success, name).toBe(true);
    }
    // The cut left real series out: the state holds more points than an example shows.
    expect(state.time.history.length).toBeGreaterThan(STATE_EXAMPLE_SERIES_POINTS);
    expect(state.network.bandwidth.history.length).toBeGreaterThan(STATE_EXAMPLE_SERIES_POINTS);
    expect(state.storage.history.length).toBeGreaterThan(STATE_EXAMPLE_SERIES_POINTS);
  });

  it('the history entries, the evidence item, the audit rows and the events are the dataset\'s', () => {
    const state = idle();
    expect(EXAMPLE_SESSION_HISTORY).toEqual(state.sessionHistory.slice(0, 2));
    expect(EXAMPLE_EVIDENCE_ITEM).toEqual(state.evidence.find((item) => item.id === STATE_EXAMPLE_IDS.evidenceId));
    expect(EXAMPLE_AUDIT).toEqual({ rows: newest(state.audit.rows), head: state.audit.head, total: state.audit.total });
    expect(EXAMPLE_EVENTS).toEqual(newest(state.events));
    // The two audit rows are a real end of the chain: linked, and the last one is the head.
    expect(EXAMPLE_AUDIT.rows[1]?.prevHash).toBe(EXAMPLE_AUDIT.rows[0]?.hash);
    expect(EXAMPLE_AUDIT.rows[1]?.hash).toBe(EXAMPLE_AUDIT.head);
    expect(EXAMPLE_AUDIT.rows[1]?.seq).toBe(EXAMPLE_AUDIT.total);
    expect(verifyAuditChain({ rows: EXAMPLE_AUDIT.rows, head: EXAMPLE_AUDIT.head, total: EXAMPLE_AUDIT.total, dropped: EXAMPLE_AUDIT.total - 2 })).toMatchObject({ ok: true });
  });

  it('the alert is the one the simulator raises for MIC_NO_SIGNAL on AUDIO-02', () => {
    const { actions, state } = rig();
    expect(state().alerts).toEqual([]);
    actions.inject('MIC_NO_SIGNAL', { channel: 'AUDIO-02' });
    expect(state().alerts).toEqual([EXAMPLE_ALERT]);
    expect(EXAMPLE_ALERT.id).toBe(STATE_EXAMPLE_IDS.alertId);
  });

  it('the identifiers are those of the canonical dataset', () => {
    expect(STATE_EXAMPLE_IDS.openSessionId).toBe(EXAMPLE_IDS.recordingSessionId);
    expect(STATE_EXAMPLE_IDS.evidenceId).toBe(EXAMPLE_IDS.exportedEvidenceId);
    expect(STATE_EXAMPLE_IDS.recordedEvidenceId).toBe(EXAMPLE_IDS.recordedEvidenceId);
    const state = idle();
    const statusOf = (id: string) => state.evidence.find((item) => item.id === id);
    expect(statusOf(STATE_EXAMPLE_IDS.evidenceId)?.status).toBe('EXPORTED');
    expect(statusOf(STATE_EXAMPLE_IDS.tamperedEvidenceId)?.tampered).toBe(true);
    expect(statusOf(STATE_EXAMPLE_IDS.recordedEvidenceId)?.status).toBe('RECORDED');
    expect(statusOf(STATE_EXAMPLE_IDS.unknownEvidenceId)).toBeUndefined();
    const devices = [...state.cameras.map((camera) => camera.deviceId), ...state.mics.map((mic) => mic.deviceId)];
    expect(devices).toContain(STATE_EXAMPLE_IDS.cameraDeviceId);
    expect(devices).toContain(STATE_EXAMPLE_IDS.micDeviceId);
    expect(devices).not.toContain(STATE_EXAMPLE_IDS.unknownDeviceId);
  });
});

describe('the examples of the hosted actions are the simulator\'s answers at the example instant', () => {
  it('verifyEvidence: the passed verdict of EV-20260930-0004 and the failed one of EV-20260930-0005', () => {
    const { actions } = rig();
    expect(example<EvidenceVerifyResultBody>('verifyEvidence', 200, 'passed')).toEqual(actions.verify(STATE_EXAMPLE_IDS.evidenceId));
    expect(example<EvidenceVerifyResultBody>('verifyEvidence', 200, 'failed')).toEqual(actions.verify(STATE_EXAMPLE_IDS.tamperedEvidenceId));
  });

  it('getEvidence: the media reference is the shared join of the demo packages', () => {
    const detail = example<EvidenceDetail>('getEvidence', 200, 'withPackage');
    expect(detail.evidence.integritySource).toBe('DEMO_PACKAGE');
    expect(detail.media).toEqual({ source: 'DEMO_PACKAGE', packageSuffix: demoIdSuffix(detail.evidence.id, 'EV') });
    expect(getDemoEvidencePackage(detail.media.packageSuffix ?? '')).not.toBeNull();
  });

  it('verifyAuditChain: the intact chain, and the view the demo fault AUDIT_TAMPER breaks', () => {
    const { actions, state } = rig();
    const intact = example<AuditChainStatus>('verifyAuditChain', 200, 'intact');
    expect(intact.view).toEqual(actions.verifyAuditChain());
    expect(intact.stored).toEqual({ ok: true, checked: state().audit.total, head: state().audit.head, firstBadSeq: null });
    expect([intact.lineage, intact.lineageTotal]).toEqual([[], 0]);
    actions.inject('AUDIT_TAMPER');
    const tampered = example<AuditChainStatus>('verifyAuditChain', 200, 'viewTampered');
    expect(tampered.view).toEqual(actions.verifyAuditChain());
    // The stored chain is not what the fault alters.
    expect(tampered.stored).toEqual(intact.stored);
    expect(tampered.lineage).toHaveLength(tampered.lineageTotal);
  });

  it('the exports, the case number, the diagnostics run and the restart', () => {
    // The exports and the audit page show the chain as the idle state holds it at the example instant.
    const chain = idle().audit;
    const audit = example<AuditExportAccepted>('exportAudit', 202, 'accepted');
    expect([audit.scope, audit.rows, audit.head]).toEqual(['AUDIT', chain.rows.length, chain.head]);
    expect(example<AuditExportAccepted>('exportLogs', 202, 'accepted').scope).toBe('LOGS');
    const page = example<AuditPage>('listAuditRows', 200, 'newest');
    expect([page.head, page.total, page.nextCursor]).toEqual([chain.head, chain.total, null]);

    const investigator = rig('budi.santoso');
    expect(example<CaseNumberScan>('scanCaseNumber', 200, 'next').caseNumber).toBe(investigator.actions.scanCaseNumber());

    const technician = rig('rina.wijaya');
    // The first item the idle state mints: `DIAG-000001`.
    expect(example<DiagnosticsRunStarted>('runDiagnostics', 202, 'started').runId).toBe(technician.actions.runDiagnostics());
    expect(example<ServicesRestarted>('restartServices', 200, 'restarted').restarted).toBe(technician.actions.restartServices());
  });

  it('a cursor in an example has the form of a cursor', () => {
    const history = example<SessionHistoryPage>('listSessionHistory', 200, 'newest');
    expect(history.nextCursor).toMatch(LIST_CURSOR_PATTERN);
    expect(history.items).toEqual(EXAMPLE_SESSION_HISTORY);
    expect(example<SessionHistoryPage>('listSessionHistory', 200, 'last')).toEqual({ items: [], nextCursor: null });
  });
});

describe('the examples of all 99 operations', () => {
  it('every operation has an example for every status with a body, and for no status it does not document', () => {
    let pairs = 0;
    let requests = 0;
    for (const operation of CORE_API_OPERATIONS) {
      const examples = CORE_API_EXAMPLES[operation.operationId];
      expect(examples, operation.operationId).toBeDefined();
      for (const [status, spec] of Object.entries(operation.responses)) {
        const named = Object.values(examples?.responses[Number(status)] ?? {});
        if (!spec.schema) {
          expect(named, `${operation.operationId} ${status}`).toEqual([]);
          continue;
        }
        expect(named.length, `${operation.operationId} ${status}`).toBeGreaterThan(0);
        for (const item of named) expect(CORE_API_SCHEMAS[spec.schema].safeParse(item.value).success, `${operation.operationId} ${status} ${item.summary}`).toBe(true);
        pairs += 1;
      }
      for (const status of Object.keys(examples?.responses ?? {})) expect(operation.responses[Number(status)], `${operation.operationId} ${status}`).toBeDefined();
      expect(Object.keys(examples?.request ?? {}).length > 0, `${operation.operationId} request`).toBe(operation.requestBody !== undefined);
      // EVERY named request example is a body of the operation (suite consolidation 14: the typed-client
      // loops send only the first one, so the others - and with them the request halves of the exported
      // area maps `IDENTITY_EXAMPLES` .. `STT_CONFIG_EXAMPLES` - were parsed by no test).
      for (const [name, item] of Object.entries(examples?.request ?? {})) {
        const body = operation.requestBody;
        expect(body !== undefined && CORE_API_SCHEMAS[body.schema].safeParse(item.value).success, `${operation.operationId} request ${name}`).toBe(true);
        requests += 1;
      }
      expect(examples?.pathParams !== undefined, `${operation.operationId} path`).toBe(operation.pathParam !== undefined);
      if (operation.pathParam) expect(examples?.pathParams?.id, operation.operationId).toMatch(operation.pathParam.pattern);
    }
    // No example set stands outside the registry: a key that names no operation would be validated by no loop.
    expect(Object.keys(CORE_API_EXAMPLES).sort()).toEqual(CORE_API_OPERATIONS.map((operation) => operation.operationId).sort());
    expect(requests).toBeGreaterThanOrEqual(CORE_API_OPERATIONS.filter((operation) => operation.requestBody).length);
    // One example set for every (operation, status with a schema) pair of the registry.
    expect(pairs).toBe(CORE_API_OPERATIONS.reduce((sum, operation) => sum + Object.values(operation.responses).filter((spec) => spec.schema).length, 0));
    expect(pairs).toBeGreaterThan(300);
  });

  it('a refusal for a missing permission names a role that lacks it, by the seeded matrix', () => {
    let checked = 0;
    for (const operation of CORE_API_OPERATIONS) {
      const denied = CORE_API_EXAMPLES[operation.operationId]?.responses[403]?.notPermitted?.value as { error: { details?: Record<string, unknown> } } | undefined;
      const details = denied?.error.details;
      if (!details || typeof details.role !== 'string') continue;
      const needed = coreApiAccessPermissions(findCoreApiOperation(operation.operationId)!.access);
      expect(needed.length, operation.operationId).toBeGreaterThan(0);
      expect(Object.values(OperatorRole) as string[], operation.operationId).toContain(details.role);
      const held = ROLE_PERMISSIONS[details.role as OperatorRole] as readonly Permission[];
      for (const permission of needed) expect(held, `${operation.operationId}: ${details.role} holds ${permission}`).not.toContain(permission);
      expect(details.operationId, operation.operationId).toBe(operation.operationId);
      checked += 1;
    }
    expect(checked).toBeGreaterThan(30);
    // EVIDENCE_VIEW and DIAGNOSTICS_RUN are held by every seeded role, so their operations show no such refusal.
    for (const operationId of ['listEvidence', 'getEvidence', 'verifyEvidence', 'testDeviceSignal', 'identifyDevice', 'runDiagnostics']) {
      expect(CORE_API_EXAMPLES[operationId]?.responses[403]?.notPermitted, operationId).toBeUndefined();
      const [permission] = coreApiAccessPermissions(findCoreApiOperation(operationId)!.access);
      for (const role of Object.values(OperatorRole)) expect(ROLE_PERMISSIONS[role] as readonly Permission[], `${role} ${permission}`).toContain(permission);
    }
  });

  it('an example of a refusal the engine raised carries the simulator code, and the HTTP code 01_specs §7.2 maps it to', () => {
    // `[simCode, status, code]` of the mapping table of 01_specs §7.2.
    const MAPPING: Record<string, [number, string]> = {
      NOT_FOUND: [404, 'NOT_FOUND'],
      ILLEGAL_STATE: [409, 'INVALID_STATE'],
      NO_WARNINGS: [409, 'INVALID_STATE'],
      CHECKS_RUNNING: [409, 'PRECHECK_RUNNING'],
      SESSION_ACTIVE: [409, 'SESSION_ACTIVE'],
      RECORDING_ACTIVE: [409, 'RECORDING_ACTIVE'],
      COMMAND_UNSUPPORTED: [409, 'COMMAND_UNSUPPORTED'],
      UNSEALED_EVIDENCE: [409, 'NOT_SEALED'],
      REASON_TOO_SHORT: [422, 'INVALID_REASON'],
      // Task 3 M2-W7 (C3 §4): the capture-phase codes the simulator emulates repeat the machine code
      // in details.simCode for parity; every one is a 409. These are the codes that actually appear
      // in an example (CAMERA_NOT_LOST and EXPORT_IN_PROGRESS have no example row, so they stay out).
      CAPTURE_CONFIG_LOCKED: [409, 'CAPTURE_CONFIG_LOCKED'],
      // Audit row 149 (D130, R149-2): AUDIO_SOURCE_CONFLICT left with op 81's `conflict` example - op 81 answers only
      // 409 AUDIO_SOURCE_FIXED_BY_PAIRING (no simCode), so no example carries the code any more.
      TRANSCRIPT_NOT_READY: [409, 'TRANSCRIPT_NOT_READY'],
      TRANSCRIPT_REVISION_CONFLICT: [409, 'TRANSCRIPT_REVISION_CONFLICT'],
      MEDIA_NOT_AVAILABLE: [409, 'MEDIA_NOT_AVAILABLE'],
    };
    const seen = new Set<string>();
    for (const [operationId, examples] of Object.entries(CORE_API_EXAMPLES)) {
      for (const [status, named] of Object.entries(examples.responses)) {
        for (const item of Object.values(named)) {
          const error = (item.value as { error?: { code: string; details?: Record<string, unknown> } }).error;
          const simCode = error?.details?.simCode;
          if (typeof simCode !== 'string') continue;
          expect(MAPPING[simCode], `${operationId}: ${simCode}`).toEqual([Number(status), error?.code]);
          seen.add(simCode);
        }
      }
    }
    expect([...seen].sort()).toEqual(Object.keys(MAPPING).sort());
  });
});
