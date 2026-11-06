// Row 236 (D263, the user's request): the "Core server address" field of the Pair screen, in LIVE mode, on the
// app's real Live source (`createMobileLive`) over the contract-checked fake transport, as `pairing-live.test.tsx`
// mounts it. The field shows before pairing, prefilled with the address in force; it refuses a public IPv4 address
// (and the other refused forms) with clear words and keeps Pair disabled while it holds an address that is not in
// force; "Use this address" puts the entered address in force, and the code then goes to THAT Core.
//
// The runtime provider builds a new Live source when the address changes (proved in
// `runtime/core-address-live.test.tsx`). Here the Live source is injected, as in `pairing-live.test.tsx`, so the
// test builds the next one itself, exactly as the provider does: `createMobileLive()` after the change.
import 'react-native-gesture-handler/jestSetup';
import { afterEach, beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { QueryClient } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react-native';
import { Dimensions } from 'react-native';
import type { Metrics } from 'react-native-safe-area-context';
import { CORE_API_EXAMPLES, type PairingRedeemed } from '@dems/shared/api';
import { createFakeTransport, type FakeHttpCall, type FakeTransport } from '@dems/shared/live/testing';
import type { SocketLike } from '@dems/shared/realtime';
import { getMissingKeys, resetMissingKeys } from '@/i18n';
import { resetLoopRegistryForTests, resetMotionStateForTests } from '@/motion';
import { AppProviders } from '@/providers';
import {
  DEFAULT_CORE_ADDRESS,
  createMobileLive,
  getCoreAddress,
  resetCoreAddressForTests,
  resetCoreErrorPresenterForTests,
  resetCoreLinkPrefsForTests,
  resetDebugLaunchForTests,
  type MobileLive,
} from '@/runtime';
import { SECURE_ITEM_KEYS } from '@/runtime/secure-credentials';
import { PAIR_TIMELINE } from './pairing-model';
import { PairingScreen } from './pairing-screen';

jest.mock('@shopify/react-native-skia', () =>
  jest.requireActual<typeof import('@/components/media/testing/skia-mock')>('@/components/media/testing/skia-mock').createSkiaMock(),
);
jest.mock('expo-keep-awake', () => ({
  useKeepAwake: () => undefined,
  activateKeepAwakeAsync: jest.fn(async () => undefined),
  deactivateKeepAwake: jest.fn(async () => undefined),
}));
const mockRouter = {
  back: jest.fn(),
  replace: jest.fn(),
  push: jest.fn(),
  navigate: jest.fn(),
  canGoBack: jest.fn(() => false),
  canDismiss: jest.fn(() => false),
  dismissAll: jest.fn(),
};
jest.mock('expo-router', () => ({
  useRouter: () => mockRouter,
  useIsFocused: () => true,
}));

/** A code of this test only (six digits, put together so that a search finds this line only). */
const CODE = ['236', '263'].join('');
const ENTERED = { host: '192.168.1.20', port: 4420 } as const;
const ENTERED_HTTP = `http://${ENTERED.host}:${ENTERED.port}/api/v1/`;
const ENTERED_WS = `ws://${ENTERED.host}:${ENTERED.port}/ws`;
const REDEEMED = CORE_API_EXAMPLES.redeemPairingCode?.responses[201]?.paired?.value as PairingRedeemed;
const METRICS: Metrics = { frame: { x: 0, y: 0, width: 411, height: 923 }, insets: { top: 24, right: 0, bottom: 16, left: 0 } };
const store = () => globalThis.__DEMS_SECURE_STORE_MOCK__;

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

let fake: FakeTransport;
let mobile: MobileLive | undefined;
let redeemed: FakeHttpCall[] = [];

async function flush(turns = 40): Promise<void> {
  await act(async () => {
    for (let turn = 0; turn < turns; turn += 1) await Promise.resolve();
  });
}
async function elapse(ms: number, step = 100): Promise<void> {
  for (let done = 0; done < ms; done += step) {
    act(() => {
      fake.clock.advance(Math.min(step, ms - done));
    });
    await flush();
  }
}

/** An unpaired Core that accepts `CODE` once (any origin: the test reads the URL of each request). */
function bootCore(): void {
  fake = createFakeTransport({ epoch: 2, revision: 10 });
  redeemed = [];
  fake.answer('getAuthSession', () => fake.example('getAuthSession', 401));
  fake.answer('getSignInStatus', () => fake.example('getSignInStatus', 200, 'open'));
  fake.answer('redeemPairingCode', (call) => {
    redeemed.push(call);
    return (call.body as { code?: unknown } | undefined)?.code === CODE ? { status: 201, body: REDEEMED } : fake.example('redeemPairingCode', 401);
  });
  fake.answer('getDeviceRegistration', (call) =>
    call.headers.authorization === `Bearer ${REDEEMED.deviceCredential}`
      ? { status: 200, body: { deviceId: REDEEMED.deviceId, name: 'Android device', state: 'PAIRED', pairedAt: REDEEMED.pairedAt, credentialRotatedAt: null, core: REDEEMED.core } }
      : fake.example('getDeviceRegistration', 401),
  );
  fake.onConnect((connection) => {
    if (connection.state !== 'CONNECTING') return;
    const bearer = connection.headers.Authorization ?? connection.headers.authorization;
    // The credential this Core issued opens a device socket; nothing else is presented here.
    if (bearer === `Bearer ${REDEEMED.deviceCredential}`) connection.startDevice().heartbeat();
    else connection.startAnonymous().heartbeat();
    connection.beatEvery();
  });
}

function createLive(): MobileLive {
  const created = createMobileLive({ fetch: fake.fetch, socketFactory: fake.socketFactory, now: fake.clock.now, timers: fake.clock.timers, random: () => 0 });
  if (created === null) throw new Error('jest is a debug build: a Live source is built');
  mobile = created;
  return created;
}

async function mount(): Promise<{ unmount: () => void }> {
  act(() => {
    Dimensions.set({ window: { width: 411, height: 923, scale: 2, fontScale: 1 }, screen: { width: 411, height: 923, scale: 2, fontScale: 1 } });
  });
  const live = createLive();
  const { unmount } = render(
    <AppProviders
      sim={live.sim}
      queryClient={new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Number.POSITIVE_INFINITY } } })}
      safeAreaMetrics={METRICS}
      heartbeatSocketFactory={() => new MockCoreSocket()}
    >
      <PairingScreen />
    </AppProviders>,
  );
  await flush();
  return { unmount };
}

const valueOf = (testID: string): unknown => screen.getByTestId(testID).props.value;
const disabled = (testID: string): boolean => screen.getByTestId(testID).props.accessibilityState?.disabled === true;
const typeAddress = (host: string, port: string): void => {
  fireEvent.changeText(screen.getByTestId('pairing-core-host'), host);
  fireEvent.changeText(screen.getByTestId('pairing-core-port'), port);
};
const apply = async (): Promise<void> => {
  fireEvent.press(screen.getByTestId('pairing-core-address-apply'));
  await flush();
};

beforeAll(async () => {
  await new Promise((resolve) => setTimeout(resolve, 50));
});

beforeEach(async () => {
  await AsyncStorage.clear();
  store().reset();
  resetCoreAddressForTests();
  resetCoreLinkPrefsForTests();
  resetDebugLaunchForTests();
  resetCoreErrorPresenterForTests();
  resetMotionStateForTests();
  resetLoopRegistryForTests();
  resetMissingKeys();
  jest.clearAllMocks();
  bootCore();
});

afterEach(() => {
  cleanup();
  mobile?.stop();
  mobile = undefined;
  resetCoreAddressForTests();
  fake.assertNoViolations();
});

describe('the Core server address on the Pair screen (row 236, D263)', () => {
  it('shows before pairing, prefilled with the address in force (the default: 127.0.0.1:4420)', async () => {
    const { unmount } = await mount();
    expect(screen.getByTestId('pairing-core-address')).toBeTruthy();
    expect(screen.getByText('Core server address')).toBeTruthy();
    expect(valueOf('pairing-core-host')).toBe(DEFAULT_CORE_ADDRESS.host);
    expect(valueOf('pairing-core-port')).toBe(String(DEFAULT_CORE_ADDRESS.port));
    expect(screen.getByTestId('pairing-core-address-in-use')).toHaveTextContent('In use: 127.0.0.1:4420');
    expect(getMissingKeys()).toEqual([]);
    unmount();
  });

  it('refuses a public IPv4 address (and a scheme, IPv6, a bad port) with clear words; nothing changes and Pair stays disabled', async () => {
    const { unmount } = await mount();
    fireEvent.changeText(screen.getByTestId('pairing-code-input'), CODE);
    expect(disabled('pairing-pair')).toBe(false);

    typeAddress('8.8.8.8', '4420');
    // An edit that is not in force: Pair waits for it.
    expect(disabled('pairing-pair')).toBe(true);
    expect(screen.getByTestId('pairing-core-address-in-use')).toHaveTextContent('Use this address before pairing, or put back 127.0.0.1:4420.');
    await apply();
    expect(screen.getByTestId('pairing-core-host-error')).toHaveTextContent('Use a private (10.x, 172.16-31.x, 192.168.x), loopback (127.x) or link-local (169.254.x) address.');
    expect(getCoreAddress()).toEqual(DEFAULT_CORE_ADDRESS);

    typeAddress('http://192.168.1.20', '4420');
    await apply();
    expect(screen.getByTestId('pairing-core-host-error')).toHaveTextContent('Enter the host only, without http:// or ws://.');
    typeAddress('fe80::1', '70000');
    await apply();
    expect(screen.getByTestId('pairing-core-host-error')).toHaveTextContent('IPv6 addresses are not supported. Use an IPv4 address or a host name.');
    expect(screen.getByTestId('pairing-core-port-error')).toHaveTextContent('The port must be between 1 and 65535.');
    expect(getCoreAddress()).toEqual(DEFAULT_CORE_ADDRESS);
    expect(disabled('pairing-pair')).toBe(true);

    // Putting the address in force back by hand lets Pair go again; nothing was sent for the refused ones.
    typeAddress('127.0.0.1', '4420');
    expect(disabled('pairing-pair')).toBe(false);
    expect(redeemed).toEqual([]);
    expect(getMissingKeys()).toEqual([]);
    unmount();
  });

  it('"Use this address" puts the entered address in force; the code then goes to the entered host, and nothing to the old one', async () => {
    const first = await mount();
    typeAddress(` ${ENTERED.host} `, String(ENTERED.port));
    await apply();
    await flush();
    expect(getCoreAddress()).toEqual(ENTERED);
    first.unmount();
    mobile?.stop();

    // What the runtime provider does on the change: a new Live source, built for the address in force.
    const callsBefore = fake.calls.length;
    const connectionsBefore = fake.connections.length;
    const { unmount } = await mount();
    expect(valueOf('pairing-core-host')).toBe(ENTERED.host);
    expect(screen.getByTestId('pairing-core-address-in-use')).toHaveTextContent(`In use: ${ENTERED.host}:${ENTERED.port}`);
    fireEvent.changeText(screen.getByTestId('pairing-code-input'), CODE);
    expect(disabled('pairing-pair')).toBe(false);
    fireEvent.press(screen.getByTestId('pairing-pair'));
    await elapse(PAIR_TIMELINE.commitAt + 200);
    await flush();

    // The one redeem went to the entered host; every request and socket of the new source did.
    expect(redeemed).toHaveLength(1);
    expect(redeemed[0]!.url.startsWith(`${ENTERED_HTTP}`)).toBe(true);
    const after = fake.calls.slice(callsBefore);
    expect(after.length).toBeGreaterThan(1);
    for (const call of after) expect(call.url.startsWith(ENTERED_HTTP)).toBe(true);
    const sockets = fake.connections.slice(connectionsBefore);
    expect(sockets.length).toBeGreaterThan(0);
    for (const socket of sockets) expect(socket.url).toBe(ENTERED_WS);
    // The credential of the new pairing is stored, for the Core that issued it.
    expect(store().has(SECURE_ITEM_KEYS.deviceCredential)).toBe(true);
    expect(screen.getByTestId('pairing-paired-card')).toBeTruthy();
    unmount();
  });
});
