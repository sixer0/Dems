// Decision D114: the helper raises the runner's two limits for a database test file, by itself.
// This file belongs to the database-free project, where no run is provided, and proves:
//
//   - the rule: a limit below its cap is raised to the cap; a limit at or above it is kept, and
//     so is "no limit" (zero, to the runner);
//   - the helper can read the limits the runner holds, in this version of the runner;
//   - a file of the database-free project that imports the helper keeps the runner's limits.
//
// Against a run of the database tests: `limits.db.test.ts` (a file with no limit of its own)
// and `limits-own.db.test.ts` (a file that sets its own).
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DB_HOOK_TIMEOUT_MS, DB_TEST_TIMEOUT_MS, PROVIDE_KEY } from '../constants';
import { currentTestLimits, isNoLimit, raisedTestLimits } from '../index';

afterEach(() => {
  vi.resetConfig();
});

describe('the two caps', () => {
  it('are 120 s per test and 180 s per hook', () => {
    expect([DB_TEST_TIMEOUT_MS, DB_HOOK_TIMEOUT_MS]).toEqual([120_000, 180_000]);
  });
});

describe('a limit is only ever raised', () => {
  it("the runner's own limits, 5 s and 10 s, become the caps", () => {
    expect(raisedTestLimits({ testTimeout: 5_000, hookTimeout: 10_000 })).toEqual({ testTimeout: 120_000, hookTimeout: 180_000 });
  });

  it('a limit that is already higher is kept, each of the two by itself', () => {
    expect(raisedTestLimits({ testTimeout: 300_000, hookTimeout: 400_000 })).toEqual({ testTimeout: 300_000, hookTimeout: 400_000 });
    expect(raisedTestLimits({ testTimeout: 300_000, hookTimeout: 10_000 })).toEqual({ testTimeout: 300_000, hookTimeout: 180_000 });
    expect(raisedTestLimits({ testTimeout: 5_000, hookTimeout: 400_000 })).toEqual({ testTimeout: 120_000, hookTimeout: 400_000 });
  });

  it('a limit exactly at its cap is kept', () => {
    expect(raisedTestLimits({ testTimeout: 120_000, hookTimeout: 180_000 })).toEqual({ testTimeout: 120_000, hookTimeout: 180_000 });
  });

  it('"no limit" is kept: to the runner zero, a negative number and infinity mean "never stop this test"', () => {
    // A run under a debugger is started with `--test-timeout=0`: the helper must not end it after 120 s.
    expect(raisedTestLimits({ testTimeout: 0, hookTimeout: 0 })).toEqual({ testTimeout: 0, hookTimeout: 0 });
    expect(raisedTestLimits({ testTimeout: -1, hookTimeout: -1 })).toEqual({ testTimeout: -1, hookTimeout: -1 });
    expect(raisedTestLimits({ testTimeout: Number.POSITIVE_INFINITY, hookTimeout: Number.POSITIVE_INFINITY })).toEqual({
      testTimeout: Number.POSITIVE_INFINITY,
      hookTimeout: Number.POSITIVE_INFINITY,
    });
    // Each of the two by itself.
    expect(raisedTestLimits({ testTimeout: 0, hookTimeout: 10_000 })).toEqual({ testTimeout: 0, hookTimeout: 180_000 });
    expect(raisedTestLimits({ testTimeout: 5_000, hookTimeout: 0 })).toEqual({ testTimeout: 120_000, hookTimeout: 0 });
    expect([0, -1, Number.POSITIVE_INFINITY].every(isNoLimit)).toBe(true);
    expect([1, 5_000, 120_000, Number.MAX_SAFE_INTEGER].some(isNoLimit)).toBe(false);
  });

  it('a value that is no number of milliseconds is replaced by the cap', () => {
    expect(raisedTestLimits({ testTimeout: Number.NaN, hookTimeout: Number.NaN })).toEqual({ testTimeout: 120_000, hookTimeout: 180_000 });
  });

  it('where the limits cannot be read, the caps are what is set', () => {
    expect(raisedTestLimits(null)).toEqual({ testTimeout: 120_000, hookTimeout: 180_000 });
  });

  it.each([
    [1, 1],
    [4_999, 9_999],
    [60_000, 120_000],
    [119_999, 179_999],
    [120_001, 180_001],
    [3_600_000, 3_600_000],
  ])('never lowers: %i and %i', (testTimeout, hookTimeout) => {
    const raised = raisedTestLimits({ testTimeout, hookTimeout });
    expect(raised.testTimeout).toBeGreaterThanOrEqual(testTimeout);
    expect(raised.hookTimeout).toBeGreaterThanOrEqual(hookTimeout);
    expect(raised.testTimeout).toBeGreaterThanOrEqual(DB_TEST_TIMEOUT_MS);
    expect(raised.hookTimeout).toBeGreaterThanOrEqual(DB_HOOK_TIMEOUT_MS);
  });
});

describe('the limits the runner holds can be read', () => {
  it('what the runner is told to set is what the helper reads, and a reset is read too', () => {
    const before = currentTestLimits();
    expect(before).not.toBeNull();
    expect(before?.testTimeout).toBeTypeOf('number');
    expect(before?.hookTimeout).toBeTypeOf('number');

    vi.setConfig({ testTimeout: 1_234, hookTimeout: 2_345 });
    expect(currentTestLimits()).toEqual({ testTimeout: 1_234, hookTimeout: 2_345 });
    vi.setConfig({ testTimeout: 7_777 });
    expect(currentTestLimits()).toEqual({ testTimeout: 7_777, hookTimeout: 2_345 });

    vi.resetConfig();
    expect(currentTestLimits()).toEqual(before);
  });

  it('the limit of a test is the one that was held when the test was registered', ({ task }) => {
    // This file sets nothing before its tests are registered: the runner's own limit applies.
    expect(task.timeout).toBe(currentTestLimits()?.testTimeout);
  });
});

describe('a file of the database-free project that imports the helper', () => {
  it('has no run provided', async () => {
    const { inject } = await import('vitest');
    expect(inject(PROVIDE_KEY)).toBeUndefined();
  });

  it('keeps the limits it has: importing the helper again changes nothing', async () => {
    // Values that are neither the runner's own nor the caps, so that any change would show.
    vi.setConfig({ testTimeout: 1_234, hookTimeout: 2_345 });
    vi.resetModules();
    const again = await import('../index');
    expect(again.currentTestLimits()).toEqual({ testTimeout: 1_234, hookTimeout: 2_345 });
    expect(currentTestLimits()).toEqual({ testTimeout: 1_234, hookTimeout: 2_345 });
  });

  it('and its tests keep the limit of the runner, below the cap', ({ task }) => {
    // The helper was imported at the top of this file, before this test was registered.
    expect(task.timeout).toBeLessThan(DB_TEST_TIMEOUT_MS);
  });
});
