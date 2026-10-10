/**
 * Camera search, connection test, adoption and the local-input re-read: operations 93 to 97 of the
 * Core API (task 3, requirements R-9, R-10, R-11; blueprint rows 132, 133, 142; decision D106:
 * row 132 lands the shared contract of all five; `masterplan/03_api_contract.md` (C3) §2.6, §4
 * erratum PE-121-08, §5.2, §7, §10.1).
 *
 * | # | operationId | Access | Audit on success |
 * |--:|-------------|--------|------------------|
 * | 93 | `startCaptureDiscovery` | CAPTURE_CONFIG (web, tablet, phone) | CAPTURE_DISCOVERY_SEARCHED, once, when the window closes |
 * | 94 | `getCaptureDiscovery` | CAPTURE_CONFIG; the owner session only | NONE-R |
 * | 95 | `testCaptureCandidateConnection` | CAPTURE_CONFIG + WEB_CONSOLE_SESSION | CAPTURE_CONNECTION_TESTED, every outcome |
 * | 96 | `adoptCaptureCandidate` | CAPTURE_CONFIG + WEB_CONSOLE_SESSION | CAPTURE_CANDIDATE_ADOPTED (+ CAPTURE_CONNECTION_TESTED, + CAPTURE_CREDENTIAL_SET) |
 * | 97 | `rescanCaptureInputs` | CAPTURE_CONFIG (web, tablet, phone) | CAPTURE_DISCOVERY_SEARCHED with `scope: MIC_LOCAL` |
 *
 * WHAT A CANDIDATE IS. A device that answered a search. It lives in the Core's memory as data of
 * ONE operator session, it is no capture device, and it is in no slice: only its owner session
 * reads it (94) or acts on it (95, 96). A `capture_devices` row comes into being in the commit of
 * operation 96 and nowhere else.
 *
 * NO SECRET IN ANY SHAPE. The response shapes of this file hold no `username`, no `secret`, no
 * credential-bearing URL and no member derived from either. The only credential-carrying members
 * are the REQUEST member `credential` of 95 and 96 (and the body of operation 89): write-only,
 * alive for one request, never stored in the candidate state, never logged, never audited.
 *
 * NO CALLER-SUPPLIED TARGET. No request of this file has an address, a host, a port, a URL, a
 * path, a subnet, an interface, a timeout or a filter member. A search always probes the fixed
 * WS-Discovery group; a test and an adoption name a candidate id, and the Core takes the address
 * from its own search state (R-9 AC-10).
 */
import { z } from 'zod';
import { AuditType, Permission } from '../sim/vocabulary';
import {
  CAPTURE_CANDIDATE_ID_PATTERN,
  CAPTURE_CANDIDATE_TEXT_MAX_LENGTH,
  CAPTURE_DISCOVERY_MAX_CANDIDATES,
  CAPTURE_SEARCH_ID_PATTERN,
} from './capture';
import { API_BASE_PATH } from './constants';
import {
  CORE_SERVER_ONLY,
  CoreApiAccessCondition,
  CoreApiAuditNone,
  CoreApiMode,
  CoreApiTag,
  WEB_CONSOLE_ONLY_REASON,
  permissionAccess,
  type CoreApiRegistryOperation,
} from './contract-model';
import { CaptureCredentialWriteRequestSchema, type CaptureCredentialWriteRequest } from './devices';
import { ERROR_EXAMPLES, EXAMPLE_INSTANT_MS, apiErrorExample, deniedExamples } from './example-parts';
import type { OperationExamples } from './examples';
import { INVALID_JSON, NOT_SIGNED_IN, SIM_V2_NOTE, notPermitted } from './operation-parts';
import { HARDWARE_DEVICE_ID_PATTERN, MIC_INPUT_ID_PATTERN } from './patterns';
import { count, epochMs } from './schema-parts';
import { EXAMPLE_SLICES } from './state-examples';
import { CaptureDeviceStatusSchema } from './state-slices';
import { apiText } from './text';

// ═══════════════════════════════════════════════════════════════════════════════════════
// Value sets
// ═══════════════════════════════════════════════════════════════════════════════════════

/**
 * The API class of a source (C3 §2.6 "Device shapes"; D80(9)): `DEVELOPMENT` exactly when the
 * adapter kind is `LOCAL_DEVICE` or `FAKE`. Derived by the Core from the adapter kind; a client
 * never sets it. (The manifest class of the evidence package is another, three-valued set.)
 */
export const CaptureSourceClass = { PRODUCTION: 'PRODUCTION', DEVELOPMENT: 'DEVELOPMENT' } as const;
export type CaptureSourceClass = (typeof CaptureSourceClass)[keyof typeof CaptureSourceClass];

/** What a search looked for: cameras on the network (93, the pre-check) or the local inputs (97). */
export const CaptureDiscoveryScope = { CAMERA_NETWORK: 'CAMERA_NETWORK', MIC_LOCAL: 'MIC_LOCAL' } as const;
export type CaptureDiscoveryScope = (typeof CaptureDiscoveryScope)[keyof typeof CaptureDiscoveryScope];

/** Who started a search: an operator (93) or a pre-check run with an unreachable camera. Nothing else starts one. */
export const CaptureDiscoveryTrigger = { MANUAL: 'MANUAL', PRECHECK: 'PRECHECK' } as const;
export type CaptureDiscoveryTrigger = (typeof CaptureDiscoveryTrigger)[keyof typeof CaptureDiscoveryTrigger];

/** `FAILED` is "the search could not run"; it is never an empty list (`cap` DS-13). */
export const CaptureDiscoveryState = { RUNNING: 'RUNNING', COMPLETE: 'COMPLETE', FAILED: 'FAILED' } as const;
export type CaptureDiscoveryState = (typeof CaptureDiscoveryState)[keyof typeof CaptureDiscoveryState];

export const CaptureCandidateStatus = { NEW: 'NEW', REGISTERED: 'REGISTERED' } as const;
export type CaptureCandidateStatus = (typeof CaptureCandidateStatus)[keyof typeof CaptureCandidateStatus];

/** The five outcomes of a connection test, exactly (R-9 AC-6; D80(11)). A failed test is a 200 result. */
export const CaptureConnectionOutcome = {
  REACHABLE: 'REACHABLE',
  AUTHENTICATION_FAILED: 'AUTHENTICATION_FAILED',
  WRONG_PROFILE: 'WRONG_PROFILE',
  NOT_H264: 'NOT_H264',
  UNREACHABLE: 'UNREACHABLE',
} as const;
export type CaptureConnectionOutcome = (typeof CaptureConnectionOutcome)[keyof typeof CaptureConnectionOutcome];

/** The named cause of a local input that cannot be opened (`cap` §A.6.4 HL-10; erratum PE-128-35). */
export const CaptureInputErrorCode = {
  PERMISSION_DENIED: 'PERMISSION_DENIED',
  DEVICE_BUSY: 'DEVICE_BUSY',
  DEVICE_NOT_FOUND: 'DEVICE_NOT_FOUND',
  OPEN_FAILED: 'OPEN_FAILED',
  HELPER_EXITED: 'HELPER_EXITED',
} as const;
export type CaptureInputErrorCode = (typeof CaptureInputErrorCode)[keyof typeof CaptureInputErrorCode];

/**
 * `details.reason` of the refusals of operations 93 to 97 (C3 §4, erratum PE-121-08). No new
 * error code: each is a reason on an existing code. `WEB_CONSOLE_ONLY` is `WEB_CONSOLE_ONLY_REASON`
 * of the contract model; `CREDENTIAL_STORE_NOT_READY` is the value operation 91 already uses.
 */
export const CaptureDiscoveryReason = {
  // 409 INVALID_STATE
  DISCOVERY_IN_PROGRESS: 'DISCOVERY_IN_PROGRESS',
  DISCOVERY_NOT_ALLOWED_WHILE_RECORDING: 'DISCOVERY_NOT_ALLOWED_WHILE_RECORDING',
  CANDIDATE_ALREADY_REGISTERED: 'CANDIDATE_ALREADY_REGISTERED',
  CANDIDATE_NOT_TESTABLE: 'CANDIDATE_NOT_TESTABLE',
  CANDIDATE_NOT_TESTED: 'CANDIDATE_NOT_TESTED',
  CONNECTION_TEST_FAILED: 'CONNECTION_TEST_FAILED',
  CONNECTION_TEST_IN_PROGRESS: 'CONNECTION_TEST_IN_PROGRESS',
  // 422 INVALID_INPUT
  CREDENTIAL_REQUIRED: 'CREDENTIAL_REQUIRED',
  CREDENTIAL_NOT_EXPECTED: 'CREDENTIAL_NOT_EXPECTED',
  // 429 RATE_LIMITED
  DISCOVERY_RATE_LIMITED: 'DISCOVERY_RATE_LIMITED',
  CONNECTION_TEST_RATE_LIMITED: 'CONNECTION_TEST_RATE_LIMITED',
  CONNECTION_TEST_LOCKOUT_GUARD: 'CONNECTION_TEST_LOCKOUT_GUARD',
  INPUT_RESCAN_RATE_LIMITED: 'INPUT_RESCAN_RATE_LIMITED',
  // 503 NOT_READY
  DISCOVERY_NOT_READY: 'DISCOVERY_NOT_READY',
  CAPTURE_NOT_READY: 'CAPTURE_NOT_READY',
  CREDENTIAL_STORE_NOT_READY: 'CREDENTIAL_STORE_NOT_READY',
} as const;
export type CaptureDiscoveryReason = (typeof CaptureDiscoveryReason)[keyof typeof CaptureDiscoveryReason];

/** `details.cause` of `409 CONNECTION_TEST_FAILED` when the re-verification read other profiles than the test (SEC35-47). */
export const CAPTURE_DEVICE_CHANGED_CAUSE = 'DEVICE_CHANGED';

/** The adapter kind as a machine code (`dbc-4` §N.2): `ONVIF_RTSP` or `FAKE` for a candidate. */
export const CAPTURE_ADAPTER_CODE_PATTERN = /^[A-Z][A-Z0-9_]{0,63}$/;

/**
 * An IP literal: dotted IPv4, or IPv6 in its text form. Never a host name, never a URL, never
 * `user:password@` (specs C-N8). The form is a character set and a length; the value is the
 * address an answer came from, read by the Core from the datagram, not from the answer's text.
 */
export const CAPTURE_HOST_LITERAL_PATTERN = /^(?:\d{1,3}(?:\.\d{1,3}){3}|[0-9A-Fa-f:]{2,39})$/;

// ═══════════════════════════════════════════════════════════════════════════════════════
// Schemas
// ═══════════════════════════════════════════════════════════════════════════════════════

const searchId = () => z.string().regex(CAPTURE_SEARCH_ID_PATTERN);
const candidateId = () => z.string().regex(CAPTURE_CANDIDATE_ID_PATTERN);
const reasonCode = () => z.string().regex(CAPTURE_ADAPTER_CODE_PATTERN);
/** Text a device announced: untrusted, bounded, under the text rule (API-13); a client draws it as text only. */
const announcedText = () => apiText().min(1).max(CAPTURE_CANDIDATE_TEXT_MAX_LENGTH);

/** Operation 93's answer, and the `search` member of operation 94. */
export const CaptureDiscoverySearchSchema = z
  .strictObject({
    searchId: searchId().describe('`DSC-NNNNNN`. It is in no path: operation 94 answers the caller\'s own search only.'),
    scope: z.literal(CaptureDiscoveryScope.CAMERA_NETWORK).describe('A search of operation 93 looks for cameras on the network.'),
    trigger: z.enum(CaptureDiscoveryTrigger).describe('MANUAL: operation 93. PRECHECK: the one search of a pre-check run with an unreachable camera.'),
    state: z.enum(CaptureDiscoveryState).describe('RUNNING until the window closes; then COMPLETE, or FAILED when the search could not run.'),
    startedAt: epochMs(),
    windowMs: count().describe('How long the search listens (ms).'),
    completesAt: epochMs().describe('`startedAt` + `windowMs`.'),
    expiresAt: epochMs().describe('When the candidate list is discarded: `completesAt` + the result life.'),
    responderCount: count().describe('Devices that answered. 0 while RUNNING.'),
    newCount: count().describe('Answers that match no registered capture device. 0 while RUNNING.'),
    registeredCount: count().describe('Answers that match a registered capture device. 0 while RUNNING.'),
    interfaceCount: count().describe('Network interfaces probed: a count, never a name or an address.'),
    failureReason: reasonCode().nullable().describe('Why a FAILED search could not run, as a code (e.g. `NO_ELIGIBLE_INTERFACE`, `SOCKET_ERROR`); null otherwise.'),
    created: z.boolean().describe('True for a new search (202). False when the caller\'s own search is still RUNNING and no second probe was sent (200).'),
  })
  .describe('One camera search (C3 §2.6). Counts and codes only: no address, no device text.');
export type CaptureDiscoverySearch = z.output<typeof CaptureDiscoverySearchSchema>;

/** The last connection test of a candidate in this search's life: an outcome and two facts, never a value. */
export const CaptureCandidateLastTestSchema = z.strictObject({
  outcome: z.enum(CaptureConnectionOutcome),
  authenticated: z.boolean().describe('Whether a credential was supplied: a fact, never a value.'),
  testedAt: epochMs(),
});
export type CaptureCandidateLastTest = z.output<typeof CaptureCandidateLastTestSchema>;

/** One device that answered a search (operation 94). Built from the probe answer only (D80(1)). */
export const CaptureCandidateSchema = z
  .strictObject({
    candidateId: candidateId().describe('Minted by the Core at random per search; meaningful only inside the owner session.'),
    adapter: z.string().regex(CAPTURE_ADAPTER_CODE_PATTERN).describe('The adapter kind: `ONVIF_RTSP`, or `FAKE` for a fixture source on loopback.'),
    sourceClass: z.enum(CaptureSourceClass).describe('Derived by the Core from `adapter`; never set by a client.'),
    host: z.string().regex(CAPTURE_HOST_LITERAL_PATTERN).describe('The address the answer came from: an IP literal, never a URL, never `user:password@`.'),
    endpointRef: announcedText().nullable().describe('The announced endpoint reference. Untrusted device text.'),
    vendor: announcedText().nullable().describe('Announced. Untrusted device text: draw it as text only.'),
    model: announcedText().nullable().describe('Announced. Untrusted device text: draw it as text only.'),
    name: announcedText().nullable().describe('Announced. Untrusted device text: draw it as text only.'),
    status: z.enum(CaptureCandidateStatus).describe('REGISTERED when it matches a capture device: by its endpoint reference, else by its whole address.'),
    deviceId: z.string().regex(HARDWARE_DEVICE_ID_PATTERN).nullable().describe('The registered capture device when `status` is REGISTERED; null otherwise.'),
    testable: z.boolean().describe('False when no announced service address qualifies, or its host is not `host`: such a candidate is listed and can never be tested.'),
    conflict: z.boolean().describe('Two answers share one endpoint reference from different addresses, or one address announced two references: every such row is listed and none is testable.'),
    addressChanged: z.boolean().describe('REGISTERED by endpoint reference while the answering address differs from the stored one.'),
    lastTest: CaptureCandidateLastTestSchema.nullable().describe('The last connection test of this candidate in this search; null before the first.'),
    adoptable: z.boolean().describe('`status` NEW and a REACHABLE `lastTest` that is still valid.'),
  })
  .describe('One candidate of a camera search (C3 §2.6). Not a capture device: it registers nothing and is in no slice. Carries no credential.');
export type CaptureCandidate = z.output<typeof CaptureCandidateSchema>;

/** Operation 94's answer: the caller's own search and its candidates. */
export const CaptureDiscoveryStateSchema = z
  .strictObject({
    search: CaptureDiscoverySearchSchema.nullable().describe('Null when the caller\'s session has no live search: never started, expired, or replaced.'),
    candidates: z
      .array(CaptureCandidateSchema)
      .max(CAPTURE_DISCOVERY_MAX_CANDIDATES)
      .describe('Empty while RUNNING, complete once COMPLETE. Registered matches first, then arrival order; the list never shrinks or reorders during its life.'),
    truncated: z.boolean().describe(`True when more than ${CAPTURE_DISCOVERY_MAX_CANDIDATES} devices answered: a warning, not a note.`),
  })
  .describe('The camera search of the calling operator session (C3 §2.6). Another session, whatever its role, reads its own.');
export type CaptureDiscoveryStateBody = z.output<typeof CaptureDiscoveryStateSchema>;

/**
 * Request body of operation 95. `credential` is the write-only pair of operation 89: required for
 * a PRODUCTION candidate (`422 CREDENTIAL_REQUIRED`), optional for a DEVELOPMENT one. It lives in
 * the memory of that one request. The target is the candidate of the path and nothing else.
 */
export const CaptureConnectionTestRequestSchema = z
  .strictObject({
    credential: CaptureCredentialWriteRequestSchema.optional().describe('The camera credential to test with. Write-only: never stored, returned, logged or audited.'),
  })
  .describe('Request body of `POST /api/v1/capture/discovery/candidates/{id}/test` (C3 §2.6 op 95). No address, host, port, URL, path or profile member exists.');
export type CaptureConnectionTestRequest = z.output<typeof CaptureConnectionTestRequestSchema>;

/** Operation 95's answer. A failed test is this 200 result, not an HTTP error. */
export const CaptureConnectionTestSchema = z
  .strictObject({
    candidateId: candidateId(),
    outcome: z.enum(CaptureConnectionOutcome),
    authenticated: z.boolean().describe('Whether a credential was supplied: a fact, never a value.'),
    testedAt: epochMs(),
    usableProfileCount: count().describe('Usable H.264 media profiles the test read. A count: no profile name.'),
    failedAttemptsRemaining: count().describe('Refused credentials this host may still see before the lock-out guard closes.'),
  })
  .describe('The outcome of one connection test (C3 §2.6 op 95). No device error text, no URL, no credential member.');
export type CaptureConnectionTest = z.output<typeof CaptureConnectionTestSchema>;

/**
 * Request body of operation 96. `credential` is the same schema as the body of operation 89, and
 * it must be present exactly when the candidate's last passing test was authenticated. The
 * adoption decides no track, no role and no address.
 */
export const CaptureCandidateAdoptRequestSchema = z
  .strictObject({
    credential: CaptureCredentialWriteRequestSchema.optional().describe('The camera credential to store with the new device. Write-only: never returned, logged or audited.'),
  })
  .describe('Request body of `POST /api/v1/capture/discovery/candidates/{id}/adopt` (C3 §2.6 op 96).');
export type CaptureCandidateAdoptRequest = z.output<typeof CaptureCandidateAdoptRequestSchema>;

/** Operation 96's answer: the new capture device. The credential is never echoed. */
export const CaptureCandidateAdoptionSchema = z
  .strictObject({
    deviceId: z.string().regex(HARDWARE_DEVICE_ID_PATTERN).describe('The new capture device, e.g. `CAM-03`: the next free number, minted by the Core.'),
    device: CaptureDeviceStatusSchema,
    credentialSet: z.boolean().describe('Whether a credential was stored with the device: a fact, never a value.'),
  })
  .describe('The capture device an adoption registered (C3 §2.6 op 96).');
export type CaptureCandidateAdoption = z.output<typeof CaptureCandidateAdoptionSchema>;

/** One registered microphone as operation 97 found it. */
export const CaptureInputScanEntrySchema = z.strictObject({
  deviceId: z.string().regex(HARDWARE_DEVICE_ID_PATTERN),
  inputId: z.string().regex(MIC_INPUT_ID_PATTERN).nullable().describe('The mic input (`MIC-NN`) this device stands behind in the selector; null when it is assigned to none.'),
  present: z.boolean(),
  adapter: z.string().regex(CAPTURE_ADAPTER_CODE_PATTERN),
  sourceClass: z.enum(CaptureSourceClass),
  errorCode: z.enum(CaptureInputErrorCode).nullable().describe('The named cause when a local input cannot be opened; null otherwise.'),
});
export type CaptureInputScanEntry = z.output<typeof CaptureInputScanEntrySchema>;

/** Operation 97's answer: one entry per REGISTERED microphone; other local inputs are counted only. */
export const CaptureInputScanSchema = z
  .strictObject({
    scannedAt: epochMs(),
    inputs: z.array(CaptureInputScanEntrySchema).describe('One entry per registered microphone.'),
    unregisteredCount: count().describe('Local inputs that are no registered microphone: a count only.'),
  })
  .describe('The local microphone inputs as a re-read found them (C3 §2.6 op 97). It registers nothing.');
export type CaptureInputScan = z.output<typeof CaptureInputScanSchema>;

/** The schemas operations 93 to 97 add (merged into `CORE_API_SCHEMAS`). */
export const CAPTURE_DISCOVERY_SCHEMAS = {
  CaptureDiscoverySearch: CaptureDiscoverySearchSchema,
  CaptureCandidate: CaptureCandidateSchema,
  CaptureDiscoveryState: CaptureDiscoveryStateSchema,
  CaptureConnectionTestRequest: CaptureConnectionTestRequestSchema,
  CaptureConnectionTest: CaptureConnectionTestSchema,
  CaptureCandidateAdoptRequest: CaptureCandidateAdoptRequestSchema,
  CaptureCandidateAdoption: CaptureCandidateAdoptionSchema,
  CaptureInputScan: CaptureInputScanSchema,
} as const;

// ═══════════════════════════════════════════════════════════════════════════════════════
// Audit details (C3 §5.2): one builder per type, so the Core server and the simulator write the
// same keys. Exact key lists; no key holds a username, a secret, a URL or device text.
// ═══════════════════════════════════════════════════════════════════════════════════════

type AuditDetails = Record<string, string | number | boolean>;

export interface CaptureDiscoverySearchedFacts {
  searchId: string;
  scope: CaptureDiscoveryScope;
  trigger: CaptureDiscoveryTrigger;
  outcome: 'COMPLETE' | 'FAILED';
  responderCount: number;
  newCount: number;
  registeredCount: number;
  interfaceCount: number;
  failureReason?: string | null;
  /** The recording session, when one is open. */
  sessionId?: string | null;
  operationId?: string | null;
  permission?: string | null;
}

/** `details` of CAPTURE_DISCOVERY_SEARCHED: eight required keys and four optional ones (C3 §5.2). Counts and codes only. */
export function captureDiscoverySearchedDetails(facts: CaptureDiscoverySearchedFacts): AuditDetails {
  return {
    searchId: facts.searchId,
    scope: facts.scope,
    trigger: facts.trigger,
    outcome: facts.outcome,
    responderCount: facts.responderCount,
    newCount: facts.newCount,
    registeredCount: facts.registeredCount,
    interfaceCount: facts.interfaceCount,
    ...(facts.failureReason ? { failureReason: facts.failureReason } : {}),
    ...(facts.sessionId ? { sessionId: facts.sessionId } : {}),
    ...(facts.operationId ? { operationId: facts.operationId } : {}),
    ...(facts.permission ? { permission: facts.permission } : {}),
  };
}

export interface CaptureConnectionTestedFacts {
  candidateId: string;
  searchId: string;
  outcome: CaptureConnectionOutcome;
  authenticated: boolean;
  adapter: string;
  sourceClass: CaptureSourceClass;
  operationId: 'testCaptureCandidateConnection' | 'adoptCaptureCandidate';
  /** The candidate's address and endpoint reference. Written for a PRODUCTION candidate only (D86 C-3). */
  host?: string | null;
  endpointRef?: string | null;
  guardTripped?: boolean;
  permission?: string | null;
}

/**
 * The one form of an endpoint reference an audit row may carry: `urn:uuid:` and a UUID, the form
 * ONVIF defines for it (decision D134). It is the rule of the Core server's audit details
 * (`core/audit-details.ts`, `ENDPOINT_REF_URN`): what a device ANNOUNCED is free text, and a row
 * must not hold free text a device chose.
 */
export const CAPTURE_ENDPOINT_REF_PATTERN = /^urn:uuid:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * `host` and `endpointRef` join a row for a PRODUCTION candidate only (D86 C-3): for any other
 * class the two members are dropped here, whatever the caller passed. An announced reference that
 * is not `urn:uuid:<UUID>` is left out as well (D134): the simulator builds no row the server refuses.
 */
function productionIdentity(facts: { sourceClass: CaptureSourceClass; host?: string | null; endpointRef?: string | null }): AuditDetails {
  if (facts.sourceClass !== CaptureSourceClass.PRODUCTION) return {};
  const endpointRef = typeof facts.endpointRef === 'string' && CAPTURE_ENDPOINT_REF_PATTERN.test(facts.endpointRef) ? facts.endpointRef : null;
  return { ...(facts.host ? { host: facts.host } : {}), ...(endpointRef === null ? {} : { endpointRef }) };
}

/** `details` of CAPTURE_CONNECTION_TESTED (C3 §5.2): one row per attempt, every outcome. Never the username, the secret or a URL. */
export function captureConnectionTestedDetails(facts: CaptureConnectionTestedFacts): AuditDetails {
  return {
    candidateId: facts.candidateId,
    searchId: facts.searchId,
    outcome: facts.outcome,
    authenticated: facts.authenticated,
    adapter: facts.adapter,
    sourceClass: facts.sourceClass,
    operationId: facts.operationId,
    ...productionIdentity(facts),
    ...(facts.guardTripped === undefined ? {} : { guardTripped: facts.guardTripped }),
    ...(facts.permission ? { permission: facts.permission } : {}),
  };
}

export interface CaptureCandidateAdoptedFacts {
  deviceId: string;
  candidateId: string;
  searchId: string;
  adapter: string;
  sourceClass: CaptureSourceClass;
  credentialSet: boolean;
  host?: string | null;
  endpointRef?: string | null;
  permission?: string | null;
}

/** `details` of CAPTURE_CANDIDATE_ADOPTED (C3 §5.2), written inside the adoption transaction. */
export function captureCandidateAdoptedDetails(facts: CaptureCandidateAdoptedFacts): AuditDetails {
  return {
    deviceId: facts.deviceId,
    candidateId: facts.candidateId,
    searchId: facts.searchId,
    adapter: facts.adapter,
    sourceClass: facts.sourceClass,
    credentialSet: facts.credentialSet,
    operationId: 'adoptCaptureCandidate',
    ...productionIdentity(facts),
    ...(facts.permission ? { permission: facts.permission } : {}),
  };
}

/** `reason` of CAPTURE_DEVICE_UNREACHABLE, also the `cause` of the situation-B alert (C3 §5.2, §5.4). */
export const CAPTURE_DEVICE_UNREACHABLE_REASONS = [
  'UNREACHABLE',
  'AUTHENTICATION_FAILED',
  'NOT_CONNECTED',
  CaptureInputErrorCode.PERMISSION_DENIED,
  CaptureInputErrorCode.DEVICE_BUSY,
  CaptureInputErrorCode.DEVICE_NOT_FOUND,
  CaptureInputErrorCode.OPEN_FAILED,
  CaptureInputErrorCode.HELPER_EXITED,
] as const;
export type CaptureDeviceUnreachableReason = (typeof CAPTURE_DEVICE_UNREACHABLE_REASONS)[number];

export interface CaptureDeviceUnreachableFacts {
  deviceId: string;
  deviceKind: 'CAMERA' | 'MIC';
  phase: 'PRECHECK' | 'SESSION_START';
  reason: CaptureDeviceUnreachableReason;
  /** The session may start, or started, without this device. */
  degraded: boolean;
  sessionId: string;
}

/** `details` of CAPTURE_DEVICE_UNREACHABLE: exactly six keys (C3 §5.2). Ids and codes only: no address, no label. */
export function captureDeviceUnreachableDetails(facts: CaptureDeviceUnreachableFacts): AuditDetails {
  return {
    deviceId: facts.deviceId,
    deviceKind: facts.deviceKind,
    phase: facts.phase,
    reason: facts.reason,
    degraded: facts.degraded,
    sessionId: facts.sessionId,
  };
}

/** The alert of an empty search (C3 §5.4 situation A): kind `SYSTEM`, WARNING, this target and this reason. */
export const CAPTURE_DISCOVERY_ALERT_TARGET = 'CAPTURE_DISCOVERY';
export const CAPTURE_DISCOVERY_EMPTY_REASON = 'CAPTURE_DISCOVERY_EMPTY';

// ═══════════════════════════════════════════════════════════════════════════════════════
// Operations
// ═══════════════════════════════════════════════════════════════════════════════════════

export const CAPTURE_DISCOVERY_PATH = `${API_BASE_PATH}/capture/discovery`;
export const CAPTURE_DISCOVERY_CANDIDATE_PATH = `${CAPTURE_DISCOVERY_PATH}/candidates/{id}`;
export const CAPTURE_INPUT_RESCAN_PATH = `${API_BASE_PATH}/capture/inputs/rescan`;

const CAPTURE_CONFIG = permissionAccess(Permission.CAPTURE_CONFIG);
/** Operations 95 and 96 (and 89): CAPTURE_CONFIG on a web console session only (D80(3)). */
export const CAPTURE_CREDENTIAL_ACCESS = { ...CAPTURE_CONFIG, conditions: [CoreApiAccessCondition.WEB_CONSOLE_SESSION] } as const;
const DENIED = { denial: AuditType.ACCESS_DENIED } as const;

/** The 403 part of an operation with the condition `WEB_CONSOLE_SESSION`: an `extra` of `notPermitted`. */
export const WEB_CONSOLE_ONLY_REFUSED = `the operator's session is bound to a paired tablet or phone (NOT_PERMITTED, \`details.reason: ${WEB_CONSOLE_ONLY_REASON}\`; one ACCESS_DENIED audit row; refused before the body is used)`;

const CANDIDATE_PARAM = {
  name: 'id',
  description: 'A candidate of the caller\'s own live search, e.g. `CND-4F2A91C0D377`. Never an address and never a capture device id.',
  pattern: CAPTURE_CANDIDATE_ID_PATTERN,
} as const;
const UNKNOWN_CANDIDATE = {
  description: 'The id is unknown, expired, or belongs to another session\'s search: one answer for all three (NOT_FOUND). No request is sent to any device.',
  schema: 'ApiError',
} as const;
const NO_TARGET =
  '**The target is the candidate in the path and nothing else** (R-9 AC-10): the Core takes the address from its own search state. A foreign id, an expired id and a candidate that is not testable are refused with 0 outbound requests.';
const CREDENTIAL_SCOPE =
  '**The credential is write-only and lives for this one request** (C-N15; SEC35-34): it is not kept in the candidate state, not cached for a later request, and never written to a log line, an audit row, an error or a file. A retry is a new request with a newly sent credential.';
const RATE_AND_READY = (limited: string, notReady: string): string =>
  `Over a bound the Core server answers \`429 RATE_LIMITED\` with \`retry-after\` and \`details.reason\` ${limited}: nothing is sent and no audit row is written. \`503 NOT_READY\` carries \`details.reason\` ${notReady}. Both are envelope-level answers of the contract.`;

export const CAPTURE_DISCOVERY_OPERATIONS = [
  {
    operationId: 'startCaptureDiscovery',
    method: 'post',
    path: CAPTURE_DISCOVERY_PATH,
    tag: CoreApiTag.DEVICE,
    mode: CoreApiMode.SIMULATED,
    summary: 'Search for cameras',
    description: [
      'Starts one camera search: an unauthenticated WS-Discovery probe on the network of the Core, for a fixed listening window. **No body.** No address, subnet, interface, port, timeout or filter can be sent: a search always probes the fixed multicast group. It opens no connection to any device, authenticates nothing and registers nothing.',
      'Needs CAPTURE_CONFIG (SUPERVISOR, TECHNICIAN), on the web console, a tablet or a phone. Answers `202` with the new search; `200` with the same object and `created: false` when the caller\'s own search is still RUNNING (no second probe). The candidates are read with operation 94, by the session that started the search and by no other.',
      'A search is allowed while a session is open. While that session is in `RECORDING` it is allowed only because `CAPTURE_DISCOVERY_DURING_RECORDING_ENABLED` is true (D86 C-4); with the constant off the answer is `409 INVALID_STATE` (`DISCOVERY_NOT_ALLOWED_WHILE_RECORDING`): 0 datagrams, no audit row, no alert. Another operator session\'s running search answers `409 INVALID_STATE` (`DISCOVERY_IN_PROGRESS`): one socket per Core. Never `409 CAPTURE_CONFIG_LOCKED`.',
      'Writes one CAPTURE_DISCOVERY_SEARCHED row when the window closes or the search fails: the search id, the trigger, the outcome and four counts, never an address or a device text. A search with no responder writes that one row and raises one WARNING alert (`SYSTEM`, `params.reason: CAPTURE_DISCOVERY_EMPTY`); the next search with a responder resolves it.',
      RATE_AND_READY('`DISCOVERY_RATE_LIMITED`', '`DISCOVERY_NOT_READY` when no discovery adapter is provided or capture is not ready'),
      `${SIM_V2_NOTE} The simulator opens no socket and waits on no timer: it answers \`202\` with a search that is already COMPLETE (\`windowMs: 0\`) and two fixed candidates.`,
    ].join('\n\n'),
    source: 'Task 3 R-9, blueprint row 132; C3 §2.6 operation 93; decisions D80, D86 C-4, D91 (not in the design book)',
    responses: {
      200: { description: 'The caller\'s own search is still RUNNING: the same search, `created: false`. No second probe was sent.', schema: 'CaptureDiscoverySearch', services: CORE_SERVER_ONLY },
      202: { description: 'A new search. Read its candidates with operation 94.', schema: 'CaptureDiscoverySearch' },
      401: NOT_SIGNED_IN,
      403: notPermitted(Permission.CAPTURE_CONFIG),
      409: {
        description:
          'Another operator session\'s search is running (INVALID_STATE, `details.reason: DISCOVERY_IN_PROGRESS`), or the session is RECORDING while searching during a recording is switched off (INVALID_STATE, `details.reason: DISCOVERY_NOT_ALLOWED_WHILE_RECORDING`). No probe is sent, no audit row is written and no alert is raised.',
        schema: 'ApiError',
        services: CORE_SERVER_ONLY,
      },
    },
    access: CAPTURE_CONFIG,
    audit: { success: AuditType.CAPTURE_DISCOVERY_SEARCHED, ...DENIED },
    services: CORE_SERVER_ONLY,
  },
  {
    operationId: 'getCaptureDiscovery',
    method: 'get',
    path: CAPTURE_DISCOVERY_PATH,
    tag: CoreApiTag.DEVICE,
    mode: CoreApiMode.SIMULATED,
    summary: 'Camera search result',
    description: [
      'The camera search of the calling operator session and its candidates. `search: null` and `candidates: []` when the session has no live search: none was started, it expired, or a new one replaced it. The list is empty while the search is RUNNING and complete once it is COMPLETE; it never shrinks or reorders during its life.',
      '**Owner session only.** There is no search id in any path: no role, SUPERVISOR included, reads another session\'s search. What every client sees of a search is its outcome as an alert, never the list. Needs CAPTURE_CONFIG.',
      'A candidate is built from the probe answer only. Its `vendor`, `model`, `name` and `endpointRef` are **untrusted device text**: a client draws them as text and trusts none of them. `conflict` and `addressChanged` say when two devices announce one identity or a registered identity answers from another address; such a row must be shown, not hidden.',
      'A read never probes: it sends nothing to the network. A client polls it while a search is RUNNING, not faster than once per second. Candidates never appear in operation 77 or in the `captureDevices` slice.',
      SIM_V2_NOTE,
    ].join('\n\n'),
    source: 'Task 3 R-9, blueprint row 132; C3 §2.6 operation 94; decisions D80, D83, D86 (not in the design book)',
    responses: {
      200: { description: 'The caller\'s own search and its candidates.', schema: 'CaptureDiscoveryState' },
      401: NOT_SIGNED_IN,
      403: notPermitted(Permission.CAPTURE_CONFIG),
    },
    access: CAPTURE_CONFIG,
    audit: { success: CoreApiAuditNone.READ, ...DENIED },
    services: CORE_SERVER_ONLY,
  },
  {
    operationId: 'testCaptureCandidateConnection',
    method: 'post',
    path: `${CAPTURE_DISCOVERY_CANDIDATE_PATH}/test`,
    tag: CoreApiTag.DEVICE,
    mode: CoreApiMode.SIMULATED,
    summary: 'Test the connection to a candidate camera',
    description: [
      'One read-only connection attempt against the candidate in the path, inside one time limit: authenticate, list the media profiles, look for a usable H.264 profile. It changes no setting of the camera and is never repeated without a new operator action.',
      '**Web console only.** Needs CAPTURE_CONFIG and a web console session (`WEB_CONSOLE_SESSION`): a session of a tablet or a phone is refused `403 NOT_PERMITTED` with `details.reason: WEB_CONSOLE_ONLY` and one ACCESS_DENIED row, before the body is used. Idle only: with a session open it answers `409 CAPTURE_CONFIG_LOCKED` and writes no audit row.',
      NO_TARGET,
      '`credential` is required for a `PRODUCTION` candidate (`422 INVALID_INPUT`, `details.reason: CREDENTIAL_REQUIRED`): no credential means no connection attempt. A `DEVELOPMENT` candidate (a fixture on loopback) may be tested without one. Both fields are 1 or more printable ASCII characters. ' + CREDENTIAL_SCOPE,
      '**A failed test is a `200` result, not an HTTP error.** Exactly five outcomes: `REACHABLE`, `AUTHENTICATION_FAILED`, `WRONG_PROFILE`, `NOT_H264`, `UNREACHABLE`. The answer holds no device error text, no URL and no credential member. Every accepted attempt writes one CAPTURE_CONNECTION_TESTED row, whatever the outcome: ids, the outcome and facts, never the username, the secret or a URL (`host` and `endpointRef` for a PRODUCTION candidate only).',
      'Other refusals, each before any request leaves the Core: `409 INVALID_STATE` with `details.reason` `CANDIDATE_ALREADY_REGISTERED` (plus `details.deviceId`), `CANDIDATE_NOT_TESTABLE` or `CONNECTION_TEST_IN_PROGRESS`.',
      RATE_AND_READY('`CONNECTION_TEST_RATE_LIMITED` or `CONNECTION_TEST_LOCKOUT_GUARD` (too many refused credentials on this host)', '`DISCOVERY_NOT_READY`'),
      `${SIM_V2_NOTE} The simulator contacts nothing: the first fixed candidate answers \`REACHABLE\`, and the body is accepted opaquely, never stored and never echoed. On a tablet or phone the simulator refuses with the same \`403\`.`,
    ].join('\n\n'),
    source: 'Task 3 R-9, blueprint row 142 (contract landed by row 132, D106); C3 §2.6 operation 95; decisions D80(3), D80(7), D86 C-2 (not in the design book)',
    pathParam: CANDIDATE_PARAM,
    requestBody: { schema: 'CaptureConnectionTestRequest', required: false },
    responses: {
      200: { description: 'The outcome of the test. A failed test is a result, not an error. Never the credential.', schema: 'CaptureConnectionTest' },
      400: INVALID_JSON,
      401: NOT_SIGNED_IN,
      403: notPermitted(Permission.CAPTURE_CONFIG, WEB_CONSOLE_ONLY_REFUSED),
      404: UNKNOWN_CANDIDATE,
      409: {
        description:
          'A session is open (CAPTURE_CONFIG_LOCKED; no audit row), or the candidate cannot be tested (INVALID_STATE, `details.reason`: CANDIDATE_ALREADY_REGISTERED with `details.deviceId`, CANDIDATE_NOT_TESTABLE or CONNECTION_TEST_IN_PROGRESS). No request is sent to any device.',
        schema: 'ApiError',
      },
      422: {
        description:
          'The body or the path parameter does not match its schema, or a PRODUCTION candidate was sent without a credential (INVALID_INPUT, `details.reason: CREDENTIAL_REQUIRED`). The refusal never quotes the input. No request is sent to any device.',
        schema: 'ApiError',
      },
    },
    access: CAPTURE_CREDENTIAL_ACCESS,
    audit: { success: AuditType.CAPTURE_CONNECTION_TESTED, ...DENIED },
    services: CORE_SERVER_ONLY,
  },
  {
    operationId: 'adoptCaptureCandidate',
    method: 'post',
    path: `${CAPTURE_DISCOVERY_CANDIDATE_PATH}/adopt`,
    tag: CoreApiTag.DEVICE,
    mode: CoreApiMode.SIMULATED,
    summary: 'Add a tested candidate camera to the capture devices',
    description: [
      'Registers the candidate in the path as a capture device. **This is the one place a `capture_devices` row comes into being.** The candidate must be `NEW` and hold a `REACHABLE` test that is still valid; the Core then verifies it once more with the credential of this request and, in one database transaction, writes the device, the credential when one is sent, and the audit rows. Any failure before or inside the transaction leaves nothing behind: there is no pending row.',
      '**Web console only**, as operation 95 (`WEB_CONSOLE_SESSION`), and idle only (`409 CAPTURE_CONFIG_LOCKED`, no audit row).',
      NO_TARGET + ' The adoption decides no track, no role and no address: assigning the new device to a video track is operation 78 or 79, which accept registered device ids only.',
      '`credential` is the same pair as the body of operation 89 and must be present exactly when the passing test was authenticated: `422 INVALID_INPUT` with `details.reason` `CREDENTIAL_REQUIRED` or `CREDENTIAL_NOT_EXPECTED` otherwise. ' + CREDENTIAL_SCOPE + ' The answer says `credentialSet` and never echoes either field.',
      'Other refusals, each storing nothing: `409 INVALID_STATE` with `details.reason` `CANDIDATE_ALREADY_REGISTERED` (plus `details.deviceId`; a repeat of an adoption answers this), `CANDIDATE_NOT_TESTED`, `CONNECTION_TEST_FAILED` (plus `details.outcome`, or `details.cause: DEVICE_CHANGED` when the device answers with other profiles than it did in the test) or `CONNECTION_TEST_IN_PROGRESS`.',
      'Writes CAPTURE_CANDIDATE_ADOPTED, one CAPTURE_CONNECTION_TESTED row for the verification, and CAPTURE_CREDENTIAL_SET (the device id only) when a credential is stored. Publishes the `captureDevices` slice; `captureConfig` is not changed.',
      RATE_AND_READY('as operation 95', '`CREDENTIAL_STORE_NOT_READY` when a credential is in the body and the Core credential store is not available, or `DISCOVERY_NOT_READY`'),
      `${SIM_V2_NOTE} The simulator registers \`CAM-03\` for the first fixed candidate after a REACHABLE test, stores nothing of a credential and answers \`credentialSet\` as whether one was sent; a demo reset removes the device.`,
    ].join('\n\n'),
    source: 'Task 3 R-9, blueprint row 142 (contract landed by row 132, D106); C3 §2.6 operation 96; decisions D80(7), D81, D83 (not in the design book)',
    pathParam: CANDIDATE_PARAM,
    requestBody: { schema: 'CaptureCandidateAdoptRequest', required: false },
    responses: {
      201: { description: 'The new capture device. The credential is never echoed.', schema: 'CaptureCandidateAdoption' },
      400: INVALID_JSON,
      401: NOT_SIGNED_IN,
      403: notPermitted(Permission.CAPTURE_CONFIG, WEB_CONSOLE_ONLY_REFUSED),
      404: UNKNOWN_CANDIDATE,
      409: {
        description:
          'A session is open (CAPTURE_CONFIG_LOCKED; no audit row), or the candidate cannot be adopted (INVALID_STATE, `details.reason`: CANDIDATE_ALREADY_REGISTERED with `details.deviceId`, CANDIDATE_NOT_TESTED, CONNECTION_TEST_FAILED with `details.outcome` or `details.cause`, or CONNECTION_TEST_IN_PROGRESS). Nothing is stored.',
        schema: 'ApiError',
      },
      422: {
        description:
          'The body or the path parameter does not match its schema, or the credential is missing or not expected (INVALID_INPUT, `details.reason`: CREDENTIAL_REQUIRED or CREDENTIAL_NOT_EXPECTED). The refusal never quotes the input. Nothing is stored.',
        schema: 'ApiError',
      },
    },
    access: CAPTURE_CREDENTIAL_ACCESS,
    audit: { success: AuditType.CAPTURE_CANDIDATE_ADOPTED, ...DENIED, also: [AuditType.CAPTURE_CONNECTION_TESTED, AuditType.CAPTURE_CREDENTIAL_SET] },
    services: CORE_SERVER_ONLY,
  },
  {
    operationId: 'rescanCaptureInputs',
    method: 'post',
    path: CAPTURE_INPUT_RESCAN_PATH,
    tag: CoreApiTag.DEVICE,
    mode: CoreApiMode.SIMULATED,
    summary: 'Search again for microphones',
    description: [
      'Reads the local microphone inputs again and reports each **registered** microphone as present or not, with the named cause when a local input cannot be opened. **No body.** There is no network microphone discovery and no microphone adoption: the operation registers nothing and never replaces a local device by another one. Local inputs that are no registered microphone are counted only.',
      'Needs CAPTURE_CONFIG, on the web console, a tablet or a phone, and is allowed while a session is open.',
      'Writes one CAPTURE_DISCOVERY_SEARCHED row with `scope: MIC_LOCAL`. Publishes the `captureDevices` slice (`online` of the microphones).',
      RATE_AND_READY('`INPUT_RESCAN_RATE_LIMITED`', '`CAPTURE_NOT_READY`'),
      `${SIM_V2_NOTE} The simulator answers its two microphones, \`present\` from its device state.`,
    ].join('\n\n'),
    source: 'Task 3 R-10, blueprint row 133 (contract landed by row 132, D106); C3 §2.6 operation 97; decision D80(5) (not in the design book)',
    responses: {
      200: { description: 'The registered microphones as the re-read found them.', schema: 'CaptureInputScan' },
      401: NOT_SIGNED_IN,
      403: notPermitted(Permission.CAPTURE_CONFIG),
    },
    access: CAPTURE_CONFIG,
    audit: { success: AuditType.CAPTURE_DISCOVERY_SEARCHED, ...DENIED },
    services: CORE_SERVER_ONLY,
  },
] as const satisfies readonly CoreApiRegistryOperation[];

// ═══════════════════════════════════════════════════════════════════════════════════════
// The simulator's fixed search (C3 §2.6 "Simulator"): the examples below are its answers.
// ═══════════════════════════════════════════════════════════════════════════════════════

/** The two candidate ids of the in-app simulator: a new fixture source, and a registered camera. */
export const SIM_CAPTURE_CANDIDATE_IDS = { fresh: 'CND-000000000001', registered: 'CND-000000000002' } as const;
/** The device the simulator registers when its first candidate is adopted. */
export const SIM_ADOPTED_DEVICE_ID = 'CAM-03';
/** The adapter kind of every simulator source: a fixture, never a production device. */
export const SIM_CAPTURE_ADAPTER = 'FAKE';
const SIM_HOST = '127.0.0.1';

/** The two candidates of the simulator's search, before any test. */
export function simCaptureCandidates(): CaptureCandidate[] {
  return [
    {
      candidateId: SIM_CAPTURE_CANDIDATE_IDS.fresh,
      adapter: SIM_CAPTURE_ADAPTER,
      sourceClass: CaptureSourceClass.DEVELOPMENT,
      host: SIM_HOST,
      endpointRef: 'urn:uuid:00000000-0000-4000-8000-000000000001',
      vendor: 'DEMS',
      model: 'Test source',
      name: 'Test camera 3',
      status: CaptureCandidateStatus.NEW,
      deviceId: null,
      testable: true,
      conflict: false,
      addressChanged: false,
      lastTest: null,
      adoptable: false,
    },
    {
      candidateId: SIM_CAPTURE_CANDIDATE_IDS.registered,
      adapter: SIM_CAPTURE_ADAPTER,
      sourceClass: CaptureSourceClass.DEVELOPMENT,
      host: SIM_HOST,
      endpointRef: 'urn:uuid:00000000-0000-4000-8000-000000000002',
      vendor: 'DEMS',
      model: 'Test source',
      name: 'Test camera 1',
      status: CaptureCandidateStatus.REGISTERED,
      deviceId: 'CAM-01',
      testable: true,
      conflict: false,
      addressChanged: false,
      lastTest: null,
      adoptable: false,
    },
  ];
}

/** The simulator's search at `at`: already COMPLETE, no window, two responders, no interface probed. */
export function simCaptureDiscoverySearch(searchId: string, at: number, expiresAt: number, created: boolean): CaptureDiscoverySearch {
  return {
    searchId,
    scope: CaptureDiscoveryScope.CAMERA_NETWORK,
    trigger: CaptureDiscoveryTrigger.MANUAL,
    state: CaptureDiscoveryState.COMPLETE,
    startedAt: at,
    windowMs: 0,
    completesAt: at,
    expiresAt,
    responderCount: 2,
    newCount: 1,
    registeredCount: 1,
    interfaceCount: 0,
    failureReason: null,
    created,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════════════
// Examples
// ═══════════════════════════════════════════════════════════════════════════════════════

const SIGNED_OUT = { notSignedIn: ERROR_EXAMPLES.notSignedIn } as const;
const EXAMPLE_SEARCH_ID = 'DSC-000001';
const EXAMPLE_EXPIRES_AT = EXAMPLE_INSTANT_MS + 600_000;
const EXAMPLE_SEARCH = simCaptureDiscoverySearch(EXAMPLE_SEARCH_ID, EXAMPLE_INSTANT_MS, EXAMPLE_EXPIRES_AT, true);
const EXAMPLE_RUNNING_SEARCH = {
  ...EXAMPLE_SEARCH,
  state: CaptureDiscoveryState.RUNNING,
  windowMs: 3_000,
  completesAt: EXAMPLE_INSTANT_MS + 3_000,
  expiresAt: EXAMPLE_EXPIRES_AT + 3_000,
  responderCount: 0,
  newCount: 0,
  registeredCount: 0,
  interfaceCount: 1,
  created: false,
} as const satisfies CaptureDiscoverySearch;
const EXAMPLE_CANDIDATES = simCaptureCandidates();
const EXAMPLE_TESTED = { outcome: CaptureConnectionOutcome.REACHABLE, authenticated: false, testedAt: EXAMPLE_INSTANT_MS } as const;
/** The device operation 96 answers for the simulator's first candidate. */
export const SIM_ADOPTED_DEVICE = {
  id: SIM_ADOPTED_DEVICE_ID,
  kind: 'CAMERA',
  model: 'Test source',
  firmware: null,
  host: SIM_HOST,
  poePort: null,
  online: true,
  streamState: null,
  capabilities: ['VIDEO'],
  adapter: SIM_CAPTURE_ADAPTER,
  sourceClass: CaptureSourceClass.DEVELOPMENT,
} as const satisfies z.output<typeof CaptureDeviceStatusSchema>;
/** Placeholders only: an example never carries anything that reads like a real credential (E-30). */
const EXAMPLE_CREDENTIAL = { username: 'USERNAME', secret: 'SECRET' } as const satisfies CaptureCredentialWriteRequest;

const webConsoleOnly = (operationId: string) => ({
  summary: 'A tablet or phone session on a web-console-only operation',
  description: 'The caller holds CAPTURE_CONFIG, but the session is bound to a paired device. One ACCESS_DENIED row is written; the body is not used.',
  value: apiErrorExample('NOT_PERMITTED', 'Your role does not allow this action. The attempt was audited.', {
    operationId,
    permission: Permission.CAPTURE_CONFIG,
    role: 'TECHNICIAN',
    reason: WEB_CONSOLE_ONLY_REASON,
  }),
});
const refusal = (summary: string, code: string, message: string, details: Record<string, string>) => ({ summary, value: apiErrorExample(code, message, details) });
const LOCKED = refusal('A session is open', 'CAPTURE_CONFIG_LOCKED', 'The capture configuration cannot be changed while a session is open.', { simCode: 'CAPTURE_CONFIG_LOCKED' });
const NO_CANDIDATE = { notFound: refusal('No such candidate in this session\'s search', 'NOT_FOUND', 'No candidate has this ID.', { simCode: 'NOT_FOUND' }) } as const;
const ALREADY_REGISTERED = refusal('The candidate is a registered capture device', 'INVALID_STATE', 'This camera is already a capture device.', {
  reason: CaptureDiscoveryReason.CANDIDATE_ALREADY_REGISTERED,
  deviceId: 'CAM-01',
});

export const CAPTURE_DISCOVERY_EXAMPLES: Readonly<Record<string, OperationExamples>> = {
  startCaptureDiscovery: {
    responses: {
      200: { running: { summary: 'The caller\'s own search is still running', value: EXAMPLE_RUNNING_SEARCH } },
      202: { started: { summary: 'The simulator\'s search: complete at once, two responders', value: EXAMPLE_SEARCH } },
      401: SIGNED_OUT,
      403: deniedExamples('startCaptureDiscovery', 'CAPTURE_CONFIG', 'INVESTIGATOR'),
      409: {
        inProgress: refusal('Another session\'s search is running', 'INVALID_STATE', 'Another camera search is running. Try again shortly.', {
          reason: CaptureDiscoveryReason.DISCOVERY_IN_PROGRESS,
        }),
        recording: refusal('Searching during a recording is switched off', 'INVALID_STATE', 'A camera search cannot run while a session is recording.', {
          reason: CaptureDiscoveryReason.DISCOVERY_NOT_ALLOWED_WHILE_RECORDING,
        }),
      },
    },
  },
  getCaptureDiscovery: {
    responses: {
      200: {
        none: { summary: 'No live search in this session', value: { search: null, candidates: [], truncated: false } satisfies CaptureDiscoveryStateBody },
        complete: {
          summary: 'A complete search: one new test source, one registered camera',
          value: { search: { ...EXAMPLE_SEARCH, created: false }, candidates: EXAMPLE_CANDIDATES, truncated: false } satisfies CaptureDiscoveryStateBody,
        },
      },
      401: SIGNED_OUT,
      403: deniedExamples('getCaptureDiscovery', 'CAPTURE_CONFIG', 'INVESTIGATOR'),
    },
  },
  testCaptureCandidateConnection: {
    pathParams: { id: SIM_CAPTURE_CANDIDATE_IDS.fresh },
    request: {
      development: { summary: 'A test source on loopback: no credential', value: {} satisfies CaptureConnectionTestRequest },
      credential: { summary: 'With a credential (placeholders; the value never returns)', value: { credential: EXAMPLE_CREDENTIAL } satisfies CaptureConnectionTestRequest },
    },
    responses: {
      200: {
        reachable: {
          summary: 'The camera answered and has a usable H.264 profile',
          value: { candidateId: SIM_CAPTURE_CANDIDATE_IDS.fresh, ...EXAMPLE_TESTED, usableProfileCount: 1, failedAttemptsRemaining: 2 } satisfies CaptureConnectionTest,
        },
        authenticationFailed: {
          summary: 'The camera refused the credential: a result, not an error',
          value: {
            candidateId: SIM_CAPTURE_CANDIDATE_IDS.fresh,
            outcome: CaptureConnectionOutcome.AUTHENTICATION_FAILED,
            authenticated: true,
            testedAt: EXAMPLE_INSTANT_MS,
            usableProfileCount: 0,
            failedAttemptsRemaining: 1,
          } satisfies CaptureConnectionTest,
        },
      },
      400: { invalidJson: ERROR_EXAMPLES.invalidJson },
      401: SIGNED_OUT,
      403: { ...deniedExamples('testCaptureCandidateConnection', 'CAPTURE_CONFIG', 'INVESTIGATOR'), webConsoleOnly: webConsoleOnly('testCaptureCandidateConnection') },
      404: NO_CANDIDATE,
      409: { locked: LOCKED, alreadyRegistered: ALREADY_REGISTERED },
      422: {
        invalidInput: ERROR_EXAMPLES.invalidInput,
        credentialRequired: refusal('A production camera without a credential', 'INVALID_INPUT', 'A credential is needed to test this camera.', {
          in: 'body',
          reason: CaptureDiscoveryReason.CREDENTIAL_REQUIRED,
        }),
      },
    },
  },
  adoptCaptureCandidate: {
    pathParams: { id: SIM_CAPTURE_CANDIDATE_IDS.fresh },
    request: {
      development: { summary: 'A test source that was tested without a credential', value: {} satisfies CaptureCandidateAdoptRequest },
      credential: { summary: 'With the credential the test passed with (placeholders; the value never returns)', value: { credential: EXAMPLE_CREDENTIAL } satisfies CaptureCandidateAdoptRequest },
    },
    responses: {
      201: {
        adopted: {
          summary: 'The new capture device; no credential stored',
          value: { deviceId: SIM_ADOPTED_DEVICE_ID, device: { ...SIM_ADOPTED_DEVICE, capabilities: [...SIM_ADOPTED_DEVICE.capabilities] }, credentialSet: false } satisfies CaptureCandidateAdoption,
        },
      },
      400: { invalidJson: ERROR_EXAMPLES.invalidJson },
      401: SIGNED_OUT,
      403: { ...deniedExamples('adoptCaptureCandidate', 'CAPTURE_CONFIG', 'INVESTIGATOR'), webConsoleOnly: webConsoleOnly('adoptCaptureCandidate') },
      404: NO_CANDIDATE,
      409: {
        locked: LOCKED,
        alreadyRegistered: ALREADY_REGISTERED,
        notTested: refusal('No passing test that is still valid', 'INVALID_STATE', 'Test the connection to this camera first.', {
          reason: CaptureDiscoveryReason.CANDIDATE_NOT_TESTED,
        }),
      },
      422: {
        invalidInput: ERROR_EXAMPLES.invalidInput,
        credentialNotExpected: refusal('A credential although the test passed without one', 'INVALID_INPUT', 'This camera was tested without a credential.', {
          in: 'body',
          reason: CaptureDiscoveryReason.CREDENTIAL_NOT_EXPECTED,
        }),
      },
    },
  },
  rescanCaptureInputs: {
    responses: {
      200: {
        both: {
          summary: 'Both registered microphones are present',
          value: {
            scannedAt: EXAMPLE_INSTANT_MS,
            inputs: EXAMPLE_SLICES.captureConfig.mics.map((mic) => ({
              deviceId: mic.deviceId,
              inputId: mic.inputId,
              present: true,
              adapter: SIM_CAPTURE_ADAPTER,
              sourceClass: CaptureSourceClass.DEVELOPMENT,
              errorCode: null,
            })),
            unregisteredCount: 0,
          } satisfies CaptureInputScan,
        },
      },
      401: SIGNED_OUT,
      403: deniedExamples('rescanCaptureInputs', 'CAPTURE_CONFIG', 'INVESTIGATOR'),
    },
  },
};
