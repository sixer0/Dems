// Two states of the stored evidence that neither template holds, made as `dems_owner` on this
// file's own clones (plan row W35; spec §7.1 API-9; database contract §4.17, MR-1):
//
//   1. several items with the SAME recording instant: the order of the list is still total,
//      because the ID breaks the tie, and a keyset walk neither repeats nor skips one of them;
//   2. a stored row the one mapping refuses: the read is a defect of the data, answered 500 and
//      reported as an unexpected failure, not "the database does not answer".
import { EvidencePageSchema, type EvidencePage } from '@dems/shared/api';
import type { EvidenceItem } from '@dems/shared/sim';
import type { Pool } from 'pg';
import { describe, expect, it, vi } from 'vitest';
import { useTestDatabase } from '../../../../test/helpers/db';
import type { ErrorLogEntry } from '../../../plugins/logger';
import { EVIDENCE, evidenceApp, inListOrder, itemUrl, onTheWire, outcomeOf, type EvidenceApp, type Headers } from './support';

const db = useTestDatabase({ template: 'seed' });

async function walk(host: EvidenceApp, session: Headers, limit: number): Promise<EvidencePage['items']> {
  const items: EvidencePage['items'] = [];
  let cursor: string | null = null;
  let pages = 0;
  do {
    host.forgetCounters();
    const response = await host.get(`${EVIDENCE}?limit=${limit}${cursor === null ? '' : `&cursor=${cursor}`}`, session);
    expect(response.statusCode).toBe(200);
    const page: EvidencePage = EvidencePageSchema.parse(response.json());
    items.push(...page.items);
    cursor = page.nextCursor;
    pages += 1;
    if (pages > 100) throw new Error('the walk does not end');
  } while (cursor !== null);
  return items;
}

describe('items that share a recording instant', () => {
  it('the ID breaks the tie: every page size walks all 13 items once, in recorded_at DESC, id DESC', async () => {
    const target = await db.another({ slug: 'w35_ties' });
    const owner: Pool = target.ownerPool();
    // Before the server starts: the four newest recordings get the instant of the fourth, so
    // four items are tied (an earlier instant keeps `ended_at >= recorded_at` true).
    const newest = await owner.query<{ id: string; recorded_at: string }>('SELECT id, recorded_at::text FROM public.evidence_items ORDER BY recorded_at DESC, id DESC LIMIT 4');
    const shared = newest.rows[3]?.recorded_at;
    const tied = newest.rows.map((row) => row.id);
    expect(tied).toHaveLength(4);
    await owner.query('UPDATE public.evidence_items SET recorded_at = $1 WHERE id = ANY($2)', [shared, tied]);
    const distinct = await owner.query<{ instants: string }>('SELECT count(DISTINCT recorded_at)::text AS instants FROM public.evidence_items');
    expect(Number(distinct.rows[0]?.instants)).toBe(10);

    const host = await evidenceApp(target, db.run.dataDir);
    const session = await host.signIn('INVESTIGATOR');
    const expected = onTheWire(inListOrder(host.engine.slice('evidence')));
    // The four tied items lead the list, highest ID first.
    expect(expected.slice(0, 4).map((item) => item.id)).toEqual([...tied].sort().reverse());
    expect(new Set(expected.slice(0, 4).map((item) => item.recordedAt)).size).toBe(1);

    for (const limit of [1, 2, 3, 4, 5, 13]) {
      const items = await walk(host, session, limit);
      expect(items.map((item) => item.id), `limit ${limit}`).toEqual(expected.map((item: EvidenceItem) => item.id));
      expect(items, `limit ${limit}`).toStrictEqual(expected);
    }
  });
});

describe('a stored row the mapping refuses', () => {
  it('answers 500 INTERNAL_ERROR, is reported as an unexpected failure by the envelope, and does not make the server report the database as not ready', async () => {
    const target = await db.another({ slug: 'w35_unreadable' });
    const owner: Pool = target.ownerPool();
    const host = await evidenceApp(target, db.run.dataDir);
    const session = await host.signIn('SUPERVISOR');
    const item = host.engine.slice('evidence')[0];
    if (item === undefined) throw new Error('the seed has evidence');
    expect((await host.get(itemUrl(item.id), session)).statusCode).toBe(200);

    // A row no program of the server can write: the CHECK that forbids it is taken away in this
    // clone, as the owner, and the stored signature is marked as not simulated.
    await owner.query('ALTER TABLE public.evidence_items DROP CONSTRAINT evidence_items_signature_check');
    await owner.query('UPDATE public.evidence_items SET signature_simulated = false WHERE id = $1', [item.id]);

    const persisted: ErrorLogEntry[] = [];
    vi.spyOn(host.app.errorLog, 'append').mockImplementation((entry) => void persisted.push(entry));
    const from = host.log.lines().length;
    for (const url of [itemUrl(item.id), EVIDENCE]) {
      const response = await host.get(url, session);
      expect(outcomeOf(response), url).toEqual([500, 'INTERNAL_ERROR']);
      // The answer says nothing about the row.
      expect(response.body).not.toContain('signature');
      expect(response.body).not.toContain(item.id);
    }
    const lines = host.log.lines().slice(from);
    // Not the line of a failed read (the pool plugin's `app.db.read`) and no entry of the module's read: the data is at
    // fault, not the database.
    expect(lines.filter((line) => line['msg'] === 'a read on the pool failed')).toEqual([]);
    expect(lines.filter((line) => line['msg'] === 'unexpected error while handling a request')).toHaveLength(2);
    expect(persisted.filter((entry) => entry.source.startsWith('evidence.'))).toEqual([]);
    expect(persisted.filter((entry) => entry.source === 'error-envelope.errorHandler')).toHaveLength(2);
    expect(persisted[0]).toMatchObject({ level: 'error', errorName: 'MappingError', code: 'ROW_SHAPE' });
    expect(host.app.readiness.snapshot()).toEqual({ database: true, engine: true });
    // Another item is still read.
    const other = host.engine.slice('evidence')[1];
    expect((await host.get(itemUrl(other?.id ?? ''), session)).statusCode).toBe(200);
    expect(host.database.connections.inUse).toBe(0);
  });
});
