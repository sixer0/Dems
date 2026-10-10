/**
 * The export doors of the engine host (task 3 fix pass F-M8; review findings R93-03 and R93-05,
 * controller ruling D178), reached beside the seam like the seal doors and the fact doors
 * (`exportDoorsOf(app.engine)`), and NOT members of `EngineHost`:
 *
 *   completeEvidenceExport       the COMPLETION of an export whose job ran in the background: the
 *                                item's status `EXPORTED`, its lifecycle stage and the custody
 *                                entry `EXPORTED -> <destination>`. Called by the export jobs
 *                                (`src/evidence-export`) when the archive, its manifest and its
 *                                signature exist - never at request time, never for a failed job.
 *   noteEvidenceExportDownload   a download of a finished archive: one audit row of the export
 *                                type (`EVIDENCE_EXPORTED`, `details.reason: EXPORT_DOWNLOADED`,
 *                                no `exportId`) and one custody entry. Called by the download
 *                                route's handler.
 *
 * Each is one unit with no permission check of its own: the caller is the Core itself, after the
 * request passed the access rule. Each resolves true when the state changed. The transitions are
 * the shared simulator's (`sim/evidence-actions.ts`), so Simulated mode and the Core agree.
 */
import type { EvidenceExportCompletion, EvidenceExportDownloadNote } from '@dems/shared/sim';
import { EngineError } from './errors';
import type { EngineHost, EngineOutcome } from './types';

export interface EngineExportDoors {
  completeEvidenceExport(completion: EvidenceExportCompletion): Promise<EngineOutcome<boolean>>;
  noteEvidenceExportDownload(note: EvidenceExportDownloadNote): Promise<EngineOutcome<boolean>>;
}

/** Labels of the two units (a label of the host is `engine.<what it does>`). */
export const EXPORT_DOOR_LABEL = { completed: 'engine.completeEvidenceExport', downloaded: 'engine.noteEvidenceExportDownload' } as const;

/** The export doors of the engine behind the seam. Refuses an engine that has none (a test's stub): nothing is marked on it. */
export function exportDoorsOf(engine: EngineHost): EngineExportDoors {
  const doors = engine as EngineHost & Partial<EngineExportDoors>;
  if (typeof doors.completeEvidenceExport !== 'function' || typeof doors.noteEvidenceExportDownload !== 'function') {
    throw new EngineError('ENGINE_ACTION_NOT_HOSTED', 'the engine behind the seam is not the host of src/engine: it has no export doors');
  }
  return doors as EngineHost & EngineExportDoors;
}
