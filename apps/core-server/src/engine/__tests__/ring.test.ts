// Rows of a server-native unit taken into the engine's rings (plan row W26; spec ENG-8, ENG-10).
import {
  AUDIT_RING_SIZE,
  EVENT_RING_SIZE,
  GENESIS_HASH,
  appendAudit,
  appendEvent,
  verifyAuditChain,
  type AuditRow,
  type SimEvent,
  type SimState,
} from '@dems/shared/sim';
import { describe, expect, it } from 'vitest';
import { createHost } from '../../../test/support/seed';
import { TrailMismatch, hasTrail, mergeTrail, type TrailSlices } from '../ring';

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
