// The seal-side transcript states of R-8 against PostgreSQL (blueprint row 116), under the RUNTIME
// ROLE `dems_app` on a throw-away clone of this run (`useTestDatabase`): no live database is
// touched and this row adds no migration.
//
// The seal clauses of `M6-STTCFG-OFF` and `M6-STTCFG-UNREACH` where the unit test has stand-ins:
// the journal is `sealing_jobs` (so the waiting budget of the step is DURABLE), the chunk rows are
// `transcript_chunks` written by the real transcriber runner through the Core's own store, and the
// item is committed with what the step answered in one unit of work. The backend is the stand-in
// engine of `support.ts`; the bounds are counted on a hand-moved clock. No process, no model.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import type { ChunkMirror } from '@dems/transcriber';
import { TranscriberError } from '@dems/transcriber';
import type { Pool, PoolClient } from 'pg';
import { beforeAll, describe, expect, it } from 'vitest';
import { evidenceItem, insertRow, sessionHistory } from '../../../test/db/fixtures';
import { inTransaction } from '../../../test/db/support';
import { useTestDatabase } from '../../../test/helpers/db';
import { createTranscriptChunkStore, summariseChunkAttempts } from '../../modules/transcript-chunks';
import { createTranscriptStore } from '../../modules/transcripts';
import {
  FINALIZE_TRANSCRIPT_STEP,
  commitSealedTranscript,
  createSealingStepJournal,
  createTranscriptFileReader,
  finalizeTranscript,
  waitLimitOf,
  type FinalizeTranscriptLimits,
  type FinalizeTranscriptResult,
  type FinalizedTranscript,
  type Queryable,
  type SttConfigSnapshot,
} from '../index';
import { manualClock, memoryErrorLog, snapshotOf, transcribedSession, type SessionOptions, type TranscribedSession } from './support';

const db = useTestDatabase({ template: 'seed', slug: 'row116' });
let app: Pool;
let owner: Pool;
let operatorId: string;

const queryable = (runner: Pool | PoolClient): Queryable => ({ query: (text, values) => runner.query(text, values === undefined ? [] : [...values]) });
const sha256 = (path: string): string => createHash('sha256').update(readFileSync(path)).digest('hex');
const LIMITS: FinalizeTranscriptLimits = { stepLimitMs: 600_000, callLimitMs: 30_000, closeOutLimitMs: 60_000 };

let counter = 0;
function identifiers(): { sessionId: string; evidenceId: string } {
  counter += 1;
  const tail = String(8150 + counter).padStart(4, '0');
  return { sessionId: `SES-20261009-${tail}`, evidenceId: `EV-20261009-${tail}` };
}

interface Rig {
  readonly ids: { sessionId: string; evidenceId: string };
  readonly session: TranscribedSession;
  readonly log: ReturnType<typeof memoryErrorLog>;
  readonly clock: ReturnType<typeof manualClock>;
  /** A NEW journal and a new chunk store per call: nothing of the wait is kept in memory. */
  run(snapshot?: SttConfigSnapshot, attempt?: number): Promise<FinalizeTranscriptResult>;
}

function rig(options: Omit<SessionOptions, 'mirror'> = {}): Rig {
  const ids = identifiers();
  const mirror: ChunkMirror = createTranscriptChunkStore(queryable(app));
  const session = transcribedSession(ids.sessionId, { ...options, mirror });
  const log = memoryErrorLog();
  const clock = manualClock();
  return {
    ids,
    session,
    log,
    clock,
    run: (snapshot = snapshotOf({ backend: options.backend ?? 'cpu-local' }), attempt = 1) =>
      finalizeTranscript(
        { sessionId: ids.sessionId, sttSnapshot: snapshot, attempt, limits: LIMITS },
        { transcript: session.seam, chunkRows: createTranscriptChunkStore(queryable(app)), files: createTranscriptFileReader(), journal: createSealingStepJournal(queryable(app)), log, now: clock.now, timer: clock.timer },
      ),
  };
}

function done(result: FinalizeTranscriptResult): Extract<FinalizeTranscriptResult, { status: 'DONE' }> {
  if (result.status !== 'DONE') throw new Error(`the step answered ${result.status}`);
  return result;
}

/** The unit of work of rows 82 / 83, as the runtime role: the item with its sealed columns, then the transcript row. */
async function sealItem(ids: { sessionId: string; evidenceId: string }, transcript: FinalizedTranscript): Promise<Awaited<ReturnType<typeof commitSealedTranscript>>> {
  return inTransaction(app, async (client) => {
    const caseNumber = `LP/2026/1009-${ids.sessionId.slice(-4)}`;
    await insertRow(client, 'session_history', sessionHistory({ id: ids.sessionId, case_number: caseNumber, investigator_id: operatorId }));
    await insertRow(client, 'evidence_items', evidenceItem({ id: ids.evidenceId, session_id: ids.sessionId, case_number: caseNumber, investigator_id: operatorId, manifest_version: transcript.itemColumns.manifestVersion, transcript_sha256: transcript.itemColumns.transcriptSha256, labels_status: transcript.itemColumns.labelsStatus }));
    return commitSealedTranscript(createTranscriptStore(queryable(client)), { evidenceId: ids.evidenceId, transcript, createdAt: 1_791_529_500_000 });
  });
}

const stored = async (ids: { sessionId: string; evidenceId: string }): Promise<{ item: Record<string, unknown> | undefined; transcripts: number; job: Record<string, unknown> | undefined; chunkRows: string[] }> => ({
  item: (await owner.query('SELECT manifest_version::int AS manifest_version, transcript_sha256, labels_status FROM public.evidence_items WHERE id = $1', [ids.evidenceId])).rows[0],
  transcripts: Number((await owner.query('SELECT count(*)::int AS n FROM public.transcripts WHERE evidence_id = $1', [ids.evidenceId])).rows[0]?.n),
  job: (await owner.query('SELECT status, progress, attempt, error_code, checkpoint, (updated_at - started_at)::bigint::text AS lived_ms FROM public.sealing_jobs WHERE session_id = $1 AND step = $2', [ids.sessionId, FINALIZE_TRANSCRIPT_STEP])).rows[0],
  chunkRows: (await owner.query('SELECT status FROM public.transcript_chunks WHERE session_id = $1 ORDER BY seq', [ids.sessionId])).rows.map((row: { status: string }) => row.status),
});

const texts = (path: string): string[] => (JSON.parse(readFileSync(path, 'utf8')) as { segments: { text: string }[] }).segments.map((segment) => segment.text);
const unreachable = (): Error => new TranscriberError('UNREACHABLE', 'the transcriber backend could not be reached', { reason: 'UNREACHABLE' });

beforeAll(async () => {
  app = db.appPool();
  owner = db.ownerPool();
  operatorId = ((await owner.query('SELECT id FROM public.operators ORDER BY id LIMIT 1')).rows[0] as { id: string }).id;
});

describe('the database this file runs on', () => {
  it('is the runtime role on schema version 6 / dbc-7, and this row brought no migration', async () => {
    expect((await app.query('SELECT current_user AS role')).rows[0]).toEqual({ role: 'dems_app' });
    const meta = (await owner.query('SELECT schema_version, contract_revision FROM public.schema_meta')).rows[0] as { schema_version: number; contract_revision: string };
    expect([Number(meta.schema_version), meta.contract_revision]).toEqual([6, 'dbc-7']); // set 7 (PE-0013-01)
  });
});

describe('M6-STTCFG-OFF (seal clause) on the real tables', () => {
  it('disabled: no chunk row was ever written, the step row is DONE after ONE write, and the item is sealed v2 with no transcript', async () => {
    const r = rig();
    const { transcript, files } = done(await r.run(snapshotOf({ enabled: false })));
    expect([files, r.session.seam.assembleCalls, r.session.seam.closeOutCalls, r.session.decoded.length, r.clock.armed()]).toEqual([null, 0, 0, 0, 0]);
    expect(await sealItem(r.ids, transcript)).toEqual({ outcome: 'NO_TRANSCRIPT' });
    const rows = await stored(r.ids);
    expect(rows.chunkRows).toEqual([]);
    expect(rows.item).toEqual({ manifest_version: 2, transcript_sha256: null, labels_status: null });
    expect(rows.transcripts).toBe(0);
    expect(rows.job).toMatchObject({ status: 'DONE', progress: 100, attempt: 1, error_code: null, lived_ms: '0', checkpoint: { committed: true, manifest: { state: 'DISABLED', disabledReason: 'DISABLED_BY_CONFIGURATION', backendUnreachable: false, sha256: null, file: null, failedChunks: null, revisionHead: null, configSnapshot: { enabled: false } } } });
    expect(r.log.entries).toEqual([]);
  });

  it('NEGATIVE CONTROL: chunk rows of a disabled session in `transcript_chunks` are found by the step and written to the persistent log; the seal stays DISABLED', async () => {
    const r = rig();
    await r.session.finish();
    const { transcript } = done(await r.run(snapshotOf({ enabled: false })));
    expect((await stored(r.ids)).chunkRows).toEqual(['DONE', 'DONE', 'DONE']);
    expect(r.log.entries).toMatchObject([{ level: 'error', context: { reason: 'DISABLED_SESSION_HAS_CHUNK_ROWS', rows: 3 } }]);
    expect(transcript.manifest).toMatchObject({ state: 'DISABLED', sha256: null });
    expect(transcript.transcriptRow).toBeNull();
  });
});

describe('M6-STTCFG-UNREACH (seal clause) on the real tables', () => {
  it('the backend refuses connections: three FAILED rows, the step DONE at its first call, the item sealed with the hash of a PARTIAL document that holds no text', async () => {
    const r = rig({ backend: 'omlx-server', fail: unreachable });
    await r.session.finish();
    const { transcript } = done(await r.run());
    expect([r.clock.armed(), r.session.seam.closeOutCalls]).toEqual([0, 0]);
    expect(await sealItem(r.ids, transcript)).toMatchObject({ outcome: 'WRITTEN' });
    const rows = await stored(r.ids);
    expect(rows.chunkRows).toEqual(['FAILED', 'FAILED', 'FAILED']);
    expect(rows.item).toEqual({ manifest_version: 2, transcript_sha256: sha256(r.session.files.json), labels_status: transcript.manifest.speakerState });
    expect(rows.transcripts).toBe(1);
    expect(rows.job).toMatchObject({ status: 'DONE', progress: 100, error_code: null, checkpoint: { manifest: { state: 'PARTIAL', failedChunks: 3, backendUnreachable: true, disabledReason: null }, partialReason: 'CHUNKS_FAILED', counters: { chunks: 3, failedChunks: 3, segments: 0 }, failedChunksByRows: 3 } });
    expect(texts(r.session.files.json)).toEqual([]);
  });

  it('the backend hangs: the wait is counted in `sealing_jobs`, and at the bound the step is DONE — one committed chunk sealed, two given up as FAILED rows without text', async () => {
    let reach: () => void = () => undefined;
    const reached = new Promise<void>((resolve) => void (reach = resolve));
    const r = rig({
      backend: 'omlx-server',
      engineGate: (offsetMs) => {
        if (offsetMs < 40_000) return Promise.resolve();
        reach();
        return new Promise<void>(() => undefined);
      },
    });
    void r.session.runner.step({ final: true });
    await reached;

    const startedAt = r.clock.now();
    const first = await r.run();
    expect(first).toMatchObject({ status: 'WAITING', progress: 33, remainingWaitMs: waitLimitOf(LIMITS) });
    r.clock.advance(10_000);
    expect(await r.run()).toMatchObject({ status: 'WAITING', remainingWaitMs: waitLimitOf(LIMITS) - 10_000 });
    // DURABLE: the row, not this process, holds how long the step has waited.
    expect((await stored(r.ids)).job).toMatchObject({ status: 'RUNNING', progress: 33, checkpoint: { committed: false, waitedMs: 10_000, chunksTotal: 3, chunksDone: 1, chunksFailed: 0 } });

    let result: FinalizeTranscriptResult = first;
    let calls = 0;
    while (result.status !== 'DONE') {
      if ((calls += 1) > 200) throw new Error('THE STEP WAITED FOR EVER');
      r.clock.advance(Math.min(10_000, result.remainingWaitMs));
      result = await r.run();
    }
    expect(r.clock.now() - startedAt).toBeLessThanOrEqual(LIMITS.stepLimitMs);
    expect(r.clock.now() - startedAt).toBeGreaterThanOrEqual(waitLimitOf(LIMITS));

    const { transcript } = result;
    expect(transcript.manifest).toMatchObject({ state: 'PARTIAL', failedChunks: 2, backendUnreachable: true, sha256: sha256(r.session.files.json) });
    expect(transcript.waitLimitReached).toBe(true);
    expect(await sealItem(r.ids, transcript)).toMatchObject({ outcome: 'WRITTEN' });
    const rows = await stored(r.ids);
    // The chunk rule on the real rows: one committed chunk, two failed CHUNKS.
    const summary = summariseChunkAttempts(await createTranscriptChunkStore(queryable(app)).read(r.ids.sessionId));
    expect([summary.total, summary.done, summary.failed]).toEqual([3, 1, 2]);
    expect(rows.item).toMatchObject({ manifest_version: 2, transcript_sha256: sha256(r.session.files.json) });
    expect(rows.job).toMatchObject({ status: 'DONE', progress: 100, error_code: null, checkpoint: { committed: true, waitLimitReached: true, manifest: { state: 'PARTIAL', failedChunks: 2, backendUnreachable: true }, failedChunksByRows: 2 } });
    expect(texts(r.session.files.json)).toEqual(['Keterangan saksi 1-0.', 'Keterangan saksi 1-1.']);
    expect(r.session.decoded).toHaveLength(2);
  });
});
