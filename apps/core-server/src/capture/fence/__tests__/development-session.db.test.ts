// A REAL_DEVELOPMENT session whose selector names this Mac's camera and microphone beside the two
// test sources, through the PRODUCT path (blueprint row 140, R-11; check M5-LOCAL-E2E-1, Core half
// with scripted helpers; M5-SRC-REC-1 rows; decisions D74(2), D106(4), D128, D133 (1), D144):
//
//   stored selector -> the fence's registry of the running operation (`buildDevelopmentRegistry`)
//     -> the LOCAL and the generated adapters -> their helpers -> the capture-session unit
//     -> the supervisor -> the worker.
//
// WHAT IS REAL: the app factory and its boot on PostgreSQL as `dems_app` (the fence in
// REAL_DEVELOPMENT, the boot checks on row 61's fixture), the engine, the capture-session unit, the
// plan builder, the source-row builder, the real supervisor and the real forwarder, the fence's
// registry builder with the two LOCAL adapters and the two generated ones, the helpers' own logic
// (device list, exact-name rule, the pipe - made by the real `mkfifo`).
// WHAT STANDS IN: the worker is the `FakeWorkerProcess`; THE HELPER PROGRAM IS NEVER STARTED - the
// process door is the scripted door of the microphone tests, which plays the device list and a
// living helper from a script. NO CAMERA AND NO MICROPHONE IS LISTED, OPENED OR ASKED FOR: the
// "device list" is a text of this file.
//
// The fixture directory (`.data/test-row61-row140-<pid>-<n>`: a stand-in worker script and a test
// signing key) is LEFT in place: this file deletes nothing under `.data/`.
import { CAPTURE_PROTOCOL_VERSION, type AudioSourceIntervalRecord } from '@dems/capture-protocol';
import { createManualClock } from '@dems/shared/sim';
import type { Pool } from 'pg';
import { describe, expect, it } from 'vitest';
import { useTestDatabase } from '../../../../test/helpers/db';
import { fakeLauncher, flush, type FakeLauncher } from '../../../../test/support/capture';
import { captureLog, unitTestConfig } from '../../../../test/support/config';
import { FIXED_NOW, TICK_MS, manualTimer } from '../../../../test/support/engine';
import { buildApp } from '../../../app';
import { sessionCapture, type SessionCaptureEvent } from '../../../capture-session';
import { captureDoorsOf, engineControl } from '../../../engine';
import { captureSourceFacts } from '../../../modules/devices';
import type { Principal } from '../../../plugins/authenticate';
import { CaptureOperation } from '../../adapters';
import { LIVING_PROGRESS, deviceListText, scriptedDoor, type ScriptedDoor } from '../../adapters/local/__tests__/mic-support';
import { realBootFixture } from '../../boot/__tests__/support';
import { createCaptureSupervisor, createSystemTimers, forwardCaptureEvents, type CaptureNotice } from '../../index';
import type { CaptureTimers } from '../../types';
import { buildDevelopmentRegistry, captureFenceControl, type BuiltCaptureRegistry } from '../index';

const db = useTestDatabase({ template: 'seed' });
const fixture = realBootFixture('row140');
fixture.provisionKey();

/** The program the boot fence vouches for in these tests: a root-owned system program. It is never started (the door is scripted). */
const HELPER = '/bin/echo';
const LIST = deviceListText(['MacBook Air Microphone'], ['MacBook Air Camera', 'Capture screen 0']);
const LIVING = { lives: true, reports: LIVING_PROGRESS } as const;

/** The settle time of a helper fires at the next turn; every longer delay (a bound) keeps its real length. */
const soon: CaptureTimers = {
  after(delayMs, callback) {
    if (delayMs > 1_500) {
      const timer = setTimeout(callback, delayMs);
      timer.unref();
      return () => clearTimeout(timer);
    }
    const handle = setImmediate(callback);
    return () => clearImmediate(handle);
  },
};

interface Rig {
  readonly app: ReturnType<typeof buildApp>;
  readonly owner: Pool;
  readonly fake: FakeLauncher;
  readonly scripted: ScriptedDoor;
  readonly built: BuiltCaptureRegistry;
  readonly events: SessionCaptureEvent[];
  readonly notices: CaptureNotice[];
  /** `openSources()` at each change the fence told, in order. */
  readonly on: string[][];
  /** Pass D11: the devices the `captureDevices` slice says are on (`sourceOpen`), after everything queued was written. */
  sliceOn(): Promise<string[]>;
  readonly investigator: Extract<Principal, { kind: 'OPERATOR' }>;
  arm(): Promise<string>;
  start(sessionId: string): Promise<void>;
  stop(sessionId: string): Promise<void>;
  settled(): Promise<void>;
}

async function rig(slug: string): Promise<Rig> {
  const target = await db.another({ template: 'seed', slug });
  const owner = target.ownerPool();
  // No speech runtime on a test host: the transcriber is not the subject here.
  await owner.query('UPDATE public.stt_config SET enabled = false');
  // What a development Core holds once its boot registered the two local devices (D106 (4): NEW rows
  // `CAM-03` / `MIC-03`, listed) and an operator assigned them: camera 1 and the primary microphone
  // are this Mac's, slot 2 keeps the test sources (D74(2)). Written by the owner, as a fixture.
  await owner.query("INSERT INTO public.capture_devices (id, kind, transport, model, enabled, adapter_kind) VALUES ('CAM-03', 'CAMERA', 'AVFOUNDATION', 'MacBook Air Camera', true, 'LOCAL_DEVICE'), ('MIC-03', 'MIC', 'AVFOUNDATION', 'MacBook Air Microphone', true, 'LOCAL_DEVICE')");
  await owner.query("UPDATE public.capture_config SET video_01_device_id = 'CAM-03', mic_primary_id = 'MIC-03', mic_standby_id = 'MIC-02'");

  const log = captureLog();
  const app = buildApp({
    config: unitTestConfig({ database: target.runtime, dataDir: fixture.dataDir, mediaStoreDir: fixture.mediaStoreDir, logLevel: 'info', captureMode: 'real', demoControls: false, captureDevSources: true, captureHelperFfmpegPath: HELPER, captureWorkerPath: fixture.worker(`worker-${slug}`, 'capture-worker/0.4.0') }),
    logStream: log.stream,
  });
  target.onCleanup(() => app.close());
  await app.ready();
  const clock = createManualClock(FIXED_NOW);
  app.seams.replace('clock', clock);
  app.seams.replace('publish', () => {});
  const engine = engineControl(app);
  const timer = manualTimer();
  engine.useTimer(timer.timer);
  await app.readiness.boot();
  const fence = captureFenceControl(app);
  expect(fence.operation).toBe(CaptureOperation.REAL_DEVELOPMENT);
  const outcome = fence.outcome();
  // The boot found the two stored local rows (it inserted nothing) and says which ids are this Mac's.
  expect(outcome?.local).toEqual({ cameraId: 'CAM-03', micId: 'MIC-03' });
  if (outcome === null || outcome.local === null) throw new Error('the fence did not pass');

  const fake = fakeLauncher({ ackSwitch: false });
  const supervisor = createCaptureSupervisor({ now: () => app.clock.now(), timers: createSystemTimers(), launcher: fake.launcher });
  await supervisor.boot();
  app.seams.replace('capture', supervisor);
  const notices: CaptureNotice[] = [];
  forwardCaptureEvents({
    capture: supervisor,
    engine: () => ({
      applyCaptureTelemetry: (telemetry) => app.engine.applyCaptureTelemetry(telemetry),
      raiseCaptureWarning: (warning) => app.engine.raiseCaptureWarning(warning),
      clearCaptureWarning: (warning) => app.engine.clearCaptureWarning(warning),
      clearCaptureFaults: () => captureDoorsOf(app.engine).clearCaptureFaults(),
    }),
    report: () => {},
    notice: (entry) => void notices.push(entry),
    now: () => app.clock.now(),
  });
  target.onCleanup(() => supervisor.shutdown());

  // THE PRODUCT REGISTRY of the running operation, from what the boot read, with the scripted door
  // in the place of the process door: the helper program is played, never started.
  const scripted = scriptedDoor(LIST, () => LIVING);
  const on: string[][] = [];
  const built: BuiltCaptureRegistry = buildDevelopmentRegistry({
    devices: outcome.devices,
    local: outcome.local,
    program: HELPER,
    runDir: `${fixture.dataDir}/run/capture`,
    now: () => app.clock.now(),
    timers: soon,
    door: scripted.door,
    onOpenSourcesChanged: () => {
      on.push([...built.openSources()].sort());
      // Pass D11: what the product's fence tells the feed of the source facts, told by this rig's registry.
      void sourceFacts.changed('OPEN_SOURCES_CHANGED');
    },
  });
  target.onCleanup(() => built.closeAll());
  // Pass D11: the feed reads THIS registry (the one with the scripted door), as the capture session of the rig does.
  const sourceFacts = captureSourceFacts(app);
  sourceFacts.replace({ registered: () => built.registry.list(), openSources: () => built.openSources() });
  const capture = sessionCapture(app);
  capture.replace({ registry: () => built.registry, leftoverHelpers: async () => [], tapPathFor: async () => null });
  const events: SessionCaptureEvent[] = [];
  capture.on((event) => void events.push(event));

  const operator = engine.slice('operators').find((candidate) => candidate.role === 'INVESTIGATOR');
  if (operator === undefined) throw new Error('the seed has no investigator');
  const investigator: Extract<Principal, { kind: 'OPERATOR' }> = { kind: 'OPERATOR', operatorId: operator.id, sessionId: 'test-session', deviceId: null, role: 'INVESTIGATOR', permissions: [] };
  const drive = async (ms: number): Promise<void> => {
    for (let elapsed = 0; elapsed < ms; elapsed += TICK_MS) {
      clock.advance(TICK_MS);
      timer.fire();
      await engine.idle();
    }
  };
  const settled = async (): Promise<void> => {
    for (let round = 0; round < 6; round += 1) {
      await flush();
      await new Promise((resolve) => setImmediate(resolve));
      await capture.idle();
    }
  };

  return {
    app,
    owner,
    fake,
    scripted,
    built,
    events,
    notices,
    on,
    investigator,
    settled,
    async sliceOn() {
      await settled();
      await engine.idle();
      return app.engine.slice('captureDevices').devices.filter((device) => device.sourceOpen === true).map((device) => device.id);
    },
    async arm() {
      await app.engine.setTabletLink('CONNECTED');
      const created = await app.engine.command(investigator, 'createSession', { caseNumber: 'LP/2026/1009-0140', subjectType: 'SAKSI', subjectName: 'Test Subject', room: 'Interview Room 1', profileId: 'STANDARD_1080P25', investigatorId: investigator.operatorId });
      if (!created.value.ok) throw new Error(`the session was not created: ${created.value.reason}`);
      await app.engine.command(investigator, 'beginPrecheck');
      await drive(5_000);
      if (app.engine.slice('session')?.state === 'PRECHECK') await app.engine.command(investigator, 'acknowledgePrecheckWarnings');
      expect(app.engine.slice('session')?.state).toBe('ARMED');
      return created.value.sessionId;
    },
    async start(sessionId) {
      await capture.beforeStart();
      try {
        await app.engine.run('sessions.startSession', async (scope) => {
          await scope.command(investigator, 'startRecording');
          await capture.recordingStartedIn(scope, sessionId);
        });
      } catch (error) {
        capture.startAbandoned(sessionId);
        throw error;
      }
      capture.afterStartCommitted(sessionId);
      await settled();
    },
    async stop(sessionId) {
      await app.engine.run('sessions.stopSession', async (scope) => {
        capture.stopRequestedIn(scope, sessionId);
        await scope.command(investigator, 'stopRecording', 'End of the interview');
      });
      capture.afterStopCommitted(sessionId);
      await settled();
    },
  };
}

const startInterval: AudioSourceIntervalRecord = { kind: 'AUDIO_SOURCE_INTERVAL', deviceId: 'MIC-03', role: 'PRIMARY', index: 1, fromSample: 0, sampleRateHz: 48_000, capturedAtMs: FIXED_NOW, reason: 'SESSION_START', correlationId: null, appliedDelayUs: null };

/** The helper calls of the one recorded session of this file that write into a microphone pipe; null until the session ran. */
let micHelperStarts: string[] | null = null;
/** How the device list of that development Core marks its four TEST sources (`<id> <adapter> <sourceClass>`); null until it was read. */
let testSourceMarks: string[] | null = null;

describe('the schema this row was written against', () => {
  it('schema version 7, contract dbc-8', async () => {
    const meta = (await db.ownerPool().query('SELECT schema_version, contract_revision FROM public.schema_meta')).rows[0] as { schema_version: number; contract_revision: string };
    expect([Number(meta.schema_version), meta.contract_revision]).toEqual([7, 'dbc-8']);
  });
});

describe('M5-LOCAL-E2E-1 (Core half, scripted helpers): a development session on this Mac\'s camera and microphone plus the two test sources', () => {
  it('starts through the product registry: four source rows of the two development kinds, the plan names the local devices, each camera helper pushes to its own loopback listener; durable; "is on" follows; a clean stop closes every source', async () => {
    const of = await rig('r140_local');
    // The Core's device list (op 77) holds the two local devices beside the built-ins, each LOCAL one with its adapter and class.
    const listed = of.app.engine.slice('captureDevices').devices.filter((device) => device.kind !== 'POE');
    expect(listed.map((device) => device.id)).toEqual(['CAM-01', 'CAM-02', 'CAM-03', 'MIC-01', 'MIC-02', 'MIC-03']);
    expect(listed.filter((device) => device.id.endsWith('-03')).map((device) => `${device.id} ${device.adapter} ${device.sourceClass} ${device.online}`)).toEqual(['CAM-03 LOCAL_DEVICE DEVELOPMENT true', 'MIC-03 LOCAL_DEVICE DEVELOPMENT true']);
    testSourceMarks = listed.filter((device) => !device.id.endsWith('-03')).map((device) => `${device.id} ${device.adapter} ${device.sourceClass}`);
    const id = await of.arm();
    // Nothing is on before the start: arming opened no source (the pre-check of this rig asks no adapter).
    expect(of.built.openSources()).toEqual([]);
    expect(of.scripted.calls).toEqual([]);
    // Pass D11: the slice the clients read says the same - no device carries `sourceOpen` after a boot (CONTROL of the "on" below).
    expect(await of.sliceOn()).toEqual([]);
    await of.start(id);

    // MR-S1 / M5-SRC-REC-1: four rows, each with the kind of the device that feeds the slot.
    expect((await of.owner.query('SELECT slot, device_id, adapter_kind FROM public.session_capture_sources WHERE session_id = $1 ORDER BY slot', [id])).rows).toEqual([
      { slot: 'MIC-PRIMARY', device_id: 'MIC-03', adapter_kind: 'LOCAL_DEVICE' },
      { slot: 'MIC-STANDBY', device_id: 'MIC-02', adapter_kind: 'FAKE' },
      { slot: 'VIDEO-01', device_id: 'CAM-03', adapter_kind: 'LOCAL_DEVICE' },
      { slot: 'VIDEO-02', device_id: 'CAM-02', adapter_kind: 'FAKE' },
    ]);
    const session = of.app.engine.slice('session');
    expect(session).toMatchObject({ id, state: 'RECORDING', captureDurable: false });
    // The session carries its own selector snapshot, and its audio source is the local microphone (D133 (1): any `MIC-NN`).
    expect(session?.captureConfig?.cameras.map((camera) => [camera.trackId, camera.deviceId])).toEqual([['VIDEO-01', 'CAM-03'], ['VIDEO-02', 'CAM-02']]);
    expect(session?.audioSource).toMatchObject({ activeInputId: 'MIC-03', standbyInputId: 'MIC-02' });

    // ONE worker, ONE START, with the plan of the builder: the local devices by their own ids, each microphone a pipe below the run directory.
    expect(of.fake.calls()).toBe(1);
    const starts = of.fake.last().commands('START');
    expect(starts).toHaveLength(1);
    expect(starts[0]).toMatchObject({ v: CAPTURE_PROTOCOL_VERSION, sessionId: id, attempt: 1 });
    expect(starts[0]?.plan.cameras.map((camera) => [camera.deviceId, camera.trackId, camera.ingestUrl])).toEqual([
      ['CAM-03', 'VIDEO-01', `rtsp://127.0.0.1:8554/${id}/video-01`],
      ['CAM-02', 'VIDEO-02', `rtsp://127.0.0.1:8556/${id}/video-02`],
    ]);
    // The microphone lines keep the selector's input order (ascending input ID); the role is a member of the line.
    expect(starts[0]?.plan.mics.map((mic) => [mic.deviceId, mic.role, mic.input.kind])).toEqual([['MIC-02', 'STANDBY', 'PCM_FIFO'], ['MIC-03', 'PRIMARY', 'PCM_FIFO']]);
    const pipes = (starts[0]?.plan.mics ?? []).map((mic) => (mic.input as { path?: string }).path ?? '');
    expect(pipes.every((path) => path.startsWith(`${fixture.dataDir}/run/capture/${id}/`))).toBe(true);
    expect(of.events.map((event) => event.type)).toEqual(['CONNECTING', 'STARTED']);
    expect(of.events[1]).toMatchObject({ cameras: ['CAM-03', 'CAM-02'], camerasNotOpened: [] });

    // The helpers, as the door was asked: the local camera by its exact listed name toward port 8554,
    // the test camera a generated picture toward port 8556. Never the other's input.
    const pushes = of.scripted.pushes();
    const cameraPushes = pushes.filter((call) => call.args.some((arg) => arg.startsWith('rtsp://127.0.0.1:')));
    expect(cameraPushes).toHaveLength(2);
    const [local, generated] = cameraPushes;
    expect(local?.args).toContain('MacBook Air Camera:none');
    expect(local?.args).toContain(`rtsp://127.0.0.1:8554/${id}/video-01`);
    expect(local?.args.join(' ')).not.toMatch(/testsrc2/);
    expect(generated?.args).toContain('testsrc2=size=1280x720:rate=30,realtime,settb=1/1000000');
    expect(generated?.args).toContain(`rtsp://127.0.0.1:8556/${id}/video-02`);
    expect(generated?.args.join(' ')).not.toMatch(/avfoundation|MacBook/);
    // Every helper call carries an empty environment and nothing but loopback.
    expect(pushes.every((call) => Object.keys(call.env ?? {}).length === 0)).toBe(true);
    micHelperStarts = pushes.filter((call) => call.args.some((arg) => pipes.includes(arg))).map((call) => call.args.find((arg) => pipes.includes(arg)) ?? '');

    // "Is on" (SEC35-44 (4)): this Mac's microphone from its prepared pipe, this Mac's camera from its helper. The test sources never.
    expect([...of.built.openSources()].sort()).toEqual(['CAM-03', 'MIC-03']);
    expect(of.on).toEqual([['MIC-03'], ['CAM-03', 'MIC-03']]);
    // Pass D11: and so does slice `captureDevices` - `sourceOpen` on this Mac's two devices, on no test source (C3 §2.6: never for another kind).
    expect(await of.sliceOn()).toEqual(['CAM-03', 'MIC-03']);

    // Durable: the interval of the start names the local microphone, the first fragment makes the session 'recording'.
    const worker = of.fake.last();
    worker.record(startInterval);
    worker.firstDurableFragment('CAM-03');
    await of.settled();
    expect(of.app.engine.slice('session')).toMatchObject({ state: 'RECORDING', captureDurable: true });
    expect(of.events.map((event) => event.type)).toEqual(['CONNECTING', 'STARTED', 'DURABLE']);
    expect((await of.owner.query('SELECT seq, mic_device_id, role, reason FROM public.session_audio_intervals WHERE session_id = $1', [id])).rows).toEqual([{ seq: 1, mic_device_id: 'MIC-03', role: 'PRIMARY', reason: 'START' }]);

    // The stop: the worker first, then every source handle; nothing is on afterwards, every living helper was signalled, the pipes are gone.
    worker.record({ kind: 'AUDIO_TIMELINE_END', samples: 480_000, sampleRateHz: 48_000, intervals: 1 });
    await of.stop(id);
    expect(worker.commands('STOP')).toHaveLength(1);
    expect(of.events.at(-1)).toMatchObject({ type: 'STOPPED', sessionId: id });
    expect(of.events.at(-1)).toMatchObject({ files: [{ trackId: 'VIDEO-01', deviceId: 'CAM-03' }, { trackId: 'VIDEO-02', deviceId: 'CAM-02' }] });
    expect(of.built.openSources()).toEqual([]);
    expect(of.on.at(-1)).toEqual([]);
    // Pass D11: the stop cleared the member in the slice; the class of every source is still said.
    expect(await of.sliceOn()).toEqual([]);
    expect(of.app.engine.slice('captureDevices').devices.filter((device) => device.kind !== 'POE').map((device) => device.sourceClass)).toEqual(Array.from({ length: 6 }, () => 'DEVELOPMENT'));
    expect(sessionCapture(of.app).liveSessionId()).toBeNull();
    const living = of.scripted.ffmpeg.filter((process) => process.signals.length > 0);
    expect(living.every((process) => !process.alive())).toBe(true);
    expect(of.scripted.ffmpeg.some((process) => process.alive())).toBe(false);
    const { existsSync } = await import('node:fs');
    expect(pipes.map((path) => existsSync(path))).toEqual([false, false]);
  });

  // FOUND BY THIS ROW, FIXED BY ROW 71c (request of 16:28:30Z in `delegation_progress/file_requests.md`):
  // `AudioInputAdapter.open` only PREPARES the pipe; the helper is launched by `stream.start()`, which
  // the session wiring calls once the worker accepted the plan (`mic-helper.ts`, ML-5). Until row 71c's
  // line no production code called it and a session recorded with no microphone samples (this case was
  // `it.fails` and ran red-as-expected; it is a plain check since the line landed).
  it('the helper of each microphone of the plan is started when the worker accepted the plan (local microphone and test source)', () => {
    // The session of the case above ran: both pipes of its plan were written to by a helper of their own.
    expect(micHelperStarts).not.toBeNull();
    expect(micHelperStarts).toHaveLength(2);
    expect(new Set(micHelperStarts).size).toBe(2);
  });
});

describe('the development mark of the TEST sources in the device list of a development Core', () => {
  // FOUND BY ROW 140, CLOSED BY INTEGRATION PASS D11: the slice mapping gives `adapter` /
  // `sourceClass` to every device EXCEPT the built-in ids (`db/mapping/rows.ts`, the
  // `BUILT_IN_CAPABILITIES` exception - right for a SIMULATED Core, D91). In REAL_DEVELOPMENT those
  // four ARE the test sources that feed the worker (kind `FAKE`, D74(2)): the devices module hands
  // the engine the kind the registry of the running operation holds for them
  // (`modules/devices/source-facts.ts` -> the fact door `applyCaptureSourceFacts`), once after the
  // boot. This case was `it.fails` until then. The CONTROL (a SIMULATED Core says nothing of the
  // class of a built-in) is `modules/devices/__tests__/source-class.db.test.ts`.
  it('CAM-01, CAM-02, MIC-01 and MIC-02 are listed with adapter FAKE and class DEVELOPMENT', () => {
    // The marks were read in the session case above, right after the boot of that Core.
    expect(testSourceMarks).not.toBeNull();
    expect(testSourceMarks).toEqual(['CAM-01 FAKE DEVELOPMENT', 'CAM-02 FAKE DEVELOPMENT', 'MIC-01 FAKE DEVELOPMENT', 'MIC-02 FAKE DEVELOPMENT']);
  });
});

describe('known state (a), D128: the local microphone at the limit of the rate controller is SAID, never hidden', () => {
  it('telemetry with the rate at the limit is a notice naming MIC-03; the worker\'s warning raises the NAMED advisory alert `MIC_RATE_AT_LIMIT` on MIC-03 - no fault, no source switch - and its CLEARED resolves it', async () => {
    const of = await rig('r140_rate');
    const id = await of.arm();
    await of.start(id);
    const worker = of.fake.last();
    worker.record(startInterval);
    worker.firstDurableFragment('CAM-03');
    await of.settled();

    // 1. The level telemetry of protocol 4: the rate correction of the local microphone held at -5,000 ppm.
    worker.say({
      type: 'TELEMETRY',
      levels: [
        { deviceId: 'MIC-03', role: 'PRIMARY', dbfs: -28, clipped: false, ratePpm: -5_000 },
        { deviceId: 'MIC-02', role: 'STANDBY', dbfs: -20, clipped: false, ratePpm: 12 },
      ],
      ingest: [],
      fragments: [],
      clocks: [],
      tapActive: false,
    });
    await of.settled();
    expect(of.notices.map((notice) => [notice.code, notice.deviceId, notice.value, notice.bound])).toEqual([['CAPTURE_MIC_RATE_AT_LIMIT', 'MIC-03', -5_000, 5_000]]);

    const captureFaults = (): Array<string | null> => of.app.engine.slice('faults').active.filter((fault) => fault.kind === 'CAPTURE_FAULT').map((fault) => fault.target);
    const named = () => of.app.engine.slice('alerts').filter((alert) => alert.kind === 'SYSTEM' && alert.params?.['reason'] === 'MIC_RATE_AT_LIMIT');
    const written = async (): Promise<void> => {
      await of.settled();
      await new Promise((resolve) => setTimeout(resolve, 300));
      await engineControl(of.app).idle();
    };
    const sourceBefore = structuredClone(of.app.engine.slice('session')?.audioSource);
    expect(named()).toEqual([]);

    // 2. The worker's own warning (code CAPTURE_FAULT, reason MIC_RATE_AT_LIMIT). The rule since pass D9 (item 6; ruling
    //    D144 (4)): it is ADVICE - the forwarder raises the named advisory alert on that microphone, and NOT a bare capture fault.
    worker.warning('CAPTURE_FAULT', 'MIC-03', 'ACTIVE', 'MIC_RATE_AT_LIMIT');
    await written();
    expect(named().filter((alert) => alert.active).map((alert) => [alert.target, alert.severity, alert.message, alert.params?.['deviceId'], alert.params?.['sessionId']])).toEqual([['MIC-03', 'INFO', 'MIC-03: rate correction is at its limit', 'MIC-03', id]]);
    expect(captureFaults()).toEqual([]);
    // The limit is said, it stops nothing - and it NEVER switches the source (OD-11): the active input is the local microphone, the worker got no switch.
    expect(of.app.engine.slice('session')).toMatchObject({ state: 'RECORDING', captureDurable: true });
    expect(of.app.engine.slice('session')?.audioSource).toEqual(sourceBefore);
    expect(of.app.engine.slice('session')?.audioSource?.activeInputId).toBe('MIC-03');
    expect(worker.commands('SWITCH_AUDIO_SOURCE')).toEqual([]);
    // Said again while it holds: still ONE alert.
    worker.warning('CAPTURE_FAULT', 'MIC-03', 'ACTIVE', 'MIC_RATE_AT_LIMIT');
    await written();
    expect(named().filter((alert) => alert.active)).toHaveLength(1);

    // 3. The condition is over: the worker's CLEARED resolves that alert; none is active, the one that was raised is kept as resolved.
    worker.warning('CAPTURE_FAULT', 'MIC-03', 'CLEARED', 'MIC_RATE_AT_LIMIT');
    await written();
    expect(named().filter((alert) => alert.active)).toEqual([]);
    expect(named().map((alert) => [alert.target, alert.active])).toEqual([['MIC-03', false]]);
    expect(of.app.engine.slice('session')?.audioSource).toEqual(sourceBefore);

    // CONTROL (the fault reader can see one): the SAME warning without the advisory reason is a capture fault on that microphone, and no named alert.
    worker.warning('CAPTURE_FAULT', 'MIC-03', 'ACTIVE');
    await written();
    expect(captureFaults()).toEqual(['MIC-03']);
    expect(named().filter((alert) => alert.active)).toEqual([]);
    // CONTROL: the named notice for a CAMERA is refused by the engine - it is the microphone's notice.
    await expect(of.app.engine.raiseCaptureWarning({ code: 'MIC_RATE_AT_LIMIT', subject: 'CAM-03' })).rejects.toThrow();

    worker.record({ kind: 'AUDIO_TIMELINE_END', samples: 96_000, sampleRateHz: 48_000, intervals: 1 });
    await of.stop(id);
    expect(of.built.openSources()).toEqual([]);
  });
});
