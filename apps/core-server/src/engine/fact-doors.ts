/**
 * The fact doors of the engine host (task 3 integration pass D6), reached beside the seam like the
 * capture doors and the seal doors (`factDoorsOf(app.engine)`), and NOT members of `EngineHost`:
 *
 *   applyStorageVolume       CS-09: the INTERNAL action of the same name (registry entry, execution
 *                            `internal`, no operation). The figures of the evidence volume the
 *                            Core's boot check measured become the figures of slice `storage`.
 *                            Called once after a boot in real capture operation by
 *                            `modules/storage`; never in capture operation SIMULATED.
 *   noteTranscriptRevision   operation 85 "publishes evidence" (C3 §2.3): after its unit committed
 *                            a revision, the item's `transcript` summary of slice `evidence` names
 *                            the new head. Called by `modules/transcripts`.
 *   applyCaptureSourceFacts  integration pass D11 (row 140's findings F-2 and F-5; ux §8f.1,
 *                            §8f.3): what a Core in a REAL capture operation knows of its
 *                            registered sources beyond the stored rows - the adapter kind of a
 *                            device whose row surfaces none (the built-in test sources of a
 *                            development operation) and whether a source is open now
 *                            (`sourceOpen`). The list is the whole truth of the moment. Called
 *                            by `modules/devices` after a boot and whenever a source is opened
 *                            or closed; never in capture operation SIMULATED. The host KEEPS the
 *                            last list and applies it again to every state it rehydrates inside
 *                            the process (a reset, a reload, a resync): no row holds these
 *                            members. A process start (`start('boot')`) begins with no list.
 *
 * Each is one unit with no actor, no permission and no audit row (the rows of a revision are
 * operation 85's own; a volume figure is a measurement). Each resolves true when the state changed;
 * a call that changes nothing sends no statement and does not move the revision of the engine.
 */
import type { CaptureSourceFact, StorageVolumeInput, TranscriptRevisionNote } from '@dems/shared/sim';
import { EngineError } from './errors';
import type { EngineHost, EngineOutcome } from './types';

export interface EngineFactDoors {
  applyStorageVolume(volume: StorageVolumeInput): Promise<EngineOutcome<boolean>>;
  noteTranscriptRevision(note: TranscriptRevisionNote): Promise<EngineOutcome<boolean>>;
  applyCaptureSourceFacts(facts: readonly CaptureSourceFact[]): Promise<EngineOutcome<boolean>>;
}

/** Labels of the three units (a label of the host is `engine.<what it does>`). */
export const FACT_DOOR_LABEL = { storageVolume: 'engine.applyStorageVolume', transcriptRevision: 'engine.noteTranscriptRevision', captureSourceFacts: 'engine.applyCaptureSourceFacts' } as const;

/** Throws `ENGINE_ACTION_NOT_HOSTED` for an engine a test put behind the seam that has none of them. */
export function factDoorsOf(engine: EngineHost): EngineFactDoors {
  const doors = engine as EngineHost & Partial<EngineFactDoors>;
  if (typeof doors.applyStorageVolume !== 'function' || typeof doors.noteTranscriptRevision !== 'function' || typeof doors.applyCaptureSourceFacts !== 'function') {
    throw new EngineError('ENGINE_ACTION_NOT_HOSTED', 'the engine behind the seam is not the host of src/engine: it has no fact doors');
  }
  return doors as EngineHost & EngineFactDoors;
}
