// Row FX-M1, defect E2E-S-4 (decision D201): the pairing gate for `+native-intent`, outside React.
// The app's real Live source writes it while it runs; SIMULATED and HEARTBEAT never do.
import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CORE_API_EXAMPLES, type PairingRedeemed } from '@dems/shared/api';
import { FAKE_CREDENTIALS, createFakeTransport, type FakeHttpCall, type FakeTransport } from '@dems/shared/live/testing';
import { PAIRING_CHECKING, PAIRING_NOT_REQUIRED, type PairingInfo } from './contract';
import { resetCoreLinkPrefsForTests } from './core-link';
import { isPairingGateHeld, notePairingGate, releasePairingGate, resetPairingGateForTests } from './pairing-gate-snapshot';
import { SECURE_ITEM_KEYS } from './secure-credentials';
import { createMobileLive, type MobileLive } from './sim-adapters';

const REDEEMED = CORE_API_EXAMPLES.redeemPairingCode?.responses[201]?.paired?.value as PairingRedeemed;
const STORED: PairingRedeemed = { ...REDEEMED, deviceCredential: FAKE_CREDENTIALS.deviceCredential };
const store = () => globalThis.__DEMS_SECURE_STORE_MOCK__;
const PAIRED: PairingInfo = { required: true, state: 'PAIRED', notice: null, deviceId: 'DEV-0002' };
const UNPAIRED: PairingInfo = { required: true, state: 'UNPAIRED', notice: 'revoked', deviceId: null };

describe('the snapshot (pure)', () => {
  beforeEach(() => resetPairingGateForTests());

  it('holds exactly when the gate blocks: LIVE and not PAIRED, CHECKING included; never outside LIVE', () => {
    const source = {};
    expect(isPairingGateHeld()).toBe(false);
    notePairingGate(source, PAIRING_CHECKING);
    expect(isPairingGateHeld()).toBe(true);
    notePairingGate(source, UNPAIRED);
    expect(isPairingGateHeld()).toBe(true);
    notePairingGate(source, PAIRED);
    expect(isPairingGateHeld()).toBe(false);
    notePairingGate(source, PAIRING_NOT_REQUIRED);
    expect(isPairingGateHeld()).toBe(false);
    notePairingGate(source, undefined);
    expect(isPairingGateHeld()).toBe(false);
  });

  it('a stopped source releases only its own entry', () => {
    const old = {};
    const current = {};
    notePairingGate(old, UNPAIRED);
    notePairingGate(current, UNPAIRED);
    releasePairingGate(old);
    expect(isPairingGateHeld()).toBe(true);
    releasePairingGate(current);
    expect(isPairingGateHeld()).toBe(false);
  });
});

let fake: FakeTransport;
const lives: MobileLive[] = [];

async function flush(turns = 60): Promise<void> {
  for (let turn = 0; turn < turns; turn += 1) await Promise.resolve();
}
async function elapse(ms: number, step = 250): Promise<void> {
  for (let done = 0; done < ms; done += step) {
    fake.clock.advance(Math.min(step, ms - done));
    await flush(20);
  }
}
const bearerOf = (headers: Readonly<Record<string, unknown>> | undefined): string | null => {
  const value = headers?.Authorization ?? headers?.authorization;
  return typeof value === 'string' && value.startsWith('Bearer ') ? value.slice('Bearer '.length) : null;
};

function createLive(): MobileLive {
  const created = createMobileLive({ fetch: fake.fetch, socketFactory: fake.socketFactory, now: fake.clock.now, timers: fake.clock.timers, random: () => 0 });
  if (created === null) throw new Error('jest is a debug build: a Live source is built');
  lives.push(created);
  return created;
}

beforeEach(async () => {
  await AsyncStorage.clear();
  store().reset();
  resetCoreLinkPrefsForTests();
  resetPairingGateForTests();
  fake = createFakeTransport({ epoch: 2, revision: 10 });
  fake.answer('getAuthSession', () => fake.example('getAuthSession', 401));
  fake.answer('getSignInStatus', () => fake.example('getSignInStatus', 200, 'open'));
  fake.answer('getDeviceRegistration', (call: FakeHttpCall) =>
    bearerOf(call.headers) === STORED.deviceCredential
      ? { status: 200, body: { deviceId: STORED.deviceId, name: 'Android device', state: 'PAIRED', pairedAt: STORED.pairedAt, credentialRotatedAt: null, core: STORED.core } }
      : fake.example('getDeviceRegistration', 401),
  );
  fake.answer('redeemPairingCode', () => ({ status: 201, body: STORED }));
  fake.onConnect((connection) => {
    if (connection.state !== 'CONNECTING') return;
    if (bearerOf(connection.headers) === STORED.deviceCredential) connection.startDevice().heartbeat();
    else connection.startAnonymous().heartbeat();
    connection.beatEvery();
  });
});

afterEach(() => {
  for (const live of lives.splice(0)) live.stop();
  resetPairingGateForTests();
  fake.assertNoViolations();
});

describe('the Live source writes the gate while it runs', () => {
  it('a tablet without a credential: held from start() (CHECKING, then UNPAIRED); a redeem releases it; stop() clears it', async () => {
    const live = createLive();
    // Created, not started: nothing written.
    expect(isPairingGateHeld()).toBe(false);
    const started = live.start();
    expect(isPairingGateHeld()).toBe(true);
    await started;
    await flush();
    await elapse(1000);
    expect(live.getPairing().state).toBe('UNPAIRED');
    expect(isPairingGateHeld()).toBe(true);
    expect(live.live.link).toBe('ONLINE');
    // The redeem answered 201 and the credential is stored: the gate is open.
    const result = await live.live.actions.pair(['6', '0', '4', '1', '7', '3'].join(''));
    expect(result).toMatchObject({ ok: true });
    await flush();
    expect(live.getPairing().state).toBe('PAIRED');
    expect(isPairingGateHeld()).toBe(false);
    live.stop();
    expect(isPairingGateHeld()).toBe(false);
  });

  it('a tablet the Core knows: PAIRED, not held; after a stop and a new source, the old one does not clear the new one’s gate', async () => {
    store().seed(SECURE_ITEM_KEYS.deviceCredential, JSON.stringify(STORED));
    const first = createLive();
    await first.start();
    await flush();
    expect(first.getPairing().state).toBe('PAIRED');
    expect(isPairingGateHeld()).toBe(false);

    store().reset();
    const second = createLive();
    await second.start();
    await flush();
    expect(second.getPairing().state).toBe('UNPAIRED');
    expect(isPairingGateHeld()).toBe(true);
    first.stop();
    expect(isPairingGateHeld()).toBe(true);
    second.stop();
    expect(isPairingGateHeld()).toBe(false);
  });
});
