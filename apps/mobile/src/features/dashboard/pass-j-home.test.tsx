// Closing pass J of fix wave I (decisions D216, D217 (5), (7)) - the mobile Home.
//
// | Item | Rule | Member read BY NAME |
// |---|---|---|
// | 1 G75b-06 at the source | the Security chip reads "Not reported" where the Core says it computes no posture | `security.platformNotReported` (`SECURITY_PLATFORM_NOT_REPORTED_EXAMPLE`) |
// | 2 G75b-03 | the restart fault of a Core in its own capture reads "Core was not running", never "Power failure" | `coreNotRunning` (`CORE_NOT_RUNNING_FAULT_EXAMPLE`) |
// | 4 | a blocked seal is the CRITICAL state by the Core's alert, with no fault flag | `sealBlockedNoticeOf` (`SEAL_BLOCKED_EXAMPLE_ALERT`) |
// | 3 | the phone History badge counts the timeline rows that are drawn | `session.captureDurable` |
import { afterEach, beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, cleanup, screen } from '@testing-library/react-native';
import type { ReactTestInstance } from 'react-test-renderer';
import { CORE_NOT_RUNNING_FAULT_EXAMPLE, SECURITY_PLATFORM_NOT_REPORTED_EXAMPLE } from '@dems/shared/api';
import {
  CORE_NOT_RUNNING_LABEL,
  DEMO_OPERATOR_PASSWORD,
  SEAL_BLOCKED_EXAMPLE_ALERT,
  SEAL_BLOCKED_EXAMPLE_FINALIZATION,
  SEAL_BLOCKED_EXAMPLE_SESSION_ID,
  ScenarioName,
  coreNotRunningFaultTransition,
  injectFaultTransition,
} from '@dems/shared/sim';
import { getMissingKeys, resetMissingKeys } from '@/i18n';
import { resetLoopRegistryForTests, resetMotionStateForTests } from '@/motion';
import { resetCoreLinkPrefsForTests } from '@/runtime';
import { createTestSim, flushAsync, renderWithRuntime, type TestSim } from '@/runtime/testing/test-sim';
import { timelineOfCaptureFacts } from '@/features/session-live/session-live.math';
import { DashboardScreen } from './dashboard-screen';
import { chipRowFor } from './home-model';

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

async function mount(scenario: ScenarioName): Promise<TestSim> {
  const test = createTestSim();
  expect(test.sim.actions.signIn('budi.santoso', DEMO_OPERATOR_PASSWORD).ok).toBe(true);
  test.sim.actions.loadScenario(scenario);
  renderWithRuntime(<DashboardScreen />, { sim: test.sim });
  await flushAsync();
  return test;
}

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

describe('1. the Security chip follows security.platformNotReported', () => {
  const base = { timeSource: 'GNSS', timeLocked: true, linkUp: true };
  const security = (input: Parameters<typeof chipRowFor>[0]) => chipRowFor(input).find((chip) => chip.id === 'security');

  it('the member with a posture that would read "Secure": "Not reported", neutral', () => {
    expect(SECURITY_PLATFORM_NOT_REPORTED_EXAMPLE).toEqual({ platformNotReported: true });
    expect(security({ ...base, posture: 'SECURE', ...SECURITY_PLATFORM_NOT_REPORTED_EXAMPLE })).toMatchObject({ valueKey: 'common.platformNotReported.value', tone: 'default' });
  });

  it('CONTROL - without the member (the simulated device, and a host clock alone): "Secure"; a posture that names a fault keeps it', () => {
    expect(security({ ...base, posture: 'SECURE' })).toMatchObject({ valueKey: 'common.posture.SECURE', tone: 'success' });
    expect(security({ ...base, posture: 'SECURE', hostClock: true })).toMatchObject({ valueKey: 'common.posture.SECURE', tone: 'success' });
    expect(security({ ...base, posture: 'CRITICAL', platformNotReported: true })).toMatchObject({ valueKey: 'common.posture.CRITICAL', tone: 'danger' });
  });
});

describe('2. the restart fault of a Core in its own capture on Home', () => {
  it('the flag line reads "Core was not running" - never "Power failure"', async () => {
    const test = await mount(ScenarioName.RECORDING);
    act(() => test.sim.store.setState((s) => coreNotRunningFaultTransition(s, s.clock.now)));
    await flushAsync();
    expect(test.sim.store.getState().session?.fault).toMatchObject({ kind: 'POWER_FAIL', ...CORE_NOT_RUNNING_FAULT_EXAMPLE });
    const flags = textOf('home-status-flags');
    expect(flags).toContain(CORE_NOT_RUNNING_LABEL);
    expect(flags).not.toMatch(/power\s*fail/i);
  });

  it('CONTROL - the simulator\'s own power failure still reads "Power failure"', async () => {
    const test = await mount(ScenarioName.RECORDING);
    act(() => test.sim.store.setState((s) => injectFaultTransition(s, s.clock.now, 'POWER_FAIL')));
    await flushAsync();
    const flags = textOf('home-status-flags');
    expect(flags).toContain('Power failure');
    expect(flags).not.toContain(CORE_NOT_RUNNING_LABEL);
  });
});

describe('4. a blocked seal is the critical state of Home through the alert', () => {
  const block = (test: TestSim, active: boolean) =>
    act(() =>
      test.sim.store.setState((s) => ({
        session: { ...s.session!, id: SEAL_BLOCKED_EXAMPLE_SESSION_ID, state: 'FINALIZING', finalization: SEAL_BLOCKED_EXAMPLE_FINALIZATION },
        alerts: [{ ...SEAL_BLOCKED_EXAMPLE_ALERT, active }],
        faults: { active: [] },
        tabletLink: { ...s.tabletLink, state: 'CONNECTED' },
      })),
    );
  const ringState = () => screen.getAllByTestId('home-status-ring')[0]!.props.accessibilityLabel as string;

  it('the ring reads Critical with NO fault active', async () => {
    const test = await mount(ScenarioName.FINALIZING);
    block(test, true);
    await flushAsync();
    expect(test.sim.store.getState().faults.active).toEqual([]);
    expect(ringState()).toMatch(/critical/i);
    expect(textOf('home-status-title')).toBe('Sealing blocked');
  });

  it('NEGATIVE CONTROL - the same session with the alert resolved: not critical', async () => {
    const test = await mount(ScenarioName.FINALIZING);
    block(test, false);
    await flushAsync();
    expect(ringState()).not.toMatch(/critical/i);
    expect(textOf('home-status-title')).not.toBe('Sealing blocked');
  });
});

describe('3. the History badge counts the rows the timeline draws', () => {
  const rows = [{ kind: 'START' }, { kind: 'NOTE' }, { kind: 'MARKER' }];

  it('while the cameras connect the held-back START row is not counted; from the first durable fragment it is', () => {
    expect(timelineOfCaptureFacts(rows, true, true).length).toBe(2);
    expect(timelineOfCaptureFacts(rows, true, false).length).toBe(3);
    // CONTROL: the simulator's own recording counts every row.
    expect(timelineOfCaptureFacts(rows, false, false).length).toBe(3);
  });
});
