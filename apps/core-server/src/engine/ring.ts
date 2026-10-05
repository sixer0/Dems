/**
 * Rows that somebody else appended to the one chain, taken into the engine's rings (plan row
 * W26; spec ENG-8, ENG-10; `21_core_services.md` §4.2, finding F-9).
 *
 * The engine keeps a ring of the newest 1,000 audit rows and 500 events, and the head, the
 * total and the event counter that its next row continues. A server-native module (identity,
 * the permission guard, pairing, administration) appends its rows through the core's writers,
 * which build them with the same shared code on the STORED head. Those rows are in the tables
 * and not in the ring, so the engine's next row would not continue the head (AP-6).
 *
 * `mergeTrail` adds such rows to the ring exactly as the shared `appendAudit` would have:
 * newest last, at most the ring size, `total`, `head` and `dropped` moved on, and the event
 * counter raised above the newest event. Pure: it returns the slices that changed, by new
 * reference, and leaves every row object as it is.
 */
import { AUDIT_RING_SIZE, EVENT_RING_SIZE, pushRing, type AuditRow, type SimEvent, type SimState } from '@dems/shared/sim';

export type TrailSlices = Pick<SimState, 'audit' | 'events' | 'meta'>;

/** Why rows could not be merged: they do not continue what the engine holds. */
export class TrailMismatch extends Error {
  /** The engine's total, and the sequence of the first row that does not continue it. */
  readonly engineSeq: number;
  readonly rowSeq: number;

  constructor(engineSeq: number, rowSeq: number) {
    super('the rows do not continue the engine ring');
    this.name = 'TrailMismatch';
    this.engineSeq = engineSeq;
    this.rowSeq = rowSeq;
  }
}

/**
 * The slices of `state` after `auditRows` and `events` were appended, or the same references
 * when there is nothing new. Rows at or below the ring's total and events below the counter are
 * skipped: the engine built them itself. Throws `TrailMismatch` when the first new audit row
 * does not continue the ring's head.
 */
export function mergeTrail(state: TrailSlices, auditRows: readonly AuditRow[], events: readonly SimEvent[]): Partial<TrailSlices> {
  const merged: { audit?: SimState['audit']; events?: SimState['events']; meta?: SimState['meta'] } = {};

  const freshRows = auditRows.filter((row) => row.seq > state.audit.total);
  if (freshRows.length > 0) {
    let head = { seq: state.audit.total, hash: state.audit.head };
    for (const row of freshRows) {
      if (row.seq !== head.seq + 1 || row.prevHash !== head.hash) throw new TrailMismatch(head.seq, row.seq);
      head = { seq: row.seq, hash: row.hash };
    }
    const rows = pushRing(state.audit.rows, freshRows, AUDIT_RING_SIZE);
    merged.audit = { rows, head: head.hash, total: head.seq, dropped: head.seq - rows.length };
  }

  const freshEvents = events.filter((event) => event.seq >= state.meta.counters.event);
  if (freshEvents.length > 0) {
    merged.events = pushRing(state.events, freshEvents, EVENT_RING_SIZE);
    const next = Math.max(...freshEvents.map((event) => event.seq)) + 1;
    merged.meta = { ...state.meta, counters: { ...state.meta.counters, event: next } };
  }
  return merged;
}

/** True when `merged` holds anything. */
export function hasTrail(merged: Partial<TrailSlices>): boolean {
  return merged.audit !== undefined || merged.events !== undefined || merged.meta !== undefined;
}
