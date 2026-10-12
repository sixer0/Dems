/**
 * How the Evidence list and the Sessions hub hold their place when rows are added (fix wave Q: CP-01, CT-02,
 * keeping JM-03 of fix wave J).
 *
 * JM-03 (wave J): a just-sealed item was in the list's data ONE ROW ABOVE the viewport - FlashList keeps the
 * visible content in place when rows are inserted before it. Wave J answered with `{ disabled: true }`.
 *
 * CP-01 / CT-02 (the confirmation, reproduced on the phone in the normal launch form, note 176): with the keeping
 * of the position DISABLED the list has no scroll anchor and corrects its offset itself while it measures its
 * rows; on the first opening after a sign-in (the rows arrive while the list still measures) and after a filter
 * change the rows were laid out wrong and stayed so - rows over one another, a gap after the first row, on
 * Sessions the first row over "Start New Session" and the search field. With the default (the anchor in place)
 * the same openings laid out correctly.
 *
 * Both hold with the list's own option for exactly this case: the position is kept (so the anchor exists and
 * the first layout is right), and when rows are added at the top while the reader IS at the top - within
 * `NEW_ROW_AUTOSCROLL_PX` of it - the list scrolls to its top, so the new row is the first row without a pull.
 * A reader who has scrolled further down is not moved.
 */
import { useEffect, useRef } from 'react';

export const NEW_ROW_AUTOSCROLL_PX = 96;

/** `maintainVisibleContentPosition` of both lists. Never `disabled` (see above). */
export const LIST_KEEP_POSITION = { autoscrollToTopThreshold: NEW_ROW_AUTOSCROLL_PX } as const;

/**
 * A list starts at its top after its query changed (fix wave Q, found while re-proving JM-03 on the tablet: after a
 * search for one old item was cleared the list stood at THAT item - the keeping of the position held it in view -
 * near the end of 80 rows, and the just-sealed item, the first row, was a long scroll away). A filter, a search or
 * a sort is a new question: its answer is read from the top. Returns the ref to hand to the list.
 */

interface ScrollsToTop {
  scrollToIndex(params: { index: number; animated?: boolean }): unknown;
}

/**
 * `queryKey`: what the list was asked (its search text, its filter). `rowCount`: how many rows answer - an empty
 * list has no first row to go to. The move goes through the list's own "scroll to a row" (first tried with a plain
 * scroll to offset 0: the rows were not drawn until the next touch - the list did not learn of the move).
 */
export function useTopOnQueryChange<T extends ScrollsToTop>(queryKey: string, rowCount: number) {
  const ref = useRef<T>(null);
  const first = useRef(true);
  const rows = useRef(rowCount);
  useEffect(() => {
    rows.current = rowCount;
  }, [rowCount]);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return undefined;
    }
    // After the list has taken the new rows (this effect runs in the commit that changed the query).
    const frame = requestAnimationFrame(() => {
      if (rows.current < 1) return;
      try {
        const moved = ref.current?.scrollToIndex({ index: 0, animated: false });
        if (moved instanceof Promise) moved.catch(() => undefined);
      } catch {
        // A list that is not laid out yet starts at its top anyway.
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [queryKey]);
  return ref;
}
