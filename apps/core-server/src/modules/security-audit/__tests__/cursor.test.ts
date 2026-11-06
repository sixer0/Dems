// The cursors of the audit list and of the events (plan row W39; spec §7.1 API-9; contract
// `LIST_CURSOR_PATTERN`). Pure: no database.
import { LIST_CURSOR_PATTERN, SESSION_TOKEN_PATTERN } from '@dems/shared/api';
import { auditId, eventId } from '@dems/shared/sim';
import { describe, expect, it } from 'vitest';
import { AUDIT_CURSOR_MARK_LENGTH, decodeAuditCursor, decodeEventCursor, encodeAuditCursor, encodeEventCursor } from '../cursor';

const HASH = '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08';
const MARK = HASH.slice(0, 16);

describe('the audit cursor: the row it stands on, by its ID and the first digits of its hash', () => {
  it('is the row ID and 16 digits of the hash, and decodes to the sequence and that mark', () => {
    expect(AUDIT_CURSOR_MARK_LENGTH).toBe(16);
    expect(encodeAuditCursor({ seq: 150, hash: HASH })).toBe(`AUD-000150-${MARK}`);
    expect(decodeAuditCursor(`AUD-000150-${MARK}`)).toEqual({ seq: 150, mark: MARK });
  });

  it('round-trips the first row, the last six-digit row, and rows whose ID is longer than six digits', () => {
    for (const seq of [1, 9, 82, 5_000, 999_999, 1_000_000, 12_345_678, 999_999_999_999_999]) {
      const cursor = encodeAuditCursor({ seq, hash: HASH });
      expect(cursor.startsWith(`${auditId(seq)}-`)).toBe(true);
      expect(decodeAuditCursor(cursor)).toEqual({ seq, mark: MARK });
      expect(cursor).toMatch(LIST_CURSOR_PATTERN);
    }
  });

  it('fits the contract pattern at its longest, has no underscore, and is never a bearer value', () => {
    const longest = encodeAuditCursor({ seq: 999_999_999_999_999, hash: HASH });
    expect(longest.length).toBeLessThanOrEqual(128);
    expect(longest).not.toContain('_');
    expect(SESSION_TOKEN_PATTERN.test(longest)).toBe(false);
  });

  it('refuses every value this server never gave out', () => {
    const refused = [
      '',
      '150',
      'AUD-000150',
      `AUD-000150-${MARK}0`, // 17 digits
      `AUD-000150-${MARK.slice(1)}`, // 15 digits
      `AUD-000150-${MARK.toUpperCase()}`, // upper-case digits
      `AUD-000150-${'g'.repeat(16)}`, // not hexadecimal
      `AUD-0000150-${MARK}`, // not the ID the shared code gives sequence 150: two texts for one row
      `AUD-150-${MARK}`, // fewer than six digits
      `AUD-000000-${MARK}`, // sequence 0: no row
      `AUD-9999999999999999-${MARK}`, // 16 digits: beyond the form
      `aud-000150-${MARK}`,
      `LOG-000150-${MARK}`, // the other list's prefix
      `AUD-000150-${MARK}-x`,
      ` AUD-000150-${MARK}`,
      `AUD-000150-${MARK}\n`,
      'LOG-000150-1790823600000', // an event cursor
      "AUD-000150-' OR 1=1 --",
      'AUD-000150-0000000000000000; DROP',
    ];
    for (const value of refused) expect(decodeAuditCursor(value), JSON.stringify(value)).toBeNull();
  });

  it('a sequence above the largest safe integer is refused, not rounded', () => {
    expect(decodeAuditCursor(`AUD-9007199254740993-${MARK}`)).toBeNull();
    expect(decodeAuditCursor(`AUD-900719925474099-${MARK}`)).toEqual({ seq: 900_719_925_474_099, mark: MARK });
  });
});

describe('the event cursor: the event it stands on, by its ID and its instant', () => {
  it('is the event ID and the instant, and decodes to both', () => {
    expect(encodeEventCursor({ seq: 59, at: 1_790_823_600_000 })).toBe('LOG-000059-1790823600000');
    expect(decodeEventCursor('LOG-000059-1790823600000')).toEqual({ seq: 59, at: 1_790_823_600_000 });
  });

  it('round-trips, also the instant 0, and fits the contract pattern', () => {
    for (const [seq, at] of [
      [1, 0],
      [3_649, 1_790_823_600_000],
      [1_000_000, 9_007_199_254_740_991],
    ] as const) {
      const cursor = encodeEventCursor({ seq, at });
      expect(cursor.startsWith(`${eventId(seq)}-`)).toBe(true);
      expect(decodeEventCursor(cursor)).toEqual({ seq, at });
      expect(cursor).toMatch(LIST_CURSOR_PATTERN);
    }
  });

  it('refuses every value this server never gave out', () => {
    const refused = [
      '',
      '59',
      'LOG-000059',
      'LOG-000059-',
      'LOG-000059-01790823600000', // a leading zero: two texts for one instant
      'LOG-0000059-1790823600000', // not the ID of sequence 59
      'LOG-000000-1790823600000', // sequence 0
      'LOG-000059--1', // a negative instant
      'LOG-000059-1.5',
      'LOG-000059-1e3',
      'LOG-000059-99999999999999999', // 17 digits
      'LOG-000059-9007199254740993', // not a safe integer
      `AUD-000059-${MARK}`, // an audit cursor
      'AUD-000059-1790823600000',
      'LOG-000059-1790823600000-x',
      'log-000059-1790823600000',
    ];
    for (const value of refused) expect(decodeEventCursor(value), JSON.stringify(value)).toBeNull();
  });

  it('neither list takes the other list\'s cursor, even when the mark of an audit cursor is all decimal digits', () => {
    const decimalMark = '1234567890123456';
    const audit = encodeAuditCursor({ seq: 7, hash: decimalMark + HASH.slice(16) });
    expect(decodeAuditCursor(audit)).toEqual({ seq: 7, mark: decimalMark });
    expect(decodeEventCursor(audit)).toBeNull();
    expect(decodeAuditCursor(encodeEventCursor({ seq: 7, at: 1_234_567_890_123_456 }))).toBeNull();
  });
});
