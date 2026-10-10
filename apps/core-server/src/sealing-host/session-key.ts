/**
 * THE SEAL-TIME CIPHER OF THE CORE (blueprint row 82b; controller ruling D147; SEC35-10; evidence
 * package spec §A.3, §B.6; capture spec §D.2).
 *
 * THE ONE FILE of this unit that reaches the Core credential store (`CREDENTIAL_STORE_USERS` of
 * `credential-store/__tests__/static.test.ts`). It answers the pipeline's port
 * `SessionFragmentSealer` with the product cipher: the session key `KID-<sessionId>` of the store
 * and `createFragmentSealer`, which builds the AAD from the position and draws the nonce.
 *
 * THE KEY IS MADE HERE, ONCE. The first fragment of a session creates its key; every later call -
 * the next fragment, and a `CLOSE_TRACKS` that runs again after a stop of the process - opens the
 * same key. A key is never replaced: `create` refuses a session that has one.
 *
 * NO KEY CROSSES THE PORT, and none is kept: a key is opened for ONE fragment and its in-memory
 * copy is overwritten when that fragment is sealed. What is kept per session is the list of the
 * nonces already used in this process (public values, they are in `fragments.json`): a nonce that
 * is drawn twice under one key is refused before anything is sealed with it.
 *
 * Nothing here logs; a failure is the store's own error (a code, never a value). An app whose
 * store is absent or refuses to work cannot seal: the step fails closed (`SEALER_FAILED`).
 */
import { CredentialStoreError, CredentialStoreFailure, coreCredentialStore, createFragmentSealer, type CredentialStoreHost } from '../credential-store';
import type { SessionFragmentSealer } from '../sealing';

/** `KID-<sessionId>`: the key ID of a session's fragments (the form `sessionKeys.create` gives). */
export const sessionKeyIdOf = (sessionId: string): string => `KID-${sessionId}`;

/** The sealer for `SealingPorts.sealer`, over the Core credential store of the app. */
export function coreFragmentSealer(app: CredentialStoreHost): SessionFragmentSealer {
  const used = new Map<string, Set<string>>();
  return {
    seal(sessionId, position, plaintext) {
      const opened = coreCredentialStore(app);
      if (opened.status !== 'READY') throw new CredentialStoreError(CredentialStoreFailure.STORE_UNAVAILABLE);
      const keys = opened.store.sessionKeys;
      const keyId = sessionKeyIdOf(sessionId);
      const key = keys.has(keyId) ? keys.open(keyId) : keys.create(sessionId);
      try {
        const sealed = createFragmentSealer(key).seal(position, plaintext);
        const nonces = used.get(keyId) ?? new Set<string>();
        used.set(keyId, nonces);
        if (nonces.has(sealed.gcmIv)) throw new CredentialStoreError(CredentialStoreFailure.NONCE_REUSED);
        nonces.add(sealed.gcmIv);
        return sealed;
      } finally {
        keys.release(key);
      }
    },
  };
}
