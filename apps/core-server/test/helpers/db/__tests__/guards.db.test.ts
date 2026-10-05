// T-TI-2 against the real server: a request to drop the demo database, any other database of
// the cluster, or a younger database of another run is refused before a statement is sent.
// "Before a statement is sent" is measured: the run's own session counts every statement it
// hands to the driver, and a refused request leaves the count unchanged.
import { afterAll, describe, expect, it } from 'vitest';
import { DbGuardError } from '../errors';
import { TestRun, useTestDatabase } from '../index';
import { SELFTEST_TEMPLATE } from '../testing/probe-hooks';
import { startPrivateRun } from '../testing/private-run';

const db = useTestDatabase({ template: SELFTEST_TEMPLATE });
const others: TestRun[] = [];

afterAll(async () => {
  for (const other of others) if (!other.closed) await other.teardown();
});

async function allDatabaseNames(): Promise<string[]> {
  const rows = await db.ownerPool().query<{ name: string }>('SELECT datname::text AS name FROM pg_database ORDER BY 1');
  return rows.rows.map((row) => row.name);
}

/** Asks the run to drop `name` and returns the refusal, after checking that nothing was sent. */
async function refusedDrop(run: TestRun, name: string): Promise<DbGuardError> {
  const sent = run.statementCount;
  let thrown: unknown;
  try {
    await run.dropDatabase(name);
  } catch (error) {
    thrown = error;
  }
  expect(thrown, `dropDatabase(${JSON.stringify(name)}) was not refused`).toBeInstanceOf(DbGuardError);
  expect(run.statementCount, `a statement was sent for ${JSON.stringify(name)}`).toBe(sent);
  return thrown as DbGuardError;
}

describe('T-TI-2: the helper refuses, before any statement, what is not its own', () => {
  it('dems_demo, the lanes, the maintenance database and the templates of PostgreSQL', async () => {
    for (const name of ['dems_demo', 'dems_demo_next', 'dems_demo_prev', 'dems_lane_1', 'dems_lane_2', 'dems_lane_3', 'postgres', 'template0', 'template1']) {
      const error = await refusedDrop(db.run, name);
      expect(error.code).toBe('GUARD_PROTECTED_DATABASE');
      expect(error.message).toContain('refused before any statement');
    }
    expect((await refusedDrop(db.run, 'dems_proof_drizzle_20261004003235_a')).code).toBe('GUARD_PROTECTED_DATABASE');
    expect((await refusedDrop(db.run, 'dems_proof_anything')).code).toBe('GUARD_PROTECTED_DATABASE');
    expect((await refusedDrop(db.run, 'dems_test_handmade')).code).toBe('GUARD_FOREIGN_RUN');
    expect((await refusedDrop(db.run, 'anything_else')).code).toBe('GUARD_NOT_A_TEST_DATABASE');
    expect((await refusedDrop(db.run, `${db.name}"; DROP DATABASE postgres; --`)).code).toBe('GUARD_NOT_A_TEST_DATABASE');
    expect(await allDatabaseNames()).toEqual(expect.arrayContaining(['postgres', 'template0', 'template1', db.name]));
  });

  it('every database that exists in the cluster and is not of this run', async () => {
    const before = await allDatabaseNames();
    const foreign = before.filter((name) => !name.startsWith(db.run.identity.prefix));
    expect(foreign).toEqual(expect.arrayContaining(['postgres', 'template0', 'template1']));
    for (const name of foreign) await refusedDrop(db.run, name);
    // Other runs create and drop their own databases meanwhile; what was here and is not a test
    // database is still here.
    const after = await allDatabaseNames();
    for (const name of foreign.filter((other) => !other.startsWith('dems_test_'))) expect(after, name).toContain(name);
    console.log(`[test:db] guards: ${foreign.length} existing database(s) outside the run were refused, 0 statements sent`);
  });

  it('a younger database of another run: refused, and it stays as it is', async () => {
    const other = await startPrivateRun('oth');
    others.push(other);
    const theirs = await other.createDatabase({ template: 'x_selftest', slug: 'in_use_by_a_parallel_row' });
    await theirs.appPool().query("INSERT INTO helper_probe (token_hash, origin) VALUES ('theirs', 'other run')");
    const theirTemplate = `${other.identity.prefix}tpl_x_selftest`;

    expect((await refusedDrop(db.run, theirs.name)).code).toBe('GUARD_FOREIGN_RUN');
    const refused = await refusedDrop(db.run, theirTemplate);
    expect(refused.code).toBe('GUARD_FOREIGN_RUN');
    expect(refused.message).toContain(other.identity.prefix);
    expect(refused.message).toContain('a parallel row may be using it');

    // Seen in the catalog: both are still there, the template still locked, the row still in place.
    const catalog = await other.listDatabases();
    expect(catalog.map((row) => row.name)).toEqual([theirs.name, theirTemplate]);
    expect(catalog.find((row) => row.name === theirTemplate)).toMatchObject({ isTemplate: true, allowConnections: false });
    const rows = await theirs.appPool().query('SELECT origin FROM helper_probe');
    expect(rows.rows).toEqual([{ origin: 'other run' }]);

    // And the other way round: that run cannot drop this file's database either.
    expect((await refusedDrop(other, db.name)).code).toBe('GUARD_FOREIGN_RUN');
    expect((await refusedDrop(other, 'dems_demo')).code).toBe('GUARD_PROTECTED_DATABASE');

    // The sweep of this moment leaves a younger run alone as well.
    const sweep = await other.sweepStale();
    for (const name of [db.name, theirs.name, theirTemplate]) expect(sweep.dropped).not.toContain(name);
    expect(sweep.keptYounger).toEqual(expect.arrayContaining([db.name]));
    expect(await allDatabaseNames()).toEqual(expect.arrayContaining([db.name, theirs.name, theirTemplate]));

    const report = await other.teardown();
    expect(report.remaining).toEqual([]);
  });

  it('a clone or a pool can only be asked for inside the own run', async () => {
    const sent = db.run.statementCount;
    await expect(db.run.createDatabase({ template: '../dems_demo', slug: 'x' })).rejects.toMatchObject({ code: 'NAME_INVALID' });
    await expect(db.run.createDatabase({ template: 'demo', slug: 'x' })).rejects.toMatchObject({ code: 'NAME_INVALID' });
    // No pool and no connection fields for a database outside the run, for either role.
    for (const name of ['dems_demo', 'dems_lane_1', 'postgres', 'template1', 'dems_test_local_abcdefgh_f01_x']) {
      expect(() => db.run.poolOn(name, 'owner'), name).toThrow(DbGuardError);
      expect(() => db.run.poolOn(name, 'app'), name).toThrow(DbGuardError);
      expect(() => db.run.connectionOn(name, 'app'), name).toThrow(DbGuardError);
    }
    expect(db.run.statementCount).toBe(sent);
    // The name of this file's database cannot be steered anywhere else by its slug.
    const odd = await db.another({ slug: 'x"; DROP DATABASE dems_demo; --' });
    expect(odd.name.startsWith(db.run.identity.prefix)).toBe(true);
    expect(odd.name).toMatch(/^[a-z0-9_]+$/);
    expect(odd.name).toContain('_x_drop_database');
    await odd.drop();
  });

  it('its own database is dropped when it asks', async () => {
    const mine = await db.another({ slug: 'mine_to_drop' });
    expect(await allDatabaseNames()).toContain(mine.name);
    await db.run.dropDatabase(mine.name);
    expect(await allDatabaseNames()).not.toContain(mine.name);
  });
});
