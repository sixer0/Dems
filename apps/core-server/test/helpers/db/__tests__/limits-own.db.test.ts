// Decision D114: the helper only RAISES the runner's limits, and only when it is imported. What a
// test file sets for itself afterwards wins, LOWER or HIGHER. This file sets one of each: a test
// limit below the helper's 120 s and a hook limit above its 180 s. Both must be what applies.
//
// Fourteen database test files of the module rows set limits below the caps (60 s and 120 s) and
// then call `useTestDatabase`, in that order: they keep them, as this file keeps its own.
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { DB_HOOK_TIMEOUT_MS, DB_TEST_TIMEOUT_MS } from '../constants';
import { currentTestLimits, isNoLimit, providedRun, useTestDatabase } from '../index';
import { SELFTEST_TEMPLATE } from '../testing/probe-hooks';

/** What the helper had set when it was imported, before this file set anything. */
const fromTheHelper = currentTestLimits();

const OWN_TEST_TIMEOUT_MS = 30_000;
const OWN_HOOK_TIMEOUT_MS = 400_000;
vi.setConfig({ testTimeout: OWN_TEST_TIMEOUT_MS, hookTimeout: OWN_HOOK_TIMEOUT_MS });

// As the module rows' files do it: the file's own limits first, then the helper's entry.
const db = useTestDatabase({ template: SELFTEST_TEMPLATE });
/** Read right after the call: the entry must not have raised what the file set. */
const afterTheEntry = currentTestLimits();

let inBeforeAll: ReturnType<typeof currentTestLimits> = null;

beforeAll(() => {
  inBeforeAll = currentTestLimits();
});

afterAll(() => {
  expect(currentTestLimits()).toEqual({ testTimeout: OWN_TEST_TIMEOUT_MS, hookTimeout: OWN_HOOK_TIMEOUT_MS });
});

describe('a database test file that sets its own limits', () => {
  it('runs in a run of the database tests, and the helper had raised the limits when it was imported', () => {
    expect(providedRun().prefix).toMatch(/^dems_test_/);
    // At least the caps; or none at all, in a run that was started without limits.
    const test = fromTheHelper?.testTimeout ?? Number.NaN;
    const hook = fromTheHelper?.hookTimeout ?? Number.NaN;
    expect(isNoLimit(test) || test >= DB_TEST_TIMEOUT_MS, String(test)).toBe(true);
    expect(isNoLimit(hook) || hook >= DB_HOOK_TIMEOUT_MS, String(hook)).toBe(true);
  });

  it('keeps a test limit that is LOWER than the cap', ({ task }) => {
    expect(OWN_TEST_TIMEOUT_MS).toBeLessThan(DB_TEST_TIMEOUT_MS);
    expect(task.timeout).toBe(OWN_TEST_TIMEOUT_MS);
  });

  it('keeps a hook limit that is HIGHER than the cap', () => {
    expect(OWN_HOOK_TIMEOUT_MS).toBeGreaterThan(DB_HOOK_TIMEOUT_MS);
    expect(inBeforeAll).toEqual({ testTimeout: OWN_TEST_TIMEOUT_MS, hookTimeout: OWN_HOOK_TIMEOUT_MS });
  });

  it('the call of useTestDatabase leaves the file\'s own limits as they are', () => {
    expect(afterTheEntry).toEqual({ testTimeout: OWN_TEST_TIMEOUT_MS, hookTimeout: OWN_HOOK_TIMEOUT_MS });
  });

  it('and the helper does not raise them again while the file runs, also when the file uses its database', async ({ task }) => {
    const rows = await db.ownerPool().query<{ db: string }>('SELECT current_database()::text AS db');
    expect(rows.rows).toEqual([{ db: db.name }]);
    const more = await db.another({ slug: 'limits_own_more' });
    await more.drop();
    expect(currentTestLimits()).toEqual({ testTimeout: OWN_TEST_TIMEOUT_MS, hookTimeout: OWN_HOOK_TIMEOUT_MS });
    expect(task.timeout).toBe(OWN_TEST_TIMEOUT_MS);
  });
});
