// Row W11b, decision D111, against the real server: `TestRun.dropDeadRun(prefix)` removes the
// databases of one named run whose owner is gone, and refuses everything else.
//
// The dead runs of this file are real runs of its own, closed without a teardown (which is what a
// stopped `test:db` leaves: the liveness lock is gone with the session, the databases stay). The
// run that is alive is the one this very file runs in, and a second one beside it.
//
// The stand-in tests of the same behaviour: `dead-run.test.ts`.
import { afterAll, describe, expect, it } from 'vitest';
import { APP_ROLE, OWNER_ROLE } from '../constants';
import { waitForSessionsToEnd } from '../ddl';
import { DbGuardError, DbTestHelperError } from '../errors';
import { TestRun, providedRun, useTestDatabase } from '../index';
import { runnerOf } from '../session';
import { PROBE_TABLE, SELFTEST_TEMPLATE } from '../testing/probe-hooks';
import { probeResolver, startPrivateRun } from '../testing/private-run';

const db = useTestDatabase({ template: SELFTEST_TEMPLATE });
const started: TestRun[] = [];
/** The runs this file stopped on purpose. A test that fails half-way leaves their databases. */
const stoppedPrefixes: string[] = [];

/** Short, so that a test does not wait the three seconds a person's call waits. */
const SETTLE = { settleMs: 150 };

afterAll(async () => {
  for (const run of started) if (!run.closed) await run.teardown();
  // Nothing of this file stays behind, also when a test failed: the stopped runs go by name.
  const cleaner = await startPrivateRun('dz');
  try {
    for (const prefix of stoppedPrefixes) await cleaner.dropDeadRun(prefix, SETTLE).catch(() => undefined);
  } finally {
    await cleaner.teardown();
  }
});

/**
 * The databases that neither come nor go while tests run: not a test database of some run, and
 * not the copy the reset routine keeps for a moment (`<name>_next`, `<name>_prev`).
 */
function settled(names: readonly string[]): string[] {
  return names.filter((name) => !name.startsWith('dems_test_') && !name.endsWith('_next') && !name.endsWith('_prev'));
}

async function privateRun(tag: string): Promise<TestRun> {
  const run = await startPrivateRun(tag);
  started.push(run);
  return run;
}

async function namesWithPrefix(prefix: string): Promise<string[]> {
  const rows = await db.ownerPool().query<{ name: string }>(
    'SELECT datname::text AS name FROM pg_database WHERE starts_with(datname, $1) ORDER BY 1',
    [prefix],
  );
  return rows.rows.map((row) => row.name);
}

async function refusal(action: () => Promise<unknown>): Promise<DbTestHelperError> {
  try {
    await action();
  } catch (error) {
    if (error instanceof DbTestHelperError) return error;
    throw error;
  }
  throw new Error('not refused');
}

/** A run with a clone and two locked templates whose owner "is stopped": closed, not torn down. */
async function stoppedRun(tag: string): Promise<{ prefix: string; names: string[]; identity: TestRun['identity'] }> {
  const run = await privateRun(tag);
  const clone = await run.createDatabase({ template: 'seed', slug: 'left_behind' });
  await clone.appPool().query(`INSERT INTO ${PROBE_TABLE} (token_hash, origin) VALUES ('t', 'left')`);
  // The stop: the run's process is gone, its session and its liveness lock with it.
  await run.close();
  const prefix = run.identity.prefix;
  stoppedPrefixes.push(prefix);
  const names = await namesWithPrefix(prefix);
  expect(names).toEqual([clone.name, `${prefix}tpl_schema`, `${prefix}tpl_seed`]);
  return { prefix, names, identity: run.identity };
}

describe('a run that was stopped before its teardown', () => {
  it('is removed by name: its clone and its locked templates; every other database stays', async () => {
    const stopped = await stoppedRun('dd');
    const operator = await privateRun('op');
    const others = settled(await namesWithPrefix(''));
    const templatesOfThisRun = (await namesWithPrefix(db.run.identity.prefix)).filter((name) => name.includes('_tpl_'));
    // The stale sweep does not take it: it started seconds ago.
    const swept = await operator.sweepStale();
    for (const name of stopped.names) expect(swept.dropped).not.toContain(name);
    expect(swept.keptYounger).toEqual(expect.arrayContaining(stopped.names));

    const report = await operator.dropDeadRun(stopped.prefix, SETTLE);

    expect(report.prefix).toBe(stopped.prefix);
    expect(report.failed).toEqual([]);
    expect(report.remaining).toEqual([]);
    expect([...report.dropped].sort()).toEqual(stopped.names);
    // The clone went before the templates.
    expect(report.dropped[0]).toBe(stopped.names[0]);
    expect(await namesWithPrefix(stopped.prefix)).toEqual([]);
    // Everything else is there: the project's own databases (whichever exist), the maintenance
    // database, the templates of PostgreSQL, and the run in progress with this file's own clone.
    const now = await namesWithPrefix('');
    expect(settled(now)).toEqual(others);
    expect(others).toEqual(expect.arrayContaining(['postgres', 'template0', 'template1']));
    for (const name of [db.name, ...templatesOfThisRun]) expect(now, name).toContain(name);
    expect((await db.appPool().query<{ db: string }>('SELECT current_database()::text AS db')).rows).toEqual([{ db: db.name }]);
    // Once more: nothing is left to drop.
    expect(await operator.dropDeadRun(stopped.prefix, SETTLE)).toMatchObject({ dropped: [], remaining: [], failed: [] });
    console.log(`[test:db] dead run: dropped ${report.dropped.length} database(s) of a stopped run in ${Math.round(report.ms)} ms (settle ${SETTLE.settleMs} ms)`);
  });
});

describe('a run that is alive', () => {
  it('the run this file runs in: refused with RUN_ALIVE after one statement; its templates and clones stay', async () => {
    const operator = await privateRun('ol');
    const live = providedRun().prefix;
    const before = await namesWithPrefix(live);
    expect(before).toContain(db.name);
    expect(before.some((name) => name.includes('_tpl_'))).toBe(true);
    const sent = operator.statementCount;

    const error = await refusal(() => operator.dropDeadRun(live, SETTLE));

    expect(error.code).toBe('RUN_ALIVE');
    expect(error.message).toContain(`the run ${live}* is alive`);
    expect(error.message).toContain('Nothing was dropped');
    // One statement: the question whether the liveness lock is free.
    expect(operator.statementCount).toBe(sent + 1);
    // The other worker's files come and go meanwhile; what was there and is this file's is there.
    const after = await namesWithPrefix(live);
    expect(after).toContain(db.name);
    for (const name of before.filter((entry) => entry.includes('_tpl_'))) expect(after, name).toContain(name);
  });

  it('a second run beside it, with a clone and locked templates: refused; nothing of it changes', async () => {
    const alive = await privateRun('al');
    const clone = await alive.createDatabase({ template: 'seed', slug: 'in_use' });
    const before = await alive.listDatabases();
    expect(before.map((row) => row.name)).toEqual([clone.name, `${alive.identity.prefix}tpl_schema`, `${alive.identity.prefix}tpl_seed`]);
    const operator = await privateRun('oa');

    expect((await refusal(() => operator.dropDeadRun(alive.identity.prefix, SETTLE))).code).toBe('RUN_ALIVE');

    expect(await alive.listDatabases()).toEqual(before);
    expect((await clone.appPool().query<{ n: number }>(`SELECT count(*)::int AS n FROM ${PROBE_TABLE}`)).rows).toEqual([{ n: 1 }]);
  });
});

describe('a dead run that somebody still works in', () => {
  it.each([
    ['the runtime role', 'app', APP_ROLE],
    ['the owner role, which a forced drop would end', 'owner', OWNER_ROLE],
  ] as const)('a session of %s on its clone: refused, the session is not ended; after it has left the run is removed', async (_label, kind, role) => {
    const stopped = await stoppedRun(kind === 'app' ? 'da' : 'do');
    const clone = stopped.names[0] ?? '';
    // A worker of that run that outlived its owner, with a connection of its own.
    const worker = await TestRun.attach(stopped.identity, { resolveDefinition: probeResolver() });
    const pool = worker.poolOn(clone, kind, 'dems-w11b-still-here');
    const held = await pool.connect();
    held.on('error', () => undefined);
    const operator = await privateRun(kind === 'app' ? 'oq' : 'or');
    try {
      await held.query('SELECT 1');

      const error = await refusal(() => operator.dropDeadRun(stopped.prefix, SETTLE));

      expect(error.code).toBe('SESSIONS_REMAIN');
      expect(error.message).toContain(`1 of role ${role} (application "dems-w11b-still-here") on ${clone}`);
      expect(error.message).toContain('no session was ended');
      expect(await namesWithPrefix(stopped.prefix)).toEqual(stopped.names);
      // Nobody ended it: it still answers, on the database that was not dropped.
      expect((await held.query<{ db: string }>('SELECT current_database()::text AS db')).rows).toEqual([{ db: clone }]);
    } finally {
      held.release();
      await pool.end();
      await worker.close();
    }
    // The session is closed; the server needs a moment to end its backend.
    expect(await waitForSessionsToEnd(runnerOf(db.ownerPool()), clone, 5_000)).toEqual([]);
    const report = await operator.dropDeadRun(stopped.prefix, SETTLE);
    expect(report.remaining).toEqual([]);
    expect([...report.dropped].sort()).toEqual(stopped.names);
    expect(await namesWithPrefix(stopped.prefix)).toEqual([]);
  });
});

describe('what is not a run of its own to remove', () => {
  it('the demo database, the lanes, the maintenance database, the templates of PostgreSQL, a database name: refused before a statement is sent', async () => {
    const operator = await privateRun('og');
    const all = settled(await namesWithPrefix(''));
    const sent = operator.statementCount;
    for (const text of [
      'dems_demo',
      'dems_demo_',
      'dems_lane_1',
      'dems_lane_2',
      'dems_lane_3',
      'postgres',
      'template0',
      'template1',
      'dems_test_',
      db.name,
      providedRun().prefix.slice(0, -1),
      `${providedRun().prefix}tpl_schema`,
      'dems_test_step_%',
    ]) {
      const error = await refusal(() => operator.dropDeadRun(text, SETTLE));
      expect(error, text).toBeInstanceOf(DbGuardError);
      expect(error.message, text).toContain('refused before any statement');
    }
    // Its own run: the teardown is the way.
    const own = await refusal(() => operator.dropDeadRun(operator.identity.prefix, SETTLE));
    expect(own).toBeInstanceOf(DbGuardError);
    expect(own.message).toContain('is this run');
    expect(operator.statementCount).toBe(sent);
    const after = await namesWithPrefix('');
    expect(settled(after)).toEqual(all);
    expect(after).toContain(db.name);
  });

  it('a test file attached to a run cannot remove another run', async () => {
    const stopped = await stoppedRun('dn');
    expect((await refusal(() => db.run.dropDeadRun(stopped.prefix, SETTLE))).code).toBe('RUN_NOT_OWNER');
    expect(await namesWithPrefix(stopped.prefix)).toEqual(stopped.names);
    // Removed by a run that may: nothing of this test stays behind.
    const operator = await privateRun('on');
    expect((await operator.dropDeadRun(stopped.prefix, SETTLE)).remaining).toEqual([]);
  });
});
