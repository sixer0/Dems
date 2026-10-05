// The three templates of the contract (§10.1; TI-4 to TI-6; T-TI-3), built in a run of this
// file's own from the injected one-table migration, seed and bulk stand-ins: what the rows that
// own the real migrations, seed and bulk fixture plug in later goes through the same code.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { APP_ROLE, LOG_PREFIX, OWNER_ROLE } from '../constants';
import { DbTestHelperError, errorCode } from '../errors';
import { injectedResolver, standardDefinitions, type TemplateDefinition } from '../hooks';
import { TestRun, type TestDatabase } from '../index';
import { PROBE_BULK_ROWS, PROBE_HOOKS, PROBE_TABLE, probeSchemaHook } from '../testing/probe-hooks';
import { privateRunEnv } from '../testing/private-run';

const calls = { schema: 0, seed: 0, bulk: 0, race: 0 };

const definitions: TemplateDefinition[] = [
  ...standardDefinitions({
    schema: async (context) => {
      calls.schema += 1;
      await PROBE_HOOKS.schema(context);
    },
    seed: async (context) => {
      calls.seed += 1;
      await PROBE_HOOKS.seed(context);
    },
    bulk: async (context) => {
      calls.bulk += 1;
      await PROBE_HOOKS.bulk(context);
    },
  }),
  {
    key: 'x_race',
    base: 'empty',
    build: async (context) => {
      calls.race += 1;
      await probeSchemaHook(context);
      // Long enough for the second requester to arrive while the first one builds.
      await new Promise((resolve) => setTimeout(resolve, 150));
    },
  },
  {
    key: 'x_fails',
    base: 'schema',
    build: async ({ pool }) => {
      await pool.query(`INSERT INTO ${PROBE_TABLE} (token_hash, origin) VALUES ('half', 'x_fails')`);
      throw new Error('hook failed on purpose (test)');
    },
  },
  {
    key: 'x_leaks',
    base: 'schema',
    build: async ({ pool }) => {
      const client = await pool.connect();
      // The forced drop of the failed template ends this session; that must not crash the test.
      client.on('error', () => undefined);
      await client.query('SELECT 1');
      // Not released: the hook returns with a session still open on the template.
    },
  },
];
const resolveDefinition = injectedResolver(definitions);

let run!: TestRun;

async function refusal(action: () => Promise<unknown>): Promise<DbTestHelperError> {
  try {
    await action();
  } catch (error) {
    if (error instanceof DbTestHelperError) return error;
    throw error;
  }
  throw new Error('not refused');
}

async function rowCount(database: TestDatabase): Promise<number> {
  const result = await database.appPool().query<{ n: number }>(`SELECT count(*)::int AS n FROM ${PROBE_TABLE}`);
  return result.rows[0]?.n ?? -1;
}

beforeAll(async () => {
  run = await TestRun.start({ env: privateRunEnv('tpl'), resolveDefinition, sessionDrainMs: 400 });
});

afterAll(async () => {
  const started = run as TestRun | undefined;
  if (started !== undefined && !started.closed) await started.teardown();
});

describe('TI-4, TI-5: the templates are built once, as dems_owner, and locked', () => {
  it('the global setup path builds tpl_schema from the empty template, then tpl_seed from it', async () => {
    await run.ensureTemplate('schema', 'create-only');
    await run.ensureTemplate('seed', 'create-only');
    expect(calls).toMatchObject({ schema: 1, seed: 1, bulk: 0 });

    const p = run.identity.prefix;
    const databases = await run.listDatabases();
    expect(databases).toEqual([
      { name: `${p}tpl_schema`, owner: OWNER_ROLE, isTemplate: true, allowConnections: false },
      { name: `${p}tpl_seed`, owner: OWNER_ROLE, isTemplate: true, allowConnections: false },
    ]);
    for (const timing of run.templateTimings) {
      console.log(
        `${LOG_PREFIX} template ${timing.database}: ${Math.round(timing.totalMs)} ms ` +
          `(create ${Math.round(timing.createMs)} ms, hook ${Math.round(timing.hookMs)} ms)`,
      );
    }
    expect(run.templateTimings.map((timing) => timing.key)).toEqual(['schema', 'seed']);
  });

  it('a second request builds nothing', async () => {
    const sent = run.statementCount;
    await run.ensureTemplate('schema');
    await run.ensureTemplate('seed', 'create-only');
    expect(calls).toMatchObject({ schema: 1, seed: 1 });
    // One catalog read per request, and no other statement.
    expect(run.statementCount).toBe(sent + 2);
  });

  it('a locked template accepts no connection, not even from its owner', async () => {
    const pool = run.poolOn(`${run.identity.prefix}tpl_schema`, 'owner');
    let code: string | undefined = 'CONNECTED';
    try {
      await pool.query('SELECT 1');
    } catch (error) {
      code = errorCode(error);
    } finally {
      await pool.end();
    }
    // 55000: "database ... is not currently accepting connections".
    expect(code).toBe('55000');
  });

  it('the cluster encodes the first template as UTF8 with locale C (§10.1)', async () => {
    const clone = await run.createDatabase({ template: 'schema', slug: 'encoding' });
    try {
      const rows = await clone.ownerPool().query<{ encoding: string; collate: string; ctype: string }>(
        'SELECT pg_encoding_to_char(encoding)::text AS encoding, datcollate::text AS collate, datctype::text AS ctype ' +
          'FROM pg_database WHERE datname = current_database()',
      );
      expect(rows.rows).toEqual([{ encoding: 'UTF8', collate: 'C', ctype: 'C' }]);
    } finally {
      await clone.drop();
    }
  });
});

describe('TI-6: a clone is a copy of its template, owned by dems_owner', () => {
  it('a clone of tpl_schema has the table and no row; a clone of tpl_seed has the seed row', async () => {
    const schema = await run.createDatabase({ template: 'schema', slug: 'from_schema' });
    const seed = await run.createDatabase({ template: 'seed', slug: 'from_seed' });
    try {
      expect(schema.name).toBe(`${run.identity.prefix}f01_from_schema`);
      expect(seed.name).toBe(`${run.identity.prefix}f02_from_seed`);
      expect(await rowCount(schema)).toBe(0);
      expect(await rowCount(seed)).toBe(1);
      const owners = (await run.listDatabases()).filter((row) => !row.isTemplate);
      expect(owners).toEqual([
        { name: schema.name, owner: OWNER_ROLE, isTemplate: false, allowConnections: true },
        { name: seed.name, owner: OWNER_ROLE, isTemplate: false, allowConnections: true },
      ]);
      // A write into one clone reaches neither the other clone nor the template.
      await seed.appPool().query(`INSERT INTO ${PROBE_TABLE} (token_hash, origin) VALUES ('only-here', 'clone')`);
      expect(await rowCount(seed)).toBe(2);
      expect(await rowCount(schema)).toBe(0);
      const again = await run.createDatabase({ template: 'seed', slug: 'from_seed_again' });
      try {
        expect(await rowCount(again)).toBe(1);
      } finally {
        await again.drop();
      }
      console.log(
        `${LOG_PREFIX} clones of the private run: ${schema.name} ${Math.round(schema.timings.cloneMs)} ms, ` +
          `${seed.name} ${Math.round(seed.timings.cloneMs)} ms`,
      );
    } finally {
      await schema.drop();
      await seed.drop();
    }
  });

  it('the runtime role works in the clone with the privileges of the template', async () => {
    const clone = await run.createDatabase({ template: 'seed', slug: 'privileges' });
    try {
      const who = await clone.appPool().query<{ role: string }>('SELECT current_user::text AS role');
      expect(who.rows).toEqual([{ role: APP_ROLE }]);
      const written = await clone
        .appPool()
        .query<{ written_by: string }>(`INSERT INTO ${PROBE_TABLE} (token_hash, origin) VALUES ('t', 'app') RETURNING written_by`);
      expect(written.rows).toEqual([{ written_by: APP_ROLE }]);
      const seedRow = await clone.ownerPool().query<{ written_by: string }>(`SELECT written_by FROM ${PROBE_TABLE} WHERE token_hash = 'seed-row'`);
      expect(seedRow.rows).toEqual([{ written_by: OWNER_ROLE }]);
    } finally {
      await clone.drop();
    }
  });
});

describe('§10.1: tpl_bulk and private templates are built at their first request, once', () => {
  it('tpl_bulk does not exist until a test file asks for it', async () => {
    expect((await run.listDatabases()).map((row) => row.name)).not.toContain(`${run.identity.prefix}tpl_bulk`);
    const bulk = await run.createDatabase({ template: 'bulk', slug: 'paging' });
    try {
      expect(calls.bulk).toBe(1);
      expect(await rowCount(bulk)).toBe(1 + PROBE_BULK_ROWS);
      expect((await run.listDatabases()).find((row) => row.name === `${run.identity.prefix}tpl_bulk`)).toEqual({
        name: `${run.identity.prefix}tpl_bulk`,
        owner: OWNER_ROLE,
        isTemplate: true,
        allowConnections: false,
      });
      const second = await run.createDatabase({ template: 'bulk', slug: 'matrix' });
      expect(await rowCount(second)).toBe(1 + PROBE_BULK_ROWS);
      await second.drop();
      expect(calls.bulk).toBe(1);
    } finally {
      await bulk.drop();
    }
  });

  it('two test files that ask at the same time build the template once', async () => {
    // Two attached runs stand for the two workers: two processes, two sessions.
    const workerA = await TestRun.attach(run.identity, { resolveDefinition });
    const workerB = await TestRun.attach(run.identity, { resolveDefinition });
    try {
      const [a, b] = await Promise.all([
        workerA.createDatabase({ template: 'x_race', slug: 'worker_a' }),
        workerB.createDatabase({ template: 'x_race', slug: 'worker_b' }),
      ]);
      expect(calls.race).toBe(1);
      expect(a.name).not.toBe(b.name);
      expect(await rowCount(a)).toBe(0);
      expect(await rowCount(b)).toBe(0);
      // The loser of the race waited for the winner's build under the clone lock.
      expect(Math.max(a.timings.lockWaitMs, b.timings.lockWaitMs)).toBeGreaterThanOrEqual(0);
      await a.drop();
      await b.drop();
    } finally {
      await workerA.close();
      await workerB.close();
    }
  });
});

describe('a template build that fails leaves nothing behind', () => {
  it('a hook that throws: the half-built database is dropped, and the error names the cause', async () => {
    const error = await refusal(() => run.ensureTemplate('x_fails'));
    expect(error.code).toBe('TEMPLATE_BUILD_FAILED');
    expect(error.message).toContain('hook failed on purpose (test)');
    expect((await run.listDatabases()).map((row) => row.name)).not.toContain(`${run.identity.prefix}tpl_x_fails`);
    // The base it was copied from is untouched.
    const clone = await run.createDatabase({ template: 'schema', slug: 'after_failure' });
    expect(await rowCount(clone)).toBe(0);
    await clone.drop();
  });

  it('a hook that leaves a session open: the build fails (TI-5) and the database is dropped', async () => {
    const error = await refusal(() => run.ensureTemplate('x_leaks'));
    expect(error.code).toBe('TEMPLATE_BUILD_FAILED');
    expect(error.message).toContain('left sessions open (1 of role dems_owner)');
    expect((await run.listDatabases()).map((row) => row.name)).not.toContain(`${run.identity.prefix}tpl_x_leaks`);
  });

  it('a template nobody plugged a hook in for is "not available", with the file to add', async () => {
    const bare = await TestRun.attach(run.identity, { resolveDefinition: async () => null });
    try {
      // The standard templates exist in this run, so they are served without a hook.
      const clone = await bare.createDatabase({ template: 'schema', slug: 'served' });
      await clone.drop();
      const error = await refusal(() => bare.createDatabase({ template: 'x_unplugged', slug: 'x' }));
      expect(error.code).toBe('TEMPLATE_NOT_AVAILABLE');
    } finally {
      await bare.close();
    }
  });
});

describe('TI-11: the teardown of the run', () => {
  it('drops the clones and the locked templates; nothing with the run prefix remains', async () => {
    const leftover = await run.createDatabase({ template: 'seed', slug: 'never_dropped_by_its_file' });
    await leftover.appPool().query('SELECT 1');
    const before = (await run.listDatabases()).map((row) => row.name);
    expect(before).toEqual([
      leftover.name,
      `${run.identity.prefix}tpl_bulk`,
      `${run.identity.prefix}tpl_schema`,
      `${run.identity.prefix}tpl_seed`,
      `${run.identity.prefix}tpl_x_race`,
    ]);

    const report = await run.teardown();

    expect(report.failed).toEqual([]);
    expect(report.remaining).toEqual([]);
    expect([...report.dropped].sort()).toEqual([...before].sort());
    expect(run.closed).toBe(true);
    // Seen from another session: no database of that run is left.
    const viewer = await TestRun.attach(run.identity);
    try {
      expect(await viewer.listDatabases()).toEqual([]);
    } finally {
      await viewer.close();
    }
  });
});
