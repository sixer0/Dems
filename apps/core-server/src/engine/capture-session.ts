/**
 * What the capture of a REAL recording does to the open session (blueprint row 71, Core half;
 * decisions D72(h), D72(k), D84, D91 R-1 option A; contract C3 §3.1 "recording start"; database
 * contract `dbc-4` MR-S1). PURE: state in, state out; no clock, no statement.
 *
 * The engine host runs these inside its own units (`host.ts`, the capture blocks). The five
 * transitions of a capture are the shared simulator's own (re-exported below); what is only the
 * Core's - the rehydrate and the switch given a media time - is written here.
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
import { FaultKind, applyAudioSourceSwitch, type ActiveSession, type CaptureMicInputId, type EpochMs, type SimState } from '@dems/shared/sim';

// THE FIVE TRANSITIONS OF A CAPTURE ARE THE SHARED ONES (fix pass F-M5, review R74-10). Until this
// pass this file held a copy of each, kept equal by a parity test, with one difference: the failed
// start here gave `reason` / `evidenceFiles` to the alert only, because the shared raise did not take
// them yet. It has since pass D6, so the copy had nothing of its own left - and it had begun to
// drift (the words of the alert, once a fault is worded by its reason). They are re-exported: one
// rule, one file (`packages/shared/src/sim/capture-session.ts`).
export { CAPTURE_FAULT_KINDS, FAILED_START_REASON_UNKNOWN, captureConnectingTransition, captureDurableOfSessionTransition, clearCaptureFaultsTransition, failedCaptureStartTransition, interruptedCaptureTransition } from '@dems/shared/sim';

const recordingSessionOf = (state: SimState, sessionId: string): ActiveSession | null =>
  state.session !== null && state.session.id === sessionId && state.session.state === SessionState.RECORDING ? state.session : null;

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

/**
 * After a restart in capture mode `simulated` (review R74-14 (1)): the member is not stored, so a
 * FAILED START that is still open - FAULT from RECORDING by the capture, or its close in RECOVERY,
 * with NO start instant (the failed start took it back; an interrupted recording keeps it) - reads
 * as durable and the clients present a recovery of evidence. The stored facts say what it is: the
 * member is `false` again. The same state for every other session.
 */
export function failedStartAtRehydrateTransition(state: SimState): SimState {
  const session = state.session;
  if (session === null || session.captureDurable !== undefined) return state;
  const open = session.state === SessionState.FAULT || session.state === SessionState.RECOVERY;
  const failed = open && session.startedAt === null && session.fault?.kind === FaultKind.CAPTURE_FAULT && session.fault.fromState === SessionState.RECORDING;
  return failed ? { ...state, session: { ...session, captureDurable: false } } : state;
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
 * The acknowledged switch (operation 81 in real capture): THE SHARED RULE of a switch
 * (`applyAudioSourceSwitch`, review R74-10 - one function for the simulator's own operation 81 and
 * for this one), given the MEDIA time the capture worker acknowledged. Writes no audit row.
 * Returns the same state, and `switched: null`, when the session is not that RECORDING session,
 * it has no source pair, the input is none of its selector snapshot, or it is active already.
 */
export function audioSourceSwitchTransition(state: SimState, now: EpochMs, change: AudioSourceSwitch): { readonly state: SimState; readonly switched: AudioSourceSwitched | null } {
  const session = recordingSessionOf(state, change.sessionId);
  const source = session?.audioSource ?? null;
  const mics = session?.captureConfig?.mics ?? state.captureConfig.mics;
  const mic = mics.find((entry) => entry.inputId === change.toInputId);
  if (session === null || source === null || mic === undefined) return { state, switched: null };
  return applyAudioSourceSwitch(state, now, session, mic.inputId as CaptureMicInputId, change.atMediaMs);
}
