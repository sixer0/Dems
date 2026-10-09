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
import { CaptureIngestState, CaptureMicRole, CaptureWarningCode, WorkerMessageType } from '@dems/capture-protocol';
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
        { role: CaptureMicRole.PRIMARY, dbfs: patch.primary === undefined ? -20 : patch.primary, clipped: false },
        { role: CaptureMicRole.STANDBY, dbfs: -35, clipped: false },
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
  const warn = async (code: CaptureWarningCode, subject: string | null, state: 'ACTIVE' | 'CLEARED' = 'ACTIVE') => {
    worker.warning(code, subject, state);
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
    await h.warn(CaptureWarningCode.MIC_SILENT, 'STANDBY');
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
    await h.warn(CaptureWarningCode.MIC_SILENT, 'PRIMARY');
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

  it('CONTROL: the same frames with track IDs (VIDEO-0x) do NOT reach a device: the telemetry entries are ignored and named, the warning is refused as a protocol violation', async () => {
    const h = await joined();
    await h.telemetry();
    const before = h.state();

    await h.telemetry({ cam02: CaptureIngestState.ENDED, cameraIds: ['VIDEO-01', 'VIDEO-02'] });
    expect(h.camera('CAM-02')).toEqual({ device: 'LIVE', slot: 'LIVE', online: true });
    expect(h.state().captureDevices).toBe(before.captureDevices);
    expect(h.ignored).toEqual(['ingest:VIDEO-01', 'ingest:VIDEO-02', 'fragments:VIDEO-01', 'fragments:VIDEO-02']);

    // The very same frame in the Core's vocabulary does reach it.
    await h.telemetry({ cam02: CaptureIngestState.ENDED });
    expect(h.camera('CAM-02')).toEqual({ device: 'LOST', slot: 'LOST', online: false });

    // A warning about a track ID never reaches the engine: the supervisor ends that worker for it.
    const audit = h.state().audit;
    await h.warn(CaptureWarningCode.CAPTURE_FAULT, 'VIDEO-02');
    expect(h.down).toEqual([['PROTOCOL_VIOLATION', 'WARNING_SUBJECT_UNKNOWN']]);
    expect(h.faults()).toEqual([]);
    expect(h.state().audit).toBe(audit);
    // And the engine's own answer to one, were it ever handed on (the simulator refuses it).
    expect(() => h.sim.actions.raiseCaptureWarning({ code: 'CAPTURE_FAULT', subject: 'VIDEO-02' })).toThrow(/VIDEO-02/);
    expect(() => h.sim.actions.raiseCaptureWarning({ code: 'CAPTURE_FAULT', subject: 'CAM-02' })).not.toThrow();
  });
});
