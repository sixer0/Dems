/**
 * Per-fragment AES-256-GCM (blueprint row 84, M7-W3; OD-03; capture spec §D.1 to §D.4; evidence
 * spec §A.3, §B.6; SEC35-10; hypothesis H-2). PURE: bytes and typed records in, bytes out. No
 * file, no clock, no database; the only outside thing is the random source of a nonce.
 *
 * WIRED (fix pass F-M7, R88-18): the Core seals at seal time (ruling D147). The callers are the seal-time cipher of
 * the sealing host (`sealing-host/session-key.ts`, CLOSE_TRACKS) and the Core's fragment opener
 * (`evidence-verify/fragment-opener.ts`: FINALIZE_HASHES, verify V-05, the media route, the export).
 *
 * THE SHAPE (§D.1). GCM is OUTSIDE the muxer. A camera file at rest is the fMP4 whose sealed byte
 * ranges are each ONE AES-256-GCM message. A ciphertext is exactly as long as its plaintext, so
 * every byte offset of the file is the same before and after sealing: the fragment records, the
 * stored-bytes hash chain and a Range request all speak of the same offsets. The 12-byte nonce,
 * the 16-byte tag and the key ID are NOT in the file: they are in the fragment record
 * (`gcmIv`, `gcmTag`, `keyId`; evidence spec §B.6 fields 75 to 77), so the stored bytes can be
 * hashed and chained without any key. Which bytes of a fragment are a sealed range (the whole
 * `moof`+`mdat`, or the payload with the boxes left clear) is the writer's decision: this module
 * seals the range it is handed and authenticates the position the record states.
 *
 * THE ADDITIONAL AUTHENTICATED DATA (SEC35-10) is derived, never stored: the canonical encoding of
 * `(trackId, seq, byteOffset, keyId)` built by `fragmentAad`. A ciphertext that is moved to
 * another position of the file, to the other track or under another key ID does not open, even
 * when its own nonce and tag travel with it.
 *
 * THE NONCE is 96 random bits per message. A sealer holds ONE key and remembers every nonce it
 * used: should the random source ever return one twice, nothing is encrypted (`NONCE_REUSED`).
 * With one key per session and one message per fragment the number of messages under a key is
 * far below the bound for random nonces. A sealer made anew (a restart) draws new random nonces
 * for the fragments it seals again: a nonce is never derived from a position.
 *
 * THE KEY is a session key of the Core credential store (`KID-<sessionId>`), handed in as opaque
 * key material. KEY LOSS = DATA UNREADABLE (SEC35-09): without it no function here opens
 * anything, while the stored-bytes verification still passes. There is no escrow.
 *
 * RANGE (§D.4). The least unit that can be opened is one sealed range: `planRangeRead` maps a byte
 * range of the file to the whole fragments it touches and the clear bytes between them, and
 * `readDecryptedRange` opens each touched fragment whole, verifies its tag, and only then gives
 * the bytes asked for.
 */
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { CredentialStoreError, CredentialStoreFailure, FragmentAuthenticationError } from './errors';
import { usingKeyBytes, type KeyMaterial } from './key-material';

export const FRAGMENT_NONCE_BYTES = 12;
export const FRAGMENT_TAG_BYTES = 16;
const CIPHER = 'aes-256-gcm';
const AAD_LABEL = Buffer.from('dems.fragment-aad/1\u0000', 'utf8');
const TRACK_ID = /^[A-Za-z0-9][A-Za-z0-9_-]{0,31}$/;
const KEY_ID = /^[A-Za-z0-9][A-Za-z0-9_-]{0,79}$/;
const HEX = /^[0-9a-f]+$/;
/** The most fragments one sealer seals: far below the bound for random 96-bit nonces under one key. */
export const FRAGMENT_SEALER_LIMIT = 2 ** 24;

/** A session key and its ID, as the credential store hands them out. */
export interface FragmentKey {
  readonly keyId: string;
  readonly key: KeyMaterial;
}

/** Where a sealed range is: the members of a fragment record that are authenticated (§B.6 fields 62 to 64, 77). */
export interface FragmentPosition {
  readonly trackId: string;
  /** `mfhd.sequence_number`, 1 or more. */
  readonly seq: number;
  /** The offset of the sealed range in the file. */
  readonly byteOffset: number | bigint;
  readonly keyId: string;
}

/** What opening needs of a fragment record. */
export interface SealedFragmentRecord extends FragmentPosition {
  readonly byteLength: number | bigint;
  /** 12 bytes, lower-case hex. */
  readonly gcmIv: string;
  /** 16 bytes, lower-case hex. */
  readonly gcmTag: string;
}

/** What sealing gives: the stored bytes, and the three values of the record. */
export interface SealedFragment {
  readonly ciphertext: Uint8Array;
  readonly gcmIv: string;
  readonly gcmTag: string;
  readonly keyId: string;
}

function invalid(): never {
  throw new CredentialStoreError(CredentialStoreFailure.FRAGMENT_INPUT_INVALID);
}

function wholeNumber(value: number | bigint, least: bigint): bigint {
  if (typeof value === 'number' && !Number.isSafeInteger(value)) invalid();
  if (typeof value !== 'number' && typeof value !== 'bigint') invalid();
  const big = BigInt(value);
  if (big < least || big > 0xffff_ffff_ffff_ffffn) invalid();
  return big;
}

/**
 * The canonical encoding of `(trackId, seq, byteOffset, keyId)`:
 *
 *   "dems.fragment-aad/1" 0x00 | u16 length, trackId (ASCII) | u64 seq | u64 byteOffset | u16 length, keyId (ASCII)
 *
 * all integers big endian. Every part has a length or a fixed width: two different positions
 * never give the same bytes.
 */
export function fragmentAad(position: FragmentPosition): Buffer {
  if (typeof position.trackId !== 'string' || !TRACK_ID.test(position.trackId)) invalid();
  if (typeof position.keyId !== 'string' || !KEY_ID.test(position.keyId)) invalid();
  const track = Buffer.from(position.trackId, 'ascii');
  const keyId = Buffer.from(position.keyId, 'ascii');
  const numbers = Buffer.alloc(16);
  numbers.writeBigUInt64BE(wholeNumber(position.seq, 1n), 0);
  numbers.writeBigUInt64BE(wholeNumber(position.byteOffset, 0n), 8);
  const trackLength = Buffer.alloc(2);
  trackLength.writeUInt16BE(track.byteLength, 0);
  const keyLength = Buffer.alloc(2);
  keyLength.writeUInt16BE(keyId.byteLength, 0);
  return Buffer.concat([AAD_LABEL, trackLength, track, numbers, keyLength, keyId]);
}

export interface FragmentSealerOptions {
  /** A test hands in a source of its own. */
  readonly randomNonce?: () => Uint8Array;
}

export interface FragmentSealer {
  readonly keyId: string;
  /** Seals one range. `ciphertext` is as long as `plaintext`; the caller's buffer is not changed. */
  seal(position: Omit<FragmentPosition, 'keyId'>, plaintext: Uint8Array): SealedFragment;
  /** How many ranges this sealer sealed. */
  sealed(): number;
}

/**
 * One sealer OBJECT remembers the nonces it used and refuses a repeat. THE HONEST RULE (fix pass
 * F-M7, R88-13): the nonce is 96 RANDOM bits per message, so uniqueness under a key is
 * PROBABILISTIC, never proven. This memo holds only for the life of this object: the sealing host
 * builds a sealer per fragment and keeps its own per-key memo for the life of the process
 * (`sealing-host/session-key.ts`); across a restarted CLOSE_TRACKS, across processes, and across a
 * demo reseed that reuses `KID-<sessionId>`, nothing is remembered and nothing counts the messages
 * of a key. With a few thousand messages per key the collision bound of random 96-bit nonces is
 * far away; the claim "a nonce is never used twice under a key" is not one this code can make.
 */
export function createFragmentSealer(sessionKey: FragmentKey, options: FragmentSealerOptions = {}): FragmentSealer {
  const used = new Set<string>();
  const draw = options.randomNonce ?? ((): Uint8Array => randomBytes(FRAGMENT_NONCE_BYTES));
  return {
    keyId: sessionKey.keyId,
    sealed: () => used.size,
    seal(position, plaintext) {
      if (!(plaintext instanceof Uint8Array) || plaintext.byteLength === 0) invalid();
      const aad = fragmentAad({ ...position, keyId: sessionKey.keyId });
      if (used.size >= FRAGMENT_SEALER_LIMIT) throw new CredentialStoreError(CredentialStoreFailure.NONCE_REUSED);
      const nonce = Buffer.from(draw());
      if (nonce.byteLength !== FRAGMENT_NONCE_BYTES) invalid();
      const gcmIv = nonce.toString('hex');
      if (used.has(gcmIv)) throw new CredentialStoreError(CredentialStoreFailure.NONCE_REUSED);
      return usingKeyBytes(sessionKey.key, (bytes) => {
        const cipher = createCipheriv(CIPHER, bytes, nonce, { authTagLength: FRAGMENT_TAG_BYTES });
        cipher.setAAD(aad);
        const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
        // Remembered only once a message exists under it.
        used.add(gcmIv);
        return { ciphertext: new Uint8Array(ciphertext), gcmIv, gcmTag: cipher.getAuthTag().toString('hex'), keyId: sessionKey.keyId };
      });
    },
  };
}

function hexBytes(value: string, bytes: number): Buffer {
  if (typeof value !== 'string' || value.length !== bytes * 2 || !HEX.test(value)) invalid();
  return Buffer.from(value, 'hex');
}

/**
 * Opens one sealed range. `stored` is the whole range, `byteLength` bytes. Throws a
 * `FragmentAuthenticationError` naming `(trackId, seq)` when the tag does not verify: altered
 * bytes, an altered nonce or tag, another position, another key. No byte is returned then.
 */
export function openFragment(sessionKey: FragmentKey, record: SealedFragmentRecord, stored: Uint8Array): Uint8Array {
  const aad = fragmentAad(record);
  const nonce = hexBytes(record.gcmIv, FRAGMENT_NONCE_BYTES);
  const tag = hexBytes(record.gcmTag, FRAGMENT_TAG_BYTES);
  if (!(stored instanceof Uint8Array) || BigInt(stored.byteLength) !== wholeNumber(record.byteLength, 1n)) invalid();
  // A record of another key is not opened with this one, whatever the tag would say.
  if (record.keyId !== sessionKey.keyId) throw new FragmentAuthenticationError(record.trackId, record.seq);
  try {
    return usingKeyBytes(sessionKey.key, (bytes) => {
      const decipher = createDecipheriv(CIPHER, bytes, nonce, { authTagLength: FRAGMENT_TAG_BYTES });
      decipher.setAAD(aad);
      decipher.setAuthTag(tag);
      return new Uint8Array(Buffer.concat([decipher.update(stored), decipher.final()]));
    });
  } catch (error) {
    if (error instanceof CredentialStoreError && error.code === CredentialStoreFailure.KEY_NOT_FOUND) throw error;
    throw new FragmentAuthenticationError(record.trackId, record.seq);
  }
}

// ── Range (§D.4) ───────────────────────────────────────────────────────────────────────────────

/** A half-open byte range of the file: `[start, end)`. */
export interface ByteRange {
  readonly start: number;
  readonly end: number;
}

/** One piece of a range read, in file order. */
export type RangeSegment =
  /** Bytes outside every sealed range (the container header, clear boxes): served as stored. */
  | { readonly kind: 'CLEAR'; readonly start: number; readonly end: number }
  /** A sealed range that must be read and opened WHOLE; `from`/`to` are the wanted bytes inside its plaintext. */
  | { readonly kind: 'FRAGMENT'; readonly record: SealedFragmentRecord; readonly from: number; readonly to: number };

function rangeInvalid(): never {
  throw new CredentialStoreError(CredentialStoreFailure.RANGE_INVALID);
}

function offsetOf(value: number | bigint): number {
  const big = wholeNumber(value, 0n);
  if (big > BigInt(Number.MAX_SAFE_INTEGER)) rangeInvalid();
  return Number(big);
}

/**
 * Maps `[start, end)` of ONE camera file to the pieces a reader needs. `records` are the sealed
 * ranges of that file; they are checked to be in ascending order without overlap.
 */
export function planRangeRead(records: readonly SealedFragmentRecord[], range: ByteRange): RangeSegment[] {
  if (!Number.isSafeInteger(range.start) || !Number.isSafeInteger(range.end) || range.start < 0 || range.end <= range.start) rangeInvalid();
  const segments: RangeSegment[] = [];
  let cursor = range.start;
  let previousEnd = 0;
  for (const record of records) {
    const first = offsetOf(record.byteOffset);
    const length = offsetOf(record.byteLength);
    if (length < 1 || first < previousEnd) rangeInvalid();
    const last = first + length;
    previousEnd = last;
    if (last <= cursor) continue;
    if (first >= range.end) break;
    if (first > cursor) {
      segments.push({ kind: 'CLEAR', start: cursor, end: first });
      cursor = first;
    }
    const to = Math.min(range.end, last);
    segments.push({ kind: 'FRAGMENT', record, from: cursor - first, to: to - first });
    cursor = to;
    if (cursor >= range.end) break;
  }
  if (cursor < range.end) segments.push({ kind: 'CLEAR', start: cursor, end: range.end });
  return segments;
}

/** Reads `length` stored bytes of the camera file at `offset`. */
export type StoredRangeReader = (offset: number, length: number) => Promise<Uint8Array> | Uint8Array;

export interface DecryptedRangeRequest {
  readonly sessionKey: FragmentKey;
  readonly records: readonly SealedFragmentRecord[];
  readonly range: ByteRange;
  readonly read: StoredRangeReader;
}

/**
 * The plaintext of `[start, end)`. Every touched fragment is read whole and its tag is verified
 * BEFORE any byte of the answer exists for the caller: a failure throws and gives nothing.
 */
export async function readDecryptedRange(request: DecryptedRangeRequest): Promise<Uint8Array> {
  const segments = planRangeRead(request.records, request.range);
  const parts: Uint8Array[] = [];
  for (const segment of segments) {
    if (segment.kind === 'CLEAR') {
      const clear = await request.read(segment.start, segment.end - segment.start);
      if (clear.byteLength !== segment.end - segment.start) rangeInvalid();
      parts.push(clear);
      continue;
    }
    const stored = await request.read(offsetOf(segment.record.byteOffset), offsetOf(segment.record.byteLength));
    const plain = openFragment(request.sessionKey, segment.record, stored);
    parts.push(plain.subarray(segment.from, segment.to));
  }
  return new Uint8Array(Buffer.concat(parts));
}
