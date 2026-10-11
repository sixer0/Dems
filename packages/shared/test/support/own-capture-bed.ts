// Test bed of the closing-pass-J cases (G75b-03, G75b-06, G75b-10): a simulator in the simulated or
// in the Core's own (`external`) capture, on a manual clock. One definition; the test files that
// use it are `sim-own-capture` and `sim-capture-start`.
import { createManualClock, createSim, type SessionCreateInput, type SimState } from '../../src/sim';

export const START = Date.UTC(2026, 9, 1, 3, 0, 0);

export const INPUT: SessionCreateInput = { caseNumber: 'LP/2026/1001-0011', subjectType: 'SAKSI', subjectName: 'Test Saksi', investigatorId: 'OPR-001', room: 'Interview Room 1', profileId: 'STANDARD_1080P25' };

export const INTEGRITY = ['FRAME_HASH', 'WRITE_VERIFIED', 'TIMESTAMP_CONFIRMED'];

export function bed(options: { captureConnectMs?: number; capture?: 'simulated' | 'external' } = {}) {
  const clock = createManualClock(START);
  const sim = createSim({ clock, storage: null, authStorage: null, ...options });
  sim.actions.signIn('budi.santoso', 'demo-2026');
  const run = (ms: number, step = 50): void => {
    for (let elapsed = 0; elapsed < ms; elapsed += step) {
      clock.advance(step);
      sim.tick();
    }
  };
  const armed = (): void => {
    sim.actions.createSession(INPUT);
    sim.actions.beginPrecheck();
    run(6_000);
  };
  const state = (): SimState => sim.store.getState();
  const integrityRows = () => state().audit.rows.filter((row) => INTEGRITY.includes(row.type)).map((row) => `${row.type}@${row.at - START}`);
  return { sim, clock, run, armed, state, integrityRows };
}
