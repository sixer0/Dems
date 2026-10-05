/**
 * Biometric tokens (plan row W41; spec §5.1 ID-P11, §5.6; SR-36; database contract §5.1).
 *
 * A token is 32 bytes of the platform's random source, written as base64url behind the prefix
 * `bio_` (47 characters): the contract's form (`BIOMETRIC_TOKEN_PATTERN`). The server makes it,
 * returns it ONCE (at enrolment, and at every sign-in that uses the one before it), and keeps
 * only its SHA-256, taken over the UTF-8 bytes of the whole value, prefix included. A presented
 * value is found by the hash of what was presented, so no token is ever compared in this
 * process.
 *
 * A family is one enrolment: every token that follows from it by rotation carries its ID.
 *
 * Nothing here logs, and nothing here may be logged: neither a token nor its hash (NL-1, NL-2).
 * This is the one file of the folder that names the crypto module.
 */
import { createHash, randomBytes, randomUUID } from 'node:crypto';

export const BIOMETRIC_TOKEN_PREFIX = 'bio_';
/** 256 bits (SR-36). */
export const BIOMETRIC_TOKEN_BYTES = 32;
/** ID-P11: a token that is not used within 30 days of its issue is no longer accepted. */
export const BIOMETRIC_TOKEN_LIFETIME_MS = 30 * 24 * 60 * 60_000;

/** A new token. `random` is the seam of a test; production uses `crypto.randomBytes`. */
export function newBiometricToken(random: (size: number) => Buffer = randomBytes): string {
  return `${BIOMETRIC_TOKEN_PREFIX}${random(BIOMETRIC_TOKEN_BYTES).toString('base64url')}`;
}

/**
 * The stored form: SHA-256 over the UTF-8 bytes of the presented value, 32 bytes. It is taken of
 * whatever was sent, of the right form or not, so every attempt does the same work.
 */
export function biometricTokenHash(token: string): Buffer {
  return createHash('sha256').update(token, 'utf8').digest();
}

/** The ID of a new family: one per enrolment, minted by the server. Safe to log (NL-7). */
export function newFamilyId(): string {
  return randomUUID();
}
