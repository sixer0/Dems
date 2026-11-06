/**
 * C-6 RollingNumber maths (04_mobile_specs §4.0, §7.4 M-C-02; 03_motion_spec M-C-02, App. A):
 * deterministic formatting (no `Intl`, H-MB-08), digit extraction for the per-digit columns and
 * the odometer roll plan. Worklet-safe: the columns evaluate these on the UI thread.
 */
import { motion, type SpringToken } from '@dems/shared/tokens';

export type RollingFormat =
  | { kind: 'integer'; minDigits?: number }
  | { kind: 'decimal'; decimals: number; minIntDigits?: number }
  /** Elapsed seconds → `HH:MM:SS` (session timer, MB 4 "00:24:18"). */
  | { kind: 'duration' }
  /** Seconds of the local day → `HH:MM:SS` (system clock, MB 9 "14:27:32"); wraps at 24 h. */
  | { kind: 'clock' }
  /** Seconds → `MM:SS` (lockout countdown). */
  | { kind: 'countdown' };

export const INTEGER: RollingFormat = { kind: 'integer' };

const tokenSprings = motion.spring as Readonly<Record<string, SpringToken | undefined>>;
/** 03M §2.3 `counter` spring; the shared token wins once step 30 publishes it (SCR-07 fallback). */
export const COUNTER_SPRING: SpringToken = tokenSprings.counter ?? { stiffness: 90, damping: 20, mass: 1 };
/** Per-digit slide (03M M-C-02: 240 ms `standard`). */
export const SLIDE_MS = motion.duration.base;
/** R4 held beat before a KPI counts up after its card lands. */
export const HELD_BEAT_MS = 120;

function pad(value: number, width: number): string {
  'worklet';
  let s = String(Math.floor(Math.abs(value)));
  while (s.length < width) s = `0${s}`;
  return s;
}

function hms(total: number): string {
  'worklet';
  const t = Math.max(0, Math.floor(total));
  return `${pad(Math.floor(t / 3600), 2)}:${pad(Math.floor(t / 60) % 60, 2)}:${pad(t % 60, 2)}`;
}

/** Formats `value` for display. Non-finite values render as zero. */
export function formatRolling(value: number, format: RollingFormat): string {
  'worklet';
  const v = Number.isFinite(value) ? value : 0;
  switch (format.kind) {
    case 'duration':
      return hms(v);
    case 'clock':
      return hms(((Math.floor(v) % 86400) + 86400) % 86400);
    case 'countdown': {
      const t = Math.max(0, Math.ceil(v));
      return `${pad(Math.floor(t / 60), 2)}:${pad(t % 60, 2)}`;
    }
    case 'decimal': {
      const factor = Math.pow(10, format.decimals);
      const scaled = Math.round(Math.abs(v) * factor);
      const int = Math.floor(scaled / factor);
      const frac = scaled - int * factor;
      const sign = v < 0 && scaled > 0 ? '-' : '';
      const body = format.decimals > 0 ? `${pad(int, format.minIntDigits ?? 1)}.${pad(frac, format.decimals)}` : pad(int, format.minIntDigits ?? 1);
      return `${sign}${body}`;
    }
    default: {
      const r = Math.round(v);
      const sign = r < 0 ? '-' : '';
      return `${sign}${pad(r, format.minDigits ?? 1)}`;
    }
  }
}

/** Shape of a formatted string: digits become `d`, everything else stays (`dd:dd:dd`, `d.d`). */
export function templateOf(text: string): string {
  'worklet';
  let out = '';
  for (let i = 0; i < text.length; i += 1) {
    const code = text.charCodeAt(i);
    out += code >= 48 && code <= 57 ? 'd' : text.charAt(i);
  }
  return out;
}

/** Template implied by the format alone (used before a shared-value input has been read). */
export function baseTemplate(format: RollingFormat): string {
  return templateOf(formatRolling(0, format));
}

/**
 * Digit at a position counted from the right (1 = last character) of the formatted value, or -1
 * when that character is not a digit or does not exist. Columns are keyed from the right, so a
 * value growing from 9 to 10 keeps its units column.
 */
export function digitFromEnd(value: number, format: RollingFormat, positionFromEnd: number): number {
  'worklet';
  const s = formatRolling(value, format);
  const i = s.length - positionFromEnd;
  if (i < 0 || i >= s.length) return -1;
  const code = s.charCodeAt(i) - 48;
  return code >= 0 && code <= 9 ? code : -1;
}

/** Cells per digit column: 0-9 twice, so any wrap can roll in its natural direction. */
export const COLUMN_CELLS = 20;

/**
 * Odometer plan on a column of 20 cells (0-9, then 0-9 again), in cell units. Counting up across
 * the 9 → 0 wrap rolls forward into the second decade and settles back on the first; counting down
 * across 0 → 9 jumps into the second decade first and rolls back. Otherwise it slides straight.
 * "Up" is the shorter way round (at most 5 steps), which suits timers and clocks.
 */
export interface RollPlan {
  /** Cell to jump to before animating, if any. */
  from: number | null;
  /** Cell to animate to. */
  to: number;
  /** Cell to jump to after the animation, if any. */
  settle: number | null;
}

export function rollPlan(previous: number, next: number): RollPlan {
  'worklet';
  if (previous === next || previous < 0) return { from: null, to: next, settle: null };
  const forward = (next - previous + 10) % 10;
  const countingUp = forward > 0 && forward <= 5;
  if (countingUp && next < previous) return { from: null, to: next + 10, settle: next };
  if (!countingUp && next > previous) return { from: previous + 10, to: next, settle: null };
  return { from: null, to: next, settle: null };
}

/**
 * One roll of a React-positioned digit column (post-review fix FXR-M, finding W93-3; the D214 recipe of
 * the monitor timer, now the kit's own): the column shows cell `fromCell` and must show `digit`.
 * `to` is the cell React keeps in the column's own props (the rest position, 0..19, always the new
 * digit); `from` is the cell the roll starts from (the previous digit, in the first or second decade).
 *
 * - `forward` (timers and clocks): always rolls up, the way time runs, across the 9 → 0 wrap into the
 *   second decade (a jump after a stall never rolls backwards);
 * - otherwise the shorter way round (`rollPlan`'s rule): up by at most 5 steps, else down from the
 *   second decade.
 */
export function rollCells(fromCell: number, digit: number, forward: boolean): { from: number; to: number } {
  const previous = ((fromCell % 10) + 10) % 10;
  const up = (digit - previous + 10) % 10;
  if (forward || up <= 5) return { from: previous, to: previous + up };
  return { from: previous + 10, to: previous + up };
}

/** Whether a format only ever counts up (timers and clocks): its digit columns roll forward only. */
export function rollsForward(format: RollingFormat): boolean {
  return format.kind === 'duration' || format.kind === 'clock';
}

/**
 * Decimal place of each template character (`null` for separators): `dd.d` → [1, 0, null, -1].
 * Used by `count` mode, whose columns are continuous drums.
 */
export function placesOf(template: string): (number | null)[] {
  const dot = template.indexOf('.');
  const end = dot === -1 ? template.length : dot;
  return template.split('').map((ch, i) => {
    if (ch !== 'd') return null;
    return i < end ? end - 1 - i : dot - i;
  });
}

/**
 * Drum position (in cells, 0 ≤ p < 10) of the column for `place` while a counter animates through
 * `value`: every column turns continuously, like a mechanical counter; settled values are exact.
 */
export function drumPosition(value: number, place: number): number {
  'worklet';
  const scaled = Math.abs(value) / Math.pow(10, place);
  const p = scaled - Math.floor(scaled / 10) * 10;
  return p >= 9.9995 ? 0 : p;
}
