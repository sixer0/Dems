// The no-device notices and the start rule of the pre-check (task 3 blueprint row 133; specs R-10
// AC-1, AC-2, AC-5, AC-6; contract C3 §3.1, §5.2 `CAPTURE_DEVICE_UNREACHABLE`, §5.4; decisions
// D72(h), D80(6), D80(8), D83, D101(2); checks M4-NODEV-A-1, M4-NODEV-B-1 (simulator half),
// M4-PRECHK-RULE-1, M4-AUD-1 for the one audit type this row writes).
//
// Every `it` holds its own negative control: the count that must not be exceeded is shown to move
// when the condition really differs (another target, a clear in between, another reachability).
import { describe, expect, it } from 'vitest';
import {
  CAPTURE_NOTICE_DISCOVERY_TARGET,
  CaptureStartRule,
  PRECHECK_ORDER,
  SimNotFoundError,
  SimTransitionError,
  activeCaptureNotice,
  captureReachabilityOf,
  createManualClock,
  createSim,
  evaluatePrecheck,
  isCaptureNotice,
  type CaptureWarningInput,
  type SessionCreateInput,
  type SimState,
} from '../src/sim';

const START = Date.UTC(2026, 9, 1, 3, 0, 0);

const INPUT: SessionCreateInput = {
  caseNumber: 'LP/2026/1001-0008',
  subjectType: 'SAKSI',
  subjectName: 'Test Saksi',
  investigatorId: 'OPR-001',
  room: 'Interview Room 1',
  profileId: 'STANDARD_1080P25',
};

function harness() {
  const clock = createManualClock(START);
  const sim = createSim({ clock, storage: null, authStorage: null });
  sim.actions.signIn('budi.santoso', 'demo-2026');
  const state = (): SimState => sim.store.getState();
  const run = (ms: number) => {
    for (let elapsed = 0; elapsed < ms; elapsed += 50) {
      clock.advance(50);
      sim.tick();
    }
  };
  const notices = (reason: string) => state().alerts.filter((alert) => alert.kind === 'SYSTEM' && alert.params?.['reason'] === reason);
  const rowsOf = (type: string) => state().audit.rows.filter((row) => row.type === type);
  return { sim, clock, state, run, notices, rowsOf };
}

const EMPTY = (searchId = 'DSC-000001', trigger: 'MANUAL' | 'PRECHECK' = 'MANUAL'): CaptureWarningInput => ({ code: 'CAPTURE_DISCOVERY_EMPTY', subject: null, searchId, trigger });
const UNREACHABLE = (subject: string, patch: Partial<Extract<CaptureWarningInput, { code: 'CAPTURE_DEVICE_UNREACHABLE' }>> = {}): CaptureWarningInput => ({
  code: 'CAPTURE_DEVICE_UNREACHABLE',
  subject,
  phase: 'PRECHECK',
  cause: 'UNREACHABLE',
  degraded: true,
  sessionId: 'SES-20261001-0001',
  ...patch,
});

describe('situation A: a search that found nothing (M4-NODEV-A-1, simulator half)', () => {
  it('one SYSTEM WARNING alert with ids and codes only, no audit row, no fault; five empty searches leave ONE alert', () => {
    const h = harness();
    const auditBefore = h.state().audit.rows.length;
    for (let index = 1; index <= 5; index += 1) h.sim.actions.raiseCaptureWarning(EMPTY(`DSC-00000${index}`));
    const alerts = h.notices('CAPTURE_DISCOVERY_EMPTY');
    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toMatchObject({ kind: 'SYSTEM', severity: 'WARNING', active: true, target: CAPTURE_NOTICE_DISCOVERY_TARGET });
    // The first search's ID: a raise while the alert is active changes nothing.
    expect(alerts[0]?.params).toEqual({ reason: 'CAPTURE_DISCOVERY_EMPTY', searchId: 'DSC-000001', trigger: 'MANUAL' });
    // D80(8): the alert is not a second audit row. The search row is the search's own.
    expect(h.state().audit.rows).toHaveLength(auditBefore);
    expect(h.state().faults.active).toEqual([]);

    // Control: after a clear the same raise IS a new alert (so the count above was held by the rule, not by the harness).
    h.sim.actions.clearCaptureWarning({ code: 'CAPTURE_DISCOVERY_EMPTY', subject: null });
    h.sim.actions.raiseCaptureWarning(EMPTY('DSC-000006', 'PRECHECK'));
    expect(h.notices('CAPTURE_DISCOVERY_EMPTY')).toHaveLength(2);
  });

  it('a later search with a responder resolves it and writes no audit row; raise, clear, raise is 2 alerts with 2 ids', () => {
    const h = harness();
    h.sim.actions.raiseCaptureWarning(EMPTY());
    const auditBefore = h.state().audit.rows.length;
    h.clock.advance(1_000);
    h.sim.actions.clearCaptureWarning({ code: 'CAPTURE_DISCOVERY_EMPTY', subject: null });
    const [first] = h.notices('CAPTURE_DISCOVERY_EMPTY');
    expect(first).toMatchObject({ active: false, resolvedAt: START + 1_000 });
    expect(activeCaptureNotice(h.state(), 'CAPTURE_DISCOVERY_EMPTY', CAPTURE_NOTICE_DISCOVERY_TARGET)).toBeUndefined();
    expect(h.state().audit.rows).toHaveLength(auditBefore);

    // A clear with nothing active is the same state object.
    const settled = h.state();
    h.sim.actions.clearCaptureWarning({ code: 'CAPTURE_DISCOVERY_EMPTY', subject: null });
    expect(h.state()).toBe(settled);

    h.sim.actions.raiseCaptureWarning(EMPTY('DSC-000002'));
    const all = h.notices('CAPTURE_DISCOVERY_EMPTY');
    expect(all).toHaveLength(2);
    expect(new Set(all.map((alert) => alert.id)).size).toBe(2);
    expect(all.filter((alert) => alert.active)).toHaveLength(1);
  });

  it('the demo fault operations never clear it (D72(h)): clearFault of every kind leaves the alert active', () => {
    const h = harness();
    h.sim.actions.raiseCaptureWarning(EMPTY());
    h.sim.actions.raiseCaptureWarning(UNREACHABLE('CAM-02'));
    for (const kind of ['CAPTURE_FAULT', 'CAMERA_LOSS', 'MIC_SILENT', 'MIC_NO_SIGNAL'] as const) h.sim.actions.clearFault(kind);
    expect(h.notices('CAPTURE_DISCOVERY_EMPTY').filter((alert) => alert.active)).toHaveLength(1);
    expect(h.notices('CAPTURE_DEVICE_UNREACHABLE').filter((alert) => alert.active)).toHaveLength(1);
    // Control: the capture side's own clear does resolve it.
    h.sim.actions.clearCaptureWarning({ code: 'CAPTURE_DEVICE_UNREACHABLE', subject: 'CAM-02', phase: 'PRECHECK' });
    expect(h.notices('CAPTURE_DEVICE_UNREACHABLE').filter((alert) => alert.active)).toHaveLength(0);
  });
});

describe('situation B: a configured device unreachable (M4-NODEV-B-1 simulator half; M4-AUD-1)', () => {
  it('one alert per device and one CAPTURE_DEVICE_UNREACHABLE row with exactly the six keys; a repeat writes nothing', () => {
    const h = harness();
    h.sim.actions.raiseCaptureWarning(UNREACHABLE('CAM-02', { searchResponderCount: 0 }));
    const once = h.state();
    for (let index = 0; index < 4; index += 1) h.sim.actions.raiseCaptureWarning(UNREACHABLE('CAM-02', { searchResponderCount: 3 }));
    // Raised per refresh it would be 5: it is 1, and the state object did not move.
    expect(h.state()).toBe(once);

    const [alert] = h.notices('CAPTURE_DEVICE_UNREACHABLE');
    expect(h.notices('CAPTURE_DEVICE_UNREACHABLE')).toHaveLength(1);
    expect(alert).toMatchObject({ kind: 'SYSTEM', severity: 'WARNING', target: 'CAM-02', active: true, message: 'CAM-02 is not reachable' });
    expect(alert?.params).toEqual({ reason: 'CAPTURE_DEVICE_UNREACHABLE', deviceId: 'CAM-02', deviceKind: 'CAMERA', phase: 'PRECHECK', cause: 'UNREACHABLE', searchResponderCount: 0 });

    const rows = h.rowsOf('CAPTURE_DEVICE_UNREACHABLE');
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ category: 'DEVICE', severity: 'WARNING', actorId: null, deviceId: 'CAM-02', sessionId: 'SES-20261001-0001' });
    expect(Object.keys(rows[0]?.details ?? {}).sort()).toEqual(['degraded', 'deviceId', 'deviceKind', 'phase', 'reason', 'sessionId']);
    expect(rows[0]?.details).toEqual({ deviceId: 'CAM-02', deviceKind: 'CAMERA', phase: 'PRECHECK', reason: 'UNREACHABLE', degraded: true, sessionId: 'SES-20261001-0001' });

    // Control: another device IS another alert and another row.
    h.sim.actions.raiseCaptureWarning(UNREACHABLE('MIC-02', { cause: 'DEVICE_NOT_FOUND' }));
    expect(h.notices('CAPTURE_DEVICE_UNREACHABLE')).toHaveLength(2);
    expect(h.rowsOf('CAPTURE_DEVICE_UNREACHABLE')).toHaveLength(2);
    expect(h.notices('CAPTURE_DEVICE_UNREACHABLE')[1]?.params).toEqual({ reason: 'CAPTURE_DEVICE_UNREACHABLE', deviceId: 'MIC-02', deviceKind: 'MIC', phase: 'PRECHECK', cause: 'DEVICE_NOT_FOUND' });
  });

  it('no label, address or model text in the alert or the audit row: device ids, counts and codes only (R-10 AC-6)', () => {
    const h = harness();
    h.sim.actions.raiseCaptureWarning(UNREACHABLE('CAM-01'));
    const device = h.state().captureDevices.devices.find((candidate) => candidate.id === 'CAM-01');
    const [alert] = h.notices('CAPTURE_DEVICE_UNREACHABLE');
    const [row] = h.rowsOf('CAPTURE_DEVICE_UNREACHABLE');
    const written = JSON.stringify([alert, row?.message, row?.details]);
    // The control is that the registry row does hold such text.
    expect(typeof device?.model === 'string' && device.model.length > 0).toBe(true);
    expect(typeof device?.host === 'string' && device.host.length > 0).toBe(true);
    expect(written).not.toContain(String(device?.model));
    expect(written).not.toContain(String(device?.host));
    for (const forbidden of ['username', 'secret', 'password', 'rtsp://', 'http://', '@']) expect(written).not.toContain(forbidden);
  });

  it('the device reads not online while unreachable and online again after the clear; resolving writes no row; the second occurrence is NEW', () => {
    const h = harness();
    const online = (id: string) => h.state().captureDevices.devices.find((device) => device.id === id)?.online;
    h.sim.actions.raiseCaptureWarning(UNREACHABLE('CAM-02'));
    expect(online('CAM-02')).toBe(false);
    expect(h.state().captureDevices.devices.find((device) => device.id === 'CAM-02')?.streamState).toBe('LOST');
    expect(h.state().captureConfig.cameras.find((camera) => camera.deviceId === 'CAM-02')).toMatchObject({ online: false, streamState: 'LOST' });
    expect(online('CAM-01')).toBe(true);

    h.sim.actions.clearCaptureWarning({ code: 'CAPTURE_DEVICE_UNREACHABLE', subject: 'CAM-02', phase: 'PRECHECK' });
    expect(online('CAM-02')).toBe(true);
    expect(h.state().captureConfig.cameras.find((camera) => camera.deviceId === 'CAM-02')).toMatchObject({ online: true, streamState: 'LIVE' });
    expect(h.notices('CAPTURE_DEVICE_UNREACHABLE').map((alert) => alert.active)).toEqual([false]);
    expect(h.rowsOf('CAPTURE_DEVICE_UNREACHABLE')).toHaveLength(1);

    h.sim.actions.raiseCaptureWarning(UNREACHABLE('CAM-02'));
    const alerts = h.notices('CAPTURE_DEVICE_UNREACHABLE');
    expect(alerts.map((alert) => alert.active)).toEqual([false, true]);
    expect(alerts[0]?.id).not.toBe(alerts[1]?.id);
    expect(h.rowsOf('CAPTURE_DEVICE_UNREACHABLE')).toHaveLength(2);
  });

  it('a re-read of the inputs (operation 97) records presence only: no alert, no audit row, and it resolves no pre-check alert', () => {
    const h = harness();
    const auditBefore = h.state().audit.rows.length;
    h.sim.actions.raiseCaptureWarning({ code: 'CAPTURE_DEVICE_UNREACHABLE', subject: 'MIC-02', phase: 'PRESENCE', cause: 'DEVICE_NOT_FOUND' });
    expect(h.state().captureDevices.devices.find((device) => device.id === 'MIC-02')?.online).toBe(false);
    expect(h.state().captureConfig.mics.find((mic) => mic.deviceId === 'MIC-02')?.online).toBe(false);
    expect(h.notices('CAPTURE_DEVICE_UNREACHABLE')).toHaveLength(0);
    expect(h.state().audit.rows).toHaveLength(auditBefore);

    // A pre-check alert of that microphone stays active when a re-read finds it present.
    h.sim.actions.raiseCaptureWarning(UNREACHABLE('MIC-02'));
    h.sim.actions.clearCaptureWarning({ code: 'CAPTURE_DEVICE_UNREACHABLE', subject: 'MIC-02', phase: 'PRESENCE' });
    expect(h.state().captureDevices.devices.find((device) => device.id === 'MIC-02')?.online).toBe(true);
    expect(h.notices('CAPTURE_DEVICE_UNREACHABLE').filter((alert) => alert.active)).toHaveLength(1);
    // Control: the pre-check's own clear resolves it.
    h.sim.actions.clearCaptureWarning({ code: 'CAPTURE_DEVICE_UNREACHABLE', subject: 'MIC-02', phase: 'PRECHECK' });
    expect(h.notices('CAPTURE_DEVICE_UNREACHABLE').filter((alert) => alert.active)).toHaveLength(0);
  });

  it('a subject that is no camera or microphone of the registry is refused and nothing is written', () => {
    const h = harness();
    const before = h.state();
    for (const subject of ['VIDEO-02', 'CAM-99', 'POE-SW-01', 'PRIMARY', '']) {
      expect(() => h.sim.actions.raiseCaptureWarning(UNREACHABLE(subject))).toThrow(SimNotFoundError);
      expect(() => h.sim.actions.clearCaptureWarning({ code: 'CAPTURE_DEVICE_UNREACHABLE', subject, phase: 'PRECHECK' })).toThrow(SimNotFoundError);
    }
    expect(h.state()).toBe(before);
    expect(isCaptureNotice({ code: 'CAPTURE_FAULT' })).toBe(false);
    expect(isCaptureNotice({ code: 'CAPTURE_DEVICE_UNREACHABLE' })).toBe(true);
  });

  it('a capture FAULT still takes the fault path: FAULT_RAISED, an entry in faults.active, no notice', () => {
    const h = harness();
    const raisedBefore = h.rowsOf('FAULT_RAISED').length;
    h.sim.actions.raiseCaptureWarning({ code: 'MIC_SILENT', subject: 'PRIMARY' });
    expect(h.state().faults.active.map((fault) => fault.kind)).toEqual(['MIC_SILENT']);
    expect(h.rowsOf('FAULT_RAISED')).toHaveLength(raisedBefore + 1);
    expect(h.state().alerts.filter((alert) => alert.kind === 'SYSTEM')).toHaveLength(0);
  });
});

describe('the start rule of the pre-check (M4-PRECHK-RULE-1; D80(6), D83)', () => {
  const offline = (h: ReturnType<typeof harness>, ...ids: string[]) => {
    for (const id of ids) h.sim.actions.raiseCaptureWarning({ code: 'CAPTURE_DEVICE_UNREACHABLE', subject: id, phase: 'PRESENCE' });
  };
  const precheck = (h: ReturnType<typeof harness>) => {
    h.sim.actions.createSession(INPUT);
    h.sim.actions.beginPrecheck();
    h.run(5_000);
    const session = h.state().session;
    const item = (id: string) => session?.precheck.items.find((candidate) => candidate.id === id);
    return { session, item };
  };

  it('the order is the role-keyed pair, eight checks (D101(2))', () => {
    expect(PRECHECK_ORDER).toEqual(['CORE', 'LENS_1', 'LENS_2', 'MIC_PRIMARY', 'MIC_STANDBY', 'STORAGE', 'TIME', 'SECURITY']);
  });

  it('everything reachable: every source row passes and the session arms (the control of the cases below)', () => {
    const h = harness();
    expect(captureReachabilityOf(h.state()).map((row) => [row.slot, row.deviceId, row.status])).toEqual([
      ['VIDEO-01', 'CAM-01', 'PASS'],
      ['VIDEO-02', 'CAM-02', 'PASS'],
      ['PRIMARY', 'MIC-01', 'PASS'],
      ['STANDBY', 'MIC-02', 'PASS'],
    ]);
    const { session } = precheck(h);
    expect(session?.precheck.outcome).toBe('PASS');
    expect(session?.state).toBe('ARMED');
  });

  it('both cameras unreachable: both rows BLOCK, PRECHECK_BLOCKED, and a start is refused', () => {
    const h = harness();
    offline(h, 'CAM-01', 'CAM-02');
    const { session, item } = precheck(h);
    expect(session?.precheck.outcome).toBe('BLOCK');
    for (const [id, deviceId] of [['LENS_1', 'CAM-01'], ['LENS_2', 'CAM-02']] as const) {
      expect(item(id)).toMatchObject({ status: 'BLOCK', value: 'UNREACHABLE', reasonCode: null, params: { deviceId, deviceKind: 'CAMERA', rule: CaptureStartRule.NO_CAMERA } });
    }
    expect(h.rowsOf('PRECHECK_BLOCKED')).toHaveLength(1);
    expect(() => h.sim.actions.startRecording()).toThrow(SimTransitionError);
    expect(() => h.sim.actions.acknowledgePrecheckWarnings()).toThrow(SimTransitionError);
    expect(h.state().session?.state).toBe('PRECHECK');
  });

  it('one camera of two unreachable: that row WARNs, the other passes, and a degraded session starts only after the acknowledgement', () => {
    const h = harness();
    offline(h, 'CAM-02');
    const { session, item } = precheck(h);
    expect(session?.precheck.outcome).toBe('WARN');
    expect(item('LENS_1')).toMatchObject({ status: 'PASS' });
    expect(item('LENS_2')).toMatchObject({ status: 'WARN', value: 'UNREACHABLE', params: { deviceId: 'CAM-02', deviceKind: 'CAMERA', rule: CaptureStartRule.ONE_CAMERA } });
    expect(captureReachabilityOf(h.state()).find((row) => row.deviceId === 'CAM-02')?.degraded).toBe(true);
    // Not before the operator acknowledged.
    expect(() => h.sim.actions.startRecording()).toThrow(SimTransitionError);
    h.sim.actions.acknowledgePrecheckWarnings();
    expect(h.state().session?.state).toBe('ARMED');
    h.sim.actions.startRecording();
    expect(h.state().session?.state).toBe('RECORDING');
  });

  it('the ACTIVE (primary) microphone unreachable blocks whatever the standby does, and names the other microphone', () => {
    const h = harness();
    offline(h, 'MIC-01');
    const { session, item } = precheck(h);
    expect(session?.precheck.outcome).toBe('BLOCK');
    expect(item('MIC_PRIMARY')).toMatchObject({ status: 'BLOCK', value: 'UNREACHABLE', params: { deviceId: 'MIC-01', deviceKind: 'MIC', rule: CaptureStartRule.ACTIVE_MICROPHONE, other: 'MIC-02' } });
    expect(item('MIC_STANDBY')).toMatchObject({ status: 'PASS' });
    expect(() => h.sim.actions.startRecording()).toThrow(SimTransitionError);
    // No switch at pre-check (D83): the active input is what it was.
    expect(h.state().audio.activeInputId).toBe('MIC-01');
    expect(captureReachabilityOf(h.state()).find((row) => row.deviceId === 'MIC-01')?.degraded).toBe(false);
  });

  it('the STANDBY microphone unreachable warns: the session may start degraded after the acknowledgement', () => {
    const h = harness();
    offline(h, 'MIC-02');
    const { session, item } = precheck(h);
    expect(session?.precheck.outcome).toBe('WARN');
    expect(item('MIC_PRIMARY')).toMatchObject({ status: 'PASS' });
    expect(item('MIC_STANDBY')).toMatchObject({ status: 'WARN', value: 'UNREACHABLE', params: { deviceId: 'MIC-02', deviceKind: 'MIC', rule: CaptureStartRule.NO_STANDBY } });
    h.sim.actions.acknowledgePrecheckWarnings();
    expect(h.state().session?.state).toBe('ARMED');
  });

  it('both microphones unreachable: both rows BLOCK with the no-microphone sentence', () => {
    const h = harness();
    offline(h, 'MIC-01', 'MIC-02');
    const { session, item } = precheck(h);
    expect(session?.precheck.outcome).toBe('BLOCK');
    expect(item('MIC_PRIMARY')).toMatchObject({ status: 'BLOCK', params: { rule: CaptureStartRule.NO_MICROPHONE } });
    expect(item('MIC_STANDBY')).toMatchObject({ status: 'BLOCK', params: { rule: CaptureStartRule.NO_MICROPHONE } });
  });

  it('the role decides, not the channel: with MIC-02 primary, an unreachable MIC-02 blocks and an unreachable MIC-01 warns', () => {
    const h = harness();
    h.sim.actions.signOut();
    h.sim.actions.signIn('rina.wijaya', 'demo-2026');
    h.sim.actions.setCaptureConfig({ kind: 'PRIMARY_MIC', inputId: 'MIC-02' });
    expect(h.state().captureConfig.mics.find((mic) => mic.role === 'PRIMARY')?.inputId).toBe('MIC-02');
    offline(h, 'MIC-02');
    expect(evaluatePrecheck(h.state(), 'MIC_PRIMARY')).toMatchObject({ status: 'BLOCK', params: { deviceId: 'MIC-02', rule: CaptureStartRule.ACTIVE_MICROPHONE, other: 'MIC-01' } });
    expect(evaluatePrecheck(h.state(), 'MIC_STANDBY')).toMatchObject({ status: 'PASS' });
    h.sim.actions.clearCaptureWarning({ code: 'CAPTURE_DEVICE_UNREACHABLE', subject: 'MIC-02', phase: 'PRESENCE' });
    offline(h, 'MIC-01');
    expect(evaluatePrecheck(h.state(), 'MIC_PRIMARY')).toMatchObject({ status: 'PASS' });
    expect(evaluatePrecheck(h.state(), 'MIC_STANDBY')).toMatchObject({ status: 'WARN', params: { deviceId: 'MIC-01', rule: CaptureStartRule.NO_STANDBY } });
  });

  it('a later run with the device reachable passes: retry after the device came back arms', () => {
    const h = harness();
    offline(h, 'CAM-01', 'CAM-02');
    precheck(h);
    expect(h.state().session?.precheck.outcome).toBe('BLOCK');
    for (const id of ['CAM-01', 'CAM-02']) h.sim.actions.clearCaptureWarning({ code: 'CAPTURE_DEVICE_UNREACHABLE', subject: id, phase: 'PRECHECK' });
    h.sim.actions.retryPrecheck();
    h.run(5_000);
    expect(h.state().session?.precheck.outcome).toBe('PASS');
    expect(h.state().session?.state).toBe('ARMED');
  });

  it('a signal warning of a reachable microphone is still reported on the role-keyed row (the rule replaces nothing)', () => {
    const h = harness();
    h.sim.actions.inject('MIC_CLIP', { channel: 'AUDIO-02' });
    expect(evaluatePrecheck(h.state(), 'MIC_STANDBY')).toMatchObject({ status: 'WARN', value: 'CLIP', reasonCode: 'MIC_CLIP', params: { track: 'AUDIO-02' } });
    expect(evaluatePrecheck(h.state(), 'MIC_PRIMARY')).toMatchObject({ status: 'PASS' });
    // The channel-keyed ids still answer (stored items of older runs name them).
    expect(evaluatePrecheck(h.state(), 'MIC_2')).toMatchObject({ status: 'WARN', value: 'CLIP' });
  });
});
