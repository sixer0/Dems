/**
 * THE ONE FILE of the media-stream unit that reaches the Core credential store (blueprint row 90;
 * SEC35-12; `CREDENTIAL_STORE_USERS` of `credential-store/__tests__/static.test.ts` names it).
 *
 * Two things come through this door, and nothing else:
 *
 *   1. THE MEDIA-SESSION SIGNING KEY (`MEDIA_SESSION_SIGNING_KEY_ID`, C3 §7). A SEPARATE key: 32
 *      random bytes kept as a named secret of the store, made at the first use. Never the evidence
 *      `Signer` key, never a session key, never derived from another secret. It is not held in
 *      memory: every MAC opens the key file, computes HMAC-SHA-256 inside the store's `use`
 *      callback and lets the store overwrite its copy. No function of this file returns key bytes.
 *      KEY LOSS only ends the media sessions that are alive (60 s at most): a new key is made and
 *      new sessions are issued under it.
 *
 *   2. THE RANGE PLAN of row 84 (`planRangeRead`): which sealed fragments a byte range touches.
 *      Re-exported, not rewritten. The DECRYPTION itself is not here at all: the unit opens a
 *      fragment through `coreFragmentOpener` of `src/evidence-verify`, the one opener of the Core.
 *
 * NOTHING HERE LOGS. A failure is the store's own error: a code, never a value.
 */
import { createHmac, randomBytes } from 'node:crypto';
import { MEDIA_SESSION_SIGNING_KEY_ID } from '@dems/shared/api';
import { CredentialStoreError, CredentialStoreFailure, FragmentAuthenticationError, coreCredentialStore, planRangeRead, type CredentialStoreHost } from '../credential-store';
import type { MediaSessionMac } from './token';

export { planRangeRead };
export type { RangeSegment, SealedFragmentRecord } from '../credential-store';

/** The name of the key in the store: the contract's key ID in the form a named secret takes (`[A-Z0-9_]`). */
export const MEDIA_SESSION_KEY_SECRET_NAME = MEDIA_SESSION_SIGNING_KEY_ID.replace(/-/g, '_');
export const MEDIA_SESSION_KEY_BYTES = 32;

/** True for the opener's refusal of a fragment whose tag did not verify (altered bytes, nonce, tag, position or key ID). */
export function isFragmentAuthenticationFailure(error: unknown): boolean {
  return error instanceof FragmentAuthenticationError;
}

/** True when the store holds no key of the reference that was asked for (key lost = data unreadable, SEC35-09). */
export function isKeyNotFound(error: unknown): boolean {
  return error instanceof CredentialStoreError && error.code === CredentialStoreFailure.KEY_NOT_FOUND;
}

/**
 * The MAC of the app's media sessions, or null while the app has no usable credential store (an
 * app without a data directory, a store directory that is not private): no session is issued and
 * none is accepted then.
 */
export function mediaSessionMacOf(app: CredentialStoreHost): MediaSessionMac | null {
  const opened = coreCredentialStore(app);
  if (opened.status !== 'READY') return null;
  const secrets = opened.store.namedSecrets;
  const name = MEDIA_SESSION_KEY_SECRET_NAME;
  return (message) => {
    if (!secrets.has(name)) {
      const fresh = randomBytes(MEDIA_SESSION_KEY_BYTES);
      try {
        secrets.put(name, fresh);
      } catch (error) {
        // Made by another call between the two lines above: that key is the key.
        if (!(error instanceof CredentialStoreError) || error.code !== CredentialStoreFailure.KEY_EXISTS) throw error;
      } finally {
        fresh.fill(0);
      }
    }
    return secrets.use(name, (key) => createHmac('sha256', key).update(message).digest());
  };
}
