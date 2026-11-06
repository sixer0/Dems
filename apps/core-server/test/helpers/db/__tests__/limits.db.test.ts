// Decision D114, in a run of the database tests: a test file that imports the helper gets
// 120 s per test and 180 s per hook WITHOUT a line of its own. This file has none. It asks the
// helper for nothing but the run (no clone), so it takes milliseconds.
//
// What a file that sets its own limits keeps: `limits-own.db.test.ts`. The rule itself and the
// database-free project: `limits.test.ts`.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { DB_HOOK_TIMEOUT_MS, DB_TEST_TIMEOUT_MS } from '../constants';
import { currentTestLimits, isNoLimit, providedRun } from '../index';

/**
 * At least the cap, or no limit at all: a run that was started without limits (`--test-timeout=0`,
 * under a debugger) keeps none, and that is not below any cap.
 */
function atLeast(limit: number | undefined, cap: number): boolean {
  return limit !== undefined && (isNoLimit(limit) || limit >= cap);
}

/** Read while the file is collected: after its imports, before its first hook or test is registered. */
const atCollection = currentTestLimits();
let inBeforeAll: ReturnType<typeof currentTestLimits> = null;
let inAfterAll: ReturnType<typeof currentTestLimits> = null;

beforeAll(() => {
  inBeforeAll = currentTestLimits();
});

afterAll(() => {
  inAfterAll = currentTestLimits();
  // An assertion in the last hook: a failure here fails the file.
  expect(atLeast(inAfterAll?.hookTimeout, DB_HOOK_TIMEOUT_MS)).toBe(true);
});

describe('a database test file with no limit of its own', () => {
  it('runs in a run of the database tests', () => {
    expect(providedRun().prefix).toMatch(/^dems_test_/);
  });

  it('has the two limits raised before its first hook or test is registered', () => {
    expect(atCollection).not.toBeNull();
    expect(atLeast(atCollection?.testTimeout, DB_TEST_TIMEOUT_MS), String(atCollection?.testTimeout)).toBe(true);
    expect(atLeast(atCollection?.hookTimeout, DB_HOOK_TIMEOUT_MS), String(atCollection?.hookTimeout)).toBe(true);
  });

  it('a test of it has 120 s, by what the runner itself says of the test', ({ task }) => {
    expect(atLeast(task.timeout, DB_TEST_TIMEOUT_MS), String(task.timeout)).toBe(true);
    expect(task.timeout).toBe(atCollection?.testTimeout);
  });

  it('a hook of it has 180 s', () => {
    expect(atLeast(inBeforeAll?.hookTimeout, DB_HOOK_TIMEOUT_MS), String(inBeforeAll?.hookTimeout)).toBe(true);
    expect(inBeforeAll).toEqual(atCollection);
  });

  it('a limit on one test is that test\'s own, lower or higher', ({ task }) => {
    expect(task.timeout).toBe(7_000);
  }, 7_000);

  it('the limits are never BELOW the caps, and never a number the runner would misread', ({ task }) => {
    // With the project as it is configured (the runner's own 5 s and 10 s) they are the caps
    // exactly; `limits.test.ts` pins that. Here: whatever the run was started with, a database
    // test is not stopped earlier than at the cap.
    const now = currentTestLimits();
    expect(now).not.toBeNull();
    expect(Number.isNaN(task.timeout)).toBe(false);
    expect(isNoLimit(task.timeout) || task.timeout >= DB_TEST_TIMEOUT_MS).toBe(true);
    expect(atLeast(now?.hookTimeout, DB_HOOK_TIMEOUT_MS)).toBe(true);
  });
});
