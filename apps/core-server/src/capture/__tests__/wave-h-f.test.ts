// Wave H, driver F (gates 64 / 75 / 89; rulings D194, D199, D200).
//
//   item 1  gate 64 C7: every HELLO must name THE version this Core was built to drive - a release
//           word of another version (`capture-worker/0.4.0`) is refused by name, not retried;
//   item 3  gate 64 C4 / F-Y decision 6 / G75-05: every end of a session's worker has ONE reason of
//           a closed enumeration, on `WorkerDown`, on the supervisor's own fault and on what the
//           forwarder raises in the engine;
//   item 4  gate 89 C3: a camera the worker gives up while the session goes on is kept per camera
//           (which, why, when) in `status()` and in the outcome of the stop.
//
// The supervisor and the forwarder are the production ones; the worker is the fake. No process, no
// device, no port, no file of evidence.
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CAPTURE_IPC_DEFAULTS, CAPTURE_PROTOCOL_VERSION, CaptureStopReason, CaptureWarningReason, FINAL_CRASH_CODES, LIBAVFORMAT_VERSION_MISMATCH } from '@dems/capture-protocol';
import { describe, expect, it } from 'vitest';
import { capturePlan, fakeLauncher, flush, manualCaptureTimers, type FakeWorkerBehaviour, type FakeWorkerProcess } from '../../../test/support/capture';
import { CAPTURE_WORKER_VERSION } from '../boot';
import { BOOT_RESOLVED_NOTICE_REASONS, staleCaptureNoticesOf } from '../stale-notices';
import { CAMERA_END_REASONS, CaptureDownReason, CapturePhase, SupervisorRefusal, WorkerDownCode, captureDownReasonOf, createCaptureSupervisor, forwardCaptureEvents, type CaptureEvent } from '../index';

const SESSION = 'S-TEST-0001';
const HERE = dirname(fileURLToPath(import.meta.url));
const SUPERVISOR_SOURCE = readFileSync(resolve(HERE, '../supervisor.ts'), 'utf8');
const WORKER_HEADER = readFileSync(resolve(HERE, '../../../../capture-worker/src/worker.h'), 'utf8');
const SHA = (digit: string): string => digit.repeat(64);

async function rig(behaviour: Partial<FakeWorkerBehaviour> = {}) {
  const clock = manualCaptureTimers();
  const fake = fakeLauncher(behaviour);
  const raised: Array<Record<string, unknown>> = [];
  const events: CaptureEvent[] = [];
  const supervisor = createCaptureSupervisor({ now: clock.now, timers: clock.timers, launcher: fake.launcher, limits: {} });
  for (const name of ['workerDown', 'phase', 'record', 'warning'] as const) supervisor.on(name, (event) => void events.push(event));
  forwardCaptureEvents({
    capture: supervisor,
    engine: () => ({
      applyCaptureTelemetry: async () => {},
      raiseCaptureWarning: async (warning) => void raised.push({ ...warning }),
      clearCaptureWarning: async () => {},
      clearCaptureFaults: async () => {},
    }),
    report: () => {},
    now: clock.now,
  });
  await supervisor.boot();
  /** A session that holds a durable fragment: its worker is not restarted (option C), so its end is final. */
  const recording = async (): Promise<FakeWorkerProcess> => {
    await supervisor.start(SESSION, capturePlan(SESSION));
    const worker = fake.last();
    worker.firstDurableFragment('CAM-01');
    await flush();
    raised.length = 0;
    return worker;
  };
  const faults = (): Array<Record<string, unknown>> => raised.filter((warning) => warning['code'] === 'CAPTURE_FAULT' && warning['subject'] === null);
  const ownFaults = (): Array<Extract<CaptureEvent, { name: 'warning' }>> => events.filter((event): event is Extract<CaptureEvent, { name: 'warning' }> => event.name === 'warning' && event.source === 'supervisor' && event.state === 'ACTIVE');
  return { supervisor, fake, clock, raised, events, recording, faults, ownFaults };
}

const checkpoint = (deviceId: string, index: number, mediaStartMs: number, mediaDurationMs: number) =>
  ({
    kind: 'FRAGMENT_CHECKPOINT',
    deviceId,
    index,
    start: 1_000 * index,
    len: 900,
    fragSha256: SHA('a'),
    chainSha256: SHA('b'),
    prefixSha256: SHA('c'),
    plaintextSha256: SHA('a'),
    plaintextChainSha256: SHA('b'),
    mediaStartMs,
    mediaDurationMs,
    keyframe: true,
    durableAt: 1_760_000_000_500,
    gcmIv: null,
    gcmTag: null,
    keyId: null,
  }) as const;

describe('item 1 (gate 64 C7): a HELLO must name the version this Core was built to drive', () => {
  it('the constant IS the word of the worker of this tree (worker.h)', () => {
    expect(/^#define WORKER_VERSION +"([^"]+)"/m.exec(WORKER_HEADER)?.[1]).toBe(CAPTURE_WORKER_VERSION);
  });

  it('a scripted worker that answers capture-worker/0.4.0 is refused by name (expected / found), is sent nothing and is not started again', async () => {
    const h = await rig({ hello: false });
    const starting = h.supervisor.start(SESSION, capturePlan(SESSION));
    await flush();
    h.fake.last().say({ type: 'HELLO', protocolVersion: CAPTURE_PROTOCOL_VERSION, workerVersion: 'capture-worker/0.4.0' });
    await expect(starting).rejects.toMatchObject({ code: 'CAPTURE_FAULT', detail: 'CAPTURE_WORKER_VERSION_MISMATCH' });
    expect(h.fake.last().received).toEqual([]);
    h.clock.advance(600_000);
    await flush();
    expect(h.fake.calls()).toBe(1);
    // Found: the word the worker named. Expected: the constant (the boot refusal prints both).
    expect(h.supervisor.status()).toMatchObject({ phase: CapturePhase.IDLE, lastCrash: { code: WorkerDownCode.VERSION_MISMATCH, detail: 'capture-worker/0.4.0', reason: CaptureDownReason.WORKER_VERSION_MISMATCH } });
    expect(h.faults()).toEqual([{ code: 'CAPTURE_FAULT', subject: null, reason: 'WORKER_VERSION_MISMATCH' }]);
  });

  it('a NEWER release word is refused the same way; CONTROL: the built version records', async () => {
    const newer = await rig({ workerVersion: 'capture-worker/0.6.0' });
    await expect(newer.supervisor.start(SESSION, capturePlan(SESSION))).rejects.toMatchObject({ detail: 'CAPTURE_WORKER_VERSION_MISMATCH' });
    const built = await rig({ workerVersion: CAPTURE_WORKER_VERSION });
    await built.supervisor.start(SESSION, capturePlan(SESSION));
    expect(built.supervisor.status()).toMatchObject({ phase: CapturePhase.RECORDING, lastCrash: null });
  });

  it('the fake worker of the test support states the built version by default', async () => {
    expect((await rig()).fake.behaviour.workerVersion).toBe(CAPTURE_WORKER_VERSION);
  });
});

describe('item 3: every end of a recording worker has one reason of the closed enumeration, and the fault carries it', () => {
  type Scenario = readonly [name: string, act: (worker: FakeWorkerProcess, h: Awaited<ReturnType<typeof rig>>) => void, reason: CaptureDownReason];
  const scenarios: readonly Scenario[] = [
    ['a warning about a device outside the plan', (worker) => worker.warning('CAPTURE_FAULT', 'CAM-09'), 'WARNING_SUBJECT_UNKNOWN'],
    ['a frame of another session', (worker) => worker.say({ type: 'PROGRESS', step: 'X', progress: 1, etaMs: null }, 'S-OTHER-0002'), 'SESSION_MISMATCH'],
    ['a second HELLO', (worker) => worker.hello(), 'HELLO_TWICE'],
    ['a record for a device outside the plan', (worker) => worker.firstDurableFragment('CAM-09'), 'RECORD_SUBJECT_UNKNOWN'],
    ['a record out of sequence', (worker) => worker.record({ kind: 'FIRST_DURABLE_FRAGMENT', deviceId: 'CAM-02', bytes: 1 }, 9), 'RECORD_SEQUENCE_GAP'],
    ['a once-only record said twice', (worker) => worker.firstDurableFragment('CAM-01'), 'RECORD_REPEATED'],
    ['a line that is no frame', (worker) => worker.violate('FRAME_NOT_JSON'), 'WORKER_FRAME_INVALID'],
    ['the worker says CRASH with a code of its own', (worker) => worker.crash('VIDEO_MUX_WRITE_FAILED'), 'WORKER_CRASHED'],
    ['the process ends with a code other than 0 and says nothing', (worker) => worker.exit(70), 'WORKER_EXIT_NONZERO'],
    ['the process is killed (G75-05: the real worker-crash alert)', (worker) => worker.exit(null, 'SIGKILL'), 'WORKER_KILLED'],
    ['the process ends with code 0 while the session records', (worker) => worker.exit(0), 'WORKER_EXIT_UNEXPECTED'],
    ['no heartbeat within the limit', (_worker, h) => h.clock.advance(CAPTURE_IPC_DEFAULTS.heartbeatTimeoutMs + 1), 'WORKER_HEARTBEAT_TIMEOUT'],
  ];

  it.each(scenarios)('%s: workerDown, the supervisor\'s fault and the engine\'s fault all say %s', async (_name, act, reason) => {
    const h = await rig();
    const worker = await h.recording();
    act(worker, h);
    await flush();
    expect(h.supervisor.status()).toMatchObject({ phase: CapturePhase.FAULTED, lastCrash: { reason } });
    expect(h.ownFaults().map((event) => event.cause)).toEqual([reason]);
    // The protocol's own member stays null: `cause` is no reason of a WARNING frame.
    expect(h.ownFaults()[0]?.reason).toBeNull();
    expect(h.faults()).toEqual([{ code: 'CAPTURE_FAULT', subject: null, reason }]);
  });

  it('a record after the seal completion, and a flood of records, are named too', async () => {
    const sealed = await rig();
    const first = await sealed.recording();
    first.record({ kind: 'SEAL_COMPLETE' });
    first.firstDurableFragment('CAM-02');
    await flush();
    expect(sealed.faults()).toEqual([{ code: 'CAPTURE_FAULT', subject: null, reason: 'RECORD_AFTER_SEAL' }]);

    const flood = await rig();
    const second = await flood.recording();
    for (let index = 0; index <= CAPTURE_IPC_DEFAULTS.recordBurstLimit; index += 1) second.record({ kind: 'AUDIO_TIMELINE_END', samples: 48_000, sampleRateHz: 48_000, intervals: 1 });
    await flush();
    expect(flood.faults()).toEqual([{ code: 'CAPTURE_FAULT', subject: null, reason: 'RECORD_RATE_EXCEEDED' }]);
    expect(captureDownReasonOf({ code: WorkerDownCode.PROTOCOL_VIOLATION, detail: SupervisorRefusal.RECORD_RATE_EXCEEDED, exitCode: null, signal: null })).toBe('RECORD_RATE_EXCEEDED');
  });

  it('a failed start says why as well: no worker program, a start the worker refuses, a file already there, the media library', async () => {
    const refused = await rig({ ackStart: 'PLAN_UNSUPPORTED' });
    await expect(refused.supervisor.start(SESSION, capturePlan(SESSION))).rejects.toMatchObject({ code: 'CAPTURE_FAULT' });
    expect(refused.faults().at(-1)).toEqual({ code: 'CAPTURE_FAULT', subject: null, reason: 'WORKER_START_REFUSED' });

    const exists = await rig({ ackStart: 'OUTPUT_EXISTS' });
    await expect(exists.supervisor.start(SESSION, capturePlan(SESSION))).rejects.toMatchObject({ code: 'CAPTURE_FAULT' });
    expect(exists.faults()).toEqual([{ code: 'CAPTURE_FAULT', subject: null, reason: 'WORKER_OUTPUT_EXISTS' }]);

    const library = await rig({ libavformatMismatch: true });
    await expect(library.supervisor.start(SESSION, capturePlan(SESSION))).rejects.toMatchObject({ code: 'CAPTURE_FAULT' });
    expect(library.supervisor.status().lastCrash).toMatchObject({ detail: LIBAVFORMAT_VERSION_MISMATCH, reason: 'WORKER_MEDIA_LIBRARY_MISMATCH' });
    expect(library.faults()).toEqual([{ code: 'CAPTURE_FAULT', subject: null, reason: 'WORKER_MEDIA_LIBRARY_MISMATCH' }]);
  });

  it('CONTROL: the failed start of the protocol\'s final code keeps its two keys (reason NO_CAMERA_CONNECTED, evidenceFiles 0)', async () => {
    const h = await rig();
    await h.supervisor.start(SESSION, capturePlan(SESSION));
    h.raised.length = 0;
    h.fake.last().crash('NO_CAMERA_CONNECTED');
    await flush();
    expect(h.supervisor.status().lastCrash).toMatchObject({ reason: 'NO_CAMERA_CONNECTED' });
    expect(h.faults()).toEqual([{ code: 'CAPTURE_FAULT', subject: null, reason: 'NO_CAMERA_CONNECTED', evidenceFiles: 0 }]);
  });

  it('a stop that is not clean hands its cause over as a reason: the kill at the grace is STOP_TIMEOUT', async () => {
    const h = await rig({ exitOnStop: false });
    await h.recording();
    const stopping = h.supervisor.stop(SESSION, CaptureStopReason.STOPPED);
    await flush();
    h.clock.advance(CAPTURE_IPC_DEFAULTS.stopGraceMs + 1);
    await flush();
    const outcome = await stopping;
    expect(outcome).toMatchObject({ clean: false, down: { code: 'STOP_TIMEOUT', reason: 'STOP_TIMEOUT' } });
    // The session was ending: no fault is raised for it (the capture-session unit hands it over as interrupted).
    expect(h.faults()).toEqual([]);

    const silent = await rig({ exitOnStop: false });
    const worker = await silent.recording();
    const leaving = silent.supervisor.stop(SESSION, CaptureStopReason.STOPPED);
    await flush();
    worker.exit(0);
    expect(await leaving).toMatchObject({ clean: false, down: { reason: 'WORKER_STOP_NOT_ACKNOWLEDGED' } });
  });

  it('the enumeration is closed: every code the supervisor can end a worker with maps into it, and the source writes no other literal', () => {
    const members = new Set<string>(Object.values(CaptureDownReason));
    for (const code of Object.values(WorkerDownCode)) {
      for (const detail of [null, 'ANY_CODE_OF_THE_WORKER', ...Object.values(SupervisorRefusal), ...FINAL_CRASH_CODES, LIBAVFORMAT_VERSION_MISMATCH, 'OUTPUT_EXISTS', 'STOP_NOT_ACKNOWLEDGED', 'TIMELINE_END_MISSING']) {
        for (const exit of [{ exitCode: null, signal: null }, { exitCode: 0, signal: null }, { exitCode: 70, signal: null }, { exitCode: null, signal: 'SIGKILL' }]) {
          expect(members.has(captureDownReasonOf({ code, detail, ...exit })), `${code} / ${detail}`).toBe(true);
        }
      }
    }
    // Every refusal the supervisor decides is a member of `SupervisorRefusal`, and so of the enumeration ...
    for (const refusal of Object.values(SupervisorRefusal)) expect(members.has(refusal)).toBe(true);
    for (const code of FINAL_CRASH_CODES) expect(members.has(code), `final crash code ${code} needs a member`).toBe(true);
    // ... and `supervisor.ts` names a refusal ONLY through that object: a new `detail: '<LITERAL>'` or `refuse('<LITERAL>')` fails here.
    expect(SUPERVISOR_SOURCE.match(/detail: '[A-Z_]+'/g) ?? []).toEqual([]);
    expect(SUPERVISOR_SOURCE.match(/refuse\('[A-Z_]+'\)/g) ?? []).toEqual([]);
    expect(SUPERVISOR_SOURCE.match(/SupervisorRefusal\.[A-Z_]+/g)?.length ?? 0).toBeGreaterThanOrEqual(Object.keys(SupervisorRefusal).length);
    for (const name of Object.keys(SupervisorRefusal)) expect(SUPERVISOR_SOURCE, name).toContain(`SupervisorRefusal.${name}`);
  });
});

describe('item 4 (gate 89 C3): a camera given up while the session goes on - which, why, when', () => {
  it('the clock floor gives CAM-02 up: status() and the outcome of a CLEAN stop name the camera, the reason and its last durable fragment', async () => {
    const h = await rig();
    const worker = await h.recording();
    expect(h.supervisor.status().cameraEnds).toEqual([]);
    worker.firstDurableFragment('CAM-02');
    worker.record(checkpoint('CAM-02', 1, 0, 2_000));
    worker.record(checkpoint('CAM-02', 2, 2_000, 2_040));
    worker.record(checkpoint('CAM-01', 1, 0, 2_000));
    h.clock.advance(7);
    worker.warning('CAPTURE_FAULT', 'CAM-02', 'ACTIVE', CaptureWarningReason.CAMERA_CLOCK_OUT_OF_BOUND);
    // The fragment that was open when the camera ended is closed AFTER the statement: the fact is a stated lower bound.
    worker.record(checkpoint('CAM-02', 3, 4_040, 300));
    await flush();
    const end = { deviceId: 'CAM-02', reason: 'CAMERA_CLOCK_OUT_OF_BOUND', at: h.clock.now(), lastDurableFragmentIndex: 2, lastDurableMediaEndMs: 4_040 };
    expect(h.supervisor.status()).toMatchObject({ phase: CapturePhase.RECORDING, cameraEnds: [end] });
    // Said once: the same camera is not ended twice.
    worker.warning('CAPTURE_FAULT', 'CAM-02', 'ACTIVE', CaptureWarningReason.CAMERA_STREAM_ENDED);
    await flush();
    expect(h.supervisor.status().cameraEnds).toEqual([end]);
    const outcome = await h.supervisor.stop(SESSION, CaptureStopReason.STOPPED);
    expect(outcome).toEqual({ clean: true, down: null, cameraEnds: [end] });
    // The next session starts with none.
    expect(h.supervisor.status().cameraEnds).toEqual([]);
  });

  it('a camera that never connected has no fragment: both members are null; the interrupted stop carries the ends too', async () => {
    const h = await rig();
    const worker = await h.recording();
    worker.warning('CAPTURE_FAULT', 'CAM-02', 'ACTIVE', CaptureWarningReason.CAMERA_NOT_CONNECTED);
    await flush();
    worker.exit(null, 'SIGKILL');
    await flush();
    expect(h.supervisor.status()).toMatchObject({ phase: CapturePhase.FAULTED, cameraEnds: [{ deviceId: 'CAM-02', reason: 'CAMERA_NOT_CONNECTED', lastDurableFragmentIndex: null, lastDurableMediaEndMs: null }] });
    const outcome = await h.supervisor.stop(SESSION, CaptureStopReason.CRASH);
    expect(outcome).toMatchObject({ clean: false, down: { reason: 'WORKER_KILLED' }, cameraEnds: [{ deviceId: 'CAM-02', reason: 'CAMERA_NOT_CONNECTED' }] });
  });

  it('CONTROL: a microphone condition, an advisory reason and a session where nothing ended name no camera end', async () => {
    const h = await rig();
    const worker = await h.recording();
    worker.warning('CAPTURE_FAULT', 'MIC-01', 'ACTIVE', CaptureWarningReason.MIC_DISCONNECTED);
    worker.warning('MIC_SILENT', 'MIC-02');
    worker.warning('CAPTURE_FAULT', 'CAM-01', 'ACTIVE', CaptureWarningReason.KEYFRAME_INTERVAL_ABOVE_BOUND);
    worker.fragmentSizeBound('CAM-02');
    await flush();
    expect(h.supervisor.status().cameraEnds).toEqual([]);
    expect(await h.supervisor.stop(SESSION, CaptureStopReason.STOPPED)).toEqual({ clean: true, down: null });
    expect([...CAMERA_END_REASONS].sort()).toEqual(['CAMERA_CLOCK_OUT_OF_BOUND', 'CAMERA_NOT_CONNECTED', 'CAMERA_STREAM_ENDED']);
  });
});

describe('item 2: which notices a boot resolves (the selection; the restart itself is wave-h-f-boot-clear.db.test.ts)', () => {
  const alert = (reason: string, target: string | null, over: Record<string, unknown> = {}) => ({ active: true, kind: 'SYSTEM' as const, target, params: { reason }, ...over });

  it('the notices of a RUNNING capture that are still active: every advisory reason on its device, and the volume notice', () => {
    expect([...BOOT_RESOLVED_NOTICE_REASONS].sort()).toEqual(['AV_OFFSET_NEAR_BOUND', 'CAMERA_CLOCK_OFFSET', 'EVIDENCE_VOLUME_SYNC_NOT_FULL', 'FRAGMENT_SIZE_BOUND_REACHED', 'KEYFRAME_INTERVAL_ABOVE_BOUND', 'MIC_RATE_AT_LIMIT']);
    expect(
      staleCaptureNoticesOf([
        alert('AV_OFFSET_NEAR_BOUND', 'CAM-01'),
        alert('KEYFRAME_INTERVAL_ABOVE_BOUND', 'CAM-02'),
        alert('FRAGMENT_SIZE_BOUND_REACHED', 'CAM-02'),
        alert('MIC_RATE_AT_LIMIT', 'MIC-03'),
        alert('CAMERA_CLOCK_OFFSET', 'CAM-01'),
        alert('EVIDENCE_VOLUME_SYNC_NOT_FULL', 'EVIDENCE_VOLUME'),
      ]),
    ).toEqual([
      { code: 'AV_OFFSET_NEAR_BOUND', subject: 'CAM-01' },
      { code: 'KEYFRAME_INTERVAL_ABOVE_BOUND', subject: 'CAM-02' },
      { code: 'FRAGMENT_SIZE_BOUND_REACHED', subject: 'CAM-02' },
      { code: 'MIC_RATE_AT_LIMIT', subject: 'MIC-03' },
      { code: 'CAMERA_CLOCK_OFFSET', subject: 'CAM-01' },
      { code: 'EVIDENCE_VOLUME_SYNC_NOT_FULL', subject: null },
    ]);
  });

  it('CONTROL: a resolved notice, a no-device notice, a fault alert and an alert without a reason are left alone', () => {
    expect(
      staleCaptureNoticesOf([
        alert('AV_OFFSET_NEAR_BOUND', 'CAM-01', { active: false }),
        alert('CAPTURE_DEVICE_UNREACHABLE', 'CAM-02'),
        alert('CAPTURE_DISCOVERY_EMPTY', 'CAPTURE_DISCOVERY'),
        alert('WORKER_KILLED', null, { kind: 'CAMERA_LOSS' }),
        alert('MIC_RATE_AT_LIMIT', null),
        { active: true, kind: 'SYSTEM' as const, target: 'CAM-01' },
      ]),
    ).toEqual([]);
  });
});
