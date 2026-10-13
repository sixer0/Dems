// Plan row W44 (HB-14), the 45 action bindings and error rebuilding: 04_client_integration_spec
// §2.5 ("The 42 action bindings", CL-19 to CL-22); 01_specs §7.2, §7.17; AC-C-11. Task 3 register
// SH-18 adds the three INTERNAL capture actions: 42 -> 45, and (blueprint row 66) the hosted pair
// `setCaptureConfig` / `switchAudioSource`: 45 -> 47; task 3 R-9 (row 132) adds the INTERNAL
// `registerCaptureDevice`: 47 -> 48.
//
// The table tests are driven by the contract's own data, `SIM_ACTION_OPERATIONS`: every member of
// `SimActions` is planned once, and the request it plans is checked against the registry (the
// operation the table names, its method, its path parameter, its body schema). A 46th action, a
// renamed operation or a body the contract refuses fails here.
import { afterEach, describe, expect, it } from 'vitest';
import {
  API_ERROR_CODES,
  ApiErrorCode,
  CORE_API_EXAMPLES,
  CORE_API_OPERATIONS,
  CORE_API_SCHEMAS,
  EXPORT_ACCEPTED_NO_ARCHIVE_EXAMPLE,
  SIM_ACTION_OPERATIONS,
  SimActionExecution,
  pickReplicatedState,
  simActionsOfOperation,
  type CoreApiSchemaName,
  type ReplicatedState,
  type SimActionName,
} from '../src/api';
import { createCoreClient, type CoreCallFailure } from '../src/client';
import {
  CoreRefusalError,
  LiveTransportError,
  SimNotFoundError as LiveSimNotFoundError,
  SimPermissionError as LiveSimPermissionError,
  SimTransitionError as LiveSimTransitionError,
} from '../src/live';
import {
  CAPTURE_CONFIG_CHANGE_OPERATION_INDEX,
  DEVICE_COMMAND_OPERATION_INDEX,
  ENVELOPE_SIM_CODE,
  EXPORT_IN_PROGRESS_REASON,
  LIVE_BINDINGS,
  LIVE_BINDING_NAMES,
  LIVE_SESSION_OPERATION,
  LIVE_SIGN_IN_STATUS_OPERATION,
  LiveActionFlow,
  createLiveSim,
  envelopeSimCodeOf,
  isRefusal,
  operationOf,
  permissionLabelOf,
  rebuildRefusal,
  transportErrorOf,
  type BindingExtras,
  type BindingPlan,
  type BindingView,
  type LiveBinding,
  type LiveSim,
} from '../src/live/source';
import { FAKE_CREDENTIALS, createFakeTransport, notReady, rateLimited, refusal, type FakeTransport } from '../src/live/testing';
import {
  DEFAULT_SEED,
  DEMO_OPERATOR_PASSWORD,
  SimErrorCode,
  SimNotFoundError,
  SimPermissionError,
  SimTransitionError,
  createIdleState,
  createManualClock,
  createSim,
  simErrorCode,
  type SimActions,
  type SimErrorReport,
  type SimState,
} from '../src/sim';
import { createFakeClock } from '../src/live/testing';

type AnyBinding = LiveBinding<readonly unknown[], unknown>;
type CallPlan = Extract<BindingPlan<unknown>, { kind: 'call' }>;

const BASE_URL = 'http://127.0.0.1:4420';
const SOCKET_URL = 'ws://127.0.0.1:4420/ws';
const NOW = createFakeClock().now();

const examplePathId = (operationId: string): string => {
  const id = CORE_API_EXAMPLES[operationId]?.pathParams?.id;
  if (!id) throw new Error(`${operationId} has no example path parameter`);
  return id;
};

/** One valid call of every member of `SimActions`. Typed by the simulator: a 46th member does not compile until it has a line. */
const ARGS: { readonly [Name in keyof SimActions]: Parameters<SimActions[Name]> } = {
  signIn: ['andi.pratama', 'not-a-real-password'],
  signInWithBiometric: ['OPR-002'],
  recordBiometricFailure: ['OPR-002'],
  signInWithSecurityKey: [],
  signOut: ['LOCK'],
  touch: [],
  createSession: [
    { caseNumber: 'LP/2026/1001-0042', subjectType: 'SAKSI', subjectName: 'Synthetic Witness', investigatorId: 'OPR-001', room: 'Interview Room 1', profileId: 'STANDARD_1080P25', notes: 'Follow-up interview' },
  ],
  beginPrecheck: [],
  acknowledgePrecheckWarnings: [],
  retryPrecheck: [],
  startRecording: [],
  stopRecording: ['Interview complete'],
  cancel: [],
  scanCaseNumber: [],
  recover: [],
  addMarker: ['Key statement'],
  addNote: ['Subject confirms the timeline.'],
  snapshot: [],
  acknowledgeSummary: [examplePathId('acknowledgeSessionSummary')],
  verify: [examplePathId('verifyEvidence')],
  exportEvidence: [examplePathId('exportEvidence'), { reason: 'Prosecutor review', destination: 'Case file transfer' }],
  archiveEvidence: [examplePathId('archiveEvidence')],
  exportAudit: [{ reason: 'Monthly audit review' }],
  exportLogs: [{ reason: 'Monthly audit review', destination: 'Audit archive' }],
  verifyAuditChain: [],
  inject: ['MIC_CLIP', { channel: 'AUDIO-02' }],
  clearFault: ['MIC_CLIP'],
  resetClip: ['AUDIO-02'],
  acknowledgeAlert: [examplePathId('acknowledgeAlert')],
  loadScenario: ['recording'],
  resetDemo: [],
  runDiagnostics: [],
  deviceCommand: [examplePathId('restartDevice'), 'RESTART'],
  setStoragePolicy: [{ retentionPolicy: 'DAYS_30', autoArchive: false }],
  startSoftwareUpdate: [],
  restartServices: [],
  setActiveCamera: ['VIDEO-02'],
  setPresentationMode: [true],
  updateSettings: [{ timeFormat: '12', notifySound: true }],
  pair: ['123456'],
  unpair: [],
  setTabletLink: ['CONNECTED'],
  applyCaptureTelemetry: [
    {
      levels: [{ role: 'PRIMARY', dbfs: -18, clipped: false }, { role: 'STANDBY', dbfs: null, clipped: false }],
      ingest: [{ deviceId: 'CAM-01', state: 'WAITING' }],
      fragments: [{ deviceId: 'CAM-01', count: 3, bytes: 4096 }],
    },
  ],
  raiseCaptureWarning: [{ code: 'MIC_SILENT', subject: 'PRIMARY' }],
  clearCaptureWarning: [{ code: 'MIC_SILENT', subject: 'PRIMARY' }],
  setCaptureConfig: [{ kind: 'CAMERA_SOURCE', deviceId: 'CAM-02', trackId: 'VIDEO-01' }],
  switchAudioSource: ['MIC-02'],
  registerCaptureDevice: [{ id: 'CAM-03', model: 'Test source', host: '127.0.0.1', adapter: 'FAKE' }],
  // Pass D6 (CS-09): INTERNAL, bound LOCAL.
  applyStorageVolume: [{ totalBytes: 500_000_000_000, freeBytes: 40_000_000_000 }],
  // Task 4 row 185: INTERNAL, bound LOCAL.
  registerCaptureMicrophone: [{ deviceId: null, model: 'USB Audio CODEC' }],
};

/** A real state with a session that is ARMED: one engine, from sign-in through the pre-check. */
function armedState(): SimState {
  const clock = createManualClock(NOW);
  const sim = createSim({ clock, storage: null, authStorage: null, seed: DEFAULT_SEED });
  expect(sim.actions.signIn('andi.pratama', DEMO_OPERATOR_PASSWORD)).toMatchObject({ ok: true });
  expect(sim.actions.createSession(ARGS.createSession[0])).toMatchObject({ ok: true });
  sim.actions.beginPrecheck();
  for (let step = 0; step < 200 && sim.store.getState().session?.precheck.outcome === null; step += 1) {
    clock.advance(50);
    sim.tick();
  }
  if (sim.store.getState().session?.precheck.outcome === 'WARN') sim.actions.acknowledgePrecheckWarnings();
  const state = sim.store.getState();
  expect(state.session?.state).toBe('ARMED');
  return state;
}

const ARMED = armedState();
const UNPAIRED: SimState = { ...ARMED, pairing: { ...ARMED.pairing, state: 'UNPAIRED', pairedAt: null } };
const EXTRAS: BindingExtras = {
  biometricToken: FAKE_CREDENTIALS.biometricToken,
  device: { deviceName: 'Pixel Tablet', platform: 'android', appVersion: '0.2.0' },
};

/** The plan of an action for a state in which it reaches its operation. */
function planOf(name: SimActionName, args: readonly unknown[] = ARGS[name]): BindingPlan<unknown> {
  const view: BindingView = { state: name === 'pair' ? UNPAIRED : ARMED, now: NOW };
  return (LIVE_BINDINGS[name] as unknown as AnyBinding).plan(args, view, EXTRAS);
}

const registryOperation = (operationId: string) => {
  const operation = CORE_API_OPERATIONS.find((candidate) => candidate.operationId === operationId);
  if (!operation) throw new Error(`the registry has no operation "${operationId}"`);
  return operation;
};

/** Checks one planned request against the registry: the parameter, the body, and nothing the operation does not take. */
function expectContractRequest(name: string, plan: CallPlan): void {
  const operation = registryOperation(plan.operationId);
  const { params, body, query } = plan.input;
  expect(query, `${name}: no query`).toBeUndefined();
  if (operation.pathParam) {
    expect(Object.keys(params ?? {}), `${name}: the path parameter`).toEqual([operation.pathParam.name]);
    expect(params?.[operation.pathParam.name], `${name}: the path parameter matches its pattern`).toMatch(operation.pathParam.pattern);
    expect(plan.entity, `${name}: a 404 can name its entity`).toMatchObject({ id: params?.[operation.pathParam.name] });
  } else {
    expect(params, `${name}: no path parameter`).toBeUndefined();
  }
  if (!operation.requestBody) {
    expect(body, `${name}: no body`).toBeUndefined();
    return;
  }
  if (operation.requestBody.required) expect(body, `${name}: the body is required`).toBeDefined();
  if (body !== undefined) {
    const parsed = CORE_API_SCHEMAS[operation.requestBody.schema as CoreApiSchemaName].safeParse(body);
    expect(parsed.success, `${name}: the body parses with ${operation.requestBody.schema}`).toBe(true);
  }
}

describe('the 50 bindings, driven by SIM_ACTION_OPERATIONS (01_specs §7.17; pass D6 CS-09: applyStorageVolume, 48 -> 49; task 4 row 185: registerCaptureMicrophone, 49 -> 50)', () => {
  it('has one binding per member of SimActions: the keys of the contract table, of the bindings and of a real simulator are equal', () => {
    const sim = createSim({ clock: createManualClock(NOW), storage: null, authStorage: null });
    const simulator = Object.keys(sim.actions).sort();
    expect(simulator).toHaveLength(50);
    expect([...LIVE_BINDING_NAMES].sort()).toEqual(simulator);
    expect(Object.keys(SIM_ACTION_OPERATIONS).sort()).toEqual(simulator);
    expect(Object.keys(ARGS).sort()).toEqual(simulator);
    // In the order of `SimActions`, as the contract table is.
    expect(LIVE_BINDING_NAMES).toEqual(Object.keys(SIM_ACTION_OPERATIONS));
  });

  it('the flows: 35 commands, 1 read, 2 sign-ins, sign-out, touch, pair, unpair, 8 local', () => {
    const count = (flow: string) => LIVE_BINDING_NAMES.filter((name) => LIVE_BINDINGS[name].flow === flow);
    expect(count(LiveActionFlow.COMMAND)).toHaveLength(35);
    expect(count(LiveActionFlow.READ)).toEqual(['verifyAuditChain']);
    expect(count(LiveActionFlow.SIGN_IN)).toEqual(['signIn', 'signInWithBiometric']);
    expect(count(LiveActionFlow.SIGN_OUT)).toEqual(['signOut']);
    expect(count(LiveActionFlow.TOUCH)).toEqual(['touch']);
    expect(count(LiveActionFlow.PAIR)).toEqual(['pair']);
    expect(count(LiveActionFlow.UNPAIR)).toEqual(['unpair']);
    expect(count(LiveActionFlow.LOCAL)).toEqual(['signInWithSecurityKey', 'setTabletLink', 'applyCaptureTelemetry', 'raiseCaptureWarning', 'clearCaptureWarning', 'applyStorageVolume', 'registerCaptureDevice', 'registerCaptureMicrophone']);
    expect(Object.values(LiveActionFlow)).toHaveLength(8);
  });

  it.each(LIVE_BINDING_NAMES.map((name) => [name] as const))('%s calls the operation the contract table names, with a request the contract accepts', (name) => {
    const entry = SIM_ACTION_OPERATIONS[name];
    const operations: readonly string[] = entry.operations;
    const binding = LIVE_BINDINGS[name];
    const plan = planOf(name);

    if (operations.length === 0) {
      // X-1 and X-2: no operation exists in Live mode, so no request is ever planned.
      expect(binding.flow).toBe(LiveActionFlow.LOCAL);
      expect(plan.kind).not.toBe('call');
      expect([SimActionExecution.NOT_AVAILABLE, SimActionExecution.INTERNAL]).toContain(entry.execution);
      return;
    }
    expect(plan.kind, `${name} plans a request`).toBe('call');
    const request = plan as CallPlan;
    expect(operations).toContain(request.operationId);
    expect(simActionsOfOperation(request.operationId)).toContain(name);
    const operation = registryOperation(request.operationId);
    expect(operation.method).toBe(binding.flow === LiveActionFlow.READ ? 'get' : 'post');
    expectContractRequest(name, request);
    // A binding takes its operation ID from the table, never from a literal of its own.
    expect(operationOf(name, operations.indexOf(request.operationId))).toBe(request.operationId);
  });

  it('together the bindings reach the 45 operations of the table, and no other', () => {
    const reached = new Set<string>();
    // Blueprint row 66: `setCaptureConfig` is three operations too, one per kind of change.
    const selectorChanges: (readonly unknown[])[] = [
      [{ kind: 'UPDATE', mics: [{ inputId: 'MIC-01', deviceId: 'MIC-01' }] }],
      [{ kind: 'CAMERA_SOURCE', deviceId: 'CAM-02', trackId: 'VIDEO-01' }],
      [{ kind: 'PRIMARY_MIC', inputId: 'MIC-02' }],
    ];
    for (const name of LIVE_BINDING_NAMES) {
      const variants: (readonly unknown[])[] =
        name === 'deviceCommand' ? ['RESTART', 'TEST_SIGNAL', 'IDENTIFY'].map((command) => [ARGS.deviceCommand[0], command]) : name === 'setCaptureConfig' ? selectorChanges : [ARGS[name]];
      for (const args of variants) {
        const plan = planOf(name, args);
        if (plan.kind === 'call') reached.add(plan.operationId);
      }
    }
    const named = new Set(Object.values(SIM_ACTION_OPERATIONS).flatMap((entry) => [...entry.operations]));
    expect([...reached].sort()).toEqual([...named].sort());
    expect(reached.size).toBe(45);
    // The two reads of the bootstrap stand for no action; they are operations of the registry.
    for (const operationId of [LIVE_SESSION_OPERATION, LIVE_SIGN_IN_STATUS_OPERATION]) {
      expect(registryOperation(operationId).method).toBe('get');
      expect(simActionsOfOperation(operationId)).toEqual([]);
    }
  });

  it('deviceCommand picks operation 48, 49 or 50 by its command, and refuses a command that is none of them', () => {
    // Task 3 M2-W7 (E-12; C3 §0): POE_CYCLE joins the enum and rides operation 48 (`/restart`), the
    // same endpoint as RESTART; op 48 decides the cycle from the body + stream state (C3 §3 op 48).
    const paths = { RESTART: '/restart', TEST_SIGNAL: '/test-signal', IDENTIFY: '/identify', POE_CYCLE: '/restart' } as const;
    expect(Object.keys(DEVICE_COMMAND_OPERATION_INDEX).sort()).toEqual(Object.keys(paths).sort());
    for (const [command, suffix] of Object.entries(paths)) {
      const plan = planOf('deviceCommand', ['CAM-01', command]) as CallPlan;
      expect(registryOperation(plan.operationId).path.endsWith(suffix), `${command} → ${plan.operationId}`).toBe(true);
      // Task 3, decision D100 (2) (C3 §3 op 48; OD-22): the PoE cycle — and only it — carries the
      // operator's confirmation; RESTART and the other two commands stay bodyless.
      expect(plan.input).toEqual(command === 'POE_CYCLE' ? { params: { id: 'CAM-01' }, body: { confirm: true } } : { params: { id: 'CAM-01' } });
      expect(plan.entity).toEqual({ kind: 'device', id: 'CAM-01' });
    }
    const unknown = planOf('deviceCommand', ['CAM-01', 'SELF_DESTRUCT']);
    expect(unknown).toMatchObject({ kind: 'reject', error: { name: 'SimTransitionError', code: 'COMMAND_UNSUPPORTED', event: 'deviceCommand' } });
  });

  it('the input travels as the caller gave it: nothing is trimmed, cut or defaulted beyond what the simulator defaults', () => {
    const sessionId = ARMED.session?.id;
    expect(planOf('signIn')).toMatchObject({ operationId: 'signIn', input: { body: { username: 'andi.pratama', password: 'not-a-real-password' } } });
    expect(planOf('signInWithBiometric')).toMatchObject({ input: { body: { token: FAKE_CREDENTIALS.biometricToken } } });
    expect(planOf('recordBiometricFailure', [null])).toMatchObject({ input: { body: { operatorId: null } } });
    expect(planOf('signOut', [])).toMatchObject({ input: { body: { reason: 'USER' } } });
    expect(planOf('signOut', ['LOCK'])).toMatchObject({ input: { body: { reason: 'LOCK' } } });
    expect(planOf('stopRecording', ['  Interview complete  '])).toMatchObject({ input: { params: { id: sessionId }, body: { reason: '  Interview complete  ' } } });
    expect(planOf('addMarker', [])).toMatchObject({ input: { params: { id: sessionId } } });
    expect((planOf('addMarker', []) as CallPlan).input.body).toBeUndefined();
    const long = 'x'.repeat(200);
    expect(planOf('addMarker', [long])).toMatchObject({ input: { body: { label: long } } });
    expect(planOf('exportEvidence', ['EV-20260930-0004', { reason: 'Prosecutor review', destination: long }])).toMatchObject({ input: { body: { reason: 'Prosecutor review', destination: long } } });
    // The export reason is mandatory in Live mode: the body always travels, also for the form without a request.
    expect(planOf('exportAudit', [])).toMatchObject({ input: { body: { reason: '' } } });
    expect(planOf('exportLogs', [{ reason: 'Monthly audit review' }])).toMatchObject({ input: { body: { reason: 'Monthly audit review' } } });
    expect(planOf('setPresentationMode', [false])).toMatchObject({ operationId: 'updateSettings', input: { body: { presentationMode: false } } });
    expect(planOf('updateSettings', [{ notifyWarnings: false }])).toMatchObject({ operationId: 'updateSettings', input: { body: { notifyWarnings: false } } });
    expect(planOf('inject', ['TAMPER', { evidenceId: 'EV-20260930-0004' }])).toMatchObject({
      input: { body: { kind: 'TAMPER', target: { evidenceId: 'EV-20260930-0004' } } },
      entity: { kind: 'evidence', id: 'EV-20260930-0004' },
    });
    expect((planOf('inject', ['GNSS_LOSS']) as CallPlan).input.body).toEqual({ kind: 'GNSS_LOSS' });
    expect(planOf('pair')).toMatchObject({ input: { body: { code: '123456', deviceName: 'Pixel Tablet', platform: 'android', appVersion: '0.2.0' } } });
    // The one default the simulator applies itself: the device's room when the input has none.
    const { room: _room, ...withoutRoom } = ARGS.createSession[0];
    expect(planOf('createSession', [withoutRoom])).toMatchObject({ input: { body: { room: 'Interview Room 1', caseNumber: 'LP/2026/1001-0042' } } });
  });

  it('answers locally what the simulator answers without a state change, with the simulator\'s own error where it throws', () => {
    const idle: BindingView = { state: { ...ARMED, session: null }, now: NOW };
    const recording: BindingView = { state: { ...ARMED, session: ARMED.session ? { ...ARMED.session, state: 'RECORDING' } : null }, now: NOW };
    const plan = (name: SimActionName, view: BindingView, extras: BindingExtras = EXTRAS) =>
      (LIVE_BINDINGS[name] as unknown as AnyBinding).plan(ARGS[name], view, extras);

    // No open session: there is no ID to send. The simulator throws an illegal transition from "no session".
    for (const name of ['beginPrecheck', 'acknowledgePrecheckWarnings', 'retryPrecheck', 'startRecording', 'stopRecording', 'cancel', 'recover', 'addMarker', 'addNote', 'snapshot', 'switchAudioSource'] as const) {
      const refused = plan(name, idle);
      expect(refused, name).toMatchObject({ kind: 'reject', error: { name: 'SimTransitionError', code: 'ILLEGAL_STATE', from: null, event: name } });
      expect((refused as { error: unknown }).error).toBeInstanceOf(SimTransitionError);
    }
    // `startRecording` is the single step ARMED → RECORDING: from any other state it is refused before a request.
    expect(plan('startRecording', recording)).toMatchObject({ kind: 'reject', error: { name: 'SimTransitionError', from: 'RECORDING', event: 'startRecording' } });
    expect(plan('startRecording', { state: ARMED, now: NOW })).toMatchObject({ kind: 'call', operationId: 'startSession' });
    // No operation in Live mode.
    expect(plan('signInWithSecurityKey', idle)).toMatchObject({ kind: 'reject', error: { name: 'CoreRefusalError', code: 'NOT_AVAILABLE' } });
    expect(plan('setTabletLink', idle)).toEqual({ kind: 'resolve', value: undefined });
    // SH-18: the two capture actions are the server's own; a client's call resolves and sends nothing.
    expect(plan('applyCaptureTelemetry', idle)).toEqual({ kind: 'resolve', value: undefined });
    expect(plan('raiseCaptureWarning', idle)).toEqual({ kind: 'resolve', value: undefined });
    expect(plan('clearCaptureWarning', idle)).toEqual({ kind: 'resolve', value: undefined });
    // Without the app's ports the two mobile actions cannot run.
    expect(plan('signInWithBiometric', idle, {})).toMatchObject({ kind: 'reject', error: { name: 'CoreRefusalError', code: 'NOT_AVAILABLE' } });
    expect(plan('pair', { state: UNPAIRED, now: NOW }, {})).toMatchObject({ kind: 'reject', error: { name: 'CoreRefusalError', code: 'NOT_AVAILABLE' } });
    // What the simulator answers without a change.
    expect(plan('setActiveCamera', { state: { ...ARMED, activeCameraId: 'VIDEO-02' }, now: NOW })).toEqual({ kind: 'resolve', value: undefined });
    expect(plan('pair', { state: ARMED, now: NOW })).toEqual({ kind: 'resolve', value: { ok: true, pairedAt: ARMED.pairing.pairedAt } });
    expect(plan('unpair', { state: UNPAIRED, now: NOW })).toEqual({ kind: 'resolve', value: undefined });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════════════
// Error rebuilding
// ═══════════════════════════════════════════════════════════════════════════════════════

function failure(status: number | null, code: string, extra: Partial<CoreCallFailure> & { details?: Record<string, string | number | boolean | null> } = {}): CoreCallFailure {
  const { details, ...rest } = extra;
  return {
    ok: false,
    operationId: 'archiveEvidence',
    kind: 'CONFLICT',
    status,
    error: { code, message: 'This text is the server\'s and never becomes part of a client error.', ...(details ? { details } : {}) },
    retryAfterSeconds: null,
    transport: null,
    requestId: 'req-0042',
    ...rest,
  };
}

const CONTEXT = { action: 'archiveEvidence', operationId: 'archiveEvidence', entity: { kind: 'evidence', id: 'EV-20260930-0004' }, sessionState: 'RECORDING' } as const;

describe('AC-C-11: error rebuilding (CL-20, CL-21)', () => {
  it('401 NOT_SIGNED_IN and 403 NOT_PERMITTED become SimPermissionError, with the permission of the envelope or of the registry', () => {
    const denied = rebuildRefusal(failure(403, 'NOT_PERMITTED', { details: { permission: 'EVIDENCE_REVIEW', role: 'INVESTIGATOR' } }), CONTEXT);
    expect(denied).toBeInstanceOf(SimPermissionError);
    expect(denied).toBeInstanceOf(LiveSimPermissionError);
    expect(denied).toMatchObject({ name: 'SimPermissionError', action: 'archiveEvidence', permission: 'EVIDENCE_REVIEW', code: 'NOT_PERMITTED' });
    expect(simErrorCode(denied)).toBe(SimErrorCode.NOT_PERMITTED);

    // The envelope's permission wins over the registry's: for the any-of it names the one the guard decided on.
    const policy = { ...CONTEXT, action: 'setStoragePolicy', operationId: 'setStoragePolicy' };
    expect(rebuildRefusal(failure(403, 'NOT_PERMITTED', { details: { permission: 'MAINTENANCE' } }), policy)).toMatchObject({ permission: 'MAINTENANCE', code: 'NOT_PERMITTED' });
    expect(rebuildRefusal(failure(403, 'NOT_PERMITTED'), policy)).toMatchObject({ permission: 'EVIDENCE_REVIEW | MAINTENANCE' });
    // A `details.permission` that is not text is not taken.
    expect(rebuildRefusal(failure(403, 'NOT_PERMITTED', { details: { permission: 7 } }), policy)).toMatchObject({ permission: 'EVIDENCE_REVIEW | MAINTENANCE' });

    // No `details.permission`: the access rule of the operation names it.
    expect(rebuildRefusal(failure(403, 'NOT_PERMITTED'), CONTEXT)).toMatchObject({ permission: 'EVIDENCE_REVIEW', code: 'NOT_PERMITTED' });
    expect(rebuildRefusal(failure(403, 'FORBIDDEN'), { ...CONTEXT, operationId: 'exportEvidence' })).toMatchObject({ permission: 'EVIDENCE_EXPORT', code: 'NOT_PERMITTED' });
    const signedOut = rebuildRefusal(failure(401, 'NOT_SIGNED_IN'), { ...CONTEXT, action: 'setStoragePolicy', operationId: 'setStoragePolicy' });
    expect(signedOut).toBeInstanceOf(SimPermissionError);
    // The any-of, written as the simulator writes it.
    expect(signedOut).toMatchObject({ action: 'setStoragePolicy', permission: 'EVIDENCE_REVIEW | MAINTENANCE', code: 'NOT_SIGNED_IN' });
    expect(permissionLabelOf('acknowledgeAlert')).toBe('');
    expect(permissionLabelOf('no-such-operation')).toBe('');
  });

  it('404 becomes SimNotFoundError with the entity and the ID the binding sent', () => {
    const missing = rebuildRefusal(failure(404, 'NOT_FOUND', { details: { simCode: 'NOT_FOUND' } }), CONTEXT);
    expect(missing).toBeInstanceOf(SimNotFoundError);
    expect(missing).toBeInstanceOf(LiveSimNotFoundError);
    expect(missing).toMatchObject({ entity: 'evidence', entityId: 'EV-20260930-0004', code: 'NOT_FOUND' });
    // An action that named no entity (an unknown route would be the only 404): not a simulator error.
    expect(rebuildRefusal(failure(404, 'NOT_FOUND'), { ...CONTEXT, entity: null })).toBeInstanceOf(CoreRefusalError);
  });

  it.each([
    // status, envelope code, details, the code, from and event of the rebuilt SimTransitionError
    [409, 'INVALID_STATE', { simCode: 'ILLEGAL_STATE', from: 'STOPPING', event: 'addMarker' }, 'ILLEGAL_STATE', 'STOPPING', 'addMarker'],
    [409, 'INVALID_STATE', { simCode: 'NO_WARNINGS', from: 'PRECHECK', event: 'acknowledgePrecheckWarnings' }, 'NO_WARNINGS', 'PRECHECK', 'acknowledgePrecheckWarnings'],
    [409, 'PRECHECK_RUNNING', { simCode: 'CHECKS_RUNNING', from: 'PRECHECK', event: 'retryPrecheck' }, 'CHECKS_RUNNING', 'PRECHECK', 'retryPrecheck'],
    [409, 'NOT_SEALED', { simCode: 'UNSEALED_EVIDENCE', from: null, event: 'archiveEvidence' }, 'UNSEALED_EVIDENCE', null, 'archiveEvidence'],
    // Fix wave J (truth rule 3a): operation 41 for a never-sealed item - the Live source throws what the in-app simulator throws.
    [409, 'NOT_SEALED', { simCode: 'UNSEALED_EVIDENCE', from: null, event: 'verify' }, 'UNSEALED_EVIDENCE', null, 'verify'],
    // Fix wave J (JT-06 / JW-06): operation 67 on a Core without an updater.
    [409, 'COMMAND_UNSUPPORTED', { simCode: 'COMMAND_UNSUPPORTED', from: null, event: 'startSoftwareUpdate', reason: 'UPDATER_NOT_AVAILABLE' }, 'COMMAND_UNSUPPORTED', null, 'startSoftwareUpdate'],
    [422, 'INVALID_INPUT', { simCode: 'POLICY_RANGE', from: null, event: 'setStoragePolicy' }, 'POLICY_RANGE', null, 'setStoragePolicy'],
    [422, 'INVALID_INPUT', { simCode: 'NOTE_INVALID', from: 'RECORDING', event: 'addNote' }, 'NOTE_INVALID', 'RECORDING', 'addNote'],
    // Without details: the replica's session state, the action's name, the code of the table read backwards.
    [409, 'INVALID_STATE', undefined, 'ILLEGAL_STATE', 'RECORDING', 'archiveEvidence'],
    [409, 'PRECHECK_RUNNING', undefined, 'CHECKS_RUNNING', 'RECORDING', 'archiveEvidence'],
    [409, 'PRECHECK_WARNINGS', undefined, 'ILLEGAL_STATE', 'RECORDING', 'archiveEvidence'],
    [409, 'PRECHECK_BLOCKED', undefined, 'ILLEGAL_STATE', 'RECORDING', 'archiveEvidence'],
    [409, 'NOT_SEALED', undefined, 'UNSEALED_EVIDENCE', 'RECORDING', 'archiveEvidence'],
    [409, 'SESSION_ACTIVE', undefined, 'SESSION_ACTIVE', 'RECORDING', 'archiveEvidence'],
    [409, 'RECORDING_ACTIVE', undefined, 'RECORDING_ACTIVE', 'RECORDING', 'archiveEvidence'],
    [409, 'COMMAND_UNSUPPORTED', undefined, 'COMMAND_UNSUPPORTED', 'RECORDING', 'archiveEvidence'],
    [422, 'INVALID_REASON', undefined, 'REASON_TOO_SHORT', 'RECORDING', 'archiveEvidence'],
    [422, 'INVALID_INPUT', { in: 'body' }, 'INVALID_INPUT', 'RECORDING', 'archiveEvidence'],
    // A `simCode` that is no simulator code is not trusted: the envelope code decides.
    [409, 'INVALID_STATE', { simCode: 'SOMETHING_ELSE' }, 'ILLEGAL_STATE', 'RECORDING', 'archiveEvidence'],
  ] as const)('%i %s %j becomes SimTransitionError %s from %s on %s', (status, code, details, simCode, from, event) => {
    const error = rebuildRefusal(failure(status, code, details ? { details } : {}), CONTEXT);
    expect(error).toBeInstanceOf(SimTransitionError);
    expect(error).toBeInstanceOf(LiveSimTransitionError);
    expect(error).toMatchObject({ name: 'SimTransitionError', code: simCode, from, event });
    expect(simErrorCode(error)).toBe(simCode);
  });

  it('a 422 without a simulator code takes the code the action gives its invalid input', () => {
    const invalid = failure(422, 'INVALID_INPUT', { details: { in: 'body' } });
    expect(rebuildRefusal(invalid, { ...CONTEXT, invalidInputCode: SimErrorCode.NOTE_INVALID })).toMatchObject({ code: 'NOTE_INVALID' });
    expect(rebuildRefusal(invalid, { ...CONTEXT, invalidInputCode: SimErrorCode.POLICY_RANGE })).toMatchObject({ code: 'POLICY_RANGE' });
    expect(rebuildRefusal(failure(422, 'INVALID_REASON'), { ...CONTEXT, invalidInputCode: SimErrorCode.REASON_TOO_SHORT })).toMatchObject({ code: 'REASON_TOO_SHORT' });
    // The server's own code still wins, and a 409 is not touched by it.
    expect(rebuildRefusal(failure(422, 'INVALID_INPUT', { details: { simCode: 'INVALID_INPUT' } }), { ...CONTEXT, invalidInputCode: SimErrorCode.NOTE_INVALID })).toMatchObject({ code: 'INVALID_INPUT' });
    expect(rebuildRefusal(failure(409, 'INVALID_STATE'), { ...CONTEXT, invalidInputCode: SimErrorCode.NOTE_INVALID })).toMatchObject({ code: 'ILLEGAL_STATE' });
    expect(LIVE_BINDINGS.stopRecording.invalidInputCode).toBe('REASON_TOO_SHORT');
    expect(LIVE_BINDINGS.addNote.invalidInputCode).toBe('NOTE_INVALID');
    expect(LIVE_BINDINGS.setStoragePolicy.invalidInputCode).toBe('POLICY_RANGE');
  });

  it('CPC1-18: an envelope code that names an inherited member of an object stands for no simulator code', () => {
    const names = ['constructor', 'toString', 'hasOwnProperty', '__proto__', 'valueOf'];
    for (const code of names) {
      const error = rebuildRefusal(failure(409, code), CONTEXT);
      expect(error, code).toBeInstanceOf(CoreRefusalError);
      expect(error, code).toMatchObject({ code, status: 409 });
    }
    for (const code of names) expect(envelopeSimCodeOf(code), code).toBeUndefined();
    expect(envelopeSimCodeOf('INVALID_STATE')).toBe('ILLEGAL_STATE');
  });

  it('CPC1-18: a device command that names an inherited member is refused as any unknown command, without a request', () => {
    const view = { state: createIdleState({ now: 0, seed: DEFAULT_SEED }), now: 0 };
    for (const command of ['constructor', 'toString', '__proto__', 'UNKNOWN']) {
      const planned = LIVE_BINDINGS.deviceCommand.plan(['DEV-1', command as never], view, {});
      expect(planned.kind, command).toBe('reject');
      expect(planned.kind === 'reject' ? planned.error : null, command).toMatchObject({ name: 'SimTransitionError', code: 'COMMAND_UNSUPPORTED' });
    }
  });

  it('CPC1-5: every envelope code of the table, and every code a comparison helper is given, is a code of the contract', () => {
    for (const code of Object.keys(ENVELOPE_SIM_CODE)) expect(API_ERROR_CODES as readonly string[], code).toContain(code);
    expect(isRefusal(failure(401, 'NOT_SIGNED_IN'), 401, ApiErrorCode.NOT_SIGNED_IN)).toBe(true);
    expect(isRefusal(failure(403, 'NOT_SIGNED_IN'), 401, ApiErrorCode.NOT_SIGNED_IN)).toBe(false);
    expect(isRefusal(failure(401, 'INVALID_CREDENTIALS'), 401, ApiErrorCode.NOT_SIGNED_IN)).toBe(false);
  });

  it('the table read backwards names simulator codes only', () => {
    for (const code of Object.values(ENVELOPE_SIM_CODE)) expect(Object.values(SimErrorCode)).toContain(code);
    expect(Object.keys(ENVELOPE_SIM_CODE).sort()).toEqual(
      ['COMMAND_UNSUPPORTED', 'INVALID_INPUT', 'INVALID_REASON', 'INVALID_STATE', 'NOT_SEALED', 'PRECHECK_BLOCKED', 'PRECHECK_RUNNING', 'PRECHECK_WARNINGS', 'RECORDING_ACTIVE', 'SESSION_ACTIVE'].sort(),
    );
  });

  it.each([
    [403, 'DEMO_DISABLED'],
    [403, 'DEVICE_NOT_PAIRED'],
    [403, 'DEVICE_REVOKED'],
    [403, 'ORIGIN_NOT_ALLOWED'],
    [409, 'LAST_ADMIN'],
    [409, 'SECURITY_FAULT'],
    [423, 'LOCKED'],
    [401, 'INVALID_CODE'],
    [401, 'INVALID_CREDENTIALS'],
    [400, 'INVALID_JSON'],
    [405, 'METHOD_NOT_ALLOWED'],
    [413, 'PAYLOAD_TOO_LARGE'],
  ] as const)('%i %s has no simulator class: CoreRefusalError with the code, the status and the request ID', (status, code) => {
    const error = rebuildRefusal(failure(status, code), CONTEXT);
    expect(error).toBeInstanceOf(CoreRefusalError);
    expect(error).toMatchObject({ name: 'CoreRefusalError', code, status, requestId: 'req-0042' });
    expect(simErrorCode(error)).toBeNull();
    expect(error).not.toBeInstanceOf(SimTransitionError);
    expect(error).not.toBeInstanceOf(SimPermissionError);
  });

  it.each([
    // kind, status, code, transport reason, retry-after
    ['NETWORK', null, 'NETWORK', 'CORE_OFFLINE', null],
    ['TIMEOUT', null, 'TIMEOUT', 'CORE_OFFLINE', null],
    ['NOT_READY', 503, 'NOT_READY', 'CORE_OFFLINE', null],
    ['RATE_LIMITED', 429, 'RATE_LIMITED', 'UNAVAILABLE', 37],
    ['SERVER', 500, 'INTERNAL_ERROR', 'UNAVAILABLE', null],
    ['CONTRACT_VIOLATION', 200, 'CONTRACT_VIOLATION', 'UNAVAILABLE', null],
    ['CONTRACT_VIOLATION', 502, 'CONTRACT_VIOLATION', 'CORE_OFFLINE', null],
  ] as const)('a %s failure (status %s) is a LiveTransportError, never a simulator error', (kind, status, code, reason, retryAfterSeconds) => {
    const given = failure(status, code, { kind, transport: reason, retryAfterSeconds });
    const error = rebuildRefusal(given, CONTEXT);
    expect(error).toBeInstanceOf(LiveTransportError);
    expect(error).toMatchObject({ name: 'LiveTransportError', reason, status, code, retryAfterSeconds, requestId: 'req-0042' });
    expect(simErrorCode(error)).toBeNull();
    expect(transportErrorOf(given)).toMatchObject({ reason, status });
    // The class of the failure decides, whatever the status would have meant as a refusal.
    expect(rebuildRefusal(failure(403, 'NOT_PERMITTED', { transport: 'UNAVAILABLE' }), CONTEXT)).toBeInstanceOf(LiveTransportError);
    expect(transportErrorOf(failure(403, 'NOT_PERMITTED'))).toBeNull();
  });

  it('no error carries the server\'s message or a value of the envelope\'s details', () => {
    const errors = [
      rebuildRefusal(failure(403, 'NOT_PERMITTED', { details: { role: 'MARKER-ROLE-7f3a' } }), CONTEXT),
      rebuildRefusal(failure(409, 'INVALID_STATE', { details: { note: 'MARKER-ROLE-7f3a' } }), CONTEXT),
      rebuildRefusal(failure(403, 'DEMO_DISABLED', { details: { note: 'MARKER-ROLE-7f3a' } }), CONTEXT),
      rebuildRefusal(failure(429, 'RATE_LIMITED', { transport: 'UNAVAILABLE', details: { note: 'MARKER-ROLE-7f3a' } }), CONTEXT),
    ];
    for (const error of errors) {
      expect(error.message).not.toContain('MARKER-ROLE-7f3a');
      expect(error.message).not.toContain('This text is the server');
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════════════
// Through the transport
// ═══════════════════════════════════════════════════════════════════════════════════════

let fake: FakeTransport;
let live: LiveSim | undefined;

afterEach(() => {
  live?.stop();
  live = undefined;
  (fake as FakeTransport | undefined)?.assertNoViolations();
});

async function signedIn(): Promise<{ source: LiveSim; reports: SimErrorReport[] }> {
  fake = createFakeTransport({ epoch: 3, revision: 40 });
  fake.scriptSignedInStart(pickReplicatedState(JSON.parse(JSON.stringify(ARMED)) as ReplicatedState));
  const reports: SimErrorReport[] = [];
  const source = createLiveSim({
    client: createCoreClient({ baseUrl: BASE_URL, credentials: 'browser-cookie', fetch: fake.fetch }),
    socket: { url: SOCKET_URL, factory: fake.socketFactory },
    now: fake.clock.now,
    timers: fake.clock.timers,
    random: () => 0,
    onError: (report) => reports.push(report),
  });
  live = source;
  await source.ready;
  expect(source.link).toBe('ONLINE');
  return { source, reports };
}

const firstExample = (operationId: string, status: number): unknown => {
  const examples = CORE_API_EXAMPLES[operationId]?.responses[status];
  const first = examples ? Object.values(examples)[0] : undefined;
  return first?.value;
};

describe('every command and read binding, called on a Live source over the fake transport', () => {
  const COMMANDS = LIVE_BINDING_NAMES.filter((name) => LIVE_BINDINGS[name].flow === LiveActionFlow.COMMAND || LIVE_BINDINGS[name].flow === LiveActionFlow.READ);

  it('sends exactly the planned request and resolves with what the simulator\'s action returns for that answer', async () => {
    const { source, reports } = await signedIn();
    fake.answerAllFromExamples();
    const actions = source.actions as unknown as Record<string, (...args: unknown[]) => Promise<unknown>>;
    const results: Record<string, unknown> = {};

    for (const name of COMMANDS) {
      const plan = planOf(name) as CallPlan;
      const before = fake.log.requestsOf(plan.operationId).length;
      results[name] = await actions[name]?.(...ARGS[name]);
      const calls = fake.log.requestsOf(plan.operationId);
      expect(calls, `${name} sent one ${plan.operationId}`).toHaveLength(before + 1);
      const sent = calls.at(-1);
      expect(sent?.outcome, name).toBe('answered');
      expect(sent?.body, `${name}: the body`).toEqual(plan.input.body);
      expect(sent?.params, `${name}: the path parameter`).toEqual(plan.input.params ?? {});
      // The web console presents no bearer value, and nothing of a request travels in the URL.
      expect(sent?.headers.authorization, name).toBeUndefined();
      expect(sent?.query, name).toEqual({});
    }
    expect(COMMANDS).toHaveLength(36);
    expect(reports).toEqual([]);

    // The values: the answer mapped to the simulator's return type.
    const lowest = (operationId: string): unknown => {
      const statuses = Object.keys(CORE_API_EXAMPLES[operationId]?.responses ?? {}).map(Number).filter((status) => status >= 200 && status < 300);
      return firstExample(operationId, Math.min(...statuses));
    };
    const created = lowest('createSession') as { sessionId: string; created?: boolean };
    expect(results.createSession).toEqual({ ok: true, sessionId: created.sessionId, created: created.created ?? false });
    expect(results.scanCaseNumber).toBe((lowest('scanCaseNumber') as { caseNumber: string }).caseNumber);
    expect(results.verify).toEqual(lowest('verifyEvidence'));
    expect(results.exportEvidence).toEqual({ ok: true, status: 202, exportId: (lowest('exportEvidence') as { exportId: string }).exportId });
    expect(results.exportAudit).toEqual({ ok: true, status: 202, exportId: (lowest('exportAudit') as { exportId: string }).exportId });
    expect(results.exportLogs).toEqual({ ok: true, status: 202, exportId: (lowest('exportLogs') as { exportId: string }).exportId });
    expect(results.verifyAuditChain).toEqual((lowest('verifyAuditChain') as { view: unknown }).view);
    expect(results.runDiagnostics).toBe((lowest('runDiagnostics') as { runId: string }).runId);
    expect(results.restartServices).toBe((lowest('restartServices') as { restarted: number }).restarted);
    expect(results.recordBiometricFailure).toMatchObject({ ok: false });
    const voids = COMMANDS.filter((name) => results[name] === undefined);
    expect(voids).toHaveLength(COMMANDS.length - 10);

    // `verifyAuditChain` keeps what the screens show besides the view (section 8.2, A9).
    const chain = lowest('verifyAuditChain') as { stored: unknown; lineage: unknown[]; lineageTotal: number };
    expect(source.auditChain).toMatchObject({ stored: chain.stored, lineage: chain.lineage, lineageTotal: chain.lineageTotal, at: fake.clock.now() });
  });

  it('the three device commands reach their three operations', async () => {
    const { source } = await signedIn();
    fake.answerAllFromExamples();
    await source.actions.deviceCommand('CAM-01', 'TEST_SIGNAL');
    await source.actions.deviceCommand('CAM-01', 'IDENTIFY');
    await source.actions.deviceCommand('CAM-01', 'RESTART');
    expect(fake.log.operationIds().slice(-3)).toEqual(['testDeviceSignal', 'identifyDevice', 'restartDevice']);
  });

  it('the three kinds of selector change reach their three operations (task 3 row 66; C3 operations 78 to 80)', async () => {
    const { source } = await signedIn();
    fake.answerAllFromExamples();
    await source.actions.setCaptureConfig({ kind: 'UPDATE', cameras: [{ trackId: 'VIDEO-01', deviceId: 'CAM-02' }] });
    await source.actions.setCaptureConfig({ kind: 'CAMERA_SOURCE', deviceId: 'CAM-01', trackId: 'VIDEO-02' });
    await source.actions.setCaptureConfig({ kind: 'PRIMARY_MIC', inputId: 'MIC-02' });
    expect(fake.log.operationIds().slice(-3)).toEqual(['updateCaptureConfig', 'setCaptureCameraSource', 'setPrimaryMic']);
    const sent = (operationId: string) => fake.log.requestsOf(operationId).at(-1);
    expect([sent('updateCaptureConfig')?.body, sent('updateCaptureConfig')?.params]).toEqual([{ cameras: [{ trackId: 'VIDEO-01', deviceId: 'CAM-02' }] }, {}]);
    expect([sent('setCaptureCameraSource')?.body, sent('setCaptureCameraSource')?.params]).toEqual([{ trackId: 'VIDEO-02' }, { id: 'CAM-01' }]);
    expect(sent('setPrimaryMic')?.params).toEqual({ id: 'MIC-02' });
    // A kind the contract table does not hold is refused before a request, as an unknown device command is.
    const calls = fake.calls.length;
    await expect(source.actions.setCaptureConfig({ kind: 'toString' } as never)).rejects.toMatchObject({ name: 'SimTransitionError', code: 'INVALID_INPUT' });
    expect(fake.calls).toHaveLength(calls);
    expect(Object.values(CAPTURE_CONFIG_CHANGE_OPERATION_INDEX)).toEqual([0, 1, 2]);
  });

  it('a local answer sends nothing', async () => {
    const { source, reports } = await signedIn();
    const calls = fake.calls.length;
    await expect(source.actions.setTabletLink('OFFLINE')).resolves.toBeUndefined();
    await expect(source.actions.applyCaptureTelemetry(...ARGS.applyCaptureTelemetry)).resolves.toBeUndefined();
    await expect(source.actions.raiseCaptureWarning(...ARGS.raiseCaptureWarning)).resolves.toBeUndefined();
    await expect(source.actions.clearCaptureWarning(...ARGS.clearCaptureWarning)).resolves.toBeUndefined();
    await expect(source.actions.setActiveCamera(ARMED.activeCameraId)).resolves.toBeUndefined();
    await expect(source.actions.signInWithSecurityKey()).rejects.toMatchObject({ name: 'CoreRefusalError', code: 'NOT_AVAILABLE' });
    await expect(source.actions.signInWithBiometric('OPR-002')).rejects.toMatchObject({ name: 'CoreRefusalError', code: 'NOT_AVAILABLE' });
    expect(fake.calls).toHaveLength(calls);
    expect(reports.map((report) => report.source)).toEqual(['live.action.signInWithSecurityKey', 'live.action.signInWithBiometric']);
  });
});

describe('refusals and failures through the transport (AC-C-11, CL-19, CL-21)', () => {
  it('a void action rejects with the simulator\'s class, checked with instanceof', async () => {
    const { source } = await signedIn();
    const evidenceId = ARGS.archiveEvidence[0];
    const caught = async (run: () => Promise<unknown>): Promise<unknown> => run().then(() => undefined, (error: unknown) => error);

    fake.answerOnceFromExample('archiveEvidence', 403);
    const denied = await caught(() => source.actions.archiveEvidence(evidenceId) as Promise<void>);
    expect(denied).toBeInstanceOf(SimPermissionError);
    expect(denied).toMatchObject({ action: 'archiveEvidence', permission: 'EVIDENCE_REVIEW', code: 'NOT_PERMITTED' });

    fake.answerOnceFromExample('verifyEvidence', 404);
    const missing = await caught(() => source.actions.verify(evidenceId) as Promise<unknown>);
    expect(missing).toBeInstanceOf(SimNotFoundError);
    expect(missing).toMatchObject({ entity: 'evidence', entityId: evidenceId });

    fake.answerOnceFromExample('restartDevice', 409);
    const busy = await caught(() => source.actions.deviceCommand('CAM-01', 'RESTART') as Promise<void>);
    expect(busy).toBeInstanceOf(SimTransitionError);
    expect(busy).toMatchObject({ code: 'RECORDING_ACTIVE', event: 'deviceCommand' });

    fake.answerOnce('stopSession', refusal(422, 'INVALID_REASON', 'The reason is too short.'));
    const short = await caught(() => source.actions.stopRecording('Interview complete') as Promise<void>);
    expect(short).toBeInstanceOf(SimTransitionError);
    expect(short).toMatchObject({ code: 'REASON_TOO_SHORT', from: 'ARMED', event: 'stopRecording' });

    // Pass D6 (D156): a stop the Core refuses while the cameras still connect names why, and the rebuilt error carries it.
    fake.answerOnce('stopSession', { status: 409, body: { error: { code: 'INVALID_STATE', message: 'The recording is still connecting its cameras.', details: { simCode: 'ILLEGAL_STATE', from: 'RECORDING', event: 'stopRecording', reason: 'CAPTURE_NOT_DURABLE' } } } });
    const connecting = await caught(() => source.actions.stopRecording('Interview complete') as Promise<void>);
    expect(connecting).toBeInstanceOf(SimTransitionError);
    expect(connecting).toMatchObject({ code: 'ILLEGAL_STATE', from: 'RECORDING', event: 'stopRecording', reason: 'CAPTURE_NOT_DURABLE' });
    // A refusal without a reason carries none.
    expect(short).toMatchObject({ reason: null });

    fake.answerOnceFromExample('injectFault', 403, 'demoDisabled');
    const disabled = await caught(() => source.actions.inject('MIC_CLIP') as Promise<void>);
    expect(disabled).toBeInstanceOf(CoreRefusalError);
    expect(disabled).toMatchObject({ code: 'DEMO_DISABLED', status: 403 });
  });

  it('a result-union action resolves with ok: false and the mapped reason (CL-19)', async () => {
    const { source, reports } = await signedIn();
    const [evidenceId, request] = ARGS.exportEvidence;
    const exported = async (answer: Parameters<FakeTransport['answerOnce']>[1]) => {
      fake.answerOnce('exportEvidence', answer);
      return source.actions.exportEvidence(evidenceId, request);
    };
    expect(await exported(refusal(403, 'FORBIDDEN', 'Your role does not allow this export.'))).toEqual({ ok: false, status: 403, reason: 'FORBIDDEN' });
    expect(await exported(refusal(404, 'NOT_FOUND', 'Evidence not found.'))).toEqual({ ok: false, status: 404, reason: 'NOT_FOUND' });
    expect(await exported(refusal(409, 'NOT_SEALED', 'The item is not sealed.'))).toEqual({ ok: false, status: 409, reason: 'NOT_SEALED' });
    expect(await exported(refusal(409, 'SECURITY_FAULT', 'A security fault blocks the export.'))).toEqual({ ok: false, status: 409, reason: 'SECURITY_FAULT' });
    expect(await exported(refusal(422, 'INVALID_REASON', 'The reason is too short.'))).toEqual({ ok: false, status: 422, reason: 'INVALID_REASON' });

    fake.answerOnce('exportAudit', refusal(403, 'NOT_PERMITTED', 'Your role does not allow this action.'));
    expect(await source.actions.exportAudit({ reason: 'Monthly audit review' })).toEqual({ ok: false, status: 403, reason: 'FORBIDDEN' });
    fake.answerOnce('exportLogs', refusal(422, 'INVALID_INPUT', 'The request does not match the expected input.'));
    expect(await source.actions.exportLogs({ reason: 'Monthly audit review' })).toEqual({ ok: false, status: 422, reason: 'INVALID_REASON' });

    const sessionId = ARMED.session?.id;
    const create = async (answer: Parameters<FakeTransport['answerOnce']>[1]) => {
      fake.answerOnce('createSession', answer);
      return source.actions.createSession(ARGS.createSession[0]);
    };
    expect(await create(refusal(409, 'SESSION_ACTIVE', 'A session is open.'))).toEqual({ ok: false, reason: 'SESSION_ACTIVE', sessionId });
    expect(await create(refusal(403, 'NOT_PERMITTED', 'Your role does not allow this action.'))).toEqual({ ok: false, reason: 'NOT_PERMITTED', sessionId: null });
    expect(await create(refusal(422, 'INVALID_INPUT', 'The request does not match the expected input.'))).toEqual({ ok: false, reason: 'INVALID_INPUT', sessionId });
    // A refusal the union has no member for rejects.
    await expect(create(refusal(403, 'ORIGIN_NOT_ALLOWED', 'This origin may not call the Core server.'))).rejects.toMatchObject({ name: 'CoreRefusalError', code: 'ORIGIN_NOT_ALLOWED' });
    // A union member is an answer of the action, not a rejection: only the last call is reported.
    expect(reports.map((report) => report.source)).toEqual(['live.action.createSession']);
  });

  it('pass D5 — operation 42, schema v2: the kind travels only when the request names it; 409 EXPORT_IN_PROGRESS has its own reason; the jobId of the 202 is carried when it is one', async () => {
    const { source } = await signedIn();
    const [evidenceId, request] = ARGS.exportEvidence;
    const bodyOf = (kind?: unknown): unknown => (planOf('exportEvidence', [evidenceId, { ...request, ...(kind === undefined ? {} : { kind }) }]) as CallPlan).input.body;
    // No kind named: the body of a v1 caller, unchanged (the Core reads PACKAGE).
    expect(bodyOf()).toEqual({ reason: request.reason, destination: request.destination });
    expect(bodyOf('COMPOSITE')).toEqual({ reason: request.reason, destination: request.destination, kind: 'COMPOSITE' });
    expect(bodyOf('PACKAGE')).toEqual({ reason: request.reason, destination: request.destination, kind: 'PACKAGE' });
    expect(bodyOf('VIDEO')).toEqual({ reason: request.reason, destination: request.destination });
    // The audit and log exports have no kind.
    expect((planOf('exportAudit', [{ reason: 'Monthly audit review', kind: 'COMPOSITE' }]) as CallPlan).input.body).toEqual({ reason: 'Monthly audit review' });

    fake.answerOnce('exportEvidence', refusal(409, 'EXPORT_IN_PROGRESS', 'An export job is already running for this evidence item.'));
    const running = await source.actions.exportEvidence(evidenceId, { ...request, kind: 'COMPOSITE' });
    expect(running).toEqual({ ok: false, status: 409, reason: EXPORT_IN_PROGRESS_REASON });
    expect(EXPORT_IN_PROGRESS_REASON).toBe('EXPORT_IN_PROGRESS');
    expect(fake.log.requestsOf('exportEvidence').at(-1)?.body).toEqual({ reason: request.reason, destination: request.destination, kind: 'COMPOSITE' });

    // Fix wave J (truth rule 3d; JA2-03 / JW-03): the refusal of an output the Core cannot produce is THROWN as the simulator
    // throws it - with its reason - and is never read as "not sealed" (until wave J every other 409 was).
    fake.answerOnce('exportEvidence', { status: 409, body: { error: { code: 'COMMAND_UNSUPPORTED', message: 'Composite video is not available in this build.', details: { simCode: 'COMMAND_UNSUPPORTED', reason: 'COMPOSITE_ENCODER_NOT_SELECTED' }, requestId: 'req-000001' } } });
    const unsupported = await source.actions.exportEvidence(evidenceId, { ...request, kind: 'COMPOSITE' }).then(
      (value) => ({ resolved: value }),
      (error: unknown) => ({ rejected: error }),
    );
    expect(unsupported).toMatchObject({ rejected: { name: 'SimTransitionError', code: 'COMMAND_UNSUPPORTED', reason: 'COMPOSITE_ENCODER_NOT_SELECTED' } });
    // CONTROL: a 409 NOT_SEALED is still the result it was.
    fake.answerOnce('exportEvidence', refusal(409, 'NOT_SEALED', 'Only sealed evidence can be exported.'));
    expect(await source.actions.exportEvidence(evidenceId, request)).toEqual({ ok: false, status: 409, reason: 'NOT_SEALED' });

    const accepted = (jobId?: unknown) => ({ status: 202, body: { exportId: 'EXP-000032', evidenceId, status: 'QUEUED', ...(jobId === undefined ? {} : { jobId }) } });
    fake.answerOnce('exportEvidence', accepted('EXPJ-000777'));
    expect(await source.actions.exportEvidence(evidenceId, request)).toEqual({ ok: true, status: 202, exportId: 'EXP-000032', jobId: 'EXPJ-000777' });
    fake.answerOnce('exportEvidence', accepted());
    expect(await source.actions.exportEvidence(evidenceId, request)).toEqual({ ok: true, status: 202, exportId: 'EXP-000032' });
  });

  it('fix wave K (G94b-06): `archiveOnCore` of the 202 is handed on by name when the Core states a boolean; absent or not a boolean, it is not invented', async () => {
    const { source } = await signedIn();
    const [evidenceId, request] = ARGS.exportEvidence;
    const accepted = (extra: Record<string, unknown>) => ({ status: 202, body: { exportId: 'EXP-000032', evidenceId, status: 'QUEUED', ...extra } });
    fake.answerOnce('exportEvidence', accepted({ archiveOnCore: EXPORT_ACCEPTED_NO_ARCHIVE_EXAMPLE.archiveOnCore }));
    expect(await source.actions.exportEvidence(evidenceId, request)).toEqual({ ok: true, status: 202, exportId: 'EXP-000032', archiveOnCore: false });
    fake.answerOnce('exportEvidence', accepted({ archiveOnCore: true, jobId: 'EXPJ-000032' }));
    expect(await source.actions.exportEvidence(evidenceId, request)).toEqual({ ok: true, status: 202, exportId: 'EXP-000032', jobId: 'EXPJ-000032', archiveOnCore: true });
    // Control: a Core that does not say (an older one) - no member.
    fake.answerOnce('exportEvidence', accepted({}));
    expect(await source.actions.exportEvidence(evidenceId, request)).not.toHaveProperty('archiveOnCore');
  });

  it('a 401 on an export resolves with NOT_SIGNED_IN, and the client is signed out (CL-23)', async () => {
    const { source } = await signedIn();
    const ends: string[] = [];
    source.onSessionEnd((end) => ends.push(`${end.kind} ${end.source} ${String(end.reason)} auth=${source.store.getState().auth.status} session=${String(source.session)}`));
    // The server no longer names a session for this client.
    fake.answerFromExample('getAuthSession', 401);
    fake.answerFromExample('getSignInStatus');
    fake.answerOnce('exportEvidence', refusal(401, 'NOT_SIGNED_IN', 'Sign in first.'));
    expect(await source.actions.exportEvidence(...ARGS.exportEvidence)).toEqual({ ok: false, status: 401, reason: 'NOT_SIGNED_IN' });
    expect(ends).toEqual(['SESSION_ENDED REST null auth=SIGNED_OUT session=null']);
    expect(source.lastSessionEnd).toMatchObject({ kind: 'SESSION_ENDED', source: 'REST', reason: null, wasSignedIn: true, sessionState: 'ARMED' });
    expect(source.store.getState().session).toBeNull();
    expect(source.store.getState().operators).toEqual([]);
    await fake.idle();
  });

  it('a 429 keeps its status and retry-after in LiveTransportError, also for an action with a result union', async () => {
    const { source } = await signedIn();
    fake.answerOnce('archiveEvidence', rateLimited(37));
    const limited = await source.actions.archiveEvidence(ARGS.archiveEvidence[0]).then(() => undefined, (error: unknown) => error);
    expect(limited).toBeInstanceOf(LiveTransportError);
    expect(limited).toMatchObject({ reason: 'UNAVAILABLE', status: 429, code: 'RATE_LIMITED', retryAfterSeconds: 37 });
    expect(limited).not.toBeInstanceOf(SimTransitionError);

    fake.answerOnce('exportEvidence', rateLimited(12));
    await expect(source.actions.exportEvidence(...ARGS.exportEvidence)).rejects.toMatchObject({ name: 'LiveTransportError', status: 429, retryAfterSeconds: 12 });
    fake.answerOnce('createSession', rateLimited(5));
    await expect(source.actions.createSession(ARGS.createSession[0])).rejects.toMatchObject({ name: 'LiveTransportError', status: 429, retryAfterSeconds: 5 });
  });

  it('no answer, a starting server, a server error and an answer outside the contract are LiveTransportError with their class', async () => {
    const { source, reports } = await signedIn();
    const evidenceId = ARGS.archiveEvidence[0];

    fake.failOnce('archiveEvidence');
    await expect(source.actions.archiveEvidence(evidenceId)).rejects.toMatchObject({ name: 'LiveTransportError', reason: 'CORE_OFFLINE', status: null, code: 'NETWORK' });

    fake.answerOnce('archiveEvidence', notReady());
    await expect(source.actions.archiveEvidence(evidenceId)).rejects.toMatchObject({ name: 'LiveTransportError', reason: 'CORE_OFFLINE', status: 503, code: 'NOT_READY' });

    fake.answerOnce('archiveEvidence', refusal(500, 'INTERNAL_ERROR', 'Unexpected failure.'));
    await expect(source.actions.archiveEvidence(evidenceId)).rejects.toMatchObject({ name: 'LiveTransportError', reason: 'UNAVAILABLE', status: 500, code: 'INTERNAL_ERROR' });

    // A 2xx body its schema refuses: the typed client reports CONTRACT_VIOLATION and hands on no content.
    fake.answerOnce('runDiagnostics', { status: 202, body: { runId: 42 }, violatesContract: true });
    await expect(source.actions.runDiagnostics()).rejects.toMatchObject({ name: 'LiveTransportError', reason: 'UNAVAILABLE', status: 202, code: 'CONTRACT_VIOLATION' });

    expect(reports.map((report) => [report.level, report.context?.code])).toEqual([
      ['error', 'NETWORK'],
      ['error', 'NOT_READY'],
      ['error', 'INTERNAL_ERROR'],
      ['error', 'CONTRACT_VIOLATION'],
    ]);
    // The source is still usable afterwards.
    fake.answerOnceFromExample('runDiagnostics');
    await expect(source.actions.runDiagnostics()).resolves.toMatch(/^DIAG-/);
  });

  it('a usage error of the typed client (an ID that cannot travel in a path) rejects the action and is reported; nothing is sent', async () => {
    const { source, reports } = await signedIn();
    const calls = fake.calls.length;
    await expect(source.actions.archiveEvidence('')).rejects.toMatchObject({ name: 'CoreClientUsageError' });
    expect(fake.calls).toHaveLength(calls);
    expect(reports).toHaveLength(1);
    expect(reports[0]).toMatchObject({ level: 'error', source: 'live.action.archiveEvidence' });
  });
});
