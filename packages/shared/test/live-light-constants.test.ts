// Plan row W18, follow-up to finding F40-2 (decision D43): the display timings of Live mode that a
// feature file imports statically from `@dems/shared/live`. Names and values are those of
// 04_client_integration_spec §2.4 (pinned by 02_plan §3.4 "Client constants"); nothing is invented.
// The file is also covered by the static scan of live-light-platform-neutral.test.ts.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, expectTypeOf, it } from 'vitest';
import * as viaSubpath from '@dems/shared/live';
import * as constants from '../src/live/constants';
import { LIVE_PENDING_REVEAL_MS, LIVE_RESYNCED_NOTICE_MS } from '../src/live';
import { motion } from '../src/tokens';

const FILE = fileURLToPath(new URL('../src/live/constants.ts', import.meta.url));
const raw = readFileSync(FILE, 'utf8');
/** The file without block and line comments. */
const code = raw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:\\])\/\/.*$/gm, '$1');

describe('light constants: the values of the specification (§2.4)', () => {
  it('LIVE_PENDING_REVEAL_MS is 420, the motion token duration.slow (LB-1)', () => {
    expect(LIVE_PENDING_REVEAL_MS).toBe(420);
    expect(LIVE_PENDING_REVEAL_MS).toBe(motion.duration.slow);
  });

  it('LIVE_RESYNCED_NOTICE_MS is 3,000 (§3.5, "Link back")', () => {
    expect(LIVE_RESYNCED_NOTICE_MS).toBe(3000);
  });

  it('the reveal sits above the feedback tempo of 90 to 180 ms (§2.4) and between the test points of AC-C-57 (no spinner at 300 ms, a spinner at 500 ms)', () => {
    expect(LIVE_PENDING_REVEAL_MS).toBeGreaterThan(180);
    expect(LIVE_PENDING_REVEAL_MS).toBeGreaterThan(300);
    expect(LIVE_PENDING_REVEAL_MS).toBeLessThan(500);
  });

  it('both are plain numbers, typed as their literal value', () => {
    expect(typeof LIVE_PENDING_REVEAL_MS).toBe('number');
    expect(typeof LIVE_RESYNCED_NOTICE_MS).toBe('number');
    expectTypeOf<typeof LIVE_PENDING_REVEAL_MS>().toEqualTypeOf<420>();
    expectTypeOf<typeof LIVE_RESYNCED_NOTICE_MS>().toEqualTypeOf<3000>();
  });
});

describe('light constants: the file', () => {
  it('holds exactly the two constants the specification gives to the light layer', () => {
    expect(Object.keys(constants).sort()).toEqual(['LIVE_PENDING_REVEAL_MS', 'LIVE_RESYNCED_NOTICE_MS']);
  });

  it('imports nothing: no import, no re-export, no require', () => {
    expect(code).not.toMatch(/\bimport\b/);
    expect(code).not.toMatch(/\bfrom\s+['"]/);
    expect(code).not.toMatch(/\brequire\s*\(/);
    // Positive control: the same patterns do see the imports of a file that has some.
    const hooks = readFileSync(fileURLToPath(new URL('../src/live/hooks.ts', import.meta.url)), 'utf8');
    expect(hooks).toMatch(/\bimport\b/);
    expect(hooks).toMatch(/\bfrom\s+['"]/);
  });

  it('holds only two numeric declarations: no call, no object, no computed value', () => {
    const statements = code
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
    expect(statements).toEqual(['export const LIVE_PENDING_REVEAL_MS = 420;', 'export const LIVE_RESYNCED_NOTICE_MS = 3_000;']);
  });

  it('leaves the other four constants of §2.4 to the modules that use them', () => {
    for (const name of ['LIVE_COMMAND_TIMEOUT_MS', 'LIVE_SETTLE_TIMEOUT_MS', 'LIVE_BOOT_TIMEOUT_MS', 'LIVE_TOUCH_INTERVAL_MS']) {
      expect(Object.keys(viaSubpath), name).not.toContain(name);
    }
  });
});

describe('light constants: the export subpath', () => {
  it('@dems/shared/live exports both, with the same values', () => {
    expect(viaSubpath.LIVE_PENDING_REVEAL_MS).toBe(constants.LIVE_PENDING_REVEAL_MS);
    expect(viaSubpath.LIVE_RESYNCED_NOTICE_MS).toBe(constants.LIVE_RESYNCED_NOTICE_MS);
  });
});
