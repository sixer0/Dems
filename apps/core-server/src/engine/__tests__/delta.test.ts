// The operations of a state change (plan row W26; spec §9.3 RT-3, ENG-4). Pure: two states of a
// headless simulator, no database.
import { DeltaOpSchema, REPLICATED_SLICE_NAMES } from '@dems/shared/api';
import { describe, expect, it } from 'vitest';
import { DURABLE_SLICE_KEYS, SNAPSHOT_SLICE_KEYS, STORED_SLICE_KEYS, pickDurable, type DurableSlices } from '../../db/mapping';
import { createHost } from '../../../test/support/seed';
import { appendedRows, changedSlices, changesRecords, deltaOps } from '../delta';

const row = (seq: number) => ({ seq, text: `row ${seq}` });

describe('appendedRows: what a ring holds beyond the ring before', () => {
  it('nothing new: the same rows, an empty list', () => {
    const rows = [row(1), row(2)];
    expect(appendedRows(rows, rows)).toEqual([]);
    expect(appendedRows(rows, [...rows])).toEqual([]);
    expect(appendedRows([], [])).toEqual([]);
  });

  it('rows added at the end, with and without rows dropped off the front', () => {
    const previous = [row(1), row(2), row(3)];
    const added = [row(4), row(5)];
    expect(appendedRows(previous, [...previous, ...added])).toEqual(added);
    expect(appendedRows(previous, [...previous.slice(2), ...added])).toEqual(added);
    expect(appendedRows(previous, added)).toEqual(added);
    expect(appendedRows([], added)).toEqual(added);
  });

  it('a kept row that is another object is not an append: the ring was changed in place', () => {
    const first = row(1);
    const third = row(3);
    const previous = [first, row(2), third];
    const altered = [first, { ...row(2), text: 'altered' }, third, row(4)];
    expect(appendedRows(previous, altered)).toBeNull();
    // The same content in a new object is still "changed": identity is the signal (ENG-4).
    expect(appendedRows(previous, [first, { ...row(2) }, third])).toBeNull();
  });

  it('a ring that kept more than the ring before held is not an append', () => {
    expect(appendedRows([row(3)], [row(2), row(3)])).toBeNull();
  });
});

describe('deltaOps: one unit of work as operations', () => {
  it('the durable slices are exactly the 30 replicated slices of the contract', () => {
    expect([...DURABLE_SLICE_KEYS].sort()).toEqual([...REPLICATED_SLICE_NAMES].sort());
    expect(STORED_SLICE_KEYS).toHaveLength(15);
    expect(SNAPSHOT_SLICE_KEYS).toHaveLength(15);
  });

  it('no change of a reference: no operation', async () => {
    const host = await createHost({ scenario: 'recording' });
    const state = pickDurable(host.state());
    expect(deltaOps(state, state)).toEqual([]);
    expect(deltaOps(state, { ...state })).toEqual([]);
    expect(changedSlices(state, { ...state })).toEqual([]);
  });

  it('a minute of recording: audit rows and events as appends, every other changed slice whole, none of the five unreplicated slices', async () => {
    const host = await createHost({ scenario: 'recording' });
    const before = pickDurable(host.state());
    host.drive(60_000);
    const after = pickDurable(host.state());
    const ops = deltaOps(before, after);

    const changed = changedSlices(before, after);
    expect(ops.map((op) => op.slice)).toEqual(changed);
    expect(changed).toEqual(expect.arrayContaining(['meta', 'session', 'events', 'audit', 'storage', 'time', 'network', 'health']));
    for (const name of ['audio', 'clock', 'auth', 'authLockout', 'pairing']) expect(changed).not.toContain(name);

    const audit = ops.find((op) => op.slice === 'audit');
    expect(audit).toMatchObject({ op: 'append', head: after.audit.head, total: after.audit.total, dropped: after.audit.dropped });
    if (audit?.op !== 'append' || audit.slice !== 'audit') throw new Error('audit is not an append');
    expect(audit.rows.map((entry) => entry.seq)).toEqual(
      Array.from({ length: after.audit.total - before.audit.total }, (_, index) => before.audit.total + 1 + index),
    );
    expect(audit.rows.length).toBeGreaterThan(0);

    const events = ops.find((op) => op.slice === 'events');
    expect(events).toMatchObject({ op: 'append' });
    if (events?.op !== 'append') throw new Error('events is not an append');
    expect(events.rows.every((event) => event.seq >= before.meta.counters.event)).toBe(true);

    // A replaced slice is the engine's own value, by reference: nothing is copied.
    const session = ops.find((op) => op.slice === 'session');
    expect(session?.op === 'replace' && session.value).toBe(after.session);
    expect(changesRecords(ops)).toBe(true);
  });

  it('every operation of a real minute is a DeltaOp of the realtime contract', async () => {
    const host = await createHost({ scenario: 'recording' });
    const before = pickDurable(host.state());
    host.drive(5_000);
    host.runAs(host.operator('INVESTIGATOR'), () => host.sim.actions.addMarker('Key statement'));
    const ops = deltaOps(before, pickDurable(host.state()));
    expect(ops.length).toBeGreaterThan(4);
    for (const op of ops) {
      const parsed = DeltaOpSchema.safeParse(op);
      expect(parsed.success, `${op.op} ${op.slice}`).toBe(true);
    }
  });

  it('only snapshot slices changed: no record changed (the pacing of RT-P11)', async () => {
    const host = await createHost({ scenario: 'idle' });
    const before = pickDurable(host.state());
    host.drive(1_000);
    const ops = deltaOps(before, pickDurable(host.state()));
    expect(ops.length).toBeGreaterThan(0);
    expect(ops.every((op) => op.op === 'replace')).toBe(true);
    expect(ops.every((op) => (SNAPSHOT_SLICE_KEYS as readonly string[]).includes(op.slice))).toBe(true);
    expect(changesRecords(ops)).toBe(false);
  });

  it('the AUDIT_TAMPER demo fault changes a ring row in place: the ring is replaced whole, and its clearing too', async () => {
    const host = await createHost({ scenario: 'recording' });
    const before = pickDurable(host.state());
    host.sim.actions.inject('AUDIT_TAMPER');
    const tampered = pickDurable(host.state());
    const tamperOp = deltaOps(before, tampered).find((op) => op.slice === 'audit');
    expect(tamperOp).toMatchObject({ op: 'replace', slice: 'audit' });
    expect(tamperOp?.op === 'replace' && tamperOp.value).toBe(tampered.audit);

    host.sim.actions.clearFault('AUDIT_TAMPER');
    const clearOp = deltaOps(tampered, pickDurable(host.state())).find((op) => op.slice === 'audit');
    expect(clearOp).toMatchObject({ op: 'replace', slice: 'audit' });
  });

  it('a slice that only changed its reference by a merge of the same rows yields no operation', async () => {
    const host = await createHost({ scenario: 'idle' });
    const state = pickDurable(host.state());
    const copy: DurableSlices = { ...state, audit: { ...state.audit, rows: [...state.audit.rows] }, events: [...state.events] };
    expect(deltaOps(state, copy)).toEqual([]);
  });
});
