import { describe, expect, it } from 'vitest';
import { formatClock } from '../src/realtime/format';

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
});
