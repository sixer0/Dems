/**
 * The "values tick after the held beat" rule for Home's numbers (04 §7.3; 03M R4), for C-6
 * RollingNumber in `slide` mode: the first render shows 0, the real value arrives once `delayMs`
 * has passed (the card has settled plus the 120 ms held beat), and the digit columns roll to it.
 * Later changes pass straight through (a new seal ticks +1 at once). Reduced motion: no hold.
 *
 * Why `slide` and not `count` (DR-S77-1 / F77-1): `count` turns every column continuously, so a
 * settled value whose lower digits are not zero shows its higher digits part-rolled (99 renders
 * as "09" on device). `slide` columns land on exact digits. Switch back once C-6 is fixed.
 */
import { useEffect, useRef, useState } from 'react';

export function useHeldValue(value: number, delayMs: number, reduced: boolean): number {
  const [released, setReleased] = useState(reduced || delayMs <= 0);
  const firstDelay = useRef(delayMs);

  useEffect(() => {
    if (released) return undefined;
    const timer = setTimeout(() => setReleased(true), firstDelay.current);
    return () => clearTimeout(timer);
  }, [released]);

  return released || reduced ? value : 0;
}
