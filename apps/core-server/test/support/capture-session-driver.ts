/**
 * The REAL capture supervisor on the REAL capture worker, as a process a harness can drive
 * (blueprint row 58 / M3-W2, part P6; not a test file and not production code).
 *
 * `apps/capture-worker/test/m3worker.py sup ...` starts this file with `npx tsx`, hands it the
 * worker command in a JSON file, and then writes one JSON command per line on standard input:
 *
 *   {"cmd":"start","sessionId":"...","plan":{...}}   supervisor.start
 *   {"cmd":"stop","sessionId":"...","reason":"STOPPED"}
 *   {"cmd":"switch","sessionId":"...","to":"STANDBY"}
 *   {"cmd":"status"}
 *   {"cmd":"exit"}                                     supervisor.shutdown, then the process ends
 *
 * Every event of the supervisor leaves as one JSON line on standard output. The supervisor is the
 * production one: `createCaptureSupervisor` with the process launcher of `ipc.ts` (empty
 * environment, no shell), the system timers and the wall clock. Nothing is faked here; only the
 * devices behind the worker are (the harness starts fake cameras and fake mics).
 *
 * It also MEASURES what the supervisor's timing defaults were guessed for (decision D57-4): the
 * time from the launch of a worker to its HELLO, the intervals between heartbeats as they arrive,
 * and the time from STOP to the exit. One `timing` line per worker.
 */
import { readFileSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { CAPTURE_IPC_DEFAULTS, CapturePlanSchema, SupervisorMessageType, WorkerMessageType, type CaptureIpcLimits } from '@dems/capture-protocol';
import { createCaptureSupervisor, createProcessLauncher, createSystemTimers, type WorkerLauncher } from '../../src/capture';

interface DriverConfig {
  readonly command: string;
  readonly args: readonly string[];
  readonly limits?: Partial<CaptureIpcLimits>;
}

const configPath = process.argv[2];
if (configPath === undefined) throw new Error('usage: capture-session-driver.ts <config.json>');
const config = JSON.parse(readFileSync(configPath, 'utf8')) as DriverConfig;
const limits: CaptureIpcLimits = { ...CAPTURE_IPC_DEFAULTS, ...config.limits };

const say = (event: string, more: Record<string, unknown> = {}): void => void process.stdout.write(`${JSON.stringify({ event, at: Date.now(), ...more })}\n`);
const now = (): number => performance.now();
const round = (value: number): number => Math.round(value * 100) / 100;

const real = createProcessLauncher({ command: config.command, args: [...config.args, '--heartbeat-ms', String(limits.heartbeatIntervalMs)] });

/** The production launcher, with the arrival times of HELLO, HEARTBEAT and the exit written down. */
const measuring: WorkerLauncher = (launch, handlers) => {
  const launchedAt = now();
  let helloMs: number | null = null;
  let last: number | null = null;
  let stopAt: number | null = null;
  const beats: number[] = [];
  const channel = real(launch, {
    message(message) {
      const at = now();
      if (message.type === WorkerMessageType.HELLO) helloMs = at - launchedAt;
      if (message.type === WorkerMessageType.HEARTBEAT) {
        if (last !== null) beats.push(at - last);
        last = at;
      }
      handlers.message(message);
    },
    violation: (violation) => handlers.violation(violation),
    exit(exit) {
      const sorted = [...beats].sort((a, b) => a - b);
      say('timing', {
        sessionId: launch.sessionId,
        attempt: launch.attempt,
        helloMs: helloMs === null ? null : round(helloMs),
        heartbeats: beats.length + 1,
        heartbeatIntervalMs: sorted.length === 0 ? null : { min: round(sorted[0] ?? 0), median: round(sorted[Math.floor(sorted.length / 2)] ?? 0), p99: round(sorted[Math.floor(sorted.length * 0.99)] ?? 0), max: round(sorted.at(-1) ?? 0) },
        stopToExitMs: stopAt === null ? null : round(now() - stopAt),
        exitCode: exit.exitCode,
        signal: exit.signal,
      });
      handlers.exit(exit);
    },
  });
  return {
    get pid() {
      return channel.pid;
    },
    send(message) {
      if (message.type === SupervisorMessageType.STOP) stopAt = now();
      return channel.send(message);
    },
    closeInput: () => channel.closeInput(),
    kill: (signal) => channel.kill(signal),
  };
};

const supervisor = createCaptureSupervisor({
  now: () => Date.now(),
  timers: createSystemTimers(),
  launcher: measuring,
  limits: config.limits,
  report: (entry) => say('report', { source: entry.source, code: entry.code, sessionId: entry.sessionId, error: entry.err instanceof Error ? entry.err.message : String(entry.err) }),
});

let telemetryFrames = 0;
supervisor.on('phase', (event) => say('phase', { sessionId: event.sessionId, phase: event.phase, previous: event.previous }));
supervisor.on('workerDown', (event) => say('workerDown', { sessionId: event.sessionId, down: event.down, restartInMs: event.restartInMs }));
supervisor.on('warning', (event) => say('warning', { sessionId: event.sessionId, code: event.code, state: event.state, subject: event.subject, source: event.source }));
supervisor.on('record', (event) => say('record', { sessionId: event.sessionId, attempt: event.attempt, seq: event.seq, record: event.record }));
supervisor.on('progress', (event) => say('progress', { sessionId: event.sessionId, step: event.frame.step, progress: event.frame.progress }));
supervisor.on('telemetry', (event) => {
  telemetryFrames += 1;
  // One line a second is enough for a harness; the count says how many arrived.
  if (telemetryFrames % 20 === 1) say('telemetry', { sessionId: event.sessionId, frames: telemetryFrames, frame: event.frame });
});

const failure = (error: unknown): Record<string, unknown> =>
  error instanceof Error ? { error: error.message, code: (error as { code?: unknown }).code ?? null, detail: (error as { detail?: unknown }).detail ?? null } : { error: String(error) };

async function run(line: string): Promise<void> {
  const command = JSON.parse(line) as { cmd: string; sessionId?: string; plan?: unknown; reason?: 'STOPPED' | 'CRASH' | 'SHUTDOWN'; to?: 'PRIMARY' | 'STANDBY' };
  const sessionId = command.sessionId ?? '';
  switch (command.cmd) {
    case 'start':
      await supervisor.start(sessionId, CapturePlanSchema.parse(command.plan)).then(
        () => say('started', { sessionId }),
        (error: unknown) => say('startFailed', { sessionId, ...failure(error) }),
      );
      return;
    case 'stop':
      await supervisor.stop(sessionId, command.reason ?? 'STOPPED').then(
        () => say('stopped', { sessionId, telemetryFrames }),
        (error: unknown) => say('stopFailed', { sessionId, ...failure(error) }),
      );
      return;
    case 'switch':
      await supervisor.switchAudioSource(sessionId, command.to ?? 'STANDBY').then(
        () => say('switched', { sessionId, to: command.to }),
        (error: unknown) => say('switchFailed', { sessionId, ...failure(error) }),
      );
      return;
    case 'status':
      say('status', { status: supervisor.status() });
      return;
    case 'exit':
      await supervisor.shutdown();
      say('exited');
      process.exit(0);
  }
}

await supervisor.boot();
say('booted', { limits, protocol: 'capture-protocol', pid: process.pid });
const lines = createInterface({ input: process.stdin });
lines.on('line', (line) => {
  // Each command runs by itself: a start that waits does not hold a status or a stop back.
  run(line).catch((error: unknown) => say('driverError', failure(error)));
});
// The harness is gone: nothing is left running.
lines.on('close', () => {
  supervisor.shutdown().finally(() => process.exit(0));
});
