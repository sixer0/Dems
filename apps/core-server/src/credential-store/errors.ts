/**
 * The failures of the Core credential store (blueprint row 84; SEC35-03, SEC35-08).
 *
 * A failure is a CODE and a fixed sentence. It never carries a key, a plaintext, a ciphertext, a
 * path or the message of the error underneath: what a file-system call threw is reduced to its
 * `errno` name (`EACCES`, `ENOSPC`), which names a cause and no value. A caller logs the code.
 */

export const CredentialStoreFailure = {
  /** The directory of the store cannot be made or read. */
  STORE_UNAVAILABLE: 'CREDENTIAL_STORE_UNAVAILABLE',
  /** The directory exists but is not a private directory of this user (mode, owner or kind). */
  STORE_UNSAFE: 'CREDENTIAL_STORE_UNSAFE',
  KEY_REF_INVALID: 'CREDENTIAL_KEY_REF_INVALID',
  /** A key of that reference exists: a key is made once and never replaced in place. */
  KEY_EXISTS: 'CREDENTIAL_KEY_EXISTS',
  /** No key of that reference: what it sealed cannot be opened (key lost = data unreadable). */
  KEY_NOT_FOUND: 'CREDENTIAL_KEY_NOT_FOUND',
  /** The key file is not a private regular file of this user, or is not a key file. */
  KEY_UNSAFE: 'CREDENTIAL_KEY_UNSAFE',
  KEY_WRITE_FAILED: 'CREDENTIAL_KEY_WRITE_FAILED',
  /** The value to seal is empty, too long or not text. */
  PLAINTEXT_INVALID: 'CREDENTIAL_PLAINTEXT_INVALID',
  /** The stored envelope does not have the form of one (lengths, reference). */
  ENVELOPE_INVALID: 'CREDENTIAL_ENVELOPE_INVALID',
  /** Authentication failed: wrong key, altered bytes or another context. One code for all three. */
  OPEN_FAILED: 'CREDENTIAL_OPEN_FAILED',
  FRAGMENT_INPUT_INVALID: 'FRAGMENT_INPUT_INVALID',
  /** A fragment's tag does not verify: its bytes, its position or its key are not the sealed ones. */
  FRAGMENT_AUTH_FAILED: 'FRAGMENT_AUTH_FAILED',
  /** The random source returned a nonce this key already used. Nothing is encrypted. */
  NONCE_REUSED: 'FRAGMENT_NONCE_REUSED',
  RANGE_INVALID: 'FRAGMENT_RANGE_INVALID',
} as const;
export type CredentialStoreFailure = (typeof CredentialStoreFailure)[keyof typeof CredentialStoreFailure];

const SENTENCES: Record<CredentialStoreFailure, string> = {
  CREDENTIAL_STORE_UNAVAILABLE: 'the Core credential store cannot be reached',
  CREDENTIAL_STORE_UNSAFE: 'the Core credential store is not a private directory of the server user',
  CREDENTIAL_KEY_REF_INVALID: 'the key reference does not have the form of one',
  CREDENTIAL_KEY_EXISTS: 'a key of that reference exists already',
  CREDENTIAL_KEY_NOT_FOUND: 'the Core credential store holds no key of that reference',
  CREDENTIAL_KEY_UNSAFE: 'the key file is not a private key file of the server user',
  CREDENTIAL_KEY_WRITE_FAILED: 'the key could not be written to the Core credential store',
  CREDENTIAL_PLAINTEXT_INVALID: 'the value cannot be sealed',
  CREDENTIAL_ENVELOPE_INVALID: 'the stored envelope does not have the form of one',
  CREDENTIAL_OPEN_FAILED: 'the stored envelope could not be opened',
  FRAGMENT_INPUT_INVALID: 'the fragment is not described as the cipher needs it',
  FRAGMENT_AUTH_FAILED: 'the fragment failed its authentication',
  FRAGMENT_NONCE_REUSED: 'a nonce was drawn twice for one key',
  FRAGMENT_RANGE_INVALID: 'the byte range or the fragment records are not usable',
};

export class CredentialStoreError extends Error {
  readonly code: CredentialStoreFailure;
  /** The `errno` name of a file-system failure, or null. Never a message, never a path. */
  readonly detail: string | null;

  constructor(code: CredentialStoreFailure, detail: string | null = null) {
    super(SENTENCES[code]);
    this.name = 'CredentialStoreError';
    this.code = code;
    this.detail = detail;
  }
}

/** The fragment that failed, by its two identifiers: what the tamper locator names (H-2). */
export class FragmentAuthenticationError extends CredentialStoreError {
  readonly trackId: string;
  readonly seq: number;

  constructor(trackId: string, seq: number) {
    super(CredentialStoreFailure.FRAGMENT_AUTH_FAILED);
    this.name = 'FragmentAuthenticationError';
    this.trackId = trackId;
    this.seq = seq;
  }
}

/** The `errno` name of a thrown file-system error (`ENOENT`), or null. */
export function errnoOf(error: unknown): string | null {
  const code = (error as { code?: unknown } | null)?.code;
  return typeof code === 'string' && /^E[A-Z0-9]{2,20}$/.test(code) ? code : null;
}
