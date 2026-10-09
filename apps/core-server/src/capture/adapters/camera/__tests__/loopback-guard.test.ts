// The loopback guard of the camera adapter tests, for TCP clients built with `net.createConnection`
// (integration pass C2; row 132's request; check M4-DISC-NOLAN-1).
//
// Before this pass the guard read only `socket.connect({ host })` and took every HTTP client for a
// connection to `localhost`: the booted flow test had to take the guard OFF for the connection test
// and the adoption (operations 95, 96). Now a client that names the literal 127.0.0.1 passes, and the
// same client naming anything else is refused before a single byte leaves the process.
//
// Everything here is on 127.0.0.1 (the fake ONVIF stub of row 60 and one throw-away listener). The
// refused destinations are a documentation address (RFC 5737) and names: none is ever contacted -
// that is what the guard proves. Run with the command sandbox disabled (loopback bind).
import http from 'node:http';
import net, { type AddressInfo } from 'node:net';
import { randomUUID } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { FAKE_ONVIF_FOREIGN_HOST, FAKE_ONVIF_HOST, createFakeOnvifStub, freeFakeOnvifPorts, type FakeOnvifStub } from '../../../../../test/support/fake-onvif-stub';
import { sealCredential } from '../../credential';
import { CaptureAdapterKind } from '../../kinds';
import { ConnectionTestOutcome, type CameraCandidate } from '../../types';
import { createOnvifConnectionTester } from '../onvif-session';
import { LOOPBACK, LoopbackGuardError, installLoopbackGuard, type LoopbackGuard } from './support';

const ACCOUNT = { username: `guardU${randomUUID().replaceAll('-', '')}`, secret: `guardS${randomUUID().replaceAll('-', '')}` };
const timers = { after: (delayMs: number, callback: () => void) => {
  const handle = setTimeout(callback, delayMs);
  return () => clearTimeout(handle);
} };

let guard: LoopbackGuard;
const closers: Array<() => Promise<void>> = [];
beforeEach(() => {
  guard = installLoopbackGuard();
});
afterEach(async () => {
  guard.restore();
  for (const close of closers.splice(0)) await close();
});

async function listener(): Promise<number> {
  const server = http.createServer((_request, response) => {
    response.writeHead(200, { 'content-type': 'text/plain', connection: 'close' });
    response.end('ok');
  });
  await new Promise<void>((resolve) => server.listen({ host: LOOPBACK, port: 0 }, resolve));
  closers.push(() => new Promise<void>((resolve) => server.close(() => resolve())));
  return (server.address() as AddressInfo).port;
}

/** What a thrown-or-emitted failure of a client was. */
const refusal = (run: () => { once(event: 'error', listener: (error: unknown) => void): unknown }): Promise<unknown> =>
  new Promise((resolve) => {
    try {
      run().once('error', resolve);
    } catch (error) {
      resolve(error);
    }
  });

describe('the loopback guard and clients built with net.createConnection', () => {
  it('net.createConnection to the literal 127.0.0.1 passes and is recorded, in each form of its arguments', async () => {
    const port = await listener();
    for (const open of [() => net.createConnection({ host: LOOPBACK, port }), () => net.createConnection(port, LOOPBACK), () => net.connect({ host: LOOPBACK, port })]) {
      const socket = open();
      await new Promise<void>((resolve, reject) => {
        socket.once('connect', () => resolve());
        socket.once('error', reject);
      });
      socket.destroy();
    }
    expect(guard.connections()).toEqual([LOOPBACK, LOOPBACK, LOOPBACK]);
    expect(guard.refused()).toEqual([]);
  });

  it('an HTTP client to 127.0.0.1 gets its answer with the guard ON', async () => {
    const port = await listener();
    const status = await new Promise<number | undefined>((resolve, reject) => {
      http.get({ host: LOOPBACK, port, path: '/', agent: new http.Agent({ keepAlive: false }) }, (response) => {
        response.resume();
        response.once('end', () => resolve(response.statusCode));
      }).once('error', reject);
    });
    expect(status).toBe(200);
    expect(guard.connections()).toEqual([LOOPBACK]);
    expect(guard.refused()).toEqual([]);
  });

  it('the same clients to any other destination are refused before anything is sent: another address, a name, localhost, no host', async () => {
    const port = await listener();
    const attempts: Array<[string, () => { once(event: 'error', listener: (error: unknown) => void): unknown }]> = [
      [FAKE_ONVIF_FOREIGN_HOST, () => net.createConnection({ host: FAKE_ONVIF_FOREIGN_HOST, port: 80 })],
      [FAKE_ONVIF_FOREIGN_HOST, () => net.createConnection(80, FAKE_ONVIF_FOREIGN_HOST)],
      ['camera.invalid', () => net.createConnection({ host: 'camera.invalid', port: 80 })],
      ['localhost', () => net.createConnection({ host: 'localhost', port })],
      ['localhost', () => net.createConnection({ port })],
      ['127.0.0.2', () => net.createConnection({ host: '127.0.0.2', port })],
      [FAKE_ONVIF_FOREIGN_HOST, () => http.get({ host: FAKE_ONVIF_FOREIGN_HOST, port: 80, path: '/', agent: new http.Agent({ keepAlive: false }) })],
      ['camera.invalid', () => http.get({ host: 'camera.invalid', port: 80, path: '/', agent: new http.Agent({ keepAlive: false }) })],
    ];
    for (const [label, run] of attempts) {
      const error = await refusal(run);
      expect(error, label).toBeInstanceOf(LoopbackGuardError);
      expect((error as LoopbackGuardError).code).toBe('TEST_NETWORK_REFUSED');
    }
    expect(guard.refused()).toEqual(attempts.map(([label]) => label));
    expect(guard.connections()).toEqual([]);
  });

  it('a connection to a local pipe path is not a network destination and is left alone (as before)', async () => {
    const error = await refusal(() => net.createConnection({ path: `/nonexistent-${randomUUID()}.sock` }));
    expect(error).not.toBeInstanceOf(LoopbackGuardError);
    expect(guard.refused()).toEqual([]);
  });
});

describe('the pinned ONVIF client (onvif-session.ts) with the guard ON', () => {
  let stub: FakeOnvifStub;
  beforeEach(async () => {
    stub = createFakeOnvifStub({ ports: await freeFakeOnvifPorts(), credential: ACCOUNT });
    await stub.start();
    closers.push(() => stub.stop());
  });

  const candidate = (serviceAddress: string, host: string = FAKE_ONVIF_HOST): CameraCandidate => ({
    adapterKind: CaptureAdapterKind.FAKE,
    host,
    serviceAddress,
    endpointRef: `urn:uuid:${randomUUID()}`,
    vendor: null,
    model: 'FAKE-CAM-1',
    name: 'Fake Camera 1',
    testable: true,
    conflict: false,
  });

  it('a connection test against the stub on 127.0.0.1 is REACHABLE: every connection was handed on, none refused', async () => {
    const result = await createOnvifConnectionTester({ timers }).test(candidate(stub.addresses().deviceServiceUrl), sealCredential(ACCOUNT), new AbortController().signal);
    expect(result.outcome).toBe(ConnectionTestOutcome.REACHABLE);
    expect(guard.refused()).toEqual([]);
    expect(guard.connections().length).toBeGreaterThan(0);
    expect(new Set(guard.connections())).toEqual(new Set([LOOPBACK]));
    expect(stub.violations()).toEqual([]);
  });

  it('the same client aimed at another host never leaves the process: the guard refuses it and the stub hears nothing', async () => {
    const elsewhere = `http://${FAKE_ONVIF_FOREIGN_HOST}:${new URL(stub.addresses().deviceServiceUrl).port}/onvif/device_service`;
    const result = await createOnvifConnectionTester({ timers }).test(candidate(elsewhere, FAKE_ONVIF_FOREIGN_HOST), sealCredential(ACCOUNT), new AbortController().signal).then(
      (value) => value.outcome as string,
      () => 'REJECTED',
    );
    expect(result).not.toBe(ConnectionTestOutcome.REACHABLE);
    expect(guard.refused().length).toBeGreaterThan(0);
    expect(new Set(guard.refused())).toEqual(new Set([FAKE_ONVIF_FOREIGN_HOST]));
    expect(guard.connections()).toEqual([]);
    expect(stub.requestLog().filter((request) => request.channel === 'device')).toEqual([]);
  });
});
