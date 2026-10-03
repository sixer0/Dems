/**
 * Test-only harness for the Audit suites (step 87; step 83's evidence harness pattern). Never import
 * it from app code.
 *
 * It renders a small Expo Router tree around the REAL `/audit` route file inside the real
 * `AppProviders`, with an injected, hydrated test simulator (step 73's `createTestSim`: manual clock
 * and scheduler) signed in as a demo operator. Only this feature's route is real, so the suite does
 * not depend on screens other steps build at the same time (P11).
 *
 * Import `./audit-test-setup` first, then `@/navigation/testing/router-harness`, then this module.
 */
import { QueryClient } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import type { ReactNode } from 'react';
import { act } from '@testing-library/react-native';
import { Text } from 'react-native';
import type { Metrics } from 'react-native-safe-area-context';
import { DEMO_OPERATOR_PASSWORD, OPERATORS, type Sim, type SessionCreateInput } from '@dems/shared/sim';
import AuditRoute from '@/app/(app)/(tabs)/audit';
import { TEST_INSETS, WINDOWS, renderRoutes, resetShellState, setWindow, type WindowName } from '@/navigation/testing/router-harness';
import { AppProviders } from '@/providers';
import { FakeHeartbeatSocket, createTestSim, flushAsync, type TestSim } from '@/runtime/testing/test-sim';
import { resetPlayedEntrancesForTests } from '../audit-row';

export const settle = flushAsync;

export type DemoUsername = 'budi.santoso' | 'andi.pratama' | 'rina.wijaya';

export interface AuditHarnessOptions {
  window?: WindowName;
  user?: DemoUsername;
  /** Sign in with the simulator's biometric action (AUTH_SUCCESS, method BIOMETRIC) instead of the password. */
  biometric?: boolean;
  /** Runs against the simulator before the screen renders (rows written before mount do not enter live). */
  before?: (test: TestSim) => void;
}

export interface AuditHarness extends TestSim {
  app: ReturnType<typeof renderRoutes>;
  /** Advances the simulator clock inside `act` (timed transitions, live rows). */
  run(ms: number): void;
}

function auditRoot(sim: Sim, window: WindowName) {
  const { width, height } = WINDOWS[window];
  const metrics: Metrics = { frame: { x: 0, y: 0, width, height }, insets: TEST_INSETS };
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  return function AuditTestRoot() {
    const tree: ReactNode = (
      <AppProviders sim={sim} safeAreaMetrics={metrics} queryClient={queryClient} heartbeatSocketFactory={() => new FakeHeartbeatSocket()}>
        <Stack screenOptions={{ headerShown: false }} />
      </AppProviders>
    );
    return tree;
  };
}

/** A session input for MA-29's flow (the simulator's own test input shape). */
export const SESSION_INPUT: SessionCreateInput = {
  caseNumber: 'LP/2026/1001-0087',
  subjectType: 'SAKSI',
  subjectName: 'Audit Test Saksi',
  investigatorId: 'OPR-001',
  room: 'Interview Room 1',
  profileId: 'STANDARD_1080P25',
};

/** Steps the simulator clock in engine-sized steps (no React involved). */
export function runSim(test: TestSim, ms: number): void {
  test.advance(ms, 100);
}

/**
 * MA-29's session flow on the simulator: create → precheck (8 checks) → record 3 s → end with a
 * reason → finalize → SEALED. Writes SESSION_CREATED, PRECHECK_PASSED, RECORDING_STARTED,
 * RECORDING_STOPPED and EVIDENCE_SEALED.
 */
export function runSessionFlow(test: TestSim): void {
  const { actions } = test.sim;
  const created = actions.createSession(SESSION_INPUT);
  if (!created.ok) throw new Error(`audit harness: createSession failed (${created.reason})`);
  actions.beginPrecheck();
  runSim(test, 5_000);
  if (test.sim.store.getState().session?.state === 'PRECHECK') actions.acknowledgePrecheckWarnings();
  actions.startRecording();
  runSim(test, 3_000);
  actions.stopRecording('Interview complete');
  runSim(test, 10_000);
}

export function renderAuditApp({ window = 'phonePortrait', user = 'budi.santoso', biometric = false, before }: AuditHarnessOptions = {}): AuditHarness {
  resetShellState();
  resetPlayedEntrancesForTests();
  setWindow(window);
  const test = createTestSim();
  const operator = OPERATORS.find((candidate) => candidate.username === user);
  if (!operator) throw new Error(`audit harness: unknown demo user ${user}`);
  const signIn = biometric
    ? test.sim.actions.signInWithBiometric(operator.id)
    : test.sim.actions.signIn(operator.username, DEMO_OPERATOR_PASSWORD);
  if (!signIn.ok) throw new Error('audit harness: demo sign-in failed');
  before?.(test);
  const routes = {
    _layout: auditRoot(test.sim, window),
    index: () => <Text testID="screen-index">index</Text>,
    audit: AuditRoute,
  };
  const app = renderRoutes(routes, '/audit');
  return {
    ...test,
    app,
    run(ms: number) {
      act(() => runSim(test, ms));
    },
  };
}
