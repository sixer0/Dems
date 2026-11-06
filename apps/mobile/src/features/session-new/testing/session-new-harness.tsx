/**
 * Test-only harness for the Start Session suites (step 78). Never import it from app code.
 *
 * It renders a small Expo Router tree around the REAL `/session/new` route file (so the route's
 * busy policy, `useSessionNewRedirect`, runs exactly as on a device) inside the real `AppProviders`
 * with an injected, hydrated test simulator (step 73's `createTestSim`: manual clock and manual
 * scheduler, so a test drives time with `advance(ms)`). The simulator is signed in as a demo
 * operator (default: AKP Budi Santoso, INVESTIGATOR).
 *
 * Only this feature's route is real. Home is a one-line stand-in; `/session/live` is a stand-in
 * that applies the live route's own policy (`useSessionLiveRedirect`: anything but RECORDING is
 * sent back), so the hand-off test proves the monitor is reached with the session RECORDING,
 * without depending on step 79's screen, which is built at the same time (P11).
 *
 * Import order: `./session-new-test-setup` first, then `@/navigation/testing/router-harness`, then
 * this module (see those headers).
 */
import { QueryClient } from '@tanstack/react-query';
import { Redirect, Stack, router } from 'expo-router';
import { act } from '@testing-library/react-native';
import { Text } from 'react-native';
import type { Metrics } from 'react-native-safe-area-context';
import { DEMO_OPERATOR_PASSWORD, OPERATORS, type Sim, type SimState } from '@dems/shared/sim';
import SessionNewRoute from '@/app/(app)/session/new';
import { useSessionLiveRedirect } from '@/navigation';
import { TEST_INSETS, WINDOWS, renderRoutes, resetShellState, setWindow, type WindowName } from '@/navigation/testing/router-harness';
import { AppProviders } from '@/providers';
import { FakeHeartbeatSocket, createTestSim, flushAsync, type TestSim } from '@/runtime/testing/test-sim';

/** Lets the providers' one async start-up update (the Core-link preference read) settle. */
export const settle = flushAsync;

/** `/session/live` stand-in with the live route's policy (not RECORDING → the §3.7 target). */
function LiveStandIn() {
  const redirect = useSessionLiveRedirect();
  if (redirect !== null) return <Redirect href={redirect} />;
  return <Text testID="screen-session-live">live</Text>;
}

function sessionNewRoot(sim: Sim, window: WindowName, sockets: FakeHeartbeatSocket[]) {
  const { width, height } = WINDOWS[window];
  const metrics: Metrics = { frame: { x: 0, y: 0, width, height }, insets: TEST_INSETS };
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  return function SessionNewTestRoot() {
    return (
      <AppProviders
        sim={sim}
        safeAreaMetrics={metrics}
        queryClient={queryClient}
        heartbeatSocketFactory={() => {
          const socket = new FakeHeartbeatSocket();
          sockets.push(socket);
          return socket;
        }}
      >
        <Stack screenOptions={{ headerShown: false }} />
      </AppProviders>
    );
  };
}

export interface SessionNewHarnessOptions {
  window?: WindowName;
  /** Index into the demo `OPERATORS` (0 Budi INVESTIGATOR, 1 Andi SUPERVISOR, 2 Rina TECHNICIAN). */
  operator?: number;
  /** Runs on the signed-in simulator before the first render (faults, scenarios, a session). */
  setup?: (test: TestSim) => void;
  /** Where the app starts; `/home` (default) then `openFlow()` pushes Start Session over it. */
  initialUrl?: string;
}

export interface SessionNewHarness extends TestSim {
  app: ReturnType<typeof renderRoutes>;
  sockets: FakeHeartbeatSocket[];
  /** Pushes `/session/new` over Home, the way the Home "Start Session" button does. */
  openFlow(href?: string): void;
  /** Advances the simulator clock inside `act` (the engine ticks every `stepMs`). */
  tick(ms: number, stepMs?: number): void;
  state(): SimState;
}

export function renderSessionNewApp({
  window = 'phonePortrait',
  operator = 0,
  setup,
  initialUrl = '/home',
}: SessionNewHarnessOptions = {}): SessionNewHarness {
  resetShellState();
  setWindow(window);
  const test = createTestSim();
  const who = OPERATORS[operator]!;
  const signIn = test.sim.actions.signIn(who.username, DEMO_OPERATOR_PASSWORD);
  if (!signIn.ok) throw new Error('session-new harness: demo sign-in failed');
  setup?.(test);
  const sockets: FakeHeartbeatSocket[] = [];
  const routes = {
    _layout: sessionNewRoot(test.sim, window, sockets),
    index: () => <Text testID="screen-index">index</Text>,
    home: () => <Text testID="screen-home">home</Text>,
    'session/new': SessionNewRoute,
    'session/live': LiveStandIn,
    'session/recovery': () => <Text testID="screen-session-recovery">recovery</Text>,
  };
  const app = renderRoutes(routes, initialUrl);
  return {
    ...test,
    app,
    sockets,
    openFlow(href = '/session/new') {
      act(() => router.push(href as never));
    },
    tick(ms, stepMs = 100) {
      act(() => test.advance(ms, stepMs));
    },
    state: () => test.sim.store.getState(),
  };
}

/** Audit row types in order (oldest first). */
export function auditTypes(state: SimState): string[] {
  return state.audit.rows.map((row) => row.type);
}
