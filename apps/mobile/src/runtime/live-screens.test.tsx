// Backend task W51: the two screens an unpaired tablet can open in LIVE mode, drawn on the Live
// source's replica (04_client_integration_spec §2.3: "`useSim`, `useSimInstance`, `useSimReady` …
// work on it without a change"; §9.4 route table: `/pair` and `/stack-check` stay reachable).
//
// This row changes the runtime, not the screens: the Pair screen is the pairing row's, the Stack
// Check screen is the predecessor's proof screen. What is held here is that both DRAW on a replica
// that holds no Core data (an anonymous socket: `hello` and `heartbeat` only), that nothing is
// reported as a misuse of a Live action while they are only looked at, and that the runtime tells
// them the source: `useCoreLink().source === 'LIVE'`, with which a screen picks its LIVE wording
// (the chip text `mobile.pairing.live` is in the resources for it).
import 'react-native-gesture-handler/jestSetup';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { QueryClient } from '@tanstack/react-query';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, render, screen } from '@testing-library/react-native';
import { Dimensions, Text } from 'react-native';
import type { Metrics } from 'react-native-safe-area-context';
import { createFakeTransport, type FakeTransport } from '@dems/shared/live/testing';
import type { SocketLike } from '@dems/shared/realtime';
import { PairingScreen } from '@/features/pairing/pairing-screen';
import { getMissingKeys, i18n, resetMissingKeys } from '@/i18n';
import { resetLoopRegistryForTests, resetMotionStateForTests } from '@/motion';
import { StackCheckRoute } from '@/navigation';
import { AppProviders } from '@/providers';
import { useCoreLink, usePairing } from './contract';
import { resetCoreLinkPrefsForTests } from './core-link';
import { resetDebugLaunchForTests } from './debug';
import { createMobileLive, type MobileLive } from './sim-adapters';

jest.mock('@shopify/react-native-skia', () =>
  jest.requireActual<typeof import('@/components/media/testing/skia-mock')>('@/components/media/testing/skia-mock').createSkiaMock(),
);
jest.mock('@/features/home/pulse-ring', () => ({ PulseRing: () => null }));
jest.mock('expo-keep-awake', () => ({
  useKeepAwake: () => undefined,
  activateKeepAwakeAsync: jest.fn(async () => undefined),
  deactivateKeepAwake: jest.fn(async () => undefined),
}));
const mockRouter = { back: jest.fn(), replace: jest.fn(), push: jest.fn(), navigate: jest.fn(), canGoBack: jest.fn(() => true) };
jest.mock('expo-router', () => ({
  useRouter: () => mockRouter,
  useIsFocused: () => true,
}));

const METRICS: Metrics = {
  frame: { x: 0, y: 0, width: 411, height: 923 },
  insets: { top: 24, right: 0, bottom: 16, left: 0 },
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

async function flush(turns = 40): Promise<void> {
  await act(async () => {
    for (let turn = 0; turn < turns; turn += 1) await Promise.resolve();
    await new Promise((resolve) => setTimeout(resolve, 0));
    for (let turn = 0; turn < turns; turn += 1) await Promise.resolve();
  });
}

/** What a screen reads to pick its wording. */
function SourceProbe() {
  const link = useCoreLink();
  const pairing = usePairing();
  return <Text testID="source">{`${link.source}/${link.state} ${pairing.required ? pairing.state : 'not-required'}`}</Text>;
}

function mount(ui: React.ReactElement) {
  const created = createMobileLive({ fetch: fake.fetch, socketFactory: fake.socketFactory, now: fake.clock.now, timers: fake.clock.timers, random: () => 0 });
  if (created === null) throw new Error('jest is a debug build: a Live source is built');
  mobile = created;
  return render(
    <AppProviders
      sim={created.sim}
      // No garbage-collection timer: nothing outlives the test.
      queryClient={new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Number.POSITIVE_INFINITY } } })}
      safeAreaMetrics={METRICS}
      heartbeatSocketFactory={() => new MockCoreSocket()}
    >
      <SourceProbe />
      {ui}
    </AppProviders>,
  );
}

beforeEach(async () => {
  await AsyncStorage.clear();
  resetCoreLinkPrefsForTests();
  resetDebugLaunchForTests();
  resetMotionStateForTests();
  resetLoopRegistryForTests();
  resetMissingKeys();
  act(() => {
    Dimensions.set({ window: { width: 411, height: 923, scale: 2, fontScale: 1 }, screen: { width: 411, height: 923, scale: 2, fontScale: 1 } });
  });
  fake = createFakeTransport();
  fake.scriptAnonymousStart();
  fake.answer('getServiceHealth', { status: 200, body: { ...(fake.example('getServiceHealth').body as object), service: 'dems-core-server', version: '0.2.0', ready: { database: true, engine: true } } });
  fake.onConnect((connection) => {
    if (connection.state === 'OPEN') connection.heartbeat();
  });
});

afterEach(() => {
  mobile?.stop();
  // Looking at a screen calls no Core action: nothing may have been read as a value.
  expect(mobile?.live.errors().filter((report) => report.source.startsWith('live.misuse'))).toEqual([]);
  mobile = undefined;
  fake.assertNoViolations();
});

describe('an unpaired tablet in LIVE mode', () => {
  it('the Pair screen draws on the replica: no Core data, the code slots, and the source the runtime reports is LIVE', async () => {
    const { unmount } = mount(<PairingScreen />);
    await flush();
    expect(screen.getByTestId('source').props.children).toBe('LIVE/ONLINE UNPAIRED');
    expect(screen.getByTestId('screen-pair')).toBeTruthy();
    expect(screen.getByTestId('pairing-connection')).toBeTruthy();
    expect(screen.getByTestId('pairing-state-chip')).toHaveTextContent('Not paired');
    // The wording the screen picks for LIVE is in the resources.
    expect(i18n.t('mobile.pairing.live')).toBe('LIVE');
    expect(i18n.t('mobile.coreLink.source.LIVE')).toBe('Live');
    // An anonymous socket carries no state: the only calls are the two public reads of the bootstrap.
    expect([...fake.log.operationIds()].sort()).toEqual(['getAuthSession', 'getSignInStatus']);
    expect(getMissingKeys()).toEqual([]);
    unmount();
  });

  it('Stack Check shows the Core server: its heartbeat on the one socket, and its health', async () => {
    const { unmount } = mount(<StackCheckRoute motion={undefined} />);
    await flush();
    expect(screen.getByTestId('screen-stack-check')).toBeTruthy();
    expect(screen.getByTestId('heartbeat-chip')).toHaveTextContent(/Live/);
    expect(screen.getByTestId('health-version')).toHaveTextContent(/v0\.2\.0 · api v1/);
    act(() => {
      fake.connection().heartbeat();
    });
    expect(screen.getByTestId('heartbeat-seq')).toHaveTextContent(/^[0-9]+$/);
    expect(fake.connections).toHaveLength(1);
    unmount();
  });
});
