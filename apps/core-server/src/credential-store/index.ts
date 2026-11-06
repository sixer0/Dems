/**
 * The Core credential store (blueprint row 84, M7-W3; SEC35-03, SEC35-08, SEC35-09, SEC35-10;
 * decisions D68(c), D80(7), D83 F-122-2; capture spec §D.1 to §D.4; database contract §B.3, §B.13).
 *
 * ONE STORE. Every key the Core holds for data at rest lives here, and nowhere else:
 *
 *   stt             the key of the STT `SECRET` credential of operation 91 (`stt_config`)
 *   capture         the key of a camera credential of operations 89 and 96 (`capture_device_credentials`)
 *   sessionKeys     the AES-256 key of a recording session, `KID-<sessionId>` (per-fragment GCM),
 *                   kept PER MEDIA STORE ROOT of the Core (`session-keys-<scope>`, ruling D180)
 *   keyWrapSecrets  the secret that opens the encrypted signer key file (row 83, SEC35-07)
 *   namedSecrets    a named secret blob another unit keeps here
 *
 * The store is per app: `coreCredentialStore(app)` gives the same object from every unit. A second
 * store is a decision, not a habit (D80(7)): a static test of this folder holds that one place
 * makes the key files and that the units which import this folder are a pinned list.
 *
 * WHERE THE KEYS ARE: `<dataDir>/credential-store/keys/`, mode 0700/0600 (`key-store.ts`), under
 * the git-ignored data directory. Not the OS keychain: reaching it from Node needs a child process
 * or a native module, and the server starts no process but the capture worker and takes no new
 * dependency. A hardware or keychain store is a deployment decision (custody note of this row).
 *
 * WHAT THE DATABASE HOLDS OF A CREDENTIAL: a key reference (a CODE such as `STT_API_KEY_K_…`), a
 * 12-byte nonce and the ciphertext of a padded frame (`envelope.ts`). Never a key.
 *
 * ONE KEY PER CREDENTIAL, ONE KEY PER SESSION (§B.3, §D.2). Every `seal` makes a new random key
 * and a new reference: writing a credential again IS its rotation. The key of the envelope that
 * was replaced stays in the store until the unit that knows which reference is stored calls
 * `credentialKeys.retainOnly` (THE ROTATION HOOK): the sealing side cannot know it, because the
 * credential columns are write-only for the runtime role. NO SUCH UNIT EXISTS YET (review row 69,
 * finding R69-09): `retainOnly` has no caller in the product, so replaced keys are never removed.
 * A recorded gap of this phase, not a behaviour to rely on.
 *
 * KEY LOSS = DATA UNREADABLE (SEC35-09). No escrow, no backup, no second copy. A removed key or a
 * lost data directory makes the sealed credential unusable (it is typed again) and the sealed
 * media of that session undecryptable, while its stored-bytes verification still passes.
 *
 * NOTHING HERE LOGS, and no function returns key bytes. A key is an opaque `KeyMaterial`; a
 * failure is a `CredentialStoreError` with a code.
 *
 * AVAILABILITY. `ABSENT`: the app has no data directory (an app built in a test without one) -
 * there is no store, and a consumer answers as it did before this row
 * (`503 CREDENTIAL_STORE_NOT_READY`). `UNAVAILABLE`: the directory of the store exists and is not
 * a private directory of this user - the store refuses to work, with a code. `READY` otherwise;
 * the folders are made when the first key is.
 */
import { createHash, randomBytes } from 'node:crypto';
import { join, resolve } from 'node:path';
import { openSecret, sealSecret, type SealedSecret } from './envelope';
import { CredentialStoreError, CredentialStoreFailure, errnoOf } from './errors';
import { disposeKey } from './key-material';
import { CREDENTIAL_STORE_FOLDER, createFileKeyStore, dataDirectoryIsThere, type KeyStore } from './key-store';
import type { FragmentKey } from './fragment-cipher';

export { CredentialStoreError, CredentialStoreFailure, FragmentAuthenticationError } from './errors';
export { ENVELOPE_ALGORITHM, ENVELOPE_MIN_CIPHERTEXT_BYTES, ENVELOPE_VERSION, isSealedSecret, isStoreSealedSecret, type SealedSecret, type StoreSealedSecret } from './envelope';
export { KEY_MARK, KeyMaterial } from './key-material';
export {
  FRAGMENT_NONCE_BYTES,
  FRAGMENT_TAG_BYTES,
  createFragmentSealer,
  fragmentAad,
  openFragment,
  planRangeRead,
  readDecryptedRange,
  type ByteRange,
  type DecryptedRangeRequest,
  type FragmentKey,
  type FragmentPosition,
  type FragmentSealer,
  type RangeSegment,
  type SealedFragment,
  type SealedFragmentRecord,
  type StoredRangeReader,
} from './fragment-cipher';

/** The purposes of a credential envelope. Part of what is authenticated; the prefix of its key references. */
export const CredentialPurpose = { STT_API_KEY: 'STT_API_KEY', CAPTURE_DEVICE: 'CAPTURE_DEVICE' } as const;
export type CredentialPurpose = (typeof CredentialPurpose)[keyof typeof CredentialPurpose];

/** The subject of the one STT credential: the singleton row. */
const STT_SUBJECT = 'stt_config';
const KEY_REF_RANDOM_BYTES = 10;
/** `KID-<sessionId>` (capture spec §D.2; evidence spec §B.6 field 77). */
export const SESSION_KEY_PREFIX = 'KID-';
const SESSION_ID = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/;
const DEVICE_ID = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/;
/** A named secret: a CODE chosen in the code of the unit that keeps it. */
const SECRET_NAME = /^[A-Z][A-Z0-9_]{0,47}$/;
const SECRET_PREFIX = 'SECRET_';
/** The key id of a wrapped key file, as a file name part. The prefix has a hyphen, a named secret has none: the two never meet. */
const WRAPPED_KEY_ID = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/;
const WRAP_PREFIX = 'WRAP-';

const keyRefPrefix = (purpose: CredentialPurpose): string => `${purpose}_K_`;
const isKeyRefOf = (purpose: CredentialPurpose, keyRef: string): boolean => typeof keyRef === 'string' && new RegExp(`^${keyRefPrefix(purpose)}[0-9A-F]{${KEY_REF_RANDOM_BYTES * 2}}$`).test(keyRef);

/** Seals and opens the STT `SECRET` credential. `seal` has the shape of the STT module's `SttCredentialSealer`. */
export interface SttCredentialCipher {
  seal(plaintext: string): Promise<SealedSecret>;
  /**
   * THE OPENER the transcriber's key-loader is handed (row 115 mounts it): the three stored values
   * of the reveal function in, the API key out. Synchronous, in memory only. Throws a
   * `CredentialStoreError` (`CREDENTIAL_OPEN_FAILED`, `CREDENTIAL_KEY_NOT_FOUND`): the loader then
   * treats the credential as unavailable.
   */
  open(sealed: SealedSecret): string;
}

/** Seals and opens the secret of a camera credential. The username is a clear column and is not sealed. */
export interface CaptureCredentialCipher {
  seal(deviceId: string, secret: string): Promise<SealedSecret>;
  open(deviceId: string, sealed: SealedSecret): string;
}

/** THE ROTATION HOOK of the credential keys. */
export interface CredentialKeyRotation {
  /** The key references of one purpose the store holds. */
  list(purpose: CredentialPurpose): string[];
  /**
   * Destroys every key of `purpose` whose reference is not in `stored`: the keys of replaced
   * envelopes and of writes that never committed. Called by the unit that reads the stored
   * references (the reveal side). Returns the references it destroyed.
   */
  retainOnly(purpose: CredentialPurpose, stored: readonly string[]): string[];
}

/** The session keys of the per-fragment cipher. */
/**
 * THE SCOPE OF A CORE'S SESSION KEYS (fix pass F-M7c; ruling D180): 32 hex characters derived from
 * the RESOLVED media store root - the one thing of a Core that is per database outside the
 * database (D171). The data directory is shared by every lane of an installation: in one flat
 * folder two databases with equal session IDs opened ONE key `KID-<sessionId>`. The key ID that is
 * written into a manifest does not change; where the Core keeps the key does. A media store that
 * is MOVED to another path needs its key folder renamed to the new scope (`session-keys-<scope>`):
 * a deployment step, stated in the note of this pass.
 */
export function sessionKeyScopeOf(mediaStoreDir: string): string {
  return createHash('sha256').update(`dems.session-keys/1\n${resolve(mediaStoreDir)}`, 'utf8').digest('hex').slice(0, 32);
}
/** The folder of one Core's session keys inside the store. */
export const sessionKeyFolderOf = (mediaStoreDir: string): string => `session-keys-${sessionKeyScopeOf(mediaStoreDir)}`;

/** The binding of a session key to its session: printable, no secret, at most 128 characters (G89-06). */
export const SESSION_KEY_BINDING = /^[A-Za-z0-9][A-Za-z0-9:._-]{0,127}$/;

export interface SessionKeys {
  /**
   * A new random key for a session. `CREDENTIAL_KEY_EXISTS` when the session has one: a key is never reused or replaced.
   *
   * `binding` (fix wave H driver A, G89-06): a short text that names THIS session beyond its ID - a
   * reset gives session IDs out again, so the ID alone does not say whose key it is. It is kept
   * beside the key (a blob of the same reference, no secret) and read back with `bindingOf`: the
   * sealer refuses a key whose binding is not its session's (`sealing-host/session-key.ts`).
   */
  create(sessionId: string, binding?: string): FragmentKey;
  /** The binding THIS Core's own key was made with; null when it was made with none (an earlier build) or the key is not this Core's. */
  bindingOf(keyId: string): string | null;
  /** `CREDENTIAL_KEY_NOT_FOUND` when the key is gone: the media of that session cannot be decrypted. */
  open(keyId: string): FragmentKey;
  has(keyId: string): boolean;
  /**
   * True when the key is THIS Core's own (in the folder of its media store root). A key an earlier
   * build left in the shared folder is opened for reading (`has`, `open`) and is never this Core's
   * own: a seal does not reuse it and `destroy` does not touch it (D180).
   */
  owns(keyId: string): boolean;
  /** Destroys THIS Core's own key and its binding (a reset, a reseed, retention expiry after any export). The caller audits the FACT. True when a key was there. */
  destroy(keyId: string): boolean;
  /** Overwrites the in-memory copy a `create` or `open` handed out. */
  release(key: FragmentKey): void;
}

/** A named secret blob of another unit (row 83: the signing key). At most 4096 bytes; stored once. */
export interface NamedSecrets {
  /** `CREDENTIAL_KEY_EXISTS` when the name is taken. The caller overwrites its own buffer afterwards. */
  put(name: string, bytes: Uint8Array): void;
  /** Hands a copy to `use` and overwrites it when `use` has returned. */
  use<T>(name: string, use: (bytes: Buffer) => T): T;
  has(name: string): boolean;
}

/**
 * The secret that opens the encrypted signer key file (SEC35-07), kept in this store instead of a
 * second private file beside the key. Has the shape of the signer's `KeyWrapSecrets`
 * (`src/capture/signer/types.ts`, row 83); the composition of row 82 hands it to the signer.
 */
export interface KeyWrapSecretStore {
  /** A copy of the secret of that key id, or null when there is none. The caller overwrites it after use. */
  get(keyId: string): Uint8Array | null;
  /** Stores a new secret, once: `CREDENTIAL_KEY_EXISTS` when that key id has one. */
  put(keyId: string, secret: Uint8Array): void;
}

export interface CoreCredentialStore {
  readonly stt: SttCredentialCipher;
  readonly capture: CaptureCredentialCipher;
  readonly credentialKeys: CredentialKeyRotation;
  readonly sessionKeys: SessionKeys;
  readonly namedSecrets: NamedSecrets;
  readonly keyWrapSecrets: KeyWrapSecretStore;
}

export interface CredentialStoreOptions {
  /** `<dataDir>/credential-store`. */
  readonly root: string;
  /** A test hands in a key store of its own. */
  readonly keys?: KeyStore;
  /**
   * The key store of THIS Core's session keys (per media store root, D180). Absent: the session
   * keys are in `keys` (a store built without a media store root: a test, an earlier layout).
   */
  readonly sessionKeyStore?: KeyStore;
}

/** Builds the store over one directory. The product calls it in one place: `coreCredentialStore`. */
export function createCredentialStore(options: CredentialStoreOptions): CoreCredentialStore {
  const keys = options.keys ?? createFileKeyStore({ root: options.root });
  // D180: this Core's own session keys; `shared` is the flat folder of an earlier build, read only.
  const ownSessionKeys = options.sessionKeyStore ?? keys;
  const sharedSessionKeys = options.sessionKeyStore === undefined ? null : keys;

  /** One key, one envelope: the key is made, used once and its in-memory copy overwritten. */
  const sealWith = (purpose: CredentialPurpose, subject: string, secret: string): SealedSecret => {
    const keyRef = `${keyRefPrefix(purpose)}${randomBytes(KEY_REF_RANDOM_BYTES).toString('hex').toUpperCase()}`;
    const key = keys.create(keyRef);
    try {
      return sealSecret(key, { purpose, subject, keyRef }, secret);
    } catch (error) {
      // Nothing was sealed under it: the key is not left behind.
      keys.destroy(keyRef);
      throw error;
    } finally {
      disposeKey(key);
    }
  };

  const openWith = (purpose: CredentialPurpose, subject: string, sealed: SealedSecret): string => {
    // A reference of another purpose, of a session key or of a named secret is never opened here.
    if (sealed === null || typeof sealed !== 'object' || !isKeyRefOf(purpose, sealed.keyRef)) throw new CredentialStoreError(CredentialStoreFailure.ENVELOPE_INVALID);
    const key = keys.open(sealed.keyRef);
    try {
      return openSecret(key, { purpose, subject, keyRef: sealed.keyRef }, sealed);
    } finally {
      disposeKey(key);
    }
  };

  const deviceOf = (deviceId: string): string => {
    if (typeof deviceId !== 'string' || !DEVICE_ID.test(deviceId)) throw new CredentialStoreError(CredentialStoreFailure.ENVELOPE_INVALID);
    return deviceId;
  };
  const sessionKeyId = (keyId: string): string => {
    if (typeof keyId !== 'string' || !keyId.startsWith(SESSION_KEY_PREFIX) || !SESSION_ID.test(keyId.slice(SESSION_KEY_PREFIX.length))) throw new CredentialStoreError(CredentialStoreFailure.KEY_REF_INVALID);
    return keyId;
  };
  const wrapRef = (keyId: string): string => {
    if (typeof keyId !== 'string' || !WRAPPED_KEY_ID.test(keyId)) throw new CredentialStoreError(CredentialStoreFailure.KEY_REF_INVALID);
    return `${WRAP_PREFIX}${keyId}`;
  };
  const secretRef = (name: string): string => {
    if (typeof name !== 'string' || !SECRET_NAME.test(name)) throw new CredentialStoreError(CredentialStoreFailure.KEY_REF_INVALID);
    return `${SECRET_PREFIX}${name}`;
  };

  return {
    stt: {
      seal: async (plaintext) => sealWith(CredentialPurpose.STT_API_KEY, STT_SUBJECT, plaintext),
      open: (sealed) => openWith(CredentialPurpose.STT_API_KEY, STT_SUBJECT, sealed),
    },
    capture: {
      seal: async (deviceId, secret) => sealWith(CredentialPurpose.CAPTURE_DEVICE, deviceOf(deviceId), secret),
      open: (deviceId, sealed) => openWith(CredentialPurpose.CAPTURE_DEVICE, deviceOf(deviceId), sealed),
    },
    credentialKeys: {
      list: (purpose) => keys.list().filter((ref) => isKeyRefOf(purpose, ref)),
      retainOnly(purpose, stored) {
        const keep = new Set(stored);
        const destroyed: string[] = [];
        for (const ref of keys.list()) {
          if (!isKeyRefOf(purpose, ref) || keep.has(ref)) continue;
          if (keys.destroy(ref)) destroyed.push(ref);
        }
        return destroyed;
      },
    },
    sessionKeys: {
      create(sessionId, binding) {
        const keyId = sessionKeyId(`${SESSION_KEY_PREFIX}${sessionId}`);
        if (binding !== undefined && !SESSION_KEY_BINDING.test(binding)) throw new CredentialStoreError(CredentialStoreFailure.KEY_REF_INVALID);
        // A key that is there is never replaced (`KEY_EXISTS`), so a binding that is there without a key is a leftover of a key that was destroyed.
        if (!ownSessionKeys.has(keyId) && ownSessionKeys.hasBlob(keyId)) ownSessionKeys.destroyBlob(keyId);
        const key = ownSessionKeys.create(keyId);
        if (binding !== undefined) {
          try {
            ownSessionKeys.putBlob(keyId, Buffer.from(binding, 'utf8'));
          } catch (error) {
            // A key without its binding would be refused by every later seal: it is not left behind.
            disposeKey(key);
            ownSessionKeys.destroy(keyId);
            throw error;
          }
        }
        return { keyId, key };
      },
      bindingOf(keyId) {
        const id = sessionKeyId(keyId);
        if (!ownSessionKeys.has(id) || !ownSessionKeys.hasBlob(id)) return null;
        const text = ownSessionKeys.openBlob(id).toString('utf8');
        return SESSION_KEY_BINDING.test(text) ? text : null;
      },
      open(keyId) {
        const id = sessionKeyId(keyId);
        // This Core's own key first; a key of an earlier build in the shared folder only when it has none.
        const from = sharedSessionKeys !== null && !ownSessionKeys.has(id) && sharedSessionKeys.has(id) ? sharedSessionKeys : ownSessionKeys;
        return { keyId: id, key: from.open(id) };
      },
      has: (keyId) => ownSessionKeys.has(sessionKeyId(keyId)) || (sharedSessionKeys?.has(sessionKeyId(keyId)) ?? false),
      owns: (keyId) => ownSessionKeys.has(sessionKeyId(keyId)),
      destroy(keyId) {
        const id = sessionKeyId(keyId);
        const destroyed = ownSessionKeys.destroy(id);
        ownSessionKeys.destroyBlob(id);
        return destroyed;
      },
      release: (key) => disposeKey(key.key),
    },
    keyWrapSecrets: {
      get(keyId) {
        const ref = wrapRef(keyId);
        // Absent is an answer; a file that is there and cannot be trusted is a failure.
        return keys.hasBlob(ref) ? new Uint8Array(keys.openBlob(ref)) : null;
      },
      put: (keyId, secret) => keys.putBlob(wrapRef(keyId), secret),
    },
    namedSecrets: {
      put: (name, bytes) => keys.putBlob(secretRef(name), bytes),
      use(name, use) {
        const bytes = keys.openBlob(secretRef(name));
        try {
          return use(bytes);
        } finally {
          bytes.fill(0);
        }
      },
      has: (name) => keys.hasBlob(secretRef(name)),
    },
  };
}

// ── The store of an app ────────────────────────────────────────────────────────────────────────

export type CoreCredentialStoreStatus =
  | { readonly status: 'ABSENT' }
  | { readonly status: 'UNAVAILABLE'; readonly code: CredentialStoreFailure; readonly detail: string | null }
  | { readonly status: 'READY'; readonly store: CoreCredentialStore };

/** What the store needs of an app: its identity and its data directory. */
export interface CredentialStoreHost {
  readonly stages: object;
  /** `mediaStoreDir`: the media store root of this Core - the scope of its session keys (D180). Absent: the shared folder. */
  readonly config: { readonly dataDir: string; readonly mediaStoreDir?: string };
}

// Keyed by the app's stage registry: one object per app, the same from every scope of it
// (the `permissionGuard(app)` / `sttConfigControl(app)` idiom).
const stores = new WeakMap<object, CoreCredentialStoreStatus>();

/**
 * THE Core credential store of an app. Decided at the first call and the same answer ever after.
 * It makes no directory: the folders appear with the first key.
 */
export function coreCredentialStore(app: CredentialStoreHost): CoreCredentialStoreStatus {
  const known = stores.get(app.stages);
  if (known !== undefined) return known;
  let status: CoreCredentialStoreStatus;
  try {
    if (!dataDirectoryIsThere(app.config.dataDir)) {
      status = { status: 'ABSENT' };
    } else {
      const root = join(app.config.dataDir, CREDENTIAL_STORE_FOLDER);
      const keys = createFileKeyStore({ root });
      // Refuses a store directory that exists and is not private, before anything is sealed into it.
      keys.inspect();
      const mediaStoreDir = app.config.mediaStoreDir;
      const sessionKeyStore = typeof mediaStoreDir === 'string' && mediaStoreDir !== '' ? createFileKeyStore({ root, folder: sessionKeyFolderOf(mediaStoreDir) }) : undefined;
      // The same refusal for the folder of the session keys.
      sessionKeyStore?.inspect();
      status = { status: 'READY', store: createCredentialStore({ root, keys, ...(sessionKeyStore === undefined ? {} : { sessionKeyStore }) }) };
    }
  } catch (error) {
    status =
      error instanceof CredentialStoreError
        ? { status: 'UNAVAILABLE', code: error.code, detail: error.detail }
        : { status: 'UNAVAILABLE', code: CredentialStoreFailure.STORE_UNAVAILABLE, detail: errnoOf(error) };
  }
  stores.set(app.stages, status);
  return status;
}
