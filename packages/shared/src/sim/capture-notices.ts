/**
 * The no-device notices of the capture layer and the reachability rule of the pre-check (task 3
 * blueprint row 133; specs R-10 AC-1, AC-2, AC-5, AC-6; contract C3 §3.1, §5.2
 * `CAPTURE_DEVICE_UNREACHABLE`, §5.4; decisions D72(h), D80(6), D80(8), D83).
 *
 * TWO THINGS LIVE HERE.
 *
 * 1. THE NOTICES. C3 §5.4 puts the three WARNING cases on the alert kind `SYSTEM`, told apart by
 *    `params.reason`, with NO new fault kind. They have no fault life cycle: nothing is added to
 *    `faults.active`, so the demo fault operations (73 / 74) can neither inject nor clear them
 *    (D72(h)). They travel through the INTERNAL pair `raiseCaptureWarning` / `clearCaptureWarning`
 *    as further members of `CaptureWarningInput` (no new member of `SimActions`):
 *
 *    | `code` | Raise | Clear | Audit row |
 *    |--------|-------|-------|-----------|
 *    | `CAPTURE_DISCOVERY_EMPTY` | one `SYSTEM` WARNING alert, target `CAPTURE_DISCOVERY` | resolves it | none: the search's own `CAPTURE_DISCOVERY_SEARCHED` row is the one row (D80(8)) |
 *    | `CAPTURE_DEVICE_UNREACHABLE`, phase `PRECHECK` or `SESSION_START` | the device reads not online; one `SYSTEM` WARNING alert, target the device ID | the device reads online; resolves it | one `CAPTURE_DEVICE_UNREACHABLE` at the raise, none at the clear |
 *    | `CAPTURE_DEVICE_UNREACHABLE`, phase `PRESENCE` | the device reads not online, nothing else | the device reads online, nothing else | none (operation 97 writes its own search row) |
 *
 *    At most ONE active alert per (`reason`, `target`): a raise while it is active writes nothing.
 *    A raise after a clear is a NEW alert with its own ID and, for a device, its own audit row.
 *    Alert text, `params` and audit details carry device IDs, counts and codes only: no label, no
 *    address, no user name (R-10 AC-6; E-30 / E-31).
 *
 * 2. THE START RULE (`captureReachabilityOf`), read by `evaluatePrecheck`:
 *
 *    | Reachability | Check rows | Start |
 *    |--------------|-----------|-------|
 *    | every configured camera unreachable | BLOCK (`noCamera`) | blocked |
 *    | one camera of two unreachable | WARN (`oneCamera`) | degraded, after the acknowledgement |
 *    | both microphones unreachable | BLOCK (`noMicrophone`) | blocked |
 *    | the PRIMARY (active) microphone unreachable | BLOCK (`activeMicrophone`) | blocked: no switch at pre-check (D83) |
 *    | the STANDBY microphone unreachable | WARN (`noStandby`) | degraded, after the acknowledgement |
 *
 *    "Reachable" is `online` of the device in `captureDevices`: the Core server writes it from its
 *    adapters before each pre-check run; the in-app simulator never changes it, so its checks pass.
 */
import type { MicRole } from '../domain';
import { SimNotFoundError } from './errors';
import { nextItemId, pushRing, recordActivity } from './events';
import { ALERT_RING_SIZE } from './constants';
import { cameraClockOffsetSentence, captureFaultSentence } from './capture-fault-wording';
import type { CaptureConfigCamera, CaptureConfigMic, CaptureDeviceStatus, EpochMs, SimAlert, SimState } from './types';
import { AuditType, CaptureStreamState } from './vocabulary';

/** `params.reason` of the two notices (C3 §5.4). */
export const CaptureNoticeReason = {
  CAPTURE_DISCOVERY_EMPTY: 'CAPTURE_DISCOVERY_EMPTY',
  CAPTURE_DEVICE_UNREACHABLE: 'CAPTURE_DEVICE_UNREACHABLE',
  /**
   * The evidence volume did not take the full sync for a camera file of the session (decision D189;
   * the worker's `FIRST_DURABLE_FRAGMENT.syncLevel`). ONE `SYSTEM` alert per session, target
   * `EVIDENCE_VOLUME`: CRITICAL when `critical` (production sources), INFO otherwise. No fault, no
   * audit row, no device state: the session keeps recording. Resolved by its clear.
   */
  EVIDENCE_VOLUME_SYNC_NOT_FULL: 'EVIDENCE_VOLUME_SYNC_NOT_FULL',
} as const;
export type CaptureNoticeReason = (typeof CaptureNoticeReason)[keyof typeof CaptureNoticeReason];

/**
 * THE ADVISORY NOTICES (ruling D144; integration pass D1b). Three conditions of a running capture
 * that are no fault and stop nothing, and that the capture side used to write to the error log
 * only. Each is one more value of `params.reason` of the same alert kind `SYSTEM`, with severity
 * INFO (advisory) and the device as its target:
 *
 * | `code` | Device | Meaning |
 * |--------|--------|---------|
 * | `KEYFRAME_INTERVAL_ABOVE_BOUND` | a camera | the camera's keyframe interval is above the bound the capture plans its fragments with |
 * | `AV_OFFSET_NEAR_BOUND` | a camera | the camera's clock is near the bound of the audio/video offset (`nearBound`) |
 * | `MIC_RATE_AT_LIMIT` | a microphone | the microphone's rate correction is held at its limit (±5,000 ppm) |
 * | `FRAGMENT_SIZE_BOUND_REACHED` | a camera | a fragment of the camera's file reached the size bound and was closed there, not at a keyframe; nothing is lost (ruling D179; closing pass F-X) |
 * | `CAMERA_CLOCK_OFFSET` | a camera | the offset the capture worker measured between the camera's clock and the Core's is above the advisory threshold and inside the bound: the recording keeps the camera's own timeline and the offset is recorded (manifest field 40), not corrected (ruling D179; tidy pass F-Y). The ONE advisory notice that carries a number: `offsetMs` (camera minus Core, whole ms) in the alert's text and `params` |
 *
 * Like the other notices they have NO fault life cycle (nothing in `faults.active`, no demo
 * control injects or clears them), at most one is active per (`reason`, device), a raise while it
 * is active writes nothing, and a clear resolves it. They write NO audit row and move no device
 * state: they are advice. `MIC_RATE_AT_LIMIT` is therefore an alert of its own beside a
 * `MIC_SILENT` fault and a `CAPTURE_FAULT` of the same microphone.
 */
export const CaptureAdvisoryReason = {
  KEYFRAME_INTERVAL_ABOVE_BOUND: 'KEYFRAME_INTERVAL_ABOVE_BOUND',
  AV_OFFSET_NEAR_BOUND: 'AV_OFFSET_NEAR_BOUND',
  MIC_RATE_AT_LIMIT: 'MIC_RATE_AT_LIMIT',
  FRAGMENT_SIZE_BOUND_REACHED: 'FRAGMENT_SIZE_BOUND_REACHED',
  CAMERA_CLOCK_OFFSET: 'CAMERA_CLOCK_OFFSET',
} as const;
export type CaptureAdvisoryReason = (typeof CaptureAdvisoryReason)[keyof typeof CaptureAdvisoryReason];

/** The class of device each advisory notice is about: a notice for a device of another class is refused. */
export const CAPTURE_ADVISORY_DEVICE_KIND = {
  KEYFRAME_INTERVAL_ABOVE_BOUND: 'CAMERA',
  AV_OFFSET_NEAR_BOUND: 'CAMERA',
  MIC_RATE_AT_LIMIT: 'MIC',
  FRAGMENT_SIZE_BOUND_REACHED: 'CAMERA',
  CAMERA_CLOCK_OFFSET: 'CAMERA',
} as const satisfies Record<CaptureAdvisoryReason, 'CAMERA' | 'MIC'>;

const ADVISORY_TEXT = {
  KEYFRAME_INTERVAL_ABOVE_BOUND: 'keyframe interval is above the bound',
  AV_OFFSET_NEAR_BOUND: 'clock is near the bound of the audio/video offset',
  MIC_RATE_AT_LIMIT: 'rate correction is at its limit',
  FRAGMENT_SIZE_BOUND_REACHED: 'a fragment reached the size bound and was closed early',
  // Not shown as it stands: this notice has its own sentence with the measured number (`cameraClockOffsetSentence`).
  CAMERA_CLOCK_OFFSET: 'clock differs from the Core',
} as const satisfies Record<CaptureAdvisoryReason, string>;

/** The alert target of the volume-durability notice: the evidence volume, not a device. */
export const CAPTURE_NOTICE_VOLUME_TARGET = 'EVIDENCE_VOLUME';

/** The alert target of situation A (C3 §5.4). */
export const CAPTURE_NOTICE_DISCOVERY_TARGET = 'CAPTURE_DISCOVERY';

/**
 * When a device was found unreachable. `PRECHECK` and `SESSION_START` are the two phases of the
 * alert and of the audit row (C3 §5.2); `PRESENCE` records whether the device answers and nothing
 * else (operation 97; a pre-check before its one search closed).
 */
export const CaptureUnreachablePhase = { PRECHECK: 'PRECHECK', SESSION_START: 'SESSION_START', PRESENCE: 'PRESENCE' } as const;
export type CaptureUnreachablePhase = (typeof CaptureUnreachablePhase)[keyof typeof CaptureUnreachablePhase];

/** The audit `reason` and the alert `cause` (C3 §5.2, erratum PE-128-35: one value set for both). */
export const CaptureUnreachableCause = {
  UNREACHABLE: 'UNREACHABLE',
  AUTHENTICATION_FAILED: 'AUTHENTICATION_FAILED',
  NOT_CONNECTED: 'NOT_CONNECTED',
  PERMISSION_DENIED: 'PERMISSION_DENIED',
  DEVICE_BUSY: 'DEVICE_BUSY',
  DEVICE_NOT_FOUND: 'DEVICE_NOT_FOUND',
  OPEN_FAILED: 'OPEN_FAILED',
  HELPER_EXITED: 'HELPER_EXITED',
} as const;
export type CaptureUnreachableCause = (typeof CaptureUnreachableCause)[keyof typeof CaptureUnreachableCause];

/** Situation A: a search closed with no responder. */
export interface CaptureDiscoveryEmptyNotice {
  code: typeof CaptureNoticeReason.CAPTURE_DISCOVERY_EMPTY;
  subject: null;
  /** `DSC-…` of the search (C3 §2.6). Read at a raise only. */
  searchId?: string;
  /** `MANUAL` or `PRECHECK`. Read at a raise only. */
  trigger?: 'MANUAL' | 'PRECHECK';
}

/** Situation B, the degraded warning of situation C, and the presence a re-read of the inputs found. */
export interface CaptureDeviceUnreachableNotice {
  code: typeof CaptureNoticeReason.CAPTURE_DEVICE_UNREACHABLE;
  /** The capture-device ID (`CAM-02`, `MIC-01`): the alert target. */
  subject: string;
  phase: CaptureUnreachablePhase;
  /** Why (a code). Read at a raise only; `UNREACHABLE` when absent. */
  cause?: CaptureUnreachableCause;
  /** True when the session may start, or started, without this device. Read at a raise only. */
  degraded?: boolean;
  /** The open session. Read at a raise only; the open session of the state when absent. */
  sessionId?: string | null;
  /** How many devices the one search of the pre-check found. A count; absent when no search ran. */
  searchResponderCount?: number;
}

/** An advisory notice of a running capture (ruling D144): a code and the capture device it is about. */
export interface CaptureAdvisoryNotice {
  code: CaptureAdvisoryReason;
  /** The capture-device ID (`CAM-02`, `MIC-03`): the alert target. */
  subject: string;
  /** The open session. Read at a raise only; the open session of the state when absent. */
  sessionId?: string | null;
  /**
   * `CAMERA_CLOCK_OFFSET` only, read at a raise only: the measured offset, camera clock minus Core
   * clock, in whole ms. A number, never device text. Ignored for every other notice.
   */
  offsetMs?: number;
}

/** The evidence volume did not confirm the full sync for the session's recording (decision D189). */
export interface CaptureVolumeSyncNotice {
  code: typeof CaptureNoticeReason.EVIDENCE_VOLUME_SYNC_NOT_FULL;
  subject: null;
  /** True: CRITICAL (production sources). False / absent: advice (INFO). Read at a raise only. */
  critical?: boolean;
  /** The level the worker stated (a code of the capture protocol). Read at a raise only. */
  syncLevel?: string;
  /** The open session. Read at a raise only; the open session of the state when absent. */
  sessionId?: string | null;
}

export type CaptureNoticeInput = CaptureDiscoveryEmptyNotice | CaptureDeviceUnreachableNotice | CaptureAdvisoryNotice | CaptureVolumeSyncNotice;

/** True for a notice that is advice (ruling D144), not a no-device notice. */
export function isCaptureAdvisoryNotice(input: { readonly code: string }): input is CaptureAdvisoryNotice {
  return Object.hasOwn(CaptureAdvisoryReason, input.code);
}

/** True for an input of `raiseCaptureWarning` / `clearCaptureWarning` that is a notice, not a fault. */
export function isCaptureNotice(input: { readonly code: string }): input is CaptureNoticeInput {
  return input.code === CaptureNoticeReason.CAPTURE_DISCOVERY_EMPTY || input.code === CaptureNoticeReason.CAPTURE_DEVICE_UNREACHABLE || input.code === CaptureNoticeReason.EVIDENCE_VOLUME_SYNC_NOT_FULL || isCaptureAdvisoryNotice(input);
}

/** The active notice alert of (`reason`, `target`), or undefined. */
export function activeCaptureNotice(state: Pick<SimState, 'alerts'>, reason: CaptureNoticeReason | CaptureAdvisoryReason, target: string): SimAlert | undefined {
  return state.alerts.find((alert) => alert.active && alert.kind === 'SYSTEM' && alert.params?.['reason'] === reason && (alert.target ?? null) === target);
}

function raiseNoticeAlert(state: SimState, at: EpochMs, message: string, target: string, params: NonNullable<SimAlert['params']>, severity: SimAlert['severity'] = 'WARNING'): SimState {
  const { id, meta } = nextItemId(state.meta, 'ALR');
  const alert: SimAlert = { id, at, severity, kind: 'SYSTEM', message, active: true, acknowledged: false, resolvedAt: null, target, params };
  return { ...state, meta, alerts: pushRing(state.alerts, [alert], ALERT_RING_SIZE) };
}

function resolveNoticeAlert(state: SimState, at: EpochMs, reason: CaptureNoticeReason | CaptureAdvisoryReason, target: string): SimState {
  const active = activeCaptureNotice(state, reason, target);
  if (active === undefined) return state;
  return { ...state, alerts: state.alerts.map((alert) => (alert === active ? { ...alert, active: false, resolvedAt: at } : alert)) };
}

/** The camera or microphone of the registry a notice names. Throws for anything else: a notice is never moved to another device. */
function sourceDeviceOf(state: SimState, deviceId: string): CaptureDeviceStatus {
  const device = state.captureDevices.devices.find((candidate) => candidate.id === deviceId && (candidate.kind === 'CAMERA' || candidate.kind === 'MIC'));
  if (device === undefined) throw new SimNotFoundError('captureDevice', deviceId);
  return device;
}

/** The device of an advisory notice: a registered device of the class the notice is about. Throws for anything else. */
function advisoryDeviceOf(state: SimState, notice: CaptureAdvisoryNotice): CaptureDeviceStatus {
  const device = sourceDeviceOf(state, notice.subject);
  if (device.kind !== CAPTURE_ADVISORY_DEVICE_KIND[notice.code]) throw new SimNotFoundError('captureDevice', notice.subject);
  return device;
}

/**
 * `online` of one device in the registry slice and in the selector rows that name it. A camera's
 * `streamState` follows (`LIVE` when it answers, `LOST` when it does not), as telemetry writes it.
 * Returns THE SAME state when nothing changes; `captureConfig.updatedAt` is left alone (it is the
 * stamp of an edit of the selector).
 */
function withDeviceOnline(state: SimState, device: CaptureDeviceStatus, online: boolean): SimState {
  const stream = device.kind === 'CAMERA' ? { streamState: online ? CaptureStreamState.LIVE : CaptureStreamState.LOST } : {};
  const sameDevice = device.online === online && (device.kind !== 'CAMERA' || device.streamState === stream.streamState);
  const devices = sameDevice ? state.captureDevices.devices : state.captureDevices.devices.map((candidate) => (candidate === device ? { ...candidate, online, ...stream } : candidate));
  const staleCamera = (camera: CaptureConfigCamera): boolean => camera.deviceId === device.id && (camera.online !== online || camera.streamState !== stream.streamState);
  const cameras = device.kind === 'CAMERA' && state.captureConfig.cameras.some(staleCamera) ? state.captureConfig.cameras.map((camera) => (camera.deviceId === device.id ? { ...camera, online, ...stream } : camera)) : state.captureConfig.cameras;
  const staleMic = (mic: CaptureConfigMic): boolean => mic.deviceId === device.id && mic.online !== online;
  const mics = device.kind === 'MIC' && state.captureConfig.mics.some(staleMic) ? state.captureConfig.mics.map((mic) => (mic.deviceId === device.id ? { ...mic, online } : mic)) : state.captureConfig.mics;
  if (devices === state.captureDevices.devices && cameras === state.captureConfig.cameras && mics === state.captureConfig.mics) return state;
  return {
    ...state,
    ...(devices !== state.captureDevices.devices ? { captureDevices: { ...state.captureDevices, devices } } : {}),
    ...(cameras !== state.captureConfig.cameras || mics !== state.captureConfig.mics ? { captureConfig: { ...state.captureConfig, cameras, mics } } : {}),
  };
}

/** The raise of a notice (`raiseCaptureWarning`). Returns the same state when nothing is to be written. */
export function raiseCaptureNoticeTransition(state: SimState, now: EpochMs, notice: CaptureNoticeInput): SimState {
  if (notice.code === CaptureNoticeReason.CAPTURE_DISCOVERY_EMPTY) {
    if (activeCaptureNotice(state, notice.code, CAPTURE_NOTICE_DISCOVERY_TARGET) !== undefined) return state;
    return raiseNoticeAlert(state, now, 'The last camera search found no camera', CAPTURE_NOTICE_DISCOVERY_TARGET, {
      reason: notice.code,
      ...(notice.searchId === undefined ? {} : { searchId: notice.searchId }),
      trigger: notice.trigger ?? 'MANUAL',
    });
  }

  if (notice.code === CaptureNoticeReason.EVIDENCE_VOLUME_SYNC_NOT_FULL) {
    if (activeCaptureNotice(state, notice.code, CAPTURE_NOTICE_VOLUME_TARGET) !== undefined) return state;
    const session = notice.sessionId ?? state.session?.id ?? null;
    const level = typeof notice.syncLevel === 'string' && /^[A-Z][A-Z0-9_]{1,31}$/.test(notice.syncLevel) ? notice.syncLevel : null;
    return raiseNoticeAlert(
      state,
      now,
      captureFaultSentence(notice.code, null),
      CAPTURE_NOTICE_VOLUME_TARGET,
      { reason: notice.code, ...(session === null ? {} : { sessionId: session }), ...(level === null ? {} : { syncLevel: level }) },
      notice.critical === true ? 'CRITICAL' : 'INFO',
    );
  }

  if (isCaptureAdvisoryNotice(notice)) {
    const about = advisoryDeviceOf(state, notice);
    if (activeCaptureNotice(state, notice.code, about.id) !== undefined) return state;
    const session = notice.sessionId ?? state.session?.id ?? null;
    // The clock-offset notice says its number (tidy pass F-Y): a whole number of ms, the alert's target names the camera.
    if (notice.code === CaptureAdvisoryReason.CAMERA_CLOCK_OFFSET) {
      const offsetMs = typeof notice.offsetMs === 'number' && Number.isSafeInteger(notice.offsetMs) ? notice.offsetMs : null;
      return raiseNoticeAlert(
        state,
        now,
        cameraClockOffsetSentence(offsetMs),
        about.id,
        { reason: notice.code, deviceId: about.id, deviceKind: about.kind, ...(session === null ? {} : { sessionId: session }), ...(offsetMs === null ? {} : { offsetMs }) },
        'INFO',
      );
    }
    // The device ID and codes only (R-10 AC-6): no label, no address, no measured value.
    return raiseNoticeAlert(
      state,
      now,
      `${about.id}: ${ADVISORY_TEXT[notice.code]}`,
      about.id,
      { reason: notice.code, deviceId: about.id, deviceKind: about.kind, ...(session === null ? {} : { sessionId: session }) },
      'INFO',
    );
  }

  const device = sourceDeviceOf(state, notice.subject);
  let next = withDeviceOnline(state, device, false);
  if (notice.phase === CaptureUnreachablePhase.PRESENCE) return next;
  if (activeCaptureNotice(next, notice.code, device.id) !== undefined) return next;

  const deviceKind = device.kind;
  const cause = notice.cause ?? CaptureUnreachableCause.UNREACHABLE;
  const sessionId = notice.sessionId ?? next.session?.id ?? null;
  // The audit row names its session (C3 §5.2: six keys, `sessionId` a string): a pre-check and a session start always have one.
  if (sessionId === null) throw new SimNotFoundError('session', 'none');
  const degraded = notice.degraded === true;
  // The device ID only: a label is device text and stays out of every alert and audit text (R-10 AC-6).
  const message = notice.phase === CaptureUnreachablePhase.PRECHECK ? `${device.id} is not reachable` : `${device.id} is not connected`;
  next = raiseNoticeAlert(next, now, message, device.id, {
    reason: notice.code,
    deviceId: device.id,
    deviceKind,
    phase: notice.phase,
    cause,
    ...(notice.searchResponderCount === undefined ? {} : { searchResponderCount: notice.searchResponderCount }),
  });
  return {
    ...next,
    ...recordActivity(next, now, {
      audit: {
        type: AuditType.CAPTURE_DEVICE_UNREACHABLE,
        message,
        severity: 'WARNING',
        sessionId,
        deviceId: device.id,
        // Exactly the six keys of C3 §5.2. `reason` is the cause code.
        details: { deviceId: device.id, deviceKind, phase: notice.phase, reason: cause, degraded, sessionId },
      },
    }),
  };
}

/** The clear of a notice (`clearCaptureWarning`): no audit row (C3 §5.4). Returns the same state when nothing changes. */
export function clearCaptureNoticeTransition(state: SimState, now: EpochMs, notice: CaptureNoticeInput): SimState {
  if (notice.code === CaptureNoticeReason.CAPTURE_DISCOVERY_EMPTY) return resolveNoticeAlert(state, now, notice.code, CAPTURE_NOTICE_DISCOVERY_TARGET);
  if (notice.code === CaptureNoticeReason.EVIDENCE_VOLUME_SYNC_NOT_FULL) return resolveNoticeAlert(state, now, notice.code, CAPTURE_NOTICE_VOLUME_TARGET);
  // Advice ends: the alert is resolved, nothing else moves.
  if (isCaptureAdvisoryNotice(notice)) return resolveNoticeAlert(state, now, notice.code, advisoryDeviceOf(state, notice).id);
  const device = sourceDeviceOf(state, notice.subject);
  const next = withDeviceOnline(state, device, true);
  // A re-read of the inputs says what is plugged in; only a later pre-check (or the capture side) resolves the alert.
  if (notice.phase === CaptureUnreachablePhase.PRESENCE) return next;
  return resolveNoticeAlert(next, now, notice.code, device.id);
}

// ── The start rule of the pre-check (D80(6), D83; C3 §3.1) ─────────────────────────────────────

/** Which sentence of the start rule a row stands for: the suffix of the text key `captureNotice.start.*` (UX spec §14.2). */
export const CaptureStartRule = {
  NO_CAMERA: 'noCamera',
  ONE_CAMERA: 'oneCamera',
  NO_MICROPHONE: 'noMicrophone',
  ACTIVE_MICROPHONE: 'activeMicrophone',
  NO_STANDBY: 'noStandby',
} as const;
export type CaptureStartRule = (typeof CaptureStartRule)[keyof typeof CaptureStartRule];

/** One configured source of the selector, as the start rule sees it. */
export interface CaptureSourceReachability {
  /** The video track (`VIDEO-01`) or the microphone role (`PRIMARY`). */
  slot: string;
  deviceId: string;
  deviceKind: 'CAMERA' | 'MIC';
  reachable: boolean;
  /** `PASS` when reachable; else what the rule makes of it. */
  status: 'PASS' | 'WARN' | 'BLOCK';
  /** The sentence of the rule, or null when reachable. */
  rule: CaptureStartRule | null;
  /** True when the session may start without this device (the audit row's `degraded`). */
  degraded: boolean;
  /** The other microphone, for the sentence that names it; null otherwise. */
  otherDeviceId: string | null;
}

/** The selector the open session was created under, else the stored one (the two are equal while a session is open, OD-10). */
function selectorOf(state: SimState): { cameras: readonly Pick<CaptureConfigCamera, 'trackId' | 'deviceId'>[]; mics: readonly Pick<CaptureConfigMic, 'deviceId' | 'role' | 'inputId'>[] } {
  return { cameras: state.session?.captureConfig?.cameras ?? state.captureConfig.cameras, mics: state.session?.captureConfig?.mics ?? state.captureConfig.mics };
}

/**
 * The start rule over the configured cameras and microphones. A device the registry does not hold
 * is unreachable. Pure: it reads `captureDevices.devices[].online` and the selector, nothing else.
 */
export function captureReachabilityOf(state: SimState): CaptureSourceReachability[] {
  const { cameras, mics } = selectorOf(state);
  const online = (deviceId: string, kind: 'CAMERA' | 'MIC'): boolean => state.captureDevices.devices.find((device) => device.id === deviceId && device.kind === kind)?.online === true;
  const rows: CaptureSourceReachability[] = [];

  const cameraUp = cameras.map((camera) => online(camera.deviceId, 'CAMERA'));
  const noCamera = cameraUp.every((up) => !up);
  cameras.forEach((camera, index) => {
    const reachable = cameraUp[index] === true;
    rows.push({
      slot: camera.trackId,
      deviceId: camera.deviceId,
      deviceKind: 'CAMERA',
      reachable,
      status: reachable ? 'PASS' : noCamera ? 'BLOCK' : 'WARN',
      rule: reachable ? null : noCamera ? CaptureStartRule.NO_CAMERA : CaptureStartRule.ONE_CAMERA,
      degraded: !reachable && !noCamera,
      otherDeviceId: null,
    });
  });

  const micUp = mics.map((mic) => online(mic.deviceId, 'MIC'));
  const noMic = mics.length > 0 && micUp.every((up) => !up);
  mics.forEach((mic, index) => {
    const reachable = micUp[index] === true;
    const primary = mic.role === ('PRIMARY' satisfies MicRole);
    const blocked = noMic || primary;
    rows.push({
      slot: mic.role,
      deviceId: mic.deviceId,
      deviceKind: 'MIC',
      reachable,
      status: reachable ? 'PASS' : blocked ? 'BLOCK' : 'WARN',
      rule: reachable ? null : noMic ? CaptureStartRule.NO_MICROPHONE : primary ? CaptureStartRule.ACTIVE_MICROPHONE : CaptureStartRule.NO_STANDBY,
      degraded: !reachable && !blocked,
      otherDeviceId: reachable || noMic ? null : (mics.find((other) => other !== mic)?.deviceId ?? null),
    });
  });
  return rows;
}
