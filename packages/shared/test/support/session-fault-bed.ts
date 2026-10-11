// Test bed of the interrupted-recording, capture-fault, failed-start and switch-row cases of wave H
// driver B (findings G75-02 .. G75-11): a signed-in simulator on a manual clock with the moves of
// a recording and of a failed start, the step report and the seal input of a Core-driven seal, and
// the Core's order of an interrupted recording. One definition; the test files that use it are
// `sim-core-driven-seal`, `sim-capture-fault`, `sim-capture-start` and `sim-sending-device`.
import { expect } from 'vitest';
import {
  CAPTURE_CONNECT_MS,
  FINALIZATION_ORDER,
  RECOVERY_MS,
  createManualClock,
  createSim,
  interruptedCaptureTransition,
  raiseCaptureWarningTransition,
  type CaptureWarningInput,
  type CompleteSealInput,
  type SealingStepReport,
  type SessionCreateInput,
  type SimState,
} from '../../src/sim';

export const START = Date.UTC(2026, 9, 1, 3, 0, 0);

export const INPUT: SessionCreateInput = { caseNumber: 'LP/2026/1001-0008', subjectType: 'SAKSI', subjectName: 'Test Saksi', investigatorId: 'OPR-001', room: 'Interview Room 1', profileId: 'STANDARD_1080P25' };

export const hex = (seed: string, length = 64): string => seed.repeat(length).slice(0, length);

export function harness(options: { deviceConsole?: boolean } = {}) {
  const clock = createManualClock(START);
  const sim = createSim({ clock, storage: null, authStorage: null, capture: 'simulated', ...options });
  sim.actions.signIn('budi.santoso', 'demo-2026');
  const state = (): SimState => sim.store.getState();
  const run = (ms: number, step = 50): void => {
    for (let elapsed = 0; elapsed < ms; elapsed += step) {
      clock.advance(step);
      sim.tick();
    }
  };
  const apply = (next: SimState): void => {
    sim.store.setState(next, true);
  };
  const toArmed = (): void => {
    sim.actions.createSession(INPUT);
    sim.actions.beginPrecheck();
    run(5_000);
  };
  const toRecording = (): string => {
    toArmed();
    expect(state().session?.state).toBe('ARMED');
    sim.actions.startRecording();
    run(CAPTURE_CONNECT_MS + 3_000);
    expect(state().session?.state).toBe('RECORDING');
    return state().session?.id ?? '';
  };
  /** A start at which no camera connects, as the demo control makes one. */
  const failedStart = (): string => {
    sim.actions.clearFault('CAMERA_LOSS');
    toArmed();
    sim.actions.inject('CAMERA_LOSS', { cameraId: 'VIDEO-01' });
    sim.actions.inject('CAMERA_LOSS', { cameraId: 'VIDEO-02' });
    sim.actions.startRecording();
    run(CAPTURE_CONNECT_MS);
    expect(state().session).toMatchObject({ state: 'FAULT', captureDurable: false });
    return state().session?.id ?? '';
  };
  const closeFailedStart = (): void => {
    sim.actions.recover();
    run(RECOVERY_MS + 100);
    expect(state().session).toBeNull();
    sim.actions.clearFault('CAMERA_LOSS');
  };
  const captureAlerts = () => state().alerts.filter((alert) => alert.kind === 'CAPTURE_FAULT');
  const rows = (type: string) => state().audit.rows.filter((row) => row.type === type);
  return { sim, clock, state, run, apply, toArmed, toRecording, failedStart, closeFailedStart, captureAlerts, rows };
}

export const report = (running: number, progress: number): SealingStepReport[] =>
  FINALIZATION_ORDER.map((id, index) => ({ id, status: index < running ? 'DONE' : index === running ? 'RUNNING' : 'PENDING', progress: index < running ? 100 : index === running ? progress : 0, etaMs: index === running ? 900 : null, attempt: 1 }));

export const sealInput = (sessionId: string, at: number, overrides: Partial<CompleteSealInput> = {}): CompleteSealInput => ({
  sessionId,
  sealedAt: at,
  manifestSha256: hex('ab'),
  signature: { value: hex('cd', 128), keyId: 'CORE-KEY-EVSIGN-01', algorithm: 'Ed25519' },
  tracks: [
    { trackId: 'VIDEO-01', sizeBytes: 4_000, sha256: hex('01') },
    { trackId: 'VIDEO-02', sizeBytes: 5_000, sha256: hex('02') },
  ],
  interrupted: false,
  durableEndAt: at - 2_000,
  transcriptSha256: null,
  labelsStatus: null,
  developmentSources: true,
  ...overrides,
});

/** The Core's order of an interrupted recording: the forwarder raises the capture-wide fault, the capture session ends the recording. */
export function interrupt(h: ReturnType<typeof harness>, sessionId: string): number {
  const at = h.clock.now();
  h.apply(raiseCaptureWarningTransition(h.state(), at, { code: 'CAPTURE_FAULT', subject: null } as CaptureWarningInput));
  h.apply(interruptedCaptureTransition(h.state(), at, sessionId));
  expect(h.state().session).toMatchObject({ state: 'FAULT', captureDurable: true });
  return at;
}
