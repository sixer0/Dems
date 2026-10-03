/**
 * Display-time formatting shared by both apps (web and mobile).
 *
 * Everything here is plain integer arithmetic on epoch milliseconds plus the `Date` UTC
 * getters. It never consults a time-zone database or an ECMA-402 locale service, so the
 * output is identical in browsers, Node and Hermes (SCR-05; 04_mobile_specs §9, H-MB-08).
 * The display zone is a fixed offset, UTC+07:00 (WIB, no daylight saving; D28/Q2).
 */

/** Demo display offset: UTC+07:00 (WIB, no DST; D28). */
export const DISPLAY_UTC_OFFSET_MINUTES = 420;

/** What `formatDate` returns for a missing or unparseable instant. */
export const EMPTY_DATE_TEXT = '—';

/** An instant: ISO-8601 string, epoch milliseconds (the sim clock's `now()`), or a `Date`. */
export type DateInput = string | number | Date | null | undefined;

/**
 * Named patterns used by the UI (01_specs §14.4, research/04 §3.2 M and §5.1).
 * Tokens are listed on `formatDate`.
 */
export const DATE_PATTERNS = {
  /** Top bar and system-time hero: "Thu, 1 Oct 2026". */
  weekdayDate: 'ddd, D MMM YYYY',
  /** "1 Oct 2026". */
  date: 'D MMM YYYY',
  /** Session details, evidence ranges: "1 Oct 2026 14:08:50". */
  dateTime: 'D MMM YYYY HH:mm:ss',
  /** Security, Time & Network panel: "1 Oct 2026 14:27". */
  dateTimeMinutes: 'D MMM YYYY HH:mm',
  /** "14:08:50" (same output as `formatClock`). */
  time: 'HH:mm:ss',
  /** "14:08". */
  timeMinutes: 'HH:mm',
  /** Day grouping key for event lists: "2026-10-01". */
  dayKey: 'YYYY-MM-DD',
  /** Compact date used inside synthetic IDs (SES-{YYYYMMDD}-…): "20261001". */
  compact: 'YYYYMMDD',
  /** Zone label: "UTC+07:00". */
  zone: '[UTC]Z',
} as const;

export type DatePatternName = keyof typeof DATE_PATTERNS;

const MONTHS_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
] as const;
const MONTHS_LONG = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
] as const;
const WEEKDAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
const WEEKDAYS_LONG = [
  'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday',
] as const;

/** Longest tokens first, so `MMMM` wins over `MMM` and `dddd` over `ddd`. `[...]` is literal text. */
const TOKEN_PATTERN = /\[([^\]]*)]|YYYY|MMMM|MMM|MM|DD|D|dddd|ddd|HH|mm|ss|Z/g;

function pad2(value: number): string {
  return value < 10 ? `0${value}` : String(value);
}

function pad4(value: number): string {
  const text = String(Math.abs(value));
  const padded = text.length >= 4 ? text : `${'0000'.slice(text.length)}${text}`;
  return value < 0 ? `-${padded}` : padded;
}

/** Epoch milliseconds of an input, or `null` when it is missing or not a valid instant. */
function toEpochMs(input: DateInput): number | null {
  if (input === null || input === undefined || input === '') return null;
  const ms =
    typeof input === 'number' ? input : typeof input === 'string' ? Date.parse(input) : input.getTime();
  return Number.isFinite(ms) ? ms : null;
}

/** `+07:00` style offset text for a whole-minute offset (negative offsets give `-05:30`). */
export function formatUtcOffset(offsetMinutes: number = DISPLAY_UTC_OFFSET_MINUTES): string {
  const sign = offsetMinutes < 0 ? '-' : '+';
  const abs = Math.abs(Math.trunc(offsetMinutes));
  return `${sign}${pad2(Math.floor(abs / 60))}:${pad2(abs % 60)}`;
}

/** `HH:mm:ss` of an instant at a fixed UTC offset; `--:--:--` when absent or invalid. */
export function formatClock(
  iso: DateInput,
  offsetMinutes: number = DISPLAY_UTC_OFFSET_MINUTES,
): string {
  const ms = toEpochMs(iso);
  if (ms === null) return '--:--:--';
  const shifted = new Date(ms + offsetMinutes * 60_000);
  if (Number.isNaN(shifted.getTime())) return '--:--:--';
  return `${pad2(shifted.getUTCHours())}:${pad2(shifted.getUTCMinutes())}:${pad2(shifted.getUTCSeconds())}`;
}

/**
 * Formats an instant at a fixed UTC offset (default UTC+07:00) with English month and
 * weekday names. Returns `EMPTY_DATE_TEXT` when the input is absent or invalid.
 *
 * Tokens: `YYYY` year · `MMMM` October · `MMM` Oct · `MM` 10 · `DD` 01 · `D` 1 ·
 * `dddd` Thursday · `ddd` Thu · `HH` 00-23 · `mm` minutes · `ss` seconds ·
 * `Z` offset (+07:00) · `[text]` literal text. Any other character is copied as is.
 *
 * @example formatDate('2026-09-30T17:00:00Z') // "Thu, 1 Oct 2026"
 * @example formatDate(sim.clock.now(), DATE_PATTERNS.dateTime) // "1 Oct 2026 14:08:50"
 */
export function formatDate(
  input: DateInput,
  pattern: string = DATE_PATTERNS.weekdayDate,
  offsetMinutes: number = DISPLAY_UTC_OFFSET_MINUTES,
): string {
  const ms = toEpochMs(input);
  if (ms === null) return EMPTY_DATE_TEXT;
  // Shift the instant by the offset, then read it back with the UTC getters: the fields
  // are the wall-clock fields at that offset.
  const shifted = new Date(ms + offsetMinutes * 60_000);
  if (Number.isNaN(shifted.getTime())) return EMPTY_DATE_TEXT;
  const year = shifted.getUTCFullYear();
  const month = shifted.getUTCMonth();
  const day = shifted.getUTCDate();
  const weekday = shifted.getUTCDay();

  return pattern.replace(TOKEN_PATTERN, (token: string, literal: string | undefined) => {
    if (literal !== undefined) return literal;
    switch (token) {
      case 'YYYY':
        return pad4(year);
      case 'MMMM':
        return MONTHS_LONG[month] ?? '';
      case 'MMM':
        return MONTHS_SHORT[month] ?? '';
      case 'MM':
        return pad2(month + 1);
      case 'DD':
        return pad2(day);
      case 'D':
        return String(day);
      case 'dddd':
        return WEEKDAYS_LONG[weekday] ?? '';
      case 'ddd':
        return WEEKDAYS_SHORT[weekday] ?? '';
      case 'HH':
        return pad2(shifted.getUTCHours());
      case 'mm':
        return pad2(shifted.getUTCMinutes());
      case 'ss':
        return pad2(shifted.getUTCSeconds());
      case 'Z':
        return formatUtcOffset(offsetMinutes);
      default:
        return token;
    }
  });
}

/**
 * Elapsed time as `HH:mm:ss` (hours grow past 99 instead of wrapping), for session timers
 * such as "00:18:42". Negative input clamps to zero; a non-finite input gives `--:--:--`.
 */
export function formatDuration(ms: number): string {
  if (!Number.isFinite(ms)) return '--:--:--';
  const totalSeconds = Math.floor(Math.max(0, ms) / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${pad2(hours)}:${pad2(minutes)}:${pad2(seconds)}`;
}
