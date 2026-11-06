/**
 * Test support of the core services (plan row W21; not a test file).
 *
 * What tests of several rows use (the readers of the stored trail, the recording error log, the
 * server's logger in memory, the stand-in for the runtime pool, `BOOT_CHECKS`, `passedAmong`,
 * `answersBootStepOne`) moved to the neutral folder `test/support/core.ts` in fix round B1
 * (review finding CPB1-12) and is RE-EXPORTED below, so that every existing import of this path
 * keeps working. Import `test/support/core` in new code.
 *
 * What stays here is private to the core's own database tests: the app builder `coreApp`, an app
 * built by the real factory on the file's own clone, connected as `dems_app`, on a manual clock.
 */
import { createManualClock } from '@dems/shared/sim';
import type { FastifyInstance } from 'fastify';
import { CLOCK_START, type ManualClock } from '../../../test/support/core';
import { captureLog, unitTestConfig, type CapturedLog } from '../../../test/support/config';
import { buildApp } from '../../app';
import type { DatabaseConnection, LogLevel } from '../../config';

export * from '../../../test/support/core';

export interface CoreApp {
  readonly app: FastifyInstance;
  /** The server clock of this app: it moves only when the test moves it (ENG-16). */
  readonly clock: ManualClock;
  readonly log: CapturedLog;
}

export interface CoreAppTarget {
  /** Role `dems_app` on the clone. */
  readonly runtime: DatabaseConnection;
  onCleanup(close: () => Promise<unknown> | unknown): void;
}

/**
 * The real app factory on a clone, as `dems_app`, ready, on a manual clock. It is closed before
 * the clone is dropped. `ready.engine` stays false: the engine host is a later row.
 */
export async function coreApp(target: CoreAppTarget, dataDir: string, logLevel: LogLevel = 'trace'): Promise<CoreApp> {
  const log = captureLog();
  const app = buildApp({
    config: unitTestConfig({ database: target.runtime, dataDir, logLevel }),
    logStream: log.stream,
  });
  target.onCleanup(() => app.close());
  await app.ready();
  const clock = createManualClock(CLOCK_START);
  app.seams.replace('clock', clock);
  return { app, clock, log };
}
