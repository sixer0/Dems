// Backend task W60 (blueprint step 82): the pairing gate's VALUES come from the real runtime over
// the contract-checked fake transport (04_client_integration_spec §9.4 MP-10, §6.6; AC-C-78, AC-C-79).
//
// Where `pairing-gate.test.tsx` drives the gate through the contract to prove the ROUTING rules, this
// file builds the app's real Live source (`createMobileLive`) over `createFakeTransport`, lets its
// start (MP-10) settle against a scripted Core, and feeds the resulting `getPairing()` into the real
// route tree. It shows that an unpaired device, a paired device, a revoked device and an unknown
// credential each produce exactly the gate the route tests then act on — so the gate is not a value a
// test invents, it is what the Core's answers make it.
//
// No secret is written anywhere: the credential is the fake transport's placeholder and nothing here
// prints it (P19 / SD-23).
import '../testing/router-testing-setup';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act } from '@testing-library/react-native';
import { CORE_API_EXAMPLES, type DeviceRegistration, type PairingRedeemed } from '@dems/shared/api';
import { createFakeTransport, refusal, type FakeHttpCall, type FakeReply, type FakeTransport } from '@dems/shared/live/testing';
import { FakeRuntime, renderApp, resetShellState } from '../testing/router-harness';
import { createMobileLive, type MobileLive } from '@/runtime';
import { SECURE_ITEM_KEYS } from '@/runtime/secure-credentials';

jest.mock('@/features/home/pulse-ring', () => ({ PulseRing: () => null }));

const REDEEMED = CORE_API_EXAMPLES.redeemPairingCode?.responses[201]?.paired?.value as PairingRedeemed;
const store = () => globalThis.__DEMS_SECURE_STORE_MOCK__;

let fake: FakeTransport;
let mobile: MobileLive | undefined;
const devices = new Map<string, { id: string; state: 'PAIRED' | 'REVOKED' }>();

/** How `getDeviceRegistration` (operation 21) treats the bearer the app presents at start. */
type Registration = 'known-paired' | 'known-revoked' | 'unknown';

async function flush(turns = 60): Promise<void> {
  await act(async () => {
    for (let turn = 0; turn < turns; turn += 1) await Promise.resolve();
  });
}
/** Advances the fake clock in steps with the promise jobs in between, so the source's timers run. */
async function elapse(ms: number, step = 250): Promise<void> {
  for (let done = 0; done < ms; done += step) {
    act(() => {
      fake.clock.advance(Math.min(step, ms - done));
    });
    await flush(20);
  }
}

const bearerOf = (headers: Readonly<Record<string, unknown>> | undefined): string | null => {
  const value = headers?.Authorization ?? headers?.authorization;
  return typeof value === 'string' && value.startsWith('Bearer ') ? value.slice('Bearer '.length) : null;
};

function bootCore(): void {
  fake = createFakeTransport({ epoch: 2, revision: 10 });
  devices.clear();
  // A tablet that is not signed in: the session probe answers like an unauthenticated device.
  fake.answer('getAuthSession', () => fake.example('getAuthSession', 401));
  fake.answer('getSignInStatus', () => fake.example('getSignInStatus', 200, 'open'));
  fake.answer('getDeviceRegistration', (call: FakeHttpCall): FakeReply => {
    const bearer = bearerOf(call.headers);
    const device = bearer === null ? undefined : devices.get(bearer);
    if (device === undefined) return fake.example('getDeviceRegistration', 401);
    if (device.state === 'REVOKED') return refusal(403, 'DEVICE_REVOKED', 'This device was revoked.');
    const body: DeviceRegistration = { deviceId: device.id, name: 'Android device', state: 'PAIRED', pairedAt: REDEEMED.pairedAt, credentialRotatedAt: null, core: REDEEMED.core };
    return { status: 200, body };
  });
  fake.onConnect((connection) => {
    // A device whose pairing the Core has revoked: the socket is closed with 4403 (§6.6), which the
    // Live source turns into an end of the pairing → the gate goes UNPAIRED with the `revoked` notice.
    const bearer = bearerOf(connection.headers);
    const device = bearer === null ? undefined : devices.get(bearer);
    if (device?.state === 'REVOKED') {
      connection.accept().hello('ANONYMOUS', { reason: 'DEVICE_REVOKED' }).close(4403);
      return;
    }
    connection.startAnonymous().heartbeat();
  });
}

function createLive(): MobileLive {
  const created = createMobileLive({ fetch: fake.fetch, socketFactory: fake.socketFactory, now: fake.clock.now, timers: fake.clock.timers, random: () => 0 });
  if (created === null) throw new Error('jest is a debug build: a Live source is built');
  mobile = created;
  return created;
}

/** Runs MP-10 (the runtime's start) against the scripted Core and returns the gate it settled on. */
async function startAndReadGate(registration: Registration, seedCredential: boolean): Promise<ReturnType<MobileLive['getPairing']>> {
  bootCore();
  if (seedCredential) {
    store().seed(SECURE_ITEM_KEYS.deviceCredential, JSON.stringify(REDEEMED));
    if (registration !== 'unknown') devices.set(REDEEMED.deviceCredential, { id: REDEEMED.deviceId, state: registration === 'known-revoked' ? 'REVOKED' : 'PAIRED' });
  }
  const live = createLive();
  await act(async () => {
    await live.start();
  });
  await flush();
  await elapse(3000);
  return live.getPairing();
}

beforeEach(() => {
  resetShellState();
  store().reset();
});

afterEach(() => {
  mobile?.stop();
  mobile = undefined;
});

describe('the gate the Core’s answers produce, fed into the real route tree (MP-10)', () => {
  it('no credential → UNPAIRED, required → the route tree boots to /pair', async () => {
    const pairing = await startAndReadGate('unknown', /* seedCredential */ false);
    expect(pairing).toEqual({ required: true, state: 'UNPAIRED', notice: null, deviceId: null });
    const app = renderApp('/', { runtime: new FakeRuntime({ pairing }) });
    expect(app.getPathname()).toBe('/pair');
  });

  it('a credential the Core confirms → PAIRED → the route tree releases to /login', async () => {
    const pairing = await startAndReadGate('known-paired', /* seedCredential */ true);
    expect(pairing).toEqual({ required: true, state: 'PAIRED', notice: null, deviceId: REDEEMED.deviceId });
    const app = renderApp('/', { runtime: new FakeRuntime({ pairing }) });
    expect(app.getPathname()).toBe('/login');
  });

  it('a credential the Core reports DEVICE_REVOKED → UNPAIRED with the revoked notice → /pair (AC-C-78)', async () => {
    const pairing = await startAndReadGate('known-revoked', /* seedCredential */ true);
    expect(pairing).toEqual({ required: true, state: 'UNPAIRED', notice: 'revoked', deviceId: null });
    const app = renderApp('/', { runtime: new FakeRuntime({ pairing }) });
    expect(app.getPathname()).toBe('/pair');
  });

  it('a credential the Core does not know (401) → UNPAIRED with the unknown notice, item deleted → /pair (AC-C-79)', async () => {
    const pairing = await startAndReadGate('unknown', /* seedCredential */ true);
    expect(pairing).toEqual({ required: true, state: 'UNPAIRED', notice: 'unknown', deviceId: null });
    // The runtime deletes the three items on a 401 (MP-10): the credential is gone from the store.
    expect(store().has(SECURE_ITEM_KEYS.deviceCredential)).toBe(false);
    const app = renderApp('/', { runtime: new FakeRuntime({ pairing }) });
    expect(app.getPathname()).toBe('/pair');
  });
});
