/**
 * Test-only harness for the Devices & Inputs suites (step 84). Never import it from app code.
 *
 * It renders a small Expo Router tree around the REAL devices route files (`/devices` and
 * `/devices/[deviceId]` with their drill-in stack, so the master-detail hand-over and the selection
 * push run as on a device) inside the real `AppProviders` with an injected, hydrated test simulator
 * (step 73's `createTestSim`: manual clock and scheduler), signed in as a demo operator. Only this
 * feature's routes are real, so the suites do not depend on screens other steps build (P11).
 *
 * Import `./devices-test-setup` first, then `@/navigation/testing/router-harness`, then this module.
 */
import { QueryClient } from '@tanstack/react-query';
import { Stack, router, type Href } from 'expo-router';
import type { ReactNode } from 'react';
import { act } from '@testing-library/react-native';
import { Text } from 'react-native';
import type { Metrics } from 'react-native-safe-area-context';
import { DEMO_OPERATOR_PASSWORD, OPERATORS, ScenarioName, type Sim } from '@dems/shared/sim';
import DeviceDetailRoute from '@/app/(app)/(tabs)/devices/[deviceId]';
import DevicesLayout from '@/app/(app)/(tabs)/devices/_layout';
import DevicesRoute from '@/app/(app)/(tabs)/devices/index';
import { TEST_INSETS, WINDOWS, renderRoutes, resetShellState, setWindow, type WindowName } from '@/navigation/testing/router-harness';
import { AppProviders } from '@/providers';
import { FakeHeartbeatSocket, createTestSim, flushAsync, type TestSim } from '@/runtime/testing/test-sim';

export const settle = flushAsync;

/** `budi.santoso` INVESTIGATOR, `andi.pratama` SUPERVISOR, `rina.wijaya` TECHNICIAN (DEVICE_MANAGE). */
export type DemoUsername = 'budi.santoso' | 'andi.pratama' | 'rina.wijaya';

export interface DevicesHarnessOptions {
  window?: WindowName;
  user?: DemoUsername;
  initialUrl?: string;
  /** Load the recording scenario (session 0024) before rendering. */
  recording?: boolean;
}

export interface DevicesHarness extends TestSim {
  app: ReturnType<typeof renderRoutes>;
  navigate(href: string): void;
  /** Advances the simulator clock inside `act` (engine-sized steps). */
  run(ms: number): void;
}

function devicesRoot(sim: Sim, window: WindowName) {
  const { width, height } = WINDOWS[window];
  const metrics: Metrics = { frame: { x: 0, y: 0, width, height }, insets: TEST_INSETS };
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  return function DevicesTestRoot() {
    const tree: ReactNode = (
      <AppProviders sim={sim} safeAreaMetrics={metrics} queryClient={queryClient} heartbeatSocketFactory={() => new FakeHeartbeatSocket()}>
        <Stack screenOptions={{ headerShown: false }} />
      </AppProviders>
    );
    return tree;
  };
}

export function renderDevicesApp({ window = 'phonePortrait', user = 'budi.santoso', initialUrl = '/devices', recording = false }: DevicesHarnessOptions = {}): DevicesHarness {
  resetShellState();
  setWindow(window);
  const test = createTestSim();
  const operator = OPERATORS.find((candidate) => candidate.username === user);
  if (!operator) throw new Error(`devices harness: unknown demo user ${user}`);
  const signIn = test.sim.actions.signIn(operator.username, DEMO_OPERATOR_PASSWORD);
  if (!signIn.ok) throw new Error('devices harness: demo sign-in failed');
  if (recording) test.sim.actions.loadScenario(ScenarioName.RECORDING);
  const routes = {
    _layout: devicesRoot(test.sim, window),
    index: () => <Text testID="screen-index">index</Text>,
    'devices/_layout': DevicesLayout,
    'devices/index': DevicesRoute,
    'devices/[deviceId]': DeviceDetailRoute,
  };
  const app = renderRoutes(routes, initialUrl);
  return {
    ...test,
    app,
    navigate(href: string) {
      act(() => router.push(href as Href));
    },
    run(ms: number) {
      act(() => test.advance(ms));
    },
  };
}
