// Three whole runs of Vitest, started as child processes with the self-check configuration
// (`../selfcheck/vitest.selfcheck.config.ts`), seen from the outside like a person at a shell:
//
//   1. test files that throw, under the real global setup: the run exits 1, and no database
//      of it remains (TI-10, TI-11: cleanup runs even when a test file throws);
//   2. PostgreSQL "unreachable" (the probe is pointed at a closed loopback port; the real server
//      is not touched): the run exits 1 with the message that says how to start it, and its
//      test neither runs nor is reported as passed or skipped (TI-1, GR-2).
//
//   3. hook modules at the conventional places (a fixture workspace): the global setup builds
//      tpl_schema and tpl_seed from them, a test file's worker builds tpl_bulk from its hook at
//      the first request, the run exits 0 and leaves nothing (the plug-in points for the rows
//      that own the migrations, the seed and the bulk fixture).
//
// The child gets no credential: the helper reads the connection files itself. Its arguments and
// its environment hold paths and names only.
import { execFile } from 'node:child_process';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ENV_TEST_STEP } from '../constants';
import { REPOSITORY_ROOT, WORKSPACE_ROOT } from '../credentials';
import { useTestDatabase } from '../index';
import { SELFTEST_TEMPLATE } from '../testing/probe-hooks';
import { privateRunEnv } from '../testing/private-run';

const VITEST = join(REPOSITORY_ROOT, 'node_modules', 'vitest', 'vitest.mjs');
const CONFIG = join(WORKSPACE_ROOT, 'test', 'helpers', 'db', 'selfcheck', 'vitest.selfcheck.config.ts');
const RUN_TIMEOUT_MS = 90_000;

const db = useTestDatabase({ template: SELFTEST_TEMPLATE });

interface NestedRun {
  readonly exitCode: number | string | null;
  readonly output: string;
}

function runVitest(project: string, label: string): Promise<NestedRun> {
  // The child is a fresh Vitest: it must not inherit the worker state of this one.
  const env: Record<string, string> = {};
  for (const [name, value] of Object.entries(process.env)) {
    if (value !== undefined && !name.startsWith('VITEST') && name !== 'NODE_OPTIONS') env[name] = value;
  }
  env[ENV_TEST_STEP] = label;
  env['NO_COLOR'] = '1';
  delete env['FORCE_COLOR'];
  return new Promise((resolve) => {
    execFile(
      process.execPath,
      // The default reporter, whatever the environment would pick: it prints the output of every test.
      [VITEST, 'run', '--config', CONFIG, '--root', WORKSPACE_ROOT, '--project', project, '--reporter', 'default'],
      { cwd: WORKSPACE_ROOT, env, timeout: RUN_TIMEOUT_MS, maxBuffer: 16 * 1024 * 1024 },
      (error, stdout, stderr) => {
        resolve({ exitCode: error === null ? 0 : (error.code ?? null), output: `${stdout}\n${stderr}` });
      },
    );
  });
}

async function namesWithPrefix(prefix: string): Promise<string[]> {
  const rows = await db.ownerPool().query<{ name: string }>(
    'SELECT datname::text AS name FROM pg_database WHERE starts_with(datname, $1) ORDER BY 1',
    [prefix],
  );
  return rows.rows.map((row) => row.name);
}

describe('a whole run, seen from the outside', () => {
  it('test files that throw: the run fails, every database of it is dropped', async () => {
    const label = privateRunEnv('thr')[ENV_TEST_STEP] ?? 'thr';
    const run = await runVitest('throwing', label);

    expect(run.exitCode, run.output).toBe(1);
    const prefix = new RegExp(`run prefix (dems_test_step_${label}_[0-9a-z]{8}_)`).exec(run.output)?.[1];
    expect(prefix, run.output).toBeDefined();
    // Both files got a clone of their own and failed.
    const used = [...run.output.matchAll(/\[selfcheck\] throwing-(?:test|hook) uses (dems_test_[a-z0-9_]+)/g)].map((match) => match[1] ?? '');
    expect(new Set(used).size).toBe(2);
    for (const name of used) expect(name.startsWith(prefix ?? 'none')).toBe(true);
    expect(run.output).toContain('selfcheck: this test throws on purpose');
    expect(run.output).toContain('selfcheck: this hook throws on purpose');
    expect(run.output).toMatch(/Test Files\s+2 failed \(2\)/);
    // The files dropped their own databases, so the teardown had only templates left: the ones the
    // global setup built (one output line each; how many depends on which hooks are plugged in)
    // and the private template the two files share, which a worker built. A clone that a file
    // had failed to drop would make the count larger.
    const builtBySetup = [...run.output.matchAll(new RegExp(`template ${prefix ?? 'none'}tpl_[a-z0-9_]+: built in \\d+ ms`, 'g'))].length;
    const dropped = Number(/teardown: dropped (\d+) database\(s\) in \d+ ms; 0 remain with the run prefix/.exec(run.output)?.[1]);
    expect(dropped, run.output).toBeGreaterThanOrEqual(1);
    expect(dropped, run.output).toBe(builtBySetup + 1);
    expect(await namesWithPrefix(prefix ?? 'none')).toEqual([]);
    console.log(`[test:db] nested run "throwing": exit ${run.exitCode}; databases used ${used.join(', ')}; remaining 0`);
  }, RUN_TIMEOUT_MS + 10_000);

  it('PostgreSQL unreachable: the run fails with the clear message; nothing runs, nothing is skipped', async () => {
    const label = privateRunEnv('unr')[ENV_TEST_STEP] ?? 'unr';
    const run = await runVitest('unreachable', label);

    expect(run.exitCode, run.output).toBe(1);
    expect(run.output).toMatch(/\[selfcheck\] the probe is pointed at 127\.0\.0\.1:\d+, where nothing listens/);
    expect(run.output).toMatch(/test:db needs the project's PostgreSQL on 127\.0\.0\.1:\d+, and nothing answers there \(ECONNREFUSED\)/);
    expect(run.output).toContain('Start it with "npm run pg:start"');
    expect(run.output).toContain('The database tests did NOT run and are NOT skipped: this run fails.');
    // The test of that project did not run, and the run does not claim that anything passed or was skipped.
    expect(run.output).not.toContain('MARKER');
    expect(run.output).not.toMatch(/\d+ passed/);
    expect(run.output).not.toMatch(/\d+ skipped/);
    // No run was started: there is no run prefix, so no database can have been created.
    expect(run.output).not.toContain('run prefix');
    const message = /test:db needs[^\n]*/.exec(run.output)?.[0] ?? '';
    console.log(`[test:db] nested run "unreachable": exit ${run.exitCode}; message: ${message}`);
  }, RUN_TIMEOUT_MS + 10_000);

  it('hook modules found by convention: the templates are built from them, in the main process and in a worker', async () => {
    const label = privateRunEnv('cnv')[ENV_TEST_STEP] ?? 'cnv';
    const run = await runVitest('convention', label);

    expect(run.exitCode, run.output).toBe(0);
    const prefix = new RegExp(`run prefix (dems_test_step_${label}_[0-9a-z]{8}_)`).exec(run.output)?.[1] ?? 'none';
    // Built by the global setup, in the main process, before any worker started.
    expect(run.output).toMatch(new RegExp(`template ${prefix}tpl_schema: built in \\d+ ms`));
    expect(run.output).toMatch(new RegExp(`template ${prefix}tpl_seed: built in \\d+ ms`));
    expect(run.output).not.toContain('no hook is plugged in');
    // Built by the test file, in its worker.
    expect(run.output).toContain('[selfcheck] convention: tpl_schema and tpl_seed came from the hook modules');
    expect(run.output).toContain('[selfcheck] convention: tpl_bulk came from the hook module');
    expect(run.output).toMatch(/Tests\s+2 passed \(2\)/);
    // Three templates were left for the teardown; the file dropped its two clones itself.
    expect(run.output).toMatch(/teardown: dropped 3 database\(s\) in \d+ ms; 0 remain with the run prefix/);
    expect(await namesWithPrefix(prefix)).toEqual([]);
    console.log(`[test:db] nested run "convention": exit ${run.exitCode}; templates from hook modules: tpl_schema, tpl_seed (global setup), tpl_bulk (worker)`);
  }, RUN_TIMEOUT_MS + 10_000);
});
