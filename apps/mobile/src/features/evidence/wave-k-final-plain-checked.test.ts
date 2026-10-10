// Fix wave K, final small fixes (PE-WK-46): the tablet / phone reads `files[].plainChecked` BY NAME.
// A file row that states `plainChecked: false` (the plaintext check V-05 did not run for that file)
// words its decrypted-bytes part "Not run", never "FAIL"; every other row keeps today's rule.
// The rows are the contract's own example (`VERIFY_FILE_PLAIN_NOT_CHECKED_EXAMPLE`).
import { describe, expect, it } from '@jest/globals';
import { VERIFY_FILE_PLAIN_NOT_CHECKED_EXAMPLE } from '@dems/shared/api';
import { en } from '@dems/shared/i18n';
import { readVerifyV2, v2FilePartOutcome } from './verify-v2';

const answerOf = (files: readonly unknown[]): unknown => ({ files, manifestOk: true, signatureOk: true });

describe('plainChecked of a file row (PE-WK-46)', () => {
  const [checked, notChecked] = VERIFY_FILE_PLAIN_NOT_CHECKED_EXAMPLE;
  const read = () => {
    const answer = readVerifyV2(answerOf(VERIFY_FILE_PLAIN_NOT_CHECKED_EXAMPLE));
    if (answer === null) throw new Error('not a v2 answer');
    return answer.files;
  };

  it('the contract example holds one row that was checked (the member is absent) and one that was not (false)', () => {
    expect(checked && 'plainChecked' in checked).toBe(false);
    expect(notChecked?.plainChecked).toBe(false);
  });

  it('the reader keeps the member by name: false on the row that states it, no member on the other', () => {
    const [first, second] = read();
    expect(second?.plainChecked).toBe(false);
    expect(first && 'plainChecked' in first).toBe(false);
  });

  it('a row that states plainChecked false: the decrypted bytes read Not run (with and without a check list); stored bytes and chain are as before', () => {
    const [, second] = read();
    if (!second) throw new Error('no second row');
    expect(v2FilePartOutcome(second, 'plain', null)).toBe('SKIPPED');
    expect(v2FilePartOutcome(second, 'plain', [])).toBe('SKIPPED');
    // The row's own statement wins over a check list that says the check ran (per FILE, not per result).
    expect(v2FilePartOutcome(second, 'plain', [{ id: 'V-05', status: 'FAIL' }])).toBe('SKIPPED');
    expect(v2FilePartOutcome(second, 'stored', null)).toBe('FAIL');
    expect(v2FilePartOutcome(second, 'chain', null)).toBe('FAIL');
    expect(en.evidence.verifyV2.outcome.SKIPPED).toBe('Not run');
  });

  it('CONTROL: a failed row that does not state plainChecked is FAIL without a skipped V-05, and Not run only with one (today\'s rule)', () => {
    const failed = { storedOk: false, plainOk: false, chainOk: false };
    expect(v2FilePartOutcome(failed, 'plain', null)).toBe('FAIL');
    expect(v2FilePartOutcome(failed, 'plain', [{ id: 'V-05', status: 'FAIL' }])).toBe('FAIL');
    expect(v2FilePartOutcome(failed, 'plain', [{ id: 'V-05', status: 'SKIPPED' }])).toBe('SKIPPED');
  });

  it('CONTROL: the row that was checked and passed is PASS, and a passing plaintext is PASS whatever the member says', () => {
    const [first] = read();
    if (!first) throw new Error('no first row');
    expect(v2FilePartOutcome(first, 'plain', null)).toBe('PASS');
    expect(v2FilePartOutcome({ storedOk: true, plainOk: true, chainOk: true, plainChecked: false }, 'plain', null)).toBe('PASS');
  });

  it('CONTROL: only the value false counts (true, a string, null are not read as "not run")', () => {
    const rows = readVerifyV2(answerOf([{ ...notChecked, plainChecked: true }, { ...notChecked, plainChecked: 'false' }, { ...notChecked, plainChecked: null }]))?.files ?? [];
    expect(rows).toHaveLength(3);
    for (const row of rows) {
      expect('plainChecked' in row).toBe(false);
      expect(v2FilePartOutcome(row, 'plain', null)).toBe('FAIL');
    }
  });
});
