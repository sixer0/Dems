// Integration pass D10, item 1 (pass D6 item 12; decisions D84, D91 R-1 option A, D156; contract C3
// §3.1 "recording start", §5.3, §5.4; ux flow 11 situation C): the simulator models a recording
// start as the Core does. Every claim has its control beside it.
//
//   start        RECORDING with `captureDurable: false` ("connecting cameras")
//   + delay      durable (the member is removed: absent reads as durable), by the simulator's clock
//   no camera    FAULT, nothing recorded, the alert says NO_CAMERA_CONNECTED / evidenceFiles 0,
//                no evidence item, history INCOMPLETE / never started / 0 bytes
//   one of two   durable, one WARNING naming the missing camera
//   stop before  refused, reason CAPTURE_NOT_DURABLE
//
// The demo control is the EXISTING fault CAMERA_LOSS with a camera target (operations 73 / 74).
import { describe, expect, it } from 'vitest';
import { CAPTURE_NOT_DURABLE_REASON } from '../src/api/sessions';
import { ActiveSessionSchema } from '../src/api/state-slices';
import {
  CAPTURE_CONNECT_MS,
  NO_CAMERA_CONNECTED_REASON,
  SimTransitionError,
  advanceCaptureStart,
  captureDurableOf,
  captureStartDueAt,
  createManualClock,
  createSim,
  passCaptureStart,
  type SessionCreateInput,
  type SimAlert,
  type SimState,
} from '../src/sim';

const START = Date.UTC(2026, 9, 1, 3, 0, 0);
const INPUT: SessionCreateInput = { caseNumber: 'LP/2026/1001-0008', subjectType: 'SAKSI', subjectName: 'Test Saksi', investigatorId: 'OPR-001', room: 'Interview Room 1', profileId: 'STANDARD_1080P25' };

function harness(capture: 'simulated' | 'external' = 'simulated') {
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
  const toArmed = (input: SessionCreateInput = INPUT): void => {
    sim.actions.createSession(input);
    sim.actions.beginPrecheck();
    run(5_000);
    expect(state().session?.state).toBe('ARMED');
  };
  const activeAlerts = (): SimAlert[] => state().alerts.filter((alert) => alert.active);
  return { sim, clock, state, run, toArmed, activeAlerts };
}

const refusal = (act: () => void): unknown => {
  try {
    act();
  } catch (error) {
    return error;
  }
  return null;
};

describe('connecting -> durable', () => {
  it('a start is RECORDING with captureDurable false; the delay later, by the clock, it is durable; nothing else moves', () => {
    const h = harness();
    h.toArmed();
    // The audit ring holds the rows of the demo history: what THIS start writes is counted from here.
    const countOf = (types: readonly string[]): number => h.state().audit.rows.filter((row) => types.includes(row.type)).length;
    const noticed = countOf(['FAULT_RAISED', 'CAPTURE_DEVICE_UNREACHABLE']);
    h.sim.actions.startRecording();
    const startedAt = h.clock.now();
    const connecting = h.state();
    expect(connecting.session).toMatchObject({ state: 'RECORDING', captureDurable: false, startedAt });
    expect(captureDurableOf(connecting.session)).toBe(false);
    expect(captureStartDueAt(connecting.session)).toBe(startedAt + CAPTURE_CONNECT_MS);
    expect(ActiveSessionSchema.safeParse(connecting.session).success).toBe(true);
    // The audit row of the start is the one of an accepted start, as on the Core.
    expect(connecting.audit.rows.at(-1)?.type).toBe('RECORDING_STARTED');

    // CONTROL: one tick short of the delay it is still connecting.
    h.run(CAPTURE_CONNECT_MS - 50);
    expect(h.state().session?.captureDurable).toBe(false);
    h.run(50);
    const durable = h.state();
    expect(durable.session).toMatchObject({ state: 'RECORDING', startedAt });
    // Durable = no member: the session is exactly what a Core stores of it (no column holds the member).
    expect('captureDurable' in (durable.session ?? {})).toBe(false);
    expect(captureDurableOf(durable.session)).toBe(true);
    // Durable writes no audit row and raises nothing.
    expect(countOf(['FAULT_RAISED', 'CAPTURE_DEVICE_UNREACHABLE'])).toBe(noticed);
    expect(h.activeAlerts()).toHaveLength(0);
    expect(captureStartDueAt(durable.session)).toBeNull();
  });

  it('the delay is the constant, in the style of the other machine timings, between one and two seconds', () => {
    expect(CAPTURE_CONNECT_MS).toBeGreaterThanOrEqual(1_000);
    expect(CAPTURE_CONNECT_MS).toBeLessThanOrEqual(2_000);
  });

  it('a stop while connecting is refused with CAPTURE_NOT_DURABLE (action and endpoint); after durable it is taken and the simulator seals by the time', () => {
    const h = harness();
    h.toArmed();
    h.sim.actions.startRecording();
    const id = h.state().session?.id ?? '';
    const stopRows = (): number => h.state().audit.rows.filter((row) => row.type === 'RECORDING_STOPPED').length;
    const stopsBefore = stopRows();
    const refused = refusal(() => h.sim.actions.stopRecording('Interview completed'));
    expect(refused).toBeInstanceOf(SimTransitionError);
    expect((refused as SimTransitionError).reason).toBe(CAPTURE_NOT_DURABLE_REASON);
    expect(h.sim.request({ method: 'POST', path: `/api/v1/session/${id}/stop`, body: { reason: 'Interview completed' } })).toMatchObject({
      status: 409,
      body: { error: { code: 'INVALID_STATE', details: { reason: CAPTURE_NOT_DURABLE_REASON } } },
    });
    expect(h.state().session?.state).toBe('RECORDING');
    expect(stopRows()).toBe(stopsBefore);

    passCaptureStart(h.clock.advance, h.sim.tick);
    const items = h.state().evidence.length;
    h.sim.actions.stopRecording('Interview completed');
    expect(h.state().session?.state).toBe('STOPPING');
    h.run(12_000);
    expect(h.state().session?.state).toBe('SEALED');
    expect(h.state().evidence).toHaveLength(items + 1);
    expect(h.state().evidence.at(-1)?.integritySource).not.toBe('REAL');
  });

  it('the pre-built recording of a scenario is past its start', () => {
    const sim = createSim({ clock: createManualClock(START), storage: null, authStorage: null, scenario: 'recording' });
    expect(sim.store.getState().session?.state).toBe('RECORDING');
    expect(captureDurableOf(sim.store.getState().session)).toBe(true);
    expect('captureDurable' in (sim.store.getState().session ?? {})).toBe(false);
  });

  it('EXTERNAL capture (the Core in real capture operation): the start writes no member and no time decides it', () => {
    const h = harness('external');
    h.toArmed();
    h.sim.actions.startRecording();
    expect(h.state().session?.state).toBe('RECORDING');
    expect('captureDurable' in (h.state().session ?? {})).toBe(false);
    // The Core's capture session says "connecting"; the time never turns it durable, even with every camera lost.
    const session = h.state().session;
    if (session === null) throw new Error('no session');
    h.sim.store.setState({ ...h.state(), session: { ...session, captureDurable: false } }, true);
    h.sim.actions.inject('CAMERA_LOSS', { cameraId: 'VIDEO-01' });
    h.sim.actions.inject('CAMERA_LOSS', { cameraId: 'VIDEO-02' });
    h.run(30_000);
    expect(h.state().session).toMatchObject({ state: 'RECORDING', captureDurable: false });
  });
});

describe('failed start: no camera connected', () => {
  const failedStart = () => {
    const h = harness();
    h.toArmed();
    // The existing demo control, once per camera.
    h.sim.actions.inject('CAMERA_LOSS', { cameraId: 'VIDEO-01' });
    h.sim.actions.inject('CAMERA_LOSS', { cameraId: 'VIDEO-02' });
    expect(h.state().session?.state).toBe('ARMED');
    const evidenceBefore = h.state().evidence.length;
    const historyBefore = h.state().sessionHistory.length;
    h.sim.actions.startRecording();
    expect(h.state().session).toMatchObject({ state: 'RECORDING', captureDurable: false });
    h.run(CAPTURE_CONNECT_MS);
    return { h, evidenceBefore, historyBefore };
  };

  it('ends in FAULT with nothing recorded; the alert and its audit row carry NO_CAMERA_CONNECTED and evidenceFiles 0', () => {
    const { h, evidenceBefore } = failedStart();
    const state = h.state();
    expect(state.session).toMatchObject({ state: 'FAULT', captureDurable: false, startedAt: null, bytesWritten: 0, fault: { kind: 'CAPTURE_FAULT', fromState: 'RECORDING' } });
    expect(ActiveSessionSchema.safeParse(state.session).success).toBe(true);
    const alerts = h.activeAlerts().filter((alert) => alert.kind === 'CAPTURE_FAULT');
    expect(alerts).toHaveLength(1);
    expect(alerts[0]?.params).toMatchObject({ reason: NO_CAMERA_CONNECTED_REASON, evidenceFiles: 0 });
    expect(alerts[0]?.severity).toBe('CRITICAL');
    const raised = state.audit.rows.filter((row) => row.type === 'FAULT_RAISED' && row.details?.['kind'] === 'CAPTURE_FAULT' && row.sessionId === state.session?.id);
    expect(raised).toHaveLength(1);
    expect(raised[0]?.details).toMatchObject({ reason: NO_CAMERA_CONNECTED_REASON, evidenceFiles: 0 });
    // The fault row of the session says the same.
    expect(state.session?.timeline.at(-1)).toMatchObject({ kind: 'FAULT', params: { reason: NO_CAMERA_CONNECTED_REASON, evidenceFiles: 0, durable: false } });
    expect(state.evidence).toHaveLength(evidenceBefore);
    // No degraded warning beside the critical alert: a failed start has ONE alert of its own.
    expect(h.activeAlerts().filter((alert) => alert.params?.['reason'] === 'CAPTURE_DEVICE_UNREACHABLE')).toHaveLength(0);
  });

  it('its recovery keeps a history entry INCOMPLETE / never started / 0 bytes and makes NO evidence item', () => {
    const { h, evidenceBefore, historyBefore } = failedStart();
    const id = h.state().session?.id;
    h.sim.actions.recover();
    h.run(4_000);
    const state = h.state();
    expect(state.session).toBeNull();
    expect(state.sessionHistory).toHaveLength(historyBefore + 1);
    expect(state.sessionHistory[0]).toMatchObject({ id, outcome: 'INCOMPLETE', startedAt: null, durationMs: 0, sizeBytes: 0, evidenceId: null, faultKind: 'CAPTURE_FAULT' });
    expect(state.evidence).toHaveLength(evidenceBefore);
  });

  it('CONTROL: a recording that WAS durable and then faulted is recovered WITH its evidence item', () => {
    const h = harness();
    h.toArmed();
    h.sim.actions.startRecording();
    h.run(5_000);
    const evidenceBefore = h.state().evidence.length;
    h.sim.actions.inject('POWER_FAIL');
    expect(h.state().session?.state).toBe('FAULT');
    expect(captureDurableOf(h.state().session)).toBe(true);
    h.sim.actions.recover();
    h.run(4_000);
    expect(h.state().evidence).toHaveLength(evidenceBefore + 1);
    expect(h.state().sessionHistory[0]?.startedAt).not.toBeNull();
    expect(h.state().sessionHistory[0]?.sizeBytes).toBeGreaterThan(0);
  });

  it('the next start that connects ends the fault of the failed one (D84 R-4)', () => {
    const { h } = failedStart();
    h.sim.actions.recover();
    h.run(4_000);
    h.sim.actions.clearFault('CAMERA_LOSS', { cameraId: 'VIDEO-01' });
    h.sim.actions.clearFault('CAMERA_LOSS', { cameraId: 'VIDEO-02' });
    // The fault of the capture outlives its session until a session records again.
    expect(h.state().faults.active.some((fault) => fault.kind === 'CAPTURE_FAULT')).toBe(true);
    h.toArmed({ ...INPUT, subjectName: 'Second Saksi' });
    h.sim.actions.startRecording();
    h.run(CAPTURE_CONNECT_MS);
    expect(h.state().session?.state).toBe('RECORDING');
    expect(captureDurableOf(h.state().session)).toBe(true);
    expect(h.state().faults.active.some((fault) => fault.kind === 'CAPTURE_FAULT')).toBe(false);
    expect(h.activeAlerts().filter((alert) => alert.kind === 'CAPTURE_FAULT')).toHaveLength(0);
  });

  it('a camera restored while the cameras connect does connect: the control is read when the start is decided', () => {
    const h = harness();
    h.toArmed();
    h.sim.actions.inject('CAMERA_LOSS', { cameraId: 'VIDEO-01' });
    h.sim.actions.inject('CAMERA_LOSS', { cameraId: 'VIDEO-02' });
    h.sim.actions.startRecording();
    h.run(CAPTURE_CONNECT_MS / 2);
    h.sim.actions.clearFault('CAMERA_LOSS', { cameraId: 'VIDEO-01' });
    h.sim.actions.clearFault('CAMERA_LOSS', { cameraId: 'VIDEO-02' });
    h.run(CAPTURE_CONNECT_MS);
    expect(h.state().session?.state).toBe('RECORDING');
    expect(captureDurableOf(h.state().session)).toBe(true);
  });
});

describe('degraded start: one camera of two', () => {
  it('is durable, with one WARNING naming the missing camera and its audit row; no capture fault', () => {
    const h = harness();
    h.toArmed();
    h.sim.actions.inject('CAMERA_LOSS', { cameraId: 'VIDEO-02' });
    h.sim.actions.startRecording();
    const id = h.state().session?.id;
    h.run(CAPTURE_CONNECT_MS);
    const state = h.state();
    expect(state.session?.state).toBe('RECORDING');
    expect(captureDurableOf(state.session)).toBe(true);
    const warnings = h.activeAlerts().filter((alert) => alert.params?.['reason'] === 'CAPTURE_DEVICE_UNREACHABLE');
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toMatchObject({ kind: 'SYSTEM', severity: 'WARNING', target: 'CAM-02', params: { deviceId: 'CAM-02', deviceKind: 'CAMERA', phase: 'SESSION_START', cause: 'NOT_CONNECTED' } });
    const rows = state.audit.rows.filter((row) => row.type === 'CAPTURE_DEVICE_UNREACHABLE' && row.sessionId === id);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.details).toEqual({ deviceId: 'CAM-02', deviceKind: 'CAMERA', phase: 'SESSION_START', reason: 'NOT_CONNECTED', degraded: true, sessionId: id });
    expect(state.faults.active.some((fault) => fault.kind === 'CAPTURE_FAULT')).toBe(false);
    // CONTROL: the camera that connected is named by nothing.
    expect(h.activeAlerts().some((alert) => alert.target === 'CAM-01')).toBe(false);
    // A degraded recording can be stopped.
    h.sim.actions.stopRecording('Interview completed');
    expect(h.state().session?.state).toBe('STOPPING');
  });
});

describe('the pure decision and the helper', () => {
  it('advanceCaptureStart returns the same state before its instant and for a session that is not connecting', () => {
    const h = harness();
    h.toArmed();
    const armed = h.state();
    expect(advanceCaptureStart(armed, h.clock.now() + 60_000)).toBe(armed);
    h.sim.actions.startRecording();
    const connecting = h.state();
    expect(advanceCaptureStart(connecting, h.clock.now() + CAPTURE_CONNECT_MS - 1)).toBe(connecting);
    const durable = advanceCaptureStart(connecting, h.clock.now() + CAPTURE_CONNECT_MS);
    expect(captureDurableOf(durable.session)).toBe(true);
    expect(advanceCaptureStart(durable, h.clock.now() + 60_000)).toBe(durable);
  });

  it('passCaptureStart advances by the delay and ticks once', () => {
    const calls: string[] = [];
    passCaptureStart(
      (ms) => calls.push(`advance:${ms}`),
      () => calls.push('tick'),
    );
    expect(calls).toEqual([`advance:${CAPTURE_CONNECT_MS}`, 'tick']);
  });
});
