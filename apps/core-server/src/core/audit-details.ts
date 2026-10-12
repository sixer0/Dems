/**
 * The allow-list of audit details for the twenty-three server-written types (plan row W21; spec §13.1,
 * §4.6 RB-4 and RB-6, §6.2, §6.3; SR-54; task 3 M2-W7 blueprint row 48 adds the nine capture-phase
 * types of `C3 §5.2` — register CS-14; task 3 M6 blueprint row 113 adds `STT_CONFIG_CHANGED` of
 * `C3 §2.5` — R-8; task 3 blueprint row 132 (decision D106) adds the four of the camera search,
 * the connection test, the adoption and the no-device warning of `C3 §5.2` — R-9, R-10). Task 4
 * blueprint row 19 (WP-23a) adds the ten of the hardware-input port: the list now holds thirty-three.
 *
 * The types of this list are written by server-native modules only (the permission guard, pairing,
 * user administration, identity, and from task 3: the capture-config store, the mic switch, the
 * sealing/export jobs, the transcript revision path and the credential store). The specification
 * names the details of each one. For these types the audit writer accepts EXACTLY those keys, with
 * the value form given here, and refuses everything else before a statement is sent. So a module
 * cannot put a code, a token, a credential or a typed username into such a row by adding a key: no
 * such key exists (`C3 §5.1`; E-30/E-31 — no secret value ever appears in an audit detail key or
 * value; a signed URL or any prefix of it least of all).
 *
 * The other 44 types are the simulator's. Their details are whatever the shared code writes
 * (54 distinct key names); they get the general rules of `payload-rules.ts` and no list, so
 * the Live audit sequence stays equal to the simulator's (spec §13.2).
 *
 * "Device ID" in the specification's table is the row's own `deviceId`. A module may repeat it
 * in the details as `deviceId`; the list allows that for the three types that name a device.
 */
import {
  CAPTURE_CANDIDATE_ID_PATTERN,
  CAPTURE_DEVICE_UNREACHABLE_REASONS,
  CAPTURE_HOST_LITERAL_PATTERN,
  CAPTURE_SEARCH_ID_PATTERN,
  CaptureConnectionOutcome,
  CaptureConnectionTestReason,
  CaptureDiscoveryScope,
  CaptureDiscoveryTrigger,
  CaptureSourceClass,
  DEVICE_ID_PATTERN,
  HARDWARE_DEVICE_ID_PATTERN,
  MIC_INPUT_ID_PATTERN,
  OPERATOR_ID_PATTERN,
  PAIRING_CODE_ID_PATTERN,
  PairingCodeCloseReason,
  SESSION_ID_PATTERN,
  SHA256_HEX_PATTERN,
  STT_BACKENDS,
  STT_CONFIG_FIELDS,
} from '@dems/shared/api';
import { AuditType, OperatorRole, type DetailValue } from '@dems/shared/sim';
import { NATIVE_TEXT_MAX_LENGTH } from './limits';

export interface DetailRule {
  /** Without a `?` in the specification's table. */
  readonly required: boolean;
  /** The form of the value, in words, for the refusal message. */
  readonly form: string;
  accepts(value: DetailValue): boolean;
}

const ROLES: ReadonlySet<string> = new Set(Object.values(OperatorRole));
/**
 * How a pairing code can close (spec §6.2 T3 to T5): the contract's `PairingCodeCloseReason`
 * (review finding W91-4), in this order for the refusal message.
 */
export const PAIRING_CODE_CLOSE_REASONS = [
  PairingCodeCloseReason.CANCELLED,
  PairingCodeCloseReason.EXPIRED,
  PairingCodeCloseReason.EXHAUSTED,
] as const satisfies readonly PairingCodeCloseReason[];
const CLOSE_REASONS: ReadonlySet<string> = new Set(PAIRING_CODE_CLOSE_REASONS);

const matching = (pattern: RegExp, form: string) => (required: boolean): DetailRule => ({
  required,
  form,
  accepts: (value) => typeof value === 'string' && pattern.test(value),
});

const operationId = matching(/^[a-z][A-Za-z0-9]{0,63}$/, 'an operation ID of the contract registry');
const code = matching(/^[A-Z][A-Z0-9_]{0,63}$/, 'a SCREAMING_SNAKE_CASE code');
const operatorId = matching(OPERATOR_ID_PATTERN, 'an operator ID');
const deviceId = matching(DEVICE_ID_PATTERN, 'a registry device ID');
const pairingCodeId = matching(PAIRING_CODE_ID_PATTERN, 'a pairing code ID (never the code)');
// Task 3 M2-W7 (C3 §5.2): the forms the nine capture-phase lists name.
const micInputId = matching(MIC_INPUT_ID_PATTERN, 'a mic input (MIC-NN)');
const hardwareDeviceId = matching(HARDWARE_DEVICE_ID_PATTERN, 'a Core hardware device id (CAM-01, MIC-02, POE-SWITCH)');
const sha256Hex = matching(SHA256_HEX_PATTERN, 'a SHA-256 as 64 lower-case hex characters');
const revisionId = matching(/^TRV-\d{6,}$/, 'a transcript revision id (TRV-NNNNNN)');
const jobId = matching(/^EXPJ-\d{6,}$/, 'an export job id (EXPJ-NNNNNN)');
/** A closed word list, e.g. the scopes of CAPTURE_CONFIG_CHANGED. Membership only; never free text. */
const oneOf = (values: readonly string[], form: string) => (required: boolean): DetailRule => {
  const set: ReadonlySet<string> = new Set(values);
  return { required, form, accepts: (value) => typeof value === 'string' && set.has(value) };
};
/** Any finite number (dBFS may be negative; media pts and durations are counts). */
const finiteNumber = (required: boolean): DetailRule => ({
  required,
  form: 'a finite number',
  accepts: (value) => typeof value === 'number' && Number.isFinite(value),
});
/** The `from`/`to` of CAPTURE_CONFIG_CHANGED: the previous/new value — a mic role or a capture device id (C3 §5.2). */
const configValue = (required: boolean): DetailRule => ({
  required,
  form: 'the previous or new value: PRIMARY, STANDBY, or a Core hardware device id',
  accepts: (value) => typeof value === 'string' && (value === 'PRIMARY' || value === 'STANDBY' || HARDWARE_DEVICE_ID_PATTERN.test(value)),
});

const role = (required: boolean): DetailRule => ({
  required,
  form: 'a role',
  accepts: (value) => typeof value === 'string' && ROLES.has(value),
});
const closeReason = (required: boolean): DetailRule => ({
  required,
  form: `one of ${PAIRING_CODE_CLOSE_REASONS.join(', ')}`,
  accepts: (value) => typeof value === 'string' && CLOSE_REASONS.has(value),
});
/** A reason an operator typed. Free text: the general rules still refuse a credential form. */
const reasonText = (required: boolean): DetailRule => ({
  required,
  form: `a text of 1 to ${NATIVE_TEXT_MAX_LENGTH} characters`,
  accepts: (value) => typeof value === 'string' && value.length >= 1 && value.length <= NATIVE_TEXT_MAX_LENGTH,
});
const count = (required: boolean): DetailRule => ({
  required,
  form: 'a whole number of 0 or more',
  accepts: (value) => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0,
});
const flag = (required: boolean): DetailRule => ({
  required,
  form: 'true or false',
  accepts: (value) => typeof value === 'boolean',
});

/**
 * `changedFields` of STT_CONFIG_CHANGED (C3 §2.5): field NAMES of the closed set `STT_CONFIG_FIELDS`,
 * joined with a comma, each at most once. Membership only: the rule has no room for a value of the
 * endpoint, the model, the credential or its reference target (E-30/E-31; SEC35-14).
 */
const STT_FIELD_NAMES: ReadonlySet<string> = new Set(STT_CONFIG_FIELDS);
const sttFieldNames = (required: boolean): DetailRule => ({
  required,
  form: `one or more of ${STT_CONFIG_FIELDS.join(', ')}, comma-separated, each once`,
  accepts: (value) => {
    if (typeof value !== 'string' || value === '') return false;
    const names = value.split(',');
    return names.every((name) => STT_FIELD_NAMES.has(name)) && new Set(names).size === names.length;
  },
});
/** A revision of an optimistic lock: a whole number of 1 or more. */
const revisionNumber = (required: boolean): DetailRule => ({
  required,
  form: 'a whole number of 1 or more',
  accepts: (value) => typeof value === 'number' && Number.isSafeInteger(value) && value >= 1,
});

// Task 3 R-9, R-10 (blueprint row 132; C3 §5.2): the forms the four lists of the camera search name.
const searchId = matching(CAPTURE_SEARCH_ID_PATTERN, 'a search id (DSC-NNNNNN)');
const candidateId = matching(CAPTURE_CANDIDATE_ID_PATTERN, 'a candidate id (CND- and 12 hex digits)');
const sessionId = matching(SESSION_ID_PATTERN, 'a session ID');
/** The address an answer came from: an IP literal. Never a URL and never `user:password@` (C-N8; D86 C-3). */
const hostLiteral = matching(CAPTURE_HOST_LITERAL_PATTERN, 'an IP literal (never a URL)');
/**
 * The announced endpoint reference of a PRODUCTION candidate (D86 C-3; pass D1a, D132): the ONE
 * form ONVIF defines for it — `urn:uuid:` and a UUID (cap §A.6.1 V-7; the example of C3 §5.2) —
 * and nothing else. The value is text a device announced, so the rule is a closed form, not a
 * length: an audit row cannot hold a free text here, whatever a device (or a caller that passed
 * the wrong member) supplies. A writer drops a reference of any other form before it builds the
 * row (`auditEndpointRef` of the connect flow).
 */
const ENDPOINT_REF_URN = /^urn:uuid:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const endpointRef = (required: boolean): DetailRule => ({
  required,
  form: 'an endpoint reference of the form urn:uuid:<UUID>',
  accepts: (value) => typeof value === 'string' && ENDPOINT_REF_URN.test(value),
});

// ── Task 4 (blueprint row 19, WP-23a): the closed sets and forms the ten lists of the hardware-input
// port name. Exported where a writer has to state one of the values, so that it binds to the same
// list the audit writer checks (the module rows 45, 70, 106 to 111, 115 import them; none adds one).
/**
 * `reason` of CAPTURE_CREDENTIAL_REVEALED (security addendum 04, AD-03 (1)): the closed set of three.
 * The adapter's reader can say `SESSION_OPEN` and `RELAY_RESTART`, the connection test's
 * `CONNECTION_TEST`; neither takes a reason from its caller, and no other reason exists.
 */
export const CAPTURE_CREDENTIAL_REVEAL_REASONS = ['SESSION_OPEN', 'RELAY_RESTART', 'CONNECTION_TEST'] as const;
export type CaptureCredentialRevealReason = (typeof CAPTURE_CREDENTIAL_REVEAL_REASONS)[number];
/**
 * `scope` of CAPTURE_DISCOVERY_SEARCHED: the two of the shared contract and the third of design
 * addendum 04 section 4.2, the listing of sound cards (`searchCaptureAudioCards`). The literal is
 * stated here until the shared `CaptureDiscoveryScope` carries it (request of row 19); the set
 * makes the two the same value, so that landing changes nothing in this rule.
 */
export const CAPTURE_DISCOVERY_AUDIT_SCOPES: readonly string[] = [...new Set<string>([...Object.values(CaptureDiscoveryScope), 'AUDIO_CARDS'])];
/** `change` of CAPTURE_AUDIO_INPUT_CHANGED (design addendum 04 section 4.2). */
export const CAPTURE_AUDIO_INPUT_CHANGES = ['REGISTERED', 'CARD_CHANGED', 'REENABLED'] as const;
/** The six settings of `capture_network_config` an operator can change (schema extension 03 section 2.4), by member name. */
export const CAPTURE_NETWORK_CONFIG_FIELDS = ['interfaceName', 'cameraSubnet', 'factoryAddresses', 'aliasHost', 'aliasMinutes', 'cameraIpStart'] as const;
/** Why a temporary host address was added, and how it left (schema extension 03 section 2.5: `HOST_ALIAS_REASON`, `HOST_ALIAS_REMOVE_REASON`). */
export const HOST_ALIAS_AUDIT_REASONS = ['FACTORY_SCAN', 'SET_CAMERA_ADDRESS'] as const;
export const HOST_ALIAS_AUDIT_REMOVE_REASONS = ['EXPIRED', 'MANUAL', 'JOB_DONE', 'BOOT_SWEEP'] as const;
/** `phase` of CAMERA_NETWORK_SET: written before the call as well as after it (schema extension 03 section 2.5, the recommendation to WP-23). */
export const CAMERA_NETWORK_SET_PHASES = ['REQUESTED', 'COMPLETED', 'FAILED'] as const;

/** The id of a row whose key is a random UUID (`host_network_aliases.id`, `installation_acceptances.id`). */
const rowUuid = matching(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/, 'a row id (a lower-case UUID)');
/** A dotted IPv4 literal, each part 0 to 255. Never a URL, a name, a prefix length or `user:password@`. */
const IPV4_LITERAL = /^(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.){3}(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)$/;
const ipv4Literal = matching(IPV4_LITERAL, 'an IPv4 literal (never a URL)');
/** A hardware address in its one closed form: six pairs of upper-case hex digits with colons. */
const macAddress = matching(/^[0-9A-F]{2}(?::[0-9A-F]{2}){5}$/, 'a MAC address (AA:BB:CC:DD:EE:FF)');
/** `changedFields` of CAPTURE_NETWORK_CONFIG_CHANGED: field NAMES of the closed set, comma-separated, each once (the pattern of `sttFieldNames`). Never a value. */
const NETWORK_FIELD_NAMES: ReadonlySet<string> = new Set(CAPTURE_NETWORK_CONFIG_FIELDS);
const networkFieldNames = (required: boolean): DetailRule => ({
  required,
  form: `one or more of ${CAPTURE_NETWORK_CONFIG_FIELDS.join(', ')}, comma-separated, each once`,
  accepts: (value) => {
    if (typeof value !== 'string' || value === '') return false;
    const names = value.split(',');
    return names.every((name) => NETWORK_FIELD_NAMES.has(name)) && new Set(names).size === names.length;
  },
});

const REQUIRED = true;
const OPTIONAL = false;

/**
 * Type, then key, then rule. The keys are those of spec §13.1; `reason` of `ACCESS_DENIED` is a
 * code such as `DEVICE_REVOKED` (RB-6), every other `reason` is what an operator typed, except
 * the close reason of a pairing code, which is one of three values.
 */
export const SERVER_AUDIT_DETAIL_RULES = {
  [AuditType.ACCESS_DENIED]: {
    operationId: operationId(REQUIRED),
    permission: code(OPTIONAL),
    role: role(OPTIONAL),
    reason: code(OPTIONAL),
  },
  [AuditType.PAIRING_CODE_ISSUED]: {
    codeId: pairingCodeId(REQUIRED),
    expiresAt: count(REQUIRED),
  },
  [AuditType.PAIRING_CODE_CLOSED]: {
    codeId: pairingCodeId(REQUIRED),
    reason: closeReason(REQUIRED),
  },
  [AuditType.DEVICE_REVOKED]: {
    reason: reasonText(REQUIRED),
    sessionsEnded: count(REQUIRED),
    deviceId: deviceId(OPTIONAL),
  },
  [AuditType.DEVICE_CREDENTIAL_ROTATED]: {
    deviceId: deviceId(OPTIONAL),
  },
  [AuditType.ROLE_CHANGED]: {
    targetOperatorId: operatorId(REQUIRED),
    from: role(REQUIRED),
    to: role(REQUIRED),
    reason: reasonText(OPTIONAL),
  },
  [AuditType.USER_ENABLED]: {
    targetOperatorId: operatorId(REQUIRED),
    reason: reasonText(OPTIONAL),
  },
  [AuditType.USER_DISABLED]: {
    targetOperatorId: operatorId(REQUIRED),
    sessionsEnded: count(REQUIRED),
    reason: reasonText(OPTIONAL),
  },
  [AuditType.BIOMETRIC_ENROLLMENT_CHANGED]: {
    enabled: flag(REQUIRED),
    deviceId: deviceId(OPTIONAL),
  },
  // ── Task 3 M2-W7 (blueprint row 48; register CS-14; C3 §5.2): the nine capture-phase types ──
  // Exact key lists, no secret keys: no list holds a credential, token, key, password, pairing
  // code, typed username, raw camera credential value or signed URL (§5.1; E-30/E-31; M2-AUD-1).
  // The hardware device ids are the capture registry ids (CAM-nn / MIC-nn / POE-…); C3 §5.2's
  // "(DEVICE_ID_PATTERN)" note is an erratum — DEVICE_ID_PATTERN is the PAIRED-client form
  // (DEV-NNNN), which only sendingDeviceId uses here (row-47 D-c-2 idiom: pattern follows truth).
  [AuditType.CAPTURE_CONFIG_CHANGED]: {
    operationId: operationId(REQUIRED),
    scope: oneOf(['CONFIG', 'CAMERA', 'MIC'], 'one of CONFIG, CAMERA, MIC')(REQUIRED),
    field: oneOf(['CAMERAS', 'MICS', 'SOURCE', 'ROLE'], 'one of CAMERAS, MICS, SOURCE, ROLE')(REQUIRED),
    trackId: oneOf(['VIDEO-01', 'VIDEO-02'], 'VIDEO-01 or VIDEO-02')(OPTIONAL),
    // D145: the numbered mic rule of the shared contract (`MIC-NN`).
    inputId: micInputId(OPTIONAL),
    deviceId: hardwareDeviceId(OPTIONAL),
    from: configValue(OPTIONAL),
    to: configValue(OPTIONAL),
    permission: code(OPTIONAL),
  },
  [AuditType.AUDIO_SOURCE_SWITCHED]: {
    // D144 (D133(1); row 71b): any numbered mic input the registry accepts, by the shared contract's pattern.
    fromInput: micInputId(REQUIRED),
    toInput: micInputId(REQUIRED),
    fromMs: count(REQUIRED),
    toMs: count(REQUIRED),
    // SEC35-17: REQUIRED when the actor is a paired device (B15/OD-09); the writer cannot see the
    // actor, so the key is optional here and the switch module enforces presence for a device
    // actor — a web operator session may omit it (C3 §5.2).
    sendingDeviceId: deviceId(OPTIONAL),
  },
  [AuditType.CAMERA_POE_CYCLED]: {
    deviceId: hardwareDeviceId(REQUIRED),
    poePort: oneOf(['POE_CAM_1', 'POE_CAM_2_AUX'], 'one of POE_CAM_1, POE_CAM_2_AUX')(REQUIRED),
    streamWasLost: flag(REQUIRED),
    confirmed: flag(REQUIRED),
    gapFromMs: count(OPTIONAL),
    gapToMs: count(OPTIONAL),
  },
  [AuditType.TRANSCRIPT_REVISED]: {
    revisionId: revisionId(REQUIRED),
    authorId: operatorId(REQUIRED),
    number: count(REQUIRED),
    baseRevision: count(REQUIRED),
    changeCount: count(REQUIRED),
    machineTranscriptHash: sha256Hex(REQUIRED),
    // The operator's note (C3 §5.2 "reason?: text"): free text of the typed-text bound; the
    // general rules still refuse any secret form. NEVER the transcript body or segment text.
    reason: reasonText(OPTIONAL),
    permission: code(OPTIONAL),
  },
  [AuditType.MIC_SILENT]: {
    // D145: the numbered mic rule of the shared contract (`MIC-NN`).
    inputId: micInputId(REQUIRED),
    thresholdDbfs: finiteNumber(REQUIRED),
    durationMs: count(REQUIRED),
    sinceMs: count(REQUIRED),
    active: flag(REQUIRED),
  },
  [AuditType.EVIDENCE_MEDIA_SERVED]: {
    fileId: oneOf(['VIDEO-01', 'VIDEO-02'], 'VIDEO-01 or VIDEO-02')(REQUIRED),
    bytesServed: count(REQUIRED),
    rangeStart: count(OPTIONAL),
    rangeEnd: count(OPTIONAL),
    signed: flag(REQUIRED),
    expiresAt: count(OPTIONAL),
  },
  [AuditType.EVIDENCE_EXPORT_FAILED]: {
    jobId: jobId(REQUIRED),
    kind: oneOf(['PACKAGE', 'COMPOSITE'], 'one of PACKAGE, COMPOSITE')(REQUIRED),
    reason: code(REQUIRED),
  },
  [AuditType.CAPTURE_CREDENTIAL_SET]: {
    // RK-12 / SEC35-01 / M2-CRD-1: the FACT of the write only. Never the username, the secret,
    // the ciphertext, the nonce or the key.
    deviceId: hardwareDeviceId(REQUIRED),
    operationId: operationId(REQUIRED),
    permission: code(OPTIONAL),
  },
  [AuditType.CAPTURE_CREDENTIAL_REVEALED]: {
    // SEC35-02: the reveal writes the fact only. Erratum (task 4, design addendum 04 section 2.3): the
    // writer is the credential reader of the capture adapters, not a "supervisor reveal path".
    // AD-03 (1) (blueprint row 19): `reason` is the closed set of three, no longer any code.
    deviceId: hardwareDeviceId(REQUIRED),
    reason: oneOf(CAPTURE_CREDENTIAL_REVEAL_REASONS, `one of ${CAPTURE_CREDENTIAL_REVEAL_REASONS.join(', ')}`)(REQUIRED),
  },
  [AuditType.STT_CONFIG_CHANGED]: {
    // C3 §2.5 (blueprint row 113; R-8): exactly these five keys. Field NAMES and two flags; never
    // the endpoint, the model path, the credential or its reference target.
    changedFields: sttFieldNames(REQUIRED),
    enabled: flag(REQUIRED),
    backend: oneOf(STT_BACKENDS, `one of ${STT_BACKENDS.join(', ')}`)(REQUIRED),
    credentialChanged: flag(REQUIRED),
    revision: revisionNumber(REQUIRED),
  },
  // ── Task 3 R-9, R-10 (blueprint row 132, decision D106; C3 §5.2 "the four audit types of the
  // row-121 delta"; M4-AUD-1): exact key lists. No list holds a username, a secret, a URL, a label
  // or any text a device announced; `host` and `endpointRef` are written for a PRODUCTION candidate
  // only (D86 C-3) — the builders of `@dems/shared/api` drop them for any other class. The key is
  // `endpointRef`, never `onvifUuid` (a forbidden key).
  [AuditType.CAPTURE_DISCOVERY_SEARCHED]: {
    searchId: searchId(REQUIRED),
    // Task 4 (blueprint row 19; design addendum 04 section 4.2): the third scope, the sound-card listing.
    scope: oneOf(CAPTURE_DISCOVERY_AUDIT_SCOPES, `one of ${CAPTURE_DISCOVERY_AUDIT_SCOPES.join(', ')}`)(REQUIRED),
    trigger: oneOf(Object.values(CaptureDiscoveryTrigger), 'one of MANUAL, PRECHECK')(REQUIRED),
    outcome: oneOf(['COMPLETE', 'FAILED'], 'one of COMPLETE, FAILED')(REQUIRED),
    responderCount: count(REQUIRED),
    newCount: count(REQUIRED),
    registeredCount: count(REQUIRED),
    // A count of interfaces probed: never a name or an address (erratum PE-128-28; SEC35-30).
    interfaceCount: count(REQUIRED),
    failureReason: code(OPTIONAL),
    sessionId: sessionId(OPTIONAL),
    operationId: operationId(OPTIONAL),
    permission: code(OPTIONAL),
  },
  [AuditType.CAPTURE_CONNECTION_TESTED]: {
    candidateId: candidateId(REQUIRED),
    searchId: searchId(REQUIRED),
    outcome: oneOf(Object.values(CaptureConnectionOutcome), 'one of the five connection-test outcomes')(REQUIRED),
    // Whether a credential was supplied: a fact, never a value.
    authenticated: flag(REQUIRED),
    adapter: code(REQUIRED),
    sourceClass: oneOf(Object.values(CaptureSourceClass), 'one of PRODUCTION, DEVELOPMENT')(REQUIRED),
    operationId: oneOf(['testCaptureCandidateConnection', 'adoptCaptureCandidate'], 'testCaptureCandidateConnection or adoptCaptureCandidate')(REQUIRED),
    host: hostLiteral(OPTIONAL),
    endpointRef: endpointRef(OPTIONAL),
    guardTripped: flag(OPTIONAL),
    // Fix wave I (G70b-05): present only for a test that ended AUTHENTICATION_FAILED without the credential being sent (the closed code of operation 95's `reason`).
    reason: oneOf(Object.values(CaptureConnectionTestReason), 'SCHEME_NOT_ALLOWED')(OPTIONAL),
    permission: code(OPTIONAL),
  },
  [AuditType.CAPTURE_CANDIDATE_ADOPTED]: {
    deviceId: hardwareDeviceId(REQUIRED),
    candidateId: candidateId(REQUIRED),
    searchId: searchId(REQUIRED),
    adapter: code(REQUIRED),
    sourceClass: oneOf(Object.values(CaptureSourceClass), 'one of PRODUCTION, DEVELOPMENT')(REQUIRED),
    credentialSet: flag(REQUIRED),
    operationId: oneOf(['adoptCaptureCandidate'], 'adoptCaptureCandidate')(REQUIRED),
    host: hostLiteral(OPTIONAL),
    endpointRef: endpointRef(OPTIONAL),
    permission: code(OPTIONAL),
  },
  [AuditType.CAPTURE_DEVICE_UNREACHABLE]: {
    deviceId: hardwareDeviceId(REQUIRED),
    deviceKind: oneOf(['CAMERA', 'MIC'], 'CAMERA or MIC')(REQUIRED),
    phase: oneOf(['PRECHECK', 'SESSION_START'], 'PRECHECK or SESSION_START')(REQUIRED),
    reason: oneOf(CAPTURE_DEVICE_UNREACHABLE_REASONS, 'one of the eight unreachable reasons of C3 §5.2')(REQUIRED),
    degraded: flag(REQUIRED),
    sessionId: sessionId(REQUIRED),
  },
  // ── Task 4 (blueprint row 19, WP-23a; design addendum 04 sections 4.2, 8.2; schema extension 03
  // sections 2.2, 2.4, 2.5, 2.6): the ten types of the hardware-input port, exact key lists. Ids,
  // closed codes, counts and IP literals only. No list holds a product or card name, a USB id, an
  // interface name, a subnet, a username, a secret, a URL or any text a device announced (S13-12 (b)).
  // `operationId` and `permission` are optional on each, as on the lists of row 132: a row written
  // by a timer or at boot (an alias that expired, the boot sweep) has neither.
  [AuditType.CAPTURE_AUDIO_INPUT_CHANGED]: {
    // Design addendum 04 section 4.2: device id, change code, input number, channel count. No device text.
    deviceId: hardwareDeviceId(REQUIRED),
    change: oneOf(CAPTURE_AUDIO_INPUT_CHANGES, `one of ${CAPTURE_AUDIO_INPUT_CHANGES.join(', ')}`)(REQUIRED),
    inputNumber: count(REQUIRED),
    channelCount: count(REQUIRED),
    operationId: operationId(OPTIONAL),
    permission: code(OPTIONAL),
  },
  [AuditType.CAPTURE_NETWORK_CONFIG_CHANGED]: {
    // Schema extension 03 section 2.4: the NAMES of the changed fields (the pattern of STT_CONFIG_CHANGED), never a value.
    changedFields: networkFieldNames(REQUIRED),
    revision: revisionNumber(REQUIRED),
    operationId: operationId(OPTIONAL),
    permission: code(OPTIONAL),
  },
  [AuditType.HOST_ALIAS_ADDED]: {
    // Schema extension 03 section 2.5: the row's id, the address put on the camera interface (an IPv4
    // literal; the interface is not named, SEC35-30), why, and when it ends.
    aliasId: rowUuid(REQUIRED),
    address: ipv4Literal(REQUIRED),
    reason: oneOf(HOST_ALIAS_AUDIT_REASONS, `one of ${HOST_ALIAS_AUDIT_REASONS.join(', ')}`)(REQUIRED),
    expiresAt: count(REQUIRED),
    operationId: operationId(OPTIONAL),
    permission: code(OPTIONAL),
  },
  [AuditType.HOST_ALIAS_REMOVED]: {
    aliasId: rowUuid(REQUIRED),
    address: ipv4Literal(REQUIRED),
    removeReason: oneOf(HOST_ALIAS_AUDIT_REMOVE_REASONS, `one of ${HOST_ALIAS_AUDIT_REMOVE_REASONS.join(', ')}`)(REQUIRED),
    operationId: operationId(OPTIONAL),
    permission: code(OPTIONAL),
  },
  [AuditType.HOST_ALIAS_REMOVE_FAILED]: {
    // `failureReason` is the code stored as `remove_error`: a code, never the helper's error text.
    aliasId: rowUuid(REQUIRED),
    address: ipv4Literal(REQUIRED),
    removeReason: oneOf(HOST_ALIAS_AUDIT_REMOVE_REASONS, `one of ${HOST_ALIAS_AUDIT_REMOVE_REASONS.join(', ')}`)(REQUIRED),
    failureReason: code(REQUIRED),
    operationId: operationId(OPTIONAL),
    permission: code(OPTIONAL),
  },
  [AuditType.CAMERA_FACTORY_SCANNED]: {
    // The commissioning scan (WP-19c): counts of addresses asked and of answers, never the addresses
    // or what answered. `searchId` when the answers join a candidate list; `aliasId` when a temporary
    // host address served the scan.
    outcome: oneOf(['COMPLETE', 'FAILED'], 'one of COMPLETE, FAILED')(REQUIRED),
    addressCount: count(REQUIRED),
    responderCount: count(REQUIRED),
    searchId: searchId(OPTIONAL),
    aliasId: rowUuid(OPTIONAL),
    failureReason: code(OPTIONAL),
    operationId: operationId(OPTIONAL),
    permission: code(OPTIONAL),
  },
  [AuditType.CAMERA_NETWORK_SET]: {
    // The set-IP job (WP-22b): one row when the change is requested and one when it ends, so that a
    // Core that dies during the wait leaves a trace. The typed credential of the job joins no key.
    phase: oneOf(CAMERA_NETWORK_SET_PHASES, `one of ${CAMERA_NETWORK_SET_PHASES.join(', ')}`)(REQUIRED),
    fromAddress: ipv4Literal(REQUIRED),
    toAddress: ipv4Literal(REQUIRED),
    mac: macAddress(OPTIONAL),
    deviceId: hardwareDeviceId(OPTIONAL),
    candidateId: candidateId(OPTIONAL),
    aliasId: rowUuid(OPTIONAL),
    failureReason: code(OPTIONAL),
    guardTripped: flag(OPTIONAL),
    operationId: operationId(OPTIONAL),
    permission: code(OPTIONAL),
  },
  [AuditType.CAPTURE_DEVICE_ADDRESS_CHANGED]: {
    // `capture_devices.address` of a registered camera changed: the two IP literals and a code for why.
    deviceId: hardwareDeviceId(REQUIRED),
    fromAddress: hostLiteral(REQUIRED),
    toAddress: hostLiteral(REQUIRED),
    reason: code(REQUIRED),
    operationId: operationId(OPTIONAL),
    permission: code(OPTIONAL),
  },
  [AuditType.INSTALLATION_ACCEPTED]: {
    // Schema extension 03 section 2.6: the record id and counts only; the record itself is the table row.
    acceptanceId: rowUuid(REQUIRED),
    stepCount: count(REQUIRED),
    passedCount: count(REQUIRED),
    operationId: operationId(OPTIONAL),
    permission: code(OPTIONAL),
  },
  [AuditType.INSTALLATION_ACCEPTANCE_REVOKED]: {
    // The typed revoke reason stays in the table row (`revoke_reason`); the audit row names the record.
    acceptanceId: rowUuid(REQUIRED),
    operationId: operationId(OPTIONAL),
    permission: code(OPTIONAL),
  },
} as const satisfies Partial<Record<AuditType, Readonly<Record<string, DetailRule>>>>;

/**
 * The thirty-three types that have a list (nine of the backend task, nine of the capture phase, one
 * of R-8, four of R-9 / R-10, ten of task 4 blueprint row 19).
 */
export type ServerAuditType = keyof typeof SERVER_AUDIT_DETAIL_RULES;

/** The list of `type`, or undefined for one of the simulator's 44 types (77 minus the 33 listed here). */
export function detailRulesOf(type: AuditType): Readonly<Record<string, DetailRule>> | undefined {
  return (SERVER_AUDIT_DETAIL_RULES as Partial<Record<AuditType, Readonly<Record<string, DetailRule>>>>)[type];
}
