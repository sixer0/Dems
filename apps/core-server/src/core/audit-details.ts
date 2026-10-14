/**
 * The allow-list of audit details for the twenty-three server-written types (plan row W21; spec §13.1,
 * §4.6 RB-4 and RB-6, §6.2, §6.3; SR-54; task 3 M2-W7 blueprint row 48 adds the nine capture-phase
 * types of `C3 §5.2` — register CS-14; task 3 M6 blueprint row 113 adds `STT_CONFIG_CHANGED` of
 * `C3 §2.5` — R-8; task 3 blueprint row 132 (decision D106) adds the four of the camera search,
 * the connection test, the adoption and the no-device warning of `C3 §5.2` — R-9, R-10). Task 4
 * blueprint row 19 (WP-23a) adds the ten of the hardware-input port, blueprint row 201 (X-C) the
 * one of the password command, and row V3 (the third vocabulary step; decisions C53, C57, C58, C62)
 * the four of the alias intent, the failed alias add, the audio gap of a worker restart and the
 * stored-credential connection test: the list now holds thirty-eight.
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
  CAPTURE_CAMERA_DEVICE_ID_PATTERN,
  CAPTURE_CANDIDATE_ID_PATTERN,
  CAPTURE_DEVICE_TEST_AUDIT_DIFFERING_MAX,
  CAPTURE_DEVICE_TEST_AUDIT_PROFILES_MAX,
  CAPTURE_DEVICE_UNREACHABLE_REASONS,
  CAPTURE_HOST_LITERAL_PATTERN,
  CAPTURE_NETWORK_CONFIG_FIELDS as CONTRACT_NETWORK_CONFIG_FIELDS,
  CAPTURE_NETWORK_CONFIG_LIMITS,
  CAPTURE_SEARCH_ID_PATTERN,
  CaptureConnectionOutcome,
  CaptureConnectionTestReason,
  CaptureDeviceTestProfiles,
  CaptureDeviceTestUnreachableReason,
  CaptureDiscoveryScope,
  CaptureDiscoveryTrigger,
  CaptureSourceClass,
  DEVICE_ID_PATTERN,
  HARDWARE_DEVICE_ID_PATTERN,
  HOST_ALIAS_HELPER,
  MIC_INPUT_ID_PATTERN,
  OPERATOR_ID_PATTERN,
  PAIRING_CODE_ID_PATTERN,
  PairingCodeCloseReason,
  SESSION_ID_PATTERN,
  SHA256_HEX_PATTERN,
  STT_BACKENDS,
  STT_CONFIG_FIELDS,
} from '@dems/shared/api';
import { AuditType, OperatorRole, Severity, type DetailValue } from '@dems/shared/sim';
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
 * addendum 04 section 4.2, the listing of sound cards (`searchCaptureAudioCards`). The shared
 * `CaptureDiscoveryScope` carries all three since integration pass I-1 (member `AUDIO_CARDS`); the
 * literal beside it is the same value and the set states it once, so this rule did not change.
 */
export const CAPTURE_DISCOVERY_AUDIT_SCOPES: readonly string[] = [...new Set<string>([...Object.values(CaptureDiscoveryScope), 'AUDIO_CARDS'])];
/** `change` of CAPTURE_AUDIO_INPUT_CHANGED (design addendum 04 section 4.2). */
export const CAPTURE_AUDIO_INPUT_CHANGES = ['REGISTERED', 'CARD_CHANGED', 'REENABLED'] as const;
/**
 * The seven settings of `capture_network_config` an operator can change (schema extension 03 section 2.4; the seventh,
 * `onvifPorts`, schema version 14, row V7b), by member name: THE CONTRACT'S LIST, not a copy.
 */
export const CAPTURE_NETWORK_CONFIG_FIELDS = CONTRACT_NETWORK_CONFIG_FIELDS;
/** Why a temporary host address was added, and how it left (schema extension 03 section 2.5: `HOST_ALIAS_REASON`, `HOST_ALIAS_REMOVE_REASON`). */
export const HOST_ALIAS_AUDIT_REASONS = ['FACTORY_SCAN', 'SET_CAMERA_ADDRESS'] as const;
export const HOST_ALIAS_AUDIT_REMOVE_REASONS = ['EXPIRED', 'MANUAL', 'JOB_DONE', 'BOOT_SWEEP', 'SHUTDOWN', 'NOT_ADDED', 'ADD_UNCONFIRMED'] as const;
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

// ── Task 4 (blueprint row 201, X-C; design 05 sections 2.7 and 3.7; SX-14): the forms of the one
// type of the password command and of the two public members of the boot row.
/** `method` of OPERATOR_PASSWORD_SET: how the password was set. One value today: the host command. */
export const OPERATOR_PASSWORD_SET_METHODS = ['HOST_COMMAND'] as const;
/** The numeric id of an OS user: a whole number of 0 to 4294967295. Never a user name. */
const osUserId = (required: boolean): DetailRule => ({
  required,
  form: 'the numeric id of an OS user (a whole number of 0 to 4294967295)',
  accepts: (value) => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 && value <= 4_294_967_295,
});
/** The id of a signing key, in the form of every key-id column (`db/schema/checks.ts`, `keyId`). */
const signingKeyId = matching(/^[A-Z0-9][A-Z0-9_-]{0,63}$/, 'a signing key id (upper-case letters, digits, _ and -; at most 64)');

// ── Task 4 (row V3, the third vocabulary step; decisions C53 (4d), C57, C58, C62): the closed sets
// and forms of the four types of that step. Exported where a writer states one of the values.
/** `action` of HOST_ALIAS_REQUESTED: the two verbs of the address helper, as the intent names them. */
export const HOST_ALIAS_REQUEST_ACTIONS = ['ADD', 'REMOVE'] as const;
export type HostAliasRequestAction = (typeof HOST_ALIAS_REQUEST_ACTIONS)[number];
/** `minutes` of HOST_ALIAS_REQUESTED: the lifetime asked of the helper, inside the helper's own bounds (the contract's `HOST_ALIAS_HELPER`). */
const aliasMinutes = (required: boolean): DetailRule => ({
  required,
  form: `a whole number of ${String(HOST_ALIAS_HELPER.minutesMin)} to ${String(HOST_ALIAS_HELPER.minutesMax)} (minutes)`,
  accepts: (value) => typeof value === 'number' && Number.isSafeInteger(value) && value >= HOST_ALIAS_HELPER.minutesMin && value <= HOST_ALIAS_HELPER.minutesMax,
});
/** The number of a capture attempt inside one session: a whole number of 1 or more (the first worker is attempt 1). */
const attemptNumber = (required: boolean): DetailRule => ({
  required,
  form: 'the number of a capture attempt (a whole number of 1 or more)',
  accepts: (value) => typeof value === 'number' && Number.isSafeInteger(value) && value >= 1,
});
/** The longest gap a row of CAPTURE_AUDIO_ABSENT_ON_RESTART can state (ms): one day. A larger number is a clock fault, not a measurement. */
export const CAPTURE_AUDIO_ABSENT_MAX_MS = 86_400_000;
/** A measured bound of an audio gap in milliseconds: a whole number of 0 to `CAPTURE_AUDIO_ABSENT_MAX_MS`. */
const gapMs = (required: boolean): DetailRule => ({
  required,
  form: `a whole number of 0 to ${String(CAPTURE_AUDIO_ABSENT_MAX_MS)} (milliseconds)`,
  accepts: (value) => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 && value <= CAPTURE_AUDIO_ABSENT_MAX_MS,
});
// ── Task 4 (row R1b; decision C99): the closed sets and forms of CAPTURE_VIDEO_ABSENT_IN_SESSION.
/** The longest absence a row of CAPTURE_VIDEO_ABSENT_IN_SESSION can state (ms): one day, as the audio gap. A larger number is a clock fault. */
export const CAPTURE_VIDEO_ABSENT_MAX_MS = 86_400_000;
/** `ended` of CAPTURE_VIDEO_ABSENT_IN_SESSION: the relay opened the camera again, or the capture ended with the camera still away. The manifest's own two words (held equal by a test). */
export const CAPTURE_VIDEO_ABSENCE_ENDS = ['RE_OPENED', 'NOT_RE_OPENED'] as const;
export type CaptureVideoAbsenceEnd = (typeof CAPTURE_VIDEO_ABSENCE_ENDS)[number];
/** `trackId` of CAPTURE_VIDEO_ABSENT_IN_SESSION: the camera tracks of a sealed package (the manifest's closed list; held equal by a test). */
export const CAPTURE_VIDEO_ABSENT_TRACK_IDS = ['VIDEO-01', 'VIDEO-02'] as const;
/** A measured bound of a video absence in milliseconds: a whole number of 0 to `CAPTURE_VIDEO_ABSENT_MAX_MS`. */
const videoAbsentMs = (required: boolean): DetailRule => ({
  required,
  form: `a whole number of 0 to ${String(CAPTURE_VIDEO_ABSENT_MAX_MS)} (milliseconds)`,
  accepts: (value) => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 && value <= CAPTURE_VIDEO_ABSENT_MAX_MS,
});
/** A number the relay counts from 1 (its loss number; the tries of one re-open): a whole number of 1 to the relay's own largest number. */
const relayCount = (required: boolean): DetailRule => ({
  required,
  form: 'a number a relay counts (a whole number of 1 to 999999999)',
  accepts: (value) => typeof value === 'number' && Number.isSafeInteger(value) && value >= 1 && value <= 999_999_999,
});
/** `operationId` of CAPTURE_DEVICE_CONNECTION_TESTED: the one operation that tests a registered camera with its stored credential (operation 108). */
export const CAPTURE_DEVICE_CONNECTION_TEST_OPERATIONS = ['testCaptureDeviceConnection'] as const;
/** A registered CAMERA of the capture devices (`CAM-NN`, the contract's form of operation 108): never a microphone, a candidate id or an address. */
const cameraDeviceId = matching(CAPTURE_CAMERA_DEVICE_ID_PATTERN, 'a registered camera id (CAM-01)');
/** `usableProfileCount` of CAPTURE_DEVICE_CONNECTION_TESTED (row V4): a whole number of 0 to the contract's bound. */
const profileCount = (required: boolean): DetailRule => ({
  required,
  form: `a whole number of 0 to ${String(CAPTURE_DEVICE_TEST_AUDIT_PROFILES_MAX)}`,
  accepts: (value) => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 && value <= CAPTURE_DEVICE_TEST_AUDIT_PROFILES_MAX,
});
// ── Task 4 (row N2; design 06 revision 3, section 8.4; decisions U25 (3), C110, C112 (3)): the closed
// sets and bounds of CAPTURE_AUDIO_SAMPLES_NOT_RECEIVED and CAPTURE_AUDIO_SILENCE_INSERTED. Each is the
// manifest's own value (`@dems/shared/evidence-package`), held equal by a test, so that one name means
// one thing from the audit row to the signature.
/** One day at 48,000 Hz: the largest sample count or sample position a row can state. */
export const CAPTURE_AUDIO_DAY_SAMPLES = 4_147_200_000;
/** The most samples a microphone's buffer holds (two seconds at 48,000 Hz): the bound of `bufferedSamples`. */
export const CAPTURE_AUDIO_BUFFERED_MAX_SAMPLES = 96_000;
/** 100 ms at 48,000 Hz: the shortest run of inserted silence that is a row of its own. */
export const CAPTURE_AUDIO_INSERTED_RUN_MIN_SAMPLES = 4_800;
/** The most runs listed per capture attempt: the largest `index` of a run and the bound of `listedRuns`. */
export const CAPTURE_AUDIO_INSERTED_RUNS_MAX = 1_024;
/** `captureLayer` of CAPTURE_AUDIO_SAMPLES_NOT_RECEIVED: the capture layers that do not promise every sample. One word. */
export const CAPTURE_AUDIO_CAPTURE_LAYERS = ['AVFOUNDATION'] as const;
/** `captureGroup`: 1 to this number (a session has at most two microphones). */
export const CAPTURE_AUDIO_CAPTURE_GROUP_MAX = 2;
/**
 * `account` of CAPTURE_AUDIO_SAMPLES_NOT_RECEIVED, THE CLOSED MARK: `CLOSED` - the worker's closing
 * account, it reaches the end of the track; `NOT_CLOSED` - the last periodic account of a worker that
 * did not end its timeline, the track goes on after it; `NONE` - the worker left no account, nothing
 * was measured.
 */
export const CAPTURE_AUDIO_SAMPLE_ACCOUNTS = ['CLOSED', 'NOT_CLOSED', 'NONE'] as const;
export type CaptureAudioSampleAccount = (typeof CAPTURE_AUDIO_SAMPLE_ACCOUNTS)[number];
/** The most retries of the open of a microphone's helper in one capture attempt: one. */
export const CAPTURE_AUDIO_OPEN_RETRIES_MAX = 1;
/**
 * The thirteen numbers of an account, `timelineSamples` to `runsNotListedSamples`: ALL present
 * (`account` CLOSED or NOT_CLOSED) or ALL absent (NONE). The writer builds the account so and the seal's
 * reader refuses any other form; a detail list holds a form per key, not a rule between keys.
 * Since row V7 they stand in TWO entries (`CAPTURE_AUDIO_ACCOUNT_PART_NUMBER_KEYS` below).
 */
export const CAPTURE_AUDIO_ACCOUNT_NUMBER_KEYS = [
  'timelineSamples',
  'receivedSamples',
  'insertedSamples',
  'discardedSamples',
  'bufferedSamples',
  'nonFiniteSamples',
  'fedSamples',
  'fedInsertedSamples',
  'fedRuns',
  'fedLongestRunSamples',
  'listedRuns',
  'runsNotListed',
  'runsNotListedSamples',
] as const;
/**
 * THE ACCOUNT IS TWO ENTRIES (task 4 row V7; decision C119 (1); finding F-1 of row N2). The account
 * holds 19 or 20 details and the audit writer holds a native row to 16 (`NATIVE_PAYLOAD_KEYS_MAX`,
 * `./limits`) - THAT LIMIT STAYS: it bounds what a writer can put into the chain. So one account is
 * written as TWO entries of the type CAPTURE_AUDIO_SAMPLES_NOT_RECEIVED, each within the bound,
 * joined on the session, the microphone (the entry's device) and the attempt:
 *
 * | `part` | What it states | Its numbers | Keys at most |
 * |---|---|---|---|
 * | 1 | THE SOURCE: what the microphone's path delivered | `timelineSamples`, `receivedSamples`, `insertedSamples`, `discardedSamples`, `bufferedSamples`, `nonFiniteSamples`; and `openRunFromSample` when the account states one | 7 + 6 + 1 = 14 |
 * | 2 | THE TRACK: what of the audio track this microphone fed | `fedSamples`, `fedInsertedSamples`, `fedRuns`, `fedLongestRunSamples`, `listedRuns`, `runsNotListed`, `runsNotListedSamples` | 7 + 7 = 14 |
 *
 * BOTH parts state the seven keys of the path (`CAPTURE_AUDIO_ACCOUNT_PATH_KEYS`), with the same
 * values: each entry says by itself whose account it is and whether it is closed. A part states ALL
 * its numbers (`account` CLOSED or NOT_CLOSED) or NONE of them (`NONE`), and never a number of the
 * other part. An account `NONE` is two entries too: a reader never has to tell "no part 2" from "a
 * part 2 that was not written". A MISSING PART IS NO ACCOUNT - `captureAudioAccountOfParts` says
 * which rule failed and the seal refuses; half an account is never read as one.
 */
export const CAPTURE_AUDIO_ACCOUNT_PARTS = 2;
/** The seven keys both parts state, with the same values. */
export const CAPTURE_AUDIO_ACCOUNT_PATH_KEYS = ['sessionId', 'attempt', 'part', 'captureLayer', 'captureGroup', 'account', 'openRetries'] as const;
/** The numbers of each part: together the thirteen of `CAPTURE_AUDIO_ACCOUNT_NUMBER_KEYS`, in that order. */
export const CAPTURE_AUDIO_ACCOUNT_PART_NUMBER_KEYS = {
  1: ['timelineSamples', 'receivedSamples', 'insertedSamples', 'discardedSamples', 'bufferedSamples', 'nonFiniteSamples'],
  2: ['fedSamples', 'fedInsertedSamples', 'fedRuns', 'fedLongestRunSamples', 'listedRuns', 'runsNotListed', 'runsNotListedSamples'],
} as const satisfies Record<1 | 2, readonly (typeof CAPTURE_AUDIO_ACCOUNT_NUMBER_KEYS)[number][]>;
/** The one key of part 1 that is present only when the account states it. */
export const CAPTURE_AUDIO_ACCOUNT_OPEN_RUN_KEY = 'openRunFromSample';

type AccountNumberKey = (typeof CAPTURE_AUDIO_ACCOUNT_NUMBER_KEYS)[number];
/** One account as its writer holds it before it is cut: the path, then all thirteen numbers or none (`account` NONE). */
export type CaptureAudioAccount = {
  readonly sessionId: string;
  readonly attempt: number;
  readonly captureLayer: (typeof CAPTURE_AUDIO_CAPTURE_LAYERS)[number];
  readonly captureGroup: number;
  readonly account: CaptureAudioSampleAccount;
  readonly openRetries: number;
  readonly openRunFromSample?: number;
} & Partial<Readonly<Record<AccountNumberKey, number>>>;
/** The details of one entry of an account. */
export type CaptureAudioAccountPart = Readonly<Record<string, string | number>>;

/** Why a set of entries is no account (`captureAudioAccountOfParts`). Closed words; none carries a value. */
export const CaptureAudioAccountPartRefusal = {
  /** Not exactly the entries of part 1 and part 2. */
  PART_MISSING: 'ACCOUNT_PART_MISSING',
  PART_REPEATED: 'ACCOUNT_PART_REPEATED',
  /** The two parts do not state the same path (session, attempt, layer, group, account, retries). */
  PARTS_DIFFER: 'ACCOUNT_PARTS_DIFFER',
  /** A part states a number of the other part, a key of neither, or some of its numbers and not all. */
  PART_KEYS: 'ACCOUNT_PART_KEYS',
} as const;
export type CaptureAudioAccountPartRefusal = (typeof CaptureAudioAccountPartRefusal)[keyof typeof CaptureAudioAccountPartRefusal];

/**
 * THE CUT: the two detail lists of one account, part 1 then part 2. The writer (row N11) appends
 * both in ONE unit of work. Throws a `TypeError` for an account whose thirteen numbers are neither
 * all stated nor all absent, or that states numbers under `NONE` - the writer's own rule, held here
 * so that no half-stated account is ever cut into two well-formed entries.
 */
export function captureAudioAccountParts(account: CaptureAudioAccount): readonly [CaptureAudioAccountPart, CaptureAudioAccountPart] {
  const stated = CAPTURE_AUDIO_ACCOUNT_NUMBER_KEYS.filter((key) => account[key] !== undefined);
  const measured = account.account !== 'NONE';
  if (stated.length !== (measured ? CAPTURE_AUDIO_ACCOUNT_NUMBER_KEYS.length : 0)) throw new TypeError('an audio account states all thirteen numbers (CLOSED, NOT_CLOSED) or none (NONE)');
  if (!measured && account.openRunFromSample !== undefined) throw new TypeError('an audio account without numbers states no open run');
  const path = (part: 1 | 2): Record<string, string | number> => ({ sessionId: account.sessionId, attempt: account.attempt, part, captureLayer: account.captureLayer, captureGroup: account.captureGroup, account: account.account, openRetries: account.openRetries });
  const numbers = (part: 1 | 2): Record<string, number> => (measured ? Object.fromEntries(CAPTURE_AUDIO_ACCOUNT_PART_NUMBER_KEYS[part].map((key) => [key, account[key] as number])) : {});
  return [
    { ...path(1), ...numbers(1), ...(account.openRunFromSample === undefined ? {} : { [CAPTURE_AUDIO_ACCOUNT_OPEN_RUN_KEY]: account.openRunFromSample }) },
    { ...path(2), ...numbers(2) },
  ];
}

/**
 * THE JOIN: the account of the entries of ONE session, ONE microphone and ONE attempt (the caller
 * groups by the entry's device and these two keys), or the rule that failed. The seal (row N12)
 * reads an account through this and refuses the session on any refusal: never a half account.
 * It judges the FORM of the pair; the form of each value is the detail list's, at the write.
 */
export function captureAudioAccountOfParts(entries: readonly Readonly<Record<string, unknown>>[]): { readonly ok: true; readonly account: CaptureAudioAccount } | { readonly ok: false; readonly reason: CaptureAudioAccountPartRefusal } {
  const refuse = (reason: CaptureAudioAccountPartRefusal) => ({ ok: false, reason }) as const;
  const first = entries.filter((entry) => entry['part'] === 1);
  const second = entries.filter((entry) => entry['part'] === 2);
  if (first.length > 1 || second.length > 1) return refuse(CaptureAudioAccountPartRefusal.PART_REPEATED);
  const [one, two] = [first[0], second[0]];
  if (one === undefined || two === undefined || entries.length !== CAPTURE_AUDIO_ACCOUNT_PARTS) return refuse(CaptureAudioAccountPartRefusal.PART_MISSING);
  for (const key of CAPTURE_AUDIO_ACCOUNT_PATH_KEYS) {
    if (key !== 'part' && (one[key] === undefined || one[key] !== two[key])) return refuse(CaptureAudioAccountPartRefusal.PARTS_DIFFER);
  }
  const measured = one['account'] !== 'NONE';
  for (const [entry, part] of [[one, 1], [two, 2]] as const) {
    const own: readonly string[] = CAPTURE_AUDIO_ACCOUNT_PART_NUMBER_KEYS[part];
    const allowed = new Set<string>([...CAPTURE_AUDIO_ACCOUNT_PATH_KEYS, ...(measured ? own : []), ...(measured && part === 1 ? [CAPTURE_AUDIO_ACCOUNT_OPEN_RUN_KEY] : [])]);
    if (Object.keys(entry).some((key) => !allowed.has(key))) return refuse(CaptureAudioAccountPartRefusal.PART_KEYS);
    if (measured && own.some((key) => typeof entry[key] !== 'number')) return refuse(CaptureAudioAccountPartRefusal.PART_KEYS);
  }
  const { part: _one, ...source } = one;
  const { part: _two, sessionId: _s, attempt: _a, captureLayer: _l, captureGroup: _g, account: _c, openRetries: _r, ...track } = two;
  return { ok: true, account: { ...source, ...track } as unknown as CaptureAudioAccount };
}

/** A whole number of `min` to `max`, with its unit in the form text. */
const wholeBetween =(min: number, max: number, unit: string) => (required: boolean): DetailRule => ({
  required,
  form: `a whole number of ${String(min)} to ${String(max)} (${unit})`,
  accepts: (value) => typeof value === 'number' && Number.isSafeInteger(value) && value >= min && value <= max,
});
/** A count of samples, or a sample position, of at most one day. */
const daySamples = wholeBetween(0, CAPTURE_AUDIO_DAY_SAMPLES, 'samples');
/** A count of runs of at most one day of samples. */
const dayRuns = wholeBetween(0, CAPTURE_AUDIO_DAY_SAMPLES, 'runs');

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
    // Row V7b (S2-02, C116): when `onvifPorts` changed, HOW MANY ports are listed now (1 to 8); never the ports.
    onvifPortCount: {
      required: OPTIONAL,
      form: `a whole number of ${String(CAPTURE_NETWORK_CONFIG_LIMITS.onvifPortsMin)} to ${String(CAPTURE_NETWORK_CONFIG_LIMITS.onvifPortsMax)}`,
      accepts: (value) => typeof value === 'number' && Number.isInteger(value) && value >= CAPTURE_NETWORK_CONFIG_LIMITS.onvifPortsMin && value <= CAPTURE_NETWORK_CONFIG_LIMITS.onvifPortsMax,
    },
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
    // Row V4 (decision C74): `aliasId` is OPTIONAL here and on the failed removal below. The boot
    // sweep removes a marked address WITH OR WITHOUT a row (S13-10 (b)); a row-less removal has no
    // row id, and its result entry was refused while the key was required.
    aliasId: rowUuid(OPTIONAL),
    address: ipv4Literal(REQUIRED),
    removeReason: oneOf(HOST_ALIAS_AUDIT_REMOVE_REASONS, `one of ${HOST_ALIAS_AUDIT_REMOVE_REASONS.join(', ')}`)(REQUIRED),
    operationId: operationId(OPTIONAL),
    permission: code(OPTIONAL),
  },
  [AuditType.HOST_ALIAS_REMOVE_FAILED]: {
    // `failureReason` is the code stored as `remove_error`: a code, never the helper's error text.
    aliasId: rowUuid(OPTIONAL),
    address: ipv4Literal(REQUIRED),
    removeReason: oneOf(HOST_ALIAS_AUDIT_REMOVE_REASONS, `one of ${HOST_ALIAS_AUDIT_REMOVE_REASONS.join(', ')}`)(REQUIRED),
    failureReason: code(REQUIRED),
    operationId: operationId(OPTIONAL),
    permission: code(OPTIONAL),
  },
  // ── Task 4 (row V3; decision C53 (4d); S13-10 (c): "1 intent and 1 result entry per action"): the
  // two alias types the three above left open. The same forms as theirs: the row id, ONE IPv4
  // literal (the address asked of the helper; the interface is not named, SEC35-30) and closed codes.
  [AuditType.HOST_ALIAS_REQUESTED]: {
    // THE INTENT, written BEFORE the line is sent to the address helper: a Core that dies between
    // the line and its result leaves this row. `reason` and `minutes` belong to an ADD,
    // `removeReason` to a REMOVE: the list holds the keys and their forms, the writer of the row
    // (row 106) states the ones of its action. `aliasId` when the row of `host_network_aliases`
    // already exists. `operationId` and `permission` are optional as on the three above: a removal
    // by a timer or the boot sweep has neither.
    action: oneOf(HOST_ALIAS_REQUEST_ACTIONS, `one of ${HOST_ALIAS_REQUEST_ACTIONS.join(', ')}`)(REQUIRED),
    address: ipv4Literal(REQUIRED),
    reason: oneOf(HOST_ALIAS_AUDIT_REASONS, `one of ${HOST_ALIAS_AUDIT_REASONS.join(', ')}`)(OPTIONAL),
    removeReason: oneOf(HOST_ALIAS_AUDIT_REMOVE_REASONS, `one of ${HOST_ALIAS_AUDIT_REMOVE_REASONS.join(', ')}`)(OPTIONAL),
    minutes: aliasMinutes(OPTIONAL),
    aliasId: rowUuid(OPTIONAL),
    operationId: operationId(OPTIONAL),
    permission: code(OPTIONAL),
  },
  [AuditType.HOST_ALIAS_ADD_FAILED]: {
    // THE RESULT of an `add` that put no address in place. `failureReason` is a CODE: the Core's
    // refusal name (e.g. HELPER_ADDRESS_IN_USE), never the helper's text. `aliasId` is optional: a
    // refusal before the row was made has none.
    address: ipv4Literal(REQUIRED),
    reason: oneOf(HOST_ALIAS_AUDIT_REASONS, `one of ${HOST_ALIAS_AUDIT_REASONS.join(', ')}`)(REQUIRED),
    failureReason: code(REQUIRED),
    aliasId: rowUuid(OPTIONAL),
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
    // What the last scan KNEW of the number of devices at `fromAddress` (row V6, caution R119-03): `NOT_KNOWN` says the
    // count was not made and the job ran on the hardware-address checks alone. A word of the contract's closed set.
    deviceCount: oneOf(['ONE', 'MORE_THAN_ONE', 'NOT_KNOWN'], 'one of ONE, MORE_THAN_ONE, NOT_KNOWN')(OPTIONAL),
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
  // ── Task 4 (blueprint row 201, X-C; design 05 section 3.7; security review 07 finding F2-8,
  // requirement SX-14): the ONE row of the host command that sets an operator's password. Exactly
  // these five keys: WHOSE password, by which method, how many sessions it ended, whether the
  // credential it replaced was the published demonstration one, and optionally the numeric id of
  // the OS user that ran the command (a fact, not a proof). No `operationId` and no `permission`:
  // no operation of the contract and no operator session stand behind the row (its actor is null).
  // NEVER the password, its length, the salt, the tag or a hash parameter: no such key exists here.
  [AuditType.OPERATOR_PASSWORD_SET]: {
    targetOperatorId: operatorId(REQUIRED),
    method: oneOf(OPERATOR_PASSWORD_SET_METHODS, `one of ${OPERATOR_PASSWORD_SET_METHODS.join(', ')}`)(REQUIRED),
    sessionsEnded: count(REQUIRED),
    earlierWasDemo: flag(REQUIRED),
    invokerUid: osUserId(OPTIONAL),
  },
  // ── Task 4 (row V3; decision C57, row 191b is the writer): the capture worker of a session was
  // replaced before anything was durable and NO AUDIO WAS RECORDED between the two workers. The
  // session, the two attempt numbers and the two MEASURED bounds of the gap in milliseconds: at
  // least (the earlier worker down until the microphones of the later one were started) and at
  // most (until the later worker's audio was heard). A bound is absent only when the instant it
  // is measured from is not known; a row then says that the gap exists and was not measured.
  // Numbers and one id: no device, no card text, no file name. No `operationId` and no
  // `permission`: no operation stands behind the row (its actor is null).
  [AuditType.CAPTURE_AUDIO_ABSENT_ON_RESTART]: {
    sessionId: sessionId(REQUIRED),
    earlierAttempt: attemptNumber(REQUIRED),
    laterAttempt: attemptNumber(REQUIRED),
    audioAbsentAtLeastMs: gapMs(OPTIONAL),
    audioAbsentAtMostMs: gapMs(OPTIONAL),
  },
  // ── Task 4 (row V3; decision C58, row 146): the OUTCOME of a connection test of a REGISTERED
  // camera made with its STORED credential (operation 108). The reveal of that credential is the
  // reader's own CAPTURE_CREDENTIAL_REVEALED row; this is the second entry of the same test: what
  // the camera answered and whether the lock-out guard closed. A TYPE OF ITS OWN, not a member of
  // CAPTURE_CONNECTION_TESTED: that list REQUIRES `candidateId` and `searchId`, which a registered
  // camera has not, and a required key cannot be relaxed for one writer without relaxing it for
  // all. The keys it shares keep their forms. NO `host`, NO `endpointRef` and no `authenticated`:
  // the row names the device by its registry id only - never a credential, a locator or text a
  // device announced - and a stored credential is always the one used.
  [AuditType.CAPTURE_DEVICE_CONNECTION_TESTED]: {
    deviceId: cameraDeviceId(REQUIRED),
    outcome: oneOf(Object.values(CaptureConnectionOutcome), 'one of the five connection-test outcomes')(REQUIRED),
    adapter: code(REQUIRED),
    sourceClass: oneOf(Object.values(CaptureSourceClass), 'one of PRODUCTION, DEVELOPMENT')(REQUIRED),
    operationId: oneOf(CAPTURE_DEVICE_CONNECTION_TEST_OPERATIONS, CAPTURE_DEVICE_CONNECTION_TEST_OPERATIONS.join(', '))(REQUIRED),
    guardTripped: flag(OPTIONAL),
    // Present only for a test that ended AUTHENTICATION_FAILED without the credential being sent (as on CAPTURE_CONNECTION_TESTED).
    reason: oneOf(Object.values(CaptureConnectionTestReason), 'SCHEME_NOT_ALLOWED')(OPTIONAL),
    // Row V4 (decision C75 (1); request of row 146b): a test that reached the reader of the stored
    // credential and asked NO camera is written too, as UNREACHABLE with the closed reason why
    // nothing was sent - so the reveal never stands without a result. Absent when a camera was
    // asked and did not answer. The builder of the shared contract drops it for any other outcome;
    // its writer is row 146c.
    unreachableReason: oneOf(Object.values(CaptureDeviceTestUnreachableReason), `one of ${Object.values(CaptureDeviceTestUnreachableReason).join(', ')}`)(OPTIONAL),
    // Row V4: the answer's own count of usable profiles (0 to 16) when a camera was asked. A count: no profile name, no codec text.
    usableProfileCount: profileCount(OPTIONAL),
    // Rows PR, V7 (decision C117): what the test found about the camera's STORED profiles - a closed word and three
    // counts (stored before the test, stated by the stream now, differing). All four together or none (the shared
    // builder's rule); absent when there is nothing to say. Counts only: no profile code, no codec text.
    profiles: oneOf(Object.values(CaptureDeviceTestProfiles), `one of ${Object.values(CaptureDeviceTestProfiles).join(', ')}`)(OPTIONAL),
    storedProfileCount: profileCount(OPTIONAL),
    statedProfileCount: profileCount(OPTIONAL),
    differingProfileCount: wholeBetween(0, CAPTURE_DEVICE_TEST_AUDIT_DIFFERING_MAX, 'profile codes')(OPTIONAL),
    permission: code(OPTIONAL),
  },
  // ── Task 4 (row R1b; decision C99, finding F3-01; the capture session is the writer): a camera
  // of a session stopped delivering video INSIDE the session while its relay kept the push to the
  // capture worker, and NO PICTURE WAS RECORDED until it ended. Written ONCE per absence, when it
  // ends: `RE_OPENED` (the relay opened the camera again) or `NOT_RE_OPENED` (the capture ended
  // with the camera still away). The session, the camera (also the row's device), its track, the
  // capture attempt the relay fed, the relay's own number of the loss, its tries of the re-open
  // (only for RE_OPENED) and the two MEASURED bounds in milliseconds:
  //   at least  RE_OPENED: the relay's own measure on its monotonic clock, from the instant it
  //             called the camera lost to the first keyframe of the new leg (the last picture came
  //             before that instant). NOT_RE_OPENED: the Core's clock, from the relay's word of the
  //             loss to the instant the Core asked the capture to end;
  //   at most   the Core's clock from the relay's word of the loss to its word of the re-open
  //             (NOT_RE_OPENED: to the instant the capture had ended), never below the least, plus
  //             the longest the relay lets a playing camera be silent before it calls it lost.
  // A bound is absent only when the instant it is measured from is not known; a row then says
  // that the absence exists and was not measured. Ids, numbers and one closed word: no address,
  // no stream profile, no cause text, no file name. No `operationId` and no `permission`: no
  // operation stands behind the row (its actor is null).
  [AuditType.CAPTURE_VIDEO_ABSENT_IN_SESSION]: {
    sessionId: sessionId(REQUIRED),
    deviceId: cameraDeviceId(REQUIRED),
    trackId: oneOf(CAPTURE_VIDEO_ABSENT_TRACK_IDS, `one of ${CAPTURE_VIDEO_ABSENT_TRACK_IDS.join(', ')}`)(REQUIRED),
    attempt: attemptNumber(REQUIRED),
    loss: relayCount(REQUIRED),
    tries: relayCount(OPTIONAL),
    videoAbsentAtLeastMs: videoAbsentMs(OPTIONAL),
    videoAbsentAtMostMs: videoAbsentMs(OPTIONAL),
    ended: oneOf(CAPTURE_VIDEO_ABSENCE_ENDS, `one of ${CAPTURE_VIDEO_ABSENCE_ENDS.join(', ')}`)(REQUIRED),
  },
  // ── Task 4 (row N2; design 06 revision 3, section 8.4; decisions U25 (3), C107, C110, C112 (3); the
  // capture session is the writer, row N11): THE ACCOUNT of a microphone whose capture path is NOT
  // SAMPLE-CONTINUOUS (the bench path of a Mac). Written ONCE per such microphone (the row's device)
  // and per capture attempt, when that attempt's audio ends: with the worker's closing account
  // (`CLOSED`), with the last periodic account of a worker that went down without one (`NOT_CLOSED`),
  // or with none (`NONE`: the path is not sample-continuous and the amount was not measured).
  // The names of the numbers are the worker's: expected (`timelineSamples`), received, inserted,
  // discarded, still buffered, not finite; then the TRACK - how much of it this microphone fed, how
  // much of that was inserted, the runs of inserted zeros that began on it, the longest, how many
  // of 100 ms or more are listed as rows of CAPTURE_AUDIO_SILENCE_INSERTED and how many are not.
  // The thirteen numbers are all present or all absent (`CAPTURE_AUDIO_ACCOUNT_NUMBER_KEYS`).
  // Whole numbers, ids and closed words: NO device text, NO card text, NO file name and NO
  // percentage (a reader computes it; whole numbers cannot be rounded wrongly). No `operationId` and
  // no `permission`: no operation stands behind the row (its actor is null).
  //
  // TWO ENTRIES PER ACCOUNT (row V7; decision C119 (1)): `part` 1 holds the source's six numbers and
  // the open run, `part` 2 the track's seven; both hold the seven keys of the path. Which keys a part
  // holds is `CAPTURE_AUDIO_ACCOUNT_PART_NUMBER_KEYS` above; the writer cuts an account with
  // `captureAudioAccountParts` and the seal joins it with `captureAudioAccountOfParts`. This list
  // holds the form of each key; that a part holds only ITS numbers is those two functions' rule
  // (a detail list has no rule between keys), and the key bound of 16 holds each part besides.
  [AuditType.CAPTURE_AUDIO_SAMPLES_NOT_RECEIVED]: {
    sessionId: sessionId(REQUIRED),
    attempt: attemptNumber(REQUIRED),
    part: wholeBetween(1, CAPTURE_AUDIO_ACCOUNT_PARTS, 'the part of the account')(REQUIRED),
    captureLayer: oneOf(CAPTURE_AUDIO_CAPTURE_LAYERS, `one of ${CAPTURE_AUDIO_CAPTURE_LAYERS.join(', ')}`)(REQUIRED),
    captureGroup: wholeBetween(1, CAPTURE_AUDIO_CAPTURE_GROUP_MAX, 'the shared capture group')(REQUIRED),
    account: oneOf(CAPTURE_AUDIO_SAMPLE_ACCOUNTS, `one of ${CAPTURE_AUDIO_SAMPLE_ACCOUNTS.join(', ')}`)(REQUIRED),
    openRetries: wholeBetween(0, CAPTURE_AUDIO_OPEN_RETRIES_MAX, 'retries of the open')(REQUIRED),
    timelineSamples: daySamples(OPTIONAL),
    receivedSamples: daySamples(OPTIONAL),
    insertedSamples: daySamples(OPTIONAL),
    discardedSamples: daySamples(OPTIONAL),
    bufferedSamples: wholeBetween(0, CAPTURE_AUDIO_BUFFERED_MAX_SAMPLES, 'samples')(OPTIONAL),
    nonFiniteSamples: daySamples(OPTIONAL),
    fedSamples: daySamples(OPTIONAL),
    fedInsertedSamples: daySamples(OPTIONAL),
    fedRuns: dayRuns(OPTIONAL),
    fedLongestRunSamples: daySamples(OPTIONAL),
    listedRuns: wholeBetween(0, CAPTURE_AUDIO_INSERTED_RUNS_MAX, 'runs')(OPTIONAL),
    runsNotListed: dayRuns(OPTIONAL),
    runsNotListedSamples: daySamples(OPTIONAL),
    // Present only when the account states one: a run of 100 ms or more that was still running at it.
    openRunFromSample: daySamples(OPTIONAL),
  },
  // ── Task 4 (row N2; decision C112 (3); the capture session is the writer, row N11): ONE LISTED RUN
  // of inserted silence of 100 ms or more in the audio track. A TYPE OF ITS OWN, not keys of the
  // account: an audit detail list is flat and cannot hold a list, and a required key of one type
  // cannot be relaxed for a second kind of row. Written when the worker's record of the run ARRIVES,
  // not at the end: the runs of a worker that is killed later are already in the chain. The row's
  // device is the microphone that fed the track at the run's first sample. `fromSample` is the
  // first sample of the run on the track's own timeline (sample 0 is the first sample of the
  // track's sound); `samples` its length. Whole numbers and one id; all five are required.
  [AuditType.CAPTURE_AUDIO_SILENCE_INSERTED]: {
    sessionId: sessionId(REQUIRED),
    attempt: attemptNumber(REQUIRED),
    index: wholeBetween(1, CAPTURE_AUDIO_INSERTED_RUNS_MAX, "the worker's number of the run")(REQUIRED),
    fromSample: daySamples(REQUIRED),
    samples: wholeBetween(CAPTURE_AUDIO_INSERTED_RUN_MIN_SAMPLES, CAPTURE_AUDIO_DAY_SAMPLES, 'samples')(REQUIRED),
  },
} as const satisfies Partial<Record<AuditType, Readonly<Record<string, DetailRule>>>>;

/**
 * The forty-one types that have a list (nine of the backend task, nine of the capture phase, one
 * of R-8, four of R-9 / R-10, ten of task 4 blueprint row 19, one of task 4 blueprint row 201, four
 * of task 4 row V3, one of task 4 row R1b, two of task 4 row N2).
 */
export type ServerAuditType = keyof typeof SERVER_AUDIT_DETAIL_RULES;

/** The list of `type`, or undefined for one of the simulator's 44 types (85 minus the 41 listed here). */
export function detailRulesOf(type: AuditType): Readonly<Record<string, DetailRule>> | undefined {
  return (SERVER_AUDIT_DETAIL_RULES as Partial<Record<AuditType, Readonly<Record<string, DetailRule>>>>)[type];
}

/**
 * Task 4 (blueprint row 201, X-C; SX-14): the types whose severity is not the writer's choice.
 * `OPERATOR_PASSWORD_SET` is WARNING, so that it stands out in the security view. A writer of such
 * a row states THIS value (`fixedSeverityOf`). Since row V4 (decision C72, F-04) the audit writer
 * COMPARES it (`audit-writer.ts`, `checkTypeRules`): a row of such a type with any other severity -
 * or with none, which would be INFO - is refused before a statement is sent.
 */
export const SERVER_AUDIT_FIXED_SEVERITY = {
  [AuditType.OPERATOR_PASSWORD_SET]: Severity.WARNING,
} as const satisfies Partial<Record<AuditType, Severity>>;

/** The one severity a row of `type` carries, or undefined where the writer of the row chooses. */
export function fixedSeverityOf(type: AuditType): Severity | undefined {
  return (SERVER_AUDIT_FIXED_SEVERITY as Partial<Record<AuditType, Severity>>)[type];
}

/**
 * Task 4 (blueprint row 201, X-C; design 05 section 2.7 point 3): the two PUBLIC members a real boot
 * adds to the details of `SYSTEM_BOOT`, beside `captureOperation`: the id of the signing key the Core
 * started with and the SHA-256 of its certificate. `SYSTEM_BOOT` is one of the simulator's types and
 * has NO closed list (the shared code writes it with its own keys), so these are not a list: they
 * are the form of the two values, for the one writer of the boot row (`capture/fence`) to hold its
 * values to before it appends. Both are optional: a boot that states no key writes neither. A key
 * id is the form of every key-id column (`db/schema/checks.ts`, `keyId`); the digest is 64
 * lower-case hex digits. Neither can hold key material: the names are fixed here.
 */
export const SYSTEM_BOOT_SIGNING_DETAIL_RULES = {
  signingKeyId: signingKeyId(OPTIONAL),
  signingCertificateSha256: sha256Hex(OPTIONAL),
} as const satisfies Readonly<Record<string, DetailRule>>;

/**
 * Task 4 row V5 (decision C84, caution R-1 of security review 230): the codes of `signingStoreChange`
 * of a `SYSTEM_BOOT` row - what the boot found changed in the signer store against the previous
 * boot row of the same database. `NO_EARLIER_STATEMENT`, `NONE` and `NOT_READ` stand alone; the
 * four change codes are joined with a comma, each at most once, in this order.
 */
export const SYSTEM_BOOT_SIGNING_STORE_CHANGES = ['NO_EARLIER_STATEMENT', 'NONE', 'NOT_READ', 'KEY_ROTATED', 'KEY_MARKED_COMPROMISED', 'KEY_MARK_REMOVED', 'RETAINED_SET_CHANGED'] as const;
export type SystemBootSigningStoreChange = (typeof SYSTEM_BOOT_SIGNING_STORE_CHANGES)[number];
const SIGNING_STORE_CHANGE_ALONE: readonly string[] = SYSTEM_BOOT_SIGNING_STORE_CHANGES.slice(0, 3);
const SIGNING_STORE_CHANGE_JOINED: readonly string[] = SYSTEM_BOOT_SIGNING_STORE_CHANGES.slice(3);
/** The last place of the signing key series (`CORE-KEY-EVSIGN-01` to `-99`): the most certificates a store retains. */
export const SYSTEM_BOOT_SIGNING_KEYS_MAX = 99;

/**
 * Task 4 row V5 (C84 R-1): THE STATE OF THE SIGNER STORE a real boot states in its `SYSTEM_BOOT`
 * row, beside the two members above - PUBLIC FACTS ONLY, so that a rotation, a compromise mark and
 * a mark that disappeared are each in the audit chain although the two host commands write no row
 * (they stay database-free, ruled):
 *
 *   signingKeysRetained        how many certificates the retained set holds (every key that is or was active)
 *   signingKeysCompromised     the places in the key series (`01` to `99`, comma-joined, ascending) of the
 *                              retained keys that carry the compromise mark; the empty text = none
 *   signingCertificatesSha256  SHA-256 over the retained set: one line `<key id> <certificate SHA-256>` per
 *                              certificate, in series order - a certificate added, removed or replaced changes it
 *   signingStoreChange         what changed against the previous boot row of this database (the codes above)
 *
 * All optional: a simulated boot and a boot written before this step carry none. A list would not fit a
 * detail value (500 characters), which is why the marked keys are stated by their two-digit places.
 */
export const SYSTEM_BOOT_SIGNING_STORE_DETAIL_RULES = {
  signingKeysRetained: {
    required: OPTIONAL,
    form: `a whole number of 0 to ${SYSTEM_BOOT_SIGNING_KEYS_MAX}`,
    accepts: (value) => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 && value <= SYSTEM_BOOT_SIGNING_KEYS_MAX,
  },
  signingKeysCompromised: {
    required: OPTIONAL,
    form: 'places of the signing key series (01 to 99), comma-joined, ascending, each once; or the empty text',
    accepts: (value) => {
      if (typeof value !== 'string') return false;
      if (value === '') return true;
      const places = value.split(',');
      return places.every((place, index) => /^(?:0[1-9]|[1-9]\d)$/.test(place) && (index === 0 || place > (places[index - 1] as string)));
    },
  },
  signingCertificatesSha256: sha256Hex(OPTIONAL),
  signingStoreChange: {
    required: OPTIONAL,
    form: `one of ${SIGNING_STORE_CHANGE_ALONE.join(', ')}; or one or more of ${SIGNING_STORE_CHANGE_JOINED.join(', ')}, comma-joined, in this order, each once`,
    accepts: (value) => {
      if (typeof value !== 'string') return false;
      if (SIGNING_STORE_CHANGE_ALONE.includes(value)) return true;
      const codes = value.split(',');
      return codes.every((name, index) => SIGNING_STORE_CHANGE_JOINED.includes(name) && (index === 0 || SIGNING_STORE_CHANGE_JOINED.indexOf(name) > SIGNING_STORE_CHANGE_JOINED.indexOf(codes[index - 1] as string)));
    },
  },
} as const satisfies Readonly<Record<string, DetailRule>>;

/** Row P1 (decision U21 (2)): the platforms a production Core starts on, as a `SYSTEM_BOOT` row states them. */
export const SYSTEM_BOOT_HOST_PLATFORMS = ['linux', 'darwin'] as const;
/** Row P1: the codes of `hostProfile` of a `SYSTEM_BOOT` row. */
export const SYSTEM_BOOT_HOST_PROFILE_STATES = ['WILL_BE_ASKED', 'WILL_NOT_BE_ASKED', 'PLATFORM_NOT_SUPPORTED'] as const;
export type SystemBootHostProfileState = (typeof SYSTEM_BOOT_HOST_PROFILE_STATES)[number];

/**
 * Task 4 row P1 (decisions U21 (2), C66 (1), C71 C-7): THE HOST A PRODUCTION BOOT STATES in its `SYSTEM_BOOT`
 * row, beside the members above. A production Core is allowed on Linux, where the whole host profile is asked
 * at every start, and on macOS, where NONE of it is asked; until this row the second fact was a warning in the
 * log alone.
 *
 *   hostPlatform   the platform word the entry point handed to the boot checks, when it is one a production
 *                  Core starts on (`linux`, `darwin`); null for any other word and when none was handed in
 *   hostProfile    `WILL_BE_ASKED` (linux), `WILL_NOT_BE_ASKED` (darwin: the loopback owner rule, the crash
 *                  collector, forwarding, the clock, sleep and the address helper's socket are unchecked),
 *                  `PLATFORM_NOT_SUPPORTED` (any other platform, or none stated: the boot checks refuse the start)
 *
 * WRITTEN BEFORE THE BOOT CHECKS RUN (the fence step precedes them): the two members state what the platform
 * MEANS for the checks that follow - a function of the platform word alone - and never that a check was run or
 * passed. A row with `WILL_BE_ASKED` may be followed by a refused start; whether the boot was refused is in the
 * error log. Both optional: only a `REAL_PRODUCTION` boot states them. A `REAL_DEVELOPMENT` boot asks no host
 * profile by design and writes neither, as does a simulated boot and every row written before this step.
 */
export const SYSTEM_BOOT_HOST_DETAIL_RULES = {
  hostPlatform: {
    required: OPTIONAL,
    form: `one of ${SYSTEM_BOOT_HOST_PLATFORMS.join(', ')}`,
    accepts: (value) => typeof value === 'string' && (SYSTEM_BOOT_HOST_PLATFORMS as readonly string[]).includes(value),
  },
  hostProfile: {
    required: OPTIONAL,
    form: `one of ${SYSTEM_BOOT_HOST_PROFILE_STATES.join(', ')}`,
    accepts: (value) => typeof value === 'string' && (SYSTEM_BOOT_HOST_PROFILE_STATES as readonly string[]).includes(value),
  },
} as const satisfies Readonly<Record<string, DetailRule>>;

/** Row HC (decision C94 (j)): the codes of `addressHelperSocket` of a `SYSTEM_BOOT` row. */
export const SYSTEM_BOOT_ADDRESS_HELPER_SOCKET_STATES = ['PRESENT', 'NOT_PRESENT'] as const;

/**
 * Task 4 row HC (decision C94 (j), reversing C49 (1); review 119 R119-12): THE ADDRESS HELPER A PRODUCTION BOOT ON
 * LINUX STATES in its `SYSTEM_BOOT` row. The helper is not part of every production installation; a host without it
 * starts, and its commissioning functions answer their own refusal.
 *
 *   addressHelperSocket   `PRESENT` or `NOT_PRESENT`: whether something lay at the ONE path the delivered socket unit
 *                         of the helper installs, when the fence step looked
 *
 * WRITTEN BEFORE THE BOOT CHECKS RUN, from one look at one fixed path and no question to the host. `NOT_PRESENT` says
 * that nothing was found there (or that the path could not be reached) - not that no part of the helper is installed;
 * `PRESENT` says that something was there - not that it is a socket of root with the delivered group and mode. The
 * boot checks judge both a moment later: a helper that is wrong, or of which only a part is there, is a REFUSED start
 * (the error log names it), and a helper of which nothing is there is the log line `CAPTURE_HOST_ALIAS_HELPER_ABSENT`.
 * Optional: only a `REAL_PRODUCTION` boot on `linux` states it; every other row carries no such member.
 */
export const SYSTEM_BOOT_ADDRESS_HELPER_DETAIL_RULES = {
  addressHelperSocket: {
    required: OPTIONAL,
    form: `one of ${SYSTEM_BOOT_ADDRESS_HELPER_SOCKET_STATES.join(', ')}`,
    accepts: (value) => typeof value === 'string' && (SYSTEM_BOOT_ADDRESS_HELPER_SOCKET_STATES as readonly string[]).includes(value),
  },
} as const satisfies Readonly<Record<string, DetailRule>>;

/** Row NB (design 06 row N13, SM-15): the codes of `microphonePermission` of a `SYSTEM_BOOT` row. */
export const SYSTEM_BOOT_MICROPHONE_PERMISSION_STATES = ['NOT_KNOWN'] as const;

/**
 * Task 4 row NB (design 06 row N13, SM-15): THE MICROPHONE PERMISSION A PRODUCTION BOOT ON DARWIN STATES in its
 * `SYSTEM_BOOT` row.
 *
 *   microphonePermission   `NOT_KNOWN`: the permission of the host to record cannot be read without opening a device
 *
 * Written by a `REAL_PRODUCTION` boot on `darwin` only. It is a FACT, not a pass: the boot does not know the
 * permission and says so. Optional: every other row carries no such member.
 */
export const SYSTEM_BOOT_MICROPHONE_DETAIL_RULES = {
  microphonePermission: {
    required: OPTIONAL,
    form: `one of ${SYSTEM_BOOT_MICROPHONE_PERMISSION_STATES.join(', ')}`,
    accepts: (value) => typeof value === 'string' && (SYSTEM_BOOT_MICROPHONE_PERMISSION_STATES as readonly string[]).includes(value),
  },
} as const satisfies Readonly<Record<string, DetailRule>>;

/** `rule`, or JSON null: a member a writer states as "not known" instead of leaving it out. */
const orNull = (rule: DetailRule): DetailRule => ({
  required: false,
  form: `${rule.form}, or null`,
  accepts: (value) => value === null || rule.accepts(value),
});

/**
 * Task 4 (row V4; decisions C71 (C-6), C72 (F-04), C76 (item 8); request line of row 209): THE
 * DETAILS RULE OF `SYSTEM_BOOT`, the one the audit writer itself applies to EVERY writer of such a
 * row (a native entry and a row the engine prepared alike), not only to the fence's.
 *
 * It is an OPEN rule: `SYSTEM_BOOT` stays one of the simulator's types, written by the shared code
 * with its own keys, so the type gets no closed list (`detailRulesOf` still answers undefined and
 * any other key is taken under the general rules). What the rule fixes is the form of the two
 * NAMED members whenever a row carries them: each is of its form above OR JSON NULL - a real boot
 * that cannot read a certificate writes both as null (SX-15; rows 201, 209), and the bare forms of
 * `SYSTEM_BOOT_SIGNING_DETAIL_RULES` refuse null. Absent is accepted as before.
 *
 * NOT part of this rule: "both or neither". That half of a pair states no key is the rule of the
 * boot entry's one writer (`bootSigningKeyProblemOf` of `capture/fence/boot-key.ts`); the writer
 * here holds each value to its form.
 */
export const SERVER_AUDIT_OPEN_DETAIL_RULES = {
  [AuditType.SYSTEM_BOOT]: {
    signingKeyId: orNull(SYSTEM_BOOT_SIGNING_DETAIL_RULES.signingKeyId),
    signingCertificateSha256: orNull(SYSTEM_BOOT_SIGNING_DETAIL_RULES.signingCertificateSha256),
    // Row V5 (C84 R-1): the state of the signer store, each member of its form or null (the store could not be read).
    signingKeysRetained: orNull(SYSTEM_BOOT_SIGNING_STORE_DETAIL_RULES.signingKeysRetained),
    signingKeysCompromised: orNull(SYSTEM_BOOT_SIGNING_STORE_DETAIL_RULES.signingKeysCompromised),
    signingCertificatesSha256: orNull(SYSTEM_BOOT_SIGNING_STORE_DETAIL_RULES.signingCertificatesSha256),
    signingStoreChange: orNull(SYSTEM_BOOT_SIGNING_STORE_DETAIL_RULES.signingStoreChange),
    // Row P1 (U21 (2)): the host of a production boot - the platform of its form or null (not one a production Core starts on), and the code.
    hostPlatform: orNull(SYSTEM_BOOT_HOST_DETAIL_RULES.hostPlatform),
    hostProfile: SYSTEM_BOOT_HOST_DETAIL_RULES.hostProfile,
    // Row HC (C94 (j)): whether something lay at the installed socket path of the address helper - a code, never null (a boot that does not state it leaves it out).
    addressHelperSocket: SYSTEM_BOOT_ADDRESS_HELPER_DETAIL_RULES.addressHelperSocket,
    // Row NB (design 06 row N13, SM-15): the microphone permission a darwin production boot states - a code, never null (a boot that does not state it leaves it out).
    microphonePermission: SYSTEM_BOOT_MICROPHONE_DETAIL_RULES.microphonePermission,
  },
} as const satisfies Partial<Record<AuditType, Readonly<Record<string, DetailRule>>>>;

/** The open rule of `type` (named members held to a form, every other key free), or undefined. */
export function openDetailRulesOf(type: AuditType): Readonly<Record<string, DetailRule>> | undefined {
  return (SERVER_AUDIT_OPEN_DETAIL_RULES as Partial<Record<AuditType, Readonly<Record<string, DetailRule>>>>)[type];
}
