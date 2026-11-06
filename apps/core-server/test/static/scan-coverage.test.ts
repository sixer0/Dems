// Rule R1 of the static guards: a scan reads its folder (test-suite consolidation, test/14;
// decisions D233, D238).
//
// The per-folder guards used to pin the list of files they read. The list turned red on every new
// file (test/13 section 4.2) and could not say more than "the list changed". `scanCoverage`
// replaces it: what a guard scanned equals an INDEPENDENT walk of the folder, and the walk is not
// empty. This file proves the rule itself, on a tree under the operating system's temporary
// directory (never inside the repository):
//
//   - a scan that reads the whole folder is covered, and stays covered when a file is ADDED;
//   - a scan that lost a file (a filter that skips it) is named with the file;
//   - a scan that reads a file of another folder, or a test, is named with the file;
//   - an empty folder, or a folder that does not exist, is `empty` - never a pass;
//   - the walk does not use the scanner: a folder the scanner skips by name is still walked.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { SCAN_COVERS, WORKSPACE, isProductionSource, readTree, scanCoverage } from './scan';

let root = '';

function put(relativePath: string, text = 'export const nothing = 1;\n'): void {
  const file = join(root, relativePath);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, text);
}

/** What a guard does: the scanner's tree, narrowed to the production files of one folder. */
const scanOf = (folder: string): string[] =>
  readTree(root)
    .filter((file) => isProductionSource(file.path) && file.path.startsWith(folder))
    .map((file) => file.path);

beforeAll(() => {
  root = mkdtempSync(join(tmpdir(), 'dems-scan-coverage-'));
  put('src/unit/index.ts');
  put('src/unit/rule.ts');
  put('src/unit/deep/inner.ts');
  put('src/unit/__tests__/rule.test.ts');
  put('src/unit/__tests__/support.ts');
  put('src/unit/rule.test.ts');
  put('src/unit/statement.sql', 'select 1;\n');
  put('src/unit/notes.md', 'not a source\n');
  put('src/other/index.ts');
  mkdirSync(join(root, 'src/hollow'), { recursive: true });
});

afterAll(() => {
  if (root !== '') rmSync(root, { recursive: true, force: true });
});

describe('rule R1: a scan reads its folder (scanCoverage)', () => {
  it('builds its tree outside the repository', () => {
    expect(root.startsWith(tmpdir())).toBe(true);
    expect(root).not.toContain('apps/core-server');
  });

  it('a scan of the whole folder is covered: every production file, sub-folders included, and no test', () => {
    // The scanner reads every text file; a guard narrows it to the endings its rules are about.
    expect(scanOf('src/unit/')).toEqual(['src/unit/deep/inner.ts', 'src/unit/index.ts', 'src/unit/notes.md', 'src/unit/rule.ts', 'src/unit/statement.sql']);
    expect(scanCoverage(scanOf('src/unit/').filter((path) => path.endsWith('.ts')), ['src/unit/'], root)).toEqual(SCAN_COVERS);
    expect(scanCoverage(scanOf('src/unit/'), [{ folder: 'src/unit', extensions: ['.ts', '.sql', '.md'] }], root)).toEqual(SCAN_COVERS);
    expect(scanCoverage(scanOf('src/unit/'), [{ folder: 'src/unit', extensions: ['.ts', '.sql'] }], root)).toEqual({ missing: [], unexpected: ['src/unit/notes.md'], empty: false });
  });

  it('a file that JOINS the folder is covered at once: no list to move', () => {
    put('src/unit/joined.ts');
    try {
      expect(scanCoverage(scanOf('src/unit/').filter((path) => path.endsWith('.ts')), ['src/unit/'], root)).toEqual(SCAN_COVERS);
    } finally {
      rmSync(join(root, 'src/unit/joined.ts'));
    }
  });

  it('a scan that lost a file is named with the file (the filter bug the old lists were for)', () => {
    const narrowed = scanOf('src/unit/').filter((path) => path.endsWith('.ts') && !path.endsWith('rule.ts'));
    expect(scanCoverage(narrowed, ['src/unit/'], root)).toEqual({ missing: ['src/unit/rule.ts'], unexpected: [], empty: false });
    const shallow = scanOf('src/unit/').filter((path) => path.endsWith('.ts') && !path.includes('/deep/'));
    expect(scanCoverage(shallow, ['src/unit/'], root)).toEqual({ missing: ['src/unit/deep/inner.ts'], unexpected: [], empty: false });
  });

  it('a scan that reads a file of another folder, or a test, is named with the file', () => {
    const wide = [...scanOf('src/unit/').filter((path) => path.endsWith('.ts')), 'src/other/index.ts', 'src/unit/__tests__/support.ts', 'src/unit/rule.test.ts'];
    expect(scanCoverage(wide, ['src/unit/'], root)).toEqual({ missing: [], unexpected: ['src/other/index.ts', 'src/unit/__tests__/support.ts', 'src/unit/rule.test.ts'], empty: false });
  });

  it('an empty folder and a folder that does not exist are EMPTY, never a pass', () => {
    expect(scanCoverage([], ['src/hollow/'], root)).toEqual({ missing: [], unexpected: [], empty: true });
    expect(scanCoverage([], ['src/nowhere/'], root)).toEqual({ missing: [], unexpected: [], empty: true });
    expect(scanCoverage([], ['src/unit/'], root).empty).toBe(false);
    expect(scanCoverage([], ['src/unit/'], root).missing).toHaveLength(3);
  });

  it('the options: the folder itself only, and a sub-folder or a file that belongs to another scan', () => {
    expect(scanCoverage(['src/unit/index.ts', 'src/unit/rule.ts'], [{ folder: 'src/unit/', recursive: false }], root)).toEqual(SCAN_COVERS);
    expect(scanCoverage(['src/unit/index.ts', 'src/unit/rule.ts'], [{ folder: 'src/unit/', without: ['src/unit/deep/'] }], root)).toEqual(SCAN_COVERS);
    expect(scanCoverage(['src/unit/index.ts', 'src/unit/deep/inner.ts'], [{ folder: 'src/unit/', without: ['src/unit/rule.ts'] }], root)).toEqual(SCAN_COVERS);
    expect(scanCoverage(['src/unit/index.ts', 'src/unit/rule.ts', 'src/unit/deep/inner.ts', 'src/other/index.ts'], ['src/unit/', 'src/other/'], root)).toEqual(SCAN_COVERS);
  });

  it('the walk is independent of the scanner: a folder the scanner skips by name is still walked, and reported', () => {
    put('src/unit/build/generated.ts');
    try {
      const scanned = scanOf('src/unit/').filter((path) => path.endsWith('.ts'));
      expect(scanned).not.toContain('src/unit/build/generated.ts');
      expect(scanCoverage(scanned, ['src/unit/'], root).missing).toEqual(['src/unit/build/generated.ts']);
    } finally {
      rmSync(join(root, 'src/unit/build'), { recursive: true, force: true });
    }
  });

  it('on the real tree: the production TypeScript of the server, as the scanner reads it, is what the walk finds', () => {
    const production = readTree(WORKSPACE).filter((file) => isProductionSource(file.path) && file.path.endsWith('.ts'));
    expect(scanCoverage(production, ['src/'])).toEqual(SCAN_COVERS);
    expect(production.length).toBeGreaterThan(300);
  });
});
