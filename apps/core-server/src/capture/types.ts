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
  CapturePlanMic,
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
import type { CaptureIngestChance } from './ingest-address';

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
  /**
   * `HELLO` names a version that is not a release word (`capture-worker/<n>.<n>.<n>` exactly): the
   * allowlist of the boot check, held for EVERY `HELLO` of every session (review R63-04). Not retried.
   */
  VERSION_UNKNOWN: 'CAPTURE_WORKER_VERSION_UNKNOWN',
  /**
   * `HELLO` names a release word that is NOT the version this Core was built to drive
   * (`CAPTURE_WORKER_VERSION`, `boot/checks.ts`; gate 64 condition C7, ruling D194): an older or a
   * newer worker binary. `detail` is the word it named. Not retried.
   */
  VERSION_MISMATCH: 'CAPTURE_WORKER_VERSION_MISMATCH',
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
  /**
   * A `stop` was waiting for the worker to flush and exit, the stop grace ran out, and the
   * supervisor KILLED it (review R63-01): whatever fragment was still open is not on the disk.
   */
  STOP_TIMEOUT: 'STOP_TIMEOUT',
} as const;
export type WorkerDownCode = (typeof WorkerDownCode)[keyof typeof WorkerDownCode];

/**
 * WHAT THE SUPERVISOR REFUSES A WORKER'S OWN WORDS FOR (wave H driver F; tidy pass F-Y decision 6).
 * The `detail` of a `PROTOCOL_VIOLATION` the supervisor itself decided: every one is a member of
 * this object and nothing else - the supervisor writes no other literal (a test reads its source).
 */
export const SupervisorRefusal = {
  /** A frame names another session than the one the worker was started for. */
  SESSION_MISMATCH: 'SESSION_MISMATCH',
  /** A second `HELLO`. */
  HELLO_TWICE: 'HELLO_TWICE',
  /** The first frame is not `HELLO`. */
  HELLO_EXPECTED: 'HELLO_EXPECTED',
  /** A `TELEMETRY` frame names a device that is no device of the session's plan. */
  TELEMETRY_SUBJECT_UNKNOWN: 'TELEMETRY_SUBJECT_UNKNOWN',
  /** A `WARNING` names a subject that is no device of the session's plan. */
  WARNING_SUBJECT_UNKNOWN: 'WARNING_SUBJECT_UNKNOWN',
  /** A `RECORD` before `START` was acknowledged. */
  RECORD_BEFORE_START: 'RECORD_BEFORE_START',
  /** A `RECORD` names a device that is no camera / microphone of the plan. */
  RECORD_SUBJECT_UNKNOWN: 'RECORD_SUBJECT_UNKNOWN',
  /** The sequence number of a `RECORD` is not one more than the last. */
  RECORD_SEQUENCE_GAP: 'RECORD_SEQUENCE_GAP',
  /** A `RECORD` after the seal completion. */
  RECORD_AFTER_SEAL: 'RECORD_AFTER_SEAL',
  /** A once-per-camera `RECORD` said a second time. */
  RECORD_REPEATED: 'RECORD_REPEATED',
  /** More records than the rate ceiling allows. */
  RECORD_RATE_EXCEEDED: 'RECORD_RATE_EXCEEDED',
  /** The interval of a microphone switch no command asked for. */
  SWITCH_NOT_COMMANDED: 'SWITCH_NOT_COMMANDED',
} as const;
export type SupervisorRefusal = (typeof SupervisorRefusal)[keyof typeof SupervisorRefusal];

/**
 * WHY THE CAPTURE WORKER OF A SESSION IS DOWN, AS ONE CLOSED ENUMERATION (wave H driver F; gate 64
 * condition C4, gate 75 finding G75-05; tidy pass F-Y decision 6). Every way the supervisor can end
 * a worker, or find it ended, maps to exactly ONE member (`captureDownReasonOf`, `supervisor.ts`):
 * it is `WorkerDown.reason`, it is the `cause` of the supervisor's own `CAPTURE_FAULT` warning, and
 * the forwarder hands it to the engine as the fault's `reason` - so the operator reads WHY, and the
 * alert and its `FAULT_RAISED` row carry the code. Each member has its own sentence in the shared
 * wording source (`@dems/shared/sim` `capture-fault-wording.ts`); `fault-wording.test.ts` enumerates
 * this object, so a member without a sentence fails a test.
 *
 * The members are the supervisor's own literals: never a text of the worker. A worker's `CRASH`
 * code is NOT repeated here (it stays in `WorkerDown.detail`, for the log) - except the protocol's
 * enumerated final codes (`FINAL_CRASH_CODES`: `NO_CAMERA_CONNECTED`), which are reasons of their own.
 */
export const CaptureDownReason = {
  ...SupervisorRefusal,
  /** The worker process could not be started. */
  WORKER_SPAWN_FAILED: 'WORKER_SPAWN_FAILED',
  /** No worker program is configured for this Core. */
  WORKER_NOT_CONFIGURED: 'WORKER_NOT_CONFIGURED',
  /** The worker said no `HELLO` within the limit. */
  WORKER_HELLO_TIMEOUT: 'WORKER_HELLO_TIMEOUT',
  /** The worker speaks another version of the capture protocol. */
  WORKER_PROTOCOL_MISMATCH: 'WORKER_PROTOCOL_MISMATCH',
  /** The worker is a proof build (a negative control): never recorded with. */
  WORKER_PROOF_BUILD: 'WORKER_PROOF_BUILD',
  /** The worker names a version that is no release word. */
  WORKER_VERSION_UNKNOWN: 'WORKER_VERSION_UNKNOWN',
  /** The worker is a release build of ANOTHER version than this Core drives. */
  WORKER_VERSION_MISMATCH: 'WORKER_VERSION_MISMATCH',
  /** The worker refuses to run on a media library it was not verified against. */
  WORKER_MEDIA_LIBRARY_MISMATCH: 'WORKER_MEDIA_LIBRARY_MISMATCH',
  /** A line of the worker is no frame of the protocol (the channel's own check). */
  WORKER_FRAME_INVALID: 'WORKER_FRAME_INVALID',
  /** The worker refused `START` because a file is already at an output path: nothing is overwritten. */
  WORKER_OUTPUT_EXISTS: 'WORKER_OUTPUT_EXISTS',
  /** The worker refused `START` with another code of its own. */
  WORKER_START_REFUSED: 'WORKER_START_REFUSED',
  /** The worker did not answer `START` within the limit. */
  WORKER_START_TIMEOUT: 'WORKER_START_TIMEOUT',
  /** No valid heartbeat within the limit: the worker was ended. */
  WORKER_HEARTBEAT_TIMEOUT: 'WORKER_HEARTBEAT_TIMEOUT',
  /** The worker gave up by itself: it said `CRASH` (its code is `WorkerDown.detail`). */
  WORKER_CRASHED: 'WORKER_CRASHED',
  /** The worker process was ended by a signal it did not get from the supervisor's stop (killed from outside, or by the system). */
  WORKER_KILLED: 'WORKER_KILLED',
  /** The worker process ended with a code other than 0 and said nothing. */
  WORKER_EXIT_NONZERO: 'WORKER_EXIT_NONZERO',
  /** The worker process ended with code 0 while its session was still recording. */
  WORKER_EXIT_UNEXPECTED: 'WORKER_EXIT_UNEXPECTED',
  /** A stop: the worker left with code 0 and never acknowledged the `STOP`. */
  WORKER_STOP_NOT_ACKNOWLEDGED: 'WORKER_STOP_NOT_ACKNOWLEDGED',
  /** A stop: the worker left without the record that ends the audio timeline it had begun. */
  WORKER_TIMELINE_END_MISSING: 'WORKER_TIMELINE_END_MISSING',
  /** A stop: the grace ran out and the supervisor KILLED the worker. */
  STOP_TIMEOUT: 'STOP_TIMEOUT',
  /** The protocol's final crash code: no camera connected within the ingest-open window. */
  NO_CAMERA_CONNECTED: 'NO_CAMERA_CONNECTED',
} as const;
export type CaptureDownReason = (typeof CaptureDownReason)[keyof typeof CaptureDownReason];

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
  /**
   * WHY, as one member of the closed enumeration `CaptureDownReason` (wave H driver F). The
   * supervisor ALWAYS sets it; it is optional in the type only so that a test double written before
   * it still compiles - a reader treats an absent reason as "not stated".
   */
  readonly reason?: CaptureDownReason;
}

/**
 * THE END OF ONE CAMERA INSIDE A SESSION THAT GOES ON (wave H driver F; gate 64 condition C3, gate
 * 89 section 7). The worker gives a camera up - it never connected, its stream ended, its clock was
 * refused by the clock floor - with a `CAPTURE_FAULT` warning naming the camera, and keeps
 * recording the others. The supervisor keeps, per camera, WHICH, WHY and WHEN:
 *
 *   reason                   the worker's reason, one of `CAMERA_END_REASONS` (a closed set)
 *   at                       the Core's clock when the supervisor read the statement (epoch ms)
 *   lastDurableFragmentIndex the index of the last fragment of that camera file the worker had
 *   lastDurableMediaEndMs    reported durable (`FRAGMENT_CHECKPOINT`) BEFORE the statement, and where
 *                            it ends on the file's media timeline (`mediaStartMs + mediaDurationMs`);
 *                            both null when no fragment of the camera was durable yet
 *
 * A LOWER BOUND, STATED AS ONE: the fragment that was open when the camera ended is closed and
 * synced after the statement, so the file may hold up to one fragment more of that camera's video
 * than `lastDurableMediaEndMs` says; the file's own checkpoints are the truth of what it holds.
 * Camera conditions do not end inside a session (protocol 4): an end stays for the session.
 */
export interface CaptureCameraEnd {
  readonly deviceId: string;
  readonly reason: CaptureCameraEndReason;
  readonly at: number;
  readonly lastDurableFragmentIndex: number | null;
  readonly lastDurableMediaEndMs: number | null;
}
/** The reasons of the protocol's `CAPTURE_FAULT` warning that END a camera for its session. */
export const CAMERA_END_REASONS = [
  'CAMERA_NOT_CONNECTED',
  'CAMERA_ANNOUNCE_NOT_MATCHED',
  'CAMERA_ANNOUNCE_NOT_SEEN',
  'CAMERA_NO_PICTURE',
  'CAMERA_STREAM_ENDED',
  'CAMERA_CLOCK_OUT_OF_BOUND',
] as const satisfies readonly CaptureWarningReason[];
export type CaptureCameraEndReason = (typeof CAMERA_END_REASONS)[number];
/**
 * A CAMERA THAT NEVER DELIVERED, BY WHAT IT MEANS FOR THE SESSION (task 4 row 182; controller ruling
 * C35, which keeps ruling D72(k) of task 3). The worker ends such a camera with one of four reasons;
 * no file exists for it. The two sets below are disjoint and together are those four.
 *
 * (a) `CAMERA_ABSENT_REASONS` - a MISSING camera: nothing arrived within the ingest-open window, or
 *     its own push announced the session's address, completed the handshake and brought no picture
 *     (a camera or relay that stalled or died). The degraded start stays: the session records with
 *     the other camera and a WARNING names the missing one. No critical fault of the camera.
 * (b) `CAMERA_INTEGRITY_REASONS` - a client reached the camera's listener WITHOUT the session's
 *     address (it announced another, or twice), or the worker could not see an announce line at
 *     all and so cannot tell whose push it was. Nothing of that arrival is a recording of that
 *     camera. A critical capture fault of the camera states the cause, with its audit entry.
 */
export const CAMERA_ABSENT_REASONS = ['CAMERA_NOT_CONNECTED', 'CAMERA_NO_PICTURE'] as const satisfies readonly CaptureCameraEndReason[];
export const CAMERA_INTEGRITY_REASONS = ['CAMERA_ANNOUNCE_NOT_MATCHED', 'CAMERA_ANNOUNCE_NOT_SEEN'] as const satisfies readonly CaptureCameraEndReason[];
/** True for a worker reason of set (a). */
export const isCameraAbsentReason = (reason: string | null): boolean => reason !== null && (CAMERA_ABSENT_REASONS as readonly string[]).includes(reason);
/** True for a worker reason of set (b). */
export const isCameraIntegrityReason = (reason: string | null): boolean => reason !== null && (CAMERA_INTEGRITY_REASONS as readonly string[]).includes(reason);

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
  /**
   * The cameras of the OPEN session the worker gave up while the session went on, in the order it
   * said so (wave H driver F; see `CaptureCameraEnd`). Empty when none, and when no session is open.
   * Optional in the type for a test double written before it.
   */
  readonly cameraEnds?: readonly CaptureCameraEnd[];
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
  | (EventBase & {
      readonly name: 'warning';
      readonly action: 'raiseCaptureWarning';
      readonly code: CaptureWarningCode;
      readonly reason: CaptureWarningReason | null;
      readonly state: CaptureWarningState;
      readonly subject: string | null;
      readonly source: 'worker' | 'supervisor';
      /**
       * The supervisor's own `CAPTURE_FAULT` only (wave H driver F): WHY the worker is down for good,
       * the `reason` of the `WorkerDown` that raised it. The protocol's `reason` stays null for it (it
       * is no reason of a `WARNING` frame); the forwarder hands `cause` to the engine as the fault's reason.
       */
      readonly cause?: CaptureDownReason;
    })
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
 * WHAT A SESSION HANDS TO `start` BESIDE ITS PLAN (task 4 row 179; security requirement BR-07 (2)).
 * A worker that is started again inside a session is never sent the addresses of an earlier worker:
 * before it is started, the supervisor builds a new ingest address for every camera of the plan
 * with the one function of the capture unit (`captureIngestAddress`) and tells the session, which
 * hands the same strings to whatever pushes to that worker. The supervisor may import no source of
 * chance (static rule G-R8), so the session hands its own in.
 */
export interface CaptureAttemptIngest {
  /** The source of chance of the address function: asked once per camera and attempt, for 16 bytes. */
  readonly chance: CaptureIngestChance;
  /**
   * Called ONCE per attempt after the first, BEFORE the worker of that attempt is started, in the
   * same turn: the address of each camera of the plan for that attempt, by device. The strings are
   * a secret of the session: the receiver keeps them for the camera opens of that attempt and
   * writes them nowhere. A call that throws starts no worker (the capture ends with its fault).
   */
  renewed(attempt: number, addresses: ReadonlyMap<string, string>): void;
  /**
   * OPTIONAL (task 4 row 191). Called ONCE per attempt after the first, after `renewed`, in the same
   * turn. The worker of that attempt is started only when the promise has settled: a microphone is
   * fed by a source that starts once, so the session closes the sources of the earlier worker and
   * opens them again meanwhile, and the pipe a plan names exists when the worker reads the plan.
   *
   * It resolves with the input of every microphone that is open for that attempt, by device: that
   * attempt's plan holds those microphones of the plan the session was started with, each with the
   * input given here, and no other. A promise that rejects, and a result that makes no plan of the
   * protocol (no microphone in the active role), start NO worker and are not tried again (the
   * capture ends with its fault), as a plan whose addresses could not be renewed.
   *
   * The supervisor sets no bound on it: the receiver bounds its own work and always settles. A
   * receiver whose promise is settled when it is asked costs the restart no time beyond one turn;
   * the back-off itself is not moved. Left out, the worker is started in the same turn, as before.
   */
  sources?(attempt: number): Promise<ReadonlyMap<string, CapturePlanMic['input']>>;
}

/**
 * The `capture` seam (spec §A.3). `boot` and `shutdown` are the two calls of the entry point
 * (spec §B.2 "the supervisor is started at boot and stopped at shutdown"; §I edits 11 and 12).
 */
export interface CaptureSupervisor {
  /** Opens the supervisor for sessions. Starts no worker: a worker lives for one session. */
  boot(): Promise<void>;
  /** Stops the open session's worker (reason `SHUTDOWN`), waits for it to exit, and closes. Safe to call twice. */
  shutdown(): Promise<void>;
  /**
   * One session = one worker process and one file per camera. Resolves when the worker acknowledged `START`.
   * `attempts` (task 4 row 179; BR-07 (2)): what gives every LATER worker of the session ingest addresses of
   * its own. Left out, a later worker is sent the plan as it was given (a double, a plan without a secret).
   */
  start(sessionId: string, plan: CapturePlan, attempts?: CaptureAttemptIngest): Promise<void>;
  /**
   * Stops the session's worker and waits for it to exit. Resolves at once when no session is open.
   * Resolves with HOW the stop ended (`CaptureStopOutcome`): a caller that seals the recording must
   * read `clean` - a stop that is not clean is an interrupted recording, never a normal one.
   */
  stop(sessionId: string, reason: CaptureStopReason): Promise<CaptureStopOutcome>;
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

/**
 * HOW A STOP ENDED (review R63-01; ruling D179). A stop is CLEAN only when the session's worker
 * acknowledged the `STOP`, wrote the record that ends the audio timeline it had begun, and exited
 * with code 0 and no signal. Anything else - a `CRASH` frame while it closed (a failed final sync,
 * a file that could not be closed), a non-zero exit, an exit without the acknowledgement, the kill
 * at the stop grace, or a worker that was already down for good - is NOT clean: the recording was
 * INTERRUPTED and `down` names the cause. The same `down` is `status().lastCrash`, and - when the
 * worker went down DURING this stop - it was said as a `workerDown` event (`restartInMs: null`)
 * before the phase went idle. A session whose worker never recorded (it was stopped before it
 * acknowledged `START`), and a call when no session is open, have nothing to interrupt: clean.
 *
 * WHO ACTS ON IT: the capture-session unit maps a stop that is not clean to its `INTERRUPTED`
 * hand-off, so that the seal takes the durable-prefix path and the manifest says interrupted
 * (OD-08). The supervisor only states the fact.
 */
export interface CaptureStopOutcome {
  readonly clean: boolean;
  /** Why the stop is not clean; null when it is. */
  readonly down: WorkerDown | null;
  /**
   * The cameras the worker gave up while the session went on (wave H driver F; `CaptureCameraEnd`):
   * WHICH camera ended, WHY and WHEN - for a stop that is CLEAN as well (one camera lost, the other
   * recorded to the end). Absent when none ended. The same list is `status().cameraEnds` until the stop.
   */
  readonly cameraEnds?: readonly CaptureCameraEnd[];
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
