// Fix wave K, final small fixes (PE-WK-46): the tablet / phone reads `files[].plainChecked` BY NAME.
// A file row that states `plainChecked: false` (the plaintext check V-05 did not run for that file)
// words its decrypted-bytes part "Not run", never "FAIL". THIS FILE HOLDS THE READER (the member is
// kept by name, only the value `false` counts); the RULE over it is the shared one since batch N
// (R101-03, ruling D241: `@dems/shared/evidence-rules`) and its vectors are in the shared package's test.
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

  it('the row that states it reads "Not run" for its decrypted bytes through the SHARED rule (R101-03; its vectors are in packages/shared/test/evidence-verify.test.ts)', () => {
    const [first, second] = read();
    if (!first || !second) throw new Error('two rows');
    expect(v2FilePartOutcome(second, 'plain', null)).toBe('NOT_RUN');
    expect(v2FilePartOutcome(first, 'plain', null)).toBe('PASS');
    expect(en.evidence.verifyV2.outcome.SKIPPED).toBe('Not run');
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
