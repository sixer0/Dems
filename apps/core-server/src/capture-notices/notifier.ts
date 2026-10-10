/**
 * The no-device notifier (task 3 blueprint row 133; specs R-10 AC-1, AC-2, AC-5, AC-6; contract C3
 * §5.4; capture spec §A.1.1: adapters raise nothing, a notifier does; decisions D72(h), D80(8)).
 *
 * ONE place turns "the capture side found no device" into Core state. It calls the engine's
 * INTERNAL pair `raiseCaptureWarning` / `clearCaptureWarning` with the notice members of
 * `CaptureWarningInput` (`@dems/shared/sim`, `capture-notices.ts`), which hold the rules:
 * one active alert per (reason, target), a raise while active writes nothing, a clear writes no
 * audit row, a later occurrence is a NEW alert.
 *
 *   situation                                     who calls                          what is written
 *   A  a camera search closed                     the discovery module (row 132),    0 responders: one SYSTEM WARNING alert, NO audit row
 *                                                 the pre-check gate                 (the search's own row is the one row, D80(8));
 *                                                                                    1 or more: the alert is resolved; FAILED: nothing
 *   B  a configured device at a pre-check         the pre-check gate (`precheck.ts`) unreachable: alert + CAPTURE_DEVICE_UNREACHABLE;
 *                                                                                    reachable: resolved, no row
 *   C  no camera connected at session start       the session start (rows 71 / 139)  CAPTURE_FAULT, the capture as a whole (FAULT_RAISED)
 *   C  degraded: one camera of two connected      the session start (rows 71 / 139)  alert + CAPTURE_DEVICE_UNREACHABLE, phase SESSION_START
 *
 * IT NEVER THROWS INTO ITS CALLER. A search, a pre-check and a session start must not fail
 * because an alert could not be written: every method resolves `true` when the engine took the
 * call and `false` when it did not, and a failure is reported once through `report` (the log and
 * the persistent error log). What the engine refused is not retried here: the next occurrence
 * (the next search, the next pre-check run) says it again.
 *
 * This file names no socket, no process, no file, no timer and no clock, and logs nothing itself.
 * Texts and reports carry device IDs, search IDs and codes only (R-10 AC-6).
 */
import {
  CaptureNoticeReason,
  CaptureUnreachableCause,
  CaptureUnreachablePhase,
  FaultKind,
  type CaptureDeviceUnreachableNotice,
  type CaptureWarningInput,
} from '@dems/shared/sim';

/** What the notifier needs of the engine host: its two INTERNAL warning actions. */
export interface NoticeEngine {
  raiseCaptureWarning(warning: CaptureWarningInput): Promise<unknown>;
  clearCaptureWarning(warning: CaptureWarningInput): Promise<unknown>;
}

/** A failure the notifier could not act on. Identifiers and codes only. */
export interface NoticeReport {
  readonly source: string;
  readonly code: string;
  readonly deviceId: string | null;
  readonly sessionId: string | null;
  readonly searchId: string | null;
  readonly err: unknown;
}

export const NoticeReportCode = {
  /** No engine is provided: nothing can be raised or resolved. */
  NO_ENGINE: 'CAPTURE_NOTICE_NO_ENGINE',
  RAISE_FAILED: 'CAPTURE_NOTICE_NOT_RAISED',
  RESOLVE_FAILED: 'CAPTURE_NOTICE_NOT_RESOLVED',
} as const;

/** A camera search that closed (C3 §2.6 `CaptureDiscoverySearch`): the four facts situation A is decided on. */
export interface ClosedSearch {
  readonly searchId: string;
  readonly trigger: 'MANUAL' | 'PRECHECK';
  readonly outcome: 'COMPLETE' | 'FAILED';
  /** Devices that answered the probe. Registered ones count: a search that finds only those is not empty (R-10 AC-1). */
  readonly responderCount: number;
}

export interface UnreachableDevice {
  readonly deviceId: string;
  readonly phase: typeof CaptureUnreachablePhase.PRECHECK | typeof CaptureUnreachablePhase.SESSION_START;
  readonly cause: CaptureUnreachableCause;
  /** True when the session may start, or started, without this device. */
  readonly degraded: boolean;
  readonly sessionId: string;
  /** The count of the one search of the pre-check, when it ran and closed. */
  readonly searchResponderCount?: number | undefined;
}

export interface NoDeviceNotifier {
  /** Situation A. Call it once for every camera search that closed, whatever started it. */
  searchClosed(search: ClosedSearch): Promise<boolean>;
  /** Situation B and the degraded warning of C: the device does not answer. */
  deviceUnreachable(device: UnreachableDevice): Promise<boolean>;
  /** The device answers: it reads online and its alert, if one is active, is resolved. */
  deviceReachable(deviceId: string, phase: UnreachableDevice['phase']): Promise<boolean>;
  /** Presence only (operation 97; a pre-check before its search closed): `online` of the device, no alert, no audit row. */
  devicePresence(deviceId: string, present: boolean): Promise<boolean>;
  /**
   * Situation C, for the session start (rows 71 / 139): no camera connected within the
   * ingest-open window. Raises `CAPTURE_FAULT` for the capture as a whole, which FAULTS the
   * session. Row 139: called by `session-start.ts` ONLY as the net under the capture side's own
   * raise (a failed start that has no capture fault alert); the keys `reason: NO_CAMERA_CONNECTED`
   * and `evidenceFiles: 0` (C3 §5.3) are written by the capture side with its raise (row 71c).
   */
  notifyNoCameraConnected(session: { readonly sessionId: string }): Promise<boolean>;
  /** Situation C, degraded: one camera of two connected. One WARNING naming the missing camera. */
  notifyCameraNotConnected(camera: { readonly deviceId: string; readonly sessionId: string }): Promise<boolean>;
  /** The capture side, when that camera connects in a later session: resolves its degraded warning (D72(h)). */
  cameraConnected(deviceId: string): Promise<boolean>;
  /** The capture side, when a camera connects in a later session: clears the fault of situation C (`FAULT_CLEARED`). */
  camerasAvailable(): Promise<boolean>;
}

export interface NoDeviceNotifierOptions {
  /** Read at every call: the engine is a seam. Null: no engine, nothing is written and the call is reported. */
  readonly engine: () => NoticeEngine | null;
  readonly report: (report: NoticeReport) => void;
}

const SOURCE = 'captureNotices.notifier';

export function createNoDeviceNotifier(options: NoDeviceNotifierOptions): NoDeviceNotifier {
  /** A report never throws back into the notifier. */
  const report = (entry: NoticeReport): void => {
    try {
      options.report(entry);
    } catch {
      // Nowhere left to say it.
    }
  };

  const send = async (kind: 'raise' | 'clear', warning: CaptureWarningInput, ids: Pick<NoticeReport, 'deviceId' | 'sessionId' | 'searchId'>): Promise<boolean> => {
    const failed = kind === 'raise' ? NoticeReportCode.RAISE_FAILED : NoticeReportCode.RESOLVE_FAILED;
    let host: NoticeEngine | null;
    try {
      host = options.engine();
    } catch (err) {
      report({ source: SOURCE, code: failed, ...ids, err });
      return false;
    }
    if (host === null) {
      report({ source: SOURCE, code: NoticeReportCode.NO_ENGINE, ...ids, err: new Error('no engine is provided to the no-device notifier') });
      return false;
    }
    try {
      await (kind === 'raise' ? host.raiseCaptureWarning(warning) : host.clearCaptureWarning(warning));
      return true;
    } catch (err) {
      report({ source: SOURCE, code: failed, ...ids, err });
      return false;
    }
  };

  const unreachable = (deviceId: string, phase: CaptureUnreachablePhase): CaptureDeviceUnreachableNotice => ({ code: CaptureNoticeReason.CAPTURE_DEVICE_UNREACHABLE, subject: deviceId, phase });
  const none = { deviceId: null, sessionId: null, searchId: null } as const;

  const deviceUnreachable = (device: UnreachableDevice): Promise<boolean> =>
    send(
      'raise',
      {
        ...unreachable(device.deviceId, device.phase),
        cause: device.cause,
        degraded: device.degraded,
        sessionId: device.sessionId,
        ...(device.searchResponderCount === undefined ? {} : { searchResponderCount: device.searchResponderCount }),
      },
      { deviceId: device.deviceId, sessionId: device.sessionId, searchId: null },
    );

  return {
    async searchClosed(search) {
      // A search that failed says nothing about the network: it neither raises nor resolves.
      if (search.outcome !== 'COMPLETE') return false;
      const ids = { deviceId: null, sessionId: null, searchId: search.searchId };
      if (search.responderCount > 0) return send('clear', { code: CaptureNoticeReason.CAPTURE_DISCOVERY_EMPTY, subject: null }, ids);
      return send('raise', { code: CaptureNoticeReason.CAPTURE_DISCOVERY_EMPTY, subject: null, searchId: search.searchId, trigger: search.trigger }, ids);
    },

    deviceUnreachable,

    deviceReachable: (deviceId, phase) => send('clear', unreachable(deviceId, phase), { ...none, deviceId }),

    devicePresence: (deviceId, present) => send(present ? 'clear' : 'raise', unreachable(deviceId, CaptureUnreachablePhase.PRESENCE), { ...none, deviceId }),

    notifyNoCameraConnected: (session) => send('raise', { code: FaultKind.CAPTURE_FAULT, subject: null }, { ...none, sessionId: session.sessionId }),

    notifyCameraNotConnected: (camera) =>
      deviceUnreachable({ deviceId: camera.deviceId, phase: CaptureUnreachablePhase.SESSION_START, cause: CaptureUnreachableCause.NOT_CONNECTED, degraded: true, sessionId: camera.sessionId }),

    cameraConnected: (deviceId) => send('clear', unreachable(deviceId, CaptureUnreachablePhase.SESSION_START), { ...none, deviceId }),

    camerasAvailable: () => send('clear', { code: FaultKind.CAPTURE_FAULT, subject: null }, none),
  };
}
