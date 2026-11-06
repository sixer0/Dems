// The plug-in points of the test helper: how the rows that own the migrations, the seed and the
// bulk fixture plug theirs in without editing a file of the helper (plan row W11). The hook
// modules of this test live in a temporary workspace; no database is involved.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { STANDARD_TEMPLATES } from '../constants';
import { WORKSPACE_ROOT } from '../credentials';
import { DbTestHelperError } from '../errors';
import {
  TEMPLATE_BASES,
  TEMPLATE_HOOK_MODULES,
  conventionResolver,
  hookModulePath,
  injectedResolver,
  isStandardTemplate,
  pluggedTemplates,
  standardDefinitions,
  templateNotAvailable,
  type TemplateHook,
} from '../hooks';

const roots: string[] = [];

function workspace(files: Record<string, string> = {}): string {
  const root = mkdtempSync(join(tmpdir(), 'dems-w11-hooks-'));
  roots.push(root);
  for (const [file, text] of Object.entries(files)) {
    mkdirSync(dirname(join(root, file)), { recursive: true });
    writeFileSync(join(root, file), text);
  }
  return root;
}

async function refusal(action: () => Promise<unknown>): Promise<DbTestHelperError> {
  try {
    await action();
  } catch (error) {
    if (error instanceof DbTestHelperError) return error;
    throw error;
  }
  throw new Error('not refused');
}

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe('the convention: one hook module per standard template, in a folder its row owns', () => {
  it('pins the three paths and the rows that add them', () => {
    expect(STANDARD_TEMPLATES).toEqual(['schema', 'seed', 'bulk']);
    expect(TEMPLATE_HOOK_MODULES).toEqual({
      schema: { file: 'test/db/template-hook.schema.ts', row: 'W17' },
      seed: { file: 'src/db/seed/__tests__/template-hook.seed.ts', row: 'W20' },
      bulk: { file: 'src/db/fixtures/__tests__/template-hook.bulk.ts', row: 'W25' },
    });
    expect(TEMPLATE_BASES).toEqual({ schema: 'empty', seed: 'schema', bulk: 'seed' });
    expect(hookModulePath('schema')).toBe(join(WORKSPACE_ROOT, 'test/db/template-hook.schema.ts'));
    expect(WORKSPACE_ROOT.endsWith(join('apps', 'core-server'))).toBe(true);
    expect(isStandardTemplate('seed')).toBe(true);
    expect(isStandardTemplate('x_selftest')).toBe(false);
  });

  it('a workspace without hook modules has no template plugged in', async () => {
    const root = workspace();
    expect(pluggedTemplates(root)).toEqual([]);
    const resolve = conventionResolver(root);
    for (const key of STANDARD_TEMPLATES) expect(await resolve(key)).toBeNull();
    expect(await resolve('x_private')).toBeNull();
  });

  it('a hook module that exists is found and loaded when its template is asked for', async () => {
    const root = workspace({
      [TEMPLATE_HOOK_MODULES.schema.file]: [
        "import { tableName } from './names-of-the-row';",
        'export const templateHook = async (context) => {',
        '  await context.pool.query(`CREATE TABLE ${tableName} (id int)`);',
        '};',
        '',
      ].join('\n'),
      'test/db/names-of-the-row.ts': "export const tableName: string = 'from_the_hook_module';\n",
      [TEMPLATE_HOOK_MODULES.bulk.file]: 'export default async function bulk() {}\n',
    });
    expect(pluggedTemplates(root)).toEqual(['schema', 'bulk']);

    const resolve = conventionResolver(root);
    const schema = await resolve('schema');
    expect(schema).toMatchObject({ key: 'schema', base: 'empty' });
    // The loaded function is the one of the module: it runs its own statement on the pool it is given.
    const statements: string[] = [];
    const pool = { query: async (text: string) => void statements.push(text) };
    await schema?.build({ pool } as unknown as Parameters<TemplateHook>[0]);
    expect(statements).toEqual(['CREATE TABLE from_the_hook_module (id int)']);

    // A default export is accepted as well.
    expect(await resolve('bulk')).toMatchObject({ key: 'bulk', base: 'seed' });
    expect(typeof (await resolve('bulk'))?.build).toBe('function');
    expect(await resolve('seed')).toBeNull();
  });

  it('a hook module that exports no function, or cannot be loaded, is an error that names the file', async () => {
    const root = workspace({
      [TEMPLATE_HOOK_MODULES.schema.file]: 'export const somethingElse = 1;\n',
      [TEMPLATE_HOOK_MODULES.seed.file]: "throw new Error('broken on purpose (test)');\n",
    });
    const resolve = conventionResolver(root);
    const wrongExport = await refusal(() => resolve('schema'));
    expect(wrongExport.code).toBe('TEMPLATE_HOOK_INVALID');
    expect(wrongExport.message).toContain(TEMPLATE_HOOK_MODULES.schema.file);
    expect(wrongExport.message).toContain('"templateHook"');
    const broken = await refusal(() => resolve('seed'));
    expect(broken.code).toBe('TEMPLATE_HOOK_INVALID');
    expect(broken.message).toContain(TEMPLATE_HOOK_MODULES.seed.file);
    expect(broken.message).toContain('broken on purpose (test)');
  });

  it('nothing is imported until a template has to be built', async () => {
    const root = workspace({ [TEMPLATE_HOOK_MODULES.schema.file]: 'export const templateHook = async () => {};\n' });
    const imported: string[] = [];
    const resolve = conventionResolver(root, async (file) => {
      imported.push(file);
      return { templateHook: async () => undefined };
    });
    expect(pluggedTemplates(root)).toEqual(['schema']);
    expect(imported).toEqual([]);
    await resolve('seed');
    expect(imported).toEqual([]);
    await resolve('schema');
    expect(imported).toEqual([join(root, TEMPLATE_HOOK_MODULES.schema.file)]);
  });
});

describe('a template without a hook', () => {
  it('names the file to add and the row that adds it', () => {
    for (const key of STANDARD_TEMPLATES) {
      const error = templateNotAvailable(key);
      expect(error.code).toBe('TEMPLATE_NOT_AVAILABLE');
      expect(error.message).toContain(`tpl_${key}`);
      expect(error.message).toContain(TEMPLATE_HOOK_MODULES[key].file);
      expect(error.message).toContain(TEMPLATE_HOOK_MODULES[key].row);
      expect(error.message).toContain('"templateHook"');
    }
    expect(templateNotAvailable('x_private').message).toContain('pass its definition');
  });
});

describe('injected definitions (the helper\'s own tests, and private templates)', () => {
  const hook: TemplateHook = async () => undefined;

  it('builds the standard definitions from a subset of hooks', () => {
    expect(standardDefinitions({ schema: hook, seed: hook, bulk: hook })).toEqual([
      { key: 'schema', base: 'empty', build: hook },
      { key: 'seed', base: 'schema', build: hook },
      { key: 'bulk', base: 'seed', build: hook },
    ]);
    expect(standardDefinitions({ seed: hook })).toEqual([{ key: 'seed', base: 'schema', build: hook }]);
    expect(standardDefinitions({})).toEqual([]);
  });

  it('an injected definition wins; an unknown key falls through to the next resolver', async () => {
    const mine = { key: 'x_mine', base: 'empty', build: hook };
    const fallback = { key: 'schema', base: 'empty', build: hook };
    const resolve = injectedResolver([mine], async (key) => (key === 'schema' ? fallback : null));
    expect(await resolve('x_mine')).toBe(mine);
    expect(await resolve('schema')).toBe(fallback);
    expect(await resolve('seed')).toBeNull();
    expect(await injectedResolver([mine])('schema')).toBeNull();
  });
});
