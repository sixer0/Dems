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
  SlotSourceState, // audit fix row 128
  isSlotSourceUp,
  slotSourceOf,
  createSim,
  evaluatePrecheck,
  isCaptureNotice,
  type CaptureWarningInput,
  type SessionCreateInput,
  type SimState,
  CAPTURE_SOURCE_NOT_ASSIGNED_REASON,
  CAPTURE_START_REQUIRED_SLOTS,
  SOURCE_NOT_ASSIGNED_PRECHECK_VALUE,
  isOwnCaptureCoreState,
  unassignedSlotOfPrecheckItem,
  unassignedSlotsOf,
} from '../src/sim';
import { CAPTURE_SELECTOR_SLOTS, PrecheckItemSchema } from '../src/api';
import { en } from '../src/i18n';
import * as ownCaptureBed from './support/own-capture-bed';
import * as selectorBed from './support/selector-category-bed';

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

  it('the order is twelve checks: four lenses, the role-keyed pair plus channels 3 and 4 (D101(2); audit fix row 83, DF-03)', () => {
    expect(PRECHECK_ORDER).toEqual(['CORE', 'LENS_1', 'LENS_2', 'LENS_3', 'LENS_4', 'MIC_PRIMARY', 'MIC_STANDBY', 'MIC_3', 'MIC_4', 'STORAGE', 'TIME', 'SECURITY']);
    // A whole run holds one item per check, in that order.
    const h = harness();
    const { session } = precheck(h);
    expect(session?.precheck.items.map((item) => item.id)).toEqual([...PRECHECK_ORDER]);
  });

  it('a third or fourth camera unreachable now reaches the gate on its own row (DF-03); CONTROL: the first two rows pass', () => {
    for (const [deviceId, id] of [['CAM-03', 'LENS_3'], ['CAM-04', 'LENS_4']] as const) {
      const h = harness();
      offline(h, deviceId);
      const { session, item } = precheck(h);
      expect(session?.precheck.outcome, deviceId).toBe('WARN');
      expect(item(id), deviceId).toMatchObject({ status: 'WARN', value: 'UNREACHABLE', params: { deviceId, deviceKind: 'CAMERA', rule: CaptureStartRule.ONE_CAMERA } });
      expect(item('LENS_1'), deviceId).toMatchObject({ status: 'PASS' });
      expect(item('LENS_2'), deviceId).toMatchObject({ status: 'PASS' });
    }
  });

  it('a lens 3/4 that is offline in the registry BLOCKs as a lens fault, the rule of lens 1/2', () => {
    const h = harness();
    h.sim.store.setState({ cameras: h.state().cameras.map((camera) => (camera.id === 'VIDEO-04' ? { ...camera, online: false } : camera)) });
    expect(evaluatePrecheck(h.state(), 'LENS_4')).toMatchObject({ status: 'BLOCK', value: 'FAULT', reasonCode: 'LENS_FAULT', params: { track: 'VIDEO-04' } });
    expect(evaluatePrecheck(h.state(), 'LENS_3')).toMatchObject({ status: 'PASS', value: 'READY' });
  });

  it('channels 3 and 4: unreachable takes the per-slot status of the reachability rows; a signal warning names the track (DF-03)', () => {
    for (const [deviceId, id] of [['MIC-03', 'MIC_3'], ['MIC-04', 'MIC_4']] as const) {
      const h = harness();
      offline(h, deviceId);
      const row = captureReachabilityOf(h.state()).find((candidate) => candidate.deviceId === deviceId);
      expect(row?.status, deviceId).not.toBe('PASS');
      expect(evaluatePrecheck(h.state(), id), deviceId).toMatchObject({ status: row?.status, value: 'UNREACHABLE', params: { deviceId, deviceKind: 'MIC' } });
      expect(evaluatePrecheck(h.state(), 'MIC_PRIMARY'), deviceId).toMatchObject({ status: 'PASS' });
    }
    const h = harness();
    h.sim.actions.inject('MIC_CLIP', { channel: 'AUDIO-03' });
    expect(evaluatePrecheck(h.state(), 'MIC_3')).toMatchObject({ status: 'WARN', value: 'CLIP', reasonCode: 'MIC_CLIP', params: { track: 'AUDIO-03' } });
    expect(evaluatePrecheck(h.state(), 'MIC_4')).toMatchObject({ status: 'PASS', value: 'READY' });
    h.sim.store.setState({ mics: h.state().mics.map((m) => (m.id === 'AUDIO-04' ? { ...m, state: 'NO_SIGNAL' } : m)) });
    expect(evaluatePrecheck(h.state(), 'MIC_4')).toMatchObject({ status: 'WARN', value: 'NO_SIGNAL', reasonCode: 'MIC_NO_SIGNAL', params: { track: 'AUDIO-04' } });
  });

  it('a stored eight-item pre-check (before row 83) still parses item by item: the IDs were only added', () => {
    const h = harness();
    const { session } = precheck(h);
    const OLD_EIGHT: readonly string[] = ['CORE', 'LENS_1', 'LENS_2', 'MIC_PRIMARY', 'MIC_STANDBY', 'STORAGE', 'TIME', 'SECURITY'];
    const stored = (session?.precheck.items ?? []).filter((item) => OLD_EIGHT.includes(item.id));
    expect(stored).toHaveLength(8);
    expect(stored.every((item) => PrecheckItemSchema.safeParse(item).success)).toBe(true);
    // The older channel-keyed IDs too (stored items of task-3 runs name them). CONTROL: an unknown ID is refused.
    expect(PrecheckItemSchema.safeParse({ ...stored[3], id: 'MIC_1' }).success).toBe(true);
    expect(PrecheckItemSchema.safeParse({ ...stored[3], id: 'LENS_5' }).success).toBe(false);
  });

  it('everything reachable: every source row passes and the session arms (the control of the cases below)', () => {
    const h = harness();
    // D61 (2026-11-04): the seeded selector reaches EIGHT sources - four cameras and four channels.
    expect(captureReachabilityOf(h.state()).map((row) => [row.slot, row.deviceId, row.status])).toEqual([
      ['VIDEO-01', 'CAM-01', 'PASS'],
      ['VIDEO-02', 'CAM-02', 'PASS'],
      ['VIDEO-03', 'CAM-03', 'PASS'],
      ['VIDEO-04', 'CAM-04', 'PASS'],
      ['MIC-01', 'MIC-01', 'PASS'],
      ['MIC-02', 'MIC-02', 'PASS'],
      ['MIC-03', 'MIC-03', 'PASS'],
      ['MIC-04', 'MIC-04', 'PASS'],
    ]);
    const { session } = precheck(h);
    expect(session?.precheck.outcome).toBe('PASS');
    expect(session?.state).toBe('ARMED');
  });

  it('every camera unreachable: every camera row BLOCKs, PRECHECK_BLOCKED, and a start is refused (D60: four cameras)', () => {
    const h = harness();
    offline(h, 'CAM-01', 'CAM-02', 'CAM-03', 'CAM-04');
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

  it('one camera of four unreachable: that row WARNs, the others pass, and a degraded session starts only after the acknowledgement', () => {
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

  it('a non-transcribed channel unreachable warns: the session may start degraded after the acknowledgement (D61: channel 2)', () => {
    const h = harness();
    offline(h, 'MIC-02');
    const { session, item } = precheck(h);
    expect(session?.precheck.outcome).toBe('WARN');
    expect(item('MIC_PRIMARY')).toMatchObject({ status: 'PASS' });
    expect(item('MIC_STANDBY')).toMatchObject({ status: 'WARN', value: 'UNREACHABLE', params: { deviceId: 'MIC-02', deviceKind: 'MIC', rule: CaptureStartRule.NO_STANDBY } });
    h.sim.actions.acknowledgePrecheckWarnings();
    expect(h.state().session?.state).toBe('ARMED');
  });

  it('ALL microphones unreachable: every channel row BLOCKs with the no-microphone sentence (D61)', () => {
    const h = harness();
    offline(h, 'MIC-01', 'MIC-02', 'MIC-03', 'MIC-04');
    const { session, item } = precheck(h);
    expect(session?.precheck.outcome).toBe('BLOCK');
    expect(item('MIC_PRIMARY')).toMatchObject({ status: 'BLOCK', params: { rule: CaptureStartRule.NO_MICROPHONE } });
    expect(item('MIC_STANDBY')).toMatchObject({ status: 'BLOCK', params: { rule: CaptureStartRule.NO_MICROPHONE } });
  });

  it('the channel decides, not the input name: with MIC-02 on channel 1, an unreachable MIC-02 blocks and an unreachable MIC-01 warns (D61)', () => {
    const h = harness();
    h.sim.actions.signOut();
    h.sim.actions.signIn('rina.wijaya', 'demo-2026');
    h.sim.actions.setCaptureConfig({ kind: 'PRIMARY_MIC', inputId: 'MIC-02' });
    expect(h.state().captureConfig.mics.find((mic) => mic.channel === 'MIC-01')?.inputId).toBe('MIC-02');
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
    offline(h, 'CAM-01', 'CAM-02', 'CAM-03', 'CAM-04'); // D60: ALL cameras down blocks (one of four only warns)
    precheck(h);
    expect(h.state().session?.precheck.outcome).toBe('BLOCK');
    for (const id of ['CAM-01', 'CAM-02', 'CAM-03', 'CAM-04']) h.sim.actions.clearCaptureWarning({ code: 'CAPTURE_DEVICE_UNREACHABLE', subject: id, phase: 'PRECHECK' });
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

// Task 4 row 163 (WP-13a; decisions C18 (1), C21 (6), C25; names register of row 161, section 5;
// sites C4, C5 of row 27): a selector slot WITHOUT a source. In a state of REAL capture (a Core in
// its own capture: the simulator created with `capture: 'external'`, the form the Core hosts) the
// slot's pre-check item is BLOCK "source not assigned" - all four slots, the STANDBY too (C25
// corrects C21 (8)). In Simulated mode the SAME selector is answered as before (C21 (6)).
// The doubles: the bed of WP-13a (seven selector categories of addendum 1.5) put into the state.
describe('D48: the tablet link at the pre-check of a Core in its own capture', () => {
  it('an OFFLINE link WARNS on a Core in its own capture (a console start needs no tablet); CONTROL: the simulated Core still BLOCKS, and a connected link passes on both', () => {
    const base = createSim({ clock: createManualClock(Date.UTC(2026, 9, 23, 9, 0, 0)), storage: null, authStorage: null }).store.getState();
    const offline: SimState = { ...base, tabletLink: { state: 'OFFLINE', changedAt: 0 } };
    const own: SimState = { ...offline, time: { ...offline.time, hostClock: true } };
    expect(isOwnCaptureCoreState(offline)).toBe(false);
    expect(isOwnCaptureCoreState(own)).toBe(true);
    // Audit fix row 83 (D29 Q2): status, value and code unchanged; the reason says it is the operator tablet.
    expect(evaluatePrecheck(own, 'CORE')).toEqual({ status: 'WARN', value: 'OFFLINE', reason: 'Operator tablet offline. This Core runs the session from its console.', reasonCode: 'CORE_OFFLINE', params: {} });
    expect(evaluatePrecheck(offline, 'CORE')).toEqual({ status: 'BLOCK', value: 'OFFLINE', reason: 'Core link offline', reasonCode: 'CORE_OFFLINE', params: {} });
    expect(evaluatePrecheck({ ...own, tabletLink: base.tabletLink }, 'CORE')).toMatchObject({ status: 'PASS', value: 'ONLINE' });
    expect(evaluatePrecheck(base, 'CORE')).toMatchObject({ status: 'PASS', value: 'ONLINE' });
  });
});

describe('a selector slot without a source: the pre-check item (task 4 row 163)', () => {
  const { CATEGORIES, SLOTS, SEEDED_CATEGORY, emptySlotsOf, selectorPatch, cam, mic } = selectorBed;
  // D61 (2026-11-04): the stored check IDs MIC_PRIMARY/MIC_STANDBY read channels 1 and 2.
  // Audit fix row 83 (DF-03; D15(c)): every one of the eight required slots now has a check item of its own.
  const CHECK_OF = {
    'VIDEO-01': 'LENS_1',
    'VIDEO-02': 'LENS_2',
    'VIDEO-03': 'LENS_3',
    'VIDEO-04': 'LENS_4',
    'MIC-01': 'MIC_PRIMARY',
    'MIC-02': 'MIC_STANDBY',
    'MIC-03': 'MIC_3',
    'MIC-04': 'MIC_4',
  } as const;
  type CheckedSlot = keyof typeof CHECK_OF;
  const CHECKED: readonly CheckedSlot[] = ['VIDEO-01', 'VIDEO-02', 'VIDEO-03', 'VIDEO-04', 'MIC-01', 'MIC-02', 'MIC-03', 'MIC-04'];
  /** A simulator in the capture given, holding the lines given (its registry and meters agree with them). */
  const bedOn = (capture: 'simulated' | 'external', lines: selectorBed.SelectorLines) => {
    const h = ownCaptureBed.bed({ capture });
    h.sim.store.setState(selectorPatch(h.state(), lines));
    return h;
  };
  const notAssigned = (slot: string) => ({ status: 'BLOCK' as const, value: 'NOT_ASSIGNED', reason: `${slot}: source not assigned`, reasonCode: null, params: { rule: 'sourceNotAssigned', slot } });

  it('the names of the register: the rule, the value, the reason, the four required slots, the two readers', () => {
    expect(Object.values(CaptureStartRule)).toEqual(['noCamera', 'oneCamera', 'noMicrophone', 'activeMicrophone', 'noStandby', 'sourceNotAssigned']);
    expect(CaptureStartRule.SOURCE_NOT_ASSIGNED).toBe('sourceNotAssigned');
    expect(SOURCE_NOT_ASSIGNED_PRECHECK_VALUE).toBe('NOT_ASSIGNED');
    expect(CAPTURE_SOURCE_NOT_ASSIGNED_REASON).toBe('CAPTURE_SOURCE_NOT_ASSIGNED');
    // C25 as widened by D61: ALL EIGHT slots are required - every channel too - in the order of
    // the contract's list. D60 (2026-11-04): four video tracks; D61: four microphone channels.
    expect(CAPTURE_START_REQUIRED_SLOTS).toEqual(['VIDEO-01', 'VIDEO-02', 'VIDEO-03', 'VIDEO-04', 'MIC-01', 'MIC-02', 'MIC-03', 'MIC-04']);
    expect(CAPTURE_START_REQUIRED_SLOTS).toEqual(CAPTURE_SELECTOR_SLOTS);
    // The sentence of the rule exists under its suffix (row 28 wrote the key).
    expect(en.common.captureNotice.start[CaptureStartRule.SOURCE_NOT_ASSIGNED]).toContain('{{slot}}');

    // `unassignedSlotsOf`: by track and by channel, in the contract's order, whatever the order of the lines.
    for (const [name, lines] of Object.entries(CATEGORIES)) expect(unassignedSlotsOf(lines), name).toEqual(emptySlotsOf(lines));
    expect(unassignedSlotsOf({ cameras: [], mics: [] })).toEqual(['VIDEO-01', 'VIDEO-02', 'VIDEO-03', 'VIDEO-04', 'MIC-01', 'MIC-02', 'MIC-03', 'MIC-04']); // D61: eight slots
    // A lone VIDEO-02 line is not "the first track", a lone channel-2 line not "the first channel".
    expect(unassignedSlotsOf({ cameras: [cam('VIDEO-02', 'CAM-02')], mics: [mic('MIC-02', 'MIC-02')] })).toEqual(['VIDEO-01', 'VIDEO-03', 'VIDEO-04', 'MIC-01', 'MIC-03', 'MIC-04']); // D61
    // D61 (2026-11-04): a complete selector names all FOUR tracks and all FOUR channels.
    expect(unassignedSlotsOf({ cameras: [cam('VIDEO-02', 'CAM-02'), cam('VIDEO-01', 'CAM-01'), cam('VIDEO-03', 'CAM-03'), cam('VIDEO-04', 'CAM-04')], mics: [mic('MIC-02', 'MIC-02'), mic('MIC-01', 'MIC-01'), mic('MIC-03', 'MIC-03'), mic('MIC-04', 'MIC-04')] })).toEqual([]);

    // `unassignedSlotOfPrecheckItem`: the one recogniser of the item.
    for (const slot of SLOTS) {
      expect(unassignedSlotOfPrecheckItem(notAssigned(slot)), slot).toBe(slot);
      expect(unassignedSlotOfPrecheckItem({ ...notAssigned(slot), status: 'WARN' }), slot).toBe(slot);
    }
    const item = notAssigned('VIDEO-01');
    expect(unassignedSlotOfPrecheckItem({ ...item, value: 'UNREACHABLE' })).toBeNull();
    expect(unassignedSlotOfPrecheckItem({ ...item, params: { rule: 'noCamera', slot: 'VIDEO-01' } })).toBeNull();
    expect(unassignedSlotOfPrecheckItem({ ...item, params: { rule: 'sourceNotAssigned', slot: 'MIC-PRIMARY' } })).toBeNull();
    expect(unassignedSlotOfPrecheckItem({ ...item, params: { rule: 'sourceNotAssigned' } })).toBeNull();
    expect(unassignedSlotOfPrecheckItem({ status: 'BLOCK', value: 'NOT_ASSIGNED' })).toBeNull();
    expect(unassignedSlotOfPrecheckItem({ ...item, status: 'PASS' })).toBeNull();
    // The unreachable item is not it.
    expect(unassignedSlotOfPrecheckItem({ status: 'BLOCK', value: 'UNREACHABLE', params: { deviceId: 'CAM-01', deviceKind: 'CAMERA', rule: 'noCamera' } })).toBeNull();
  });

  it.each(Object.entries(CATEGORIES))('REAL capture, category %s: one BLOCK item per unassigned slot and none for an assigned one; Simulated on the same selector answers as before', (name, lines) => {
    const empty = emptySlotsOf(lines);
    const real = bedOn('external', lines);
    expect(isOwnCaptureCoreState(real.state()), name).toBe(true);
    // Audit fix row 83 (DF-03): an unassigned VIDEO-03/VIDEO-04 or MIC-03/MIC-04 has its own BLOCK item too
    // (it also still blocks the start through the required-slot rule, `sim-capture-start`).
    expect([...CHECKED]).toEqual([...CAPTURE_START_REQUIRED_SLOTS]);
    for (const slot of CHECKED) {
      const item = evaluatePrecheck(real.state(), CHECK_OF[slot]);
      if (empty.includes(slot)) {
        // Exactly the item of the register: no device, no device kind, no reason code of the closed set.
        expect(item, `${name} / ${slot}`).toEqual(notAssigned(slot));
        expect(unassignedSlotOfPrecheckItem(item), `${name} / ${slot}`).toBe(slot);
      } else {
        expect(item.value, `${name} / ${slot}`).not.toBe('NOT_ASSIGNED');
        expect(unassignedSlotOfPrecheckItem(item), `${name} / ${slot}`).toBeNull();
      }
    }
    const blocked = CHECKED.filter((slot) => unassignedSlotOfPrecheckItem(evaluatePrecheck(real.state(), CHECK_OF[slot])) !== null);
    expect(blocked, name).toEqual(empty.filter((slot) => (CHECKED as readonly string[]).includes(slot)));

    // SIMULATED, the same selector (C21 (6)): no such item. An empty video slot passes, an empty role warns "no signal" - as before.
    const simulated = bedOn('simulated', lines);
    expect(isOwnCaptureCoreState(simulated.state()), name).toBe(false);
    for (const slot of CHECKED) {
      const item = evaluatePrecheck(simulated.state(), CHECK_OF[slot]);
      expect(unassignedSlotOfPrecheckItem(item), `${name} / ${slot}`).toBeNull();
      if (!empty.includes(slot)) continue;
      if (slot.startsWith('VIDEO-')) expect(item, `${name} / ${slot}`).toMatchObject({ status: 'PASS', value: 'READY' });
      else expect(item, `${name} / ${slot}`).toMatchObject({ status: 'WARN', value: 'NO_SIGNAL', reasonCode: 'MIC_NO_SIGNAL' });
    }
  });

  it('all eight slots unassigned: every check item of a checked slot BLOCKS - every channel too (C25, D61) - and 0 on the seeded selector', () => {
    const none = bedOn('external', CATEGORIES['1. all eight U']!); // D61: the eight-slot bed
    expect(CHECKED.map((slot) => evaluatePrecheck(none.state(), CHECK_OF[slot]).status)).toEqual(['BLOCK', 'BLOCK', 'BLOCK', 'BLOCK', 'BLOCK', 'BLOCK', 'BLOCK', 'BLOCK']); // row 83: eight items
    // Only channel 2 empty: it is a BLOCK item, not a warning an operator could acknowledge.
    const seededLines = CATEGORIES[SEEDED_CATEGORY]!;
    const noStandby = bedOn('external', { cameras: seededLines.cameras, mics: seededLines.mics.filter((line) => line.channel !== 'MIC-02') });
    expect(evaluatePrecheck(noStandby.state(), 'MIC_STANDBY')).toEqual(notAssigned('MIC-02'));
    expect(CHECKED.filter((slot) => unassignedSlotOfPrecheckItem(evaluatePrecheck(noStandby.state(), CHECK_OF[slot])) !== null)).toEqual(['MIC-02']);
    // The seeded selector, untouched by the bed: a Core in its own capture has no such item.
    const seeded = ownCaptureBed.bed({ capture: 'external' });
    expect(unassignedSlotsOf(seeded.state().captureConfig)).toEqual([]);
    expect(CHECKED.filter((slot) => unassignedSlotOfPrecheckItem(evaluatePrecheck(seeded.state(), CHECK_OF[slot])) !== null)).toEqual([]);
  });

  it('the item comes BEFORE every other rule of its check, and through a whole run it blocks the session', () => {
    // The lens of an unassigned track also reads faulty: the item says "not assigned", not "lens fault".
    const real = bedOn('external', CATEGORIES['1. all eight U']!); // D61 (2026-11-04): eight slots
    real.sim.store.setState({ cameras: real.state().cameras.map((camera) => ({ ...camera, online: false })) });
    expect(evaluatePrecheck(real.state(), 'LENS_1')).toEqual(notAssigned('VIDEO-01'));
    // CONTROL: in Simulated the same state is the lens fault it always was.
    const simulated = bedOn('simulated', CATEGORIES['1. all eight U']!); // D61 (2026-11-04): eight slots
    simulated.sim.store.setState({ cameras: simulated.state().cameras.map((camera) => ({ ...camera, online: false })) });
    expect(evaluatePrecheck(simulated.state(), 'LENS_1')).toMatchObject({ status: 'BLOCK', value: 'FAULT', reasonCode: 'LENS_FAULT' });

    // A whole pre-check run of a Core in its own capture on the empty selector: BLOCK, eight items (row 83), not ARMED.
    const h = bedOn('external', CATEGORIES['1. all eight U']!); // D61 (2026-11-04): eight slots
    h.armed();
    const session = h.state().session;
    expect(session?.state).toBe('PRECHECK');
    expect(session?.precheck.outcome).toBe('BLOCK');
    const items = (session?.precheck.items ?? []).filter((item) => unassignedSlotOfPrecheckItem(item) !== null);
    expect(items.map((item) => [item.id, item.status, item.params?.['slot']])).toEqual([
      ['LENS_1', 'BLOCK', 'VIDEO-01'],
      ['LENS_2', 'BLOCK', 'VIDEO-02'],
      ['LENS_3', 'BLOCK', 'VIDEO-03'], // audit fix row 83 (DF-03)
      ['LENS_4', 'BLOCK', 'VIDEO-04'],
      ['MIC_PRIMARY', 'BLOCK', 'MIC-01'], // D61 (2026-11-04): the stored check IDs read channels 1 and 2; the slot param is the channel
      ['MIC_STANDBY', 'BLOCK', 'MIC-02'], // D61: the role words PRIMARY/STANDBY are gone from the slot params
      ['MIC_3', 'BLOCK', 'MIC-03'], // audit fix row 83
      ['MIC_4', 'BLOCK', 'MIC-04'],
    ]);
    expect(h.state().audit.rows.filter((row) => row.type === 'PRECHECK_BLOCKED')).toHaveLength(1);
    expect(() => h.sim.actions.startRecording()).toThrow(SimTransitionError);
  });
});

// Task 4 row V7d (decisions C126 (b), C141): the answer of a pre-check or a re-scan is a read of the camera's CONTROL
// service (the Core's probe asks the adapter's `profiles`), not of its stream. A REGISTERED camera (an entry with an
// `adapter`) therefore never reads LIVE from it: NOT READ (null), unless the ingest said LIVE (kept) or a stream fault
// is active (LOST kept). No answer still says LOST. The built-in pair keeps the model's LIVE (the case of CAM-02 above,
// unedited). Mutations each seen RED: implementation/v7d_op44_not_read.md.
describe('row V7d: a camera that answered a check was not read - a registered camera is NOT READ after the clear, never LIVE', () => {
  const CAM = 'CAM-07';
  // The form of row V7c's stream fault (sim-capture-telemetry.test.ts): `reason` is read beside the input type (CaptureFaultFacts).
  const FAULT = { code: 'CAPTURE_FAULT', subject: CAM, reason: 'CAMERA_STREAM_ENDED' } as const;
  /** The idle harness with CAM-07 registered (its entry null, as a registration leaves it) and on VIDEO-02, its line null. */
  const seeded = () => {
    const h = harness();
    h.sim.actions.registerCaptureDevice({ id: CAM, model: null, host: '192.0.2.17', adapter: 'ONVIF_RTSP' });
    const state = h.state();
    h.sim.store.setState({ captureConfig: { ...state.captureConfig, cameras: state.captureConfig.cameras.map((line) => (line.trackId === 'VIDEO-02' ? { ...line, deviceId: CAM, online: true, streamState: null } : line)) } });
    return h;
  };
  const of = (h: ReturnType<typeof harness>, deviceId = CAM) => ({
    entry: h.state().captureDevices.devices.find((device) => device.id === deviceId)?.streamState,
    line: h.state().captureConfig.cameras.find((camera) => camera.deviceId === deviceId)?.streamState,
    online: h.state().captureDevices.devices.find((device) => device.id === deviceId)?.online,
  });

  it('no answer says LOST; the answer of a pre-check and of a re-scan (PRESENCE) says NOT READ, with `online` true again; CONTROL: the built-in CAM-01 reads LIVE after the same clear', () => {
    const h = seeded();
    expect(of(h)).toEqual({ entry: null, line: null, online: true });
    h.sim.actions.raiseCaptureWarning(UNREACHABLE(CAM));
    expect(of(h)).toEqual({ entry: 'LOST', line: 'LOST', online: false });
    h.sim.actions.clearCaptureWarning({ code: 'CAPTURE_DEVICE_UNREACHABLE', subject: CAM, phase: 'PRECHECK' });
    expect(of(h)).toEqual({ entry: null, line: null, online: true });

    h.sim.actions.raiseCaptureWarning(UNREACHABLE(CAM, { phase: 'PRESENCE' }));
    expect(of(h)).toEqual({ entry: 'LOST', line: 'LOST', online: false });
    h.sim.actions.clearCaptureWarning({ code: 'CAPTURE_DEVICE_UNREACHABLE', subject: CAM, phase: 'PRESENCE' });
    expect(of(h)).toEqual({ entry: null, line: null, online: true });

    // CONTROL: the built-in camera through the same raise and clear is the demonstration model's LIVE again.
    h.sim.actions.raiseCaptureWarning(UNREACHABLE('CAM-01'));
    h.sim.actions.clearCaptureWarning({ code: 'CAPTURE_DEVICE_UNREACHABLE', subject: 'CAM-01', phase: 'PRECHECK' });
    expect(of(h, 'CAM-01')).toEqual({ entry: 'LIVE', line: 'LIVE', online: true });
  });

  it('the answer keeps what a reading stated: a LIVE of the ingest stays LIVE; an active stream fault stays LOST until its own clear', () => {
    const live = seeded();
    live.sim.actions.raiseCaptureWarning(UNREACHABLE(CAM));
    // What a CONNECTED frame of the ingest writes (capture-telemetry `cameraOfIngest`), while the alert is still active.
    const state = live.state();
    live.sim.store.setState({
      captureDevices: { ...state.captureDevices, devices: state.captureDevices.devices.map((device) => (device.id === CAM ? { ...device, online: true, streamState: 'LIVE' } : device)) },
      captureConfig: { ...state.captureConfig, cameras: state.captureConfig.cameras.map((line) => (line.deviceId === CAM ? { ...line, online: true, streamState: 'LIVE' } : line)) },
    });
    live.sim.actions.clearCaptureWarning({ code: 'CAPTURE_DEVICE_UNREACHABLE', subject: CAM, phase: 'PRECHECK' });
    expect(of(live)).toEqual({ entry: 'LIVE', line: 'LIVE', online: true });

    const faulted = seeded();
    faulted.sim.actions.raiseCaptureWarning(FAULT);
    faulted.sim.actions.raiseCaptureWarning(UNREACHABLE(CAM));
    faulted.sim.actions.clearCaptureWarning({ code: 'CAPTURE_DEVICE_UNREACHABLE', subject: CAM, phase: 'PRECHECK' });
    expect(of(faulted)).toEqual({ entry: 'LOST', line: 'LOST', online: true });
    faulted.sim.actions.clearCaptureWarning(FAULT);
    expect(of(faulted)).toEqual({ entry: null, line: null, online: true });
  });
});

// Audit fix row 128 (C-DEV-A; DF-11, U-05, F-5-02b; D19, D24, D90): `slotSourceOf` is the one reader of "is the source of
// this slot there" - the assigned device plus its reach (row 125). It never touches the start rule (`online` stays the gate).
describe('row 128: slotSourceOf states the assigned device plus its reach', () => {
  const selector = {
    cameras: [{ trackId: 'VIDEO-01' as const, deviceId: 'CAM-05' }, { trackId: 'VIDEO-02' as const, deviceId: 'CAM-06' }],
    mics: [{ channel: 'MIC-01' as const, deviceId: 'MIC-05' }],
  };
  const devices = [
    { id: 'CAM-05', kind: 'CAMERA' as const, online: true, reach: 'NOT_REACHABLE' as const, checkedAt: START },
    { id: 'CAM-06', kind: 'CAMERA' as const, online: true },
    { id: 'MIC-05', kind: 'MIC' as const, online: false, reach: 'REACHABLE' as const, checkedAt: START },
  ];

  it('NOT_REACHABLE, NOT_CHECKED, OFFLINE (the registry flag wins over a stated reach), NOT_ASSIGNED; only REACHABLE / NOT_CHECKED are up', () => {
    expect(slotSourceOf(selector, devices, 'VIDEO-01')).toEqual({ slot: 'VIDEO-01', deviceId: 'CAM-05', state: SlotSourceState.NOT_REACHABLE, checkedAt: START });
    expect(slotSourceOf(selector, devices, 'VIDEO-02')).toEqual({ slot: 'VIDEO-02', deviceId: 'CAM-06', state: SlotSourceState.NOT_CHECKED, checkedAt: null });
    expect(slotSourceOf(selector, devices, 'MIC-01')).toMatchObject({ deviceId: 'MIC-05', state: SlotSourceState.OFFLINE });
    expect(slotSourceOf(selector, devices, 'VIDEO-03')).toEqual({ slot: 'VIDEO-03', deviceId: null, state: SlotSourceState.NOT_ASSIGNED, checkedAt: null });
    // A device of the other kind under the same id is not the source (CONTROL: kind is part of the match).
    expect(slotSourceOf(selector, [{ id: 'CAM-06', kind: 'MIC', online: true }], 'VIDEO-02').state).toBe(SlotSourceState.OFFLINE);
    expect(slotSourceOf(selector, [{ ...devices[0]!, reach: 'REACHABLE' }], 'VIDEO-01').state).toBe(SlotSourceState.REACHABLE);
    expect(Object.values(SlotSourceState).filter((state) => isSlotSourceUp({ state }))).toEqual(['NOT_CHECKED', 'REACHABLE']);
  });

  it('the start rule is untouched: a NOT_REACHABLE camera whose registry flag is online still passes `captureReachabilityOf` (online stays the engine gate)', () => {
    const h = harness();
    h.sim.store.setState({ captureDevices: { ...h.state().captureDevices, devices: h.state().captureDevices.devices.map((device) => (device.id === 'CAM-02' ? { ...device, reach: 'NOT_REACHABLE', checkedAt: START } : device)) } });
    expect(captureReachabilityOf(h.state()).find((row) => row.deviceId === 'CAM-02')).toMatchObject({ reachable: true, status: 'PASS' });
    expect(slotSourceOf(h.state().captureConfig, h.state().captureDevices.devices, 'VIDEO-02').state).toBe(SlotSourceState.NOT_REACHABLE);
  });
});

// Audit fix row 128b (C-DEV-A; F-5-02b; decision D100 (1), option (a)): the pre-check's live view reads the REACH of the
// assigned source through `slotSourceOf` (row 128). An assigned source the Core states NOT_REACHABLE reads WARN, never PASS
// and never BLOCK; the start rule (`captureReachabilityOf`, `online`) is unchanged, so a stale reach never blocks a start.
// The Core half (the run's probe re-states reach before the action) is `apps/core-server/src/capture-notices/__tests__/notices.test.ts`.
describe('row 128b: the pre-check live view reads reach (WARN on NOT_REACHABLE); the start rule does not', () => {
  const withReach = (state: SimState, deviceId: string, reach: 'REACHABLE' | 'NOT_REACHABLE' | null, online = true): Pick<SimState, 'captureDevices'> => ({
    captureDevices: { ...state.captureDevices, devices: state.captureDevices.devices.map((device) => (device.id === deviceId ? { ...device, online, reach, checkedAt: reach === null ? null : START } : device)) },
  });
  const sourceOf = (state: SimState, slot: 'VIDEO-02' | 'MIC-01' | 'MIC-02'): string => {
    const line = slot.startsWith('VIDEO-') ? state.captureConfig.cameras.find((camera) => camera.trackId === slot) : state.captureConfig.mics.find((mic) => mic.channel === slot);
    if (line === undefined) throw new Error(`the seeded selector holds no line for ${slot}`);
    return line.deviceId;
  };

  it('REAL capture: a camera stated NOT_REACHABLE reads WARN UNREACHABLE (oneCamera), a microphone channel WARN (noStandby, channel 1 too - never BLOCK); REACHABLE and no reading read PASS', () => {
    const h = ownCaptureBed.bed({ capture: 'external' });
    expect(isOwnCaptureCoreState(h.state())).toBe(true);
    const cam = sourceOf(h.state(), 'VIDEO-02');
    const primary = sourceOf(h.state(), 'MIC-01');
    const second = sourceOf(h.state(), 'MIC-02');
    // CONTROL: no reading states anything - the items are what they were.
    expect(evaluatePrecheck(h.state(), 'LENS_2')).toMatchObject({ status: 'PASS', value: 'READY' });
    expect(evaluatePrecheck(h.state(), 'MIC_PRIMARY').status).not.toBe('BLOCK');

    h.sim.store.setState(withReach(h.state(), cam, 'NOT_REACHABLE'));
    expect(evaluatePrecheck(h.state(), 'LENS_2')).toEqual({
      status: 'WARN',
      value: 'UNREACHABLE',
      reason: `${cam} was not reachable at the last check`,
      reasonCode: null,
      params: { deviceId: cam, deviceKind: 'CAMERA', rule: CaptureStartRule.ONE_CAMERA },
    });
    // The other tracks are not touched.
    expect(evaluatePrecheck(h.state(), 'LENS_1')).toMatchObject({ status: 'PASS' });
    // The clients' sentence exists under that rule.
    expect(en.common.captureNotice.start[CaptureStartRule.ONE_CAMERA]).toContain('{{device}}');

    // A later reading that reached it: PASS again (what the pre-check run's probe states, row 128b Core half).
    h.sim.store.setState(withReach(h.state(), cam, 'REACHABLE'));
    expect(evaluatePrecheck(h.state(), 'LENS_2')).toMatchObject({ status: 'PASS', value: 'READY' });

    h.sim.store.setState(withReach(h.state(), primary, 'NOT_REACHABLE'));
    expect(evaluatePrecheck(h.state(), 'MIC_PRIMARY')).toMatchObject({ status: 'WARN', value: 'UNREACHABLE', reasonCode: null, params: { deviceId: primary, deviceKind: 'MIC', rule: CaptureStartRule.NO_STANDBY } });
    if (second !== primary) {
      h.sim.store.setState(withReach(h.state(), second, 'NOT_REACHABLE'));
      expect(evaluatePrecheck(h.state(), 'MIC_STANDBY')).toMatchObject({ status: 'WARN', value: 'UNREACHABLE', params: { deviceId: second, deviceKind: 'MIC', rule: CaptureStartRule.NO_STANDBY } });
    }
  });

  it('the start rule is unchanged: a stale NOT_REACHABLE keeps every row of captureReachabilityOf reachable, and a pre-check run on it ends WARN, never BLOCK; an offline device keeps the start rule item (online stays the gate)', () => {
    const h = ownCaptureBed.bed({ capture: 'external' });
    const cam = sourceOf(h.state(), 'VIDEO-02');
    const primary = sourceOf(h.state(), 'MIC-01');
    h.sim.store.setState(withReach(h.state(), cam, 'NOT_REACHABLE'));
    h.sim.store.setState(withReach(h.state(), primary, 'NOT_REACHABLE'));
    expect(captureReachabilityOf(h.state()).every((row) => row.reachable && row.status === 'PASS')).toBe(true);
    h.armed();
    expect(h.state().session?.precheck.items.find((item) => item.id === 'LENS_2')).toMatchObject({ status: 'WARN', value: 'UNREACHABLE' });
    expect(h.state().session?.precheck.items.find((item) => item.id === 'MIC_PRIMARY')).toMatchObject({ status: 'WARN', value: 'UNREACHABLE' });
    expect(h.state().session?.precheck.outcome).toBe('WARN');

    // The registry flag says offline: the start rule's own item decides (BLOCK for channel 1), the reach rule adds nothing.
    const off = ownCaptureBed.bed({ capture: 'external' });
    off.sim.store.setState(withReach(off.state(), primary, 'NOT_REACHABLE', false));
    expect(evaluatePrecheck(off.state(), 'MIC_PRIMARY')).toMatchObject({ status: 'BLOCK', value: 'UNREACHABLE', params: { deviceId: primary, rule: captureReachabilityOf(off.state()).find((row) => row.slot === 'MIC-01')?.rule } });
  });

  it('CONTROL: the simulated lane on the same reach is unchanged (PASS) - the rule applies to a Core in its own capture only', () => {
    const h = ownCaptureBed.bed({ capture: 'simulated' });
    expect(isOwnCaptureCoreState(h.state())).toBe(false);
    const cam = sourceOf(h.state(), 'VIDEO-02');
    h.sim.store.setState(withReach(h.state(), cam, 'NOT_REACHABLE'));
    expect(evaluatePrecheck(h.state(), 'LENS_2')).toMatchObject({ status: 'PASS', value: 'READY' });
  });
});
