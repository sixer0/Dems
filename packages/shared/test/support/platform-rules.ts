// The static rules that several platform-neutral units of the shared package hold in the same
// words (AC-C-02, erasable syntax) and the one rule for "the scan read the folder" (R1). One table:
// the test file of each unit applies the rule to ITS files and keeps its own positive control, so a
// planted name turns red the unit it was planted in and no other.
import { readdirSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { expect } from 'vitest';

/** AC-C-02: what no platform-neutral unit may name, comments included. */
export const AC_C_02_NAMED = /node:|react-native|\bexpo\b|\bwindow\b|\bdocument\b/;

/**
 * Erasable syntax only: what a transform that strips types cannot take. Applied to code without
 * comments, one pattern per construct, so a failure names the construct.
 */
export const ERASABLE_SYNTAX_RULES: readonly (readonly [construct: string, pattern: RegExp])[] = [
  ['enum', /^\s*(export\s+)?(declare\s+)?(const\s+)?enum\s/m],
  ['namespace', /^\s*(export\s+)?namespace\s/m],
  ['parameter property', /constructor\s*\([^)]*\b(public|private|protected|readonly)\b/],
];

const SOURCE_FILE = /\.(ts|tsx|mts|cts|js|jsx|mjs|cjs)$/;

/**
 * Rule R1 - a scan read its folder: it is not empty, it holds the unit's entry, it names every
 * source file an INDEPENDENT listing of the folder finds (so a filter bug that narrows the scan is
 * red), and it names nothing that listing does not hold. A new file of the unit passes: which
 * files the unit has is not this rule's business, what the scan missed is.
 *
 * @param dir     the folder of the unit
 * @param scanned the scan's files, relative to `dir` with `/` between the parts
 */
export function expectScanCovers(dir: string, scanned: readonly string[], entry = 'index.ts'): void {
  const listed = readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((item) => item.isFile())
    .map((item) => relative(dir, join(item.parentPath, item.name)).split(sep).join('/'))
    .filter((name) => !name.split('/').some((part) => part === 'node_modules' || part.startsWith('.')));
  const sources = listed.filter((name) => SOURCE_FILE.test(name)).sort();
  expect(sources.length, 'the independent listing found no source file').toBeGreaterThan(0);
  expect(scanned, 'the entry of the unit').toContain(entry);
  expect(sources.filter((name) => !scanned.includes(name)), 'source files the scan did not read').toEqual([]);
  expect(scanned.filter((name) => !listed.includes(name)), 'scanned names the folder does not hold').toEqual([]);
}
