// HB-11, the contract-checked fake transport: nothing global is touched by default, and the opt-in
// that installs the fake for code that cannot take its transport by injection (plan row W31, rule 3).
// The installed fake is used by the REAL typed client (its default transport is the global `fetch`)
// and by the REAL heartbeat client (its default socket is the global `WebSocket`).
import { afterEach, describe, expect, it } from 'vitest';
import { createCoreClient } from '../src/client';
import { FakeTransportUsageError, createFakeTransport, installFakeTransport } from '../src/live/testing';
import { createHeartbeatClient } from '../src/realtime/heartbeat-client';

const BASE = 'http://127.0.0.1:4420';
const SOCKET_URL = 'ws://127.0.0.1:4420/ws';
const globals = globalThis as { fetch?: unknown; WebSocket?: unknown };
const original = { fetch: globals.fetch, WebSocket: globals.WebSocket, fetchDescriptor: Object.getOwnPropertyDescriptor(globalThis, 'fetch') };
const restores: (() => void)[] = [];

afterEach(() => {
  for (const restore of restores.splice(0)) restore();
  expect(globals.fetch).toBe(original.fetch);
  expect(globals.WebSocket).toBe(original.WebSocket);
});

describe('no global is touched unless a test asks for it', () => {
  it('making and using a fake leaves the global fetch and the global socket constructor as they were', async () => {
    const fake = createFakeTransport();
    fake.answerFromExample('getServiceHealth');
    await createCoreClient({ baseUrl: BASE, credentials: 'browser-cookie', fetch: fake.fetch }).call('getServiceHealth');
    fake.socketFactory(SOCKET_URL);
    fake.connection().startAnonymous().heartbeat();
    expect(globals.fetch).toBe(original.fetch);
    expect(globals.WebSocket).toBe(original.WebSocket);
    expect(Object.getOwnPropertyDescriptor(globalThis, 'fetch')).toEqual(original.fetchDescriptor);
    expect(globals.fetch).not.toBe(fake.fetch);
  });
});

describe('installFakeTransport: the opt-in for code that cannot inject', () => {
  it('the real typed client without a transport and the real heartbeat client without a factory use the installed fake', async () => {
    const fake = createFakeTransport();
    fake.answerFromExample('getServiceHealth');
    restores.push(installFakeTransport(fake));
    expect(globals.fetch).toBe(fake.fetch);
    expect(globals.WebSocket).toBe(fake.WebSocket);

    const client = createCoreClient({ baseUrl: BASE, credentials: 'browser-cookie' });
    expect(await client.call('getServiceHealth')).toMatchObject({ ok: true, status: 200 });
    expect(fake.calls).toMatchObject([{ operationId: 'getServiceHealth', credentials: 'same-origin' }]);

    const heartbeat = createHeartbeatClient({ url: SOCKET_URL, now: fake.clock.now, onInvalidMessage: () => undefined });
    heartbeat.start();
    expect(fake.connections).toHaveLength(1);
    fake.connection().startAnonymous().heartbeat();
    expect(heartbeat.getSnapshot()).toMatchObject({ state: 'LIVE', seq: 0 });
    heartbeat.stop();
    fake.assertNoViolations();
  });

  it('the restore function puts back exactly what was there, and may be called twice', () => {
    const fake = createFakeTransport();
    const restore = installFakeTransport(fake);
    expect(globals.fetch).toBe(fake.fetch);
    restore();
    expect(globals.fetch).toBe(original.fetch);
    expect(globals.WebSocket).toBe(original.WebSocket);
    expect(Object.getOwnPropertyDescriptor(globalThis, 'fetch')).toEqual(original.fetchDescriptor);
    restore();
    expect(globals.fetch).toBe(original.fetch);
  });

  it('a second install without a restore is refused; after the restore another fake can be installed', () => {
    const first = createFakeTransport();
    const second = createFakeTransport();
    const restore = installFakeTransport(first);
    expect(() => installFakeTransport(second)).toThrow(FakeTransportUsageError);
    expect(globals.fetch).toBe(first.fetch);
    restore();
    restores.push(installFakeTransport(second));
    expect(globals.fetch).toBe(second.fetch);
  });

  it('installs on an object that is passed in: a name that was absent is removed again, one that was there comes back', () => {
    const fake = createFakeTransport();
    const before = (): void => undefined;
    const target: { fetch?: unknown; WebSocket?: unknown } = { fetch: before };
    const restore = installFakeTransport(fake, target);
    expect(target).toEqual({ fetch: fake.fetch, WebSocket: fake.WebSocket });
    expect(globals.fetch).toBe(original.fetch);
    restore();
    expect(target).toEqual({ fetch: before });
    expect('WebSocket' in target).toBe(false);
  });
});
