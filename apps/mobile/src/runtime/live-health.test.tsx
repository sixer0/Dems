// Backend task W51: the health call of Stack Check (04_client_integration_spec §7.4, finding FC-9;
// decision D69). In LIVE mode the screen reads operation 1 `getServiceHealth` of the Core server
// through the typed client of the Live source; in the other modes it reads mock-core, as before.
//
// The screen itself (`features/home/home-screen.tsx`) is the unchanged proof screen of the
// predecessor; only its hook `use-health.ts` knows the mode.
import 'react-native-gesture-handler/jestSetup';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { QueryClient } from '@tanstack/react-query';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';
import type { Metrics } from 'react-native-safe-area-context';
import { CORE_API_EXAMPLES, type HealthResponse } from '@dems/shared/api';
import { createFakeTransport, type FakeTransport } from '@dems/shared/live/testing';
import type { SocketLike } from '@dems/shared/realtime';
import { HomeScreen } from '@/features/home/home-screen';
import { useHealth } from '@/features/home/use-health';
import { AppProviders } from '@/providers';
import { DEFAULT_CORE_ADDRESS, coreOriginOf } from './core-address';
import { resetCoreLinkPrefsForTests } from './core-link';
import { resetDebugLaunchForTests } from './debug';
import { createMobileLive, type MobileLive } from './sim-adapters';
import { createTestSim } from './testing/test-sim';

// Skia is proven on device, not in jest (the N-1 precedent of home-screen.test.tsx).
jest.mock('@/features/home/pulse-ring', () => ({ PulseRing: () => null }));
jest.mock('expo-keep-awake', () => ({
  useKeepAwake: () => undefined,
  activateKeepAwakeAsync: jest.fn(async () => undefined),
  deactivateKeepAwake: jest.fn(async () => undefined),
}));

const METRICS: Metrics = {
  frame: { x: 0, y: 0, width: 411, height: 923 },
  insets: { top: 24, right: 0, bottom: 16, left: 0 },
};
const MOCK_CORE_EXAMPLE = CORE_API_EXAMPLES.getServiceHealth?.responses[200]?.live?.value as HealthResponse;
/**
 * The Core server's answer (01_specs §7.4): its own service name, its version, and `ready`. The
 * contract's one example of operation 1 is mock-core's, so the Core server's body is written here.
 */
const CORE_SERVER_HEALTH: HealthResponse = { ...MOCK_CORE_EXAMPLE, service: 'dems-core-server', version: '0.2.0', ready: { database: true, engine: true } };
const MOCK_CORE_HEALTH: HealthResponse = {
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

let fake: FakeTransport;
let mobile: MobileLive | undefined;
const originalFetch = global.fetch;
let rawFetch: jest.Mock<(input: string) => Promise<unknown>>;

/** What the hook hands the screen. */
function HealthProbe() {
  const health = useHealth();
  return <Text testID="health">{health.isError ? 'error' : health.data ? `${health.data.service} ${health.data.version} ready=${JSON.stringify(health.data.ready ?? null)}` : 'pending'}</Text>;
}
const health = () => screen.getByTestId('health').props.children as string;

async function flush(turns = 40): Promise<void> {
  await act(async () => {
    for (let turn = 0; turn < turns; turn += 1) await Promise.resolve();
    // TanStack Query notifies its observers on a timer of 0 ms.
    await new Promise((resolve) => setTimeout(resolve, 0));
    for (let turn = 0; turn < turns; turn += 1) await Promise.resolve();
  });
}

// No retry: an error shows at once. No garbage-collection timer: nothing outlives the test.
const queryClient = () => new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Number.POSITIVE_INFINITY } } });

function mountLive() {
  const created = createMobileLive({ fetch: fake.fetch, socketFactory: fake.socketFactory, now: fake.clock.now, timers: fake.clock.timers, random: () => 0 });
  if (created === null) throw new Error('jest is a debug build: a Live source is built');
  mobile = created;
  return render(
    <AppProviders sim={created.sim} queryClient={queryClient()} safeAreaMetrics={METRICS} heartbeatSocketFactory={() => new MockCoreSocket()}>
      <HealthProbe />
      <HomeScreen motionMode="normal" />
    </AppProviders>,
  );
}

beforeEach(async () => {
  await AsyncStorage.clear();
  resetCoreLinkPrefsForTests();
  resetDebugLaunchForTests();
  fake = createFakeTransport();
  fake.scriptAnonymousStart();
  fake.onConnect((connection) => {
    if (connection.state === 'OPEN') connection.heartbeat();
  });
  // The app's own `fetch`: whatever reaches it did not go through the typed client of the test.
  rawFetch = jest.fn(async (input: string) => ({ ok: true, status: 200, json: async () => MOCK_CORE_HEALTH, url: input }));
  global.fetch = rawFetch as unknown as typeof fetch;
});

afterEach(() => {
  mobile?.stop();
  mobile = undefined;
  global.fetch = originalFetch;
  fake.assertNoViolations();
});

describe('Stack Check in LIVE mode: the health of the Core server (FC-9, D69)', () => {
  it('reads operation 1 through the typed client: the answer names `dems-core-server`, and no raw request is made', async () => {
    const body = CORE_SERVER_HEALTH;
    expect(MOCK_CORE_EXAMPLE.service).toBe('dems-mock-core');
    fake.answer('getServiceHealth', { status: 200, body });

    const { unmount } = mountLive();
    await flush();

    expect(health()).toBe(`dems-core-server ${body.version} ready=${JSON.stringify(body.ready ?? null)}`);
    // The screen prints the version it was given (its label is the predecessor's fixed text).
    expect(screen.getByTestId('health-version')).toHaveTextContent(new RegExp(`v${body.version.replace(/\./g, '\\.')} · api v1`));
    // The heartbeat panel reads the Live socket, not mock-core's.
    expect(screen.getByTestId('heartbeat-chip')).toHaveTextContent(/Live/);

    const calls = fake.log.requestsOf('getServiceHealth');
    expect(calls.length).toBeGreaterThan(0);
    for (const call of calls) {
      expect(call.method).toBe('GET');
      // D263 (row 236): the origin of the runtime's address source (its default here). Moved pin: was 'http://127.0.0.1:4420/api/v1/health'.
      expect(call.url).toBe(`${coreOriginOf(DEFAULT_CORE_ADDRESS).http}/api/v1/health`);
      expect(call.credentials).toBe('omit');
      expect(call.headers.cookie).toBeUndefined();
      // An unpaired tablet has no credential: health is public.
      expect(call.headers.authorization).toBeUndefined();
    }
    // Nothing went around the typed client: neither to mock-core nor to the Core server.
    expect(rawFetch).not.toHaveBeenCalled();
    unmount();
  });

  it('the Core server unreachable: the query is in its error state and the screen says "Core unreachable"', async () => {
    fake.fail('getServiceHealth');
    const { unmount } = mountLive();
    await flush();
    expect(health()).toBe('error');
    expect(screen.getByText('Core unreachable')).toBeTruthy();
    expect(screen.queryByTestId('health-version')).toBeNull();
    expect(rawFetch).not.toHaveBeenCalled();
    unmount();
  });

  it('an answer outside the contract is not shown: the typed client refuses it', async () => {
    fake.answer('getServiceHealth', { status: 200, body: { status: 'ok', service: 'something-else', version: '9.9.9' }, violatesContract: true });
    const { unmount } = mountLive();
    await flush();
    expect(health()).toBe('error');
    expect(screen.queryByTestId('health-version')).toBeNull();
    unmount();
  });

  it('the link comes back: the health is read again at once', async () => {
    fake.answer('getServiceHealth', { status: 200, body: CORE_SERVER_HEALTH });
    const { unmount } = mountLive();
    await flush();
    const before = fake.log.requestsOf('getServiceHealth').length;
    expect(before).toBe(1);
    const events: string[] = [];
    mobile!.live.onResync((event) => events.push(`${event.phase}/${event.cause}`));

    act(() => {
      fake.connection().drop();
    });
    await flush();
    // The first reconnect delay is 500 ms on the Live source's clock.
    act(() => {
      fake.clock.advance(1_000);
    });
    await flush();
    expect(fake.connections.length).toBe(2);
    expect(events).toEqual(['RESYNCED/RECONNECT']);
    // Two components read the health here (the probe and the screen): still ONE request.
    expect(fake.log.requestsOf('getServiceHealth').length).toBe(before + 1);
    unmount();
  });
});

describe('a change of the Core link source', () => {
  it('an answer of mock-core is never shown as the Core server\'s: each service has its own query', async () => {
    fake.answer('getServiceHealth', { status: 200, body: CORE_SERVER_HEALTH });
    const client = queryClient();
    const { sim } = createTestSim();
    const tree = (source: Parameters<typeof AppProviders>[0]['sim']) => (
      <AppProviders sim={source} queryClient={client} safeAreaMetrics={METRICS} heartbeatSocketFactory={() => new MockCoreSocket()}>
        <HealthProbe />
      </AppProviders>
    );
    const view = render(tree(sim));
    await flush();
    expect(health()).toBe('dems-mock-core 0.1.0 ready=null');

    const created = createMobileLive({ fetch: fake.fetch, socketFactory: fake.socketFactory, now: fake.clock.now, timers: fake.clock.timers, random: () => 0 });
    if (created === null) throw new Error('jest is a debug build: a Live source is built');
    mobile = created;
    view.rerender(tree(created.sim));
    // The first frame in LIVE mode: nothing of mock-core's answer, although the query client still holds it.
    expect(health()).toBe('pending');
    await flush();
    expect(health()).toBe('dems-core-server 0.2.0 ready={"database":true,"engine":true}');
    view.unmount();
    sim.stop();
  });
});

describe('Stack Check in SIMULATED mode: mock-core, as before', () => {
  it('reads mock-core with the shared health call; nothing goes to the Core server', async () => {
    const { sim } = createTestSim();
    const { unmount } = render(
      <AppProviders sim={sim} queryClient={queryClient()} safeAreaMetrics={METRICS} heartbeatSocketFactory={() => new MockCoreSocket()}>
        <HealthProbe />
        <HomeScreen motionMode="normal" />
      </AppProviders>,
    );
    await flush();
    expect(health()).toBe('dems-mock-core 0.1.0 ready=null');
    expect(screen.getByTestId('health-version')).toHaveTextContent('mock-core v0.1.0 · api v1');
    expect(rawFetch).toHaveBeenCalledTimes(1);
    expect(rawFetch.mock.calls[0]![0]).toBe('http://127.0.0.1:4400/api/v1/health');
    expect(fake.log.entries).toHaveLength(0);
    unmount();
    sim.stop();
  });
});
