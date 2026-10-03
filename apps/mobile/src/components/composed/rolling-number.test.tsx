// C-6 RollingNumber: deterministic formatting, digit columns and the odometer roll plan.
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, cleanup, render, screen } from '@testing-library/react-native';
import { getAnimatedStyle, makeMutable } from 'react-native-reanimated';
import { typography } from '@dems/shared/tokens';
import { RollingNumber } from './rolling-number';
import { baseTemplate, digitFromEnd, drumPosition, formatRolling, placesOf, rollPlan, templateOf } from './rolling-number.math';

describe('RollingNumber maths', () => {
  it('formats timers, clocks and countdowns without Intl', () => {
    expect(formatRolling(1458, { kind: 'duration' })).toBe('00:24:18'); // MB 4
    expect(formatRolling(52052, { kind: 'clock' })).toBe('14:27:32'); // MB 9
    expect(formatRolling(86400 + 5, { kind: 'clock' })).toBe('00:00:05');
    expect(formatRolling(59.2, { kind: 'countdown' })).toBe('01:00');
    expect(formatRolling(-3, { kind: 'duration' })).toBe('00:00:00');
  });

  it('formats integers and decimals with padding and sign', () => {
    expect(formatRolling(7, { kind: 'integer' })).toBe('7');
    expect(formatRolling(7, { kind: 'integer', minDigits: 2 })).toBe('07');
    expect(formatRolling(-12.6, { kind: 'integer' })).toBe('-13');
    expect(formatRolling(12.44, { kind: 'decimal', decimals: 1 })).toBe('12.4');
    expect(formatRolling(3.2, { kind: 'decimal', decimals: 1 })).toBe('3.2');
    expect(formatRolling(0.05, { kind: 'decimal', decimals: 2 })).toBe('0.05');
    expect(formatRolling(Number.NaN, { kind: 'integer' })).toBe('0');
  });

  it('derives the column template from the value or the format', () => {
    expect(templateOf('00:24:18')).toBe('dd:dd:dd');
    expect(templateOf('-12.4')).toBe('-dd.d');
    expect(baseTemplate({ kind: 'countdown' })).toBe('dd:dd');
    expect(baseTemplate({ kind: 'integer', minDigits: 3 })).toBe('ddd');
  });

  it('reads digits from the right so growing values keep their columns', () => {
    expect(digitFromEnd(1458, { kind: 'duration' }, 1)).toBe(8);
    expect(digitFromEnd(1458, { kind: 'duration' }, 3)).toBe(-1); // the colon
    expect(digitFromEnd(1458, { kind: 'duration' }, 4)).toBe(4);
    expect(digitFromEnd(9, { kind: 'integer' }, 2)).toBe(-1);
    expect(digitFromEnd(10, { kind: 'integer' }, 2)).toBe(1);
  });

  it('maps template characters to decimal places and turns count drums continuously', () => {
    expect(placesOf('dd.d')).toEqual([1, 0, null, -1]);
    expect(placesOf('ddd')).toEqual([2, 1, 0]);
    expect(drumPosition(20, 0)).toBeCloseTo(0, 6);
    expect(drumPosition(20, 1)).toBeCloseTo(2, 6);
    expect(drumPosition(14.5, 0)).toBeCloseTo(4.5, 6);
    expect(drumPosition(14.5, 1)).toBeCloseTo(1.45, 6);
    expect(drumPosition(12.4, -1)).toBeCloseTo(4, 6);
    expect(drumPosition(9.99999, 0)).toBe(0); // wraps cleanly
  });

  it('rolls forward across 9 → 0 and backward across 0 → 9', () => {
    expect(rollPlan(3, 4)).toEqual({ from: null, to: 4, settle: null });
    expect(rollPlan(9, 0)).toEqual({ from: null, to: 10, settle: 0 });
    expect(rollPlan(8, 2)).toEqual({ from: null, to: 12, settle: 2 });
    expect(rollPlan(0, 9)).toEqual({ from: 10, to: 9, settle: null });
    expect(rollPlan(7, 3)).toEqual({ from: null, to: 3, settle: null });
    expect(rollPlan(-1, 5)).toEqual({ from: null, to: 5, settle: null });
  });
});

describe('RollingNumber component', () => {
  const lh = typography.display.lineHeight;
  // Digit cells are hidden from accessibility (the group reads as one label), so queries opt in.
  const HIDDEN = { includeHiddenElements: true } as const;

  beforeEach(() => {
    jest.useFakeTimers();
  });
  afterEach(() => {
    // Unmount and flush queued UI-runtime work under this test's fake clock (frame callbacks
    // register and unregister through it), then return to real timers.
    cleanup();
    act(() => {
      jest.runOnlyPendingTimers();
    });
    jest.useRealTimers();
  });

  it('lays out one rolling column per digit with static separators', () => {
    render(<RollingNumber value={1458} format={{ kind: 'duration' }} motion="full" testID="timer" />);
    expect(screen.getByLabelText('00:24:18')).toBeTruthy();
    expect(screen.getAllByText(':')).toHaveLength(2);
    for (let p = 1; p <= 8; p += 1) {
      if (p === 3 || p === 6) continue;
      expect(screen.getByTestId(`timer-d${p}`, HIDDEN)).toBeTruthy();
    }
    expect(getAnimatedStyle(screen.getByTestId('timer-d1', HIDDEN))).toEqual({ transform: [{ translateY: -8 * lh }] });
  });

  it('rolls the units column on the UI side when a shared-value timer ticks', () => {
    const seconds = makeMutable(1458);
    render(
      <RollingNumber value={seconds} format={{ kind: 'duration' }} motion="full" testID="t" accessibilityLabel="Timer" />,
    );
    act(() => {
      jest.advanceTimersByTime(50);
    });
    act(() => {
      seconds.set(1459);
      jest.advanceTimersByTime(400);
    });
    expect(getAnimatedStyle(screen.getByTestId('t-d1', HIDDEN))).toEqual({ transform: [{ translateY: -9 * lh }] });
    act(() => {
      seconds.set(1460); // 9 → 0 rolls forward, then settles on the first decade
      jest.advanceTimersByTime(400);
    });
    expect(getAnimatedStyle(screen.getByTestId('t-d1', HIDDEN))).toEqual({ transform: [{ translateY: -0 * lh }] });
    expect(getAnimatedStyle(screen.getByTestId('t-d2', HIDDEN))).toEqual({ transform: [{ translateY: -2 * lh }] });
  });

  it('counts a KPI up after the held beat on digit drums, hiding the leading zero', () => {
    const lhH1 = typography.h1.lineHeight;
    render(<RollingNumber value={20} mode="count" size="h1" suffix="%" motion="full" testID="kpi" />);
    expect(screen.getByLabelText('20%')).toBeTruthy();
    expect(getAnimatedStyle(screen.getByTestId('kpi-d2', HIDDEN))).toMatchObject({ opacity: 0 });
    act(() => {
      jest.advanceTimersByTime(4000);
    });
    expect(getAnimatedStyle(screen.getByTestId('kpi-d2', HIDDEN))).toMatchObject({ opacity: 1 });
    const tens = getAnimatedStyle(screen.getByTestId('kpi-d2', HIDDEN)) as { transform: { translateY: number }[] };
    const units = getAnimatedStyle(screen.getByTestId('kpi-d1', HIDDEN)) as { transform: { translateY: number }[] };
    expect(tens.transform[0].translateY).toBeCloseTo(-2 * lhH1, 1);
    expect(Math.abs(units.transform[0].translateY)).toBeLessThan(0.5);
  });

  it('adds a column when an integer grows from 9 to 10', () => {
    const { rerender } = render(<RollingNumber value={9} motion="reduced" testID="n" />);
    expect(screen.queryByTestId('n-d2', HIDDEN)).toBeNull();
    rerender(<RollingNumber value={10} motion="reduced" testID="n" />);
    act(() => {
      jest.advanceTimersByTime(50);
    });
    expect(screen.getByLabelText('10')).toBeTruthy();
    expect(screen.getByTestId('n-d2', HIDDEN)).toBeTruthy();
  });
});
