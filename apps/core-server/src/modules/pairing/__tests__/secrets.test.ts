// The two secrets of the pairing module and its two identifiers (plan row W32; spec §6.1 PR-P1,
// PR-P6 to PR-P9; SR-26, SR-28, SR-31; database contract §5.1; assumption SA-07). No database.
//
// No generated code or credential is printed: an assertion compares, counts or matches a form.
import { createHash } from 'node:crypto';
import { DEVICE_CREDENTIAL_PATTERN, DEVICE_ID_PATTERN, PAIRING_CODE_ID_PATTERN, PAIRING_CODE_PATTERN, PAIRING_QR_PAYLOAD_PATTERN } from '@dems/shared/api';
import { describe, expect, it } from 'vitest';
import { looksLikeSecret } from '../../../core';
import {
  DEVICE_CREDENTIAL_BYTES,
  DEVICE_SEEN_MIN_INTERVAL_MS,
  PAIRING_CODE_DIGITS,
  PAIRING_CODE_LIFETIME_MS,
  PAIRING_CODE_MAX_FAILED_REDEEMS,
  REDEEM_LOCK_DURATION_MS,
  REDEEM_LOCK_MAX_FAILURES,
  REDEEM_LOCK_WINDOW_MS,
} from '../limits';
import { deviceCredentialHash, isDeviceCredential, newDeviceCredential, newPairingCode, pairingCodeHash, pairingCodeMatches, qrPayloadOf } from '../secrets';
import { deviceIdOf, pairingCodeIdOf } from '../store';

const sha256 = (text: string): Buffer => createHash('sha256').update(text, 'utf8').digest();

describe('the numbers are the specification\'s (spec §6.1)', () => {
  it('six digits, 300 s, closed at five failed redeems; three failures in 300 s lock for 60 s; last seen at most once a minute', () => {
    expect([PAIRING_CODE_DIGITS, PAIRING_CODE_LIFETIME_MS, PAIRING_CODE_MAX_FAILED_REDEEMS]).toEqual([6, 300_000, 5]);
    expect([REDEEM_LOCK_MAX_FAILURES, REDEEM_LOCK_WINDOW_MS, REDEEM_LOCK_DURATION_MS]).toEqual([3, 300_000, 60_000]);
    expect([DEVICE_CREDENTIAL_BYTES, DEVICE_SEEN_MIN_INTERVAL_MS]).toEqual([32, 60_000]);
  });
});

describe('the pairing code (PR-P1, SR-26)', () => {
  it('is drawn uniformly below 10^6 and written with six digits, leading zeros kept', () => {
    const asked: Array<[number, number]> = [];
    const draw = (value: number) => (min: number, max: number) => {
      asked.push([min, max]);
      return value;
    };
    expect(newPairingCode(draw(0))).toBe('000000');
    expect(newPairingCode(draw(7))).toBe('000007');
    expect(newPairingCode(draw(42_195))).toBe('042195');
    expect(newPairingCode(draw(999_999))).toBe('999999');
    // The range handed to the random source: every code from 000000 to 999999, the upper bound exclusive.
    expect(asked).toEqual([
      [0, 1_000_000],
      [0, 1_000_000],
      [0, 1_000_000],
      [0, 1_000_000],
    ]);
  });

  it('from the platform source: 20,000 codes all have the form, are not all alike, and every first digit comes up about one time in ten', () => {
    const firstDigits = Array.from({ length: 10 }, () => 0);
    const seen = new Set<string>();
    for (let draw = 0; draw < 20_000; draw += 1) {
      const code = newPairingCode();
      if (!PAIRING_CODE_PATTERN.test(code)) throw new Error('a generated code has not the form of a pairing code');
      firstDigits[Number(code[0])] = (firstDigits[Number(code[0])] ?? 0) + 1;
      seen.add(code);
    }
    // 2,000 expected per digit, standard deviation about 42: a band of seven deviations.
    for (const count of firstDigits) {
      expect(count).toBeGreaterThan(1_700);
      expect(count).toBeLessThan(2_300);
    }
    expect(seen.size).toBeGreaterThan(19_500);
  });

  it('is stored as SHA-256 of the code ID, one colon and the six digits: 32 bytes, different for equal digits under another ID', () => {
    const hash = pairingCodeHash('PCD-000007', '042195');
    expect(hash.equals(sha256('PCD-000007:042195'))).toBe(true);
    expect(hash).toHaveLength(32);
    expect(hash.equals(pairingCodeHash('PCD-000008', '042195'))).toBe(false);
    expect(hash.equals(sha256('042195'))).toBe(false);
    expect(hash.equals(sha256('DEMS-PAIR:1:042195'))).toBe(false);
  });

  it('is compared through its hash: the right digits under the right ID match, and nothing else does', () => {
    const stored = pairingCodeHash('PCD-000007', '042195');
    expect(pairingCodeMatches(stored, 'PCD-000007', '042195')).toBe(true);
    expect(pairingCodeMatches(stored, 'PCD-000007', '042196')).toBe(false);
    expect(pairingCodeMatches(stored, 'PCD-000008', '042195')).toBe(false);
    expect(pairingCodeMatches(stored, 'PCD-000007', '')).toBe(false);
    // A stored value of another length matches nothing and does not throw.
    expect(pairingCodeMatches(stored.subarray(0, 31), 'PCD-000007', '042195')).toBe(false);
    expect(pairingCodeMatches(Buffer.alloc(0), 'PCD-000007', '042195')).toBe(false);
    expect(pairingCodeMatches(new Uint8Array(stored), 'PCD-000007', '042195')).toBe(true);
  });

  it('PR-P7: the QR payload is the fixed prefix and the code; not a URL', () => {
    const payload = qrPayloadOf('042195');
    expect(payload).toBe('DEMS-PAIR:1:042195');
    expect(PAIRING_QR_PAYLOAD_PATTERN.test(payload)).toBe(true);
    expect(payload).not.toMatch(/:\/\//);
    // The audit writer refuses a text that holds one (the core's rule for a credential form).
    expect(looksLikeSecret(`shown as ${payload}`)).toBe(true);
  });
});

describe('the device credential (PR-P8, SR-31)', () => {
  it('is 32 random bytes as base64url behind the prefix dvc_: 47 characters of the contract\'s form', () => {
    const asked: number[] = [];
    const credential = newDeviceCredential((size) => {
      asked.push(size);
      return Buffer.alloc(size, 0xfb);
    });
    expect(asked).toEqual([32]);
    expect(credential).toBe(`dvc_${Buffer.alloc(32, 0xfb).toString('base64url')}`);
    expect(credential).toHaveLength(47);
    expect(DEVICE_CREDENTIAL_PATTERN.test(credential)).toBe(true);
    expect(credential).not.toMatch(/[+/=]/);
  });

  it('from the platform source: every credential has the form and no two are alike', () => {
    const seen = new Set<string>();
    for (let draw = 0; draw < 500; draw += 1) {
      const credential = newDeviceCredential();
      if (!isDeviceCredential(credential)) throw new Error('a generated credential has not the form of a device credential');
      seen.add(credential);
    }
    expect(seen.size).toBe(500);
  });

  it('is stored as SHA-256 of the whole value, prefix included', () => {
    const credential = `dvc_${'A'.repeat(43)}`;
    expect(deviceCredentialHash(credential).equals(sha256(credential))).toBe(true);
    expect(deviceCredentialHash(credential)).toHaveLength(32);
    expect(deviceCredentialHash(credential).equals(sha256('A'.repeat(43)))).toBe(false);
  });

  it('only the exact form is a device credential', () => {
    expect(isDeviceCredential(`dvc_${'A'.repeat(43)}`)).toBe(true);
    for (const value of ['', 'dvc_', `dvc_${'A'.repeat(42)}`, `dvc_${'A'.repeat(44)}`, `ses_${'A'.repeat(43)}`, `DVC_${'A'.repeat(43)}`, ` dvc_${'A'.repeat(43)}`, `dvc_${'A'.repeat(42)}=`]) {
      expect(isDeviceCredential(value)).toBe(false);
    }
  });
});

describe('the identifiers (PR-P9; database contract §4.7, §4.8)', () => {
  it('DEV-NNNN with at least four digits, PCD-NNNNNN with at least six; neither is ever cut', () => {
    expect([deviceIdOf(1), deviceIdOf(42), deviceIdOf(9_999), deviceIdOf(10_000), deviceIdOf(123_456)]).toEqual(['DEV-0001', 'DEV-0042', 'DEV-9999', 'DEV-10000', 'DEV-123456']);
    expect([pairingCodeIdOf(1), pairingCodeIdOf(999_999), pairingCodeIdOf(1_000_000)]).toEqual(['PCD-000001', 'PCD-999999', 'PCD-1000000']);
    for (const number of [1, 9_999, 10_000, 4_000_000]) {
      expect(DEVICE_ID_PATTERN.test(deviceIdOf(number))).toBe(true);
      expect(PAIRING_CODE_ID_PATTERN.test(pairingCodeIdOf(number))).toBe(true);
    }
    // A code ID is not a code: it never has the form of one.
    expect(PAIRING_CODE_PATTERN.test(pairingCodeIdOf(123_456))).toBe(false);
  });
});
