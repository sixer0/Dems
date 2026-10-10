// FIX WAVE K, driver S1 - re-gate 75 finding G75c-01 (MAJOR; decision D220).
//
// The restart fault of a Core in its own capture ("The Core was not running while this session was
// active": `POWER_FAIL` with `coreNotRunning: true`) was never cleared. The rule now
// (`engine/restart-fault.ts`): the fault is active only while the session it was raised for is
// still open as that faulted session (FAULT / RECOVERY / FINALIZING with `session.fault.coreNotRunning`);
// when that session is sealed or closed the fault is cleared with ONE `FAULT_CLEARED` row and its
// alert resolved; a process start clears a STORED fault whose session has ended (the state lane 2 is
// in: `ALR-000016`), and a start with no session open raises nothing.
//
// The first case is the CONTROL: the shared transitions alone - what the tree at 57b80a9 ran - leave
// the fault and its alert active after the seal. Every other case is the rule.
import {
  CORE_NOT_RUNNING_CLEARED_SENTENCE,
  DEFAULT_SEED,
  applySealingProgressTransition,
  completeSealTransition,
  createManualClock,
  endUnsealableTransition,
  verifyAuditChain,
  type CompleteSealInput,
  type SealingStepReport,
  type SimErrorReport,
  type SimState,
} from '@dems/shared/sim';
import { describe, expect, it } from 'vitest';
import { FIXED_NOW, asStored, createHost } from '../../../test/support/seed';
import { createSystemClock, type FloorClock } from '../../core';
import { toRows, type StoredRows } from '../../db/mapping';
import { SEALING_STEP_ORDER } from '../../sealing';
import { createHeadlessSim, engineClock } from '../headless-sim';
import { adoptStoredState, applyProcessStart, storedStateOf } from '../rehydrate';
import { RESTART_FAULT_OPEN_STATES, endRestartFaultTransition, hasRestartFault, restartFaultSessionOpen } from '../restart-fault';

const STOP_MS = 90_000;
const rowsOf = (state: SimState, at: number): StoredRows => asStored(toRows(state, { at, seededAt: FIXED_NOW, lastResetAt: null }));
const hex = (seed: string, length = 64): string => seed.repeat(length).slice(0, length);

function serverClockOn(clock: { now(): number }, floor = 0): FloorClock {
  const read = (): number => clock.now();
  const server = createSystemClock(read, read);
  server.raiseFloor(floor);
  return server;
}

/** A NEW process on the stored form of `state`, `STOP_MS` after `at`. */
async function processOn(state: SimState, at: number) {
  const stored = storedStateOf(rowsOf(state, at));
  const now = at + STOP_MS;
  const errors: SimErrorReport[] = [];
  const sim = await createHeadlessSim({ seed: DEFAULT_SEED, clock: engineClock(serverClockOn(createManualClock(now), stored.lastCommittedAt)), onError: (report) => errors.push(report), capture: 'external' });
  adoptStoredState(sim, stored, state.meta.epoch + 1);
  return { stored, now, sim, errors };
}

/** A recording of a minute, the Core stopped, and its next start: the session is FAULT with the restart fault. */
async function faultedByRestart() {
  const host = await createHost({ scenario: 'recording' });
  host.drive(60_000);
  const stoppedAt = host.now();
  const first = await processOn(host.state(), stoppedAt);
  const effects = applyProcessStart(first.sim, first.stored.lastCommittedAt, first.now, null, { ownCapture: true });
  expect(effects.faultedFrom).toBe('RECORDING');
  expect(effects.restartFaultEnded).toBeUndefined();
  const state = first.sim.store.getState();
  expect(hasRestartFault(state)).toBe(true);
  expect(restartFaultSessionOpen(state)).toBe(true);
  return { state, at: first.now, sessionId: state.session?.id ?? '' };
}

const steps = (running: number): SealingStepReport[] =>
  SEALING_STEP_ORDER.map((id, index) => ({ id, status: index < running ? 'DONE' : index === running ? 'RUNNING' : 'PENDING', progress: index < running ? 100 : 0, etaMs: null, attempt: 1 }));

const sealInput = (sessionId: string, at: number): CompleteSealInput => ({
  sessionId,
  sealedAt: at,
  manifestSha256: hex('ab'),
  signature: { value: hex('cd', 128), keyId: 'CORE-KEY-EVSIGN-01', algorithm: 'Ed25519' },
  tracks: [
    { trackId: 'VIDEO-01', sizeBytes: 4_000, sha256: hex('01') },
    { trackId: 'VIDEO-02', sizeBytes: 5_000, sha256: hex('02') },
  ],
  interrupted: true,
  durableEndAt: at - 1_000,
  transcriptSha256: null,
  labelsStatus: null,
  developmentSources: true,
});

/** The interrupted seal of the faulted session, by the shared transitions only (the tree before the fix). */
function sealedBySharedTransitions(state: SimState, sessionId: string, at: number): SimState {
  const finalizing = applySealingProgressTransition(state, at, { sessionId, steps: steps(5) });
  expect(finalizing.session?.state).toBe('FINALIZING');
  return completeSealTransition(finalizing, at + 1_000, sealInput(sessionId, at + 1_000));
}

const restartAlerts = (state: SimState) => state.alerts.filter((alert) => alert.kind === 'POWER_FAIL' && alert.params?.['coreNotRunning'] === true);
const clearedRows = (state: SimState) => state.audit.rows.filter((row) => row.type === 'FAULT_CLEARED' && row.details['coreNotRunning'] === true);

describe('G75c-01: the restart fault of a real-capture Core ends with the session it was raised for', () => {
  it('CONTROL (the finding): the shared transitions alone seal the session and leave the fault and its alert ACTIVE, with no FAULT_CLEARED row', async () => {
    const { state, at, sessionId } = await faultedByRestart();
    const sealed = sealedBySharedTransitions(state, sessionId, at);
    expect(sealed.session).toMatchObject({ id: sessionId, state: 'SEALED' });
    expect(hasRestartFault(sealed)).toBe(true);
    expect(restartAlerts(sealed).map((alert) => alert.active)).toEqual([true]);
    expect(clearedRows(sealed)).toEqual([]);
  });

  it('while the faulted session is open (FAULT, FINALIZING) the fault STAYS: the rule clears nothing', async () => {
    const { state, at, sessionId } = await faultedByRestart();
    expect(RESTART_FAULT_OPEN_STATES).toEqual(['FAULT', 'RECOVERY', 'FINALIZING']);
    expect(endRestartFaultTransition(state, at)).toBe(state);
    const finalizing = applySealingProgressTransition(state, at, { sessionId, steps: steps(2) });
    expect(finalizing.session?.state).toBe('FINALIZING');
    expect(endRestartFaultTransition(finalizing, at)).toBe(finalizing);
  });

  it('SEALED: one FAULT_CLEARED row in the fault\'s own words, the alert resolved, no critical fault left; a second call writes nothing', async () => {
    const { state, at, sessionId } = await faultedByRestart();
    const sealed = sealedBySharedTransitions(state, sessionId, at);
    const ended = endRestartFaultTransition(sealed, at + 1_000);

    expect(hasRestartFault(ended)).toBe(false);
    expect(ended.faults.active.filter((fault) => fault.kind === 'POWER_FAIL')).toEqual([]);
    const rows = clearedRows(ended);
    expect(rows.map((row) => row.message)).toEqual([CORE_NOT_RUNNING_CLEARED_SENTENCE]);
    expect(rows[0]).toMatchObject({ sessionId, details: { kind: 'POWER_FAIL', target: null, coreNotRunning: true } });
    expect(restartAlerts(ended)).toHaveLength(1);
    expect(restartAlerts(ended)[0]).toMatchObject({ active: false, resolvedAt: at + 1_000 });
    expect(ended.alerts.filter((alert) => alert.active && alert.severity === 'CRITICAL')).toEqual([]);
    // What the interrupted item reads did not move: the sealed session still names its fault.
    expect(ended.session).toMatchObject({ id: sessionId, state: 'SEALED', fault: { kind: 'POWER_FAIL', fromState: 'RECORDING', coreNotRunning: true } });
    expect(verifyAuditChain(ended.audit)).toMatchObject({ ok: true });

    expect(endRestartFaultTransition(ended, at + 2_000)).toBe(ended);
  });

  it('ENDED UNSEALABLE (the session is closed, no item): the fault is cleared the same way', async () => {
    const { state, at, sessionId } = await faultedByRestart();
    const closed = endUnsealableTransition(state, at, { sessionId, cause: 'SESSION_KEY_NOT_OF_SESSION' });
    expect(closed.session).toBeNull();
    expect(hasRestartFault(closed)).toBe(true); // the control of this case: the shared transition leaves it
    const ended = endRestartFaultTransition(closed, at);
    expect(hasRestartFault(ended)).toBe(false);
    expect(clearedRows(ended)).toHaveLength(1);
    expect(restartAlerts(ended).map((alert) => alert.active)).toEqual([false]);
  });

  it('THE STUCK LANE HEALS AT ITS NEXT START: a stored state with the fault active and its session sealed (and acknowledged) gets one FAULT_CLEARED row, and the start after that writes nothing', async () => {
    const { state, at, sessionId } = await faultedByRestart();
    // The stored state of lane 2: the session sealed by the build before the fix, the alert acknowledged.
    const stuck = sealedBySharedTransitions(state, sessionId, at);
    const acknowledged: SimState = { ...stuck, alerts: stuck.alerts.map((alert) => (alert.kind === 'POWER_FAIL' ? { ...alert, acknowledged: true } : alert)) };
    expect(restartAlerts(acknowledged).map((alert) => [alert.active, alert.acknowledged])).toEqual([[true, true]]);

    const second = await processOn(acknowledged, at + 2_000);
    const total = second.sim.store.getState().audit.total;
    const effects = applyProcessStart(second.sim, second.stored.lastCommittedAt, second.now, null, { ownCapture: true });
    const healed = second.sim.store.getState();
    expect(effects).toMatchObject({ faultedFrom: null, restartFaultEnded: true });
    expect(hasRestartFault(healed)).toBe(false);
    expect(restartAlerts(healed).map((alert) => alert.active)).toEqual([false]);
    const written = healed.audit.rows.filter((row) => row.seq > total);
    expect(written.map((row) => row.type)).toEqual(['FAULT_CLEARED']);
    expect(written[0]).toMatchObject({ message: CORE_NOT_RUNNING_CLEARED_SENTENCE, at: second.now });
    expect(healed.audit.rows.filter((row) => row.seq > total && row.type === 'FAULT_RAISED')).toEqual([]);
    expect(verifyAuditChain(healed.audit)).toMatchObject({ ok: true });
    expect(second.errors).toEqual([]);

    // A restart with NO session active: nothing is raised, nothing is cleared, no row.
    const third = await processOn(healed, second.now);
    const before = third.sim.store.getState().audit.total;
    const again = applyProcessStart(third.sim, third.stored.lastCommittedAt, third.now, null, { ownCapture: true });
    expect(again.faultedFrom).toBeNull();
    expect(again.restartFaultEnded).toBeUndefined();
    expect(third.sim.store.getState().audit.total).toBe(before);
    expect(third.sim.store.getState().faults.active).toEqual([]);
    expect(third.errors).toEqual([]);
  });

  it('a second start while the faulted session is still OPEN keeps the fault and raises no second one', async () => {
    const { state, at } = await faultedByRestart();
    const second = await processOn(state, at);
    const total = second.sim.store.getState().audit.total;
    const effects = applyProcessStart(second.sim, second.stored.lastCommittedAt, second.now, null, { ownCapture: true });
    expect(effects.faultedFrom).toBeNull();
    expect(effects.restartFaultEnded).toBeUndefined();
    const after = second.sim.store.getState();
    expect(after.faults.active.filter((fault) => fault.kind === 'POWER_FAIL')).toHaveLength(1);
    expect(after.audit.total).toBe(total);
  });

  it('CONTROL - a simulated Core\'s own POWER_FAIL (no `coreNotRunning`) is not this fault and is never cleared by the rule', async () => {
    const host = await createHost({ scenario: 'recording' });
    host.drive(60_000);
    const first = await processOn(host.state(), host.now());
    applyProcessStart(first.sim, first.stored.lastCommittedAt, first.now);
    const state = first.sim.store.getState();
    expect(state.faults.active.some((fault) => fault.kind === 'POWER_FAIL')).toBe(true);
    expect(hasRestartFault(state)).toBe(false);
    expect(endRestartFaultTransition({ ...state, session: null }, first.now).faults.active.some((fault) => fault.kind === 'POWER_FAIL')).toBe(true);
  });
});
