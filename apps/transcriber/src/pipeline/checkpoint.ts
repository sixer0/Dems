/**
 * CHUNK CHECKPOINTS (transcript spec §D.1, §D.2; §0.2 `TRANSCRIPT_CHECKPOINT_PATH`).
 *
 * One file per session, `<session scratch>/transcript-checkpoint.json`, in the git-ignored
 * evidence store (OD-25). IT IS THE TRUTH of a transcript in progress; the table
 * `transcript_chunks` mirrors it (`mirror.ts`).
 *
 *   - the BOUNDARY of a chunk is in the file before the chunk is decoded (§A.2 "Checkpoint");
 *   - the SEGMENTS of a chunk are in the file when the chunk is committed (§A.3 "Checkpoint");
 *   - a committed chunk is never decoded again and never changed (§D.2).
 *
 * EVERY WRITE REPLACES THE FILE ATOMICALLY: the new content goes to a sibling file, is forced to
 * the disk, is renamed over the old one, and the directory is forced to the disk. A kill at any
 * instant leaves the previous file or the new one, never a part of either.
 *
 * FAIL CLOSED: a file that is not a checkpoint of this form, or that belongs to another session,
 * backend, model or audio than the run that opens it, is `CHECKPOINT_INVALID`. It is never
 * silently replaced: the backend of a session does not change mid-session (§B.4), and a transcript
 * whose history cannot be read is not continued on a guess.
 */
import { closeSync, fsyncSync, mkdirSync, openSync, readFileSync, renameSync, rmSync, writeSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { z } from 'zod';
import { TRANSCRIBER_BACKEND_IDS, TRANSCRIBER_LANGUAGE, TranscriberError, TranscriberErrorCode, type TranscriberBackendId } from '../types';
import { TRANSCRIPT_CHECKPOINT_FILE, TRANSCRIPT_CHECKPOINT_VERSION } from './constants';
import { SpeakerState, SpeakerUnavailableReason } from './diarization';
import { AudioSourceKind, type AudioTimeline } from './media-time';

/** The four states of a chunk: the value set of `transcript_chunks.status` (dbc-3 §B.7). */
export const ChunkStatus = { PENDING: 'PENDING', RUNNING: 'RUNNING', DONE: 'DONE', FAILED: 'FAILED' } as const;
export type ChunkStatus = (typeof ChunkStatus)[keyof typeof ChunkStatus];

const CommittedSegmentSchema = z.strictObject({
  startMs: z.number().int().nonnegative(),
  endMs: z.number().int().positive(),
  text: z.string().min(1),
  avgLogprob: z.number().optional(),
  noSpeechProb: z.number().optional(),
  compressionRatio: z.number().optional(),
});

const ChunkSchema = z
  .strictObject({
    /** The position of the chunk on the timeline: 0, 1, 2, … in the order the VAD found them. */
    chunkIndex: z.number().int().nonnegative(),
    /** `transcript_chunks.seq` of the row that holds the CURRENT attempt of this chunk. */
    seq: z.number().int().min(1),
    /** Rows of earlier attempts that ended FAILED (a re-run is a new row, never a rewritten one). */
    failedSeqs: z.array(z.number().int().min(1)),
    /** The source samples the chunk is cut from: `[fromSample, toSample)`. Exact; the milliseconds below are rounded. */
    fromSample: z.number().int().nonnegative(),
    toSample: z.number().int().positive(),
    /** Media time of the sealed file, whole milliseconds. */
    startMs: z.number().int().nonnegative(),
    endMs: z.number().int().positive(),
    /** The audio source (microphone role) of the interval the chunk starts in, or null when none is known. */
    audioSource: z.string().nullable(),
    status: z.enum([ChunkStatus.PENDING, ChunkStatus.RUNNING, ChunkStatus.DONE, ChunkStatus.FAILED]),
    segments: z.array(CommittedSegmentSchema).nullable(),
    /** Epoch milliseconds of the commit. An instant, not a duration. */
    computedAt: z.number().int().nonnegative().nullable(),
    /** The typed code of the failure that ended the last attempt, or null. */
    errorCode: z.string().nullable(),
  })
  .refine((chunk) => chunk.toSample > chunk.fromSample && chunk.endMs > chunk.startMs, { message: 'a chunk has a positive length' })
  .refine((chunk) => chunk.status !== ChunkStatus.DONE || (chunk.segments !== null && chunk.computedAt !== null), { message: 'a DONE chunk holds its segments and its instant' })
  .refine((chunk) => chunk.status === ChunkStatus.DONE || chunk.segments === null, { message: 'only a DONE chunk holds segments' });

const Hex64 = z.string().regex(/^[0-9a-f]{64}$/);

/**
 * THE LABEL MAP AND ITS STATE (§A.4 "Checkpoint"; §D.1 "labels/state once after clustering").
 * Written ONCE by the diarization post-pass of row 78 and never changed: a resumed assembly reads
 * it and starts no engine. `labels` has one entry per committed segment, in document order;
 * `segments` is that count, so a map can never be applied to another set of segments.
 */
const DiarizationCheckpointSchema = z
  .strictObject({
    state: z.enum([SpeakerState.LABELLED, SpeakerState.UNAVAILABLE]),
    reason: z.enum(Object.values(SpeakerUnavailableReason) as [SpeakerUnavailableReason, ...SpeakerUnavailableReason[]]).nullable(),
    numSpeakers: z.number().int().nonnegative(),
    confidence: z.number().nullable(),
    segments: z.number().int().nonnegative(),
    labels: z.array(z.enum(['A', 'B']).nullable()),
    engine: z
      .strictObject({ engine: z.string().min(1), embeddingModel: z.string().min(1), embeddingModelSha256: Hex64 })
      .nullable(),
  })
  .refine((entry) => entry.labels.length === entry.segments, { message: 'one label entry per segment' })
  .refine((entry) => (entry.state === SpeakerState.UNAVAILABLE) === (entry.reason !== null), { message: 'UNAVAILABLE carries its reason' })
  .refine((entry) => entry.state === SpeakerState.LABELLED || entry.labels.every((label) => label === null), { message: 'an UNAVAILABLE map carries no label' });

/**
 * THE DOCUMENT-LEVEL RECORD (§D.1 `{assembled, doc_hash, speaker_state}`; §A.5 "Checkpoint").
 * Written once, after the document and its two renderings are on the disk. From then on the
 * machine transcript is never computed again (§D.3 "Idempotence").
 */
const DocumentCheckpointSchema = z.strictObject({
  assembled: z.literal(true),
  docSha256: Hex64,
  srtSha256: Hex64,
  vttSha256: Hex64,
  speakerState: z.enum([SpeakerState.LABELLED, SpeakerState.UNAVAILABLE]),
  state: z.enum(['ASSEMBLED', 'PARTIAL']),
});

export const CheckpointSchema = z.strictObject({
  version: z.literal(TRANSCRIPT_CHECKPOINT_VERSION),
  sessionId: z.string().min(1),
  backend: z.enum(TRANSCRIBER_BACKEND_IDS),
  model: z.string().min(1),
  language: z.literal(TRANSCRIBER_LANGUAGE),
  /** Which audio is chunked, and how its samples map to media time (`media-time.ts`). */
  audio: z.strictObject({
    kind: z.enum([AudioSourceKind.PCM_TAP, AudioSourceKind.DECODED_FILE]),
    sampleRateHz: z.number().int().positive(),
    originSamples: z.number().int().nonnegative(),
    gridSamples: z.number().int().positive(),
  }),
  /** Source sample up to which the chunk plan is final. The next VAD pass starts here. */
  cursorSample: z.number().int().nonnegative(),
  /**
   * Set while `cursorSample` lies inside a speech run that a pass cut at the maximum chunk length
   * (`chunker.ts`, N-4): the source sample up to which that run was seen to reach. The next pass
   * treats `[cursorSample, openRunUntilSample)` as speech. Absent otherwise.
   */
  openRunUntilSample: z.number().int().nonnegative().optional(),
  /** True once the plan covers the whole audio: no more chunk will be added. */
  audioComplete: z.boolean(),
  qaFlags: z.array(z.string()),
  /**
   * True when the audio of the session did not (all) reach the transcriber: no tap for the session,
   * or a tap that ended before the session did (`TRANSCRIPT_AUDIO_UNAVAILABLE`, §A.1). Once true it
   * stays true: such a transcript is PARTIAL at best, never an empty-but-complete one.
   */
  audioUnavailable: z.boolean(),
  /** The next unused `transcript_chunks.seq` of this session. */
  nextSeq: z.number().int().min(1),
  chunks: z.array(ChunkSchema),
  /** Row 78: absent until the diarization post-pass has run. Written once. */
  diarization: DiarizationCheckpointSchema.optional(),
  /** Row 78: absent until the document is assembled and hashed. Written once. */
  document: DocumentCheckpointSchema.optional(),
});
export type Checkpoint = z.output<typeof CheckpointSchema>;
export type CheckpointChunk = Checkpoint['chunks'][number];

export interface CheckpointIdentity {
  readonly sessionId: string;
  readonly backend: TranscriberBackendId;
  readonly model: string;
  readonly timeline: AudioTimeline;
}

export function emptyCheckpoint(identity: CheckpointIdentity): Checkpoint {
  const { timeline } = identity;
  return {
    version: TRANSCRIPT_CHECKPOINT_VERSION,
    sessionId: identity.sessionId,
    backend: identity.backend,
    model: identity.model,
    language: TRANSCRIBER_LANGUAGE,
    audio: { kind: timeline.kind, sampleRateHz: timeline.sampleRateHz, originSamples: timeline.originSamples, gridSamples: timeline.gridSamples },
    cursorSample: 0,
    audioComplete: false,
    qaFlags: [],
    audioUnavailable: false,
    nextSeq: 1,
    chunks: [],
  };
}

function invalid(reason: string): TranscriberError {
  return new TranscriberError(TranscriberErrorCode.CHECKPOINT_INVALID, 'the transcript checkpoint cannot be used by this run', { reason });
}

export interface CheckpointStore {
  readonly path: string;
  /** The stored checkpoint, or null when the session has none yet. Throws `CHECKPOINT_INVALID`. */
  load(identity: CheckpointIdentity): Checkpoint | null;
  /** Replaces the file atomically. Throws when the value is not a checkpoint: nothing malformed is ever written. */
  save(checkpoint: Checkpoint): void;
}

export function createCheckpointStore(sessionScratchDir: string): CheckpointStore {
  const path = join(sessionScratchDir, TRANSCRIPT_CHECKPOINT_FILE);
  const staging = `${path}.next`;

  const load = (identity: CheckpointIdentity): Checkpoint | null => {
    let text: string;
    try {
      text = readFileSync(path, 'utf8');
    } catch (error) {
      if ((error as { code?: unknown }).code === 'ENOENT') return null;
      throw invalid('CHECKPOINT_NOT_READABLE');
    }
    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch {
      throw invalid('CHECKPOINT_NOT_JSON');
    }
    const parsed = CheckpointSchema.safeParse(json);
    if (!parsed.success) throw invalid('CHECKPOINT_FORM_UNKNOWN');
    const stored = parsed.data;
    const { timeline } = identity;
    if (stored.sessionId !== identity.sessionId) throw invalid('CHECKPOINT_OF_ANOTHER_SESSION');
    if (stored.backend !== identity.backend || stored.model !== identity.model) throw invalid('CHECKPOINT_OF_ANOTHER_BACKEND_OR_MODEL');
    if (stored.audio.kind !== timeline.kind || stored.audio.sampleRateHz !== timeline.sampleRateHz || stored.audio.originSamples !== timeline.originSamples || stored.audio.gridSamples !== timeline.gridSamples) {
      throw invalid('CHECKPOINT_OF_ANOTHER_AUDIO');
    }
    stored.chunks.forEach((chunk, index) => {
      if (chunk.chunkIndex !== index) throw invalid('CHECKPOINT_CHUNK_ORDER');
    });
    return stored;
  };

  const save = (checkpoint: Checkpoint): void => {
    const body = `${JSON.stringify(CheckpointSchema.parse(checkpoint))}\n`;
    mkdirSync(dirname(path), { recursive: true });
    rmSync(staging, { force: true }); // what a killed writer may have left; it was never the checkpoint
    const descriptor = openSync(staging, 'wx', 0o600);
    try {
      writeSync(descriptor, body);
      fsyncSync(descriptor);
    } finally {
      closeSync(descriptor);
    }
    renameSync(staging, path);
    const directory = openSync(dirname(path), 'r');
    try {
      fsyncSync(directory);
    } finally {
      closeSync(directory);
    }
  };

  return Object.freeze({ path, load, save });
}
