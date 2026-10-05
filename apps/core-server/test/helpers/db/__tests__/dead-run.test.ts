// Row W11b, decision D111: a run that was stopped before its teardown leaves its databases; the
// stale sweep takes them after six hours. `TestRun.dropDeadRun(prefix)` removes ONE such run by
// name at once, after showing that it is dead:
//
//   - the text is exactly a run prefix, and not the caller's own: anything else is refused before
//     a statement is sent (the demo database, a lane, `postgres`, the templates of PostgreSQL);
//   - no session holds the run's liveness lock (a run that is alive is refused, its templates too);
//   - no client session of any role is on its databases, twice, a settle time apart.
//
// No database and no socket here: the stand-in cluster. Against the real server:
// `dead-run.db.test.ts`.
import { afterEach, describe, expect, it } from 'vitest';
import { DEAD_RUN_SETTLE_MS, LOCK_CLASS, OWNER_ROLE, STALE_AFTER_SECONDS } from '../constants';
import { DbGuardError, DbTestHelperError } from '../errors';
import { injectedResolver, type TemplateDefinition } from '../hooks';
import { createRunIdentity, guardDeadRunDatabase, livenessKey, parseRunPrefix, type RunIdentity } from '../names';
import { TestRun, type RunOptions } from '../run';
import { FakeCluster, fakeDataDir, type FakeDatabase } from '../testing/fake-cluster';

const NOW_MS = Date.UTC(2026, 9, 4, 11, 0, 0);
const NOW_SECONDS = NOW_MS / 1000;
const TEMPLATES: TemplateDefinition[] = [
  { key: 'schema', base: 'empty', build: async () => undefined },
  { key: 'seed', base: 'schema', build: async () => undefined },
];
const cleanups: Array<() => void | Promise<void>> = [];

function stampAt(seconds: number, tail: string): string {
  return `${seconds.toString(36).padStart(6, '0')}${tail}`;
}

/** A run that was stopped forty minutes ago: far younger than the six hours of the stale sweep. */
const STOPPED = createRunIdentity('step_64m', stampAt(NOW_SECONDS - 40 * 60, 'g5'));
const STOPPED_DATABASES = [`${STOPPED.prefix}f01_backpressure`, `${STOPPED.prefix}tpl_schema`, `${STOPPED.prefix}tpl_seed`];
/** Another row's run, started a minute ago. */
const NEIGHBOUR = createRunIdentity('step_67', stampAt(NOW_SECONDS - 60, 'y7'));
const BYSTANDERS = ['dems_demo', 'dems_lane_1', 'dems_lane_2', 'dems_lane_3', `${NEIGHBOUR.prefix}f01_identity`, `${NEIGHBOUR.prefix}tpl_schema`];

function clusterWithTheStoppedRun(): FakeCluster {
  const cluster = new FakeCluster([...BYSTANDERS, `${STOPPED.prefix}f01_backpressure`]);
  cluster.add(`${STOPPED.prefix}tpl_schema`, { isTemplate: true, allowConnections: false });
  cluster.add(`${STOPPED.prefix}tpl_seed`, { isTemplate: true, allowConnections: false });
  return cluster;
}

async function ownerRun(cluster: FakeCluster, options: RunOptions = {}): Promise<TestRun> {
  const data = fakeDataDir();
  cleanups.push(data.remove);
  const run = await TestRun.start({
    env: { DEMS_TEST_STEP: '33c' },
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

async function attachedRun(cluster: FakeCluster, identity: RunIdentity): Promise<TestRun> {
  const data = fakeDataDir();
  cleanups.push(data.remove);
  const run = await TestRun.attach(identity, { dataDir: data.dir, clientFactory: cluster.factory, resolveDefinition: injectedResolver(TEMPLATES) });
  cleanups.push(() => run.close());
  return run;
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

function fakeOf(cluster: FakeCluster, name: string): FakeDatabase {
  const database = cluster.databases.get(name);
  if (database === undefined) throw new Error(`the stand-in cluster has no database ${name}`);
  return database;
}

function locksOn(cluster: FakeCluster, key: number): string[] {
  return cluster.statements.filter((statement) => statement.values[1] === key && statement.values[0] === LOCK_CLASS).map((statement) => statement.text);
}

afterEach(async () => {
  for (const cleanup of cleanups.splice(0).reverse()) await cleanup();
});

const NOT_A_RUN_PREFIX: Array<[string, unknown]> = [
  ['the demo database', 'dems_demo'],
  ['the demo database with an underscore', 'dems_demo_'],
  ['a copy the reset keeps', 'dems_demo_prev'],
  ['a lane', 'dems_lane_1'],
  ['a lane with an underscore', 'dems_lane_1_'],
  ['the maintenance database', 'postgres'],
  ['a template of PostgreSQL', 'template0'],
  ['the other template of PostgreSQL', 'template1'],
  ['a proof database', 'dems_proof_drizzle_20261004003235_a'],
  ['the test prefix alone', 'dems_test_'],
  ['a label without a stamp', 'dems_test_step_64m_'],
  ['a run prefix without its last underscore', STOPPED.prefix.slice(0, -1)],
  ['a database name of the run', `${STOPPED.prefix}f01_backpressure`],
  ['a template name of the run', `${STOPPED.prefix}tpl_schema`],
  ['a run prefix with a second underscore', `${STOPPED.prefix}_`],
  ['a pattern', 'dems_test_step_64m_%'],
  ['a pattern in place of the stamp', 'dems_test_step_64m_________'],
  ['upper case', STOPPED.prefix.toUpperCase()],
  ['a stamp of seven characters', 'dems_test_step_64m_tmdoqjg_'],
  ['a label of thirteen characters', 'dems_test_step_abcdefghijklm_tmdoqjg5_'],
  ['a leading space', ` ${STOPPED.prefix}`],
  ['a line break at the end', `${STOPPED.prefix}\n`],
  ['a quote', `${STOPPED.prefix}"; DROP DATABASE dems_demo; --`],
  ['the empty text', ''],
  ['a number', 42],
  ['null', null],
  ['undefined', undefined],
];

describe('a run prefix, and nothing else', () => {
  it('is dems_test_<label>_<stamp>_ with its last underscore', () => {
    expect(parseRunPrefix(STOPPED.prefix)).toEqual(STOPPED);
    expect(parseRunPrefix('dems_test_local_tmd0a1b2_')).toEqual(createRunIdentity('local', 'tmd0a1b2'));
    expect(parseRunPrefix('dems_test_step_abcdefghijkl_00000000_')?.label).toBe('step_abcdefghijkl');
  });

  it.each(NOT_A_RUN_PREFIX)('%s is not one', (_label, value) => {
    expect(parseRunPrefix(value)).toBeNull();
  });
});

describe('the guard of a named dead run', () => {
  const own = createRunIdentity('step_33c', stampAt(NOW_SECONDS, 'a1'));

  it('passes the databases of the run that was named, and only those', () => {
    for (const name of STOPPED_DATABASES) expect(guardDeadRunDatabase(name, own, { run: STOPPED })).toBe(name);
    for (const name of [...BYSTANDERS, 'postgres', 'template0', 'template1', `${own.prefix}f01_mine`, STOPPED.prefix, 'dems_test_handmade', 42, null]) {
      expect(() => guardDeadRunDatabase(name, own, { run: STOPPED }), String(name)).toThrow(DbGuardError);
      expect(() => guardDeadRunDatabase(name, own, { run: STOPPED }), String(name)).toThrow('refused before any statement');
    }
  });

  it('never passes a database of the caller\'s own run, whatever is claimed', () => {
    expect(() => guardDeadRunDatabase(`${own.prefix}f01_mine`, own, { run: own })).toThrow('belongs to this run');
    expect(() => guardDeadRunDatabase(`${own.prefix}tpl_schema`, own, { run: own })).toThrow(DbGuardError);
  });
});

describe('dropDeadRun: refused before a statement is sent', () => {
  it.each(NOT_A_RUN_PREFIX)('%s', async (_label, value) => {
    const cluster = clusterWithTheStoppedRun();
    const run = await ownerRun(cluster);
    const sent = cluster.statements.length;
    const counted = run.statementCount;
    const names = cluster.names();

    const error = await refusal(() => run.dropDeadRun(value as string, { settleMs: 0 }));

    expect(error).toBeInstanceOf(DbGuardError);
    expect(error.code).toBe('GUARD_NOT_A_TEST_DATABASE');
    expect(error.message).toContain('refused before any statement');
    expect(error.message).toContain('is not the prefix of a test run');
    expect(cluster.statements).toHaveLength(sent);
    expect(run.statementCount).toBe(counted);
    expect(cluster.names()).toEqual(names);
  });

  it('the caller\'s own run: its teardown is the way', async () => {
    const cluster = clusterWithTheStoppedRun();
    const run = await ownerRun(cluster);
    await run.createDatabase({ template: 'schema', slug: 'mine' });
    const sent = cluster.statements.length;
    const names = cluster.names();

    const error = await refusal(() => run.dropDeadRun(run.identity.prefix, { settleMs: 0 }));

    expect(error).toBeInstanceOf(DbGuardError);
    expect(error.code).toBe('GUARD_NOT_STALE');
    expect(error.message).toContain('is this run');
    expect(cluster.statements).toHaveLength(sent);
    expect(cluster.names()).toEqual(names);
  });

  it('a test file attached to a run cannot, and a closed run cannot', async () => {
    const cluster = clusterWithTheStoppedRun();
    const owner = await ownerRun(cluster);
    const file = await attachedRun(cluster, owner.identity);
    const sent = cluster.statements.length;
    expect((await refusal(() => file.dropDeadRun(STOPPED.prefix, { settleMs: 0 }))).code).toBe('RUN_NOT_OWNER');
    await owner.close();
    expect((await refusal(() => owner.dropDeadRun(STOPPED.prefix, { settleMs: 0 }))).code).toBe('RUN_CLOSED');
    expect(cluster.statements).toHaveLength(sent);
    for (const name of STOPPED_DATABASES) expect(cluster.databases.has(name)).toBe(true);
  });
});

describe('dropDeadRun: a run that is alive', () => {
  it('is refused with RUN_ALIVE after one statement, the question; its clone and its locked templates stay', async () => {
    const cluster = clusterWithTheStoppedRun();
    // The owner of that run still exists: another session holds its liveness lock.
    cluster.locksHeldElsewhere.add(livenessKey(STOPPED.stamp));
    const run = await ownerRun(cluster);
    const sent = cluster.statements.length;
    const names = cluster.names();

    const error = await refusal(() => run.dropDeadRun(STOPPED.prefix, { settleMs: 0 }));

    expect(error.code).toBe('RUN_ALIVE');
    expect(error.message).toContain(`the run ${STOPPED.prefix}* is alive`);
    expect(error.message).toContain(`advisory lock ${LOCK_CLASS}, ${livenessKey(STOPPED.stamp)}`);
    expect(error.message).toContain('Nothing was dropped');
    expect(cluster.statements.slice(sent).map((statement) => statement.text)).toEqual(['SELECT pg_try_advisory_lock($1::int, $2::int) AS locked']);
    expect(cluster.databaseStatements()).toEqual([]);
    expect(cluster.names()).toEqual(names);
    expect(fakeOf(cluster, `${STOPPED.prefix}tpl_schema`)).toMatchObject({ isTemplate: true, allowConnections: false });
  });

  it('a run started a minute ago by another row: alive, refused, untouched', async () => {
    const cluster = clusterWithTheStoppedRun();
    cluster.locksHeldElsewhere.add(livenessKey(NEIGHBOUR.stamp));
    const run = await ownerRun(cluster);
    expect((await refusal(() => run.dropDeadRun(NEIGHBOUR.prefix, { settleMs: 0 }))).code).toBe('RUN_ALIVE');
    expect(cluster.databases.has(`${NEIGHBOUR.prefix}f01_identity`)).toBe(true);
    expect(cluster.databases.has(`${NEIGHBOUR.prefix}tpl_schema`)).toBe(true);
    expect(cluster.databaseStatements()).toEqual([]);
  });
});

describe('dropDeadRun: a dead run that somebody still works in', () => {
  it.each([
    ['the runtime role', 'dems_app', 'dems-core-server'],
    ['the owner role, which a forced drop would end', OWNER_ROLE, 'dems-test-fixture'],
  ])('a session of %s on one of its databases: refused, nothing dropped, nothing ended, the lock released', async (_label, role, application) => {
    const cluster = clusterWithTheStoppedRun();
    fakeOf(cluster, `${STOPPED.prefix}f01_backpressure`).sessions = [{ role, sessions: 2, application }];
    const run = await ownerRun(cluster);
    const names = cluster.names();

    const error = await refusal(() => run.dropDeadRun(STOPPED.prefix, { settleMs: 0 }));

    expect(error.code).toBe('SESSIONS_REMAIN');
    expect(error.message).toContain(`sessions are open on databases of the run ${STOPPED.prefix}*`);
    expect(error.message).toContain(`2 of role ${role} (application "${application}") on ${STOPPED.prefix}f01_backpressure`);
    expect(error.message).toContain('no session was ended');
    expect(cluster.databaseStatements()).toEqual([]);
    expect(cluster.names()).toEqual(names);
    expect(fakeOf(cluster, `${STOPPED.prefix}f01_backpressure`).sessions).toHaveLength(1);
    // Taken once, given back once.
    const locks = locksOn(cluster, livenessKey(STOPPED.stamp));
    expect(locks).toHaveLength(2);
    expect(locks[0]).toContain('pg_try_advisory_lock');
    expect(locks[1]).toContain('pg_advisory_unlock');
  });

  it('a session that connects during the settle time: refused at the second look', async () => {
    const cluster = clusterWithTheStoppedRun();
    const run = await ownerRun(cluster);
    let looks = 0;
    cluster.beforeStatement = (text) => {
      if (!text.includes('FROM pg_stat_activity') || !text.includes('starts_with(datname, $1)')) return;
      looks += 1;
      if (looks === 2) fakeOf(cluster, `${STOPPED.prefix}f01_backpressure`).sessions = [{ role: 'dems_app', sessions: 1, application: 'late' }];
    };

    const error = await refusal(() => run.dropDeadRun(STOPPED.prefix, { settleMs: 5 }));

    expect(looks).toBe(2);
    expect(error.code).toBe('SESSIONS_REMAIN');
    expect(error.message).toContain('1 of role dems_app (application "late")');
    expect(cluster.databaseStatements()).toEqual([]);
    for (const name of STOPPED_DATABASES) expect(cluster.databases.has(name)).toBe(true);
  });

  it('looks twice, the settle time apart, before it drops; the default is 3 s', async () => {
    expect(DEAD_RUN_SETTLE_MS).toBe(3_000);
    const cluster = clusterWithTheStoppedRun();
    const run = await ownerRun(cluster);
    const looks: number[] = [];
    cluster.beforeStatement = (text) => {
      if (text.includes('FROM pg_stat_activity') && text.includes('starts_with(datname, $1)')) looks.push(performance.now());
    };
    await run.dropDeadRun(STOPPED.prefix, { settleMs: 60 });
    expect(looks).toHaveLength(2);
    // A timer may fire a fraction of a millisecond early.
    expect((looks[1] ?? 0) - (looks[0] ?? 0)).toBeGreaterThanOrEqual(55);
  });
});

describe('dropDeadRun: a run that is dead and quiet', () => {
  it('drops its clone, then its templates, and nothing else; the run is forty minutes old', async () => {
    const cluster = clusterWithTheStoppedRun();
    const run = await ownerRun(cluster);
    const mine = await run.createDatabase({ template: 'schema', slug: 'mine' });
    expect(NOW_SECONDS - Number.parseInt(STOPPED.stamp.slice(0, 6), 36)).toBeLessThan(STALE_AFTER_SECONDS);
    // The stale sweep leaves that run alone: it is too young. That is why it has to be named.
    const swept = await run.sweepStale();
    expect(swept.dropped).toEqual([]);
    expect(swept.keptYounger).toEqual(expect.arrayContaining(STOPPED_DATABASES));
    const before = cluster.databaseStatements().length;

    const report = await run.dropDeadRun(STOPPED.prefix, { settleMs: 0 });

    expect(report.prefix).toBe(STOPPED.prefix);
    expect(report.dropped).toEqual(STOPPED_DATABASES);
    expect(report.remaining).toEqual([]);
    expect(report.failed).toEqual([]);
    expect(cluster.databaseStatements().slice(before)).toEqual([
      `DROP DATABASE IF EXISTS "${STOPPED.prefix}f01_backpressure" WITH (FORCE)`,
      `ALTER DATABASE "${STOPPED.prefix}tpl_schema" WITH IS_TEMPLATE false`,
      `DROP DATABASE IF EXISTS "${STOPPED.prefix}tpl_schema" WITH (FORCE)`,
      `ALTER DATABASE "${STOPPED.prefix}tpl_seed" WITH IS_TEMPLATE false`,
      `DROP DATABASE IF EXISTS "${STOPPED.prefix}tpl_seed" WITH (FORCE)`,
    ]);
    // The demo database, the lanes, the other row's run and the caller's own databases are as they were.
    expect(cluster.names()).toEqual([...BYSTANDERS, mine.name, `${run.identity.prefix}tpl_schema`, 'postgres', 'template0', 'template1'].sort());
    const locks = locksOn(cluster, livenessKey(STOPPED.stamp));
    expect(locks).toHaveLength(2);
    expect(locks[0]).toContain('pg_try_advisory_lock');
    expect(locks[1]).toContain('pg_advisory_unlock');
  });

  it('a second call finds nothing and drops nothing', async () => {
    const cluster = clusterWithTheStoppedRun();
    const run = await ownerRun(cluster);
    await run.dropDeadRun(STOPPED.prefix, { settleMs: 0 });
    const before = cluster.databaseStatements().length;
    const report = await run.dropDeadRun(STOPPED.prefix, { settleMs: 0 });
    expect(report).toMatchObject({ dropped: [], remaining: [], failed: [] });
    expect(cluster.databaseStatements()).toHaveLength(before);
  });

  it('an autovacuum worker on one of its databases does not count as somebody: the drop is repeated', async () => {
    const cluster = clusterWithTheStoppedRun();
    Object.assign(fakeOf(cluster, `${STOPPED.prefix}f01_backpressure`), { background: 1, backgroundLeavesAfter: 2 });
    const run = await ownerRun(cluster);
    const report = await run.dropDeadRun(STOPPED.prefix, { settleMs: 0 });
    expect(report.dropped).toEqual(STOPPED_DATABASES);
    expect(report.remaining).toEqual([]);
    expect(run.retriedDrops).toEqual([{ name: `${STOPPED.prefix}f01_backpressure`, refusals: 2 }]);
  });

  it('a database that cannot be dropped is reported as remaining, by name and reason; the others go; the lock is released', async () => {
    const cluster = clusterWithTheStoppedRun();
    const run = await ownerRun(cluster);
    // A session that connects after the two looks, at the instant of the first drop.
    cluster.beforeStatement = (text) => {
      if (text.startsWith('DROP DATABASE') && text.includes('f01_backpressure')) {
        fakeOf(cluster, `${STOPPED.prefix}f01_backpressure`).sessions = [{ role: 'dems_app', sessions: 1, application: 'zombie' }];
      }
    };

    const report = await run.dropDeadRun(STOPPED.prefix, { settleMs: 0 });

    expect(report.dropped).toEqual([`${STOPPED.prefix}tpl_schema`, `${STOPPED.prefix}tpl_seed`]);
    expect(report.remaining).toEqual([`${STOPPED.prefix}f01_backpressure`]);
    expect(report.failed).toHaveLength(1);
    expect(report.failed[0]?.name).toBe(`${STOPPED.prefix}f01_backpressure`);
    expect(report.failed[0]?.reason).toContain('1 of role dems_app (application "zombie")');
    expect(locksOn(cluster, livenessKey(STOPPED.stamp)).at(-1)).toContain('pg_advisory_unlock');
    expect(cluster.namesInDatabaseStatements().every((name) => name.startsWith(STOPPED.prefix))).toBe(true);
  });
});
