/**
 * The hook of the template `tpl_seed` (plan row W20; database contract §10.1; test helper W11).
 *
 * The global setup of `test:db` clones `tpl_schema` (all migrations applied, no dataset row),
 * calls this hook with a pool of `dems_owner` on the clone, then locks the clone as a template.
 * The hook runs the same seed `db:seed` runs, at the fixed instant the shared suites use
 * (2026-10-01 10:00 WIB; DR-5, ENG-20), scenario `idle`. A test database cloned from the
 * template therefore holds exactly what `dems_demo` holds after a seed at that instant: the
 * rows of contract §9.4, and an empty `audit_chain_history`.
 *
 * Rules of a hook (`test/helpers/db/hooks.ts`): only the type is imported from the helper,
 * nothing of Vitest is imported at run time, only `context.pool` is used, and nothing is left
 * open. The seed refuses any database whose name does not start with `dems_test_` (TI-13).
 */
import type { TemplateHook } from '../../../../test/helpers/db/hooks';
import { seedDatabase } from '../seed';

/** 2026-10-01 10:00:00 WIB: the instant the shared suites and the frozen examples use. */
export const SEED_TEMPLATE_NOW = Date.UTC(2026, 9, 1, 3, 0, 0);

export const templateHook: TemplateHook = async ({ pool }) => {
  await seedDatabase(pool, { now: SEED_TEMPLATE_NOW, scenario: 'idle', target: 'test' });
};
