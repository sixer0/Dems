// Row 236 (D263): the runtime's one source of the Core origin, end to end. A changed Core server address moves
// every way the app reaches the Core: the typed client (HTTP), the Live socket (WS), the media transport and the
// preview stream that takes its origin from it (`camera-stream-transport.ts`, D217). The runtime provider builds a
// new Live source for the new address (the old one is stopped with its replica), Settings shows the address in
// force read-only, and a Live source built before the stored address was read never starts (R225-F3: no
// credential reaches another Core at a cold start).
import 'react-native-gesture-handler/jestSetup';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';
import type { Metrics } from 'react-native-safe-area-context';
import { CAMERA_PREVIEW_TOKEN_PREFIX, CORE_API_EXAMPLES, pickReplicatedState, type AuthSessionInfo, type PairingRedeemed, type ReplicatedState, type SignInResponse } from '@dems/shared/api';
import { FAKE_CREDENTIALS, clockFromTimers, createFakeTransport, installFakeTransport, type FakeClock, type FakeHttpCall, type FakeTransport } from '@dems/shared/live/testing';
import type { SocketLike } from '@dems/shared/realtime';
import { DEFAULT_SEED, createIdleState } from '@dems/shared/sim';
import { MOBILE_PREFS_KEY } from '@/motion';
import { SecuritySection } from '@/features/settings/security-section';
import { AppProviders } from '@/providers';
import { openCameraStream } from './camera-stream-transport';
import { useCoreLink } from './contract';
import { DEFAULT_CORE_ADDRESS, coreOriginOf, resetCoreAddressForTests, setCoreAddress } from './core-address';
import { resetCoreLinkPrefsForTests } from './core-link';
import { resetDebugLaunchForTests } from './debug';
import { SECURE_ITEM_KEYS } from './secure-credentials';
import { createMobileLive, type MobileLive } from './sim-adapters';
import { useMobileLive } from './sim-runtime-provider';

jest.mock('expo-keep-awake', () => ({
  useKeepAwake: () => undefined,
  activateKeepAwakeAsync: jest.fn(async () => undefined),
  deactivateKeepAwake: jest.fn(async () => undefined),
}));
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: () => false }),
  useIsFocused: () => true,
}));
jest.mock('expo/fetch', () => ({
  fetch: jest.fn(async () => ({ ok: true, status: 200, headers: { get: () => 'multipart/x-mixed-replace; boundary=frame' }, body: null })),
}));
const streamFetch = () => jest.requireMock<{ fetch: jest.Mock }>('expo/fetch').fetch;

const METRICS: Metrics = { frame: { x: 0, y: 0, width: 411, height: 923 }, insets: { top: 24, right: 0, bottom: 16, left: 0 } };
const NEW = { host: '192.168.1.20', port: 4420 } as const;
const NEW_ORIGIN = coreOriginOf(NEW);
const DEFAULT_ORIGIN = coreOriginOf(DEFAULT_CORE_ADDRESS);
const REDEEMED = CORE_API_EXAMPLES.redeemPairingCode?.responses[201]?.paired?.value as PairingRedeemed;
const STORED: PairingRedeemed = { ...REDEEMED, deviceCredential: FAKE_CREDENTIALS.deviceCredential };
const DEVICE_SESSION = CORE_API_EXAMPLES.getAuthSession?.responses[200]?.pairedDevice?.value as AuthSessionInfo;
const PREVIEW_PATH = `/preview/${CAMERA_PREVIEW_TOKEN_PREFIX}${'a'.repeat(24)}`;
const secure = globalThis.__DEMS_SECURE_STORE_MOCK__;

class MockCoreSocket implements SocketLike {
  readyState = 0;
  onopen: SocketLike['onopen'] = null;
  onmessage: SocketLike['onmessage'] = null;
  onclose: SocketLike['onclose'] = null;
  onerror: SocketLike['onerror'] = null;
  close() {
    this.readyState = 3;
  }
}

let fake: FakeTransport<FakeClock>;
/** The source-level cases: the manual clock (its timers drive the Live source). */
let manual: FakeTransport;
let restoreTransport: () => void = () => undefined;
let owned: MobileLive | undefined;

const bearerOf = (headers: Readonly<Record<string, unknown>>): string | null => {
  const value = headers.Authorization ?? headers.authorization;
  return typeof value === 'string' && value.startsWith('Bearer ') ? value.slice('Bearer '.length) : null;
};

async function settle(turns = 60): Promise<void> {
  await act(async () => {
    for (let turn = 0; turn < turns; turn += 1) await Promise.resolve();
  });
}

/** A Core that knows the stored credential and signs an operator in; anything else is anonymous. */
function scriptCore(): void {
  let session: string | null = null;
  fake.answer('getAuthSession', (call: FakeHttpCall) =>
    session !== null && bearerOf(call.headers) === session ? { status: 200, body: { ...DEVICE_SESSION, serverTime: fake.clock.now() } } : fake.example('getAuthSession', 401),
  );
  fake.answer('getSignInStatus', () => fake.example('getSignInStatus', 200, 'open'));
  fake.answer('getDeviceRegistration', (call: FakeHttpCall) =>
    bearerOf(call.headers) === STORED.deviceCredential
      ? { status: 200, body: { deviceId: STORED.deviceId, name: 'Android device', state: 'PAIRED', pairedAt: STORED.pairedAt, credentialRotatedAt: null, core: STORED.core } }
      : fake.example('getDeviceRegistration', 401),
  );
  fake.answer('signIn', () => {
    session = FAKE_CREDENTIALS.sessionToken;
    const info: AuthSessionInfo = { ...DEVICE_SESSION, issuedAt: fake.clock.now(), lastActivityAt: fake.clock.now(), serverTime: fake.clock.now() };
    return { status: 200, body: { session: info, sessionToken: FAKE_CREDENTIALS.sessionToken } satisfies SignInResponse };
  });
  fake.onConnect((connection) => {
    if (connection.state !== 'CONNECTING') return;
    const bearer = bearerOf(connection.headers);
    if (bearer === STORED.deviceCredential) connection.startDevice().heartbeat();
    else if (bearer !== null && bearer === session) {
      connection.startOperator(pickReplicatedState(JSON.parse(JSON.stringify(createIdleState({ now: fake.clock.now(), seed: DEFAULT_SEED }))) as ReplicatedState)).heartbeat();
    }
    else connection.startAnonymous().heartbeat();
  });
}

beforeEach(async () => {
  await AsyncStorage.clear();
  secure.reset();
  resetCoreAddressForTests();
  resetCoreLinkPrefsForTests();
  resetDebugLaunchForTests();
  streamFetch().mockClear();
});

afterEach(() => {
  owned?.stop();
  owned = undefined;
  restoreTransport();
  restoreTransport = () => undefined;
  resetCoreAddressForTests();
  fake.assertNoViolations();
});

describe('one source of the Core origin (D263): the Live source of an address', () => {
  beforeEach(() => {
    manual = createFakeTransport({ epoch: 2, revision: 10 });
    fake = manual;
    scriptCore();
  });

  function createLive(): MobileLive {
    const created = createMobileLive({ fetch: manual.fetch, socketFactory: manual.socketFactory, now: manual.clock.now, timers: manual.clock.timers, random: () => 0 });
    if (created === null) throw new Error('jest is a debug build: a Live source is built');
    owned = created;
    return created;
  }

  async function signedIn(live: MobileLive): Promise<void> {
    await act(async () => {
      await live.start();
    });
    await settle();
    await act(async () => {
      await live.live.actions.signIn('andi.pratama', 'not-a-real-password');
    });
    await settle();
  }

  it('the default address: HTTP, WS, the media transport and the preview stream all go to 127.0.0.1:4420', async () => {
    secure.seed(SECURE_ITEM_KEYS.deviceCredential, JSON.stringify(STORED));
    const live = createLive();
    await signedIn(live);
    expect(fake.calls.length).toBeGreaterThan(0);
    for (const call of fake.calls) expect(call.url.startsWith(`${DEFAULT_ORIGIN.http}/api/v1/`)).toBe(true);
    for (const socket of fake.connections) expect(socket.url).toBe(DEFAULT_ORIGIN.ws);
    expect(live.live.mediaTransport()?.origin).toBe(DEFAULT_ORIGIN.http);
    await openCameraStream({ live: live.live, path: PREVIEW_PATH, signal: new AbortController().signal });
    expect(streamFetch().mock.calls.map(([url]) => url)).toEqual([`${DEFAULT_ORIGIN.http}${PREVIEW_PATH}`]);
  });

  it('a changed address: HTTP, WS, the media transport and the preview stream all follow it', async () => {
    await expect(setCoreAddress(NEW)).resolves.toBe('changed');
    // Paired with the Core of the new address (the change itself removed any older credential).
    secure.seed(SECURE_ITEM_KEYS.deviceCredential, JSON.stringify(STORED));
    const live = createLive();
    await signedIn(live);
    expect(fake.log.operationIds()).toEqual(expect.arrayContaining(['getDeviceRegistration', 'signIn']));
    for (const call of fake.calls) expect(call.url.startsWith(`${NEW_ORIGIN.http}/api/v1/`)).toBe(true);
    expect(fake.connections.length).toBeGreaterThan(0);
    for (const socket of fake.connections) expect(socket.url).toBe(NEW_ORIGIN.ws);
    expect(live.live.mediaTransport()?.origin).toBe('http://192.168.1.20:4420');
    await openCameraStream({ live: live.live, path: PREVIEW_PATH, signal: new AbortController().signal });
    expect(streamFetch().mock.calls.map(([url]) => url)).toEqual([`http://192.168.1.20:4420${PREVIEW_PATH}`]);
  });

  it('a Live source built before the stored address was read never starts: it reads no credential and sends nothing (R225-F3)', async () => {
    await AsyncStorage.setItem(MOBILE_PREFS_KEY, JSON.stringify({ coreAddress: { host: NEW.host, port: NEW.port } }));
    secure.seed(SECURE_ITEM_KEYS.deviceCredential, JSON.stringify(STORED));
    const stale = createLive();
    await act(async () => {
      await stale.start();
    });
    await settle();
    expect(stale.isReady()).toBe(false);
    expect(fake.calls).toEqual([]);
    expect(fake.connections).toEqual([]);
    stale.stop();
    // The source of the stored address is the one that runs.
    const live = createLive();
    await act(async () => {
      await live.start();
    });
    await settle();
    expect(live.getPairing().state).toBe('PAIRED');
    expect(fake.calls.length).toBeGreaterThan(0);
    for (const call of fake.calls) expect(call.url.startsWith(`${NEW_ORIGIN.http}/api/v1/`)).toBe(true);
    for (const socket of fake.connections) expect(socket.url).toBe(NEW_ORIGIN.ws);
  });
});

describe('the runtime provider follows the address (D263)', () => {
  let liveSeen: unknown[] = [];

  function Probe() {
    const live = useMobileLive();
    const link = useCoreLink();
    if (!liveSeen.includes(live)) liveSeen.push(live);
    return <Text testID="probe">{`link=${link.source}/${link.state}`}</Text>;
  }

  beforeEach(() => {
    liveSeen = [];
    fake = createFakeTransport({
      clock: clockFromTimers({ now: () => Date.now(), setTimeout: (task, ms) => setTimeout(task, ms), clearTimeout: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>) }),
    });
    restoreTransport = installFakeTransport(fake);
    scriptCore();
  });

  it('a new address: the old Live source is stopped, a new one talks to the new Core, and Settings shows the address in force', async () => {
    secure.seed(SECURE_ITEM_KEYS.deviceCredential, JSON.stringify(STORED));
    const { unmount } = render(
      <AppProviders safeAreaMetrics={METRICS} heartbeatSocketFactory={() => new MockCoreSocket()}>
        <Probe />
        <SecuritySection />
      </AppProviders>,
    );
    await settle();
    expect(screen.getByTestId('probe')).toHaveTextContent('link=LIVE/ONLINE');
    expect(screen.getByTestId('settings-security-core-address-value')).toHaveTextContent('127.0.0.1:4420');
    const defaultSockets = fake.connections.filter((socket) => socket.url === DEFAULT_ORIGIN.ws);
    expect(defaultSockets).toHaveLength(1);
    const callsBefore = fake.calls.length;
    for (const call of fake.calls) expect(call.url.startsWith(`${DEFAULT_ORIGIN.http}/api/v1/`)).toBe(true);
    const sourcesBefore = liveSeen.filter((live) => live !== null).length;

    await act(async () => {
      await expect(setCoreAddress(NEW)).resolves.toBe('changed');
    });
    await settle();

    // The pairing with the previous Core is forgotten: the new Core's socket presents nothing.
    expect(secure.has(SECURE_ITEM_KEYS.deviceCredential)).toBe(false);
    expect(liveSeen.filter((live) => live !== null).length).toBe(sourcesBefore + 1);
    expect(defaultSockets[0]!.closed).toMatchObject({ by: 'client' });
    const newSockets = fake.connections.filter((socket) => socket.url === NEW_ORIGIN.ws);
    expect(newSockets).toHaveLength(1);
    expect(newSockets[0]!.headers).toEqual({});
    const after = fake.calls.slice(callsBefore);
    expect(after.length).toBeGreaterThan(0);
    for (const call of after) {
      expect(call.url.startsWith(`${NEW_ORIGIN.http}/api/v1/`)).toBe(true);
      expect(call.headers.authorization).toBeUndefined();
    }
    // Every socket went to one of the two origins and no other.
    for (const socket of fake.connections) expect([DEFAULT_ORIGIN.ws, NEW_ORIGIN.ws]).toContain(socket.url);
    expect(screen.getByTestId('settings-security-core-address-value')).toHaveTextContent('192.168.1.20:4420');
    unmount();
  });
});
