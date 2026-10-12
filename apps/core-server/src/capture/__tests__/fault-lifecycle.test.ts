// The fault life cycle of the capture side and what protocol 4 added to the supervisor (blueprint
// row 71, Core half; decisions D72(h), D84 R-1 to R-4, D85, D127 (2), D58-7; row 61's request for the
// proof-build mark). In memory: the real supervisor and the real forwarder on a `FakeWorkerProcess`,
// manual timers, an engine that records its calls. Each rule has the case that could fail beside it.
import { CAPTURE_PROTOCOL_VERSION, CaptureMicRole, CaptureWarningCode, CaptureWarningReason, type AudioSourceIntervalRecord, CAPTURE_IPC_DEFAULTS, CaptureStopReason, FINAL_CRASH_CODES, LIBAVFORMAT_VERSION_MISMATCH } from '@dems/capture-protocol';
import { describe, expect, it } from 'vitest';
import { capturePlan, fakeLauncher, flush, manualCaptureTimers, type FakeWorkerBehaviour, type FakeWorkerProcess } from '../../../test/support/capture';
import { CAPTURE_WARNING_CLEAR_HOLD_MS, CAPTURE_WORKER_VERSION, CapturePhase, CaptureNoticeCode, ForwarderReportCode, WorkerDownCode, createCaptureSupervisor, forwardCaptureEvents, type CaptureNotice, type CaptureReport, CAMERA_END_REASONS, CaptureDownReason, SupervisorRefusal, captureDownReasonOf, type CaptureEvent } from '../index';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BOOT_RESOLVED_NOTICE_REASONS, staleCaptureNoticesOf } from '../stale-notices';

const FIRST = 'S-TEST-0001';
const SECOND = 'S-TEST-0002';

async function rig(limits: Record<string, number> = {}, behaviour: Parameters<typeof fakeLauncher>[0] = {}) {
  const clock = manualCaptureTimers();
  const fake = fakeLauncher(behaviour);
  const calls: string[] = [];
  const reports: CaptureReport[] = [];
  const notices: CaptureNotice[] = [];
  const supervisor = createCaptureSupervisor({ now: clock.now, timers: clock.timers, launcher: fake.launcher, limits });
  forwardCaptureEvents({
    capture: supervisor,
    engine: () => ({
      applyCaptureTelemetry: async () => {},
      raiseCaptureWarning: async (warning) => void calls.push(`raise ${warning.code}:${String(warning.subject)}`),
      clearCaptureWarning: async (warning) => void calls.push(`clear ${warning.code}:${String(warning.subject)}`),
      clearCaptureFaults: async () => void calls.push('clear every capture fault'),
    }),
    report: (entry) => void reports.push(entry),
    notice: (entry) => void notices.push(entry),
    now: clock.now,
  });
  await supervisor.boot();
  /** Lets the hold pass and the next telemetry frame apply what stayed cleared. */
  const hold = async (): Promise<void> => {
    // A sign of life first: the hold is longer than half the heartbeat limit.
    fake.last().heartbeat();
    clock.advance(CAPTURE_WARNING_CLEAR_HOLD_MS);
    fake.last().heartbeat();
    fake.last().telemetry(1);
    await flush();
  };
  return { clock, fake, supervisor, calls, reports, notices, hold };
}

describe('D84 R-1 and R-2: one subject form, never nothing', () => {
  it('R-1: a MIC_SILENT that names no microphone never reaches the engine: the supervisor ends the worker that says it (no frame of protocol 4 has no subject)', async () => {
    const { fake, supervisor, calls, reports } = await rig();
    await supervisor.start(FIRST, capturePlan(FIRST));
    await flush();
    calls.length = 0;
    const worker = fake.last();
    worker.say({ type: 'WARNING', code: 'MIC_SILENT', reason: 'MIC_LEVEL_BELOW_THRESHOLD', state: 'ACTIVE', subject: null as unknown as string });
    await flush();
    // The supervisor refuses a subject that is no device of the plan: the worker is ended, nothing reaches the engine.
    expect(calls.filter((call) => call.startsWith('raise MIC_SILENT'))).toEqual([]);
    expect(supervisor.status().lastCrash).toMatchObject({ code: WorkerDownCode.PROTOCOL_VIOLATION, detail: 'WARNING_SUBJECT_UNKNOWN' });
    expect(reports.filter((report) => report.code === ForwarderReportCode.WARNING_FAILED)).toEqual([]);
  });

  it('R-2: a mic role is no subject (protocol 4) - the worker that says one is ended; the same mic by its device ID is ONE fault across raise, clear and raise again', async () => {
    const { fake, supervisor, calls, hold } = await rig();
    await supervisor.start(FIRST, capturePlan(FIRST));
    await flush();
    calls.length = 0;
    fake.last().warning(CaptureWarningCode.MIC_SILENT, 'MIC-01');
    await flush();
    fake.last().warning(CaptureWarningCode.MIC_SILENT, 'MIC-01', 'CLEARED');
    await flush();
    await hold();
    fake.last().warning(CaptureWarningCode.MIC_SILENT, 'MIC-01');
    await flush();
    // The second silence IS recorded (the navigator's NAV-ALIAS scenario lost it).
    expect(calls).toEqual(['raise MIC_SILENT:MIC-01', 'clear MIC_SILENT:MIC-01', 'raise MIC_SILENT:MIC-01']);
    // CONTROL: the role word ends the worker instead of opening a second entry for the same microphone.
    fake.last().warning(CaptureWarningCode.MIC_SILENT, 'PRIMARY');
    await flush();
    expect(supervisor.status().lastCrash).toMatchObject({ detail: 'WARNING_SUBJECT_UNKNOWN' });
    expect(calls.filter((call) => call.includes('PRIMARY'))).toEqual([]);
  });
});

describe('D84 R-3: two sessions that fail in a row are two faults', () => {
  it('each failed session raises its own CAPTURE_FAULT: the held one is cleared, then the new one is raised (two FAULT_RAISED rows)', async () => {
    const { fake, supervisor, calls } = await rig({ maxRestarts: 0 });
    fake.failNext(1, false);
    await expect(supervisor.start(FIRST, capturePlan(FIRST))).rejects.toMatchObject({ code: 'CAPTURE_FAULT' });
    await flush();
    fake.failNext(1, false);
    await expect(supervisor.start(SECOND, capturePlan(SECOND))).rejects.toMatchObject({ code: 'CAPTURE_FAULT' });
    await flush();
    expect(calls).toEqual(['raise CAPTURE_FAULT:null', 'clear CAPTURE_FAULT:null', 'raise CAPTURE_FAULT:null']);
  });

  it('CONTROL: the SAME session saying its fault again writes nothing (one occurrence, one row)', async () => {
    const { fake, supervisor, calls } = await rig();
    await supervisor.start(FIRST, capturePlan(FIRST));
    await flush();
    calls.length = 0;
    fake.last().warning(CaptureWarningCode.CAPTURE_FAULT, 'CAM-02');
    fake.last().heartbeat();
    await flush();
    fake.last().warning(CaptureWarningCode.CAPTURE_FAULT, 'CAM-02');
    await flush();
    expect(calls).toEqual(['raise CAPTURE_FAULT:CAM-02']);
  });
});

describe('D84 R-4: a capture fault this forwarder did not raise is cleared when a session records', () => {
  it('the first RECORDING of every session clears EVERY capture fault of the engine, once; a restart inside the session does not', async () => {
    const { fake, supervisor, calls } = await rig();
    await supervisor.start(FIRST, capturePlan(FIRST));
    await flush();
    expect(calls).toEqual(['clear every capture fault']);
    // A worker that goes down before anything is durable is replaced: RECORDING again, the same session.
    fake.last().exit(1);
    await flush();
    expect(supervisor.status().phase).toBe(CapturePhase.RESTARTING);
    await supervisor.stop(FIRST, 'STOPPED');
    await supervisor.start(SECOND, capturePlan(SECOND));
    await flush();
    expect(calls.filter((call) => call === 'clear every capture fault')).toHaveLength(2);
  });
});

describe('protocol 4: a fault per cause, advisory reasons, notices', () => {
  it('ruling D146 (migration 0013): two causes on one camera are TWO faults of the engine - each raised when it begins and cleared, after the hold, when IT ended', async () => {
    const { fake, supervisor, calls, hold } = await rig();
    await supervisor.start(FIRST, capturePlan(FIRST));
    await flush();
    calls.length = 0;
    const worker = fake.last();
    worker.warning(CaptureWarningCode.CAPTURE_FAULT, 'CAM-02', 'ACTIVE', CaptureWarningReason.CAMERA_STREAM_ENDED);
    await flush();
    worker.warning(CaptureWarningCode.CAPTURE_FAULT, 'CAM-02', 'ACTIVE', CaptureWarningReason.CAMERA_CLOCK_OUT_OF_BOUND);
    await flush();
    expect(calls).toEqual(['raise CAPTURE_FAULT:CAM-02', 'raise CAPTURE_FAULT:CAM-02']);
    worker.warning(CaptureWarningCode.CAPTURE_FAULT, 'CAM-02', 'CLEARED', CaptureWarningReason.CAMERA_STREAM_ENDED);
    await flush();
    await hold();
    // One cause ended: ONE clear. The other cause is another fault and stays raised.
    expect(calls).toEqual(['raise CAPTURE_FAULT:CAM-02', 'raise CAPTURE_FAULT:CAM-02', 'clear CAPTURE_FAULT:CAM-02']);
    worker.warning(CaptureWarningCode.CAPTURE_FAULT, 'CAM-02', 'CLEARED', CaptureWarningReason.CAMERA_CLOCK_OUT_OF_BOUND);
    await flush();
    await hold();
    expect(calls).toEqual(['raise CAPTURE_FAULT:CAM-02', 'raise CAPTURE_FAULT:CAM-02', 'clear CAPTURE_FAULT:CAM-02', 'clear CAPTURE_FAULT:CAM-02']);
  });

  it('a microphone that is disconnected AND at its rate limit: the fault of the first and the advice of the second (pass D9) are raised and ended each on its own', async () => {
    const { fake, supervisor, calls, hold } = await rig();
    await supervisor.start(FIRST, capturePlan(FIRST));
    await flush();
    calls.length = 0;
    const worker = fake.last();
    worker.warning(CaptureWarningCode.CAPTURE_FAULT, 'MIC-02', 'ACTIVE', CaptureWarningReason.MIC_DISCONNECTED);
    await flush();
    worker.warning(CaptureWarningCode.CAPTURE_FAULT, 'MIC-02', 'ACTIVE', CaptureWarningReason.MIC_RATE_AT_LIMIT);
    await flush();
    expect(calls).toEqual(['raise CAPTURE_FAULT:MIC-02', 'raise MIC_RATE_AT_LIMIT:MIC-02']);
    worker.warning(CaptureWarningCode.CAPTURE_FAULT, 'MIC-02', 'CLEARED', CaptureWarningReason.MIC_DISCONNECTED);
    await flush();
    await hold();
    expect(calls).toEqual(['raise CAPTURE_FAULT:MIC-02', 'raise MIC_RATE_AT_LIMIT:MIC-02', 'clear CAPTURE_FAULT:MIC-02']);
    worker.warning(CaptureWarningCode.CAPTURE_FAULT, 'MIC-02', 'CLEARED', CaptureWarningReason.MIC_RATE_AT_LIMIT);
    await flush();
    expect(calls).toEqual(['raise CAPTURE_FAULT:MIC-02', 'raise MIC_RATE_AT_LIMIT:MIC-02', 'clear CAPTURE_FAULT:MIC-02', 'clear MIC_RATE_AT_LIMIT:MIC-02']);
  });

  it('D127 (2): KEYFRAME_INTERVAL_ABOVE_BOUND raises NO fault - the camera is not faulted; the record gives the operator the number; a real loss of that camera IS a fault', async () => {
    const { fake, supervisor, calls, notices } = await rig();
    await supervisor.start(FIRST, capturePlan(FIRST));
    await flush();
    calls.length = 0;
    const worker = fake.last();
    worker.warning(CaptureWarningCode.CAPTURE_FAULT, 'CAM-02', 'ACTIVE', CaptureWarningReason.KEYFRAME_INTERVAL_ABOVE_BOUND);
    worker.record({ kind: 'KEYFRAME_INTERVAL', deviceId: 'CAM-02', observedMs: 5_000, boundMs: 2_000, intervals: 1, complete: true, aboveBound: true });
    await flush();
    // Fix pass F-M5 (R63-03, D179): NO FAULT, as before - and the operator is told by the named advisory alert of the camera (it was `[]`: the log alone).
    expect(calls).toEqual(['raise KEYFRAME_INTERVAL_ABOVE_BOUND:CAM-02']);
    calls.length = 0;
    expect(notices).toEqual([{ code: CaptureNoticeCode.KEYFRAME_INTERVAL_ABOVE_BOUND, sessionId: FIRST, correlationId: `cap:${FIRST}:1`, deviceId: 'CAM-02', value: 5_000, bound: 2_000 }]);
    // CONTROL: the same camera with a reason that is no advisory one.
    worker.warning(CaptureWarningCode.CAPTURE_FAULT, 'CAM-02', 'ACTIVE', CaptureWarningReason.CAMERA_STREAM_ENDED);
    await flush();
    expect(calls).toEqual(['raise CAPTURE_FAULT:CAM-02']);
  });

  it('a keyframe interval inside the bound is no notice', async () => {
    const { fake, supervisor, notices } = await rig();
    await supervisor.start(FIRST, capturePlan(FIRST));
    fake.last().record({ kind: 'KEYFRAME_INTERVAL', deviceId: 'CAM-01', observedMs: 2_000, boundMs: 2_000, intervals: 3, complete: true, aboveBound: false });
    await flush();
    expect(notices).toEqual([]);
  });

  it('D58-7 and D85: nearBound and a rate at +-5,000 ppm are said ONCE per episode, with the device and the number, and again after they ended', async () => {
    const { fake, supervisor, notices } = await rig();
    await supervisor.start(FIRST, capturePlan(FIRST));
    const frame = (nearBound: boolean, ratePpm: number): void =>
      fake.last().say({
        type: 'TELEMETRY',
        levels: [{ deviceId: 'MIC-01', role: CaptureMicRole.PRIMARY, dbfs: -20, clipped: false, ratePpm }],
        ingest: [],
        fragments: [],
        clocks: [{ deviceId: 'CAM-01', lagMs: 31.5, trendPpm: null, nearBound }],
        tapActive: false,
      });
    for (const [near, rate] of [[false, 120], [true, 5_000], [true, 5_000], [false, 4_999], [true, -5_000]] as const) {
      frame(near, rate);
      await flush();
    }
    expect(notices.map((entry) => `${entry.code} ${entry.deviceId} ${entry.value}`)).toEqual([
      'CAPTURE_CLOCK_NEAR_BOUND CAM-01 31.5',
      'CAPTURE_MIC_RATE_AT_LIMIT MIC-01 5000',
      'CAPTURE_CLOCK_NEAR_BOUND CAM-01 31.5',
      'CAPTURE_MIC_RATE_AT_LIMIT MIC-01 -5000',
    ]);
  });
});

describe('protocol 4 in the supervisor: whose device a record names, and the record of a switch', () => {
  const interval = (patch: Partial<AudioSourceIntervalRecord>): AudioSourceIntervalRecord => ({
    kind: 'AUDIO_SOURCE_INTERVAL',
    deviceId: 'MIC-01',
    role: 'PRIMARY',
    index: 1,
    fromSample: 0,
    sampleRateHz: 48_000,
    capturedAtMs: 1_760_000_000_000,
    reason: 'SESSION_START',
    correlationId: null,
    appliedDelayUs: null,
    ...patch,
  });

  it('an interval record names a MICROPHONE of the plan and a timeline end names nothing: both are handed on (the first record of every version-4 session)', async () => {
    const { fake, supervisor } = await rig();
    const seen: string[] = [];
    supervisor.on('record', (event) => void seen.push(event.record.kind));
    await supervisor.start(FIRST, capturePlan(FIRST));
    fake.last().record(interval({}));
    fake.last().record({ kind: 'AUDIO_TIMELINE_END', samples: 96_000, sampleRateHz: 48_000, intervals: 1 });
    await flush();
    expect(seen).toEqual(['AUDIO_SOURCE_INTERVAL', 'AUDIO_TIMELINE_END']);
    expect(supervisor.status().lastCrash).toBeNull();
  });

  it('CONTROL: an interval that names a camera, and a fragment that names a microphone, end the worker', async () => {
    for (const record of [interval({ deviceId: 'CAM-01' }), { kind: 'FIRST_DURABLE_FRAGMENT', deviceId: 'MIC-01', bytes: 1 } as const]) {
      const { fake, supervisor } = await rig();
      await supervisor.start(FIRST, capturePlan(FIRST));
      fake.last().record(record);
      await flush();
      expect(supervisor.status().lastCrash, record.kind).toMatchObject({ code: WorkerDownCode.PROTOCOL_VIOLATION, detail: 'RECORD_SUBJECT_UNKNOWN' });
    }
  });

  it('switchAudioSource resolves with the interval record the worker wrote for THAT command; a switch that changed nothing resolves null', async () => {
    const { fake, supervisor } = await rig({}, { ackSwitch: false });
    await supervisor.start(FIRST, capturePlan(FIRST));
    const worker = fake.last();
    const switching = supervisor.switchAudioSource(FIRST, CaptureMicRole.STANDBY);
    await flush();
    const command = worker.commands('SWITCH_AUDIO_SOURCE')[0];
    expect(command).toMatchObject({ v: CAPTURE_PROTOCOL_VERSION, to: 'STANDBY' });
    // The worker writes the record BEFORE the acknowledgement.
    const written = interval({ deviceId: 'MIC-02', role: 'STANDBY', index: 2, fromSample: 96_000, reason: 'OPERATOR_SWITCH', correlationId: command?.correlationId ?? null, appliedDelayUs: 9_800 });
    worker.record(written);
    worker.ack(true, undefined, command);
    await expect(switching).resolves.toEqual(written);

    // The role that already feeds the track: acknowledged, no record.
    const again = supervisor.switchAudioSource(FIRST, CaptureMicRole.STANDBY);
    await flush();
    worker.ack(true, undefined, worker.commands('SWITCH_AUDIO_SOURCE')[1]);
    await expect(again).resolves.toBeNull();
  });

  it('a record of ANOTHER command is not handed to this switch: a switch nobody commanded ends the worker (review R63-05)', async () => {
    const { fake, supervisor } = await rig({}, { ackSwitch: false });
    await supervisor.start(FIRST, capturePlan(FIRST));
    const worker = fake.last();
    const switching = supervisor.switchAudioSource(FIRST, CaptureMicRole.STANDBY);
    await flush();
    worker.record(interval({ deviceId: 'MIC-02', role: 'STANDBY', index: 2, fromSample: 480, reason: 'OPERATOR_SWITCH', correlationId: 'cap:somebody-else:9', appliedDelayUs: 1 }));
    // Never resolved with that record: the command is refused because its worker went down for the violation.
    await expect(switching).rejects.toMatchObject({ code: 'CAPTURE_WORKER_DOWN' });
    expect(supervisor.status().lastCrash).toMatchObject({ code: 'PROTOCOL_VIOLATION', detail: 'SWITCH_NOT_COMMANDED' });
  });
});

describe('a proof build of the worker is never recorded with (row 61, pair-58 F-10)', () => {
  it('a HELLO whose version carries the proof mark ends the worker, is not retried, and the start is refused with CAPTURE_WORKER_PROOF_BUILD', async () => {
    const { fake, supervisor, clock } = await rig({}, { hello: false });
    const starting = supervisor.start(FIRST, capturePlan(FIRST));
    await flush();
    fake.last().say({ type: 'HELLO', protocolVersion: CAPTURE_PROTOCOL_VERSION, workerVersion: 'capture-worker/0.4.0-proof' });
    await expect(starting).rejects.toMatchObject({ code: 'CAPTURE_FAULT', detail: 'CAPTURE_WORKER_PROOF_BUILD' });
    expect(fake.last().received).toEqual([]);
    clock.advance(600_000);
    await flush();
    expect(fake.calls()).toBe(1);
    expect(supervisor.status()).toMatchObject({ phase: CapturePhase.IDLE, lastCrash: { code: WorkerDownCode.PROOF_BUILD } });
  });

  it('CONTROL: the same HELLO with a release version starts the session', async () => {
    const { fake, supervisor } = await rig({}, { hello: false });
    const starting = supervisor.start(FIRST, capturePlan(FIRST));
    await flush();
    // Pin by delta (wave H driver F, gate 64 C7): the release word of THIS tree - another release word is refused as a mismatch.
    fake.last().say({ type: 'HELLO', protocolVersion: CAPTURE_PROTOCOL_VERSION, workerVersion: CAPTURE_WORKER_VERSION });
    await expect(starting).resolves.toBeUndefined();
    expect(supervisor.status().phase).toBe(CapturePhase.RECORDING);
  });
});

describe('gates 64 / 75 / 89 (D194, D199, D200): the worker version, the reason of every worker end, a camera given up (wave H, driver F)', () => {
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
      const newer = await rig({ workerVersion: 'capture-worker/0.7.0' });
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
      // Task 4 row 182: +3, the causes the worker names of a camera that never delivered (until then all `CAMERA_NOT_CONNECTED`).
      expect([...CAMERA_END_REASONS].sort()).toEqual(['CAMERA_ANNOUNCE_NOT_MATCHED', 'CAMERA_ANNOUNCE_NOT_SEEN', 'CAMERA_CLOCK_OUT_OF_BOUND', 'CAMERA_NOT_CONNECTED', 'CAMERA_NO_PICTURE', 'CAMERA_STREAM_ENDED']);
    });
  });

  describe('item 2: which notices a boot resolves (the selection; the restart itself is the database test of the boot clear)', () => {
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
});
