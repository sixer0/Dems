// Operation 38 `listSessionHistory` against PostgreSQL as `dems_app`, on a clone of the bulk
// template: 520 finished sessions (plan row W34; spec §7.1 API-9, §7.8; database contract §4.16,
// §11; decision D73).
//
// The app is the real one, booted on the bulk clone at the template's instant, so the engine has
// rehydrated all 520 entries. The caller is a SEEDED operator signed in on the web console (no
// session of the fixture can authenticate). Every expectation about order is a keyset
// expectation, `(ended_at DESC, id DESC)`, read from the table as `dems_owner`: the table has no
// sequence column, and nothing here compares two instants to decide an order.
import { API_PAGE_LIMIT_DEFAULT, API_PAGE_LIMIT_MAX, LIST_CURSOR_PATTERN, validateCoreApiResponse, type SessionHistoryPage } from '@dems/shared/api';
import type { Pool } from 'pg';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { useTestDatabase } from '../../../../test/helpers/db';
import { BULK_TEMPLATE_NOW } from '../../../db/fixtures/__tests__/template-hook.bulk';
import { throttleControl } from '../../../plugins/throttle';
import { cursorOf, positionOf } from '../index';
import { HISTORY, errorOf, sessionsApp, type Caller, type SessionsApp } from './support';

const db = useTestDatabase({ template: 'bulk' });

// A clone is made inside a test, and clone and drop wait for the clone lock, which other rows'
// runs may hold; a walk of the history in pages of 1 is 520 requests. Under a loaded host the
// default five seconds of a test are not enough for either (the reset row's files do the same).
vi.setConfig({ testTimeout: 120_000, hookTimeout: 180_000 });

interface StoredEntry {
  readonly id: string;
  readonly endedAt: number;
  readonly evidenceId: string | null;
  readonly outcome: string;
}

/** The whole history in keyset order, with the evidence item of each session, as `dems_owner`. */
async function storedHistory(pool: Pool): Promise<StoredEntry[]> {
  const { rows } = await pool.query<{ id: string; ended_at: string; evidence_id: string | null; outcome: string }>(
    `SELECT h.id, h.ended_at::text AS ended_at, e.id AS evidence_id, h.outcome
       FROM public.session_history h LEFT JOIN public.evidence_items e ON e.session_id = h.id
      ORDER BY h.ended_at DESC, h.id DESC`,
  );
  return rows.map((row) => ({ id: row.id, endedAt: Number(row.ended_at), evidenceId: row.evidence_id, outcome: row.outcome }));
}

/** Every page from the newest on, with the `limit` given (none: the server's default). */
async function walk(host: SessionsApp, caller: Caller, limit?: number): Promise<SessionHistoryPage[]> {
  const pages: SessionHistoryPage[] = [];
  let cursor: string | null = null;
  for (let guard = 0; guard < 1_000; guard += 1) {
    const query = [limit === undefined ? null : `limit=${limit}`, cursor === null ? null : `cursor=${cursor}`].filter((part) => part !== null).join('&');
    const response = await host.get(caller, query === '' ? HISTORY : `${HISTORY}?${query}`);
    expect(response.statusCode).toBe(200);
    const page = response.json() as SessionHistoryPage;
    expect(validateCoreApiResponse('listSessionHistory', 200, page)).toEqual({ ok: true });
    pages.push(page);
    if (page.nextCursor === null) return pages;
    expect(page.nextCursor).toMatch(LIST_CURSOR_PATTERN);
    cursor = page.nextCursor;
  }
  throw new Error('the walk did not end');
}

describe('listSessionHistory on 520 stored sessions', () => {
  let host: SessionsApp;
  let caller: Caller;
  let stored: StoredEntry[];

  beforeAll(async () => {
    host = await sessionsApp(db, db.run.dataDir, { startAt: BULK_TEMPLATE_NOW });
    caller = await host.signIn('TECHNICIAN');
    stored = await storedHistory(host.owner);
  });

  // The clock of this file stands still, and one walk in pages of 1 is 520 requests of one
  // operator: the throttle's window (600 a minute per operator) is started afresh for each test.
  beforeEach(() => {
    throttleControl(host.app).reset();
  });

  it('the fixture: 520 entries, sealed and incomplete, five without an evidence item; the engine rehydrated every one', () => {
    expect(stored).toHaveLength(520);
    expect(stored.filter((entry) => entry.outcome === 'SEALED').length).toBeGreaterThanOrEqual(500);
    expect(stored.filter((entry) => entry.outcome === 'INCOMPLETE').length).toBeGreaterThanOrEqual(20);
    expect(stored.filter((entry) => entry.evidenceId === null)).toHaveLength(5);
    expect(host.engine.slice('sessionHistory')).toHaveLength(520);
  });

  it('with no query: the default page of 50, the newest first, and a cursor that names the 50th', async () => {
    const response = await host.get(caller, HISTORY);
    expect(response.statusCode).toBe(200);
    const page = response.json() as SessionHistoryPage;
    expect(validateCoreApiResponse('listSessionHistory', 200, page)).toEqual({ ok: true });
    expect(API_PAGE_LIMIT_DEFAULT).toBe(50);
    expect(page.items.map((item) => item.id)).toEqual(stored.slice(0, 50).map((entry) => entry.id));
    expect(page.nextCursor).toBe(`${stored[49]?.endedAt}-${stored[49]?.id}`);
    expect(positionOf(page.nextCursor ?? '')).toEqual({ endedAt: stored[49]?.endedAt, id: stored[49]?.id });
    // A GET names no state position and sets no cookie.
    expect(response.headers['x-dems-revision']).toBeUndefined();
    expect(response.headers['set-cookie']).toBeUndefined();
  });

  it(`pages of ${API_PAGE_LIMIT_MAX}: 200, 200, 120, then no cursor; every session once, in the stored keyset order`, async () => {
    const pages = await walk(host, caller, API_PAGE_LIMIT_MAX);
    expect(pages.map((page) => page.items.length)).toEqual([200, 200, 120]);
    expect(pages.map((page) => page.nextCursor === null)).toEqual([false, false, true]);
    const ids = pages.flatMap((page) => page.items.map((item) => item.id));
    expect(ids).toEqual(stored.map((entry) => entry.id));
    expect(new Set(ids).size).toBe(520);
  });

  it.each([1, 7, 50, 199])('pages of %i: the same 520 sessions in the same order, none twice, none missing; only the last page has no cursor', async (limit) => {
    const pages = await walk(host, caller, limit);
    expect(pages).toHaveLength(Math.ceil(520 / limit));
    expect(pages.slice(0, -1).every((page) => page.items.length === limit && page.nextCursor !== null)).toBe(true);
    expect(pages.flatMap((page) => page.items.map((item) => item.id))).toEqual(stored.map((entry) => entry.id));
  });

  it('a page whose size divides the list exactly ends with a cursor, and the page after it is empty with none', async () => {
    const pages = await walk(host, caller, 104);
    expect(pages.map((page) => page.items.length)).toEqual([104, 104, 104, 104, 104]);
    // 520 = 5 x 104: the fifth page is full and is the last, so it carries no cursor.
    expect(pages.at(-1)?.nextCursor).toBeNull();
    const last = stored.at(-1) as StoredEntry;
    const beyond = await host.get(caller, `${HISTORY}?cursor=${cursorOf(last)}`);
    expect(beyond.json()).toEqual({ items: [], nextCursor: null });
    expect(validateCoreApiResponse('listSessionHistory', 200, beyond.json())).toEqual({ ok: true });
  });

  it('each item is the entry of the engine\'s committed slice: the one mapping, with the evidence item of the session or null (MR-5)', async () => {
    const items = (await walk(host, caller, API_PAGE_LIMIT_MAX)).flatMap((page) => page.items);
    expect(items).toEqual(host.engine.slice('sessionHistory'));
    expect(items.map((item) => [item.id, item.evidenceId])).toEqual(stored.map((entry) => [entry.id, entry.evidenceId]));
    expect(items.filter((item) => item.evidenceId === null)).toHaveLength(5);
    // Text outside ASCII in the fixture (a subject's name) travels unchanged.
    expect(items.some((item) => /[^\x20-\x7e]/.test(item.subjectName))).toBe(true);
  });

  it('a cursor is a position, not a row: one between two sessions continues after it, and one before the newest gives the whole first page', async () => {
    const tenth = stored[9] as StoredEntry;
    const between = await host.get(caller, `${HISTORY}?limit=3&cursor=${tenth.endedAt}-SES-00000000-0000`);
    // `SES-00000000-0000` sorts before every ID: the position is just after the tenth entry's instant group.
    expect((between.json() as SessionHistoryPage).items.map((item) => item.id)).toEqual(stored.slice(10, 13).map((entry) => entry.id));
    const future = await host.get(caller, `${HISTORY}?limit=3&cursor=${(stored[0]?.endedAt ?? 0) + 1}-SES-99999999-9999`);
    expect((future.json() as SessionHistoryPage).items.map((item) => item.id)).toEqual(stored.slice(0, 3).map((entry) => entry.id));
  });

  it('every role reads the history; nobody without a session does; a limit above the maximum is refused, not cut', async () => {
    for (const role of ['INVESTIGATOR', 'SUPERVISOR'] as const) {
      expect((await host.get(await host.signIn(role), `${HISTORY}?limit=1`)).statusCode).toBe(200);
    }
    expect((await host.get(null, HISTORY)).statusCode).toBe(401);
    const tooMany = await host.get(caller, `${HISTORY}?limit=${API_PAGE_LIMIT_MAX + 1}`);
    expect([tooMany.statusCode, errorOf(tooMany).code, errorOf(tooMany).details]).toEqual([422, 'INVALID_INPUT', { in: 'querystring' }]);
  });

  it('the statement of a page: one read on the pool, by the keyset index; measured', async () => {
    const position = stored[259] as StoredEntry;
    const plan = await host.owner.query<{ 'QUERY PLAN': string }>(
      `EXPLAIN SELECT h.*, e.id FROM public.session_history h LEFT JOIN public.evidence_items e ON e.session_id = h.id
        WHERE (h.ended_at, h.id) < ($1::bigint, $2::text) ORDER BY h.ended_at DESC, h.id DESC LIMIT 51`,
      [position.endedAt, position.id],
    );
    const lines = plan.rows.map((row) => row['QUERY PLAN']);
    const times: number[] = [];
    for (let index = 0; index < 30; index += 1) {
      const began = performance.now();
      const response = await host.get(caller, `${HISTORY}?cursor=${cursorOf(position)}`);
      times.push(performance.now() - began);
      expect(response.statusCode).toBe(200);
    }
    times.sort((a, b) => a - b);
    console.info(
      `[w34] listSessionHistory on 520 rows, a page of 50 from the middle: median ${(times[15] ?? 0).toFixed(2)} ms, max ${(times[29] ?? 0).toFixed(2)} ms (whole request); plan: ${lines
        .map((line) => line.trim())
        .join(' / ')}`,
    );
    expect(lines.join('\n')).toContain('session_history');
  });
});

describe('the keyset when instants are equal, and a session that finishes while a client pages', () => {
  /** A finished session of the fixture's shape, inserted as `dems_owner`: a test's own row. */
  async function insert(pool: Pool, id: string, endedAt: number): Promise<void> {
    await pool.query(
      `INSERT INTO public.session_history (id, outcome, case_number, subject_name, subject_type, investigator_id, room, profile_id, created_at, started_at, ended_at, duration_ms, size_bytes)
       VALUES ($1, 'SEALED', 'LP/2026/1001-0001', 'Tie Subject', 'SAKSI', 'OPR-001', 'Interview Room 1', 'STANDARD_1080P25', $2, $2, $3, 60000, 1000)`,
      [id, endedAt - 60_000, endedAt],
    );
  }

  it('three sessions that ended in the same millisecond are paged by their IDs: each once, whatever the page size; a session that finishes meanwhile is neither repeated nor shifts a later page', async () => {
    const target = await db.another({ template: 'seed', slug: 'w34_history_ties' });
    // The read needs no engine: the app is ready, not booted.
    const host = await sessionsApp(target, db.run.dataDir, { boot: false });
    const caller = await host.signIn('INVESTIGATOR');
    const newest = (await storedHistory(host.owner))[0] as StoredEntry;
    const tie = newest.endedAt + 1_000;
    for (const id of ['SES-20261001-9002', 'SES-20261001-9003', 'SES-20261001-9001']) await insert(host.owner, id, tie);
    const stored = await storedHistory(host.owner);
    expect(stored.slice(0, 3).map((entry) => [entry.id, entry.endedAt])).toEqual([
      ['SES-20261001-9003', tie],
      ['SES-20261001-9002', tie],
      ['SES-20261001-9001', tie],
    ]);

    for (const limit of [1, 2, 3, 4]) {
      const ids = (await walk(host, caller, limit)).flatMap((page) => page.items.map((item) => item.id));
      expect(ids, `limit ${limit}`).toEqual(stored.map((entry) => entry.id));
    }

    // Page 1 of 2 items, then a session finishes (it is the newest now), then page 2 by the cursor.
    const first = (await host.get(caller, `${HISTORY}?limit=2`)).json() as SessionHistoryPage;
    expect(first.items.map((item) => item.id)).toEqual(['SES-20261001-9003', 'SES-20261001-9002']);
    await insert(host.owner, 'SES-20261001-9004', tie + 5_000);
    const second = (await host.get(caller, `${HISTORY}?limit=2&cursor=${first.nextCursor}`)).json() as SessionHistoryPage;
    expect(second.items.map((item) => item.id)).toEqual(['SES-20261001-9001', newest.id]);
    // A fresh first page shows the newcomer.
    const fresh = (await host.get(caller, `${HISTORY}?limit=1`)).json() as SessionHistoryPage;
    expect(fresh.items[0]?.id).toBe('SES-20261001-9004');
    expect(fresh.items[0]?.evidenceId).toBeNull();
  });
});
