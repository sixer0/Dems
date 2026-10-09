/**
 * `src/sealing` — the steps of the v2 sealing pipeline (evidence package spec §E).
 *
 * Opened by blueprint row 79 with ONE step, `FINALIZE_TRANSCRIPT`, and the journal of a step on
 * `sealing_jobs`. The pipeline itself (the order of the steps, RECOVERY, the session machine's v2
 * seal) is row 82 and is not here yet: nothing in the server calls this unit, and `app.ts` does
 * not register it. A closed unit: imported through this index only.
 */
export * from './step-journal';
export * from './finalize-transcript/contract';
export { CLOSE_OUT_CHUNK_CODE, FINALIZE_TRANSCRIPT_CLOSE_OUT_ATTEMPTS, FINALIZE_TRANSCRIPT_CLOSE_OUT_ATTEMPTS_MAX, FINALIZE_TRANSCRIPT_LIMITS, closeOutAttemptsOf, limitsFault, systemStepTimer, waitLimitOf, type FinalizeTranscriptLimits, type StepTimer } from './finalize-transcript/bounds';
export { FINALIZE_TRANSCRIPT_CHECKPOINT_VERSION, finalizeTranscript } from './finalize-transcript/handler';
export * from './finalize-transcript/commit';
export { createTranscriptFileReader } from './finalize-transcript/files';
export { SPEAKER_LABELS_UNAVAILABLE_FLAG, SealedTranscriptDocumentSchema, readSealedTranscriptDocument, uncommittedSegments, type SealedTranscriptDocument } from './finalize-transcript/document';
