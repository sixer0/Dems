/**
 * Fake ONVIF camera for tests (blueprint row 60; register NM-14; capture spec §A.8.1 ST-1..ST-5,
 * §A.6.1 DS-8 / DS-9 / DS-15, §A.6.2 CT-1..CT-4; not a test file, nothing here imports Vitest).
 *
 * It is the only "network" the automated suite ever searches or connects to (R-9 AC-14): the test
 * double that the discovery row (131) and the connect-flow row (142) drive. Three listeners, all on
 * the literal 127.0.0.1 (SEC35-23: no host option) and all on EPHEMERAL ports the operating
 * system hands out (`freeFakeOnvifPorts`; decision D170, integration pass E3 item 7). The stub is
 * NEVER inside the protocol's media range 8554-8564: that range belongs to the capture worker's
 * harnesses (the worker e2e series, the kill matrix, the seal e2e), and a stub that took a port
 * there stopped 22 e2e checks on "ports busy". A port of that range, a port below the ephemeral
 * floor and port 0 are refused when a stub is built:
 *
 *   discovery  UDP   answers a UNICAST WS-Discovery Probe (no multicast group is joined, nothing
 *                    is announced: DS-15). ST-1: N configurable ProbeMatches, each with an endpoint
 *                    reference, Types, the three mandatory scope categories and XAddrs; `RelatesTo`
 *                    is the Probe's MessageID. ST-2: one switch per hostile or odd answer.
 *   device     HTTP  the ONVIF device and media services in one SOAP 1.2 endpoint (ST-3):
 *                    GetSystemDateAndTime, GetServices, GetCapabilities (no authentication, as
 *                    PRE_AUTH), GetProfiles, GetStreamUri (authenticated). Authentication is
 *                    WS-Security UsernameToken with PasswordDigest (Base64(SHA-1(nonce + created +
 *                    secret)), created within 5 s of the stub's clock, a nonce is accepted once),
 *                    or HTTP Digest (RFC 2617, MD5, qop=auth). One fixture account.
 *   rtsp       TCP   answers OPTIONS and DESCRIBE only (ST-4): an H.264 or H.265 SDP, optionally
 *                    behind a 401 with a digest challenge. SETUP, PLAY and every other method are
 *                    answered 405 AND recorded as a violation. No RTP ever flows.
 *
 * ST-5, the request log: every request is recorded as { channel, method, operation,
 * authPresent } - never a header value, a nonce, a user name or a secret. A request outside the
 * read-only list of CT-1, a password offered in clear (HTTP Basic, WS-Security PasswordText) and
 * any RTSP method beyond DESCRIBE are answered with a fault and recorded in `violations()`.
 *
 * WHAT IT DOES NOT DO (say so before relying on it): no multicast and no Hello / Bye; no IPv6; no
 * TLS; no WS-Security timestamps or signatures beyond the UsernameToken; no GetDeviceInformation,
 * GetScopes or any Set / Create / PTZ / event operation (they are violations by design); the SOAP
 * request is read with regular expressions, not an XML parser (a stub decides nothing on it but the
 * operation name and the token fields); the RTSP responder has no SETUP, no interleaved data and
 * no keep-alive timeout; HTTP Digest accepts MD5 only. The media itself comes from the fake camera
 * of apps/capture-worker/test-fixtures, not from here.
 *
 * The fixture credential is a constructor argument of the test's set-up code. It is not a default
 * of this file and never a default of the product (C-N15).
 *
 * THE NETWORK CALLS (task 4, blueprint row 109, WP-22a; OFF unless the option `network` is given,
 * so everything above holds unchanged for every stub built without it, `SystemReboot` included):
 * with `network`, the device listener also answers the four calls of the set-camera-address
 * exchange (`apps/input-av/nvr/onvif_client.py:192-230` is the reference of the order):
 * GetNetworkInterfaces, SetNetworkInterfaces, SetNetworkDefaultGateway, SystemReboot - all four
 * authenticated as GetProfiles is. The stub keeps a small state (interface token, hardware
 * address, IPv4 address, prefix, gateway, a pending change, a reboot count) and a record per
 * network request that says whether the request was well-formed XML and whether it was accepted.
 * Reply modes, one switch each (`setNetworkMode`): MALFORMED_REPLY, OVERSIZED_REPLY, MARKUP_TOKEN
 * (the interface token holds markup characters; the request that writes it back must escape it)
 * and TWO_ENDPOINTS (a Probe is answered by two endpoint references from the one address).
 * What it does NOT do: it never changes an address of this host and never listens anywhere but
 * 127.0.0.1 - "the camera moved" is a value in its state, not a socket; IPv6, link settings, MTU
 * and DNS are not read; well-formedness is judged by a small scanner, not an XML parser.
 * Every value is synthetic (RFC 5737 addresses, an RFC 7042 documentation hardware address).
 */
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { createSocket, type RemoteInfo, type Socket as UdpSocket } from 'node:dgram';
import { createServer as createHttpServer, type IncomingMessage, type Server as HttpServer, type ServerResponse } from 'node:http';
import { createServer as createTcpServer, type Server as TcpServer, type Socket as TcpSocket } from 'node:net';
import { CAPTURE_MEDIA_PORT_MAX, CAPTURE_MEDIA_PORT_MIN } from '@dems/capture-protocol';

/** The only address any listener of the stub binds. */
export const FAKE_ONVIF_HOST = '127.0.0.1';
/**
 * How many of the stub's devices a search can list as TESTABLE: one (integration pass C2).
 *
 * Every device of the stub answers from the ONE address above. The product's conflict rule
 * (`discovery-collector.ts`, SEC35-28 (1)) takes the HOST of a responder from the address the kernel
 * names for the datagram - the address only, never the port - and marks every responder of a host
 * that carries more than one endpoint reference `conflict`, not testable. So `devices: N` with N > 1
 * is the fixture of that conflict case and nothing else.
 *
 * Two ways around it were looked at and are NOT taken:
 *   - other loopback addresses (127.0.0.2, 127.0.0.3 ...): on this macOS host a bind of 127.0.0.2
 *     fails with EADDRNOTAVAIL for TCP and UDP (measured 2026-10-09). It needs an interface alias
 *     that only root can add; a test never asks for root and never changes network settings, and
 *     SEC35-23 pins every fixture listener to the literal 127.0.0.1;
 *   - other PORTS on 127.0.0.1 as "different devices": the rule's definition does not allow it. A
 *     host is an address; two answers from 127.0.0.1 are one host whatever their source ports, and
 *     that is the rule working, not a gap of the fixture.
 * A flow that needs two adopted cameras runs the sequence twice against a stub of one device.
 */
export const FAKE_ONVIF_TESTABLE_DEVICES_MAX = 1;
/**
 * WHERE THE STUB MAY LISTEN (decision D170): the ephemeral ports of the operating system, never a
 * port a harness or a service of this project uses. The floor is the lower of the two platforms'
 * ephemeral ranges (Linux 32768, macOS 49152): everything this project binds by number - the Core
 * 4420-4423, PostgreSQL 4432, the web lanes 5173-5175, the media range - lies far below it.
 */
export const FAKE_ONVIF_PORT_MIN = 32_768;
export const FAKE_ONVIF_PORT_MAX = 65_535;
/**
 * THE PORTS OF THE CAPTURE HARNESSES: the protocol's whole media range (`CAPTURE_MEDIA_PORT_MIN` /
 * `MAX` of `@dems/capture-protocol`, the ONE place both sides read; every `--ports` pair of
 * `apps/capture-worker/test/e2e.py` and `m3worker.py`, and 8554 / 8556 of the kill matrix and the
 * seal e2e, are inside it by the protocol's own rule). The stub never returns and never accepts one.
 */
export const FAKE_ONVIF_HARNESS_PORT_MIN = CAPTURE_MEDIA_PORT_MIN;
export const FAKE_ONVIF_HARNESS_PORT_MAX = CAPTURE_MEDIA_PORT_MAX;
export const isCaptureHarnessPort = (port: number): boolean => port >= FAKE_ONVIF_HARNESS_PORT_MIN && port <= FAKE_ONVIF_HARNESS_PORT_MAX;

/** A port the stub was to listen on is held by another program: named, never answered by moving to another port. */
export class FakeOnvifPortBusyError extends Error {
  readonly code = 'FAKE_ONVIF_PORT_BUSY';
  readonly listener: 'discovery' | 'device' | 'rtsp';
  readonly port: number;
  constructor(listener: 'discovery' | 'device' | 'rtsp', port: number, cause: unknown) {
    super(`fake ONVIF stub: the ${listener} port ${String(port)} on 127.0.0.1 is busy (FAKE_ONVIF_PORT_BUSY); the stub does not move to another port - ask freeFakeOnvifPorts() again`, { cause });
    this.name = 'FakeOnvifPortBusyError';
    this.listener = listener;
    this.port = port;
  }
}
/** A documentation address (RFC 5737): the "other host" of the steering cases. It is never contacted. */
export const FAKE_ONVIF_FOREIGN_HOST = '192.0.2.10';

/**
 * The answer of discovery mode `NOT_XML`: 512 FIXED bytes that are no XML. Fixed on purpose (pass H-Y): the body was
 * `randomBytes(512)`, and about one random body in 130 holds the two bytes `<!` - which a search rightly drops as a
 * DECLARATION (the declaration rule reads the bytes before any parser does), not as NOT_XML. The reason of a hostile
 * answer must not be drawn by lot: this body holds no `<!`, and `probe-answer.test.ts` pins its one reason.
 */
export const FAKE_ONVIF_NOT_XML_BODY: Buffer = Buffer.from(Array.from({ length: 512 }, (_unused, index) => (index * 97 + 13) % 256));

export const WS_DISCOVERY_NAMESPACE = 'http://schemas.xmlsoap.org/ws/2005/04/discovery';
export const WS_DISCOVERY_PROBE_ACTION = `${WS_DISCOVERY_NAMESPACE}/Probe`;
export const WS_DISCOVERY_PROBE_MATCHES_ACTION = `${WS_DISCOVERY_NAMESPACE}/ProbeMatches`;
export const WS_DISCOVERY_TO = 'urn:schemas-xmlsoap-org:ws:2005:04:discovery';
const PASSWORD_DIGEST_TYPE = 'http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-username-token-profile-1.0#PasswordDigest';
const DIGEST_REALM = 'fake-onvif';
/** The read-only operations a connection test may call (capture spec §A.6.2 CT-1). */
export const FAKE_ONVIF_ALLOWED_OPERATIONS = ['GetSystemDateAndTime', 'GetServices', 'GetCapabilities', 'GetProfiles', 'GetStreamUri'] as const;
const PRE_AUTH_OPERATIONS: readonly string[] = ['GetSystemDateAndTime', 'GetServices', 'GetCapabilities'];
const RTSP_ALLOWED_METHODS: readonly string[] = ['OPTIONS', 'DESCRIBE'];
/** A WS-Security token is accepted when its `Created` is this close to the stub's clock. */
const TOKEN_CLOCK_WINDOW_MS = 5_000;

/** ST-1 / ST-2. `NORMAL` answers each Probe with one ProbeMatches message per configured device. */
export type FakeOnvifDiscoveryMode =
  | 'NORMAL'
  | 'SILENT' //                 a device set non-discoverable: no answer
  | 'WRONG_RELATES_TO' //       an answer to some other search
  | 'FOREIGN_XADDR' //          XAddrs names another host than the one the answer comes from
  | 'NO_XADDRS'
  | 'TWO_MATCHES_IN_ONE' //     two ProbeMatch children in one message
  | 'EMPTY_MATCHES' //          a ProbeMatches element with no child
  | 'OVERSIZED_BODY' //         a 60 KiB body
  | 'ENTITY_EXPANSION' //       a DOCTYPE with nested entities
  | 'NOT_XML'
  | 'FLOOD_300'; //             300 answers, each another endpoint reference

/** ST-3. A wrong credential needs no mode: it is refused in every mode. */
export type FakeOnvifDeviceMode =
  | 'NORMAL' //                 one H.264 profile, a stream address on this host
  | 'NO_PROFILE'
  | 'H265_ONLY'
  | 'FOREIGN_STREAM_HOST' //    GetStreamUri names another host
  | 'BASIC_ONLY' //             every authenticated operation is answered 401 with a Basic challenge only
  | 'NO_ANSWER'; //             the connection is accepted and never answered

/** ST-4. */
export type FakeOnvifRtspMode = 'H264' | 'H265' | 'H264_NO_PARAMETER_SETS';

// ── The profile set of a camera with two video sources (task 4, integration pass I-2: request of row 26; only with the option `profileSet`) ──

/** One profile of the set: the tokens and the size `GetProfiles` announces, and the path `GetStreamUri` names for it. */
export interface FakeOnvifProfile {
  readonly token: string;
  readonly videoSourceToken: string;
  readonly width: number;
  readonly height: number;
  readonly streamPath: string;
}

/** A profile token with lower-case letters, a dot, a colon and a hyphen: the form a selector code cannot hold. */
export const FAKE_ONVIF_ODD_PROFILE_TOKEN = 'Main.Stream:0-a';

/**
 * `profileSet: 'TWO_SOURCES'`: five profiles on two video sources, in the order `GetProfiles` lists
 * them. Per source the pixel areas differ and the largest is not listed first; the larger of the two
 * sources is the second one. `GetStreamUri` answers per profile token and faults for any other.
 */
export const FAKE_ONVIF_TWO_SOURCE_PROFILES: readonly FakeOnvifProfile[] = Object.freeze([
  Object.freeze({ token: 'lens1.sub', videoSourceToken: 'vs_1', width: 704, height: 576, streamPath: '/lens1/sub' }),
  Object.freeze({ token: 'lens1.main', videoSourceToken: 'vs_1', width: 1920, height: 1080, streamPath: '/lens1/main' }),
  Object.freeze({ token: 'lens2-sub', videoSourceToken: 'Video.Source:0-b', width: 640, height: 360, streamPath: '/lens2/sub' }),
  Object.freeze({ token: 'lens2-mid', videoSourceToken: 'Video.Source:0-b', width: 1280, height: 720, streamPath: '/lens2/mid' }),
  Object.freeze({ token: FAKE_ONVIF_ODD_PROFILE_TOKEN, videoSourceToken: 'Video.Source:0-b', width: 2560, height: 1440, streamPath: '/lens2/main' }),
]);

export type FakeOnvifProfileSet = 'TWO_SOURCES';

/** The address `GetStreamUri` names for a profile of the set, on the stub's own RTSP port. */
export const fakeOnvifProfileStreamUri = (rtspPort: number, profile: FakeOnvifProfile): string => `rtsp://${FAKE_ONVIF_HOST}:${rtspPort}${profile.streamPath}`;

// ── The network calls of the set-camera-address exchange (row 109; only with the option `network`) ──

/** The four calls, in the order the exchange makes them. */
export const FAKE_ONVIF_NETWORK_OPERATIONS = ['GetNetworkInterfaces', 'SetNetworkInterfaces', 'SetNetworkDefaultGateway', 'SystemReboot'] as const;
export type FakeOnvifNetworkOperation = (typeof FAKE_ONVIF_NETWORK_OPERATIONS)[number];
/**
 * The read the `onvif` package makes by itself after a gateway set that was given a callback
 * (`node_modules/onvif/lib/device.js:373-388`). NOT one of the four: answered only with
 * `network.gatewayReadBack`, otherwise it is a violation like any other operation.
 */
export const FAKE_ONVIF_GATEWAY_READ_BACK_OPERATION = 'GetNetworkDefaultGateway';
/** What the stub reports until a test sets something else. Synthetic: RFC 5737 addresses, an RFC 7042 documentation hardware address. */
export const FAKE_ONVIF_NETWORK_DEFAULTS = {
  interfaceToken: 'eth0',
  hwAddress: '00:00:5e:00:53:01',
  address: '192.0.2.20',
  prefixLength: 24,
  gateway: '192.0.2.1',
} as const;
/**
 * The interface token of mode `MARKUP_TOKEN`: quote, angle brackets, an apostrophe and an ampersand.
 * In the reply it is an escaped attribute value (the reply is well-formed). Written back RAW into
 * `<InterfaceToken>` it makes the request not well-formed, which the stub answers with a fault and
 * records (`wellFormed: false`).
 */
export const FAKE_ONVIF_MARKUP_TOKEN = `eth0"><x y='1'>&`;
/** The padding of mode `OVERSIZED_REPLY`: the reply is well-formed and larger than this (the connection test's cap is 1 MiB). */
export const FAKE_ONVIF_OVERSIZED_REPLY_BYTES = 2 * 1024 * 1024;

export type FakeOnvifNetworkMode =
  | 'NORMAL'
  | 'MALFORMED_REPLY' //        status 200, a body cut in the middle of an element
  | 'OVERSIZED_REPLY' //        a well-formed body above FAKE_ONVIF_OVERSIZED_REPLY_BYTES
  | 'MARKUP_TOKEN' //           the interface token is FAKE_ONVIF_MARKUP_TOKEN
  | 'TWO_ENDPOINTS'; //         a Probe is answered by two endpoint references from the one address

export interface FakeOnvifNetworkOptions {
  readonly hwAddress?: string;
  readonly address?: string;
  readonly prefixLength?: number;
  readonly gateway?: string;
  /** What SetNetworkInterfaces answers in `RebootNeeded`. true: the change is applied by SystemReboot; false: at once. Default true. */
  readonly rebootNeeded?: boolean;
  /** SetNetworkDefaultGateway is answered with a fault (the reference treats it as a warning). Default false. */
  readonly gatewayFault?: boolean;
  /** Also answer `GetNetworkDefaultGateway` (see FAKE_ONVIF_GATEWAY_READ_BACK_OPERATION). Default false. */
  readonly gatewayReadBack?: boolean;
  /** SystemReboot is obeyed and the connection is closed without an answer (a camera that goes down at once). Default false. */
  readonly rebootDropsConnection?: boolean;
}

export interface FakeOnvifNetworkState {
  readonly interfaceToken: string;
  readonly hwAddress: string;
  readonly address: string;
  readonly prefixLength: number;
  readonly dhcp: boolean;
  readonly gateway: string;
  /** A change SetNetworkInterfaces accepted that waits for SystemReboot. */
  readonly pending: { readonly address: string; readonly prefixLength: number; readonly dhcp: boolean } | null;
  readonly rebootCount: number;
  /** The second endpoint reference of mode `TWO_ENDPOINTS`. */
  readonly twinEndpointRef: string;
}

/** One network request as the stub judged it. Addresses are recorded only when they are dotted IPv4; never a header, a token of the account or a secret. */
export interface FakeOnvifNetworkRequest {
  readonly operation: FakeOnvifNetworkOperation | typeof FAKE_ONVIF_GATEWAY_READ_BACK_OPERATION;
  /** Was the whole request body well-formed XML? */
  readonly wellFormed: boolean;
  readonly accepted: boolean;
  readonly refusal: null | 'NOT_WELL_FORMED' | 'INTERFACE_TOKEN_UNKNOWN' | 'ADDRESS_INVALID' | 'GATEWAY_REFUSED';
  readonly address: string | null;
  readonly prefixLength: number | null;
  readonly dhcp: boolean | null;
  readonly gateway: string | null;
}

export interface FakeOnvifPorts {
  /** UDP. */
  readonly discovery: number;
  /** TCP, the device and media services. */
  readonly device: number;
  /** TCP, the RTSP responder. */
  readonly rtsp: number;
}

export interface FakeOnvifCredential {
  readonly username: string;
  readonly secret: string;
}

export interface FakeOnvifStubOptions {
  readonly ports: FakeOnvifPorts;
  /** The one fixture account. Set by the test; there is no default. */
  readonly credential: FakeOnvifCredential;
  /** ST-1: how many devices answer a Probe (0 = the empty network). Default 1. */
  readonly devices?: number;
  /** The stub's clock against the host's, in ms: a client must read `GetSystemDateAndTime` to build its token. Default 0. */
  readonly clockOffsetMs?: number;
  /** GOP length the H.264 profile announces (`GovLength`, frames at 25 fps). Default 50 = 2 s. */
  readonly govLength?: number;
  /** The RTSP responder asks for digest authentication before it answers DESCRIBE. Default false. */
  readonly rtspDigest?: boolean;
  /** Row 109: answer the four network calls. Absent (the default): they are violations, as every Set operation is. */
  readonly network?: FakeOnvifNetworkOptions;
  /**
   * Integration pass I-2 (request of row 26): `GetProfiles` lists `FAKE_ONVIF_TWO_SOURCE_PROFILES` and
   * `GetStreamUri` answers per profile token. Absent (the default): the one profile `profile_1` on the
   * one source, and one stream address for whatever token is asked, as before.
   */
  readonly profileSet?: FakeOnvifProfileSet;
}

export interface FakeOnvifRequest {
  readonly channel: 'discovery' | 'device' | 'rtsp';
  /** `UDP`, the HTTP method, or the RTSP method. */
  readonly method: string;
  /** The SOAP operation, `Probe`, or the RTSP method; `?` when it could not be read. */
  readonly operation: string;
  /** Was any authentication offered with the request (a header or a token)? Never its value. */
  readonly authPresent: boolean;
}

export interface FakeOnvifViolation {
  readonly code: 'OPERATION_NOT_ALLOWED' | 'PASSWORD_IN_CLEAR' | 'RTSP_METHOD_NOT_ALLOWED';
  readonly channel: 'device' | 'rtsp';
  readonly operation: string;
}

export interface FakeOnvifDevice {
  readonly endpointRef: string;
  readonly name: string;
  readonly hardware: string;
}

export interface FakeOnvifStub {
  start(): Promise<void>;
  /** Closes the three listeners and every open connection. */
  stop(): Promise<void>;
  /** Closes the device listener only: the next connection is refused (`UNREACHABLE` by refusal). */
  closeDeviceListener(): Promise<void>;
  /**
   * Opens the device listener again on its port after `closeDeviceListener()` (fix wave H: the lane
   * launcher switches a running stub between "reachable" and "unreachable"). Does nothing while it
   * listens; rejects before `start()` and with `FakeOnvifPortBusyError` when the port was taken.
   */
  openDeviceListener(): Promise<void>;
  setDiscoveryMode(mode: FakeOnvifDiscoveryMode): void;
  setDeviceMode(mode: FakeOnvifDeviceMode): void;
  setRtspMode(mode: FakeOnvifRtspMode): void;
  /**
   * Row 109. Throws on a stub built without `network`. MALFORMED_REPLY and OVERSIZED_REPLY shape the
   * reply of every network call, or of the one call named in `only`; a Set call is still OBEYED
   * (the device did it and answered badly). MARKUP_TOKEN and TWO_ENDPOINTS ignore `only`.
   */
  setNetworkMode(mode: FakeOnvifNetworkMode, only?: FakeOnvifNetworkOperation): void;
  /** Row 109. Throws on a stub built without `network`. */
  networkState(): FakeOnvifNetworkState;
  /** Row 109. The network requests that passed authentication, in order; empty without `network`. Cleared by `resetLog()`. */
  networkRequests(): readonly FakeOnvifNetworkRequest[];
  /** ST-2 "an answer nobody asked for": one ProbeMatches datagram to that socket, related to no Probe. */
  sendUnsolicited(target: { readonly address: string; readonly port: number }): Promise<void>;
  /** The devices that answer a Probe, in order. */
  devices(): readonly FakeOnvifDevice[];
  /** Where a test sends its unicast Probe, and the addresses the stub announces. */
  addresses(): {
    readonly discovery: { readonly address: string; readonly port: number };
    readonly deviceServiceUrl: string;
    readonly streamUri: string;
    /** What the three listeners are bound to, as the operating system reports it. */
    readonly bound: readonly { readonly listener: 'discovery' | 'device' | 'rtsp'; readonly address: string; readonly port: number }[];
  };
  requestLog(): readonly FakeOnvifRequest[];
  violations(): readonly FakeOnvifViolation[];
  resetLog(): void;
}

/** One ephemeral TCP port of 127.0.0.1: bound with port 0, read, released. */
function ephemeralTcpPort(): Promise<number> {
  return new Promise((resolvePromise, rejectPromise) => {
    const probe = createTcpServer();
    probe.once('error', rejectPromise);
    probe.listen({ host: FAKE_ONVIF_HOST, port: 0, exclusive: true }, () => {
      const address = probe.address();
      const port = address !== null && typeof address === 'object' ? address.port : 0;
      probe.close(() => resolvePromise(port));
    });
  });
}

function ephemeralUdpPort(): Promise<number> {
  return new Promise((resolvePromise, rejectPromise) => {
    const probe = createSocket({ type: 'udp4', reuseAddr: false });
    probe.once('error', rejectPromise);
    probe.bind({ address: FAKE_ONVIF_HOST, port: 0, exclusive: true }, () => {
      const { port } = probe.address();
      probe.close(() => resolvePromise(port));
    });
  });
}

/** How often one port is asked for again when the system hands out a number the stub refuses. Never reached in practice. */
const EPHEMERAL_ATTEMPTS = 16;

/**
 * Three EPHEMERAL ports of 127.0.0.1, handed out by the operating system (decision D170). Never a
 * port of the capture harnesses (8554-8564), never a port below the ephemeral floor: a number the
 * system should hand out there is not taken, the system is asked again. A test asks for them just
 * before `start()`; if another program takes one in between, `start()` rejects with
 * `FakeOnvifPortBusyError` - the stub does not look for another port by itself.
 */
export async function freeFakeOnvifPorts(): Promise<FakeOnvifPorts> {
  const usable = (port: number, taken: readonly number[]): boolean => Number.isInteger(port) && port >= FAKE_ONVIF_PORT_MIN && port <= FAKE_ONVIF_PORT_MAX && !isCaptureHarnessPort(port) && !taken.includes(port);
  const one = async (ask: () => Promise<number>, taken: readonly number[]): Promise<number> => {
    for (let attempt = 0; attempt < EPHEMERAL_ATTEMPTS; attempt += 1) {
      const port = await ask();
      if (usable(port, taken)) return port;
    }
    throw new Error(`fake ONVIF stub: the operating system handed out no usable ephemeral port on ${FAKE_ONVIF_HOST} (${FAKE_ONVIF_PORT_MIN}-${FAKE_ONVIF_PORT_MAX}, outside ${FAKE_ONVIF_HARNESS_PORT_MIN}-${FAKE_ONVIF_HARNESS_PORT_MAX})`);
  };
  const device = await one(ephemeralTcpPort, []);
  const rtsp = await one(ephemeralTcpPort, [device]);
  const discovery = await one(ephemeralUdpPort, []);
  return { discovery, device, rtsp };
}

function assertFixturePort(name: string, port: number): void {
  if (!Number.isInteger(port) || port < FAKE_ONVIF_PORT_MIN || port > FAKE_ONVIF_PORT_MAX || isCaptureHarnessPort(port)) {
    throw new RangeError(
      `fake ONVIF stub: the ${name} port must be an ephemeral port (an integer in ${FAKE_ONVIF_PORT_MIN}-${FAKE_ONVIF_PORT_MAX}) and never a port of the capture harnesses (${FAKE_ONVIF_HARNESS_PORT_MIN}-${FAKE_ONVIF_HARNESS_PORT_MAX}), got ${String(port)}`,
    );
  }
}

const md5 = (text: string): string => createHash('md5').update(text).digest('hex');

function xmlEscape(text: string): string {
  return text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
}

/** The text of the first element with that local name, whatever its prefix. */
function elementText(xml: string, localName: string): string | null {
  const match = new RegExp(`<(?:[\\w.-]+:)?${localName}(?:\\s[^>]*)?>([^<]*)</(?:[\\w.-]+:)?${localName}>`).exec(xml);
  return match?.[1]?.trim() ?? null;
}

function xmlUnescape(text: string): string {
  return text
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&quot;', '"')
    .replaceAll('&apos;', "'")
    .replace(/&#x([0-9a-fA-F]{1,6});/g, (_whole, hex: string) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#(\d{1,7});/g, (_whole, decimal: string) => String.fromCodePoint(Number(decimal)))
    .replaceAll('&amp;', '&');
}

const XML_NAME = '[A-Za-z_][\\w.-]*(?::[A-Za-z_][\\w.-]*)?';
const XML_ENTITY = /^&(?:amp|lt|gt|quot|apos|#\d{1,7}|#x[0-9a-fA-F]{1,6});/;
const DOTTED_IPV4 = /^(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.){3}(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)$/;

/**
 * Is this text ONE well-formed XML element with balanced tags, quoted attributes and no bare `&` or
 * stray `<`? A scanner for the stub's own judgement of a request (row 109), not an XML parser: it
 * accepts an XML declaration and comments, and refuses a DOCTYPE, CDATA and processing instructions
 * (no ONVIF request needs them). It does not check namespaces or duplicate attributes.
 */
export function isWellFormedXml(text: string): boolean {
  const entitiesOk = (chunk: string): boolean => {
    for (let at = chunk.indexOf('&'); at >= 0; at = chunk.indexOf('&', at + 1)) if (!XML_ENTITY.test(chunk.slice(at, at + 12))) return false;
    return true;
  };
  const closeTag = new RegExp(`</(${XML_NAME})\\s*>`, 'y');
  const openTag = new RegExp(`<(${XML_NAME})((?:\\s+${XML_NAME}\\s*=\\s*(?:"[^"<]*"|'[^'<]*'))*)\\s*(/?)>`, 'y');
  const open: string[] = [];
  let roots = 0;
  let at = /^\s*<\?xml\s[^?]*\?>/.exec(text)?.[0].length ?? 0;
  while (at < text.length) {
    const lt = text.indexOf('<', at);
    const chunk = text.slice(at, lt < 0 ? text.length : lt);
    if (!entitiesOk(chunk) || (open.length === 0 && chunk.trim() !== '')) return false;
    if (lt < 0) break;
    if (text.startsWith('<!--', lt)) {
      const end = text.indexOf('-->', lt + 4);
      if (end < 0) return false;
      at = end + 3;
      continue;
    }
    closeTag.lastIndex = lt;
    const closing = closeTag.exec(text);
    if (closing !== null) {
      if (open.pop() !== closing[1]) return false;
      at = closeTag.lastIndex;
      continue;
    }
    openTag.lastIndex = lt;
    const opening = openTag.exec(text);
    if (opening === null || !entitiesOk(opening[2] ?? '')) return false;
    if (open.length === 0) {
      roots += 1;
      if (roots > 1) return false;
    }
    if (opening[3] !== '/') open.push(opening[1] ?? '');
    at = openTag.lastIndex;
  }
  return roots === 1 && open.length === 0;
}

/** `key="value"` and `key=value` pairs of an HTTP or RTSP `Authorization: Digest ...` header. */
function digestFields(header: string): Map<string, string> {
  const fields = new Map<string, string>();
  for (const match of header.replace(/^Digest\s+/i, '').matchAll(/(\w+)=(?:"([^"]*)"|([^,\s]*))/g)) {
    const key = match[1];
    if (key !== undefined) fields.set(key.toLowerCase(), match[2] ?? match[3] ?? '');
  }
  return fields;
}

export function createFakeOnvifStub(options: FakeOnvifStubOptions): FakeOnvifStub {
  const { ports, credential } = options;
  assertFixturePort('discovery', ports.discovery);
  assertFixturePort('device', ports.device);
  assertFixturePort('rtsp', ports.rtsp);
  if (ports.device === ports.rtsp) throw new RangeError('fake ONVIF stub: the device and the RTSP listener need two TCP ports');
  if (credential.username.length === 0 || credential.secret.length === 0) throw new RangeError('fake ONVIF stub: a fixture credential is required');

  const deviceCount = options.devices ?? 1;
  const clockOffsetMs = options.clockOffsetMs ?? 0;
  const govLength = options.govLength ?? 50;
  const deviceList: FakeOnvifDevice[] = Array.from({ length: deviceCount }, (_unused, index) => ({
    endpointRef: `urn:uuid:${randomUUID()}`,
    name: `Fake Camera ${index + 1}`,
    hardware: 'FAKE-CAM-1',
  }));
  const deviceServiceUrl = `http://${FAKE_ONVIF_HOST}:${ports.device}/onvif/device_service`;
  const mediaServiceUrl = `http://${FAKE_ONVIF_HOST}:${ports.device}/onvif/media_service`;
  const streamUri = `rtsp://${FAKE_ONVIF_HOST}:${ports.rtsp}/stream1`;

  let discoveryMode: FakeOnvifDiscoveryMode = 'NORMAL';
  let deviceMode: FakeOnvifDeviceMode = 'NORMAL';
  let rtspMode: FakeOnvifRtspMode = 'H264';
  // Row 109: the network calls. `network === null` is every stub built before that row: nothing below is reached.
  const network = options.network ?? null;
  if (network !== null) {
    const prefix = network.prefixLength ?? FAKE_ONVIF_NETWORK_DEFAULTS.prefixLength;
    if (!DOTTED_IPV4.test(network.address ?? FAKE_ONVIF_NETWORK_DEFAULTS.address) || !DOTTED_IPV4.test(network.gateway ?? FAKE_ONVIF_NETWORK_DEFAULTS.gateway) || !Number.isInteger(prefix) || prefix < 1 || prefix > 32) {
      throw new RangeError('fake ONVIF stub: the network option needs dotted IPv4 addresses and a prefix length of 1 to 32');
    }
  }
  // Integration pass I-2: `profileSet === null` is every stub built before it: nothing it guards is reached.
  const profileSet = options.profileSet ?? null;
  let networkMode: FakeOnvifNetworkMode = 'NORMAL';
  let networkModeOnly: FakeOnvifNetworkOperation | null = null;
  let networkLog: FakeOnvifNetworkRequest[] = [];
  const twinEndpointRef = `urn:uuid:${randomUUID()}`;
  const networkNow = {
    address: network?.address ?? FAKE_ONVIF_NETWORK_DEFAULTS.address,
    prefixLength: network?.prefixLength ?? FAKE_ONVIF_NETWORK_DEFAULTS.prefixLength,
    dhcp: false,
    gateway: network?.gateway ?? FAKE_ONVIF_NETWORK_DEFAULTS.gateway,
    pending: null as FakeOnvifNetworkState['pending'],
    rebootCount: 0,
  };
  const interfaceToken = (): string => (networkMode === 'MARKUP_TOKEN' ? FAKE_ONVIF_MARKUP_TOKEN : FAKE_ONVIF_NETWORK_DEFAULTS.interfaceToken);
  let log: FakeOnvifRequest[] = [];
  let violationList: FakeOnvifViolation[] = [];
  const usedTokenNonces = new Set<string>();
  const issuedDigestNonces = new Set<string>();
  const openSockets = new Set<TcpSocket>();

  let udp: UdpSocket | null = null;
  let http: HttpServer | null = null;
  let rtsp: TcpServer | null = null;

  const now = (): number => Date.now() + clockOffsetMs;

  // ── Discovery ────────────────────────────────────────────────────────────────────────────────

  function probeMatch(device: FakeOnvifDevice, xaddrs: string | null): string {
    const scopes = [
      'onvif://www.onvif.org/Profile/Streaming',
      `onvif://www.onvif.org/hardware/${encodeURIComponent(device.hardware)}`,
      `onvif://www.onvif.org/name/${encodeURIComponent(device.name)}`,
      'onvif://www.onvif.org/location/fixture',
    ].join(' ');
    return (
      `<d:ProbeMatch><a:EndpointReference><a:Address>${device.endpointRef}</a:Address></a:EndpointReference>` +
      `<d:Types>dn:NetworkVideoTransmitter tds:Device</d:Types><d:Scopes>${scopes}</d:Scopes>` +
      (xaddrs === null ? '' : `<d:XAddrs>${xaddrs}</d:XAddrs>`) +
      `<d:MetadataVersion>1</d:MetadataVersion></d:ProbeMatch>`
    );
  }

  function probeMatches(relatesTo: string, matches: string, extra = '', doctype = ''): Buffer {
    return Buffer.from(
      `<?xml version="1.0" encoding="UTF-8"?>${doctype}` +
        `<s:Envelope xmlns:s="http://www.w3.org/2003/05/soap-envelope" xmlns:a="http://schemas.xmlsoap.org/ws/2004/08/addressing" ` +
        `xmlns:d="${WS_DISCOVERY_NAMESPACE}" xmlns:dn="http://www.onvif.org/ver10/network/wsdl" xmlns:tds="http://www.onvif.org/ver10/device/wsdl">` +
        `<s:Header><a:MessageID>urn:uuid:${randomUUID()}</a:MessageID><a:RelatesTo>${relatesTo}</a:RelatesTo>` +
        `<a:To>http://schemas.xmlsoap.org/ws/2004/08/addressing/role/anonymous</a:To><a:Action>${WS_DISCOVERY_PROBE_MATCHES_ACTION}</a:Action></s:Header>` +
        `<s:Body><d:ProbeMatches>${matches}</d:ProbeMatches>${extra}</s:Body></s:Envelope>`,
      'utf8',
    );
  }

  function answersFor(messageId: string): Buffer[] {
    const first = deviceList[0];
    switch (discoveryMode) {
      case 'SILENT':
        return [];
      case 'NORMAL':
        // Row 109, network mode TWO_ENDPOINTS: a second camera on the same (factory) address answers too.
        if (network !== null && networkMode === 'TWO_ENDPOINTS' && first !== undefined) {
          return [...deviceList, { ...first, endpointRef: twinEndpointRef }].map((device) => probeMatches(messageId, probeMatch(device, deviceServiceUrl)));
        }
        return deviceList.map((device) => probeMatches(messageId, probeMatch(device, deviceServiceUrl)));
      case 'WRONG_RELATES_TO':
        return deviceList.map((device) => probeMatches(`urn:uuid:${randomUUID()}`, probeMatch(device, deviceServiceUrl)));
      case 'FOREIGN_XADDR':
        return deviceList.map((device) => probeMatches(messageId, probeMatch(device, `http://${FAKE_ONVIF_FOREIGN_HOST}/onvif/device_service`)));
      case 'NO_XADDRS':
        return deviceList.map((device) => probeMatches(messageId, probeMatch(device, null)));
      case 'TWO_MATCHES_IN_ONE':
        return first === undefined
          ? []
          : [probeMatches(messageId, probeMatch(first, deviceServiceUrl) + probeMatch({ ...first, endpointRef: `urn:uuid:${randomUUID()}` }, deviceServiceUrl))];
      case 'EMPTY_MATCHES':
        return [probeMatches(messageId, '')];
      case 'OVERSIZED_BODY':
        return first === undefined ? [] : [probeMatches(messageId, probeMatch(first, deviceServiceUrl), `<!--${'x'.repeat(60 * 1024)}-->`)];
      case 'ENTITY_EXPANSION': {
        const doctype =
          '<!DOCTYPE s:Envelope [<!ENTITY a "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"><!ENTITY b "&a;&a;&a;&a;&a;&a;&a;&a;">' +
          '<!ENTITY c "&b;&b;&b;&b;&b;&b;&b;&b;"><!ENTITY e "&c;&c;&c;&c;&c;&c;&c;&c;">]>';
        return first === undefined ? [] : [probeMatches(messageId, probeMatch({ ...first, name: '&e;' }, deviceServiceUrl).replace('%26e%3B', '&e;'), '', doctype)];
      }
      case 'NOT_XML':
        return [Buffer.from(FAKE_ONVIF_NOT_XML_BODY)];
      case 'FLOOD_300':
        return Array.from({ length: 300 }, (_unused, index) =>
          probeMatches(messageId, probeMatch({ endpointRef: `urn:uuid:${randomUUID()}`, name: `Flood ${index}`, hardware: 'FLOOD' }, deviceServiceUrl)),
        );
    }
  }

  function sendDatagram(payload: Buffer, port: number, address: string): Promise<void> {
    return new Promise((resolvePromise, rejectPromise) => {
      if (udp === null) {
        rejectPromise(new Error('fake ONVIF stub: not started'));
        return;
      }
      udp.send(payload, port, address, (error) => (error ? rejectPromise(error) : resolvePromise()));
    });
  }

  function onDatagram(message: Buffer, remote: RemoteInfo): void {
    const text = message.toString('utf8');
    const isProbe = elementText(text, 'Action') === WS_DISCOVERY_PROBE_ACTION;
    log.push({ channel: 'discovery', method: 'UDP', operation: isProbe ? 'Probe' : '?', authPresent: /<(?:[\w.-]+:)?Security[\s>]/.test(text) });
    const messageId = elementText(text, 'MessageID');
    if (!isProbe || messageId === null) return;
    // A device answers the probes that name one of its types, and a probe with no Types at all.
    const types = elementText(text, 'Types') ?? '';
    if (types !== '' && !/(?:^|[\s:])(?:Device|NetworkVideoTransmitter)(?:\s|$)/.test(types)) return;
    for (const answer of answersFor(messageId)) {
      // Unicast to the source address and port of the Probe (WS-Discovery 1.1 §5.3.1). A send that the
      // operating system refuses (a datagram above its limit) is nothing the stub can report to a test.
      void sendDatagram(answer, remote.port, remote.address).catch(() => undefined);
    }
  }

  // ── Device and media services (SOAP over HTTP) ───────────────────────────────────────────────

  function envelope(body: string): string {
    return (
      `<?xml version="1.0" encoding="UTF-8"?><s:Envelope xmlns:s="http://www.w3.org/2003/05/soap-envelope" ` +
      `xmlns:tds="http://www.onvif.org/ver10/device/wsdl" xmlns:trt="http://www.onvif.org/ver10/media/wsdl" ` +
      `xmlns:tt="http://www.onvif.org/ver10/schema" xmlns:ter="http://www.onvif.org/ver10/error"><s:Body>${body}</s:Body></s:Envelope>`
    );
  }

  function fault(code: 'Sender' | 'Receiver', subcode: string, reason: string): string {
    return envelope(
      `<s:Fault><s:Code><s:Value>s:${code}</s:Value><s:Subcode><s:Value>ter:${subcode}</s:Value></s:Subcode></s:Code>` +
        `<s:Reason><s:Text xml:lang="en">${xmlEscape(reason)}</s:Text></s:Reason></s:Fault>`,
    );
  }

  function reply(response: ServerResponse, status: number, xml: string, headers: Record<string, string> = {}): void {
    response.writeHead(status, { 'Content-Type': 'application/soap+xml; charset=utf-8', 'Content-Length': Buffer.byteLength(xml), Connection: 'close', ...headers });
    response.end(xml);
  }

  function digestChallenge(): string {
    const nonce = randomBytes(16).toString('hex');
    issuedDigestNonces.add(nonce);
    return `Digest realm="${DIGEST_REALM}", nonce="${nonce}", qop="auth", algorithm=MD5`;
  }

  /** RFC 2617 response check for HTTP (qop=auth) and RTSP (no qop). */
  function digestValid(header: string, method: string): boolean {
    const fields = digestFields(header);
    const nonce = fields.get('nonce') ?? '';
    if (fields.get('username') !== credential.username || !issuedDigestNonces.has(nonce)) return false;
    const ha1 = md5(`${credential.username}:${DIGEST_REALM}:${credential.secret}`);
    const ha2 = md5(`${method}:${fields.get('uri') ?? ''}`);
    const expected = fields.has('qop')
      ? md5(`${ha1}:${nonce}:${fields.get('nc') ?? ''}:${fields.get('cnonce') ?? ''}:${fields.get('qop') ?? ''}:${ha2}`)
      : md5(`${ha1}:${nonce}:${ha2}`);
    return expected === fields.get('response');
  }

  /** `'CLEAR'` when the request offered the password itself; otherwise whether a digest token holds. */
  function tokenState(xml: string): 'NONE' | 'VALID' | 'INVALID' | 'CLEAR' {
    if (!/<(?:[\w.-]+:)?UsernameToken[\s>]/.test(xml)) return 'NONE';
    const passwordTag = /<(?:[\w.-]+:)?Password(\s[^>]*)?>([^<]*)</.exec(xml);
    const type = /Type\s*=\s*"([^"]*)"/.exec(passwordTag?.[1] ?? '')?.[1] ?? '';
    if (passwordTag === null || type !== PASSWORD_DIGEST_TYPE) return 'CLEAR';
    const username = elementText(xml, 'Username');
    const nonce = elementText(xml, 'Nonce');
    const created = elementText(xml, 'Created');
    if (username !== credential.username || nonce === null || created === null) return 'INVALID';
    const createdAt = Date.parse(created);
    if (!Number.isFinite(createdAt) || Math.abs(createdAt - now()) > TOKEN_CLOCK_WINDOW_MS || usedTokenNonces.has(nonce)) return 'INVALID';
    const expected = createHash('sha1')
      .update(Buffer.concat([Buffer.from(nonce, 'base64'), Buffer.from(created, 'utf8'), Buffer.from(credential.secret, 'utf8')]))
      .digest('base64');
    if (expected !== (passwordTag[2] ?? '').trim()) return 'INVALID';
    usedTokenNonces.add(nonce);
    return 'VALID';
  }

  function profilesXml(): string {
    if (deviceMode === 'NO_PROFILE') return '<trt:GetProfilesResponse/>';
    const encoding = deviceMode === 'H265_ONLY' ? 'H265' : 'H264';
    if (profileSet !== null) {
      // Integration pass I-2: two video sources, several profiles each; the encoder element is the one of the single profile below.
      return `<trt:GetProfilesResponse>${FAKE_ONVIF_TWO_SOURCE_PROFILES.map(
        (profile, index) =>
          `<trt:Profiles token="${xmlEscape(profile.token)}" fixed="true"><tt:Name>profile ${index + 1}</tt:Name>` +
          `<tt:VideoSourceConfiguration token="vsc_${index + 1}"><tt:Name>source</tt:Name><tt:SourceToken>${xmlEscape(profile.videoSourceToken)}</tt:SourceToken></tt:VideoSourceConfiguration>` +
          `<tt:VideoEncoderConfiguration token="vec_${index + 1}"><tt:Name>encoder</tt:Name><tt:Encoding>${encoding}</tt:Encoding>` +
          `<tt:Resolution><tt:Width>${profile.width}</tt:Width><tt:Height>${profile.height}</tt:Height></tt:Resolution>` +
          `<tt:RateControl><tt:FrameRateLimit>25</tt:FrameRateLimit><tt:EncodingInterval>1</tt:EncodingInterval><tt:BitrateLimit>4096</tt:BitrateLimit></tt:RateControl>` +
          `<tt:${encoding}><tt:GovLength>${govLength}</tt:GovLength></tt:${encoding}></tt:VideoEncoderConfiguration></trt:Profiles>`,
      ).join('')}</trt:GetProfilesResponse>`;
    }
    return (
      `<trt:GetProfilesResponse><trt:Profiles token="profile_1" fixed="true"><tt:Name>main</tt:Name>` +
      `<tt:VideoSourceConfiguration token="vsc_1"><tt:Name>source</tt:Name><tt:SourceToken>vs_1</tt:SourceToken></tt:VideoSourceConfiguration>` +
      `<tt:VideoEncoderConfiguration token="vec_1"><tt:Name>encoder</tt:Name><tt:Encoding>${encoding}</tt:Encoding>` +
      `<tt:Resolution><tt:Width>1920</tt:Width><tt:Height>1080</tt:Height></tt:Resolution>` +
      `<tt:RateControl><tt:FrameRateLimit>25</tt:FrameRateLimit><tt:EncodingInterval>1</tt:EncodingInterval><tt:BitrateLimit>4096</tt:BitrateLimit></tt:RateControl>` +
      `<tt:${encoding === 'H264' ? 'H264' : 'H265'}><tt:GovLength>${govLength}</tt:GovLength></tt:${encoding === 'H264' ? 'H264' : 'H265'}>` +
      `</tt:VideoEncoderConfiguration></trt:Profiles></trt:GetProfilesResponse>`
    );
  }

  function operationXml(operation: string): string {
    switch (operation) {
      case 'GetSystemDateAndTime': {
        const t = new Date(now());
        return (
          `<tds:GetSystemDateAndTimeResponse><tds:SystemDateAndTime><tt:DateTimeType>NTP</tt:DateTimeType><tt:DaylightSavings>false</tt:DaylightSavings>` +
          `<tt:TimeZone><tt:TZ>UTC0</tt:TZ></tt:TimeZone><tt:UTCDateTime><tt:Time><tt:Hour>${t.getUTCHours()}</tt:Hour><tt:Minute>${t.getUTCMinutes()}</tt:Minute>` +
          `<tt:Second>${t.getUTCSeconds()}</tt:Second></tt:Time><tt:Date><tt:Year>${t.getUTCFullYear()}</tt:Year><tt:Month>${t.getUTCMonth() + 1}</tt:Month>` +
          `<tt:Day>${t.getUTCDate()}</tt:Day></tt:Date></tt:UTCDateTime></tds:SystemDateAndTime></tds:GetSystemDateAndTimeResponse>`
        );
      }
      case 'GetServices':
        return (
          `<tds:GetServicesResponse>` +
          `<tds:Service><tds:Namespace>http://www.onvif.org/ver10/device/wsdl</tds:Namespace><tds:XAddr>${deviceServiceUrl}</tds:XAddr><tds:Version><tt:Major>2</tt:Major><tt:Minor>6</tt:Minor></tds:Version></tds:Service>` +
          `<tds:Service><tds:Namespace>http://www.onvif.org/ver10/media/wsdl</tds:Namespace><tds:XAddr>${mediaServiceUrl}</tds:XAddr><tds:Version><tt:Major>2</tt:Major><tt:Minor>6</tt:Minor></tds:Version></tds:Service>` +
          `</tds:GetServicesResponse>`
        );
      case 'GetCapabilities':
        return (
          `<tds:GetCapabilitiesResponse><tds:Capabilities><tt:Device><tt:XAddr>${deviceServiceUrl}</tt:XAddr></tt:Device>` +
          `<tt:Media><tt:XAddr>${mediaServiceUrl}</tt:XAddr></tt:Media></tds:Capabilities></tds:GetCapabilitiesResponse>`
        );
      case 'GetProfiles':
        return profilesXml();
      default: {
        // GetStreamUri
        const uri = deviceMode === 'FOREIGN_STREAM_HOST' ? `rtsp://${FAKE_ONVIF_FOREIGN_HOST}:554/stream1` : streamUri;
        return (
          `<trt:GetStreamUriResponse><trt:MediaUri><tt:Uri>${uri}</tt:Uri><tt:InvalidAfterConnect>false</tt:InvalidAfterConnect>` +
          `<tt:InvalidAfterReboot>false</tt:InvalidAfterReboot><tt:Timeout>PT60S</tt:Timeout></trt:MediaUri></trt:GetStreamUriResponse>`
        );
      }
    }
  }

  // ── The network calls (row 109) ──────────────────────────────────────────────────────────────

  const isNetworkCall = (operation: string): operation is FakeOnvifNetworkRequest['operation'] =>
    network !== null && ((FAKE_ONVIF_NETWORK_OPERATIONS as readonly string[]).includes(operation) || (network.gatewayReadBack === true && operation === FAKE_ONVIF_GATEWAY_READ_BACK_OPERATION));

  function applyPending(): void {
    if (networkNow.pending === null) return;
    networkNow.address = networkNow.pending.address;
    networkNow.prefixLength = networkNow.pending.prefixLength;
    networkNow.dhcp = networkNow.pending.dhcp;
    networkNow.pending = null;
  }

  /** An authenticated network request: judged, recorded, obeyed, then answered in the shape the mode asks for. */
  function answerNetwork(operation: FakeOnvifNetworkRequest['operation'], xml: string, request: IncomingMessage, response: ServerResponse): void {
    const record = { operation, wellFormed: isWellFormedXml(xml), accepted: false, refusal: null as FakeOnvifNetworkRequest['refusal'], address: null as string | null, prefixLength: null as number | null, dhcp: null as boolean | null, gateway: null as string | null };
    networkLog.push(record);
    const refuse = (refusal: NonNullable<FakeOnvifNetworkRequest['refusal']>, subcode: string, reason: string): void => {
      record.refusal = refusal;
      reply(response, 400, fault('Sender', subcode, reason));
    };
    if (!record.wellFormed) {
      refuse('NOT_WELL_FORMED', 'WellFormed', 'the request is not well-formed XML');
      return;
    }
    let body: string;
    switch (operation) {
      case 'GetNetworkInterfaces':
        body =
          `<tds:GetNetworkInterfacesResponse><tds:NetworkInterfaces token="${xmlEscape(interfaceToken())}"><tt:Enabled>true</tt:Enabled>` +
          `<tt:Info><tt:Name>eth0</tt:Name><tt:HwAddress>${xmlEscape(network?.hwAddress ?? FAKE_ONVIF_NETWORK_DEFAULTS.hwAddress)}</tt:HwAddress><tt:MTU>1500</tt:MTU></tt:Info>` +
          `<tt:IPv4><tt:Enabled>true</tt:Enabled><tt:Config><tt:Manual><tt:Address>${networkNow.address}</tt:Address><tt:PrefixLength>${networkNow.prefixLength}</tt:PrefixLength></tt:Manual>` +
          `<tt:DHCP>${String(networkNow.dhcp)}</tt:DHCP></tt:Config></tt:IPv4></tds:NetworkInterfaces></tds:GetNetworkInterfacesResponse>`;
        break;
      case 'SetNetworkInterfaces': {
        const token = /<(?:[\w.-]+:)?InterfaceToken(?:\s[^>]*)?>([^<]*)</.exec(xml)?.[1];
        const address = elementText(xml, 'Address');
        const prefix = Number(elementText(xml, 'PrefixLength') ?? Number.NaN);
        const dhcp = elementText(xml, 'DHCP') === 'true';
        record.dhcp = dhcp;
        record.address = address !== null && DOTTED_IPV4.test(address) ? address : null;
        record.prefixLength = Number.isInteger(prefix) ? prefix : null;
        // The token is compared as the text the element holds once unescaped, with nothing trimmed.
        if (token === undefined || xmlUnescape(token) !== interfaceToken()) {
          refuse('INTERFACE_TOKEN_UNKNOWN', 'InvalidNetworkInterfaceToken', 'the interface token is not one of this device');
          return;
        }
        if (!dhcp && (record.address === null || record.prefixLength === null || record.prefixLength < 1 || record.prefixLength > 32)) {
          refuse('ADDRESS_INVALID', 'InvalidIPv4Address', 'a manual IPv4 address and a prefix length are required');
          return;
        }
        const rebootNeeded = network?.rebootNeeded ?? true;
        networkNow.pending = { address: dhcp ? networkNow.address : (record.address ?? networkNow.address), prefixLength: dhcp ? networkNow.prefixLength : (record.prefixLength ?? networkNow.prefixLength), dhcp };
        if (!rebootNeeded) applyPending();
        body = `<tds:SetNetworkInterfacesResponse><tds:RebootNeeded>${String(rebootNeeded)}</tds:RebootNeeded></tds:SetNetworkInterfacesResponse>`;
        break;
      }
      case 'SetNetworkDefaultGateway': {
        const gateway = elementText(xml, 'IPv4Address');
        record.gateway = gateway !== null && DOTTED_IPV4.test(gateway) ? gateway : null;
        if (network?.gatewayFault === true || record.gateway === null) {
          refuse('GATEWAY_REFUSED', 'InvalidGatewayAddress', 'the gateway address is not accepted');
          return;
        }
        networkNow.gateway = record.gateway;
        body = '<tds:SetNetworkDefaultGatewayResponse/>';
        break;
      }
      case 'GetNetworkDefaultGateway':
        body = `<tds:GetNetworkDefaultGatewayResponse><tds:NetworkGateway><tt:IPv4Address>${networkNow.gateway}</tt:IPv4Address></tds:NetworkGateway></tds:GetNetworkDefaultGatewayResponse>`;
        break;
      case 'SystemReboot':
        networkNow.rebootCount += 1;
        applyPending();
        if (network?.rebootDropsConnection === true) {
          record.accepted = true;
          request.socket.destroy(); // obeyed, and the camera is gone before it answers
          return;
        }
        body = '<tds:SystemRebootResponse><tds:Message>Rebooting</tds:Message></tds:SystemRebootResponse>';
        break;
    }
    record.accepted = true;
    const shaped = networkModeOnly === null || networkModeOnly === operation ? networkMode : 'NORMAL';
    if (shaped === 'MALFORMED_REPLY') {
      const whole = envelope(body);
      reply(response, 200, `${whole.slice(0, whole.indexOf('<s:Body>') + 8 + Math.floor(body.length / 2))}<tt:Cut attr=>`);
    } else if (shaped === 'OVERSIZED_REPLY') {
      reply(response, 200, envelope(`${body}<!--${'x'.repeat(FAKE_ONVIF_OVERSIZED_REPLY_BYTES)}-->`));
    } else {
      reply(response, 200, envelope(body));
    }
  }

  function onHttp(request: IncomingMessage, response: ServerResponse): void {
    const chunks: Buffer[] = [];
    let size = 0;
    request.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > 256 * 1024) request.destroy();
      else chunks.push(chunk);
    });
    request.on('end', () => {
      const xml = Buffer.concat(chunks).toString('utf8');
      const operation = /<(?:[\w.-]+:)?Body(?:\s[^>]*)?>\s*<(?:[\w.-]+:)?(\w+)/.exec(xml)?.[1] ?? '?';
      const authorization = request.headers.authorization ?? '';
      const token = tokenState(xml);
      log.push({ channel: 'device', method: request.method ?? '?', operation, authPresent: authorization !== '' || token !== 'NONE' });
      if (deviceMode === 'NO_ANSWER') return; // the connection stays open until the client gives up or the stub stops

      // A password in clear is recorded whatever else is true of the request (CT-1: it must never be sent).
      const clear = /^Basic\s/i.test(authorization) || token === 'CLEAR';
      if (clear) violationList.push({ code: 'PASSWORD_IN_CLEAR', channel: 'device', operation });
      const networkCall = isNetworkCall(operation) ? operation : null; // row 109: null on every stub built without `network`
      if (networkCall === null && !(FAKE_ONVIF_ALLOWED_OPERATIONS as readonly string[]).includes(operation)) {
        violationList.push({ code: 'OPERATION_NOT_ALLOWED', channel: 'device', operation });
        reply(response, 400, fault('Sender', 'ActionNotSupported', 'the fixture serves the read-only list of the connection test only'));
        return;
      }
      if (!PRE_AUTH_OPERATIONS.includes(operation)) {
        if (deviceMode === 'BASIC_ONLY') {
          reply(response, 401, fault('Sender', 'NotAuthorized', 'authentication required'), { 'WWW-Authenticate': `Basic realm="${DIGEST_REALM}"` });
          return;
        }
        const authenticated = !clear && (token === 'VALID' || (/^Digest\s/i.test(authorization) && digestValid(authorization, request.method ?? 'POST')));
        if (!authenticated) {
          reply(response, 401, fault('Sender', 'NotAuthorized', 'sender not authorized'), { 'WWW-Authenticate': digestChallenge() });
          return;
        }
      }
      if (networkCall !== null) {
        answerNetwork(networkCall, xml, request, response);
        return;
      }
      // Integration pass I-2: with a profile set the stream address is the asked profile's own; a token the
      // device does not list is a fault. (The mode FOREIGN_STREAM_HOST keeps its one foreign address.)
      if (profileSet !== null && operation === 'GetStreamUri' && deviceMode !== 'FOREIGN_STREAM_HOST') {
        const asked = xmlUnescape(elementText(xml, 'ProfileToken') ?? '');
        const profile = FAKE_ONVIF_TWO_SOURCE_PROFILES.find((entry) => entry.token === asked);
        if (profile === undefined) {
          reply(response, 400, fault('Sender', 'NoProfile', 'the fixture lists no profile with that token'));
          return;
        }
        reply(
          response,
          200,
          envelope(
            `<trt:GetStreamUriResponse><trt:MediaUri><tt:Uri>${fakeOnvifProfileStreamUri(ports.rtsp, profile)}</tt:Uri><tt:InvalidAfterConnect>false</tt:InvalidAfterConnect>` +
              `<tt:InvalidAfterReboot>false</tt:InvalidAfterReboot><tt:Timeout>PT60S</tt:Timeout></trt:MediaUri></trt:GetStreamUriResponse>`,
          ),
        );
        return;
      }
      reply(response, 200, envelope(operationXml(operation)));
    });
  }

  // ── RTSP responder ───────────────────────────────────────────────────────────────────────────

  function sdp(): string {
    const video =
      rtspMode === 'H265'
        ? ['m=video 0 RTP/AVP 96', 'a=rtpmap:96 H265/90000', 'a=control:trackID=1']
        : [
            'm=video 0 RTP/AVP 96',
            'a=rtpmap:96 H264/90000',
            rtspMode === 'H264_NO_PARAMETER_SETS'
              ? 'a=fmtp:96 packetization-mode=1;profile-level-id=42e01f'
              : 'a=fmtp:96 packetization-mode=1;profile-level-id=42e01f;sprop-parameter-sets=Z0LgH9oBQBbpqAgICgAAAwACAAADAGQeMGVA,aM4xUg==',
            'a=control:trackID=1',
          ];
    return ['v=0', `o=- 0 0 IN IP4 ${FAKE_ONVIF_HOST}`, 's=fake', `c=IN IP4 ${FAKE_ONVIF_HOST}`, 't=0 0', ...video, ''].join('\r\n');
  }

  function onRtspRequest(socket: TcpSocket, head: string): void {
    const lines = head.split('\r\n');
    const method = /^([A-Z_]+)\s+\S+\s+RTSP\/1\.0$/.exec(lines[0] ?? '')?.[1] ?? '?';
    const header = (name: string): string => {
      const line = lines.find((entry) => entry.toLowerCase().startsWith(`${name.toLowerCase()}:`));
      return line === undefined ? '' : line.slice(name.length + 1).trim();
    };
    const authorization = header('Authorization');
    const cseq = header('CSeq') || '0';
    log.push({ channel: 'rtsp', method, operation: method, authPresent: authorization !== '' });
    const send = (status: string, headers: string[], body = ''): void => {
      socket.write([`RTSP/1.0 ${status}`, `CSeq: ${cseq}`, ...headers, ...(body === '' ? [] : ['Content-Type: application/sdp', `Content-Length: ${Buffer.byteLength(body)}`]), '', body].join('\r\n'));
    };
    if (!RTSP_ALLOWED_METHODS.includes(method)) {
      // CT-2: a connection test never sets up a media session. SETUP or PLAY fails the test that caused it.
      violationList.push({ code: 'RTSP_METHOD_NOT_ALLOWED', channel: 'rtsp', operation: method });
      send('405 Method Not Allowed', ['Allow: OPTIONS, DESCRIBE']);
      return;
    }
    if (method === 'OPTIONS') {
      send('200 OK', ['Public: OPTIONS, DESCRIBE']);
      return;
    }
    if (/^Basic\s/i.test(authorization)) violationList.push({ code: 'PASSWORD_IN_CLEAR', channel: 'rtsp', operation: method });
    if (options.rtspDigest === true && !(/^Digest\s/i.test(authorization) && digestValid(authorization, method))) {
      const nonce = randomBytes(16).toString('hex');
      issuedDigestNonces.add(nonce);
      send('401 Unauthorized', [`WWW-Authenticate: Digest realm="${DIGEST_REALM}", nonce="${nonce}"`]);
      return;
    }
    send('200 OK', [`Content-Base: ${streamUri}/`], sdp());
  }

  function onRtspConnection(socket: TcpSocket): void {
    let buffered = '';
    socket.setEncoding('utf8');
    socket.on('data', (chunk: string) => {
      buffered += chunk;
      if (buffered.length > 64 * 1024) {
        socket.destroy();
        return;
      }
      for (let end = buffered.indexOf('\r\n\r\n'); end >= 0; end = buffered.indexOf('\r\n\r\n')) {
        const head = buffered.slice(0, end);
        buffered = buffered.slice(end + 4);
        onRtspRequest(socket, head);
      }
    });
    socket.on('error', () => undefined);
  }

  // ── Lifecycle ────────────────────────────────────────────────────────────────────────────────

  function track(server: HttpServer | TcpServer): void {
    server.on('connection', (socket: TcpSocket) => {
      openSockets.add(socket);
      socket.on('close', () => openSockets.delete(socket));
    });
  }

  function listenTcp(server: HttpServer | TcpServer, port: number, listener: 'device' | 'rtsp'): Promise<void> {
    return new Promise((resolvePromise, rejectPromise) => {
      const failed = (error: NodeJS.ErrnoException): void => rejectPromise(error.code === 'EADDRINUSE' ? new FakeOnvifPortBusyError(listener, port, error) : error);
      server.once('error', failed);
      server.listen({ host: FAKE_ONVIF_HOST, port, exclusive: true }, () => {
        server.off('error', failed);
        resolvePromise();
      });
    });
  }

  function closeServer(server: HttpServer | TcpServer | null): Promise<void> {
    return new Promise((resolvePromise) => {
      if (server === null || !server.listening) resolvePromise();
      else server.close(() => resolvePromise());
    });
  }

  return {
    async start() {
      if (udp !== null || http !== null || rtsp !== null) throw new Error('fake ONVIF stub: already started');
      try {
        const socket = createSocket({ type: 'udp4', reuseAddr: false });
        udp = socket;
        await new Promise<void>((resolvePromise, rejectPromise) => {
          const failed = (error: NodeJS.ErrnoException): void => rejectPromise(error.code === 'EADDRINUSE' ? new FakeOnvifPortBusyError('discovery', ports.discovery, error) : error);
          socket.once('error', failed);
          socket.bind({ address: FAKE_ONVIF_HOST, port: ports.discovery, exclusive: true }, () => {
            socket.off('error', failed);
            resolvePromise();
          });
        });
        socket.on('error', () => undefined);
        // The 60 KiB answer of ST-2 needs a send buffer above the default datagram limit of this platform.
        socket.setSendBufferSize(256 * 1024);
        socket.on('message', onDatagram);
        http = createHttpServer(onHttp);
        track(http);
        await listenTcp(http, ports.device, 'device');
        rtsp = createTcpServer(onRtspConnection);
        track(rtsp);
        await listenTcp(rtsp, ports.rtsp, 'rtsp');
      } catch (error) {
        await this.stop();
        throw error;
      }
    },
    async stop() {
      for (const socket of openSockets) socket.destroy();
      openSockets.clear();
      const socket = udp;
      udp = null;
      if (socket !== null) {
        await new Promise<void>((resolvePromise) => {
          try {
            socket.close(() => resolvePromise());
          } catch {
            resolvePromise(); // it was never bound
          }
        });
      }
      await closeServer(http);
      await closeServer(rtsp);
      http = null;
      rtsp = null;
    },
    async closeDeviceListener() {
      for (const socket of openSockets) if (socket.localPort === ports.device) socket.destroy();
      await closeServer(http);
    },
    async openDeviceListener() {
      if (udp === null) throw new Error('fake ONVIF stub: not started');
      if (http !== null && http.listening) return;
      const server = createHttpServer(onHttp);
      track(server);
      await listenTcp(server, ports.device, 'device');
      http = server;
    },
    setDiscoveryMode(mode) {
      discoveryMode = mode;
    },
    setDeviceMode(mode) {
      deviceMode = mode;
    },
    setRtspMode(mode) {
      rtspMode = mode;
    },
    setNetworkMode(mode, only) {
      if (network === null) throw new Error('fake ONVIF stub: built without the network option, it answers no network call');
      networkMode = mode;
      networkModeOnly = only ?? null;
    },
    networkState() {
      if (network === null) throw new Error('fake ONVIF stub: built without the network option, it answers no network call');
      return {
        interfaceToken: interfaceToken(),
        hwAddress: network.hwAddress ?? FAKE_ONVIF_NETWORK_DEFAULTS.hwAddress,
        address: networkNow.address,
        prefixLength: networkNow.prefixLength,
        dhcp: networkNow.dhcp,
        gateway: networkNow.gateway,
        pending: networkNow.pending,
        rebootCount: networkNow.rebootCount,
        twinEndpointRef,
      };
    },
    networkRequests() {
      return networkLog;
    },
    async sendUnsolicited(target) {
      const first = deviceList[0] ?? { endpointRef: `urn:uuid:${randomUUID()}`, name: 'Unasked', hardware: 'FAKE-CAM-1' };
      await sendDatagram(probeMatches(`urn:uuid:${randomUUID()}`, probeMatch(first, deviceServiceUrl)), target.port, target.address);
    },
    devices() {
      return deviceList;
    },
    addresses() {
      const bound: { listener: 'discovery' | 'device' | 'rtsp'; address: string; port: number }[] = [];
      if (udp !== null) bound.push({ listener: 'discovery', address: udp.address().address, port: udp.address().port });
      for (const [listener, server] of [['device', http], ['rtsp', rtsp]] as const) {
        const address = server?.address();
        if (address !== null && address !== undefined && typeof address !== 'string') bound.push({ listener, address: address.address, port: address.port });
      }
      return { discovery: { address: FAKE_ONVIF_HOST, port: ports.discovery }, deviceServiceUrl, streamUri, bound };
    },
    requestLog() {
      return log;
    },
    violations() {
      return violationList;
    },
    resetLog() {
      log = [];
      violationList = [];
      networkLog = [];
    },
  };
}
