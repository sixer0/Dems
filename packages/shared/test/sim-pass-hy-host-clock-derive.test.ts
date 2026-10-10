// Pass H-Y (found by the seal e2e's new assertion: a product-sealed audit extract said
// `RECORDING_STARTED.timeSource: GNSS` in one of two real seals).
//
// THE DEFECT. Wave H Z1 (ruling D203 (1)) made the `time` slice of a Core in its own capture the
// host system clock, in the first state and again at every health tick (1 Hz). But every session
// change, fault change and tablet-link carry runs `deriveDeviceState`, whose time rule said "no
// GNSS_LOSS fault -> source GNSS, locked" WITHOUT asking whose clock the slice is. So between a
// session change and the next health tick the slice said GNSS again, and a recording started inside
// that second wrote GNSS into its audit row, its session and its START node. The Z1 tests ticked
// between every action and never saw it.
//
// THE RULE. A host-clock time slice is no time service: the derivation leaves it as it is, fault or
// no fault. CONTROL: the same steps in `'simulated'` capture keep the demo's GNSS and its fall-back.
import { describe, expect, it } from 'vitest';
import { FaultKind, HOST_CLOCK_TIME, createManualClock, createSim, deriveDeviceState, isHostClockTime, type SessionCreateInput, type SimState } from '../src/sim';

const START = Date.UTC(2026, 9, 1, 3, 0, 0);
const INPUT: SessionCreateInput = { caseNumber: 'LP/2026/1001-0010', subjectType: 'SAKSI', subjectName: 'Test Saksi', investigatorId: 'OPR-001', room: 'Interview Room 1', profileId: 'STANDARD_1080P25' };

function bed(capture: 'simulated' | 'external') {
  const clock = createManualClock(START);
  const sim = createSim({ clock, storage: null, authStorage: null, capture });
  sim.actions.signIn('budi.santoso', 'demo-2026');
  const state = (): SimState => sim.store.getState();
  const run = (ms: number, step = 50): void => {
    for (let elapsed = 0; elapsed < ms; elapsed += step) {
      clock.advance(step);
      sim.tick();
    }
  };
  return { sim, state, run, clock };
}

describe('a host-clock time slice survives every derivation, with no tick in between', () => {
  it('the derivation itself: the slice comes back the same object, without and with a GNSS_LOSS fault in the state', () => {
    const h = bed('external');
    const before = h.state();
    expect(before.time).toMatchObject({ hostClock: true, source: 'RTC', locked: false });
    expect(deriveDeviceState(before).time).toBe(before.time);
    const faulted: SimState = { ...before, faults: { ...before.faults, active: [...before.faults.active, { kind: FaultKind.GNSS_LOSS, since: START, target: 'NTP' }] } };
    expect(deriveDeviceState(faulted).time).toBe(before.time);
  });

  it('a session is created (a session change) and NO tick follows: the slice still says the host clock', () => {
    const h = bed('external');
    h.run(2_000);
    h.sim.actions.createSession(INPUT);
    expect(h.state().time).toEqual(HOST_CLOCK_TIME);
    expect(isHostClockTime(h.state().time)).toBe(true);
  });

  it('a recording started in the same instant as the last session change says RTC in its audit row, its session and its START node', () => {
    const h = bed('external');
    h.run(2_000);
    h.sim.actions.createSession(INPUT);
    h.sim.actions.beginPrecheck();
    h.run(5_000);
    if (h.state().session?.state === 'PRECHECK') h.sim.actions.acknowledgePrecheckWarnings();
    expect(h.state().session?.state).toBe('ARMED');
    // A derivation runs (what any session change, fault change or link carry does) and NO tick follows before the start.
    h.sim.store.setState(deriveDeviceState(h.state()), true);
    h.sim.actions.startRecording();
    const state = h.state();
    expect(state.session).toMatchObject({ state: 'RECORDING', startTimeSource: 'RTC' });
    const started = state.audit.rows.filter((row) => row.type === 'RECORDING_STARTED' && row.sessionId === state.session?.id);
    expect(started.map((row) => row.details)).toEqual([{ timeSource: 'RTC' }]);
    expect(state.session?.timeline.filter((node) => node.kind === 'START').map((node) => node.params)).toEqual([{ sessionId: state.session?.id, timeSource: 'RTC' }]);
    expect(state.time).toEqual(HOST_CLOCK_TIME);
  });

  it('CONTROL - simulated capture: the same steps keep GNSS, and the derivation still falls back on a GNSS_LOSS fault', () => {
    const h = bed('simulated');
    h.run(2_000);
    h.sim.actions.createSession(INPUT);
    expect(h.state().time).toMatchObject({ source: 'GNSS', locked: true });
    const before = h.state();
    const faulted: SimState = { ...before, faults: { ...before.faults, active: [...before.faults.active, { kind: FaultKind.GNSS_LOSS, since: START, target: 'NTP' }] } };
    expect(deriveDeviceState(faulted).time).toMatchObject({ source: 'NTP', locked: true, gnss: { locked: false } });
  });
});
