// Closing-fix row CF2-A, defect RF-PH-4 (final phone re-test, decision D234).
//
// After an idle sign-out (15 min) under load the phone showed Login as the emblem ring alone on black for
// at least 3 min, until a relaunch: no backdrop, wordmark, caption, card or Core line. Those are exactly
// the parts whose opacity lives only in a Reanimated shared value; the React value they mount with is 0.
// Reanimated drops updates of views it cannot find yet (`Unable to find SurfaceMountingManager for tag`)
// and the settled values a stalled JS thread did not take back within 2 s (D214), so on the device the
// fades never landed and nothing re-rendered Login.
//
// Jest runs no UI thread, so this file models the WORST case of that loss, as the CF-M1 timer test does:
// every `useAnimatedStyle` keeps the style of its first render forever. Whatever Login draws under that
// model is what a device draws once Reanimated has dropped its values.
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { appContext, renderRoutes, resetShellState, setWindow, WINDOWS } from '@/navigation/testing/router-harness';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { QueryClient } from '@tanstack/react-query';
import { act, renderHook, screen } from '@testing-library/react-native';
import { StyleSheet, type ViewStyle } from 'react-native';
import type { Metrics } from 'react-native-safe-area-context';
import type { ReactTestInstance } from 'react-test-renderer';
import type { Sim } from '@dems/shared/sim';
import { resetMotionStateForTests, type MotionSettings } from '@/motion';
import { setSignedInSnapshot } from '@/navigation/pending-href';
import { RootNavigator } from '@/navigation/root-navigator';
import { AppProviders } from '@/providers';
import { resetCoreLinkPrefsForTests } from '@/runtime';
import { FakeHeartbeatSocket, createTestSim, flushAsync } from '@/runtime/testing/test-sim';
import { resetAuthPrefsForTests } from '@/auth';
import { SHAKE_ACT_MS, entranceEndMs, useLoginChoreography, type LoginEntrance } from './use-login-choreography';

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
jest.mock('@/features/home/pulse-ring', () => ({ PulseRing: () => null }));

const opacityOf = (style: unknown): number => {
  const flat = (StyleSheet.flatten(style as ViewStyle) ?? {}) as ViewStyle;
  return typeof flat.opacity === 'number' ? flat.opacity : 1;
};

/** What the screen really shows of a node: the product of the opacities of it and its host ancestors. */
function drawnOpacity(node: ReactTestInstance): number {
  let product = 1;
  for (let current: ReactTestInstance | null = node; current; current = current.parent) {
    if (typeof current.type === 'string') product *= opacityOf(current.props?.style);
  }
  return product;
}

const FULL: MotionSettings = { policy: 'full', slow: false };
const REDUCED: MotionSettings = { policy: 'reduced', slow: false };

describe('RF-PH-4: the end of the Login entrance is drawn by React', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  const cases: readonly [LoginEntrance, MotionSettings][] = [
    ['enter', FULL],
    ['return', FULL],
    ['enter', REDUCED],
    ['return', REDUCED],
  ];

  it.each(cases)('%s, %o: before the end the fades are animated; after it every part rests at opacity 1, whatever Reanimated dropped', (entrance, settings) => {
    const { result } = renderHook(() => useLoginChoreography(entrance, settings));
    // Under the model the animated styles keep their first value: the parts mount invisible.
    expect(opacityOf(result.current.cardStyle)).toBe(0);
    // Well past every entrance of these settings (the longest ends at 1.9 s).
    act(() => {
      jest.advanceTimersByTime(5_000);
    });
    for (const style of [result.current.backdropStyle, result.current.wordmarkStyle, result.current.captionStyle, result.current.cardStyle, result.current.companionStyle]) {
      expect(opacityOf(style)).toBe(1);
    }
    const emblem = (StyleSheet.flatten(result.current.emblemStyle as ViewStyle) ?? {}) as ViewStyle;
    expect(emblem.transform).toEqual([{ translateX: 0 }, { translateY: 0 }, { scale: 1 }]);
  });

  // Fix wave J, JM-01 d (tablet, normal launch: after one worklet error the Login came up without wordmark,
  // caption and card until the app was killed). The model above was too kind: it lets a `useAnimatedStyle` that
  // is swapped in AFTER the mount hand its first value to React. Reanimated does that only in a view's FIRST
  // render; a later style reaches the view through the animation runtime alone - and that had stopped. So the
  // resting picture must be PLAIN styles: the same module constants for every Login, not a hook's product.
  it.each(cases)('JM-01 d - %s, %o: after the entrance the resting styles are plain constants, not animated styles', (entrance, settings) => {
    const first = renderHook(() => useLoginChoreography(entrance, settings));
    const second = renderHook(() => useLoginChoreography(entrance, settings));
    // Before the end each hook has its own animated styles.
    expect(first.result.current.cardStyle).not.toBe(second.result.current.cardStyle);
    act(() => {
      jest.advanceTimersByTime(5_000);
    });
    for (const part of ['wordmarkStyle', 'captionStyle', 'cardStyle', 'companionStyle'] as const) {
      expect(first.result.current[part]).toBe(second.result.current[part]);
      expect(opacityOf(first.result.current[part])).toBe(1);
    }
    // A shake layers the animated style in for its 300 ms, then the plain one is back.
    act(() => {
      first.result.current.shake();
    });
    expect(first.result.current.cardStyle).not.toBe(second.result.current.cardStyle);
    act(() => {
      jest.advanceTimersByTime(SHAKE_ACT_MS * (settings.slow ? 10 : 1) + 50);
    });
    expect(first.result.current.cardStyle).toBe(second.result.current.cardStyle);
    // The exit keeps its animated style until the screen is gone.
    act(() => {
      first.result.current.leave();
    });
    expect(first.result.current.cardStyle).not.toBe(second.result.current.cardStyle);
  });

  it('the entrance end follows the beats: about 1.9 s for `enter`, about 1.4 s for `return`, 0.4 s reduced, x10 in proof mode', () => {
    expect(entranceEndMs('enter', FULL)).toBe(1_650 + 250);
    expect(entranceEndMs('return', FULL)).toBe(1_150 + 250);
    expect(entranceEndMs('enter', REDUCED)).toBe(160 + 250);
    expect(entranceEndMs('enter', { policy: 'full', slow: true })).toBe(16_500 + 250);
  });
});

describe('RF-PH-4 on the real Login route: a cold Login is usable once the entrance is over', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    resetShellState();
    resetCoreLinkPrefsForTests();
    resetAuthPrefsForTests();
    resetMotionStateForTests();
  });
  afterEach(() => {
    resetMotionStateForTests();
  });

  it('the backdrop, the username field and Sign In are drawn at full opacity although no animated update landed', async () => {
    const test = createTestSim({});
    setWindow('phonePortrait');
    setSignedInSnapshot(false);
    const { width, height } = WINDOWS.phonePortrait;
    const metrics: Metrics = { frame: { x: 0, y: 0, width, height }, insets: { top: 24, right: 0, bottom: 16, left: 0 } };
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
    const sim: Sim = test.sim;
    function TestRoot() {
      return (
        <AppProviders sim={sim} safeAreaMetrics={metrics} queryClient={queryClient} heartbeatSocketFactory={() => new FakeHeartbeatSocket()}>
          <RootNavigator />
        </AppProviders>
      );
    }
    renderRoutes(appContext({ _layout: TestRoot }), '/login');
    await flushAsync();
    // The device picture: everything but the emblem is invisible while the entrance values are lost.
    expect(drawnOpacity(screen.getByTestId('login-username'))).toBe(0);
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 2_200)); // the full-motion entrance ends at 1.9 s
    });
    expect(drawnOpacity(screen.getByTestId('login-backdrop'))).toBe(1);
    expect(drawnOpacity(screen.getByTestId('login-username'))).toBe(1);
    expect(drawnOpacity(screen.getByTestId('login-submit'))).toBe(1);
  });
});
