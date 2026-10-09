/**
 * A scripted ONVIF device for the hostile and the odd answers (blueprint row 142; security review
 * SEC35-31, SEC35-33, SEC35-38; checks M4-SEC-CONN-1 to M4-SEC-CONN-3; not a test file, nothing
 * here imports Vitest).
 *
 * The fake ONVIF stub of row 60 (`fake-onvif-stub.ts`) is the well-behaved fixture camera and is
 * closed. This file is what it does not have: a device whose every answer the TEST writes - an
 * endless body, a body that drips, an answer that never comes, a redirect, a one-element service
 * list, a missing element, a device that takes the token form only. One HTTP listener on the
 * literal 127.0.0.1, on a port of the fixture range the test chooses.
 *
 * UNLIKE THE STUB IT KEEPS WHAT IT RECEIVED: `requests()` holds every request with its
 * `Authorization` header and its whole body, so that a test can prove what did NOT travel (a
 * password in clear, its base64 form). That is test memory of a fixture credential on loopback;
 * nothing here writes a file or a log line.
 */
import { createHash } from 'node:crypto';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import type { Socket } from 'node:net';

export const ODD_DEVICE_HOST = '127.0.0.1';
/** The fixture ports this device may take (D94: media fixtures stay on these); the stub looks from the top of the range, this from the middle. */
export const ODD_DEVICE_PORTS: readonly number[] = [8561, 8560, 8559, 8557, 8555];
/** A documentation address (RFC 5737): the "other host" of a redirect or a stream address. Never contacted. */
export const ODD_DEVICE_FOREIGN_HOST = '192.0.2.10';

const PASSWORD_DIGEST_TYPE = 'http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-username-token-profile-1.0#PasswordDigest';

export interface OddDeviceRequest {
  /** The SOAP operation of the body, or `?`. */
  readonly operation: string;
  /** The `Authorization` header as received, or ''. */
  readonly authorization: string;
  /** The whole request body as received. */
  readonly body: string;
  /** True when the body holds a WS-Security `UsernameToken`. */
  readonly token: boolean;
}

export type OddDeviceReply =
  | { readonly kind: 'ANSWER'; readonly status: number; readonly body: string; readonly headers?: Readonly<Record<string, string>> }
  /** The connection is accepted and never answered. */
  | { readonly kind: 'HANG' }
  /** A 200 answer whose body never ends: `chunkBytes` every turn of the event loop until the peer closes. */
  | { readonly kind: 'FLOOD'; readonly chunkBytes: number }
  /** A 200 answer that sends one byte every `intervalMs` and never ends. */
  | { readonly kind: 'DRIP'; readonly intervalMs: number };

export interface OddOnvifDevice {
  start(): Promise<void>;
  stop(): Promise<void>;
  readonly port: number;
  /** `http://127.0.0.1:<port>/onvif/device_service` */
  readonly serviceUrl: string;
  requests(): readonly OddDeviceRequest[];
  /** Bytes this device wrote to its sockets since the start. */
  bytesSent(): number;
  reset(): void;
}

/** One port of `ODD_DEVICE_PORTS` that is free on loopback right now. */
export async function freeOddDevicePort(): Promise<number> {
  for (const port of ODD_DEVICE_PORTS) {
    const free = await new Promise<boolean>((resolvePromise) => {
      const probe = createServer();
      probe.once('error', () => resolvePromise(false));
      probe.listen({ host: ODD_DEVICE_HOST, port, exclusive: true }, () => probe.close(() => resolvePromise(true)));
    });
    if (free) return port;
  }
  throw new Error(`odd ONVIF device: no free port among ${ODD_DEVICE_PORTS.join(', ')} on ${ODD_DEVICE_HOST}`);
}

// ── Answers a script can use ─────────────────────────────────────────────────────────────────────

export function soapEnvelope(body: string): string {
  return (
    `<?xml version="1.0" encoding="UTF-8"?><s:Envelope xmlns:s="http://www.w3.org/2003/05/soap-envelope" ` +
    `xmlns:tds="http://www.onvif.org/ver10/device/wsdl" xmlns:trt="http://www.onvif.org/ver10/media/wsdl" ` +
    `xmlns:tt="http://www.onvif.org/ver10/schema" xmlns:ter="http://www.onvif.org/ver10/error"><s:Body>${body}</s:Body></s:Envelope>`
  );
}

export const ok = (body: string): OddDeviceReply => ({ kind: 'ANSWER', status: 200, body: soapEnvelope(body) });

export function notAuthorizedFault(status = 400, headers: Readonly<Record<string, string>> = {}): OddDeviceReply {
  return {
    kind: 'ANSWER',
    status,
    headers,
    body: soapEnvelope(
      `<s:Fault><s:Code><s:Value>s:Sender</s:Value><s:Subcode><s:Value>ter:NotAuthorized</s:Value></s:Subcode></s:Code>` +
        `<s:Reason><s:Text xml:lang="en">Sender not authorized</s:Text></s:Reason></s:Fault>`,
    ),
  };
}

export function dateAnswer(at: Date = new Date()): OddDeviceReply {
  return ok(
    `<tds:GetSystemDateAndTimeResponse><tds:SystemDateAndTime><tt:DateTimeType>NTP</tt:DateTimeType><tt:DaylightSavings>false</tt:DaylightSavings>` +
      `<tt:TimeZone><tt:TZ>UTC0</tt:TZ></tt:TimeZone><tt:UTCDateTime><tt:Time><tt:Hour>${at.getUTCHours()}</tt:Hour><tt:Minute>${at.getUTCMinutes()}</tt:Minute>` +
      `<tt:Second>${at.getUTCSeconds()}</tt:Second></tt:Time><tt:Date><tt:Year>${at.getUTCFullYear()}</tt:Year><tt:Month>${at.getUTCMonth() + 1}</tt:Month>` +
      `<tt:Day>${at.getUTCDate()}</tt:Day></tt:Date></tt:UTCDateTime></tds:SystemDateAndTime></tds:GetSystemDateAndTimeResponse>`,
  );
}

const service = (namespace: string, address: string): string =>
  `<tds:Service><tds:Namespace>${namespace}</tds:Namespace><tds:XAddr>${address}</tds:XAddr><tds:Version><tt:Major>2</tt:Major><tt:Minor>6</tt:Minor></tds:Version></tds:Service>`;

/** `GetServices` with the device and the media service; `mediaOnly` answers the ONE-element list of finding P-12. */
export function servicesAnswer(base: string, mediaOnly = false): OddDeviceReply {
  const media = service('http://www.onvif.org/ver10/media/wsdl', `${base}/onvif/media_service`);
  return ok(`<tds:GetServicesResponse>${mediaOnly ? '' : service('http://www.onvif.org/ver10/device/wsdl', `${base}/onvif/device_service`)}${media}</tds:GetServicesResponse>`);
}

export function capabilitiesAnswer(base: string): OddDeviceReply {
  return ok(
    `<tds:GetCapabilitiesResponse><tds:Capabilities><tt:Device><tt:XAddr>${base}/onvif/device_service</tt:XAddr></tt:Device>` +
      `<tt:Media><tt:XAddr>${base}/onvif/media_service</tt:XAddr></tt:Media></tds:Capabilities></tds:GetCapabilitiesResponse>`,
  );
}

export function profilesAnswer(profiles: readonly { readonly token: string; readonly encoding: string; readonly govLength?: number }[]): OddDeviceReply {
  return ok(
    `<trt:GetProfilesResponse>${profiles
      .map(
        (profile, index) =>
          `<trt:Profiles token="${profile.token}" fixed="true"><tt:Name>p${index}</tt:Name>` +
          `<tt:VideoSourceConfiguration token="vsc_${index}"><tt:Name>source</tt:Name><tt:SourceToken>vs_${index}</tt:SourceToken></tt:VideoSourceConfiguration>` +
          `<tt:VideoEncoderConfiguration token="vec_${index}"><tt:Name>encoder</tt:Name><tt:Encoding>${profile.encoding}</tt:Encoding>` +
          `<tt:Resolution><tt:Width>1920</tt:Width><tt:Height>1080</tt:Height></tt:Resolution>` +
          `<tt:RateControl><tt:FrameRateLimit>25</tt:FrameRateLimit><tt:EncodingInterval>1</tt:EncodingInterval><tt:BitrateLimit>4096</tt:BitrateLimit></tt:RateControl>` +
          `<tt:H264><tt:GovLength>${profile.govLength ?? 50}</tt:GovLength></tt:H264></tt:VideoEncoderConfiguration></trt:Profiles>`,
      )
      .join('')}</trt:GetProfilesResponse>`,
  );
}

export function streamAnswer(address: string): OddDeviceReply {
  return ok(`<trt:GetStreamUriResponse><trt:MediaUri><tt:Uri>${address}</tt:Uri><tt:InvalidAfterConnect>false</tt:InvalidAfterConnect><tt:InvalidAfterReboot>false</tt:InvalidAfterReboot><tt:Timeout>PT60S</tt:Timeout></trt:MediaUri></trt:GetStreamUriResponse>`);
}

/** True when the request's `UsernameToken` is the digest form and holds for that fixture account (clock not checked). */
export function tokenHolds(request: OddDeviceRequest, account: { readonly username: string; readonly secret: string }): boolean {
  const text = (name: string): string | null => new RegExp(`<(?:[\\w.-]+:)?${name}(?:\\s[^>]*)?>([^<]*)<`).exec(request.body)?.[1]?.trim() ?? null;
  const password = /<(?:[\w.-]+:)?Password(\s[^>]*)?>([^<]*)</.exec(request.body);
  const type = /Type\s*=\s*"([^"]*)"/.exec(password?.[1] ?? '')?.[1] ?? '';
  const nonce = text('Nonce');
  const created = text('Created');
  if (password === null || type !== PASSWORD_DIGEST_TYPE || text('Username') !== account.username || nonce === null || created === null) return false;
  const expected = createHash('sha1')
    .update(Buffer.concat([Buffer.from(nonce, 'base64'), Buffer.from(created, 'utf8'), Buffer.from(account.secret, 'utf8')]))
    .digest('base64');
  return expected === (password[2] ?? '').trim();
}

// ── The device ───────────────────────────────────────────────────────────────────────────────────

export function createOddOnvifDevice(port: number, script: (request: OddDeviceRequest, index: number) => OddDeviceReply): OddOnvifDevice {
  if (!ODD_DEVICE_PORTS.includes(port)) throw new RangeError(`odd ONVIF device: the port must be one of ${ODD_DEVICE_PORTS.join(', ')}, got ${String(port)}`);
  let received: OddDeviceRequest[] = [];
  let sent = 0;
  let server: Server | null = null;
  const sockets = new Set<Socket>();
  const timers = new Set<ReturnType<typeof setInterval>>();

  function send(response: ServerResponse, reply: OddDeviceReply): void {
    if (reply.kind === 'HANG') return;
    if (reply.kind === 'ANSWER') {
      response.writeHead(reply.status, { 'Content-Type': 'application/soap+xml; charset=utf-8', 'Content-Length': Buffer.byteLength(reply.body), Connection: 'close', ...reply.headers });
      response.end(reply.body);
      sent += Buffer.byteLength(reply.body);
      return;
    }
    response.writeHead(200, { 'Content-Type': 'application/soap+xml; charset=utf-8', Connection: 'close' });
    if (reply.kind === 'DRIP') {
      const timer = setInterval(() => {
        if (response.destroyed) {
          clearInterval(timer);
          timers.delete(timer);
          return;
        }
        response.write(' ');
        sent += 1;
      }, reply.intervalMs);
      timers.add(timer);
      return;
    }
    const chunk = Buffer.alloc(reply.chunkBytes, 0x20);
    const pump = (): void => {
      if (response.destroyed || server === null) return;
      sent += chunk.length;
      // Whether the peer reads or not, the next chunk follows: the bound must be the client's.
      response.write(chunk, () => setImmediate(pump));
    };
    pump();
  }

  function onRequest(request: IncomingMessage, response: ServerResponse): void {
    const chunks: Buffer[] = [];
    request.on('data', (chunk: Buffer) => chunks.push(chunk));
    request.on('end', () => {
      const body = Buffer.concat(chunks).toString('utf8');
      const entry: OddDeviceRequest = {
        operation: /<(?:[\w.-]+:)?Body(?:\s[^>]*)?>\s*<(?:[\w.-]+:)?(\w+)/.exec(body)?.[1] ?? '?',
        authorization: request.headers.authorization ?? '',
        body,
        token: /<(?:[\w.-]+:)?UsernameToken[\s>]/.test(body),
      };
      received.push(entry);
      send(response, script(entry, received.length - 1));
    });
    request.on('error', () => undefined);
    response.on('error', () => undefined);
  }

  return {
    port,
    serviceUrl: `http://${ODD_DEVICE_HOST}:${port}/onvif/device_service`,
    async start() {
      if (server !== null) throw new Error('odd ONVIF device: already started');
      const created = createServer(onRequest);
      server = created;
      created.on('connection', (socket) => {
        sockets.add(socket);
        socket.on('error', () => undefined);
        socket.on('close', () => sockets.delete(socket));
      });
      await new Promise<void>((resolvePromise, rejectPromise) => {
        created.once('error', rejectPromise);
        created.listen({ host: ODD_DEVICE_HOST, port, exclusive: true }, () => {
          created.off('error', rejectPromise);
          resolvePromise();
        });
      });
    },
    async stop() {
      const closing = server;
      server = null;
      for (const timer of timers) clearInterval(timer);
      timers.clear();
      for (const socket of sockets) socket.destroy();
      sockets.clear();
      if (closing !== null && closing.listening) await new Promise<void>((resolvePromise) => closing.close(() => resolvePromise()));
    },
    requests: () => received,
    bytesSent: () => sent,
    reset() {
      received = [];
      sent = 0;
    },
  };
}
