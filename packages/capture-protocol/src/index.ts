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
 * version) and `ACK` (the worker's answer to a command, matched by correlation ID).
 *
 *   supervisor -> worker   START, STOP, SWITCH_AUDIO_SOURCE
 *   worker -> supervisor   HELLO, ACK, TELEMETRY, PROGRESS, HEARTBEAT, WARNING, CRASH
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
 *   - it NEVER truncates or overwrites an output file that already exists. A `START` whose
 *     `attempt` is above 1 is a restart inside a session: it names the SAME output paths, and
 *     those files may hold the durable prefix of the recording, which is evidence (OD-08). How a
 *     restarted worker continues (a new segment beside the file, or resuming after the tail rule
 *     of capture spec §C.5) is NOT decided in the specification yet; the rule that binds until it
 *     is: the bytes already written are never destroyed;
 *   - it keeps writing `HEARTBEAT` whatever else it writes: the supervisor reads its output at all
 *     times and never pauses it, and it drops telemetry it cannot hand on rather than slow down.
 */
import { z } from 'zod';

/** Version of this protocol. The worker names it in `HELLO`; a mismatch ends the worker. */
export const CAPTURE_PROTOCOL_VERSION = 1;

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

/** State of one RTSP ingest as the worker reports it. */
export const CaptureIngestState = { WAITING: 'WAITING', CONNECTED: 'CONNECTED', ENDED: 'ENDED' } as const;
export type CaptureIngestState = (typeof CaptureIngestState)[keyof typeof CaptureIngestState];

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
 * Defaults of the supervisor. They are this row's choices (no spike measured them); a later row
 * that measures the real worker may change a value here, in one place.
 */
export const CAPTURE_IPC_DEFAULTS = {
  /** Longest line of a frame, in UTF-16 code units. A longer line is a protocol violation. */
  maxFrameChars: 65_536,
  /** The worker must say `HELLO` within this time of being started. */
  helloTimeoutMs: 5_000,
  /** The worker must `ACK` a command within this time. */
  ackTimeoutMs: 5_000,
  /** The interval the worker sends `HEARTBEAT` at. */
  heartbeatIntervalMs: 500,
  /** No valid `HEARTBEAT` for this long: the worker is ended and restarted. */
  heartbeatTimeoutMs: 2_500,
  /** After `STOP`, the worker has this long to flush and exit before it is killed. */
  stopGraceMs: 5_000,
  /** First delay of the restart back-off. */
  backoffBaseMs: 250,
  /** Each further restart waits this many times longer. */
  backoffFactor: 2,
  /** No restart waits longer than this. */
  backoffMaxMs: 8_000,
  /** Restarts in a row before the supervisor gives up and raises `CAPTURE_FAULT`. */
  maxRestarts: 5,
  /** A worker that ran this long without a crash clears the count of restarts. */
  stableAfterMs: 30_000,
  /** Hard bound of the worker events that wait for a listener: beyond it levels are replaced or evicted, never queued. */
  eventQueueLimit: 256,
  /** Commands awaiting their `ACK` before a new command is refused (back-pressure). */
  commandQueueLimit: 16,
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
  .refine((url) => Number(LOOPBACK_RTSP_URL.exec(url)?.[1]) <= 65_535, 'the port is out of range');

export const CapturePlanCameraSchema = z.strictObject({
  /** `VIDEO-01` or `VIDEO-02`. */
  deviceId: id,
  /** The profile of a dual-lens camera, or null (OD-05). */
  profile: z.string().min(1).max(64).nullable(),
  /** Where the worker listens for this camera's RTSP push. */
  ingestUrl: loopbackRtspUrl,
  /** The camera file of this session, an absolute path under the media root (OD-25). */
  outputPath: z.string().min(1).max(1024).startsWith('/'),
});
export type CapturePlanCamera = z.infer<typeof CapturePlanCameraSchema>;

export const CapturePlanMicSchema = z.strictObject({
  /** `MIC-01` or `MIC-02`. */
  deviceId: id,
  role: z.enum(CaptureMicRole),
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
    constants: CapturePlanConstantsSchema,
  })
  .superRefine((plan, context) => {
    const unique = (values: readonly string[]): boolean => new Set(values).size === values.length;
    if (!unique(plan.cameras.map((camera) => camera.deviceId))) context.addIssue({ code: 'custom', message: 'a camera is named twice', path: ['cameras'] });
    if (!unique(plan.cameras.map((camera) => camera.ingestUrl))) context.addIssue({ code: 'custom', message: 'two cameras share an ingest address', path: ['cameras'] });
    if (!unique(plan.cameras.map((camera) => camera.outputPath))) context.addIssue({ code: 'custom', message: 'two cameras share an output file', path: ['cameras'] });
    if (!unique(plan.mics.map((mic) => mic.deviceId))) context.addIssue({ code: 'custom', message: 'a mic is named twice', path: ['mics'] });
    if (!unique(plan.mics.map((mic) => mic.role))) context.addIssue({ code: 'custom', message: 'a mic role is held twice', path: ['mics'] });
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
  /** What the warning is about: a device ID or a mic role. Never a credential or an address. */
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

export const WorkerMessageSchema = z.discriminatedUnion('type', [
  HelloMessageSchema,
  AckMessageSchema,
  TelemetryMessageSchema,
  ProgressMessageSchema,
  HeartbeatMessageSchema,
  WarningMessageSchema,
  CrashMessageSchema,
]);
export type WorkerMessage = z.infer<typeof WorkerMessageSchema>;
export type HelloMessage = z.infer<typeof HelloMessageSchema>;
export type AckMessage = z.infer<typeof AckMessageSchema>;
export type TelemetryMessage = z.infer<typeof TelemetryMessageSchema>;
export type ProgressMessage = z.infer<typeof ProgressMessageSchema>;
export type HeartbeatMessage = z.infer<typeof HeartbeatMessageSchema>;
export type WarningMessage = z.infer<typeof WarningMessageSchema>;
export type CrashMessage = z.infer<typeof CrashMessageSchema>;

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
