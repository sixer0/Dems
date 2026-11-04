// The two INTERNAL capture actions of the simulator (task 3 blueprint row 58; register SH-18 /
// CS-04; `capture-spec §B.1`, §E.1; contract C3 §6 slices 29/30 and the meters slice SH-17):
// `applyCaptureTelemetry` and `raiseCaptureWarning`.
//
// What must hold: a telemetry frame that changes nothing the Core stores sets nothing in the store;
// the levels reach the meters through the audio subsystem only; a warning is the fault of its kind,
// once, and never moves the active mic input (OD-11).
import { describe, expect, it } from 'vitest';
import {
  AUDIO_FLOOR_DBFS,
  CAMERA_STREAM_FAULT_REASONS,
  cameraStreamFaultActive,
  clearCaptureFaultsTransition,
  CAPTURE_LEVEL_HOLD_MS,
  SimNotFoundError,
  applyCaptureTelemetryTransition,
  captureTelemetryChangesState,
  captureTelemetryIgnored,
  createManualClock,
  createSim,
  type CaptureTelemetryInput,
  type ScenarioName,
  type SimState,
  CaptureAdvisoryReason,
  activeCaptureNotice,
  DEMO_OPERATOR_PASSWORD,
  OPERATORS,
  CAPTURE_ADVISORY_DEVICE_KIND,
  CAPTURE_ADVISORY_REASONS,
  CAPTURE_ADVISORY_SEVERITY,
  CAPTURE_REASON_SEVERITY,
  CaptureNoticeReason,
  cameraClockOffsetSentence,
  captureFaultSentence,
  isCaptureFaultReason,
} from '../src/sim';
import { CAPTURE_HELPERS_LEFT_REASON, CAPTURE_NOT_DURABLE_REASON, REPLICATED_SLICE_SCHEMAS, findCoreApiOperation } from '../src/api';
import * as micPairBed from './support/mic-pair-bed';

const START = Date.UTC(2026, 9, 1, 3, 0, 0);

function harness(scenario: ScenarioName = 'recording', capture: 'simulated' | 'external' = 'simulated') {
  const clock = createManualClock(START);
  const sim = createSim({ clock, storage: null, authStorage: null, scenario, capture });
  let sets = 0;
  sim.store.subscribe(() => {
    sets += 1;
  });
  const run = (ms: number) => {
    for (let elapsed = 0; elapsed < ms; elapsed += 50) {
      clock.advance(50);
      sim.tick();
    }
  };
  return { sim, clock, run, state: () => sim.store.getState(), sets: () => sets };
}

const frame = (patch: Partial<CaptureTelemetryInput> = {}): CaptureTelemetryInput => ({ levels: [], ingest: [], fragments: [], ...patch });

/** Everything of the state except the two slices telemetry may write. */
function rest(state: SimState): Omit<SimState, 'captureDevices' | 'captureConfig'> {
  const { captureDevices: _devices, captureConfig: _config, ...others } = state;
  return others;
}

describe('applyCaptureTelemetry: what is stored (slices 29 and 30)', () => {
  it('a frame that reports what the state holds sets nothing: the same state object, no store write, however often it comes', () => {
    const h = harness();
    const before = h.state();
    const sets = h.sets();
    const same = frame({
      levels: [{ role: 'PRIMARY', dbfs: -20, clipped: false }, { role: 'STANDBY', dbfs: -40, clipped: false }],
      ingest: [{ deviceId: 'CAM-01', state: 'CONNECTED' }, { deviceId: 'CAM-02', state: 'CONNECTED' }],
      fragments: [{ deviceId: 'CAM-01', count: 12, bytes: 9_000_000 }, { deviceId: 'CAM-02', count: 12, bytes: 8_500_000 }],
    });
    expect(captureTelemetryChangesState(before, same)).toBe(false);
    for (let index = 0; index < 20; index += 1) h.sim.actions.applyCaptureTelemetry({ ...same, fragments: [{ deviceId: 'CAM-01', count: 12 + index, bytes: 9_000_000 + index }] });
    expect(h.state()).toBe(before);
    expect(h.sets()).toBe(sets);

    // Control: the same call with an ingest state the state does NOT hold is a store write.
    h.sim.actions.applyCaptureTelemetry(frame({ ingest: [{ deviceId: 'CAM-01', state: 'WAITING' }] }));
    expect(h.state()).not.toBe(before);
    expect(h.sets()).toBe(sets + 1);
  });

  it('WAITING marks that camera lost in both slices, CONNECTED brings it back, and nothing else moves', () => {
    const h = harness();
    const before = h.state();
    h.sim.actions.applyCaptureTelemetry(frame({ ingest: [{ deviceId: 'CAM-02', state: 'WAITING' }] }));
    const lost = h.state();
    // D60 (2026-11-04): the seeded registry and selector carry FOUR cameras; one WAITING frame moves only CAM-02.
    expect(lost.captureDevices.devices.map(({ id, online, streamState }) => ({ id, online, streamState }))).toEqual([
      { id: 'CAM-01', online: true, streamState: 'LIVE' },
      { id: 'CAM-02', online: false, streamState: 'LOST' },
      { id: 'CAM-03', online: true, streamState: 'LIVE' },
      { id: 'CAM-04', online: true, streamState: 'LIVE' },
      { id: 'MIC-01', online: true, streamState: null },
      { id: 'MIC-02', online: true, streamState: null },
      { id: 'POE-SWITCH', online: true, streamState: null },
    ]);
    expect(lost.captureConfig.cameras.map(({ deviceId, online, streamState }) => ({ deviceId, online, streamState }))).toEqual([
      { deviceId: 'CAM-01', online: true, streamState: 'LIVE' },
      { deviceId: 'CAM-02', online: false, streamState: 'LOST' },
      { deviceId: 'CAM-03', online: true, streamState: 'LIVE' },
      { deviceId: 'CAM-04', online: true, streamState: 'LIVE' },
    ]);
    // Telemetry is not an edit of the selector, and it is no audit matter.
    expect(lost.captureConfig.updatedAt).toBe(before.captureConfig.updatedAt);
    expect(lost.captureConfig.mics).toBe(before.captureConfig.mics);
    expect(rest(lost)).toEqual(rest(before));
    expect(lost.audit).toBe(before.audit);
    expect(lost.events).toBe(before.events);
    expect(lost.alerts).toBe(before.alerts);
    expect(lost.faults).toBe(before.faults);

    // The same frame again: nothing.
    h.sim.actions.applyCaptureTelemetry(frame({ ingest: [{ deviceId: 'CAM-02', state: 'WAITING' }] }));
    expect(h.state()).toBe(lost);

    h.sim.actions.applyCaptureTelemetry(frame({ ingest: [{ deviceId: 'CAM-02', state: 'CONNECTED' }] }));
    expect(h.state().captureDevices).toEqual(before.captureDevices);
    expect(h.state().captureConfig).toEqual(before.captureConfig);
  });

  it('ENDED is a loss only under a running recording; an ingest that closes after the stop changes nothing', () => {
    const recording = harness('recording');
    expect(recording.state().session?.state).toBe('RECORDING');
    recording.sim.actions.applyCaptureTelemetry(frame({ ingest: [{ deviceId: 'CAM-01', state: 'ENDED' }] }));
    expect(recording.state().captureDevices.devices[0]).toMatchObject({ id: 'CAM-01', online: false, streamState: 'LOST' });

    const idle = harness('idle');
    const before = idle.state();
    expect(before.session).toBeNull();
    idle.sim.actions.applyCaptureTelemetry(frame({ ingest: [{ deviceId: 'CAM-01', state: 'ENDED' }, { deviceId: 'CAM-02', state: 'ENDED' }] }));
    expect(idle.state()).toBe(before);
    // Control: the idle Core does take a WAITING ingest, so the line above is the ENDED rule and not a dead action.
    idle.sim.actions.applyCaptureTelemetry(frame({ ingest: [{ deviceId: 'CAM-01', state: 'WAITING' }] }));
    expect(idle.state().captureDevices.devices[0]).toMatchObject({ id: 'CAM-01', streamState: 'LOST' });
  });

  it('an ID that names no camera is ignored: an unknown device, a mic, the PoE switch', () => {
    const h = harness();
    const before = h.state();
    h.sim.actions.applyCaptureTelemetry(
      frame({ ingest: [{ deviceId: 'CAM-99', state: 'WAITING' }, { deviceId: 'MIC-01', state: 'WAITING' }, { deviceId: 'POE-SWITCH', state: 'WAITING' }] }),
    );
    expect(h.state()).toBe(before);
  });

  it('the transition is pure: it returns its argument when nothing changes and never mutates it', () => {
    const state = harness().state();
    const frozen = JSON.stringify({ devices: state.captureDevices, config: state.captureConfig });
    expect(applyCaptureTelemetryTransition(state, frame({ ingest: [{ deviceId: 'CAM-01', state: 'CONNECTED' }] }))).toBe(state);
    const next = applyCaptureTelemetryTransition(state, frame({ ingest: [{ deviceId: 'CAM-01', state: 'WAITING' }] }));
    expect(next).not.toBe(state);
    expect(JSON.stringify({ devices: state.captureDevices, config: state.captureConfig })).toBe(frozen);
  });
});

describe('applyCaptureTelemetry: the levels reach the meters and nothing else (SH-17)', () => {
  it('the next 20 Hz frame of each input shows the measured level, by the role the input holds', () => {
    const h = harness();
    h.run(200);
    // Control: what the generator shows by itself is never these two values.
    expect(h.state().audio.inputs['MIC-01']!.dbfs).not.toBe(-6.25);
    const held = h.state();

    h.sim.actions.applyCaptureTelemetry(frame({ levels: [{ role: 'PRIMARY', dbfs: -6.25, clipped: false }, { role: 'STANDBY', dbfs: -1.5, clipped: false }] }));
    // The action itself wrote nothing, not even the meters: the audio subsystem does, on its tick.
    expect(h.state()).toBe(held);
    h.run(50);
    expect(h.state().audio.inputs['MIC-01']!).toMatchObject({ dbfs: -6.25, noSignal: false, at: h.clock.now() });
    expect(h.state().audio.inputs['MIC-02']!).toMatchObject({ dbfs: -1.5, noSignal: false });
    expect(h.state().audio.activeInputId).toBe('MIC-01');
  });

  it('no samples (null) reads NO SIGNAL at the floor; a clipped frame latches CLIP on that mic', () => {
    const h = harness();
    h.sim.actions.applyCaptureTelemetry(frame({ levels: [{ role: 'PRIMARY', dbfs: null, clipped: false }, { role: 'STANDBY', dbfs: -9, clipped: true }] }));
    h.run(50);
    expect(h.state().audio.inputs['MIC-01']!).toMatchObject({ dbfs: AUDIO_FLOOR_DBFS, peak: AUDIO_FLOOR_DBFS, noSignal: true });
    expect(h.state().audio.inputs['MIC-02']!).toMatchObject({ dbfs: -9, clip: true, noSignal: false });
    expect(h.state().mics.find((mic) => mic.id === 'AUDIO-02')?.clipLatched).toBe(true);
    expect(h.state().mics.find((mic) => mic.id === 'AUDIO-01')?.clipLatched).toBe(false);
    // The level alone never raises a fault and never switches the input.
    expect(h.state().faults.active.filter((fault) => fault.kind === 'MIC_SILENT' || fault.kind === 'MIC_NO_SIGNAL')).toEqual([]);
    expect(h.state().audio.activeInputId).toBe('MIC-01');
  });

  it('a level is shown while the worker keeps sending; after CAPTURE_LEVEL_HOLD_MS without a frame the meter leaves it', () => {
    const h = harness();
    h.sim.actions.applyCaptureTelemetry(frame({ levels: [{ role: 'PRIMARY', dbfs: null, clipped: false }] }));
    h.run(CAPTURE_LEVEL_HOLD_MS);
    expect(h.state().audio.inputs['MIC-01']!.noSignal).toBe(true);
    h.run(100);
    expect(h.state().audio.inputs['MIC-01']!.noSignal).toBe(false);
  });

  it('a role that no mic row holds is ignored', () => {
    const h = harness();
    h.sim.actions.applyCaptureTelemetry(frame({ levels: [{ role: 'TERTIARY' as 'PRIMARY', dbfs: null, clipped: true }] }));
    h.run(50);
    expect(h.state().audio.inputs['MIC-01']!.noSignal).toBe(false);
    expect(h.state().audio.inputs['MIC-02']!.noSignal).toBe(false);
    expect(h.state().mics.every((mic) => !mic.clipLatched)).toBe(true);
  });
});

describe('raiseCaptureWarning: the fault of its kind, once, and never a switch (OD-11)', () => {
  it('MIC_SILENT for the PRIMARY role: one alert, one FAULT_RAISED audit row and event, on the channel of that input; the active input stays', () => {
    const h = harness();
    const before = h.state();
    h.sim.actions.raiseCaptureWarning({ code: 'MIC_SILENT', subject: 'PRIMARY' });
    const after = h.state();
    expect(after.faults.active.filter((fault) => fault.kind === 'MIC_SILENT')).toEqual([{ kind: 'MIC_SILENT', since: START, target: 'AUDIO-01' }]);
    expect(after.alerts.filter((alert) => alert.kind === 'MIC_SILENT')).toMatchObject([{ severity: 'WARNING', active: true, target: 'AUDIO-01' }]);
    expect(after.audit.total).toBe(before.audit.total + 1);
    expect(after.audit.rows.at(-1)).toMatchObject({ type: 'FAULT_RAISED', actorId: null, severity: 'WARNING', details: { kind: 'MIC_SILENT', target: 'AUDIO-01' } });
    expect(after.events.at(-1)).toMatchObject({ type: 'FAULT_RAISED', params: { kind: 'MIC_SILENT', target: 'AUDIO-01' } });
    // OD-11: a warning. The recording goes on with the input it had.
    expect(after.audio.activeInputId).toBe(before.audio.activeInputId);
    expect(after.session?.audioSource).toEqual(before.session?.audioSource);
    expect(after.session?.state).toBe('RECORDING');
  });

  it('the same warning while it is active writes nothing: the same state object; another subject is another warning', () => {
    const h = harness();
    h.sim.actions.raiseCaptureWarning({ code: 'MIC_SILENT', subject: 'PRIMARY' });
    const raised = h.state();
    const sets = h.sets();
    h.sim.actions.raiseCaptureWarning({ code: 'MIC_SILENT', subject: 'PRIMARY' });
    // The same input under its other names.
    h.sim.actions.raiseCaptureWarning({ code: 'MIC_SILENT', subject: 'MIC-01' });
    h.sim.actions.raiseCaptureWarning({ code: 'MIC_SILENT', subject: null });
    expect(h.state()).toBe(raised);
    expect(h.sets()).toBe(sets);

    // Control: the standby input is not the same warning.
    h.sim.actions.raiseCaptureWarning({ code: 'MIC_SILENT', subject: 'STANDBY' });
    expect(h.state().audit.total).toBe(raised.audit.total + 1);
    expect(h.state().faults.active.filter((fault) => fault.kind === 'MIC_SILENT').map((fault) => fault.target)).toEqual(['AUDIO-01', 'AUDIO-02']);

    // Cleared by the operator, it can be raised again.
    h.sim.actions.clearFault('MIC_SILENT', { channel: 'AUDIO-01' });
    const cleared = h.state().audit.total;
    h.sim.actions.raiseCaptureWarning({ code: 'MIC_SILENT', subject: 'PRIMARY' });
    expect(h.state().audit.total).toBe(cleared + 1);
  });

  it('CAPTURE_FAULT names its device, is critical as an alert, and does not move the session machine; once per device', () => {
    const h = harness();
    const before = h.state();
    h.sim.actions.raiseCaptureWarning({ code: 'CAPTURE_FAULT', subject: 'CAM-02' });
    const after = h.state();
    expect(after.faults.active.filter((fault) => fault.kind === 'CAPTURE_FAULT')).toEqual([{ kind: 'CAPTURE_FAULT', since: START, target: 'CAM-02' }]);
    expect(after.alerts.at(-1)).toMatchObject({ kind: 'CAPTURE_FAULT', severity: 'CRITICAL', active: true, target: 'CAM-02' });
    expect(after.audit.rows.at(-1)).toMatchObject({ type: 'FAULT_RAISED', actorId: null, deviceId: 'CAM-02', details: { kind: 'CAPTURE_FAULT', target: 'CAM-02' } });
    expect(after.session?.state).toBe('RECORDING');
    expect(after.audio.activeInputId).toBe(before.audio.activeInputId);

    h.sim.actions.raiseCaptureWarning({ code: 'CAPTURE_FAULT', subject: 'CAM-02' });
    expect(h.state()).toBe(after);
    // The supervisor's own warning has no subject: the capture as a whole, a warning of its own.
    h.sim.actions.raiseCaptureWarning({ code: 'CAPTURE_FAULT', subject: null });
    h.sim.actions.raiseCaptureWarning({ code: 'CAPTURE_FAULT', subject: null });
    // A mic role is recorded against the device of that mic.
    h.sim.actions.raiseCaptureWarning({ code: 'CAPTURE_FAULT', subject: 'STANDBY' });
    expect(h.state().faults.active.filter((fault) => fault.kind === 'CAPTURE_FAULT').map((fault) => fault.target)).toEqual(['CAM-02', null, 'MIC-02']);
    expect(h.state().audit.total).toBe(before.audit.total + 3);
  });

  it('a subject the Core does not know, or a code outside the two, throws and stores nothing', () => {
    const h = harness();
    const before = h.state();
    expect(() => h.sim.actions.raiseCaptureWarning({ code: 'MIC_SILENT', subject: 'CAM-01' })).toThrow(SimNotFoundError);
    expect(() => h.sim.actions.raiseCaptureWarning({ code: 'MIC_SILENT', subject: 'MIC-09' })).toThrow(SimNotFoundError);
    expect(() => h.sim.actions.raiseCaptureWarning({ code: 'CAPTURE_FAULT', subject: 'CAM-99' })).toThrow(SimNotFoundError);
    expect(() => h.sim.actions.raiseCaptureWarning({ code: 'CAMERA_LOSS' as 'CAPTURE_FAULT', subject: 'CAM-01' })).toThrow(SimNotFoundError);
    expect(h.state()).toBe(before);
  });
});

describe('clearCaptureWarning: the condition is over, and the next episode is a new fault (decision D72, A-2)', () => {
  it('clears exactly that fault as clearFault does: the alert resolved, one FAULT_CLEARED row; cleared again it writes nothing', () => {
    const h = harness();
    h.sim.actions.raiseCaptureWarning({ code: 'MIC_SILENT', subject: 'MIC-01' });
    h.sim.actions.raiseCaptureWarning({ code: 'CAPTURE_FAULT', subject: 'CAM-02' });
    const raised = h.state();
    h.clock.advance(3_000);

    h.sim.actions.clearCaptureWarning({ code: 'MIC_SILENT', subject: 'PRIMARY' });
    const cleared = h.state();
    expect(cleared.faults.active.map((fault) => `${fault.kind}@${fault.target}`).filter((entry) => /MIC_SILENT|CAPTURE_FAULT/.test(entry))).toEqual(['CAPTURE_FAULT@CAM-02']);
    expect(cleared.alerts.filter((alert) => alert.kind === 'MIC_SILENT')).toMatchObject([{ active: false, resolvedAt: START + 3_000, target: 'AUDIO-01' }]);
    expect(cleared.alerts.filter((alert) => alert.kind === 'CAPTURE_FAULT')).toMatchObject([{ active: true }]);
    expect(cleared.audit.total).toBe(raised.audit.total + 1);
    expect(cleared.audit.rows.at(-1)).toMatchObject({ type: 'FAULT_CLEARED', actorId: null, details: { kind: 'MIC_SILENT', target: 'AUDIO-01' } });
    expect(cleared.events.at(-1)).toMatchObject({ type: 'FAULT_CLEARED', params: { kind: 'MIC_SILENT', target: 'AUDIO-01' } });
    expect(cleared.audio.activeInputId).toBe(raised.audio.activeInputId);

    // Not active any more: nothing is written, under any name of that input.
    const sets = h.sets();
    h.sim.actions.clearCaptureWarning({ code: 'MIC_SILENT', subject: 'PRIMARY' });
    h.sim.actions.clearCaptureWarning({ code: 'MIC_SILENT', subject: 'MIC-01' });
    h.sim.actions.clearCaptureWarning({ code: 'MIC_SILENT', subject: 'STANDBY' });
    h.sim.actions.clearCaptureWarning({ code: 'CAPTURE_FAULT', subject: 'CAM-01' });
    h.sim.actions.clearCaptureWarning({ code: 'CAPTURE_FAULT', subject: null });
    expect(h.state()).toBe(cleared);
    expect(h.sets()).toBe(sets);

    h.sim.actions.clearCaptureWarning({ code: 'CAPTURE_FAULT', subject: 'CAM-02' });
    expect(h.state().faults.active.filter((fault) => fault.kind === 'CAPTURE_FAULT')).toEqual([]);
    expect(h.state().audit.rows.at(-1)).toMatchObject({ type: 'FAULT_CLEARED', details: { kind: 'CAPTURE_FAULT', target: 'CAM-02' } });
  });

  it('after a clear the same warning is a NEW fault: a second audit row and a second alert (the second episode is recorded)', () => {
    const h = harness();
    const start = h.state().audit.total;
    for (const subject of ['PRIMARY', null] as const) {
      const code = subject === null ? 'CAPTURE_FAULT' : 'MIC_SILENT';
      const before = h.state().audit.total;
      h.sim.actions.raiseCaptureWarning({ code, subject });
      h.clock.advance(5_000);
      h.sim.actions.clearCaptureWarning({ code, subject });
      h.clock.advance(5_000);
      h.sim.actions.raiseCaptureWarning({ code, subject });
      const rows = h.state().audit.rows.slice(before - h.state().audit.total);
      expect(rows.map((row) => row.type)).toEqual(['FAULT_RAISED', 'FAULT_CLEARED', 'FAULT_RAISED']);
      expect(rows[2]?.id).not.toBe(rows[0]?.id);
      const alerts = h.state().alerts.filter((alert) => alert.kind === code);
      expect(alerts.map((alert) => alert.active)).toEqual([false, true]);
      expect(alerts[1]?.id).not.toBe(alerts[0]?.id);
      expect(alerts[1]?.at).toBe(alerts[0]!.at + 10_000);
    }
    expect(h.state().audit.total).toBe(start + 6);
  });

  it('MIC_SILENT cleared with no subject clears every MIC_SILENT, also the one raised before the operator switched the input', () => {
    const h = harness();
    h.sim.actions.raiseCaptureWarning({ code: 'MIC_SILENT', subject: null });
    expect(h.state().faults.active.filter((fault) => fault.kind === 'MIC_SILENT').map((fault) => fault.target)).toEqual(['AUDIO-01']);
    // The operator switches (never the Core): the active input is now MIC-02.
    h.sim.store.setState({ audio: { ...h.state().audio, activeInputId: 'MIC-02' } });
    h.sim.actions.clearCaptureWarning({ code: 'MIC_SILENT', subject: null });
    expect(h.state().faults.active.filter((fault) => fault.kind === 'MIC_SILENT')).toEqual([]);
    expect(h.state().audio.activeInputId).toBe('MIC-02');
  });

  it('refuses what raise refuses: a track ID is not a capture device, and nothing is stored', () => {
    const h = harness();
    h.sim.actions.raiseCaptureWarning({ code: 'CAPTURE_FAULT', subject: 'CAM-02' });
    const before = h.state();
    for (const subject of ['VIDEO-02', 'CAM-99']) {
      expect(() => h.sim.actions.clearCaptureWarning({ code: 'CAPTURE_FAULT', subject })).toThrow(SimNotFoundError);
      expect(() => h.sim.actions.raiseCaptureWarning({ code: 'CAPTURE_FAULT', subject })).toThrow(SimNotFoundError);
    }
    expect(() => h.sim.actions.clearCaptureWarning({ code: 'MIC_SILENT', subject: 'CAM-02' })).toThrow(SimNotFoundError);
    expect(() => h.sim.actions.clearCaptureWarning({ code: 'CAMERA_LOSS' as 'CAPTURE_FAULT', subject: null })).toThrow(SimNotFoundError);
    expect(h.state()).toBe(before);
  });
});

describe('what a frame names that the Core does not know (A-1): capture-device IDs only, and the ignored ones are named', () => {
  it('a frame in the Core vocabulary ignores nothing; track IDs, a mic as a camera and an unknown role are each named', () => {
    const state = harness().state();
    expect(
      captureTelemetryIgnored(state, {
        levels: [{ role: 'PRIMARY', dbfs: -20, clipped: false }, { role: 'STANDBY', dbfs: null, clipped: false }],
        ingest: [{ deviceId: 'CAM-01', state: 'CONNECTED' }, { deviceId: 'CAM-02', state: 'ENDED' }],
        fragments: [{ deviceId: 'CAM-01', count: 1, bytes: 1 }],
      }),
    ).toEqual([]);
    expect(
      captureTelemetryIgnored(state, {
        levels: [{ role: 'TERTIARY' as 'PRIMARY', dbfs: -20, clipped: false }],
        ingest: [{ deviceId: 'VIDEO-02', state: 'ENDED' }, { deviceId: 'MIC-01', state: 'WAITING' }],
        fragments: [{ deviceId: 'VIDEO-01', count: 1, bytes: 1 }],
      }),
    ).toEqual(['levels:TERTIARY', 'ingest:VIDEO-02', 'ingest:MIC-01', 'fragments:VIDEO-01']);
    // And VIDEO-02 really is ignored by the action: the camera of that track stays as it was.
    const h = harness();
    const before = h.state();
    h.sim.actions.applyCaptureTelemetry(frame({ ingest: [{ deviceId: 'VIDEO-02', state: 'ENDED' }] }));
    expect(h.state()).toBe(before);
    h.sim.actions.applyCaptureTelemetry(frame({ ingest: [{ deviceId: 'CAM-02', state: 'ENDED' }] }));
    expect(h.state().captureDevices.devices[1]).toMatchObject({ id: 'CAM-02', streamState: 'LOST' });
  });
});

describe('external levels (capture mode real; decision D72, A-4): nothing is generated, a missing feed reads NO SIGNAL', () => {
  const silent = { dbfs: AUDIO_FLOOR_DBFS, peak: AUDIO_FLOOR_DBFS, noSignal: true };

  it('before the first frame, after the last one and with no worker at all, both meters of a recording read NO SIGNAL', () => {
    const h = harness('recording', 'external');
    h.run(2_000);
    expect(h.state().audio.inputs['MIC-01']!).toMatchObject(silent);
    expect(h.state().audio.inputs['MIC-02']!).toMatchObject(silent);

    // The worker measures: the level is shown, for the input it measured only.
    h.sim.actions.applyCaptureTelemetry(frame({ levels: [{ role: 'PRIMARY', dbfs: -14.5, clipped: false }] }));
    h.run(50);
    expect(h.state().audio.inputs['MIC-01']!).toMatchObject({ dbfs: -14.5, noSignal: false });
    expect(h.state().audio.inputs['MIC-02']!).toMatchObject(silent);

    // The worker went down: when the last level is older than the hold, NO SIGNAL again. Never a generated level.
    h.run(CAPTURE_LEVEL_HOLD_MS + 100);
    expect(h.state().audio.inputs['MIC-01']!).toMatchObject(silent);
    h.run(30_000);
    expect(h.state().audio.inputs['MIC-01']!).toMatchObject(silent);
    expect(h.state().audio.inputs['MIC-02']!).toMatchObject(silent);
    // A missing feed is not a fault by itself and switches nothing (OD-11); the worker warns.
    expect(h.state().faults.active.filter((fault) => /MIC/.test(fault.kind))).toEqual([]);
    expect(h.state().audio.activeInputId).toBe('MIC-01');
  });

  it('no generated AUDIO_PEAK reaches the timeline of a real recording, and a test tone generates nothing', () => {
    const h = harness('recording', 'external');
    const peaks = () => (h.state().session?.timeline ?? []).filter((item) => item.kind === 'AUDIO_PEAK').length;
    const before = peaks();
    h.run(200_000);
    expect(peaks()).toBe(before);
    expect(h.state().audio.inputs['MIC-01']!).toMatchObject(silent);

    // Control: the simulated source does generate, levels and peaks, over the same time.
    const simulated = harness('recording', 'simulated');
    const simulatedBefore = (simulated.state().session?.timeline ?? []).filter((item) => item.kind === 'AUDIO_PEAK').length;
    simulated.run(200_000);
    expect(simulated.state().audio.inputs['MIC-01']!.noSignal).toBe(false);
    expect((simulated.state().session?.timeline ?? []).filter((item) => item.kind === 'AUDIO_PEAK').length).toBeGreaterThan(simulatedBefore);
  });

  it('the default is the simulated source: a simulator created without the option generates as before', () => {
    const clock = createManualClock(START);
    const sim = createSim({ clock, storage: null, authStorage: null, scenario: 'recording' });
    clock.advance(50);
    sim.tick();
    expect(sim.store.getState().audio.inputs['MIC-01']!.noSignal).toBe(false);
  });
});

// Integration pass D1b (decision D133), seam 13: the advisory notices of `raiseCaptureWarning` and
// the two documented refusal reasons (ruling D144).
describe('the advisory notices', () => {
  const { harness } = micPairBed;

  describe('advisory notices and two documented reasons (ruling D144; pass D1b, seam 13)', () => {
    it('the two reasons are documented on the answers they belong to', () => {
      expect([CAPTURE_NOT_DURABLE_REASON, CAPTURE_HELPERS_LEFT_REASON]).toEqual(['CAPTURE_NOT_DURABLE', 'CAPTURE_HELPERS_LEFT']);
      expect(findCoreApiOperation('stopSession')?.coreServerDescription).toContain('`409 INVALID_STATE` with `details.reason: CAPTURE_NOT_DURABLE`');
      expect(findCoreApiOperation('startSession')?.coreServerDescription).toContain('`503 NOT_READY` with `details.reason: CAPTURE_HELPERS_LEFT`');
    });

    it('each advisory notice is one SYSTEM alert of severity INFO on its own device: no fault, no audit row, no device state', () => {
      const h = harness('recording');
      const before = h.state();
      const cases = [
        ['KEYFRAME_INTERVAL_ABOVE_BOUND', 'CAM-02', 'CAMERA'],
        ['AV_OFFSET_NEAR_BOUND', 'CAM-02', 'CAMERA'],
        ['MIC_RATE_AT_LIMIT', 'MIC-01', 'MIC'],
        // Closing pass F-X (ruling D179 (a)): the fourth advisory notice.
        ['FRAGMENT_SIZE_BOUND_REACHED', 'CAM-01', 'CAMERA'],
        // Tidy pass F-Y (ruling D179): the fifth. Raised here WITHOUT its number: the alert then holds none (the CAMERA_CLOCK_OFFSET block below has the number).
        ['CAMERA_CLOCK_OFFSET', 'CAM-01', 'CAMERA'],
        // Task 4 row N2: the five of a microphone path that is not sample-continuous (5 -> 10). Raised here WITHOUT their numbers: the alert
        // then holds none. Three of them carry the level WARNING and are advice all the same (the block below has the numbers).
        // (On MIC-02, so that the count of the three conditions of MIC-01 below stays what it was.)
        ['MIC_PATH_NOT_SAMPLE_CONTINUOUS', 'MIC-02', 'MIC'],
        ['MIC_SAMPLES_SHORT_ABOVE_BOUND', 'MIC-02', 'MIC'],
        ['MIC_SAMPLES_SHORT_ABOVE_SESSION_LEVEL', 'MIC-02', 'MIC'],
        ['MIC_SILENCE_RUN_INSERTED', 'MIC-02', 'MIC'],
        ['STANDBY_ON_PRIMARY_DEVICE', 'MIC-02', 'MIC'],
      ] as const;
      expect(cases.map(([code]) => code).sort()).toEqual(Object.values(CaptureAdvisoryReason).sort());
      for (const [code, subject] of cases) h.sim.actions.raiseCaptureWarning({ code, subject });
      const raised = h.state();
      const alerts = raised.alerts.filter((alert) => alert.active && alert.kind === 'SYSTEM' && !before.alerts.includes(alert));
      expect(alerts.map((alert) => [alert.severity, alert.target, alert.params])).toEqual(
        cases.map(([code, subject, deviceKind]) => [CAPTURE_ADVISORY_SEVERITY[code], subject, { reason: code, deviceId: subject, deviceKind, sessionId: before.session?.id }]),
      );
      // The level: information for seven, WARNING for the three of a microphone that loses more audio than it should (row N2); the five earlier ones did not move.
      expect(cases.map(([code]) => CAPTURE_ADVISORY_SEVERITY[code])).toEqual(['INFO', 'INFO', 'INFO', 'INFO', 'INFO', 'INFO', 'WARNING', 'WARNING', 'WARNING', 'INFO']);
      expect(REPLICATED_SLICE_SCHEMAS.alerts.safeParse(raised.alerts).success).toBe(true);
      // Advice only: nothing else of the state moved.
      expect(raised.faults).toBe(before.faults);
      expect(raised.audit.rows).toHaveLength(before.audit.rows.length);
      expect(raised.captureDevices).toBe(before.captureDevices);
      expect(raised.session?.state).toBe('RECORDING');
      // A second raise while it is active writes nothing.
      h.sim.actions.raiseCaptureWarning({ code: 'MIC_RATE_AT_LIMIT', subject: 'MIC-01' });
      expect(h.state().alerts).toBe(raised.alerts);

      // THREE conditions of ONE microphone are three alerts: the rate notice, the silence fault, a capture fault.
      h.sim.actions.raiseCaptureWarning({ code: 'MIC_SILENT', subject: 'MIC-01' });
      h.sim.actions.raiseCaptureWarning({ code: 'CAPTURE_FAULT', subject: 'MIC-01' });
      const three = h.state().alerts.filter((alert) => alert.active && !before.alerts.includes(alert) && (alert.target === 'MIC-01' || alert.target === 'AUDIO-01'));
      expect(three).toHaveLength(3);
      expect(new Set(three.map((alert) => alert.id)).size).toBe(3);

      // A clear resolves exactly its own alert; the two faults of the microphone stay.
      h.sim.actions.clearCaptureWarning({ code: 'MIC_RATE_AT_LIMIT', subject: 'MIC-01' });
      expect(activeCaptureNotice(h.state(), 'MIC_RATE_AT_LIMIT', 'MIC-01')).toBeUndefined();
      expect(activeCaptureNotice(h.state(), 'AV_OFFSET_NEAR_BOUND', 'CAM-02')).toBeDefined();
      expect(h.state().faults.active.map((fault) => fault.kind).sort()).toEqual(['CAPTURE_FAULT', 'MIC_SILENT']);
    });

    it('a notice about a device of the other class, or about no device of the registry, is refused and writes nothing', () => {
      const h = harness('recording');
      const before = h.state().alerts;
      expect(() => h.sim.actions.raiseCaptureWarning({ code: 'MIC_RATE_AT_LIMIT', subject: 'CAM-01' })).toThrow();
      expect(() => h.sim.actions.raiseCaptureWarning({ code: 'KEYFRAME_INTERVAL_ABOVE_BOUND', subject: 'MIC-01' })).toThrow();
      expect(() => h.sim.actions.raiseCaptureWarning({ code: 'AV_OFFSET_NEAR_BOUND', subject: 'CAM-77' })).toThrow();
      expect(h.state().alerts).toBe(before);
    });
  });
});

// Tidy pass F-Y, item 4 (fix pass F-M3 decision 3; ruling D179 "a camera clock up to 2 s off is
// accepted and RECORDED, not corrected"): the fifth advisory notice, `CAMERA_CLOCK_OFFSET`. The
// capture side raises it when the offset the worker measured for a camera is above its threshold;
// the alert says the number and that the recording keeps the camera's own timeline.
describe('the advisory notices that carry a number or a state', () => {
  const START = 1_760_000_000_000;
  function recording() {
    const sim = createSim({ clock: createManualClock(START), storage: null, authStorage: null, scenario: 'recording' });
    const operator = OPERATORS.find((candidate) => candidate.role === 'TECHNICIAN');
    if (operator === undefined) throw new Error('no seeded TECHNICIAN');
    expect(sim.actions.signIn(operator.username, DEMO_OPERATOR_PASSWORD)).toMatchObject({ ok: true });
    return { sim, state: () => sim.store.getState() };
  }

  describe('the advisory notice CAMERA_CLOCK_OFFSET', () => {
    it('is an advisory reason of a camera, INFO, with its own sentence', () => {
      expect(CaptureAdvisoryReason.CAMERA_CLOCK_OFFSET).toBe('CAMERA_CLOCK_OFFSET');
      expect(CAPTURE_ADVISORY_DEVICE_KIND.CAMERA_CLOCK_OFFSET).toBe('CAMERA');
      expect(isCaptureFaultReason('CAMERA_CLOCK_OFFSET')).toBe(true);
      expect(CAPTURE_ADVISORY_REASONS).toContain('CAMERA_CLOCK_OFFSET');
      expect(CAPTURE_REASON_SEVERITY.CAMERA_CLOCK_OFFSET).toBe('INFO');
    });

    it('the sentence says the number of ms (its size, whatever the sign) and what the recording does with it', () => {
      expect(cameraClockOffsetSentence(-1_500)).toBe("Camera clock differs from the Core by 1500 ms; the recording keeps the camera's own timeline and records the offset.");
      expect(cameraClockOffsetSentence(732)).toContain('by 732 ms;');
      // No number: the sentence of the table, which a client fills (`{{offsetMs}}`), is never shown raw.
      expect(cameraClockOffsetSentence(null)).not.toMatch(/\{\{|NaN|null/);
      expect(captureFaultSentence('CAMERA_CLOCK_OFFSET', 'CAM-01')).not.toMatch(/\{\{/);
    });

    it('a raise with the measured offset: ONE SYSTEM alert (INFO) on the camera with the number in its text and params; no fault, no audit row; a second raise writes nothing; the clear resolves it', () => {
      const h = recording();
      const before = h.state();
      h.sim.actions.raiseCaptureWarning({ code: 'CAMERA_CLOCK_OFFSET', subject: 'CAM-02', offsetMs: -1_500 });
      const raised = h.state();
      const alerts = raised.alerts.filter((alert) => alert.active && alert.kind === 'SYSTEM' && !before.alerts.includes(alert));
      expect(alerts.map((alert) => [alert.severity, alert.target, alert.message, alert.params])).toEqual([
        ['INFO', 'CAM-02', "Camera clock differs from the Core by 1500 ms; the recording keeps the camera's own timeline and records the offset.", { reason: 'CAMERA_CLOCK_OFFSET', deviceId: 'CAM-02', deviceKind: 'CAMERA', sessionId: before.session?.id, offsetMs: -1_500 }],
      ]);
      expect(REPLICATED_SLICE_SCHEMAS.alerts.safeParse(raised.alerts).success).toBe(true);
      expect(raised.faults).toBe(before.faults);
      expect(raised.audit.rows).toHaveLength(before.audit.rows.length);
      expect(raised.session?.state).toBe('RECORDING');
      h.sim.actions.raiseCaptureWarning({ code: 'CAMERA_CLOCK_OFFSET', subject: 'CAM-02', offsetMs: -1_900 });
      expect(h.state().alerts).toBe(raised.alerts);
      h.sim.actions.clearCaptureWarning({ code: 'CAMERA_CLOCK_OFFSET', subject: 'CAM-02' });
      expect(h.state().alerts.filter((alert) => alert.active && alert.params?.['reason'] === 'CAMERA_CLOCK_OFFSET')).toEqual([]);
    });

    it('CONTROL: the number belongs to this notice alone - another advisory notice given one neither shows nor stores it; a number that is no whole ms is not stored', () => {
      const h = recording();
      h.sim.actions.raiseCaptureWarning({ code: 'AV_OFFSET_NEAR_BOUND', subject: 'CAM-01', offsetMs: 900 });
      const near = h.state().alerts.find((alert) => alert.active && alert.params?.['reason'] === 'AV_OFFSET_NEAR_BOUND');
      expect(near?.params).not.toHaveProperty('offsetMs');
      expect(near?.message).not.toMatch(/900/);
      h.sim.actions.raiseCaptureWarning({ code: 'CAMERA_CLOCK_OFFSET', subject: 'CAM-01', offsetMs: Number.NaN });
      const offset = h.state().alerts.find((alert) => alert.active && alert.params?.['reason'] === 'CAMERA_CLOCK_OFFSET');
      expect(offset?.params).not.toHaveProperty('offsetMs');
      expect(offset?.message).not.toMatch(/NaN|\{\{/);
      // A microphone is no camera: refused, as for every camera notice.
      expect(() => h.sim.actions.raiseCaptureWarning({ code: 'CAMERA_CLOCK_OFFSET', subject: 'MIC-01', offsetMs: 900 })).toThrow();
    });
  });

  // Task 4 row N2 (design 06 revision 3, section 8.3; decisions U25 (3), C110 (2); SM-32): the notices of a microphone whose capture
  // path is not sample-continuous. The Core's capture side raises them from the worker's own counts; the simulator raises none.
  describe('the notices of a microphone path that is not sample-continuous', () => {
    it('each raise is ONE SYSTEM alert on the microphone with the sentence of the wording table and its whole numbers in the text and params: three are a WARNING, two information; no fault, no audit row; a second raise writes nothing; the clear resolves it', () => {
      // MUTATION THIS CASE WAS SEEN RED ON: the raise of the five taking the severity 'INFO' for all (the level of before).
      const h = recording();
      const before = h.state();
      const session = before.session?.id;
      h.sim.actions.raiseCaptureWarning({ code: 'MIC_PATH_NOT_SAMPLE_CONTINUOUS', subject: 'MIC-01' });
      h.sim.actions.raiseCaptureWarning({ code: 'MIC_SAMPLES_SHORT_ABOVE_BOUND', subject: 'MIC-01', shortfallPer100k: 13_250 });
      h.sim.actions.raiseCaptureWarning({ code: 'MIC_SAMPLES_SHORT_ABOVE_SESSION_LEVEL', subject: 'MIC-01', shortfallPer100k: 11_400, referencePer100k: 9_671 });
      h.sim.actions.raiseCaptureWarning({ code: 'MIC_SILENCE_RUN_INSERTED', subject: 'MIC-01', runMs: 2_772 });
      h.sim.actions.raiseCaptureWarning({ code: 'STANDBY_ON_PRIMARY_DEVICE', subject: 'MIC-02' });
      const raised = h.state();
      const alerts = raised.alerts.filter((alert) => alert.active && alert.kind === 'SYSTEM' && !before.alerts.includes(alert));
      const base = (reason: string, deviceId: string) => ({ reason, deviceId, deviceKind: 'MIC', sessionId: session });
      expect(alerts.map((alert) => [alert.severity, alert.target, alert.message, alert.params])).toEqual([
        ['INFO', 'MIC-01', captureFaultSentence('MIC_PATH_NOT_SAMPLE_CONTINUOUS', 'MIC-01'), base('MIC_PATH_NOT_SAMPLE_CONTINUOUS', 'MIC-01')],
        ['WARNING', 'MIC-01', 'The microphone is losing more audio than this path may: 13.2% of the last 10 seconds was inserted silence (bound 12.0%).', { ...base('MIC_SAMPLES_SHORT_ABOVE_BOUND', 'MIC-01'), shortfallPer100k: 13_250 }],
        [
          'WARNING',
          'MIC-01',
          "The microphone is losing more audio than at the start of this session: 11.4% of the last 10 seconds was inserted silence (this session's level: 9.6%).",
          { ...base('MIC_SAMPLES_SHORT_ABOVE_SESSION_LEVEL', 'MIC-01'), shortfallPer100k: 11_400, referencePer100k: 9_671 },
        ],
        ['WARNING', 'MIC-01', 'Silence of 2772 ms was inserted into the recording in one piece: no audio arrived from the microphone in that time.', { ...base('MIC_SILENCE_RUN_INSERTED', 'MIC-01'), runMs: 2_772 }],
        ['INFO', 'MIC-02', "The standby microphone is another channel of the primary's device and is recorded by the same capture program. It guards a microphone and its cable, nothing else.", base('STANDBY_ON_PRIMARY_DEVICE', 'MIC-02')],
      ]);
      // The standing notice says the fixed sentence whole.
      expect(alerts[0]?.message).toContain('Sound that did not arrive is not in the recording. Silence of the same total length was inserted by the recorder; its places are not the places of the missing sound.');
      expect(REPLICATED_SLICE_SCHEMAS.alerts.safeParse(raised.alerts).success).toBe(true);
      // Advice, also at the level WARNING: no fault, no audit row, no device state, the session records on.
      expect(raised.faults).toBe(before.faults);
      expect(raised.audit.rows).toHaveLength(before.audit.rows.length);
      expect(raised.captureDevices).toBe(before.captureDevices);
      expect(raised.session?.state).toBe('RECORDING');
      h.sim.actions.raiseCaptureWarning({ code: 'MIC_SAMPLES_SHORT_ABOVE_BOUND', subject: 'MIC-01', shortfallPer100k: 20_000 });
      expect(h.state().alerts).toBe(raised.alerts);
      h.sim.actions.clearCaptureWarning({ code: 'MIC_SAMPLES_SHORT_ABOVE_BOUND', subject: 'MIC-01' });
      expect(activeCaptureNotice(h.state(), 'MIC_SAMPLES_SHORT_ABOVE_BOUND', 'MIC-01')).toBeUndefined();
      expect(activeCaptureNotice(h.state(), 'MIC_SAMPLES_SHORT_ABOVE_SESSION_LEVEL', 'MIC-01')).toBeDefined();
      expect(activeCaptureNotice(h.state(), 'MIC_PATH_NOT_SAMPLE_CONTINUOUS', 'MIC-01')).toBeDefined();
    });

    it('CONTROL: a number belongs to its own notice alone and is a whole number inside its bounds or is neither shown nor stored; a camera is no microphone', () => {
      const h = recording();
      const alertOf = (reason: string) => h.state().alerts.find((alert) => alert.active && alert.params?.['reason'] === reason);
      h.sim.actions.raiseCaptureWarning({ code: 'MIC_PATH_NOT_SAMPLE_CONTINUOUS', subject: 'MIC-01', shortfallPer100k: 13_250, runMs: 500 });
      expect(Object.keys(alertOf('MIC_PATH_NOT_SAMPLE_CONTINUOUS')?.params ?? {}).sort()).toEqual(['deviceId', 'deviceKind', 'reason', 'sessionId']);
      h.sim.actions.raiseCaptureWarning({ code: 'MIC_SAMPLES_SHORT_ABOVE_BOUND', subject: 'MIC-01', shortfallPer100k: 100_001, runMs: 500, referencePer100k: 9_000 });
      expect(Object.keys(alertOf('MIC_SAMPLES_SHORT_ABOVE_BOUND')?.params ?? {}).sort()).toEqual(['deviceId', 'deviceKind', 'reason', 'sessionId']);
      expect(alertOf('MIC_SAMPLES_SHORT_ABOVE_BOUND')?.message).toBe('The microphone is losing more audio than this path may (bound 12.0% of 10 seconds as inserted silence).');
      h.sim.actions.raiseCaptureWarning({ code: 'MIC_SILENCE_RUN_INSERTED', subject: 'MIC-01', runMs: Number.NaN });
      expect(alertOf('MIC_SILENCE_RUN_INSERTED')?.params).not.toHaveProperty('runMs');
      expect(alertOf('MIC_SILENCE_RUN_INSERTED')?.message).not.toMatch(/NaN|\{\{/);
      // The rate notice of before is what it was: INFO, its own short text, no number.
      h.sim.actions.raiseCaptureWarning({ code: 'MIC_RATE_AT_LIMIT', subject: 'MIC-01', shortfallPer100k: 13_250 });
      expect([alertOf('MIC_RATE_AT_LIMIT')?.severity, alertOf('MIC_RATE_AT_LIMIT')?.message]).toEqual(['INFO', 'MIC-01: rate correction is at its limit']);
      expect(alertOf('MIC_RATE_AT_LIMIT')?.params).not.toHaveProperty('shortfallPer100k');
      for (const code of ['MIC_PATH_NOT_SAMPLE_CONTINUOUS', 'MIC_SAMPLES_SHORT_ABOVE_BOUND', 'MIC_SAMPLES_SHORT_ABOVE_SESSION_LEVEL', 'MIC_SILENCE_RUN_INSERTED', 'STANDBY_ON_PRIMARY_DEVICE'] as const) {
        expect(() => h.sim.actions.raiseCaptureWarning({ code, subject: 'CAM-01' }), code).toThrow();
      }
    });
  });

  // Controller decision D189 (fix F-M7c could not build a boot probe of the sync level: the worker's
  // `FIRST_DURABLE_FRAGMENT.syncLevel` is the only truthful source). A session whose first durable
  // fragment was NOT synced through the drive cache is told: ONE alert on the session, CRITICAL where
  // the sources are production's, advice (INFO) in the development operation. The session records on.
  describe('the notice EVIDENCE_VOLUME_SYNC_NOT_FULL', () => {
    const SENTENCE = 'The evidence volume does not confirm full durability; recordings may not survive a power loss.';

    it('has its sentence in the wording source, about the capture as a whole', () => {
      expect(CaptureNoticeReason.EVIDENCE_VOLUME_SYNC_NOT_FULL).toBe('EVIDENCE_VOLUME_SYNC_NOT_FULL');
      expect(captureFaultSentence('EVIDENCE_VOLUME_SYNC_NOT_FULL', null)).toBe(SENTENCE);
      expect(CAPTURE_REASON_SEVERITY.EVIDENCE_VOLUME_SYNC_NOT_FULL).toBe('CRITICAL');
    });

    it.each([
      ['critical: true (production sources)', true, 'CRITICAL'],
      ['critical: false (the development operation)', false, 'INFO'],
    ] as const)('%s: ONE SYSTEM alert on the session with that severity; a second camera file of the same session writes nothing; no fault, no audit row, the session keeps recording; the clear resolves it', (_name, critical, severity) => {
      const h = recording();
      const before = h.state();
      h.sim.actions.raiseCaptureWarning({ code: 'EVIDENCE_VOLUME_SYNC_NOT_FULL', subject: null, critical, syncLevel: 'FSYNC' });
      const raised = h.state();
      h.sim.actions.raiseCaptureWarning({ code: 'EVIDENCE_VOLUME_SYNC_NOT_FULL', subject: null, critical, syncLevel: 'FSYNC' });
      expect(h.state().alerts).toBe(raised.alerts);
      const alerts = raised.alerts.filter((alert) => alert.active && alert.kind === 'SYSTEM' && !before.alerts.includes(alert));
      expect(alerts.map((alert) => [alert.severity, alert.target, alert.message, alert.params])).toEqual([[severity, 'EVIDENCE_VOLUME', SENTENCE, { reason: 'EVIDENCE_VOLUME_SYNC_NOT_FULL', sessionId: before.session?.id, syncLevel: 'FSYNC' }]]);
      expect(REPLICATED_SLICE_SCHEMAS.alerts.safeParse(raised.alerts).success).toBe(true);
      expect(raised.faults).toBe(before.faults);
      expect(raised.audit.rows).toHaveLength(before.audit.rows.length);
      expect(raised.session?.state).toBe('RECORDING');
      h.sim.actions.clearCaptureWarning({ code: 'EVIDENCE_VOLUME_SYNC_NOT_FULL', subject: null });
      expect(h.state().alerts.filter((alert) => alert.active && alert.params?.['reason'] === 'EVIDENCE_VOLUME_SYNC_NOT_FULL')).toEqual([]);
    });
  });
});

// Task 4 row V7 (finding E-01 of review 60e, Q-01 / Q-05 of 60d; decisions C113, C115): the fault of a camera's STREAM
// FAMILY sets LOST on that camera's registry entry and selector line and restores LIVE when it clears.
// MUTATIONS SEEN RED: (1) `cameraStreamStateAfterFaults` returning `after` unchanged (the raise and the clear cases);
// (2) `applyCaptureTelemetryTransition` without the `cameraStreamFaultActive` guard (the telemetry case);
// (3) the restore ignoring `online` (the not-online case).
describe('row V7: a camera whose stream is lost says LOST (finding E-01)', () => {
  const ENDED = { code: 'CAPTURE_FAULT', subject: 'CAM-02', reason: 'CAMERA_STREAM_ENDED' } as const;
  const streamsOf = (state: SimState, deviceId = 'CAM-02') => ({
    entry: state.captureDevices.devices.find((device) => device.id === deviceId)?.streamState,
    line: state.captureConfig.cameras.find((camera) => camera.deviceId === deviceId)?.streamState,
    online: state.captureDevices.devices.find((device) => device.id === deviceId)?.online,
  });
  const LIVE = { entry: 'LIVE', line: 'LIVE', online: true };
  const LOST = { entry: 'LOST', line: 'LOST', online: true };

  it('the raise sets LOST on the entry and the line of THAT camera in the unit of the fault; `online` and every other device are untouched; the clear restores LIVE', () => {
    const h = harness();
    const before = h.state();
    expect(streamsOf(before)).toEqual(LIVE);
    const sets = h.sets();
    h.sim.actions.raiseCaptureWarning(ENDED);
    // ONE commit: the revision that carries the alert carries the lines.
    expect(h.sets()).toBe(sets + 1);
    const raised = h.state();
    expect(streamsOf(raised)).toEqual(LOST);
    expect(streamsOf(raised, 'CAM-01')).toEqual(LIVE);
    expect(raised.captureDevices.devices.filter((device) => device.id !== 'CAM-02')).toEqual(before.captureDevices.devices.filter((device) => device.id !== 'CAM-02'));
    expect(raised.captureConfig.updatedAt).toBe(before.captureConfig.updatedAt);
    expect(raised.alerts.filter((alert) => alert.active && alert.kind === 'CAPTURE_FAULT')).toMatchObject([{ target: 'CAM-02', params: { reason: 'CAMERA_STREAM_ENDED' } }]);
    expect(REPLICATED_SLICE_SCHEMAS.captureDevices.safeParse(raised.captureDevices).success).toBe(true);
    // The status every client reads for the track (operation 44's member) says it too.
    expect(cameraStreamFaultActive(raised, 'CAM-02')).toBe(true);
    h.sim.actions.clearCaptureWarning(ENDED);
    expect(streamsOf(h.state())).toEqual(LIVE);
    expect(cameraStreamFaultActive(h.state(), 'CAM-02')).toBe(false);
  });

  it('telemetry does not say LIVE over the active fault (the relay\'s ingest stays CONNECTED while it re-opens its camera); after the clear it does', () => {
    const h = harness();
    h.sim.actions.raiseCaptureWarning(ENDED);
    const raised = h.state();
    h.sim.actions.applyCaptureTelemetry(frame({ ingest: [{ deviceId: 'CAM-02', state: 'CONNECTED' }, { deviceId: 'CAM-01', state: 'CONNECTED' }] }));
    expect(streamsOf(h.state())).toEqual(LOST);
    expect(h.state().captureDevices).toBe(raised.captureDevices);
    // A WAITING ingest is its own statement: not online, LOST - and the clear of the fault does not say LIVE for a device that is not online.
    h.sim.actions.applyCaptureTelemetry(frame({ ingest: [{ deviceId: 'CAM-02', state: 'WAITING' }] }));
    h.sim.actions.clearCaptureWarning(ENDED);
    expect(streamsOf(h.state())).toEqual({ entry: 'LOST', line: 'LOST', online: false });
    // Telemetry is what says it is back.
    h.sim.actions.applyCaptureTelemetry(frame({ ingest: [{ deviceId: 'CAM-02', state: 'CONNECTED' }] }));
    expect(streamsOf(h.state())).toEqual(LIVE);
  });

  it('two causes on one camera: LOST until the LAST of the family is cleared; clearing every capture fault restores LIVE', () => {
    const h = harness();
    h.sim.actions.raiseCaptureWarning(ENDED);
    // (The input type names no `reason`: it rides the raise, pass D6 item 14 - hence the cast of a literal.)
    const NO_PICTURE = { ...ENDED, reason: 'CAMERA_NO_PICTURE' } as never;
    h.sim.actions.raiseCaptureWarning(NO_PICTURE);
    h.sim.actions.clearCaptureWarning(ENDED);
    expect(streamsOf(h.state())).toEqual(LOST);
    h.sim.actions.clearCaptureWarning(NO_PICTURE);
    expect(streamsOf(h.state())).toEqual(LIVE);
    h.sim.actions.raiseCaptureWarning({ ...ENDED, reason: 'CAMERA_NOT_CONNECTED' } as never);
    expect(streamsOf(h.state())).toEqual(LOST);
    expect(streamsOf(clearCaptureFaultsTransition(h.state(), START + 1))).toEqual(LIVE);
  });

  it('CONTROL - what is NOT of the family moves no line: a capture fault without a reason (the simulator\'s own), an integrity refusal, a clock reason, a microphone, the capture as a whole', () => {
    expect([...CAMERA_STREAM_FAULT_REASONS]).toEqual(['CAMERA_STREAM_ENDED', 'CAMERA_NOT_CONNECTED', 'CAMERA_NO_PICTURE']);
    for (const warning of [
      { code: 'CAPTURE_FAULT', subject: 'CAM-02' },
      { code: 'CAPTURE_FAULT', subject: 'CAM-02', reason: 'CAMERA_ANNOUNCE_NOT_MATCHED' },
      { code: 'CAPTURE_FAULT', subject: 'CAM-02', reason: 'CAMERA_ANNOUNCE_NOT_SEEN' },
      { code: 'CAPTURE_FAULT', subject: 'CAM-02', reason: 'CAMERA_CLOCK_OUT_OF_BOUND' },
      { code: 'CAPTURE_FAULT', subject: 'MIC-01', reason: 'MIC_DISCONNECTED' },
      { code: 'CAPTURE_FAULT', subject: 'MIC-01', reason: 'CAMERA_STREAM_ENDED' },
      { code: 'MIC_SILENT', subject: 'MIC-01' },
      { code: 'CAPTURE_FAULT', subject: null, reason: 'CAMERA_STREAM_ENDED' },
    ] as const) {
      const h = harness();
      const before = h.state();
      h.sim.actions.raiseCaptureWarning(warning as never);
      expect(h.state().faults, JSON.stringify(warning)).not.toBe(before.faults);
      expect([h.state().captureDevices, h.state().captureConfig], JSON.stringify(warning)).toEqual([before.captureDevices, before.captureConfig]);
      h.sim.actions.clearCaptureWarning(warning as never);
      expect([h.state().captureDevices, h.state().captureConfig], JSON.stringify(warning)).toEqual([before.captureDevices, before.captureConfig]);
    }
  });

  // THE CONSEQUENCE, STATED (decision C115; task-3 rule OD-22): LOST is the condition of a camera's PoE power cycle.
  // WHAT THIS CASE SHOWS OF THE ENGINE AS IT IS: the action behind operation 48 (`deviceCommand(id, RESTART)`) is
  // ACCEPTED for a camera that lost its stream when no recording runs, and REFUSED while one runs (RECORDING_ACTIVE).
  // AND THE CONTROL: it is accepted for a camera whose stream is LIVE as well - the engine does not ask for LOST;
  // the refusal `CAMERA_NOT_LOST` of the contract is written by no transition of this package (see the record of row V7).
  it('PoE (OD-22): a real camera that lost its stream reads LOST, and the restart behind operation 48 is accepted for it outside a recording and refused inside one', () => {
    const technician = OPERATORS.find((candidate) => candidate.role === 'TECHNICIAN');
    if (technician === undefined) throw new Error('no seeded TECHNICIAN');
    const idle = harness('idle');
    expect(idle.sim.actions.signIn(technician.username, DEMO_OPERATOR_PASSWORD)).toMatchObject({ ok: true });
    idle.sim.actions.raiseCaptureWarning(ENDED);
    expect(streamsOf(idle.state())).toEqual(LOST);
    const rowsBefore = idle.state().audit.total;
    expect(() => idle.sim.actions.deviceCommand('CAM-02', 'RESTART')).not.toThrow();
    expect(idle.state().audit.total).toBe(rowsBefore + 1);
    expect(idle.state().audit.rows.at(-1)).toMatchObject({ type: 'DEVICE_COMMAND', deviceId: 'CAM-02', details: { command: 'RESTART' } });
    // The restart is no statement about the stream: the camera stays LOST until its fault clears.
    expect(streamsOf(idle.state())).toEqual(LOST);
    // CONTROL: the engine accepts the same command for the camera whose stream is LIVE.
    expect(streamsOf(idle.state(), 'CAM-01')).toEqual(LIVE);
    expect(() => idle.sim.actions.deviceCommand('CAM-01', 'RESTART')).not.toThrow();

    const recording = harness('recording');
    expect(recording.sim.actions.signIn(technician.username, DEMO_OPERATOR_PASSWORD)).toMatchObject({ ok: true });
    recording.sim.actions.raiseCaptureWarning(ENDED);
    expect(streamsOf(recording.state())).toEqual(LOST);
    expect(() => recording.sim.actions.deviceCommand('CAM-02', 'RESTART')).toThrow(/restart is unavailable while recording/);
  });
});

// Task 4 row V7c (decision C126 (b); request line 523): an IDLE camera is NOT READ. The selector line's member is nullable as the
// registry entry's is; a REGISTERED camera (an entry with an `adapter`) states null at rest and LIVE only while a stream is read
// (telemetry CONNECTED of an open session's ingest). The two built-in cameras of the demonstration model keep the model's value
// (every case above passes unedited). Mutations each seen RED are listed in implementation/v7c_idle_state_and_reason.md.
describe('row V7c: a registered camera no session reads is NOT READ (null), never LIVE at rest', () => {
  const CAM = 'CAM-07';
  const REGISTERED = { id: CAM, kind: 'CAMERA', model: null, firmware: null, host: '192.0.2.17', poePort: null, online: true, streamState: null, capabilities: ['VIDEO'], adapter: 'ONVIF_RTSP', sourceClass: 'PRODUCTION', profiles: [] } as const;
  const FAULT = { code: 'CAPTURE_FAULT', subject: CAM, reason: 'CAMERA_STREAM_ENDED' } as const;
  /** The camera registered and on VIDEO-02, both stating null: what an assignment of it at rest leaves (case 1). */
  const seeded = (scenario: ScenarioName) => {
    const h = harness(scenario);
    const state = h.state();
    h.sim.store.setState({
      captureDevices: { ...state.captureDevices, devices: [...state.captureDevices.devices, { ...REGISTERED, capabilities: ['VIDEO'], profiles: [] }] },
      captureConfig: { ...state.captureConfig, cameras: state.captureConfig.cameras.map((line) => (line.trackId === 'VIDEO-02' ? { ...line, deviceId: CAM, online: true, streamState: null } : line)) },
    });
    return h;
  };
  const of = (state: SimState, deviceId = CAM) => ({
    entry: state.captureDevices.devices.find((device) => device.id === deviceId)?.streamState,
    line: state.captureConfig.cameras.find((camera) => camera.deviceId === deviceId)?.streamState,
    online: state.captureDevices.devices.find((device) => device.id === deviceId)?.online,
  });
  const NOT_READ = { entry: null, line: null, online: true };
  const LIVE = { entry: 'LIVE', line: 'LIVE', online: true };
  const LOST = { entry: 'LOST', line: 'LOST', online: true };

  it('the contract: the selector line\'s `streamState` admits null (NOT READ) beside LIVE and LOST, as the registry entry\'s does; no third word', () => {
    const line = { trackId: 'VIDEO-01', deviceId: CAM, profile: 'H264_1080P25', online: true };
    expect(REPLICATED_SLICE_SCHEMAS.captureConfig.shape.cameras.element.safeParse({ ...line, streamState: null }).success).toBe(true);
    expect(REPLICATED_SLICE_SCHEMAS.captureConfig.shape.cameras.element.safeParse({ ...line, streamState: 'LIVE' }).success).toBe(true);
    expect(REPLICATED_SLICE_SCHEMAS.captureConfig.shape.cameras.element.safeParse({ ...line, streamState: 'NOT_READ' }).success).toBe(false);
  });

  it('an assignment reads nothing: a registered camera put on a slot at rest states null on its line, as its entry does; CONTROL: a built-in camera keeps the model\'s LIVE', () => {
    const h = harness('idle');
    h.sim.actions.registerCaptureDevice({ id: CAM, model: null, host: '192.0.2.17', adapter: 'ONVIF_RTSP' });
    expect(h.sim.actions.signIn('rina.wijaya', DEMO_OPERATOR_PASSWORD)).toMatchObject({ ok: true });
    // A held slot (VIDEO-02 holds CAM-02) ...
    h.sim.actions.setCaptureConfig({ kind: 'CAMERA_SOURCE', deviceId: CAM, trackId: 'VIDEO-02' });
    expect(of(h.state())).toEqual(NOT_READ);
    // ... and an empty slot (VIDEO-02 cleared first, then filled by operation 78's form).
    h.sim.actions.setCaptureConfig({ kind: 'UPDATE', unassign: ['VIDEO-02'] });
    expect(h.state().captureConfig.cameras.map((line) => line.trackId)).toEqual(['VIDEO-01', 'VIDEO-03', 'VIDEO-04']); // D60 (2026-11-04): the other seeded lines stay
    h.sim.actions.setCaptureConfig({ kind: 'UPDATE', cameras: [{ trackId: 'VIDEO-02', deviceId: CAM }] });
    expect(of(h.state())).toEqual(NOT_READ);
    // CONTROL: the built-in CAM-02 put back on the same slot carries the demonstration model's value.
    h.sim.actions.setCaptureConfig({ kind: 'CAMERA_SOURCE', deviceId: 'CAM-02', trackId: 'VIDEO-02' });
    expect(h.state().captureConfig.cameras.find((line) => line.trackId === 'VIDEO-02')).toMatchObject({ deviceId: 'CAM-02', streamState: 'LIVE' });
  });

  it('LIVE only while read: CONNECTED says LIVE; the ingest closing after the stop says NOT READ again (`online` stays); ENDED under a recording is a loss; CONTROL: a built-in camera keeps LIVE', () => {
    const idle = seeded('idle');
    idle.sim.actions.applyCaptureTelemetry(frame({ ingest: [{ deviceId: CAM, state: 'CONNECTED' }, { deviceId: 'CAM-01', state: 'CONNECTED' }] }));
    expect(of(idle.state())).toEqual(LIVE);
    idle.sim.actions.applyCaptureTelemetry(frame({ ingest: [{ deviceId: CAM, state: 'ENDED' }, { deviceId: 'CAM-01', state: 'ENDED' }] }));
    expect(of(idle.state())).toEqual(NOT_READ);
    expect(of(idle.state(), 'CAM-01')).toEqual(LIVE);
    // A second ENDED changes nothing: the same state object.
    const settled = idle.state();
    expect(applyCaptureTelemetryTransition(settled, frame({ ingest: [{ deviceId: CAM, state: 'ENDED' }] }))).toBe(settled);

    const recording = seeded('recording');
    recording.sim.actions.applyCaptureTelemetry(frame({ ingest: [{ deviceId: CAM, state: 'CONNECTED' }] }));
    expect(of(recording.state())).toEqual(LIVE);
    recording.sim.actions.applyCaptureTelemetry(frame({ ingest: [{ deviceId: CAM, state: 'ENDED' }] }));
    expect(of(recording.state())).toEqual({ entry: 'LOST', line: 'LOST', online: false });
  });

  it('a stream fault: LOST at the raise; the last clear says LIVE only while the session records, NOT READ otherwise; a closing ingest does not hide an active fault', () => {
    const recording = seeded('recording');
    recording.sim.actions.applyCaptureTelemetry(frame({ ingest: [{ deviceId: CAM, state: 'CONNECTED' }] }));
    recording.sim.actions.raiseCaptureWarning(FAULT);
    expect(of(recording.state())).toEqual(LOST);
    recording.sim.actions.clearCaptureWarning(FAULT);
    expect(of(recording.state())).toEqual(LIVE);

    const idle = seeded('idle');
    idle.sim.actions.raiseCaptureWarning(FAULT);
    expect(of(idle.state())).toEqual(LOST);
    // The ingest closes while the fault is active: still LOST (the fault is the statement).
    idle.sim.actions.applyCaptureTelemetry(frame({ ingest: [{ deviceId: CAM, state: 'ENDED' }] }));
    expect(of(idle.state())).toEqual(LOST);
    idle.sim.actions.clearCaptureWarning(FAULT);
    expect(of(idle.state())).toEqual(NOT_READ);
  });
});
