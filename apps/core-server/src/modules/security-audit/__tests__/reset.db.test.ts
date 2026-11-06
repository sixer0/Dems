// The security-audit module across demo resets (plan row W39; spec §7.13 "The lineage of
// discarded chains", §12.4; SR-78; AC-B-87 for operation 60; database contract §4.30, LN-4, LN-5;
// decisions D74, D77 DN-7 to DN-12).
//
// The reset is the ROUTINE itself (`resetDatabase`), run on a clone of the seed with the quiesce
// order of its server-side caller (the demo-control module, another row): readiness held, the
// pipeline drained, the engine stopped, the runtime pool closed; then the pool reopened and the
// engine reloaded. The tests of this file run in order and share one app.
//
// The test holds NO connection of its own on the target while a reset runs (the routine refuses
// a target that is in use): everything before the last reset is read through the API.
import { validateCoreApiResponse, type AuditChainStatus, type AuditPage, type EventPage, type SecurityStatus } from '@dems/shared/api';
import { verifyAuditChain, type ScenarioName } from '@dems/shared/sim';
import type { Pool } from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { useTestDatabase, type TestDatabase } from '../../../../test/helpers/db';
import { resetDatabase, type ResetReport } from '../../../db/reset';
import { discard, lineageRows, maintenancePool } from '../../../../test/support/reset';
import { decodeAuditCursor } from '../cursor';
import { AUDIT, AUDIT_CHAIN, EVENTS, SECURITY_STATUS, auditApp, chainReads, errorOf, outcomeOf, walkAudit, type AuditApp, type Headers } from './support';

const db = useTestDatabase({ template: 'seed' });
let target: TestDatabase;
let maintenance: Pool;
let host: AuditApp;
let investigator: Headers;
let supervisor: Headers;
let technician: Headers;

beforeAll(async () => {
  target = await db.another({ slug: 'w39_reset' });
  maintenance = maintenancePool(db.run.dataDir);
  host = await auditApp(target, db.run.dataDir);
  investigator = await host.signIn('INVESTIGATOR');
  supervisor = await host.signIn('SUPERVISOR');
  technician = await host.signIn('TECHNICIAN');
  await host.app.pipeline.drain();
}, 120_000);

afterAll(async () => {
  // A database that a reset has just built is where autovacuum goes next; the plain drop of the
  // reset tests waits for it instead of being refused (the reset row's finding, decision D76).
  try {
    await discard(maintenance, target, db.run.identity.prefix);
  } finally {
    await maintenance.end();
  }
}, 120_000);

beforeEach(() => {
  host.forgetCounters();
});

/** What a request during the reset answered. */
let duringReset: Array<[number, string | null]> = [];

async function reset(options: { reason: 'RESET' | 'SCENARIO_LOAD'; scenario: ScenarioName; actorId: string | null }): Promise<ResetReport> {
  const release = host.app.readiness.hold('reset');
  try {
    const report = await resetDatabase(
      {
        database: target.name,
        clock: () => host.clock.now(),
        actorId: options.actorId,
        reason: options.reason,
        scenario: options.scenario,
        dataDir: db.run.dataDir,
        quiesce: async () => {
          duringReset = [outcomeOf(await host.get(AUDIT, supervisor)), outcomeOf(await host.get(AUDIT_CHAIN, supervisor))];
          await host.app.pipeline.drain();
          await host.engine.stop();
          await host.app.db.close();
        },
      },
      { testRunPrefix: db.run.identity.prefix },
    );
    await host.app.db.reopen();
    expect(await host.app.db.probe({ fresh: true })).toBe(true);
    await host.engine.reload();
    return report;
  } finally {
    release();
  }
}

const chain = async (session: Headers = supervisor): Promise<AuditChainStatus> => {
  const response = await host.get(AUDIT_CHAIN, session);
  expect(response.statusCode).toBe(200);
  expect(validateCoreApiResponse('verifyAuditChain', 200, response.json())).toEqual({ ok: true });
  return response.json();
};
const status = async (): Promise<SecurityStatus> => (await host.get(SECURITY_STATUS, supervisor)).json();

interface Before {
  readonly total: number;
  readonly head: string;
  readonly epoch: number;
  /** A cursor on a row the engine appended after the seed history. */
  readonly lateCursor: string;
  /** A cursor on row 40, a row of the seed history. */
  readonly seedCursor: string;
  readonly seedRowHash: string;
  readonly eventCursor: string;
}
let first: Before;
let firstReport: ResetReport;
let firstLineage: AuditChainStatus['lineage'];
let secondBefore: { total: number; head: string; epoch: number };

describe('before any reset', () => {
  it('the lineage is empty, the stored chain verifies, and the client holds cursors of the chain it is paging', async () => {
    await host.appendRows(4);
    const before = await chain();
    expect(before).toMatchObject({ lineage: [], lineageTotal: 0, stored: { ok: true, firstBadSeq: null } });
    const security = await status();
    expect(security.auditTotal).toBeGreaterThanOrEqual(89);

    const late: AuditPage = (await host.get(`${AUDIT}?limit=${security.auditTotal - 2}`, supervisor)).json();
    const seed: AuditPage = (await host.get(`${AUDIT}?limit=40`, supervisor)).json();
    const events: EventPage = (await host.get(`${EVENTS}?limit=20`, supervisor)).json();
    expect(decodeAuditCursor(late.nextCursor ?? '')?.seq).toBe(security.auditTotal - 2);
    expect(decodeAuditCursor(seed.nextCursor ?? '')?.seq).toBe(40);
    first = {
      total: security.auditTotal,
      head: security.auditHead,
      epoch: host.engine.epoch,
      lateCursor: late.nextCursor ?? '',
      seedCursor: seed.nextCursor ?? '',
      seedRowHash: seed.rows[39]?.hash ?? '',
      eventCursor: events.nextCursor ?? '',
    };
    // The cursors work while the chain is the one they were taken from.
    expect((await host.get(`${AUDIT}?cursor=${first.lateCursor}`, supervisor)).json().rows).toHaveLength(2);
  });
});

describe('after one reset (resetDemo: reason RESET, scenario idle, by the SUPERVISOR)', () => {
  it('the routine discards the chain and the engine reloads on the new one with the next epoch; requests during the reset answer 503', async () => {
    host.clock.advance(90_000);
    firstReport = await reset({ reason: 'RESET', scenario: 'idle', actorId: host.operator('SUPERVISOR').id });
    expect(firstReport).toMatchObject({ previousEpoch: first.epoch, epoch: first.epoch + 1, lineage: { carried: 0, appended: { resetNo: '1', reason: 'RESET', scenario: 'idle' }, total: 1 } });
    expect(host.engine.epoch).toBe(first.epoch + 1);
    expect(duringReset).toEqual([
      [503, 'NOT_READY'],
      [503, 'NOT_READY'],
    ]);
    // The web sessions are kept by a reset: the same cookies answer.
    expect((await host.get(SECURITY_STATUS, investigator)).statusCode).toBe(200);
  }, 120_000);

  it('operation 60 returns the one lineage row: the epoch the chain ended in, its row count and head, the instant, the operator, the scenario and the reason', async () => {
    const answer = await chain();
    expect(answer.lineage).toStrictEqual([
      { epoch: first.epoch, rows: first.total, head: first.head, resetAt: host.clock.now(), actorId: host.operator('SUPERVISOR').id, scenario: 'idle', reason: 'RESET' },
    ]);
    expect(answer.lineageTotal).toBe(1);
    expect(Object.keys(answer.lineage[0] ?? {})).toEqual(['epoch', 'rows', 'head', 'resetAt', 'actorId', 'scenario', 'reason']);
    firstLineage = answer.lineage;
  });

  it('the remembered head was dropped with the old chain: the first call after the reset read EVERY row of the new chain, and the new chain verifies', async () => {
    const security = await status();
    expect(security.auditTotal).toBe(firstReport.auditHead.seq);
    expect(security.auditHead).toBe(firstReport.auditHead.hash);
    // The full pass of the call in the test above: all rows of the new chain, once.
    const reads = chainReads(host.database.statements);
    expect(reads.at(-1)).toBe(firstReport.auditHead.seq);
    const answer = await chain();
    expect(answer.stored).toEqual({ ok: true, checked: security.auditTotal, head: security.auditHead, firstBadSeq: null });
    expect(answer.view).toEqual({ ok: true, checked: security.auditTotal, head: security.auditHead });
    // No second pass: nothing was appended since.
    expect(chainReads(host.database.statements)).toHaveLength(reads.length);
    // LN-3 holds on a database the routine built: no warning of the stored check.
    expect(host.log.lines().filter((line) => line['code'] === 'LINEAGE_MISMATCH')).toEqual([]);
  });

  it('WHAT A CLIENT SEES with a cursor of the discarded chain: 422 INVALID_INPUT, "a cursor that is not one"; it starts its walk again', async () => {
    const stale = await host.get(`${AUDIT}?cursor=${first.lateCursor}`, supervisor);
    expect(outcomeOf(stale)).toEqual([422, 'INVALID_INPUT']);
    expect(errorOf(stale).details).toEqual({ in: 'querystring' });
    expect(validateCoreApiResponse('listAuditRows', 422, stale.json())).toEqual({ ok: true });

    // A cursor on a row of the seed history: valid exactly when the new chain holds that row as named.
    const fresh = (await walkAudit(host, supervisor, '?limit=200')).flatMap((page) => page.rows);
    const sameRow = fresh[39]?.hash === first.seedRowHash;
    const seedAnswer = await host.get(`${AUDIT}?limit=5&cursor=${first.seedCursor}`, supervisor);
    expect(seedAnswer.statusCode).toBe(sameRow ? 200 : 422);
    if (sameRow) expect((seedAnswer.json() as AuditPage).rows).toStrictEqual(fresh.slice(40, 45));
    console.info(`[w39] after a reset: a cursor on a row appended to the discarded chain -> 422 INVALID_INPUT; a cursor on seed row 40 -> ${seedAnswer.statusCode} (the new chain ${sameRow ? 'holds the same row' : 'has another row 40'})`);

    // The same for the events.
    const events = await host.get(`${EVENTS}?cursor=${first.eventCursor}`, supervisor);
    const allEvents = (await host.get(`${EVENTS}?limit=200`, supervisor)).json() as EventPage;
    const [, at] = first.eventCursor.split('-').slice(-2);
    expect(events.statusCode).toBe(allEvents.events[19]?.at === Number(at) ? 200 : 422);

    // The walk started again is the new chain, whole and verifying.
    expect(fresh.map((row) => row.seq)).toEqual(Array.from({ length: fresh.length }, (_, index) => index + 1));
    const last = await host.get(`${AUDIT}?limit=1`, supervisor);
    const page: AuditPage = last.json();
    expect(verifyAuditChain({ rows: fresh, head: page.head, total: page.total, dropped: 0 })).toMatchObject({ ok: true, checked: fresh.length });
    // The row that names the discarded chain is in the new one.
    const loaded = fresh.find((row) => row.type === 'SCENARIO_LOADED');
    expect(loaded?.details).toMatchObject({ previousHead: first.head, previousRows: first.total });
  });
});

describe('after two resets (the second: a scenario load from the command line, no operator)', () => {
  it('the second reset discards the chain of the first', async () => {
    await host.appendRows(2);
    const security = await status();
    secondBefore = { total: security.auditTotal, head: security.auditHead, epoch: host.engine.epoch };
    host.clock.advance(45_000);
    const report = await reset({ reason: 'SCENARIO_LOAD', scenario: 'recording', actorId: null });
    expect(report).toMatchObject({ previousEpoch: secondBefore.epoch, epoch: secondBefore.epoch + 1, lineage: { carried: 1, appended: { resetNo: '2', reason: 'SCENARIO_LOAD', scenario: 'recording', actorId: null }, total: 2 } });
  }, 120_000);

  it('operation 60 returns BOTH lineage rows, newest first, with lineageTotal 2; the older row is as it was', async () => {
    const answer = await chain();
    expect(answer.lineageTotal).toBe(2);
    expect(answer.lineage).toStrictEqual([
      { epoch: secondBefore.epoch, rows: secondBefore.total, head: secondBefore.head, resetAt: host.clock.now(), actorId: null, scenario: 'recording', reason: 'SCENARIO_LOAD' },
      ...firstLineage,
    ]);
    expect(answer.lineage.map((entry) => entry.epoch)).toEqual([first.epoch + 1, first.epoch]);
    expect(answer.stored.ok).toBe(true);
    expect(validateCoreApiResponse('verifyAuditChain', 200, answer)).toEqual({ ok: true });
    console.info(`[w39] after two resets: lineageTotal ${answer.lineageTotal}; lineage epochs ${answer.lineage.map((entry) => entry.epoch).join(', ')} (newest first); reasons ${answer.lineage.map((entry) => entry.reason).join(', ')}; actors ${answer.lineage.map((entry) => String(entry.actorId)).join(', ')}`);
  });

  it('every signed-in role reads the same lineage (AC-B-87 for operation 60)', async () => {
    const answers = [await chain(investigator), await chain(supervisor), await chain(technician)];
    expect(answers[1]?.lineage).toStrictEqual(answers[0]?.lineage);
    expect(answers[2]?.lineage).toStrictEqual(answers[0]?.lineage);
    const refused = await host.get(AUDIT_CHAIN);
    expect(outcomeOf(refused)).toEqual([401, 'NOT_SIGNED_IN']);
  });

  it('the answer is what the table holds: the two stored rows, in the reverse of their reset order, without the three members the contract does not name', async () => {
    const storedRows = await lineageRows(target.ownerPool());
    expect(storedRows.map((row) => row.reset_no)).toEqual(['1', '2']);
    const answer = await chain();
    expect(answer.lineage).toStrictEqual(
      [...storedRows].reverse().map((row) => ({
        epoch: Number(row.epoch),
        rows: Number(row.row_count),
        head: row.head_hash,
        resetAt: Number(row.reset_at),
        actorId: row.actor_id,
        scenario: row.scenario,
        reason: row.reason,
      })),
    );
    for (const entry of answer.lineage) {
      expect(entry).not.toHaveProperty('firstSeq');
      expect(entry).not.toHaveProperty('lastSeq');
      expect(entry).not.toHaveProperty('resetNo');
    }
  });
});
