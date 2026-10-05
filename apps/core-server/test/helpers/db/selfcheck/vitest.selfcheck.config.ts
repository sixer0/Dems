import { defineConfig } from 'vitest/config';

/**
 * Not part of `npm test` or `npm run test:db`. `__tests__/nested-run.db.test.ts` starts Vitest
 * with this configuration as a child process, to show from the outside what a whole run does:
 *
 *   throwing     test files that throw, under the real global setup (`test/global-setup.db.ts`):
 *                the run fails, and no database of it remains;
 *   unreachable  a global setup pointed at a closed loopback port: the run fails with the
 *                message that says how to start PostgreSQL, and its test never runs;
 *   convention   hook modules at the conventional places of a fixture workspace: the global
 *                setup and a test file's worker find and load them (the plug-in points).
 *
 * The files end in `.selfcheck.ts`, so neither project of `vitest.config.ts` picks them up.
 * Paths are relative to the workspace (`apps/core-server`), which the caller passes as `--root`.
 */
export default defineConfig({
  test: {
    maxWorkers: 1,
    projects: [
      {
        extends: true,
        test: {
          name: 'throwing',
          environment: 'node',
          include: ['test/helpers/db/selfcheck/throwing-*.selfcheck.ts'],
          globalSetup: ['./test/global-setup.db.ts'],
        },
      },
      {
        extends: true,
        test: {
          name: 'convention',
          environment: 'node',
          include: ['test/helpers/db/selfcheck/convention.selfcheck.ts'],
          globalSetup: ['./test/helpers/db/selfcheck/global-setup.convention.ts'],
        },
      },
      {
        extends: true,
        test: {
          name: 'unreachable',
          environment: 'node',
          include: ['test/helpers/db/selfcheck/never-runs.selfcheck.ts'],
          globalSetup: ['./test/helpers/db/selfcheck/global-setup.unreachable.ts'],
        },
      },
    ],
  },
});
