// Backend task W57, the ONE line this row was granted outside its folder (decision D124, ruling 2;
// finding F-2 of the mobile runtime row): `features/home/home-screen.tsx:217` printed the literal
// "mock-core" before the version, for whichever service answered. It now prints the service name of
// the health answer, without the product prefix `dems-`: "mock-core" for mock-core, exactly as
// before, and "core-server" for the Core server.
//
// The test lives here because this row's write paths are this folder and that one line.
import 'react-native-gesture-handler/jestSetup';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { QueryClient } from '@tanstack/react-query';
import { act, render, screen, waitFor } from '@testing-library/react-native';
import type { Metrics } from 'react-native-safe-area-context';
import { createFakeTransport, type FakeTransport } from '@dems/shared/live/testing';
import type { SocketLike } from '@dems/shared/realtime';
import { resetLoopRegistryForTests, resetMotionStateForTests } from '@/motion';
import { StackCheckRoute } from '@/navigation';
import { AppProviders } from '@/providers';
import { createMobileLive, resetCoreLinkPrefsForTests, resetDebugLaunchForTests, type MobileLive } from '@/runtime';
import { createTestSim } from '@/runtime/testing/test-sim';

jest.mock('@shopify/react-native-skia', () =>
  jest.requireActual<typeof import('@/components/media/testing/skia-mock')>('@/components/media/testing/skia-mock').createSkiaMock(),
);
jest.mock('@/features/home/pulse-ring', () => ({ PulseRing: () => null }));
jest.mock('expo-keep-awake', () => ({
  useKeepAwake: () => undefined,
  activateKeepAwakeAsync: jest.fn(async () => undefined),
  deactivateKeepAwake: jest.fn(async () => undefined),
}));

const METRICS: Metrics = { frame: { x: 0, y: 0, width: 411, height: 923 }, insets: { top: 24, right: 0, bottom: 16, left: 0 } };
const MOCK_CORE = {
  status: 'ok',
  service: 'dems-mock-core',
  version: '0.1.0',
  apiVersion: 'v1',
  serverTime: '2026-09-30T16:41:00.000Z',
  uptimeMs: 7000,
  ws: { path: '/ws', heartbeatIntervalMs: 1000, clients: 1 },
};

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

const queryClient = () => new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Number.POSITIVE_INFINITY } } });
let mobile: MobileLive | undefined;
let fake: FakeTransport | undefined;
const realFetch = globalThis.fetch;

beforeEach(async () => {
  await AsyncStorage.clear();
  resetCoreLinkPrefsForTests();
  resetDebugLaunchForTests();
  resetMotionStateForTests();
  resetLoopRegistryForTests();
});

afterEach(() => {
  mobile?.stop();
  mobile = undefined;
  fake?.assertNoViolations();
  fake = undefined;
  globalThis.fetch = realFetch;
});

describe('Stack Check prints the name of the service that answered', () => {
  it('LIVE mode: the Core server, with its own version', async () => {
    const transport = createFakeTransport();
    fake = transport;
    transport.scriptAnonymousStart();
    transport.answer('getServiceHealth', {
      status: 200,
      body: { ...(transport.example('getServiceHealth').body as object), service: 'dems-core-server', version: '0.2.0', ready: { database: true, engine: true } },
    });
    transport.onConnect((connection) => {
      if (connection.state === 'OPEN') connection.heartbeat();
    });
    const created = createMobileLive({ fetch: transport.fetch, socketFactory: transport.socketFactory, now: transport.clock.now, timers: transport.clock.timers, random: () => 0 });
    if (created === null) throw new Error('jest is a debug build: a Live source is built');
    mobile = created;
    const { unmount } = render(
      <AppProviders sim={created.sim} queryClient={queryClient()} safeAreaMetrics={METRICS} heartbeatSocketFactory={() => new MockCoreSocket()}>
        <StackCheckRoute motion={undefined} />
      </AppProviders>,
    );
    await act(async () => {
      for (let turn = 0; turn < 60; turn += 1) await Promise.resolve();
    });
    await waitFor(() => expect(screen.getByTestId('health-version')).toHaveTextContent('core-server v0.2.0 · api v1'));
    expect(screen.getByTestId('health-version')).not.toHaveTextContent(/mock/);
    unmount();
  });

  it('SIMULATED mode: mock-core, the line as it was', async () => {
    globalThis.fetch = jest.fn(async () => ({ ok: true, status: 200, json: async () => MOCK_CORE })) as unknown as typeof fetch;
    const { unmount } = render(
      <AppProviders sim={createTestSim().sim} queryClient={queryClient()} safeAreaMetrics={METRICS} heartbeatSocketFactory={() => new MockCoreSocket()}>
        <StackCheckRoute motion={undefined} />
      </AppProviders>,
    );
    await waitFor(() => expect(screen.getByTestId('health-version')).toHaveTextContent('mock-core v0.1.0 · api v1'));
    unmount();
  });
});
