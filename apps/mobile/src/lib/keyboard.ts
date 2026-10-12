/**
 * Putting the soft keyboard away (fix wave J, JT-23 / JM-04).
 *
 * Seen on the tablet: when the field that opened the keyboard is REMOVED (the export wizard's reason field on
 * "Export", the End Session reason when its dialog closes), Android hands the focus to the next field of the
 * window - the Evidence list's search field under the sheet - and keeps the keyboard up for it: a keyboard with
 * a search key over a result that has no field, covering "Done". A dismissal sent before the field is gone is
 * undone by that hand-over, so the keyboard is put away now AND once more shortly after, when the removal has
 * happened.
 */
import { Keyboard } from 'react-native';

/** The second dismissal comes this long after the first (the field's removal lies in between). */
export const KEYBOARD_AWAY_REPEAT_MS = 300;

/** Dismisses the keyboard now and again after `KEYBOARD_AWAY_REPEAT_MS`. Returns the function that cancels the repeat. */
export function putKeyboardAway(): () => void {
  Keyboard.dismiss();
  // Round two (stability): the repeat is a timer that can outlive the screen that asked for it (a caller that
  // keeps no cancel: the End Session confirm, the export submit). When the JS world is already being taken down
  // the platform module is gone - under jest that was "Cannot read properties of undefined (reading 'dismiss')"
  // thrown from a timer AFTER a test had ended, which failed whichever test file ran next in that worker (seen
  // in two files that pass alone). With nothing left to dismiss the repeat does nothing.
  const timer = setTimeout(() => {
    if (typeof Keyboard?.dismiss === 'function') Keyboard.dismiss();
  }, KEYBOARD_AWAY_REPEAT_MS);
  return () => clearTimeout(timer);
}
