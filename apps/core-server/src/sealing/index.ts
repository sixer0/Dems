/**
 * `src/sealing` — the steps of the v2 sealing pipeline (evidence package spec §E).
 *
 * Opened by blueprint row 79 with ONE step, `FINALIZE_TRANSCRIPT`, and the journal of a step on
 * `sealing_jobs`. Row 82 added the pipeline (`pipeline/`): the six steps in order, their
 * checkpoints and resume rules, the tail validation at CLOSE_TRACKS, the interrupted
 * durable-prefix seal, and the controller that holds one run per session and reaches the engine's
 * INTERNAL sealing actions. The unit registers no route and `app.ts` does not register it: the
 * composition that hands in the ports is listed in the row's note. A closed unit: imported
 * through this index only.
 */
export * from './step-journal';
export * from './finalize-transcript/contract';
export { CLOSE_OUT_CHUNK_CODE, FINALIZE_TRANSCRIPT_CLOSE_OUT_ATTEMPTS, FINALIZE_TRANSCRIPT_CLOSE_OUT_ATTEMPTS_MAX, FINALIZE_TRANSCRIPT_LIMITS, closeOutAttemptsOf, limitsFault, systemStepTimer, waitLimitOf, type FinalizeTranscriptLimits, type StepTimer } from './finalize-transcript/bounds';
export { FINALIZE_TRANSCRIPT_CHECKPOINT_VERSION, finalizeTranscript } from './finalize-transcript/handler';
export * from './finalize-transcript/commit';
export { createTranscriptFileReader } from './finalize-transcript/files';
export { SPEAKER_LABELS_UNAVAILABLE_FLAG, SealedTranscriptDocumentSchema, readSealedTranscriptDocument, uncommittedSegments, type SealedTranscriptDocument } from './finalize-transcript/document';
export * from './pipeline/contract';
export { SEALING_PROGRESS_INTERVAL_MS, TRANSCRIPT_POLL_MS, TRANSCRIPT_RETRIES_PER_RUN, createSealingPipeline } from './pipeline/pipeline';
export * from './pipeline/controller';
export * from './signing';
export { durableMediaOnDisk, listPackageFiles, wholeFragmentsOnDisk } from './pipeline/camera-files';
