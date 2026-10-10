// Fix pass F-M3: the findings of code-review row 63 (gateway_check/16_m3_code_review.md) that are the
// supervisor's, each through the PRODUCTION supervisor on a FakeWorkerProcess with manual timers
// (controller ruling D179). Nothing here starts a process, listens on a port or waits in real time.
//
//   R63-01  a stop is CLEAN only when the worker acknowledged it and exited 0 after its final
//           records; a CRASH while closing, a non-zero exit, a kill at the grace are an interrupted
//           recording with the cause recorded - never a quiet `STOPPED`;
//   R63-04  (carried question 7) the version ALLOWLIST holds for EVERY `HELLO`: the first start, a
//           restart inside a session (option C); RECOVERY starts no worker at all;
//   R63-05  (carried question 8) what the schema cannot know the supervisor holds: a telemetry
//           frame names devices of the plan only, a switch interval names a command that waits;
//   R63-07  a worker that refuses to start on another libavformat says so INSTEAD of `HELLO`.
//
// EVERY RULE HAS ITS CONTROL beside it: the clean stop stays clean, the release version is taken,
// the telemetry of the plan's devices is handed on.
import { CAPTURE_IPC_DEFAULTS, CAPTURE_PROTOCOL_VERSION, CaptureIngestState, CaptureMicRole, CaptureStopReason, LIBAVFORMAT_VERSION_MISMATCH, WorkerMessageType, type AudioSourceIntervalRecord, type CaptureIpcLimits } from '@dems/capture-protocol';
import { describe, expect, it } from 'vitest';
import { capturePlan, fakeLauncher, flush, manualCaptureTimers, type FakeWorkerBehaviour } from '../../../test/support/capture';
import { CapturePhase, CaptureSupervisorError, WorkerDownCode, createCaptureSupervisor, type CaptureEvent, type CaptureReport } from '../index';

const SESSION = 'S-TEST-0001';
const LIMITS = CAPTURE_IPC_DEFAULTS;

async function setup(limits: Partial<CaptureIpcLimits> = {}, behaviour: Partial<FakeWorkerBehaviour> = {}) {
  const clock = manualCaptureTimers();
  const fake = fakeLauncher(behaviour);
  const reports: CaptureReport[] = [];
  const supervisor = createCaptureSupervisor({ now: clock.now, timers: clock.timers, launcher: fake.launcher, limits, report: (entry) => reports.push(entry) });
  const events: CaptureEvent[] = [];
  for (const name of ['telemetry', 'progress', 'warning', 'phase', 'workerDown', 'record'] as const) supervisor.on(name, (event) => void events.push(event));
  await supervisor.boot();
  const named = <Name extends CaptureEvent['name']>(name: Name) => events.filter((event): event is Extract<CaptureEvent, { name: Name }> => event.name === name);
  /** The events of the supervisor itself, in the order they were handed out: `down:<code>/<detail>` and `phase:<phase>`. */
  const trail = () => events.flatMap((event) => (event.name === 'workerDown' ? [`down:${event.down.code}/${event.down.detail ?? '-'}`] : event.name === 'phase' ? [`phase:${event.phase}`] : []));
  return { clock, fake, supervisor, events, reports, named, trail };
}

async function recording(limits: Partial<CaptureIpcLimits> = {}, behaviour: Partial<FakeWorkerBehaviour> = {}) {
  const context = await setup(limits, behaviour);
  await context.supervisor.start(SESSION, capturePlan(SESSION));
  return context;
}

async function refusalOf(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof CaptureSupervisorError) return error.detail === null ? error.code : `${error.code}/${error.detail}`;
    throw error;
  }
  return 'RESOLVED';
}

const startInterval: AudioSourceIntervalRecord = { kind: 'AUDIO_SOURCE_INTERVAL', deviceId: 'MIC-01', role: 'PRIMARY', index: 1, fromSample: 0, sampleRateHz: 48_000, capturedAtMs: 1_760_000_000_000, reason: 'SESSION_START', correlationId: null, appliedDelayUs: null };

describe('R63-01: a stop is clean only when the worker acknowledged it and exited 0 after its final records', () => {
  it('CONTROL: the worker acknowledges STOP, writes the end of its audio timeline and exits 0 - the stop is clean, no crash is recorded, no workerDown is said', async () => {
    const { supervisor, fake, named, trail } = await recording();
    const worker = fake.last();
    worker.record(startInterval);
    worker.firstDurableFragment();
    const outcome = await supervisor.stop(SESSION, CaptureStopReason.STOPPED);
    expect(outcome).toEqual({ clean: true, down: null });
    expect(supervisor.status()).toMatchObject({ phase: CapturePhase.IDLE, sessionId: null, lastCrash: null });
    expect(named('workerDown')).toEqual([]);
    // The fake keeps the worker's rule: the record of the timeline end leaves BEFORE the exit.
    expect(named('record').map((event) => event.record.kind)).toEqual(['AUDIO_SOURCE_INTERVAL', 'FIRST_DURABLE_FRAGMENT', 'AUDIO_TIMELINE_END']);
    expect(trail().slice(-2)).toEqual(['phase:STOPPING', 'phase:IDLE']);
  });

  it('the worker says CRASH and exits 70 WHILE IT CLOSES (a failed final sync): the stop is NOT clean - lastCrash and a workerDown name the cause, before the phase goes idle', async () => {
    const { supervisor, fake, named, trail } = await recording({}, { exitOnStop: false });
    const worker = fake.last();
    worker.record(startInterval);
    worker.firstDurableFragment();
    const stopping = supervisor.stop(SESSION, CaptureStopReason.STOPPED);
    await flush();
    worker.ack(true, undefined, worker.commands('STOP')[0]);
    worker.say({ type: WorkerMessageType.CRASH, code: 'WRITER_SYNC_FAILED', signal: null, exitCode: 70 });
    worker.exit(70);
    const outcome = await stopping;
    expect(outcome.clean).toBe(false);
    expect(outcome.down).toMatchObject({ code: WorkerDownCode.EXITED, detail: 'WRITER_SYNC_FAILED', exitCode: 70, signal: null, attempt: 1 });
    expect(supervisor.status()).toMatchObject({ phase: CapturePhase.IDLE, sessionId: null, lastCrash: { code: WorkerDownCode.EXITED, detail: 'WRITER_SYNC_FAILED', exitCode: 70 } });
    // The hand-off of the capture-session unit: ONE workerDown of this session, never restarted, said before the session is idle.
    expect(named('workerDown')).toMatchObject([{ sessionId: SESSION, restartInMs: null, down: { detail: 'WRITER_SYNC_FAILED' } }]);
    expect(trail().slice(-3)).toEqual(['phase:STOPPING', 'down:EXITED/WRITER_SYNC_FAILED', 'phase:IDLE']);
    // No worker is started for a session that is stopping, whatever its last one did.
    expect(fake.calls()).toBe(1);
  });

  it('the worker exits non-zero after the acknowledgement, without a CRASH frame: not clean, the exit code is the cause', async () => {
    const { supervisor, fake, named } = await recording({}, { exitOnStop: false });
    const worker = fake.last();
    worker.firstDurableFragment();
    const stopping = supervisor.stop(SESSION, CaptureStopReason.STOPPED);
    await flush();
    worker.ack(true, undefined, worker.commands('STOP')[0]);
    worker.exit(70);
    const outcome = await stopping;
    expect(outcome).toMatchObject({ clean: false, down: { code: WorkerDownCode.EXITED, exitCode: 70, signal: null } });
    expect(supervisor.status().lastCrash).toMatchObject({ code: WorkerDownCode.EXITED, exitCode: 70 });
    expect(named('workerDown')).toHaveLength(1);
  });

  it('the worker does not exit within the grace and is KILLED: not clean - STOP_TIMEOUT with the signal, whatever was still open is not claimed', async () => {
    const { supervisor, fake, clock, named, trail } = await recording({}, { exitOnStop: false });
    const worker = fake.last();
    worker.firstDurableFragment();
    const stopping = supervisor.stop(SESSION, CaptureStopReason.STOPPED);
    await flush();
    clock.advance(LIMITS.stopGraceMs - 1);
    await flush();
    expect(worker.kills).toEqual([]);
    clock.advance(1);
    const outcome = await stopping;
    expect(worker.kills).toEqual(['SIGKILL']);
    expect(outcome).toMatchObject({ clean: false, down: { code: WorkerDownCode.STOP_TIMEOUT, signal: 'SIGKILL', attempt: 1 } });
    expect(supervisor.status()).toMatchObject({ phase: CapturePhase.IDLE, lastCrash: { code: WorkerDownCode.STOP_TIMEOUT } });
    expect(named('workerDown')).toMatchObject([{ sessionId: SESSION, restartInMs: null }]);
    expect(trail().slice(-3)).toEqual(['phase:STOPPING', 'down:STOP_TIMEOUT/-', 'phase:IDLE']);
  });

  it('an exit 0 that never acknowledged the STOP, and an exit 0 that left the audio timeline open, are not clean either', async () => {
    const unacknowledged = await recording({}, { exitOnStop: false });
    unacknowledged.fake.last().firstDurableFragment();
    const first = unacknowledged.supervisor.stop(SESSION, CaptureStopReason.STOPPED);
    await flush();
    unacknowledged.fake.last().exit(0);
    expect(await first).toMatchObject({ clean: false, down: { code: WorkerDownCode.EXITED, detail: 'STOP_NOT_ACKNOWLEDGED', exitCode: 0 } });

    // The worker began an audio timeline (its interval of the start) and exits 0 without the record that ends it.
    const open = await recording({}, { timelineEndOnStop: false });
    open.fake.last().record(startInterval);
    open.fake.last().firstDurableFragment();
    expect(await open.supervisor.stop(SESSION, CaptureStopReason.STOPPED)).toMatchObject({ clean: false, down: { code: WorkerDownCode.EXITED, detail: 'TIMELINE_END_MISSING', exitCode: 0 } });
    expect(open.named('workerDown')).toHaveLength(1);
  });

  it('a stop of a session whose worker is already down for good says the cause of THAT; and a worker that never recorded has nothing to interrupt', async () => {
    // FAULTED: the worker died with a durable fragment (option C: not replaced). The stop that follows is not clean and adds no second workerDown.
    const faulted = await recording();
    faulted.fake.last().firstDurableFragment();
    faulted.fake.last().exit(null, 'SIGSEGV');
    await flush();
    expect(faulted.supervisor.status().phase).toBe(CapturePhase.FAULTED);
    expect(await faulted.supervisor.stop(SESSION, CaptureStopReason.CRASH)).toMatchObject({ clean: false, down: { code: WorkerDownCode.EXITED, signal: 'SIGSEGV' } });
    expect(faulted.named('workerDown')).toHaveLength(1);

    // Never shook hands: stopped while starting. Nothing recorded, nothing to interrupt (the start itself is refused as aborted).
    const starting = await setup({}, { hello: false });
    const pending = starting.supervisor.start(SESSION, capturePlan(SESSION));
    await flush();
    const stop = starting.supervisor.stop(SESSION, CaptureStopReason.STOPPED);
    expect(await refusalOf(pending)).toBe('CAPTURE_START_ABORTED');
    expect(await stop).toEqual({ clean: true, down: null });
    expect(starting.named('workerDown')).toEqual([]);

    // No session at all.
    expect(await starting.supervisor.stop(SESSION, CaptureStopReason.STOPPED)).toEqual({ clean: true, down: null });
  });

  it('a crash of ONE session is not the outcome of the next: the clean stop of a later session is clean', async () => {
    const { supervisor, fake } = await recording({}, { exitOnStop: false });
    fake.last().firstDurableFragment();
    const stopping = supervisor.stop(SESSION, CaptureStopReason.STOPPED);
    await flush();
    fake.last().exit(70);
    expect((await stopping).clean).toBe(false);
    fake.behaviour.exitOnStop = true;
    await supervisor.start('S-TEST-0002', capturePlan('S-TEST-0002'));
    expect(await supervisor.stop('S-TEST-0002', CaptureStopReason.STOPPED)).toEqual({ clean: true, down: null });
  });
});

describe('R63-04 / carried question 7: the version allowlist holds for every HELLO, on every start path', () => {
  const hello = (workerVersion: string) => ({ type: WorkerMessageType.HELLO, protocolVersion: CAPTURE_PROTOCOL_VERSION, workerVersion }) as const;

  it('FIRST START: a HELLO of capture-worker/0.4.0+negctl is refused by name, not retried, and is sent nothing', async () => {
    const { supervisor, fake, clock, named } = await setup({}, { hello: false });
    const starting = supervisor.start(SESSION, capturePlan(SESSION));
    await flush();
    fake.last().say(hello('capture-worker/0.4.0+negctl'));
    expect(await refusalOf(starting)).toBe('CAPTURE_FAULT/CAPTURE_WORKER_VERSION_UNKNOWN');
    expect(fake.last().received).toEqual([]);
    expect(named('phase').map((event) => event.phase)).not.toContain(CapturePhase.RECORDING);
    expect(named('record')).toEqual([]);
    expect(supervisor.status()).toMatchObject({ phase: CapturePhase.IDLE, lastCrash: { code: WorkerDownCode.VERSION_UNKNOWN } });
    clock.advance(600_000);
    await flush();
    expect(fake.calls()).toBe(1);
  });

  it.each(['capture-worker/0.4.0-rc1', 'capture-worker/0.4', 'capture-worker/0.4.0.1', 'stub-worker', 'capture-worker/0.4.0/x', 'Capture-Worker/0.4.0'])('every suffix and every other word is refused: %s', async (version) => {
    const { supervisor, fake } = await setup({}, { hello: false });
    const starting = supervisor.start(SESSION, capturePlan(SESSION));
    await flush();
    fake.last().say(hello(version));
    expect(await refusalOf(starting)).toBe('CAPTURE_FAULT/CAPTURE_WORKER_VERSION_UNKNOWN');
    expect(fake.last().received).toEqual([]);
  });

  it('CONTROL: capture-worker/<n>.<n>.<n> exactly is taken, and records', async () => {
    const { supervisor, fake } = await setup({}, { hello: false });
    const starting = supervisor.start(SESSION, capturePlan(SESSION));
    await flush();
    fake.last().say(hello('capture-worker/0.4.0'));
    await starting;
    expect(supervisor.status()).toMatchObject({ phase: CapturePhase.RECORDING, lastCrash: null });
    expect(fake.last().commands('START')).toHaveLength(1);
  });

  it('RESTART INSIDE A SESSION (option C): the worker that replaces a killed one is held to the same rule - refused, no START, no third worker', async () => {
    const { supervisor, fake, clock, named } = await recording();
    // Nothing durable yet: the supervisor replaces the worker. The program was swapped meanwhile.
    fake.behaviour.hello = false;
    fake.last().exit(null, 'SIGKILL');
    await flush();
    clock.advance(LIMITS.backoffBaseMs);
    await flush();
    expect(fake.calls()).toBe(2);
    fake.last().say(hello('capture-worker/0.4.0+negctl'));
    await flush();
    expect(fake.last().received).toEqual([]);
    expect(supervisor.status()).toMatchObject({ phase: CapturePhase.FAULTED, lastCrash: { code: WorkerDownCode.VERSION_UNKNOWN, attempt: 2 } });
    expect(named('workerDown').at(-1)).toMatchObject({ restartInMs: null, down: { code: WorkerDownCode.VERSION_UNKNOWN } });
    clock.advance(600_000);
    await flush();
    expect(fake.calls()).toBe(2);
  });

  it('RECOVERY: booting the supervisor starts no worker at all (there is no start path that could skip the rule)', async () => {
    const { supervisor, fake } = await setup();
    await supervisor.boot();
    await flush();
    expect(fake.calls()).toBe(0);
    expect(supervisor.status()).toMatchObject({ phase: CapturePhase.IDLE, workerPid: null });
  });
});

describe('R63-05 / carried question 8: what a frame names belongs to the session', () => {
  const frame = (over: Record<string, unknown> = {}) =>
    ({
      type: WorkerMessageType.TELEMETRY,
      levels: [{ deviceId: 'MIC-01', role: CaptureMicRole.PRIMARY, dbfs: -20, clipped: false, ratePpm: 0 }],
      ingest: [{ deviceId: 'CAM-01', state: CaptureIngestState.CONNECTED }],
      fragments: [{ deviceId: 'CAM-01', count: 1, bytes: 1_000 }],
      clocks: [{ deviceId: 'CAM-01', lagMs: 21.5, trendPpm: null, nearBound: true }],
      tapActive: false,
      ...over,
    }) as never;

  it('CONTROL: telemetry that names the devices of the plan is handed on', async () => {
    const { supervisor, fake, named } = await recording();
    fake.last().say(frame());
    await flush();
    expect(named('telemetry')).toHaveLength(1);
    expect(supervisor.status()).toMatchObject({ phase: CapturePhase.RECORDING, lastCrash: null });
  });

  it.each([
    ['a clock entry', { clocks: [{ deviceId: 'CAM-09', lagMs: 21.5, trendPpm: null, nearBound: true }] }],
    ['an ingest state', { ingest: [{ deviceId: 'CAM-09', state: CaptureIngestState.CONNECTED }] }],
    ['a fragment counter', { fragments: [{ deviceId: 'VIDEO-01', count: 1, bytes: 1_000 }] }],
    ['a level', { levels: [{ deviceId: 'MIC-09', role: CaptureMicRole.PRIMARY, dbfs: -20, clipped: false, ratePpm: 0 }] }],
    ['a microphone where a camera belongs', { clocks: [{ deviceId: 'MIC-01', lagMs: 21.5, trendPpm: null, nearBound: true }] }],
    ['a camera where a microphone belongs', { levels: [{ deviceId: 'CAM-01', role: CaptureMicRole.PRIMARY, dbfs: -20, clipped: false, ratePpm: 0 }] }],
  ])('%s of a device that is not of the plan ends the worker, and nothing of that frame reaches a listener', async (_what, over) => {
    const { supervisor, fake, named } = await recording();
    fake.last().say(frame(over));
    await flush();
    expect(named('telemetry')).toEqual([]);
    expect(supervisor.status().lastCrash).toMatchObject({ code: WorkerDownCode.PROTOCOL_VIOLATION, detail: 'TELEMETRY_SUBJECT_UNKNOWN' });
    expect(fake.last().kills).toEqual(['SIGKILL']);
  });

  it('an OPERATOR_SWITCH interval whose correlation ID is no waiting command is a switch nobody commanded: the worker is ended and the record is handed to nobody', async () => {
    const { supervisor, fake, named } = await recording({}, { ackSwitch: false });
    const worker = fake.last();
    worker.record(startInterval);
    worker.record({ ...startInterval, deviceId: 'MIC-02', role: 'STANDBY', index: 2, fromSample: 480, reason: 'OPERATOR_SWITCH', correlationId: 'cap:somebody-else:9', appliedDelayUs: 1 });
    await flush();
    expect(named('record').map((event) => event.record.kind)).toEqual(['AUDIO_SOURCE_INTERVAL']);
    expect(supervisor.status().lastCrash).toMatchObject({ code: WorkerDownCode.PROTOCOL_VIOLATION, detail: 'SWITCH_NOT_COMMANDED' });
  });

  it('CONTROL: the interval of a switch that WAS commanded is handed on and resolves the command', async () => {
    const { supervisor, fake, named } = await recording({}, { ackSwitch: false });
    const worker = fake.last();
    worker.record(startInterval);
    const switching = supervisor.switchAudioSource(SESSION, CaptureMicRole.STANDBY);
    await flush();
    const command = worker.commands('SWITCH_AUDIO_SOURCE')[0];
    const written: AudioSourceIntervalRecord = { ...startInterval, deviceId: 'MIC-02', role: 'STANDBY', index: 2, fromSample: 480, reason: 'OPERATOR_SWITCH', correlationId: command?.correlationId ?? null, appliedDelayUs: 1 };
    worker.record(written);
    worker.ack(true, undefined, command);
    await expect(switching).resolves.toEqual(written);
    expect(named('record')).toHaveLength(2);
    expect(supervisor.status().lastCrash).toBeNull();
  });
});

describe('R63-07: a worker that refuses to start on another libavformat', () => {
  it('says CRASH LIBAVFORMAT_VERSION_MISMATCH instead of HELLO: the start is refused with that name and is not retried', async () => {
    const { supervisor, fake, clock } = await setup({}, { hello: false });
    const starting = supervisor.start(SESSION, capturePlan(SESSION));
    await flush();
    fake.last().say({ type: WorkerMessageType.CRASH, code: LIBAVFORMAT_VERSION_MISMATCH, signal: null, exitCode: 70 });
    fake.last().exit(70);
    expect(await refusalOf(starting)).toBe(`CAPTURE_FAULT/${WorkerDownCode.EXITED}`);
    expect(supervisor.status().lastCrash).toMatchObject({ code: WorkerDownCode.EXITED, detail: LIBAVFORMAT_VERSION_MISMATCH, exitCode: 70 });
    expect(fake.last().received).toEqual([]);
    clock.advance(600_000);
    await flush();
    expect(fake.calls()).toBe(1);
  });

  it('CONTROL: any OTHER frame before HELLO is still a protocol violation', async () => {
    const { supervisor, fake } = await setup({ maxRestarts: 0 }, { hello: false });
    const starting = supervisor.start(SESSION, capturePlan(SESSION));
    await flush();
    fake.last().heartbeat();
    expect(await refusalOf(starting)).toBe(`CAPTURE_FAULT/${WorkerDownCode.PROTOCOL_VIOLATION}`);
    expect(supervisor.status().lastCrash).toMatchObject({ detail: 'HELLO_EXPECTED' });
  });
});
