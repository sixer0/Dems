/**
 * The soft keyboard's ONE rule (fix wave J, JT-23 / JM-04; fix wave Q, JT-23 original, CT-06, CP-02, CP-13):
 *
 *   1. opening or closing a sheet, closing a dialog that holds a field, and leaving a screen blur the focused
 *      field and put the keyboard away (`putKeyboardAway`: `@/lib/sheet-open`, the root navigator, the dialogs);
 *   2. a keyboard that is up while NO field of the app is focused is put away (`KeyboardGuard`, mounted once).
 *
 * Seen on the tablet (wave J): when the field that opened the keyboard is REMOVED (the export wizard's reason
 * field on "Export", the End Session reason when its dialog closes), Android hands the focus to the next field
 * of the window - the Evidence list's search field under the sheet - and keeps the keyboard up for it: a
 * keyboard with a search key over a result that has no field, covering "Done". A dismissal sent before the
 * field is gone is undone by that hand-over, so the keyboard is put away now AND once more shortly after, when
 * the removal has happened.
 *
 * Seen again in the confirmation and in wave Q's measurement (note 176): the keyboard over Session Live and
 * over the Session Summary with no field on screen (the End Session dialog closed while the keyboard was coming
 * up), and over the export result. Two reasons the wave J dismissal did not reach those:
 *
 * - `Keyboard.dismiss()` of React Native blurs the field React Native believes is focused. After the hand-over
 *   the field Android focused is one React Native did not focus (or none at all), so there is nothing to blur
 *   and the call does nothing - the judges' "ESC did not close it" is the same picture. The keyboard library's
 *   own `dismiss` asks the platform for the view that really holds the focus, and is called as well.
 * - With no focused view at all neither call has a target. The guard then uses a field of its own that never
 *   raises a keyboard (the "sink", one pixel, not reachable by touch or by a screen reader): it is focused and
 *   blurred, and blurring a field hides the keyboard of its window, whichever view it had been raised for. The
 *   sink can take the focus ONLY for that instant (it is not editable at any other time): a field that could
 *   always be focused is where the platform puts the focus when keys arrive and no field is focused - seen while
 *   building this: text sent with no field on screen went into the sink and a keyboard came up for it.
 */
import { Keyboard, TextInput } from 'react-native';
import { KeyboardController } from 'react-native-keyboard-controller';

/** The second dismissal comes this long after the first (the field's removal lies in between). */
export const KEYBOARD_AWAY_REPEAT_MS = 300;
/** A keyboard that came up is looked at this long after it did: by then a field that asked for it holds the focus. */
export const KEYBOARD_ORPHAN_CHECK_MS = 350;

/** The guard's own field (rule 2): `use` focuses and blurs it once. `null` while no guard is mounted (tests, the first frames). */
export interface KeyboardSink {
  use(): void;
}
let sink: KeyboardSink | null = null;

/** Registers the guard's field; returns the function that takes it out again. */
export function registerKeyboardSink(next: KeyboardSink): () => void {
  sink = next;
  return () => {
    if (sink === next) sink = null;
  };
}

/** The field React Native holds as focused, or null. Never throws. */
export function focusedField(): unknown {
  try {
    return TextInput.State.currentlyFocusedInput?.() ?? null;
  } catch {
    return null;
  }
}

function keyboardIsUp(): boolean {
  try {
    return KeyboardController.isVisible?.() === true || Keyboard.isVisible?.() === true;
  } catch {
    return false;
  }
}

/** Blur whatever holds the focus - React Native's field and the platform's - and hide the keyboard. Never throws. */
function dismissNow(): void {
  // When the JS world is already being taken down the platform module is gone (wave J round two: a repeat timer
  // that fired after a test had ended failed whichever test file ran next). With nothing left to dismiss: nothing.
  try {
    if (typeof Keyboard?.dismiss === 'function') Keyboard.dismiss();
    const asked: unknown = typeof KeyboardController?.dismiss === 'function' ? KeyboardController.dismiss() : undefined;
    if (asked instanceof Promise) asked.catch(() => undefined);
  } catch {
    // Nothing to dismiss.
  }
}

/**
 * Rule 2: the keyboard is up and no field of the app is focused - hide it through the guard's field. Returns
 * whether it acted. A focused field is never touched (somebody is typing).
 */
export function hideOrphanKeyboard(): boolean {
  if (sink === null || focusedField() !== null) return false;
  sink.use();
  return true;
}

/** Dismisses the keyboard now and again after `KEYBOARD_AWAY_REPEAT_MS`. Returns the function that cancels the repeat. */
export function putKeyboardAway(): () => void {
  dismissNow();
  const timer = setTimeout(() => {
    dismissNow();
    // The field is gone by now. A keyboard that is still up belongs to no field of the app.
    if (keyboardIsUp()) hideOrphanKeyboard();
  }, KEYBOARD_AWAY_REPEAT_MS);
  return () => clearTimeout(timer);
}
