// The capture supervisor on a FakeWorkerProcess, manual timers and a manual clock (blueprint row
// 57 / M3-W1; capture spec §A.3, §B.2; checks M3-KC-3 and M3-KC-1 of masterplan/10_test_strategy).
//
// Nothing here starts a process, listens on a port or waits in real time. The same supervisor on
// a REAL child process is `ipc.test.ts`.
//
// EVERY RULE HAS ITS CONTROL: beside each "it restarts / it refuses / it drops" stands the case
// in which the same measurement must read the opposite (a worker that keeps its heartbeat is NOT
// restarted, a fake that is reused DOES refuse, a listener that keeps up loses NOTHING).
import { CAPTURE_IPC_DEFAULTS, CaptureMicRole, CaptureWarningCode, FrameViolation, SupervisorMessageType, backoffDelayMs, type CaptureIpcLimits, CAPTURE_PROTOCOL_VERSION, CaptureIngestState, CaptureStopReason, LIBAVFORMAT_VERSION_MISMATCH, WorkerMessageType, type AudioSourceIntervalRecord } from '@dems/capture-protocol';
import { describe, expect, it } from 'vitest';
import { capturePlan, fakeLauncher, flush, manualCaptureTimers, type FakeWorkerBehaviour } from '../../../test/support/capture';
import { CapturePhase, CaptureRefusal, CaptureSupervisorError, WorkerDownCode, createCaptureSupervisor, type CaptureEvent, type CaptureReport, CAPTURE_WORKER_VERSION } from '../index';

const SESSION = 'S-TEST-0001';
const LIMITS = CAPTURE_IPC_DEFAULTS;

async function setup(limits: Partial<CaptureIpcLimits> = {}, behaviour: Partial<FakeWorkerBehaviour> = {}) {
  const clock = manualCaptureTimers();
  const fake = fakeLauncher(behaviour);
  const reports: CaptureReport[] = [];
  const supervisor = createCaptureSupervisor({ now: clock.now, timers: clock.timers, launcher: fake.launcher, limits, report: (entry) => reports.push(entry) });
  const events: CaptureEvent[] = [];
  for (const name of ['telemetry', 'progress', 'warning', 'phase', 'workerDown'] as const) supervisor.on(name, (event) => void events.push(event));
  await supervisor.boot();
  const named = <Name extends CaptureEvent['name']>(name: Name) => events.filter((event): event is Extract<CaptureEvent, { name: Name }> => event.name === name);
  return { clock, fake, supervisor, events, reports, named };
}

/** Starts a session and waits until the fake acknowledged `START`. */
async function recording(limits: Partial<CaptureIpcLimits> = {}, behaviour: Partial<FakeWorkerBehaviour> = {}) {
  const context = await setup(limits, behaviour);
  await context.supervisor.start(SESSION, capturePlan(SESSION));
  return context;
}

/** The refusal a promise rejects with, as `code` or `code/detail`. */
async function refusalOf(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof CaptureSupervisorError) return error.detail === null ? error.code : `${error.code}/${error.detail}`;
    throw error;
  }
  return 'RESOLVED';
}

describe('a session', () => {
  it('starts one worker, shakes hands, sends START with the plan, and records when START is acknowledged', async () => {
    const { supervisor, fake, named } = await recording();
    expect(fake.workers).toHaveLength(1);
    const [start] = fake.last().commands(SupervisorMessageType.START);
    expect(start).toMatchObject({ v: CAPTURE_PROTOCOL_VERSION, sessionId: SESSION, attempt: 1, plan: capturePlan(SESSION) });
    expect(supervisor.status()).toMatchObject({ phase: CapturePhase.RECORDING, sessionId: SESSION, workerPid: fake.last().pid, attempt: 1, restarts: 0, heartbeatAgeMs: 0, lastCrash: null });
    expect(named('phase').map((event) => `${event.previous}>${event.phase}`)).toEqual(['IDLE>STARTING', 'STARTING>RECORDING']);
  });

  it('is refused before boot and after shutdown, and a second one while one is open (R-6)', async () => {
    const clock = manualCaptureTimers();
    const fake = fakeLauncher();
    const supervisor = createCaptureSupervisor({ now: clock.now, timers: clock.timers, launcher: fake.launcher });
    expect(await refusalOf(supervisor.start(SESSION, capturePlan()))).toBe(CaptureRefusal.CLOSED);
    await supervisor.boot();
    await supervisor.start(SESSION, capturePlan());
    expect(await refusalOf(supervisor.start('S-TEST-0002', capturePlan('S-TEST-0002')))).toBe(CaptureRefusal.SESSION_OPEN);
    expect(fake.workers).toHaveLength(1);
    await supervisor.shutdown();
    expect(supervisor.status().phase).toBe(CapturePhase.CLOSED);
    expect(await refusalOf(supervisor.start(SESSION, capturePlan()))).toBe(CaptureRefusal.CLOSED);
  });

  it('refuses a plan that is not valid, naming the field and never its value, and starts no worker', async () => {
    const { supervisor, fake } = await setup();
    const plan = capturePlan();
    const outside = { ...plan, cameras: [{ ...plan.cameras[0]!, ingestUrl: 'rtsp://192.168.1.20:554/stream' }] };
    const withCredentials = { ...plan, cameras: [{ ...plan.cameras[0]!, ingestUrl: 'rtsp://admin:hunter2@127.0.0.1:8554/video01' }] };
    const trailingSlash = { ...plan, cameras: [{ ...plan.cameras[0]!, ingestUrl: 'rtsp://127.0.0.1:8554/video01/' }] };
    for (const bad of [outside, withCredentials, trailingSlash]) {
      const error = await supervisor.start(SESSION, bad).catch((caught: unknown) => caught);
      expect(error).toBeInstanceOf(CaptureSupervisorError);
      expect((error as CaptureSupervisorError).code).toBe(CaptureRefusal.PLAN_INVALID);
      expect((error as CaptureSupervisorError).detail).toBe('cameras.0.ingestUrl');
      expect(JSON.stringify([(error as Error).message, (error as CaptureSupervisorError).detail])).not.toMatch(/hunter2|192\.168|rtsp/);
    }
    expect(await refusalOf(supervisor.start('bad id with spaces', plan))).toBe(CaptureRefusal.PLAN_INVALID);
    // D61 (2026-11-04): `activeMic` is the TRANSCRIBED CHANNEL of `AUDIO-01` - the protocol validates exactly
    // `MIC-01`, so any other channel word is a plan that states no truth about the session.
    expect(await refusalOf(supervisor.start(SESSION, { ...plan, activeMic: 'MIC-02' }))).toBe(`${CaptureRefusal.PLAN_INVALID}/activeMic`);
    expect(fake.calls()).toBe(0);
    expect(supervisor.status().phase).toBe(CapturePhase.IDLE);
    // Control: the unchanged plan is taken.
    await supervisor.start(SESSION, plan);
    expect(fake.calls()).toBe(1);
  });

  it('stop sends STOP, waits for the worker to exit, and is then idle with no timer left', async () => {
    const { supervisor, fake, clock } = await recording();
    const worker = fake.last();
    await supervisor.stop(SESSION, 'STOPPED');
    expect(worker.commands(SupervisorMessageType.STOP)).toMatchObject([{ reason: 'STOPPED', sessionId: SESSION }]);
    expect(worker.exited).toBe(true);
    expect(worker.kills).toEqual([]);
    expect(supervisor.status()).toMatchObject({ phase: CapturePhase.IDLE, sessionId: null, workerPid: null, lastCrash: null });
    expect(clock.armed()).toEqual([]);
    // No session: a stop is nothing to do. Another session's ID is unknown while one is open.
    await expect(supervisor.stop(SESSION, 'STOPPED')).resolves.toEqual({ clean: true, down: null });
    await supervisor.start(SESSION, capturePlan());
    expect(await refusalOf(supervisor.stop('S-OTHER', 'STOPPED'))).toBe(CaptureRefusal.SESSION_UNKNOWN);
  });

  it('a worker that ignores STOP is killed after the grace, and only then is the stop finished', async () => {
    const { supervisor, fake, clock } = await recording({}, { exitOnStop: false });
    const worker = fake.last();
    let stopped = false;
    const stopping = supervisor.stop(SESSION, 'STOPPED').then(() => (stopped = true));
    await flush();
    expect(supervisor.status().phase).toBe(CapturePhase.STOPPING);
    clock.advance(LIMITS.stopGraceMs - 1);
    await flush();
    expect([worker.kills, stopped]).toEqual([[], false]);
    clock.advance(1);
    await stopping;
    expect(worker.kills).toEqual(['SIGKILL']);
    expect(supervisor.status().phase).toBe(CapturePhase.IDLE);
  });

  it('shutdown stops the open session with reason SHUTDOWN and leaves no worker behind', async () => {
    const { supervisor, fake } = await recording();
    await supervisor.shutdown();
    expect(fake.last().commands(SupervisorMessageType.STOP)).toMatchObject([{ reason: 'SHUTDOWN' }]);
    expect(fake.last().exited).toBe(true);
    expect(supervisor.status()).toMatchObject({ phase: CapturePhase.CLOSED, sessionId: null, workerPid: null });
    await expect(supervisor.shutdown()).resolves.toBeUndefined();
  });
});

describe('M3-KC-3: heartbeat and back-off', () => {
  it('no heartbeat for the timeout: the worker is killed and a new one starts after the first back-off delay, not before', async () => {
    const { supervisor, fake, clock, named } = await recording();
    const first = fake.last();
    clock.advance(LIMITS.heartbeatTimeoutMs - 1);
    expect([first.kills, supervisor.status().phase]).toEqual([[], CapturePhase.RECORDING]);
    clock.advance(1);
    expect(first.kills).toEqual(['SIGKILL']);
    expect(supervisor.status()).toMatchObject({ phase: CapturePhase.RESTARTING, workerPid: null, restarts: 1 });
    expect(supervisor.status().lastCrash).toMatchObject({ code: WorkerDownCode.HEARTBEAT_TIMEOUT, attempt: 1 });
    expect(named('workerDown').map((event) => event.restartInMs)).toEqual([LIMITS.backoffBaseMs]);
    await flush();
    clock.advance(LIMITS.backoffBaseMs - 1);
    await flush();
    expect(fake.workers).toHaveLength(1);
    clock.advance(1);
    await flush();
    expect(fake.workers).toHaveLength(2);
    expect(fake.last().commands(SupervisorMessageType.START)).toMatchObject([{ attempt: 2, sessionId: SESSION }]);
    expect(supervisor.status()).toMatchObject({ phase: CapturePhase.RECORDING, attempt: 2, workerPid: fake.last().pid });
  });

  it('CONTROL: a worker that keeps its heartbeat is never restarted, however long it runs', async () => {
    const { supervisor, fake, clock, named } = await recording();
    const worker = fake.last();
    for (let beat = 0; beat < 40; beat += 1) {
      clock.advance(LIMITS.heartbeatTimeoutMs - 1);
      worker.heartbeat();
    }
    expect(clock.now()).toBeGreaterThan(1_760_000_000_000 + 30 * LIMITS.heartbeatTimeoutMs);
    expect([worker.kills, fake.workers.length, named('workerDown').length]).toEqual([[], 1, 0]);
    expect(supervisor.status()).toMatchObject({ phase: CapturePhase.RECORDING, heartbeatAgeMs: 0 });
  });

  it('a heartbeat whose counter does not grow is no sign of life', async () => {
    const { supervisor, fake, clock } = await recording();
    const worker = fake.last();
    worker.heartbeat();
    clock.advance(LIMITS.heartbeatTimeoutMs - 1);
    worker.heartbeat(1);
    worker.heartbeat(0);
    expect(supervisor.status().heartbeatAgeMs).toBe(LIMITS.heartbeatTimeoutMs - 1);
    clock.advance(1);
    expect(worker.kills).toEqual(['SIGKILL']);
    expect(supervisor.status().lastCrash?.code).toBe(WorkerDownCode.HEARTBEAT_TIMEOUT);
  });

  it('restarts in a row wait base, 2x, 4x, ... up to the cap: the delays are exactly those of backoffDelayMs', async () => {
    const limits = { maxRestarts: 8 };
    const { fake, clock, named, supervisor } = await recording(limits);
    for (let restart = 0; restart < 8; restart += 1) {
      fake.last().exit(1);
      const delay = named('workerDown').at(-1)?.restartInMs ?? -1;
      clock.advance(delay);
      await flush();
    }
    const delays = named('workerDown').map((event) => event.restartInMs);
    expect(delays).toEqual([250, 500, 1_000, 2_000, 4_000, 8_000, 8_000, 8_000]);
    expect(delays).toEqual([0, 1, 2, 3, 4, 5, 6, 7].map((restart) => backoffDelayMs(restart)));
    expect(fake.workers).toHaveLength(9);
    expect(supervisor.status()).toMatchObject({ phase: CapturePhase.RECORDING, attempt: 9, restarts: 8 });
  });

  it('a worker that ran stable clears the count of restarts; one that crashes sooner does not', async () => {
    const { supervisor, fake, clock } = await recording();
    fake.last().exit(1);
    clock.advance(LIMITS.backoffBaseMs);
    await flush();
    expect(supervisor.status().restarts).toBe(1);
    // Kept alive until just before it counts as stable: the count stays.
    const beats = Math.floor((LIMITS.stableAfterMs - 1) / 1_000);
    for (let beat = 0; beat < beats; beat += 1) {
      clock.advance(1_000);
      fake.last().heartbeat();
    }
    expect(supervisor.status().restarts).toBe(1);
    clock.advance(1_000);
    fake.last().heartbeat();
    expect(supervisor.status()).toMatchObject({ restarts: 0, phase: CapturePhase.RECORDING });
  });

  it('an unstartable worker: start is refused with CAPTURE_FAULT after the restarts, the warning is raised once, and the supervisor is clean', async () => {
    const { supervisor, fake, clock, named } = await setup();
    fake.failNext(100);
    let outcome = 'PENDING';
    const starting = refusalOf(supervisor.start(SESSION, capturePlan())).then((code) => (outcome = code));
    for (let restart = 0; restart < LIMITS.maxRestarts; restart += 1) {
      expect(outcome).toBe('PENDING');
      expect(supervisor.status()).toMatchObject({ phase: CapturePhase.STARTING, restarts: restart + 1 });
      clock.advance(backoffDelayMs(restart));
      await flush();
    }
    await starting;
    expect(outcome).toBe(`${CaptureRefusal.FAULT}/${WorkerDownCode.SPAWN_FAILED}`);
    expect(fake.calls()).toBe(1 + LIMITS.maxRestarts);
    expect(named('warning')).toMatchObject([{ code: CaptureWarningCode.CAPTURE_FAULT, source: 'supervisor', action: 'raiseCaptureWarning', sessionId: SESSION }]);
    expect(named('workerDown').map((event) => event.restartInMs)).toEqual([250, 500, 1_000, 2_000, 4_000, null]);
    // Clean: no session, no worker, no timer; and the next start works.
    expect(supervisor.status()).toMatchObject({ phase: CapturePhase.IDLE, sessionId: null, workerPid: null });
    expect(clock.armed()).toEqual([]);
    fake.failNext(0);
    await supervisor.start(SESSION, capturePlan());
    expect(supervisor.status().phase).toBe(CapturePhase.RECORDING);
  });

  it.each([
    ['never says HELLO', { hello: false }, WorkerDownCode.HELLO_TIMEOUT, LIMITS.helloTimeoutMs],
    ['never acknowledges START', { ackStart: false }, WorkerDownCode.START_TIMEOUT, LIMITS.heartbeatTimeoutMs],
    ['refuses START', { ackStart: 'NO_DEVICE' }, WorkerDownCode.START_REFUSED, 0],
  ] as const)('a worker that %s is unstartable too: CAPTURE_FAULT, by its own code', async (_label, behaviour, code, wait) => {
    const { supervisor, clock, named, fake } = await setup({ maxRestarts: 2, ackTimeoutMs: LIMITS.heartbeatTimeoutMs }, behaviour);
    const starting = refusalOf(supervisor.start(SESSION, capturePlan()));
    for (let attempt = 0; attempt < 3; attempt += 1) {
      await flush();
      // The fake keeps its heartbeat while it is silent about START: only the START timeout ends it.
      if (wait > 0 && behaviour !== undefined && 'ackStart' in behaviour) fake.last().heartbeat();
      clock.advance(wait);
      await flush();
      // Exactly the back-off, so that the next worker starts at the end of this step and no later timer fires with it.
      clock.advance(named('workerDown').at(-1)?.restartInMs ?? 0);
    }
    expect(await starting).toBe(`${CaptureRefusal.FAULT}/${code}`);
    expect(named('workerDown').map((event) => event.down.code)).toEqual([code, code, code]);
    expect(named('warning').map((event) => event.code)).toEqual([CaptureWarningCode.CAPTURE_FAULT]);
    expect(fake.workers.every((worker) => worker.exited)).toBe(true);
    expect(supervisor.status().phase).toBe(CapturePhase.IDLE);
    expect(clock.armed()).toEqual([]);
  });

  it('a failure that another try cannot change is not retried: no launcher configured, another protocol version', async () => {
    const mismatch = await setup({}, { protocolVersion: 1 });
    expect(await refusalOf(mismatch.supervisor.start(SESSION, capturePlan()))).toBe(`${CaptureRefusal.FAULT}/${WorkerDownCode.PROTOCOL_MISMATCH}`);
    expect(mismatch.fake.calls()).toBe(1);
    expect(mismatch.fake.last().kills).toEqual(['SIGKILL']);
    expect(mismatch.clock.armed()).toEqual([]);

    const none = await setup();
    none.fake.failNext(1, false);
    expect(await refusalOf(none.supervisor.start(SESSION, capturePlan()))).toBe(`${CaptureRefusal.FAULT}/${WorkerDownCode.SPAWN_FAILED}`);
    expect(none.fake.calls()).toBe(1);
  });

  it('a recording whose worker cannot be kept running ends FAULTED with CAPTURE_FAULT; the session stays open until it is stopped', async () => {
    const { supervisor, fake, clock, named } = await recording({ maxRestarts: 2 });
    for (let crash = 0; crash < 3; crash += 1) {
      fake.last().exit(null, 'SIGSEGV');
      clock.advance(named('workerDown').at(-1)?.restartInMs ?? 0);
      await flush();
    }
    expect(fake.workers).toHaveLength(3);
    expect(named('workerDown').map((event) => `${event.down.code} ${event.restartInMs}`)).toEqual(['EXITED 250', 'EXITED 500', 'EXITED null']);
    expect(supervisor.status()).toMatchObject({ phase: CapturePhase.FAULTED, sessionId: SESSION, workerPid: null });
    expect(supervisor.status().lastCrash).toMatchObject({ code: WorkerDownCode.EXITED, signal: 'SIGSEGV', attempt: 3 });
    expect(named('warning')).toMatchObject([{ code: CaptureWarningCode.CAPTURE_FAULT, source: 'supervisor' }]);
    expect(await refusalOf(supervisor.start('S-TEST-0002', capturePlan('S-TEST-0002')))).toBe(CaptureRefusal.SESSION_OPEN);
    expect(await refusalOf(supervisor.switchAudioSource(SESSION, CaptureMicRole.STANDBY))).toBe(CaptureRefusal.WORKER_DOWN);
    await supervisor.stop(SESSION, 'CRASH');
    expect(supervisor.status()).toMatchObject({ phase: CapturePhase.IDLE, sessionId: null });
    expect(clock.armed()).toEqual([]);
  });

  it('a stop during the back-off cancels the restart: no worker starts afterwards', async () => {
    const { supervisor, fake, clock } = await recording();
    fake.last().exit(1);
    expect(supervisor.status().phase).toBe(CapturePhase.RESTARTING);
    await supervisor.stop(SESSION, 'STOPPED');
    clock.advance(LIMITS.backoffMaxMs * 4);
    await flush();
    expect(fake.workers).toHaveLength(1);
    expect(supervisor.status().phase).toBe(CapturePhase.IDLE);
  });

  it('a line that is no frame, a second HELLO, a message before HELLO and a message of another session each end the worker', async () => {
    const cases: Array<[string, (worker: ReturnType<typeof fakeLauncher>['workers'][number]) => void]> = [
      [FrameViolation.NOT_JSON, (worker) => worker.violate(FrameViolation.NOT_JSON)],
      [FrameViolation.TOO_LONG, (worker) => worker.violate(FrameViolation.TOO_LONG)],
      ['HELLO_TWICE', (worker) => worker.hello()],
      ['SESSION_MISMATCH', (worker) => worker.say({ type: 'WARNING', code: 'MIC_SILENT', reason: 'MIC_LEVEL_BELOW_THRESHOLD', state: 'ACTIVE', subject: 'MIC-01' }, 'S-ANOTHER')],
    ];
    for (const [detail, act] of cases) {
      const { supervisor, fake } = await recording();
      act(fake.last());
      expect(supervisor.status().lastCrash).toMatchObject({ code: WorkerDownCode.PROTOCOL_VIOLATION, detail });
      expect(fake.last().kills).toEqual(['SIGKILL']);
    }
    const early = await setup({}, { hello: false });
    void early.supervisor.start(SESSION, capturePlan()).catch(() => {});
    early.fake.last().heartbeat();
    expect(early.supervisor.status().lastCrash).toMatchObject({ code: WorkerDownCode.PROTOCOL_VIOLATION, detail: 'HELLO_EXPECTED' });
  });
});

describe('M3-KC-1: one worker process per session, never reused (S1 G-1, D10(b))', () => {
  it('after the ingest ended with TEARDOWN and the session stopped, the next session gets a NEW process with its own files', async () => {
    const { supervisor, fake } = await recording();
    const first = fake.last();
    await supervisor.stop(SESSION, 'STOPPED');
    expect(first.exited).toBe(true);

    await supervisor.start('S-TEST-0002', capturePlan('S-TEST-0002'));
    const second = fake.last();
    expect(fake.workers).toHaveLength(2);
    expect(second).not.toBe(first);
    expect(second.pid).not.toBe(first.pid);
    expect(second.launch).toMatchObject({ sessionId: 'S-TEST-0002', attempt: 1 });
    // No process was ever given a second START, and no command of session 2 reached process 1.
    expect(fake.workers.map((worker) => worker.commands(SupervisorMessageType.START).length)).toEqual([1, 1]);
    expect(first.received.some((message) => message.sessionId === 'S-TEST-0002')).toBe(false);
    const outputs = fake.workers.map((worker) => worker.commands(SupervisorMessageType.START)[0]?.plan.cameras.map((camera) => camera.outputPath));
    expect(new Set(outputs.flat()).size).toBe(4);
    expect(supervisor.status()).toMatchObject({ phase: CapturePhase.RECORDING, sessionId: 'S-TEST-0002', attempt: 1, restarts: 0 });
    expect(second.launch.correlationId).not.toBe(first.launch.correlationId);
  });

  it('CONTROL: a process that already served a session refuses a second START, so reuse would be seen', async () => {
    const { fake } = await recording();
    const worker = fake.last();
    const [start] = worker.commands(SupervisorMessageType.START);
    const refused: unknown[] = [];
    // The same START again, written straight to the process, past the supervisor.
    worker.say = (message) => void refused.push(message);
    await worker.send({ ...start!, correlationId: 'reuse-probe' });
    await flush();
    expect(refused).toEqual([{ type: 'ACK', correlationId: 'reuse-probe', ok: false, code: 'SESSION_ALREADY_SERVED' }]);
  });

  it('the ingest exits with code 0 in the MIDDLE of a recording (TEARDOWN): the supervisor starts a new process, it does not push again into the old one', async () => {
    const { supervisor, fake, clock, named } = await recording();
    const first = fake.last();
    first.exit(0);
    expect(named('workerDown')).toMatchObject([{ down: { code: WorkerDownCode.EXITED, exitCode: 0, attempt: 1 }, restartInMs: LIMITS.backoffBaseMs }]);
    clock.advance(LIMITS.backoffBaseMs);
    await flush();
    expect(fake.workers).toHaveLength(2);
    expect(fake.last().commands(SupervisorMessageType.START)).toMatchObject([{ attempt: 2 }]);
    expect(first.commands(SupervisorMessageType.START)).toHaveLength(1);
    expect(supervisor.status()).toMatchObject({ phase: CapturePhase.RECORDING, attempt: 2 });
  });

  it('a new process starts only after the previous one is known to have exited: no stale listener on the RTSP port', async () => {
    const { supervisor, fake, clock } = await recording({}, { exitOnKill: false });
    const first = fake.last();
    clock.advance(LIMITS.heartbeatTimeoutMs);
    expect(first.kills).toEqual(['SIGKILL']);
    // The back-off has long passed, but the killed process has not exited yet.
    clock.advance(LIMITS.backoffMaxMs);
    await flush();
    expect(fake.workers).toHaveLength(1);
    expect(supervisor.status().phase).toBe(CapturePhase.RESTARTING);
    first.exit(null, 'SIGKILL');
    await flush();
    expect(fake.workers).toHaveLength(2);
    expect(supervisor.status()).toMatchObject({ phase: CapturePhase.RECORDING, attempt: 2 });
  });
});

describe('correlation IDs', () => {
  it('every command carries the session and its own correlation ID; the events carry the session correlation', async () => {
    const { supervisor, fake, named, clock } = await recording();
    const worker = fake.last();
    await supervisor.switchAudioSource(SESSION, CaptureMicRole.STANDBY);
    worker.telemetry(1);
    worker.exit(1);
    clock.advance(LIMITS.backoffBaseMs);
    await flush();
    await supervisor.stop(SESSION, 'STOPPED');

    const session = worker.launch.correlationId;
    expect(session).toBe(`cap:${SESSION}:1`);
    const commands = fake.workers.flatMap((each) => each.received);
    // D61 (2026-11-04): the later worker is RE-SAID the operator's choice (the plan cannot carry it:
    // `activeMic` is the transcribed channel and the protocol validates `MIC-01`), so its own
    // `SWITCH_AUDIO_SOURCE` stands between its `START` and the `STOP`.
    expect(commands.map((command) => `${command.type} ${command.correlationId}`)).toEqual([
      `START ${session}:1`,
      `SWITCH_AUDIO_SOURCE ${session}:2`,
      `START ${session}:3`,
      `SWITCH_AUDIO_SOURCE ${session}:4`,
      `STOP ${session}:5`,
    ]);
    expect(commands.every((command) => command.sessionId === SESSION)).toBe(true);
    expect(new Set([...named('phase'), ...named('telemetry'), ...named('workerDown')].map((event) => event.correlationId))).toEqual(new Set([session]));

    // The next session of the same ID is another correlation.
    await supervisor.start(SESSION, capturePlan());
    expect(fake.last().launch.correlationId).toBe(`cap:${SESSION}:2`);
  });

  it('an acknowledgement is matched by its correlation ID: the answer to another command settles nothing', async () => {
    const { supervisor, fake } = await recording({}, { ackSwitch: false });
    const worker = fake.last();
    let settled = 'PENDING';
    const switching = refusalOf(supervisor.switchAudioSource(SESSION, CaptureMicRole.STANDBY)).then((code) => (settled = code));
    await flush();
    worker.say({ type: 'ACK', correlationId: 'cap:someone-else:9:9', ok: true });
    await flush();
    expect(settled).toBe('PENDING');
    worker.ack(false, 'MIC_UNPLUGGED');
    expect(await switching).toBe(`${CaptureRefusal.COMMAND_REFUSED}/MIC_UNPLUGGED`);
  });
});

describe('switchAudioSource (the operator\'s switch; never automatic, OD-11)', () => {
  it('resolves on the acknowledgement, and a worker that restarts later starts with the chosen source', async () => {
    const { supervisor, fake, clock } = await recording();
    await supervisor.switchAudioSource(SESSION, CaptureMicRole.STANDBY);
    expect(fake.last().commands(SupervisorMessageType.SWITCH_AUDIO_SOURCE)).toMatchObject([{ to: 'STANDBY' }]);
    fake.last().exit(1);
    clock.advance(LIMITS.backoffBaseMs);
    await flush();
    // D61 (2026-11-04): the plan of the later worker names the TRANSCRIBED CHANNEL - `MIC-01`, which the
    // protocol validates - and the operator's choice on the legacy two-role lane is RE-SAID to that worker
    // by a `SWITCH_AUDIO_SOURCE` of its own (the choice cannot travel on the plan: the role member is gone).
    const later = fake.last();
    expect(later.commands(SupervisorMessageType.START)[0]?.plan.activeMic).toBe('MIC-01');
    expect(later.commands(SupervisorMessageType.SWITCH_AUDIO_SOURCE)).toMatchObject([{ to: 'STANDBY' }]);
  });

  it('a MIC_SILENT warning is handed on as a warning and sends NO command to the worker', async () => {
    const { fake, named } = await recording();
    const before = fake.last().received.length;
    fake.last().warning(CaptureWarningCode.MIC_SILENT, 'MIC-01');
    await flush();
    expect(named('warning')).toMatchObject([{ code: 'MIC_SILENT', subject: 'MIC-01', source: 'worker', action: 'raiseCaptureWarning' }]);
    expect(fake.last().received).toHaveLength(before);
  });

  it('is refused when nothing records, for an unknown session, for a role no mic holds, and when it is not acknowledged in time', async () => {
    const idle = await setup();
    expect(await refusalOf(idle.supervisor.switchAudioSource(SESSION, CaptureMicRole.STANDBY))).toBe(CaptureRefusal.SESSION_UNKNOWN);

    // D61 (2026-11-04): a plan of the protocol holds FOUR channels, so every legacy role word names a channel
    // that a valid plan always holds - the refusal of THIS sub-case moves from "a role no mic holds" to a word
    // that is no role at all (channels 3 and 4 are recorded at once and are not selectable on this lane).
    const one = await setup();
    await one.supervisor.start(SESSION, capturePlan());
    expect(await refusalOf(one.supervisor.switchAudioSource(SESSION, 'MIC-03' as unknown as CaptureMicRole))).toBe(CaptureRefusal.PLAN_INVALID);

    const silent = await recording({}, { ackSwitch: false });
    const switching = refusalOf(silent.supervisor.switchAudioSource(SESSION, CaptureMicRole.STANDBY));
    // The heartbeat keeps the worker alive while the acknowledgement is overdue.
    for (let elapsed = 0; elapsed < LIMITS.ackTimeoutMs; elapsed += 1_000) {
      silent.clock.advance(1_000);
      silent.fake.last().heartbeat();
    }
    expect(await switching).toBe(CaptureRefusal.COMMAND_TIMEOUT);
    expect(silent.supervisor.status().phase).toBe(CapturePhase.RECORDING);

    const down = await recording();
    down.fake.last().exit(1);
    expect(await refusalOf(down.supervisor.switchAudioSource(SESSION, CaptureMicRole.STANDBY))).toBe(CaptureRefusal.WORKER_DOWN);
  });
});

describe('back-pressure', () => {
  it('telemetry a listener has not taken yet is replaced by the newest frame; below the limit, progress of different steps is kept in order (the queue is lossy by contract: liveness.test.ts F-4)', async () => {
    const clock = manualCaptureTimers();
    const fake = fakeLauncher();
    const supervisor = createCaptureSupervisor({ now: clock.now, timers: clock.timers, launcher: fake.launcher });
    const delivered: string[] = [];
    let release: () => void = () => {};
    supervisor.on('telemetry', (event) => {
      delivered.push(`T${event.frame.fragments[0]?.count}`);
      // The first frame holds the listener up: an engine unit that takes its time.
      if (delivered.length === 1) return new Promise<void>((resolve) => (release = resolve));
      return undefined;
    });
    supervisor.on('progress', (event) => void delivered.push(`P${event.frame.step}`));
    await supervisor.boot();
    await supervisor.start(SESSION, capturePlan());
    const worker = fake.last();

    worker.telemetry(1);
    for (let frame = 2; frame <= 50; frame += 1) worker.telemetry(frame);
    worker.progress('HASH', 0.5);
    worker.telemetry(51);
    worker.progress('SIGN', 0.9);
    expect(delivered).toEqual(['T1']);
    expect(supervisor.status()).toMatchObject({ queuedEvents: 3, droppedTelemetry: 49 });
    release();
    await flush();
    // Both progress events, in their order, and exactly ONE more telemetry frame: the newest.
    expect(delivered).toEqual(['T1', 'PHASH', 'T51', 'PSIGN']);
    expect(supervisor.status().queuedEvents).toBe(0);
  });

  it('CONTROL: a listener that keeps up loses nothing', async () => {
    const { fake, named, supervisor } = await recording();
    for (let frame = 1; frame <= 50; frame += 1) fake.last().telemetry(frame);
    expect(named('telemetry').map((event) => event.frame.fragments[0]?.count)).toEqual(Array.from({ length: 50 }, (_unused, index) => index + 1));
    expect(supervisor.status()).toMatchObject({ droppedTelemetry: 0, droppedEvents: 0, queuedEvents: 0 });
  });

  // Until fix round 1 this place held "the worker's output is paused at the limit and resumed at half
  // of it". The pause is gone (navigator finding F-1: it hid the heartbeats and got healthy workers
  // killed); the bound is now kept by replacing and evicting, tested in `liveness.test.ts` (F-4).
  it('up to the limit, events of different steps wait in their order and none is lost; the worker is never held back', async () => {
    const clock = manualCaptureTimers();
    const fake = fakeLauncher();
    const supervisor = createCaptureSupervisor({ now: clock.now, timers: clock.timers, launcher: fake.launcher, limits: { eventQueueLimit: 8 } });
    const steps: string[] = [];
    const gates: Array<() => void> = [];
    supervisor.on('progress', (event) => {
      steps.push(event.frame.step);
      return new Promise<void>((resolve) => gates.push(resolve));
    });
    await supervisor.boot();
    await supervisor.start(SESSION, capturePlan());
    const worker = fake.last();
    // One is with the listener; eight wait: exactly the limit.
    for (let step = 0; step < 9; step += 1) worker.progress(`S${step}`, 0);
    expect(supervisor.status()).toMatchObject({ queuedEvents: 8, droppedEvents: 0, droppedTelemetry: 0 });
    while (steps.length < 9) {
      gates.shift()?.();
      await flush();
    }
    gates.shift()?.();
    await flush();
    expect(steps).toEqual(Array.from({ length: 9 }, (_unused, index) => `S${index}`));
    expect(supervisor.status()).toMatchObject({ queuedEvents: 0, droppedEvents: 0 });
  });

  it('no more than the limit of commands await their acknowledgement: one more is refused, not queued', async () => {
    const { supervisor, fake } = await recording({ commandQueueLimit: 3 }, { ackSwitch: false });
    const worker = fake.last();
    const waiting = [1, 2, 3].map(() => refusalOf(supervisor.switchAudioSource(SESSION, CaptureMicRole.STANDBY)));
    expect(await refusalOf(supervisor.switchAudioSource(SESSION, CaptureMicRole.STANDBY))).toBe(CaptureRefusal.BACKPRESSURE);
    await flush();
    expect(worker.commands(SupervisorMessageType.SWITCH_AUDIO_SOURCE)).toHaveLength(3);
    // The worker goes down: nobody is left waiting.
    worker.exit(1);
    expect(await Promise.all(waiting)).toEqual([CaptureRefusal.WORKER_DOWN, CaptureRefusal.WORKER_DOWN, CaptureRefusal.WORKER_DOWN]);
  });

  it('a listener that throws is reported with the session and correlation IDs, and the other listeners still get the event', async () => {
    const { supervisor, fake, reports, named } = await setup();
    supervisor.on('telemetry', () => {
      throw new Error('listener failed');
    });
    const seen: number[] = [];
    supervisor.on('telemetry', (event) => void seen.push(event.frame.fragments[0]?.count ?? -1));
    await supervisor.start(SESSION, capturePlan());
    fake.last().telemetry(7);
    await flush();
    expect(seen).toEqual([7]);
    expect(named('telemetry')).toHaveLength(1);
    expect(reports).toMatchObject([{ source: 'capture.supervisor.listener', code: 'CAPTURE_LISTENER_FAILED', sessionId: SESSION, correlationId: `cap:${SESSION}:1` }]);
  });
});

describe('code review of M3 (row 63), the supervisor\'s findings: R63-01, R63-04, R63-05, R63-07 (fix pass F-M3)', () => {
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
      // Pin by delta (wave H driver F, gate 64 C7): the form is not enough - THE version this Core drives is taken, and only it.
      fake.last().say(hello(CAPTURE_WORKER_VERSION));
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
});

describe('task 4 row 179 (BR-07 (2)): a later worker of a session is sent ingest addresses of its own', () => {
  const elementOf = (address: string): string => address.slice(address.lastIndexOf('/') + 1);
  /** A source of chance that never repeats and can be told apart: draw n is 16 bytes of the value n. */
  const counting = () => {
    let draws = 0;
    return { chance: (bytes: number): Uint8Array => new Uint8Array(bytes).fill((draws += 1)), draws: () => draws };
  };
  /** The session's side as a double: what it was told, per attempt (what it would hand to the relay of that attempt). */
  const receiver = (chance: (bytes: number) => Uint8Array) => {
    const told: Array<{ attempt: number; addresses: Record<string, string>; workersThen: number }> = [];
    return { told, attempts: (fake: { workers: unknown[] }) => ({ chance, renewed: (attempt: number, addresses: ReadonlyMap<string, string>) => void told.push({ attempt, addresses: Object.fromEntries(addresses), workersThen: fake.workers.length }) }) };
  };
  const planOf = (worker: { commands(type: 'START'): Array<{ plan: ReturnType<typeof capturePlan> }> }) => worker.commands(SupervisorMessageType.START)[0]!.plan;
  const addressesOf = (plan: ReturnType<typeof capturePlan>): Record<string, string> => Object.fromEntries(plan.cameras.map((camera) => [camera.deviceId, camera.ingestUrl]));
  async function restart(context: Awaited<ReturnType<typeof setup>>, delayMs: number): Promise<void> {
    context.fake.last().exit(1);
    context.clock.advance(delayMs);
    await flush();
  }

  it('two attempts of one session: attempt 1 is sent the plan as given; attempt 2 a new element for BOTH tracks, built by the one function, and the receiver is told the same strings before that worker is started', async () => {
    const context = await setup();
    const source = counting();
    const session = receiver(source.chance);
    const plan = capturePlan(SESSION);
    await context.supervisor.start(SESSION, plan, session.attempts(context.fake));
    // Attempt 1: the plan of the start, byte for byte; the source was not asked and the receiver not told.
    expect(planOf(context.fake.last())).toEqual(plan);
    expect([source.draws(), session.told]).toEqual([0, []]);
    await restart(context, LIMITS.backoffBaseMs);
    expect(context.fake.workers).toHaveLength(2);
    const second = planOf(context.fake.last());
    // The form of the one function: the listener of the track, the session, the track in lower case, 16 bytes as URL-safe base64.
    expect(addressesOf(second)).toEqual({
      'CAM-01': `rtsp://127.0.0.1:8554/${SESSION}/video-01/${Buffer.from(new Uint8Array(16).fill(1)).toString('base64url')}`,
      'CAM-02': `rtsp://127.0.0.1:8556/${SESSION}/video-02/${Buffer.from(new Uint8Array(16).fill(2)).toString('base64url')}`,
    });
    for (const camera of second.cameras) expect(elementOf(camera.ingestUrl) === elementOf(plan.cameras.find((first) => first.deviceId === camera.deviceId)!.ingestUrl)).toBe(false);
    // Nothing else of the plan moved.
    expect({ ...second, cameras: second.cameras.map((camera) => ({ ...camera, ingestUrl: '' })) }).toEqual({ ...plan, cameras: plan.cameras.map((camera) => ({ ...camera, ingestUrl: '' })) });
    // The receiver (the session, for its relays): the strings of ITS attempt, told once, while only the first worker existed.
    expect(session.told).toEqual([{ attempt: 2, addresses: addressesOf(second), workersThen: 1 }]);
    expect(context.supervisor.status()).toMatchObject({ phase: CapturePhase.RECORDING, attempt: 2 });
  });

  it('no element of an earlier attempt or of an earlier session is in a later plan: three attempts, then a second session, with the runtime\'s random source', async () => {
    const { randomBytes } = await import('node:crypto');
    const context = await setup();
    const session = receiver(randomBytes);
    const seen: string[] = [];
    const first = { ...capturePlan(SESSION), cameras: capturePlan(SESSION).cameras.map((camera, index) => ({ ...camera, ingestUrl: `rtsp://127.0.0.1:${index === 0 ? 8554 : 8556}/${SESSION}/video-0${index + 1}/${randomBytes(16).toString('base64url')}` })) };
    await context.supervisor.start(SESSION, first, session.attempts(context.fake));
    seen.push(...Object.values(addressesOf(planOf(context.fake.last()))));
    await restart(context, LIMITS.backoffBaseMs);
    seen.push(...Object.values(addressesOf(planOf(context.fake.last()))));
    await restart(context, backoffDelayMs(1, LIMITS));
    seen.push(...Object.values(addressesOf(planOf(context.fake.last()))));
    expect(context.fake.workers).toHaveLength(3);
    await context.supervisor.stop(SESSION, CaptureStopReason.STOPPED);
    const other = 'S-TEST-0002';
    await context.supervisor.start(other, capturePlan(other), session.attempts(context.fake));
    await restart(context, LIMITS.backoffBaseMs);
    seen.push(...Object.values(addressesOf(planOf(context.fake.last()))));
    expect(seen).toHaveLength(8);
    expect(new Set(seen.map(elementOf)).size).toBe(8);
    for (const element of seen.map(elementOf)) expect(element).toMatch(/^[A-Za-z0-9_-]{22}$/);
    expect(session.told.map((entry) => entry.attempt)).toEqual([2, 3, 2]);
  });

  it('the addresses are in the plan frame and in the receiver\'s call only: no event, no report, no status and no other frame holds an element', async () => {
    const context = await setup();
    const session = receiver(counting().chance);
    const records: unknown[] = [];
    context.supervisor.on('record', (event) => void records.push(event));
    await context.supervisor.start(SESSION, capturePlan(SESSION), session.attempts(context.fake));
    await restart(context, LIMITS.backoffBaseMs);
    const elements = Object.values(session.told[0]!.addresses).map(elementOf);
    expect(elements).toHaveLength(2);
    const holds = (value: unknown): boolean => elements.some((element) => JSON.stringify(value).includes(element));
    // CONTROL: the same search finds them in the START frame of the second worker.
    expect(holds(context.fake.last().commands(SupervisorMessageType.START))).toBe(true);
    expect([holds(context.events), holds(context.reports), holds(records), holds(context.supervisor.status()), holds(context.fake.workers[0]!.received)]).toEqual([false, false, false, false, false]);
    expect(holds(context.fake.last().received.filter((frame) => frame.type !== SupervisorMessageType.START))).toBe(false);
  });

  it('a plan that cannot be renewed starts NO worker and is not tried again: a source that repeats, one that answers short, one that throws, a receiver that throws', async () => {
    const stale = new Uint8Array(16).fill(9);
    const cases: Array<[string, (bytes: number) => Uint8Array, (() => void) | null]> = [
      ['ELEMENT_REPEATED', () => stale, null],
      ['SOURCE_FAILED', () => new Uint8Array(8), null],
      ['SOURCE_FAILED', () => { throw new Error('no entropy'); }, null],
      ['RECEIVER_FAILED', counting().chance, () => { throw new Error('rtsp://127.0.0.1:8554/a-secret-the-receiver-put-in-its-error'); }],
    ];
    for (const [why, chance, renewed] of cases) {
      const context = await setup();
      const plan = { ...capturePlan(SESSION), cameras: capturePlan(SESSION).cameras.map((camera) => ({ ...camera, ingestUrl: `${camera.ingestUrl}/${Buffer.from(stale).toString('base64url')}` })) };
      await context.supervisor.start(SESSION, plan, { chance, renewed: renewed ?? (() => undefined) });
      await restart(context, LIMITS.backoffBaseMs);
      // No second worker, the session FAULTED with one CAPTURE_FAULT, and no further timer would start one.
      expect([why, context.fake.workers.length, context.fake.calls()]).toEqual([why, 1, 1]);
      expect(context.supervisor.status()).toMatchObject({ phase: CapturePhase.FAULTED, attempt: 2, lastCrash: { code: WorkerDownCode.SPAWN_FAILED, attempt: 2 } });
      expect(context.named('warning').filter((event) => event.code === CaptureWarningCode.CAPTURE_FAULT)).toHaveLength(1);
      expect(context.named('workerDown').map((event) => event.restartInMs)).toEqual([LIMITS.backoffBaseMs, null]);
      // Said once, by a closed code and a closed reason: never the text of the failure.
      expect(context.reports.map((entry) => [entry.source, entry.code, (entry.err as CaptureSupervisorError).detail])).toEqual([['capture.supervisor.launch', 'CAPTURE_INGEST_NOT_RENEWED', why]]);
      expect(JSON.stringify(context.reports.map((entry) => String((entry.err as Error).message)))).not.toMatch(/rtsp|a-secret|entropy/);
      context.clock.advance(LIMITS.backoffMaxMs * 4);
      await flush();
      expect(context.fake.calls()).toBe(1);
      await context.supervisor.stop(SESSION, CaptureStopReason.STOPPED);
    }
  });

  it('CONTROL - a start WITHOUT the source (every caller before this row, every double): the later worker is sent the plan as given, as before', async () => {
    const context = await setup();
    const plan = capturePlan(SESSION);
    await context.supervisor.start(SESSION, plan);
    await restart(context, LIMITS.backoffBaseMs);
    expect(context.fake.workers).toHaveLength(2);
    expect(planOf(context.fake.last())).toEqual(plan);
    expect(context.reports).toEqual([]);
  });

  it('a switch of the audio source survives the renewal: the later plan holds the chosen source AND new addresses', async () => {
    const context = await setup();
    const session = receiver(counting().chance);
    await context.supervisor.start(SESSION, capturePlan(SESSION), session.attempts(context.fake));
    await context.supervisor.switchAudioSource(SESSION, CaptureMicRole.STANDBY);
    await restart(context, LIMITS.backoffBaseMs);
    const second = planOf(context.fake.last());
    // D61 (2026-11-04): the renewed plan keeps the transcribed channel; the chosen source is re-said by the lane's own command.
    expect(second.activeMic).toBe('MIC-01');
    expect(context.fake.last().commands(SupervisorMessageType.SWITCH_AUDIO_SOURCE)).toMatchObject([{ to: 'STANDBY' }]);
    expect(addressesOf(second)).toEqual(session.told[0]!.addresses);
  });
});

describe('task 4 row 191: a later worker of a session waits for the session\'s audio sources, and the back-off is not moved', () => {
  type Inputs = ReadonlyMap<string, { kind: 'PCM_FIFO'; path: string }>;
  const chance = (): ((bytes: number) => Uint8Array) => {
    let draws = 0;
    return (bytes) => new Uint8Array(bytes).fill((draws += 1));
  };
  const inputsOf = (plan: ReturnType<typeof capturePlan>, suffix = ''): Map<string, { kind: 'PCM_FIFO'; path: string }> => new Map(plan.mics.map((mic) => [mic.deviceId, { kind: 'PCM_FIFO' as const, path: `${mic.input.path}${suffix}` }]));
  /** The session's side as a double: asked per attempt, and settled by the test. */
  const sources = () => {
    const asked: Array<{ attempt: number; workersThen: number; resolve: (inputs: Inputs) => void; reject: (error: Error) => void }> = [];
    return {
      asked,
      attempts: (fake: { workers: unknown[] }, how: 'PENDING' | Inputs = 'PENDING') => ({
        chance: chance(),
        renewed: () => undefined,
        sources: (attempt: number): Promise<Inputs> => {
          if (how !== 'PENDING') {
            asked.push({ attempt, workersThen: fake.workers.length, resolve: () => undefined, reject: () => undefined });
            return Promise.resolve(how);
          }
          return new Promise<Inputs>((resolve, reject) => asked.push({ attempt, workersThen: fake.workers.length, resolve, reject }));
        },
      }),
    };
  };
  const startPlans = (fake: { workers: Array<{ commands(type: 'START'): Array<{ attempt: number; plan: ReturnType<typeof capturePlan> }> }> }) => fake.workers.map((worker) => worker.commands(SupervisorMessageType.START)[0]);

  it('SOURCES READY AFTER THE BACK-OFF: no worker is started at the timer; the phase stays RESTARTING with attempt 2; the worker starts in the turn the session settles, with the inputs it gave; the first worker was not asked', async () => {
    const context = await setup();
    const session = sources();
    const plan = capturePlan(SESSION);
    await context.supervisor.start(SESSION, plan, session.attempts(context.fake));
    expect(session.asked).toEqual([]);
    context.fake.last().exit(1);
    context.clock.advance(LIMITS.backoffBaseMs);
    await flush();
    // Asked once, at the timer, while only the first worker had existed; nothing was started.
    expect(session.asked.map((ask) => [ask.attempt, ask.workersThen])).toEqual([[2, 1]]);
    expect(context.fake.workers).toHaveLength(1);
    expect(context.supervisor.status()).toMatchObject({ phase: CapturePhase.RESTARTING, attempt: 2, workerPid: null });
    // However long the session needs: nothing is started, no further timer runs the restart, nothing gives up.
    context.clock.advance(60_000);
    await flush();
    expect(context.fake.workers).toHaveLength(1);
    expect(context.named('workerDown')).toHaveLength(1);
    session.asked[0]!.resolve(inputsOf(plan, '.again'));
    await flush();
    expect(context.fake.workers).toHaveLength(2);
    const second = startPlans(context.fake)[1]!;
    expect(second.attempt).toBe(2);
    expect(second.plan.mics).toEqual(plan.mics.map((mic) => ({ ...mic, input: { kind: 'PCM_FIFO', path: `${mic.input.path}.again` } })));
    expect(context.supervisor.status()).toMatchObject({ phase: CapturePhase.RECORDING, attempt: 2, restarts: 1 });
    expect(context.reports).toEqual([]);
  });

  it('SOURCES READY INSIDE THE BACK-OFF (the session began at RESTARTING): the worker is not started one millisecond before the delay and is started in the turn of the timer - the delays of a row are exactly those of backoffDelayMs, as without the wait', async () => {
    const context = await setup({ maxRestarts: 5 });
    const session = sources();
    const plan = capturePlan(SESSION);
    await context.supervisor.start(SESSION, plan, session.attempts(context.fake, inputsOf(plan)));
    for (let crash = 0; crash < 3; crash += 1) {
      const delay = backoffDelayMs(crash, LIMITS);
      const before = context.fake.workers.length;
      context.fake.last().exit(1);
      expect(context.named('workerDown').at(-1)?.restartInMs).toBe(delay);
      context.clock.advance(delay - 1);
      await flush();
      expect(context.fake.workers).toHaveLength(before);
      expect(session.asked).toHaveLength(crash);
      context.clock.advance(1);
      await flush();
      expect(context.fake.workers).toHaveLength(before + 1);
      expect(context.supervisor.status()).toMatchObject({ phase: CapturePhase.RECORDING, attempt: crash + 2 });
    }
    expect(session.asked.map((ask) => ask.attempt)).toEqual([2, 3, 4]);
    expect(startPlans(context.fake).map((start) => start?.plan.mics)).toEqual([plan.mics, plan.mics, plan.mics, plan.mics]);
  });

  // Task 4 row 191b (3). The microphone-loss watch is told `superseded` from this phase (row 85c: `capture-composition.ts`,
  // `workerSuperseded` = the supervisor's phase is RESTARTING). Row 191 measured when a word about a handle of the earlier attempt can
  // come: the session's close of the handle began 12 to 19 ms after the worker went down, the helper ended 33 to 46 ms after it.
  it('row 191b, THE PHASE THE LOSS WATCH READS AS "superseded": RESTARTING in the turn the worker goes down, at 12, 19, 33 and 46 ms after it, through the whole back-off and for as long as the session\'s sources are waited for beyond it (every close of an earlier handle is inside that wait), until the later worker has acknowledged START; CONTROL: before the down and after the acknowledgement it is not RESTARTING', async () => {
    const context = await setup();
    const session = sources();
    const plan = capturePlan(SESSION);
    await context.supervisor.start(SESSION, plan, session.attempts(context.fake));
    const superseded = (): boolean => context.supervisor.status().phase === CapturePhase.RESTARTING;
    expect(superseded()).toBe(false);
    context.fake.last().exit(1);
    // The same turn: a word that arrives with the exit itself is already of a superseded attempt.
    expect(superseded()).toBe(true);
    let at = 0;
    for (const ms of [12, 19, 33, 46, LIMITS.backoffBaseMs - 1, LIMITS.backoffBaseMs, LIMITS.backoffBaseMs + 16_000]) {
      context.clock.advance(ms - at);
      at = ms;
      await flush();
      expect(superseded(), `${String(ms)} ms after the worker went down`).toBe(true);
    }
    // Two closes held to 8 s each have passed and no later worker exists yet: the handles that are closed meanwhile are of attempt 1.
    expect(context.fake.workers).toHaveLength(1);
    session.asked[0]!.resolve(inputsOf(plan));
    await flush();
    expect(context.fake.workers).toHaveLength(2);
    expect(context.supervisor.status()).toMatchObject({ phase: CapturePhase.RECORDING, attempt: 2 });
    expect(superseded()).toBe(false);
    await context.supervisor.stop(SESSION, 'CRASH');
  });

  it('SOURCES NOT READY: a promise that rejects starts NO worker and is not tried again - FAULTED, one CAPTURE_FAULT, one report that names the cause and no path', async () => {
    const context = await setup();
    const session = sources();
    const plan = capturePlan(SESSION);
    await context.supervisor.start(SESSION, plan, session.attempts(context.fake));
    context.fake.last().exit(1);
    context.clock.advance(LIMITS.backoffBaseMs);
    await flush();
    session.asked[0]!.reject(new Error(`the pipe ${plan.mics[0]!.input.path} could not be made`));
    await flush();
    context.clock.advance(LIMITS.backoffMaxMs * 4);
    await flush();
    expect(context.fake.workers).toHaveLength(1);
    expect(context.supervisor.status()).toMatchObject({ phase: CapturePhase.FAULTED, sessionId: SESSION, workerPid: null });
    expect(context.named('warning')).toMatchObject([{ code: CaptureWarningCode.CAPTURE_FAULT, source: 'supervisor' }]);
    expect(context.named('workerDown').map((event) => `${event.down.code} ${event.restartInMs}`)).toEqual(['EXITED 250', 'SPAWN_FAILED null']);
    expect(context.reports.map((report) => [report.code, (report.err as CaptureSupervisorError).detail])).toEqual([['CAPTURE_SOURCES_NOT_READY', 'RECEIVER_FAILED']]);
    expect(JSON.stringify(context.reports.map((report) => [report.code, (report.err as Error).message]))).not.toContain('.pcm');
    await context.supervisor.stop(SESSION, 'CRASH');
    expect(context.clock.armed()).toEqual([]);
  });

  it('WHICH MICROPHONES THE LATER PLAN HOLDS (D61, 2026-11-04): ALL FOUR CHANNELS - a microphone that is not open again is no plan and no worker (PLAN_INVALID); the renewed plan holds every channel with its own input and its own audio file, and a device that is no microphone of the plan is ignored', async () => {
    const plan = capturePlan(SESSION);
    // D61: the plan of the protocol names FOUR channels (min = max = 4), so a later worker whose session
    // holds three of them starts nothing - the two-role era's "a plan with the PRIMARY alone" is gone with
    // the failover concept. The stranger device is no microphone of the plan and is ignored either way.
    const oneShort = await setup();
    const withStranger = new Map([...inputsOf(plan)].filter(([deviceId]) => deviceId !== 'MIC-04'));
    withStranger.set('MIC-09', { kind: 'PCM_FIFO', path: '/nonexistent/stranger.pcm' });
    await oneShort.supervisor.start(SESSION, plan, sources().attempts(oneShort.fake, withStranger));
    oneShort.fake.last().exit(1);
    oneShort.clock.advance(LIMITS.backoffBaseMs);
    await flush();
    expect(oneShort.fake.workers).toHaveLength(1);
    expect(oneShort.supervisor.status().phase).toBe(CapturePhase.FAULTED);
    expect(oneShort.reports.map((report) => [report.code, (report.err as CaptureSupervisorError).detail])).toEqual([['CAPTURE_SOURCES_NOT_READY', 'PLAN_INVALID']]);

    // All four open again: the later plan holds the four rows, each with the input the session gave for it
    // and the audio file the plan of the start named (D61: `outputPath` survives the renewal).
    const allFour = await setup();
    await allFour.supervisor.start(SESSION, plan, sources().attempts(allFour.fake, new Map([...inputsOf(plan, '.again'), ['MIC-09', { kind: 'PCM_FIFO' as const, path: '/nonexistent/stranger.pcm' }]])));
    allFour.fake.last().exit(1);
    allFour.clock.advance(LIMITS.backoffBaseMs);
    await flush();
    const later = startPlans(allFour.fake)[1]!.plan;
    expect(later.mics.map((mic) => [mic.deviceId, mic.channel, mic.input.path, mic.outputPath])).toEqual(
      plan.mics.map((mic) => [mic.deviceId, mic.channel, `${mic.input.path}.again`, mic.outputPath]),
    );
    expect(allFour.supervisor.status()).toMatchObject({ phase: CapturePhase.RECORDING, attempt: 2 });
    await allFour.supervisor.stop(SESSION, 'STOPPED');
  });

  it('WHILE IT WAITS nothing is held but the phase: a stop ends the session and the sources that become ready afterwards start no worker; a record that makes the session durable calls the restart off', async () => {
    const stopped = await setup();
    const first = sources();
    const plan = capturePlan(SESSION);
    await stopped.supervisor.start(SESSION, plan, first.attempts(stopped.fake));
    stopped.fake.last().exit(1);
    stopped.clock.advance(LIMITS.backoffBaseMs);
    await flush();
    await stopped.supervisor.stop(SESSION, 'STOPPED');
    expect(stopped.supervisor.status().phase).toBe(CapturePhase.IDLE);
    first.asked[0]!.resolve(inputsOf(plan));
    await flush();
    expect(stopped.fake.workers).toHaveLength(1);
    expect(stopped.clock.armed()).toEqual([]);
    // The next session is not served by the promise of the one before it.
    await stopped.supervisor.start('S-TEST-0002', capturePlan('S-TEST-0002'));
    expect(stopped.fake.workers).toHaveLength(2);
    expect(stopped.fake.last().commands(SupervisorMessageType.START)).toMatchObject([{ attempt: 1 }]);

    // A worker the supervisor itself ended (no heartbeat) is still read until its exit: its durable record calls the restart off
    // BEFORE the sources are asked (a worker that has exited says nothing more, so with this double the record cannot arrive
    // inside the wait; the guard of `awaitSources` for that order is read, not driven).
    const durable = await setup({}, { exitOnKill: false });
    const second = sources();
    await durable.supervisor.start(SESSION, plan, second.attempts(durable.fake));
    const dying = durable.fake.last();
    durable.clock.advance(LIMITS.heartbeatTimeoutMs);
    await flush();
    dying.firstDurableFragment('CAM-01');
    dying.exit(null, 'SIGKILL');
    durable.clock.advance(LIMITS.backoffMaxMs * 4);
    await flush();
    expect(durable.supervisor.status()).toMatchObject({ phase: CapturePhase.FAULTED, durable: true });
    expect(second.asked).toEqual([]);
    expect(durable.fake.workers).toHaveLength(1);
  });

  it('CONTROL - a start whose receiver has no `sources` (every caller before this row): the later worker is started in the turn of the timer with the microphones of the plan as given', async () => {
    const context = await setup();
    const plan = capturePlan(SESSION);
    await context.supervisor.start(SESSION, plan, { chance: chance(), renewed: () => undefined });
    context.fake.last().exit(1);
    context.clock.advance(LIMITS.backoffBaseMs);
    expect(context.fake.workers).toHaveLength(2);
    await flush();
    expect(startPlans(context.fake)[1]?.plan.mics).toEqual(plan.mics);
  });
});
