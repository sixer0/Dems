// The fake ONVIF stub drives every outcome it exists for, on loopback (blueprint row 60; register
// NM-14; capture spec §A.8.1 ST-1..ST-5, §A.6.1 DS-8/DS-9/DS-15, §A.6.2; API contract §2.6).
//
// The discovery adapter (row 131) and the connection test (row 142) do not exist yet. The client in
// this file is a REFERENCE, written from the outcome table of §A.6.2 only to show that the stub can
// produce each outcome and each hostile answer: it is test code, not the product's client, and
// nothing under `src/` may import it.
//
// Real sockets on 127.0.0.1, ephemeral ports outside 8554-8564 (decision D170; the sandbox must allow loopback binding). No
// test waits longer than the client timeout of the "no answer" cases (300 ms).
import { execFileSync } from 'node:child_process';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { createSocket } from 'node:dgram';
import { request as httpRequest } from 'node:http';
import { connect, createServer } from 'node:net';
import { CAPTURE_MEDIA_PORT_MAX, CAPTURE_MEDIA_PORT_MIN } from '@dems/capture-protocol';
import { afterEach, describe, expect, it } from 'vitest';
import {
  FAKE_ONVIF_ALLOWED_OPERATIONS,
  FAKE_ONVIF_FOREIGN_HOST,
  FAKE_ONVIF_NOT_XML_BODY,
  FAKE_ONVIF_HOST,
  FAKE_ONVIF_GATEWAY_READ_BACK_OPERATION,
  FAKE_ONVIF_MARKUP_TEXT,
  FAKE_ONVIF_MARKUP_TOKEN,
  FAKE_ONVIF_NETWORK_DEFAULTS,
  FAKE_ONVIF_NETWORK_OPERATIONS,
  FAKE_ONVIF_OVERSIZED_REPLY_BYTES,
  FAKE_ONVIF_ODD_PROFILE_TOKEN,
  FAKE_ONVIF_TWO_SOURCE_PROFILES,
  fakeOnvifProfileStreamUri,
  FAKE_ONVIF_TESTABLE_DEVICES_MAX,
  isWellFormedXml,
  WS_DISCOVERY_PROBE_ACTION,
  WS_DISCOVERY_PROBE_MATCHES_ACTION,
  WS_DISCOVERY_TO,
  createFakeOnvifStub,
  FAKE_ONVIF_HARNESS_PORT_MAX,
  FAKE_ONVIF_HARNESS_PORT_MIN,
  FAKE_ONVIF_PORT_MAX,
  FAKE_ONVIF_PORT_MIN,
  FakeOnvifPortBusyError,
  freeFakeOnvifPorts,
  isCaptureHarnessPort,
  type FakeOnvifCredential,
  type FakeOnvifDiscoveryMode,
  type FakeOnvifStub,
  type FakeOnvifStubOptions,
} from './fake-onvif-stub';

/** The fixture account of THIS test file. Built here, used nowhere else. */
const ACCOUNT: FakeOnvifCredential = { username: 'fixture-operator', secret: ['fixture', 'secret', randomUUID()].join('-') };
const CLIENT_TIMEOUT_MS = 300;

let running: FakeOnvifStub[] = [];

async function startStub(overrides: Partial<Omit<FakeOnvifStubOptions, 'ports' | 'credential'>> = {}): Promise<FakeOnvifStub> {
  const stub = createFakeOnvifStub({ ports: await freeFakeOnvifPorts(), credential: ACCOUNT, ...overrides });
  await stub.start();
  running.push(stub);
  return stub;
}

afterEach(async () => {
  for (const stub of running) await stub.stop();
  running = [];
});

// ── Reference discovery client: unicast probes, as DS-15 says the automated suite sends them ────

interface Answer {
  readonly from: { readonly address: string; readonly port: number };
  readonly bytes: number;
  readonly text: string;
}

const text = (xml: string, name: string): string | null => new RegExp(`<(?:[\\w.-]+:)?${name}(?:\\s[^>]*)?>([^<]*)<`).exec(xml)?.[1]?.trim() ?? null;

function probeXml(messageId: string, types: string): string {
  return (
    `<?xml version="1.0" encoding="UTF-8"?><s:Envelope xmlns:s="http://www.w3.org/2003/05/soap-envelope" xmlns:a="http://schemas.xmlsoap.org/ws/2004/08/addressing" ` +
    `xmlns:d="http://schemas.xmlsoap.org/ws/2005/04/discovery" xmlns:dn="http://www.onvif.org/ver10/network/wsdl" xmlns:tds="http://www.onvif.org/ver10/device/wsdl">` +
    `<s:Header><a:Action>${WS_DISCOVERY_PROBE_ACTION}</a:Action><a:MessageID>${messageId}</a:MessageID><a:To>${WS_DISCOVERY_TO}</a:To></s:Header>` +
    `<s:Body><d:Probe><d:Types>${types}</d:Types></d:Probe></s:Body></s:Envelope>`
  );
}

/** Sends datagrams from one client socket and returns what came back within the window. */
async function exchange(stub: FakeOnvifStub, payloads: readonly (string | Buffer)[], windowMs = 150, during?: (client: { address: string; port: number }) => Promise<void>): Promise<Answer[]> {
  const socket = createSocket('udp4');
  const answers: Answer[] = [];
  socket.on('message', (message, remote) => answers.push({ from: { address: remote.address, port: remote.port }, bytes: message.length, text: message.toString('utf8') }));
  await new Promise<void>((resolvePromise) => socket.bind({ address: FAKE_ONVIF_HOST, port: 0 }, resolvePromise));
  socket.setRecvBufferSize(4 * 1024 * 1024);
  const target = stub.addresses().discovery;
  for (const payload of payloads) await new Promise<void>((resolvePromise, rejectPromise) => socket.send(payload, target.port, target.address, (error) => (error ? rejectPromise(error) : resolvePromise())));
  if (during !== undefined) await during({ address: FAKE_ONVIF_HOST, port: socket.address().port });
  await new Promise((resolvePromise) => setTimeout(resolvePromise, windowMs));
  await new Promise<void>((resolvePromise) => socket.close(() => resolvePromise()));
  return answers;
}

const TYPES = ['tds:Device', 'dn:NetworkVideoTransmitter'] as const;

/** The two typed probes of §A.6.1 DS-6, each with its own message ID. */
async function search(stub: FakeOnvifStub, windowMs?: number): Promise<{ ids: string[]; answers: Answer[] }> {
  const ids = TYPES.map(() => `urn:uuid:${randomUUID()}`);
  const answers = await exchange(stub, TYPES.map((types, index) => probeXml(ids[index] ?? '', types)), windowMs);
  return { ids, answers };
}

// ── Reference connection test: the outcome table of §A.6.2, top to bottom ───────────────────────

type Outcome = 'REACHABLE' | 'UNREACHABLE' | 'AUTHENTICATION_FAILED' | 'WRONG_PROFILE' | 'NOT_H264';
interface TestResult {
  readonly outcome: Outcome;
  readonly reason?: string;
  readonly warnings?: readonly string[];
}

interface HttpAnswer {
  readonly status: number;
  readonly challenge: string;
  readonly body: string;
}

function soap(url: string, body: string, header = '', headers: Record<string, string> = {}): Promise<HttpAnswer | null> {
  const xml = `<?xml version="1.0" encoding="UTF-8"?><s:Envelope xmlns:s="http://www.w3.org/2003/05/soap-envelope"><s:Header>${header}</s:Header><s:Body>${body}</s:Body></s:Envelope>`;
  return new Promise((resolvePromise) => {
    const call = httpRequest(url, { method: 'POST', headers: { 'Content-Type': 'application/soap+xml; charset=utf-8', 'Content-Length': Buffer.byteLength(xml), ...headers }, timeout: CLIENT_TIMEOUT_MS }, (response) => {
      const chunks: Buffer[] = [];
      response.on('data', (chunk: Buffer) => chunks.push(chunk));
      response.on('end', () => resolvePromise({ status: response.statusCode ?? 0, challenge: String(response.headers['www-authenticate'] ?? ''), body: Buffer.concat(chunks).toString('utf8') }));
    });
    call.on('timeout', () => call.destroy(new Error('timeout')));
    call.on('error', () => resolvePromise(null)); // refused, reset or timed out: no answer
    call.end(xml);
  });
}

/** WS-Security UsernameToken with PasswordDigest, built on the DEVICE's clock. */
function usernameToken(credential: FakeOnvifCredential, deviceTimeMs: number, passwordType = 'Digest', nonce: Buffer = randomBytes(16)): string {
  const created = new Date(deviceTimeMs).toISOString();
  const password =
    passwordType === 'Digest'
      ? createHash('sha1').update(Buffer.concat([nonce, Buffer.from(created), Buffer.from(credential.secret)])).digest('base64')
      : credential.secret;
  const profile = 'http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-username-token-profile-1.0';
  return (
    `<wsse:Security xmlns:wsse="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd" xmlns:wsu="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-utility-1.0.xsd">` +
    `<wsse:UsernameToken><wsse:Username>${credential.username}</wsse:Username><wsse:Password Type="${profile}#Password${passwordType}">${password}</wsse:Password>` +
    `<wsse:Nonce>${nonce.toString('base64')}</wsse:Nonce><wsu:Created>${created}</wsu:Created></wsse:UsernameToken></wsse:Security>`
  );
}

function deviceTime(xml: string): number {
  const n = (name: string): number => Number(text(xml, name));
  return Date.UTC(n('Year'), n('Month') - 1, n('Day'), n('Hour'), n('Minute'), n('Second'));
}

interface RtspAnswer {
  readonly status: number;
  readonly challenge: string;
  readonly body: string;
}

function rtsp(uri: string, lines: readonly string[]): Promise<RtspAnswer | null> {
  const { hostname, port } = new URL(uri.replace(/^rtsp:/, 'http:'));
  return new Promise((resolvePromise) => {
    const socket = connect({ host: hostname, port: Number(port) });
    let received = '';
    const done = (answer: RtspAnswer | null): void => {
      socket.destroy();
      resolvePromise(answer);
    };
    socket.setTimeout(CLIENT_TIMEOUT_MS, () => done(null));
    socket.on('error', () => done(null));
    socket.on('connect', () => socket.write([...lines, '', ''].join('\r\n')));
    socket.on('data', (chunk) => {
      received += chunk.toString('utf8');
      const end = received.indexOf('\r\n\r\n');
      if (end < 0) return;
      const head = received.slice(0, end);
      const length = Number(/Content-Length:\s*(\d+)/i.exec(head)?.[1] ?? 0);
      if (received.length < end + 4 + length) return;
      done({ status: Number(/^RTSP\/1\.0 (\d+)/.exec(head)?.[1] ?? 0), challenge: /WWW-Authenticate:\s*(.*)/i.exec(head)?.[1] ?? '', body: received.slice(end + 4) });
    });
  });
}

const md5 = (value: string): string => createHash('md5').update(value).digest('hex');

async function referenceConnectionTest(serviceUrl: string, sourceAddress: string, credential: FakeOnvifCredential): Promise<TestResult> {
  const time = await soap(serviceUrl, '<tds:GetSystemDateAndTime xmlns:tds="http://www.onvif.org/ver10/device/wsdl"/>');
  if (time === null || time.status !== 200) return { outcome: 'UNREACHABLE' };
  const clock = deviceTime(time.body);
  const services = await soap(serviceUrl, '<tds:GetServices xmlns:tds="http://www.onvif.org/ver10/device/wsdl"><tds:IncludeCapability>false</tds:IncludeCapability></tds:GetServices>');
  if (services === null) return { outcome: 'UNREACHABLE' };
  // Address pinning (CT-3): the next requests go to the address the candidate answered from, whatever GetServices names.
  const profiles = await soap(serviceUrl, '<trt:GetProfiles xmlns:trt="http://www.onvif.org/ver10/media/wsdl"/>', usernameToken(credential, clock));
  if (profiles === null) return { outcome: 'UNREACHABLE' };
  if (profiles.status === 401) {
    // A device that offers Basic only would be sent the password in clear: it is not sent (CT-1).
    return /^Basic\b/i.test(profiles.challenge) ? { outcome: 'AUTHENTICATION_FAILED', reason: 'SCHEME_NOT_ALLOWED' } : { outcome: 'AUTHENTICATION_FAILED' };
  }
  const token = /<(?:[\w.-]+:)?Profiles\s[^>]*token="([^"]+)"/.exec(profiles.body)?.[1];
  if (token === undefined || text(profiles.body, 'Encoding') === null) return { outcome: 'WRONG_PROFILE', reason: 'NO_PROFILE' };
  const stream = await soap(
    serviceUrl,
    `<trt:GetStreamUri xmlns:trt="http://www.onvif.org/ver10/media/wsdl" xmlns:tt="http://www.onvif.org/ver10/schema"><trt:StreamSetup><tt:Stream>RTP-Unicast</tt:Stream>` +
      `<tt:Transport><tt:Protocol>RTSP</tt:Protocol></tt:Transport></trt:StreamSetup><trt:ProfileToken>${token}</trt:ProfileToken></trt:GetStreamUri>`,
    usernameToken(credential, clock),
  );
  const uri = stream === null ? null : text(stream.body, 'Uri');
  if (uri === null || !uri.startsWith('rtsp://') || uri.includes('@')) return { outcome: 'WRONG_PROFILE', reason: 'NO_STREAM_URI' };
  if (new URL(uri.replace(/^rtsp:/, 'http:')).hostname !== sourceAddress) return { outcome: 'WRONG_PROFILE', reason: 'STREAM_HOST_MISMATCH' }; // the foreign host is NOT contacted
  if (text(profiles.body, 'Encoding') !== 'H264') return { outcome: 'NOT_H264', reason: 'ONVIF_PROFILE' };
  let describe = await rtsp(uri, [`DESCRIBE ${uri} RTSP/1.0`, 'CSeq: 1', 'Accept: application/sdp']);
  if (describe === null) return { outcome: 'UNREACHABLE', reason: 'RTSP' };
  if (describe.status === 401) {
    const nonce = /nonce="([^"]+)"/.exec(describe.challenge)?.[1] ?? '';
    const realm = /realm="([^"]+)"/.exec(describe.challenge)?.[1] ?? '';
    if (!/^Digest\b/i.test(describe.challenge)) return { outcome: 'AUTHENTICATION_FAILED', reason: 'SCHEME_NOT_ALLOWED' };
    const response = md5(`${md5(`${credential.username}:${realm}:${credential.secret}`)}:${nonce}:${md5(`DESCRIBE:${uri}`)}`);
    describe = await rtsp(uri, [`DESCRIBE ${uri} RTSP/1.0`, 'CSeq: 2', 'Accept: application/sdp', `Authorization: Digest username="${credential.username}", realm="${realm}", nonce="${nonce}", uri="${uri}", response="${response}"`]);
    if (describe === null) return { outcome: 'UNREACHABLE', reason: 'RTSP' };
    if (describe.status === 401) return { outcome: 'AUTHENTICATION_FAILED', reason: 'RTSP' }; // one digest round, no retry (CT-4)
  }
  if (describe.status !== 200 || !/^m=video /m.test(describe.body) || !/^a=rtpmap:\d+ H264\/90000/m.test(describe.body)) return { outcome: 'NOT_H264', reason: 'RTSP_SDP' };
  const warnings: string[] = [];
  if (Number(text(profiles.body, 'GovLength')) / Number(text(profiles.body, 'FrameRateLimit')) > 2) warnings.push('GOP_ABOVE_BOUND');
  if (!describe.body.includes('sprop-parameter-sets')) warnings.push('NO_PARAMETER_SETS_IN_SDP');
  return { outcome: 'REACHABLE', warnings };
}

const operations = (stub: FakeOnvifStub, channel: 'discovery' | 'device' | 'rtsp'): string[] =>
  stub
    .requestLog()
    .filter((entry) => entry.channel === channel)
    .map((entry) => entry.operation);

// ── The tests ───────────────────────────────────────────────────────────────────────────────────

describe('fake ONVIF stub: where it listens (SEC35-23)', () => {
  it('DECISION D170: the ports are ephemeral and NEVER a port of the capture harnesses (the protocol media range 8554-8564), over many allocations', async () => {
    // The one shared place: the protocol's own range, which every worker harness port is inside by the protocol's rule.
    expect([FAKE_ONVIF_HARNESS_PORT_MIN, FAKE_ONVIF_HARNESS_PORT_MAX]).toEqual([CAPTURE_MEDIA_PORT_MIN, CAPTURE_MEDIA_PORT_MAX]);
    expect([CAPTURE_MEDIA_PORT_MIN, CAPTURE_MEDIA_PORT_MAX]).toEqual([8554, 8564]);
    // The harness numbers as their files state them today (e2e.py PORT_CANDIDATES and its series pair, m3worker.py default, kill matrix / seal e2e).
    const HARNESS = [8554, 8555, 8556, 8557, 8559, 8560, 8561, 8562, 8563, 8564];
    for (const port of HARNESS) expect(isCaptureHarnessPort(port), String(port)).toBe(true);
    const handedOut: number[] = [];
    for (let round = 0; round < 40; round += 1) {
      const ports = await freeFakeOnvifPorts();
      handedOut.push(ports.discovery, ports.device, ports.rtsp);
      expect(ports.device).not.toBe(ports.rtsp);
    }
    expect(handedOut.filter((port) => isCaptureHarnessPort(port) || HARNESS.includes(port))).toEqual([]);
    expect(handedOut.filter((port) => port < FAKE_ONVIF_PORT_MIN || port > FAKE_ONVIF_PORT_MAX)).toEqual([]);
  });

  it('a port that is busy at start is a NAMED failure, and the stub does not move to another port', async () => {
    const ports = await freeFakeOnvifPorts();
    const holder = createServer();
    await new Promise<void>((done) => holder.listen({ host: FAKE_ONVIF_HOST, port: ports.rtsp, exclusive: true }, () => done()));
    const stub = createFakeOnvifStub({ ports, credential: ACCOUNT });
    try {
      await expect(stub.start()).rejects.toMatchObject({ name: 'FakeOnvifPortBusyError', code: 'FAKE_ONVIF_PORT_BUSY', listener: 'rtsp', port: ports.rtsp });
      await expect(stub.start()).rejects.toBeInstanceOf(FakeOnvifPortBusyError);
      // Nothing is left listening, on these ports or on any other.
      expect(stub.addresses().bound).toEqual([]);
    } finally {
      await stub.stop();
      await new Promise<void>((done) => holder.close(() => done()));
    }
  });

  it('refuses a port of the capture harnesses, a port below the ephemeral floor, one TCP port for two listeners, and a missing credential', async () => {
    const ports = await freeFakeOnvifPorts();
    for (const bad of [0, 80, 3702, 4420, 5173, 8554, 8555, 8560, 8563, 8564, 32_767, 65_536, 40_000.5]) {
      expect(() => createFakeOnvifStub({ ports: { ...ports, discovery: bad }, credential: ACCOUNT }), `discovery ${bad}`).toThrow(RangeError);
      expect(() => createFakeOnvifStub({ ports: { ...ports, device: bad }, credential: ACCOUNT }), `device ${bad}`).toThrow(RangeError);
      expect(() => createFakeOnvifStub({ ports: { ...ports, rtsp: bad }, credential: ACCOUNT }), `rtsp ${bad}`).toThrow(RangeError);
    }
    expect(() => createFakeOnvifStub({ ports: { ...ports, rtsp: ports.device }, credential: ACCOUNT })).toThrow(RangeError);
    expect(() => createFakeOnvifStub({ ports, credential: { username: 'x', secret: '' } })).toThrow(RangeError);
    // CONTROL: the same ports and a credential are accepted.
    expect(() => createFakeOnvifStub({ ports, credential: ACCOUNT })).not.toThrow();
  });

  it('binds its three listeners on 127.0.0.1 only, as the operating system lists them, and frees them on stop', async () => {
    const stub = await startStub();
    const { bound } = stub.addresses();
    expect(bound.map((entry) => entry.listener)).toEqual(['discovery', 'device', 'rtsp']);
    for (const entry of bound) {
      expect(entry.address).toBe(FAKE_ONVIF_HOST);
      expect(entry.port).toBeGreaterThanOrEqual(FAKE_ONVIF_PORT_MIN);
      expect(isCaptureHarnessPort(entry.port)).toBe(false);
    }
    // The listener snapshot: every internet socket this process holds on the three ports.
    const rows = execFileSync('lsof', ['-nP', '-a', '-p', String(process.pid), '-i'], { encoding: 'utf8' })
      .split('\n')
      .slice(1)
      .filter((row) => bound.some((entry) => new RegExp(`:${entry.port}(?:\\s|$)`).test(row)));
    const names = rows.map((row) => row.trim().split(/\s+/).slice(7).join(' '));
    expect(names.sort()).toEqual([`TCP ${FAKE_ONVIF_HOST}:${bound[1]?.port} (LISTEN)`, `TCP ${FAKE_ONVIF_HOST}:${bound[2]?.port} (LISTEN)`, `UDP ${FAKE_ONVIF_HOST}:${bound[0]?.port}`].sort());
    expect(names.filter((name) => name.includes('*:'))).toEqual([]);

    await stub.stop();
    expect(stub.addresses().bound).toEqual([]);
    // The ports are free again: another listener takes them at once.
    for (const port of [bound[1]?.port, bound[2]?.port]) {
      const again = createServer();
      await new Promise<void>((resolvePromise, rejectPromise) => again.once('error', rejectPromise).listen({ host: FAKE_ONVIF_HOST, port, exclusive: true }, resolvePromise));
      await new Promise((resolvePromise) => again.close(resolvePromise));
    }
  });

  it('a second stub on the same ports is refused by the operating system (no shared listener)', async () => {
    const stub = await startStub();
    const second = createFakeOnvifStub({ ports: { discovery: stub.addresses().discovery.port, device: stub.addresses().bound[1]?.port ?? 0, rtsp: stub.addresses().bound[2]?.port ?? 0 }, credential: ACCOUNT });
    // The operating system's refusal (EADDRINUSE, kept as the cause) under the stub's own name (decision D170).
    await expect(second.start()).rejects.toMatchObject({ code: 'FAKE_ONVIF_PORT_BUSY', listener: 'discovery', cause: { code: 'EADDRINUSE' } });
    // The first one still answers.
    expect((await search(stub)).answers).toHaveLength(2);
  });
});

describe('fake ONVIF stub: discovery on loopback (ST-1)', () => {
  it('answers each of the two typed unicast probes with one ProbeMatches that relates to it', async () => {
    const stub = await startStub();
    const { ids, answers } = await search(stub);
    expect(answers).toHaveLength(2);
    expect(answers.map((answer) => text(answer.text, 'RelatesTo')).sort()).toEqual([...ids].sort());
    for (const answer of answers) {
      expect(answer.from).toEqual(stub.addresses().discovery); // unicast, from the stub's own address
      expect(text(answer.text, 'Action')).toBe(WS_DISCOVERY_PROBE_MATCHES_ACTION);
      expect(text(answer.text, 'Address')).toBe(stub.devices()[0]?.endpointRef);
      expect(text(answer.text, 'Types')).toContain('tds:Device');
      const scopes = text(answer.text, 'Scopes') ?? '';
      for (const category of ['Profile', 'hardware', 'name']) expect(scopes).toContain(`onvif://www.onvif.org/${category}/`);
      expect(text(answer.text, 'XAddrs')).toBe(stub.addresses().deviceServiceUrl);
      expect(new URL(text(answer.text, 'XAddrs') ?? '').hostname).toBe(answer.from.address);
      expect(text(answer.text, 'MetadataVersion')).toBe('1');
    }
  });

  it('N devices give N answers per probe; N = 0 is the empty network', async () => {
    const three = await startStub({ devices: 3 });
    const found = await search(three);
    expect(found.answers).toHaveLength(6);
    expect(new Set(found.answers.map((answer) => text(answer.text, 'Address'))).size).toBe(3);
    await three.stop();
    running = [];

    const none = await startStub({ devices: 0 });
    expect((await search(none)).answers).toEqual([]);
    expect(operations(none, 'discovery')).toEqual(['Probe', 'Probe']); // it heard both and has nothing to say
  });

  it('every device answers from the ONE address 127.0.0.1: to a rule that names a host by its address, N > 1 devices are one host with N endpoint references (the documented limit of 1 testable device)', async () => {
    expect(FAKE_ONVIF_TESTABLE_DEVICES_MAX).toBe(1);
    const three = await startStub({ devices: 3 });
    const found = await search(three);
    // The kernel-named source of every answer: one address, one port.
    expect([...new Set(found.answers.map((answer) => answer.from.address))]).toEqual([FAKE_ONVIF_HOST]);
    expect(new Set(found.answers.map((answer) => answer.from.port)).size).toBe(1);
    // The conflict rule's own count: endpoint references per source address.
    const referencesOfHost = new Map<string, Set<string>>();
    for (const answer of found.answers) referencesOfHost.set(answer.from.address, (referencesOfHost.get(answer.from.address) ?? new Set()).add(text(answer.text, 'Address') ?? ''));
    expect([...referencesOfHost.values()].map((references) => references.size)).toEqual([3]);
    // Every announced service address names that same host: no answer points anywhere else.
    for (const answer of found.answers) expect(text(answer.text, 'XAddrs')).toMatch(new RegExp(`^http://${FAKE_ONVIF_HOST.replaceAll('.', '[.]')}:\\d+/`));
    await three.stop();
    running = [];

    // One device: one reference on the host, which is what a search can list as testable.
    const one = await startStub({ devices: 1 });
    const single = await search(one);
    expect(new Set(single.answers.map((answer) => text(answer.text, 'Address'))).size).toBe(1);
  });

  it('does not answer a probe for another device type, nor a datagram that is no Probe', async () => {
    const stub = await startStub();
    expect(await exchange(stub, [probeXml(`urn:uuid:${randomUUID()}`, 'wsdp:Printer')])).toEqual([]);
    expect(await exchange(stub, ['hello', Buffer.from([0, 1, 2, 3])])).toEqual([]);
    expect(operations(stub, 'discovery')).toEqual(['Probe', '?', '?']);
    // CONTROL: a probe without Types is answered (every device matches it).
    expect(await exchange(stub, [probeXml(`urn:uuid:${randomUUID()}`, '')])).toHaveLength(1);
  });

  it('a search leaves a log of probes only: 0 authenticated, 0 device and 0 RTSP requests', async () => {
    const stub = await startStub({ devices: 2 });
    await search(stub);
    expect(stub.requestLog()).toEqual([
      { channel: 'discovery', method: 'UDP', operation: 'Probe', authPresent: false },
      { channel: 'discovery', method: 'UDP', operation: 'Probe', authPresent: false },
    ]);
    expect(stub.violations()).toEqual([]);
  });
});

describe('fake ONVIF stub: hostile and odd answers, one switch each (ST-2)', () => {
  const cases: readonly { mode: FakeOnvifDiscoveryMode; check: (answers: Answer[], ids: string[], stub: FakeOnvifStub) => void }[] = [
    { mode: 'SILENT', check: (answers) => expect(answers).toEqual([]) },
    {
      mode: 'WRONG_RELATES_TO',
      check: (answers, ids) => {
        expect(answers).toHaveLength(2);
        for (const answer of answers) expect(ids).not.toContain(text(answer.text, 'RelatesTo'));
      },
    },
    {
      mode: 'FOREIGN_XADDR',
      check: (answers) => {
        expect(answers).toHaveLength(2);
        for (const answer of answers) {
          expect(new URL(text(answer.text, 'XAddrs') ?? '').hostname).toBe(FAKE_ONVIF_FOREIGN_HOST);
          expect(answer.from.address).toBe(FAKE_ONVIF_HOST); // the kernel's address and the message's disagree
        }
      },
    },
    {
      mode: 'NO_XADDRS',
      check: (answers) => {
        expect(answers).toHaveLength(2);
        for (const answer of answers) expect(answer.text).not.toContain('XAddrs');
      },
    },
    { mode: 'TWO_MATCHES_IN_ONE', check: (answers) => expect(answers.map((answer) => answer.text.split('<d:ProbeMatch>').length - 1)).toEqual([2, 2]) },
    {
      mode: 'EMPTY_MATCHES',
      check: (answers) => {
        expect(answers).toHaveLength(2);
        for (const answer of answers) expect(answer.text).toContain('<d:ProbeMatches></d:ProbeMatches>');
      },
    },
    {
      mode: 'OVERSIZED_BODY',
      check: (answers) => {
        expect(answers).toHaveLength(2);
        for (const answer of answers) expect(answer.bytes).toBeGreaterThan(60 * 1024); // above the 16 KiB a search accepts (DS-8)
      },
    },
    {
      mode: 'ENTITY_EXPANSION',
      check: (answers) => {
        expect(answers).toHaveLength(2);
        for (const answer of answers) {
          expect(answer.text).toContain('<!DOCTYPE');
          expect(answer.text).toContain('<!ENTITY e ');
          expect(answer.text).toContain('/name/&e;');
        }
      },
    },
    {
      mode: 'NOT_XML',
      check: (answers) => {
        expect(answers).toHaveLength(2);
        for (const answer of answers) expect(answer.text).not.toContain('Envelope');
        // Pass H-Y: the same fixed bytes in every answer, and no `<!` in them (a random body held one about once in 130 and
        // was then, rightly, a DECLARATION to the search - the red of the wave-H checkpoint run).
        for (const answer of answers) expect(answer.text).toBe(FAKE_ONVIF_NOT_XML_BODY.toString('utf8'));
        expect(FAKE_ONVIF_NOT_XML_BODY).toHaveLength(512);
        expect(FAKE_ONVIF_NOT_XML_BODY.includes('<!')).toBe(false);
      },
    },
    {
      mode: 'FLOOD_300',
      check: (answers, ids) => {
        expect(answers).toHaveLength(600);
        expect(new Set(answers.map((answer) => text(answer.text, 'Address'))).size).toBe(600);
        expect(new Set(answers.map((answer) => text(answer.text, 'RelatesTo')))).toEqual(new Set(ids));
      },
    },
  ];

  it.each(cases)('$mode', async ({ mode, check }) => {
    const stub = await startStub();
    stub.setDiscoveryMode(mode);
    const { ids, answers } = await search(stub, mode === 'FLOOD_300' ? 400 : 150);
    check(answers, ids, stub);
    // CONTROL: back in NORMAL the same stub gives the ordinary answer again, so the switch is what changed it.
    stub.setDiscoveryMode('NORMAL');
    const normal = await search(stub);
    expect(normal.answers.map((answer) => text(answer.text, 'RelatesTo')).sort()).toEqual([...normal.ids].sort());
  });

  it('an answer nobody asked for reaches the client socket and relates to none of its probes', async () => {
    const stub = await startStub();
    const ids = TYPES.map(() => `urn:uuid:${randomUUID()}`);
    const answers = await exchange(stub, [probeXml(ids[0] ?? '', TYPES[0])], 150, (client) => stub.sendUnsolicited(client));
    expect(answers).toHaveLength(2);
    expect(answers.filter((answer) => ids.includes(text(answer.text, 'RelatesTo') ?? ''))).toHaveLength(1);
  });
});

describe('fake ONVIF stub: every connection-test outcome on loopback (ST-3, ST-4; contract §2.6)', () => {
  const run = (stub: FakeOnvifStub, credential: FakeOnvifCredential = ACCOUNT): Promise<TestResult> =>
    referenceConnectionTest(stub.addresses().deviceServiceUrl, FAKE_ONVIF_HOST, credential);

  it('REACHABLE: authenticated, an H.264 profile, a stream address on the same host, an H.264 SDP', async () => {
    const stub = await startStub();
    expect(await run(stub)).toEqual({ outcome: 'REACHABLE', warnings: [] });
    // ST-5: only the read-only list, in the order of the test, and no media session.
    expect(operations(stub, 'device')).toEqual(['GetSystemDateAndTime', 'GetServices', 'GetProfiles', 'GetStreamUri']);
    expect(stub.requestLog().filter((entry) => entry.channel === 'device').map((entry) => entry.authPresent)).toEqual([false, false, true, true]);
    expect(operations(stub, 'rtsp')).toEqual(['DESCRIBE']);
    for (const operation of operations(stub, 'device')) expect(FAKE_ONVIF_ALLOWED_OPERATIONS).toContain(operation);
    expect(stub.violations()).toEqual([]);
  });

  it('REACHABLE with warnings: a GOP above 2 s, and an SDP without parameter sets', async () => {
    const stub = await startStub({ govLength: 250 });
    stub.setRtspMode('H264_NO_PARAMETER_SETS');
    expect(await run(stub)).toEqual({ outcome: 'REACHABLE', warnings: ['GOP_ABOVE_BOUND', 'NO_PARAMETER_SETS_IN_SDP'] });
  });

  it('REACHABLE behind an RTSP digest challenge: one round, then the SDP', async () => {
    const stub = await startStub({ rtspDigest: true });
    expect(await run(stub)).toEqual({ outcome: 'REACHABLE', warnings: [] });
    expect(stub.requestLog().filter((entry) => entry.channel === 'rtsp')).toEqual([
      { channel: 'rtsp', method: 'DESCRIBE', operation: 'DESCRIBE', authPresent: false },
      { channel: 'rtsp', method: 'DESCRIBE', operation: 'DESCRIBE', authPresent: true },
    ]);
  });

  it('UNREACHABLE: the connection is refused', async () => {
    const stub = await startStub();
    await stub.closeDeviceListener();
    expect(await run(stub)).toEqual({ outcome: 'UNREACHABLE' });
    expect(operations(stub, 'device')).toEqual([]);
  });

  it('UNREACHABLE: the connection is accepted and never answered', async () => {
    const stub = await startStub();
    stub.setDeviceMode('NO_ANSWER');
    const started = Date.now();
    expect(await run(stub)).toEqual({ outcome: 'UNREACHABLE' });
    expect(Date.now() - started).toBeGreaterThanOrEqual(CLIENT_TIMEOUT_MS - 20); // it was the client's timeout, not a refusal
    expect(operations(stub, 'device')).toEqual(['GetSystemDateAndTime']); // one attempt, no retry
  });

  it('AUTHENTICATION_FAILED: a wrong secret, and a wrong user name, are answered 401', async () => {
    const stub = await startStub();
    expect(await run(stub, { ...ACCOUNT, secret: 'not-the-secret' })).toEqual({ outcome: 'AUTHENTICATION_FAILED' });
    expect(await run(stub, { ...ACCOUNT, username: 'somebody-else' })).toEqual({ outcome: 'AUTHENTICATION_FAILED' });
    expect(operations(stub, 'device')).toEqual(['GetSystemDateAndTime', 'GetServices', 'GetProfiles', 'GetSystemDateAndTime', 'GetServices', 'GetProfiles']);
    expect(operations(stub, 'rtsp')).toEqual([]); // nothing after the refusal
    // CONTROL: the right account on the same stub passes.
    expect((await run(stub)).outcome).toBe('REACHABLE');
  });

  it('AUTHENTICATION_FAILED / SCHEME_NOT_ALLOWED: a device that takes Basic only is never sent the password', async () => {
    const stub = await startStub();
    stub.setDeviceMode('BASIC_ONLY');
    expect(await run(stub)).toEqual({ outcome: 'AUTHENTICATION_FAILED', reason: 'SCHEME_NOT_ALLOWED' });
    expect(stub.violations()).toEqual([]); // no password in clear arrived
    expect(operations(stub, 'device')).toEqual(['GetSystemDateAndTime', 'GetServices', 'GetProfiles']);
  });

  it('AUTHENTICATION_FAILED: the RTSP server refuses again after the one digest round', async () => {
    const stub = await startStub({ rtspDigest: true });
    // The ONVIF half is given the right secret and the RTSP half a wrong one: only the RTSP digest can fail.
    const time = await soap(stub.addresses().deviceServiceUrl, '<tds:GetSystemDateAndTime xmlns:tds="http://www.onvif.org/ver10/device/wsdl"/>');
    expect(time?.status).toBe(200);
    const uri = stub.addresses().streamUri;
    const first = await rtsp(uri, [`DESCRIBE ${uri} RTSP/1.0`, 'CSeq: 1']);
    expect(first?.status).toBe(401);
    expect(first?.challenge).toMatch(/^Digest realm="[^"]+", nonce="[0-9a-f]{32}"$/);
    const nonce = /nonce="([^"]+)"/.exec(first?.challenge ?? '')?.[1] ?? '';
    const wrong = md5(`${md5(`${ACCOUNT.username}:fake-onvif:not-the-secret`)}:${nonce}:${md5(`DESCRIBE:${uri}`)}`);
    const second = await rtsp(uri, [`DESCRIBE ${uri} RTSP/1.0`, 'CSeq: 2', `Authorization: Digest username="${ACCOUNT.username}", realm="fake-onvif", nonce="${nonce}", uri="${uri}", response="${wrong}"`]);
    expect(second?.status).toBe(401);
  });

  it('WRONG_PROFILE: no profile', async () => {
    const stub = await startStub();
    stub.setDeviceMode('NO_PROFILE');
    expect(await run(stub)).toEqual({ outcome: 'WRONG_PROFILE', reason: 'NO_PROFILE' });
    expect(operations(stub, 'device')).toEqual(['GetSystemDateAndTime', 'GetServices', 'GetProfiles']);
  });

  it('WRONG_PROFILE / STREAM_HOST_MISMATCH: a stream address on another host, which is not contacted', async () => {
    const stub = await startStub();
    stub.setDeviceMode('FOREIGN_STREAM_HOST');
    expect(await run(stub)).toEqual({ outcome: 'WRONG_PROFILE', reason: 'STREAM_HOST_MISMATCH' });
    expect(operations(stub, 'rtsp')).toEqual([]);
  });

  it('NOT_H264: an H.265-only profile (the ONVIF answer)', async () => {
    const stub = await startStub();
    stub.setDeviceMode('H265_ONLY');
    expect(await run(stub)).toEqual({ outcome: 'NOT_H264', reason: 'ONVIF_PROFILE' });
    expect(operations(stub, 'rtsp')).toEqual([]);
  });

  it('NOT_H264: the profile says H.264 and the SDP says H.265 (the RTSP answer)', async () => {
    const stub = await startStub();
    stub.setRtspMode('H265');
    expect(await run(stub)).toEqual({ outcome: 'NOT_H264', reason: 'RTSP_SDP' });
    expect(operations(stub, 'rtsp')).toEqual(['DESCRIBE']);
  });
});

describe('fake ONVIF stub: request log and violations (ST-5)', () => {
  const body = (operation: string, namespace = 'http://www.onvif.org/ver10/device/wsdl'): string => `<tds:${operation} xmlns:tds="${namespace}"/>`;

  it('an operation outside the read-only list is answered with a fault AND recorded', async () => {
    const stub = await startStub();
    const url = stub.addresses().deviceServiceUrl;
    for (const operation of ['GetDeviceInformation', 'SetSystemDateAndTime', 'SystemReboot', 'SetVideoEncoderConfiguration', 'GetScopes']) {
      const answer = await soap(url, body(operation), usernameToken(ACCOUNT, Date.now()));
      expect(answer?.status, operation).toBe(400);
      expect(answer?.body).toContain('ter:ActionNotSupported');
    }
    expect(stub.violations()).toEqual(
      ['GetDeviceInformation', 'SetSystemDateAndTime', 'SystemReboot', 'SetVideoEncoderConfiguration', 'GetScopes'].map((operation) => ({ code: 'OPERATION_NOT_ALLOWED', channel: 'device', operation })),
    );
    // CONTROL: the allowed pre-authentication read is no violation.
    stub.resetLog();
    expect((await soap(url, body('GetSystemDateAndTime')))?.status).toBe(200);
    expect(stub.violations()).toEqual([]);
  });

  it('SETUP and PLAY are answered 405 and recorded: a connection test never opens a media session (ST-4)', async () => {
    const stub = await startStub();
    const uri = stub.addresses().streamUri;
    expect((await rtsp(uri, [`OPTIONS ${uri} RTSP/1.0`, 'CSeq: 1']))?.status).toBe(200);
    expect((await rtsp(uri, [`DESCRIBE ${uri} RTSP/1.0`, 'CSeq: 2']))?.status).toBe(200);
    expect(stub.violations()).toEqual([]);
    expect((await rtsp(uri, [`SETUP ${uri}/trackID=1 RTSP/1.0`, 'CSeq: 3', 'Transport: RTP/AVP/TCP;unicast;interleaved=0-1']))?.status).toBe(405);
    expect((await rtsp(uri, [`PLAY ${uri} RTSP/1.0`, 'CSeq: 4']))?.status).toBe(405);
    expect(stub.violations()).toEqual([
      { code: 'RTSP_METHOD_NOT_ALLOWED', channel: 'rtsp', operation: 'SETUP' },
      { code: 'RTSP_METHOD_NOT_ALLOWED', channel: 'rtsp', operation: 'PLAY' },
    ]);
    expect(operations(stub, 'rtsp')).toEqual(['OPTIONS', 'DESCRIBE', 'SETUP', 'PLAY']);
  });

  it('a password offered in clear is refused and recorded, and the log holds no secret, nonce or user name', async () => {
    const stub = await startStub();
    const url = stub.addresses().deviceServiceUrl;
    const getProfiles = body('GetProfiles', 'http://www.onvif.org/ver10/media/wsdl');
    expect((await soap(url, getProfiles, usernameToken(ACCOUNT, Date.now(), 'Text')))?.status).toBe(401);
    expect((await soap(url, getProfiles, '', { Authorization: `Basic ${Buffer.from(`${ACCOUNT.username}:${ACCOUNT.secret}`).toString('base64')}` }))?.status).toBe(401);
    expect(stub.violations()).toEqual([
      { code: 'PASSWORD_IN_CLEAR', channel: 'device', operation: 'GetProfiles' },
      { code: 'PASSWORD_IN_CLEAR', channel: 'device', operation: 'GetProfiles' },
    ]);
    expect((await soap(url, getProfiles, usernameToken(ACCOUNT, Date.now())))?.status).toBe(200);
    const written = JSON.stringify([stub.requestLog(), stub.violations()]);
    for (const forbidden of [ACCOUNT.secret, ACCOUNT.username, Buffer.from(`${ACCOUNT.username}:${ACCOUNT.secret}`).toString('base64')]) expect(written).not.toContain(forbidden);
    expect(Object.keys(stub.requestLog()[0] ?? {}).sort()).toEqual(['authPresent', 'channel', 'method', 'operation']);
  });

  it('the digest token is checked: a replayed nonce and a token on the wrong clock are refused', async () => {
    const stub = await startStub({ clockOffsetMs: 90_000 });
    const url = stub.addresses().deviceServiceUrl;
    const getProfiles = body('GetProfiles', 'http://www.onvif.org/ver10/media/wsdl');
    // The device's clock is 90 s ahead: a token built on the host's clock is refused ...
    expect((await soap(url, getProfiles, usernameToken(ACCOUNT, Date.now())))?.status).toBe(401);
    // ... and one built on the clock GetSystemDateAndTime states is accepted.
    const clock = deviceTime((await soap(url, body('GetSystemDateAndTime')))?.body ?? '');
    expect(Math.abs(clock - (Date.now() + 90_000))).toBeLessThan(2_000);
    const nonce = randomBytes(16);
    expect((await soap(url, getProfiles, usernameToken(ACCOUNT, clock, 'Digest', nonce)))?.status).toBe(200);
    // The same token again: its nonce was used.
    expect((await soap(url, getProfiles, usernameToken(ACCOUNT, clock, 'Digest', nonce)))?.status).toBe(401);
    // No token at all: 401 with a digest challenge, never a Basic one.
    const bare = await soap(url, getProfiles);
    expect(bare?.status).toBe(401);
    expect(bare?.challenge).toMatch(/^Digest realm="fake-onvif", nonce="[0-9a-f]{32}", qop="auth", algorithm=MD5$/);
    expect(bare?.body).toContain('ter:NotAuthorized');
  });

  it('HTTP Digest is accepted as the other non-clear scheme', async () => {
    const stub = await startStub();
    const url = stub.addresses().deviceServiceUrl;
    const getProfiles = body('GetProfiles', 'http://www.onvif.org/ver10/media/wsdl');
    const challenge = (await soap(url, getProfiles))?.challenge ?? '';
    const nonce = /nonce="([^"]+)"/.exec(challenge)?.[1] ?? '';
    const path = new URL(url).pathname;
    const header = (secret: string): string => {
      const cnonce = randomBytes(8).toString('hex');
      const response = md5(`${md5(`${ACCOUNT.username}:fake-onvif:${secret}`)}:${nonce}:00000001:${cnonce}:auth:${md5(`POST:${path}`)}`);
      return `Digest username="${ACCOUNT.username}", realm="fake-onvif", nonce="${nonce}", uri="${path}", qop=auth, nc=00000001, cnonce="${cnonce}", response="${response}", algorithm=MD5`;
    };
    expect((await soap(url, getProfiles, '', { Authorization: header('not-the-secret') }))?.status).toBe(401);
    expect((await soap(url, getProfiles, '', { Authorization: header(ACCOUNT.secret) }))?.status).toBe(200);
    expect(stub.violations()).toEqual([]);
  });
});

// ── Task 4, blueprint row 109 (WP-22a): the four network calls of the set-camera-address exchange ──
//
// The client below is a REFERENCE again: it writes the requests in the shape the `onvif` package
// writes them (`node_modules/onvif/lib/device.js:230-388`, `lib/cam.js:1165`) and in the order of
// `apps/input-av/nvr/onvif_client.py:200-230`. Every address is of a documentation range (RFC 5737).
describe('fake ONVIF stub: the four network calls (row 109, WP-22a)', () => {
  const DEVICE_NS = 'http://www.onvif.org/ver10/device/wsdl';
  const SCHEMA_NS = 'http://www.onvif.org/ver10/schema';
  const NEW_ADDRESS = '198.51.100.31';
  const NEW_GATEWAY = '198.51.100.1';
  const escape = (value: string): string => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
  const unescape = (value: string): string => value.replaceAll('&lt;', '<').replaceAll('&gt;', '>').replaceAll('&quot;', '"').replaceAll('&amp;', '&');
  const getInterfaces = `<GetNetworkInterfaces xmlns="${DEVICE_NS}"/>`;
  const reboot = `<SystemReboot xmlns="${DEVICE_NS}"/>`;
  /** `token` is written as given: the caller escapes it, or does not. */
  const setInterfaces = (token: string, address: string, prefix: number | string = 24, dhcp = false): string =>
    `<SetNetworkInterfaces xmlns="${DEVICE_NS}"><InterfaceToken>${token}</InterfaceToken><NetworkInterface><Enabled xmlns="${SCHEMA_NS}">true</Enabled>` +
    `<IPv4 xmlns="${SCHEMA_NS}"><Enabled>true</Enabled><Manual><Address>${address}</Address><PrefixLength>${prefix}</PrefixLength></Manual><DHCP>${String(dhcp)}</DHCP></IPv4>` +
    `</NetworkInterface></SetNetworkInterfaces>`;
  const setGateway = (address: string): string => `<SetNetworkDefaultGateway xmlns="${DEVICE_NS}"><IPv4Address>${address}</IPv4Address></SetNetworkDefaultGateway>`;
  const call = (stub: FakeOnvifStub, body: string): Promise<HttpAnswer | null> => soap(stub.addresses().deviceServiceUrl, body, usernameToken(ACCOUNT, Date.now()));
  const tokenOf = (xml: string): string => unescape(/<(?:[\w.-]+:)?NetworkInterfaces\s+token="([^"]*)"/.exec(xml)?.[1] ?? '');

  it('a stub built WITHOUT the network option is unchanged: the four calls are violations, and it has no network mode or state', async () => {
    const stub = await startStub();
    expect(FAKE_ONVIF_NETWORK_OPERATIONS).toEqual(['GetNetworkInterfaces', 'SetNetworkInterfaces', 'SetNetworkDefaultGateway', 'SystemReboot']);
    for (const body of [getInterfaces, setInterfaces('eth0', NEW_ADDRESS), setGateway(NEW_GATEWAY), reboot]) {
      const answer = await call(stub, body);
      expect(answer?.status).toBe(400);
      expect(answer?.body).toContain('ter:ActionNotSupported');
    }
    expect(stub.violations()).toEqual(FAKE_ONVIF_NETWORK_OPERATIONS.map((operation) => ({ code: 'OPERATION_NOT_ALLOWED', channel: 'device', operation })));
    expect(stub.networkRequests()).toEqual([]);
    expect(() => stub.setNetworkMode('MALFORMED_REPLY')).toThrow(/without the network option/);
    expect(() => stub.networkState()).toThrow(/without the network option/);
    // The connection test's five reads stay what they were.
    expect(FAKE_ONVIF_ALLOWED_OPERATIONS).toEqual(['GetSystemDateAndTime', 'GetServices', 'GetCapabilities', 'GetProfiles', 'GetStreamUri']);
  });

  it('the exchange in the reference order: read the interface, set a manual address, set the gateway, reboot - each authenticated, each well-formed, 0 violations', async () => {
    const stub = await startStub({ network: {} });
    const url = stub.addresses().deviceServiceUrl;
    // No account: 401 with a digest challenge, nothing judged, nothing changed.
    for (const body of [getInterfaces, setInterfaces('eth0', NEW_ADDRESS), setGateway(NEW_GATEWAY), reboot]) expect((await soap(url, body))?.status).toBe(401);
    expect((await soap(url, setInterfaces('eth0', NEW_ADDRESS), usernameToken({ ...ACCOUNT, secret: 'not-the-secret' }, Date.now())))?.status).toBe(401);
    expect(stub.networkRequests()).toEqual([]);
    expect(stub.networkState()).toMatchObject({ address: FAKE_ONVIF_NETWORK_DEFAULTS.address, pending: null, rebootCount: 0 });

    const read = await call(stub, getInterfaces);
    expect(read?.status).toBe(200);
    expect(isWellFormedXml(read?.body ?? '')).toBe(true);
    expect(tokenOf(read?.body ?? '')).toBe(FAKE_ONVIF_NETWORK_DEFAULTS.interfaceToken);
    expect(text(read?.body ?? '', 'HwAddress')).toBe(FAKE_ONVIF_NETWORK_DEFAULTS.hwAddress);
    expect(text(read?.body ?? '', 'Address')).toBe(FAKE_ONVIF_NETWORK_DEFAULTS.address);
    expect(text(read?.body ?? '', 'PrefixLength')).toBe('24');

    const set = await call(stub, setInterfaces(tokenOf(read?.body ?? ''), NEW_ADDRESS));
    expect(set?.status).toBe(200);
    expect(text(set?.body ?? '', 'RebootNeeded')).toBe('true');
    // The camera asked for a reboot: the change waits for it.
    expect(stub.networkState()).toMatchObject({ address: FAKE_ONVIF_NETWORK_DEFAULTS.address, pending: { address: NEW_ADDRESS, prefixLength: 24, dhcp: false } });

    const gateway = await call(stub, setGateway(NEW_GATEWAY));
    expect(gateway?.status).toBe(200);
    expect(gateway?.body).toContain('SetNetworkDefaultGatewayResponse');

    const rebooted = await call(stub, reboot);
    expect(rebooted?.status).toBe(200);
    expect(text(rebooted?.body ?? '', 'Message')).toBe('Rebooting');
    expect(stub.networkState()).toMatchObject({ address: NEW_ADDRESS, prefixLength: 24, dhcp: false, gateway: NEW_GATEWAY, pending: null, rebootCount: 1, hwAddress: FAKE_ONVIF_NETWORK_DEFAULTS.hwAddress });
    // The same hardware address at the "new address": the read after the move.
    const after = await call(stub, getInterfaces);
    expect(text(after?.body ?? '', 'Address')).toBe(NEW_ADDRESS);
    expect(text(after?.body ?? '', 'HwAddress')).toBe(FAKE_ONVIF_NETWORK_DEFAULTS.hwAddress);

    expect(stub.violations()).toEqual([]);
    expect(stub.networkRequests().map(({ operation, wellFormed, accepted, refusal }) => ({ operation, wellFormed, accepted, refusal }))).toEqual(
      [...FAKE_ONVIF_NETWORK_OPERATIONS, 'GetNetworkInterfaces'].map((operation) => ({ operation, wellFormed: true, accepted: true, refusal: null })),
    );
    expect(stub.networkRequests()[1]).toMatchObject({ address: NEW_ADDRESS, prefixLength: 24, dhcp: false });
    expect(stub.networkRequests()[2]).toMatchObject({ gateway: NEW_GATEWAY });
    // Nothing of the account in any record, and the stub still listens on 127.0.0.1 only: the "move" is a value.
    const written = JSON.stringify([stub.requestLog(), stub.violations(), stub.networkRequests(), stub.networkState()]);
    for (const forbidden of [ACCOUNT.secret, ACCOUNT.username]) expect(written).not.toContain(forbidden);
    expect([...new Set(stub.addresses().bound.map((entry) => entry.address))]).toEqual([FAKE_ONVIF_HOST]);
    stub.resetLog();
    expect(stub.networkRequests()).toEqual([]);
    expect(stub.networkState().address).toBe(NEW_ADDRESS);
  });

  it('a camera that needs no reboot applies the change at once; a DHCP request is recorded as one', async () => {
    const stub = await startStub({ network: { rebootNeeded: false, address: '203.0.113.10', gateway: '203.0.113.1', hwAddress: '00:00:5e:00:53:02' } });
    expect(stub.networkState()).toMatchObject({ address: '203.0.113.10', gateway: '203.0.113.1', hwAddress: '00:00:5e:00:53:02' });
    const set = await call(stub, setInterfaces('eth0', NEW_ADDRESS, 25));
    expect(text(set?.body ?? '', 'RebootNeeded')).toBe('false');
    expect(stub.networkState()).toMatchObject({ address: NEW_ADDRESS, prefixLength: 25, pending: null, rebootCount: 0 });
    expect((await call(stub, setInterfaces('eth0', NEW_ADDRESS, 25, true)))?.status).toBe(200);
    expect(stub.networkRequests().map((entry) => entry.dhcp)).toEqual([false, true]);
    expect(stub.networkState().dhcp).toBe(true);
    expect(() => createFakeOnvifStub({ ports: { discovery: 40_001, device: 40_002, rtsp: 40_003 }, credential: ACCOUNT, network: { address: 'camera.example' } })).toThrow(RangeError);
  });

  it('refusals are faults with a code and a record: an unknown token, an address that is none, a gateway the camera refuses', async () => {
    const stub = await startStub({ network: { gatewayFault: true } });
    const unknown = await call(stub, setInterfaces('eth9', NEW_ADDRESS));
    expect(unknown?.status).toBe(400);
    expect(unknown?.body).toContain('ter:InvalidNetworkInterfaceToken');
    for (const body of [setInterfaces('eth0', 'camera.example'), setInterfaces('eth0', '198.51.100.300'), setInterfaces('eth0', NEW_ADDRESS, 'wide'), setInterfaces('eth0', NEW_ADDRESS, 33)]) {
      const answer = await call(stub, body);
      expect(answer?.status).toBe(400);
      expect(answer?.body).toContain('ter:InvalidIPv4Address');
    }
    const gateway = await call(stub, setGateway(NEW_GATEWAY));
    expect(gateway?.status).toBe(400);
    expect(gateway?.body).toContain('ter:InvalidGatewayAddress');
    expect(stub.networkRequests().map((entry) => entry.refusal)).toEqual(['INTERFACE_TOKEN_UNKNOWN', 'ADDRESS_INVALID', 'ADDRESS_INVALID', 'ADDRESS_INVALID', 'ADDRESS_INVALID', 'GATEWAY_REFUSED']);
    expect(stub.networkRequests().every((entry) => entry.wellFormed && !entry.accepted)).toBe(true);
    // A text that is no address is never copied into a record.
    expect(stub.networkRequests()[1]?.address).toBeNull();
    expect(stub.networkState()).toMatchObject({ address: FAKE_ONVIF_NETWORK_DEFAULTS.address, gateway: FAKE_ONVIF_NETWORK_DEFAULTS.gateway, pending: null });
    // A refused network call is a fault of the exchange, not a violation of the read-only list.
    expect(stub.violations()).toEqual([]);
  });

  it('the gateway read-back of the client library is a fifth operation: a violation by default, answered only when asked for', async () => {
    const readBack = `<${FAKE_ONVIF_GATEWAY_READ_BACK_OPERATION} xmlns="${DEVICE_NS}"/>`;
    const four = await startStub({ network: {} });
    expect((await call(four, readBack))?.status).toBe(400);
    expect(four.violations()).toEqual([{ code: 'OPERATION_NOT_ALLOWED', channel: 'device', operation: FAKE_ONVIF_GATEWAY_READ_BACK_OPERATION }]);
    expect(four.networkRequests()).toEqual([]);
    const five = await startStub({ network: { gatewayReadBack: true } });
    expect((await call(five, setGateway(NEW_GATEWAY)))?.status).toBe(200);
    const answer = await call(five, readBack);
    expect(answer?.status).toBe(200);
    expect(text(answer?.body ?? '', 'IPv4Address')).toBe(NEW_GATEWAY);
    expect(five.violations()).toEqual([]);
  });

  it('a camera that goes down at the reboot: the call is obeyed and never answered', async () => {
    const stub = await startStub({ network: { rebootDropsConnection: true } });
    expect((await call(stub, setInterfaces('eth0', NEW_ADDRESS)))?.status).toBe(200);
    expect(await call(stub, reboot)).toBeNull();
    expect(stub.networkState()).toMatchObject({ address: NEW_ADDRESS, rebootCount: 1, pending: null });
    expect(stub.networkRequests().at(-1)).toMatchObject({ operation: 'SystemReboot', accepted: true });
  });

  it('mode MALFORMED_REPLY: status 200 and a body that is no XML, for every network call or for the one named; a Set call is still obeyed', async () => {
    const stub = await startStub({ network: {} });
    stub.setNetworkMode('MALFORMED_REPLY');
    for (const body of [getInterfaces, setInterfaces('eth0', NEW_ADDRESS), setGateway(NEW_GATEWAY), reboot]) {
      const answer = await call(stub, body);
      expect(answer?.status).toBe(200);
      expect(answer?.body).toContain('<s:Body>');
      expect(isWellFormedXml(answer?.body ?? '')).toBe(false);
    }
    expect(stub.networkState()).toMatchObject({ address: NEW_ADDRESS, gateway: NEW_GATEWAY, rebootCount: 1 });
    // Only the read: the three other calls answer as a healthy camera does.
    stub.setNetworkMode('MALFORMED_REPLY', 'GetNetworkInterfaces');
    expect(isWellFormedXml((await call(stub, getInterfaces))?.body ?? '')).toBe(false);
    expect(isWellFormedXml((await call(stub, setInterfaces('eth0', NEW_ADDRESS)))?.body ?? '')).toBe(true);
    // The other services are not touched by a network mode.
    const profiles = await call(stub, '<trt:GetProfiles xmlns:trt="http://www.onvif.org/ver10/media/wsdl"/>');
    expect(isWellFormedXml(profiles?.body ?? '')).toBe(true);
    stub.setNetworkMode('NORMAL');
    expect(isWellFormedXml((await call(stub, getInterfaces))?.body ?? '')).toBe(true);
  });

  it('mode OVERSIZED_REPLY: a well-formed body above 2 MiB', async () => {
    const stub = await startStub({ network: {} });
    stub.setNetworkMode('OVERSIZED_REPLY', 'GetNetworkInterfaces');
    const answer = await call(stub, getInterfaces);
    expect(answer?.status).toBe(200);
    expect(FAKE_ONVIF_OVERSIZED_REPLY_BYTES).toBeGreaterThan(1_048_576); // the connection test's byte cap (`onvif-session.ts`)
    expect(Buffer.byteLength(answer?.body ?? '')).toBeGreaterThan(FAKE_ONVIF_OVERSIZED_REPLY_BYTES);
    expect(isWellFormedXml(answer?.body ?? '')).toBe(true);
    expect(tokenOf(answer?.body ?? '')).toBe('eth0');
    expect(Buffer.byteLength((await call(stub, setInterfaces('eth0', NEW_ADDRESS)))?.body ?? '')).toBeLessThan(4_096);
  });

  it('mode MARKUP_TOKEN: the reply is well-formed; the token written back escaped is accepted, written back raw the REQUEST is not well-formed and is refused', async () => {
    const stub = await startStub({ network: {} });
    stub.setNetworkMode('MARKUP_TOKEN');
    const read = await call(stub, getInterfaces);
    expect(isWellFormedXml(read?.body ?? '')).toBe(true);
    const token = tokenOf(read?.body ?? '');
    expect(token).toBe(FAKE_ONVIF_MARKUP_TOKEN);
    for (const character of ['"', '<', '>', "'", '&']) expect(token).toContain(character);
    expect(stub.networkState().interfaceToken).toBe(FAKE_ONVIF_MARKUP_TOKEN);

    // Raw: what a client does that pastes device text into its request.
    const raw = await call(stub, setInterfaces(token, NEW_ADDRESS));
    expect(raw?.status).toBe(400);
    expect(raw?.body).toContain('ter:WellFormed');
    // A token with the markup stripped is another token.
    expect((await call(stub, setInterfaces('eth0', NEW_ADDRESS)))?.body).toContain('ter:InvalidNetworkInterfaceToken');
    expect(stub.networkState().pending).toBeNull();
    // Escaped: the request is well-formed and names the device's token.
    expect((await call(stub, setInterfaces(escape(token), NEW_ADDRESS)))?.status).toBe(200);
    expect(stub.networkRequests().map(({ operation, wellFormed, accepted, refusal }) => ({ operation, wellFormed, accepted, refusal }))).toEqual([
      { operation: 'GetNetworkInterfaces', wellFormed: true, accepted: true, refusal: null },
      { operation: 'SetNetworkInterfaces', wellFormed: false, accepted: false, refusal: 'NOT_WELL_FORMED' },
      { operation: 'SetNetworkInterfaces', wellFormed: true, accepted: false, refusal: 'INTERFACE_TOKEN_UNKNOWN' },
      { operation: 'SetNetworkInterfaces', wellFormed: true, accepted: true, refusal: null },
    ]);
    expect(stub.networkState().pending).toMatchObject({ address: NEW_ADDRESS });
  });

  it('mode TWO_ENDPOINTS: each probe is answered by two endpoint references from the one address; the network calls still answer', async () => {
    const stub = await startStub({ network: {} });
    const references = (answers: readonly Answer[]): Set<string> => new Set(answers.map((answer) => text(answer.text, 'Address') ?? ''));
    expect(references((await search(stub)).answers).size).toBe(1);
    stub.setNetworkMode('TWO_ENDPOINTS');
    const found = await search(stub);
    expect(found.answers).toHaveLength(4); // two probes, two answers each
    expect(found.answers.map((answer) => text(answer.text, 'RelatesTo')).sort()).toEqual([...found.ids, ...found.ids].sort());
    expect([...references(found.answers)].sort()).toEqual([stub.devices()[0]?.endpointRef ?? '', stub.networkState().twinEndpointRef].sort());
    expect([...new Set(found.answers.map((answer) => answer.from.address))]).toEqual([FAKE_ONVIF_HOST]);
    expect(new Set(found.answers.map((answer) => text(answer.text, 'XAddrs'))).size).toBe(1);
    // The stub would obey a set: a refusal on the conflict flag is the product's, shown by 0 Set requests here.
    expect((await call(stub, getInterfaces))?.status).toBe(200);
    // A hostile discovery mode keeps its own answer.
    stub.setDiscoveryMode('SILENT');
    expect((await search(stub)).answers).toHaveLength(0);
    stub.setDiscoveryMode('NORMAL');
    stub.setNetworkMode('NORMAL');
    expect(references((await search(stub)).answers).size).toBe(1);
  });

  // ── Row 109, second pass (wave 10): the request record, the camera that moves, the camera that does not apply ──

  it('the HTTP record: every request with its method, path, SOAP action and operation, and of Authorization the presence and the SCHEME only - on a stub with or without the network option', async () => {
    const stub = await startStub();
    const url = stub.addresses().deviceServiceUrl;
    const port = Number(new URL(url).port);
    const time = '<tds:GetSystemDateAndTime xmlns:tds="http://www.onvif.org/ver10/device/wsdl"/>';
    const profiles = '<trt:GetProfiles xmlns:trt="http://www.onvif.org/ver10/media/wsdl"/>';
    const action = `${DEVICE_NS}/GetNetworkInterfaces`;
    // "0 requests sent" is an empty list.
    expect(stub.httpRequests()).toEqual([]);

    await soap(url, time);
    expect(stub.httpRequests()).toEqual([
      { listener: 'ORIGINAL', port, method: 'POST', path: '/onvif/device_service', queryPresent: false, soapAction: null, operation: 'GetSystemDateAndTime', authorizationPresent: false, authorizationScheme: null, wsSecurity: 'NONE' },
    ]);

    const basic = `Basic ${Buffer.from(`${ACCOUNT.username}:${ACCOUNT.secret}`).toString('base64')}`;
    await soap(url, profiles, '', { Authorization: basic });
    await soap(url, profiles, '', { Authorization: `Digest username="${ACCOUNT.username}", realm="x", nonce="${randomUUID()}", uri="/", response="${md5(ACCOUNT.secret)}"` });
    await soap(url, profiles, '', { Authorization: `bearer ${ACCOUNT.secret}` });
    await soap(url, profiles, '', { Authorization: `X-Own ${ACCOUNT.secret}` });
    await soap(url, profiles, '', { Authorization: ACCOUNT.secret }); // a value with no scheme word before it
    await soap(url, profiles, usernameToken(ACCOUNT, Date.now()));
    await soap(url, profiles, usernameToken(ACCOUNT, Date.now(), 'Text'));
    // The SOAP action: a header (SOAP 1.1), the parameter of Content-Type (SOAP 1.2), and one that is no URI.
    await soap(url, getInterfaces, '', { SOAPAction: `"${action}"` });
    await soap(url, getInterfaces, '', { 'Content-Type': `application/soap+xml; charset=utf-8; action="${action}"` });
    await soap(url, getInterfaces, '', { SOAPAction: `"<x y='${ACCOUNT.secret}'>"` });
    // A query string is counted, never copied.
    await soap(`http://${FAKE_ONVIF_HOST}:${port}/onvif/media_service?user=${ACCOUNT.username}&password=${ACCOUNT.secret}`, time);

    const seen = stub.httpRequests();
    expect(seen.map((entry) => [entry.authorizationPresent, entry.authorizationScheme, entry.wsSecurity])).toEqual([
      [false, null, 'NONE'],
      [true, 'Basic', 'NONE'],
      [true, 'Digest', 'NONE'],
      [true, 'Bearer', 'NONE'],
      [true, 'OTHER', 'NONE'],
      [true, 'OTHER', 'NONE'],
      [false, null, 'DIGEST'],
      [false, null, 'CLEAR'],
      [false, null, 'NONE'],
      [false, null, 'NONE'],
      [false, null, 'NONE'],
      [false, null, 'NONE'],
    ]);
    expect(seen.slice(8).map((entry) => entry.soapAction)).toEqual([action, action, '?', null]);
    expect(seen.at(-1)).toMatchObject({ path: '/onvif/media_service', queryPresent: true, operation: 'GetSystemDateAndTime' });
    expect(seen.every((entry) => entry.method === 'POST' && entry.listener === 'ORIGINAL' && entry.port === port)).toBe(true);
    // The assertion a later row makes: requests that carried the password over Basic.
    expect(seen.filter((entry) => entry.authorizationScheme === 'Basic')).toHaveLength(1);
    // Nothing of the account, in any encoding it was sent in, is in the record.
    const written = JSON.stringify(seen);
    for (const forbidden of [ACCOUNT.secret, ACCOUNT.username, basic.slice(6), md5(ACCOUNT.secret)]) expect(written).not.toContain(forbidden);

    // A request that is never answered is recorded all the same.
    stub.resetLog();
    expect(stub.httpRequests()).toEqual([]);
    stub.setDeviceMode('NO_ANSWER');
    expect(await soap(url, time)).toBeNull();
    expect(stub.httpRequests()).toHaveLength(1);
    expect(stub.httpRequests()[0]).toMatchObject({ operation: 'GetSystemDateAndTime', authorizationPresent: false });
  });

  it("onApply 'MOVE': the camera answers the reboot on its old ports, then listens on the moved ports only - same hardware address, new address, XAddrs of the new place", async () => {
    const moved = await freeFakeOnvifPorts();
    const stub = await startStub({ network: { onApply: 'MOVE', movedPorts: moved } });
    const before = stub.addresses();
    const first = { device: Number(new URL(before.deviceServiceUrl).port), discovery: before.discovery.port };
    expect(await stub.networkSettled()).toBeUndefined(); // nothing under way
    expect((await call(stub, setInterfaces('eth0', NEW_ADDRESS)))?.status).toBe(200);
    // Accepted, waiting for the reboot: nothing moved.
    expect(stub.networkState()).toMatchObject({ location: 'ORIGINAL', address: FAKE_ONVIF_NETWORK_DEFAULTS.address, changesNotApplied: 0 });
    expect(stub.addresses().deviceServiceUrl).toBe(before.deviceServiceUrl);

    const rebooted = await call(stub, reboot);
    expect(rebooted?.status).toBe(200); // the answer came from the OLD port
    await stub.networkSettled();
    expect(stub.networkState()).toMatchObject({ location: 'MOVED', address: NEW_ADDRESS, hwAddress: FAKE_ONVIF_NETWORK_DEFAULTS.hwAddress, pending: null, rebootCount: 1 });

    // The old place is gone: refused, and no probe is answered there.
    expect(await soap(before.deviceServiceUrl, getInterfaces, usernameToken(ACCOUNT, Date.now()))).toBeNull();
    const after = stub.addresses();
    expect(after.deviceServiceUrl).toBe(`http://${FAKE_ONVIF_HOST}:${moved.device}/onvif/device_service`);
    expect(after.streamUri).toBe(`rtsp://${FAKE_ONVIF_HOST}:${moved.rtsp}/stream1`);
    expect(after.discovery).toEqual({ address: FAKE_ONVIF_HOST, port: moved.discovery });
    expect(after.bound.map((entry) => `${entry.listener} ${entry.address}:${entry.port}`).sort()).toEqual(
      [`discovery ${FAKE_ONVIF_HOST}:${moved.discovery}`, `device ${FAKE_ONVIF_HOST}:${moved.device}`, `rtsp ${FAKE_ONVIF_HOST}:${moved.rtsp}`].sort(),
    );

    // The new place answers: the same hardware address reports the new address, and a search finds it there.
    const read = await call(stub, getInterfaces);
    expect(read?.status).toBe(200);
    expect(text(read?.body ?? '', 'Address')).toBe(NEW_ADDRESS);
    expect(text(read?.body ?? '', 'HwAddress')).toBe(FAKE_ONVIF_NETWORK_DEFAULTS.hwAddress);
    const found = await search(stub);
    expect(found.answers).toHaveLength(2);
    expect([...new Set(found.answers.map((answer) => answer.from.port))]).toEqual([moved.discovery]);
    expect([...new Set(found.answers.map((answer) => text(answer.text, 'XAddrs')))]).toEqual([after.deviceServiceUrl]);
    expect((await rtsp(after.streamUri, [`OPTIONS ${after.streamUri} RTSP/1.0`, 'CSeq: 1']))?.status).toBe(200);

    // The record names the place each request reached; the refused one reached nothing.
    expect(stub.httpRequests().map((entry) => [entry.operation, entry.listener, entry.port])).toEqual([
      ['SetNetworkInterfaces', 'ORIGINAL', first.device],
      ['SystemReboot', 'ORIGINAL', first.device],
      ['GetNetworkInterfaces', 'MOVED', moved.device],
    ]);
    // A second change at the new place is a value again: the camera moves once.
    expect((await call(stub, setInterfaces('eth0', '198.51.100.32')))?.status).toBe(200);
    expect((await call(stub, reboot))?.status).toBe(200);
    await stub.networkSettled();
    expect(stub.networkState()).toMatchObject({ location: 'MOVED', address: '198.51.100.32', rebootCount: 2 });
    expect(stub.addresses().deviceServiceUrl).toBe(after.deviceServiceUrl);
    expect(stub.violations()).toEqual([]);
    // Stopped, the moved ports are free again.
    await stub.stop();
    expect(stub.addresses().bound).toEqual([]);
    expect(await soap(after.deviceServiceUrl, getInterfaces)).toBeNull();
  });

  it("onApply 'MOVE' without a reboot, and with a camera that drops the reboot: the move follows the call that applied the address; a DHCP change moves nothing", async () => {
    const atOnce = await startStub({ network: { onApply: 'MOVE', movedPorts: await freeFakeOnvifPorts(), rebootNeeded: false } });
    const old = atOnce.addresses().deviceServiceUrl;
    // The address stays, only the DHCP flag changes: no move.
    expect((await call(atOnce, setInterfaces('eth0', NEW_ADDRESS, 24, true)))?.status).toBe(200);
    await atOnce.networkSettled();
    expect(atOnce.networkState()).toMatchObject({ location: 'ORIGINAL', dhcp: true });
    const set = await call(atOnce, setInterfaces('eth0', NEW_ADDRESS));
    expect(set?.status).toBe(200);
    expect(text(set?.body ?? '', 'RebootNeeded')).toBe('false');
    await atOnce.networkSettled();
    expect(atOnce.networkState()).toMatchObject({ location: 'MOVED', address: NEW_ADDRESS, rebootCount: 0 });
    expect(await soap(old, getInterfaces)).toBeNull();
    expect(text((await call(atOnce, getInterfaces))?.body ?? '', 'Address')).toBe(NEW_ADDRESS);

    const dropping = await startStub({ network: { onApply: 'MOVE', movedPorts: await freeFakeOnvifPorts(), rebootDropsConnection: true } });
    expect((await call(dropping, setInterfaces('eth0', NEW_ADDRESS)))?.status).toBe(200);
    expect(await call(dropping, reboot)).toBeNull();
    await dropping.networkSettled();
    expect(dropping.networkState()).toMatchObject({ location: 'MOVED', address: NEW_ADDRESS, rebootCount: 1 });
    expect((await call(dropping, getInterfaces))?.status).toBe(200);

    // An oversized answer is written whole on the old port before the camera leaves it.
    const large = await startStub({ network: { onApply: 'MOVE', movedPorts: await freeFakeOnvifPorts() } });
    large.setNetworkMode('OVERSIZED_REPLY', 'SystemReboot');
    expect((await call(large, setInterfaces('eth0', NEW_ADDRESS)))?.status).toBe(200);
    const answer = await call(large, reboot);
    expect(Buffer.byteLength(answer?.body ?? '')).toBeGreaterThan(FAKE_ONVIF_OVERSIZED_REPLY_BYTES);
    expect(isWellFormedXml(answer?.body ?? '')).toBe(true);
    await large.networkSettled();
    expect(large.networkState().location).toBe('MOVED');
  });

  it("onApply 'MOVE': the moved ports are checked when the stub is built, and a moved port that is busy is a NAMED failure of networkSettled()", async () => {
    const ports = await freeFakeOnvifPorts();
    const moved = await freeFakeOnvifPorts();
    const build = (network: FakeOnvifStubOptions['network']): FakeOnvifStub => createFakeOnvifStub({ ports, credential: ACCOUNT, network });
    expect(() => build({ onApply: 'MOVE' })).toThrow(RangeError);
    expect(() => build({ movedPorts: moved })).toThrow(RangeError);
    expect(() => build({ onApply: 'NOT_APPLIED', movedPorts: moved })).toThrow(RangeError);
    expect(() => build({ onApply: 'MOVE', movedPorts: ports })).toThrow(RangeError);
    expect(() => build({ onApply: 'MOVE', movedPorts: { ...moved, rtsp: ports.device } })).toThrow(RangeError);
    expect(() => build({ onApply: 'MOVE', movedPorts: { ...moved, device: FAKE_ONVIF_HARNESS_PORT_MIN } })).toThrow(RangeError);

    const stub = build({ onApply: 'MOVE', movedPorts: moved });
    await stub.start();
    running.push(stub);
    const squatter = createServer();
    await new Promise<void>((resolvePromise) => squatter.listen({ host: FAKE_ONVIF_HOST, port: moved.device, exclusive: true }, resolvePromise));
    try {
      expect((await call(stub, setInterfaces('eth0', NEW_ADDRESS)))?.status).toBe(200);
      expect((await call(stub, reboot))?.status).toBe(200);
      await expect(stub.networkSettled()).rejects.toBeInstanceOf(FakeOnvifPortBusyError);
      // It left the old ports and could not take the new ones: it listens nowhere, and does not look for another port.
      expect(stub.addresses().bound).toEqual([]);
    } finally {
      await new Promise<void>((resolvePromise) => squatter.close(() => resolvePromise()));
    }
  });

  it("onApply 'NOT_APPLIED': every call is answered as accepted, and the camera keeps its address, its gateway and its ports", async () => {
    const stub = await startStub({ network: { onApply: 'NOT_APPLIED' } });
    const url = stub.addresses().deviceServiceUrl;
    const set = await call(stub, setInterfaces('eth0', NEW_ADDRESS));
    expect(set?.status).toBe(200);
    expect(text(set?.body ?? '', 'RebootNeeded')).toBe('true');
    expect((await call(stub, setGateway(NEW_GATEWAY)))?.status).toBe(200);
    expect((await call(stub, reboot))?.status).toBe(200);
    await stub.networkSettled();
    expect(stub.networkState()).toMatchObject({
      location: 'ORIGINAL',
      address: FAKE_ONVIF_NETWORK_DEFAULTS.address,
      prefixLength: FAKE_ONVIF_NETWORK_DEFAULTS.prefixLength,
      gateway: FAKE_ONVIF_NETWORK_DEFAULTS.gateway,
      dhcp: false,
      pending: null,
      rebootCount: 1,
      changesNotApplied: 1,
    });
    // To the client nothing looked wrong: three accepted requests, 0 faults, 0 violations.
    expect(stub.networkRequests().map(({ operation, accepted, refusal }) => ({ operation, accepted, refusal }))).toEqual(
      ['SetNetworkInterfaces', 'SetNetworkDefaultGateway', 'SystemReboot'].map((operation) => ({ operation, accepted: true, refusal: null })),
    );
    expect(stub.violations()).toEqual([]);
    // The camera is where it was and says so.
    expect(stub.addresses().deviceServiceUrl).toBe(url);
    const read = await call(stub, getInterfaces);
    expect(text(read?.body ?? '', 'Address')).toBe(FAKE_ONVIF_NETWORK_DEFAULTS.address);
    expect(stub.httpRequests().every((entry) => entry.listener === 'ORIGINAL')).toBe(true);
    // Without a reboot the change is dropped at the Set call.
    const atOnce = await startStub({ network: { onApply: 'NOT_APPLIED', rebootNeeded: false } });
    expect((await call(atOnce, setInterfaces('eth0', NEW_ADDRESS)))?.status).toBe(200);
    expect(atOnce.networkState()).toMatchObject({ address: FAKE_ONVIF_NETWORK_DEFAULTS.address, pending: null, changesNotApplied: 1, rebootCount: 0 });
  });

  it('mode MARKUP_TEXT: the free-text fields of the replies carry markup characters, escaped; the token and the hardware address are untouched', async () => {
    const stub = await startStub({ network: {} });
    stub.setNetworkMode('MARKUP_TEXT');
    for (const character of ['<', '>', '&', '"', "'", '${', '{{']) expect(FAKE_ONVIF_MARKUP_TEXT).toContain(character);
    const read = await call(stub, getInterfaces);
    expect(read?.status).toBe(200);
    expect(isWellFormedXml(read?.body ?? '')).toBe(true);
    expect(read?.body).not.toContain('<script>');
    expect(unescape(text(read?.body ?? '', 'Name') ?? '')).toBe(FAKE_ONVIF_MARKUP_TEXT);
    expect(tokenOf(read?.body ?? '')).toBe(FAKE_ONVIF_NETWORK_DEFAULTS.interfaceToken);
    expect(text(read?.body ?? '', 'HwAddress')).toBe(FAKE_ONVIF_NETWORK_DEFAULTS.hwAddress);
    expect((await call(stub, setInterfaces('eth0', NEW_ADDRESS)))?.status).toBe(200);
    const rebooted = await call(stub, reboot);
    expect(isWellFormedXml(rebooted?.body ?? '')).toBe(true);
    expect(unescape(text(rebooted?.body ?? '', 'Message') ?? '')).toBe(FAKE_ONVIF_MARKUP_TEXT);
    stub.setNetworkMode('NORMAL');
    expect(text((await call(stub, getInterfaces))?.body ?? '', 'Name')).toBe('eth0');
  });

  it('the judge of a request: one well-formed element, or not', () => {
    const good = [
      '<a/>',
      '<?xml version="1.0" encoding="UTF-8"?><s:Envelope xmlns:s="urn:x"><s:Body><t:Op xmlns:t=\'urn:y\'>a &amp; b &#60; &#x3e;</t:Op></s:Body></s:Envelope>',
      '<a><!-- a comment with <b> in it --><b c="1" d="2"/> text > text </a>\n',
      `<a>${escape(FAKE_ONVIF_MARKUP_TOKEN)}</a>`,
    ];
    const bad = [
      '',
      'text',
      '<a>',
      '<a></b>',
      '<a><b></a></b>',
      '<a/><b/>',
      '<a>&</a>',
      '<a>&nbsp;</a>',
      '<a b=1/>',
      '<a b="<"/>',
      '<a><</a>',
      '<a><!-- open</a>',
      '<!DOCTYPE a [<!ENTITY e "x">]><a>&e;</a>',
      '<a><![CDATA[x]]></a>',
      `<a>${FAKE_ONVIF_MARKUP_TOKEN}</a>`,
      'before<a/>',
    ];
    for (const xml of good) expect(isWellFormedXml(xml), xml).toBe(true);
    for (const xml of bad) expect(isWellFormedXml(xml), xml).toBe(false);
  });
});

// ── Task 4, integration pass I-2 (request of row 26): the profile set of a camera with two video sources ──
describe('fake ONVIF stub: the option `profileSet` (two video sources, several profiles each, odd tokens)', () => {
  const MEDIA_NS = 'http://www.onvif.org/ver10/media/wsdl';
  const getProfiles = `<trt:GetProfiles xmlns:trt="${MEDIA_NS}"/>`;
  const getStreamUri = (token: string): string =>
    `<trt:GetStreamUri xmlns:trt="${MEDIA_NS}"><trt:StreamSetup><tt:Stream xmlns:tt="http://www.onvif.org/ver10/schema">RTP-Unicast</tt:Stream></trt:StreamSetup><trt:ProfileToken>${token}</trt:ProfileToken></trt:GetStreamUri>`;
  const call = (stub: FakeOnvifStub, body: string): Promise<HttpAnswer | null> => soap(stub.addresses().deviceServiceUrl, body, usernameToken(ACCOUNT, Date.now()));
  /** token, source, width, height of every listed profile, in the device's order. */
  const listed = (xml: string): Array<[string, string, number, number]> =>
    [...xml.matchAll(/<trt:Profiles token="([^"]*)"[\s\S]*?<tt:SourceToken>([^<]*)<[\s\S]*?<tt:Width>(\d+)<\/tt:Width><tt:Height>(\d+)<\/tt:Height>[\s\S]*?<\/trt:Profiles>/g)].map((found) => [found[1] ?? '', found[2] ?? '', Number(found[3]), Number(found[4])]);

  it('lists five profiles on two sources with different pixel areas, answers GetStreamUri per token, and faults for a token it does not list; a stub built without the option is unchanged', async () => {
    const stub = await startStub({ profileSet: 'TWO_SOURCES' });
    const profiles = listed((await call(stub, getProfiles))?.body ?? '');
    expect(profiles).toEqual(FAKE_ONVIF_TWO_SOURCE_PROFILES.map((profile) => [profile.token, profile.videoSourceToken, profile.width, profile.height]));
    // The shape the request asked for: two sources, several profiles each, every area of a source its own, the largest never first.
    const bySource = new Map<string, number[]>();
    for (const [, source, width, height] of profiles) bySource.set(source, [...(bySource.get(source) ?? []), width * height]);
    expect(bySource.size).toBe(2);
    for (const areas of bySource.values()) {
      expect(areas.length).toBeGreaterThan(1);
      expect(new Set(areas).size).toBe(areas.length);
      expect(areas[0]).not.toBe(Math.max(...areas));
    }
    expect(FAKE_ONVIF_ODD_PROFILE_TOKEN).toMatch(/[a-z]/);
    for (const mark of ['.', ':', '-']) expect(FAKE_ONVIF_ODD_PROFILE_TOKEN).toContain(mark);
    expect(profiles.map(([token]) => token)).toContain(FAKE_ONVIF_ODD_PROFILE_TOKEN);

    // One stream address per profile, each on the stub's own RTSP port; the five differ.
    const port = Number(new URL(stub.addresses().streamUri).port);
    const addresses: string[] = [];
    for (const profile of FAKE_ONVIF_TWO_SOURCE_PROFILES) {
      const answer = await call(stub, getStreamUri(profile.token));
      expect(answer?.status, profile.token).toBe(200);
      expect(text(answer?.body ?? '', 'Uri'), profile.token).toBe(fakeOnvifProfileStreamUri(port, profile));
      addresses.push(text(answer?.body ?? '', 'Uri') ?? '');
    }
    expect(new Set(addresses).size).toBe(FAKE_ONVIF_TWO_SOURCE_PROFILES.length);
    expect(addresses.every((address) => address.startsWith(`rtsp://${FAKE_ONVIF_HOST}:${port}/`))).toBe(true);
    // A token the device does not list (the one profile of the default stub among them): a fault, not an address.
    for (const token of ['profile_1', 'main.stream:0-a', '']) {
      const answer = await call(stub, getStreamUri(token));
      expect(answer?.status, token).toBe(400);
      expect(answer?.body, token).toContain('ter:NoProfile');
      expect(answer?.body, token).not.toContain('<tt:Uri>');
    }
    // Authentication is what it was: without a token both reads are refused. Nothing was a violation.
    expect((await soap(stub.addresses().deviceServiceUrl, getProfiles))?.status).toBe(401);
    expect((await soap(stub.addresses().deviceServiceUrl, getStreamUri(FAKE_ONVIF_ODD_PROFILE_TOKEN)))?.status).toBe(401);
    expect(stub.violations()).toEqual([]);
    // The device modes still apply: no profile, and the one foreign stream address.
    stub.setDeviceMode('NO_PROFILE');
    expect(listed((await call(stub, getProfiles))?.body ?? '')).toEqual([]);
    stub.setDeviceMode('FOREIGN_STREAM_HOST');
    expect(text((await call(stub, getStreamUri('lens1.main')))?.body ?? '', 'Uri')).toBe(`rtsp://${FAKE_ONVIF_FOREIGN_HOST}:554/stream1`);

    // Control: without the option the stub lists its one profile and names its one address for whatever token is asked.
    const plain = await startStub();
    expect(listed((await call(plain, getProfiles))?.body ?? '')).toEqual([['profile_1', 'vs_1', 1920, 1080]]);
    for (const token of ['profile_1', FAKE_ONVIF_ODD_PROFILE_TOKEN]) {
      expect(text((await call(plain, getStreamUri(token)))?.body ?? '', 'Uri'), token).toBe(plain.addresses().streamUri);
    }
  });
});
