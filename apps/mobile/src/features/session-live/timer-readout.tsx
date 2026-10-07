/**
 * The monitor's HH:MM:SS readout, drawn by React (closing-fix row CF-M1, defect R-P-2's "timer running
 * backwards"; decision D214).
 *
 * ## What the device showed, and why
 *
 * The monitor timer and the REC chip of the feed used the C-6 `RollingNumber` in `slide` mode: every
 * digit is a column of cells whose position (`translateY`) lives ONLY in a Reanimated shared value; React
 * holds the position of the digit the column was mounted with. Reanimated 4.5.1 hands settled animated
 * props back to React from a 500 ms JS interval, and its native side first DROPS every settled update
 * older than 2 s before collecting the ones older than 1 s (`ReanimatedModuleProxy::getSettledUpdates`,
 * `AnimatedPropsRegistry::getUpdatesOlderThanTimestamp`: remove, then collect). A JS stall of 1-2 s
 * right after a digit settles therefore loses that digit's final position; the next React commit of the
 * column re-applies React's own value, the digit it was mounted with. On the phone:
 *
 * - R-P-2 (monitor mounted at 00:00:0x): the tens column showed 0 again after the stall, so 14, 17, 18
 *   read 04, 07, 08 until the next tens change (20) moved it;
 * - R-P-1 (monitor mounted at 00:03:13): the tens column showed 1 again, 04:24 read 04:12;
 * - reproduced on dems2_phone with a 3.5 s Hermes-inspector stall: 03:28, then 03:23 (the ones column
 *   back on 3, the digit of its mount), in the monitor timer and in the REC chip alike.
 *
 * The clock itself never went backwards (the feed's burnt-in time in the same frames runs on; the Live
 * clock never moves back, `@dems/shared/live` `clock.ts`).
 *
 * ## This readout
 *
 * CF-M1 drew each digit column with React (the current digit's cell in the view's own props; the roll an
 * extra offset whose rest value is 0). Post-review fix FXR-M (finding W93-3) moved that layout into the
 * kit's `RollingNumber` itself, so every readout of the app gets it (the bottom Recording bar, the Home
 * and System Time clocks, the hub timer and the counters). This readout is now `RollingNumber` with the
 * duration format; it keeps its name and props for the monitor and the feed's REC chip.
 */
import { palette, type TypographyToken } from '@dems/shared/tokens';
import { RollingNumber } from '@/components/composed/rolling-number';
import { rollCells } from '@/components/composed/rolling-number.math';

const DURATION = { kind: 'duration' } as const;

/** The cell a column shows for `digit` after showing cell `fromCell`: the same digit in 0..19, always forward (odometer). */
export function nextCell(fromCell: number, digit: number): number {
  return rollCells(fromCell, digit, true).to;
}

export interface TimerReadoutProps {
  /** Whole seconds since the recording started. */
  seconds: number;
  /** Motion policy from `useMotionPolicy()`: `full` rolls the digits that change, `reduced` changes them in place. */
  motion: 'full' | 'reduced';
  size?: TypographyToken;
  color?: string;
  testID?: string;
}

export function TimerReadout({ seconds, motion, size = 'display', color = palette.foreground, testID }: TimerReadoutProps) {
  return (
    <RollingNumber
      value={Math.max(0, Math.floor(seconds))}
      mode="slide"
      format={DURATION}
      motion={motion}
      size={size}
      face={size === 'display' ? 'display' : 'mono'}
      color={color}
      {...(testID ? { testID } : {})}
    />
  );
}
