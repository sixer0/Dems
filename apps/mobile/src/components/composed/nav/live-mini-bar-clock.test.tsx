// E-fix row FX-M2b, defect E2E-P-3 (decision D199/D201): on Home during a recording, the System Status
// timer and the bottom "Recording" bar showed two different times in one frame (00:04:32 vs 00:04:31,
// capture 36b; 00:00:27 vs 00:00:26, frame 99f). Home read the store's clock; the bar sampled
// `Date.now()` on its own 1 s interval. Both now read the store's clock (`selectElapsedSeconds`), so
// they agree in every commit: held here over 9 s of a recording in steps that are not whole seconds,
// with the store's clock deliberately NOT the device's (the test simulator's manual clock).
import { afterEach, beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, cleanup, screen } from '@testing-library/react-native';
import { selectElapsedSeconds } from '@dems/shared/sim';
import { DashboardScreen } from '@/features/dashboard/dashboard-screen';
import { resetLoopRegistryForTests, resetMotionStateForTests } from '@/motion';
import { resetCoreLinkPrefsForTests, useActiveSession } from '@/runtime';
import { createTestSim, flushAsync, renderWithRuntime, type TestSim } from '@/runtime/testing/test-sim';
import { LiveMiniBar } from './live-mini-bar';

jest.mock('@shopify/react-native-skia', () =>
  jest.requireActual<typeof import('@/components/media/testing/skia-mock')>('@/components/media/testing/skia-mock').createSkiaMock(),
);
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn(), navigate: jest.fn() }),
  useIsFocused: () => true,
}));

/** Home with the bar over it, as the phone draws them while recording (the bar is the tabs' chrome). */
function HomeWhileRecording() {
  const session = useActiveSession();
  return (
    <>
      <DashboardScreen />
      {session.state === 'RECORDING' ? <LiveMiniBar session={session} placement="above-bar" /> : null}
    </>
  );
}

/** The time a RollingNumber shows (its accessibility label is the formatted value). */
const shown = (testID: string): string => String(screen.getAllByTestId(testID)[0]!.props.accessibilityLabel);

beforeAll(async () => {
  // Reanimated's UI-side frame-callback registry initialises on real timers (S72-12).
  await new Promise((resolve) => setTimeout(resolve, 50));
});

beforeEach(async () => {
  await AsyncStorage.clear();
  resetCoreLinkPrefsForTests();
  resetMotionStateForTests();
  resetLoopRegistryForTests();
});

afterEach(() => {
  cleanup();
});

describe('E2E-P-3: Home\'s System Status timer and the Recording bar show the same time in every commit', () => {
  it('9 s of a recording in 370 ms steps: the two timers never differ, and both are the store\'s recording time', async () => {
    const test: TestSim = createTestSim({ scenario: 'recording' });
    expect(test.sim.store.getState().session?.state).toBe('RECORDING');
    renderWithRuntime(<HomeWhileRecording />, { sim: test.sim });
    await flushAsync();
    expect(screen.getByTestId('nav-mini-bar')).toBeTruthy();
    expect(screen.getAllByTestId('home-status-timer').length).toBeGreaterThan(0);

    const pairs: [string, string][] = [];
    for (let step = 0; step < 25; step += 1) {
      act(() => test.advance(370, 50));
      await flushAsync();
      const home = shown('home-status-timer');
      const bar = shown('nav-mini-bar-timer');
      pairs.push([home, bar]);
      expect([step, bar]).toEqual([step, home]);
    }
    // The time moved (it is a running recording), and it is the store's, not the device clock's.
    expect(new Set(pairs.map(([home]) => home)).size).toBeGreaterThanOrEqual(9);
    const seconds = selectElapsedSeconds(test.sim.store.getState());
    const pad = (n: number) => String(n).padStart(2, '0');
    expect(shown('nav-mini-bar-timer')).toBe(`${pad(Math.floor(seconds / 3600))}:${pad(Math.floor((seconds % 3600) / 60))}:${pad(seconds % 60)}`);
  });
});
