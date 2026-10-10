/**
 * What the capture of a REAL recording does to the open session (blueprint row 71, Core half;
 * decisions D72(h), D72(k), D84, D91 R-1 option A; contract C3 §3.1 "recording start"; database
 * contract `dbc-4` MR-S1). PURE: state in, state out; no clock, no statement.
 *
 * The engine host runs these inside its own units (`host.ts`, the capture blocks). They are here
 * and not in the shared simulator because the simulator has no notion of a fragment: a simulated
 * recording is durable from RECORDING and none of this ever runs for it.
 *
 *   captureConnectingTransition   the accepted start: the stored state is RECORDING, the payload
 *                                 says `captureDurable: false` ("connecting cameras");
 *   captureDurableTransition      (the shared one) the first durable fragment: `true`;
 *   failedCaptureStartTransition  the capture ended with NOTHING durable (no camera connected,
 *                                 the worker could not be started): the session goes to FAULT and
 *                                 nothing claims to have recorded. `startedAt` is taken back and no
 *                                 byte is counted, so the recovery that follows keeps a history
 *                                 entry and makes NO evidence item;
 *   interruptedCaptureTransition  the capture ended while the session holds a durable fragment:
 *                                 FAULT, with `captureDurable: true`. What is on the disk is
 *                                 sealed as interrupted by the sealing row;
 *   clearCaptureFaultsTransition  every active `MIC_SILENT` / `CAPTURE_FAULT` is cleared, each
 *                                 with its FAULT_CLEARED row (decision D84 R-4: a capture fault
 *                                 that outlived its worker is over when a session records again,
 *                                 or at boot);
 *   audioSourceSwitchTransition   the acknowledged switch of the active microphone: the state of
 *                                 the simulator's own transition WITHOUT its audit row. In real
 *                                 capture the row is written by the session wiring with the keys
 *                                 of contract C3 §5.2 and the media time the worker acknowledged.
 */
import { SessionState } from '@dems/shared/domain';
import { FaultKind, addTimelineItem, clearFaultAtKey, enterFault, raiseCaptureWarningTransition, type ActiveSession, type EpochMs, type SimState } from '@dems/shared/sim';

/** The two fault kinds the capture side raises, and so the two it clears. */
export const CAPTURE_FAULT_KINDS: readonly FaultKind[] = [FaultKind.MIC_SILENT, FaultKind.CAPTURE_FAULT];

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
 * The same state for another session, another state, or a session that is durable.
 *
 * THE FAULT ROW OF THE SESSION (its timeline item of kind FAULT) says the two keys of situation C
 * (contract C3 §5.3, erratum PE-121-09; row 71c): `reason` - `NO_CAMERA_CONNECTED` when no camera
 * connected within the ingest-open window, otherwise the code the capture ended with - and
 * `evidenceFiles: 0`: nothing was recorded. The label says the same in words.
 *
 * THE ALERT OF THAT FAULT carries the same two keys in its `params` (C3 §5.4 row C; request of row
 * 139: the clients word the alert from `params.reason`). The fault of the capture as a whole is
 * raised HERE when the capture side has not raised it yet - the simulator's own raise, so there is
 * one alert and one FAULT_RAISED row whichever of the two comes first (a second raise for the same
 * subject writes nothing) - and THE ALERT THIS TRANSITION MADE is given the keys.
 * LIMIT, MEASURED: when the capture side's own raise came first (the usual order: the forwarder
 * raises on the worker's end before this unit runs), the alert is stored already and its `params`
 * cannot be changed; it then holds no `reason`. The keys reach every alert only when the shared
 * simulator's raise takes them (request filed). The FAULT_RAISED audit row is composed by the
 * shared simulator and holds neither key in any order.
 */
export const FAILED_START_REASON_UNKNOWN = 'CAPTURE_START_FAILED';
const NO_CAMERA_CONNECTED = 'NO_CAMERA_CONNECTED';
/** A code as a fault row holds it: letters, digits and underscores; anything else is not written. */
const FAULT_REASON_CODE = /^[A-Z][A-Z0-9_]{1,63}$/;

export function failedCaptureStartTransition(state: SimState, now: EpochMs, sessionId: string, cause: string | null = null): SimState {
  const session = recordingSessionOf(state, sessionId);
  if (session === null || session.captureDurable !== false) return state;
  const reason = cause !== null && FAULT_REASON_CODE.test(cause) ? cause : FAILED_START_REASON_UNKNOWN;
  // While the session still says RECORDING: the row and the alert are those of a fault raised in a recording.
  const raised = raiseCaptureWarningTransition(state, now, { code: FaultKind.CAPTURE_FAULT, subject: null });
  // Only an alert this transition MADE can be given the keys: the `params` of a stored alert are
  // immutable for the runtime role (`IMMUTABLE_CHANGED`, measured), so an alert the capture side
  // raised first keeps the params the simulator's raise gave it.
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
      label: reason === NO_CAMERA_CONNECTED ? 'Recording did not start: no camera connected. Nothing was recorded.' : 'Recording did not start: the capture could not be started. Nothing was recorded.',
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
/** Whether any fragment row of a session is stored: where `captureDurable` comes from after a restart (no column holds it). */
export const READ_SESSION_HAS_FRAGMENT = 'SELECT 1 AS found FROM public.recording_fragments WHERE session_id = $1 LIMIT 1';

/**
 * After a restart (the engine host's rehydrate, capture mode `real` only): the member is derived
 * from the stored fragment rows of the session. THE FILE IS THE TRUTH, THE ROW IS A HINT: `false`
 * here means "no fragment row is stored", not "no byte is on the disk" - a Core that went down
 * between the worker's write and the row insert reads `false` while a camera file exists. So the
 * member decides what is PRESENTED; whether such a session is an interrupted recording is decided
 * by the walk of the camera files at RECOVERY (the sealing row), never from this value alone.
 */
export function captureDurableAtRehydrateTransition(state: SimState, hasFragmentRow: boolean): SimState {
  const session = state.session;
  if (session === null) return state;
  const recorded = session.state === SessionState.RECORDING || (session.state === SessionState.FAULT && session.fault?.fromState === SessionState.RECORDING);
  if (!recorded || session.captureDurable === hasFragmentRow) return state;
  return { ...state, session: { ...session, captureDurable: hasFragmentRow } };
}

export function clearCaptureFaultsTransition(state: SimState, now: EpochMs): SimState {
  let next = state;
  for (const kind of CAPTURE_FAULT_KINDS) next = clearFaultAtKey(next, now, kind, undefined);
  return next;
}

export interface AudioSourceSwitch {
  readonly sessionId: string;
  /** The input that becomes the active one: an input of the session's selector snapshot. */
  readonly toInputId: string;
  /** Media time (ms, FILE time) at which the worker realised the switch: where the new interval begins. */
  readonly atMediaMs: number;
}

/** What the switch moved, for the row the caller writes. Null: nothing changed. */
export interface AudioSourceSwitched {
  readonly fromInputId: string;
  readonly toInputId: string;
  /** Start of the interval the switch closed, in media ms. */
  readonly fromMs: number;
  /** End of that interval = start of the new one, in media ms. */
  readonly toMs: number;
}

/**
 * The acknowledged switch (operation 81 in real capture). Moves `audio.activeInputId`, records the
 * new active / standby pair with the MEDIA time of the boundary, and adds the timeline item
 * `AUDIO_SWITCH`. Writes no audit row.
 * Returns the same state, and `switched: null`, when the session is not that RECORDING session,
 * the input is none of its selector, or it is active already.
 */
export function audioSourceSwitchTransition(state: SimState, now: EpochMs, change: AudioSourceSwitch): { readonly state: SimState; readonly switched: AudioSourceSwitched | null } {
  const session = recordingSessionOf(state, change.sessionId);
  const source = session?.audioSource ?? null;
  const mics = session?.captureConfig?.mics ?? state.captureConfig.mics;
  const mic = mics.find((entry) => entry.inputId === change.toInputId);
  if (session === null || source === null || mic === undefined || source.activeInputId === change.toInputId) return { state, switched: null };
  const toMs = Math.max(source.intervalFromMs, Math.round(change.atMediaMs));
  const switchedSession: ActiveSession = {
    ...session,
    audioSource: { sessionId: session.id, activeInputId: change.toInputId, standbyInputId: source.activeInputId, switchedAt: now, intervalFromMs: toMs },
  };
  let next: SimState = { ...state, session: switchedSession, audio: { inputs: state.audio.inputs, activeInputId: change.toInputId } };
  next = addTimelineItem(next, {
    at: now,
    kind: 'AUDIO_SWITCH',
    label: `Active microphone switched to ${change.toInputId}`,
    detail: null,
    channel: 'AUDIO-01',
    params: { from: source.activeInputId, to: change.toInputId, deviceId: mic.deviceId },
  });
  return { state: next, switched: { fromInputId: source.activeInputId, toInputId: change.toInputId, fromMs: source.intervalFromMs, toMs } };
}
