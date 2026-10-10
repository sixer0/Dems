// The evidence module at the volume of the bulk template: 515 stored items, 2,060 tracks, 1,220
// custody entries (plan row W35; spec §7.1 API-9, §7.9; database contract §4.17, §11; decision
// D73 DN-1 and DN-6; module gate MODG).
//
// The real app, booted on a clone of `tpl_bulk`, with the clock at the template's instant. The
// operators are the SEEDED ones (no fixture operator can sign in). The list is paged and
// asserted in the contract's order, `recorded_at DESC, id DESC`: a total order by a sealed
// column and the key, never by a row's `at`.
import { EvidenceDetailSchema, EvidencePageSchema, EvidenceVerifyResultSchema, LIST_CURSOR_PATTERN, validateCoreApiResponse, type EvidencePage } from '@dems/shared/api';
import { CaseType, EvidenceStatus, type EvidenceItem } from '@dems/shared/sim';
import type { Pool } from 'pg';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { useTestDatabase } from '../../../../test/helpers/db';
import { BULK_TEMPLATE_NOW } from '../../../db/fixtures/__tests__/template-hook.bulk';
import { UNICODE_SAMPLE } from '../../../db/fixtures/world';
import { mediaRefOf } from '../media';
import {
  EVIDENCE,
  allSealedDigest,
  archiveUrl,
  countOf,
  evidenceApp,
  exportUrl,
  inListOrder,
  itemUrl,
  onTheWire,
  outcomeOf,
  sealedDigest,
  storedCustody,
  storedState,
  trackListsOf,
  trackRowVersions,
  trailLength,
  trailSince,
  verifyUrl,
  type EvidenceApp,
  type Headers,
} from './support';

const db = useTestDatabase({ template: 'bulk' });
let host: EvidenceApp;
let owner: Pool;
let investigator: Headers;
let supervisor: Headers;

const FOUR_TRACKS = ['VIDEO-01', 'VIDEO-02', 'AUDIO-01', 'AUDIO-02'];
const TOTAL = 515;

const committed = (): EvidenceItem[] => inListOrder(host.engine.slice('evidence'));

async function list(query = '', session: Headers = investigator): Promise<EvidencePage> {
  const response = await host.get(`${EVIDENCE}${query}`, session);
  expect(response.statusCode, query).toBe(200);
  return EvidencePageSchema.parse(response.json());
}

async function walk(query: string): Promise<{ pages: EvidencePage[]; items: EvidencePage['items'] }> {
  const pages: EvidencePage[] = [];
  let cursor: string | null = null;
  do {
    host.forgetCounters();
    const separator: string = query === '' ? '?' : '&';
    const page: EvidencePage = await list(cursor === null ? query : `${query}${separator}cursor=${cursor}`);
    pages.push(page);
    cursor = page.nextCursor;
    if (pages.length > 600) throw new Error('the walk does not end');
  } while (cursor !== null);
  return { pages, items: pages.flatMap((page) => page.items) };
}

const stored = async (where = 'TRUE'): Promise<number> => {
  // `where` is a constant of this file, never a value of a request.
  const { rows } = await owner.query<{ rows: string }>(`SELECT count(*)::text AS rows FROM public.evidence_items WHERE ${where}`);
  return Number(rows[0]?.rows);
};

beforeAll(async () => {
  owner = db.ownerPool();
  host = await evidenceApp(db, db.run.dataDir, { startAt: BULK_TEMPLATE_NOW });
  investigator = await host.signIn('INVESTIGATOR');
  supervisor = await host.signIn('SUPERVISOR');
});

beforeEach(() => {
  host.forgetCounters();
});

describe('the bulk template: what is stored and what the engine holds', () => {
  it('515 items, 2,060 tracks and 1,220 custody entries are stored, and the engine rehydrated EVERY item: evidence is a slice without a ring', async () => {
    expect(await countOf(owner, 'evidence_items')).toBe(TOTAL);
    expect(await countOf(owner, 'evidence_tracks')).toBe(2_060);
    expect(await countOf(owner, 'evidence_custody')).toBe(1_220);
    expect(host.engine.slice('evidence')).toHaveLength(TOTAL);
    // The rings ARE cut: the engine holds 1,000 of the 5,000 audit rows. Evidence is not one of them.
    expect(host.engine.slice('audit').rows).toHaveLength(1_000);
    expect(host.engine.slice('audit').total).toBeGreaterThanOrEqual(5_000);
    console.info(`[w35] bulk: stored items ${TOTAL}, engine slice ${host.engine.slice('evidence').length}; audit rows stored ${host.engine.slice('audit').total}, in the engine's ring ${host.engine.slice('audit').rows.length}`);
  });

  it('the order of the list is total: no two items share a recording instant and an ID', () => {
    const keys = committed().map((item) => `${item.recordedAt}-${item.id}`);
    expect(new Set(keys).size).toBe(TOTAL);
    const instants = committed().map((item) => item.recordedAt);
    expect(instants).toEqual([...instants].sort((a, b) => b - a));
  });
});

describe('operation 39 listEvidence at volume', () => {
  it('SOURCE OF TRUTH: the default page size walks all 515 stored items in 11 pages, and the walk IS the engine\'s committed slice, member by member', async () => {
    const { pages, items } = await walk('');
    expect(pages.map((page) => page.items.length)).toEqual([...Array<number>(10).fill(50), 15]);
    expect(items).toHaveLength(TOTAL);
    expect(new Set(items.map((item) => item.id)).size).toBe(TOTAL);
    expect(items).toStrictEqual(onTheWire(committed()));
    for (const page of pages.slice(0, -1)) expect(page.nextCursor).toMatch(LIST_CURSOR_PATTERN);
    expect(pages.at(-1)?.nextCursor).toBeNull();
  });

  it('the largest page is 200: three pages of 200, 200 and 115, the same items in the same order; every page validates against the contract', async () => {
    const started = performance.now();
    const { pages, items } = await walk('?limit=200');
    const elapsed = performance.now() - started;
    expect(pages.map((page) => page.items.length)).toEqual([200, 200, 115]);
    expect(items).toStrictEqual(onTheWire(committed()));
    for (const page of pages) expect(validateCoreApiResponse('listEvidence', 200, page)).toEqual({ ok: true });
    console.info(`[w35] bulk: 515 items in 3 pages of 200 read, mapped, validated and serialised in ${elapsed.toFixed(0)} ms (in-process, ${pages.length * 5} statements)`);
  });

  it('small and odd page sizes give the same list: 1 (the first 12 pages), 7, 64 and 199', async () => {
    const whole = onTheWire(committed());
    let cursor: string | null = null;
    const first: EvidencePage['items'] = [];
    for (let page = 0; page < 12; page += 1) {
      const answer: EvidencePage = await list(cursor === null ? '?limit=1' : `?limit=1&cursor=${cursor}`);
      expect(answer.items).toHaveLength(1);
      first.push(...answer.items);
      cursor = answer.nextCursor;
    }
    expect(first).toStrictEqual(whole.slice(0, 12));
    for (const limit of [7, 64, 199]) {
      const { pages, items } = await walk(`?limit=${limit}`);
      expect(items, `limit ${limit}`).toStrictEqual(whole);
      expect(pages, `limit ${limit}`).toHaveLength(Math.ceil(TOTAL / limit));
    }
  });

  it('AC-B-70: all 515 items list exactly VIDEO-01, VIDEO-02, AUDIO-01 and AUDIO-02, each track with its own hash', async () => {
    const { pages } = await walk('?limit=200');
    const lists = pages.flatMap((page) => trackListsOf(page));
    expect(lists).toHaveLength(TOTAL);
    expect(lists.every((tracks) => tracks.length === 4 && tracks.every((trackId, index) => trackId === FOUR_TRACKS[index]))).toBe(true);
    for (const item of pages.flatMap((page) => page.items)) {
      const audio = item.tracks.filter((track) => track.trackId === 'AUDIO-01' || track.trackId === 'AUDIO-02');
      if (audio.length !== 2 || audio[0]?.sha256 === audio[1]?.sha256) throw new Error(`${item.id} does not hold two separate audio tracks`);
    }
  });

  it('status: every value answers the stored count of that status, walked in pages of 50; together they are the 515', async () => {
    const counts: Record<string, number> = {};
    for (const status of Object.values(EvidenceStatus)) {
      const { items } = await walk(`?status=${status}`);
      expect(items, status).toStrictEqual(onTheWire(committed().filter((item) => item.status === status)));
      expect(items.length, status).toBe(await stored(`status = '${status}'`));
      counts[status] = items.length;
    }
    expect(counts).toEqual({ RECORDED: 15, SEALED: 410, EXPORTED: 40, UNDER_REVIEW: 20, ARCHIVED: 30 });
    console.info(`[w35] bulk: items by status ${JSON.stringify(counts)}`);
  });

  it('caseType: every value answers the stored count of that case type; a status and a case type together narrow both', async () => {
    let total = 0;
    for (const caseType of Object.values(CaseType)) {
      const { items } = await walk(`?caseType=${caseType}&limit=200`);
      expect(items, caseType).toStrictEqual(onTheWire(committed().filter((item) => item.caseType === caseType)));
      expect(items.length, caseType).toBe(await stored(`case_type = '${caseType}'`));
      total += items.length;
      const both = await walk(`?caseType=${caseType}&status=ARCHIVED&limit=200`);
      expect(both.items, caseType).toStrictEqual(onTheWire(committed().filter((item) => item.caseType === caseType && item.status === 'ARCHIVED')));
    }
    expect(total).toBe(TOTAL);
  });

  it('q matches text outside ASCII without regard to case, which the locale of the cluster (C) alone would not: diacritics, CJK, and characters outside the Basic Multilingual Plane', async () => {
    const all = committed();
    const withSample = all.filter((item) => item.subjectName.includes(UNICODE_SAMPLE));
    expect(withSample.length).toBeGreaterThan(5);
    const idsOf = async (text: string, more = ''): Promise<string[]> => (await walk(`?q=${encodeURIComponent(text)}${more}`)).items.map((item) => item.id);
    const expected = withSample.map((item) => item.id);

    const [latin = '', cjk = '', , gothic = '', satellite = ''] = UNICODE_SAMPLE.split(' ');
    // As stored, and with every letter in the other case: 'ünïcødé' is searched as 'ÜNÏCØDÉ'.
    expect(latin.toUpperCase()).not.toBe(latin);
    expect(await idsOf(latin)).toEqual(expected);
    expect(await idsOf(latin.toUpperCase())).toEqual(expected);
    expect(await idsOf(`(${latin.toUpperCase()} ${cjk}`)).toEqual(expected);
    expect(await idsOf(cjk)).toEqual(expected);
    // Two characters JavaScript holds as surrogate pairs: a Gothic letter and an emoji.
    expect(gothic).toHaveLength(2);
    expect(await idsOf(gothic)).toEqual(expected);
    expect(await idsOf(satellite)).toEqual(expected);
    expect(await idsOf(UNICODE_SAMPLE.toUpperCase())).toEqual(expected);
    // With a filter and small pages the search is still the same set, narrowed.
    expect(await idsOf(latin.toUpperCase(), '&status=SEALED&limit=3')).toEqual(withSample.filter((item) => item.status === 'SEALED').map((item) => item.id));
    // An ASCII text in another case finds the fixture's 502 subjects, and a part of an ID finds its item.
    expect(await idsOf('FIXTURE SUBJECT', '&limit=200')).toEqual(all.filter((item) => item.subjectName.toLowerCase().includes('fixture subject')).map((item) => item.id));
    const one = all[300];
    expect(await idsOf(one?.id.toLowerCase() ?? '')).toEqual([one?.id]);
    console.info(`[w35] bulk: ${expected.length} of 515 subjects hold the Unicode sample; found by it in upper case, by its CJK part and by each of its two astral characters`);
  });

  it('the keyset is answered through the index of the order: the row comparison is an index condition of evidence_items_recorded_at_idx', async () => {
    const position = committed()[250];
    const client = await owner.connect();
    try {
      await client.query('BEGIN');
      // Not a question of cost here: with the sequential scan and the sort priced out, the plan
      // that is left must still exist, which shows the keyset CAN be read in index order.
      await client.query('SET LOCAL enable_seqscan = off');
      await client.query('SET LOCAL enable_sort = off');
      // EXPLAIN takes no bind parameter; both values are of this test's own state, an integer and an ID of a checked form.
      if (position === undefined || !Number.isSafeInteger(position.recordedAt) || !/^EV-\d{8}-\d{4}$/.test(position.id)) throw new Error('no position');
      const plan = await client.query<{ 'QUERY PLAN': string }>(
        `EXPLAIN (COSTS OFF) SELECT id FROM public.evidence_items WHERE (recorded_at, id) < (${position.recordedAt}::bigint, '${position.id}'::text) ORDER BY recorded_at DESC, id DESC LIMIT 51`,
      );
      const text = plan.rows.map((row) => row['QUERY PLAN']).join('\n');
      expect(text).toContain('evidence_items_recorded_at_idx');
      expect(text).toMatch(/Index Cond: \(ROW\(recorded_at, id\) < ROW\(/);
      expect(text).not.toContain('Sort');
      console.info(`[w35] bulk: plan of the keyset page\n${text.split('\n').map((line) => `[w35]   ${line}`).join('\n')}`);
    } finally {
      await client.query('ROLLBACK');
      client.release();
    }
  });
});

describe('operation 40 getEvidence at volume', () => {
  it('MS-2: the 13 dataset items answer DEMO_PACKAGE and every one of the 502 fixture items NONE, also the one whose number a package uses', async () => {
    const all = committed();
    const joined = all.filter((item) => mediaRefOf(item).source === 'DEMO_PACKAGE');
    expect(joined).toHaveLength(13);
    expect(joined.map((item) => item.id.slice(-4)).sort()).toEqual(Array.from({ length: 13 }, (_, index) => String(index + 1).padStart(4, '0')));

    // Through the route: the 13, the fixture item numbered 0014, and a sample of the rest.
    const numbered14 = all.find((item) => item.id.endsWith('-0014'));
    if (numbered14 === undefined) throw new Error('the fixture has an item numbered 0014');
    const sample = [...joined, numbered14, ...all.filter((_, index) => index % 41 === 0)];
    for (const item of sample) {
      host.forgetCounters();
      const response = await host.get(itemUrl(item.id), investigator);
      expect(response.statusCode, item.id).toBe(200);
      expect(validateCoreApiResponse('getEvidence', 200, response.json()), item.id).toEqual({ ok: true });
      const detail = EvidenceDetailSchema.parse(response.json());
      expect(detail.evidence, item.id).toStrictEqual(onTheWire(item));
      // Wave H C1 (G94-01): an item with no package in the Core's store and no bundled one answers NONE WITH ITS REASON.
      const bundled = mediaRefOf(item);
      expect(detail.media, item.id).toEqual(bundled.source === 'NONE' ? { ...bundled, reason: 'NOT_A_SEALED_PACKAGE' } : bundled);
      expect(trackListsOf(response.json()), item.id).toEqual([FOUR_TRACKS]);
    }
    const detail14 = EvidenceDetailSchema.parse((await host.get(itemUrl(numbered14.id), investigator)).json());
    expect(detail14.media).toEqual({ source: 'NONE', packageSuffix: null, reason: 'NOT_A_SEALED_PACKAGE' });
  });

  it('text outside ASCII comes back as it was stored: a subject, a note and a marker label with the Unicode sample', async () => {
    const item = committed().find((entry) => entry.subjectName.includes(UNICODE_SAMPLE));
    if (item === undefined) throw new Error('the fixture has such an item');
    const detail = EvidenceDetailSchema.parse((await host.get(itemUrl(item.id), investigator)).json());
    expect(detail.evidence.subjectName).toBe(item.subjectName);
    expect(detail.evidence.subjectName).toContain('\u{10348}');
    expect(detail.evidence).toStrictEqual(onTheWire(item));
  });
});

describe('the three commands on fixture items', () => {
  it('a tampered fixture item fails its verification on its tampered track, and a sealed one passes; the sealed rows of both are byte-equal afterwards', async () => {
    const all = committed();
    const tampered = all.find((item) => item.tampered && item.id.slice(-4) > '0013');
    const clean = all.find((item) => !item.tampered && item.status === 'SEALED' && item.id.slice(-4) > '0013' && item.verification.status === 'NOT_RUN');
    if (tampered === undefined || clean === undefined) throw new Error('the fixture has such items');
    for (const [item, ok] of [[tampered, false], [clean, true]] as const) {
      const before = { digest: await sealedDigest(owner, item.id), versions: await trackRowVersions(owner, item.id), custody: await storedCustody(owner, item.id) };
      const response = await host.post(verifyUrl(item.id), investigator);
      expect(response.statusCode).toBe(200);
      expect(validateCoreApiResponse('verifyEvidence', 200, response.json())).toEqual({ ok: true });
      const verdict = EvidenceVerifyResultSchema.parse(response.json());
      expect(verdict.ok).toBe(ok);
      expect(verdict.tracks.map((track) => track.trackId)).toEqual(FOUR_TRACKS);
      expect(verdict.tracks.filter((track) => !track.ok).map((track) => track.trackId)).toEqual(ok ? [] : [item.tamperedTrackId]);
      expect(await sealedDigest(owner, item.id)).toEqual(before.digest);
      expect(await trackRowVersions(owner, item.id)).toEqual(before.versions);
      const custody = await storedCustody(owner, item.id);
      expect(custody.slice(0, before.custody.length)).toEqual(before.custody);
      expect(custody.at(-1)?.action).toBe(ok ? 'VERIFIED' : 'VERIFY_FAILED');
    }
  });

  it('an export continues the stored export counter, an archive of an archived item writes nothing, an export of a RECORDED or an ARCHIVED item is refused; the sealed rows of all 515 items do not move', async () => {
    const all = committed();
    const fixture = (pick: (item: EvidenceItem) => boolean): EvidenceItem => {
      const found = all.find((item) => item.id.slice(-4) > '0013' && pick(item));
      if (found === undefined) throw new Error('the fixture has such an item');
      return found;
    };
    const sealed = fixture((item) => item.status === 'SEALED' && !item.tampered);
    const archived = fixture((item) => item.status === 'ARCHIVED');
    const recorded = fixture((item) => item.status === 'RECORDED');
    const whole = await allSealedDigest(owner);
    expect(whole.rows).toBe(TOTAL + 2_060);
    const exportsBefore = await countOf(owner, 'exports');
    const trailBefore = await trailLength(owner);

    const exported = await host.post(exportUrl(sealed.id), supervisor, { reason: 'Prosecutor request' });
    expect(exported.statusCode).toBe(202);
    // The fixture's exports end at EXP-000090; the counter it stored is 91.
    // Pass F-Z: the 202 answer names its job too (optional `jobId` since passes D4 / D5 / F-M8): `EXPJ-` + the six digits of the export ID.
    expect(exported.json()).toEqual({ exportId: 'EXP-000091', jobId: 'EXPJ-000091', evidenceId: sealed.id, status: 'QUEUED' }) // op 42 answers QUEUED as landed (C3 §3);
    expect(await countOf(owner, 'exports')).toBe(exportsBefore + 1);

    const custody = await storedCustody(owner, archived.id);
    expect((await host.post(archiveUrl(archived.id), supervisor)).statusCode).toBe(204);
    expect(await storedCustody(owner, archived.id)).toEqual(custody);

    expect(outcomeOf(await host.post(exportUrl(recorded.id), supervisor, { reason: 'Prosecutor request' }))).toEqual([409, 'NOT_SEALED']);
    expect(outcomeOf(await host.post(exportUrl(archived.id), supervisor, { reason: 'Prosecutor request' }))).toEqual([409, 'NOT_SEALED']);
    expect(outcomeOf(await host.post(archiveUrl(recorded.id), supervisor))).toEqual([409, 'NOT_SEALED']);

    expect((await host.post(archiveUrl(sealed.id), supervisor)).statusCode).toBe(204);
    expect(await storedState(owner, sealed.id)).toMatchObject({ status: 'ARCHIVED' });

    // Two commands changed state; each wrote one row. Nothing sealed moved, in any of the 2,575 rows.
    expect((await trailSince(owner, trailBefore)).map((row) => row.type)).toEqual(['EVIDENCE_EXPORTED', 'EVIDENCE_ARCHIVED']);
    expect(await allSealedDigest(owner)).toEqual(whole);
    console.info(`[w35] bulk: SHA-256 of all ${whole.rows} sealed rows (515 items, 2,060 tracks) ${whole.digest} before and after an export, three refusals and two archives`);

    // And the list is the engine's slice again.
    const { items } = await walk('?limit=200');
    expect(items).toStrictEqual(onTheWire(committed()));
  });
});
