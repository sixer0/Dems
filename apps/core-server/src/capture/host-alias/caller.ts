/**
 * The Core's ONE caller of the address helper (task 4 row 105, WP-19b; decision C19; security items
 * S13-08, S13-09, S13-10 (c); design rule DR-4; review finding F-07).
 *
 * What a call is: one request line to the root service behind its local socket, one answer line
 * back. This file decides WHETHER a line is sent and WHAT the answer means; it sends nothing
 * itself. The connection is a transport it is HANDED (`HostAliasTransport`): the platform's, made
 * outside the capture area (`src/host-alias-socket.ts`), so the kept rule "no socket module under
 * `capture/`" (G-R2, G-R10) stands unamended. The file imports types and the protocol file: no
 * socket, no file system, no process, no timer, no clock; it logs nothing.
 *
 * ORDER OF AN `add` (each step refuses by a fixed word and stops; nothing after it runs):
 *   1. the minutes: an integer 5 to 480;
 *   2. the address: one strict dotted quad, RFC 1918, host part 1 to 254 (the helper's bound 2);
 *   3. one call in flight at a time (the socket admits one connection);
 *   4. the host's facts, read through the reader handed in;
 *   5. the interface file against the stored row (F-07): no stored interface is "not configured",
 *      a file that names another interface is `INTERFACE_FILE_DIFFERS_FROM_ROW`;
 *   6. the wrong-network guard (DR-4): no interface other than the camera interface holds an
 *      address in the target /24; the host does not hold the address already;
 *   7. the transport's own check before dialling (platform, configured, the socket node);
 *   8. THE INTENT ENTRY (S13-10 (c)). If it cannot be written, nothing is sent;
 *   9. the one line; the answer under the transport's bound;
 *  10. THE RESULT ENTRY, for every way step 9 can end: a pair of the table, a time-out, a closed
 *      connection, an answer that is not of the table.
 * A `remove` runs steps 2, 3, 7 to 10: taking an address away is never held back by the state of
 * the host or by a disagreement of file and row (the helper removes only what it marked itself).
 *
 * So per action that reaches the helper: exactly 1 intent and 1 result entry; per action refused
 * before step 8: 0 entries and 0 lines sent. A Core that dies between 8 and 10 leaves the intent.
 *
 * WHAT LEAVES: words of closed sets, the helper's number, and the address rebuilt from its four
 * numbers. No text of an answer, no interface name, no path. An answer that is not exactly a pair
 * of the table is dropped and reported as `HELPER_ANSWER_NOT_UNDERSTOOD`.
 */
import type { CameraInterfaceAddress, DestinationSubnet } from '../destination-rule';
import {
  AliasAddressProblem,
  HELPER_CODES,
  HostAliasAction,
  addRequestLine,
  aliasMinutesOf,
  aliasQuadOf,
  delRequestLine,
  dottedOf,
  helperAnswerOf,
  quadOf,
  type AliasQuad,
  type HelperCodeName,
} from './protocol';

// ── The transport, as this file needs it ───────────────────────────────────────────────────────

/** Why no answer of the helper was read. The platform's transport answers with one of these words and nothing else. */
export const HostAliasTransportFailure = {
  /** The real helper does not exist on this platform (anything but Linux). */
  NOT_AVAILABLE_ON_THIS_PLATFORM: 'NOT_AVAILABLE_ON_THIS_PLATFORM',
  /** No socket path is configured. */
  NOT_CONFIGURED: 'NOT_CONFIGURED',
  /** The socket path is not a plain absolute path. */
  SOCKET_PATH_UNSAFE: 'SOCKET_PATH_UNSAFE',
  /** Nothing is at the path. */
  SOCKET_ABSENT: 'SOCKET_ABSENT',
  /** Something is at the path and it is not a socket (a link included). */
  SOCKET_NOT_A_SOCKET: 'SOCKET_NOT_A_SOCKET',
  /** The node is not owned by the trusted owner, or its mode is not 0660. */
  SOCKET_OWNER_OR_MODE: 'SOCKET_OWNER_OR_MODE',
  /** The folder of the node is not the trusted owner's, or group or others may write to it. */
  SOCKET_DIRECTORY_UNSAFE: 'SOCKET_DIRECTORY_UNSAFE',
  /** The line handed over is not a request of the helper's grammar: nothing was sent. */
  REQUEST_NOT_A_LINE: 'REQUEST_NOT_A_LINE',
  /** Nobody listens on the socket. */
  CONNECT_REFUSED: 'CONNECT_REFUSED',
  /** The Core's user may not connect (it is not in the helper's group). */
  CONNECT_NOT_PERMITTED: 'CONNECT_NOT_PERMITTED',
  /** The connection was not made, for another reason. */
  CONNECT_FAILED: 'CONNECT_FAILED',
  /** No complete answer inside the bound. */
  TIMED_OUT: 'TIMED_OUT',
  /** The helper closed the connection without an answer, or the connection broke. */
  CONNECTION_LOST: 'CONNECTION_LOST',
  /** More bytes than an answer has. */
  ANSWER_TOO_LONG: 'ANSWER_TOO_LONG',
} as const;
export type HostAliasTransportFailure = (typeof HostAliasTransportFailure)[keyof typeof HostAliasTransportFailure];

export type HostAliasExchange = { readonly kind: 'ANSWER'; readonly text: string } | { readonly kind: 'FAILED'; readonly failure: HostAliasTransportFailure };

/** One request, one answer. `preflight` dials nothing; `exchange` sends the one line and reads under its own bound. */
export interface HostAliasTransport {
  preflight(): Promise<HostAliasTransportFailure | null>;
  exchange(requestLine: string): Promise<HostAliasExchange>;
}

// ── The refusals of the Core ───────────────────────────────────────────────────────────────────

/** A refusal the helper answered: the helper's name behind `HELPER_`. One Core name per helper code. */
export type HostAliasHelperRefusal = `HELPER_${Exclude<HelperCodeName, 'OK'>}`;

/** Refusals the Core finds itself, before a line is sent or instead of an answer. */
export const HostAliasCoreRefusal = {
  // before the call: the request
  MINUTES_OUT_OF_RANGE: 'MINUTES_OUT_OF_RANGE',
  ADDRESS_MALFORMED: 'ADDRESS_MALFORMED',
  ADDRESS_NOT_PRIVATE: 'ADDRESS_NOT_PRIVATE',
  HOST_PART_OUT_OF_RANGE: 'HOST_PART_OUT_OF_RANGE',
  CALL_IN_PROGRESS: 'CALL_IN_PROGRESS',
  // before the call: the host
  HOST_FACTS_UNREADABLE: 'HOST_FACTS_UNREADABLE',
  NETWORK_NOT_CONFIGURED: 'NETWORK_NOT_CONFIGURED',
  INTERFACE_ROW_UNREADABLE: 'INTERFACE_ROW_UNREADABLE',
  INTERFACE_FILE_UNREADABLE: 'INTERFACE_FILE_UNREADABLE',
  INTERFACE_FILE_DIFFERS_FROM_ROW: 'INTERFACE_FILE_DIFFERS_FROM_ROW',
  OTHER_INTERFACE_HOLDS_SUBNET: 'OTHER_INTERFACE_HOLDS_SUBNET',
  CAMERA_INTERFACE_HOLDS_SUBNET: 'CAMERA_INTERFACE_HOLDS_SUBNET',
  HOST_HOLDS_ADDRESS: 'HOST_HOLDS_ADDRESS',
  // before the call: the helper cannot be reached
  NOT_AVAILABLE_ON_THIS_PLATFORM: 'NOT_AVAILABLE_ON_THIS_PLATFORM',
  HELPER_NOT_CONFIGURED: 'HELPER_NOT_CONFIGURED',
  HELPER_NOT_INSTALLED: 'HELPER_NOT_INSTALLED',
  HELPER_SOCKET_UNSAFE: 'HELPER_SOCKET_UNSAFE',
  HELPER_NOT_PERMITTED: 'HELPER_NOT_PERMITTED',
  HELPER_UNREACHABLE: 'HELPER_UNREACHABLE',
  INTENT_NOT_RECORDED: 'INTENT_NOT_RECORDED',
  // instead of an answer
  HELPER_TIMED_OUT: 'HELPER_TIMED_OUT',
  HELPER_CONNECTION_LOST: 'HELPER_CONNECTION_LOST',
  HELPER_ANSWER_TOO_LONG: 'HELPER_ANSWER_TOO_LONG',
  HELPER_ANSWER_NOT_UNDERSTOOD: 'HELPER_ANSWER_NOT_UNDERSTOOD',
  CALLER_DEFECT: 'CALLER_DEFECT',
} as const;
export type HostAliasCoreRefusal = (typeof HostAliasCoreRefusal)[keyof typeof HostAliasCoreRefusal];

export type HostAliasRefusal = HostAliasCoreRefusal | HostAliasHelperRefusal;

/** What a helper refusal is about: who has to act on it. */
export const HostAliasRefusalKind = {
  /** The helper refused the line the Core built: a defect of the Core, never of the operator. */
  REQUEST: 'REQUEST',
  /** What the user installed is not as the procedure states. */
  INSTALLATION: 'INSTALLATION',
  /** The state of the host or of the camera network at this moment. */
  HOST_STATE: 'HOST_STATE',
  /** A tool of the helper did not do its work. */
  TOOL: 'TOOL',
} as const;
export type HostAliasRefusalKind = (typeof HostAliasRefusalKind)[keyof typeof HostAliasRefusalKind];

/** Every refusal of the helper with its kind: the whole table but `OK`, 40 entries. */
export const HELPER_REFUSAL_KINDS: Readonly<Record<Exclude<HelperCodeName, 'OK'>, HostAliasRefusalKind>> = Object.freeze({
  ARGUMENTS: HostAliasRefusalKind.REQUEST,
  PEER_UNKNOWN: HostAliasRefusalKind.INSTALLATION,
  PEER_NOT_SERVICE_USER: HostAliasRefusalKind.INSTALLATION,
  REQUEST_TOO_LONG: HostAliasRefusalKind.REQUEST,
  REQUEST_MALFORMED: HostAliasRefusalKind.REQUEST,
  VERB_UNKNOWN: HostAliasRefusalKind.REQUEST,
  REQUEST_TIMEOUT: HostAliasRefusalKind.REQUEST,
  ADDRESS_MALFORMED: HostAliasRefusalKind.REQUEST,
  PREFIX_NOT_24: HostAliasRefusalKind.REQUEST,
  ADDRESS_LOOPBACK: HostAliasRefusalKind.REQUEST,
  ADDRESS_LINK_LOCAL: HostAliasRefusalKind.REQUEST,
  ADDRESS_MULTICAST: HostAliasRefusalKind.REQUEST,
  ADDRESS_NOT_PRIVATE: HostAliasRefusalKind.REQUEST,
  HOST_PART_OUT_OF_RANGE: HostAliasRefusalKind.REQUEST,
  LIFETIME_OUT_OF_RANGE: HostAliasRefusalKind.REQUEST,
  SERVICE_USER_UNRESOLVED: HostAliasRefusalKind.INSTALLATION,
  INTERFACE_FILE_UNSAFE: HostAliasRefusalKind.INSTALLATION,
  INTERFACE_NAME_INVALID: HostAliasRefusalKind.INSTALLATION,
  INTERFACE_ABSENT: HostAliasRefusalKind.INSTALLATION,
  INTERFACE_HAS_DEFAULT_ROUTE: HostAliasRefusalKind.INSTALLATION,
  STATE_DIR_UNSAFE: HostAliasRefusalKind.INSTALLATION,
  TOOL_MISSING: HostAliasRefusalKind.INSTALLATION,
  CONFLICT_TOOL_MISSING: HostAliasRefusalKind.INSTALLATION,
  // The conflict-check program at the path is not the one of the package the procedure installs.
  CONFLICT_TOOL_NOT_EXPECTED: HostAliasRefusalKind.INSTALLATION,
  OTHER_INTERFACE_HOLDS_SUBNET: HostAliasRefusalKind.HOST_STATE,
  ALIAS_LIMIT_REACHED: HostAliasRefusalKind.HOST_STATE,
  ADDRESS_ALREADY_PRESENT: HostAliasRefusalKind.HOST_STATE,
  CAMERA_INTERFACE_HOLDS_SUBNET: HostAliasRefusalKind.HOST_STATE,
  ADDRESS_IN_USE: HostAliasRefusalKind.HOST_STATE,
  NOT_MARKED: HostAliasRefusalKind.HOST_STATE,
  // The camera port cannot carry the conflict question now (no ARP, down or no carrier, flags not readable): nothing was asked, nothing added.
  INTERFACE_NOT_ARPABLE: HostAliasRefusalKind.HOST_STATE,
  INTERFACE_DOWN: HostAliasRefusalKind.HOST_STATE,
  INTERFACE_STATE_UNKNOWN: HostAliasRefusalKind.HOST_STATE,
  HOST_STATE_UNREADABLE: HostAliasRefusalKind.TOOL,
  CONFLICT_CHECK_FAILED: HostAliasRefusalKind.TOOL,
  ADD_FAILED: HostAliasRefusalKind.TOOL,
  DEL_FAILED: HostAliasRefusalKind.TOOL,
  MARK_WRITE_FAILED: HostAliasRefusalKind.TOOL,
  // The conflict check ended 0 or 1 without the printed statement that goes with it: not a result, nothing added.
  CONFLICT_RESULT_UNKNOWN: HostAliasRefusalKind.TOOL,
  INTERNAL: HostAliasRefusalKind.TOOL,
});

/** The Core's name of a helper refusal. */
export function helperRefusalOf(name: Exclude<HelperCodeName, 'OK'>): HostAliasHelperRefusal {
  return `HELPER_${name}`;
}

/**
 * What an outcome says about the address:
 *   DONE      the act took effect (`add`: the address is in place and marked; `remove`: it is gone);
 *   NOT_DONE  nothing was changed, for certain;
 *   UNKNOWN   the helper may or may not have acted (no answer was read, or a tool of the helper
 *             did not answer). The caller of this file treats the address as possibly in place.
 */
export const HostAliasEffect = {
  DONE: 'DONE',
  NOT_DONE: 'NOT_DONE',
  UNKNOWN: 'UNKNOWN',
} as const;
export type HostAliasEffect = (typeof HostAliasEffect)[keyof typeof HostAliasEffect];

/** The helper refusals after which the address may be in place although the helper said "no" (record 104, decision D-12). */
const HELPER_EFFECT_UNKNOWN: ReadonlySet<HelperCodeName> = new Set<HelperCodeName>(['ADD_FAILED', 'DEL_FAILED', 'INTERNAL']);

export interface HostAliasOutcome {
  readonly action: HostAliasAction;
  /** null: the helper answered `0 OK`. */
  readonly refusal: HostAliasRefusal | null;
  readonly effect: HostAliasEffect;
  /** The address as the request line carried it, `a.b.c.d/24` rebuilt from its numbers; null when the value was no such address. */
  readonly address: string | null;
  /** True from the intent entry on: exactly then one intent entry exists for this action. */
  readonly attempted: boolean;
  /** The helper's number, when the helper answered with a pair of its table. */
  readonly helperCode: number | null;
  /** False only when the action was attempted and its result entry could not be written: the intent stands alone. */
  readonly resultRecorded: boolean;
}

// ── The host's facts ───────────────────────────────────────────────────────────────────────────

/**
 * What an `add` is judged on. Read by the reader handed in, at the moment of the call; nothing here
 * comes from the request. The three network members are those of the destination rule's context,
 * so one reading of the host serves both.
 */
export interface HostAliasFacts {
  /** `capture_network_config.interface_name`: a name, or null when no interface was chosen. */
  readonly storedInterface: unknown;
  /** The one name the helper's interface file holds, or null when the file cannot be read as one name. */
  readonly fileInterface: unknown;
  /** The configured camera subnet, or null. */
  readonly cameraSubnet: DestinationSubnet | null;
  /** The addresses the camera interface holds now. */
  readonly cameraAddresses: readonly CameraInterfaceAddress[];
  /** The subnets of every OTHER interface of the host (DR-4). */
  readonly otherInterfaceSubnets: readonly DestinationSubnet[];
  /** Every IPv4 address the host holds, on any interface. */
  readonly hostAddresses: readonly string[];
}

/** The helper's own pattern of an interface name, and the CHECK of the stored column. */
const INTERFACE_NAME = /^[A-Za-z0-9][A-Za-z0-9_.-]{0,14}$/;

type AgreementRefusal = 'NETWORK_NOT_CONFIGURED' | 'INTERFACE_ROW_UNREADABLE' | 'INTERFACE_FILE_UNREADABLE' | 'INTERFACE_FILE_DIFFERS_FROM_ROW';

/** F-07: the interface file against the stored row. The two names are compared and dropped. */
export function interfaceAgreementRefusal(storedInterface: unknown, fileInterface: unknown): AgreementRefusal | null {
  if (storedInterface === null || storedInterface === undefined) return HostAliasCoreRefusal.NETWORK_NOT_CONFIGURED;
  if (typeof storedInterface !== 'string' || !INTERFACE_NAME.test(storedInterface)) return HostAliasCoreRefusal.INTERFACE_ROW_UNREADABLE;
  if (typeof fileInterface !== 'string' || !INTERFACE_NAME.test(fileInterface)) return HostAliasCoreRefusal.INTERFACE_FILE_UNREADABLE;
  return fileInterface === storedInterface ? null : HostAliasCoreRefusal.INTERFACE_FILE_DIFFERS_FROM_ROW;
}

const asNumber = (quad: AliasQuad): number => ((quad[0] << 24) | (quad[1] << 16) | (quad[2] << 8) | quad[3]) >>> 0;

/** The helper's own overlap test: the /24 of the address against a subnet, under the shorter of the two prefixes. */
function overlapsSlash24(target: AliasQuad, network: AliasQuad, prefixLength: number): boolean {
  const length = Math.min(prefixLength, 24);
  const mask = length === 0 ? 0 : (0xffffffff << (32 - length)) >>> 0;
  return ((asNumber(target) & mask) >>> 0) === ((asNumber(network) & mask) >>> 0);
}

type GuardRefusal = 'HOST_FACTS_UNREADABLE' | 'OTHER_INTERFACE_HOLDS_SUBNET' | 'CAMERA_INTERFACE_HOLDS_SUBNET' | 'HOST_HOLDS_ADDRESS';

function subnetOf(subnet: unknown): { readonly network: AliasQuad; readonly prefixLength: number } | null {
  if (typeof subnet !== 'object' || subnet === null) return null;
  const { network, prefixLength } = subnet as { network?: unknown; prefixLength?: unknown };
  const quad = quadOf(network);
  if (quad === null || typeof prefixLength !== 'number' || !Number.isInteger(prefixLength) || prefixLength < 0 || prefixLength > 32) return null;
  return { network: quad, prefixLength };
}

/**
 * DR-4, the wrong-network guard, and its two neighbours. A fact that cannot be read refuses: the
 * guard never answers "free" for a host it could not see.
 */
export function wrongNetworkRefusal(target: AliasQuad, facts: Pick<HostAliasFacts, 'cameraSubnet' | 'cameraAddresses' | 'otherInterfaceSubnets' | 'hostAddresses'>): GuardRefusal | null {
  if (!Array.isArray(facts.otherInterfaceSubnets) || !Array.isArray(facts.hostAddresses) || !Array.isArray(facts.cameraAddresses)) return HostAliasCoreRefusal.HOST_FACTS_UNREADABLE;
  const others = facts.otherInterfaceSubnets.map(subnetOf);
  const held = [...facts.hostAddresses, ...facts.cameraAddresses.map((entry: unknown) => (typeof entry === 'object' && entry !== null ? (entry as { address?: unknown }).address : undefined))].map(quadOf);
  const camera = facts.cameraSubnet === null ? null : subnetOf(facts.cameraSubnet);
  if (others.includes(null) || held.includes(null) || (facts.cameraSubnet !== null && camera === null)) return HostAliasCoreRefusal.HOST_FACTS_UNREADABLE;
  if (others.some((subnet) => subnet !== null && overlapsSlash24(target, subnet.network, subnet.prefixLength))) return HostAliasCoreRefusal.OTHER_INTERFACE_HOLDS_SUBNET;
  if (held.some((quad) => quad !== null && asNumber(quad) === asNumber(target))) return HostAliasCoreRefusal.HOST_HOLDS_ADDRESS;
  if (camera !== null && overlapsSlash24(target, camera.network, camera.prefixLength)) return HostAliasCoreRefusal.CAMERA_INTERFACE_HOLDS_SUBNET;
  return null;
}

// ── The journal: intent before, result after ───────────────────────────────────────────────────

export interface HostAliasIntent<Subject> {
  readonly action: HostAliasAction;
  /** `a.b.c.d/24`, rebuilt from its numbers. */
  readonly address: string;
  /** The lifetime of an `add`; null for a `remove`. */
  readonly minutes: number | null;
  /** What the caller of this file hands through unread: who acts, why, for which job or row. */
  readonly subject: Subject;
}

export interface HostAliasResult<Subject, Token> extends HostAliasIntent<Subject> {
  /** What `intent` returned for this action. */
  readonly token: Token;
  readonly outcome: HostAliasOutcome;
}

/**
 * The two entries around a call (S13-10 (c)). `intent` is awaited BEFORE a line is sent; a journal
 * that cannot write it stops the action. `result` is awaited after, whatever the call gave.
 */
export interface HostAliasJournal<Subject, Token> {
  intent(entry: HostAliasIntent<Subject>): Promise<Token>;
  result(entry: HostAliasResult<Subject, Token>): Promise<void>;
}

// ── The caller ─────────────────────────────────────────────────────────────────────────────────

export interface HostAliasCallerDeps<Subject, Token> {
  readonly transport: HostAliasTransport;
  readonly journal: HostAliasJournal<Subject, Token>;
  /** Reads the host's facts for one `add`. A reader that throws is a host that cannot be seen. */
  readonly facts: () => Promise<HostAliasFacts>;
}

export interface HostAliasAddRequest<Subject> {
  /** The temporary address, as stored or as derived: anything. Only one strict private dotted quad passes. */
  readonly address: unknown;
  /** The lifetime in minutes: anything. Only an integer 5 to 480 passes. */
  readonly minutes: unknown;
  readonly subject: Subject;
}

export interface HostAliasRemoveRequest<Subject> {
  readonly address: unknown;
  readonly subject: Subject;
}

export interface HostAliasCaller<Subject> {
  add(request: HostAliasAddRequest<Subject>): Promise<HostAliasOutcome>;
  remove(request: HostAliasRemoveRequest<Subject>): Promise<HostAliasOutcome>;
}

const PREFLIGHT_REFUSALS: Readonly<Record<HostAliasTransportFailure, HostAliasCoreRefusal>> = Object.freeze({
  NOT_AVAILABLE_ON_THIS_PLATFORM: HostAliasCoreRefusal.NOT_AVAILABLE_ON_THIS_PLATFORM,
  NOT_CONFIGURED: HostAliasCoreRefusal.HELPER_NOT_CONFIGURED,
  SOCKET_PATH_UNSAFE: HostAliasCoreRefusal.HELPER_SOCKET_UNSAFE,
  SOCKET_ABSENT: HostAliasCoreRefusal.HELPER_NOT_INSTALLED,
  SOCKET_NOT_A_SOCKET: HostAliasCoreRefusal.HELPER_SOCKET_UNSAFE,
  SOCKET_OWNER_OR_MODE: HostAliasCoreRefusal.HELPER_SOCKET_UNSAFE,
  SOCKET_DIRECTORY_UNSAFE: HostAliasCoreRefusal.HELPER_SOCKET_UNSAFE,
  REQUEST_NOT_A_LINE: HostAliasCoreRefusal.CALLER_DEFECT,
  CONNECT_REFUSED: HostAliasCoreRefusal.HELPER_NOT_INSTALLED,
  CONNECT_NOT_PERMITTED: HostAliasCoreRefusal.HELPER_NOT_PERMITTED,
  CONNECT_FAILED: HostAliasCoreRefusal.HELPER_UNREACHABLE,
  TIMED_OUT: HostAliasCoreRefusal.HELPER_TIMED_OUT,
  CONNECTION_LOST: HostAliasCoreRefusal.HELPER_CONNECTION_LOST,
  ANSWER_TOO_LONG: HostAliasCoreRefusal.HELPER_ANSWER_TOO_LONG,
});

/** The transport failures after which a line may have reached the helper: the effect is not known. */
const TRANSPORT_EFFECT_UNKNOWN: ReadonlySet<HostAliasTransportFailure> = new Set<HostAliasTransportFailure>(['TIMED_OUT', 'CONNECTION_LOST', 'ANSWER_TOO_LONG']);

const isTransportFailure = (value: unknown): value is HostAliasTransportFailure => typeof value === 'string' && Object.prototype.hasOwnProperty.call(PREFLIGHT_REFUSALS, value);

interface Judged {
  readonly refusal: HostAliasRefusal | null;
  readonly effect: HostAliasEffect;
  readonly helperCode: number | null;
}

const ADDRESS_REFUSALS: Readonly<Record<AliasAddressProblem, HostAliasCoreRefusal>> = Object.freeze({
  ADDRESS_MALFORMED: HostAliasCoreRefusal.ADDRESS_MALFORMED,
  ADDRESS_NOT_PRIVATE: HostAliasCoreRefusal.ADDRESS_NOT_PRIVATE,
  HOST_PART_OUT_OF_RANGE: HostAliasCoreRefusal.HOST_PART_OUT_OF_RANGE,
});

/** What one exchange means. Total: every value a transport can hand back has one judgement. */
export function judgeExchange(exchange: unknown): Judged {
  const unknown = (refusal: HostAliasCoreRefusal): Judged => ({ refusal, effect: HostAliasEffect.UNKNOWN, helperCode: null });
  if (typeof exchange !== 'object' || exchange === null) return unknown(HostAliasCoreRefusal.CALLER_DEFECT);
  const { kind, failure, text } = exchange as { kind?: unknown; failure?: unknown; text?: unknown };
  if (kind === 'FAILED') {
    if (!isTransportFailure(failure)) return unknown(HostAliasCoreRefusal.CALLER_DEFECT);
    return { refusal: PREFLIGHT_REFUSALS[failure], effect: TRANSPORT_EFFECT_UNKNOWN.has(failure) ? HostAliasEffect.UNKNOWN : HostAliasEffect.NOT_DONE, helperCode: null };
  }
  if (kind !== 'ANSWER') return unknown(HostAliasCoreRefusal.CALLER_DEFECT);
  const name = helperAnswerOf(text);
  if (name === null) return unknown(HostAliasCoreRefusal.HELPER_ANSWER_NOT_UNDERSTOOD);
  if (name === 'OK') return { refusal: null, effect: HostAliasEffect.DONE, helperCode: HELPER_CODES.OK };
  return { refusal: helperRefusalOf(name), effect: HELPER_EFFECT_UNKNOWN.has(name) ? HostAliasEffect.UNKNOWN : HostAliasEffect.NOT_DONE, helperCode: HELPER_CODES[name] };
}

/**
 * The one caller. `Subject` is whatever the caller of this file wants written beside an entry (the
 * operator, the reason, the job); `Token` is whatever its journal returns for an intent (a row id).
 * This file reads neither.
 */
export function createHostAliasCaller<Subject, Token>(deps: HostAliasCallerDeps<Subject, Token>): HostAliasCaller<Subject> {
  let inFlight = false;

  const before = (action: HostAliasAction, refusal: HostAliasRefusal, address: string | null): HostAliasOutcome =>
    Object.freeze({ action, refusal, effect: HostAliasEffect.NOT_DONE, address, attempted: false, helperCode: null, resultRecorded: true });

  /** Steps 7 to 10. `inFlight` is already taken by the caller of this function. */
  async function call(action: HostAliasAction, quad: AliasQuad, minutes: number | null, subject: Subject): Promise<HostAliasOutcome> {
    const address = `${dottedOf(quad)}/24`;
    let ready: unknown;
    try {
      ready = await deps.transport.preflight();
    } catch {
      return before(action, HostAliasCoreRefusal.HELPER_UNREACHABLE, address);
    }
    if (ready !== null) return before(action, isTransportFailure(ready) ? PREFLIGHT_REFUSALS[ready] : HostAliasCoreRefusal.CALLER_DEFECT, address);

    const intent: HostAliasIntent<Subject> = Object.freeze({ action, address, minutes, subject });
    let token: Token;
    try {
      token = await deps.journal.intent(intent);
    } catch {
      // No act without its intent entry: nothing was sent. The journal's own failure is the journal's to report.
      return before(action, HostAliasCoreRefusal.INTENT_NOT_RECORDED, address);
    }

    let judged: Judged;
    try {
      judged = judgeExchange(await deps.transport.exchange(action === HostAliasAction.ADD && minutes !== null ? addRequestLine(quad, minutes) : delRequestLine(quad)));
    } catch {
      // A transport that throws instead of answering: whether the line left is not known.
      judged = { refusal: HostAliasCoreRefusal.HELPER_UNREACHABLE, effect: HostAliasEffect.UNKNOWN, helperCode: null };
    }
    const outcome: HostAliasOutcome = Object.freeze({ action, ...judged, address, attempted: true, resultRecorded: true });
    try {
      await deps.journal.result(Object.freeze({ ...intent, token, outcome }));
      return outcome;
    } catch {
      // The intent stands alone, as it does when the Core dies here; the caller of this file is told so.
      return Object.freeze({ ...outcome, resultRecorded: false });
    }
  }

  async function add(request: HostAliasAddRequest<Subject>): Promise<HostAliasOutcome> {
    const action = HostAliasAction.ADD;
    const minutes = aliasMinutesOf(request.minutes);
    if (minutes === null) return before(action, HostAliasCoreRefusal.MINUTES_OUT_OF_RANGE, null);
    const decided = aliasQuadOf(request.address);
    if (!decided.ok) return before(action, ADDRESS_REFUSALS[decided.problem], null);
    const address = `${dottedOf(decided.quad)}/24`;
    if (inFlight) return before(action, HostAliasCoreRefusal.CALL_IN_PROGRESS, address);
    inFlight = true;
    try {
      let facts: HostAliasFacts;
      try {
        facts = await deps.facts();
      } catch {
        return before(action, HostAliasCoreRefusal.HOST_FACTS_UNREADABLE, address);
      }
      if (typeof facts !== 'object' || facts === null) return before(action, HostAliasCoreRefusal.HOST_FACTS_UNREADABLE, address);
      const disagreement = interfaceAgreementRefusal(facts.storedInterface, facts.fileInterface);
      if (disagreement !== null) return before(action, disagreement, address);
      const wrongNetwork = wrongNetworkRefusal(decided.quad, facts);
      if (wrongNetwork !== null) return before(action, wrongNetwork, address);
      return await call(action, decided.quad, minutes, request.subject);
    } finally {
      inFlight = false;
    }
  }

  async function remove(request: HostAliasRemoveRequest<Subject>): Promise<HostAliasOutcome> {
    const action = HostAliasAction.REMOVE;
    const decided = aliasQuadOf(request.address);
    if (!decided.ok) return before(action, ADDRESS_REFUSALS[decided.problem], null);
    if (inFlight) return before(action, HostAliasCoreRefusal.CALL_IN_PROGRESS, `${dottedOf(decided.quad)}/24`);
    inFlight = true;
    try {
      return await call(action, decided.quad, null, request.subject);
    } finally {
      inFlight = false;
    }
  }

  return Object.freeze({ add, remove });
}
