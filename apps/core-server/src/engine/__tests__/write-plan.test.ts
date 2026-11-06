// The write plan of one unit (plan row W26; spec ENG-4, ENG-10, §8.7; AC-B-07; SR-59). Pure: a
// headless simulator and the mapping module, no database.
import { describe, expect, it } from 'vitest';
import { DURABLE_SLICE_KEYS, MappingError, SNAPSHOT_SLICE_KEYS, STORED_SLICE_KEYS, pickDurable, summariseChanges } from '../../db/mapping';
import { createHost, type Host } from '../../../test/support/seed';
import * as writePlan from '../write-plan';
import { durableOf, faultCauses, planWrite } from '../write-plan';

/**
 * Member names that only a meter frame has (`AudioSlice.channels`, `AudioFrame.noSignal`). A level
 * in dBFS is not among them: an AUDIO_PEAK item of a session's timeline holds one, by design.
 */
const METER_FRAME_MEMBERS = ['"inputs"', '"noSignal"'];

/** The plan of a unit that writes now: ALWAYS the whole durable state (ONE CUT; finding F71). */
const planOf = (host: Host, flushed = pickDurable(host.state())) => {
  return (options: { interval?: boolean } = {}) => {
    const state = host.state();
    return planWrite(flushed, durableOf(state), { at: host.now(), state, intervalSnapshot: options.interval === true });
  };
};

describe('planWrite', () => {
  it('nothing changed: an empty plan, which sends no statement', async () => {
    const host = await createHost({ scenario: 'recording' });
    const plan = planOf(host)();
    expect(plan).toMatchObject({ empty: true, auditRows: [], events: [], rowChanges: [], healthRows: [], writesSnapshot: false });
  });

  it('the 20 Hz meter frames, the clock and the actor scope are not durable: a tick that changed only them plans nothing (AC-B-07)', async () => {
    const host = await createHost({ scenario: 'recording' });
    const before = host.state();
    // One engine interval, inside one second: the audio frame and the published clock move.
    host.drive(50);
    const after = host.state();
    expect(after.audio).not.toBe(before.audio);
    // What is durable of that tick is written; from there on only the three slices that are not durable move.
    const next = planOf(host);
    host.sim.store.setState({
      audio: { ...after.audio },
      clock: { ...after.clock },
      auth: { status: 'SIGNED_IN', operatorId: 'OPR-001', method: null, issuedAt: 1, lastActivityAt: 1 },
    });
    const plan = next();
    expect(plan.empty).toBe(true);
    // Positive control of the markers used below and in the database tests: a frame has them.
    for (const member of METER_FRAME_MEMBERS) expect(JSON.stringify(after.audio)).toContain(member);
    for (const member of METER_FRAME_MEMBERS) expect(JSON.stringify(plan)).not.toContain(member);
  });

  it('a minute of recording: the audit rows and events as the shared chain built them, no row of a meter frame, no operator', async () => {
    const host = await createHost({ scenario: 'recording' });
    const flushed = pickDurable(host.state());
    host.drive(60_000);
    const plan = planOf(host, flushed)();

    expect(plan.empty).toBe(false);
    expect(plan.auditRows.map((row) => row.seq)).toEqual(
      Array.from({ length: host.state().audit.total - flushed.audit.total }, (_, index) => flushed.audit.total + 1 + index),
    );
    // The very row objects of the engine's ring: nothing is rebuilt or hashed again.
    for (const row of plan.auditRows) expect(host.state().audit.rows).toContain(row);
    expect(plan.auditRows.every((row) => row.actorId === null)).toBe(true);
    expect(plan.events.every((event) => event.seq >= flushed.meta.counters.event)).toBe(true);

    // The two tables of the writers are not among the other changes; `operators` is never written.
    const tables = Object.keys(summariseChanges(plan.rowChanges));
    expect(tables).not.toContain('auditLog');
    expect(tables).not.toContain('events');
    expect(tables).not.toContain('operators');
    expect(tables).toEqual(expect.arrayContaining(['hardwareSnapshot', 'activeSession', 'engineCounters']));
    expect(plan.writesSnapshot).toBe(true);
    const serialised = JSON.stringify(plan.rowChanges);
    for (const member of METER_FRAME_MEMBERS) expect(serialised).not.toContain(member);
  });

  it('ONE CUT (finding F71): a plan holds the records AND the snapshot slices that changed with them; there is no plan for the records alone', async () => {
    const host = await createHost({ scenario: 'recording' });
    const flushed = pickDurable(host.state());
    host.drive(3_000);
    const state = durableOf(host.state());
    // Both classes moved in those three seconds.
    expect(STORED_SLICE_KEYS.filter((key) => state[key] !== flushed[key])).toEqual(expect.arrayContaining(['session', 'audit']));
    expect(SNAPSHOT_SLICE_KEYS.filter((key) => state[key] !== flushed[key]).length).toBeGreaterThan(0);

    const plan = planOf(host, flushed)();
    // The target is the engine's whole durable state, slice for slice, by reference: one instant.
    for (const key of DURABLE_SLICE_KEYS) expect(plan.target[key], key).toBe(state[key]);
    expect(plan.writesSnapshot).toBe(true);
    expect(Object.keys(summariseChanges(plan.rowChanges))).toEqual(expect.arrayContaining(['hardwareSnapshot', 'activeSession']));
    expect(plan.auditRows.length).toBeGreaterThan(0);

    // Nothing is left for a later unit: a second plan against the first one's target is empty.
    const later = planWrite(plan.target, state, { at: host.now(), state: host.state() });
    expect(later).toMatchObject({ empty: true, rowChanges: [], auditRows: [], writesSnapshot: false });
    // The function that built a target of the records alone is gone.
    expect(Object.keys(writePlan).sort()).toEqual(['applyPlan', 'durableOf', 'faultCauses', 'planWrite']);
  });

  it('the 60 s health snapshot is one row of cause INTERVAL, also when nothing else changed', async () => {
    const host = await createHost({ scenario: 'idle' });
    const plan = planOf(host)({ interval: true });
    expect(plan.empty).toBe(false);
    expect(plan.rowChanges).toEqual([]);
    expect(plan.healthRows).toHaveLength(1);
    expect(plan.healthRows[0]).toMatchObject({ at: host.now(), cause: 'INTERVAL', faultKind: null, sessionState: null, activeFaults: 0 });
  });

  it('a fault raise and its clearing each give one health snapshot row with the fault kind', async () => {
    const host = await createHost({ scenario: 'recording' });
    const next = planOf(host);
    host.sim.actions.inject('FAN_STALL');
    const raised = next();
    expect(raised.healthRows).toHaveLength(1);
    expect(raised.healthRows[0]).toMatchObject({ cause: 'FAULT_RAISED', faultKind: 'FAN_STALL', activeFaults: 1, sessionState: 'RECORDING' });
    expect(raised.auditRows.map((row) => row.type)).toEqual(['FAULT_RAISED']);

    const afterRaise = planOf(host);
    host.sim.actions.clearFault('FAN_STALL');
    const cleared = afterRaise();
    expect(cleared.healthRows.map((row) => [row.cause, row.faultKind, row.activeFaults])).toEqual([['FAULT_CLEARED', 'FAN_STALL', 0]]);
    expect(cleared.auditRows.map((row) => row.type)).toEqual(['FAULT_CLEARED']);
  });

  it('faultCauses: raised before cleared, by kind and target, nothing for the same slice', async () => {
    const host = await createHost({ scenario: 'idle' });
    const none = host.state();
    expect(faultCauses(none, none)).toEqual([]);
    host.sim.actions.inject('MIC_CLIP');
    const clip = host.state();
    host.sim.actions.inject('GNSS_LOSS');
    host.sim.actions.clearFault('MIC_CLIP');
    expect(faultCauses(clip, host.state())).toEqual([
      { cause: 'FAULT_RAISED', faultKind: 'GNSS_LOSS' },
      { cause: 'FAULT_CLEARED', faultKind: 'MIC_CLIP' },
    ]);
  });

  it('SR-59: AUDIT_TAMPER plans the discontinuity row and never the altered ring row; its clearing plans no rewrite either', async () => {
    const host = await createHost({ scenario: 'recording' });
    const next = planOf(host);
    const total = host.state().audit.total;
    host.sim.actions.inject('AUDIT_TAMPER');
    const altered = host.state().audit.rows.filter((row) => row.message.endsWith('[altered]'));
    expect(altered).toHaveLength(1);

    const plan = next();
    expect(plan.auditRows.map((row) => [row.seq, row.type])).toEqual([[total + 1, 'AUDIT_CHAIN_DISCONTINUITY']]);
    expect(plan.auditRows.some((row) => row.message.endsWith('[altered]'))).toBe(false);
    expect(JSON.stringify(plan.rowChanges)).not.toContain('[altered]');

    const afterTamper = planOf(host);
    host.sim.actions.clearFault('AUDIT_TAMPER');
    const cleared = afterTamper();
    expect(cleared.auditRows.map((row) => row.type)).toEqual(['FAULT_CLEARED']);
    expect(cleared.auditRows.every((row) => row.seq > total + 1)).toBe(true);
  });

  it('a move that cannot be written exactly is refused, not written in part: the caller sets the engine back', async () => {
    const host = await createHost({ scenario: 'idle' });
    const flushed = pickDurable(host.state());
    const state = host.state();
    const first = state.evidence[0];
    if (first === undefined) throw new Error('the dataset has no evidence');
    // A sealed column of an evidence item changed: the runtime role cannot write that.
    const forged = { ...state, evidence: [{ ...first, manifestHash: 'f'.repeat(64) }, ...state.evidence.slice(1)] };
    expect(() => planWrite(flushed, durableOf(forged), { at: host.now(), state: forged })).toThrow(MappingError);
  });
});
