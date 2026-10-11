// The process channel and the supervisor on a REAL child process (blueprint row 57 / M3-W1;
// capture spec §A.3, §B.2). What only an operating-system process can prove:
//
//   - a worker that is KILLED is started again under the supervisor, as another process;
//   - a worker that is FROZEN (stopped, not dead) is found by its heartbeat, killed and replaced;
//   - the worker does not inherit the server's environment;
//   - a worker ends when its input ends (no orphan), and a server that exits kills its worker.
//
// THE WORKER HERE IS A STAND-IN: `test/support/capture-stub-worker.mjs`, a Node script that speaks
// the protocol and records nothing. No port is opened and no file is written. The real worker is
// `apps/capture-worker` (rows 111 and 58).
//
// These tests wait in real time (system timers, the system clock), with short limits and long
// allowances; the rules themselves are tested without waiting in `supervisor.test.ts`.
//
// LOAD-SENSITIVE BY DESIGN (test/14 consolidation, core-server unit, open items; row 97): the waits
// are on real processes and on the 600 ms heartbeat of a real child, so on a starved host (a
// 1-minute load of about 100 was measured) a stand-in worker can miss its heartbeat and a case
// fails; at a load below 8 the file passes. That is the host, not the supervisor: the allowances
// are not raised, and a red of this file is read against the load of the run first.
import { spawn } from 'node:child_process';
import { CaptureWarningCode, type CaptureIpcLimits, type WorkerMessage } from '@dems/capture-protocol';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { STUB_WORKER, capturePlan } from '../../../test/support/capture';
import {
  CapturePhase,
  CaptureRefusal,
  CaptureSupervisorError,
  WorkerDownCode,
  createCaptureSupervisor,
  createProcessLauncher,
  createSystemTimers,
  type CaptureEvent,
  type CaptureSupervisor,
  type ProcessLauncherOptions,
  type WorkerExit,
} from '../index';

const SESSION = 'S-REAL-0001';
const TEST_TIMEOUT_MS = 30_000;
const WAIT = { timeout: 15_000, interval: 20 };
/** Short limits: the stub's heartbeat is every 50 ms. */
const FAST: Partial<CaptureIpcLimits> = { helloTimeoutMs: 4_000, ackTimeoutMs: 4_000, heartbeatTimeoutMs: 600, stopGraceMs: 2_000, backoffBaseMs: 50, backoffMaxMs: 200 };

/** True while the operating system knows the process. */
function alive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

const open: CaptureSupervisor[] = [];
afterEach(async () => {
  for (const supervisor of open.splice(0)) await supervisor.shutdown();
});

async function realSupervisor(limits: Partial<CaptureIpcLimits> = {}, launcher: Partial<ProcessLauncherOptions> = {}) {
  const supervisor = createCaptureSupervisor({
    now: () => Date.now(),
    timers: createSystemTimers(),
    launcher: createProcessLauncher({ command: process.execPath, args: [STUB_WORKER], ...launcher }),
    limits: { ...FAST, ...limits },
  });
  open.push(supervisor);
  const events: CaptureEvent[] = [];
  for (const name of ['warning', 'workerDown', 'phase'] as const) supervisor.on(name, (event) => void events.push(event));
  await supervisor.boot();
  const downs = () => events.filter((event): event is Extract<CaptureEvent, { name: 'workerDown' }> => event.name === 'workerDown');
  return { supervisor, events, downs };
}

function pidOf(supervisor: CaptureSupervisor): number {
  const pid = supervisor.status().workerPid;
  if (pid === null) throw new Error('no worker process');
  return pid;
}

describe('a real worker process under the supervisor', () => {
  it('starts, is alive as a process of its own, and exits by itself on STOP', async () => {
    const { supervisor, downs } = await realSupervisor();
    await supervisor.start(SESSION, capturePlan(SESSION));
    const pid = pidOf(supervisor);
    expect(pid).not.toBe(process.pid);
    expect(alive(pid)).toBe(true);
    expect(supervisor.status().phase).toBe(CapturePhase.RECORDING);
    await supervisor.stop(SESSION, 'STOPPED');
    expect(supervisor.status()).toMatchObject({ phase: CapturePhase.IDLE, workerPid: null, lastCrash: null });
    expect(downs()).toEqual([]);
    await vi.waitFor(() => expect(alive(pid)).toBe(false), WAIT);
  }, TEST_TIMEOUT_MS);

  it('a KILLED worker is started again: another process, the same session, recording again', async () => {
    const { supervisor, downs } = await realSupervisor();
    await supervisor.start(SESSION, capturePlan(SESSION));
    const first = pidOf(supervisor);

    process.kill(first, 'SIGKILL');

    await vi.waitFor(() => expect(supervisor.status()).toMatchObject({ phase: CapturePhase.RECORDING, attempt: 2 }), WAIT);
    const second = pidOf(supervisor);
    expect(second).not.toBe(first);
    expect([alive(first), alive(second)]).toEqual([false, true]);
    expect(downs()).toMatchObject([{ sessionId: SESSION, down: { code: WorkerDownCode.EXITED, signal: 'SIGKILL', exitCode: null, attempt: 1 }, restartInMs: 50 }]);
    expect(supervisor.status()).toMatchObject({ sessionId: SESSION, restarts: 1 });

    // And again: the supervisor keeps doing it.
    process.kill(second, 'SIGKILL');
    await vi.waitFor(() => expect(supervisor.status()).toMatchObject({ phase: CapturePhase.RECORDING, attempt: 3 }), WAIT);
    expect(alive(pidOf(supervisor))).toBe(true);
    await supervisor.stop(SESSION, 'STOPPED');
  }, TEST_TIMEOUT_MS);

  // Blueprint row 58 (decision D67, option C): the same kill, on a real process that reported a
  // durable fragment. The "KILLED worker is started again" above holds BEFORE that report only.
  it('a KILLED worker that reported its first durable fragment is NOT started again: FAULTED, one CAPTURE_FAULT, no process, restarts allowed or not', async () => {
    const { supervisor, events, downs } = await realSupervisor({}, { args: [STUB_WORKER, '--durable'] });
    await supervisor.start(SESSION, capturePlan(SESSION));
    // Record 1 is the stub's interval of the start (fix pass F-M5: it speaks the audio source as the worker does); record 2 the durable fragment.
    await vi.waitFor(() => expect(supervisor.status()).toMatchObject({ durable: true, lastRecordSeq: 2 }), WAIT);
    const first = pidOf(supervisor);
    process.kill(first, 'SIGKILL');
    await vi.waitFor(() => expect(supervisor.status().phase).toBe(CapturePhase.FAULTED), WAIT);
    // Longer than any back-off of this test (50 to 200 ms): nothing comes back.
    await new Promise((resolve) => setTimeout(resolve, 500));
    expect(supervisor.status()).toMatchObject({ phase: CapturePhase.FAULTED, workerPid: null, attempt: 1, restarts: 0, durable: true });
    expect(alive(first)).toBe(false);
    expect(downs()).toMatchObject([{ down: { code: WorkerDownCode.EXITED, signal: 'SIGKILL', attempt: 1 }, restartInMs: null }]);
    expect(events.filter((event) => event.name === 'warning')).toMatchObject([{ code: CaptureWarningCode.CAPTURE_FAULT, source: 'supervisor' }]);
    await supervisor.stop(SESSION, 'CRASH');
  }, TEST_TIMEOUT_MS);

  it('CONTROL: with no restart allowed, a killed worker is NOT started again: FAULTED, CAPTURE_FAULT, no process', async () => {
    const { supervisor, events, downs } = await realSupervisor({ maxRestarts: 0 });
    await supervisor.start(SESSION, capturePlan(SESSION));
    const first = pidOf(supervisor);
    process.kill(first, 'SIGKILL');
    await vi.waitFor(() => expect(supervisor.status().phase).toBe(CapturePhase.FAULTED), WAIT);
    // Longer than any back-off of this test: nothing comes back.
    await new Promise((resolve) => setTimeout(resolve, 500));
    expect(supervisor.status()).toMatchObject({ phase: CapturePhase.FAULTED, workerPid: null, attempt: 1 });
    expect(alive(first)).toBe(false);
    expect(downs()).toMatchObject([{ restartInMs: null }]);
    expect(events.filter((event) => event.name === 'warning')).toMatchObject([{ code: CaptureWarningCode.CAPTURE_FAULT, source: 'supervisor' }]);
  }, TEST_TIMEOUT_MS);

  it('a FROZEN worker (stopped, still a process) is found by its heartbeat, killed and replaced', async () => {
    const { supervisor, downs } = await realSupervisor();
    await supervisor.start(SESSION, capturePlan(SESSION));
    const first = pidOf(supervisor);
    // Control: left alone for longer than the heartbeat timeout, it is not touched.
    await new Promise((resolve) => setTimeout(resolve, 1_500));
    expect([pidOf(supervisor), downs().length, alive(first)]).toEqual([first, 0, true]);

    process.kill(first, 'SIGSTOP');

    await vi.waitFor(() => expect(supervisor.status()).toMatchObject({ phase: CapturePhase.RECORDING, attempt: 2 }), WAIT);
    expect(downs()).toMatchObject([{ down: { code: WorkerDownCode.HEARTBEAT_TIMEOUT, attempt: 1 } }]);
    expect(pidOf(supervisor)).not.toBe(first);
    await vi.waitFor(() => expect(alive(first)).toBe(false), WAIT);
    await supervisor.stop(SESSION, 'STOPPED');
  }, TEST_TIMEOUT_MS);

  it('a program that does not exist is an unstartable worker: start is refused with CAPTURE_FAULT', async () => {
    const { supervisor, downs } = await realSupervisor({ maxRestarts: 2 }, { command: '/nonexistent/dems/capture-worker', args: [] });
    const error = await supervisor.start(SESSION, capturePlan(SESSION)).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(CaptureSupervisorError);
    expect(error).toMatchObject({ code: CaptureRefusal.FAULT, detail: WorkerDownCode.SPAWN_FAILED });
    expect(downs().map((event) => event.down.code)).toEqual([WorkerDownCode.SPAWN_FAILED, WorkerDownCode.SPAWN_FAILED, WorkerDownCode.SPAWN_FAILED]);
    expect(supervisor.status()).toMatchObject({ phase: CapturePhase.IDLE, sessionId: null, workerPid: null });
  }, TEST_TIMEOUT_MS);

  it('a worker that writes a line that is no frame is ended (protocol violation)', async () => {
    const { supervisor, downs } = await realSupervisor({ maxRestarts: 0 }, { args: [STUB_WORKER, '--garbage'] });
    const error = await supervisor.start(SESSION, capturePlan(SESSION)).catch((caught: unknown) => caught);
    expect(error).toMatchObject({ code: CaptureRefusal.FAULT, detail: WorkerDownCode.PROTOCOL_VIOLATION });
    expect(downs()).toMatchObject([{ down: { code: WorkerDownCode.PROTOCOL_VIOLATION, detail: 'FRAME_NOT_JSON' } }]);
  }, TEST_TIMEOUT_MS);
});

// Fix pass F-M5 (review R74-17, carried question 1): the process stub answers a switch AS THE REAL
// WORKER DOES - the `AUDIO_SOURCE_INTERVAL` record of the switch BEFORE its `ACK` - so a test through
// it exercises the real path of operation 81 (it used to acknowledge with no record: `SWITCH_NOT_REALISED`).
describe('the stub speaks the switch of protocol 4 as the worker does', () => {
  it('the interval of the start at T0; a switch resolves with the record of the microphone that now feeds the track; the role that feeds it already: no record; the end of the timeline at STOP', async () => {
    const { supervisor } = await realSupervisor();
    const records: CaptureEvent[] = [];
    supervisor.on('record', (event) => void records.push(event));
    const plan = capturePlan(SESSION);
    await supervisor.start(SESSION, plan);
    const standby = plan.mics.find((mic) => mic.role === 'STANDBY');
    const primary = plan.mics.find((mic) => mic.role === 'PRIMARY');
    const kinds = () => records.map((event) => (event.name === 'record' ? `${event.record.kind}${'reason' in event.record ? `:${String(event.record.reason)}` : ''}` : ''));
    await vi.waitFor(() => expect(kinds()).toEqual(['AUDIO_SOURCE_INTERVAL:SESSION_START']), WAIT);
    const first = await supervisor.switchAudioSource(SESSION, 'STANDBY');
    expect(first).toMatchObject({ kind: 'AUDIO_SOURCE_INTERVAL', deviceId: standby?.deviceId, role: 'STANDBY', index: 2, reason: 'OPERATOR_SWITCH', sampleRateHz: 48_000 });
    expect((first?.fromSample ?? 1) % 480).toBe(0);
    expect(first?.correlationId).not.toBeNull();
    // The role that feeds the track already: acknowledged, NO record (the worker's rule, `audio.c`).
    await expect(supervisor.switchAudioSource(SESSION, 'STANDBY')).resolves.toBeNull();
    const back = await supervisor.switchAudioSource(SESSION, 'PRIMARY');
    expect(back).toMatchObject({ deviceId: primary?.deviceId, role: 'PRIMARY', index: 3 });
    expect(back?.fromSample ?? 0).toBeGreaterThanOrEqual(first?.fromSample ?? 0);
    await supervisor.stop(SESSION, 'STOPPED');
    expect(kinds()).toEqual(['AUDIO_SOURCE_INTERVAL:SESSION_START', 'AUDIO_SOURCE_INTERVAL:OPERATOR_SWITCH', 'AUDIO_SOURCE_INTERVAL:OPERATOR_SWITCH', 'AUDIO_TIMELINE_END']);
    expect(supervisor.status()).toMatchObject({ phase: CapturePhase.IDLE, lastCrash: null });
  }, TEST_TIMEOUT_MS);
});

describe('a listener that never returns, on a real process (navigator findings F-1, F-2, F-4)', () => {
  it('2 000 events against a stuck listener: the worker lives on, the queue stays at its limit, commands and STOP still work', async () => {
    const { supervisor, downs } = await realSupervisor({ eventQueueLimit: 8 }, { args: [STUB_WORKER, '--flood=2000'] });
    supervisor.on('progress', () => new Promise<void>(() => {}));
    await supervisor.start(SESSION, capturePlan(SESSION));
    const pid = pidOf(supervisor);
    // More than four heartbeat timeouts (600 ms each).
    await new Promise((resolve) => setTimeout(resolve, 2_600));
    expect(supervisor.status()).toMatchObject({ phase: CapturePhase.RECORDING, attempt: 1, workerPid: pid, lastCrash: null });
    expect(alive(pid)).toBe(true);
    expect(downs()).toEqual([]);
    expect(supervisor.status().queuedEvents).toBeLessThanOrEqual(8);
    expect(supervisor.status().heartbeatAgeMs).toBeLessThan(600);
    await expect(supervisor.switchAudioSource(SESSION, 'STANDBY')).resolves.toMatchObject({ kind: 'AUDIO_SOURCE_INTERVAL', role: 'STANDBY', reason: 'OPERATOR_SWITCH' }); // F-M5: the stub writes the record of a switch before its ACK (it was `null`)
    await supervisor.stop(SESSION, 'STOPPED');
    expect(supervisor.status()).toMatchObject({ phase: CapturePhase.IDLE, lastCrash: null });
  }, TEST_TIMEOUT_MS);

  it('a killed worker is reported at once to the supervisor\'s own listeners although the progress listener is stuck', async () => {
    const { supervisor, downs } = await realSupervisor({ eventQueueLimit: 8 }, { args: [STUB_WORKER, '--flood=50'] });
    supervisor.on('progress', () => new Promise<void>(() => {}));
    await supervisor.start(SESSION, capturePlan(SESSION));
    process.kill(pidOf(supervisor), 'SIGKILL');
    await vi.waitFor(() => expect(supervisor.status()).toMatchObject({ phase: CapturePhase.RECORDING, attempt: 2 }), WAIT);
    expect(downs()).toMatchObject([{ down: { code: WorkerDownCode.EXITED, signal: 'SIGKILL' } }]);
    await supervisor.stop(SESSION, 'STOPPED');
  }, TEST_TIMEOUT_MS);
});

describe('what a worker is given', () => {
  const MARKER = 'DEMS_ROW57_ENV_MARKER';

  afterEach(() => {
    delete process.env[MARKER];
  });

  it('not the server\'s environment: a variable of this process is invisible to the worker', async () => {
    process.env[MARKER] = 'present-in-the-server';
    const { supervisor } = await realSupervisor();
    await expect(supervisor.start(SESSION, capturePlan(SESSION))).resolves.toBeUndefined();
    await supervisor.stop(SESSION, 'STOPPED');
  }, TEST_TIMEOUT_MS);

  it('CONTROL: a worker that IS handed the variable refuses to start, so the test above can fail', async () => {
    const { supervisor, downs } = await realSupervisor({ maxRestarts: 0 }, { env: { [MARKER]: 'handed-over' } });
    const error = await supervisor.start(SESSION, capturePlan(SESSION)).catch((caught: unknown) => caught);
    expect(error).toMatchObject({ code: CaptureRefusal.FAULT, detail: WorkerDownCode.START_REFUSED });
    expect(downs()).toMatchObject([{ down: { detail: 'ENV_LEAK' } }]);
  }, TEST_TIMEOUT_MS);
});

describe('no orphan', () => {
  /** One raw channel on the stub, with what it reported. */
  function rawChannel() {
    const messages: WorkerMessage[] = [];
    let exit: WorkerExit | null = null;
    const channel = createProcessLauncher({ command: process.execPath, args: [STUB_WORKER] })(
      { sessionId: SESSION, correlationId: 'raw', attempt: 1 },
      { message: (message) => void messages.push(message), violation: () => {}, exit: (ended) => (exit = ended) },
    );
    return { channel, messages, exit: () => exit };
  }

  it('a worker ends by itself when its input ends', async () => {
    const { channel, messages, exit } = rawChannel();
    await vi.waitFor(() => expect(messages[0]).toMatchObject({ type: 'HELLO', protocolVersion: 4 }), WAIT);
    const pid = channel.pid ?? -1;
    expect(alive(pid)).toBe(true);
    channel.closeInput();
    await vi.waitFor(() => expect(exit()).toEqual({ exitCode: 0, signal: null, spawnFailed: false }), WAIT);
    expect(alive(pid)).toBe(false);
  }, TEST_TIMEOUT_MS);

  it('CONTROL: with its input open it keeps running', async () => {
    const { channel, messages, exit } = rawChannel();
    await vi.waitFor(() => expect(messages.filter((message) => message.type === 'HEARTBEAT').length).toBeGreaterThan(10), WAIT);
    expect([exit(), alive(channel.pid ?? -1)]).toEqual([null, true]);
    channel.kill('SIGKILL');
    await vi.waitFor(() => expect(exit()).toMatchObject({ signal: 'SIGKILL' }), WAIT);
  }, TEST_TIMEOUT_MS);

  /**
   * A small server of its own: it starts the stub through the real launcher, prints the worker's
   * process ID, and then either exits (`process.exit`, as the entry point's `fatal` does) or waits
   * to be killed. The stub is told to IGNORE the end of its input, so that only the exit handler
   * of `ipc.ts` can end it: the end of the pipe proves nothing here.
   */
  function smallServer(then: 'exit' | 'wait') {
    const script = [
      "import { createProcessLauncher } from './src/capture/index.ts';",
      `const channel = createProcessLauncher({ command: process.execPath, args: [${JSON.stringify(STUB_WORKER)}, '--ignore-eof'] })(`,
      "  { sessionId: 'S', correlationId: 'c', attempt: 1 },",
      `  { message: (message) => { if (message.type !== 'HELLO') return; process.stdout.write(String(channel.pid) + '\\n'); ${then === 'exit' ? 'process.exit(0);' : ''} }, violation: () => {}, exit: () => {} },`,
      ');',
    ].join('\n');
    const workspace = new URL('../../../', import.meta.url);
    const server = spawn(process.execPath, ['--import', 'tsx', '--input-type=module', '--eval', script], { cwd: workspace, env: { PATH: process.env['PATH'] ?? '' }, stdio: ['ignore', 'pipe', 'inherit'] });
    let printed = '';
    server.stdout.setEncoding('utf8');
    server.stdout.on('data', (chunk: string) => (printed += chunk));
    const closed = new Promise<{ code: number | null; signal: string | null }>((resolve) => server.on('close', (code, signal) => resolve({ code, signal })));
    const workerPid = async (): Promise<number> => {
      await vi.waitFor(() => expect(printed).toMatch(/^\d+\n/), WAIT);
      return Number(printed);
    };
    return { server, closed, workerPid };
  }

  it('a server process that exits kills its worker in the exit handler, even a worker that ignores the end of its input', async () => {
    const { closed, workerPid } = smallServer('exit');
    const pid = await workerPid();
    expect(await closed).toEqual({ code: 0, signal: null });
    await vi.waitFor(() => expect(alive(pid)).toBe(false), WAIT);
  }, TEST_TIMEOUT_MS);

  it('CONTROL: a server that is killed outright runs no handler, and that same worker lives on (the limit of the handler)', async () => {
    const { server, closed, workerPid } = smallServer('wait');
    const pid = await workerPid();
    server.kill('SIGKILL');
    expect(await closed).toEqual({ code: null, signal: 'SIGKILL' });
    await new Promise((resolve) => setTimeout(resolve, 700));
    try {
      // Still there: only a worker that keeps the end-of-input rule ends in this case.
      expect(alive(pid)).toBe(true);
    } finally {
      process.kill(pid, 'SIGKILL');
    }
    await vi.waitFor(() => expect(alive(pid)).toBe(false), WAIT);
  }, TEST_TIMEOUT_MS);
});
