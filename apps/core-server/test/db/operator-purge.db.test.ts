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
import { verifyAuditChain, type AuditLogSlice, type PurgedRange, type AuditRow } from '@dems/shared/sim';
import type { Pool } from 'pg';
import { beforeAll, describe, expect, it } from 'vitest';
import { purgeForecast, purgeOperator, resealChain } from '../../src/modules/admin/statements';
import { useTestDatabase } from '../helpers/db';
import {
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
