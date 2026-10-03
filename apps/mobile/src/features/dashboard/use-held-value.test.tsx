// The Home held-beat value (DR-S77-1): 0 until the card settles, then the value; reduced motion
// shows it at once; later changes pass straight through.
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, renderHook } from '@testing-library/react-native';
import { useHeldValue } from './use-held-value';

describe('useHeldValue', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it('holds 0 for the delay, then shows the value; later changes are immediate', () => {
    const { result, rerender } = renderHook(({ value }: { value: number }) => useHeldValue(value, 790, false), {
      initialProps: { value: 20 },
    });
    expect(result.current).toBe(0);
    act(() => jest.advanceTimersByTime(789));
    expect(result.current).toBe(0);
    act(() => jest.advanceTimersByTime(1));
    expect(result.current).toBe(20);
    rerender({ value: 99 });
    expect(result.current).toBe(99);
  });

  it('shows the value at once under reduced motion or without a delay', () => {
    expect(renderHook(() => useHeldValue(7, 790, true)).result.current).toBe(7);
    expect(renderHook(() => useHeldValue(7, 0, false)).result.current).toBe(7);
  });
});
