// What the test helper SENDS, on a stand-in cluster behind the driver seam: no database, no
// socket. The same behaviour is proven against the real PostgreSQL in the `*.db.test.ts` files.
//
//   T-TI-2  a request to drop the demo database, a lane, the maintenance database, a template
//           of PostgreSQL, a proof database or a database of another run is refused BEFORE a
//           statement is sent;
//   TI-3    every CREATE / ALTER / DROP DATABASE names databases of the own run only;
//   TI-5 to TI-7, TI-10 to TI-12: the order of the statements.
import { afterEach, describe, expect, it } from 'vitest';
import { CLONE_LOCK_KEY, LOCK_CLASS, OWNER_ROLE, STALE_AFTER_SECONDS } from '../constants';
import { DbGuardError, DbTestHelperError } from '../errors';
import { injectedResolver, type TemplateDefinition } from '../hooks';
import { createRunIdentity, livenessKey, type RunIdentity } from '../names';
import { TestRun } from '../run';
import { FakeCluster, fakeDataDir } from '../testing/fake-cluster';

const NOW_MS = Date.UTC(2026, 9, 4, 0, 30, 0);
const NOW_SECONDS = NOW_MS / 1000;

function stampAt(seconds: number, tail: string): string {
  return `${seconds.toString(36).padStart(6, '0')}${tail}`;
}

const hookCalls: string[] = [];
const noopTemplates: TemplateDefinition[] = [
  { key: 'schema', base: 'empty', build: async ({ database }) => void hookCalls.push(database) },
  { key: 'seed', base: 'schema', build: async ({ database }) => void hookCalls.push(database) },
  { key: 'bulk', base: 'seed', build: async ({ database }) => void hookCalls.push(database) },
];

const cleanups: Array<() => void | Promise<void>> = [];

async function ownerRun(cluster: FakeCluster, env: Record<string, string> = { DEMS_TEST_STEP: '33' }): Promise<TestRun> {
  const data = fakeDataDir();
  cleanups.push(data.remove);
  const run = await TestRun.start({
    env,
    dataDir: data.dir,
    clientFactory: cluster.factory,
    probe: async () => undefined,
    now: () => NOW_MS,
    sessionDrainMs: 30,
    resolveDefinition: injectedResolver(noopTemplates),
  });
  cleanups.push(() => run.close());
  return run;
}

async function attachedRun(cluster: FakeCluster, identity: RunIdentity): Promise<TestRun> {
  const data = fakeDataDir();
  cleanups.push(data.remove);
  const run = await TestRun.attach(identity, {
    dataDir: data.dir,
    clientFactory: cluster.factory,
    sessionDrainMs: 30,
    resolveDefinition: injectedResolver(noopTemplates),
  });
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

afterEach(async () => {
  hookCalls.length = 0;
  for (const cleanup of cleanups.splice(0).reverse()) await cleanup();
});

describe('T-TI-2: a refused request sends no statement', () => {
  const younger = createRunIdentity('step_41', stampAt(NOW_SECONDS - 60, 'y7'));
  const older = createRunIdentity('step_29', stampAt(NOW_SECONDS - 9 * 3600, 'k3'));
  const foreign = [
    'dems_demo',
    'dems_demo_next',
    'dems_lane_1',
    'dems_lane_2',
    'dems_lane_3',
    'postgres',
    'template0',
    'template1',
    'dems_proof_drizzle_20261004003235_a',
    `${younger.prefix}f01_identity`,
    `${younger.prefix}tpl_schema`,
    `${older.prefix}f01_identity`,
    'dems_test_handmade',
    'some_other_database',
  ];

  it.each(foreign)('dropDatabase(%j) is refused before a statement is sent', async (name) => {
    const cluster = new FakeCluster(foreign.filter((other) => !['postgres', 'template0', 'template1'].includes(other)));
    const run = await ownerRun(cluster);
    const sent = cluster.statements.length;
    const counted = run.statementCount;

    const error = await refusal(() => run.dropDatabase(name));

    expect(error).toBeInstanceOf(DbGuardError);
    expect(error.message).toContain('refused before any statement');
    expect(cluster.statements).toHaveLength(sent);
    expect(run.statementCount).toBe(counted);
    expect(cluster.databases.has(name)).toBe(true);
    expect(cluster.databaseStatements()).toEqual([]);
  });

  it.each(foreign)('no pool and no connection is handed out for %j', async (name) => {
    const cluster = new FakeCluster();
    const run = await ownerRun(cluster);
    const clients = cluster.clients.length;
    for (const role of ['owner', 'app'] as const) {
      expect((await refusal(async () => run.poolOn(name, role))).code).toMatch(/^GUARD_/);
      expect((await refusal(async () => run.connectionOn(name, role))).code).toMatch(/^GUARD_/);
    }
    expect(cluster.clients).toHaveLength(clients);
  });

  it('a pool and a connection are handed out for a database of the own run, with the role asked for', async () => {
    const cluster = new FakeCluster();
    const run = await ownerRun(cluster);
    const database = await run.createDatabase({ template: 'schema', slug: 'mine' });
    expect(database.runtime).toMatchObject({ host: '127.0.0.1', port: 4432, database: database.name, user: 'dems_app' });
    expect(run.connectionOn(database.name, 'owner')).toMatchObject({ database: database.name, user: OWNER_ROLE });
    expect(JSON.stringify(database.runtime)).not.toContain('MARKER');
    expect(database.runtime.password.reveal()).toBe('fake-app-MARKER');
    const pool = database.appPool();
    expect(pool.options).toMatchObject({ host: '127.0.0.1', port: 4432, database: database.name, user: 'dems_app', ssl: false, max: 5 });
    expect(database.appPool()).toBe(pool);
    expect(database.ownerPool().options).toMatchObject({ database: database.name, user: OWNER_ROLE, max: 2 });
  });

  it('a test file that asks for a clone of a foreign or unknown template is refused, and nothing is created', async () => {
    const cluster = new FakeCluster(['dems_demo']);
    const run = await ownerRun(cluster);
    for (const template of ['demo', '../dems_demo', 'x_"; --', 'SCHEMA']) {
      expect((await refusal(() => run.createDatabase({ template, slug: 'x' }))).code).toBe('NAME_INVALID');
    }
    expect((await refusal(() => run.createDatabase({ template: 'x_unknown', slug: 'x' }))).code).toBe('TEMPLATE_NOT_AVAILABLE');
    expect(cluster.databaseStatements()).toEqual([]);
  });

  it('the run is the owner role on the maintenance database, and a superuser session stops it', async () => {
    const cluster = new FakeCluster();
    const run = await ownerRun(cluster);
    expect(cluster.clients).toHaveLength(1);
    expect(cluster.clients[0]).toMatchObject({ host: '127.0.0.1', port: 4432, database: 'postgres', user: OWNER_ROLE, ssl: false });
    expect(run.server.role).toBe(OWNER_ROLE);

    const superuser = new FakeCluster();
    superuser.identity = { ...superuser.identity, superuser: true };
    const error = await refusal(() => ownerRun(superuser));
    expect(error.code).toBe('SUPERUSER_REFUSED');
    // The question was the only statement; no lock was taken, nothing was listed or changed.
    expect(superuser.statements).toHaveLength(1);
  });

  it('a malformed row label stops the run before the probe and before any connection', async () => {
    const cluster = new FakeCluster();
    let probed = false;
    const error = await refusal(() =>
      TestRun.start({ env: { DEMS_TEST_STEP: '33; x' }, clientFactory: cluster.factory, probe: async () => void (probed = true) }),
    );
    expect(error.code).toBe('RUN_LABEL_INVALID');
    expect(probed).toBe(false);
    expect(cluster.clients).toHaveLength(0);
  });

  it('an unreachable server stops the run before a credential file is opened or a client is built', async () => {
    const cluster = new FakeCluster();
    const error = await refusal(() =>
      TestRun.start({
        env: {},
        dataDir: '/nonexistent/dems-w11-no-data-dir',
        clientFactory: cluster.factory,
        probe: async () => {
          throw new DbTestHelperError('POSTGRES_UNREACHABLE', 'probe failed (test)');
        },
      }),
    );
    expect(error.code).toBe('POSTGRES_UNREACHABLE');
    expect(cluster.clients).toHaveLength(0);
  });
});

describe('TI-2, TI-12: the run prefix and the liveness lock', () => {
  it('takes the label from DEMS_TEST_STEP, a stamp from the clock, and the liveness lock of the stamp', async () => {
    const cluster = new FakeCluster();
    const run = await ownerRun(cluster, { DEMS_TEST_STEP: 'W17' });
    expect(run.identity.label).toBe('step_w17');
    expect(run.identity.prefix).toMatch(/^dems_test_step_w17_[0-9a-z]{8}_$/);
    expect(run.identity.stamp.slice(0, 6)).toBe(NOW_SECONDS.toString(36).padStart(6, '0'));
    expect(run.isOwner).toBe(true);
    const lock = cluster.statements.find((statement) => statement.text.includes('pg_try_advisory_lock'));
    expect(lock?.values).toEqual([LOCK_CLASS, livenessKey(run.identity.stamp)]);
    expect((await ownerRun(new FakeCluster(), {})).identity.label).toBe('local');
  });

  it('two runs of the same second and label get different prefixes', async () => {
    const cluster = new FakeCluster();
    const prefixes = new Set<string>();
    for (let i = 0; i < 6; i += 1) prefixes.add((await ownerRun(cluster)).identity.prefix);
    expect(prefixes.size).toBe(6);
  });

  it('a stamp whose liveness lock another session holds is not taken', async () => {
    const cluster = new FakeCluster();
    // Every stamp of this second is held elsewhere, except those whose random part starts with "a".
    const free = new Set<number>();
    for (let i = 0; i < 36; i += 1) free.add(livenessKey(stampAt(NOW_SECONDS, `a${i.toString(36)}`)));
    for (let i = 0; i < 36 * 36; i += 1) {
      const key = livenessKey(stampAt(NOW_SECONDS, i.toString(36).padStart(2, '0')));
      if (!free.has(key)) cluster.locksHeldElsewhere.add(key);
    }
    let run: TestRun | undefined;
    for (let attempt = 0; attempt < 60 && run === undefined; attempt += 1) {
      run = await ownerRun(cluster).catch((error: unknown) => {
        if (error instanceof DbTestHelperError && error.code === 'RUN_PREFIX_UNAVAILABLE') return undefined;
        throw error;
      });
    }
    expect(run).toBeDefined();
    expect(free.has(livenessKey(run?.identity.stamp ?? ''))).toBe(true);
  });
});

describe('TI-4 to TI-7: templates and clones', () => {
  it('builds the three templates in order, each locked after its hook, each owned by dems_owner', async () => {
    const cluster = new FakeCluster(['dems_demo']);
    const run = await ownerRun(cluster);
    const p = run.identity.prefix;

    await run.ensureTemplate('seed', 'create-only');
    expect(cluster.databaseStatements()).toEqual([
      `CREATE DATABASE "${p}tpl_schema" OWNER "dems_owner" TEMPLATE template0 ENCODING 'UTF8' LOCALE 'C'`,
      `ALTER DATABASE "${p}tpl_schema" WITH IS_TEMPLATE true ALLOW_CONNECTIONS false`,
      `CREATE DATABASE "${p}tpl_seed" TEMPLATE "${p}tpl_schema" OWNER "dems_owner"`,
      `ALTER DATABASE "${p}tpl_seed" WITH IS_TEMPLATE true ALLOW_CONNECTIONS false`,
    ]);
    expect(hookCalls).toEqual([`${p}tpl_schema`, `${p}tpl_seed`]);

    // The bulk template is built at its first request, and only once.
    await run.ensureTemplate('bulk');
    await run.ensureTemplate('bulk');
    await run.ensureTemplate('schema');
    expect(hookCalls).toEqual([`${p}tpl_schema`, `${p}tpl_seed`, `${p}tpl_bulk`]);
    expect(run.templateTimings.map((timing) => timing.key)).toEqual(['schema', 'seed', 'bulk']);
    for (const key of ['schema', 'seed', 'bulk']) {
      expect(cluster.databases.get(`${p}tpl_${key}`)).toMatchObject({ owner: OWNER_ROLE, isTemplate: true, allowConnections: false });
    }
  });

  it('every CREATE DATABASE runs between taking and releasing the clone lock (442002, 0)', async () => {
    const cluster = new FakeCluster();
    const run = await ownerRun(cluster);
    await run.createDatabase({ template: 'seed', slug: 'identity_login' });
    const texts = cluster.statements.map((statement) => statement.text);
    let held = false;
    let creates = 0;
    cluster.statements.forEach((statement, index) => {
      if (statement.text.includes('pg_advisory_lock(')) {
        expect(statement.values).toEqual([LOCK_CLASS, CLONE_LOCK_KEY]);
        expect(held, `lock taken twice at ${index}`).toBe(false);
        held = true;
      } else if (statement.text.includes('pg_advisory_unlock(') && statement.values[1] === CLONE_LOCK_KEY) {
        expect(held).toBe(true);
        held = false;
      } else if (statement.text.startsWith('CREATE DATABASE')) {
        expect(held, texts[index]).toBe(true);
        creates += 1;
      }
    });
    expect(held).toBe(false);
    expect(creates).toBe(3);
  });

  it('clones get <prefix>f<nn>_<slug>, the lowest free counter, and name the own run only', async () => {
    const cluster = new FakeCluster(['dems_demo', 'dems_lane_1', 'dems_proof_drizzle_20261004003235_a']);
    const run = await ownerRun(cluster);
    const p = run.identity.prefix;
    const a = await run.createDatabase({ template: 'schema', slug: 'identity_login' });
    const b = await run.createDatabase({ template: 'schema', slug: 'audit_chain' });
    expect(a.name).toBe(`${p}f01_identity_login`);
    expect(b.name).toBe(`${p}f02_audit_chain`);
    await a.drop();
    const c = await run.createDatabase({ template: 'schema', slug: 'pairing' });
    expect(c.name).toBe(`${p}f01_pairing`);
    expect(cluster.databases.get(c.name)?.owner).toBe(OWNER_ROLE);
    expect(cluster.databaseStatements().at(-1)).toBe(`CREATE DATABASE "${c.name}" TEMPLATE "${p}tpl_schema" OWNER "dems_owner"`);
    expect(cluster.namesInDatabaseStatements().every((name) => name.startsWith(p))).toBe(true);
    expect(a.dropped).toBe(true);
    await a.drop();
    expect((await refusal(async () => a.appPool())).code).toBe('DATABASE_NOT_READY');
  });

  it('a hook that fails leaves no half-built template behind', async () => {
    const cluster = new FakeCluster();
    const data = fakeDataDir();
    cleanups.push(data.remove);
    const run = await TestRun.start({
      env: {},
      dataDir: data.dir,
      clientFactory: cluster.factory,
      probe: async () => undefined,
      resolveDefinition: injectedResolver([
        {
          key: 'schema',
          base: 'empty',
          build: async () => {
            throw new Error('migration 0002 failed (test)');
          },
        },
      ]),
    });
    cleanups.push(() => run.close());
    const error = await refusal(() => run.ensureTemplate('schema'));
    expect(error.code).toBe('TEMPLATE_BUILD_FAILED');
    expect(error.message).toContain('migration 0002 failed (test)');
    expect(cluster.names().filter((name) => name.startsWith('dems_test_'))).toEqual([]);
    // The seed template has no hook in this run: the request names what is missing.
    const missing = await refusal(() => run.ensureTemplate('seed'));
    expect(missing.code).toBe('TEMPLATE_NOT_AVAILABLE');
    expect(missing.message).toContain('template-hook.seed.ts');
    expect(missing.message).toContain('W20');
  });

  it('a hook that leaves a session open fails the build, and the template is removed', async () => {
    const cluster = new FakeCluster();
    const data = fakeDataDir();
    cleanups.push(data.remove);
    const run = await TestRun.start({
      env: {},
      dataDir: data.dir,
      clientFactory: cluster.factory,
      probe: async () => undefined,
      sessionDrainMs: 30,
      resolveDefinition: injectedResolver([
        {
          key: 'schema',
          base: 'empty',
          build: async ({ database }) => {
            const created = cluster.databases.get(database);
            if (created !== undefined) created.sessions = [{ role: OWNER_ROLE, sessions: 1 }];
          },
        },
      ]),
    });
    cleanups.push(() => run.close());
    const error = await refusal(() => run.ensureTemplate('schema'));
    expect(error.code).toBe('TEMPLATE_BUILD_FAILED');
    expect(error.message).toContain('left sessions open (1 of role dems_owner)');
    expect(cluster.names().filter((name) => name.startsWith('dems_test_'))).toEqual([]);
  });
});

describe('TI-10, TI-11: cleanup', () => {
  it('a clone with a leaked session of the runtime role is not dropped, and no DROP is sent', async () => {
    const cluster = new FakeCluster();
    const run = await ownerRun(cluster);
    const database = await run.createDatabase({ template: 'schema', slug: 'leaky' });
    const fake = cluster.databases.get(database.name);
    if (fake !== undefined) fake.sessions = [{ role: 'dems_app', sessions: 2 }];
    const before = cluster.databaseStatements().length;

    const error = await refusal(() => database.drop());

    expect(error.code).toBe('SESSIONS_REMAIN');
    expect(error.message).toContain('2 of role dems_app');
    expect(error.message).toContain('db.onCleanup');
    expect(cluster.databaseStatements()).toHaveLength(before);
    expect(cluster.databases.has(database.name)).toBe(true);
    expect(database.dropped).toBe(false);

    // Once the session is gone, the same call drops it.
    if (fake !== undefined) fake.sessions = [];
    await database.drop();
    expect(cluster.databases.has(database.name)).toBe(false);
  });

  it('leftover sessions of the owner role do not stop a forced drop', async () => {
    const cluster = new FakeCluster();
    const run = await ownerRun(cluster);
    const database = await run.createDatabase({ template: 'schema', slug: 'own_sessions' });
    const fake = cluster.databases.get(database.name);
    if (fake !== undefined) fake.sessions = [{ role: OWNER_ROLE, sessions: 1 }];
    await database.drop();
    expect(cluster.databases.has(database.name)).toBe(false);
    expect(cluster.databaseStatements().at(-1)).toBe(`DROP DATABASE IF EXISTS "${database.name}" WITH (FORCE)`);
  });

  it('closes what the test registered, in reverse order, before the drop', async () => {
    const cluster = new FakeCluster();
    const run = await ownerRun(cluster);
    const database = await run.createDatabase({ template: 'schema', slug: 'closers' });
    const order: string[] = [];
    database.onCleanup(() => void order.push('first registered'));
    database.onCleanup(async () => void order.push('second registered'));
    database.onCleanup(() => {
      order.push('throws');
      throw new Error('close failed (test)');
    });
    const error = await refusal(() => database.drop());
    expect(order).toEqual(['throws', 'second registered', 'first registered']);
    // The database is gone all the same; the failed close is reported.
    expect(error.code).toBe('CLEANUP_INCOMPLETE');
    expect(error.message).toContain('close failed (test)');
    expect(cluster.databases.has(database.name)).toBe(false);
  });

  it('the teardown drops every database of the run, clones first, templates unlocked first, and nothing else', async () => {
    const other = createRunIdentity('step_41', stampAt(NOW_SECONDS - 60, 'y7'));
    const bystanders = ['dems_demo', 'dems_lane_1', 'dems_proof_drizzle_20261004003235_a', `${other.prefix}tpl_schema`, `${other.prefix}f01_x`];
    const cluster = new FakeCluster(bystanders);
    const run = await ownerRun(cluster);
    const p = run.identity.prefix;
    await run.createDatabase({ template: 'seed', slug: 'never_dropped_by_its_file' });
    await run.createDatabase({ template: 'bulk', slug: 'another' });
    const before = cluster.databaseStatements().length;

    const report = await run.teardown();

    expect(report.remaining).toEqual([]);
    expect(report.failed).toEqual([]);
    expect(report.dropped).toEqual([
      `${p}f01_never_dropped_by_its_file`,
      `${p}f02_another`,
      `${p}tpl_bulk`,
      `${p}tpl_schema`,
      `${p}tpl_seed`,
    ]);
    expect(cluster.databaseStatements().slice(before)).toEqual([
      `DROP DATABASE IF EXISTS "${p}f01_never_dropped_by_its_file" WITH (FORCE)`,
      `DROP DATABASE IF EXISTS "${p}f02_another" WITH (FORCE)`,
      `ALTER DATABASE "${p}tpl_bulk" WITH IS_TEMPLATE false`,
      `DROP DATABASE IF EXISTS "${p}tpl_bulk" WITH (FORCE)`,
      `ALTER DATABASE "${p}tpl_schema" WITH IS_TEMPLATE false`,
      `DROP DATABASE IF EXISTS "${p}tpl_schema" WITH (FORCE)`,
      `ALTER DATABASE "${p}tpl_seed" WITH IS_TEMPLATE false`,
      `DROP DATABASE IF EXISTS "${p}tpl_seed" WITH (FORCE)`,
    ]);
    expect(cluster.names()).toEqual([...bystanders, 'postgres', 'template0', 'template1'].sort());
    expect(run.closed).toBe(true);
    expect((await refusal(() => run.createDatabase({ template: 'schema', slug: 'x' }))).code).toBe('RUN_CLOSED');
  });

  it('the teardown reports a database it could not drop', async () => {
    const cluster = new FakeCluster();
    const run = await ownerRun(cluster);
    const database = await run.createDatabase({ template: 'schema', slug: 'leaky' });
    const fake = cluster.databases.get(database.name);
    if (fake !== undefined) fake.sessions = [{ role: 'dems_app', sessions: 1 }];
    const report = await run.teardown();
    expect(report.remaining).toEqual([database.name]);
    expect(report.failed).toHaveLength(1);
    expect(report.failed[0]?.name).toBe(database.name);
    expect(report.failed[0]?.reason).toContain('1 of role dems_app');
  });

  it('a test file attached to a run may clone and drop, but not sweep or tear the run down', async () => {
    const cluster = new FakeCluster();
    const owner = await ownerRun(cluster);
    await owner.ensureTemplate('schema', 'create-only');
    const file = await attachedRun(cluster, owner.identity);
    expect(file.isOwner).toBe(false);
    const database = await file.createDatabase({ template: 'schema', slug: 'from_a_worker' });
    expect(database.name).toBe(`${owner.identity.prefix}f01_from_a_worker`);
    expect((await refusal(() => file.teardown())).code).toBe('RUN_NOT_OWNER');
    expect((await refusal(() => file.sweepStale())).code).toBe('RUN_NOT_OWNER');
    await database.drop();
    await file.close();
    // Closing an attached run leaves the run's databases alone.
    expect(cluster.databases.has(`${owner.identity.prefix}tpl_schema`)).toBe(true);
  });
});

describe('TI-12: the stale sweep', () => {
  const staleDead = createRunIdentity('step_29', stampAt(NOW_SECONDS - STALE_AFTER_SECONDS - 3600, 'k3'));
  const staleLive = createRunIdentity('local', stampAt(NOW_SECONDS - STALE_AFTER_SECONDS - 7200, 'l8'));
  const younger = createRunIdentity('step_41', stampAt(NOW_SECONDS - 120, 'y7'));
  const untouchable = [
    'dems_demo',
    'dems_lane_1',
    'dems_lane_2',
    'dems_lane_3',
    'dems_proof_drizzle_20261004003235_a',
    `${staleLive.prefix}tpl_schema`,
    `${staleLive.prefix}f01_long_running`,
    `${younger.prefix}tpl_schema`,
    `${younger.prefix}f01_in_use`,
    'dems_test_handmade',
  ];

  it('drops only databases of runs that are older than six hours and not alive', async () => {
    const cluster = new FakeCluster([...untouchable, `${staleDead.prefix}f01_crashed`, `${staleDead.prefix}f02_crashed`]);
    cluster.add(`${staleDead.prefix}tpl_schema`, { isTemplate: true, allowConnections: false });
    cluster.add(`${staleDead.prefix}tpl_seed`, { isTemplate: true, allowConnections: false });
    cluster.locksHeldElsewhere.add(livenessKey(staleLive.stamp));
    const run = await ownerRun(cluster);

    const report = await run.sweepStale();

    expect(report.dropped).toEqual([
      `${staleDead.prefix}f01_crashed`,
      `${staleDead.prefix}f02_crashed`,
      `${staleDead.prefix}tpl_schema`,
      `${staleDead.prefix}tpl_seed`,
    ]);
    expect([...report.keptLive].sort()).toEqual([`${staleLive.prefix}f01_long_running`, `${staleLive.prefix}tpl_schema`]);
    expect([...report.keptYounger].sort()).toEqual([`${younger.prefix}f01_in_use`, `${younger.prefix}tpl_schema`]);
    expect(report.unrecognised).toEqual(['dems_test_handmade']);
    expect(report.failed).toEqual([]);
    expect(cluster.names()).toEqual([...untouchable, 'postgres', 'template0', 'template1'].sort());
    // Not one statement named a database outside the stale, dead run.
    expect(cluster.namesInDatabaseStatements().every((name) => name.startsWith(staleDead.prefix))).toBe(true);
    // The liveness lock of the swept run was taken for the sweep and released afterwards.
    const key = livenessKey(staleDead.stamp);
    const locks = cluster.statements.filter((statement) => statement.values[1] === key).map((statement) => statement.text);
    expect(locks).toHaveLength(2);
    expect(locks[0]).toContain('pg_try_advisory_lock');
    expect(locks[1]).toContain('pg_advisory_unlock');
  });

  it('leaves a stale database with a session of another role, and reports it', async () => {
    const cluster = new FakeCluster();
    cluster.add(`${staleDead.prefix}f01_zombie`, { sessions: [{ role: 'dems_app', sessions: 1 }] });
    const run = await ownerRun(cluster);
    const report = await run.sweepStale();
    expect(report.dropped).toEqual([]);
    expect(report.failed.map((failure) => failure.name)).toEqual([`${staleDead.prefix}f01_zombie`]);
    expect(cluster.databases.has(`${staleDead.prefix}f01_zombie`)).toBe(true);
    expect(cluster.databaseStatements()).toEqual([]);
  });

  it('never sweeps its own databases', async () => {
    const cluster = new FakeCluster();
    const run = await ownerRun(cluster);
    await run.createDatabase({ template: 'schema', slug: 'mine' });
    const before = cluster.names();
    const report = await run.sweepStale();
    expect(report.dropped).toEqual([]);
    expect(cluster.names()).toEqual(before);
  });
});
