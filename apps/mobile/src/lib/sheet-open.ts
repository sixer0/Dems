/**
 * A kit bottom sheet whose open is CONFIRMED (fix wave J, JM-02; round two: every sheet of the app).
 *
 * The kit asks the sheet library to slide in ONCE, when its `isOpen` turns true, and the library drops that
 * request without a word while its own first layout is not finished (`@gorhom/bottom-sheet`
 * `handleSnapToIndex`: `if (!isLayoutReady) return`). The content's `onLayout` says the CONTENT is laid out,
 * not that the library has finished measuring. A dropped request leaves the kit "open" with nothing on screen
 * and its transparent overlay over the page: the next press lands on that overlay and closes the sheet that
 * was never seen - "the button ignored me".
 *
 * Round one fixed the Evidence sheets (Play, Export). Round two found the same on the tablet in the normal
 * launch form for a sheet that was never in that frame: "Diagnostics" of a device, four presses, the Core
 * accepted two runs (202), no sheet. The rule is therefore the app's, and lives here.
 *
 * The frame checks what it asked for: the library reports the start of every slide (`onAnimate`). If no slide
 * towards an open position has started `SHEET_OPEN_CHECK_MS` after the request, the request is made again
 * (the kit's `isOpen` goes false for one frame and true again), up to `SHEET_OPEN_RETRIES` times; after that
 * the frame closes itself and records it, so a press never leaves an invisible sheet behind.
 * `kitOpen` is the `isOpen` to hand to the kit; `onAnimate` goes to `BottomSheet.Content`.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { reportRuntimeIssue } from '@/runtime';

/** How long after asking the kit to open the sheet its slide must have STARTED. */
export const SHEET_OPEN_CHECK_MS = 250;
/** How often the open is asked again before the frame gives up and closes. */
export const SHEET_OPEN_RETRIES = 6;

export interface ConfirmedOpen {
  /** The `isOpen` to hand to the kit's `BottomSheet`. */
  readonly kitOpen: boolean;
  /** For `BottomSheet.Content`: the library's report that a slide started. */
  readonly onAnimate: (fromIndex: number, toIndex: number) => void;
}

export function useConfirmedOpen(want: boolean, onGiveUp: () => void, context: { readonly testID: string }): ConfirmedOpen {
  const [pulse, setPulse] = useState<'up' | 'down'>('up');
  const [tries, setTries] = useState(0);
  const started = useRef(false);
  if (!want && (pulse !== 'up' || tries !== 0)) {
    setPulse('up');
    setTries(0);
  }
  useEffect(() => {
    if (!want) started.current = false;
  }, [want]);
  useEffect(() => {
    if (!want) return undefined;
    if (pulse === 'down') {
      const frame = requestAnimationFrame(() => setPulse('up'));
      return () => cancelAnimationFrame(frame);
    }
    const timer = setTimeout(() => {
      if (started.current) return;
      if (tries >= SHEET_OPEN_RETRIES) {
        reportRuntimeIssue('error', 'sheet.open', new Error('The sheet did not open: the sheet library accepted no request to slide in.'), {
          testID: context.testID,
          tries,
          checkMs: SHEET_OPEN_CHECK_MS,
        });
        onGiveUp();
        return;
      }
      reportRuntimeIssue('info', 'sheet.open.retry', new Error('The sheet library dropped the request to slide in; asking again.'), { testID: context.testID, tries: tries + 1 });
      setTries((n) => n + 1);
      setPulse('down');
    }, SHEET_OPEN_CHECK_MS);
    return () => clearTimeout(timer);
    // `onGiveUp` and `context` are read when the timer fires; a new closure each render must not restart it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [want, pulse, tries]);
  const onAnimate = useCallback((_fromIndex: number, toIndex: number) => {
    if (toIndex >= 0) started.current = true;
  }, []);
  return { kitOpen: want && pulse === 'up', onAnimate };
}
