// Static guards of the store folder (`src/db/store`; review finding CPB1-11; decisions D62 DN-10,
// D77 DN-13). Database-free, so they run in every later row's gate.
//
// The store was a file of the seed folder until fix round B1 and was read there by the static
// test of the mapping row (`src/db/mapping/__tests__/static.test.ts`). These are the rules of
// that test that applied to it, kept for its new folder, and the rule the move was made for:
//
//   - one direction: `db/schema` <- `db/mapping` <- `db/store` <- seed, reset, fixtures, engine.
//     The store imports the mapping, the schema and the query builder, and nothing of its
//     callers; the mapping imports nothing of the store; each caller imports the store through
//     its index;
//   - the old path `src/db/seed/store.ts` is gone (fix round B2b item 9): nothing imports it;
//   - the store prints nothing, names no value of the shared dataset, and the values of the demo
//     password and of the demo pairing code occur in no file of the folder (the two constants
//     are read into variables here, and only counts are reported).
import { DEMO_OPERATOR_PASSWORD, DEMO_PAIRING_CODE, EVIDENCE_HISTORY, OPERATORS, RECORDING_SCENARIO, TODAY_HISTORY } from '@dems/shared/sim';
import { describe, expect, it } from 'vitest';
import { relativeImports } from '../../../../test/static/imports';
import { SCAN_COVERS, WORKSPACE, codeOnly, isProductionSource, isTestFile, occurrences, readTree, scanCoverage, type SourceFile } from '../../../../test/static/scan';

const tree = readTree(WORKSPACE);
const folder = tree.filter((file) => file.path.startsWith('src/db/store/'));
const own = codeOnly(folder.filter((file) => isProductionSource(file.path)));
const production = codeOnly(tree.filter((file) => isProductionSource(file.path) && file.path.endsWith('.ts')));

/** The import specifiers of a set of sources: relative ones resolved to a workspace path, packages as written. */
function importsOf(files: readonly SourceFile[]): string[] {
  const relative = relativeImports(files).map((entry) => entry.target);
  const packages = files.flatMap((file) => [...file.text.matchAll(/\bfrom\s*'([^'.][^']*)'/g)].map((match) => match[1] ?? ''));
  return [...new Set([...relative, ...packages])].sort();
}

describe('the scan itself', () => {
  it('reads the production sources and the tests of the folder', () => {
    // Rule R1 (test/static/scan.ts): the scan equals an independent walk of the folder and is not empty.
    expect(scanCoverage(own, ['src/db/store/'])).toEqual(SCAN_COVERS);
    // The tests of the folder are read too (the rule about the two demo values below holds for them): this file is one of them.
    expect(folder.filter((file) => isTestFile(file.path)).map((file) => file.path)).toContain('src/db/store/__tests__/static.test.ts');
  });

  it('finds an import of a caller and a statement when they are there (positive control)', () => {
    const planted: SourceFile[] = [
      { path: 'src/db/store/store.ts', text: "import { seedDatabase } from '../seed';\nimport { host } from '../../engine';\nimport { Pool } from 'pg';\nconsole.log('x');" },
    ];
    expect(importsOf(planted)).toEqual(['pg', 'src/db/seed', 'src/engine']);
    expect(occurrences(planted, /\bconsole\s*\./g)).toEqual(['src/db/store/store.ts:4']);
  });
});

describe('CPB1-11: one direction, schema <- mapping <- store <- seed, reset, fixtures, engine', () => {
  it('the store imports the mapping, the schema and the query builder, and nothing of a caller', () => {
    expect(importsOf(own)).toEqual(['drizzle-orm', 'drizzle-orm/node-postgres', 'drizzle-orm/pg-core', 'src/db/mapping', 'src/db/schema', 'src/db/store/store']);
  });

  it('the mapping and the schema import nothing of the store', () => {
    const below = production.filter((file) => file.path.startsWith('src/db/mapping/') || file.path.startsWith('src/db/schema/'));
    expect(below.length).toBeGreaterThan(15);
    expect(importsOf(below).filter((target) => target.startsWith('src/db/store') || target.startsWith('src/db/seed'))).toEqual([]);
  });

  it('the seed, the reset routine, the bulk fixture and the engine import the store through its index', () => {
    const importers = relativeImports(production)
      .filter((entry) => entry.target === 'src/db/store' && !entry.file.startsWith('src/db/store/'))
      .map((entry) => entry.file);
    expect([...new Set(importers)].sort()).toEqual([
      'src/db/fixtures/load.ts',
      'src/db/reset/routine.ts',
      // REVISED 2026-10-30 (principal): the factory seed writes through the store's index too, like
      // the demonstration seed — one direction, nothing reaching past the index.
      'src/db/seed/factory.ts',
      'src/db/seed/seed.ts',
      'src/engine/rehydrate.ts',
      'src/engine/write-plan.ts',
    ]);
    // Nothing reaches past the index, and no production source uses the old path any more.
    const past = relativeImports(production).filter((entry) => entry.target.startsWith('src/db/store/') && !entry.file.startsWith('src/db/store/'));
    expect(past.map((entry) => `${entry.file}:${entry.line}`)).toEqual([]);
    const old = relativeImports(production).filter((entry) => entry.target === 'src/db/seed/store');
    expect(old.map((entry) => `${entry.file}:${entry.line}`)).toEqual([]);
  });
});

describe('the store prints nothing and copies no value of the shared dataset', () => {
  it('no console call, no rendered hash or salt', () => {
    expect(occurrences(own, /\bconsole\s*\./g)).toEqual([]);
    expect(occurrences(own, /\.toString\(\s*'(?:hex|base64)'\s*\)/g)).toEqual([]);
  });

  it('the demo password and the demo pairing code occur as VALUES in no file of the folder, tests and comments included (counts only)', () => {
    const password: string = DEMO_OPERATOR_PASSWORD;
    const code: string = DEMO_PAIRING_CODE;
    expect(password.length).toBeGreaterThanOrEqual(8);
    expect(code).toMatch(/^[0-9]{6}$/);
    const holders = folder.filter((file) => file.text.includes(password) || file.text.includes(code)).map((file) => file.path);
    expect(holders).toEqual([]);
    // Neither constant is named by a production file of the folder: the store hashes nothing.
    expect(own.filter((file) => /\bDEMO_OPERATOR_PASSWORD\b|\bDEMO_PAIRING_CODE\b/.test(file.text)).map((file) => file.path)).toEqual([]);
  });

  it('no operator name, username or subject name of the shared dataset, and no e-mail address, is written in a production file', () => {
    const names = [
      ...OPERATORS.flatMap((operator) => [operator.name, operator.username]),
      ...EVIDENCE_HISTORY.map((entry) => entry.subjectName),
      ...TODAY_HISTORY.map((entry) => entry.subjectName),
      RECORDING_SCENARIO.subjectName,
    ];
    expect(new Set(names).size).toBeGreaterThanOrEqual(19);
    const raw = folder.filter((file) => isProductionSource(file.path));
    expect(raw.flatMap((file) => names.filter((name) => file.text.includes(name)).map((name) => `${file.path}: ${name}`))).toEqual([]);
    expect(occurrences(raw, /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+\.[A-Za-z]{2,}/g)).toEqual([]);
  });
});
