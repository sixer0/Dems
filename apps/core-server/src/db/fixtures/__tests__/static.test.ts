// Static guards of plan row W25, over the folder the row owns (`src/db/fixtures`). Database-free,
// so they run in every later row's gate.
//
//   - determinism: no production file reads a clock or the system's random source, and no faker
//     library is imported; every number comes from the seeded generator of `rng.ts`;
//   - the pure part (everything but the loader) imports no database driver and sends no statement;
//   - the loader is a library: no command-line entry, no process arguments, no environment;
//   - the template hook imports the helper for its type only and nothing of Vitest;
//   - the fixture names no project database as a target: the only mention is the guard that
//     refuses them.
// Every forbidden text is built from fragments, so that this file does not find itself.
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { codeOnly, isTestFile, occurrences, type SourceFile } from '../../../../test/static/scan';

const FOLDER = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function readFolder(directory: string, out: SourceFile[] = []): SourceFile[] {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const full = join(directory, entry.name);
    if (entry.isDirectory()) readFolder(full, out);
    else if (entry.name.endsWith('.ts')) out.push({ path: relative(FOLDER, full).split(sep).join('/'), text: readFileSync(full, 'utf8') });
  }
  return out.sort((a, b) => a.path.localeCompare(b.path));
}

const all = readFolder(FOLDER);
const production = codeOnly(all.filter((file) => !isTestFile(`src/db/fixtures/${file.path}`)));
const pure = production.filter((file) => file.path !== 'load.ts');

const CLOCK = new RegExp(`\\b(?:${['Date', 'now'].join('\\s*\\.\\s*')}\\s*\\(|new\\s+Date\\s*\\(\\s*\\)|${['performance', 'timeOrigin'].join('\\.')})`, 'g');
const RANDOM = new RegExp(`\\b(?:${['Math', 'random'].join('\\s*\\.\\s*')}|${['random', 'Bytes'].join('')}|${['random', 'UUID'].join('')}|${['random', 'Int'].join('')}|${['get', 'RandomValues'].join('')}|${['gen', 'random', 'uuid'].join('_')})\\b`, 'g');
const FAKER = new RegExp(`(?:from\\s+|import\\s*\\(\\s*|require\\s*\\(\\s*)['"][^'"]*(?:${['fa', 'ker'].join('')}|${['chan', 'ce'].join('')}|${['cas', 'ual'].join('')})[^'"]*['"]`, 'gi');
const DRIVER_IMPORT = /from\s+['"](?:pg|drizzle-orm[^'"]*|node:fs|node:net|node:child_process)['"]/g;
const STATEMENT = /\.\s*(?:query|execute|insert|transaction)\s*\(|\.\s*(?:update|delete)\s*\(\s*schema\b/g;
const PROCESS_STATE = new RegExp(`\\bprocess\\s*\\.\\s*(?:${['argv', 'env', 'exit', 'cwd'].join('|')})\\b`, 'g');
const VITEST_IMPORT = /from\s+['"]vitest[^'"]*['"]/g;

describe('the folder of the bulk fixture', () => {
  it('is read: the production files of the row, and its tests', () => {
    expect(production.map((file) => file.path)).toEqual([
      'build.ts',
      'identity.ts',
      'index.ts',
      'load.ts',
      'minimums.ts',
      'operations.ts',
      'pipeline.ts',
      'recordings.ts',
      'report.ts',
      'rng.ts',
      'rows.ts',
      'target.ts',
      'validate.ts',
      'world.ts',
    ]);
    expect(all.filter((file) => file.path.startsWith('__tests__/')).map((file) => file.path)).toEqual([
      '__tests__/audit-details.test.ts',
      '__tests__/audit-reference.ts',
      '__tests__/build.test.ts',
      '__tests__/bulk-fixture.db.test.ts',
      '__tests__/rng.test.ts',
      '__tests__/static.test.ts',
      '__tests__/support.ts',
      '__tests__/target.test.ts',
      '__tests__/template-hook.bulk.ts',
    ]);
  });

  it('finds each forbidden text when it is present (positive control)', () => {
    const planted: SourceFile[] = [
      { path: 'a.ts', text: `const t = ${['Date', 'now'].join('.')}();\nconst d = new Date();` },
      { path: 'b.ts', text: `const r = ${['Math', 'random'].join('.')}();\nimport { ${['random', 'Bytes'].join('')} } from 'node:crypto';` },
      { path: 'c.ts', text: `import { x } from '@${['fa', 'ker'].join('')}-js/${['fa', 'ker'].join('')}';` },
      { path: 'd.ts', text: "import { Pool } from 'pg';\nawait pool.query('SELECT 1');" },
      { path: 'e.ts', text: 'const a = process.argv[2];\nconst b = process.env.X;' },
    ];
    expect(occurrences(planted, CLOCK)).toEqual(['a.ts:1', 'a.ts:2']);
    expect(occurrences(planted, RANDOM)).toEqual(['b.ts:1', 'b.ts:2']);
    expect(occurrences(planted, FAKER)).toEqual(['c.ts:1']);
    expect(occurrences(planted, DRIVER_IMPORT)).toEqual(['d.ts:1']);
    expect(occurrences(planted, STATEMENT)).toEqual(['d.ts:2']);
    expect(occurrences(planted, PROCESS_STATE)).toEqual(['e.ts:1', 'e.ts:2']);
    // A date built from a number the caller gives is not a reading of the clock.
    expect(occurrences([{ path: 'x.ts', text: 'new Date(report.now).toISOString()' }], CLOCK)).toEqual([]);
  });
});

describe('determinism', () => {
  it('no production file reads a clock or a random source, and none imports a faker library', () => {
    expect(occurrences(production, CLOCK)).toEqual([]);
    expect(occurrences(production, RANDOM)).toEqual([]);
    expect(occurrences(codeOnly(all), FAKER)).toEqual([]);
  });

  it('the times of the loader come from the monotonic timer, which is not the wall clock', () => {
    const loader = production.find((file) => file.path === 'load.ts');
    expect(loader?.text).toMatch(/from 'node:perf_hooks'/);
    expect((loader?.text.match(/performance\.now\(\)/g) ?? []).length).toBeGreaterThanOrEqual(3);
    // It is used by the loader only, for the report's durations; no row holds a value of it.
    expect(occurrences(pure, /\bperformance\b/g)).toEqual([]);
  });

  it('every random draw goes through the seeded generator: only rng.ts names the shared generator', () => {
    expect(occurrences(production, /\b(?:createRng|deriveSeed|mulberry32|createRngStreams)\b/g, (path) => path !== 'rng.ts')).toEqual([]);
    expect(production.find((file) => file.path === 'rng.ts')?.text).toMatch(/createRng\(deriveSeed\(seed, /);
  });
});

describe('the pure part and the loader', () => {
  it('everything but the loader imports no database driver, no query builder, no file module, and sends no statement', () => {
    expect(occurrences(pure, DRIVER_IMPORT)).toEqual([]);
    expect(occurrences(pure, STATEMENT)).toEqual([]);
  });

  it('the loader is a library: no command-line entry, no process argument, no environment, no output of its own', () => {
    expect(occurrences(production, PROCESS_STATE)).toEqual([]);
    expect(occurrences(production, /\bisEntryPoint\b|\bimport\.meta\.url\b/g)).toEqual([]);
    expect(occurrences(production, new RegExp(`\\b${['con', 'sole'].join('')}\\s*\\.|\\bprocess\\s*\\.\\s*std(?:out|err)\\b`, 'g'))).toEqual([]);
  });

  it('the name guard runs before the first statement of the loader', () => {
    const loader = production.find((file) => file.path === 'load.ts')?.text ?? '';
    const body = loader.slice(loader.indexOf('export async function loadBulkFixture'));
    const guard = body.indexOf('assertBulkFixtureTarget(configuredDatabase(pool))');
    const firstAwait = body.indexOf('await ');
    expect(guard).toBeGreaterThan(0);
    expect(firstAwait).toBeGreaterThan(guard);
  });

  it('a project database is named by the guard only: where it is refused', () => {
    const named = occurrences(production, /\bdems_(?:demo|lane_[0-9])\b/g);
    expect(named.every((place) => place.startsWith('target.ts:'))).toBe(true);
    expect(occurrences(production, /PROJECT_DATABASES/g, (path) => path !== 'target.ts')).toEqual([]);
  });
});

describe('the template hook of tpl_bulk', () => {
  const hook = all.find((file) => file.path === '__tests__/template-hook.bulk.ts');

  it('imports the helper for its type only and nothing of Vitest, and loads through the guarded loader', () => {
    expect(hook).toBeDefined();
    const code = codeOnly(hook === undefined ? [] : [hook]);
    expect(occurrences(code, VITEST_IMPORT)).toEqual([]);
    expect(code[0]?.text).toMatch(/import type \{ TemplateHook \} from '\.\.\/\.\.\/\.\.\/\.\.\/test\/helpers\/db\/hooks';/);
    expect(occurrences(code, /from\s+['"][^'"]*test\/helpers\/db[^'"]*['"]/g)).toHaveLength(1);
    expect(code[0]?.text).toMatch(/export const templateHook: TemplateHook = async \(\{ pool \}\) =>/);
    expect(code[0]?.text).toMatch(/await loadBulkFixture\(pool, \{/);
    // It opens nothing of its own: only the pool the helper hands in.
    expect(occurrences(code, /new\s+(?:Pool|Client)\b|createOwnerPool|drizzle\(/g)).toEqual([]);
  });
});
