/**
 * The answer of operation 82 `listAudioSourceIntervals` (task 3 integration pass D4; C3 §2.2,
 * §2.3, §2.4 "Mic switch (81-82)"; database contract dbc-3 §B.5; API-9).
 *
 * WHICH SESSION. The open session only: the `{id}` of the path must name it, else `404` (the
 * contract's `NOT_OPEN_SESSION`). The route decides that on the committed state and hands the
 * session ID over; nothing here asks the engine.
 *
 * WHERE THE INTERVALS COME FROM.
 *   capture mode `real`        PostgreSQL, table `session_audio_intervals`: the rows the unit
 *                              `src/capture-session` writes from the capture worker's records
 *                              (the interval of the start, one row per acknowledged switch, the
 *                              close at the end of the audio timeline). `fromMs` / `toMs` are the
 *                              MEDIA times the worker derived, never a wall clock. One statement
 *                              per call on the pool of the runtime role, no unit of work.
 *   capture mode `simulated`   no worker writes that table, so the list is the shared
 *                              simulator's own derivation of the state (`audioSourceIntervalsOf`),
 *                              handed in by the route: the hosted Core and the in-app simulator
 *                              answer the same list for the same state.
 *
 * ORDER AND CURSOR. Newest first: `seq` descending (`seq` is the interval number of the session,
 * part of the primary key, so the order is total). The cursor is the `seq` of the last item of a
 * page, as decimal text; the next page is every interval with a smaller number. An interval that
 * a switch opens while a client pages has a larger number and sorts first: it is neither repeated
 * nor does it shift an item of a later page. A cursor that is not such a number answers
 * `422 INVALID_INPUT`.
 */
import { API_PAGE_LIMIT_DEFAULT, type AudioSourceIntervalEntry, type AudioSourceIntervalPage, type PageQuery } from '@dems/shared/api';
import { and, desc, eq, lt } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { Pool } from 'pg';
import { sessionAudioIntervals } from '../../db/schema';
import { invalidInput } from '../../plugins/error-envelope';

/** Decimal text of an interval number: at most 9 digits, so the value fits the `integer` column. */
const CURSOR_SEQ = /^\d{1,9}$/;

/** The cursor that continues after `entry`. */
export function intervalCursorOf(entry: Pick<AudioSourceIntervalEntry, 'seq'>): string {
  return String(entry.seq);
}

/** The interval number a cursor names, or null when the text is not a cursor of this list. */
export function intervalPositionOf(cursor: string): number | null {
  return CURSOR_SEQ.test(cursor) ? Number(cursor) : null;
}

/** One page of a list that is already newest first: the items after `after`, `limit` at most. */
export function pageOfIntervals(newestFirst: readonly AudioSourceIntervalEntry[], after: number | null, limit: number): AudioSourceIntervalPage {
  const rest = after === null ? newestFirst : newestFirst.filter((entry) => entry.seq < after);
  const items = rest.slice(0, limit);
  const last = items[items.length - 1];
  return { items, nextCursor: rest.length > limit && last !== undefined ? intervalCursorOf(last) : null };
}

/** One page of the stored intervals of a session after `after` (null: from the newest). */
export async function readIntervalPage(pool: Pool, sessionId: string, after: number | null, limit: number): Promise<AudioSourceIntervalPage> {
  // One row more than the page: it tells whether another page follows, without a count.
  const rows = await drizzle(pool)
    .select()
    .from(sessionAudioIntervals)
    .where(after === null ? eq(sessionAudioIntervals.sessionId, sessionId) : and(eq(sessionAudioIntervals.sessionId, sessionId), lt(sessionAudioIntervals.seq, after)))
    .orderBy(desc(sessionAudioIntervals.seq))
    .limit(limit + 1);
  const entries = rows.map(
    (row): AudioSourceIntervalEntry => ({
      sessionId: row.sessionId,
      seq: row.seq,
      inputId: row.micDeviceId,
      role: row.role,
      fromMs: row.fromMediaMs,
      toMs: row.toMediaMs,
      fromAt: row.fromAt,
      toAt: row.toAt,
      switchedBy: row.switchedBy,
      reason: row.reason,
    }),
  );
  return pageOfIntervals(entries, null, limit);
}

/** `source` of the read of operation 82 in a log line and in the persistent error log. */
export const INTERVALS_READ_SOURCE = 'sessions.listAudioSourceIntervals';

/**
 * Operation 82: the page the query asks for. `derived` is the simulator's list of the session
 * (capture mode `simulated`), or null (capture mode `real`: the table is read).
 */
export async function listAudioSourceIntervals(
  app: FastifyInstance,
  request: FastifyRequest,
  sessionId: string,
  query: PageQuery,
  derived: readonly AudioSourceIntervalEntry[] | null,
): Promise<AudioSourceIntervalPage> {
  const after = query.cursor === undefined ? null : intervalPositionOf(query.cursor);
  if (query.cursor !== undefined && after === null) throw invalidInput('querystring');
  const limit = query.limit ?? API_PAGE_LIMIT_DEFAULT;
  if (derived !== null) return pageOfIntervals(derived, after, limit);
  // Through the pool plugin's helper, as the history read: it hands over the current pool, logs a
  // failure as `{ err }` with the request's logger, persists it, tells readiness, and answers 503.
  return app.db.read(INTERVALS_READ_SOURCE, (pool) => readIntervalPage(pool, sessionId, after, limit), request);
}
