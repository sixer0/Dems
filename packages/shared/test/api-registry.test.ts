// Backend task 2026-10-04, plan rows W19 (contract A) and W27 (contract C): the registry model and
// the operation table. AC-B-09 (registry side: exactly 97 operations, 36 GET and 61 POST), AC-B-13
// (the ten existing operations keep path, method and schemas), RB-1 / API-8 (every entry carries
// exactly one access rule and one audit rule), API-2 / API-3 (two methods, one path parameter named
// `id`), AC-C-01 (the typed client calls every operation), and decision D36 (contract gap 1: the
// table with literal types; contract gap 2: the `query` member).
//
// Changed by design with contract C (01_specs §7.19; implementation/27_contract_c.md §9): every
// count that contract A pinned at 37 operations is now pinned at 75, and the ten existing
// operations are compared with their baseline for the statuses a client gets without the Core
// server, with the statuses only the Core server sends pinned beside them.
//
// Changed by design with decision D113 (finding CPS1-3; implementation/27_contract_c.md,
// "Follow-up: a condition for operation 23"): the vocabulary of conditions has a fourth member,
// `DEVICE_CREDENTIAL`, and the test of the conditions pins it on operation 23 and on no other.
import { describe, expect, expectTypeOf, it } from 'vitest';
import {
  ApiErrorSchema,
  CORE_API_EXAMPLES,
  CORE_API_OPERATIONS,
  CORE_API_OPERATION_TABLE,
  CORE_API_SCHEMAS,
  CoreApiAccessCondition,
  CoreApiAccessKind,
  CoreApiAuditNone,
  CoreApiMode,
  CoreApiScope,
  CoreApiService,
  CoreApiTag,
  DEVICE_CREDENTIAL_REQUIRED_REASON,
  REALTIME_SCHEMAS,
  STATE_SCHEMAS,
  coreApiAccessPermissions,
  describeCoreApiAccess,
  findCoreApiOperation,
  isOfflineCoreApiOperation,
  isOfflineCoreApiResponse,
  listCoreApiOperations,
  listCoreApiResponseStatuses,
  matchCoreApiOperation,
  type AdminUser,
  type AuditListQuery,
  type CoreApiAccess,
  type CoreApiOperation,
  type CoreApiRegistryOperation,
  type CoreApiSchemaName,
  type EvidencePage,
  type PairingRedeemed,
  type SessionNoteRequest,
  type SignInRequest,
  type StoragePolicyRequest,
  type StoragePolicySliceBody,
  type UserRoleRequest,
} from '../src/api';
import {
  createCoreClient,
  type CoreCallFailure,
  type CoreCallInput,
  type CoreCallSuccess,
  type CoreCallSuccessOf,
  type CoreFetch,
  type CoreOperationId,
} from '../src/client';
import { AuditType, Permission } from '../src/sim';

/** `[#, operationId, method, path, access, audit on success]` of 01_specs §7.5, §7.6, §7.7 and §7.16, in spec order. */
const NEW_OPERATIONS: readonly [number, string, 'get' | 'post', string, string, string][] = [
  [2, 'signIn', 'post', '/api/v1/auth/sign-in', 'PUBLIC', 'AUTH_SUCCESS'],
  [3, 'getSignInStatus', 'get', '/api/v1/auth/status', 'PUBLIC', 'NONE-R'],
  [4, 'getAuthSession', 'get', '/api/v1/auth/session', 'AUTHENTICATED', 'NONE-R'],
  [5, 'signOut', 'post', '/api/v1/auth/sign-out', 'AUTHENTICATED', 'AUTH_SIGNED_OUT'],
  [6, 'touchSession', 'post', '/api/v1/auth/touch', 'AUTHENTICATED', 'NONE-P'],
  [7, 'setBiometricEnrollment', 'post', '/api/v1/auth/biometric', 'AUTHENTICATED', 'BIOMETRIC_ENROLLMENT_CHANGED'],
  [8, 'signInWithBiometric', 'post', '/api/v1/auth/biometric/sign-in', 'DEVICE', 'AUTH_SUCCESS'],
  [9, 'reportBiometricFailure', 'post', '/api/v1/auth/biometric/failure', 'DEVICE', 'AUTH_FAILED'],
  [10, 'getRoleMatrix', 'get', '/api/v1/rbac/matrix', 'AUTHENTICATED', 'NONE-R'],
  [11, 'listUsers', 'get', '/api/v1/admin/users', 'USER_ADMIN', 'NONE-R'],
  [12, 'assignUserRole', 'post', '/api/v1/admin/users/{id}/role', 'USER_ADMIN', 'ROLE_CHANGED'],
  [13, 'enableUser', 'post', '/api/v1/admin/users/{id}/enable', 'USER_ADMIN', 'USER_ENABLED'],
  [14, 'disableUser', 'post', '/api/v1/admin/users/{id}/disable', 'USER_ADMIN', 'USER_DISABLED'],
  [15, 'issuePairingCode', 'post', '/api/v1/pairing/code', 'PAIRING_MANAGE', 'PAIRING_CODE_ISSUED'],
  [16, 'getPairingCodeStatus', 'get', '/api/v1/pairing/code', 'PAIRING_MANAGE', 'NONE-R'],
  [17, 'cancelPairingCode', 'post', '/api/v1/pairing/code/cancel', 'PAIRING_MANAGE', 'PAIRING_CODE_CLOSED'],
  [18, 'redeemPairingCode', 'post', '/api/v1/pairing/redeem', 'PUBLIC', 'PAIRING_SUCCESS'],
  [19, 'listPairedDevices', 'get', '/api/v1/pairing/devices', 'PAIRING_MANAGE', 'NONE-R'],
  [20, 'revokeDevice', 'post', '/api/v1/pairing/devices/{id}/revoke', 'PAIRING_MANAGE', 'DEVICE_REVOKED'],
  [21, 'getDeviceRegistration', 'get', '/api/v1/pairing/device', 'DEVICE', 'NONE-R'],
  [22, 'unpairDevice', 'post', '/api/v1/pairing/device/unpair', 'DEVICE', 'UNPAIRED'],
  [23, 'rotateDeviceCredential', 'post', '/api/v1/pairing/device/credential', 'DEVICE', 'DEVICE_CREDENTIAL_ROTATED'],
  [71, 'getDemoStatus', 'get', '/api/v1/demo/status', 'DEMO_CONTROL', 'NONE-R'],
  [72, 'loadScenario', 'post', '/api/v1/demo/scenario', 'DEMO_CONTROL', 'SCENARIO_LOADED'],
  [73, 'injectFault', 'post', '/api/v1/demo/faults', 'DEMO_CONTROL', 'FAULT_RAISED'],
  [74, 'clearFault', 'post', '/api/v1/demo/faults/clear', 'DEMO_CONTROL', 'FAULT_CLEARED'],
  [75, 'resetDemo', 'post', '/api/v1/demo/reset', 'DEMO_CONTROL', 'SCENARIO_LOADED'],
];

/**
 * `[#, operationId, method, path, access, audit on success, denial]` of the 38 operations of
 * 01_specs §7.8 to §7.15 that contract C adds, in spec order. The other nine operations of areas 4
 * to 11 (24 to 27, 42, 44 to 46, 53) are among the ten existing ones.
 */
const CONTRACT_C_OPERATIONS: readonly [number, string, 'get' | 'post', string, string, string, string][] = [
  [28, 'beginPrecheck', 'post', '/api/v1/session/{id}/precheck', 'SESSION_START', 'NONE-P', 'ACCESS_DENIED'],
  [29, 'retryPrecheck', 'post', '/api/v1/session/{id}/precheck/retry', 'SESSION_START', 'NONE-P', 'ACCESS_DENIED'],
  [30, 'acknowledgePrecheckWarnings', 'post', '/api/v1/session/{id}/precheck/acknowledge', 'SESSION_START', 'PRECHECK_PASSED', 'ACCESS_DENIED'],
  [31, 'cancelSession', 'post', '/api/v1/session/{id}/cancel', 'SESSION_START', 'SESSION_CANCELLED', 'ACCESS_DENIED'],
  [32, 'scanCaseNumber', 'post', '/api/v1/session/case-number', 'SESSION_START', 'NONE-P', 'ACCESS_DENIED'],
  [33, 'recoverSession', 'post', '/api/v1/session/{id}/recover', 'SESSION_START', 'RECOVERY_STARTED', 'ACCESS_DENIED'],
  [34, 'addSessionMarker', 'post', '/api/v1/session/{id}/markers', 'SESSION_NOTE', 'MARKER_ADDED', 'ACCESS_DENIED'],
  [35, 'addSessionNote', 'post', '/api/v1/session/{id}/notes', 'SESSION_NOTE', 'NOTE_ADDED', 'ACCESS_DENIED'],
  [36, 'takeSessionSnapshot', 'post', '/api/v1/session/{id}/snapshots', 'SESSION_NOTE', 'SNAPSHOT_TAKEN', 'ACCESS_DENIED'],
  [37, 'acknowledgeSessionSummary', 'post', '/api/v1/session/{id}/summary/acknowledge', 'SESSION_START', 'SUMMARY_ACKNOWLEDGED', 'ACCESS_DENIED'],
  [38, 'listSessionHistory', 'get', '/api/v1/session/history', 'AUTHENTICATED', 'NONE-R', 'ACCESS_DENIED'],
  [39, 'listEvidence', 'get', '/api/v1/evidence', 'EVIDENCE_VIEW', 'NONE-R', 'ACCESS_DENIED'],
  [40, 'getEvidence', 'get', '/api/v1/evidence/{id}', 'EVIDENCE_VIEW', 'NONE-R', 'ACCESS_DENIED'],
  [41, 'verifyEvidence', 'post', '/api/v1/evidence/{id}/verify', 'EVIDENCE_VIEW', 'EVIDENCE_VERIFIED', 'ACCESS_DENIED'],
  [43, 'archiveEvidence', 'post', '/api/v1/evidence/{id}/archive', 'EVIDENCE_REVIEW', 'EVIDENCE_ARCHIVED', 'ACCESS_DENIED'],
  [47, 'getDeviceInventory', 'get', '/api/v1/device/inventory', 'AUTHENTICATED', 'NONE-R', 'ACCESS_DENIED'],
  [48, 'restartDevice', 'post', '/api/v1/device/{id}/restart', 'DEVICE_MANAGE', 'DEVICE_COMMAND', 'ACCESS_DENIED'],
  [49, 'testDeviceSignal', 'post', '/api/v1/device/{id}/test-signal', 'DIAGNOSTICS_RUN', 'DEVICE_COMMAND', 'ACCESS_DENIED'],
  [50, 'identifyDevice', 'post', '/api/v1/device/{id}/identify', 'DIAGNOSTICS_RUN', 'DEVICE_COMMAND', 'ACCESS_DENIED'],
  [51, 'setActiveCamera', 'post', '/api/v1/video/active-camera', 'AUTHENTICATED', 'NONE-P', 'ACCESS_DENIED'],
  [52, 'resetMicClip', 'post', '/api/v1/audio/clip/reset', 'AUTHENTICATED', 'NONE-P', 'ACCESS_DENIED'],
  [54, 'getStorageDetail', 'get', '/api/v1/storage/detail', 'AUTHENTICATED', 'NONE-R', 'ACCESS_DENIED'],
  [55, 'setStoragePolicy', 'post', '/api/v1/storage/policy', 'ANY-OF(EVIDENCE_REVIEW, MAINTENANCE)', 'STORAGE_POLICY_CHANGED', 'ACCESS_DENIED'],
  [56, 'getNetworkStatus', 'get', '/api/v1/network/status', 'AUTHENTICATED', 'NONE-R', 'ACCESS_DENIED'],
  [57, 'getTimeStatus', 'get', '/api/v1/time/status', 'AUTHENTICATED', 'NONE-R', 'ACCESS_DENIED'],
  [58, 'getSecurityStatus', 'get', '/api/v1/security/status', 'AUTHENTICATED', 'NONE-R', 'ACCESS_DENIED'],
  [59, 'listAuditRows', 'get', '/api/v1/audit', 'AUTHENTICATED', 'NONE-R', 'ACCESS_DENIED'],
  [60, 'verifyAuditChain', 'get', '/api/v1/audit/chain', 'AUTHENTICATED', 'NONE-R', 'ACCESS_DENIED'],
  [61, 'exportAudit', 'post', '/api/v1/audit/export', 'AUDIT_EXPORT', 'AUDIT_EXPORTED', 'EXPORT_DENIED'],
  [62, 'exportLogs', 'post', '/api/v1/logs/export', 'AUDIT_EXPORT', 'AUDIT_EXPORTED', 'EXPORT_DENIED'],
  [63, 'listEvents', 'get', '/api/v1/events', 'AUTHENTICATED', 'NONE-R', 'ACCESS_DENIED'],
  [64, 'getSystemStatus', 'get', '/api/v1/system/status', 'AUTHENTICATED', 'NONE-R', 'ACCESS_DENIED'],
  [65, 'runDiagnostics', 'post', '/api/v1/system/diagnostics', 'DIAGNOSTICS_RUN', 'DIAGNOSTICS_RUN', 'ACCESS_DENIED'],
  [66, 'restartServices', 'post', '/api/v1/system/services/restart', 'MAINTENANCE', 'DEVICE_COMMAND', 'ACCESS_DENIED'],
  [67, 'startSoftwareUpdate', 'post', '/api/v1/system/update', 'MAINTENANCE', 'UPDATE_STARTED', 'ACCESS_DENIED'],
  [68, 'updateSettings', 'post', '/api/v1/settings', 'AUTHENTICATED', 'NONE-P', 'ACCESS_DENIED'],
  [69, 'listAlerts', 'get', '/api/v1/alerts', 'AUTHENTICATED', 'NONE-R', 'ACCESS_DENIED'],
  [70, 'acknowledgeAlert', 'post', '/api/v1/alerts/{id}/acknowledge', 'AUTHENTICATED', 'NONE-P', 'ACCESS_DENIED'],
];

/**
 * Task 3 M2-W7 (blueprint row 48; `C3 §2.2`): the fourteen capture-phase operations 76-89 appended to
 * the registry, in number order. `[#, operationId, method, path, access marker, audit on success,
 * denial, mode]`. Thirteen are `simulated` (the in-app simulator answers them, so they are visible in
 * the `offline` scope per OD-17); op 88 `createEvidenceMediaSession` is `live` only (Simulated mode
 * plays bundled demo media and opens no signed media session). Ops 90-92 (R-8) follow in
 * `M6_OPERATIONS` below (Q-STT-CFG confirmed, D24; `C3 §2.5`; CF-11).
 */
const M2_OPERATIONS: readonly [number, string, 'get' | 'post', string, string, string, string, 'simulated' | 'live'][] = [
  [76, 'getCaptureConfig', 'get', '/api/v1/capture/config', 'AUTHENTICATED', 'NONE-R', 'ACCESS_DENIED', 'simulated'],
  [77, 'getCaptureDevices', 'get', '/api/v1/capture/devices', 'AUTHENTICATED', 'NONE-R', 'ACCESS_DENIED', 'simulated'],
  [78, 'updateCaptureConfig', 'post', '/api/v1/capture/config', 'CAPTURE_CONFIG', 'CAPTURE_CONFIG_CHANGED', 'ACCESS_DENIED', 'simulated'],
  [79, 'setCaptureCameraSource', 'post', '/api/v1/capture/cameras/{id}/source', 'CAPTURE_CONFIG', 'CAPTURE_CONFIG_CHANGED', 'ACCESS_DENIED', 'simulated'],
  [80, 'setPrimaryMic', 'post', '/api/v1/capture/mics/{id}/primary', 'CAPTURE_CONFIG', 'CAPTURE_CONFIG_CHANGED', 'ACCESS_DENIED', 'simulated'],
  [81, 'switchAudioSource', 'post', '/api/v1/session/{id}/audio-source', 'SESSION_START', 'AUDIO_SOURCE_SWITCHED', 'ACCESS_DENIED', 'simulated'],
  [82, 'listAudioSourceIntervals', 'get', '/api/v1/session/{id}/audio-source', 'AUTHENTICATED', 'NONE-R', 'ACCESS_DENIED', 'simulated'],
  [83, 'getSealingProgress', 'get', '/api/v1/session/{id}/sealing', 'AUTHENTICATED', 'NONE-R', 'ACCESS_DENIED', 'simulated'],
  [84, 'getTranscript', 'get', '/api/v1/evidence/{id}/transcript', 'EVIDENCE_VIEW', 'NONE-R', 'ACCESS_DENIED', 'simulated'],
  [85, 'createTranscriptRevision', 'post', '/api/v1/evidence/{id}/transcript/revisions', 'TRANSCRIPT_REVISE', 'TRANSCRIPT_REVISED', 'ACCESS_DENIED', 'simulated'],
  [86, 'listTranscriptRevisions', 'get', '/api/v1/evidence/{id}/transcript/revisions', 'EVIDENCE_VIEW', 'NONE-R', 'ACCESS_DENIED', 'simulated'],
  [87, 'getEvidenceExportJob', 'get', '/api/v1/evidence/exports/{id}', 'EVIDENCE_EXPORT', 'NONE-R', 'ACCESS_DENIED', 'simulated'],
  [88, 'createEvidenceMediaSession', 'post', '/api/v1/evidence/{id}/media-sessions', 'EVIDENCE_VIEW', 'EVIDENCE_MEDIA_SERVED', 'ACCESS_DENIED', 'live'],
  [89, 'setCaptureDeviceCredential', 'post', '/api/v1/capture/devices/{id}/credential', 'CAPTURE_CONFIG', 'CAPTURE_CREDENTIAL_SET', 'ACCESS_DENIED', 'simulated'],
];
/**
 * Task 3 M6 (blueprint row 113; `C3 §2.5`; R-8, D20/D24): the three STT configuration operations
 * 90-92, appended after op 89 in number order. Same columns as `M2_OPERATIONS`. All three are
 * `simulated`, so the `offline` scope gains them too (23 -> 26). The pinned totals follow C3 §2.5:
 * registry 92 operations, 35 GET / 57 POST, audit types 63 (`STT_CONFIG_CHANGED`).
 */
const M6_OPERATIONS: typeof M2_OPERATIONS = [
  [90, 'getSttConfig', 'get', '/api/v1/transcription/config', 'AUTHENTICATED', 'NONE-R', 'ACCESS_DENIED', 'simulated'],
  [91, 'updateSttConfig', 'post', '/api/v1/transcription/config', 'CAPTURE_CONFIG', 'STT_CONFIG_CHANGED', 'ACCESS_DENIED', 'simulated'],
  [92, 'testSttConnection', 'post', '/api/v1/transcription/config/test', 'CAPTURE_CONFIG', 'NONE-P', 'ACCESS_DENIED', 'simulated'],
];
/**
 * Task 3 R-9..R-11 (blueprint row 132, decision D106; `C3 §2.6`, §10.1): the five operations of the
 * camera search, the connection test, the adoption and the local-input re-read, 93-97, appended
 * after op 92 in number order. Same columns as `M2_OPERATIONS`. All five are `simulated`, so the
 * `offline` scope gains them too (26 -> 31). The pinned totals follow C3 §10.1: registry 97
 * operations, 36 GET / 61 POST, audit types 67.
 */
const M4_DISCOVERY_OPERATIONS: typeof M2_OPERATIONS = [
  [93, 'startCaptureDiscovery', 'post', '/api/v1/capture/discovery', 'CAPTURE_CONFIG', 'CAPTURE_DISCOVERY_SEARCHED', 'ACCESS_DENIED', 'simulated'],
  [94, 'getCaptureDiscovery', 'get', '/api/v1/capture/discovery', 'CAPTURE_CONFIG', 'NONE-R', 'ACCESS_DENIED', 'simulated'],
  [95, 'testCaptureCandidateConnection', 'post', '/api/v1/capture/discovery/candidates/{id}/test', 'CAPTURE_CONFIG', 'CAPTURE_CONNECTION_TESTED', 'ACCESS_DENIED', 'simulated'],
  [96, 'adoptCaptureCandidate', 'post', '/api/v1/capture/discovery/candidates/{id}/adopt', 'CAPTURE_CONFIG', 'CAPTURE_CANDIDATE_ADOPTED', 'ACCESS_DENIED', 'simulated'],
  [97, 'rescanCaptureInputs', 'post', '/api/v1/capture/inputs/rescan', 'CAPTURE_CONFIG', 'CAPTURE_DISCOVERY_SEARCHED', 'ACCESS_DENIED', 'simulated'],
];
/** The thirteen simulated M2 operations, the three of M6 and the five of R-9..R-11, in number order — the ones the `offline` scope gains. */
const M2_SIMULATED_IDS = [...M2_OPERATIONS, ...M6_OPERATIONS, ...M4_DISCOVERY_OPERATIONS].filter((entry) => entry[7] === 'simulated').map((entry) => entry[1]);

/** The spec numbers of the ten existing operations (01_specs §7.4, §7.8 to §7.11), in registry order. */
const EXISTING_NUMBERS = [1, 24, 25, 26, 27, 44, 45, 46, 53, 42];

/**
 * The statuses that only the Core server sends on one of the ten existing operations (01_specs
 * §7.2, §7.19): the simulator's read handlers check no sign-in, and it ignores a wrong member of
 * the optional start body. Each is marked `services: ['dems-core-server']`.
 */
const CORE_SERVER_ONLY_STATUSES: Record<string, number[]> = {
  startSession: [422],
  getCurrentSession: [401, 403],
  getDeviceHealth: [401, 403],
  getAudioStatus: [401, 403],
  getVideoStatus: [401, 403],
  getStorageStatus: [401, 403],
};

/**
 * The ten operations as they were at the baseline commit `acaff20`, read from the committed
 * openapi.json of that commit: `[operationId, method, path, path-parameter pattern, request schema
 * and whether it is required, status → response schema]`. AC-B-13.
 */
const BASELINE: readonly [string, 'get' | 'post', string, string | null, readonly [string, boolean] | null, Record<number, string>][] = [
  ['getServiceHealth', 'get', '/api/v1/health', null, null, { 200: 'HealthResponse' }],
  [
    'createSession',
    'post',
    '/api/v1/session',
    null,
    ['SessionCreateRequest', true],
    { 200: 'SessionCommandResponse', 201: 'SessionCommandResponse', 400: 'ApiError', 401: 'ApiError', 403: 'ApiError', 409: 'ApiError', 422: 'ApiError' },
  ],
  [
    'startSession',
    'post',
    '/api/v1/session/{id}/start',
    '^SES-\\d{8}-\\d{4}$',
    ['SessionStartRequest', false],
    { 200: 'SessionCommandResponse', 202: 'SessionCommandResponse', 400: 'ApiError', 401: 'ApiError', 403: 'ApiError', 404: 'ApiError', 409: 'ApiError' },
  ],
  [
    'stopSession',
    'post',
    '/api/v1/session/{id}/stop',
    '^SES-\\d{8}-\\d{4}$',
    ['SessionStopRequest', true],
    { 202: 'SessionCommandResponse', 400: 'ApiError', 401: 'ApiError', 403: 'ApiError', 404: 'ApiError', 409: 'ApiError', 422: 'ApiError' },
  ],
  ['getCurrentSession', 'get', '/api/v1/session/current', null, null, { 200: 'CurrentSessionResponse' }],
  ['getDeviceHealth', 'get', '/api/v1/device/health', null, null, { 200: 'DeviceHealthResponse' }],
  ['getAudioStatus', 'get', '/api/v1/audio/status', null, null, { 200: 'AudioStatusResponse' }],
  ['getVideoStatus', 'get', '/api/v1/video/status', null, null, { 200: 'VideoStatusResponse' }],
  ['getStorageStatus', 'get', '/api/v1/storage/status', null, null, { 200: 'StorageStatusResponse' }],
  [
    'exportEvidence',
    'post',
    '/api/v1/evidence/{id}/export',
    '^EV-\\d{8}-\\d{4}$',
    ['EvidenceExportRequest', true],
    { 202: 'EvidenceExportAccepted', 400: 'ApiError', 401: 'ApiError', 403: 'ApiError', 404: 'ApiError', 409: 'ApiError', 422: 'ApiError' },
  ],
];

/** `[operationId, access, audit on success, denial]` of the ten existing operations (01_specs §7.4, §7.8 to §7.11). */
const BASELINE_RULES: readonly [string, string, string, string][] = [
  ['getServiceHealth', 'PUBLIC', 'NONE-R', 'ACCESS_DENIED'],
  ['createSession', 'SESSION_START', 'SESSION_CREATED', 'ACCESS_DENIED'],
  ['startSession', 'SESSION_START', 'RECORDING_STARTED', 'ACCESS_DENIED'],
  ['stopSession', 'SESSION_START', 'RECORDING_STOPPED', 'ACCESS_DENIED'],
  ['getCurrentSession', 'AUTHENTICATED', 'NONE-R', 'ACCESS_DENIED'],
  ['getDeviceHealth', 'AUTHENTICATED', 'NONE-R', 'ACCESS_DENIED'],
  ['getAudioStatus', 'AUTHENTICATED', 'NONE-R', 'ACCESS_DENIED'],
  ['getVideoStatus', 'AUTHENTICATED', 'NONE-R', 'ACCESS_DENIED'],
  ['getStorageStatus', 'AUTHENTICATED', 'NONE-R', 'ACCESS_DENIED'],
  ['exportEvidence', 'EVIDENCE_EXPORT', 'EVIDENCE_EXPORTED', 'EXPORT_DENIED'],
];

const PERMISSIONS = Object.values(Permission) as string[];
const AUDIT_TYPES = Object.values(AuditType) as string[];
const AUDIT_NONE = Object.values(CoreApiAuditNone) as string[];

/**
 * The shape the baseline is compared with. The responses are those a client gets without the Core
 * server: what the in-app simulator and mock-core answer, which is what the baseline documented.
 */
function shapeOf(operation: CoreApiRegistryOperation) {
  return [
    operation.operationId,
    operation.method,
    operation.path,
    operation.pathParam?.pattern.source ?? null,
    operation.requestBody ? [operation.requestBody.schema, operation.requestBody.required] : null,
    Object.fromEntries(listCoreApiResponseStatuses(operation, CoreApiScope.OFFLINE).map((status) => [status, operation.responses[status]?.schema])),
  ];
}

/** A concrete path of the operation: `{id}` replaced by its example. */
function concretePath(operation: CoreApiOperation): string {
  const id = CORE_API_EXAMPLES[operation.operationId]?.pathParams?.id;
  return operation.pathParam ? operation.path.replace('{id}', id ?? 'MISSING') : operation.path;
}

describe('AC-B-09: the registry holds exactly 97 operations', () => {
  it('holds the 10 existing operations first, then the 65 that only the Core server answers, then the 22 of task 3 (14 of M2, 3 of M6, 5 of R-9..R-11), by area in spec order', () => {
    expect(CORE_API_OPERATIONS).toHaveLength(97);
    expect(CORE_API_OPERATIONS.slice(0, 10).map((operation) => operation.operationId)).toEqual(BASELINE.map(([id]) => id));
    // Areas 1, 2 and 3 (contract A), then areas 4 to 11 (contract C), then area 13 (contract A),
    // then task 3 M2-W7's operations 76-89, M6's 90-92 and the 93-97 of R-9..R-11 appended in number order.
    const byNumber = [
      ...NEW_OPERATIONS.map(([number, id]) => [number, id] as const),
      ...CONTRACT_C_OPERATIONS.map(([number, id]) => [number, id] as const),
      ...M2_OPERATIONS.map(([number, id]) => [number, id] as const),
      ...M6_OPERATIONS.map(([number, id]) => [number, id] as const),
      ...M4_DISCOVERY_OPERATIONS.map(([number, id]) => [number, id] as const),
    ].sort((a, b) => a[0] - b[0]);
    expect(CORE_API_OPERATIONS.slice(10).map((operation) => operation.operationId)).toEqual(byNumber.map(([, id]) => id));
    expect(NEW_OPERATIONS).toHaveLength(27);
    expect(NEW_OPERATIONS.map(([number]) => number)).toEqual([...Array.from({ length: 22 }, (_, index) => index + 2), 71, 72, 73, 74, 75]);
    expect(CONTRACT_C_OPERATIONS).toHaveLength(38);
    expect(M2_OPERATIONS).toHaveLength(14);
    expect(M6_OPERATIONS).toHaveLength(3);
    expect(M4_DISCOVERY_OPERATIONS).toHaveLength(5);
    // Every number of 01_specs §7 from 1 to 75 plus task 3's 76 to 97 is one operation of the registry.
    const numbers = [...EXISTING_NUMBERS, ...byNumber.map(([number]) => number)].sort((a, b) => a - b);
    expect(numbers).toEqual([...Array.from({ length: 75 }, (_, index) => index + 1), ...Array.from({ length: 22 }, (_, index) => index + 76)]);
    // Areas 4 to 11 are the numbers 24 to 70: 47 operations, 9 of them existing and 38 new.
    expect(numbers.filter((number) => number >= 24 && number <= 70)).toHaveLength(47);
    expect(EXISTING_NUMBERS.filter((number) => number >= 24 && number <= 70)).toHaveLength(9);
  });

  it('names every operation and every method-and-path once; 36 are GET and 61 are POST', () => {
    const ids = CORE_API_OPERATIONS.map((operation) => operation.operationId);
    expect(new Set(ids).size).toBe(97);
    const routes = CORE_API_OPERATIONS.map((operation) => `${operation.method} ${operation.path}`);
    expect(new Set(routes).size).toBe(97);
    expect(CORE_API_OPERATIONS.filter((operation) => operation.method === 'get')).toHaveLength(36);
    expect(CORE_API_OPERATIONS.filter((operation) => operation.method === 'post')).toHaveLength(61);
    for (const id of ids) expect(findCoreApiOperation(id)?.operationId).toBe(id);
  });

  it('the 38 operations of areas 4 to 11 have the method, path, access rule and audit rule of the specification', () => {
    for (const [, operationId, method, path, access, success, denial] of CONTRACT_C_OPERATIONS) {
      const operation = findCoreApiOperation(operationId);
      expect(operation, operationId).toBeDefined();
      expect([operation?.method, operation?.path], operationId).toEqual([method, path]);
      expect(describeCoreApiAccess(operation!.access), operationId).toBe(access);
      expect(operation?.audit.success, operationId).toBe(success);
      expect(operation?.audit.denial, operationId).toBe(denial);
      expect(operation?.mode, operationId).toBe(CoreApiMode.LIVE);
      expect(operation?.rbac, operationId).toBeUndefined();
      expect(operation?.access.conditions, operationId).toBeUndefined();
      expect(operation?.coreServerDescription, operationId).toBeUndefined();
    }
  });

  it('the 27 new operations have the method, path, access rule and audit rule of the specification', () => {
    for (const [, operationId, method, path, access, success] of NEW_OPERATIONS) {
      const operation = findCoreApiOperation(operationId);
      expect(operation, operationId).toBeDefined();
      expect([operation?.method, operation?.path], operationId).toEqual([method, path]);
      expect(describeCoreApiAccess(operation!.access), operationId).toBe(access);
      expect(operation?.audit.success, operationId).toBe(success);
      expect(operation?.audit.denial, operationId).toBe('ACCESS_DENIED');
      expect(operation?.mode, operationId).toBe(CoreApiMode.LIVE);
      expect(operation?.rbac, operationId).toBeUndefined();
    }
  });
});

describe('AC-B-13: the ten existing operations equal their baseline', () => {
  it('path, method, path parameter, request schema and response schemas are those of acaff20', () => {
    // Changed by design (W27; 01_specs §7.19): the baseline is compared with the statuses a client
    // gets without the Core server. The statuses only the Core server sends are pinned below.
    const now = CORE_API_OPERATIONS.slice(0, 10).map(shapeOf);
    expect(now).toEqual(BASELINE.map((entry) => [...entry]));
  });

  it('what only the Core server sends on them: 401 and 403 on the five reads, 422 on startSession', () => {
    const marked = Object.fromEntries(
      CORE_API_OPERATIONS.slice(0, 10)
        .map((operation) => [
          operation.operationId,
          Object.keys(operation.responses).map(Number).filter((status) => !isOfflineCoreApiResponse(operation.responses[status]!)),
        ] as const)
        .filter(([, statuses]) => statuses.length > 0),
    );
    expect(marked).toEqual(CORE_SERVER_ONLY_STATUSES);
    for (const operation of CORE_API_OPERATIONS) {
      for (const [status, spec] of Object.entries(operation.responses)) {
        if (spec.services === undefined) continue;
        // Only the Core server, only a refusal, and only on an operation the simulator answers too.
        expect(spec.services, `${operation.operationId} ${status}`).toEqual([CoreApiService.CORE_SERVER]);
        // The ONE answer that is no refusal (C3 §2.6 op 93): `200` with `created: false` while the
        // caller's own search is still RUNNING. The simulator's search is COMPLETE when it is answered,
        // so it never has a running search to repeat. Named here; every other one is a refusal.
        const coreOnlySuccess = operation.operationId === 'startCaptureDiscovery' && status === '200';
        expect(spec.schema, `${operation.operationId} ${status}`).toBe(coreOnlySuccess ? 'CaptureDiscoverySearch' : 'ApiError');
        expect(operation.mode, operation.operationId).toBe(CoreApiMode.SIMULATED);
        expect(CORE_API_EXAMPLES[operation.operationId]?.responses[Number(status)], `${operation.operationId} ${status}`).toBeDefined();
      }
      expect(listCoreApiResponseStatuses(operation), operation.operationId).toEqual(Object.keys(operation.responses).map(Number).sort((a, b) => a - b));
    }
    // health is PUBLIC: its only refusals are the two envelope-level ones, so it documents 200 alone.
    expect(Object.keys(findCoreApiOperation('getServiceHealth')!.responses)).toEqual(['200']);
    // Every operation that is not PUBLIC documents 401 now, the five reads included.
    for (const operation of CORE_API_OPERATIONS) {
      expect(operation.responses[401] !== undefined, operation.operationId).toBe(
        operation.access.kind !== CoreApiAccessKind.PUBLIC || ['signIn', 'redeemPairingCode'].includes(operation.operationId),
      );
    }
  });

  it('each of the ten says in `coreServerDescription` what the Core server does; no other operation needs it', () => {
    for (const operation of CORE_API_OPERATIONS.slice(0, 10)) {
      const text = operation.coreServerDescription ?? '';
      expect(text.length, operation.operationId).toBeGreaterThan(80);
      expect(text, operation.operationId).not.toBe(operation.description);
      expect(text, operation.operationId).toContain('Core server');
      // KI-18: the stale sentence and the simulator-only wording stay out of the Core server's text.
      expect(text, operation.operationId).not.toMatch(/served by mock-core|CORS allows|"Try it" is answered in the browser|Nothing leaves the machine/);
    }
    expect(CORE_API_OPERATIONS.slice(10).filter((operation) => operation.coreServerDescription !== undefined)).toEqual([]);
  });

  it('they keep their mode, their tag and their simulator rule; one is live, nine are simulated', () => {
    const ten = CORE_API_OPERATIONS.slice(0, 10);
    expect(ten.map((operation) => operation.mode)).toEqual(['live', ...Array<string>(9).fill('simulated')]);
    expect(ten.map((operation) => operation.tag)).toEqual([
      'Service', 'Session', 'Session', 'Session', 'Session', 'Device', 'Device', 'Device', 'Storage', 'Evidence',
    ]);
    expect(ten.filter((operation) => operation.rbac).map((operation) => [operation.operationId, operation.rbac?.permission, operation.rbac?.audit])).toEqual([
      ['createSession', 'SESSION_START', ['SESSION_CREATED']],
      ['startSession', 'SESSION_START', ['PRECHECK_PASSED', 'RECORDING_STARTED']],
      ['stopSession', 'SESSION_START', ['RECORDING_STOPPED']],
      ['exportEvidence', 'EVIDENCE_EXPORT', ['EVIDENCE_EXPORTED', 'EXPORT_DENIED']],
    ]);
    // Outside these ten nothing is simulated EXCEPT task 3's thirteen simulated capture/transcript
    // operations (op 88 stays live; `C3 §8`, OD-17), the three STT configuration operations 90-92
    // (`C3 §2.5`) and the five of the camera search 93-97 (`C3 §2.6`). The rest of areas 4 to 11
    // remain Core-server-only.
    const simulatedOutsideTen = CORE_API_OPERATIONS.slice(10).filter((operation) => operation.mode === CoreApiMode.SIMULATED);
    expect(simulatedOutsideTen.map((operation) => operation.operationId)).toEqual(M2_SIMULATED_IDS);
  });

  it('what they gained: the access rule and the audit rule of the specification', () => {
    const rules = CORE_API_OPERATIONS.slice(0, 10).map((operation) => [
      operation.operationId,
      describeCoreApiAccess(operation.access),
      operation.audit.success,
      operation.audit.denial,
    ]);
    expect(rules).toEqual(BASELINE_RULES.map((entry) => [...entry]));
    // startSession is the one operation with more than one possible audit type, by the existing contract.
    expect(findCoreApiOperation('startSession')?.audit.also).toEqual(['PRECHECK_PASSED']);
  });
});

describe('RB-1, API-8: every entry carries exactly one access rule and one audit rule', () => {
  it('the access rule is one of the five forms, with permissions and conditions of the shared vocabulary', () => {
    for (const operation of CORE_API_OPERATIONS) {
      const { access } = operation;
      expect(access, operation.operationId).toBeDefined();
      expect(Object.values(CoreApiAccessKind), operation.operationId).toContain(access.kind);
      const extra = Object.keys(access).filter((key) => !['kind', 'permission', 'permissions', 'conditions'].includes(key));
      expect(extra, operation.operationId).toEqual([]);
      expect('permission' in access, operation.operationId).toBe(access.kind === CoreApiAccessKind.PERMISSION);
      expect('permissions' in access, operation.operationId).toBe(access.kind === CoreApiAccessKind.ANY_OF);
      for (const permission of coreApiAccessPermissions(access)) expect(PERMISSIONS, operation.operationId).toContain(permission);
      for (const condition of access.conditions ?? []) {
        expect(Object.values(CoreApiAccessCondition), operation.operationId).toContain(condition);
      }
    }
  });

  it('the audit rule names audit types of the shared vocabulary, or one of the two explicit markers', () => {
    for (const operation of CORE_API_OPERATIONS) {
      const { audit } = operation;
      expect(audit, operation.operationId).toBeDefined();
      expect(Object.keys(audit).filter((key) => !['success', 'denial', 'also'].includes(key)), operation.operationId).toEqual([]);
      expect([...AUDIT_TYPES, ...AUDIT_NONE], operation.operationId).toContain(audit.success);
      expect(['ACCESS_DENIED', 'EXPORT_DENIED'], operation.operationId).toContain(audit.denial);
      for (const type of audit.also ?? []) expect(AUDIT_TYPES, operation.operationId).toContain(type);
      expect(audit.also ?? [], operation.operationId).not.toContain(audit.success);
      // API-2: a GET reads and never changes state, so it writes no row.
      if (operation.method === 'get') expect(audit.success, operation.operationId).toBe(CoreApiAuditNone.READ);
      else expect(audit.success, operation.operationId).not.toBe(CoreApiAuditNone.READ);
    }
    // RB-5: only the three exports (operations 42, 61 and 62) keep EXPORT_DENIED.
    expect(CORE_API_OPERATIONS.filter((operation) => operation.audit.denial === 'EXPORT_DENIED').map((operation) => operation.operationId)).toEqual([
      'exportEvidence',
      'exportAudit',
      'exportLogs',
    ]);
    // The vocabulary this file relies on (D37; task 3 M2-W7 adds nine types, 53 -> 62; M6 row 113
    // adds STT_CONFIG_CHANGED, 62 -> 63 — the C3 §2.5 total; R-9..R-11 add the four of C3 §5.2
    // (search, connection test, adoption, device unreachable), 63 -> 67 — the C3 §10.1 total).
    expect(PERMISSIONS).toHaveLength(14);
    expect(AUDIT_TYPES).toHaveLength(67);
  });

  it('counts by access rule: 4 PUBLIC, 5 DEVICE, 30 AUTHENTICATED, 57 with one permission, 1 any-of', () => {
    const count = (kind: string) => CORE_API_OPERATIONS.filter((operation) => operation.access.kind === kind).length;
    // M6 row 113 (C3 §2.5): op 90 is AUTHENTICATED (29 -> 30); ops 91 and 92 need CAPTURE_CONFIG (50 -> 52).
    // R-9..R-11 (C3 §2.6): all five of 93-97 need CAPTURE_CONFIG (52 -> 57).
    expect([count('PUBLIC'), count('DEVICE'), count('AUTHENTICATED'), count('PERMISSION'), count('ANY_OF')]).toEqual([4, 5, 30, 57, 1]);
    // 58 operations carry a permission: the 40 of contract C plus the one any-of, plus task 3's seventeen
    // permission operations (78/79/80/81/84/85/86/87/88/89, 91/92 and 93-97).
    expect(CORE_API_OPERATIONS.filter((operation) => coreApiAccessPermissions(operation.access).length > 0)).toHaveLength(58);
    const byPermission = (permission: string) =>
      CORE_API_OPERATIONS.filter((operation) => describeCoreApiAccess(operation.access) === permission).map((operation) => operation.operationId);
    expect(byPermission('USER_ADMIN')).toEqual(['listUsers', 'assignUserRole', 'enableUser', 'disableUser']);
    expect(byPermission('PAIRING_MANAGE')).toEqual([
      'issuePairingCode', 'getPairingCodeStatus', 'cancelPairingCode', 'listPairedDevices', 'revokeDevice',
    ]);
    expect(byPermission('DEMO_CONTROL')).toEqual(['getDemoStatus', 'loadScenario', 'injectFault', 'clearFault', 'resetDemo']);
    expect(byPermission('ANY-OF(EVIDENCE_REVIEW, MAINTENANCE)')).toEqual(['setStoragePolicy']);
  });

  it('every permission is enforced at the operations 01_specs §4.3 names, and at no other', () => {
    // `[permission, operation numbers]` of the table of 01_specs §4.3; 55 is the any-of and counts for both.
    const ENFORCED_AT: readonly [string, number[]][] = [
      ['SESSION_START', [24, 25, 26, 28, 29, 30, 31, 32, 33, 37, 81]],
      ['SESSION_NOTE', [34, 35, 36]],
      ['EVIDENCE_VIEW', [39, 40, 41, 84, 86, 88]],
      ['EVIDENCE_REVIEW', [43, 55]],
      ['EVIDENCE_EXPORT', [42, 87]],
      ['AUDIT_EXPORT', [61, 62]],
      ['DEVICE_MANAGE', [48]],
      ['DIAGNOSTICS_RUN', [49, 50, 65]],
      ['MAINTENANCE', [55, 66, 67]],
      ['PAIRING_MANAGE', [15, 16, 17, 19, 20]],
      ['USER_ADMIN', [11, 12, 13, 14]],
      ['DEMO_CONTROL', [71, 72, 73, 74, 75]],
      // Task 3 M2-W7 (blueprint row 48) wires the two M2-W6 permissions: CAPTURE_CONFIG at
      // 78/79/80/89 and TRANSCRIPT_REVISE at 85 (`C3 §2.2`). Op 81 adds SESSION_START with the new
      // `SESSION_HOLDER` condition; ops 84/86/88 add EVIDENCE_VIEW; op 87 adds EVIDENCE_EXPORT.
      // M6 row 113 (C3 §2.5): the STT configuration write (91) and test (92) take the same permission.
      // R-9..R-11 (C3 §2.6): no new permission — the search, the candidate read, the test, the adoption
      // and the local-input re-read all take CAPTURE_CONFIG (R-9 AC-12).
      ['CAPTURE_CONFIG', [78, 79, 80, 89, 91, 92, 93, 94, 95, 96, 97]],
      ['TRANSCRIPT_REVISE', [85]],
    ];
    expect(ENFORCED_AT.map(([permission]) => permission)).toEqual(PERMISSIONS);
    const numberOf = new Map<string, number>([
      ...BASELINE.map(([id], index) => [id, EXISTING_NUMBERS[index]!] as const),
      ...NEW_OPERATIONS.map(([number, id]) => [id, number] as const),
      ...CONTRACT_C_OPERATIONS.map(([number, id]) => [id, number] as const),
      ...M2_OPERATIONS.map(([number, id]) => [id, number] as const),
      ...M6_OPERATIONS.map(([number, id]) => [id, number] as const),
      ...M4_DISCOVERY_OPERATIONS.map(([number, id]) => [id, number] as const),
    ]);
    expect(numberOf.size).toBe(97);
    for (const [permission, numbers] of ENFORCED_AT) {
      const found = CORE_API_OPERATIONS.filter((operation) => (coreApiAccessPermissions(operation.access) as string[]).includes(permission))
        .map((operation) => numberOf.get(operation.operationId))
        .sort((a, b) => (a ?? 0) - (b ?? 0));
      expect(found, permission).toEqual(numbers);
    }
  });

  it('the conditions on top of a marker: the console rule, a device session, the device credential itself, the demo flag', () => {
    const withCondition = (condition: string) =>
      CORE_API_OPERATIONS.filter((operation) => (operation.access.conditions ?? []).includes(condition as never)).map((operation) => operation.operationId);
    expect(withCondition('CONSOLE_IDENTITY')).toEqual(['signIn']);
    expect(withCondition('DEVICE_SESSION')).toEqual(['setBiometricEnrollment']);
    // Decision D113: operation 23, and operation 8 with the add-on.
    expect(withCondition('DEVICE_CREDENTIAL')).toEqual(['signInWithBiometric', 'rotateDeviceCredential']);
    expect(withCondition('DEMO_FLAG')).toEqual(['getDemoStatus', 'loadScenario', 'injectFault', 'clearFault', 'resetDemo']);
    // Task 3 M2-W7 (`C3 §0`, SEC35-18 deferred to M2): op 81 adds the SESSION_HOLDER condition.
    expect(withCondition('SESSION_HOLDER')).toEqual(['switchAudioSource']);
    // Task 3 R-9 (`C3 §0` erratum PE-121-04, §3.1; D80(3)): the three operations whose body carries a
    // camera credential are web console only — op 89, and ops 95 and 96 of the connect flow.
    expect(withCondition('WEB_CONSOLE_SESSION')).toEqual(['setCaptureDeviceCredential', 'testCaptureCandidateConnection', 'adoptCaptureCandidate']);
    // Thirteen operations carry a condition, each exactly one; the other 84 carry none.
    const conditioned = CORE_API_OPERATIONS.filter((operation) => operation.access.conditions !== undefined);
    expect(conditioned).toHaveLength(13);
    for (const operation of conditioned) expect(operation.access.conditions, operation.operationId).toHaveLength(1);
  });

  it('the marker text is the one of 01_specs §4.2, the any-of included', () => {
    const anyOf: CoreApiAccess = { kind: 'ANY_OF', permissions: [Permission.EVIDENCE_REVIEW, Permission.MAINTENANCE] };
    expect(describeCoreApiAccess(anyOf)).toBe('ANY-OF(EVIDENCE_REVIEW, MAINTENANCE)');
    expect(coreApiAccessPermissions(anyOf)).toEqual(['EVIDENCE_REVIEW', 'MAINTENANCE']);
    expect(describeCoreApiAccess({ kind: 'PUBLIC' })).toBe('PUBLIC');
    expect(coreApiAccessPermissions({ kind: 'DEVICE' })).toEqual([]);
  });

  it('the failed attempts and second outcomes the specification names are in `also`', () => {
    const also = (operationId: string) => findCoreApiOperation(operationId)?.audit.also ?? [];
    expect(also('signIn')).toEqual(['AUTH_FAILED', 'AUTH_LOCKED']);
    expect(also('signInWithBiometric')).toEqual(['AUTH_FAILED', 'AUTH_LOCKED']);
    expect(also('reportBiometricFailure')).toEqual(['AUTH_LOCKED']);
    expect(also('issuePairingCode')).toEqual(['PAIRING_CODE_CLOSED']);
    expect(also('redeemPairingCode')).toEqual(['PAIRING_FAILED', 'PAIRING_LOCKED', 'PAIRING_CODE_CLOSED']);
    expect(also('injectFault')).toEqual(['AUDIT_CHAIN_DISCONTINUITY']);
    // Contract C: the simulated boot of a recovery after a power failure; the failed verdict.
    expect(also('recoverSession')).toEqual(['SYSTEM_BOOT', 'FAULT_CLEARED']);
    expect(also('verifyEvidence')).toEqual(['EVIDENCE_VERIFY_FAILED']);
    // Task 3 M2-W7 (`C3 §5.3`; E-12; OD-22): a camera PoE cycle writes DEVICE_COMMAND plus CAMERA_POE_CYCLED.
    expect(also('restartDevice')).toEqual(['CAMERA_POE_CYCLED']);
    // No other operation of contract C names a second row type.
    const withAlso = CONTRACT_C_OPERATIONS.map(([, id]) => id).filter((id) => also(id).length > 0);
    expect(withAlso).toEqual(['recoverSession', 'verifyEvidence', 'restartDevice']);
  });

  it('NONE-P marks the nine commands whose simulator action writes no audit row: touchSession, seven of areas 4 to 11 and testSttConnection', () => {
    const parity = CONTRACT_C_OPERATIONS.filter(([, , , , , success]) => success === CoreApiAuditNone.PARITY).map(([, id]) => id);
    expect(parity).toEqual(['beginPrecheck', 'retryPrecheck', 'scanCaseNumber', 'setActiveCamera', 'resetMicClip', 'updateSettings', 'acknowledgeAlert']);
    expect(CORE_API_OPERATIONS.filter((operation) => operation.audit.success === CoreApiAuditNone.PARITY).map((operation) => operation.operationId)).toEqual([
      'touchSession',
      ...parity,
      // M6 row 113 (C3 §2.5 op 92): a test of the stored configuration changes no state, so no row.
      'testSttConnection',
    ]);
  });
});

describe('decision D113 (finding CPS1-3): operations 23 and 8 need the device credential itself', () => {
  const DEVICE_OPERATIONS = CORE_API_OPERATIONS.filter((operation) => operation.access.kind === CoreApiAccessKind.DEVICE);
  const rotate = findCoreApiOperation('rotateDeviceCredential')!;
  const biometric = findCoreApiOperation('signInWithBiometric')!;
  const NEEDS_CREDENTIAL = [biometric, rotate];

  it('the vocabulary of conditions has six members, DEVICE_CREDENTIAL among them (C3 §10.1: 5 -> 6 with WEB_CONSOLE_SESSION)', () => {
    expect(Object.values(CoreApiAccessCondition)).toEqual(['CONSOLE_IDENTITY', 'DEVICE_SESSION', 'DEVICE_CREDENTIAL', 'DEMO_FLAG', 'SESSION_HOLDER', 'WEB_CONSOLE_SESSION']);
    expect(Object.keys(CoreApiAccessCondition)).toEqual(Object.values(CoreApiAccessCondition));
    expect(CoreApiAccessCondition.DEVICE_CREDENTIAL).toBe('DEVICE_CREDENTIAL');
    expect(DEVICE_CREDENTIAL_REQUIRED_REASON).toBe('DEVICE_CREDENTIAL_REQUIRED');
  });

  it('operation 23 keeps the marker DEVICE and carries the condition; its audit rule is unchanged', () => {
    expect(rotate.access).toEqual({ kind: 'DEVICE', conditions: ['DEVICE_CREDENTIAL'] });
    expect(describeCoreApiAccess(rotate.access)).toBe('DEVICE');
    expect([rotate.method, rotate.path]).toEqual(['post', '/api/v1/pairing/device/credential']);
    expect(rotate.audit).toEqual({ success: AuditType.DEVICE_CREDENTIAL_ROTATED, denial: AuditType.ACCESS_DENIED });
    expect(isOfflineCoreApiOperation(rotate)).toBe(false);
  });

  it('the condition stands on the marker DEVICE only: on any other marker no caller could hold it', () => {
    // AUTHENTICATED, a permission and the any-of need an OPERATOR; the condition needs the DEVICE.
    for (const operation of CORE_API_OPERATIONS) {
      if (!(operation.access.conditions ?? []).includes(CoreApiAccessCondition.DEVICE_CREDENTIAL)) continue;
      expect(operation.access.kind, operation.operationId).toBe(CoreApiAccessKind.DEVICE);
    }
  });

  it('operation 8 carries the condition too: a session cannot renew itself with a biometric token', () => {
    expect(biometric.access).toEqual({ kind: 'DEVICE', conditions: ['DEVICE_CREDENTIAL'] });
    expect(describeCoreApiAccess(biometric.access)).toBe('DEVICE');
    expect(biometric.audit).toEqual({ success: AuditType.AUTH_SUCCESS, denial: AuditType.ACCESS_DENIED, also: [AuditType.AUTH_FAILED, AuditType.AUTH_LOCKED] });
    expect(biometric.description).toContain('sent with the device credential');
    expect(biometric.description).toContain('renew itself');
  });

  it('the other three DEVICE operations take a session of the device too: they carry no condition', () => {
    // The judgment on each is in implementation/27_contract_c.md ("Follow-up", table F-2).
    expect(DEVICE_OPERATIONS.map((operation) => operation.operationId)).toEqual([
      'signInWithBiometric',
      'reportBiometricFailure',
      'getDeviceRegistration',
      'unpairDevice',
      'rotateDeviceCredential',
    ]);
    for (const operation of DEVICE_OPERATIONS.filter((entry) => !NEEDS_CREDENTIAL.includes(entry))) {
      expect(operation.access, operation.operationId).toEqual({ kind: 'DEVICE' });
    }
  });

  it('the document says what the server answers: 403 DEVICE_NOT_PAIRED with the reason, for a session token of the device', () => {
    for (const text of NEEDS_CREDENTIAL.flatMap((operation) => [operation.description, operation.responses[403]?.description])) {
      expect(text).toContain('DEVICE_NOT_PAIRED');
      expect(text).toContain(`details.reason: ${DEVICE_CREDENTIAL_REQUIRED_REASON}`);
      expect(text).toContain('the device credential itself');
      // The caller of the finding is named: the session of an operator who is signed in on the device.
      expect(text).toContain('he session token of an operator who is signed in on this device');
    }
    // The refusal is not audited, like the other answers DEVICE_NOT_PAIRED; the two audited ones stay named.
    expect(rotate.responses[403]?.description).toContain('no audit row');
    expect(rotate.responses[403]?.description).toContain('DEVICE_REVOKED; one ACCESS_DENIED audit row');
    expect(biometric.responses[403]?.description).toBe(rotate.responses[403]?.description);
    // No other DEVICE operation names the reason: it is refused on operations 8 and 23 only.
    for (const operation of DEVICE_OPERATIONS.filter((entry) => !NEEDS_CREDENTIAL.includes(entry))) {
      expect(operation.description, operation.operationId).not.toContain(DEVICE_CREDENTIAL_REQUIRED_REASON);
      expect(operation.responses[403]?.description, operation.operationId).not.toContain(DEVICE_CREDENTIAL_REQUIRED_REASON);
    }
  });

  it('the example of the refusal is the error envelope with the existing code and the reason', () => {
    const examples = CORE_API_EXAMPLES['rotateDeviceCredential']?.responses[403] ?? {};
    // W83 (gap W32-3, gap W52-1): the refusal of a web console session by the marker joins them, by design.
    expect(Object.keys(examples)).toEqual(['deviceCredentialRequired', 'webConsoleSession', 'deviceRevoked', 'originNotAllowed']);
    const refusal = examples['deviceCredentialRequired']?.value;
    expect(examples['deviceCredentialRequired']?.summary).toBe('A session token of the device instead of the device credential');
    expect(ApiErrorSchema.safeParse(refusal).success).toBe(true);
    expect(refusal).toMatchObject({
      error: { code: 'DEVICE_NOT_PAIRED', message: "This operation needs the device's own credential.", details: { reason: DEVICE_CREDENTIAL_REQUIRED_REASON } },
    });
    expect(CORE_API_EXAMPLES['signInWithBiometric']?.responses[403]).toEqual(examples);
    // The example of no other operation carries the reason.
    for (const [operationId, entry] of Object.entries(CORE_API_EXAMPLES)) {
      if (operationId === 'rotateDeviceCredential' || operationId === 'signInWithBiometric') continue;
      expect(JSON.stringify(entry), operationId).not.toContain(DEVICE_CREDENTIAL_REQUIRED_REASON);
    }
  });
});

describe('answering services and the two scopes (AR-1)', () => {
  it('health is answered by mock-core and by the Core server, every other operation by the Core server', () => {
    for (const operation of CORE_API_OPERATIONS) {
      expect(operation.services.length, operation.operationId).toBeGreaterThan(0);
      if (operation.operationId === 'getServiceHealth') {
        expect(operation.services).toEqual([CoreApiService.MOCK_CORE, CoreApiService.CORE_SERVER]);
      } else {
        expect(operation.services, operation.operationId).toEqual([CoreApiService.CORE_SERVER]);
      }
    }
    expect([CoreApiService.MOCK_CORE, CoreApiService.CORE_SERVER]).toEqual(['dems-mock-core', 'dems-core-server']);
  });

  it('the offline scope is the ten existing operations plus the twenty-one simulated task-3 ones (13 of M2, 3 of M6, 5 of R-9..R-11); the all scope is every one', () => {
    expect(listCoreApiOperations(CoreApiScope.OFFLINE).map((operation) => operation.operationId)).toEqual([
      ...BASELINE.map(([id]) => id),
      ...M2_SIMULATED_IDS,
    ]);
    expect(listCoreApiOperations(CoreApiScope.ALL)).toHaveLength(97);
    expect(listCoreApiOperations()).toHaveLength(97);
    expect(CORE_API_OPERATIONS.filter(isOfflineCoreApiOperation)).toHaveLength(31);
  });

  it('the new tags hold the new areas', () => {
    const byTag = (tag: string) => CORE_API_OPERATIONS.filter((operation) => operation.tag === tag).length;
    expect([byTag(CoreApiTag.IDENTITY), byTag(CoreApiTag.ADMINISTRATION), byTag(CoreApiTag.PAIRING), byTag(CoreApiTag.DEMO)]).toEqual([8, 5, 9, 5]);
    // Areas 4 to 7 extend the four existing tags; areas 8 to 11 have a tag each. Task 3 M2-W7 adds
    // three Session ops (81/82/83), five Evidence ops (84-88) and six Device ops (76-80, 89); M6 row
    // 113 adds three more Device ops (90-92, `C3 §2.5` tag column); R-9..R-11 add five more (93-97,
    // `C3 §2.6` tag column).
    expect([byTag(CoreApiTag.SESSION), byTag(CoreApiTag.EVIDENCE), byTag(CoreApiTag.DEVICE), byTag(CoreApiTag.STORAGE)]).toEqual([4 + 11 + 3, 1 + 4 + 5, 3 + 6 + 6 + 3 + 5, 1 + 2]);
    expect([byTag(CoreApiTag.NETWORK), byTag(CoreApiTag.SECURITY), byTag(CoreApiTag.SYSTEM), byTag(CoreApiTag.ALERTS)]).toEqual([2, 6, 5, 2]);
    expect(byTag(CoreApiTag.SERVICE)).toBe(1);
    expect(byTag(CoreApiTag.REALTIME)).toBe(0);
    expect(Object.values(CoreApiTag).reduce((sum, tag) => sum + byTag(tag), 0)).toBe(97);
  });
});

describe('structure of every entry (API-2, API-3, 01_specs §7.3)', () => {
  it('two methods; a GET has no body; at most one path parameter, named id, with a pattern its example matches', () => {
    for (const operation of CORE_API_OPERATIONS) {
      expect(['get', 'post'], operation.operationId).toContain(operation.method);
      if (operation.method === 'get') expect(operation.requestBody, operation.operationId).toBeUndefined();
      else expect(operation.query, operation.operationId).toBeUndefined();
      expect(operation.path.startsWith('/api/v1/'), operation.operationId).toBe(true);
      const placeholders = operation.path.match(/\{[^}]+\}/g) ?? [];
      expect(placeholders, operation.operationId).toEqual(operation.pathParam ? ['{id}'] : []);
      if (operation.pathParam) {
        expect(CORE_API_EXAMPLES[operation.operationId]?.pathParams?.id, operation.operationId).toMatch(operation.pathParam.pattern);
      }
    }
  });

  it('every schema name exists, and every schema is used by an operation, by another schema or by the socket', () => {
    const used = new Set<string>(['Heartbeat']);
    for (const operation of CORE_API_OPERATIONS) {
      const names = [operation.requestBody?.schema, operation.query?.schema, ...Object.values(operation.responses).map((spec) => spec.schema)];
      for (const name of names) {
        if (name === undefined) continue;
        expect(name in CORE_API_SCHEMAS, `${operation.operationId}: ${name}`).toBe(true);
        used.add(name);
      }
    }
    // Schemas reached only through another one.
    const nested: CoreApiSchemaName[] = [
      'PrecheckItem', 'SessionResource', 'VideoTrackStatus', 'AudioChannelStatus', 'Operator', 'PairingCodeStatus', 'CoreIdentity', 'FaultTarget',
      // Contract C: the media reference of an evidence item, and the two parts of the chain status.
      'EvidenceMediaRef', 'ChainVerifyResult', 'AuditChainLineageEntry',
      // Task 3 M2-W7 (`C3 §2.3`): composite-export options (op 42) and the nested parts of the new
      // request/response shapes — reached only through their parent schema, never named by an operation.
      'EvidenceExportCompositeOptions', 'CaptureConfigCameraUpdate', 'CaptureConfigMicUpdate', 'AudioSourceIntervalEntry', 'SealingProgressStep', 'TranscriptSegment',
      // Task 3 M6 row 113 (`C3 §2.5`): the nested parts of `SttConfig` and of `SttConfigUpdateRequest`.
      'SttLastTest', 'SttCredentialWrite',
      // Task 3 R-9 (`C3 §2.6`): a search and a candidate are parts of `CaptureDiscoveryState` (a
      // search is also the answer of operation 93).
      'CaptureCandidate',
    ];
    for (const name of nested) used.add(name);
    // Changed by design (W22, contract B): the registry also holds the Core state on the wire (the
    // 37 schemas of `state-slices.ts`) and the messages of the socket (the 11 of
    // `realtime-messages.ts`). The socket uses them, and test/api-state-slices.test.ts and
    // test/api-realtime.test.ts hold each one to its use.
    const socket = [...Object.keys(STATE_SCHEMAS), ...Object.keys(REALTIME_SCHEMAS)];
    expect(socket).toHaveLength(39 + 11);
    for (const name of socket) used.add(name);
    expect(Object.keys(CORE_API_SCHEMAS).filter((name) => !used.has(name))).toEqual([]);
    // Changed by design (W27, contract C): 32 schemas of areas 4 to 11 follow, appended. Task 3
    // M2-W7 adds one composite-export options schema to the contract-A block (50 -> 51), one request
    // schema to op 48 in the contract-C block (32 -> 33), and eighteen operation/nested schemas of
    // operations 76-89 at the end. M6 row 113 appends the six STT configuration schemas of 90-92;
    // R-9..R-11 append the eight of operations 93-97.
    expect(Object.keys(CORE_API_SCHEMAS)).toHaveLength(51 + 39 + 11 + 33 + 18 + 6 + 8 + 1); // + EvidenceMediaSessionRequest, the optional body of op 88 (pass D1b, D140)
    // The 51 of contract A stay first and in their order, then the socket's schemas.
    expect(Object.keys(CORE_API_SCHEMAS).slice(51, 51 + 39 + 11)).toEqual(socket);
    expect(Object.keys(CORE_API_SCHEMAS).slice(51 + 39 + 11)).toEqual([
      'SessionMarkerRequest', 'SessionNoteRequest', 'CaseNumberScan', 'PageQuery', 'SessionHistoryPage',
      'EvidenceListQuery', 'EvidencePage', 'EvidenceMediaRef', 'EvidenceDetail', 'EvidenceVerifyResult',
      'DeviceInventory', 'ActiveCameraRequest', 'MicClipResetRequest', 'RestartDeviceRequest',
      'StorageDetail', 'StoragePolicyRequest',
      'NetworkStatus', 'TimeStatus',
      'SecurityStatus', 'AuditListQuery', 'AuditPage', 'ChainVerifyResult', 'AuditChainLineageEntry', 'AuditChainStatus', 'AuditExportRequest', 'AuditExportAccepted', 'EventListQuery', 'EventPage',
      'SystemStatus', 'DiagnosticsRunStarted', 'ServicesRestarted', 'SettingsUpdateRequest',
      'AlertList',
      // Task 3 M2-W7 (`C3 §2.3`): the capture-config, audio-source, sealing-progress, transcript,
      // export-job and media-session schemas of operations 76-89, in CAPTURE_CONFIG/AUDIO_SOURCE/
      // TRANSCRIPT_MEDIA merge order.
      'CaptureConfigCameraUpdate', 'CaptureConfigMicUpdate', 'CaptureConfigUpdateRequest', 'CaptureCameraSourceRequest', 'CaptureCredentialWriteRequest',
      'AudioSourceSwitchRequest', 'AudioSourceState', 'AudioSourceIntervalEntry', 'AudioSourceIntervalPage',
      'SealingProgressStep', 'SealingProgress',
      'TranscriptSegment', 'TranscriptDocument', 'TranscriptRevisionRequest', 'TranscriptRevision', 'TranscriptRevisionPage',
      // + the optional body of operation 88 (pass D1b, ruling D140).
      'EvidenceExportJob', 'EvidenceMediaSessionRequest', 'EvidenceMediaSession',
      // Task 3 M6 row 113 (`C3 §2.5`): the STT configuration schemas of operations 90-92.
      'SttLastTest', 'SttConfig', 'SttCredentialWrite', 'SttConfigUpdateRequest', 'SttConfigUpdateResult', 'SttConnectionTest',
      // Task 3 R-9..R-11 (blueprint row 132, D106; `C3 §2.6`): the schemas of operations 93-97.
      'CaptureDiscoverySearch', 'CaptureCandidate', 'CaptureDiscoveryState', 'CaptureConnectionTestRequest', 'CaptureConnectionTest',
      'CaptureCandidateAdoptRequest', 'CaptureCandidateAdoption', 'CaptureInputScan',
    ]);
    // API-6: a read of contract C answers slices, so two operations answer a slice component directly.
    // Task 3 M2-W7 (`C3 §2.3`, API-6): the six capture-config/credential operations answer the
    // `captureConfig` / `captureDevices` slice schema directly (one zod schema serves socket and REST).
    const answersSlice = CORE_API_OPERATIONS.filter((operation) => Object.values(operation.responses).some((spec) => spec.schema?.endsWith('Slice')));
    expect(answersSlice.map((operation) => operation.operationId)).toEqual([
      'setStoragePolicy', 'updateSettings',
      'getCaptureConfig', 'getCaptureDevices', 'updateCaptureConfig', 'setCaptureCameraSource', 'setPrimaryMic', 'setCaptureDeviceCredential',
    ]);
  });

  it('a success has a schema unless it is 204 or the 202 of the software update; every refusal is the error envelope', () => {
    // Changed by design (W27): 01_specs §7.14 gives `startSoftwareUpdate` a 202 without a body.
    const BODILESS_202 = ['startSoftwareUpdate'];
    for (const operation of CORE_API_OPERATIONS) {
      const statuses = Object.keys(operation.responses).map(Number);
      expect(statuses.filter((status) => status >= 200 && status <= 299).length, operation.operationId).toBeGreaterThan(0);
      for (const status of statuses) {
        const spec = operation.responses[status];
        expect(spec?.description.length, `${operation.operationId} ${status}`).toBeGreaterThan(0);
        if (status === 204) expect(spec?.schema, `${operation.operationId} ${status}`).toBeUndefined();
        else if (status === 202 && BODILESS_202.includes(operation.operationId)) expect(spec?.schema, `${operation.operationId} ${status}`).toBeUndefined();
        else if (status < 300) expect(spec?.schema, `${operation.operationId} ${status}`).toBeDefined();
        else expect(spec?.schema, `${operation.operationId} ${status}`).toBe('ApiError');
      }
    }
    const bodiless = CORE_API_OPERATIONS.filter((operation) => operation.responses[204]).map((operation) => operation.operationId);
    expect(bodiless).toEqual([
      'signOut', 'cancelPairingCode', 'unpairDevice',
      'cancelSession', 'addSessionMarker', 'addSessionNote', 'takeSessionSnapshot', 'acknowledgeSessionSummary',
      'archiveEvidence', 'restartDevice', 'testDeviceSignal', 'identifyDevice', 'setActiveCamera', 'resetMicClip', 'acknowledgeAlert',
      'injectFault', 'clearFault',
    ]);
  });

  it('the status of every success is the one 01_specs §7 gives it', () => {
    const success = (operationId: string) =>
      Object.keys(findCoreApiOperation(operationId)!.responses).map(Number).filter((status) => status < 300).map((status) => [status, findCoreApiOperation(operationId)!.responses[status]?.schema ?? null]);
    const EXPECTED: Record<string, [number, string | null][]> = {
      beginPrecheck: [[202, 'SessionCommandResponse']],
      retryPrecheck: [[202, 'SessionCommandResponse']],
      acknowledgePrecheckWarnings: [[200, 'SessionCommandResponse']],
      cancelSession: [[204, null]],
      scanCaseNumber: [[200, 'CaseNumberScan']],
      recoverSession: [[202, 'SessionCommandResponse']],
      addSessionMarker: [[204, null]],
      addSessionNote: [[204, null]],
      takeSessionSnapshot: [[204, null]],
      acknowledgeSessionSummary: [[204, null]],
      listSessionHistory: [[200, 'SessionHistoryPage']],
      listEvidence: [[200, 'EvidencePage']],
      getEvidence: [[200, 'EvidenceDetail']],
      verifyEvidence: [[200, 'EvidenceVerifyResult']],
      archiveEvidence: [[204, null]],
      getDeviceInventory: [[200, 'DeviceInventory']],
      restartDevice: [[204, null]],
      testDeviceSignal: [[204, null]],
      identifyDevice: [[204, null]],
      setActiveCamera: [[204, null]],
      resetMicClip: [[204, null]],
      getStorageDetail: [[200, 'StorageDetail']],
      setStoragePolicy: [[200, 'StoragePolicySlice']],
      getNetworkStatus: [[200, 'NetworkStatus']],
      getTimeStatus: [[200, 'TimeStatus']],
      getSecurityStatus: [[200, 'SecurityStatus']],
      listAuditRows: [[200, 'AuditPage']],
      verifyAuditChain: [[200, 'AuditChainStatus']],
      exportAudit: [[202, 'AuditExportAccepted']],
      exportLogs: [[202, 'AuditExportAccepted']],
      listEvents: [[200, 'EventPage']],
      getSystemStatus: [[200, 'SystemStatus']],
      runDiagnostics: [[202, 'DiagnosticsRunStarted']],
      restartServices: [[200, 'ServicesRestarted']],
      startSoftwareUpdate: [[202, null]],
      updateSettings: [[200, 'SettingsSlice']],
      listAlerts: [[200, 'AlertList']],
      acknowledgeAlert: [[204, null]],
    };
    expect(Object.keys(EXPECTED)).toEqual(CONTRACT_C_OPERATIONS.map(([, id]) => id));
    for (const [operationId, expected] of Object.entries(EXPECTED)) expect(success(operationId), operationId).toEqual(expected);
  });

  it('the specific refusals of 01_specs §7.8 to §7.15: 404 for an unknown resource, 409 for a state conflict', () => {
    const specific = (operationId: string) =>
      Object.keys(findCoreApiOperation(operationId)!.responses).map(Number).filter((status) => status === 404 || status === 409);
    const EXPECTED: Record<string, number[]> = {
      beginPrecheck: [404, 409], retryPrecheck: [404, 409], acknowledgePrecheckWarnings: [404, 409], cancelSession: [404, 409],
      recoverSession: [404, 409], addSessionMarker: [404, 409], addSessionNote: [404, 409], takeSessionSnapshot: [404, 409],
      getEvidence: [404], verifyEvidence: [404], archiveEvidence: [404, 409],
      restartDevice: [404, 409], testDeviceSignal: [404, 409], identifyDevice: [404],
      restartServices: [409], startSoftwareUpdate: [409],
    };
    for (const [, operationId] of CONTRACT_C_OPERATIONS) expect(specific(operationId), operationId).toEqual(EXPECTED[operationId] ?? []);
    // The codes each 409 names, as the hosted simulator action raises them (01_specs §7.2).
    const codes = (operationId: string) => findCoreApiOperation(operationId)!.responses[409]?.description.match(/[A-Z][A-Z_]{4,}/g) ?? [];
    expect(codes('restartDevice')).toEqual(['RECORDING_ACTIVE', 'COMMAND_UNSUPPORTED', 'CAMERA_NOT_LOST']);
    expect(codes('testDeviceSignal')).toEqual(['COMMAND_UNSUPPORTED']);
    expect(codes('archiveEvidence')).toEqual(['RECORDED', 'NOT_SEALED']);
    expect(codes('restartServices')).toEqual(['SESSION_ACTIVE']);
    expect(codes('startSoftwareUpdate')).toEqual(['SESSION_ACTIVE']);
    expect(codes('retryPrecheck')).toEqual(['PRECHECK', 'INVALID_STATE', 'PRECHECK_RUNNING']);
    // The two exports answer 422 INVALID_REASON for a reason that is too short.
    for (const id of ['exportAudit', 'exportLogs']) expect(findCoreApiOperation(id)!.responses[422]?.description, id).toContain('INVALID_REASON');
  });

  it('a new operation documents the common refusals of 01_specs §7.3 that its own rules can produce', () => {
    for (const operation of CORE_API_OPERATIONS.slice(10)) {
      const documented = (status: number) => operation.responses[status] !== undefined;
      // 403: the Origin guard applies to every one of them.
      expect(documented(403), `${operation.operationId} 403`).toBe(true);
      if (operation.access.kind !== CoreApiAccessKind.PUBLIC) expect(documented(401), `${operation.operationId} 401`).toBe(true);
      if (operation.access.kind === CoreApiAccessKind.PERMISSION) {
        expect(operation.responses[403]?.description, operation.operationId).toContain(`${operation.access.permission} (NOT_PERMITTED`);
      }
      if (operation.access.kind === CoreApiAccessKind.ANY_OF) {
        for (const permission of operation.access.permissions) expect(operation.responses[403]?.description, operation.operationId).toContain(permission);
        expect(operation.responses[403]?.description, operation.operationId).toContain('(NOT_PERMITTED');
      }
      expect(documented(400), `${operation.operationId} 400`).toBe(operation.requestBody !== undefined);
      // Changed by design (W27; SR-64): a query and a path parameter are validated like a body, so an
      // operation with either documents 422 too. Contract A had no operation with a query, and none
      // with a path parameter and no body.
      const validated = operation.requestBody !== undefined || operation.query !== undefined || operation.pathParam !== undefined;
      expect(documented(422), `${operation.operationId} 422`).toBe(validated);
      // Never per operation: these are defined once (CORE_API_ENVELOPE_RESPONSES).
      for (const status of [405, 413, 429, 500, 503]) expect(documented(status), `${operation.operationId} ${status}`).toBe(false);
    }
    const demo = CORE_API_OPERATIONS.filter((operation) => operation.tag === CoreApiTag.DEMO);
    for (const operation of demo) expect(operation.responses[403]?.description, operation.operationId).toContain('DEMO_DISABLED');
  });

  it('the description of a new operation never repeats the stale mock-core sentence (KI-18)', () => {
    for (const operation of CORE_API_OPERATIONS.slice(10)) {
      expect(operation.description, operation.operationId).not.toMatch(/mock-core|4400|simulated in the browser/i);
      // Only a LIVE operation is Core-server-only. Task 3's thirteen simulated capture/transcript
      // operations are answered by the in-app simulator too (OD-17), so they do not carry that phrase;
      // op 88 (live) does. `C3 §8`.
      if (operation.mode === CoreApiMode.LIVE) expect(operation.description, operation.operationId).toContain('Core server only');
      // Contract A/C sources cite the design book; task 3 M2-W7 cites C3 §2.2 and the register instead.
      // Task 3 M6 (row 113) cites C3 §2.5 the same way. All forms name their origin and an operation
      // number; matched without depending on § spacing.
      expect(operation.source, operation.operationId).toMatch(/^(Backend task 2026-10-04|Task 3 M2-W7|Task 3 M6|Task 3 R-(?:9|10),)/);
      expect(operation.source, operation.operationId).toMatch(/operation \d+/);
    }
    const secret = CORE_API_OPERATIONS.filter((operation) => operation.description.includes('holds a secret')).map((operation) => operation.operationId);
    // The six operations of 01_specs §7.7 whose body or answer holds a secret (AR-3a).
    expect(secret).toEqual(['signIn', 'setBiometricEnrollment', 'signInWithBiometric', 'issuePairingCode', 'redeemPairingCode', 'rotateDeviceCredential']);
  });
});

describe('routing over 97 operations', () => {
  it('a concrete path of one operation matches that operation and no other route', () => {
    for (const operation of CORE_API_OPERATIONS) {
      const path = concretePath(operation);
      expect(path, operation.operationId).not.toContain('MISSING');
      const match = matchCoreApiOperation(operation.method.toUpperCase(), path);
      expect(match?.operation.operationId, `${operation.method} ${path}`).toBe(operation.operationId);
      for (const other of CORE_API_OPERATIONS) {
        if (other === operation || other.method !== operation.method) continue;
        const pattern = new RegExp(`^${other.path.replace(/[.*+?^$()|[\]\\]/g, '\\$&').replace(/\{id\}/g, '[^/]+')}$`);
        expect(pattern.test(path), `${path} also matches ${other.operationId}`).toBe(false);
      }
    }
  });

  it('one path may carry both methods: the pairing code is issued by POST and read by GET', () => {
    expect(matchCoreApiOperation('POST', '/api/v1/pairing/code')?.operation.operationId).toBe('issuePairingCode');
    expect(matchCoreApiOperation('GET', '/api/v1/pairing/code')?.operation.operationId).toBe('getPairingCodeStatus');
    expect(matchCoreApiOperation('GET', '/api/v1/pairing/code/cancel')).toBeNull();
    expect(matchCoreApiOperation('POST', '/api/v1/admin/users/OPR-003/role')?.params).toEqual({ id: 'OPR-003' });
  });

  it('the literal routes of areas 4 to 11 never match a templated one', () => {
    const id = (method: string, path: string) => matchCoreApiOperation(method, path)?.operation.operationId ?? null;
    // `case-number`, `current` and `history` are literal segments where other routes have `{id}`.
    expect(id('POST', '/api/v1/session/case-number')).toBe('scanCaseNumber');
    expect(id('GET', '/api/v1/session/history')).toBe('listSessionHistory');
    expect(id('GET', '/api/v1/session/current')).toBe('getCurrentSession');
    expect(id('POST', '/api/v1/session/SES-20261001-0024/precheck')).toBe('beginPrecheck');
    expect(id('POST', '/api/v1/session/SES-20261001-0024/precheck/retry')).toBe('retryPrecheck');
    expect(id('POST', '/api/v1/session/SES-20261001-0024/summary/acknowledge')).toBe('acknowledgeSessionSummary');
    // The list and the item of evidence differ in length; the three evidence commands in their last segment.
    expect(id('GET', '/api/v1/evidence')).toBe('listEvidence');
    expect(id('GET', '/api/v1/evidence/EV-20260930-0004')).toBe('getEvidence');
    expect(id('POST', '/api/v1/evidence/EV-20260930-0004/verify')).toBe('verifyEvidence');
    expect(id('POST', '/api/v1/evidence/EV-20260930-0004/export')).toBe('exportEvidence');
    expect(id('GET', '/api/v1/device/health')).toBe('getDeviceHealth');
    expect(id('GET', '/api/v1/device/inventory')).toBe('getDeviceInventory');
    expect(id('POST', '/api/v1/device/FRONT-PANEL/identify')).toBe('identifyDevice');
    expect(id('GET', '/api/v1/audit')).toBe('listAuditRows');
    expect(id('GET', '/api/v1/audit/chain')).toBe('verifyAuditChain');
    expect(id('POST', '/api/v1/audit/export')).toBe('exportAudit');
    // A read has no POST and a command has no GET.
    expect(id('POST', '/api/v1/audit/chain')).toBeNull();
    expect(id('GET', '/api/v1/session/SES-20261001-0024/precheck')).toBeNull();
    // 01_specs §11: no route serves media or a file.
    for (const path of ['/api/v1/evidence/EV-20260930-0004/media', '/api/v1/evidence/EV-20260930-0004/tracks/VIDEO-01', '/api/v1/media', '/api/v1/audit/export/EXP-000032']) {
      expect(id('GET', path), path).toBeNull();
    }
    // 01_specs §11: no registry route serves media or a file. Task 3 M2-W7 adds op 88
    // `createEvidenceMediaSession` (`/evidence/{id}/media-sessions`), which only ISSUES a short-lived
    // signed URL; the byte-serving route stays registry-external like `/ws` (`C3 §2.4`; E-31). The
    // session-issuer is therefore allowed; any real media/file/download/upload route is still refused.
    expect(CORE_API_OPERATIONS.filter((operation) => /media|file|download|upload/i.test(operation.path) && !operation.path.endsWith('/media-sessions'))).toEqual([]);
  });
});

// ── D36, contract gap 1: the table with literal types ────────────────────────────────────────────

type Table = typeof CORE_API_OPERATION_TABLE;

const noAnswer: CoreFetch = async () => ({ status: 204, headers: { get: () => null }, text: async () => '' });

describe('contract gap 1: CORE_API_OPERATION_TABLE is the table with literal types', () => {
  it('is the same array as CORE_API_OPERATIONS, which stays the widened view', () => {
    expect(CORE_API_OPERATION_TABLE).toBe(CORE_API_OPERATIONS);
    expectTypeOf(CORE_API_OPERATIONS).toEqualTypeOf<readonly CoreApiRegistryOperation[]>();
    expectTypeOf<Table>().toExtend<readonly CoreApiRegistryOperation[]>();
    expectTypeOf<Table>().toExtend<readonly CoreApiOperation[]>();
    expectTypeOf<Table['length']>().toEqualTypeOf<97>();
    expectTypeOf<Table[0]['operationId']>().toEqualTypeOf<'getServiceHealth'>();
    expectTypeOf<Table[10]['operationId']>().toEqualTypeOf<'signIn'>();
    // Areas 4 to 11 sit between pairing and the demo controls, which stay last.
    expectTypeOf<Table[32]['operationId']>().toEqualTypeOf<'beginPrecheck'>();
    expectTypeOf<Table[69]['operationId']>().toEqualTypeOf<'acknowledgeAlert'>();
    expectTypeOf<Table[74]['path']>().toEqualTypeOf<'/api/v1/demo/reset'>();
    // Task 3 M2-W7 appends operations 76-89 after the demo controls (`C3 §2.2`).
    expectTypeOf<Table[75]['operationId']>().toEqualTypeOf<'getCaptureConfig'>();
    expectTypeOf<Table[79]['operationId']>().toEqualTypeOf<'setPrimaryMic'>();
    expectTypeOf<Table[87]['operationId']>().toEqualTypeOf<'createEvidenceMediaSession'>();
    expectTypeOf<Table[88]['operationId']>().toEqualTypeOf<'setCaptureDeviceCredential'>();
    // Task 3 M6 row 113 appends operations 90-92 after op 89 (`C3 §2.5`).
    expectTypeOf<Table[89]['operationId']>().toEqualTypeOf<'getSttConfig'>();
    expectTypeOf<Table[91]['path']>().toEqualTypeOf<'/api/v1/transcription/config/test'>();
    // Task 3 R-9..R-11 (row 132, D106) append operations 93-97 after op 92 (`C3 §2.6`).
    expectTypeOf<Table[92]['operationId']>().toEqualTypeOf<'startCaptureDiscovery'>();
    expectTypeOf<Table[93]['operationId']>().toEqualTypeOf<'getCaptureDiscovery'>();
    expectTypeOf<Table[96]['path']>().toEqualTypeOf<'/api/v1/capture/inputs/rescan'>();
  });

  it('gives the typed client one typed call per operation', async () => {
    type Id = CoreOperationId<Table>;
    expectTypeOf<'signIn'>().toExtend<Id>();
    expectTypeOf<'resetDemo'>().toExtend<Id>();
    expectTypeOf<'noSuchOperation'>().not.toExtend<Id>();
    expectTypeOf<string>().not.toExtend<Id>();

    expectTypeOf<CoreCallInput<Table, 'signIn'>['body']>().toEqualTypeOf<SignInRequest>();
    expectTypeOf<CoreCallInput<Table, 'assignUserRole'>['params']>().toEqualTypeOf<{ readonly id: string }>();
    expectTypeOf<CoreCallInput<Table, 'assignUserRole'>['body']>().toEqualTypeOf<UserRoleRequest>();
    expectTypeOf<CoreCallInput<Table, 'getRoleMatrix'>['body']>().toEqualTypeOf<undefined>();
    expectTypeOf<CoreCallSuccessOf<Table, 'assignUserRole'>>().toEqualTypeOf<CoreCallSuccess<200, AdminUser>>();
    expectTypeOf<CoreCallSuccessOf<Table, 'redeemPairingCode'>>().toEqualTypeOf<CoreCallSuccess<201, PairingRedeemed>>();
    // A success without a body has no data.
    expectTypeOf<CoreCallSuccessOf<Table, 'signOut'>>().toEqualTypeOf<CoreCallSuccess<204, undefined>>();

    // Contract C: a body, an optional body, a path parameter without a body, a query, a slice as the answer.
    expectTypeOf<'verifyAuditChain'>().toExtend<Id>();
    expectTypeOf<CoreCallInput<Table, 'addSessionNote'>['body']>().toEqualTypeOf<SessionNoteRequest>();
    expectTypeOf<CoreCallInput<Table, 'addSessionNote'>['params']>().toEqualTypeOf<{ readonly id: string }>();
    expectTypeOf<CoreCallInput<Table, 'setStoragePolicy'>['body']>().toEqualTypeOf<StoragePolicyRequest>();
    expectTypeOf<CoreCallInput<Table, 'cancelSession'>['body']>().toEqualTypeOf<undefined>();
    expectTypeOf<CoreCallSuccessOf<Table, 'cancelSession'>>().toEqualTypeOf<CoreCallSuccess<204, undefined>>();
    expectTypeOf<CoreCallSuccessOf<Table, 'startSoftwareUpdate'>>().toEqualTypeOf<CoreCallSuccess<202, undefined>>();
    expectTypeOf<CoreCallSuccessOf<Table, 'listEvidence'>>().toEqualTypeOf<CoreCallSuccess<200, EvidencePage>>();
    expectTypeOf<CoreCallSuccessOf<Table, 'setStoragePolicy'>>().toEqualTypeOf<CoreCallSuccess<200, StoragePolicySliceBody>>();
    // A query schema types the query: the members of the schema, and `limit` as a number or its decimal text.
    type AuditQuery = NonNullable<CoreCallInput<Table, 'listAuditRows'>['query']>;
    expectTypeOf<AuditQuery['order']>().toEqualTypeOf<AuditListQuery['order']>();
    expectTypeOf<AuditQuery['limit']>().toEqualTypeOf<number | string | undefined>();
    expectTypeOf<AuditListQuery['limit']>().toEqualTypeOf<number | undefined>();

    const client = createCoreClient({ baseUrl: 'http://127.0.0.1:4420', credentials: 'browser-cookie', fetch: noAnswer, operations: CORE_API_OPERATION_TABLE });
    // AC-C-01: the callable operation count of the typed client is the registry's, 97.
    expect(client.operationIds).toHaveLength(97);
    expect(client.operationIds).toEqual(CORE_API_OPERATIONS.map((operation) => operation.operationId));
    const signedOut = await client.call('signOut', { body: { reason: 'LOCK' } });
    expectTypeOf(signedOut).toEqualTypeOf<CoreCallSuccess<204, undefined> | CoreCallFailure>();
    expect(signedOut).toMatchObject({ ok: true, status: 204, data: undefined });
    // An optional body: the input itself is optional.
    expect(await client.call('unpairDevice')).toMatchObject({ ok: true, status: 204 });
    // Contract C, through the literal table: a path parameter and a body; a path parameter alone.
    expect(await client.call('addSessionNote', { params: { id: 'SES-20261001-0024' }, body: { text: 'Subject confirms the statement.' } })).toMatchObject({
      ok: true,
      status: 204,
    });
    expect(await client.call('acknowledgeAlert', { params: { id: 'ALR-000001' } })).toMatchObject({ ok: true, status: 204 });

    // Never run: each line must be a compile error.
    const misuse = (): void => {
      // @ts-expect-error an ID the registry does not hold
      void client.call('noSuchOperation');
      // @ts-expect-error the path parameter is required
      void client.call('revokeDevice', { body: { reason: 'Lost tablet' } });
      // @ts-expect-error a required body is required
      void client.call('signIn');
      // @ts-expect-error the body has the type of its schema
      void client.call('assignUserRole', { params: { id: 'OPR-003' }, body: { role: 'ADMIN' } });
      // @ts-expect-error a query member has the type of its schema
      void client.call('listAuditRows', { query: { order: 'NEWEST' } });
      // @ts-expect-error the path parameter of a command without a body is required
      void client.call('cancelSession');
    };
    void misuse;
  });
});

describe('the typed client calls all 97 operations (AC-C-01)', () => {
  it('returns every documented example as a success or as the error envelope, a success without a body included', async () => {
    // The widened view on purpose: the loop passes operation IDs as plain strings.
    const operations: readonly CoreApiOperation[] = CORE_API_OPERATIONS;
    let exchanges = 0;
    for (const operation of CORE_API_OPERATIONS) {
      const examples = CORE_API_EXAMPLES[operation.operationId];
      expect(examples, operation.operationId).toBeDefined();
      const request = examples?.request ? Object.values(examples.request)[0]?.value : undefined;
      const input = { ...(examples?.pathParams ? { params: examples.pathParams } : {}), ...(request !== undefined ? { body: request } : {}) };
      for (const status of Object.keys(operation.responses).map(Number)) {
        const spec = operation.responses[status];
        const body = spec?.schema ? Object.values(examples?.responses[status] ?? {})[0]?.value : undefined;
        if (spec?.schema) expect(body, `${operation.operationId} ${status} has an example`).toBeDefined();
        const fetch: CoreFetch = async () => ({
          status,
          headers: { get: () => null },
          text: async () => (body === undefined ? '' : JSON.stringify(body)),
        });
        const client = createCoreClient({ baseUrl: 'http://127.0.0.1:4420', credentials: () => null, fetch, operations });
        const result = await client.call(operation.operationId, input);
        exchanges += 1;
        if (status < 300) {
          expect(result, `${operation.operationId} ${status}`).toMatchObject({ ok: true, status });
          if (result.ok && spec?.schema) expect(result.data).toEqual(CORE_API_SCHEMAS[spec.schema].parse(body));
          if (result.ok && !spec?.schema) expect(result.data).toBeUndefined();
        } else {
          expect(result, `${operation.operationId} ${status}`).toMatchObject({ ok: false, status });
          if (!result.ok) expect(result.error).toEqual(ApiErrorSchema.parse(body).error);
        }
      }
    }
    expect(exchanges).toBe(CORE_API_OPERATIONS.reduce((sum, operation) => sum + Object.keys(operation.responses).length, 0));
    expect(exchanges).toBeGreaterThan(330);
  });

  it('a list read sends the query its schema parses, and nothing when the caller gives none', async () => {
    const urls: string[] = [];
    const fetch: CoreFetch = async (url) => {
      urls.push(String(url));
      return { status: 401, headers: { get: () => null }, text: async () => JSON.stringify({ error: { code: 'NOT_SIGNED_IN', message: 'Sign in first.' } }) };
    };
    const operations: readonly CoreApiOperation[] = CORE_API_OPERATIONS;
    const client = createCoreClient({ baseUrl: 'http://127.0.0.1:4420', credentials: 'browser-cookie', fetch, operations });
    await client.call('listEvidence');
    await client.call('listEvidence', { query: { status: 'SEALED', q: '  0930-0004 ', limit: 20 } });
    await client.call('listAuditRows', { query: { order: 'DESC', actorId: 'OPR-002', cursor: '81', limit: '200' } });
    await client.call('listSessionHistory', { query: { limit: 5, stray: 'x' } });
    expect(urls).toEqual([
      'http://127.0.0.1:4420/api/v1/evidence',
      'http://127.0.0.1:4420/api/v1/evidence?status=SEALED&q=0930-0004&limit=20',
      'http://127.0.0.1:4420/api/v1/audit?actorId=OPR-002&order=DESC&cursor=81&limit=200',
      'http://127.0.0.1:4420/api/v1/session/history?limit=5',
    ]);
    // A query the schema refuses is a programming error, before any request.
    for (const query of [{ limit: 201 }, { limit: 0 }, { status: 'OPEN' }, { cursor: 'ses_abc' }, { q: '' }]) {
      await expect(client.call('listEvidence', { query }), JSON.stringify(query)).rejects.toThrow(/does not match EvidenceListQuery/);
    }
    expect(urls).toHaveLength(4);
  });
});

// ── D36, contract gap 2: the `query` member ──────────────────────────────────────────────────────

describe('contract gap 2: an operation may name a query schema', () => {
  const LIST = [
    {
      operationId: 'listThings',
      method: 'get',
      path: '/api/v1/things',
      tag: CoreApiTag.SERVICE,
      mode: CoreApiMode.LIVE,
      summary: 'test',
      description: 'test',
      source: 'test',
      query: { schema: 'SessionStartRequest' },
      responses: { 200: { description: 'ok', schema: 'SessionCommandResponse' } },
    },
  ] as const satisfies readonly CoreApiOperation[];

  it('the model accepts `query: { schema }` and the typed client types the query from that schema', () => {
    expectTypeOf<NonNullable<CoreApiOperation['query']>>().toEqualTypeOf<{ schema: CoreApiSchemaName }>();
    expectTypeOf<CoreCallInput<typeof LIST, 'listThings'>['query']>().toEqualTypeOf<{ acknowledgeWarnings?: boolean | undefined } | undefined>();
    expect(LIST[0].query.schema in CORE_API_SCHEMAS).toBe(true);
    // Changed by design (W27): contract C brings the list reads. Task 3 M2-W7 adds two more (ops 82
    // and 86, both `PageQuery`). Six operations name a query schema.
    expect(CORE_API_OPERATIONS.filter((operation) => operation.query).map((operation) => [operation.operationId, operation.query?.schema])).toEqual([
      ['listSessionHistory', 'PageQuery'],
      ['listEvidence', 'EvidenceListQuery'],
      ['listAuditRows', 'AuditListQuery'],
      ['listEvents', 'EventListQuery'],
      ['listAudioSourceIntervals', 'PageQuery'],
      ['listTranscriptRevisions', 'PageQuery'],
    ]);
  });
});
