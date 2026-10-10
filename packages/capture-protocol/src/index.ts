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
 * VERSION 3 (blueprint row 59; decisions D84 R-7, D59-1). Three frame changes, one version step:
 * `WARNING.state` is a required member (it became one inside version 2, which a version exists to
 * prevent: a worker built before it passed `HELLO` and was ended at its first warning); the
 * `FRAGMENT_CHECKPOINT` record carries what the fMP4 writer knows about a durable fragment (both
 * chains, media time, the keyframe flag, the instant it was synced); and the record
 * `KEYFRAME_INTERVAL` is new. A worker of version 2 is refused at `HELLO` (`PROTOCOL_MISMATCH`,
 * not retried), and none of its frames decodes.
 *
 * VERSION 4 (blueprint row 71, worker half "71a"; capture spec §E, §E.1, §C.4; decisions D84 R-1,
 * R-2, D85, D127, D130). One version step for the microphone rows:
 *   - `WARNING` carries a required `reason` (which of the causes of its code it is), its `subject`
 *     is ALWAYS a capture device ID of the plan - never null, never a mic role (one subject form
 *     per microphone) - and the worker now raises and clears `MIC_SILENT`, a microphone that
 *     stopped delivering, and a microphone whose rate controller is held at its limit;
 *   - the records `AUDIO_SOURCE_INTERVAL` (which microphone feeds the one audio track from which
 *     sample on: one at the start, one per realised switch, written BEFORE the `ACK` of that
 *     switch) and `AUDIO_TIMELINE_END` are new;
 *   - `FIRST_VIDEO_SAMPLE` also says how much camera video arrived before it and was not written;
 *   - every `TELEMETRY` level names its microphone by device ID and states the rate correction.
 * A worker of version 3 is refused at `HELLO`, and none of its frames decodes.
 *
 *   supervisor -> worker   START, STOP, SWITCH_AUDIO_SOURCE
 *   worker -> supervisor   HELLO, ACK, TELEMETRY, PROGRESS, HEARTBEAT, WARNING, CRASH, RECORD
 *
 * LEVELS AND RECORDS. `TELEMETRY` and `PROGRESS` are LEVELS: the supervisor hands them on through
 * a bounded queue that replaces and evicts them, and a worker `WARNING` travels the same queue.
 * A `RECORD` is the one LOSSLESS class: first video sample, first durable fragment, fragment
 * checkpoint, observed keyframe interval, audio-source interval, end of the audio timeline, seal completion. The supervisor handles it the moment its line arrives, beside `ACK`, and never puts
 * it in that queue. Every record carries `seq`: a worker counts its records from 1, by exactly 1;
 * a gap or a repeat is a protocol violation that ends the worker. A session gets a second worker
 * only while it holds no durable fragment, so the fragment records of one session are always ONE
 * sequence. THE FILE IS THE
 * TRUTH, THE FRAME IS A HINT: a record tells the Core early what the camera file already holds;
 * what is authoritative is the file itself, read again by the box walk of spec §C.5 at RECOVERY.
 * Nothing may be decided from the ABSENCE of a record.
 *
 * RECORDS ARE LOW-RATE BY CONTRACT (fix round 1, navigator finding A-5). A worker writes: one
 * first-video-sample, one first-durable-fragment and one keyframe-interval per camera, one
 * checkpoint per fragment per camera, one audio-source interval at the start and one per operator
 * switch (at most one per input chunk: a second switch is refused while one waits), one end of the
 * audio timeline, one seal completion. Checkpoints of fragments that were
 * written while one disk sync ran leave together when the next sync returned: after a sync that
 * took t seconds, about t / 2 checkpoints per camera arrive at once, far below the ceiling. A fragment is a camera GOP of about 2 s (never shorter than a
 * stall cut every `fragmentTargetMs`), so two cameras write about 2 records a second at most.
 * The supervisor does not queue records and waits for no listener, so a record flood would grow
 * memory in whoever consumes them: more than `recordBurstLimit` records inside `recordWindowMs`
 * is therefore a PROTOCOL VIOLATION that ends the worker. A consumer still bounds its own
 * backlog: it must not hold a record waiting on a slow store without a limit of its own.
 *
 * IDENTITIES (decision D72, navigator finding A-1). Every device a frame names - the `deviceId`
 * of an ingest state, a fragment counter, a clock entry, a level or a record, and the `subject` of
 * a warning - is a CAPTURE DEVICE ID, the vocabulary of the capture-config tables and of the
 * engine (`CAM-01`, `CAM-02`, `MIC-01`, `MIC-02`). `VIDEO-01` / `VIDEO-02` are names of output
 * TRACKS: a plan carries one per camera as `trackId`, and no frame carries it. A MIC ROLE IS NOT
 * AN IDENTITY (version 4, D84 R-2): a role says which place of the plan a microphone holds; it is
 * the argument of `SWITCH_AUDIO_SOURCE` and a member beside the device ID, never a subject. A
 * plan whose device is named like a role is refused, so the two can never be confused.
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
 *   - it never switches the audio source by itself (OD-11): `MIC_SILENT` is a warning. The only
 *     `AUDIO_SOURCE_INTERVAL` records it writes are the one of the start and one per
 *     `SWITCH_AUDIO_SOURCE` it acknowledged with `ok`, each naming that command's correlation ID;
 *   - a switch is realised at the next input chunk of the filtering thread
 *     (`CAPTURE_AUDIO_INPUT_QUANTUM_SAMPLES`, 10 ms): a hard cut, no crossfade (gate answer
 *     Q-CLICK, default). The record states the first sample of the new source; the `ACK` follows it;
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
 *   - it reports the first fragment of each camera file with a `RECORD`
 *     (`FIRST_DURABLE_FRAGMENT`) and every fragment with a `FRAGMENT_CHECKPOINT`, and it writes
 *     either ONLY AFTER the disk sync that covers the fragment returned (for the first fragment:
 *     data sync, link to the final name, directory sync). A record therefore says "durable", not
 *     "written"; a fragment that is in the file without a record was written and not yet known
 *     durable. The numbers of the checkpoints of one camera are 1, 2, 3 ... without a gap, and
 *     each starts at the byte the one before ended at;
 *   - it appends whole fragments only, and a write that fails or comes back short is cut back to
 *     the last good length before the worker ends with `CRASH`;
 *   - it owns no datagram socket, and every socket it owns is on 127.0.0.1 (SEC35-23);
 *   - it keeps writing `HEARTBEAT` whatever else it writes: the supervisor reads its output at all
 *     times and never pauses it, and it drops telemetry it cannot hand on rather than slow down.
 *
 * NO FREE TEXT FROM A WORKER (review R63-05, carried question 8; ruling D179). Every member of a
 * worker frame that can reach a log, the persistent error log, an alert or a file name is a CLOSED
 * FORM in this schema: an ID (session, correlation, device) is 1 to 128 characters of
 * `[A-Za-z0-9._:-]` - the class the C worker itself holds its commands to - so no address, no
 * credential and no white space fits one; `CRASH.signal` is a signal name (`SIG` and capitals or
 * digits); a checkpoint's `keyId` is `KID-...`; `HELLO.workerVersion` is a version word. A frame
 * that breaks a form is no message (`FRAME_NOT_A_MESSAGE`): the supervisor ends such a worker as it
 * ends one that writes a malformed line. What the schema cannot know - whether a device belongs to
 * the session's plan, whether a switch was commanded - the supervisor holds, the same way.
 *
 * ADDED INSIDE VERSION 4 (fix pass F-M3; ruling D179 - additive: a frame of the worker before it
 * still decodes): the warning reason `FRAGMENT_SIZE_BOUND_REACHED`, the named setting
 * `maxFragmentBytes`, and the OPTIONAL member `FIRST_DURABLE_FRAGMENT.syncLevel`.
 */
import { z } from 'zod';

/** Version of this protocol. The worker names it in `HELLO`; a mismatch ends the worker. */
export const CAPTURE_PROTOCOL_VERSION = 4;

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

/**
 * The warnings a worker raises (spec §B.2). Never an automatic switch (OD-11).
 *
 * `CAPTURE_FAULT` with a camera as its subject has three causes, all "this camera needs a look":
 * the ingest was refused or never opened, the camera's stream ended, or - gate answer Q-GOP (a),
 * spec §C.1 - THE OBSERVED KEYFRAME INTERVAL IS ABOVE THE TARGET (the crash-loss window of that
 * file is one camera GOP). The existing code is used on purpose: no error or audit code joins the
 * pinned sets. The number, and which of the causes it was, is the record `KEYFRAME_INTERVAL`.
 */
export const CaptureWarningCode = { MIC_SILENT: 'MIC_SILENT', CAPTURE_FAULT: 'CAPTURE_FAULT' } as const;
export type CaptureWarningCode = (typeof CaptureWarningCode)[keyof typeof CaptureWarningCode];

/**
 * WHICH of the causes of its code a warning is (version 4). The two codes stay the pinned set; the
 * reason is what lets the Core tell a camera that is gone from a camera that records with a long
 * keyframe interval, and a silent microphone from one that stopped delivering.
 *
 *   code MIC_SILENT     MIC_LEVEL_BELOW_THRESHOLD        the microphone DELIVERS samples and their level stayed at or
 *                                                        below the silence threshold for the silence duration (spec §E.1).
 *                                                        `CLEARED` when the level is above it again. Never a switch.
 *   code CAPTURE_FAULT  CAMERA_NOT_CONNECTED             the camera's ingest never delivered video (refused, no connection
 *                                                        within the ingest-open window, no usable stream)
 *                       CAMERA_STREAM_ENDED              a camera that delivered video stopped
 *                       CAMERA_CLOCK_OUT_OF_BOUND        the camera's wall clock is beyond any delay: not recorded at a wrong time
 *                       KEYFRAME_INTERVAL_ABOVE_BOUND    ADVISORY: the camera RECORDS; its keyframe interval is above the
 *                                                        target, so a crash loses more than the target (record `KEYFRAME_INTERVAL`)
 *                       FRAGMENT_SIZE_BOUND_REACHED      ADVISORY: the camera RECORDS; the open fragment of its file reached the
 *                                                        size bound the seal and the verifier enforce (`maxFragmentBytes`) before
 *                                                        a keyframe came, so the worker CLOSED it there and began the next one:
 *                                                        that file holds a fragment that does not start on a keyframe (its
 *                                                        checkpoint says `keyframe: false`). No sample is lost. Once per camera
 *                       MIC_DISCONNECTED                 the microphone delivered no sample for the disconnect debounce (spec §E.1).
 *                                                        `CLEARED` when it delivers again
 *                       MIC_RATE_AT_LIMIT                the microphone's clock differs from the host's by the limit the rate
 *                                                        controller can absorb (+-5,000 ppm, D85) or more: samples are being
 *                                                        inserted or dropped. `CLEARED` when the controller is inside its range again
 *
 * The camera conditions do not end inside a session (a listen ingest takes one connection), so the
 * worker writes no `CLEARED` for them; the three microphone conditions are raised and cleared, and
 * every later occurrence is a new `ACTIVE`.
 */
export const CaptureWarningReason = {
  MIC_LEVEL_BELOW_THRESHOLD: 'MIC_LEVEL_BELOW_THRESHOLD',
  CAMERA_NOT_CONNECTED: 'CAMERA_NOT_CONNECTED',
  CAMERA_STREAM_ENDED: 'CAMERA_STREAM_ENDED',
  CAMERA_CLOCK_OUT_OF_BOUND: 'CAMERA_CLOCK_OUT_OF_BOUND',
  KEYFRAME_INTERVAL_ABOVE_BOUND: 'KEYFRAME_INTERVAL_ABOVE_BOUND',
  FRAGMENT_SIZE_BOUND_REACHED: 'FRAGMENT_SIZE_BOUND_REACHED',
  MIC_DISCONNECTED: 'MIC_DISCONNECTED',
  MIC_RATE_AT_LIMIT: 'MIC_RATE_AT_LIMIT',
} as const;
export type CaptureWarningReason = (typeof CaptureWarningReason)[keyof typeof CaptureWarningReason];
/** The reasons each code may carry. A frame with a reason of the other code is no message. */
export const WARNING_REASONS_OF: { readonly [Code in CaptureWarningCode]: readonly CaptureWarningReason[] } = {
  MIC_SILENT: [CaptureWarningReason.MIC_LEVEL_BELOW_THRESHOLD],
  CAPTURE_FAULT: [
    CaptureWarningReason.CAMERA_NOT_CONNECTED,
    CaptureWarningReason.CAMERA_STREAM_ENDED,
    CaptureWarningReason.CAMERA_CLOCK_OUT_OF_BOUND,
    CaptureWarningReason.KEYFRAME_INTERVAL_ABOVE_BOUND,
    CaptureWarningReason.FRAGMENT_SIZE_BOUND_REACHED,
    CaptureWarningReason.MIC_DISCONNECTED,
    CaptureWarningReason.MIC_RATE_AT_LIMIT,
  ],
};
/** The reasons whose subject is a microphone of the plan (every other reason names a camera). */
export const MIC_WARNING_REASONS: readonly CaptureWarningReason[] = [CaptureWarningReason.MIC_LEVEL_BELOW_THRESHOLD, CaptureWarningReason.MIC_DISCONNECTED, CaptureWarningReason.MIC_RATE_AT_LIMIT];
/**
 * The reasons that are NOT a failed device: the subject keeps recording. `KEYFRAME_INTERVAL_ABOVE_BOUND`
 * says the crash-loss window of that camera file is longer than the target (decision D127 (2)): a
 * consumer shows it as a notice with the number of the record, not as a camera fault.
 * `FRAGMENT_SIZE_BOUND_REACHED` says one fragment of that camera file was closed at the size bound
 * and not at a keyframe (ruling D179 on review R63-02): the recording is whole, and the manifest
 * says so per fragment (`keyframe`) and per track (`keyframeAligned`).
 */
export const ADVISORY_WARNING_REASONS: readonly CaptureWarningReason[] = [CaptureWarningReason.KEYFRAME_INTERVAL_ABOVE_BOUND, CaptureWarningReason.FRAGMENT_SIZE_BOUND_REACHED];

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
/**
 * What a worker says in `CRASH` - as its FIRST and only frame, instead of `HELLO` - when the
 * libavformat it runs on is not the one it was built and verified against (review R63-07; the pin
 * of `apps/capture-worker/test/static/libavformat.pin` held at RUN time). It records nothing and
 * exits; another start of the same program on the same host ends the same way, so the supervisor
 * does not retry it. It is NOT one of `FINAL_CRASH_CODES`: those end a session that had been given
 * a plan, this one comes before any.
 */
export const LIBAVFORMAT_VERSION_MISMATCH = 'LIBAVFORMAT_VERSION_MISMATCH';

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
  /** One DURABLE fragment's checkpoint (spec §A.5 `FragmentCheckpoint`), written by the fMP4 writer after its sync. */
  FRAGMENT_CHECKPOINT: 'FRAGMENT_CHECKPOINT',
  /**
   * The keyframe interval the worker observed on one camera's video (spec §C.1, Q-GOP): once per
   * camera. On stream copy the camera sets it, and it IS the crash-loss window of the file.
   */
  KEYFRAME_INTERVAL: 'KEYFRAME_INTERVAL',
  /**
   * Which microphone feeds the one audio track from which sample on (spec §E "interval records"):
   * one at the start of the audio timeline, one per realised operator switch. Media time, derived
   * on the capture side; never reconstructed from the operator's clock.
   */
  AUDIO_SOURCE_INTERVAL: 'AUDIO_SOURCE_INTERVAL',
  /** The audio timeline ended: how many samples the one encoder was fed. Closes the last interval. */
  AUDIO_TIMELINE_END: 'AUDIO_TIMELINE_END',
  /** Sealing finished. Never read from `PROGRESS` with progress 1, which is a level and can be evicted. */
  SEAL_COMPLETE: 'SEAL_COMPLETE',
} as const;
export type CaptureRecordKind = (typeof CaptureRecordKind)[keyof typeof CaptureRecordKind];

/**
 * HOW A CAMERA FILE WAS REALLY MADE DURABLE (review R63-09; capture spec §C.2). The level the first
 * sync of the file ACHIEVED, not the one the build would like: `F_FULLFSYNC` went through the
 * drive's own cache (macOS); `FSYNC` is what a volume that does not know the full sync got - on
 * macOS not through the drive cache. A worker never changes the level silently: it states the level
 * of the first sync here, and a later sync of the same file that cannot reach that level is a
 * failed sync (`WRITER_SYNC_LEVEL_CHANGED`), never a quieter one.
 */
export const CaptureSyncLevel = { FULL: 'F_FULLFSYNC', FSYNC: 'FSYNC' } as const;
export type CaptureSyncLevel = (typeof CaptureSyncLevel)[keyof typeof CaptureSyncLevel];

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

/** Why an audio-source interval began. There is no third value: the worker never switches by itself (OD-11). */
export const AudioSourceIntervalReason = { SESSION_START: 'SESSION_START', OPERATOR_SWITCH: 'OPERATOR_SWITCH' } as const;
export type AudioSourceIntervalReason = (typeof AudioSourceIntervalReason)[keyof typeof AudioSourceIntervalReason];

/**
 * What a worker refuses a `SWITCH_AUDIO_SOURCE` with (`ACK ok=false`). None of them changed the
 * audio source, and none wrote a record.
 *   NOT_RECORDING            no session runs, or it is stopping (also the answer to a switch that still waited at the stop)
 *   SESSION_MISMATCH         the command names another session
 *   NO_SUCH_MIC              the plan has no microphone in that role
 *   SWITCH_PENDING           the switch before it is not realised yet (at most one input chunk): ask again
 *   SELECTOR_COMMAND_FAILED  the filter graph refused the command: the worker ends with `CRASH`
 * A switch to the role that already feeds the track is acknowledged `ok` and writes NO record:
 * nothing changed.
 */
export const SWITCH_REFUSAL_CODES: readonly string[] = ['NOT_RECORDING', 'SESSION_MISMATCH', 'NO_SUCH_MIC', 'SWITCH_PENDING', 'SELECTOR_COMMAND_FAILED'];

/**
 * The input chunk of the worker's filtering thread, in samples (10 ms at 48 kHz). A switch is
 * realised at a chunk boundary: `fromSample` of every `AUDIO_SOURCE_INTERVAL` is a multiple of it.
 * The bound of the switch (spec §E, erratum AU2-07) is ONE chunk plus the IPC latency; the spec's
 * ceiling `CAPTURE_SWITCH_BOUND_US` (one 1,024-sample AAC frame, 21,333 us) is what a check holds
 * the measured `appliedDelayUs` against. Held equal to the worker's `QUANTUM` by the Core's pin test.
 */
export const CAPTURE_AUDIO_INPUT_QUANTUM_SAMPLES = 480;
export const CAPTURE_SWITCH_BOUND_US = 21_333;

/**
 * THE NAMED SETTINGS OF A WORKER PROCESS (version 4; decision D84 "the ingest-open window is a
 * named setting passed by the launcher", capture spec §E.1 "tunable without a code change").
 * They are fixed per installation, so they are ARGUMENTS of the process (like its log file and its
 * heartbeat interval), not members of a session's plan. The launcher builds them with
 * `captureWorkerSettingArguments`; a worker started without one of them uses the default below,
 * which the Core's pin test holds equal to the worker's own define and to the contract constants
 * of `@dems/shared/api` (`MIC_SILENCE_DBFS`, `MIC_SILENCE_DURATION_MS`, `MIC_DISCONNECT_DEBOUNCE_MS`).
 *
 *   ingestOpenWindowMs       how long a camera may take to connect to its ingest. When NO camera
 *                            connected within it the session ends `CRASH NO_CAMERA_CONNECTED`
 *                            (D72(k)); a single camera that did not is given up with a warning.
 *                            Whole seconds (the listen timeout of the RTSP ingest is one).
 *   micSilenceDbfs           the level at or below which a delivering microphone counts as silent
 *   micSilenceDurationMs     for how long, before `MIC_SILENT` is raised
 *   micDisconnectDebounceMs  no sample for this long: `CAPTURE_FAULT` / `MIC_DISCONNECTED`
 *   maxFragmentBytes         THE bound of one fragment (`moof` + `mdat`) of a camera file: ONE number,
 *                            the one the seal and the verifier enforce (`SEALING_MAX_FRAGMENT_BYTES` =
 *                            `VERIFY_MAX_OPEN_FRAGMENT_BYTES`; the Core's launcher passes it, a pin test
 *                            holds the default below equal to it). The worker makes no fragment durable
 *                            above it: an open fragment that would pass it is closed there
 *                            (`FRAGMENT_SIZE_BOUND_REACHED`). `max` is the worker's compiled sanity cap.
 */
export const CAPTURE_WORKER_SETTINGS = {
  ingestOpenWindowMs: { argument: '--ingest-open-window-ms', default: 15_000, min: 1_000, max: 600_000, step: 1_000 },
  micSilenceDbfs: { argument: '--mic-silence-dbfs', default: -50, min: -120, max: 0, step: 1 },
  micSilenceDurationMs: { argument: '--mic-silence-ms', default: 10_000, min: 100, max: 600_000, step: 100 },
  micDisconnectDebounceMs: { argument: '--mic-disconnect-ms', default: 2_000, min: 100, max: 600_000, step: 100 },
  maxFragmentBytes: { argument: '--max-fragment-bytes', default: 64 * 1024 * 1024, min: 1024 * 1024, max: 256 * 1024 * 1024, step: 1 },
} as const;
export type CaptureWorkerSettingName = keyof typeof CAPTURE_WORKER_SETTINGS;
export type CaptureWorkerSettings = { readonly [Name in CaptureWorkerSettingName]: number };
export const CAPTURE_WORKER_SETTING_DEFAULTS: CaptureWorkerSettings = {
  ingestOpenWindowMs: CAPTURE_WORKER_SETTINGS.ingestOpenWindowMs.default,
  micSilenceDbfs: CAPTURE_WORKER_SETTINGS.micSilenceDbfs.default,
  micSilenceDurationMs: CAPTURE_WORKER_SETTINGS.micSilenceDurationMs.default,
  micDisconnectDebounceMs: CAPTURE_WORKER_SETTINGS.micDisconnectDebounceMs.default,
  maxFragmentBytes: CAPTURE_WORKER_SETTINGS.maxFragmentBytes.default,
};

/**
 * The arguments that hand the named settings to a worker process, in a fixed order: what a launcher
 * appends to the worker's own arguments. A value outside its range, or off its step, is refused
 * here (the worker refuses it too, with its usage text and exit code 2).
 */
export function captureWorkerSettingArguments(settings: Partial<CaptureWorkerSettings> = {}): string[] {
  const out: string[] = [];
  for (const name of Object.keys(CAPTURE_WORKER_SETTINGS) as CaptureWorkerSettingName[]) {
    const rule = CAPTURE_WORKER_SETTINGS[name];
    const value = settings[name] ?? rule.default;
    if (!Number.isInteger(value) || value < rule.min || value > rule.max || (value - rule.min) % rule.step !== 0) {
      throw new RangeError(`the worker setting ${name} is a whole number from ${rule.min} to ${rule.max} in steps of ${rule.step}`);
    }
    out.push(rule.argument, String(value));
  }
  return out;
}

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
   * one checkpoint per fragment of about 2 s, plus the one-off records and one interval record per
   * operator switch, which no person makes faster than a few a second); 64 in a second is 32
   * times that and still a finite inflow for a consumer. One more ends the worker.
   */
  recordBurstLimit: 64,
  recordWindowMs: 1_000,
} as const;
export type CaptureIpcLimits = { readonly [Key in keyof typeof CAPTURE_IPC_DEFAULTS]: number };

// ── Payloads ──────────────────────────────────────────────────────────────────────────────────

/**
 * An ID on the wire: a session, a correlation, a device, a track. 1 to 128 characters of the class
 * the C worker holds its commands to (`id_ok`, `apps/capture-worker/src/ipc.c`). Never free text:
 * an address, a credential or a sentence does not fit it (review R63-05).
 */
export const CAPTURE_WIRE_ID = /^[A-Za-z0-9._:-]{1,128}$/;
const id = z.string().regex(CAPTURE_WIRE_ID);
/** A signal as a worker names it in `CRASH`: `SIGKILL`, `SIGSEGV`, `SIGUSR1`. */
export const CAPTURE_SIGNAL_NAME = /^SIG[A-Z0-9]{1,12}$/;
/** The key of a sealed fragment: `KID-<sessionId>` (capture spec §D.2; evidence spec §B.6 field 77). */
export const CAPTURE_KEY_ID = /^KID-[A-Za-z0-9._:-]{1,124}$/;
/** A worker's own version as `HELLO` states it: a word, never a sentence. WHICH versions the Core starts is the supervisor's allowlist. */
export const CAPTURE_WORKER_VERSION_WORD = /^[A-Za-z0-9._+/-]{1,64}$/;
const wholeNumber = z.number().int().nonnegative();
function isMicRoleWord(value: string): boolean {
  return (Object.values(CaptureMicRole) as string[]).includes(value);
}
/** A capture device ID as a frame names it: never a mic role (version 4, D84 R-2). */
const deviceIdOnWire = id.refine((value) => !isMicRoleWord(value), 'a mic role is not a device ID');

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
    // Version 4 (D84 R-2): a role is never an identity, so no device may be named like one, and a
    // camera and a microphone never share an ID (a warning names ONE device of the plan).
    const devices = [...plan.cameras.map((camera) => camera.deviceId), ...plan.mics.map((mic) => mic.deviceId)];
    if (devices.some((device) => isMicRoleWord(device))) context.addIssue({ code: 'custom', message: 'a device is named like a mic role', path: ['mics'] });
    if (!unique(devices)) context.addIssue({ code: 'custom', message: 'a camera and a mic share a device ID', path: ['mics'] });
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
  /** The worker's own version, for the log: a word of `CAPTURE_WORKER_VERSION_WORD`. */
  workerVersion: z.string().regex(CAPTURE_WORKER_VERSION_WORD),
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
  /**
   * One entry per microphone of the plan, named by its device ID (version 4) with the role it holds:
   * the level in dBFS (null: no samples), and `ratePpm`: what the rate controller asks of the
   * resampler now, in parts per million of the sample rate (positive: the microphone's clock is
   * slow; null while the microphone does not run). At +-5,000 the controller is at its limit (D85).
   */
  levels: z
    .array(z.strictObject({ deviceId: deviceIdOnWire, role: z.enum(CaptureMicRole), dbfs: z.number().max(0).nullable(), clipped: z.boolean(), ratePpm: z.number().min(-5_000).max(5_000).nullable() }))
    .max(2),
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
export const WarningMessageSchema = z
  .strictObject({
    ...envelope,
    type: z.literal(WorkerMessageType.WARNING),
    code: z.enum(CaptureWarningCode),
    /** Which of the causes of `code` it is (version 4): see `CaptureWarningReason`. */
    reason: z.enum(CaptureWarningReason),
    /**
     * `ACTIVE`: the condition began. `CLEARED`: the worker saw it END (decision D72, finding A-2):
     * a fault a capture warning raised is cleared by the capture side, never by a demo operation.
     * A `CLEARED` names the same code, reason and subject as the `ACTIVE` it ends.
     */
    state: z.enum(CaptureWarningState),
    /**
     * What the warning is about: THE DEVICE ID of one camera or one microphone of the plan
     * (version 4; D84 R-1, R-2). Never null and never a mic role on the wire: one microphone has
     * one subject form, so "the same mic by ID and by role" cannot be two faults, and a clear can
     * never miss its fault. Anything that is no device of the plan is a protocol violation (the
     * supervisor checks it): a subject is never free text, a credential or an address.
     */
    subject: deviceIdOnWire,
  })
  .superRefine((warning, context) => {
    if (!WARNING_REASONS_OF[warning.code].includes(warning.reason)) context.addIssue({ code: 'custom', message: 'the reason is not one of this code', path: ['reason'] });
  });
export const CrashMessageSchema = z.strictObject({
  ...version,
  /** Null when the worker fails before it was given a session. */
  sessionId: id.nullable(),
  type: z.literal(WorkerMessageType.CRASH),
  /** A machine code of the worker's own choosing. */
  code,
  /** The signal that ended it, by name (`CAPTURE_SIGNAL_NAME`), or null. */
  signal: z.string().regex(CAPTURE_SIGNAL_NAME).nullable(),
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
  /**
   * WHAT ARRIVED BEFORE IT AND IS NOT IN THE FILE (version 4; spec §C.4 "held first frame, up to
   * one GOP"; decisions D126, D130). A camera file starts with the first keyframe that can be
   * placed at or after T0; the video packets the camera delivered before it are counted here, by
   * the reason each could not be written. They are the specified start-up of a stream copy, not a
   * fault: the amount is stated so that the manifest can carry it.
   *   noTimestamp       before the camera's first sender report: the packet has no time
   *   beforeAudioStart  before T0 was taken (the audio timeline did not exist yet)
   *   noCameraClock     no camera wall clock yet: the packet could not be anchored
   *   beforeKeyframe    anchored, but not a keyframe at or after T0: a file cannot begin with it
   */
  skipped: z.strictObject({ noTimestamp: wholeNumber, beforeAudioStart: wholeNumber, noCameraClock: wholeNumber, beforeKeyframe: wholeNumber }),
  /**
   * How much delivered video the file does not hold, in ms: from the first skipped packet to this
   * sample. Two parts added (review R63-13; before fix pass F-M3 only the first was counted, so a
   * camera whose first sender report came late stated a short span for a long hole):
   *   - camera time from the first skipped packet that HAD a timestamp to this sample;
   *   - THE UNTIMESTAMPED LEAD: the skipped packets that came before that one have no camera time,
   *     so their span is taken from the host's clock - from the arrival of the first of them to the
   *     arrival of the first packet with a timestamp - and never less than their count times the
   *     stream's nominal frame period (packets that waited inside the receiver arrive at once).
   * 0 when nothing was skipped. The lead is a measurement on the host clock, not camera time.
   */
  skippedSpanMs: wholeNumber,
});
export const FirstDurableFragmentRecordSchema = z.strictObject({
  kind: z.literal(CaptureRecordKind.FIRST_DURABLE_FRAGMENT),
  /** The camera whose file it is. */
  deviceId: id,
  /** Length of that file once the fragment was written. A hint: the file is read again at RECOVERY. */
  bytes: wholeNumber.positive(),
  /**
   * The durability level the sync that covers this fragment REALLY achieved (`CaptureSyncLevel`;
   * review R63-09). Optional on the wire inside version 4 (added by fix pass F-M3): the worker of
   * this tree always states it; a record without it says "not stated", never "full".
   */
  syncLevel: z.enum(CaptureSyncLevel).optional(),
});
/**
 * Spec §A.5 `FragmentCheckpoint`, with its `seq` named `index` (the record's own `seq` is the
 * frame's). One per fragment per camera file, in fragment order, written AFTER the disk sync that
 * covers the fragment returned (see the header). The chain rule (spec §C.3; S1 §3.1):
 *
 *   fragSha256   = SHA-256(the fragment's stored bytes `[start, start + len)`: `moof` + `mdat`)
 *   chainSha256  = SHA-256(chainSha256 of the fragment before, 32 raw bytes || fragSha256, 32 raw bytes),
 *                  with `CAPTURE_CHAIN_GENESIS_SHA256` (SHA-256 of nothing) before the first
 *   prefixSha256 = SHA-256(the file from byte 0 to `start + len`): of the last fragment, the whole file
 *
 * and the same for the plaintext (`plaintextSha256`, `plaintextChainSha256`) over the fragment
 * before the cipher seam. While no cipher is set (`keyId` null) stored bytes and plaintext are the
 * same bytes, so `plaintextSha256` equals `fragSha256` and the two chains are equal.
 */
export const FragmentCheckpointRecordSchema = z
  .strictObject({
    kind: z.literal(CaptureRecordKind.FRAGMENT_CHECKPOINT),
    deviceId: id,
    /** `mfhd.sequence_number` of the fragment: 1, 2, 3 ... of this camera file, without a gap. */
    index: wholeNumber.positive(),
    /** The stored-byte range `[start, start + len)`. `start` of fragment 1 is the length of the init segment. */
    start: wholeNumber.positive(),
    len: wholeNumber.positive(),
    fragSha256: sha256,
    chainSha256: sha256,
    prefixSha256: sha256,
    plaintextSha256: sha256,
    plaintextChainSha256: sha256,
    /** Where the fragment starts on the file's media timeline, and how long it is (the span of its tracks), in ms. */
    mediaStartMs: wholeNumber,
    mediaDurationMs: wholeNumber.positive(),
    /** True when the fragment has video and its first video sample is a sync sample (false: an audio-only fragment of a stalled camera). */
    keyframe: z.boolean(),
    /** Epoch ms, taken when the sync that covers this fragment returned (`recording_fragments.durable_at`). */
    durableAt: wholeNumber.positive(),
    /** The three of the per-fragment cipher (OD-03; blueprint row 84): all null until the file is encrypted. */
    gcmIv: z.string().regex(/^[0-9a-f]{24}$/).nullable(),
    gcmTag: z.string().regex(/^[0-9a-f]{32}$/).nullable(),
    keyId: z.string().regex(CAPTURE_KEY_ID).nullable(),
  })
  .superRefine((record, context) => {
    const sealed = [record.gcmIv, record.gcmTag, record.keyId].filter((value) => value !== null).length;
    if (sealed !== 0 && sealed !== 3) context.addIssue({ code: 'custom', message: 'the cipher members are all set or all null', path: ['keyId'] });
    // Without a cipher the stored bytes ARE the plaintext: two different digests would be two different files.
    if (sealed === 0 && (record.plaintextSha256 !== record.fragSha256 || record.plaintextChainSha256 !== record.chainSha256)) {
      context.addIssue({ code: 'custom', message: 'without a cipher the plaintext chain equals the stored-bytes chain', path: ['plaintextSha256'] });
    }
  });
/**
 * What the worker saw of one camera's keyframe interval (spec §C.1, erratum AU2-08; gate answer
 * Q-GOP (a)). Once per camera: after its first intervals, or - when an interval was above the
 * bound - as soon as that interval is complete, or at the end of the ingest with what was seen.
 * The same interval is re-derivable from the file (the sync samples of the video `trun` boxes).
 */
export const KeyframeIntervalRecordSchema = z.strictObject({
  kind: z.literal(CaptureRecordKind.KEYFRAME_INTERVAL),
  deviceId: id,
  /** The longest interval between two keyframes seen so far, in ms of the file's time (an interval still open counts with its length so far). */
  observedMs: wholeNumber,
  /** The target it is held against: the plan's `fragmentTargetMs` (the contract's `CAPTURE_OBSERVED_GOP_MAX_MS`). */
  boundMs: wholeNumber.positive(),
  /** How many complete intervals were measured. */
  intervals: wholeNumber,
  /** False when the longest interval was still open (no later keyframe had arrived): the true interval is at least `observedMs`. */
  complete: z.boolean(),
  /** True when `observedMs` is above the bound by more than the worker's tolerance (5 %): the warning of the channel was raised. */
  aboveBound: z.boolean(),
});
/**
 * One interval of the one audio track (spec §E "interval records"; table `session_audio_intervals`).
 * `index` 1 is the interval of the start; every realised operator switch opens the next one, and an
 * interval ends where the next begins (the last one at `AUDIO_TIMELINE_END.samples`). The worker
 * writes the record of a switch BEFORE the `ACK` of its command, so a supervisor that resolves the
 * command has already handled the record.
 *
 * TIME. `fromSample` is the first sample of this source in the encoder's input, counted from T0
 * (sample 0 is the capture instant T0; it is also the index in the PCM tap). Its time in the FILE
 * is `fromSample + CAPTURE_MEDIA_TIME_ORIGIN_SAMPLES` samples (`@dems/shared/api`; the AAC priming
 * of the pinned mux flags), the same rule as `FIRST_VIDEO_SAMPLE.pts`. It is a multiple of
 * `CAPTURE_AUDIO_INPUT_QUANTUM_SAMPLES`: the switch is a hard cut at an input-chunk boundary.
 */
export const AudioSourceIntervalRecordSchema = z
  .strictObject({
    kind: z.literal(CaptureRecordKind.AUDIO_SOURCE_INTERVAL),
    /** The microphone that feeds the track from `fromSample` on: its device ID, and the role it holds in the plan. */
    deviceId: deviceIdOnWire,
    role: z.enum(CaptureMicRole),
    /** 1, 2, 3 ... of this worker, without a gap. */
    index: wholeNumber.positive(),
    fromSample: wholeNumber,
    sampleRateHz: wholeNumber.positive(),
    /** Epoch ms of the capture instant of `fromSample` on the host clock (T0 + fromSample / rate). */
    capturedAtMs: wholeNumber.positive(),
    reason: z.enum(AudioSourceIntervalReason),
    /** The correlation ID of the `SWITCH_AUDIO_SOURCE` this realises; null for the interval of the start. */
    correlationId: id.nullable(),
    /**
     * Microseconds from the moment the worker read the command to the moment the selector was
     * switched on the filtering thread (the switch bound, measured by the worker); null for the start.
     */
    appliedDelayUs: wholeNumber.nullable(),
  })
  .superRefine((record, context) => {
    const start = record.reason === AudioSourceIntervalReason.SESSION_START;
    if (record.fromSample % CAPTURE_AUDIO_INPUT_QUANTUM_SAMPLES !== 0) context.addIssue({ code: 'custom', message: 'a source changes at an input-chunk boundary', path: ['fromSample'] });
    if (start !== (record.index === 1) || start !== (record.fromSample === 0)) context.addIssue({ code: 'custom', message: 'the interval of the start is index 1 at sample 0, and only it', path: ['index'] });
    if (start !== (record.correlationId === null) || start !== (record.appliedDelayUs === null)) context.addIssue({ code: 'custom', message: 'a switch names its command and its delay; the start names neither', path: ['correlationId'] });
  });
/** The end of the audio timeline: `samples` were fed to the one encoder since T0, in `intervals` intervals. Written once, when the filtering thread ends. */
export const AudioTimelineEndRecordSchema = z.strictObject({
  kind: z.literal(CaptureRecordKind.AUDIO_TIMELINE_END),
  samples: wholeNumber,
  sampleRateHz: wholeNumber.positive(),
  intervals: wholeNumber.positive(),
});
export const SealCompleteRecordSchema = z.strictObject({ kind: z.literal(CaptureRecordKind.SEAL_COMPLETE) });
export const CaptureRecordSchema = z.discriminatedUnion('kind', [
  FirstVideoSampleRecordSchema,
  FirstDurableFragmentRecordSchema,
  FragmentCheckpointRecordSchema,
  KeyframeIntervalRecordSchema,
  AudioSourceIntervalRecordSchema,
  AudioTimelineEndRecordSchema,
  SealCompleteRecordSchema,
]);
/** `chain_0`: SHA-256 of nothing, what the chain of the first fragment is built on (spec §C.3). */
export const CAPTURE_CHAIN_GENESIS_SHA256 = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
/** The records a worker writes at most once per camera: a second one is a protocol violation. */
export const ONCE_PER_CAMERA_RECORD_KINDS: readonly CaptureRecordKind[] = [CaptureRecordKind.FIRST_VIDEO_SAMPLE, CaptureRecordKind.FIRST_DURABLE_FRAGMENT, CaptureRecordKind.KEYFRAME_INTERVAL];
/** The record kinds that say a fragment is on the disk: from the first of them a session is durable. */
export const DURABLE_RECORD_KINDS: readonly CaptureRecordKind[] = [CaptureRecordKind.FIRST_DURABLE_FRAGMENT, CaptureRecordKind.FRAGMENT_CHECKPOINT];
/** Whose device ID a record carries (version 4): a camera's, a microphone's, or none (a record of the session). */
export const CAMERA_RECORD_KINDS: readonly CaptureRecordKind[] = [CaptureRecordKind.FIRST_VIDEO_SAMPLE, CaptureRecordKind.FIRST_DURABLE_FRAGMENT, CaptureRecordKind.FRAGMENT_CHECKPOINT, CaptureRecordKind.KEYFRAME_INTERVAL];
export const MIC_RECORD_KINDS: readonly CaptureRecordKind[] = [CaptureRecordKind.AUDIO_SOURCE_INTERVAL];
export const SESSION_RECORD_KINDS: readonly CaptureRecordKind[] = [CaptureRecordKind.AUDIO_TIMELINE_END, CaptureRecordKind.SEAL_COMPLETE];
export type CaptureRecord = z.infer<typeof CaptureRecordSchema>;
export type AudioSourceIntervalRecord = z.infer<typeof AudioSourceIntervalRecordSchema>;
export type AudioTimelineEndRecord = z.infer<typeof AudioTimelineEndRecordSchema>;
export type FirstVideoSampleRecord = z.infer<typeof FirstVideoSampleRecordSchema>;
export type FragmentCheckpointRecord = z.infer<typeof FragmentCheckpointRecordSchema>;
export type KeyframeIntervalRecord = z.infer<typeof KeyframeIntervalRecordSchema>;

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
