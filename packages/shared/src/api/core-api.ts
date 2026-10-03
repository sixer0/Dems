/**
 * Core API v1 contract: the 10 REST operations the demo documents and the zod schemas of their
 * bodies (masterplan/01_specs.md §14.9; book §21.2; D26, D31).
 *
 * | Mode      | Operations | Answered by |
 * |-----------|------------|-------------|
 * | LIVE      | `GET /api/v1/health` | mock-core on 127.0.0.1:4400 (apps/mock-core/src/app.ts) |
 * | SIMULATED | the 9 §21.2 endpoints | the in-browser simulator: `Sim.request` → `sim/api.ts` `handleSimApiRequest`, header `x-dems-simulated: 1` |
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
 */
import { z } from 'zod';
import {
  LensState,
  MicState,
  SecurityState,
  SessionState,
  StorageState,
  TimeSource,
  TrackId,
  TrackRecState,
} from '../domain/enums';
import { EXPORT_REASON_MIN_LENGTH, STOP_REASON_MIN_LENGTH } from '../sim/constants';
import {
  FaultKind,
  OperatorRole,
  Permission,
  PrecheckCheckId,
  PrecheckStatus,
  RecordingProfileId,
  RetentionPolicyId,
  SecurityPosture,
  ServiceStatus,
  Severity,
  SubjectType,
  SystemState,
} from '../sim/vocabulary';
import { API_BASE_PATH, HEALTH_PATH } from './constants';
import { HealthResponseSchema } from './health';
import { HeartbeatSchema } from './realtime-messages';
import {
  API_ERROR_CODE_PATTERN,
  EVIDENCE_ID_PATTERN,
  EXPORT_ID_PATTERN,
  OPERATOR_ID_PATTERN,
  SESSION_ID_PATTERN,
} from './patterns';
import { sessionCreateSchema } from './session-schema';

// ═══════════════════════════════════════════════════════════════════════════════════════
// Building blocks
// ═══════════════════════════════════════════════════════════════════════════════════════

/** An export destination longer than this is truncated by the simulator. */
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

export const ApiErrorSchema = z
  .object({
    error: z.object({
      code: z
        .string()
        .regex(API_ERROR_CODE_PATTERN)
        .describe(
          'Machine-readable code: INVALID_JSON, NOT_SIGNED_IN, NOT_PERMITTED, FORBIDDEN, NOT_FOUND, METHOD_NOT_ALLOWED, SESSION_ACTIVE, INVALID_INPUT, INVALID_STATE, PRECHECK_RUNNING, PRECHECK_WARNINGS, PRECHECK_BLOCKED, INVALID_REASON, NOT_SEALED, SECURITY_FAULT, SIMULATOR_ERROR.',
        ),
      message: z.string().min(1).describe('Operator-safe English text. Never contains credentials.'),
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
    reason: z
      .string()
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
  .describe('One of the 8 book §5.3 pre-recording checks.');
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
        items: z.array(PrecheckItemSchema).length(8),
      })
      .nullable()
      .describe('Null before the pre-check starts.'),
    fault: z
      .object({ kind: z.enum(FaultKind), at: isoTime(), fromState: z.enum(SessionState) })
      .nullable()
      .describe('The critical fault that moved the session to FAULT, if any.'),
  })
  .describe('The open session.');
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
    trackId: z.enum([TrackId.VIDEO_01, TrackId.VIDEO_02]),
    deviceId: z.string().min(1).describe('e.g. CAM-01.'),
    name: z.string().min(1),
    lens: z.enum(LensState),
    online: z.boolean(),
    recState: z.enum(TrackRecState).nullable().describe('Null when not recording.'),
    resolution: z.literal('1080p'),
    fps: z.literal(25),
    codec: z.literal('H.264'),
    bitrateMbps: z.number().nonnegative(),
  })
  .describe('One video track (VIDEO-01 or VIDEO-02).');
export type VideoTrackStatus = z.output<typeof VideoTrackStatusSchema>;

export const AudioChannelStatusSchema = z
  .object({
    trackId: z.enum([TrackId.AUDIO_01, TrackId.AUDIO_02]),
    deviceId: z.string().min(1).describe('e.g. MIC-01.'),
    name: z.string().min(1).describe('e.g. "MIC 1 – Interviewer".'),
    state: z.enum(MicState),
    recState: z.enum(TrackRecState).nullable(),
    dbfs: dbfs().describe('Ballistic level in dBFS; -90 means no signal.'),
    peak: dbfs().describe('Peak hold in dBFS (1.5 s, then 20 dB/s decay).'),
    clip: z.boolean().describe('CLIP latch (EVT-07), kept until reset.'),
    noSignal: z.boolean(),
    gainDb: z.number().describe('Read-only in the UI (G13).'),
    phantom: z.boolean(),
  })
  .describe('One audio channel (AUDIO-01 = MIC 1, AUDIO-02 = MIC 2).');
export type AudioChannelStatus = z.output<typeof AudioChannelStatusSchema>;

export const VideoStatusResponseSchema = z
  .object({ tracks: z.array(VideoTrackStatusSchema).length(2) })
  .describe('Per-track video status (VIDEO-01, VIDEO-02).');
export type VideoStatusResponse = z.output<typeof VideoStatusResponseSchema>;

export const AudioStatusResponseSchema = z
  .object({
    channels: z.array(AudioChannelStatusSchema).length(2).describe('AUDIO-01 and AUDIO-02, never merged (SYS-003).'),
  })
  .describe('Per-channel audio snapshot. Meters use it as their initial value; live levels run at 20 Hz in-process.');
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
    device: z.object({
      id: z.string().min(1).describe('e.g. DEMS-IR-01.'),
      name: z.string().min(1),
      softwareVersion: z.string().min(1),
    }),
    systemState: z.enum(SystemState).describe('Overall state (the Dashboard ring).'),
    flags: z
      .array(z.object({ id: z.string().min(1), severity: z.enum(Severity), message: z.string().min(1) }))
      .describe('What makes the state ATTENTION or CRITICAL.'),
    cameras: z.array(VideoTrackStatusSchema).length(2),
    audio: z.array(AudioChannelStatusSchema).length(2),
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
    }),
    services: z
      .array(z.object({ id: z.string().min(1), name: z.string().min(1), status: z.enum(ServiceStatus) }))
      .describe('The 16 book §6.1 Core services.'),
    serverTime: isoTime(),
  })
  .describe('Device health snapshot: camera, audio, storage, time and security, plus services.');
export type DeviceHealthResponse = z.output<typeof DeviceHealthResponseSchema>;

// ═══════════════════════════════════════════════════════════════════════════════════════
// Evidence export (book §19.2, §19.3)
// ═══════════════════════════════════════════════════════════════════════════════════════

export const EvidenceExportRequestSchema = z
  .object({
    reason: z
      .string()
      .overwrite((value) => value.trim())
      .min(EXPORT_REASON_MIN_LENGTH)
      .describe(`Purpose of the export (book §19.2 item 8; at least ${EXPORT_REASON_MIN_LENGTH} characters after trimming).`),
    destination: z
      .string()
      .optional()
      .describe(
        `Destination or approved media identifier (book §19.2 item 6). Empty means "Case file transfer (simulated)"; text beyond ${EXPORT_DESTINATION_MAX_LENGTH} characters is cut.`,
      ),
  })
  .describe('Request body of `POST /api/v1/evidence/{id}/export`.');
export type EvidenceExportRequest = z.output<typeof EvidenceExportRequestSchema>;

export const EvidenceExportAcceptedSchema = z
  .object({
    exportId: z.string().regex(EXPORT_ID_PATTERN),
    evidenceId: evidenceId(),
    status: z.literal('EXPORTED'),
  })
  .describe(
    'Export accepted. The ExportEvent (book §19.2: operator, time, destination, reason) is the EVIDENCE_EXPORTED audit row it wrote.',
  );
export type EvidenceExportAccepted = z.output<typeof EvidenceExportAcceptedSchema>;

// ═══════════════════════════════════════════════════════════════════════════════════════
// Component registry (OpenAPI `components.schemas`)
// ═══════════════════════════════════════════════════════════════════════════════════════

/**
 * Every named schema of the contract, keyed by its `components.schemas` name. Nested named
 * schemas become `$ref`s. `Heartbeat` is the WS `/ws` message (OpenAPI cannot model the
 * socket; the Realtime tag describes it).
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
  ApiError: ApiErrorSchema,
  Heartbeat: HeartbeatSchema,
} as const;
export type CoreApiSchemaName = keyof typeof CORE_API_SCHEMAS;

// ═══════════════════════════════════════════════════════════════════════════════════════
// Operations
// ═══════════════════════════════════════════════════════════════════════════════════════

export const CoreApiTag = {
  SERVICE: 'Service',
  SESSION: 'Session',
  DEVICE: 'Device',
  STORAGE: 'Storage',
  EVIDENCE: 'Evidence',
  REALTIME: 'Realtime',
} as const;
export type CoreApiTag = (typeof CoreApiTag)[keyof typeof CoreApiTag];

/** LIVE: answered by mock-core over the network. SIMULATED: answered in the browser. */
export const CoreApiMode = { LIVE: 'live', SIMULATED: 'simulated' } as const;
export type CoreApiMode = (typeof CoreApiMode)[keyof typeof CoreApiMode];

export type CoreApiMethod = 'get' | 'post';

export interface CoreApiResponseSpec {
  description: string;
  /** Body schema; omitted for a response without a body. */
  schema?: CoreApiSchemaName;
}

export interface CoreApiRbac {
  permission: Permission;
  /** Roles holding the permission (demo RBAC, 12_sim_contract §4). */
  roles: readonly OperatorRole[];
  /** Audit row types the call writes (success and denial). */
  audit: readonly string[];
}

export interface CoreApiOperation {
  operationId: string;
  method: CoreApiMethod;
  /** OpenAPI path template, e.g. `/api/v1/session/{id}/start`. */
  path: string;
  tag: CoreApiTag;
  mode: CoreApiMode;
  summary: string;
  /** Markdown. */
  description: string;
  /** Where the endpoint comes from: the design book section or this demo's spec. */
  source: string;
  /** The `{id}` path parameter, when the path has one. */
  pathParam?: { name: 'id'; description: string; pattern: RegExp };
  requestBody?: { schema: CoreApiSchemaName; required: boolean };
  /** Keyed by HTTP status. */
  responses: Readonly<Record<number, CoreApiResponseSpec>>;
  rbac?: CoreApiRbac;
}

const SIM_NOTE =
  'Simulated: "Try it" is answered in the browser by the demo simulator (header `x-dems-simulated: 1`). Nothing leaves the machine.';

const INVALID_JSON: CoreApiResponseSpec = { description: 'The body is not a JSON object (INVALID_JSON).', schema: 'ApiError' };

export const CORE_API_OPERATIONS: readonly CoreApiOperation[] = [
  {
    operationId: 'getServiceHealth',
    method: 'get',
    path: HEALTH_PATH,
    tag: CoreApiTag.SERVICE,
    mode: CoreApiMode.LIVE,
    summary: 'Service liveness',
    description:
      'Liveness of the local mock-core service. **Live**: served by mock-core on 127.0.0.1:4400 (CORS allows the web dev origins). This is not the device health snapshot; that is `GET /api/v1/device/health`.',
    source: 'masterplan/01_specs.md §2.5, §3.2 (demo; not in the design book)',
    responses: {
      200: { description: 'The service is up.', schema: 'HealthResponse' },
    },
  },
  {
    operationId: 'createSession',
    method: 'post',
    path: `${API_BASE_PATH}/session`,
    tag: CoreApiTag.SESSION,
    mode: CoreApiMode.SIMULATED,
    summary: 'Create session',
    description: [
      'Creates a session and returns its Session ID; the session enters **CREATE** (book §6.2, §12.2 steps 1-2).',
      'Idempotent (S26): the same input while that session is still open returns it with `200` and `created: false`.',
      'Requires a signed-in operator holding SESSION_START; writes the SESSION_CREATED audit row.',
      SIM_NOTE,
    ].join('\n\n'),
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
  },
  {
    operationId: 'startSession',
    method: 'post',
    path: `${API_BASE_PATH}/session/{id}/start`,
    tag: CoreApiTag.SESSION,
    mode: CoreApiMode.SIMULATED,
    summary: 'Start recording',
    description: [
      'Runs the Core pre-check (book §5.3: 8 checks) and starts recording.',
      [
        '- From **CREATE**: begins the pre-check and answers `202` with state **PRECHECK**. Poll `GET /api/v1/session/current` and call again once it is **ARMED**.',
        '- From **ARMED**: starts recording and answers `200` with state **RECORDING**.',
        '- Pre-check ended with **WARN**: send `{"acknowledgeWarnings": true}` to acknowledge and start; without it the answer is `409 PRECHECK_WARNINGS`.',
        '- Pre-check with a **BLOCK** (Core offline, lens fault, storage full, security fault): `409 PRECHECK_BLOCKED` with the reasons.',
      ].join('\n'),
      'Requires a signed-in operator holding SESSION_START; the audit rows name that operator.',
      SIM_NOTE,
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
    },
    rbac: {
      permission: Permission.SESSION_START,
      roles: [OperatorRole.INVESTIGATOR, OperatorRole.SUPERVISOR],
      audit: ['PRECHECK_PASSED', 'RECORDING_STARTED'],
    },
  },
  {
    operationId: 'stopSession',
    method: 'post',
    path: `${API_BASE_PATH}/session/{id}/stop`,
    tag: CoreApiTag.SESSION,
    mode: CoreApiMode.SIMULATED,
    summary: 'Stop recording',
    description: [
      'Stops the recording with a mandatory reason and moves the session to finalization: **STOPPING** → **FINALIZING** (hashes, manifest, encryption, signature) → **SEALED** (book §6.2, §12.2 steps 5-10).',
      'Answers `202` at STOPPING; poll `GET /api/v1/session/current` for the seal.',
      'Requires a signed-in operator holding SESSION_START; the RECORDING_STOPPED row names that operator.',
      SIM_NOTE,
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
      422: { description: 'The reason is shorter than 5 characters (INVALID_REASON).', schema: 'ApiError' },
    },
    rbac: {
      permission: Permission.SESSION_START,
      roles: [OperatorRole.INVESTIGATOR, OperatorRole.SUPERVISOR],
      audit: ['RECORDING_STOPPED'],
    },
  },
  {
    operationId: 'getCurrentSession',
    method: 'get',
    path: `${API_BASE_PATH}/session/current`,
    tag: CoreApiTag.SESSION,
    mode: CoreApiMode.SIMULATED,
    summary: 'Current session',
    description: [
      'Returns the open session, or `null` when idle. The tablet calls it after a reconnect to resynchronise (book §5.5, §5.6).',
      SIM_NOTE,
    ].join('\n\n'),
    source: 'Design book §21.2',
    responses: {
      200: { description: 'The current session state.', schema: 'CurrentSessionResponse' },
    },
  },
  {
    operationId: 'getDeviceHealth',
    method: 'get',
    path: `${API_BASE_PATH}/device/health`,
    tag: CoreApiTag.DEVICE,
    mode: CoreApiMode.SIMULATED,
    summary: 'Device health snapshot',
    description: [
      'Health of camera, audio, storage, time and security (book §6.1, §21.2), used by the pre-check and diagnostics. Distinct from the service liveness `GET /api/v1/health`.',
      SIM_NOTE,
    ].join('\n\n'),
    source: 'Design book §21.2',
    responses: {
      200: { description: 'The health snapshot.', schema: 'DeviceHealthResponse' },
    },
  },
  {
    operationId: 'getAudioStatus',
    method: 'get',
    path: `${API_BASE_PATH}/audio/status`,
    tag: CoreApiTag.DEVICE,
    mode: CoreApiMode.SIMULATED,
    summary: 'Audio status',
    description: [
      'Per-channel levels and faults for AUDIO-01 (MIC 1) and AUDIO-02 (MIC 2), reported separately (book §21.2, SYS-003).',
      SIM_NOTE,
    ].join('\n\n'),
    source: 'Design book §21.2',
    responses: {
      200: { description: 'Both audio channels.', schema: 'AudioStatusResponse' },
    },
  },
  {
    operationId: 'getVideoStatus',
    method: 'get',
    path: `${API_BASE_PATH}/video/status`,
    tag: CoreApiTag.DEVICE,
    mode: CoreApiMode.SIMULATED,
    summary: 'Video status',
    description: ['Per-track status for VIDEO-01 and VIDEO-02 (book §21.2).', SIM_NOTE].join('\n\n'),
    source: 'Design book §21.2',
    responses: {
      200: { description: 'Both video tracks.', schema: 'VideoStatusResponse' },
    },
  },
  {
    operationId: 'getStorageStatus',
    method: 'get',
    path: `${API_BASE_PATH}/storage/status`,
    tag: CoreApiTag.STORAGE,
    mode: CoreApiMode.SIMULATED,
    summary: 'Storage status',
    description: [
      'Capacity and health of the evidence storage, including the LOW and FULL states (book §21.2).',
      SIM_NOTE,
    ].join('\n\n'),
    source: 'Design book §21.2',
    responses: {
      200: { description: 'Storage capacity and state.', schema: 'StorageStatusResponse' },
    },
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
      [
        '- SUPERVISOR (holds EVIDENCE_EXPORT): `202`, and an EVIDENCE_EXPORTED audit row (the ExportEvent).',
        '- INVESTIGATOR or TECHNICIAN: `403 FORBIDDEN`, and an EXPORT_DENIED audit row (EVT-26).',
      ].join('\n'),
      'Only SEALED, UNDER_REVIEW or EXPORTED evidence can be exported, and the sealed source is never modified (book §19.3 rule 1).',
      SIM_NOTE,
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
        description: 'The evidence is not sealed, or security is in FAULT (NOT_SEALED, SECURITY_FAULT).',
        schema: 'ApiError',
      },
      422: { description: 'The reason is shorter than 5 characters (INVALID_REASON).', schema: 'ApiError' },
    },
    rbac: {
      permission: Permission.EVIDENCE_EXPORT,
      roles: [OperatorRole.SUPERVISOR],
      audit: ['EVIDENCE_EXPORTED', 'EXPORT_DENIED'],
    },
  },
];

// ═══════════════════════════════════════════════════════════════════════════════════════
// Helpers for the simulated handlers, simAwareFetch and tests
// ═══════════════════════════════════════════════════════════════════════════════════════

export function findCoreApiOperation(operationId: string): CoreApiOperation | undefined {
  return CORE_API_OPERATIONS.find((operation) => operation.operationId === operationId);
}

export interface CoreApiMatch {
  operation: CoreApiOperation;
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
 * Matches a method and a URL path (no origin, no query) to an operation. The 10 routes never
 * overlap: the only templated ones are POSTs ending in `/start`, `/stop` or `/export`, so
 * `GET /api/v1/session/current` cannot match them. Returns null for an unknown route, a
 * method the route does not accept, or a parameter that is not valid percent-encoding.
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

/**
 * Checks a response against the contract: the status must be documented for the operation and
 * the body must parse with that status's schema. For the sim handlers' tests and step 40 (CP-1).
 */
export function validateCoreApiResponse(operationId: string, status: number, body: unknown): CoreApiValidation {
  const operation = findCoreApiOperation(operationId);
  if (!operation) return { ok: false, reason: 'UNKNOWN_OPERATION', issues: [operationId] };
  const spec = operation.responses[status];
  if (!spec) return { ok: false, reason: 'UNDOCUMENTED_STATUS', issues: [String(status)] };
  if (!spec.schema) {
    return body === undefined || body === null ? { ok: true } : { ok: false, reason: 'UNEXPECTED_BODY', issues: [] };
  }
  const parsed = CORE_API_SCHEMAS[spec.schema].safeParse(body);
  if (parsed.success) return { ok: true };
  return {
    ok: false,
    reason: 'INVALID_BODY',
    issues: parsed.error.issues.map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`),
  };
}
