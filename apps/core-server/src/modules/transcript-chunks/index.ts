/**
 * The `transcript_chunks` store: the database side of the transcript checkpoints (blueprint row
 * 77 / M6-W2; dbc-3 §B.7; transcript spec §D.1 "mirrored to the DB").
 *
 * WHO CALLS IT. The transcriber (`@dems/transcriber`, `src/pipeline/mirror.ts`) writes its chunk
 * checkpoints through a port of three members — `insertMissing`, `update`, `read` — and never
 * talks to PostgreSQL itself. `createTranscriptChunkStore` IS that port on the real table: the
 * same member names, the same row members (`TranscriptChunkRow` of the typed schema, camelCase).
 * The Core hands it to the transcriber when it mounts it (`src/transcription`, row 115).
 *
 * WHAT IS THE TRUTH. The checkpoint FILE of the session is; this table follows it. So this store
 * has no opinion about order or completeness: it stores what it is given, the CHECK constraints
 * of the table refuse what is not a chunk row (a DONE row without segments, an audio range that
 * is not one, a model that is not a `CODE`), and the caller reconciles after a failure.
 *
 * FAILURES ARE TYPED AND NEVER SWALLOWED. A statement that fails is a `TranscriptChunkStoreError`
 * that carries the SQLSTATE and the constraint name (never a value of the row). This module has no
 * log of its own: its one caller logs every failed mirror write to the transcriber's persistent
 * log and goes on (the transcript must not stop because the database did).
 */
import { INSERT_TRANSCRIPT_CHUNK, READ_TRANSCRIPT_CHUNKS, READ_TRANSCRIPT_CHUNK_WRITE_STATE, UPDATE_TRANSCRIPT_CHUNK, type Queryable, type TranscriptChunkStatusValue } from './statements';

export type { Queryable, TranscriptChunkStatusValue } from './statements';
export { failedChunkCount, summariseChunkAttempts, type ChunkAttempt, type ChunkAttemptSummary, type ChunkOutcome } from './attempts';

/** One row of `transcript_chunks`: the member names of the typed schema (`db/schema/transcript.ts`). */
export interface TranscriptChunk {
  readonly sessionId: string;
  readonly seq: number;
  readonly audioFromMs: number;
  readonly audioToMs: number;
  readonly status: TranscriptChunkStatusValue;
  /** The committed segments of the chunk (an array), or null while it is not DONE. */
  readonly segments: readonly unknown[] | null;
  readonly embeddingRef: string | null;
  readonly modelId: string | null;
  readonly computedAt: number | null;
}

/** What an update may change (the audio range and the key are written once, by the insert). */
export type TranscriptChunkPatch = Pick<TranscriptChunk, 'status' | 'segments' | 'modelId' | 'computedAt'>;

/**
 * `SESSION_TRANSCRIPT_SEALED` (code review row 80, R80-03): the `FINALIZE_TRANSCRIPT` step of the
 * session is DONE - its transcript block is fixed for the manifest - and the write was refused by
 * the statement itself. Nothing was changed.
 */
export type TranscriptChunkStoreErrorCode = 'WRITE_FAILED' | 'READ_FAILED' | 'ROW_NOT_FOUND' | 'SESSION_TRANSCRIPT_SEALED';

export class TranscriptChunkStoreError extends Error {
  readonly code: TranscriptChunkStoreErrorCode;
  /** The SQLSTATE of the database, when it gave one. */
  readonly sqlState: string | null;
  /** The constraint the database named, when it named one. */
  readonly constraint: string | null;

  constructor(code: TranscriptChunkStoreErrorCode, message: string, cause?: unknown) {
    super(message, cause === undefined ? undefined : { cause });
    this.name = 'TranscriptChunkStoreError';
    this.code = code;
    const fields = (cause ?? {}) as { code?: unknown; constraint?: unknown };
    this.sqlState = typeof fields.code === 'string' ? fields.code : null;
    this.constraint = typeof fields.constraint === 'string' ? fields.constraint : null;
  }
}

export interface TranscriptChunkStore {
  /** Inserts the rows that do not exist yet (by `sessionId, seq`); an existing row is left as it is. */
  insertMissing(rows: readonly TranscriptChunk[]): Promise<void>;
  update(sessionId: string, seq: number, patch: TranscriptChunkPatch): Promise<void>;
  read(sessionId: string): Promise<TranscriptChunk[]>;
}

interface StoredRow {
  session_id: string;
  seq: number;
  audio_from_ms: string | number;
  audio_to_ms: string | number;
  status: string;
  segments: unknown;
  embedding_ref: string | null;
  model_id: string | null;
  computed_at: string | number | null;
}

/** `jsonb` parameter: the JSON text of an array, or null. The driver would send an array as a PostgreSQL array. */
const jsonOrNull = (value: readonly unknown[] | null): string | null => (value === null ? null : JSON.stringify(value));

function toChunk(row: StoredRow): TranscriptChunk {
  return {
    sessionId: row.session_id,
    seq: Number(row.seq),
    audioFromMs: Number(row.audio_from_ms),
    audioToMs: Number(row.audio_to_ms),
    status: row.status as TranscriptChunkStatusValue,
    segments: Array.isArray(row.segments) ? (row.segments as unknown[]) : null,
    embeddingRef: row.embedding_ref,
    modelId: row.model_id,
    computedAt: row.computed_at === null ? null : Number(row.computed_at),
  };
}

export function createTranscriptChunkStore(connection: Queryable): TranscriptChunkStore {
  /** Asked only after a write that changed no row: why. A read that fails says nothing (the caller's own rule then holds). */
  async function writeState(sessionId: string, seq: number): Promise<{ sealed: boolean; present: boolean }> {
    try {
      const found = (await connection.query<{ sealed: unknown; present: unknown }>(READ_TRANSCRIPT_CHUNK_WRITE_STATE, [sessionId, seq])).rows[0];
      return { sealed: found?.sealed === true, present: found?.present === true };
    } catch {
      return { sealed: false, present: false };
    }
  }
  const sealed = (): TranscriptChunkStoreError => new TranscriptChunkStoreError('SESSION_TRANSCRIPT_SEALED', 'the transcript of the session is closed by its seal: no chunk row is written any more');

  return Object.freeze({
    async insertMissing(rows: readonly TranscriptChunk[]): Promise<void> {
      for (const row of rows) {
        let inserted: number | null;
        try {
          inserted = (await connection.query(INSERT_TRANSCRIPT_CHUNK, [row.sessionId, row.seq, row.audioFromMs, row.audioToMs, row.status, jsonOrNull(row.segments), row.embeddingRef, row.modelId, row.computedAt])).rowCount;
        } catch (error) {
          throw new TranscriptChunkStoreError('WRITE_FAILED', 'a transcript chunk row could not be inserted', error);
        }
        if (inserted === 1) continue;
        // No row was inserted: it exists already (the resume's no-op), or the seal has closed the session's rows.
        const state = await writeState(row.sessionId, row.seq);
        if (state.sealed && !state.present) throw sealed();
      }
    },

    async update(sessionId: string, seq: number, patch: TranscriptChunkPatch): Promise<void> {
      let changed: number | null;
      try {
        changed = (await connection.query(UPDATE_TRANSCRIPT_CHUNK, [sessionId, seq, patch.status, jsonOrNull(patch.segments), patch.modelId, patch.computedAt])).rowCount;
      } catch (error) {
        throw new TranscriptChunkStoreError('WRITE_FAILED', 'a transcript chunk row could not be updated', error);
      }
      if (changed === 1) return;
      if ((await writeState(sessionId, seq)).sealed) throw sealed();
      throw new TranscriptChunkStoreError('ROW_NOT_FOUND', 'no transcript chunk row has this session and sequence number');
    },

    async read(sessionId: string): Promise<TranscriptChunk[]> {
      try {
        return (await connection.query<StoredRow>(READ_TRANSCRIPT_CHUNKS, [sessionId])).rows.map(toChunk);
      } catch (error) {
        throw new TranscriptChunkStoreError('READ_FAILED', 'the transcript chunk rows could not be read', error);
      }
    },
  });
}
