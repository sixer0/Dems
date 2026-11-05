/**
 * What the capture of a REAL recording does to the open session (blueprint row 71, Core half;
 * decisions D72(h), D72(k), D84, D91 R-1 option A; contract C3 §3.1 "recording start"; database
 * contract `dbc-4` MR-S1). PURE: state in, state out; no clock, no statement.
 *
 * The engine host runs these inside its own units (`host.ts`, the capture blocks). The five
 * transitions of a capture are the shared simulator's own (re-exported below); what is only the
 * Core's - the rehydrate - is written here. (Audit row W3T, D136: the switch given a media time, op 81 in real
 * capture, is gone with the retired operation; row 149 removed its last caller.)
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
 */
import { SessionState, VIDEO_TRACK_IDS } from '@dems/shared/domain'; // VIDEO_TRACK_IDS: row D2C
import { FaultKind, type SimState } from '@dems/shared/sim';

// THE FIVE TRANSITIONS OF A CAPTURE ARE THE SHARED ONES (fix pass F-M5, review R74-10). Until this
// pass this file held a copy of each, kept equal by a parity test, with one difference: the failed
// start here gave `reason` / `evidenceFiles` to the alert only, because the shared raise did not take
// them yet. It has since pass D6, so the copy had nothing of its own left - and it had begun to
// drift (the words of the alert, once a fault is worded by its reason). They are re-exported: one
// rule, one file (`packages/shared/src/sim/capture-session.ts`).
export { CAPTURE_FAULT_KINDS, FAILED_START_REASON_UNKNOWN, captureConnectingTransition, captureDurableOfSessionTransition, clearCaptureFaultsTransition, failedCaptureStartTransition, interruptedCaptureTransition } from '@dems/shared/sim';

/**
 * Whether a CAMERA file's fragment row of a session is stored: where `captureDurable` comes from after a restart (no
 * column holds it). Row D2C (D150 (2), F-C1D-2): the rows of a channel file (`AUDIO-0N`, row 148 / migration 0044) are
 * not counted - a session whose only rows are channel rows was never durable (only a camera file's fragment makes it so).
 */
export const READ_SESSION_HAS_FRAGMENT = `SELECT 1 AS found FROM public.recording_fragments WHERE session_id = $1 AND track_id IN (${VIDEO_TRACK_IDS.map((id) => `'${id}'`).join(', ')}) LIMIT 1`;

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
