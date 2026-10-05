/**
 * The hook of the template `tpl_schema` (plan row W17; database contract §10.1; test helper W11).
 *
 * The global setup of `test:db` creates an empty database (`template0`, `UTF8`, locale `C`) as
 * `dems_owner`, calls this hook with a pool of that role on it, then locks the database as a
 * template. The hook applies ALL migrations through the same function `db:migrate` uses, so a
 * test database is built exactly as `dems_demo` is: the 30 tables, the 5 functions, the 3
 * triggers (each ENABLE ALWAYS), every privilege, the genesis row of the chain head and the row
 * of `schema_meta`. No dataset row.
 *
 * Rules of a hook (`test/helpers/db/hooks.ts`): only the type is imported from the helper,
 * nothing of Vitest is imported at run time, only `context.pool` is used, and nothing is left
 * open.
 */
import { applyMigrations } from '../../src/db/commands/migrations';
import type { TemplateHook } from '../helpers/db/hooks';

export const templateHook: TemplateHook = async ({ pool }) => {
  await applyMigrations(pool);
};
