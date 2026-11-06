/**
 * The hook of the template `tpl_bulk` (plan row W25; database contract §10.1, §11; test helper W11).
 *
 * The first test file of a run that asks for `{ template: 'bulk' }` makes the helper clone
 * `tpl_seed` and call this hook with a pool of `dems_owner` on the clone; the helper then locks
 * the clone as a template. A run in which no file asks for it never builds it. The hook loads the
 * bulk fixture at the fixed instant the seed template uses (2026-10-01 10:00 WIB; DR-5), with the
 * fixed seed: a test database cloned from the template holds the seed and, on top of it, at least
 * the minimums of contract §11.
 *
 * THE CLONE LOCK IS HELD while this hook runs (§10.1): no test file of any run can clone anything
 * until it returns. It therefore does one thing, in one transaction, prints one short report, and
 * vacuums and analyzes the loaded tables with one statement.
 *
 * Rules of a hook (`test/helpers/db/hooks.ts`): only the type is imported from the helper, nothing
 * of Vitest is imported at run time, only `context.pool` is used, and nothing is left open. The
 * loader refuses any database whose name does not start with `dems_test_` (TI-13).
 *
 * A TEST THAT USES THE TEMPLATE sets its manual clock to `BULK_TEMPLATE_NOW` or later: nothing in
 * the template is dated after that instant.
 */
import type { TemplateHook } from '../../../../test/helpers/db/hooks';
import { loadBulkFixture, vacuumFixtureTables } from '../load';
import { BULK_FIXTURE_SEED } from '../rng';

/** 2026-10-01 10:00:00 WIB: the instant of the seed template, and the clock of the fixture. */
export const BULK_TEMPLATE_NOW = Date.UTC(2026, 9, 1, 3, 0, 0);
/** The seed of the template's fixture. */
export const BULK_TEMPLATE_SEED = BULK_FIXTURE_SEED;

export const templateHook: TemplateHook = async ({ pool }) => {
  await loadBulkFixture(pool, {
    now: BULK_TEMPLATE_NOW,
    seed: BULK_TEMPLATE_SEED,
    log: (line) => process.stdout.write(`[test:db] ${line}\n`),
  });
  // The template is locked when this returns: give its clones the statistics and the visibility map of the loaded tables.
  await vacuumFixtureTables(pool);
};
