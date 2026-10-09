// Fix round 1 of blueprint row 57 (navigator findings F-1, F-2, F-3, F-4, F-7, F-10; see
// delegation_progress/pair_57_navigator.md). A listener that is slow, stuck or broken must never
// cost the worker its life, the operator a command, or the error log a line.
//
// On a FakeWorkerProcess with manual timers; the same scenarios on a real process are in
// `ipc.test.ts` ("a listener that never returns").
import { CAPTURE_IPC_DEFAULTS, CaptureMicRole, CaptureWarningCode, SupervisorMessageType, type CaptureIpcLimits } from '@dems/capture-protocol';
import { describe, expect, it } from 'vitest';
import { capturePlan, fakeLauncher, flush, manualCaptureTimers, type FakeWorkerBehaviour } from '../../../test/support/capture';
import { CapturePhase, CaptureRefusal, CaptureSupervisorError, WorkerDownCode, createCaptureSupervisor, type CaptureReport } from '../index';

const SESSION = 'S-TEST-0001';
const LIMITS = CAPTURE_IPC_DEFAULTS;
/** A listener that never returns: an engine unit that hangs. */
const never = (): Promise<void> => new Promise<void>(() => {});

async function recording(limits: Partial<CaptureIpcLimits> = {}, behaviour: Partial<FakeWorkerBehaviour> = {}, report?: (entry: CaptureReport) => void) {
  const clock = manualCaptureTimers();
  const fake = fakeLauncher(behaviour);
  const reports: CaptureReport[] = [];
  const supervisor = createCaptureSupervisor({ now: clock.now, timers: clock.timers, launcher: fake.launcher, limits, report: report ?? ((entry) => void reports.push(entry)) });
  await supervisor.boot();
  await supervisor.start(SESSION, capturePlan(SESSION));
  return { clock, fake, supervisor, reports };
}

describe('F-1: back-pressure never hides a sign of life or an acknowledgement', () => {
  it('a healthy worker whose listener is stuck with a full queue is NOT killed: its heartbeats are still read', async () => {
    const { supervisor, fake, clock } = await recording({ eventQueueLimit: 4 });
    supervisor.on('progress', never);
    const worker = fake.last();
    for (let step = 0; step < 12; step += 1) worker.progress(`S${step}`, 0);
    // Ten seconds, four heartbeat timeouts long, beating every 500 ms as a real worker does.
    for (let beat = 0; beat < 20; beat += 1) {
      clock.advance(LIMITS.heartbeatIntervalMs);
      worker.heartbeat();
    }
    expect(worker.kills).toEqual([]);
    expect(fake.workers).toHaveLength(1);
    expect(supervisor.status()).toMatchObject({ phase: CapturePhase.RECORDING, attempt: 1, heartbeatAgeMs: 0, lastCrash: null });
  });

  it('CONTROL: the same worker without heartbeats IS killed, stuck listener or not', async () => {
    const { supervisor, fake, clock } = await recording({ eventQueueLimit: 4 });
    supervisor.on('progress', never);
    for (let step = 0; step < 12; step += 1) fake.last().progress(`S${step}`, 0);
    clock.advance(LIMITS.heartbeatTimeoutMs);
    expect(fake.last().kills).toEqual(['SIGKILL']);
    expect(supervisor.status().lastCrash?.code).toBe(WorkerDownCode.HEARTBEAT_TIMEOUT);
  });

  it('an acknowledgement is read at once behind a full queue: the switch resolves and the plan follows it', async () => {
    const { supervisor, fake, clock } = await recording({ eventQueueLimit: 4 });
    supervisor.on('progress', never);
    for (let step = 0; step < 12; step += 1) fake.last().progress(`S${step}`, 0);
    await expect(supervisor.switchAudioSource(SESSION, CaptureMicRole.STANDBY)).resolves.toBeUndefined();
    // The next worker of the session starts with the source the operator chose.
    fake.last().exit(1);
    clock.advance(LIMITS.backoffBaseMs);
    await flush();
    expect(fake.last().commands(SupervisorMessageType.START)[0]?.plan.activeMic).toBe('STANDBY');
  });
});

describe('F-2: what the supervisor itself reports is not behind the worker\'s events', () => {
  it('worker-down, the phases and CAPTURE_FAULT reach their listeners while a telemetry listener never returns', async () => {
    const { supervisor, fake, clock } = await recording({ maxRestarts: 1 });
    const own: string[] = [];
    supervisor.on('telemetry', never);
    supervisor.on('workerDown', (event) => void own.push(`down ${event.down.code} ${event.restartInMs}`));
    supervisor.on('phase', (event) => void own.push(`phase ${event.phase}`));
    supervisor.on('warning', (event) => void own.push(`warning ${event.code} ${event.source}`));
    fake.last().telemetry(1);
    fake.last().telemetry(2);

    fake.last().exit(1);
    expect(own).toEqual(['down EXITED 250', 'phase RESTARTING']);
    clock.advance(LIMITS.backoffBaseMs);
    await flush();
    fake.last().exit(1);
    expect(own).toEqual(['down EXITED 250', 'phase RESTARTING', 'phase RECORDING', 'down EXITED null', 'warning CAPTURE_FAULT supervisor', 'phase FAULTED']);
  });

  it('a listener of the supervisor\'s own events that never returns holds nobody up either', async () => {
    const { supervisor, fake } = await recording();
    const seen: string[] = [];
    supervisor.on('workerDown', never);
    supervisor.on('workerDown', (event) => void seen.push(event.down.code));
    supervisor.on('phase', (event) => void seen.push(event.phase));
    fake.last().exit(1);
    expect(seen).toEqual(['EXITED', 'RESTARTING']);
  });
});

describe('F-3: STOP always reaches the worker', () => {
  it('with the command window full of unacknowledged commands, STOP is still written and the worker ends by itself', async () => {
    const { supervisor, fake } = await recording({ commandQueueLimit: 2 }, { ackSwitch: false });
    const worker = fake.last();
    const waiting = [1, 2].map(() => supervisor.switchAudioSource(SESSION, CaptureMicRole.STANDBY).catch((error: unknown) => (error as CaptureSupervisorError).code));
    await flush();
    // Control: the window IS full for every other command.
    await expect(supervisor.switchAudioSource(SESSION, CaptureMicRole.STANDBY)).rejects.toMatchObject({ code: CaptureRefusal.BACKPRESSURE });

    await supervisor.stop(SESSION, 'STOPPED');
    expect(worker.commands(SupervisorMessageType.STOP)).toHaveLength(1);
    expect(worker.kills).toEqual([]);
    expect(worker.exited).toBe(true);
    expect(await Promise.all(waiting)).toEqual([CaptureRefusal.WORKER_DOWN, CaptureRefusal.WORKER_DOWN]);
  });
});

describe('F-4: eventQueueLimit is a hard bound', () => {
  it('the queue never holds more than the limit, whatever the worker writes; what is superseded or evicted is counted and reported once', async () => {
    const { supervisor, fake, reports } = await recording({ eventQueueLimit: 4 });
    const delivered: string[] = [];
    let release: () => void = () => {};
    supervisor.on('progress', (event) => {
      delivered.push(`P${event.frame.step}:${event.frame.progress}`);
      if (delivered.length === 1) return new Promise<void>((resolve) => (release = resolve));
      return undefined;
    });
    supervisor.on('telemetry', (event) => void delivered.push(`T${event.frame.fragments[0]?.count}`));
    supervisor.on('warning', (event) => void delivered.push(`W${event.subject}`));
    const worker = fake.last();
    let most = 0;
    const say = (act: () => void): void => {
      act();
      most = Math.max(most, supervisor.status().queuedEvents);
    };

    say(() => worker.progress('A', 0)); // with the listener, which holds it
    say(() => worker.progress('B', 0.1));
    say(() => worker.progress('B', 0.2)); // the same step: the newer value replaces the waiting one
    say(() => worker.telemetry(1));
    say(() => worker.telemetry(2)); // replaces telemetry 1
    say(() => worker.warning(CaptureWarningCode.MIC_SILENT, 'PRIMARY'));
    say(() => worker.warning(CaptureWarningCode.MIC_SILENT, 'PRIMARY')); // the same warning, still waiting: said once
    say(() => worker.progress('C', 0));
    // Full: [B, T2, W, C]. Telemetry is the first to go, then the oldest progress; a warning stays.
    expect(supervisor.status()).toMatchObject({ queuedEvents: 4, droppedTelemetry: 1, droppedEvents: 2 });
    say(() => worker.progress('D', 0)); // evicts T2
    say(() => worker.progress('E', 0)); // evicts B
    say(() => worker.telemetry(3)); // no room and nothing less important: dropped itself
    for (let step = 0; step < 500; step += 1) say(() => worker.progress(`X${step}`, 0));
    expect(most).toBe(4);
    expect(supervisor.status().queuedEvents).toBe(4);
    expect(supervisor.status()).toMatchObject({ droppedTelemetry: 3, droppedEvents: 2 + 1 + 500 });
    expect(reports.filter((entry) => entry.code === 'CAPTURE_EVENT_OVERFLOW')).toHaveLength(1);
    expect(reports[0]).toMatchObject({ source: 'capture.supervisor.events', sessionId: SESSION });

    release();
    await flush();
    // The warning survived all of it; the newest three steps did too.
    expect(delivered).toEqual(['PA:0', 'WPRIMARY', 'PX497:0', 'PX498:0', 'PX499:0']);
    expect(supervisor.status().queuedEvents).toBe(0);
  });

  it('CONTROL: below the limit nothing is evicted and nothing is reported', async () => {
    const { supervisor, fake, reports } = await recording({ eventQueueLimit: 4 });
    supervisor.on('progress', never);
    for (let step = 0; step < 5; step += 1) fake.last().progress(`S${step}`, 0);
    expect(supervisor.status()).toMatchObject({ queuedEvents: 4, droppedEvents: 0, droppedTelemetry: 0 });
    expect(reports).toEqual([]);
  });
});

// Blueprint row 58 (decision D67, option C per OD-08; spec §B.2 "Restart rule"). Until row 58 this
// block was titled "a restart inside a session (what the worker is told; what it does with the
// file is not decided)". It is decided now, and this pin holds for its real scope only: BEFORE the
// first durable fragment. Its sibling, after the durable record, stands below it.
describe('F-7 / M3-KC-3: a restart inside a session, BEFORE the first durable fragment', () => {
  it('the restarted worker gets the SAME output paths with a higher attempt, so it can tell a restart from a first start (the fake reported no fragment)', async () => {
    const { fake, clock } = await recording();
    const first = fake.last().commands(SupervisorMessageType.START)[0];
    fake.last().exit(null, 'SIGSEGV');
    clock.advance(LIMITS.backoffBaseMs);
    await flush();
    const second = fake.last().commands(SupervisorMessageType.START)[0];
    expect([first?.attempt, second?.attempt]).toEqual([1, 2]);
    expect(second?.plan.cameras.map((camera) => camera.outputPath)).toEqual(first?.plan.cameras.map((camera) => camera.outputPath));
  });
});

describe('F-7 / M3-KC-3 sibling: a crash AFTER the durable record (option C)', () => {
  it('the session goes to FAULTED, the launcher is NOT called again, CAPTURE_FAULT is raised once, and the session stays open for the interrupted seal', async () => {
    const { supervisor, fake, clock } = await recording();
    const seen: string[] = [];
    supervisor.on('workerDown', (event) => void seen.push(`down ${event.down.code} ${event.restartInMs}`));
    supervisor.on('warning', (event) => void seen.push(`warning ${event.code} ${event.source}`));
    supervisor.on('phase', (event) => void seen.push(`phase ${event.phase}`));
    fake.last().firstDurableFragment('CAM-01');
    expect(supervisor.status()).toMatchObject({ durable: true, lastRecordSeq: 1, phase: CapturePhase.RECORDING });

    fake.last().exit(null, 'SIGSEGV');
    // Every back-off there could be, and more: nothing is armed and nothing starts.
    expect(clock.armed()).toEqual([]);
    clock.advance(LIMITS.backoffMaxMs * 10);
    await flush();
    expect(fake.calls()).toBe(1);
    expect(fake.workers).toHaveLength(1);
    expect(seen).toEqual(['down EXITED null', 'warning CAPTURE_FAULT supervisor', 'phase FAULTED']);
    expect(supervisor.status()).toMatchObject({ phase: CapturePhase.FAULTED, sessionId: SESSION, workerPid: null, restarts: 0, attempt: 1, durable: true });
    await supervisor.stop(SESSION, 'CRASH');
    expect(supervisor.status()).toMatchObject({ phase: CapturePhase.IDLE, sessionId: null, durable: false, lastRecordSeq: 0 });
  });

  it('CONTROL: the same crash WITHOUT a durable record is restarted, so the test above measures the record', async () => {
    const { supervisor, fake, clock } = await recording();
    fake.last().exit(null, 'SIGSEGV');
    clock.advance(LIMITS.backoffBaseMs);
    await flush();
    expect(fake.calls()).toBe(2);
    expect(supervisor.status()).toMatchObject({ phase: CapturePhase.RECORDING, attempt: 2, durable: false });
  });

  it('a heartbeat timeout and a protocol violation after the durable record end FAULTED as well: no cause restarts into an evidence file', async () => {
    for (const act of [
      (context: Awaited<ReturnType<typeof recording>>) => context.clock.advance(LIMITS.heartbeatTimeoutMs),
      (context: Awaited<ReturnType<typeof recording>>) => context.fake.last().violate('FRAME_NOT_JSON'),
    ]) {
      const context = await recording();
      context.fake.last().firstDurableFragment('CAM-02');
      act(context);
      context.clock.advance(LIMITS.backoffMaxMs * 10);
      await flush();
      expect(context.fake.calls()).toBe(1);
      expect(context.supervisor.status().phase).toBe(CapturePhase.FAULTED);
    }
  });

  it('the file is the truth: a restarted worker that finds a file at its output path refuses START with OUTPUT_EXISTS; the session is durable, FAULTED, and no third worker starts', async () => {
    const { supervisor, fake, clock } = await recording();
    const faults: string[] = [];
    supervisor.on('warning', (event) => void faults.push(event.code));
    // The first worker wrote a fragment and died before its record reached the supervisor.
    fake.last().exit(null, 'SIGKILL');
    fake.behaviour.ackStart = 'OUTPUT_EXISTS';
    clock.advance(LIMITS.backoffBaseMs);
    await flush();
    expect(fake.calls()).toBe(2);
    expect(supervisor.status()).toMatchObject({ phase: CapturePhase.FAULTED, durable: true, sessionId: SESSION });
    expect(supervisor.status().lastCrash).toMatchObject({ code: WorkerDownCode.START_REFUSED, detail: 'OUTPUT_EXISTS', attempt: 2 });
    clock.advance(LIMITS.backoffMaxMs * 10);
    await flush();
    expect(fake.calls()).toBe(2);
    expect(faults).toEqual(['CAPTURE_FAULT']);
  });

  it('CONTROL: any other refusal of START by a restarted worker IS retried', async () => {
    const { supervisor, fake, clock } = await recording();
    fake.last().exit(1);
    fake.behaviour.ackStart = 'NO_DEVICE';
    clock.advance(LIMITS.backoffBaseMs);
    await flush();
    expect(supervisor.status()).toMatchObject({ phase: CapturePhase.RESTARTING, durable: false, restarts: 2 });
  });
});

describe('F-10: a report that throws', () => {
  it('does not become an unhandled rejection, and the other listeners still get the event', async () => {
    const unhandled: unknown[] = [];
    const onUnhandled = (reason: unknown): void => void unhandled.push(reason);
    process.on('unhandledRejection', onUnhandled);
    try {
      const { supervisor, fake } = await recording({}, {}, () => {
        throw new Error('the error log is not writable');
      });
      const seen: number[] = [];
      supervisor.on('telemetry', () => {
        throw new Error('listener failed');
      });
      supervisor.on('telemetry', (event) => void seen.push(event.frame.fragments[0]?.count ?? -1));
      fake.last().telemetry(1);
      fake.last().telemetry(2);
      await flush();
      await flush();
      expect(seen).toEqual([1, 2]);
      expect(unhandled).toEqual([]);
    } finally {
      process.off('unhandledRejection', onUnhandled);
    }
  });
});
