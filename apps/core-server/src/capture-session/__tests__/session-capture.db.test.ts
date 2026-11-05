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
import { captureNotices, probeOfAdapters } from '../../capture-notices';
import { createUsbAudioProductionAdapter, type RegisteredAudioInput } from '../../capture/adapters/audio/usb-audio-production';
import { createCardEnumerator, type CardListingSource } from '../../capture/adapters/audio/card-listing';
import { createAlsaConfigWriter } from '../../capture/adapters/audio/alsa-config-writer';
import { FIRST_DELIVERY_MS } from '../../capture/adapters/local/camera-helper';
import { CAMERA_CLOCK_OFFSET_ADVISORY_MS, CAPTURE_NOT_DURABLE, MIC_START_BOUND_MS, RELAY_PLAYING_SILENCE_BOUND_MS, RELAY_REPORTS_NOT_WIRED,SESSION_LEFT_RECORDING, SOURCE_KIND_NOT_RECORDABLE, readSessionCaptureFacts, sessionCapture, type SessionCaptureEvent } from '../index';

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
  // Audit row 149 (N-31): the supervisor sends no switch any more, so the fake has no switch answer to set.
  const fake = fakeLauncher({ ...options.worker });
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

  // The devices: fake adapters behind the EIGHT assigned built-ins (D60 2026-11-04: four video
  // tracks; D61 2026-11-04: four microphone channels), in a registry of the running operation. The
  // seeded selector names all eight, so a registry of four makes the plan builder refuse the start
  // (`SOURCE_KIND_NOT_RECORDABLE / NO_ADAPTER`) for every case in this file.
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
  // D60 (2026-11-04) + D61 (2026-11-04): the seeded selector assigns FOUR camera tracks and FOUR
  // microphone channels, so the rig stands a fake adapter behind every one of the eight built-ins.
  // A registry of the two-track era made the plan builder refuse every start with
  // `SOURCE_KIND_NOT_RECORDABLE / NO_ADAPTER` on `CAM-03`.
  for (const id of ['CAM-01', 'CAM-02', 'CAM-03', 'CAM-04']) {
    const offset = options.clockOffsets?.[id];
    const camera = createFakeCameraAdapter({ id, ...(offset === undefined ? {} : { ntpOffsetMs: offset }) });
    built.register({ ...camera, openSource: async (deviceId, to, signal) => watched(await camera.openSource(deviceId, to, signal)) });
  }
  for (const id of ['MIC-01', 'MIC-02', 'MIC-03', 'MIC-04']) {
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
  it('the start writes the eight source rows with RECORDING, says "connecting", calls capture.start ONCE with the plan of row 66; durable only from the first fragment; a clean stop raises no fault', async () => {
    const of = await rig('r71b_flow');
    const id = await of.arm();
    await of.start(id);

    // MR-S1 (D60 + D61, 2026-11-04): EIGHT rows — four video tracks and four numbered microphone
    // channels — of the class of the running operation, stored with RECORDING.
    expect(await sourcesOf(of, id)).toEqual([
      { slot: 'MIC-01', device_id: 'MIC-01', adapter_kind: 'FAKE' }, // D61: the channel is the slot
      { slot: 'MIC-02', device_id: 'MIC-02', adapter_kind: 'FAKE' },
      { slot: 'MIC-03', device_id: 'MIC-03', adapter_kind: 'FAKE' },
      { slot: 'MIC-04', device_id: 'MIC-04', adapter_kind: 'FAKE' },
      { slot: 'VIDEO-01', device_id: 'CAM-01', adapter_kind: 'FAKE' },
      { slot: 'VIDEO-02', device_id: 'CAM-02', adapter_kind: 'FAKE' },
      { slot: 'VIDEO-03', device_id: 'CAM-03', adapter_kind: 'FAKE' }, // D60
      { slot: 'VIDEO-04', device_id: 'CAM-04', adapter_kind: 'FAKE' }, // D60
    ]);
    // D84 / D91 R-1: the stored state is RECORDING, the payload says the capture is not durable yet.
    expect(of.app.engine.slice('session')).toMatchObject({ id, state: 'RECORDING', captureDurable: false });

    // D72(l): exactly one worker, one START, with the plan of the builder: device IDs as subjects, the track only as the output name.
    expect(of.fake.calls()).toBe(1);
    const starts = of.fake.last().commands('START');
    expect(starts).toHaveLength(1);
    expect(starts[0]).toMatchObject({ v: CAPTURE_PROTOCOL_VERSION, sessionId: id, attempt: 1 });
    // Task 4 row 47: the address of a track is the listener of that track, the session, the track, and one random element after them.
    // D60 (2026-11-04): FOUR camera lines, each on its own loopback listener of `CAPTURE_INGEST_PORT`.
    expect(starts[0]?.plan.cameras.map((camera) => [camera.deviceId, camera.trackId, camera.ingestUrl.slice(0, camera.ingestUrl.lastIndexOf('/'))])).toEqual([
      ['CAM-01', 'VIDEO-01', `rtsp://127.0.0.1:8554/${id}/video-01`],
      ['CAM-02', 'VIDEO-02', `rtsp://127.0.0.1:8556/${id}/video-02`],
      ['CAM-03', 'VIDEO-03', `rtsp://127.0.0.1:8560/${id}/video-03`], // D60
      ['CAM-04', 'VIDEO-04', `rtsp://127.0.0.1:8562/${id}/video-04`], // D60
    ]);
    expect(starts[0]?.plan.cameras.map((camera) => INGEST_ELEMENT.test(elementOf(camera.ingestUrl)))).toEqual([true, true, true, true]);
    expect(starts[0]?.plan.cameras.every((camera) => camera.outputPath.startsWith(`${fixture.mediaStoreDir}/SESSION-${id}/`))).toBe(true);
    // D61 (2026-11-04): the plan rows carry the numbered CHANNEL and every channel gets its own file
    // (`<CHANNEL>.m4a`); the two-role lane survives only on SWITCH_AUDIO_SOURCE.to, telemetry and interval records.
    expect(starts[0]?.plan.mics.map((mic) => [mic.deviceId, mic.channel])).toEqual([['MIC-01', 'MIC-01'], ['MIC-02', 'MIC-02'], ['MIC-03', 'MIC-03'], ['MIC-04', 'MIC-04']]);
    // The microphones are opened before the plan, the cameras only when the worker listens.
    expect(of.order).toEqual(['open MIC-01', 'open MIC-02', 'open MIC-03', 'open MIC-04', 'open CAM-01', 'open CAM-02', 'open CAM-03', 'open CAM-04']);
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

    // Operation 81 is retired (audit row 149; N-29, N-31): the capture unit has no switch, the worker is sent none, and no
    // interval row or AUDIO_SOURCE_SWITCHED row is written - the session keeps the one interval of its start.
    expect('switchAudioSource' in sessionCapture(of.app)).toBe(false);
    expect(worker.received.map((message) => message.type as string)).not.toContain('SWITCH_AUDIO_SOURCE');
    expect(await of.rows('SELECT seq, mic_device_id, role, to_media_ms::int AS to_ms, reason FROM public.session_audio_intervals WHERE session_id = $1 ORDER BY seq', [id])).toEqual([
      { seq: 1, mic_device_id: 'MIC-01', role: 'PRIMARY', to_ms: null, reason: 'START' },
    ]);
    expect(await of.rows("SELECT seq FROM public.audit_log WHERE type = 'AUDIO_SOURCE_SWITCHED'")).toEqual([]);

    // The stop: the worker is told FIRST; the sources are closed only after it has exited.
    worker.record({ kind: 'AUDIO_TIMELINE_END', samples: 480_000, sampleRateHz: 48_000, intervals: 1 });
    await of.app.engine.run('sessions.stopSession', async (scope) => {
      sessionCapture(of.app).stopRequestedIn(scope, id);
      await scope.command(of.investigator, 'stopRecording', 'End of the interview');
    });
    sessionCapture(of.app).afterStopCommitted(id);
    await of.settled();
    expect(worker.commands('STOP')).toHaveLength(1);
    // D60 / D61 (2026-11-04): eight sources close — the four channels and the four tracks.
    expect(of.order.slice(8)).toEqual(['STOP', 'close MIC-01', 'close MIC-02', 'close MIC-03', 'close MIC-04', 'close CAM-01', 'close CAM-02', 'close CAM-03', 'close CAM-04']);
    expect(of.events.at(-1)).toMatchObject({ type: 'STOPPED', sessionId: id, fragmentRowsBehind: [] });
    expect(sessionCapture(of.app).liveSessionId()).toBeNull();
    // A clean stop writes no capture fault and no fault audit row (the control below shows that the
    // same rig DOES write one, within this time, when a source is closed first).
    await new Promise((resolve) => setTimeout(resolve, 500));
    expect(await faultRows(of)).toEqual([]);
    expect(of.app.engine.slice('faults').active.filter((fault) => fault.kind === 'CAPTURE_FAULT')).toEqual([]);
    // The last (the one) interval is closed at the end of the audio timeline: (480,000 + 1,024) samples = 10,021 ms.
    expect(await of.rows('SELECT to_media_ms::int AS to_ms FROM public.session_audio_intervals WHERE session_id = $1 AND seq = 1', [id])).toEqual([{ to_ms: 10_021 }]);
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
      // These adapters state NO opener (specification 6.3: this case is KEPT at the lift because its registry states none; its
      // twin below states them): the registry says so itself.
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

  // Task 4 row 88 (THE LIFT, AM-1; specification 6.3 "Test: no listener without an opener ... a twin with openers is added").
  // D60 / D61 (2026-11-04): the selector assigns EIGHT slots, so the twin registers an opener behind four
  // production cameras and four production microphones; a registry of four fails the class gate on the
  // first un-registered device (`NO_ADAPTER`) and would test nothing about the lift.
  it('TWIN since the lift: the same eight production-kind devices WITH their opener register and pass the class gate; the start is then held by the next fail-closed line (ruling C34: this rig wires no relay report source) - 409 RELAY_REPORTS_NOT_WIRED, still 0 workers, 0 sources asked to open, 0 source rows', async () => {
    const asked: string[] = [];
    const liftedRegistry = (): CaptureDeviceRegistry => {
      const production = createCaptureDeviceRegistry({ operation: CaptureOperation.REAL_PRODUCTION });
      for (const id of ['CAM-01', 'CAM-02', 'CAM-03', 'CAM-04']) {
        production.register({ ...createFakeCameraAdapter({ id }), kind: 'ONVIF_RTSP', hasOpener: true, openSource: async (deviceId) => (asked.push(`open ${deviceId}`), Promise.reject(new Error('a production kind was asked to open'))) });
      }
      for (const id of ['MIC-01', 'MIC-02', 'MIC-03', 'MIC-04']) {
        production.register({ ...createFakeAudioInputAdapter({ id, runDir: `${fixture.dataDir}/run-r88-twin` }), kind: 'USB_AUDIO', hasOpener: true, open: async (inputId) => (asked.push(`open ${inputId}`), Promise.reject(new Error('a production kind was asked to open'))) });
      }
      expect(production.openerKinds()).toEqual(['ONVIF_RTSP', 'USB_AUDIO']);
      return production;
    };
    const of = await rig('r88_lift_twin', { registry: liftedRegistry });
    const id = await of.arm();
    const refused = await of.start(id).then(
      () => null,
      (error: unknown) => error,
    );
    expect(refused).toBeInstanceOf(ApiFailure);
    expect(refused).toMatchObject({ statusCode: 409, code: 'INVALID_STATE', details: { reason: SOURCE_KIND_NOT_RECORDABLE, cause: RELAY_REPORTS_NOT_WIRED } });
    expect([of.fake.calls(), asked, of.order, of.events]).toEqual([0, [], [], []]);
    expect(of.app.engine.slice('session')).toMatchObject({ id, state: 'ARMED' });
    expect(await sourcesOf(of, id)).toEqual([]);
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
    expect(of.order.filter((entry) => entry.startsWith('close')).sort()).toEqual(['close CAM-01', 'close CAM-02', 'close CAM-03', 'close CAM-04', 'close MIC-01', 'close MIC-02', 'close MIC-03', 'close MIC-04']);
    expect(sessionCapture(of.app).liveSessionId()).toBeNull();
    // The recovery: a history entry, and no evidence item. The eight source rows stay (MR-S1, D60/D61).
    await of.app.engine.command(of.investigator, 'recover');
    await of.drive(5_000);
    expect(of.app.engine.slice('session')).toBeNull();
    expect(await evidenceCount(of)).toBe(before);
    expect(await sourcesOf(of, id)).toHaveLength(8);
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
    // D60 (2026-11-04): the interrupted hand-off names the FOUR camera files of the plan. Audit row W3F (F-W3TW-D2; D132, row 148):
    // and after them, in plan order, the four CHANNEL files - MIC-0N.m4a under the sealed track of its channel, AUDIO-0N.
    expect(of.events.at(-1)).toMatchObject({
      type: 'INTERRUPTED',
      sessionId: id,
      files: [
        { trackId: 'VIDEO-01', deviceId: 'CAM-01' }, { trackId: 'VIDEO-02', deviceId: 'CAM-02' }, { trackId: 'VIDEO-03', deviceId: 'CAM-03' }, { trackId: 'VIDEO-04', deviceId: 'CAM-04' },
        { trackId: 'AUDIO-01', deviceId: 'MIC-01', path: expect.stringMatching(/\/MIC-01\.m4a$/) }, { trackId: 'AUDIO-02', deviceId: 'MIC-02', path: expect.stringMatching(/\/MIC-02\.m4a$/) },
        { trackId: 'AUDIO-03', deviceId: 'MIC-03', path: expect.stringMatching(/\/MIC-03\.m4a$/) }, { trackId: 'AUDIO-04', deviceId: 'MIC-04', path: expect.stringMatching(/\/MIC-04\.m4a$/) },
      ],
    });
    expect(of.order.filter((entry) => entry.startsWith('close'))).toHaveLength(8);
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
    // Row D2C (D150 (2), F-C1D-2; edit-only under D32, run in the DB window): a CHANNEL file's checkpoint alone (row 148) is
    // stored but makes nothing durable - the payload still says not durable, no DURABLE event, and the stop is still refused.
    const micChain = (await of.rows<{ chain: string }>("SELECT encode(sha256(decode($1, 'hex') || decode($2, 'hex')), 'hex') AS chain", [GENESIS, SHA('a')]))[0]?.chain ?? '';
    of.fake.last().record({ ...checkpoint(1, 700, micChain, SHA('a')), deviceId: 'MIC-01', keyframe: false } as CaptureRecord);
    await of.settled();
    expect(of.app.engine.slice('session')).toMatchObject({ state: 'RECORDING', captureDurable: false });
    expect(of.events.map((event) => event.type)).not.toContain('DURABLE');
    await expect(stop()).rejects.toMatchObject({ statusCode: 409, code: 'INVALID_STATE', details: { reason: CAPTURE_NOT_DURABLE } });
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
  it('a start stores ONE snapshot row with the eight source rows; the seal reads that row, not a placeholder', async () => {
    const of = await rig('r71c_snapshot');
    const id = await of.arm();
    expect(await snapshotRows(of, id)).toEqual([]);
    await of.start(id);
    expect(await snapshotRows(of, id)).toEqual([{ enabled: false, revision: expect.any(Number) }]);
    expect(await sourcesOf(of, id)).toHaveLength(8); // D60 / D61 (2026-11-04): four tracks + four channels
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
    expect(await sourcesOf(of, id)).toHaveLength(8); // D60 / D61 (2026-11-04): four tracks + four channels
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
      pairedAudio: true, // row 148 (D128, R153-1): written by every protocol-6 start
      cameras: [
        // Tidy pass F-Y: the fake worker states the full sync with its first durable fragment, as the real worker does; no clock was measured here.
        { trackId: 'VIDEO-01', deviceId: 'CAM-01', clockOffsetMs: -7, measuredClockOffsetMs: null, syncLevel: 'F_FULLFSYNC', firstVideo: { pts: 3_600, timescale: 90_000, heldMs: 40, skipped: { noTimestamp: 0, beforeAudioStart: 2, noCameraClock: 0, beforeKeyframe: 5 }, skippedSpanMs: 40 } },
        // No FIRST_VIDEO_SAMPLE arrived for the second file: null, never a made-up value (fields 127 / 128 are nullable).
        { trackId: 'VIDEO-02', deviceId: 'CAM-02', clockOffsetMs: 12, measuredClockOffsetMs: null, syncLevel: null, firstVideo: null },
        // D60 (2026-11-04): the two further tracks of the plan are in the facts too, at the adapter's
        // own offset (0 for a fake that was given none) and with nothing stated by the worker yet.
        { trackId: 'VIDEO-03', deviceId: 'CAM-03', clockOffsetMs: 0, measuredClockOffsetMs: null, syncLevel: null, firstVideo: null },
        { trackId: 'VIDEO-04', deviceId: 'CAM-04', clockOffsetMs: 0, measuredClockOffsetMs: null, syncLevel: null, firstVideo: null },
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
    // D60 / D61 (2026-11-04): eight sources are closed - four channels, four tracks.
    expect(of.order.filter((entry) => entry.startsWith('close'))).toHaveLength(8);
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
    // D61 (2026-11-04): FOUR helpers - the four numbered channels of the microphone plane.
    expect(helpers.log.filter((entry) => entry.startsWith('settled')).sort()).toEqual(['settled MIC-01', 'settled MIC-02', 'settled MIC-03', 'settled MIC-04']);
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

  // D61 (2026-11-04): the microphone plane is numbered, so the failure row of a channel that did not
  // start carries `channel`, never the superseded `role` (the two-role lane survives on SWITCH_AUDIO_SOURCE.to,
  // the interval records and the telemetry role members only). Channel 1 keeps the error level.
  it('a channel that cannot start: a named warning with its channel, the first channel is launched in the same turn and is not delayed, the session starts, nothing is switched', async () => {
    const helpers = scripted((deviceId) => (deviceId === 'MIC-02' ? 'FAIL' : 'SETTLE'));
    const of = await rig('d9_mic_standby_fails', { registry: helpers.registry });
    const appended = vi.spyOn(of.app.errorLog, 'append');
    const id = await of.arm();
    await of.start(id);
    expect(headGap(helpers)).toBe(0);
    expect(appended.mock.calls.map(([entry]) => entry).filter((entry) => entry.code === 'CAPTURE_MIC_NOT_STARTED').map((entry) => [entry.level, entry.context?.['deviceId'], entry.context?.['channel'], entry.context?.['cause']])).toEqual([['warn', 'MIC-02', 'MIC-02', 'MIC_START_FAILED']]); // D61: `channel`, not `role`
    expect(of.events.map((event) => event.type)).toEqual(['CONNECTING', 'STARTED']);
    expect(of.app.engine.slice('session')).toMatchObject({ state: 'RECORDING', audioSource: { activeInputId: 'MIC-01', standbyInputId: 'MIC-02' } });
    expect(of.fake.last().received.map((message) => message.type as string)).not.toContain('SWITCH_AUDIO_SOURCE'); // audit row 149: no such command
  });

  it('channel 1 whose start never answers is given up at the bound and said as an error; the other three channels and the cameras did not wait for it, and it is never replaced', async () => { // D61: the numbered channel replaces the PRIMARY role word
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
    expect(appended.mock.calls.map(([entry]) => entry).filter((entry) => entry.code === 'CAPTURE_MIC_NOT_STARTED').map((entry) => [entry.level, entry.context?.['deviceId'], entry.context?.['channel'], entry.context?.['cause']])).toEqual([['error', 'MIC-01', 'MIC-01', 'MIC_START_BOUND']]); // D61: `channel`, not `role`
    expect(of.events.map((event) => event.type)).toEqual(['CONNECTING', 'STARTED']);
    expect(of.app.engine.slice('session')).toMatchObject({ state: 'RECORDING', audioSource: { activeInputId: 'MIC-01' } });
    expect(of.fake.last().received.map((message) => message.type as string)).not.toContain('SWITCH_AUDIO_SOURCE'); // audit row 149: no such command
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

// Review R74-06 (a switch the worker realised is recorded whatever happens around it): its three cases are gone with
// operation 81 and `SWITCH_AUDIO_SOURCE` (audit row 149; N-29, N-31). The supervisor refuses any switch record
// (`SWITCH_NOT_COMMANDED`, supervisor.test.ts), so nothing reaches this unit to record.

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
    // D60 / D61 (2026-11-04): eight sources — the four channels and the four tracks close after the STOP.
    expect(of.order.slice(8)).toEqual(['STOP', 'close MIC-01', 'close MIC-02', 'close MIC-03', 'close MIC-04', 'close CAM-01', 'close CAM-02', 'close CAM-03', 'close CAM-04']);
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
    // D60 / D61 (2026-11-04): SEVEN sources close — CAM-02 is still inside its settle window and never opened a handle.
    expect(of.order.filter((entry) => entry.startsWith('close')).sort()).toEqual(['close CAM-01', 'close CAM-03', 'close CAM-04', 'close MIC-01', 'close MIC-02', 'close MIC-03', 'close MIC-04']);
    expect(sessionCapture(of.app).liveSessionId()).toBeNull();
    expect(of.events.map((event) => event.type)).toEqual(['CONNECTING']);
  });

  it('the app closes through it: `app.close()` alone stops the worker and closes the sources', async () => {
    const { of } = await durableSession('fm5_shutdown_close');
    await of.app.close();
    expect(of.fake.last().commands('STOP')).toHaveLength(1);
    expect(of.order.filter((entry) => entry.startsWith('close'))).toHaveLength(8); // D60 / D61: four channels, four tracks
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
    // D60 (2026-11-04): the facts name ALL FOUR tracks; only the two that reported a first durable
    // fragment carry a sync level, the other two stay null.
    expect(await camerasOf(of, id)).toEqual([['CAM-01', 0, null, 'FSYNC'], ['CAM-02', 0, null, 'FSYNC'], ['CAM-03', 0, null, null], ['CAM-04', 0, null, null]]);
    const alerts = systemAlerts(of, 'EVIDENCE_VOLUME_SYNC_NOT_FULL');
    expect(alerts.map((alert) => [alert.severity, alert.target, alert.message, alert.params?.['sessionId'], alert.params?.['syncLevel']])).toEqual([['INFO', 'EVIDENCE_VOLUME', 'The evidence volume does not confirm full durability; recordings may not survive a power loss.', id, 'FSYNC']]);
    expect(captureFault(of)).toEqual([]);
    await stopNow(of, id);
    expect(of.events.at(-1)).toMatchObject({ type: 'STOPPED', sessionId: id });
    expect(systemAlerts(of, 'EVIDENCE_VOLUME_SYNC_NOT_FULL')).toEqual([]);
    // The level stays with the session after its capture ended: the seal's reader finds it there.
    expect(await camerasOf(of, id)).toEqual([['CAM-01', 0, null, 'FSYNC'], ['CAM-02', 0, null, 'FSYNC'], ['CAM-03', 0, null, null], ['CAM-04', 0, null, null]]); // D60
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
    expect(await camerasOf(of, id)).toEqual([['CAM-01', 0, null, 'F_FULLFSYNC'], ['CAM-02', 0, null, null], ['CAM-03', 0, null, null], ['CAM-04', 0, null, null]]); // D60: four tracks in the facts
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
    expect(await camerasOf(of, id)).toEqual([['CAM-01', -7, -1_500, 'F_FULLFSYNC'], ['CAM-02', 12, -100, null], ['CAM-03', 0, null, null], ['CAM-04', 0, null, null]]); // D60: four tracks
    const advice = systemAlerts(of, 'CAMERA_CLOCK_OFFSET');
    expect(advice.map((alert) => [alert.severity, alert.target, alert.message, alert.params?.['offsetMs']])).toEqual([['INFO', 'CAM-01', "Camera clock differs from the Core by 1500 ms; the recording keeps the camera's own timeline and records the offset.", -1_500]]);
    expect(captureFault(of)).toEqual([]);
    // The offset AT ANCHORING: what the same worker says later is drift, not this number.
    of.fake.last().telemetry(2, [{ deviceId: 'CAM-01', lagMs: 1_900 }, { deviceId: 'CAM-02', lagMs: 900 }]);
    await of.settled();
    expect(await camerasOf(of, id)).toEqual([['CAM-01', -7, -1_500, 'F_FULLFSYNC'], ['CAM-02', 12, -100, null], ['CAM-03', 0, null, null], ['CAM-04', 0, null, null]]); // D60: four tracks
    expect(systemAlerts(of, 'CAMERA_CLOCK_OFFSET')).toHaveLength(1);
    await stopNow(of, id);
    expect(of.events.at(-1)).toMatchObject({ type: 'STOPPED', sessionId: id });
    expect(systemAlerts(of, 'CAMERA_CLOCK_OFFSET')).toEqual([]);
    expect(await camerasOf(of, id)).toEqual([['CAM-01', -7, -1_500, 'F_FULLFSYNC'], ['CAM-02', 12, -100, null], ['CAM-03', 0, null, null], ['CAM-04', 0, null, null]]); // D60: four tracks
  });

  it('CONTROL: 100 ms on both cameras - measured and kept, no advisory at all; exactly the threshold is not above it', async () => {
    const { of, id } = await durableSession('fy_clock_small');
    of.fake.last().telemetry(1, [{ deviceId: 'CAM-01', lagMs: -100 }, { deviceId: 'CAM-02', lagMs: CAMERA_CLOCK_OFFSET_ADVISORY_MS }]);
    await of.settled();
    expect(await camerasOf(of, id)).toEqual([['CAM-01', 0, 100, 'F_FULLFSYNC'], ['CAM-02', 0, -CAMERA_CLOCK_OFFSET_ADVISORY_MS, null], ['CAM-03', 0, null, null], ['CAM-04', 0, null, null]]); // D60: four tracks
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
    expect(facts?.cameras.map((camera) => [camera.trackId, camera.deviceId, camera.ended?.reason ?? null])).toEqual([['VIDEO-01', 'CAM-01', null], ['VIDEO-02', 'CAM-02', 'CAMERA_CLOCK_OUT_OF_BOUND'], ['VIDEO-03', 'CAM-03', null], ['VIDEO-04', 'CAM-04', null]]); // D60: four tracks
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
    expect((await readSessionCaptureFacts(of.app.config.mediaStoreDir, id))?.cameras.map((camera) => camera.ended ?? null)).toEqual([null, null, null, null]); // D60: four tracks
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

    // Row 148 (AC-4.8, protocol 6 N-32): a checkpoint of the channel file of MIC-03 (a microphone of the plan) is an
    // AUDIO-03 row; it is no CAMERA figure of the session payload (`captureCheckpoints` counts camera files only).
    worker.record({ ...checkpoint(1, 700, chain1, sha), deviceId: 'MIC-03', keyframe: false } as CaptureRecord);
    await of.settled();
    expect(held(of)?.fragments).toBe(3);

    // One more inside the window, then the stop: the end of the capture says the final figure.
    worker.record(checkpoint(3, 3_231, chain3, sha));
    await of.settled();
    expect(held(of)?.fragments).toBe(3);
    worker.record({ kind: 'AUDIO_TIMELINE_END', samples: 480_000, sampleRateHz: 48_000, intervals: 1 });
    await stopNow(of, id);
    expect(of.events.at(-1)).toMatchObject({ type: 'STOPPED', sessionId: id });
    expect(held(of)).toMatchObject({ fragments: 4, bytes: 4_231 + 1_900 });
    // The figures agree with the rows the recorder stored, and the door itself wrote nothing.
    expect(await of.rows('SELECT track_id, count(*)::int AS n FROM public.recording_fragments WHERE session_id = $1 GROUP BY track_id ORDER BY track_id', [id])).toEqual([{ track_id: 'AUDIO-03', n: 1 }, { track_id: 'VIDEO-01', n: 3 }, { track_id: 'VIDEO-02', n: 1 }]);
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

  it('each camera adapter is asked ONCE, with the address of the plan frame byte for byte and the profile of the plan; the four tracks carry different 128-bit elements; the address is in no log line, audit row, session row, event or facts file', async () => { // D60: four tracks
    const seen = cameras();
    const of = await rig('r47_address', { registry: seen.registry });
    const id = await of.arm();
    await of.start(id);
    const plan = of.fake.last().commands('START')[0]?.plan;
    expect(plan?.cameras.map((camera) => camera.deviceId)).toEqual(['CAM-01', 'CAM-02', 'CAM-03', 'CAM-04']); // D60 (2026-11-04): four tracks
    const inPlan = (deviceId: string) => plan?.cameras.find((camera) => camera.deviceId === deviceId);

    // One open per camera of the plan (AD-11: one credential read per camera per attempt), each told the plan's own string and profile.
    expect(seen.asked.map((ask) => ask.deviceId)).toEqual(['CAM-01', 'CAM-02', 'CAM-03', 'CAM-04']); // D60
    expect(seen.asked.map((ask) => ask.target.ingestUrl === inPlan(ask.deviceId)?.ingestUrl)).toEqual([true, true, true, true]);
    expect(seen.asked.map((ask) => typeof ask.target.profile === 'string' && ask.target.profile === inPlan(ask.deviceId)?.profile)).toEqual([true, true, true, true]);

    // BR-07 (1): 16 bytes of the random source per track, in the grammar; the four tracks differ (D60).
    const elements = (plan?.cameras ?? []).map((camera) => elementOf(camera.ingestUrl));
    expect(elements.map((element) => INGEST_ELEMENT.test(element) && Buffer.from(element, 'base64url').length === 16)).toEqual([true, true, true, true]);
    expect(new Set(elements).size).toBe(4);

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
    expect(seen.asked.map((ask) => ask.deviceId)).toEqual(['CAM-01', 'CAM-02', 'CAM-03', 'CAM-04']); // D60
    expect(of.order).not.toContain('open CAM-01');
    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(of.events.map((event) => event.type)).toEqual(['CONNECTING']);
    expect(seen.asked.map((ask) => ask.signal.aborted)).toEqual([false, false, false, false]);
    expect(notOpenedLines(of)).toEqual([]);

    answer();
    await of.settled();
    // D60: the three cameras that were not held settle in the order of the plan, the slow one last.
    expect(of.order.filter((entry) => entry.startsWith('open CAM'))).toEqual(['open CAM-02', 'open CAM-03', 'open CAM-04', 'open CAM-01']);
    expect(of.events.at(-1)).toEqual({ type: 'STARTED', sessionId: id, cameras: ['CAM-01', 'CAM-02', 'CAM-03', 'CAM-04'], camerasNotOpened: [] });
    // Still one open per camera.
    expect(seen.asked).toHaveLength(4);
  });

  it('REAL_PRODUCTION: an open with no outcome is given up at the bound - its own signal is aborted, the session and the other camera go on, the camera is said not opened with the cause, a source that comes up later is closed at once; each adapter was asked once', async () => {
    let bring: (handle: SourceHandle) => void = () => undefined;
    const late = new Promise<SourceHandle>((resolve) => (bring = resolve));
    const seen = cameras((deviceId, pass) => (deviceId === 'CAM-01' ? late : pass()));
    const of = await rig('r47_bound', { registry: seen.registry });
    sessionCapture(of.app).replace({ operationOf: () => CaptureOperation.REAL_PRODUCTION, relayReports: SILENT_RELAYS, cameraOpenBoundMs: 60 });
    const id = await of.arm();
    await of.start(id);
    // D60: the three cameras that answered are STARTED; only the held one is given up at the bound.
    expect(of.events.at(-1)).toEqual({ type: 'STARTED', sessionId: id, cameras: ['CAM-02', 'CAM-03', 'CAM-04'], camerasNotOpened: ['CAM-01'] });
    expect(seen.asked.map((ask) => [ask.deviceId, ask.signal.aborted])).toEqual([['CAM-01', true], ['CAM-02', false], ['CAM-03', false], ['CAM-04', false]]);
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
    expect(seen.asked).toHaveLength(4); // D60
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
    expect(reads.sort()).toEqual(['CAM-01 COMMITTED', 'CAM-02 COMMITTED', 'CAM-03 COMMITTED', 'CAM-04 COMMITTED']); // D60: four opens, each outside the unit
    expect(of.events.at(-1)).toEqual({ type: 'STARTED', sessionId: id, cameras: ['CAM-01', 'CAM-02', 'CAM-03', 'CAM-04'], camerasNotOpened: [] });
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
    // D60 (2026-11-04): four cameras, four opens, all of them with the addresses of the worker that came up.
    expect(askedOf(seen.asked)).toEqual([['CAM-01', second['CAM-01']], ['CAM-02', second['CAM-02']], ['CAM-03', second['CAM-03']], ['CAM-04', second['CAM-04']]]);
    expect(Object.values(second).map((address) => INGEST_ELEMENT.test(elementOf(address)))).toEqual([true, true, true, true]);
    expect(of.events.at(-1)).toEqual({ type: 'STARTED', sessionId: id, cameras: ['CAM-01', 'CAM-02', 'CAM-03', 'CAM-04'], camerasNotOpened: [] });
  });

  it('row 179, REAL_PRODUCTION: the worker of a recording is replaced before anything is durable - the sources of attempt 1 are closed, every camera is opened again, and each open is handed the string of ITS OWN attempt; no element is used twice; nothing of it is written', async () => {
    const seen = cameras();
    const of = await rig('r179_two_attempts', { registry: seen.registry, limits: FAST_RESTART });
    sessionCapture(of.app).replace({ operationOf: () => CaptureOperation.REAL_PRODUCTION, relayReports: SILENT_RELAYS });
    const id = await of.arm();
    await of.start(id);
    const first = planOfWorker(of, 0);
    // D60 (2026-11-04): attempt 1 opens FOUR cameras.
    expect(askedOf(seen.asked)).toEqual([['CAM-01', first['CAM-01']], ['CAM-02', first['CAM-02']], ['CAM-03', first['CAM-03']], ['CAM-04', first['CAM-04']]]);
    of.order.length = 0;

    of.fake.last().exit(1);
    await vi.waitFor(() => expect(seen.asked).toHaveLength(8), { timeout: 5_000 });
    await of.settled();
    expect(of.fake.workers).toHaveLength(2);
    expect(of.fake.last().commands('START')).toMatchObject([{ attempt: 2 }]);
    const second = planOfWorker(of, 1);
    // The relay double of each attempt received the string of its own attempt, byte for byte (D60: FOUR cameras per attempt).
    expect(askedOf(seen.asked.slice(4))).toEqual([['CAM-01', second['CAM-01']], ['CAM-02', second['CAM-02']], ['CAM-03', second['CAM-03']], ['CAM-04', second['CAM-04']]]);
    // Eight addresses, eight elements: none of attempt 1 is in the plan or in an open of attempt 2 (D60: four per attempt).
    const elements = [...Object.values(first), ...Object.values(second)].map(elementOf);
    expect(elements.map((element) => INGEST_ELEMENT.test(element))).toEqual([true, true, true, true, true, true, true, true]);
    expect(new Set(elements).size).toBe(8);
    // The camera sources of the earlier worker were closed BEFORE the cameras were opened again.
    const cameraSteps = of.order.filter((entry) => / CAM-/.test(entry));
    expect(cameraSteps.slice(0, 4).sort()).toEqual(['close CAM-01', 'close CAM-02', 'close CAM-03', 'close CAM-04']);
    expect(cameraSteps.slice(4).sort()).toEqual(['open CAM-01', 'open CAM-02', 'open CAM-03', 'open CAM-04']);
    // Task 4 row 191 (this line read "no microphone was touched" until then): the microphones of the earlier worker are closed, ALL FOUR, and then opened again for the later one (D61).
    expect(of.order.filter((entry) => / MIC-/.test(entry))).toEqual(['close MIC-01', 'close MIC-02', 'close MIC-03', 'close MIC-04', 'open MIC-01', 'open MIC-02', 'open MIC-03', 'open MIC-04']);
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
    // D60: each of the four cameras is closed twice across the file — once for its own attempt.
    expect(of.order.filter((entry) => /close CAM-/.test(entry)).sort()).toEqual(['close CAM-01', 'close CAM-01', 'close CAM-02', 'close CAM-02', 'close CAM-03', 'close CAM-03', 'close CAM-04', 'close CAM-04']);
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
    await vi.waitFor(() => expect(seen.asked).toHaveLength(8), { timeout: 5_000 }); // D60: four cameras per attempt
    await of.settled();
    const second = planOfWorker(of, 1);
    // The open of attempt 1 that never answered is aborted; the other three of attempt 1 and all four of attempt 2 stand.
    expect(seen.asked.map((ask) => [ask.deviceId, ask.signal.aborted])).toEqual([['CAM-01', true], ['CAM-02', false], ['CAM-03', false], ['CAM-04', false], ['CAM-01', false], ['CAM-02', false], ['CAM-03', false], ['CAM-04', false]]);
    expect(askedOf(seen.asked.slice(4))).toEqual([['CAM-01', second['CAM-01']], ['CAM-02', second['CAM-02']], ['CAM-03', second['CAM-03']], ['CAM-04', second['CAM-04']]]);
    expect(of.events.filter((event) => event.type === 'STARTED')).toEqual([{ type: 'STARTED', sessionId: id, cameras: ['CAM-01', 'CAM-02', 'CAM-03', 'CAM-04'], camerasNotOpened: [] }]);
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
    expect(seen.asked).toHaveLength(4); // D60: four cameras, opened once (the development operation does not re-open)
    expect(of.order.filter((entry) => / CAM-/.test(entry))).toEqual([]);
    // The plan of the later worker is renewed in every real operation (the supervisor does not know the operation).
    expect(new Set([...Object.values(planOfWorker(of, 0)), ...Object.values(planOfWorker(of, 1))].map(elementOf)).size).toBe(8); // D60: four per attempt
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
      // Finding F3-01: a relay's word about its camera leg, as the camera adapter tells it on the same source (the member `leg`).
      leg: (sessionId: string, deviceId: string, attempt: number, leg: Record<string, unknown>) => listeners.forEach((listener) => listener({ sessionId, deviceId, attempt, leg } as never)),
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
    // D60 / D61 (2026-11-04): the ended capture closes EIGHT sources — four channels, four tracks.
    expect(of.order.filter((entry) => entry.startsWith('close')).sort()).toEqual(['close CAM-01', 'close CAM-02', 'close CAM-03', 'close CAM-04', 'close MIC-01', 'close MIC-02', 'close MIC-03', 'close MIC-04']);
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

  // Finding F3-01 of the M3 review. THE WORKER'S SIDE OF A RELAY RE-OPEN (implementation/043, section 2 and the runs of
  // `row043_reopen.py`): the relay keeps its ONE push while it opens the camera again - the worker sees one connection,
  // says ONE `ingest_connected`, its gate sees no second announce and refuses nothing - so its telemetry keeps saying the
  // level `CONNECTED` through the gap. The relay's side: `camera_lost`, then `camera_reopened`, as leg reports.
  it('finding F3-01: a relay RE-OPEN inside a session is not a second arrival - the pairing is untouched (C35 (b)), the capture is NOT ended, and the absence is stated with both bounds; a leg report of another attempt is dropped (C37)', async () => {
    const { of, id, relay } = await production('r1_leg_reopen');
    const appended = vi.spyOn(of.app.errorLog, 'append');
    const entries = (code: string): Array<Record<string, unknown>> => appended.mock.calls.map(([entry]) => entry as { code?: string; level?: string; context?: Record<string, unknown> }).filter((entry) => entry.code === code).map((entry) => ({ level: entry.level, ...entry.context }));
    for (const camera of ['CAM-01', 'CAM-02']) {
      relay.report(id, camera);
      ingest(of, camera, 'CONNECTED');
    }
    await vi.waitFor(() => expect(paired(of).sort()).toEqual(['CAM-01@1', 'CAM-02@1']), { timeout: 5_000 });
    const before = await faultRows(of);
    // The bounds are instants of the Core's clock (the rig's manual clock).
    const startedAt = of.app.clock.now();

    // The loss: stated at once.
    relay.leg(id, 'CAM-01', 1, { event: 'LOST', profile: 'HEVC_1080P', loss: 1, cause: 'CAMERA_LOST' });
    expect(entries('CAPTURE_CAMERA_ABSENT_IN_SESSION')).toMatchObject([{ level: 'warn', sessionId: id, deviceId: 'CAM-01', profile: 'HEVC_1080P', attempt: 1, loss: 1, cause: 'CAMERA_LOST' }]);
    const lostAt = entries('CAPTURE_CAMERA_ABSENT_IN_SESSION')[0]?.lostAt as number;
    expect(lostAt).toBe(startedAt);
    // Through the gap (3 s of the Core's clock) the worker's level stays what it was, for both cameras, frame after frame.
    for (let frame = 0; frame < 3; frame += 1) {
      ingest(of, 'CAM-01', 'CONNECTED');
      ingest(of, 'CAM-02', 'CONNECTED');
      await of.drive(1_000);
    }
    // Said again by the relay's source: the same absence, one entry.
    relay.leg(id, 'CAM-01', 1, { event: 'LOST', profile: 'HEVC_1080P', loss: 1, cause: 'CAMERA_LOST' });
    // A re-open of another number, of another stream, of another camera ends nothing.
    relay.leg(id, 'CAM-01', 1, { event: 'REOPENED', profile: 'HEVC_1080P', loss: 2, tries: 1, heldBack: 0, gapMs: 1 });
    relay.leg(id, 'CAM-01', 1, { event: 'REOPENED', profile: 'H264_720P', loss: 1, tries: 1, heldBack: 0, gapMs: 1 });
    relay.leg(id, 'CAM-02', 1, { event: 'REOPENED', profile: 'HEVC_1080P', loss: 1, tries: 1, heldBack: 0, gapMs: 1 });
    expect(entries('CAPTURE_CAMERA_BACK_IN_SESSION')).toEqual([]);
    // The re-open: the first keyframe of the new leg is forwarded.
    relay.leg(id, 'CAM-01', 1, { event: 'REOPENED', profile: 'HEVC_1080P', loss: 1, tries: 1, heldBack: 25, gapMs: 3_040 });
    ingest(of, 'CAM-01', 'CONNECTED');
    const back = entries('CAPTURE_CAMERA_BACK_IN_SESSION');
    expect(back).toMatchObject([{ level: 'warn', sessionId: id, deviceId: 'CAM-01', profile: 'HEVC_1080P', attempt: 1, loss: 1, lostAt, relayGapMs: 3_040, heldBack: 25, tries: 1 }]);
    expect([back[0]?.backAt, back[0]?.absentMs]).toEqual([lostAt + 3_000, 3_000]);
    expect(entries('CAPTURE_CAMERA_ABSENT_IN_SESSION')).toHaveLength(1);
    // Row R1b: THE AUDIT ENTRY, written when the absence ended - nothing while it was open. At least = the relay's own measure
    // (3,040); at most = the Core's span (3,000), not below the relay's measure, plus the relay's silence bound (5,000).
    await of.settled();
    expect(await absenceRows(of, id)).toEqual([
      {
        category: 'DEVICE',
        severity: 'WARNING',
        actor_id: null,
        device_id: 'CAM-01',
        session_id: id,
        message: 'Video was not recorded while a camera of the session was absent (CAM-01, VIDEO-01; attempt 1, loss 1): its relay opened it again',
        details: { sessionId: id, deviceId: 'CAM-01', trackId: 'VIDEO-01', attempt: 1, loss: 1, tries: 1, videoAbsentAtLeastMs: 3_040, videoAbsentAtMostMs: 3_040 + RELAY_PLAYING_SILENCE_BOUND_MS, ended: 'RE_OPENED' },
      },
    ]);

    // C37, and what is not this capture's: a later attempt, an earlier one, 0, another session, a device that is no camera of the plan - dropped, no entry.
    relay.leg(id, 'CAM-01', 2, { event: 'LOST', profile: 'HEVC_1080P', loss: 2, cause: 'CAMERA_LOST' });
    relay.leg(id, 'CAM-01', 0, { event: 'LOST', profile: 'HEVC_1080P', loss: 2, cause: 'CAMERA_LOST' });
    relay.leg('S-OTHER-SESSION', 'CAM-01', 1, { event: 'LOST', profile: 'HEVC_1080P', loss: 2, cause: 'CAMERA_LOST' });
    relay.leg(id, 'CAM-09', 1, { event: 'LOST', profile: 'HEVC_1080P', loss: 2, cause: 'CAMERA_LOST' });
    // And what is no leg report of the form: no profile code, no loss number, an unknown event.
    relay.leg(id, 'CAM-01', 1, { event: 'LOST', profile: 'not a code', loss: 2 });
    relay.leg(id, 'CAM-01', 1, { event: 'LOST', profile: 'HEVC_1080P', loss: 0 });
    relay.leg(id, 'CAM-01', 1, { event: 'GONE', profile: 'HEVC_1080P', loss: 2 });
    expect(entries('CAPTURE_CAMERA_ABSENT_IN_SESSION')).toHaveLength(1);
    expect(linesOf(of, 'CAPTURE_CAMERA_LEG_REPORT_SUPERSEDED')).toMatchObject([
      { sessionId: id, deviceId: 'CAM-01', attempt: 2, attemptInForce: 1, dropped: 1 },
      { sessionId: id, deviceId: 'CAM-01', attempt: 0, attemptInForce: 1, dropped: 2 },
    ]);

    // THE PAIRING RULE IS UNCHANGED: past twice the bound nothing faulted, nothing was ended, no row of the fault trail was written by this unit.
    await wait(BOUND_MS * 2);
    await of.settled();
    expect([notPaired(of), await auditOfTheFault(of), await faultRows(of), sessionCapture(of.app).liveSessionId(), of.fake.last().commands('STOP').length]).toEqual([[], 0, before, id, 0]);
    expect(paired(of).sort()).toEqual(['CAM-01@1', 'CAM-02@1']);
    expect(of.app.engine.slice('session')).toMatchObject({ id, state: 'RECORDING' });
    expect(of.order.filter((entry) => entry.startsWith('close'))).toEqual([]);

    // CONTROL - the rule still bites: the SAME camera said by an established-push report (no member `leg`) a second time is the fault it always was.
    // First: a second absence that is still open when the capture ends is closed with the end as its later bound.
    relay.leg(id, 'CAM-02', 1, { event: 'LOST', profile: 'H264_1080P', loss: 1, cause: 'CAMERA_UNREACHABLE' });
    relay.report(id, 'CAM-01');
    await endedByThePairing(of, id, 'CAM-01@1 RELAY_REPORTED_TWICE');
    expect(entries('CAPTURE_CAMERA_ABSENT_AT_END')).toMatchObject([{ level: 'warn', sessionId: id, deviceId: 'CAM-02', profile: 'H264_1080P', attempt: 1, loss: 1 }]);
    const open = entries('CAPTURE_CAMERA_ABSENT_AT_END')[0];
    expect(open?.absentAtLeastMs).toBe((open?.endedAt as number) - (open?.lostAt as number));
    // Row R1b: the absence that did NOT end has its entry too, written at the end of the capture and stored BEFORE the capture
    // was handed on (`endedByThePairing` returned): the second row, of CAM-02 on VIDEO-02, with no tries. The first row is unchanged.
    // Nothing was written for the leg words that were dropped (another attempt, another session, no camera of the plan, no form).
    const stored = await absenceRows(of, id);
    expect(stored.map((row) => [row.device_id, row.details.trackId, row.details.loss, row.details.ended])).toEqual([
      ['CAM-01', 'VIDEO-01', 1, 'RE_OPENED'],
      ['CAM-02', 'VIDEO-02', 1, 'NOT_RE_OPENED'],
    ]);
    const notBack = stored[1]?.details as { videoAbsentAtLeastMs?: number; videoAbsentAtMostMs?: number; tries?: number };
    expect(Object.keys(stored[1]?.details ?? {}).sort()).toEqual(['attempt', 'deviceId', 'ended', 'loss', 'sessionId', 'trackId', 'videoAbsentAtLeastMs', 'videoAbsentAtMostMs']);
    expect(stored[1]?.message).toBe('Video was not recorded while a camera of the session was absent (CAM-02, VIDEO-02; attempt 1, loss 1): it had not come back when the capture ended');
    // At least: to the instant the end was asked; at most: to the end of the capture, plus the relay's silence bound - never below the least.
    const span = (open?.endedAt as number) - (open?.lostAt as number);
    expect(notBack.videoAbsentAtLeastMs).toBeGreaterThanOrEqual(0);
    expect(notBack.videoAbsentAtLeastMs).toBeLessThanOrEqual(span);
    expect(notBack.videoAbsentAtMostMs).toBe(span + RELAY_PLAYING_SILENCE_BOUND_MS);
    // No address and no text of a device is in any of the entries: identifiers, code words and numbers.
    for (const entry of [...entries('CAPTURE_CAMERA_ABSENT_IN_SESSION'), ...entries('CAPTURE_CAMERA_BACK_IN_SESSION'), ...entries('CAPTURE_CAMERA_ABSENT_AT_END')]) {
      for (const value of Object.values(entry)) expect(typeof value === 'number' || value === null || /^[A-Za-z0-9_-]{1,64}$/.test(String(value))).toBe(true);
    }
  });

  it('finding F3-01: an absence that is open when the worker of the session is replaced ends when the camera counts as open for the LATER worker - the relay of the earlier attempt can no longer say so; its late word is dropped (C37)', async () => {
    const relay = relays();
    const of = await rig('r1_leg_restart', { limits: { backoffBaseMs: 20, backoffMaxMs: 40 } });
    sessionCapture(of.app).replace({ operationOf: () => CaptureOperation.REAL_PRODUCTION, ingestPairingBoundMs: BOUND_MS, relayReports: relay.source });
    const appended = vi.spyOn(of.app.errorLog, 'append');
    const entries = (code: string): Array<Record<string, unknown>> => appended.mock.calls.map(([entry]) => entry as { code?: string; context?: Record<string, unknown> }).filter((entry) => entry.code === code).map((entry) => ({ ...entry.context }));
    const id = await of.arm();
    await of.start(id);
    relay.report(id, 'CAM-01');
    ingest(of, 'CAM-01', 'CONNECTED');
    await vi.waitFor(() => expect(paired(of)).toEqual(['CAM-01@1']), { timeout: 5_000 });
    relay.leg(id, 'CAM-01', 1, { event: 'LOST', profile: 'HEVC_1080P', loss: 1, cause: 'CAMERA_STALLED' });
    const lostAt = entries('CAPTURE_CAMERA_ABSENT_IN_SESSION')[0]?.lostAt as number;
    // The worker goes down before anything is durable; the Core issues attempt 2 and opens the cameras again.
    of.fake.last().exit(1);
    await vi.waitFor(() => expect(of.fake.workers).toHaveLength(2), { timeout: 5_000 });
    await vi.waitFor(() => expect(of.fake.last().commands('START')).toMatchObject([{ attempt: 2 }]), { timeout: 5_000 });
    await of.settled();
    // The relay of attempt 1 is being ended and still says its re-open: not in force, dropped - the absence is NOT ended by it.
    relay.leg(id, 'CAM-01', 1, { event: 'REOPENED', profile: 'HEVC_1080P', loss: 1, tries: 1, heldBack: 0, gapMs: 1 });
    expect(entries('CAPTURE_CAMERA_BACK_IN_SESSION')).toEqual([]);
    expect(linesOf(of, 'CAPTURE_CAMERA_LEG_REPORT_SUPERSEDED')).toMatchObject([{ sessionId: id, deviceId: 'CAM-01', attempt: 1, attemptInForce: 2, dropped: 1 }]);
    // The camera counts as open for the later worker: the absence is over, by the pairing's word.
    relay.report(id, 'CAM-01', 2);
    ingest(of, 'CAM-01', 'CONNECTED');
    await vi.waitFor(() => expect(paired(of)).toEqual(['CAM-01@1', 'CAM-01@2']), { timeout: 5_000 });
    expect(entries('CAPTURE_CAMERA_BACK_IN_SESSION')).toMatchObject([{ sessionId: id, deviceId: 'CAM-01', profile: 'HEVC_1080P', attempt: 1, loss: 1, lostAt, laterAttempt: 2, relayGapMs: null, heldBack: null, tries: null }]);
    await wait(BOUND_MS * 2);
    await of.settled();
    expect([notPaired(of), await auditOfTheFault(of), sessionCapture(of.app).liveSessionId()]).toEqual([[], 0, id]);
    // Row R1b: a later absence, said in the attempt IN FORCE, beside one more word of the superseded attempt.
    relay.leg(id, 'CAM-01', 2, { event: 'LOST', profile: 'HEVC_1080P', loss: 1, cause: 'CAMERA_STALLED' });
    relay.leg(id, 'CAM-01', 1, { event: 'LOST', profile: 'HEVC_1080P', loss: 2, cause: 'CAMERA_STALLED' });
    await sessionCapture(of.app).shutdown();
    // The absence of attempt 2 was open at the end: stated once. The one of attempt 1 was over before.
    expect(entries('CAPTURE_CAMERA_ABSENT_AT_END')).toMatchObject([{ sessionId: id, deviceId: 'CAM-01', attempt: 2, loss: 1 }]);
    // Row R1b: A SUPERSEDED ATTEMPT WRITES NOTHING - the absence of attempt 1 (ended by the later worker's pairing) has no audit
    // entry; the only entry is the absence of the attempt in force, which did not end. A shutdown asks no end first: its least is not measured.
    const stored = await absenceRows(of, id);
    expect(stored.map((row) => row.details)).toMatchObject([{ sessionId: id, deviceId: 'CAM-01', trackId: 'VIDEO-01', attempt: 2, loss: 1, ended: 'NOT_RE_OPENED' }]);
    expect(Object.keys(stored[0]?.details ?? {}).sort()).toEqual(['attempt', 'deviceId', 'ended', 'loss', 'sessionId', 'trackId', 'videoAbsentAtMostMs']);
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

  // D61 (2026-11-04): the microphone plane is FOUR numbered channels, so the row's facts are keyed by
  // the channel (`MIC-01`..`MIC-04`), never by the superseded role words (`MIC-PRIMARY`/`MIC-STANDBY`).
  it('a start with doubles writes the card facts of ALL FOUR microphones - which card, which input, rate and format - and nothing for the cameras; they are in the rows of the start, not written afterwards', async () => {
    const of = await rig('r71_facts', { registry: stating((inputId) => (inputId === 'MIC-01' ? CARD : { ...CARD, product: '  UMC1820  ', usbId: null, cardId: 'U192k', cardDevice: 1, inputNumber: 2, nativeChannels: 2, sampleBits: 16 })) });
    const id = await of.arm();
    await of.start(id);
    expect(await factsOf(of, id)).toEqual({
      'MIC-01': { model: 'Scarlett 18i20 USB', usbId: '1235:8215', cardId: 'USB', cardDevice: 0, inputNumber: 1, nativeChannels: 18, sampleRate: 48_000, sampleBits: 24 }, // D61: the channel keys the row
      // A card that is not USB has no USB id: the key is absent, never a made-up id. The spaces at both ends of a name are dropped by the card text rule.
      'MIC-02': { model: 'UMC1820', cardId: 'U192k', cardDevice: 1, inputNumber: 2, nativeChannels: 2, sampleRate: 48_000, sampleBits: 16 },
      'MIC-03': { model: 'UMC1820', cardId: 'U192k', cardDevice: 1, inputNumber: 2, nativeChannels: 2, sampleRate: 48_000, sampleBits: 16 }, // D61: the third and fourth channel state the same second card
      'MIC-04': { model: 'UMC1820', cardId: 'U192k', cardDevice: 1, inputNumber: 2, nativeChannels: 2, sampleRate: 48_000, sampleBits: 16 },
      'VIDEO-01': {},
      'VIDEO-02': {},
      'VIDEO-03': {}, // D60
      'VIDEO-04': {}, // D60
    });
    // One instant and one statement for the eight rows (MR-S1, D60/D61), and the session records.
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
      'MIC-01': { model: 'UNKNOWN', usbId: '0000:0000' }, // D61: keyed by channel
      'MIC-02': { model: 'UNKNOWN', usbId: '0000:0000', cardId: 'USB_2', cardDevice: 0, nativeChannels: 18, sampleRate: 48_000 },
      // D61: the two channels the hostile map does not name state nothing at all.
      'MIC-03': {},
      'MIC-04': {},
      'VIDEO-01': {},
      'VIDEO-02': {},
      'VIDEO-03': {}, // D60
      'VIDEO-04': {}, // D60
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

  it('CONTROL - adapters that state nothing (the fakes as they are): eight rows with {} and no entry in the log; an adapter that THROWS does not refuse the start - {} for that microphone, ONE warning with the session and the device, the other microphones keep their facts', async () => { // D60/D61: eight rows
    const plain = await rig('r71_plain');
    const plainId = await plain.arm();
    await plain.start(plainId);
    expect(await factsOf(plain, plainId)).toEqual({ 'MIC-01': {}, 'MIC-02': {}, 'MIC-03': {}, 'MIC-04': {}, 'VIDEO-01': {}, 'VIDEO-02': {}, 'VIDEO-03': {}, 'VIDEO-04': {} }); // D60 / D61
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
    expect(facts['MIC-02']).toEqual({}); // D61: the channel keys the row
    expect(facts['MIC-01']).toMatchObject({ model: 'Scarlett 18i20 USB', inputNumber: 1 });
    expect([facts['MIC-03'], facts['MIC-04']]).toEqual([expect.objectContaining({ model: 'Scarlett 18i20 USB' }), expect.objectContaining({ model: 'Scarlett 18i20 USB' })]); // D61: the channels that did not throw keep theirs
    expect(warned(of)).toEqual(['CAPTURE_SOURCE_FACTS_NOT_READ']);
    const entries = appended.mock.calls.map(([entry]) => entry).filter((entry) => entry.code === 'CAPTURE_SOURCE_FACTS_NOT_READ');
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ level: 'warn', context: { sessionId: id, deviceId: 'MIC-02', slot: 'MIC-02', cause: 'UNEXPECTED' } }); // D61: the audit slot is the channel
    // What the adapter threw may carry device text: its message is in no entry and in no log line.
    expect(JSON.stringify(entries) + JSON.stringify(of.log.lines())).not.toContain('SECRET');
    expect(of.app.engine.slice('session')?.state).toBe('RECORDING');
    await sessionCapture(of.app).shutdown();
  });
});

// Audit 2026-11-05, W1 DB window, decision D42 (row 96, DF-33): the row-71 block above proves the write of the facts with
// DOUBLES that answer `sourceFacts` whether or not a microphone is open - so it could not catch DF-33 (every production
// row `{}`: the rows are written at the start, BEFORE the microphones open, and the adapter stated only an open card).
// THIS case uses THE REAL `USB_AUDIO` PRODUCTION ADAPTER (`createUsbAudioProductionAdapter`) over the fake card-listing
// seam (`CardListingSource` -> `createCardEnumerator`: fixed texts in the forms of a Linux host; no card, no ALSA). Its
// enumeration, identification memo and `sourceFacts` are the production code. The pre-check is the app's own gate
// (`captureNotices(app).beforePrecheck`, what operation 28 runs before the hosted pre-check) over a probe of THIS adapter.
// WHAT STANDS IN, AND WHY IT DOES NOT TOUCH THE CLAIM: the adapter's `open` is routed to a fake microphone (a real open
// needs the helper program and an ALSA card), and the cameras are the fake cameras under the production kind. The source
// rows are written before any open (capture-session/index.ts `recordingStartedIn`), so no open can feed what is asserted.
describe('D42 (W1 DB window; row 96, DF-33): the REAL USB_AUDIO production adapter states its card at the start - session_capture_sources holds non-empty facts', () => {
  it('pre-check through the gate, then the start: all four MIC rows hold the card the pre-check identified, no CAPTURE_SOURCE_FACTS_NOT_STATED; before the pre-check the adapter stated nothing (CONTROL)', async () => {
    const PORT = '0000:00:14.0-2';
    const QUAD = { index: 1, id: 'Quad', product: 'DEMS Test Quad', usbId: '1a2b:0004', channels: 4 } as const;
    let lists = 0;
    // The card-listing seam with the texts of a host that has ONE four-input USB card (the forms of the adapter's unit test).
    const listing: CardListingSource = {
      async captureDevices() {
        lists += 1;
        return `**** List of CAPTURE Hardware Devices ****\ncard ${QUAD.index}: ${QUAD.id} [${QUAD.product}], device 0: USB Audio [USB Audio]\n  Subdevices: 1/1\n  Subdevice #0: subdevice #0\n`;
      },
      async presentCards() {
        return `${String(QUAD.index).padStart(2)} [${QUAD.id.padEnd(15)}]: USB-Audio - ${QUAD.product}\n                      ${QUAD.product}\n`;
      },
      async usbId(cardIndex) {
        return cardIndex === QUAD.index ? `${QUAD.usbId}\n` : null;
      },
      async usbSerial() {
        return null;
      },
      async stream(cardIndex) {
        if (cardIndex !== QUAD.index) return null;
        return `${QUAD.product} at usb-${PORT}, high speed : USB Audio\n\nCapture:\n  Status: Stop\n  Interface 1\n    Altset 1\n    Format: S24_3LE\n    Channels: ${QUAD.channels}\n    Endpoint: 0x81 (1 IN) (ASYNC)\n    Rates: 44100, 48000\n    Bits: 24\n\n`;
      },
      async hwParams(cardIndex) {
        if (cardIndex !== QUAD.index) return null;
        return `HW Params of device "hw:${cardIndex},0":\n--------------------\nFORMAT:  S16_LE S32_LE\nCHANNELS: ${QUAD.channels}\nRATE: [44100 192000]\n--------------------\n`;
      },
    };
    const MICS = ['MIC-01', 'MIC-02', 'MIC-03', 'MIC-04'] as const;
    // The stored rows as the registration stores them: input n of the card for MIC-0n.
    const stored = new Map<string, RegisteredAudioInput>(MICS.map((deviceId, index) => [deviceId, { deviceId, usbId: QUAD.usbId, usbSerial: null, usbPort: PORT, cardId: QUAD.id, cardDevice: 0, inputNumber: index + 1, nativeChannels: QUAD.channels }]));
    const runDir = `${fixture.dataDir}/run-dbw1-d42/run/capture`;
    mkdirSync(runDir, { recursive: true });
    const real = createUsbAudioProductionAdapter({
      devices: MICS.map((id) => ({ id, deviceClass: 'MIC', label: id, capabilities: ['AUDIO'], profiles: [] })),
      registered: async (deviceId) => stored.get(deviceId) ?? null,
      cards: createCardEnumerator(listing),
      configWriter: createAlsaConfigWriter(runDir),
      helperProgram: '/opt/dems/bin/ffmpeg',
      guardProgram: '/opt/dems/bin/capture-guard',
      runDir,
      timers: createSystemTimers(),
      // No process is started by this case: a door that is asked at all fails the case loudly.
      door: () => {
        throw new Error('D42 case: the production door was asked to start a process');
      },
    });
    expect(real.kind).toBe('USB_AUDIO');
    const stand = new Map(MICS.map((id) => [id, createFakeAudioInputAdapter({ id, runDir })] as const));
    const microphone = { ...real, open: async (inputId: string, to: Parameters<typeof real.open>[1]) => (stand.get(inputId as (typeof MICS)[number]) ?? stand.get('MIC-01'))!.open(inputId, to) } as unknown as typeof real;
    const cameras = ['CAM-01', 'CAM-02', 'CAM-03', 'CAM-04'].map((id) => ({ ...createFakeCameraAdapter({ id }), kind: 'ONVIF_RTSP' as const, hasOpener: true }));
    const productionRegistry = (): CaptureDeviceRegistry => {
      const production = createCaptureDeviceRegistry({ operation: CaptureOperation.REAL_PRODUCTION });
      for (const camera of cameras) production.register(camera);
      production.register(microphone);
      return production;
    };
    const of = await rig('dbw1_d42_usb_audio', { registry: productionRegistry });
    sessionCapture(of.app).replace({ operationOf: () => CaptureOperation.REAL_PRODUCTION, relayReports: SILENT_RELAYS });
    captureNotices(of.app).provideProbe(probeOfAdapters({ cameras, microphones: [microphone] }));

    // CONTROL: before any identification the real adapter states nothing - the memo row 96 added is empty.
    for (const id of MICS) expect(real.sourceFacts(id), id).toBeNull();

    // Idle -> ARMED as the routes do it: operation 24, then operation 28 = the gate's probe run, then the hosted pre-check.
    await of.app.engine.setTabletLink('CONNECTED');
    const created = await of.app.engine.command(of.investigator, 'createSession', { caseNumber: 'LP/2026/1105-0042', subjectType: 'SAKSI', subjectName: 'Test Subject', room: 'Interview Room 1', profileId: 'STANDARD_1080P25', investigatorId: of.investigator.operatorId });
    if (!created.value.ok) throw new Error(`the session was not created: ${created.value.reason}`);
    const id = created.value.sessionId;
    await captureNotices(of.app).beforePrecheck({ sessionId: id, kind: 'BEGIN', owner: { operatorId: of.investigator.operatorId, authSessionId: of.investigator.sessionId, deviceId: null } });
    // The gate asked THIS adapter: the card listing was read, and the identification of every input is held.
    expect(lists).toBeGreaterThan(0);
    for (const id_ of MICS) expect(real.sourceFacts(id_), id_).toMatchObject({ product: QUAD.product, usbId: QUAD.usbId, cardId: QUAD.id, inputNumber: Number(id_.slice(-1)), nativeChannels: QUAD.channels });
    await of.app.engine.command(of.investigator, 'beginPrecheck');
    await of.drive(5_000);
    if (of.app.engine.slice('session')?.state === 'PRECHECK') await of.app.engine.command(of.investigator, 'acknowledgePrecheckWarnings');
    expect(of.app.engine.slice('session')?.state).toBe('ARMED');

    await of.start(id);
    const rows = await of.rows<{ slot: string; adapter_kind: string; source_facts: Record<string, unknown> }>('SELECT slot, adapter_kind, source_facts FROM public.session_capture_sources WHERE session_id = $1 ORDER BY slot', [id]);
    expect(rows.map((row) => row.slot)).toEqual(['MIC-01', 'MIC-02', 'MIC-03', 'MIC-04', 'VIDEO-01', 'VIDEO-02', 'VIDEO-03', 'VIDEO-04']);
    for (const row of rows.filter((candidate) => candidate.slot.startsWith('MIC-'))) {
      expect(row.adapter_kind, row.slot).toBe('USB_AUDIO');
      // DF-33 was `{}` here on every production start.
      expect(Object.keys(row.source_facts).length, row.slot).toBeGreaterThan(0);
      expect(row.source_facts, row.slot).toMatchObject({ model: QUAD.product, usbId: QUAD.usbId, cardId: QUAD.id, cardDevice: 0, inputNumber: Number(row.slot.slice(-1)), nativeChannels: QUAD.channels, sampleRate: 48_000 });
    }
    for (const row of rows.filter((candidate) => candidate.slot.startsWith('VIDEO-'))) expect(row.source_facts, row.slot).toEqual({});
    // The log of the start: no "stated no card facts" (CAPTURE_SOURCE_FACTS_NOT_STATED), no "could not be read".
    expect(of.log.lines().map((line) => String(line.code)).filter((code) => code.startsWith('CAPTURE_SOURCE_FACTS_'))).toEqual([]);
    await sessionCapture(of.app).shutdown();
  });
});

// Task 4 row 191 (the finding of row 184: a later worker of a session received 0 samples). WHAT IS REAL: the capture-session
// unit, the real supervisor with the system timers, the plan builder, the registry. WHAT STANDS IN: the worker (the fake
// worker process: it reads no pipe, so "the later worker hears both microphones" is NOT shown here - it is shown with the built
// worker in the scenario of the row's record) and the microphones (the fake audio adapters, which refuse an input that is still
// open, with a scripted `start` on their handles as the local and the production handles have one).
describe('task 4 row 191: the microphones of a session are closed, opened and started again for a later worker', () => {
  const FAST_RESTART = { backoffBaseMs: 20, backoffMaxMs: 40 };
  const pause = (ms: number): Promise<void> => new Promise<void>((resolve) => setTimeout(resolve, ms));
  interface Script {
    /** How the n-th open of a microphone ends: at once, after a delay in ms, or refused. */
    readonly open?: (deviceId: string, nth: number) => 'OK' | 'FAIL' | number;
    /** How the start of the handle of the n-th open ends: it settles, it fails, or it has no outcome until the handle is closed. */
    readonly start?: (deviceId: string, nth: number) => 'SETTLE' | 'FAIL' | 'UNTIL_CLOSED';
  }
  function microphones(script: Script = {}) {
    /** `open MIC-01#2 w1`: the second open of MIC-01 ended while one worker had been started. `phase X` is the supervisor's. */
    const log: string[] = [];
    const opens = new Map<string, number>();
    const watch = { workers: (): number => 0 };
    const registry = (built: CaptureDeviceRegistry): CaptureDeviceRegistry => ({
      ...built,
      resolve: ((deviceClass: 'CAMERA' | 'MIC', deviceId: string) => {
        if (deviceClass === 'CAMERA') {
          const adapter = built.resolve('CAMERA', deviceId);
          return { ...adapter, openSource: async (id: string, to: Parameters<typeof adapter.openSource>[1], signal: AbortSignal) => (log.push(`camera ${id}`), adapter.openSource(id, to, signal)) };
        }
        const adapter = built.resolve('MIC', deviceId);
        return {
          ...adapter,
          open: async (inputId: string, to: Parameters<typeof adapter.open>[1]) => {
            const nth = (opens.get(inputId) ?? 0) + 1;
            opens.set(inputId, nth);
            const how = script.open?.(inputId, nth) ?? 'OK';
            if (typeof how === 'number') await pause(how);
            if (how === 'FAIL') {
              log.push(`open-refused ${inputId}#${nth}`);
              throw new Error('the scripted microphone could not be opened');
            }
            const handle = await adapter.open(inputId, to);
            log.push(`open ${inputId}#${nth} w${watch.workers()}`);
            let closed: () => void = () => undefined;
            const untilClosed = new Promise<void>((resolve) => (closed = resolve));
            return {
              ...handle,
              start: (): Promise<void> => {
                log.push(`start ${inputId}#${nth} w${watch.workers()}`);
                const end = script.start?.(inputId, nth) ?? 'SETTLE';
                if (end === 'SETTLE') return pause(10);
                if (end === 'FAIL') return pause(10).then(() => Promise.reject(new Error('the scripted helper ended at once')));
                return untilClosed.then(() => Promise.reject(new Error('the scripted helper was ended by the close of its handle')));
              },
              close: async (): Promise<void> => {
                log.push(`close ${inputId}#${nth}`);
                closed();
                await handle.close();
              },
            };
          },
        };
      }) as CaptureDeviceRegistry['resolve'],
    });
    const follow = (of: Rig): void => {
      watch.workers = () => of.fake.workers.length;
      of.supervisor.on('phase', (event) => void log.push(`phase ${event.phase}`));
    };
    return { log, registry, follow };
  }
  const micsOfWorker = (of: Rig, index: number): string[] => (of.fake.workers[index]?.commands('START')[0]?.plan.mics ?? []).map((mic) => `${mic.deviceId} ${mic.channel}`); // D61 (2026-11-04): the plan line names its numbered channel
  const micEntries = (appended: { mock: { calls: Array<[{ code?: string; level: string; context?: Record<string, unknown> }]> } }, code: string) =>
    // D61 (2026-11-04): the failure row of a microphone names its CHANNEL (`channel`), not the superseded `role`.
    appended.mock.calls.map(([entry]) => entry).filter((entry) => entry.code === code).map((entry) => [entry.level, entry.context?.['deviceId'], entry.context?.['channel'], entry.context?.['attempt'] ?? null, entry.context?.['cause'] ?? null]);
  const secondRecords = async (of: Rig): Promise<void> => {
    await vi.waitFor(() => expect(of.fake.workers).toHaveLength(2), { timeout: 5_000 });
    await vi.waitFor(() => expect(of.supervisor.status()).toMatchObject({ phase: 'RECORDING', attempt: 2 }), { timeout: 5_000 });
    await pause(40);
    await of.settled();
  };

  it('REAL_PRODUCTION, sources ready INSIDE the back-off: each microphone is started ONCE per attempt; the handles of attempt 1 are closed, ALL FOUR (D61), before any is opened again; the pipes are made again before worker 2 exists; the starts follow its acknowledgement and precede its cameras; 0 handles left open', async () => {
    const mics = microphones();
    const of = await rig('r191_two_attempts', { registry: mics.registry, limits: FAST_RESTART });
    mics.follow(of);
    sessionCapture(of.app).replace({ operationOf: () => CaptureOperation.REAL_PRODUCTION, relayReports: SILENT_RELAYS });
    const id = await of.arm();
    await of.start(id);
    const first = [...mics.log];
    // Attempt 1, as before this row: opened before the worker, started after its acknowledgement, before the
    // cameras. D61 (2026-11-04): FOUR channels of the numbered plane, and D60: four camera lines.
    expect(first.filter((entry) => !entry.startsWith('phase'))).toEqual(['open MIC-01#1 w0', 'open MIC-02#1 w0', 'open MIC-03#1 w0', 'open MIC-04#1 w0', 'start MIC-01#1 w1', 'start MIC-02#1 w1', 'start MIC-03#1 w1', 'start MIC-04#1 w1', 'camera CAM-01', 'camera CAM-02', 'camera CAM-03', 'camera CAM-04']);
    mics.log.length = 0;

    of.fake.last().exit(1);
    await secondRecords(of);
    await vi.waitFor(() => expect(mics.log.filter((entry) => entry.startsWith('camera'))).toHaveLength(4), { timeout: 5_000 }); // D60
    // D61: the whole four-channel plane is closed, opened and started again for the later worker.
    expect(mics.log).toEqual([
      'phase RESTARTING',
      'close MIC-01#1',
      'close MIC-02#1',
      'close MIC-03#1',
      'close MIC-04#1',
      'open MIC-01#2 w1',
      'open MIC-02#2 w1',
      'open MIC-03#2 w1',
      'open MIC-04#2 w1',
      'phase RECORDING',
      'start MIC-01#2 w2',
      'start MIC-02#2 w2',
      'start MIC-03#2 w2',
      'start MIC-04#2 w2',
      'camera CAM-01',
      'camera CAM-02',
      'camera CAM-03',
      'camera CAM-04',
    ]);
    // The plan of the later worker names all four microphones, with the pipes of the handles that were opened for it.
    expect(micsOfWorker(of, 1)).toEqual(['MIC-01 MIC-01', 'MIC-02 MIC-02', 'MIC-03 MIC-03', 'MIC-04 MIC-04']);
    expect(of.fake.workers[1]?.commands('START')[0]?.plan.mics).toEqual(of.fake.workers[0]?.commands('START')[0]?.plan.mics);
    expect(of.log.lines().filter((line) => ['CAPTURE_MIC_NOT_OPENED', 'CAPTURE_MIC_NOT_STARTED', 'CAPTURE_SOURCE_NOT_CLOSED', 'CAPTURE_MIC_REPORT_SUPERSEDED'].includes(String(line.code)))).toEqual([]);
    expect(of.events.filter((event) => event.type === 'STARTED')).toHaveLength(1);
    await sessionCapture(of.app).shutdown();
    const all = [...first, ...mics.log];
    for (const deviceId of ['MIC-01', 'MIC-02', 'MIC-03', 'MIC-04']) { // D61: four channels
      expect(all.filter((entry) => entry.startsWith(`start ${deviceId}#`))).toHaveLength(2);
      expect([all.filter((entry) => entry.startsWith(`open ${deviceId}#`)).length, all.filter((entry) => entry.startsWith(`close ${deviceId}#`)).length]).toEqual([2, 2]);
    }
  });

  it('REAL_DEVELOPMENT, sources ready AFTER the back-off (an open that needs 150 ms against a back-off of 20 ms): worker 2 is not started before the last pipe is made again; the starts follow its acknowledgement; the camera sources are left as they were (row 179)', async () => {
    const mics = microphones({ open: (_deviceId, nth) => (nth === 2 ? 150 : 'OK') });
    const of = await rig('r191_slow_open', { registry: mics.registry, limits: FAST_RESTART });
    mics.follow(of);
    const id = await of.arm();
    await of.start(id);
    mics.log.length = 0;
    const downAt = performance.now();
    of.fake.last().exit(1);
    await pause(100);
    // Past the back-off (20 ms) and before the opens: no later worker, phase RESTARTING, attempt 2 counted.
    expect(of.fake.workers).toHaveLength(1);
    expect(of.supervisor.status()).toMatchObject({ phase: 'RESTARTING', attempt: 2 });
    await secondRecords(of);
    // D61 (2026-11-04): the four-channel plane is closed and made again as one set.
    expect(mics.log).toEqual(['phase RESTARTING', 'close MIC-01#1', 'close MIC-02#1', 'close MIC-03#1', 'close MIC-04#1', 'open MIC-01#2 w1', 'open MIC-02#2 w1', 'open MIC-03#2 w1', 'open MIC-04#2 w1', 'phase RECORDING', 'start MIC-01#2 w2', 'start MIC-02#2 w2', 'start MIC-03#2 w2', 'start MIC-04#2 w2']);
    expect(performance.now() - downAt).toBeGreaterThanOrEqual(300);
    expect(of.order.filter((entry) => / CAM-/.test(entry) && !entry.startsWith('open'))).toEqual([]);
    expect(sessionCapture(of.app).liveSessionId()).toBe(id);
    await sessionCapture(of.app).shutdown();
    expect(mics.log.filter((entry) => entry.startsWith('close MIC-')).sort()).toEqual(['close MIC-01#1', 'close MIC-01#2', 'close MIC-02#1', 'close MIC-02#2', 'close MIC-03#1', 'close MIC-03#2', 'close MIC-04#1', 'close MIC-04#2']); // D61: four channels
  });

  // Row 148 (D5 pairs, D30 K-3; rows 144 + 147; edit-only under D32, run in the DB window): the rule changed shape
  // AGAIN. Protocol 6 takes 0 to 4 microphone rows, and a channel that cannot be opened for the later worker is
  // STATED on the camera of its pair (`micMissing: NOT_OPENED`, a silent audio track): the later worker comes up and
  // records (D61's "no later worker" is superseded). Channel 1 is no exception when the plan of the start has no PCM
  // tap (this rig: STT off); with a tap the later worker still needs it (the supervisor test pins that control).
  // The level of the row: a warning, since the recording goes on.
  it('a microphone that cannot be OPENED again (row 148, D30 K-3): the row names its channel and attempt at warn, and the later worker comes up with the camera of its pair stating NOT_OPENED', async () => {
    const standby = microphones({ open: (deviceId, nth) => (deviceId === 'MIC-02' && nth === 2 ? 'FAIL' : 'OK') });
    const withPrimary = await rig('r191_standby_not_opened', { registry: standby.registry, limits: FAST_RESTART });
    standby.follow(withPrimary);
    const appended = vi.spyOn(withPrimary.app.errorLog, 'append');
    const id = await withPrimary.arm();
    await withPrimary.start(id);
    withPrimary.fake.last().exit(1);
    await vi.waitFor(() => expect(withPrimary.fake.workers).toHaveLength(2), { timeout: 5_000 });
    await withPrimary.settled();
    expect(micEntries(appended, 'CAPTURE_MIC_NOT_OPENED')).toEqual([['warn', 'MIC-02', 'MIC-02', 2, null]]);
    const later = withPrimary.fake.last().commands('START')[0] as { plan: { cameras: Array<{ trackId: string; micMissing: string | null }>; mics: Array<{ channel: string }> } } | undefined;
    expect(later?.plan.mics.map((mic) => mic.channel)).toEqual(['MIC-01', 'MIC-03', 'MIC-04']);
    expect(later?.plan.cameras.map((camera) => [camera.trackId, camera.micMissing])).toEqual([['VIDEO-01', null], ['VIDEO-02', 'NOT_OPENED'], ['VIDEO-03', null], ['VIDEO-04', null]]);
    expect(withPrimary.fake.last().received.map((message) => message.type as string)).not.toContain('SWITCH_AUDIO_SOURCE'); // audit row 149: no such command
    expect(sessionCapture(withPrimary.app).liveSessionId()).toBe(id);
    await sessionCapture(withPrimary.app).shutdown();
    // Everything that WAS opened again is closed with the capture: nothing is left open (three channels reached #2).
    expect(standby.log.filter((entry) => entry.startsWith('close MIC-')).sort()).toEqual(['close MIC-01#1', 'close MIC-01#2', 'close MIC-02#1', 'close MIC-03#1', 'close MIC-03#2', 'close MIC-04#1', 'close MIC-04#2']);

    const primary = microphones({ open: (deviceId, nth) => (deviceId === 'MIC-01' && nth === 2 ? 'FAIL' : 'OK') });
    const without = await rig('r191_primary_not_opened', { registry: primary.registry, limits: FAST_RESTART });
    primary.follow(without);
    const said = vi.spyOn(without.app.errorLog, 'append');
    const second = await without.arm();
    await without.start(second);
    without.fake.last().exit(1);
    await vi.waitFor(() => expect(without.fake.workers).toHaveLength(2), { timeout: 5_000 });
    await without.settled();
    // No tap in this plan: channel 1 lost is a warning and VIDEO-01 states NOT_OPENED (R147-1).
    expect(micEntries(said, 'CAPTURE_MIC_NOT_OPENED')).toEqual([['warn', 'MIC-01', 'MIC-01', 2, null]]);
    const laterOne = without.fake.last().commands('START')[0] as { plan: { cameras: Array<{ trackId: string; micMissing: string | null }>; pcmTapPath: string | null } } | undefined;
    expect(laterOne?.plan.cameras.map((camera) => camera.micMissing)).toEqual(['NOT_OPENED', null, null, null]);
    expect(laterOne?.plan.pcmTapPath).toBeNull();
    expect(sessionCapture(without.app).liveSessionId()).toBe(second);
    await sessionCapture(without.app).shutdown();
    expect(primary.log.filter((entry) => entry.startsWith('close MIC-')).sort()).toEqual(['close MIC-01#1', 'close MIC-02#1', 'close MIC-02#2', 'close MIC-03#1', 'close MIC-03#2', 'close MIC-04#1', 'close MIC-04#2']);
  });

  it('a microphone that cannot be STARTED again is said with its channel, as at a first start (D61): channel 1 an error, the three later channels a warning; the capture goes on and nothing is switched', async () => {
    const mics = microphones({ start: (_deviceId, nth) => (nth === 2 ? 'FAIL' : 'SETTLE') });
    const of = await rig('r191_not_started_again', { registry: mics.registry, limits: FAST_RESTART });
    mics.follow(of);
    const appended = vi.spyOn(of.app.errorLog, 'append');
    const id = await of.arm();
    await of.start(id);
    of.fake.last().exit(1);
    await secondRecords(of);
    expect(micEntries(appended, 'CAPTURE_MIC_NOT_STARTED').sort()).toEqual([
      ['error', 'MIC-01', 'MIC-01', null, 'MIC_START_FAILED'], // D61: channel 1 is the error
      ['warn', 'MIC-02', 'MIC-02', null, 'MIC_START_FAILED'],
      ['warn', 'MIC-03', 'MIC-03', null, 'MIC_START_FAILED'],
      ['warn', 'MIC-04', 'MIC-04', null, 'MIC_START_FAILED'],
    ]);
    expect(of.fake.last().received.map((message) => message.type as string)).not.toContain('SWITCH_AUDIO_SOURCE'); // audit row 149: no such command
    expect(sessionCapture(of.app).liveSessionId()).toBe(id);
    await sessionCapture(of.app).shutdown();
  });

  it('the reading of C37 for microphones: a start of attempt 1 that is still in flight when its worker is replaced ends with the close of its handle - NO failed microphone is said (0 entries), one counted log line per microphone; CONTROL: the same end without a restart IS said', async () => {
    const mics = microphones({ start: (_deviceId, nth) => (nth === 1 ? 'UNTIL_CLOSED' : 'SETTLE') });
    const of = await rig('r191_superseded_start', { registry: mics.registry, limits: FAST_RESTART });
    mics.follow(of);
    const appended = vi.spyOn(of.app.errorLog, 'append');
    const id = await of.arm();
    const capture = sessionCapture(of.app);
    await capture.beforeStart();
    await of.app.engine.run('sessions.startSession', async (scope) => {
      await scope.command(of.investigator, 'startRecording');
      await capture.recordingStartedIn(scope, id);
    });
    capture.afterStartCommitted(id);
    await vi.waitFor(() => expect(mics.log.filter((entry) => entry.startsWith('start'))).toHaveLength(4), { timeout: 5_000 }); // D61: four channels
    // The session has not said STARTED: it waits for the starts of the worker in force.
    expect(of.events.map((event) => event.type)).toEqual(['CONNECTING']);
    of.fake.last().exit(1);
    await secondRecords(of);
    await vi.waitFor(() => expect(of.events.map((event) => event.type)).toEqual(['CONNECTING', 'STARTED']), { timeout: 5_000 });
    expect(micEntries(appended, 'CAPTURE_MIC_NOT_STARTED')).toEqual([]);
    // D61 (2026-11-04): the superseded report is said per CHANNEL (`channel`), four of them.
    expect(of.log.lines().filter((line) => line.code === 'CAPTURE_MIC_REPORT_SUPERSEDED').map((line) => [line.deviceId, line.channel, line.attempt, line.attemptInForce, line.dropped]).sort()).toEqual([
      ['MIC-01', 'MIC-01', 1, 2, expect.any(Number)],
      ['MIC-02', 'MIC-02', 1, 2, expect.any(Number)],
      ['MIC-03', 'MIC-03', 1, 2, expect.any(Number)],
      ['MIC-04', 'MIC-04', 1, 2, expect.any(Number)],
    ]);
    // STARTED was said after the starts of attempt 2, not after those of the worker that was replaced.
    expect(mics.log.filter((entry) => entry.startsWith('start'))).toEqual(['start MIC-01#1 w1', 'start MIC-02#1 w1', 'start MIC-03#1 w1', 'start MIC-04#1 w1', 'start MIC-01#2 w2', 'start MIC-02#2 w2', 'start MIC-03#2 w2', 'start MIC-04#2 w2']);
    await capture.shutdown();

    const control = microphones({ start: () => 'FAIL' });
    const plain = await rig('r191_superseded_control', { registry: control.registry, limits: FAST_RESTART });
    const said = vi.spyOn(plain.app.errorLog, 'append');
    await plain.start(await plain.arm());
    expect(micEntries(said, 'CAPTURE_MIC_NOT_STARTED').sort()).toEqual([
      ['error', 'MIC-01', 'MIC-01', null, 'MIC_START_FAILED'], // D61: the channel, and channel 1 is the error
      ['warn', 'MIC-02', 'MIC-02', null, 'MIC_START_FAILED'],
      ['warn', 'MIC-03', 'MIC-03', null, 'MIC_START_FAILED'],
      ['warn', 'MIC-04', 'MIC-04', null, 'MIC_START_FAILED'],
    ]);
    await sessionCapture(plain.app).shutdown();
  });

  it('WHAT THE RESTART COST THE AUDIO is on record, and no continuity is claimed: one entry with the instant the worker went down, the time without audio as two bounds on the Core\'s own clock (until the microphones were started again; until the later worker\'s record arrived), the worker\'s own word beside them, and the time the earlier worker heard that is not recorded; row 191b: the EARLIER worker\'s interval row is closed at the instant it went down and the later worker\'s is a NEW row, with ONE audit row of the gap; CONTROL: a session without a restart writes no such entry', async () => {
    const of = await rig('r191_audio_gap', { limits: FAST_RESTART });
    const appended = vi.spyOn(of.app.errorLog, 'append');
    const id = await of.arm();
    await of.start(id);
    const firstAt = of.app.clock.now() - 400;
    of.fake.last().record({ ...startInterval, capturedAtMs: firstAt, fromSample: 1_008 });
    await of.settled();
    expect(appended.mock.calls.map(([entry]) => entry).filter((entry) => entry.code === 'CAPTURE_AUDIO_BEGINS_AFTER_RESTART')).toEqual([]);
    of.fake.last().exit(1);
    await secondRecords(of);
    const downAt = of.supervisor.status().lastCrash?.at ?? Number.NaN;
    // The Core's clock is the case's: 900 ms pass between the start of the microphones and the arrival of the later worker's record.
    await of.drive(900);
    const heardAt = of.app.clock.now();
    // The worker's own instant for its first sample lies BEFORE the earlier worker went down (as measured with the generated
    // microphones, which deliver their first samples in a burst): it is stated as the worker's word and bounds nothing.
    of.fake.last().record({ ...startInterval, capturedAtMs: downAt - 185, fromSample: 480 });
    // Said once per later worker, whatever it repeats.
    of.fake.last().record({ ...startInterval, capturedAtMs: downAt + 9_000, fromSample: 480 });
    await of.settled();
    const entries = appended.mock.calls.map(([entry]) => entry).filter((entry) => entry.code === 'CAPTURE_AUDIO_BEGINS_AFTER_RESTART');
    expect(heardAt - downAt).toBe(900);
    expect(entries.map((entry) => [entry.level, entry.context])).toEqual([
      ['warn', { sessionId: id, attempt: 2, deviceId: 'MIC-01', role: 'PRIMARY', workerDownAt: downAt, microphonesStartedAt: downAt, audioHeardAt: heardAt, audioAbsentAtLeastMs: 0, audioAbsentAtMostMs: 900, workerAudioFromAt: downAt - 185, audioFromMediaMs: 31, intervalRowOf: 1, intervalRowFromAt: firstAt, earlierAudioNotRecordedMs: 400 }],
    ]);
    // Row 191b. The row of the start is written once and never rewritten: it still states the earlier worker's first sample (42 ms, its
    // instant). It is CLOSED where it began, at the instant its worker went down; the later worker's interval is a NEW row (31 ms). Its
    // instant is the worker's word held between the two bounds: 185 ms before the earlier worker went down is not stated by any row.
    expect(await restartIntervals(of, id)).toEqual([
      { seq: 1, mic_device_id: 'MIC-01', role: 'PRIMARY', reason: 'START', from_media_ms: '42', to_media_ms: '42', from_at: String(firstAt), to_at: String(downAt) },
      { seq: 2, mic_device_id: 'MIC-01', role: 'PRIMARY', reason: 'START', from_media_ms: '31', to_media_ms: null, from_at: String(downAt), to_at: null },
    ]);
    // ONE audit row per restart, whatever the later worker repeats: the session, the attempts, both bounds; the microphones by the row's device and its message.
    const gaps = await gapRows(of, id);
    expect(gaps).toEqual([
      { category: 'DEVICE', severity: 'WARNING', actor_id: null, device_id: 'MIC-01', session_id: id, message: expect.stringContaining('attempt 1 to 2; microphones: MIC-01 MIC-01, MIC-02 MIC-02, MIC-03 MIC-03, MIC-04 MIC-04'), details: { sessionId: id, earlierAttempt: 1, laterAttempt: 2, audioAbsentAtLeastMs: 0, audioAbsentAtMostMs: 900 } }, // D61: the selector names channels
    ]);
    await sessionCapture(of.app).shutdown();
  });

  // Row 191b, A SWITCH AFTER THE RESTART: gone with operation 81 (audit row 149; N-29, N-31) - no switch record exists to
  // number after a restart. The numbering of the start intervals across a restart stays covered by the cases around it.

  it('row 191b, THE EARLIER WORKER NEVER REPORTED AUDIO: the later worker\'s interval is row 1, nothing is closed, and the gap row is still written - from the instant the earlier worker went down, with both bounds', async () => {
    const of = await rig('r191b_no_earlier_audio', { limits: FAST_RESTART });
    const id = await of.arm();
    await of.start(id);
    of.fake.last().exit(1);
    await secondRecords(of);
    const downAt = of.supervisor.status().lastCrash?.at ?? Number.NaN;
    await of.drive(300);
    of.fake.last().record({ ...startInterval, capturedAtMs: downAt + 120, fromSample: 480 });
    await of.settled();
    expect(await restartIntervals(of, id)).toEqual([{ seq: 1, mic_device_id: 'MIC-01', role: 'PRIMARY', reason: 'START', from_media_ms: '31', to_media_ms: null, from_at: String(downAt + 120), to_at: null }]);
    expect((await gapRows(of, id)).map((row) => row.details)).toEqual([{ sessionId: id, earlierAttempt: 1, laterAttempt: 2, audioAbsentAtLeastMs: 0, audioAbsentAtMostMs: 300 }]);
    await sessionCapture(of.app).shutdown();
  });
});

/** Row 191b: the interval rows of a session with both instants, as stored. */
const restartIntervals = (of: Rig, id: string) =>
  of.rows<{ seq: number; mic_device_id: string; role: string; reason: string; from_media_ms: string; to_media_ms: string | null; from_at: string; to_at: string | null }>(
    'SELECT seq, mic_device_id, role, reason, from_media_ms, to_media_ms, from_at, to_at FROM public.session_audio_intervals WHERE session_id = $1 ORDER BY seq',
    [id],
  );

/** Row R1b: the audit rows of the cameras that were absent inside a session - the rows the seal reads by `session_id`, in the order of the chain. */
const absenceRows = (of: Rig, id: string) =>
  of.rows<{ category: string; severity: string; actor_id: string | null; device_id: string | null; session_id: string | null; message: string; details: Record<string, unknown> }>(
    "SELECT category, severity, actor_id, device_id, session_id, message, details FROM public.audit_log WHERE type = 'CAPTURE_VIDEO_ABSENT_IN_SESSION' AND session_id = $1 ORDER BY seq",
    [id],
  );

/** Row 191b: the audit rows of the audio gap of a session - the rows the seal's extract reads by `session_id`. */
const gapRows = (of: Rig, id: string) =>
  of.rows<{ category: string; severity: string; actor_id: string | null; device_id: string | null; session_id: string | null; message: string; details: Record<string, unknown> }>(
    "SELECT category, severity, actor_id, device_id, session_id, message, details FROM public.audit_log WHERE type = 'CAPTURE_AUDIO_ABSENT_ON_RESTART' AND session_id = $1 ORDER BY seq",
    [id],
  );
