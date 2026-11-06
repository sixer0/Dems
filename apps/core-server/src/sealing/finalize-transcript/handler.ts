/**
 * THE HANDLER OF `FINALIZE_TRANSCRIPT` (blueprint row 79 / M6-W4; evidence package spec §E.1 row
 * 3, §E.5, §B.7, §B.7a; transcript spec §D.3; decision D-EV-1; the contract is `contract.ts`).
 *
 * ONE CALL, IN THIS ORDER:
 *
 *   1. THE JOURNAL IS READ FIRST. If the row of this step holds a committed transcript, the call
 *      CONSUMES IT AND COMPUTES NOTHING (tx §D.3 "Idempotence"; ev §E.1 "do not re-run STT"): the
 *      transcriber is asked only where the files are, the three files are hashed, and the hashes
 *      must be the committed ones. Then the committed answer is returned, unchanged. A file that
 *      has another hash is REFUSED (`TRANSCRIPT_HASH_MISMATCH`): the step is FAILED, the
 *      committed checkpoint stays as it is, and nothing is assembled or accepted in its place.
 *
 *   2. STT DISABLED IN THE SESSION'S SNAPSHOT (R-8, D20): the step is DONE at once with
 *      `state: DISABLED`. The transcriber is not asked anything; sealing does not wait. The chunk
 *      rows of the session are read once: a disabled session that HAS rows did transcriber work
 *      it must not have done (tx §B.7 "no VAD, STT or diarization work"). That is written to the
 *      persistent error log; it never stops the seal and never puts a transcript into it.
 *
 *   3. OTHERWISE THE TRANSCRIBER IS ASKED for the assembled transcript — WITHIN BOUNDS (row 116,
 *      `bounds.ts`). One question waits `callLimitMs` at most; the step as a whole waits
 *      `stepLimitMs - closeOutLimitMs` at most, counted in its journal row over every call.
 *        not ready  -> `WAITING` with the chunk counters of the rows; the journal says RUNNING.
 *        no answer  -> the same as not ready: a transcriber that hangs is waited for, not hung on.
 *        the limit  -> THE SEAL STOPS WAITING: the transcriber seam closes the transcript out
 *                      (every chunk not committed is given up, without text) and hands over what
 *                      is committed. It is checked like every assembled transcript, below.
 *        assembled  -> the three files are read and hashed (they must have the recorded hashes),
 *                      the document is read with the Core's own schema, the record must say what
 *                      the document says, the document must be of this session and backend, and
 *                      EVERY SEGMENT MUST BE HELD BY A COMMITTED CHUNK ROW (`document.ts`).
 *      Only then is the answer built and written to the journal as DONE.
 *
 * THE HARD-FAILURE PATH (D-EV-1). Chunks that ended FAILED, or audio that never reached the
 * transcriber, give a document with `state: PARTIAL`. That is a DONE step: the package seals,
 * the manifest says `PARTIAL` with `failedChunks`, and the document holds no text for what is
 * missing. `backendUnreachable` is true when a failed chunk ended because the configured backend
 * could not be reached.
 *
 * THE LAST RESORT (row 119, decision D110): A RECORDING IS NEVER HELD BACK BY TRANSCRIPTION. A
 * call that fails AT the bound — the close-out does not answer, fails or says "not ready", or
 * what it hands over is refused by the checks above — is counted in the journal row of the step
 * (`boundFailures`, with the code of the last one). When the count has reached
 * `limits.closeOutAttempts`, or is one or more and the caller says `sealWithoutTranscript`, THE
 * NEXT CALL asks the transcriber nothing and is DONE: `state: PARTIAL`, NO document (fields 79-91
 * and 94 null, no file, no row of `transcripts`), reason `TRANSCRIPT_UNAVAILABLE_AT_SEAL` in
 * field 121, `failedChunks` = the chunks the session's rows plan (null when there is none or they
 * cannot be read), `backendUnreachable` as the caller knows it. Nothing is written in the place
 * of a transcript, and the state is never `DISABLED`: STT was on. The journal row passes FAILED
 * -> RUNNING -> DONE and its committed checkpoint says how the state was reached (`unavailable`).
 *
 * `failedChunks` COUNTS CHUNKS, NOT ATTEMPTS (pair-77 N-7). The value of the manifest is the
 * document's (the checkpoint file of the session, one state per chunk). The rows of
 * `transcript_chunks` are counted beside it with the attempt rule (`summariseChunkAttempts`); a
 * difference is logged and reported, and the document's value stands: more failed ROWS than
 * failed chunks is what a retried chunk looks like, and it is no reason to stop a seal.
 *
 * A KILL AT ANY POINT LOSES NOTHING AND CHANGES NO HASH. Before the journal says DONE nothing is
 * committed here; the next call asks the transcriber again, whose assembly is idempotent and
 * returns the same bytes. After it, step 1 applies.
 *
 * EVERY REFUSAL AND FAILURE is written to the persistent error log with the session id as its
 * correlation id, marks the step FAILED in the journal with its code, and is thrown. Nothing here
 * logs or stores transcript text, a path or a credential.
 */
import { createHash } from 'node:crypto';
import { MANIFEST_STT_MODEL_PATTERN, TRANSCRIPT_ABSENCE_REASONS, TRANSCRIPT_DISABLED_REASON, TRANSCRIPT_UNAVAILABLE_REASON, transcriptModelFaults } from '@dems/shared/evidence-package';
import { z } from 'zod';
import { describeError } from '../../plugins/logger';
import { summariseChunkAttempts, type ChunkAttempt } from '../../modules/transcript-chunks';
import type { SealingStepRecord, StepCheckpoint } from '../step-journal';
import { CLOSE_OUT_CHUNK_CODE, FINALIZE_TRANSCRIPT_LIMITS, closeOutAttemptsOf, limitsFault, waitLimitOf, withinBound, type BoundedAnswer } from './bounds';
import {
  FINALIZE_TRANSCRIPT_STEP,
  FinalizeTranscriptError,
  FinalizeTranscriptFailure,
  type AssembledTranscriptAnswer,
  type AssembledTranscriptRecord,
  type FinalizeTranscriptInput,
  type FinalizeTranscriptPorts,
  type FinalizeTranscriptResult,
  type FinalizedTranscript,
  type ManifestTranscriptBlock,
  type SttConfigSnapshot,
  type TranscriptFiles,
} from './contract';
import { TRANSCRIPT_DOC_VERSION, readSealedTranscriptDocument, uncommittedSegments, type SealedTranscriptDocument } from './document';

const SOURCE = 'sealing.finalizeTranscript';
const SESSION_ID = /^SES-[0-9]{8}-[0-9]{4}$/;

/** The name of the document inside the package (ev §A.1; manifest field 79; `PackageFile.TRANSCRIPT_JSON` of row 83). */
const PACKAGE_TRANSCRIPT_FILE = 'transcript/transcript.json';
/**
 * Manifest field 121 (ev §B.7a): `DISABLED_BY_CONFIGURATION`, the one constant of the manifest
 * schema (row 83) — not a second copy of the word. Its label for a reader is "transcript disabled
 * by configuration"; verify and the clients show it, the manifest holds the code.
 */
const DISABLED_REASON = TRANSCRIPT_DISABLED_REASON;
/**
 * Manifest field 121 of the last-resort state (row 119, D110): `TRANSCRIPT_UNAVAILABLE_AT_SEAL`,
 * row 83's constant. STT was enabled and no transcript could be sealed.
 */
const UNAVAILABLE_REASON = TRANSCRIPT_UNAVAILABLE_REASON;
/**
 * THE FAILURES OF A CALL AT THE BOUND THAT COUNT TOWARDS THE LAST RESORT: the transcriber did not
 * hand over a transcript this Core may seal. A failure of the Core's own store (`STORE_FAILED`,
 * `JOURNAL_INVALID`) or of the call (`INPUT_INVALID`) never counts: the transcript may be fine.
 */
const COUNTED_AT_THE_BOUND: ReadonlySet<FinalizeTranscriptFailure> = new Set([
  FinalizeTranscriptFailure.TRANSCRIPT_CLOSE_OUT_FAILED,
  FinalizeTranscriptFailure.TRANSCRIPT_HASH_MISMATCH,
  FinalizeTranscriptFailure.TRANSCRIPT_FILE_UNREADABLE,
  FinalizeTranscriptFailure.TRANSCRIPT_DOCUMENT_INVALID,
  FinalizeTranscriptFailure.TRANSCRIPT_RECORD_MISMATCH,
  FinalizeTranscriptFailure.TRANSCRIPT_OF_ANOTHER_SESSION,
  FinalizeTranscriptFailure.TRANSCRIPT_TEXT_NOT_COMMITTED,
]);
/** The form of the committed checkpoint of this step. Another value is refused, never guessed at. */
export const FINALIZE_TRANSCRIPT_CHECKPOINT_VERSION = 'dems.finalize-transcript/1';

/**
 * The failure codes of a chunk that mean "the configured backend could not be reached" (manifest
 * field 122). `UNREACHABLE` on every backend; `TIMEOUT` only for the server backend, where it is
 * a request that got no answer — on `cpu-local` it is the time bound of an engine that did run.
 */
function isUnreachableCode(code: string, backend: SttConfigSnapshot['backend']): boolean {
  return code === 'UNREACHABLE' || (code === 'TIMEOUT' && backend === 'omlx-server');
}

const hex64 = z.string().regex(/^[0-9a-f]{64}$/);
const count = z.number().int().min(0);
const speakerState = z.enum(['LABELLED', 'UNAVAILABLE']);

/** Field 123. `model` is a model identifier in the manifest's own form: nothing else can be sealed there (E-31). */
const SnapshotSchema = z.strictObject({ enabled: z.boolean(), backend: z.enum(['omlx-server', 'cpu-local']), model: z.string().regex(MANIFEST_STT_MODEL_PATTERN), diarization: z.boolean(), revision: z.number().int().min(1) });

const ManifestBlockSchema = z.strictObject({
  file: z.literal(PACKAGE_TRANSCRIPT_FILE).nullable(),
  docVersion: z.literal(TRANSCRIPT_DOC_VERSION).nullable(),
  sha256: hex64.nullable(),
  srtSha256: hex64.nullable(),
  vttSha256: hex64.nullable(),
  model: z.strictObject({ name: z.string().min(1).nullable(), version: z.string().min(1).nullable(), quantisation: z.string().min(1).nullable(), modelSha256: hex64.nullable() }),
  diarization: z.strictObject({ numSpeakers: count.nullable(), status: speakerState.nullable(), confidence: z.number().nullable() }),
  speakerState: speakerState.nullable(),
  state: z.enum(['ASSEMBLED', 'PARTIAL', 'DISABLED']),
  failedChunks: count.nullable(),
  revisionHead: count.nullable(),
  disabledReason: z.enum(TRANSCRIPT_ABSENCE_REASONS).nullable(),
  backendUnreachable: z.boolean(),
  configSnapshot: SnapshotSchema,
});

const ModelParamsSchema = z.strictObject({ backend: z.string().min(1), modelId: z.string().min(1), language: z.string().min(1) });

/**
 * WHAT THE JOURNAL HOLDS OF A COMMITTED STEP (`sealing_jobs.checkpoint`): the whole answer, so a
 * resumed seal rebuilds it without asking anybody. No transcript text, no path, no instant.
 */
const CommittedCheckpointSchema = z.strictObject({
  version: z.literal(FINALIZE_TRANSCRIPT_CHECKPOINT_VERSION),
  committed: z.literal(true),
  manifest: ManifestBlockSchema,
  partialReason: z.enum(['TRANSCRIPT_AUDIO_UNAVAILABLE', 'CHUNKS_FAILED']).nullable(),
  speakerReason: z.string().min(1).nullable(),
  modelParams: ModelParamsSchema.nullable(),
  counters: z.strictObject({ chunks: count, failedChunks: count, segments: count }),
  failedChunksByRows: count.nullable(),
  /** Row 116: written (as true) only when the step reached its waiting limit and closed the transcript out. */
  waitLimitReached: z.literal(true).optional(),
  /** Row 119: written only for the last-resort state — how the step came to seal without a transcript. */
  unavailable: z.strictObject({ by: z.enum(['ATTEMPT_BOUND', 'CALLER']), failures: z.number().int().min(1), lastFailure: z.string().min(1).nullable() }).optional(),
});
type CommittedCheckpoint = z.output<typeof CommittedCheckpointSchema>;

/**
 * WHAT THE JOURNAL HOLDS WHILE THE STEP WAITS (row 116): how long it has waited so far and when
 * it was last seen doing so. A row without these members (written before row 116, or by nobody)
 * has waited nothing.
 */
const WaitStateSchema = z.object({
  committed: z.literal(false),
  waitedMs: count,
  seenAt: count,
  /** Row 119: calls that failed at the bound of the step, and the code of the last one. Absent: none. */
  boundFailures: count.optional(),
  lastBoundFailure: z.string().min(1).optional(),
});

const sha256Hex = (bytes: Uint8Array): string => createHash('sha256').update(bytes).digest('hex');

function toFinalized(sessionId: string, checkpoint: CommittedCheckpoint): FinalizedTranscript {
  const manifest: ManifestTranscriptBlock = checkpoint.manifest;
  const { model, diarization } = manifest;
  // A document is sealed exactly when the block names its file (row 83's rule). Without one the
  // block is a declared absence, and its state and reason must be one of the two that exist.
  const enabled = manifest.file !== null;
  const absence = manifest.state === 'DISABLED' ? manifest.disabledReason === DISABLED_REASON : manifest.state === 'PARTIAL' && manifest.disabledReason === UNAVAILABLE_REASON && manifest.sha256 === null;
  if (!enabled && !absence) throw new FinalizeTranscriptError(FinalizeTranscriptFailure.JOURNAL_INVALID, 'the committed checkpoint of the transcript step names no document and no reason for that', { reason: 'CHECKPOINT_ABSENCE_UNEXPLAINED' });
  if (enabled && manifest.disabledReason !== null) throw new FinalizeTranscriptError(FinalizeTranscriptFailure.JOURNAL_INVALID, 'the committed checkpoint of the transcript step names a document and a reason for its absence', { reason: 'CHECKPOINT_REASON_WITH_DOCUMENT' });
  const complete =
    enabled &&
    manifest.sha256 !== null &&
    manifest.srtSha256 !== null &&
    manifest.vttSha256 !== null &&
    manifest.speakerState !== null &&
    // Fields 84-87 as the backend of the session's snapshot allows them (D160): the name always; version, quantisation and file hash null exactly for a server backend.
    model.name !== null &&
    transcriptModelFaults(manifest.configSnapshot.backend, { name: model.name, version: model.version, quantisation: model.quantisation, sha256: model.modelSha256 }).length === 0 &&
    diarization.numSpeakers !== null &&
    diarization.status !== null &&
    checkpoint.modelParams !== null;
  if (enabled && !complete) throw new FinalizeTranscriptError(FinalizeTranscriptFailure.JOURNAL_INVALID, 'the committed checkpoint of the transcript step is incomplete', { reason: 'CHECKPOINT_INCOMPLETE' });
  return {
    sessionId,
    manifest,
    partialReason: checkpoint.partialReason,
    speakerReason: checkpoint.speakerReason,
    transcriptRow: complete
      ? {
          jsonSha256: manifest.sha256 as string,
          srtSha256: manifest.srtSha256 as string,
          vttSha256: manifest.vttSha256 as string,
          model: { name: model.name as string, version: model.version, quantisation: model.quantisation, modelSha256: model.modelSha256, params: checkpoint.modelParams as NonNullable<CommittedCheckpoint['modelParams']> },
          diarization: { numSpeakers: diarization.numSpeakers as number, status: diarization.status as NonNullable<typeof diarization.status>, confidence: diarization.confidence, reason: checkpoint.speakerReason },
          labelsStatus: manifest.speakerState as NonNullable<typeof manifest.speakerState>,
        }
      : null,
    itemColumns: { manifestVersion: 2, transcriptSha256: manifest.sha256, labelsStatus: manifest.speakerState },
    counters: checkpoint.counters,
    failedChunksByRows: checkpoint.failedChunksByRows,
    waitLimitReached: checkpoint.waitLimitReached === true,
    ...(checkpoint.unavailable === undefined ? {} : { unavailable: checkpoint.unavailable }),
  };
}

/**
 * THE LAST-RESORT BLOCK (row 119, D110): `PARTIAL` without a document. Every member of a document
 * is null; nothing stands in for a transcript. `plannedChunks`: the chunks of the session's rows,
 * none of which has text in the package; null when the plan is not known.
 */
function unavailableCheckpoint(input: { snapshot: SttConfigSnapshot; plannedChunks: number | null; failedChunksByRows: number | null; backendUnreachable: boolean; by: 'ATTEMPT_BOUND' | 'CALLER'; failures: number; lastFailure: string | null }): CommittedCheckpoint {
  return {
    version: FINALIZE_TRANSCRIPT_CHECKPOINT_VERSION,
    committed: true,
    manifest: {
      file: null,
      docVersion: null,
      sha256: null,
      srtSha256: null,
      vttSha256: null,
      model: { name: null, version: null, quantisation: null, modelSha256: null },
      diarization: { numSpeakers: null, status: null, confidence: null },
      speakerState: null,
      state: 'PARTIAL',
      failedChunks: input.plannedChunks,
      revisionHead: null,
      disabledReason: UNAVAILABLE_REASON,
      backendUnreachable: input.backendUnreachable,
      configSnapshot: input.snapshot,
    },
    partialReason: null,
    speakerReason: null,
    modelParams: null,
    counters: { chunks: input.plannedChunks ?? 0, failedChunks: input.plannedChunks ?? 0, segments: 0 },
    failedChunksByRows: input.failedChunksByRows,
    waitLimitReached: true,
    unavailable: { by: input.by, failures: input.failures, lastFailure: input.lastFailure },
  };
}

function disabledCheckpoint(snapshot: SttConfigSnapshot): CommittedCheckpoint {
  return {
    version: FINALIZE_TRANSCRIPT_CHECKPOINT_VERSION,
    committed: true,
    manifest: {
      file: null,
      docVersion: null,
      sha256: null,
      srtSha256: null,
      vttSha256: null,
      model: { name: null, version: null, quantisation: null, modelSha256: null },
      diarization: { numSpeakers: null, status: null, confidence: null },
      speakerState: null,
      state: 'DISABLED',
      failedChunks: null,
      revisionHead: null,
      disabledReason: DISABLED_REASON,
      backendUnreachable: false,
      configSnapshot: snapshot,
    },
    partialReason: null,
    speakerReason: null,
    modelParams: null,
    counters: { chunks: 0, failedChunks: 0, segments: 0 },
    failedChunksByRows: null,
  };
}

function assembledCheckpoint(input: { snapshot: SttConfigSnapshot; record: AssembledTranscriptRecord; document: SealedTranscriptDocument; backendUnreachable: boolean; failedChunksByRows: number; waitLimitReached: boolean }): CommittedCheckpoint {
  const { record, document } = input;
  return {
    version: FINALIZE_TRANSCRIPT_CHECKPOINT_VERSION,
    committed: true,
    manifest: {
      file: PACKAGE_TRANSCRIPT_FILE,
      docVersion: TRANSCRIPT_DOC_VERSION,
      sha256: record.jsonSha256,
      srtSha256: record.srtSha256,
      vttSha256: record.vttSha256,
      model: { name: record.model.name, version: record.model.version, quantisation: record.model.quantisation, modelSha256: record.model.modelSha256 },
      diarization: { numSpeakers: record.diarization.numSpeakers, status: record.diarization.status, confidence: record.diarization.confidence },
      speakerState: record.labelsStatus,
      state: record.state,
      failedChunks: document.header.failed_chunks,
      // No revision exists when a transcript is sealed: revisions are appended to a sealed item (OD-15).
      revisionHead: 0,
      disabledReason: null,
      backendUnreachable: input.backendUnreachable,
      configSnapshot: input.snapshot,
    },
    partialReason: record.partialReason,
    speakerReason: record.diarization.reason,
    modelParams: record.model.params,
    counters: { chunks: document.header.chunks, failedChunks: document.header.failed_chunks, segments: document.segments.length },
    failedChunksByRows: input.failedChunksByRows,
    ...(input.waitLimitReached ? { waitLimitReached: true as const } : {}),
  };
}

/** The members of the record that must say what the document says. Returns the first that does not, or null. */
function recordContradiction(record: AssembledTranscriptRecord, document: SealedTranscriptDocument): string | null {
  const { header } = document;
  const pairs: readonly (readonly [string, unknown, unknown])[] = [
    ['docVersion', record.docVersion, header.doc_version],
    ['state', record.state, header.state],
    ['partialReason', record.partialReason, header.partial_reason],
    ['failedChunks', record.failedChunks, header.failed_chunks],
    ['labelsStatus', record.labelsStatus, document.speaker_state],
    ['diarization.status', record.diarization.status, document.speaker_state],
    ['diarization.reason', record.diarization.reason, header.speaker_reason],
    ['diarization.numSpeakers', record.diarization.numSpeakers, header.diarization.num_speakers],
    ['diarization.confidence', record.diarization.confidence, header.diarization.confidence],
    ['model.name', record.model.name, header.model.name],
    ['model.version', record.model.version, header.model.version],
    ['model.quantisation', record.model.quantisation, header.model.quantisation],
    ['model.modelSha256', record.model.modelSha256, header.model.sha256],
    ['model.params.backend', record.model.params.backend, header.backend],
    ['model.params.modelId', record.model.params.modelId, header.model.id],
    ['model.params.language', record.model.params.language, header.language],
  ];
  return pairs.find(([, stated, written]) => stated !== written)?.[0] ?? null;
}

export async function finalizeTranscript(input: FinalizeTranscriptInput, ports: FinalizeTranscriptPorts): Promise<FinalizeTranscriptResult> {
  const { sessionId, attempt } = input;
  const { journal, log } = ports;

  const logged = (level: 'error' | 'warn', message: string, context: Readonly<Record<string, string | number | boolean | null>>, error?: unknown): void => {
    // `code` of the entry is the code of the STEP; the code of what caused it (an SQLSTATE, a system code) goes beside it.
    const cause = error === undefined ? undefined : describeError(error);
    const stepCode = typeof context['code'] === 'string' ? context['code'] : undefined;
    const sqlState = (error as { sqlState?: unknown } | undefined)?.sqlState;
    const entryContext: Record<string, string | number | boolean | null> = { correlationId: sessionId, sessionId, attempt, ...context };
    if (cause?.code !== undefined && cause.code !== stepCode) entryContext['causeCode'] = cause.code;
    if (typeof sqlState === 'string') entryContext['sqlState'] = sqlState;
    log.append({ level, source: SOURCE, message, ...cause, ...(stepCode === undefined ? {} : { code: stepCode }), context: entryContext });
  };

  const snapshot = SnapshotSchema.safeParse(input.sttSnapshot);
  const limits = input.limits ?? FINALIZE_TRANSCRIPT_LIMITS;
  const limitsRefused = limitsFault(limits);
  if (!SESSION_ID.test(sessionId) || !Number.isInteger(attempt) || attempt < 1 || !snapshot.success || limitsRefused !== null) {
    const error = new FinalizeTranscriptError(FinalizeTranscriptFailure.INPUT_INVALID, 'the transcript step was called with a malformed input', { reason: !snapshot.success ? 'SNAPSHOT' : limitsRefused !== null ? `LIMITS_${limitsRefused}` : 'SESSION_OR_ATTEMPT' });
    log.append({ level: 'error', source: SOURCE, message: error.message, code: error.code, ...describeError(error), context: { reason: String(error.detail['reason']) } });
    throw error;
  }

  /**
   * What a FAILED write of this call keeps in the journal row: the committed transcript of a
   * resumed step, or how long a step that is not committed has waited (a failure never refills
   * the waiting budget).
   */
  let committed: StepCheckpoint | null = null;
  /**
   * Row 119: true once this call has reached the bound of the step; the calls that failed there so
   * far (from the journal row), and the code of the last one. Counted by `fail`, kept by every
   * write of the wait state, and what the last resort is decided on.
   */
  let atBound = false;
  let boundFailures = 0;
  let lastBoundFailure: string | null = null;
  const carried = (): Readonly<Record<string, string | number>> => (boundFailures === 0 ? {} : { boundFailures, ...(lastBoundFailure === null ? {} : { lastBoundFailure }) });

  const writeJournal = async (status: 'RUNNING' | 'DONE' | 'FAILED', progress: number, checkpoint: StepCheckpoint | null, errorCode: string | null, at: number = ports.now()): Promise<void> => {
    await journal.write({ sessionId, step: FINALIZE_TRANSCRIPT_STEP, status, progress, etaMs: null, attempt, checkpoint, errorCode, at });
  };

  /** Logs, marks the step FAILED (keeping a committed checkpoint), and returns the error to throw. */
  const fail = async (code: FinalizeTranscriptFailure, message: string, detail: Readonly<Record<string, string | number | boolean | null>> = {}, cause?: unknown): Promise<FinalizeTranscriptError> => {
    const error = new FinalizeTranscriptError(code, message, detail, cause);
    // A failure at the bound counts towards the last resort, and the count is in the row this writes.
    if (atBound && COUNTED_AT_THE_BOUND.has(code) && committed?.['committed'] === false) {
      boundFailures += 1;
      lastBoundFailure = code;
      committed = { ...committed, ...carried() };
    }
    logged('error', message, { code, ...detail, ...(atBound ? { boundFailures } : {}) }, cause ?? error);
    try {
      await writeJournal('FAILED', 0, committed, code);
    } catch (journalError) {
      logged('error', 'the failed transcript step could not be written to the journal', { code: FinalizeTranscriptFailure.STORE_FAILED, failedWith: code }, journalError);
    }
    return error;
  };

  const store = async <T>(what: string, run: () => Promise<T>): Promise<T> => {
    try {
      return await run();
    } catch (error) {
      if (error instanceof FinalizeTranscriptError) throw error;
      const failure = new FinalizeTranscriptError(FinalizeTranscriptFailure.STORE_FAILED, 'the transcript step could not read or write its store', { what }, error);
      logged('error', failure.message, { code: failure.code, what }, error);
      throw failure;
    }
  };

  /** Reads and hashes the three files. A file that cannot be read fails the step. */
  const hashFiles = async (files: TranscriptFiles): Promise<{ json: Uint8Array; hashes: { json: string; srt: string; vtt: string } }> => {
    const read = async (kind: 'json' | 'srt' | 'vtt'): Promise<Uint8Array> => {
      try {
        return await ports.files.read(files[kind]);
      } catch (error) {
        throw await fail(FinalizeTranscriptFailure.TRANSCRIPT_FILE_UNREADABLE, 'a transcript file could not be read', { file: kind }, error);
      }
    };
    const json = await read('json');
    const srt = await read('srt');
    const vtt = await read('vtt');
    return { json, hashes: { json: sha256Hex(json), srt: sha256Hex(srt), vtt: sha256Hex(vtt) } };
  };

  const firstMismatch = (hashes: { json: string; srt: string; vtt: string }, expected: { json: string; srt: string; vtt: string }): string | null => (['json', 'srt', 'vtt'] as const).find((kind) => hashes[kind] !== expected[kind]) ?? null;

  // ── 1. The journal first: a committed transcript is consumed, never computed again. ─────────
  const prior: SealingStepRecord | null = await store('journal.read', () => journal.read(sessionId, FINALIZE_TRANSCRIPT_STEP));
  const priorCommitted = prior?.checkpoint?.['committed'] === true;
  if (prior !== null && (priorCommitted || prior.status === 'DONE')) {
    const parsed = CommittedCheckpointSchema.safeParse(prior.checkpoint);
    // A DONE row this step cannot read is never recomputed over: what was committed is unknown.
    if (!parsed.success) throw await fail(FinalizeTranscriptFailure.JOURNAL_INVALID, 'the journal row of the transcript step is not a committed checkpoint of this form', { reason: 'CHECKPOINT_FORM_UNKNOWN', status: prior.status });
    committed = prior.checkpoint;
    const checkpoint = parsed.data;
    const sameSnapshot = (Object.keys(snapshot.data) as (keyof SttConfigSnapshot)[]).every((key) => checkpoint.manifest.configSnapshot[key] === snapshot.data[key]);
    if (!sameSnapshot) throw await fail(FinalizeTranscriptFailure.INPUT_INVALID, 'the snapshot of the session is not the one the committed transcript step was given', { reason: 'SNAPSHOT_CHANGED' });
    let transcript: FinalizedTranscript;
    try {
      transcript = toFinalized(sessionId, checkpoint);
    } catch (error) {
      // A committed row that cannot be an answer is refused like every other: logged, and marked FAILED with the row kept.
      if (error instanceof FinalizeTranscriptError) throw await fail(error.code, error.message, error.detail);
      throw error;
    }
    let files: TranscriptFiles | null = null;
    if (transcript.transcriptRow !== null) {
      files = ports.transcript.locate(sessionId);
      const { hashes } = await hashFiles(files);
      const mismatch = firstMismatch(hashes, { json: transcript.transcriptRow.jsonSha256, srt: transcript.transcriptRow.srtSha256, vtt: transcript.transcriptRow.vttSha256 });
      if (mismatch !== null) throw await fail(FinalizeTranscriptFailure.TRANSCRIPT_HASH_MISMATCH, 'a transcript file does not have the hash this step committed', { file: mismatch, against: 'COMMITTED' });
    }
    // A step that was marked FAILED by a refusal and now verifies again is DONE again, with the SAME checkpoint.
    if (prior.status !== 'DONE' || prior.attempt !== attempt) await store('journal.write', () => writeJournal('DONE', 100, prior.checkpoint, null));
    return { status: 'DONE', transcript, files, resumed: true };
  }

  const commit = async (checkpoint: CommittedCheckpoint, files: TranscriptFiles | null): Promise<FinalizeTranscriptResult> => {
    const transcript = toFinalized(sessionId, checkpoint);
    await store('journal.write', () => writeJournal('DONE', 100, checkpoint, null));
    return { status: 'DONE', transcript, files, resumed: false };
  };

  // ── 2. Disabled by the session's configuration: a declared absence, at once. ────────────────
  if (!snapshot.data.enabled) {
    // DETECTION ONLY. The seal of a disabled session neither waits for this read nor fails on it.
    try {
      const found = await ports.chunkRows.read(sessionId);
      if (found.length > 0) {
        logged('error', 'a session whose STT snapshot is disabled has transcript chunk rows: transcriber work ran for it; the seal records DISABLED and holds no transcript', { reason: 'DISABLED_SESSION_HAS_CHUNK_ROWS', rows: found.length });
      }
    } catch (error) {
      logged('warn', 'the chunk rows of a disabled session could not be read; the seal records DISABLED without that check', { reason: 'DISABLED_SESSION_NOT_CHECKED' }, error);
    }
    return commit(disabledCheckpoint(snapshot.data), null);
  }

  // ── 3. The assembled transcript, within the bounds of the step. ─────────────────────────────
  const waitLimitMs = waitLimitOf(limits);
  const priorWait = WaitStateSchema.safeParse(prior?.checkpoint);
  let seenAt = ports.now();
  // The time since the step was last seen waiting counts, up to one question's bound (`bounds.ts`).
  let waitedMs = priorWait.success ? priorWait.data.waitedMs + Math.min(limits.callLimitMs, Math.max(0, seenAt - priorWait.data.seenAt)) : 0;
  if (priorWait.success) {
    boundFailures = priorWait.data.boundFailures ?? 0;
    lastBoundFailure = priorWait.data.lastBoundFailure ?? null;
  }
  /** Counts the time that passed inside this call, and returns what the journal row holds of the wait. */
  const waitState = (extra: Readonly<Record<string, number>> = {}): StepCheckpoint => {
    const at = ports.now();
    waitedMs += Math.max(0, at - seenAt);
    seenAt = at;
    committed = { committed: false, waitedMs, seenAt, ...carried(), ...extra };
    return committed;
  };

  // ONE instant for the start of this call: what the wait is counted from and what the row is written at.
  committed = { committed: false, waitedMs, seenAt, ...carried() };
  const startOfCall = committed;
  await store('journal.write', () => writeJournal('RUNNING', prior?.status === 'RUNNING' ? prior.progress : 0, startOfCall, null, seenAt));

  let answer: AssembledTranscriptAnswer | null = null;
  if (waitedMs < waitLimitMs) {
    let asked: BoundedAnswer<AssembledTranscriptAnswer>;
    try {
      asked = await withinBound(ports.timer, Math.min(limits.callLimitMs, waitLimitMs - waitedMs), (signal) => ports.transcript.assemble(sessionId, { signal }));
    } catch (error) {
      waitState();
      throw await fail(FinalizeTranscriptFailure.TRANSCRIBER_FAILED, 'the transcriber could not hand over the transcript', {}, error);
    }
    waitState();
    if (asked.kind === 'ANSWER') answer = asked.value;
    else logged('warn', 'the transcriber did not answer within the bound of one question; the step goes on waiting within its own bound', { reason: 'ASSEMBLE_NO_ANSWER', waitedMs, waitLimitMs });
  }

  let waitLimitReached = false;
  if (answer === null || answer.kind === 'NOT_READY') {
    if (waitedMs < waitLimitMs) {
      const waiting = summariseChunkAttempts(await store('chunkRows.read', () => ports.chunkRows.read(sessionId)));
      const finished = waiting.done + waiting.failed;
      const progress = waiting.total === 0 ? 0 : Math.min(99, Math.floor((finished * 100) / waiting.total));
      const counters = { chunksTotal: waiting.total, chunksDone: waiting.done, chunksFailed: waiting.failed };
      await store('journal.write', () => writeJournal('RUNNING', progress, waitState(counters), null));
      return { status: 'WAITING', progress, counters, remainingWaitMs: Math.max(1, waitLimitMs - waitedMs) };
    }

    // THE BOUND OF THE STEP (D-EV-1): sealing does not wait any longer. What is committed is sealed.
    waitLimitReached = true;
    atBound = true;

    // THE LAST RESORT (row 119, D110): the step failed at this bound before, often enough or with
    // the caller's word. It asks the transcriber nothing more: the recording seals without a transcript.
    const lastResort = boundFailures >= closeOutAttemptsOf(limits) ? 'ATTEMPT_BOUND' : input.sealWithoutTranscript === true && boundFailures >= 1 ? 'CALLER' : null;
    if (lastResort !== null) {
      let plannedChunks: number | null = null;
      let failedChunksByRows: number | null = null;
      try {
        const planned = summariseChunkAttempts(await ports.chunkRows.read(sessionId));
        // No row: the plan is not known to the Core, and nothing is counted.
        if (planned.total > 0) {
          plannedChunks = planned.total;
          failedChunksByRows = planned.failed;
        }
      } catch (error) {
        logged('warn', 'the chunk rows of the session could not be read; the seal records the failed-chunk count as unknown', { reason: 'PLANNED_CHUNKS_NOT_READ' }, error);
      }
      waitState();
      logged('error', 'no transcript could be handed over at the bound of the transcript step; the package is sealed PARTIAL without a transcript document', {
        code: UNAVAILABLE_REASON,
        reason: lastResort,
        boundFailures,
        lastBoundFailure,
        plannedChunks,
        waitedMs,
        backend: snapshot.data.backend,
      });
      return commit(unavailableCheckpoint({ snapshot: snapshot.data, plannedChunks, failedChunksByRows, backendUnreachable: input.backendUnreachable === true, by: lastResort, failures: boundFailures, lastFailure: lastBoundFailure }), null);
    }

    logged('warn', 'the transcript step reached its waiting limit; the transcript is closed out and sealed with what is committed', { reason: 'WAIT_LIMIT_REACHED', waitedMs, waitLimitMs, backend: snapshot.data.backend });
    let closed: BoundedAnswer<AssembledTranscriptAnswer>;
    try {
      closed = await withinBound(ports.timer, limits.closeOutLimitMs, (signal) => ports.transcript.closeOut(sessionId, { signal, chunkCode: CLOSE_OUT_CHUNK_CODE }));
    } catch (error) {
      waitState();
      throw await fail(FinalizeTranscriptFailure.TRANSCRIPT_CLOSE_OUT_FAILED, 'the transcript could not be closed out at the waiting limit of the step', { reason: 'CLOSE_OUT_THREW' }, error);
    }
    waitState();
    if (closed.kind === 'NO_ANSWER' || closed.value.kind === 'NOT_READY') {
      throw await fail(FinalizeTranscriptFailure.TRANSCRIPT_CLOSE_OUT_FAILED, 'the transcript could not be closed out at the waiting limit of the step', { reason: closed.kind === 'NO_ANSWER' ? 'CLOSE_OUT_NO_ANSWER' : 'CLOSE_OUT_NOT_READY' });
    }
    answer = closed.value;
  }

  const rows: readonly ChunkAttempt[] = await store('chunkRows.read', () => ports.chunkRows.read(sessionId));
  const attempts = summariseChunkAttempts(rows);
  const { record, files } = answer;
  const { json, hashes } = await hashFiles(files);
  const mismatch = firstMismatch(hashes, { json: record.jsonSha256, srt: record.srtSha256, vtt: record.vttSha256 });
  if (mismatch !== null) throw await fail(FinalizeTranscriptFailure.TRANSCRIPT_HASH_MISMATCH, 'a transcript file does not have the hash the transcriber recorded', { file: mismatch, against: 'RECORD' });

  const document = readSealedTranscriptDocument(json);
  if (document === null) throw await fail(FinalizeTranscriptFailure.TRANSCRIPT_DOCUMENT_INVALID, 'the transcript file is not a transcript document of the sealed form');

  const contradiction = recordContradiction(record, document);
  if (contradiction !== null) throw await fail(FinalizeTranscriptFailure.TRANSCRIPT_RECORD_MISMATCH, 'the transcript record does not say what its document says', { member: contradiction });
  if (answer.failedChunkCodes.length !== document.header.failed_chunks) {
    throw await fail(FinalizeTranscriptFailure.TRANSCRIPT_RECORD_MISMATCH, 'the failure codes handed over are not one per failed chunk', { member: 'failedChunkCodes', codes: answer.failedChunkCodes.length, failedChunks: document.header.failed_chunks });
  }
  if (document.header.session_id !== sessionId) throw await fail(FinalizeTranscriptFailure.TRANSCRIPT_OF_ANOTHER_SESSION, 'the transcript document belongs to another session', { reason: 'SESSION' });
  if (document.header.backend !== snapshot.data.backend) throw await fail(FinalizeTranscriptFailure.TRANSCRIPT_OF_ANOTHER_SESSION, 'the transcript document was made with another backend than the session was started with', { reason: 'BACKEND' });

  // NO TEXT WITHOUT A COMMITTED CHUNK (D-EV-1): a failed chunk has no text, and nothing stands in for it.
  const uncommitted = uncommittedSegments(document, rows);
  if (uncommitted.length > 0) {
    throw await fail(FinalizeTranscriptFailure.TRANSCRIPT_TEXT_NOT_COMMITTED, 'the transcript document holds text that no committed chunk row of the session holds', { segments: uncommitted.length, firstSegment: uncommitted[0] ?? null, doneRows: attempts.done });
  }

  if (attempts.failed !== document.header.failed_chunks) {
    logged('warn', 'the chunk rows and the transcript document count another number of failed chunks; the document stands', { reason: 'FAILED_CHUNK_COUNT_DIFFERS', byDocument: document.header.failed_chunks, byRows: attempts.failed, failedRows: attempts.failedRows });
  }

  const backendUnreachable = answer.failedChunkCodes.some((code) => isUnreachableCode(code, snapshot.data.backend));
  return commit(assembledCheckpoint({ snapshot: snapshot.data, record, document, backendUnreachable, failedChunksByRows: attempts.failed, waitLimitReached }), files);
}
