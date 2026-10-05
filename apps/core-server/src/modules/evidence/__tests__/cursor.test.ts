// The cursor of the evidence list (plan row W35; spec §7.1 API-9; contract `LIST_CURSOR_PATTERN`).
// Pure: no app, no database.
import { EVIDENCE_ID_PATTERN, EvidenceListQuerySchema, EvidencePageSchema, LIST_CURSOR_PATTERN } from '@dems/shared/api';
import { describe, expect, it } from 'vitest';
import { decodeEvidenceCursor, encodeEvidenceCursor } from '../cursor';

const POSITION = { recordedAt: 1_790_823_600_000, id: 'EV-20260930-0004' } as const;

describe('the cursor of the evidence list', () => {
  it('is the recording instant and the evidence ID of the last item of a page, joined by a hyphen', () => {
    expect(encodeEvidenceCursor(POSITION)).toBe('1790823600000-EV-20260930-0004');
  });

  it('comes back as the same position, for the instants and IDs an item can have', () => {
    const instants = [0, 1, 999, 1_790_823_600_000, 4_102_444_800_000, Number.MAX_SAFE_INTEGER];
    const ids = ['EV-20260930-0004', 'EV-00000000-0000', 'EV-99991231-9999'];
    for (const recordedAt of instants) {
      for (const id of ids) {
        expect(EVIDENCE_ID_PATTERN.test(id)).toBe(true);
        const cursor = encodeEvidenceCursor({ recordedAt, id });
        expect(decodeEvidenceCursor(cursor), cursor).toEqual({ recordedAt, id });
      }
    }
  });

  it('fits the contract: the pattern of a list cursor, the query member and the answer member, at its longest too', () => {
    const longest = encodeEvidenceCursor({ recordedAt: Number.MAX_SAFE_INTEGER, id: 'EV-99991231-9999' });
    expect(longest).toHaveLength(33);
    for (const cursor of [encodeEvidenceCursor(POSITION), longest, encodeEvidenceCursor({ recordedAt: 0, id: 'EV-00000000-0000' })]) {
      expect(LIST_CURSOR_PATTERN.test(cursor)).toBe(true);
      expect(EvidenceListQuerySchema.safeParse({ cursor }).success).toBe(true);
      expect(EvidencePageSchema.safeParse({ items: [], nextCursor: cursor }).success).toBe(true);
      // No underscore: no bearer value of the server has this form (CL-6a).
      expect(cursor).not.toContain('_');
    }
  });

  it('refuses every value this list never gave out, also one that has the form of a list cursor', () => {
    const notOurs = [
      '',
      'abc',
      '42',
      'EV-20260930-0004',
      '-EV-20260930-0004',
      '1790823600000',
      '1790823600000-',
      '1790823600000-EV-20260930-004',
      '1790823600000-EV-20260930-00045',
      '1790823600000-EV-2026093-0004',
      '1790823600000-ev-20260930-0004',
      '1790823600000-SES-20260930-0004',
      '01790823600000-EV-20260930-0004',
      '00-EV-20260930-0004',
      '-1-EV-20260930-0004',
      '1.5-EV-20260930-0004',
      '1e3-EV-20260930-0004',
      '0x10-EV-20260930-0004',
      ' 1790823600000-EV-20260930-0004',
      '1790823600000-EV-20260930-0004 ',
      '1790823600000-EV-20260930-0004\n',
      '1790823600000--EV-20260930-0004',
      '1790823600000-EV-20260930-0004-EV-20260930-0005',
      // 17 digits, and 16 digits above the largest safe integer.
      '12345678901234567-EV-20260930-0004',
      '9007199254740992-EV-20260930-0004',
      '9999999999999999-EV-20260930-0004',
    ];
    for (const value of notOurs) expect(decodeEvidenceCursor(value), JSON.stringify(value)).toBeNull();
    // Several of them pass the contract's pattern: the schema stage lets them through and the handler refuses them.
    expect(notOurs.filter((value) => LIST_CURSOR_PATTERN.test(value)).length).toBeGreaterThan(10);
  });

  it('a decoded instant is always a safe integer, so the bind parameter is exact', () => {
    const edge = decodeEvidenceCursor(`${Number.MAX_SAFE_INTEGER}-EV-20260930-0004`);
    expect(edge?.recordedAt).toBe(Number.MAX_SAFE_INTEGER);
    expect(Number.isSafeInteger(edge?.recordedAt)).toBe(true);
  });
});
