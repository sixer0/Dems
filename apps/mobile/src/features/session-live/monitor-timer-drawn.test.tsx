// Closing-fix row CF-M1, defect R-P-2's "timer running backwards" (and R-P-1's 04:22 -> 04:12; decision D214).
//
// On the devices the monitor timer showed digits of the moment the monitor was MOUNTED after a JS stall
// (R-P-2: 14, 17, 18 read 04, 07, 08; R-P-1: 04:24 read 04:12; CF-M1 reproduction: 03:28 then 03:23), while
// the clock ran on. Reanimated drops a settled animated value that the stalled JS thread did not take back
// in time, and the next commit of the digit column draws React's own value: the digit of its mount.
// Jest runs no UI thread, so this file models the WORST case of that loss, as FX-M2b's chrome test does:
// every `useAnimatedStyle` keeps the style of its first render forever. Whatever the monitor draws under
// that model is what a device draws once Reanimated has dropped its values. The digit a column shows is
// read from the transforms between the column's clip and its cells (its React props).
import './testing/monitor-test-setup';
import { afterEach, describe, expect, it, jest } from '@jest/globals';
import '@/navigation/testing/router-harness';

import { act, screen } from '@testing-library/react-native';
import { StyleSheet, type ViewStyle } from 'react-native';
import type { ReactTestInstance } from 'react-test-renderer';
import { typography } from '@dems/shared/tokens';
import { motionStore, resetMotionStateForTests } from '@/motion';
import { renderMonitorApp, settle } from './testing/monitor-harness';
import { nextCell } from './timer-readout';

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

afterEach(() => {
  resetMotionStateForTests();
});

const translateYOf = (node: ReactTestInstance): number => {
  const style = (StyleSheet.flatten(node.props?.style) ?? {}) as ViewStyle;
  const transform = (Array.isArray(style.transform) ? style.transform : []) as unknown as readonly Record<string, unknown>[];
  return transform.reduce((sum, t) => sum + (typeof t.translateY === 'number' ? t.translateY : 0), 0);
};

const isClip = (node: ReactTestInstance): boolean => ((StyleSheet.flatten(node.props?.style) ?? {}) as ViewStyle).overflow === 'hidden';

/** The digit a column draws: the transforms from its cells up to its clip, in cells of `lineHeight`. */
function drawnDigit(column: ReactTestInstance, lineHeight: number): string {
  let offset = 0;
  let node: ReactTestInstance | null = column;
  // Host views only: a composite wrapper repeats the style prop it passes down.
  while (node && !(typeof node.type === 'string' && isClip(node))) {
    if (typeof node.type === 'string') offset += translateYOf(node);
    node = node.parent;
  }
  const cell = Math.round(-offset / lineHeight);
  return String(((cell % 10) + 10) % 10);
}

/** HH:MM:SS as drawn by the readout with `testID` (a column per digit, `${testID}-d<position from the end>`: 8 7 : 5 4 : 2 1). */
function drawn(testID: string, lineHeight: number): string {
  const digits = [8, 7, 5, 4, 2, 1].map((fromEnd) => {
    const columns = screen.getAllByTestId(`${testID}-d${fromEnd}`, { includeHiddenElements: true }).filter((node) => typeof node.type === 'string');
    return drawnDigit(columns[0]!, lineHeight);
  });
  return `${digits[0]}${digits[1]}:${digits[2]}${digits[3]}:${digits[4]}${digits[5]}`;
}

async function openPhone() {
  const h = renderMonitorApp({ window: 'phonePortrait' });
  await settle();
  h.openMonitor();
  return h;
}

describe.each([
  ['reduced motion (the demo launch, ?motion=off)', true],
  ['full motion', false],
])('the monitor timer draws the current time, whatever Reanimated drops (%s)', (_label, reduced) => {
  it('mounted at 00:18:42, 25 s later it draws 00:19:07 (the tens and the minutes moved; nothing is drawn from the mount)', async () => {
    act(() => motionStore.getState().setOsReduceMotion(reduced));
    const h = await openPhone();
    expect(drawn('monitor-timer', typography.display.lineHeight)).toBe('00:18:42');
    for (let i = 0; i < 25; i += 1) act(() => h.advance(1_000));
    expect(screen.getAllByLabelText('00:19:07').length).toBeGreaterThan(0);
    expect(drawn('monitor-timer', typography.display.lineHeight)).toBe('00:19:07');
  });

  it("the feed's REC chip draws the same time (it used the same readout and showed the same 03:23 on the phone)", async () => {
    act(() => motionStore.getState().setOsReduceMotion(reduced));
    const h = await openPhone();
    for (let i = 0; i < 25; i += 1) act(() => h.advance(1_000));
    expect(drawn('monitor-feed-timer', typography.data.lineHeight)).toBe('00:19:07');
  });

  it('a jump after a stall (several seconds at once) still draws the current time', async () => {
    act(() => motionStore.getState().setOsReduceMotion(reduced));
    const h = await openPhone();
    act(() => h.advance(9_000));
    expect(drawn('monitor-timer', typography.display.lineHeight)).toBe('00:18:51');
    act(() => h.advance(70_000));
    expect(drawn('monitor-timer', typography.display.lineHeight)).toBe('00:20:01');
  });
});

describe('nextCell: the odometer step of a column (always forward, within its 20 cells)', () => {
  it.each([
    [0, 1, 1],
    [8, 9, 9],
    [9, 0, 10],
    [10, 1, 1],
    [3, 3, 3],
    [17, 2, 12],
    [5, 2, 12],
  ])('from cell %i to digit %i: cell %i', (from, digit, cell) => {
    expect(nextCell(from, digit)).toBe(cell);
  });
});
