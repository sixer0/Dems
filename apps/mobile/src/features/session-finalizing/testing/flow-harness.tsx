/**
 * Test-only harness for the Finalization and Session Summary suites (step 80). Never import it from
 * app code.
 *
 * It renders a small Expo Router tree around the REAL `/session/finalizing` and
 * `/session/summary/[sessionId]` route files inside the real `AppProviders`, with an injected,
 * hydrated test simulator (step 73's `createTestSim`: manual clock and scheduler) signed in as the
 * first demo operator. With `routeSync` (default) the runtime's real `SessionRouteSync` is mounted
 * too, as `(app)/_layout.tsx` mounts it on a device, so the FINALIZING → SEALED hand-off is the
 * production one. Home, Live, Recovery and the Evidence detail are one-line stand-ins, so these
 * suites do not depend on screens other steps build at the same time (P11).
 *
 * Import `./flow-test-setup` FIRST in a test file (the gorhom mock), then
 * `@/navigation/testing/router-harness`, then this module.
 */
import { QueryClient } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { act } from '@testing-library/react-native';
import { Text } from 'react-native';
import type { Metrics } from 'react-native-safe-area-context';
import { DEMO_OPERATOR_PASSWORD, OPERATORS, ScenarioName, type Sim } from '@dems/shared/sim';
import SessionFinalizingRoute from '@/app/(app)/session/finalizing';
import SessionSummaryRoute from '@/app/(app)/session/summary/[sessionId]';
import { TEST_INSETS, WINDOWS, renderRoutes, resetShellState, setWindow, type WindowName } from '@/navigation/testing/router-harness';
import { AppProviders } from '@/providers';
import { SessionRouteSync } from '@/runtime';
import { FakeHeartbeatSocket, createTestSim, flushAsync, type TestSim } from '@/runtime/testing/test-sim';

/** Lets the providers' one async start-up update (the Core-link preference read) settle. */
export const settle = flushAsync;

export interface FlowHarnessOptions {
  window?: WindowName;
  /**
   * `finalizing` (default): the D61 recording scenario stopped 1.6 s ago, step 1 running.
   * `sealed`: the same, advanced until SEALED (summary pending). `idle`: no session.
   */
  scenario?: 'finalizing' | 'sealed' | 'idle';
  /** Mount the runtime's `SessionRouteSync` (default true). */
  routeSync?: boolean;
  /** Default: `/session/finalizing`, or the sealed session's summary for `sealed`. */
  initialUrl?: string;
}

export interface FlowHarness extends TestSim {
  app: ReturnType<typeof renderRoutes>;
  /** The scenario session's ID (null for `idle`). */
  sessionId: string | null;
  /** Advances the simulator clock inside `act` (engine-sized steps). */
  run(ms: number): void;
}

function flowRoot(sim: Sim, window: WindowName, routeSync: boolean) {
  const { width, height } = WINDOWS[window];
  const metrics: Metrics = { frame: { x: 0, y: 0, width, height }, insets: TEST_INSETS };
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  return function FlowTestRoot() {
    return (
      <AppProviders sim={sim} safeAreaMetrics={metrics} queryClient={queryClient} heartbeatSocketFactory={() => new FakeHeartbeatSocket()}>
        {routeSync ? <SessionRouteSync /> : null}
        <Stack screenOptions={{ headerShown: false }} />
      </AppProviders>
    );
  };
}

/** Advances until the current session is SEALED (or `limitMs` passes). */
export function advanceUntilSealed(test: TestSim, limitMs = 15_000): void {
  let left = limitMs;
  while (left > 0 && test.sim.store.getState().session?.state !== 'SEALED') {
    test.advance(100);
    left -= 100;
  }
}

export function renderFlowApp({ window = 'phonePortrait', scenario = 'finalizing', routeSync = true, initialUrl }: FlowHarnessOptions = {}): FlowHarness {
  resetShellState();
  setWindow(window);
  const test = createTestSim();
  const operator = OPERATORS[0]!;
  const signIn = test.sim.actions.signIn(operator.username, DEMO_OPERATOR_PASSWORD);
  if (!signIn.ok) throw new Error('flow harness: demo sign-in failed');
  if (scenario !== 'idle') test.sim.actions.loadScenario(ScenarioName.FINALIZING);
  if (scenario === 'sealed') advanceUntilSealed(test);
  const sessionId = test.sim.store.getState().session?.id ?? null;

  const routes = {
    _layout: flowRoot(test.sim, window, routeSync),
    index: () => <Text testID="screen-index">index</Text>,
    home: () => <Text testID="screen-home">home</Text>,
    'session/live': () => <Text testID="screen-session-live">live</Text>,
    'session/recovery': () => <Text testID="screen-session-recovery">recovery</Text>,
    'session/finalizing': SessionFinalizingRoute,
    'session/summary/[sessionId]': SessionSummaryRoute,
    'evidence/[evidenceId]': () => <Text testID="screen-evidence-detail">evidence</Text>,
  };
  const url = initialUrl ?? (scenario === 'sealed' && sessionId ? `/session/summary/${sessionId}` : '/session/finalizing');
  const app = renderRoutes(routes, url);
  return {
    ...test,
    app,
    sessionId,
    run(ms: number) {
      act(() => test.advance(ms));
    },
  };
}
