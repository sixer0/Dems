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
    expect(lost.captureDevices.devices.map(({ id, online, streamState }) => ({ id, online, streamState }))).toEqual([
      { id: 'CAM-01', online: true, streamState: 'LIVE' },
      { id: 'CAM-02', online: false, streamState: 'LOST' },
      { id: 'MIC-01', online: true, streamState: null },
      { id: 'MIC-02', online: true, streamState: null },
      { id: 'POE-SWITCH', online: true, streamState: null },
    ]);
    expect(lost.captureConfig.cameras.map(({ deviceId, online, streamState }) => ({ deviceId, online, streamState }))).toEqual([
      { deviceId: 'CAM-01', online: true, streamState: 'LIVE' },
      { deviceId: 'CAM-02', online: false, streamState: 'LOST' },
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
      ] as const;
      expect(cases.map(([code]) => code).sort()).toEqual(Object.values(CaptureAdvisoryReason).sort());
      for (const [code, subject] of cases) h.sim.actions.raiseCaptureWarning({ code, subject });
      const raised = h.state();
      const alerts = raised.alerts.filter((alert) => alert.active && alert.kind === 'SYSTEM' && !before.alerts.includes(alert));
      expect(alerts.map((alert) => [alert.severity, alert.target, alert.params])).toEqual(
        cases.map(([code, subject, deviceKind]) => ['INFO', subject, { reason: code, deviceId: subject, deviceKind, sessionId: before.session?.id }]),
      );
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
