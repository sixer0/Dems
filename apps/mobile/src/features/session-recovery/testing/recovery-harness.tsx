/**
 * Test-only harness for the Recovery Status suites (step 81). Never import it from app code.
 *
 * It renders a small Expo Router tree around the REAL `/session/recovery` route file inside the real
 * `AppProviders`, with an injected, hydrated test simulator (step 73's `createTestSim`: manual clock
 * and scheduler) signed in as a demo operator. With `routeSync` (default) the runtime's real
 * `SessionRouteSync` is mounted too, as `(app)/_layout.tsx` mounts it on a device, so "any → FAULT
 * opens the recovery screen" is the production path. Home, Live and the Evidence detail are one-line
 * stand-ins, so these suites do not depend on screens other steps build at the same time (P11).
 *
 * Import `./recovery-test-setup` FIRST in a test file (the gorhom mock), then
 * `@/navigation/testing/router-harness`, then this module.
 */
import { QueryClient } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { act } from '@testing-library/react-native';
import { Text } from 'react-native';
import type { Metrics } from 'react-native-safe-area-context';
import { DEMO_OPERATOR_PASSWORD, OPERATORS, ScenarioName, type Sim } from '@dems/shared/sim';
import SessionRecoveryRoute from '@/app/(app)/session/recovery';
import { TEST_INSETS, WINDOWS, renderRoutes, resetShellState, setWindow, type WindowName } from '@/navigation/testing/router-harness';
import { AppProviders } from '@/providers';
import { SessionRouteSync } from '@/runtime';
import { FakeHeartbeatSocket, createTestSim, flushAsync, type TestSim } from '@/runtime/testing/test-sim';

/** Lets the providers' one async start-up update (the Core-link preference read) settle. */
export const settle = flushAsync;

export type RecoveryScenario =
  /** fault-demo (Camera 2 lost, MIC 2 clipping, GNSS → NTP) + POWER_FAIL: FAULT from RECORDING. */
  | 'fault'
  /** A session in PRECHECK + POWER_FAIL: FAULT before recording started (no media). */
  | 'precheckFault'
  /** fault-demo alone: still RECORDING (its faults are not critical). */
  | 'recording'
  /** No session. */
  | 'idle';

export interface RecoveryHarnessOptions {
  window?: WindowName;
  scenario?: RecoveryScenario;
  /** Index into the demo OPERATORS: 0 Investigator (default), 1 Supervisor, 2 Technician. */
  operator?: number;
  /** Mount the runtime's `SessionRouteSync` (default true). */
  routeSync?: boolean;
  /** Default `/session/recovery`. */
  initialUrl?: string;
}

export interface RecoveryHarness extends TestSim {
  app: ReturnType<typeof renderRoutes>;
  /** The scenario session's ID (null for `idle`). */
  sessionId: string | null;
  /** Advances the simulator clock inside `act` (engine-sized steps). */
  run(ms: number): void;
}

function recoveryRoot(sim: Sim, window: WindowName, routeSync: boolean) {
  const { width, height } = WINDOWS[window];
  const metrics: Metrics = { frame: { x: 0, y: 0, width, height }, insets: TEST_INSETS };
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  return function RecoveryTestRoot() {
    return (
      <AppProviders sim={sim} safeAreaMetrics={metrics} queryClient={queryClient} heartbeatSocketFactory={() => new FakeHeartbeatSocket()}>
        {routeSync ? <SessionRouteSync /> : null}
        <Stack screenOptions={{ headerShown: false }} />
      </AppProviders>
    );
  };
}

/** Puts the test simulator into a scenario (real transitions only). */
export function applyScenario(test: TestSim, scenario: RecoveryScenario): void {
  const { actions } = test.sim;
  if (scenario === 'idle') return;
  if (scenario === 'precheckFault') {
    const created = actions.createSession({
      caseNumber: 'LP/2026/1001-0099',
      subjectName: 'Rudi Hartono',
      subjectType: 'SAKSI',
      investigatorId: OPERATORS[0]!.id,
      room: 'Interview Room 1',
      profileId: 'STANDARD_1080P25',
    });
    if (!created.ok) throw new Error(`recovery harness: createSession failed (${created.reason})`);
    actions.beginPrecheck();
    actions.inject('POWER_FAIL');
    return;
  }
  actions.loadScenario(ScenarioName.FAULT_DEMO);
  if (scenario === 'fault') actions.inject('POWER_FAIL');
}

/** Advances until the active session has left the store (or `limitMs` passes). */
export function advanceUntilIdle(test: TestSim, limitMs = 6_000): void {
  let left = limitMs;
  while (left > 0 && test.sim.store.getState().session !== null) {
    test.advance(100);
    left -= 100;
  }
}

export function renderRecoveryApp({
  window = 'phonePortrait',
  scenario = 'fault',
  operator = 0,
  routeSync = true,
  initialUrl = '/session/recovery',
}: RecoveryHarnessOptions = {}): RecoveryHarness {
  resetShellState();
  setWindow(window);
  const test = createTestSim();
  const who = OPERATORS[operator]!;
  const signIn = test.sim.actions.signIn(who.username, DEMO_OPERATOR_PASSWORD);
  if (!signIn.ok) throw new Error('recovery harness: demo sign-in failed');
  applyScenario(test, scenario);
  const sessionId = test.sim.store.getState().session?.id ?? null;

  const routes = {
    _layout: recoveryRoot(test.sim, window, routeSync),
    index: () => <Text testID="screen-index">index</Text>,
    home: () => <Text testID="screen-home">home</Text>,
    'session/live': () => <Text testID="screen-session-live">live</Text>,
    'session/new': () => <Text testID="screen-session-new">new</Text>,
    'session/finalizing': () => <Text testID="screen-session-finalizing">finalizing</Text>,
    'session/recovery': SessionRecoveryRoute,
    'evidence/[evidenceId]': () => <Text testID="screen-evidence-detail">evidence</Text>,
  };
  const app = renderRoutes(routes, initialUrl);
  return {
    ...test,
    app,
    sessionId,
    run(ms: number) {
      act(() => test.advance(ms));
    },
  };
}
