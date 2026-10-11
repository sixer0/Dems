/**
 * Test-only rules for the static tests that read production sources as text (never import from app
 * code). One place for what several folders' static tests said in their own copies (test-suite
 * consolidation, decisions D233 and D238; audit `test/13_suite_consolidation_audit.md` section 4).
 *
 * `expectScanIsTheFolder` is rule R1 of the audit. A static test used to pin the list of the files
 * its scan read ("reads the folder: every production file"), so every new production file turned it
 * red without anything being wrong. What that pin protected is that the scan is not empty and not
 * narrowed by a filter bug; this states exactly that: the scan equals a second, independently
 * written walk of the folder, and holds at least one file.
 */
import { expect } from '@jest/globals';
import { readdirSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

/**
 * The production sources under `folder`, as paths relative to `base` with `/` separators, sorted.
 * Written apart from the scans it checks: one recursive listing by the platform, and a predicate on
 * path segments instead of the scans' regular expressions.
 */
export function productionSourcesOf(folder: string, base: string = folder): string[] {
  return readdirSync(folder, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => relative(base, join(entry.parentPath, entry.name)).split(sep))
    .filter((segments) => {
      const name = segments[segments.length - 1] ?? '';
      const source = name.endsWith('.ts') || name.endsWith('.tsx');
      const test = name.endsWith('.test.ts') || name.endsWith('.test.tsx');
      const harness = segments.slice(0, -1).some((segment) => segment === 'testing' || segment === '__tests__');
      return source && !test && !harness;
    })
    .map((segments) => segments.join('/'))
    .sort();
}

/**
 * Rule R1: what a static test scanned IS the production sources of its folder(s), and is not empty.
 *
 * @param scanned the names the test's own scan produced, relative to `base`
 * @param folders the folder, or the folders, the test means to read (absolute paths)
 * @param base what the names are relative to; default: the one folder itself
 */
export function expectScanIsTheFolder(scanned: readonly string[], folders: string | readonly string[], base?: string): void {
  const list = typeof folders === 'string' ? [folders] : folders;
  const root = base ?? list[0]!;
  const walked = list.flatMap((folder) => productionSourcesOf(folder, root)).sort();
  expect(walked.length).toBeGreaterThan(0);
  expect([...scanned].sort()).toEqual(walked);
  // No test file and no harness file is read as production.
  expect(scanned.filter((name) => /\.test\.tsx?$/.test(name) || /(?:^|\/)(?:testing|__tests__)\//.test(name))).toEqual([]);
}

/** The simulator's action hook, put together here so that no static test holds the name it looks for. */
export const SIM_ACTIONS_HOOK = ['use', 'Sim', 'Actions'].join('');

/**
 * AC-C-53, the hook half, for one scan: no production file names the simulator's action hook.
 * The first line is the control: the pattern finds the hook where it is called.
 *
 * @param matching the test's own "which scanned files match this pattern" function
 */
export function expectNoSimActionsHook(matching: (pattern: RegExp) => string[]): void {
  const hook = new RegExp(`\\b${SIM_ACTIONS_HOOK}\\b`);
  expect(hook.test(`const actions = ${SIM_ACTIONS_HOOK}();`)).toBe(true);
  expect(matching(hook)).toEqual([]);
}
