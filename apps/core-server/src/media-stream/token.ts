/**
 * The signed media session token (blueprint row 90, M8-W1; C3 §2.4 "Media-session signing, binding
 * and TTL"; SEC35-12, SEC35-13; E-31). PURE: bytes in, bytes out. No key, no clock, no random
 * source of its own: the MAC is computed by a function it is handed (`store-door.ts`).
 *
 * THE FORM. `mts_` and one unpadded base64url text, so the whole token is `[A-Za-z0-9_-]` after
 * its prefix and both client log-blanking lists blank it WHOLE by the prefix rule (a separator
 * such as `.` would leave the half behind it in a log). Decoded:
 *
 *   payload   u8 version (1) | u8 file (1 = VIDEO-01, 2 = VIDEO-02) | u48 expiresAt (ms, big endian)
 *             | 8 bytes nonce | u8 length, evidenceId (ASCII)
 *   mac       HMAC-SHA-256, 32 bytes, over
 *             "dems.media-session/1" 0x00 | payload | u16 length, operatorId | u16 length, sessionId
 *
 * THE BINDING (SEC35-12): `(operatorId, sessionId, evidenceId, fileId)` and the expiry are ALL
 * under the one MAC. The evidence item, the file and the expiry travel in the token; the operator
 * and the auth session do NOT - they are taken from the principal of the request that presents
 * the token and enter the MAC from there. So a token presented by another operator, or by the
 * same operator in another sign-in session, does not verify, and a token whose item, file or
 * expiry was edited does not verify either: one comparison, in constant time, and no way to learn
 * WHICH component differed. A session that ended resolves to no principal at all (stage 4), so a
 * token dies with its session at the latest.
 *
 * THE REPLAY WINDOW is exactly the lifetime: a token is not single-use (a player asks for many
 * ranges with it), so whoever holds the token AND the session credential it is bound to can ask
 * again until `expiresAt`. Without that credential the token is worth nothing.
 *
 * NOTHING HERE LOGS. A refusal is a code, never a part of the token.
 */
import { timingSafeEqual } from 'node:crypto';
import { EVIDENCE_ID_PATTERN, EVIDENCE_MEDIA_TOKEN_PREFIX } from '@dems/shared/api';
import { VIDEO_TRACK_IDS, type PackageVideoTrackId } from '@dems/shared/evidence-package';

export const MEDIA_TOKEN_VERSION = 1;
export const MEDIA_TOKEN_NONCE_BYTES = 8;
export const MEDIA_TOKEN_MAC_BYTES = 32;
/**
 * The longest token this server issues or reads: the router's bound of one path parameter (100
 * characters). A token of an evidence ID (16 characters) is 91.
 */
export const MEDIA_TOKEN_MAX_CHARS = 100;
/** `mts_` and unpadded base64url: the form the route's path parameter is held to before anything is decoded. */
export const MEDIA_TOKEN_PATTERN = new RegExp(`^${EVIDENCE_MEDIA_TOKEN_PREFIX}[A-Za-z0-9_-]{60,${MEDIA_TOKEN_MAX_CHARS - EVIDENCE_MEDIA_TOKEN_PREFIX.length}}$`);

const MAC_LABEL = Buffer.from('dems.media-session/1\u0000', 'utf8');
const HEAD_BYTES = 1 + 1 + 6 + MEDIA_TOKEN_NONCE_BYTES + 1;
const PRINCIPAL_PART = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/;
const MAX_EXPIRES_AT = 2 ** 48 - 1;

/** Computes the MAC of a message under the media-session signing key. The key never leaves its store. */
export type MediaSessionMac = (message: Uint8Array) => Uint8Array;

/** Who presents (or is issued) a token: the two components that are NOT in it. */
export interface MediaTokenHolder {
  readonly operatorId: string;
  /** The ID of the auth-session row (`Principal.sessionId`); never the session token. */
  readonly sessionId: string;
}

/** What a token says, once its MAC verified. */
export interface MediaTokenClaims {
  readonly evidenceId: string;
  readonly fileId: PackageVideoTrackId;
  /** Core clock, epoch milliseconds: the last instant the token is accepted is the one before it. */
  readonly expiresAt: number;
}

export const MediaTokenRefusal = {
  /** Not a token of this form, a MAC that does not verify, another operator, another session: ONE code. */
  INVALID: 'MEDIA_SESSION_INVALID',
  /** An authentic token of this holder whose lifetime is over. */
  EXPIRED: 'MEDIA_SESSION_EXPIRED',
} as const;
export type MediaTokenRefusal = (typeof MediaTokenRefusal)[keyof typeof MediaTokenRefusal];

export type MediaTokenReading = { readonly ok: true; readonly claims: MediaTokenClaims } | { readonly ok: false; readonly refusal: MediaTokenRefusal };

function lengthPrefixed(text: string): Buffer {
  if (typeof text !== 'string' || !PRINCIPAL_PART.test(text)) throw new Error('a media session is bound to an operator ID and a session ID of the usual form');
  const bytes = Buffer.from(text, 'ascii');
  const length = Buffer.alloc(2);
  length.writeUInt16BE(bytes.byteLength, 0);
  return Buffer.concat([length, bytes]);
}

/** The bytes the MAC covers: the payload and the two components that are not in the token. */
function macInput(payload: Uint8Array, holder: MediaTokenHolder): Buffer {
  return Buffer.concat([MAC_LABEL, payload, lengthPrefixed(holder.operatorId), lengthPrefixed(holder.sessionId)]);
}

function payloadOf(claims: MediaTokenClaims, nonce: Uint8Array): Buffer {
  const file = VIDEO_TRACK_IDS.indexOf(claims.fileId);
  if (file === -1) throw new Error('a media session plays VIDEO-01 or VIDEO-02');
  if (!EVIDENCE_ID_PATTERN.test(claims.evidenceId)) throw new Error('a media session is of one evidence item');
  if (!Number.isSafeInteger(claims.expiresAt) || claims.expiresAt < 0 || claims.expiresAt > MAX_EXPIRES_AT) throw new Error('the expiry of a media session is an instant of the Core clock');
  if (!(nonce instanceof Uint8Array) || nonce.byteLength !== MEDIA_TOKEN_NONCE_BYTES) throw new Error('the nonce of a media session is 8 bytes');
  const evidence = Buffer.from(claims.evidenceId, 'ascii');
  const head = Buffer.alloc(HEAD_BYTES);
  head.writeUInt8(MEDIA_TOKEN_VERSION, 0);
  head.writeUInt8(file + 1, 1);
  head.writeUIntBE(claims.expiresAt, 2, 6);
  Buffer.from(nonce).copy(head, 8);
  head.writeUInt8(evidence.byteLength, 8 + MEDIA_TOKEN_NONCE_BYTES);
  return Buffer.concat([head, evidence]);
}

/** A new token for `holder`. `nonce` is 8 random bytes: two sessions of one instant are two tokens. */
export function issueMediaToken(claims: MediaTokenClaims, holder: MediaTokenHolder, nonce: Uint8Array, mac: MediaSessionMac): string {
  const payload = payloadOf(claims, nonce);
  const tag = Buffer.from(mac(macInput(payload, holder)));
  if (tag.byteLength !== MEDIA_TOKEN_MAC_BYTES) throw new Error('the MAC of a media session is 32 bytes');
  return `${EVIDENCE_MEDIA_TOKEN_PREFIX}${Buffer.concat([payload, tag]).toString('base64url')}`;
}

const INVALID: MediaTokenReading = Object.freeze({ ok: false, refusal: MediaTokenRefusal.INVALID });

/**
 * Reads a token as `holder` presents it at `now`. The MAC is verified BEFORE any claim is believed
 * (the expiry included), in constant time; everything that is not an authentic token of exactly
 * this holder is `MEDIA_SESSION_INVALID`. Never throws.
 */
export function readMediaToken(token: unknown, holder: MediaTokenHolder, now: number, mac: MediaSessionMac): MediaTokenReading {
  try {
    if (typeof token !== 'string' || !MEDIA_TOKEN_PATTERN.test(token)) return INVALID;
    const text = token.slice(EVIDENCE_MEDIA_TOKEN_PREFIX.length);
    const bytes = Buffer.from(text, 'base64url');
    // One text per byte string: a token with stray trailing bits is not the token that was issued.
    if (bytes.toString('base64url') !== text) return INVALID;
    if (bytes.byteLength < HEAD_BYTES + 1 + MEDIA_TOKEN_MAC_BYTES) return INVALID;
    const payload = bytes.subarray(0, bytes.byteLength - MEDIA_TOKEN_MAC_BYTES);
    const presented = bytes.subarray(bytes.byteLength - MEDIA_TOKEN_MAC_BYTES);
    const expected = Buffer.from(mac(macInput(payload, holder)));
    if (expected.byteLength !== MEDIA_TOKEN_MAC_BYTES || !timingSafeEqual(expected, presented)) return INVALID;

    // Authentic from here on: this server wrote these bytes for this holder.
    if (payload.readUInt8(0) !== MEDIA_TOKEN_VERSION) return INVALID;
    const fileId = VIDEO_TRACK_IDS[payload.readUInt8(1) - 1];
    const expiresAt = payload.readUIntBE(2, 6);
    const length = payload.readUInt8(8 + MEDIA_TOKEN_NONCE_BYTES);
    const evidenceId = payload.subarray(HEAD_BYTES).toString('ascii');
    if (fileId === undefined || payload.byteLength !== HEAD_BYTES + length || !EVIDENCE_ID_PATTERN.test(evidenceId)) return INVALID;
    if (!Number.isFinite(now) || now >= expiresAt) return { ok: false, refusal: MediaTokenRefusal.EXPIRED };
    return { ok: true, claims: { evidenceId, fileId, expiresAt } };
  } catch {
    return INVALID;
  }
}
