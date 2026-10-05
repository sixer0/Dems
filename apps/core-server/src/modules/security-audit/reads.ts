/**
 * The reads of the security-audit module, from PostgreSQL (plan row W39; spec §7.13 operations
 * 58, 59, 60 and 63, §7.1 API-9; database contract §4.12 to §4.14, §4.30, LN-4, LN-5, MR-1).
 *
 * SOURCE OF TRUTH. The engine holds RINGS of the two trails: the newest 1,000 audit rows and
 * the newest 500 events. The tables hold all of them. So the two lists, the head and the total
 * are read from the tables, through the pool of the runtime role: a read needs no unit of work
 * and never waits for the pipeline. One mapping turns a stored row into the row a client gets,
 * the mapping module's (`auditRowFromRow`, `eventFromRow`): the same that rehydrates the ring,
 * so a row of a list equals the row of the realtime channel member by member, with `seq`,
 * `prevHash`, `hash` and its whole hashed body.
 *
 * ORDER AND PAGING. Both lists are ordered by `seq`, the primary key (and the last column of
 * each filter index): the audit list in the order asked for, the events ascending. A page is the
 * rows strictly beyond the cursor's position; one row more than the page is read to know whether
 * another page follows, so the last page never has a cursor and a walk never ends on an empty
 * page. Rows are only ever appended, each with a larger `seq`: a walk returns every row once
 * however many are appended meanwhile.
 *
 * ONE SNAPSHOT PER PAGE. The head, the check of the cursor's row and the rows are read in one
 * READ ONLY transaction at REPEATABLE READ: `head` and `total` are of the same instant as the
 * rows, so `total` is never smaller than a `seq` the page shows.
 *
 * THE CURSOR'S ROW (`cursor.ts`). Before a page is read, the row the cursor names is looked up
 * by its primary key. When the table does not hold it as named, the cursor belongs to a chain
 * that a reset discarded (or to no chain at all): the read says so and reads no page.
 *
 * Every value of a request reaches a statement as a bind parameter. A failure is handed to the
 * caller as the driver threw it; the caller logs its code and never its message.
 */
import type { AuditChainLineageEntry } from '@dems/shared/api';
import type { AuditCategory, AuditRow, AuditType, Severity, SimEvent, SimEventCategory, SimEventType } from '@dems/shared/sim';
import { and, asc, desc, eq, gt, lt, sql, type SQL } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import type { Pool } from 'pg';
import { auditRowFromRow, eventFromRow } from '../../db/mapping';
import { auditChainHead, auditChainHistory, auditLog, events } from '../../db/schema';
import type { AuditCursor, EventCursor } from './cursor';

/** One consistent view of the tables, and no way to write through it. */
const SNAPSHOT = { isolationLevel: 'repeatable read', accessMode: 'read only' } as const;

/** The newest row of the stored chain: its `seq` is the number of rows, its hash the head. */
export interface StoredHead {
  readonly seq: number;
  readonly hash: string;
}

/** The answer of a list read whose cursor names no row of the table. */
export interface CursorUnknown {
  readonly kind: 'CURSOR_UNKNOWN';
}
const CURSOR_UNKNOWN: CursorUnknown = { kind: 'CURSOR_UNKNOWN' };

export interface AuditPageRequest {
  readonly category?: AuditCategory | undefined;
  readonly type?: AuditType | undefined;
  readonly actorId?: string | undefined;
  readonly sessionId?: string | undefined;
  readonly evidenceId?: string | undefined;
  /** By `seq`: the order of the chain, or newest first. */
  readonly order: 'ASC' | 'DESC';
  /** The position of the last row of the page before; absent for the first page. */
  readonly after?: AuditCursor | undefined;
  /** 1 to 200. */
  readonly limit: number;
}

export interface AuditPageRead {
  readonly kind: 'PAGE';
  /** In the order asked for; at most `limit`. */
  readonly rows: AuditRow[];
  /** The stored head and the number of stored rows, at the instant of the rows. */
  readonly head: StoredHead;
  /** The last row of the page when at least one more row follows it, else null. */
  readonly next: AuditRow | null;
}

export interface EventPageRequest {
  readonly category?: SimEventCategory | undefined;
  readonly type?: SimEventType | undefined;
  readonly severity?: Severity | undefined;
  readonly after?: EventCursor | undefined;
  /** 1 to 200. */
  readonly limit: number;
}

export interface EventPageRead {
  readonly kind: 'PAGE';
  /** By `seq`, oldest first; at most `limit`. */
  readonly events: SimEvent[];
  readonly next: SimEvent | null;
}

export interface LineageRead {
  /** The newest entries, newest first; at most the number asked for. */
  readonly entries: AuditChainLineageEntry[];
  /** How many chains were discarded in all. */
  readonly total: number;
}

type Reader = Pick<ReturnType<typeof drizzle>, 'select'>;

async function headOf(reader: Reader): Promise<StoredHead> {
  const rows = await reader.select({ seq: auditChainHead.seq, hash: auditChainHead.hash }).from(auditChainHead).limit(1);
  const head = rows[0];
  // The migration writes the one row of the table, and no role can delete it.
  if (head === undefined) throw new Error('the audit chain has no head row');
  return head;
}

/** The stored head of the audit chain: one statement, one row, so the two values are of one instant. */
export function readStoredHead(pool: Pool): Promise<StoredHead> {
  return headOf(drizzle(pool, { logger: false }));
}

/** One page of the audit list: the filters, then the keyset by `seq`, in one snapshot with the head. */
export async function readAuditPage(pool: Pool, request: AuditPageRequest): Promise<AuditPageRead | CursorUnknown> {
  return drizzle(pool, { logger: false }).transaction(async (snapshot) => {
    const head = await headOf(snapshot);
    const { after } = request;
    if (after !== undefined) {
      const named = await snapshot
        .select({ seq: auditLog.seq })
        .from(auditLog)
        .where(and(eq(auditLog.seq, after.seq), sql`starts_with(${auditLog.hash}, ${after.mark}::text)`))
        .limit(1);
      if (named.length === 0) return CURSOR_UNKNOWN;
    }
    const newestFirst = request.order === 'DESC';
    const conditions: SQL[] = [];
    if (request.category !== undefined) conditions.push(eq(auditLog.category, request.category));
    if (request.type !== undefined) conditions.push(eq(auditLog.type, request.type));
    if (request.actorId !== undefined) conditions.push(eq(auditLog.actorId, request.actorId));
    if (request.sessionId !== undefined) conditions.push(eq(auditLog.sessionId, request.sessionId));
    if (request.evidenceId !== undefined) conditions.push(eq(auditLog.evidenceId, request.evidenceId));
    // Strictly beyond the position, in the order of the walk.
    if (after !== undefined) conditions.push(newestFirst ? lt(auditLog.seq, after.seq) : gt(auditLog.seq, after.seq));
    const stored = await snapshot
      .select()
      .from(auditLog)
      .where(and(...conditions))
      .orderBy(newestFirst ? desc(auditLog.seq) : asc(auditLog.seq))
      .limit(request.limit + 1);

    const rows = stored.slice(0, request.limit).map(auditRowFromRow);
    return { kind: 'PAGE', rows, head, next: stored.length > request.limit ? (rows.at(-1) ?? null) : null };
  }, SNAPSHOT);
}

/** One page of the events: the filters, then the keyset by `seq`, oldest first. */
export async function readEventPage(pool: Pool, request: EventPageRequest): Promise<EventPageRead | CursorUnknown> {
  return drizzle(pool, { logger: false }).transaction(async (snapshot) => {
    const { after } = request;
    if (after !== undefined) {
      const named = await snapshot
        .select({ seq: events.seq })
        .from(events)
        .where(and(eq(events.seq, after.seq), eq(events.at, after.at)))
        .limit(1);
      if (named.length === 0) return CURSOR_UNKNOWN;
    }
    const conditions: SQL[] = [];
    if (request.category !== undefined) conditions.push(eq(events.category, request.category));
    if (request.type !== undefined) conditions.push(eq(events.type, request.type));
    if (request.severity !== undefined) conditions.push(eq(events.severity, request.severity));
    if (after !== undefined) conditions.push(gt(events.seq, after.seq));
    const stored = await snapshot
      .select()
      .from(events)
      .where(and(...conditions))
      .orderBy(asc(events.seq))
      .limit(request.limit + 1);

    const page = stored.slice(0, request.limit).map(eventFromRow);
    return { kind: 'PAGE', events: page, next: stored.length > request.limit ? (page.at(-1) ?? null) : null };
  }, SNAPSHOT);
}

/**
 * The lineage of discarded chains (LN-4, LN-5): the newest `max` rows, newest first, and how
 * many there are in all. One statement: the count is taken over the whole table before the
 * limit cuts the rows, so the list and the total are of one instant. The answer carries the
 * seven members the contract names; `reset_no`, `first_seq` and `last_seq` are not read.
 */
export async function readLineage(pool: Pool, max: number): Promise<LineageRead> {
  const rows = await drizzle(pool, { logger: false })
    .select({
      epoch: auditChainHistory.epoch,
      rows: auditChainHistory.rowCount,
      head: auditChainHistory.headHash,
      resetAt: auditChainHistory.resetAt,
      actorId: auditChainHistory.actorId,
      scenario: auditChainHistory.scenario,
      reason: auditChainHistory.reason,
      total: sql<string>`count(*) OVER ()`,
    })
    .from(auditChainHistory)
    .orderBy(desc(auditChainHistory.resetNo))
    .limit(max);
  return {
    entries: rows.map(({ total: _total, ...entry }) => entry),
    total: Number(rows[0]?.total ?? 0),
  };
}
