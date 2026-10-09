// The WS-Discovery probe on the fake ONVIF stub, loopback only (blueprint row 131; checks
// M4-DISC-NOLAN-1, M4-DISC-SOCK-1, M4-SEC-DISC-1 (the socket half), M4-SEC-DISC-4, and the adapter
// half of M4-DISC-STUB-1; capture spec §A.6.1, §A.8.1 ST-1, ST-2, ST-5; specs C-N13, R-9 AC-14).
//
// Real datagram sockets on 127.0.0.1 (the sandbox must allow loopback binding). No camera, no LAN:
// the loopback guard is installed for the whole file and REFUSES any other destination before it
// reaches the operating system, so these tests pass with the network cable out.
// EVERY RULE HAS ITS CONTROL.
import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { createSocket } from 'node:dgram';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { manualCaptureTimers } from '../../../../../test/support/capture';
import type { FakeOnvifDiscoveryMode, FakeOnvifStub } from '../../../../../test/support/fake-onvif-stub';
import { createSystemTimers } from '../../../timers';
import { CaptureAdapterError } from '../../errors';
import { createCaptureDeviceRegistry } from '../../registry';
import type { InterfaceTable } from '../discovery-collector';
import { createOnvifDiscoveryAdapter } from '../onvif-discovery';
import { DiscoveryNotRunError, WS_DISCOVERY_GROUP, WS_DISCOVERY_REPEAT_MS, type WsDiscoveryOptions, type WsDiscoveryResult } from '../ws-discovery';
import { LAN_A, LAN_B, LOOPBACK, datagramSockets, delay, installLoopbackGuard, interfaceTable, startFakeOnvif, until, type LoopbackGuard } from './support';

const WINDOW_MS = 400;
let guard: LoopbackGuard;
let stubs: FakeOnvifStub[] = [];

beforeAll(() => {
  guard = installLoopbackGuard();
});
afterAll(() => {
  guard.restore();
});
afterEach(async () => {
  for (const stub of stubs) await stub.stop();
  stubs = [];
});

async function stubWith(devices: number, mode: FakeOnvifDiscoveryMode = 'NORMAL'): Promise<FakeOnvifStub> {
  const stub = await startFakeOnvif(devices);
  stub.setDiscoveryMode(mode);
  stubs.push(stub);
  return stub;
}

const adapterOn = (stub: FakeOnvifStub, more: Partial<WsDiscoveryOptions> = {}) =>
  createOnvifDiscoveryAdapter({ timers: createSystemTimers(), newMessageId: randomUUID, loopbackFixture: stub.addresses().discovery, ...more });

const search = (stub: FakeOnvifStub, more: Partial<WsDiscoveryOptions> = {}, windowMs = WINDOW_MS): Promise<WsDiscoveryResult> =>
  adapterOn(stub, more).discover({ windowMs, signal: new AbortController().signal });

const probes = (stub: FakeOnvifStub): number => stub.requestLog().filter((entry) => entry.channel === 'discovery' && entry.operation === 'Probe').length;

/** What a rejected search rejected with: the error's class name and its code. */
async function refusal(attempt: Promise<unknown>): Promise<string> {
  try {
    await attempt;
  } catch (error) {
    if (error instanceof DiscoveryNotRunError || error instanceof CaptureAdapterError) return `${error.name}/${error.code}`;
    throw error;
  }
  return 'RESOLVED';
}

describe('M4-DISC-STUB-1 (adapter half): a search lists what answered, from the probe answer alone', () => {
  it('N = 1: one candidate with the announced endpoint reference, name and hardware; nothing but four probes reached the stub', async () => {
    const stub = await stubWith(1);
    const result = await search(stub);
    const [device] = stub.devices();
    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0]).toMatchObject({
      adapterKind: 'FAKE',
      host: LOOPBACK,
      serviceAddress: stub.addresses().deviceServiceUrl,
      endpointRef: device?.endpointRef,
      name: device?.name,
      model: device?.hardware,
      vendor: null,
      testable: true,
      conflict: false,
      registered: false,
    });
    expect(result).toMatchObject({ responderCount: 1, interfaceCount: 1, truncated: false });
    // Two typed probes, each sent twice; the device answered each, and three of the four are repeats.
    expect(result.counts).toMatchObject({ datagramsSent: 4, sendErrors: 0, handlerErrors: 0, datagramsReceived: 4, datagramsAccepted: 4, repeats: 3, dropped: {} });
    // ST-5: the request log. No device-service request, no RTSP request, nothing authenticated, no violation (D80(1), D76 (1)).
    expect(stub.requestLog().map((entry) => `${entry.channel}/${entry.operation}/${entry.authPresent}`)).toEqual(Array.from({ length: 4 }, () => 'discovery/Probe/false'));
    expect(stub.violations()).toEqual([]);
  });

  it('N = 0 is a successful, empty result: "nothing found" is not "could not run" (DS-13)', async () => {
    const stub = await stubWith(0);
    const result = await search(stub);
    expect(result).toMatchObject({ candidates: [], responderCount: 0, interfaceCount: 1, truncated: false });
    expect(result.counts).toMatchObject({ datagramsSent: 4, datagramsReceived: 0 });
    expect(probes(stub)).toBe(4);
  });

  it('N = 3: three candidates. The stub announces all three from ONE address, so they are marked as conflicting (two identities, one address)', async () => {
    const stub = await stubWith(3);
    const result = await search(stub);
    expect(result.candidates.map((candidate) => candidate.endpointRef).sort()).toEqual(stub.devices().map((device) => device.endpointRef).sort());
    expect(result.candidates.map((candidate) => candidate.name).sort()).toEqual(['Fake Camera 1', 'Fake Camera 2', 'Fake Camera 3']);
    expect(result.candidates.every((candidate) => candidate.conflict && !candidate.testable)).toBe(true);
    expect(result.responderCount).toBe(3);
    expect(stub.requestLog().every((entry) => entry.channel === 'discovery')).toBe(true);
  });

  it('must fail when: a count that differs from N is seen (control on the same assertion)', async () => {
    const stub = await stubWith(3);
    stub.setDiscoveryMode('SILENT');
    expect((await search(stub)).candidates).toHaveLength(0);
  });

  it('the two probes carry two fresh message IDs, the two types, and nothing of this product', async () => {
    const seen: string[] = [];
    const tap = createSocket({ type: 'udp4' });
    await new Promise<void>((resolvePromise) => tap.bind({ address: LOOPBACK, port: 0 }, resolvePromise));
    tap.on('message', (bytes) => void seen.push(bytes.toString('utf8')));
    try {
      const ids = [randomUUID(), randomUUID()];
      let next = 0;
      const adapter = createOnvifDiscoveryAdapter({ timers: createSystemTimers(), newMessageId: () => ids[next++] ?? randomUUID(), loopbackFixture: { address: LOOPBACK, port: tap.address().port } });
      const result = await adapter.discover({ windowMs: 350, signal: new AbortController().signal });
      expect(result.candidates).toEqual([]);
      expect(seen).toHaveLength(4);
      expect(seen[0]).toContain(`<a:MessageID>urn:uuid:${ids[0]}</a:MessageID>`);
      expect(seen[0]).toContain('<d:Types>tds:Device</d:Types>');
      expect(seen[1]).toContain(`<a:MessageID>urn:uuid:${ids[1]}</a:MessageID>`);
      expect(seen[1]).toContain('<d:Types>dn:NetworkVideoTransmitter</d:Types>');
      // The repeat is the same two datagrams, byte for byte (same message IDs).
      expect(seen.slice(2)).toEqual(seen.slice(0, 2));
      expect(seen.join('')).not.toMatch(/dems|core-server|Scopes/i);
      expect(next).toBe(2);
    } finally {
      await new Promise<void>((resolvePromise) => tap.close(() => resolvePromise()));
    }
  });

  it('the repeat goes out 250 ms after the first round, and the window ends the search (fake clock)', async () => {
    const stub = await stubWith(1);
    const clock = manualCaptureTimers();
    const pending = adapterOn(stub, { timers: clock.timers }).discover({ windowMs: 3_000, signal: new AbortController().signal });
    await until(() => probes(stub) === 2);
    await until(() => clock.armed().length === 2);
    expect(clock.armed()).toEqual([WS_DISCOVERY_REPEAT_MS, 3_000]);
    clock.advance(WS_DISCOVERY_REPEAT_MS - 1);
    await delay(20);
    expect(probes(stub)).toBe(2);
    clock.advance(1);
    await until(() => probes(stub) === 4);
    await delay(30);
    clock.advance(3_000 - WS_DISCOVERY_REPEAT_MS - 1);
    let settled = false;
    void pending.then(() => (settled = true));
    await delay(20);
    expect(settled).toBe(false);
    clock.advance(1);
    const result = await pending;
    expect(result.candidates).toHaveLength(1);
    expect(clock.armed()).toEqual([]);
  });
});

describe('M4-SEC-DISC-1 on the stub: each hostile answer of ST-2 is dropped and counted, and the search completes', () => {
  const cases: readonly [FakeOnvifDiscoveryMode, number, string | null][] = [
    ['WRONG_RELATES_TO', 0, 'RELATES_TO_MISMATCH'],
    ['EMPTY_MATCHES', 0, 'NO_PROBE_MATCH'],
    ['OVERSIZED_BODY', 0, 'OVERSIZED'],
    ['ENTITY_EXPANSION', 0, 'DECLARATION'],
    ['NOT_XML', 0, 'NOT_XML'],
    ['FOREIGN_XADDR', 1, null],
    ['NO_XADDRS', 1, null],
    // The stub's second ProbeMatch carries a fresh endpoint reference in each of its four answers: 1 + 4.
    ['TWO_MATCHES_IN_ONE', 5, null],
  ];
  for (const [mode, listed, drop] of cases) {
    it(`${mode}: ${listed} listed${drop === null ? '' : `, dropped as ${drop}`}`, async () => {
      const stub = await stubWith(1, mode);
      const result = await search(stub);
      expect(result.candidates).toHaveLength(listed);
      expect(result.counts.handlerErrors).toBe(0);
      if (drop !== null) expect(result.counts.dropped).toEqual({ [drop]: 4 });
      // Whatever was listed, none of it can be connected to: a foreign or missing address, or two identities at one address.
      expect(result.candidates.filter((candidate) => candidate.testable)).toEqual([]);
      if (mode === 'FOREIGN_XADDR') expect(result.candidates[0]).toMatchObject({ serviceAddress: null, reason: 'ADDRESS_MISMATCH' });
      if (mode === 'NO_XADDRS') expect(result.candidates[0]).toMatchObject({ serviceAddress: null, reason: 'NO_SERVICE_ADDRESS' });
      if (mode === 'TWO_MATCHES_IN_ONE') expect(result.candidates.every((candidate) => candidate.conflict)).toBe(true);
      expect(JSON.stringify(result.candidates)).not.toContain('192.0.2.10');
    });
  }

  it('an answer nobody asked for, sent to the open socket, is dropped; the asked-for answer beside it is listed', async () => {
    const stub = await stubWith(1);
    guard.reset();
    const clock = manualCaptureTimers();
    const pending = adapterOn(stub, { timers: clock.timers }).discover({ windowMs: 3_000, signal: new AbortController().signal });
    await until(() => probes(stub) === 2);
    const stubPorts = stub.addresses().bound.map((entry) => entry.port);
    const [searchPort] = guard.senderPorts().filter((port) => !stubPorts.includes(port));
    expect(searchPort).toBeGreaterThan(0);
    await stub.sendUnsolicited({ address: LOOPBACK, port: searchPort ?? 0 });
    await stub.sendUnsolicited({ address: LOOPBACK, port: searchPort ?? 0 });
    await delay(40);
    clock.advance(3_000);
    const result = await pending;
    expect(result.candidates).toHaveLength(1);
    expect(result.counts.dropped).toEqual({ RELATES_TO_MISMATCH: 2 });
  });

  it('FLOOD_300: the 256th datagram closes the socket at once - the window timer never fires - and 64 are listed, truncated', async () => {
    const stub = await stubWith(1, 'FLOOD_300');
    const clock = manualCaptureTimers();
    const before = datagramSockets();
    const result = await adapterOn(stub, { timers: clock.timers }).discover({ windowMs: 3_000, signal: new AbortController().signal });
    expect(clock.now()).toBe(manualCaptureTimers().now()); // the clock was never advanced
    expect(clock.armed()).toEqual([]);
    expect(result.candidates).toHaveLength(64);
    expect(result).toMatchObject({ truncated: true, counts: { datagramsReceived: 256, handlerErrors: 0 } });
    expect(result.responderCount).toBeGreaterThan(64);
    expect(datagramSockets()).toBe(before - 0);
  });

  it('a reader made to throw on every datagram: 0 uncaught exceptions, every datagram counted, the search completes with an empty list', async () => {
    const uncaught: unknown[] = [];
    const onUncaught = (error: unknown): void => void uncaught.push(error);
    process.on('uncaughtException', onUncaught);
    try {
      const stub = await stubWith(1, 'FLOOD_300');
      const result = await search(stub, {
        read: () => {
          throw new TypeError("Cannot read properties of undefined (reading 'address')");
        },
      });
      await delay(20);
      expect(uncaught).toEqual([]);
      expect(result.candidates).toEqual([]);
      expect(result.counts.handlerErrors).toBeGreaterThanOrEqual(256);
      // A registry lookup that throws loses no device and stops nothing.
      stub.setDiscoveryMode('NORMAL');
      const second = await search(stub, {
        registered: () => {
          throw new Error('lookup failed');
        },
      });
      // The device is still listed, as not registered; the failure is counted once (the other three answers are repeats).
      expect(second.candidates).toHaveLength(1);
      expect(second.candidates[0]).toMatchObject({ registered: false, testable: true });
      expect(second.counts).toMatchObject({ lookupErrors: 1, handlerErrors: 0 });
      expect(uncaught).toEqual([]);
    } finally {
      process.off('uncaughtException', onUncaught);
    }
  });

  it('negative control: the same throw in a datagram handler WITHOUT the try / catch ends a process; with it, the process ends cleanly', () => {
    const script = (contained: boolean): string =>
      [
        "const dgram = require('node:dgram');",
        "const socket = dgram.createSocket('udp4');",
        "const parse = () => { throw new TypeError('thrown inside the parse callback'); };",
        contained ? "socket.on('message', () => { try { parse(); } catch { /* counted, dropped */ } socket.close(); });" : "socket.on('message', () => { parse(); socket.close(); });",
        "socket.bind(0, '127.0.0.1', () => socket.send('x', socket.address().port, '127.0.0.1'));",
        'setTimeout(() => process.exit(3), 5000).unref();',
      ].join('\n');
    const bare = spawnSync(process.execPath, ['-e', script(false)], { encoding: 'utf8', env: {} });
    expect(bare.status).toBe(1);
    expect(bare.stderr).toContain('thrown inside the parse callback');
    const contained = spawnSync(process.execPath, ['-e', script(true)], { encoding: 'utf8', env: {} });
    expect(contained.status).toBe(0);
  });
});

describe('M4-DISC-SOCK-1: one datagram socket for the duration of a search, none before and none after', () => {
  it('0 before, 1 during the window, 0 after it (counted by the operating system, relative to the stub\'s own socket)', async () => {
    const stub = await stubWith(1);
    const before = datagramSockets();
    const clock = manualCaptureTimers();
    const pending = adapterOn(stub, { timers: clock.timers }).discover({ windowMs: 3_000, signal: new AbortController().signal });
    await until(() => probes(stub) === 2);
    expect(datagramSockets() - before).toBe(1);
    clock.advance(WS_DISCOVERY_REPEAT_MS);
    await until(() => probes(stub) === 4);
    expect(datagramSockets() - before).toBe(1);
    clock.advance(3_000);
    await pending;
    expect(datagramSockets() - before).toBe(0);
    // A second search opens a new socket and closes it again: none is kept between searches.
    await search(stub, {}, 150);
    expect(datagramSockets() - before).toBe(0);
  });

  it('negative control: a socket that is left open after the window is seen by the snapshot', async () => {
    const before = datagramSockets();
    const left = createSocket({ type: 'udp4' });
    await new Promise<void>((resolvePromise) => left.bind({ address: LOOPBACK, port: 0 }, resolvePromise));
    expect(datagramSockets() - before).toBe(1);
    await new Promise<void>((resolvePromise) => left.close(() => resolvePromise()));
    expect(datagramSockets() - before).toBe(0);
  });

  it('0 after each error path: abort, a refused bind, a refused send, a reader that throws, no eligible interface', async () => {
    const stub = await stubWith(1);
    const before = datagramSockets();

    // Abort in the middle of the window.
    const clock = manualCaptureTimers();
    const abort = new AbortController();
    const aborted = adapterOn(stub, { timers: clock.timers }).discover({ windowMs: 3_000, signal: abort.signal });
    await until(() => probes(stub) === 2);
    expect(datagramSockets() - before).toBe(1);
    abort.abort();
    expect(await refusal(aborted)).toBe('CaptureAdapterError/CAPTURE_ADAPTER_ABORTED');
    expect(datagramSockets() - before).toBe(0);
    expect(clock.armed()).toEqual([]);

    // Aborted before it starts: no socket is opened at all.
    const already = new AbortController();
    already.abort();
    expect(await refusal(adapterOn(stub).discover({ windowMs: WINDOW_MS, signal: already.signal }))).toBe('CaptureAdapterError/CAPTURE_ADAPTER_ABORTED');
    expect(datagramSockets() - before).toBe(0);

    // A bind the operating system refuses: an interface address this host does not have (a documentation address).
    const unbound = createOnvifDiscoveryAdapter({ timers: createSystemTimers(), newMessageId: randomUUID, interfaces: () => interfaceTable(LAN_A) });
    expect(await refusal(unbound.discover({ windowMs: WINDOW_MS, signal: new AbortController().signal }))).toBe('DiscoveryNotRunError/SOCKET_ERROR');
    expect(datagramSockets() - before).toBe(0);

    // A reader that throws on every datagram.
    await search(stub, { read: () => { throw new Error('x'); } }, 150);
    expect(datagramSockets() - before).toBe(0);

    // No eligible interface: the search does not run and opens nothing.
    expect(await refusal(search(stub, { interfaces: () => interfaceTable() }))).toBe('DiscoveryNotRunError/NO_ELIGIBLE_INTERFACE');
    expect(datagramSockets() - before).toBe(0);
  });
});

describe('M4-DISC-NOLAN-1: the automated suite never leaves loopback', () => {
  it('negative control: a search that keeps the product\'s multicast target is refused by the test-support guard before a datagram is sent', async () => {
    const stub = await stubWith(1);
    guard.reset();
    // The product path (no loopback fixture), on an interface table that lets the bind succeed on this host.
    const lanLike: InterfaceTable = { test0: [{ address: LOOPBACK, netmask: '255.0.0.0', family: 'IPv4', mac: '02:00:00:00:00:01', internal: false }] };
    const product = createOnvifDiscoveryAdapter({ timers: createSystemTimers(), newMessageId: randomUUID, interfaces: () => lanLike });
    const before = datagramSockets();
    const attempt = product.discover({ windowMs: WINDOW_MS, signal: new AbortController().signal });
    let error: unknown = null;
    await attempt.catch((caught: unknown) => (error = caught));
    // "The search could not run" - never an empty list.
    expect(error).toBeInstanceOf(DiscoveryNotRunError);
    expect(error).toMatchObject({ code: 'SOCKET_ERROR', datagramsSent: 0 });
    // The first refusal ends the round: the second probe is not even attempted.
    expect(guard.refused()).toEqual([WS_DISCOVERY_GROUP.address]);
    expect(guard.datagrams()).toEqual([]);
    expect(probes(stub)).toBe(0);
    expect(datagramSockets() - before).toBe(0);
    // The text of the error names no address.
    expect(String((error as Error).message)).not.toMatch(/\d+\.\d+\.\d+\.\d+/);
  });

  it('every datagram of a search and of the stub goes to 127.0.0.1, and no TCP connection is made at all', async () => {
    const stub = await stubWith(3);
    guard.reset();
    await search(stub);
    await search(stub, { interfaces: () => interfaceTable(LAN_A, LAN_B) });
    expect(guard.datagrams().length).toBeGreaterThanOrEqual(4 + 8);
    expect(new Set(guard.datagrams())).toEqual(new Set([LOOPBACK]));
    expect(guard.refused()).toEqual([]);
    expect(guard.connections()).toEqual([]);
    expect(stub.requestLog().filter((entry) => entry.channel !== 'discovery')).toEqual([]);
  });

  it('the injected target can be nothing but 127.0.0.1: any other address is refused when the adapter is built', () => {
    const build = (address: string, port: number) => () => createOnvifDiscoveryAdapter({ timers: createSystemTimers(), newMessageId: randomUUID, loopbackFixture: { address, port } });
    for (const [address, port] of [['192.0.2.10', 3702], [WS_DISCOVERY_GROUP.address, 3702], ['localhost', 3702], ['127.0.0.2', 3702], [LOOPBACK, 0], [LOOPBACK, 70_000], [LOOPBACK, 1.5]] as const) {
      expect(build(address, port), `${address}:${port}`).toThrow(CaptureAdapterError);
    }
    expect(build(LOOPBACK, 8_564)).not.toThrow();
    expect(WS_DISCOVERY_GROUP).toEqual({ address: '239.255.255.250', port: 3702 });
  });
});

describe('M4-SEC-DISC-4: the result says how many interfaces were probed, and nothing else about them', () => {
  it('two interfaces: the count is 2, the probes went out once per interface, and no name or address of an interface is in the result', async () => {
    const stub = await stubWith(1);
    const result = await search(stub, { interfaces: () => interfaceTable(LAN_A, LAN_B) });
    expect(result.interfaceCount).toBe(2);
    expect(result.counts.datagramsSent).toBe(8);
    expect(probes(stub)).toBe(8);
    const text = JSON.stringify({ ...result, candidates: [] });
    for (const identifying of [LAN_A.address, LAN_B.address, LAN_A.netmask, 'en0', 'en1', '02:00:00']) expect(text).not.toContain(identifying);
    expect(Object.keys(result).sort()).toEqual(['candidates', 'counts', 'interfaceCount', 'responderCount', 'truncated']);
    expect(Object.values(result.counts).every((value) => typeof value === 'number' || Object.values(value as object).every((count) => typeof count === 'number'))).toBe(true);
    // Control: one interface reads 1.
    expect((await search(stub)).interfaceCount).toBe(1);
  });
});

describe('the seam', () => {
  it('is a camera adapter of kind ONVIF_RTSP with no device and no opener; the registry takes it where rule RG-1 allows a search', async () => {
    const stub = await stubWith(0);
    const adapter = adapterOn(stub);
    expect(adapter).toMatchObject({ seam: 'CAMERA', kind: 'ONVIF_RTSP', devices: [], hasOpener: false });
    for (const operation of ['REAL_PRODUCTION', 'REAL_DEVELOPMENT'] as const) {
      const registry = createCaptureDeviceRegistry({ operation });
      registry.register(adapter);
      expect(registry.cameraAdapters()).toEqual([adapter]);
      expect(registry.list()).toEqual([]);
      expect(registry.openerKinds()).toEqual([]);
    }
    expect(() => createCaptureDeviceRegistry({ operation: 'SIMULATED' }).register(adapter)).toThrow(CaptureAdapterError);
  });

  it('makes no connection and no authenticated or configuration call: every other member refuses', async () => {
    const stub = await stubWith(1);
    const adapter = adapterOn(stub);
    const { candidates } = await adapter.discover({ windowMs: 150, signal: new AbortController().signal });
    const [candidate] = candidates;
    expect(candidate).toBeDefined();
    guard.reset();
    stub.resetLog();
    if (candidate !== undefined) expect(await refusal(adapter.testConnection(candidate, null, new AbortController().signal))).toBe('CaptureAdapterError/CAPTURE_ADAPTER_CLASS_C');
    expect(await refusal(adapter.openSource('CAM-09', { ingestUrl: 'x' }, new AbortController().signal))).toBe('CaptureAdapterError/SOURCE_KIND_NOT_RECORDABLE');
    expect(await refusal(adapter.profiles('CAM-09'))).toBe('CaptureAdapterError/CAPTURE_DEVICE_UNKNOWN');
    expect(await refusal(adapter.ntpOffsetMs('CAM-09'))).toBe('CaptureAdapterError/CAPTURE_DEVICE_UNKNOWN');
    expect(() => adapter.pullUrl('CAM-09', 'main')).toThrow(CaptureAdapterError);
    expect(stub.requestLog()).toEqual([]);
    expect(guard.connections()).toEqual([]);
    expect(guard.datagrams()).toEqual([]);
  });

  it('a message-ID source that is not a fresh UUID per call is refused before a socket is opened', async () => {
    const stub = await stubWith(1);
    const before = datagramSockets();
    const fixed = randomUUID();
    expect(await refusal(search(stub, { newMessageId: () => fixed }))).toBe('CaptureAdapterError/CAPTURE_ADAPTER_INVALID');
    expect(await refusal(search(stub, { newMessageId: () => 'not-a-uuid' }))).toBe('CaptureAdapterError/CAPTURE_ADAPTER_INVALID');
    expect(probes(stub)).toBe(0);
    expect(datagramSockets() - before).toBe(0);
  });
});
