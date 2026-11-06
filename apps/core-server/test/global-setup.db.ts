/**
 * Global setup of the Vitest project `db` (`vitest.config.ts` names this path; decision D27).
 *
 * It runs once per `npm run test:db`, before the workers: it attaches to the project-local
 * PostgreSQL on 127.0.0.1:4432, FAILS (never skips) when it does not answer, sweeps stale test
 * databases, builds the templates and provides the run identity to the test files. The
 * function it returns drops every database of the run.
 *
 * Everything is in `test/helpers/db/` (plan row W11); how a row plugs its migrations, seed or
 * bulk fixture in is described in `test/helpers/db/hooks.ts`.
 */
import type { TestProject } from 'vitest/node';
import { setupDbTestProject } from './helpers/db/global-setup';

export default function setup(project: TestProject): Promise<() => Promise<void>> {
  return setupDbTestProject(project);
}
