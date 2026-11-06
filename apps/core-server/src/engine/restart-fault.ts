/**
 * The END of the restart fault of a Core in its own capture (fix wave K, driver S1; re-gate 75
 * finding G75c-01, MAJOR; decision D220).
 *
 * WHAT WAS WRONG. `applyProcessStart` raises the fault "The Core was not running while this session
 * was active" (`POWER_FAIL` with `coreNotRunning: true`) for a session that was open when the
 * process stopped. Nothing ended it:
 *   - the simulator ends a `POWER_FAIL` in ONE place, its hosted action `recover`
 *     (`@dems/shared/sim` `actions.ts`: "the reboot that starts recovery restores power");
 *   - a real-capture Core never takes that action for a session with a durable recording: the
 *     capture-session wiring and the sealing pipeline move it FAULT -> FINALIZING -> SEALED through
 *     the engine's own doors (`completeSeal`, `endSessionUnsealable`), and the only clear at a seal
 *     was `clearCaptureFaults`, which is `MIC_SILENT` / `CAPTURE_FAULT` only;
 *   - the fault and its alert are STORED (`faults.active`, the alert row), so every later start
 *     read them back; a start with no session open raises nothing and cleared nothing.
 * So the alert stayed active for ever: through the interrupted seal, a new sealed session, an
 * acknowledgement and a second restart.
 *
 * THE RULE (one sentence). The restart fault is active only WHILE THE SESSION IT WAS RAISED FOR IS
 * STILL OPEN AS THAT FAULTED SESSION: the open session carries the fault itself
 * (`session.fault.coreNotRunning === true`) and is in FAULT, RECOVERY or FINALIZING. In every other
 * state of the engine the thing the fault reports has ended - the session was SEALED, it was closed
 * (no session, or the next session is open), or it ended unsealable - and the fault is cleared with
 * ONE `FAULT_CLEARED` row and its alert resolved.
 *
 * WHY THE SESSION AND NOT "THE CORE IS RUNNING AGAIN". The fault does not say "the Core is down" (a
 * Core that is down says nothing); it says a session was open while the Core was not running, and
 * that the recording of that session ended there. While that session waits for its seal - or its
 * seal is blocked - the statement is still about something open, and the operator's screen should
 * still say why this session is not a plain one. Once the session is sealed (interrupted) or closed
 * there is nothing left that the fault is about. This is the rule gate 75 applied to the capture
 * fault of a killed worker (G75-10 (a): cleared at the seal).
 *
 * WHERE IT RUNS.
 *   `completeSeal`, `endSessionUnsealable` (host.ts)   in the unit that ends the session: the
 *                                                      clear row commits with the seal / the end;
 *   `applyProcessStart` (rehydrate.ts)                 at every process start, AFTER the restart
 *                                                      fault of this start was raised: a stored
 *                                                      fault whose session has ended is cleared.
 *                                                      That is how a database that already holds
 *                                                      the stuck fault heals at its next start,
 *                                                      without a reset.
 * The hosted `recover` keeps the simulator's own clear (a session closed as INCOMPLETE).
 *
 * Pure; idempotent: a state without such a fault is returned as it is, so a second call - or a
 * second start - writes nothing.
 */
import { SessionState } from '@dems/shared/domain';
import { FaultKind, clearFaultAtKey, type SimState } from '@dems/shared/sim';

/** The states in which a session that carries the restart fault is still open as that faulted session. */
export const RESTART_FAULT_OPEN_STATES: readonly string[] = Object.freeze([SessionState.FAULT, SessionState.RECOVERY, SessionState.FINALIZING]);

/** True when the state holds an ACTIVE restart fault of a Core in its own capture. */
export function hasRestartFault(state: SimState): boolean {
  return state.faults.active.some((fault) => fault.kind === FaultKind.POWER_FAIL && fault.coreNotRunning === true);
}

/** True when the session the restart fault was raised for is still open as that faulted session. */
export function restartFaultSessionOpen(state: SimState): boolean {
  const session = state.session;
  return session !== null && session.fault?.kind === FaultKind.POWER_FAIL && session.fault.coreNotRunning === true && RESTART_FAULT_OPEN_STATES.includes(session.state);
}

/**
 * Clears the restart fault whose session has ended (the rule above). Returns the SAME state when
 * there is no such fault or its session is still open.
 */
export function endRestartFaultTransition(state: SimState, now: number): SimState {
  if (!hasRestartFault(state) || restartFaultSessionOpen(state)) return state;
  // The restart fault has no device: its key is (POWER_FAIL, null), and there is one at most.
  return clearFaultAtKey(state, now, FaultKind.POWER_FAIL, null);
}
