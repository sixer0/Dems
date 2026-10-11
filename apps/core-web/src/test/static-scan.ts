/**
 * The scan-coverage rule of the static blocks (suite consolidation, test/13 section 4.3, rule R1;
 * test/14). Not a test file (Vitest collects `*.test.*` only); no production file imports it.
 *
 * A "no file does X" rule is only as good as the scan it runs over: a scan that a filter bug
 * narrowed, or that read no file at all, passes every rule. The blocks used to guard that with a
 * LIST - "these named files are among the scanned ones, and there are at least N" - which holds
 * nothing about the files it does not name and goes red when a named file is renamed.
 *
 * The rule instead: THE SCAN EQUALS AN INDEPENDENT LISTING OF THE FOLDER, AND IS NOT EMPTY.
 * The independent listing is Vite's own (`import.meta.glob`, resolved when the test file is
 * transformed), not the test's directory walk: a walk that skips a file, a sub-folder or an
 * extension differs from it and the test names the difference. A new production file is scanned
 * and passes; a renamed one passes; a scan that lost a file fails.
 */
import { expect } from 'vitest'

export interface ScanCoverage {
  /** What the block scans: paths relative to `root`, `/` between the parts. */
  readonly scanned: readonly string[]
  /** `import.meta.glob('<root>/…')` of the calling test file (the pattern must be a literal there). Only the keys are read. */
  readonly listed: Readonly<Record<string, unknown>>
  /** The folder, as the glob pattern names it (for example `../features/dashboard`). */
  readonly root: string
  /** Which listed files the scan is meant to hold. Default: everything outside a `__tests__` folder that is no test file. */
  readonly production?: (name: string) => boolean
}

/** A file of the folder that is product code: not under `__tests__`, not a `*.test.*` file. */
export const isProductionSource = (name: string): boolean => !name.split('/').includes('__tests__') && !/\.test\.tsx?$/.test(name)

export function expectScanCovers({ scanned, listed, root, production = isProductionSource }: ScanCoverage): void {
  const independent = Object.keys(listed)
    .filter((key) => key.startsWith(`${root}/`))
    .map((key) => key.slice(root.length + 1))
    .filter(production)
    .sort()
  // Not empty: a listing that found nothing would make the equality below vacuous.
  expect(independent.length, `the independent listing of ${root} is empty`).toBeGreaterThan(0)
  expect([...scanned].sort(), `the scan of ${root} differs from the folder`).toEqual(independent)
}
