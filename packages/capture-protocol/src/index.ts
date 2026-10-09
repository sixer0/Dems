/**
 * The IPC protocol between the capture supervisor (Core server) and the capture worker process
 * (blueprint row 57 / M3-W1; register NM-03; capture spec §A.3, §B.2).
 *
 * WHAT THIS PACKAGE IS. The one definition of the messages both sides exchange: their names, their
 * payloads (zod schemas, the monorepo's validation library), the frame format and the timing
 * defaults of the supervisor. It imports no Node module and nothing of the simulator: the
 * supervisor (`apps/core-server/src/capture`) and any TypeScript test double read it, and the C
 * worker (row 58, Q-WORKER a) implements the same frames by hand against this file.
 *
 * THE FRAME. One message is one line of UTF-8 JSON ended by `\n` (NDJSON) on the worker's standard
 * streams: the supervisor writes commands to the worker's standard input, the worker writes its
 * messages to its standard output. Standard error is free text for a human and is never parsed.
 * No socket and no port is opened for IPC. A line longer than `maxFrameChars`, a line that is not
 * JSON, and a JSON value that is no message of this protocol are PROTOCOL VIOLATIONS: the
 * supervisor ends such a worker.
 *
 * THE MESSAGES (spec §B.2). The eight of the spec's table, plus the two the table implies and
 * does not name: `HELLO` (the handshake the worker opens with, which carries the protocol
 * version) and `ACK` (the worker's answer to a command, matched by correlation ID); and, since
 * version 2 (blueprint row 58, spec §B.2 "REQUIRED WORK" R-1 to R-4), `RECORD`.
 *
 *   supervisor -> worker   START, STOP, SWITCH_AUDIO_SOURCE
 *   worker -> supervisor   HELLO, ACK, TELEMETRY, PROGRESS, HEARTBEAT, WARNING, CRASH, RECORD
 *
 * LEVELS AND RECORDS. `TELEMETRY` and `PROGRESS` are LEVELS: the supervisor hands them on through
 * a bounded queue that replaces and evicts them, and a worker `WARNING` travels the same queue.
 * A `RECORD` is the one LOSSLESS class: first video sample, first durable fragment, fragment
 * checkpoint, seal completion. The supervisor handles it the moment its line arrives, beside `ACK`, and never puts
 * it in that queue. Every record carries `seq`: a worker counts its records from 1, by exactly 1;
 * a gap or a repeat is a protocol violation that ends the worker. A session gets a second worker
 * only while it holds no durable fragment, so the fragment records of one session are always ONE
 * sequence. THE FILE IS THE
 * TRUTH, THE FRAME IS A HINT: a record tells the Core early what the camera file already holds;
 * what is authoritative is the file itself, read again by the box walk of spec §C.5 at RECOVERY.
 * Nothing may be decided from the ABSENCE of a record.
 *
 * RECORDS ARE LOW-RATE BY CONTRACT (fix round 1, navigator finding A-5). A worker writes: one
 * first-video-sample and one first-durable-fragment per camera, one checkpoint per fragment per
 * camera, one seal completion. A fragment is a camera GOP of about 2 s (never shorter than a
 * stall cut every `fragmentTargetMs`), so two cameras write about 2 records a second at most.
 * The supervisor does not queue records and waits for no listener, so a record flood would grow
 * memory in whoever consumes them: more than `recordBurstLimit` records inside `recordWindowMs`
 * is therefore a PROTOCOL VIOLATION that ends the worker. A consumer still bounds its own
 * backlog: it must not hold a record waiting on a slow store without a limit of its own.
 *
 * IDENTITIES (decision D72, navigator finding A-1). Every device a frame names - the `deviceId`
 * of an ingest state, a fragment counter, a clock entry or a record, and the `subject` of a
 * warning - is a CAPTURE DEVICE ID, the vocabulary of the capture-config tables and of the
 * engine (`CAM-01`, `CAM-02`, `MIC-01`, `MIC-02`), or a mic role. `VIDEO-01` / `VIDEO-02` are
 * names of output TRACKS: a plan carries one per camera as `trackId`, and no frame carries it.
 *
 * CORRELATION IDS. Every command carries the `sessionId` and a `correlationId` chosen by the
 * supervisor; the worker copies the correlation ID into the `ACK` of that command. A worker learns
 * its session from `START`, so `HELLO`, `HEARTBEAT` and `ACK` carry no session, and every message
 * about a recording (`TELEMETRY`, `PROGRESS`, `WARNING`) carries the `sessionId` it belongs to. A
 * log line of either side names both IDs, so one recording is traceable end to end.
 *
 * RULES THE WORKER MUST KEEP (the supervisor relies on them):
 *   - it writes `HELLO` first, before anything else, and `HEARTBEAT` from then on with a counter
 *     that only grows;
 *   - it serves ONE session and then exits: a second `START` is refused with `ACK ok=false`
 *     (`SESSION_ALREADY_SERVED`). The RTSP listen ingest exits on the client's TEARDOWN and
 *     refuses a re-push, so the supervisor starts a fresh process per session (S1 G-1, D10(b));
 *   - it exits when its standard input ends: a worker whose supervisor died is never an orphan;
 *   - it never switches the audio source by itself (OD-11): `MIC_SILENT` is a warning.
 *   - it NEVER truncates or overwrites an output file that already exists (OD-08: the bytes
 *     already written are evidence). Decided by D67, option C: a worker creates a camera file
 *     only when its first fragment is complete, and only if nothing is at that path. A `START`
 *     whose `attempt` is above 1 is a restart inside a session, which the supervisor makes only
 *     while the session has no durable fragment; it names the SAME output paths. A worker that
 *     finds a file at one of them refuses the `START` (`OUTPUT_EXISTS`) and the session ends
 *     `FAULTED`: no restarted worker ever writes into an existing evidence file. THIS RULE OF
 *     THE WORKER, checked on the disk, is what makes a restart safe; the version a worker says
 *     in `HELLO` proves nothing about it. The file appears under its final name only once it
 *     holds its init segment and one whole fragment (it is written under a temporary name and
 *     linked), so a file at an output path always means durable media;
 *   - it reports the first fragment of each camera file that reached the disk with a `RECORD`
 *     (`FIRST_DURABLE_FRAGMENT`), at once;
 *   - it owns no datagram socket, and every socket it owns is on 127.0.0.1 (SEC35-23);
 *   - it keeps writing `HEARTBEAT` whatever else it writes: the supervisor reads its output at all
 *     times and never pauses it, and it drops telemetry it cannot hand on rather than slow down.
 */
import { z } from 'zod';

/** Version of this protocol. The worker names it in `HELLO`; a mismatch ends the worker. */
export const CAPTURE_PROTOCOL_VERSION = 2;

/**
 * The loopback media ports (spec §A.8: fixture readers and the worker ingest listen only on
 * `127.0.0.1:8554-8564`). The plan refuses any other port, and the worker checks the same range.
 */
export const CAPTURE_MEDIA_PORT_MIN = 8554;
export const CAPTURE_MEDIA_PORT_MAX = 8564;

/** The messages of the protocol, by direction. */
export const SupervisorMessageType = {
  START: 'START',
  STOP: 'STOP',
  SWITCH_AUDIO_SOURCE: 'SWITCH_AUDIO_SOURCE',
} as const;
export type SupervisorMessageType = (typeof SupervisorMessageType)[keyof typeof SupervisorMessageType];

export const WorkerMessageType = {
  HELLO: 'HELLO',
  ACK: 'ACK',
  TELEMETRY: 'TELEMETRY',
  PROGRESS: 'PROGRESS',
  HEARTBEAT: 'HEARTBEAT',
  WARNING: 'WARNING',
  CRASH: 'CRASH',
  RECORD: 'RECORD',
} as const;
export type WorkerMessageType = (typeof WorkerMessageType)[keyof typeof WorkerMessageType];

/** Why a session's worker is stopped (spec §A.3 `stop`). */
export const CaptureStopReason = { STOPPED: 'STOPPED', CRASH: 'CRASH', SHUTDOWN: 'SHUTDOWN' } as const;
export type CaptureStopReason = (typeof CaptureStopReason)[keyof typeof CaptureStopReason];

/** The two mic roles (the values of `MicRole` in `@dems/shared/domain`). */
export const CaptureMicRole = { PRIMARY: 'PRIMARY', STANDBY: 'STANDBY' } as const;
export type CaptureMicRole = (typeof CaptureMicRole)[keyof typeof CaptureMicRole];

/** The warnings a worker raises (spec §B.2). Never an automatic switch (OD-11). */
export const CaptureWarningCode = { MIC_SILENT: 'MIC_SILENT', CAPTURE_FAULT: 'CAPTURE_FAULT' } as const;
export type CaptureWarningCode = (typeof CaptureWarningCode)[keyof typeof CaptureWarningCode];

/** Whether a warning's condition began or ended. */
export const CaptureWarningState = { ACTIVE: 'ACTIVE', CLEARED: 'CLEARED' } as const;
export type CaptureWarningState = (typeof CaptureWarningState)[keyof typeof CaptureWarningState];

/**
 * What a worker refuses a `START` with when another try cannot change the answer: the plan is
 * the same and so is the disk. The supervisor does not restart for these (finding A-7).
 * `OUTPUT_EXISTS` also marks the session durable.
 */
export const FINAL_START_REFUSALS: readonly string[] = ['OUTPUT_EXISTS', 'PLAN_INVALID', 'PLAN_UNSUPPORTED', 'OUTPUT_DIR_MISSING', 'MIC_INPUT_NOT_FIFO', 'TAP_PATH_OCCUPIED', 'SESSION_ALREADY_SERVED'];
/**
 * What a worker says in `CRASH` when a new worker would end the same way: no camera connected
 * within the ingest window (decision D72(k): such a session is not left running audio-only).
 */
export const FINAL_CRASH_CODES: readonly string[] = ['NO_CAMERA_CONNECTED'];

/** State of one RTSP ingest as the worker reports it. */
export const CaptureIngestState = { WAITING: 'WAITING', CONNECTED: 'CONNECTED', ENDED: 'ENDED' } as const;
export type CaptureIngestState = (typeof CaptureIngestState)[keyof typeof CaptureIngestState];

/** The records of the lossless class (spec §B.2 R-1; `FIRST_VIDEO_SAMPLE` added by the mux-flag decision of row 58, spec §C.4). */
export const CaptureRecordKind = {
  /**
   * The true time of the first video sample of one camera file. Under the pinned mux flags the
   * muxer holds that sample from file time 0 (spec §C.4 "held first frame"): the manifest needs
   * the true value, and it is stated once, here. Not a sign of durability.
   */
  FIRST_VIDEO_SAMPLE: 'FIRST_VIDEO_SAMPLE',
  /** The first fragment of one camera file is on the disk: from here on the session holds evidence. */
  FIRST_DURABLE_FRAGMENT: 'FIRST_DURABLE_FRAGMENT',
  /** One fragment's checkpoint (spec §A.5 `FragmentCheckpoint`). Produced by the fMP4 writer row. */
  FRAGMENT_CHECKPOINT: 'FRAGMENT_CHECKPOINT',
  /** Sealing finished. Never read from `PROGRESS` with progress 1, which is a level and can be evicted. */
  SEAL_COMPLETE: 'SEAL_COMPLETE',
} as const;
export type CaptureRecordKind = (typeof CaptureRecordKind)[keyof typeof CaptureRecordKind];

/** How a mic's samples reach the worker. One kind today; the adapter rows add the device kinds. */
export const CaptureMicInputKind = {
  /**
   * A named pipe the worker reads raw PCM from: 32-bit float, little-endian, at the plan's sample
   * rate and channel count. Written by another process (a fixture, or an adapter process).
   */
  PCM_FIFO: 'PCM_FIFO',
} as const;
export type CaptureMicInputKind = (typeof CaptureMicInputKind)[keyof typeof CaptureMicInputKind];

/**
 * The INTERNAL action of the shared simulator each worker message is meant for (spec §B.1,
 * register SH-18). The names are the specification's; the actions themselves are not part of this
 * package. `completeSeal` has no message of its own in §B.2: the sealing rows define its trigger.
 */
export const CAPTURE_INTERNAL_ACTION = {
  TELEMETRY: 'applyCaptureTelemetry',
  PROGRESS: 'applySealingProgress',
  WARNING: 'raiseCaptureWarning',
} as const satisfies Partial<Record<WorkerMessageType, string>>;

// ── Limits and timing defaults ────────────────────────────────────────────────────────────────

/**
 * Defaults of the supervisor. Row 57 chose them without a measurement (decision D57-4); row 58
 * measured the real worker on this host and kept each value, with the margin stated beside it
 * (raw numbers: `implementation/20_m3_worker_engine.md`, "Measured timing"). They are engineering
 * parameters of one host, not a benchmark: a slower host changes a value here, in one place.
 */
export const CAPTURE_IPC_DEFAULTS = {
  /** Longest line of a frame, in UTF-16 code units. A longer line is a protocol violation. */
  maxFrameChars: 65_536,
  /** The worker must say `HELLO` within this time of being started. Measured: 19 to 37 ms warm, up to 417 ms for the first start of a fresh binary. */
  helloTimeoutMs: 5_000,
  /** The worker must `ACK` a command within this time. Measured: START 0.4 to 0.8 ms; a switch, acknowledged when it is applied, 0.5 to 10.4 ms. */
  ackTimeoutMs: 5_000,
  /** The interval the worker sends `HEARTBEAT` at. Measured arrival intervals at 500 ms: 493.5 to 507.3 ms. */
  heartbeatIntervalMs: 500,
  /** No valid `HEARTBEAT` for this long (five intervals): the worker is ended, and restarted if the restart rule allows it. */
  heartbeatTimeoutMs: 2_500,
  /** After `STOP`, the worker has this long to flush and exit before it is killed. Measured from STOP to the exit: 6.5 to 15.4 ms. */
  stopGraceMs: 5_000,
  /** First delay of the restart back-off. */
  backoffBaseMs: 250,
  /** Each further restart waits this many times longer. */
  backoffFactor: 2,
  /** No restart waits longer than this. */
  backoffMaxMs: 8_000,
  /** Restarts in a row before the supervisor gives up and raises `CAPTURE_FAULT`. */
  maxRestarts: 5,
  /**
   * A worker that ran this long without a crash clears the count of restarts. Under the restart
   * rule of D67 (no restart once a fragment is durable, i.e. after a few seconds of recording) a
   * session rarely gets this old with restarts still possible; the value is kept for the worker
   * that waits long for its cameras.
   */
  stableAfterMs: 30_000,
  /** Hard bound of the worker events that wait for a listener: beyond it levels are replaced or evicted, never queued. */
  eventQueueLimit: 256,
  /** Commands awaiting their `ACK` before a new command is refused (back-pressure). */
  commandQueueLimit: 16,
  /**
   * Most records inside `recordWindowMs`. The contract rate is about 2 a second (two cameras,
   * one checkpoint per fragment of about 2 s, plus five one-off records); 64 in a second is 32
   * times that and still a finite inflow for a consumer. One more ends the worker.
   */
  recordBurstLimit: 64,
  recordWindowMs: 1_000,
} as const;
export type CaptureIpcLimits = { readonly [Key in keyof typeof CAPTURE_IPC_DEFAULTS]: number };

// ── Payloads ──────────────────────────────────────────────────────────────────────────────────

const id = z.string().min(1).max(128);
const wholeNumber = z.number().int().nonnegative();

/**
 * An RTSP listen address of the worker: loopback only (SEC35-23), an explicit port, a path, no
 * credentials and no trailing slash (S1 SP-1: a trailing slash is one of the four pinned traps).
 */
export const LOOPBACK_RTSP_URL = /^rtsp:\/\/127\.0\.0\.1:([1-9][0-9]{0,4})\/[A-Za-z0-9._~-]+(?:\/[A-Za-z0-9._~-]+)*$/;
const loopbackRtspUrl = z
  .string()
  .max(256)
  .regex(LOOPBACK_RTSP_URL)
  .refine((url) => {
    const port = Number(LOOPBACK_RTSP_URL.exec(url)?.[1]);
    return port >= CAPTURE_MEDIA_PORT_MIN && port <= CAPTURE_MEDIA_PORT_MAX;
  }, 'the port is outside the loopback media range');
/** An absolute path. Never logged, never part of an event. */
const absolutePath = z.string().min(1).max(1024).startsWith('/');

export const CapturePlanCameraSchema = z.strictObject({
  /** The capture device: `CAM-01` or `CAM-02`. What every frame about this camera names. */
  deviceId: id,
  /** The output track this camera records: `VIDEO-01` or `VIDEO-02`. A name in the plan only. */
  trackId: id,
  /** The profile of a dual-lens camera, or null (OD-05). */
  profile: z.string().min(1).max(64).nullable(),
  /** Where the worker listens for this camera's RTSP push. */
  ingestUrl: loopbackRtspUrl,
  /**
   * The camera file of this session, an absolute path under the media root (OD-25). The worker
   * creates it when its first fragment is complete and refuses a path that already holds a file.
   */
  outputPath: absolutePath,
});
export type CapturePlanCamera = z.infer<typeof CapturePlanCameraSchema>;

export const CapturePlanMicSchema = z.strictObject({
  /** `MIC-01` or `MIC-02`. */
  deviceId: id,
  role: z.enum(CaptureMicRole),
  /** Where this mic's samples come from. */
  input: z.discriminatedUnion('kind', [z.strictObject({ kind: z.literal(CaptureMicInputKind.PCM_FIFO), path: absolutePath })]),
});
export type CapturePlanMic = z.infer<typeof CapturePlanMicSchema>;

/** The contract constants a worker records with (`@dems/shared/api` `capture.ts`; never restated in the worker). */
export const CapturePlanConstantsSchema = z.strictObject({
  fragmentTargetMs: wholeNumber.positive(),
  minFragDurationMs: wholeNumber.positive(),
  gopFrames: wholeNumber.positive(),
  meterRateHz: wholeNumber.positive(),
  audioSampleRateHz: wholeNumber.positive(),
  audioChannels: wholeNumber.positive(),
});
export type CapturePlanConstants = z.infer<typeof CapturePlanConstantsSchema>;

/**
 * What one session records: devices, profiles, outputs, constants (spec §B.2 `START`). One
 * session is one worker process and one output file per camera.
 */
export const CapturePlanSchema = z
  .strictObject({
    cameras: z.array(CapturePlanCameraSchema).min(1).max(2),
    mics: z.array(CapturePlanMicSchema).min(1).max(2),
    /** The role whose input feeds the one audio encoder at the start. */
    activeMic: z.enum(CaptureMicRole),
    /**
     * The PCM tap, or null: where the worker also writes the samples that feed the encoder, as
     * signed 16-bit little-endian PCM at the plan's sample rate. Sample `n` of the tap is sample
     * `n` since T0 (see `CAPTURE_MEDIA_TIME_ORIGIN_SAMPLES`). A named pipe is written without
     * ever blocking the recording; a path that holds a regular file is refused.
     */
    pcmTapPath: absolutePath.nullable(),
    constants: CapturePlanConstantsSchema,
  })
  .superRefine((plan, context) => {
    const unique = (values: readonly string[]): boolean => new Set(values).size === values.length;
    if (!unique(plan.cameras.map((camera) => camera.deviceId))) context.addIssue({ code: 'custom', message: 'a camera is named twice', path: ['cameras'] });
    if (!unique(plan.cameras.map((camera) => camera.trackId))) context.addIssue({ code: 'custom', message: 'a track is recorded twice', path: ['cameras'] });
    if (!unique(plan.cameras.map((camera) => camera.ingestUrl))) context.addIssue({ code: 'custom', message: 'two cameras share an ingest address', path: ['cameras'] });
    if (!unique(plan.cameras.map((camera) => camera.outputPath))) context.addIssue({ code: 'custom', message: 'two cameras share an output file', path: ['cameras'] });
    if (!unique(plan.mics.map((mic) => mic.deviceId))) context.addIssue({ code: 'custom', message: 'a mic is named twice', path: ['mics'] });
    if (!unique(plan.mics.map((mic) => mic.role))) context.addIssue({ code: 'custom', message: 'a mic role is held twice', path: ['mics'] });
    const paths = [...plan.cameras.map((camera) => camera.outputPath), ...plan.mics.map((mic) => mic.input.path), ...(plan.pcmTapPath === null ? [] : [plan.pcmTapPath])];
    if (!unique(paths)) context.addIssue({ code: 'custom', message: 'one path is used twice', path: ['cameras'] });
    if (!plan.mics.some((mic) => mic.role === plan.activeMic)) context.addIssue({ code: 'custom', message: 'no mic holds the active role', path: ['activeMic'] });
  });
export type CapturePlan = z.infer<typeof CapturePlanSchema>;

// ── Messages ──────────────────────────────────────────────────────────────────────────────────

const version = { v: z.literal(CAPTURE_PROTOCOL_VERSION) };
/** A message about one recording. */
const envelope = { ...version, sessionId: id };
const command = { ...envelope, correlationId: id };

export const StartMessageSchema = z.strictObject({
  ...command,
  type: z.literal(SupervisorMessageType.START),
  /** 1 for the first worker of a session; grows with every restart of that session. */
  attempt: wholeNumber.positive(),
  plan: CapturePlanSchema,
});
export const StopMessageSchema = z.strictObject({ ...command, type: z.literal(SupervisorMessageType.STOP), reason: z.enum(CaptureStopReason) });
export const SwitchAudioSourceMessageSchema = z.strictObject({ ...command, type: z.literal(SupervisorMessageType.SWITCH_AUDIO_SOURCE), to: z.enum(CaptureMicRole) });

export const SupervisorMessageSchema = z.discriminatedUnion('type', [StartMessageSchema, StopMessageSchema, SwitchAudioSourceMessageSchema]);
export type SupervisorMessage = z.infer<typeof SupervisorMessageSchema>;
export type StartMessage = z.infer<typeof StartMessageSchema>;
export type StopMessage = z.infer<typeof StopMessageSchema>;
export type SwitchAudioSourceMessage = z.infer<typeof SwitchAudioSourceMessageSchema>;

/** A short machine code: capitals, digits and underscores. Never free text. */
const code = z.string().regex(/^[A-Z][A-Z0-9_]{0,63}$/);

export const HelloMessageSchema = z.strictObject({
  ...version,
  type: z.literal(WorkerMessageType.HELLO),
  /** The protocol version the worker speaks. */
  protocolVersion: wholeNumber,
  /** The worker's own version, for the log. */
  workerVersion: z.string().min(1).max(64),
});
export const AckMessageSchema = z.strictObject({
  ...version,
  /** The correlation ID of the command this answers. */
  correlationId: id,
  type: z.literal(WorkerMessageType.ACK),
  ok: z.boolean(),
  /** Why the command was refused; absent when `ok`. */
  code: code.optional(),
});
export const TelemetryMessageSchema = z.strictObject({
  ...envelope,
  type: z.literal(WorkerMessageType.TELEMETRY),
  /** One entry per mic role: the level in dBFS (null: no samples). */
  levels: z.array(z.strictObject({ role: z.enum(CaptureMicRole), dbfs: z.number().max(0).nullable(), clipped: z.boolean() })).max(2),
  ingest: z.array(z.strictObject({ deviceId: id, state: z.enum(CaptureIngestState) })).max(2),
  /** Fragments written so far, per camera file. */
  fragments: z.array(z.strictObject({ deviceId: id, count: wholeNumber, bytes: wholeNumber })).max(2),
  /**
   * Per camera that delivers video: arrival time minus camera time of the newest packet (`lagMs`),
   * and the fitted trend of that difference in parts per million (null until enough of the session
   * was seen). TELEMETRY ONLY (spec §F, erratum PE-111-01): nothing is corrected from it.
   * `nearBound`: the trend, over the time seen, has reached three quarters of the AV product bound.
   */
  clocks: z.array(z.strictObject({ deviceId: id, lagMs: z.number(), trendPpm: z.number().nullable(), nearBound: z.boolean() })).max(2),
  /** True while the PCM tap of the plan is being written. False: the plan has none, it ended, or a restarted worker found its file and left it alone. */
  tapActive: z.boolean(),
});
export const ProgressMessageSchema = z.strictObject({
  ...envelope,
  type: z.literal(WorkerMessageType.PROGRESS),
  step: code,
  /** 0 to 1. */
  progress: z.number().min(0).max(1),
  etaMs: wholeNumber.nullable(),
});
export const HeartbeatMessageSchema = z.strictObject({ ...version, type: z.literal(WorkerMessageType.HEARTBEAT), counter: wholeNumber });
export const WarningMessageSchema = z.strictObject({
  ...envelope,
  type: z.literal(WorkerMessageType.WARNING),
  code: z.enum(CaptureWarningCode),
  /**
   * `ACTIVE`: the condition began. `CLEARED`: the worker saw it END (decision D72, finding A-2):
   * a fault a capture warning raised is cleared by the capture side, never by a demo operation.
   */
  state: z.enum(CaptureWarningState),
  /**
   * What the warning is about: a device ID or a mic role OF THE PLAN, or null. Anything else is a
   * protocol violation (the supervisor checks it): a subject is never free text, a credential or
   * an address.
   */
  subject: id.nullable(),
});
export const CrashMessageSchema = z.strictObject({
  ...version,
  /** Null when the worker fails before it was given a session. */
  sessionId: id.nullable(),
  type: z.literal(WorkerMessageType.CRASH),
  /** A machine code of the worker's own choosing. */
  code,
  signal: z.string().max(16).nullable(),
  exitCode: z.number().int().nullable(),
});

/** A SHA-256 as 64 lowercase hexadecimal digits. */
const sha256 = z.string().regex(/^[0-9a-f]{64}$/);

export const FirstVideoSampleRecordSchema = z.strictObject({
  kind: z.literal(CaptureRecordKind.FIRST_VIDEO_SAMPLE),
  deviceId: id,
  /**
   * Presentation time of the first video sample, in ticks of `timescale`, counted from T0 (the
   * capture instant of audio sample 0). Its time in the file is this plus
   * `CAPTURE_MEDIA_TIME_ORIGIN_SAMPLES` audio samples (`@dems/shared/api`).
   */
  pts: wholeNumber,
  /** Ticks per second of the video track. */
  timescale: wholeNumber.positive(),
});
export const FirstDurableFragmentRecordSchema = z.strictObject({
  kind: z.literal(CaptureRecordKind.FIRST_DURABLE_FRAGMENT),
  /** The camera whose file it is. */
  deviceId: id,
  /** Length of that file once the fragment was written. A hint: the file is read again at RECOVERY. */
  bytes: wholeNumber.positive(),
});
/** Spec §A.5 `FragmentCheckpoint`, with its `seq` named `index` (the record's own `seq` is the frame's). */
export const FragmentCheckpointRecordSchema = z.strictObject({
  kind: z.literal(CaptureRecordKind.FRAGMENT_CHECKPOINT),
  deviceId: id,
  /** `mfhd.sequence_number` of the fragment, from 1. */
  index: wholeNumber.positive(),
  /** The stored-byte range `[start, start + len)`. */
  start: wholeNumber,
  len: wholeNumber.positive(),
  fragSha256: sha256,
  chainSha256: sha256,
  prefixSha256: sha256,
  /** Null until the file is encrypted per fragment (OD-03). */
  plaintextSha256: sha256.nullable(),
  gcmIv: z.string().max(64).nullable(),
  gcmTag: z.string().max(64).nullable(),
  keyId: id.nullable(),
});
export const SealCompleteRecordSchema = z.strictObject({ kind: z.literal(CaptureRecordKind.SEAL_COMPLETE) });
export const CaptureRecordSchema = z.discriminatedUnion('kind', [FirstVideoSampleRecordSchema, FirstDurableFragmentRecordSchema, FragmentCheckpointRecordSchema, SealCompleteRecordSchema]);
/** The record kinds that say a fragment is on the disk: from the first of them a session is durable. */
export const DURABLE_RECORD_KINDS: readonly CaptureRecordKind[] = [CaptureRecordKind.FIRST_DURABLE_FRAGMENT, CaptureRecordKind.FRAGMENT_CHECKPOINT];
export type CaptureRecord = z.infer<typeof CaptureRecordSchema>;

/** A record: lossless, in order, never through the event queue (see the header). */
export const RecordMessageSchema = z.strictObject({
  ...envelope,
  type: z.literal(WorkerMessageType.RECORD),
  /** 1 for the first record of this worker, then exactly 1 more each time. */
  seq: wholeNumber.positive(),
  record: CaptureRecordSchema,
});

export const WorkerMessageSchema = z.discriminatedUnion('type', [
  HelloMessageSchema,
  AckMessageSchema,
  TelemetryMessageSchema,
  ProgressMessageSchema,
  HeartbeatMessageSchema,
  WarningMessageSchema,
  CrashMessageSchema,
  RecordMessageSchema,
]);
export type WorkerMessage = z.infer<typeof WorkerMessageSchema>;
export type HelloMessage = z.infer<typeof HelloMessageSchema>;
export type AckMessage = z.infer<typeof AckMessageSchema>;
export type TelemetryMessage = z.infer<typeof TelemetryMessageSchema>;
export type ProgressMessage = z.infer<typeof ProgressMessageSchema>;
export type HeartbeatMessage = z.infer<typeof HeartbeatMessageSchema>;
export type WarningMessage = z.infer<typeof WarningMessageSchema>;
export type CrashMessage = z.infer<typeof CrashMessageSchema>;
export type RecordMessage = z.infer<typeof RecordMessageSchema>;

// ── Frames ────────────────────────────────────────────────────────────────────────────────────

/** Why a line is no frame of this protocol. */
export const FrameViolation = { TOO_LONG: 'FRAME_TOO_LONG', NOT_JSON: 'FRAME_NOT_JSON', NOT_A_MESSAGE: 'FRAME_NOT_A_MESSAGE' } as const;
export type FrameViolation = (typeof FrameViolation)[keyof typeof FrameViolation];

export type DecodedFrame<Message> = { readonly ok: true; readonly message: Message } | { readonly ok: false; readonly violation: FrameViolation };

/** One message as one line, with its line end. */
export function encodeFrame(message: SupervisorMessage | WorkerMessage): string {
  return `${JSON.stringify(message)}\n`;
}

function decodeLine<Message>(line: string, schema: z.ZodType<Message>, maxFrameChars: number): DecodedFrame<Message> {
  if (line.length > maxFrameChars) return { ok: false, violation: FrameViolation.TOO_LONG };
  let value: unknown;
  try {
    value = JSON.parse(line);
  } catch {
    return { ok: false, violation: FrameViolation.NOT_JSON };
  }
  const parsed = schema.safeParse(value);
  return parsed.success ? { ok: true, message: parsed.data } : { ok: false, violation: FrameViolation.NOT_A_MESSAGE };
}

/** One line (without its line end) of the worker's output as a message, or the violation. */
export function decodeWorkerLine(line: string, maxFrameChars: number = CAPTURE_IPC_DEFAULTS.maxFrameChars): DecodedFrame<WorkerMessage> {
  return decodeLine(line, WorkerMessageSchema, maxFrameChars);
}

/** One line (without its line end) of the supervisor's output as a command, or the violation. For a worker written in TypeScript and for tests. */
export function decodeSupervisorLine(line: string, maxFrameChars: number = CAPTURE_IPC_DEFAULTS.maxFrameChars): DecodedFrame<SupervisorMessage> {
  return decodeLine(line, SupervisorMessageSchema, maxFrameChars);
}

export interface LineSplitter {
  /**
   * Takes the next piece of text of a stream and returns the complete lines it ended, without
   * their line ends. A line that grew past `maxFrameChars` before its end is returned as `null`
   * once, and the rest of that line is dropped: the caller reports the violation.
   */
  push(chunk: string): Array<string | null>;
}

/**
 * Cuts a text stream into lines without ever holding more than `maxFrameChars` of an unfinished
 * line: a worker that never writes a line end cannot make the supervisor's memory grow.
 */
export function createLineSplitter(maxFrameChars: number = CAPTURE_IPC_DEFAULTS.maxFrameChars): LineSplitter {
  let pending = '';
  let overflowing = false;
  return {
    push(chunk) {
      const lines: Array<string | null> = [];
      let rest = chunk;
      for (;;) {
        const end = rest.indexOf('\n');
        if (end === -1) break;
        const piece = rest.slice(0, end);
        rest = rest.slice(end + 1);
        if (overflowing) {
          // The end of a line that was already reported as too long.
          overflowing = false;
        } else if (pending.length + piece.length > maxFrameChars) {
          lines.push(null);
        } else {
          const line = pending + piece;
          // An empty line carries nothing; a `\r` before the line end is tolerated.
          if (line.trim() !== '') lines.push(line.endsWith('\r') ? line.slice(0, -1) : line);
        }
        pending = '';
      }
      if (!overflowing) {
        if (pending.length + rest.length > maxFrameChars) {
          pending = '';
          overflowing = true;
          lines.push(null);
        } else {
          pending += rest;
        }
      }
      return lines;
    },
  };
}

// ── Back-off ──────────────────────────────────────────────────────────────────────────────────

/**
 * The delay before restart number `restart` (0 for the first): `base * factor^restart`, never more
 * than `max`. Deterministic: no jitter, one supervisor restarts one worker.
 */
export function backoffDelayMs(restart: number, limits: Pick<CaptureIpcLimits, 'backoffBaseMs' | 'backoffFactor' | 'backoffMaxMs'> = CAPTURE_IPC_DEFAULTS): number {
  if (!Number.isInteger(restart) || restart < 0) throw new RangeError('the number of a restart is a whole number from 0');
  const delay = limits.backoffBaseMs * limits.backoffFactor ** restart;
  return Math.min(limits.backoffMaxMs, Number.isFinite(delay) ? delay : limits.backoffMaxMs);
}
