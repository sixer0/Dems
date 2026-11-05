// Blueprint row 58, fix round 1 (decision D72, finding A-1): the JOINED test. Frames shaped as the
// real worker emits them go through the real supervisor (on a FakeWorkerProcess) and the real
// forwarder into a REAL simulator, through the three INTERNAL capture actions the engine host
// calls (`applyCaptureTelemetry`, `raiseCaptureWarning`, `clearCaptureWarning`).
//
// The halves are tested where they live (`forwarder.test.ts` on a recording stand-in,
// `packages/shared/test/sim-capture-telemetry.test.ts`, `engine/__tests__/capture-actions.db.test.ts`).
// This file is what those cannot show: that the IDs the capture side SENDS are the IDs the engine
// side KNOWS. On the wire a camera is its capture-device ID (`CAM-02`), a mic its device ID
// (`MIC-01`) or its role (`PRIMARY`); a track ID (`VIDEO-02`) never reaches a device: it is refused
// or ignored where somebody sees it.
//
// No database: the simulator is the one the host runs (`createSim`, levels external as in capture
// mode `real`); the engine stand-in below only turns a call into the simulator's action.
import { CaptureIngestState, CaptureMicRole, CaptureWarningCode, CaptureWarningReason, WorkerMessageType } from '@dems/capture-protocol';
import {
  captureTelemetryIgnored,
  createManualClock,
  createSim,
  type CaptureTelemetryInput,
  type Sim,
  type SimState,
} from '@dems/shared/sim';
import { describe, expect, it } from 'vitest';
import { capturePlan, fakeLauncher, flush, manualCaptureTimers } from '../../../test/support/capture';
import { clearCaptureFaultsTransition } from '../../engine/capture-session';
import { CAPTURE_WARNING_CLEAR_HOLD_MS, createCaptureSupervisor, forwardCaptureEvents, type CaptureEngine, type CaptureReport } from '../index';

const SESSION = 'S-TEST-0001';
const START = Date.UTC(2026, 9, 1, 3, 0, 0);

/** The host's three entry points on a real simulator: the action, and what the host says about an ignored ID. */
function simulatorEngine(sim: Sim, ignored: string[]): CaptureEngine {
  return {
    async applyCaptureTelemetry(telemetry: CaptureTelemetryInput) {
      ignored.push(...captureTelemetryIgnored(sim.store.getState(), telemetry));
      sim.actions.applyCaptureTelemetry(telemetry);
    },
    async raiseCaptureWarning(warning) {
      sim.actions.raiseCaptureWarning(warning);
    },
    async clearCaptureWarning(warning) {
      sim.actions.clearCaptureWarning(warning);
    },
    // D84 R-4: what the host's capture door does, on the simulator (`clearCaptureFaultsTransition`).
    async clearCaptureFaults() {
      const state = sim.store.getState();
      const next = clearCaptureFaultsTransition(state, state.clock.now);
      if (next !== state) sim.store.setState(next, true);
    },
  };
}

async function joined() {
  const simClock = createManualClock(START);
  const sim = createSim({ clock: simClock, storage: null, authStorage: null, scenario: 'recording', capture: 'external' });
  expect(sim.store.getState().session?.state).toBe('RECORDING');
  const clock = manualCaptureTimers();
  const fake = fakeLauncher();
  const reports: CaptureReport[] = [];
  const ignored: string[] = [];
  const supervisor = createCaptureSupervisor({ now: clock.now, timers: clock.timers, launcher: fake.launcher });
  const engine = simulatorEngine(sim, ignored);
  forwardCaptureEvents({ capture: supervisor, engine: () => engine, report: (entry) => void reports.push(entry), now: clock.now });
  const down: Array<[string, string | null | undefined]> = [];
  supervisor.on('workerDown', (event) => void down.push([event.down.code, event.down.detail]));
  await supervisor.boot();
  await supervisor.start(SESSION, capturePlan(SESSION));
  const worker = fake.last();

  /** One TELEMETRY frame as `apps/capture-worker/src/audio.c` writes it: both roles, both cameras by device ID. */
  const telemetry = async (patch: { primary?: number | null; cam01?: CaptureIngestState; cam02?: CaptureIngestState; cameraIds?: readonly [string, string] } = {}) => {
    const [first, second] = patch.cameraIds ?? ['CAM-01', 'CAM-02'];
    worker.say({
      type: WorkerMessageType.TELEMETRY,
      levels: [
        { deviceId: 'MIC-01', role: CaptureMicRole.PRIMARY, dbfs: patch.primary === undefined ? -20 : patch.primary, clipped: false, ratePpm: 0, timelineSamples: 480_000, receivedSamples: 480_000, insertedSamples: 0, nonZero: true },
        { deviceId: 'MIC-02', role: CaptureMicRole.STANDBY, dbfs: -35, clipped: false, ratePpm: 0, timelineSamples: 480_000, receivedSamples: 480_000, insertedSamples: 0, nonZero: true },
      ],
      ingest: [
        { deviceId: first, state: patch.cam01 ?? CaptureIngestState.CONNECTED },
        { deviceId: second, state: patch.cam02 ?? CaptureIngestState.CONNECTED },
      ],
      fragments: [
        { deviceId: first, count: 3, bytes: 15_393 },
        { deviceId: second, count: 3, bytes: 15_393 },
      ],
      clocks: [],
      tapActive: false,
    });
    await flush();
    // The simulator's next 20 Hz frame, as the host's tick makes it.
    simClock.advance(50);
    sim.tick();
  };
  /** Time passes on both clocks; the worker keeps saying it is alive. */
  const pass = async (ms: number) => {
    for (let elapsed = 0; elapsed < ms; elapsed += 500) {
      worker.heartbeat();
      clock.advance(500);
      simClock.advance(500);
      await flush();
    }
  };
  const warn = async (code: CaptureWarningCode, subject: string | null, state: 'ACTIVE' | 'CLEARED' = 'ACTIVE', reason?: CaptureWarningReason) => {
    worker.warning(code, subject, state, reason);
    // One turn for the supervisor to deliver it, one for the engine's answer to be reported.
    await flush();
    await flush();
  };
  const state = (): SimState => sim.store.getState();
  const faults = () => state().faults.active.filter((fault) => fault.kind === 'CAPTURE_FAULT' || fault.kind === 'MIC_SILENT').map((fault) => `${fault.kind}@${fault.target}`);
  const audits = (kind: string) => state().audit.rows.filter((row) => row.details?.['kind'] === kind).map((row) => `${row.type}@${String(row.details?.['target'])}`);
  const camera = (id: string) => {
    const device = state().captureDevices.devices.find((candidate) => candidate.id === id);
    const slot = state().captureConfig.cameras.find((candidate) => candidate.deviceId === id);
    return { device: device?.streamState, slot: slot?.streamState, online: device?.online };
  };
  return { sim, worker, reports, ignored, down, telemetry, pass, warn, state, faults, audits, camera };
}

describe('worker frames, through the supervisor and the forwarder, into a real simulator (A-1)', () => {
  it('telemetry: a camera whose ingest ENDED while recording is LOST, by its capture-device ID; no samples on PRIMARY is NO SIGNAL on that input only', async () => {
    const h = await joined();
    await h.telemetry();
    expect(h.state().audio.inputs['MIC-01']).toMatchObject({ dbfs: -20, noSignal: false });
    expect(h.state().audio.inputs['MIC-02']).toMatchObject({ dbfs: -35, noSignal: false });
    expect(h.camera('CAM-02')).toEqual({ device: 'LIVE', slot: 'LIVE', online: true });

    await h.telemetry({ primary: null, cam02: CaptureIngestState.ENDED });
    expect(h.camera('CAM-02')).toEqual({ device: 'LOST', slot: 'LOST', online: false });
    expect(h.camera('CAM-01')).toEqual({ device: 'LIVE', slot: 'LIVE', online: true });
    expect(h.state().captureConfig.cameras.find((slot) => slot.deviceId === 'CAM-02')?.trackId).toBe('VIDEO-02');
    expect(h.state().audio.inputs['MIC-01']).toMatchObject({ dbfs: -90, noSignal: true });
    expect(h.state().audio.inputs['MIC-02']).toMatchObject({ dbfs: -35, noSignal: false });
    // Telemetry raises no fault and switches nothing.
    expect(h.faults()).toEqual([]);
    expect(h.state().audio.activeInputId).toBe('MIC-01');
    expect(h.ignored).toEqual([]);
    expect(h.reports).toEqual([]);
  });

  it('warnings: CAPTURE_FAULT of CAM-02 is raised with its alert and audit row; a mic warning reaches the right input by device ID and by role; CLEARED clears; a second ACTIVE is a NEW audit row', async () => {
    const h = await joined();
    await h.telemetry();

    await h.warn(CaptureWarningCode.CAPTURE_FAULT, 'CAM-02');
    expect(h.faults()).toEqual(['CAPTURE_FAULT@CAM-02']);
    expect(h.state().alerts.filter((alert) => alert.kind === 'CAPTURE_FAULT')).toMatchObject([{ active: true, severity: 'CRITICAL', target: 'CAM-02' }]);
    expect(h.state().audit.rows.at(-1)).toMatchObject({ type: 'FAULT_RAISED', actorId: null, deviceId: 'CAM-02', details: { kind: 'CAPTURE_FAULT', target: 'CAM-02' } });

    // A mic by its device ID: MIC-01 is the PRIMARY input, channel AUDIO-01.
    await h.warn(CaptureWarningCode.MIC_SILENT, 'MIC-01');
    expect(h.faults()).toEqual(['CAPTURE_FAULT@CAM-02', 'MIC_SILENT@AUDIO-01']);
    // The standby mic by its role: the other input.
    await h.warn(CaptureWarningCode.MIC_SILENT, 'MIC-02');
    expect(h.faults()).toEqual(['CAPTURE_FAULT@CAM-02', 'MIC_SILENT@AUDIO-01', 'MIC_SILENT@AUDIO-02']);
    expect(h.state().audio.activeInputId).toBe('MIC-01');

    // CLEARED: not before the condition stayed cleared for the hold, then at the next telemetry.
    await h.warn(CaptureWarningCode.CAPTURE_FAULT, 'CAM-02', 'CLEARED');
    await h.warn(CaptureWarningCode.MIC_SILENT, 'MIC-01', 'CLEARED');
    await h.pass(500);
    await h.telemetry();
    expect(h.faults()).toEqual(['CAPTURE_FAULT@CAM-02', 'MIC_SILENT@AUDIO-01', 'MIC_SILENT@AUDIO-02']);
    await h.pass(CAPTURE_WARNING_CLEAR_HOLD_MS);
    await h.telemetry();
    await flush();
    expect(h.faults()).toEqual(['MIC_SILENT@AUDIO-02']);
    expect(h.audits('CAPTURE_FAULT')).toEqual(['FAULT_RAISED@CAM-02', 'FAULT_CLEARED@CAM-02']);
    expect(h.state().alerts.filter((alert) => alert.kind === 'CAPTURE_FAULT')).toMatchObject([{ active: false }]);

    // The second episode: a NEW fault, alert and audit row; and the same mic by its ROLE this time.
    await h.warn(CaptureWarningCode.CAPTURE_FAULT, 'CAM-02');
    await h.warn(CaptureWarningCode.MIC_SILENT, 'MIC-01');
    expect(h.audits('CAPTURE_FAULT')).toEqual(['FAULT_RAISED@CAM-02', 'FAULT_CLEARED@CAM-02', 'FAULT_RAISED@CAM-02']);
    expect(h.state().alerts.filter((alert) => alert.kind === 'CAPTURE_FAULT').map((alert) => alert.active)).toEqual([false, true]);
    expect(h.audits('MIC_SILENT')).toEqual(['FAULT_RAISED@AUDIO-01', 'FAULT_RAISED@AUDIO-02', 'FAULT_CLEARED@AUDIO-01', 'FAULT_RAISED@AUDIO-01']);
    expect(h.faults()).toEqual(['MIC_SILENT@AUDIO-02', 'CAPTURE_FAULT@CAM-02', 'MIC_SILENT@AUDIO-01']);
    // Never a switch (OD-11), and nothing was refused on the way.
    expect(h.state().audio.activeInputId).toBe('MIC-01');
    expect(h.state().audit.rows.filter((row) => row.type === 'AUDIO_SOURCE_SWITCHED')).toEqual([]);
    expect(h.reports).toEqual([]);
    expect(h.ignored).toEqual([]);
  });

  it('CONTROL: the same frames with track IDs (VIDEO-0x) do NOT reach a device: the telemetry frame ends the worker before any entry is handed on, the warning is refused as a protocol violation', async () => {
    const h = await joined();
    await h.telemetry();
    // A frame in the Core's vocabulary reaches its device.
    await h.telemetry({ cam02: CaptureIngestState.ENDED });
    expect(h.camera('CAM-02')).toEqual({ device: 'LOST', slot: 'LOST', online: false });
    const before = h.state();

    // The same kind of frame with track IDs. Since fix pass F-M3 (review R63-05; ruling D179) a telemetry frame that
    // names a device outside the plan never reaches the forwarder: the supervisor ends that worker, as it does for a
    // warning. Nothing changes, and there is nothing left for the host to ignore.
    await h.telemetry({ cam02: CaptureIngestState.CONNECTED, cameraIds: ['VIDEO-01', 'VIDEO-02'] });
    expect(h.down).toEqual([['PROTOCOL_VIOLATION', 'TELEMETRY_SUBJECT_UNKNOWN']]);
    expect(h.camera('CAM-02')).toEqual({ device: 'LOST', slot: 'LOST', online: false });
    expect(h.state().captureDevices).toBe(before.captureDevices);
    expect(h.ignored).toEqual([]);

    // A warning about a track ID never reaches the engine either: the supervisor ends that worker for it.
    const w = await joined();
    await w.telemetry();
    const audit = w.state().audit;
    await w.warn(CaptureWarningCode.CAPTURE_FAULT, 'VIDEO-02');
    expect(w.down).toEqual([['PROTOCOL_VIOLATION', 'WARNING_SUBJECT_UNKNOWN']]);
    expect(w.faults()).toEqual([]);
    expect(w.state().audit).toBe(audit);
    // And the engine's own answer to one, were it ever handed on (the simulator refuses it).
    expect(() => w.sim.actions.raiseCaptureWarning({ code: 'CAPTURE_FAULT', subject: 'VIDEO-02' })).toThrow(/VIDEO-02/);
    expect(() => w.sim.actions.raiseCaptureWarning({ code: 'CAPTURE_FAULT', subject: 'CAM-02' })).not.toThrow();
  });
});

// Integration pass D8, item 3 (C3 §5.3, §5.4 row C; decision D156). The forwarder hands the two keys
// of a failed start to the raise (`forwarder.test.ts`). Whether they REACH the stored alert and the
// FAULT_RAISED row is the shared simulator's raise (`raiseCaptureWarningTransition`, pass D6's file;
// request line in `delegation_progress/file_requests.md`).
describe('ruling D146, joined: the fault key is (kind, reason, device) from the worker frame to the stored alert', () => {
  it('two reasons of CAPTURE_FAULT on CAM-02 are two faults, two alerts and two FAULT_RAISED rows; the CLEARED of one resolves that alert alone', async () => {
    const h = await joined();
    await h.telemetry();
    await h.warn(CaptureWarningCode.CAPTURE_FAULT, 'CAM-02', 'ACTIVE', CaptureWarningReason.CAMERA_STREAM_ENDED);
    await h.warn(CaptureWarningCode.CAPTURE_FAULT, 'CAM-02', 'ACTIVE', CaptureWarningReason.CAMERA_CLOCK_OUT_OF_BOUND);
    const reasons = () => h.state().faults.active.filter((fault) => fault.kind === 'CAPTURE_FAULT').map((fault) => `${String(fault.target)}/${String(fault.reason)}`);
    const alerts = () => h.state().alerts.filter((alert) => alert.kind === 'CAPTURE_FAULT').map((alert) => `${String(alert.params?.['reason'])}:${alert.active ? 'active' : 'resolved'}`);
    expect(reasons()).toEqual(['CAM-02/CAMERA_STREAM_ENDED', 'CAM-02/CAMERA_CLOCK_OUT_OF_BOUND']);
    expect(alerts()).toEqual(['CAMERA_STREAM_ENDED:active', 'CAMERA_CLOCK_OUT_OF_BOUND:active']);
    expect(h.audits('CAPTURE_FAULT')).toEqual(['FAULT_RAISED@CAM-02', 'FAULT_RAISED@CAM-02']);

    await h.warn(CaptureWarningCode.CAPTURE_FAULT, 'CAM-02', 'CLEARED', CaptureWarningReason.CAMERA_STREAM_ENDED);
    await h.pass(CAPTURE_WARNING_CLEAR_HOLD_MS);
    await h.telemetry();
    await flush();
    expect(reasons()).toEqual(['CAM-02/CAMERA_CLOCK_OUT_OF_BOUND']);
    expect(alerts()).toEqual(['CAMERA_STREAM_ENDED:resolved', 'CAMERA_CLOCK_OUT_OF_BOUND:active']);
    expect(h.audits('CAPTURE_FAULT')).toEqual(['FAULT_RAISED@CAM-02', 'FAULT_RAISED@CAM-02', 'FAULT_CLEARED@CAM-02']);
    expect(h.reports).toEqual([]);
  });

  it('one microphone: silent (its own kind), disconnected (a capture fault with its reason) and the rate advice are three alerts', async () => {
    const h = await joined();
    await h.telemetry();
    await h.warn(CaptureWarningCode.MIC_SILENT, 'MIC-01');
    await h.warn(CaptureWarningCode.CAPTURE_FAULT, 'MIC-01', 'ACTIVE', CaptureWarningReason.MIC_DISCONNECTED);
    await h.warn(CaptureWarningCode.CAPTURE_FAULT, 'MIC-01', 'ACTIVE', CaptureWarningReason.MIC_RATE_AT_LIMIT);
    const mine = h.state().alerts.filter((alert) => alert.active && (alert.target === 'MIC-01' || alert.kind === 'MIC_SILENT'));
    expect(mine.map((alert) => `${alert.kind}/${String(alert.params?.['reason'] ?? '-')}`).sort()).toEqual(['CAPTURE_FAULT/MIC_DISCONNECTED', 'MIC_SILENT/-', 'SYSTEM/MIC_RATE_AT_LIMIT']);
    expect(h.reports).toEqual([]);
  });
});

describe('a failed start, joined: the keys the forwarder sends and what the simulator stores of them', () => {
  const failedStart = async () => {
    const h = await joined();
    h.worker.say({ type: WorkerMessageType.CRASH, code: 'NO_CAMERA_CONNECTED', signal: null, exitCode: 70 });
    // One turn for the supervisor to say it, one for the engine's answer.
    await flush();
    await flush();
    const state = h.sim.store.getState();
    const alert = state.alerts.find((candidate) => candidate.active && candidate.kind === 'CAPTURE_FAULT' && (candidate.target ?? null) === null);
    const row = state.audit.rows.filter((candidate) => candidate.type === 'FAULT_RAISED').at(-1);
    return { h, alert, row };
  };

  it('TRUE TODAY: the worker\'s final crash raises ONE fault of the capture as a whole, with its alert and its FAULT_RAISED row, and nothing is refused', async () => {
    const { h, alert, row } = await failedStart();
    expect(h.down.at(-1)).toEqual(['EXITED', 'NO_CAMERA_CONNECTED']);
    expect(alert).toBeDefined();
    expect(row?.details).toMatchObject({ kind: 'CAPTURE_FAULT', target: null });
    expect(h.reports).toEqual([]);
  });

  // REQUIRED, NOT TRUE UNTIL THE SHARED RAISE TAKES THE KEYS (pass D6): when this case goes red
  // because it PASSES, the request landed - remove the word `.fails`.
  it('the alert\'s params and the FAULT_RAISED details hold reason NO_CAMERA_CONNECTED and evidenceFiles 0 (pass D6\'s shared raise landed; `.fails` removed by pass D9, D162 (a))', async () => {
    const { alert, row } = await failedStart();
    expect(alert?.params).toMatchObject({ reason: 'NO_CAMERA_CONNECTED', evidenceFiles: 0 });
    expect(row?.details).toMatchObject({ reason: 'NO_CAMERA_CONNECTED', evidenceFiles: 0 });
  });
});

// Integration pass D9, item 6 (ruling D144 (4); row 140's finding F-4): the worker's WARNING with the
// reason MIC_RATE_AT_LIMIT is the NAMED advisory alert of the microphone, not a bare capture fault.
// The whole path: fake worker frame -> real supervisor -> real forwarder -> real simulator.
describe('pass D9: MIC_RATE_AT_LIMIT is raised as the named advisory notice of the microphone and resolved when the worker clears it', () => {
  const advice = (state: SimState) => state.alerts.filter((alert) => alert.kind === 'SYSTEM' && alert.params?.['reason'] === 'MIC_RATE_AT_LIMIT');
  const rate = async (h: Awaited<ReturnType<typeof joined>>, subject: string | null, state: 'ACTIVE' | 'CLEARED') => {
    h.worker.warning(CaptureWarningCode.CAPTURE_FAULT, subject, state, CaptureWarningReason.MIC_RATE_AT_LIMIT);
    await flush();
    await flush();
  };

  it('ACTIVE raises ONE alert that names the reason and the microphone by its device ID - no fault, no audit row, no device state; CLEARED resolves it at once; a second episode is a new alert; the source is never switched', async () => {
    const h = await joined();
    await h.telemetry();
    const before = h.state();

    await rate(h, 'MIC-02', 'ACTIVE');
    expect(advice(h.state())).toMatchObject([{ active: true, severity: 'INFO', target: 'MIC-02', params: { reason: 'MIC_RATE_AT_LIMIT', deviceId: 'MIC-02', deviceKind: 'MIC', sessionId: SESSION } }]);
    // Advice: not a fault of the microphone, no row of the audit chain, no device moved.
    expect(h.faults()).toEqual([]);
    expect(h.state().faults.active).toEqual(before.faults.active);
    expect(h.state().audit).toBe(before.audit);
    expect(h.state().captureDevices).toBe(before.captureDevices);
    expect(h.state().alerts.filter((alert) => alert.kind === 'CAPTURE_FAULT')).toEqual([]);
    // Said again while it holds (the worker repeats, or restarts its statement): still one alert.
    await rate(h, 'MIC-02', 'ACTIVE');
    expect(advice(h.state())).toHaveLength(1);

    await rate(h, 'MIC-02', 'CLEARED');
    expect(advice(h.state()).map((alert) => alert.active)).toEqual([false]);
    // The second episode is a NEW alert with its own ID.
    await rate(h, 'MIC-02', 'ACTIVE');
    expect(advice(h.state()).map((alert) => alert.active)).toEqual([false, true]);
    expect(new Set(advice(h.state()).map((alert) => alert.id)).size).toBe(2);

    // NEVER A SWITCH (OD-11): the active input is the one it was, no switch row, no switch command to the worker.
    expect(h.state().audio.activeInputId).toBe(before.audio.activeInputId);
    expect(h.state().session?.audioSource).toEqual(before.session?.audioSource);
    expect(h.state().audit.rows.filter((row) => row.type === 'AUDIO_SOURCE_SWITCHED')).toEqual([]);
    expect(h.worker.received.map((message) => message.type as string)).not.toContain('SWITCH_AUDIO_SOURCE'); // audit row 149: no such command since protocol 6
    expect(h.reports).toEqual([]);
  });

  it('CONTROL: the same frame WITHOUT that reason is the plain capture fault of the microphone and no advice - the named alert comes from the reason; a CLEARED nobody raised resolves nothing', async () => {
    const h = await joined();
    await h.telemetry();
    await rate(h, 'MIC-02', 'CLEARED');
    expect(advice(h.state())).toEqual([]);
    await h.warn(CaptureWarningCode.CAPTURE_FAULT, 'MIC-02');
    expect(advice(h.state())).toEqual([]);
    expect(h.state().alerts.filter((alert) => alert.kind === 'CAPTURE_FAULT' && alert.active)).toHaveLength(1);
    expect(h.reports).toEqual([]);
  });

  it('the advice of a primary and of the standby are two alerts; the same reason on a device that is no microphone raises nothing - the engine refuses it and that is reported', async () => {
    const h = await joined();
    await h.telemetry();
    await rate(h, 'MIC-01', 'ACTIVE');
    await rate(h, 'MIC-02', 'ACTIVE');
    expect(advice(h.state()).map((alert) => [alert.target, alert.active])).toEqual([['MIC-01', true], ['MIC-02', true]]);
    await rate(h, 'MIC-01', 'CLEARED');
    expect(advice(h.state()).map((alert) => [alert.target, alert.active])).toEqual([['MIC-01', false], ['MIC-02', true]]);
    await rate(h, 'CAM-01', 'ACTIVE');
    expect(advice(h.state())).toHaveLength(2);
    expect(h.faults()).toEqual([]);
    expect(h.reports.map((entry) => entry.code)).toEqual(['CAPTURE_ADVISORY_NOT_RAISED']);
  });
});
