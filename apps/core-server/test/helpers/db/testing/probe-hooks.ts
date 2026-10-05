/**
 * The injected one-table migration of the helper's own tests (plan row W11: "tested with an
 * injected one-table migration"). The real schema, seed and bulk fixture are plugged in by
 * their rows through hook modules (`../hooks.ts`); these three stand in for them, so that the
 * helper's tests do not depend on what those rows build.
 *
 * The table mirrors what the contract's test idea T-TI-1 uses: a row keyed by a token hash.
 */
import { APP_ROLE } from '../constants';
import type { TemplateDefinition, TemplateHook } from '../hooks';

export const PROBE_TABLE = 'helper_probe';
/** Rows the bulk stand-in adds on top of the seed row. */
export const PROBE_BULK_ROWS = 500;

/** The "migration": one table, and the privileges of the runtime role on it. */
export const probeSchemaHook: TemplateHook = async ({ pool }) => {
  await pool.query(
    `CREATE TABLE ${PROBE_TABLE} (` +
      'token_hash text PRIMARY KEY, ' +
      'origin text NOT NULL, ' +
      'written_by text NOT NULL DEFAULT current_user)',
  );
  // Table privileges are stored in the database, so every clone carries them (OW-7, PG-10).
  await pool.query(`GRANT SELECT, INSERT ON ${PROBE_TABLE} TO ${APP_ROLE}`);
};

/** The "seed": one row. */
export const probeSeedHook: TemplateHook = async ({ pool }) => {
  await pool.query(`INSERT INTO ${PROBE_TABLE} (token_hash, origin) VALUES ($1, $2)`, ['seed-row', 'tpl_seed']);
};

/** The "bulk fixture": many rows. */
export const probeBulkHook: TemplateHook = async ({ pool }) => {
  await pool.query(
    `INSERT INTO ${PROBE_TABLE} (token_hash, origin) SELECT 'bulk-' || n, 'tpl_bulk' FROM generate_series(1, $1::int) AS n`,
    [PROBE_BULK_ROWS],
  );
};

/** The three standard templates built from the stand-ins. */
export const PROBE_HOOKS = Object.freeze({ schema: probeSchemaHook, seed: probeSeedHook, bulk: probeBulkHook });

/**
 * The helper's private template: built from the empty template with the one-table migration, at
 * the first request of a test file. The two isolation test files clone it, so they pass
 * whatever the standard templates contain.
 */
export const SELFTEST_TEMPLATE: TemplateDefinition = Object.freeze({
  key: 'x_selftest',
  base: 'empty',
  build: probeSchemaHook,
});
