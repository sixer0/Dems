import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  DATE_PATTERNS,
  EMPTY_DATE_TEXT,
  formatClock,
  formatDate,
  formatDuration,
  formatUtcOffset,
} from '../src/realtime/format';

const FORMAT_SOURCE = join(dirname(fileURLToPath(import.meta.url)), '../src/realtime/format.ts');

describe('formatClock', () => {
  it('formats at UTC+07:00 by default', () => {
    expect(formatClock('2026-09-30T16:41:05.000Z')).toBe('23:41:05');
    expect(formatClock('2026-09-30T17:00:00.000Z')).toBe('00:00:00');
  });
  it('honours an explicit offset and handles missing or invalid input', () => {
    expect(formatClock('2026-09-30T16:41:05.000Z', 0)).toBe('16:41:05');
    expect(formatClock(null)).toBe('--:--:--');
    expect(formatClock('nope')).toBe('--:--:--');
  });
  it('accepts the sim clock epoch milliseconds and Date objects', () => {
    const ms = Date.parse('2026-09-30T16:41:05.000Z');
    expect(formatClock(ms)).toBe('23:41:05');
    expect(formatClock(new Date(ms))).toBe('23:41:05');
    expect(formatClock(Number.NaN)).toBe('--:--:--');
  });
});

describe('formatDate (arithmetic, UTC+07:00 by default; SCR-05)', () => {
  it('formats the top-bar date "ddd, D MMM YYYY" at UTC+07:00', () => {
    // 17:00Z on 30 Sep is midnight on Thursday 1 Oct in WIB.
    expect(formatDate('2026-09-30T17:00:00.000Z')).toBe('Thu, 1 Oct 2026');
    expect(formatDate('2026-09-30T16:59:59.999Z')).toBe('Wed, 30 Sep 2026');
    expect(formatDate('2026-10-01T07:27:32.000Z', DATE_PATTERNS.weekdayDate)).toBe('Thu, 1 Oct 2026');
  });

  it('formats every named pattern', () => {
    const iso = '2026-10-01T07:08:50.000Z'; // 14:08:50 WIB
    expect(formatDate(iso, DATE_PATTERNS.date)).toBe('1 Oct 2026');
    expect(formatDate(iso, DATE_PATTERNS.dateTime)).toBe('1 Oct 2026 14:08:50');
    expect(formatDate(iso, DATE_PATTERNS.dateTimeMinutes)).toBe('1 Oct 2026 14:08');
    expect(formatDate(iso, DATE_PATTERNS.time)).toBe('14:08:50');
    expect(formatDate(iso, DATE_PATTERNS.timeMinutes)).toBe('14:08');
    expect(formatDate(iso, DATE_PATTERNS.dayKey)).toBe('2026-10-01');
    expect(formatDate(iso, DATE_PATTERNS.compact)).toBe('20261001');
    expect(formatDate(iso, DATE_PATTERNS.zone)).toBe('UTC+07:00');
    expect(formatDate(iso, 'dddd, DD MMMM YYYY')).toBe('Thursday, 01 October 2026');
    expect(formatDate(iso, '[SES-]YYYYMMDD[-0017]')).toBe('SES-20261001-0017');
    expect(formatDate(iso, DATE_PATTERNS.time)).toBe(formatClock(iso));
  });

  it('rolls day, month, year and leap day correctly at the offset', () => {
    expect(formatDate('2025-12-31T17:00:00.000Z', DATE_PATTERNS.dateTime)).toBe('1 Jan 2026 00:00:00');
    expect(formatDate('2025-12-31T16:59:59.000Z', DATE_PATTERNS.dateTime)).toBe('31 Dec 2025 23:59:59');
    expect(formatDate('2028-02-28T17:30:00.000Z', 'ddd, D MMM YYYY HH:mm')).toBe('Tue, 29 Feb 2028 00:30');
    expect(formatDate('2026-02-28T17:30:00.000Z', DATE_PATTERNS.date)).toBe('1 Mar 2026');
  });

  it('treats ISO strings, epoch milliseconds and Date objects alike', () => {
    const iso = '2026-10-01T07:27:32.000Z';
    const ms = Date.parse(iso);
    const expected = '1 Oct 2026 14:27:32';
    expect(formatDate(iso, DATE_PATTERNS.dateTime)).toBe(expected);
    expect(formatDate(ms, DATE_PATTERNS.dateTime)).toBe(expected);
    expect(formatDate(new Date(ms), DATE_PATTERNS.dateTime)).toBe(expected);
    expect(formatDate('2026-10-01T14:27:32+07:00', DATE_PATTERNS.dateTime)).toBe(expected);
  });

  it('honours other offsets, including negative and half-hour ones', () => {
    const iso = '2026-10-01T07:27:32.000Z';
    expect(formatDate(iso, 'D MMM YYYY HH:mm Z', 0)).toBe('1 Oct 2026 07:27 +00:00');
    expect(formatDate(iso, 'D MMM YYYY HH:mm Z', 330)).toBe('1 Oct 2026 12:57 +05:30');
    expect(formatDate(iso, 'D MMM YYYY HH:mm Z', -600)).toBe('30 Sep 2026 21:27 -10:00');
  });

  it('returns the empty-date text for missing or invalid input', () => {
    expect(EMPTY_DATE_TEXT).toBe('—');
    expect(formatDate(null)).toBe('—');
    expect(formatDate(undefined)).toBe('—');
    expect(formatDate('')).toBe('—');
    expect(formatDate('not a date')).toBe('—');
    expect(formatDate(Number.NaN)).toBe('—');
    expect(formatDate(new Date(Number.NaN))).toBe('—');
    expect(formatDate(8.64e15, DATE_PATTERNS.date)).toBe('—'); // valid instant, but shifting leaves the Date range
  });

  it('agrees with the ICU time-zone database for Asia/Jakarta (oracle used in the test only)', () => {
    // Jakarta has been UTC+07:00 without DST since 1964; sample 1970..2100 with a fixed LCG.
    const oracle = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Jakarta',
      weekday: 'short',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    });
    const from = Date.parse('1970-01-01T00:00:00Z');
    const span = Date.parse('2100-01-01T00:00:00Z') - from;
    let seed = 20261001;
    for (let i = 0; i < 2000; i += 1) {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      const ms = from + Math.floor((seed / 4294967296) * span);
      const parts = Object.fromEntries(oracle.formatToParts(ms).map((p) => [p.type, p.value]));
      const expected = `${parts.weekday} ${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}:${parts.second}`;
      expect(formatDate(ms, 'ddd YYYY-MM-DD HH:mm:ss'), new Date(ms).toISOString()).toBe(expected);
    }
  });

  it('format.ts uses no ECMA-402 API, so Hermes and browsers print the same text', () => {
    const source = readFileSync(FORMAT_SOURCE, 'utf8');
    expect(source).not.toMatch(/\bIntl\b/);
    expect(source).not.toMatch(/toLocale(Date|Time)?String/);
  });
});

describe('formatUtcOffset', () => {
  it('prints signed hours and minutes', () => {
    expect(formatUtcOffset()).toBe('+07:00');
    expect(formatUtcOffset(0)).toBe('+00:00');
    expect(formatUtcOffset(330)).toBe('+05:30');
    expect(formatUtcOffset(-330)).toBe('-05:30');
  });
});

describe('formatDuration', () => {
  it('formats elapsed time as HH:mm:ss', () => {
    expect(formatDuration(0)).toBe('00:00:00');
    expect(formatDuration((18 * 60 + 42) * 1000)).toBe('00:18:42');
    expect(formatDuration((18 * 60 + 42) * 1000 + 999)).toBe('00:18:42');
    expect(formatDuration((123 * 3600 + 4 * 60 + 5) * 1000)).toBe('123:04:05');
  });
  it('clamps negatives and rejects non-finite input', () => {
    expect(formatDuration(-5000)).toBe('00:00:00');
    expect(formatDuration(Number.NaN)).toBe('--:--:--');
    expect(formatDuration(Number.POSITIVE_INFINITY)).toBe('--:--:--');
  });
});
