/**
 * Pure model of the Devices & Inputs screens (step 84): status codes and their calm escalation
 * order, the design book's 2-port PoE view (SIM-GAP-M84-1, D79), the derived 1 Hz health lines and
 * the 1 s mic peak sampler on the simulator clock (SIM-GAP-M84-2), and the device log mapping.
 * Real simulator state from `createTestSim` (manual clock); no React.
 */
import { describe, expect, it } from '@jest/globals';
import { DEFAULT_CAPTURE_CONFIG, DEMO_OPERATOR_PASSWORD, FaultKind, ScenarioName, type AuditRow, type RoleMicLine } from '@dems/shared/sim';
import { createTestSim } from '@/runtime/testing/test-sim';
import { DEVICE_IDS, attentionDevices, deviceStatus, parseStatusLine, statusLine } from './devices-model';
import { HEALTH_POINTS, MicLevelSampler, auditRowDevice, bookPoe, channelOf, deviceLog, healthSeries, seriesInputOf } from './sim-adapter';

// Task 4 row 171 (site M6; decision C18 (2); row 164's request): the meter channel of a microphone device is read
// through the shared `channelOfMicLine` from lines that STATE their role; there is no default list.
describe('task 4 row 171: `channelOf` - the meter channel of a microphone device', () => {
  const SEEDED: RoleMicLine[] = DEFAULT_CAPTURE_CONFIG.mics.map((line) => ({ inputId: line.inputId, role: line.role }));

  it('the seeded, complete pair: each microphone has the channel of its line, in both role arrangements (D137 kept)', () => {
    expect(channelOf('MIC-01', SEEDED)).toBe('AUDIO-01');
    expect(channelOf('MIC-02', SEEDED)).toBe('AUDIO-02');
    const reversed = [...SEEDED].reverse();
    expect(channelOf('MIC-01', reversed)).toBe('AUDIO-02');
    expect(channelOf('MIC-02', reversed)).toBe('AUDIO-01');
    // A device that is neither line (a camera) has no meter channel.
    expect(channelOf('CAM-01', SEEDED)).toBeNull();
  });

  it('an ABSENT line: no microphone has a meter channel while the selector holds no complete pair - no line, a lone line', () => {
    const lonePrimary = SEEDED.filter((line) => line.role === 'PRIMARY');
    const loneStandby = SEEDED.filter((line) => line.role === 'STANDBY');
    for (const lines of [[], lonePrimary, loneStandby]) {
      expect(channelOf('MIC-01', lines)).toBeNull();
      expect(channelOf('MIC-02', lines)).toBeNull();
    }
  });
});

describe('device status', () => {
  it('idle: every device is ready (Online / Active / Connected) and nothing needs attention', () => {
    const { sim } = createTestSim();
    const state = sim.store.getState();
    expect(DEVICE_IDS.map((id) => deviceStatus(state, id))).toEqual(['ONLINE', 'ONLINE', 'ONLINE', 'ONLINE', 'ACTIVE', 'ACTIVE', 'CONNECTED']);
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
});

describe('SIM-GAP-M84-1: PoE in the design book view (D79)', () => {
  it('shows 2 ports: PoE CAM 1 active, CAM 2/AUX spare, whatever port count the simulator models', () => {
    const { sim } = createTestSim();
    expect(bookPoe(sim.store.getState())).toMatchObject({ cam1Link: true, active: 1, spare: 1, total: 2 });
  });

  it('PoE CAM 1 stays up while one lens streams, and drops only when both are lost', () => {
    const { sim } = createTestSim();
    sim.actions.inject(FaultKind.CAMERA_LOSS, { cameraId: 'VIDEO-02' });
    expect(bookPoe(sim.store.getState())).toMatchObject({ cam1Link: true, active: 1 });
    expect(deviceStatus(sim.store.getState(), 'POE-SWITCH')).toBe('ACTIVE');
    sim.actions.inject(FaultKind.CAMERA_LOSS, { cameraId: 'VIDEO-01' });
    expect(bookPoe(sim.store.getState())).toMatchObject({ cam1Link: false, active: 0, drawW: 0 });
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
