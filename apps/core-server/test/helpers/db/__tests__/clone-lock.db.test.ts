// TI-7 against the real server: one CREATE DATABASE at a time. The clone lock is the advisory
// lock (442002, 0) on the maintenance database; a clone waits while another session holds it,
// clones of two sessions and of one process never overlap, and a wait that takes too long ends
// with a clear error and creates nothing.
import { describe, expect, it } from 'vitest';
import { CLONE_LOCK_KEY, LOCK_CLASS, LOG_PREFIX } from '../constants';
import { TestRun, useTestDatabase, type TestDatabase } from '../index';
import { SELFTEST_TEMPLATE } from '../testing/probe-hooks';
import { probeResolver, sleep } from '../testing/private-run';

const db = useTestDatabase({ template: SELFTEST_TEMPLATE });

/** Rows of pg_locks for the clone lock: one per session that holds it or waits for it. */
async function cloneLockRows(): Promise<Array<{ granted: boolean }>> {
  const rows = await db.ownerPool().query<{ granted: boolean }>(
    "SELECT l.granted FROM pg_locks l JOIN pg_database d ON d.oid = l.database " +
      "WHERE l.locktype = 'advisory' AND d.datname = 'postgres' AND l.classid = $1 AND l.objid = $2 AND l.objsubid = 2 ORDER BY l.granted DESC",
    [LOCK_CLASS, CLONE_LOCK_KEY],
  );
  return rows.rows;
}

/** The databases of the run, read through a pool on this file's own clone. */
async function runDatabaseNames(): Promise<string[]> {
  const rows = await db.ownerPool().query<{ name: string }>(
    'SELECT datname::text AS name FROM pg_database WHERE starts_with(datname, $1) ORDER BY 1',
    [db.run.identity.prefix],
  );
  return rows.rows.map((row) => row.name);
}

describe('TI-7: clones are serialised by the advisory lock (442002, 0)', () => {
  it('a clone waits while another session holds the clone lock, and runs when it is released', async () => {
    // A second attached run stands for the other worker, or for a row that tests at the same time.
    const other = await TestRun.attach(db.run.identity, { resolveDefinition: probeResolver() });
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    let entered: () => void = () => undefined;
    const holding = new Promise<void>((resolve) => {
      entered = resolve;
    });
    const held = other.withCloneLock(async () => {
      entered();
      await gate;
    });
    try {
      await holding;
      let done = false;
      const started = performance.now();
      const pending = db.another({ slug: 'waits_for_the_lock' }).then((database) => {
        done = true;
        return database;
      });
      await sleep(350);
      expect(done).toBe(false);
      // The catalog shows the holder and at least this waiter.
      const rows = await cloneLockRows();
      expect(rows.filter((row) => row.granted)).toHaveLength(1);
      expect(rows.filter((row) => !row.granted).length).toBeGreaterThanOrEqual(1);
      // Not through `db.run`: its session is the one that waits for the lock.
      expect((await runDatabaseNames()).filter((name) => name.endsWith('waits_for_the_lock'))).toEqual([]);

      release();
      await held;
      const database = await pending;
      expect(database.timings.lockWaitMs).toBeGreaterThanOrEqual(300);
      expect(performance.now() - started).toBeGreaterThanOrEqual(350);
      console.log(`${LOG_PREFIX} clone-lock: a clone waited ${Math.round(database.timings.lockWaitMs)} ms for the lock, then took ${Math.round(database.timings.cloneMs)} ms`);
      await database.drop();
    } finally {
      release();
      await held.catch(() => undefined);
      await other.close();
    }
  });

  it('six clones asked for at once, from two sessions, never overlap and get six names', async () => {
    const other = await TestRun.attach(db.run.identity, { resolveDefinition: probeResolver() });
    const made: TestDatabase[] = [];
    try {
      const asked = [0, 1, 2, 3, 4, 5].map((i) =>
        (i % 2 === 0 ? db.run : other).createDatabase({ template: SELFTEST_TEMPLATE.key, slug: `burst_${i}` }),
      );
      made.push(...(await Promise.all(asked)));
      expect(new Set(made.map((database) => database.name)).size).toBe(6);
      const windows = made.map((database) => database.timings.window).sort((a, b) => a.from - b.from);
      for (let i = 1; i < windows.length; i += 1) {
        // The next copy took the lock only after the previous copy had finished.
        expect(windows[i]?.from ?? 0).toBeGreaterThanOrEqual(windows[i - 1]?.to ?? Number.POSITIVE_INFINITY);
      }
      const names = await runDatabaseNames();
      for (const database of made) expect(names).toContain(database.name);
    } finally {
      for (const database of made) await database.drop();
      await other.close();
    }
  });

  it('a wait longer than the lock timeout ends with CLONE_LOCK_TIMEOUT and creates nothing', async () => {
    const holder = await TestRun.attach(db.run.identity, { resolveDefinition: probeResolver() });
    const impatient = await TestRun.attach(db.run.identity, { resolveDefinition: probeResolver(), lockTimeoutMs: 250 });
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    let entered: () => void = () => undefined;
    const holding = new Promise<void>((resolve) => {
      entered = resolve;
    });
    const held = holder.withCloneLock(async () => {
      entered();
      await gate;
    });
    try {
      await holding;
      const started = performance.now();
      await expect(impatient.createDatabase({ template: SELFTEST_TEMPLATE.key, slug: 'gives_up' })).rejects.toMatchObject({
        code: 'CLONE_LOCK_TIMEOUT',
      });
      expect(performance.now() - started).toBeGreaterThanOrEqual(240);
      // The other worker's files come and go meanwhile; what matters is that this clone does not exist.
      expect((await runDatabaseNames()).filter((name) => name.endsWith('gives_up'))).toEqual([]);
    } finally {
      release();
      await held.catch(() => undefined);
      await holder.close();
      await impatient.close();
    }
  });
});
