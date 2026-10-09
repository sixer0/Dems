// Integration pass C1 (decision D120): three seams of the shared contract.
//
//   1. the mic input id rule: `MIC-NN`, the numbered form a camera has (decisions D106 (4), D115 (2));
//   2. `captureDurable` on the session payload (decisions D84, D91 R-1 option A);
//   3. `manifestVersion` / `labelsStatus` on the evidence item (row 129b; dbc-3 §B.11).
//
// Every acceptance has its refusal beside it: a rule that admits everything proves nothing.
import { describe, expect, it } from 'vitest';
import {
  ActiveSessionSchema,
  CaptureConfigMicUpdateSchema,
  CaptureConfigSliceSchema,
  CaptureInputScanEntrySchema,
  EXAMPLE_EVIDENCE_ITEM,
  EvidenceItemSchema,
  MIC_INPUT_ID_PATTERN,
  SessionResourceSchema,
} from '../src/api';
import {
  DEMO_OPERATOR_PASSWORD,
  OPERATORS,
  SimNotFoundError,
  SimTransitionError,
  audioSourceAtStart,
  builtInMicInputOf,
  captureDurableOf,
  captureDurableTransition,
  channelOfMicInput,
  createManualClock,
  createSim,
  micInputOfCaptureRole,
  raiseCaptureWarningTransition,
  setCaptureConfigTransition,
  type CaptureConfigMic,
  type CaptureDeviceStatus,
  type ScenarioName,
  type SimState,
} from '../src/sim';

const START = Date.UTC(2026, 9, 1, 3, 0, 0);

function harness(scenario: ScenarioName = 'idle') {
  const clock = createManualClock(START);
  const sim = createSim({ clock, storage: null, authStorage: null, scenario });
  const operator = OPERATORS.find((candidate) => candidate.role === 'TECHNICIAN');
  if (operator === undefined) throw new Error('no seeded technician');
  expect(sim.actions.signIn(operator.username, DEMO_OPERATOR_PASSWORD)).toMatchObject({ ok: true });
  return { sim, clock, state: () => sim.store.getState() };
}

/** The local microphone as row 136 registers it: a NEW device with its own id (D106 (4)). */
const LOCAL_MIC: CaptureDeviceStatus = { id: 'MIC-03', kind: 'MIC', model: 'MacBook Air Microphone', firmware: null, host: null, poePort: null, online: true, streamState: null, capabilities: [] };
const line = (id: string, role: CaptureConfigMic['role']): CaptureConfigMic => ({ inputId: id, deviceId: id, role, transport: role === 'PRIMARY' ? 'AVFOUNDATION' : 'USB', online: true });

/** A state whose selector holds `MIC-03` beside `MIC-02`, as a Core rehydrates it from a stored row. */
function withLocalMic(state: SimState, primary: 'MIC-02' | 'MIC-03'): SimState {
  return {
    ...state,
    captureDevices: { devices: [...state.captureDevices.devices, LOCAL_MIC] },
    captureConfig: { ...state.captureConfig, mics: [line('MIC-02', primary === 'MIC-02' ? 'PRIMARY' : 'STANDBY'), line('MIC-03', primary === 'MIC-03' ? 'PRIMARY' : 'STANDBY')] },
  };
}

describe('1. the mic input id rule is MIC-NN', () => {
  it('the pattern is the stored rule of capture_devices: MIC- and two or more digits, nothing else', () => {
    expect(MIC_INPUT_ID_PATTERN.source).toBe('^MIC-\\d{2,}$');
    for (const id of ['MIC-01', 'MIC-02', 'MIC-03', 'MIC-10', 'MIC-123']) expect(MIC_INPUT_ID_PATTERN.test(id), id).toBe(true);
    for (const id of ['MIC-3', 'MIC-', 'MIC-0A', 'mic-03', 'CAM-03', ' MIC-03', 'MIC-03 ', 'MIC-03\n', 'AUDIO-01', 'MIC-PRIMARY', '']) expect(MIC_INPUT_ID_PATTERN.test(id), JSON.stringify(id)).toBe(false);
  });

  it('slice 29 admits a selector with MIC-03 as PRIMARY, and still refuses an id outside the form', () => {
    const h = harness();
    const selector = withLocalMic(h.state(), 'MIC-03').captureConfig;
    expect(CaptureConfigSliceSchema.safeParse(selector).success).toBe(true);
    for (const bad of ['MIC-3', 'CAM-03', 'AUDIO-01', '']) {
      const broken = { ...selector, mics: [selector.mics[0], { ...selector.mics[1], inputId: bad }] };
      expect(CaptureConfigSliceSchema.safeParse(broken).success, bad).toBe(false);
    }
  });

  it('the op 78 mic line, the op 97 entry and the session snapshot follow the same rule', () => {
    expect(CaptureConfigMicUpdateSchema.safeParse({ inputId: 'MIC-03', deviceId: 'MIC-03' }).success).toBe(true);
    expect(CaptureConfigMicUpdateSchema.safeParse({ inputId: 'MIC-3', deviceId: 'MIC-03' }).success).toBe(false);
    expect(CaptureConfigMicUpdateSchema.safeParse({ inputId: 'CAM-03', deviceId: 'CAM-03' }).success).toBe(false);
    const entry = { deviceId: 'MIC-03', inputId: 'MIC-03', present: true, adapter: 'LOCAL_DEVICE', sourceClass: 'DEVELOPMENT', errorCode: null };
    expect(CaptureInputScanEntrySchema.safeParse(entry).success).toBe(true);
    expect(CaptureInputScanEntrySchema.safeParse({ ...entry, inputId: null }).success).toBe(true);
    expect(CaptureInputScanEntrySchema.safeParse({ ...entry, inputId: 'MIC-3' }).success).toBe(false);
  });

  it('setPrimaryMic on a selector holding MIC-03: exactly one PRIMARY and one STANDBY, input order, deviceId equals inputId', () => {
    const h = harness();
    const before = withLocalMic(h.state(), 'MIC-02');
    const after = setCaptureConfigTransition(before, START + 1_000, { kind: 'PRIMARY_MIC', inputId: 'MIC-03' });
    expect(after.captureConfig.mics.map((mic) => [mic.inputId, mic.deviceId, mic.role])).toEqual([
      ['MIC-02', 'MIC-02', 'STANDBY'],
      ['MIC-03', 'MIC-03', 'PRIMARY'],
    ]);
    expect(CaptureConfigSliceSchema.safeParse(after.captureConfig).success).toBe(true);
    expect(after.audit.rows.at(-1)?.details).toMatchObject({ operationId: 'setPrimaryMic', inputId: 'MIC-03', deviceId: 'MIC-03', from: 'STANDBY', to: 'PRIMARY' });
    // The mic slice of the two built-in channels follows the roles it knows and invents none.
    expect(after.mics.map((mic) => mic.id)).toEqual(before.mics.map((mic) => mic.id));
    // And back: the role is a member of the row, the order does not move.
    const back = setCaptureConfigTransition(after, START + 2_000, { kind: 'PRIMARY_MIC', inputId: 'MIC-02' });
    expect(back.captureConfig.mics.map((mic) => [mic.inputId, mic.role])).toEqual([
      ['MIC-02', 'PRIMARY'],
      ['MIC-03', 'STANDBY'],
    ]);
    // CONTROL: an input the selector does not hold is refused, by name.
    expect(() => setCaptureConfigTransition(before, START, { kind: 'PRIMARY_MIC', inputId: 'MIC-04' })).toThrow(SimNotFoundError);
  });

  it('the simulator facade: op 78 refuses an id outside the form at the body check, and a well-formed input the selector does not hold as an invalid edit', () => {
    const h = harness();
    const post = (inputId: unknown) => h.sim.request({ method: 'POST', path: '/api/v1/capture/config', body: { mics: [{ inputId, deviceId: 'MIC-01' }] } });
    const rows = h.state().audit.rows.length;
    for (const bad of ['MIC-3', 'CAM-01', 7, null]) {
      const answer = post(bad);
      expect(answer.status, String(bad)).toBe(422);
      expect(JSON.stringify(answer.body)).toContain('mics.0.inputId');
    }
    const unknownSlot = post('MIC-03');
    expect(unknownSlot.status).toBe(422);
    expect(JSON.stringify(unknownSlot.body)).not.toContain('mics.0.inputId');
    expect(h.state().audit.rows).toHaveLength(rows);
    // CONTROL: the same body with a held input and its own device is accepted (and changes nothing).
    expect(h.sim.request({ method: 'POST', path: '/api/v1/capture/config', body: { mics: [{ inputId: 'MIC-01', deviceId: 'MIC-01' }] } }).status).toBe(200);
  });

  it('an input beyond the built-in pair has no meter channel and no session audio source: it is refused by name, never recorded as another microphone', () => {
    expect([builtInMicInputOf('MIC-01'), builtInMicInputOf('MIC-02'), builtInMicInputOf('MIC-03'), builtInMicInputOf('toString')]).toEqual(['MIC-01', 'MIC-02', null, null]);
    expect([channelOfMicInput('MIC-01'), channelOfMicInput('MIC-02'), channelOfMicInput('MIC-03')]).toEqual(['AUDIO-01', 'AUDIO-02', null]);
    const h = harness();
    const local = withLocalMic(h.state(), 'MIC-03');
    expect(() => audioSourceAtStart(local, 'SES-20261001-0001')).toThrow(SimTransitionError);
    expect(() => audioSourceAtStart(local, 'SES-20261001-0001')).toThrow(/MIC-03 has no session audio source/);
    // The STANDBY is held to the same rule.
    expect(() => audioSourceAtStart(withLocalMic(h.state(), 'MIC-02'), 'SES-20261001-0001')).toThrow(/MIC-03 has no session audio source/);
    // CONTROL: the built-in pair starts as before.
    expect(audioSourceAtStart(h.state(), 'SES-20261001-0001')).toMatchObject({ activeInputId: 'MIC-01', standbyInputId: 'MIC-02', intervalFromMs: 0 });
    // The meters and the silence warning: no channel is borrowed for MIC-03.
    expect(micInputOfCaptureRole(local, 'PRIMARY')).toBeNull();
    expect(micInputOfCaptureRole(local, 'STANDBY')).toBe('MIC-02');
    expect(() => raiseCaptureWarningTransition(local, START, { code: 'MIC_SILENT', subject: 'MIC-03' })).toThrow(SimNotFoundError);
  });
});

describe('2. captureDurable on the session payload', () => {
  it('both session schemas take the optional boolean and nothing else under that name', () => {
    const h = harness('recording');
    const session = h.state().session;
    if (session === null) throw new Error('the recording scenario holds no session');
    // The simulator has no notion of a fragment: it never writes the member, and absent reads as durable.
    expect('captureDurable' in session).toBe(false);
    expect(captureDurableOf(session)).toBe(true);
    expect(ActiveSessionSchema.safeParse(session).success).toBe(true);
    for (const durable of [true, false]) expect(ActiveSessionSchema.safeParse({ ...session, captureDurable: durable }).success, String(durable)).toBe(true);
    for (const bad of ['true', 1, null]) expect(ActiveSessionSchema.safeParse({ ...session, captureDurable: bad }).success, String(bad)).toBe(false);
    // CONTROL: the slice is strict - a neighbouring unknown member is still refused.
    expect(ActiveSessionSchema.safeParse({ ...session, captureDurableX: true }).success).toBe(false);

    const answer = h.sim.request({ method: 'GET', path: '/api/v1/session/current' });
    expect(answer.status).toBe(200);
    const resource = (answer.body as { session: object }).session;
    expect(SessionResourceSchema.safeParse(resource).success).toBe(true);
    expect('captureDurable' in resource).toBe(false);
    for (const durable of [true, false]) expect(SessionResourceSchema.safeParse({ ...resource, captureDurable: durable }).success).toBe(true);
    for (const bad of ['no', 1, null]) expect(SessionResourceSchema.safeParse({ ...resource, captureDurable: bad }).success, String(bad)).toBe(false);
  });

  it('the seam: the supervisor\'s report becomes the member; a repeated report and a report outside RECORDING change nothing', () => {
    const h = harness('recording');
    const recording = h.state();
    const connecting = captureDurableTransition(recording, false);
    expect(connecting.session?.captureDurable).toBe(false);
    expect(connecting.session?.state).toBe('RECORDING');
    expect(captureDurableOf(connecting.session)).toBe(false);
    expect(captureDurableTransition(connecting, false)).toBe(connecting);
    const durable = captureDurableTransition(connecting, true);
    expect(durable.session?.captureDurable).toBe(true);
    expect(captureDurableOf(durable.session)).toBe(true);
    expect(captureDurableTransition(durable, true)).toBe(durable);
    // Nothing but the one member moved: no audit row, no event, no other slice.
    const { session: _before, ...restBefore } = recording;
    const { session: after, ...restAfter } = durable;
    expect(restAfter).toEqual(restBefore);
    expect({ ...after, captureDurable: undefined }).toEqual({ ...recording.session, captureDurable: undefined });
    expect(ActiveSessionSchema.safeParse(after).success).toBe(true);
    // No session, or a session that does not record: the same state.
    const idle = harness('idle').state();
    expect(captureDurableTransition(idle, false)).toBe(idle);
    expect(captureDurableOf(null)).toBe(true);
    expect(captureDurableOf(undefined)).toBe(true);
  });
});

describe('3. the sealed columns of a v2 evidence item', () => {
  it('the strict item schema takes manifestVersion and labelsStatus as optional members, value by value', () => {
    expect(EvidenceItemSchema.safeParse(EXAMPLE_EVIDENCE_ITEM).success).toBe(true);
    const accepted: readonly object[] = [
      { manifestVersion: 2, labelsStatus: 'LABELLED' },
      { manifestVersion: 2, labelsStatus: 'UNAVAILABLE' },
      // A v2 seal with STT disabled: no transcript hash, no labels (ev §B.7a) - the row (2, NULL, NULL).
      { manifestVersion: 2, transcriptSha256: null, labelsStatus: null },
      { manifestVersion: 1 },
      { labelsStatus: null },
    ];
    for (const members of accepted) expect(EvidenceItemSchema.safeParse({ ...EXAMPLE_EVIDENCE_ITEM, ...members }).success, JSON.stringify(members)).toBe(true);
    const refused: readonly object[] = [{ manifestVersion: 3 }, { manifestVersion: 0 }, { manifestVersion: '2' }, { manifestVersion: null }, { labelsStatus: 'PENDING' }, { labelsStatus: '' }, { labelStatus: 'LABELLED' }];
    for (const members of refused) expect(EvidenceItemSchema.safeParse({ ...EXAMPLE_EVIDENCE_ITEM, ...members }).success, JSON.stringify(members)).toBe(false);
    // The members come back out as they went in (nothing is stripped or defaulted).
    const parsed = EvidenceItemSchema.parse({ ...EXAMPLE_EVIDENCE_ITEM, manifestVersion: 2, labelsStatus: 'LABELLED' });
    expect([parsed.manifestVersion, parsed.labelsStatus]).toEqual([2, 'LABELLED']);
    expect('manifestVersion' in EvidenceItemSchema.parse(EXAMPLE_EVIDENCE_ITEM)).toBe(false);
  });
});
