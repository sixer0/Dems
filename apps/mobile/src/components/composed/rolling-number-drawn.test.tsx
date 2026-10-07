// Post-review fix FXR-M, finding W93-3 (code review W93, decision D243): the kit `RollingNumber` in
// `slide` mode kept the D214 defect for its eleven product users (the bottom Recording bar, the Home
// header clock, System Time, Network status, System Status, the hub timer, the storage ring, the status
// tiles, recent sessions, the More tiles, the Login and Pair lock-out countdowns).
//
// D214 (`features/session-live/timer-readout.tsx` header): each digit column's position lived ONLY in a
// Reanimated shared value; Reanimated 4.5 drops a settled animated value that a stalled JS thread did
// not take back in time, and the next commit re-applies React's own props, the digit the column was
// MOUNTED with ("04:24 read 04:12"). Jest runs no UI thread, so this file models the WORST case of that
// loss, as `monitor-timer-drawn.test.tsx` does: every `useAnimatedStyle` keeps the style of its first
// render forever. What a readout draws under that model is what a device draws once Reanimated dropped
// its values. The digit a column shows is read from the transforms between the column's clip and its
// cells (React props only).
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, cleanup, render, screen } from '@testing-library/react-native';
import { StyleSheet, type ViewStyle } from 'react-native';
import { makeMutable } from 'react-native-reanimated';
import type { ReactTestInstance } from 'react-test-renderer';
import { typography, type TypographyToken } from '@dems/shared/tokens';
import { RollingNumber } from './rolling-number';
import { formatRolling, rollCells, type RollingFormat } from './rolling-number.math';

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

beforeEach(() => {
  jest.useFakeTimers();
});
afterEach(() => {
  cleanup();
  act(() => {
    jest.runOnlyPendingTimers();
  });
  jest.useRealTimers();
});

const HIDDEN = { includeHiddenElements: true } as const;
const flat = (node: ReactTestInstance): ViewStyle => (StyleSheet.flatten(node.props?.style) ?? {}) as ViewStyle;
const isHost = (node: ReactTestInstance | null): boolean => !!node && typeof (node.type as unknown) === 'string';

function translateYOf(node: ReactTestInstance): number {
  const transform = (Array.isArray(flat(node).transform) ? flat(node).transform : []) as unknown as readonly Record<string, unknown>[];
  return transform.reduce((sum, t) => sum + (typeof t.translateY === 'number' ? t.translateY : 0), 0);
}

/** The digit a column draws: the host transforms from its cells up to its clip, in cells. */
function drawnDigit(column: ReactTestInstance, lineHeight: number): string {
  let offset = 0;
  let node: ReactTestInstance | null = column;
  while (node && !(isHost(node) && flat(node).overflow === 'hidden')) {
    if (isHost(node)) offset += translateYOf(node);
    node = node.parent;
  }
  const cell = Math.round(-offset / lineHeight);
  return String(((cell % 10) + 10) % 10);
}

/** The digits a readout draws, left to right (separators left out). */
function drawnDigits(testID: string, size: TypographyToken): string {
  const lineHeight = typography[size].lineHeight;
  const columns = screen
    .getAllByTestId(new RegExp(`^${testID}-d\\d+$`), HIDDEN)
    .filter(isHost)
    .map((node) => ({ node, fromEnd: Number(String(node.props.testID).split('-d').pop()) }))
    .sort((a, b) => b.fromEnd - a.fromEnd);
  return columns.map(({ node }) => drawnDigit(node, lineHeight)).join('');
}

const digitsOf = (value: number, format: RollingFormat): string => formatRolling(value, format).replace(/\D/g, '');

describe.each([
  ['reduced motion (the demo launch, ?motion=off)', 'reduced' as const],
  ['full motion', 'full' as const],
])('W93-3: RollingNumber draws the current value, whatever Reanimated drops (%s)', (_label, motion) => {
  it('the Home header clock (h3, clock): mounted at 14:27:32, 95 one-second steps later it draws 14:29:07', () => {
    const format: RollingFormat = { kind: 'clock' };
    const start = 14 * 3600 + 27 * 60 + 32;
    const { rerender } = render(<RollingNumber value={start} format={format} motion={motion} size="h3" face="mono" testID="clock" />);
    expect(drawnDigits('clock', 'h3')).toBe('142732');
    for (let s = 1; s <= 95; s += 1) {
      rerender(<RollingNumber value={start + s} format={format} motion={motion} size="h3" face="mono" testID="clock" />);
      expect([s, drawnDigits('clock', 'h3')]).toEqual([s, digitsOf(start + s, format)]);
    }
    expect(drawnDigits('clock', 'h3')).toBe('142907');
  });

  it('a timer jump after a stall (00:03:13 -> 00:04:24 at once) draws 00:04:24, not a digit of the mount', () => {
    const format: RollingFormat = { kind: 'duration' };
    const { rerender } = render(<RollingNumber value={193} format={format} motion={motion} size="data" face="mono" testID="timer" />);
    rerender(<RollingNumber value={264} format={format} motion={motion} size="data" face="mono" testID="timer" />);
    expect(drawnDigits('timer', 'data')).toBe('000424');
  });

  it('a lock-out countdown (counts DOWN): 01:00 -> 00:47', () => {
    const format: RollingFormat = { kind: 'countdown' };
    const { rerender } = render(<RollingNumber value={60} format={format} motion={motion} size="body" face="mono" testID="lock" />);
    for (let s = 59; s >= 47; s -= 1) rerender(<RollingNumber value={s} format={format} motion={motion} size="body" face="mono" testID="lock" />);
    expect(drawnDigits('lock', 'body')).toBe('0047');
  });

  it('a decimal readout that loses and regains a column (12.4 -> 9.8 -> 10.1 Mbps)', () => {
    const format: RollingFormat = { kind: 'decimal', decimals: 1 };
    const { rerender } = render(<RollingNumber value={12.4} format={format} motion={motion} size="h2" face="mono" testID="bw" />);
    rerender(<RollingNumber value={9.8} format={format} motion={motion} size="h2" face="mono" testID="bw" />);
    expect(drawnDigits('bw', 'h2')).toBe('98');
    rerender(<RollingNumber value={10.1} format={format} motion={motion} size="h2" face="mono" testID="bw" />);
    expect(drawnDigits('bw', 'h2')).toBe('101');
  });

  it('a percentage (storage ring, integer): 86 -> 99', () => {
    const { rerender } = render(<RollingNumber value={86} motion={motion} size="h1" face="sans" suffix="%" testID="pct" />);
    rerender(<RollingNumber value={99} motion={motion} size="h1" face="sans" suffix="%" testID="pct" />);
    expect(drawnDigits('pct', 'h1')).toBe('99');
    expect(screen.getByLabelText('99%')).toBeTruthy();
  });

  it('a shared-value input (dev gallery) is drawn from React too: 00:24:18 -> 00:24:21', () => {
    const seconds = makeMutable(1458);
    render(<RollingNumber value={seconds} format={{ kind: 'duration' }} motion={motion} testID="sv" accessibilityLabel="Timer" />);
    act(() => {
      jest.advanceTimersByTime(50);
    });
    for (const next of [1459, 1460, 1461]) {
      act(() => {
        seconds.set(next);
        jest.advanceTimersByTime(400);
      });
    }
    expect(drawnDigits('sv', 'display')).toBe('002421');
  });
});

describe('rollCells: the roll of a React-positioned column', () => {
  it.each([
    // [fromCell, digit, forward, from, to]
    [3, 4, true, 3, 4],
    [9, 0, true, 9, 10],
    [8, 2, true, 8, 12],
    [17, 2, true, 7, 12],
    [1, 8, true, 1, 8], // forward: a timer jump of +7 rolls up, never back
    [1, 8, false, 11, 8], // shortest: down from the second decade
    [0, 9, false, 10, 9],
    [7, 3, false, 17, 13],
    [5, 5, false, 5, 5],
  ])('from cell %i to digit %i (forward %s): %i -> %i', (fromCell, digit, forward, from, to) => {
    const step = rollCells(fromCell, digit, forward);
    expect(step).toEqual({ from, to });
    expect(step.to % 10).toBe(digit);
    expect(step.to).toBeGreaterThanOrEqual(0);
    expect(step.to).toBeLessThan(20);
    expect(step.from).toBeLessThan(20);
  });
});
