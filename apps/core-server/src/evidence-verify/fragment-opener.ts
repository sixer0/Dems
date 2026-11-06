/**
 * THE FRAGMENT OPENER OF VERIFY V2 AT THE CORE (integration pass A, decision D109; closes the seam
 * of rows 84 and 85; SEC35-10; evidence package spec §D check V-05).
 *
 * THE ONE FILE of this unit that reaches the Core credential store (`CREDENTIAL_STORE_USERS` of
 * `credential-store/__tests__/static.test.ts`). It answers the port `FragmentOpener` of
 * `@dems/shared/evidence-verify` with the product cipher: the session key of the store
 * (`sessionKeys`) and `openFragment`, which recomputes the AAD from the record and verifies the
 * tag before any byte is returned.
 *
 * NO KEY CROSSES THE PORT, and none is kept: a key is opened for ONE range and its in-memory copy
 * is overwritten when that range is done. Nothing here logs; a failure is the store's own error
 * (a code and a position, never a value).
 *
 * The store of the app is asked when a key is asked for, never when the opener is built: an app
 * whose store is absent or refuses to work has no session key (`hasKey` false), and check V-05
 * then fails closed (`SESSION_KEY_UNAVAILABLE`).
 */
import type { FragmentOpener } from '@dems/shared/evidence-verify';
import { coreCredentialStore, openFragment, type CredentialStoreHost } from '../credential-store';

/** The opener for `RealVerificationOptions.opener`, over the Core credential store of the app. */
export function coreFragmentOpener(app: CredentialStoreHost): FragmentOpener {
  const sessionKeys = () => {
    const opened = coreCredentialStore(app);
    return opened.status === 'READY' ? opened.store.sessionKeys : null;
  };
  return {
    hasKey(keyId) {
      try {
        return sessionKeys()?.has(keyId) === true;
      } catch {
        // A key ID that is no session key ID, or a key file that cannot be trusted: no usable key.
        return false;
      }
    },
    open(record, stored) {
      const keys = sessionKeys();
      // The verifier asks `hasKey` first; a caller that does not is refused here, without a value.
      if (keys === null) throw new Error('the Core has no session key store');
      const key = keys.open(record.keyId);
      try {
        return openFragment(key, record, stored);
      } finally {
        keys.release(key);
      }
    },
  };
}
