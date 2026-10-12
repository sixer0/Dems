// Task 3 row 138 — the pure rules of the no-device notifications, the pre-check sentences, the
// development-source badge and the microphone re-read (ux spec §8e, §8f, §8g; checks M4-DEVSRC-LOCAL,
// M4-UX-UNIT; the software half of M4-NODEV-B-T / -P, M4-MIC-ACTIVE-T / -P, M4-DEVSRC-LABEL-T / -P).
import { describe, expect, it } from '@jest/globals';
import { unassignedSlotOfPrecheckItem, type SimAlert } from '@dems/shared/sim';
import {
  START_RULES,
  candidateSourceOf,
  captureNoticeTitle,
  captureNoticesOf,
  classifyRescanAnswer,
  developmentSourceOf,
  deviceLabel,
  inputScanOf,
  isCaptureNoticeAlert,
  localDeviceSentenceKey,
  localDeviceStateOf,
  precheckUnreachableOf,
} from './capture-notices-model';
import { captureSelectorEn } from './i18n';
import { en } from '@dems/shared/i18n';

const alert = (over: Partial<SimAlert>): SimAlert => ({ id: 'ALR-000001', at: 1, severity: 'WARNING', kind: 'SYSTEM', message: 'x', active: true, acknowledged: false, resolvedAt: null, ...over });
/** A translate stand-in that shows the key and its values, so a test reads which key was asked for. */
const t = (key: string, options?: Record<string, unknown>): string => (options === undefined ? key : `${key}${JSON.stringify(options)}`);

describe('situations A and B are the active alerts of the slice, told apart by `params.reason` (§8e.1)', () => {
  it('A: one notice for the empty-search alert; B: one per device, with kind, phase, cause and count', () => {
    const notices = captureNoticesOf([
      alert({ id: 'ALR-000001', target: 'CAPTURE_DISCOVERY', params: { reason: 'CAPTURE_DISCOVERY_EMPTY', searchId: 'DSC-000004', trigger: 'MANUAL' } }),
      alert({ id: 'ALR-000002', target: 'CAM-02', params: { reason: 'CAPTURE_DEVICE_UNREACHABLE', deviceId: 'CAM-02', deviceKind: 'CAMERA', phase: 'PRECHECK', cause: 'UNREACHABLE', searchResponderCount: 1 } }),
      alert({ id: 'ALR-000003', target: 'MIC-01', params: { reason: 'CAPTURE_DEVICE_UNREACHABLE', deviceId: 'MIC-01', deviceKind: 'MIC', phase: 'PRECHECK', cause: 'PERMISSION_DENIED' } }),
    ]);
    expect(notices).toEqual([
      { kind: 'unreachable', alertId: 'ALR-000003', deviceId: 'MIC-01', deviceKind: 'MIC', phase: 'PRECHECK', cause: 'PERMISSION_DENIED', searchCount: null },
      { kind: 'unreachable', alertId: 'ALR-000002', deviceId: 'CAM-02', deviceKind: 'CAMERA', phase: 'PRECHECK', cause: 'UNREACHABLE', searchCount: 1 },
      { kind: 'discoveryEmpty', alertId: 'ALR-000001' },
    ]);
  });

  it('a resolved alert is no notice: nothing stale is left after the Core cleared it (R-10 AC-5)', () => {
    const empty = alert({ params: { reason: 'CAPTURE_DISCOVERY_EMPTY' } });
    expect(captureNoticesOf([empty])).toHaveLength(1);
    expect(captureNoticesOf([{ ...empty, active: false, resolvedAt: 9 }])).toEqual([]);
  });

  it('a fault alert, a SYSTEM alert with another reason and a notice with no device are not drawn as notices', () => {
    expect(captureNoticesOf([alert({ kind: 'CAMERA_LOSS', params: { reason: 'CAPTURE_DISCOVERY_EMPTY' } })])).toEqual([]);
    expect(captureNoticesOf([alert({ params: { reason: 'SOMETHING_ELSE' } })])).toEqual([]);
    expect(captureNoticesOf([alert({ params: { reason: 'CAPTURE_DEVICE_UNREACHABLE', deviceKind: 'CAMERA' } })])).toEqual([]);
    expect(isCaptureNoticeAlert(alert({ params: { reason: 'CAPTURE_DISCOVERY_EMPTY' } }))).toBe(true);
    expect(isCaptureNoticeAlert(alert({ kind: 'CAMERA_LOSS' }))).toBe(false);
  });

  it('an unknown cause reads as the plain one; a count that is no whole number is dropped', () => {
    const [notice] = captureNoticesOf([alert({ target: 'CAM-01', params: { reason: 'CAPTURE_DEVICE_UNREACHABLE', deviceId: 'CAM-01', deviceKind: 'CAMERA', cause: 'NEW_CODE', searchResponderCount: 1.5 } })]);
    expect(notice).toMatchObject({ cause: 'UNREACHABLE', searchCount: null, phase: 'PRECHECK' });
  });

  it('names, never values: the label is built from the id; the alert-centre title of a notice names the device', () => {
    expect(deviceLabel(t, 'CAM-02')).toBe('features.capture-selector.notice.device{"name":"common.devices.camera2","id":"CAM-02"}');
    expect(deviceLabel(t, 'CAM-07')).toBe('CAM-07');
    const unreachable = alert({ active: false, target: 'CAM-02', params: { reason: 'CAPTURE_DEVICE_UNREACHABLE', deviceId: 'CAM-02', deviceKind: 'CAMERA', phase: 'PRECHECK' } });
    expect(captureNoticeTitle(t, unreachable)).toContain('features.capture-selector.notice.unreachable.precheck.title');
    expect(captureNoticeTitle(t, alert({ params: { reason: 'CAPTURE_DISCOVERY_EMPTY' } }))).toBe('features.capture-selector.notice.discoveryEmpty.title');
    expect(captureNoticeTitle(t, alert({ kind: 'CAMERA_LOSS' }))).toBeNull();
  });
});

describe('an unreachable pre-check row is read from `params.rule` (D114)', () => {
  it('reads the rule, the device and, for the active microphone, the other one', () => {
    expect(precheckUnreachableOf({ value: 'UNREACHABLE', params: { deviceId: 'CAM-02', deviceKind: 'CAMERA', rule: 'oneCamera' } })).toEqual({ rule: 'oneCamera', deviceId: 'CAM-02', deviceKind: 'CAMERA', otherDeviceId: null });
    expect(precheckUnreachableOf({ value: 'UNREACHABLE', params: { deviceId: 'MIC-01', deviceKind: 'MIC', rule: 'activeMicrophone', other: 'MIC-02' } })).toMatchObject({ rule: 'activeMicrophone', otherDeviceId: 'MIC-02' });
  });

  it('is null for a lens fault, for "no signal" and for a rule this client does not know (nothing is guessed)', () => {
    expect(precheckUnreachableOf({ value: 'FAULT', params: { track: 'VIDEO-01' } })).toBeNull();
    expect(precheckUnreachableOf({ value: 'NO_SIGNAL', params: { track: 'AUDIO-01' } })).toBeNull();
    expect(precheckUnreachableOf({ value: 'UNREACHABLE', params: { deviceId: 'CAM-02', deviceKind: 'CAMERA', rule: 'somethingNew' } })).toBeNull();
    expect(precheckUnreachableOf(null)).toBeNull();
  });

  it('every rule has its sentence in the copy, and the active-microphone sentence tells the operator to cancel (no switch at pre-check, D83)', () => {
    for (const rule of START_RULES) expect(typeof captureSelectorEn.notice.start[rule]).toBe('string');
    expect(captureSelectorEn.notice.start.activeMicrophone).toMatch(/Cancel this session, make \{\{other\}\} the primary microphone on Devices, then start again\./);
  });
});

describe('task 4 row 169: the pre-check item of an UNASSIGNED selector slot (names register 5.2; decisions C18 (1), C25)', () => {
  // Integration pass I-6: the recogniser is the shared one of both clients (names register N12); this file holds
  // the mobile client to it. The item is the register's (5.2), status included: the shared recogniser reads it.
  const item = (slot: string) => ({ status: 'BLOCK' as const, value: 'NOT_ASSIGNED', params: { rule: 'sourceNotAssigned', slot } });

  it('the closed rule list holds the eighth rule, and its mobile sentence is the shared one, word for word (N15 = N13)', () => {
    expect(START_RULES).toHaveLength(8);
    expect(START_RULES).toContain('sourceNotAssigned');
    expect(captureSelectorEn.notice.start.sourceNotAssigned).toBe(en.common.captureNotice.start.sourceNotAssigned);
    expect(captureSelectorEn.notice.start.sourceNotAssigned).toBe('{{slot}} has no source assigned. Assign one on Devices.');
  });

  it('is recognised for each of the four slots - the standby microphone too - although it carries NO device id', () => {
    for (const slot of ['VIDEO-01', 'VIDEO-02', 'PRIMARY', 'STANDBY']) expect(unassignedSlotOfPrecheckItem(item(slot))).toBe(slot);
    // A blocking item or a warning one: the status is the Core's, the slot is read from value, rule and slot.
    expect(unassignedSlotOfPrecheckItem({ ...item('STANDBY'), status: 'WARN' })).toBe('STANDBY');
  });

  it('nothing is guessed: another value, another rule, an unknown or missing slot, no params', () => {
    expect(unassignedSlotOfPrecheckItem({ status: 'BLOCK', value: 'UNREACHABLE', params: { rule: 'sourceNotAssigned', slot: 'VIDEO-01' } })).toBeNull();
    expect(unassignedSlotOfPrecheckItem({ status: 'BLOCK', value: 'NOT_ASSIGNED', params: { rule: 'notRecordable', slot: 'VIDEO-01' } })).toBeNull();
    expect(unassignedSlotOfPrecheckItem(item('MIC-PRIMARY'))).toBeNull();
    expect(unassignedSlotOfPrecheckItem({ status: 'BLOCK', value: 'NOT_ASSIGNED', params: { rule: 'sourceNotAssigned' } })).toBeNull();
    expect(unassignedSlotOfPrecheckItem({ status: 'BLOCK', value: 'NOT_ASSIGNED' })).toBeNull();
    expect(unassignedSlotOfPrecheckItem({ status: 'PASS', value: 'READY', params: { track: 'VIDEO-01' } })).toBeNull();
    // "No item" is answered by the caller, `precheckSentence` of capture-notices.tsx (its guard; the shared recogniser takes an item).
  });

  it('it is not an unreachable DEVICE: `precheckUnreachableOf` answers null for it, and for an unreachable item that named this rule', () => {
    expect(precheckUnreachableOf(item('VIDEO-01'))).toBeNull();
    expect(precheckUnreachableOf({ value: 'UNREACHABLE', params: { deviceId: 'CAM-01', deviceKind: 'CAMERA', rule: 'sourceNotAssigned' } })).toBeNull();
  });
});

describe('the badge is decided by the Core`s `sourceClass` only (§8f.1; D83, D131)', () => {
  const real = { live: true };
  it('is drawn only for `sourceClass: DEVELOPMENT` sent by the Core; absent = no badge', () => {
    expect(developmentSourceOf({ sourceClass: 'DEVELOPMENT', adapter: 'FAKE', deviceKind: 'CAMERA', ...real })).toBe('test');
    expect(developmentSourceOf({ sourceClass: 'DEVELOPMENT', adapter: 'LOCAL_DEVICE', deviceKind: 'CAMERA', ...real })).toBe('localCamera');
    expect(developmentSourceOf({ sourceClass: 'DEVELOPMENT', adapter: 'LOCAL_DEVICE', deviceKind: 'MIC', ...real })).toBe('localMicrophone');
    expect(developmentSourceOf({ sourceClass: undefined, adapter: undefined, deviceKind: 'CAMERA', ...real })).toBeNull();
    expect(developmentSourceOf({ sourceClass: 'PRODUCTION', adapter: 'ONVIF_RTSP', deviceKind: 'CAMERA', ...real })).toBeNull();
    // No local rule: an adapter that reads like a development one without the Core's class draws nothing.
    expect(developmentSourceOf({ sourceClass: undefined, adapter: 'FAKE', deviceKind: 'CAMERA', ...real })).toBeNull();
  });

  it('never in Simulated client mode (no Core); the rule takes no demo flag at all (D131)', () => {
    const device = { sourceClass: 'DEVELOPMENT', adapter: 'FAKE', deviceKind: 'CAMERA' };
    expect(developmentSourceOf({ ...device, live: false })).toBeNull();
    expect(candidateSourceOf({ development: true, live: false })).toBeNull();
    // A caller that still hands a demo flag in changes nothing: the member is not part of the rule.
    for (const demoControls of [true, false]) {
      expect(developmentSourceOf({ ...device, live: true, demoControls } as Parameters<typeof developmentSourceOf>[0])).toBe('test');
      expect(developmentSourceOf({ sourceClass: undefined, adapter: 'FAKE', deviceKind: 'CAMERA', live: true, demoControls } as Parameters<typeof developmentSourceOf>[0])).toBeNull();
    }
    expect(candidateSourceOf({ development: true, ...real })).toBe('test');
    expect(candidateSourceOf({ development: false, ...real })).toBeNull();
  });

  it('the tablet and the phone say "Core Mac\'s …", one badge text, and "Test source" (never "Simulated")', () => {
    expect(captureSelectorEn.source.badge).toBe('Development source');
    expect(captureSelectorEn.source.kind).toEqual({ localCamera: "Core Mac's camera", localMicrophone: "Core Mac's microphone", test: 'Test source' });
  });
});

describe('local-device states (§8f.3; M4-DEVSRC-LOCAL)', () => {
  it('ready, permission needed, in use, not found, could not be opened', () => {
    expect(localDeviceStateOf(true, null)).toBe('READY');
    expect(localDeviceStateOf(false, 'PERMISSION_DENIED')).toBe('PERMISSION_DENIED');
    expect(localDeviceStateOf(false, 'DEVICE_BUSY')).toBe('DEVICE_BUSY');
    expect(localDeviceStateOf(false, 'DEVICE_NOT_FOUND')).toBe('DEVICE_NOT_FOUND');
    expect(localDeviceStateOf(false, 'OPEN_FAILED')).toBe('OPEN_FAILED');
    expect(localDeviceStateOf(false, 'HELPER_EXITED')).toBe('HELPER_EXITED');
    expect(localDeviceStateOf(false, null)).toBe('ABSENT');
  });

  it('each state but Ready has a sentence for a camera and for a microphone, and each sentence exists in the copy', () => {
    const copy = captureSelectorEn.localDevice as Record<string, unknown>;
    expect(localDeviceSentenceKey('READY', 'MIC')).toBeNull();
    for (const state of ['PERMISSION_DENIED', 'DEVICE_BUSY', 'DEVICE_NOT_FOUND', 'OPEN_FAILED', 'HELPER_EXITED', 'ABSENT'] as const) {
      for (const kind of ['CAMERA', 'MIC'] as const) expect(typeof copy[localDeviceSentenceKey(state, kind)!]).toBe('string');
    }
    // R-11 AC-9: the permission sentence tells the user what to do on the Mac; it names no control of this app.
    expect(captureSelectorEn.localDevice.permissionMicrophone).toMatch(/On the Mac that runs the Core, open System Settings > Privacy & Security > Microphone/);
  });
});

describe('operation 97 (§8g.1)', () => {
  it('classifies the answers and accepts the body only as the contract shapes it', () => {
    expect(classifyRescanAnswer(200)).toBe('ok');
    expect(classifyRescanAnswer(429)).toBe('limited');
    expect(classifyRescanAnswer(503)).toBe('notReady');
    expect(classifyRescanAnswer(403)).toBe('denied');
    expect(classifyRescanAnswer(null)).toBe('offline');
    expect(classifyRescanAnswer(500)).toBe('failed');
    const entry = { deviceId: 'MIC-01', inputId: 'MIC-01', present: true, adapter: 'FAKE', sourceClass: 'DEVELOPMENT', errorCode: null };
    expect(inputScanOf({ scannedAt: 5, inputs: [entry], unregisteredCount: 0 })).not.toBeNull();
    expect(inputScanOf({ scannedAt: 5, inputs: [{ ...entry, errorCode: 'SOMETHING' }], unregisteredCount: 0 })).toBeNull();
    expect(inputScanOf({ inputs: [] })).toBeNull();
  });
});
