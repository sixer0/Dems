/**
 * The signed DOWNLOAD token of a finished export (fix pass F-M8; review finding R93-05, controller
 * ruling D178). The same construction as the media session token of operation 88
 * (`media-stream/token.ts`): PURE - bytes in, bytes out; no key, no clock, no random source of its
 * own; the MAC is computed by a function it is handed.
 *
 * THE FORM. `exs_` and one unpadded base64url text, so the whole token is `[A-Za-z0-9_-]` after
 * its prefix and the shared blanking rule blanks it WHOLE. Decoded:
 *
 *   payload   u8 version (1) | u48 expiresAt (ms, big endian) | 8 bytes nonce | u32 export number
 *             | u8 length, evidenceId (ASCII)
 *   mac       HMAC-SHA-256, 32 bytes, over
 *             "dems.export-download/1" 0x00 | payload | u16 length, operatorId | u16 length, sessionId
 *
 * THE BINDING: `(operatorId, sign-in session, export ID, evidence ID)` and the expiry are all
 * under the one MAC. The operator and the sign-in session are NOT in the token: they are taken
 * from the principal of the request that presents it. A token presented by another operator, or by
 * the same operator in another sign-in session, or with an edited export, item or expiry, does not
 * verify - one comparison, in constant time, and one refusal code for every mismatch.
 *
 * THE KEY is the media-session signing key of the credential store, reached through the ONE narrow
 * door of `src/media-stream` (`mediaSessionMacOf`). The label of the MAC is another, so a media
 * session token is never a download token and the other way round (domain separation).
 *
 * A token is not single-use: whoever holds it AND the session credential it is bound to can ask
 * again until `expiresAt`. Without that credential the token is worth nothing.
 *
 * NOTHING HERE LOGS. A refusal is a code, never a part of the token.
 */
import { timingSafeEqual } from 'node:crypto';
import { EVIDENCE_EXPORT_DOWNLOAD_TOKEN_PREFIX, EVIDENCE_ID_PATTERN, EXPORT_ID_PATTERN } from '@dems/shared/api';

export const DOWNLOAD_TOKEN_VERSION = 1;
export const DOWNLOAD_TOKEN_NONCE_BYTES = 8;
export const DOWNLOAD_TOKEN_MAC_BYTES = 32;
/** The router's bound of one path parameter. A token of an evidence ID (16 characters) is 95. */
export const DOWNLOAD_TOKEN_MAX_CHARS = 100;
export const DOWNLOAD_TOKEN_PATTERN = new RegExp(`^${EVIDENCE_EXPORT_DOWNLOAD_TOKEN_PREFIX}[A-Za-z0-9_-]{60,${DOWNLOAD_TOKEN_MAX_CHARS - EVIDENCE_EXPORT_DOWNLOAD_TOKEN_PREFIX.length}}$`);

const MAC_LABEL = Buffer.from('dems.export-download/1\u0000', 'utf8');
const HEAD_BYTES = 1 + 6 + DOWNLOAD_TOKEN_NONCE_BYTES + 4 + 1;
const PRINCIPAL_PART = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/;
const MAX_EXPIRES_AT = 2 ** 48 - 1;

/** Computes the MAC of a message under the signing key. The key never leaves its store. */
export type DownloadMac = (message: Uint8Array) => Uint8Array;

/** Who presents (or is issued) a token: the two components that are NOT in it. */
export interface DownloadTokenHolder {
  readonly operatorId: string;
  /** The ID of the auth-session row (`Principal.sessionId`); never the session token. */
  readonly sessionId: string;
}

export interface DownloadTokenClaims {
  /** `EXP-NNNNNN`. */
  readonly exportId: string;
  readonly evidenceId: string;
  /** Core clock, epoch milliseconds: the last instant the token is accepted is the one before it. */
  readonly expiresAt: number;
}

export const DownloadTokenRefusal = {
  /** Not a token of this form, a MAC that does not verify, another operator, another session: ONE code. */
  INVALID: 'EXPORT_DOWNLOAD_INVALID',
  /** An authentic token of this holder whose lifetime is over. */
  EXPIRED: 'EXPORT_DOWNLOAD_EXPIRED',
} as const;
export type DownloadTokenRefusal = (typeof DownloadTokenRefusal)[keyof typeof DownloadTokenRefusal];

export type DownloadTokenReading = { readonly ok: true; readonly claims: DownloadTokenClaims } | { readonly ok: false; readonly refusal: DownloadTokenRefusal };

function lengthPrefixed(text: string): Buffer {
  if (typeof text !== 'string' || !PRINCIPAL_PART.test(text)) throw new Error('a download is bound to an operator ID and a session ID of the usual form');
  const bytes = Buffer.from(text, 'ascii');
  const length = Buffer.alloc(2);
  length.writeUInt16BE(bytes.byteLength, 0);
  return Buffer.concat([length, bytes]);
}

function macInput(payload: Uint8Array, holder: DownloadTokenHolder): Buffer {
  return Buffer.concat([MAC_LABEL, payload, lengthPrefixed(holder.operatorId), lengthPrefixed(holder.sessionId)]);
}

function payloadOf(claims: DownloadTokenClaims, nonce: Uint8Array): Buffer {
  if (!EXPORT_ID_PATTERN.test(claims.exportId)) throw new Error('a download is of one export');
  if (!EVIDENCE_ID_PATTERN.test(claims.evidenceId)) throw new Error('a download is of one evidence item');
  if (!Number.isSafeInteger(claims.expiresAt) || claims.expiresAt < 0 || claims.expiresAt > MAX_EXPIRES_AT) throw new Error('the expiry of a download is an instant of the Core clock');
  if (!(nonce instanceof Uint8Array) || nonce.byteLength !== DOWNLOAD_TOKEN_NONCE_BYTES) throw new Error('the nonce of a download is 8 bytes');
  const evidence = Buffer.from(claims.evidenceId, 'ascii');
  const head = Buffer.alloc(HEAD_BYTES);
  head.writeUInt8(DOWNLOAD_TOKEN_VERSION, 0);
  head.writeUIntBE(claims.expiresAt, 1, 6);
  Buffer.from(nonce).copy(head, 7);
  head.writeUInt32BE(Number(claims.exportId.slice('EXP-'.length)), 7 + DOWNLOAD_TOKEN_NONCE_BYTES);
  head.writeUInt8(evidence.byteLength, HEAD_BYTES - 1);
  return Buffer.concat([head, evidence]);
}

/** A new token for `holder`. `nonce` is 8 random bytes. */
export function issueDownloadToken(claims: DownloadTokenClaims, holder: DownloadTokenHolder, nonce: Uint8Array, mac: DownloadMac): string {
  const payload = payloadOf(claims, nonce);
  const tag = Buffer.from(mac(macInput(payload, holder)));
  if (tag.byteLength !== DOWNLOAD_TOKEN_MAC_BYTES) throw new Error('the MAC of a download is 32 bytes');
  return `${EVIDENCE_EXPORT_DOWNLOAD_TOKEN_PREFIX}${Buffer.concat([payload, tag]).toString('base64url')}`;
}

const INVALID: DownloadTokenReading = Object.freeze({ ok: false, refusal: DownloadTokenRefusal.INVALID });

/**
 * Reads a token as `holder` presents it at `now`. The MAC is verified BEFORE any claim is believed
 * (the expiry included), in constant time. Never throws.
 */
export function readDownloadToken(token: unknown, holder: DownloadTokenHolder, now: number, mac: DownloadMac): DownloadTokenReading {
  try {
    if (typeof token !== 'string' || !DOWNLOAD_TOKEN_PATTERN.test(token)) return INVALID;
    const text = token.slice(EVIDENCE_EXPORT_DOWNLOAD_TOKEN_PREFIX.length);
    const bytes = Buffer.from(text, 'base64url');
    // One text per byte string: a token with stray trailing bits is not the token that was issued.
    if (bytes.toString('base64url') !== text) return INVALID;
    if (bytes.byteLength < HEAD_BYTES + 1 + DOWNLOAD_TOKEN_MAC_BYTES) return INVALID;
    const payload = bytes.subarray(0, bytes.byteLength - DOWNLOAD_TOKEN_MAC_BYTES);
    const presented = bytes.subarray(bytes.byteLength - DOWNLOAD_TOKEN_MAC_BYTES);
    const expected = Buffer.from(mac(macInput(payload, holder)));
    if (expected.byteLength !== DOWNLOAD_TOKEN_MAC_BYTES || !timingSafeEqual(expected, presented)) return INVALID;

    // Authentic from here on: this server wrote these bytes for this holder.
    if (payload.readUInt8(0) !== DOWNLOAD_TOKEN_VERSION) return INVALID;
    const expiresAt = payload.readUIntBE(1, 6);
    const exportId = `EXP-${String(payload.readUInt32BE(7 + DOWNLOAD_TOKEN_NONCE_BYTES)).padStart(6, '0')}`;
    const length = payload.readUInt8(HEAD_BYTES - 1);
    const evidenceId = payload.subarray(HEAD_BYTES).toString('ascii');
    if (payload.byteLength !== HEAD_BYTES + length || !EVIDENCE_ID_PATTERN.test(evidenceId) || !EXPORT_ID_PATTERN.test(exportId)) return INVALID;
    if (!Number.isFinite(now) || now >= expiresAt) return { ok: false, refusal: DownloadTokenRefusal.EXPIRED };
    return { ok: true, claims: { exportId, evidenceId, expiresAt } };
  } catch {
    return INVALID;
  }
}
