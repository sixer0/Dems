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
 * same key. A key is never replaced: `create` refuses a session that has one. The key is THIS
 * Core's own - kept per media store root (ruling D180; fix pass F-M7c): a key another database's
 * Core made for an equal session ID is never sealed with.
 *
 * A KEY IS NEVER REUSED FOR ANOTHER SESSION (fix wave H driver A; gate 89 finding G89-06 = R88-12
 * live; ruling D199). A reset gives session IDs out again: `KID-SES-20261010-0024` sealed three
 * different recordings in one day, because "a key of that ID is there" was read as "the key of this
 * session". The sealer of the running Core is therefore given `instanceOf`: what names THIS session
 * beyond its ID (the instant it was created, from the engine's committed state - the same after a
 * restart, another for the next session of that ID). The key is made WITH that binding, and a key
 * that is there is opened only when its binding is this session's. Otherwise - another session's
 * key, a key an earlier build made without a binding, a session the engine does not hold - the
 * seal is REFUSED by name (`CREDENTIAL_SESSION_KEY_NOT_OF_SESSION`): nothing is sealed, the key is
 * not touched. The reset is what removes such a key (`db/reset/session-artefacts.ts`).
 * A sealer built WITHOUT `instanceOf` (the seed-time generator of the demo packages, which renews
 * its key before every seal; a test) keeps the rule of the ID alone.
 *
 * THE IV RULE, STATED HONESTLY (R88-13): every fragment gets a RANDOM 96-bit IV. Uniqueness under
 * one key is PROBABILISTIC, not proven: the memo below refuses a repeat inside one process only.
 * What bounds the risk is the number of messages per key - the fragments of ONE session (a
 * re-run of CLOSE_TRACKS seals them again under the same key) - a few thousand, far inside the
 * random-nonce bound of GCM. A demo reseed never adds to it: `renewSessionKey` destroys the old
 * key and the reseed seals under a fresh one.
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
export function coreFragmentSealer(app: CredentialStoreHost, instanceOf?: (sessionId: string) => string | null): SessionFragmentSealer {
  const used = new Map<string, Set<string>>();
  return {
    seal(sessionId, position, plaintext) {
      const opened = coreCredentialStore(app);
      if (opened.status !== 'READY') throw new CredentialStoreError(CredentialStoreFailure.STORE_UNAVAILABLE);
      const keys = opened.store.sessionKeys;
      const keyId = sessionKeyIdOf(sessionId);
      // THIS Core's own key (D180; fix pass F-M7c): a key of the shared folder of an earlier build is never sealed with.
      const made = !keys.owns(keyId);
      // G89-06: what names THIS session beyond its ID. Null (the engine holds no such session): nothing is sealed.
      const binding = instanceOf === undefined ? undefined : instanceOf(sessionId);
      if (binding === null || (!made && binding !== undefined && keys.bindingOf(keyId) !== binding)) throw new CredentialStoreError(CredentialStoreFailure.SESSION_KEY_NOT_OF_SESSION);
      const key = made ? keys.create(sessionId, binding) : keys.open(keyId);
      // A NEW key starts with no nonce used: the memo of a key that was destroyed (a reseed) is dropped, so it never grows over keys that are gone (R88-13).
      if (made) used.delete(keyId);
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

/**
 * A FRESH KEY FOR A SESSION THAT IS SEALED AGAIN FROM NOTHING (fix pass F-M7c, R88-13 second half;
 * the demo reseed, D171 E3-4): this Core's own key `KID-<sessionId>` is DESTROYED, so the next seal
 * of that session ID makes a new one - no IV can repeat under one key however often a database is
 * reseeded. What the old key sealed is unreadable from then on: the caller replaces those packages.
 * A key of the shared folder of an earlier build is not this Core's and is not touched. True when
 * a key was destroyed. Throws the store's own error when the store cannot be used.
 */
export function renewSessionKey(host: CredentialStoreHost, sessionId: string): boolean {
  const opened = coreCredentialStore(host);
  if (opened.status !== 'READY') throw new CredentialStoreError(CredentialStoreFailure.STORE_UNAVAILABLE);
  return opened.store.sessionKeys.destroy(sessionKeyIdOf(sessionId));
}

/**
 * WHY A SESSION CANNOT BE STARTED, AS FAR AS ITS KEY GOES (fix wave I driver A1; re-gate 75 finding
 * G75b-01; ruling D216). THE DEFECT MUST SURFACE AT THE START, NEVER AT THE SEAL: at re-gate 75 a
 * session recorded for 71 s and only then learned that a key of its ID - left by an earlier session
 * of the same number - was in the store, where the seal refuses it by name.
 *
 * A session that has not started has sealed nothing, so it has NO key of its own (the key is made
 * by the first fragment that is sealed). A key of this Core under `KID-<sessionId>` at that instant
 * is therefore never this session's, whatever its binding says:
 *
 *   SESSION_KEY_NOT_OF_SESSION     such a key is there. The session is not started; the key is not
 *                                  touched (it is never reused and never replaced). The way on is a
 *                                  session with another number (cancel, create), or the reset that
 *                                  destroys the keys of the store it resets.
 *   SESSION_KEY_STORE_UNAVAILABLE  the store exists and refuses to work (not a private folder, not
 *                                  readable): the seal could make no key either.
 *
 * Null: nothing stands in the way. An app WITHOUT a data directory (`ABSENT`: an app a test built)
 * is not refused here - it has no store to ask. Reads no key byte: file names only (`owns`).
 */
export type SessionKeyStartRefusal = 'SESSION_KEY_NOT_OF_SESSION' | 'SESSION_KEY_STORE_UNAVAILABLE';
export function sessionKeyStartRefusal(host: CredentialStoreHost, sessionId: string): SessionKeyStartRefusal | null {
  const opened = coreCredentialStore(host);
  if (opened.status === 'ABSENT') return null;
  if (opened.status !== 'READY') return 'SESSION_KEY_STORE_UNAVAILABLE';
  try {
    return opened.store.sessionKeys.owns(sessionKeyIdOf(sessionId)) ? 'SESSION_KEY_NOT_OF_SESSION' : null;
  } catch {
    return 'SESSION_KEY_STORE_UNAVAILABLE';
  }
}
