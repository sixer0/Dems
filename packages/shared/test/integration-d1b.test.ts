// Integration pass D1b (decision D133): three seams of the shared contract.
//
//   1. operation 78 assigns the microphone inputs by PAIR REPLACEMENT (D133 (1)): mic lines with
//      `role` are the new pair; the form without `role` stays valid;
//   2. the session audio source, the body of operation 81, the intervals, the meters slice and the
//      audio status name a mic input by the `MIC-NN` rule, no longer by `MIC-01 | MIC-02`;
//   3. `developmentSources` on the evidence item (operations 39 / 40; row 141's request);
//   8. the audit `endpointRef` of a connection test and an adoption is `urn:uuid:<UUID>` or absent (D134);
//  12. ops 42 / 87 / 88, additive (ruling D140): the optional `fileId` body of op 88, `jobId` on the
//      202 of op 42, `kind` on the export request row, the documented refusals.
//  10. a meter channel is the microphone line of its place in the capture configuration (ruling D137).
//
// Every acceptance has its refusal beside it: a rule that admits everything proves nothing.
import { describe, expect, it } from 'vitest';
import {
  ActiveSessionSchema,
  AudioChannelStatusSchema,
  AudioSliceSchema,
  AudioSourceIntervalEntrySchema,
  AudioSourceStateSchema,
  AudioSourceSwitchRequestSchema,
  CAPTURE_ENDPOINT_REF_PATTERN,
  CaptureConfigMicUpdateSchema,
  CaptureConfigSliceSchema,
  CaptureConfigUpdateRequestSchema,
  EXAMPLE_EVIDENCE_ITEM,
  EvidenceExportAcceptedSchema,
  EvidenceExportJobSchema,
  EvidenceExportRequestSchema,
  EvidenceItemSchema,
  EvidenceMediaSessionRequestSchema,
  CAPTURE_HELPERS_LEFT_REASON,
  CAPTURE_NOT_DURABLE_REASON,
  REPLICATED_SLICE_SCHEMAS,
  SessionResourceSchema,
  findCoreApiOperation,
  captureCandidateAdoptedDetails,
  captureConnectionTestedDetails,
} from '../src/api';
import {
  DEMO_OPERATOR_PASSWORD,
  OPERATORS,
  SimTransitionError,
  CaptureAdvisoryReason,
  UNKNOWN_MIC_TRANSPORT,
  activeCaptureNotice,
  activeMeterChannel,
  captureMicLines,
  channelOfMicLine,
  createAudioRuntime,
  createManualClock,
  createSim,
  feedCaptureLevels,
  micInputOfCaptureRole,
  micInputOfChannel,
  raiseCaptureWarningTransition,
  setCaptureConfigTransition,
  type CaptureConfigChange,
  type CaptureDeviceStatus,
  type ScenarioName,
  type SimState,
} from '../src/sim';

const START = Date.UTC(2026, 9, 1, 3, 0, 0);
const CAPTURE_CONFIG_PATH = '/api/v1/capture/config';

function harness(scenario: ScenarioName = 'idle', role: 'TECHNICIAN' | 'INVESTIGATOR' = 'TECHNICIAN') {
  const clock = createManualClock(START);
  const sim = createSim({ clock, storage: null, authStorage: null, scenario });
  const operator = OPERATORS.find((candidate) => candidate.role === role);
  if (operator === undefined) throw new Error(`no seeded ${role}`);
  expect(sim.actions.signIn(operator.username, DEMO_OPERATOR_PASSWORD)).toMatchObject({ ok: true });
  return { sim, clock, state: () => sim.store.getState() };
}

/** The local microphone as row 136 registers it: a NEW device with its own id (D106 (4)). */
const LOCAL_MIC: CaptureDeviceStatus = { id: 'MIC-03', kind: 'MIC', model: 'MacBook Air Microphone', firmware: null, host: null, poePort: null, online: true, streamState: null, capabilities: [] };

/** A development registry: the seeded devices and the local microphone. The selector is the seeded one. */
function registerLocalMic(h: ReturnType<typeof harness>): void {
  const state = h.state();
  h.sim.store.setState({ captureDevices: { devices: [...state.captureDevices.devices, LOCAL_MIC] } });
}

const pair = (primary: string, standby: string, extra: Record<string, unknown> = {}) => ({
  mics: [
    { inputId: primary, deviceId: primary, role: 'PRIMARY', ...extra },
    { inputId: standby, deviceId: standby, role: 'STANDBY' },
  ],
});
const micsOf = (state: SimState): (string | boolean)[][] => state.captureConfig.mics.map((mic) => [mic.inputId, mic.deviceId, mic.role, mic.transport]);
const changedRows = (state: SimState) => state.audit.rows.filter((row) => row.type === 'CAPTURE_CONFIG_CHANGED');

describe('1. operation 78: the microphone inputs are assigned by pair replacement', () => {
  it('the mic line takes an optional role; the body still takes one or two lines', () => {
    expect(CaptureConfigMicUpdateSchema.safeParse({ inputId: 'MIC-03', deviceId: 'MIC-03', role: 'PRIMARY' }).success).toBe(true);
    expect(CaptureConfigMicUpdateSchema.safeParse({ inputId: 'MIC-02', deviceId: 'MIC-02', role: 'STANDBY', transport: 'USB' }).success).toBe(true);
    // The earlier form is still the contract (additive): a line without a role.
    expect(CaptureConfigMicUpdateSchema.safeParse({ inputId: 'MIC-01', deviceId: 'MIC-01' }).success).toBe(true);
    for (const bad of ['ACTIVE', 'primary', '', null, 1]) expect(CaptureConfigMicUpdateSchema.safeParse({ inputId: 'MIC-03', deviceId: 'MIC-03', role: bad }).success, String(bad)).toBe(false);
    expect(CaptureConfigUpdateRequestSchema.safeParse(pair('MIC-03', 'MIC-02')).success).toBe(true);
    expect(CaptureConfigUpdateRequestSchema.safeParse({ mics: [...pair('MIC-03', 'MIC-02').mics, { inputId: 'MIC-01', deviceId: 'MIC-01', role: 'STANDBY' }] }).success).toBe(false);
  });

  it('MIC-03 is selected through the API on a registry that holds it: the pair is replaced, in input order, with the rows of C3 §5.2', () => {
    const h = harness();
    registerLocalMic(h);
    const before = changedRows(h.state()).length;
    const answer = h.sim.request({ method: 'POST', path: CAPTURE_CONFIG_PATH, body: pair('MIC-03', 'MIC-02') });
    expect(answer.status).toBe(200);
    expect(micsOf(h.state())).toEqual([
      ['MIC-02', 'MIC-02', 'STANDBY', 'USB'],
      ['MIC-03', 'MIC-03', 'PRIMARY', UNKNOWN_MIC_TRANSPORT],
    ]);
    expect((answer.body as { mics: { inputId: string; role: string }[] }).mics.map((mic) => [mic.inputId, mic.role])).toEqual([['MIC-02', 'STANDBY'], ['MIC-03', 'PRIMARY']]);
    expect(CaptureConfigSliceSchema.safeParse(answer.body).success).toBe(true);
    // The rules that stay: exactly one PRIMARY and one STANDBY; a mic line's device is its input.
    expect(h.state().captureConfig.mics.map((mic) => mic.role).sort()).toEqual(['PRIMARY', 'STANDBY']);
    expect(h.state().captureConfig.mics.every((mic) => mic.deviceId === mic.inputId)).toBe(true);
    // One row per ROLE whose device changed: the PRIMARY moved from MIC-01 to MIC-03; MIC-02 stayed the STANDBY.
    const rows = changedRows(h.state()).slice(before);
    expect(rows.map((row) => row.details)).toEqual([
      { operationId: 'updateCaptureConfig', scope: 'MIC', field: 'SOURCE', inputId: 'MIC-03', deviceId: 'MIC-03', from: 'MIC-01', to: 'MIC-03', permission: 'CAPTURE_CONFIG' },
    ]);
    // The same pair again changes nothing: 200, no row, the same state object.
    const held = h.state().captureConfig;
    expect(h.sim.request({ method: 'POST', path: CAPTURE_CONFIG_PATH, body: pair('MIC-03', 'MIC-02') }).status).toBe(200);
    expect(h.state().captureConfig).toBe(held);
    expect(changedRows(h.state())).toHaveLength(before + 1);
    // And back to the built-in pair: both roles change their device.
    expect(h.sim.request({ method: 'POST', path: CAPTURE_CONFIG_PATH, body: pair('MIC-02', 'MIC-01') }).status).toBe(200);
    expect(micsOf(h.state()).map(([inputId, , role]) => [inputId, role])).toEqual([['MIC-01', 'STANDBY'], ['MIC-02', 'PRIMARY']]);
    expect(changedRows(h.state()).slice(before + 1).map((row) => [row.details?.['field'], row.details?.['inputId'], row.details?.['from'], row.details?.['to']])).toEqual([
      ['SOURCE', 'MIC-02', 'MIC-03', 'MIC-02'],
      ['SOURCE', 'MIC-01', 'MIC-02', 'MIC-01'],
    ]);
  });

  it('a line may name the transport; the same two inputs trading roles is the ROLE row of operation 80', () => {
    const h = harness();
    registerLocalMic(h);
    expect(h.sim.request({ method: 'POST', path: CAPTURE_CONFIG_PATH, body: pair('MIC-03', 'MIC-02', { transport: 'AVFOUNDATION' }) }).status).toBe(200);
    expect(micsOf(h.state())[1]).toEqual(['MIC-03', 'MIC-03', 'PRIMARY', 'AVFOUNDATION']);
    const before = changedRows(h.state()).length;
    expect(h.sim.request({ method: 'POST', path: CAPTURE_CONFIG_PATH, body: pair('MIC-02', 'MIC-03') }).status).toBe(200);
    expect(micsOf(h.state())).toEqual([
      ['MIC-02', 'MIC-02', 'PRIMARY', 'USB'],
      ['MIC-03', 'MIC-03', 'STANDBY', 'AVFOUNDATION'],
    ]);
    expect(changedRows(h.state()).slice(before).map((row) => row.details)).toEqual([
      { operationId: 'updateCaptureConfig', scope: 'MIC', field: 'ROLE', inputId: 'MIC-02', deviceId: 'MIC-02', from: 'STANDBY', to: 'PRIMARY', permission: 'CAPTURE_CONFIG' },
    ]);
  });

  it('REFUSED with the contract\'s 422, nothing written: MIC-03 where the registry does not hold it, and every pair that is not one PRIMARY and one STANDBY input', () => {
    // ELSEWHERE: the seeded registry has no MIC-03.
    const plain = harness();
    const plainBefore = plain.state();
    const refused = plain.sim.request({ method: 'POST', path: CAPTURE_CONFIG_PATH, body: pair('MIC-03', 'MIC-02') });
    expect([refused.status, (refused.body as { error: { code: string } }).error.code]).toEqual([422, 'INVALID_INPUT']);
    expect(plain.state().captureConfig).toBe(plainBefore.captureConfig);
    expect(plain.state().audit.rows).toHaveLength(plainBefore.audit.rows.length);

    const h = harness();
    registerLocalMic(h);
    const before = h.state();
    const line = (inputId: string, role?: string, deviceId = inputId) => ({ inputId, deviceId, ...(role === undefined ? {} : { role }) });
    const bodies: Record<string, unknown> = {
      'a single line with a role': { mics: [line('MIC-03', 'PRIMARY')] },
      'the two forms mixed': { mics: [line('MIC-03', 'PRIMARY'), line('MIC-02')] },
      'two PRIMARY lines': { mics: [line('MIC-03', 'PRIMARY'), line('MIC-02', 'PRIMARY')] },
      'two STANDBY lines': { mics: [line('MIC-03', 'STANDBY'), line('MIC-02', 'STANDBY')] },
      'one input twice': { mics: [line('MIC-03', 'PRIMARY'), line('MIC-03', 'STANDBY')] },
      'a device that is not the input': { mics: [line('MIC-03', 'PRIMARY', 'MIC-01'), line('MIC-02', 'STANDBY')] },
      'a microphone the registry does not hold': { mics: [line('MIC-07', 'PRIMARY'), line('MIC-02', 'STANDBY')] },
      'a camera behind a mic input': { mics: [line('MIC-03', 'PRIMARY', 'CAM-01'), line('MIC-02', 'STANDBY')] },
      'an input id outside MIC-NN': { mics: [line('MIC-3', 'PRIMARY'), line('MIC-02', 'STANDBY')] },
      'a role outside the two': { mics: [line('MIC-03', 'ACTIVE'), line('MIC-02', 'STANDBY')] },
      // The earlier form cannot name a new input: it edits an input the selector holds.
      'the earlier form naming MIC-03': { mics: [line('MIC-03')] },
    };
    for (const [name, body] of Object.entries(bodies)) {
      const answer = h.sim.request({ method: 'POST', path: CAPTURE_CONFIG_PATH, body });
      expect([answer.status, (answer.body as { error?: { code?: string } }).error?.code], name).toEqual([422, 'INVALID_INPUT']);
    }
    expect(h.state().captureConfig).toBe(before.captureConfig);
    expect(h.state().audit.rows).toHaveLength(before.audit.rows.length);
    // A role without CAPTURE_CONFIG is refused before the pair is looked at.
    const investigator = harness('idle', 'INVESTIGATOR');
    expect(investigator.sim.request({ method: 'POST', path: CAPTURE_CONFIG_PATH, body: pair('MIC-02', 'MIC-01') }).status).toBe(403);
  });

  it('the transition holds the rule itself (the Core runs it as the hosted action), and the earlier form still edits an input', () => {
    const h = harness();
    registerLocalMic(h);
    const state = h.state();
    const change = (mics: NonNullable<Extract<CaptureConfigChange, { kind: 'UPDATE' }>['mics']>): CaptureConfigChange => ({ kind: 'UPDATE', mics });
    expect(() => setCaptureConfigTransition(state, START, change([{ inputId: 'MIC-03', deviceId: 'MIC-03', role: 'PRIMARY' }]))).toThrow(SimTransitionError);
    expect(() => setCaptureConfigTransition(state, START, change([{ inputId: 'MIC-03', deviceId: 'MIC-01', role: 'PRIMARY' }, { inputId: 'MIC-02', deviceId: 'MIC-02', role: 'STANDBY' }]))).toThrow(/microphone of the same ID/);
    const replaced = setCaptureConfigTransition(state, START, change([{ inputId: 'MIC-02', deviceId: 'MIC-02', role: 'STANDBY' }, { inputId: 'MIC-03', deviceId: 'MIC-03', role: 'PRIMARY' }]));
    expect(replaced.captureConfig.mics.map((mic) => [mic.inputId, mic.role])).toEqual([['MIC-02', 'STANDBY'], ['MIC-03', 'PRIMARY']]);
    // The earlier form on the replaced selector: a transport edit of an input it holds.
    const edited = setCaptureConfigTransition(replaced, START + 1, change([{ inputId: 'MIC-03', deviceId: 'MIC-03', transport: 'AVFOUNDATION' }]));
    expect(edited.captureConfig.mics.find((mic) => mic.inputId === 'MIC-03')).toMatchObject({ role: 'PRIMARY', transport: 'AVFOUNDATION' });
    expect(() => setCaptureConfigTransition(replaced, START + 1, change([{ inputId: 'MIC-01', deviceId: 'MIC-01' }]))).toThrow(/no such mic input/);
  });
});

describe('2. the session audio source, operation 81 and the meters name an input by MIC-NN', () => {
  const BAD_IDS = ['MIC-3', 'AUDIO-01', 'CAM-03', 'mic-03', ''];

  it('the session payload: active and standby input of both session schemas', () => {
    const h = harness('recording');
    const session = h.state().session;
    if (session === null || session.audioSource === null || session.audioSource === undefined) throw new Error('the recording scenario holds no audio source');
    const source = { ...session.audioSource, activeInputId: 'MIC-03', standbyInputId: 'MIC-02' };
    expect(ActiveSessionSchema.safeParse({ ...session, audioSource: source }).success).toBe(true);
    for (const bad of BAD_IDS) {
      expect(ActiveSessionSchema.safeParse({ ...session, audioSource: { ...source, activeInputId: bad } }).success, bad).toBe(false);
      expect(ActiveSessionSchema.safeParse({ ...session, audioSource: { ...source, standbyInputId: bad } }).success, bad).toBe(false);
    }
    const resource = SessionResourceSchema.shape.audioSource;
    const { sessionId: _sessionId, ...wire } = source;
    expect(resource.safeParse(wire).success).toBe(true);
    expect(resource.safeParse({ ...wire, activeInputId: 'MIC-3' }).success).toBe(false);
  });

  it('operation 81: the body, the answer and an interval of operation 82', () => {
    expect(AudioSourceSwitchRequestSchema.safeParse({ inputId: 'MIC-03' }).success).toBe(true);
    const state = { sessionId: 'SES-20261001-0001', activeInputId: 'MIC-03', standbyInputId: 'MIC-02', switchedAt: START, intervalFromMs: 1200 };
    expect(AudioSourceStateSchema.safeParse(state).success).toBe(true);
    const interval = { sessionId: 'SES-20261001-0001', seq: 1, inputId: 'MIC-03', role: 'PRIMARY', fromMs: 0, toMs: null, fromAt: START, toAt: null, switchedBy: null, reason: 'START' };
    expect(AudioSourceIntervalEntrySchema.safeParse(interval).success).toBe(true);
    for (const bad of BAD_IDS) {
      expect(AudioSourceSwitchRequestSchema.safeParse({ inputId: bad }).success, bad).toBe(false);
      expect(AudioSourceStateSchema.safeParse({ ...state, activeInputId: bad }).success, bad).toBe(false);
      expect(AudioSourceIntervalEntrySchema.safeParse({ ...interval, inputId: bad }).success, bad).toBe(false);
    }
  });

  it('the meters slice is keyed by the two inputs of the capture, whichever they are', () => {
    const h = harness('recording');
    const audio = h.state().audio;
    expect(AudioSliceSchema.safeParse(audio).success).toBe(true);
    const frame = audio.inputs['MIC-01'];
    const replaced = { inputs: { 'MIC-02': frame, 'MIC-03': frame }, activeInputId: 'MIC-03' };
    expect(AudioSliceSchema.safeParse(replaced).success).toBe(true);
    // Exactly two inputs, each keyed by an input id, each a whole frame.
    expect(AudioSliceSchema.safeParse({ ...replaced, inputs: { 'MIC-01': frame, 'MIC-02': frame, 'MIC-03': frame } }).success).toBe(false);
    expect(AudioSliceSchema.safeParse({ ...replaced, inputs: { 'MIC-03': frame } }).success).toBe(false);
    expect(AudioSliceSchema.safeParse({ ...replaced, inputs: { 'MIC-02': frame, 'AUDIO-01': frame } }).success).toBe(false);
    expect(AudioSliceSchema.safeParse({ ...replaced, inputs: { 'MIC-02': frame, 'MIC-03': { ...frame, dbfs: 'loud' } } }).success).toBe(false);
    for (const bad of BAD_IDS) expect(AudioSliceSchema.safeParse({ ...replaced, activeInputId: bad }).success, bad).toBe(false);
  });

  it('the audio status entry names the input by the same rule', () => {
    const h = harness();
    const answer = h.sim.request({ method: 'GET', path: '/api/v1/audio/status' });
    const entry = (answer.body as { channels: Record<string, unknown>[] }).channels[0];
    expect(AudioChannelStatusSchema.safeParse(entry).success).toBe(true);
    expect(AudioChannelStatusSchema.safeParse({ ...entry, inputId: 'MIC-03', deviceId: 'MIC-03' }).success).toBe(true);
    for (const bad of BAD_IDS) expect(AudioChannelStatusSchema.safeParse({ ...entry, inputId: bad }).success, bad).toBe(false);
  });

  it('the simulated operation 81: any MIC-NN is well formed, only an input of the session can become active', () => {
    const h = harness('recording', 'INVESTIGATOR');
    const session = h.state().session;
    if (session === null) throw new Error('the recording scenario holds no session');
    const path = `/api/v1/session/${session.id}/audio-source`;
    const before = h.state();
    for (const bad of ['MIC-3', 'AUDIO-01', 7]) expect(h.sim.request({ method: 'POST', path, body: { inputId: bad } }).status, String(bad)).toBe(422);
    const other = h.sim.request({ method: 'POST', path, body: { inputId: 'MIC-07' } });
    expect([other.status, (other.body as { error: { code: string } }).error.code]).toEqual([409, 'AUDIO_SOURCE_CONFLICT']);
    expect(h.state().session).toBe(before.session);
    expect(h.state().audit.rows).toHaveLength(before.audit.rows.length);
    // CONTROL: the standby input of the session is accepted and becomes the active one.
    const standby = before.session?.audioSource?.standbyInputId;
    const switched = h.sim.request({ method: 'POST', path, body: { inputId: standby } });
    expect(switched.status).toBe(200);
    expect(AudioSourceStateSchema.safeParse(switched.body).success).toBe(true);
    expect(h.state().audio.activeInputId).toBe(standby);
  });
});

describe('3. developmentSources on the evidence item', () => {
  it('an optional boolean or null; absent and null are "not recorded", and nothing else is taken', () => {
    expect(EvidenceItemSchema.safeParse(EXAMPLE_EVIDENCE_ITEM).success).toBe(true);
    expect('developmentSources' in EXAMPLE_EVIDENCE_ITEM).toBe(false);
    for (const value of [true, false, null]) {
      const parsed = EvidenceItemSchema.safeParse({ ...EXAMPLE_EVIDENCE_ITEM, developmentSources: value });
      expect(parsed.success, String(value)).toBe(true);
      // The value is carried as it is: null is never turned into false (never read as production).
      if (parsed.success) expect(parsed.data.developmentSources).toBe(value);
    }
    for (const bad of ['true', 'DEVELOPMENT', 0, 1, {}]) expect(EvidenceItemSchema.safeParse({ ...EXAMPLE_EVIDENCE_ITEM, developmentSources: bad }).success, String(bad)).toBe(false);
    // CONTROL: the item is strict - a neighbouring unknown member is still refused.
    expect(EvidenceItemSchema.safeParse({ ...EXAMPLE_EVIDENCE_ITEM, developmentSource: true }).success).toBe(false);
  });

  it('an item of the simulator state carries the member through the slice schema', () => {
    const h = harness();
    const item = h.state().evidence[0];
    if (item === undefined) throw new Error('the dataset holds no evidence item');
    // The dataset items are v1: the member is absent (not recorded).
    expect('developmentSources' in item).toBe(false);
    const marked: typeof item = { ...item, developmentSources: true };
    expect(EvidenceItemSchema.safeParse(marked).success).toBe(true);
  });
});

describe('8. an audit row carries an endpoint reference only in the form urn:uuid:<UUID>', () => {
  const URN = 'urn:uuid:4f1c2b7a-9d3e-4a56-8b0c-1e2f3a4b5c6d';
  const tested = (endpointRef: string | null, sourceClass: 'PRODUCTION' | 'DEVELOPMENT' = 'PRODUCTION') =>
    captureConnectionTestedDetails({ candidateId: 'CND-000001', searchId: 'SRCH-000001', outcome: 'REACHABLE', authenticated: true, adapter: 'ONVIF_RTSP', sourceClass, operationId: 'testCaptureCandidateConnection', host: '192.0.2.7', endpointRef });
  const adopted = (endpointRef: string | null) =>
    captureCandidateAdoptedDetails({ deviceId: 'CAM-03', candidateId: 'CND-000001', searchId: 'SRCH-000001', adapter: 'ONVIF_RTSP', sourceClass: 'PRODUCTION', credentialSet: true, host: '192.0.2.7', endpointRef });

  it('a valid URN stays, in both rows and in either letter case', () => {
    expect(tested(URN)).toMatchObject({ host: '192.0.2.7', endpointRef: URN });
    expect(adopted(URN)).toMatchObject({ host: '192.0.2.7', endpointRef: URN });
    expect(tested(URN.toUpperCase().replace('URN:UUID:', 'urn:uuid:'))['endpointRef']).toBe(URN.toUpperCase().replace('URN:UUID:', 'urn:uuid:'));
    expect(CAPTURE_ENDPOINT_REF_PATTERN.test(URN)).toBe(true);
  });

  it('free text, a uuid: without urn:, a bare UUID and a padded URN are left out; the host stays', () => {
    const refused = ['front door camera', 'uuid:4f1c2b7a-9d3e-4a56-8b0c-1e2f3a4b5c6d', '4f1c2b7a-9d3e-4a56-8b0c-1e2f3a4b5c6d', `${URN} `, `${URN}\n`, `${URN}/admin:secret`, 'urn:uuid:not-a-uuid', 'http://192.0.2.7/onvif/device_service', ''];
    for (const value of refused) {
      for (const details of [tested(value), adopted(value)]) {
        expect('endpointRef' in details, JSON.stringify(value)).toBe(false);
        expect(details['host'], JSON.stringify(value)).toBe('192.0.2.7');
        expect(JSON.stringify(details)).not.toContain('secret');
      }
    }
    expect('endpointRef' in tested(null)).toBe(false);
  });

  it('CONTROL: a candidate that is not PRODUCTION carries neither member, valid URN or not (D86 C-3)', () => {
    const details = tested(URN, 'DEVELOPMENT');
    expect('endpointRef' in details || 'host' in details).toBe(false);
  });
});

describe('10. meter channel -> microphone input: the order of the microphone lines, whatever their ids (ruling D137)', () => {
  const line = (inputId: string) => ({ inputId });

  it('the rule: channel 1 is the first line, channel 2 the second; the built-in pair gives the old table', () => {
    const builtIn = [line('MIC-01'), line('MIC-02')];
    expect([micInputOfChannel(builtIn, 'AUDIO-01'), micInputOfChannel(builtIn, 'AUDIO-02')]).toEqual(['MIC-01', 'MIC-02']);
    const replaced = [line('MIC-01'), line('MIC-03')];
    expect([micInputOfChannel(replaced, 'AUDIO-01'), micInputOfChannel(replaced, 'AUDIO-02')]).toEqual(['MIC-01', 'MIC-03']);
    expect([channelOfMicLine(replaced, 'MIC-01'), channelOfMicLine(replaced, 'MIC-03'), channelOfMicLine(replaced, 'MIC-02')]).toEqual(['AUDIO-01', 'AUDIO-02', null]);
    const beyond = [line('MIC-02'), line('MIC-03')];
    expect([micInputOfChannel(beyond, 'AUDIO-01'), micInputOfChannel(beyond, 'AUDIO-02')]).toEqual(['MIC-02', 'MIC-03']);
    // No line at all (a hand-built state): the built-in pair.
    expect([micInputOfChannel([], 'AUDIO-01'), micInputOfChannel([], 'AUDIO-02')]).toEqual(['MIC-01', 'MIC-02']);
  });

  it('with the pair MIC-03 (primary) / MIC-01 (standby) both meters read, and the active / standby roles resolve', () => {
    const h = harness();
    registerLocalMic(h);
    expect(h.sim.request({ method: 'POST', path: CAPTURE_CONFIG_PATH, body: pair('MIC-03', 'MIC-01') }).status).toBe(200);
    const lines = captureMicLines(h.state());
    expect(lines.map((mic) => [mic.inputId, mic.role])).toEqual([['MIC-01', 'STANDBY'], ['MIC-03', 'PRIMARY']]);
    // The replacement re-keyed the meters at once: two frames, the two inputs of the pair, the PRIMARY active.
    expect(Object.keys(h.state().audio.inputs).sort()).toEqual(['MIC-01', 'MIC-03']);
    expect(h.state().audio.activeInputId).toBe('MIC-03');
    expect(AudioSliceSchema.safeParse(h.state().audio).success).toBe(true);

    // BOTH METERS READ: the 20 Hz subsystem writes a new frame per input, and only those two.
    const before = h.state().audio.inputs;
    h.clock.advance(1_000);
    h.sim.tick();
    const audio = h.state().audio;
    expect(Object.keys(audio.inputs).sort()).toEqual(['MIC-01', 'MIC-03']);
    for (const inputId of ['MIC-01', 'MIC-03']) {
      const frame = audio.inputs[inputId];
      expect(frame, inputId).toBeDefined();
      expect(frame?.noSignal, inputId).toBe(false);
      expect(frame?.at, inputId).toBeGreaterThan(before[inputId]?.at ?? Number.MAX_SAFE_INTEGER);
      expect(Number.isFinite(frame?.dbfs), inputId).toBe(true);
    }
    expect('MIC-02' in audio.inputs).toBe(false);
    expect(AudioSliceSchema.safeParse(audio).success).toBe(true);

    // THE ROLES RESOLVE: the audio status names the two inputs with the roles and devices of their lines.
    const status = h.sim.request({ method: 'GET', path: '/api/v1/audio/status' }).body as { channels: { inputId: string; deviceId: string; role: string; noSignal: boolean }[]; activeInputId: string };
    expect(status.channels.map((entry) => [entry.inputId, entry.deviceId, entry.role, entry.noSignal])).toEqual([
      ['MIC-01', 'MIC-01', 'STANDBY', false],
      ['MIC-03', 'MIC-03', 'PRIMARY', false],
    ]);
    expect(status.activeInputId).toBe('MIC-03');
    for (const entry of status.channels) expect(AudioChannelStatusSchema.safeParse(entry).success).toBe(true);
    expect([micInputOfCaptureRole(h.state(), 'PRIMARY'), micInputOfCaptureRole(h.state(), 'STANDBY')]).toEqual(['MIC-03', 'MIC-01']);
    // The mic slice (the two meter channels) carries the capture role of its line; the active input is channel 2.
    expect(h.state().mics.map((mic) => [mic.id, mic.micRole])).toEqual([['AUDIO-01', 'STANDBY'], ['AUDIO-02', 'PRIMARY']]);
    expect(activeMeterChannel(h.state())).toBe('AUDIO-02');
  });

  it('a measured level and a silence warning reach the channel of their own input, never another microphone\'s', () => {
    const h = harness();
    registerLocalMic(h);
    expect(h.sim.request({ method: 'POST', path: CAPTURE_CONFIG_PATH, body: pair('MIC-03', 'MIC-01') }).status).toBe(200);
    const state = h.state();
    // The worker reports by ROLE: the PRIMARY level is MIC-03's, the STANDBY level MIC-01's.
    const runtime = createAudioRuntime('external');
    feedCaptureLevels(runtime, state, START, [{ role: 'PRIMARY', dbfs: -6.25, clipped: false }, { role: 'STANDBY', dbfs: -30, clipped: false }]);
    expect([runtime.captureLevels['MIC-03']?.dbfs, runtime.captureLevels['MIC-01']?.dbfs, runtime.captureLevels['MIC-02']]).toEqual([-6.25, -30, undefined]);
    // A silence warning of MIC-03 is channel 2's; without a subject it is the active input's - the same channel here.
    for (const subject of ['MIC-03', 'PRIMARY', null]) {
      const raised = raiseCaptureWarningTransition(state, START, { code: 'MIC_SILENT', subject });
      expect(raised.faults.active.filter((fault) => fault.kind === 'MIC_SILENT').map((fault) => fault.target), String(subject)).toEqual(['AUDIO-02']);
    }
    expect(raiseCaptureWarningTransition(state, START, { code: 'MIC_SILENT', subject: 'MIC-01' }).faults.active.filter((fault) => fault.kind === 'MIC_SILENT').map((fault) => fault.target)).toEqual(['AUDIO-01']);
    // CONTROL: MIC-02 left the pair - it is no microphone of this capture.
    expect(() => raiseCaptureWarningTransition(state, START, { code: 'MIC_SILENT', subject: 'MIC-02' })).toThrow();
  });

  it('CONTROL: the built-in pair meters exactly as before - MIC-01 on channel 1, MIC-02 on channel 2', () => {
    const h = harness();
    h.clock.advance(1_000);
    h.sim.tick();
    expect(Object.keys(h.state().audio.inputs).sort()).toEqual(['MIC-01', 'MIC-02']);
    expect(h.state().audio.activeInputId).toBe('MIC-01');
    expect(activeMeterChannel(h.state())).toBe('AUDIO-01');
  });
});

describe('12. operations 42, 87 and 88: additive and optional (ruling D140)', () => {
  it('op 88 takes an optional body that names the camera file, and nothing else', () => {
    for (const body of [{}, { fileId: 'VIDEO-01' }, { fileId: 'VIDEO-02' }]) expect(EvidenceMediaSessionRequestSchema.safeParse(body).success, JSON.stringify(body)).toBe(true);
    for (const body of [{ fileId: 'AUDIO-01' }, { fileId: 'VIDEO-03' }, { fileId: 1 }, { fileId: 'VIDEO-01', token: 'x' }, { file: 'VIDEO-01' }, 'VIDEO-01', null]) {
      expect(EvidenceMediaSessionRequestSchema.safeParse(body).success, JSON.stringify(body)).toBe(false);
    }
    const operation = findCoreApiOperation('createEvidenceMediaSession');
    expect(operation?.requestBody).toEqual({ schema: 'EvidenceMediaSessionRequest', required: false });
    expect(Object.keys(operation?.responses ?? {}).map(Number).sort((a, b) => a - b)).toEqual([201, 400, 401, 403, 404, 409, 422]);
    for (const code of ['EVIDENCE_CASE_SCOPE', 'MEDIA_NOT_AVAILABLE', 'PACKAGE_MISSING', 'SESSION_KEY_UNAVAILABLE', 'MEDIA_SESSION_INVALID', 'MEDIA_SESSION_EXPIRED', 'CREDENTIAL_STORE_NOT_READY']) {
      expect(operation?.description, code).toContain(code);
    }
  });

  it('op 42: the 202 may carry the job id in the EXPJ- form; the request names its kind; 409 documents EXPORT_IN_PROGRESS', () => {
    const accepted = { exportId: 'EXP-000012', evidenceId: 'EV-20260930-0004', status: 'QUEUED' };
    expect(EvidenceExportAcceptedSchema.safeParse(accepted).success).toBe(true);
    expect(EvidenceExportAcceptedSchema.safeParse({ ...accepted, jobId: 'EXPJ-000012' }).success).toBe(true);
    for (const bad of ['EXP-000012', 'EXPJ-12', 'expj-000012', '']) expect(EvidenceExportAcceptedSchema.safeParse({ ...accepted, jobId: bad }).success, bad).toBe(false);
    const request = { reason: 'Case file handover for prosecutor review' };
    for (const kind of ['PACKAGE', 'COMPOSITE']) expect(EvidenceExportRequestSchema.safeParse({ ...request, kind }).success, kind).toBe(true);
    expect(EvidenceExportRequestSchema.safeParse({ ...request, kind: 'ARCHIVE' }).success).toBe(false);
    expect(findCoreApiOperation('exportEvidence')?.responses[409]?.description).toContain('EXPORT_IN_PROGRESS');
    const job = { jobId: 'EXPJ-000012', evidenceId: 'EV-20260930-0004', kind: 'COMPOSITE', status: 'FAILED', progressPct: 0, etaMs: null, derived: true, createdAt: START };
    for (const failureReason of ['COMPOSITE_ENCODER_NOT_SELECTED', 'EXPORT_INTERRUPTED']) expect(EvidenceExportJobSchema.safeParse({ ...job, failureReason }).success, failureReason).toBe(true);
    expect(EvidenceExportJobSchema.safeParse({ ...job, failureReason: 'not a code' }).success).toBe(false);
    for (const code of ['COMPOSITE_ENCODER_NOT_SELECTED', 'EXPORT_INTERRUPTED']) expect(EvidenceExportJobSchema.shape.failureReason.description, code).toContain(code);
  });

  it('the simulator: the 202 names the job, the request row carries the kind that was named, and op 87 answers that job', () => {
    const h = harness('idle', 'INVESTIGATOR');
    h.sim.actions.signOut();
    const supervisor = OPERATORS.find((candidate) => candidate.role === 'SUPERVISOR');
    if (supervisor === undefined) throw new Error('no seeded supervisor');
    expect(h.sim.actions.signIn(supervisor.username, DEMO_OPERATOR_PASSWORD)).toMatchObject({ ok: true });
    const sealed = h.state().evidence.find((item) => item.status === 'SEALED');
    if (sealed === undefined) throw new Error('the dataset holds no sealed item');
    const path = `/api/v1/evidence/${sealed.id}/export`;
    const reason = 'Case file handover for prosecutor review';

    const composite = h.sim.request({ method: 'POST', path, body: { reason, kind: 'COMPOSITE' } });
    expect(composite.status).toBe(202);
    const receipt = composite.body as { exportId: string; jobId: string };
    expect(EvidenceExportAcceptedSchema.safeParse(receipt).success).toBe(true);
    expect(receipt.jobId).toBe(`EXPJ-${receipt.exportId.slice('EXP-'.length)}`);
    expect(h.state().audit.rows.at(-1)).toMatchObject({ type: 'EVIDENCE_EXPORTED', details: { exportId: receipt.exportId, kind: 'COMPOSITE' } });
    const job = h.sim.request({ method: 'GET', path: `/api/v1/evidence/exports/${receipt.jobId}` });
    expect(job.status).toBe(200);
    expect(EvidenceExportJobSchema.safeParse(job.body).success).toBe(true);
    expect(job.body).toMatchObject({ jobId: receipt.jobId, evidenceId: sealed.id, kind: 'COMPOSITE', derived: true, status: 'COMPLETE' });

    // A request that names no kind writes none (the row is what it was before; absent reads as PACKAGE).
    const plain = h.sim.request({ method: 'POST', path, body: { reason } });
    expect(plain.status).toBe(202);
    expect('kind' in (h.state().audit.rows.at(-1)?.details ?? {})).toBe(false);
    expect(h.sim.request({ method: 'GET', path: `/api/v1/evidence/exports/${(plain.body as { jobId: string }).jobId}` }).body).toMatchObject({ kind: 'PACKAGE', derived: false });
    // A kind outside the two is not written either.
    h.sim.request({ method: 'POST', path, body: { reason, kind: 'ARCHIVE' } });
    expect('kind' in (h.state().audit.rows.at(-1)?.details ?? {})).toBe(false);
  });
});

describe('13. advisory notices and two documented reasons (ruling D144)', () => {
  it('the two reasons are documented on the answers they belong to', () => {
    expect([CAPTURE_NOT_DURABLE_REASON, CAPTURE_HELPERS_LEFT_REASON]).toEqual(['CAPTURE_NOT_DURABLE', 'CAPTURE_HELPERS_LEFT']);
    expect(findCoreApiOperation('stopSession')?.coreServerDescription).toContain('`409 INVALID_STATE` with `details.reason: CAPTURE_NOT_DURABLE`');
    expect(findCoreApiOperation('startSession')?.coreServerDescription).toContain('`503 NOT_READY` with `details.reason: CAPTURE_HELPERS_LEFT`');
  });

  it('each advisory notice is one SYSTEM alert of severity INFO on its own device: no fault, no audit row, no device state', () => {
    const h = harness('recording');
    const before = h.state();
    const cases = [
      ['KEYFRAME_INTERVAL_ABOVE_BOUND', 'CAM-02', 'CAMERA'],
      ['AV_OFFSET_NEAR_BOUND', 'CAM-02', 'CAMERA'],
      ['MIC_RATE_AT_LIMIT', 'MIC-01', 'MIC'],
    ] as const;
    expect(cases.map(([code]) => code).sort()).toEqual(Object.values(CaptureAdvisoryReason).sort());
    for (const [code, subject] of cases) h.sim.actions.raiseCaptureWarning({ code, subject });
    const raised = h.state();
    const alerts = raised.alerts.filter((alert) => alert.active && alert.kind === 'SYSTEM' && !before.alerts.includes(alert));
    expect(alerts.map((alert) => [alert.severity, alert.target, alert.params])).toEqual(
      cases.map(([code, subject, deviceKind]) => ['INFO', subject, { reason: code, deviceId: subject, deviceKind, sessionId: before.session?.id }]),
    );
    expect(REPLICATED_SLICE_SCHEMAS.alerts.safeParse(raised.alerts).success).toBe(true);
    // Advice only: nothing else of the state moved.
    expect(raised.faults).toBe(before.faults);
    expect(raised.audit.rows).toHaveLength(before.audit.rows.length);
    expect(raised.captureDevices).toBe(before.captureDevices);
    expect(raised.session?.state).toBe('RECORDING');
    // A second raise while it is active writes nothing.
    h.sim.actions.raiseCaptureWarning({ code: 'MIC_RATE_AT_LIMIT', subject: 'MIC-01' });
    expect(h.state().alerts).toBe(raised.alerts);

    // THREE conditions of ONE microphone are three alerts: the rate notice, the silence fault, a capture fault.
    h.sim.actions.raiseCaptureWarning({ code: 'MIC_SILENT', subject: 'MIC-01' });
    h.sim.actions.raiseCaptureWarning({ code: 'CAPTURE_FAULT', subject: 'MIC-01' });
    const three = h.state().alerts.filter((alert) => alert.active && !before.alerts.includes(alert) && (alert.target === 'MIC-01' || alert.target === 'AUDIO-01'));
    expect(three).toHaveLength(3);
    expect(new Set(three.map((alert) => alert.id)).size).toBe(3);

    // A clear resolves exactly its own alert; the two faults of the microphone stay.
    h.sim.actions.clearCaptureWarning({ code: 'MIC_RATE_AT_LIMIT', subject: 'MIC-01' });
    expect(activeCaptureNotice(h.state(), 'MIC_RATE_AT_LIMIT', 'MIC-01')).toBeUndefined();
    expect(activeCaptureNotice(h.state(), 'AV_OFFSET_NEAR_BOUND', 'CAM-02')).toBeDefined();
    expect(h.state().faults.active.map((fault) => fault.kind).sort()).toEqual(['CAPTURE_FAULT', 'MIC_SILENT']);
  });

  it('a notice about a device of the other class, or about no device of the registry, is refused and writes nothing', () => {
    const h = harness('recording');
    const before = h.state().alerts;
    expect(() => h.sim.actions.raiseCaptureWarning({ code: 'MIC_RATE_AT_LIMIT', subject: 'CAM-01' })).toThrow();
    expect(() => h.sim.actions.raiseCaptureWarning({ code: 'KEYFRAME_INTERVAL_ABOVE_BOUND', subject: 'MIC-01' })).toThrow();
    expect(() => h.sim.actions.raiseCaptureWarning({ code: 'AV_OFFSET_NEAR_BOUND', subject: 'CAM-77' })).toThrow();
    expect(h.state().alerts).toBe(before);
  });
});
