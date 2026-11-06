// Static guard support: the scanner of the guard tests must not read git-ignored scratch folders
// (finding W3-3, decision D142).
//
// A test-runner output file written to `apps/core-server/.cache/` was read by the scanner, and
// its single minified line carried the names of other rows' tests, so two guards turned red on
// words that no program of the server contains. `.cache/` is git-ignored (`.gitignore`), and
// the scanner must treat it like the other folders it never reads.
//
// The tree is built under the operating system's temporary directory, never inside the
// repository. The text a guard looks for is built from fragments, so that this file does not
// contain it.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { literal, occurrences, readTree } from './scan';

/** Stands for a forbidden statement: never written out whole in this file. */
const FORBIDDEN = ['DROP', 'DATABASE'].join(' ');
const PLANTED = `${FORBIDDEN} the_other_rows_database;\n`;
const CLEAN = 'export const nothing = 1;\n';

let root = '';

function put(relativePath: string, text: string): void {
  const file = join(root, relativePath);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, text);
}

beforeAll(() => {
  root = mkdtempSync(join(tmpdir(), 'dems-scan-skips-'));
  put('src/normal.ts', CLEAN);
  put('src/planted.ts', PLANTED); // control: in a folder that is read
  put('.cache/x.ts', PLANTED);
  put('.cache/report.json', `{"name":"${FORBIDDEN}"}\n`);
  put('src/nested/.cache/y.ts', PLANTED);
  put('.cache/deep/z.sql', PLANTED);
});

afterAll(() => {
  if (root !== '') rmSync(root, { recursive: true, force: true });
});

describe('the scanner does not read a .cache folder (W3-3)', () => {
  it('builds its tree outside the repository', () => {
    expect(root.startsWith(tmpdir())).toBe(true);
    expect(root).not.toContain('apps/core-server');
  });

  it('lists the files of the folders it reads (positive control)', () => {
    const paths = readTree(root).map((file) => file.path);
    expect(paths).toContain('src/normal.ts');
    expect(paths).toContain('src/planted.ts');
  });

  it('reads no file inside a .cache folder, at the top or nested', () => {
    const paths = readTree(root).map((file) => file.path);
    expect(paths.filter((path) => path.split('/').includes('.cache'))).toEqual([]);
  });

  it('reports the planted text in the folder that is read, and not in .cache', () => {
    const found = occurrences(readTree(root), literal(FORBIDDEN));
    expect(found).toEqual(['src/planted.ts:1']);
  });
});
