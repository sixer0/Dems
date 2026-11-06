/**
 * What changed between two committed states, as the operations of one state change (plan row
 * W26; spec §9.3 RT-3, ENG-4).
 *
 * Pure. Change detection is by REFERENCE, as for the write-through: the shared code never
 * mutates a slice, so a slice whose reference did not change did not change (ENG-4). A slice
 * that changed is sent whole (`replace`), with two exceptions that the contract names: `audit`
 * and `events` are rings that only grow at the end, so their new rows are sent (`append`). When
 * a ring row changed in place (the `AUDIT_TAMPER` demo fault and its clearing, spec §9.3) the
 * ring is replaced as a whole.
 *
 * The operations come in the order of the durable slice list: stored slices first, snapshot
 * slices after.
 */
import { DURABLE_SLICE_KEYS, STORED_SLICE_KEYS, type DurableSliceKey, type DurableSlices } from '../db/mapping';
import type { EngineDeltaOp } from './types';

const STORED: ReadonlySet<string> = new Set(STORED_SLICE_KEYS);

/**
 * The rows `next` holds beyond `previous`, when `next` is `previous` with rows dropped off its
 * front and rows added at its end, every kept row the SAME object. Null when a kept row was
 * replaced, or when `next` kept more than `previous` held: then it is not an append.
 */
export function appendedRows<Row extends { readonly seq: number }>(previous: readonly Row[], next: readonly Row[]): Row[] | null {
  const lastSeq = previous.at(-1)?.seq ?? Number.NEGATIVE_INFINITY;
  let split = next.findIndex((row) => row.seq > lastSeq);
  if (split === -1) split = next.length;
  if (split > previous.length) return null;
  const offset = previous.length - split;
  for (let index = 0; index < split; index += 1) {
    if (next[index] !== previous[offset + index]) return null;
  }
  return next.slice(split);
}

function replace<Key extends DurableSliceKey>(slice: Key, next: DurableSlices): EngineDeltaOp {
  return { op: 'replace', slice, value: next[slice] } as EngineDeltaOp;
}

/** The operations that turn `previous` into `next`. Empty when no slice changed its reference. */
export function deltaOps(previous: DurableSlices, next: DurableSlices): EngineDeltaOp[] {
  const ops: EngineDeltaOp[] = [];
  for (const key of DURABLE_SLICE_KEYS) {
    if (Object.is(previous[key], next[key])) continue;
    if (key === 'audit') {
      const rows = appendedRows(previous.audit.rows, next.audit.rows);
      // An append: the chain grew by exactly the new rows the ring holds.
      if (rows !== null && rows.length === next.audit.total - previous.audit.total) {
        if (rows.length > 0) {
          ops.push({ op: 'append', slice: 'audit', rows, head: next.audit.head, total: next.audit.total, dropped: next.audit.dropped });
        }
        continue;
      }
    } else if (key === 'events') {
      const rows = appendedRows(previous.events, next.events);
      if (rows !== null) {
        if (rows.length > 0) ops.push({ op: 'append', slice: 'events', rows });
        continue;
      }
    }
    ops.push(replace(key, next));
  }
  return ops;
}

/** True when an operation names a record slice (class S), which a client is told at once (RT-P11). */
export function changesRecords(ops: readonly EngineDeltaOp[]): boolean {
  return ops.some((op) => STORED.has(op.slice));
}

/** The durable slices whose reference differs between two states, among `keys`. */
export function changedSlices(previous: DurableSlices, next: DurableSlices, keys: readonly DurableSliceKey[] = DURABLE_SLICE_KEYS): DurableSliceKey[] {
  return keys.filter((key) => !Object.is(previous[key], next[key]));
}
