import { defineConfig } from 'vitest/config';

/**
 * Test layout of `@dems/core-server` (masterplan/02_plan.md §3.4, §11.1):
 *
 *   unit  every `*.test.ts` that is not a database test. Needs no database and no running
 *         server, so the root gate (`npm test`) stays database-free (GR-1, AC-B-58).
 *   db    `*.db.test.ts` and everything under `test/acceptance/`. Runs only through
 *         `npm run test:db` (GR-2); its global setup attaches to or starts the project-local
 *         PostgreSQL and fails, never skips, when it cannot be reached (TI-1).
 *
 * The `test` script selects `--project unit`, `test:db` selects `--project db`, and `coverage`
 * runs both. Two workers at most, however the command is called (P9, TI-14).
 */
const DB_TEST_FILES = [
  'src/**/*.db.test.ts',
  'test/**/*.db.test.ts',
  'test/acceptance/**/*.test.ts',
];

export default defineConfig({
  test: {
    maxWorkers: 2,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/**/__tests__/**', 'src/db/migrations/**'],
      reporter: ['text', 'json-summary'],
      reportsDirectory: 'coverage',
    },
    projects: [
      {
        extends: true,
        test: {
          name: 'unit',
          environment: 'node',
          include: ['src/**/*.test.ts', 'test/**/*.test.ts'],
          exclude: [...DB_TEST_FILES, '**/node_modules/**'],
        },
      },
      {
        extends: true,
        test: {
          name: 'db',
          environment: 'node',
          include: DB_TEST_FILES,
          exclude: ['**/node_modules/**'],
          // Owned by the template-clone helper row (W11); it does not exist before that row.
          globalSetup: ['./test/global-setup.db.ts'],
        },
      },
    ],
  },
});
