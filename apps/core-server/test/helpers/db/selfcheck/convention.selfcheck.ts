// Self-check fixture (see vitest.selfcheck.config.ts): a database test file in a run whose
// templates come from hook modules found by convention, as they will once the rows that own
// the migrations, the seed and the bulk fixture have added theirs.
import { afterAll, beforeAll, expect, it } from 'vitest';
import { OWNER_ROLE } from '../constants';
import { conventionResolver } from '../hooks';
import { TestRun, providedRun } from '../index';
import { createRunIdentity } from '../names';
import { PROBE_BULK_ROWS, PROBE_TABLE } from '../testing/probe-hooks';
import { CONVENTION_WORKSPACE } from './convention-workspace';

let run!: TestRun;

beforeAll(async () => {
  const provided = providedRun();
  run = await TestRun.attach(createRunIdentity(provided.label, provided.stamp), {
    resolveDefinition: conventionResolver(CONVENTION_WORKSPACE),
  });
});

afterAll(async () => {
  await (run as TestRun | undefined)?.close();
});

it('the global setup built tpl_schema and tpl_seed from the hook modules it found', async () => {
  expect(providedRun().templates).toEqual(['schema', 'seed']);
  expect(await run.listDatabases()).toEqual([
    { name: `${run.identity.prefix}tpl_schema`, owner: OWNER_ROLE, isTemplate: true, allowConnections: false },
    { name: `${run.identity.prefix}tpl_seed`, owner: OWNER_ROLE, isTemplate: true, allowConnections: false },
  ]);
  const clone = await run.createDatabase({ template: 'seed', slug: 'convention_seed' });
  try {
    const rows = await clone.appPool().query<{ n: number }>(`SELECT count(*)::int AS n FROM ${PROBE_TABLE}`);
    expect(rows.rows).toEqual([{ n: 1 }]);
  } finally {
    await clone.drop();
  }
  console.log('[selfcheck] convention: tpl_schema and tpl_seed came from the hook modules');
});

it('tpl_bulk is built at its first request, in the worker, from its hook module', async () => {
  const clone = await run.createDatabase({ template: 'bulk', slug: 'convention_bulk' });
  try {
    const rows = await clone.appPool().query<{ n: number }>(`SELECT count(*)::int AS n FROM ${PROBE_TABLE}`);
    expect(rows.rows).toEqual([{ n: 1 + PROBE_BULK_ROWS }]);
    expect(run.templateTimings.map((timing) => timing.key)).toEqual(['bulk']);
  } finally {
    await clone.drop();
  }
  console.log('[selfcheck] convention: tpl_bulk came from the hook module');
});
