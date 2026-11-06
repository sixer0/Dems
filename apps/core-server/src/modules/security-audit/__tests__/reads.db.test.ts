// Operations 58, 59 and 63 against PostgreSQL, on a clone of the seed (plan row W39; spec §7.13,
// §7.1 API-9; database contract §4.12 to §4.14; module gate MODG).
//
// The real app, booted, with every stage as the server has it. Counts are relative to the state
// AFTER the boot and the sign-ins (the first start on a fresh seed writes a row, and so does each
// sign-in). Lists are compared with the stored rows read as `dems_owner`, and with the engine's
// committed ring, which on the seed still holds every row.
import { LIST_CURSOR_PATTERN, validateCoreApiResponse, type AuditPage, type EventPage, type SecurityStatus } from '@dems/shared/api';
import { AuditCategory, AuditType, Severity, SimEventCategory, verifyAuditChain, type AuditRow, type SimEvent } from '@dems/shared/sim';
import type { Pool } from 'pg';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { useTestDatabase } from '../../../../test/helpers/db';
import { readEvents, readTrail } from '../../../../test/support/core';
import { decodeAuditCursor, decodeEventCursor, encodeAuditCursor, encodeEventCursor } from '../cursor';
import {
  AUDIT,
  EVENTS,
  SECURITY_STATUS,
  auditApp,
  errorOf,
  onTheWire,
  outcomeOf,
  secretFindings,
  storedHead,
  walkAudit,
  walkEvents,
  type AuditApp,
  type Headers,
} from './support';

const db = useTestDatabase({ template: 'seed' });
let host: AuditApp;
let owner: Pool;
let investigator: Headers;
let supervisor: Headers;
let technician: Headers;

beforeAll(async () => {
  owner = db.ownerPool();
  host = await auditApp(db, db.run.dataDir);
  investigator = await host.signIn('INVESTIGATOR');
  supervisor = await host.signIn('SUPERVISOR');
  technician = await host.signIn('TECHNICIAN');
  await host.app.pipeline.drain();
});

beforeEach(() => {
  host.forgetCounters();
});

async function auditPage(query = '', session: Headers = investigator): Promise<AuditPage> {
  const response = await host.get(`${AUDIT}${query}`, session);
  expect(response.statusCode, query).toBe(200);
  expect(validateCoreApiResponse('listAuditRows', 200, response.json())).toEqual({ ok: true });
  return response.json();
}

async function eventPage(query = '', session: Headers = investigator): Promise<EventPage> {
  const response = await host.get(`${EVENTS}${query}`, session);
  expect(response.statusCode, query).toBe(200);
  expect(validateCoreApiResponse('listEvents', 200, response.json())).toEqual({ ok: true });
  return response.json();
}

const stored = async (): Promise<AuditRow[]> => onTheWire(await readTrail(owner));
const storedEvents = async (): Promise<Array<SimEvent & { category: string }>> => onTheWire(await readEvents(owner));
const withoutCategory = ({ category: _category, ...event }: SimEvent & { category: string }): SimEvent => event;

describe('what the clone holds after the boot and three sign-ins', () => {
  it('the seed\'s 82 audit rows and 59 events, the row of the first start, and one row per sign-in; the ring holds them all', async () => {
    const trail = await stored();
    expect(trail.length).toBeGreaterThanOrEqual(86);
    expect(trail.slice(0, 82).every((row, index) => row.seq === index + 1)).toBe(true);
    expect(trail.slice(-3).map((row) => row.type)).toEqual(['AUTH_SUCCESS', 'AUTH_SUCCESS', 'AUTH_SUCCESS']);
    expect(host.engine.slice('audit').rows).toHaveLength(trail.length);
    expect((await storedEvents()).length).toBeGreaterThanOrEqual(59);
    console.info(`[w39] seed clone after boot and three sign-ins: ${trail.length} audit rows, ${(await storedEvents()).length} events`);
  });
});

describe('operation 58 getSecurityStatus', () => {
  it('answers the committed slice `security` with the STORED head and total, and validates against the contract', async () => {
    const response = await host.get(SECURITY_STATUS, investigator);
    expect(response.statusCode).toBe(200);
    const body: SecurityStatus = response.json();
    expect(validateCoreApiResponse('getSecurityStatus', 200, body)).toEqual({ ok: true });
    const head = await storedHead(owner);
    // Fix wave J (GM-02): the Core's own count of sealed items with / without a verification of record, over the whole evidence slice.
    const items = host.engine.slice('evidence');
    const sealed = items.filter((item) => item.sealedAt !== null);
    const evidenceVerification = {
      sealed: sealed.length,
      passed: sealed.filter((item) => item.verification.status === 'PASS').length,
      failed: sealed.filter((item) => item.verification.status === 'FAIL').length,
      neverVerified: sealed.filter((item) => item.verification.status === 'NOT_RUN').length,
    };
    expect(evidenceVerification.sealed).toBeGreaterThan(0);
    expect(evidenceVerification.sealed).toBeLessThan(items.length);
    expect(body).toStrictEqual({ security: onTheWire(host.engine.slice('security')), auditHead: head.hash, auditTotal: head.seq, evidenceVerification });
    expect(Object.keys(body)).toEqual(['security', 'auditHead', 'auditTotal', 'evidenceVerification']);
    // The head is the hash of the newest stored row, and the total its sequence.
    const newest = (await stored()).at(-1);
    expect([body.auditTotal, body.auditHead]).toEqual([newest?.seq, newest?.hash]);
  });

  it('head and total come from ONE row of ONE statement, read on the pool: no transaction, no unit of work, no audit row', async () => {
    const mark = host.database.statements.length;
    const units = host.app.pipeline.snapshot().completed;
    await host.get(SECURITY_STATUS, supervisor);
    const sent = host.database.statements.slice(mark).filter((entry) => /audit/.test(entry.text));
    expect(sent).toHaveLength(1);
    expect(sent[0]?.text).toMatch(/^select "seq", "hash" from "audit_chain_head" limit \$1$/);
    expect(sent[0]?.rows).toBe(1);
    expect(host.database.statements.slice(mark).some((entry) => /audit_log/.test(entry.text))).toBe(false);
    expect(host.app.pipeline.snapshot().completed).toBe(units);
  });

  it('follows the stored chain: after three appended rows the total is three more and the head is the newest row\'s hash', async () => {
    const before: SecurityStatus = (await host.get(SECURITY_STATUS, investigator)).json();
    const appended = await host.appendRows(3);
    const after: SecurityStatus = (await host.get(SECURITY_STATUS, investigator)).json();
    expect(after.auditTotal).toBe(before.auditTotal + 3);
    expect(after.auditHead).toBe(appended.at(-1)?.hash);
    expect(after.auditHead).not.toBe(before.auditHead);
  });

  it('every signed-in role may read it; a caller without a session is refused with 401 and no row', async () => {
    for (const session of [investigator, supervisor, technician]) expect((await host.get(SECURITY_STATUS, session)).statusCode).toBe(200);
    const rows = (await stored()).length;
    const refused = await host.get(SECURITY_STATUS);
    expect(outcomeOf(refused)).toEqual([401, 'NOT_SIGNED_IN']);
    expect(validateCoreApiResponse('getSecurityStatus', 401, refused.json())).toEqual({ ok: true });
    expect((await stored()).length).toBe(rows);
  });

  it('no key material: a key record holds an identifier, an algorithm, a fingerprint and an expiry', async () => {
    const body: SecurityStatus = (await host.get(SECURITY_STATUS, investigator)).json();
    expect(secretFindings(body)).toEqual([]);
    expect(JSON.stringify(body)).not.toMatch(/PRIVATE KEY|BEGIN [A-Z ]+KEY/);
  });
});

describe('operation 59 listAuditRows: the list is the stored chain', () => {
  it('the default page is the first 50 rows in chain order, with the stored head and total and a cursor on row 50', async () => {
    const trail = await stored();
    const page = await auditPage();
    expect(page.rows).toStrictEqual(trail.slice(0, 50));
    const head = await storedHead(owner);
    expect([page.total, page.head]).toEqual([head.seq, head.hash]);
    expect(page.nextCursor).toMatch(LIST_CURSOR_PATTERN);
    expect(page.nextCursor).toBe(encodeAuditCursor(trail[49] as AuditRow));
    expect(decodeAuditCursor(page.nextCursor ?? '')).toEqual({ seq: 50, mark: trail[49]?.hash.slice(0, 16) });
  });

  it('a walk returns every stored row once, in chain order, for the page sizes 1 (12 pages), 7, 50, 64 and 200; the last page has no cursor and is never empty', async () => {
    const trail = await stored();
    for (const limit of [7, 50, 64, 200]) {
      const pages = await walkAudit(host, investigator, `?limit=${limit}`);
      expect(pages.flatMap((page) => page.rows), `limit ${limit}`).toStrictEqual(trail);
      expect(pages.map((page) => page.rows.length)).toEqual([...Array<number>(Math.floor((trail.length - 1) / limit)).fill(limit), ((trail.length - 1) % limit) + 1]);
      expect(pages.at(-1)?.nextCursor).toBeNull();
      for (const page of pages.slice(0, -1)) expect(page.nextCursor).toMatch(LIST_CURSOR_PATTERN);
    }
    let cursor: string | null = null;
    const first: AuditRow[] = [];
    for (let index = 0; index < 12; index += 1) {
      const page: AuditPage = await auditPage(cursor === null ? '?limit=1' : `?limit=1&cursor=${cursor}`);
      expect(page.rows).toHaveLength(1);
      first.push(...page.rows);
      cursor = page.nextCursor;
    }
    expect(first).toStrictEqual(trail.slice(0, 12));
  });

  it('an exactly full last page has no cursor: with a page size equal to the number of rows, and with one that divides it', async () => {
    const trail = await stored();
    const whole = await auditPage(`?limit=${Math.min(trail.length, 200)}`);
    expect(whole.rows).toHaveLength(trail.length);
    expect(whole.nextCursor).toBeNull();
    // Make the count a multiple of 10, then walk in tens.
    await host.appendRows(10 - (trail.length % 10));
    const pages = await walkAudit(host, investigator, '?limit=10');
    expect(pages.every((page) => page.rows.length === 10)).toBe(true);
    expect(pages.at(-1)?.nextCursor).toBeNull();
  });

  it('order=DESC is the same rows newest first; ASC is the order when none is given', async () => {
    const trail = await stored();
    const newestFirst = (await walkAudit(host, investigator, '?order=DESC&limit=30')).flatMap((page) => page.rows);
    expect(newestFirst).toStrictEqual([...trail].reverse());
    expect((await auditPage('?order=ASC&limit=5')).rows).toStrictEqual((await auditPage('?limit=5')).rows);
    const top = await auditPage('?order=DESC&limit=5');
    expect(top.rows.map((row) => row.seq)).toEqual([0, 1, 2, 3, 4].map((offset) => trail.length - offset));
    expect(decodeAuditCursor(top.nextCursor ?? '')?.seq).toBe(trail.length - 4);
  });

  it('a row of the list IS the row of the realtime channel: the engine\'s committed ring, member by member, with seq, prevHash, hash and the hashed body', async () => {
    const walked = (await walkAudit(host, supervisor, '?limit=200')).flatMap((page) => page.rows);
    expect(walked).toStrictEqual(onTheWire(host.engine.slice('audit').rows));
    expect(Object.keys(walked[0] ?? {})).toEqual(['seq', 'id', 'at', 'type', 'category', 'severity', 'actorId', 'message', 'sessionId', 'evidenceId', 'deviceId', 'details', 'prevHash', 'hash']);
  });

  it('a client can verify the chain over the rows it received: the shared check accepts the walk, and refuses it when one delivered row is altered', async () => {
    const pages = await walkAudit(host, investigator, '?limit=40');
    const rows = pages.flatMap((page) => page.rows);
    const last = pages.at(-1);
    expect(verifyAuditChain({ rows, head: last?.head ?? '', total: last?.total ?? 0, dropped: 0 })).toEqual({ ok: true, checked: rows.length, head: last?.head });
    const altered = rows.map((row) => (row.seq === 30 ? { ...row, message: `${row.message}.` } : row));
    expect(verifyAuditChain({ rows: altered, head: last?.head ?? '', total: last?.total ?? 0, dropped: 0 })).toMatchObject({ ok: false, seq: 30, reason: 'HASH_MISMATCH' });
  });
});

describe('operation 59 listAuditRows: the five filters', () => {
  it('category: each of the eight categories gives exactly the stored rows of that category, in chain order', async () => {
    const trail = await stored();
    const counts: Record<string, number> = {};
    for (const category of Object.values(AuditCategory)) {
      const rows = (await walkAudit(host, investigator, `?category=${category}&limit=25`)).flatMap((page) => page.rows);
      expect(rows, category).toStrictEqual(trail.filter((row) => row.category === category));
      counts[category] = rows.length;
    }
    expect(Object.values(counts).reduce((sum, count) => sum + count, 0)).toBe(trail.length);
    expect(Object.values(counts).filter((count) => count > 0).length).toBeGreaterThanOrEqual(4);
    console.info(`[w39] seed clone, audit rows by category: ${JSON.stringify(counts)}`);
  });

  it('type, actorId, sessionId and evidenceId: each gives exactly the stored rows that match', async () => {
    const trail = await stored();
    const sessionId = trail.find((row) => row.sessionId !== null)?.sessionId ?? '';
    const evidenceId = trail.find((row) => row.evidenceId !== null)?.evidenceId ?? '';
    expect(sessionId).not.toBe('');
    expect(evidenceId).not.toBe('');
    const cases: ReadonlyArray<readonly [query: string, keep: (row: AuditRow) => boolean]> = [
      [`type=${AuditType.AUTH_SUCCESS}`, (row) => row.type === 'AUTH_SUCCESS'],
      [`type=${AuditType.EVIDENCE_SEALED}`, (row) => row.type === 'EVIDENCE_SEALED'],
      ['actorId=OPR-001', (row) => row.actorId === 'OPR-001'],
      ['actorId=OPR-003', (row) => row.actorId === 'OPR-003'],
      [`sessionId=${sessionId}`, (row) => row.sessionId === sessionId],
      [`evidenceId=${evidenceId}`, (row) => row.evidenceId === evidenceId],
      [`category=${AuditCategory.AUTH}&actorId=OPR-002`, (row) => row.category === 'AUTH' && row.actorId === 'OPR-002'],
      [`type=${AuditType.AUTH_SUCCESS}&category=${AuditCategory.EVIDENCE}`, () => false],
      [`sessionId=${sessionId}&evidenceId=${evidenceId}&order=DESC`, (row) => row.sessionId === sessionId && row.evidenceId === evidenceId],
    ];
    for (const [query, keep] of cases) {
      const rows = (await walkAudit(host, investigator, `?${query}&limit=9`)).flatMap((page) => page.rows);
      const expected = trail.filter(keep);
      expect(rows, query).toStrictEqual(query.includes('order=DESC') ? [...expected].reverse() : expected);
    }
    expect(trail.filter((row) => row.actorId === 'OPR-001').length).toBeGreaterThan(0);
    expect(trail.filter((row) => row.sessionId === sessionId).length).toBeGreaterThan(1);
  });

  it('head and total are the chain\'s, whatever the filters: also for a filter that matches nothing', async () => {
    const head = await storedHead(owner);
    const none = await auditPage(`?type=${AuditType.UPDATE_COMPLETED}&actorId=OPR-003`);
    expect(none).toEqual({ rows: [], head: head.hash, total: head.seq, nextCursor: null });
    const some = await auditPage(`?category=${AuditCategory.AUTH}&limit=2`);
    expect([some.total, some.head]).toEqual([head.seq, head.hash]);
  });

  it('a filter and a cursor: the walk under a filter continues from the cursor\'s row, and a cursor of an unfiltered page is a position under any filter', async () => {
    const trail = await stored();
    const auth = trail.filter((row) => row.category === 'AUTH');
    const first = await auditPage(`?category=${AuditCategory.AUTH}&limit=2`);
    expect(first.rows).toStrictEqual(auth.slice(0, 2));
    const second = await auditPage(`?category=${AuditCategory.AUTH}&limit=2&cursor=${first.nextCursor}`);
    expect(second.rows).toStrictEqual(auth.slice(2, 4));
    // The cursor of row 60 of the unfiltered list: the AUTH rows above sequence 60.
    const position = encodeAuditCursor(trail[59] as AuditRow);
    expect((await auditPage(`?category=${AuditCategory.AUTH}&limit=200&cursor=${position}`)).rows).toStrictEqual(auth.filter((row) => row.seq > 60));
    expect((await auditPage(`?order=DESC&limit=200&cursor=${position}`)).rows).toStrictEqual(trail.slice(0, 59).reverse());
  });
});

describe('operation 59 listAuditRows: one snapshot per page', () => {
  it('a page is one read-only REPEATABLE READ transaction: the head, the cursor\'s row, the rows', async () => {
    const first = await auditPage('?limit=5');
    const mark = host.database.statements.length;
    await auditPage(`?limit=5&cursor=${first.nextCursor}`);
    // Stage 4 resolved the session with one statement of its own; the read's begin with `begin`.
    const all = host.database.statements.slice(mark);
    const read = all.slice(all.findIndex((entry) => entry.text.startsWith('begin')));
    const sent = read.map((entry) => entry.text);
    expect(all.length - read.length).toBe(1);
    expect(sent).toHaveLength(5);
    expect(sent[0]).toBe('begin isolation level repeatable read read only');
    expect(sent[1]).toMatch(/^select "seq", "hash" from "audit_chain_head" limit \$1$/);
    expect(sent[2]).toMatch(/^select "seq" from "audit_log" where \("audit_log"\."seq" = \$1 and starts_with\("audit_log"\."hash", \$2::text\)\) limit \$3$/);
    expect(sent[3]).toMatch(/^select .* from "audit_log" where "audit_log"\."seq" > \$1 order by "audit_log"\."seq" asc limit \$2$/);
    expect(sent[4]).toBe('commit');
    // Six rows are read for a page of five: the sixth says that another page follows.
    expect(read.map((entry) => entry.rows)).toEqual([0, 1, 1, 6, 0]);
  });

  it('rows committed between the head read and the row read of a page are not in it: total is never smaller than a sequence the page shows', async () => {
    const before = await storedHead(owner);
    const held = host.database.hold(/from "audit_log" order by "audit_log"\."seq" desc/);
    const pending = host.get(`${AUDIT}?order=DESC&limit=5`, investigator);
    await held.reached();
    // The page has read its head. Three rows are committed now, on another connection.
    await host.appendRows(3);
    expect((await storedHead(owner)).seq).toBe(before.seq + 3);
    held.release();
    const page: AuditPage = (await pending).json();
    expect(page.total).toBe(before.seq);
    expect(page.head).toBe(before.hash);
    expect(page.rows.map((row) => row.seq)).toEqual([0, 1, 2, 3, 4].map((offset) => before.seq - offset));
    expect(Math.max(...page.rows.map((row) => row.seq))).toBeLessThanOrEqual(page.total);
    // The next request sees them.
    expect((await auditPage('?order=DESC&limit=1')).rows[0]?.seq).toBe(before.seq + 3);
  });
});

describe('operation 59 listAuditRows: refusals', () => {
  it('a query that does not match its schema answers 422 INVALID_INPUT and reads nothing', async () => {
    const queries = [
      '?limit=0',
      '?limit=201',
      '?limit=abc',
      '?limit=1.5',
      '?order=UP',
      '?order=desc',
      '?category=NOPE',
      '?type=NOT_A_TYPE',
      '?actorId=budi.santoso',
      '?sessionId=SES-1',
      '?evidenceId=EV-1',
      '?cursor=with_underscore',
      `?cursor=${'A'.repeat(129)}`,
      '?cursor=',
    ];
    for (const query of queries) {
      host.forgetCounters();
      const mark = host.database.statements.length;
      const response = await host.get(`${AUDIT}${query}`, investigator);
      expect(outcomeOf(response), query).toEqual([422, 'INVALID_INPUT']);
      expect(validateCoreApiResponse('listAuditRows', 422, response.json())).toEqual({ ok: true });
      expect(host.database.statements.slice(mark).filter((entry) => /audit_log/.test(entry.text)), query).toEqual([]);
    }
  });

  it('a cursor that is not one of this list answers 422 INVALID_INPUT: a wrong form reads nothing, a right form whose row is not in the table reads no page', async () => {
    const trail = await stored();
    const real = trail[9] as AuditRow;
    const events = await eventPage('?limit=3');
    const wrongForm = ['150', 'AUD-000010', `AUD-0000010-${real.hash.slice(0, 16)}`, events.nextCursor ?? 'LOG-000003-0'];
    for (const cursor of wrongForm) {
      const mark = host.database.statements.length;
      const response = await host.get(`${AUDIT}?cursor=${cursor}`, investigator);
      expect(outcomeOf(response), cursor).toEqual([422, 'INVALID_INPUT']);
      expect(errorOf(response).details).toEqual({ in: 'querystring' });
      expect(host.database.statements.slice(mark).filter((entry) => /audit/.test(entry.text))).toEqual([]);
    }
    const unknownRow = [
      `AUD-000010-${'0'.repeat(16)}`, // the right sequence, another hash: a row of another chain
      `AUD-000010-${(trail[10] as AuditRow).hash.slice(0, 16)}`, // the hash of the row after it
      `AUD-999999-${real.hash.slice(0, 16)}`, // a sequence the chain has not reached
    ];
    for (const cursor of unknownRow) {
      host.forgetCounters();
      const mark = host.database.statements.length;
      const response = await host.get(`${AUDIT}?cursor=${cursor}`, investigator);
      expect(outcomeOf(response), cursor).toEqual([422, 'INVALID_INPUT']);
      expect(validateCoreApiResponse('listAuditRows', 422, response.json())).toEqual({ ok: true });
      expect(errorOf(response).details).toEqual({ in: 'querystring' });
      const sent = host.database.statements.slice(mark).filter((entry) => /audit_log/.test(entry.text));
      // The lookup of the cursor's row, which found none; no page was read.
      expect(sent.map((entry) => entry.rows)).toEqual([0]);
    }
    // The control: the real cursor of row 10.
    expect((await auditPage(`?limit=1&cursor=${encodeAuditCursor(real)}`)).rows[0]?.seq).toBe(11);
  });

  it('a cursor cannot name a table, a column or a filter: text that tries is refused by its form, and the table is unchanged', async () => {
    const rows = (await stored()).length;
    const attempts = ['AUD-000010-0000000000000000%27%20OR%201%3D1', 'events', 'AUD-000010-0000000000000000%3Bdrop', '..%2Fevents', 'AUD-000001-%25%25%25%25%25%25%25%25%25%25%25%25%25%25%25%25'];
    for (const attempt of attempts) {
      host.forgetCounters();
      expect(outcomeOf(await host.get(`${AUDIT}?cursor=${attempt}`, investigator)), attempt).toEqual([422, 'INVALID_INPUT']);
    }
    expect((await stored()).length).toBe(rows);
  });

  it('every signed-in role may read the audit list; a caller without a session is refused with 401, before the query is looked at, and no row is written', async () => {
    for (const session of [investigator, supervisor, technician]) expect((await host.get(`${AUDIT}?limit=1`, session)).statusCode).toBe(200);
    const rows = (await stored()).length;
    for (const query of ['', '?limit=0', '?cursor=with_underscore']) {
      const refused = await host.get(`${AUDIT}${query}`);
      expect(outcomeOf(refused)).toEqual([401, 'NOT_SIGNED_IN']);
      expect(validateCoreApiResponse('listAuditRows', 401, refused.json())).toEqual({ ok: true });
    }
    expect((await stored()).length).toBe(rows);
  });

  it('a read changes nothing: no audit row, no event, no unit of work', async () => {
    const before = { rows: (await stored()).length, events: (await storedEvents()).length, units: host.app.pipeline.snapshot().completed };
    await walkAudit(host, investigator, '?limit=20');
    await walkEvents(host, investigator, '?limit=20');
    await host.get(SECURITY_STATUS, investigator);
    expect({ rows: (await stored()).length, events: (await storedEvents()).length, units: host.app.pipeline.snapshot().completed }).toEqual(before);
  });
});

describe('operation 63 listEvents', () => {
  it('the default page is the first 50 events by seq, oldest first, in the wire form of the slice (no category member), with a cursor on event 50', async () => {
    const all = await storedEvents();
    const page = await eventPage();
    expect(page.events).toStrictEqual(all.slice(0, 50).map(withoutCategory));
    expect(Object.keys(page)).toEqual(['events', 'nextCursor']);
    expect(Object.keys(page.events[0] ?? {})).toEqual(['id', 'seq', 'at', 'type', 'severity', 'message', 'params', 'sessionId', 'deviceId']);
    expect(page.nextCursor).toBe(encodeEventCursor(all[49] as SimEvent));
    expect(decodeEventCursor(page.nextCursor ?? '')).toEqual({ seq: all[49]?.seq, at: all[49]?.at });
    expect(page.nextCursor).toMatch(LIST_CURSOR_PATTERN);
  });

  it('a walk returns every stored event once, for the page sizes 1 (10 pages), 7, 50 and 200, and equals the engine\'s committed ring', async () => {
    const all = (await storedEvents()).map(withoutCategory);
    for (const limit of [7, 50, 200]) {
      const pages = await walkEvents(host, investigator, `?limit=${limit}`);
      expect(pages.flatMap((page) => page.events), `limit ${limit}`).toStrictEqual(all);
      expect(pages.at(-1)?.nextCursor).toBeNull();
      expect(pages.at(-1)?.events.length).toBeGreaterThan(0);
    }
    let cursor: string | null = null;
    const first: SimEvent[] = [];
    for (let index = 0; index < 10; index += 1) {
      const page: EventPage = await eventPage(cursor === null ? '?limit=1' : `?limit=1&cursor=${cursor}`);
      first.push(...page.events);
      cursor = page.nextCursor;
    }
    expect(first).toStrictEqual(all.slice(0, 10));
    expect(all).toStrictEqual(onTheWire(host.engine.slice('events')));
    // An exactly full last page has no cursor: a page as large as the list.
    expect(all.length).toBeLessThanOrEqual(200);
    const whole = await eventPage(`?limit=${all.length}`);
    expect(whole.events).toHaveLength(all.length);
    expect(whole.nextCursor).toBeNull();
  });

  it('category, type and severity: each gives exactly the stored events that match; the category is the stored, derived one', async () => {
    const all = await storedEvents();
    const counts: Record<string, number> = {};
    for (const category of Object.values(SimEventCategory)) {
      const events = (await walkEvents(host, investigator, `?category=${category}&limit=9`)).flatMap((page) => page.events);
      expect(events, category).toStrictEqual(all.filter((event) => event.category === category).map(withoutCategory));
      counts[category] = events.length;
    }
    expect(Object.values(counts).reduce((sum, count) => sum + count, 0)).toBe(all.length);
    expect(Object.values(counts).filter((count) => count > 0).length).toBeGreaterThanOrEqual(3);
    for (const severity of Object.values(Severity)) {
      const events = (await walkEvents(host, investigator, `?severity=${severity}&limit=11`)).flatMap((page) => page.events);
      expect(events, severity).toStrictEqual(all.filter((event) => event.severity === severity).map(withoutCategory));
    }
    const type = all[0]?.type ?? '';
    const category = all[0]?.category ?? '';
    const typed = (await walkEvents(host, investigator, `?type=${type}`)).flatMap((page) => page.events);
    expect(typed).toStrictEqual(all.filter((event) => event.type === type).map(withoutCategory));
    expect(typed.length).toBeGreaterThan(0);
    const both = (await walkEvents(host, investigator, `?type=${type}&category=${category}&severity=${all[0]?.severity}`)).flatMap((page) => page.events);
    expect(both).toStrictEqual(all.filter((event) => event.type === type && event.category === category && event.severity === all[0]?.severity).map(withoutCategory));
    console.info(`[w39] seed clone, events by category: ${JSON.stringify(counts)}`);
  });

  it('a page is one read-only REPEATABLE READ transaction, and a filtered walk continues from its cursor', async () => {
    const first = await eventPage('?limit=4');
    const mark = host.database.statements.length;
    const second = await eventPage(`?limit=4&cursor=${first.nextCursor}`);
    expect(second.events.map((event) => event.seq)).toEqual([5, 6, 7, 8].map((offset) => (first.events[0]?.seq ?? 0) + offset - 1));
    const all = host.database.statements.slice(mark);
    const sent = all.slice(all.findIndex((entry) => entry.text.startsWith('begin'))).map((entry) => entry.text);
    expect(sent).toHaveLength(4);
    expect(sent[0]).toBe('begin isolation level repeatable read read only');
    expect(sent[1]).toMatch(/^select "seq" from "events" where \("events"\."seq" = \$1 and "events"\."at" = \$2\) limit \$3$/);
    expect(sent[2]).toMatch(/^select .* from "events" where "events"\."seq" > \$1 order by "events"\."seq" asc limit \$2$/);
    expect(sent[3]).toBe('commit');
  });

  it('refusals: a query outside its schema, a cursor that is not one of this list, a caller without a session', async () => {
    const all = await storedEvents();
    const audit = await auditPage('?limit=3');
    const invalid = [
      '?limit=0',
      '?limit=201',
      '?category=NOPE',
      '?category=PAIRING',
      '?type=NOT_A_TYPE',
      '?severity=LOUD',
      '?cursor=with_underscore',
      '?order=DESC&cursor=x_y',
      '?cursor=59',
      `?cursor=${audit.nextCursor}`,
      `?cursor=LOG-000005-${(all[4]?.at ?? 0) + 1}`,
      '?cursor=LOG-999999-1790823600000',
    ];
    for (const query of invalid) {
      host.forgetCounters();
      const response = await host.get(`${EVENTS}${query}`, investigator);
      expect(outcomeOf(response), query).toEqual([422, 'INVALID_INPUT']);
      expect(validateCoreApiResponse('listEvents', 422, response.json())).toEqual({ ok: true });
    }
    // The list has one order: an `order` member is no member of the query and is dropped (API-4).
    expect((await eventPage('?order=DESC&limit=2')).events.map((event) => event.seq)).toEqual([all[0]?.seq, all[1]?.seq]);
    for (const session of [investigator, supervisor, technician]) expect((await host.get(`${EVENTS}?limit=1`, session)).statusCode).toBe(200);
    const refused = await host.get(EVENTS);
    expect(outcomeOf(refused)).toEqual([401, 'NOT_SIGNED_IN']);
    expect(validateCoreApiResponse('listEvents', 401, refused.json())).toEqual({ ok: true });
  });

  it('follows the stored table: an event appended through a unit of work is the last of the next walk', async () => {
    const before = (await storedEvents()).length;
    const appended = await host.app.pipeline.run('securityAudit.testEvent', (unit) => unit.events.append({ type: 'TIME_SYNC', message: 'Time synchronised (test).', params: { offsetMs: 3 } }));
    await host.engine.idle();
    const all = await storedEvents();
    expect(all.length).toBe(before + 1);
    const walked = (await walkEvents(host, investigator, '?limit=200')).flatMap((page) => page.events);
    expect(walked).toStrictEqual(all.map(withoutCategory));
    expect(walked.at(-1)).toStrictEqual(onTheWire(appended));
  });
});

describe('no secret in any answer of the lists (rule 6)', () => {
  it('the scan finds each kind of secret-shaped value when it is present (positive control)', () => {
    const planted = {
      rows: [
        { message: `Signed in with ses_${'A'.repeat(43)}`, details: { note: 'x' } },
        { message: 'ok', details: { password: 'x', nested: `dvc_${'b'.repeat(43)}` } },
        { message: `bio_${'c'.repeat(43)}`, details: {} },
        { message: 'Pair with DEMS-PAIR:1:123456', details: {} },
        { message: '$argon2id$v=19$m=19456,t=2,p=1$c2FsdHNhbHQ$aGFzaGhhc2g', details: {} },
        { message: 'A'.repeat(43), details: {} },
      ],
      events: [{ params: { sessionToken: 'x', Authorization: 'y' } }],
    };
    const found = secretFindings(planted);
    const kinds = new Set(found.map((finding) => finding.what));
    expect([...kinds].sort()).toEqual([
      '43 characters of base64url',
      'a biometric token',
      'a credential form of the contract',
      'a device credential',
      'a forbidden payload key',
      'a pairing QR payload',
      'a password hash',
      'a session token',
    ]);
    expect(found.filter((finding) => finding.what === 'a forbidden payload key').map((finding) => finding.at)).toEqual(['$.rows[1].details.password', '$.events[0].params.sessionToken', '$.events[0].params.Authorization']);
    // A finding never holds the value.
    expect(JSON.stringify(found)).not.toContain('A'.repeat(43));
    // What is NOT a secret: a chain hash, an ID, an instant.
    expect(secretFindings({ hash: 'a'.repeat(64), id: 'AUD-000001', at: 1_790_823_600_000, nextCursor: `AUD-000050-${'a'.repeat(16)}` })).toEqual([]);
  });

  it('every answer of the three reads on the seed clone, in both orders and under every filter value, holds nothing secret-shaped', async () => {
    const answers: unknown[] = [];
    answers.push(...(await walkAudit(host, investigator, '?limit=200')));
    answers.push(...(await walkAudit(host, supervisor, '?order=DESC&limit=37')));
    for (const category of Object.values(AuditCategory)) answers.push(...(await walkAudit(host, technician, `?category=${category}`)));
    answers.push(...(await walkEvents(host, investigator, '?limit=200')));
    for (const severity of Object.values(Severity)) answers.push(...(await walkEvents(host, supervisor, `?severity=${severity}`)));
    answers.push((await host.get(SECURITY_STATUS, investigator)).json());
    const found = answers.flatMap((answer, index) => secretFindings(answer, `answer ${index}`));
    expect(found).toEqual([]);
    // The rows of the three sign-ins of this file are among them: none names a typed username.
    const text = JSON.stringify(answers);
    for (const role of ['INVESTIGATOR', 'SUPERVISOR', 'TECHNICIAN'] as const) expect(text).not.toContain(host.operator(role).username);
    console.info(`[w39] secret scan, seed clone: ${answers.length} answers, ${text.length} characters, 0 findings`);
  });
});
