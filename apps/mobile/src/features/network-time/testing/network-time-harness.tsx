/**
 * Test-only harness for the Network & Time suite (step 86). Never import it from app code.
 *
 * It renders a small Expo Router tree around the REAL `/network-time` route file inside the real
 * `AppProviders` with an injected, hydrated test simulator (step 73's `createTestSim`: manual clock
 * and scheduler), signed in as a demo operator. Only this feature's route is real, so the suite
 * does not depend on screens other steps build at the same time (P11).
 *
 * Import `./network-time-test-setup` first, then `@/navigation/testing/router-harness`, then this.
 */
import { QueryClient } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import type { ReactNode } from 'react';
import { Text } from 'react-native';
import type { Metrics } from 'react-native-safe-area-context';
import { DEMO_OPERATOR_PASSWORD, OPERATORS, type Sim } from '@dems/shared/sim';
import NetworkTimeRoute from '@/app/(app)/(tabs)/network-time';
import { TEST_INSETS, WINDOWS, renderRoutes, resetShellState, setWindow, type WindowName } from '@/navigation/testing/router-harness';
import { AppProviders } from '@/providers';
import { FakeHeartbeatSocket, createTestSim, flushAsync, type TestSim } from '@/runtime/testing/test-sim';

export const settle = flushAsync;

export interface NetworkTimeHarness extends TestSim {
  app: ReturnType<typeof renderRoutes>;
}

function testRoot(sim: Sim, window: WindowName) {
  const { width, height } = WINDOWS[window];
  const metrics: Metrics = { frame: { x: 0, y: 0, width, height }, insets: TEST_INSETS };
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  return function NetworkTimeTestRoot() {
    const tree: ReactNode = (
      <AppProviders sim={sim} safeAreaMetrics={metrics} queryClient={queryClient} heartbeatSocketFactory={() => new FakeHeartbeatSocket()}>
        <Stack screenOptions={{ headerShown: false }} />
      </AppProviders>
    );
    return tree;
  };
}

export function renderNetworkTimeApp({ window = 'phonePortrait' }: { window?: WindowName } = {}): NetworkTimeHarness {
  resetShellState();
  setWindow(window);
  const test = createTestSim();
  const operator = OPERATORS.find((candidate) => candidate.username === 'budi.santoso');
  if (!operator) throw new Error('network-time harness: demo operator missing');
  const signIn = test.sim.actions.signIn(operator.username, DEMO_OPERATOR_PASSWORD);
  if (!signIn.ok) throw new Error('network-time harness: demo sign-in failed');
  const app = renderRoutes(
    {
      _layout: testRoot(test.sim, window),
      index: () => <Text testID="screen-index">index</Text>,
      'network-time': NetworkTimeRoute,
    },
    '/network-time',
  );
  return { ...test, app };
}
