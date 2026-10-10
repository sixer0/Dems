// CLOSING PASS J of fix wave I - finding G75b-03, the four states driver A2 left (ruling D217 (5)).
//
// A real-capture Core that was stopped while its session was PRECHECK / ARMED / RECORDING /
// STOPPING moves that session to FAULT at its next start (`applyProcessStart`). The KIND of that
// fault stays the simulator's `POWER_FAIL`, `fault.fromState` stays what it was and the fault has
// no reason (no new cause in this wave: an interrupted seal reads them). What changed is what the
// rows SAY: "The Core was not running while this session was active" - the Core cannot know
// whether power failed - and the member `coreNotRunning: true` on every record of the fault
// (`@dems/shared/sim` `core-not-running.ts`). The SIMULATED lane keeps its words (the control).
import { CORE_NOT_RUNNING_FAULT_EXAMPLE } from '@dems/shared/api';
import { CORE_NOT_RUNNING_SENTENCE, DEFAULT_SEED, createManualClock, isPlatformNotReported, platformNotReportedTransition, verifyAuditChain, type SimErrorReport, type SimState } from '@dems/shared/sim';
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

async function simOf(state: SimState, at: number, epoch: number) {
  const stored = storedStateOf(rowsOf(state, at));
  const now = at + STOP_MS;
  const errors: SimErrorReport[] = [];
  const sim = await createHeadlessSim({ seed: DEFAULT_SEED, clock: engineClock(serverClockOn(createManualClock(now), stored.lastCommittedAt)), onError: (report) => errors.push(report), capture: 'external' });
  adoptStoredState(sim, stored, epoch);
  return { stored, now, sim, errors };
}

/** A recording that ran for a minute, was brought to `prepare`'s state, stored, and rehydrated `STOP_MS` later by a NEW process. */
async function restarted(prepare: (host: Host) => void) {
  const host = await createHost({ scenario: 'recording' });
  host.drive(60_000);
  prepare(host);
  const stoppedAt = host.now();
  const before = host.state();
  return { before, stoppedAt, ...(await simOf(before, stoppedAt, before.meta.epoch + 1)) };
}

const stopping = (host: Host): void => {
  host.runAs(host.operator('INVESTIGATOR'), () => host.sim.actions.stopRecording('Interview finished'));
  expect(host.state().session?.state).toBe('STOPPING');
};
const newRows = (state: SimState, before: SimState) => state.audit.rows.filter((row) => row.seq > before.audit.total);

describe('G75b-03 (pass J): the restart fault of a real-capture Core says what the Core knows', () => {
  for (const [from, prepare] of [['RECORDING', () => undefined], ['STOPPING', stopping]] as const) {
    it(`a session that was ${from}: FAULT with the same kind and fromState, the row says "the Core was not running", nothing says "power fail"`, async () => {
      const { before, stored, stoppedAt, now, sim, errors } = await restarted(prepare);
      const effects = applyProcessStart(sim, stored.lastCommittedAt, now, null, { ownCapture: true });
      const state = sim.store.getState();

      // What an interrupted seal reads did not move.
      expect(effects.faultedFrom).toBe(from);
      expect(state.session?.fault).toEqual({ kind: 'POWER_FAIL', at: stoppedAt, fromState: from, ...CORE_NOT_RUNNING_FAULT_EXAMPLE });
      expect(state.faults.active.filter((fault) => fault.kind === 'POWER_FAIL')).toEqual([{ kind: 'POWER_FAIL', since: stoppedAt, target: null, ...CORE_NOT_RUNNING_FAULT_EXAMPLE }]);

      const rows = newRows(state, before);
      const raised = rows.filter((row) => row.type === 'FAULT_RAISED');
      expect(raised.map((row) => row.message)).toEqual([CORE_NOT_RUNNING_SENTENCE]);
      expect(raised[0]?.details).toMatchObject({ kind: 'POWER_FAIL', fromState: from, coreNotRunning: true });
      expect(raised[0]?.details).not.toHaveProperty('reason');
      expect(rows.filter((row) => /power\s*fail/i.test(row.message))).toEqual([]);

      const alert = state.alerts.findLast((candidate) => candidate.kind === 'POWER_FAIL' && candidate.active);
      expect(alert).toMatchObject({ message: CORE_NOT_RUNNING_SENTENCE, params: { kind: 'POWER_FAIL', coreNotRunning: true } });
      expect(state.events.filter((event) => event.at >= stoppedAt && /power\s*fail/i.test(event.message))).toEqual([]);
      expect(verifyAuditChain(state.audit)).toMatchObject({ ok: true });
      expect(errors).toEqual([]);
    });
  }

  it('the member is stored and read back: a second start of the Core still words the fault from it', async () => {
    const { before, stored, now, sim } = await restarted(() => undefined);
    applyProcessStart(sim, stored.lastCommittedAt, now, null, { ownCapture: true });
    const faulted = platformNotReportedTransition(sim.store.getState());
    const again = await simOf(faulted, now, before.meta.epoch + 2);
    const state = again.sim.store.getState();
    expect(state.session?.fault).toMatchObject({ kind: 'POWER_FAIL', fromState: 'RECORDING', coreNotRunning: true });
    expect(state.faults.active.find((fault) => fault.kind === 'POWER_FAIL')).toMatchObject({ coreNotRunning: true });
    expect(state.alerts.findLast((alert) => alert.kind === 'POWER_FAIL')?.params).toMatchObject({ coreNotRunning: true });
    expect(state.audit.rows.findLast((row) => row.type === 'FAULT_RAISED')?.details).toMatchObject({ coreNotRunning: true });
    // And the platform statement of D217 (7) is a stored member of the `security` slice.
    expect(isPlatformNotReported(state.security)).toBe(true);
    expect(again.errors).toEqual([]);
  });

  it('CONTROL - SIMULATED capture is unchanged: the same stored state gets "Power fail detected" and no member', async () => {
    const { before, stored, stoppedAt, now, sim } = await restarted(() => undefined);
    applyProcessStart(sim, stored.lastCommittedAt, now);
    const state = sim.store.getState();
    expect(state.session?.fault).toEqual({ kind: 'POWER_FAIL', at: stoppedAt, fromState: 'RECORDING' });
    const raised = newRows(state, before).filter((row) => row.type === 'FAULT_RAISED');
    expect(raised.map((row) => row.message)).toEqual(['Power fail detected — recovery marker written']);
    expect(raised[0]?.details).not.toHaveProperty('coreNotRunning');
    expect(state.faults.active.find((fault) => fault.kind === 'POWER_FAIL')).not.toHaveProperty('coreNotRunning');
  });
});
