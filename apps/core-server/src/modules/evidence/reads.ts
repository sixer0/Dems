/**
 * The two reads of the evidence module, from PostgreSQL (plan row W35; spec §7.9 operations 39
 * and 40, §7.1 API-9; database contract §4.17 to §4.19, MR-1, MR-3).
 *
 * SOURCE OF TRUTH. The contract says of both operations that "the rows come from the stored
 * tables", and the database contract gives the list its keyset cursor and its three indexes
 * (`evidence_items_recorded_at_idx`, `…_status_recorded_at_idx`, `…_case_type_recorded_at_idx`)
 * and the detail read the primary key. So both answer from the tables, through the pool of the
 * runtime role: a read needs no unit of work and never waits for the pipeline.
 *
 * WHY THE ANSWER EQUALS THE ENGINE'S `evidence` SLICE. `evidence` is a stored slice without a
 * ring: a start rehydrates EVERY item, and a hosted command writes its change in the unit that
 * commits before the command resolves. The committed slice and the tables therefore hold the
 * same items at every instant a client can observe, and one mapping turns rows into items in
 * both places: the row builders of `src/db/mapping` (`evidenceItemFromRows`). This file has no
 * mapping of its own and names no column of an item, a track or a custody entry beyond the four
 * it searches and the two it orders by.
 *
 * ONE SNAPSHOT. An item is rows of three tables. They are read in one READ ONLY transaction at
 * REPEATABLE READ, so the item, its tracks and its custody entries are as ONE commit left them:
 * a command that commits between two statements cannot produce an item whose status is of
 * before and whose custody chain is of after.
 *
 * THE SEARCH TEXT is matched "without regard to case" against the evidence ID, the session ID,
 * the case number and the subject name. The cluster's locale is `C`, under which `lower()` and
 * `ILIKE` fold ASCII letters only, so both sides are folded with the Unicode rules of the
 * built-in collation `pg_unicode_fast` (PostgreSQL 18; no extension) and compared with
 * `strpos`: a search text is never a pattern, and `%` and `_` in it are plain characters. It
 * is a sequential scan by design (database contract §4.17, GD-09).
 *
 * Every value of a request reaches a statement as a bind parameter. A failure is handed to the
 * caller as the driver threw it; the caller logs its code and never its message (the query
 * builder's message quotes the statement and its parameters).
 */
import type { CaseType, EvidenceItem, EvidenceStatus } from '@dems/shared/sim';
import { and, desc, eq, inArray, sql, type SQL } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import type { PgColumn } from 'drizzle-orm/pg-core';
import type { Pool } from 'pg';
import { evidenceItemFromRows } from '../../db/mapping';
import { evidenceCustody, evidenceItems, evidenceTracks, type EvidenceCustodyRow, type EvidenceItemRow, type EvidenceTrackRow } from '../../db/schema';
import type { EvidenceCursor } from './cursor';

/** One consistent view of the three tables, and no way to write through it. */
const SNAPSHOT = { isolationLevel: 'repeatable read', accessMode: 'read only' } as const;

export interface EvidencePageRequest {
  readonly status?: EvidenceStatus | undefined;
  readonly caseType?: CaseType | undefined;
  /** Trimmed, 1 to 100 characters: the contract's query schema has checked it. */
  readonly search?: string | undefined;
  /** The position of the last item of the page before; absent for the first page. */
  readonly after?: EvidenceCursor | undefined;
  /** 1 to 200. */
  readonly limit: number;
}

export interface EvidencePageRead {
  /** Newest recording first; at most `limit`. */
  readonly items: EvidenceItem[];
  /** The position of the last item when at least one more item follows it, else null. */
  readonly next: EvidenceCursor | null;
}

/** A text folded by the Unicode rules, whatever the locale of the database is. */
const folded = (text: PgColumn | SQL): SQL => sql`casefold(${text} COLLATE "pg_unicode_fast")`;

/** True for an item one of whose four searched columns holds the search text, without regard to case. */
function matches(search: string): SQL {
  const needle = folded(sql`${search}::text`);
  const holds = (column: PgColumn): SQL => sql`strpos(${folded(column)}, ${needle}) > 0`;
  return sql`(${holds(evidenceItems.id)} OR ${holds(evidenceItems.sessionId)} OR ${holds(evidenceItems.caseNumber)} OR ${holds(evidenceItems.subjectName)})`;
}

function byEvidence<Row extends { readonly evidenceId: string }>(rows: readonly Row[]): Map<string, Row[]> {
  const groups = new Map<string, Row[]>();
  for (const row of rows) {
    const group = groups.get(row.evidenceId);
    if (group === undefined) groups.set(row.evidenceId, [row]);
    else group.push(row);
  }
  return groups;
}

/** The items of item rows, in the order of the rows. Tracks and custody entries are sorted by the mapping. */
function itemsOf(rows: readonly EvidenceItemRow[], tracks: readonly EvidenceTrackRow[], custody: readonly EvidenceCustodyRow[]): EvidenceItem[] {
  const tracksOf = byEvidence(tracks);
  const custodyOf = byEvidence(custody);
  return rows.map((row) => evidenceItemFromRows(row, tracksOf.get(row.id) ?? [], custodyOf.get(row.id) ?? []));
}

/**
 * One page of the list: the filters, then the keyset, in the order `recorded_at DESC, id DESC`.
 * One row more than the page is read, to know whether another page follows.
 */
export async function readEvidencePage(pool: Pool, request: EvidencePageRequest): Promise<EvidencePageRead> {
  return drizzle(pool, { logger: false }).transaction(async (snapshot) => {
    const conditions: SQL[] = [];
    if (request.status !== undefined) conditions.push(eq(evidenceItems.status, request.status));
    if (request.caseType !== undefined) conditions.push(eq(evidenceItems.caseType, request.caseType));
    if (request.search !== undefined) conditions.push(matches(request.search));
    if (request.after !== undefined) {
      // A row comparison: strictly after the position, in the order of the index.
      conditions.push(sql`(${evidenceItems.recordedAt}, ${evidenceItems.id}) < (${request.after.recordedAt}::bigint, ${request.after.id}::text)`);
    }
    const rows = await snapshot
      .select()
      .from(evidenceItems)
      .where(and(...conditions))
      .orderBy(desc(evidenceItems.recordedAt), desc(evidenceItems.id))
      .limit(request.limit + 1);

    const page = rows.slice(0, request.limit);
    const last = page.at(-1);
    if (last === undefined) return { items: [], next: null };

    const ids = page.map((row) => row.id);
    const tracks = await snapshot.select().from(evidenceTracks).where(inArray(evidenceTracks.evidenceId, ids));
    const custody = await snapshot.select().from(evidenceCustody).where(inArray(evidenceCustody.evidenceId, ids));
    return {
      items: itemsOf(page, tracks, custody),
      next: rows.length > request.limit ? { recordedAt: last.recordedAt, id: last.id } : null,
    };
  }, SNAPSHOT);
}

/** One item by its ID, or null when no item has it. */
export async function readEvidenceItem(pool: Pool, evidenceId: string): Promise<EvidenceItem | null> {
  return drizzle(pool, { logger: false }).transaction(async (snapshot) => {
    const rows = await snapshot.select().from(evidenceItems).where(eq(evidenceItems.id, evidenceId)).limit(1);
    const row = rows[0];
    if (row === undefined) return null;
    const tracks = await snapshot.select().from(evidenceTracks).where(eq(evidenceTracks.evidenceId, evidenceId));
    const custody = await snapshot.select().from(evidenceCustody).where(eq(evidenceCustody.evidenceId, evidenceId));
    return evidenceItemFromRows(row, tracks, custody);
  }, SNAPSHOT);
}
