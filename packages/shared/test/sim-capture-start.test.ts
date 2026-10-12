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
  CAPTURE_SOURCE_NOT_ASSIGNED_REASON,
  applyAudioSourceSwitch,
  audioSourceAtStart,
  advanceCaptureStart,
  captureDurableOf,
  captureStartDueAt,
  createManualClock,
  createSim,
  passCaptureStart,
  type SessionCreateInput,
  type SimAlert,
  type SimState,
  CAPTURE_CONNECT_MS_MAX,
  captureConnectMsOf,
  captureDurableTransition,
} from '../src/sim';
import * as sessionFaultBed from './support/session-fault-bed';
import { en } from '../src/i18n';
import * as ownCaptureBed from './support/own-capture-bed';
import * as selectorBed from './support/selector-category-bed';
import { SessionResourceSchema } from '../src/api';
import * as micIdBed from './support/mic-id-bed';

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

// Fix wave H, closing pass Z1, item 9 (driver B decision 6): a TEST / DEVELOPMENT control that holds
// the connecting part of a start in the simulator's own capture, so a gate can look at the
// connecting state for longer than a second. `CreateSimOptions.captureConnectMs`; the default is
// unchanged (`CAPTURE_CONNECT_MS`, 1,000 ms). It is an option of the host that creates the
// simulator, not an action and not a demo control: no operator surface can set it.
describe('the option that holds the connecting part', () => {
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
});

// Wave H, driver B (decision D200; gate 75), each written RED against f293221.
//   G75-11           a failed start leaves no "Recording started" node in the session's timeline
//   G75-07 (c), (d)  the warning of a degraded start ends with its session; the next pre-check passes
describe('a failed and a degraded start on the session records', () => {
  const { harness } = sessionFaultBed;

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
});

// Closing pass J of fix wave I (decision D216; request G75b-10): the generator's hold - no integrity
// row for a start that is not decided, none for a start that failed, the same rows for a start that
// happened; and the reason a refused start carries to the client.
describe('a start that is not decided, and a start that is refused', () => {
  const { bed } = ownCaptureBed;

  describe('the generator holds its integrity rows while a start is not decided (G75b-10)', () => {
    it('a FAILED start of the simulated lane has no FRAME_HASH / WRITE_VERIFIED / TIMESTAMP_CONFIRMED row at all', () => {
      const h = bed({ captureConnectMs: 30_000 });
      h.armed();
      h.sim.actions.startRecording();
      h.sim.actions.inject('CAMERA_LOSS', { cameraId: 'VIDEO-01' });
      h.sim.actions.inject('CAMERA_LOSS', { cameraId: 'VIDEO-02' });
      h.run(29_000);
      expect(h.state().session).toMatchObject({ state: 'RECORDING', captureDurable: false });
      expect(h.integrityRows()).toEqual([]);
      h.run(10_000);
      expect(h.state().session).toMatchObject({ state: 'FAULT', captureDurable: false, startedAt: null });
      expect(h.integrityRows()).toEqual([]);
    });

    it('CONTROL - a start that happened has the same rows, each at its own time, whatever the connecting time was', () => {
      const rowsAfter = (captureConnectMs: number): string[] => {
        const h = bed({ captureConnectMs });
        h.armed();
        h.sim.actions.startRecording();
        h.run(60_000);
        expect(h.state().session?.state).toBe('RECORDING');
        expect(h.state().session).not.toHaveProperty('captureDurable');
        return h.integrityRows();
      };
      const immediate = rowsAfter(0);
      expect(immediate.length).toBeGreaterThan(2);
      expect(rowsAfter(30_000)).toEqual(immediate);
      expect(rowsAfter(1_000)).toEqual(immediate);
    });
  });

  describe('a refused start carries its reason to the client (`503 NOT_READY`, `details.reason`)', () => {
    it('the rebuilt error holds the Core\'s reason code; the reader names the two session-key refusals and nothing else', async () => {
      const { START_REFUSED_SESSION_KEY_EXAMPLE } = await import('../src/api');
      const { START_REFUSED_REASONS, startRefusedReasonOf } = await import('../src/sim');
      const { LiveTransportError } = await import('../src/live');
      const { rebuildRefusal } = await import('../src/live/source/rebuild-error');
      const failure = (details: Record<string, unknown> | undefined) =>
        ({
          ok: false,
          status: START_REFUSED_SESSION_KEY_EXAMPLE.status,
          kind: 'NOT_READY',
          transport: 'CORE_OFFLINE',
          retryAfterSeconds: null,
          requestId: 'req-1',
          error: { code: START_REFUSED_SESSION_KEY_EXAMPLE.code, message: 'refused', ...(details === undefined ? {} : { details }) },
        }) as unknown as Parameters<typeof rebuildRefusal>[0];
      const context = { action: 'startRecording', operationId: 'startSession', entity: null, sessionState: 'ARMED' };

      for (const reason of START_REFUSED_REASONS) {
        const error = rebuildRefusal(failure({ reason }), context);
        expect(error).toBeInstanceOf(LiveTransportError);
        expect((error as InstanceType<typeof LiveTransportError>).detailReason).toBe(reason);
        expect(startRefusedReasonOf(error)).toBe(reason);
        expect(en.common.startRefused[reason]).toMatch(/^This session cannot be started: .*Nothing was recorded\./);
      }
      expect(startRefusedReasonOf(rebuildRefusal(failure(START_REFUSED_SESSION_KEY_EXAMPLE.details), context))).toBe('SESSION_KEY_NOT_OF_SESSION');
      // NEGATIVE CONTROLS: a Core that is starting, another reason, a value that is no code.
      expect(startRefusedReasonOf(rebuildRefusal(failure(undefined), context))).toBeNull();
      expect(startRefusedReasonOf(rebuildRefusal(failure({ reason: 'CAPTURE_HELPERS_LEFT' }), context))).toBeNull();
      expect((rebuildRefusal(failure({ reason: 'not a code; DROP' }), context) as InstanceType<typeof LiveTransportError>).detailReason).toBeNull();
    });

    it('6. the shared development-source sentence is the ruled wording', () => {
      expect(en.common.captureConnect.noPasswordNeeded).toBe('A development source can be tested without a password. If the test asks for one, turn on "Enter a user name and password".');
    });
  });
});

// Integration pass C1 (decision D120), seam 2: `captureDurable` on the session payload (decisions
// D84, D91 R-1 option A). Every acceptance has its refusal beside it.
describe('the contract member of the connecting part', () => {
  const { harness } = micIdBed;

  describe('captureDurable on the session payload (pass C1, seam 2)', () => {
    it('both session schemas take the optional boolean and nothing else under that name', () => {
      const h = harness('recording');
      const session = h.state().session;
      if (session === null) throw new Error('the recording scenario holds no session');
      // A durable simulated recording carries no member (pass D10: `false` only while its cameras connect), and absent reads as durable.
      expect('captureDurable' in session).toBe(false);
      expect(captureDurableOf(session)).toBe(true);
      expect(ActiveSessionSchema.safeParse(session).success).toBe(true);
      for (const durable of [true, false]) expect(ActiveSessionSchema.safeParse({ ...session, captureDurable: durable }).success, String(durable)).toBe(true);
      for (const bad of ['true', 1, null]) expect(ActiveSessionSchema.safeParse({ ...session, captureDurable: bad }).success, String(bad)).toBe(false);
      // CONTROL: the slice is strict - a neighbouring unknown member is still refused.
      expect(ActiveSessionSchema.safeParse({ ...session, captureDurableX: true }).success).toBe(false);

      const answer = h.sim.request({ method: 'GET', path: '/api/v1/session/current' });
      expect(answer.status).toBe(200);
      const resource = (answer.body as { session: object }).session;
      expect(SessionResourceSchema.safeParse(resource).success).toBe(true);
      expect('captureDurable' in resource).toBe(false);
      for (const durable of [true, false]) expect(SessionResourceSchema.safeParse({ ...resource, captureDurable: durable }).success).toBe(true);
      for (const bad of ['no', 1, null]) expect(SessionResourceSchema.safeParse({ ...resource, captureDurable: bad }).success, String(bad)).toBe(false);
    });

    it('the seam: the supervisor\'s report becomes the member; a repeated report and a report outside RECORDING change nothing', () => {
      const h = harness('recording');
      const recording = h.state();
      const connecting = captureDurableTransition(recording, false);
      expect(connecting.session?.captureDurable).toBe(false);
      expect(connecting.session?.state).toBe('RECORDING');
      expect(captureDurableOf(connecting.session)).toBe(false);
      expect(captureDurableTransition(connecting, false)).toBe(connecting);
      const durable = captureDurableTransition(connecting, true);
      expect(durable.session?.captureDurable).toBe(true);
      expect(captureDurableOf(durable.session)).toBe(true);
      expect(captureDurableTransition(durable, true)).toBe(durable);
      // Nothing but the one member moved: no audit row, no event, no other slice.
      const { session: _before, ...restBefore } = recording;
      const { session: after, ...restAfter } = durable;
      expect(restAfter).toEqual(restBefore);
      expect({ ...after, captureDurable: undefined }).toEqual({ ...recording.session, captureDurable: undefined });
      expect(ActiveSessionSchema.safeParse(after).success).toBe(true);
      // No session, or a session that does not record: the same state.
      const idle = harness('idle').state();
      expect(captureDurableTransition(idle, false)).toBe(idle);
      expect(captureDurableOf(null)).toBe(true);
      expect(captureDurableOf(undefined)).toBe(true);
    });
  });
});

// Task 4 row 163 (WP-13a; decisions C18 (1), (2), C21 (6), C25; requirement AD-04 (2); names
// register of row 161, section 5.3; sites C1, C2, C7 of row 27): the start on an INCOMPLETE
// selector. A Core in its own capture (`capture: 'external'`) refuses it while any of the four
// slots holds no source - the STANDBY too; Simulated mode on the same selector starts as before.
// The audio pair is read by role with no stand-in. The session is armed on the seeded selector and
// the lines are then put into the state by hand (the selector is locked while a session is open).
describe('the start on an incomplete selector (task 4 row 163)', () => {
  const { CATEGORIES, SEEDED_CATEGORY, emptySlotsOf, selectorPatch, cam, mic } = selectorBed;
  const armedOn = (capture: 'simulated' | 'external', lines: selectorBed.SelectorLines) => {
    const h = ownCaptureBed.bed({ capture });
    h.armed();
    expect(h.state().session?.state, capture).toBe('ARMED');
    h.sim.store.setState(selectorPatch(h.state(), lines));
    return h;
  };
  const start = (h: ReturnType<typeof armedOn>): unknown => {
    try {
      h.sim.actions.startRecording();
      return null;
    } catch (error) {
      return error;
    }
  };
  const inputsOf = (lines: selectorBed.SelectorLines): string[] => lines.mics.map((line) => line.inputId);
  const roleInput = (lines: selectorBed.SelectorLines, role: 'PRIMARY' | 'STANDBY'): string | undefined => lines.mics.find((line) => line.role === role)?.inputId;
  /** Each selector that lacks exactly ONE slot of the seeded four. */
  const seeded = CATEGORIES[SEEDED_CATEGORY]!;
  const ONE_SLOT_MISSING: Record<string, selectorBed.SelectorLines> = {
    'only VIDEO-01 unassigned': { cameras: seeded.cameras.filter((line) => line.trackId !== 'VIDEO-01'), mics: seeded.mics },
    'only VIDEO-02 unassigned': { cameras: seeded.cameras.filter((line) => line.trackId !== 'VIDEO-02'), mics: seeded.mics },
    'only PRIMARY unassigned': { cameras: seeded.cameras, mics: seeded.mics.filter((line) => line.role !== 'PRIMARY') },
    'only STANDBY unassigned (C25: it blocks too)': { cameras: seeded.cameras, mics: seeded.mics.filter((line) => line.role !== 'STANDBY') },
  };

  it.each(Object.entries({ ...CATEGORIES, ...ONE_SLOT_MISSING }))('REAL capture, %s: refused while a slot is unassigned, started when all four are assigned', (name, lines) => {
    const h = armedOn('external', lines);
    const before = h.state();
    const refused = start(h);
    if (emptySlotsOf(lines).length > 0) {
      expect(refused, name).toBeInstanceOf(SimTransitionError);
      // The 409 form: a refusal of the state with the reason of the register.
      expect(refused, name).toMatchObject({ code: 'ILLEGAL_STATE', from: 'ARMED', event: 'startRecording', reason: CAPTURE_SOURCE_NOT_ASSIGNED_REASON });
      // Nothing moved: no state change, no audit row - and the refused state names no input at all,
      // so none the selector does not hold (it was refused BEFORE the audio pair was read).
      expect(h.state(), name).toBe(before);
      expect(h.state().session?.state, name).toBe('ARMED');
      expect(h.state().session?.audioSource ?? null, name).toBeNull();
      expect(h.state().session?.captureConfig ?? null, name).toBeNull();
    } else {
      expect(refused, name).toBeNull();
      expect(h.state().session?.state, name).toBe('RECORDING');
      expect(h.state().session?.audioSource, name).toMatchObject({ activeInputId: roleInput(lines, 'PRIMARY'), standbyInputId: roleInput(lines, 'STANDBY') });
    }
  });

  it.each(Object.entries({ ...CATEGORIES, ...ONE_SLOT_MISSING }))('SIMULATED, %s: the start is accepted as before (C21 (6)), and the session names no input the selector does not hold', (name, lines) => {
    const h = armedOn('simulated', lines);
    expect(start(h), name).toBeNull();
    const session = h.state().session;
    expect(session, name).toMatchObject({ state: 'RECORDING', captureDurable: false });
    expect(h.state().audit.rows.filter((row) => row.type === 'RECORDING_STARTED' && row.sessionId === session?.id), name).toHaveLength(1);
    // The snapshot is the selector as it stood: the lines given, nothing added.
    expect(session?.captureConfig?.cameras.map((line) => [line.trackId, line.deviceId]), name).toEqual(lines.cameras.map((line) => [line.trackId, line.deviceId]));
    expect(session?.captureConfig?.mics.map((line) => [line.inputId, line.role]), name).toEqual(lines.mics.map((line) => [line.inputId, line.role]));
    const primary = roleInput(lines, 'PRIMARY');
    const standby = roleInput(lines, 'STANDBY');
    if (primary !== undefined && standby !== undefined) {
      expect(session?.audioSource, name).toEqual({ sessionId: session?.id, activeInputId: primary, standbyInputId: standby, switchedAt: null, intervalFromMs: 0 });
      expect(h.state().audio.activeInputId, name).toBe(primary);
    } else {
      // A role without a line: the session states NO pair. Before this row it stated `MIC-01` /
      // `MIC-02` for an empty selector and made a lone STANDBY line the ACTIVE input.
      expect(session?.audioSource ?? null, name).toBeNull();
      expect(session !== null && 'audioSource' in session && session.audioSource !== null && session.audioSource !== undefined, name).toBe(false);
    }
    for (const named of [session?.audioSource?.activeInputId, session?.audioSource?.standbyInputId]) if (named !== undefined) expect(inputsOf(lines), name).toContain(named);
    expect(ActiveSessionSchema.safeParse(session).success, name).toBe(true);

    // THE DECISION OF THE CONNECTING START (site C7): with a camera line it turns durable as before;
    // with ZERO camera lines it never does - it ends as the existing "no camera connected" failure.
    h.run(CAPTURE_CONNECT_MS);
    if (lines.cameras.length === 0) {
      expect(h.state().session, name).toMatchObject({ state: 'FAULT', captureDurable: false, startedAt: null, bytesWritten: 0, fault: { kind: 'CAPTURE_FAULT', fromState: 'RECORDING' } });
      expect(h.state().session?.timeline.at(-1), name).toMatchObject({ kind: 'FAULT', params: { reason: NO_CAMERA_CONNECTED_REASON, evidenceFiles: 0, durable: false } });
    } else {
      expect(h.state().session?.state, name).toBe('RECORDING');
      expect(captureDurableOf(h.state().session), name).toBe(true);
    }
  });

  it('`audioSourceAtStart` reads the pair by role with no stand-in: a role without a line gives no pair (AD-04 (2))', () => {
    const state = ownCaptureBed.bed().state();
    const on = (lines: selectorBed.SelectorLines): SimState => ({ ...state, ...selectorPatch(state, lines) });
    const pair = (lines: selectorBed.SelectorLines) => audioSourceAtStart(on(lines), 'SES-20261001-0001');
    // Complete, in both arrangements: by role, whichever line is first.
    expect(pair({ cameras: [], mics: [mic('MIC-01', 'PRIMARY'), mic('MIC-02', 'STANDBY')] })).toEqual({ sessionId: 'SES-20261001-0001', activeInputId: 'MIC-01', standbyInputId: 'MIC-02', switchedAt: null, intervalFromMs: 0 });
    expect(pair({ cameras: [], mics: [mic('MIC-02', 'STANDBY'), mic('MIC-03', 'PRIMARY')] })).toMatchObject({ activeInputId: 'MIC-03', standbyInputId: 'MIC-02' });
    // No line: no pair - not `MIC-01` / `MIC-02`.
    expect(pair({ cameras: [cam('VIDEO-01', 'CAM-01')], mics: [] })).toBeNull();
    // A lone STANDBY line is never the active input; a lone PRIMARY has no standby invented beside it.
    expect(pair({ cameras: [], mics: [mic('MIC-04', 'STANDBY')] })).toBeNull();
    expect(pair({ cameras: [], mics: [mic('MIC-03', 'PRIMARY')] })).toBeNull();
    // Two lines of ONE role are no pair either (a hand-built state): the other role has no line.
    expect(pair({ cameras: [], mics: [mic('MIC-01', 'STANDBY'), mic('MIC-02', 'STANDBY')] })).toBeNull();
  });

  it('a switch of the audio source needs an input to switch FROM: a session without a pair and without an active line refuses it, writing nothing', () => {
    // Simulated, a lone STANDBY line (category 3): the session started and states no pair.
    const h = armedOn('simulated', CATEGORIES['3. some U, the rest P (VIDEO-01 and a lone STANDBY held)']!);
    expect(start(h)).toBeNull();
    const before = h.state();
    expect(before.session?.audioSource ?? null).toBeNull();
    // The meters' active input (`MIC-01`, kept behind the seam `AudioSliceInState`) is no line of
    // this session: it is not an input to switch from, and it is not written as the new standby.
    expect(before.captureConfig.mics.map((line) => line.inputId)).toEqual(['MIC-04']);
    let refused: unknown = null;
    try {
      h.sim.actions.switchAudioSource('MIC-04');
    } catch (error) {
      refused = error;
    }
    expect(refused).toBeInstanceOf(SimTransitionError);
    expect(refused).toMatchObject({ code: 'ILLEGAL_STATE', event: 'switchAudioSource' });
    expect(h.state()).toBe(before);
    // The same with the meters holding NO active input (the state once the seam is out; PENDING-ROW-28-SEAM: the cast goes with it).
    const session = before.session;
    if (session === null) throw new Error('no session');
    const noActive = { ...before, audio: { ...before.audio, activeInputId: null } } as unknown as SimState;
    expect(() => applyAudioSourceSwitch(noActive, START, session, 'MIC-04', 1_000)).toThrow(SimTransitionError);
    // CONTROL: a session with its pair switches as before.
    const complete = armedOn('simulated', seeded);
    expect(start(complete)).toBeNull();
    complete.sim.actions.switchAudioSource('MIC-02');
    expect(complete.state().session?.audioSource).toMatchObject({ activeInputId: 'MIC-02', standbyInputId: 'MIC-01' });
  });
});
