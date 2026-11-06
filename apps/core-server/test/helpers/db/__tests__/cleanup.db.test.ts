// TI-10 and TI-11 against the real server: a file's database is dropped when the file is done,
// also when its body throws; pools are closed first; a session the code under test leaked makes
// the drop fail with a clear error instead of a forced drop that PostgreSQL would refuse (the
// owner role may not end another role's session: PG-26, trial step T5-h); and what a crashed
// worker left behind is removed by the teardown of the run.
import type { Pool } from 'pg';
import { describe, expect, it } from 'vitest';
import { createRuntimePool } from '../../../../src/plugins/db';
import { APP_ROLE, OWNER_ROLE } from '../constants';
import { DbTestHelperError } from '../errors';
import { TestRun, useTestDatabase, withTestDatabase, type TestDatabase } from '../index';
import { PROBE_TABLE, SELFTEST_TEMPLATE } from '../testing/probe-hooks';
import { probeResolver, startPrivateRun } from '../testing/private-run';

const db = useTestDatabase({ template: SELFTEST_TEMPLATE });

async function exists(name: string): Promise<boolean> {
  return (await db.run.listDatabases()).some((row) => row.name === name);
}

async function sessionsOn(name: string): Promise<Array<{ role: string; n: number }>> {
  const rows = await db.ownerPool().query<{ role: string; n: number }>(
    'SELECT usename::text AS role, count(*)::int AS n FROM pg_stat_activity WHERE datname = $1 AND usename IS NOT NULL GROUP BY 1 ORDER BY 1',
    [name],
  );
  return rows.rows;
}

/**
 * The pool of the code under test: built by the server's own pool factory (`src/plugins/db`)
 * from `database.runtime`, outside the helper's care, exactly as `buildApp({ config })` does.
 */
function poolOfTheCodeUnderTest(database: TestDatabase): Pool {
  const pool = createRuntimePool(database.runtime);
  pool.on('error', () => undefined);
  return pool;
}

describe('TI-10: cleanup per file', () => {
  it('a body that throws: the database is dropped all the same, and the body\'s error is the one reported', async () => {
    let name = '';
    const failure = withTestDatabase({ template: SELFTEST_TEMPLATE, slug: 'throws' }, async (database) => {
      name = database.name;
      await database.appPool().query(`INSERT INTO ${PROBE_TABLE} (token_hash, origin) VALUES ('t', 'throws')`);
      expect(await exists(name)).toBe(true);
      throw new Error('the test body failed on purpose');
    });
    await expect(failure).rejects.toThrow('the test body failed on purpose');
    expect(name).not.toBe('');
    expect(await exists(name)).toBe(false);
  });

  it('a body that returns: its value comes back and the database is gone', async () => {
    const result = await withTestDatabase({ template: SELFTEST_TEMPLATE, slug: 'returns' }, async (database) => {
      await database.ownerPool().query('SELECT 1');
      return database.name;
    });
    expect(result).toMatch(/_f[0-9]{2}_returns$/);
    expect(await exists(result)).toBe(false);
  });

  it('drop() closes the pools it handed out and what the test registered, then drops', async () => {
    const database = await db.another({ slug: 'pools' });
    const app = database.appPool();
    const owner = database.ownerPool();
    await Promise.all([app.query('SELECT 1'), app.query('SELECT 2'), owner.query('SELECT 3')]);
    const underTest = poolOfTheCodeUnderTest(database);
    // The server's pool factory takes `runtime` as it is and connects as the runtime role.
    const who = await underTest.query<{ role: string; db: string }>('SELECT current_user::text AS role, current_database()::text AS db');
    expect(who.rows).toEqual([{ role: APP_ROLE, db: database.name }]);
    let closed = false;
    database.onCleanup(async () => {
      await underTest.end();
      closed = true;
    });
    expect(await sessionsOn(database.name)).toEqual([
      { role: APP_ROLE, n: 3 },
      { role: OWNER_ROLE, n: 1 },
    ]);

    await database.drop();

    expect(closed).toBe(true);
    expect(app.ended).toBe(true);
    expect(owner.ended).toBe(true);
    expect(await exists(database.name)).toBe(false);
    expect(database.dropped).toBe(true);
    await database.drop();
  });

  it('a leaked session of the runtime role: the drop fails with SESSIONS_REMAIN and sends no DROP', async () => {
    // A run of this test's own with a short drain time, so that the refusal does not take seconds.
    const run = await TestRun.attach(db.run.identity, { resolveDefinition: probeResolver(), sessionDrainMs: 300 });
    const database = await run.createDatabase({ template: SELFTEST_TEMPLATE.key, slug: 'leaky' });
    const leaked = poolOfTheCodeUnderTest(database);
    try {
      await leaked.query('SELECT 1');

      let thrown: unknown;
      try {
        await database.drop();
      } catch (error) {
        thrown = error;
      }
      expect(thrown).toBeInstanceOf(DbTestHelperError);
      expect((thrown as DbTestHelperError).code).toBe('SESSIONS_REMAIN');
      expect((thrown as DbTestHelperError).message).toContain(`1 of role ${APP_ROLE}`);
      expect((thrown as DbTestHelperError).message).toContain('db.onCleanup');
      expect(await exists(database.name)).toBe(true);
      expect(database.dropped).toBe(false);
      // The leaked session was not ended by anybody: it still works.
      expect((await leaked.query<{ db: string }>('SELECT current_database()::text AS db')).rows).toEqual([{ db: database.name }]);
    } finally {
      await leaked.end();
    }
    // With the session closed the same call drops the database.
    await database.drop();
    expect(await exists(database.name)).toBe(false);
    await run.close();
  });

  it('a leaked session of the owner role does not stop the drop: the forced drop ends it', async () => {
    const run = await TestRun.attach(db.run.identity, { resolveDefinition: probeResolver(), sessionDrainMs: 300 });
    const database = await run.createDatabase({ template: SELFTEST_TEMPLATE.key, slug: 'owner_leak' });
    const client = await database.ownerPool().connect();
    // The forced drop ends this session; without a listener that would crash the test process.
    client.on('error', () => undefined);
    await client.query('SELECT 1');
    // Never released: the pool cannot end by itself.
    await database.drop();
    expect(await exists(database.name)).toBe(false);
    await expect(client.query('SELECT 1')).rejects.toBeDefined();
    await run.close();
  });
});

describe('TI-11: cleanup per run', () => {
  it('the teardown removes what a crashed worker left: clones, a locked template, everything with the prefix', async () => {
    const owner = await startPrivateRun('crash');
    const worker = await TestRun.attach(owner.identity, { resolveDefinition: probeResolver() });
    const left = await worker.createDatabase({ template: 'seed', slug: 'left_by_a_crashed_worker' });
    await left.appPool().query('SELECT 1');
    // The "crash": the worker's connections go away, its database stays.
    await worker.close();
    const before = (await owner.listDatabases()).map((row) => row.name);
    expect(before).toEqual([left.name, `${owner.identity.prefix}tpl_schema`, `${owner.identity.prefix}tpl_seed`]);

    const report = await owner.teardown();

    expect(report.failed).toEqual([]);
    expect(report.remaining).toEqual([]);
    expect([...report.dropped].sort()).toEqual([...before].sort());
    const all = await db.ownerPool().query<{ name: string }>('SELECT datname::text AS name FROM pg_database WHERE starts_with(datname, $1)', [
      owner.identity.prefix,
    ]);
    expect(all.rows).toEqual([]);
  });

  it('a database that cannot be dropped is reported by the teardown, by name and reason', async () => {
    const owner = await startPrivateRun('stuck', { sessionDrainMs: 300 });
    const database = await owner.createDatabase({ template: 'schema', slug: 'stuck' });
    const leaked = poolOfTheCodeUnderTest(database);
    await leaked.query('SELECT 1');
    const report = await owner.teardown();
    expect(report.remaining).toEqual([database.name]);
    expect(report.failed).toHaveLength(1);
    expect(report.failed[0]?.reason).toContain(`1 of role ${APP_ROLE}`);
    // Clean up for real: close the leak; a second run with the same identity drops what is left.
    await leaked.end();
    const second = await TestRun.attach(owner.identity, { resolveDefinition: probeResolver() });
    await second.dropDatabase(database.name);
    expect(await second.listDatabases()).toEqual([]);
    await second.close();
  });
});
