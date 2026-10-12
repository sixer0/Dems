/**
 * `useConfirmedOpen` (fix wave J, JM-02; round two: the rule of every sheet of the app).
 * The sheet library's layout gate does not exist under jest, so the DROPPED request itself cannot be
 * reproduced here; what is pinned is the rule the frames rely on: an open that the library did not confirm
 * is asked again, a confirmed one is left alone, and after the last retry the frame closes itself.
 */
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, renderHook } from '@testing-library/react-native';
import { SHEET_OPEN_CHECK_MS, SHEET_OPEN_RETRIES, useConfirmedOpen } from './sheet-open';

describe('useConfirmedOpen', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  const tick = (ms: number) =>
    act(() => {
      jest.advanceTimersByTime(ms);
    });

  it('a slide the library reported: the kit stays open, nothing is asked again, the frame never gives up', () => {
    const giveUp = jest.fn();
    const hook = renderHook(({ want }: { want: boolean }) => useConfirmedOpen(want, giveUp, { testID: 'x' }), { initialProps: { want: true } });
    expect(hook.result.current.kitOpen).toBe(true);
    act(() => hook.result.current.onAnimate(-1, 0));
    tick(SHEET_OPEN_CHECK_MS * (SHEET_OPEN_RETRIES + 3));
    expect(hook.result.current.kitOpen).toBe(true);
    expect(giveUp).not.toHaveBeenCalled();
  });

  it('no slide reported: the kit is closed for a frame and opened again; a late report ends the retries', () => {
    const giveUp = jest.fn();
    const hook = renderHook(() => useConfirmedOpen(true, giveUp, { testID: 'x' }));
    tick(SHEET_OPEN_CHECK_MS);
    // The pulse: `isOpen` false, so that the kit sees a closed -> open transition on the next frame.
    expect(hook.result.current.kitOpen).toBe(false);
    tick(20);
    expect(hook.result.current.kitOpen).toBe(true);
    act(() => hook.result.current.onAnimate(-1, 0));
    tick(SHEET_OPEN_CHECK_MS * (SHEET_OPEN_RETRIES + 3));
    expect(hook.result.current.kitOpen).toBe(true);
    expect(giveUp).not.toHaveBeenCalled();
  });

  it('a slide towards CLOSED (index -1) confirms nothing', () => {
    const giveUp = jest.fn();
    const hook = renderHook(() => useConfirmedOpen(true, giveUp, { testID: 'x' }));
    act(() => hook.result.current.onAnimate(0, -1));
    tick(SHEET_OPEN_CHECK_MS);
    expect(hook.result.current.kitOpen).toBe(false);
  });

  it('never confirmed: after the last retry the frame gives up once - no invisible sheet is left behind', () => {
    const giveUp = jest.fn();
    renderHook(() => useConfirmedOpen(true, giveUp, { testID: 'x' }));
    for (let turn = 0; turn < SHEET_OPEN_RETRIES; turn += 1) {
      tick(SHEET_OPEN_CHECK_MS);
      tick(20);
    }
    expect(giveUp).not.toHaveBeenCalled();
    tick(SHEET_OPEN_CHECK_MS);
    expect(giveUp).toHaveBeenCalledTimes(1);
  });

  it('closed by the caller: the count starts again with the next open', () => {
    const giveUp = jest.fn();
    const hook = renderHook(({ want }: { want: boolean }) => useConfirmedOpen(want, giveUp, { testID: 'x' }), { initialProps: { want: true } });
    tick(SHEET_OPEN_CHECK_MS);
    tick(20);
    hook.rerender({ want: false });
    expect(hook.result.current.kitOpen).toBe(false);
    hook.rerender({ want: true });
    expect(hook.result.current.kitOpen).toBe(true);
    for (let turn = 0; turn < SHEET_OPEN_RETRIES; turn += 1) {
      tick(SHEET_OPEN_CHECK_MS);
      tick(20);
    }
    expect(giveUp).not.toHaveBeenCalled();
  });
});
