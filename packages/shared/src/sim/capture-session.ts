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
import { CAPTURE_CONNECT_MS, CAPTURE_CONNECT_MS_MAX } from './constants';
import { CaptureNoticeReason, CaptureUnreachableCause, CaptureUnreachablePhase, activeCaptureNotice, clearCaptureNoticeTransition, raiseCaptureNoticeTransition } from './capture-notices';
import { raiseCaptureWarningTransition } from './capture-telemetry';
import { isFaultActive } from './derive';
import { interruptedFactOf } from './evidence';
import { clearFaultAtKey } from './faults';
import { addTimelineItem, enterFault } from './session-machine';
import type { ActiveSession, CaptureConfigCamera, CaptureWarningInput, EpochMs, EvidenceItem, SimState } from './types';
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
 * D84 R-3 / R-4 IN THIS TRANSITION (review R74-01). The capture-wide fault of a failed start stays
 * raised after its session is closed, until a session starts again (R-4: `advanceCaptureStart`
 * clears it when the next start connects; on the Core the forwarder clears every capture fault when
 * a worker reaches RECORDING). When the NEXT start fails too, the fault that is active was raised
 * before this session began: it is another session's. It is ended here (`endStaleCaptureFault`:
 * FAULT_CLEARED, its alert resolved) and this session's own is raised - two failed starts in a row
 * are two alerts and two FAULT_RAISED rows, each naming its session.
 *
 * The fault row of the session (its timeline item of kind FAULT) and the alert of the fault carry
 * the two keys of situation C (C3 §5.3, §5.4 row C): `reason` - `NO_CAMERA_CONNECTED`, or the code
 * the capture ended with - and `evidenceFiles: 0`. The fault of the capture as a whole is raised
 * HERE when this session's is not active yet (a second raise for the same subject writes nothing),
 * with the two keys; an alert that was stored before keeps the `params` it was raised with.
 */
export function failedCaptureStartTransition(state: SimState, now: EpochMs, sessionId: string, cause: string | null = null): SimState {
  const session = recordingSessionOf(state, sessionId);
  if (session === null || session.captureDurable !== false) return state;
  const reason = cause !== null && FAULT_REASON_CODE.test(cause) ? cause : FAILED_START_REASON_UNKNOWN;
  // While the session still says RECORDING: the row and the alert are those of a fault raised in a recording.
  // The two keys ride the raise (`captureFaultFactsOf`); the input type does not name them (pass D6 item 14).
  const warning = { code: FaultKind.CAPTURE_FAULT, subject: null, reason, evidenceFiles: 0 } as CaptureWarningInput;
  // D84 R-3 (review R74-01): a capture-wide fault that began BEFORE this session started is another
  // session's. It ends here, so this failed start is a new occurrence with its own alert and row.
  const raised = raiseCaptureWarningTransition(endStaleCaptureFault(state, now, session), now, warning);
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
  // Finding G75-11: nothing started. The START node the accepted start wrote ("Recording started")
  // leaves the session's timeline; the FAULT node below says what the start came to.
  const timeline = faulted.timeline.filter((item) => item.kind !== 'START');
  return addTimelineItem(
    { ...raised, alerts, session: timeline.length === faulted.timeline.length ? faulted : { ...faulted, timeline } },
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
 * The capture-wide `CAPTURE_FAULT` that is active and began before `session` started recording is
 * cleared (its alert resolved, one FAULT_CLEARED row). The same state when there is none, when it
 * began in this session, or when the session has no start instant.
 */
export function endStaleCaptureFault(state: SimState, now: EpochMs, session: Pick<ActiveSession, 'startedAt'>): SimState {
  const startedAt = session.startedAt;
  if (startedAt === null) return state;
  const stale = state.faults.active.some((fault) => fault.kind === FaultKind.CAPTURE_FAULT && fault.target === null && fault.since < startedAt);
  return stale ? clearFaultAtKey(state, now, FaultKind.CAPTURE_FAULT, null) : state;
}

/** True for the open session that is a failed start: in FAULT (or being closed) with nothing recorded. */
export function isFailedCaptureStart(session: Pick<ActiveSession, 'captureDurable' | 'fault' | 'startedAt'> | null | undefined): boolean {
  return session !== null && session !== undefined && session.captureDurable === false && session.startedAt === null && session.fault?.kind === FaultKind.CAPTURE_FAULT;
}

/** Why no live microphone level is drawn for the open session. */
export type NoLiveLevels = 'CONNECTING' | 'FAILED_START';

/**
 * NO LIVE LEVEL BEFORE THE FIRST DURABLE FRAGMENT, AND NONE FOR A SESSION THAT RECORDED NOTHING
 * (wave H driver B, finding G75-04; ux §8e.2 "no meters"; D84). One rule for every meter of every
 * client: `CONNECTING` while the cameras of a start connect, `FAILED_START` for the open session
 * that is a failed start (in FAULT, or being closed), null when a level may be drawn.
 */
export function noLiveLevelsOf(session: Pick<ActiveSession, 'state' | 'captureDurable' | 'fault' | 'startedAt'> | null | undefined): NoLiveLevels | null {
  if (session === null || session === undefined) return null;
  if (session.state === SessionState.RECORDING && session.captureDurable === false) return 'CONNECTING';
  return isFailedCaptureStart(session) ? 'FAILED_START' : null;
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

// ── An interrupted seal (wave H driver B; findings G75-03 / G75-08 / G75-10; ruling D197) ────────

/** The custody action `completeSealTransition` writes for a recording that did not end by a stop. */
export const CUSTODY_RECORDING_INTERRUPTED = 'RECORDING_INTERRUPTED';

/** What every surface needs to NAME an interrupted seal: the fault that ended the recording and when. */
export interface InterruptedSeal {
  /** The fault kind as the custody entry / the session holds it (`CAPTURE_FAULT` for a capture that ended), or null. */
  faultKind: string | null;
  /** The instant the recording really ended: the end of the durable media. */
  endedAt: EpochMs;
}

/**
 * THE INTERRUPTED FACT OF AN EVIDENCE ITEM, from an EXISTING member: the custody entry
 * `RECORDING_INTERRUPTED` the seal of an interrupted recording writes (its `detail` is the fault
 * kind, its `at` the end of the durable media). Null for every other item. The evidence list and
 * the item header read THIS (request line to the evidence folders).
 */
export function interruptedSealOfItem(item: (Pick<EvidenceItem, 'custody'> & Partial<Pick<EvidenceItem, 'endedAt'>>) | null | undefined): InterruptedSeal | null {
  if (item === null || item === undefined) return null;
  const entry = item.custody.find((candidate) => candidate.action === CUSTODY_RECORDING_INTERRUPTED);
  // Reconcile pass R (decision D207): where the Core states the sealed manifest's own flag on the item
  // (`interrupted`), THAT is the answer - the same one the evidence list and the item header draw
  // (`interruptedFactOf`, evidence.ts). The custody entry answers only while the member is absent.
  const fact = interruptedFactOf(item);
  if (fact.interrupted !== true) return null;
  return { faultKind: fact.source === 'MANIFEST' ? (fact.cause ?? entry?.detail ?? null) : (entry?.detail ?? null), endedAt: entry?.at ?? item.endedAt ?? 0 };
}

/**
 * THE INTERRUPTED FACT OF A SESSION, open or in the history: the item of that session says it
 * (`interruptedSealOfItem`); before the item exists - the session is FINALIZING after a fault that
 * ended its recording - the session's own `fault` says it. Null for a session that was stopped, for
 * a failed start (nothing was recorded) and for a session that is not being sealed.
 *
 * WHY NOT `faultKind` OF THE HISTORY ENTRY: the database admits a fault kind on an INCOMPLETE entry
 * only (`session_history_outcome_check`), and a new column is a migration. The item of the session
 * is in the same replicated state on every client, so nothing new is stored.
 */
export function interruptedSealOfSession(state: Pick<SimState, 'session' | 'evidence'>, sessionId: string | null | undefined): InterruptedSeal | null {
  if (sessionId === null || sessionId === undefined) return null;
  const ofItem = interruptedSealOfItem(state.evidence.find((item) => item.sessionId === sessionId));
  if (ofItem !== null) return ofItem;
  const session = state.session;
  if (session === null || session.id !== sessionId || session.startedAt === null) return null;
  if (session.state !== SessionState.FINALIZING && session.state !== SessionState.SEALED) return null;
  if (session.fault === null || session.fault.fromState !== SessionState.RECORDING) return null;
  return { faultKind: session.fault.kind, endedAt: session.stoppedAt ?? session.fault.at };
}

/**
 * D84 R-4 AT THE SEAL (finding G75-10): the capture-wide `CAPTURE_FAULT` of the recording that was
 * just sealed as interrupted is over - its session is closed, nothing is blocked, and the item says
 * what happened. Cleared here (FAULT_CLEARED, the alert resolved) instead of standing as a critical
 * fault until some later start. The same state when `session` did not end by a capture fault or no
 * such fault is active.
 */
export function endCaptureFaultAtSeal(state: SimState, now: EpochMs, session: Pick<ActiveSession, 'fault'>): SimState {
  if (session.fault?.kind !== FaultKind.CAPTURE_FAULT) return state;
  return clearFaultAtKey(state, now, FaultKind.CAPTURE_FAULT, null);
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
export function captureStartDueAt(session: ActiveSession | null, connectMs: number = CAPTURE_CONNECT_MS): EpochMs | null {
  if (session === null || session.state !== SessionState.RECORDING || session.captureDurable !== false || session.startedAt === null) return null;
  return session.startedAt + connectMs;
}

/**
 * THE CONNECTING TIME A HOST ASKED FOR (`CreateSimOptions.captureConnectMs`; wave H closing pass Z1,
 * driver B decision 6): a whole number of milliseconds from 0 to `CAPTURE_CONNECT_MS_MAX`, else the
 * default. A test / development control of the host that creates the simulator - it holds the
 * connecting state long enough for a gate to look at it. No action and no operation sets it.
 */
export function captureConnectMsOf(value: number | undefined): number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 && value <= CAPTURE_CONNECT_MS_MAX ? value : CAPTURE_CONNECT_MS;
}

/**
 * The simulator's decision of a connecting start, once its time has come (see the file header).
 * Returns the same state before that instant and for every session that is not connecting.
 */
export function advanceCaptureStart(state: SimState, now: EpochMs, connectMs: number = CAPTURE_CONNECT_MS): SimState {
  const session = state.session;
  const at = captureStartDueAt(session, connectMs);
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
 * THE END OF A DEGRADED START'S WARNING in the simulator's own capture (finding G75-07 (c), (d)).
 * The warning `CAPTURE_DEVICE_UNREACHABLE` of phase `SESSION_START` says "this session records
 * without that camera". When no session records any more it is over: the alert is resolved and the
 * device reads reachable again in the registry, so the NEXT pre-check judges the camera by what it
 * is then (a camera that is still lost is caught by its own `CAMERA_LOSS` check), not by a warning
 * of a closed session. The same state while a session records and when there is no such warning.
 */
export function advanceCaptureEnd(state: SimState, now: EpochMs): SimState {
  if (state.session?.state === SessionState.RECORDING) return state;
  let next = state;
  for (const alert of state.alerts) {
    if (!alert.active || alert.kind !== 'SYSTEM' || alert.params?.['reason'] !== CaptureNoticeReason.CAPTURE_DEVICE_UNREACHABLE || alert.params['phase'] !== CaptureUnreachablePhase.SESSION_START) continue;
    const subject = alert.target ?? null;
    if (subject === null || !next.captureDevices.devices.some((device) => device.id === subject)) continue;
    next = clearCaptureNoticeTransition(next, now, { code: CaptureNoticeReason.CAPTURE_DEVICE_UNREACHABLE, subject, phase: CaptureUnreachablePhase.SESSION_START });
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
