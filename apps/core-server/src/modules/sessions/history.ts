/**
 * The answer of operation 38 `listSessionHistory` (plan row W34; spec §7.1 API-9, §7.8; database
 * contract §4.16, MR-3, MR-5).
 *
 * WHERE IT READS. PostgreSQL, on the pool of the runtime role: one statement per call, no unit
 * of work (a read changes nothing). The table `session_history` is append-only for the runtime
 * role and holds every finished session; the engine writes a row in the unit that finishes the
 * session, so a page read after a POST answered holds that session.
 *
 * ORDER AND CURSOR. Newest first, by the keyset `(ended_at DESC, id DESC)`: the order of the
 * index `session_history_ended_at_idx` and of the engine's `sessionHistory` slice (MR-3). `id`
 * is the primary key, so the order is total and a page boundary can fall between two sessions
 * that ended in the same millisecond. The table has no sequence column; this keyset is its
 * stable order. The cursor is the position of the last item of a page, `<endedAt>-<id>`, which
 * fits the contract's cursor pattern. The next page is "everything after that position", so a
 * session that finishes while a client pages (it sorts first) is neither repeated nor does it
 * shift an item out of a later page.
 *
 * A cursor that is not a position of this list answers `422 INVALID_INPUT`. Each item is the
 * mapping module's `SessionHistoryEntry` of its row (`sessionHistoryFromRow`): the one mapping
 * between rows and slices. `evidenceId` is no column: it is the evidence item of the session,
 * which a unique key allows at most once (MR-5). `unsealableCause` is no column either: it is the
 * cause the audit trail holds for a session whose seal was given up (`readUnsealableCauses`).
 */
import { API_PAGE_LIMIT_DEFAULT, SESSION_ID_PATTERN, type PageQuery, type SessionHistoryPage } from '@dems/shared/api';
import type { SessionHistoryEntry } from '@dems/shared/sim';
import { and, asc, desc, eq, inArray, sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { Pool } from 'pg';
import { sessionHistoryFromRow } from '../../db/mapping';
import { auditLog, evidenceItems, sessionHistory } from '../../db/schema';
import { invalidInput } from '../../plugins/error-envelope';

/** A position in the list: the keyset of one item. */
export interface HistoryPosition {
  readonly endedAt: number;
  readonly id: string;
}

const CURSOR_SEPARATOR = '-';
/** Epoch milliseconds as decimal text: at most 16 digits, so the value is a safe integer or refused. */
const CURSOR_INSTANT = /^\d{1,16}$/;

/** The cursor that continues after `entry`. */
export function cursorOf(entry: Pick<SessionHistoryEntry, 'endedAt' | 'id'>): string {
  return `${entry.endedAt}${CURSOR_SEPARATOR}${entry.id}`;
}

/** The position a cursor names, or null when the text is not a cursor of this list. */
export function positionOf(cursor: string): HistoryPosition | null {
  const cut = cursor.indexOf(CURSOR_SEPARATOR);
  if (cut <= 0) return null;
  const instant = cursor.slice(0, cut);
  const id = cursor.slice(cut + CURSOR_SEPARATOR.length);
  if (!CURSOR_INSTANT.test(instant) || !SESSION_ID_PATTERN.test(id)) return null;
  const endedAt = Number(instant);
  return Number.isSafeInteger(endedAt) ? { endedAt, id } : null;
}

/** The audit type and the reason of the row the engine writes when it gives a seal up (`endUnsealableTransition`). */
const UNSEALABLE_AUDIT_TYPE = 'SESSION_INCOMPLETE';
const UNSEALABLE_REASON = 'UNSEALABLE';
/** The form of a cause code (`SEAL_UNSEALABLE_CAUSE_CODE` of the shared simulator): anything else in a row is not answered. */
const UNSEALABLE_CAUSE_CODE = /^[A-Z][A-Z0-9_]{1,63}$/;

/** A session that recorded, ended INCOMPLETE and has no evidence item: the only entries a given-up seal writes. */
const isQuarantinedEntry = (entry: SessionHistoryEntry): boolean => entry.outcome === 'INCOMPLETE' && entry.startedAt !== null && entry.evidenceId === null;

/**
 * WHY THE SEAL OF EACH OF THESE SESSIONS WAS GIVEN UP (fix wave J round two; finding JW-22, remainder): the
 * `details.cause` of the audit row `SESSION_INCOMPLETE` with `details.reason: UNSEALABLE` of the session -
 * the record the Core stored when it ended the session, read as it is. `session_history` has no column for
 * it and gets none: the trail is append-only and keeps every row, so the cause of the oldest session is
 * still there. One statement, and none at all for a page without such a session; the index
 * `(session_id, seq)` serves it. A session whose trail holds no such row gets no member (nothing is guessed
 * from the fault kind). The first row of a session wins: a session ends once.
 */
export async function readUnsealableCauses(pool: Pool, sessionIds: readonly string[]): Promise<ReadonlyMap<string, string>> {
  const causes = new Map<string, string>();
  if (sessionIds.length === 0) return causes;
  const rows = await drizzle(pool)
    .select({ sessionId: auditLog.sessionId, cause: sql<string | null>`${auditLog.details} ->> 'cause'` })
    .from(auditLog)
    .where(and(inArray(auditLog.sessionId, [...sessionIds]), eq(auditLog.type, UNSEALABLE_AUDIT_TYPE), sql`${auditLog.details} ->> 'reason' = ${UNSEALABLE_REASON}`))
    .orderBy(asc(auditLog.seq));
  for (const row of rows) {
    if (row.sessionId === null || causes.has(row.sessionId)) continue;
    if (typeof row.cause === 'string' && UNSEALABLE_CAUSE_CODE.test(row.cause)) causes.set(row.sessionId, row.cause);
  }
  return causes;
}

/** One page of the stored history after `after` (null: from the newest), `limit` items at most. */
export async function readHistoryPage(pool: Pool, after: HistoryPosition | null, limit: number): Promise<SessionHistoryPage> {
  // One row more than the page: it tells whether another page follows, without a count.
  const rows = await drizzle(pool)
    .select({ entry: sessionHistory, evidenceId: evidenceItems.id })
    .from(sessionHistory)
    .leftJoin(evidenceItems, eq(evidenceItems.sessionId, sessionHistory.id))
    .where(after === null ? undefined : sql`(${sessionHistory.endedAt}, ${sessionHistory.id}) < (${after.endedAt}, ${after.id})`)
    .orderBy(desc(sessionHistory.endedAt), desc(sessionHistory.id))
    .limit(limit + 1);
  const entries = rows.slice(0, limit).map((row) => sessionHistoryFromRow(row.entry, row.evidenceId));
  const causes = await readUnsealableCauses(pool, entries.filter(isQuarantinedEntry).map((entry) => entry.id));
  const items = entries.map((entry) => {
    const cause = causes.get(entry.id);
    return cause === undefined ? entry : { ...entry, unsealableCause: cause };
  });
  const last = items[items.length - 1];
  return { items, nextCursor: rows.length > limit && last !== undefined ? cursorOf(last) : null };
}

/** `source` of the read of operation 38 in a log line and in the persistent error log. */
export const HISTORY_READ_SOURCE = 'sessions.listSessionHistory';

/** Operation 38: the page the query asks for, read from PostgreSQL. */
export async function listSessionHistory(app: FastifyInstance, request: FastifyRequest, query: PageQuery): Promise<SessionHistoryPage> {
  const after = query.cursor === undefined ? null : positionOf(query.cursor);
  if (query.cursor !== undefined && after === null) throw invalidInput('querystring');
  // Through the pool plugin's helper (review finding CPB1-8): it hands over the current pool (a
  // reset replaces the pool). A failure is the database's, not the caller's: the helper logs it
  // as `{ err }` with the request's logger (rule M14: the query builder's error carries the
  // statement, its parameters and the server's DETAIL, and the logger's serializer drops them),
  // persists the name, the code and the stack frames, tells readiness, and answers 503.
  return app.db.read(HISTORY_READ_SOURCE, (pool) => readHistoryPage(pool, after, query.limit ?? API_PAGE_LIMIT_DEFAULT), request);
}
