// The capture supervisor on a FakeWorkerProcess, manual timers and a manual clock (blueprint row
// 57 / M3-W1; capture spec §A.3, §B.2; checks M3-KC-3 and M3-KC-1 of masterplan/10_test_strategy).
//
// Nothing here starts a process, listens on a port or waits in real time. The same supervisor on
// a REAL child process is `ipc.test.ts`.
//
// EVERY RULE HAS ITS CONTROL: beside each "it restarts / it refuses / it drops" stands the case
// in which the same measurement must read the opposite (a worker that keeps its heartbeat is NOT
// restarted, a fake that is reused DOES refuse, a listener that keeps up loses NOTHING).
import { CAPTURE_IPC_DEFAULTS, CaptureMicRole, CaptureWarningCode, FrameViolation, SupervisorMessageType, backoffDelayMs, type CaptureIpcLimits } from '@dems/capture-protocol';
import { describe, expect, it } from 'vitest';
import { capturePlan, fakeLauncher, flush, manualCaptureTimers, type FakeWorkerBehaviour } from '../../../test/support/capture';
import { CapturePhase, CaptureRefusal, CaptureSupervisorError, WorkerDownCode, createCaptureSupervisor, type CaptureEvent, type CaptureReport } from '../index';

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
    expect(start).toMatchObject({ v: 3, sessionId: SESSION, attempt: 1, plan: capturePlan(SESSION) });
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
    expect(await refusalOf(supervisor.start(SESSION, { ...plan, activeMic: CaptureMicRole.STANDBY, mics: [plan.mics[0]!] }))).toBe(`${CaptureRefusal.PLAN_INVALID}/activeMic`);
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
    await expect(supervisor.stop(SESSION, 'STOPPED')).resolves.toBeUndefined();
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
      ['SESSION_MISMATCH', (worker) => worker.say({ type: 'WARNING', code: 'MIC_SILENT', state: 'ACTIVE', subject: null }, 'S-ANOTHER')],
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
    expect(commands.map((command) => `${command.type} ${command.correlationId}`)).toEqual([
      `START ${session}:1`,
      `SWITCH_AUDIO_SOURCE ${session}:2`,
      `START ${session}:3`,
      `STOP ${session}:4`,
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
    expect(fake.last().commands(SupervisorMessageType.START)[0]?.plan.activeMic).toBe('STANDBY');
  });

  it('a MIC_SILENT warning is handed on as a warning and sends NO command to the worker', async () => {
    const { fake, named } = await recording();
    const before = fake.last().received.length;
    fake.last().warning(CaptureWarningCode.MIC_SILENT, 'PRIMARY');
    await flush();
    expect(named('warning')).toMatchObject([{ code: 'MIC_SILENT', subject: 'PRIMARY', source: 'worker', action: 'raiseCaptureWarning' }]);
    expect(fake.last().received).toHaveLength(before);
  });

  it('is refused when nothing records, for an unknown session, for a role no mic holds, and when it is not acknowledged in time', async () => {
    const idle = await setup();
    expect(await refusalOf(idle.supervisor.switchAudioSource(SESSION, CaptureMicRole.STANDBY))).toBe(CaptureRefusal.SESSION_UNKNOWN);

    const one = await setup();
    const plan = capturePlan();
    await one.supervisor.start(SESSION, { ...plan, mics: [plan.mics[0]!] });
    expect(await refusalOf(one.supervisor.switchAudioSource(SESSION, CaptureMicRole.STANDBY))).toBe(CaptureRefusal.PLAN_INVALID);

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
