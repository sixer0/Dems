/**
 * ROWS ARE ATTEMPTS, CHUNKS ARE AUDIO RANGES (blueprint row 79; review finding pair-77 N-7,
 * decision D90; dbc-3 §B.7 and its bulk-fixture note "FAILED -> rerun pair").
 *
 * One row of `transcript_chunks` is ONE ATTEMPT at a chunk. A chunk that ended FAILED keeps its
 * row; running it again is a NEW row with a higher `seq` and the SAME audio range. So the number
 * of rows with `status = 'FAILED'` is the number of failed attempts, not of failed chunks: a
 * chunk that failed once and was then decoded has one FAILED row and one DONE row, and it is not
 * a failed chunk.
 *
 * THE RULE. The rows of a session are grouped by their audio range `(audio_from_ms, audio_to_ms)`.
 * The state of a chunk is the state of its NEWEST attempt (the highest `seq` of the range).
 * A range whose newest attempt is FAILED is a failed chunk; a FAILED row with a later DONE row
 * for the same range is not counted. Ranges of two different chunks are never equal (a chunk is
 * cut once, and two pieces of one split speech run overlap by 100 ms but never coincide).
 *
 * Pure: rows in, counts out. No statement, no clock.
 */
import type { TranscriptChunk } from './index';
import type { TranscriptChunkStatusValue } from './statements';

/** What the rule needs of a row. A `TranscriptChunk` is one. */
export type ChunkAttempt = Pick<TranscriptChunk, 'seq' | 'audioFromMs' | 'audioToMs' | 'status' | 'segments'>;

/** One chunk: its range, the row of its newest attempt and how many attempts it took. */
export interface ChunkOutcome {
  readonly audioFromMs: number;
  readonly audioToMs: number;
  /** `seq` of the newest attempt. */
  readonly seq: number;
  readonly status: TranscriptChunkStatusValue;
  /** The committed segments of the newest attempt; null unless it is DONE. */
  readonly segments: readonly unknown[] | null;
  readonly attempts: number;
  /** Attempts of this range that ended FAILED, the newest included when it is FAILED. */
  readonly failedAttempts: number;
}

export interface ChunkAttemptSummary {
  /** In timeline order: by `audioFromMs`, then `audioToMs`. */
  readonly chunks: readonly ChunkOutcome[];
  readonly total: number;
  readonly done: number;
  /** Chunks whose newest attempt is FAILED. This, and not `failedRows`, is `transcript.failedChunks`. */
  readonly failed: number;
  /** Chunks whose newest attempt is PENDING or RUNNING: the transcript is not finished. */
  readonly unfinished: number;
  /** Rows with `status = 'FAILED'`: attempts. Reported so that the difference can be shown, never used as the count. */
  readonly failedRows: number;
}

export function summariseChunkAttempts(rows: readonly ChunkAttempt[]): ChunkAttemptSummary {
  const byRange = new Map<string, ChunkAttempt[]>();
  for (const row of rows) {
    const key = `${row.audioFromMs}:${row.audioToMs}`;
    const attempts = byRange.get(key);
    if (attempts === undefined) byRange.set(key, [row]);
    else attempts.push(row);
  }
  const chunks: ChunkOutcome[] = [];
  for (const attempts of byRange.values()) {
    const newest = attempts.reduce((latest, row) => (row.seq > latest.seq ? row : latest));
    chunks.push({
      audioFromMs: newest.audioFromMs,
      audioToMs: newest.audioToMs,
      seq: newest.seq,
      status: newest.status,
      segments: newest.status === 'DONE' ? newest.segments : null,
      attempts: attempts.length,
      failedAttempts: attempts.filter((row) => row.status === 'FAILED').length,
    });
  }
  chunks.sort((a, b) => a.audioFromMs - b.audioFromMs || a.audioToMs - b.audioToMs);
  const count = (status: TranscriptChunkStatusValue): number => chunks.filter((chunk) => chunk.status === status).length;
  return {
    chunks,
    total: chunks.length,
    done: count('DONE'),
    failed: count('FAILED'),
    unfinished: count('PENDING') + count('RUNNING'),
    failedRows: rows.filter((row) => row.status === 'FAILED').length,
  };
}

/** `transcript.failedChunks` by the rows of the session: chunks, not attempts (pair-77 N-7). */
export function failedChunkCount(rows: readonly ChunkAttempt[]): number {
  return summariseChunkAttempts(rows).failed;
}
