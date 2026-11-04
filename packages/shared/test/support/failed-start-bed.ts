// Test bed of the review-74 cases (R74-01, R74-02, R74-05, R74-11): a signed-in simulator on a
// manual clock with the moves of a start that fails and of a recording. One definition; the test
// files that use it are `sim-capture-fault` and `sim-capture-config`.
import { expect } from 'vitest';
import { CAPTURE_CONNECT_MS, RECOVERY_MS, createManualClock, createSim, type SessionCreateInput, type SimAlert, type SimState } from '../../src/sim';

export const START = Date.UTC(2026, 9, 1, 3, 0, 0);

export const INPUT: SessionCreateInput = { caseNumber: 'LP/2026/1001-0008', subjectType: 'SAKSI', subjectName: 'Test Saksi', investigatorId: 'OPR-001', room: 'Interview Room 1', profileId: 'STANDARD_1080P25' };

export function harness() {
  const clock = createManualClock(START);
  const sim = createSim({ clock, storage: null, authStorage: null, capture: 'simulated' });
  sim.actions.signIn('budi.santoso', 'demo-2026');
  const state = (): SimState => sim.store.getState();
  const run = (ms: number, step = 50): void => {
    for (let elapsed = 0; elapsed < ms; elapsed += step) {
      clock.advance(step);
      sim.tick();
    }
  };
  const toArmed = (): void => {
    sim.actions.createSession(INPUT);
    sim.actions.beginPrecheck();
    run(5_000);
    expect(state().session?.state).toBe('ARMED');
  };
  const captureAlerts = (): SimAlert[] => state().alerts.filter((alert) => alert.kind === 'CAPTURE_FAULT');
  const raisedRows = () => state().audit.rows.filter((row) => row.type === 'FAULT_RAISED' && row.details?.['kind'] === 'CAPTURE_FAULT');
  /** A start at which no camera connects: the session ends in FAULT with nothing recorded. */
  const failedStart = (): string => {
    // The cameras are back for the pre-check and lost again before the start.
    sim.actions.clearFault('CAMERA_LOSS');
    toArmed();
    // D60 (2026-11-04): NO camera connects means ALL FOUR tracks are lost - the two further
    // built-in cameras would otherwise carry the start.
    sim.actions.inject('CAMERA_LOSS', { cameraId: 'VIDEO-01' });
    sim.actions.inject('CAMERA_LOSS', { cameraId: 'VIDEO-02' });
    sim.actions.inject('CAMERA_LOSS', { cameraId: 'VIDEO-03' });
    sim.actions.inject('CAMERA_LOSS', { cameraId: 'VIDEO-04' });
    sim.actions.startRecording();
    run(CAPTURE_CONNECT_MS);
    const session = state().session;
    expect(session).toMatchObject({ state: 'FAULT', captureDurable: false });
    return session?.id ?? '';
  };
  const recover = (): void => {
    sim.actions.recover();
    run(RECOVERY_MS + 100);
    expect(state().session).toBeNull();
  };
  return { sim, clock, state, run, toArmed, captureAlerts, raisedRows, failedStart, recover };
}
