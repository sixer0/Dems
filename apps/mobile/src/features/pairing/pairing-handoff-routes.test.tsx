// Row FX-M1 (end-to-end round, decision D201): where the app lands after a redeem, after a sign-out
// and on a guarded deep link while the pairing gate holds. ROUTE tests: the real route tree of
// `src/app`, the real `RootNavigator`, the real Pair screen and the real `+native-intent`, around a
// fake runtime contract, as the navigation shell's own route tests do. The root here is the root
// layout's composition (`src/app/_layout.tsx`): `RootNavigator` with `SignedOutLanding` beside it;
// a static check below holds the layout to it.
//
// - E2E-S-1: after a redeem the app landed on Stack Check (twice), after a sign-out on the paired
//   Pair view, never on Login by itself. Cause: (1) the Pair screen's hand-off went "back" to the
//   public screen deep links had pushed underneath; (2) after a sign-out React Navigation keeps the
//   public routes that are still allowed, so the screen under `(app)` became the top one.
// - E2E-S-4: while unpaired, a warm deep link to a guarded screen left the app where it was. Cause:
//   `+native-intent` turned it into `/login`, whose `(auth)` group the gate removes, and Expo Router
//   drops a warm link whose route is not in the root navigator.
// The harness must be the first import (see its header).
import { FakeRuntime, TEST_INSETS, WINDOWS, appContext, renderApp, renderRoutes, resetShellState, setWindow } from '@/navigation/testing/router-harness';
import { afterEach, beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { QueryClient } from '@tanstack/react-query';
import { act, fireEvent, screen } from '@testing-library/react-native';
import { router } from 'expo-router';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { useSyncExternalStore, type ComponentType, type ReactNode } from 'react';
import type { Metrics } from 'react-native-safe-area-context';
import type { SocketLike } from '@dems/shared/realtime';
import { DEMO_PAIRING_CODE, PairingState, type Sim } from '@dems/shared/sim';
import { peekPendingHref, setSignedInSnapshot } from '@/navigation/pending-href';
import { RootNavigator } from '@/navigation/root-navigator';
import { AppProviders } from '@/providers';
import {
  RuntimeContractProvider,
  SignedOutLanding,
  createRuntimeContract,
  isPairingGateHeld,
  setCoreLinkSource,
  notePairingGate,
  releasePairingGate,
  resetPairingGateForTests,
  type PairingInfo,
} from '@/runtime';
import { createTestSim, type TestSim } from '@/runtime/testing/test-sim';
import { redirectSystemPath } from '../../app/+native-intent';
import { PAIR_TIMELINE } from './pairing-model';

jest.mock('@/features/home/pulse-ring', () => ({ PulseRing: () => null }));

const LIVE_UNPAIRED: PairingInfo = { required: true, state: 'UNPAIRED', notice: null, deviceId: null };
const LIVE_REVOKED: PairingInfo = { required: true, state: 'UNPAIRED', notice: 'revoked', deviceId: null };
const LIVE_PAIRED: PairingInfo = { required: true, state: 'PAIRED', notice: null, deviceId: 'DEV-0002' };

class FakeSocket implements SocketLike {
  readyState = 0;
  onopen: SocketLike['onopen'] = null;
  onmessage: SocketLike['onmessage'] = null;
  onclose: SocketLike['onclose'] = null;
  onerror: SocketLike['onerror'] = null;
  close() {
    this.readyState = 3;
  }
}

function FakeRuntimeProvider({ runtime, children }: { runtime: FakeRuntime; children: ReactNode }) {
  const state = useSyncExternalStore(runtime.subscribe, runtime.getSnapshot);
  const value = createRuntimeContract({ auth: runtime.auth(), session: state.session, ...(state.pairing ? { pairing: state.pairing } : {}) });
  return <RuntimeContractProvider value={value}>{children}</RuntimeContractProvider>;
}

/** The root layout's composition (`src/app/_layout.tsx`) around the fake runtime. */
function layoutRoot(runtime: FakeRuntime, sim: Sim | undefined): ComponentType {
  const { width, height } = WINDOWS.phonePortrait;
  const metrics: Metrics = { frame: { x: 0, y: 0, width, height }, insets: TEST_INSETS };
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  return function TestRootLayout() {
    return (
      <AppProviders safeAreaMetrics={metrics} queryClient={queryClient} heartbeatSocketFactory={() => new FakeSocket()} {...(sim ? { sim } : {})}>
        <FakeRuntimeProvider runtime={runtime}>
          <RootNavigator />
          <SignedOutLanding />
        </FakeRuntimeProvider>
      </AppProviders>
    );
  };
}

function renderLayout(initialUrl: string, runtime: FakeRuntime, sim?: Sim) {
  setWindow('phonePortrait');
  setSignedInSnapshot(runtime.getSnapshot().operator != null);
  return renderRoutes(appContext({ _layout: layoutRoot(runtime, sim) }), initialUrl);
}

/** Advances the Pair screen's simulator clock and lets the commit / hand-off microtasks and the routing queue run. */
async function advance(test: TestSim, ms: number): Promise<void> {
  await act(async () => {
    test.advance(ms);
    await Promise.resolve();
  });
  await act(async () => {
    for (let turn = 0; turn < 10; turn += 1) await Promise.resolve();
  });
}

/** Pairs on the Pair screen with the simulator's demo code; the runtime's gate opens as the Live runtime opens it once the credential is stored. */
async function pairHere(test: TestSim, runtime: FakeRuntime): Promise<void> {
  fireEvent.changeText(screen.getByTestId('pairing-code-input'), DEMO_PAIRING_CODE);
  fireEvent.press(screen.getByTestId('pairing-pair'));
  await advance(test, PAIR_TIMELINE.commitAt);
  expect(test.sim.store.getState().pairing.state).toBe('PAIRED');
  runtime.setPairing(LIVE_PAIRED);
}

/** The system-URL listener Expo Router registers with `expo-linking` (warm deep links). */
let urlListeners: ((event: { url: string }) => unknown)[] = [];
const linkingModule = jest.requireMock<Record<string, unknown>>('expo-linking');
const originalAddEventListener = linkingModule.addEventListener;

/** A warm deep link, delivered the way the system delivers it to the running app. */
async function deepLink(url: string): Promise<void> {
  expect(urlListeners.length).toBeGreaterThan(0);
  await act(async () => {
    for (const listener of urlListeners) await listener({ url });
  });
  await act(async () => {
    for (let turn = 0; turn < 10; turn += 1) await Promise.resolve();
  });
}

/** The gate as the app's Live source writes it while it runs (`createMobileLive`). */
const liveSource = {};

const originalFetch = global.fetch;

beforeAll(async () => {
  // Reanimated's UI-side frame-callback registry initialises on real timers (S72-12).
  await new Promise((resolve) => setTimeout(resolve, 50));
});

beforeEach(() => {
  resetShellState();
  resetPairingGateForTests();
  urlListeners = [];
  linkingModule.addEventListener = (_type: string, listener: (event: { url: string }) => unknown) => {
    urlListeners.push(listener);
    return { remove: () => undefined };
  };
  global.fetch = jest.fn(async () => ({ ok: false, status: 503, json: async () => ({}) })) as unknown as typeof fetch;
});

afterEach(() => {
  linkingModule.addEventListener = originalAddEventListener;
  resetPairingGateForTests();
  global.fetch = originalFetch;
});

describe('E2E-S-1: after a redeem the app reaches Login by itself, whatever deep links pushed underneath', () => {
  it('the phone of E2E-S-1: launched at /login?core=LIVE&motion=off, Stack Check and Pair pushed, then paired → Login, nothing to go back to', async () => {
    const test = createTestSim({ initialPairing: PairingState.UNPAIRED });
    const runtime = new FakeRuntime({ pairing: LIVE_UNPAIRED });
    const app = renderLayout('/login?core=LIVE&motion=off', runtime, test.sim);
    // The launch link lands on Pair: the gate removes `(auth)`, the boot router picks `/pair`.
    expect(app.getPathname()).toBe('/pair');
    // Steps 1b to 1e of the round: `demsdemo:///stack-check`, then `demsdemo:///pair`.
    act(() => router.push('/stack-check'));
    expect(app.getPathname()).toBe('/stack-check');
    act(() => router.push('/pair'));
    expect(app.getPathname()).toBe('/pair');
    expect(router.canGoBack()).toBe(true);

    await pairHere(test, runtime);
    expect(screen.getByTestId('pairing-handoff')).toBeTruthy();
    await advance(test, PAIR_TIMELINE.handoffAfter);

    // Before row FX-M1 the hand-off went back to Stack Check here.
    expect(app.getPathname()).toBe('/login');
    expect(screen.getByTestId('screen-login')).toBeTruthy();
    expect(screen.queryByTestId('screen-stack-check')).toBeNull();
    // The stack was reset: nothing visited before is underneath Login.
    expect(router.canGoBack()).toBe(false);
  });

  it('the re-pair after a revocation (step 6): the same hand-off reaches Login', async () => {
    const test = createTestSim({ initialPairing: PairingState.UNPAIRED });
    const runtime = new FakeRuntime({ pairing: LIVE_PAIRED });
    runtime.signInAs();
    const app = renderLayout('/stack-check', runtime, test.sim);
    act(() => router.push('/home'));
    expect(app.getPathname()).toBe('/home');
    // The Core revokes: the operator is signed out and the gate holds with the `revoked` notice.
    act(() => {
      runtime.signOut();
      runtime.setPairing(LIVE_REVOKED);
    });
    expect(app.getPathname()).toBe('/pair');
    await pairHere(test, runtime);
    await advance(test, PAIR_TIMELINE.handoffAfter);
    expect(app.getPathname()).toBe('/login');
    expect(router.canGoBack()).toBe(false);
  });

  it('"Continue to sign-in" is the same hand-off: Login, never back to Stack Check', async () => {
    const test = createTestSim({ initialPairing: PairingState.UNPAIRED });
    const runtime = new FakeRuntime({ pairing: LIVE_UNPAIRED });
    const app = renderLayout('/', runtime, test.sim);
    act(() => router.push('/stack-check'));
    act(() => router.push('/pair'));
    await pairHere(test, runtime);
    fireEvent.press(screen.getByTestId('pairing-continue'));
    await advance(test, 0);
    expect(app.getPathname()).toBe('/login');
    expect(router.canGoBack()).toBe(false);
  });

  it('the launch link keeps its meaning: `/?motion=off` still opens the proof screen, and the reset `/` carries no query', async () => {
    const runtime = new FakeRuntime({ pairing: LIVE_PAIRED });
    const app = renderLayout('/?motion=off', runtime);
    expect(screen.getByTestId('screen-stack-check')).toBeTruthy();
    expect(app.getSearchParams()).toMatchObject({ motion: 'off' });
    act(() => router.push('/pair'));
    // What the hand-off does (`resetToBootRouter`): to the first screen, then `/` without a query.
    act(() => {
      router.dismissAll();
      router.replace('/');
    });
    expect(app.getPathname()).toBe('/login');
    expect(app.getSearchParams()).toEqual({});
  });
});

describe('E2E-S-1: after a sign-out the app lands on Login, not on a public screen left underneath', () => {
  it('the cause, shown on the navigator alone: without SignedOutLanding the sign-out uncovers the paired Pair view', () => {
    const runtime = new FakeRuntime({ pairing: LIVE_PAIRED });
    runtime.signInAs();
    const app = renderApp('/pair', { runtime, sim: createTestSim().sim });
    act(() => router.push('/home'));
    expect(app.getPathname()).toBe('/home');
    runtime.signOut();
    // React Navigation keeps the public route that is still allowed: no fall back to `/`.
    expect(app.getPathname()).toBe('/pair');
  });

  it('with the root layout as the app has it: the sign-out lands on Login and nothing is left underneath', () => {
    const runtime = new FakeRuntime({ pairing: LIVE_PAIRED });
    runtime.signInAs();
    const app = renderLayout('/pair', runtime, createTestSim().sim);
    act(() => router.push('/home'));
    expect(app.getPathname()).toBe('/home');
    runtime.signOut();
    expect(app.getPathname()).toBe('/login');
    expect(screen.getByTestId('screen-login')).toBeTruthy();
    expect(router.canGoBack()).toBe(false);
  });

  it('Stack Check underneath: the sign-out lands on Login', () => {
    const runtime = new FakeRuntime({ pairing: LIVE_PAIRED });
    runtime.signInAs();
    const app = renderLayout('/stack-check', runtime);
    act(() => router.push('/home'));
    runtime.signOut();
    expect(app.getPathname()).toBe('/login');
  });

  it('nothing underneath: the guard falls back to the boot router, which opens Login, once', () => {
    const runtime = new FakeRuntime({ pairing: LIVE_PAIRED });
    runtime.signInAs();
    const app = renderLayout('/home', runtime);
    expect(app.getPathname()).toBe('/home');
    runtime.signOut();
    expect(app.getPathname()).toBe('/login');
  });

  it('a revocation over Stack Check lands on Pair (the gate holds), and over Pair it stays on Pair', () => {
    const runtime = new FakeRuntime({ pairing: LIVE_PAIRED });
    runtime.signInAs();
    const app = renderLayout('/stack-check', runtime);
    act(() => router.push('/home'));
    act(() => {
      runtime.signOut();
      runtime.setPairing(LIVE_REVOKED);
    });
    expect(app.getPathname()).toBe('/pair');
    expect(screen.queryByTestId('screen-stack-check')).toBeNull();
  });

  it('a sign-in after it still follows the boot router (Home), the landing stays out of the way', () => {
    const runtime = new FakeRuntime({ pairing: LIVE_PAIRED });
    runtime.signInAs();
    const app = renderLayout('/pair', runtime, createTestSim().sim);
    act(() => router.push('/home'));
    runtime.signOut();
    expect(app.getPathname()).toBe('/login');
    runtime.signInAs();
    expect(app.getPathname()).toBe('/home');
  });
});

describe('E2E-S-4: while the gate holds, a warm deep link to a guarded screen opens Pair', () => {
  it('the cause, shown: `/home` became `/login`, which Expo Router drops while `(auth)` is not in the navigator', async () => {
    // The gate is only held where pairing is required: SIMULATED is the state this test shows the cause of.
    setCoreLinkSource('SIMULATED');
    const runtime = new FakeRuntime({ pairing: LIVE_UNPAIRED });
    const app = renderLayout('/stack-check', runtime);
    expect(app.getPathname()).toBe('/stack-check');
    // Gate not written (the state before row FX-M1, and SIMULATED mode): the link is the pending href and `/login`.
    expect(isPairingGateHeld()).toBe(false);
    expect(redirectSystemPath({ path: 'demsdemo:///home', initial: false })).toBe('/login');
    await deepLink('demsdemo:///home');
    expect(app.getPathname()).toBe('/stack-check');
  });

  it.each([['demsdemo:///home'], ['demsdemo:///login'], ['demsdemo:///sessions'], ['demsdemo:///evidence?selected=EV-1&motion=off'], ['demsdemo:///dev-gallery']])(
    'from Stack Check, %s opens /pair',
    async (url) => {
      const runtime = new FakeRuntime({ pairing: LIVE_UNPAIRED });
      const app = renderLayout('/stack-check', runtime);
      notePairingGate(liveSource, LIVE_UNPAIRED);
      await deepLink(url);
      expect(app.getPathname()).toBe('/pair');
      expect(screen.getByTestId('screen-pair')).toBeTruthy();
    },
  );

  it('the guarded link stays pending through the gate (MP-12): after pairing and sign-in it opens', async () => {
    const test = createTestSim({ initialPairing: PairingState.UNPAIRED });
    const runtime = new FakeRuntime({ pairing: LIVE_UNPAIRED });
    const app = renderLayout('/stack-check', runtime, test.sim);
    notePairingGate(liveSource, LIVE_UNPAIRED);
    await deepLink('demsdemo:///audit');
    expect(app.getPathname()).toBe('/pair');
    expect(peekPendingHref()).toBe('/audit');
    await pairHere(test, runtime);
    notePairingGate(liveSource, LIVE_PAIRED);
    await advance(test, PAIR_TIMELINE.handoffAfter);
    expect(app.getPathname()).toBe('/login');
    runtime.signInAs();
    expect(app.getPathname()).toBe('/audit');
  });

  it('public links pass unchanged while the gate holds; every link passes unchanged once it is released', () => {
    notePairingGate(liveSource, LIVE_UNPAIRED);
    expect(redirectSystemPath({ path: 'demsdemo:///stack-check', initial: false })).toBe('demsdemo:///stack-check');
    expect(redirectSystemPath({ path: 'demsdemo:///pair', initial: false })).toBe('demsdemo:///pair');
    expect(redirectSystemPath({ path: 'demsdemo://?motion=slow', initial: false })).toBe('demsdemo://?motion=slow');
    expect(redirectSystemPath({ path: 'https://example.invalid/home', initial: false })).toBe('https://example.invalid/home');
    releasePairingGate(liveSource);
    expect(isPairingGateHeld()).toBe(false);
    expect(redirectSystemPath({ path: 'demsdemo:///login', initial: false })).toBe('demsdemo:///login');
  });
});

describe('the root layout mounts the landing beside the navigator (what these tests render)', () => {
  // The layout cannot be loaded in Jest (it imports `global.css`), so this check reads its text. An
  // in-memory mutation of the layout cannot reach a file read; the negative controls below show the
  // check fails for a layout without the landing, or with it outside the boot gate.
  // Fix wave J (JM-01 d): the two now sit inside `UiRuntimeBoundary` (the screens are mounted anew, or replaced by a
  // plain notice, when the animation runtime stops) - still inside the boot gate, still side by side.
  const MOUNTED = /<BootGate>\s*(?:\{\/\*[^]*?\*\/\}\s*)?<UiRuntimeBoundary>\s*<RootNavigator \/>\s*<SignedOutLanding \/>\s*<\/UiRuntimeBoundary>\s*<\/BootGate>/;
  const layout = readFileSync(join(__dirname, '../../app/_layout.tsx'), 'utf8');

  it('`src/app/_layout.tsx` renders `<RootNavigator />` and `<SignedOutLanding />` inside BootGate', () => {
    expect(layout).toMatch(MOUNTED);
    expect(layout).toContain("import { SignedOutLanding } from '@/runtime/signed-out-landing';");
  });

  it('negative controls: the check fails without the landing, and with the landing outside the gate', () => {
    expect(layout.replace('<SignedOutLanding />', '')).not.toMatch(MOUNTED);
    expect(layout.replace(MOUNTED, '<BootGate><RootNavigator /></BootGate><SignedOutLanding />')).not.toMatch(MOUNTED);
    expect(layout.replace(MOUNTED, '<BootGate><RootNavigator /></BootGate><SignedOutLanding />')).not.toBe(layout);
  });
});
