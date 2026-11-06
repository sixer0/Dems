/**
 * The credential envelope, version 1 (blueprint row 84; SEC35-03; database contract §B.3, §B.13,
 * finding F-122-2). Pure: bytes in, bytes out, no file, no clock.
 *
 * WHAT IS STORED, in the three columns the two credential tables have:
 *
 *   key_ref / credential_ref   the reference of the key (a CODE), never key material
 *   nonce                      12 random bytes, drawn for this envelope
 *   secret_ciphertext          AES-256-GCM( frame ) followed by the 16-byte tag
 *
 * THE FRAME (what is encrypted). The secret is never encrypted bare:
 *
 *   byte 0        the envelope version, 1
 *   bytes 1-2     the length of the secret in bytes, big endian
 *   bytes 3..     the secret, UTF-8
 *   rest          zero bytes up to the next multiple of 64
 *
 * So a frame is 64 bytes or a multiple, and a stored ciphertext is at least 80 bytes: a
 * one-character camera password passes `capture_device_credentials_secret_check`
 * (`octet_length >= 33`, F-122-2) and `stt_config_secret_check` (>= 17), and the stored length
 * tells an observer the length of a secret only to the next 64 bytes.
 *
 * THE ADDITIONAL AUTHENTICATED DATA binds an envelope to what it is for: the envelope version,
 * the purpose (`STT_API_KEY`, `CAPTURE_DEVICE`), the subject (the device of a camera credential)
 * and the key reference. An envelope moved to another row, another purpose or another key
 * reference does not open. The version is authenticated twice: in this data and in the frame.
 *
 * OPENING FAILS CLOSED, with one code for a wrong key, altered bytes and a foreign context
 * (`OPEN_FAILED`): the caller learns that it did not open, never why and never a partial value.
 */
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { CredentialStoreError, CredentialStoreFailure } from './errors';
import { usingKeyBytes, type KeyMaterial } from './key-material';

export const ENVELOPE_VERSION = 1;
export const ENVELOPE_ALGORITHM = 'AES-256-GCM';
export const ENVELOPE_NONCE_BYTES = 12;
export const ENVELOPE_TAG_BYTES = 16;
/** A frame is a multiple of this many bytes. */
export const ENVELOPE_FRAME_BLOCK = 64;
const FRAME_HEADER_BYTES = 3;
/** The API takes a secret of at most 1024 characters; in UTF-8 that is at most 4096 bytes. */
export const ENVELOPE_MAX_SECRET_BYTES = 4096;
/** The least a stored ciphertext can be: one frame block and the tag. */
export const ENVELOPE_MIN_CIPHERTEXT_BYTES = ENVELOPE_FRAME_BLOCK + ENVELOPE_TAG_BYTES;

const CIPHER = 'aes-256-gcm';
const AAD_LABEL = 'dems.credential-envelope';
/** A purpose and a subject: a code or an identifier, never free text (and so never a separator). */
const CONTEXT_PART = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,119}$/;

/** What an envelope is for. Part of what is authenticated, not of what is stored. */
export interface EnvelopeContext {
  readonly purpose: string;
  /** The row the envelope belongs to: a device ID, or the name of a singleton. */
  readonly subject: string;
  readonly keyRef: string;
}

/** The three stored values of a sealed secret. Never the key, never the plaintext. */
export interface SealedSecret {
  readonly keyRef: string;
  /** Ciphertext followed by its tag: 80 bytes or more. */
  readonly ciphertext: Uint8Array;
  /** 12 bytes. */
  readonly nonce: Uint8Array;
}

function aadOf(context: EnvelopeContext): Buffer {
  for (const part of [context.purpose, context.subject, context.keyRef]) {
    if (typeof part !== 'string' || !CONTEXT_PART.test(part)) throw new CredentialStoreError(CredentialStoreFailure.ENVELOPE_INVALID);
  }
  return Buffer.from([`${AAD_LABEL}/${ENVELOPE_VERSION}`, context.purpose, context.subject, context.keyRef].join('\u0000'), 'utf8');
}

/** The padded frame of a secret. The caller overwrites it after use. */
function frameOf(secret: string): Buffer {
  if (typeof secret !== 'string' || secret.length === 0) throw new CredentialStoreError(CredentialStoreFailure.PLAINTEXT_INVALID);
  const text = Buffer.from(secret, 'utf8');
  // A lone surrogate would be stored as a replacement character: what opens must be what was sealed.
  if (text.byteLength > ENVELOPE_MAX_SECRET_BYTES || text.toString('utf8') !== secret) {
    text.fill(0);
    throw new CredentialStoreError(CredentialStoreFailure.PLAINTEXT_INVALID);
  }
  const length = Math.ceil((FRAME_HEADER_BYTES + text.byteLength) / ENVELOPE_FRAME_BLOCK) * ENVELOPE_FRAME_BLOCK;
  const frame = Buffer.alloc(length);
  frame.writeUInt8(ENVELOPE_VERSION, 0);
  frame.writeUInt16BE(text.byteLength, 1);
  text.copy(frame, FRAME_HEADER_BYTES);
  text.fill(0);
  return frame;
}

export interface SealOptions {
  /** A test hands in a source of its own. */
  readonly randomNonce?: () => Uint8Array;
}

export function sealSecret(key: KeyMaterial, context: EnvelopeContext, secret: string, options: SealOptions = {}): SealedSecret {
  const aad = aadOf(context);
  const frame = frameOf(secret);
  try {
    const nonce = Buffer.from(options.randomNonce?.() ?? randomBytes(ENVELOPE_NONCE_BYTES));
    if (nonce.byteLength !== ENVELOPE_NONCE_BYTES) throw new CredentialStoreError(CredentialStoreFailure.ENVELOPE_INVALID);
    return usingKeyBytes(key, (bytes) => {
      const cipher = createCipheriv(CIPHER, bytes, nonce, { authTagLength: ENVELOPE_TAG_BYTES });
      cipher.setAAD(aad);
      const body = Buffer.concat([cipher.update(frame), cipher.final()]);
      return storeSealed({ keyRef: context.keyRef, ciphertext: new Uint8Array(Buffer.concat([body, cipher.getAuthTag()])), nonce: new Uint8Array(nonce) });
    });
  } finally {
    frame.fill(0);
  }
}

/**
 * THE BRAND (fix F-M4; review row 69, question 2): the objects `sealSecret` itself returned, and no
 * other. A caller that must write a sealed secret to a table asks `isStoreSealedSecret` instead of
 * inspecting bytes: an answer of anything else - a stand-in sealer, a copy, a hand-built object of
 * the right form - is not in the set, whatever it holds. Nothing outside this file can add to it.
 * The set holds the objects weakly and keeps no secret: an envelope is ciphertext.
 */
declare const STORE_SEALED: unique symbol;
export type StoreSealedSecret = SealedSecret & { readonly [STORE_SEALED]: true };
const sealedByStore = new WeakSet<object>();
function storeSealed(sealed: SealedSecret): StoreSealedSecret {
  Object.freeze(sealed);
  sealedByStore.add(sealed);
  return sealed as StoreSealedSecret;
}

/** True for an object `sealSecret` returned, still of the form it gave it. Says nothing about whether it opens. */
export function isStoreSealedSecret(sealed: unknown): sealed is StoreSealedSecret {
  return typeof sealed === 'object' && sealed !== null && sealedByStore.has(sealed) && isSealedSecret(sealed as SealedSecret);
}

/** True when the three values have the form `sealSecret` gives them. Says nothing about whether they open. */
export function isSealedSecret(sealed: SealedSecret): boolean {
  return (
    typeof sealed === 'object' &&
    sealed !== null &&
    typeof sealed.keyRef === 'string' &&
    sealed.ciphertext instanceof Uint8Array &&
    sealed.nonce instanceof Uint8Array &&
    sealed.nonce.byteLength === ENVELOPE_NONCE_BYTES &&
    sealed.ciphertext.byteLength >= ENVELOPE_MIN_CIPHERTEXT_BYTES &&
    (sealed.ciphertext.byteLength - ENVELOPE_TAG_BYTES) % ENVELOPE_FRAME_BLOCK === 0 &&
    sealed.ciphertext.byteLength - ENVELOPE_TAG_BYTES <= FRAME_HEADER_BYTES + ENVELOPE_MAX_SECRET_BYTES + ENVELOPE_FRAME_BLOCK
  );
}

export function openSecret(key: KeyMaterial, context: EnvelopeContext, sealed: SealedSecret): string {
  if (!isSealedSecret(sealed) || sealed.keyRef !== context.keyRef) throw new CredentialStoreError(CredentialStoreFailure.ENVELOPE_INVALID);
  const aad = aadOf(context);
  const stored = Buffer.from(sealed.ciphertext);
  const body = stored.subarray(0, stored.byteLength - ENVELOPE_TAG_BYTES);
  const tag = stored.subarray(stored.byteLength - ENVELOPE_TAG_BYTES);
  let frame: Buffer;
  try {
    frame = usingKeyBytes(key, (bytes) => {
      const decipher = createDecipheriv(CIPHER, bytes, Buffer.from(sealed.nonce), { authTagLength: ENVELOPE_TAG_BYTES });
      decipher.setAAD(aad);
      decipher.setAuthTag(tag);
      return Buffer.concat([decipher.update(body), decipher.final()]);
    });
  } catch (error) {
    // A key that is gone is its own answer; everything else is "did not open", with no cause attached.
    if (error instanceof CredentialStoreError && error.code === CredentialStoreFailure.KEY_NOT_FOUND) throw error;
    throw new CredentialStoreError(CredentialStoreFailure.OPEN_FAILED);
  }
  try {
    const length = frame.readUInt16BE(1);
    if (frame.readUInt8(0) !== ENVELOPE_VERSION || length === 0 || FRAME_HEADER_BYTES + length > frame.byteLength) throw new CredentialStoreError(CredentialStoreFailure.OPEN_FAILED);
    if (frame.subarray(FRAME_HEADER_BYTES + length).some((byte) => byte !== 0)) throw new CredentialStoreError(CredentialStoreFailure.OPEN_FAILED);
    return frame.toString('utf8', FRAME_HEADER_BYTES, FRAME_HEADER_BYTES + length);
  } finally {
    frame.fill(0);
  }
}
