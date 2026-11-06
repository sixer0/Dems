// Row W11b: the forced drop that PostgreSQL refuses (SQLSTATE 42501, "permission denied to
// terminate process") while a backend that the owner role may not end is on the database.
//
//   - a background worker of the server (autovacuum; it has no role): wait, send the same
//     statement again, a bounded number of times, and succeed quietly;
//   - a client session of another role: a leak of the test; fail at once, naming the role and
//     the application, never a statement;
//   - still refused at the bound: fail with the last error and with what was on the database.
//
// No database and no socket here: a stand-in runner for the statement level, the stand-in
// cluster for the level of a run. Against the real server: `drop-retry.db.test.ts`.
import { afterEach, describe, expect, it } from 'vitest';
import { DROP_RETRY_ATTEMPTS, DROP_RETRY_PAUSE_MS, OWNER_ROLE, STALE_AFTER_SECONDS } from '../constants';
import { clientsOfOtherRoles, describeBackends, dropDatabase, isTerminateRefusal, type BackendGroup } from '../ddl';
import { DbGuardError, DbTestHelperError } from '../errors';
import { retriedDropsLine } from '../global-setup';
import { injectedResolver, type TemplateDefinition } from '../hooks';
import { createRunIdentity, guardOwnDatabase, type RunIdentity } from '../names';
import { TestRun, type RunOptions } from '../run';
import type { DriverOptions, Row } from '../session';
import { FakeCluster, fakeDataDir, type FakeDatabase } from '../testing/fake-cluster';

const REFUSAL_TEXT = 'permission denied to terminate process';

function terminateRefused(): Error {
  return Object.assign(new Error(REFUSAL_TEXT), { code: '42501' });
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

// ── The statement level: `dropDatabase` on a stand-in runner ────────────────────────────────────

interface Script {
  /** How many forced drops are refused before one goes through; `Infinity`: every one. */
  readonly refuse: number;
  /** The error of a refused drop. Default: the refusal the retry is for. */
  readonly error?: () => Error;
  /** What is on the database when the helper looks after the n-th refusal (1, 2, ...). */
  readonly connected?: (refusal: number) => BackendGroup[];
}

function standIn(script: Script) {
  const statements: Array<{ text: string; values: readonly unknown[] }> = [];
  let refused = 0;
  return {
    statements,
    drops: (): string[] => statements.map((statement) => statement.text).filter((text) => text.startsWith('DROP DATABASE')),
    reads: () => statements.filter((statement) => statement.text.includes('pg_stat_activity')),
    runner: {
      async run<R extends Row = Row>(text: string, values: readonly unknown[] = []): Promise<R[]> {
        statements.push({ text, values });
        if (text.startsWith('DROP DATABASE')) {
          if (refused < script.refuse) {
            refused += 1;
            throw (script.error ?? terminateRefused)();
          }
          return [];
        }
        if (text.includes('FROM pg_stat_activity')) return (script.connected?.(refused) ?? []) as unknown as R[];
        throw new Error(`the drop is not expected to send: ${text}`);
      },
    },
  };
}

const RUN = createRunIdentity('step_33b', 'tmd0a1b2');
const NAME = guardOwnDatabase(`${RUN.prefix}f01_drop_retry`, RUN, 'drop');
const FORCED = `DROP DATABASE IF EXISTS "${NAME}" WITH (FORCE)`;
const WORKER: BackendGroup = { role: null, application: '', backends: 1 };
const OWN_LEFTOVER: BackendGroup = { role: OWNER_ROLE, application: 'dems-test-fixture', backends: 1 };

describe('the forced drop, refused while a background worker is on the database', () => {
  it('not refused: one statement, no catalog read', async () => {
    const server = standIn({ refuse: 0 });
    expect(await dropDatabase(server.runner, NAME)).toEqual({ refusals: 0 });
    expect(server.statements).toEqual([{ text: FORCED, values: [] }]);
  });

  it.each([1, 2, 7, 19])('refused %i time(s), then it goes through: the same statement again, one catalog read per refusal', async (times) => {
    const server = standIn({ refuse: times, connected: () => [WORKER] });

    const outcome = await dropDatabase(server.runner, NAME, { pauseMs: 0 });

    expect(outcome).toEqual({ refusals: times });
    expect(server.drops()).toEqual(Array.from({ length: times + 1 }, () => FORCED));
    expect(server.reads()).toHaveLength(times);
    for (const read of server.reads()) expect(read.values).toEqual([NAME]);
    // Nothing else was sent: a drop and a read per refusal, and the drop that went through.
    expect(server.statements).toHaveLength(2 * times + 1);
  });

  it('the backend had left again when the helper looked: retried all the same', async () => {
    const server = standIn({ refuse: 2, connected: () => [] });
    expect(await dropDatabase(server.runner, NAME, { pauseMs: 0 })).toEqual({ refusals: 2 });
    expect(server.drops()).toHaveLength(3);
  });

  it('a leftover session of the owner role beside the worker does not change that: the forced drop ends it later', async () => {
    const server = standIn({ refuse: 1, connected: () => [WORKER, OWN_LEFTOVER] });
    expect(await dropDatabase(server.runner, NAME, { pauseMs: 0 })).toEqual({ refusals: 1 });
  });

  it('waits between two attempts', async () => {
    const server = standIn({ refuse: 3, connected: () => [WORKER] });
    const started = performance.now();
    await dropDatabase(server.runner, NAME, { pauseMs: 30 });
    // Three waits of 30 ms; a timer may fire a fraction of a millisecond early.
    expect(performance.now() - started).toBeGreaterThanOrEqual(85);
  });

  it('the default bound is 20 attempts, 250 ms apart', async () => {
    expect([DROP_RETRY_ATTEMPTS, DROP_RETRY_PAUSE_MS]).toEqual([20, 250]);
    const server = standIn({ refuse: Infinity, connected: () => [WORKER] });
    const error = await refusal(() => dropDatabase(server.runner, NAME, { pauseMs: 0 }));
    expect(error.code).toBe('DROP_REFUSED');
    expect(server.drops()).toHaveLength(20);
    expect(error.message).toContain('refused the forced drop 20 time(s)');
  });

  it('bounded: still refused at the last attempt, it fails with the last error and with what was on the database', async () => {
    const last = terminateRefused();
    let thrown = 0;
    const server = standIn({
      refuse: Infinity,
      error: () => {
        thrown += 1;
        return thrown === 4 ? last : terminateRefused();
      },
      connected: () => [WORKER, OWN_LEFTOVER],
    });

    const error = await refusal(() => dropDatabase(server.runner, NAME, { attempts: 4, pauseMs: 0 }));

    expect(error.code).toBe('DROP_REFUSED');
    expect(error.cause).toBe(last);
    expect(server.drops()).toEqual([FORCED, FORCED, FORCED, FORCED]);
    expect(error.message).toContain(`${NAME} could not be dropped`);
    expect(error.message).toContain('refused the forced drop 4 time(s)');
    expect(error.message).toContain(`SQLSTATE 42501: ${REFUSAL_TEXT}`);
    expect(error.message).toContain('1 without a role (a background worker of PostgreSQL, such as autovacuum)');
    expect(error.message).toContain(`1 of role ${OWNER_ROLE} (application "dems-test-fixture")`);
    expect(error.message).toContain('no client session of another role');
    expect(error.message).toContain("removed by the run's teardown");
    // No statement after the last refusal but the read of who was there.
    expect(server.statements.at(-1)?.text).toContain('pg_stat_activity');
  });

  it('bounded, and nothing was left to see: the message says so', async () => {
    const server = standIn({ refuse: Infinity, connected: () => [] });
    const error = await refusal(() => dropDatabase(server.runner, NAME, { attempts: 2, pauseMs: 0 }));
    expect(error.code).toBe('DROP_REFUSED');
    expect(error.message).toContain('nothing was on the database any more when the helper looked');
  });

  it('an attempt count below one still sends the drop once', async () => {
    const server = standIn({ refuse: Infinity, connected: () => [WORKER] });
    expect((await refusal(() => dropDatabase(server.runner, NAME, { attempts: 0, pauseMs: 0 }))).code).toBe('DROP_REFUSED');
    expect(server.drops()).toHaveLength(1);
  });
});

describe('the forced drop, refused while a client session of another role is on the database', () => {
  it('is not repeated: it fails at once and names the role and the application', async () => {
    const server = standIn({
      refuse: Infinity,
      connected: () => [WORKER, { role: 'dems_app', application: 'dems-core-server', backends: 2 }, OWN_LEFTOVER],
    });

    const error = await refusal(() => dropDatabase(server.runner, NAME, { attempts: 20, pauseMs: 0 }));

    expect(error.code).toBe('SESSIONS_REMAIN');
    expect(server.drops()).toEqual([FORCED]);
    expect(error.message).toContain(`${NAME} cannot be dropped`);
    expect(error.message).toContain('2 of role dems_app (application "dems-core-server")');
    expect(error.message).toContain('SQLSTATE 42501');
    expect(error.message).toContain('db.onCleanup');
    // Only the leak is named: not the worker, not the helper's own leftover.
    expect(error.message).not.toContain('without a role');
    expect(error.message).not.toContain(`of role ${OWNER_ROLE}`);
    expect(isTerminateRefusal(error.cause)).toBe(true);
  });

  it('a session that shows up at a later refusal ends the retry there', async () => {
    const server = standIn({
      refuse: Infinity,
      connected: (refused) => (refused < 3 ? [WORKER] : [{ role: 'dems_app', application: '', backends: 1 }]),
    });
    const error = await refusal(() => dropDatabase(server.runner, NAME, { attempts: 20, pauseMs: 0 }));
    expect(error.code).toBe('SESSIONS_REMAIN');
    expect(server.drops()).toHaveLength(3);
    // No application name was set: the role alone is named.
    expect(error.message).toContain('(1 of role dems_app)');
  });

  it('every role but the owner role counts, whatever its name', async () => {
    const server = standIn({ refuse: Infinity, connected: () => [{ role: 'somebody_else', application: 'psql', backends: 1 }] });
    const error = await refusal(() => dropDatabase(server.runner, NAME, { pauseMs: 0 }));
    expect(error.code).toBe('SESSIONS_REMAIN');
    expect(error.message).toContain('1 of role somebody_else (application "psql")');
  });

  it('the helper asks for role and application name only: never for the statement, the state or the backend type', async () => {
    const server = standIn({ refuse: 1, connected: () => [WORKER] });
    await dropDatabase(server.runner, NAME, { pauseMs: 0 });
    const [read] = server.reads();
    expect(read?.text).toBe(
      "SELECT usename::text AS role, coalesce(application_name, '') AS application, count(*)::int AS backends " +
        'FROM pg_stat_activity WHERE datname = $1 GROUP BY 1, 2 ORDER BY 1 NULLS FIRST, 2',
    );
    expect(read?.text).not.toMatch(/\bquery\b|\bstate\b|backend_type|client_addr/);
  });
});

describe('what is and what is not the refusal that is retried', () => {
  const others: Array<[string, Error]> = [
    ['the database is in use (55006)', Object.assign(new Error('database "x" is being accessed by other users'), { code: '55006' })],
    ['not the owner of the database (42501, another message)', Object.assign(new Error('must be owner of database x'), { code: '42501' })],
    ['a template database (42809)', Object.assign(new Error('cannot drop a template database'), { code: '42809' })],
    ['the same words without the SQLSTATE', new Error(REFUSAL_TEXT)],
    ['a lost connection', Object.assign(new Error('Connection terminated unexpectedly'), { code: 'ECONNRESET' })],
  ];

  it.each(others)('%s: not retried, and the error comes back as it is', async (_label, error) => {
    const server = standIn({ refuse: Infinity, error: () => error });
    await expect(dropDatabase(server.runner, NAME, { pauseMs: 0 })).rejects.toBe(error);
    expect(server.statements).toEqual([{ text: FORCED, values: [] }]);
    expect(isTerminateRefusal(error)).toBe(false);
  });

  it('SQLSTATE 42501 with the message of the server is the refusal', () => {
    expect(isTerminateRefusal(terminateRefused())).toBe(true);
    expect(isTerminateRefusal(undefined)).toBe(false);
    expect(isTerminateRefusal({ code: '42501' })).toBe(false);
  });
});

describe('how backends are described', () => {
  it('a worker by what it is, a session by role and application; the owner role is not "another role"', () => {
    const groups: BackendGroup[] = [WORKER, { role: 'dems_app', application: 'dems-core-server', backends: 3 }, { role: 'dems_app', application: '', backends: 1 }, OWN_LEFTOVER];
    expect(describeBackends(groups)).toBe(
      '1 without a role (a background worker of PostgreSQL, such as autovacuum), 3 of role dems_app (application "dems-core-server"), ' +
        `1 of role dems_app, 1 of role ${OWNER_ROLE} (application "dems-test-fixture")`,
    );
    expect(clientsOfOtherRoles(groups)).toEqual([groups[1], groups[2]]);
  });

  it('the line of the teardown: a count, and the refusals when there were any', () => {
    expect(retriedDropsLine([])).toBe('forced drops that needed a retry: 0');
    expect(
      retriedDropsLine([
        { name: `${RUN.prefix}f01_a`, refusals: 1 },
        { name: `${RUN.prefix}f02_b`, refusals: 4 },
      ]),
    ).toBe(
      'forced drops that needed a retry: 2 (5 refusal(s) with SQLSTATE 42501 while a backend that the owner role may not end, ' +
        'such as an autovacuum worker, was on the database; each drop then went through)',
    );
  });
});

// ── The level of a run: the stand-in cluster ────────────────────────────────────────────────────

const NOW_MS = Date.UTC(2026, 9, 4, 5, 0, 0);
const NOW_SECONDS = NOW_MS / 1000;
const TEMPLATES: TemplateDefinition[] = [
  { key: 'schema', base: 'empty', build: async () => undefined },
  { key: 'seed', base: 'schema', build: async () => undefined },
];
const cleanups: Array<() => void | Promise<void>> = [];

function stampAt(seconds: number, tail: string): string {
  return `${seconds.toString(36).padStart(6, '0')}${tail}`;
}

async function ownerRun(cluster: FakeCluster, options: RunOptions = {}): Promise<TestRun> {
  const data = fakeDataDir();
  cleanups.push(data.remove);
  const run = await TestRun.start({
    env: { DEMS_TEST_STEP: '33b' },
    dataDir: data.dir,
    clientFactory: cluster.factory,
    probe: async () => undefined,
    now: () => NOW_MS,
    sessionDrainMs: 30,
    dropRetry: { attempts: 5, pauseMs: 0 },
    resolveDefinition: injectedResolver(TEMPLATES),
    ...options,
  });
  cleanups.push(() => run.close());
  return run;
}

async function attachedRun(cluster: FakeCluster, identity: RunIdentity, options: RunOptions = {}): Promise<TestRun> {
  const data = fakeDataDir();
  cleanups.push(data.remove);
  const run = await TestRun.attach(identity, {
    dataDir: data.dir,
    clientFactory: cluster.factory,
    sessionDrainMs: 30,
    dropRetry: { attempts: 5, pauseMs: 0 },
    resolveDefinition: injectedResolver(TEMPLATES),
    ...options,
  });
  cleanups.push(() => run.close());
  return run;
}

function fakeOf(cluster: FakeCluster, name: string): FakeDatabase {
  const database = cluster.databases.get(name);
  if (database === undefined) throw new Error(`the stand-in cluster has no database ${name}`);
  return database;
}

function forcedDropsOf(cluster: FakeCluster, name: string): string[] {
  return cluster.databaseStatements().filter((text) => text === `DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`);
}

afterEach(async () => {
  for (const cleanup of cleanups.splice(0).reverse()) await cleanup();
});

describe('a test file drops its database while a background worker is on it', () => {
  it('the worker leaves after three refusals: the drop goes through, and only the own database was named', async () => {
    const cluster = new FakeCluster(['dems_demo', 'dems_lane_1']);
    const run = await ownerRun(cluster);
    const database = await run.createDatabase({ template: 'schema', slug: 'visited' });
    Object.assign(fakeOf(cluster, database.name), { background: 1, backgroundLeavesAfter: 3 });

    await database.drop();

    expect(cluster.databases.has(database.name)).toBe(false);
    expect(database.dropped).toBe(true);
    expect(forcedDropsOf(cluster, database.name)).toHaveLength(4);
    expect(run.retriedDrops).toEqual([{ name: database.name, refusals: 3 }]);
    expect(cluster.namesInDatabaseStatements().every((name) => name.startsWith(run.identity.prefix))).toBe(true);
    expect(cluster.databases.has('dems_demo')).toBe(true);
    expect(cluster.databases.has('dems_lane_1')).toBe(true);
  });

  it('a leftover session of the owner role beside the worker: retried, then the forced drop ends it', async () => {
    const cluster = new FakeCluster();
    const run = await ownerRun(cluster);
    const database = await run.createDatabase({ template: 'schema', slug: 'own_leftover' });
    Object.assign(fakeOf(cluster, database.name), { background: 1, backgroundLeavesAfter: 1, sessions: [{ role: OWNER_ROLE, sessions: 1 }] });

    await database.drop();

    expect(cluster.databases.has(database.name)).toBe(false);
    expect(run.retriedDrops).toEqual([{ name: database.name, refusals: 1 }]);
  });

  it('no refusal, no entry: the usual drop is one statement as before', async () => {
    const cluster = new FakeCluster();
    const run = await ownerRun(cluster);
    const database = await run.createDatabase({ template: 'schema', slug: 'usual' });
    await database.drop();
    expect(forcedDropsOf(cluster, database.name)).toHaveLength(1);
    expect(run.retriedDrops).toEqual([]);
    expect(cluster.statements.some((statement) => statement.text.includes('pg_notify'))).toBe(false);
  });

  it('a session of the runtime role that is open before the drop: no DROP is sent, and role and application are named', async () => {
    const cluster = new FakeCluster();
    const run = await ownerRun(cluster);
    const database = await run.createDatabase({ template: 'schema', slug: 'leaky' });
    fakeOf(cluster, database.name).sessions = [{ role: 'dems_app', sessions: 1, application: 'dems-core-server' }];

    const error = await refusal(() => database.drop());

    expect(error.code).toBe('SESSIONS_REMAIN');
    expect(error.message).toContain('(1 of role dems_app (application "dems-core-server"))');
    expect(forcedDropsOf(cluster, database.name)).toEqual([]);
  });

  it('a session of the runtime role that connects after the helper looked: the refused drop is not repeated', async () => {
    const cluster = new FakeCluster();
    const run = await ownerRun(cluster);
    const database = await run.createDatabase({ template: 'schema', slug: 'late_leak' });
    cluster.beforeStatement = (text) => {
      if (text.startsWith('DROP DATABASE')) fakeOf(cluster, database.name).sessions = [{ role: 'dems_app', sessions: 1, application: 'dems-core-server' }];
    };

    const error = await refusal(() => database.drop());

    expect(error.code).toBe('SESSIONS_REMAIN');
    expect(error.message).toContain('1 of role dems_app (application "dems-core-server")');
    expect(error.message).toContain('refused the forced drop (SQLSTATE 42501)');
    expect(forcedDropsOf(cluster, database.name)).toHaveLength(1);
    expect(cluster.databases.has(database.name)).toBe(true);
    expect(database.dropped).toBe(false);
    expect(run.retriedDrops).toEqual([]);
  });
});

describe('the owner of a run learns of the retried drops of its test files', () => {
  it('a test file reports on the channel of the run; the teardown report holds them, and the owner\'s own', async () => {
    const cluster = new FakeCluster();
    const owner = await ownerRun(cluster);
    await owner.ensureTemplate('schema', 'create-only');
    // Only the owner listens, to the channel named like its prefix.
    expect(cluster.listenedChannels()).toEqual([owner.identity.prefix]);
    const file = await attachedRun(cluster, owner.identity);
    expect(cluster.listenedChannels()).toEqual([owner.identity.prefix]);
    const a = await file.createDatabase({ template: 'schema', slug: 'a' });
    const b = await file.createDatabase({ template: 'schema', slug: 'b' });
    const c = await file.createDatabase({ template: 'schema', slug: 'c' });
    fakeOf(cluster, a.name).refuseNextDrops = 2;
    Object.assign(fakeOf(cluster, b.name), { background: 1, backgroundLeavesAfter: 1 });

    await a.drop();
    await b.drop();
    await c.drop();

    const fromTheFile = [
      { name: a.name, refusals: 2 },
      { name: b.name, refusals: 1 },
    ];
    expect(file.retriedDrops).toEqual(fromTheFile);
    expect(owner.retriedDrops).toEqual(fromTheFile);
    // What travelled: the channel, a database name and a count.
    expect(cluster.statements.filter((statement) => statement.text.includes('pg_notify')).map((statement) => statement.values)).toEqual(
      fromTheFile.map((drop) => [owner.identity.prefix, JSON.stringify(drop)]),
    );
    await file.close();

    const template = `${owner.identity.prefix}tpl_schema`;
    fakeOf(cluster, template).refuseNextDrops = 1;
    const sent = cluster.statements.length;
    const report = await owner.teardown();

    expect(report.retriedDrops).toEqual([...fromTheFile, { name: template, refusals: 1 }]);
    expect(report.remaining).toEqual([]);
    expect(report.failed).toEqual([]);
    // The owner counts its own drops itself: it sends no notification.
    expect(cluster.statements.slice(sent).some((statement) => statement.text.includes('pg_notify'))).toBe(false);
  });

  it('a notification that is not such a report is ignored', async () => {
    const cluster = new FakeCluster();
    const owner = await ownerRun(cluster);
    const other = createRunIdentity('step_41', stampAt(NOW_SECONDS - 60, 'y7'));
    const stranger = cluster.factory({} as DriverOptions);
    const good = JSON.stringify({ name: `${owner.identity.prefix}f01_x`, refusals: 2 });
    for (const [channel, payload] of [
      [owner.identity.prefix, 'not json'],
      [owner.identity.prefix, '[]'],
      [owner.identity.prefix, 'null'],
      [owner.identity.prefix, JSON.stringify({ name: 'dems_demo', refusals: 1 })],
      [owner.identity.prefix, JSON.stringify({ name: `${owner.identity.prefix}f01_x`, refusals: 0 })],
      [owner.identity.prefix, JSON.stringify({ name: `${owner.identity.prefix}f01_x`, refusals: '2' })],
      [owner.identity.prefix, JSON.stringify({ name: 42, refusals: 2 })],
      [other.prefix, good],
    ]) {
      await stranger.query('SELECT pg_notify($1, $2)', [channel, payload]);
    }
    expect(owner.retriedDrops).toEqual([]);
    await stranger.query('SELECT pg_notify($1, $2)', [owner.identity.prefix, good]);
    expect(owner.retriedDrops).toEqual([{ name: `${owner.identity.prefix}f01_x`, refusals: 2 }]);
  });
});

describe('a drop that stays refused: the database is left to the teardown of the run, which goes through the same retry', () => {
  it('refused at every attempt in the file; the worker leaves during the teardown: dropped there, nothing remains', async () => {
    const cluster = new FakeCluster();
    const run = await ownerRun(cluster);
    const database = await run.createDatabase({ template: 'seed', slug: 'stuck_for_a_while' });
    fakeOf(cluster, database.name).background = 1;

    const error = await refusal(() => database.drop());

    expect(error.code).toBe('DROP_REFUSED');
    expect(error.message).toContain('refused the forced drop 5 time(s)');
    expect(error.message).toContain('1 without a role');
    expect(forcedDropsOf(cluster, database.name)).toHaveLength(5);
    expect(cluster.databases.has(database.name)).toBe(true);
    expect(database.dropped).toBe(false);
    expect(run.retriedDrops).toEqual([]);

    // Still there when the teardown starts, gone after two more refusals.
    fakeOf(cluster, database.name).backgroundLeavesAfter = 2;
    const report = await run.teardown();

    expect(forcedDropsOf(cluster, database.name)).toHaveLength(5 + 3);
    expect(report.dropped).toEqual([database.name, `${run.identity.prefix}tpl_schema`, `${run.identity.prefix}tpl_seed`]);
    expect(report.remaining).toEqual([]);
    expect(report.failed).toEqual([]);
    expect(report.retriedDrops).toEqual([{ name: database.name, refusals: 2 }]);
    expect(cluster.names()).toEqual(['postgres', 'template0', 'template1']);
  });

  it('refused at every attempt of the teardown too: reported as remaining, by name and reason, never as dropped', async () => {
    const cluster = new FakeCluster();
    const run = await ownerRun(cluster);
    const database = await run.createDatabase({ template: 'schema', slug: 'stuck' });
    fakeOf(cluster, database.name).background = 1;
    await refusal(() => database.drop());

    const report = await run.teardown();

    expect(report.remaining).toEqual([database.name]);
    expect(report.dropped).toEqual([`${run.identity.prefix}tpl_schema`]);
    expect(report.failed).toHaveLength(1);
    expect(report.failed[0]?.name).toBe(database.name);
    expect(report.failed[0]?.reason).toContain('refused the forced drop 5 time(s)');
    expect(report.failed[0]?.reason).toContain('1 without a role (a background worker of PostgreSQL, such as autovacuum)');
    expect(report.retriedDrops).toEqual([]);
    expect(cluster.databases.has(database.name)).toBe(true);
    // Five attempts by the file and five by the teardown; nothing else was named.
    expect(forcedDropsOf(cluster, database.name)).toHaveLength(10);
    expect(cluster.namesInDatabaseStatements().every((name) => name.startsWith(run.identity.prefix))).toBe(true);
  });

  it('the stale sweep goes through the same retry', async () => {
    const stale = createRunIdentity('step_29', stampAt(NOW_SECONDS - STALE_AFTER_SECONDS - 3600, 'k3'));
    const cluster = new FakeCluster([`${stale.prefix}f01_crashed`]);
    fakeOf(cluster, `${stale.prefix}f01_crashed`).refuseNextDrops = 2;
    const run = await ownerRun(cluster);

    const report = await run.sweepStale();

    expect(report.dropped).toEqual([`${stale.prefix}f01_crashed`]);
    expect(report.failed).toEqual([]);
    expect(forcedDropsOf(cluster, `${stale.prefix}f01_crashed`)).toHaveLength(3);
    expect(run.retriedDrops).toEqual([{ name: `${stale.prefix}f01_crashed`, refusals: 2 }]);
  });
});

describe('the guards are what they were: the retry is behind them', () => {
  const younger = createRunIdentity('step_41', stampAt(NOW_SECONDS - 60, 'y7'));
  const foreign = ['dems_demo', 'dems_demo_next', 'dems_lane_1', 'postgres', 'template0', 'template1', `${younger.prefix}f01_identity`, `${younger.prefix}tpl_schema`, 'some_other_database'];

  it.each(foreign)('dropDatabase(%j) is refused before a statement is sent, whatever the retry policy', async (name) => {
    const cluster = new FakeCluster(foreign.filter((other) => !['postgres', 'template0', 'template1'].includes(other)));
    // If a drop of it were ever sent, the stand-in would refuse it and the helper would repeat it.
    fakeOf(cluster, name).refuseNextDrops = 3;
    const run = await ownerRun(cluster, { dropRetry: { attempts: 50, pauseMs: 0 } });
    const sent = cluster.statements.length;

    const error = await refusal(() => run.dropDatabase(name));

    expect(error).toBeInstanceOf(DbGuardError);
    expect(error.message).toContain('refused before any statement');
    expect(cluster.statements).toHaveLength(sent);
    expect(cluster.databaseStatements()).toEqual([]);
    expect(cluster.databases.has(name)).toBe(true);
    expect(fakeOf(cluster, name).refuseNextDrops).toBe(3);
  });
});
