/**
 * Test-only harness for the Session Monitor suites (step 79). Never import it from app code.
 *
 * It renders a small Expo Router tree around the REAL `/session/live` route file (so the route's
 * RECORDING policy and the screen's back guard run as on a device) inside the real `AppProviders`
 * with an injected, hydrated test simulator (step 73's `createTestSim`: manual clock and
 * scheduler). The simulator is signed in as the first demo operator and holds the recording
 * scenario (session 0024, 00:18:42 elapsed, D61), exactly what `?scenario=recording` loads.
 *
 * Only this feature's route is real: Home and Finalizing are one-line stand-ins, so the suites do
 * not depend on screens that other steps build at the same time (P11).
 *
 * Import `@/navigation/testing/router-harness` FIRST in a test file (its first import prepares the
 * module mocks Expo Router and Skia need), then this module.
 */
import { QueryClient } from '@tanstack/react-query';
import { Stack, router } from 'expo-router';
import { Profiler, type ProfilerOnRenderCallback, type ReactNode } from 'react';
import { act } from '@testing-library/react-native';
import { Text } from 'react-native';
import type { Metrics } from 'react-native-safe-area-context';
import { DEMO_OPERATOR_PASSWORD, OPERATORS, ScenarioName, type Sim } from '@dems/shared/sim';
import SessionLiveRoute from '@/app/(app)/session/live';
import { TEST_INSETS, WINDOWS, renderRoutes, resetShellState, setWindow, type WindowName } from '@/navigation/testing/router-harness';
import { AppProviders } from '@/providers';
import { FakeHeartbeatSocket, createTestSim, flushAsync, type TestSim } from '@/runtime/testing/test-sim';
import { SHEET_EXIT_MS } from '../use-sheet-presence';

/** Lets the providers' one async start-up update (the Core-link preference read) settle. */
export const settle = flushAsync;

/** Waits out a closing sheet's exit window (`useSheetPresence`), after which it unmounts. */
export async function waitForSheetExit(): Promise<void> {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, SHEET_EXIT_MS + 50));
  });
}

export interface MonitorHarnessOptions {
  window?: WindowName;
  /** Wraps the tree in a React Profiler (render counting, MA-16 screen form). */
  onRender?: ProfilerOnRenderCallback;
  /** Load the recording scenario (default true). */
  recording?: boolean;
  /**
   * `/home` (default): the monitor is pushed over Home by `openMonitor()`. `/session/live`: the
   * monitor is the only route, as after a sign-in or relaunch resync (F-79-1).
   */
  initialUrl?: '/home' | '/session/live';
  /**
   * Task 3 M5 (row 73; register MB-13): who is signed in, by username (default: the first demo
   * operator, the investigator who opened the recording scenario's session). The mic switch is for
   * that session holder or a SUPERVISOR (OD-09), so its gate tests sign in the other roles.
   */
  operator?: string;
}

export interface MonitorHarness extends TestSim {
  app: ReturnType<typeof renderRoutes>;
  sockets: FakeHeartbeatSocket[];
  /** Opens the monitor the way the app does (pushed over Home), so Back has somewhere to go. */
  openMonitor(): void;
}

function monitorRoot(sim: Sim, window: WindowName, sockets: FakeHeartbeatSocket[], onRender?: ProfilerOnRenderCallback) {
  const { width, height } = WINDOWS[window];
  const metrics: Metrics = { frame: { x: 0, y: 0, width, height }, insets: TEST_INSETS };
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  return function MonitorTestRoot() {
    const tree: ReactNode = (
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
    return onRender ? (
      <Profiler id="monitor" onRender={onRender}>
        {tree}
      </Profiler>
    ) : (
      tree
    );
  };
}

/** Renders Home with the monitor route available; call `openMonitor()` to push it. */
export function renderMonitorApp({
  window = 'phonePortrait',
  onRender,
  recording = true,
  initialUrl = '/home',
  operator: username,
}: MonitorHarnessOptions = {}): MonitorHarness {
  resetShellState();
  setWindow(window);
  const test = createTestSim();
  const operator = username === undefined ? OPERATORS[0]! : OPERATORS.find((entry) => entry.username === username);
  if (operator === undefined) throw new Error(`monitor harness: no demo operator "${username}"`);
  const signIn = test.sim.actions.signIn(operator.username, DEMO_OPERATOR_PASSWORD);
  if (!signIn.ok) throw new Error('monitor harness: demo sign-in failed');
  if (recording) test.sim.actions.loadScenario(ScenarioName.RECORDING);
  const sockets: FakeHeartbeatSocket[] = [];
  const routes = {
    _layout: monitorRoot(test.sim, window, sockets, onRender),
    index: () => <Text testID="screen-index">index</Text>,
    home: () => <Text testID="screen-home">home</Text>,
    'session/live': SessionLiveRoute,
    'session/finalizing': () => <Text testID="screen-session-finalizing">finalizing</Text>,
  };
  const app = renderRoutes(routes, initialUrl);
  return {
    ...test,
    app,
    sockets,
    openMonitor() {
      act(() => router.push('/session/live' as never));
    },
  };
}
