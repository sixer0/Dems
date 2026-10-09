// FINALIZE_TRANSCRIPT against PostgreSQL (blueprint row 79 / M6-W4), under the RUNTIME ROLE
// `dems_app` on a throw-away clone of this run (`useTestDatabase`): no live database is touched
// and this row adds no migration.
//
// What is real here that the unit test replaces: the journal is `sealing_jobs`, the chunk rows
// are `transcript_chunks` written by the REAL transcriber runner through the Core's own store
// (its mirror port), and the transcript is committed with its evidence item in ONE unit of work
// through the sealed-transcript store of row 78.
//
//   1. the step journal on `sealing_jobs`, with what migration 0005 grants and what it does not;
//   2. the four outcomes — READY, PARTIAL (chunks failed), PARTIAL (audio unavailable), labels
//      UNAVAILABLE — and DISABLED: the right summary, the right item columns, the right rows;
//   3. idempotent: the step and the commit called twice = one transcript row, the same hash;
//   4. M6-KR-1 at the FINALIZE step: a stop at each durable boundary, then a resume on a new
//      connection: the same transcript hash, no chunk decoded again;
//   5. negative controls: a tampered committed transcript is refused by hash; an item that is
//      not bound to the transcript rolls everything back.
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import type { ChunkMirror } from '@dems/transcriber';
import type { Pool, PoolClient } from 'pg';
import { beforeAll, describe, expect, it } from 'vitest';
import { evidenceItem, insertRow, sessionHistory } from '../../../test/db/fixtures';
import { SQLSTATE, expectRefused, inTransaction } from '../../../test/db/support';
import { useTestDatabase } from '../../../test/helpers/db';
import { createTranscriptChunkStore, failedChunkCount, summariseChunkAttempts } from '../../modules/transcript-chunks';
import { TranscriptStoreError, createTranscriptStore } from '../../modules/transcripts';
import {
  FINALIZE_TRANSCRIPT_STEP,
  FinalizeTranscriptError,
  SEALING_STEP_STATES,
  SealingStepJournalError,
  commitSealedTranscript,
  createSealingStepJournal,
  createTranscriptFileReader,
  evidenceTranscriptSummary,
  finalizeTranscript,
  systemStepTimer,
  type FinalizeTranscriptPorts,
  type FinalizeTranscriptResult,
  type FinalizedTranscript,
  type Queryable,
  type SttConfigSnapshot,
} from '../index';
import { memoryErrorLog, snapshotOf, transcribedSession, type SessionOptions, type TranscribedSession } from './support';

const db = useTestDatabase({ template: 'seed', slug: 'row79' });
let app: Pool;
let owner: Pool;
let operatorId: string;

const queryable = (runner: Pool | PoolClient): Queryable => ({ query: (text, values) => runner.query(text, values === undefined ? [] : [...values]) });
const sha256 = (path: string): string => createHash('sha256').update(readFileSync(path)).digest('hex');

let counter = 0;
/** A fresh pair per use: the runtime role cannot delete what a test stored, so no test reuses a key. */
function identifiers(): { sessionId: string; evidenceId: string } {
  counter += 1;
  const tail = String(7950 + counter).padStart(4, '0');
  return { sessionId: `SES-20261009-${tail}`, evidenceId: `EV-20261009-${tail}` };
}

interface Rig {
  readonly ids: { sessionId: string; evidenceId: string };
  readonly session: TranscribedSession;
  readonly log: ReturnType<typeof memoryErrorLog>;
  ports(overrides?: Partial<FinalizeTranscriptPorts>): FinalizeTranscriptPorts;
  run(snapshot?: SttConfigSnapshot, attempt?: number, overrides?: Partial<FinalizeTranscriptPorts>): Promise<FinalizeTranscriptResult>;
}

function rig(options: Omit<SessionOptions, 'mirror'> = {}): Rig {
  const ids = identifiers();
  // THE REAL MIRROR: the transcriber writes its chunk rows through the Core's store, as `dems_app`.
  const mirror: ChunkMirror = createTranscriptChunkStore(queryable(app));
  const session = transcribedSession(ids.sessionId, { ...options, mirror });
  const log = memoryErrorLog();
  let tick = 1_791_529_000_000;
  const ports = (overrides: Partial<FinalizeTranscriptPorts> = {}): FinalizeTranscriptPorts => ({
    transcript: session.seam,
    chunkRows: createTranscriptChunkStore(queryable(app)),
    files: createTranscriptFileReader(),
    journal: createSealingStepJournal(queryable(app)),
    log,
    now: () => (tick += 1_000),
    timer: systemStepTimer,
    ...overrides,
  });
  return { ids, session, log, ports, run: (snapshot = snapshotOf({ backend: options.backend ?? 'cpu-local' }), attempt = 1, overrides = {}) => finalizeTranscript({ sessionId: ids.sessionId, sttSnapshot: snapshot, attempt }, ports(overrides)) };
}

function done(result: FinalizeTranscriptResult): Extract<FinalizeTranscriptResult, { status: 'DONE' }> {
  if (result.status !== 'DONE') throw new Error(`the step answered ${result.status}`);
  return result;
}

const CREATED_AT = 1_791_529_500_000;

/**
 * THE UNIT OF WORK OF ROWS 82 / 83, as the runtime role: the item INSERT carries the three sealed
 * columns of the step's answer, then the transcript row is committed on the same connection.
 */
async function sealItem(ids: { sessionId: string; evidenceId: string }, transcript: FinalizedTranscript, options: { boundTo?: string | null; afterCommit?: () => void } = {}): Promise<Awaited<ReturnType<typeof commitSealedTranscript>>> {
  return inTransaction(app, async (client) => {
    const caseNumber = `LP/2026/1009-${ids.sessionId.slice(-4)}`;
    await insertRow(client, 'session_history', sessionHistory({ id: ids.sessionId, case_number: caseNumber, investigator_id: operatorId }));
    await insertRow(
      client,
      'evidence_items',
      evidenceItem({
        id: ids.evidenceId,
        session_id: ids.sessionId,
        case_number: caseNumber,
        investigator_id: operatorId,
        manifest_version: transcript.itemColumns.manifestVersion,
        transcript_sha256: options.boundTo === undefined ? transcript.itemColumns.transcriptSha256 : options.boundTo,
        labels_status: transcript.itemColumns.labelsStatus,
      }),
    );
    const result = await commitSealedTranscript(createTranscriptStore(queryable(client)), { evidenceId: ids.evidenceId, transcript, createdAt: CREATED_AT });
    options.afterCommit?.();
    return result;
  });
}

const stored = async (ids: { sessionId: string; evidenceId: string }): Promise<{ item: Record<string, unknown> | undefined; transcripts: Record<string, unknown>[]; job: Record<string, unknown> | undefined }> => ({
  item: (await owner.query('SELECT manifest_version::int AS manifest_version, transcript_sha256, labels_status FROM public.evidence_items WHERE id = $1', [ids.evidenceId])).rows[0],
  transcripts: (await owner.query('SELECT json_sha256, srt_sha256, vtt_sha256, labels_status, model, diarization, created_at::bigint::text AS created_at FROM public.transcripts WHERE evidence_id = $1', [ids.evidenceId])).rows,
  job: (await owner.query('SELECT status, progress, attempt, error_code, checkpoint, started_at::bigint::text AS started_at, updated_at::bigint::text AS updated_at FROM public.sealing_jobs WHERE session_id = $1 AND step = $2', [ids.sessionId, FINALIZE_TRANSCRIPT_STEP])).rows[0],
});

async function refusal<E extends Error>(kind: new (...args: never[]) => E, run: Promise<unknown>): Promise<E> {
  let caught: unknown;
  try {
    await run;
  } catch (error) {
    caught = error;
  }
  expect(caught).toBeInstanceOf(kind);
  return caught as E;
}

const failMiddle = (offsetMs: number): Error | null => (offsetMs > 40_000 && offsetMs < 60_000 ? new Error('the engine ended with an error') : null);

beforeAll(async () => {
  app = db.appPool();
  owner = db.ownerPool();
  operatorId = ((await owner.query('SELECT id FROM public.operators ORDER BY id LIMIT 1')).rows[0] as { id: string }).id;
});

describe('the database this file runs on', () => {
  it('the pools are the runtime role and the owner, never the administrator', async () => {
    expect((await app.query('SELECT current_user AS role')).rows[0]).toEqual({ role: 'dems_app' });
    expect((await owner.query('SELECT current_user AS role')).rows[0]).toEqual({ role: 'dems_owner' });
  });
});

describe('the step journal on `sealing_jobs` (dbc-3 §B.4), as dems_app', () => {
  it('a row is inserted, then only its seven granted columns change: `started_at` and the key are written once', async () => {
    const { sessionId } = identifiers();
    const journal = createSealingStepJournal(queryable(app));
    expect(await journal.read(sessionId, FINALIZE_TRANSCRIPT_STEP)).toBeNull();
    await journal.write({ sessionId, step: FINALIZE_TRANSCRIPT_STEP, status: 'RUNNING', progress: 33, etaMs: null, attempt: 1, checkpoint: { committed: false }, errorCode: null, at: 1_000 });
    expect(await journal.read(sessionId, FINALIZE_TRANSCRIPT_STEP)).toEqual({ sessionId, step: FINALIZE_TRANSCRIPT_STEP, status: 'RUNNING', progress: 33, etaMs: null, attempt: 1, checkpoint: { committed: false }, errorCode: null, startedAt: 1_000, updatedAt: 1_000 });
    await journal.write({ sessionId, step: FINALIZE_TRANSCRIPT_STEP, status: 'FAILED', progress: 0, etaMs: 0, attempt: 2, checkpoint: null, errorCode: 'TRANSCRIBER_FAILED', at: 2_000 });
    expect(await journal.read(sessionId, FINALIZE_TRANSCRIPT_STEP)).toEqual({ sessionId, step: FINALIZE_TRANSCRIPT_STEP, status: 'FAILED', progress: 0, etaMs: 0, attempt: 2, checkpoint: null, errorCode: 'TRANSCRIBER_FAILED', startedAt: 1_000, updatedAt: 2_000 });
    // Another step of the same session is another row.
    await journal.write({ sessionId, step: 'CLOSE_TRACKS', status: 'DONE', progress: 100, etaMs: null, attempt: 1, checkpoint: { tracks: 2 }, errorCode: null, at: 500 });
    expect((await owner.query('SELECT count(*)::int AS n FROM public.sealing_jobs WHERE session_id = $1', [sessionId])).rows[0]).toEqual({ n: 2 });
  });

  it('the three states are the table\'s value set, and what the table refuses is a typed failure with the constraint name', async () => {
    const { sessionId } = identifiers();
    const journal = createSealingStepJournal(queryable(app));
    const base = { sessionId, step: FINALIZE_TRANSCRIPT_STEP, progress: 0, etaMs: null, attempt: 1, checkpoint: null, errorCode: null, at: 1 };
    for (const status of SEALING_STEP_STATES) await journal.write({ ...base, status });
    const cases: readonly (readonly [Record<string, unknown>, string])[] = [
      [{ status: 'PAUSED' }, 'sealing_jobs_status_check'],
      [{ status: 'RUNNING', progress: 101 }, 'sealing_jobs_progress_check'],
      [{ status: 'RUNNING', attempt: 0 }, 'sealing_jobs_attempt_check'],
      [{ status: 'RUNNING', checkpoint: ['not', 'an', 'object'] }, 'sealing_jobs_checkpoint_check'],
      [{ status: 'FAILED', errorCode: 'not a code' }, 'sealing_jobs_error_code_check'],
      [{ status: 'RUNNING', sessionId: 'SES-1' }, 'sealing_jobs_session_check'],
    ];
    for (const [change, constraint] of cases) {
      const error = await refusal(SealingStepJournalError, journal.write({ ...base, ...change } as never));
      expect([error.code, error.sqlState, error.constraint]).toEqual(['WRITE_FAILED', SQLSTATE.checkViolation, constraint]);
    }
  });

  it('PRIVILEGES: no DELETE, no UPDATE of `started_at`, `step` or `session_id` (42501); a granted column can be updated (control)', async () => {
    const { sessionId } = identifiers();
    await createSealingStepJournal(queryable(app)).write({ sessionId, step: FINALIZE_TRANSCRIPT_STEP, status: 'RUNNING', progress: 0, etaMs: null, attempt: 1, checkpoint: null, errorCode: null, at: 1 });
    await expectRefused(() => app.query('DELETE FROM public.sealing_jobs WHERE session_id = $1', [sessionId]), SQLSTATE.insufficientPrivilege);
    await expectRefused(() => app.query('UPDATE public.sealing_jobs SET started_at = 5 WHERE session_id = $1', [sessionId]), SQLSTATE.insufficientPrivilege);
    await expectRefused(() => app.query("UPDATE public.sealing_jobs SET step = 'SIGN_MANIFEST' WHERE session_id = $1", [sessionId]), SQLSTATE.insufficientPrivilege);
    expect((await app.query('UPDATE public.sealing_jobs SET progress = 10 WHERE session_id = $1', [sessionId])).rowCount).toBe(1);
  });
});

describe('the outcomes: the summary, the item columns and the rows, committed in ONE unit of work as dems_app', () => {
  it('READY (labelled): item v2 bound to the SHA-256 of the document file, labels LABELLED, one transcript row, the step DONE at 100', async () => {
    const r = rig();
    await r.session.finish();
    const { transcript } = done(await r.run());
    expect(await sealItem(r.ids, transcript)).toEqual({ outcome: 'WRITTEN', jsonSha256: sha256(r.session.files.json) });

    const rows = await stored(r.ids);
    const fileHash = sha256(r.session.files.json);
    expect(rows.item).toEqual({ manifest_version: 2, transcript_sha256: fileHash, labels_status: 'LABELLED' });
    expect(rows.transcripts).toEqual([
      {
        json_sha256: fileHash,
        srt_sha256: sha256(r.session.files.srt),
        vtt_sha256: sha256(r.session.files.vtt),
        labels_status: 'LABELLED',
        model: transcript.transcriptRow?.model,
        diarization: { numSpeakers: 2, status: 'LABELLED', confidence: 1, reason: null },
        created_at: String(CREATED_AT),
      },
    ]);
    expect(rows.job).toMatchObject({ status: 'DONE', progress: 100, attempt: 1, error_code: null, checkpoint: { committed: true, manifest: { state: 'ASSEMBLED', sha256: fileHash, failedChunks: 0 } } });
    // The summary of the slice, with the head of the revision chain read from the store.
    const head = await createTranscriptStore(queryable(app)).revisionHead(r.ids.evidenceId);
    expect(head).toEqual({ revisionNo: 0, parentSha256: fileHash });
    expect(evidenceTranscriptSummary(transcript.manifest, head.revisionNo)).toEqual({ state: 'READY', sha256: fileHash, machineTranscriptHash: fileHash, labelsStatus: 'LABELLED', revision: 0, failedChunks: 0, backendUnreachable: false });
    expect(r.log.entries).toEqual([]);
  });

  it('PARTIAL (a chunk failed all its attempts): the step is DONE, the item is sealed with the hash of the partial document, the rows say one failed chunk', async () => {
    const r = rig({ fail: failMiddle });
    await r.session.finish();
    const { transcript } = done(await r.run());
    await sealItem(r.ids, transcript);
    const rows = await stored(r.ids);
    expect(rows.item).toEqual({ manifest_version: 2, transcript_sha256: sha256(r.session.files.json), labels_status: transcript.manifest.speakerState });
    expect(rows.transcripts).toHaveLength(1);
    expect(rows.job).toMatchObject({ status: 'DONE', progress: 100, error_code: null, checkpoint: { manifest: { state: 'PARTIAL', failedChunks: 1, backendUnreachable: false }, partialReason: 'CHUNKS_FAILED', counters: { chunks: 3, failedChunks: 1, segments: 4 }, failedChunksByRows: 1 } });
    expect(evidenceTranscriptSummary(transcript.manifest, 0)).toMatchObject({ state: 'PARTIAL', failedChunks: 1, backendUnreachable: false });

    // The table agrees: three chunk rows, the middle one FAILED and without segments; the document has no text in its range.
    const chunkRows = await createTranscriptChunkStore(queryable(app)).read(r.ids.sessionId);
    expect(chunkRows.map((row) => [row.status, row.segments === null ? null : row.segments.length])).toEqual([['DONE', 2], ['FAILED', null], ['DONE', 2]]);
    const gap = chunkRows[1];
    const document = JSON.parse(readFileSync(r.session.files.json, 'utf8')) as { segments: { start_ms: number; end_ms: number }[] };
    expect(document.segments).toHaveLength(4);
    for (const segment of document.segments) expect(segment.end_ms <= (gap?.audioFromMs ?? 0) || segment.start_ms >= (gap?.audioToMs ?? 0)).toBe(true);
  });

  it('PARTIAL (the audio never reached the transcriber): the reason travels in the step answer, the item is sealed the same way', async () => {
    const r = rig({ tapLost: true });
    await r.session.finish();
    const { transcript } = done(await r.run());
    await sealItem(r.ids, transcript);
    const rows = await stored(r.ids);
    expect(rows.item?.['transcript_sha256']).toBe(sha256(r.session.files.json));
    expect(rows.job).toMatchObject({ status: 'DONE', checkpoint: { manifest: { state: 'PARTIAL', failedChunks: 0 }, partialReason: 'TRANSCRIPT_AUDIO_UNAVAILABLE' } });
    expect(evidenceTranscriptSummary(transcript.manifest, 0)).toMatchObject({ state: 'PARTIAL', failedChunks: 0 });
  });

  it('labels UNAVAILABLE (no speaker engine): item column and transcript row say UNAVAILABLE, with the reason in the row', async () => {
    const r = rig({ diarizer: null });
    await r.session.finish();
    const { transcript } = done(await r.run());
    await sealItem(r.ids, transcript);
    const rows = await stored(r.ids);
    expect(rows.item).toMatchObject({ manifest_version: 2, labels_status: 'UNAVAILABLE' });
    expect(rows.transcripts[0]).toMatchObject({ labels_status: 'UNAVAILABLE', diarization: { numSpeakers: 0, status: 'UNAVAILABLE', confidence: null, reason: 'ENGINE_NOT_CONFIGURED' } });
    expect(evidenceTranscriptSummary(transcript.manifest, 0)).toMatchObject({ state: 'READY', labelsStatus: 'UNAVAILABLE' });
  });

  it('DISABLED: the step is DONE without the transcriber; the item is v2 with NO transcript hash and NO speaker state, and no transcript row exists', async () => {
    const r = rig();
    const { transcript } = done(await r.run(snapshotOf({ enabled: false })));
    expect(r.session.seam.assembleCalls).toBe(0);
    expect(await sealItem(r.ids, transcript)).toEqual({ outcome: 'NO_TRANSCRIPT' });
    const rows = await stored(r.ids);
    expect(rows.item).toEqual({ manifest_version: 2, transcript_sha256: null, labels_status: null });
    expect(rows.transcripts).toEqual([]);
    expect(rows.job).toMatchObject({ status: 'DONE', progress: 100, checkpoint: { manifest: { state: 'DISABLED', disabledReason: 'DISABLED_BY_CONFIGURATION', sha256: null } } });
    expect(evidenceTranscriptSummary(transcript.manifest, 0)).toEqual({ state: 'DISABLED', sha256: null, machineTranscriptHash: null, labelsStatus: null, revision: 0, backendUnreachable: false });
  });
});

describe('N-7 on the real table: a FAILED row with a later DONE row for the same range is not a failed chunk', () => {
  it('four rows for three chunks; the plain count says 1, the rule says 0, the sealed transcript says ASSEMBLED with 0', async () => {
    let failing = true;
    const r = rig({ fail: (offsetMs) => (failing ? failMiddle(offsetMs) : null) });
    await r.session.runner.step({ final: true });
    failing = false;
    expect(r.session.runner.retryFailed()).toBe(1);
    await r.session.finish();

    const rows = await createTranscriptChunkStore(queryable(app)).read(r.ids.sessionId);
    expect(rows.map((row) => [row.seq, row.status])).toEqual([[1, 'DONE'], [2, 'FAILED'], [3, 'DONE'], [4, 'DONE']]);
    expect([rows[1]?.audioFromMs, rows[1]?.audioToMs]).toEqual([rows[3]?.audioFromMs, rows[3]?.audioToMs]);
    expect((await owner.query("SELECT count(*)::int AS n FROM public.transcript_chunks WHERE session_id = $1 AND status = 'FAILED'", [r.ids.sessionId])).rows[0]).toEqual({ n: 1 });
    expect(failedChunkCount(rows)).toBe(0);
    expect(summariseChunkAttempts(rows)).toMatchObject({ total: 3, done: 3, failed: 0, failedRows: 1 });

    const { transcript } = done(await r.run());
    expect([transcript.manifest.state, transcript.manifest.failedChunks, transcript.failedChunksByRows]).toEqual(['ASSEMBLED', 0, 0]);
    expect(r.log.entries).toEqual([]);
  });
});

describe('IDEMPOTENT: the step and the commit called twice = ONE transcript row, the SAME hash', () => {
  it('the second step call reads the committed row back and asks the transcriber nothing; the second commit writes nothing', async () => {
    const r = rig({ fail: failMiddle });
    await r.session.finish();
    const first = done(await r.run());
    expect(await sealItem(r.ids, first.transcript)).toMatchObject({ outcome: 'WRITTEN' });
    const before = await stored(r.ids);
    const decoded = r.session.decoded.length;

    const second = done(await r.run());
    expect([second.resumed, r.session.seam.assembleCalls, r.session.decoded.length]).toEqual([true, 1, decoded]);
    expect(second.transcript).toEqual(first.transcript);
    // The commit again, in a unit of work of its own (the item exists): nothing is written.
    const again = await inTransaction(app, (client) => commitSealedTranscript(createTranscriptStore(queryable(client)), { evidenceId: r.ids.evidenceId, transcript: second.transcript, createdAt: CREATED_AT + 99 }));
    expect(again).toEqual({ outcome: 'ALREADY_COMMITTED', jsonSha256: first.transcript.manifest.sha256 });

    const after = await stored(r.ids);
    expect(after.transcripts).toEqual(before.transcripts);
    expect(after.transcripts).toHaveLength(1);
    expect(after.item).toEqual(before.item);
    expect(after.job).toEqual(before.job); // same attempt, already DONE: the journal row was not even rewritten
  });

  it('another transcript for an item that has one is refused, and the stored one is untouched', async () => {
    const r = rig();
    await r.session.finish();
    const { transcript } = done(await r.run());
    await sealItem(r.ids, transcript);
    const other = rig({ diarizer: null });
    await other.session.finish();
    const second = done(await other.run()).transcript;
    const error = await refusal(FinalizeTranscriptError, inTransaction(app, (client) => commitSealedTranscript(createTranscriptStore(queryable(client)), { evidenceId: r.ids.evidenceId, transcript: second, createdAt: CREATED_AT })));
    expect(error.code).toBe('SEALED_TRANSCRIPT_DIFFERS');
    expect((await stored(r.ids)).transcripts.map((row) => row['json_sha256'])).toEqual([transcript.manifest.sha256]);
  });
});

describe('M6-KR-1 at the FINALIZE step: stopped at a durable boundary, resumed on a new connection — the same transcript hash', () => {
  it('stopped after the transcriber assembled, before `sealing_jobs` said DONE: the resume commits the same hash, and no chunk is decoded again', async () => {
    const r = rig();
    await r.session.finish();
    // The connection of the first Core "dies" at the DONE write.
    const dying: Queryable = {
      query: (text, values) => {
        if (/INSERT INTO public\.sealing_jobs/.test(text) && values?.[2] === 'DONE') return Promise.reject(Object.assign(new Error('terminating connection due to administrator command'), { code: '57P01' }));
        return queryable(app).query(text, values);
      },
    };
    const stopped = await refusal(FinalizeTranscriptError, r.run(snapshotOf(), 1, { journal: createSealingStepJournal(dying) }));
    expect(stopped.code).toBe('STORE_FAILED');
    expect(r.log.entries).toMatchObject([{ level: 'error', code: 'STORE_FAILED', context: { what: 'journal.write', causeCode: 'WRITE_FAILED', sqlState: '57P01', correlationId: r.ids.sessionId } }]);
    const hashAtStop = sha256(r.session.files.json);
    expect((await stored(r.ids)).job).toMatchObject({ status: 'RUNNING', checkpoint: { committed: false } });
    const decoded = r.session.decoded.length;

    // A restarted Core: a new seam on the same scratch directory, the pool again, attempt 2.
    const resumed = done(await r.run(snapshotOf(), 2, { transcript: r.session.freshSeam() }));
    expect(resumed.transcript.manifest.sha256).toBe(hashAtStop);
    expect(sha256(r.session.files.json)).toBe(hashAtStop);
    expect(r.session.decoded.length).toBe(decoded);
    expect((await stored(r.ids)).job).toMatchObject({ status: 'DONE', attempt: 2, started_at: '1791529001000', checkpoint: { manifest: { sha256: hashAtStop } } });
  });

  it('stopped inside the unit of work that commits the item and the transcript: NEITHER exists; the resume commits both, with the same hash', async () => {
    const r = rig();
    await r.session.finish();
    const first = done(await r.run());
    await expect(
      sealItem(r.ids, first.transcript, {
        afterCommit: () => {
          throw new Error('the process was stopped before COMMIT');
        },
      }),
    ).rejects.toThrow('stopped before COMMIT');
    const rolledBack = await stored(r.ids);
    expect([rolledBack.item, rolledBack.transcripts]).toEqual([undefined, []]);
    expect(rolledBack.job).toMatchObject({ status: 'DONE' }); // the step's own commit stands

    const resumed = done(await r.run(snapshotOf(), 2, { transcript: r.session.freshSeam() }));
    expect(resumed.resumed).toBe(true);
    expect(resumed.transcript).toEqual(first.transcript);
    expect(await sealItem(r.ids, resumed.transcript)).toEqual({ outcome: 'WRITTEN', jsonSha256: first.transcript.manifest.sha256 });
    const rows = await stored(r.ids);
    expect([rows.item?.['transcript_sha256'], rows.transcripts.map((row) => row['json_sha256'])]).toEqual([first.transcript.manifest.sha256, [first.transcript.manifest.sha256]]);
    expect(rows.job).toMatchObject({ status: 'DONE', attempt: 2 });
  });
});

describe('NEGATIVE CONTROLS', () => {
  it('a committed transcript whose file was changed afterwards is refused by its hash: the row says FAILED with the code and KEEPS the committed checkpoint; restored, it is DONE with the same hash', async () => {
    const r = rig();
    await r.session.finish();
    const committed = done(await r.run());
    const checkpoint = (await stored(r.ids)).job?.['checkpoint'];
    const original = readFileSync(r.session.files.json);
    writeFileSync(r.session.files.json, original.toString('utf8').replace('Keterangan saksi 1-0.', 'Keterangan saksi 1-9.'));

    const error = await refusal(FinalizeTranscriptError, r.run(snapshotOf(), 2));
    expect([error.code, error.detail]).toEqual(['TRANSCRIPT_HASH_MISMATCH', { file: 'json', against: 'COMMITTED' }]);
    const failed = (await stored(r.ids)).job;
    expect(failed).toMatchObject({ status: 'FAILED', error_code: 'TRANSCRIPT_HASH_MISMATCH', attempt: 2 });
    expect(failed?.['checkpoint']).toEqual(checkpoint);
    expect(r.session.seam.assembleCalls).toBe(1);

    writeFileSync(r.session.files.json, original);
    const again = done(await r.run(snapshotOf(), 3));
    expect([again.resumed, again.transcript.manifest.sha256]).toEqual([true, committed.transcript.manifest.sha256]);
    expect((await stored(r.ids)).job).toMatchObject({ status: 'DONE', error_code: null, attempt: 3, checkpoint });
  });

  it('an item that is not bound to the transcript hash (one character differs, or no hash): TRANSCRIPT_HASH_NOT_BOUND, and item, history row and transcript are all rolled back', async () => {
    const r = rig();
    await r.session.finish();
    const { transcript } = done(await r.run());
    const hash = transcript.manifest.sha256 ?? '';
    for (const boundTo of [`${hash.slice(0, 63)}${hash.endsWith('0') ? '1' : '0'}`, null]) {
      const error = await refusal(TranscriptStoreError, sealItem(r.ids, transcript, { boundTo }));
      expect(error.code).toBe('TRANSCRIPT_HASH_NOT_BOUND');
      const rows = await stored(r.ids);
      expect([rows.item, rows.transcripts]).toEqual([undefined, []]);
      expect((await owner.query('SELECT count(*)::int AS n FROM public.session_history WHERE id = $1', [r.ids.sessionId])).rows[0]).toEqual({ n: 0 });
    }
    // CONTROL: bound to exactly the hash, the same unit of work commits.
    expect(await sealItem(r.ids, transcript)).toMatchObject({ outcome: 'WRITTEN' });
  });

  it('the sealed columns of the item cannot be changed afterwards by the runtime role (42501): they are written by the INSERT or never', async () => {
    const r = rig();
    await r.session.finish();
    const { transcript } = done(await r.run());
    await sealItem(r.ids, transcript);
    for (const column of ['transcript_sha256', 'labels_status', 'manifest_version']) {
      await expectRefused(() => app.query(`UPDATE public.evidence_items SET ${column} = NULL WHERE id = $1`, [r.ids.evidenceId]), SQLSTATE.insufficientPrivilege);
    }
    await expectRefused(() => app.query('UPDATE public.transcripts SET labels_status = $2 WHERE evidence_id = $1', [r.ids.evidenceId, 'UNAVAILABLE']), SQLSTATE.insufficientPrivilege);
  });
});
