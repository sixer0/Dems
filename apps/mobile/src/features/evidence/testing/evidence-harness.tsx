/**
 * Test-only harness for the Evidence suites (step 83). Never import it from app code.
 *
 * It renders a small Expo Router tree around the REAL evidence route files (`/evidence` and
 * `/evidence/[evidenceId]` with their drill-in stack, so the master-detail hand-over and the
 * selection push run as on a device) inside the real `AppProviders` with an injected, hydrated test
 * simulator (step 73's `createTestSim`: manual clock and scheduler), signed in as a demo operator.
 * Only this feature's routes are real, so the suites do not depend on screens that other steps
 * build at the same time (P11).
 *
 * Import `./evidence-test-setup` first, then `@/navigation/testing/router-harness`, then this module.
 */
import { QueryClient } from '@tanstack/react-query';
import { Stack, router, type Href } from 'expo-router';
import type { ReactNode } from 'react';
import { act } from '@testing-library/react-native';
import { Text } from 'react-native';
import type { Metrics } from 'react-native-safe-area-context';
import { DEMO_OPERATOR_PASSWORD, OPERATORS, type Sim } from '@dems/shared/sim';
import EvidenceDetailRoute from '@/app/(app)/(tabs)/evidence/[evidenceId]';
import EvidenceLayout from '@/app/(app)/(tabs)/evidence/_layout';
import EvidenceListRoute from '@/app/(app)/(tabs)/evidence/index';
import { TEST_INSETS, WINDOWS, renderRoutes, resetShellState, setWindow, type WindowName } from '@/navigation/testing/router-harness';
import { AppProviders } from '@/providers';
import { FakeHeartbeatSocket, createTestSim, flushAsync, type TestSim } from '@/runtime/testing/test-sim';
import { resetDetailIntentForTests } from '../detail-intent';

export const settle = flushAsync;

/** `budi.santoso` is an INVESTIGATOR (no export), `andi.pratama` a SUPERVISOR (export, archive). */
export type DemoUsername = 'budi.santoso' | 'andi.pratama' | 'rina.wijaya';

export interface EvidenceHarnessOptions {
  window?: WindowName;
  user?: DemoUsername;
  initialUrl?: string;
}

export interface EvidenceHarness extends TestSim {
  app: ReturnType<typeof renderRoutes>;
  /** The evidence ID with a given number suffix (`'0005'` → `EV-…-0005`). */
  idOf(suffix: string): string;
  navigate(href: string): void;
}

function evidenceRoot(sim: Sim, window: WindowName) {
  const { width, height } = WINDOWS[window];
  const metrics: Metrics = { frame: { x: 0, y: 0, width, height }, insets: TEST_INSETS };
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  return function EvidenceTestRoot() {
    const tree: ReactNode = (
      <AppProviders sim={sim} safeAreaMetrics={metrics} queryClient={queryClient} heartbeatSocketFactory={() => new FakeHeartbeatSocket()}>
        <Stack screenOptions={{ headerShown: false }} />
      </AppProviders>
    );
    return tree;
  };
}

export function renderEvidenceApp({ window = 'phonePortrait', user = 'andi.pratama', initialUrl = '/evidence' }: EvidenceHarnessOptions = {}): EvidenceHarness {
  resetShellState();
  resetDetailIntentForTests();
  setWindow(window);
  const test = createTestSim();
  const operator = OPERATORS.find((candidate) => candidate.username === user);
  if (!operator) throw new Error(`evidence harness: unknown demo user ${user}`);
  const signIn = test.sim.actions.signIn(operator.username, DEMO_OPERATOR_PASSWORD);
  if (!signIn.ok) throw new Error('evidence harness: demo sign-in failed');
  const routes = {
    _layout: evidenceRoot(test.sim, window),
    index: () => <Text testID="screen-index">index</Text>,
    'evidence/_layout': EvidenceLayout,
    'evidence/index': EvidenceListRoute,
    'evidence/[evidenceId]': EvidenceDetailRoute,
  };
  const app = renderRoutes(routes, initialUrl);
  const idOf = (suffix: string) => {
    const item = test.sim.store.getState().evidence.find((entry) => entry.id.endsWith(`-${suffix}`));
    if (!item) throw new Error(`evidence harness: no evidence ${suffix}`);
    return item.id;
  };
  return {
    ...test,
    app,
    idOf,
    navigate(href: string) {
      act(() => router.push(href as Href));
    },
  };
}
