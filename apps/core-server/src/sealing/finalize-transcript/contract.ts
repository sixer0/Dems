/**
 * THE CONTRACT OF THE SEALING STEP `FINALIZE_TRANSCRIPT` (blueprint row 79 / M6-W4; evidence
 * package spec §E.1, §E.5, §B.7, §B.7a; transcript spec §D.3, §A.5; decision D-EV-1).
 *
 * WHAT THE STEP IS. The third step of the v2 seal. It CONSUMES the machine transcript the
 * transcriber assembled and hashed and turns it into what the rest of the seal needs: the
 * transcript block of the manifest, the row of `transcripts`, the three item columns and the two
 * counters. It runs no speech recognition, writes no transcript text and never changes a
 * committed transcript.
 *
 * WHO CALLS IT. The sealing pipeline of row 82, once per attempt, until the answer is `DONE`.
 * Nothing calls it yet; it is tested directly. Everything outside this folder reaches it through
 * the PORTS below, so the step needs no transcriber package, no pool and no clock of its own.
 *
 * THE THREE ANSWERS.
 *   WAITING  STT is enabled and the transcript is not assembled yet (a chunk is still to decode).
 *            Sealing waits (D223); the caller asks again — within the bounds of `bounds.ts`
 *            (row 116): once the step has waited its limit it closes the transcript out and is
 *            DONE with `PARTIAL`. The step never waits for ever.
 *   DONE     The transcript is consumed: `ASSEMBLED`, `PARTIAL` or `DISABLED`. A hard STT failure
 *            is DONE with `PARTIAL` (D-EV-1), never a failed step. LAST RESORT (row 119, D110):
 *            when the step keeps failing at its bound, it is DONE with `PARTIAL` and NO transcript
 *            document (`TRANSCRIPT_UNAVAILABLE_AT_SEAL`) — the recording seals without one.
 *   (throw)  `FinalizeTranscriptError`: what was handed over is not a transcript this Core may
 *            seal — the file does not have the recorded hash, text that no committed chunk holds,
 *            a record that contradicts its document. The step is FAILED and nothing is consumed.
 *
 * SINGLE SOURCE TYPES (agreed by contract with row 83, not copied):
 *   the manifest block   `ManifestV2Input['transcript']` of `@dems/shared/evidence-package`
 *   the slice summary    `EvidenceItemBody['transcript']` of `@dems/shared/api`
 * This folder defines neither; a test builds a whole manifest through row 83's builder with the
 * block this step returns.
 */
import type { ManifestV2Input } from '@dems/shared/evidence-package';
import type { ErrorLog } from '../../plugins/logger';
import type { ChunkAttempt } from '../../modules/transcript-chunks';
import type { SealingStepJournal } from '../step-journal';
import type { FinalizeTranscriptLimits, StepTimer } from './bounds';

/** The step id (SH-01 `FinalizationStep`; `sealing_jobs.step`). */
export const FINALIZE_TRANSCRIPT_STEP = 'FINALIZE_TRANSCRIPT';

/** Manifest fields 79-94 and 121-123 (ev §B.7, §B.7a). Row 83's type; never redefined here. */
export type ManifestTranscriptBlock = ManifestV2Input['transcript'];

/** Manifest field 123: the STT configuration of the session, as snapshotted at its start (row 115). */
export type SttConfigSnapshot = ManifestTranscriptBlock['configSnapshot'];

export type SpeakerStateValue = 'LABELLED' | 'UNAVAILABLE';
export type PartialReasonValue = 'TRANSCRIPT_AUDIO_UNAVAILABLE' | 'CHUNKS_FAILED';

/**
 * What the transcriber hands over for an assembled transcript: member for member the
 * `TranscriptSealRecord` of `@dems/transcriber` (`pipeline/document.ts`). Declared here because
 * the Core does not import the transcriber in production code; a test of this folder assigns the
 * real record to this type, so a change on either side stops the type check.
 */
export interface AssembledTranscriptRecord {
  readonly docVersion: 'dems.transcript/1';
  readonly jsonSha256: string;
  readonly srtSha256: string;
  readonly vttSha256: string;
  readonly model: {
    readonly name: string;
    readonly version: string;
    readonly quantisation: string;
    readonly modelSha256: string;
    readonly params: { readonly backend: string; readonly modelId: string; readonly language: string };
  };
  readonly diarization: { readonly numSpeakers: number; readonly status: SpeakerStateValue; readonly confidence: number | null; readonly reason: string | null };
  readonly labelsStatus: SpeakerStateValue;
  readonly state: 'ASSEMBLED' | 'PARTIAL';
  readonly partialReason: PartialReasonValue | null;
  readonly failedChunks: number;
}

/** The three files of an assembled transcript in the session scratch directory. Absolute. */
export interface TranscriptFiles {
  readonly json: string;
  readonly srt: string;
  readonly vtt: string;
}

export type AssembledTranscriptAnswer =
  /** A chunk is still PENDING or RUNNING, or the plan does not cover the whole audio yet. */
  | { readonly kind: 'NOT_READY' }
  | {
      readonly kind: 'ASSEMBLED';
      readonly record: AssembledTranscriptRecord;
      readonly files: TranscriptFiles;
      /**
       * The typed failure code of every chunk that ended FAILED, one entry per failed CHUNK (the
       * `errorCode` of the transcriber's checkpoint). Its length is `record.failedChunks`.
       */
      readonly failedChunkCodes: readonly string[];
    };

/**
 * THE TRANSCRIBER SEAM. Row 115 / row 82 implement it on `@dems/transcriber`:
 *
 *   assemble  `assembleTranscript(...)`; its `ASSEMBLY_REFUSED` with reason
 *             `TRANSCRIPT_NOT_COMPLETE` is `NOT_READY`; any other failure is thrown.
 *             It MUST be idempotent and MUST NOT compute an assembled transcript again
 *             (tx §D.3) — `assembleTranscript` is both.
 *   locate    where the three files of the session are. Computes nothing and starts nothing:
 *             this is all a resumed seal asks of the transcriber.
 *   closeOut  (row 116) THE SEAL STOPS WAITING. Every chunk of the session that is not committed
 *             is given up by the transcriber's own rule — FAILED, WITHOUT TEXT, with `chunkCode`
 *             as its failure code, its row mirrored like every failed chunk — the plan is ended,
 *             and the transcript is assembled from the committed chunks only. It decodes
 *             nothing, asks no backend and makes up no text. On a transcript that is already
 *             complete it is `assemble`. Idempotent. `NOT_READY` or a failure here fails the
 *             step: there is nothing left to wait for.
 *
 * Both questions are given a signal that is aborted when the step stops waiting for the answer;
 * an answer that comes after that is dropped by the step.
 */
export interface SeamCallOptions {
  readonly signal: AbortSignal;
}

export interface AssembledTranscriptSource {
  assemble(sessionId: string, options?: SeamCallOptions): Promise<AssembledTranscriptAnswer>;
  locate(sessionId: string): TranscriptFiles;
  closeOut(sessionId: string, options: SeamCallOptions & { readonly chunkCode: string }): Promise<AssembledTranscriptAnswer>;
}

/** Reads one file whole. The step hashes what it is given; it never writes a transcript file. */
export interface TranscriptFileReader {
  read(path: string): Promise<Uint8Array>;
}

/** The rows of `transcript_chunks` of one session (`createTranscriptChunkStore(...).read`). */
export interface ChunkRowReader {
  read(sessionId: string): Promise<readonly ChunkAttempt[]>;
}

export interface FinalizeTranscriptInput {
  readonly sessionId: string;
  /** The session's own snapshot, never the configuration as it is now (R-8; ev §B.7a). */
  readonly sttSnapshot: SttConfigSnapshot;
  /** The attempt of the seal this call belongs to: 1, and one more for every RECOVERY resume. */
  readonly attempt: number;
  /** The bounds of the step (row 116). Absent: `FINALIZE_TRANSCRIPT_LIMITS` of `bounds.ts`. */
  readonly limits?: FinalizeTranscriptLimits;
  /**
   * THE CALLER GIVES THE TRANSCRIPT UP (row 119, D110). Honoured ONLY when the step is at its
   * waiting limit AND its journal row counts one or more failed calls at that limit: then this
   * call asks the transcriber nothing and is DONE without a transcript document. In every other
   * situation it changes nothing — a caller cannot use it to skip a transcript that can be had.
   * Without it the same happens by itself after `limits.closeOutAttempts` failures.
   */
  readonly sealWithoutTranscript?: boolean;
  /**
   * What the caller KNOWS of the backend when no transcript can be sealed (manifest field 122 of
   * the last-resort state only): true when the configured backend could not be reached for this
   * session. Absent or false: not known to have been unreachable. Read in no other situation —
   * with a document, field 122 comes from the failure codes of its chunks.
   */
  readonly backendUnreachable?: boolean;
}

export interface FinalizeTranscriptPorts {
  readonly transcript: AssembledTranscriptSource;
  readonly chunkRows: ChunkRowReader;
  readonly files: TranscriptFileReader;
  readonly journal: SealingStepJournal;
  /** The persistent error log of the Core. Every refusal and every failure of the step is written to it. */
  readonly log: ErrorLog;
  /** Epoch milliseconds: the Core instant of a journal write, and the clock the bounds are counted on. */
  readonly now: () => number;
  /** The clock of a bound (`systemStepTimer` in production). */
  readonly timer: StepTimer;
}

/** The row of `transcripts`, without the key and the instant the committing unit of work adds. */
export interface SealedTranscriptRow {
  readonly jsonSha256: string;
  readonly srtSha256: string;
  readonly vttSha256: string;
  readonly model: AssembledTranscriptRecord['model'];
  readonly diarization: AssembledTranscriptRecord['diarization'];
  readonly labelsStatus: SpeakerStateValue;
}

/**
 * The three sealed columns of `evidence_items` (dbc-3 §B.11). The runtime role has no UPDATE on
 * them: they are written by the INSERT of the item, in the unit of work that also commits the
 * transcript row (`commitSealedTranscript`).
 */
export interface SealedItemColumns {
  readonly manifestVersion: 2;
  readonly transcriptSha256: string | null;
  readonly labelsStatus: SpeakerStateValue | null;
}

export interface TranscriptCounters {
  /** Chunks of the transcript (audio ranges, not attempts). */
  readonly chunks: number;
  readonly failedChunks: number;
  readonly segments: number;
}

/** A consumed transcript: everything the later steps of the seal need of it. No transcript text. */
export interface FinalizedTranscript {
  readonly sessionId: string;
  /** The transcript block of the manifest, as `BUILD_MANIFEST` places it (ev §B.7, §B.7a). */
  readonly manifest: ManifestTranscriptBlock;
  /** Why the transcript is PARTIAL; null for ASSEMBLED and DISABLED. Not a manifest field. */
  readonly partialReason: PartialReasonValue | null;
  /** Why the speakers are not labelled; null when they are, and when the transcript is disabled. */
  readonly speakerReason: string | null;
  /** Null when no transcript document is sealed (disabled, or unavailable at the seal): no row is written. */
  readonly transcriptRow: SealedTranscriptRow | null;
  readonly itemColumns: SealedItemColumns;
  readonly counters: TranscriptCounters;
  /**
   * What the rows of `transcript_chunks` say about failed chunks, counted by the attempt rule
   * (pair-77 N-7). The manifest carries the count of the document; the two are reported side by
   * side and a difference is logged. Null when the transcript is disabled.
   */
  readonly failedChunksByRows: number | null;
  /**
   * True when the step reached its waiting limit and closed the transcript out (row 116). Not a
   * manifest field: the manifest says `PARTIAL`, `failedChunks` and `backendUnreachable`.
   */
  readonly waitLimitReached: boolean;
  /**
   * Present ONLY for the last-resort state (row 119, D110): the package seals `PARTIAL` without a
   * transcript document. `by`: the attempt bound was reached, or the caller gave the transcript
   * up. `failures`: calls of the step that failed at its bound; `lastFailure`: the code of the
   * last one. Not manifest fields: the manifest says `PARTIAL` and `TRANSCRIPT_UNAVAILABLE_AT_SEAL`.
   */
  readonly unavailable?: { readonly by: 'ATTEMPT_BOUND' | 'CALLER'; readonly failures: number; readonly lastFailure: string | null };
}

export type FinalizeTranscriptResult =
  | {
      readonly status: 'WAITING';
      /** 0..99: finished chunks of the chunks that exist so far. Never 100 before the step is DONE. */
      readonly progress: number;
      readonly counters: { readonly chunksTotal: number; readonly chunksDone: number; readonly chunksFailed: number };
      /** How much longer the step waits before it closes the transcript out. Ask again no later than this (> 0). */
      readonly remainingWaitMs: number;
    }
  | {
      readonly status: 'DONE';
      readonly transcript: FinalizedTranscript;
      /** The source files of the package's `transcript/` folder; null when no document is sealed (disabled, or unavailable at the seal). */
      readonly files: TranscriptFiles | null;
      /** True when the step was already committed and this call only read it back. */
      readonly resumed: boolean;
    };

export const FinalizeTranscriptFailure = {
  /** The call itself is malformed: not a session id, not an attempt number. */
  INPUT_INVALID: 'INPUT_INVALID',
  /** A transcript file does not have the hash the transcriber recorded, or the hash this step committed. */
  TRANSCRIPT_HASH_MISMATCH: 'TRANSCRIPT_HASH_MISMATCH',
  /** A transcript file cannot be read. */
  TRANSCRIPT_FILE_UNREADABLE: 'TRANSCRIPT_FILE_UNREADABLE',
  /** The file is not a `dems.transcript/1` document. */
  TRANSCRIPT_DOCUMENT_INVALID: 'TRANSCRIPT_DOCUMENT_INVALID',
  /** The record handed over says something else than the document it comes with. */
  TRANSCRIPT_RECORD_MISMATCH: 'TRANSCRIPT_RECORD_MISMATCH',
  /** The document belongs to another session or was made with another backend than the session's snapshot names. */
  TRANSCRIPT_OF_ANOTHER_SESSION: 'TRANSCRIPT_OF_ANOTHER_SESSION',
  /** The document holds a segment that no committed (DONE) chunk row of the session holds. */
  TRANSCRIPT_TEXT_NOT_COMMITTED: 'TRANSCRIPT_TEXT_NOT_COMMITTED',
  /** The transcriber seam failed for another reason than "not ready". */
  TRANSCRIBER_FAILED: 'TRANSCRIBER_FAILED',
  /** The waiting limit was reached and the transcriber seam could not close the transcript out within its bound. */
  TRANSCRIPT_CLOSE_OUT_FAILED: 'TRANSCRIPT_CLOSE_OUT_FAILED',
  /** The journal row of the step cannot be read as what this step wrote. */
  JOURNAL_INVALID: 'JOURNAL_INVALID',
  /** The journal or the chunk rows could not be read or written. */
  STORE_FAILED: 'STORE_FAILED',
  /** `commitSealedTranscript`: the item already has a transcript row, and it is another one. */
  SEALED_TRANSCRIPT_DIFFERS: 'SEALED_TRANSCRIPT_DIFFERS',
} as const;
export type FinalizeTranscriptFailure = (typeof FinalizeTranscriptFailure)[keyof typeof FinalizeTranscriptFailure];

/** Every refusal and failure of the step. The message is fixed text; `detail` holds codes and counts, never transcript text. */
export class FinalizeTranscriptError extends Error {
  readonly code: FinalizeTranscriptFailure;
  readonly detail: Readonly<Record<string, string | number | boolean | null>>;

  constructor(code: FinalizeTranscriptFailure, message: string, detail: Readonly<Record<string, string | number | boolean | null>> = {}, cause?: unknown) {
    super(message, cause === undefined ? undefined : { cause });
    this.name = 'FinalizeTranscriptError';
    this.code = code;
    this.detail = detail;
  }
}
