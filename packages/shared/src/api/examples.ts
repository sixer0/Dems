/**
 * Example payloads of the Core API contract (OpenAPI `examples`; masterplan/01_specs.md §14.9).
 *
 * Frozen at one instant, 2026-10-01 10:00:00 WIB (`OPENAPI_EXAMPLE_INSTANT`), so the generated
 * openapi.json is byte-stable. Simulated bodies write times at UTC+07:00 as the simulator does;
 * the LIVE health body uses UTC (`Z`) as mock-core does. They tell one story from the canonical
 * demo dataset (`sim/dataset.ts`, 12_sim_contract §4, D54 b):
 * - the recording scenario: session SES-20261001-0024, case LP/2026/1001-0007, subject Ahmad
 *   Fauzi (TERSANGKA), investigator OPR-001 (AKP Budi Santoso), Interview Room 1, 00:18:42 in;
 * - the export of EV-20260930-0004 (the dataset's exported item) by the SUPERVISOR OPR-002, and
 *   the RECORDED item EV-20260930-0006 of the incomplete session, which cannot be exported;
 * - device health and storage as the idle store reports them at that instant (804 GB of 4 TB).
 *
 * The live simulator dates IDs from its own clock, so on demo day the date part differs while
 * the numeric suffixes (the join key for `@dems/shared/demo-data`, D51) stay the same.
 * test/openapi.test.ts parses every example with its zod schema and compares the IDs, names and
 * numbers with the simulator's own answers at this instant.
 *
 * The examples of the Core-server operations (backend task 2026-10-04) live beside their
 * operations, in the module of their area (`identity.ts` to `alerts.ts`), and are merged into
 * `CORE_API_EXAMPLES` at the end of this file. They use the same instant, as epoch milliseconds,
 * and show every secret as a placeholder (`example-parts.ts`). The state they show is the idle
 * simulator's at that instant (`state-examples.ts`).
 *
 * The ten operations of this file also have examples for the statuses that only the Core server
 * sends (the `401` and the `403` of the five reads, the `422` of `startSession`): those carry the
 * request ID, as every answer of the Core server does. The document of the `offline` scope leaves
 * those statuses out.
 */
import type {
  ApiError,
  AudioStatusResponse,
  CurrentSessionResponse,
  DeviceHealthResponse,
  EvidenceExportAccepted,
  EvidenceExportRequest,
  SessionCommandResponse,
  SessionResource,
  SessionStartRequest,
  SessionStopRequest,
  StorageStatusResponse,
  VideoStatusResponse,
  VideoTrackStatus,
} from './core-api';
import { ADMINISTRATION_EXAMPLES } from './administration';
import { ALERT_EXAMPLES } from './alerts';
import { DEMO_EXAMPLES } from './demo-controls';
import { DEVICE_EXAMPLES } from './devices';
import { EVIDENCE_EXAMPLES } from './evidence';
import { BASIC_403_EXAMPLES, ERROR_EXAMPLES } from './example-parts';
import type { HealthResponse } from './health';
import { IDENTITY_EXAMPLES } from './identity';
import { NETWORK_TIME_EXAMPLES } from './network-time';
import { PAIRING_EXAMPLES } from './pairing';
import type { Heartbeat } from './realtime-messages';
import { SECURITY_AUDIT_EXAMPLES } from './security-audit';
import type { SessionCreateRequest } from './session-schema';
import { SESSION_EXAMPLES } from './sessions';
import { STORAGE_EXAMPLES } from './storage';
import { SYSTEM_EXAMPLES } from './system';
import { STT_CONFIG_EXAMPLES } from './transcription';

/** The instant every example describes: 2026-10-01 10:00:00 WIB (UTC+07:00). */
export const OPENAPI_EXAMPLE_INSTANT = '2026-10-01T03:00:00.000Z';
/** The same instant as the simulator writes it (UTC+07:00). */
const AT = '2026-10-01T10:00:00.000+07:00';

/** Canonical dataset identifiers the examples use (numeric suffixes are the stable join key). */
export const EXAMPLE_IDS = {
  deviceId: 'DEMS-IR-01',
  investigatorId: 'OPR-001',
  supervisorId: 'OPR-002',
  technicianId: 'OPR-003',
  recordingSessionId: 'SES-20261001-0024',
  recordingCaseNumber: 'LP/2026/1001-0007',
  /** Evidence the recording scenario seals into (the idle store's next evidence number is 0014). */
  recordingEvidenceId: 'EV-20261001-0014',
  exportedEvidenceId: 'EV-20260930-0004',
  recordedEvidenceId: 'EV-20260930-0006',
} as const;

export interface OpenApiExample<T> {
  summary: string;
  description?: string;
  value: T;
}

// ── Session ───────────────────────────────────────────────────────────────────────────────

const RECORDING_INPUT = {
  caseNumber: EXAMPLE_IDS.recordingCaseNumber,
  subjectType: 'TERSANGKA',
  subjectName: 'Ahmad Fauzi',
  investigatorId: EXAMPLE_IDS.investigatorId,
  room: 'Interview Room 1',
  profileId: 'STANDARD_1080P25',
} as const satisfies SessionCreateRequest;

const CHECK_IDS = ['CORE', 'LENS_1', 'LENS_2', 'MIC_1', 'MIC_2', 'STORAGE', 'TIME', 'SECURITY'] as const;
const CHECK_PASS_VALUES = ['ONLINE', 'READY', 'READY', 'READY', 'READY', 'READY', 'GNSS', 'READY'] as const;

const PRECHECK_PASSED: NonNullable<SessionResource['precheck']> = {
  outcome: 'PASS',
  items: CHECK_IDS.map((id, index) => ({ id, status: 'PASS', value: CHECK_PASS_VALUES[index] ?? null, reason: null })),
};

/** 00:18:42 into the recording at the example instant (started 09:41:18 WIB). */
const SESSION_RECORDING: SessionResource = {
  id: EXAMPLE_IDS.recordingSessionId,
  state: 'RECORDING',
  ...RECORDING_INPUT,
  investigatorName: 'AKP Budi Santoso',
  createdAt: '2026-10-01T09:40:48.000+07:00',
  startedAt: '2026-10-01T09:41:18.000+07:00',
  stoppedAt: null,
  sealedAt: null,
  elapsedMs: 1_122_000,
  bytesWritten: 2_555_666_667,
  evidenceId: null,
  precheck: PRECHECK_PASSED,
  fault: null,
};

/** Stopped at 10:05:00 WIB, sealed 7 s later (finalization). */
const SESSION_SEALED: SessionResource = {
  ...SESSION_RECORDING,
  state: 'SEALED',
  stoppedAt: '2026-10-01T10:05:00.000+07:00',
  sealedAt: '2026-10-01T10:05:07.000+07:00',
  elapsedMs: 1_422_000,
  bytesWritten: 3_239_000_000,
  evidenceId: EXAMPLE_IDS.recordingEvidenceId,
};

function command(state: SessionCommandResponse['state'], created?: boolean): SessionCommandResponse {
  const body: SessionCommandResponse = { sessionId: EXAMPLE_IDS.recordingSessionId, state };
  if (created !== undefined) body.created = created;
  return body;
}

// ── Health (LIVE) and the WS message ──────────────────────────────────────────────────────

const HEALTH: HealthResponse = {
  status: 'ok',
  service: 'dems-mock-core',
  version: '0.1.0',
  apiVersion: 'v1',
  serverTime: OPENAPI_EXAMPLE_INSTANT,
  uptimeMs: 5_400_000,
  ws: { path: '/ws', heartbeatIntervalMs: 1000, clients: 2 },
};

/**
 * The Core server's answer to the same request (F84-3, D187 ruling 3; closing-fix round C1): its
 * service name, a version and `ready`. Synthetic values at the example instant: `version` is an
 * example value (it was the server's package version when this was written), NOT read from or tied
 * to `apps/core-server/package.json`, and no test holds the two equal (FXR-W W92-25). Shown by the `all` scope only (`coreServerResponses`), first, so the Live API Reference
 * no longer shows mock-core's answer as the example; the `offline` document is unchanged.
 */
const CORE_SERVER_HEALTH: HealthResponse = {
  status: 'ok',
  service: 'dems-core-server',
  version: '0.2.0',
  apiVersion: 'v1',
  serverTime: OPENAPI_EXAMPLE_INSTANT,
  uptimeMs: 5_400_000,
  ws: { path: '/ws', heartbeatIntervalMs: 1000, clients: 2 },
  ready: { database: true, engine: true },
};

/** A WS `/ws` message (documented in the Realtime tag). */
export const HEARTBEAT_EXAMPLE: Heartbeat = {
  type: 'heartbeat',
  v: 1,
  seq: 5400,
  serverTime: OPENAPI_EXAMPLE_INSTANT,
  uptimeMs: 5_400_012,
  intervalMs: 1000,
  clients: 2,
  sessionState: null,
};

// ── Devices and storage ───────────────────────────────────────────────────────────────────

function videoTracks(recState: VideoTrackStatus['recState']): VideoTrackStatus[] {
  return [
    {
      trackId: 'VIDEO-01',
      deviceId: 'CAM-01',
      sourceDeviceId: 'CAM-01',
      streamState: 'LIVE',
      name: 'Camera 1',
      lens: 'READY',
      online: true,
      recState,
      resolution: '1080p',
      fps: 25,
      codec: 'H.264',
      bitrateMbps: 9,
    },
    {
      trackId: 'VIDEO-02',
      deviceId: 'CAM-02',
      sourceDeviceId: 'CAM-02',
      streamState: 'LIVE',
      name: 'Camera 2',
      lens: 'READY',
      online: true,
      recState,
      resolution: '1080p',
      fps: 25,
      codec: 'H.264',
      bitrateMbps: 9,
    },
  ];
}

const AUDIO_RECORDING: AudioStatusResponse = {
  channels: [
    {
      inputId: 'MIC-01',
      deviceId: 'MIC-01',
      role: 'PRIMARY',
      name: 'MIC 1 – Interviewer',
      state: 'READY',
      recState: 'REC',
      dbfs: -18.4,
      peak: -12.1,
      clip: false,
      noSignal: false,
      gainDb: 32,
      phantom: true,
    },
    {
      inputId: 'MIC-02',
      deviceId: 'MIC-02',
      role: 'STANDBY',
      name: 'MIC 2 – Subject',
      state: 'READY',
      recState: 'REC',
      dbfs: -51.7,
      peak: -23.9,
      clip: false,
      noSignal: false,
      gainDb: 32,
      phantom: true,
    },
  ],
  activeInputId: 'MIC-01',
};

/** The idle store at the example instant: 804 GB of 4 TB = 20 % used, 3.2 TB free (D28/Q1). */
const STORAGE_AT_LOAD: StorageStatusResponse = {
  state: 'READY',
  totalBytes: 4_000_000_000_000,
  usedBytes: 804_000_000_000,
  freeBytes: 3_196_000_000_000,
  usedPercent: 20,
  estimatedRemainingMs: 1_403_121_951,
  writeBytesPerSec: 0,
  bitrateMbps: 18.3,
  volumes: [
    { id: 'NVME-SYS', kind: 'SYSTEM', label: 'NVMe (system)', totalBytes: 2_000_000_000_000, usedBytes: 212_000_000_000 },
    { id: 'HDD-EVIDENCE', kind: 'EVIDENCE', label: 'HDD (evidence)', totalBytes: 4_000_000_000_000, usedBytes: 804_000_000_000 },
  ],
  retention: { policy: 'DAYS_90', days: 90, autoArchive: true },
};

/** The 16 book §6.1 Core services, in the simulator's order (`SVC-01` … `SVC-16`). */
const CORE_SERVICE_NAMES = [
  'API Gateway',
  'Authentication Service',
  'Session Manager',
  'Video Management Service',
  'Recording Engine',
  'Audio Capture Service',
  'AV Synchronization',
  'Metadata Manager',
  'Time Service',
  'Storage Manager',
  'Security Manager',
  'Evidence Manager',
  'Relay/GPIO Service',
  'LCD Display Service',
  'Health Monitor',
  'Audit Service',
] as const;

const DEVICE_HEALTH_IDLE: DeviceHealthResponse = {
  device: { id: EXAMPLE_IDS.deviceId, name: 'Interview Room 1', softwareVersion: '2.4.1' },
  systemState: 'READY',
  flags: [],
  cameras: videoTracks(null),
  audio: [
    {
      inputId: 'MIC-01',
      deviceId: 'MIC-01',
      role: 'PRIMARY',
      name: 'MIC 1 – Interviewer',
      state: 'READY',
      recState: null,
      dbfs: -52,
      peak: -52,
      clip: false,
      noSignal: false,
      gainDb: 32,
      phantom: true,
    },
    {
      inputId: 'MIC-02',
      deviceId: 'MIC-02',
      role: 'STANDBY',
      name: 'MIC 2 – Subject',
      state: 'READY',
      recState: null,
      dbfs: -52,
      peak: -52,
      clip: false,
      noSignal: false,
      gainDb: 32,
      phantom: true,
    },
  ],
  activeInputId: 'MIC-01',
  storage: STORAGE_AT_LOAD,
  time: { source: 'GNSS', locked: true, stratum: 1, offsetMs: 3, lastSyncAt: '2026-10-01T09:59:48.000+07:00' },
  security: { state: 'READY', posture: 'SECURE', tpmOk: true, secureBoot: true, tamper: false },
  services: CORE_SERVICE_NAMES.map((name, index) => ({
    id: `SVC-${String(index + 1).padStart(2, '0')}`,
    name,
    status: 'RUNNING',
  })),
  serverTime: AT,
};

// ── Evidence export ───────────────────────────────────────────────────────────────────────

const EXPORT_REQUEST: EvidenceExportRequest = {
  reason: 'Case file handover for prosecutor review',
  destination: 'Case file transfer (simulated)',
};

const EXPORT_ACCEPTED: EvidenceExportAccepted = {
  exportId: 'EXP-000031',
  evidenceId: EXAMPLE_IDS.exportedEvidenceId,
  // Schema v2 (C3 §3 op 42): the answer means "the job is queued"; op 87 polls it to completion.
  status: 'QUEUED',
};

function apiError(code: string, message: string): ApiError {
  return { error: { code, message } };
}

const INVALID_JSON = apiError('INVALID_JSON', 'The request body must be a JSON object.');
const NOT_SIGNED_IN = apiError('NOT_SIGNED_IN', 'Sign in first.');
/** Step 54 (D101): start / stop as a role without SESSION_START (the simulator's exact text). */
const SESSION_NOT_PERMITTED = apiError('NOT_PERMITTED', 'Your role cannot control sessions (RBAC).');

/**
 * The two refusals only the Core server sends on a read that the in-app simulator answers too
 * (01_specs §7.19): no valid session, and a retired device or an Origin outside the lists.
 */
const CORE_SERVER_READ_REFUSALS = {
  401: { notSignedIn: ERROR_EXAMPLES.notSignedIn },
  403: BASIC_403_EXAMPLES,
} as const;

// ── Per operation ─────────────────────────────────────────────────────────────────────────

export interface OperationExamples {
  /** Example value of each path parameter (prefills "Try it"). */
  pathParams?: Readonly<Record<string, string>>;
  request?: Readonly<Record<string, OpenApiExample<unknown>>>;
  responses: Readonly<Record<number, Readonly<Record<string, OpenApiExample<unknown>>>>>;
  /**
   * Examples of answers only the Core server sends for a status that the `offline` scope documents
   * too (F84-3: the health of `dems-core-server`). The `all` scope lists them before those of
   * `responses`; the `offline` scope leaves them out, so its document does not change.
   */
  coreServerResponses?: Readonly<Record<number, Readonly<Record<string, OpenApiExample<unknown>>>>>;
}

/** Examples keyed by operationId, then by HTTP status, then by example name. */
export const CORE_API_EXAMPLES: Readonly<Record<string, OperationExamples>> = {
  getServiceHealth: {
    responses: { 200: { live: { summary: 'mock-core is up', value: HEALTH } } },
    coreServerResponses: { 200: { coreServer: { summary: 'The Core server is up, database and engine ready', value: CORE_SERVER_HEALTH } } },
  },
  createSession: {
    request: {
      recordingScenario: { summary: 'The recording scenario session', value: RECORDING_INPUT },
    },
    responses: {
      200: { replay: { summary: 'Same input again: the open session', value: command('CREATE', false) } },
      201: { created: { summary: 'Created in state CREATE', value: command('CREATE', true) } },
      400: { invalidJson: { summary: 'Not a JSON object', value: INVALID_JSON } },
      401: { notSignedIn: { summary: 'Signed out', value: NOT_SIGNED_IN } },
      403: { notPermitted: { summary: 'TECHNICIAN cannot start sessions', value: apiError('NOT_PERMITTED', 'Session not created.') } },
      409: {
        sessionActive: {
          summary: 'Another session is open',
          value: apiError('SESSION_ACTIVE', `Session ${EXAMPLE_IDS.recordingSessionId} is active.`),
        },
      },
      422: { invalidInput: { summary: 'Incomplete input', value: apiError('INVALID_INPUT', 'Session not created.') } },
    },
  },
  startSession: {
    pathParams: { id: EXAMPLE_IDS.recordingSessionId },
    request: {
      acknowledgeWarnings: {
        summary: 'Acknowledge WARN and start',
        value: { acknowledgeWarnings: true } satisfies SessionStartRequest,
      },
    },
    responses: {
      200: { recording: { summary: 'ARMED → RECORDING', value: command('RECORDING') } },
      202: { precheck: { summary: 'CREATE → PRECHECK', value: command('PRECHECK') } },
      400: { invalidJson: { summary: 'Not a JSON object', value: INVALID_JSON } },
      401: { notSignedIn: { summary: 'Signed out', value: NOT_SIGNED_IN } },
      403: { notPermitted: { summary: 'TECHNICIAN cannot control sessions', value: SESSION_NOT_PERMITTED } },
      404: {
        notFound: {
          summary: 'Not the open session',
          value: apiError('NOT_FOUND', 'Session SES-20261001-0099 is not the current session.'),
        },
      },
      409: {
        precheckBlocked: {
          summary: 'Storage full blocks the start',
          value: apiError('PRECHECK_BLOCKED', 'Start blocked: Storage FULL'),
        },
        precheckRunning: {
          summary: 'Checks still running',
          value: apiError('PRECHECK_RUNNING', 'Pre-recording checks are still running.'),
        },
      },
      // Core server only: the optional body failed its schema.
      422: { invalidInput: ERROR_EXAMPLES.invalidInput },
    },
  },
  stopSession: {
    pathParams: { id: EXAMPLE_IDS.recordingSessionId },
    request: {
      completed: { summary: 'Interview completed', value: { reason: 'Interview completed' } satisfies SessionStopRequest },
    },
    responses: {
      202: { stopping: { summary: 'RECORDING → STOPPING', value: command('STOPPING') } },
      400: { invalidJson: { summary: 'Not a JSON object', value: INVALID_JSON } },
      401: { notSignedIn: { summary: 'Signed out', value: NOT_SIGNED_IN } },
      403: { notPermitted: { summary: 'TECHNICIAN cannot control sessions', value: SESSION_NOT_PERMITTED } },
      404: {
        notFound: {
          summary: 'Not the open session',
          value: apiError('NOT_FOUND', 'Session SES-20261001-0099 is not the current session.'),
        },
      },
      409: {
        invalidState: {
          summary: 'Not recording',
          value: apiError('INVALID_STATE', `Session ${EXAMPLE_IDS.recordingSessionId} is ARMED.`),
        },
      },
      422: {
        invalidReason: {
          summary: 'Reason too short',
          value: apiError('INVALID_REASON', 'A stop reason of at least 5 characters is required.'),
        },
      },
    },
  },
  getCurrentSession: {
    responses: {
      200: {
        recording: {
          summary: 'Recording, 00:18:42 in',
          value: { session: SESSION_RECORDING, serverTime: AT } satisfies CurrentSessionResponse,
        },
        sealed: {
          summary: 'Just sealed',
          value: { session: SESSION_SEALED, serverTime: '2026-10-01T10:05:10.000+07:00' } satisfies CurrentSessionResponse,
        },
        idle: {
          summary: 'Idle (no session)',
          value: { session: null, serverTime: AT } satisfies CurrentSessionResponse,
        },
      },
      ...CORE_SERVER_READ_REFUSALS,
    },
  },
  getDeviceHealth: {
    responses: { 200: { idle: { summary: 'Idle, all green', value: DEVICE_HEALTH_IDLE } }, ...CORE_SERVER_READ_REFUSALS },
  },
  getAudioStatus: {
    responses: { 200: { recording: { summary: 'Interviewer speaking', value: AUDIO_RECORDING } }, ...CORE_SERVER_READ_REFUSALS },
  },
  getVideoStatus: {
    responses: {
      200: {
        recording: { summary: 'Both tracks recording', value: { tracks: videoTracks('REC') } satisfies VideoStatusResponse },
      },
      ...CORE_SERVER_READ_REFUSALS,
    },
  },
  getStorageStatus: {
    responses: { 200: { atLoad: { summary: '20 % used, 3.2 TB free', value: STORAGE_AT_LOAD } }, ...CORE_SERVER_READ_REFUSALS },
  },
  exportEvidence: {
    pathParams: { id: EXAMPLE_IDS.exportedEvidenceId },
    request: {
      handover: { summary: 'Export for prosecutor review', value: EXPORT_REQUEST },
    },
    responses: {
      202: { accepted: { summary: 'SUPERVISOR: accepted and audited', value: EXPORT_ACCEPTED } },
      400: { invalidJson: { summary: 'Not a JSON object', value: INVALID_JSON } },
      401: { notSignedIn: { summary: 'Signed out', value: NOT_SIGNED_IN } },
      403: {
        forbidden: {
          summary: 'INVESTIGATOR: denied and audited',
          value: apiError('FORBIDDEN', 'Your role cannot export evidence (RBAC). The attempt was audited.'),
        },
      },
      404: { notFound: { summary: 'Unknown evidence', value: apiError('NOT_FOUND', 'Evidence not found.') } },
      409: {
        notSealed: {
          summary: `${EXAMPLE_IDS.recordedEvidenceId}: incomplete session, never sealed`,
          value: apiError('NOT_SEALED', 'Only sealed evidence can be exported.'),
        },
      },
      422: {
        invalidReason: {
          summary: 'Reason too short',
          value: apiError('INVALID_REASON', 'An export reason of at least 5 characters is required.'),
        },
      },
    },
  },
  // Backend task (01_specs §7.5 to §7.16): the Core-server operations, by area.
  ...IDENTITY_EXAMPLES,
  ...ADMINISTRATION_EXAMPLES,
  ...PAIRING_EXAMPLES,
  ...SESSION_EXAMPLES,
  ...EVIDENCE_EXAMPLES,
  ...DEVICE_EXAMPLES,
  ...STORAGE_EXAMPLES,
  ...NETWORK_TIME_EXAMPLES,
  ...SECURITY_AUDIT_EXAMPLES,
  ...SYSTEM_EXAMPLES,
  ...ALERT_EXAMPLES,
  ...DEMO_EXAMPLES,
  // Task 3 M6 (blueprint row 113; C3 §2.5): operations 90-92.
  ...STT_CONFIG_EXAMPLES,
};
