// The global setup of the Vitest project `db`, called here as a function with a stand-in for
// Vitest's project object and with injected hooks (TI-1, TI-4, TI-11, TI-12; T-TI-3).
import { describe, expect, it } from 'vitest';
import { FOREIGN_PORT, OWNER_ROLE } from '../constants';
import { setupDbTestProject } from '../global-setup';
import { injectedResolver, standardDefinitions } from '../hooks';
import { TestRun, useTestDatabase, type ProvidedTestRun } from '../index';
import { createRunIdentity } from '../names';
import { PROBE_HOOKS, PROBE_TABLE, SELFTEST_TEMPLATE } from '../testing/probe-hooks';
import { findClosedLoopbackPort } from '../testing/closed-port';
import { privateRunEnv } from '../testing/private-run';

const db = useTestDatabase({ template: SELFTEST_TEMPLATE });

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

async function namesWithPrefix(prefix: string): Promise<string[]> {
  const rows = await db.ownerPool().query<{ name: string }>(
    'SELECT datname::text AS name FROM pg_database WHERE starts_with(datname, $1) ORDER BY 1',
    [prefix],
  );
  return rows.rows.map((row) => row.name);
}

describe('the global setup of the project db', () => {
  it('with the schema and seed hooks plugged in: builds both templates, provides the run, and its teardown leaves nothing', async () => {
    const seen = capture();
    const teardown = await setupDbTestProject(seen.project, {
      env: privateRunEnv('gs'),
      resolveDefinition: injectedResolver(standardDefinitions({ schema: PROBE_HOOKS.schema, seed: PROBE_HOOKS.seed })),
      log: seen.log,
    });
    const provided = seen.provided[0];
    expect(seen.provided).toHaveLength(1);
    expect(provided).toBeDefined();
    if (provided === undefined) return;
    try {
      expect(provided.prefix).toBe(createRunIdentity(provided.label, provided.stamp).prefix);
      expect(provided.label).toBe(`step_${privateRunEnv('gs').DEMS_TEST_STEP}`);
      expect(provided.templates).toEqual(['schema', 'seed']);
      expect(provided.serverVersion).toMatch(/^18\./);
      expect(new Date(provided.startedAt).toISOString()).toBe(provided.startedAt);
      // What travels to the workers holds names and times only.
      expect(Object.keys(provided).sort()).toEqual(['label', 'prefix', 'serverVersion', 'stamp', 'startedAt', 'templates']);

      // A test file's view of that run: both templates are there, locked, owned by dems_owner.
      const file = await TestRun.attach(createRunIdentity(provided.label, provided.stamp), { resolveDefinition: async () => null });
      try {
        expect(await file.listDatabases()).toEqual([
          { name: `${provided.prefix}tpl_schema`, owner: OWNER_ROLE, isTemplate: true, allowConnections: false },
          { name: `${provided.prefix}tpl_seed`, owner: OWNER_ROLE, isTemplate: true, allowConnections: false },
        ]);
        const clone = await file.createDatabase({ template: 'seed', slug: 'module_test' });
        const rows = await clone.appPool().query<{ n: number }>(`SELECT count(*)::int AS n FROM ${PROBE_TABLE}`);
        expect(rows.rows).toEqual([{ n: 1 }]);
        // Left for the teardown on purpose: a file that never dropped its database.
        await clone.closeResources();
        // The bulk template has no hook in this run: the request says which file is missing.
        await expect(file.createDatabase({ template: 'bulk', slug: 'x' })).rejects.toMatchObject({ code: 'TEMPLATE_NOT_AVAILABLE' });
      } finally {
        await file.close();
      }
      expect(await namesWithPrefix(provided.prefix)).toHaveLength(3);
    } finally {
      await teardown();
    }
    expect(await namesWithPrefix(provided.prefix)).toEqual([]);

    const text = seen.lines.join('\n');
    expect(seen.lines[0]).toMatch(/^PostgreSQL 18\.\S+ on 127\.0\.0\.1:4432; helper role dems_owner, code under test dems_app; run prefix dems_test_/);
    expect(text).toMatch(/stale sweep: dropped \d+; kept \d+ of younger runs, \d+ of live runs, \d+ unrecognised; \d+ failed/);
    expect(text).toMatch(new RegExp(`template ${provided.prefix}tpl_schema: built in \\d+ ms \\(create \\d+ ms, hook \\d+ ms\\)`));
    expect(text).toMatch(new RegExp(`template ${provided.prefix}tpl_seed: built in \\d+ ms`));
    expect(text).toContain(`teardown: dropped 3 database(s)`);
    expect(text).toContain(`0 remain with the run prefix ${provided.prefix}`);
    expect(text).not.toMatch(/password|secret/i);
  });

  it('with no hook plugged in: builds no template, says which file is missing, and still provides the run', async () => {
    const seen = capture();
    const teardown = await setupDbTestProject(seen.project, { env: privateRunEnv('gsn'), resolveDefinition: async () => null, log: seen.log });
    try {
      expect(seen.provided[0]?.templates).toEqual([]);
      expect(await namesWithPrefix(seen.provided[0]?.prefix ?? 'none')).toEqual([]);
      expect(seen.lines.join('\n')).toContain('template tpl_schema: not built, no hook is plugged in (row W17: test/db/template-hook.schema.ts)');
    } finally {
      await teardown();
    }
    expect(seen.lines.at(-1)).toContain('teardown: dropped 0 database(s)');
  });

  it('with the schema hook only: tpl_seed is not built, and the line names the row that adds its hook', async () => {
    const seen = capture();
    const teardown = await setupDbTestProject(seen.project, {
      env: privateRunEnv('gss'),
      resolveDefinition: injectedResolver(standardDefinitions({ schema: PROBE_HOOKS.schema })),
      log: seen.log,
    });
    try {
      expect(seen.provided[0]?.templates).toEqual(['schema']);
      expect(seen.lines.join('\n')).toContain('template tpl_seed: not built, no hook is plugged in (row W20: src/db/seed/__tests__/template-hook.seed.ts)');
    } finally {
      await teardown();
    }
  });

  it('a hook that fails stops the setup, provides nothing, and leaves no database', async () => {
    const seen = capture();
    const setup = setupDbTestProject(seen.project, {
      env: privateRunEnv('gsf'),
      resolveDefinition: injectedResolver(
        standardDefinitions({
          schema: PROBE_HOOKS.schema,
          seed: async () => {
            throw new Error('the seed failed on purpose (test)');
          },
        }),
      ),
      log: seen.log,
    });
    await expect(setup).rejects.toMatchObject({ code: 'TEMPLATE_BUILD_FAILED' });
    expect(seen.provided).toEqual([]);
    // The run had started (its first line names the prefix); nothing of it is left.
    const prefix = /run prefix (dems_test_[a-z0-9_]+_)$/.exec(seen.lines[0] ?? '')?.[1];
    expect(prefix).toBeDefined();
    expect(await namesWithPrefix(prefix ?? 'none')).toEqual([]);
  });

  it('TI-1: when PostgreSQL does not answer, the setup fails and says how to start it (a closed loopback port)', async () => {
    const seen = capture();
    const port = await findClosedLoopbackPort();
    const setup = setupDbTestProject(seen.project, { env: privateRunEnv('gsu'), probeTarget: { host: '127.0.0.1', port }, log: seen.log });
    await expect(setup).rejects.toMatchObject({ code: 'POSTGRES_UNREACHABLE' });
    await expect(setup).rejects.toThrow(`nothing answers there (ECONNREFUSED)`);
    await expect(setup).rejects.toThrow('npm run pg:start');
    await expect(setup).rejects.toThrow('did NOT run and are NOT skipped: this run fails');
    expect(seen.provided).toEqual([]);
    expect(seen.lines).toEqual([]);
  });

  it('a probe target that is not loopback, or is the foreign default port, is refused without a connect', async () => {
    const seen = capture();
    await expect(setupDbTestProject(seen.project, { env: {}, probeTarget: { host: 'localhost', port: 4432 }, log: seen.log })).rejects.toMatchObject({
      code: 'ENDPOINT_REFUSED',
    });
    await expect(setupDbTestProject(seen.project, { env: {}, probeTarget: { host: '127.0.0.1', port: FOREIGN_PORT }, log: seen.log })).rejects.toMatchObject({
      code: 'ENDPOINT_REFUSED',
    });
    expect(seen.provided).toEqual([]);
  });
});
