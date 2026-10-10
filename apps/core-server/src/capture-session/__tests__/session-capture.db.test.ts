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
import { afterAll, describe, expect, it, vi } from 'vitest';
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
import { CAPTURE_NOT_DURABLE, MIC_START_BOUND_MS, SESSION_LEFT_RECORDING, SOURCE_KIND_NOT_RECORDABLE, readSessionCaptureFacts, sessionCapture, type SessionCaptureEvent } from '../index';

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
  const fake = fakeLauncher({ ackSwitch: false });
  const order: string[] = [];
  const handles: SourceHandle[] = [];
  const supervisor = createCaptureSupervisor({ now: () => app.clock.now(), timers: createSystemTimers(), launcher: fake.launcher });
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
    expect(start?.plan?.pcmTapPath).toBe(sessionTapPath(of.app.config.dataDir, id));
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
        { trackId: 'VIDEO-01', deviceId: 'CAM-01', clockOffsetMs: -7, firstVideo: { pts: 3_600, timescale: 90_000, heldMs: 40, skipped: { noTimestamp: 0, beforeAudioStart: 2, noCameraClock: 0, beforeKeyframe: 5 }, skippedSpanMs: 40 } },
        // No FIRST_VIDEO_SAMPLE arrived for the second file: null, never a made-up value (fields 127 / 128 are nullable).
        { trackId: 'VIDEO-02', deviceId: 'CAM-02', clockOffsetMs: 12, firstVideo: null },
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
});
