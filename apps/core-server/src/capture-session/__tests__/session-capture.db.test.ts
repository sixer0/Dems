// The capture of a session, on PostgreSQL as `dems_app`, in capture mode `real` (blueprint row 71,
// Core half; checks of the row: a start calls `app.capture.start` exactly once with row 66's plan,
// a stop calls `stop`, M5-SRC-REC-1 (the four source rows and the class refusal), the durable rule
// of D84, the fault life cycle through the real forwarder and the real engine, operation 81).
//
// WHAT IS REAL: the app factory and its boot (the fence in REAL_DEVELOPMENT, the capture boot checks
// on row 61's fixture), the engine host, the pipeline and its audit chain, the real supervisor and
// the real forwarder, the plan builder, the source-row builder, the fragment recorder.
// WHAT STANDS IN: the worker is the `FakeWorkerProcess` (the seam the row names); the devices are
// the fake adapters of the adapter layer in a registry of the same operation. No process records,
// no port is bound, no device is opened.
import { CAPTURE_PROTOCOL_VERSION, type AudioSourceIntervalRecord, type CaptureRecord } from '@dems/capture-protocol';
import { mkdirSync, readdirSync } from 'node:fs';
import type { Pool } from 'pg';
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import { useTestDatabase } from '../../../test/helpers/db';
import { fakeLauncher, flush, type FakeLauncher } from '../../../test/support/capture';
import { captureLog, unitTestConfig } from '../../../test/support/config';
import { createManualClock } from '@dems/shared/sim';
import { FIXED_NOW, TICK_MS, manualTimer } from '../../../test/support/engine';
import { buildApp } from '../../app';
import { CaptureOperation, createCaptureDeviceRegistry, type CaptureDeviceRegistry, type SourceHandle } from '../../capture/adapters';
import { createFakeAudioInputAdapter, createFakeCameraAdapter } from '../../capture/adapters/fake';
import { realBootFixture } from '../../capture/boot/__tests__/support';
import { captureFenceControl } from '../../capture/fence';
import { createCaptureSupervisor, createSystemTimers, forwardCaptureEvents, type CaptureSupervisor } from '../../capture';
import { captureDoorsOf, engineControl } from '../../engine';
import type { Principal } from '../../plugins/authenticate';
import { ApiFailure } from '../../plugins/error-envelope';
import { sessionTapPath, transcriptionControl } from '../../transcription';
import { FIRST_DELIVERY_MS } from '../../capture/adapters/local/camera-helper';
import { CAMERA_CLOCK_OFFSET_ADVISORY_MS, CAPTURE_NOT_DURABLE, MIC_START_BOUND_MS, RELAY_REPORTS_NOT_WIRED,SESSION_LEFT_RECORDING, SOURCE_KIND_NOT_RECORDABLE, readSessionCaptureFacts, sessionCapture, type SessionCaptureEvent } from '../index';

const db = useTestDatabase({ template: 'seed' });
/** The rigs of the running case: closed by the `afterEach` below (see `fixRig`). */
const openRigs: Rig[] = [];
/** The database of a rig: its pools are ended with the rig (`closeResources`), and since fix I-7b the database itself is DROPPED with it, after the case (the `afterEach` below). */
const rigDatabases = new WeakMap<Rig, { closeResources(): Promise<string[]>; drop(): Promise<void> }>();
const fixture = realBootFixture('row71b');
fixture.provisionKey();
afterAll(() => fixture.remove());

const SHA = (seed: string): string => seed.repeat(64).slice(0, 64);
/** Task 4 row 47: the random element of an ingest address (16 bytes as URL-safe base64), and where it stands. */
const INGEST_ELEMENT = /^[A-Za-z0-9_-]{22}$/;
const elementOf = (address: string): string => address.slice(address.lastIndexOf('/') + 1);
/**
 * Task 4 row 48, ruling C34: a `REAL_PRODUCTION` start is refused without a source of relay reports. The cases that put
 * the production operation over the fake adapters for ANOTHER subject hand in this one, which never reports: under
 * ruling C35 (a) a camera nobody reports for is no fault, so those cases run as before.
 */
const SILENT_RELAYS = { subscribe: () => () => undefined };
const GENESIS ='e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';

interface Rig {
  readonly app: ReturnType<typeof buildApp>;
  readonly owner: Pool;
  readonly fake: FakeLauncher;
  readonly supervisor: CaptureSupervisor;
  readonly registry: CaptureDeviceRegistry;
  readonly events: SessionCaptureEvent[];
  /** What happened to the sources and the worker, in order: `open MIC-01`, `STOP`, `close CAM-01`, ... */
  readonly order: string[];
  /** The source handles the unit opened, as it holds them. */
  readonly handles: SourceHandle[];
  /** What the unit told the transcriber session of a recording, in order: `begin <id>`, `end <id> recorded`, `end <id> nothing`. */
  readonly transcriber: string[];
  readonly investigator: Extract<Principal, { kind: 'OPERATOR' }>;
  /** Everything the app logged, as its lines (task 4 row 47: searched for the ingest address). */
  readonly log: ReturnType<typeof captureLog>;
  drive(ms: number): Promise<void>;
  /** Idle -> ARMED through hosted commands; returns the session ID. */
  arm(): Promise<string>;
  /** The start as the route makes it: the hosted action and the capture hook in ONE unit, then the commit hook. */
  start(sessionId: string): Promise<void>;
  /** Waits until the background work of the unit and the reactions of the fakes have ended. */
  settled(): Promise<void>;
  rows<Row>(text: string, values?: readonly unknown[]): Promise<Row[]>;
}

let caseSeq = 0;

async function rig(
  slug: string,
  options: {
    registry?: (built: CaptureDeviceRegistry) => CaptureDeviceRegistry | null;
    fileExists?: (path: string) => Promise<boolean>;
    /** Row 71c: STT is switched ON in the stored configuration after the boot, and the plan takes the tap path of the transcription unit. */
    sttEnabled?: boolean;
    /** Row 71c: what each fake camera's adapter reports as its clock offset. */
    clockOffsets?: Readonly<Record<string, number>>;
    /** Fix pass F-M5: limits of the supervisor (a short acknowledgement time for the late-acknowledgement case). */
    limits?: Record<string, number>;
    /** Fix pass F-M5: how the fake worker behaves beyond the rig's default (a stop that is not clean). */
    worker?: Parameters<typeof fakeLauncher>[0];
  } = {},
): Promise<Rig> {
  const target = await db.another({ template: 'seed', slug });
  const owner = target.ownerPool();
  // No speech runtime on a test host: the transcriber is not the subject here.
  await owner.query('UPDATE public.stt_config SET enabled = false');
  const worker = fixture.worker(`worker-${slug}`, 'capture-worker/0.4.0');
  const log = captureLog();
  const app = buildApp({
    config: unitTestConfig({
      database: target.runtime,
      dataDir: fixture.dataDir,
      mediaStoreDir: fixture.mediaStoreDir,
      logLevel: 'info',
      captureMode: 'real',
      demoControls: false,
      captureDevSources: true,
      captureHelperFfmpegPath: '/bin/echo',
      captureWorkerPath: worker,
    }),
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
  expect(captureFenceControl(app).operation).toBe(CaptureOperation.REAL_DEVELOPMENT);

  // The worker seam: the real supervisor on the fake worker, forwarded to the real engine as the capture unit does.
  // A switch is acknowledged by the test, after the record the worker writes for it.
  const fake = fakeLauncher({ ackSwitch: false, ...options.worker });
  const order: string[] = [];
  const handles: SourceHandle[] = [];
  const supervisor = createCaptureSupervisor({ now: () => app.clock.now(), timers: createSystemTimers(), launcher: fake.launcher, ...(options.limits === undefined ? {} : { limits: options.limits }) });
  await supervisor.boot();
  app.seams.replace('capture', supervisor);
  forwardCaptureEvents({
    capture: supervisor,
    engine: () => ({
      applyCaptureTelemetry: (telemetry) => app.engine.applyCaptureTelemetry(telemetry),
      raiseCaptureWarning: (warning) => app.engine.raiseCaptureWarning(warning),
      clearCaptureWarning: (warning) => app.engine.clearCaptureWarning(warning),
      clearCaptureFaults: () => captureDoorsOf(app.engine).clearCaptureFaults(),
    }),
    report: () => {},
    now: () => app.clock.now(),
  });
  target.onCleanup(() => supervisor.shutdown());

  // The devices: fake adapters behind the four built-ins, in a registry of the running operation.
  const built = createCaptureDeviceRegistry({ operation: CaptureOperation.REAL_DEVELOPMENT });
  /** A handle that says when it is closed, and behaves as a real source does: a camera that stops while the worker records is a lost camera. */
  const watched = <Handle extends SourceHandle>(handle: Handle): Handle => {
    order.push(`open ${handle.deviceId}`);
    const close = handle.close.bind(handle);
    const seen = Object.freeze({
      ...handle,
      async close(): Promise<void> {
        order.push(`close ${handle.deviceId}`);
        const live = fake.workers.at(-1);
        if (handle.deviceId.startsWith('CAM') && live !== undefined && !live.exited && live.commands('STOP').length === 0) live.warning('CAPTURE_FAULT', handle.deviceId, 'ACTIVE', 'CAMERA_STREAM_ENDED');
        await close();
      },
    });
    handles.push(seen);
    return seen;
  };
  for (const id of ['CAM-01', 'CAM-02']) {
    const offset = options.clockOffsets?.[id];
    const camera = createFakeCameraAdapter({ id, ...(offset === undefined ? {} : { ntpOffsetMs: offset }) });
    built.register({ ...camera, openSource: async (deviceId, to, signal) => watched(await camera.openSource(deviceId, to, signal)) });
  }
  for (const id of ['MIC-01', 'MIC-02']) {
    const mic = createFakeAudioInputAdapter({ id, runDir: `${fixture.dataDir}/run/capture` });
    built.register({ ...mic, open: async (inputId, to) => watched(await mic.open(inputId, to)) });
  }
  const registry = options.registry === undefined ? built : options.registry(built);
  const capture = sessionCapture(app);
  // The transcriber session is a recording double: no engine, no model and no STT server is touched by this file.
  const transcriber: string[] = [];
  if (options.sttEnabled === true) await owner.query('UPDATE public.stt_config SET enabled = true');
  capture.replace({
    registry: () => registry,
    leftoverHelpers: async () => [],
    // Enabled: the tap path is the transcription unit's own answer for the session's stored snapshot.
    tapPathFor: options.sttEnabled === true ? (sessionId) => transcriptionControl(app).tapPathFor(sessionId) : async () => null,
    // The background check of the backend is not this file's subject and is not made (no request leaves the process).
    startCommitted: () => {},
    transcriber: {
      begin: async (sessionId) => void transcriber.push(`begin ${sessionId}`),
      end: (sessionId, how) => void transcriber.push(`end ${sessionId} ${how.recorded ? 'recorded' : 'nothing'}`),
    },
    ...(options.fileExists === undefined ? {} : { fileExists: options.fileExists }),
  });
  const events: SessionCaptureEvent[] = [];
  capture.on((event) => void events.push(event));
  supervisor.on('phase', (event) => {
    if (event.phase === 'STOPPING') order.push('STOP');
  });

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
    for (let round = 0; round < 4; round += 1) {
      await flush();
      await capture.idle();
    }
  };

  const made: Rig = {
    app,
    owner,
    fake,
    supervisor,
    registry: built,
    events,
    order,
    handles,
    transcriber,
    investigator,
    log,
    drive,
    settled,
    async arm() {
      caseSeq += 1;
      await app.engine.setTabletLink('CONNECTED');
      const created = await app.engine.command(investigator, 'createSession', { caseNumber: `LP/2026/1001-07${String(caseSeq % 100).padStart(2, '0')}`, subjectType: 'SAKSI', subjectName: 'Test Subject', room: 'Interview Room 1', profileId: 'STANDARD_1080P25', investigatorId: investigator.operatorId });
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
    async rows<Row>(text: string, values: readonly unknown[] = []) {
      return (await owner.query(text, [...values])).rows as Row[];
    },
  };
  // Closed after the case (the `afterEach` below): the app, the supervisor and BOTH pools of this rig's database.
  openRigs.push(made);
  rigDatabases.set(made, target);
  return made;
}

const sourcesOf = (of: Rig, sessionId: string) => of.rows<{ slot: string; device_id: string; adapter_kind: string }>('SELECT slot, device_id, adapter_kind FROM public.session_capture_sources WHERE session_id = $1 ORDER BY slot', [sessionId]);
const faultRows = async (of: Rig): Promise<string[]> =>
  (await of.rows<{ type: string; details: { kind?: string; target?: string | null } }>("SELECT type, details FROM public.audit_log WHERE type IN ('FAULT_RAISED', 'FAULT_CLEARED') ORDER BY seq"))
    .filter((row) => row.details.kind === 'CAPTURE_FAULT' || row.details.kind === 'MIC_SILENT')
    .map((row) => `${row.type} ${String(row.details.kind)}@${String(row.details.target)}`);
const evidenceCount = async (of: Rig): Promise<number> => Number((await of.rows<{ n: string }>('SELECT count(*) AS n FROM public.evidence_items'))[0]?.n);

const checkpoint = (index: number, start: number, chain: string, sha: string): CaptureRecord => ({
  kind: 'FRAGMENT_CHECKPOINT',
  deviceId: 'CAM-01',
  index,
  start,
  len: 1_000,
  fragSha256: sha,
  chainSha256: chain,
  prefixSha256: SHA('c'),
  plaintextSha256: sha,
  plaintextChainSha256: chain,
  mediaStartMs: (index - 1) * 2_000,
  mediaDurationMs: 2_000,
  keyframe: true,
  durableAt: FIXED_NOW,
  gcmIv: null,
  gcmTag: null,
  keyId: null,
});

const startInterval: AudioSourceIntervalRecord = { kind: 'AUDIO_SOURCE_INTERVAL', deviceId: 'MIC-01', role: 'PRIMARY', index: 1, fromSample: 0, sampleRateHz: 48_000, capturedAtMs: FIXED_NOW, reason: 'SESSION_START', correlationId: null, appliedDelayUs: null };

describe('a real recording: start, the first durable fragment, the switch, the stop', () => {
  it('the start writes the four source rows with RECORDING, says "connecting", calls capture.start ONCE with the plan of row 66; durable only from the first fragment; a clean stop raises no fault', async () => {
    const of = await rig('r71b_flow');
    const id = await of.arm();
    await of.start(id);

    // MR-S1: four rows, of the class of the running operation, stored with RECORDING.
    expect(await sourcesOf(of, id)).toEqual([
      { slot: 'MIC-PRIMARY', device_id: 'MIC-01', adapter_kind: 'FAKE' },
      { slot: 'MIC-STANDBY', device_id: 'MIC-02', adapter_kind: 'FAKE' },
      { slot: 'VIDEO-01', device_id: 'CAM-01', adapter_kind: 'FAKE' },
      { slot: 'VIDEO-02', device_id: 'CAM-02', adapter_kind: 'FAKE' },
    ]);
    // D84 / D91 R-1: the stored state is RECORDING, the payload says the capture is not durable yet.
    expect(of.app.engine.slice('session')).toMatchObject({ id, state: 'RECORDING', captureDurable: false });

    // D72(l): exactly one worker, one START, with the plan of the builder: device IDs as subjects, the track only as the output name.
    expect(of.fake.calls()).toBe(1);
    const starts = of.fake.last().commands('START');
    expect(starts).toHaveLength(1);
    expect(starts[0]).toMatchObject({ v: CAPTURE_PROTOCOL_VERSION, sessionId: id, attempt: 1 });
    // Task 4 row 47: the address of a track is the listener of that track, the session, the track, and one random element after them.
    expect(starts[0]?.plan.cameras.map((camera) => [camera.deviceId, camera.trackId, camera.ingestUrl.slice(0, camera.ingestUrl.lastIndexOf('/'))])).toEqual([
      ['CAM-01', 'VIDEO-01', `rtsp://127.0.0.1:8554/${id}/video-01`],
      ['CAM-02', 'VIDEO-02', `rtsp://127.0.0.1:8556/${id}/video-02`],
    ]);
    expect(starts[0]?.plan.cameras.map((camera) => INGEST_ELEMENT.test(elementOf(camera.ingestUrl)))).toEqual([true, true]);
    expect(starts[0]?.plan.cameras.every((camera) => camera.outputPath.startsWith(`${fixture.mediaStoreDir}/SESSION-${id}/`))).toBe(true);
    expect(starts[0]?.plan.mics.map((mic) => [mic.deviceId, mic.role])).toEqual([['MIC-01', 'PRIMARY'], ['MIC-02', 'STANDBY']]);
    // The microphones are opened before the plan, the cameras only when the worker listens.
    expect(of.order).toEqual(['open MIC-01', 'open MIC-02', 'open CAM-01', 'open CAM-02']);
    expect(of.events.map((event) => event.type)).toEqual(['CONNECTING', 'STARTED']);

    // The interval of the start and the first fragment.
    const worker = of.fake.last();
    worker.record(startInterval);
    worker.firstDurableFragment('CAM-01');
    await of.settled();
    expect(of.app.engine.slice('session')).toMatchObject({ state: 'RECORDING', captureDurable: true });
    expect(of.events.map((event) => event.type)).toEqual(['CONNECTING', 'STARTED', 'DURABLE']);

    // The recorder of row 59 is mounted: a checkpoint is a fragment row.
    const sha = SHA('a');
    const chain = (await of.rows<{ chain: string }>("SELECT encode(sha256(decode($1, 'hex') || decode($2, 'hex')), 'hex') AS chain", [GENESIS, sha]))[0]?.chain ?? '';
    worker.record(checkpoint(1, 1_231, chain, sha));
    await of.settled();
    expect(await of.rows('SELECT track_id, seq, byte_offset::int AS byte_offset FROM public.recording_fragments WHERE session_id = $1', [id])).toEqual([{ track_id: 'VIDEO-01', seq: 1, byte_offset: 1_231 }]);

    // Operation 81: the command, then the record, then the acknowledgement; one unit holds the state, the rows and the audit row.
    const switching = sessionCapture(of.app).switchAudioSource(of.investigator, id, 'MIC-02');
    await flush();
    const command = worker.commands('SWITCH_AUDIO_SOURCE')[0];
    expect(command).toMatchObject({ to: 'STANDBY' });
    worker.record({ ...startInterval, deviceId: 'MIC-02', role: 'STANDBY', index: 2, fromSample: 240_000, capturedAtMs: FIXED_NOW + 5_000, reason: 'OPERATOR_SWITCH', correlationId: command?.correlationId ?? null, appliedDelayUs: 9_000 });
    worker.ack(true, undefined, command);
    // file time = (240,000 + 1,024) samples = 5,021 ms
    await expect(switching).resolves.toMatchObject({ sessionId: id, activeInputId: 'MIC-02', standbyInputId: 'MIC-01', intervalFromMs: 5_021 });
    expect(await of.rows('SELECT seq, mic_device_id, role, from_media_ms::int AS from_ms, to_media_ms::int AS to_ms, switched_by, reason FROM public.session_audio_intervals WHERE session_id = $1 ORDER BY seq', [id])).toEqual([
      { seq: 1, mic_device_id: 'MIC-01', role: 'PRIMARY', from_ms: 21, to_ms: 5_021, switched_by: null, reason: 'START' },
      { seq: 2, mic_device_id: 'MIC-02', role: 'STANDBY', from_ms: 5_021, to_ms: null, switched_by: of.investigator.operatorId, reason: 'MANUAL' },
    ]);
    const switched = await of.rows<{ actor_id: string; device_id: string | null; details: Record<string, unknown> }>("SELECT actor_id, device_id, details FROM public.audit_log WHERE type = 'AUDIO_SOURCE_SWITCHED'");
    expect(switched).toHaveLength(1);
    // C3 §5.2: exactly these keys (a web console session names no sending device).
    expect(Object.keys(switched[0]?.details ?? {}).sort()).toEqual(['fromInput', 'fromMs', 'toInput', 'toMs']);
    expect(switched[0]).toMatchObject({ actor_id: of.investigator.operatorId, device_id: null, details: { fromInput: 'MIC-01', toInput: 'MIC-02', fromMs: 21, toMs: 5_021 } });
    // Asking for the input that is active already changes and writes nothing.
    await expect(sessionCapture(of.app).switchAudioSource(of.investigator, id, 'MIC-02')).resolves.toMatchObject({ activeInputId: 'MIC-02' });
    expect(worker.commands('SWITCH_AUDIO_SOURCE')).toHaveLength(1);

    // The stop: the worker is told FIRST; the sources are closed only after it has exited.
    worker.record({ kind: 'AUDIO_TIMELINE_END', samples: 480_000, sampleRateHz: 48_000, intervals: 2 });
    await of.app.engine.run('sessions.stopSession', async (scope) => {
      sessionCapture(of.app).stopRequestedIn(scope, id);
      await scope.command(of.investigator, 'stopRecording', 'End of the interview');
    });
    sessionCapture(of.app).afterStopCommitted(id);
    await of.settled();
    expect(worker.commands('STOP')).toHaveLength(1);
    expect(of.order.slice(4)).toEqual(['STOP', 'close MIC-01', 'close MIC-02', 'close CAM-01', 'close CAM-02']);
    expect(of.events.at(-1)).toMatchObject({ type: 'STOPPED', sessionId: id, fragmentRowsBehind: [] });
    expect(sessionCapture(of.app).liveSessionId()).toBeNull();
    // A clean stop writes no capture fault and no fault audit row (the control below shows that the
    // same rig DOES write one, within this time, when a source is closed first).
    await new Promise((resolve) => setTimeout(resolve, 500));
    expect(await faultRows(of)).toEqual([]);
    expect(of.app.engine.slice('faults').active.filter((fault) => fault.kind === 'CAPTURE_FAULT')).toEqual([]);
    // The last interval is closed at the end of the audio timeline: (480,000 + 1,024) samples = 10,021 ms.
    expect(await of.rows('SELECT to_media_ms::int AS to_ms FROM public.session_audio_intervals WHERE session_id = $1 AND seq = 2', [id])).toEqual([{ to_ms: 10_021 }]);
  });

  it('CONTROL of the stop order: a camera source closed BEFORE the worker was told to stop is a lost camera - one CAPTURE_FAULT and its audit row', async () => {
    const of = await rig('r71b_stop_control');
    const id = await of.arm();
    await of.start(id);
    of.fake.last().firstDurableFragment('CAM-01');
    await of.settled();
    // The order this unit must never produce: the source first, while the worker still records.
    await of.handles.find((handle) => handle.deviceId === 'CAM-02')?.close();
    await of.settled();
    expect(of.fake.last().commands('STOP')).toEqual([]);
    await vi.waitFor(async () => expect(await faultRows(of)).toEqual(['FAULT_RAISED CAPTURE_FAULT@CAM-02']), { timeout: 5_000 });
  });
});

describe('M5-SRC-REC-1: a start whose sources are not the running operation\'s is refused before anything opens', () => {
  it.each([
    ['no registry of the running operation', (): CaptureDeviceRegistry | null => null, 'NO_REGISTRY'],
    ['sources of another class than the operation records', (built: CaptureDeviceRegistry): CaptureDeviceRegistry => ({ ...built, operation: CaptureOperation.REAL_PRODUCTION }), 'CLASS_NOT_OF_OPERATION'],
    [
      'a source kind without an opener',
      (built: CaptureDeviceRegistry): CaptureDeviceRegistry => ({
        ...built,
        assertRecordable: (deviceId) => {
          if (deviceId === 'CAM-02') return built.assertRecordable('CAM-99');
          return built.assertRecordable(deviceId);
        },
      }),
      'NO_ADAPTER',
    ],
  ] as const)('%s: 409 INVALID_STATE / SOURCE_KIND_NOT_RECORDABLE, the session stays ARMED, no row, no worker, no source', async (_name, registry, cause) => {
    caseSeq += 10;
    const of = await rig(`r71b_refused_${caseSeq}`, { registry });
    const id = await of.arm();
    const refused = await of.start(id).then(
      () => null,
      (error: unknown) => error,
    );
    expect(refused).toBeInstanceOf(ApiFailure);
    expect(refused).toMatchObject({ statusCode: 409, code: 'INVALID_STATE', details: { reason: SOURCE_KIND_NOT_RECORDABLE, cause } });
    // Nothing of the start is stored: not the state, not a source row, not the audit row of a start.
    expect(of.app.engine.slice('session')).toMatchObject({ id, state: 'ARMED' });
    expect(await sourcesOf(of, id)).toEqual([]);
    expect(await of.rows("SELECT 1 FROM public.audit_log WHERE type = 'RECORDING_STARTED' AND session_id = $1", [id])).toEqual([]);
    expect(of.fake.calls()).toBe(0);
    expect(of.order).toEqual([]);
    expect(of.events).toEqual([]);
  });
});

// Batch N (final test report T100-02; ruling D241): `M5-SEC-SRC-1` was NOT PROVEN since the first M5 gate and no test
// cited it. THE PART A SUITE CAN HOLD is here: a registry of the PRODUCTION class whose four assigned devices are of the
// production kinds (ONVIF_RTSP, USB_AUDIO: no opener, D86 C-5) - the start is refused with the typed code BEFORE anything
// is opened. "No listener" is held as its cause: the only listener of a recording is the capture worker's (the Core's
// capture folder opens no socket: static rule G-R of `capture/__tests__/static.test.ts`), and NO worker was started and
// NO source was asked to open. WHAT STAYS LIVE-ONLY (not provable here, because this file's worker is a stand-in that
// binds no port, so a port check could not fail): the socket snapshot "0 listeners in 8554-8564" and the local push that
// finds the port closed, on a STARTED `REAL_PRODUCTION` Core with the BUILT worker - which cannot boot at HEAD (no command
// provisions a production signing key, S99-13; since batch N it also refuses the seed's operators, S99-01). Its negative
// control - the same push IS accepted in `REAL_DEVELOPMENT` - is the development-session e2e (`npm run test:dev-session-e2e`).
describe('M5-SEC-SRC-1 (the suite part): production-kind sources have no opener - the start is refused before a worker or a source exists', () => {
  it('four assigned devices of the kinds ONVIF_RTSP / USB_AUDIO in a registry of the production class: 409 SOURCE_KIND_NOT_RECORDABLE; 0 workers started, 0 sources asked to open, 0 source rows, 0 files added to the evidence volume; CONTROL: the same rig with the development registry records', async () => {
    const asked: string[] = [];
    const productionRegistry = (): CaptureDeviceRegistry => {
      const production = createCaptureDeviceRegistry({ operation: CaptureOperation.REAL_PRODUCTION });
      for (const id of ['CAM-01', 'CAM-02']) {
        production.register({ ...createFakeCameraAdapter({ id }), kind: 'ONVIF_RTSP', hasOpener: false, openSource: async (deviceId) => (asked.push(`open ${deviceId}`), Promise.reject(new Error('a production kind was asked to open'))) });
      }
      for (const id of ['MIC-01', 'MIC-02']) {
        production.register({ ...createFakeAudioInputAdapter({ id, runDir: `${fixture.dataDir}/run-m5-sec-src` }), kind: 'USB_AUDIO', hasOpener: false, open: async (inputId) => (asked.push(`open ${inputId}`), Promise.reject(new Error('a production kind was asked to open'))) });
      }
      // Nothing is recordable in a registry of this class today (erratum PE-128-48): the registry says so itself.
      expect(production.openerKinds()).toEqual([]);
      expect(production.list().map((device) => [device.id, device.adapterKind, device.hasOpener])).toEqual([['CAM-01', 'ONVIF_RTSP', false], ['CAM-02', 'ONVIF_RTSP', false], ['MIC-01', 'USB_AUDIO', false], ['MIC-02', 'USB_AUDIO', false]]);
      return production;
    };
    const of = await rig('r71b_m5secsrc_prod', { registry: productionRegistry });
    mkdirSync(fixture.mediaStoreDir, { recursive: true });
    // The fixture's evidence volume is shared by the cases of this file (each on a clone of the seed, so session ids
    // repeat): what counts is that THIS start adds nothing to it - the listing after is the listing before.
    const filesBefore = readdirSync(fixture.mediaStoreDir, { recursive: true }).map(String).sort();
    const id = await of.arm();
    const refused = await of.start(id).then(
      () => null,
      (error: unknown) => error,
    );
    expect(refused).toBeInstanceOf(ApiFailure);
    expect(refused).toMatchObject({ statusCode: 409, code: 'INVALID_STATE', details: { reason: SOURCE_KIND_NOT_RECORDABLE } });
    // No worker process: the only thing that would listen on an ingest port was never started. No source was asked to open.
    expect(of.fake.calls()).toBe(0);
    expect(asked).toEqual([]);
    expect(of.order).toEqual([]);
    expect(of.handles).toEqual([]);
    expect(of.events).toEqual([]);
    // Nothing of the start is stored, and no file of the session exists on the evidence volume.
    expect(of.app.engine.slice('session')).toMatchObject({ id, state: 'ARMED' });
    expect(await sourcesOf(of, id)).toEqual([]);
    expect(await of.rows("SELECT 1 FROM public.audit_log WHERE type = 'RECORDING_STARTED' AND session_id = $1", [id])).toEqual([]);
    expect(readdirSync(fixture.mediaStoreDir, { recursive: true }).map(String).sort()).toEqual(filesBefore);

    // CONTROL (the check can fail): the same rig with the registry of the running operation starts ONE worker and opens sources.
    const development = await rig('r71b_m5secsrc_dev');
    await development.start(await development.arm());
    await development.settled();
    expect(development.fake.calls()).toBe(1);
    expect(development.order.filter((entry) => entry.startsWith('open ')).length).toBeGreaterThan(0);
  });
});

describe('D84: nothing durable is a failed start, something durable is an interrupted recording', () => {
  it('no camera connected: the session FAULTS, nothing claims to have recorded, its recovery makes NO evidence item; every source is closed', async () => {
    const of = await rig('r71b_failed');
    const before = await evidenceCount(of);
    const id = await of.arm();
    await of.start(id);
    of.fake.last().say({ type: 'CRASH', code: 'NO_CAMERA_CONNECTED', signal: null, exitCode: null });
    await of.settled();
    expect(of.fake.calls()).toBe(1);
    expect(of.app.engine.slice('session')).toMatchObject({ id, state: 'FAULT', startedAt: null, bytesWritten: 0, captureDurable: false, fault: { kind: 'CAPTURE_FAULT', fromState: 'RECORDING' } });
    expect(of.events.at(-1)).toEqual({ type: 'FAILED_START', sessionId: id, cause: 'NO_CAMERA_CONNECTED', reason: 'NO_CAMERA_CONNECTED', evidenceFiles: 0 });
    // Row 71c, item 4 (b): the fault row of the session says the two keys of situation C (C3 §5.3).
    expect(of.app.engine.slice('session')?.timeline.at(-1)).toMatchObject({ kind: 'FAULT', params: { kind: 'CAPTURE_FAULT', durable: false, reason: 'NO_CAMERA_CONNECTED', evidenceFiles: 0 } });
    // ONE alert and ONE audit row for the fault of the capture as a whole, whichever of the two raises came first
    // (the forwarder's, or the failed-start unit's own). Its `params.reason` is `NO_CAMERA_CONNECTED` only when the
    // failed-start unit made the alert: a stored alert's params cannot be changed (the limit of the row's note).
    const alerts = of.app.engine.slice('alerts').filter((alert) => alert.kind === 'CAPTURE_FAULT' && alert.active);
    expect(alerts).toHaveLength(1);
    expect([undefined, 'NO_CAMERA_CONNECTED']).toContain(alerts[0]?.params?.['reason']);
    expect((await faultRows(of)).filter((row) => row.startsWith('FAULT_RAISED CAPTURE_FAULT'))).toHaveLength(1);
    console.info(`[row71c] failed start: the CAPTURE_FAULT alert ${alerts[0]?.params?.['reason'] === undefined ? 'holds NO reason (raised by the forwarder first)' : 'holds reason NO_CAMERA_CONNECTED'}`);
    expect(of.order.filter((entry) => entry.startsWith('close')).sort()).toEqual(['close CAM-01', 'close CAM-02', 'close MIC-01', 'close MIC-02']);
    expect(sessionCapture(of.app).liveSessionId()).toBeNull();
    // The recovery: a history entry, and no evidence item. The four source rows stay (MR-S1).
    await of.app.engine.command(of.investigator, 'recover');
    await of.drive(5_000);
    expect(of.app.engine.slice('session')).toBeNull();
    expect(await evidenceCount(of)).toBe(before);
    expect(await sourcesOf(of, id)).toHaveLength(4);
  });

  it('CONTROL: the same loss AFTER the first durable fragment is an interrupted recording - the session keeps what it recorded and the sealing row is told', async () => {
    const of = await rig('r71b_interrupted');
    const id = await of.arm();
    await of.start(id);
    of.fake.last().firstDurableFragment('CAM-01');
    await of.settled();
    await of.drive(2_000);
    of.fake.last().exit(1);
    await of.settled();
    // Option C: a durable session gets no second worker.
    expect(of.fake.calls()).toBe(1);
    const session = of.app.engine.slice('session');
    expect(session).toMatchObject({ id, state: 'FAULT', captureDurable: true, fault: { kind: 'CAPTURE_FAULT', fromState: 'RECORDING' } });
    expect(session?.startedAt).not.toBeNull();
    expect(of.events.at(-1)).toMatchObject({ type: 'INTERRUPTED', sessionId: id, files: [{ trackId: 'VIDEO-01', deviceId: 'CAM-01' }, { trackId: 'VIDEO-02', deviceId: 'CAM-02' }] });
    expect(of.order.filter((entry) => entry.startsWith('close'))).toHaveLength(4);
  });

  it('THE FILE IS THE TRUTH: no record arrived, but a camera file of the plan is on the disk - never a failed start', async () => {
    const of = await rig('r71b_file_truth', { fileExists: async (path) => path.endsWith('/VIDEO-01.mp4') });
    const id = await of.arm();
    await of.start(id);
    // The supervisor holds `durable: false` (no record reached it); the worker ends for good.
    of.fake.last().say({ type: 'CRASH', code: 'NO_CAMERA_CONNECTED', signal: null, exitCode: null });
    await of.settled();
    expect(of.supervisor.status().durable).toBe(false);
    expect(of.app.engine.slice('session')).toMatchObject({ state: 'FAULT', captureDurable: true });
    expect(of.events.at(-1)).toMatchObject({ type: 'INTERRUPTED' });
  });

  it('a recording that holds nothing durable yet is not stopped into a seal: 409 CAPTURE_NOT_DURABLE, and the stop works once it is durable', async () => {
    const of = await rig('r71b_stop_guard');
    const id = await of.arm();
    await of.start(id);
    const stop = (): Promise<unknown> =>
      of.app.engine.run('sessions.stopSession', async (scope) => {
        sessionCapture(of.app).stopRequestedIn(scope, id);
        await scope.command(of.investigator, 'stopRecording', 'End of the interview');
      });
    await expect(stop()).rejects.toMatchObject({ statusCode: 409, code: 'INVALID_STATE', details: { reason: CAPTURE_NOT_DURABLE } });
    expect(of.app.engine.slice('session')).toMatchObject({ state: 'RECORDING' });
    of.fake.last().firstDurableFragment('CAM-02');
    await of.settled();
    await expect(stop()).resolves.toBeDefined();
    expect(of.app.engine.slice('session')).toMatchObject({ state: 'STOPPING' });
  });
});

describe('D84 R-3 and R-4 on the real engine: two failed sessions write two audit rows; a recording clears what a restart left', () => {
  it('two sessions that fail in a row: FAULT_RAISED twice for the capture, with the clear between them', async () => {
    const of = await rig('r71b_two_failed');
    for (let round = 0; round < 2; round += 1) {
      const id = await of.arm();
      await of.start(id);
      of.fake.last().say({ type: 'CRASH', code: 'NO_CAMERA_CONNECTED', signal: null, exitCode: null });
      await of.settled();
      expect(of.app.engine.slice('session')).toMatchObject({ id, state: 'FAULT' });
      await of.app.engine.command(of.investigator, 'recover');
      await of.drive(5_000);
      expect(of.app.engine.slice('session')).toBeNull();
      await vi.waitFor(async () => expect((await faultRows(of)).filter((row) => row === 'FAULT_RAISED CAPTURE_FAULT@null')).toHaveLength(round + 1), { timeout: 5_000 });
    }
    expect((await faultRows(of)).filter((row) => row === 'FAULT_RAISED CAPTURE_FAULT@null')).toHaveLength(2);
  });

  it('R-4 and the rehydrate: a capture fault stored by an earlier run is cleared when a session records; captureDurable after a restart follows the stored fragment rows', async () => {
    const of = await rig('r71b_stale');
    // A fault this forwarder never raised (what a Core that went down leaves in the tables).
    await of.app.engine.raiseCaptureWarning({ code: 'CAPTURE_FAULT', subject: 'CAM-02' });
    expect(of.app.engine.slice('faults').active.map((fault) => `${fault.kind}@${String(fault.target)}`)).toContain('CAPTURE_FAULT@CAM-02');
    const id = await of.arm();
    await of.start(id);
    await of.settled();
    await vi.waitFor(async () => expect(await faultRows(of)).toEqual(['FAULT_RAISED CAPTURE_FAULT@CAM-02', 'FAULT_CLEARED CAPTURE_FAULT@CAM-02']), { timeout: 5_000 });
    expect(of.app.engine.slice('faults').active.filter((fault) => fault.kind === 'CAPTURE_FAULT')).toEqual([]);

    // The rehydrate: no fragment row -> not durable, whatever the member said before the restart.
    of.fake.last().firstDurableFragment('CAM-01');
    await of.settled();
    expect(of.app.engine.slice('session')).toMatchObject({ captureDurable: true });
    await of.app.engine.stop();
    await of.app.engine.start('resync');
    expect(of.app.engine.slice('session')).toMatchObject({ id, state: 'RECORDING', captureDurable: false });
    // With a fragment row: durable.
    const sha = SHA('b');
    const chain = (await of.rows<{ chain: string }>("SELECT encode(sha256(decode($1, 'hex') || decode($2, 'hex')), 'hex') AS chain", [GENESIS, sha]))[0]?.chain ?? '';
    of.fake.last().record(checkpoint(1, 1_231, chain, sha));
    await of.settled();
    await of.app.engine.stop();
    await of.app.engine.start('resync');
    expect(of.app.engine.slice('session')).toMatchObject({ id, state: 'RECORDING', captureDurable: true });
  });
});

// ── Row 71c (decision D153): the STT snapshot in the unit of the start, the transcriber session, the capture facts ──

const snapshotRows = (of: Rig, sessionId: string) => of.rows<{ enabled: boolean; revision: number }>('SELECT enabled, config_revision::int AS revision FROM public.session_stt_config WHERE session_id = $1', [sessionId]);
const stopNow = async (of: Rig, sessionId: string): Promise<void> => {
  await of.app.engine.run('sessions.stopSession', async (scope) => {
    sessionCapture(of.app).stopRequestedIn(scope, sessionId);
    await scope.command(of.investigator, 'stopRecording', 'End of the interview');
  });
  sessionCapture(of.app).afterStopCommitted(sessionId);
  await of.settled();
};

describe('row 71c: the STT snapshot of a session is written in the unit of its start (dbc-6 MR-T1)', () => {
  it('a start stores ONE snapshot row with the four source rows; the seal reads that row, not a placeholder', async () => {
    const of = await rig('r71c_snapshot');
    const id = await of.arm();
    expect(await snapshotRows(of, id)).toEqual([]);
    await of.start(id);
    expect(await snapshotRows(of, id)).toEqual([{ enabled: false, revision: expect.any(Number) }]);
    expect(await sourcesOf(of, id)).toHaveLength(4);
    // What the seal's reader is handed for field 123: the session's own row.
    expect(await transcriptionControl(of.app).manifestSnapshot(id)).toMatchObject({ enabled: false });
    // A change of the stored configuration while the session is open does not reach its snapshot (write-once).
    await of.owner.query('UPDATE public.stt_config SET enabled = true');
    expect(await transcriptionControl(of.app).snapshotSttConfigForSession(id)).toMatchObject({ ok: true, taken: false, snapshot: { enabled: false } });
    expect(await snapshotRows(of, id)).toHaveLength(1);
  });

  // Integration pass D9, item 2 (ruling D-71c-2): no real-mode session starts without its snapshot.
  it.each([
    ['the stored configuration cannot be read at that instant', 'STT_CONFIG_READ_FAILED'],
    ['the configuration row is not there', 'STT_CONFIG_NOT_SEEDED'],
    ['the transcription composition is absent', 'TRANSCRIPTION_NOT_MOUNTED'],
  ] as const)('%s (%s): the start is refused 503 STT_SNAPSHOT_NOT_STORED - not RECORDING, no source row, no snapshot row, no worker; the cause is in the error log', async (_name, code) => {
    const of = await rig(`d9_nosnap_${code.toLowerCase().slice(0, 24)}`);
    sessionCapture(of.app).replace({ snapshotIn: async () => ({ ok: false, code, storeFailed: false }) });
    const id = await of.arm();
    const appended = vi.spyOn(of.app.errorLog, 'append');
    const refused = await of.start(id).then(
      () => null,
      (error: unknown) => error,
    );
    expect(refused).toBeInstanceOf(ApiFailure);
    expect(refused).toMatchObject({ statusCode: 503, code: 'NOT_READY', details: { reason: 'STT_SNAPSHOT_NOT_STORED' } });
    // The answer names the refusal, never the cause.
    expect(JSON.stringify((refused as ApiFailure).details)).not.toContain(code);
    expect(of.app.engine.slice('session')).toMatchObject({ id, state: 'ARMED' });
    expect(await sourcesOf(of, id)).toEqual([]);
    expect(await snapshotRows(of, id)).toEqual([]);
    expect(await of.rows("SELECT 1 FROM public.audit_log WHERE type = 'RECORDING_STARTED' AND session_id = $1", [id])).toEqual([]);
    expect(of.fake.calls()).toBe(0);
    expect(of.order).toEqual([]);
    expect(of.transcriber).toEqual([]);
    expect(appended.mock.calls.map(([entry]) => entry).filter((entry) => entry.code === 'STT_SNAPSHOT_NOT_TAKEN').map((entry) => [entry.level, entry.context?.['cause']])).toEqual([['error', code]]);
  });

  it('CONTROL of the refusal: a readable configuration with STT DISABLED writes a snapshot that says disabled, and the session starts and its worker is started', async () => {
    const of = await rig('d9_nosnap_control');
    const id = await of.arm();
    await of.start(id);
    expect(of.app.engine.slice('session')).toMatchObject({ id, state: 'RECORDING' });
    expect(await snapshotRows(of, id)).toEqual([{ enabled: false, revision: expect.any(Number) }]);
    expect(await sourcesOf(of, id)).toHaveLength(4);
    expect(of.fake.calls()).toBe(1);
  });

  it('CONTROL of "the same transaction": a start whose unit does not commit leaves NO snapshot row and no source row', async () => {
    const of = await rig('r71c_snapshot_rollback');
    const id = await of.arm();
    await expect(
      of.app.engine.run('sessions.startSession', async (scope) => {
        await scope.command(of.investigator, 'startRecording');
        await sessionCapture(of.app).recordingStartedIn(scope, id);
        // Both writes were made on this unit: they are there, inside it...
        expect((await scope.unit.query('SELECT 1 FROM public.session_stt_config WHERE session_id = $1', [id])).rows).toHaveLength(1);
        throw new Error('the unit of the start fails after its writes');
      }),
    ).rejects.toThrow();
    sessionCapture(of.app).startAbandoned(id);
    // ...and gone with it.
    expect(await snapshotRows(of, id)).toEqual([]);
    expect(await sourcesOf(of, id)).toEqual([]);
    expect(of.app.engine.slice('session')?.state).toBe('ARMED');
  });
});

describe('row 71c: the transcriber session of a recording is opened at capture start and told the end on every exit path', () => {
  it('STT enabled in the snapshot: the plan carries the tap path, the session is opened once the worker listens, and a stop tells it the tap is whole - before the hand-off to the seal', async () => {
    const of = await rig('r71c_stt_on', { sttEnabled: true });
    const id = await of.arm();
    await of.start(id);
    expect(await snapshotRows(of, id)).toEqual([{ enabled: true, revision: expect.any(Number) }]);
    const start = of.fake.last().commands('START')[0] as { plan?: { pcmTapPath?: string | null } } | undefined;
    // The scratch of a session lies below the media store since the per-store keying (D180; `transcription/host.ts`), no longer below the data directory.
    expect(start?.plan?.pcmTapPath).toBe(sessionTapPath(of.app.config.mediaStoreDir, id));
    expect(of.transcriber).toEqual([`begin ${id}`]);
    of.fake.last().firstDurableFragment('CAM-01');
    await of.settled();
    const told: string[] = [];
    sessionCapture(of.app).on((event) => void told.push(`${event.type} after ${of.transcriber.at(-1)}`));
    await stopNow(of, id);
    expect(of.transcriber).toEqual([`begin ${id}`, `end ${id} recorded`]);
    expect(told).toEqual([`STOPPED after end ${id} recorded`]);
  });

  it('STT disabled in the snapshot (CONTROL): the plan carries no tap and NOTHING is opened or closed, from start to stop', async () => {
    const of = await rig('r71c_stt_off');
    const id = await of.arm();
    await of.start(id);
    const start = of.fake.last().commands('START')[0] as { plan?: { pcmTapPath?: string | null } } | undefined;
    expect(start?.plan?.pcmTapPath ?? null).toBeNull();
    of.fake.last().firstDurableFragment('CAM-01');
    await of.settled();
    await stopNow(of, id);
    expect(of.transcriber).toEqual([]);
  });

  it('an interrupted recording tells it "recorded"; a failed start tells it "nothing": no exit path leaves the session open', async () => {
    const interrupted = await rig('r71c_stt_interrupted', { sttEnabled: true });
    const first = await interrupted.arm();
    await interrupted.start(first);
    interrupted.fake.last().firstDurableFragment('CAM-01');
    await interrupted.settled();
    interrupted.fake.last().exit(1);
    await interrupted.settled();
    expect(interrupted.events.at(-1)).toMatchObject({ type: 'INTERRUPTED' });
    expect(interrupted.transcriber).toEqual([`begin ${first}`, `end ${first} recorded`]);

    const failed = await rig('r71c_stt_failed', { sttEnabled: true });
    const second = await failed.arm();
    await failed.start(second);
    failed.fake.last().say({ type: 'CRASH', code: 'NO_CAMERA_CONNECTED', signal: null, exitCode: null });
    await failed.settled();
    expect(failed.events.at(-1)).toMatchObject({ type: 'FAILED_START' });
    expect(failed.transcriber).toEqual([`begin ${second}`, `end ${second} nothing`]);
  });
});

describe('row 71c: what the capture side reports is kept for the seal while the capture runs', () => {
  it('the clock offset of each camera and the worker\'s FIRST_VIDEO_SAMPLE are in the facts of the session and in the hand-off; they name the instant of the session\'s own start rows', async () => {
    const of = await rig('r71c_facts', { clockOffsets: { 'CAM-01': -7, 'CAM-02': 12 } });
    const id = await of.arm();
    await of.start(id);
    const worker = of.fake.last();
    worker.record({ kind: 'FIRST_VIDEO_SAMPLE', deviceId: 'CAM-01', pts: 3_600, timescale: 90_000, skipped: { noTimestamp: 0, beforeAudioStart: 2, noCameraClock: 0, beforeKeyframe: 5 }, skippedSpanMs: 40 });
    worker.firstDurableFragment('CAM-01');
    await of.settled();
    // WHILE the capture runs (a Core that goes down now has lost nothing of it).
    const live = await readSessionCaptureFacts(of.app.config.mediaStoreDir, id);
    const recordedAt = Number((await of.rows<{ at: string }>('SELECT DISTINCT recorded_at AS at FROM public.session_capture_sources WHERE session_id = $1', [id]))[0]?.at);
    expect(live).toEqual({
      version: 1,
      sessionId: id,
      startRecordedAt: recordedAt,
      cameras: [
        // Tidy pass F-Y: the fake worker states the full sync with its first durable fragment, as the real worker does; no clock was measured here.
        { trackId: 'VIDEO-01', deviceId: 'CAM-01', clockOffsetMs: -7, measuredClockOffsetMs: null, syncLevel: 'F_FULLFSYNC', firstVideo: { pts: 3_600, timescale: 90_000, heldMs: 40, skipped: { noTimestamp: 0, beforeAudioStart: 2, noCameraClock: 0, beforeKeyframe: 5 }, skippedSpanMs: 40 } },
        // No FIRST_VIDEO_SAMPLE arrived for the second file: null, never a made-up value (fields 127 / 128 are nullable).
        { trackId: 'VIDEO-02', deviceId: 'CAM-02', clockOffsetMs: 12, measuredClockOffsetMs: null, syncLevel: null, firstVideo: null },
      ],
    });
    await stopNow(of, id);
    expect(of.events.at(-1)).toMatchObject({ type: 'STOPPED', firstVideo: [{ deviceId: 'CAM-01', pts: 3_600, timescale: 90_000, skippedSpanMs: 40 }] });
    expect(await readSessionCaptureFacts(of.app.config.mediaStoreDir, id)).toEqual(live);
  });
});

describe('row 71c, item 4 (a): a session that leaves RECORDING by another door has its worker stopped', () => {
  it('a critical fault of the engine while the worker records: the worker is stopped, the sources are closed and the durable recording is handed over as interrupted; CONTROL: without it the same record stops nothing', async () => {
    const of = await rig('r71c_left', { sttEnabled: true });
    const id = await of.arm();
    await of.start(id);
    const worker = of.fake.last();
    worker.firstDurableFragment('CAM-01');
    await of.settled();
    // CONTROL: the worker says something while the session records - nothing is stopped.
    worker.record(checkpoint(1, 800, SHA('a'), SHA('b')));
    await of.settled();
    expect([worker.commands('STOP').length, sessionCapture(of.app).liveSessionId()]).toEqual([0, id]);

    // The session is moved to FAULT by another door than the capture's (in real capture, demo operation 73 itself answers 403 DEMO_DISABLED).
    await of.app.engine.command(of.investigator, 'inject', 'STORAGE_FULL');
    expect(of.app.engine.slice('session')).toMatchObject({ id, state: 'FAULT', fault: { kind: 'STORAGE_FULL', fromState: 'RECORDING' } });
    // The worker still records: the next thing it says is the moment this unit sees it.
    worker.record(checkpoint(2, 1_800, SHA('c'), SHA('d')));
    await of.settled();
    expect(worker.commands('STOP')).toHaveLength(1);
    expect(sessionCapture(of.app).liveSessionId()).toBeNull();
    expect(of.order.filter((entry) => entry.startsWith('close'))).toHaveLength(4);
    expect(of.events.at(-1)).toMatchObject({ type: 'INTERRUPTED', sessionId: id, cause: SESSION_LEFT_RECORDING });
    expect(of.transcriber).toEqual([`begin ${id}`, `end ${id} recorded`]);
  });
});

// Integration pass D9, item 4 (row 140's finding F-6): both microphone helpers are launched in the
// same turn after the worker's acknowledgement; neither waits for the other, and no camera waits
// for either. The helpers are SCRIPTED (no device, no process): a helper is "alive" a settle time
// after its launch, on a virtual timeline that moves only when a start settles - exactly what made
// the sequential loop launch the second helper one settle time late.
describe('pass D9: the microphone helpers of a session are started together (cap ML-5; finding F-6)', () => {
  const SETTLE_MS = 1_500;
  const CHUNK_SAMPLES = 480; // one 10 ms input quantum of the worker at 48 kHz (cap §E)
  type Script = (deviceId: string) => 'SETTLE' | 'FAIL' | 'HANG';
  interface Helpers {
    readonly log: string[];
    /** The sample index (48 kHz) at which each helper was launched, on the virtual timeline. */
    readonly launchedAtSample: Map<string, number>;
    readonly start: (deviceId: string) => Promise<void>;
    readonly registry: (built: CaptureDeviceRegistry) => CaptureDeviceRegistry;
  }
  function scripted(script: Script = () => 'SETTLE'): Helpers {
    const log: string[] = [];
    const launchedAtSample = new Map<string, number>();
    let virtualMs = 0;
    const start = (deviceId: string): Promise<void> => {
      launchedAtSample.set(deviceId, (virtualMs * 48_000) / 1_000);
      log.push(`launch ${deviceId}`);
      const how = script(deviceId);
      if (how === 'HANG') return new Promise<void>(() => undefined);
      return new Promise<void>((resolve, reject) =>
        setTimeout(() => {
          virtualMs += SETTLE_MS;
          log.push(`${how === 'FAIL' ? 'failed' : 'settled'} ${deviceId}`);
          if (how === 'FAIL') reject(new Error('the scripted helper ended at once'));
          else resolve();
        }, 40),
      );
    };
    const registry = (built: CaptureDeviceRegistry): CaptureDeviceRegistry => ({
      ...built,
      resolve: ((deviceClass: 'CAMERA' | 'MIC', deviceId: string) => {
        if (deviceClass === 'MIC') {
          const adapter = built.resolve('MIC', deviceId);
          return { ...adapter, open: async (inputId: string, to: Parameters<typeof adapter.open>[1]) => ({ ...(await adapter.open(inputId, to)), start: () => start(inputId) }) };
        }
        const adapter = built.resolve('CAMERA', deviceId);
        return { ...adapter, openSource: async (id: string, to: Parameters<typeof adapter.openSource>[1], signal: AbortSignal) => (log.push(`camera ${id}`), adapter.openSource(id, to, signal)) };
      }) as CaptureDeviceRegistry['resolve'],
    });
    return { log, launchedAtSample, start, registry };
  }
  const headGap = (of: Helpers): number => Math.abs((of.launchedAtSample.get('MIC-01') ?? Number.NaN) - (of.launchedAtSample.get('MIC-02') ?? Number.NaN));

  it('the bound of a microphone start is the no-delivery bound of the local adapters', () => {
    expect(MIC_START_BOUND_MS).toBe(FIRST_DELIVERY_MS);
  });

  it('both helpers are launched before either has settled and report their first sample within one chunk of each other; the cameras are opened without waiting for them; STARTED is said after both', async () => {
    const helpers = scripted();
    const of = await rig('d9_mic_together', { registry: helpers.registry });
    const id = await of.arm();
    await of.start(id);
    expect(helpers.log.slice(0, 2)).toEqual(['launch MIC-01', 'launch MIC-02']);
    expect(headGap(helpers)).toBeLessThanOrEqual(CHUNK_SAMPLES);
    expect(headGap(helpers)).toBe(0);
    // No camera waited for a microphone's settle time.
    const firstSettled = helpers.log.findIndex((entry) => entry.startsWith('settled'));
    expect(helpers.log.indexOf('camera CAM-01')).toBeLessThan(firstSettled);
    expect(helpers.log.indexOf('camera CAM-02')).toBeLessThan(firstSettled);
    expect(helpers.log.filter((entry) => entry.startsWith('settled')).sort()).toEqual(['settled MIC-01', 'settled MIC-02']);
    expect(of.events.map((event) => event.type)).toEqual(['CONNECTING', 'STARTED']);
    expect(of.fake.calls()).toBe(1);
  });

  it('CONTROL: the same scripted helpers started ONE AFTER THE OTHER show the gap - the second is launched a settle time late, 72,000 samples, far more than one chunk', async () => {
    const helpers = scripted();
    for (const deviceId of ['MIC-01', 'MIC-02']) await helpers.start(deviceId);
    expect(helpers.log).toEqual(['launch MIC-01', 'settled MIC-01', 'launch MIC-02', 'settled MIC-02']);
    expect(headGap(helpers)).toBe((SETTLE_MS * 48_000) / 1_000);
    expect(headGap(helpers)).toBeGreaterThan(CHUNK_SAMPLES);
  });

  it('the STANDBY cannot start: a named warning with its role, the primary is launched in the same turn and is not delayed, the session starts, nothing is switched', async () => {
    const helpers = scripted((deviceId) => (deviceId === 'MIC-02' ? 'FAIL' : 'SETTLE'));
    const of = await rig('d9_mic_standby_fails', { registry: helpers.registry });
    const appended = vi.spyOn(of.app.errorLog, 'append');
    const id = await of.arm();
    await of.start(id);
    expect(headGap(helpers)).toBe(0);
    expect(appended.mock.calls.map(([entry]) => entry).filter((entry) => entry.code === 'CAPTURE_MIC_NOT_STARTED').map((entry) => [entry.level, entry.context?.['deviceId'], entry.context?.['role'], entry.context?.['cause']])).toEqual([['warn', 'MIC-02', 'STANDBY', 'MIC_START_FAILED']]);
    expect(of.events.map((event) => event.type)).toEqual(['CONNECTING', 'STARTED']);
    expect(of.app.engine.slice('session')).toMatchObject({ state: 'RECORDING', audioSource: { activeInputId: 'MIC-01', standbyInputId: 'MIC-02' } });
    expect(of.fake.last().commands('SWITCH_AUDIO_SOURCE')).toEqual([]);
  });

  it('a PRIMARY whose start never answers is given up at the bound and said as an error; the standby and the cameras did not wait for it, and it is never replaced', async () => {
    const helpers = scripted((deviceId) => (deviceId === 'MIC-01' ? 'HANG' : 'SETTLE'));
    const of = await rig('d9_mic_primary_hangs', { registry: helpers.registry });
    sessionCapture(of.app).replace({ micStartBoundMs: 150 });
    const appended = vi.spyOn(of.app.errorLog, 'append');
    const id = await of.arm();
    await of.start(id);
    for (let round = 0; round < 40 && !of.events.some((event) => event.type === 'STARTED'); round += 1) {
      await new Promise<void>((resolve) => setTimeout(resolve, 25));
      await of.settled();
    }
    expect(helpers.log.indexOf('settled MIC-02')).toBeGreaterThan(-1);
    expect(helpers.log).toEqual(expect.arrayContaining(['camera CAM-01', 'camera CAM-02']));
    expect(appended.mock.calls.map(([entry]) => entry).filter((entry) => entry.code === 'CAPTURE_MIC_NOT_STARTED').map((entry) => [entry.level, entry.context?.['deviceId'], entry.context?.['role'], entry.context?.['cause']])).toEqual([['error', 'MIC-01', 'PRIMARY', 'MIC_START_BOUND']]);
    expect(of.events.map((event) => event.type)).toEqual(['CONNECTING', 'STARTED']);
    expect(of.app.engine.slice('session')).toMatchObject({ state: 'RECORDING', audioSource: { activeInputId: 'MIC-01' } });
    expect(of.fake.last().commands('SWITCH_AUDIO_SOURCE')).toEqual([]);
  });

  // Closing pass F-X (review row 74, finding R74-08 (2)): `begin`, the stop and the end run on ONE chain, so a stop
  // that committed while `begin` still waited for a microphone start reached the worker only after the start bound
  // (8 s in the product): the worker recorded past the committed stop. The chain keeps its order; `begin` stops
  // waiting the moment a stop (or the worker's end) is asked. Written RED: the STOP came after the bound.
  const startWithoutWaiting = async (of: Rig, id: string): Promise<void> => {
    const capture = sessionCapture(of.app);
    await capture.beforeStart();
    await of.app.engine.run('sessions.startSession', async (scope) => {
      await scope.command(of.investigator, 'startRecording');
      await capture.recordingStartedIn(scope, id);
    });
    capture.afterStartCommitted(id);
  };
  const until = async (what: () => boolean, ms: number): Promise<number> => {
    const from = performance.now();
    while (!what() && performance.now() - from < ms) await new Promise<void>((resolve) => setTimeout(resolve, 10));
    return performance.now() - from;
  };

  it('R74-08: a stop that commits while a microphone start is still waited for is sent to the worker at once, not after the start bound; the session is handed over as STOPPED', async () => {
    const BOUND = 4_000;
    const helpers = scripted((deviceId) => (deviceId === 'MIC-01' ? 'HANG' : 'SETTLE'));
    const of = await rig('fx_r7408_stop', { registry: helpers.registry });
    sessionCapture(of.app).replace({ micStartBoundMs: BOUND });
    const appended = vi.spyOn(of.app.errorLog, 'append');
    const id = await of.arm();
    await startWithoutWaiting(of, id);
    // `begin` has started the worker and both helpers and now waits for MIC-01, which never answers.
    await until(() => helpers.log.includes('settled MIC-02') && helpers.log.includes('camera CAM-02'), 2_000);
    of.fake.last().firstDurableFragment('CAM-01');
    await until(() => of.app.engine.slice('session')?.captureDurable === true, 2_000);
    expect(of.app.engine.slice('session')).toMatchObject({ state: 'RECORDING', captureDurable: true });
    expect(of.events.map((event) => event.type)).not.toContain('STARTED');

    await of.app.engine.run('sessions.stopSession', async (scope) => {
      sessionCapture(of.app).stopRequestedIn(scope, id);
      await scope.command(of.investigator, 'stopRecording', 'End of the interview');
    });
    sessionCapture(of.app).afterStopCommitted(id);
    const waited = await until(() => of.fake.last().commands('STOP').length > 0, BOUND + 2_000);
    expect(of.fake.last().commands('STOP')).toHaveLength(1);
    expect(waited).toBeLessThan(BOUND / 4);
    await of.settled();
    expect(of.events.at(-1)?.type).toBe('STOPPED');
    // The microphone that was still being started when the operator stopped is not reported as a failed start.
    expect(appended.mock.calls.map(([entry]) => entry.code).filter((code) => code === 'CAPTURE_MIC_NOT_STARTED' || code === 'CAPTURE_SESSION_STEP_FAILED')).toEqual([]);
  });

  it('R74-08 CONTROL: without a stop the same start still waits its bound and reports the microphone (the wait is cut only by a stop or the end of the capture)', async () => {
    const helpers = scripted((deviceId) => (deviceId === 'MIC-01' ? 'HANG' : 'SETTLE'));
    const of = await rig('fx_r7408_control', { registry: helpers.registry });
    sessionCapture(of.app).replace({ micStartBoundMs: 300 });
    const appended = vi.spyOn(of.app.errorLog, 'append');
    const id = await of.arm();
    await startWithoutWaiting(of, id);
    await until(() => helpers.log.includes('settled MIC-02'), 2_000);
    expect(of.events.map((event) => event.type)).not.toContain('STARTED');
    await until(() => of.events.some((event) => event.type === 'STARTED'), 3_000);
    await of.settled();
    expect(of.events.map((event) => event.type)).toEqual(['CONNECTING', 'STARTED']);
    expect(appended.mock.calls.map(([entry]) => entry).filter((entry) => entry.code === 'CAPTURE_MIC_NOT_STARTED').map((entry) => entry.context?.['cause'])).toEqual(['MIC_START_BOUND']);
  });
});

// ── Fix pass F-M5 (code review row 74) ──────────────────────────────────────────────────────────

const switchRecord = (command: { correlationId?: string } | undefined, patch: Partial<AudioSourceIntervalRecord> = {}): AudioSourceIntervalRecord => ({
  ...startInterval,
  deviceId: 'MIC-02',
  role: 'STANDBY',
  index: 2,
  fromSample: 240_000,
  capturedAtMs: FIXED_NOW + 5_000,
  reason: 'OPERATOR_SWITCH',
  correlationId: command?.correlationId ?? null,
  appliedDelayUs: 9_000,
  ...patch,
});
const intervalsOf = (of: Rig, id: string) => of.rows('SELECT seq, mic_device_id, from_media_ms::int AS from_ms, to_media_ms::int AS to_ms, reason FROM public.session_audio_intervals WHERE session_id = $1 ORDER BY seq', [id]);
const switchRows = (of: Rig) => of.rows<{ actor_id: string | null; details: Record<string, unknown> }>("SELECT actor_id, details FROM public.audit_log WHERE type = 'AUDIO_SOURCE_SWITCHED' ORDER BY seq");

/**
 * EVERY rig is CLOSED AFTER ITS CASE (the app, its pools, the supervisor). Until closing pass J of
 * fix wave I only the fix-pass cases were: the 26 cases above kept their app - a runtime pool and an
 * owner pool each - until the file ended, which fitted the test server's connection slots when this
 * file ran alone and did not when a second db file ran beside it (`restart.db.test.ts`, two workers:
 * "remaining connection slots are reserved for roles with the SUPERUSER attribute", 38 cases).
 * `rig` registers itself in `openRigs`; `fixRig` is kept as the name the later cases use.
 */
const fixPassRigs: Rig[] = openRigs;
async function fixRig(slug: string, options: Parameters<typeof rig>[1] = {}): Promise<Rig> {
  return rig(slug, options);
}
afterEach(async () => {
  for (const of of fixPassRigs.splice(0)) {
    await of.supervisor.shutdown();
    await of.app.close();
    // Closing pass J: the rig's owner pool too - 49 idle owner connections were the other half of the count.
    expect(await rigDatabases.get(of)?.closeResources()).toEqual([]);
    // Fix I-7b: and the rig's database. Every rig is a clone of its own and no case reads another's; until here
    // each lived to the end of the file (one per rig, more than eighty at once), and with a second file of many
    // clones beside it the run met the helper's bound of 99 live clones (`test/helpers/db/names.ts`). A rig whose
    // closing failed above is still dropped with the file (`useTestDatabase`: the drop is idempotent).
    await rigDatabases.get(of)?.drop();
  }
});

async function durableSession(slug: string, options: Parameters<typeof rig>[1] = {}): Promise<{ of: Rig; id: string }> {
  const of = await fixRig(slug, options);
  const id = await of.arm();
  await of.start(id);
  of.fake.last().record(startInterval);
  of.fake.last().firstDurableFragment('CAM-01');
  await of.settled();
  expect(of.app.engine.slice('session')).toMatchObject({ state: 'RECORDING', captureDurable: true });
  return { of, id };
}

describe('review R74-06: a switch the worker realised is recorded whatever happens around it', () => {
  it('(a) the session left RECORDING between the command and its acknowledgement: the interval rows and the audit row are written from the record; the answer names the input that feeds the track', async () => {
    const { of, id } = await durableSession('fm5_switch_left');
    const worker = of.fake.last();
    const switching = sessionCapture(of.app).switchAudioSource(of.investigator, id, 'MIC-02');
    await flush();
    const command = worker.commands('SWITCH_AUDIO_SOURCE')[0];
    // The stop commits while the worker realises the switch.
    await of.app.engine.run('sessions.stopSession', async (scope) => {
      await scope.command(of.investigator, 'stopRecording', 'End of the interview');
    });
    expect(of.app.engine.slice('session')?.state).toBe('STOPPING');
    worker.record(switchRecord(command));
    worker.ack(true, undefined, command);
    await expect(switching).resolves.toMatchObject({ sessionId: id, activeInputId: 'MIC-02', standbyInputId: 'MIC-01', intervalFromMs: 5_021 });
    expect(await intervalsOf(of, id)).toEqual([
      { seq: 1, mic_device_id: 'MIC-01', from_ms: 21, to_ms: 5_021, reason: 'START' },
      { seq: 2, mic_device_id: 'MIC-02', from_ms: 5_021, to_ms: null, reason: 'MANUAL' },
    ]);
    const rows = await switchRows(of);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ actor_id: of.investigator.operatorId, details: { fromInput: 'MIC-01', toInput: 'MIC-02', fromMs: 21, toMs: 5_021 } });
  });

  it('(b) the record of the switch arrived but its acknowledgement did not come within the limit: the switch is RECORDED from the record (state, rows, audit row), not refused - the Core never says another microphone than the worker feeds; a switch back then works', async () => {
    const { of, id } = await durableSession('fm5_switch_late', { limits: { ackTimeoutMs: 300 } });
    const worker = of.fake.last();
    const switching = sessionCapture(of.app).switchAudioSource(of.investigator, id, 'MIC-02');
    await flush();
    const command = worker.commands('SWITCH_AUDIO_SOURCE')[0];
    // The worker switched and wrote its record; the acknowledgement is never read in time.
    worker.record(switchRecord(command));
    await expect(switching).resolves.toMatchObject({ sessionId: id, activeInputId: 'MIC-02', standbyInputId: 'MIC-01', intervalFromMs: 5_021 });
    expect(of.app.engine.slice('session')?.audioSource).toMatchObject({ activeInputId: 'MIC-02', standbyInputId: 'MIC-01', intervalFromMs: 5_021 });
    expect(await intervalsOf(of, id)).toEqual([
      { seq: 1, mic_device_id: 'MIC-01', from_ms: 21, to_ms: 5_021, reason: 'START' },
      { seq: 2, mic_device_id: 'MIC-02', from_ms: 5_021, to_ms: null, reason: 'MANUAL' },
    ]);
    const rows = await switchRows(of);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ actor_id: of.investigator.operatorId, details: { fromInput: 'MIC-01', toInput: 'MIC-02', fromMs: 21, toMs: 5_021 } });
    // No dead end: the way back is a normal switch.
    const back = sessionCapture(of.app).switchAudioSource(of.investigator, id, 'MIC-01');
    await flush();
    const second = worker.commands('SWITCH_AUDIO_SOURCE')[1];
    expect(second).toMatchObject({ to: 'PRIMARY' });
    worker.record(switchRecord(second, { deviceId: 'MIC-01', role: 'PRIMARY', index: 3, fromSample: 480_000, capturedAtMs: FIXED_NOW + 10_000 }));
    worker.ack(true, undefined, second);
    await expect(back).resolves.toMatchObject({ activeInputId: 'MIC-01', intervalFromMs: 10_021 });
    expect(await switchRows(of)).toHaveLength(2);
  });

  it('CONTROL of (b): no record and no acknowledgement within the limit - the call is refused 409 and nothing is written', async () => {
    const { of, id } = await durableSession('fm5_switch_silent', { limits: { ackTimeoutMs: 300 } });
    const switching = sessionCapture(of.app).switchAudioSource(of.investigator, id, 'MIC-02');
    await expect(switching).rejects.toMatchObject({ statusCode: 409, code: 'AUDIO_SOURCE_CONFLICT' });
    expect(await intervalsOf(of, id)).toHaveLength(1);
    expect(await switchRows(of)).toEqual([]);
    expect(of.app.engine.slice('session')?.audioSource).toMatchObject({ activeInputId: 'MIC-01' });
  });
});

describe('review R74-07: the end of a capture that holds durable media is always handed over', () => {
  it('the worker ends for good while the session is STOPPING (the engine ignores the end): the listeners are told INTERRUPTED, so the seal is not left waiting for a restart', async () => {
    const { of, id } = await durableSession('fm5_end_ignored');
    await of.app.engine.run('sessions.stopSession', async (scope) => {
      sessionCapture(of.app).stopRequestedIn(scope, id);
      await scope.command(of.investigator, 'stopRecording', 'End of the interview');
    });
    // The worker dies before the stop reaches it.
    of.fake.last().exit(1);
    await of.settled();
    expect(of.events.at(-1)).toMatchObject({ type: 'INTERRUPTED', sessionId: id });
    expect(of.transcriber.filter((entry) => entry.includes('nothing'))).toEqual([]);
    expect(sessionCapture(of.app).liveSessionId()).toBeNull();
    // The stop that committed finds no live capture and says nothing a second time.
    sessionCapture(of.app).afterStopCommitted(id);
    await of.settled();
    expect(of.events.filter((event) => event.type === 'INTERRUPTED' || event.type === 'STOPPED')).toHaveLength(1);
  });
});

describe('review R74-09: the unit has a shutdown path of its own', () => {
  it('mid-recording: the worker is stopped FIRST, then every source is closed, the session signal is aborted and nothing runs in the background; nothing is told (the next boot resumes the session)', async () => {
    const { of, id } = await durableSession('fm5_shutdown_recording');
    const told = of.events.length;
    await sessionCapture(of.app).shutdown();
    expect(of.fake.last().commands('STOP')).toHaveLength(1);
    expect(of.order.slice(4)).toEqual(['STOP', 'close MIC-01', 'close MIC-02', 'close CAM-01', 'close CAM-02']);
    expect(sessionCapture(of.app).liveSessionId()).toBeNull();
    expect(of.events.slice(told)).toEqual([]);
    expect(of.app.engine.slice('session')).toMatchObject({ id, state: 'RECORDING' });
    // Safe to call twice.
    await expect(sessionCapture(of.app).shutdown()).resolves.toBeUndefined();
  });

  it('mid-start: a camera source that is still being opened (the settle window of its helper) is reached by the shutdown through the session signal, and the shutdown does not wait for the start to finish', async () => {
    let aborted = 0;
    let opening = 0;
    const of = await fixRig('fm5_shutdown_starting', {
      registry: (built) => {
        const camera = built.resolve('CAMERA', 'CAM-02');
        // A helper inside its settle window: it is in no table yet, and ends only when its signal is aborted.
        const settling: typeof camera = {
          ...camera,
          openSource: (deviceId, _to, signal) =>
            new Promise((_resolve, reject) => {
              opening += 1;
              signal?.addEventListener('abort', () => {
                aborted += 1;
                reject(new Error(`${deviceId}: aborted while settling`));
              });
            }),
        };
        const resolve = ((kind: 'CAMERA' | 'MIC', deviceId: string) => (kind === 'CAMERA' && deviceId === 'CAM-02' ? settling : built.resolve(kind as 'CAMERA', deviceId))) as typeof built.resolve;
        return { ...built, resolve };
      },
    });
    const id = await of.arm();
    await sessionCapture(of.app).beforeStart();
    await of.app.engine.run('sessions.startSession', async (scope) => {
      await scope.command(of.investigator, 'startRecording');
      await sessionCapture(of.app).recordingStartedIn(scope, id);
    });
    sessionCapture(of.app).afterStartCommitted(id);
    await vi.waitFor(() => expect(opening).toBe(1), { timeout: 5_000 });
    expect(aborted).toBe(0);
    await sessionCapture(of.app).shutdown();
    expect(aborted).toBe(1);
    expect(of.fake.last().commands('STOP')).toHaveLength(1);
    expect(of.order.filter((entry) => entry.startsWith('close')).sort()).toEqual(['close CAM-01', 'close MIC-01', 'close MIC-02']);
    expect(sessionCapture(of.app).liveSessionId()).toBeNull();
    expect(of.events.map((event) => event.type)).toEqual(['CONNECTING']);
  });

  it('the app closes through it: `app.close()` alone stops the worker and closes the sources', async () => {
    const { of } = await durableSession('fm5_shutdown_close');
    await of.app.close();
    expect(of.fake.last().commands('STOP')).toHaveLength(1);
    expect(of.order.filter((entry) => entry.startsWith('close'))).toHaveLength(4);
    expect(of.order.indexOf('STOP')).toBeLessThan(of.order.indexOf('close MIC-01'));
  });
});

describe('review R74-03: a camera the worker could not connect is told to the listeners of the unit', () => {
  it('the worker warning CAMERA_NOT_CONNECTED of the session becomes the event CAMERA_NOT_CONNECTED with the device; no critical fault of the camera is raised', async () => {
    const of = await fixRig('fm5_camera_not_connected');
    const id = await of.arm();
    await of.start(id);
    of.fake.last().warning('CAPTURE_FAULT', 'CAM-02', 'ACTIVE', 'CAMERA_NOT_CONNECTED');
    of.fake.last().firstDurableFragment('CAM-01');
    await of.settled();
    expect(of.events.filter((event) => event.type === 'CAMERA_NOT_CONNECTED')).toEqual([{ type: 'CAMERA_NOT_CONNECTED', sessionId: id, deviceId: 'CAM-02' }]);
    expect(of.app.engine.slice('faults').active.filter((fault) => fault.kind === 'CAPTURE_FAULT')).toEqual([]);
    expect(of.app.engine.slice('session')).toMatchObject({ state: 'RECORDING', captureDurable: true });
  });

  // Task 4 row 182 (ruling C35): the worker names the cause. A push that brought no picture is a MISSING camera, exactly as above.
  it('row 182, C35 (a): CAMERA_NO_PICTURE is the same degraded start - the event with the device, no critical fault of the camera, the session records', async () => {
    const of = await fixRig('r182_no_picture');
    const id = await of.arm();
    await of.start(id);
    of.fake.last().warning('CAPTURE_FAULT', 'CAM-02', 'ACTIVE', 'CAMERA_NO_PICTURE');
    of.fake.last().firstDurableFragment('CAM-01');
    await of.settled();
    expect(of.events.filter((event) => event.type === 'CAMERA_NOT_CONNECTED')).toEqual([{ type: 'CAMERA_NOT_CONNECTED', sessionId: id, deviceId: 'CAM-02' }]);
    expect(of.app.engine.slice('faults').active.filter((fault) => fault.kind === 'CAPTURE_FAULT')).toEqual([]);
    expect(of.app.engine.slice('session')).toMatchObject({ state: 'RECORDING', captureDurable: true });
  });

  it.each(['CAMERA_ANNOUNCE_NOT_MATCHED', 'CAMERA_ANNOUNCE_NOT_SEEN'] as const)(
    'row 182, C35 (b): %s is an integrity fault - ONE critical capture fault of that camera whose reason is that word, NOT the "did not connect" event; the other camera records',
    async (reason) => {
      const of = await fixRig(`r182_${reason === 'CAMERA_ANNOUNCE_NOT_SEEN' ? 'not_seen' : 'not_matched'}`);
      const id = await of.arm();
      await of.start(id);
      of.fake.last().warning('CAPTURE_FAULT', 'CAM-02', 'ACTIVE', reason);
      of.fake.last().firstDurableFragment('CAM-01');
      await of.settled();
      expect(of.events.filter((event) => event.type === 'CAMERA_NOT_CONNECTED')).toEqual([]);
      // The forwarder hands the raise to the engine apart from the supervisor's queue (it never holds it): waited for, not assumed.
      await vi.waitFor(() => expect(of.app.engine.slice('faults').active.filter((fault) => fault.kind === 'CAPTURE_FAULT')).toMatchObject([{ kind: 'CAPTURE_FAULT', target: 'CAM-02', reason }]), { timeout: 5_000 });
      const alerts = of.app.engine.slice('alerts').filter((alert) => alert.kind === 'CAPTURE_FAULT' && alert.active);
      expect(alerts.map((alert) => [alert.severity, alert.params?.['reason']])).toEqual([['CRITICAL', reason]]);
      // The sentence names the camera (its words are the shared wording source's: the neutral sentence with the code until that table holds the member).
      expect(alerts[0]?.message).toContain('CAM-02');
      expect(of.app.engine.slice('session')).toMatchObject({ state: 'RECORDING', captureDurable: true });
    },
  );
});

// Review R74-04, ruling D177: no manifest field can say that a microphone stopped delivering (ev §B.5
// has seq, device, role, the two media times, reason and operator - bending one would be a lie). What
// the sealed package DOES hold is the audit trail of the session: `audit-session-extract.jsonl` is
// every `audit_log` row whose `session_id` is the session (`sealing-host/session-reader.ts`,
// READ_SEAL_AUDIT_ROWS - the same predicate as below). This case holds that the named microphone
// faults, raised and cleared, with their times and a sentence that is true, ARE such rows.
describe('review R74-04: both microphones fail during a recording - the audit rows the seal extracts say so', () => {
  it('FAULT_RAISED and FAULT_CLEARED of each microphone carry the session ID, the device, the reason MIC_DISCONNECTED and a true sentence; the session keeps recording (D163)', async () => {
    const { of, id } = await durableSession('fm5_mics_lost');
    const worker = of.fake.last();
    worker.warning('CAPTURE_FAULT', 'MIC-01', 'ACTIVE', 'MIC_DISCONNECTED');
    worker.warning('CAPTURE_FAULT', 'MIC-02', 'ACTIVE', 'MIC_DISCONNECTED');
    await of.settled();
    await vi.waitFor(() => expect(of.app.engine.slice('faults').active.filter((fault) => fault.reason === 'MIC_DISCONNECTED')).toHaveLength(2), { timeout: 5_000 });
    // D163: the session goes on.
    expect(of.app.engine.slice('session')).toMatchObject({ id, state: 'RECORDING', captureDurable: true });
    // One of the two delivers again: its fault is cleared by the capture side after the hold.
    worker.warning('CAPTURE_FAULT', 'MIC-02', 'CLEARED', 'MIC_DISCONNECTED');
    await of.settled();
    // The hold of the forwarder runs on the Core's clock.
    await of.drive(2_500);
    worker.telemetry(1);
    await of.settled();
    await vi.waitFor(() => expect(of.app.engine.slice('faults').active.filter((fault) => fault.reason === 'MIC_DISCONNECTED')).toHaveLength(1), { timeout: 5_000 });

    // THE EXTRACT OF THE SEAL: every audit row of the session.
    const extract = await of.rows<{ type: string; at: string; message: string; device_id: string | null; details: Record<string, unknown> }>('SELECT type, at, message, device_id, details FROM public.audit_log WHERE session_id = $1 ORDER BY seq', [id]);
    const mic = extract.filter((row) => row.details['reason'] === 'MIC_DISCONNECTED');
    expect(mic.map((row) => `${row.type} ${String(row.details['target'])}`)).toEqual(['FAULT_RAISED MIC-01', 'FAULT_RAISED MIC-02', 'FAULT_CLEARED MIC-02']);
    for (const row of mic) {
      expect(row.details).toMatchObject({ kind: 'CAPTURE_FAULT', reason: 'MIC_DISCONNECTED' });
      expect(Number(row.at)).toBeGreaterThan(0);
      expect(row.message).toMatch(/stopped delivering audio/);
      expect(row.message).not.toMatch(/stopped growing/);
    }
    // CONTROL: the microphone that never delivered again has no clear row in the extract - a verifier reads "not resolved in this session".
    expect(mic.filter((row) => row.type === 'FAULT_CLEARED' && row.details['target'] === 'MIC-01')).toEqual([]);
    // CONTROL of the predicate: a row of no session (or of another) is not in the extract.
    const others = await of.rows<{ n: string }>("SELECT count(*) AS n FROM public.audit_log WHERE session_id IS DISTINCT FROM $1 AND details->>'reason' = 'MIC_DISCONNECTED'", [id]);
    expect(Number(others[0]?.n)).toBe(0);
  });
});

// Fix pass F-M3 / F-M5 (review R63-01, decision D179 (b)): the supervisor says HOW a stop ended; a stop
// that is not clean is an interrupted recording. The capture-session unit maps it to its hand-off.
describe('a stop that did not end cleanly is handed over as INTERRUPTED and worded for the operator', () => {
  it('the worker exits on STOP without the end of its audio timeline: INTERRUPTED with the cause, never STOPPED; one alert that says the recording was interrupted', async () => {
    const { of, id } = await durableSession('fm5_stop_not_clean', { worker: { timelineEndOnStop: false } });
    await of.app.engine.run('sessions.stopSession', async (scope) => {
      sessionCapture(of.app).stopRequestedIn(scope, id);
      await scope.command(of.investigator, 'stopRecording', 'End of the interview');
    });
    sessionCapture(of.app).afterStopCommitted(id);
    await of.settled();
    const last = of.events.at(-1);
    expect(last).toMatchObject({ type: 'INTERRUPTED', sessionId: id });
    expect(typeof (last as { cause?: unknown }).cause).toBe('string');
    expect(of.events.filter((event) => event.type === 'STOPPED')).toEqual([]);
    await vi.waitFor(() => expect(of.app.engine.slice('alerts').filter((alert) => alert.active && alert.kind === 'CAPTURE_FAULT')).toHaveLength(1), { timeout: 5_000 });
    const alert = of.app.engine.slice('alerts').find((entry) => entry.active && entry.kind === 'CAPTURE_FAULT');
    expect(alert?.message).toMatch(/interrupted/);
    expect(alert?.message).not.toMatch(/stopped growing/);
  });

  it('CONTROL: the same stop of a worker that closes its timeline is STOPPED, with no alert', async () => {
    const { of, id } = await durableSession('fm5_stop_clean');
    await of.app.engine.run('sessions.stopSession', async (scope) => {
      sessionCapture(of.app).stopRequestedIn(scope, id);
      await scope.command(of.investigator, 'stopRecording', 'End of the interview');
    });
    sessionCapture(of.app).afterStopCommitted(id);
    await of.settled();
    expect(of.events.at(-1)).toMatchObject({ type: 'STOPPED', sessionId: id });
    expect(of.app.engine.slice('alerts').filter((alert) => alert.active && alert.kind === 'CAPTURE_FAULT')).toEqual([]);
  });
});

// Fix pass F-M6's request (decision D180; review R80-04): the transcriber's scratch folder of a session
// can hold a raw PCM tap from the moment the tap path was asked for. A start that fails BEFORE the
// transcriber session was opened must still tell the transcription unit the end ("nothing recorded"),
// so that its clean-up removes that folder. (The transcriber is a recording double in this rig: the
// call is held here; that the call removes the folder is `transcription/scratch.ts`'s own test.)
describe('a start that fails before the transcriber session was opened still tells the transcription unit the end', () => {
  it('the worker refuses the START (the tap path was asked, `begin` never ran): `end <id> nothing` is said once', async () => {
    const of = await fixRig('fm5_failed_before_begin', { sttEnabled: true, worker: { ackStart: 'PLAN_INVALID' } });
    const id = await of.arm();
    await of.start(id);
    await of.settled();
    expect(of.app.engine.slice('session')).toMatchObject({ id, state: 'FAULT', captureDurable: false });
    expect(of.transcriber).toEqual([`end ${id} nothing`]);
  });

  it('CONTROL: a clean stop of a session whose plan has no tap tells it nothing (the folder question does not arise)', async () => {
    const { of, id } = await durableSession('fm5_no_tap_stop');
    await of.app.engine.run('sessions.stopSession', async (scope) => {
      sessionCapture(of.app).stopRequestedIn(scope, id);
      await scope.command(of.investigator, 'stopRecording', 'End of the interview');
    });
    sessionCapture(of.app).afterStopCommitted(id);
    await of.settled();
    expect(of.transcriber).toEqual([]);
  });
});

// ── Tidy pass F-Y (the request lines of fix pass F-M3; rulings D179, D188; decision D189) ──────────────────────

const systemAlerts = (of: Rig, reason: string) => of.app.engine.slice('alerts').filter((alert) => alert.active && alert.kind === 'SYSTEM' && alert.params?.['reason'] === reason);
const captureFault = (of: Rig) => of.app.engine.slice('alerts').filter((alert) => alert.active && alert.kind === 'CAPTURE_FAULT');
const camerasOf = async (of: Rig, id: string) => (await readSessionCaptureFacts(of.app.config.mediaStoreDir, id))?.cameras.map((camera) => [camera.deviceId, camera.clockOffsetMs, camera.measuredClockOffsetMs, camera.syncLevel]);

describe('F-Y item 1: the final shape of a stop that is not clean, and what the supervisor refused, reach the session by name', () => {
  it('STOP_TIMEOUT: a worker that ignores the STOP is killed at the grace - the session is handed over INTERRUPTED with that cause, never STOPPED', async () => {
    const { of, id } = await durableSession('fy_stop_timeout', { worker: { exitOnStop: false }, limits: { stopGraceMs: 150 } });
    await stopNow(of, id);
    await vi.waitFor(() => expect(of.events.at(-1)).toMatchObject({ type: 'INTERRUPTED', sessionId: id, cause: 'STOP_TIMEOUT' }), { timeout: 5_000 });
    expect(of.events.filter((event) => event.type === 'STOPPED')).toEqual([]);
    expect(of.supervisor.status().lastCrash).toMatchObject({ code: 'STOP_TIMEOUT', signal: 'SIGKILL' });
    await vi.waitFor(() => expect(captureFault(of).map((alert) => alert.params?.['reason'])).toEqual(['CAPTURE_STOP_NOT_CLEAN']), { timeout: 5_000 });
  });

  it.each([
    ['TELEMETRY_SUBJECT_UNKNOWN', /reported a device that is not part of this session/, (of: Rig) => of.fake.last().say({ type: 'TELEMETRY', levels: [], ingest: [{ deviceId: 'CAM-09', state: 'CONNECTED' }], fragments: [], clocks: [], tapActive: false })],
    ['SWITCH_NOT_COMMANDED', /changed the microphone without a command/, (of: Rig) => of.fake.last().record({ kind: 'AUDIO_SOURCE_INTERVAL', deviceId: 'MIC-02', role: 'STANDBY', index: 2, fromSample: 480, sampleRateHz: 48_000, capturedAtMs: FIXED_NOW, reason: 'OPERATOR_SWITCH', correlationId: 'cap:nobody:1', appliedDelayUs: 1 })],
  ] as const)('%s: the worker is ended, the recording is handed over INTERRUPTED with that cause, and the ONE alert says it in words (not "stopped unexpectedly")', async (cause, words, say) => {
    const { of, id } = await durableSession(`fy_${cause.toLowerCase().slice(0, 12)}`);
    say(of);
    await of.settled();
    await vi.waitFor(() => expect(of.events.at(-1)).toMatchObject({ type: 'INTERRUPTED', sessionId: id, cause }), { timeout: 5_000 });
    await vi.waitFor(() => expect(captureFault(of)).toHaveLength(1), { timeout: 5_000 });
    const alert = captureFault(of)[0];
    expect(alert?.params?.['reason']).toBe(cause);
    expect(alert?.message).toMatch(words);
    expect(alert?.message).not.toMatch(/unexpectedly|stopped growing/);
    const row = (await of.rows<{ details: Record<string, unknown> }>("SELECT details FROM public.audit_log WHERE type = 'FAULT_RAISED' AND session_id = $1 ORDER BY seq DESC LIMIT 1", [id]))[0];
    expect(row?.details).toMatchObject({ kind: 'CAPTURE_FAULT', reason: cause });
  });
});

describe('F-Y item 3: the sync level the worker achieved is kept with the session and told when it is not the full sync', () => {
  it('REAL_DEVELOPMENT (this rig): FSYNC on the first durable fragment is in the capture facts and is ONE advisory (INFO) on the session; the session keeps recording; a second camera file writes no second alert; the stop resolves it', async () => {
    const of = await fixRig('fy_sync_dev');
    const id = await of.arm();
    await of.start(id);
    of.fake.last().record(startInterval);
    of.fake.last().firstDurableFragment('CAM-01', 5_131, 'FSYNC');
    of.fake.last().firstDurableFragment('CAM-02', 5_131, 'FSYNC');
    await of.settled();
    expect(of.app.engine.slice('session')).toMatchObject({ state: 'RECORDING', captureDurable: true });
    expect(await camerasOf(of, id)).toEqual([['CAM-01', 0, null, 'FSYNC'], ['CAM-02', 0, null, 'FSYNC']]);
    const alerts = systemAlerts(of, 'EVIDENCE_VOLUME_SYNC_NOT_FULL');
    expect(alerts.map((alert) => [alert.severity, alert.target, alert.message, alert.params?.['sessionId'], alert.params?.['syncLevel']])).toEqual([['INFO', 'EVIDENCE_VOLUME', 'The evidence volume does not confirm full durability; recordings may not survive a power loss.', id, 'FSYNC']]);
    expect(captureFault(of)).toEqual([]);
    await stopNow(of, id);
    expect(of.events.at(-1)).toMatchObject({ type: 'STOPPED', sessionId: id });
    expect(systemAlerts(of, 'EVIDENCE_VOLUME_SYNC_NOT_FULL')).toEqual([]);
    // The level stays with the session after its capture ended: the seal's reader finds it there.
    expect(await camerasOf(of, id)).toEqual([['CAM-01', 0, null, 'FSYNC'], ['CAM-02', 0, null, 'FSYNC']]);
  });

  it('REAL_PRODUCTION sources: the same level is ONE CRITICAL alert on the session, and the session still records', async () => {
    const of = await fixRig('fy_sync_prod');
    sessionCapture(of.app).replace({ operationOf: () => CaptureOperation.REAL_PRODUCTION, relayReports: SILENT_RELAYS });
    const id = await of.arm();
    await of.start(id);
    of.fake.last().record(startInterval);
    of.fake.last().firstDurableFragment('CAM-01', 5_131, 'FSYNC');
    await of.settled();
    expect(systemAlerts(of, 'EVIDENCE_VOLUME_SYNC_NOT_FULL').map((alert) => [alert.severity, alert.target])).toEqual([['CRITICAL', 'EVIDENCE_VOLUME']]);
    expect(of.app.engine.slice('session')).toMatchObject({ state: 'RECORDING', captureDurable: true });
    expect(captureFault(of)).toEqual([]);
  });

  it('CONTROL: the full sync is kept in the facts and tells the operator nothing', async () => {
    const { of, id } = await durableSession('fy_sync_full');
    expect(await camerasOf(of, id)).toEqual([['CAM-01', 0, null, 'F_FULLFSYNC'], ['CAM-02', 0, null, null]]);
    expect(systemAlerts(of, 'EVIDENCE_VOLUME_SYNC_NOT_FULL')).toEqual([]);
  });
});

describe('F-Y item 4: the clock offset the worker measured is the source of manifest field 40, and a large one is advised', () => {
  it('the threshold is named and 500 ms', () => {
    expect(CAMERA_CLOCK_OFFSET_ADVISORY_MS).toBe(500);
  });

  it('a camera 1.5 s behind is anchored and recorded: the measured offset is kept for field 40 beside the adapter\'s, ONE advisory says the number; 100 ms on the other camera: kept, no advisory; later readings change nothing; the stop resolves the advice', async () => {
    const { of, id } = await durableSession('fy_clock', { clockOffsets: { 'CAM-01': -7, 'CAM-02': 12 } });
    // Arrival minus camera time: the camera's clock is 1.5 s BEHIND the Core's -> camera minus Core = -1500.
    of.fake.last().telemetry(1, [{ deviceId: 'CAM-01', lagMs: 1_500.4 }, { deviceId: 'CAM-02', lagMs: 100 }]);
    await of.settled();
    expect(of.app.engine.slice('session')).toMatchObject({ state: 'RECORDING', captureDurable: true });
    expect(of.supervisor.status().phase).toBe('RECORDING');
    expect(await camerasOf(of, id)).toEqual([['CAM-01', -7, -1_500, 'F_FULLFSYNC'], ['CAM-02', 12, -100, null]]);
    const advice = systemAlerts(of, 'CAMERA_CLOCK_OFFSET');
    expect(advice.map((alert) => [alert.severity, alert.target, alert.message, alert.params?.['offsetMs']])).toEqual([['INFO', 'CAM-01', "Camera clock differs from the Core by 1500 ms; the recording keeps the camera's own timeline and records the offset.", -1_500]]);
    expect(captureFault(of)).toEqual([]);
    // The offset AT ANCHORING: what the same worker says later is drift, not this number.
    of.fake.last().telemetry(2, [{ deviceId: 'CAM-01', lagMs: 1_900 }, { deviceId: 'CAM-02', lagMs: 900 }]);
    await of.settled();
    expect(await camerasOf(of, id)).toEqual([['CAM-01', -7, -1_500, 'F_FULLFSYNC'], ['CAM-02', 12, -100, null]]);
    expect(systemAlerts(of, 'CAMERA_CLOCK_OFFSET')).toHaveLength(1);
    await stopNow(of, id);
    expect(of.events.at(-1)).toMatchObject({ type: 'STOPPED', sessionId: id });
    expect(systemAlerts(of, 'CAMERA_CLOCK_OFFSET')).toEqual([]);
    expect(await camerasOf(of, id)).toEqual([['CAM-01', -7, -1_500, 'F_FULLFSYNC'], ['CAM-02', 12, -100, null]]);
  });

  it('CONTROL: 100 ms on both cameras - measured and kept, no advisory at all; exactly the threshold is not above it', async () => {
    const { of, id } = await durableSession('fy_clock_small');
    of.fake.last().telemetry(1, [{ deviceId: 'CAM-01', lagMs: -100 }, { deviceId: 'CAM-02', lagMs: CAMERA_CLOCK_OFFSET_ADVISORY_MS }]);
    await of.settled();
    expect(await camerasOf(of, id)).toEqual([['CAM-01', 0, 100, 'F_FULLFSYNC'], ['CAM-02', 0, -CAMERA_CLOCK_OFFSET_ADVISORY_MS, null]]);
    expect(systemAlerts(of, 'CAMERA_CLOCK_OFFSET')).toEqual([]);
  });
});

// Fix wave H driver A, C3 (gate 64 condition C3, gate 89 section 7; decisions D199, D202): a camera
// the worker GIVES UP while the session goes on. The supervisor states it (`CaptureCameraEnd`, wave H
// driver F); this unit carries it into the capture facts of the session - where the seal reads it -
// and on the hand-off event, for a CLEAN stop too.
describe('C3: a camera given up while the session went on is handed to the seal with its cause', () => {
  it('CAMERA_CLOCK_OUT_OF_BOUND on CAM-02 mid-recording, then a clean stop: STOPPED carries the end, and the capture facts name the camera, the reason and where its file ended', async () => {
    const of = await fixRig('wha_c3_camera_end');
    const id = await of.arm();
    await of.start(id);
    const worker = of.fake.last();
    worker.firstDurableFragment('CAM-01');
    worker.firstDurableFragment('CAM-02');
    await of.settled();
    worker.warning('CAPTURE_FAULT', 'CAM-02', 'ACTIVE', 'CAMERA_CLOCK_OUT_OF_BOUND');
    await of.settled();
    // The session goes on with the other camera.
    expect(of.app.engine.slice('session')).toMatchObject({ state: 'RECORDING', captureDurable: true });
    await stopNow(of, id);
    const told = of.events.at(-1);
    expect(told).toMatchObject({ type: 'STOPPED', sessionId: id });
    const ends = (told as Extract<SessionCaptureEvent, { type: 'STOPPED' }>).cameraEnds ?? [];
    expect(ends.map((end) => [end.deviceId, end.reason])).toEqual([['CAM-02', 'CAMERA_CLOCK_OUT_OF_BOUND']]);
    const facts = await readSessionCaptureFacts(of.app.config.mediaStoreDir, id);
    expect(facts?.cameras.map((camera) => [camera.trackId, camera.deviceId, camera.ended?.reason ?? null])).toEqual([['VIDEO-01', 'CAM-01', null], ['VIDEO-02', 'CAM-02', 'CAMERA_CLOCK_OUT_OF_BOUND']]);
    // What the supervisor stated is what is kept: the instant and the last durable fragment of that file.
    expect(facts?.cameras[1]?.ended).toEqual({ reason: ends[0]?.reason, at: ends[0]?.at, lastDurableFragmentIndex: ends[0]?.lastDurableFragmentIndex, lastDurableMediaEndMs: ends[0]?.lastDurableMediaEndMs });
  });

  it('CONTROL - no camera was given up: the hand-off carries no `cameraEnds` and no camera of the facts says `ended`', async () => {
    const of = await fixRig('wha_c3_control');
    const id = await of.arm();
    await of.start(id);
    of.fake.last().firstDurableFragment('CAM-01');
    of.fake.last().firstDurableFragment('CAM-02');
    await of.settled();
    await stopNow(of, id);
    expect(of.events.at(-1)).toMatchObject({ type: 'STOPPED', sessionId: id });
    expect('cameraEnds' in (of.events.at(-1) ?? {})).toBe(false);
    expect((await readSessionCaptureFacts(of.app.config.mediaStoreDir, id))?.cameras.map((camera) => camera.ended ?? null)).toEqual([null, null]);
  });
});

// ── Fix wave H, closing pass Z1 (driver A decision 3; ruling D203 (1)) ───────────────────────────
describe('Z1: what the Core holds of a running recording reaches the session payload; the time it states is the host clock', () => {
  const chainOf = async (of: Rig, previous: string, sha: string): Promise<string> => (await of.rows<{ chain: string }>("SELECT encode(sha256(decode($1, 'hex') || decode($2, 'hex')), 'hex') AS chain", [previous, sha]))[0]?.chain ?? '';
  const held = (of: Rig) => (of.app.engine.slice('session') as { captureCheckpoints?: { fragments: number; bytes: number; lastAt: number; cameras: Array<{ deviceId: string; fragments: number; bytes: number }> } } | null)?.captureCheckpoints;

  // ONE rig for both items (a rig holds a database and a pool for the length of the file; the db project runs files side by side).
  it('items 1 and 4: the session starts on the host clock - slice, session, RECORDING_STARTED say RTC and the TIME note held nothing; then the checkpoints of the fake worker become `captureCheckpoints` - absent before the first, by camera, at most every 5 s, the final figure at the stop; no row is written for it', async () => {
    const of = await rig('z1_time_checkpoints');
    // ── Item 1 ──
    expect(of.app.engine.slice('time')).toMatchObject({ hostClock: true, source: 'RTC', locked: false, gnss: { locked: false, satellites: 0 } });
    await of.app.engine.setTabletLink('CONNECTED');
    const created = await of.app.engine.command(of.investigator, 'createSession', { caseNumber: 'LP/2026/1001-0790', subjectType: 'SAKSI', subjectName: 'Test Subject', room: 'Interview Room 1', profileId: 'STANDARD_1080P25', investigatorId: of.investigator.operatorId });
    if (!created.value.ok) throw new Error(`the session was not created: ${created.value.reason}`);
    const id = created.value.sessionId;
    await of.app.engine.command(of.investigator, 'beginPrecheck');
    await of.drive(5_000);
    // NOT acknowledged by anybody: the note does not hold the gate.
    const armed = of.app.engine.slice('session');
    expect(armed).toMatchObject({ state: 'ARMED', precheck: { outcome: 'PASS', warningsAcknowledged: false } });
    expect(armed?.precheck.items.find((item) => item.id === 'TIME')).toMatchObject({ status: 'WARN', value: 'HOST_SYSTEM_CLOCK', reason: 'Time source: host system clock (no GNSS)', reasonCode: null, params: { rule: 'TIME_HOST_CLOCK' } });
    await of.start(id);
    expect(of.app.engine.slice('session')).toMatchObject({ state: 'RECORDING', startTimeSource: 'RTC' });
    const started = await of.rows<{ details: Record<string, unknown> }>("SELECT details FROM public.audit_log WHERE type = 'RECORDING_STARTED' AND session_id = $1", [id]);
    expect(started.map((row) => row.details)).toEqual([{ timeSource: 'RTC' }]);
    // No row of this session says GNSS, and the pre-check row counts no warning.
    const rows = await of.rows<{ type: string; details: Record<string, unknown> }>('SELECT type, details FROM public.audit_log WHERE session_id = $1 ORDER BY seq', [id]);
    expect(JSON.stringify(rows)).not.toContain('GNSS');
    expect(rows.find((row) => row.type === 'PRECHECK_PASSED')?.details).toMatchObject({ warnings: 0, acknowledged: false });

    // ── Item 4 ──
    const worker = of.fake.last();
    worker.record(startInterval);
    worker.firstDurableFragment('CAM-01');
    worker.firstDurableFragment('CAM-02');
    await of.settled();
    // Durable, and no checkpoint yet: the member is ABSENT (not stated), never a 0.
    expect(of.app.engine.slice('session')).toMatchObject({ state: 'RECORDING', captureDurable: true });
    expect(held(of)).toBeUndefined();

    const sha = SHA('a');
    const chain1 = await chainOf(of, GENESIS, sha);
    const chain2 = await chainOf(of, chain1, sha);
    const chain3 = await chainOf(of, chain2, sha);
    const firstAt = of.app.clock.now();
    worker.record(checkpoint(1, 1_231, chain1, sha));
    await of.settled();
    expect(held(of)).toEqual({ fragments: 1, bytes: 2_231, lastAt: firstAt, cameras: [{ deviceId: 'CAM-01', fragments: 1, bytes: 2_231 }] });

    // Inside the 5 s window: heard, not said (one engine unit per window, not per fragment).
    worker.record(checkpoint(2, 2_231, chain2, sha));
    await of.settled();
    expect(held(of)?.fragments).toBe(1);

    // The window has passed on the Core clock: the next checkpoint says everything heard so far, by camera.
    await of.drive(5_000);
    const laterAt = of.app.clock.now();
    worker.record({ ...checkpoint(1, 900, chain1, sha), deviceId: 'CAM-02' } as CaptureRecord);
    await of.settled();
    expect(held(of)).toEqual({
      fragments: 3,
      bytes: 3_231 + 1_900,
      lastAt: laterAt,
      cameras: [{ deviceId: 'CAM-01', fragments: 2, bytes: 3_231 }, { deviceId: 'CAM-02', fragments: 1, bytes: 1_900 }],
    });

    // One more inside the window, then the stop: the end of the capture says the final figure.
    worker.record(checkpoint(3, 3_231, chain3, sha));
    await of.settled();
    expect(held(of)?.fragments).toBe(3);
    worker.record({ kind: 'AUDIO_TIMELINE_END', samples: 480_000, sampleRateHz: 48_000, intervals: 1 });
    await stopNow(of, id);
    expect(of.events.at(-1)).toMatchObject({ type: 'STOPPED', sessionId: id });
    expect(held(of)).toMatchObject({ fragments: 4, bytes: 4_231 + 1_900 });
    // The figures agree with the rows the recorder stored, and the door itself wrote nothing.
    expect(await of.rows('SELECT track_id, count(*)::int AS n FROM public.recording_fragments WHERE session_id = $1 GROUP BY track_id ORDER BY track_id', [id])).toEqual([{ track_id: 'VIDEO-01', n: 3 }, { track_id: 'VIDEO-02', n: 1 }]);
    expect(await of.rows("SELECT type FROM public.audit_log WHERE type ILIKE '%CHECKPOINT%'")).toEqual([]);
  });

});

// ── Task 4 row 47 (WP-06b): the cameras of a start ──────────────────────────────────────────────
// The devices are the fake adapters of the rig behind a wrapper that records what each camera
// adapter was asked and scripts when it answers. No relay, no worker process and no camera exists
// here: that an adapter of production hands the address to its relay on standard input is row 46's
// proof, the eight-place search and the reveal count are row 151's.
describe('task 4 row 47: the cameras of a start - the address, the profile, the same turn, the bound, outside every unit', () => {
  interface Asked {
    readonly deviceId: string;
    readonly target: { readonly ingestUrl: string; readonly profile?: string };
    readonly signal: AbortSignal;
  }
  type Script = (deviceId: string, pass: () => Promise<SourceHandle>, signal: AbortSignal) => Promise<SourceHandle>;
  function cameras(script: Script = (_deviceId, pass) => pass()): { readonly asked: Asked[]; readonly registry: (built: CaptureDeviceRegistry) => CaptureDeviceRegistry } {
    const asked: Asked[] = [];
    const registry = (built: CaptureDeviceRegistry): CaptureDeviceRegistry => ({
      ...built,
      resolve: ((deviceClass: 'CAMERA' | 'MIC', deviceId: string) => {
        if (deviceClass === 'MIC') return built.resolve('MIC', deviceId);
        const adapter = built.resolve('CAMERA', deviceId);
        return {
          ...adapter,
          openSource: (id: string, to: Parameters<typeof adapter.openSource>[1], signal: AbortSignal) => {
            asked.push({ deviceId: id, target: to, signal });
            return script(id, () => adapter.openSource(id, to, signal), signal);
          },
        };
      }) as CaptureDeviceRegistry['resolve'],
    });
    return { asked, registry };
  }
  /** The start as the route makes it, WITHOUT waiting for the background work: the case looks at a start that is still running. */
  const startAndReturn = async (of: Rig, id: string): Promise<void> => {
    await sessionCapture(of.app).beforeStart();
    await of.app.engine.run('sessions.startSession', async (scope) => {
      await scope.command(of.investigator, 'startRecording');
      await sessionCapture(of.app).recordingStartedIn(scope, id);
    });
    sessionCapture(of.app).afterStartCommitted(id);
  };
  const notOpenedLines = (of: Rig): Array<Record<string, unknown>> => of.log.lines().filter((line) => line.code === 'CAPTURE_CAMERA_NOT_OPENED');

  it('each camera adapter is asked ONCE, with the address of the plan frame byte for byte and the profile of the plan; the two tracks carry different 128-bit elements; the address is in no log line, audit row, session row, event or facts file', async () => {
    const seen = cameras();
    const of = await rig('r47_address', { registry: seen.registry });
    const id = await of.arm();
    await of.start(id);
    const plan = of.fake.last().commands('START')[0]?.plan;
    expect(plan?.cameras.map((camera) => camera.deviceId)).toEqual(['CAM-01', 'CAM-02']);
    const inPlan = (deviceId: string) => plan?.cameras.find((camera) => camera.deviceId === deviceId);

    // One open per camera of the plan (AD-11: one credential read per camera per attempt), each told the plan's own string and profile.
    expect(seen.asked.map((ask) => ask.deviceId)).toEqual(['CAM-01', 'CAM-02']);
    expect(seen.asked.map((ask) => ask.target.ingestUrl === inPlan(ask.deviceId)?.ingestUrl)).toEqual([true, true]);
    expect(seen.asked.map((ask) => typeof ask.target.profile === 'string' && ask.target.profile === inPlan(ask.deviceId)?.profile)).toEqual([true, true]);

    // BR-07 (1): 16 bytes of the random source per track, in the grammar; the two tracks differ.
    const elements = (plan?.cameras ?? []).map((camera) => elementOf(camera.ingestUrl));
    expect(elements.map((element) => INGEST_ELEMENT.test(element) && Buffer.from(element, 'base64url').length === 16)).toEqual([true, true]);
    expect(new Set(elements).size).toBe(2);

    // BR-07 (4), at the level of this unit: the element is in none of the places this unit writes.
    of.fake.last().record(startInterval);
    of.fake.last().firstDurableFragment('CAM-01');
    await of.settled();
    const tables = await of.rows<{ text: string }>(
      "SELECT row_to_json(a)::text AS text FROM public.audit_log a UNION ALL SELECT row_to_json(s)::text FROM public.session_capture_sources s UNION ALL SELECT row_to_json(i)::text FROM public.session_audio_intervals i UNION ALL SELECT row_to_json(f)::text FROM public.recording_fragments f",
    );
    const places: Record<string, string> = {
      log: of.log.text(),
      tables: tables.map((row) => row.text).join('\n'),
      events: JSON.stringify(of.events),
      facts: JSON.stringify(await readSessionCaptureFacts(of.app.config.mediaStoreDir, id)),
    };
    // Each place holds something of this session (the search is not of an empty text) and none holds an element.
    expect(Object.values(places).map((text) => text.includes(id))).toEqual([true, true, true, true]);
    expect(Object.entries(places).filter(([, text]) => elements.some((element) => text.includes(element))).map(([place]) => place)).toEqual([]);
    // CONTROL of the search: the same needle finds the element where it must be, in the frame the worker was sent.
    expect(elements.every((element) => JSON.stringify(of.fake.last().commands('START')).includes(element))).toBe(true);
  });

  it('both cameras are opened in the same turn: a first camera that has not answered (a camera that needs 20 s) does not delay the second; the development operation gives no open up at a bound; STARTED names the cameras in the order of the plan', async () => {
    let answer: () => void = () => undefined;
    const slow = new Promise<void>((resolve) => (answer = resolve));
    const seen = cameras(async (deviceId, pass) => {
      if (deviceId === 'CAM-01') await slow;
      return pass();
    });
    const of = await rig('r47_same_turn', { registry: seen.registry });
    // A bound far below the time this case holds the camera: REAL_DEVELOPMENT must not apply it.
    sessionCapture(of.app).replace({ cameraOpenBoundMs: 40 });
    const id = await of.arm();
    await startAndReturn(of, id);
    // The second camera is open while the first has not answered: with one open after the other this never happens.
    await vi.waitFor(() => expect(of.order).toContain('open CAM-02'), { timeout: 5_000 });
    expect(seen.asked.map((ask) => ask.deviceId)).toEqual(['CAM-01', 'CAM-02']);
    expect(of.order).not.toContain('open CAM-01');
    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(of.events.map((event) => event.type)).toEqual(['CONNECTING']);
    expect(seen.asked.map((ask) => ask.signal.aborted)).toEqual([false, false]);
    expect(notOpenedLines(of)).toEqual([]);

    answer();
    await of.settled();
    expect(of.order.filter((entry) => entry.startsWith('open CAM'))).toEqual(['open CAM-02', 'open CAM-01']);
    expect(of.events.at(-1)).toEqual({ type: 'STARTED', sessionId: id, cameras: ['CAM-01', 'CAM-02'], camerasNotOpened: [] });
    // Still one open per camera.
    expect(seen.asked).toHaveLength(2);
  });

  it('REAL_PRODUCTION: an open with no outcome is given up at the bound - its own signal is aborted, the session and the other camera go on, the camera is said not opened with the cause, a source that comes up later is closed at once; each adapter was asked once', async () => {
    let bring: (handle: SourceHandle) => void = () => undefined;
    const late = new Promise<SourceHandle>((resolve) => (bring = resolve));
    const seen = cameras((deviceId, pass) => (deviceId === 'CAM-01' ? late : pass()));
    const of = await rig('r47_bound', { registry: seen.registry });
    sessionCapture(of.app).replace({ operationOf: () => CaptureOperation.REAL_PRODUCTION, relayReports: SILENT_RELAYS, cameraOpenBoundMs: 60 });
    const id = await of.arm();
    await of.start(id);
    expect(of.events.at(-1)).toEqual({ type: 'STARTED', sessionId: id, cameras: ['CAM-02'], camerasNotOpened: ['CAM-01'] });
    expect(seen.asked.map((ask) => [ask.deviceId, ask.signal.aborted])).toEqual([['CAM-01', true], ['CAM-02', false]]);
    expect(notOpenedLines(of).map((line) => [line.deviceId, line.cause])).toEqual([['CAM-01', 'CAMERA_OPEN_BOUND']]);
    // The session was not ended by the bound of one camera.
    expect(sessionCapture(of.app).liveSessionId()).toBe(id);
    expect(of.fake.last().commands('STOP')).toHaveLength(0);
    expect(of.order.filter((entry) => entry.startsWith('close'))).toEqual([]);

    // The source of the camera that was given up comes up after all: closed at once, and it is no source of the session.
    let closed = 0;
    bring({ deviceId: 'CAM-01', close: async () => void (closed += 1) });
    await vi.waitFor(() => expect(closed).toBe(1), { timeout: 5_000 });
    await of.settled();
    expect(of.events.filter((event) => event.type === 'STARTED')).toHaveLength(1);
    expect(seen.asked).toHaveLength(2);
    expect(notOpenedLines(of)).toHaveLength(1);
    await sessionCapture(of.app).shutdown();
    expect(closed).toBe(1);
  });

  it('a camera is opened OUTSIDE every unit of work: an adapter that submits a unit of its own inside `openSource` (as the credential read of production does) is served; CONTROL: the same call inside the unit of the start is refused PIPELINE_REENTRANT', async () => {
    const holder: { app: Rig['app'] | null } = { app: null };
    const reads: string[] = [];
    const ownUnit = async (): Promise<string> => {
      if (holder.app === null) throw new Error('the case did not hand the app over');
      return holder.app.pipeline.run('captureConfig.credentialRead', async () => 'COMMITTED').then(
        (value) => value,
        (error: unknown) => String((error as { code?: unknown }).code ?? 'FAILED'),
      );
    };
    const seen = cameras(async (deviceId, pass) => {
      reads.push(`${deviceId} ${await ownUnit()}`);
      return pass();
    });
    const of = await rig('r47_outside_unit', { registry: seen.registry });
    holder.app = of.app;
    const id = await of.arm();
    let insideTheStart = 'NOT ASKED';
    await sessionCapture(of.app).beforeStart();
    await of.app.engine.run('sessions.startSession', async (scope) => {
      await scope.command(of.investigator, 'startRecording');
      await sessionCapture(of.app).recordingStartedIn(scope, id);
      // CONTROL: this is what an open made here, in the unit of the start, would get.
      insideTheStart = await ownUnit();
      // Nothing was opened inside the unit.
      expect(seen.asked).toEqual([]);
    });
    sessionCapture(of.app).afterStartCommitted(id);
    await of.settled();
    expect(insideTheStart).toBe('PIPELINE_REENTRANT');
    expect(reads.sort()).toEqual(['CAM-01 COMMITTED', 'CAM-02 COMMITTED']);
    expect(of.events.at(-1)).toEqual({ type: 'STARTED', sessionId: id, cameras: ['CAM-01', 'CAM-02'], camerasNotOpened: [] });
  });

  // ── Task 4 row 179 (BR-07 (2)): the address of a camera open is the one of the worker in force ──
  // The "relay" of these cases is the camera adapter double: `seen.asked` is what a relay of production would be started with.
  const planOfWorker = (of: Rig, index: number): Record<string, string> => Object.fromEntries((of.fake.workers[index]?.commands('START')[0]?.plan.cameras ?? []).map((camera) => [camera.deviceId, camera.ingestUrl]));
  const askedOf = (asked: readonly Asked[]): Array<[string, string]> => asked.map((ask) => [ask.deviceId, ask.target.ingestUrl]);
  const FAST_RESTART = { backoffBaseMs: 20, backoffMaxMs: 40 };

  it('row 179: the first worker of a session never comes up - the cameras are opened ONCE, with the addresses of the worker that did (attempt 2), in the development operation as well', async () => {
    const seen = cameras();
    const of = await rig('r179_first_fails', { registry: seen.registry, limits: FAST_RESTART });
    of.fake.failNext(1);
    const id = await of.arm();
    await of.start(id);
    expect(of.fake.workers).toHaveLength(1);
    expect(of.fake.last().commands('START')).toMatchObject([{ attempt: 2 }]);
    const second = planOfWorker(of, 0);
    expect(askedOf(seen.asked)).toEqual([['CAM-01', second['CAM-01']], ['CAM-02', second['CAM-02']]]);
    expect(Object.values(second).map((address) => INGEST_ELEMENT.test(elementOf(address)))).toEqual([true, true]);
    expect(of.events.at(-1)).toEqual({ type: 'STARTED', sessionId: id, cameras: ['CAM-01', 'CAM-02'], camerasNotOpened: [] });
  });

  it('row 179, REAL_PRODUCTION: the worker of a recording is replaced before anything is durable - the sources of attempt 1 are closed, every camera is opened again, and each open is handed the string of ITS OWN attempt; no element is used twice; nothing of it is written', async () => {
    const seen = cameras();
    const of = await rig('r179_two_attempts', { registry: seen.registry, limits: FAST_RESTART });
    sessionCapture(of.app).replace({ operationOf: () => CaptureOperation.REAL_PRODUCTION, relayReports: SILENT_RELAYS });
    const id = await of.arm();
    await of.start(id);
    const first = planOfWorker(of, 0);
    expect(askedOf(seen.asked)).toEqual([['CAM-01', first['CAM-01']], ['CAM-02', first['CAM-02']]]);
    of.order.length = 0;

    of.fake.last().exit(1);
    await vi.waitFor(() => expect(seen.asked).toHaveLength(4), { timeout: 5_000 });
    await of.settled();
    expect(of.fake.workers).toHaveLength(2);
    expect(of.fake.last().commands('START')).toMatchObject([{ attempt: 2 }]);
    const second = planOfWorker(of, 1);
    // The relay double of each attempt received the string of its own attempt, byte for byte.
    expect(askedOf(seen.asked.slice(2))).toEqual([['CAM-01', second['CAM-01']], ['CAM-02', second['CAM-02']]]);
    // Four addresses, four elements: none of attempt 1 is in the plan or in an open of attempt 2.
    const elements = [...Object.values(first), ...Object.values(second)].map(elementOf);
    expect(elements.map((element) => INGEST_ELEMENT.test(element))).toEqual([true, true, true, true]);
    expect(new Set(elements).size).toBe(4);
    // The camera sources of the earlier worker were closed BEFORE the cameras were opened again; no microphone was touched.
    const cameraSteps = of.order.filter((entry) => / CAM-/.test(entry));
    expect(cameraSteps.slice(0, 2).sort()).toEqual(['close CAM-01', 'close CAM-02']);
    expect(cameraSteps.slice(2).sort()).toEqual(['open CAM-01', 'open CAM-02']);
    expect(of.order.filter((entry) => /close MIC-/.test(entry))).toEqual([]);
    expect(of.log.lines().filter((line) => line.code === 'CAPTURE_CAMERA_NOT_OPENED' || line.code === 'CAPTURE_SOURCE_NOT_CLOSED')).toEqual([]);
    expect(of.events.filter((event) => event.type === 'STARTED')).toHaveLength(1);
    expect(sessionCapture(of.app).liveSessionId()).toBe(id);

    // The session records with the second worker and stops cleanly: the sources of attempt 2 are closed once.
    of.fake.last().record(startInterval);
    of.fake.last().firstDurableFragment('CAM-01');
    await of.settled();
    const tables = await of.rows<{ text: string }>("SELECT row_to_json(a)::text AS text FROM public.audit_log a UNION ALL SELECT row_to_json(s)::text FROM public.session_capture_sources s");
    const places = [of.log.text(), tables.map((row) => row.text).join('\n'), JSON.stringify(of.events), JSON.stringify(await readSessionCaptureFacts(of.app.config.mediaStoreDir, id))];
    expect(places.map((text) => text.includes(id))).toEqual([true, true, true, true]);
    expect(places.map((text) => elements.some((element) => text.includes(element)))).toEqual([false, false, false, false]);
    await sessionCapture(of.app).shutdown();
    expect(of.order.filter((entry) => /close CAM-/.test(entry)).sort()).toEqual(['close CAM-01', 'close CAM-01', 'close CAM-02', 'close CAM-02']);
  });

  it('row 179, REAL_PRODUCTION: an open of attempt 1 that is still in flight when its worker goes down is given up without a report - its signal is aborted, STARTED waits for the opens of attempt 2 and names them, a source that comes up late is closed', async () => {
    let bring: (handle: SourceHandle) => void = () => undefined;
    const late = new Promise<SourceHandle>((resolve) => (bring = resolve));
    let asks = 0;
    const seen = cameras((deviceId, pass) => (deviceId === 'CAM-01' && (asks += 1) === 1 ? late : pass()));
    const of = await rig('r179_in_flight', { registry: seen.registry, limits: FAST_RESTART });
    sessionCapture(of.app).replace({ operationOf: () => CaptureOperation.REAL_PRODUCTION, relayReports: SILENT_RELAYS, cameraOpenBoundMs: 30_000 });
    const id = await of.arm();
    await startAndReturn(of, id);
    await vi.waitFor(() => expect(of.order).toContain('open CAM-02'), { timeout: 5_000 });
    expect(of.events.map((event) => event.type)).toEqual(['CONNECTING']);
    of.fake.last().exit(1);
    await vi.waitFor(() => expect(seen.asked).toHaveLength(4), { timeout: 5_000 });
    await of.settled();
    const second = planOfWorker(of, 1);
    expect(seen.asked.map((ask) => [ask.deviceId, ask.signal.aborted])).toEqual([['CAM-01', true], ['CAM-02', false], ['CAM-01', false], ['CAM-02', false]]);
    expect(askedOf(seen.asked.slice(2))).toEqual([['CAM-01', second['CAM-01']], ['CAM-02', second['CAM-02']]]);
    expect(of.events.filter((event) => event.type === 'STARTED')).toEqual([{ type: 'STARTED', sessionId: id, cameras: ['CAM-01', 'CAM-02'], camerasNotOpened: [] }]);
    expect(notOpenedLines(of)).toEqual([]);
    let closed = 0;
    bring({ deviceId: 'CAM-01', close: async () => void (closed += 1) });
    await vi.waitFor(() => expect(closed).toBe(1), { timeout: 5_000 });
    await sessionCapture(of.app).shutdown();
    expect(closed).toBe(1);
  });

  it('row 179, CONTROL - the development operation is as before: a worker replaced during a recording gets its new plan, and no camera source is closed or opened again', async () => {
    const seen = cameras();
    const of = await rig('r179_development', { registry: seen.registry, limits: FAST_RESTART });
    const id = await of.arm();
    await of.start(id);
    of.order.length = 0;
    of.fake.last().exit(1);
    await vi.waitFor(() => expect(of.fake.workers).toHaveLength(2), { timeout: 5_000 });
    await vi.waitFor(() => expect(of.fake.last().commands('START')).toHaveLength(1), { timeout: 5_000 });
    await of.settled();
    expect(seen.asked).toHaveLength(2);
    expect(of.order.filter((entry) => / CAM-/.test(entry))).toEqual([]);
    // The plan of the later worker is renewed in every real operation (the supervisor does not know the operation).
    expect(new Set([...Object.values(planOfWorker(of, 0)), ...Object.values(planOfWorker(of, 1))].map(elementOf)).size).toBe(4);
    await sessionCapture(of.app).shutdown();
  });
});

describe('task 4 row 48 (SA-3; RC-3, AD-01 (4), BR-08): a camera counts as open only when the report of its relay and the connect report of the worker are paired', () => {
  // THE DOUBLES: the relay's report is a fake of the injected source (its program is rows 43, 44); the worker's connect
  // report is a telemetry frame of the fake worker; "production" is the port `operationOf` over the fake adapters.
  const BOUND_MS = 120;
  function relays() {
    const listeners = new Set<(report: { sessionId: string; deviceId: string; attempt: number }) => void>();
    return {
      source: { subscribe: (listener: (report: { sessionId: string; deviceId: string; attempt: number }) => void) => (listeners.add(listener), () => void listeners.delete(listener)) },
      report: (sessionId: string, deviceId: string, attempt = 1) => listeners.forEach((listener) => listener({ sessionId, deviceId, attempt })),
      subscribed: () => listeners.size,
    };
  }
  const ingest = (of: Rig, deviceId: string, state: 'WAITING' | 'CONNECTED' | 'ENDED'): void => of.fake.last().say({ type: 'TELEMETRY', levels: [], ingest: [{ deviceId, state }], fragments: [], clocks: [], tapActive: false });
  const refused = (of: Rig, deviceId: string): void => of.fake.last().say({ type: 'WARNING', code: 'CAPTURE_FAULT', reason: 'CAMERA_NOT_CONNECTED', state: 'ACTIVE', subject: deviceId });
  const linesOf = (of: Rig, code: string): Array<Record<string, unknown>> => of.log.lines().filter((line) => line.code === code);
  const paired = (of: Rig): string[] => linesOf(of, 'CAPTURE_CAMERA_INGEST_PAIRED').map((line) => `${String(line.deviceId)}@${String(line.attempt)}`);
  const notPaired = (of: Rig): string[] => linesOf(of, 'CAPTURE_INGEST_NOT_PAIRED').map((line) => `${String(line.deviceId)}@${String(line.attempt)} ${String(line.reason)}`);
  const auditOfTheFault = async (of: Rig): Promise<number> => (await of.rows<{ text: string }>('SELECT row_to_json(a)::text AS text FROM public.audit_log a')).filter((row) => row.text.includes('CAMERA_INGEST_NOT_PAIRED')).length;
  const wait = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));
  async function production(slug: string, with_: { source?: boolean; operation?: CaptureOperation } = {}) {
    const relay = relays();
    const of = await rig(slug);
    sessionCapture(of.app).replace({ operationOf: () => with_.operation ?? CaptureOperation.REAL_PRODUCTION, ingestPairingBoundMs: BOUND_MS, ...(with_.source === false ? {} : { relayReports: relay.source }) });
    const id = await of.arm();
    await of.start(id);
    return { of, id, relay };
  }
  /** The capture of the session was ended by the pairing: one error line, one audit entry with the cause, the worker stopped, every source closed. */
  async function endedByThePairing(of: Rig, id: string, why: string): Promise<void> {
    await vi.waitFor(() => expect(notPaired(of)).toEqual([why]), { timeout: 5_000 });
    await of.settled();
    expect(sessionCapture(of.app).liveSessionId()).toBeNull();
    expect(of.fake.last().commands('STOP')).toHaveLength(1);
    expect(of.order.filter((entry) => entry.startsWith('close')).sort()).toEqual(['close CAM-01', 'close CAM-02', 'close MIC-01', 'close MIC-02']);
    expect(await auditOfTheFault(of)).toBe(1);
    expect(of.events.at(-1)).toMatchObject({ type: 'FAILED_START', sessionId: id, cause: 'CAMERA_INGEST_NOT_PAIRED' });
    // C35 (b): the session is in FAULT by the capture, its fault row states the cause, and ONE critical notice is active for it.
    expect(of.app.engine.slice('session')).toMatchObject({ id, state: 'FAULT', fault: { kind: 'CAPTURE_FAULT' } });
    expect(of.app.engine.slice('session')?.timeline.at(-1)).toMatchObject({ kind: 'FAULT', params: { kind: 'CAPTURE_FAULT', reason: 'CAMERA_INGEST_NOT_PAIRED' } });
    expect(of.app.engine.slice('alerts').filter((alert) => alert.kind === 'CAPTURE_FAULT' && alert.active).map((alert) => alert.severity)).toEqual(['CRITICAL']);
    expect((await faultRows(of)).filter((row) => row.startsWith('FAULT_RAISED CAPTURE_FAULT'))).toHaveLength(1);
    // Said once, however long one waits.
    await wait(BOUND_MS * 2);
    expect([notPaired(of).length, await auditOfTheFault(of)]).toEqual([1, 1]);
  }

  it('both arrive inside the bound, in BOTH orders (relay first for CAM-01, worker first for CAM-02): both cameras count as open, the capture goes on past the bound; a report of another session is dropped', async () => {
    const { of, id, relay } = await production('r48_both_orders');
    expect(relay.subscribed()).toBe(1);
    relay.report(id, 'CAM-01');
    ingest(of, 'CAM-02', 'CONNECTED');
    await flush();
    expect(paired(of)).toEqual([]);
    ingest(of, 'CAM-01', 'CONNECTED');
    relay.report(id, 'CAM-02');
    await vi.waitFor(() => expect(paired(of).sort()).toEqual(['CAM-01@1', 'CAM-02@1']), { timeout: 5_000 });
    // The level said again and again is ONE connect report; a relay report of another session counts for nothing.
    ingest(of, 'CAM-01', 'CONNECTED');
    ingest(of, 'CAM-02', 'CONNECTED');
    relay.report('S-OTHER-SESSION', 'CAM-01');
    await wait(BOUND_MS * 2);
    expect([notPaired(of), sessionCapture(of.app).liveSessionId(), of.fake.last().commands('STOP').length, await auditOfTheFault(of)]).toEqual([[], id, 0, 0]);
    await sessionCapture(of.app).shutdown();
    expect(relay.subscribed()).toBe(0);
  });

  it('the relay reports and the worker\'s connect report does not come within the bound: a capture fault with ONE audit entry that ends the capture', async () => {
    const { of, id, relay } = await production('r48_relay_only');
    relay.report(id, 'CAM-01');
    await endedByThePairing(of, id, 'CAM-01@1 WORKER_REPORT_MISSING');
  });

  it('the worker reports a connect and no relay of the session reports within the bound (a pusher that is not ours): the same fault, ONE audit entry', async () => {
    const { of, id } = await production('r48_worker_only');
    ingest(of, 'CAM-02', 'CONNECTED');
    await endedByThePairing(of, id, 'CAM-02@1 RELAY_REPORT_MISSING');
  });

  it('a duplicate: a second connect report on the listener of a camera that already counted as open is a capture fault (AD-01 (4)); a second relay report as well', async () => {
    const { of, id, relay } = await production('r48_second_connect');
    relay.report(id, 'CAM-01');
    ingest(of, 'CAM-01', 'CONNECTED');
    await vi.waitFor(() => expect(paired(of)).toEqual(['CAM-01@1']), { timeout: 5_000 });
    ingest(of, 'CAM-01', 'WAITING');
    await flush();
    ingest(of, 'CAM-01', 'CONNECTED');
    await endedByThePairing(of, id, 'CAM-01@1 WORKER_CONNECTED_TWICE');

    const again = await production('r48_second_relay');
    again.relay.report(again.id, 'CAM-02');
    again.relay.report(again.id, 'CAM-02');
    await endedByThePairing(again.of, again.id, 'CAM-02@1 RELAY_REPORTED_TWICE');
  });

  it('BR-08: the worker refuses the listener of a camera (the frame of both refusal codes of the worker\'s gate) although its relay reported - a capture fault with ONE audit entry and ONE critical notice', async () => {
    const { of, id, relay } = await production('r48_refused');
    relay.report(id, 'CAM-01');
    refused(of, 'CAM-01');
    await endedByThePairing(of, id, 'CAM-01@1 WORKER_REFUSED');
  });

  // Task 4 row 182: since the worker NAMES its gate's refusal in the frame, the same contradiction arrives under one of two new words.
  // Task 4 row 188 (ruling C40 (2)): ONE arrival, ONE critical notice - the one of the ended capture. The camera's own notice, which the
  // forwarder raised for the gate's refusal, is resolved by the session unit once the capture's fault stands.
  it.each(['CAMERA_ANNOUNCE_NOT_MATCHED', 'CAMERA_ANNOUNCE_NOT_SEEN'] as const)(
    'BR-08 with the frame member %s: the pairing still ends the capture ONCE (WORKER_REFUSED, one audit entry of the pairing) and the operator has ONE critical notice, with the stronger cause',
    async (reason) => {
      const { of, id, relay } = await production(`r182_refused_${reason === 'CAMERA_ANNOUNCE_NOT_SEEN' ? 'not_seen' : 'not_matched'}`);
      relay.report(id, 'CAM-01');
      of.fake.last().say({ type: 'WARNING', code: 'CAPTURE_FAULT', reason, state: 'ACTIVE', subject: 'CAM-01' });
      await vi.waitFor(() => expect(notPaired(of)).toEqual(['CAM-01@1 WORKER_REFUSED']), { timeout: 5_000 });
      await of.settled();
      expect(sessionCapture(of.app).liveSessionId()).toBeNull();
      expect(of.fake.last().commands('STOP')).toHaveLength(1);
      expect(await auditOfTheFault(of)).toBe(1);
      expect(of.events.at(-1)).toMatchObject({ type: 'FAILED_START', sessionId: id, cause: 'CAMERA_INGEST_NOT_PAIRED' });
      expect(of.events.some((event) => event.type === 'CAMERA_NOT_CONNECTED')).toBe(false);
      expect(of.app.engine.slice('session')).toMatchObject({ id, state: 'FAULT', fault: { kind: 'CAPTURE_FAULT' } });
      // ONE critical notice is active: the capture's (the pairing ended it). The camera's own notice was raised and is resolved.
      await vi.waitFor(() => expect(linesOf(of, 'CAPTURE_GATE_NOTICE_FOLDED')).toHaveLength(1), { timeout: 5_000 });
      await of.settled();
      const notices = of.app.engine.slice('alerts').filter((alert) => alert.kind === 'CAPTURE_FAULT');
      expect(notices.filter((alert) => alert.active).map((alert) => `${alert.severity} ${String(alert.params?.['reason'])} ${String(alert.target)}`)).toEqual(['CRITICAL CAMERA_INGEST_NOT_PAIRED null']);
      expect(notices.filter((alert) => !alert.active).map((alert) => `${String(alert.params?.['reason'])} ${String(alert.target)}`)).toEqual([`${reason} CAM-01`]);
      expect(linesOf(of, 'CAPTURE_GATE_NOTICE_FOLDED')).toMatchObject([{ sessionId: id, deviceId: 'CAM-01', attempt: 1, gateReason: reason, cause: 'CAMERA_INGEST_NOT_PAIRED' }]);
      // The error-log entry of the pairing names the gate's own word beside its reason: nothing of the refusal is lost.
      expect(linesOf(of, 'CAPTURE_INGEST_NOT_PAIRED')).toMatchObject([{ deviceId: 'CAM-01', attempt: 1, reason: 'WORKER_REFUSED', gateReason: reason }]);
      // THE AUDIT TRAIL, measured: ONE entry of the pairing's fault; the gate's refusal keeps its own two (raised by the forwarder, resolved here).
      expect(await auditOfTheFault(of)).toBe(1);
      expect(await faultRows(of)).toEqual(['FAULT_RAISED CAPTURE_FAULT@CAM-01', 'FAULT_RAISED CAPTURE_FAULT@null', 'FAULT_CLEARED CAPTURE_FAULT@CAM-01']);
      expect(linesOf(of, 'CAPTURE_GATE_NOTICE_NOT_FOLDED')).toEqual([]);
    },
  );

  it('row 188, C40 (2) - the OTHER order of the same arrival: the gate\'s refusal is said first and the relay\'s report after it; the pairing ends the capture at the bound and the operator still has ONE critical notice', async () => {
    const { of, id, relay } = await production('r188_gate_then_relay');
    of.fake.last().say({ type: 'WARNING', code: 'CAPTURE_FAULT', reason: 'CAMERA_ANNOUNCE_NOT_MATCHED', state: 'ACTIVE', subject: 'CAM-02' });
    await flush();
    relay.report(id, 'CAM-02');
    await vi.waitFor(() => expect(notPaired(of)).toEqual(['CAM-02@1 WORKER_REPORT_MISSING']), { timeout: 5_000 });
    await vi.waitFor(() => expect(linesOf(of, 'CAPTURE_GATE_NOTICE_FOLDED')).toHaveLength(1), { timeout: 5_000 });
    await of.settled();
    expect(of.app.engine.slice('alerts').filter((alert) => alert.kind === 'CAPTURE_FAULT' && alert.active).map((alert) => `${alert.severity} ${String(alert.params?.['reason'])}`)).toEqual(['CRITICAL CAMERA_INGEST_NOT_PAIRED']);
    expect(await auditOfTheFault(of)).toBe(1);
  });

  it('row 188, C40 (2), CONTROL - a refusal of the gate WITHOUT a pairing end is not touched: no relay reported, so the capture goes on with the other camera and the camera keeps its own critical notice; and a pairing end for ANOTHER camera folds nothing', async () => {
    const { of, id, relay } = await production('r188_gate_alone');
    relay.report(id, 'CAM-02');
    ingest(of, 'CAM-02', 'CONNECTED');
    await vi.waitFor(() => expect(paired(of)).toEqual(['CAM-02@1']), { timeout: 5_000 });
    of.fake.last().say({ type: 'WARNING', code: 'CAPTURE_FAULT', reason: 'CAMERA_ANNOUNCE_NOT_MATCHED', state: 'ACTIVE', subject: 'CAM-01' });
    await wait(BOUND_MS * 2);
    await of.settled();
    const active = (): string[] => of.app.engine.slice('alerts').filter((alert) => alert.kind === 'CAPTURE_FAULT' && alert.active).map((alert) => `${alert.severity} ${String(alert.params?.['reason'])} ${String(alert.target)}`).sort();
    expect([notPaired(of), sessionCapture(of.app).liveSessionId(), of.fake.last().commands('STOP').length, linesOf(of, 'CAPTURE_GATE_NOTICE_FOLDED')]).toEqual([[], id, 0, []]);
    expect(active()).toEqual(['CRITICAL CAMERA_ANNOUNCE_NOT_MATCHED CAM-01']);
    expect(await faultRows(of)).toEqual(['FAULT_RAISED CAPTURE_FAULT@CAM-01']);
    // The pairing now ends the capture for the OTHER camera (a second connect report): the notice of CAM-01 is another fact and stays.
    ingest(of, 'CAM-02', 'WAITING');
    await flush();
    ingest(of, 'CAM-02', 'CONNECTED');
    await vi.waitFor(() => expect(notPaired(of)).toEqual(['CAM-02@1 WORKER_CONNECTED_TWICE']), { timeout: 5_000 });
    await of.settled();
    await wait(BOUND_MS);
    expect(linesOf(of, 'CAPTURE_GATE_NOTICE_FOLDED')).toEqual([]);
    expect(active()).toEqual(['CRITICAL CAMERA_ANNOUNCE_NOT_MATCHED CAM-01', 'CRITICAL CAMERA_INGEST_NOT_PAIRED null']);
  });

  it('row 188, C37: the worker of the session is replaced and the relay of the SUPERSEDED attempt still reports - 0 faults, 0 audit entries, 1 counted log line; the capture lives and THE CURRENT ATTEMPT STILL PAIRS; a later attempt is still the fault', async () => {
    const relay = relays();
    const of = await rig('r188_superseded', { limits: { backoffBaseMs: 20, backoffMaxMs: 40 } });
    sessionCapture(of.app).replace({ operationOf: () => CaptureOperation.REAL_PRODUCTION, ingestPairingBoundMs: BOUND_MS, relayReports: relay.source });
    const id = await of.arm();
    await of.start(id);
    relay.report(id, 'CAM-01');
    ingest(of, 'CAM-01', 'CONNECTED');
    await vi.waitFor(() => expect(paired(of)).toEqual(['CAM-01@1']), { timeout: 5_000 });
    // The worker goes down before anything is durable: the supervisor starts the second, and the Core issues attempt 2.
    of.fake.last().exit(1);
    await vi.waitFor(() => expect(of.fake.workers).toHaveLength(2), { timeout: 5_000 });
    await vi.waitFor(() => expect(of.fake.last().commands('START')).toMatchObject([{ attempt: 2 }]), { timeout: 5_000 });
    await of.settled();
    const before = await faultRows(of);
    // The relay of attempt 1 is being ended and still says its line - twice, for two cameras.
    relay.report(id, 'CAM-01', 1);
    relay.report(id, 'CAM-02', 1);
    await flush();
    expect(linesOf(of, 'CAPTURE_RELAY_REPORT_SUPERSEDED')).toMatchObject([
      { sessionId: id, deviceId: 'CAM-01', attempt: 1, attemptInForce: 2, dropped: 1 },
      { sessionId: id, deviceId: 'CAM-02', attempt: 1, attemptInForce: 2, dropped: 2 },
    ]);
    // A log line and nothing else: it is no entry of the error log.
    expect(linesOf(of, 'CAPTURE_INGEST_NOT_PAIRED')).toEqual([]);
    // The current attempt pairs around them.
    relay.report(id, 'CAM-01', 2);
    ingest(of, 'CAM-01', 'CONNECTED');
    await vi.waitFor(() => expect(paired(of)).toEqual(['CAM-01@1', 'CAM-01@2']), { timeout: 5_000 });
    await wait(BOUND_MS * 2);
    await of.settled();
    expect([notPaired(of), await auditOfTheFault(of), await faultRows(of), sessionCapture(of.app).liveSessionId(), of.fake.last().commands('STOP').length]).toEqual([[], 0, before, id, 0]);
    expect(of.app.engine.slice('session')).toMatchObject({ id, state: 'RECORDING' });
    expect(of.app.engine.slice('alerts').filter((alert) => alert.kind === 'CAPTURE_FAULT' && alert.active)).toEqual([]);
    // NEVER ISSUED stays the fault: attempt 3 does not exist yet.
    relay.report(id, 'CAM-02', 3);
    await vi.waitFor(() => expect(notPaired(of)).toEqual(['CAM-02@3 ATTEMPT_MISMATCH']), { timeout: 5_000 });
    await of.settled();
    expect([sessionCapture(of.app).liveSessionId(), await auditOfTheFault(of)]).toEqual([null, 1]);
    expect(of.app.engine.slice('session')).toMatchObject({ id, state: 'FAULT', fault: { kind: 'CAPTURE_FAULT' } });
    expect(linesOf(of, 'CAPTURE_RELAY_REPORT_SUPERSEDED')).toHaveLength(2);
  });

  it('C35 (b), a relay report for another attempt than the one in force - a later one, and an earlier one - is a capture fault', async () => {
    const later = await production('r48_later_attempt');
    later.relay.report(later.id, 'CAM-02', 2);
    await endedByThePairing(later.of, later.id, 'CAM-02@2 ATTEMPT_MISMATCH');
    const earlier = await production('r48_earlier_attempt');
    earlier.relay.report(earlier.id, 'CAM-01', 0);
    await endedByThePairing(earlier.of, earlier.id, 'CAM-01@0 ATTEMPT_MISMATCH');
  });

  it('C35 (b), one camera UNPAIRED and the other PAIRED: the capture is ended - the paired camera does not save it', async () => {
    const { of, id, relay } = await production('r48_one_unpaired');
    relay.report(id, 'CAM-02');
    ingest(of, 'CAM-02', 'CONNECTED');
    await vi.waitFor(() => expect(paired(of)).toEqual(['CAM-02@1']), { timeout: 5_000 });
    ingest(of, 'CAM-01', 'CONNECTED');
    await endedByThePairing(of, id, 'CAM-01@1 RELAY_REPORT_MISSING');
  });

  it('C35 (a), the degraded start of D72(k): one camera ABSENT (nothing from either side, then the worker gives its listener up) and the other PAIRED - the session records with the other camera and the warning names the missing one; no fault, no audit entry', async () => {
    const { of, id, relay } = await production('r48_one_absent');
    relay.report(id, 'CAM-02');
    ingest(of, 'CAM-02', 'CONNECTED');
    await vi.waitFor(() => expect(paired(of)).toEqual(['CAM-02@1']), { timeout: 5_000 });
    // Nothing of CAM-01 for longer than the bound: no fault. Then the worker's own statement at the end of its window.
    await wait(BOUND_MS * 2);
    expect(notPaired(of)).toEqual([]);
    refused(of, 'CAM-01');
    await wait(BOUND_MS * 2);
    await of.settled();
    expect(of.events.filter((event) => event.type === 'CAMERA_NOT_CONNECTED')).toEqual([{ type: 'CAMERA_NOT_CONNECTED', sessionId: id, deviceId: 'CAM-01' }]);
    expect([notPaired(of), paired(of), sessionCapture(of.app).liveSessionId(), of.fake.last().commands('STOP').length, await auditOfTheFault(of)]).toEqual([[], ['CAM-02@1'], id, 0, 0]);
    expect(of.app.engine.slice('session')).toMatchObject({ id, state: 'RECORDING' });
    // The recording goes on: its first durable fragment is taken, and it stops cleanly.
    of.fake.last().record(startInterval);
    of.fake.last().firstDurableFragment('CAM-02');
    await of.settled();
    expect(of.app.engine.slice('session')).toMatchObject({ id, state: 'RECORDING', captureDurable: true });
    await sessionCapture(of.app).shutdown();
  });

  it('C35 (a), no camera at all: the pairing says nothing; the worker ends the session itself and it is a failed start with the worker\'s cause, as before', async () => {
    const { of, id } = await production('r48_none');
    await wait(BOUND_MS * 2);
    refused(of, 'CAM-01');
    refused(of, 'CAM-02');
    of.fake.last().say({ type: 'CRASH', code: 'NO_CAMERA_CONNECTED', signal: null, exitCode: null });
    await of.settled();
    expect([notPaired(of), await auditOfTheFault(of)]).toEqual([[], 0]);
    expect(of.events.at(-1)).toEqual({ type: 'FAILED_START', sessionId: id, cause: 'NO_CAMERA_CONNECTED', reason: 'NO_CAMERA_CONNECTED', evidenceFiles: 0 });
  });

  it('ruling C34, FAIL-CLOSED: a REAL_PRODUCTION start WITHOUT a source of relay reports is refused 409 with the cause RELAY_REPORTS_NOT_WIRED - the session stays ARMED, no row, no worker, no source', async () => {
    const of = await rig('r48_not_wired');
    sessionCapture(of.app).replace({ operationOf: () => CaptureOperation.REAL_PRODUCTION, relayReports: null });
    const id = await of.arm();
    const refusedStart = await of.start(id).then(
      () => null,
      (error: unknown) => error,
    );
    expect(refusedStart).toBeInstanceOf(ApiFailure);
    expect(refusedStart).toMatchObject({ statusCode: 409, code: 'INVALID_STATE', details: { reason: SOURCE_KIND_NOT_RECORDABLE, cause: RELAY_REPORTS_NOT_WIRED } });
    expect(of.app.engine.slice('session')).toMatchObject({ id, state: 'ARMED' });
    expect(await of.rows('SELECT 1 FROM public.session_capture_sources WHERE session_id = $1', [id])).toEqual([]);
    expect(await of.rows("SELECT 1 FROM public.audit_log WHERE type = 'RECORDING_STARTED' AND session_id = $1", [id])).toEqual([]);
    expect([of.fake.calls(), of.order, of.events, sessionCapture(of.app).liveSessionId()]).toEqual([0, [], [], null]);
  });

  it.each([
    ['the development operation WITHOUT a report source (admitted, ruling C34)', 'r48_dev_no_source', { source: false, operation: CaptureOperation.REAL_DEVELOPMENT }],
    ['the development operation with a report source', 'r48_development', { operation: CaptureOperation.REAL_DEVELOPMENT }],
  ] as const)('CONTROL - where the pairing is not applied nothing changes: %s takes the same lone connect report and the same refusal as before', async (_name, slug, with_) => {
    const { of, id, relay } = await production(slug, with_);
    expect(relay.subscribed()).toBe(0);
    ingest(of, 'CAM-01', 'CONNECTED');
    refused(of, 'CAM-02');
    await wait(BOUND_MS * 2);
    await of.settled();
    expect([notPaired(of), paired(of), sessionCapture(of.app).liveSessionId(), await auditOfTheFault(of)]).toEqual([[], [], id, 0]);
    expect(of.events.some((event) => event.type === 'CAMERA_NOT_CONNECTED')).toBe(true);
    await sessionCapture(of.app).shutdown();
  });
});

describe('task 4 row 71 (WP-07c; schema design 2.3; AD-07 (1), S13-13): the card facts of the session\'s microphones are written to source_facts at the start', () => {
  // THE DOUBLES: the fake microphone adapters of the rig, each with the member a sound-card adapter states its card
  // through (`sourceFacts`, read by its name). No card is listed, no process is started; the production microphone
  // adapter (row 67) is not in this file. The statement runs on PostgreSQL as the runtime role, CHECKs included.
  type Statement = Record<string, unknown>;
  const CARD: Statement = { product: 'Scarlett 18i20 USB', usbId: '1235:8215', cardId: 'USB', cardDevice: 0, inputNumber: 1, nativeChannels: 18, sampleRateHz: 48_000, sampleBits: 24 };
  const stating =
    (of: (inputId: string) => Statement | null) =>
    (built: CaptureDeviceRegistry): CaptureDeviceRegistry => ({
      ...built,
      resolve: ((deviceClass: 'CAMERA' | 'MIC', deviceId: string) => (deviceClass === 'MIC' ? { ...built.resolve('MIC', deviceId), sourceFacts: of } : built.resolve('CAMERA', deviceId))) as CaptureDeviceRegistry['resolve'],
    });
  const factsOf = async (of: Rig, sessionId: string): Promise<Record<string, unknown>> =>
    Object.fromEntries((await of.rows<{ slot: string; source_facts: unknown }>('SELECT slot, source_facts FROM public.session_capture_sources WHERE session_id = $1 ORDER BY slot', [sessionId])).map((row) => [row.slot, row.source_facts]));
  const warned = (of: Rig): string[] => of.log.lines().map((line) => String(line.code)).filter((code) => code.startsWith('CAPTURE_SOURCE_FACTS_'));

  it('a start with doubles writes the card facts of BOTH microphones - which card, which input, rate and format - and nothing for the cameras; they are in the rows of the start, not written afterwards', async () => {
    const of = await rig('r71_facts', { registry: stating((inputId) => (inputId === 'MIC-01' ? CARD : { ...CARD, product: '  UMC1820  ', usbId: null, cardId: 'U192k', cardDevice: 1, inputNumber: 2, nativeChannels: 2, sampleBits: 16 })) });
    const id = await of.arm();
    await of.start(id);
    expect(await factsOf(of, id)).toEqual({
      'MIC-PRIMARY': { model: 'Scarlett 18i20 USB', usbId: '1235:8215', cardId: 'USB', cardDevice: 0, inputNumber: 1, nativeChannels: 18, sampleRate: 48_000, sampleBits: 24 },
      // A card that is not USB has no USB id: the key is absent, never a made-up id. The spaces at both ends of a name are dropped by the card text rule.
      'MIC-STANDBY': { model: 'UMC1820', cardId: 'U192k', cardDevice: 1, inputNumber: 2, nativeChannels: 2, sampleRate: 48_000, sampleBits: 16 },
      'VIDEO-01': {},
      'VIDEO-02': {},
    });
    // One instant and one statement for the four rows (MR-S1), and the session records.
    expect(await of.rows('SELECT DISTINCT recorded_at FROM public.session_capture_sources WHERE session_id = $1', [id])).toHaveLength(1);
    expect([of.app.engine.slice('session')?.state, sessionCapture(of.app).liveSessionId(), warned(of)]).toEqual(['RECORDING', id, []]);
    await sessionCapture(of.app).shutdown();
  });

  it('device text never reaches the row unpassed: an oversized product name, a control character, a bidirectional mark, a tag, a malformed USB id and card id, numbers out of bound and a key that is none', async () => {
    const hostile: Record<string, Statement> = {
      // 300 characters: not cut to fit - a cut name is a name the device did not announce - but replaced by the fixed word.
      'MIC-01': { ...CARD, product: 'A'.repeat(300), usbId: '1235:8215; DROP', cardId: '../../etc', cardDevice: 99, inputNumber: 0, nativeChannels: 4096, sampleRateHz: 44_100.5, sampleBits: 20, password: 'x', mediaUrl: 'rtsp://camera/1', note: 'free text' },
      'MIC-02': { ...CARD, product: 'Mic\u0000\u001b[31m‮evil<script>', usbId: 'ZZZZ:0001', cardId: 'USB_2', inputNumber: '1', sampleBits: null },
    };
    const of = await rig('r71_hostile', { registry: stating((inputId) => hostile[inputId] ?? null) });
    const id = await of.arm();
    await of.start(id);
    const facts = await factsOf(of, id);
    expect(facts).toEqual({
      'MIC-PRIMARY': { model: 'UNKNOWN', usbId: '0000:0000' },
      'MIC-STANDBY': { model: 'UNKNOWN', usbId: '0000:0000', cardId: 'USB_2', cardDevice: 0, nativeChannels: 18, sampleRate: 48_000 },
      'VIDEO-01': {},
      'VIDEO-02': {},
    });
    // The bound of the column, measured on what is stored: the whole map and every text of it.
    const stored = await of.rows<{ bytes: number; longest: number }>(
      "SELECT octet_length(source_facts::text)::int AS bytes, coalesce((SELECT max(char_length(value)) FROM jsonb_each_text(source_facts)), 0)::int AS longest FROM public.session_capture_sources WHERE session_id = $1",
      [id],
    );
    expect(Math.max(...stored.map((row) => row.bytes))).toBeLessThanOrEqual(2_048);
    expect(Math.max(...stored.map((row) => row.longest))).toBeLessThanOrEqual(120);
    // Nothing of the hostile text is anywhere in the rows of the start or in a log line.
    for (const piece of ['AAAA', 'evil', 'script', 'DROP', 'etc', 'rtsp://', 'free text', 'password', '‮']) expect(JSON.stringify(facts)).not.toContain(piece);
    for (const piece of ['AAAA', 'evil<', '../../', 'rtsp://camera', 'free text', '‮']) expect(JSON.stringify(of.log.lines())).not.toContain(piece);
    expect(of.app.engine.slice('session')?.state).toBe('RECORDING');
    await sessionCapture(of.app).shutdown();
  });

  it('CONTROL - adapters that state nothing (the fakes as they are): four rows with {} and no entry in the log; an adapter that THROWS does not refuse the start - {} for that microphone, ONE warning with the session and the device, the other microphone keeps its facts', async () => {
    const plain = await rig('r71_plain');
    const plainId = await plain.arm();
    await plain.start(plainId);
    expect(await factsOf(plain, plainId)).toEqual({ 'MIC-PRIMARY': {}, 'MIC-STANDBY': {}, 'VIDEO-01': {}, 'VIDEO-02': {} });
    expect(warned(plain)).toEqual([]);
    await sessionCapture(plain.app).shutdown();

    const of = await rig('r71_throws', {
      registry: stating((inputId) => {
        if (inputId === 'MIC-02') throw new Error('the card of Scarlett-SECRET-NAME is gone');
        return CARD;
      }),
    });
    const appended = vi.spyOn(of.app.errorLog, 'append');
    const id = await of.arm();
    await of.start(id);
    const facts = await factsOf(of, id);
    expect(facts['MIC-STANDBY']).toEqual({});
    expect(facts['MIC-PRIMARY']).toMatchObject({ model: 'Scarlett 18i20 USB', inputNumber: 1 });
    expect(warned(of)).toEqual(['CAPTURE_SOURCE_FACTS_NOT_READ']);
    const entries = appended.mock.calls.map(([entry]) => entry).filter((entry) => entry.code === 'CAPTURE_SOURCE_FACTS_NOT_READ');
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ level: 'warn', context: { sessionId: id, deviceId: 'MIC-02', slot: 'MIC-STANDBY', cause: 'UNEXPECTED' } });
    // What the adapter threw may carry device text: its message is in no entry and in no log line.
    expect(JSON.stringify(entries) + JSON.stringify(of.log.lines())).not.toContain('SECRET');
    expect(of.app.engine.slice('session')?.state).toBe('RECORDING');
    await sessionCapture(of.app).shutdown();
  });
});
