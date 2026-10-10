// Fix wave I, driver C - re-gate 75 finding G75b-02, the Home half: after the operator leaves the
// Finalizing screen of a BLOCKED seal, Home shows that session as "Sealing blocked" and explains why
// a new session is not available - instead of "Recording Blocked / A critical fault needs action"
// and a plain "View finalization".
//
// The Core's payloads are the contract's own examples (`@dems/shared/sim` `seal-blocked.ts`), never
// retyped (D208). Written RED.
import { afterEach, beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, cleanup, screen } from '@testing-library/react-native';
import type { ReactTestInstance } from 'react-test-renderer';
import {
  DEMO_OPERATOR_PASSWORD,
  SEAL_BLOCKED_EXAMPLE_ALERT,
  SEAL_BLOCKED_EXAMPLE_FINALIZATION,
  SEAL_BLOCKED_EXAMPLE_SESSION_ID,
  SEAL_RECORDING_KEPT_SENTENCE,
  ScenarioName,
  sealBlockedNoticeOf,
} from '@dems/shared/sim';
import { getMissingKeys, resetMissingKeys } from '@/i18n';
import { resetLoopRegistryForTests, resetMotionStateForTests } from '@/motion';
import { resetCoreLinkPrefsForTests } from '@/runtime';
import { createTestSim, flushAsync, renderWithRuntime, type TestSim } from '@/runtime/testing/test-sim';
import { DashboardScreen } from './dashboard-screen';

jest.mock('@shopify/react-native-skia', () =>
  jest.requireActual<typeof import('@/components/media/testing/skia-mock')>('@/components/media/testing/skia-mock').createSkiaMock(),
);
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn(), navigate: jest.fn() }),
  useIsFocused: () => true,
}));

const textOf = (testID: string): string => {
  const parts: string[] = [];
  const walk = (n: ReactTestInstance | string) => {
    if (typeof n === 'string') parts.push(n);
    else n.children.forEach(walk);
  };
  walk(screen.getAllByTestId(testID)[0]!);
  return parts.join('');
};

async function mountFinalizing(): Promise<TestSim> {
  const test = createTestSim();
  expect(test.sim.actions.signIn('budi.santoso', DEMO_OPERATOR_PASSWORD).ok).toBe(true);
  test.sim.actions.loadScenario(ScenarioName.FINALIZING);
  expect(test.sim.store.getState().session?.state).toBe('FINALIZING');
  renderWithRuntime(<DashboardScreen />, { sim: test.sim });
  await flushAsync();
  return test;
}
/** The Core reports the blocked seal of the open session (the contract's example session, steps and alert). */
const block = (test: TestSim) =>
  act(() =>
    test.sim.store.setState((s) => ({
      session: { ...s.session!, id: SEAL_BLOCKED_EXAMPLE_SESSION_ID, state: 'FINALIZING', finalization: SEAL_BLOCKED_EXAMPLE_FINALIZATION },
      alerts: [...s.alerts, SEAL_BLOCKED_EXAMPLE_ALERT],
    })),
  );

beforeAll(async () => {
  // Reanimated's UI-side frame-callback registry initialises on real timers (S72-12).
  await new Promise((resolve) => setTimeout(resolve, 50));
});
beforeEach(async () => {
  await AsyncStorage.clear();
  resetCoreLinkPrefsForTests();
  resetMotionStateForTests({ linkMotion: 'off' });
  resetLoopRegistryForTests();
  resetMissingKeys();
});
afterEach(() => {
  cleanup();
  expect(getMissingKeys()).toEqual([]);
});

describe('G75b-02 on Home: the open session whose seal is blocked', () => {
  it('the status card says "Sealing blocked" with the session and "The recording is kept on the Core." - not "Recording Blocked"', async () => {
    const test = await mountFinalizing();
    block(test);
    await flushAsync();
    expect(sealBlockedNoticeOf(test.sim.store.getState(), SEAL_BLOCKED_EXAMPLE_SESSION_ID)).not.toBeNull();
    expect(textOf('home-status-title')).toBe('Sealing blocked');
    expect(textOf('home-status-subtitle')).toContain(SEAL_BLOCKED_EXAMPLE_SESSION_ID);
    expect(textOf('home-status-subtitle')).toContain(SEAL_RECORDING_KEPT_SENTENCE);
    expect(textOf('home-status-title')).not.toMatch(/Recording Blocked/);
  });

  it('the primary action leads to the blocked session by name, and a line explains why a new session is not available', async () => {
    const test = await mountFinalizing();
    block(test);
    await flushAsync();
    const action = screen.getByTestId('home-action-primary');
    expect(action.props.accessibilityLabel).toBe('Sealing blocked: view');
    expect(action.props.accessibilityState?.disabled).not.toBe(true);
    expect(textOf('home-action-seal-blocked')).toBe(
      `A new session cannot be started: sealing of session ${SEAL_BLOCKED_EXAMPLE_SESSION_ID} is blocked, and the Core records no new session until it is sealed. ${SEAL_RECORDING_KEPT_SENTENCE}`,
    );
  });

  it('CONTROL - a seal that simply runs: "View finalization", no blocked line, and the status card as before', async () => {
    await mountFinalizing();
    expect(screen.getByTestId('home-action-primary').props.accessibilityLabel).toBe('View finalization');
    expect(screen.queryByTestId('home-action-seal-blocked')).toBeNull();
    expect(textOf('home-status-title')).not.toBe('Sealing blocked');
  });

  it('the alert resolved (the seal completed or the session was ended): the blocked words leave', async () => {
    const test = await mountFinalizing();
    block(test);
    await flushAsync();
    act(() => test.sim.store.setState((s) => ({ alerts: s.alerts.map((alert) => (alert.id === SEAL_BLOCKED_EXAMPLE_ALERT.id ? { ...alert, active: false } : alert)) })));
    await flushAsync();
    expect(screen.queryByTestId('home-action-seal-blocked')).toBeNull();
    expect(textOf('home-status-title')).not.toBe('Sealing blocked');
  });
});
