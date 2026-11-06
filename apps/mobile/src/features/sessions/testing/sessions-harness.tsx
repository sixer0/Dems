/**
 * Test-only harness for the Sessions hub suites (step 82). Never import it from app code.
 *
 * It renders a small Expo Router tree around the REAL sessions route files (`/sessions` and
 * `/sessions/[sessionId]` with their drill-in stack, so the master-detail hand-over and the
 * selection push run as on a device) inside the real `AppProviders` with an injected, hydrated test
 * simulator (step 73's `createTestSim`: manual clock and scheduler), signed in as a demo operator.
 * The hand-off targets (`/session/live`, `/session/finalizing`, `/session/recovery`,
 * `/session/summary/[sessionId]`, `/evidence`, `/evidence/[evidenceId]`) are stub screens, so the
 * suites do not depend on screens other steps build at the same time (P11).
 *
 * Import `./sessions-test-setup` first, then `@/navigation/testing/router-harness`, then this module.
 */
import { QueryClient } from '@tanstack/react-query';
import { Stack, router, useLocalSearchParams, type Href } from 'expo-router';
import type { ReactNode } from 'react';
import { act } from '@testing-library/react-native';
import { Text } from 'react-native';
import type { Metrics } from 'react-native-safe-area-context';
import { DEMO_OPERATOR_PASSWORD, OPERATORS, selectSessionHistory, type Sim } from '@dems/shared/sim';
import SessionDetailRoute from '@/app/(app)/(tabs)/sessions/[sessionId]';
import SessionsLayout from '@/app/(app)/(tabs)/sessions/_layout';
import SessionsRoute from '@/app/(app)/(tabs)/sessions/index';
import { TEST_INSETS, WINDOWS, renderRoutes, resetShellState, setWindow, type WindowName } from '@/navigation/testing/router-harness';
import { AppProviders } from '@/providers';
import { FakeHeartbeatSocket, createTestSim, flushAsync, type TestSim } from '@/runtime/testing/test-sim';

export const settle = flushAsync;

export interface SessionsHarnessOptions {
  window?: WindowName;
  initialUrl?: string;
  /** Prepares the simulator before the first render (a scenario, a fault, …). */
  prepare?: (test: TestSim) => void;
}

export interface SessionsHarness extends TestSim {
  app: ReturnType<typeof renderRoutes>;
  /** The simulator's session history, newest first. */
  history(): ReturnType<typeof selectSessionHistory>;
  navigate(href: string): void;
}

function sessionsRoot(sim: Sim, window: WindowName) {
  const { width, height } = WINDOWS[window];
  const metrics: Metrics = { frame: { x: 0, y: 0, width, height }, insets: TEST_INSETS };
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  return function SessionsTestRoot() {
    const tree: ReactNode = (
      <AppProviders sim={sim} safeAreaMetrics={metrics} queryClient={queryClient} heartbeatSocketFactory={() => new FakeHeartbeatSocket()}>
        <Stack screenOptions={{ headerShown: false }} />
      </AppProviders>
    );
    return tree;
  };
}

function stub(id: string) {
  return function StubScreen() {
    const params = useLocalSearchParams();
    return <Text testID={`stub-${id}`}>{JSON.stringify(params)}</Text>;
  };
}

export function renderSessionsApp({ window = 'phonePortrait', initialUrl = '/sessions', prepare }: SessionsHarnessOptions = {}): SessionsHarness {
  resetShellState();
  setWindow(window);
  const test = createTestSim();
  const operator = OPERATORS.find((candidate) => candidate.username === 'budi.santoso');
  if (!operator) throw new Error('sessions harness: unknown demo user');
  const signIn = test.sim.actions.signIn(operator.username, DEMO_OPERATOR_PASSWORD);
  if (!signIn.ok) throw new Error('sessions harness: demo sign-in failed');
  prepare?.(test);
  const routes = {
    _layout: sessionsRoot(test.sim, window),
    index: () => <Text testID="screen-index">index</Text>,
    'sessions/_layout': SessionsLayout,
    'sessions/index': SessionsRoute,
    'sessions/[sessionId]': SessionDetailRoute,
    'session/live': stub('session-live'),
    'session/finalizing': stub('session-finalizing'),
    'session/recovery': stub('session-recovery'),
    'session/new': stub('session-new'),
    'session/summary/[sessionId]': stub('session-summary'),
    'evidence/index': stub('evidence'),
    'evidence/[evidenceId]': stub('evidence-detail'),
  };
  const app = renderRoutes(routes, initialUrl);
  return {
    ...test,
    app,
    history: () => selectSessionHistory(test.sim.store.getState()),
    navigate(href: string) {
      act(() => router.push(href as Href));
    },
  };
}
