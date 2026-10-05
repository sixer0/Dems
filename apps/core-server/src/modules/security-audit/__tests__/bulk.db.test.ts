// The security-audit module at the volume of the bulk template: 5,000 audit rows, 3,649 events,
// 25 lineage rows (plan row W39; spec §7.1 API-9, §7.13; database contract §4.12, §4.14, §4.30,
// §11; decision D73 DN-1 and DN-6; finding F68; module gate MODG).
//
// The real app, booted on a clone of `tpl_bulk`, with the clock at the template's instant. The
// operators are the SEEDED ones (no fixture operator can sign in). Every list is paged and
// asserted by `seq`, never by a row's `at` (in sequence order `at` descends once), and nothing is
// asserted about the details of the fixture's ROLE_CHANGED, USER_DISABLED and USER_ENABLED rows.
//
// The tests run in order: the full verification is the first call of the chain operation.
import { LIST_CURSOR_PATTERN, validateCoreApiResponse, type AuditChainStatus, type AuditExportAccepted, type AuditPage, type SecurityStatus } from '@dems/shared/api';
import { AuditCategory, AuditType, Severity, SimEventCategory, verifyAuditChain, type AuditRow } from '@dems/shared/sim';
import type { Pool } from 'pg';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { useTestDatabase } from '../../../../test/helpers/db';
import { readEvents, readTrail } from '../../../../test/support/core';
import { BULK_TEMPLATE_NOW } from '../../../db/fixtures/__tests__/template-hook.bulk';
import { auditRowToRow, verifyStoredAuditRows } from '../../../db/mapping';
import { lineageRows } from '../../../../test/support/reset';
import {
  AUDIT,
  AUDIT_CHAIN,
  AUDIT_EXPORT,
  SECURITY_STATUS,
  auditApp,
  chainReads,
  countOf,
  onTheWire,
  secretFindings,
  storedHead,
  walkAudit,
  walkEvents,
  type AuditApp,
  type Headers,
} from './support';

const db = useTestDatabase({ template: 'bulk' });
let host: AuditApp;
let owner: Pool;
let investigator: Headers;
let supervisor: Headers;
let technician: Headers;
/** Stored audit rows once the app has booted and the three operators have signed in. */
let rowsAtStart: number;

beforeAll(async () => {
  owner = db.ownerPool();
  host = await auditApp(db, db.run.dataDir, { startAt: BULK_TEMPLATE_NOW });
  investigator = await host.signIn('INVESTIGATOR');
  supervisor = await host.signIn('SUPERVISOR');
  technician = await host.signIn('TECHNICIAN');
  await host.app.pipeline.drain();
  rowsAtStart = (await storedHead(owner)).seq;
}, 180_000);

beforeEach(() => {
  host.forgetCounters();
});

const stored = async (): Promise<AuditRow[]> => onTheWire(await readTrail(owner));
const seqs = (rows: readonly { seq: number }[]): number[] => rows.map((row) => row.seq);
const range = (from: number, to: number): number[] => Array.from({ length: to - from + 1 }, (_, index) => from + index);

describe('the bulk template: what is stored and what the engine holds', () => {
  it('5,000 fixture audit rows and the rows of the boot and the sign-ins; 3,649 events; 25 lineage rows; the engine\'s rings hold 1,000 and 500', async () => {
    expect(rowsAtStart).toBeGreaterThanOrEqual(5_000);
    expect(rowsAtStart).toBeLessThan(5_020);
    expect(await countOf(owner, 'audit_log', 'seq <= 5000')).toBe(5_000);
    expect(await countOf(owner, 'events')).toBeGreaterThanOrEqual(3_649);
    expect(await countOf(owner, 'audit_chain_history')).toBe(25);
    expect(host.engine.slice('audit').rows).toHaveLength(1_000);
    expect(host.engine.slice('audit').total).toBe(rowsAtStart);
    expect(host.engine.slice('events')).toHaveLength(500);
    console.info(`[w39] bulk clone after boot and three sign-ins: ${rowsAtStart} audit rows stored, ${host.engine.slice('audit').rows.length} in the engine's ring; ${await countOf(owner, 'events')} events stored, ${host.engine.slice('events').length} in the ring; 25 lineage rows`);
  });

  it('in sequence order `at` descends exactly once: the reason every assertion here goes by seq', async () => {
    const trail = await readTrail(owner);
    const descents = trail.filter((row, index) => index > 0 && row.at < (trail[index - 1]?.at ?? 0)).map((row) => row.seq);
    expect(descents).toEqual([84]);
  });
});

describe('operation 60 at volume: the full verification, measured', () => {
  it('the first call verifies ALL stored rows in one pass: view over the ring of 1,000, stored over the table, the newest 20 of 25 lineage rows', async () => {
    const head = await storedHead(owner);
    const from = host.database.statements.length;
    const began = performance.now();
    const response = await host.get(AUDIT_CHAIN, investigator);
    const elapsed = performance.now() - began;
    expect(response.statusCode).toBe(200);
    const status: AuditChainStatus = response.json();
    expect(validateCoreApiResponse('verifyAuditChain', 200, status)).toEqual({ ok: true });
    expect(status.view).toEqual({ ok: true, checked: 1_000, head: head.hash });
    expect(status.stored).toEqual({ ok: true, checked: head.seq, head: head.hash, firstBadSeq: null });
    expect(chainReads(host.database.statements, from)).toEqual([head.seq]);
    expect(host.chainStats()).toMatchObject({ fullPasses: 1, incrementalPasses: 0, rowsRead: head.seq, verifiedThrough: head.seq });
    // LN-3 holds on the fixture: the stored check logged no lineage warning.
    expect(host.log.lines().filter((line) => line['code'] === 'LINEAGE_MISMATCH')).toEqual([]);

    // The parts, measured apart: the one digest check over the same rows, and a call that has nothing to verify.
    const rows = (await readTrail(owner)).map(auditRowToRow);
    const digestStart = performance.now();
    expect(verifyStoredAuditRows(rows, { dropped: 0, head: head.hash })).toEqual({ ok: true });
    const digestMs = performance.now() - digestStart;
    const againStart = performance.now();
    await host.get(AUDIT_CHAIN, investigator);
    const againMs = performance.now() - againStart;
    console.info(
      `[w39] full verification of ${head.seq} stored rows: the whole call ${elapsed.toFixed(0)} ms (view over 1,000 ring rows, stored over ${head.seq}, lineage); ` +
        `the digest check alone over ${rows.length} rows ${digestMs.toFixed(0)} ms (synchronous); the same call with nothing to verify ${againMs.toFixed(0)} ms`,
    );
    // A bound an operator would notice, not a benchmark: the pass is one statement and one loop.
    expect(elapsed).toBeLessThan(5_000);
  });

  it('the lineage: 25 chains were discarded; the answer holds the newest 20, newest first, and lineageTotal 25', async () => {
    const status: AuditChainStatus = (await host.get(AUDIT_CHAIN, supervisor)).json();
    expect(status.lineageTotal).toBe(25);
    expect(status.lineage).toHaveLength(20);
    const storedLineage = await lineageRows(owner);
    expect(storedLineage.map((row) => Number(row.reset_no))).toEqual(range(1, 25));
    const newest20 = [...storedLineage].reverse().slice(0, 20);
    expect(newest20.map((row) => Number(row.reset_no))).toEqual(range(6, 25).reverse());
    expect(status.lineage).toStrictEqual(
      newest20.map((row) => ({
        epoch: Number(row.epoch),
        rows: Number(row.row_count),
        head: row.head_hash,
        resetAt: Number(row.reset_at),
        actorId: row.actor_id,
        scenario: row.scenario,
        reason: row.reason,
      })),
    );
    // Newest first by the order of the resets: the epochs descend.
    const epochs = status.lineage.map((entry) => entry.epoch);
    expect(epochs).toEqual([...epochs].sort((a, b) => b - a));
    expect(new Set(epochs).size).toBe(20);
    console.info(`[w39] bulk lineage: ${storedLineage.length} stored, ${status.lineage.length} returned (reset numbers 25 down to 6), lineageTotal ${status.lineageTotal}`);
  });

  it('after k appended rows a call reads exactly k of the 5,000+: 7, then 1, then none', async () => {
    for (const k of [7, 1, 0]) {
      if (k > 0) await host.appendRows(k);
      const from = host.database.statements.length;
      const began = performance.now();
      const status: AuditChainStatus = (await host.get(AUDIT_CHAIN, technician)).json();
      const elapsed = performance.now() - began;
      expect(status.stored.ok).toBe(true);
      expect(status.stored.checked).toBe((await storedHead(owner)).seq);
      expect(chainReads(host.database.statements, from)).toEqual(k === 0 ? [] : [k]);
      console.info(`[w39] bulk, incremental: ${k} appended -> ${k} audit row(s) read, the whole call ${elapsed.toFixed(0)} ms`);
    }
  });
});

describe('operation 59 at volume: THE PAGING PROOF', () => {
  it('ASCENDING, while rows are appended: every original row exactly once, in chain order, and a tail that is the appended rows, gap-free up to the head of the last page', async () => {
    const original = await stored();
    const n0 = original.length;
    let appended = 0;
    const pages = await walkAudit(host, investigator, '?limit=200', async (_page, index) => {
      // During the first ten pages: three rows through a unit of work after each page, and on
      // every second page one more through the engine (a hosted command).
      if (index >= 10) return;
      await host.appendRows(3);
      appended += 3;
      if (index % 2 === 0) {
        await host.engine.command(host.principal('SUPERVISOR'), 'exportAudit', { reason: 'Appended while a client pages' });
        appended += 1;
      }
    });
    const walked = pages.flatMap((page) => page.rows);
    expect(appended).toBe(35);

    // Every row once: the sequences are 1, 2, 3, ... without a gap and without a repeat.
    expect(seqs(walked)).toEqual(range(1, walked.length));
    // Every ORIGINAL row, equal to the stored row, member by member.
    expect(walked.slice(0, n0)).toStrictEqual(original);
    // The tail: exactly the rows appended meanwhile, and the walk ends ON the head of its last page.
    expect(walked.length).toBe(n0 + appended);
    expect(walked).toStrictEqual(await stored());
    const last = pages.at(-1);
    expect(last?.nextCursor).toBeNull();
    expect(last?.rows.length).toBeGreaterThan(0);
    expect(walked.at(-1)).toMatchObject({ seq: last?.total, hash: last?.head });
    // Full pages until the last; the total a page reports never falls and is never below a row it shows.
    expect(pages.slice(0, -1).every((page) => page.rows.length === 200)).toBe(true);
    for (const [index, page] of pages.entries()) {
      expect(page.total).toBeGreaterThanOrEqual(pages[index - 1]?.total ?? 0);
      expect(page.rows.at(-1)?.seq).toBeLessThanOrEqual(page.total);
      expect(validateCoreApiResponse('listAuditRows', 200, page)).toEqual({ ok: true });
      if (page.nextCursor !== null) expect(page.nextCursor).toMatch(LIST_CURSOR_PATTERN);
    }
    // The client's own chain check over ALL rows it received: from the genesis hash to the head.
    expect(verifyAuditChain({ rows: walked, head: last?.head ?? '', total: last?.total ?? 0, dropped: 0 })).toEqual({ ok: true, checked: walked.length, head: last?.head });
    console.info(`[w39] paging proof, ASC: ${n0} rows at the start, ${appended} appended during the walk; ${pages.length} pages of 200 returned ${walked.length} rows, sequences 1..${walked.length} each once; totals reported ${pages[0]?.total} -> ${last?.total}`);
  });

  it('DESCENDING, while rows are appended: exactly the rows that existed at the first page, newest first, each once; rows appended later lie before the first page', async () => {
    const original = await stored();
    const n0 = original.length;
    const pages = await walkAudit(host, supervisor, '?order=DESC&limit=200', async (_page, index) => {
      if (index < 8) await host.appendRows(5);
    });
    const walked = pages.flatMap((page) => page.rows);
    expect(seqs(walked)).toEqual(range(1, n0).reverse());
    expect(walked).toStrictEqual([...original].reverse());
    expect(pages.at(-1)?.nextCursor).toBeNull();
    expect(pages[0]?.total).toBe(n0);
    expect(pages.at(-1)?.total).toBe(n0 + 40);
    console.info(`[w39] paging proof, DESC: ${n0} rows at the first page, 40 appended during the walk; ${pages.length} pages returned sequences ${n0}..1 each once; totals reported ${pages[0]?.total} -> ${pages.at(-1)?.total}`);
  });

  it('a walk over a count that is an exact multiple of the page size ends on a FULL page without a cursor: no empty page', async () => {
    const head = await storedHead(owner);
    await host.appendRows(200 - (head.seq % 200));
    const count = (await storedHead(owner)).seq;
    expect(count % 200).toBe(0);
    const pages = await walkAudit(host, investigator, '?limit=200');
    expect(pages).toHaveLength(count / 200);
    expect(pages.every((page) => page.rows.length === 200)).toBe(true);
    expect(pages.at(-1)?.nextCursor).toBeNull();
    expect(seqs(pages.flatMap((page) => page.rows))).toEqual(range(1, count));
    console.info(`[w39] ${count} rows = ${pages.length} full pages of 200; the last page has no cursor and no page is empty`);
  });

  it('other page sizes give the same list: 199 (whole walk) and 1, 7, 50 (the default) for the first pages and across the ring\'s edge', async () => {
    const trail = await stored();
    expect((await walkAudit(host, technician, '?limit=199')).flatMap((page) => page.rows)).toStrictEqual(trail);
    const first: AuditPage = (await host.get(AUDIT, investigator)).json();
    expect(first.rows).toStrictEqual(trail.slice(0, 50));
    // Rows that are NOT in the engine's ring any more (the ring starts above them) are still listed.
    const ringStart = host.engine.slice('audit').rows[0]?.seq ?? 0;
    expect(ringStart).toBeGreaterThan(4_000);
    let cursor = first.nextCursor;
    for (const limit of [1, 7, 1, 7]) {
      const page: AuditPage = (await host.get(`${AUDIT}?limit=${limit}&cursor=${cursor}`, investigator)).json();
      const from = (page.rows[0]?.seq ?? 0) - 1;
      expect(page.rows).toStrictEqual(trail.slice(from, from + limit));
      cursor = page.nextCursor;
    }
    expect(seqs((await host.get(`${AUDIT}?limit=1&cursor=${cursor}`, investigator)).json().rows)).toEqual([67]);
  });

  it('the filters at volume: category, type, actor, session and evidence give exactly the stored rows that match, in both orders', async () => {
    const trail = await stored();
    const counts: Record<string, number> = {};
    for (const category of Object.values(AuditCategory)) {
      const rows = (await walkAudit(host, investigator, `?category=${category}&limit=200`)).flatMap((page) => page.rows);
      expect(seqs(rows), category).toEqual(seqs(trail.filter((row) => row.category === category)));
      counts[category] = rows.length;
    }
    expect(Object.values(counts).reduce((sum, count) => sum + count, 0)).toBe(trail.length);
    expect(Object.values(counts).every((count) => count > 0)).toBe(true);

    const withSession = trail.find((row) => row.sessionId !== null && row.seq > 2_000)?.sessionId ?? '';
    const withEvidence = trail.find((row) => row.evidenceId !== null && row.seq > 2_000)?.evidenceId ?? '';
    const cases: ReadonlyArray<readonly [query: string, keep: (row: AuditRow) => boolean]> = [
      [`type=${AuditType.FRAME_HASH}`, (row) => row.type === 'FRAME_HASH'],
      [`type=${AuditType.AUTH_SUCCESS}&actorId=OPR-002`, (row) => row.type === 'AUTH_SUCCESS' && row.actorId === 'OPR-002'],
      ['actorId=OPR-001', (row) => row.actorId === 'OPR-001'],
      [`sessionId=${withSession}`, (row) => row.sessionId === withSession],
      [`evidenceId=${withEvidence}`, (row) => row.evidenceId === withEvidence],
      [`category=${AuditCategory.EVIDENCE}&order=DESC`, (row) => row.category === 'EVIDENCE'],
    ];
    for (const [query, keep] of cases) {
      const rows = (await walkAudit(host, supervisor, `?${query}&limit=120`)).flatMap((page) => page.rows);
      const expected = seqs(trail.filter(keep));
      expect(seqs(rows), query).toEqual(query.includes('DESC') ? expected.reverse() : expected);
      expect(rows.length, query).toBeGreaterThan(0);
    }
    console.info(`[w39] bulk, audit rows by category: ${JSON.stringify(counts)}`);
  });
});

describe('operation 63 at volume', () => {
  it('a walk in pages of 200 returns every stored event once, by seq, although the engine\'s ring holds 500', async () => {
    const all = await readEvents(owner);
    const pages = await walkEvents(host, investigator, '?limit=200');
    const walked = pages.flatMap((page) => page.events);
    expect(walked).toStrictEqual(onTheWire(all.map(({ category: _category, ...event }) => event)));
    expect(seqs(walked)).toEqual(seqs(all));
    expect(new Set(seqs(walked)).size).toBe(all.length);
    expect(pages.at(-1)?.nextCursor).toBeNull();
    expect(pages.at(-1)?.events.length).toBeGreaterThan(0);
    for (const page of pages) expect(validateCoreApiResponse('listEvents', 200, page)).toEqual({ ok: true });
    console.info(`[w39] bulk events: ${all.length} stored, walked in ${pages.length} pages of 200, each once`);
  });

  it('the three filters at volume give exactly the stored events that match', async () => {
    const all = await readEvents(owner);
    for (const category of Object.values(SimEventCategory)) {
      const events = (await walkEvents(host, supervisor, `?category=${category}&limit=200`)).flatMap((page) => page.events);
      expect(seqs(events), category).toEqual(seqs(all.filter((event) => event.category === category)));
    }
    for (const severity of Object.values(Severity)) {
      const events = (await walkEvents(host, supervisor, `?severity=${severity}&limit=150`)).flatMap((page) => page.events);
      expect(seqs(events), severity).toEqual(seqs(all.filter((event) => event.severity === severity)));
    }
    const type = all[2_000]?.type ?? '';
    const typed = (await walkEvents(host, supervisor, `?type=${type}&limit=33`)).flatMap((page) => page.events);
    expect(seqs(typed)).toEqual(seqs(all.filter((event) => event.type === type)));
    expect(typed.length).toBeGreaterThan(0);
  });
});

describe('operations 58 and 61 at volume: the STORED chain, not the ring', () => {
  it('getSecurityStatus answers the stored head and total', async () => {
    const head = await storedHead(owner);
    const body: SecurityStatus = (await host.get(SECURITY_STATUS, investigator)).json();
    expect(validateCoreApiResponse('getSecurityStatus', 200, body)).toEqual({ ok: true });
    expect([body.auditTotal, body.auditHead]).toEqual([head.seq, head.hash]);
    expect(body.auditTotal).toBeGreaterThan(host.engine.slice('audit').rows.length);
  });

  it('an export answers the STORED rows it covers; the simulator\'s row counts the ring (finding of this row)', async () => {
    const head = await storedHead(owner);
    const response = await host.post(AUDIT_EXPORT, supervisor, { reason: 'Quarterly audit review' });
    expect(response.statusCode).toBe(202);
    const body: AuditExportAccepted = response.json();
    expect(validateCoreApiResponse('exportAudit', 202, body)).toEqual({ ok: true });
    expect([body.rows, body.head]).toEqual([head.seq, head.hash]);
    const row = (await readTrail(owner)).at(-1);
    expect(row).toMatchObject({ seq: head.seq + 1, type: 'AUDIT_EXPORTED', prevHash: head.hash });
    // The simulator writes the length of its ring into the row's details and message.
    expect(row?.details['rows']).toBe(1_000);
    expect(row?.details['head']).toBe(head.hash);
    console.info(`[w39] bulk export: the answer says rows ${body.rows} (the stored chain); the AUDIT_EXPORTED row's details say rows ${String(row?.details['rows'])} (the engine's ring)`);
  });
});

describe('no secret in any answer of the lists at volume (rule 6)', () => {
  it('every page of the audit list and of the events, and the status, hold nothing secret-shaped', async () => {
    const answers: unknown[] = [];
    answers.push(...(await walkAudit(host, investigator, '?limit=200')));
    answers.push(...(await walkEvents(host, investigator, '?limit=200')));
    answers.push((await host.get(SECURITY_STATUS, investigator)).json());
    answers.push((await host.get(AUDIT_CHAIN, investigator)).json());
    const found = answers.flatMap((answer, index) => secretFindings(answer, `answer ${index}`));
    expect(found).toEqual([]);
    const text = JSON.stringify(answers);
    console.info(`[w39] secret scan, bulk clone: ${answers.length} answers, ${text.length} characters, 0 findings`);
  });
});
