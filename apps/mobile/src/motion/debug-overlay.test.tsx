// `?debug=1` overlay (04_mobile_specs §3.5, §7.8; MA-17 overlay part): hidden by default; shows
// UI / JS fps, meter frames per second, running loops and the policy once it is switched on.
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, cleanup, render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';
import { MotionDebugOverlay } from './debug-overlay';
import { drainMeterFrames, fpsFromWindow, isMeterFrameCounting, reportMeterFrame, setMeterFrameCounting } from './debug-metrics';
import { registerAmbientLoop, resetLoopRegistryForTests } from './loops';
import { MotionPolicyProvider } from './motion-policy-provider';
import { motionStore, resetMotionStateForTests } from './policy';

let mockLinkingUrl: string | null = null;
jest.mock('expo-linking', () => ({ useLinkingURL: () => mockLinkingUrl }));

// The overlay's UI-thread counter is driven by hand: Reanimated's jest frame-callback registry is
// global and runs on its own timer queue, so a real `useFrameCallback` leaks between tests.
type FrameCallback = (info: { timestamp: number }) => void;
let mockFrameCallback: FrameCallback | null = null;
jest.mock('react-native-reanimated', () => {
  const actual = jest.requireActual<Record<string, unknown>>('react-native-reanimated');
  return {
    ...actual,
    __esModule: true,
    useFrameCallback: (callback: FrameCallback) => {
      mockFrameCallback = callback;
    },
  };
});

const HIDDEN = { includeHiddenElements: true } as const;

describe('debug metrics', () => {
  afterEach(() => setMeterFrameCounting(false));

  it('computes frames per second over a window', () => {
    expect(fpsFromWindow(60, 1000)).toBe(60);
    expect(fpsFromWindow(55, 1100)).toBe(50);
    expect(fpsFromWindow(10, 0)).toBe(0);
  });

  it('counts meter frames per channel only while counting is on', () => {
    reportMeterFrame('MIC-01');
    expect(isMeterFrameCounting()).toBe(false);
    setMeterFrameCounting(true);
    for (let i = 0; i < 20; i += 1) reportMeterFrame('MIC-01');
    for (let i = 0; i < 10; i += 1) reportMeterFrame('MIC-02');
    expect(drainMeterFrames(1000)).toEqual({ 'MIC-01': 20, 'MIC-02': 10 });
    expect(drainMeterFrames(1000)).toEqual({});
  });
});

describe('MotionDebugOverlay', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    resetMotionStateForTests();
    resetLoopRegistryForTests();
    mockLinkingUrl = null;
    mockFrameCallback = null;
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  });
  afterEach(() => {
    cleanup();
    // Drop (not run) the unmounted components' queued frame work, then leave the fake clock.
    jest.clearAllTimers();
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('renders nothing and does not count meter frames until switched on', () => {
    render(<MotionDebugOverlay />);
    expect(screen.queryByTestId('motion-debug-overlay', HIDDEN)).toBeNull();
    expect(isMeterFrameCounting()).toBe(false);
  });

  it('shows fps, meter rates, running loops and the policy once per second', () => {
    act(() => motionStore.getState().setDebugOverlay(true));
    render(<MotionDebugOverlay top={0} />);
    expect(screen.getByTestId('motion-debug-overlay', HIDDEN).props.pointerEvents).toBe('none');
    expect(isMeterFrameCounting()).toBe(true);

    act(() => {
      registerAmbientLoop('ring-rotate');
      registerAmbientLoop('rec-pulse');
      motionStore.getState().setReduceMotionOverride(true);
    });
    // 61 UI frames 1000/60 ms apart: the first opens the window, the 60 after it close it at 1 s.
    act(() => {
      for (let i = 0; i <= 60; i += 1) mockFrameCallback?.({ timestamp: 5000 + (i * 1000) / 60 });
      jest.runAllTicks();
    });
    for (let i = 0; i < 20; i += 1) {
      reportMeterFrame('MIC-01');
      act(() => {
        jest.advanceTimersByTime(50);
      });
    }
    act(() => {
      jest.advanceTimersByTime(100);
    });

    expect(screen.getByTestId('motion-debug-fps', HIDDEN).props.children).toMatch(/^UI 60 fps · JS [1-9]\d* fps$/);
    expect(screen.getByTestId('motion-debug-meters', HIDDEN).props.children).toMatch(/^meters MIC-01 (19|20)\/s$/);
    expect(screen.getByTestId('motion-debug-loops', HIDDEN).props.children).toBe('loops 2/4: ring-rotate, rec-pulse');
    expect(screen.getByTestId('motion-debug-policy', HIDDEN).props.children).toBe('motion reduced (override)');
  });

  it('is switched on by a ?debug=1 deep link through MotionPolicyProvider and off by ?debug=0', async () => {
    mockLinkingUrl = 'demsdemo:///session/live?scenario=recording&debug=1';
    const { rerender } = render(
      <MotionPolicyProvider>
        <Text>app</Text>
      </MotionPolicyProvider>,
    );
    // Let the provider's prefs read settle inside act.
    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.getByTestId('motion-debug-overlay', HIDDEN)).toBeTruthy();
    mockLinkingUrl = 'demsdemo:///home?debug=0';
    rerender(
      <MotionPolicyProvider>
        <Text>app</Text>
      </MotionPolicyProvider>,
    );
    expect(screen.queryByTestId('motion-debug-overlay', HIDDEN)).toBeNull();
    expect(isMeterFrameCounting()).toBe(false);
  });
});
