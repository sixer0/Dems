/**
 * The unsealable door of the engine host (task 3 fix pass F-M7b; review row 88 finding R88-02 (c);
 * controller rulings D178 (2), D183), reached beside the seam like the seal doors
 * (`unsealableDoorsOf(app.engine)`), and NOT a member of `EngineHost`:
 *
 *   endSessionUnsealable   THE TERMINAL OUTCOME of a session the Core cannot seal: the session is
 *                          ended as INCOMPLETE with ONE audit row `SESSION_INCOMPLETE`
 *                          (`details.reason: UNSEALABLE` + the named cause) and ONE CRITICAL alert,
 *                          no evidence item is made, and no open session is left - so the Core
 *                          takes the next session. Called by the sealing composition
 *                          (`src/sealing-host`) AFTER it moved the session's recordings to the
 *                          quarantine folder - never by a route, never for a seal that can still
 *                          be tried again.
 *
 * One unit with no actor and no permission check: the caller is the Core itself. Resolves true
 * when the state changed. The transition is the shared session machine's
 * (`endUnsealableTransition`), so Simulated mode and the Core agree. Another session, a session
 * that is not ending, or no session at all is the mapped refusal of a hosted action.
 */
import type { EndUnsealableInput } from '@dems/shared/sim';
import { EngineError } from './errors';
import type { EngineHost, EngineOutcome } from './types';

export interface EngineUnsealableDoors {
  endSessionUnsealable(input: EndUnsealableInput): Promise<EngineOutcome<boolean>>;
}

/** Label of the unit (a label of the host is `engine.<what it does>`). */
export const UNSEALABLE_DOOR_LABEL = { ended: 'engine.endSessionUnsealable' } as const;

/** The unsealable door of the engine behind the seam. Refuses an engine that has none (a test's stub): nothing is ended on it. */
export function unsealableDoorsOf(engine: EngineHost): EngineUnsealableDoors {
  const doors = engine as EngineHost & Partial<EngineUnsealableDoors>;
  if (typeof doors.endSessionUnsealable !== 'function') {
    throw new EngineError('ENGINE_ACTION_NOT_HOSTED', 'the engine behind the seam is not the host of src/engine: it has no unsealable door');
  }
  return doors as EngineHost & EngineUnsealableDoors;
}
