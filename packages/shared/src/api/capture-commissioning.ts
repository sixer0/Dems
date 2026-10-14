/**
 * The commissioning functions of the camera network: operations 101 to 107 of the Core API (task 4,
 * blueprint row 102, package WP-23b; design `masterplan/01_specs.md` fork F-4.2, rules DR-1 to
 * DR-12; schema set B, `masterplan/03_db_schema_extension.md` sections 2.4 and 2.5; decisions U6,
 * U7, U9, U10, C1, C7, C19; security findings S13-08, S13-11).
 *
 * | # | operationId | Access | Audit on success |
 * |--:|-------------|--------|------------------|
 * | 101 | `getCaptureNetworkConfig` | CAPTURE_COMMISSION + WEB_CONSOLE_SESSION | NONE-R |
 * | 102 | `updateCaptureNetworkConfig` | CAPTURE_COMMISSION + WEB_CONSOLE_SESSION | CAPTURE_NETWORK_CONFIG_CHANGED |
 * | 103 | `scanFactoryCameras` | CAPTURE_COMMISSION + WEB_CONSOLE_SESSION | CAMERA_FACTORY_SCANNED (+ HOST_ALIAS_ADDED, HOST_ALIAS_REMOVED) |
 * | 104 | `getHostAlias` | CAPTURE_COMMISSION + WEB_CONSOLE_SESSION | NONE-R |
 * | 105 | `removeHostAlias` | CAPTURE_COMMISSION + WEB_CONSOLE_SESSION | HOST_ALIAS_REMOVED (or HOST_ALIAS_REMOVE_FAILED) |
 * | 106 | `setCameraNetwork` | CAPTURE_COMMISSION + WEB_CONSOLE_SESSION | CAMERA_NETWORK_SET (+ the alias rows; + CAPTURE_DEVICE_ADDRESS_CHANGED) |
 * | 107 | `getCameraNetworkJob` | CAPTURE_COMMISSION + WEB_CONSOLE_SESSION | NONE-R |
 *
 * THIS FILE IS THE CONTRACT ONLY. No Core route, no job and no screen exists yet (blueprint rows
 * 106 to 113). The in-app simulator answers all seven (`sim/api.ts`) with answers that say they
 * are synthetic and that change nothing.
 *
 * WHO. The permission `CAPTURE_COMMISSION`, held by TECHNICIAN only (decision U10), on a web
 * console session only: a tablet or a phone is refused `403` before the body is used. Idle only:
 * with a session open every one of the five writing operations answers `409 CAPTURE_CONFIG_LOCKED`.
 *
 * NOTHING HERE CHOOSES AN INTERFACE AND NOTHING SCANS IN THE BACKGROUND. The camera interface and
 * the camera subnet are settings an operator writes (operation 102); until both are set the
 * functions answer "not configured". A scan (103) happens because an operator asked (decision U9:
 * active scan only), and its result is not stored. A found camera is no capture device: adoption
 * stays operation 96.
 *
 * WHERE THE CORE MAY DIAL IS THE CORE'S RULE. Every address member of this file is held to a FORM
 * that is no looser than the strict literal of the Core's one destination rule
 * (`apps/core-server/src/capture/destination-rule.ts`): one strict dotted IPv4 quad inside
 * `10.0.0.0/8`, `172.16.0.0/12` or `192.168.0.0/16`, host part 1 to 254. No name, no port, no
 * prefix on an address, no IPv6, no DHCP mode. Whether an address of that form may be dialled (the
 * camera interface, the Core's own addresses, another interface's subnet, a registered camera) is
 * the rule's decision, and its refusal is ONE reason, never the address.
 *
 * THE CREDENTIAL OF OPERATION 106 IS TYPED FOR THAT ONE OPERATION AND NEVER STORED (decisions C1,
 * C7). It is the fourth credential-carrying operation beside 89, 95 and 96
 * (`CREDENTIAL_CARRYING_OPERATIONS`): write-only, in process memory until the set-network call and
 * its own read-back end, never in a log line, an audit row, an error, a file, an argument or the
 * environment, never reused for another camera or a later job. Adoption (96) asks for it again.
 *
 * THE ALIAS HELPER (decision C19) is a root service on a local socket; the Core's one caller sends
 * it ONE line. The line's two forms and its limits are stated here as contract facts
 * (`HOST_ALIAS_HELPER`), so that the caller, the screens and the tests read one statement.
 */
import { z } from 'zod';
import { AuditType, Permission } from '../sim/vocabulary';
import { CAPTURE_CANDIDATE_TEXT_MAX_LENGTH } from './capture';
import { CAPTURE_CAMERA_DEVICE_ID_PATTERN, CaptureDiscoveryReason } from './capture-discovery';
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
import { OPERATOR_ID_PATTERN } from './patterns';
import { count, epochMs } from './schema-parts';
import { apiText } from './text';
import { STT_REVISION_CONFLICT_REASON } from './transcription';

// ═══════════════════════════════════════════════════════════════════════════════════════
// Forms and bounds
// ═══════════════════════════════════════════════════════════════════════════════════════

/** One number of a dotted IPv4 address, 0 to 255, without a leading zero. */
const OCTET = '(?:25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]\\d|\\d)';
/** The host part of an address inside a /24: 1 to 254, never the network or the broadcast address. */
const HOST_PART = '(?:25[0-4]|2[0-4]\\d|1\\d\\d|[1-9]\\d|[1-9])';
/** The first three numbers of an address inside 10.0.0.0/8, 172.16.0.0/12 or 192.168.0.0/16. */
const PRIVATE_FIRST_THREE = `(?:10\\.${OCTET}\\.${OCTET}|172\\.(?:1[6-9]|2\\d|3[01])\\.${OCTET}|192\\.168\\.${OCTET})`;

/**
 * The form of every camera address of the commissioning functions: ONE strict dotted quad inside
 * a private range, host part 1 to 254. No leading zero, no hexadecimal or octal part, no bare
 * integer, no port, no prefix length, no name, no IPv6, no blank. It is a subset of the typed
 * address of operation 93 (`CAPTURE_DISCOVERY_TYPED_ADDRESS_PATTERN`) and no looser than point 1 of
 * the Core's destination rule: loopback, link-local, multicast, a public address and the first or
 * last address of a /24 cannot even be written. A FORM ONLY: the rule decides.
 */
export const CAPTURE_PRIVATE_HOST_ADDRESS_PATTERN = new RegExp(`^${PRIVATE_FIRST_THREE}\\.${HOST_PART}$`);
/** The longest text the pattern can match: `192.168.255.254`. */
export const CAPTURE_PRIVATE_HOST_ADDRESS_MAX_LENGTH = 15;
/**
 * The camera subnet: a private IPv4 network as `a.b.c.d/n` with a prefix length of 16 to 30 (the
 * bounds of the destination rule, `CAMERA_SUBNET_MIN_PREFIX` and `CAMERA_SUBNET_MAX_PREFIX`, and of
 * the CHECK of `capture_network_config.camera_subnet`, which admits any IPv4 network: this form is
 * narrower). Whether the host bits are zero is the Core's check, not the form's.
 */
export const CAPTURE_CAMERA_SUBNET_PATTERN = new RegExp(`^${PRIVATE_FIRST_THREE}\\.${OCTET}/(?:1[6-9]|2\\d|30)$`);
export const CAPTURE_CAMERA_SUBNET_MAX_LENGTH = 18;
/**
 * The name of a network interface of the Core host, in the form of the CHECK of
 * `capture_network_config.interface_name` (schema version 14, migration `0030`; review 120 finding
 * F-4, decision C114) and of the alias helper's own rule: 1 to 15 characters of letters of either
 * case, digits, `_`, `.` and `-`, the first a letter or a digit. THE ONE CONTRACT CONSTANT: both
 * request and answer schemas take it, and the Core's database test holds it equal to the CHECK.
 */
export const CAPTURE_INTERFACE_NAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_.-]{0,14}$/;
/** A hardware address in its one closed form: six pairs of upper-case hexadecimal digits with colons. */
export const CAPTURE_MAC_ADDRESS_PATTERN = /^[0-9A-F]{2}(?::[0-9A-F]{2}){5}$/;
/** The id of a temporary host address: the key of its row, a lower-case UUID. */
export const HOST_ALIAS_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
/** The id of a set-network job: `CNJ-` and six digits. Minted by the Core; meaningful only inside the operator session that started the job. */
export const CAMERA_NETWORK_JOB_ID_PATTERN = /^CNJ-\d{6}$/;

/** The bounds of the seven settings of `capture_network_config` (schema set B and version 14; the CHECKs of the table). */
export const CAPTURE_NETWORK_CONFIG_LIMITS = Object.freeze({
  /** At most this many stored factory addresses: the scan's bound (destination rule, point 4). */
  factoryAddressesMax: 32,
  aliasHostMin: 2,
  aliasHostMax: 254,
  aliasMinutesMin: 5,
  aliasMinutesMax: 480,
  cameraIpStartMin: 2,
  cameraIpStartMax: 250,
  /**
   * The allowed ONVIF ports (code review 120b finding S2-02, decision C116; `capture_network_config_onvif_ports_check`
   * and `..._distinct_check`, migration `0030`): 1 to 8 entries (the destination rule's `DESTINATION_MAX_PORTS`), each
   * a whole number 1 to 65535, no port twice, kept in the order written.
   */
  onvifPortsMin: 1,
  onvifPortsMax: 8,
  onvifPortMin: 1,
  onvifPortMax: 65535,
} as const);
/**
 * The values of a row nobody has written yet: the reference application's defaults, CARRIED AS THEY
 * ARE and tested against no camera (record of blueprint row 99). The interface and the subnet have
 * NO default: the Core never chooses them.
 */
export const CAPTURE_NETWORK_CONFIG_DEFAULTS = Object.freeze({
  factoryAddresses: Object.freeze(['192.168.1.64', '192.168.1.108', '192.168.0.90', '192.168.1.13'] as const),
  aliasHost: 253,
  aliasMinutes: 30,
  cameraIpStart: 101,
  /** The column's default (`DEFAULT '[80]'`) and the destination rule's `DESTINATION_DEFAULT_PORTS`: the `http:` port of the ONVIF device service. */
  onvifPorts: Object.freeze([80] as const),
} as const);
/** The seven settings an operator can change, by member name: the NAMES the audit row of operation 102 lists. */
export const CAPTURE_NETWORK_CONFIG_FIELDS = ['interfaceName', 'cameraSubnet', 'factoryAddresses', 'aliasHost', 'aliasMinutes', 'cameraIpStart', 'onvifPorts'] as const;
export type CaptureNetworkConfigField = (typeof CAPTURE_NETWORK_CONFIG_FIELDS)[number];

/** A scan covers the stored list plus at most ONE typed address (destination rule, point 4). */
export const CAMERA_FACTORY_SCAN_MAX_TYPED_ADDRESSES = 1;
export const CAMERA_FACTORY_SCAN_MAX_DEVICES = CAPTURE_NETWORK_CONFIG_LIMITS.factoryAddressesMax + CAMERA_FACTORY_SCAN_MAX_TYPED_ADDRESSES;
/** The set-network job waits at most this long for the same MAC at the new address, asking every `..._POLL_MS`. */
export const CAMERA_NETWORK_SET_WAIT_MS = 180_000;
export const CAMERA_NETWORK_SET_POLL_MS = 4_000;
/** The typed credential is used for at most this many authenticated reads per job, beside the one set call. */
export const CAMERA_NETWORK_SET_MAX_AUTHENTICATED_READS = 3;
/**
 * A set-network job starts only from a scan that is at most this old (security review of row 119,
 * caution R119-03): a scan made before another camera was plugged in says nothing of the address now.
 */
export const CAMERA_NETWORK_SCAN_MAX_AGE_MS = 10 * 60_000;
/**
 * "Nothing answers at the new address" needs this many silent attempts, one after the other
 * (caution R119-06): one unanswered echo is "not known", never "free".
 */
export const CAMERA_NETWORK_FREE_ADDRESS_ATTEMPTS = 2;

/**
 * THE REQUEST LINE AND THE LIMITS OF THE ALIAS HELPER, as contract facts (decision C19; the
 * delivered file is `scripts/host/netalias/dems-core-netalias`, security item S13-08). The helper
 * is a root service on a local socket: one instance per connection, ONE request line, one answer
 * line `<code> <NAME>`. The Core's one caller builds the line with the two functions below and
 * with nothing else; no text of a request, a device or an operator forms a part of it.
 *
 *   add <a.b.c.d>/24 <minutes>      minutes 5 to 480
 *   del <a.b.c.d>/24
 *
 * The interface is NOT in the line: the helper reads it from its own root-owned file. One
 * temporary address at a time. The helper removes only an address it marked, and the kernel
 * removes the address by itself when its lifetime ends.
 */
export const HOST_ALIAS_HELPER = Object.freeze({
  /** One line of printable ASCII with single spaces, ended by a line feed, at most this many bytes with the line feed. */
  requestMaxBytes: 64,
  verbs: Object.freeze(['add', 'del'] as const),
  /** The one prefix length an alias has: the literal suffix `/24`. */
  prefixLength: 24,
  minutesMin: CAPTURE_NETWORK_CONFIG_LIMITS.aliasMinutesMin,
  minutesMax: CAPTURE_NETWORK_CONFIG_LIMITS.aliasMinutesMax,
  /** One temporary address in place at a time (the helper's own bound and the table's unique index). */
  maxAliases: 1,
} as const);

/** Thrown by the two line builders for a value outside the helper's form. Its text names the rule, never the value. */
export class HostAliasLineError extends Error {
  constructor(rule: string) {
    super(`a request line of the alias helper cannot be built: ${rule}`);
    this.name = 'HostAliasLineError';
  }
}

function aliasAddressOf(address: string): string {
  if (typeof address !== 'string' || !CAPTURE_PRIVATE_HOST_ADDRESS_PATTERN.test(address)) throw new HostAliasLineError('the address is no private IPv4 host address');
  return `${address}/${HOST_ALIAS_HELPER.prefixLength}`;
}

/** The line `add <a.b.c.d>/24 <minutes>` with its line feed. Throws `HostAliasLineError` for an address or a lifetime outside the form. */
export function hostAliasAddLine(address: string, minutes: number): string {
  if (!Number.isSafeInteger(minutes) || minutes < HOST_ALIAS_HELPER.minutesMin || minutes > HOST_ALIAS_HELPER.minutesMax) throw new HostAliasLineError('the lifetime is no whole number of 5 to 480 minutes');
  return `add ${aliasAddressOf(address)} ${String(minutes)}\n`;
}

/** The line `del <a.b.c.d>/24` with its line feed. Throws `HostAliasLineError` for an address outside the form. */
export function hostAliasDelLine(address: string): string {
  return `del ${aliasAddressOf(address)}\n`;
}

/** Why a temporary host address was added (`HOST_ALIAS_REASON` of schema set B). */
export const HostAliasReason = { FACTORY_SCAN: 'FACTORY_SCAN', SET_CAMERA_ADDRESS: 'SET_CAMERA_ADDRESS' } as const;
export type HostAliasReason = (typeof HostAliasReason)[keyof typeof HostAliasReason];

/**
 * WHAT THE CORE KNOWS OF THE NUMBER OF DEVICES AT ONE ADDRESS (security review of row 119, caution
 * R119-03; decision C94 (a)). A CLOSED THREE-STATE MEMBER, `FactoryCamera.deviceCount`, stands in
 * the place of the boolean `conflict` of the first contract: a boolean cannot say "not known", and
 * a reader of `conflict: false` would take a count nobody made for "no conflict". The old member is
 * REMOVED, not re-meant: a client of the first contract finds no `conflict` to read and its strict
 * schema refuses the answer, instead of drawing "no conflict".
 *
 * `NOT_KNOWN` is what a scan answers whenever its probe did not count - today always: a unicast
 * question is answered by the ONE hardware address the neighbour table holds, so it cannot count
 * (the count is amendment SR-13, not built). It is never drawn as "one device" or "no conflict".
 */
export const FactoryCameraDeviceCount = {
  /** The scan counted, and exactly one device answers at the address. */
  ONE: 'ONE',
  /** The scan counted, and more than one device answers: unplug all but one. A set-network job is refused. */
  MORE_THAN_ONE: 'MORE_THAN_ONE',
  /** The scan could not count. The Core cannot tell two cameras on one address apart: connect one factory-address camera at a time. */
  NOT_KNOWN: 'NOT_KNOWN',
} as const;
export type FactoryCameraDeviceCount = (typeof FactoryCameraDeviceCount)[keyof typeof FactoryCameraDeviceCount];

/** Where a set-network job is. */
export const CameraNetworkJobState = { RUNNING: 'RUNNING', COMPLETED: 'COMPLETED', FAILED: 'FAILED' } as const;
export type CameraNetworkJobState = (typeof CameraNetworkJobState)[keyof typeof CameraNetworkJobState];

/** What a running set-network job is doing, in the order it does it. */
export const CameraNetworkJobStep = {
  /** Reaching the camera at its present address (a temporary host address may be added for it). */
  REACHING: 'REACHING',
  /** The unauthenticated check, then the authenticated read of the MAC. */
  IDENTIFYING: 'IDENTIFYING',
  /** The set-network call with the typed credential. */
  SETTING: 'SETTING',
  /** Waiting for the same MAC at the new address. */
  WAITING: 'WAITING',
  /** Ended: see `state`. */
  DONE: 'DONE',
} as const;
export type CameraNetworkJobStep = (typeof CameraNetworkJobStep)[keyof typeof CameraNetworkJobStep];

/** Why a set-network job FAILED: a closed set of codes. Never a text a camera sent, never a credential. */
export const CameraNetworkJobFailure = {
  /** Nothing answered at the present address. */
  CAMERA_UNREACHABLE: 'CAMERA_UNREACHABLE',
  /** The camera answers, but not as an ONVIF device: it must be activated in its own web page first (DR-12). */
  ONVIF_NOT_ENABLED: 'ONVIF_NOT_ENABLED',
  /** The camera refused the typed credential. */
  AUTHENTICATION_FAILED: 'AUTHENTICATION_FAILED',
  /**
   * The hardware addresses do not agree: the neighbour table holds none or another than the one the
   * technician saw on the scan row (`scannedMac`; the job then stops BEFORE the typed account is
   * used), or the camera states another after authentication. Nothing is set.
   */
  MAC_MISMATCH: 'MAC_MISMATCH',
  /** The camera refused the new network setting, or answered what could not be read. */
  SET_REFUSED: 'SET_REFUSED',
  /** The same MAC did not answer at the new address inside the wait. */
  NOT_FOUND_AT_NEW_ADDRESS: 'NOT_FOUND_AT_NEW_ADDRESS',
  /** The temporary host address could not be added. */
  HOST_ALIAS_FAILED: 'HOST_ALIAS_FAILED',
  /** The Core stopped while the job ran: nothing more is known. */
  CORE_RESTARTED: 'CORE_RESTARTED',
} as const;
export type CameraNetworkJobFailure = (typeof CameraNetworkJobFailure)[keyof typeof CameraNetworkJobFailure];

/**
 * `details.reason` of the refusals of operations 101 to 107. No new error code: each is a reason
 * on an existing code. Two reasons are reused: `REVISION_CONFLICT` (the optimistic lock of
 * operation 91) for a stale `revision` of 102, and `CONNECTION_TEST_LOCKOUT_GUARD` (the lock-out
 * guard of operation 95) on the `429` of operation 106, which that guard counts as its fourth
 * credential-carrying operation.
 */
export const CaptureCommissioningReason = {
  // 409 INVALID_STATE
  /** The commissioning functions run on a production Core on its Linux host only (DR-1). The simulator's answer to every write. */
  COMMISSIONING_NOT_AVAILABLE: 'COMMISSIONING_NOT_AVAILABLE',
  /** The Core has no address helper configured (`DEMS_CAPTURE_ALIAS_SOCKET` is not set). */
  COMMISSIONING_HELPER_NOT_CONFIGURED: 'COMMISSIONING_HELPER_NOT_CONFIGURED',
  /** No camera interface or no camera subnet is chosen (operation 102). The Core never chooses one. */
  COMMISSIONING_NOT_CONFIGURED: 'COMMISSIONING_NOT_CONFIGURED',
  /** A scan or a set-network job is running: one at a time (DR-6). */
  COMMISSIONING_JOB_IN_PROGRESS: 'COMMISSIONING_JOB_IN_PROGRESS',
  /** No temporary host address is in place. */
  HOST_ALIAS_NOT_PRESENT: 'HOST_ALIAS_NOT_PRESENT',
  /** The helper refused or failed to add the address; `details.cause` is its code. */
  HOST_ALIAS_FAILED: 'HOST_ALIAS_FAILED',
  /** The helper failed to remove the address; `details.cause` is its code. One HOST_ALIAS_REMOVE_FAILED row is written. */
  HOST_ALIAS_REMOVE_FAILED: 'HOST_ALIAS_REMOVE_FAILED',
  /** The last scan found more than one device answering at this address: unplug all but one (DR-6). */
  CAMERA_ADDRESS_CONFLICT: 'CAMERA_ADDRESS_CONFLICT',
  /** The last scan is older than `CAMERA_NETWORK_SCAN_MAX_AGE_MS`, or the Core's clock went back since: scan again (caution R119-03). */
  CAMERA_SCAN_TOO_OLD: 'CAMERA_SCAN_TOO_OLD',
  /** `scannedMac` is not the hardware address the last scan showed for this address, or that scan showed none: the job cannot be bound to the camera the technician saw (caution R119-04). */
  CAMERA_HARDWARE_ADDRESS_NOT_BOUND: 'CAMERA_HARDWARE_ADDRESS_NOT_BOUND',
  /** Something already answers at the new address. */
  CAMERA_NEW_ADDRESS_IN_USE: 'CAMERA_NEW_ADDRESS_IN_USE',
  /** No free address is left in the camera subnet from the configured first one. */
  CAMERA_NO_FREE_ADDRESS: 'CAMERA_NO_FREE_ADDRESS',
  // 422 INVALID_INPUT
  /** An address of the body has the form of the schema, and the Core's destination rule refuses it. One reason for every rule; never the address. */
  COMMISSIONING_ADDRESS_NOT_ALLOWED: 'COMMISSIONING_ADDRESS_NOT_ALLOWED',
  /** A setting of operation 102 has the form of the schema and is refused as a whole: the subnet's host bits, an interface the host does not have, a repeated factory address. */
  NETWORK_CONFIG_NOT_ALLOWED: 'NETWORK_CONFIG_NOT_ALLOWED',
  // 429 RATE_LIMITED
  COMMISSIONING_SCAN_RATE_LIMITED: 'COMMISSIONING_SCAN_RATE_LIMITED',
} as const;
export type CaptureCommissioningReason = (typeof CaptureCommissioningReason)[keyof typeof CaptureCommissioningReason];

/** The sentence of each refusal reason: the `message` of the envelope. It never quotes an address, an interface or a credential. */
export const CAPTURE_COMMISSIONING_REFUSAL_SENTENCES: Readonly<Record<CaptureCommissioningReason, string>> = Object.freeze({
  [CaptureCommissioningReason.COMMISSIONING_NOT_AVAILABLE]: 'The camera network can be set up on a production Core only.',
  [CaptureCommissioningReason.COMMISSIONING_HELPER_NOT_CONFIGURED]: 'The address helper of this Core is not configured.',
  [CaptureCommissioningReason.COMMISSIONING_NOT_CONFIGURED]: 'Choose the camera interface and the camera subnet first.',
  [CaptureCommissioningReason.COMMISSIONING_JOB_IN_PROGRESS]: 'A scan or an address change is running. Wait until it ends.',
  [CaptureCommissioningReason.HOST_ALIAS_NOT_PRESENT]: 'No temporary address is in place.',
  [CaptureCommissioningReason.HOST_ALIAS_FAILED]: 'The temporary address could not be added.',
  [CaptureCommissioningReason.HOST_ALIAS_REMOVE_FAILED]: 'The temporary address could not be removed.',
  [CaptureCommissioningReason.CAMERA_ADDRESS_CONFLICT]: 'More than one camera answers at this address. Unplug all but one and scan again.',
  [CaptureCommissioningReason.CAMERA_SCAN_TOO_OLD]: 'The last scan is too old. Scan again.',
  [CaptureCommissioningReason.CAMERA_HARDWARE_ADDRESS_NOT_BOUND]: 'The hardware address is not the one the last scan showed at this address. Scan again and compare it with the label on the camera.',
  [CaptureCommissioningReason.CAMERA_NEW_ADDRESS_IN_USE]: 'Something already answers at the new address.',
  [CaptureCommissioningReason.CAMERA_NO_FREE_ADDRESS]: 'No free address is left in the camera subnet.',
  [CaptureCommissioningReason.COMMISSIONING_ADDRESS_NOT_ALLOWED]: 'This address is not allowed for a camera.',
  [CaptureCommissioningReason.NETWORK_CONFIG_NOT_ALLOWED]: 'These network settings are not allowed.',
  [CaptureCommissioningReason.COMMISSIONING_SCAN_RATE_LIMITED]: 'Too many scans. Try again shortly.',
});

/**
 * THE CREDENTIAL-CARRYING OPERATIONS: the four whose request body holds a camera credential, or is
 * one (design F-4.2 DR-8: "the fourth beside 89, 95, 96"). Each is web console only, never offered
 * for "Try it", and counted by the one lock-out guard. A test holds this list equal to the
 * operations whose request schema holds `CaptureCredentialWriteRequest`.
 */
export const CREDENTIAL_CARRYING_OPERATIONS = ['setCaptureDeviceCredential', 'testCaptureCandidateConnection', 'adoptCaptureCandidate', 'setCameraNetwork'] as const;
export type CredentialCarryingOperation = (typeof CREDENTIAL_CARRYING_OPERATIONS)[number];

// ═══════════════════════════════════════════════════════════════════════════════════════
// Schemas
// ═══════════════════════════════════════════════════════════════════════════════════════

const privateHost = () => z.string().max(CAPTURE_PRIVATE_HOST_ADDRESS_MAX_LENGTH).regex(CAPTURE_PRIVATE_HOST_ADDRESS_PATTERN);
const interfaceName = () => z.string().regex(CAPTURE_INTERFACE_NAME_PATTERN);
const cameraSubnet = () => z.string().max(CAPTURE_CAMERA_SUBNET_MAX_LENGTH).regex(CAPTURE_CAMERA_SUBNET_PATTERN);
const factoryAddresses = () => z.array(privateHost()).max(CAPTURE_NETWORK_CONFIG_LIMITS.factoryAddressesMax);
const aliasHost = () => z.int().min(CAPTURE_NETWORK_CONFIG_LIMITS.aliasHostMin).max(CAPTURE_NETWORK_CONFIG_LIMITS.aliasHostMax);
const aliasMinutes = () => z.int().min(CAPTURE_NETWORK_CONFIG_LIMITS.aliasMinutesMin).max(CAPTURE_NETWORK_CONFIG_LIMITS.aliasMinutesMax);
const cameraIpStart = () => z.int().min(CAPTURE_NETWORK_CONFIG_LIMITS.cameraIpStartMin).max(CAPTURE_NETWORK_CONFIG_LIMITS.cameraIpStartMax);
/** The allowed ONVIF ports: the table's two CHECKs as a form (S2-02, C116). The order is kept: the first is the port of an address that names none. */
const onvifPorts = () =>
  z
    .array(z.int().min(CAPTURE_NETWORK_CONFIG_LIMITS.onvifPortMin).max(CAPTURE_NETWORK_CONFIG_LIMITS.onvifPortMax))
    .min(CAPTURE_NETWORK_CONFIG_LIMITS.onvifPortsMin)
    .max(CAPTURE_NETWORK_CONFIG_LIMITS.onvifPortsMax)
    .refine((ports) => new Set(ports).size === ports.length, { error: 'No port may be listed twice.' });
const macAddress = () => z.string().regex(CAPTURE_MAC_ADDRESS_PATTERN);
const aliasId = () => z.string().regex(HOST_ALIAS_ID_PATTERN);
const jobId = () => z.string().regex(CAMERA_NETWORK_JOB_ID_PATTERN);
const cameraDeviceId = () => z.string().regex(CAPTURE_CAMERA_DEVICE_ID_PATTERN);
/** A text a device announced. Untrusted: bounded, storable, drawn as text only. */
const announcedText = () => apiText().min(1).max(CAPTURE_CANDIDATE_TEXT_MAX_LENGTH);

/** The one row of `capture_network_config` as operations 101 and 102 answer it. */
export const CaptureNetworkConfigSchema = z
  .strictObject({
    configured: z.boolean().describe('True when both the camera interface and the camera subnet are set. False: the commissioning functions answer `COMMISSIONING_NOT_CONFIGURED`.'),
    interfaceName: interfaceName().nullable().describe('The network interface the cameras are on, as the operator chose it. Null: not chosen. The Core never chooses one.'),
    cameraSubnet: cameraSubnet().nullable().describe('The camera subnet as `a.b.c.d/n`, prefix length 16 to 30. Null: not chosen.'),
    factoryAddresses: factoryAddresses().describe('The factory addresses a scan asks: at most 32 private IPv4 host addresses. A camera at another address is found only by a typed address.'),
    aliasHost: aliasHost().describe('The host part (2 to 254) of the temporary address the Core takes in a factory /24.'),
    aliasMinutes: aliasMinutes().describe('The lifetime of a temporary address in minutes (5 to 480): the kernel removes the address when it ends.'),
    cameraIpStart: cameraIpStart().describe('The host part (2 to 250) of the first address a set-network job offers a camera in the camera subnet.'),
    onvifPorts: onvifPorts().describe(
      'The ports a stored camera\'s ONVIF device service may be dialled on: 1 to 8 whole numbers 1 to 65535, no port twice, in the order written; [80] for a configuration nobody has written yet. A camera stored without a port is dialled on 80, which must then be listed.',
    ),
    revision: z.int().min(1).describe('Optimistic revision: send it back in `updateCaptureNetworkConfig`. 1 for a configuration nobody has written yet.'),
    updatedAt: epochMs().nullable().describe('When the configuration was last written; null when nobody has written it yet.'),
    updatedBy: z.string().regex(OPERATOR_ID_PATTERN).nullable().describe('Who wrote it last; null when nobody has.'),
  })
  .describe('The camera network configuration of the Core (task 4, operations 101 and 102; schema set B). One per Core. It holds no credential.');
export type CaptureNetworkConfig = z.output<typeof CaptureNetworkConfigSchema>;

/** Request body of operation 102: `revision` plus the settings to change. A setting that is absent is left as it is. */
export const CaptureNetworkConfigUpdateRequestSchema = z
  .strictObject({
    revision: z.int().min(1).describe('The `revision` of the configuration this update was made from (optimistic lock).'),
    interfaceName: interfaceName().nullable().optional().describe('The camera interface; null clears the choice.'),
    cameraSubnet: cameraSubnet().nullable().optional().describe('The camera subnet as `a.b.c.d/n`; null clears the choice.'),
    factoryAddresses: factoryAddresses().optional(),
    aliasHost: aliasHost().optional(),
    aliasMinutes: aliasMinutes().optional(),
    cameraIpStart: cameraIpStart().optional(),
    onvifPorts: onvifPorts().optional().describe('The whole list of allowed ONVIF ports, replacing the stored one: 1 to 8 ports 1 to 65535, no port twice, in order.'),
  })
  .describe('Request body of `POST /api/v1/capture/network/config` (task 4, operation 102). No member carries a credential, a gateway or a DHCP mode; the only ports are the allowed ONVIF port list.');
export type CaptureNetworkConfigUpdateRequest = z.output<typeof CaptureNetworkConfigUpdateRequestSchema>;

/** A temporary address the Core put on the camera interface through the alias helper. */
export const HostAliasSchema = z
  .strictObject({
    aliasId: aliasId(),
    address: privateHost().describe('The temporary address, without its prefix length (always /24).'),
    reason: z.enum(HostAliasReason).describe('What it was added for.'),
    addedAt: epochMs(),
    expiresAt: epochMs().describe('When the kernel removes the address by itself.'),
    removeError: z
      .string()
      .regex(/^[A-Z][A-Z0-9_]{0,63}$/)
      .nullable()
      .describe('The code of a removal that failed (the address is then still in place); null otherwise. A code, never the helper\'s text.'),
  })
  .describe('The temporary host address in place (task 4, schema set B). One at a time.');
export type HostAlias = z.output<typeof HostAliasSchema>;

/** Operation 104's answer, and 105's: the address in place, or none. */
export const HostAliasStateSchema = z
  .strictObject({
    alias: HostAliasSchema.nullable().describe('The temporary address in place; null when there is none.'),
  })
  .describe('The alias state of the Core host (task 4, operations 104 and 105).');
export type HostAliasState = z.output<typeof HostAliasStateSchema>;

/** Request body of operation 103. Optional, with one optional member. */
export const CameraFactoryScanRequestSchema = z
  .strictObject({
    address: privateHost().optional().describe('ONE address the operator typed, asked beside the stored list. A camera outside the list is found only this way.'),
  })
  .describe('Request body of `POST /api/v1/capture/network/scan` (task 4, operation 103). No list, range, subnet, port, interface or timeout can be sent.');
export type CameraFactoryScanRequest = z.output<typeof CameraFactoryScanRequestSchema>;

/** One device a commissioning scan found. Not a capture device and not a candidate of a camera search. */
export const FactoryCameraSchema = z
  .strictObject({
    address: privateHost().describe('The address that answered: one of the addresses the scan asked.'),
    mac: macAddress().nullable().describe('The hardware address from the host\'s neighbour table; null when the table holds none.'),
    onvifReachable: z.boolean().describe('Whether the unauthenticated ONVIF check was answered. False: the camera may need activation in its own web page first.'),
    endpointCount: count().nullable().describe('How many distinct devices answered from this address, when the scan counted them; null when it could not count. Null is NOT one.'),
    deviceCount: z
      .enum(FactoryCameraDeviceCount)
      .describe('What the Core knows of the number of devices at this address. `MORE_THAN_ONE`: unplug all but one; a set-network job is refused. `NOT_KNOWN`: the scan could not count - the Core cannot tell two cameras on one address apart, so connect ONE factory-address camera at a time; it is never "no conflict". It stands in the place of the boolean `conflict` of the first contract.'),
    vendor: announcedText().nullable().describe('Announced. Untrusted device text: draw it as text only.'),
    model: announcedText().nullable().describe('Announced. Untrusted device text: draw it as text only.'),
    name: announcedText().nullable().describe('Announced. Untrusted device text: draw it as text only.'),
    registeredDeviceId: cameraDeviceId().nullable().describe('The registered camera with this hardware address, if any; null otherwise.'),
  })
  .describe('One device of a commissioning scan (task 4, operation 103). It carries no credential and no link.');
export type FactoryCamera = z.output<typeof FactoryCameraSchema>;

/** Operation 103's answer. In memory only: nothing of it is stored. */
export const CameraFactoryScanSchema = z
  .strictObject({
    scannedAt: epochMs(),
    addressCount: count().describe('How many addresses were asked: the stored list plus the typed one.'),
    devices: z.array(FactoryCameraSchema).max(CAMERA_FACTORY_SCAN_MAX_DEVICES),
    alias: HostAliasSchema.nullable().describe('The temporary host address still in place when the scan ended. The scan removes what it added before it answers, so this is null as a rule; an address is named only when its removal could not be confirmed.'),
    synthetic: z.boolean().describe('True for an answer of the in-app simulator: nothing was scanned and the listed device does not exist.'),
  })
  .describe('The result of a commissioning scan (task 4, operation 103). Not stored; a found device is registered by nothing here.');
export type CameraFactoryScan = z.output<typeof CameraFactoryScanSchema>;

/**
 * Request body of operation 106. `credential` is the pair of operation 89: typed for this ONE job
 * on this ONE camera, write-only, never stored (decisions C1, C7).
 */
export const CameraNetworkSetRequestSchema = z
  .strictObject({
    fromAddress: privateHost().describe('The address the camera answers at now: an address of the caller\'s last scan.'),
    scannedMac: macAddress().describe('The hardware address the scan row of `fromAddress` showed: what the technician compared with the label on the camera. Required: a row without a hardware address cannot be started. The job is BOUND to it - it is refused when the last scan showed another, and it stops before the typed account is used when the neighbour table holds another, and before anything is set when the camera states another.'),
    toAddress: privateHost().optional().describe('The new address, inside the camera subnet. Absent: the Core takes the next free address from the configured first one.'),
    gateway: privateHost().optional().describe('The gateway to set on the camera, inside the camera subnet. Absent: none is set.'),
    credential: CaptureCredentialWriteRequestSchema.describe('The camera account the operator typed for this job. Write-only: never returned, stored, logged or audited; never reused for another camera or a later job.'),
  })
  .describe('Request body of `POST /api/v1/capture/network/cameras/address` (task 4, operation 106). The prefix length comes from the configuration; DHCP mode cannot be asked.');
export type CameraNetworkSetRequest = z.output<typeof CameraNetworkSetRequestSchema>;

/** A set-network job as operations 106 and 107 answer it. It never holds the credential. */
export const CameraNetworkJobSchema = z
  .strictObject({
    jobId: jobId(),
    state: z.enum(CameraNetworkJobState),
    step: z.enum(CameraNetworkJobStep),
    fromAddress: privateHost(),
    toAddress: privateHost().nullable().describe('The new address: as typed, or the one the Core took; null until it is known.'),
    scannedMac: macAddress().describe('The hardware address of the request: the one the technician saw on the scan row. The job changes no device that states another.'),
    deviceCount: z.enum(FactoryCameraDeviceCount).describe('What the last scan knew of the number of devices at `fromAddress` when the job started. `NOT_KNOWN`: the count was not made, and the job ran on the hardware-address checks alone.'),
    neighbourMac: macAddress().nullable().describe('The hardware address of `fromAddress` from the host\'s neighbour table, before anything is sent with a credential. It must equal `scannedMac`, or the job stops before the typed account is used.'),
    authenticatedMac: macAddress().nullable().describe('The hardware address the camera states after authentication. It must equal `neighbourMac` and `scannedMac`, or the job stops.'),
    confirmedMac: macAddress().nullable().describe('The hardware address that answered at the new address after the change. COMPLETED only when it equals `authenticatedMac`.'),
    deviceId: cameraDeviceId().nullable().describe('The registered camera whose stored address this job changed with it; null when the camera is not registered.'),
    failure: z.enum(CameraNetworkJobFailure).nullable().describe('Why the job FAILED; null otherwise. A code: never a text the camera sent.'),
    startedAt: epochMs(),
    endedAt: epochMs().nullable(),
  })
  .describe('A set-network job (task 4, operations 106 and 107). Data of the operator session that started it; kept in memory only.');
export type CameraNetworkJob = z.output<typeof CameraNetworkJobSchema>;

/** The schemas operations 101 to 107 add (merged into `CORE_API_SCHEMAS`). */
export const CAPTURE_COMMISSIONING_SCHEMAS = {
  CaptureNetworkConfig: CaptureNetworkConfigSchema,
  CaptureNetworkConfigUpdateRequest: CaptureNetworkConfigUpdateRequestSchema,
  HostAlias: HostAliasSchema,
  HostAliasState: HostAliasStateSchema,
  CameraFactoryScanRequest: CameraFactoryScanRequestSchema,
  FactoryCamera: FactoryCameraSchema,
  CameraFactoryScan: CameraFactoryScanSchema,
  CameraNetworkSetRequest: CameraNetworkSetRequestSchema,
  CameraNetworkJob: CameraNetworkJobSchema,
} as const;

// ═══════════════════════════════════════════════════════════════════════════════════════
// Operations
// ═══════════════════════════════════════════════════════════════════════════════════════

export const CAPTURE_NETWORK_CONFIG_PATH = `${API_BASE_PATH}/capture/network/config`;
export const CAMERA_FACTORY_SCAN_PATH = `${API_BASE_PATH}/capture/network/scan`;
export const HOST_ALIAS_PATH = `${API_BASE_PATH}/capture/network/alias`;
export const HOST_ALIAS_REMOVE_PATH = `${HOST_ALIAS_PATH}/remove`;
export const CAMERA_NETWORK_SET_PATH = `${API_BASE_PATH}/capture/network/cameras/address`;
export const CAMERA_NETWORK_JOB_PATH = `${API_BASE_PATH}/capture/network/jobs/{id}`;

/** Operations 101 to 107: CAPTURE_COMMISSION (TECHNICIAN only, decision U10) on a web console session only. */
export const CAPTURE_COMMISSION_ACCESS = { ...permissionAccess(Permission.CAPTURE_COMMISSION), conditions: [CoreApiAccessCondition.WEB_CONSOLE_SESSION] } as const;
const DENIED = { denial: AuditType.ACCESS_DENIED } as const;
const R = CaptureCommissioningReason;

const WEB_ONLY_REFUSED = `the operator's session is bound to a paired tablet or phone (NOT_PERMITTED, \`details.reason: ${WEB_CONSOLE_ONLY_REASON}\`; one ACCESS_DENIED audit row; refused before the body is used)`;
const WHO = '**TECHNICIAN only, web console only.** Needs CAPTURE_COMMISSION, which the TECHNICIAN role alone holds, and a web console session (`WEB_CONSOLE_SESSION`): a session of a tablet or a phone is refused `403 NOT_PERMITTED` with `details.reason: WEB_CONSOLE_ONLY` and one ACCESS_DENIED row.';
const IDLE = '**Idle only.** With a session open it answers `409 CAPTURE_CONFIG_LOCKED` and writes no audit row: the addresses of the camera port are not touched during a recording.';
const WHERE =
  `**Production capture on the Core's Linux host only.** Anywhere else nothing is changed and no audit row is written: \`409 INVALID_STATE\` with \`details.reason: ${R.COMMISSIONING_NOT_AVAILABLE}\`, or \`${R.COMMISSIONING_HELPER_NOT_CONFIGURED}\` when the Core has no address helper configured.`;
const DESTINATION =
  `Every address is held to the Core's one destination rule before a packet leaves: a private IPv4 address the camera interface reaches, never the Core's own, never inside the subnet of another interface. A refusal of that rule is \`422 INVALID_INPUT\` with \`details.reason: ${R.COMMISSIONING_ADDRESS_NOT_ALLOWED}\` - one reason for every rule, never the address.`;
const ALIAS_FACT =
  `A temporary address is added through the address helper of the host: one line, \`add <a.b.c.d>/${String(HOST_ALIAS_HELPER.prefixLength)} <minutes>\`, one address at a time, with a kernel lifetime of ${String(HOST_ALIAS_HELPER.minutesMin)} to ${String(HOST_ALIAS_HELPER.minutesMax)} minutes. The interface is not in the line: the helper reads it from its own root-owned file.`;
const SYNTHETIC = 'Its answer is synthetic and says so; it stores nothing, writes no audit row and changes no state.';
const refusedText = (text: string) => ({ description: text, schema: 'ApiError' }) as const;
const LOCKED_TEXT = 'A session is open (CAPTURE_CONFIG_LOCKED; no audit row)';
const BODY_422 = refusedText(`The body does not match its schema, or the Core's destination rule refuses an address (INVALID_INPUT, \`details.reason: ${R.COMMISSIONING_ADDRESS_NOT_ALLOWED}\`). The refusal never quotes the input. Nothing is changed.`);
const JOB_PARAM = {
  name: 'id',
  description: 'A set-network job of the caller\'s own operator session, e.g. `CNJ-000001`. Never an address and never a capture device id.',
  pattern: CAMERA_NETWORK_JOB_ID_PATTERN,
} as const;
const SOURCE = (number: number, what: string): string =>
  `Task 4, blueprint row 102 (WP-23b), operation ${String(number)}: ${what}; design F-4.2; decisions U6, U7, U9, U10 (not in the design book)`;

export const CAPTURE_COMMISSIONING_OPERATIONS = [
  {
    operationId: 'getCaptureNetworkConfig',
    method: 'get',
    path: CAPTURE_NETWORK_CONFIG_PATH,
    tag: CoreApiTag.DEVICE,
    mode: CoreApiMode.SIMULATED,
    summary: 'Camera network configuration',
    description: [
      'The camera network configuration of the Core: the camera interface, the camera subnet, the factory address list, and the three numbers of the temporary address and of the first camera address. One per Core. `configured` is false until both the interface and the subnet are chosen: **the Core never chooses an interface**, and until then the commissioning functions answer `COMMISSIONING_NOT_CONFIGURED`.',
      WHO + ' It can be read while a session is open.',
      'A configuration nobody has written yet answers the stated defaults with `revision: 1`, `updatedAt: null` and no interface. The defaults of the factory list are the reference application\'s and were tested against no camera.',
      `${SIM_V2_NOTE} The simulator holds no host: it answers a fixed configuration whose interface is named \`simulated0\`, an interface no host has.`,
    ].join('\n\n'),
    source: SOURCE(101, 'the read of `capture_network_config`'),
    responses: {
      200: { description: 'The camera network configuration.', schema: 'CaptureNetworkConfig' },
      401: NOT_SIGNED_IN,
      403: notPermitted(Permission.CAPTURE_COMMISSION, WEB_ONLY_REFUSED),
    },
    access: CAPTURE_COMMISSION_ACCESS,
    audit: { success: CoreApiAuditNone.READ, ...DENIED },
    services: CORE_SERVER_ONLY,
  },
  {
    operationId: 'updateCaptureNetworkConfig',
    method: 'post',
    path: CAPTURE_NETWORK_CONFIG_PATH,
    tag: CoreApiTag.DEVICE,
    mode: CoreApiMode.SIMULATED,
    summary: 'Change the camera network configuration',
    description: [
      'Stores a change of the camera network configuration. The body names `revision` (the optimistic lock) and the settings to change; a setting that is absent is left as it is. `interfaceName` and `cameraSubnet` may be set to null: the commissioning functions then answer "not configured". No address of the host is changed by this operation and nothing is sent to any device.',
      WHO,
      IDLE,
      `Refusals, each storing nothing: a stale \`revision\` answers \`409 INVALID_STATE\` with \`details.reason: ${STT_REVISION_CONFLICT_REASON}\`; settings that have the form of the schema and are refused as a whole (host bits set in the subnet, an interface the host does not have, a factory address listed twice) answer \`422 INVALID_INPUT\` with \`details.reason: ${R.NETWORK_CONFIG_NOT_ALLOWED}\`.`,
      '`onvifPorts` replaces the whole list of allowed ONVIF ports (1 to 8, no port twice, the order kept). From the commit on, a stored camera is dialled only on a listed port; one stored without a port is dialled on 80, which must then be listed.',
      'On success writes one CAPTURE_NETWORK_CONFIG_CHANGED row whose details are `changedFields` (the NAMES of the changed settings, comma-joined; never a value) and `revision`, and - when `onvifPorts` changed - `onvifPortCount`, the number of ports now listed. An update that changes nothing answers `200` with the unchanged `revision` and writes no row.',
      WHERE,
      `${SIM_V2_NOTE} The simulator stores nothing: a body of the right form answers \`409 INVALID_STATE\` with \`details.reason: ${R.COMMISSIONING_NOT_AVAILABLE}\`.`,
    ].join('\n\n'),
    source: SOURCE(102, 'the write of `capture_network_config`'),
    requestBody: { schema: 'CaptureNetworkConfigUpdateRequest', required: true },
    responses: {
      200: { description: 'The configuration after the change.', schema: 'CaptureNetworkConfig', services: CORE_SERVER_ONLY },
      400: INVALID_JSON,
      401: NOT_SIGNED_IN,
      403: notPermitted(Permission.CAPTURE_COMMISSION, WEB_ONLY_REFUSED),
      409: refusedText(`${LOCKED_TEXT}, the \`revision\` of the body is not the stored one (INVALID_STATE, \`details.reason: ${STT_REVISION_CONFLICT_REASON}\`), or the Core cannot commission (INVALID_STATE, \`details.reason\`: ${R.COMMISSIONING_NOT_AVAILABLE}). Nothing is stored.`),
      422: refusedText(`The body does not match its schema, or its settings are refused as a whole (INVALID_INPUT, \`details.reason: ${R.NETWORK_CONFIG_NOT_ALLOWED}\`). The refusal never quotes the input. Nothing is stored.`),
    },
    access: CAPTURE_COMMISSION_ACCESS,
    audit: { success: AuditType.CAPTURE_NETWORK_CONFIG_CHANGED, ...DENIED },
    services: CORE_SERVER_ONLY,
  },
  {
    operationId: 'scanFactoryCameras',
    method: 'post',
    path: CAMERA_FACTORY_SCAN_PATH,
    tag: CoreApiTag.DEVICE,
    mode: CoreApiMode.SIMULATED,
    summary: 'Scan the factory addresses for cameras',
    description: [
      'Asks the stored factory addresses, and ONE address the operator may type, whether a camera answers there. A factory-new camera sits on its maker\'s subnet, so the Core may first take a temporary address in that /24. **An active scan, once, now** (decision U9): nothing listens in the background, nothing scans a range, and a camera outside the list is found only by a typed address. The body is optional and holds at most `address`.',
      WHO,
      IDLE,
      DESTINATION,
      ALIAS_FACT + ' **The scan takes every temporary address away again before it answers**, on every way it can end; the list may need one per /24, one after the other. `alias` states what is still in place when the scan ends: `null` as a rule, and the address only when its removal could not be confirmed - it is then removed by operation 105, when its lifetime ends, at shutdown or at the next start.',
      'The answer lists what answered: the address, the hardware address from the neighbour table, whether ONVIF answered without a credential, and `deviceCount`: what the Core KNOWS of the number of devices at the address. **A scan that could not count says `NOT_KNOWN`, never "one"** - today that is every scan, because one question to one address cannot count; the Core then cannot tell two cameras on one address apart, and ONE factory-address camera is connected at a time. Vendor, model and name are **untrusted device text**. **The result is not stored** and registers nothing: a found camera becomes a capture device only through operation 96.',
      'Writes one CAMERA_FACTORY_SCANNED row per scan (counts only: never an address, never device text). The rows of a temporary address are not the scan\'s: they are written by the alias lifecycle, **per /24 and not per scan** - one HOST_ALIAS_REQUESTED before each line to the helper, then HOST_ALIAS_ADDED or HOST_ALIAS_ADD_FAILED, and for the removal HOST_ALIAS_REMOVED or HOST_ALIAS_REMOVE_FAILED.',
      `One commissioning job at a time: \`409 INVALID_STATE\` with \`details.reason: ${R.COMMISSIONING_JOB_IN_PROGRESS}\`. No interface or subnet chosen: \`${R.COMMISSIONING_NOT_CONFIGURED}\`. The helper refused the temporary address: \`${R.HOST_ALIAS_FAILED}\` with \`details.cause\`. Over the spacing bound the Core answers \`429 RATE_LIMITED\` with \`retry-after\` and \`details.reason: ${R.COMMISSIONING_SCAN_RATE_LIMITED}\`; that is an envelope-level answer of the contract.`,
      WHERE,
      `${SIM_V2_NOTE} The simulator scans nothing: it answers ONE fixed device that is named as a test camera, with \`synthetic: true\` and no temporary address. ${SYNTHETIC}`,
    ].join('\n\n'),
    source: SOURCE(103, 'the commissioning scan'),
    requestBody: { schema: 'CameraFactoryScanRequest', required: false },
    responses: {
      200: { description: 'What answered. Not stored.', schema: 'CameraFactoryScan' },
      400: INVALID_JSON,
      401: NOT_SIGNED_IN,
      403: notPermitted(Permission.CAPTURE_COMMISSION, WEB_ONLY_REFUSED),
      409: refusedText(`${LOCKED_TEXT}, or the scan cannot run (INVALID_STATE, \`details.reason\`: ${R.COMMISSIONING_NOT_AVAILABLE}, ${R.COMMISSIONING_HELPER_NOT_CONFIGURED}, ${R.COMMISSIONING_NOT_CONFIGURED}, ${R.COMMISSIONING_JOB_IN_PROGRESS} or ${R.HOST_ALIAS_FAILED}). Nothing is asked of any device - with one exception: \`${R.HOST_ALIAS_FAILED}\` for the second or a later /24 of the list comes after the addresses of the earlier ones were asked; the CAMERA_FACTORY_SCANNED row (outcome FAILED) carries that count.`),
      422: BODY_422,
    },
    access: CAPTURE_COMMISSION_ACCESS,
    audit: { success: AuditType.CAMERA_FACTORY_SCANNED, ...DENIED, also: [AuditType.HOST_ALIAS_ADDED, AuditType.HOST_ALIAS_REMOVED] },
    services: CORE_SERVER_ONLY,
  },
  {
    operationId: 'getHostAlias',
    method: 'get',
    path: HOST_ALIAS_PATH,
    tag: CoreApiTag.DEVICE,
    mode: CoreApiMode.SIMULATED,
    summary: 'Temporary host address',
    description: [
      'The temporary address the Core put on the camera interface, or `alias: null` when none is in place. One at a time. It names the address, what it was added for, when it was added and when the kernel removes it by itself.',
      WHO + ' It can be read while a session is open.',
      `${SIM_V2_NOTE} The simulator holds no host: it always answers \`alias: null\`.`,
    ].join('\n\n'),
    source: SOURCE(104, 'the alias state'),
    responses: {
      200: { description: 'The temporary address in place, or none.', schema: 'HostAliasState' },
      401: NOT_SIGNED_IN,
      403: notPermitted(Permission.CAPTURE_COMMISSION, WEB_ONLY_REFUSED),
    },
    access: CAPTURE_COMMISSION_ACCESS,
    audit: { success: CoreApiAuditNone.READ, ...DENIED },
    services: CORE_SERVER_ONLY,
  },
  {
    operationId: 'removeHostAlias',
    method: 'post',
    path: HOST_ALIAS_REMOVE_PATH,
    tag: CoreApiTag.DEVICE,
    mode: CoreApiMode.SIMULATED,
    summary: 'Remove the temporary host address',
    description: [
      `Removes the temporary address of the camera interface now, through the address helper (one line, \`del <a.b.c.d>/${String(HOST_ALIAS_HELPER.prefixLength)}\`). **No body**: the Core names the address from its own state, never from a request, and the helper removes only an address it marked.`,
      WHO,
      IDLE,
      `With none in place it answers \`409 INVALID_STATE\` with \`details.reason: ${R.HOST_ALIAS_NOT_PRESENT}\`. While a scan or a set-network job runs: \`${R.COMMISSIONING_JOB_IN_PROGRESS}\`. A removal the helper failed answers \`${R.HOST_ALIAS_REMOVE_FAILED}\` with \`details.cause\`: the address is then still in place, the kernel removes it when its lifetime ends, and one HOST_ALIAS_REMOVE_FAILED row is written.`,
      'On success writes one HOST_ALIAS_REMOVED row with `removeReason: MANUAL`.',
      WHERE,
      `${SIM_V2_NOTE} The simulator never holds a temporary address: it answers \`409 INVALID_STATE\` with \`details.reason: ${R.HOST_ALIAS_NOT_PRESENT}\`.`,
    ].join('\n\n'),
    source: SOURCE(105, 'the removal of the temporary host address'),
    responses: {
      200: { description: 'The address is removed: `alias` is null.', schema: 'HostAliasState', services: CORE_SERVER_ONLY },
      401: NOT_SIGNED_IN,
      403: notPermitted(Permission.CAPTURE_COMMISSION, WEB_ONLY_REFUSED),
      409: refusedText(`${LOCKED_TEXT}, or nothing can be removed (INVALID_STATE, \`details.reason\`: ${R.HOST_ALIAS_NOT_PRESENT}, ${R.COMMISSIONING_JOB_IN_PROGRESS}, ${R.HOST_ALIAS_REMOVE_FAILED}, ${R.COMMISSIONING_NOT_AVAILABLE} or ${R.COMMISSIONING_HELPER_NOT_CONFIGURED}).`),
    },
    access: CAPTURE_COMMISSION_ACCESS,
    audit: { success: AuditType.HOST_ALIAS_REMOVED, ...DENIED, also: [AuditType.HOST_ALIAS_REMOVE_FAILED] },
    services: CORE_SERVER_ONLY,
  },
  {
    operationId: 'setCameraNetwork',
    method: 'post',
    path: CAMERA_NETWORK_SET_PATH,
    tag: CoreApiTag.DEVICE,
    mode: CoreApiMode.SIMULATED,
    summary: 'Give a camera its address in the camera subnet',
    description: [
      'Starts ONE set-network job on ONE camera: the camera that answers at `fromAddress` is given a fixed address inside the camera subnet - `toAddress`, or the next free one from the configured first address. The answer is `202` with the job; its progress is read with operation 107. The prefix length is the configuration\'s; a gateway is set only when the body names one; **DHCP mode cannot be asked**.',
      WHO,
      IDLE,
      '**The credential is typed for this one job and never stored** (decisions C1, C7). `credential` is the pair of operation 89. It lives in the Core\'s memory until the set-network call and its own read-back end, is used for at most ' +
        `${String(CAMERA_NETWORK_SET_MAX_AUTHENTICATED_READS)} authenticated reads and the one set call, and is never written to a log line, an audit row, an error, a file, an argument or the environment, never tried from a list, never reused for another camera or a later job. The answer never echoes it. Adopting the camera afterwards (operation 96) asks for it again.`,
      `**The camera is identified by its hardware address, and the job is bound to the one the technician saw.** The body names \`scannedMac\`, the hardware address of the scan row; a scan row without one cannot be started. Before anything is sent with the credential the Core reads the MAC of \`fromAddress\` from the neighbour table (\`neighbourMac\`): when it is not \`scannedMac\` the job stops with \`${CameraNetworkJobFailure.MAC_MISMATCH}\` and the credential is not used. After authentication the camera states its own (\`authenticatedMac\`); all three must be equal or the job stops with \`${CameraNetworkJobFailure.MAC_MISMATCH}\` and nothing is set. A job on an address whose scan said \`deviceCount: ${FactoryCameraDeviceCount.NOT_KNOWN}\` runs on these checks alone, and its answer and its audit rows say so (\`deviceCount\`). After the change the Core waits at most ${String(CAMERA_NETWORK_SET_WAIT_MS / 1000)} s for the SAME MAC at the new address (\`confirmedMac\`). A camera that is already registered has its stored address changed by the same job, with one CAPTURE_DEVICE_ADDRESS_CHANGED row; nothing follows a camera in the background.`,
      DESTINATION + ' The new address must also lie inside the camera subnet and be neither the gateway\'s nor a registered camera\'s.',
      `Refusals before a job exists, each changing nothing: \`409 INVALID_STATE\` with \`details.reason\` \`${R.COMMISSIONING_NOT_CONFIGURED}\`, \`${R.COMMISSIONING_JOB_IN_PROGRESS}\` (one job at a time), \`${R.CAMERA_SCAN_TOO_OLD}\` (the last scan is older than ${String(CAMERA_NETWORK_SCAN_MAX_AGE_MS / 60_000)} minutes), \`${R.CAMERA_ADDRESS_CONFLICT}\` (the last scan found more than one device at \`fromAddress\`), \`${R.CAMERA_HARDWARE_ADDRESS_NOT_BOUND}\` (\`scannedMac\` is not the hardware address the last scan showed there, or it showed none), \`${R.CAMERA_NEW_ADDRESS_IN_USE}\` (something answers at the new address, or it is not known that nothing does: "free" needs ${String(CAMERA_NETWORK_FREE_ADDRESS_ATTEMPTS)} silent attempts),\`${R.CAMERA_NO_FREE_ADDRESS}\` or \`${R.HOST_ALIAS_FAILED}\`. The one lock-out guard of the connection test counts this operation too: \`429 RATE_LIMITED\` with \`details.reason: ${CaptureDiscoveryReason.CONNECTION_TEST_LOCKOUT_GUARD}\`, an envelope-level answer.`,
      'Writes one CAMERA_NETWORK_SET row when the change is requested (`phase: REQUESTED`) and one when it ends (`COMPLETED` or `FAILED`), each with the two addresses; the alias rows when a temporary address is added or removed. No row holds the credential or a text the camera sent.',
      WHERE,
      `${SIM_V2_NOTE} The simulator changes no camera: a body of the right form answers \`409 INVALID_STATE\` with \`details.reason: ${R.COMMISSIONING_NOT_AVAILABLE}\`, and the credential is dropped unread.`,
    ].join('\n\n'),
    source: SOURCE(106, 'the set-network job with its typed credential (C1, C7)'),
    requestBody: { schema: 'CameraNetworkSetRequest', required: true },
    responses: {
      202: { description: 'The job started. Read it with `getCameraNetworkJob`. The credential is never echoed.', schema: 'CameraNetworkJob', services: CORE_SERVER_ONLY },
      400: INVALID_JSON,
      401: NOT_SIGNED_IN,
      403: notPermitted(Permission.CAPTURE_COMMISSION, WEB_ONLY_REFUSED),
      409: refusedText(
        `${LOCKED_TEXT}, or no job can start (INVALID_STATE, \`details.reason\`: ${R.COMMISSIONING_NOT_AVAILABLE}, ${R.COMMISSIONING_HELPER_NOT_CONFIGURED}, ${R.COMMISSIONING_NOT_CONFIGURED}, ${R.COMMISSIONING_JOB_IN_PROGRESS}, ${R.CAMERA_SCAN_TOO_OLD}, ${R.CAMERA_ADDRESS_CONFLICT}, ${R.CAMERA_HARDWARE_ADDRESS_NOT_BOUND}, ${R.CAMERA_NEW_ADDRESS_IN_USE}, ${R.CAMERA_NO_FREE_ADDRESS} or ${R.HOST_ALIAS_FAILED}). Nothing is sent to the camera.`,
      ),
      422: BODY_422,
    },
    access: CAPTURE_COMMISSION_ACCESS,
    audit: { success: AuditType.CAMERA_NETWORK_SET, ...DENIED, also: [AuditType.HOST_ALIAS_ADDED, AuditType.HOST_ALIAS_REMOVED, AuditType.CAPTURE_DEVICE_ADDRESS_CHANGED] },
    services: CORE_SERVER_ONLY,
  },
  {
    operationId: 'getCameraNetworkJob',
    method: 'get',
    path: CAMERA_NETWORK_JOB_PATH,
    tag: CoreApiTag.DEVICE,
    mode: CoreApiMode.SIMULATED,
    summary: 'Set-network job',
    description: [
      'The state of a set-network job: where it is, the target address, the hardware address from the neighbour table, the one the camera stated after authentication and the one that answered at the new address, and the code of its failure. It never holds the credential or a text the camera sent.',
      WHO + ' It can be read while a session is open.',
      'A job is data of the operator session that started it and lives in the Core\'s memory: an id that is unknown, of another session, or of a Core that restarted answers `404 NOT_FOUND` (one answer for all three).',
      `${SIM_V2_NOTE} The simulator starts no job, so every id answers \`404\`.`,
    ].join('\n\n'),
    source: SOURCE(107, 'the state of a set-network job'),
    pathParam: JOB_PARAM,
    responses: {
      200: { description: 'The job.', schema: 'CameraNetworkJob', services: CORE_SERVER_ONLY },
      401: NOT_SIGNED_IN,
      403: notPermitted(Permission.CAPTURE_COMMISSION, WEB_ONLY_REFUSED),
      404: refusedText('The id is unknown, belongs to another session, or the Core restarted since (NOT_FOUND; one answer).'),
      422: { description: 'The path parameter does not match its form (INVALID_INPUT).', schema: 'ApiError', services: CORE_SERVER_ONLY },
    },
    access: CAPTURE_COMMISSION_ACCESS,
    audit: { success: CoreApiAuditNone.READ, ...DENIED },
    services: CORE_SERVER_ONLY,
  },
] as const satisfies readonly CoreApiRegistryOperation[];

// ═══════════════════════════════════════════════════════════════════════════════════════
// The simulator's fixed answers: synthetic, and they say so. The examples are these values.
// ═══════════════════════════════════════════════════════════════════════════════════════

/** The interface name of the simulator's configuration: no host has an interface of this name. */
export const SIM_CAPTURE_INTERFACE_NAME = 'simulated0';
/** The camera subnet of the simulator's configuration. */
export const SIM_CAMERA_SUBNET = '192.168.10.0/24';
/** The name of the one device the simulator's scan lists: what a client shows says by itself that this is no camera. */
export const SIM_FACTORY_CAMERA_NAME = 'Test camera at a factory address (simulated)';
/** Its hardware address: locally administered, of no maker. */
export const SIM_FACTORY_CAMERA_MAC = '02:00:00:00:00:01';

/** The simulator's configuration: fixed, never written. It reads no host. */
export function simCaptureNetworkConfig(): CaptureNetworkConfig {
  return {
    configured: true,
    interfaceName: SIM_CAPTURE_INTERFACE_NAME,
    cameraSubnet: SIM_CAMERA_SUBNET,
    factoryAddresses: [...CAPTURE_NETWORK_CONFIG_DEFAULTS.factoryAddresses],
    aliasHost: CAPTURE_NETWORK_CONFIG_DEFAULTS.aliasHost,
    aliasMinutes: CAPTURE_NETWORK_CONFIG_DEFAULTS.aliasMinutes,
    cameraIpStart: CAPTURE_NETWORK_CONFIG_DEFAULTS.cameraIpStart,
    onvifPorts: [...CAPTURE_NETWORK_CONFIG_DEFAULTS.onvifPorts],
    revision: 1,
    updatedAt: null,
    updatedBy: null,
  };
}

/**
 * The simulator's scan at `at`: nothing was asked of any address. ONE synthetic device at the
 * typed address when one was sent, else at the first address of the fixed list; no temporary
 * address; `synthetic: true`.
 */
export function simCameraFactoryScan(at: number, typedAddress?: string): CameraFactoryScan {
  const stored = CAPTURE_NETWORK_CONFIG_DEFAULTS.factoryAddresses;
  return {
    scannedAt: at,
    addressCount: stored.length + (typedAddress === undefined ? 0 : 1),
    devices: [
      {
        address: typedAddress ?? stored[0],
        mac: SIM_FACTORY_CAMERA_MAC,
        onvifReachable: true,
        // As the Core's scan: nothing was counted, so the count is NOT KNOWN (never "one").
        endpointCount: null,
        deviceCount: FactoryCameraDeviceCount.NOT_KNOWN,
        vendor: 'DEMS',
        model: 'Test source',
        name: SIM_FACTORY_CAMERA_NAME,
        registeredDeviceId: null,
      },
    ],
    alias: null,
    synthetic: true,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════════════
// Examples
// ═══════════════════════════════════════════════════════════════════════════════════════

const SIGNED_OUT = { notSignedIn: ERROR_EXAMPLES.notSignedIn } as const;
const refusal = (summary: string, code: string, message: string, details?: Record<string, string>) => ({ summary, value: apiErrorExample(code, message, details) });
const reasoned = (summary: string, reason: CaptureCommissioningReason, details: Record<string, string> = {}) =>
  refusal(summary, reason === R.COMMISSIONING_ADDRESS_NOT_ALLOWED || reason === R.NETWORK_CONFIG_NOT_ALLOWED ? 'INVALID_INPUT' : 'INVALID_STATE', CAPTURE_COMMISSIONING_REFUSAL_SENTENCES[reason], {
    ...(reason === R.COMMISSIONING_ADDRESS_NOT_ALLOWED || reason === R.NETWORK_CONFIG_NOT_ALLOWED ? { in: 'body' } : {}),
    reason,
    ...details,
  });
const LOCKED = refusal('A session is open', 'CAPTURE_CONFIG_LOCKED', 'The capture configuration cannot be changed while a session is open.', { simCode: 'CAPTURE_CONFIG_LOCKED' });
const NOT_AVAILABLE = reasoned('Not a production Core on its Linux host (the simulator\'s answer)', R.COMMISSIONING_NOT_AVAILABLE);
const NOT_CONFIGURED = reasoned('No camera interface or subnet is chosen', R.COMMISSIONING_NOT_CONFIGURED);
const IN_PROGRESS = reasoned('A scan or a set-network job is running', R.COMMISSIONING_JOB_IN_PROGRESS);
const ADDRESS_NOT_ALLOWED = reasoned('The destination rule refuses an address', R.COMMISSIONING_ADDRESS_NOT_ALLOWED);
/** `403` of every commissioning operation: a SUPERVISOR does not hold the permission; a TECHNICIAN on a tablet does. */
const denied = (operationId: string) => ({
  ...deniedExamples(operationId, Permission.CAPTURE_COMMISSION, 'SUPERVISOR'),
  webConsoleOnly: {
    summary: 'A tablet or phone session on a web-console-only operation',
    description: 'The caller holds CAPTURE_COMMISSION, but the session is bound to a paired device. One ACCESS_DENIED row is written; the body is not used.',
    value: apiErrorExample('NOT_PERMITTED', 'Your role does not allow this action. The attempt was audited.', {
      operationId,
      permission: Permission.CAPTURE_COMMISSION,
      role: 'TECHNICIAN',
      reason: WEB_CONSOLE_ONLY_REASON,
    }),
  },
});

const EXAMPLE_ALIAS = {
  aliasId: '00000000-0000-4000-8000-0000000000a1',
  address: '192.168.1.253',
  reason: HostAliasReason.FACTORY_SCAN,
  addedAt: EXAMPLE_INSTANT_MS,
  expiresAt: EXAMPLE_INSTANT_MS + 30 * 60_000,
  removeError: null,
} as const satisfies HostAlias;
const EXAMPLE_CONFIG = {
  configured: true,
  interfaceName: 'enp3s0',
  cameraSubnet: '192.168.10.0/24',
  factoryAddresses: [...CAPTURE_NETWORK_CONFIG_DEFAULTS.factoryAddresses],
  aliasHost: 253,
  aliasMinutes: 30,
  cameraIpStart: 101,
  onvifPorts: [80, 8080],
  revision: 2,
  updatedAt: EXAMPLE_INSTANT_MS,
  updatedBy: 'OPR-003',
} satisfies CaptureNetworkConfig;
/** Placeholders only: an example never carries anything that reads like a real credential (E-30). */
const EXAMPLE_CREDENTIAL = { username: 'USERNAME', secret: 'SECRET' } as const satisfies CaptureCredentialWriteRequest;
const EXAMPLE_JOB_ID = 'CNJ-000001';
const EXAMPLE_JOB_RUNNING = {
  jobId: EXAMPLE_JOB_ID,
  state: CameraNetworkJobState.RUNNING,
  step: CameraNetworkJobStep.REACHING,
  fromAddress: '192.168.1.64',
  toAddress: '192.168.10.101',
  scannedMac: 'AA:BB:CC:00:11:22',
  deviceCount: FactoryCameraDeviceCount.NOT_KNOWN,
  neighbourMac: null,
  authenticatedMac: null,
  confirmedMac: null,
  deviceId: null,
  failure: null,
  startedAt: EXAMPLE_INSTANT_MS,
  endedAt: null,
} satisfies CameraNetworkJob;
const EXAMPLE_MAC = EXAMPLE_JOB_RUNNING.scannedMac;

export const CAPTURE_COMMISSIONING_EXAMPLES: Readonly<Record<string, OperationExamples>> = {
  getCaptureNetworkConfig: {
    responses: {
      200: {
        simulated: { summary: 'The simulator\'s fixed configuration: its interface is named as simulated', value: simCaptureNetworkConfig() },
        notConfigured: {
          summary: 'A Core nobody has configured yet: the defaults, no interface, no subnet',
          value: { ...simCaptureNetworkConfig(), configured: false, interfaceName: null, cameraSubnet: null } satisfies CaptureNetworkConfig,
        },
        configured: { summary: 'A configured Core', value: EXAMPLE_CONFIG },
      },
      401: SIGNED_OUT,
      403: denied('getCaptureNetworkConfig'),
    },
  },
  updateCaptureNetworkConfig: {
    request: {
      choose: { summary: 'Choose the camera interface and the camera subnet', value: { revision: 1, interfaceName: 'enp3s0', cameraSubnet: '192.168.10.0/24' } satisfies CaptureNetworkConfigUpdateRequest },
      factoryList: { summary: 'Replace the factory address list', value: { revision: 2, factoryAddresses: ['192.168.1.64', '192.168.1.108'] } satisfies CaptureNetworkConfigUpdateRequest },
      onvifPorts: { summary: 'Replace the list of allowed ONVIF ports', value: { revision: 2, onvifPorts: [80, 8080] } satisfies CaptureNetworkConfigUpdateRequest },
    },
    responses: {
      200: { changed: { summary: 'The configuration after the change', description: 'Only the Core server answers this: the in-app simulator stores nothing.', value: EXAMPLE_CONFIG } },
      400: { invalidJson: ERROR_EXAMPLES.invalidJson },
      401: SIGNED_OUT,
      403: denied('updateCaptureNetworkConfig'),
      409: {
        locked: LOCKED,
        notAvailable: NOT_AVAILABLE,
        revisionConflict: refusal('The revision of the body is stale', 'INVALID_STATE', 'The configuration changed. Read it again.', { reason: STT_REVISION_CONFLICT_REASON }),
      },
      422: { invalidInput: ERROR_EXAMPLES.invalidInput, notAllowed: reasoned('The settings are refused as a whole', R.NETWORK_CONFIG_NOT_ALLOWED) },
    },
  },
  scanFactoryCameras: {
    request: {
      storedList: { summary: 'The stored factory addresses only', value: {} satisfies CameraFactoryScanRequest },
      typed: { summary: 'The stored list and one typed address', value: { address: '192.168.1.200' } satisfies CameraFactoryScanRequest },
    },
    responses: {
      200: {
        simulated: { summary: 'The simulator\'s synthetic answer: one test device, nothing scanned', value: simCameraFactoryScan(EXAMPLE_INSTANT_MS) },
        found: {
          summary: 'One camera at a factory address, reached through a temporary address',
          value: {
            scannedAt: EXAMPLE_INSTANT_MS,
            addressCount: 4,
            devices: [{ address: '192.168.1.64', mac: EXAMPLE_MAC, onvifReachable: true, endpointCount: null, deviceCount: FactoryCameraDeviceCount.NOT_KNOWN, vendor: 'Example vendor', model: 'Example camera', name: null, registeredDeviceId: null }],
            alias: EXAMPLE_ALIAS,
            synthetic: false,
          } satisfies CameraFactoryScan,
        },
      },
      400: { invalidJson: ERROR_EXAMPLES.invalidJson },
      401: SIGNED_OUT,
      403: denied('scanFactoryCameras'),
      409: {
        locked: LOCKED,
        notConfigured: NOT_CONFIGURED,
        inProgress: IN_PROGRESS,
        aliasFailed: reasoned('The helper refused the temporary address', R.HOST_ALIAS_FAILED, { cause: 'ADDRESS_IN_USE' }),
      },
      422: { invalidInput: ERROR_EXAMPLES.invalidInput, addressNotAllowed: ADDRESS_NOT_ALLOWED },
    },
  },
  getHostAlias: {
    responses: {
      200: {
        none: { summary: 'No temporary address is in place (the simulator\'s answer)', value: { alias: null } satisfies HostAliasState },
        inPlace: { summary: 'A temporary address added for a scan', value: { alias: EXAMPLE_ALIAS } satisfies HostAliasState },
      },
      401: SIGNED_OUT,
      403: denied('getHostAlias'),
    },
  },
  removeHostAlias: {
    responses: {
      200: { removed: { summary: 'The address is removed', description: 'Only the Core server answers this: the in-app simulator never holds a temporary address.', value: { alias: null } satisfies HostAliasState } },
      401: SIGNED_OUT,
      403: denied('removeHostAlias'),
      409: {
        locked: LOCKED,
        notPresent: reasoned('No temporary address is in place (the simulator\'s answer)', R.HOST_ALIAS_NOT_PRESENT),
        inProgress: IN_PROGRESS,
        removeFailed: reasoned('The helper failed to remove the address', R.HOST_ALIAS_REMOVE_FAILED, { cause: 'HELPER_FAILED' }),
      },
    },
  },
  setCameraNetwork: {
    request: {
      nextFree: { summary: 'The next free address of the camera subnet', value: { fromAddress: '192.168.1.64', scannedMac: EXAMPLE_MAC, credential: EXAMPLE_CREDENTIAL } satisfies CameraNetworkSetRequest },
      typed: { summary: 'A typed address and a gateway', value: { fromAddress: '192.168.1.64', scannedMac: EXAMPLE_MAC, toAddress: '192.168.10.101', gateway: '192.168.10.1', credential: EXAMPLE_CREDENTIAL } satisfies CameraNetworkSetRequest },
    },
    responses: {
      202: { started: { summary: 'The job started', description: 'Only the Core server answers this: the in-app simulator changes no camera.', value: EXAMPLE_JOB_RUNNING } },
      400: { invalidJson: ERROR_EXAMPLES.invalidJson },
      401: SIGNED_OUT,
      403: denied('setCameraNetwork'),
      409: {
        locked: LOCKED,
        notAvailable: NOT_AVAILABLE,
        notConfigured: NOT_CONFIGURED,
        inProgress: IN_PROGRESS,
        addressConflict: reasoned('More than one device answers at the present address', R.CAMERA_ADDRESS_CONFLICT),
        scanTooOld: reasoned('The last scan is too old', R.CAMERA_SCAN_TOO_OLD),
        hardwareAddressNotBound: reasoned('The hardware address of the body is not the one the last scan showed', R.CAMERA_HARDWARE_ADDRESS_NOT_BOUND),
        newAddressInUse: reasoned('Something answers at the new address', R.CAMERA_NEW_ADDRESS_IN_USE),
        noFreeAddress: reasoned('The camera subnet has no free address left', R.CAMERA_NO_FREE_ADDRESS),
      },
      422: { invalidInput: ERROR_EXAMPLES.invalidInput, addressNotAllowed: ADDRESS_NOT_ALLOWED },
    },
  },
  getCameraNetworkJob: {
    pathParams: { id: EXAMPLE_JOB_ID },
    responses: {
      200: {
        waiting: {
          summary: 'Waiting for the same MAC at the new address',
          value: { ...EXAMPLE_JOB_RUNNING, step: CameraNetworkJobStep.WAITING, neighbourMac: EXAMPLE_MAC, authenticatedMac: EXAMPLE_MAC } satisfies CameraNetworkJob,
        },
        completed: {
          summary: 'The camera answers at its new address',
          value: {
            ...EXAMPLE_JOB_RUNNING,
            state: CameraNetworkJobState.COMPLETED,
            step: CameraNetworkJobStep.DONE,
            neighbourMac: EXAMPLE_MAC,
            authenticatedMac: EXAMPLE_MAC,
            confirmedMac: EXAMPLE_MAC,
            endedAt: EXAMPLE_INSTANT_MS + 42_000,
          } satisfies CameraNetworkJob,
        },
        macMismatch: {
          summary: 'The camera stated another hardware address: stopped before anything was set',
          value: {
            ...EXAMPLE_JOB_RUNNING,
            state: CameraNetworkJobState.FAILED,
            step: CameraNetworkJobStep.DONE,
            neighbourMac: EXAMPLE_MAC,
            authenticatedMac: 'AA:BB:CC:00:11:99',
            failure: CameraNetworkJobFailure.MAC_MISMATCH,
            endedAt: EXAMPLE_INSTANT_MS + 3_000,
          } satisfies CameraNetworkJob,
        },
      },
      401: SIGNED_OUT,
      403: denied('getCameraNetworkJob'),
      404: { notFound: refusal('No such job in this session (the simulator\'s answer to every id)', 'NOT_FOUND', 'No job has this ID.', { simCode: 'NOT_FOUND' }) },
      422: { invalidPathParameter: ERROR_EXAMPLES.invalidPathParameter },
    },
  },
};
