/**
 * Key material as an opaque object (blueprint row 84; capture spec §D.2 "no key, no key-derived
 * value" in audit or log; G-R4).
 *
 * A key travels through the server as a `KeyMaterial`: it has no enumerable member, and turned
 * into text, into JSON or into an inspection it gives a fixed mark. Its 32 bytes are read by ONE
 * function, `usingKeyBytes`, which this folder's index does not export: only the two ciphers of
 * this folder (`envelope.ts`, `fragment-cipher.ts`) call it. A static test holds that.
 *
 * `disposeKey` overwrites the bytes this object holds. It is a best effort: the runtime may have
 * copied them (no zeroing of process memory is claimed).
 */
import { CredentialStoreError, CredentialStoreFailure } from './errors';

export const KEY_BYTES = 32;
/** What a key shows wherever it is printed. */
export const KEY_MARK = '[key]';

const INSPECT = Symbol.for('nodejs.util.inspect.custom');
const VAULT = new WeakMap<object, Buffer>();

export class KeyMaterial {
  constructor() {
    Object.freeze(this);
  }
  toString(): string {
    return KEY_MARK;
  }
  toJSON(): string {
    return KEY_MARK;
  }
  [INSPECT](): string {
    return KEY_MARK;
  }
}

/** Wraps a COPY of 32 bytes. The caller overwrites its own buffer. */
export function keyMaterialOf(bytes: Uint8Array): KeyMaterial {
  if (!(bytes instanceof Uint8Array) || bytes.byteLength !== KEY_BYTES) throw new CredentialStoreError(CredentialStoreFailure.KEY_UNSAFE);
  const key = new KeyMaterial();
  VAULT.set(key, Buffer.from(bytes));
  return key;
}

/** Hands the bytes to one cipher call. They exist inside `use` only. */
export function usingKeyBytes<T>(key: KeyMaterial, use: (bytes: Buffer) => T): T {
  const bytes = VAULT.get(key);
  // A disposed key, or an object this file did not make.
  if (bytes === undefined) throw new CredentialStoreError(CredentialStoreFailure.KEY_NOT_FOUND);
  return use(bytes);
}

/** Overwrites the held bytes and forgets them. Harmless when called twice. */
export function disposeKey(key: KeyMaterial): void {
  const bytes = VAULT.get(key);
  if (bytes === undefined) return;
  bytes.fill(0);
  VAULT.delete(key);
}
