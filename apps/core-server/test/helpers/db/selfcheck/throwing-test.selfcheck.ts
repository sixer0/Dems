// Self-check fixture (see vitest.selfcheck.config.ts): a database test file whose test throws
// while pools are open. The file fails; its database must be gone afterwards (TI-10).
import { expect, it } from 'vitest';
import { useTestDatabase } from '../index';
import { PROBE_TABLE, SELFTEST_TEMPLATE } from '../testing/probe-hooks';

const db = useTestDatabase({ template: SELFTEST_TEMPLATE });

it('writes into its clone as the runtime role', async () => {
  await db.appPool().query(`INSERT INTO ${PROBE_TABLE} (token_hash, origin) VALUES ('t', 'throwing-test')`);
  const rows = await db.ownerPool().query<{ n: number }>(`SELECT count(*)::int AS n FROM ${PROBE_TABLE}`);
  expect(rows.rows).toEqual([{ n: 1 }]);
  console.log(`[selfcheck] throwing-test uses ${db.name}`);
});

it('throws while both pools are open', async () => {
  await db.appPool().query('SELECT 1');
  throw new Error('selfcheck: this test throws on purpose');
});
