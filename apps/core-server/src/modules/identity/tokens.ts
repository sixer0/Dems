/**
 * Session tokens (plan row W24; spec §5.1 ID-P6, SR-09; database contract §5.1, §5.2).
 *
 * A token is 32 bytes of the platform's random source, written as base64url behind the prefix
 * `ses_` (47 characters). It is returned once, at sign-in: in the cookie of a web console, in
 * the body for a paired device. The server keeps only its SHA-256, taken over the UTF-8 bytes of
 * the whole value, prefix included; a presented value is found by the hash of what was
 * presented, so no token is ever compared in this process.
 *
 * Nothing here logs, and nothing here may be logged: neither the token nor its hash (NL-1, NL-2).
 */
import { createHash, randomBytes } from 'node:crypto';
import { SESSION_TOKEN_PATTERN } from '@dems/shared/api';

export const SESSION_TOKEN_PREFIX = 'ses_';
/** 256 bits (SR-09; the floor is 64). */
export const SESSION_TOKEN_BYTES = 32;

/** A new token. `random` is the seam of a test; production uses `crypto.randomBytes`. */
export function newSessionToken(random: (size: number) => Buffer = randomBytes): string {
  return `${SESSION_TOKEN_PREFIX}${random(SESSION_TOKEN_BYTES).toString('base64url')}`;
}

/** True when `value` has the form of a session token. A value of another form is never looked up. */
export function isSessionToken(value: string): boolean {
  return SESSION_TOKEN_PATTERN.test(value);
}

/** The stored form: SHA-256 over the UTF-8 bytes of the presented value, 32 bytes. */
export function sessionTokenHash(token: string): Buffer {
  return createHash('sha256').update(token, 'utf8').digest();
}
