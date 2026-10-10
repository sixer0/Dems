// The `transcript_chunks` store against PostgreSQL (blueprint row 77 / M6-W2; dbc-3 §B.7 and the
// privileges of migration 0005; transcript spec §D.1, §D.2), under the RUNTIME ROLE `dems_app` on
// a throw-away clone of this run (`useTestDatabase`): no live database is touched, and schema
// version 2 / dbc-3 is used as it is — this row adds no migration.
//
// Two halves:
//
//   1. the store by itself: what the table refuses, the stand-in mirror of the transcriber
//      refuses with the SAME constraint name (so the transcriber's own suite cannot pass on a row
//      the database would turn down); what the runtime role may not do, it cannot do here;
//   2. THE TRANSCRIBER PIPELINE WRITING THROUGH THE STORE: the real runner of `@dems/transcriber`
//      (VAD plan, STT per chunk, clamp, checkpoint file) with the real table as its mirror; the
//      engine and the VAD are in-process stand-ins (no model, no process). Plan before decode,
//      commit per chunk, a FAILED chunk and its re-run as a new row, a database that is away, and
//      a resume that decodes nothing that is committed.
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  NO_TAP_SIGNAL,
  SerialQueue,
  TranscriberError,
  captureTapTimeline,
  createMemoryChunkMirror,
  createMemoryLog,
  createTranscriptRunner,
  openPcmSource,
  tableRefusal,
  type ChunkMirror,
  type ChunkMirrorRow,
  type TranscriberAdapter,
  type VoiceActivityDetector,
} from '@dems/transcriber';
import type { Pool } from 'pg';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { expectRefused, SQLSTATE } from '../../../../test/db/support';
import { useTestDatabase } from '../../../../test/helpers/db';
import { TranscriptChunkStoreError, createTranscriptChunkStore, type Queryable, type TranscriptChunkStore } from '../index';

const db = useTestDatabase({ template: 'seed', slug: 'row77' });
let app: Pool;
let owner: Pool;
let store: TranscriptChunkStore;

const SESSION = 'SES-20261009-0077';
const OTHER = 'SES-20261009-0078';
const row = (seq: number, overrides: Partial<ChunkMirrorRow> = {}): ChunkMirrorRow => ({ sessionId: SESSION, seq, audioFromMs: 2005, audioToMs: 22_037, status: 'PENDING', segments: null, embeddingRef: null, modelId: 'GGML_LARGE_V3_TURBO', computedAt: null, ...overrides });
const queryable = (pool: Pool): Queryable => ({ query: (text, values) => pool.query(text, values === undefined ? [] : [...values]) });
const storedRows = async (sessionId = SESSION): Promise<Record<string, unknown>[]> =>
  (await owner.query('SELECT seq, audio_from_ms::int AS audio_from_ms, audio_to_ms::int AS audio_to_ms, status, segments, embedding_ref, model_id, computed_at::bigint::text AS computed_at FROM public.transcript_chunks WHERE session_id = $1 ORDER BY seq', [sessionId])).rows;

beforeAll(() => {
  app = db.appPool();
  owner = db.ownerPool();
  store = createTranscriptChunkStore(queryable(app));
});

beforeEach(async () => {
  // Owner-side clean-up of this file's two sessions only (the runtime role has no DELETE here).
  await owner.query('DELETE FROM public.transcript_chunks WHERE session_id = ANY($1)', [[SESSION, OTHER]]);
});

describe('the database this file runs on', () => {
  it('is at schema version 4 / dbc-5 (sets 4 and 5), and this row brought no migration', async () => {
    const meta = (await owner.query('SELECT schema_version, contract_revision FROM public.schema_meta')).rows[0] as { schema_version: number; contract_revision: string };
    expect([Number(meta.schema_version), meta.contract_revision]).toEqual([6, 'dbc-7']); // set 7 (PE-0013-01)
  });
});

describe('transcript_chunks store as dems_app: rows in, rows out', () => {
  it('a planned row is stored as given and read back equal; a second insert of the same key changes nothing', async () => {
    await store.insertMissing([row(1), row(2, { audioFromMs: 33_005, audioToMs: 53_037 })]);
    await store.insertMissing([row(1, { audioToMs: 99_999, status: 'FAILED' })]);
    expect(await store.read(SESSION)).toEqual([row(1), row(2, { audioFromMs: 33_005, audioToMs: 53_037 })]);
    expect(await store.read(OTHER)).toEqual([]);
  });

  it('a commit stores the segments as a JSON array and the instant; text with quotes and non-ASCII letters is stored as it is', async () => {
    const segments = [
      { startMs: 2005, endMs: 6245, text: "Selamat pagi; terima kasih — 'hadir' \"hari ini\"." },
      { startMs: 6965, endMs: 9845, text: 'Çé ñ 日本 \\ backslash', avgLogprob: -0.17, noSpeechProb: 4.0e-11 },
    ];
    await store.insertMissing([row(1)]);
    await store.update(SESSION, 1, { status: 'RUNNING', segments: null, modelId: 'GGML_LARGE_V3_TURBO', computedAt: null });
    await store.update(SESSION, 1, { status: 'DONE', segments, modelId: 'GGML_LARGE_V3_TURBO', computedAt: 1_791_529_000_123 });
    expect(await store.read(SESSION)).toEqual([row(1, { status: 'DONE', segments, computedAt: 1_791_529_000_123 })]);
    const stored = (await owner.query("SELECT jsonb_typeof(segments) AS kind, jsonb_array_length(segments) AS length FROM public.transcript_chunks WHERE session_id = $1", [SESSION])).rows[0];
    expect(stored).toEqual({ kind: 'array', length: 2 });
  });

  it('an update of a row that does not exist is ROW_NOT_FOUND', async () => {
    await expect(store.update(SESSION, 41, { status: 'RUNNING', segments: null, modelId: null, computedAt: null })).rejects.toMatchObject({ code: 'ROW_NOT_FOUND' });
  });
});

describe('R80-03 (defence in depth): no chunk row of a session is written once its FINALIZE_TRANSCRIPT step is DONE', () => {
  const journal = (status: string, step = 'FINALIZE_TRANSCRIPT', sessionId = SESSION): Promise<unknown> =>
    owner.query("INSERT INTO public.sealing_jobs (session_id, step, status, progress, eta_ms, attempt, checkpoint, error_code, started_at, updated_at) VALUES ($1, $2, $3, 100, NULL, 1, NULL, NULL, 1, 1) ON CONFLICT (session_id, step) DO UPDATE SET status = EXCLUDED.status", [sessionId, step, status]);
  const clear = (): Promise<unknown> => owner.query('DELETE FROM public.sealing_jobs WHERE session_id = ANY($1)', [[SESSION, OTHER]]);
  const segments = [{ startMs: 2005, endMs: 2900, text: 'terlambat' }];

  it('a FAILED row the seal signed is not flipped to DONE afterwards, and no new row appears: both are refused BY NAME; the rows stay as they were', async () => {
    await clear();
    await store.insertMissing([row(1, { status: 'FAILED' }), row(2)]);
    await journal('DONE');
    const before = await storedRows();
    await expect(store.update(SESSION, 1, { status: 'DONE', segments, modelId: 'GGML_LARGE_V3_TURBO', computedAt: 1_791_529_000_123 })).rejects.toMatchObject({ code: 'SESSION_TRANSCRIPT_SEALED' });
    await expect(store.insertMissing([row(3)])).rejects.toMatchObject({ code: 'SESSION_TRANSCRIPT_SEALED' });
    expect(await storedRows()).toEqual(before);
    // An insert of rows that all exist is still the no-op a resume relies on.
    await store.insertMissing([row(1, { status: 'FAILED' }), row(2)]);
    expect(await storedRows()).toEqual(before);
    await clear();
  });

  it('CONTROL: while that step is not DONE (RUNNING: the close-out writes then), for another step that is DONE, and for another session, rows are written as before', async () => {
    await clear();
    await store.insertMissing([row(1, { status: 'FAILED' })]);
    await journal('RUNNING');
    await journal('DONE', 'FINALIZE_HASHES');
    await journal('DONE', 'FINALIZE_TRANSCRIPT', OTHER);
    await store.update(SESSION, 1, { status: 'DONE', segments, modelId: 'GGML_LARGE_V3_TURBO', computedAt: 1_791_529_000_123 });
    await store.insertMissing([row(2)]);
    expect((await storedRows()).map((stored) => [stored['seq'], stored['status']])).toEqual([[1, 'DONE'], [2, 'PENDING']]);
    await expect(store.update(SESSION, 41, { status: 'RUNNING', segments: null, modelId: null, computedAt: null })).rejects.toMatchObject({ code: 'ROW_NOT_FOUND' });
    await clear();
  });
});

describe('what the table refuses, the stand-in mirror of the transcriber refuses under the same name', () => {
  const refused: readonly (readonly [string, Partial<ChunkMirrorRow>])[] = [
    ['transcript_chunks_session_check', { sessionId: 'session-1' }],
    ['transcript_chunks_seq_check', { seq: 0 }],
    ['transcript_chunks_audio_check', { audioToMs: 0 }],
    ['transcript_chunks_audio_check', { audioFromMs: -1 }],
    ['transcript_chunks_status_check', { status: 'COMMITTED' as never }],
    ['transcript_chunks_done_check', { status: 'DONE' }],
    ['transcript_chunks_done_check', { status: 'DONE', segments: [] }],
    ['transcript_chunks_ref_check', { modelId: 'ggml-large-v3-turbo' }],
    ['transcript_chunks_ref_check', { embeddingRef: 'not a code' }],
  ];

  it.each(refused)('%s: refused by PostgreSQL (23514) and by the stand-in, with the same constraint', async (constraint, change) => {
    const bad = row(1, change);
    expect(tableRefusal(bad)).toBe(constraint);
    await expect(createMemoryChunkMirror().insertMissing([bad])).rejects.toMatchObject({ constraint });
    let caught: unknown;
    try {
      await store.insertMissing([bad]);
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(TranscriptChunkStoreError);
    expect(caught).toMatchObject({ code: 'WRITE_FAILED', sqlState: SQLSTATE.checkViolation, constraint });
    expect(await store.read(SESSION)).toEqual([]);
  });

  it('an UPDATE into a refused state is refused too (DONE without segments), and the row keeps its state', async () => {
    await store.insertMissing([row(1)]);
    await expect(store.update(SESSION, 1, { status: 'DONE', segments: null, modelId: 'GGML_LARGE_V3_TURBO', computedAt: 5 })).rejects.toMatchObject({ sqlState: SQLSTATE.checkViolation, constraint: 'transcript_chunks_done_check' });
    expect((await store.read(SESSION))[0]).toMatchObject({ status: 'PENDING', segments: null });
  });

  it('control: the acceptable row of the same table is accepted by both', async () => {
    expect(tableRefusal(row(1))).toBeNull();
    await store.insertMissing([row(1), row(2, { status: 'DONE', segments: [], computedAt: 1 })]);
    expect((await store.read(SESSION)).map((entry) => entry.status)).toEqual(['PENDING', 'DONE']);
  });
});

describe('what the runtime role may not do on transcript_chunks (0005)', () => {
  beforeEach(async () => {
    await store.insertMissing([row(1)]);
  });

  it('no DELETE: a chunk row is never removed', async () => {
    await expectRefused(() => app.query('DELETE FROM public.transcript_chunks WHERE session_id = $1', [SESSION]), SQLSTATE.insufficientPrivilege);
  });

  it('no UPDATE of the key or of the audio range: they are written once, by the insert', async () => {
    for (const column of ['session_id', 'seq', 'audio_from_ms', 'audio_to_ms']) {
      await expectRefused(() => app.query(`UPDATE public.transcript_chunks SET ${column} = ${column} WHERE session_id = $1`, [SESSION]), SQLSTATE.insufficientPrivilege);
    }
    expect(await storedRows()).toHaveLength(1);
  });
});

// ───────────────────────────────────────────────────────────────────────────────────────
// The transcriber pipeline, writing through the store
// ───────────────────────────────────────────────────────────────────────────────────────

const RATE = 48_000;
/** Four runs of speech, 20 s each, 31 s apart: they cannot be joined, so four chunks. */
const RUNS = [0, 1, 2, 3].map((index) => ({ fromMs: (2 + index * 31) * 1000, toMs: (22 + index * 31) * 1000 }));

function tapFile(): { dir: string; path: string } {
  const dir = mkdtempSync(join(tmpdir(), 'dems-row77-db-'));
  const path = join(dir, 'tap.pcm');
  const samples = Buffer.alloc(130 * RATE * 2);
  for (const run of RUNS) for (let index = (run.fromMs * RATE) / 1000; index < (run.toMs * RATE) / 1000; index += 1) samples.writeInt16LE(3000, index * 2);
  writeFileSync(path, samples);
  return { dir, path };
}

/** A VAD stand-in: it answers with the runs of the tap that lie in the window it is asked about. */
function vadFor(windowFromMs: () => number): VoiceActivityDetector {
  return { detect: async () => RUNS.map((run) => ({ fromMs: run.fromMs - windowFromMs(), toMs: run.toMs - windowFromMs() })).filter((span) => span.fromMs >= 0) };
}

interface Engine extends TranscriberAdapter {
  readonly decoded: number[];
  /** The engine fails on the chunk that starts in this second of the timeline (64 = the third chunk), or on none. */
  failingSecond: number | null;
}

function engine(): Engine {
  const queue = new SerialQueue();
  const decoded: number[] = [];
  const self: Engine = {
    backend: 'cpu-local',
    model: 'ggml-large-v3-turbo',
    queue,
    captureWorkerStated: true,
    decoded,
    failingSecond: null,
    transcribe: (chunk) =>
      queue.run(async () => {
        decoded.push(chunk.offsetMs);
        if (self.failingSecond !== null && Math.floor(chunk.offsetMs / 1000) === self.failingSecond) throw new TranscriberError('ENGINE_FAILED', 'the stand-in engine ended with an error', { reason: 'STAND_IN_FAILURE' });
        return {
          engine: 'cpu-local' as const,
          model: 'ggml-large-v3-turbo',
          language: 'id' as const,
          text: 'ucapan',
          // The second segment reaches past the chunk: the clamp must cut it before it is committed.
          segments: [
            { id: 0, start: 0.5, end: 4.25, text: 'ucapan pertama' },
            { id: 1, start: 5, end: 90, text: 'ucapan kedua' },
          ],
        };
      }),
  };
  return self;
}

function pipeline(mirror: ChunkMirror, tap: { dir: string; path: string }, adapter: Engine) {
  const log = createMemoryLog();
  const runner = createTranscriptRunner({
    sessionId: SESSION,
    adapter,
    timeline: captureTapTimeline(),
    source: openPcmSource({ container: 'raw', path: tap.path, sampleRateHz: RATE }),
    vad: vadFor(() => 0),
    sessionScratchDir: tap.dir,
    log,
    mirror,
    now: () => new Date(1_791_529_000_000),
    tapLost: NO_TAP_SIGNAL,
    intervals: () => [{ source: 'PRIMARY', fromMs: 0, toMs: null }],
  });
  return { runner, log };
}

describe('row 77: the transcriber pipeline writes its chunk checkpoints into transcript_chunks', () => {
  it('every boundary is in the table BEFORE the first chunk is decoded; then one RUNNING and one DONE per chunk', async () => {
    const tap = tapFile();
    const adapter = engine();
    let atFirstDecode: Record<string, unknown>[] | null = null;
    const watching: ChunkMirror = {
      insertMissing: (rows) => store.insertMissing(rows),
      read: (sessionId) => store.read(sessionId),
      async update(sessionId, seq, patch) {
        // The first RUNNING is written right before the first chunk is handed to the engine.
        if (atFirstDecode === null) atFirstDecode = await storedRows();
        await store.update(sessionId, seq, patch);
      },
    };
    const { runner } = pipeline(watching, tap, adapter);
    const report = await runner.step({ final: true });
    expect(report).toEqual({ planned: 4, decoded: 4, failed: 0, reused: 0, remaining: 0, paused: false, complete: true, qaFlags: [], transcriptState: 'READY', partialReason: null });
    expect(atFirstDecode!.map((entry) => [entry['seq'], entry['status'], entry['segments']])).toEqual([[1, 'PENDING', null], [2, 'PENDING', null], [3, 'PENDING', null], [4, 'PENDING', null]]);
    expect(adapter.decoded).toHaveLength(4);
  });

  it('the rows ARE the checkpoint: media-time ranges of the sealed file, the model as a CODE, segments clamped to the chunk, the instant of the commit', async () => {
    const tap = tapFile();
    const { runner } = pipeline(store, tap, engine());
    await runner.step({ final: true });
    const checkpoint = runner.checkpoint();
    const rows = await store.read(SESSION);
    expect(rows).toEqual(
      checkpoint.chunks.map((chunk) => ({ sessionId: SESSION, seq: chunk.seq, audioFromMs: chunk.startMs, audioToMs: chunk.endMs, status: 'DONE', segments: chunk.segments, embeddingRef: null, modelId: 'GGML_LARGE_V3_TURBO', computedAt: 1_791_529_000_000 })),
    );
    // Tap sample 96,000 (2.000 s after T0) snapped down to file frame 94 = tap sample 95,232:
    // (95232 + 1024) / 48000 s = 2.005333… s of the sealed file.
    expect([rows[0]!.audioFromMs, rows[0]!.audioToMs]).toEqual([2005, 22_037]);
    for (const [index, entry] of rows.entries()) {
      const segments = entry.segments as { startMs: number; endMs: number; text: string }[];
      expect(segments.map((segment) => segment.text)).toEqual(['ucapan pertama', 'ucapan kedua']);
      expect(segments[0]).toMatchObject({ startMs: entry.audioFromMs + 500 });
      // The engine said "ends at 90 s" of a 20 s chunk: 0 stored segments end after the chunk.
      expect(segments.filter((segment) => segment.endMs > entry.audioToMs)).toEqual([]);
      expect(segments[1]!.endMs).toBe(entry.audioToMs);
      expect(checkpoint.chunks[index]!.audioSource).toBe('PRIMARY');
    }
    expect(await storedRows()).toHaveLength(4);
  });

  it('a chunk whose engine keeps failing is FAILED in the table and the others are DONE; running it again is a NEW row, the FAILED row stays', async () => {
    const tap = tapFile();
    const adapter = engine();
    const { runner } = pipeline(store, tap, adapter);
    adapter.failingSecond = 64; // the third chunk starts 64 s into the take
    const first = await runner.step({ final: true });
    expect(first).toMatchObject({ decoded: 3, failed: 1, complete: true });
    expect((await store.read(SESSION)).map((entry) => [entry.seq, entry.status, entry.segments === null])).toEqual([[1, 'DONE', false], [2, 'DONE', false], [3, 'FAILED', true], [4, 'DONE', false]]);
    adapter.failingSecond = null;
    expect(runner.retryFailed()).toBe(1);
    expect(await runner.step({ final: true })).toMatchObject({ decoded: 1, failed: 0, reused: 3, complete: true });
    const rows = await store.read(SESSION);
    expect(rows.map((entry) => [entry.seq, entry.status])).toEqual([[1, 'DONE'], [2, 'DONE'], [3, 'FAILED'], [4, 'DONE'], [5, 'DONE']]);
    expect([rows[4]!.audioFromMs, rows[4]!.audioToMs]).toEqual([rows[2]!.audioFromMs, rows[2]!.audioToMs]);
    expect(rows[2]).toMatchObject({ segments: null, computedAt: null });
  });

  it('a database that is away does not stop the transcript; when it is back a NEW runner brings the rows in line and decodes nothing', async () => {
    const tap = tapFile();
    const adapter = engine();
    let away = true;
    const flaky: ChunkMirror = {
      insertMissing: async (rows) => (away ? Promise.reject(new Error('connection refused')) : store.insertMissing(rows)),
      update: async (sessionId, seq, patch) => (away ? Promise.reject(new Error('connection refused')) : store.update(sessionId, seq, patch)),
      read: async (sessionId) => (away ? Promise.reject(new Error('connection refused')) : store.read(sessionId)),
    };
    const first = pipeline(flaky, tap, adapter);
    expect(await first.runner.step({ final: true })).toMatchObject({ decoded: 4, failed: 0, complete: true });
    expect(await storedRows()).toEqual([]);
    expect(first.log.records().filter((record) => record.level === 'error' && record.context['reason'] === 'MIRROR_WRITE_FAILED').length).toBeGreaterThan(0);

    away = false;
    const second = pipeline(flaky, tap, adapter);
    expect(await second.runner.step({ final: true })).toMatchObject({ planned: 0, decoded: 0, reused: 4, complete: true });
    expect(adapter.decoded).toHaveLength(4);
    const rows = await store.read(SESSION);
    expect(rows.map((entry) => [entry.seq, entry.status, (entry.segments as unknown[]).length])).toEqual([[1, 'DONE', 2], [2, 'DONE', 2], [3, 'DONE', 2], [4, 'DONE', 2]]);
    expect(rows.map((entry) => entry.segments)).toEqual(second.runner.checkpoint().chunks.map((chunk) => chunk.segments));
  });

  it('resume on rows a killed process left behind (chunk 3 RUNNING in the file and in the table): only that chunk and the one after it are decoded; committed rows are untouched', async () => {
    const tap = tapFile();
    const adapter = engine();
    // A first process decodes two chunks and is then held back; chunks 3 and 4 are planned, not decoded.
    const first = createTranscriptRunner({
      sessionId: SESSION,
      adapter,
      timeline: captureTapTimeline(),
      source: openPcmSource({ container: 'raw', path: tap.path, sampleRateHz: RATE }),
      vad: vadFor(() => 0),
      tapLost: NO_TAP_SIGNAL,
      sessionScratchDir: tap.dir,
      log: createMemoryLog(),
      mirror: store,
      now: () => new Date(1_791_529_000_000),
      shouldPause: () => adapter.decoded.length >= 2,
    });
    expect(await first.step({ final: true })).toMatchObject({ planned: 4, decoded: 2, remaining: 2, paused: true });
    // What a kill INSIDE chunk 3 leaves: the chunk is RUNNING in the file and in the table, with no segments.
    const checkpointPath = join(tap.dir, 'transcript-checkpoint.json');
    const file = JSON.parse(readFileSync(checkpointPath, 'utf8')) as { chunks: Record<string, unknown>[] };
    file.chunks[2] = { ...file.chunks[2]!, status: 'RUNNING' };
    writeFileSync(checkpointPath, JSON.stringify(file));
    await store.update(SESSION, 3, { status: 'RUNNING', segments: null, modelId: 'GGML_LARGE_V3_TURBO', computedAt: null });
    const committed = (await store.read(SESSION)).slice(0, 2);
    expect((await store.read(SESSION)).map((entry) => entry.status)).toEqual(['DONE', 'DONE', 'RUNNING', 'PENDING']);

    // A NEW process on the same scratch directory and the same table.
    const resumed = pipeline(store, tap, adapter);
    expect(await resumed.runner.step({ final: true })).toMatchObject({ planned: 0, decoded: 2, reused: 2, complete: true });
    const starts = resumed.runner.checkpoint().chunks.map((chunk) => chunk.startMs);
    expect(adapter.decoded).toEqual(starts); // every chunk handed to the engine exactly once, over both processes
    const rows = await store.read(SESSION);
    expect(rows.map((entry) => entry.status)).toEqual(['DONE', 'DONE', 'DONE', 'DONE']);
    expect(rows.slice(0, 2)).toEqual(committed);
  });
});
