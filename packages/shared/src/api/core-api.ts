import { LcdIntegrationStatusSchema } from './lcd';
/**
 * Core API v1 contract: the registry of its 89 REST operations (75 through task 2; operations
 * 76-89 added by task 3 M2-W7, blueprint row 48, `C3 §2.2`), and the zod schemas of the ten
 * operations the demo documented first (masterplan/01_specs.md §14.9; book §21.2; D26, D31).
 *
 * The ten operations of this file, and who answers each:
 *
 * | Mode      | Operations | Simulated mode | Live mode |
 * |-----------|------------|----------------|-----------|
 * | LIVE      | `GET /api/v1/health` | mock-core, the heartbeat-only service (apps/mock-core/src/app.ts; 127.0.0.1:4400 in a development run, the page's own origin in a packaged one) | the Core server (apps/core-server) |
 * | SIMULATED | the 9 §21.2 endpoints | the in-app simulator: `Sim.request` → `sim/api.ts` `handleSimApiRequest`, header `x-dems-simulated: 1` | the Core server |
 *
 * The design book names the nine endpoints and their purpose only (01 G6), so every body is a
 * demo definition. The simulated bodies follow the handler types in `sim/api.ts` (step 32
 * declares them "the contract for step 33's OpenAPI schemas"); these zod schemas restate them
 * and tighten plain `string` fields to the enums and ID patterns the simulator guarantees.
 * test/openapi.test.ts drives the real handlers and parses every response with these schemas,
 * so the document and the simulator cannot drift apart silently.
 *
 * `CORE_API_OPERATIONS` is the one table the OpenAPI document (`openapi.ts`) is built from;
 * `validateCoreApiResponse` checks a response against it (sim tests; step 40 CP-1).
 *
 * Framework-free: zod, the domain enums and two leaf modules of the simulator (its value sets
 * and constants, which import nothing), so `@dems/shared/api` stays safe for mock-core and Hermes.
 *
 * Backend task (2026-10-04 01_specs §7; 02_plan §16; decisions D11 TD-09, D36). The registry
 * stays the one definition of an operation, and it grows by feature area:
 *
 * | Part | Where |
 * |------|-------|
 * | The model of an entry: `mode`, `services`, `access`, `audit`, `query` | `contract-model.ts` |
 * | Area 1 identity, area 2 administration, area 3 pairing, area 13 demo controls: schemas, operations, examples | `identity.ts`, `administration.ts`, `pairing.ts`, `demo-controls.ts` |
 * | Areas 4 to 11 (plan row W27, contract C): sessions, evidence, devices, storage, network and time, security and audit, system, alerts | `sessions.ts`, `evidence.ts`, `devices.ts`, `storage.ts`, `network-time.ts`, `security-audit.ts`, `system.ts`, `alerts.ts`; their state examples in `state-examples.ts` |
 * | The 47 simulator actions and the operation each one reaches (01_specs §7.17) | `sim-actions.ts` |
 * | The text rule API-13 | `text.ts` |
 * | The Core state on the wire: one schema per replicated slice (plan row W22, contract B) | `state-slices.ts` |
 * | The messages of WS `/ws`: the union the Core server sends, the client messages, close codes | `realtime-messages.ts`, `realtime-examples.ts` |
 * | The ten operations above, the error envelope, `CORE_API_SCHEMAS`, the table and its helpers | this file |
 *
 * - Every entry carries exactly one access rule and one audit rule (RB-1, API-8); the table is
 *   declared `as const satisfies readonly CoreApiRegistryOperation[]`, so an entry without them
 *   does not compile.
 * - The ten operations above keep their path, method and schemas. They gained `access`, `audit`
 *   and `services`; `rbac` still feeds their `x-dems-rbac`. With the registry complete they also
 *   carry what only the Core server needs said (01_specs §7.19): `coreServerDescription`, which
 *   the `all` scope shows in place of `description`, and the statuses that only the Core server
 *   sends (`401` and `403` on the five reads, `422` on `startSession`), each marked with
 *   `services`. The `offline` scope shows neither, so its document is unchanged.
 * - `mode` keeps its two values: `simulated` for the nine design-book operations (the in-app
 *   simulator can answer them), `live` for every other one (only a service answers it).
 *   `listCoreApiOperations('offline')` is what a client can call without the Core server (the
 *   ten above); `'all'` is every entry: 110 operations, 39 GET and 71 POST.
 * - `CORE_API_OPERATION_TABLE` (`operation-table.ts`) is the same table with literal types;
 *   `CORE_API_OPERATIONS` is the widened view.
 */
import { z } from 'zod';
import {
  FinalizationStep,
  LensState,
  MicState,
  SecurityState,
  SessionState,
  StorageState,
  TimeSource,
  TrackRecState,
  VIDEO_TRACK_IDS, // D60 (2026-11-04): four video tracks
} from '../domain/enums';
import { EXPORT_REASON_MIN_LENGTH, STOP_REASON_MIN_LENGTH } from '../sim/constants';
import {
  AuditType,
  CaptureStreamState,
  FaultKind,
  MIC_CHANNEL_IDS, // D61 (2026-11-04): the four microphone channels
  OperatorRole,
  Permission,
  PRECHECK_ORDER,
  PrecheckCheckId,
  PrecheckStatus,
  RecordingProfileId,
  RetentionPolicyId,
  SecurityPosture,
  ServiceStatus,
  Severity,
  StepStatus,
  SubjectType,
  SystemState,
} from '../sim/vocabulary';
import { ADMINISTRATION_OPERATIONS, ADMINISTRATION_SCHEMAS } from './administration';
import { ALERT_OPERATIONS, ALERT_SCHEMAS } from './alerts';
import { CAPTURE_AUDIO_CARD_OPERATIONS, CAPTURE_AUDIO_CARD_SCHEMAS } from './capture-audio-cards';
import { CAPTURE_COMMISSIONING_OPERATIONS, CAPTURE_COMMISSIONING_SCHEMAS } from './capture-commissioning';
import {
  CAPTURE_DEVICE_TEST_OPERATIONS,
  CAPTURE_DEVICE_TEST_SCHEMAS,
  CAPTURE_DISCOVERY_OPERATIONS,
  CAPTURE_DISCOVERY_SCHEMAS,
  CAPTURE_READDRESS_OPERATIONS,
  CAPTURE_READDRESS_SCHEMAS,
} from './capture-discovery';
import { ALLOW_HEADER_NAME, API_BASE_PATH, EXPORT_REASON_MAX_LENGTH, HEALTH_PATH, RETRY_AFTER_HEADER_NAME } from './constants';
import {
  AUTHENTICATED_ACCESS,
  CORE_SERVER_ONLY,
  CoreApiAuditNone,
  CoreApiMode,
  CoreApiService,
  CoreApiTag,
  PUBLIC_ACCESS,
  permissionAccess,
  type CoreApiRegistryOperation,
  type CoreApiResponseSpec,
} from './contract-model';
import { DEMO_OPERATIONS, DEMO_SCHEMAS } from './demo-controls';
import {
  CAPTURE_CONFIG_OPERATIONS,
  CAPTURE_CONFIG_SCHEMAS,
  CAPTURE_PREVIEW_OPERATIONS,
  CAPTURE_PREVIEW_SCHEMAS,
  CAPTURE_CREDENTIAL_OPERATION,
  DEVICE_OPERATIONS,
  DEVICE_SCHEMAS,
} from './devices';
import { EVIDENCE_OPERATIONS, EVIDENCE_SCHEMAS, TRANSCRIPT_MEDIA_OPERATIONS, TRANSCRIPT_MEDIA_SCHEMAS } from './evidence';
import { HealthResponseSchema } from './health';
import { IDENTITY_OPERATIONS, IDENTITY_SCHEMAS } from './identity';
import { INSTALLATION_ACCEPTANCE_OPERATIONS, INSTALLATION_ACCEPTANCE_SCHEMAS } from './installation-acceptance';
import { CAPTURE_RETIRE_OPERATIONS, CAPTURE_RETIRE_SCHEMAS } from './capture-retire';
// LCD bridge task: the panel's own firmware word (operation 114), public so the sign-in screen can read it.
import { PANEL_FIRMWARE_OPERATIONS, PANEL_SCHEMAS } from './lcd-panel';
import { PANEL_SETUP_OPERATIONS, PANEL_SETUP_SCHEMAS } from './lcd-setup';
import { NETWORK_TIME_OPERATIONS, NETWORK_TIME_SCHEMAS } from './network-time';
import { EXPORT_DENIAL_NOTE, INVALID_INPUT, NOT_SIGNED_IN, forbidden } from './operation-parts';
import { PAIRING_OPERATIONS, PAIRING_SCHEMAS } from './pairing';
import { HeartbeatSchema, REALTIME_SCHEMAS } from './realtime-messages';
import {
  API_ERROR_CODE_PATTERN,
  EVIDENCE_ID_PATTERN,
  EXPORT_ID_PATTERN,
  EXPORT_JOB_ID_PATTERN,
  MIC_INPUT_ID_PATTERN,
  OPERATOR_ID_PATTERN,
  SESSION_ID_PATTERN,
} from './patterns';
import { codeUnitBoundMessage } from './schema-parts';
import { SECURITY_AUDIT_OPERATIONS, SECURITY_AUDIT_SCHEMAS } from './security-audit';
import { sessionCreateSchema } from './session-schema';
import { AUDIO_SOURCE_OPERATIONS, AUDIO_SOURCE_SCHEMAS, SESSION_OPERATIONS, SESSION_SCHEMAS } from './sessions';
import {
  CameraStreamFactSchemas,
  CaptureConfigCameraSchema,
  CaptureConfigMicSchema,
  STATE_SCHEMAS,
} from './state-slices';
import { STORAGE_OPERATIONS, STORAGE_SCHEMAS } from './storage';
import { SYSTEM_OPERATIONS, SYSTEM_SCHEMAS } from './system';
import { STT_CONFIG_OPERATIONS, STT_CONFIG_SCHEMAS } from './transcription';
import { apiText } from './text';

export * from './contract-model';

// ═══════════════════════════════════════════════════════════════════════════════════════
// Building blocks
// ═══════════════════════════════════════════════════════════════════════════════════════

/**
 * The simulator keeps at most this many UTF-16 code units of an export destination and cuts the
 * rest. The request schemas refuse a longer one (after trimming), so a server that validates with
 * them never asks the simulator to cut (decision on finding F-1 of contract B).
 */
export const EXPORT_DESTINATION_MAX_LENGTH = 120;

/** ISO-8601 with an offset. The simulator writes UTC+07:00 (`…+07:00`, D28/Q2); `Z` is accepted too. */
const isoTime = () => z.iso.datetime({ offset: true });
const nullableIsoTime = () => isoTime().nullable();
const sessionId = () => z.string().regex(SESSION_ID_PATTERN);
const evidenceId = () => z.string().regex(EVIDENCE_ID_PATTERN);
const operatorId = () => z.string().regex(OPERATOR_ID_PATTERN);
const count = () => z.int().nonnegative();
const dbfs = () => z.number().min(-90).max(0);

// ═══════════════════════════════════════════════════════════════════════════════════════
// Error body (every 4xx and 5xx)
// ═══════════════════════════════════════════════════════════════════════════════════════

/**
 * Every code the document lists: the 16 the simulator's REST layer answers with, then the 15 the
 * Core server adds (backend task 01_specs §7.2), then the 9 of the capture phase (task 3 M2-W7;
 * C3 §4; SH-15) — 40 in all. `code` stays a pattern-checked string, so a code added later still
 * parses.
 */
export const ApiErrorCode = {
  INVALID_JSON: 'INVALID_JSON',
  NOT_SIGNED_IN: 'NOT_SIGNED_IN',
  NOT_PERMITTED: 'NOT_PERMITTED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  METHOD_NOT_ALLOWED: 'METHOD_NOT_ALLOWED',
  SESSION_ACTIVE: 'SESSION_ACTIVE',
  INVALID_INPUT: 'INVALID_INPUT',
  INVALID_STATE: 'INVALID_STATE',
  PRECHECK_RUNNING: 'PRECHECK_RUNNING',
  PRECHECK_WARNINGS: 'PRECHECK_WARNINGS',
  PRECHECK_BLOCKED: 'PRECHECK_BLOCKED',
  INVALID_REASON: 'INVALID_REASON',
  NOT_SEALED: 'NOT_SEALED',
  SECURITY_FAULT: 'SECURITY_FAULT',
  SIMULATOR_ERROR: 'SIMULATOR_ERROR',
  // The Core server's 15.
  INVALID_PATH: 'INVALID_PATH',
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  INVALID_CODE: 'INVALID_CODE',
  ORIGIN_NOT_ALLOWED: 'ORIGIN_NOT_ALLOWED',
  DEVICE_NOT_PAIRED: 'DEVICE_NOT_PAIRED',
  DEVICE_REVOKED: 'DEVICE_REVOKED',
  DEMO_DISABLED: 'DEMO_DISABLED',
  RECORDING_ACTIVE: 'RECORDING_ACTIVE',
  COMMAND_UNSUPPORTED: 'COMMAND_UNSUPPORTED',
  LAST_ADMIN: 'LAST_ADMIN',
  PAYLOAD_TOO_LARGE: 'PAYLOAD_TOO_LARGE',
  LOCKED: 'LOCKED',
  RATE_LIMITED: 'RATE_LIMITED',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  NOT_READY: 'NOT_READY',
  // Task 3 M2-W7 (blueprint row 48; register SH-15; C3 §4): the nine capture-phase codes, in the
  // order of the C3 §4 table. 31 -> 40 (SEC35-22 reconciles the union across rows 29/30/33).
  // Every code is SCREAMING_SNAKE_CASE (API_ERROR_CODE_PATTERN), so the audit writer's `code()`
  // rule accepts it in a detail (audit-details.ts). A failed export JOB is not an HTTP error: it
  // is the job's `status: FAILED` in the 200 body of operation 87 (audited EVIDENCE_EXPORT_FAILED).
  CAPTURE_CONFIG_LOCKED: 'CAPTURE_CONFIG_LOCKED',
  AUDIO_SOURCE_CONFLICT: 'AUDIO_SOURCE_CONFLICT',
  CAMERA_NOT_LOST: 'CAMERA_NOT_LOST',
  TRANSCRIPT_NOT_READY: 'TRANSCRIPT_NOT_READY',
  TRANSCRIPT_REVISION_CONFLICT: 'TRANSCRIPT_REVISION_CONFLICT',
  EXPORT_IN_PROGRESS: 'EXPORT_IN_PROGRESS',
  MEDIA_NOT_AVAILABLE: 'MEDIA_NOT_AVAILABLE',
  RESET_BLOCKED_REAL_EVIDENCE: 'RESET_BLOCKED_REAL_EVIDENCE',
  TRANSCRIPT_AUDIO_UNAVAILABLE: 'TRANSCRIPT_AUDIO_UNAVAILABLE',
  // Audit row 143 (D5; D28 DQ-2; register N-36 of masterplan/01_specs_d5.md): op 81 is retired - the
  // audio of each track is fixed by its camera-microphone pair. 40 -> 41.
  AUDIO_SOURCE_FIXED_BY_PAIRING: 'AUDIO_SOURCE_FIXED_BY_PAIRING',
} as const;
export type ApiErrorCode = (typeof ApiErrorCode)[keyof typeof ApiErrorCode];
/** The codes in document order. */
export const API_ERROR_CODES = Object.values(ApiErrorCode) as readonly ApiErrorCode[];

/** `details.reason` of the 401 that a request with two credentials gets (ID-12). */
export const CREDENTIAL_CONFLICT_REASON = 'CREDENTIAL_CONFLICT';

export const ApiErrorSchema = z
  .object({
    error: z.object({
      code: z
        .string()
        .regex(API_ERROR_CODE_PATTERN)
        .describe(`Machine-readable code: ${API_ERROR_CODES.join(', ')}.`),
      message: z.string().min(1).describe('Operator-safe English text. Never contains credentials.'),
      details: z
        .record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()]))
        .optional()
        .describe(
          'Optional machine-readable context, a flat map: `simCode`, `permission`, `from`, `event`, `attemptsRemaining`, `lockedUntil`, `retryInMs`, `reason`, `in`, `sessionId` (409 `SESSION_ACTIVE` of the Core server: the open session). Never a credential or a part of the input.',
        ),
      requestId: z
        .string()
        .min(1)
        .optional()
        .describe('The ID of the request in the answering service\'s log; the same value as the `x-request-id` header.'),
    }),
  })
  .describe('Error body of every 4xx and 5xx response.');
export type ApiError = z.output<typeof ApiErrorSchema>;

// ═══════════════════════════════════════════════════════════════════════════════════════
// Session (book §6.2, §21.2)
// ═══════════════════════════════════════════════════════════════════════════════════════

export const SessionStartRequestSchema = z
  .object({
    acknowledgeWarnings: z
      .boolean()
      .optional()
      .describe('Send `true` to acknowledge a pre-check that ended with WARN and start recording.'),
  })
  .describe('Optional request body of `POST /api/v1/session/{id}/start`.');
export type SessionStartRequest = z.output<typeof SessionStartRequestSchema>;

export const SessionStopRequestSchema = z
  .object({
    reason: apiText()
      .overwrite((value) => value.trim())
      .min(STOP_REASON_MIN_LENGTH)
      .describe(`Why the recording stops (at least ${STOP_REASON_MIN_LENGTH} characters after trimming; S21).`),
  })
  .describe('Request body of `POST /api/v1/session/{id}/stop`.');
export type SessionStopRequest = z.output<typeof SessionStopRequestSchema>;

export const SessionCommandResponseSchema = z
  .object({
    sessionId: sessionId(),
    state: z.enum(SessionState).describe('The session state after the command.'),
    created: z.boolean().optional().describe('Create only: false when the same input returned the open session (S26).'),
  })
  .describe('Result of a session command (create, start, stop).');
export type SessionCommandResponse = z.output<typeof SessionCommandResponseSchema>;

export const PrecheckItemSchema = z
  .object({
    id: z.enum(PrecheckCheckId),
    status: z.enum(PrecheckStatus),
    value: z.string().nullable().describe('Live device state, e.g. ONLINE, READY, NO_SIGNAL, GNSS.'),
    reason: z.string().nullable().describe('Why the check warns or blocks.'),
  })
  .describe('One of the twelve book §5.3 pre-recording checks (the first eight of the book keep their readable sense; lens 3, lens 4, microphone 3 and microphone 4 were added by audit fix row 83).');
export type PrecheckItemBody = z.output<typeof PrecheckItemSchema>;

export const SessionResourceSchema = z
  .object({
    id: sessionId().describe('Session ID `SES-{YYYYMMDD}-NNNN` (the sim clock date, UTC+07:00).'),
    state: z.enum(SessionState).describe('Book §6.2 state. FAULT and RECOVERY are demo assumptions (01 G4).'),
    caseNumber: z.string().min(1).describe('Case reference, `LP/YYYY/MMDD-NNNN` when created through the form.'),
    subjectType: z.enum(SubjectType),
    subjectName: z.string().min(1),
    investigatorId: operatorId(),
    investigatorName: z.string().describe('Rank and name, e.g. "AKP Budi Santoso".'),
    room: z.string().min(1),
    profileId: z.enum(RecordingProfileId),
    createdAt: isoTime(),
    startedAt: nullableIsoTime(),
    stoppedAt: nullableIsoTime(),
    sealedAt: nullableIsoTime(),
    elapsedMs: count().describe('Recording time so far (0 before RECORDING), derived from the clock.'),
    bytesWritten: count(),
    evidenceId: evidenceId().nullable().describe('Set once finalization creates the evidence object.'),
    precheck: z
      .object({
        outcome: z.enum(['PASS', 'WARN', 'BLOCK']).nullable().describe('Null while checks run.'),
        // Audit fix row 83 (DF-03): a run holds the twelve checks of `PRECHECK_ORDER`; a session whose
        // pre-check ran before the fix (still ARMED or RECORDING across the deploy) holds its eight.
        items: z.array(PrecheckItemSchema).min(8).max(PRECHECK_ORDER.length),
      })
      .nullable()
      .describe('Null before the pre-check starts.'),
    fault: z
      .object({ kind: z.enum(FaultKind), at: isoTime(), fromState: z.enum(SessionState) })
      .nullable()
      .describe('The critical fault that moved the session to FAULT, if any.'),
    // ── Schema v2 (task 3 M2-W7; C3 §3 op 27; register SH-05/SH-06; `dbc-3 §B.10`) ──────────
    // Optional: a v1 answer carries none of the three, so every pre-v2 producer still parses. The
    // three carry epoch milliseconds like the slices they mirror (API-6: one wire form for the
    // socket and REST); the Core writes them from Core instants only (E-13).
    captureConfig: z
      .strictObject({
        cameras: z.array(CaptureConfigCameraSchema),
        mics: z.array(CaptureConfigMicSchema),
        revision: count().describe('Selector revision the snapshot was taken at.'),
        updatedAt: z.int().nonnegative(),
      })
      .optional()
      .describe('The capture-config snapshot taken when recording started; a later edit never changes it (OD-10).'),
    audioSource: z
      .strictObject({
        activeInputId: z.string().regex(MIC_INPUT_ID_PATTERN),
        standbyInputId: z.string().regex(MIC_INPUT_ID_PATTERN),
        switchedAt: z.int().nonnegative().nullable().describe('When the last switch took effect; null before the first.'),
        intervalFromMs: count().describe('Media-pts start of the interval the switch opened (never wall clock).'),
      })
      .nullable()
      .optional()
      .describe('The inputs of channels `MIC-01` and `MIC-02` of this session: `activeInputId` is the microphone of Pair 1 (camera `VIDEO-01`), whose audio is transcribed on `AUDIO-01` (D61, 2026-11-04: all four channels record; D5, D28: each channel is the microphone of its own camera, and op 81 no longer moves the transcribed one - it answers `409 AUDIO_SOURCE_FIXED_BY_PAIRING`).'),
    captureDurable: z
      .boolean()
      .optional()
      .describe('False from the accepted start until the first durable fragment ("connecting cameras"), then true; the state stays RECORDING (D84, D91 R-1). Absent reads as true.'),
    finalization: z
      .strictObject({
        steps: z
          .array(
            z.strictObject({
              id: z.enum(FinalizationStep).describe('v2 step names: CLOSE_TRACKS .. STORE_SEALED_PACKAGE (SH-01; `ev §E`).'),
              status: z.enum(StepStatus),
              startedAt: z.int().nonnegative().nullable(),
              completedAt: z.int().nonnegative().nullable(),
              durationMs: count().nullable(),
              progress: count().optional().describe('Sealing progress of this step, 0..100 (E-13: Core instants only).'),
              etaMs: z.int().nonnegative().nullable().optional(),
              detail: z.string().nullable().optional(),
              attempt: count().optional().describe('Attempt of this step, >= 1; a resumed run increments it (OD-08).'),
            }),
          )
          .describe('The v2 sealing steps, in pipeline order.'),
        startedAt: z.int().nonnegative().nullable(),
        completedAt: z.int().nonnegative().nullable(),
      })
      .optional()
      .describe('Finalization v2 of this session; absent before sealing starts.'),
  })
  .describe('The open session (schema v2: capture-config snapshot, audio source, v2 finalization).');
export type SessionResource = z.output<typeof SessionResourceSchema>;

export const CurrentSessionResponseSchema = z
  .object({
    session: SessionResourceSchema.nullable().describe('Null when no session is open (IDLE).'),
    serverTime: isoTime(),
  })
  .describe('Response of `GET /api/v1/session/current` (the tablet resynchronises with it after a reconnect, book §5.6).');
export type CurrentSessionResponse = z.output<typeof CurrentSessionResponseSchema>;

// ═══════════════════════════════════════════════════════════════════════════════════════
// Video, audio, storage, device health (book §6.1, §21.2)
// ═══════════════════════════════════════════════════════════════════════════════════════

export const VideoTrackStatusSchema = z
  .object({
    trackId: z.enum(VIDEO_TRACK_IDS), // D60 (2026-11-04): the track domain widened from two to four
    deviceId: z.string().min(1).describe('e.g. CAM-01.'),
    /**
     * Schema v2 (task 3 M2-W7; register SH-05; C3 §3 op 46): the capture-config device feeding
     * this track. It equals `deviceId` in the built-in topology and may differ once the selector
     * maps another device onto the track (OD-05).
     *
     * Task 4 row 28 (WP-13a; decision C25; names register E39): `null` for a track whose selector
     * slot is not assigned. No device stands in for it; `tracks` stays one entry per track (D60,
     * 2026-11-04: the track domain is VIDEO-01 to VIDEO-04).
     */
    sourceDeviceId: z
      .string()
      .min(1)
      .nullable()
      .describe('The capture device assigned to this track by the selector (op 79 moves it). Null: the slot of this track is not assigned.'),
    /**
     * Schema v2 (C3 §3 ops 44/46; OD-22): LIVE or LOST; a LOST stream is what makes op 48's PoE cycle legal.
     *
     * Task 4 row V7d (decisions C126 (b), C141): NULLABLE, null = NOT READ - the selector line's own
     * value (`CaptureConfigCameraSchema.streamState`), never the registry flag in its place. A track
     * without a line states null too: it has no source whose stream could be read.
     */
    streamState: z
      .enum(CaptureStreamState)
      .nullable()
      .describe('The stream state of the track\'s selector line, as the `captureConfig` slice states it (OD-22: a LOST stream makes a PoE cycle legal). NULL = NOT READ (task 4 row V7d; decision C126 (b)): the Core reads no stream of this camera now - a registered camera at rest - or the track has no source (`sourceDeviceId` null). Never derived from `online`, the registry flag. The two built-in cameras of the demonstration model state the model\'s `LIVE` / `LOST`.'),
    name: z.string().min(1),
    lens: z.enum(LensState),
    online: z.boolean(),
    recState: z.enum(TrackRecState).nullable().describe('Null when not recording.'),
    // Task 4 row 52 (WP-10b): the stream's own facts, the same three schemas as the `cameras` slice.
    resolution: CameraStreamFactSchemas.resolution,
    fps: CameraStreamFactSchemas.fps,
    codec: CameraStreamFactSchemas.codec,
    // Pass I-9b (request line of row W4): nullable, as in the `cameras` slice.
    bitrateMbps: z.number().nonnegative().nullable().describe('Megabits per second; null when no telemetry states a bitrate for the track. Never a default.'),
  })
  .describe('One video track (D60, 2026-11-04: the domain is VIDEO-01 to VIDEO-04; the built-in demonstration model answers its camera lines), its source device and its stream state (schema v2).');
export type VideoTrackStatus = z.output<typeof VideoTrackStatusSchema>;

/**
 * One microphone INPUT (schema v2; task 3 M2-W7; register SH-15/SH-17; C3 §3 op 45; E-02). The
 * v1 entry was keyed by the channel `AUDIO-01`/`AUDIO-02`; v2 keys it by the input `MIC-NN` and
 * carries the selector CHANNEL it stands on (D61 of 2026-11-04: four simultaneous channels
 * `MIC-01`..`MIC-04`, each feeding its own track `AUDIO-0N`; the OD-01 T1 one-track premise and
 * the PRIMARY/STANDBY role it carried here are superseded — channel 1 keeps the transcription
 * duty). The components name stays for wire stability of the array member.
 */
export const AudioChannelStatusSchema = z
  .object({
    inputId: z.string().regex(MIC_INPUT_ID_PATTERN).describe('The physical input, `MIC-NN`: the built-in MIC-01 / MIC-02 or a microphone registered later (never a track).'),
    deviceId: z.string().min(1).describe('e.g. MIC-01.'),
    name: z.string().min(1).describe('e.g. "MIC 1 – Interviewer".'),
    channel: z.enum(MIC_CHANNEL_IDS).describe('The selector channel this input stands on (D61, 2026-11-04): `MIC-01`..`MIC-04`; channel 1 feeds the transcribed track AUDIO-01.'), // D61: was `role` PRIMARY/STANDBY (OD-01/OD-09, superseded)
    state: z.enum(MicState),
    recState: z.enum(TrackRecState).nullable(),
    dbfs: dbfs().describe('Ballistic level in dBFS; -90 means no signal.'),
    peak: dbfs().describe('Peak hold in dBFS (1.5 s, then 20 dB/s decay).'),
    clip: z.boolean().describe('CLIP latch (EVT-07), kept until reset.'),
    noSignal: z.boolean(),
    // Fix wave J (JW-08): the member of the audio frame, on the answers of operations 44 and 45 too.
    notMeasured: z
      .literal(true)
      .optional()
      .describe('Present and true when the Core does not measure this input now (a Core in its own capture with no capture open): `dbfs` / `peak` are the floor as placeholders, `noSignal` is false, and a client draws "Not measured". Absent: a measured (or generated) level.'),
    gainDb: z.number().describe('Read-only in the UI (G13).'),
    phantom: z.boolean(),
  })
  .describe('One mic input on one of the four selector channels `MIC-01`..`MIC-04` (schema v2; D61, 2026-11-04: the PRIMARY/STANDBY roles became the numbered channels).');
export type AudioChannelStatus = z.output<typeof AudioChannelStatusSchema>;

export const VideoStatusResponseSchema = z
  // D60 (2026-11-04): one entry per track of the widened domain - the four camera lines VIDEO-01 to
  // VIDEO-04 (was `.length(2)`; the surrounding rule already says "tracks stays one entry per track").
  .object({ tracks: z.array(VideoTrackStatusSchema).length(VIDEO_TRACK_IDS.length) })
  .describe('Per-track video status (D60: VIDEO-01 to VIDEO-04).');
export type VideoStatusResponse = z.output<typeof VideoStatusResponseSchema>;

/**
 * Task 4 row 28 (WP-13a; decision C25; names register E40, driver decision D-2): an entry of
 * `channels` IS a microphone input, so a meter channel without an input has NO entry (at most two,
 * not exactly two), and `activeInputId` is `null` when the selector holds no PRIMARY line. On a
 * complete selector the answer is what it was: two entries and an input.
 */
export const AudioStatusResponseSchema = z
  .object({
    channels: z
      .array(AudioChannelStatusSchema)
      .max(4) // D61 (2026-11-04): four simultaneous microphone channels
      .describe('The mic inputs of the capture, one entry per microphone channel that has an input: four on a complete selector (the built-in MIC-01..MIC-04 unless the selector holds another `MIC-NN`; D61, 2026-11-04), fewer while a microphone channel is not assigned. Never merged (SYS-003).'),
    activeInputId: z
      .string()
      .regex(MIC_INPUT_ID_PATTERN)
      .nullable()
      .describe('The input whose audio is transcribed on AUDIO-01 right now: the microphone of Pair 1, the input of channel `MIC-01` (SH-15; D61: all four channels record at once; D5, D28: op 80 places it before the session, op 81 no longer moves it). Null: the selector holds no channel-1 microphone.'),
  })
  .describe('Per-input audio snapshot with the transcribed input (D61: four simultaneous channels; D5: channel `MIC-0N` is the microphone of camera `VIDEO-0N`, and the transcription stays on Pair 1). Meters use it as their initial value; live levels run at 20 Hz in-process.');
export type AudioStatusResponse = z.output<typeof AudioStatusResponseSchema>;

export const StorageStatusResponseSchema = z
  .object({
    state: z
      .enum(StorageState)
      .describe('READY, LOW (≥ 85 % used) or FULL (≥ 98 % used); the thresholds are demo assumptions (G8).'),
    totalBytes: count().describe('Evidence volume capacity (decimal bytes).'),
    usedBytes: count(),
    freeBytes: count(),
    usedPercent: z.int().min(0).max(100),
    estimatedRemainingMs: count().describe('Free space ÷ 8.2 GB/h, rounded.'),
    writeBytesPerSec: z.number().nonnegative(),
    bitrateMbps: z.number().nonnegative(),
    volumes: z.array(
      z.object({
        id: z.enum(['NVME-SYS', 'HDD-EVIDENCE']),
        kind: z.enum(['SYSTEM', 'EVIDENCE']),
        label: z.string().min(1),
        totalBytes: count(),
        usedBytes: count(),
      }),
    ),
    retention: z.object({
      policy: z.enum(RetentionPolicyId),
      days: count(),
      autoArchive: z.boolean(),
    }),
  })
  .describe('Storage capacity and health, including the LOW and FULL states.');
export type StorageStatusResponse = z.output<typeof StorageStatusResponseSchema>;

export const DeviceHealthResponseSchema = z
  .object({
    lcd: LcdIntegrationStatusSchema.optional().describe('Optional local LCD bridge; absent when not configured. HTTP reachability is separate from USB panel liveness.'),
    device: z.object({
      id: z.string().min(1).describe('e.g. DEMS-IR-01.'),
      name: z.string().min(1),
      softwareVersion: z.string().min(1),
    }),
    systemState: z.enum(SystemState).describe('Overall state (the Dashboard ring).'),
    flags: z
      .array(z.object({ id: z.string().min(1), severity: z.enum(Severity), message: z.string().min(1) }))
      .describe('What makes the state ATTENTION or CRITICAL.'),
    // D60 (2026-11-04): the health answer carries the same four camera lines as operation 46 (was `.length(2)`).
    cameras: z.array(VideoTrackStatusSchema).length(VIDEO_TRACK_IDS.length).describe('Schema v2: each camera carries `streamState` (C3 §3 op 44; OD-22; D60: four camera lines).'),
    // Task 4 row 28 (DRIVER DECISION, see implementation/028): the two audio members of the health
    // answer are built by the same functions as operation 45 (`audioChannelsOf`, `activeInputOf`),
    // so they take the same widening as `AudioStatusResponseSchema` (register E40).
    audio: z
      .array(AudioChannelStatusSchema)
      .max(4) // D61 (2026-11-04): the same four-channel widening as operation 45
      .describe('Schema v2: keyed by the mic inputs (`MIC-NN`) with their channels (D61: four simultaneous channels); four on a complete selector, fewer while a microphone channel is not assigned.'),
    activeInputId: z
      .string()
      .regex(MIC_INPUT_ID_PATTERN)
      .nullable()
      .describe('Schema v2 (C3 §3 op 44; D61, 2026-11-04): the input of channel `MIC-01`, feeding the transcribed track AUDIO-01 right now. Null: the selector holds no channel-1 microphone.'),
    storage: StorageStatusResponseSchema,
    time: z.object({
      source: z.enum(TimeSource).describe('Active source, priority GNSS → NTP → RTC.'),
      locked: z.boolean(),
      stratum: count(),
      offsetMs: z.number(),
      lastSyncAt: isoTime(),
    }),
    security: z.object({
      state: z.enum(SecurityState),
      posture: z.enum(SecurityPosture),
      tpmOk: z.boolean().describe('TPM 2.0 present and healthy.'),
      secureBoot: z.boolean(),
      tamper: z.boolean().describe('Enclosure tamper switch tripped (EVT-12).'),
      // Fix wave J (truth rule 3c; JW-04 / JT-03): the statement of the `security` slice, on this answer too.
      platformNotReported: z
        .literal(true)
        .optional()
        .describe('Present and true on a Core in its own capture: it reads no TPM, no Secure Boot state and computes no posture - `tpmOk`, `secureBoot` and `posture` are then placeholders of the required members, never readings. A client shows "Not reported". Absent: the simulated device.'),
    }),
    services: z
      .array(z.object({ id: z.string().min(1), name: z.string().min(1), status: z.enum(ServiceStatus) }))
      .describe('The 16 book §6.1 Core services and the transcriber service.'),
    serverTime: isoTime(),
  })
  .describe('Device health snapshot: camera, audio, storage, time and security, plus services.');
export type DeviceHealthResponse = z.output<typeof DeviceHealthResponseSchema>;

// ═══════════════════════════════════════════════════════════════════════════════════════
// Evidence export (book §19.2, §19.3)
// ═══════════════════════════════════════════════════════════════════════════════════════

/**
 * The kind of an export (task 3 M2-W7; register SH-14/NM-12; OD-16; C3 §3 op 42). PACKAGE is the
 * decrypted copy + manifest + signature; COMPOSITE additionally renders the side-by-side video,
 * marked `derived` and hashed into the export manifest.
 */
export const EvidenceExportKind = { PACKAGE: 'PACKAGE', COMPOSITE: 'COMPOSITE' } as const;
export type EvidenceExportKind = (typeof EvidenceExportKind)[keyof typeof EvidenceExportKind];

/**
 * Options of the composite render. Empty today: the composite encoder is picked only after the
 * M8 licence check (blueprint row 91/D228; NM-12), which will give this object its members.
 * Sending `{}` with `kind: COMPOSITE` asks for the side-by-side video.
 */
export const EvidenceExportCompositeOptionsSchema = z
  .strictObject({})
  .describe('Composite render options; reserved for the M8 encoder parameters (NM-12).');
export type EvidenceExportCompositeOptions = z.output<typeof EvidenceExportCompositeOptionsSchema>;

export const EvidenceExportRequestSchema = z
  .object({
    reason: apiText()
      .overwrite((value) => value.trim())
      .min(EXPORT_REASON_MIN_LENGTH)
      // A refinement, like the text rule: the JSON Schema of the component does not change.
      .refine((value) => value.length <= EXPORT_REASON_MAX_LENGTH, { error: codeUnitBoundMessage(EXPORT_REASON_MAX_LENGTH) })
      .describe(`Purpose of the export (book §19.2 item 8; at least ${EXPORT_REASON_MIN_LENGTH} characters after trimming).`),
    destination: apiText()
      // A refinement, like the text rule: the JSON Schema of the component does not change.
      .refine((value) => value.trim().length <= EXPORT_DESTINATION_MAX_LENGTH, {
        error: codeUnitBoundMessage(EXPORT_DESTINATION_MAX_LENGTH),
      })
      .optional()
      .describe(
        `Destination or approved media identifier (book §19.2 item 6). Empty means the Core's default - "Case file transfer" on a Core in its own capture, "Case file transfer (simulated)" in simulated capture (operation 40 states it as \`exportDestinationDefault\`); text beyond ${EXPORT_DESTINATION_MAX_LENGTH} characters is cut.`,
      ),
    // Schema v2 (C3 §3 op 42): the request names the kind; absent means PACKAGE, so every v1 caller still parses.
    kind: z.enum(EvidenceExportKind).optional().describe('PACKAGE (the default when absent) or COMPOSITE (OD-16; NM-12).'),
    composite: EvidenceExportCompositeOptionsSchema
      .optional()
      .describe('Set with `kind: COMPOSITE`; ignored otherwise. The job marks its output `derived` (OD-16).'),
  })
  .describe('Request body of `POST /api/v1/evidence/{id}/export` (schema v2: kind + composite).');
export type EvidenceExportRequest = z.output<typeof EvidenceExportRequestSchema>;

export const EvidenceExportAcceptedSchema = z
  .object({
    exportId: z.string().regex(EXPORT_ID_PATTERN),
    evidenceId: evidenceId(),
    /**
     * Schema v2 (C3 §3 op 42): the answer means "the job is queued", not "the file exists" — the
     * background job runs on the Core and op 87 polls it to completion. The EVIDENCE_EXPORTED row
     * is the REQUEST row; a failing job writes EVIDENCE_EXPORT_FAILED (§5.2).
     */
    status: z.literal('QUEUED'),
    jobId: z
      .string()
      .regex(EXPORT_JOB_ID_PATTERN)
      .optional()
      .describe('The job operation 87 polls: `EXPJ-` and the six digits of `exportId` (`EXP-000012` -> `EXPJ-000012`). Optional: a client that does not find it derives it by that rule.'),
    // Fix wave K, driver S2 (re-gate 94 finding G94b-06): whether an archive will exist at all, said by the Core.
    archiveOnCore: z
      .boolean()
      .optional()
      .describe(
        'Core server only. `true`: an export job of this Core writes the archive into the Core\'s store (operation 87 follows it). `false`: the request was recorded and NO archive is written - an item of the demonstration data. Absent: not stated; a client then claims no stored archive.',
      ),
  })
  .describe(
    'Export accepted and queued (schema v2). The ExportEvent (book §19.2: operator, time, destination, reason) is the EVIDENCE_EXPORTED audit row it wrote; completion arrives through operation 87.',
  );
export type EvidenceExportAccepted = z.output<typeof EvidenceExportAcceptedSchema>;

// ═══════════════════════════════════════════════════════════════════════════════════════
// Component registry (OpenAPI `components.schemas`)
// ═══════════════════════════════════════════════════════════════════════════════════════

/**
 * Every named schema of the contract, keyed by its `components.schemas` name. Nested named
 * schemas become `$ref`s. `Heartbeat` is the WS `/ws` message (OpenAPI cannot model the
 * socket; the Realtime tag describes it).
 *
 * The first 18 are the schemas of the ten existing operations, in their order; the document of
 * the `offline` scope holds exactly these. The schemas of contract A follow, by area (areas 1, 2,
 * 3 and 13); then the Core state on the wire (`state-slices.ts`: the 30 replicated slices and what
 * they are made of) and the messages of the Core server's socket (`realtime-messages.ts`); then
 * the schemas of contract C, by area (areas 4 to 11). The reads of those areas answer the slices
 * and their rows (API-6), so a slice has one schema for the socket and for REST.
 */
export const CORE_API_SCHEMAS = {
  HealthResponse: HealthResponseSchema,
  SessionCreateRequest: sessionCreateSchema,
  SessionStartRequest: SessionStartRequestSchema,
  SessionStopRequest: SessionStopRequestSchema,
  SessionCommandResponse: SessionCommandResponseSchema,
  PrecheckItem: PrecheckItemSchema,
  SessionResource: SessionResourceSchema,
  CurrentSessionResponse: CurrentSessionResponseSchema,
  VideoTrackStatus: VideoTrackStatusSchema,
  AudioChannelStatus: AudioChannelStatusSchema,
  VideoStatusResponse: VideoStatusResponseSchema,
  AudioStatusResponse: AudioStatusResponseSchema,
  StorageStatusResponse: StorageStatusResponseSchema,
  DeviceHealthResponse: DeviceHealthResponseSchema,
  EvidenceExportRequest: EvidenceExportRequestSchema,
  EvidenceExportAccepted: EvidenceExportAcceptedSchema,
  EvidenceExportCompositeOptions: EvidenceExportCompositeOptionsSchema,
  ApiError: ApiErrorSchema,
  Heartbeat: HeartbeatSchema,
  ...IDENTITY_SCHEMAS,
  ...ADMINISTRATION_SCHEMAS,
  ...PAIRING_SCHEMAS,
  ...DEMO_SCHEMAS,
  ...STATE_SCHEMAS,
  ...REALTIME_SCHEMAS,
  ...SESSION_SCHEMAS,
  ...EVIDENCE_SCHEMAS,
  ...DEVICE_SCHEMAS,
  ...STORAGE_SCHEMAS,
  ...NETWORK_TIME_SCHEMAS,
  ...SECURITY_AUDIT_SCHEMAS,
  ...SYSTEM_SCHEMAS,
  ...ALERT_SCHEMAS,
  // Task 3 M2-W7 (blueprint row 48; C3 §2): the capture-config, audio-source, sealing-progress,
  // transcript, export-job and media-session schemas of operations 76-89.
  ...CAPTURE_CONFIG_SCHEMAS,
  ...AUDIO_SOURCE_SCHEMAS,
  ...TRANSCRIPT_MEDIA_SCHEMAS,
  // Task 3 M6 (blueprint row 113; C3 §2.5; R-8): the STT configuration schemas of operations 90-92.
  ...STT_CONFIG_SCHEMAS,
  // Task 3 R-9..R-11 (blueprint row 132, decision D106; C3 §2.6): the eight schemas of operations 93-97.
  ...CAPTURE_DISCOVERY_SCHEMAS,
  // Task 4 (blueprint row 63, WP-07b; design addendum 4.2): the four schemas of operations 98-99.
  ...CAPTURE_AUDIO_CARD_SCHEMAS,
  // Task 4 (blueprint row 194, WP-12): the two schemas of operation 100.
  ...CAPTURE_READDRESS_SCHEMAS,
  // Task 4 (blueprint row 102, WP-23b): the nine schemas of operations 101-107.
  ...CAPTURE_COMMISSIONING_SCHEMAS,
  // Task 4 (row V3, the third contract step; blueprint row 146): the one schema of operation 108.
  ...CAPTURE_DEVICE_TEST_SCHEMAS,
  // Task 4 (blueprint row 116, WP-26b): the five schemas of operations 109-110.
  ...INSTALLATION_ACCEPTANCE_SCHEMAS,
  // Task 4 (row RD2; design 07): the two schemas of operation 111.
  ...CAPTURE_RETIRE_SCHEMAS,
  // Task 4 bare-metal bench (decisions D51, D53): the two schemas of operations 112-113.
  ...CAPTURE_PREVIEW_SCHEMAS,
  // LCD bridge task: the one schema of operation 114.
  ...PANEL_SCHEMAS,
  ...PANEL_SETUP_SCHEMAS,
} as const;
export type CoreApiSchemaName = keyof typeof CORE_API_SCHEMAS;

// ═══════════════════════════════════════════════════════════════════════════════════════
// Operations
// ═══════════════════════════════════════════════════════════════════════════════════════

// The model of an entry (`CoreApiTag`, `CoreApiMode`, `CoreApiOperation`, the access and audit rules)
// lives in `contract-model.ts` and is re-exported at the top of this file.

const SIM_NOTE =
  'Simulated: "Try it" is answered in the browser by the demo simulator (header `x-dems-simulated: 1`). Nothing leaves the machine.';

const INVALID_JSON: CoreApiResponseSpec = { description: 'The body is not a JSON object (INVALID_JSON).', schema: 'ApiError' };

/** Refusals by the access rule write ACCESS_DENIED (RB-4); the simulated reads write nothing (API-8). */
const READ_AUDIT = { success: CoreApiAuditNone.READ, denial: AuditType.ACCESS_DENIED } as const;
const SESSION_START_ACCESS = permissionAccess(Permission.SESSION_START);

// ── What the `all` scope says about the ten operations (01_specs §7.19) ───────────────────────
// `description` is the text of the `offline` scope and stays as it was: it speaks of the simulator
// and of mock-core, which is who answers when the Core server is not there. `coreServerDescription`
// keeps the paragraphs that hold for both and ends with what the Core server does.

/** Last paragraph of `coreServerDescription` of the nine design-book operations. */
const CORE_SERVER_ANSWERS =
  'Answered by the Core server. In Simulated mode the in-app simulator answers the same operation inside the app, without a request, and marks its answer with the header `x-dems-simulated: 1`; the Core server never sends that header.';

/** `coreServerDescription` of the five simulated reads: their access rule is AUTHENTICATED. */
const READ_FOR_EVERY_ROLE = 'Needs a signed-in operator. Every role may read it: the operation needs no permission.';

/**
 * `coreServerDescription` of the session commands (W83, gap W34-1 and gap W34-3): the
 * Core server's refusal texts are fixed; the examples show the in-app simulator's.
 */
const CORE_SERVER_SESSION_TEXTS =
  'The Core server\'s refusal texts are fixed and quote no part of the request: a session that is not the open one answers `404 NOT_FOUND` "This session is not the open session." (`details.simCode: NOT_FOUND`), and an action that does not fit the session\'s state answers `409 INVALID_STATE` "The action is not allowed in the current state." with `details.simCode: ILLEGAL_STATE`, `from` and `event`. A `409 SESSION_ACTIVE` names the open session in `details.sessionId`. The examples show the texts of the in-app simulator.';

/** `coreServerDescription` of the three session commands. */
const SESSION_START_REFUSAL =
  'One session is open per Core, and any operator holding SESSION_START may act on it. A caller whose role lacks the permission is refused with `403 NOT_PERMITTED` and one ACCESS_DENIED audit row, before the body is read.';

/**
 * The statuses only the Core server sends on a read that the in-app simulator answers too: the
 * simulator's read handlers check no sign-in, the server's access rule does (01_specs §7.2, §7.19).
 */
const CORE_SERVER_READ_REFUSALS = {
  401: { ...NOT_SIGNED_IN, services: CORE_SERVER_ONLY },
  403: { ...forbidden(), services: CORE_SERVER_ONLY },
} as const;

const CREATE_SESSION_TEXT = [
  'Creates a session and returns its Session ID; the session enters **CREATE** (book §6.2, §12.2 steps 1-2).',
  'Idempotent (S26): the same input while that session is still open returns it with `200` and `created: false`.',
  'Requires a signed-in operator holding SESSION_START; writes the SESSION_CREATED audit row.',
];

const START_SESSION_TEXT = [
  'Runs the Core pre-check (book §5.3: twelve checks) and starts recording.',
  [
    '- From **CREATE**: begins the pre-check and answers `202` with state **PRECHECK**. Poll `GET /api/v1/session/current` and call again once it is **ARMED**.',
    '- From **ARMED**: starts recording and answers `200` with state **RECORDING**.',
    '- Pre-check ended with **WARN**: send `{"acknowledgeWarnings": true}` to acknowledge and start; without it the answer is `409 PRECHECK_WARNINGS`.',
    '- Pre-check with a **BLOCK** (Core offline, lens fault, storage full, security fault): `409 PRECHECK_BLOCKED` with the reasons.',
  ].join('\n'),
  'Requires a signed-in operator holding SESSION_START; the audit rows name that operator.',
];

const STOP_SESSION_TEXT = [
  'Stops the recording with a mandatory reason and moves the session to finalization: **STOPPING** → **FINALIZING** (hashes, manifest, encryption, signature) → **SEALED** (book §6.2, §12.2 steps 5-10).',
  'Answers `202` at STOPPING; poll `GET /api/v1/session/current` for the seal.',
  'Requires a signed-in operator holding SESSION_START; the RECORDING_STOPPED row names that operator.',
];

const CURRENT_SESSION_TEXT = [
  'Returns the open session, or `null` when idle. The tablet calls it after a reconnect to resynchronise (book §5.5, §5.6).',
];

const DEVICE_HEALTH_TEXT = [
  'Health of camera, audio, storage, time and security (book §6.1, §21.2), used by the pre-check and diagnostics. Distinct from the service liveness `GET /api/v1/health`.',
];

const AUDIO_STATUS_TEXT = [
  'Per-channel levels and faults for the FOUR simultaneous audio channels AUDIO-01 to AUDIO-04 (D61 of 2026-11-04; the book §21.2 named two), reported separately (book §21.2, SYS-003).',
];

const VIDEO_STATUS_TEXT = ['Per-track status for the recorded video tracks (D60, 2026-11-04: VIDEO-01 to VIDEO-04; book §21.2).']; // D60

const STORAGE_STATUS_TEXT = ['Capacity and health of the evidence storage, including the LOW and FULL states (book §21.2).'];

const EXPORT_OUTCOMES = [
  '- SUPERVISOR (holds EVIDENCE_EXPORT): `202`, and an EVIDENCE_EXPORTED audit row (the ExportEvent).',
  '- INVESTIGATOR or TECHNICIAN: `403 FORBIDDEN`, and an EXPORT_DENIED audit row (EVT-26).',
].join('\n');
const EXPORT_SEALED_ONLY =
  'Only SEALED, UNDER_REVIEW or EXPORTED evidence can be exported, and the sealed source is never modified (book §19.3 rule 1).';

const OPERATION_TABLE = [
  {
    operationId: 'getServiceHealth',
    method: 'get',
    path: HEALTH_PATH,
    tag: CoreApiTag.SERVICE,
    mode: CoreApiMode.LIVE,
    summary: 'Service liveness',
    // KI-18, corrected by the contract close-out W83: the origin depends on the build, so the text names none as fixed.
    description:
      'Liveness of the local mock-core service. **Live**: served by mock-core over the network, on 127.0.0.1:4400 in a development run and on the page\'s own origin in a packaged build. This is not the device health snapshot; that is `GET /api/v1/device/health`.',
    coreServerDescription: [
      'Liveness of the service that answers. Public: it needs no credential and returns nothing of the Core state.',
      [
        '- The Core server answers `service: dems-core-server` with its version and `ready`, which says whether its database and its engine are ready. The status is `200` for as long as the process answers, so a stopped database shows as `ready.database: false`.',
        '- mock-core, the heartbeat-only service of Simulated mode, answers `service: dems-mock-core` and no `ready`.',
      ].join('\n'),
      'This is not the device health snapshot; that is `GET /api/v1/device/health`.',
    ].join('\n\n'),
    source: 'masterplan/01_specs.md §2.5, §3.2 (demo; not in the design book)',
    responses: {
      200: { description: 'The service is up.', schema: 'HealthResponse' },
    },
    access: PUBLIC_ACCESS,
    audit: READ_AUDIT,
    services: [CoreApiService.MOCK_CORE, CoreApiService.CORE_SERVER],
  },
  {
    operationId: 'createSession',
    method: 'post',
    path: `${API_BASE_PATH}/session`,
    tag: CoreApiTag.SESSION,
    mode: CoreApiMode.SIMULATED,
    summary: 'Create session',
    description: [...CREATE_SESSION_TEXT, SIM_NOTE].join('\n\n'),
    coreServerDescription: [...CREATE_SESSION_TEXT, SESSION_START_REFUSAL, CORE_SERVER_SESSION_TEXTS, CORE_SERVER_ANSWERS].join('\n\n'),
    source: 'Design book §21.2',
    requestBody: { schema: 'SessionCreateRequest', required: true },
    responses: {
      200: { description: 'The same input was already created: the open session is returned.', schema: 'SessionCommandResponse' },
      201: { description: 'Session created (state CREATE).', schema: 'SessionCommandResponse' },
      400: INVALID_JSON,
      401: { description: 'No operator is signed in (NOT_SIGNED_IN).', schema: 'ApiError' },
      403: { description: 'The operator lacks SESSION_START (NOT_PERMITTED).', schema: 'ApiError' },
      409: { description: 'Another session is open (SESSION_ACTIVE).', schema: 'ApiError' },
      422: { description: 'The input is incomplete or invalid (INVALID_INPUT).', schema: 'ApiError' },
    },
    rbac: {
      permission: Permission.SESSION_START,
      roles: [OperatorRole.INVESTIGATOR, OperatorRole.SUPERVISOR],
      audit: ['SESSION_CREATED'],
    },
    access: SESSION_START_ACCESS,
    audit: { success: AuditType.SESSION_CREATED, denial: AuditType.ACCESS_DENIED },
    services: CORE_SERVER_ONLY,
  },
  {
    operationId: 'startSession',
    method: 'post',
    path: `${API_BASE_PATH}/session/{id}/start`,
    tag: CoreApiTag.SESSION,
    mode: CoreApiMode.SIMULATED,
    summary: 'Start recording',
    description: [...START_SESSION_TEXT, SIM_NOTE].join('\n\n'),
    coreServerDescription: [
      ...START_SESSION_TEXT,
      SESSION_START_REFUSAL,
      'In a real capture operation a start is refused `503 NOT_READY` with `details.reason: CAPTURE_HELPERS_LEFT` while helper processes of an earlier capture are still running (envelope level; nothing is opened twice).',
      'A body that does not match its schema answers `422 INVALID_INPUT`. The pre-check and its outcome also have operations of their own: `beginPrecheck`, `retryPrecheck` and `acknowledgePrecheckWarnings`.',
      CORE_SERVER_SESSION_TEXTS,
      CORE_SERVER_ANSWERS,
    ].join('\n\n'),
    source: 'Design book §21.2',
    pathParam: { name: 'id', description: 'Session ID of the open session.', pattern: SESSION_ID_PATTERN },
    requestBody: { schema: 'SessionStartRequest', required: false },
    responses: {
      200: { description: 'Recording started (state RECORDING).', schema: 'SessionCommandResponse' },
      202: { description: 'Pre-check started (state PRECHECK).', schema: 'SessionCommandResponse' },
      400: INVALID_JSON,
      401: { description: 'No operator is signed in (NOT_SIGNED_IN).', schema: 'ApiError' },
      403: { description: 'The operator lacks SESSION_START (NOT_PERMITTED).', schema: 'ApiError' },
      404: { description: 'This ID is not the open session (NOT_FOUND).', schema: 'ApiError' },
      409: {
        description: 'Not startable now (PRECHECK_RUNNING, PRECHECK_WARNINGS, PRECHECK_BLOCKED, INVALID_STATE).',
        schema: 'ApiError',
      },
      // Only the Core server validates the optional body with its schema; the simulator ignores a wrong member.
      422: { ...INVALID_INPUT, services: CORE_SERVER_ONLY },
    },
    rbac: {
      permission: Permission.SESSION_START,
      roles: [OperatorRole.INVESTIGATOR, OperatorRole.SUPERVISOR],
      audit: ['PRECHECK_PASSED', 'RECORDING_STARTED'],
    },
    access: SESSION_START_ACCESS,
    // The one operation with more than one possible audit type, by the existing contract (01_specs §7.8).
    audit: { success: AuditType.RECORDING_STARTED, denial: AuditType.ACCESS_DENIED, also: [AuditType.PRECHECK_PASSED] },
    services: CORE_SERVER_ONLY,
  },
  {
    operationId: 'stopSession',
    method: 'post',
    path: `${API_BASE_PATH}/session/{id}/stop`,
    tag: CoreApiTag.SESSION,
    mode: CoreApiMode.SIMULATED,
    summary: 'Stop recording',
    description: [...STOP_SESSION_TEXT, SIM_NOTE].join('\n\n'),
    coreServerDescription: [
      ...STOP_SESSION_TEXT,
      SESSION_START_REFUSAL,
      'A stop while the recording is still connecting its cameras (`captureDurable: false`: nothing durable is written yet) is refused `409 INVALID_STATE` with `details.reason: CAPTURE_NOT_DURABLE`; nothing is changed.',
      'The operator who stops a recording need not be the one who started it. A reason that is absent, or shorter than 5 characters after trimming, answers `422 INVALID_REASON` after the `404` and the `409`; a reason that is not text, holds U+0000 or an unpaired surrogate, or is longer than its maximum, and a malformed `{id}`, answer `422 INVALID_INPUT`.',
      CORE_SERVER_SESSION_TEXTS,
      CORE_SERVER_ANSWERS,
    ].join('\n\n'),
    source: 'Design book §21.2',
    pathParam: { name: 'id', description: 'Session ID of the recording session.', pattern: SESSION_ID_PATTERN },
    requestBody: { schema: 'SessionStopRequest', required: true },
    responses: {
      202: { description: 'Stop accepted (state STOPPING); finalization follows.', schema: 'SessionCommandResponse' },
      400: INVALID_JSON,
      401: { description: 'No operator is signed in (NOT_SIGNED_IN).', schema: 'ApiError' },
      403: { description: 'The operator lacks SESSION_START (NOT_PERMITTED).', schema: 'ApiError' },
      404: { description: 'This ID is not the open session (NOT_FOUND).', schema: 'ApiError' },
      409: { description: 'The session is not RECORDING (INVALID_STATE).', schema: 'ApiError' },
      422: {
        description: 'The reason is shorter than 5 characters (INVALID_REASON).',
        coreServerDescription:
          'The reason is absent or shorter than 5 characters after trimming (INVALID_REASON), decided after the 404 and the 409; or the body or the path does not match its schema (INVALID_INPUT, Core server only): a reason that is not text, holds U+0000 or an unpaired surrogate, or is longer than its maximum, or a malformed `{id}`.',
        schema: 'ApiError',
      },
    },
    rbac: {
      permission: Permission.SESSION_START,
      roles: [OperatorRole.INVESTIGATOR, OperatorRole.SUPERVISOR],
      audit: ['RECORDING_STOPPED'],
    },
    access: SESSION_START_ACCESS,
    audit: { success: AuditType.RECORDING_STOPPED, denial: AuditType.ACCESS_DENIED },
    services: CORE_SERVER_ONLY,
  },
  {
    operationId: 'getCurrentSession',
    method: 'get',
    path: `${API_BASE_PATH}/session/current`,
    tag: CoreApiTag.SESSION,
    mode: CoreApiMode.SIMULATED,
    summary: 'Current session',
    description: [...CURRENT_SESSION_TEXT, SIM_NOTE].join('\n\n'),
    coreServerDescription: [...CURRENT_SESSION_TEXT, READ_FOR_EVERY_ROLE, CORE_SERVER_ANSWERS].join('\n\n'),
    source: 'Design book §21.2',
    responses: {
      200: { description: 'The current session state.', schema: 'CurrentSessionResponse' },
      ...CORE_SERVER_READ_REFUSALS,
    },
    access: AUTHENTICATED_ACCESS,
    audit: READ_AUDIT,
    services: CORE_SERVER_ONLY,
  },
  {
    operationId: 'getDeviceHealth',
    method: 'get',
    path: `${API_BASE_PATH}/device/health`,
    tag: CoreApiTag.DEVICE,
    mode: CoreApiMode.SIMULATED,
    summary: 'Device health snapshot',
    description: [...DEVICE_HEALTH_TEXT, SIM_NOTE].join('\n\n'),
    coreServerDescription: [...DEVICE_HEALTH_TEXT, READ_FOR_EVERY_ROLE, CORE_SERVER_ANSWERS].join('\n\n'),
    source: 'Design book §21.2',
    responses: {
      200: { description: 'The health snapshot.', schema: 'DeviceHealthResponse' },
      ...CORE_SERVER_READ_REFUSALS,
    },
    access: AUTHENTICATED_ACCESS,
    audit: READ_AUDIT,
    services: CORE_SERVER_ONLY,
  },
  {
    operationId: 'getAudioStatus',
    method: 'get',
    path: `${API_BASE_PATH}/audio/status`,
    tag: CoreApiTag.DEVICE,
    mode: CoreApiMode.SIMULATED,
    summary: 'Audio status',
    description: [...AUDIO_STATUS_TEXT, SIM_NOTE].join('\n\n'),
    coreServerDescription: [...AUDIO_STATUS_TEXT, READ_FOR_EVERY_ROLE, CORE_SERVER_ANSWERS].join('\n\n'),
    source: 'Design book §21.2',
    responses: {
      200: { description: 'The four audio channels (D61).', schema: 'AudioStatusResponse' },
      ...CORE_SERVER_READ_REFUSALS,
    },
    access: AUTHENTICATED_ACCESS,
    audit: READ_AUDIT,
    services: CORE_SERVER_ONLY,
  },
  {
    operationId: 'getVideoStatus',
    method: 'get',
    path: `${API_BASE_PATH}/video/status`,
    tag: CoreApiTag.DEVICE,
    mode: CoreApiMode.SIMULATED,
    summary: 'Video status',
    description: [...VIDEO_STATUS_TEXT, SIM_NOTE].join('\n\n'),
    coreServerDescription: [...VIDEO_STATUS_TEXT, READ_FOR_EVERY_ROLE, CORE_SERVER_ANSWERS].join('\n\n'),
    source: 'Design book §21.2',
    responses: {
      200: { description: 'All four video tracks.', schema: 'VideoStatusResponse' },
      ...CORE_SERVER_READ_REFUSALS,
    },
    access: AUTHENTICATED_ACCESS,
    audit: READ_AUDIT,
    services: CORE_SERVER_ONLY,
  },
  {
    operationId: 'getStorageStatus',
    method: 'get',
    path: `${API_BASE_PATH}/storage/status`,
    tag: CoreApiTag.STORAGE,
    mode: CoreApiMode.SIMULATED,
    summary: 'Storage status',
    description: [...STORAGE_STATUS_TEXT, SIM_NOTE].join('\n\n'),
    coreServerDescription: [...STORAGE_STATUS_TEXT, READ_FOR_EVERY_ROLE, CORE_SERVER_ANSWERS].join('\n\n'),
    source: 'Design book §21.2',
    responses: {
      200: { description: 'Storage capacity and state.', schema: 'StorageStatusResponse' },
      ...CORE_SERVER_READ_REFUSALS,
    },
    access: AUTHENTICATED_ACCESS,
    audit: READ_AUDIT,
    services: CORE_SERVER_ONLY,
  },
  {
    operationId: 'exportEvidence',
    method: 'post',
    path: `${API_BASE_PATH}/evidence/{id}/export`,
    tag: CoreApiTag.EVIDENCE,
    mode: CoreApiMode.SIMULATED,
    summary: 'Authorized export',
    description: [
      '**RBAC + audit required** (book §19.3, §21.2). The simulator applies the role of the operator signed in to this console; the design book defines no authentication endpoint, so no token travels on the wire.',
      EXPORT_OUTCOMES,
      EXPORT_SEALED_ONLY,
      SIM_NOTE,
    ].join('\n\n'),
    coreServerDescription: [
      '**RBAC + audit required** (book §19.3, §21.2). The Core server applies the role of the operator whose session the request carries, before the body is read.',
      EXPORT_OUTCOMES,
      EXPORT_SEALED_ONLY,
      `The answer holds no file: the server records the export, and a client keeps its bundled export archive (01_specs §11). The reason is mandatory. A reason longer than ${EXPORT_REASON_MAX_LENGTH} UTF-16 code units, a destination longer than ${EXPORT_DESTINATION_MAX_LENGTH}, and any other body that does not match its schema, answers \`422 INVALID_INPUT\`; the server does not cut a text.`,
      EXPORT_DENIAL_NOTE,
      'REAL evidence is case-scoped (SEC35-16; review finding R93-02): a caller with EVIDENCE_EXPORT who neither holds the case nor is a SUPERVISOR is refused `403 NOT_PERMITTED` with `details.reason: EVIDENCE_CASE_SCOPE`, with one ACCESS_DENIED row.',
      CORE_SERVER_ANSWERS,
    ].join('\n\n'),
    source: 'Design book §21.2, §19.2, §19.3',
    pathParam: { name: 'id', description: 'Evidence ID `EV-{YYYYMMDD}-NNNN`.', pattern: EVIDENCE_ID_PATTERN },
    requestBody: { schema: 'EvidenceExportRequest', required: true },
    responses: {
      202: { description: 'Export accepted and audited.', schema: 'EvidenceExportAccepted' },
      400: INVALID_JSON,
      401: { description: 'No operator is signed in (NOT_SIGNED_IN).', schema: 'ApiError' },
      403: {
        description: 'The role lacks EVIDENCE_EXPORT (FORBIDDEN); an EXPORT_DENIED audit row is written.',
        schema: 'ApiError',
      },
      404: { description: 'Unknown evidence ID (NOT_FOUND).', schema: 'ApiError' },
      409: {
        description:
          'The evidence is not sealed, or security is in FAULT (NOT_SEALED, SECURITY_FAULT). Core server, schema v2: an export job of this item is still QUEUED or RUNNING (EXPORT_IN_PROGRESS) - nothing is recorded and no audit row is written; poll operation 87 and ask again when it is COMPLETE or FAILED. Fix wave J: `kind: COMPOSITE` on a Core that cannot produce one (COMMAND_UNSUPPORTED, `details.reason: COMPOSITE_ENCODER_NOT_SELECTED`) - decided after the 404 and before anything is recorded: no export id, no job, no row. Operation 40 states the available kinds (`exportKinds`).',
        schema: 'ApiError',
      },
      422: {
        description: 'The reason is shorter than 5 characters (INVALID_REASON).',
        coreServerDescription:
          'The reason is missing or shorter than 5 characters (INVALID_REASON), decided after the 404 and the 409; or the body does not match its schema (INVALID_INPUT, Core server only): a reason that is not text or is longer than 500 UTF-16 code units, a destination longer than 120, U+0000 or an unpaired surrogate.',
        schema: 'ApiError',
      },
    },
    rbac: {
      permission: Permission.EVIDENCE_EXPORT,
      roles: [OperatorRole.SUPERVISOR],
      audit: ['EVIDENCE_EXPORTED', 'EXPORT_DENIED'],
    },
    access: permissionAccess(Permission.EVIDENCE_EXPORT),
    // RB-5: the export operations keep today's denial type.
    audit: { success: AuditType.EVIDENCE_EXPORTED, denial: AuditType.EXPORT_DENIED },
    services: CORE_SERVER_ONLY,
  },
  // Backend task (01_specs §7.5 to §7.16): answered by the Core server only, by area. Areas 1 to 3,
  // then the 38 of areas 4 to 11 that are not among the ten above, then area 13.
  ...IDENTITY_OPERATIONS,
  ...ADMINISTRATION_OPERATIONS,
  ...PAIRING_OPERATIONS,
  ...SESSION_OPERATIONS,
  ...EVIDENCE_OPERATIONS,
  ...DEVICE_OPERATIONS,
  ...STORAGE_OPERATIONS,
  ...NETWORK_TIME_OPERATIONS,
  ...SECURITY_AUDIT_OPERATIONS,
  ...SYSTEM_OPERATIONS,
  ...ALERT_OPERATIONS,
  ...DEMO_OPERATIONS,
  // Task 3 M2-W7 (blueprint row 48; C3 §2.2): operations 76-89, appended in number order so the
  // table order and the contract numbering agree. 75 + 14 = 89 operations, 34 GET / 55 POST.
  ...CAPTURE_CONFIG_OPERATIONS, // 76-80
  ...AUDIO_SOURCE_OPERATIONS, // 81-83
  ...TRANSCRIPT_MEDIA_OPERATIONS, // 84-88
  CAPTURE_CREDENTIAL_OPERATION, // 89
  // Task 3 M6 (blueprint row 113; C3 §2.5; R-8): Q-STT-CFG was confirmed at the second gate (D24),
  // so operations 90-92 join the table: 89 + 3 = 92 operations, 35 GET / 57 POST (CF-11).
  ...STT_CONFIG_OPERATIONS, // 90-92
  // Task 3 R-9..R-11 (blueprint row 132, decision D106; C3 §2.6, §10.1): camera search, connection
  // test, adoption and the local-input re-read. 92 + 5 = 97 operations, 36 GET / 61 POST.
  ...CAPTURE_DISCOVERY_OPERATIONS, // 93-97
  // Task 4 (blueprint row 63, WP-07b; design addendum 4.2): the listing of the sound cards and the
  // registration of one input. 97 + 2 = 99 operations, 36 GET / 63 POST.
  ...CAPTURE_AUDIO_CARD_OPERATIONS, // 98-99
  // Task 4 (blueprint row 194, WP-12; finding of rows 97 and 98): the operator-confirmed re-address
  // of a registered camera. 99 + 1 = 100 operations, 36 GET / 64 POST.
  ...CAPTURE_READDRESS_OPERATIONS, // 100
  // Task 4 (blueprint row 102, WP-23b): the commissioning functions of the camera network - the
  // configuration read and write, the scan, the alias state and its removal, the set-network job and
  // its state. 100 + 7 = 107 operations, 39 GET / 68 POST.
  ...CAPTURE_COMMISSIONING_OPERATIONS, // 101-107
  // Task 4 (row V3, the third contract step; blueprint row 146; decisions C58, C62): the connection
  // test of a registered camera with its stored credential. 107 + 1 = 108 operations, 39 GET / 69 POST.
  ...CAPTURE_DEVICE_TEST_OPERATIONS, // 108
  // Task 4 (blueprint row 116, WP-26b; schema set C; decisions U11, C2): the acceptance of the
  // installation and its revocation. 108 + 2 = 110 operations, 39 GET / 71 POST.
  ...INSTALLATION_ACCEPTANCE_OPERATIONS, // 109-110
  // Task 4 (row RD2; design 07; decisions C146, C147): the retirement of a registered camera or
  // microphone. 110 + 1 = 111 operations, 39 GET / 72 POST.
  ...CAPTURE_RETIRE_OPERATIONS, // 111
  // Task 4 bare-metal bench (decisions D51, D53): the live camera preview session and the lease of
  // the idle microphone meters, both LIVE only. 111 + 2 = 113 operations, 39 GET / 74 POST.
  ...CAPTURE_PREVIEW_OPERATIONS, // 112-113
  // LCD bridge task: the firmware word the panel states about itself, answered by the Core server
  // only and PUBLIC so the sign-in screen can read it. 113 + 1 = 114 operations, 40 GET / 74 POST.
  ...PANEL_FIRMWARE_OPERATIONS, // 114
  ...PANEL_SETUP_OPERATIONS, // 115 getPanelSetup, 116 setPanelSetup (D57)
] as const satisfies readonly CoreApiRegistryOperation[];

/** The type of the table with literal operation IDs and schema names (`CORE_API_OPERATION_TABLE`). */
export type CoreApiOperationTable = typeof OPERATION_TABLE;

/** The table as a plain list: operation IDs are `string`. The typed view is `CORE_API_OPERATION_TABLE`. */
export const CORE_API_OPERATIONS: readonly CoreApiRegistryOperation[] = OPERATION_TABLE;

/**
 * `offline`: the operations a client can call without the Core server, which are the ones the
 * in-app simulator answers and the ones mock-core serves. `all`: every operation.
 */
export const CoreApiScope = { OFFLINE: 'offline', ALL: 'all' } as const;
export type CoreApiScope = (typeof CoreApiScope)[keyof typeof CoreApiScope];

export function isOfflineCoreApiOperation(operation: CoreApiRegistryOperation): boolean {
  return operation.mode === CoreApiMode.SIMULATED || operation.services.includes(CoreApiService.MOCK_CORE);
}

/** The operations of a scope, in table order. */
export function listCoreApiOperations(scope: CoreApiScope = CoreApiScope.ALL): readonly CoreApiRegistryOperation[] {
  return scope === CoreApiScope.ALL ? CORE_API_OPERATIONS : CORE_API_OPERATIONS.filter(isOfflineCoreApiOperation);
}

/**
 * True for an answer that every answerer of the operation gives, the in-app simulator and
 * mock-core included. False for a status that names its services: only those send it (the `401`
 * and the `403` of the five simulated reads, the `422` of `startSession`, which only the Core
 * server sends).
 */
export function isOfflineCoreApiResponse(spec: CoreApiResponseSpec): boolean {
  return spec.services === undefined;
}

/**
 * The documented statuses of an operation in a scope, ascending. `all`: every status. `offline`:
 * the statuses a client can get without the Core server, which is what the in-app simulator and
 * mock-core produce (01_specs §7.19).
 */
export function listCoreApiResponseStatuses(
  operation: Pick<CoreApiRegistryOperation, 'responses'>,
  scope: CoreApiScope = CoreApiScope.ALL,
): number[] {
  return Object.keys(operation.responses)
    .map(Number)
    .filter((status) => {
      const spec = operation.responses[status];
      return spec !== undefined && (scope === CoreApiScope.ALL || isOfflineCoreApiResponse(spec));
    })
    .sort((a, b) => a - b);
}

// ═══════════════════════════════════════════════════════════════════════════════════════
// Answers defined once for every operation (backend task 01_specs §7.2, §7.3)
// ═══════════════════════════════════════════════════════════════════════════════════════

/**
 * `routing`: decided before an operation is matched, so the answer belongs to no operation.
 * `pipeline`: decided for a matched operation by a stage that treats every operation alike.
 */
export const CoreApiEnvelopeStage = { ROUTING: 'routing', PIPELINE: 'pipeline' } as const;
export type CoreApiEnvelopeStage = (typeof CoreApiEnvelopeStage)[keyof typeof CoreApiEnvelopeStage];

export interface CoreApiEnvelopeResponse {
  status: number;
  /** The codes the answer may carry. */
  codes: readonly ApiErrorCode[];
  stage: CoreApiEnvelopeStage;
  description: string;
  /** `details.reason` the answer must carry. */
  reason?: string;
  /** A response header that belongs to the answer. */
  header?: string;
}

/**
 * The answers no operation repeats in its `responses`, in the order of precedence of 01_specs
 * §7.3. The first seven statuses are the ones §7.2 defines "once at envelope level". The two
 * refusals of stages 3 and 4 (the Origin guard, two credentials in one request) are listed with
 * them: both are decided before any access rule, for every operation alike, the health operation
 * included. An operation that documents 401 or 403 itself still names them there.
 */
export const CORE_API_ENVELOPE_RESPONSES = [
  {
    status: 400,
    codes: [ApiErrorCode.INVALID_PATH],
    stage: CoreApiEnvelopeStage.ROUTING,
    description: 'The path is malformed, or a path parameter is not valid percent-encoding.',
  },
  {
    status: 404,
    codes: [ApiErrorCode.NOT_FOUND],
    stage: CoreApiEnvelopeStage.ROUTING,
    description: 'No operation has this path.',
  },
  {
    status: 405,
    codes: [ApiErrorCode.METHOD_NOT_ALLOWED],
    stage: CoreApiEnvelopeStage.ROUTING,
    description: 'The path exists, but not with this method.',
    header: ALLOW_HEADER_NAME,
  },
  {
    status: 503,
    codes: [ApiErrorCode.NOT_READY],
    stage: CoreApiEnvelopeStage.PIPELINE,
    description: 'The database or the engine is not ready, or a demo reset is running. Every operation except health.',
  },
  {
    status: 403,
    codes: [ApiErrorCode.ORIGIN_NOT_ALLOWED],
    stage: CoreApiEnvelopeStage.PIPELINE,
    description: 'The `Origin` header is not on the list that fits the credential the request carries (01_specs §14.2).',
  },
  {
    status: 401,
    codes: [ApiErrorCode.NOT_SIGNED_IN],
    stage: CoreApiEnvelopeStage.PIPELINE,
    description: 'The request carries a session cookie and an `Authorization` header: one credential per request (ID-12).',
    reason: CREDENTIAL_CONFLICT_REASON,
  },
  {
    status: 429,
    codes: [ApiErrorCode.RATE_LIMITED],
    stage: CoreApiEnvelopeStage.PIPELINE,
    description: 'The request throttle, or the denial budget of the caller\'s key (20 audited refusals in 60 s), is used up.',
    header: RETRY_AFTER_HEADER_NAME,
  },
  {
    status: 413,
    codes: [ApiErrorCode.PAYLOAD_TOO_LARGE],
    stage: CoreApiEnvelopeStage.PIPELINE,
    description: 'The request body is larger than 65,536 bytes.',
  },
  // W83 (gap W36-1, gap W40-1): the body parser runs before every handler, so a POST
  // whose operation takes no body still refuses a body that is no JSON object. An operation that takes
  // a body documents its own 400; this entry covers the others. It follows the routing 400 in this
  // list, so a lookup by status alone (`validateCoreApiEnvelopeResponse`) still finds INVALID_PATH.
  {
    status: 400,
    codes: [ApiErrorCode.INVALID_JSON],
    stage: CoreApiEnvelopeStage.PIPELINE,
    description: 'A body was sent that is not a JSON object. Every POST, also one that takes no body; an empty body is no body.',
  },
  {
    status: 500,
    codes: [ApiErrorCode.INTERNAL_ERROR, ApiErrorCode.SIMULATOR_ERROR],
    stage: CoreApiEnvelopeStage.PIPELINE,
    description: 'An unexpected failure; the answer holds no detail. SIMULATOR_ERROR is the in-app simulator\'s code.',
  },
] as const satisfies readonly CoreApiEnvelopeResponse[];

// ═══════════════════════════════════════════════════════════════════════════════════════
// Helpers for the simulated handlers, simAwareFetch and tests
// ═══════════════════════════════════════════════════════════════════════════════════════

export function findCoreApiOperation(operationId: string): CoreApiRegistryOperation | undefined {
  return CORE_API_OPERATIONS.find((operation) => operation.operationId === operationId);
}

export interface CoreApiMatch {
  operation: CoreApiRegistryOperation;
  /** Decoded path parameters (`{ id }` when the template has one). */
  params: Readonly<Record<string, string>>;
}

const ROUTES = CORE_API_OPERATIONS.map((operation) => {
  const names: string[] = [];
  const source = operation.path
    .split('/')
    .map((segment) => {
      const param = /^\{(\w+)\}$/.exec(segment);
      if (!param?.[1]) return segment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      names.push(param[1]);
      return '([^/]+)';
    })
    .join('/');
  return { operation, names, regex: new RegExp(`^${source}$`) };
});

/**
 * Matches a method and a URL path (no origin, no query) to an operation. The routes never
 * overlap: a templated route and a literal route of the same method differ in their number of
 * segments or in a literal segment, so `GET /api/v1/session/current` cannot match
 * `POST /api/v1/session/{id}/start` (test/api-registry.test.ts checks every pair). Returns null
 * for an unknown route, a method the route does not accept, or a parameter that is not valid
 * percent-encoding.
 */
export function matchCoreApiOperation(method: string, pathname: string): CoreApiMatch | null {
  const verb = method.toLowerCase();
  for (const route of ROUTES) {
    if (route.operation.method !== verb) continue;
    const found = route.regex.exec(pathname);
    if (!found) continue;
    const params: Record<string, string> = {};
    for (let index = 0; index < route.names.length; index += 1) {
      const raw = found[index + 1] ?? '';
      let value: string;
      try {
        value = decodeURIComponent(raw);
      } catch {
        return null;
      }
      params[route.names[index] ?? `p${index}`] = value;
    }
    return { operation: route.operation, params };
  }
  return null;
}

export type CoreApiValidation =
  | { ok: true }
  | { ok: false; reason: 'UNKNOWN_OPERATION' | 'UNDOCUMENTED_STATUS' | 'UNEXPECTED_BODY' | 'INVALID_BODY'; issues: string[] };

function invalidBody(error: z.ZodError): CoreApiValidation {
  return {
    ok: false,
    reason: 'INVALID_BODY',
    issues: error.issues.map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`),
  };
}

function checkEnvelopeResponse(entry: CoreApiEnvelopeResponse, body: unknown): CoreApiValidation {
  const parsed = ApiErrorSchema.safeParse(body);
  if (!parsed.success) return invalidBody(parsed.error);
  const { code, details } = parsed.data.error;
  if (!(entry.codes as readonly string[]).includes(code)) {
    return { ok: false, reason: 'INVALID_BODY', issues: [`error.code: ${code} is not an envelope-level answer of ${entry.status}`] };
  }
  if (entry.reason !== undefined && details?.reason !== entry.reason) {
    return { ok: false, reason: 'INVALID_BODY', issues: [`error.details.reason: expected ${entry.reason}`] };
  }
  return { ok: true };
}

/**
 * Checks an answer that belongs to no operation, or to every one: a routing refusal (400
 * `INVALID_PATH`, 404, 405) or a pipeline refusal (`CORE_API_ENVELOPE_RESPONSES`).
 */
export function validateCoreApiEnvelopeResponse(status: number, body: unknown): CoreApiValidation {
  const entry = CORE_API_ENVELOPE_RESPONSES.find((candidate) => candidate.status === status);
  if (!entry) return { ok: false, reason: 'UNDOCUMENTED_STATUS', issues: [String(status)] };
  return checkEnvelopeResponse(entry, body);
}

/**
 * Checks a response against the contract: the status must be documented for the operation and
 * the body must parse with that status's schema. A status the operation does not document is
 * accepted when it is a pipeline answer of `CORE_API_ENVELOPE_RESPONSES` with one of its codes.
 * For the sim handlers' tests, the typed fake transport and the server's conformance test.
 *
 * Every documented status counts, whoever sends it: a status that only the Core server sends
 * (`responses[status].services`) is valid for the operation. That the simulator never sends one
 * is what test/openapi.test.ts checks.
 */
export function validateCoreApiResponse(operationId: string, status: number, body: unknown): CoreApiValidation {
  const operation = findCoreApiOperation(operationId);
  if (!operation) return { ok: false, reason: 'UNKNOWN_OPERATION', issues: [operationId] };
  const spec = operation.responses[status];
  if (!spec) {
    const entry = CORE_API_ENVELOPE_RESPONSES.find(
      (candidate) => candidate.status === status && candidate.stage === CoreApiEnvelopeStage.PIPELINE,
    );
    if (!entry) return { ok: false, reason: 'UNDOCUMENTED_STATUS', issues: [String(status)] };
    return checkEnvelopeResponse(entry, body);
  }
  if (!spec.schema) {
    return body === undefined || body === null ? { ok: true } : { ok: false, reason: 'UNEXPECTED_BODY', issues: [] };
  }
  const parsed = CORE_API_SCHEMAS[spec.schema].safeParse(body);
  return parsed.success ? { ok: true } : invalidBody(parsed.error);
}
