/**
 * Template hooks: the plug-in points of the test helper (plan row W11).
 *
 * The helper knows HOW a template is created, locked, cloned and dropped. It does not know WHAT
 * goes into one: that is a `TemplateHook`, a function that receives a pool of `dems_owner` on
 * the freshly created template database and fills it. The rows that own the migrations, the
 * seed and the bulk fixture plug theirs in by adding ONE FILE EACH, in a folder they own; no
 * file of the helper is edited.
 *
 *   template     built from            hook module (relative to apps/core-server)            row
 *   tpl_schema   the empty template    test/db/template-hook.schema.ts                       W17
 *   tpl_seed     a clone of tpl_schema src/db/seed/__tests__/template-hook.seed.ts           W20
 *   tpl_bulk     a clone of tpl_seed   src/db/fixtures/__tests__/template-hook.bulk.ts       W25
 *
 * A hook module exports the function as `templateHook` (or as its default export):
 *
 *   import type { TemplateHook } from '<...>/test/helpers/db/hooks';
 *   export const templateHook: TemplateHook = async ({ pool }) => {
 *     await migrate(drizzle(pool), { migrationsFolder });
 *   };
 *
 * Rules for a hook:
 *   - it runs as `dems_owner` and only on `context.database`, whose name starts with
 *     `dems_test_`;
 *   - it uses `context.pool`; if it opens anything else, it closes it before it returns. A
 *     template must have no session when it is locked (TI-5), and the helper fails the build
 *     if one is left;
 *   - it does not call the helper back (it may be running under the clone lock);
 *   - its module is loaded by the global setup in Vitest's MAIN process (schema, seed) or by a
 *     worker (bulk): it imports nothing of Vitest at run time, and from this folder only the
 *     type above (`hooks.ts` has no Vitest import; `index.ts` has).
 *
 * While a hook module does not exist, its template is "not available": a test file that asks
 * for it gets an error that names the missing file. `tpl_schema` and `tpl_seed` are built once
 * per run by the global setup; `tpl_bulk` is built at the first request of a test file, under
 * the clone lock (§10.1).
 */
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { Pool } from 'pg';
import type { DatabaseConnection } from '../../../src/config';
import { STANDARD_TEMPLATES, type StandardTemplate } from './constants';
import { WORKSPACE_ROOT } from './credentials';
import { DbTestHelperError, errorMessage } from './errors';
import type { RunIdentity } from './names';

export interface TemplateHookContext {
  /** `schema`, `seed`, `bulk` or `x_<name>`. */
  readonly template: string;
  /** The full name of the template database being built. */
  readonly database: string;
  /** A pool of `dems_owner` on that database. The helper closes it when the hook returns. */
  readonly pool: Pool;
  /**
   * The same connection as five discrete fields, for a program that opens its own connection.
   * The password is a `Secret`; whatever is opened with it must be closed before the hook returns.
   */
  readonly connection: DatabaseConnection;
  readonly run: RunIdentity;
}

export type TemplateHook = (context: TemplateHookContext) => Promise<void>;

/** A template: its key, what it is copied from, and the hook that fills it. */
export interface TemplateDefinition {
  /** `schema`, `seed`, `bulk`, or `x_<name>` for a private template. */
  readonly key: string;
  /** `empty` (the empty template of PostgreSQL) or the key of another template of the run. */
  readonly base: string;
  readonly build: TemplateHook;
}

/** Where each standard template's hook module lives, relative to `apps/core-server`. */
export const TEMPLATE_HOOK_MODULES: Readonly<Record<StandardTemplate, { readonly file: string; readonly row: string }>> =
  Object.freeze({
    schema: { file: 'test/db/template-hook.schema.ts', row: 'W17' },
    seed: { file: 'src/db/seed/__tests__/template-hook.seed.ts', row: 'W20' },
    bulk: { file: 'src/db/fixtures/__tests__/template-hook.bulk.ts', row: 'W25' },
  });

/** What each standard template is copied from (§10.1). */
export const TEMPLATE_BASES: Readonly<Record<StandardTemplate, 'empty' | StandardTemplate>> = Object.freeze({
  schema: 'empty',
  seed: 'schema',
  bulk: 'seed',
});

export function isStandardTemplate(key: string): key is StandardTemplate {
  return (STANDARD_TEMPLATES as readonly string[]).includes(key);
}

/** The absolute path of a standard template's hook module. */
export function hookModulePath(key: StandardTemplate, workspaceRoot: string = WORKSPACE_ROOT): string {
  return join(workspaceRoot, TEMPLATE_HOOK_MODULES[key].file);
}

/** The standard templates whose hook module exists. Reads the directory only; imports nothing. */
export function pluggedTemplates(workspaceRoot: string = WORKSPACE_ROOT): StandardTemplate[] {
  return STANDARD_TEMPLATES.filter((key) => existsSync(hookModulePath(key, workspaceRoot)));
}

/** Finds the definition of a template key, or `null` when none is plugged in. */
export type DefinitionResolver = (key: string) => Promise<TemplateDefinition | null>;

/** The error for a template nobody has plugged a hook in for. */
export function templateNotAvailable(key: string, workspaceRoot: string = WORKSPACE_ROOT): DbTestHelperError {
  if (isStandardTemplate(key)) {
    const { file, row } = TEMPLATE_HOOK_MODULES[key];
    return new DbTestHelperError(
      'TEMPLATE_NOT_AVAILABLE',
      `The template tpl_${key} is not available: no hook is plugged in. Row ${row} adds ` +
        `${join(workspaceRoot, file)}, which exports "templateHook" (see test/helpers/db/hooks.ts).`,
    );
  }
  return new DbTestHelperError(
    'TEMPLATE_NOT_AVAILABLE',
    `The template tpl_${key} is not known to this run: pass its definition (key, base, build) to the helper.`,
  );
}

/**
 * The resolver of the standard templates by convention: it imports a hook module the first time
 * its template has to be built. `importModule` is the seam for tests.
 */
export function conventionResolver(
  workspaceRoot: string = WORKSPACE_ROOT,
  importModule: (file: string) => Promise<unknown> = (file) => import(/* @vite-ignore */ pathToFileURL(file).href),
): DefinitionResolver {
  return async (key) => {
    if (!isStandardTemplate(key)) return null;
    const file = hookModulePath(key, workspaceRoot);
    if (!existsSync(file)) return null;
    let loaded: unknown;
    try {
      loaded = await importModule(file);
    } catch (error) {
      throw new DbTestHelperError('TEMPLATE_HOOK_INVALID', `The hook module ${file} could not be loaded: ${errorMessage(error)}`, {
        cause: error,
      });
    }
    const exports = (typeof loaded === 'object' && loaded !== null ? loaded : {}) as Record<string, unknown>;
    const hook = exports['templateHook'] ?? exports['default'];
    if (typeof hook !== 'function') {
      throw new DbTestHelperError(
        'TEMPLATE_HOOK_INVALID',
        `The hook module ${file} must export a function named "templateHook" (or a default export).`,
      );
    }
    return { key, base: TEMPLATE_BASES[key], build: hook as TemplateHook };
  };
}

/** A resolver over injected definitions; a key it does not hold falls through to `next`. */
export function injectedResolver(definitions: readonly TemplateDefinition[], next?: DefinitionResolver): DefinitionResolver {
  const byKey = new Map(definitions.map((definition) => [definition.key, definition] as const));
  return async (key) => byKey.get(key) ?? (next === undefined ? null : next(key));
}

/** Definitions of the three standard templates from three hooks (any subset). */
export function standardDefinitions(hooks: Partial<Record<StandardTemplate, TemplateHook>>): TemplateDefinition[] {
  const definitions: TemplateDefinition[] = [];
  for (const key of STANDARD_TEMPLATES) {
    const build = hooks[key];
    if (build !== undefined) definitions.push({ key, base: TEMPLATE_BASES[key], build });
  }
  return definitions;
}
