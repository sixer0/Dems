// The purge of one operator (migration 0036; RB-9 as amended by the principal of PT GSP on
// 2026-11-02): the account goes together with the history that belongs to it, the chain is re-sealed
// over what survives, and the records OF THE UNIT keep their rows with their attribution dropped.
//
// What this file holds the code to, and what it gives up:
//   * every statement runs as the runtime role `dems_app`, because that is the only role the server
//     has; the erasure must be reachable through the two SECURITY DEFINER functions and through
//     nothing else;
//   * the chain is built with the shared digest (the fixtures seal each row), so the check after the
//     purge is the same check boot check B-8 runs — a seal that only LOOKS consistent fails here;
//   * the loss is asserted too: after a purge the log no longer mentions the account at all, which
//     is exactly what the amendment asked for and what an append-only chain used to prove otherwise.
import { OPERATOR_IDS, verifyAuditChain, type AuditLogSlice, type PurgedRange, type AuditRow } from '@dems/shared/sim';
import type { Pool } from 'pg';
import { beforeAll, describe, expect, it } from 'vitest';
import { engineApp, seedScenario, stateChanges } from '../support/engine';
import { deleteUser } from '../../src/modules/admin/changes';
import { PURGE_KEPT_AUDIT_TYPES, purgeForecast, purgeOperator, resealChain } from '../../src/modules/admin/statements';
import { readHead } from '../support/core';
import { useTestDatabase } from '../helpers/db';
import {
  activeSession,
  appendAuditRows,
  evidenceItem,
  insertRbac,
  insertRow,
  installationAcceptance,
  operator,
  operatorCredential,
  sessionHistory,
  type ChainHead,
} from './fixtures';
import { SQLSTATE, expectRefused, inTransaction } from './support';

const db = useTestDatabase({ template: 'schema' });
let app: Pool;
let owner: Pool;

/** The account under test, and the vendor root that is allowed to erase it. */
const TARGET = 'OPR-701';
const ROOT = 'OPR-702';

beforeAll(async () => {
  app = db.appPool();
  owner = db.ownerPool();
  await insertRbac(owner);
  await insertRow(owner, 'operators', operator(TARGET, 'purge.me', 'INVESTIGATOR'));
  await insertRow(owner, 'operators', operator(ROOT, 'root', 'SUPERVISOR'));
  await insertRow(owner, 'operator_credentials', operatorCredential(TARGET));
  // Records OF THE UNIT that name the target: these must survive the purge. The evidence row
  // rides the session's foreign key, so the session history is put in first (fixed 2026-11-03:
  // this file was written on a host without a runnable database and never saw these inserts).
  await insertRow(owner, 'session_history', sessionHistory());
  await insertRow(owner, 'evidence_items', evidenceItem({ investigator_id: TARGET }));
  await insertRow(owner, 'installation_acceptances', installationAcceptance({ accepted_by: TARGET }));
});

/** The stored chain, in the shape the shared verifier takes. */
async function storedChain(pool: Pool): Promise<AuditLogSlice> {
  const { rows } = await pool.query<Record<string, unknown>>(
    'SELECT seq, id, at, type, category, severity, actor_id, message, session_id, evidence_id, device_id, details, prev_hash, hash FROM audit_log ORDER BY seq',
  );
  const mapped = rows.map(
    (row): AuditRow =>
      ({
        seq: Number(row['seq']),
        id: String(row['id']),
        at: Number(row['at']),
        type: String(row['type']),
        category: row['category'] as AuditRow['category'],
        severity: row['severity'] as AuditRow['severity'],
        actorId: (row['actor_id'] as string | null) ?? null,
        message: String(row['message']),
        sessionId: (row['session_id'] as string | null) ?? null,
        evidenceId: (row['evidence_id'] as string | null) ?? null,
        deviceId: (row['device_id'] as string | null) ?? null,
        details: row['details'],
        prevHash: String(row['prev_hash']),
        hash: String(row['hash']),
      }) as AuditRow,
  );
  const { rows: heads } = await pool.query<{ seq: string; hash: string }>('SELECT seq, hash FROM audit_chain_head');
  return { rows: mapped, head: String(heads[0]?.hash), total: Number(mapped.at(-1)?.seq ?? 0), dropped: 0 };
}

/** The erasure ranges, read from the ledger — the judgement of boot check B-8 (migration 0036 4b). */
async function purgedRanges(pool: Pool): Promise<PurgedRange[]> {
  const { rows } = await pool.query<{ first_seq: string; last_seq: string }>('SELECT first_seq, last_seq FROM public.audit_purge_log ORDER BY first_seq');
  return rows.map((row) => ({ from: Number(row.first_seq), to: Number(row.last_seq) }));
}

async function countOf(pool: Pool, sql: string): Promise<number> {
  const { rows } = await pool.query<{ n: string }>(sql);
  return Number(rows[0]?.n ?? -1);
}

describe('the purge of an operator (0036, RB-9 as amended)', () => {
  it('erases the account and its own history, re-seals the chain, and keeps the unit records', async () => {
    // Two rows by root, three by the target, one more by root: the tail after the erasure is the
    // single last row, and it has to be sealed onto the row before the removed range.
    await appendAuditRows(app, 2, { actorId: ROOT, type: 'SIGN_IN', category: 'AUTH', message: 'root signed in' });
    await appendAuditRows(app, 3, { actorId: TARGET, type: 'SIGN_IN', category: 'AUTH', message: 'target signed in' });
    const before = await appendAuditRows(app, 1, { actorId: ROOT, type: 'SIGN_IN', category: 'AUTH', message: 'root again' });
    expect(before.seq).toBe(6);
    expect(await countOf(app, 'SELECT count(*)::text AS n FROM audit_log')).toBe(6);

    const report = await inTransaction(app, async (client) => {
      const forecast = await purgeForecast(client, TARGET);
      expect(forecast.auditRows).toBe(3);
      expect(forecast.resealFromSeq).toBe(3);
      const erased = await purgeOperator(client, TARGET, ROOT, 'Technician left the unit');
      expect(erased).toEqual(forecast);
      const seal = await resealChain(client, TARGET, erased.resealFromSeq);
      return { seal, forecast };
    });
    expect(report.seal).toEqual({ rows: 1, headSeq: 6 });

    // The account and everything that belonged to it.
    expect(await countOf(app, `SELECT count(*)::text AS n FROM operators WHERE id = '${TARGET}'`)).toBe(0);
    expect(await countOf(app, `SELECT count(*)::text AS n FROM operator_credentials WHERE operator_id = '${TARGET}'`)).toBe(0);
    expect(await countOf(app, `SELECT count(*)::text AS n FROM audit_log WHERE actor_id = '${TARGET}'`)).toBe(0);
    expect(await countOf(app, 'SELECT count(*)::text AS n FROM audit_log')).toBe(3);
    expect(await countOf(app, "SELECT count(*)::text AS n FROM audit_log WHERE seq IN (3,4,5)")).toBe(0);

    // The records of the unit are still there, only nobody is named by them any more.
    expect(await countOf(app, 'SELECT count(*)::text AS n FROM evidence_items')).toBe(1);
    expect(await countOf(app, 'SELECT count(investigator_id)::text AS n FROM evidence_items')).toBe(0);
    expect(await countOf(app, 'SELECT count(*)::text AS n FROM installation_acceptances')).toBe(1);
    expect(await countOf(app, 'SELECT count(accepted_by)::text AS n FROM installation_acceptances')).toBe(0);

    // The chain verifies, with the shared digest, over the rows that survived the erasure.
    const chain = await storedChain(app);
    // The hole at 3..5 is honest only because the ledger names it: the check is B-8's, ledger and all.
    const verdict = verifyAuditChain({ rows: chain.rows, head: chain.head, total: chain.total, dropped: 0 }, await purgedRanges(app));
    expect(verdict).toMatchObject({ ok: true });
    const { rows: heads } = await app.query<{ seq: string; hash: string }>('SELECT seq, hash FROM audit_chain_head');
    expect(Number(heads[0]?.seq)).toBe(6);
    expect(heads[0]?.hash).toBe(chain.rows.at(-1)?.hash);
  });

  it('answers a clean seal for an account that never wrote a row', async () => {
    await insertRow(owner, 'operators', operator('OPR-703', 'never.used', 'INVESTIGATOR'));
    const seal = await inTransaction(app, async (client) => {
      const erased = await purgeOperator(client, 'OPR-703', ROOT, 'Created by mistake');
      expect(erased.auditRows).toBe(0);
      expect(erased.resealFromSeq).toBeNull();
      return resealChain(client, 'OPR-703', erased.resealFromSeq);
    });
    // The empty seal answers the head as it stands (0036, the NULL branch): the chain still ends where it ended.
    expect(seal).toEqual({ rows: 0, headSeq: 6 });
    expect(await countOf(app, `SELECT count(*)::text AS n FROM operators WHERE id = 'OPR-703'`)).toBe(0);
    // untouched: the chain of the previous test still verifies, ledger included
    const chain = await storedChain(app);
    expect(verifyAuditChain({ rows: chain.rows, head: chain.head, total: chain.total, dropped: 0 }, await purgedRanges(app))).toMatchObject({ ok: true });
  });

  it('refuses a caller that is not the enabled vendor root account', async () => {
    await insertRow(owner, 'operators', operator('OPR-704', 'other.admin', 'SUPERVISOR'));
    // The caller is the one under test: OPR-704 holds USER_ADMIN but is not `root` — ZA003 before anything else.
    // (Fixed 2026-11-03: this call had target and actor swapped, which asked ROOT to purge OPR-704 — a
    // legitimate purge the function happily performed, erasing the account every later test needed.)
    await expectRefused(
      () => inTransaction(app, (client) => purgeOperator(client, 'OPR-704', 'OPR-704', 'no')),
      'ZA003',
    );
    // the root account cannot erase itself, and a nameless reason is not a reason
    await expectRefused(() => inTransaction(app, (client) => purgeOperator(client, ROOT, ROOT, 'myself')), 'ZA003');
    await expectRefused(() => inTransaction(app, (client) => purgeOperator(client, 'OPR-704', ROOT, '   ')), '22023');
    await expectRefused(() => inTransaction(app, (client) => purgeOperator(client, 'OPR-999', ROOT, 'ghost')), 'P0002');
    expect(await countOf(app, `SELECT count(*)::text AS n FROM operators WHERE id IN ('OPR-704','${ROOT}')`)).toBe(2);
  });

  it('refuses the last enabled holder of user administration (RB-8)', async () => {
    // Only the target holds the permission now: every other enabled operator loses it.
    await inTransaction(owner, async (client) => {
      await client.query(`UPDATE operators SET role_id = 'INVESTIGATOR' WHERE id <> 'OPR-704'`);
      await client.query(`UPDATE operators SET role_id = 'SUPERVISOR' WHERE id = 'OPR-704'`);
    });
    await expectRefused(() => inTransaction(app, (client) => purgeOperator(client, 'OPR-704', ROOT, 'last one')), 'ZA005');
    expect(await countOf(app, `SELECT count(*)::text AS n FROM operators WHERE id = 'OPR-704'`)).toBe(1);
  });

  it('gives the runtime role no way around the two functions', async () => {
    // The ticket table that opens the append-only guards is not reachable by the server at all.
    await expectRefused(() => app.query('SELECT count(*)::text AS n FROM audit_purge_ticket'), SQLSTATE.insufficientPrivilege);
    await expectRefused(
      () => app.query("INSERT INTO audit_purge_ticket (operator_id, reseal_from, xact_id) VALUES ('OPR-704', NULL, pg_current_xact_id())"),
      SQLSTATE.insufficientPrivilege,
    );
    // and a re-seal without a purge in the same transaction is refused outright
    await expectRefused(() => inTransaction(app, (client) => client.query('SELECT public.audit_purge_reseal($1, $2::jsonb)', ['OPR-704', '[]'])), 'ZA003');
  });

  it('refuses a re-seal that misremembers the rows it seals', async () => {
    // The previous test demoted every other operator for its RB-8 setup: give the root its role back,
    // or the purge itself would refuse with ZA005 before the false seal is ever reached.
    await owner.query(`UPDATE public.operators SET role_id = 'SUPERVISOR' WHERE id = '${ROOT}'`);
    await appendAuditRows(app, 2, { actorId: 'OPR-704', type: 'SIGN_IN', category: 'AUTH', message: 'second target' });
    await expectRefused(
      () =>
        inTransaction(app, async (client) => {
          await purgeOperator(client, 'OPR-704', ROOT, 'left');
          // the tail is sealed with a message the rows do not hold
          return client.query('SELECT public.audit_purge_reseal($1, $2::jsonb)', [
            'OPR-704',
            JSON.stringify([{ seq: 999, id: 'AUD-000999', at: 1, type: 'SIGN_IN', category: 'AUTH', severity: 'INFO', actorId: null, message: 'a fact nobody wrote', sessionId: null, evidenceId: null, deviceId: null, details: {}, prevHash: '0'.repeat(64), hash: '1'.repeat(64) }]),
          ]);
        }),
      'ZA006',
    );
    // the rollback of that unit leaves the account in place: nothing was erased on the way out
    expect(await countOf(app, `SELECT count(*)::text AS n FROM operators WHERE id = 'OPR-704'`)).toBe(1);
    expect(await countOf(app, `SELECT count(*)::text AS n FROM audit_log WHERE actor_id = 'OPR-704'`)).toBe(2);
    const chain = await storedChain(app);
    expect(verifyAuditChain({ rows: chain.rows, head: chain.head, total: chain.total, dropped: 0 }, await purgedRanges(app))).toMatchObject({ ok: true });
  });
});

// Row 94 (DF-27, decision D21(3)): the purge re-seals the chain in the database. Before this row the
// engine merged the purge unit's announcement with its pre-seal hash, and its next write found the
// stored head foreign: two level-50 `AUDIT_HEAD_DIVERGED` lines, `setReady(false)`, `endLive()` and a
// reload under whatever was running. Here the purge runs through operation 17's own unit while the
// hosted engine records, on a clone of its own (the clone above holds raw fixtures, not a scenario).
// NEVER run on production: a purge is permanent (D12; R14 §3.4(c)).
describe('row 94: a purge while the engine records (DF-27, D21(3))', () => {
  it('the engine takes the re-sealed head: no AUDIT_HEAD_DIVERGED, no reload, no not-ready moment, and the recording goes on', async () => {
    const lane = await db.another({ template: 'schema', slug: 'purge_live_engine' });
    await seedScenario(lane, 'recording');
    const laneOwner = lane.ownerPool();
    const host = await engineApp(lane, db.run.dataDir);
    await host.engine.reload();
    await host.drive(1_000);

    // The live recording, and an account that is not its investigator.
    const session = host.engine.slice('session');
    expect(session?.state).toBe('RECORDING');
    const { rows: active } = await laneOwner.query<{ investigator_id: string }>('SELECT investigator_id FROM public.active_session');
    const target = OPERATOR_IDS.RINA;
    const rootId = OPERATOR_IDS.ANDI;
    expect(active.map((row) => row.investigator_id)).not.toContain(target);
    expect(active.map((row) => row.investigator_id)).not.toContain(rootId);
    // The vendor root is an identity: the seeded SUPERVISOR renamed, as the vendor-trio file does.
    await laneOwner.query('UPDATE public.operators SET username = $2 WHERE id = $1', [rootId, 'root']);
    // A history of the target, written through the core's writer while the engine runs: rows the ring merges.
    await host.app.pipeline.run('test.history', (unit) =>
      unit.audit.appendMany([
        { type: 'AUTH_SUCCESS', message: 'Signed in.', actorId: target, deviceId: null, details: { method: 'PASSWORD' } },
        { type: 'AUTH_SUCCESS', message: 'Signed in.', actorId: target, deviceId: null, details: { method: 'PASSWORD' } },
      ]),
    );
    await host.drive(1_000);
    expect(host.engine.slice('audit').rows.some((row) => row.actorId === target)).toBe(true);

    const epochBefore = host.engine.epoch;
    const logFrom = host.log.lines().length;
    const changesFrom = stateChanges(host.publications).length;

    const outcome = await deleteUser(host.app, { operatorId: rootId, deviceId: null }, target, { confirm: 'rina.wijaya' }, 'DF-27 lane test');
    expect(outcome.changed).toBe(true);
    await host.app.pipeline.drain();

    // At once, before any tick: the engine holds the head the tables hold, and none of the erased rows.
    const sealed = await readHead(laneOwner);
    expect(host.engine.slice('audit')).toMatchObject({ head: sealed.hash, total: sealed.seq });
    expect(host.engine.slice('audit').rows.some((row) => row.actorId === target)).toBe(false);

    // Twenty seconds of recording: the engine writes, and every write checks the stored head first (AP-6).
    await host.drive(20_000);
    expect(stateChanges(host.publications).slice(changesFrom).some((change) => change.cause === 'tick')).toBe(true);

    // No reload: the same epoch; no divergence and no reload line; ready throughout.
    expect(host.engine.epoch).toBe(epochBefore);
    expect(host.engine.running).toBe(true);
    expect(host.app.readiness.snapshot().engine).toBe(true);
    const lines = host.log.lines().slice(logFrom);
    expect(lines.filter((line) => line['code'] === 'AUDIT_HEAD_DIVERGED')).toEqual([]);
    expect(lines.filter((line) => typeof line['msg'] === 'string' && /reloading from the database|engine started|engine stopped/.test(line['msg']))).toEqual([]);
    expect(lines.filter((line) => line['msg'] === 'the engine took the re-sealed audit chain')).toHaveLength(1);

    // The live session survives: the same session, still recording.
    expect(host.engine.slice('session')).toMatchObject({ id: session?.id, state: 'RECORDING' });

    // The chain the engine extended after the purge verifies with the ledger (boot check B-8's judgement),
    // and the engine's head is still the stored one.
    const chain = await storedChain(laneOwner);
    expect(verifyAuditChain({ rows: chain.rows, head: chain.head, total: chain.total, dropped: 0 }, await purgedRanges(laneOwner))).toMatchObject({ ok: true });
    const after = await readHead(laneOwner);
    expect(host.engine.slice('audit')).toMatchObject({ head: after.hash, total: after.seq });
  }, 300_000);
});

// Row 95 (DF-28; decisions D22(4), D38 DR-1, D43; migration 0043): the purge keeps the evidence-chain
// audit types, re-seals from the first REMOVED row, keeps the account row (disabled) while a kept row
// names it, and refuses a party of the active session before any write. A lane of its own, so the
// sequence numbers below are exact. NEVER run on production: a purge is permanent (R14 section 3.4(c)).
describe('row 95: the purge scope of 0043 (DF-28, D22(4), D38 DR-1, D43)', () => {
  const KEEPER = 'OPR-711';
  const NOTHING_PERSONAL = 'OPR-712';
  const PARTY = 'OPR-713';
  const LANE_ROOT = 'OPR-719';
  let lane: Pool;
  let laneOwner: Pool;

  beforeAll(async () => {
    const clone = await db.another({ template: 'schema', slug: 'purge_scope' });
    lane = clone.appPool();
    laneOwner = clone.ownerPool();
    await insertRbac(laneOwner);
    await insertRow(laneOwner, 'operators', operator(LANE_ROOT, 'root', 'SUPERVISOR'));
    await insertRow(laneOwner, 'operators', operator(KEEPER, 'keeps.evidence', 'INVESTIGATOR'));
    await insertRow(laneOwner, 'operators', operator(NOTHING_PERSONAL, 'only.evidence', 'INVESTIGATOR'));
    await insertRow(laneOwner, 'operators', operator(PARTY, 'in.session', 'INVESTIGATOR'));
    await insertRow(laneOwner, 'operator_credentials', operatorCredential(KEEPER));
  });

  it('the TypeScript kept list is the one the function applies (28 types)', () => {
    expect(PURGE_KEPT_AUDIT_TYPES).toHaveLength(28);
  });

  it('kept types survive, the re-seal starts at the first removed row, the account stays disabled, and B-8 passes', async () => {
    // 1-2 root; 3 personal; 4 kept; 5 personal; 6 kept; 7 personal; 8 root.
    await appendAuditRows(lane, 2, { actorId: LANE_ROOT, type: 'AUTH_SUCCESS', category: 'AUTH', message: 'root signed in' });
    await appendAuditRows(lane, 1, { actorId: KEEPER, type: 'AUTH_SUCCESS', category: 'AUTH', message: 'keeper signed in' });
    await appendAuditRows(lane, 1, { actorId: KEEPER, type: 'SESSION_CREATED', category: 'SESSION', message: 'session created' });
    await appendAuditRows(lane, 1, { actorId: KEEPER, type: 'AUTH_SUCCESS', category: 'AUTH', message: 'keeper signed in' });
    await appendAuditRows(lane, 1, { actorId: KEEPER, type: 'EVIDENCE_EXPORTED', category: 'EVIDENCE', message: 'evidence exported' });
    await appendAuditRows(lane, 1, { actorId: KEEPER, type: 'AUTH_SUCCESS', category: 'AUTH', message: 'keeper signed in' });
    const head = await appendAuditRows(lane, 1, { actorId: LANE_ROOT, type: 'AUTH_SUCCESS', category: 'AUTH', message: 'root again' });
    expect(head.seq).toBe(8);

    const report = await inTransaction(lane, async (client) => {
      const forecast = await purgeForecast(client, KEEPER);
      expect(forecast).toMatchObject({ auditRows: 3, resealFromSeq: 3, accountKept: true, lineageRows: 0, credentialsRemoved: 1, activeSessions: 0 });
      const erased = await purgeOperator(client, KEEPER, LANE_ROOT, 'Investigator left the unit');
      // The forecast counts exactly what the SQL deleted (E6): `samePurge` relies on it.
      expect(erased).toEqual(forecast);
      const seal = await resealChain(client, KEEPER, erased.resealFromSeq);
      return { seal };
    });
    // Rows 4, 6 and 8 sit above the first removed row and are sealed again.
    expect(report.seal).toEqual({ rows: 3, headSeq: 8 });

    // The kept rows are there, with their actor; the personal rows are gone.
    const { rows: kept } = await lane.query<{ seq: string; type: string; actor_id: string }>(`SELECT seq, type, actor_id FROM audit_log WHERE actor_id = '${KEEPER}' ORDER BY seq`);
    expect(kept.map((row) => [Number(row.seq), row.type])).toEqual([[4, 'SESSION_CREATED'], [6, 'EVIDENCE_EXPORTED']]);
    expect(await countOf(lane, 'SELECT count(*)::text AS n FROM audit_log WHERE seq IN (3,5,7)')).toBe(0);
    expect(await countOf(lane, 'SELECT count(*)::text AS n FROM audit_log')).toBe(5);

    // D38 DR-1: the account row stays, disabled; its credential is gone.
    const { rows: account } = await lane.query<{ enabled: boolean }>(`SELECT enabled FROM operators WHERE id = '${KEEPER}'`);
    expect(account).toEqual([{ enabled: false }]);
    expect(await countOf(lane, `SELECT count(*)::text AS n FROM operator_credentials WHERE operator_id = '${KEEPER}'`)).toBe(0);

    // The ledger names first..last REMOVED row; the kept rows inside it are present and chained.
    const ranges = await purgedRanges(lane);
    expect(ranges).toEqual([{ from: 3, to: 7 }]);
    const chain = await storedChain(lane);
    expect(verifyAuditChain({ rows: chain.rows, head: chain.head, total: chain.total, dropped: 0 }, ranges)).toMatchObject({ ok: true });
    const { rows: heads } = await lane.query<{ seq: string; hash: string }>('SELECT seq, hash FROM audit_chain_head');
    expect(Number(heads[0]?.seq)).toBe(8);
    expect(heads[0]?.hash).toBe(chain.rows.at(-1)?.hash);
  });

  it('an account that wrote only kept rows: nothing removed, nothing sealed, no ledger row, the account kept disabled', async () => {
    await appendAuditRows(lane, 1, { actorId: NOTHING_PERSONAL, type: 'EVIDENCE_SEALED', category: 'EVIDENCE', message: 'evidence sealed' });
    const ledgerBefore = (await purgedRanges(lane)).length;
    const seal = await inTransaction(lane, async (client) => {
      const forecast = await purgeForecast(client, NOTHING_PERSONAL);
      const erased = await purgeOperator(client, NOTHING_PERSONAL, LANE_ROOT, 'Moved to another unit');
      expect(erased).toEqual(forecast);
      expect(erased).toMatchObject({ auditRows: 0, resealFromSeq: null, accountKept: true });
      return resealChain(client, NOTHING_PERSONAL, erased.resealFromSeq);
    });
    expect(seal).toEqual({ rows: 0, headSeq: 9 });
    expect((await purgedRanges(lane)).length).toBe(ledgerBefore);
    expect(await countOf(lane, `SELECT count(*)::text AS n FROM operators WHERE id = '${NOTHING_PERSONAL}' AND NOT enabled`)).toBe(1);
    const chain = await storedChain(lane);
    expect(verifyAuditChain({ rows: chain.rows, head: chain.head, total: chain.total, dropped: 0 }, await purgedRanges(lane))).toMatchObject({ ok: true });
  });

  it('D43: a party of the active session is refused (ZA007) before any write, whichever column names it', async () => {
    await appendAuditRows(lane, 1, { actorId: PARTY, type: 'AUTH_SUCCESS', category: 'AUTH', message: 'party signed in' });
    const rowsBefore = await countOf(lane, 'SELECT count(*)::text AS n FROM audit_log');
    for (const column of ['investigator_id', 'created_by', 'started_by', 'stopped_by'] as const) {
      await laneOwner.query('DELETE FROM active_session');
      await insertRow(laneOwner, 'active_session', activeSession({ investigator_id: LANE_ROOT, created_by: null, [column]: PARTY }));
      await expectRefused(() => inTransaction(lane, (client) => purgeOperator(client, PARTY, LANE_ROOT, 'under a recording')), 'ZA007');
      expect(await countOf(lane, 'SELECT count(*)::text AS n FROM active_session'), column).toBe(1);
      expect(await countOf(lane, `SELECT count(*)::text AS n FROM operators WHERE id = '${PARTY}' AND enabled`), column).toBe(1);
      expect(await countOf(lane, 'SELECT count(*)::text AS n FROM audit_log'), column).toBe(rowsBefore);
    }
    // Positive control: once the session no longer names it, the same purge runs.
    await laneOwner.query('DELETE FROM active_session');
    await insertRow(laneOwner, 'active_session', activeSession({ investigator_id: LANE_ROOT, created_by: LANE_ROOT }));
    const erased = await inTransaction(lane, async (client) => {
      const done = await purgeOperator(client, PARTY, LANE_ROOT, 'after the session');
      await resealChain(client, PARTY, done.resealFromSeq);
      return done;
    });
    expect(erased).toMatchObject({ auditRows: 1, activeSessions: 0, accountKept: false });
    expect(await countOf(lane, 'SELECT count(*)::text AS n FROM active_session')).toBe(1);
    expect(await countOf(lane, `SELECT count(*)::text AS n FROM operators WHERE id = '${PARTY}'`)).toBe(0);
  });
});

// Row 95 (D43) through operation 17's own unit on a hosted engine: the investigator of the live
// recording cannot be purged; the refusal is 409 before any write and the recording goes on.
describe('row 95: a purge of the live session\'s investigator is refused (D43)', () => {
  it('409 INVALID_STATE, nothing deleted, no session ended, the recording goes on', async () => {
    const lane = await db.another({ template: 'schema', slug: 'purge_live_party' });
    await seedScenario(lane, 'recording');
    const laneOwner = lane.ownerPool();
    const host = await engineApp(lane, db.run.dataDir);
    await host.engine.reload();
    await host.drive(1_000);
    const session = host.engine.slice('session');
    expect(session?.state).toBe('RECORDING');
    const { rows: active } = await laneOwner.query<{ investigator_id: string }>('SELECT investigator_id FROM public.active_session');
    const investigator = active[0]?.investigator_id ?? '';
    expect(investigator).toBe(OPERATOR_IDS.BUDI);
    const rootId = OPERATOR_IDS.ANDI;
    await laneOwner.query('UPDATE public.operators SET username = $2 WHERE id = $1', [rootId, 'root']);
    const auditBefore = await countOf(laneOwner, 'SELECT count(*)::text AS n FROM audit_log');

    const refusal = await deleteUser(host.app, { operatorId: rootId, deviceId: null }, investigator, { confirm: 'budi.santoso' }, 'D43 lane test').then(
      () => null,
      (error: unknown) => error as { statusCode?: number; code?: string; details?: Record<string, unknown> },
    );
    expect(refusal).toMatchObject({ statusCode: 409, code: 'INVALID_STATE', details: { reason: 'ACTIVE_SESSION_PARTY', sessionId: session?.id } });
    await host.app.pipeline.drain();

    expect(await countOf(laneOwner, `SELECT count(*)::text AS n FROM operators WHERE id = '${investigator}' AND enabled`)).toBe(1);
    expect(await countOf(laneOwner, 'SELECT count(*)::text AS n FROM active_session')).toBe(1);
    expect(await countOf(laneOwner, 'SELECT count(*)::text AS n FROM public.audit_purge_log')).toBe(0);
    await host.drive(5_000);
    expect(await countOf(laneOwner, 'SELECT count(*)::text AS n FROM audit_log')).toBeGreaterThanOrEqual(auditBefore);
    expect(host.engine.slice('session')).toMatchObject({ id: session?.id, state: 'RECORDING' });
    expect(host.app.readiness.snapshot().engine).toBe(true);
  }, 300_000);
});
