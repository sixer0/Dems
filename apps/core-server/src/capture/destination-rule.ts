/**
 * THE ONE DESTINATION RULE: WHERE THE CORE MAY DIAL ON SOMEBODY'S WORD (task 4 blueprint row 95,
 * M8 / WP-19c; security finding S13-11 points 1 to 4 and its set-IP paragraph; S13-08 point 2 for
 * the alias bound; security addendum AD-02 for the stored camera address).
 *
 * Four callers, one function, the same refusals: the commissioning scan (row 107), the set-IP job
 * (row 111), the typed-address probe of the search (WP-12) and, by AD-02, the production camera
 * adapter on the STORED address at every open, connection test and presence read (rows 143, 144).
 * A caller asks BEFORE it builds a request: a refusal is a code and nothing else, so 0 packets
 * leave and no device text, no address and no name is carried in the answer.
 *
 *   point 1   an IPv4 literal only, never a name; inside 10.0.0.0/8, 172.16.0.0/12 or
 *             192.168.0.0/16; never loopback, the unspecified address, link-local, multicast,
 *             broadcast, the network or broadcast address of its /24 or of its subnet, or an
 *             address of the Core host itself
 *   point 2   never inside the subnet of an interface other than the camera interface (DR-4); the
 *             connection is made FROM a camera-interface address the answer names (`sourceAddress`);
 *             a target no camera-interface address reaches is a refusal, never a fallback route
 *   point 3   the port from the short stored list (default 80)
 *   point 4   a scan covers at most 32 stored addresses plus one typed; a minimum spacing between
 *             scans, between typed probes, and between two attempts on one host
 *   set-IP    the new address inside the configured camera subnet, not the Core's, not the
 *             gateway's, not a registered camera's; the prefix from the configuration; a gateway,
 *             when given, inside that subnet; DHCP MODE IS NOT CARRIED
 *
 * Pure: no socket, no file, no clock, no name lookup, no log. The clock is a number the caller
 * passes; the host's interfaces are facts the caller read and passes in `DestinationContext`. What
 * this file cannot hold is that the socket is then really bound to `sourceAddress`: that is the
 * caller's half of point 2. There is NO permissive value here (AD-02 point 2): the rule a full
 * session test needs lives under `test/` and reaches an adapter through its builder's `deps`.
 */
import { CAPTURE_CONNECTION_TEST_MIN_INTERVAL_MS, CAPTURE_DISCOVERY_MIN_INTERVAL_MS } from '@dems/shared/api';

// ── The named refusals ─────────────────────────────────────────────────────────────────────────

export const DestinationRefusal = {
  /** Not a text, empty, or longer than a dotted quad can be. */
  NOT_AN_ADDRESS: 'NOT_AN_ADDRESS',
  /** A name instead of a literal. Names are never resolved, so a name of the host itself is refused here too. */
  HOST_NAME: 'HOST_NAME',
  /** Digits that are not ONE strict dotted quad: a leading zero, a hexadecimal or octal part, a bare integer, fewer or more than four parts, a part above 255, a port or a prefix glued on. */
  MALFORMED_IPV4: 'MALFORMED_IPV4',
  /** An IPv6 literal of any other kind. */
  IPV6_LITERAL: 'IPV6_LITERAL',
  /** An IPv4 address written as IPv6 (`::ffff:a.b.c.d`, its hexadecimal form, the compatible and translated forms). */
  IPV4_MAPPED_IPV6: 'IPV4_MAPPED_IPV6',
  /** All of 127.0.0.0/8, and `::1`. */
  LOOPBACK: 'LOOPBACK',
  /** 0.0.0.0 and the rest of 0.0.0.0/8, and `::`. */
  UNSPECIFIED: 'UNSPECIFIED',
  /** 169.254.0.0/16. */
  LINK_LOCAL: 'LINK_LOCAL',
  /** 224.0.0.0/4. */
  MULTICAST: 'MULTICAST',
  /** 255.255.255.255 and the reserved block 240.0.0.0/4 it lies in. */
  BROADCAST: 'BROADCAST',
  /** A routable address outside the three private ranges. */
  PUBLIC_ADDRESS: 'PUBLIC_ADDRESS',
  /** The first address of its /24 or of its subnet. */
  NETWORK_ADDRESS: 'NETWORK_ADDRESS',
  /** The last address of its /24 or of its subnet. */
  SUBNET_BROADCAST: 'SUBNET_BROADCAST',
  /** An address the Core host itself holds, on any interface, alias addresses included. */
  HOST_ADDRESS: 'HOST_ADDRESS',
  /** Inside the subnet of an interface that is not the camera interface (DR-4). */
  OTHER_INTERFACE_SUBNET: 'OTHER_INTERFACE_SUBNET',
  /** No camera interface chosen, no camera subnet, or a context that is not well-formed: nothing is dialled. */
  NOT_CONFIGURED: 'NOT_CONFIGURED',
  /** Outside the configured camera subnet, and not reachable from an alias this purpose may use. */
  OUTSIDE_CAMERA_SUBNET: 'OUTSIDE_CAMERA_SUBNET',
  /** Inside the camera subnet, but the camera interface holds no address in it: the route would leave by another interface. */
  NO_CAMERA_SOURCE: 'NO_CAMERA_SOURCE',
  /** A port that is not a whole number from 1 to 65535. */
  PORT_OUT_OF_RANGE: 'PORT_OUT_OF_RANGE',
  /** A port that is not in the stored list. */
  PORT_NOT_LISTED: 'PORT_NOT_LISTED',
  /** The stored list itself is empty, too long or holds a value that is not a port. */
  PORT_LIST_INVALID: 'PORT_LIST_INVALID',
  /** Set-IP: a mode other than a fixed address was asked for. */
  DHCP_NOT_CARRIED: 'DHCP_NOT_CARRIED',
  /** Set-IP: the new address is the gateway's. */
  GATEWAY_ADDRESS: 'GATEWAY_ADDRESS',
  /** Set-IP: the new address is a registered camera's. */
  REGISTERED_CAMERA_ADDRESS: 'REGISTERED_CAMERA_ADDRESS',
  /** Set-IP: the gateway given is not a usable address of the camera subnet. */
  GATEWAY_OUTSIDE_SUBNET: 'GATEWAY_OUTSIDE_SUBNET',
} as const;
export type DestinationRefusal = (typeof DestinationRefusal)[keyof typeof DestinationRefusal];

/**
 * Who asks. The purpose decides ONE thing: whether a temporary alias address of the camera
 * interface may be the source. A factory address is by its nature outside the camera subnet, so
 * the two commissioning operations may reach it from an alias; a typed address of the search and
 * the stored address of an adopted camera lie inside the camera subnet or are refused.
 */
export const DestinationPurpose = {
  COMMISSIONING_SCAN: 'COMMISSIONING_SCAN',
  SET_IP: 'SET_IP',
  TYPED_PROBE: 'TYPED_PROBE',
  STORED_CAMERA: 'STORED_CAMERA',
} as const;
export type DestinationPurpose = (typeof DestinationPurpose)[keyof typeof DestinationPurpose];

const ALIAS_PURPOSES: readonly DestinationPurpose[] = [DestinationPurpose.COMMISSIONING_SCAN, DestinationPurpose.SET_IP];

// ── The bounds ─────────────────────────────────────────────────────────────────────────────────

/** Point 3: the ONVIF port when the setting holds nothing else. */
export const DESTINATION_DEFAULT_PORTS: readonly number[] = Object.freeze([80]);
/** Point 3: "a short stored list": at most this many ports. */
export const DESTINATION_MAX_PORTS = 8;
/** Point 4: a scan covers at most this many stored addresses (the bound of `capture_network_config.factory_addresses`). */
export const SCAN_MAX_STORED_ADDRESSES = 32;
/** Point 4: plus this many typed. */
export const SCAN_MAX_TYPED_ADDRESSES = 1;
/** The camera subnet's prefix length, as the table's CHECK holds it (schema design section 2.4). */
export const CAMERA_SUBNET_MIN_PREFIX = 16;
export const CAMERA_SUBNET_MAX_PREFIX = 30;
/** An alias is a /24 and nothing else (S13-08 point 2; `host_network_aliases.address`). */
export const ALIAS_PREFIX_LENGTH = 24;

/**
 * Point 4: the minimum spacings. No new number is invented here: a scan and a typed probe are
 * spaced as a search is per operator session, an attempt on one host as the connection test is.
 */
export const DestinationSpacing = {
  SCAN: 'SCAN',
  TYPED_PROBE: 'TYPED_PROBE',
  HOST: 'HOST',
} as const;
export type DestinationSpacing = (typeof DestinationSpacing)[keyof typeof DestinationSpacing];

export const DESTINATION_MIN_INTERVAL_MS: Readonly<Record<DestinationSpacing, number>> = Object.freeze({
  [DestinationSpacing.SCAN]: CAPTURE_DISCOVERY_MIN_INTERVAL_MS,
  [DestinationSpacing.TYPED_PROBE]: CAPTURE_DISCOVERY_MIN_INTERVAL_MS,
  [DestinationSpacing.HOST]: CAPTURE_CONNECTION_TEST_MIN_INTERVAL_MS,
});

// ── What the caller states ─────────────────────────────────────────────────────────────────────

/** A subnet: its first address and its prefix length. */
export interface DestinationSubnet {
  readonly network: string;
  readonly prefixLength: number;
}

/** An address the camera interface holds: its own, or a temporary alias the helper added. */
export interface CameraInterfaceAddress {
  readonly address: string;
  readonly alias: boolean;
}

/**
 * The facts of the host a decision is made on. The caller reads them (the configuration row, the
 * interface list) and passes them; nothing here is taken from the request.
 */
export interface DestinationContext {
  /** The configured camera subnet, or the one derived from the camera interface. `null`: not configured. */
  readonly cameraSubnet: DestinationSubnet | null;
  /** The addresses the camera interface holds now. Its own lie in `cameraSubnet`; an alias is a /24. */
  readonly cameraAddresses: readonly CameraInterfaceAddress[];
  /** The subnets of every OTHER interface of the host (DR-4). */
  readonly otherInterfaceSubnets: readonly DestinationSubnet[];
  /** Every IPv4 address the host holds, on any interface. */
  readonly hostAddresses: readonly string[];
  /** The stored port list. Left out: `DESTINATION_DEFAULT_PORTS`. */
  readonly allowedPorts?: readonly number[];
}

export interface DestinationRequest {
  readonly purpose: DestinationPurpose;
  /** As typed or as stored: anything. Only one strict dotted quad passes. */
  readonly address: unknown;
  /** Left out: the first port of the list. */
  readonly port?: unknown;
}

export interface AllowedDestination {
  /** The validated address, rebuilt from its four numbers: never the caller's text. */
  readonly address: string;
  readonly port: number;
  /** The camera-interface address the connection is made from (point 2). */
  readonly sourceAddress: string;
  /** True when the source is a temporary alias. */
  readonly viaAlias: boolean;
}

export type DestinationDecision = { readonly allowed: true; readonly destination: AllowedDestination } | { readonly allowed: false; readonly refusal: DestinationRefusal };

// ── Addresses as numbers ───────────────────────────────────────────────────────────────────────

const DOTTED_QUAD = /^(0|[1-9]\d{0,2})\.(0|[1-9]\d{0,2})\.(0|[1-9]\d{0,2})\.(0|[1-9]\d{0,2})$/;
/** Text made of digits, dots and the letters of a hexadecimal number only: an address somebody meant, not a name. */
const NUMERIC_ONLY = /^[0-9a-fx.]+$/i;
const LONGEST_ADDRESS = '255.255.255.255'.length;
/** The longest text looked at at all: an IPv6 literal with a zone and brackets is shorter. */
const LONGEST_INPUT = 64;
const IPV6_UNSPECIFIED = /^(?:0{0,4}:){2,7}0{0,4}$/;
const IPV6_LOOPBACK = /^(?:0{0,4}:){2,7}0{0,3}1$/;
/** An IPv6 literal that carries an IPv4 address: a dotted tail, or the mapped, compatible (`::a:b`) and translated (`64:ff9b::`) prefixes. */
const IPV6_CARRIES_IPV4 = /\d+\.\d+|^(?:0{0,4}:)*:?ffff:|^(?:0{0,4}:){2,6}[0-9a-f]{1,4}:[0-9a-f]{1,4}$|^0*64:ff9b:/i;

const refuse = (refusal: DestinationRefusal): DestinationDecision => Object.freeze({ allowed: false, refusal });

/** One strict dotted quad as a number from 0 to 2^32 - 1, or `null`. */
function parseDottedQuad(text: string): number | null {
  const match = DOTTED_QUAD.exec(text);
  if (match === null) return null;
  let value = 0;
  for (let part = 1; part <= 4; part += 1) {
    const octet = Number(match[part]);
    if (octet > 255) return null;
    value = value * 256 + octet;
  }
  return value;
}

const formatAddress = (value: number): string => [Math.floor(value / 16_777_216) % 256, Math.floor(value / 65_536) % 256, Math.floor(value / 256) % 256, value % 256].join('.');
const blockSize = (prefixLength: number): number => 2 ** (32 - prefixLength);
const networkOf = (value: number, prefixLength: number): number => value - (value % blockSize(prefixLength));
const inside = (value: number, network: number, prefixLength: number): boolean => networkOf(value, prefixLength) === network;
const isPrefix = (value: unknown, min: number, max: number): value is number => typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max;

const A = (first: number, second = 0): number => first * 16_777_216 + second * 65_536;
/** The three private ranges of point 1. */
const PRIVATE_RANGES: readonly (readonly [number, number])[] = [
  [A(10), 8],
  [A(172, 16), 12],
  [A(192, 168), 16],
];
const isPrivate = (value: number): boolean => PRIVATE_RANGES.some(([network, prefixLength]) => inside(value, network, prefixLength));

/** The class of a text that is not one strict dotted quad. */
function refusalOfText(text: string): DestinationRefusal {
  // Brackets and a zone are forms of writing an IPv6 literal; a name has neither.
  const bare = text.replace(/^\[/, '').replace(/\]$/, '').replace(/%.*$/, '');
  if (/\s/.test(text)) return DestinationRefusal.MALFORMED_IPV4;
  // One colon is a port glued on, not an IPv6 literal: it is judged below as the text it is.
  if (bare.split(':').length > 2) {
    if (IPV6_UNSPECIFIED.test(bare)) return DestinationRefusal.UNSPECIFIED;
    if (IPV6_LOOPBACK.test(bare)) return DestinationRefusal.LOOPBACK;
    if (IPV6_CARRIES_IPV4.test(bare)) return DestinationRefusal.IPV4_MAPPED_IPV6;
    return /^[0-9a-f:]+$/i.test(bare) ? DestinationRefusal.IPV6_LITERAL : DestinationRefusal.MALFORMED_IPV4;
  }
  return NUMERIC_ONLY.test(text) || /^\d/.test(text) ? DestinationRefusal.MALFORMED_IPV4 : DestinationRefusal.HOST_NAME;
}

/** Point 1 without the host's facts: the address as a number, or the named refusal of its class. */
function classify(address: unknown): { readonly value: number } | { readonly refusal: DestinationRefusal } {
  if (typeof address !== 'string' || address.length === 0 || address.length > LONGEST_INPUT) return { refusal: DestinationRefusal.NOT_AN_ADDRESS };
  const value = address.length <= LONGEST_ADDRESS ? parseDottedQuad(address) : null;
  if (value === null) return { refusal: refusalOfText(address) };
  if (inside(value, A(0), 8)) return { refusal: DestinationRefusal.UNSPECIFIED };
  if (inside(value, A(127), 8)) return { refusal: DestinationRefusal.LOOPBACK };
  if (inside(value, A(169, 254), 16)) return { refusal: DestinationRefusal.LINK_LOCAL };
  if (inside(value, A(224), 4)) return { refusal: DestinationRefusal.MULTICAST };
  if (inside(value, A(240), 4)) return { refusal: DestinationRefusal.BROADCAST };
  if (!isPrivate(value)) return { refusal: DestinationRefusal.PUBLIC_ADDRESS };
  return { value };
}

// ── The context, read once and held to its own bounds ──────────────────────────────────────────

interface Subnet {
  readonly network: number;
  readonly prefixLength: number;
}
interface Source {
  readonly value: number;
  readonly alias: boolean;
}
interface Facts {
  readonly camera: Subnet;
  readonly sources: readonly Source[];
  readonly others: readonly Subnet[];
  readonly host: readonly number[];
}

function subnetOf(subnet: DestinationSubnet, minPrefix: number, maxPrefix: number): Subnet | null {
  const network = typeof subnet?.network === 'string' ? parseDottedQuad(subnet.network) : null;
  if (network === null || !isPrefix(subnet.prefixLength, minPrefix, maxPrefix) || networkOf(network, subnet.prefixLength) !== network) return null;
  return { network, prefixLength: subnet.prefixLength };
}

/**
 * The host's facts as numbers, or `null` when anything in them is not well-formed. A context that
 * cannot be read refuses everything: the rule never guesses a subnet, a source or an interface.
 */
function factsOf(context: DestinationContext): Facts | null {
  if (context === null || typeof context !== 'object' || context.cameraSubnet === null || context.cameraSubnet === undefined) return null;
  if (!Array.isArray(context.cameraAddresses) || !Array.isArray(context.otherInterfaceSubnets) || !Array.isArray(context.hostAddresses)) return null;
  const camera = subnetOf(context.cameraSubnet, CAMERA_SUBNET_MIN_PREFIX, CAMERA_SUBNET_MAX_PREFIX);
  if (camera === null || !isPrivate(camera.network)) return null;
  const sources: Source[] = [];
  for (const entry of context.cameraAddresses) {
    const value = typeof entry?.address === 'string' ? parseDottedQuad(entry.address) : null;
    if (value === null || typeof entry.alias !== 'boolean' || !isPrivate(value)) return null;
    // An address of the interface itself lies in the camera subnet; anything else it holds is an alias and must say so.
    if (!entry.alias && !inside(value, camera.network, camera.prefixLength)) return null;
    sources.push({ value, alias: entry.alias });
  }
  const others: Subnet[] = [];
  for (const entry of context.otherInterfaceSubnets) {
    const subnet = subnetOf(entry, 0, 32);
    if (subnet === null) return null;
    others.push(subnet);
  }
  const host: number[] = sources.map((source) => source.value);
  for (const entry of context.hostAddresses) {
    const value = typeof entry === 'string' ? parseDottedQuad(entry) : null;
    if (value === null) return null;
    host.push(value);
  }
  return { camera, sources, others, host };
}

/** The first or last address of a block, as a refusal. */
function edgeRefusal(value: number, prefixLength: number): DestinationRefusal | null {
  const network = networkOf(value, prefixLength);
  if (value === network) return DestinationRefusal.NETWORK_ADDRESS;
  if (value === network + blockSize(prefixLength) - 1) return DestinationRefusal.SUBNET_BROADCAST;
  return null;
}

/** Point 3. */
function decidePort(port: unknown, allowedPorts: readonly number[] | undefined): { readonly port: number } | { readonly refusal: DestinationRefusal } {
  const list = allowedPorts ?? DESTINATION_DEFAULT_PORTS;
  const isPort = (value: unknown): value is number => typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 65_535;
  if (!Array.isArray(list) || list.length === 0 || list.length > DESTINATION_MAX_PORTS || !list.every(isPort)) return { refusal: DestinationRefusal.PORT_LIST_INVALID };
  const asked = port === undefined ? list[0] : port;
  if (!isPort(asked)) return { refusal: DestinationRefusal.PORT_OUT_OF_RANGE };
  if (!list.includes(asked)) return { refusal: DestinationRefusal.PORT_NOT_LISTED };
  return { port: asked };
}

// ── The rule ───────────────────────────────────────────────────────────────────────────────────

/**
 * THE DECISION. `allowed: true` names the address, the port and the source to bind; anything else
 * is one named refusal. The class of the address is decided first, so that a loopback, a mapped
 * or a public address has its own code whatever the host's configuration says.
 */
export function decideDestination(request: DestinationRequest, context: DestinationContext): DestinationDecision {
  const purposes: readonly string[] = Object.values(DestinationPurpose);
  if (request === null || typeof request !== 'object' || !purposes.includes(request.purpose)) return refuse(DestinationRefusal.NOT_CONFIGURED);
  const classed = classify(request.address);
  if ('refusal' in classed) return refuse(classed.refusal);
  const target = classed.value;

  const facts = factsOf(context);
  if (facts === null) return refuse(DestinationRefusal.NOT_CONFIGURED);
  if (facts.host.includes(target)) return refuse(DestinationRefusal.HOST_ADDRESS);
  if (facts.others.some((subnet) => inside(target, subnet.network, subnet.prefixLength))) return refuse(DestinationRefusal.OTHER_INTERFACE_SUBNET);

  // Point 2: the source. Inside the camera subnet: an own address of the interface. Outside it: an alias whose /24 holds the target, for the purposes that may use one.
  let source: Source | undefined;
  let prefixLength: number;
  if (inside(target, facts.camera.network, facts.camera.prefixLength)) {
    source = facts.sources.find((entry) => !entry.alias);
    if (source === undefined) return refuse(DestinationRefusal.NO_CAMERA_SOURCE);
    prefixLength = facts.camera.prefixLength;
  } else {
    if (ALIAS_PURPOSES.includes(request.purpose)) source = facts.sources.find((entry) => entry.alias && inside(target, networkOf(entry.value, ALIAS_PREFIX_LENGTH), ALIAS_PREFIX_LENGTH));
    if (source === undefined) return refuse(DestinationRefusal.OUTSIDE_CAMERA_SUBNET);
    prefixLength = ALIAS_PREFIX_LENGTH;
  }

  const edge = edgeRefusal(target, ALIAS_PREFIX_LENGTH) ?? edgeRefusal(target, prefixLength);
  if (edge !== null) return refuse(edge);

  const port = decidePort(request.port, context.allowedPorts);
  if ('refusal' in port) return refuse(port.refusal);
  return Object.freeze({ allowed: true, destination: Object.freeze({ address: formatAddress(target), port: port.port, sourceAddress: formatAddress(source.value), viaAlias: source.alias }) });
}

// ── Set-IP: the address a camera is given (S13-11, the set-IP paragraph) ───────────────────────

export interface NewCameraAddressRequest {
  /** The new address, as typed. */
  readonly address: unknown;
  /** The gateway to write, when one is given. */
  readonly gateway?: unknown;
  /** Left out or `STATIC`. Anything else is the mode that is not carried. */
  readonly mode?: unknown;
}

export interface NewCameraAddressContext extends DestinationContext {
  /** The addresses of the registered cameras. */
  readonly registeredCameraAddresses: readonly string[];
  /** The gateway of the camera subnet, when the installation has one. */
  readonly gatewayAddress?: string | null;
}

export interface NewCameraAddress {
  readonly address: string;
  /** From the configuration: a request carries no prefix. */
  readonly prefixLength: number;
  readonly gateway: string | null;
}

export type NewCameraAddressDecision = { readonly allowed: true; readonly assignment: NewCameraAddress } | { readonly allowed: false; readonly refusal: DestinationRefusal };

/** The one mode a camera's network is set in. */
export const CAMERA_ADDRESS_MODE = 'STATIC';

/**
 * The address the set-IP job WRITES into a camera. Not a destination: nothing is dialled at it, so
 * no source and no port are decided; where the job connects to is `decideDestination` on the
 * camera's current address.
 */
export function decideNewCameraAddress(request: NewCameraAddressRequest, context: NewCameraAddressContext): NewCameraAddressDecision {
  const no = (refusal: DestinationRefusal): NewCameraAddressDecision => Object.freeze({ allowed: false, refusal });
  if (request === null || typeof request !== 'object') return no(DestinationRefusal.NOT_CONFIGURED);
  if (request.mode !== undefined && request.mode !== CAMERA_ADDRESS_MODE) return no(DestinationRefusal.DHCP_NOT_CARRIED);
  const classed = classify(request.address);
  if ('refusal' in classed) return no(classed.refusal);
  const target = classed.value;

  const facts = factsOf(context);
  if (facts === null || !Array.isArray(context.registeredCameraAddresses)) return no(DestinationRefusal.NOT_CONFIGURED);
  const { camera } = facts;
  const usable = (value: number): boolean => inside(value, camera.network, camera.prefixLength) && edgeRefusal(value, camera.prefixLength) === null;

  if (facts.host.includes(target)) return no(DestinationRefusal.HOST_ADDRESS);
  if (facts.others.some((subnet) => inside(target, subnet.network, subnet.prefixLength))) return no(DestinationRefusal.OTHER_INTERFACE_SUBNET);
  if (!inside(target, camera.network, camera.prefixLength)) return no(DestinationRefusal.OUTSIDE_CAMERA_SUBNET);
  const edge = edgeRefusal(target, ALIAS_PREFIX_LENGTH) ?? edgeRefusal(target, camera.prefixLength);
  if (edge !== null) return no(edge);

  let configuredGateway: number | null = null;
  if (context.gatewayAddress !== undefined && context.gatewayAddress !== null) {
    configuredGateway = typeof context.gatewayAddress === 'string' ? parseDottedQuad(context.gatewayAddress) : null;
    if (configuredGateway === null || !usable(configuredGateway)) return no(DestinationRefusal.NOT_CONFIGURED);
  }
  let gateway: number | null = null;
  if (request.gateway !== undefined && request.gateway !== null) {
    const given = classify(request.gateway);
    if ('refusal' in given || !usable(given.value)) return no(DestinationRefusal.GATEWAY_OUTSIDE_SUBNET);
    gateway = given.value;
  }
  if (target === gateway || target === configuredGateway) return no(DestinationRefusal.GATEWAY_ADDRESS);

  for (const entry of context.registeredCameraAddresses) {
    // A stored address that cannot be read is not skipped: the job is refused until the registry is clean.
    const value = typeof entry === 'string' ? parseDottedQuad(entry) : null;
    if (value === null) return no(DestinationRefusal.NOT_CONFIGURED);
    if (value === target) return no(DestinationRefusal.REGISTERED_CAMERA_ADDRESS);
  }
  return Object.freeze({ allowed: true, assignment: Object.freeze({ address: formatAddress(target), prefixLength: camera.prefixLength, gateway: gateway === null ? null : formatAddress(gateway) }) });
}

// ── Point 4: size and spacing ──────────────────────────────────────────────────────────────────

export const ScanSizeRefusal = {
  TOO_MANY_STORED: 'TOO_MANY_STORED',
  TOO_MANY_TYPED: 'TOO_MANY_TYPED',
  NOTHING_TO_SCAN: 'NOTHING_TO_SCAN',
} as const;
export type ScanSizeRefusal = (typeof ScanSizeRefusal)[keyof typeof ScanSizeRefusal];

/** The size of one scan: at most 32 stored addresses plus one typed, and at least one address. `null`: within the bound. */
export function scanSizeRefusal(storedCount: number, typedCount: number): ScanSizeRefusal | null {
  const count = (value: number): boolean => Number.isInteger(value) && value >= 0;
  if (!count(storedCount) || storedCount > SCAN_MAX_STORED_ADDRESSES) return ScanSizeRefusal.TOO_MANY_STORED;
  if (!count(typedCount) || typedCount > SCAN_MAX_TYPED_ADDRESSES) return ScanSizeRefusal.TOO_MANY_TYPED;
  return storedCount + typedCount === 0 ? ScanSizeRefusal.NOTHING_TO_SCAN : null;
}

export type SpacingAllowance = { readonly allowed: true } | { readonly allowed: false; readonly retryAfterMs: number };

/**
 * The minimum spacing of point 4. `lastAtMs`: when the last scan, the last typed probe or the last
 * attempt on this host STARTED, or `null` for none; `nowMs`: the caller's clock. A clock that went
 * back, or a time that is not a number, is refused for the whole interval: never read as "long ago".
 * "One commissioning job and one scan at a time per Core" is the single flight of the operation
 * that holds the state (rows 107, 111), not a number of this file.
 */
export function spacingAllowance(spacing: DestinationSpacing, lastAtMs: number | null, nowMs: number): SpacingAllowance {
  if (lastAtMs === null) return { allowed: true };
  const interval = DESTINATION_MIN_INTERVAL_MS[spacing];
  if (!Number.isFinite(lastAtMs) || !Number.isFinite(nowMs) || nowMs < lastAtMs) return { allowed: false, retryAfterMs: interval };
  const elapsed = nowMs - lastAtMs;
  return elapsed >= interval ? { allowed: true } : { allowed: false, retryAfterMs: Math.max(1, interval - elapsed) };
}
