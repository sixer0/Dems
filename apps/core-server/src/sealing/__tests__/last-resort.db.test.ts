// THE LAST RESORT OF `FINALIZE_TRANSCRIPT` against PostgreSQL (blueprint row 119, decision D110),
// under the RUNTIME ROLE `dems_app` on a throw-away clone of this run (`useTestDatabase`): no live
// database is touched and this row adds no migration.
//
// Where the unit test has stand-ins: the journal is `sealing_jobs` (so the count of failures at
// the bound is DURABLE — a new journal object per call, nothing kept in memory), the chunk rows
// are `transcript_chunks` written by the real transcriber runner through the Core's own store,
// and the item is committed with what the step answered in one unit of work. The close-out that
// fails is a stand-in seam; the bounds are counted on a hand-moved clock. No process, no model.
import type { ChunkMirror } from '@dems/transcriber';
import type { Pool, PoolClient } from 'pg';
import { beforeAll, describe, expect, it } from 'vitest';
import { evidenceItem, insertRow, sessionHistory } from '../../../test/db/fixtures';
import { inTransaction } from '../../../test/db/support';
import { useTestDatabase } from '../../../test/helpers/db';
import { createTranscriptChunkStore } from '../../modules/transcript-chunks';
import { createTranscriptStore } from '../../modules/transcripts';
import {
  FINALIZE_TRANSCRIPT_STEP,
  FinalizeTranscriptError,
  commitSealedTranscript,
  createSealingStepJournal,
  createTranscriptFileReader,
  finalizeTranscript,
  type AssembledTranscriptSource,
  type FinalizeTranscriptLimits,
  type FinalizeTranscriptResult,
  type FinalizedTranscript,
  type Queryable,
} from '../index';
import { manualClock, memoryErrorLog, snapshotOf, transcribedSession, type TranscribedSession } from './support';

const db = useTestDatabase({ template: 'seed', slug: 'row119' });
let app: Pool;
let owner: Pool;
let operatorId: string;

const queryable = (runner: Pool | PoolClient): Queryable => ({ query: (text, values) => runner.query(text, values === undefined ? [] : [...values]) });
const LIMITS: FinalizeTranscriptLimits = { stepLimitMs: 600_000, callLimitMs: 30_000, closeOutLimitMs: 60_000 };

let counter = 0;
function identifiers(): { sessionId: string; evidenceId: string } {
  counter += 1;
  const tail = String(8350 + counter).padStart(4, '0');
  return { sessionId: `SES-20261009-${tail}`, evidenceId: `EV-20261009-${tail}` };
}

interface Rig {
  readonly ids: { sessionId: string; evidenceId: string };
  readonly session: TranscribedSession;
  readonly log: ReturnType<typeof memoryErrorLog>;
  readonly clock: ReturnType<typeof manualClock>;
  /** One call with a NEW journal and a new chunk store: nothing of the count is kept in memory. Answers the result or the code of its failure. */
  call(options?: { attempt?: number; sealWithoutTranscript?: boolean }): Promise<FinalizeTranscriptResult | string>;
}

/** A session whose engine committed chunk 1 and hangs on chunk 2, and whose close-out hands nothing over. */
async function rig(): Promise<Rig> {
  const ids = identifiers();
  const mirror: ChunkMirror = createTranscriptChunkStore(queryable(app));
  let reach: () => void = () => undefined;
  const reached = new Promise<void>((resolve) => void (reach = resolve));
  const session = transcribedSession(ids.sessionId, {
    backend: 'omlx-server',
    mirror,
    engineGate: (offsetMs) => {
      if (offsetMs < 40_000) return Promise.resolve();
      reach();
      return new Promise<void>(() => undefined);
    },
  });
  void session.runner.step({ final: true });
  await reached;
  const log = memoryErrorLog();
  const clock = manualClock();
  const failing: AssembledTranscriptSource = { ...session.seam, assemble: async () => ({ kind: 'NOT_READY' }), closeOut: async () => ({ kind: 'NOT_READY' }) };
  return {
    ids,
    session,
    log,
    clock,
    call: async (options = {}) => {
      try {
        return await finalizeTranscript(
          { sessionId: ids.sessionId, sttSnapshot: snapshotOf({ backend: 'omlx-server' }), attempt: options.attempt ?? 1, limits: LIMITS, backendUnreachable: true, ...(options.sealWithoutTranscript === undefined ? {} : { sealWithoutTranscript: options.sealWithoutTranscript }) },
          { transcript: failing, chunkRows: createTranscriptChunkStore(queryable(app)), files: createTranscriptFileReader(), journal: createSealingStepJournal(queryable(app)), log, now: clock.now, timer: clock.timer },
        );
      } catch (error) {
        if (!(error instanceof FinalizeTranscriptError)) throw error;
        return error.code;
      }
    },
  };
}

/** Calls the step while it answers WAITING; returns the first answer that is not WAITING. */
async function untilTheBound(r: Rig): Promise<FinalizeTranscriptResult | string> {
  for (let calls = 0; calls < 200; calls += 1) {
    const answer = await r.call();
    if (typeof answer === 'string' || answer.status !== 'WAITING') return answer;
    r.clock.advance(Math.min(10_000, answer.remainingWaitMs));
  }
  throw new Error('THE STEP WAITED FOR EVER');
}

function done(answer: FinalizeTranscriptResult | string): Extract<FinalizeTranscriptResult, { status: 'DONE' }> {
  if (typeof answer === 'string' || answer.status !== 'DONE') throw new Error(`the step answered ${typeof answer === 'string' ? answer : answer.status}`);
  return answer;
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

const job = async (sessionId: string): Promise<Record<string, unknown> | undefined> =>
  (await owner.query('SELECT status, progress, attempt, error_code, checkpoint FROM public.sealing_jobs WHERE session_id = $1 AND step = $2', [sessionId, FINALIZE_TRANSCRIPT_STEP])).rows[0];
const chunkRows = async (sessionId: string): Promise<string[]> => (await owner.query('SELECT status FROM public.transcript_chunks WHERE session_id = $1 ORDER BY seq', [sessionId])).rows.map((row: { status: string }) => row.status);

beforeAll(async () => {
  app = db.appPool();
  owner = db.ownerPool();
  operatorId = ((await owner.query('SELECT id FROM public.operators ORDER BY id LIMIT 1')).rows[0] as { id: string }).id;
});

describe('the database this file runs on', () => {
  it('is the runtime role on schema version 7 / dbc-8, and this row brought no migration', async () => {
    expect((await app.query('SELECT current_user AS role')).rows[0]).toEqual({ role: 'dems_app' });
    const meta = (await owner.query('SELECT schema_version, contract_revision FROM public.schema_meta')).rows[0] as { schema_version: number; contract_revision: string };
    expect([Number(meta.schema_version), meta.contract_revision]).toEqual([7, 'dbc-8']);
  });
});

describe('D110 on the real tables: the count of failures at the bound is in `sealing_jobs`, and the fourth call seals without a transcript', () => {
  it('three failed close-outs, each counted in the row; then DONE — the item sealed v2 with no transcript hash and no row of `transcripts`', async () => {
    const r = await rig();
    expect(await untilTheBound(r)).toBe('TRANSCRIPT_CLOSE_OUT_FAILED');
    expect(await job(r.ids.sessionId)).toMatchObject({ status: 'FAILED', error_code: 'TRANSCRIPT_CLOSE_OUT_FAILED', checkpoint: { committed: false, boundFailures: 1, lastBoundFailure: 'TRANSCRIPT_CLOSE_OUT_FAILED' } });
    expect(await r.call({ attempt: 2 })).toBe('TRANSCRIPT_CLOSE_OUT_FAILED');
    expect(await r.call({ attempt: 3 })).toBe('TRANSCRIPT_CLOSE_OUT_FAILED');
    // DURABLE: the row, not this process, holds the count.
    expect(await job(r.ids.sessionId)).toMatchObject({ status: 'FAILED', attempt: 3, error_code: 'TRANSCRIPT_CLOSE_OUT_FAILED', checkpoint: { committed: false, boundFailures: 3 } });

    const { transcript, files } = done(await r.call({ attempt: 4 }));
    expect(files).toBeNull();
    expect(transcript.manifest).toMatchObject({ state: 'PARTIAL', disabledReason: 'TRANSCRIPT_UNAVAILABLE_AT_SEAL', file: null, sha256: null, srtSha256: null, vttSha256: null, revisionHead: null, failedChunks: 3, backendUnreachable: true, configSnapshot: { enabled: true, backend: 'omlx-server' } });
    expect(transcript.unavailable).toEqual({ by: 'ATTEMPT_BOUND', failures: 3, lastFailure: 'TRANSCRIPT_CLOSE_OUT_FAILED' });

    // THE TRANSITION IN THE JOURNAL ROW: DONE, the error code cleared, and how the state was reached.
    expect(await job(r.ids.sessionId)).toMatchObject({
      status: 'DONE',
      progress: 100,
      attempt: 4,
      error_code: null,
      checkpoint: { committed: true, waitLimitReached: true, manifest: { state: 'PARTIAL', disabledReason: 'TRANSCRIPT_UNAVAILABLE_AT_SEAL', sha256: null, failedChunks: 3 }, unavailable: { by: 'ATTEMPT_BOUND', failures: 3, lastFailure: 'TRANSCRIPT_CLOSE_OUT_FAILED' }, counters: { chunks: 3, failedChunks: 3, segments: 0 } },
    });

    // The item: version 2, no transcript hash, no label state; no row of `transcripts`.
    expect(await sealItem(r.ids, transcript)).toEqual({ outcome: 'NO_TRANSCRIPT' });
    expect((await owner.query('SELECT manifest_version::int AS manifest_version, transcript_sha256, labels_status FROM public.evidence_items WHERE id = $1', [r.ids.evidenceId])).rows[0]).toEqual({ manifest_version: 2, transcript_sha256: null, labels_status: null });
    expect(Number((await owner.query('SELECT count(*)::int AS n FROM public.transcripts WHERE evidence_id = $1', [r.ids.evidenceId])).rows[0]?.n)).toBe(0);

    // NOTHING WAS MADE UP AND NOTHING TAKEN AWAY: the chunk rows are as the transcriber left them (one committed), and the step wrote none.
    const rows = await chunkRows(r.ids.sessionId);
    expect(rows).toHaveLength(3);
    expect(rows.filter((status) => status === 'DONE')).toHaveLength(1);
    expect(rows).not.toContain('FAILED');
    expect(JSON.stringify(await job(r.ids.sessionId))).not.toContain('Keterangan');

    // A resumed seal (a new process) reads the committed state back from the row.
    const again = done(await r.call({ attempt: 5 }));
    expect([again.resumed, again.transcript.manifest]).toEqual([true, transcript.manifest]);
    expect(r.log.entries.filter((entry) => entry.code === 'TRANSCRIPT_UNAVAILABLE_AT_SEAL')).toHaveLength(1);
  });

  it('the caller gives the transcript up after ONE failure counted in the row; without a counted failure the flag changes nothing', async () => {
    const r = await rig();
    // Before the bound, with the flag: the step waits. The row holds no count.
    expect(await r.call({ sealWithoutTranscript: true })).toMatchObject({ status: 'WAITING' });
    expect(await job(r.ids.sessionId)).not.toHaveProperty('checkpoint.boundFailures');
    expect(await untilTheBound(r)).toBe('TRANSCRIPT_CLOSE_OUT_FAILED');
    const { transcript } = done(await r.call({ attempt: 2, sealWithoutTranscript: true }));
    expect(transcript.unavailable).toEqual({ by: 'CALLER', failures: 1, lastFailure: 'TRANSCRIPT_CLOSE_OUT_FAILED' });
    expect(await job(r.ids.sessionId)).toMatchObject({ status: 'DONE', error_code: null, checkpoint: { manifest: { state: 'PARTIAL', disabledReason: 'TRANSCRIPT_UNAVAILABLE_AT_SEAL' }, unavailable: { by: 'CALLER', failures: 1 } } });
    expect(await sealItem(r.ids, transcript)).toEqual({ outcome: 'NO_TRANSCRIPT' });
  });
});
