/**
 * Pure model of the Devices & Inputs screens (step 84): status codes and their calm escalation
 * order, the design book's 2-port PoE view (SIM-GAP-M84-1, D79), the derived 1 Hz health lines and
 * the 1 s mic peak sampler on the simulator clock (SIM-GAP-M84-2), and the device log mapping.
 * Real simulator state from `createTestSim` (manual clock); no React.
 */
import { describe, expect, it } from '@jest/globals';
import { DEFAULT_CAPTURE_CONFIG, DEMO_OPERATOR_PASSWORD, FaultKind, ScenarioName, SlotSourceState, type AuditRow, type ChannelMicLine, type SimState } from '@dems/shared/sim';
import { createTestSim } from '@/runtime/testing/test-sim';
import { DEVICE_IDS, attentionDevices, deviceStatus, parseStatusLine, rosterTrackStatusOf, statusLine, trackSourceOf, trackStatus } from './devices-model';
import { HEALTH_POINTS, MicLevelSampler, auditRowDevice, bookPoe, channelOf, deviceLog, healthSeries, seriesInputOf } from './sim-adapter';

// Task 4 row 171 (site M6; decision C18 (2); row 164's request): the meter channel of a microphone device is read
// through the shared `channelOfMicLine` from lines that STATE their CHANNEL (D61, 2026-11-04: the role
// became the numbered channel); there is no default list.
describe('task 4 row 171: `channelOf` - the meter channel of a microphone device', () => {
  const SEEDED: ChannelMicLine[] = DEFAULT_CAPTURE_CONFIG.mics.map((line) => ({ inputId: line.inputId, channel: line.channel }));

  it('the seeded, complete four-channel plane (D61): each microphone has the channel of its line, whatever the order of the lines', () => {
    expect(channelOf('MIC-01', SEEDED)).toBe('AUDIO-01');
    expect(channelOf('MIC-02', SEEDED)).toBe('AUDIO-02');
    expect(channelOf('MIC-03', SEEDED)).toBe('AUDIO-03'); // D61 (2026-11-04)
    expect(channelOf('MIC-04', SEEDED)).toBe('AUDIO-04'); // D61
    // D61 (2026-11-04): the line is read by its STATED channel, never by its place — a reordered slice answers the same.
    const reversed = [...SEEDED].reverse();
    expect(channelOf('MIC-01', reversed)).toBe('AUDIO-01');
    expect(channelOf('MIC-04', reversed)).toBe('AUDIO-04');
    // A device that is no line (a camera) has no meter channel.
    expect(channelOf('CAM-01', SEEDED)).toBeNull();
  });

  it('an ABSENT line: a channel without its line has no input (D61) — no line, a lone line', () => {
    const loneChannel1 = SEEDED.filter((line) => line.channel === 'MIC-01'); // D61: the roles became the numbered channels
    const loneChannel2 = SEEDED.filter((line) => line.channel === 'MIC-02');
    for (const lines of [[], loneChannel1, loneChannel2]) {
      // D61 (rule D137 generalized): each channel has an input exactly when a line NAMES it.
      expect(channelOf('MIC-01', lines)).toBe(lines.length === 1 && lines[0]!.channel === 'MIC-01' ? 'AUDIO-01' : null);
      expect(channelOf('MIC-02', lines)).toBe(lines.length === 1 && lines[0]!.channel === 'MIC-02' ? 'AUDIO-02' : null);
      expect(channelOf('MIC-03', lines)).toBeNull();
      expect(channelOf('MIC-04', lines)).toBeNull();
    }
  });
});

describe('device status', () => {
  it('idle: every device is ready (Online / Active / Connected) and nothing needs attention', () => {
    const { sim } = createTestSim();
    const state = sim.store.getState();
    // D61 (2026-11-04): four cameras, four microphones (MIC-03/04 join), switch, relay, tablet.
    expect(DEVICE_IDS.map((id) => deviceStatus(state, id))).toEqual(['ONLINE', 'ONLINE', 'ONLINE', 'ONLINE', 'ONLINE', 'ONLINE', 'ONLINE', 'ONLINE', 'ACTIVE', 'ACTIVE', 'CONNECTED']);
    expect(attentionDevices(parseStatusLine(statusLine(state)))).toEqual([]);
  });

  it('faults map to calm codes, worst first: FAULT before the warnings', () => {
    const { sim } = createTestSim();
    sim.actions.inject(FaultKind.MIC_NO_SIGNAL, { channel: 'AUDIO-02' });
    sim.actions.inject(FaultKind.CAMERA_LOSS, { cameraId: 'VIDEO-02' });
    sim.actions.setTabletLink('OFFLINE');
    const statuses = parseStatusLine(statusLine(sim.store.getState()));
    expect(statuses['CAM-02']).toBe('FAULT');
    expect(statuses['MIC-02']).toBe('NO_SIGNAL');
    expect(statuses.TABLET).toBe('OFFLINE');
    expect(statuses['CAM-01']).toBe('ONLINE');
    expect(attentionDevices(statuses)).toEqual(['CAM-02', 'MIC-02', 'TABLET']);
  });

  it('row 227 (D213): devices whose state is not reported never raise attention; the others keep their rank', () => {
    const idle = parseStatusLine(statusLine(createTestSim().sim.store.getState()));
    const statuses = { ...idle, 'POE-SWITCH': 'FAULT', 'REC-INDICATOR': 'FAULT', 'CAM-01': 'FAULT', 'MIC-02': 'NO_SIGNAL' } as const;
    const notReported = new Set(['POE-SWITCH', 'REC-INDICATOR'] as const);
    // CONTROL (no set, the simulated lane): the model faults rank as before.
    expect(attentionDevices(statuses)).toEqual(['CAM-01', 'POE-SWITCH', 'REC-INDICATOR', 'MIC-02']);
    expect(attentionDevices(statuses, notReported)).toEqual(['CAM-01', 'MIC-02']);
    // Only the model-only devices fault: nothing needs attention.
    expect(attentionDevices({ ...idle, 'POE-SWITCH': 'FAULT', 'REC-INDICATOR': 'FAULT' }, notReported)).toEqual([]);
  });
});

// Audit row 191 (M3-08 R3/R4; web rows 128b and 129): ONE source reader (`slotSourceOf` through `trackSourceOf`) and
// the track status rule. The bench shape (row 190 §1, row 129 §1): the lines hold CAM-03 on VIDEO-01 and MIC-03..06 on
// channels 1-4, and the registry holds no MIC-01 / MIC-02 - the old built-in-id lookup read FAULT or another channel's row.
describe('row 191: the track status over the one source reader', () => {
  type Device = SimState['captureDevices']['devices'][number];
  const base = (): SimState => createTestSim().sim.store.getState();
  const withDevices = (state: SimState, map: (device: Device) => Device): SimState => ({ ...state, captureDevices: { ...state.captureDevices, devices: state.captureDevices.devices.map(map) } });
  const reachOf = (state: SimState, id: string, reach: 'REACHABLE' | 'NOT_REACHABLE' | null): SimState => withDevices(state, (device) => (device.id === id ? { ...device, reach, checkedAt: null } : device));

  it('NOT_REACHABLE gives FAULT; no reach and REACHABLE give the track row\'s own state', () => {
    const state = base();
    expect(trackSourceOf(reachOf(state, 'CAM-01', 'NOT_REACHABLE'), 'VIDEO-01').state).toBe(SlotSourceState.NOT_REACHABLE);
    expect(deviceStatus(reachOf(state, 'CAM-01', 'NOT_REACHABLE'), 'CAM-01')).toBe('FAULT');
    expect(deviceStatus(reachOf(state, 'CAM-01', null), 'CAM-01')).toBe('ONLINE');
    expect(deviceStatus(reachOf(state, 'CAM-01', 'REACHABLE'), 'CAM-01')).toBe('ONLINE');
    // REACHABLE gives the ROW's state, so the track's own fault stands.
    const lensFault = { ...reachOf(state, 'CAM-01', 'REACHABLE'), cameras: state.cameras.map((camera) => (camera.id === 'VIDEO-01' ? { ...camera, lens: 'FAULT' as const } : camera)) };
    expect(deviceStatus(lensFault, 'CAM-01')).toBe('FAULT');
    // A microphone: NOT_REACHABLE is FAULT; REACHABLE keeps NO SIGNAL / CLIP of its channel.
    expect(deviceStatus(reachOf(state, 'MIC-02', 'NOT_REACHABLE'), 'MIC-02')).toBe('FAULT');
    const noSignal = { ...reachOf(state, 'MIC-02', 'REACHABLE'), mics: state.mics.map((mic) => (mic.channel === 'MIC-02' ? { ...mic, state: 'NO_SIGNAL' as const } : mic)) };
    expect(deviceStatus(noSignal, 'MIC-02')).toBe('NO_SIGNAL');
    // CONTROL: the other tracks are untouched.
    expect(deviceStatus(reachOf(state, 'CAM-01', 'NOT_REACHABLE'), 'CAM-02')).toBe('ONLINE');
  });

  it('unassigned gives OFFLINE; offline or not held by the registry gives FAULT; the camera line\'s own `online: false` gives FAULT', () => {
    const state = base();
    const unassigned = { ...state, captureConfig: { ...state.captureConfig, cameras: state.captureConfig.cameras.map((line) => (line.trackId === 'VIDEO-03' ? { ...line, deviceId: null } : line)) } } as SimState;
    expect(trackStatus(unassigned, 'VIDEO-03')).toBe('OFFLINE');
    expect(deviceStatus(unassigned, 'CAM-03')).toBe('OFFLINE');
    expect(deviceStatus(withDevices(state, (device) => (device.id === 'CAM-04' ? { ...device, online: false } : device)), 'CAM-04')).toBe('FAULT');
    expect(deviceStatus({ ...state, captureDevices: { ...state.captureDevices, devices: state.captureDevices.devices.filter((device) => device.id !== 'CAM-02') } }, 'CAM-02')).toBe('FAULT');
    const lineDown = { ...state, captureConfig: { ...state.captureConfig, cameras: state.captureConfig.cameras.map((line) => (line.trackId === 'VIDEO-01' ? { ...line, online: false } : line)) } } as SimState;
    expect(deviceStatus(lineDown, 'CAM-01')).toBe('FAULT');
  });

  it('U-05 bench shape: the built-in row speaks for its TRACK, so a registry without MIC-01/MIC-02 does not read FAULT', () => {
    const state = base();
    const bench: SimState = {
      ...state,
      captureConfig: {
        ...state.captureConfig,
        cameras: state.captureConfig.cameras.map((line) => (line.trackId === 'VIDEO-01' ? { ...line, deviceId: 'CAM-03' } : line.trackId === 'VIDEO-03' ? { ...line, deviceId: 'CAM-01' } : line)),
        mics: state.captureConfig.mics.map((line) => ({ ...line, deviceId: `MIC-0${String(Number(line.channel.slice(-1)) + 2)}` })),
      } as SimState['captureConfig'],
      captureDevices: {
        ...state.captureDevices,
        devices: [
          ...state.captureDevices.devices.filter((device) => device.kind !== 'MIC'),
          ...['MIC-03', 'MIC-04', 'MIC-05', 'MIC-06'].map((id) => ({ ...state.captureDevices.devices.find((device) => device.kind === 'MIC')!, id, reach: id === 'MIC-04' ? ('NOT_REACHABLE' as const) : null })),
        ],
      } as SimState['captureDevices'],
    };
    expect(trackSourceOf(bench, 'MIC-01').deviceId).toBe('MIC-03');
    expect(deviceStatus(bench, 'MIC-01')).toBe('ONLINE');
    // Channel 2's source (MIC-04) is stated not reachable: its row says so - not channel 4's.
    expect(deviceStatus(bench, 'MIC-02')).toBe('FAULT');
    expect(deviceStatus(bench, 'MIC-04')).toBe('ONLINE');
    expect(trackSourceOf(bench, 'VIDEO-01').deviceId).toBe('CAM-03');
    expect(deviceStatus(bench, 'CAM-01')).toBe('ONLINE');
  });

  it('B16 (D114): a registered row on a line takes its track\'s status when the track is not ready; on no line, or ready, the registry rule stands', () => {
    const state = base();
    expect(rosterTrackStatusOf(state, null)).toBeNull();
    expect(rosterTrackStatusOf(state, 'VIDEO-02')).toBeNull();
    const lensFault = { ...state, cameras: state.cameras.map((camera) => (camera.id === 'VIDEO-02' ? { ...camera, lens: 'FAULT' as const } : camera)) };
    expect(rosterTrackStatusOf(lensFault, 'VIDEO-02')).toBe('FAULT');
    const clip = { ...state, mics: state.mics.map((mic) => (mic.channel === 'MIC-03' ? { ...mic, state: 'CLIP' as const } : mic)) };
    expect(rosterTrackStatusOf(clip, 'MIC-03')).toBe('CLIP');
  });
});

describe('SIM-GAP-M84-1: PoE in the design book view (D79)', () => {
  it('shows the switch’s four camera ports (D60, 2026-11-04): CAM 1 active with its lenses, CAM 3 and CAM 4 on their own ports, CAM 2/AUX spare', () => {
    const { sim } = createTestSim();
    expect(bookPoe(sim.store.getState())).toMatchObject({ cam1Link: true, cam3Link: true, cam4Link: true, active: 3, spare: 1, total: 4 });
  });

  it('PoE CAM 1 stays up while one lens streams; the switch stays ACTIVE while CAM 3 or CAM 4 feeds and faults only when all four are lost (D60, 2026-11-04)', () => {
    const { sim } = createTestSim();
    sim.actions.inject(FaultKind.CAMERA_LOSS, { cameraId: 'VIDEO-02' });
    expect(bookPoe(sim.store.getState())).toMatchObject({ cam1Link: true, active: 3 });
    expect(deviceStatus(sim.store.getState(), 'POE-SWITCH')).toBe('ACTIVE');
    sim.actions.inject(FaultKind.CAMERA_LOSS, { cameraId: 'VIDEO-01' });
    // D60: the dual-lens port drops, but the switch still powers CAM 3 and CAM 4.
    expect(bookPoe(sim.store.getState())).toMatchObject({ cam1Link: false, cam3Link: true, cam4Link: true });
    expect(deviceStatus(sim.store.getState(), 'POE-SWITCH')).toBe('ACTIVE');
    sim.actions.inject(FaultKind.CAMERA_LOSS, { cameraId: 'VIDEO-03' });
    sim.actions.inject(FaultKind.CAMERA_LOSS, { cameraId: 'VIDEO-04' });
    expect(bookPoe(sim.store.getState())).toMatchObject({ cam1Link: false, cam3Link: false, cam4Link: false, drawW: 0 });
    expect(deviceStatus(sim.store.getState(), 'POE-SWITCH')).toBe('FAULT');
  });
});

describe('SIM-GAP-M84-2: health lines', () => {
  it('derives a 1 Hz link-quality line from the bandwidth history; a lost lens drops to 0 from the fault', () => {
    const test = createTestSim();
    test.advance(10_000);
    const before = healthSeries(seriesInputOf(test.sim.store.getState()), 'CAM-02');
    expect(before.metric).toBe('linkQuality');
    expect(before.points.length).toBeGreaterThanOrEqual(9);
    expect(before.points.every((p) => p.v >= 97 && p.v <= 100)).toBe(true);
    test.sim.actions.inject(FaultKind.CAMERA_LOSS, { cameraId: 'VIDEO-02' });
    test.advance(3_000);
    const after = healthSeries(seriesInputOf(test.sim.store.getState()), 'CAM-02');
    expect(after.points.at(-1)?.v).toBe(0);
    expect(after.points.length).toBeLessThanOrEqual(HEALTH_POINTS);
    // Lens 1 is unaffected.
    expect(healthSeries(seriesInputOf(test.sim.store.getState()), 'CAM-01').points.at(-1)?.v).toBeGreaterThan(90);
  });

  it('the relay line is 1 from the recording start; the tablet line is 0 while offline', () => {
    const test = createTestSim();
    test.sim.actions.loadScenario(ScenarioName.RECORDING);
    test.advance(4_000);
    const relay = healthSeries(seriesInputOf(test.sim.store.getState()), 'REC-INDICATOR');
    expect(relay.points.at(-1)?.v).toBe(1);
    test.sim.actions.setTabletLink('OFFLINE');
    test.advance(2_000);
    expect(healthSeries(seriesInputOf(test.sim.store.getState()), 'TABLET').points.at(-1)?.v).toBe(0);
  });

  it('MicLevelSampler closes one 1 s peak per simulator second from the frame clock', () => {
    const sampler = new MicLevelSampler();
    expect(sampler.push({ at: 1_000, dbfs: -30, noSignal: false })).toBe(false);
    expect(sampler.push({ at: 1_500, dbfs: -12, noSignal: false })).toBe(false);
    expect(sampler.push({ at: 2_000, dbfs: -40, noSignal: false })).toBe(true);
    expect(sampler.points()).toEqual([{ t: 1_000, v: -12 }]);
    expect(sampler.push({ at: 3_100, dbfs: -20, noSignal: true })).toBe(true);
    expect(sampler.points()).toEqual([
      { t: 1_000, v: -12 },
      { t: 2_000, v: -40 },
    ]);
    sampler.push({ at: 4_000, dbfs: -20, noSignal: false });
    expect(sampler.points().at(-1)).toEqual({ t: 3_000, v: -90 });
  });
});

describe('device log', () => {
  const row = (partial: Partial<AuditRow>): AuditRow => ({
    seq: 1,
    id: 'A',
    at: 0,
    type: 'DEVICE_COMMAND',
    category: 'DEVICE',
    severity: 'INFO',
    actorId: null,
    message: '',
    sessionId: null,
    evidenceId: null,
    deviceId: null,
    details: {},
    prevHash: '',
    hash: '',
    ...partial,
  }) as AuditRow;

  it('maps recording rows to the lamp relay, fault rows to their target and commands to their device', () => {
    expect(auditRowDevice(row({ type: 'RECORDING_STARTED' }))).toBe('REC-INDICATOR');
    expect(auditRowDevice(row({ type: 'FAULT_RAISED', details: { kind: 'CAMERA_LOSS', target: 'VIDEO-02' } }))).toBe('CAM-02');
    expect(auditRowDevice(row({ type: 'FAULT_CLEARED', details: { kind: 'MIC_CLIP', target: 'AUDIO-01' } }))).toBe('MIC-01');
    expect(auditRowDevice(row({ deviceId: 'TABLET', type: 'TABLET_LINK_CHANGED' }))).toBe('TABLET');
    expect(auditRowDevice(row({ deviceId: 'DEMS-IR-01', type: 'DIAGNOSTICS_RUN' }))).toBeNull();
  });

  it('lists a device’s rows newest first from the real audit log', () => {
    const { sim } = createTestSim();
    // Device commands need a signed-in operator; RESTART needs DEVICE_MANAGE (TECHNICIAN, D79).
    expect(sim.actions.signIn('rina.wijaya', DEMO_OPERATOR_PASSWORD).ok).toBe(true);
    sim.actions.deviceCommand('MIC-02', 'TEST_SIGNAL');
    sim.actions.deviceCommand('CAM-01', 'TEST_SIGNAL');
    sim.actions.deviceCommand('MIC-02', 'RESTART');
    const rows = deviceLog(sim.store.getState().audit.rows, 'MIC-02');
    expect(rows.map((r) => r.details.command)).toEqual(['RESTART', 'TEST_SIGNAL']);
  });
});
