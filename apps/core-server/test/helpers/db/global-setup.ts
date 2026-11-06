/**
 * The global setup of the Vitest project `db` (plan row W11; database contract §10: TI-1, TI-4,
 * TI-11, TI-12). `test/global-setup.db.ts`, the path the Vitest configuration names, calls
 * `setupDbTestProject` and returns its teardown.
 *
 * Once per run, in the main process, before any worker starts:
 *   1. PostgreSQL answers on 127.0.0.1:4432, or the run FAILS with a message that says how to
 *      start it. It never skips (TI-1, GR-2). The helper attaches to the running server; it
 *      does not start or stop one.
 *   2. The two connection files are read; the helper's session is `dems_owner`, not a
 *      superuser; the runtime role is `dems_app` with no extra attribute.
 *   3. A fresh run prefix and the "this run is alive" lock.
 *   4. The stale sweep (TI-12).
 *   5. `tpl_schema` and `tpl_seed`, when their hooks are plugged in (`hooks.ts`).
 *   6. The run identity is provided to the test files.
 * The returned teardown drops every database with the run prefix (TI-11) and fails the run if
 * one remains. Before its summary it prints one line that says how many forced drops of the run
 * needed a retry (row W11b): those drops succeeded; the line is there so that the cause, a
 * background worker of the server on the database at that instant, stays visible.
 *
 * A line printed here holds names, counts and times, never a credential.
 */
import { APP_ROLE, LOG_PREFIX, OWNER_ROLE, PROVIDE_KEY } from './constants';
import { DbTestHelperError } from './errors';
import { TEMPLATE_HOOK_MODULES, conventionResolver } from './hooks';
import type { ProvidedTestRun } from './provided';
import { TestRun, type RetriedDrop, type StartOptions } from './run';
import { verifyAppRole } from './session';

/** The part of Vitest's `TestProject` the setup needs. */
export interface ProjectLike {
  provide(key: typeof PROVIDE_KEY, value: ProvidedTestRun): void;
}

export interface GlobalSetupOptions extends StartOptions {
  /** Receives each line. Default: standard output, with the `[test:db]` prefix. */
  readonly log?: (line: string) => void;
}

/** The standard templates the global setup builds; `bulk` is built at its first request. */
const EAGER_TEMPLATES = ['schema', 'seed'] as const;

function ms(value: number): string {
  return `${Math.round(value)} ms`;
}

/**
 * The one line about retried drops. Such a drop was refused by PostgreSQL with SQLSTATE 42501
 * while no client session of another role was on the database, and went through at a later
 * attempt (`ddl.ts`); nothing failed.
 */
export function retriedDropsLine(retried: readonly RetriedDrop[]): string {
  if (retried.length === 0) return 'forced drops that needed a retry: 0';
  const refusals = retried.reduce((sum, drop) => sum + drop.refusals, 0);
  return (
    `forced drops that needed a retry: ${retried.length} (${refusals} refusal(s) with SQLSTATE 42501 ` +
    'while a backend that the owner role may not end, such as an autovacuum worker, was on the database; each drop then went through)'
  );
}

export async function setupDbTestProject(project: ProjectLike, options: GlobalSetupOptions = {}): Promise<() => Promise<void>> {
  const log = options.log ?? ((line: string) => process.stdout.write(`${LOG_PREFIX} ${line}\n`));
  const resolveDefinition = options.resolveDefinition ?? conventionResolver();
  const startedAt = new Date((options.now ?? Date.now)()).toISOString();

  const run = await TestRun.start({ ...options, resolveDefinition });
  try {
    await verifyAppRole(run.appCredentials);
    log(
      `PostgreSQL ${run.server.version} on ${run.server.address}:${run.server.port}; ` +
        `helper role ${OWNER_ROLE}, code under test ${APP_ROLE}; run prefix ${run.identity.prefix}`,
    );

    const sweep = await run.sweepStale();
    log(
      `stale sweep: dropped ${sweep.dropped.length}; kept ${sweep.keptYounger.length} of younger runs, ` +
        `${sweep.keptLive.length} of live runs, ${sweep.unrecognised.length} unrecognised; ${sweep.failed.length} failed`,
    );
    for (const name of sweep.dropped) log(`  swept ${name}`);
    for (const failure of sweep.failed) log(`  not swept ${failure.name}: ${failure.reason}`);

    const templates: string[] = [];
    for (const key of EAGER_TEMPLATES) {
      if ((await resolveDefinition(key)) === null) {
        const { file, row } = TEMPLATE_HOOK_MODULES[key];
        log(`template tpl_${key}: not built, no hook is plugged in (row ${row}: ${file})`);
        break;
      }
      await run.ensureTemplate(key, 'create-only');
      templates.push(key);
    }
    for (const timing of run.templateTimings) {
      log(`template ${timing.database}: built in ${ms(timing.totalMs)} (create ${ms(timing.createMs)}, hook ${ms(timing.hookMs)})`);
    }

    project.provide(PROVIDE_KEY, {
      label: run.identity.label,
      stamp: run.identity.stamp,
      prefix: run.identity.prefix,
      startedAt,
      serverVersion: run.server.version,
      templates,
    });
  } catch (error) {
    // Vitest calls no teardown when the setup throws: leave nothing behind.
    await run.teardown().catch(() => undefined);
    throw error;
  }

  return async function teardownDbTestProject(): Promise<void> {
    const report = await run.teardown();
    log(retriedDropsLine(report.retriedDrops));
    log(
      `teardown: dropped ${report.dropped.length} database(s) in ${ms(report.ms)}; ` +
        `${report.remaining.length} remain with the run prefix ${run.identity.prefix}`,
    );
    if (report.remaining.length > 0) {
      const reasons = report.failed.map((failure) => `${failure.name}: ${failure.reason}`).join(' | ');
      throw new DbTestHelperError(
        'CLEANUP_INCOMPLETE',
        `test:db left ${report.remaining.length} database(s) behind: ${report.remaining.join(', ')}. ${reasons} ` +
          'The stale sweep of a later run removes them after six hours.',
      );
    }
  };
}
