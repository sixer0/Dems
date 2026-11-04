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
  meterInputOfChannel,
  CAPTURE_CONFIG_CAMERA_ON_BOTH_TRACKS,
  CAPTURE_CONFIG_MIC_ON_BOTH_INPUTS,
  CAPTURE_CONFIG_SLOT_UNASSIGNED_AND_ASSIGNED,
} from '../src/sim';
import type { VideoTrackId } from '../src/domain'; // D60 (2026-11-04): four video slots
import * as selectorBed from './support/selector-category-bed';
import * as failedStartBed from './support/failed-start-bed';
import * as micIdBed from './support/mic-id-bed';
import * as micPairBed from './support/mic-pair-bed';

const START = Date.UTC(2026, 9, 1, 3, 0, 0);
/** The keys C3 §5.2 allows in the details of CAPTURE_CONFIG_CHANGED. */
const DETAIL_KEYS = ['operationId', 'scope', 'field', 'trackId', 'inputId', 'deviceId', 'channel', 'from', 'to', 'permission']; // D61 (2026-11-04): the mic rows name their CHANNEL

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
  mics: h.state().captureConfig.mics.map((mic) => [mic.inputId, mic.deviceId, mic.channel]),
});

describe('setCaptureConfig: the three kinds of change (operations 78, 79, 80)', () => {
  it('each kind names its operation in the audit row', () => {
    expect(CAPTURE_CONFIG_CHANGE_OPERATION_ID).toEqual({ UPDATE: 'updateCaptureConfig', CAMERA_SOURCE: 'setCaptureCameraSource', PRIMARY_MIC: 'setPrimaryMic' });
  });

  it.each(['TECHNICIAN'] as const)('%s makes a mic input PRIMARY: one audited row, the rows in input order, the mic slice follows', (role) => {
    const h = harness(role);
    h.clock.advance(1_000);
    h.sim.actions.setCaptureConfig({ kind: 'PRIMARY_MIC', inputId: 'MIC-02' });
    // D61 (2026-11-04): AC-B-70's ordered pair became the ordered FOUR - the rows are held in
    // CHANNEL order and the moved input carries the channel it took (channel 1 now reads MIC-02).
    expect(selector(h).mics).toEqual([
      ['MIC-02', 'MIC-02', 'MIC-01'],
      ['MIC-01', 'MIC-01', 'MIC-02'],
      ['MIC-03', 'MIC-03', 'MIC-03'],
      ['MIC-04', 'MIC-04', 'MIC-04'],
    ]);
    expect(h.state().captureConfig.updatedAt).toBe(START + 1_000);
    // D61 (2026-11-04): the mic slice follows the CHANNELS — each entry carries the input of its
    // own channel; the transcribed channel 1 now reads MIC-02 and channel 2 MIC-01.
    expect(h.state().mics.map((mic) => [mic.id, mic.deviceId])).toEqual([
      ['AUDIO-01', 'MIC-02'],
      ['AUDIO-02', 'MIC-01'],
      ['AUDIO-03', 'MIC-03'],
      ['AUDIO-04', 'MIC-04'],
    ]);
    const rows = h.changes();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ actorId: h.operatorId() });
    expect(rows[0]?.details).toEqual({ operationId: 'setPrimaryMic', scope: 'MIC', field: 'CHANNEL', inputId: 'MIC-02', deviceId: 'MIC-02', from: 'MIC-02', to: 'MIC-01', permission: 'CAPTURE_CONFIG' });
    expect(CaptureConfigSliceSchema.safeParse(h.state().captureConfig).success).toBe(true);
    // D61 (2026-11-04): the meters re-key with the selector - the active input is the CHANNEL-1
    // line's (task 4 row 149), and this edit moved channel 1 to MIC-02. (OD-11 still holds for the
    // session's own switch: operation 81 is the operator's, not an idle edit's side effect.)
    expect(h.state().audio.activeInputId).toBe('MIC-02');
  });

  it('a camera goes to a track (79) and the whole selector is written (78): one row per line that changed', () => {
    // TECHNICIAN since the 0034 revocation: SUPERVISOR no longer holds CAPTURE_CONFIG (2026-10-29).
    const h = harness('TECHNICIAN');
    // CAM-02 to VIDEO-01 while VIDEO-02 holds CAM-02 with the same profile is one camera on both
    // tracks with one profile: refused, nothing set (the control of the rule below).
    const before = h.state();
    expect(() => h.sim.actions.setCaptureConfig({ kind: 'CAMERA_SOURCE', deviceId: 'CAM-02', trackId: 'VIDEO-01' })).toThrow(SimTransitionError);
    expect(h.state()).toBe(before);

    // The swap in one edit is two lines, two rows.
    h.sim.actions.setCaptureConfig({ kind: 'UPDATE', cameras: [{ trackId: 'VIDEO-01', deviceId: 'CAM-02' }, { trackId: 'VIDEO-02', deviceId: 'CAM-01' }] });
    // D60 (2026-11-04): the seeded selector holds FOUR lines; the swap moves the first two only.
    expect(selector(h).cameras.map(([trackId, deviceId]) => [trackId, deviceId])).toEqual([
      ['VIDEO-01', 'CAM-02'],
      ['VIDEO-02', 'CAM-01'],
      ['VIDEO-03', 'CAM-03'],
      ['VIDEO-04', 'CAM-04'],
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
      ['VIDEO-03', 'CAM-03', 'H264_1080P25'], // D60 (2026-11-04): untouched lines stay
      ['VIDEO-04', 'CAM-04', 'H264_1080P25'],
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
    // TECHNICIAN since the 0034 revocation (2026-10-29).
    const h = harness('TECHNICIAN');
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
    // TECHNICIAN since the 0034 revocation (2026-10-29).
    const h = harness('TECHNICIAN');
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
  it('a selector whose mic rows came out of channel order is put in order by the next mic edit, and left alone by a camera edit', () => {
    // TECHNICIAN since the 0034 revocation (2026-10-29).
    const h = harness('TECHNICIAN');
    // What a stored selector reads back as today when the CHANNEL order was lost: the last line first
    // (D61 of 2026-11-04: the rows are keyed by channel - AC-B-70's input order became channel order).
    const reversed = [...h.state().captureConfig.mics].reverse();
    h.sim.store.setState({ captureConfig: { ...h.state().captureConfig, mics: reversed } });
    expect(selector(h).mics.map(([inputId]) => inputId)).toEqual(['MIC-04', 'MIC-03', 'MIC-02', 'MIC-01']); // D61: the seeded four, out of order
    h.sim.actions.setCaptureConfig({ kind: 'UPDATE', cameras: [{ trackId: 'VIDEO-01', deviceId: 'CAM-02' }, { trackId: 'VIDEO-02', deviceId: 'CAM-01' }] });
    expect(h.state().captureConfig.mics).toBe(reversed);
    h.sim.actions.setCaptureConfig({ kind: 'PRIMARY_MIC', inputId: 'MIC-02' }); // D61: the mic edit that moves channel 1 re-orders the list by channel
    expect(selector(h).mics).toEqual([
      ['MIC-02', 'MIC-02', 'MIC-01'],
      ['MIC-01', 'MIC-01', 'MIC-02'],
      ['MIC-03', 'MIC-03', 'MIC-03'],
      ['MIC-04', 'MIC-04', 'MIC-04'],
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
    // TECHNICIAN: the lock (409) is what this row proves, and only since 0034 must the driver
    // also hold CAPTURE_CONFIG to be answered the lock rather than the permission refusal (403).
    const h = harness('TECHNICIAN', scenario);
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
    // It never touches the selector: the channel assignment is the idle edit's (D61: the seeded four).
    expect(h.state().captureConfig.mics.map((mic) => [mic.inputId, mic.channel])).toEqual([
      ['MIC-01', 'MIC-01'],
      ['MIC-02', 'MIC-02'],
      ['MIC-03', 'MIC-03'],
      ['MIC-04', 'MIC-04'],
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
    expect(patch.captureConfig?.mics.map((mic) => [mic.inputId, mic.channel])).toEqual([
      ['MIC-02', 'MIC-01'],
      ['MIC-01', 'MIC-02'],
      ['MIC-03', 'MIC-03'],
      ['MIC-04', 'MIC-04'],
    ]); // D61 (2026-11-04): the fold carries all four channel lines, in channel order
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

    it('decision C36 (2), task 4 row 149: a session in which NO input is in force answers no interval - no built-in input is invented', () => {
      const { h } = recording();
      const session = h.state().session;
      if (session === null) throw new Error('no session');
      // The session as started on a selector without a channel-1 line (Simulated mode starts it, C21 (6)):
      // it states no pair, its snapshot holds a lone channel-2 line, the meters hold no active input.
      // D60 (2026-11-04) widened the seeded selector to four lines; the snapshot of THIS bed holds the
      // built-in pair only (failedStartBed pins it), so the lone-line filter still finds one.
      const lone = (session.captureConfig?.mics ?? []).filter((mic) => mic.channel === 'MIC-02'); // D61: the lone second-channel line
      expect(lone).toHaveLength(1);
      const noPair = { ...session, audioSource: null, captureConfig: session.captureConfig === null || session.captureConfig === undefined ? session.captureConfig : { ...session.captureConfig, mics: lone } };
      const noActive: SimState = { ...h.state(), session: noPair, audio: { inputs: {}, activeInputId: null } };
      expect(audioSourceIntervalsOf(noActive, noPair)).toEqual([]);
      // Nor without the meters at all (the Core's durable state holds none).
      expect(audioSourceIntervalsOf({ audit: noActive.audit }, noPair)).toEqual([]);
      // CONTROL: the same session WITH its pair answers its one interval, as before.
      expect(list(h.state())).toEqual(['1:MIC-01:PRIMARY:0-null:START']);
      // CONTROL: the snapshot's PRIMARY line alone still names the input (a hand-built session without a pair).
      const primaryOnly = { ...session, audioSource: null };
      expect(audioSourceIntervalsOf({ audit: noActive.audit }, primaryOnly).map((entry) => entry.inputId)).toEqual(['MIC-01']);
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

    it('slice 29 admits a selector with MIC-05 on channel 1, and still refuses an id outside the form', () => {
      const h = harness();
      const selector = withLocalMic(h.state(), 'MIC-05').captureConfig; // D61: MIC-03 is a built-in now; the registered-later device is MIC-05
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

    it('setPrimaryMic on a selector holding MIC-05: channel 1 and channel 2 each hold one line, deviceId equals inputId (D61: MIC-03 is built-in, the registered-later device is MIC-05)', () => {
      const h = harness();
      const before = withLocalMic(h.state(), 'MIC-02');
      const after = setCaptureConfigTransition(before, START + 1_000, { kind: 'PRIMARY_MIC', inputId: 'MIC-05' });
      // D61 (2026-11-04): the rows stand in channel order - the chosen input took channel 1.
      expect(after.captureConfig.mics.map((mic) => [mic.inputId, mic.deviceId, mic.channel])).toEqual([
        ['MIC-05', 'MIC-05', 'MIC-01'],
        ['MIC-02', 'MIC-02', 'MIC-02'],
      ]);
      expect(CaptureConfigSliceSchema.safeParse(after.captureConfig).success).toBe(true);
      expect(after.audit.rows.at(-1)?.details).toMatchObject({ operationId: 'setPrimaryMic', inputId: 'MIC-05', deviceId: 'MIC-05', from: 'MIC-02', to: 'MIC-01' });
      // The mic slice of the four built-in channels follows the channels it knows and invents none.
      expect(after.mics.map((mic) => mic.id)).toEqual(before.mics.map((mic) => mic.id));
      // And back: the channel is a member of the row, the channel order does not move.
      const back = setCaptureConfigTransition(after, START + 2_000, { kind: 'PRIMARY_MIC', inputId: 'MIC-02' });
      expect(back.captureConfig.mics.map((mic) => [mic.inputId, mic.channel])).toEqual([
        ['MIC-02', 'MIC-01'],
        ['MIC-05', 'MIC-02'],
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

    it('a pair beyond the built-in one starts: the session audio source is the selector\'s pair by channel (D133 (1) via D61, D137; row 82); a pair the registry does not hold is refused at the selector; its meter channel is its line', () => {
      // D61 (2026-11-04): the built-in pair became the built-in FOUR.
      expect([builtInMicInputOf('MIC-01'), builtInMicInputOf('MIC-02'), builtInMicInputOf('MIC-03'), builtInMicInputOf('MIC-04'), builtInMicInputOf('toString')]).toEqual(['MIC-01', 'MIC-02', 'MIC-03', 'MIC-04', null]);
      expect([channelOfMicInput('MIC-01'), channelOfMicInput('MIC-02'), channelOfMicInput('MIC-03'), channelOfMicInput('MIC-04')]).toEqual(['AUDIO-01', 'AUDIO-02', 'AUDIO-03', 'AUDIO-04']); // D61: the four channels
      const h = harness();
      const local = withLocalMic(h.state(), 'MIC-05');
      // Since row 82 applied pass D1b's request in `session-machine.ts` (decision D148): the start is
      // no longer refused by name. The pair of the session is the selector's pair, by CHANNEL (D61).
      expect(audioSourceAtStart(local, 'SES-20261001-0001')).toEqual({ sessionId: 'SES-20261001-0001', activeInputId: 'MIC-05', standbyInputId: 'MIC-02', switchedAt: null, intervalFromMs: 0 });
      // Channel 2 is held to the same rule: MIC-05 as the second channel is the second of the session (D61: the standby is the channel-2 line).
      expect(audioSourceAtStart(withLocalMic(h.state(), 'MIC-02'), 'SES-20261001-0001')).toMatchObject({ activeInputId: 'MIC-02', standbyInputId: 'MIC-05' });
      // WHERE A PAIR IS REFUSED (C3 §2.4 op 78): at the selector, never at the start. A pair that
      // names a microphone the registry does not hold answers 422 and changes nothing.
      const refused = h.sim.request({ method: 'POST', path: '/api/v1/capture/config', body: { mics: [{ inputId: 'MIC-01', deviceId: 'MIC-01', channel: 'MIC-01' }, { inputId: 'MIC-09', deviceId: 'MIC-09', channel: 'MIC-02' }] } });
      expect(refused.status).toBe(422);
      expect(h.state().captureConfig.mics.map((mic) => mic.inputId)).toEqual(['MIC-01', 'MIC-02', 'MIC-03', 'MIC-04']); // D61: the seeded four
      // CONTROL: the built-in pair starts as before.
      expect(audioSourceAtStart(h.state(), 'SES-20261001-0001')).toMatchObject({ activeInputId: 'MIC-01', standbyInputId: 'MIC-02', intervalFromMs: 0 });
      // The meters and the silence warning (ruling D137 generalized by D61): each line is the meter
      // of ITS channel. MIC-05 stands on channel 1 in this hand-built selector, so its level and its
      // silence warning are channel 1's - its own, never the channel of another microphone.
      expect(micInputOfCaptureRole(local, 'PRIMARY')).toBe('MIC-05');
      expect(micInputOfCaptureRole(local, 'STANDBY')).toBe('MIC-02');
      const silent = raiseCaptureWarningTransition(local, START, { code: 'MIC_SILENT', subject: 'MIC-05' });
      expect(silent.faults.active.filter((fault) => fault.kind === 'MIC_SILENT').map((fault) => fault.target)).toEqual(['AUDIO-01']);
      // CONTROL: a subject that names neither a held input nor a channel with a line is still no
      // microphone of the capture (D61: `MIC-01` alone now reads as the CHANNEL word, channel 1).
      expect(() => raiseCaptureWarningTransition(local, START, { code: 'MIC_SILENT', subject: 'MIC-09' })).toThrow(SimNotFoundError);
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
    it('the mic line takes an optional channel; the body takes one to four lines (D61)', () => {
      expect(CaptureConfigMicUpdateSchema.safeParse({ inputId: 'MIC-03', deviceId: 'MIC-03', channel: 'MIC-01' }).success).toBe(true);
      expect(CaptureConfigMicUpdateSchema.safeParse({ inputId: 'MIC-02', deviceId: 'MIC-02', channel: 'MIC-02', transport: 'USB' }).success).toBe(true);
      // The earlier form is still the contract (additive): a line without a channel.
      expect(CaptureConfigMicUpdateSchema.safeParse({ inputId: 'MIC-01', deviceId: 'MIC-01' }).success).toBe(true);
      for (const bad of ['ACTIVE', 'primary', '', null, 1]) expect(CaptureConfigMicUpdateSchema.safeParse({ inputId: 'MIC-03', deviceId: 'MIC-03', role: bad }).success, String(bad)).toBe(false);
      expect(CaptureConfigUpdateRequestSchema.safeParse(pair('MIC-03', 'MIC-02')).success).toBe(true);
      // D61 (2026-11-04): the schema states the SHAPE (one to four lines); the rule that each channel
      // is named ONCE is the action's (INVALID_INPUT, table of `capture-config.ts`) - a doubled
      // channel passes the shape and is refused by the transition.
      expect(CaptureConfigUpdateRequestSchema.safeParse({ mics: [...pair('MIC-03', 'MIC-02').mics, { inputId: 'MIC-01', deviceId: 'MIC-01', channel: 'MIC-02' }] }).success).toBe(true);
      const doubledChannel = { kind: 'UPDATE' as const, mics: [{ inputId: 'MIC-01', deviceId: 'MIC-01', channel: 'MIC-01' as const }, { inputId: 'MIC-02', deviceId: 'MIC-02', channel: 'MIC-02' as const }, { inputId: 'MIC-03', deviceId: 'MIC-03', channel: 'MIC-02' as const }] };
      expect(() => setCaptureConfigTransition(harness().state(), START, doubledChannel)).toThrow(expect.objectContaining({ code: 'INVALID_INPUT' })); // D61: no channel twice
      expect(CaptureConfigUpdateRequestSchema.safeParse({ mics: [pair('MIC-05', 'MIC-02').mics[0]!, { inputId: 'MIC-06', deviceId: 'MIC-06', channel: 'MIC-02' }, { inputId: 'MIC-01', deviceId: 'MIC-01', channel: 'MIC-03' }, { inputId: 'MIC-02', deviceId: 'MIC-02', channel: 'MIC-04' }] }).success).toBe(true); // D61: four lines is a body
      expect(CaptureConfigUpdateRequestSchema.safeParse({ mics: [{ inputId: 'MIC-05', deviceId: 'MIC-05', channel: 'MIC-01' }, { inputId: 'MIC-06', deviceId: 'MIC-06', channel: 'MIC-02' }, { inputId: 'MIC-01', deviceId: 'MIC-01', channel: 'MIC-03' }, { inputId: 'MIC-02', deviceId: 'MIC-02', channel: 'MIC-04' }, { inputId: 'MIC-03', deviceId: 'MIC-03', channel: 'MIC-04' }] }).success).toBe(false); // D61: five lines are not
    });

    it('MIC-05 is selected through the API on a registry that holds it: channels 1 and 2 are replaced, in channel order, with the rows of C3 §5.2 (D61)', () => {
      const h = harness();
      registerLocalMic(h);
      const before = changedRows(h.state()).length;
      const answer = h.sim.request({ method: 'POST', path: CAPTURE_CONFIG_PATH, body: pair('MIC-05', 'MIC-02') });
      expect(answer.status).toBe(200);
      // D61: a two-line body names channels 1 and 2; the untouched channels 3 and 4 keep their lines.
      expect(micsOf(h.state())).toEqual([
        ['MIC-05', 'MIC-05', 'MIC-01', UNKNOWN_MIC_TRANSPORT],
        ['MIC-02', 'MIC-02', 'MIC-02', 'USB'],
        ['MIC-03', 'MIC-03', 'MIC-03', 'USB'],
        ['MIC-04', 'MIC-04', 'MIC-04', 'USB'],
      ]);
      expect((answer.body as { mics: { inputId: string; channel: string }[] }).mics.map((mic) => [mic.inputId, mic.channel])).toEqual([['MIC-05', 'MIC-01'], ['MIC-02', 'MIC-02'], ['MIC-03', 'MIC-03'], ['MIC-04', 'MIC-04']]);
      expect(CaptureConfigSliceSchema.safeParse(answer.body).success).toBe(true);
      // The rules that stay: each channel once; a mic line's device is its input.
      expect(h.state().captureConfig.mics.map((mic) => mic.channel)).toEqual(['MIC-01', 'MIC-02', 'MIC-03', 'MIC-04']);
      expect(h.state().captureConfig.mics.every((mic) => mic.deviceId === mic.inputId)).toBe(true);
      // One row per CHANNEL whose device changed: channel 1 moved from MIC-01 to MIC-05; channel 2 stayed MIC-02.
      const rows = changedRows(h.state()).slice(before);
      expect(rows.map((row) => row.details)).toEqual([
        { operationId: 'updateCaptureConfig', scope: 'MIC', field: 'SOURCE', channel: 'MIC-01', inputId: 'MIC-05', deviceId: 'MIC-05', from: 'MIC-01', to: 'MIC-05', permission: 'CAPTURE_CONFIG' },
      ]);
      // The same pair again changes nothing: 200, no row, the same state object.
      const held = h.state().captureConfig;
      expect(h.sim.request({ method: 'POST', path: CAPTURE_CONFIG_PATH, body: pair('MIC-05', 'MIC-02') }).status).toBe(200);
      expect(h.state().captureConfig).toBe(held);
      expect(changedRows(h.state())).toHaveLength(before + 1);
      // And back to the built-in pair: both channels change their device.
      expect(h.sim.request({ method: 'POST', path: CAPTURE_CONFIG_PATH, body: pair('MIC-02', 'MIC-01') }).status).toBe(200);
      expect(micsOf(h.state()).map(([inputId, , channel]) => [inputId, channel])).toEqual([['MIC-02', 'MIC-01'], ['MIC-01', 'MIC-02'], ['MIC-03', 'MIC-03'], ['MIC-04', 'MIC-04']]);
      expect(changedRows(h.state()).slice(before + 1).map((row) => [row.details?.['field'], row.details?.['inputId'], row.details?.['from'], row.details?.['to']])).toEqual([
        // D61 (2026-11-04): each row names the INPUT it moved onto its channel: channel 1 took MIC-02, channel 2 MIC-01.
        ['SOURCE', 'MIC-02', 'MIC-05', 'MIC-02'],
        ['SOURCE', 'MIC-01', 'MIC-02', 'MIC-01'],
      ]);
    });

    it('a line may name the transport; the same two inputs trading channels is two SOURCE rows (D61: the ROLE-row special case is gone)', () => {
      const h = harness();
      registerLocalMic(h);
      expect(h.sim.request({ method: 'POST', path: CAPTURE_CONFIG_PATH, body: pair('MIC-05', 'MIC-02', { transport: 'AVFOUNDATION' }) }).status).toBe(200);
      expect(micsOf(h.state())[0]).toEqual(['MIC-05', 'MIC-05', 'MIC-01', 'AVFOUNDATION']);
      const before = changedRows(h.state()).length;
      expect(h.sim.request({ method: 'POST', path: CAPTURE_CONFIG_PATH, body: pair('MIC-02', 'MIC-05') }).status).toBe(200);
      expect(micsOf(h.state()).slice(0, 2)).toEqual([
        ['MIC-02', 'MIC-02', 'MIC-01', 'USB'],
        ['MIC-05', 'MIC-05', 'MIC-02', 'AVFOUNDATION'],
      ]);
      expect(changedRows(h.state()).slice(before).map((row) => row.details)).toEqual([
        { operationId: 'updateCaptureConfig', scope: 'MIC', field: 'SOURCE', channel: 'MIC-01', inputId: 'MIC-02', deviceId: 'MIC-02', from: 'MIC-05', to: 'MIC-02', permission: 'CAPTURE_CONFIG' },
        { operationId: 'updateCaptureConfig', scope: 'MIC', field: 'SOURCE', channel: 'MIC-02', inputId: 'MIC-05', deviceId: 'MIC-05', from: 'MIC-02', to: 'MIC-05', permission: 'CAPTURE_CONFIG' },
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
      const line = (inputId: string, channel?: string, deviceId = inputId) => ({ inputId, deviceId, ...(channel === undefined ? {} : { channel }) }); // D61 (2026-11-04): the by-role form became the by-channel form
      const bodies: Record<string, unknown> = {
        // Task 4 row 162 (rule MIC-ASSIGN, C21 (8), D61): a single line with a channel is VALID - a
        // channel is assignable alone. What stays refused of the single line: the input another
        // assigned channel holds.
        'a single line naming an input another channel holds': { mics: [line('MIC-02', 'MIC-01')] },
        'the two forms mixed': { mics: [line('MIC-05', 'MIC-01'), line('MIC-02')] },
        'two MIC-01 lines': { mics: [line('MIC-05', 'MIC-01'), line('MIC-02', 'MIC-01')] },
        'two MIC-02 lines': { mics: [line('MIC-05', 'MIC-02'), line('MIC-02', 'MIC-02')] },
        'one input twice': { mics: [line('MIC-05', 'MIC-01'), line('MIC-05', 'MIC-02')] },
        'a device that is not the input': { mics: [line('MIC-05', 'MIC-01', 'MIC-01'), line('MIC-02', 'MIC-02')] },
        'a microphone the registry does not hold': { mics: [line('MIC-07', 'MIC-01'), line('MIC-02', 'MIC-02')] },
        'a camera behind a mic input': { mics: [line('MIC-05', 'MIC-01', 'CAM-01'), line('MIC-02', 'MIC-02')] },
        'an input id outside MIC-NN': { mics: [line('MIC-3', 'MIC-01'), line('MIC-02', 'MIC-02')] },
        'a channel outside the four': { mics: [line('MIC-05', 'ACTIVE'), line('MIC-02', 'MIC-02')] },
        // The earlier form cannot name a new input: it edits an input the selector holds.
        'the earlier form naming MIC-05': { mics: [line('MIC-05')] },
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
      // Task 4 row 162 as generalized by D61: one line by channel is refused only when it names the
      // input another assigned channel holds (it was refused whatever it named before row 162).
      expect(() => setCaptureConfigTransition(state, START, change([{ inputId: 'MIC-02', deviceId: 'MIC-02', channel: 'MIC-01' }]))).toThrow(SimTransitionError);
      expect(() => setCaptureConfigTransition(state, START, change([{ inputId: 'MIC-05', deviceId: 'MIC-01', channel: 'MIC-01' },{ inputId: 'MIC-02', deviceId: 'MIC-02', channel: 'MIC-02' }]))).toThrow(SimTransitionError);
      const replaced = setCaptureConfigTransition(state, START, change([{ inputId: 'MIC-02', deviceId: 'MIC-02', channel: 'MIC-02' }, { inputId: 'MIC-05', deviceId: 'MIC-05', channel: 'MIC-01' }]));
      expect(replaced.captureConfig.mics.map((mic) => [mic.inputId, mic.channel])).toEqual([['MIC-05', 'MIC-01'], ['MIC-02', 'MIC-02'], ['MIC-03', 'MIC-03'], ['MIC-04', 'MIC-04']]);
      // The earlier form on the replaced selector: a transport edit of an input it holds.
      const edited = setCaptureConfigTransition(replaced, START + 1, change([{ inputId: 'MIC-05', deviceId: 'MIC-05', transport: 'AVFOUNDATION' }]));
      expect(edited.captureConfig.mics.find((mic) => mic.inputId === 'MIC-05')).toMatchObject({ channel: 'MIC-01', transport: 'AVFOUNDATION' });
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
      const interval = { sessionId: 'SES-20261001-0001', seq: 1, inputId: 'MIC-03', role: 'PRIMARY' as const, fromMs: 0, toMs: null, fromAt: START, toAt: null, switchedBy: null, reason: 'START' }; // D61 (2026-11-04): the interval keeps the worker's pair word - channel 1 is PRIMARY
      expect(AudioSourceIntervalEntrySchema.safeParse(interval).success).toBe(true);
      for (const bad of BAD_IDS) {
        expect(AudioSourceSwitchRequestSchema.safeParse({ inputId: bad }).success, bad).toBe(false);
        expect(AudioSourceStateSchema.safeParse({ ...state, activeInputId: bad }).success, bad).toBe(false);
        expect(AudioSourceIntervalEntrySchema.safeParse({ ...interval, inputId: bad }).success, bad).toBe(false);
      }
    });

    it('the meters slice is keyed by the inputs of the capture, whichever they are (D61: up to four)', () => {
      const h = harness('recording');
      const audio = h.state().audio;
      expect(AudioSliceSchema.safeParse(audio).success).toBe(true);
      const frame = audio.inputs['MIC-01'];
      const replaced = { inputs: { 'MIC-02': frame, 'MIC-03': frame }, activeInputId: 'MIC-03' };
      expect(AudioSliceSchema.safeParse(replaced).success).toBe(true);
      // No more than FOUR inputs (D61), each keyed by an input id, each a whole frame.
      expect(AudioSliceSchema.safeParse({ ...replaced, inputs: { 'MIC-01': frame, 'MIC-02': frame, 'MIC-03': frame } }).success).toBe(true); // D61 (2026-11-04): three of four channels is a slice
      expect(AudioSliceSchema.safeParse({ ...replaced, inputs: { 'MIC-01': frame, 'MIC-02': frame, 'MIC-03': frame, 'MIC-04': frame } }).success).toBe(true); // D61: the complete slice
      expect(AudioSliceSchema.safeParse({ ...replaced, inputs: { 'MIC-01': frame, 'MIC-02': frame, 'MIC-03': frame, 'MIC-04': frame, 'MIC-05': frame } }).success).toBe(false); // D61: five keys exceed the four channels
      // Task 4 row 28 (register E41): AT MOST four - one frame per microphone line of the selector,
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
    // The lines STATE their role (a complete pair; register 161 section 3.2): the lookup that read a
    // line by its place alone, with a built-in input where none was, is deleted (task 4 row 172).
    const roleLines = (first: string, second: string) => [
      { inputId: first, channel: 'MIC-01' as const },
      { inputId: second, channel: 'MIC-02' as const },
    ];

    it('the rule: channel 1 is the first line, channel 2 the second; the built-in pair gives the old table', () => {
      const builtIn = roleLines('MIC-01', 'MIC-02');
      expect([meterInputOfChannel(builtIn, 'AUDIO-01'), meterInputOfChannel(builtIn, 'AUDIO-02')]).toEqual(['MIC-01', 'MIC-02']);
      const replacedPair = roleLines('MIC-01', 'MIC-03');
      expect([meterInputOfChannel(replacedPair, 'AUDIO-01'), meterInputOfChannel(replacedPair, 'AUDIO-02')]).toEqual(['MIC-01', 'MIC-03']);
      expect([channelOfMicLine(replacedPair, 'MIC-01'), channelOfMicLine(replacedPair, 'MIC-03'), channelOfMicLine(replacedPair, 'MIC-02')]).toEqual(['AUDIO-01', 'AUDIO-02', null]);
      const beyond = roleLines('MIC-02', 'MIC-03');
      expect([meterInputOfChannel(beyond, 'AUDIO-01'), meterInputOfChannel(beyond, 'AUDIO-02')]).toEqual(['MIC-02', 'MIC-03']);
      // No line at all (a hand-built state): no channel has an input - never the built-in pair.
      expect([meterInputOfChannel([], 'AUDIO-01'), meterInputOfChannel([], 'AUDIO-02')]).toEqual([null, null]);
    });

    it('with channel 1 on MIC-05 all meters read, and the transcription pair resolves through the channels (D61)', () => {
      const h = harness();
      registerLocalMic(h);
      expect(h.sim.request({ method: 'POST', path: CAPTURE_CONFIG_PATH, body: pair('MIC-05', 'MIC-01') }).status).toBe(200);
      const lines = captureMicLines(h.state());
      expect(lines.map((mic) => [mic.inputId, mic.channel])).toEqual([['MIC-05', 'MIC-01'], ['MIC-01', 'MIC-02'], ['MIC-03', 'MIC-03'], ['MIC-04', 'MIC-04']]);
      // The replacement re-keyed the meters at once: one frame per line of the selector, channel 1 active.
      expect(Object.keys(h.state().audio.inputs).sort()).toEqual(['MIC-01', 'MIC-03', 'MIC-04', 'MIC-05']);
      expect(h.state().audio.activeInputId).toBe('MIC-05');
      expect(AudioSliceSchema.safeParse(h.state().audio).success).toBe(true);

      // ALL METERS READ: the 20 Hz subsystem writes a new frame per input, and only those of the lines.
      const before = h.state().audio.inputs;
      h.clock.advance(1_000);
      h.sim.tick();
      const audio = h.state().audio;
      expect(Object.keys(audio.inputs).sort()).toEqual(['MIC-01', 'MIC-03', 'MIC-04', 'MIC-05']);
      for (const inputId of ['MIC-01', 'MIC-03', 'MIC-04', 'MIC-05']) {
        const frame = audio.inputs[inputId];
        expect(frame, inputId).toBeDefined();
        expect(frame?.noSignal, inputId).toBe(false);
        expect(frame?.at, inputId).toBeGreaterThan(before[inputId]?.at ?? Number.MAX_SAFE_INTEGER);
        expect(Number.isFinite(frame?.dbfs), inputId).toBe(true);
      }
      expect('MIC-02' in audio.inputs).toBe(false);
      expect(AudioSliceSchema.safeParse(audio).success).toBe(true);

      // THE CHANNELS RESOLVE: the audio status names every line with its channel and its device
      // (D61 of 2026-11-04: the entry carries the CHANNEL; the worker role word left the answer).
      const status = h.sim.request({ method: 'GET', path: '/api/v1/audio/status' }).body as { activeInputId: string; channels: { inputId: string; deviceId: string; channel: string; noSignal: boolean }[] };
      expect(status.channels.map((entry) => [entry.inputId, entry.deviceId, entry.channel, entry.noSignal])).toEqual([
        ['MIC-05', 'MIC-05', 'MIC-01', false],
        ['MIC-01', 'MIC-01', 'MIC-02', false],
        ['MIC-03', 'MIC-03', 'MIC-03', false],
        ['MIC-04', 'MIC-04', 'MIC-04', false],
      ]);
      expect(status.activeInputId).toBe('MIC-05');
      for (const entry of status.channels) expect(AudioChannelStatusSchema.safeParse(entry).success).toBe(true);
      expect([micInputOfCaptureRole(h.state(), 'PRIMARY'), micInputOfCaptureRole(h.state(), 'STANDBY')]).toEqual(['MIC-05', 'MIC-01']);
      // The mic slice carries the DEVICE of its own channel; the active channel is 1.
      expect(h.state().mics.map((mic) => [mic.id, mic.deviceId])).toEqual([['AUDIO-01', 'MIC-05'], ['AUDIO-02', 'MIC-01'], ['AUDIO-03', 'MIC-03'], ['AUDIO-04', 'MIC-04']]);
      expect(activeMeterChannel(h.state())).toBe('AUDIO-01');
    });

    it('a measured level and a silence warning reach the channel of their own input, never another microphone\'s', () => {
      const h = harness();
      registerLocalMic(h);
      // D61 (2026-11-04): MIC-03 stands on channel 3 and may not jump to channel 1 in one body (the
      // picker rule); MIC-05 is the registered-later device. Channel 1 takes MIC-05, channel 2 MIC-01.
      expect(h.sim.request({ method: 'POST', path: CAPTURE_CONFIG_PATH, body: pair('MIC-05', 'MIC-01') }).status).toBe(200);
      const state = h.state();
      // The worker reports by ROLE: the PRIMARY level is channel 1's (MIC-05), the STANDBY level channel 2's (MIC-01).
      const runtime = createAudioRuntime('external');
      feedCaptureLevels(runtime, state, START, [{ role: 'PRIMARY', dbfs: -6.25, clipped: false }, { role: 'STANDBY', dbfs: -30, clipped: false }]) // the worker wire (capture-protocol v4) still names the roles; D61 maps them to channels 1 and 2;
      expect([runtime.captureLevels['MIC-05']?.dbfs, runtime.captureLevels['MIC-01']?.dbfs, runtime.captureLevels['MIC-02']]).toEqual([-6.25, -30, undefined]); // D61: MIC-02 left the selector
      // A silence warning of MIC-03 is channel 3's; the role word PRIMARY names the input of channel 1;
      // without a subject it is the active input's - channel 1 here (D61).
      for (const [subject, target] of [['MIC-03', 'AUDIO-03'], ['PRIMARY', 'AUDIO-01'], [null, 'AUDIO-01']] as const) {
        const raised = raiseCaptureWarningTransition(state, START, { code: 'MIC_SILENT', subject: subject as 'MIC-03' | 'PRIMARY' | null });
        expect(raised.faults.active.filter((fault) => fault.kind === 'MIC_SILENT').map((fault) => fault.target), String(subject)).toEqual([target]);
      }
      expect(raiseCaptureWarningTransition(state, START, { code: 'MIC_SILENT', subject: 'MIC-01' }).faults.active.filter((fault) => fault.kind === 'MIC_SILENT').map((fault) => fault.target)).toEqual(['AUDIO-02']); // D61: MIC-01 moved to channel 2
      // CONTROL: MIC-09 is neither a channel nor an input of this capture - it names no microphone (D61: `MIC-02` alone now reads as the channel word).
      expect(() => raiseCaptureWarningTransition(state, START, { code: 'MIC_SILENT', subject: 'MIC-09' })).toThrow();
    });

    it('CONTROL: the built-in pair meters exactly as before - MIC-01 on channel 1, MIC-02 on channel 2', () => {
      const h = harness();
      h.clock.advance(1_000);
      h.sim.tick();
      expect(Object.keys(h.state().audio.inputs).sort()).toEqual(['MIC-01', 'MIC-02', 'MIC-03', 'MIC-04']); // D61 (2026-11-04): the built-in FOUR meter, MIC-0N on channel N
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

  it('the six slots are the four video tracks and the two microphone roles, in that order; the type of the change is the type of the list', () => {
    // D60 (2026-11-04): the slot list carries all FOUR video tracks.
    expect(CAPTURE_SELECTOR_SLOTS).toEqual(['VIDEO-01', 'VIDEO-02', 'VIDEO-03', 'VIDEO-04', 'MIC-01', 'MIC-02', 'MIC-03', 'MIC-04']);
    // `sim/types.ts` states the slot structurally (it imports nothing of `api/`): the two are one type.
    expectTypeOf<CaptureSelectorSlot>().toEqualTypeOf<(typeof CAPTURE_SELECTOR_SLOTS)[number]>();
    // The body and the `UPDATE` kind of the hosted action carry the member with the same element type.
    expectTypeOf<NonNullable<CaptureConfigUpdateRequest['unassign']>[number]>().toEqualTypeOf<CaptureSelectorSlot>();
    expectTypeOf<NonNullable<Extract<CaptureConfigChange, { kind: 'UPDATE' }>['unassign']>[number]>().toEqualTypeOf<CaptureSelectorSlot>();
    // No new kind of change: the three of operations 78, 79, 80.
    expectTypeOf<CaptureConfigChange['kind']>().toEqualTypeOf<'UPDATE' | 'CAMERA_SOURCE' | 'PRIMARY_MIC'>();
    expect(CAPTURE_CONFIG_CHANGE_OPERATION_ID).toEqual({ UPDATE: 'updateCaptureConfig', CAMERA_SOURCE: 'setCaptureCameraSource', PRIMARY_MIC: 'setPrimaryMic' });
  });

  it('`unassign` is optional and takes one to eight slots, each at most once; a body without it reads as before', () => { // D61 (2026-11-04): was one to six (D60), one to four
    // Without the member: the bodies of today, unchanged.
    expect(accepts({})).toBe(true);
    expect(accepts({ cameras: [{ trackId: 'VIDEO-01', deviceId: 'CAM-02' }] })).toBe(true);
    expect(CaptureConfigUpdateRequestSchema.parse({ cameras: [{ trackId: 'VIDEO-01', deviceId: 'CAM-02' }] })).toStrictEqual({ cameras: [{ trackId: 'VIDEO-01', deviceId: 'CAM-02' }] });
    // Each slot alone, and all eight.
    for (const slot of CAPTURE_SELECTOR_SLOTS) expect(CaptureConfigUpdateRequestSchema.parse({ unassign: [slot] }), slot).toStrictEqual({ unassign: [slot] });
    // D61 (2026-11-04): the role words are no longer slots - a body naming them is refused.
    expect(accepts({ unassign: ['VIDEO-01', 'VIDEO-02', 'PRIMARY', 'STANDBY'] })).toBe(false);
    expect(accepts({ unassign: ['STANDBY', 'VIDEO-02'] })).toBe(false);
    // D61 (2026-11-04): all EIGHT slots in one body are accepted.
    expect(accepts({ unassign: ['VIDEO-01', 'VIDEO-02', 'VIDEO-03', 'VIDEO-04', 'MIC-01', 'MIC-02', 'MIC-03', 'MIC-04'] })).toBe(true);
    // Refused: an empty list, a slot twice, an unknown slot, a stored slot word, another type.
    expect(refusedAt({ unassign: [] })).toEqual(['unassign']);
    expect(refusedAt({ unassign: ['VIDEO-01', 'VIDEO-01'] })).toEqual(['unassign']);
    expect(accepts({ unassign: ['VIDEO-01', 'VIDEO-02', 'MIC-01', 'MIC-02', 'VIDEO-01'] })).toBe(false); // D61: five entries pass the bound (eight), the doubled track does not
    for (const bad of ['VIDEO-05', 'AUDIO-01', 'MIC-PRIMARY', 'STANDBY', 'CAM-01', 'primary', '', null, 1]) // D61: MIC-01..04 are slots now; the role words are not expect(accepts({ unassign: [bad] }), String(bad)).toBe(false);
    for (const bad of ['VIDEO-01', null, {}, 4]) expect(accepts({ unassign: bad }), String(bad)).toBe(false);
    // The body stays strict: no other member came with it.
    expect(accepts({ unassign: ['VIDEO-01'], assign: ['VIDEO-02'] })).toBe(false);
  });

  it('AD-10 (3): a body that clears a slot and assigns the same slot is refused by the schema, on the path `unassign`', () => {
    const camera = (trackId: string) => ({ trackId, deviceId: 'CAM-01' });
    const byChannel = (inputId: string, channel: string) => ({ inputId, deviceId: inputId, channel }); // D61 (2026-11-04)
    // A video slot: cleared and the track of a camera line.
    expect(refusedAt({ unassign: ['VIDEO-01'], cameras: [camera('VIDEO-01')] })).toEqual(['unassign']);
    expect(refusedAt({ unassign: ['VIDEO-02', 'MIC-01'], cameras: [camera('VIDEO-01'), camera('VIDEO-02')] })).toEqual(['unassign']);
    // A microphone slot: cleared and the channel of a mic line (D61).
    expect(refusedAt({ unassign: ['MIC-01'], mics: [byChannel('MIC-03', 'MIC-01')] })).toEqual(['unassign']);
    expect(refusedAt({ unassign: ['MIC-02'], mics: [byChannel('MIC-01', 'MIC-01'), byChannel('MIC-02', 'MIC-02')] })).toEqual(['unassign']);
    // The control beside each refusal: another slot of the same body is assigned.
    expect(accepts({ unassign: ['VIDEO-01'], cameras: [camera('VIDEO-02')] })).toBe(true);
    expect(accepts({ unassign: ['MIC-02'], mics: [byChannel('MIC-03', 'MIC-01')] })).toBe(true);
    expect(accepts({ unassign: ['VIDEO-01', 'VIDEO-02'], mics: [byChannel('MIC-01', 'MIC-01'), byChannel('MIC-02', 'MIC-02')] })).toBe(true);
    // A mic line WITHOUT `channel` names an input, not a slot: the schema cannot know which channel
    // holds it, so this body passes here and the hosted action decides (register 4.3, second line; row 162; D61).
    expect(accepts({ unassign: ['MIC-01'], mics: [{ inputId: 'MIC-01', deviceId: 'MIC-01' }] })).toBe(true);
  });

  it('the rule MIC-ASSIGN is in the words of the contract: a channel is assignable alone (D61 of 2026-11-04 renamed the member)', () => {
    const channel = CaptureConfigMicUpdateSchema.shape.channel.description ?? '';
    expect(channel).toContain('a channel is assignable alone');
    expect(channel).toContain('one to four lines');
    expect(Object.keys(CaptureConfigMicUpdateSchema.shape)).toEqual(['inputId', 'deviceId', 'transport', 'channel']);
    expect(CaptureConfigUpdateRequestSchema.description).toContain('{ cameras?[], mics?[], unassign?[] }');
    // One line by channel is a body the schema takes (the 422 of today is the hosted action's; D61).
    expect(accepts({ mics: [{ inputId: 'MIC-03', deviceId: 'MIC-03', channel: 'MIC-01' }] })).toBe(true);
  });
});

// Task 4 row 162 (WP-13a; decisions C14, C18, C21 (8), C25; requirements AD-04, AD-10 (1), (3);
// names register of row 161, section 4; sites C9 to C12 of row 27): the hosted action itself.
// `unassign` really unassigns, a cleared slot can be assigned again, and NOTHING is found by its
// place: a camera line by its track, a microphone line by its role. The doubles are hand-built
// simulator states, one per selector category of the design addendum 1.5 (each slot is U =
// unassigned, D = a development kind, P = a production kind; the action itself is blind to the class).
describe('setCaptureConfig: a selector slot may be unassigned and assigned again (task 4 row 162)', () => {
  // The registry (4 development and 4 production devices), the line builders and the seven
  // categories are the bed of WP-13a (`support/selector-category-bed.ts`), shared with rows 163 and 165.
  const { PROFILE, REGISTRY, CATEGORIES, cam, mic, selectorPatch } = selectorBed;
  type Lines = selectorBed.SelectorLines;
  const SLOTS: readonly CaptureSelectorSlot[] = CAPTURE_SELECTOR_SLOTS;
  const isTrack = (slot: CaptureSelectorSlot): slot is VideoTrackId => slot.startsWith('VIDEO-'); // D60 (2026-11-04): four video slots

  /** A signed-in simulator state (TECHNICIAN, no session) with the bed's registry and the lines given; its meters agree with its selector. */
  const stateOf = (lines: Lines): SimState => {
    const state = harness('TECHNICIAN').state();
    return { ...state, ...selectorPatch(state, lines) };
  };
  const rowsOf = (state: SimState): AuditRow[] => state.audit.rows.filter((row) => row.type === 'CAPTURE_CONFIG_CHANGED');
  const newRows = (before: SimState, after: SimState): Record<string, string>[] => rowsOf(after).slice(rowsOf(before).length).map((row) => (row.details ?? {}) as Record<string, string>);
  const update = (state: SimState, change: Omit<Extract<CaptureConfigChange, { kind: 'UPDATE' }>, 'kind'>, at = START + 1): SimState => setCaptureConfigTransition(state, at, { kind: 'UPDATE', ...change });
  const heldOf = (state: SimState, slot: CaptureSelectorSlot): string | null =>
    (isTrack(slot) ? state.captureConfig.cameras.find((line) => line.trackId === slot)?.deviceId : state.captureConfig.mics.find((line) => line.channel === slot)?.deviceId) ?? null;
  const linesOf = (state: SimState) => ({
    cameras: state.captureConfig.cameras.map((line) => [line.trackId, line.deviceId, line.profile]),
    mics: state.captureConfig.mics.map((line) => [line.inputId, line.deviceId, line.channel]),
  });
  /** What every result must be: a selector slice of the contract, and meters keyed by exactly the inputs the selector holds. */
  const expectSound = (state: SimState, name: string): void => {
    expect(CaptureConfigSliceSchema.safeParse(state.captureConfig).success, name).toBe(true);
    expect(AudioSliceSchema.safeParse(state.audio).success, name).toBe(true);
    expect(Object.keys(state.audio.inputs).sort(), name).toEqual(state.captureConfig.mics.map((line) => line.inputId).sort());
    // The lists as held: cameras in track order, microphones in input order.
    expect(state.captureConfig.cameras.map((line) => line.trackId), name).toEqual(state.captureConfig.cameras.map((line) => line.trackId).sort());
    // D61 (2026-11-04): the mic list is held in CHANNEL order (`MIC-01`..`MIC-04`); the cameras keep track order.
    expect(state.captureConfig.mics.map((line) => line.channel), name).toEqual(state.captureConfig.mics.map((line) => line.channel).sort());
  };
  /** A registered device of the slot's kind that no line of the selector names. */
  const freeDeviceFor = (state: SimState, slot: CaptureSelectorSlot): string => {
    const used = new Set([...state.captureConfig.cameras, ...state.captureConfig.mics].map((line) => line.deviceId));
    const free = REGISTRY.find((entry) => entry.kind === (isTrack(slot) ? 'CAMERA' : 'MIC') && !used.has(entry.id));
    if (free === undefined) throw new Error(`no free device for ${slot}`);
    return free.id;
  };
  const assignment = (slot: CaptureSelectorSlot, deviceId: string): Omit<Extract<CaptureConfigChange, { kind: 'UPDATE' }>, 'kind'> =>
    isTrack(slot) ? { cameras: [{ trackId: slot, deviceId }] } : { mics: [{ inputId: deviceId, deviceId, channel: slot }] }; // D61 (2026-11-04): the mic slot is a channel

  it.each(Object.entries(CATEGORIES))('category %s: every slot can be unassigned and assigned again, by its track or its channel', (name, lines) => { // D61 (2026-11-04): the role became the channel
    for (const slot of SLOTS) {
      const label = `${name} / ${slot}`;
      const start = stateOf(lines);
      const held = heldOf(start, slot);

      // UNASSIGN. One row for a slot that holds a source; an empty slot changes nothing at all.
      const cleared = update(start, { unassign: [slot] });
      if (held === null) {
        expect(cleared, label).toBe(start);
      } else {
        const heldInput = isTrack(slot) ? null : (start.captureConfig.mics.find((line) => line.channel === slot)?.inputId ?? null);
        expect(newRows(start, cleared), label).toEqual([
          isTrack(slot)
            ? { operationId: 'updateCaptureConfig', scope: 'CAMERA', field: 'SOURCE', trackId: slot, from: held, permission: 'CAPTURE_CONFIG' }
            : { operationId: 'updateCaptureConfig', scope: 'MIC', field: 'SOURCE', channel: slot, inputId: heldInput, from: held, permission: 'CAPTURE_CONFIG' }, // D61 (2026-11-04): the row names its channel
        ]);
        expect(cleared.captureConfig.updatedAt, label).toBe(START + 1);
        if (!isTrack(slot)) expectSound(cleared, label);
      }
      expect(heldOf(cleared, slot), label).toBeNull();
      // No OTHER slot moved: each still holds what it held, under its own track or role.
      for (const other of SLOTS) if (other !== slot) expect(heldOf(cleared, other), `${label}: ${other}`).toBe(heldOf(start, other));
      // Clearing it a second time is clearing an empty slot.
      expect(update(cleared, { unassign: [slot] }), label).toBe(cleared);

      // ASSIGN AGAIN: the device it held, or a free one where it held none.
      const deviceId = held ?? freeDeviceFor(cleared, slot);
      const assigned = update(cleared, assignment(slot, deviceId), START + 2);
      const [row, ...more] = newRows(cleared, assigned);
      expect(more, label).toEqual([]);
      // The audit row of an assignment into an EMPTY slot: `from` is ABSENT - never the new device.
      expect(row, label).toEqual(
        isTrack(slot)
          ? { operationId: 'updateCaptureConfig', scope: 'CAMERA', field: 'SOURCE', trackId: slot, deviceId, to: deviceId, permission: 'CAPTURE_CONFIG' }
          : { operationId: 'updateCaptureConfig', scope: 'MIC', field: 'SOURCE', channel: slot, inputId: deviceId, deviceId, to: deviceId, permission: 'CAPTURE_CONFIG' }, // D61 (2026-11-04): the row names its channel
      );
      expect(heldOf(assigned, slot), label).toBe(deviceId);
      for (const other of SLOTS) if (other !== slot) expect(heldOf(assigned, other), `${label}: ${other}`).toBe(heldOf(start, other));
      // A slot that was held is back exactly as it was: same lines, same order.
      if (held !== null) expect(linesOf(assigned), label).toEqual(linesOf(start));
      expectSound(assigned, label);
      for (const details of [...newRows(start, cleared), ...newRows(cleared, assigned)]) {
        expect(Object.keys(details).filter((key) => !DETAIL_KEYS.includes(key)), label).toEqual([]);
        expect(Object.values(details).every((value) => typeof value === 'string'), label).toBe(true);
        if ('from' in details) expect(details['from'], label).not.toBe(details['to']);
      }
    }
  });

  it('AD-10 (1): two cleared slots are two rows, an empty slot is none; all eight (D61), then nothing is left to clear', () => {
    const seeded = stateOf(CATEGORIES[selectorBed.SEEDED_CATEGORY]!);
    const two = update(seeded, { unassign: ['VIDEO-02', 'MIC-02'] });
    expect(newRows(seeded, two)).toEqual([
      { operationId: 'updateCaptureConfig', scope: 'CAMERA', field: 'SOURCE', trackId: 'VIDEO-02', from: 'CAM-02', permission: 'CAPTURE_CONFIG' },
      { operationId: 'updateCaptureConfig', scope: 'MIC', field: 'SOURCE', channel: 'MIC-02', inputId: 'MIC-02', from: 'MIC-02', permission: 'CAPTURE_CONFIG' }, // D61 (2026-11-04): the row names its channel
    ]);
    // D60 (2026-11-04): the seeded selector keeps its two further camera lines. D61: and its two further mic lines.
    expect(linesOf(two)).toEqual({ cameras: [['VIDEO-01', 'CAM-01', PROFILE], ['VIDEO-03', 'CAM-05', PROFILE], ['VIDEO-04', 'CAM-06', PROFILE]], mics: [['MIC-01', 'MIC-01', 'MIC-01'], ['MIC-03', 'MIC-03', 'MIC-03'], ['MIC-04', 'MIC-04', 'MIC-04']] });
    // The same two again, with the others still held: only the held ones give a row.
    const rest = update(two, { unassign: ['VIDEO-02', 'MIC-02', 'VIDEO-01', 'MIC-01', 'VIDEO-03', 'VIDEO-04', 'MIC-03', 'MIC-04'] }, START + 2);
    expect(newRows(two, rest).map((details) => [details['trackId'] ?? details['inputId'], details['from'], details['to'], details['deviceId']])).toEqual([
      ['VIDEO-01', 'CAM-01', undefined, undefined],
      ['MIC-01', 'MIC-01', undefined, undefined],
      ['VIDEO-03', 'CAM-05', undefined, undefined],
      ['VIDEO-04', 'CAM-06', undefined, undefined],
      ['MIC-03', 'MIC-03', undefined, undefined], // D61 (2026-11-04): the four-channel seed leaves six held slots
      ['MIC-04', 'MIC-04', undefined, undefined], // D61
    ]);
    expect(linesOf(rest)).toEqual({ cameras: [], mics: [] });
    expect(rest.audio.inputs).toEqual({});
    // No PRIMARY line: the state holds NO active input (task 4 row 149) - not the input it held,
    // not a line by its place, and no meter is keyed by one.
    expect(rest.audio.activeInputId).toBeNull();
    // All eight on the empty selector: the SAME state - no row, no new `updatedAt` (D61).
    expect(update(rest, { unassign: ['VIDEO-01', 'VIDEO-02', 'VIDEO-03', 'VIDEO-04', 'MIC-01', 'MIC-02', 'MIC-03', 'MIC-04'] }, START + 3)).toBe(rest);
    expect(rowsOf(rest)).toHaveLength(rowsOf(seeded).length + 8); // D61 (2026-11-04): eight cleared slots
  });

  it('the order inside one change is unassign, cameras, mics; an assignment over a HELD slot still says what was there', () => {
    const seeded = stateOf(CATEGORIES[selectorBed.SEEDED_CATEGORY]!);
    // VIDEO-01 is cleared, then CAM-01 (which it held) may feed VIDEO-02 with the same profile:
    // the rule "one camera on both tracks" is held on the RESULT, where it is on one track only.
    // D61 (2026-11-04): the mic line takes MIC-05 - a free device; MIC-03 stands on channel 3 and
    // may not jump to channel 1 while channel 3 keeps its line (the picker rule).
    const moved = update(seeded, { unassign: ['VIDEO-01', 'MIC-02'], cameras: [{ trackId: 'VIDEO-02', deviceId: 'CAM-01' }], mics: [{ inputId: 'MIC-05', deviceId: 'MIC-05', channel: 'MIC-01' }] });
    // D60 (2026-11-04): the two camera lines the change does not name stay (the seeded four). D61: so do the mic channels the body does not name.
    expect(linesOf(moved)).toEqual({ cameras: [['VIDEO-02', 'CAM-01', PROFILE], ['VIDEO-03', 'CAM-05', PROFILE], ['VIDEO-04', 'CAM-06', PROFILE]], mics: [['MIC-05', 'MIC-05', 'MIC-01'], ['MIC-03', 'MIC-03', 'MIC-03'], ['MIC-04', 'MIC-04', 'MIC-04']] });
    expect(newRows(seeded, moved).map((details) => [details['scope'], details['trackId'] ?? details['inputId'], details['from'], details['to']])).toEqual([
      ['CAMERA', 'VIDEO-01', 'CAM-01', undefined],
      ['MIC', 'MIC-02', 'MIC-02', undefined],
      ['CAMERA', 'VIDEO-02', 'CAM-02', 'CAM-01'],
      ['MIC', 'MIC-05', 'MIC-01', 'MIC-05'], // D61: channel 1 was held by MIC-01
    ]);
    expect(Object.keys(moved.audio.inputs)).toEqual(['MIC-05', 'MIC-03', 'MIC-04']); // D61: keyed by the surviving lines
    expect(moved.audio.activeInputId).toBe('MIC-05');
  });

  it('AD-04: a lone VIDEO-02 line and a lone channel-2 line stay what they are - nothing takes the place of the empty slot', () => { // D61 (2026-11-04): the STANDBY role became channel 2
    const lone = stateOf({ cameras: [cam('VIDEO-02', 'CAM-02')], mics: [mic('MIC-02', 'MIC-02')] }); // D61: a lone channel-2 line
    // A camera for the empty VIDEO-01: the VIDEO-02 line is not read as "the first track".
    const video = update(lone, { cameras: [{ trackId: 'VIDEO-01', deviceId: 'CAM-01', profile: 'H264_720P25' }] });
    expect(linesOf(video).cameras).toEqual([['VIDEO-01', 'CAM-01', 'H264_720P25'], ['VIDEO-02', 'CAM-02', PROFILE]]);
    expect(newRows(lone, video)).toEqual([{ operationId: 'updateCaptureConfig', scope: 'CAMERA', field: 'SOURCE', trackId: 'VIDEO-01', deviceId: 'CAM-01', to: 'CAM-01', permission: 'CAPTURE_CONFIG' }]);
    // Operation 79 fills an empty track too (it names no profile: the seeded one).
    const byOp79 = setCaptureConfigTransition(lone, START + 1, { kind: 'CAMERA_SOURCE', deviceId: 'CAM-03', trackId: 'VIDEO-01' });
    expect(linesOf(byOp79).cameras).toEqual([['VIDEO-01', 'CAM-03', PROFILE], ['VIDEO-02', 'CAM-02', PROFILE]]);
    expect(newRows(lone, byOp79)).toEqual([{ operationId: 'setCaptureCameraSource', scope: 'CAMERA', field: 'SOURCE', trackId: 'VIDEO-01', deviceId: 'CAM-03', to: 'CAM-03', permission: 'CAPTURE_CONFIG' }]);
    // The camera of the other track with the same profile is still refused, with its reason.
    expect(() => setCaptureConfigTransition(lone, START + 1, { kind: 'CAMERA_SOURCE', deviceId: 'CAM-02', trackId: 'VIDEO-01' })).toThrow(expect.objectContaining({ code: 'INVALID_INPUT', reason: CAPTURE_CONFIG_CAMERA_ON_BOTH_TRACKS }));

    // The lone channel-2 line: the meters keep the keys of the surviving lines; the cleared channel
    // moves nothing - the slice keeps the device it knows and invents none (D61).
    const cleared = update(stateOf(CATEGORIES[selectorBed.SEEDED_CATEGORY]!), { unassign: ['MIC-01'] });
    expect(linesOf(cleared).mics).toEqual([['MIC-02', 'MIC-02', 'MIC-02'], ['MIC-03', 'MIC-03', 'MIC-03'], ['MIC-04', 'MIC-04', 'MIC-04']]);
    expect(Object.keys(cleared.audio.inputs).sort()).toEqual(['MIC-02', 'MIC-03', 'MIC-04']);
    expect(cleared.mics.map((entry) => [entry.id, entry.deviceId])).toEqual([['AUDIO-01', 'MIC-01'], ['AUDIO-02', 'MIC-02'], ['AUDIO-03', 'MIC-03'], ['AUDIO-04', 'MIC-04']]);
    // A channel-1 line alone beside it (rule MIC-ASSIGN): the transcription pair is complete again.
    const paired = update(cleared, { mics: [{ inputId: 'MIC-05', deviceId: 'MIC-05', channel: 'MIC-01' }] }, START + 2);
    expect(linesOf(paired).mics).toEqual([['MIC-05', 'MIC-05', 'MIC-01'], ['MIC-02', 'MIC-02', 'MIC-02'], ['MIC-03', 'MIC-03', 'MIC-03'], ['MIC-04', 'MIC-04', 'MIC-04']]);
    // D61 (2026-11-04): channel 1 was CLEARED above - an assignment into an empty slot says no `from`.
    expect(newRows(cleared, paired)).toEqual([{ operationId: 'updateCaptureConfig', scope: 'MIC', field: 'SOURCE', channel: 'MIC-01', inputId: 'MIC-05', deviceId: 'MIC-05', to: 'MIC-05', permission: 'CAPTURE_CONFIG' }]);
    expect(Object.keys(paired.audio.inputs).sort()).toEqual(['MIC-02', 'MIC-03', 'MIC-04', 'MIC-05']);
    expect(paired.audio.activeInputId).toBe('MIC-05');
    // The slice follows the channels (D61): channel 1 carries the device of its new line.
    expect(paired.mics.map((entry) => [entry.id, entry.deviceId])).toEqual([['AUDIO-01', 'MIC-05'], ['AUDIO-02', 'MIC-02'], ['AUDIO-03', 'MIC-03'], ['AUDIO-04', 'MIC-04']]);
    // A channel replaced ALONE on a selector that holds it: `from` is the device that held the channel.
    const replaced = update(paired, { mics: [{ inputId: 'MIC-06', deviceId: 'MIC-06', channel: 'MIC-02' }] }, START + 3);
    expect(linesOf(replaced).mics).toEqual([['MIC-05', 'MIC-05', 'MIC-01'], ['MIC-06', 'MIC-06', 'MIC-02'], ['MIC-03', 'MIC-03', 'MIC-03'], ['MIC-04', 'MIC-04', 'MIC-04']]);
    expect(newRows(paired, replaced)).toEqual([{ operationId: 'updateCaptureConfig', scope: 'MIC', field: 'SOURCE', channel: 'MIC-02', inputId: 'MIC-06', deviceId: 'MIC-06', from: 'MIC-02', to: 'MIC-06', permission: 'CAPTURE_CONFIG' }]);
    // Operation 80 on a selector whose channel 1 is empty names its input: the line lands on channel 1.
    const promoted = setCaptureConfigTransition(cleared, START + 2, { kind: 'PRIMARY_MIC', inputId: 'MIC-02' });
    expect(linesOf(promoted).mics).toEqual([['MIC-02', 'MIC-02', 'MIC-01'], ['MIC-03', 'MIC-03', 'MIC-03'], ['MIC-04', 'MIC-04', 'MIC-04']]);
  });

  it('AD-10 (3): a change that clears a slot and fills the same slot is refused with its reason, in all three forms, and changes nothing', () => {
    expect(CAPTURE_CONFIG_SLOT_UNASSIGNED_AND_ASSIGNED).toBe('SLOT_UNASSIGNED_AND_ASSIGNED');
    const seeded = stateOf(CATEGORIES[selectorBed.SEEDED_CATEGORY]!);
    const refused: Record<string, Omit<Extract<CaptureConfigChange, { kind: 'UPDATE' }>, 'kind'>> = {
      'a camera line of the cleared track': { unassign: ['VIDEO-01'], cameras: [{ trackId: 'VIDEO-01', deviceId: 'CAM-03' }] },
      'a mic line of the cleared channel': { unassign: ['MIC-02'], mics: [{ inputId: 'MIC-03', deviceId: 'MIC-03', channel: 'MIC-02' }] },
      // The form the schema cannot see: a line WITHOUT `role` edits the input the cleared slot held.
      'a mic line without a channel on the input the cleared slot held': { unassign: ['MIC-01'], mics: [{ inputId: 'MIC-01', deviceId: 'MIC-01', transport: 'AVFOUNDATION' }] },
    };
    for (const [name, change] of Object.entries(refused)) {
      let thrown: unknown = null;
      try {
        update(seeded, change);
      } catch (error) {
        thrown = error;
      }
      expect(thrown, name).toBeInstanceOf(SimTransitionError);
      expect(thrown, name).toMatchObject({ code: 'INVALID_INPUT', reason: CAPTURE_CONFIG_SLOT_UNASSIGNED_AND_ASSIGNED });
    }
    // CONTROLS: the line without a channel on the OTHER input passes (D61: the seeded four stand,
    // channel 1 cleared, MIC-02's transport edited); an input the selector never held is the plain refusal, without that reason.
    const other = update(seeded, { unassign: ['MIC-01'], mics: [{ inputId: 'MIC-02', deviceId: 'MIC-02', transport: 'AVFOUNDATION' }] });
    expect(other.captureConfig.mics.map((line) => [line.inputId, line.channel, line.transport])).toEqual([['MIC-02', 'MIC-02', 'AVFOUNDATION'], ['MIC-03', 'MIC-03', 'USB'], ['MIC-04', 'MIC-04', 'USB']]); // D61 (2026-11-04): channel order, the surviving lines
    let plain: unknown = null;
    try {
      update(seeded, { unassign: ['MIC-01'], mics: [{ inputId: 'MIC-05', deviceId: 'MIC-05' }] }); // D61: MIC-05 is registered but the selector holds it nowhere
    } catch (error) {
      plain = error;
    }
    expect(plain).toMatchObject({ code: 'INVALID_INPUT', reason: null });
    // A slot that is no slot of the selector (the action is also called without the schema in front of it).
    expect(() => update(seeded, { unassign: ['MIC-PRIMARY' as unknown as CaptureSelectorSlot] })).toThrow(expect.objectContaining({ code: 'INVALID_INPUT' }));
    // A single line by role that names the other role's input: the reason of the picker (register D-3).
    expect(() => update(seeded, { mics: [{ inputId: 'MIC-02', deviceId: 'MIC-02', channel: 'MIC-01' }] })).toThrow(expect.objectContaining({ code: 'INVALID_INPUT', reason: CAPTURE_CONFIG_MIC_ON_BOTH_INPUTS }));
  });

  it.each(['recording', 'finalizing'] as const)('AD-10 (2) at the action: `unassign` is refused while a session is open (%s), with no row and no change', (scenario) => {
    // TECHNICIAN since the 0034 revocation: reach the lock, not the permission refusal.
    const h = harness('TECHNICIAN', scenario);
    const before = h.state();
    expect(() => h.sim.actions.setCaptureConfig({ kind: 'UPDATE', unassign: ['MIC-02'] })).toThrow(expect.objectContaining({ code: 'ILLEGAL_STATE', event: 'setCaptureConfig' }));
    expect(h.state()).toBe(before);
  });

  it('CONTROL: the seeded selector of the simulator is complete, and the simulator action clears and fills it through the same transition', () => {
    const h = harness('TECHNICIAN');
    // D60 (2026-11-04): the simulator's seeded selector names all FOUR camera lines.
    // D61 (2026-11-04): and all FOUR microphone channels.
    expect(selector(h)).toEqual({ cameras: [['VIDEO-01', 'CAM-01', PROFILE], ['VIDEO-02', 'CAM-02', PROFILE], ['VIDEO-03', 'CAM-03', PROFILE], ['VIDEO-04', 'CAM-04', PROFILE]], mics: [['MIC-01', 'MIC-01', 'MIC-01'], ['MIC-02', 'MIC-02', 'MIC-02'], ['MIC-03', 'MIC-03', 'MIC-03'], ['MIC-04', 'MIC-04', 'MIC-04']] });
    h.sim.actions.setCaptureConfig({ kind: 'UPDATE', unassign: ['VIDEO-02'] });
    expect(selector(h).cameras).toEqual([['VIDEO-01', 'CAM-01', PROFILE], ['VIDEO-03', 'CAM-03', PROFILE], ['VIDEO-04', 'CAM-04', PROFILE]]);
    h.sim.actions.setCaptureConfig({ kind: 'CAMERA_SOURCE', deviceId: 'CAM-02', trackId: 'VIDEO-02' });
    expect(selector(h).cameras).toEqual([['VIDEO-01', 'CAM-01', PROFILE], ['VIDEO-02', 'CAM-02', PROFILE], ['VIDEO-03', 'CAM-03', PROFILE], ['VIDEO-04', 'CAM-04', PROFILE]]);
    expect(h.changes().map((row) => [row.details?.['from'], row.details?.['to']])).toEqual([['CAM-02', undefined], [undefined, 'CAM-02']]);
  });
});
