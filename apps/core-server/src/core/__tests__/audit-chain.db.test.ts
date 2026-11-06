// The audit writer on the append protocol, against the real PostgreSQL, as `dems_app` (plan row
// W21; database contract §6.4 AP-1 to AP-7, §6.5 T-CH-1 and T-CH-2; spec SR-52, SR-53, SR-65;
// AC-B-54, AC-B-55).
//
// One clone of the schema template for the file. The code under test is the app's own pipeline
// and, for real concurrency between connections, further pipelines on pools of their own: each
// is a separate session of `dems_app`, as a second server process on the database would be.
// `dems_owner` only inserts the fixtures and reads the result.
import { appendActivity, type ActivitySlices, type AuditRow } from '@dems/shared/sim';
import type { Pool } from 'pg';
import { beforeAll, describe, expect, it } from 'vitest';
import { AUDIT_INSERT as RAW_AUDIT_INSERT, coreState, insertRbac, insertRow, nextAuditRow } from '../../../test/db/fixtures';
import { connect, refusalOf, runtimePool, until, waitingLocks, type Refusal } from '../../../test/db/support';
import { useTestDatabase } from '../../../test/helpers/db';
import { CoreError, PipelineFailure } from '../errors';
import { createPipeline } from '../pipeline';
import type { CommittedUnit, Pipeline } from '../types';
import {
  CLOCK_START,
  GENESIS,
  coreApp,
  linkProblems,
  readEventCounter,
  readEvents,
  readHead,
  readTrail,
  sleep,
  verifyTrail,
  type CoreApp,
} from './support';

const db = useTestDatabase({ template: 'schema' });
let core: CoreApp;
let owner: Pool;

beforeAll(async () => {
  owner = db.ownerPool();
  await insertRbac(owner);
  await insertRow(owner, 'core_state', coreState());
  await insertRow(owner, 'engine_counters', { name: 'event', next_value: 1 });
  core = await coreApp(db, db.run.dataDir);
});

const range = (from: number, count: number): number[] => Array.from({ length: count }, (_, index) => from + index);

/** A pipeline on a pool of its own with one connection: a separate session of `dems_app`. */
function separatePipelines(count: number): Pipeline[] {
  return range(0, count).map(() => {
    const pool = runtimePool(db.runtime, 1, 'dems-w21-writer');
    db.onCleanup(() => pool.end());
    return createPipeline({ pool: () => pool, clock: core.clock, log: core.app.log, errorLog: core.app.errorLog });
  });
}

/** The whole stored chain, checked three ways: the links, the head, the shared verification. */
async function expectChainVerifies(): Promise<AuditRow[]> {
  const rows = await readTrail(owner);
  const head = await readHead(owner);
  const last = rows[rows.length - 1];
  expect(linkProblems(rows)).toEqual([]);
  expect(head).toEqual({ seq: last?.seq ?? 0, hash: last?.hash ?? GENESIS });
  expect(verifyTrail(rows, head)).toEqual({ ok: true, checked: rows.length, head: head.hash });
  return rows;
}

describe('AC-B-54: 50 concurrent appends give a chain that the shared verification accepts', () => {
  it('50 units submitted at once to the one pipeline: 50 rows, in the order of submission (ENG-6)', async () => {
    const before = await readHead(owner);
    expect(before).toEqual({ seq: 0, hash: GENESIS });

    const appended = await Promise.all(
      range(0, 50).map((index) =>
        core.app.pipeline.run('test.append', async (unit) => {
          await unit.audit.head(); // AP-2: the head row is locked from here to the COMMIT
          await sleep((index * 7) % 20);
          return unit.audit.append({
            type: 'SYSTEM_BOOT',
            actorId: null,
            deviceId: null,
            message: `Unit ${index}`,
            details: { index },
          });
        }),
      ),
    );

    expect(appended.map((row) => row.seq)).toEqual(range(1, 50));
    expect(appended.map((row) => row.details['index'])).toEqual(range(0, 50));
    const rows = await expectChainVerifies();
    expect(rows).toHaveLength(50);
    expect(rows).toEqual(appended);
    console.info(`[w21] one pipeline: 50 units, seq 1..50 without a gap; verifyAuditChain ok=true over ${rows.length} rows`);
  });

  it('50 appends from 10 pipelines on 10 separate connections, at once (T-CH-1): no error, no gap', async () => {
    const before = await readHead(owner);
    const pipelines = separatePipelines(10);
    let inFlight = 0;
    let mostInFlight = 0;
    let mostWaiting = 0;
    let watching = true;
    const watcher = (async () => {
      while (watching) {
        mostWaiting = Math.max(mostWaiting, await waitingLocks(owner));
        await sleep(3);
      }
    })();

    const outcomes = await Promise.allSettled(
      range(0, 50).map((index) =>
        (pipelines[index % 10] as Pipeline).run('test.concurrent', async (unit) => {
          inFlight += 1;
          mostInFlight = Math.max(mostInFlight, inFlight);
          try {
            await unit.audit.head(); // waits here while another connection holds the head row
            await sleep((index * 13) % 20);
            return await unit.audit.append({
              type: 'WRITE_VERIFIED',
              actorId: null,
              deviceId: null,
              message: `Concurrent writer ${index}`,
              details: { writer: index % 10, index },
            });
          } finally {
            inFlight -= 1;
          }
        }),
      ),
    );
    watching = false;
    await watcher;

    const failures = outcomes.filter((outcome) => outcome.status === 'rejected');
    expect(failures).toEqual([]);
    const seqs = outcomes.map((outcome) => (outcome.status === 'fulfilled' ? outcome.value.seq : -1)).sort((a, b) => a - b);
    expect(seqs).toEqual(range(before.seq + 1, 50));
    expect(mostInFlight).toBe(10);
    expect(mostWaiting).toBeGreaterThanOrEqual(1);

    const rows = await expectChainVerifies();
    expect(rows).toHaveLength(before.seq + 50);
    for (const pipeline of pipelines) expect(pipeline.snapshot()).toMatchObject({ completed: 5, failed: 0, timedOut: 0 });
    console.info(
      `[w21] ten connections: 50 commits, 0 errors; ${mostInFlight} units in flight at once, up to ${mostWaiting} waiting on the head row; ` +
        `seq ${before.seq + 1}..${before.seq + 50} without a gap; verifyAuditChain ok=true over ${rows.length} rows`,
    );
  });
});

describe('a writer that skips the lock is refused with SQLSTATE ZA001', () => {
  it('a raw insert with a sequence of its own (a gap), and one with a wrong previous hash', async () => {
    const client = await connect(db.runtime, 'dems-w21-raw');
    db.onCleanup(() => client.end());
    const head = await readHead(owner);
    const count = (await readTrail(owner)).length;

    const gap = nextAuditRow({ seq: head.seq + 1, hash: head.hash }, { message: 'A row two ahead of the head' });
    const gapRefusal = refusalOf(await client.query(RAW_AUDIT_INSERT, Object.values(gap)).then(() => null, (error: unknown) => error));
    expect(gapRefusal.code).toBe('ZA001');
    expect(gapRefusal.message).toBe(`audit chain: row ${head.seq + 2} does not continue head ${head.seq}`);

    const wrongLink = nextAuditRow({ seq: head.seq, hash: 'f'.repeat(64) }, { message: 'The right sequence on a wrong hash' });
    const linkRefusal = refusalOf(await client.query(RAW_AUDIT_INSERT, Object.values(wrongLink)).then(() => null, (error: unknown) => error));
    expect(linkRefusal.code).toBe('ZA001');

    expect(await readHead(owner)).toEqual(head);
    expect(await readTrail(owner)).toHaveLength(count);
    console.info(`[w21] raw insert without the lock: gap row ${gapRefusal.code} ("${gapRefusal.message}"); wrong previous hash ${linkRefusal.code}`);
  });

  it('a raw insert that read the head without the lock while a unit holds it: it waits, then ZA001', async () => {
    const client = await connect(db.runtime, 'dems-w21-raw');
    db.onCleanup(() => client.end());
    let enter!: () => void;
    let release!: () => void;
    const entered = new Promise<void>((resolve) => (enter = resolve));
    const gate = new Promise<void>((resolve) => (release = resolve));

    const unitDone = core.app.pipeline.run('test.holder', async (unit) => {
      await unit.audit.head();
      enter();
      await gate;
      return unit.audit.append({ type: 'SYSTEM_BOOT', actorId: null, deviceId: null, message: 'The unit that held the lock', details: {} });
    });
    await entered;

    // A plain SELECT: no lock. The row it builds is right for this head, and stale by the time
    // the guard trigger gets the head row.
    const stale = await readHead(owner);
    const row = nextAuditRow(stale, { message: 'A writer that skipped the lock' });
    const raw: Promise<Refusal | 'inserted'> = client.query(RAW_AUDIT_INSERT, Object.values(row)).then(
      () => 'inserted' as const,
      (error: unknown) => refusalOf(error),
    );
    await until(async () => (await waitingLocks(owner)) >= 1, 'the raw insert waits on the head row');
    release();

    const appended = await unitDone;
    const outcome = await raw;
    expect(appended.seq).toBe(stale.seq + 1);
    expect(outcome).not.toBe('inserted');
    expect((outcome as Refusal).code).toBe('ZA001');
    expect((outcome as Refusal).message).toBe(`audit chain: row ${stale.seq + 1} does not continue head ${stale.seq + 1}`);

    const rows = await expectChainVerifies();
    expect(rows[rows.length - 1]).toEqual(appended);
    expect(rows.some((stored) => stored.message === 'A writer that skipped the lock')).toBe(false);
    console.info(`[w21] race: the unit committed seq ${appended.seq}; the raw insert waited and got ${(outcome as Refusal).code}`);
  });
});

describe('the rows of one unit are contiguous', () => {
  it('four rows from three calls with pauses between them, while four other connections append', async () => {
    const others = separatePipelines(4);
    const before = await readHead(owner);

    const [mine, ...theirs] = await Promise.all([
      core.app.pipeline.run('test.contiguous', async (unit) => {
        const first = await unit.audit.append({ type: 'SESSION_CREATED', actorId: 'OPR-001', deviceId: null, message: 'One', details: {} });
        await sleep(15);
        const middle = await unit.audit.appendMany([
          { type: 'MARKER_ADDED', actorId: 'OPR-001', deviceId: null, message: 'Two', details: { index: 1 } },
          { type: 'NOTE_ADDED', actorId: 'OPR-001', deviceId: null, message: 'Three', details: { index: 2 } },
        ]);
        await sleep(15);
        const last = await unit.audit.append({ type: 'SESSION_CANCELLED', actorId: 'OPR-001', deviceId: null, message: 'Four', details: {} });
        expect(unit.audit.appended().map((row) => row.seq)).toEqual([first.seq, ...middle.map((row) => row.seq), last.seq]);
        return [first, ...middle, last];
      }),
      ...range(0, 12).map((index) =>
        (others[index % 4] as Pipeline).run('test.other', (unit) =>
          unit.audit.append({ type: 'FRAME_HASH', actorId: null, deviceId: null, message: `Other ${index}`, details: { index } }),
        ),
      ),
    ]);

    const seqs = (mine as AuditRow[]).map((row) => row.seq);
    expect(seqs).toEqual(range(seqs[0] as number, 4));
    expect((mine as AuditRow[]).map((row) => row.message)).toEqual(['One', 'Two', 'Three', 'Four']);
    expect(theirs).toHaveLength(12);
    const rows = await expectChainVerifies();
    expect(rows).toHaveLength(before.seq + 16);
    console.info(`[w21] one unit's four rows: seq ${seqs.join(', ')}; 12 rows of four other connections around them`);
  });
});

describe('AC-B-55: every `at` follows the injected clock', () => {
  it('a row carries the clock value of its call; a batch shares one; the clock moves, the next row follows', async () => {
    core.clock.set(CLOCK_START + 10_000);
    const first = await core.app.pipeline.run('test.clock', (unit) =>
      unit.audit.append({ type: 'TIMESTAMP_CONFIRMED', actorId: null, deviceId: null, message: 'At the first instant', details: {} }),
    );
    expect(first.at).toBe(CLOCK_START + 10_000);

    core.clock.advance(1_234);
    const { batch, event } = await core.app.pipeline.run('test.clock', async (unit) => ({
      batch: await unit.audit.appendMany([
        { type: 'TIMESTAMP_CONFIRMED', actorId: null, deviceId: null, message: 'Batch one', details: {} },
        { type: 'TIMESTAMP_CONFIRMED', actorId: null, deviceId: null, message: 'Batch two', details: {} },
      ]),
      event: await unit.events.append({ type: 'TIME_SYNC', message: 'Time synchronised' }),
    }));
    expect(batch.map((row) => row.at)).toEqual([CLOCK_START + 11_234, CLOCK_START + 11_234]);
    expect(event.at).toBe(CLOCK_START + 11_234);

    const stored = await readTrail(owner);
    expect(stored.slice(-3).map((row) => row.at)).toEqual([CLOCK_START + 10_000, CLOCK_START + 11_234, CLOCK_START + 11_234]);
    expect((await readEvents(owner)).at(-1)?.at).toBe(CLOCK_START + 11_234);
  });

  it('no stored row of this file carries a wall-clock time: each lies between the two values the manual clock had', async () => {
    const rows = await readTrail(owner);
    const wall = Date.now();
    expect(rows.length).toBeGreaterThan(100);
    for (const row of rows) {
      expect(row.at).toBeGreaterThanOrEqual(CLOCK_START);
      expect(row.at).toBeLessThanOrEqual(core.clock.now());
      expect(Math.abs(row.at - wall)).toBeGreaterThan(365 * 24 * 3_600_000);
    }
    const sorted = [...rows].sort((a, b) => a.seq - b.seq);
    expect(sorted.every((row, index) => index === 0 || row.at >= (sorted[index - 1] as AuditRow).at)).toBe(true);
  });

  it('an entry cannot set a time, a sequence, a category or a hash: it is refused before a statement is sent (SR-65)', async () => {
    const head = await readHead(owner);
    for (const extra of [{ at: 1 }, { seq: 1 }, { category: 'AUTH' }, { hash: 'a'.repeat(64) }, { id: 'AUD-000001' }]) {
      const entry = { type: 'SYSTEM_BOOT', actorId: null, deviceId: null, message: 'With a member of its own', details: {}, ...extra };
      const error = await core.app.pipeline.run('test.entry', (unit) => unit.audit.append(entry as never)).then(
        () => null,
        (thrown: unknown) => thrown,
      );
      expect(error).toBeInstanceOf(CoreError);
      expect((error as CoreError).code).toBe('AUDIT_ENTRY_INVALID');
    }
    expect(await readHead(owner)).toEqual(head);
  });
});

describe('AP-6: rows the engine built in memory', () => {
  /** The engine's side: the shared `appendActivity` on a state whose ring ends at the stored head. */
  async function engineActivity(): Promise<ActivitySlices> {
    const head = await readHead(owner);
    const counter = await readEventCounter(owner);
    const state = {
      audit: { rows: [], head: head.hash, total: head.seq, dropped: head.seq },
      events: [],
      meta: { counters: { event: counter } },
    } as unknown as ActivitySlices;
    return appendActivity(state, core.clock.now(), [
      {
        audit: {
          type: 'RECORDING_STARTED',
          message: 'Recording started',
          actorId: 'OPR-001',
          sessionId: 'SES-20310101-0001',
          details: { profile: 'STANDARD_1080P25' },
        },
        event: { type: 'RECORDING_STARTED', message: 'Recording started', sessionId: 'SES-20310101-0001' },
      },
      { audit: { type: 'FAULT_RAISED', message: 'Fault raised', severity: 'CRITICAL', details: { kind: 'STORAGE_LOW' } } },
      { event: { type: 'FAULT_RAISED', message: 'Fault raised', severity: 'CRITICAL', params: { kind: 'STORAGE_LOW' } } },
    ]);
  }

  it('are stored exactly as built, events and counter with them, and reported to the commit listener', async () => {
    const activity = await engineActivity();
    const seen: CommittedUnit[] = [];
    const remove = core.app.pipeline.onCommit((unit) => seen.push(unit));
    await core.app.pipeline.run('test.engine', async (unit) => {
      await unit.audit.appendPrepared(activity.audit.rows);
      await unit.events.appendPrepared(activity.events);
    });
    remove();

    const rows = await expectChainVerifies();
    expect(rows.slice(-2)).toEqual(activity.audit.rows);
    const events = await readEvents(owner);
    expect(events.slice(-2).map((event) => ({ ...event, category: undefined }))).toEqual(
      activity.events.map((event) => ({ ...event, category: undefined })),
    );
    // FAULT_RAISED takes the category of its fault kind (the shared `eventCategory`).
    expect(events.slice(-2).map((event) => event.category)).toEqual(['SESSION', 'STORAGE']);
    expect(await readEventCounter(owner)).toBe(activity.meta.counters.event);

    expect(seen).toHaveLength(1);
    expect(seen[0]).toMatchObject({ label: 'test.engine', auditRows: activity.audit.rows, events: activity.events });
    expect(seen[0]?.head).toEqual(await readHead(owner));
  });

  it('that do not continue the stored head: 503, the log line with both sequence numbers, nothing stored', async () => {
    const activity = await engineActivity();
    // Another writer moves the head between the engine's build and its unit.
    await core.app.pipeline.run('test.native', (unit) =>
      unit.audit.append({ type: 'SYSTEM_BOOT', actorId: null, deviceId: null, message: 'A server-native row', details: {} }),
    );
    const head = await readHead(owner);
    const stale = activity.audit.rows;

    const error = await core.app.pipeline.run('test.engine', (unit) => unit.audit.appendPrepared(stale)).then(
      () => null,
      (thrown: unknown) => thrown,
    );
    expect(error).toBeInstanceOf(PipelineFailure);
    expect(error).toMatchObject({ statusCode: 503, code: 'NOT_READY', reason: 'AUDIT_HEAD_DIVERGED' });
    expect(await readHead(owner)).toEqual(head);

    const line = core.log.lines().filter((entry) => entry['msg'] === 'audit head diverged').at(-1);
    expect(line).toMatchObject({ code: 'AUDIT_HEAD_DIVERGED', headSeq: head.seq, rowSeq: stale[0]?.seq, label: 'test.engine' });
  });

  it('whose digest is not the shared one: refused before a statement is sent', async () => {
    const activity = await engineActivity();
    const head = await readHead(owner);
    const [row] = activity.audit.rows;
    const altered = { ...(row as AuditRow), message: `${(row as AuditRow).message} [altered]` };
    const error = await core.app.pipeline.run('test.engine', (unit) => unit.audit.appendPrepared([altered])).then(
      () => null,
      (thrown: unknown) => thrown,
    );
    expect(error).toBeInstanceOf(CoreError);
    expect((error as CoreError).code).toBe('AUDIT_ROW_HASH_MISMATCH');
    expect(await readHead(owner)).toEqual(head);
  });
});

describe('at the end of the file', () => {
  it('the whole chain still verifies, and its head is the last row', async () => {
    const rows = await expectChainVerifies();
    console.info(`[w21] end of file: ${rows.length} rows, verifyAuditChain ok=true, head at seq ${rows.length}`);
  });
});
