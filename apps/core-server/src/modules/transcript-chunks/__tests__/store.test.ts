// The `transcript_chunks` store without a database (blueprint row 77; dbc-3 §B.7): what it sends,
// what it returns, how it fails, and what its statements may name. The same store against
// PostgreSQL, under the runtime role, is `transcript-chunks.db.test.ts`.
import type { ChunkMirror } from '@dems/transcriber';
import { describe, expect, it } from 'vitest';
import { TRANSCRIPT_CHUNK_STATUS } from '../../../db/schema/value-sets';
import { TranscriptChunkStoreError, createTranscriptChunkStore, type Queryable, type TranscriptChunk } from '../index';
import { INSERT_TRANSCRIPT_CHUNK, READ_TRANSCRIPT_CHUNKS, TRANSCRIPT_CHUNK_STATES, UPDATE_TRANSCRIPT_CHUNK } from '../statements';

const SESSION = 'SES-20261009-0077';
const row = (seq: number, overrides: Partial<TranscriptChunk> = {}): TranscriptChunk => ({ sessionId: SESSION, seq, audioFromMs: 2005, audioToMs: 22_037, status: 'PENDING', segments: null, embeddingRef: null, modelId: 'GGML_LARGE_V3_TURBO', computedAt: null, ...overrides });

function recorder(answer: (text: string) => { rows: unknown[]; rowCount: number | null } = () => ({ rows: [], rowCount: 1 })): { connection: Queryable; calls: { text: string; values: readonly unknown[] }[] } {
  const calls: { text: string; values: readonly unknown[] }[] = [];
  return {
    calls,
    connection: {
      async query(text: string, values: readonly unknown[] = []) {
        calls.push({ text, values });
        return answer(text) as never;
      },
    },
  };
}

describe('transcript_chunks store: the statements', () => {
  const all = [INSERT_TRANSCRIPT_CHUNK, UPDATE_TRANSCRIPT_CHUNK, READ_TRANSCRIPT_CHUNKS];

  it('are constant texts with bind parameters, name the table with its schema, and none deletes or truncates', () => {
    for (const text of all) {
      expect(text).toContain('public.transcript_chunks');
      expect(text).not.toMatch(/\bDELETE\b|\bTRUNCATE\b|\bDROP\b|;/i);
      expect(text).not.toMatch(/SELECT \*/i);
    }
  });

  it('the update sets only columns the runtime role may update, and never the key or the audio range', () => {
    const set = /SET (.*?) WHERE/.exec(UPDATE_TRANSCRIPT_CHUNK)![1]!.split(',').map((part) => part.trim().split(' ')[0]);
    expect(set).toEqual(['status', 'segments', 'model_id', 'computed_at']);
    const granted = ['status', 'segments', 'embedding_ref', 'model_id', 'computed_at']; // 0005_capture_privileges.sql
    expect(set.every((column) => granted.includes(column!))).toBe(true);
    // R80-03: one row by its key, and only while the seal has not closed the session's transcript.
    expect(UPDATE_TRANSCRIPT_CHUNK).toMatch(/WHERE session_id = \$1 AND seq = \$2 AND NOT EXISTS \(SELECT 1 FROM public\.sealing_jobs j WHERE j\.session_id = \$1 AND j\.step = 'FINALIZE_TRANSCRIPT' AND j\.status = 'DONE'\)$/);
    expect(INSERT_TRANSCRIPT_CHUNK).toContain("WHERE NOT EXISTS (SELECT 1 FROM public.sealing_jobs j WHERE j.session_id = $1 AND j.step = 'FINALIZE_TRANSCRIPT' AND j.status = 'DONE')");
  });

  it('the insert leaves an existing row alone', () => {
    expect(INSERT_TRANSCRIPT_CHUNK).toMatch(/ON CONFLICT \(session_id, seq\) DO NOTHING$/);
    expect(INSERT_TRANSCRIPT_CHUNK).not.toMatch(/DO UPDATE/i);
  });
});

describe('transcript_chunks store: what it sends and returns', () => {
  it('IS the mirror port of the transcriber: the same three members, checked by the compiler', () => {
    const mirror: ChunkMirror = createTranscriptChunkStore(recorder().connection);
    expect(Object.keys(mirror).sort()).toEqual(['insertMissing', 'read', 'update']);
    expect(Object.isFrozen(mirror)).toBe(true);
    // The module's own list IS the value set of the typed schema (the module does not import the schema).
    expect([...TRANSCRIPT_CHUNK_STATES]).toEqual([...TRANSCRIPT_CHUNK_STATUS]);
  });

  it('an insert sends every column as a parameter; segments travel as JSON text, never as a PostgreSQL array', async () => {
    const { connection, calls } = recorder();
    const segments = [{ startMs: 2005, endMs: 4000, text: "it's 'quoted'; DROP TABLE x" }];
    await createTranscriptChunkStore(connection).insertMissing([row(1), row(2, { status: 'DONE', segments, computedAt: 1_791_529_000_000 })]);
    expect(calls.map((call) => call.text)).toEqual([INSERT_TRANSCRIPT_CHUNK, INSERT_TRANSCRIPT_CHUNK]);
    expect(calls[0]!.values).toEqual([SESSION, 1, 2005, 22_037, 'PENDING', null, null, 'GGML_LARGE_V3_TURBO', null]);
    expect(calls[1]!.values).toEqual([SESSION, 2, 2005, 22_037, 'DONE', JSON.stringify(segments), null, 'GGML_LARGE_V3_TURBO', 1_791_529_000_000]);
  });

  it('an update of a row that is not there is ROW_NOT_FOUND, not a silent success', async () => {
    const { connection } = recorder(() => ({ rows: [], rowCount: 0 }));
    await expect(createTranscriptChunkStore(connection).update(SESSION, 9, { status: 'RUNNING', segments: null, modelId: null, computedAt: null })).rejects.toMatchObject({ name: 'TranscriptChunkStoreError', code: 'ROW_NOT_FOUND' });
  });

  it('rows are read with numbers for the 64-bit columns (the driver hands them over as text)', async () => {
    const { connection, calls } = recorder(() => ({
      rows: [{ session_id: SESSION, seq: 1, audio_from_ms: '2005', audio_to_ms: '22037', status: 'DONE', segments: [{ startMs: 2005, endMs: 4000, text: 'a' }], embedding_ref: null, model_id: 'GGML_LARGE_V3_TURBO', computed_at: '1791529000000' }],
      rowCount: 1,
    }));
    expect(await createTranscriptChunkStore(connection).read(SESSION)).toEqual([row(1, { status: 'DONE', segments: [{ startMs: 2005, endMs: 4000, text: 'a' }], computedAt: 1_791_529_000_000 })]);
    expect(calls).toEqual([{ text: READ_TRANSCRIPT_CHUNKS, values: [SESSION] }]);
  });

  it('a failing statement is a typed error that carries the SQLSTATE and the constraint, and no value of the row', async () => {
    const refusal = Object.assign(new Error('new row for relation "transcript_chunks" violates check constraint "transcript_chunks_done_check"'), { code: '23514', constraint: 'transcript_chunks_done_check' });
    const failing: Queryable = { query: async () => Promise.reject(refusal) };
    const store = createTranscriptChunkStore(failing);
    const errors: unknown[] = [];
    for (const work of [() => store.insertMissing([row(1, { status: 'DONE' })]), () => store.update(SESSION, 1, { status: 'DONE', segments: null, modelId: null, computedAt: null }), () => store.read(SESSION)]) {
      try {
        await work();
      } catch (error) {
        errors.push(error);
      }
    }
    expect(errors).toHaveLength(3);
    expect(errors.every((error) => error instanceof TranscriptChunkStoreError)).toBe(true);
    expect(errors.map((error) => (error as TranscriptChunkStoreError).code)).toEqual(['WRITE_FAILED', 'WRITE_FAILED', 'READ_FAILED']);
    expect(errors.map((error) => [(error as TranscriptChunkStoreError).sqlState, (error as TranscriptChunkStoreError).constraint])).toEqual(Array(3).fill(['23514', 'transcript_chunks_done_check']));
    expect(errors.map((error) => (error as Error).message).join(' ')).not.toContain(SESSION);
  });
});
