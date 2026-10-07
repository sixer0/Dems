// Post-review fix pass FXR-S (review finding W91-9; F-B2b-1, F-B2b-2; decisions D113, D116, D139
// DN-2, D241 DN-W91-2). The test support that tests of several rows use lives in the neutral
// folder `test/support/` (CPB1-12). The old paths `src/core/__tests__/support.ts`,
// `src/engine/__tests__/support.ts` and `src/realtime/__tests__/support.ts` re-export it for
// their own folder's tests; a test of another folder imports `test/support/{core,engine,realtime}`
// instead, so no new importer makes the old paths harder to retire.
//
// The one exception is the realtime shim's own pin test (`support.db.test.ts`), which proves the
// re-export while the shim exists.
import { posix } from 'node:path';
import { describe, expect, it } from 'vitest';
import { relativeImports } from './imports';
import { WORKSPACE, codeOnly, readTree } from './scan';

/** The old support paths, without extension, from the workspace. */
const OLD_SUPPORT = ['src/core/__tests__/support', 'src/engine/__tests__/support', 'src/realtime/__tests__/support'] as const;

/** Imports of an old support path from a file outside its folder. */
function foreignImports(files: ReturnType<typeof readTree>): string[] {
  return relativeImports(codeOnly(files))
    .filter((entry) => (OLD_SUPPORT as readonly string[]).includes(entry.target))
    .filter((entry) => posix.dirname(entry.file) !== posix.dirname(entry.target))
    .map((entry) => `${entry.file}:${entry.line} imports ${entry.specifier} (import test/support/${entry.target.split('/')[1]} instead)`);
}

const UP = '..';
const HERE = '.';

describe('test support of several rows is imported from test/support (W91-9)', () => {
  it('detects a test of another folder that imports an old path', () => {
    const planted = [
      // Each specifier starts with `${UP}`, so that the scan of the real tree does not find a specifier in this file.
      { path: 'test/acceptance/x.test.ts', text: `import { realtimeApp } from '${UP}/../src/realtime/__tests__/support';\n` },
      { path: 'src/modules/a/__tests__/y.db.test.ts', text: `import { readTrail } from '${UP}/../../core/__tests__/support';\n` },
      { path: 'src/core/__tests__/z.test.ts', text: `import { readTrail } from '${HERE}/support';\n` },
    ];
    expect(foreignImports(planted)).toEqual([
      "test/acceptance/x.test.ts:1 imports ../../src/realtime/__tests__/support (import test/support/realtime instead)",
      "src/modules/a/__tests__/y.db.test.ts:1 imports ../../../core/__tests__/support (import test/support/core instead)",
    ]);
  });

  it('no test outside src/core, src/engine and src/realtime imports their old support paths', () => {
    expect(foreignImports(readTree(WORKSPACE))).toEqual([]);
  });
});
