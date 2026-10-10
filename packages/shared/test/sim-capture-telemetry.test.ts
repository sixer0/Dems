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
} from '../src/sim';

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
