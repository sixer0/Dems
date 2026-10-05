// Decision D134: what a test file states it needs, and what the helper makes of it. This file
// belongs to the database-free project and proves the RULES and what the helper SENDS, on the
// stand-in cluster behind the driver seam:
//
//   - a stated need is checked: a limit that is no whole number of milliseconds, or higher than
//     DB_NEED_MAX_MS, or a quietCluster that is no boolean, is refused with NEEDS_INVALID;
//   - a stated limit is a FLOOR: the helper raises to it and never brings anything down, not the
//     cap of decision D114, not a value the file set itself, not "no limit";
//   - the helper's own two hooks keep at least their own 180 s whatever a file states;
//   - a connect wait that is not stated leaves the pools exactly as they were;
//   - on a cluster: a clone that asks for nothing reads nothing; a clone that asks for a quiet
//     cluster reads the clone-lock queue BEFORE its CREATE DATABASE, asks again while somebody
//     else is on it, gives up at its bound and creates the database anyway, and takes no lock
//     for itself while it does.
//
// Against the real PostgreSQL: `needs.db.test.ts`. The rule of decision D114 (the caps the
// helper sets by itself): `limits.test.ts`.
import { afterEach, describe, expect, it } from 'vitest';
import { CLUSTER_QUIET_BUDGET_MS, CONNECT_TIMEOUT_MS, DB_HOOK_TIMEOUT_MS, DB_NEED_MAX_MS, DB_TEST_TIMEOUT_MS } from '../constants';
import { DbTestHelperError } from '../errors';
import { injectedResolver, type TemplateDefinition } from '../hooks';
import { connectTimeoutWithNeed, helperHookTimeout, limitsWithNeeds, normalizeNeeds } from '../index';
import { TestRun, type TestDatabase } from '../run';
import { FakeCluster, fakeDataDir } from '../testing/fake-cluster';

const RUNNER_DEFAULTS = { testTimeout: 5_000, hookTimeout: 10_000 };

function refusal(action: () => unknown): DbTestHelperError {
  try {
    action();
  } catch (error) {
    if (error instanceof DbTestHelperError) return error;
    throw error;
  }
  throw new Error('not refused');
}

// ── The rules, without a cluster ───────────────────────────────────────────────────────────────

describe('a stated need is checked where it is stated', () => {
  const badNumbers: Array<[string, number]> = [
    ['zero, which would mean no limit at all', 0],
    ['a negative number', -1_000],
    ['a fraction of a millisecond', 1.5],
    ['NaN', Number.NaN],
    ['infinity, which would hang the run for ever', Number.POSITIVE_INFINITY],
    ['one above the ceiling', DB_NEED_MAX_MS + 1],
    ['a value in seconds instead of milliseconds', 600_000 * 60],
  ];

  it.each(badNumbers)('refuses %j for the limit of a test', (_what, value) => {
    const error = refusal(() => normalizeNeeds({ testTimeoutMs: value }));
    expect(error.code).toBe('NEEDS_INVALID');
    expect(error.message).toContain('needs.testTimeoutMs');
  });

  it.each(badNumbers)('refuses %j for the limit of a hook', (_what, value) => {
    const error = refusal(() => normalizeNeeds({ hookTimeoutMs: value }));
    expect(error.code).toBe('NEEDS_INVALID');
    expect(error.message).toContain('needs.hookTimeoutMs');
  });

  it.each(badNumbers)('refuses %j for the wait of a connection', (_what, value) => {
    const error = refusal(() => normalizeNeeds({ connectTimeoutMs: value }));
    expect(error.code).toBe('NEEDS_INVALID');
    expect(error.message).toContain('needs.connectTimeoutMs');
  });

  it('names the ceiling and the cap it would otherwise have used', () => {
    const error = refusal(() => normalizeNeeds({ testTimeoutMs: DB_NEED_MAX_MS + 1 }));
    expect(error.message).toContain(String(DB_NEED_MAX_MS));
    expect(error.message).toContain(String(DB_TEST_TIMEOUT_MS));
  });

  it.each([[true], [false], [undefined]])('takes quietCluster %j', (value) => {
    expect(normalizeNeeds({ quietCluster: value }).quietCluster).toBe(value === true);
  });

  it.each([['yes'], [1], [0], [[[]]], [[{}]]])('refuses a quietCluster that is no boolean: %j', (value) => {
    const error = refusal(() => normalizeNeeds({ quietCluster: value as unknown as boolean }));
    expect(error.code).toBe('NEEDS_INVALID');
    expect(error.message).toContain('needs.quietCluster');
  });

  it('keeps every part of a whole statement, and the ceiling itself', () => {
    const needs = normalizeNeeds({
      testTimeoutMs: DB_NEED_MAX_MS,
      hookTimeoutMs: 1,
      connectTimeoutMs: CONNECT_TIMEOUT_MS,
      quietCluster: true,
    });
    expect(needs).toEqual({ testTimeoutMs: DB_NEED_MAX_MS, hookTimeoutMs: 1, connectTimeoutMs: CONNECT_TIMEOUT_MS, quietCluster: true });
  });

  it('of a call that states nothing, only the quiet is definite: false', () => {
    expect(normalizeNeeds()).toEqual({ testTimeoutMs: undefined, hookTimeoutMs: undefined, connectTimeoutMs: undefined, quietCluster: false });
    expect(normalizeNeeds({})).toEqual(normalizeNeeds());
  });

  it('hands back a frozen object, so a caller cannot change what the helper already applied', () => {
    expect(Object.isFrozen(normalizeNeeds({ testTimeoutMs: 60_000 }))).toBe(true);
  });
});

describe('a stated limit is a floor the helper raises to, and never a ceiling', () => {
  it('from the runner’s own 5 s and 10 s, a stated 240 s and 300 s win over the caps', () => {
    expect(limitsWithNeeds(RUNNER_DEFAULTS, { testTimeoutMs: 240_000, hookTimeoutMs: 300_000 })).toEqual({
      testTimeout: 240_000,
      hookTimeout: 300_000,
    });
  });

  it('a stated need BELOW the cap does not lower what the helper already raised', () => {
    // The helper set the caps when it was imported; the file then asks for less. The caps stay.
    expect(limitsWithNeeds({ testTimeout: DB_TEST_TIMEOUT_MS, hookTimeout: DB_HOOK_TIMEOUT_MS }, { testTimeoutMs: 60_000, hookTimeoutMs: 30_000 })).toEqual(
      { testTimeout: DB_TEST_TIMEOUT_MS, hookTimeout: DB_HOOK_TIMEOUT_MS },
    );
  });

  it('of a file that set a higher limit itself, that higher limit stays', () => {
    expect(limitsWithNeeds({ testTimeout: 600_000, hookTimeout: 700_000 }, { testTimeoutMs: 60_000, hookTimeoutMs: 60_000 })).toEqual({
      testTimeout: 600_000,
      hookTimeout: 700_000,
    });
  });

  it('"no limit" stays no limit: a stated need never ends a debugging session', () => {
    for (const none of [0, -1, Number.POSITIVE_INFINITY]) {
      expect(limitsWithNeeds({ testTimeout: none, hookTimeout: none }, { testTimeoutMs: 60_000, hookTimeoutMs: 60_000 })).toEqual({
        testTimeout: none,
        hookTimeout: none,
      });
    }
  });

  it('the two limits are raised by their own part of the statement, not by the other', () => {
    expect(limitsWithNeeds(RUNNER_DEFAULTS, { testTimeoutMs: 240_000 })).toEqual({ testTimeout: 240_000, hookTimeout: DB_HOOK_TIMEOUT_MS });
    expect(limitsWithNeeds(RUNNER_DEFAULTS, { hookTimeoutMs: 300_000 })).toEqual({ testTimeout: DB_TEST_TIMEOUT_MS, hookTimeout: 300_000 });
  });

  it('with nothing stated, the rule of decision D114 holds unchanged', () => {
    expect(limitsWithNeeds(RUNNER_DEFAULTS, {})).toEqual({ testTimeout: DB_TEST_TIMEOUT_MS, hookTimeout: DB_HOOK_TIMEOUT_MS });
    expect(limitsWithNeeds({ testTimeout: 300_000, hookTimeout: 60_000 }, {})).toEqual({ testTimeout: 300_000, hookTimeout: DB_HOOK_TIMEOUT_MS });
  });

  it('where the runner’s limits cannot be read, the caps are the floor under a stated need', () => {
    expect(limitsWithNeeds(null, { testTimeoutMs: 30_000, hookTimeoutMs: 20_000 })).toEqual({
      testTimeout: DB_TEST_TIMEOUT_MS,
      hookTimeout: DB_HOOK_TIMEOUT_MS,
    });
    expect(limitsWithNeeds(null, { testTimeoutMs: 400_000, hookTimeoutMs: 500_000 })).toEqual({ testTimeout: 400_000, hookTimeout: 500_000 });
  });

  it('a value that is no number of milliseconds is replaced by the stated need or the cap', () => {
    expect(limitsWithNeeds({ testTimeout: Number.NaN, hookTimeout: Number.NaN }, { testTimeoutMs: 240_000 }).testTimeout).toBe(240_000);
    expect(limitsWithNeeds({ testTimeout: Number.NaN, hookTimeout: Number.NaN }, {}).testTimeout).toBe(DB_TEST_TIMEOUT_MS);
  });

  it.each([
    // what the runner holds, what the file states, what applies
    [5_000, 1, 5_000],
    [5_000, 60_000, 60_000],
    [5_000, DB_TEST_TIMEOUT_MS, DB_TEST_TIMEOUT_MS],
    [5_000, 240_000, 240_000],
    [DB_TEST_TIMEOUT_MS, 60_000, DB_TEST_TIMEOUT_MS],
    [DB_TEST_TIMEOUT_MS, DB_NEED_MAX_MS, DB_NEED_MAX_MS],
    [600_000, 120_001, 600_000],
  ])('the higher of %i held and %i stated is %i', (held, stated, expected) => {
    const limits = limitsWithNeeds({ testTimeout: held, hookTimeout: 10_000 }, { testTimeoutMs: stated });
    expect(limits.testTimeout).toBe(expected);
    expect(limits.testTimeout).toBeGreaterThanOrEqual(Math.max(held, stated));
  });

  it("never turns a cap the helper raised itself into a shorter limit", () => {
    // In a run of the database tests the caps are already held when a file states its needs.
    const atCaps = { testTimeout: DB_TEST_TIMEOUT_MS, hookTimeout: DB_HOOK_TIMEOUT_MS };
    for (const stated of [1, 1_000, 60_000, DB_TEST_TIMEOUT_MS]) {
      expect(limitsWithNeeds(atCaps, { testTimeoutMs: stated }).testTimeout).toBe(DB_TEST_TIMEOUT_MS);
    }
  });
});

describe("the helper's own hooks", () => {
  it('carry their own 180 s when nothing is stated', () => {
    expect(helperHookTimeout({})).toBe(DB_HOOK_TIMEOUT_MS);
  });

  it('are never shortened by a file that states a shorter hook need', () => {
    // A clone waits for the clone lock and a drop is repeated: the helper needs its own time.
    expect(helperHookTimeout({ hookTimeoutMs: 1 })).toBe(DB_HOOK_TIMEOUT_MS);
    expect(helperHookTimeout({ hookTimeoutMs: 60_000 })).toBe(DB_HOOK_TIMEOUT_MS);
    expect(helperHookTimeout({ hookTimeoutMs: DB_HOOK_TIMEOUT_MS })).toBe(DB_HOOK_TIMEOUT_MS);
  });

  it('are lengthened by a file that states a longer one', () => {
    expect(helperHookTimeout({ hookTimeoutMs: DB_HOOK_TIMEOUT_MS + 1 })).toBe(DB_HOOK_TIMEOUT_MS + 1);
    expect(helperHookTimeout({ hookTimeoutMs: DB_NEED_MAX_MS })).toBe(DB_NEED_MAX_MS);
  });

  it('keep "no limit" of a run that was started without limits', () => {
    expect(helperHookTimeout({ hookTimeoutMs: DB_HOOK_TIMEOUT_MS })).toBe(DB_HOOK_TIMEOUT_MS);
  });
});

describe('the wait for a connection', () => {
  it('is left alone when nothing is stated: the pools are exactly what they were', () => {
    expect(connectTimeoutWithNeed({})).toBeUndefined();
    expect(connectTimeoutWithNeed({ quietCluster: true })).toBeUndefined();
    expect(connectTimeoutWithNeed({ testTimeoutMs: 240_000 })).toBeUndefined();
  });

  it('is never shortened below the helper’s own 5 s', () => {
    expect(connectTimeoutWithNeed({ connectTimeoutMs: 1 })).toBe(CONNECT_TIMEOUT_MS);
    expect(connectTimeoutWithNeed({ connectTimeoutMs: CONNECT_TIMEOUT_MS })).toBe(CONNECT_TIMEOUT_MS);
  });

  it('is lengthened to what is stated above it', () => {
    expect(connectTimeoutWithNeed({ connectTimeoutMs: 20_000 })).toBe(20_000);
    expect(connectTimeoutWithNeed({ connectTimeoutMs: DB_NEED_MAX_MS })).toBe(DB_NEED_MAX_MS);
  });
});

// ── What the helper sends, on the stand-in cluster ─────────────────────────────────────────────

const NOW_MS = Date.UTC(2026, 9, 5, 0, 30, 0);

const noopTemplates: TemplateDefinition[] = [
  { key: 'schema', base: 'empty', build: async () => undefined },
  { key: 'seed', base: 'schema', build: async () => undefined },
  { key: 'bulk', base: 'seed', build: async () => undefined },
];

const cleanups: Array<() => void | Promise<void>> = [];

/** A run of the owner kind on the stand-in cluster, with a short quiet bound for the tests. */
async function ownerRun(cluster: FakeCluster, clusterQuietBudgetMs = 150): Promise<TestRun> {
  const data = fakeDataDir();
  cleanups.push(data.remove);
  const run = await TestRun.start({
    env: { DEMS_TEST_STEP: '33e' },
    dataDir: data.dir,
    clientFactory: cluster.factory,
    probe: async () => undefined,
    now: () => NOW_MS,
    sessionDrainMs: 20,
    clusterQuietBudgetMs,
    resolveDefinition: injectedResolver(noopTemplates),
  });
  cleanups.push(() => run.close());
  return run;
}

function indexOfStatement(cluster: FakeCluster, needle: string, from = 0): number {
  return cluster.statements.findIndex((statement, index) => index >= from && statement.text.includes(needle));
}

async function clone(run: TestRun, slug: string, options: { quiet?: boolean; connectTimeoutMs?: number } = {}): Promise<TestDatabase> {
  return run.createDatabase({ template: 'schema', slug, ...options });
}

afterEach(async () => {
  for (const cleanup of cleanups.splice(0).reverse()) await cleanup();
});

describe('a clone request that asks for a quiet cluster (decision D134)', () => {
  it('that asks for nothing reads nothing and reports that nothing was asked', async () => {
    const cluster = new FakeCluster();
    const run = await ownerRun(cluster);
    const database = await clone(run, 'quiet_not_asked');
    expect(cluster.cloneLockReads).toBe(0);
    expect(database.timings.quiet).toEqual({ waitedMs: 0, obtained: false, budgetMs: 0 });
    await database.drop();
  });

  it('reads the clone-lock queue once on a quiet cluster, before its CREATE DATABASE', async () => {
    const cluster = new FakeCluster();
    const run = await ownerRun(cluster);
    await run.ensureTemplate('schema');
    const before = cluster.statements.length;
    const database = await clone(run, 'quiet_free', { quiet: true });
    expect(indexOfStatement(cluster, 'FROM pg_locks', before)).toBeGreaterThanOrEqual(0);
    expect(indexOfStatement(cluster, 'CREATE DATABASE', before)).toBeGreaterThan(indexOfStatement(cluster, 'FROM pg_locks', before));
    expect(cluster.cloneLockReads).toBe(1);
    expect(database.timings.quiet.obtained).toBe(true);
    expect(database.timings.quiet.budgetMs).toBe(150);
    expect(database.timings.quiet.waitedMs).toBeLessThan(150);
    await database.drop();
  });

  it('asks again while another session is on the clone lock, and goes when the queue empties', async () => {
    const cluster = new FakeCluster();
    const run = await ownerRun(cluster, 5_000);
    await run.ensureTemplate('schema');
    // "Another session" holds and waits on the lock for the first two looks, then the cluster is quiet.
    cluster.cloneLockBusyElsewhere = 1;
    cluster.beforeStatement = (text) => {
      if (text.includes('FROM pg_locks') && cluster.cloneLockReads >= 2) cluster.cloneLockBusyElsewhere = 0;
    };
    const database = await clone(run, 'quiet_then_free', { quiet: true });
    expect(cluster.cloneLockReads).toBe(3);
    expect(database.timings.quiet.obtained).toBe(true);
    expect(database.timings.quiet.waitedMs).toBeGreaterThanOrEqual(10);
    await database.drop();
  });

  it('gives up at its bound, says so, and creates the database anyway', async () => {
    const cluster = new FakeCluster();
    const run = await ownerRun(cluster, 200);
    await run.ensureTemplate('schema');
    cluster.cloneLockBusyElsewhere = 3; // Somebody is on the lock the whole time.
    const started = performance.now();
    const database = await clone(run, 'quiet_busy', { quiet: true });
    const elapsed = performance.now() - started;
    expect(database.timings.quiet.obtained).toBe(false);
    expect(database.timings.quiet.budgetMs).toBe(200);
    expect(database.timings.quiet.waitedMs).toBeGreaterThanOrEqual(200);
    expect(elapsed).toBeGreaterThanOrEqual(200);
    expect(cluster.names()).toContain(database.name);
    expect(cluster.cloneLockReads).toBeGreaterThanOrEqual(2);
    await database.drop();
    expect(cluster.names()).not.toContain(database.name);
  });

  it('takes nothing for itself: the advisory-lock statements are the two of the clone', async () => {
    const askedForQuiet = new FakeCluster();
    const plain = new FakeCluster();
    const quietRun = await ownerRun(askedForQuiet, 60);
    const plainRun = await ownerRun(plain, 60);
    await quietRun.ensureTemplate('schema');
    await plainRun.ensureTemplate('schema');
    const asked = await clone(quietRun, 'quiet_take_nothing', { quiet: true });
    const plainClone = await clone(plainRun, 'plain');
    const advisory = (cluster: FakeCluster): string[] =>
      cluster.statements
        .filter((statement) => /pg_(?:try_)?advisory_(?:lock|unlock)/.test(statement.text))
        .map((statement) => statement.text.split('(')[0] ?? '');
    expect(advisory(askedForQuiet)).toEqual(advisory(plain));
    // The liveness lock of the run, the clone lock of the template build, the clone lock of the clone.
    expect(advisory(askedForQuiet)).toEqual([
      'SELECT pg_try_advisory_lock',
      'SELECT pg_advisory_lock',
      'SELECT pg_advisory_unlock',
      'SELECT pg_advisory_lock',
      'SELECT pg_advisory_unlock',
    ]);
    await asked.drop();
    await plainClone.drop();
  });

  it('defaults to the bound of the helper where the run states none', async () => {
    const cluster = new FakeCluster();
    const data = fakeDataDir();
    cleanups.push(data.remove);
    const run = await TestRun.start({
      env: { DEMS_TEST_STEP: '33e' },
      dataDir: data.dir,
      clientFactory: cluster.factory,
      probe: async () => undefined,
      now: () => NOW_MS,
      resolveDefinition: injectedResolver(noopTemplates),
    });
    cleanups.push(() => run.close());
    await run.ensureTemplate('schema');
    const database = await clone(run, 'quiet_default_budget', { quiet: true });
    expect(database.timings.quiet.budgetMs).toBe(CLUSTER_QUIET_BUDGET_MS);
    await database.drop();
  });
});

describe('a stated connect wait reaches the pools of that clone', () => {
  it('of a caller that states nothing: the helper’s defaults, and TI-14’s five and two', async () => {
    const cluster = new FakeCluster();
    const run = await ownerRun(cluster);
    const database = await clone(run, 'connect_default');
    const app = database.appPool();
    const owner = database.ownerPool();
    expect([app.options.connectionTimeoutMillis, owner.options.connectionTimeoutMillis]).toEqual([CONNECT_TIMEOUT_MS, CONNECT_TIMEOUT_MS]);
    expect([app.options.max, owner.options.max]).toEqual([5, 2]);
    await database.drop();
  });

  it('of a caller that states one: both pools of that clone carry it, the ceilings do not move', async () => {
    const cluster = new FakeCluster();
    const run = await ownerRun(cluster);
    const database = await clone(run, 'connect_stated', { connectTimeoutMs: 20_000 });
    expect(database.appPool().options.connectionTimeoutMillis).toBe(20_000);
    expect(database.ownerPool().options.connectionTimeoutMillis).toBe(20_000);
    expect([database.appPool().options.max, database.ownerPool().options.max]).toEqual([5, 2]);
    await database.drop();
  });

  it('is per clone: the next database that states nothing gets the default again', async () => {
    const cluster = new FakeCluster();
    const run = await ownerRun(cluster);
    const stated = await clone(run, 'connect_one', { connectTimeoutMs: 30_000 });
    const next = await clone(run, 'connect_two');
    expect(stated.appPool().options.connectionTimeoutMillis).toBe(30_000);
    expect(next.appPool().options.connectionTimeoutMillis).toBe(CONNECT_TIMEOUT_MS);
    await stated.drop();
    await next.drop();
  });

  it('never changes the endpoint, the role or the ceiling of either pool', async () => {
    const cluster = new FakeCluster();
    const run = await ownerRun(cluster);
    const database = await clone(run, 'connect_endpoint', { connectTimeoutMs: 12_000 });
    const app = database.appPool();
    const owner = database.ownerPool();
    expect([app.options.user, owner.options.user]).toEqual(['dems_app', 'dems_owner']);
    for (const pool of [app, owner]) {
      expect(pool.options.host).toBe('127.0.0.1');
      expect(pool.options.port).toBe(4432);
      expect(pool.options.database).toBe(database.name);
      expect(pool.options.ssl).toBe(false);
      expect(pool.options.connectionTimeoutMillis).toBe(12_000);
      expect([5, 2]).toContain(pool.options.max);
    }
    // The helper's own session on the maintenance database is untouched by a file's need.
    for (const client of cluster.clients) {
      expect(client.database).toBe('postgres');
      expect(client.connectionTimeoutMillis).toBe(CONNECT_TIMEOUT_MS);
    }
    await database.drop();
  });
});
