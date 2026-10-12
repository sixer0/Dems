// The hosted pair of the capture selector and the mic switch (task 3 blueprint row 66; register
// SH-18; contract C3 §2.4 operations 78 to 81, §5.2 `CAPTURE_CONFIG_CHANGED`, §6 slice 29):
// `setCaptureConfig` and `switchAudioSource` as members of `SimActions`.
//
// What must hold: an edit needs CAPTURE_CONFIG and no open session; one audit row per line that
// changed, with the key list of C3 §5.2 and nothing else; an edit that changes nothing sets nothing;
// a refused edit sets nothing; the mic rows stay in input order (AC-B-70); the selector never
// reaches a state its stored row would refuse.
import { describe, expect, expectTypeOf, it } from 'vitest';
import {
  CAPTURE_SELECTOR_SLOTS,
  type CaptureConfigUpdateRequest,
  CaptureConfigSliceSchema,
  DeltaMessageSchema,
  CaptureConfigMicUpdateSchema,
  CaptureInputScanEntrySchema,
  MIC_INPUT_ID_PATTERN,
  ActiveSessionSchema,
  AudioChannelStatusSchema,
  AudioSliceSchema,
  AudioSourceIntervalEntrySchema,
  AudioSourceStateSchema,
  AudioSourceSwitchRequestSchema,
  CaptureConfigUpdateRequestSchema,
  SessionResourceSchema,
} from '../src/api';
import { foldStateMessages, shareStructure } from '../src/live/source';
import {
  CAPTURE_CONFIG_CHANGE_OPERATION_ID,
  DEMO_OPERATOR_PASSWORD,
  OPERATORS,
  SimNotFoundError,
  SimPermissionError,
  SimTransitionError,
  createManualClock,
  createSim,
  type AuditRow,
  type CaptureConfigChange,
  type CaptureSelectorSlot,
  type OperatorRole,
  type ScenarioName,
  CAPTURE_CONNECT_MS,
  audioSourceIntervalsOf,
  type SimState,
  audioSourceAtStart,
  builtInMicInputOf,
  channelOfMicInput,
  micInputOfCaptureRole,
  raiseCaptureWarningTransition,
  setCaptureConfigTransition,
  UNKNOWN_MIC_TRANSPORT,
  activeMeterChannel,
  captureMicLines,
  channelOfMicLine,
  createAudioRuntime,
  feedCaptureLevels,
  micInputOfChannel,
  CAPTURE_CONFIG_CAMERA_ON_BOTH_TRACKS,
} from '../src/sim';
import * as failedStartBed from './support/failed-start-bed';
import * as micIdBed from './support/mic-id-bed';
import * as micPairBed from './support/mic-pair-bed';

const START = Date.UTC(2026, 9, 1, 3, 0, 0);
/** The keys C3 §5.2 allows in the details of CAPTURE_CONFIG_CHANGED. */
const DETAIL_KEYS = ['operationId', 'scope', 'field', 'trackId', 'inputId', 'deviceId', 'from', 'to', 'permission'];

function harness(role: OperatorRole | null = 'SUPERVISOR', scenario: ScenarioName = 'idle') {
  const clock = createManualClock(START);
  const sim = createSim({ clock, storage: null, authStorage: null, scenario });
  if (role !== null) {
    const operator = OPERATORS.find((candidate) => candidate.role === role);
    if (operator === undefined) throw new Error(`no seeded operator with role ${role}`);
    expect(sim.actions.signIn(operator.username, DEMO_OPERATOR_PASSWORD)).toMatchObject({ ok: true });
  }
  let sets = 0;
  sim.store.subscribe(() => {
    sets += 1;
  });
  const state = () => sim.store.getState();
  const changes = (): AuditRow[] => state().audit.rows.filter((row) => row.type === 'CAPTURE_CONFIG_CHANGED');
  return { sim, clock, state, sets: () => sets, changes, operatorId: () => state().auth.operatorId };
}

const selector = (h: ReturnType<typeof harness>) => ({
  cameras: h.state().captureConfig.cameras.map((camera) => [camera.trackId, camera.deviceId, camera.profile]),
  mics: h.state().captureConfig.mics.map((mic) => [mic.inputId, mic.deviceId, mic.role]),
});

describe('setCaptureConfig: the three kinds of change (operations 78, 79, 80)', () => {
  it('each kind names its operation in the audit row', () => {
    expect(CAPTURE_CONFIG_CHANGE_OPERATION_ID).toEqual({ UPDATE: 'updateCaptureConfig', CAMERA_SOURCE: 'setCaptureCameraSource', PRIMARY_MIC: 'setPrimaryMic' });
  });

  it.each(['SUPERVISOR', 'TECHNICIAN'] as const)('%s makes a mic input PRIMARY: one audited row, the rows in input order, the mic slice follows', (role) => {
    const h = harness(role);
    h.clock.advance(1_000);
    h.sim.actions.setCaptureConfig({ kind: 'PRIMARY_MIC', inputId: 'MIC-02' });
    // AC-B-70: a list of the two mic inputs is the ordered pair MIC-01, MIC-02; the role is a member.
    expect(selector(h).mics).toEqual([
      ['MIC-01', 'MIC-01', 'STANDBY'],
      ['MIC-02', 'MIC-02', 'PRIMARY'],
    ]);
    expect(h.state().captureConfig.updatedAt).toBe(START + 1_000);
    expect(h.state().mics.map((mic) => [mic.id, mic.micRole])).toEqual([
      ['AUDIO-01', 'STANDBY'],
      ['AUDIO-02', 'PRIMARY'],
    ]);
    const rows = h.changes();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ actorId: h.operatorId() });
    expect(rows[0]?.details).toEqual({ operationId: 'setPrimaryMic', scope: 'MIC', field: 'ROLE', inputId: 'MIC-02', deviceId: 'MIC-02', from: 'STANDBY', to: 'PRIMARY', permission: 'CAPTURE_CONFIG' });
    expect(CaptureConfigSliceSchema.safeParse(h.state().captureConfig).success).toBe(true);
    // The active input is the session's and the operator's (OD-11): an idle edit does not move it.
    expect(h.state().audio.activeInputId).toBe('MIC-01');
  });

  it('a camera goes to a track (79) and the whole selector is written (78): one row per line that changed', () => {
    const h = harness();
    // CAM-02 to VIDEO-01 while VIDEO-02 holds CAM-02 with the same profile is one camera on both
    // tracks with one profile: refused, nothing set (the control of the rule below).
    const before = h.state();
    expect(() => h.sim.actions.setCaptureConfig({ kind: 'CAMERA_SOURCE', deviceId: 'CAM-02', trackId: 'VIDEO-01' })).toThrow(SimTransitionError);
    expect(h.state()).toBe(before);

    // The swap in one edit is two lines, two rows.
    h.sim.actions.setCaptureConfig({ kind: 'UPDATE', cameras: [{ trackId: 'VIDEO-01', deviceId: 'CAM-02' }, { trackId: 'VIDEO-02', deviceId: 'CAM-01' }] });
    expect(selector(h).cameras.map(([trackId, deviceId]) => [trackId, deviceId])).toEqual([
      ['VIDEO-01', 'CAM-02'],
      ['VIDEO-02', 'CAM-01'],
    ]);
    expect(h.changes().map((row) => row.details)).toEqual([
      { operationId: 'updateCaptureConfig', scope: 'CAMERA', field: 'SOURCE', trackId: 'VIDEO-01', deviceId: 'CAM-02', from: 'CAM-01', to: 'CAM-02', permission: 'CAPTURE_CONFIG' },
      { operationId: 'updateCaptureConfig', scope: 'CAMERA', field: 'SOURCE', trackId: 'VIDEO-02', deviceId: 'CAM-01', from: 'CAM-02', to: 'CAM-01', permission: 'CAPTURE_CONFIG' },
    ]);

    // A dual-lens camera (OD-05): one device on both tracks, with two profiles.
    h.sim.actions.setCaptureConfig({ kind: 'UPDATE', cameras: [{ trackId: 'VIDEO-02', deviceId: 'CAM-02', profile: 'H264_720P25' }] });
    expect(selector(h).cameras).toEqual([
      ['VIDEO-01', 'CAM-02', h.state().captureConfig.cameras[0]?.profile],
      ['VIDEO-02', 'CAM-02', 'H264_720P25'],
    ]);
    expect(h.changes()).toHaveLength(3);
    // Now operation 79 may bring CAM-01 back to VIDEO-01.
    h.sim.actions.setCaptureConfig({ kind: 'CAMERA_SOURCE', deviceId: 'CAM-01', trackId: 'VIDEO-01' });
    expect(h.changes().at(-1)?.details).toEqual({ operationId: 'setCaptureCameraSource', scope: 'CAMERA', field: 'SOURCE', trackId: 'VIDEO-01', deviceId: 'CAM-01', from: 'CAM-02', to: 'CAM-01', permission: 'CAPTURE_CONFIG' });
    for (const row of h.changes()) {
      expect(Object.keys(row.details ?? {}).filter((key) => !DETAIL_KEYS.includes(key))).toEqual([]);
      expect(Object.values(row.details ?? {}).every((value) => typeof value === 'string')).toBe(true);
    }
    expect(CaptureConfigSliceSchema.safeParse(h.state().captureConfig).success).toBe(true);
  });

  it('fix wave J (JA2-24): the camera that feeds the other track is refused WITH its reason - `CAMERA_ON_BOTH_TRACKS` - and nothing is changed', () => {
    const h = harness();
    const before = h.state();
    let refused: unknown = null;
    try {
      // "Change camera" of Video track 1: the operator picks the camera of track 2 (same profile).
      h.sim.actions.setCaptureConfig({ kind: 'CAMERA_SOURCE', deviceId: 'CAM-02', trackId: 'VIDEO-01' });
    } catch (error) {
      refused = error;
    }
    expect(refused).toMatchObject({ name: 'SimTransitionError', code: 'INVALID_INPUT', reason: CAPTURE_CONFIG_CAMERA_ON_BOTH_TRACKS });
    expect(CAPTURE_CONFIG_CAMERA_ON_BOTH_TRACKS).toBe('CAMERA_ON_BOTH_TRACKS');
    expect(h.state()).toBe(before);
    // CONTROL: the camera of the track itself is no refusal (nothing changes), and a refusal of another kind names no such reason.
    h.sim.actions.setCaptureConfig({ kind: 'CAMERA_SOURCE', deviceId: 'CAM-01', trackId: 'VIDEO-01' });
    let other: unknown = null;
    try {
      h.sim.actions.setCaptureConfig({ kind: 'CAMERA_SOURCE', deviceId: 'CAM-99', trackId: 'VIDEO-01' });
    } catch (error) {
      other = error;
    }
    expect(other).not.toBeNull();
    expect((other as { reason?: unknown }).reason ?? null).not.toBe(CAPTURE_CONFIG_CAMERA_ON_BOTH_TRACKS);
  });

  it('an edit that changes nothing sets nothing: the same state, no store write, no row', () => {
    const h = harness();
    const before = h.state();
    const sets = h.sets();
    const same: CaptureConfigChange[] = [
      { kind: 'PRIMARY_MIC', inputId: 'MIC-01' },
      { kind: 'CAMERA_SOURCE', deviceId: 'CAM-01', trackId: 'VIDEO-01' },
      { kind: 'UPDATE' },
      { kind: 'UPDATE', cameras: [{ trackId: 'VIDEO-02', deviceId: 'CAM-02' }], mics: [{ inputId: 'MIC-02', deviceId: 'MIC-02' }] },
    ];
    for (const change of same) h.sim.actions.setCaptureConfig(change);
    expect(h.state()).toBe(before);
    expect(h.sets()).toBe(sets);
    // Control: the same call with a change is a store write and a row.
    h.sim.actions.setCaptureConfig({ kind: 'PRIMARY_MIC', inputId: 'MIC-02' });
    expect(h.sets()).toBe(sets + 1);
    expect(h.changes()).toHaveLength(1);
  });
});

describe('setCaptureConfig: the order of the mic rows', () => {
  it('a selector whose mic rows came out of input order is put in order by the next mic edit, and left alone by a camera edit', () => {
    const h = harness();
    // What a stored selector reads back as today when MIC-02 is PRIMARY: the PRIMARY row first.
    const reversed = [...h.state().captureConfig.mics].reverse().map((mic) => ({ ...mic, role: mic.inputId === 'MIC-02' ? ('PRIMARY' as const) : ('STANDBY' as const) }));
    h.sim.store.setState({ captureConfig: { ...h.state().captureConfig, mics: reversed } });
    expect(selector(h).mics.map(([inputId]) => inputId)).toEqual(['MIC-02', 'MIC-01']);
    h.sim.actions.setCaptureConfig({ kind: 'UPDATE', cameras: [{ trackId: 'VIDEO-01', deviceId: 'CAM-02' }, { trackId: 'VIDEO-02', deviceId: 'CAM-01' }] });
    expect(h.state().captureConfig.mics).toBe(reversed);
    h.sim.actions.setCaptureConfig({ kind: 'PRIMARY_MIC', inputId: 'MIC-01' });
    expect(selector(h).mics).toEqual([
      ['MIC-01', 'MIC-01', 'PRIMARY'],
      ['MIC-02', 'MIC-02', 'STANDBY'],
    ]);
  });
});

describe('setCaptureConfig: the refusals change nothing', () => {
  const refusedWith = (h: ReturnType<typeof harness>, change: CaptureConfigChange): unknown => {
    const before = h.state();
    let thrown: unknown;
    try {
      h.sim.actions.setCaptureConfig(change);
    } catch (error) {
      thrown = error;
    }
    expect(h.state(), JSON.stringify(change)).toBe(before);
    return thrown;
  };

  it('INVESTIGATOR lacks CAPTURE_CONFIG; nobody signed in is refused too', () => {
    const investigator = harness('INVESTIGATOR');
    const denied = refusedWith(investigator, { kind: 'PRIMARY_MIC', inputId: 'MIC-02' });
    expect(denied).toBeInstanceOf(SimPermissionError);
    expect(denied).toMatchObject({ code: 'NOT_PERMITTED', permission: 'CAPTURE_CONFIG' });
    expect(refusedWith(harness(null), { kind: 'PRIMARY_MIC', inputId: 'MIC-02' })).toMatchObject({ code: 'NOT_SIGNED_IN' });
    expect(investigator.changes()).toEqual([]);
  });

  it.each(['recording', 'finalizing'] as const)('M4-LOCK-1: while a session is open (%s) every kind of edit is refused, with no row and no change', (scenario) => {
    const h = harness('SUPERVISOR', scenario);
    expect(h.state().session).not.toBeNull();
    const rows = h.state().audit.rows.length;
    for (const change of [
      { kind: 'PRIMARY_MIC', inputId: 'MIC-02' },
      { kind: 'CAMERA_SOURCE', deviceId: 'CAM-01', trackId: 'VIDEO-02' },
      { kind: 'UPDATE', mics: [{ inputId: 'MIC-01', deviceId: 'MIC-02' }] },
    ] satisfies CaptureConfigChange[]) {
      const refused = refusedWith(h, change);
      expect(refused).toBeInstanceOf(SimTransitionError);
      expect(refused).toMatchObject({ code: 'ILLEGAL_STATE', event: 'setCaptureConfig' });
    }
    expect(h.state().audit.rows).toHaveLength(rows);
  });

  it('an unknown path ID is NOT_FOUND; a bad line of the whole-selector write is INVALID_INPUT', () => {
    const h = harness('TECHNICIAN');
    expect(refusedWith(h, { kind: 'CAMERA_SOURCE', deviceId: 'CAM-99', trackId: 'VIDEO-01' })).toBeInstanceOf(SimNotFoundError);
    // A microphone is no camera, and a discovery candidate is no device of the registry.
    expect(refusedWith(h, { kind: 'CAMERA_SOURCE', deviceId: 'MIC-01', trackId: 'VIDEO-01' })).toBeInstanceOf(SimNotFoundError);
    expect(refusedWith(h, { kind: 'PRIMARY_MIC', inputId: 'MIC-09' })).toBeInstanceOf(SimNotFoundError);
    const invalid: CaptureConfigChange[] = [
      { kind: 'UPDATE', cameras: [{ trackId: 'VIDEO-01', deviceId: 'CAM-99' }] },
      { kind: 'UPDATE', cameras: [{ trackId: 'VIDEO-01', deviceId: 'MIC-01' }] },
      { kind: 'UPDATE', cameras: [{ trackId: 'VIDEO-01', deviceId: 'CND-0001' }] },
      { kind: 'UPDATE', cameras: [{ trackId: 'VIDEO-01', deviceId: 'CAM-01', profile: 'h264-1080p25' }] },
      { kind: 'UPDATE', mics: [{ inputId: 'MIC-01', deviceId: 'CAM-01' }] },
      // The same microphone behind both inputs.
      { kind: 'UPDATE', mics: [{ inputId: 'MIC-01', deviceId: 'MIC-02' }] },
      // One camera on both tracks with one profile.
      { kind: 'UPDATE', cameras: [{ trackId: 'VIDEO-02', deviceId: 'CAM-01' }] },
      // A good line before a bad one: nothing of the edit is kept.
      { kind: 'UPDATE', cameras: [{ trackId: 'VIDEO-01', deviceId: 'CAM-02' }, { trackId: 'VIDEO-02', deviceId: 'CAM-77' }] },
      { kind: 'toString' } as unknown as CaptureConfigChange,
    ];
    for (const change of invalid) {
      const refused = refusedWith(h, change);
      expect(refused, JSON.stringify(change)).toBeInstanceOf(SimTransitionError);
      expect(refused, JSON.stringify(change)).toMatchObject({ code: 'INVALID_INPUT' });
    }
    expect(h.changes()).toEqual([]);
  });
});

describe('switchAudioSource: the action of operation 81', () => {
  it('moves the active input while RECORDING, writes AUDIO_SOURCE_SWITCHED once, and is refused outside a recording', () => {
    const h = harness('SUPERVISOR', 'recording');
    expect(h.state().audio.activeInputId).toBe('MIC-01');
    const rows = () => h.state().audit.rows.filter((row) => row.type === 'AUDIO_SOURCE_SWITCHED');
    h.clock.advance(2_000);
    h.sim.actions.switchAudioSource('MIC-02');
    expect(h.state().audio.activeInputId).toBe('MIC-02');
    expect(h.state().session?.audioSource).toMatchObject({ activeInputId: 'MIC-02', standbyInputId: 'MIC-01' });
    expect(rows()).toHaveLength(1);
    // The same input again: nothing.
    const held = h.state();
    h.sim.actions.switchAudioSource('MIC-02');
    expect(h.state()).toBe(held);
    // It never touches the selector: the PRIMARY role is the idle edit's.
    expect(h.state().captureConfig.mics.map((mic) => [mic.inputId, mic.role])).toEqual([
      ['MIC-01', 'PRIMARY'],
      ['MIC-02', 'STANDBY'],
    ]);

    const idle = harness('SUPERVISOR', 'idle');
    expect(() => idle.sim.actions.switchAudioSource('MIC-02')).toThrow(SimTransitionError);
    const technician = harness('TECHNICIAN', 'recording');
    expect(() => technician.sim.actions.switchAudioSource('MIC-02')).toThrow(SimPermissionError);
  });
});

describe('slice `captureConfig` is replicated: what the action changed reaches a Live replica as one `replace`', () => {
  it('the delta the Core sends for an edit is a message of the contract, and a replica that folds it holds the new selector and nothing else new', () => {
    const h = harness('TECHNICIAN');
    const before = h.state();
    h.sim.actions.setCaptureConfig({ kind: 'PRIMARY_MIC', inputId: 'MIC-02' });
    const after = h.state();
    const message = {
      type: 'delta',
      v: 1,
      epoch: 1,
      revision: 1,
      serverTime: START,
      ops: [{ op: 'replace', slice: 'captureConfig', value: after.captureConfig }],
    } as const;
    expect(DeltaMessageSchema.safeParse(message).success).toBe(true);
    const patch = foldStateMessages(before, [{ message: DeltaMessageSchema.parse(message), connection: 1 }], shareStructure);
    expect(Object.keys(patch)).toEqual(['captureConfig']);
    expect(patch.captureConfig).toEqual(after.captureConfig);
    expect(patch.captureConfig?.mics.map((mic) => [mic.inputId, mic.role])).toEqual([
      ['MIC-01', 'STANDBY'],
      ['MIC-02', 'PRIMARY'],
    ]);
    // Control: a replace of a slice name the contract does not replicate is no message.
    expect(DeltaMessageSchema.safeParse({ ...message, ops: [{ op: 'replace', slice: 'captureSelector', value: after.captureConfig }] }).success).toBe(false);
    // And an edit that changes nothing gives the Core nothing to send: the slice is the same object.
    const held = h.state().captureConfig;
    h.sim.actions.setCaptureConfig({ kind: 'PRIMARY_MIC', inputId: 'MIC-02' });
    expect(h.state().captureConfig).toBe(held);
  });
});

// Fix pass F-M5 (code review row 74, `gateway_check/18_m5_code_review.md`); each block was written
// RED against the tree of `abf742f`.
//   R74-02  operation 82 lists every interval of the session: 1-based, the input that is the source,
//           its role from the selector line
//   R74-05  the AUDIO_SOURCE_SWITCHED row holds the keys of contract C3 §5.2
describe('the intervals of operation 82 and the keys of the switch row', () => {
  const { harness } = failedStartBed;

  describe('R74-02: operation 82 in the simulator', () => {
    const recording = () => {
      const h = harness();
      h.toArmed();
      h.sim.actions.startRecording();
      h.run(CAPTURE_CONNECT_MS);
      const session = h.state().session;
      if (session === null || session.startedAt === null) throw new Error('no recording session');
      return { h, startedAt: session.startedAt };
    };
    const list = (state: SimState): string[] => {
      const session = state.session;
      if (session === null) return [];
      return audioSourceIntervalsOf(state, session).map((entry) => `${entry.seq}:${entry.inputId}:${entry.role}:${entry.fromMs}-${entry.toMs}:${entry.reason}`);
    };

    it('three switches, both directions: four intervals, newest first, each with the input that was the source and its role', () => {
      const { h, startedAt } = recording();
      expect(list(h.state())).toEqual(['1:MIC-01:PRIMARY:0-null:START']);
      const at: number[] = [];
      for (const input of ['MIC-02', 'MIC-01', 'MIC-02'] as const) {
        h.run(3_000);
        h.sim.actions.switchAudioSource(input);
        at.push(h.clock.now() - startedAt);
      }
      expect(list(h.state())).toEqual([
        `4:MIC-02:STANDBY:${at[2]}-null:MANUAL`,
        `3:MIC-01:PRIMARY:${at[1]}-${at[2]}:MANUAL`,
        `2:MIC-02:STANDBY:${at[0]}-${at[1]}:MANUAL`,
        `1:MIC-01:PRIMARY:0-${at[0]}:START`,
      ]);
      // The wall instants follow the same boundaries, and the last interval is the session's active input.
      const session = h.state().session;
      if (session === null) throw new Error('no session');
      const entries = audioSourceIntervalsOf(h.state(), session);
      expect(entries[0]?.inputId).toBe(session.audioSource?.activeInputId);
      expect(entries.map((entry) => entry.fromAt)).toEqual([startedAt + (at[2] ?? 0), startedAt + (at[1] ?? 0), startedAt + (at[0] ?? 0), startedAt]);
      expect(entries.map((entry) => entry.toAt)).toEqual([null, startedAt + (at[2] ?? 0), startedAt + (at[1] ?? 0), startedAt + (at[0] ?? 0)]);
      expect(entries.map((entry) => entry.switchedBy)).toEqual(['OPR-001', 'OPR-001', 'OPR-001', null]);
    });

    it('CONTROL: a request for the input that is active already opens no interval', () => {
      const { h } = recording();
      h.run(2_000);
      h.sim.actions.switchAudioSource('MIC-01');
      expect(list(h.state())).toHaveLength(1);
    });

    it('the answer of the simulated REST layer is the same list', () => {
      const { h } = recording();
      for (const input of ['MIC-02', 'MIC-01'] as const) {
        h.run(2_000);
        h.sim.actions.switchAudioSource(input);
      }
      const session = h.state().session;
      if (session === null) throw new Error('no session');
      const expected = audioSourceIntervalsOf(h.state(), session);
      expect(expected).toHaveLength(3);
      expect(expected.map((entry) => entry.inputId)).toEqual(['MIC-01', 'MIC-02', 'MIC-01']);
    });
  });

  describe('R74-05: the AUDIO_SOURCE_SWITCHED row of the simulator', () => {
    it('holds fromInput, toInput, fromMs, toMs (contract C3 §5.2) and none of the old keys', () => {
      const h = harness();
      h.toArmed();
      h.sim.actions.startRecording();
      h.run(CAPTURE_CONNECT_MS);
      const startedAt = h.state().session?.startedAt ?? 0;
      h.run(4_000);
      h.sim.actions.switchAudioSource('MIC-02');
      const first = h.clock.now() - startedAt;
      h.run(2_000);
      h.sim.actions.switchAudioSource('MIC-01');
      const second = h.clock.now() - startedAt;
      const rows = h.state().audit.rows.filter((row) => row.type === 'AUDIO_SOURCE_SWITCHED').slice(-2);
      expect(rows.map((row) => row.details)).toEqual([
        { fromInput: 'MIC-01', toInput: 'MIC-02', fromMs: 0, toMs: first },
        { fromInput: 'MIC-02', toInput: 'MIC-01', fromMs: first, toMs: second },
      ]);
    });
  });
});

// Integration pass C1 (decision D120), seam 1: the mic input id rule `MIC-NN`, the numbered form a
// camera has (decisions D106 (4), D115 (2)). Every acceptance has its refusal beside it.
describe('the microphone input id', () => {
  const { harness, withLocalMic } = micIdBed;

  describe('the mic input id rule is MIC-NN (pass C1, seam 1)', () => {
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

    it('a pair beyond the built-in one starts: the session audio source is the selector\'s pair by role (D133 (1), D137; row 82); a pair the registry does not hold is refused at the selector; its meter channel is its line', () => {
      expect([builtInMicInputOf('MIC-01'), builtInMicInputOf('MIC-02'), builtInMicInputOf('MIC-03'), builtInMicInputOf('toString')]).toEqual(['MIC-01', 'MIC-02', null, null]);
      expect([channelOfMicInput('MIC-01'), channelOfMicInput('MIC-02'), channelOfMicInput('MIC-03')]).toEqual(['AUDIO-01', 'AUDIO-02', null]);
      const h = harness();
      const local = withLocalMic(h.state(), 'MIC-03');
      // Since row 82 applied pass D1b's request in `session-machine.ts` (decision D148): the start is
      // no longer refused by name. The pair of the session is the selector's pair, by ROLE.
      expect(audioSourceAtStart(local, 'SES-20261001-0001')).toEqual({ sessionId: 'SES-20261001-0001', activeInputId: 'MIC-03', standbyInputId: 'MIC-02', switchedAt: null, intervalFromMs: 0 });
      // The STANDBY is held to the same rule: MIC-03 as the standby is the standby of the session.
      expect(audioSourceAtStart(withLocalMic(h.state(), 'MIC-02'), 'SES-20261001-0001')).toMatchObject({ activeInputId: 'MIC-02', standbyInputId: 'MIC-03' });
      // WHERE A PAIR IS REFUSED (C3 §2.4 op 78): at the selector, never at the start. A pair that
      // names a microphone the registry does not hold answers 422 and changes nothing.
      const refused = h.sim.request({ method: 'POST', path: '/api/v1/capture/config', body: { mics: [{ inputId: 'MIC-01', deviceId: 'MIC-01', role: 'PRIMARY' }, { inputId: 'MIC-09', deviceId: 'MIC-09', role: 'STANDBY' }] } });
      expect(refused.status).toBe(422);
      expect(h.state().captureConfig.mics.map((mic) => mic.inputId)).toEqual(['MIC-01', 'MIC-02']);
      // CONTROL: the built-in pair starts as before.
      expect(audioSourceAtStart(h.state(), 'SES-20261001-0001')).toMatchObject({ activeInputId: 'MIC-01', standbyInputId: 'MIC-02', intervalFromMs: 0 });
      // The meters and the silence warning (ruling D137, integration pass D1b - until then MIC-03 had
      // no channel here): each of the two lines is a meter channel, in input order. MIC-03 is the
      // second line of this selector, so its level and its silence warning are channel 2's - its
      // own, never the channel of another microphone.
      expect(micInputOfCaptureRole(local, 'PRIMARY')).toBe('MIC-03');
      expect(micInputOfCaptureRole(local, 'STANDBY')).toBe('MIC-02');
      const silent = raiseCaptureWarningTransition(local, START, { code: 'MIC_SILENT', subject: 'MIC-03' });
      expect(silent.faults.active.filter((fault) => fault.kind === 'MIC_SILENT').map((fault) => fault.target)).toEqual(['AUDIO-02']);
      // CONTROL: an input that is neither line of the selector is still no microphone of the capture.
      expect(() => raiseCaptureWarningTransition(local, START, { code: 'MIC_SILENT', subject: 'MIC-01' })).toThrow(SimNotFoundError);
    });
  });
});

// Integration pass D1b (decision D133), three seams of the shared contract:
//   1. operation 78 assigns the microphone inputs by PAIR REPLACEMENT (D133 (1)): mic lines with
//      `role` are the new pair; the form without `role` stays valid;
//   2. the session audio source, the body of operation 81, the intervals, the meters slice and the
//      audio status name a mic input by the `MIC-NN` rule, no longer by `MIC-01 | MIC-02`;
//  10. a meter channel is the microphone line of its place in the capture configuration (ruling D137).
// Every acceptance has its refusal beside it: a rule that admits everything proves nothing.
describe('the microphone pair: assignment, the session audio source, the meter channels', () => {
  const { CAPTURE_CONFIG_PATH, harness, registerLocalMic, pair, micsOf, changedRows } = micPairBed;

  describe('operation 78: the microphone inputs are assigned by pair replacement (pass D1b, seam 1)', () => {
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

  describe('the session audio source, operation 81 and the meters name an input by MIC-NN (pass D1b, seam 2)', () => {
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
      // No more than two inputs, each keyed by an input id, each a whole frame.
      expect(AudioSliceSchema.safeParse({ ...replaced, inputs: { 'MIC-01': frame, 'MIC-02': frame, 'MIC-03': frame } }).success).toBe(false);
      // Task 4 row 28 (register E41): AT MOST two - one frame per microphone line of the selector,
      // so a selector with one microphone line has one frame (this body was refused before).
      expect(AudioSliceSchema.safeParse({ ...replaced, inputs: { 'MIC-03': frame } }).success).toBe(true);
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

  describe('meter channel -> microphone input: the order of the microphone lines, whatever their ids (ruling D137; pass D1b, seam 10)', () => {
    const line = (inputId: string) => ({ inputId });

    it('the rule: channel 1 is the first line, channel 2 the second; the built-in pair gives the old table', () => {
      const builtIn = [line('MIC-01'), line('MIC-02')];
      expect([micInputOfChannel(builtIn, 'AUDIO-01'), micInputOfChannel(builtIn, 'AUDIO-02')]).toEqual(['MIC-01', 'MIC-02']);
      const replaced = [line('MIC-01'), line('MIC-03')];
      expect([micInputOfChannel(replaced, 'AUDIO-01'), micInputOfChannel(replaced, 'AUDIO-02')]).toEqual(['MIC-01', 'MIC-03']);
      // The inverse reads lines WITH their role since task 4 row 164 (a complete pair; register 161 section 3.2).
      const replacedPair = [{ ...replaced[0]!, role: 'PRIMARY' as const }, { ...replaced[1]!, role: 'STANDBY' as const }];
      expect([channelOfMicLine(replacedPair, 'MIC-01'), channelOfMicLine(replacedPair, 'MIC-03'), channelOfMicLine(replacedPair, 'MIC-02')]).toEqual(['AUDIO-01', 'AUDIO-02', null]);
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
});

// Task 4 row 28 (WP-13a; decisions C14, C18, C21 (8), C25; security requirement AD-10 (3); names
// register of row 161, N1 to N3 and section 4.3): a selector slot may be UNASSIGNED. This block
// holds the CONTRACT of the body of operation 78 - the schema and the types. What the hosted action
// does with the member is row 162, the in-app body check row 165, the Core's route row 29.
describe('operation 78: the member `unassign` of the body (task 4 row 28; the contract only)', () => {
  const accepts = (body: unknown): boolean => CaptureConfigUpdateRequestSchema.safeParse(body).success;
  /** The paths of the issues of a refused body, joined: where the schema says the body is wrong. */
  const refusedAt = (body: unknown): string[] => {
    const result = CaptureConfigUpdateRequestSchema.safeParse(body);
    return result.success ? [] : result.error.issues.map((issue) => issue.path.join('.'));
  };

  it('the four slots are the two video tracks and the two microphone roles, in that order; the type of the change is the type of the list', () => {
    expect(CAPTURE_SELECTOR_SLOTS).toEqual(['VIDEO-01', 'VIDEO-02', 'PRIMARY', 'STANDBY']);
    // `sim/types.ts` states the slot structurally (it imports nothing of `api/`): the two are one type.
    expectTypeOf<CaptureSelectorSlot>().toEqualTypeOf<(typeof CAPTURE_SELECTOR_SLOTS)[number]>();
    // The body and the `UPDATE` kind of the hosted action carry the member with the same element type.
    expectTypeOf<NonNullable<CaptureConfigUpdateRequest['unassign']>[number]>().toEqualTypeOf<CaptureSelectorSlot>();
    expectTypeOf<NonNullable<Extract<CaptureConfigChange, { kind: 'UPDATE' }>['unassign']>[number]>().toEqualTypeOf<CaptureSelectorSlot>();
    // No new kind of change: the three of operations 78, 79, 80.
    expectTypeOf<CaptureConfigChange['kind']>().toEqualTypeOf<'UPDATE' | 'CAMERA_SOURCE' | 'PRIMARY_MIC'>();
    expect(CAPTURE_CONFIG_CHANGE_OPERATION_ID).toEqual({ UPDATE: 'updateCaptureConfig', CAMERA_SOURCE: 'setCaptureCameraSource', PRIMARY_MIC: 'setPrimaryMic' });
  });

  it('`unassign` is optional and takes one to four slots, each at most once; a body without it reads as before', () => {
    // Without the member: the bodies of today, unchanged.
    expect(accepts({})).toBe(true);
    expect(accepts({ cameras: [{ trackId: 'VIDEO-01', deviceId: 'CAM-02' }] })).toBe(true);
    expect(CaptureConfigUpdateRequestSchema.parse({ cameras: [{ trackId: 'VIDEO-01', deviceId: 'CAM-02' }] })).toStrictEqual({ cameras: [{ trackId: 'VIDEO-01', deviceId: 'CAM-02' }] });
    // Each slot alone, and all four.
    for (const slot of CAPTURE_SELECTOR_SLOTS) expect(CaptureConfigUpdateRequestSchema.parse({ unassign: [slot] }), slot).toStrictEqual({ unassign: [slot] });
    expect(accepts({ unassign: ['VIDEO-01', 'VIDEO-02', 'PRIMARY', 'STANDBY'] })).toBe(true);
    expect(accepts({ unassign: ['STANDBY', 'VIDEO-02'] })).toBe(true);
    // Refused: an empty list, a slot twice, more than four, an unknown slot, a stored slot word, another type.
    expect(refusedAt({ unassign: [] })).toEqual(['unassign']);
    expect(refusedAt({ unassign: ['VIDEO-01', 'VIDEO-01'] })).toEqual(['unassign']);
    expect(accepts({ unassign: ['VIDEO-01', 'VIDEO-02', 'PRIMARY', 'STANDBY', 'VIDEO-01'] })).toBe(false);
    for (const bad of ['VIDEO-03', 'AUDIO-01', 'MIC-PRIMARY', 'MIC-01', 'CAM-01', 'primary', '', null, 1]) expect(accepts({ unassign: [bad] }), String(bad)).toBe(false);
    for (const bad of ['VIDEO-01', null, {}, 4]) expect(accepts({ unassign: bad }), String(bad)).toBe(false);
    // The body stays strict: no other member came with it.
    expect(accepts({ unassign: ['VIDEO-01'], assign: ['VIDEO-02'] })).toBe(false);
  });

  it('AD-10 (3): a body that clears a slot and assigns the same slot is refused by the schema, on the path `unassign`', () => {
    const camera = (trackId: string) => ({ trackId, deviceId: 'CAM-01' });
    const byRole = (inputId: string, role: string) => ({ inputId, deviceId: inputId, role });
    // A video slot: cleared and the track of a camera line.
    expect(refusedAt({ unassign: ['VIDEO-01'], cameras: [camera('VIDEO-01')] })).toEqual(['unassign']);
    expect(refusedAt({ unassign: ['VIDEO-02', 'PRIMARY'], cameras: [camera('VIDEO-01'), camera('VIDEO-02')] })).toEqual(['unassign']);
    // A microphone slot: cleared and the role of a mic line.
    expect(refusedAt({ unassign: ['PRIMARY'], mics: [byRole('MIC-03', 'PRIMARY')] })).toEqual(['unassign']);
    expect(refusedAt({ unassign: ['STANDBY'], mics: [byRole('MIC-01', 'PRIMARY'), byRole('MIC-02', 'STANDBY')] })).toEqual(['unassign']);
    // The control beside each refusal: another slot of the same body is assigned.
    expect(accepts({ unassign: ['VIDEO-01'], cameras: [camera('VIDEO-02')] })).toBe(true);
    expect(accepts({ unassign: ['STANDBY'], mics: [byRole('MIC-03', 'PRIMARY')] })).toBe(true);
    expect(accepts({ unassign: ['VIDEO-01', 'VIDEO-02'], mics: [byRole('MIC-01', 'PRIMARY'), byRole('MIC-02', 'STANDBY')] })).toBe(true);
    // A mic line WITHOUT `role` names an input, not a slot: the schema cannot know which role holds
    // it, so this body passes here and the hosted action decides (register 4.3, second line; row 162).
    expect(accepts({ unassign: ['PRIMARY'], mics: [{ inputId: 'MIC-01', deviceId: 'MIC-01' }] })).toBe(true);
  });

  it('the rule MIC-ASSIGN is in the words of the contract: a role is assignable alone (the mic line schema itself did not change)', () => {
    const role = CaptureConfigMicUpdateSchema.shape.role.description ?? '';
    expect(role).toContain('a role is assignable alone');
    expect(role).toContain('one line or two');
    expect(Object.keys(CaptureConfigMicUpdateSchema.shape)).toEqual(['inputId', 'deviceId', 'transport', 'role']);
    expect(CaptureConfigUpdateRequestSchema.description).toContain('{ cameras?[], mics?[], unassign?[] }');
    // One line by role is a body the schema has always taken (the 422 of today is the hosted action's).
    expect(accepts({ mics: [{ inputId: 'MIC-03', deviceId: 'MIC-03', role: 'PRIMARY' }] })).toBe(true);
  });
});
