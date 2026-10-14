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
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { manualCaptureTimers } from '../../../../../test/support/capture';
import type { FakeOnvifDiscoveryMode, FakeOnvifStub } from '../../../../../test/support/fake-onvif-stub';
import { DestinationPurpose, decideDestination, type AllowedDestination, type DestinationContext } from '../../../destination-rule';
import { createSystemTimers } from '../../../timers';
import { CaptureAdapterError } from '../../errors';
import { createCaptureDeviceRegistry } from '../../registry';
import type { InterfaceTable } from '../discovery-collector';
import { createOnvifDiscoveryAdapter } from '../onvif-discovery';
import { DiscoveryNotRunError, WS_DISCOVERY_GROUP, WS_DISCOVERY_REPEAT_MS, type WsDiscoveryOptions, type WsDiscoveryResult } from '../ws-discovery';
import { LAN_A, LAN_B, LOOPBACK, answerFrom, datagramSockets, delay, installLoopbackGuard, interfaceTable, startFakeOnvif, until, type LoopbackGuard } from './support';

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

  // Review 060d Q-09 (section 6, survivor 4), wave 12 row CB. This case ran two scripts WRITTEN IN THE TEST - a bare
  // handler and one with a try / catch of the test's own: the product was not called, so no change of the product could
  // fail it. Its "contained" half is now THE PRODUCT, in a process of its own: the search of `ws-discovery.ts` (through
  // the adapter, as the cases above call it), loaded from this folder, with a reader that throws the SAME error on
  // every datagram a loopback responder of that process sends back. The bare script stays, named for what it is: the
  // PREMISE (in this runtime an exception that leaves a datagram handler ends the process, status 1).
  // Seen RED on (a scratch copy of the workspace; `ws-discovery.ts` of the copy): the `catch { handlerErrors += 1; }` of
  // the datagram handler replaced by a `finally {}` - the product's process then ends as the bare one does: status 1,
  // the thrown text on its standard error, no result line.
  it('negative control: the same throw in a datagram handler WITHOUT a try / catch ends a process (the premise); THE PRODUCT\'S search, in a process of its own with a reader that throws it on every datagram, ends cleanly and counts each one', () => {
    const THROWN = 'thrown inside the parse callback';
    // THE PREMISE - no product code: a bare handler of this runtime.
    const bareScript = [
      "const dgram = require('node:dgram');",
      "const socket = dgram.createSocket('udp4');",
      `const parse = () => { throw new TypeError('${THROWN}'); };`,
      "socket.on('message', () => { parse(); socket.close(); });",
      "socket.bind(0, '127.0.0.1', () => socket.send('x', socket.address().port, '127.0.0.1'));",
      'setTimeout(() => process.exit(3), 5000).unref();',
    ].join('\n');
    const bare = spawnSync(process.execPath, ['-e', bareScript], { encoding: 'utf8', env: {} });
    expect(bare.status).toBe(1);
    expect(bare.stderr).toContain(THROWN);

    // THE PRODUCT, in its own process (the TypeScript loader of the workspace; loopback only: the responder is that
    // process's own socket on 127.0.0.1, and the fixture target is its port).
    const camera = resolve(import.meta.dirname, '..');
    const productScript = [
      "import { randomUUID } from 'node:crypto';",
      "import { createSocket } from 'node:dgram';",
      `const { createOnvifDiscoveryAdapter } = await import(${JSON.stringify(pathToFileURL(resolve(camera, 'onvif-discovery.ts')).href)});`,
      `const { createSystemTimers } = await import(${JSON.stringify(pathToFileURL(resolve(camera, '../../timers.ts')).href)});`,
      'setTimeout(() => process.exit(3), 8000).unref();',
      "const responder = createSocket('udp4');",
      "responder.on('message', (_bytes, remote) => responder.send('an answer', remote.port, remote.address));",
      "await new Promise((bound) => responder.bind(0, '127.0.0.1', bound));",
      `const read = () => { throw new TypeError('${THROWN}'); };`,
      "const adapter = createOnvifDiscoveryAdapter({ timers: createSystemTimers(), newMessageId: randomUUID, loopbackFixture: { address: '127.0.0.1', port: responder.address().port }, read });",
      'const result = await adapter.discover({ windowMs: 300, signal: new AbortController().signal });',
      'responder.close();',
      'process.stdout.write(JSON.stringify({ candidates: result.candidates.length, counts: result.counts }));',
    ].join('\n');
    const product = spawnSync(process.execPath, ['--import', 'tsx', '--input-type=module', '-e', productScript], { encoding: 'utf8', env: {}, cwd: camera, timeout: 20_000 });
    expect(product.stderr).not.toContain(THROWN);
    expect(product.status, product.stderr).toBe(0);
    const said = JSON.parse(product.stdout) as { candidates: number; counts: { datagramsSent: number; datagramsReceived: number; handlerErrors: number } };
    // Every probe was answered, every answer reached the handler, and every one of them threw THERE: counted, dropped.
    expect(said.counts.datagramsSent).toBeGreaterThanOrEqual(1);
    expect(said.counts.datagramsReceived).toBe(said.counts.datagramsSent);
    expect(said.counts.handlerErrors).toBe(said.counts.datagramsReceived);
    expect(said.candidates).toBe(0);
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

// Task 4 blueprint row 96 (WP-12; amended ruling AM-3 of D80(10); rule G-R9 as amended by SR-2): the
// probe to ONE typed address. The destination is the answer of the PRODUCT'S destination rule for an
// address of a synthetic camera subnet; under the loopback fixture the datagram goes to the fixture's
// target, so that nothing of these tests can reach the address the rule answered.
describe('task 4 row 96: the typed-address probe - one more datagram, from the same socket, to the destination rule\'s answer', () => {
  const HOST_FACTS: DestinationContext = {
    cameraSubnet: { network: '192.168.50.0', prefixLength: 24 },
    cameraAddresses: [{ address: '192.168.50.1', alias: false }],
    otherInterfaceSubnets: [],
    hostAddresses: ['192.168.50.1'],
  };
  const TYPED = '192.168.50.20';
  const ruled = (address: string): AllowedDestination => {
    const decision = decideDestination({ purpose: DestinationPurpose.TYPED_PROBE, address }, HOST_FACTS);
    if (!decision.allowed) throw new Error(`the rule refused the address of this test: ${decision.refusal}`);
    return decision.destination;
  };

  /** A device on loopback that answers ONLY a probe whose message ID `answers` admits, and keeps every datagram it received. */
  async function responder(answers: (messageId: string) => boolean): Promise<{ readonly port: number; readonly received: string[]; close(): Promise<void> }> {
    const socket = createSocket({ type: 'udp4' });
    const received: string[] = [];
    socket.on('message', (bytes, remote) => {
      const text = bytes.toString('utf8');
      received.push(text);
      const messageId = /<a:MessageID>([^<]+)<\/a:MessageID>/.exec(text)?.[1] ?? '';
      if (answers(messageId)) socket.send(answerFrom(messageId, LOOPBACK), remote.port, LOOPBACK);
    });
    await new Promise<void>((resolveBound) => socket.bind({ address: LOOPBACK, port: 0 }, resolveBound));
    return { port: socket.address().port, received, close: () => new Promise<void>((resolveClosed) => socket.close(() => resolveClosed())) };
  }
  /** A message-ID source that remembers what it handed out, in order: the third of a typed search is the typed probe's. */
  const idSource = (): { readonly next: () => string; readonly given: string[] } => {
    const given: string[] = [];
    return {
      given,
      next: () => {
        const id = randomUUID();
        given.push(id);
        return id;
      },
    };
  };

  it('a typed address yields 1 candidate from the probe answer alone: a device that answers ONLY the typed probe is listed, and without the typed address it is not found', async () => {
    const ids = idSource();
    const device = await responder((messageId) => messageId === `urn:uuid:${ids.given[2] ?? ''}`);
    try {
      guard.reset();
      const adapter = createOnvifDiscoveryAdapter({ timers: createSystemTimers(), newMessageId: ids.next, loopbackFixture: { address: LOOPBACK, port: device.port } });
      const found = await adapter.discover({ windowMs: WINDOW_MS, signal: new AbortController().signal, unicast: ruled(TYPED) });
      expect(ids.given).toHaveLength(3);
      expect(found.candidates).toHaveLength(1);
      // Built from the probe answer alone: the host is where the answer came from (the fixture), never the typed text.
      expect(found.candidates[0]).toMatchObject({ adapterKind: 'FAKE', host: LOOPBACK, testable: true, conflict: false, registered: false });
      expect(found).toMatchObject({ responderCount: 1, truncated: false });
      expect(found.counts).toMatchObject({ datagramsSent: 4, typedProbesSent: 1, sendErrors: 0, handlerErrors: 0, datagramsReceived: 1, datagramsAccepted: 1, repeats: 0, dropped: {} });
      // Five datagrams reached the device: the two probes twice, and ONE typed probe of the camera type with its own message ID.
      expect(device.received).toHaveLength(5);
      const typedProbes = device.received.filter((text) => text.includes(`urn:uuid:${ids.given[2] ?? ''}`));
      expect(typedProbes).toHaveLength(1);
      expect(typedProbes[0]).toContain('<d:Types>dn:NetworkVideoTransmitter</d:Types>');
      // Nothing of the typed address is in a datagram, and none went anywhere but to the fixture's target.
      expect(device.received.some((text) => text.includes(TYPED))).toBe(false);
      expect(new Set(guard.datagrams())).toEqual(new Set([LOOPBACK]));
      expect(guard.refused()).toEqual([]);
      expect(guard.connections()).toEqual([]);

      // The same device, the search WITHOUT a typed address: four probes, no answer, nothing listed, and no typed count in the result.
      const plainIds = idSource();
      const quiet = await responder(() => false);
      try {
        const plain = await createOnvifDiscoveryAdapter({ timers: createSystemTimers(), newMessageId: plainIds.next, loopbackFixture: { address: LOOPBACK, port: quiet.port } }).discover({ windowMs: WINDOW_MS, signal: new AbortController().signal });
        expect(plainIds.given).toHaveLength(2);
        expect(plain.candidates).toEqual([]);
        expect(quiet.received).toHaveLength(4);
        expect(Object.keys(plain.counts)).not.toContain('typedProbesSent');
        expect(plain.counts).toMatchObject({ datagramsSent: 4, sendErrors: 0, datagramsReceived: 0 });
      } finally {
        await quiet.close();
      }
    } finally {
      await device.close();
    }
  });

  it('on the fake ONVIF stub: the stub answers the typed probe as it answers the others - one candidate, five probes in its log, no device request', async () => {
    const stub = await stubWith(1);
    guard.reset();
    const found = await adapterOn(stub).discover({ windowMs: WINDOW_MS, signal: new AbortController().signal, unicast: ruled(TYPED) });
    expect(found.candidates).toHaveLength(1);
    expect(found.counts).toMatchObject({ datagramsSent: 4, typedProbesSent: 1, datagramsReceived: 5, datagramsAccepted: 5, repeats: 4 });
    expect(stub.requestLog().map((entry) => `${entry.channel}/${entry.operation}/${entry.authPresent}`)).toEqual(Array.from({ length: 5 }, () => 'discovery/Probe/false'));
    expect(stub.violations()).toEqual([]);
    expect(guard.connections()).toEqual([]);
    expect(guard.refused()).toEqual([]);
  });

  it('the host does not hold the source the rule named: the search could not run and 0 packets are sent - no socket is opened', async () => {
    guard.reset();
    const before = datagramSockets();
    // The product path (no fixture) on a host whose only interface is another segment than the camera's.
    const product = createOnvifDiscoveryAdapter({ timers: createSystemTimers(), newMessageId: randomUUID, interfaces: () => interfaceTable(LAN_A) });
    expect(await refusal(product.discover({ windowMs: WINDOW_MS, signal: new AbortController().signal, unicast: ruled(TYPED) }))).toBe('DiscoveryNotRunError/NO_ELIGIBLE_INTERFACE');
    expect(guard.datagrams()).toEqual([]);
    expect(guard.refused()).toEqual([]);
    expect(datagramSockets() - before).toBe(0);
  });

  it('a refused address makes no answer of the rule, so there is nothing to probe with: loopback, a public address, the host\'s own, another segment, a name', () => {
    for (const address of ['127.0.0.1', '8.8.8.8', '192.168.50.1', '192.168.51.20', '192.168.50.0', '192.168.50.255', 'camera.example', '192.168.50.20:80', '']) {
      expect(decideDestination({ purpose: DestinationPurpose.TYPED_PROBE, address }, HOST_FACTS).allowed, address).toBe(false);
    }
    expect(ruled(TYPED)).toEqual({ address: TYPED, port: 80, sourceAddress: '192.168.50.1', viaAlias: false });
  });

  it('the typed probe has a message ID of its own: one that repeats an ID of the search is refused before a socket is opened', async () => {
    const stub = await stubWith(1);
    const before = datagramSockets();
    const [first, second] = [randomUUID(), randomUUID()];
    const repeating = [first, second, first];
    expect(await refusal(adapterOn(stub, { newMessageId: () => repeating.shift() ?? first }).discover({ windowMs: WINDOW_MS, signal: new AbortController().signal, unicast: ruled(TYPED) }))).toBe('CaptureAdapterError/CAPTURE_ADAPTER_INVALID');
    expect(probes(stub)).toBe(0);
    expect(datagramSockets() - before).toBe(0);
  });
});
