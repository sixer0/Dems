// Self-check fixture (see vitest.selfcheck.config.ts): a database test file whose own
// `beforeAll` throws after the helper has cloned its database. No test of the file runs; its
// database must be gone afterwards all the same (TI-10).
import { beforeAll, expect, it } from 'vitest';
import { useTestDatabase } from '../index';
import { SELFTEST_TEMPLATE } from '../testing/probe-hooks';

const db = useTestDatabase({ template: SELFTEST_TEMPLATE });

beforeAll(async () => {
  await db.appPool().query('SELECT 1');
  console.log(`[selfcheck] throwing-hook uses ${db.name}`);
  throw new Error('selfcheck: this hook throws on purpose');
});

it('is never reached', () => {
  expect(db.name).toBe('unreachable');
});
