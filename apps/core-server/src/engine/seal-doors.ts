/**
 * The seal doors of the engine host (blueprint row 82; register SH-18, CS-04): the three INTERNAL
 * actions `applySealingProgress`, `completeSeal` and `recordEvidenceVerification`, reached beside
 * the seam like the capture doors. Refuses an engine a test put behind the seam that has none of
 * them: a real package is never sealed on an engine that cannot hold it.
 */
import { EngineError } from './errors';
import type { EngineHost, EngineSealDoors } from './types';

export function sealDoorsOf(engine: EngineHost): EngineSealDoors {
  const doors = engine as EngineHost & Partial<EngineSealDoors>;
  if (typeof doors.applySealingProgress !== 'function' || typeof doors.completeSeal !== 'function' || typeof doors.recordEvidenceVerification !== 'function') {
    throw new EngineError('ENGINE_ACTION_NOT_HOSTED', 'the engine behind the seam is not the host of src/engine: it has no seal doors');
  }
  return doors as EngineHost & EngineSealDoors;
}
