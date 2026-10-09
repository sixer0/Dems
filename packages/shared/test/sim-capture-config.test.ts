// The hosted pair of the capture selector and the mic switch (task 3 blueprint row 66; register
// SH-18; contract C3 §2.4 operations 78 to 81, §5.2 `CAPTURE_CONFIG_CHANGED`, §6 slice 29):
// `setCaptureConfig` and `switchAudioSource` as members of `SimActions`.
//
// What must hold: an edit needs CAPTURE_CONFIG and no open session; one audit row per line that
// changed, with the key list of C3 §5.2 and nothing else; an edit that changes nothing sets nothing;
// a refused edit sets nothing; the mic rows stay in input order (AC-B-70); the selector never
// reaches a state its stored row would refuse.
import { describe, expect, it } from 'vitest';
import { CaptureConfigSliceSchema, DeltaMessageSchema } from '../src/api';
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
  type OperatorRole,
  type ScenarioName,
} from '../src/sim';

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
