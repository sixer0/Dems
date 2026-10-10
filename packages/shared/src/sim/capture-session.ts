/**
 * What the capture of a recording does to the open session (blueprint row 71; decisions D72(h),
 * D72(k), D84, D91 R-1 option A, D156; contract C3 §3.1 "recording start", §5.3, §5.4; ux flow 11
 * situation C). PURE: state in, state out; no clock, no statement.
 *
 * TWO PARTS.
 *
 * 1. THE TRANSITIONS OF A CAPTURE (connecting, durable, failed start, interrupted, clearing the
 *    capture faults). They are the Core's: `apps/core-server/src/engine/capture-session.ts` holds
 *    the same functions and runs them in capture mode `real`, where the capture worker says what
 *    happened. THIS FILE IS THE SHARED COPY (integration pass D10); the two are held equal by
 *    `apps/core-server/src/engine/__tests__/capture-session-parity.test.ts` until the engine file
 *    re-exports these (request filed: the engine's capture blocks are another row's).
 *    One deliberate difference, held by that test: here the failed start hands `reason` and
 *    `evidenceFiles: 0` to the shared raise (pass D6 item 14), so the FAULT_RAISED audit row of a
 *    raise this transition makes carries the two keys as well as the alert.
 *
 * 2. THE SIMULATOR'S OWN CAPTURE (`advanceCaptureStart`). The simulator has no worker: where the
 *    simulator runs its own capture (`CreateSimOptions.capture: 'simulated'`, the in-app simulator
 *    and a Core in simulated capture operation) a start is decided by the TIME, `CAPTURE_CONNECT_MS`
 *    after `startedAt`, from the cameras of the session:
 *
 *    | Cameras with an active `CAMERA_LOSS` at that instant | Outcome |
 *    |---|---|
 *    | none | durable: the member is REMOVED (absent reads as durable, `captureDurableOf`) |
 *    | some, not all | durable (the same), and one WARNING per missing camera: the notice `CAPTURE_DEVICE_UNREACHABLE`, phase `SESSION_START`, cause `NOT_CONNECTED`, `degraded: true` (what the Core's notices unit raises at DURABLE) |
 *    | all | FAILED START: `FAULT`, `captureDurable: false`, `startedAt` null, 0 bytes; the alert of `CAPTURE_FAULT` with `params.reason: NO_CAMERA_CONNECTED` and `evidenceFiles: 0`; its recovery keeps a history entry and makes NO evidence item |
 *
 *    THE DEMO CONTROL is the existing fault `CAMERA_LOSS` with a camera target (operations 73 /
 *    74, `inject` / `clearFault`): no new control. It is read at the instant the start is decided,
 *    so a camera lost before the start and restored while the cameras connect does connect.
 *    Never runs where the capture is external (`'external'`): there the Core's capture session
 *    writes the member from what its worker reports.
 *
 *    WHY DURABLE IS "NO MEMBER" HERE AND `true` ON THE CORE'S REAL CAPTURE. No column of the Core
 *    holds the member (`dbc-4` MR-S1: in real capture it is derived from the fragment rows at a
 *    restart). A Core in SIMULATED capture has no fragment rows, so a `true` the simulator wrote
 *    would be lost at every restart and break the lossless round trip of the session (MR-1). With
 *    the member removed a durable simulated recording is exactly the session the Core stores, and
 *    the rule that keeps the timed seal away from a recording of the Core's capture
 *    (`advanceStopping`: "carries the member") stays a rule of the STATE. What is not stored is
 *    then only the connecting part itself (`false`, at most `CAPTURE_CONNECT_MS`) and the `false`
 *    of a failed start: after a restart of a Core in simulated capture both read as absent.
 */
import { SessionState } from '../domain';
import { CAPTURE_CONNECT_MS } from './constants';
import { CaptureNoticeReason, CaptureUnreachableCause, CaptureUnreachablePhase, activeCaptureNotice, clearCaptureNoticeTransition, raiseCaptureNoticeTransition } from './capture-notices';
import { raiseCaptureWarningTransition } from './capture-telemetry';
import { isFaultActive } from './derive';
import { clearFaultAtKey } from './faults';
import { addTimelineItem, enterFault } from './session-machine';
import type { ActiveSession, CaptureConfigCamera, CaptureWarningInput, EpochMs, SimState } from './types';
import { FaultKind } from './vocabulary';

/** The two fault kinds the capture side raises, and so the two it clears. */
export const CAPTURE_FAULT_KINDS: readonly FaultKind[] = [FaultKind.MIC_SILENT, FaultKind.CAPTURE_FAULT];

/** The code a capture ends with when no camera connected within the ingest-open window (D72(k)). */
export const NO_CAMERA_CONNECTED_REASON = 'NO_CAMERA_CONNECTED';
/** The reason of a failed start whose cause is no code. */
export const FAILED_START_REASON_UNKNOWN = 'CAPTURE_START_FAILED';
/** A code as a fault row holds it: letters, digits and underscores; anything else is not written. */
const FAULT_REASON_CODE = /^[A-Z][A-Z0-9_]{1,63}$/;

const recordingSessionOf = (state: SimState, sessionId: string): ActiveSession | null =>
  state.session !== null && state.session.id === sessionId && state.session.state === SessionState.RECORDING ? state.session : null;

/** The accepted start: `captureDurable: false`. The same state when that session is not RECORDING or says so already. */
export function captureConnectingTransition(state: SimState, sessionId: string): SimState {
  const session = recordingSessionOf(state, sessionId);
  if (session === null || session.captureDurable === false) return state;
  return { ...state, session: { ...session, captureDurable: false } };
}

/**
 * The first durable fragment of THAT session: `captureDurable: true`. Never back to false, and
 * never for another session than the open one (a late report of an ended capture changes nothing).
 */
export function captureDurableOfSessionTransition(state: SimState, sessionId: string): SimState {
  const session = recordingSessionOf(state, sessionId);
  if (session === null || session.captureDurable === true) return state;
  return { ...state, session: { ...session, captureDurable: true } };
}

/**
 * A FAILED START (D84): the capture of the open RECORDING session ended and nothing is durable.
 * The session goes to FAULT with the fault `CAPTURE_FAULT`; `startedAt` is null again and the byte
 * count is 0, so nothing presents it as a recording and its recovery makes no evidence item.
 * The same state for another session, another state, or a session that is not connecting.
 *
 * The fault row of the session (its timeline item of kind FAULT) and the alert of the fault carry
 * the two keys of situation C (C3 §5.3, §5.4 row C): `reason` - `NO_CAMERA_CONNECTED`, or the code
 * the capture ended with - and `evidenceFiles: 0`. The fault of the capture as a whole is raised
 * HERE when it is not active yet (a second raise for the same subject writes nothing), with the
 * two keys; an alert that was stored before keeps the `params` it was raised with.
 */
export function failedCaptureStartTransition(state: SimState, now: EpochMs, sessionId: string, cause: string | null = null): SimState {
  const session = recordingSessionOf(state, sessionId);
  if (session === null || session.captureDurable !== false) return state;
  const reason = cause !== null && FAULT_REASON_CODE.test(cause) ? cause : FAILED_START_REASON_UNKNOWN;
  // While the session still says RECORDING: the row and the alert are those of a fault raised in a recording.
  // The two keys ride the raise (`captureFaultFactsOf`); the input type does not name them (pass D6 item 14).
  const warning = { code: FaultKind.CAPTURE_FAULT, subject: null, reason, evidenceFiles: 0 } as CaptureWarningInput;
  const raised = raiseCaptureWarningTransition(state, now, warning);
  const before = new Set(state.alerts.map((alert) => alert.id));
  const alerts = raised.alerts.map((alert) => (!before.has(alert.id) && alert.active && alert.kind === FaultKind.CAPTURE_FAULT && (alert.target ?? null) === null ? { ...alert, params: { ...alert.params, reason, evidenceFiles: 0 } } : alert));
  const faulted: ActiveSession = {
    ...session,
    state: SessionState.FAULT,
    fault: { kind: FaultKind.CAPTURE_FAULT, at: now, fromState: SessionState.RECORDING },
    startedAt: null,
    bytesWritten: 0,
    captureDurable: false,
  };
  return addTimelineItem(
    { ...raised, alerts, session: faulted },
    {
      at: now,
      kind: 'FAULT',
      label: reason === NO_CAMERA_CONNECTED_REASON ? 'Recording did not start: no camera connected. Nothing was recorded.' : 'Recording did not start: the capture could not be started. Nothing was recorded.',
      detail: null,
      channel: null,
      params: { kind: FaultKind.CAPTURE_FAULT, critical: true, durable: false, reason, evidenceFiles: 0 },
    },
  );
}

/**
 * An INTERRUPTED recording (D84): the capture of the open RECORDING session ended for good while
 * a fragment is durable. The simulator's own move to FAULT (the bytes so far are kept, the
 * timeline says so), with `captureDurable: true`.
 */
export function interruptedCaptureTransition(state: SimState, now: EpochMs, sessionId: string): SimState {
  const session = recordingSessionOf(state, sessionId);
  if (session === null) return state;
  const faulted = enterFault(state, now, FaultKind.CAPTURE_FAULT);
  if (faulted.session === null) return state;
  return { ...faulted, session: { ...faulted.session, captureDurable: true } };
}

/** Clears every active capture-originated fault (D84 R-4). The same state when none is active. */
export function clearCaptureFaultsTransition(state: SimState, now: EpochMs): SimState {
  let next = state;
  for (const kind of CAPTURE_FAULT_KINDS) next = clearFaultAtKey(next, now, kind, undefined);
  return next;
}

// ── The simulator's own capture ────────────────────────────────────────────────────────────────

/** The cameras a session records: its selector snapshot, or the selector when it has none. */
function sessionCameras(state: SimState, session: ActiveSession): readonly CaptureConfigCamera[] {
  return session.captureConfig?.cameras ?? state.captureConfig.cameras;
}

/** The cameras of the open session that would not connect now: those with an active `CAMERA_LOSS`. */
export function camerasNotConnecting(state: SimState): readonly CaptureConfigCamera[] {
  const session = state.session;
  if (session === null) return [];
  return sessionCameras(state, session).filter((camera) => isFaultActive(state.faults, FaultKind.CAMERA_LOSS, camera.trackId));
}

/** When the simulator decides the start of a connecting session, or null when none is connecting. */
export function captureStartDueAt(session: ActiveSession | null): EpochMs | null {
  if (session === null || session.state !== SessionState.RECORDING || session.captureDurable !== false || session.startedAt === null) return null;
  return session.startedAt + CAPTURE_CONNECT_MS;
}

/**
 * The simulator's decision of a connecting start, once its time has come (see the file header).
 * Returns the same state before that instant and for every session that is not connecting.
 */
export function advanceCaptureStart(state: SimState, now: EpochMs): SimState {
  const session = state.session;
  const at = captureStartDueAt(session);
  if (session === null || at === null || now < at) return state;
  const cameras = sessionCameras(state, session);
  const missing = camerasNotConnecting(state);
  if (cameras.length > 0 && missing.length === cameras.length) return failedCaptureStartTransition(state, at, session.id, NO_CAMERA_CONNECTED_REASON);

  // Durable: the member goes (see the file header). Nothing else of the session moves.
  const { captureDurable: _connecting, ...durable } = session;
  let next: SimState = { ...state, session: durable };
  // D84 R-4: a capture fault that outlived its capture (the failed start before this one) is over
  // when a session records again. The simulator's own silence warning is not a capture's fault here.
  next = clearFaultAtKey(next, at, FaultKind.CAPTURE_FAULT, undefined);
  for (const camera of cameras) {
    const notice = { code: CaptureNoticeReason.CAPTURE_DEVICE_UNREACHABLE, subject: camera.deviceId, phase: CaptureUnreachablePhase.SESSION_START } as const;
    if (missing.includes(camera)) {
      // Degraded: the session records without this camera. One WARNING naming it (D72(h)).
      next = raiseCaptureNoticeTransition(next, at, { ...notice, cause: CaptureUnreachableCause.NOT_CONNECTED, degraded: true, sessionId: session.id });
    } else if (activeCaptureNotice(next, notice.code, camera.deviceId)?.params?.['phase'] === CaptureUnreachablePhase.SESSION_START) {
      // The camera connects in a later session: the warning an earlier start left is resolved.
      next = clearCaptureNoticeTransition(next, at, notice);
    }
  }
  return next;
}

/**
 * THE TEST HELPER of a recording start (integration pass D10): takes a simulator past the
 * connecting part of a start it just made, so a test that only needs a RECORDING session says so
 * in one call instead of waiting by a number. `advance` moves the simulator's clock (a manual
 * clock's `advance`, a fake timer, an engine's test timer); `tick` runs the engine once when the
 * clock does not (`sim.tick`). A test ABOUT the connecting part does not call it.
 * `await passCaptureStart((ms) => host.drive(ms))` for a Core engine on its test timer.
 */
export function passCaptureStart<T>(advance: (ms: number) => T, tick?: () => unknown): T {
  // What `advance` returns is handed back, so an engine whose clock is driven asynchronously is awaited by the caller.
  const advanced = advance(CAPTURE_CONNECT_MS);
  tick?.();
  return advanced;
}
