// Rows of a server-native unit taken into the engine's rings (plan row W26; spec ENG-8, ENG-10).
import {
  AUDIT_RING_SIZE,
  EVENT_RING_SIZE,
  GENESIS_HASH,
  appendAudit,
  appendEvent,
  auditBody,
  chainHash,
  verifyAuditChain,
  type AuditRow,
  type SimEvent,
  type SimState,
} from '@dems/shared/sim';
import { describe, expect, it } from 'vitest';
import { createHost } from '../../../test/support/seed';
import { TrailMismatch, hasTrail, mergeTrail, resealedAudit, type TrailSlices } from '../ring';

const AT = Date.UTC(2031, 0, 1);

/** What the core's writers build for a server-native entry: the shared code on the stored head. */
function nativeRows(state: TrailSlices, count: number): AuditRow[] {
  const rows: AuditRow[] = [];
  let log = state.audit;
  for (let index = 0; index < count; index += 1) {
    const appended = appendAudit(log, { type: 'AUTH_SUCCESS', message: 'Signed in.', actorId: 'OPR-001', details: { method: 'PASSWORD' } }, AT + index);
    rows.push(appended.row);
    log = appended.log;
  }
  return rows;
}

function nativeEvents(state: TrailSlices, count: number): SimEvent[] {
  const events: SimEvent[] = [];
  for (let index = 0; index < count; index += 1) {
    events.push(appendEvent([], { type: 'AUTH_LOGIN', message: 'Signed in.' }, AT + index, state.meta.counters.event + index).event);
  }
  return events;
}

async function idleState(): Promise<SimState> {
  return (await createHost({ scenario: 'idle' })).state();
}

describe('mergeTrail', () => {
  it('nothing new: the same references, nothing merged', async () => {
    const state = await idleState();
    expect(mergeTrail(state, [], [])).toEqual({});
    // Rows the engine built itself are in the ring already.
    const merged = mergeTrail(state, state.audit.rows.slice(-3), state.events.slice(-2));
    expect(merged).toEqual({});
    expect(hasTrail(merged)).toBe(false);
  });

  it('appends native rows as the shared appendAudit would: head, total, dropped, and a ring that still verifies', async () => {
    const state = await idleState();
    const rows = nativeRows(state, 3);
    const merged = mergeTrail(state, rows, []);
    expect(hasTrail(merged)).toBe(true);
    expect(merged.audit).toMatchObject({ total: state.audit.total + 3, head: rows[2]?.hash, dropped: 0 });
    expect(merged.audit?.rows.slice(-3)).toEqual(rows);
    // The row objects are the writers' own; the rows before them are the ring's own.
    expect(merged.audit?.rows.at(-1)).toBe(rows[2]);
    expect(merged.audit?.rows[0]).toBe(state.audit.rows[0]);
    expect(merged.events).toBeUndefined();
    expect(merged.meta).toBeUndefined();
    expect(verifyAuditChain(merged.audit ?? state.audit)).toMatchObject({ ok: true, checked: state.audit.rows.length + 3 });
    // The engine's next row then continues the stored head.
    const next = appendAudit(merged.audit ?? state.audit, { type: 'FRAME_HASH', message: 'Frame hash' }, AT + 10);
    expect(next.row.seq).toBe(state.audit.total + 4);
    expect(next.row.prevHash).toBe(rows[2]?.hash);
  });

  it('appends native events and raises the event counter above the newest', async () => {
    const state = await idleState();
    const events = nativeEvents(state, 2);
    const merged = mergeTrail(state, [], events);
    expect(merged.audit).toBeUndefined();
    expect(merged.events?.slice(-2)).toEqual(events);
    expect(merged.meta?.counters.event).toBe(state.meta.counters.event + 2);
    expect(merged.meta?.counters).toMatchObject({ ...state.meta.counters, event: state.meta.counters.event + 2 });
    expect(merged.meta?.epoch).toBe(state.meta.epoch);
  });

  it('skips what the ring already holds and takes the rest (a unit seen twice changes nothing the second time)', async () => {
    const state = await idleState();
    const rows = nativeRows(state, 2);
    const events = nativeEvents(state, 1);
    const once = mergeTrail(state, rows, events);
    const merged = { audit: once.audit ?? state.audit, events: once.events ?? state.events, meta: once.meta ?? state.meta };
    expect(mergeTrail(merged, rows, events)).toEqual({});
  });

  it('keeps the newest 1,000 audit rows and 500 events; `dropped` counts what left the ring', () => {
    let log = { rows: [] as AuditRow[], head: GENESIS_HASH, total: 0, dropped: 0 };
    const rows: AuditRow[] = [];
    for (let index = 0; index < AUDIT_RING_SIZE + 5; index += 1) {
      const appended = appendAudit(log, { type: 'FRAME_HASH', message: 'Frame hash' }, AT + index, AUDIT_RING_SIZE + 100);
      rows.push(appended.row);
      log = appended.log;
    }
    const events = Array.from({ length: EVENT_RING_SIZE + 3 }, (_, index) => appendEvent([], { type: 'AUTH_LOGIN', message: 'x' }, AT, index + 1).event);
    const empty: TrailSlices = {
      audit: { rows: [], head: GENESIS_HASH, total: 0, dropped: 0 },
      events: [],
      meta: { schemaVersion: 2, seed: 1, scenario: 'idle', epoch: 0, createdAt: AT, counters: { event: 1, session: 1, caseNumber: 1, evidence: 1, item: 1 } },
    };
    const merged = mergeTrail(empty, rows, events);
    expect(merged.audit?.rows).toHaveLength(AUDIT_RING_SIZE);
    expect(merged.audit).toMatchObject({ total: AUDIT_RING_SIZE + 5, dropped: 5, head: rows.at(-1)?.hash });
    expect(merged.audit?.rows[0]?.seq).toBe(6);
    expect(verifyAuditChain(merged.audit ?? empty.audit)).toMatchObject({ ok: true });
    expect(merged.events).toHaveLength(EVENT_RING_SIZE);
    expect(merged.events?.[0]?.seq).toBe(4);
    expect(merged.meta?.counters.event).toBe(EVENT_RING_SIZE + 4);
  });

  it('rows that do not continue the ring are refused: a gap, and a wrong previous hash', async () => {
    const state = await idleState();
    const rows = nativeRows(state, 3);
    const gap = () => mergeTrail(state, rows.slice(1), []);
    expect(gap).toThrow(TrailMismatch);
    try {
      gap();
    } catch (error) {
      expect(error).toMatchObject({ engineSeq: state.audit.total, rowSeq: state.audit.total + 2 });
    }
    const forged = { ...(rows[0] as AuditRow), prevHash: GENESIS_HASH };
    expect(() => mergeTrail(state, [forged], [])).toThrow(TrailMismatch);
    // The error says where, never what: no part of a row is in its text.
    expect(new TrailMismatch(1, 3).message).toBe('the rows do not continue the engine ring');
  });
});

// Row 94 (DF-27, decision D21(3)): an operator purge re-seals the chain in the database. The unit
// that did it hands the chain as stored after the seal to the engine, which must take it instead of
// merging its own row (whose hash the seal replaced) and failing its next write on the old head.
describe('resealedAudit (row 94, DF-27)', () => {
  const TARGET = 'OPR-009';

  /** Rows appended on `log` by `actorId`, as the core's writers build them. */
  function rowsBy(log: SimState['audit'], actorId: string, count: number, at: number): { rows: AuditRow[]; log: SimState['audit'] } {
    const rows: AuditRow[] = [];
    let current = log;
    for (let index = 0; index < count; index += 1) {
      const appended = appendAudit(current, { type: 'AUTH_SUCCESS', message: 'Signed in.', actorId, details: { method: 'PASSWORD' } }, at + index);
      rows.push(appended.row);
      current = appended.log;
    }
    return { rows, log: current };
  }

  /** What `audit_purge_operator` plus `audit_purge_reseal` leave: the target's rows gone, the tail re-chained from the row before them. */
  function purgeAndReseal(ring: readonly AuditRow[], target: string): AuditRow[] {
    const first = ring.findIndex((row) => row.actorId === target);
    let prev = first === 0 ? GENESIS_HASH : (ring[first - 1] as AuditRow).hash;
    const out: AuditRow[] = ring.slice(0, first);
    for (const row of ring.slice(first)) {
      if (row.actorId === target) continue;
      const hash = chainHash(prev, auditBody(row));
      out.push({ ...row, prevHash: prev, hash });
      prev = hash;
    }
    return out;
  }

  /** A state whose ring holds two rows of the target, two of others, and the purge unit's own announcement. */
  async function purgeScene() {
    const idle = await idleState();
    const target = rowsBy(idle.audit, TARGET, 2, AT);
    const others = rowsBy(target.log, 'OPR-001', 2, AT + 10);
    const before: SimState = { ...idle, audit: others.log };
    // The purge unit's own row (USER_DELETED in production), appended BEFORE the erasure.
    const announced = rowsBy(others.log, 'OPR-002', 1, AT + 20);
    const stored = purgeAndReseal(announced.log.rows, TARGET);
    const newest = stored[stored.length - 1] as AuditRow;
    const chain = { head: { seq: newest.seq, hash: newest.hash }, rows: stored };
    const purged = [{ from: (target.rows[0] as AuditRow).seq, to: (target.rows[1] as AuditRow).seq }];
    return { before, unitRows: announced.rows, chain, purged };
  }

  it('the old path: merging the unit\'s own row leaves a head the stored chain no longer has (the DF-27 mechanism)', async () => {
    const { before, unitRows, chain } = await purgeScene();
    const merged = mergeTrail(before, unitRows, []);
    // The merge itself passes: the row continued the ring when it was written.
    expect(merged.audit?.total).toBe(chain.head.seq);
    // But its hash is not the stored head any more: the next write of the engine finds the head foreign.
    expect(merged.audit?.head).not.toBe(chain.head.hash);
  });

  it('takes the stored chain: head, total and dropped as a rehydration builds them, the erased rows gone, the ring verifying with the ledger', async () => {
    const { before, unitRows, chain, purged } = await purgeScene();
    const audit = resealedAudit(chain);
    expect(audit).toEqual({ rows: chain.rows, head: chain.head.hash, total: chain.head.seq, dropped: chain.head.seq - chain.rows.length });
    expect(audit.rows.some((row) => row.actorId === TARGET)).toBe(false);
    expect(verifyAuditChain(audit, purged)).toMatchObject({ ok: true });
    // The unit's rows are at or below the new head: merging them afterwards adds nothing.
    expect(mergeTrail({ ...before, audit }, unitRows, [])).toEqual({});
    // And the engine's next row continues the stored head (AP-6).
    const next = appendAudit(audit, { type: 'AUTH_SUCCESS', message: 'Signed in.', actorId: 'OPR-001', details: { method: 'PASSWORD' } }, AT + 30).row;
    expect(next).toMatchObject({ seq: chain.head.seq + 1, prevHash: chain.head.hash });
  });

  it('a chain longer than the ring keeps the newest AUDIT_RING_SIZE rows; dropped counts the rest', () => {
    const empty: SimState['audit'] = { rows: [], head: GENESIS_HASH, total: 0, dropped: 0 };
    const { rows } = rowsBy(empty, 'OPR-001', AUDIT_RING_SIZE + 5, AT);
    const newest = rows[rows.length - 1] as AuditRow;
    const audit = resealedAudit({ head: { seq: newest.seq, hash: newest.hash }, rows });
    expect(audit.rows).toHaveLength(AUDIT_RING_SIZE);
    expect(audit.rows[audit.rows.length - 1]).toBe(newest);
    expect(audit).toMatchObject({ head: newest.hash, total: AUDIT_RING_SIZE + 5, dropped: 5 });
  });
});
