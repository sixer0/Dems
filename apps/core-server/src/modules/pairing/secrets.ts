/**
 * The two secrets of the pairing module (plan row W32; spec §6.1 PR-P1, PR-P6 to PR-P8; SR-26,
 * SR-28, SR-31; database contract §5.1, §5.2; assumption SA-07).
 *
 *   the pairing code       six decimal digits, drawn uniformly with `crypto.randomInt`. Returned
 *                          once, by `issuePairingCode`. Stored as the SHA-256 of the UTF-8 bytes
 *                          of the code ID, one colon and the six digits (`PCD-000007:` and the
 *                          code): the ID in the input keeps two codes with equal digits from
 *                          having equal hashes;
 *   the device credential  32 bytes of `crypto.randomBytes`, written as base64url behind the
 *                          prefix `dvc_` (47 characters). Returned once, at redeem and at a
 *                          rotation. Stored as the SHA-256 of the whole value, prefix included.
 *
 * A presented CODE is compared in this process, in constant time: the server hashes the code ID
 * with the presented digits and compares the two digests with `crypto.timingSafeEqual`. A
 * presented CREDENTIAL is never compared here: it is found by the hash of what was presented.
 *
 * This is the only file of the module that names the crypto module. Nothing here logs, and
 * nothing here may be logged: neither a code, a credential nor a hash (NL-1, NL-2).
 */
import { createHash, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';
import { DEVICE_CREDENTIAL_PATTERN } from '@dems/shared/api';
import { DEVICE_CREDENTIAL_BYTES, DEVICE_CREDENTIAL_PREFIX, PAIRING_CODE_DIGITS, PAIRING_CODE_SPACE, PAIRING_QR_PREFIX } from './limits';

/** A new pairing code. `random` is the seam of a test; production uses `crypto.randomInt`. */
export function newPairingCode(random: (min: number, max: number) => number = randomInt): string {
  return String(random(0, PAIRING_CODE_SPACE)).padStart(PAIRING_CODE_DIGITS, '0');
}

/** The stored form of a code: SHA-256 over `<code ID>:<six digits>`, 32 bytes. */
export function pairingCodeHash(codeId: string, code: string): Buffer {
  return createHash('sha256').update(`${codeId}:${code}`, 'utf8').digest();
}

/**
 * True when the stored hash is the hash of the presented code. Constant time for two digests
 * of equal length, which two SHA-256 values always are; a stored value of another length
 * matches nothing.
 */
export function pairingCodeMatches(storedHash: Uint8Array, codeId: string, presentedCode: string): boolean {
  const presented = pairingCodeHash(codeId, presentedCode);
  return storedHash.length === presented.length && timingSafeEqual(storedHash, presented);
}

/** PR-P7: what the portal draws as a QR. Not a URL and not a deep link. */
export function qrPayloadOf(code: string): string {
  return `${PAIRING_QR_PREFIX}${code}`;
}

/** A new device credential. `random` is the seam of a test; production uses `crypto.randomBytes`. */
export function newDeviceCredential(random: (size: number) => Buffer = randomBytes): string {
  return `${DEVICE_CREDENTIAL_PREFIX}${random(DEVICE_CREDENTIAL_BYTES).toString('base64url')}`;
}

/** True when `value` has the form of a device credential. A value of another form is never looked up. */
export function isDeviceCredential(value: string): boolean {
  return DEVICE_CREDENTIAL_PATTERN.test(value);
}

/** The stored form of a credential: SHA-256 over the UTF-8 bytes of the presented value, 32 bytes. */
export function deviceCredentialHash(credential: string): Buffer {
  return createHash('sha256').update(credential, 'utf8').digest();
}
