/**
 * Test support of the capture supervisor (blueprint row 57 / M3-W1; capture spec §A.3 "Test
 * hook", §B.1; not a test file). Nothing here imports Vitest.
 *
 *   manual timers        the supervisor's timers and its clock, moved by hand: no test of the
 *                        supervisor's rules waits in real time;
 *   FakeWorkerProcess    the worker the supervisor starts INSTEAD of the real binary: an in-memory
 *                        `WorkerChannel` that a test drives message by message, kills, and reads
 *                        the received commands from. It keeps the rules of the protocol a real
 *                        worker keeps (one session per process, exit on STOP, exit when killed);
 *   fake launcher        hands out one `FakeWorkerProcess` per call and keeps them all;
 *   stub worker          the path of `capture-stub-worker.mjs`, a REAL child process that speaks
 *                        the protocol over its standard streams, for the tests of `ipc.ts`.
 *
 * NEUTRAL TEST SUPPORT: the rows that build on the supervisor (worker, sessions, devices) use the
 * same fakes. No production source imports anything under `test/`.
 */
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  CAPTURE_PROTOCOL_VERSION,
  CaptureIngestState,
  CaptureMicRole,
  CaptureSyncLevel,
  CaptureWarningReason,
  LIBAVFORMAT_VERSION_MISMATCH,
  SupervisorMessageType,
  WorkerMessageType,
  type CapturePlan,
  type CaptureRecord,
  type CaptureWarningCode,
  type SupervisorMessage,
  type WorkerMessage,
} from '@dems/capture-protocol';
import {
  CAPTURE_AUDIO_CHANNELS,
  CAPTURE_AUDIO_SAMPLE_RATE_HZ,
  CAPTURE_FRAGMENT_TARGET_MS,
  CAPTURE_GOP_FRAMES,
  CAPTURE_METER_RATE_HZ,
  CAPTURE_MIN_FRAG_DURATION_MS,
} from '@dems/shared/api';
import {
  CAPTURE_WORKER_VERSION,
  WorkerLaunchError,
  type CaptureTimers,
  type WorkerChannel,
  type WorkerChannelHandlers,
  type WorkerLaunch,
  type WorkerLauncher,
} from '../../src/capture';

/** The stub worker: a real process for the tests of the process channel. Run it with `process.execPath`. */
export const STUB_WORKER = resolve(dirname(fileURLToPath(import.meta.url)), 'capture-stub-worker.mjs');

/** Lets every queued microtask and every reaction of a fake run. */
export function flush(): Promise<void> {
  return new Promise((resolvePromise) => setImmediate(resolvePromise));
}

// ── Manual timers ──────────────────────────────────────────────────────────────────────────────

export interface ManualCaptureTimers {
  readonly timers: CaptureTimers;
  /** The clock the timers run on. */
  now(): number;
  /** Moves the clock and fires every timer that is due, in order of its time. */
  advance(ms: number): void;
  /** The delays of the timers that are armed now, from the clock, smallest first. */
  armed(): number[];
}

export function manualCaptureTimers(start = 1_760_000_000_000): ManualCaptureTimers {
  interface Entry {
    readonly at: number;
    readonly order: number;
    readonly callback: () => void;
  }
  let current = start;
  let order = 0;
  const entries: Entry[] = [];
  return {
    timers: {
      after(delayMs, callback) {
        const entry: Entry = { at: current + delayMs, order: (order += 1), callback };
        entries.push(entry);
        return () => {
          const index = entries.indexOf(entry);
          if (index !== -1) entries.splice(index, 1);
        };
      },
    },
    now: () => current,
    advance(ms) {
      const target = current + ms;
      for (;;) {
        const due = entries.filter((entry) => entry.at <= target).sort((a, b) => a.at - b.at || a.order - b.order)[0];
        if (due === undefined) break;
        entries.splice(entries.indexOf(due), 1);
        current = Math.max(current, due.at);
        due.callback();
      }
      current = target;
    },
    armed: () => entries.map((entry) => entry.at - current).sort((a, b) => a - b),
  };
}

// ── The fake worker ────────────────────────────────────────────────────────────────────────────

export interface FakeWorkerBehaviour {
  /** Says `HELLO` by itself when it is started. Default true. */
  hello: boolean;
  /**
   * A worker that runs on another libavformat than it was verified against (fix pass F-M3, review
   * R63-07): it writes ONE frame INSTEAD of `HELLO` - `CRASH` with the code
   * `LIBAVFORMAT_VERSION_MISMATCH` and no session - and exits 70. Default false.
   */
  libavformatMismatch: boolean;
  /** The protocol version its `HELLO` names. */
  protocolVersion: number;
  /**
   * The version word its `HELLO` names. Default: THE version this Core was built to drive
   * (`CAPTURE_WORKER_VERSION`, `src/capture/boot/checks.ts` - the word of the worker of this tree,
   * `apps/capture-worker/src/worker.h` `WORKER_VERSION`; a test holds the two equal). The boot and
   * the supervisor refuse every other word since wave H driver F (gate 64 C7; before it the rule
   * was the release FORM, review R63-04), so a fake that is to record states the built version by
   * construction. A test of the refusal says another word.
   */
  workerVersion: string;
  /** `true`: acknowledges `START`; a code: refuses it with that code; `false`: never answers. */
  ackStart: boolean | string;
  /** The same for `SWITCH_AUDIO_SOURCE`. */
  ackSwitch: boolean | string;
  /** Acknowledges `STOP` and exits with code 0. Default true. `false`: ignores `STOP` (a hung worker). */
  exitOnStop: boolean;
  /**
   * A worker that began an audio timeline (it wrote an `AUDIO_SOURCE_INTERVAL`) writes
   * `AUDIO_TIMELINE_END` before it exits on `STOP`, as the real worker does (`audio.c`: "absent only
   * when the worker was killed"). Default true. `false`: it exits 0 without it (review R63-01: such
   * a stop is not clean). A test that wrote the end itself is left alone.
   */
  timelineEndOnStop: boolean;
  /** Exits when it is killed. Default true. `false`: the exit is the test's to send (`exit`). */
  exitOnKill: boolean;
  /** `send` does not resolve until `releaseSends()`: a worker whose input pipe is full. */
  holdSends: boolean;
}

const DEFAULT_BEHAVIOUR: FakeWorkerBehaviour = {
  hello: true,
  libavformatMismatch: false,
  protocolVersion: CAPTURE_PROTOCOL_VERSION,
  workerVersion: CAPTURE_WORKER_VERSION,
  ackStart: true,
  ackSwitch: true,
  exitOnStop: true,
  timelineEndOnStop: true,
  exitOnKill: true,
  holdSends: false,
};

type WithoutEnvelope<Message> = Message extends unknown ? Omit<Message, 'v' | 'sessionId'> : never;
/** A worker message without the fields the fake fills in: the version, and the session where the message has one. */
export type FakeWorkerSays = WithoutEnvelope<WorkerMessage>;

let nextPid = 40_000;

export class FakeWorkerProcess implements WorkerChannel {
  readonly pid: number;
  readonly launch: WorkerLaunch;
  readonly behaviour: FakeWorkerBehaviour;
  /** Every command the supervisor wrote, in order. */
  readonly received: SupervisorMessage[] = [];
  /** Every signal it was sent. */
  readonly kills: string[] = [];
  exited = false;
  inputClosed = false;
  private readonly handlers: WorkerChannelHandlers;
  private readonly heldSends: Array<() => void> = [];
  private startsServed = 0;
  private counter = 0;
  private recordSeq = 0;
  /** The sequence number of the last record it said, however the test numbered it. */
  private lastSaidSeq = 0;
  /** It wrote an audio-source interval / the end of the audio timeline. */
  private timelineOpen = false;
  private timelineEnded = false;
  /** The newest sample an interval of it began at: the end it writes is never before it. */
  private timelineSamples = 0;
  /** The cameras whose fragment-size-bound warning was said: once per camera. */
  private readonly sizeBoundSaid = new Set<string>();

  constructor(launch: WorkerLaunch, handlers: WorkerChannelHandlers, behaviour: FakeWorkerBehaviour) {
    this.pid = nextPid += 1;
    this.launch = launch;
    this.handlers = handlers;
    this.behaviour = { ...behaviour };
    if (this.behaviour.libavformatMismatch) {
      queueMicrotask(() => {
        // Before any session: the frame names none (`sessionId: null`), as `capture_worker.c` writes it.
        this.handlers.message({ v: CAPTURE_PROTOCOL_VERSION, sessionId: null, type: WorkerMessageType.CRASH, code: LIBAVFORMAT_VERSION_MISMATCH, signal: null, exitCode: 70 });
        this.exit(70);
      });
    } else if (this.behaviour.hello) queueMicrotask(() => this.hello());
  }

  // ── What the supervisor does to it ─────────────────────────────────────────────────────────

  send(message: SupervisorMessage): Promise<void> {
    if (this.exited || this.inputClosed) return Promise.reject(new Error('the input of the fake worker is closed'));
    this.received.push(message);
    queueMicrotask(() => this.react(message));
    if (!this.behaviour.holdSends) return Promise.resolve();
    return new Promise((resolvePromise) => this.heldSends.push(resolvePromise));
  }

  closeInput(): void {
    this.inputClosed = true;
  }

  kill(signal: 'SIGTERM' | 'SIGKILL'): void {
    this.kills.push(signal);
    if (this.behaviour.exitOnKill) queueMicrotask(() => this.exit(null, signal));
  }

  // ── What a test makes it do ────────────────────────────────────────────────────────────────

  /** Writes one message, with the session of its launch. Ignored once it has exited. */
  say(message: FakeWorkerSays, sessionId: string = this.launch.sessionId): void {
    if (this.exited) return;
    const sessionless = message.type === WorkerMessageType.HELLO || message.type === WorkerMessageType.HEARTBEAT || message.type === WorkerMessageType.ACK;
    const full = { v: CAPTURE_PROTOCOL_VERSION, ...(sessionless ? {} : { sessionId }), ...message } as WorkerMessage;
    if (full.type === WorkerMessageType.RECORD) {
      this.lastSaidSeq = full.seq;
      if (full.record.kind === 'AUDIO_SOURCE_INTERVAL') {
        this.timelineOpen = true;
        this.timelineSamples = Math.max(this.timelineSamples, full.record.fromSample);
      }
      if (full.record.kind === 'AUDIO_TIMELINE_END') this.timelineEnded = true;
    }
    this.handlers.message(full);
  }

  hello(protocolVersion: number = this.behaviour.protocolVersion, workerVersion: string = this.behaviour.workerVersion): void {
    this.say({ type: WorkerMessageType.HELLO, protocolVersion, workerVersion });
  }

  /** A heartbeat with the next counter, or with the one given (a stale one, for instance). */
  heartbeat(counter?: number): void {
    if (counter === undefined) this.counter += 1;
    this.say({ type: WorkerMessageType.HEARTBEAT, counter: counter ?? this.counter });
  }

  /**
   * A telemetry frame; `count` is what the test tells frames apart by. `clocks`: what the worker
   * measured of each camera that delivers video (`lagMs` = arrival time minus camera time).
   */
  telemetry(count: number, clocks: ReadonlyArray<{ readonly deviceId: string; readonly lagMs: number; readonly trendPpm?: number | null; readonly nearBound?: boolean }> = []): void {
    this.say({
      type: WorkerMessageType.TELEMETRY,
      levels: [{ deviceId: 'MIC-01', role: CaptureMicRole.PRIMARY, dbfs: -20, clipped: false, ratePpm: 0, timelineSamples: 480_000, receivedSamples: 480_000, insertedSamples: 0, nonZero: true }],
      ingest: [{ deviceId: 'CAM-01', state: CaptureIngestState.CONNECTED }],
      fragments: [{ deviceId: 'CAM-01', count, bytes: count * 1_000 }],
      clocks: clocks.map((clock) => ({ deviceId: clock.deviceId, lagMs: clock.lagMs, trendPpm: clock.trendPpm ?? null, nearBound: clock.nearBound ?? false })),
      tapActive: false,
    });
  }

  progress(step: string, progress: number): void {
    this.say({ type: WorkerMessageType.PROGRESS, step, progress, etaMs: null });
  }

  /**
   * A warning of protocol 4: the subject is a DEVICE ID of the plan and the reason one of the code.
   * Without a subject the first device the code is about is named (`MIC-01` for `MIC_SILENT`,
   * `CAM-01` for `CAPTURE_FAULT`); without a reason, the usual one of that code and device.
   */
  warning(code: CaptureWarningCode, subject: string | null = null, state: 'ACTIVE' | 'CLEARED' = 'ACTIVE', reason?: CaptureWarningReason): void {
    const about = subject ?? (code === 'MIC_SILENT' ? 'MIC-01' : 'CAM-01');
    const why = reason ?? (code === 'MIC_SILENT' ? CaptureWarningReason.MIC_LEVEL_BELOW_THRESHOLD : about.startsWith('MIC') ? CaptureWarningReason.MIC_DISCONNECTED : CaptureWarningReason.CAMERA_STREAM_ENDED);
    this.say({ type: WorkerMessageType.WARNING, code, reason: why, state, subject: about });
  }

  /** A record with the next sequence number of this process, or with the one given (a gap, a repeat). */
  record(record: CaptureRecord, seq?: number): void {
    if (seq === undefined) this.recordSeq += 1;
    this.say({ type: WorkerMessageType.RECORD, seq: seq ?? this.recordSeq, record });
  }

  /**
   * The first fragment of a camera file reached the disk. The worker of this tree always states the
   * sync level it ACHIEVED (fix pass F-M3, review R63-09): the full sync unless the test says the
   * volume took only `fsync`; `null` writes the record without the member (an older worker).
   */
  firstDurableFragment(deviceId = 'CAM-01', bytes = 5_131, syncLevel: CaptureSyncLevel | null = CaptureSyncLevel.FULL): void {
    this.record({ kind: 'FIRST_DURABLE_FRAGMENT', deviceId, bytes, ...(syncLevel === null ? {} : { syncLevel }) });
  }

  /**
   * A fragment of a camera file was closed at the size bound (`ingest.c`: the advisory warning
   * `FRAGMENT_SIZE_BOUND_REACHED`, ACTIVE, ONCE per camera and never CLEARED). A second call for
   * the same camera says nothing, as the worker says nothing.
   */
  fragmentSizeBound(deviceId = 'CAM-01'): void {
    if (this.sizeBoundSaid.has(deviceId)) return;
    this.sizeBoundSaid.add(deviceId);
    this.say({ type: WorkerMessageType.WARNING, code: 'CAPTURE_FAULT', reason: CaptureWarningReason.FRAGMENT_SIZE_BOUND_REACHED, state: 'ACTIVE', subject: deviceId });
  }

  /**
   * The worker gives up by itself, as the real one does: ONE `CRASH` frame with its own code, then
   * the exit with that code (70 for every failure of the worker's own; `capture_worker.c`).
   */
  crash(code: string, exitCode = 70): void {
    this.say({ type: WorkerMessageType.CRASH, code, signal: null, exitCode });
    this.exit(exitCode);
  }

  /** Answers a command. Default: the last one received. */
  ack(ok: boolean, code?: string, of: SupervisorMessage | undefined = this.received.at(-1)): void {
    if (of === undefined) throw new Error('the fake worker received no command to acknowledge');
    this.say({ type: WorkerMessageType.ACK, correlationId: of.correlationId, ok, ...(code === undefined ? {} : { code }) });
  }

  /** A line that is no frame of the protocol. */
  violate(violation: Parameters<WorkerChannelHandlers['violation']>[0]): void {
    if (!this.exited) this.handlers.violation(violation);
  }

  /** The process ends: by itself (`exitCode`), or by a signal. The RTSP ingest ends this way after TEARDOWN (exit code 0). */
  exit(exitCode: number | null, signal: string | null = null): void {
    if (this.exited) return;
    this.exited = true;
    this.handlers.exit({ exitCode, signal, spawnFailed: false });
  }

  /** Lets the writes that `holdSends` kept waiting resolve. */
  releaseSends(): void {
    for (const resolvePromise of this.heldSends.splice(0)) resolvePromise();
  }

  /** The commands of one type it received. */
  commands<Type extends SupervisorMessage['type']>(type: Type): Array<Extract<SupervisorMessage, { type: Type }>> {
    return this.received.filter((message): message is Extract<SupervisorMessage, { type: Type }> => message.type === type);
  }

  private react(message: SupervisorMessage): void {
    if (this.exited) return;
    const answer = (how: boolean | string): void => {
      if (how === false) return;
      this.ack(how === true, how === true ? undefined : how, message);
    };
    if (message.type === SupervisorMessageType.START) {
      this.startsServed += 1;
      // One session per process: the ingest refuses a second push (S1 G-1).
      if (this.startsServed > 1) this.ack(false, 'SESSION_ALREADY_SERVED', message);
      else answer(this.behaviour.ackStart);
    } else if (message.type === SupervisorMessageType.SWITCH_AUDIO_SOURCE) {
      answer(this.behaviour.ackSwitch);
    } else if (this.behaviour.exitOnStop) {
      this.ack(true, undefined, message);
      // The real worker joins its filtering thread on STOP: the end of the audio timeline leaves before the process does.
      if (this.behaviour.timelineEndOnStop && this.timelineOpen && !this.timelineEnded) {
        this.say({ type: WorkerMessageType.RECORD, seq: this.lastSaidSeq + 1, record: { kind: 'AUDIO_TIMELINE_END', samples: this.timelineSamples + CAPTURE_AUDIO_SAMPLE_RATE_HZ, sampleRateHz: CAPTURE_AUDIO_SAMPLE_RATE_HZ, intervals: 1 } });
      }
      this.exit(0);
    }
  }
}

export interface FakeLauncher {
  readonly launcher: WorkerLauncher;
  /** Every worker that was started, oldest first. */
  readonly workers: FakeWorkerProcess[];
  /** The behaviour the NEXT workers are created with; change it between launches. */
  readonly behaviour: FakeWorkerBehaviour;
  /** The next `count` launches throw: the process cannot be started. */
  failNext(count: number, retryable?: boolean): void;
  /** How often the launcher was called, failures included. */
  calls(): number;
  /** The newest worker. Throws when none was started. */
  last(): FakeWorkerProcess;
}

export function fakeLauncher(behaviour: Partial<FakeWorkerBehaviour> = {}): FakeLauncher {
  const workers: FakeWorkerProcess[] = [];
  const current: FakeWorkerBehaviour = { ...DEFAULT_BEHAVIOUR, ...behaviour };
  let failures = 0;
  let failuresRetryable = true;
  let calls = 0;
  return {
    workers,
    behaviour: current,
    launcher(launch, handlers) {
      calls += 1;
      if (failures > 0) {
        failures -= 1;
        throw new WorkerLaunchError('SPAWN_FAILED', 'the fake launcher was told to fail', failuresRetryable);
      }
      const worker = new FakeWorkerProcess(launch, handlers, current);
      workers.push(worker);
      return worker;
    },
    failNext(count, retryable = true) {
      failures = count;
      failuresRetryable = retryable;
    },
    calls: () => calls,
    last() {
      const worker = workers.at(-1);
      if (worker === undefined) throw new Error('no fake worker was started');
      return worker;
    },
  };
}

// ── A plan ─────────────────────────────────────────────────────────────────────────────────────

/**
 * A valid plan of two cameras and two mics. The addresses and paths are text only: nothing here
 * listens on a port or writes a file.
 */
export function capturePlan(sessionId = 'S-TEST-0001', overrides: Partial<CapturePlan> = {}): CapturePlan {
  const root = `/nonexistent/dems-unit-test-data/media/sessions/${sessionId}`;
  return {
    cameras: [
      { deviceId: 'CAM-01', trackId: 'VIDEO-01', profile: null, ingestUrl: 'rtsp://127.0.0.1:8554/video01', outputPath: `${root}/VIDEO-01.mp4` },
      { deviceId: 'CAM-02', trackId: 'VIDEO-02', profile: null, ingestUrl: 'rtsp://127.0.0.1:8555/video02', outputPath: `${root}/VIDEO-02.mp4` },
    ],
    mics: [
      { deviceId: 'MIC-01', role: CaptureMicRole.PRIMARY, input: { kind: 'PCM_FIFO', path: `${root}/MIC-01.pcm` } },
      { deviceId: 'MIC-02', role: CaptureMicRole.STANDBY, input: { kind: 'PCM_FIFO', path: `${root}/MIC-02.pcm` } },
    ],
    activeMic: CaptureMicRole.PRIMARY,
    pcmTapPath: null,
    constants: {
      fragmentTargetMs: CAPTURE_FRAGMENT_TARGET_MS,
      minFragDurationMs: CAPTURE_MIN_FRAG_DURATION_MS,
      gopFrames: CAPTURE_GOP_FRAMES,
      meterRateHz: CAPTURE_METER_RATE_HZ,
      audioSampleRateHz: CAPTURE_AUDIO_SAMPLE_RATE_HZ,
      audioChannels: CAPTURE_AUDIO_CHANNELS,
    },
    ...overrides,
  };
}
