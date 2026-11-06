/**
 * `useConfirmedOpen` (fix wave J, JM-02; round two: the rule of every sheet of the app).
 * The sheet library's layout gate does not exist under jest, so the DROPPED request itself cannot be
 * reproduced here; what is pinned is the rule the frames rely on: an open that the library did not confirm
 * is asked again, a confirmed one is left alone, and after the last retry the frame closes itself.
 */
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, render, renderHook } from '@testing-library/react-native';
import { Keyboard, TextInput } from 'react-native';
import { KeyboardController, KeyboardEvents } from 'react-native-keyboard-controller';
import { runtimeLog } from '@/runtime';
import { KEYBOARD_AWAY_REPEAT_MS, KEYBOARD_ORPHAN_CHECK_MS, hideOrphanKeyboard, putKeyboardAway, registerKeyboardSink } from './keyboard';
import { KEYBOARD_WATCH_MS, KeyboardGuard, SINK_USE_MS, checkShownKeyboard } from './keyboard-guard';
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

// Fix wave Q - the soft keyboard's ONE rule (`./keyboard`): JT-23 original (a keyboard over Session Live with no field,
// covering End Session), CT-06 (the Evidence search field kept the keyboard focus behind the export wizard), CP-02 /
// JM-04 (the keyboard stayed over the export result), CP-13. The platform's focus hand-over does not exist under
// jest; what is pinned is the rule: who asks for the dismissal, when, and that a focused field is never touched.
describe("the keyboard's one rule (fix wave Q)", () => {
  let rnDismiss: ReturnType<typeof jest.spyOn>;
  let libDismiss: ReturnType<typeof jest.spyOn>;
  let focused: unknown = null;
  beforeEach(() => {
    jest.useFakeTimers();
    focused = null;
    rnDismiss = jest.spyOn(Keyboard, 'dismiss').mockImplementation(() => undefined);
    libDismiss = jest.spyOn(KeyboardController, 'dismiss').mockImplementation(async () => undefined);
    libDismiss.mockClear();
    rnDismiss.mockClear();
    jest.spyOn(TextInput.State, 'currentlyFocusedInput').mockImplementation(() => focused as never);
  });
  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
  });
  const tick = (ms: number) =>
    act(() => {
      jest.advanceTimersByTime(ms);
    });

  it('a sheet that OPENS and a sheet that CLOSES each put the keyboard away - now and once more after the field is gone; a sheet that stays as it is asks for nothing', () => {
    const hook = renderHook(({ want }: { want: boolean }) => useConfirmedOpen(want, jest.fn(), { testID: 'x' }), { initialProps: { want: false } });
    // Closed from the start: nothing to put away.
    tick(KEYBOARD_AWAY_REPEAT_MS * 2);
    expect(rnDismiss).not.toHaveBeenCalled();

    // It opens: the field of the screen behind it loses the focus (CT-06), through both owners of the focus.
    hook.rerender({ want: true });
    expect(rnDismiss).toHaveBeenCalledTimes(1);
    expect(libDismiss).toHaveBeenCalledTimes(1);
    act(() => hook.result.current.onAnimate(-1, 0));
    tick(KEYBOARD_AWAY_REPEAT_MS);
    expect(rnDismiss).toHaveBeenCalledTimes(2);

    // Re-renders of an open sheet (its steps, its own field being typed in) never dismiss anything.
    hook.rerender({ want: true });
    hook.rerender({ want: true });
    tick(KEYBOARD_AWAY_REPEAT_MS * 4);
    expect(rnDismiss).toHaveBeenCalledTimes(2);

    // It closes: the keyboard of its own field goes with it (CP-02 / JM-04).
    hook.rerender({ want: false });
    expect(rnDismiss).toHaveBeenCalledTimes(3);
    tick(KEYBOARD_AWAY_REPEAT_MS);
    expect(rnDismiss).toHaveBeenCalledTimes(4);
    expect(libDismiss).toHaveBeenCalledTimes(4);
  });

  it('a keyboard that is up with NO focused field is hidden through the guard\'s own field (one use of it); a focused field is never touched', () => {
    const calls: string[] = [];
    const remove = registerKeyboardSink({ use: () => calls.push('use') });
    // Somebody is typing: nothing happens.
    focused = { field: 'reason' };
    expect(hideOrphanKeyboard()).toBe(false);
    expect(checkShownKeyboard()).toBe('owned');
    expect(calls).toEqual([]);
    // No field holds the focus: the guard's field is focused and blurred - the blur hides the keyboard of the window.
    focused = null;
    const before = runtimeLog.records().length;
    expect(checkShownKeyboard()).toBe('hidden');
    expect(calls).toEqual(['use']);
    expect(runtimeLog.records().slice(before).map((record) => `${record.level}:${record.source}`)).toEqual(['warn:keyboard.orphan']);
    // Without a mounted guard there is nothing to act with, and nothing throws.
    remove();
    expect(hideOrphanKeyboard()).toBe(false);
    expect(checkShownKeyboard()).toBe('no-sink');
  });

  it('the repeat of `putKeyboardAway` hides a keyboard that outlived its field (the dialog and export cases), and only then', () => {
    const calls: string[] = [];
    registerKeyboardSink({ use: () => calls.push('use') });
    const visible = jest.spyOn(KeyboardController, 'isVisible');
    // The keyboard went with the first dismissal: the guard's field is not used.
    visible.mockReturnValue(false);
    putKeyboardAway();
    tick(KEYBOARD_AWAY_REPEAT_MS);
    expect(calls).toEqual([]);
    // It is still up after the field is gone and no field holds the focus: it is hidden.
    visible.mockReturnValue(true);
    putKeyboardAway();
    tick(KEYBOARD_AWAY_REPEAT_MS);
    expect(calls).toEqual(['use']);
    // Still up, but a field took the focus meanwhile (a new screen's own field): left alone.
    focused = { field: 'username' };
    putKeyboardAway();
    tick(KEYBOARD_AWAY_REPEAT_MS);
    expect(calls).toEqual(['use']);
    // A cancelled repeat does nothing.
    focused = null;
    const cancel = putKeyboardAway();
    cancel();
    tick(KEYBOARD_AWAY_REPEAT_MS * 2);
    expect(calls).toEqual(['use']);
  });

  it('a keyboard that LOSES its field while it is up (a dialog taken away under it) is hidden at the next look - the guard keeps looking while a keyboard is up', () => {
    const listeners: Record<string, (() => void) | undefined> = {};
    jest.spyOn(KeyboardEvents, 'addListener').mockImplementation(((name: string, run: () => void) => {
      listeners[name] = run;
      return { remove: () => undefined };
    }) as never);
    const view = render(<KeyboardGuard />);
    const sinkProps = () => view.getByTestId('keyboard-sink', { includeHiddenElements: true }).props;
    // The keyboard comes up for a focused field: owned, nothing happens - for as long as the field holds the focus.
    focused = { field: 'reason' };
    act(() => listeners.keyboardDidShow?.());
    tick(KEYBOARD_ORPHAN_CHECK_MS + KEYBOARD_WATCH_MS * 5);
    expect(sinkProps().editable).toBe(false);
    // The field goes (its dialog was taken away); no new "shown" event comes. The next look finds no owner.
    focused = null;
    tick(KEYBOARD_WATCH_MS);
    expect(sinkProps().editable).toBe(true);
    tick(SINK_USE_MS.done);
    expect(sinkProps().editable).toBe(false);
    // CONTROL: once the keyboard is hidden nothing looks any more.
    act(() => listeners.keyboardDidHide?.());
    focused = null;
    tick(KEYBOARD_WATCH_MS * 5);
    expect(sinkProps().editable).toBe(false);
    view.unmount();
  });

  it('the guard draws a field that raises no keyboard, takes no touch and is hidden from screen readers', () => {
    const view = render(<KeyboardGuard />);
    const sink = view.getByTestId('keyboard-sink', { includeHiddenElements: true });
    expect(sink.props.showSoftInputOnFocus).toBe(false);
    expect(sink.props.pointerEvents).toBe('none');
    expect(sink.props.accessible).toBe(false);
    expect(sink.props.importantForAccessibility).toBe('no-hide-descendants');
    // At rest it cannot take the focus at all (the platform parks the focus of stray keys on a focusable field) ...
    const inert = () => view.getByTestId('keyboard-sink', { includeHiddenElements: true }).props;
    expect([inert().editable, inert().focusable]).toEqual([false, false]);
    // ... it can for the instant of one use, and is inert again after it.
    let acted = false;
    act(() => {
      acted = hideOrphanKeyboard();
    });
    expect(acted).toBe(true);
    expect([inert().editable, inert().focusable]).toEqual([true, true]);
    tick(SINK_USE_MS.done);
    expect([inert().editable, inert().focusable]).toEqual([false, false]);
    view.unmount();
    // Unmounted: its field is out of the rule again.
    expect(hideOrphanKeyboard()).toBe(false);
  });
});
