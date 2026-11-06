// Post-review fix FXR-M, finding W93-1 (code review W93, decision D243): the bottom Recording bar still read
// the STORE's clock alone and drew it with the rolling-number columns that lose digits after a JS stall.
//
// - RF-PH-1 (CF2-A, D236): in LIVE the store's clock held one value for 5-21 s under load while the Core
//   recorded. CF2-A made the monitor read the Core clock as well (a 250 ms plain ticker); the bar kept the
//   store clock. Modelled here as in `features/session-live/live-monitor-timer-core-clock.test.tsx`, one
//   level down: the store's clock does NOT move while the runtime's Core clock (registered for the test
//   simulator, as `createMobileLive` registers it for the Live source) runs 6 s on.
// - D214: under the worst case of the device's dropped Reanimated updates (every `useAnimatedStyle` keeps its
//   first style) the bar must still draw the current time: its columns are positioned by React (W93-3).
// - E2E-P-3 (D201): Home's System Status timer and the bar draw the same second in every commit, now also
//   while the Core clock is ahead of the store (they share one ticker).
import { afterEach, beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, cleanup, screen } from '@testing-library/react-native';
import { StyleSheet, type ViewStyle } from 'react-native';
import type { ReactTestInstance } from 'react-test-renderer';
import { typography } from '@dems/shared/tokens';
import { DashboardScreen } from '@/features/dashboard/dashboard-screen';
import { resetLoopRegistryForTests, resetMotionStateForTests } from '@/motion';
import { registerCoreClock, resetCoreLinkPrefsForTests, useActiveSession, type CoreClock } from '@/runtime';
import { createTestSim, flushAsync, renderWithRuntime, type TestSim } from '@/runtime/testing/test-sim';
import { LiveMiniBar } from './live-mini-bar';

jest.mock('@shopify/react-native-skia', () =>
  jest.requireActual<typeof import('@/components/media/testing/skia-mock')>('@/components/media/testing/skia-mock').createSkiaMock(),
);
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn(), navigate: jest.fn() }),
  useIsFocused: () => true,
}));
// The model of the device defect: no UI-thread update of an animated style ever lands.
jest.mock('react-native-reanimated', () => {
  const actual = jest.requireActual<Record<string, unknown>>('react-native-reanimated');
  const React = jest.requireActual<typeof import('react')>('react');
  return {
    __esModule: true,
    ...actual,
    useAnimatedStyle: (updater: () => Record<string, unknown>) => {
      const first = React.useRef<Record<string, unknown> | null>(null);
      if (first.current === null) first.current = updater();
      return first.current;
    },
  };
});

function HomeWhileRecording() {
  const session = useActiveSession();
  return (
    <>
      <DashboardScreen />
      {session.state === 'RECORDING' ? <LiveMiniBar session={session} placement="above-bar" /> : null}
    </>
  );
}

/** A Core clock the test drives: `now()` is the store's start plus `elapsedMs`; plain timers run by `advance`. */
function manualCoreClock(startedAt: number) {
  let local = 0;
  let tasks: { at: number; run: () => void; id: number }[] = [];
  let id = 0;
  const clock: CoreClock = {
    now: () => startedAt + local,
    sample: () => undefined,
    timers: {
      setTimeout: (run, ms) => {
        id += 1;
        tasks.push({ at: local + ms, run, id });
        return id;
      },
      clearTimeout: (handle) => {
        tasks = tasks.filter((t) => t.id !== handle);
      },
    },
  };
  const advance = (ms: number): void => {
    const end = local + ms;
    for (;;) {
      const due = tasks.filter((t) => t.at <= end).sort((a, b) => a.at - b.at)[0];
      if (!due) break;
      tasks = tasks.filter((t) => t !== due);
      local = Math.max(local, due.at);
      due.run();
    }
    local = end;
  };
  return { clock, advance, setLocal: (ms: number) => (local = ms) };
}

const label = (testID: string): string => String(screen.getAllByTestId(testID)[0]!.props.accessibilityLabel);
const secondsOf = (hms: string): number => hms.split(':').map(Number).reduce((sum, part) => sum * 60 + part, 0);

const HIDDEN = { includeHiddenElements: true } as const;
const flat = (node: ReactTestInstance): ViewStyle => (StyleSheet.flatten(node.props?.style) ?? {}) as ViewStyle;
const isHost = (node: ReactTestInstance | null): boolean => !!node && typeof (node.type as unknown) === 'string';

/** HH:MM:SS as the bar's digit columns draw it (React props only: the transforms between clip and cells). */
function drawnBar(): string {
  const lineHeight = typography.data.lineHeight;
  const digit = (fromEnd: number): string => {
    let node: ReactTestInstance | null = screen.getAllByTestId(`nav-mini-bar-timer-d${fromEnd}`, HIDDEN).filter(isHost)[0]!;
    let offset = 0;
    while (node && !(isHost(node) && flat(node).overflow === 'hidden')) {
      if (isHost(node)) {
        const transform = (Array.isArray(flat(node).transform) ? flat(node).transform : []) as unknown as readonly Record<string, unknown>[];
        offset += transform.reduce((sum, t) => sum + (typeof t.translateY === 'number' ? t.translateY : 0), 0);
      }
      node = node.parent;
    }
    const cell = Math.round(-offset / lineHeight);
    return String(((cell % 10) + 10) % 10);
  };
  return `${digit(8)}${digit(7)}:${digit(5)}${digit(4)}:${digit(2)}${digit(1)}`;
}

beforeAll(async () => {
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

describe('W93-1: the bottom Recording bar follows the Core clock (LIVE) and draws with React-held digits', () => {
  it('the store clock holds while the Core clock runs 6 s on: the bar follows the Core (it held before) and Home agrees', async () => {
    const test: TestSim = createTestSim({ scenario: 'recording' });
    const startedAt = test.sim.store.getState().session!.startedAt!;
    const storeElapsed = Math.floor((test.sim.store.getState().clock.now - startedAt) / 1000);
    const core = manualCoreClock(startedAt);
    core.setLocal(storeElapsed * 1000 + 100);
    registerCoreClock(test.sim, core.clock);
    renderWithRuntime(<HomeWhileRecording />, { sim: test.sim });
    await flushAsync();
    act(() => core.advance(0));
    const before = secondsOf(label('nav-mini-bar-timer'));
    expect(before).toBe(storeElapsed);

    const seen: [string, string][] = [];
    for (let step = 0; step < 24; step += 1) {
      act(() => core.advance(250)); // the store's clock is never advanced: it "holds"
      await flushAsync();
      const bar = label('nav-mini-bar-timer');
      seen.push([label('home-status-timer'), bar]);
      expect([step, bar]).toEqual([step, label('home-status-timer')]);
    }
    expect(secondsOf(label('nav-mini-bar-timer')) - before).toBe(6);
    // Never backwards.
    for (let i = 1; i < seen.length; i += 1) expect(secondsOf(seen[i]![1])).toBeGreaterThanOrEqual(secondsOf(seen[i - 1]![1]));
    // And what the columns draw is that time, though no animated style ever updated.
    expect(drawnBar()).toBe(label('nav-mini-bar-timer'));
  });

  it('SIMULATED (no Core clock): 25 s of the store clock, the drawn columns read the current time (not a digit of the mount)', async () => {
    const test: TestSim = createTestSim({ scenario: 'recording' });
    renderWithRuntime(<HomeWhileRecording />, { sim: test.sim });
    await flushAsync();
    const mounted = label('nav-mini-bar-timer');
    for (let i = 0; i < 25; i += 1) {
      act(() => test.advance(1_000, 100));
      await flushAsync();
    }
    const now = label('nav-mini-bar-timer');
    expect(secondsOf(now) - secondsOf(mounted)).toBe(25);
    expect(drawnBar()).toBe(now);
  });
});
