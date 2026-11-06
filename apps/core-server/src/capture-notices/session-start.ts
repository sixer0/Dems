/**
 * Situation C at a session start (task 3 blueprint row 139; specs R-10 AC-3, AC-5, AC-6; contract
 * C3 §3.1 "recording start", §5.4; ux flow 11; decisions D72(h), D72(k), D84, D91 R-1 option A).
 *
 * The capture-session unit (`src/capture-session`) says what the capture of a session did:
 * CONNECTING, STARTED { cameras, camerasNotOpened }, DURABLE, FAILED_START { cause }. THIS FILE
 * turns those events into what the operator is told, through the notifier of this unit. It reads
 * the events and the engine's committed state; it starts nothing, stops nothing and owns no row.
 *
 *   event                         what is written
 *   CONNECTING                    nothing. The session payload says `captureDurable: false`, which
 *                                 the clients read as "Connecting cameras…" (the capture-session unit's)
 *   STARTED                       nothing by itself: remembered. A camera that was not opened is
 *                                 NOT announced before the session records, because a start that
 *                                 then fails has exactly ONE alert, the critical one (row 139).
 *                                 (DURABLE may arrive before STARTED; the two together announce once)
 *   DURABLE, one camera missing   one WARNING per camera that was not opened: `SYSTEM`,
 *                                 `reason: CAPTURE_DEVICE_UNREACHABLE`, `phase: SESSION_START`,
 *                                 `cause: NOT_CONNECTED`, and its one `CAPTURE_DEVICE_UNREACHABLE`
 *                                 row with `degraded: true`. A pre-check notice of that camera
 *                                 that is still active is replaced by it (one active alert per
 *                                 device: the session start is the newer fact)
 *   CAMERA_NOT_CONNECTED          the WORKER says a camera of the plan did not connect within the
 *                                 ingest-open window (protocol 4; fix pass F-M5, review R74-03).
 *                                 Remembered with the cameras that were not opened: the same ONE
 *                                 WARNING per camera, announced when the session records - at
 *                                 once when it records already. The capture forwarder raises no
 *                                 critical fault for this reason, so a degraded start is a warning
 *                                 (ux §8e.2, §8g.3) and one event is one alert. Such a camera is
 *                                 not "connected": an earlier warning of it is not resolved
 *   DURABLE, a camera connected   the SESSION_START warning an earlier session left for that
 *                                 camera is resolved (D72(h): "the capture side, when that camera
 *                                 connects in a later session"), unless a fault names the camera now
 *   FAILED_START                  the critical alert is the capture side's own `CAPTURE_FAULT` of
 *                                 the capture as a whole (the forwarder raised it with the worker's
 *                                 end; its `FAULT_RAISED` row carries `reason` / `evidenceFiles: 0`).
 *                                 Here: ONLY when no such alert is active, it is raised through
 *                                 `notifyNoCameraConnected`, so that a failed start never leaves
 *                                 a FAULT session without its alert. Said to the error log.
 *
 * NOT DONE HERE, on purpose: clearing the critical fault. Decision D84 R-4 clears every capture
 * fault when a session records again, inside the capture unit; a second clear from here could
 * take away a fault of the running session.
 *
 * IT NEVER THROWS INTO THE CAPTURE SESSION. The notifier reports its own failures; what this file
 * cannot read is reported once with the session ID and a code. Identifiers and codes only.
 */
import { CaptureNoticeReason, CaptureUnreachablePhase, FaultKind, type SimState } from '@dems/shared/sim';
import type { NoDeviceNotifier, NoticeReport } from './notifier';

/**
 * The events of the capture-session unit this file acts on (`SessionCaptureEvent` of
 * `src/capture-session`, structurally: that union is assignable to this one, so a member added
 * there needs no edit here).
 */
export type SessionStartEvent =
  | { readonly type: 'CONNECTING'; readonly sessionId: string }
  | { readonly type: 'STARTED'; readonly sessionId: string; readonly cameras: readonly string[]; readonly camerasNotOpened: readonly string[] }
  | { readonly type: 'DURABLE'; readonly sessionId: string }
  | { readonly type: 'CAMERA_NOT_CONNECTED'; readonly sessionId: string; readonly deviceId: string }
  | { readonly type: 'FAILED_START'; readonly sessionId: string; readonly cause: string | null }
  | { readonly type: 'INTERRUPTED' | 'STOPPED'; readonly sessionId: string };

/** The source of those events: `sessionCapture(app)`. */
export interface SessionStartSource {
  on(listener: (event: SessionStartEvent) => void | Promise<void>): () => void;
}

/** The slices read of the engine's committed state. */
export type SessionStartState = Pick<SimState, 'alerts'>;

export const SessionStartReportCode = {
  /** The committed state could not be read: nothing is decided from a guess. */
  STATE_NOT_READ: 'CAPTURE_SESSION_START_STATE_NOT_READ',
  /** A failed start had no active capture fault alert: the notifier raised it. */
  FAULT_RAISED_HERE: 'CAPTURE_SESSION_START_FAULT_RAISED_BY_NOTIFIER',
} as const;

/** The code the worker ends a session with when no camera connected within the ingest-open window (D72(k)). */
export const NO_CAMERA_CONNECTED = 'NO_CAMERA_CONNECTED';

export interface SessionStartWatchOptions {
  readonly notifier: NoDeviceNotifier;
  /** The committed state, or null when the engine is not running. */
  readonly state: () => SessionStartState | null;
  readonly report: (report: NoticeReport) => void;
}

export interface SessionStartWatch {
  /** One event of the capture session. Never rejects. */
  handle(event: SessionStartEvent): Promise<void>;
}

const SOURCE = 'captureNotices.sessionStart';

/** The active notice of a device, with the phase it was raised in. */
function unreachableNoticeOf(state: SessionStartState, deviceId: string): { readonly phase: unknown } | null {
  const alert = state.alerts.find((candidate) => candidate.active && candidate.kind === 'SYSTEM' && candidate.params?.['reason'] === CaptureNoticeReason.CAPTURE_DEVICE_UNREACHABLE && (candidate.target ?? null) === deviceId);
  return alert === undefined ? null : { phase: alert.params?.['phase'] };
}

/** True while a fault alert (not a notice) names that device: it is not "connected" then. */
const faultNames = (state: SessionStartState, deviceId: string): boolean => state.alerts.some((alert) => alert.active && alert.kind !== 'SYSTEM' && (alert.target ?? null) === deviceId);

/** True while the fault of the capture as a whole is active (situation C). */
const captureFaultActive = (state: SessionStartState): boolean => state.alerts.some((alert) => alert.active && alert.kind === FaultKind.CAPTURE_FAULT && (alert.target ?? null) === null);

export function createSessionStartWatch(options: SessionStartWatchOptions): SessionStartWatch {
  const { notifier } = options;
  /**
   * The session whose capture runs (one at a time): what STARTED said, whether DURABLE was said,
   * and whether its cameras were announced. DURABLE may come BEFORE STARTED (the first camera
   * delivers a fragment while the second one is still being opened), so both orders announce once.
   */
  let current: { readonly sessionId: string; cameras: readonly string[] | null; camerasNotOpened: readonly string[]; durable: boolean; announced: boolean; readonly notConnected: Set<string>; readonly warned: Set<string> } | null = null;
  const of = (sessionId: string): NonNullable<typeof current> => {
    if (current === null || current.sessionId !== sessionId) current = { sessionId, cameras: null, camerasNotOpened: [], durable: false, announced: false, notConnected: new Set(), warned: new Set() };
    return current;
  };

  /** The ONE warning of a camera the session records without. Once per camera and session. */
  async function warn(session: NonNullable<typeof current>, state: SessionStartState, deviceId: string): Promise<void> {
    if (session.warned.has(deviceId)) return;
    session.warned.add(deviceId);
    // One active alert per device: the pre-check's notice of the same camera gives way to the newer fact.
    if (unreachableNoticeOf(state, deviceId)?.phase === CaptureUnreachablePhase.PRECHECK) await notifier.deviceReachable(deviceId, CaptureUnreachablePhase.PRECHECK);
    await notifier.notifyCameraNotConnected({ deviceId, sessionId: session.sessionId });
  }

  const report = (entry: Omit<NoticeReport, 'source' | 'searchId'>): void => {
    try {
      options.report({ source: SOURCE, searchId: null, ...entry });
    } catch {
      // Nowhere left to say it.
    }
  };

  const stateOf = (sessionId: string): SessionStartState | null => {
    try {
      const state = options.state();
      if (state === null) report({ code: SessionStartReportCode.STATE_NOT_READ, deviceId: null, sessionId, err: new Error('the engine is not running') });
      return state;
    } catch (err) {
      report({ code: SessionStartReportCode.STATE_NOT_READ, deviceId: null, sessionId, err });
      return null;
    }
  };

  /** Once per session, when it records AND its cameras are known. */
  async function announce(session: NonNullable<typeof current>): Promise<void> {
    if (session.announced || !session.durable || session.cameras === null) return;
    session.announced = true;
    const { sessionId, cameras, camerasNotOpened } = session;
    const state = stateOf(sessionId);
    if (state === null) return;

    // Degraded: the session records, and a camera of its plan was not opened or did not connect to the worker.
    if (cameras.length > 0) {
      for (const deviceId of new Set([...camerasNotOpened, ...session.notConnected])) await warn(session, state, deviceId);
    }
    // Connected in this session: the warning an earlier session start left for that camera is over.
    for (const deviceId of cameras) {
      // Its source was opened, but the worker says it did not connect: not connected.
      if (session.notConnected.has(deviceId)) continue;
      if (unreachableNoticeOf(state, deviceId)?.phase !== CaptureUnreachablePhase.SESSION_START) continue;
      if (faultNames(state, deviceId)) continue;
      await notifier.cameraConnected(deviceId);
    }
  }

  async function failedStart(sessionId: string, cause: string | null): Promise<void> {
    const state = stateOf(sessionId);
    // The capture side raised its fault with the worker's end. Raising it again changes nothing (the engine's rule),
    // but its row is the capture side's to write: this is the net under it, not a second writer.
    if (state === null || captureFaultActive(state)) return;
    report({ code: SessionStartReportCode.FAULT_RAISED_HERE, deviceId: null, sessionId, err: new Error(`a failed start had no capture fault alert (cause ${cause === NO_CAMERA_CONNECTED ? NO_CAMERA_CONNECTED : 'OTHER'})`) });
    await notifier.notifyNoCameraConnected({ sessionId });
  }

  return {
    async handle(event) {
      try {
        switch (event.type) {
          case 'CONNECTING':
            current = null;
            of(event.sessionId);
            return;
          case 'STARTED': {
            const session = of(event.sessionId);
            session.cameras = [...event.cameras];
            session.camerasNotOpened = [...event.camerasNotOpened];
            await announce(session);
            return;
          }
          case 'DURABLE': {
            const session = of(event.sessionId);
            session.durable = true;
            await announce(session);
            return;
          }
          case 'CAMERA_NOT_CONNECTED': {
            // A statement about another session than the one whose capture runs is a late one: ignored.
            if (current === null || current.sessionId !== event.sessionId) return;
            current.notConnected.add(event.deviceId);
            if (!current.announced) {
              await announce(current);
              return;
            }
            // The session records already and its cameras were announced: this camera is said now.
            const state = stateOf(event.sessionId);
            if (state !== null) await warn(current, state, event.deviceId);
            return;
          }
          case 'FAILED_START':
            if (current?.sessionId === event.sessionId) current = null;
            await failedStart(event.sessionId, event.cause);
            return;
          default:
            if (current?.sessionId === event.sessionId) current = null;
        }
      } catch (err) {
        // The notifier does not throw; this is the net for a defect of this file.
        report({ code: SessionStartReportCode.STATE_NOT_READ, deviceId: null, sessionId: event.sessionId, err });
      }
    },
  };
}
