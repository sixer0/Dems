// Decision D134 against the real server: what a test file states it needs, and what the helper
// makes of it where it matters.
//
//   - the two floors a file states are what the runner holds for it, and what a test of the file
//     is given: above the caps of decision D114, never below them;
//   - the connect floor reaches the two real pools of that clone, TI-14 keeps its ceilings, and
//     the queries answer; a need stated later reaches its own clone only, and cannot change the
//     limit of the test that is already running;
//   - a need that is no number of milliseconds is refused before the helper asks the cluster for
//     anything;
//   - the request for a quiet cluster reads the clone-lock queue KEYED BY ITSELF (finding F-8):
//     it leaves its own session out, it leaves a lock of another key out, it waits no longer
//     than its bound, it ends nobody's session, and the clone happens either way.
//
// The rules without a cluster: `needs.test.ts`. The caps that need no statement: `limits.db.test.ts`.
import type { Pool } from 'pg';
import { describe, expect, it } from 'vitest';
import {
  CLONE_LOCK_KEY,
  CLUSTER_QUIET_BUDGET_MS,
  DB_HOOK_TIMEOUT_MS,
  DB_TEST_TIMEOUT_MS,
  LOCK_CLASS,
  LOG_PREFIX,
} from '../constants';
import { TestRun, currentTestLimits, useTestDatabase, withTestDatabase } from '../index';
import { SELFTEST_TEMPLATE } from '../testing/probe-hooks';
import { probeResolver } from '../testing/private-run';

const TEST_FLOOR = 240_000;
const HOOK_FLOOR = 210_000;
const CONNECT_FLOOR = 20_000;
const SHORT_BUDGET_MS = 200;
/** An advisory lock key of the same class that is not the clone lock: a liveness key. */
const OTHER_KEY = 4_242_424;

/** Stated at the top level, as a file states it: before any hook or test of this file is registered. */
const db = useTestDatabase({
  template: SELFTEST_TEMPLATE,
  needs: { testTimeoutMs: TEST_FLOOR, hookTimeoutMs: HOOK_FLOOR, connectTimeoutMs: CONNECT_FLOOR },
});

/** A pool of the owner role on this file's clone, of exactly one connection. */
function singleConnectionPool(applicationName: string): Pool {
  return db.run.poolOn(db.name, 'owner', applicationName);
}

/** One statement over a pool, with the values inlined by the caller (numbers only). */
async function ask(pool: Pool, text: string): Promise<Array<Record<string, unknown>>> {
  return (await pool.query(text)).rows as Array<Record<string, unknown>>;
}

/**
 * The helper's own predicate over `pg_locks`, and the same predicate without the keying: in ONE
 * statement, so that the two counts are one snapshot of the cluster.
 */
async function cloneLockRows(pool: Pool): Promise<{ allKeys: number; cloneLock: number; cloneLockNotMine: number }> {
  const rows = await ask(
    pool,
    'SELECT count(*)::int AS "allKeys", ' +
      `count(*) FILTER (WHERE objid = ${CLONE_LOCK_KEY})::int AS "cloneLock", ` +
      `count(*) FILTER (WHERE objid = ${CLONE_LOCK_KEY} AND pid <> pg_backend_pid())::int AS "cloneLockNotMine" ` +
      `FROM pg_locks WHERE locktype = 'advisory' AND classid = ${LOCK_CLASS}`,
  );
  const row = rows[0] ?? {};
  return { allKeys: Number(row['allKeys']), cloneLock: Number(row['cloneLock']), cloneLockNotMine: Number(row['cloneLockNotMine']) };
}

async function backendPid(pool: Pool): Promise<number> {
  return Number((await ask(pool, 'SELECT pg_backend_pid() AS pid'))[0]?.['pid'] ?? -1);
}

/** A second session on this run, with a short bound for its request for a quiet cluster. */
function impatientRun(): Promise<TestRun> {
  return TestRun.attach(db.run.identity, { resolveDefinition: probeResolver(), clusterQuietBudgetMs: SHORT_BUDGET_MS });
}

describe('a database test file that states its needs', () => {
  it('holds the two floors the file stated, above the caps of decision D114', () => {
    const limits = currentTestLimits();
    expect(limits).not.toBeNull();
    expect(limits?.testTimeout).toBe(TEST_FLOOR);
    expect(limits?.hookTimeout).toBe(HOOK_FLOOR);
    expect(TEST_FLOOR).toBeGreaterThan(DB_TEST_TIMEOUT_MS);
    expect(HOOK_FLOOR).toBeGreaterThan(DB_HOOK_TIMEOUT_MS);
  });

  it('gives a test of this file the floor it stated, not the cap', ({ task }) => {
    expect(task.timeout).toBe(TEST_FLOOR);
  });

  it('hands the connect floor to the two real pools of its clone, and TI-14 keeps its ceilings', async () => {
    const app = db.appPool();
    const owner = db.ownerPool();
    expect([app.options.connectionTimeoutMillis, owner.options.connectionTimeoutMillis]).toEqual([CONNECT_FLOOR, CONNECT_FLOOR]);
    expect([app.options.max, owner.options.max]).toEqual([5, 2]);
    expect((await app.query<{ one: number }>('SELECT 1::int AS one')).rows).toEqual([{ one: 1 }]);
    expect((await owner.query<{ one: number }>('SELECT 1::int AS one')).rows).toEqual([{ one: 1 }]);
    expect([app.options.user, owner.options.user]).toEqual(['dems_app', 'dems_owner']);
    expect([app.options.host, app.options.port, app.options.ssl]).toEqual(['127.0.0.1', 4432, false]);
  });

  it('applies the floor the file stated to every clone of that file, later ones included', async () => {
    const extra = await db.another({ slug: 'needs_connect_inherited' });
    expect(extra.appPool().options.connectionTimeoutMillis).toBe(CONNECT_FLOOR);
    expect(extra.ownerPool().options.connectionTimeoutMillis).toBe(CONNECT_FLOOR);
    await extra.drop();
  });

  it('applies a need stated inside a running test to its own clone, not to the test’s limit', async ({ task }) => {
    const extra = await db.another({ slug: 'needs_connect_later', needs: { connectTimeoutMs: 30_000 } });
    expect(extra.appPool().options.connectionTimeoutMillis).toBe(30_000);
    expect(db.appPool().options.connectionTimeoutMillis).toBe(CONNECT_FLOOR);
    // The bound of the test that is running was set when it was registered: it stays.
    expect(task.timeout).toBe(TEST_FLOOR);
    await extra.drop();
  });

  it('refuses a need that is no whole number of milliseconds, before asking the cluster for anything', async () => {
    const asked = db.run.statementCount;
    const unreachable = async (): Promise<string> => 'unreachable';
    await expect(withTestDatabase({ template: SELFTEST_TEMPLATE, needs: { testTimeoutMs: 0 } }, unreachable)).rejects.toMatchObject({
      code: 'NEEDS_INVALID',
    });
    await expect(withTestDatabase({ template: SELFTEST_TEMPLATE, needs: { hookTimeoutMs: Number.POSITIVE_INFINITY } }, unreachable)).rejects.toMatchObject({
      code: 'NEEDS_INVALID',
    });
    await expect(withTestDatabase({ template: SELFTEST_TEMPLATE, needs: { connectTimeoutMs: 1.5 } }, unreachable)).rejects.toMatchObject({
      code: 'NEEDS_INVALID',
    });
    await expect(withTestDatabase({ template: SELFTEST_TEMPLATE, needs: { quietCluster: 'yes' as never } }, unreachable)).rejects.toMatchObject({
      code: 'NEEDS_INVALID',
    });
    expect(db.run.statementCount).toBe(asked);
  });

  it('changes no runner limit for a need that states none of them', async () => {
    const before = currentTestLimits();
    const extra = await db.another({ slug: 'needs_no_limits', needs: { quietCluster: true } });
    expect(currentTestLimits()).toEqual(before);
    await extra.drop();
  });
});

describe('the quiet cluster a caller asks for (decision D134)', () => {
  it('leaves its own session out of the count, and counts itself when it does not', async () => {
    const probe = singleConnectionPool('dems-w11b3-keying');
    try {
      const asking = await backendPid(probe);
      const before = await cloneLockRows(probe);
      await ask(probe, `SELECT pg_advisory_lock(${LOCK_CLASS}, ${CLONE_LOCK_KEY})`);
      try {
        expect(await backendPid(probe), 'the pool kept one connection').toBe(asking);
        const held = await cloneLockRows(probe);
        console.log(
          `${LOG_PREFIX} keying: this session on the clone lock -> counted ${held.cloneLock}, keyed by the reader ${held.cloneLockNotMine} ` +
            `(before it: ${before.cloneLock} / ${before.cloneLockNotMine})`,
        );
        // One snapshot: the row of the reading session is the difference.
        expect(held.cloneLock).toBeGreaterThanOrEqual(1);
        expect(held.cloneLockNotMine).toBeLessThan(held.cloneLock);
      } finally {
        await ask(probe, `SELECT pg_advisory_unlock(${LOCK_CLASS}, ${CLONE_LOCK_KEY})`);
      }
    } finally {
      await db.run.endPool(probe);
    }
  });

  it('leaves a lock of another key of the same class out', async () => {
    const holder = singleConnectionPool('dems-w11b3-other-key');
    const counter = singleConnectionPool('dems-w11b3-other-key-seer');
    try {
      await ask(holder, `SELECT pg_advisory_lock(${LOCK_CLASS}, ${OTHER_KEY})`);
      try {
        const seen = await cloneLockRows(counter);
        // The holder's row is there (another key) and is not the clone lock.
        expect(seen.allKeys).toBeGreaterThanOrEqual(seen.cloneLock + 1);
        expect(seen.cloneLock).toBe(seen.cloneLockNotMine);
      } finally {
        await ask(holder, `SELECT pg_advisory_unlock(${LOCK_CLASS}, ${OTHER_KEY})`);
      }
    } finally {
      await db.run.endPool(holder);
      await db.run.endPool(counter);
    }
  });

  it('waits while another session holds the clone lock, says it did not get quiet, and clones anyway', async () => {
    const holder = await TestRun.attach(db.run.identity, { resolveDefinition: probeResolver() });
    let releaseGate: () => void = () => undefined;
    const held = new Promise<void>((resolve) => {
      releaseGate = resolve;
    });
    // Somebody holds the clone lock for a moment: exactly the situation of a busy host.
    const holding = holder.withCloneLock(async () => {
      // Released a little after the bound of the request, so that its clone then goes through.
      setTimeout(releaseGate, SHORT_BUDGET_MS + 80);
      await held;
    });
    const impatient = await impatientRun();
    try {
      const started = performance.now();
      const database = await impatient.createDatabase({ template: SELFTEST_TEMPLATE.key, slug: 'quiet_while_busy', quiet: true });
      const elapsed = performance.now() - started;
      expect(database.timings.quiet.budgetMs).toBe(SHORT_BUDGET_MS);
      expect(database.timings.quiet.obtained).toBe(false);
      expect(database.timings.quiet.waitedMs).toBeGreaterThanOrEqual(SHORT_BUDGET_MS);
      expect(elapsed).toBeGreaterThanOrEqual(SHORT_BUDGET_MS);
      console.log(
        `${LOG_PREFIX} quiet: waited ${Math.round(database.timings.quiet.waitedMs)} ms of its ${SHORT_BUDGET_MS} ms bound while another session ` +
          `held the clone lock; cloned in ${Math.round(database.timings.cloneMs)} ms after a lock wait of ${Math.round(database.timings.lockWaitMs)} ms`,
      );
      await database.drop();
      // Nothing was ended to get there: the holder released its own lock and still answers.
      expect(holder.closed).toBe(false);
      expect((await holder.listDatabases()).length).toBeGreaterThanOrEqual(0);
    } finally {
      releaseGate();
      await holding.catch(() => undefined);
      await impatient.close();
      await holder.close();
    }
  });
  it('never waits longer than its bound, and reports what it saw', async () => {
    const impatient = await impatientRun();
    try {
      const database = await impatient.createDatabase({ template: SELFTEST_TEMPLATE.key, slug: 'quiet_free', quiet: true });
      const quiet = database.timings.quiet;
      console.log(`${LOG_PREFIX} quiet, nobody asked to hold the lock: ${JSON.stringify(quiet)}`);
      expect(quiet.budgetMs).toBe(SHORT_BUDGET_MS);
      // Quiet: it went at once. Not quiet on a busy host: it waited exactly its bound, no more.
      expect(quiet.obtained || quiet.waitedMs >= quiet.budgetMs, JSON.stringify(quiet)).toBe(true);
      expect(quiet.waitedMs).toBeLessThanOrEqual(quiet.budgetMs + 250);
      expect((await database.ownerPool().query<{ one: number }>('SELECT 1::int AS one')).rows).toEqual([{ one: 1 }]);
      await database.drop();
    } finally {
      await impatient.close();
    }
  });

  it('through the public entry: the clone carries the request, its bound is the helper’s', async () => {
    const extra = await db.another({ slug: 'needs_quiet_public', needs: { quietCluster: true } });
    const quiet = extra.timings.quiet;
    expect(quiet.budgetMs).toBe(CLUSTER_QUIET_BUDGET_MS);
    expect(quiet.obtained || quiet.waitedMs >= quiet.budgetMs, JSON.stringify(quiet)).toBe(true);
    expect((await extra.ownerPool().query<{ one: number }>('SELECT 1::int AS one')).rows).toEqual([{ one: 1 }]);
    await extra.drop();
  });

  it('asks for nothing where a file states nothing: no bound, no wait, no read', async () => {
    const extra = await db.another({ slug: 'needs_quiet_absent' });
    expect(extra.timings.quiet).toEqual({ waitedMs: 0, obtained: false, budgetMs: 0 });
    await extra.drop();
  });
});
