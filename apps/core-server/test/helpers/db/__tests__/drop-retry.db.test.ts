// Row W11b against the real server: the forced drop that PostgreSQL refuses with SQLSTATE 42501
// while a backend that the owner role may not end is on the database.
//
//   - what `dems_owner` can see of such a backend, which is what the helper decides on;
//   - a client session of another role: PostgreSQL itself refuses the drop here; the helper does
//     not repeat it and names the role and the application, never the statement;
//   - the retry: the refusal is injected at the driver seam (`testing/refusing-driver.ts`),
//     because an autovacuum worker cannot be summoned; everything else is the real server,
//     the report of a test file to the owner of its run included;
//   - the teardown of the global setup: the line that counts the retried drops, and "1 remain"
//     when a database stays.
//
// The stand-in tests of the same behaviour: `drop-retry.test.ts`.
import { describe, expect, it } from 'vitest';
import { APP_ROLE } from '../constants';
import { readOwnerCredentials } from '../credentials';
import { backendsOn, dropDatabase, isTerminateRefusal, waitForSessionsToEnd } from '../ddl';
import { DbTestHelperError } from '../errors';
import { setupDbTestProject } from '../global-setup';
import { injectedResolver, standardDefinitions } from '../hooks';
import { TestRun, useTestDatabase, type ProvidedTestRun } from '../index';
import { createRunIdentity, guardOwnDatabase } from '../names';
import { OwnerSession, runnerOf } from '../session';
import { PROBE_HOOKS, SELFTEST_TEMPLATE } from '../testing/probe-hooks';
import { privateRunEnv, probeResolver, startPrivateRun } from '../testing/private-run';
import { refusingDriver } from '../testing/refusing-driver';

const db = useTestDatabase({ template: SELFTEST_TEMPLATE });

const STATEMENT_MARKER = 'w11b-statement-marker';

async function exists(name: string): Promise<boolean> {
  const rows = await db.ownerPool().query('SELECT 1 FROM pg_database WHERE datname = $1', [name]);
  return rows.rows.length === 1;
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

interface Capture {
  readonly provided: ProvidedTestRun[];
  readonly lines: string[];
  readonly project: { provide(key: 'demsTestRun', value: ProvidedTestRun): void };
  readonly log: (line: string) => void;
}

function capture(): Capture {
  const provided: ProvidedTestRun[] = [];
  const lines: string[] = [];
  return { provided, lines, project: { provide: (_key, value) => void provided.push(value) }, log: (line) => void lines.push(line) };
}

describe('what dems_owner sees of a backend of another role', () => {
  it('the database, the role and the application name; not the backend type, the state, the start time or the statement', async () => {
    const clone = await db.another({ slug: 'seen' });
    const pool = db.run.poolOn(clone.name, 'app', 'dems-w11b-held');
    const held = await pool.connect();
    try {
      const pid = (await held.query<{ pid: number }>(`SELECT pg_backend_pid() AS pid, '${STATEMENT_MARKER}' AS marker`)).rows[0]?.pid;
      const seen = await db.ownerPool().query(
        'SELECT datname::text AS datname, usename::text AS usename, application_name, backend_type, state, backend_start, query ' +
          'FROM pg_stat_activity WHERE pid = $1',
        [pid],
      );
      expect(seen.rows).toEqual([
        {
          datname: clone.name,
          usename: APP_ROLE,
          application_name: 'dems-w11b-held',
          backend_type: null,
          state: null,
          backend_start: null,
          query: '<insufficient privilege>',
        },
      ]);
      // Its own session, for contrast: there the same columns are filled.
      const own = await db.ownerPool().query('SELECT backend_type, state FROM pg_stat_activity WHERE pid = pg_backend_pid()');
      expect(own.rows).toEqual([{ backend_type: 'client backend', state: 'active' }]);
      // What the helper reads after a refusal. By-design change (checkpoint CP-B1, finding
      // CPB1-15; decision D76): the list also counts backends WITHOUT a role, and an autovacuum
      // worker can be on the clone at this instant. The question here is about client sessions,
      // which have a role; a worker has none.
      const withRole = (await backendsOn(runnerOf(db.ownerPool()), clone.name)).filter((entry) => entry.role !== null);
      expect(withRole).toEqual([{ role: APP_ROLE, application: 'dems-w11b-held', backends: 1 }]);
    } finally {
      held.release();
      await pool.end();
    }
    await clone.drop();
  });
});

describe('a client session of another role at the forced drop', () => {
  it('PostgreSQL refuses the drop; the helper does not repeat it, names role and application, and prints no statement', async () => {
    const clone = await db.another({ slug: 'client_leak' });
    const guarded = guardOwnDatabase(clone.name, db.run.identity, 'drop');
    const pool = db.run.poolOn(clone.name, 'app', 'dems-w11b-leak');
    const held = await pool.connect();
    const session = await OwnerSession.open(readOwnerCredentials(db.run.dataDir), { applicationName: 'dems-test-w11b' });
    try {
      await held.query(`SELECT '${STATEMENT_MARKER}' AS marker`);
      const sent = session.statementCount;

      // The statement level, without the check the helper makes before a drop: the default
      // policy of 20 attempts, 250 ms apart.
      const error = await refusal(() => dropDatabase(session, guarded));

      expect(error.code).toBe('SESSIONS_REMAIN');
      expect(error.message).toContain(`${clone.name} cannot be dropped`);
      expect(error.message).toContain(`1 of role ${APP_ROLE} (application "dems-w11b-leak")`);
      expect(error.message).toContain('SQLSTATE 42501');
      expect(error.message).toContain('db.onCleanup');
      expect(error.message).not.toContain(STATEMENT_MARKER);
      expect(error.message).not.toMatch(/select/i);
      // The cause is the refusal of the server itself.
      expect(isTerminateRefusal(error.cause)).toBe(true);
      // One forced drop and one catalog read: no second attempt.
      expect(session.statementCount).toBe(sent + 2);
      // Nothing was ended, nothing was dropped.
      expect((await held.query<{ db: string }>('SELECT current_database()::text AS db')).rows).toEqual([{ db: clone.name }]);
      expect(await exists(clone.name)).toBe(true);
    } finally {
      held.release();
      await pool.end();
    }
    try {
      // The session is closed; the server needs a moment to end its backend.
      expect(await waitForSessionsToEnd(session, clone.name, 5_000)).toEqual([]);
      await dropDatabase(session, guarded);
      expect(await exists(clone.name)).toBe(false);
    } finally {
      await session.close();
    }
  });

  it('found before the drop is sent, which is the usual case: role and application are named there too', async () => {
    const run = await TestRun.attach(db.run.identity, { resolveDefinition: probeResolver(), sessionDrainMs: 300 });
    try {
      const database = await run.createDatabase({ template: SELFTEST_TEMPLATE.key, slug: 'leak_named' });
      const pool = run.poolOn(database.name, 'app', 'dems-w11b-leak');
      const held = await pool.connect();
      try {
        await held.query(`SELECT '${STATEMENT_MARKER}' AS marker`);
        const error = await refusal(() => database.drop());
        expect(error.code).toBe('SESSIONS_REMAIN');
        expect(error.message).toContain(`(1 of role ${APP_ROLE} (application "dems-w11b-leak"))`);
        expect(error.message).not.toContain(STATEMENT_MARKER);
        expect(await exists(database.name)).toBe(true);
      } finally {
        held.release();
        await pool.end();
      }
      await database.drop();
      expect(await exists(database.name)).toBe(false);
    } finally {
      await run.close();
    }
  });
});

describe('the retry, with the refusal injected at the driver seam', () => {
  it('refused twice, then dropped for real; the test file reports it and the owner of the run counts it', async () => {
    const owner = await startPrivateRun('rt');
    const driver = refusingDriver(2);
    const file = await TestRun.attach(owner.identity, { resolveDefinition: probeResolver(), clientFactory: driver.factory, dropRetry: { pauseMs: 20 } });
    try {
      const database = await file.createDatabase({ template: 'schema', slug: 'retried' });
      await database.appPool().query('SELECT 1');
      const forced = `DROP DATABASE IF EXISTS "${database.name}" WITH (FORCE)`;

      await database.drop();

      expect(driver.refused).toEqual([forced, forced]);
      expect(driver.sent).toEqual([forced]);
      expect(await exists(database.name)).toBe(false);
      expect(database.dropped).toBe(true);
      expect(file.retriedDrops).toEqual([{ name: database.name, refusals: 2 }]);
      await file.close();

      // The owner's session was told on the run's channel; its teardown hands the count on.
      const report = await owner.teardown();
      expect(report.retriedDrops).toEqual([{ name: database.name, refusals: 2 }]);
      expect(report.remaining).toEqual([]);
      expect(report.failed).toEqual([]);
    } finally {
      await file.close();
      if (!owner.closed) await owner.teardown();
    }
  });
});

describe('the teardown of the global setup', () => {
  it('prints one line that counts the retried drops, before its summary line', async () => {
    const seen = capture();
    const driver = refusingDriver(1);
    const teardown = await setupDbTestProject(seen.project, {
      env: privateRunEnv('rl'),
      resolveDefinition: injectedResolver(standardDefinitions({ schema: PROBE_HOOKS.schema })),
      log: seen.log,
      clientFactory: driver.factory,
      dropRetry: { pauseMs: 20 },
    });
    await teardown();

    expect(driver.refused).toHaveLength(1);
    expect(seen.lines.at(-2)).toMatch(
      /^forced drops that needed a retry: [1-9]\d* \(\d+ refusal\(s\) with SQLSTATE 42501 while a backend that the owner role may not end, such as an autovacuum worker, was on the database; each drop then went through\)$/,
    );
    expect(seen.lines.at(-1)).toMatch(/^teardown: dropped 1 database\(s\) in \d+ ms; 0 remain with the run prefix dems_test_[a-z0-9_]+$/);
    expect(seen.lines.filter((line) => line.startsWith('forced drops that needed a retry'))).toHaveLength(1);
  });

  it('a run with no retried drop says so in the same place', async () => {
    const seen = capture();
    const teardown = await setupDbTestProject(seen.project, { env: privateRunEnv('rq'), resolveDefinition: async () => null, log: seen.log });
    await teardown();
    expect(seen.lines.at(-2)).toBe('forced drops that needed a retry: 0');
    expect(seen.lines.at(-1)).toContain('teardown: dropped 0 database(s)');
  });

  it('a database that cannot be dropped: the summary says "1 remain", never "0 remain", and the run fails', async () => {
    const seen = capture();
    const teardown = await setupDbTestProject(seen.project, {
      env: privateRunEnv('rr'),
      resolveDefinition: injectedResolver(standardDefinitions({ schema: PROBE_HOOKS.schema })),
      log: seen.log,
      sessionDrainMs: 300,
    });
    const provided = seen.provided[0];
    expect(provided).toBeDefined();
    if (provided === undefined) return;
    const identity = createRunIdentity(provided.label, provided.stamp);
    const file = await TestRun.attach(identity, { resolveDefinition: async () => null });
    const database = await file.createDatabase({ template: 'schema', slug: 'stays' });
    const pool = file.poolOn(database.name, 'app', 'dems-w11b-stays');
    const held = await pool.connect();
    try {
      const failure: unknown = await teardown().then(
        () => undefined,
        (error: unknown) => error,
      );

      expect(failure).toBeInstanceOf(DbTestHelperError);
      expect((failure as DbTestHelperError).code).toBe('CLEANUP_INCOMPLETE');
      expect((failure as DbTestHelperError).message).toContain(`test:db left 1 database(s) behind: ${database.name}.`);
      expect((failure as DbTestHelperError).message).toContain(`1 of role ${APP_ROLE} (application "dems-w11b-stays")`);
      expect(seen.lines.at(-1)).toMatch(new RegExp(`^teardown: dropped 1 database\\(s\\) in \\d+ ms; 1 remain with the run prefix ${identity.prefix}$`));
      expect(seen.lines.at(-2)).toMatch(/^forced drops that needed a retry: \d+/);
      expect(seen.lines.join('\n')).not.toContain('0 remain');
      expect(await exists(database.name)).toBe(true);
    } finally {
      held.release();
      await pool.end();
      await file.close();
      // What the failed teardown left: removed here, by a run with the same identity.
      const cleaner = await TestRun.attach(identity, { resolveDefinition: async () => null });
      try {
        await cleaner.dropDatabase(database.name);
        expect(await cleaner.listDatabases()).toEqual([]);
      } finally {
        await cleaner.close();
      }
    }
  });
});
