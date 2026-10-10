// FIX WAVE I, DRIVER A2 - finding G75b-03 of re-gate 75 (`gateway_check/10b_m5_regate.md` section
// 6), ruling D216 (3): a graceful stop of the Core is not a power failure and not a tablet fault;
// the audit chain states what happened or nothing.
//
// WHERE THE ROWS CAME FROM. Not from the stop: `host.stop()` writes nothing. They were written by
// the NEXT START, in `applyProcessStart` (`rehydrate.ts`), which is the simulator's restart model
// (spec §8.6, decision D28 D-1): a session that was in flight is moved to FAULT with the
// power-failure fault, stamped at the last committed instant - which is why the row
// "Power fail detected - recovery marker written" carried the time of the stop - and a stored
// CONNECTED tablet link is written OFFLINE through the hosted action, whose sentence is
// "Tablet control offline - recording continues".
//
// On a Core in ITS OWN capture (`ownCapture`: capture mode `real`) a session that is FINALIZING is
// not recording: its recording ended, its seal goes on from the stored sealing rows at this start
// (`sealing-host`, step `sealing.resume`). No power failed and nothing is lost: no fault, no alert,
// no row. The tablet link is OFFLINE (no socket is open after a process start) and that is stated
// in the STATE; no row claims a tablet fault or a recording that continues.
// The SIMULATED lane keeps its restart model unchanged (the controls below).
import { DEFAULT_SEED, STOPPING_MS, createManualClock, verifyAuditChain, type SimErrorReport, type SimState } from '@dems/shared/sim';
import { describe, expect, it } from 'vitest';
import { toRows, type StoredRows } from '../../db/mapping';
import { FIXED_NOW, asStored, createHost, type Host } from '../../../test/support/seed';
import { createSystemClock, type FloorClock } from '../../core';
import { createHeadlessSim, engineClock } from '../headless-sim';
import { adoptStoredState, applyProcessStart, storedStateOf } from '../rehydrate';

const STOP_MS = 90_000;
const rowsOf = (state: SimState, at: number): StoredRows => asStored(toRows(state, { at, seededAt: FIXED_NOW, lastResetAt: null }));

function serverClockOn(clock: { now(): number }, floor = 0): FloorClock {
  const read = (): number => clock.now();
  const server = createSystemClock(read, read);
  server.raiseFloor(floor);
  return server;
}

/** A recording that ran for a minute, was brought to `prepare`'s state, stored, and rehydrated `STOP_MS` later by a NEW process. */
async function restarted(prepare: (host: Host) => void) {
  const host = await createHost({ scenario: 'recording' });
  host.drive(60_000);
  prepare(host);
  const stoppedAt = host.now();
  const before = host.state();
  const stored = storedStateOf(rowsOf(before, stoppedAt));
  const now = stoppedAt + STOP_MS;
  const errors: SimErrorReport[] = [];
  const sim = await createHeadlessSim({ seed: DEFAULT_SEED, clock: engineClock(serverClockOn(createManualClock(now), stored.lastCommittedAt)), onError: (report) => errors.push(report), capture: 'external' });
  adoptStoredState(sim, stored, before.meta.epoch + 1);
  return { before, stored, stoppedAt, now, sim, errors };
}

/** The recording is stopped by its operator and has reached FINALIZING. */
const toFinalizing = (host: Host): void => {
  host.runAs(host.operator('INVESTIGATOR'), () => host.sim.actions.stopRecording('Interview finished'));
  host.drive(STOPPING_MS + 200);
  expect(host.state().session?.state).toBe('FINALIZING');
};
const newRows = (state: SimState, before: SimState) => state.audit.rows.filter((row) => row.seq > before.audit.total);

describe('G75b-03: a start of a real-capture Core with a session that was FINALIZING at the stop', () => {
  it('writes NO power-failure row and raises no fault and no alert: the session stays FINALIZING for the seal to go on', async () => {
    const { before, stored, now, sim, errors } = await restarted(toFinalizing);
    const effects = applyProcessStart(sim, stored.lastCommittedAt, now, null, { ownCapture: true });
    const state = sim.store.getState();

    expect(effects.faultedFrom).toBeNull();
    expect(state.session).toMatchObject({ id: before.session?.id, state: 'FINALIZING', fault: null, stoppedAt: before.session?.stoppedAt });
    expect(state.faults.active.map((fault) => fault.kind)).not.toContain('POWER_FAIL');
    expect(state.alerts.filter((alert) => alert.active).length).toBe(before.alerts.filter((alert) => alert.active).length);
    const rows = newRows(state, before);
    expect(rows.filter((row) => row.type === 'FAULT_RAISED')).toEqual([]);
    expect(rows.filter((row) => /power fail/i.test(row.message))).toEqual([]);
    expect(verifyAuditChain(state.audit)).toMatchObject({ ok: true });
    expect(errors).toEqual([]);
  });

  it('writes NO tablet row: the link reads OFFLINE in the state (no socket is open after a process start) and no row says "recording continues"', async () => {
    const { before, stored, now, sim } = await restarted(toFinalizing);
    expect(before.tabletLink.state).toBe('CONNECTED');
    const effects = applyProcessStart(sim, stored.lastCommittedAt, now, null, { ownCapture: true });
    const state = sim.store.getState();

    expect(state.tabletLink).toEqual({ state: 'OFFLINE', changedAt: now });
    expect(effects.tabletLinkReset).toBe(false);
    expect(effects.tabletLinkOfflineUnwritten).toBe(true);
    const rows = newRows(state, before);
    expect(rows.filter((row) => row.type === 'TABLET_LINK_CHANGED')).toEqual([]);
    expect(rows).toEqual([]);
    // The device list follows the link, as the hosted action would have made it.
    expect(JSON.stringify(state.otherDevices)).not.toBe(JSON.stringify(before.otherDevices));
    // When the tablet connects again the truthful row of THAT change is written.
    sim.actions.setTabletLink('CONNECTED');
    expect(newRows(sim.store.getState(), before).map((row) => [row.type, row.message])).toEqual([['TABLET_LINK_CHANGED', 'Tablet control connected']]);
  });

  it('CONTROL - SIMULATED capture is unchanged: the same stored state gets the restart fault from FINALIZING and the tablet row', async () => {
    const { before, stored, stoppedAt, now, sim } = await restarted(toFinalizing);
    const effects = applyProcessStart(sim, stored.lastCommittedAt, now);
    const state = sim.store.getState();
    expect(effects).toMatchObject({ faultedFrom: 'FINALIZING', tabletLinkReset: true });
    expect(effects.tabletLinkOfflineUnwritten ?? false).toBe(false);
    expect(state.session).toMatchObject({ state: 'FAULT', fault: { kind: 'POWER_FAIL', fromState: 'FINALIZING', at: stoppedAt } });
    expect(newRows(state, before).map((row) => row.type)).toEqual(['FAULT_RAISED', 'TABLET_LINK_CHANGED']);
  });

  it('CONTROL - a session that was RECORDING at the stop of a real-capture Core still leaves RECORDING (no worker holds it): the restart fault stands there (open item of note 132)', async () => {
    const { before, stored, now, sim } = await restarted(() => undefined);
    const effects = applyProcessStart(sim, stored.lastCommittedAt, now, null, { ownCapture: true });
    const state = sim.store.getState();
    expect(effects.faultedFrom).toBe('RECORDING');
    expect(state.session).toMatchObject({ state: 'FAULT', fault: { fromState: 'RECORDING' } });
    // The tablet row is not written here either.
    expect(newRows(state, before).filter((row) => row.type === 'TABLET_LINK_CHANGED')).toEqual([]);
  });
});
