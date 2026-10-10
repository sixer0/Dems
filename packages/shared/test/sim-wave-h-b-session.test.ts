// Wave H, driver B (decision D200; gates 75 and 89): the session state of an interrupted recording
// and the capture faults of the simulator. One block per finding, each written RED against f293221.
//
//   G75-03 / G75-08  an interrupted seal: `stoppedAt` is the end of the durable media, the recording
//                    time stops there, and the session / its history entry / its item say "interrupted"
//   G75-10           the capture fault of a recording that was sealed as interrupted is over at the seal;
//                    the fault a CLOSED failed start left is no critical "blocked" state
//   G75-05           FAULT_CLEARED of a capture fault is worded by ITS cause
//   G75-06           demo operation 74 never clears a capture-originated fault (D72(h))
//   G75-09           the demo control's own capture fault claims no interruption
//   G75-11           a failed start leaves no "Recording started" node in the session's timeline
//   G75-07 (c), (d)  the warning of a degraded start ends with its session; the next pre-check passes
//   G75-02           the switch row names the sending device of the command (the Core's device session)
import { describe, expect, it } from 'vitest';
import {
  CAPTURE_CONNECT_MS,
  FINALIZATION_ORDER,
  INTERRUPTED_SEAL_SENTENCES,
  RECOVERY_MS,
  applySealingProgressTransition,
  completeSealTransition,
  createManualClock,
  createSim,
  interruptedCaptureTransition,
  interruptedSealCauseSentence,
  interruptedSealOfItem,
  interruptedSealOfSession,
  raiseCaptureWarningTransition,
  selectElapsedMs,
  systemStatus,
  toApiSession,
  type CaptureWarningInput,
  type CompleteSealInput,
  type SealingStepReport,
  type SessionCreateInput,
  type SimState,
} from '../src/sim';
import { en } from '../src/i18n';

const START = Date.UTC(2026, 9, 1, 3, 0, 0);
const INPUT: SessionCreateInput = { caseNumber: 'LP/2026/1001-0008', subjectType: 'SAKSI', subjectName: 'Test Saksi', investigatorId: 'OPR-001', room: 'Interview Room 1', profileId: 'STANDARD_1080P25' };
const hex = (seed: string, length = 64): string => seed.repeat(length).slice(0, length);

function harness(options: { deviceConsole?: boolean } = {}) {
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

const report = (running: number, progress: number): SealingStepReport[] =>
  FINALIZATION_ORDER.map((id, index) => ({ id, status: index < running ? 'DONE' : index === running ? 'RUNNING' : 'PENDING', progress: index < running ? 100 : index === running ? progress : 0, etaMs: index === running ? 900 : null, attempt: 1 }));

const sealInput = (sessionId: string, at: number, overrides: Partial<CompleteSealInput> = {}): CompleteSealInput => ({
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
function interrupt(h: ReturnType<typeof harness>, sessionId: string): number {
  const at = h.clock.now();
  h.apply(raiseCaptureWarningTransition(h.state(), at, { code: 'CAPTURE_FAULT', subject: null } as CaptureWarningInput));
  h.apply(interruptedCaptureTransition(h.state(), at, sessionId));
  expect(h.state().session).toMatchObject({ state: 'FAULT', captureDurable: true });
  return at;
}

describe('G75-03 / G75-08: an interrupted seal names itself and stops its clock', () => {
  it('from the fault on, the recording time stands at the instant the recording ended', () => {
    const h = harness();
    const sessionId = h.toRecording();
    const startedAt = h.state().session?.startedAt ?? 0;
    const faultAt = interrupt(h, sessionId);
    h.run(30_000);
    expect(h.state().clock.now).toBeGreaterThan(faultAt + 20_000);
    expect(selectElapsedMs(h.state())).toBe(faultAt - startedAt);
    h.apply(applySealingProgressTransition(h.state(), h.clock.now(), { sessionId, steps: report(2, 40) }));
    h.run(30_000);
    expect(selectElapsedMs(h.state())).toBe(faultAt - startedAt);
    // Not sealed yet: the session says it already (the Finalizing views name it).
    expect(interruptedSealOfSession(h.state(), sessionId)).toEqual({ faultKind: 'CAPTURE_FAULT', endedAt: faultAt });
  });

  it('SEALED: `stoppedAt` is the end of the durable media, `elapsedMs` stops there, and the session, the history entry and the item say interrupted', () => {
    const h = harness();
    const sessionId = h.toRecording();
    const startedAt = h.state().session?.startedAt ?? 0;
    const faultAt = interrupt(h, sessionId);
    h.run(1_000);
    h.apply(applySealingProgressTransition(h.state(), h.clock.now(), { sessionId, steps: report(5, 90) }));
    const sealedAt = h.clock.now() + 300;
    const durableEndAt = faultAt - 400;
    h.apply(completeSealTransition(h.state(), sealedAt, sealInput(sessionId, sealedAt, { interrupted: true, durableEndAt })));
    const session = h.state().session;
    expect(session).toMatchObject({ state: 'SEALED', stoppedAt: durableEndAt });
    h.run(90_000);
    expect(selectElapsedMs(h.state())).toBe(durableEndAt - startedAt);
    const payload = toApiSession(h.state(), h.state().session!);
    expect(payload.stoppedAt).not.toBeNull();
    expect(payload.elapsedMs).toBe(durableEndAt - startedAt);
    expect(payload.fault).toMatchObject({ kind: 'CAPTURE_FAULT', fromState: 'RECORDING' });

    const item = h.state().evidence.at(-1);
    expect(interruptedSealOfItem(item)).toEqual({ faultKind: 'CAPTURE_FAULT', endedAt: durableEndAt });
    expect(interruptedSealOfSession(h.state(), sessionId)).toEqual({ faultKind: 'CAPTURE_FAULT', endedAt: durableEndAt });
    // The history entry: SEALED with no fault kind (the database CHECK) - the fact is read through its item.
    const entry = h.state().sessionHistory[0];
    expect(entry).toMatchObject({ id: sessionId, outcome: 'SEALED', faultKind: null, durationMs: durableEndAt - startedAt });
    const closed: SimState = { ...h.state(), session: null };
    expect(interruptedSealOfSession(closed, entry?.id)).toEqual({ faultKind: 'CAPTURE_FAULT', endedAt: durableEndAt });
  });

  it('the words: one title that is never the plain sealed state, and the sentence of the cause', () => {
    expect(INTERRUPTED_SEAL_SENTENCES.title).toBe('Sealed — recording was interrupted');
    expect(en.common.interruptedSeal).toBe(INTERRUPTED_SEAL_SENTENCES);
    expect(interruptedSealCauseSentence('CAPTURE_FAULT')).toBe(en.common.captureFault.noReason.capture);
    expect(interruptedSealCauseSentence('CAPTURE_FAULT', 'WORKER_KILLED')).toBe(en.common.captureFault.reason.WORKER_KILLED);
    expect(interruptedSealCauseSentence('POWER_FAIL')).toContain('POWER_FAIL');
    expect(interruptedSealCauseSentence(null)).not.toMatch(/\{\{|null/);
    // Free text of another process is never shown as a code.
    expect(interruptedSealCauseSentence('<b>x</b>')).toBe(INTERRUPTED_SEAL_SENTENCES.noCause);
  });

  it('CONTROL - a recording ended by its stop: the operator stop instant stays, nothing says interrupted', () => {
    const h = harness();
    const sessionId = h.toRecording();
    h.sim.actions.stopRecording('Interview finished');
    const stoppedAt = h.state().session?.stoppedAt ?? null;
    expect(stoppedAt).not.toBeNull();
    h.apply({ ...h.state(), session: { ...h.state().session!, captureDurable: true } });
    h.apply(applySealingProgressTransition(h.state(), h.clock.now(), { sessionId, steps: report(5, 90) }));
    const at = h.clock.now() + 300;
    h.apply(completeSealTransition(h.state(), at, sealInput(sessionId, at)));
    expect(h.state().session).toMatchObject({ state: 'SEALED', stoppedAt });
    expect(interruptedSealOfSession(h.state(), sessionId)).toBeNull();
    expect(interruptedSealOfItem(h.state().evidence.at(-1))).toBeNull();
    expect(interruptedSealOfSession(h.state(), null)).toBeNull();
  });
});

describe('G75-10: a capture fault of a closed session neither blocks nor stands as critical', () => {
  it('the interrupted seal ends the capture fault of its recording: one FAULT_CLEARED row, the alert resolved, no critical state left', () => {
    const h = harness();
    const sessionId = h.toRecording();
    interrupt(h, sessionId);
    expect(h.captureAlerts().filter((alert) => alert.active)).toHaveLength(1);
    const clearedBefore = h.rows('FAULT_CLEARED').length;
    h.apply(applySealingProgressTransition(h.state(), h.clock.now(), { sessionId, steps: report(5, 90) }));
    const at = h.clock.now() + 300;
    h.apply(completeSealTransition(h.state(), at, sealInput(sessionId, at, { interrupted: true, durableEndAt: at - 1_000 })));
    expect(h.state().faults.active.filter((fault) => fault.kind === 'CAPTURE_FAULT')).toHaveLength(0);
    expect(h.captureAlerts().filter((alert) => alert.active)).toHaveLength(0);
    expect(h.rows('FAULT_CLEARED').slice(clearedBefore)).toHaveLength(1);
    expect(systemStatus(h.state()).state).not.toBe('CRITICAL');
  });

  it('the fault a CLOSED failed start left stays raised (D84 R-4) as a warning: the system is not CRITICAL while a session can start', () => {
    const h = harness();
    h.failedStart();
    // While the failed start is open it is the critical cause of its session.
    expect(systemStatus(h.state()).state).toBe('CRITICAL');
    h.closeFailedStart();
    expect(h.state().faults.active.some((fault) => fault.kind === 'CAPTURE_FAULT')).toBe(true);
    const status = systemStatus(h.state());
    expect(status.state).not.toBe('CRITICAL');
    expect(status.flags.find((flag) => flag.id === 'CAPTURE_FAULT')).toMatchObject({ severity: 'WARNING', message: 'No camera connected. Nothing was recorded.' });
  });
});

describe('G75-05: the clear row of a capture fault is worded by its own cause', () => {
  it('a no-camera fault that the next start ends reads the no-camera sentence, and its details name the reason', () => {
    const h = harness();
    h.failedStart();
    h.closeFailedStart();
    const before = h.rows('FAULT_CLEARED').length;
    h.toRecording();
    const cleared = h.rows('FAULT_CLEARED').slice(before).filter((row) => row.details?.['kind'] === 'CAPTURE_FAULT');
    expect(cleared).toHaveLength(1);
    expect(cleared[0]?.message).toBe('No camera connected. Nothing was recorded. — cleared');
    expect(cleared[0]?.message).not.toMatch(/stopped unexpectedly|interrupted/);
    expect(cleared[0]?.details).toMatchObject({ reason: 'NO_CAMERA_CONNECTED' });
  });
});

describe('G75-06: demo operation 74 never clears a capture-originated fault', () => {
  it('the fault of a failed start whose session is CLOSED survives the demo clear: no row, the alert stays active', () => {
    const h = harness();
    h.failedStart();
    h.closeFailedStart();
    const before = h.rows('FAULT_CLEARED').length;
    h.sim.actions.clearFault('CAPTURE_FAULT');
    expect(h.captureAlerts().filter((alert) => alert.active)).toHaveLength(1);
    expect(h.state().faults.active.some((fault) => fault.kind === 'CAPTURE_FAULT')).toBe(true);
    expect(h.rows('FAULT_CLEARED').slice(before)).toHaveLength(0);
  });

  it('CONTROL - the demo control clears the capture fault it raised itself', () => {
    const h = harness();
    h.sim.actions.inject('CAPTURE_FAULT');
    expect(h.captureAlerts().filter((alert) => alert.active)).toHaveLength(1);
    h.sim.actions.clearFault('CAPTURE_FAULT');
    expect(h.captureAlerts().filter((alert) => alert.active)).toHaveLength(0);
    expect(h.state().faults.active.some((fault) => fault.kind === 'CAPTURE_FAULT')).toBe(false);
  });
});

describe('G75-09: the demo control capture fault claims no interruption', () => {
  it('the session keeps recording and neither the alert nor its rows say the recording was interrupted', () => {
    const h = harness();
    h.toRecording();
    h.sim.actions.inject('CAPTURE_FAULT');
    expect(h.state().session?.state).toBe('RECORDING');
    const alert = h.captureAlerts().at(-1);
    expect(alert?.message).not.toMatch(/interrupted|stopped unexpectedly/);
    expect(alert?.message).toBe(en.common.captureFault.reason.DEMO_CAPTURE_FAULT);
    expect(h.rows('FAULT_RAISED').at(-1)?.message).toBe(alert?.message);
    h.sim.actions.clearFault('CAPTURE_FAULT');
    expect(h.rows('FAULT_CLEARED').at(-1)?.message).not.toMatch(/interrupted|stopped unexpectedly/);
  });
});

describe('G75-11: a failed start is not a recording that started', () => {
  it('the timeline of the failed start has no START node; the audit row of the accepted start is followed by the failure with its reason', () => {
    const h = harness();
    const sessionId = h.failedStart();
    const timeline = h.state().session?.timeline ?? [];
    expect(timeline.some((item) => item.kind === 'START')).toBe(false);
    expect(timeline.at(-1)).toMatchObject({ kind: 'FAULT', params: { durable: false, reason: 'NO_CAMERA_CONNECTED', evidenceFiles: 0 } });
    const ofSession = h.state().audit.rows.filter((row) => row.sessionId === sessionId);
    const started = ofSession.findIndex((row) => row.type === 'RECORDING_STARTED');
    expect(started).toBeGreaterThanOrEqual(0);
    expect(ofSession.slice(started + 1).find((row) => row.type === 'FAULT_RAISED')?.details).toMatchObject({ kind: 'CAPTURE_FAULT', reason: 'NO_CAMERA_CONNECTED', evidenceFiles: 0 });
  });

  it('CONTROL - a start that connects keeps its START node', () => {
    const h = harness();
    h.toRecording();
    expect(h.state().session?.timeline.some((item) => item.kind === 'START')).toBe(true);
  });
});

describe('G75-07 (c), (d): the warning of a degraded start ends with its session', () => {
  const degraded = (h: ReturnType<typeof harness>) => h.state().alerts.filter((alert) => alert.kind === 'SYSTEM' && alert.params?.['reason'] === 'CAPTURE_DEVICE_UNREACHABLE' && alert.params['phase'] === 'SESSION_START');

  it('the warning is active while the session records one camera, and resolved once that session no longer records', () => {
    const h = harness();
    h.toArmed();
    h.sim.actions.inject('CAMERA_LOSS', { cameraId: 'VIDEO-02' });
    h.sim.actions.startRecording();
    h.run(CAPTURE_CONNECT_MS + 2_000);
    expect(h.state().session?.state).toBe('RECORDING');
    expect(degraded(h).filter((alert) => alert.active)).toHaveLength(1);
    h.sim.actions.clearFault('CAMERA_LOSS');
    h.run(1_000);
    // Still recording: the session did start without that camera.
    expect(degraded(h).filter((alert) => alert.active)).toHaveLength(1);
    h.sim.actions.stopRecording('Interview finished');
    h.run(15_000);
    expect(h.state().session?.state).toBe('SEALED');
    expect(degraded(h).filter((alert) => alert.active)).toHaveLength(0);
    expect(h.state().captureDevices.devices.find((device) => device.id === 'CAM-02')?.online).toBe(true);

    // (d) the next pre-check, the camera being back: no "CAM-02 is not reachable" warning.
    h.sim.actions.acknowledgeSummary(h.state().lastSealedSessionId ?? '');
    h.run(100);
    h.toArmed();
    const session = h.state().session;
    expect(session?.state).toBe('ARMED');
    expect(session?.precheck.outcome).toBe('PASS');
    expect(session?.precheck.items.filter((item) => item.value === 'UNREACHABLE')).toHaveLength(0);
  });
});

describe('G75-02: the switch row names the device that sent the command', () => {
  const lastSwitch = (h: ReturnType<typeof harness>) => h.rows('AUDIO_SOURCE_SWITCHED').at(-1);

  it('a hosted command of a paired device session (a Core in simulated capture): the row and its details carry that device ID, phone or tablet', () => {
    const h = harness();
    h.toRecording();
    // What the Core's actor scope sets for ONE command: the operator and the paired device of the request.
    h.apply({ ...h.state(), auth: { ...h.state().auth, deviceId: 'DEV-0002' } });
    h.sim.actions.switchAudioSource('MIC-02');
    expect(lastSwitch(h)).toMatchObject({ deviceId: 'DEV-0002', details: { fromInput: 'MIC-01', toInput: 'MIC-02', sendingDeviceId: 'DEV-0002' } });
  });

  it('CONTROL - a web console session (no device): no device on the row and no `sendingDeviceId` key', () => {
    const h = harness();
    h.toRecording();
    h.sim.actions.switchAudioSource('MIC-02');
    const row = lastSwitch(h);
    expect(row?.deviceId).toBeNull();
    expect(Object.keys(row?.details ?? {})).toEqual(['fromInput', 'toInput', 'fromMs', 'toMs']);
  });
});
