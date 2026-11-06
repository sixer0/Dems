/**
 * Sim clock (masterplan/01_specs.md §14.7 `clock.ts`; D28/Q2 UTC+07:00).
 *
 * - `createSimClock()` starts at the real current time, so dataset dates are never stale
 *   (04 §9 #1). `speed` scales elapsed time (1× default).
 * - `createManualClock(start)` is the test mode: a frozen start that only moves on `advance`.
 * - Date helpers are plain arithmetic on a fixed offset (no `Intl` time zones), so browsers,
 *   Node and Hermes print the same strings.
 */
import { SIM_TZ, SIM_TZ_OFFSET_MINUTES } from './constants';
import type { ControllableClock, EpochMs, SimClock } from './types';

export interface SimClockOptions {
  /** Time source; default `Date.now`. */
  source?: () => number;
  /** Sim time at creation; default the source's current time. */
  startAt?: EpochMs;
  /** Multiplier on elapsed time; default 1. */
  speed?: number;
}

export function createSimClock(options: SimClockOptions = {}): SimClock {
  const source = options.source ?? (() => Date.now());
  const speed = options.speed ?? 1;
  const realStart = source();
  const simStart = options.startAt ?? realStart;
  return {
    now: () => simStart + (source() - realStart) * speed,
    tz: SIM_TZ,
    tzOffsetMinutes: SIM_TZ_OFFSET_MINUTES,
  };
}

export function createManualClock(startAt: EpochMs): ControllableClock {
  let current = startAt;
  return {
    now: () => current,
    advance(ms) {
      current += ms;
    },
    set(ms) {
      current = ms;
    },
    tz: SIM_TZ,
    tzOffsetMinutes: SIM_TZ_OFFSET_MINUTES,
  };
}

// ── Date arithmetic at UTC+07:00 ─────────────────────────────────────────────────────────

const DAY_MS = 86_400_000;
const OFFSET_MS = SIM_TZ_OFFSET_MINUTES * 60_000;

export interface WibDateParts {
  year: number;
  /** 1-12 */
  month: number;
  /** 1-31 */
  day: number;
  hour: number;
  minute: number;
  second: number;
  /** 0 = Sunday */
  weekday: number;
}

export function wibDateParts(ms: EpochMs): WibDateParts {
  const shifted = new Date(ms + OFFSET_MS);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
    hour: shifted.getUTCHours(),
    minute: shifted.getUTCMinutes(),
    second: shifted.getUTCSeconds(),
    weekday: shifted.getUTCDay(),
  };
}

function pad(value: number, width = 2): string {
  return String(value).padStart(width, '0');
}

/** Midnight (00:00 WIB) of the WIB day that contains `ms`. */
export function startOfWibDay(ms: EpochMs): EpochMs {
  return Math.floor((ms + OFFSET_MS) / DAY_MS) * DAY_MS - OFFSET_MS;
}

/** `ms` at WIB midnight `daysAgo` days before the day of `ms`, plus hours and minutes. */
export function wibDayAt(ms: EpochMs, daysAgo: number, hour: number, minute = 0): EpochMs {
  return startOfWibDay(ms) - daysAgo * DAY_MS + hour * 3_600_000 + minute * 60_000;
}

/** `YYYYMMDD` (session and evidence IDs). */
export function formatYmd(ms: EpochMs): string {
  const p = wibDateParts(ms);
  return `${p.year}${pad(p.month)}${pad(p.day)}`;
}

/** `MMDD` (case numbers `LP/{YYYY}/{MMDD}-NNNN`). */
export function formatMmdd(ms: EpochMs): string {
  const p = wibDateParts(ms);
  return `${pad(p.month)}${pad(p.day)}`;
}

/** `HH:mm:ss` at UTC+07:00. */
export function formatWibTime(ms: EpochMs): string {
  const p = wibDateParts(ms);
  return `${pad(p.hour)}:${pad(p.minute)}:${pad(p.second)}`;
}

/** `HH:MM:SS` of a duration (the session timer); negative durations clamp to zero. */
export function formatDuration(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1_000));
  const hours = Math.floor(total / 3_600);
  const minutes = Math.floor((total % 3_600) / 60);
  const seconds = total % 60;
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

/** ISO-8601 with the +07:00 offset, e.g. `2026-10-01T14:08:50.000+07:00`. */
export function toWibIso(ms: EpochMs): string {
  const p = wibDateParts(ms);
  const millis = pad(((ms % 1_000) + 1_000) % 1_000, 3);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}:${pad(p.second)}.${millis}${SIM_TZ}`;
}

/** Four-digit sequence part of an ID. */
export function formatSeq(value: number, width = 4): string {
  return pad(value, width);
}
