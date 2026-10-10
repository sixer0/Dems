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
      if (!(FAKE_ONVIF_ALLOWED_OPERATIONS as readonly string[]).includes(operation)) {
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
    },
  };
}
