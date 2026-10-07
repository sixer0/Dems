// Row PT (W100-5 of the client security review, D251), static rule: the `[DEMS-LIVE]` request line of
// the Live typed client is a development-console line only. Its guard must contain a literal `__DEV__`
// test, so Metro folds the line away in a release bundle by construction, not only because Live mode
// is unavailable there (`core-link.ts`). Jest runs with `__DEV__` true, so a runtime test cannot tell
// the guard apart; this file reads the source instead (comments are stripped first).
import { describe, expect, it } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const SOURCE = join(__dirname, 'sim-adapters.ts');

function codeLines(text: string): string[] {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .map((line) => line.replace(/^\s*\/\/.*$/, ''));
}

describe('[DEMS-LIVE] console line (W100-5)', () => {
  it('is emitted from exactly one place, under a literal __DEV__ guard on the same statement', () => {
    const lines = codeLines(readFileSync(SOURCE, 'utf8'));
    const emitting = lines.filter((line) => line.includes('[DEMS-LIVE]'));
    expect(emitting).toHaveLength(1);
    const line = emitting[0]!;
    expect(line).toMatch(/console\.info\(/);
    // The guard is the `if (...)` that opens the statement holding the console call.
    const guard = /^\s*if\s*\(([^)]*)\)\s*console\.info\(/.exec(line);
    expect(guard).not.toBeNull();
    expect(guard![1]).toMatch(/(^|[\s&(])__DEV__\s*&&/);
  });
});
