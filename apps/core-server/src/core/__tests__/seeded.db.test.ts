// The core services on a SEEDED database (plan row W21, with the seed of plan row W20): a clone
// of the seed template, as `dems_app`. The schema-only clones of the other files hold the few
// fixture rows a test needs; this one holds what `dems_demo` holds after `db:seed`.
//
// What is proven: the registered boot checks pass on the seed, B-8 verifies the seeded chain
// with the mapping module's digest check, and the writers continue that chain and that event
// counter without a gap. Nothing here touches a project database.
import type { Pool } from 'pg';
import { beforeAll, describe, expect, it } from 'vitest';
import { useTestDatabase } from '../../../test/helpers/db';
import {
  BOOT_CHECKS,
  GENESIS,
  coreApp,
  linkProblems,
  passedAmong,
  readEventCounter,
  readEvents,
  readHead,
  readTrail,
  verifyTrail,
  type CoreApp,
} from './support';

const db = useTestDatabase({ template: 'seed' });
let core: CoreApp;
let owner: Pool;

beforeAll(async () => {
  owner = db.ownerPool();
  core = await coreApp(db, db.run.dataDir, 'info');
});

describe('a seeded database', () => {
  it('passes the nine boot checks in order; B-8 verifies every seeded row', async () => {
    const seeded = await readTrail(owner);
    expect(seeded.length).toBeGreaterThan(0);
    // The whole boot succeeds on a seeded database: the steps other units add after the nine
    // checks (the engine's rehydration, the stored role matrix, whatever comes later) pass too.
    await core.app.readiness.boot();
    const lines = core.log.lines();
    const passed = lines.filter((line) => line['msg'] === 'boot step passed').map((line) => line['step']);
    // By-design change (checkpoint CP-B1, finding CPB1-13; standing rule M10): this test listed
    // EVERY boot step of the server and broke with each step another row added (D72, W28). It
    // pins its own: the nine checks passed, in the order of the contract.
    expect(passedAmong(passed, BOOT_CHECKS)).toEqual([...BOOT_CHECKS]);
    expect(passed.length).toBeGreaterThanOrEqual(BOOT_CHECKS.length);
    expect(lines.find((line) => line['msg'] === 'the stored audit chain verifies')).toMatchObject({
      step: 'B-8',
      rowsChecked: seeded.length,
      firstSeq: 1,
      lastSeq: seeded.length,
      linkBreaks: 0,
      digests: 'ok',
    });
    expect(lines.some((line) => line['msg'] === 'boot check failed')).toBe(false);
    console.info(`[w21] seeded clone: B-1 to B-9 passed; B-8 verified ${seeded.length} seeded audit rows`);
  });

  it('the writers continue the seeded chain and the seeded event counter without a gap', async () => {
    const before = { rows: await readTrail(owner), head: await readHead(owner), events: await readEvents(owner), counter: await readEventCounter(owner) };
    expect(before.head).toEqual({ seq: before.rows.length, hash: before.rows.at(-1)?.hash ?? GENESIS });
    const operatorId = (await owner.query<{ id: string }>('SELECT id FROM public.operators ORDER BY id LIMIT 1')).rows[0]?.id ?? null;

    const { row, event } = await core.app.pipeline.run('test.seeded', async (unit) => ({
      row: await unit.audit.append({
        type: 'AUTH_SUCCESS',
        actorId: operatorId,
        deviceId: null,
        message: 'Signed in.',
        severity: 'SUCCESS',
        details: { method: 'PASSWORD' },
      }),
      event: await unit.events.append({ type: 'AUTH_LOGIN', message: 'Signed in.', severity: 'SUCCESS' }),
    }));

    expect(row.seq).toBe(before.head.seq + 1);
    expect(row.prevHash).toBe(before.head.hash);
    expect(event.seq).toBe(before.counter);
    expect(event.seq).toBeGreaterThan(before.events.at(-1)?.seq ?? 0);

    const rows = await readTrail(owner);
    const head = await readHead(owner);
    expect(rows).toHaveLength(before.rows.length + 1);
    expect(linkProblems(rows)).toEqual([]);
    expect(verifyTrail(rows, head)).toEqual({ ok: true, checked: rows.length, head: head.hash });
    expect(await readEventCounter(owner)).toBe((before.counter ?? 0) + 1);
    console.info(
      `[w21] seeded clone: appended seq ${row.seq} on ${before.rows.length} seeded rows and event ${event.seq} on ${before.events.length} seeded events; ` +
        `verifyAuditChain ok=true over ${rows.length} rows`,
    );
  });
});
