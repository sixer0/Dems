// Operations 39 and 40 against PostgreSQL as `dems_app`, on a clone of the seed template (plan
// row W35; spec §7.9, §7.1 API-9, §11; SR-66; AC-B-70; module gate MODG).
//
// The real app, booted, with every stage as the server has it, on a manual clock and a manual
// timer. Operators are the seeded ones, signed in on the web console. What is stored is read as
// `dems_owner`. The same reads at the volume of the bulk template are in `bulk.db.test.ts`.
import { EVIDENCE_MEDIA_DEMONSTRATION_RECORD_EXAMPLE, EvidenceDetailSchema, EvidencePageSchema, LIST_CURSOR_PATTERN, validateCoreApiResponse, type EvidenceDetail, type EvidencePage } from '@dems/shared/api';
import { CaseType, EvidenceStatus, type EvidenceItem } from '@dems/shared/sim';
import type { Pool } from 'pg';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { useTestDatabase } from '../../../../test/helpers/db';
import { readEvents } from '../../../../test/support/core';
import type { ErrorLogEntry } from '../../../plugins/logger';
import { bearer, deviceSignIn, insertPairedDevice } from '../../../../test/support/identity';
import { decodeEvidenceCursor } from '../cursor';
import {
  EVIDENCE,
  LIVE_SESSION,
  UNKNOWN_EVIDENCE_ID,
  errorOf,
  evidenceApp,
  inListOrder,
  itemUrl,
  onTheWire,
  outcomeOf,
  principalOf,
  sealSession,
  trackListsOf,
  trailLength,
  trailSince,
  verifyUrl,
  type EvidenceApp,
  type Headers,
} from './support';

const db = useTestDatabase({ template: 'seed' });
let host: EvidenceApp;
let owner: Pool;
let investigator: Headers;
let supervisor: Headers;
let technician: Headers;

const FOUR_TRACKS = ['VIDEO-01', 'VIDEO-02', 'AUDIO-01', 'AUDIO-02'];
/** The statements of one read of a page that holds items, and of one that holds none. */
const BEGIN = 'begin isolation level repeatable read read only';

const committed = (): EvidenceItem[] => inListOrder(host.engine.slice('evidence'));
const pageOf = (body: unknown): EvidencePage => EvidencePageSchema.parse(body);
const detailOf = (body: unknown): EvidenceDetail => EvidenceDetailSchema.parse(body);

async function list(query = '', session: Headers = investigator): Promise<EvidencePage> {
  const response = await host.get(`${EVIDENCE}${query}`, session);
  expect(response.statusCode, query).toBe(200);
  expect(validateCoreApiResponse('listEvidence', 200, response.json()), query).toEqual({ ok: true });
  return pageOf(response.json());
}

/** Every page of the list for a query, by following `nextCursor`. */
async function walk(query: string, session: Headers = investigator): Promise<{ pages: EvidencePage[]; items: EvidencePage['items'] }> {
  const pages: EvidencePage[] = [];
  let cursor: string | null = null;
  do {
    const separator: string = query === '' ? '?' : '&';
    const page: EvidencePage = await list(cursor === null ? query : `${query}${separator}cursor=${cursor}`, session);
    pages.push(page);
    cursor = page.nextCursor;
    if (pages.length > 600) throw new Error('the walk does not end');
  } while (cursor !== null);
  return { pages, items: pages.flatMap((page) => page.items) };
}

beforeAll(async () => {
  owner = db.ownerPool();
  host = await evidenceApp(db, db.run.dataDir);
  investigator = await host.signIn('INVESTIGATOR');
  supervisor = await host.signIn('SUPERVISOR');
  technician = await host.signIn('TECHNICIAN');
});

beforeEach(() => {
  host.forgetCounters();
});

describe('operation 39 listEvidence on the seeded database', () => {
  it('answers the 13 stored items, newest recording first, in the contract\'s shape; the last page has no cursor', async () => {
    const page = await list();
    expect(page.items).toHaveLength(13);
    expect(page.nextCursor).toBeNull();
    const instants = page.items.map((item) => item.recordedAt);
    expect(instants).toEqual([...instants].sort((a, b) => b - a));
    expect(new Set(page.items.map((item) => item.id)).size).toBe(13);
  });

  it('SOURCE OF TRUTH: what PostgreSQL answers is, item by item and member by member, the engine\'s committed evidence slice', async () => {
    const page = await list();
    expect(page.items).toStrictEqual(onTheWire(committed()));
    // And it is what is stored: the count of the table, as dems_owner.
    const stored = await owner.query<{ rows: string }>('SELECT count(*)::text AS rows FROM public.evidence_items');
    expect(page.items).toHaveLength(Number(stored.rows[0]?.rows));
  });

  it('every role holds EVIDENCE_VIEW: the INVESTIGATOR, the SUPERVISOR and the TECHNICIAN get the same list', async () => {
    const [first, second, third] = [await list('', investigator), await list('', supervisor), await list('', technician)];
    expect(second).toEqual(first);
    expect(third).toEqual(first);
  });

  it('AC-B-70: every item lists exactly four tracks, VIDEO-01, VIDEO-02, AUDIO-01 and AUDIO-02, and the two audio tracks have their own hashes', async () => {
    const response = await host.get(EVIDENCE, supervisor);
    const lists = trackListsOf(response.json());
    expect(lists).toHaveLength(13);
    // Fix wave J (truth rule 3a): every SEALED item lists its four tracks; the one item that was never sealed lists none
    // (it has no track hash) - an answer never lists half of an audio pair either way.
    const sealedItems = pageOf(response.json()).items.filter((item) => item.sealedAt !== null);
    expect(lists.filter((tracks) => tracks.length > 0)).toHaveLength(sealedItems.length);
    expect(lists.filter((tracks) => tracks.length === 0)).toHaveLength(1);
    for (const tracks of lists) if (tracks.length > 0) expect(tracks).toEqual(FOUR_TRACKS);
    for (const item of sealedItems) {
      const audio = item.tracks.filter((track) => track.trackId.startsWith('AUDIO'));
      expect(audio.map((track) => track.trackId)).toEqual(['AUDIO-01', 'AUDIO-02']);
      expect(audio[0]?.sha256).not.toBe(audio[1]?.sha256);
      expect(new Set(item.tracks.map((track) => track.sha256)).size).toBe(4);
    }
  });

  it('NONE-R: a read writes no audit row and no event, opens no unit of work, publishes nothing and moves no revision', async () => {
    const before = { trail: await trailLength(owner), events: (await readEvents(owner)).length, units: host.app.pipeline.snapshot().completed, published: host.publications.length, revision: host.engine.revision };
    const sent = host.database.statements.length;
    await list();
    await list('?status=SEALED&limit=2');
    await host.get(itemUrl(committed()[0]?.id ?? ''), investigator);
    await host.get(itemUrl(UNKNOWN_EVIDENCE_ID), investigator);
    expect({ trail: await trailLength(owner), events: (await readEvents(owner)).length, units: host.app.pipeline.snapshot().completed, published: host.publications.length, revision: host.engine.revision }).toEqual(before);
    // Every statement of the four reads is a `begin … read only`, a SELECT or a `commit`.
    const statements = host.database.statements.slice(sent);
    expect(statements.filter((text) => text === BEGIN)).toHaveLength(4);
    expect(statements.every((text) => text === BEGIN || text === 'commit' || text.startsWith('select '))).toBe(true);
  });

  it('one page is ONE snapshot: begin read only at REPEATABLE READ, the items, their tracks, their custody entries, commit (5 statements); an empty page is 3', async () => {
    const sent = host.database.statements.length;
    await list('?limit=4');
    const full = host.database.statements.slice(sent);
    expect(full).toHaveLength(5);
    expect(full[0]).toBe(BEGIN);
    expect(full[1]).toMatch(/^select .* from "evidence_items" order by "evidence_items"\."recorded_at" desc, "evidence_items"\."id" desc limit \$1$/);
    expect(full[2]).toMatch(/^select .* from "evidence_tracks" where "evidence_tracks"\."evidence_id" in \(\$1, \$2, \$3, \$4\)$/);
    expect(full[3]).toMatch(/^select .* from "evidence_custody" where "evidence_custody"\."evidence_id" in \(\$1, \$2, \$3, \$4\)$/);
    expect(full[4]).toBe('commit');

    const emptyFrom = host.database.statements.length;
    expect((await list('?status=ARCHIVED')).items).toEqual([]);
    expect(host.database.statements.slice(emptyFrom)).toHaveLength(3);
    console.info(`[w35] round trips of listEvidence: ${full.length} for a page with items (begin, items, tracks, custody, commit), 3 for an empty page`);
  });
});

describe('operation 39: paging by a keyset cursor (API-9)', () => {
  it('limit 5 walks the 13 items in three pages of 5, 5 and 3, without a repeat and without a gap, in the order of the whole list', async () => {
    const { pages, items } = await walk('?limit=5');
    expect(pages.map((page) => page.items.length)).toEqual([5, 5, 3]);
    expect(items).toStrictEqual(onTheWire(committed()));
    expect(pages[2]?.nextCursor).toBeNull();
  });

  it('a cursor is the position of the last item of its page, fits the contract\'s pattern, and names no more than the page did', async () => {
    const page = await list('?limit=5');
    const cursor = page.nextCursor ?? '';
    expect(cursor).toMatch(LIST_CURSOR_PATTERN);
    const last = page.items.at(-1);
    expect(decodeEvidenceCursor(cursor)).toEqual({ recordedAt: last?.recordedAt, id: last?.id });
  });

  it('every limit from 1 to 14 gives the same 13 items in the same order; a page that ends exactly at the last item has no cursor', async () => {
    const whole = onTheWire(committed());
    for (let limit = 1; limit <= 14; limit += 1) {
      host.forgetCounters();
      const { pages, items } = await walk(`?limit=${limit}`);
      expect(items, `limit ${limit}`).toStrictEqual(whole);
      expect(pages, `limit ${limit}`).toHaveLength(Math.ceil(13 / limit));
      expect(pages.every((page) => page.items.length <= limit)).toBe(true);
    }
    expect((await list('?limit=13')).nextCursor).toBeNull();
    expect((await list('?limit=12')).nextCursor).not.toBeNull();
  });

  it('the default page is 50 and the largest 200: both hold all 13 here', async () => {
    expect((await list()).items).toHaveLength(13);
    expect((await list('?limit=200')).items).toHaveLength(13);
  });

  it('a cursor past the oldest item answers an empty last page, and one before the newest the whole list', async () => {
    const all = committed();
    const oldest = all.at(-1);
    expect(await list(`?cursor=${oldest?.recordedAt}-${oldest?.id}`)).toEqual({ items: [], nextCursor: null });
    expect(await list('?cursor=0-EV-00000000-0000')).toEqual({ items: [], nextCursor: null });
    expect((await list('?cursor=9007199254740991-EV-99991231-9999')).items).toHaveLength(13);
  });

  it('a cursor works together with a filter: the walk of a filtered list is the filtered list', async () => {
    const sealed = onTheWire(committed().filter((item) => item.status === EvidenceStatus.SEALED));
    expect(sealed.length).toBeGreaterThan(3);
    const { pages, items } = await walk('?status=SEALED&limit=3');
    expect(items).toStrictEqual(sealed);
    expect(pages).toHaveLength(Math.ceil(sealed.length / 3));
  });
});

describe('operation 39: the filters', () => {
  it('status: each value of the vocabulary answers exactly the items of that status', async () => {
    const counts: Record<string, number> = {};
    for (const status of Object.values(EvidenceStatus)) {
      const page = await list(`?status=${status}`);
      expect(page.items, status).toStrictEqual(onTheWire(committed().filter((item) => item.status === status)));
      counts[status] = page.items.length;
    }
    expect(Object.values(counts).reduce((sum, value) => sum + value, 0)).toBe(13);
    expect(counts[EvidenceStatus.RECORDED]).toBe(1);
    expect(counts[EvidenceStatus.EXPORTED]).toBe(1);
    expect(counts[EvidenceStatus.UNDER_REVIEW]).toBe(1);
    expect(counts[EvidenceStatus.ARCHIVED]).toBe(0);
    console.info(`[w35] seed: items by status ${JSON.stringify(counts)}`);
  });

  it('caseType: each value answers exactly the items of that case type; with a status both must hold', async () => {
    let total = 0;
    for (const caseType of Object.values(CaseType)) {
      const page = await list(`?caseType=${caseType}`);
      expect(page.items, caseType).toStrictEqual(onTheWire(committed().filter((item) => item.caseType === caseType)));
      total += page.items.length;
      const both = await list(`?caseType=${caseType}&status=SEALED`);
      expect(both.items, caseType).toStrictEqual(onTheWire(committed().filter((item) => item.caseType === caseType && item.status === 'SEALED')));
    }
    expect(total).toBe(13);
  });

  it('q: matched without regard to case against the evidence ID, the session ID, the case number and the subject name', async () => {
    const all = committed();
    const target = all[3];
    if (target === undefined) throw new Error('the seed has evidence');
    const found = async (text: string): Promise<string[]> => (await list(`?q=${encodeURIComponent(text)}`)).items.map((item) => item.id);
    const expected = (text: string): string[] => {
      const needle = text.trim().toLowerCase();
      return all
        .filter((item) => [item.id, item.sessionId, item.caseNumber, item.subjectName].some((value) => value.toLowerCase().includes(needle)))
        .map((item) => item.id);
    };

    // Each of the four columns, in the case it is stored in and in another one.
    for (const text of [target.id, target.id.toLowerCase(), target.sessionId, target.sessionId.toLowerCase(), target.caseNumber, target.caseNumber.toLowerCase(), target.subjectName, target.subjectName.toUpperCase(), target.subjectName.toLowerCase()]) {
      const ids = await found(text);
      expect(ids, text).toEqual(expected(text));
      expect(ids, text).toContain(target.id);
    }
    // A part of a value is enough, and white space around the text is not part of it.
    expect(await found(target.id.slice(-9))).toEqual(expected(target.id.slice(-9)));
    expect(await found(`  ${target.subjectName.split(' ')[0]?.toUpperCase()}  `)).toEqual(expected(target.subjectName.split(' ')[0] ?? ''));
    expect(await found('ev-')).toHaveLength(13);
    expect(await found('ses-')).toHaveLength(13);
    expect(await found('lp/')).toHaveLength(13);
    // Nothing else is searched: not the room, not the investigator, not a hash.
    expect(await found(target.room)).toEqual(expected(target.room));
    expect(await found(target.manifestHash.slice(0, 12))).toEqual([]);
    expect(await found('no such text anywhere')).toEqual([]);
  });

  it('q is a text, never a pattern: the wildcard characters of LIKE are plain characters', async () => {
    const found = async (text: string): Promise<number> => (await list(`?q=${encodeURIComponent(text)}`)).items.length;
    // As a LIKE pattern each of these would match all 13 items.
    expect(await found('%')).toBe(0);
    expect(await found('_')).toBe(0);
    expect(await found('EV-%-0004')).toBe(0);
    expect(await found('EV-________-0004')).toBe(0);
    expect(await found('\\')).toBe(0);
    expect(await found("' OR '1'='1")).toBe(0);
    expect(await found('"; DROP TABLE evidence_items; --')).toBe(0);
    expect((await list()).items).toHaveLength(13);
  });
});

describe('operation 40 getEvidence', () => {
  it('answers each of the 13 items as the engine holds it, with the media reference of its bundled package', async () => {
    for (const item of committed()) {
      const response = await host.get(itemUrl(item.id), investigator);
      expect(response.statusCode, item.id).toBe(200);
      expect(validateCoreApiResponse('getEvidence', 200, response.json()), item.id).toEqual({ ok: true });
      const detail = detailOf(response.json());
      expect(detail.evidence, item.id).toStrictEqual(onTheWire(item));
      // MS-2: the dataset items join their package on the seed day; the suffix is the four digits of the ID.
      expect(detail.media, item.id).toEqual({ source: 'DEMO_PACKAGE', packageSuffix: item.id.slice(-4) });
      // Fix wave J (truth rule 3a): a sealed item lists its four tracks; the one item that was never sealed lists none.
      expect(trackListsOf(response.json())).toEqual([item.sealedAt === null ? [] : FOUR_TRACKS]);
    }
  });

  it('SR-66, MS-3: the answer holds a reference and no file: no path, no URL, no file name, and exactly two members of media', async () => {
    const response = await host.get(itemUrl(committed()[0]?.id ?? ''), supervisor);
    const body = response.json() as { media: Record<string, unknown> };
    // Wave H C1: beside the item and its media reference the Core states what THIS caller may do (`access`: three booleans).
    // Fix wave K (G94b-11 / -12): the Core's default export destination is a text beside them - no path, no URL, no file name.
    // Fix wave J (JA2-03 / JW-03): and the export outputs it can produce (`exportKinds`: kinds, booleans and a reason code).
    expect(Object.keys(body).sort()).toEqual(['access', 'evidence', 'exportDestinationDefault', 'exportKinds', 'media']);
    expect((body as unknown as { exportKinds: unknown }).exportKinds).toEqual([{ kind: 'PACKAGE', available: true }, { kind: 'COMPOSITE', available: false, reason: 'COMPOSITE_ENCODER_NOT_SELECTED' }]);
    expect((body as unknown as { access: unknown }).access).toEqual({ play: true, readTranscript: true, export: true });
    expect(Object.keys(body.media).sort()).toEqual(['packageSuffix', 'source']);
    expect(JSON.stringify(body.media)).not.toMatch(/[\\/]|\.\.|\.mp4|\.wav|https?:|file:|assets|demo-evidence/i);
    expect(response.headers['content-type']).toMatch(/^application\/json/);
    // No operation of the module answers bytes: every answer of it is JSON or empty.
    expect(response.headers['content-disposition']).toBeUndefined();
  });

  it('one item is one snapshot too: begin read only, the item, its tracks, its custody entries, commit; an unknown ID is 3 statements', async () => {
    const sent = host.database.statements.length;
    await host.get(itemUrl(committed()[0]?.id ?? ''), investigator);
    const found = host.database.statements.slice(sent);
    expect(found).toHaveLength(5);
    expect(found[0]).toBe(BEGIN);
    expect(found[1]).toMatch(/from "evidence_items" where "evidence_items"\."id" = \$1 limit \$2$/);
    expect(found[4]).toBe('commit');
    const from = host.database.statements.length;
    await host.get(itemUrl(UNKNOWN_EVIDENCE_ID), investigator);
    expect(host.database.statements.slice(from)).toHaveLength(3);
    console.info(`[w35] round trips of getEvidence: ${found.length} for an item (begin, item, tracks, custody, commit), 3 for an unknown ID`);
  });

  it('an unknown ID answers 404 NOT_FOUND in the form a hosted action\'s own refusal has', async () => {
    const response = await host.get(itemUrl(UNKNOWN_EVIDENCE_ID), technician);
    expect(outcomeOf(response)).toEqual([404, 'NOT_FOUND']);
    expect(errorOf(response)).toMatchObject({ message: 'Evidence not found.', details: { simCode: 'NOT_FOUND' } });
    expect(validateCoreApiResponse('getEvidence', 404, response.json())).toEqual({ ok: true });
  });

  it('an ID that is no evidence ID answers 422 INVALID_INPUT and is never sent to the database', async () => {
    const sent = host.database.statements.length;
    for (const id of ['EV-2026093-0004', 'ev-20260930-0004', "EV-20260930-0004'--", '..%2F..%2Fetc%2Fpasswd']) {
      const response = await host.get(itemUrl(id), supervisor);
      expect(outcomeOf(response), id).toEqual([422, 'INVALID_INPUT']);
      expect(errorOf(response).details).toEqual({ in: 'params' });
    }
    expect(host.database.statements.slice(sent).filter((text) => text.includes('evidence_'))).toEqual([]);
  });

  it('nobody without a session reads an item or the list: 401, and no row', async () => {
    const before = await trailLength(owner);
    expect(outcomeOf(await host.get(EVIDENCE))).toEqual([401, 'NOT_SIGNED_IN']);
    expect(outcomeOf(await host.get(itemUrl(committed()[0]?.id ?? '')))).toEqual([401, 'NOT_SIGNED_IN']);
    expect(await trailLength(owner)).toBe(before);
  });
});

describe('a read while the database fails', () => {
  it('a statement of the read that fails: 503 NOT_READY, one error line with the driver\'s code under the key err, the snapshot rolled back, and the next read answers again', async () => {
    const sent = host.database.statements.length;
    const left = host.database.failNext(/from "evidence_tracks"/, '57P01');
    const response = await host.get(EVIDENCE, investigator);
    expect(left()).toBe(0);
    expect(outcomeOf(response)).toEqual([503, 'NOT_READY']);
    expect(validateCoreApiResponse('listEvidence', 503, response.json())).toEqual({ ok: true });
    // The one line of the pool plugin's helper (`app.db.read`).
    expect(host.log.lines().filter((line) => line['msg'] === 'a read on the pool failed').at(-1)).toMatchObject({ level: 50, source: 'evidence.listEvidence', err: { code: '57P01' } });
    // The snapshot transaction of the failed read was rolled back, and its connection given back.
    const statements = host.database.statements.slice(sent);
    expect(statements[0]).toBe(BEGIN);
    expect(statements.at(-1)).toBe('rollback');
    expect(statements).toHaveLength(4);
    expect(host.database.connections.inUse).toBe(0);
    // The probe that followed found the database answering: the server stays ready.
    await host.app.db.probe({ fresh: true });
    expect(host.app.readiness.snapshot()).toEqual({ database: true, engine: true });
    expect((await list()).items).toHaveLength(13);
  });

  it('rule M14: a failing statement whose bind parameter is the search text leaves nothing of the statement and nothing of the text in the log or in the persistent error log', async () => {
    const mark = 'MARK-w35-search-5521';
    const persisted: ErrorLogEntry[] = [];
    const spy = vi.spyOn(host.app.errorLog, 'append').mockImplementation((entry) => void persisted.push(entry));
    try {
      const from = host.log.lines().length;
      // The item statement itself fails, as the query builder sends it: with the search text bound.
      const left = host.database.failNext(/from "evidence_items" where/, '42883');
      const response = await host.get(`${EVIDENCE}?status=SEALED&q=${mark}`, investigator);
      expect(left()).toBe(0);
      expect(outcomeOf(response)).toEqual([503, 'NOT_READY']);
      expect(response.body).not.toContain(mark);

      const lines = host.log.lines().slice(from);
      const failure = lines.find((line) => line['msg'] === 'a read on the pool failed');
      expect(failure).toMatchObject({ level: 50, source: 'evidence.listEvidence', err: { code: '42883' } });
      // The line holds the name of the read and the error under `err`, as the logger's serializer writes it (rule M14):
      // its type, its code and its stack frames. No statement, no parameter, under any key.
      expect(Object.keys(failure ?? {}).filter((key) => !['level', 'time', 'pid', 'hostname', 'reqId', 'msg'].includes(key)).sort()).toEqual(['err', 'source']);
      expect(failure?.['reqId']).toBeTypeOf('string');
      const written = lines.map((line) => JSON.stringify(line)).join('\n');
      for (const forbidden of [mark, 'casefold', 'evidence_items', 'select ', 'strpos', 'Failed query', 'params']) expect(written, forbidden).not.toContain(forbidden);

      const own = persisted.filter((entry) => entry.source === 'evidence.listEvidence');
      expect(own).toHaveLength(1);
      expect(own[0]).toMatchObject({ level: 'error', message: 'a read on the pool failed', code: '42883', context: { requestId: failure?.['reqId'] } });
      const stored = JSON.stringify(persisted);
      for (const forbidden of [mark, 'casefold', 'evidence_items', 'Failed query']) expect(stored, forbidden).not.toContain(forbidden);
      // The request line names the route pattern, never the query string.
      expect(lines.find((line) => line['msg'] === 'request completed')).toBeDefined();
    } finally {
      spy.mockRestore();
    }
    await host.app.db.probe({ fresh: true });
    expect((await list(`?q=${mark}`)).items).toEqual([]);
  });
});

describe('evidence made by the engine while a client walks the list (plan rule: no route of the sessions module is used)', () => {
  let live: EvidenceItem;
  let firstPage: EvidencePage;

  it('a session sealed between two pages does not shift the walk: the cursor of page 1 still leads to the same page 2', async () => {
    const before = onTheWire(committed());
    firstPage = await list('?limit=5');
    expect(firstPage.items).toStrictEqual(before.slice(0, 5));

    live = await sealSession(host);
    expect(host.engine.slice('evidence')).toHaveLength(14);

    const second = await list(`?limit=5&cursor=${firstPage.nextCursor}`);
    const third = await list(`?limit=5&cursor=${second.nextCursor}`);
    // The walk that started before the seal ends with exactly the 13 items it started over.
    expect([...firstPage.items, ...second.items, ...third.items]).toStrictEqual(before);
    expect(third.nextCursor).toBeNull();
  });

  it('the new item is the newest: it is first in a new walk, and the list equals the engine\'s slice again (14 items)', async () => {
    const page = await list();
    expect(page.items).toHaveLength(14);
    expect(page.items[0]?.id).toBe(live.id);
    expect(page.items).toStrictEqual(onTheWire(committed()));
    expect(page.items[0]).toMatchObject({ status: 'SEALED', sessionId: live.sessionId, caseNumber: 'LP/2026/1001-0099', subjectName: 'Test Subject', integritySource: 'SIMULATED', tampered: false });
    expect(page.items[0]?.tracks.map((track) => track.trackId)).toEqual(FOUR_TRACKS);
    expect(page.items[0]?.custody.length).toBeGreaterThanOrEqual(1);
  });

  it('MS-2: a session recorded in Live mode has no bundled media, also when its evidence number is one a demo package uses', async () => {
    // The 14th item of the day takes the number of the recording scenario's package.
    expect(live.id.slice(-4)).toBe('0014');
    const response = await host.get(itemUrl(live.id), investigator);
    const detail = detailOf(response.json());
    // Fix wave J (JA2-02): a session a Core in SIMULATED capture sealed is a demonstration record WITHOUT media, and the
    // answer says exactly that - not "no sealed package of this item is in the evidence store" beside a Summary that stored one.
    expect(detail.media).toEqual(EVIDENCE_MEDIA_DEMONSTRATION_RECORD_EXAMPLE);
    expect(detail.media).toEqual({ source: 'NONE', packageSuffix: null, reason: 'DEMONSTRATION_RECORD' });
    // The same item says the same thing on the item and in the list: SIMULATED (its verdict carries `demonstration: true`: `commands.db.test.ts`).
    expect(detail.evidence).toMatchObject({ integritySource: 'SIMULATED', status: 'SEALED' });
    expect((await list()).items.find((item) => item.id === live.id)).toMatchObject({ integritySource: 'SIMULATED', status: 'SEALED' });
    expect(detail.evidence).toStrictEqual(onTheWire(live));
    expect(validateCoreApiResponse('getEvidence', 200, response.json())).toEqual({ ok: true });
  });

  it('it is found by its case number and its subject, in any case', async () => {
    expect((await list('?q=lp%2F2026%2F1001-0099')).items.map((item) => item.id)).toEqual([live.id]);
    expect((await list('?q=TEST%20SUBJECT')).items.map((item) => item.id)).toEqual([live.id]);
    expect((await list('?caseType=SAKSI&status=SEALED&q=test')).items.map((item) => item.id)).toEqual([live.id]);
  });
});

describe('a session on a paired device (decision D69: a bearer value, no Origin, no cookie)', () => {
  it('reads the list and an item and verifies as the web console does; no answer sets a cookie, and the row names the operator of the session', async () => {
    const device = 'DEV-0001';
    await insertPairedDevice(owner, device, host.operator('SUPERVISOR').id, host.clock.now());
    const credential = host.devices.pair(device);
    const signedIn = await deviceSignIn(host.app, credential, host.operator('INVESTIGATOR').username);
    expect(signedIn.statusCode).toBe(200);
    const session = bearer((signedIn.json() as { sessionToken: string }).sessionToken);
    const item = committed().find((entry) => entry.status === 'SEALED' && !entry.tampered);
    if (item === undefined) throw new Error('the seed has sealed evidence');

    const listed = await host.app.inject({ method: 'GET', url: EVIDENCE, headers: session });
    expect(listed.statusCode).toBe(200);
    expect(pageOf(listed.json())).toStrictEqual(await list());
    const detail = await host.app.inject({ method: 'GET', url: itemUrl(item.id), headers: session });
    expect(detail.statusCode).toBe(200);
    expect(detailOf(detail.json()).evidence).toStrictEqual(onTheWire(item));

    const before = await trailLength(owner);
    const verified = await host.app.inject({ method: 'POST', url: verifyUrl(item.id), headers: session });
    expect(verified.statusCode).toBe(200);
    expect(validateCoreApiResponse('verifyEvidence', 200, verified.json())).toEqual({ ok: true });
    expect((await trailSince(owner, before)).at(-1)).toMatchObject({ type: 'EVIDENCE_VERIFIED', actorId: host.operator('INVESTIGATOR').id, evidenceId: item.id });
    for (const response of [listed, detail, verified]) expect(response.headers['set-cookie']).toBeUndefined();
  });
});

describe('fix wave J round two (JT-11 / JW-13 / JA2-08): what the operator added to a session is on its SEALED item', () => {
  it('operation 40 and operation 39 state the markers, the notes and the session form\'s note the Core stored for the session - read from the item\'s own row, the same for every role that may read the item', async () => {
    const actor = principalOf('INVESTIGATOR');
    const FORM_NOTE = 'Second interview; counsel present.';
    await host.engine.setTabletLink('CONNECTED');
    const created = await host.engine.command(actor, 'createSession', { ...LIVE_SESSION, caseNumber: 'LP/2026/1001-0100', subjectName: 'Annotated Subject', notes: `  ${FORM_NOTE} `, investigatorId: actor.operatorId });
    if (!created.value.ok || !created.value.created) throw new Error('the engine did not create the session');
    const sessionId = created.value.sessionId;
    await host.engine.command(actor, 'beginPrecheck');
    await host.drive(5_000);
    if (host.engine.slice('session')?.state === 'PRECHECK') await host.engine.command(actor, 'acknowledgePrecheckWarnings');
    await host.engine.command(actor, 'startRecording');
    await host.drive(2_000);
    await host.engine.command(actor, 'addMarker', 'Key statement');
    await host.drive(500);
    await host.engine.command(actor, 'addNote', 'Subject asked for a break.');
    await host.engine.command(actor, 'snapshot');
    const open = host.engine.slice('session');
    await host.engine.command(actor, 'stopRecording', 'Interview completed');
    await host.drive(20_000);
    const item = host.engine.slice('evidence').find((entry) => entry.sessionId === sessionId);
    if (item === undefined || item.status !== 'SEALED') throw new Error('the session did not seal');
    await host.engine.command(actor, 'acknowledgeSummary', sessionId);
    await host.app.pipeline.drain();

    // WHAT THE CORE STORED, as dems_owner: the two lists in the item's own row; the open session (and with it the form's field) is gone.
    const stored = (await owner.query<{ markers: unknown[]; notes: Array<Record<string, unknown>> }>('SELECT markers, notes FROM public.evidence_items WHERE id = $1', [item.id])).rows[0];
    const marker = open?.timeline.find((entry) => entry.kind === 'MARKER');
    expect(stored?.markers).toEqual([{ id: marker?.id, at: marker?.at, index: 1, label: 'Key statement' }]);
    expect(stored?.notes).toEqual([
      { id: 'NOTE-FORM', at: open?.createdAt, authorId: actor.operatorId, text: FORM_NOTE, origin: 'SESSION_FORM' },
      { id: open?.notes[0]?.id, at: open?.notes[0]?.at, authorId: actor.operatorId, text: 'Subject asked for a break.' },
    ]);

    // THE ANSWERS: exactly the stored lists, by name, for each role; valid against the contract.
    for (const session of [investigator, supervisor, technician]) {
      const response = await host.get(itemUrl(item.id), session);
      expect(response.statusCode).toBe(200);
      const detail = detailOf(response.json());
      expect(detail.evidence.markers).toEqual(stored?.markers);
      expect(detail.evidence.notes).toEqual(stored?.notes);
      expect(validateCoreApiResponse('getEvidence', 200, response.json())).toEqual({ ok: true });
    }
    const listed = (await list('?q=LP%2F2026%2F1001-0100')).items;
    expect(listed.map((entry) => entry.id)).toEqual([item.id]);
    expect(listed[0]?.markers).toEqual(stored?.markers);
    expect(listed[0]?.notes).toEqual(stored?.notes);
    // The snapshot is a mark of the session and an audit row: the item has no member for it (no picture exists).
    expect(open?.snapshotCount).toBe(1);
    expect(Object.keys(detailOf((await host.get(itemUrl(item.id), supervisor)).json()).evidence).filter((key) => /snapshot/i.test(key))).toEqual([]);
    // CONTROL: the item of a session nobody annotated (the one sealed above, no form note) carries two empty lists - never another session's.
    const plain = (await list('?q=LP%2F2026%2F1001-0099')).items[0];
    expect(plain?.markers).toEqual([]);
    expect(plain?.notes).toEqual([]);
  });
});
