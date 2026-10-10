/**
 * Types of the capture supervisor (blueprint row 57 / M3-W1; register NM-03; capture spec §A.3,
 * §B.1, §B.2).
 *
 * `CaptureSupervisor` is the `capture` seam of the scaffold (`app.capture`): the one door between
 * the Core server and the capture worker process. The session and device modules reach capture
 * through it and through nothing else.
 */
import type {
  AudioSourceIntervalRecord,
  CaptureIpcLimits,
  CaptureMicRole,
  CapturePlan,
  CaptureRecord,
  CaptureStopReason,
  CaptureWarningCode,
  CaptureWarningReason,
  CaptureWarningState,
  FrameViolation,
  ProgressMessage,
  SupervisorMessage,
  TelemetryMessage,
  WorkerMessage,
} from '@dems/capture-protocol';

/** Where the supervisor stands. One session at most is open (R-6). */
export const CapturePhase = {
  /** Not booted, or shut down: every `start` is refused. */
  CLOSED: 'CLOSED',
  /** Booted, no session. */
  IDLE: 'IDLE',
  /** A session's first worker is being started (also while it waits for a restart). */
  STARTING: 'STARTING',
  /** The worker acknowledged `START` and is alive. */
  RECORDING: 'RECORDING',
  /** The worker of an open session went down; the next one starts after the back-off. */
  RESTARTING: 'RESTARTING',
  /** `stop` is waiting for the worker to flush and exit. */
  STOPPING: 'STOPPING',
  /**
   * The session's worker is down for good while the session is open: the restarts are exhausted,
   * or the session may hold a durable fragment (no worker is started into an existing evidence
   * file: decision D67, option C). Only `stop` leaves this phase.
   */
  FAULTED: 'FAULTED',
} as const;
export type CapturePhase = (typeof CapturePhase)[keyof typeof CapturePhase];

/** Why a worker is counted as down. Machine codes: they go to the log and to the error log. */
export const WorkerDownCode = {
  /** The process could not be started at all. */
  SPAWN_FAILED: 'SPAWN_FAILED',
  /** No launcher is configured (this build has no worker command yet). Not retried. */
  NOT_CONFIGURED: 'CAPTURE_WORKER_NOT_CONFIGURED',
  /** No `HELLO` within the limit. */
  HELLO_TIMEOUT: 'HELLO_TIMEOUT',
  /** `HELLO` named another protocol version. Not retried. */
  PROTOCOL_MISMATCH: 'PROTOCOL_MISMATCH',
  /** `HELLO` carries the proof-build mark: a negative control of the capture checks, never recorded with. Not retried. */
  PROOF_BUILD: 'CAPTURE_WORKER_PROOF_BUILD',
  /** A line that is no frame of the protocol. */
  PROTOCOL_VIOLATION: 'PROTOCOL_VIOLATION',
  /** `START` was answered with `ok=false`. */
  START_REFUSED: 'START_REFUSED',
  /** `START` was not answered within the limit. */
  START_TIMEOUT: 'START_TIMEOUT',
  /** No valid heartbeat within the limit. */
  HEARTBEAT_TIMEOUT: 'HEARTBEAT_TIMEOUT',
  /** The process ended, or said `CRASH`, while its session was open. */
  EXITED: 'EXITED',
} as const;
export type WorkerDownCode = (typeof WorkerDownCode)[keyof typeof WorkerDownCode];

/** The last time a worker went down. Identifiers and codes only. */
export interface WorkerDown {
  readonly at: number;
  readonly code: WorkerDownCode;
  /** The worker's own code (`ACK code`, `CRASH code`, a frame violation), when it gave one. */
  readonly detail: string | null;
  readonly exitCode: number | null;
  readonly signal: string | null;
  /** Which worker of the session it was (1 for the first). */
  readonly attempt: number;
}

export interface CaptureStatus {
  readonly phase: CapturePhase;
  readonly sessionId: string | null;
  /** The correlation ID of the open session's `START`, or null. */
  readonly correlationId: string | null;
  /** Operating-system ID of the live worker, or null. */
  readonly workerPid: number | null;
  /** How many workers this session has had. */
  readonly attempt: number;
  /** Restarts in a row since the worker was last stable. */
  readonly restarts: number;
  /** Milliseconds since the last valid heartbeat, or null when no worker is alive. */
  readonly heartbeatAgeMs: number | null;
  readonly lastCrash: WorkerDown | null;
  /** Worker events waiting for a listener. Never more than `eventQueueLimit`. */
  readonly queuedEvents: number;
  /** Telemetry frames replaced by a newer one, or dropped at the bound, before a listener took them. */
  readonly droppedTelemetry: number;
  /** Progress values and warnings superseded or evicted before a listener took them. */
  readonly droppedEvents: number;
  /**
   * True once the open session may hold a fragment on the disk (its first fragment record arrived, or a
   * worker found a file at an output path). False does NOT prove the disk is empty: the record is
   * a hint, the file is the truth.
   */
  readonly durable: boolean;
  /** Sequence number of the last record of the open session; 0 before the first. */
  readonly lastRecordSeq: number;
}

interface EventBase {
  readonly sessionId: string;
  /** The correlation ID of the session's `START`. */
  readonly correlationId: string;
}

/** What the supervisor tells its listeners. `action` names the INTERNAL action of spec §B.1 the event is meant for. */
export type CaptureEvent =
  | (EventBase & { readonly name: 'telemetry'; readonly action: 'applyCaptureTelemetry'; readonly frame: TelemetryMessage })
  | (EventBase & { readonly name: 'progress'; readonly action: 'applySealingProgress'; readonly frame: ProgressMessage })
  /**
   * A warning. Of the worker (`source: 'worker'`, protocol 4): `subject` is the device ID of a
   * camera or a microphone of the plan and `reason` says which cause of the code it is. Of the
   * supervisor itself (its `CAPTURE_FAULT`: the worker cannot be kept running): no subject, no reason.
   */
  | (EventBase & { readonly name: 'warning'; readonly action: 'raiseCaptureWarning'; readonly code: CaptureWarningCode; readonly reason: CaptureWarningReason | null; readonly state: CaptureWarningState; readonly subject: string | null; readonly source: 'worker' | 'supervisor' })
  | (EventBase & { readonly name: 'phase'; readonly phase: CapturePhase; readonly previous: CapturePhase })
  | (EventBase & { readonly name: 'workerDown'; readonly down: WorkerDown; readonly restartInMs: number | null })
  /** A lossless record of the worker (spec §B.2 R-1), in the order of `seq`, never through the queue of levels. */
  | (EventBase & { readonly name: 'record'; /** Which worker of the session wrote it (1 for the first): `seq` counts per worker. */ readonly attempt: number; readonly seq: number; readonly record: CaptureRecord });
export type CaptureEventName = CaptureEvent['name'];
export type CaptureEventOf<Name extends CaptureEventName> = Extract<CaptureEvent, { name: Name }>;

/**
 * A listener may return a promise. For the worker's events (`telemetry`, `progress`, a worker's
 * `warning`) the next of them is delivered after it settled; the supervisor's own events
 * (`workerDown`, `phase`, its `CAPTURE_FAULT` warning) and `record` wait for no listener.
 */
export type CaptureListener<Name extends CaptureEventName = CaptureEventName> = (event: CaptureEventOf<Name>) => void | Promise<void>;

/**
 * The `capture` seam (spec §A.3). `boot` and `shutdown` are the two calls of the entry point
 * (spec §B.2 "the supervisor is started at boot and stopped at shutdown"; §I edits 11 and 12).
 */
export interface CaptureSupervisor {
  /** Opens the supervisor for sessions. Starts no worker: a worker lives for one session. */
  boot(): Promise<void>;
  /** Stops the open session's worker (reason `SHUTDOWN`), waits for it to exit, and closes. Safe to call twice. */
  shutdown(): Promise<void>;
  /** One session = one worker process and one file per camera. Resolves when the worker acknowledged `START`. */
  start(sessionId: string, plan: CapturePlan): Promise<void>;
  /** Stops the session's worker and waits for it to exit. Resolves at once when no session is open. */
  stop(sessionId: string, reason: CaptureStopReason): Promise<void>;
  /**
   * The operator's switch (never automatic, OD-11). Resolves when the worker acknowledged it, with
   * the `AUDIO_SOURCE_INTERVAL` record of that switch (the interval it opened: microphone, first
   * sample, capture instant), or with null when that role already fed the track (nothing changed).
   */
  switchAudioSource(sessionId: string, to: CaptureMicRole): Promise<AudioSourceIntervalRecord | null>;
  status(): CaptureStatus;
  /** Returns the function that removes the listener. */
  on<Name extends CaptureEventName>(event: Name, listener: CaptureListener<Name>): () => void;
}

/** Refusals of the supervisor. `code` is one of `CaptureRefusal`. */
export const CaptureRefusal = {
  CLOSED: 'CAPTURE_SUPERVISOR_CLOSED',
  SESSION_OPEN: 'CAPTURE_SESSION_OPEN',
  SESSION_UNKNOWN: 'CAPTURE_SESSION_UNKNOWN',
  PLAN_INVALID: 'CAPTURE_PLAN_INVALID',
  NOT_RECORDING: 'CAPTURE_NOT_RECORDING',
  WORKER_DOWN: 'CAPTURE_WORKER_DOWN',
  BACKPRESSURE: 'CAPTURE_BACKPRESSURE',
  COMMAND_REFUSED: 'CAPTURE_COMMAND_REFUSED',
  COMMAND_TIMEOUT: 'CAPTURE_COMMAND_TIMEOUT',
  START_ABORTED: 'CAPTURE_START_ABORTED',
  /** The session's worker could not be started: the restarts are exhausted (spec §B.2). */
  FAULT: 'CAPTURE_FAULT',
} as const;
export type CaptureRefusal = (typeof CaptureRefusal)[keyof typeof CaptureRefusal];

export class CaptureSupervisorError extends Error {
  readonly code: CaptureRefusal;
  /** A machine code that says more (a `WorkerDownCode`, the worker's `ACK code`), or null. */
  readonly detail: string | null;
  constructor(code: CaptureRefusal, message: string, detail: string | null = null) {
    super(message);
    this.name = 'CaptureSupervisorError';
    this.code = code;
    this.detail = detail;
  }
}

// ── The worker as the supervisor sees it ──────────────────────────────────────────────────────

/** How a worker ended. */
export interface WorkerExit {
  readonly exitCode: number | null;
  readonly signal: string | null;
  /** True when the process could not be started at all. */
  readonly spawnFailed: boolean;
}

/** What a channel reports. Each is called on a later turn of the event loop, never from inside a call of the channel. */
export interface WorkerChannelHandlers {
  message(message: WorkerMessage): void;
  violation(violation: FrameViolation): void;
  /** Called once, last. */
  exit(exit: WorkerExit): void;
}

/** One worker process, at the level of messages. `ipc.ts` implements it over a child process; tests over memory. */
export interface WorkerChannel {
  readonly pid: number | null;
  /** Writes one command. Resolves when the worker's input took it; rejects when the input is closed. */
  send(message: SupervisorMessage): Promise<void>;
  /** Ends the worker's input: a worker that keeps the protocol exits. */
  closeInput(): void;
  kill(signal: 'SIGTERM' | 'SIGKILL'): void;
}

/** What a launcher is told about the worker it starts. */
export interface WorkerLaunch {
  readonly sessionId: string;
  readonly correlationId: string;
  readonly attempt: number;
}

/**
 * Starts one worker. May throw a `WorkerLaunchError` when no worker can be started at all.
 * Injected: the supervisor itself names no process and no file (static rule G-R8).
 */
export type WorkerLauncher = (launch: WorkerLaunch, handlers: WorkerChannelHandlers) => WorkerChannel;

export class WorkerLaunchError extends Error {
  readonly code: WorkerDownCode;
  /** False for a failure that another try cannot change. */
  readonly retryable: boolean;
  constructor(code: WorkerDownCode, message: string, retryable: boolean) {
    super(message);
    this.name = 'WorkerLaunchError';
    this.code = code;
    this.retryable = retryable;
  }
}

/** A timer the supervisor can cancel. `timers.ts` holds the system's; a test passes a manual one. */
export interface CaptureTimers {
  /** Calls `callback` once after `delayMs`, unless the returned function was called first. */
  after(delayMs: number, callback: () => void): () => void;
}

/** A failure the supervisor could not hand to a caller: a listener that threw, a command that could not be written. */
export interface CaptureReport {
  readonly source: string;
  readonly code: string;
  readonly sessionId: string | null;
  readonly correlationId: string | null;
  readonly err: unknown;
}

export interface CaptureSupervisorOptions {
  /** Milliseconds that never move backwards: the server clock (`app.clock`). */
  readonly now: () => number;
  readonly timers: CaptureTimers;
  readonly launcher: WorkerLauncher;
  /** Overrides of `CAPTURE_IPC_DEFAULTS`. */
  readonly limits?: Partial<CaptureIpcLimits>;
  readonly report?: (report: CaptureReport) => void;
}
