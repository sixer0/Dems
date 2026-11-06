/**
 * Rule 2 of `./keyboard` (fix wave Q; JT-23 original, CT-06, CP-13): "a screen without a focused field never
 * shows a keyboard". Mounted ONCE, by the root layout.
 *
 * It draws the sink - a field of one pixel that never raises a keyboard (`showSoftInputOnFocus={false}`), takes
 * no touch, is hidden from screen readers and can be focused only while it is in use (`SINK_USE_MS`: editable for
 * that instant, so the platform never parks the focus on it) - and watches the keyboard: once one has come up it looks,
 * `KEYBOARD_ORPHAN_CHECK_MS` later AND THEN EVERY `KEYBOARD_WATCH_MS` WHILE IT IS UP, whether a field of the app
 * holds the focus. If none does, the keyboard is nobody's: it is hidden (`hideOrphanKeyboard`) and the event is
 * recorded once per appearance. (The repeat was added after the device proof of this wave: the End Session dialog
 * was taken away by a resync of the screen while its field held the focus - the keyboard had come up rightly, and
 * lost its field LATER, with no new "shown" event to look at.)
 */
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, TextInput } from 'react-native';
import { KeyboardEvents } from 'react-native-keyboard-controller';
import { reportRuntimeIssue } from '@/runtime';
import { KEYBOARD_ORPHAN_CHECK_MS, focusedField, hideOrphanKeyboard, registerKeyboardSink } from './keyboard';

/** What the guard does when a keyboard has come up and stayed for `KEYBOARD_ORPHAN_CHECK_MS`. Exported for its test. */
export function checkShownKeyboard(): 'owned' | 'hidden' | 'no-sink' {
  if (focusedField() !== null) return 'owned';
  if (!hideOrphanKeyboard()) return 'no-sink';
  reportRuntimeIssue('warn', 'keyboard.orphan', new Error('A keyboard was up while no field was focused; it was put away.'));
  return 'hidden';
}

/** While a keyboard is up, its owner is looked for again this often. */
export const KEYBOARD_WATCH_MS = 1000;

/** One use of the sink: it becomes focusable, is focused after `focusAt`, blurred after `blurAt`, and is inert again after `done`. */
export const SINK_USE_MS = { focusAt: 40, blurAt: 140, done: 320 } as const;

export function KeyboardGuard() {
  const field = useRef<TextInput>(null);
  const [inUse, setInUse] = useState(false);
  useEffect(() => registerKeyboardSink({ use: () => setInUse(true) }), []);
  useEffect(() => {
    if (!inUse) return undefined;
    const focus = setTimeout(() => field.current?.focus(), SINK_USE_MS.focusAt);
    const blur = setTimeout(() => field.current?.blur(), SINK_USE_MS.blurAt);
    const done = setTimeout(() => setInUse(false), SINK_USE_MS.done);
    return () => {
      clearTimeout(focus);
      clearTimeout(blur);
      clearTimeout(done);
    };
  }, [inUse]);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const clear = () => {
      if (timer !== null) clearTimeout(timer);
      timer = null;
    };
    const look = () => {
      // An owned keyboard is looked at again; one that was hidden (or cannot be) is not chased.
      timer = checkShownKeyboard() === 'owned' ? setTimeout(look, KEYBOARD_WATCH_MS) : null;
    };
    const shown = KeyboardEvents.addListener('keyboardDidShow', () => {
      clear();
      timer = setTimeout(look, KEYBOARD_ORPHAN_CHECK_MS);
    });
    const hidden = KeyboardEvents.addListener('keyboardDidHide', clear);
    return () => {
      clear();
      shown?.remove?.();
      hidden?.remove?.();
    };
  }, []);
  return (
    <TextInput
      ref={field}
      testID="keyboard-sink"
      style={styles.sink}
      // Focusable only while in use: an always-focusable field is where the platform parks the focus of stray keys.
      editable={inUse}
      focusable={inUse}
      value=""
      showSoftInputOnFocus={false}
      caretHidden
      contextMenuHidden
      autoCorrect={false}
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
      pointerEvents="none"
    />
  );
}

const styles = StyleSheet.create({
  sink: { position: 'absolute', left: -4, top: -4, width: 1, height: 1, padding: 0, opacity: 0 },
});
