// Fix wave H, closing pass Z1, item 9 (driver B decision 6): a TEST / DEVELOPMENT control that holds
// the connecting part of a start in the simulator's own capture, so a gate can look at the
// connecting state for longer than a second. `CreateSimOptions.captureConnectMs`; the default is
// unchanged (`CAPTURE_CONNECT_MS`, 1,000 ms). It is an option of the host that creates the
// simulator, not an action and not a demo control: no operator surface can set it.
import { describe, expect, it } from 'vitest';
import { CAPTURE_CONNECT_MS, CAPTURE_CONNECT_MS_MAX, captureConnectMsOf, createManualClock, createSim, type SessionCreateInput } from '../src/sim';

const START = Date.UTC(2026, 9, 1, 3, 0, 0);
const INPUT: SessionCreateInput = { caseNumber: 'LP/2026/1001-0011', subjectType: 'SAKSI', subjectName: 'Test Saksi', investigatorId: 'OPR-001', room: 'Interview Room 1', profileId: 'STANDARD_1080P25' };

function started(options: { captureConnectMs?: number; capture?: 'simulated' | 'external' } = {}) {
  const clock = createManualClock(START);
  const sim = createSim({ clock, storage: null, authStorage: null, ...options });
  sim.actions.signIn('budi.santoso', 'demo-2026');
  const run = (ms: number, step = 50): void => {
    for (let elapsed = 0; elapsed < ms; elapsed += step) {
      clock.advance(step);
      sim.tick();
    }
  };
  sim.actions.createSession(INPUT);
  sim.actions.beginPrecheck();
  run(6_000);
  sim.actions.startRecording();
  return { sim, run, session: () => sim.store.getState().session };
}

describe('CreateSimOptions.captureConnectMs holds the connecting part of a start', () => {
  it('30,000 ms: the session says connecting for thirty seconds and is durable right after', () => {
    const h = started({ captureConnectMs: 30_000 });
    expect(h.session()).toMatchObject({ state: 'RECORDING', captureDurable: false });
    h.run(29_900);
    expect(h.session()).toMatchObject({ state: 'RECORDING', captureDurable: false });
    h.run(200);
    expect(h.session()?.state).toBe('RECORDING');
    expect(h.session()).not.toHaveProperty('captureDurable');
  });

  it('CONTROL - the default is unchanged: connecting ends 1,000 ms after the start', () => {
    expect(CAPTURE_CONNECT_MS).toBe(1_000);
    const h = started();
    h.run(900);
    expect(h.session()).toMatchObject({ captureDurable: false });
    h.run(200);
    expect(h.session()).not.toHaveProperty('captureDurable');
  });

  it('a value that is no whole number of milliseconds in range is not taken: the default stands', () => {
    for (const bad of [-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, CAPTURE_CONNECT_MS_MAX + 1]) expect(captureConnectMsOf(bad), String(bad)).toBe(CAPTURE_CONNECT_MS);
    expect(captureConnectMsOf(undefined)).toBe(CAPTURE_CONNECT_MS);
    expect(captureConnectMsOf(0)).toBe(0);
    expect(captureConnectMsOf(CAPTURE_CONNECT_MS_MAX)).toBe(CAPTURE_CONNECT_MS_MAX);
    const h = started({ captureConnectMs: -5 });
    h.run(1_100);
    expect(h.session()).not.toHaveProperty('captureDurable');
  });

  it('the Core\'s own capture is not timed at all: the option changes nothing there', () => {
    const h = started({ capture: 'external', captureConnectMs: 2_000 });
    // No member is written by the simulator (the Core's capture session writes it), and none appears later.
    expect(h.session()).not.toHaveProperty('captureDurable');
    h.run(5_000);
    expect(h.session()).not.toHaveProperty('captureDurable');
  });
});
