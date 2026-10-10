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
import { CAMERA_CLOCK_OFFSET_ADVISORY_MS, CAPTURE_NOT_DURABLE, MIC_START_BOUND_MS, SESSION_LEFT_RECORDING, SOURCE_KIND_NOT_RECORDABLE, readSessionCaptureFacts, sessionCapture, type SessionCaptureEvent } from '../index';

const db = useTestDatabase({ template: 'seed' });
const fixture = realBootFixture('row71b');
fixture.provisionKey();
afterAll(() => fixture.remove());

const SHA = (seed: string): string => seed.repeat(64).slice(0, 64);
const GENESIS = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';

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

  return {
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
    drive,
    settled,
    async arm() {
      caseSeq += 1;
      await app.engine.setTabletLink('CONNECTED');
      const created = await app.engine.command(investigator, 'createSession', { caseNumber: `LP/2026/1001-07${String(caseSeq).padStart(2, '0')}`, subjectType: 'SAKSI', subjectName: 'Test Subject', room: 'Interview Room 1', profileId: 'STANDARD_1080P25', investigatorId: investigator.operatorId });
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

describe('the schema this row was written against', () => {
  it('schema version 6, contract dbc-7', async () => {
    const meta = (await db.ownerPool().query('SELECT schema_version, contract_revision FROM public.schema_meta')).rows[0] as { schema_version: number; contract_revision: string };
    expect([Number(meta.schema_version), meta.contract_revision]).toEqual([6, 'dbc-7']);
  });
});

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
    expect(starts[0]?.plan.cameras.map((camera) => [camera.deviceId, camera.trackId, camera.ingestUrl])).toEqual([
      ['CAM-01', 'VIDEO-01', `rtsp://127.0.0.1:8554/${id}/video-01`],
      ['CAM-02', 'VIDEO-02', `rtsp://127.0.0.1:8556/${id}/video-02`],
    ]);
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
 * The rigs of the fix-pass cases are CLOSED AFTER EACH CASE (the app, its pools, the supervisor): the
 * cases above keep theirs until the file ends, and this file would otherwise hold more connections
 * than the test server gives one run ("the database does not answer", measured on the first run).
 */
const fixPassRigs: Rig[] = [];
async function fixRig(slug: string, options: Parameters<typeof rig>[1] = {}): Promise<Rig> {
  const of = await rig(slug, options);
  fixPassRigs.push(of);
  return of;
}
afterEach(async () => {
  for (const of of fixPassRigs.splice(0)) {
    await of.supervisor.shutdown();
    await of.app.close();
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
    sessionCapture(of.app).replace({ operationOf: () => CaptureOperation.REAL_PRODUCTION });
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
