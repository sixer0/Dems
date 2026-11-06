// The signed media session token (blueprint row 90; C3 §2.4; SEC35-12, SEC35-13). Pure: a MAC under
// a key of this file, no store, no app. Each rule holds its negative control.
import { createHmac, randomBytes } from 'node:crypto';
import { EVIDENCE_MEDIA_TOKEN_PREFIX } from '@dems/shared/api';
import { redactCredentialText } from '@dems/shared/redaction';
import { describe, expect, it } from 'vitest';
import { MEDIA_TOKEN_MAX_CHARS, MEDIA_TOKEN_PATTERN, MediaTokenRefusal, issueMediaToken, readMediaToken, type MediaSessionMac, type MediaTokenClaims, type MediaTokenHolder } from '../token';

const KEY = randomBytes(32);
const mac: MediaSessionMac = (message) => createHmac('sha256', KEY).update(message).digest();
const NOW = 1_791_500_000_000;
const HOLDER: MediaTokenHolder = { operatorId: 'OPR-001', sessionId: 'AS-000041' };
const CLAIMS: MediaTokenClaims = { evidenceId: 'EV-20261009-0001', fileId: 'VIDEO-01', expiresAt: NOW + 60_000 };
const NONCE = Buffer.from('0102030405060708', 'hex');
const issue = (claims: Partial<MediaTokenClaims> = {}, holder: MediaTokenHolder = HOLDER): string => issueMediaToken({ ...CLAIMS, ...claims }, holder, NONCE, mac);
const INVALID = { ok: false, refusal: MediaTokenRefusal.INVALID };

/** The token with one bit of its decoded byte `index` inverted (index < 0 counts from the end). */
function flipped(token: string, index: number): string {
  const bytes = Buffer.from(token.slice(EVIDENCE_MEDIA_TOKEN_PREFIX.length), 'base64url');
  const at = index < 0 ? bytes.byteLength + index : index;
  bytes[at] = (bytes[at] ?? 0) ^ 0x01;
  return `${EVIDENCE_MEDIA_TOKEN_PREFIX}${bytes.toString('base64url')}`;
}

describe('the form of a token', () => {
  it('is `mts_` and one unpadded base64url text, within the bound of a path parameter, and is read back by its holder', () => {
    const token = issue();
    expect(token).toMatch(/^mts_[A-Za-z0-9_-]+$/);
    expect(token).toMatch(MEDIA_TOKEN_PATTERN);
    expect(token.length).toBe(91);
    expect(token.length).toBeLessThanOrEqual(MEDIA_TOKEN_MAX_CHARS);
    expect(readMediaToken(token, HOLDER, NOW, mac)).toEqual({ ok: true, claims: CLAIMS });
    expect(readMediaToken(issue({ fileId: 'VIDEO-02' }), HOLDER, NOW, mac)).toEqual({ ok: true, claims: { ...CLAIMS, fileId: 'VIDEO-02' } });
  });

  it('M8-BLK-1: the shared blanking rule takes the WHOLE token, in a text and in a URL - no part of it is left', () => {
    const token = issue();
    const tail = token.slice(-12);
    for (const text of [`failed for ${token}.`, `GET http://127.0.0.1:4420/media/${token} 403`, `{"url":"http://127.0.0.1:4420/media/${token}"}`]) {
      const blanked = redactCredentialText(text);
      expect(blanked).toContain('mts_***');
      expect(blanked).not.toContain(tail);
      expect(blanked).not.toMatch(/mts_(?!\*\*\*)/);
    }
    // Control: a separator inside a token WOULD leave the part behind it - which is why the token has none.
    expect(redactCredentialText(`${token.slice(0, 40)}.${tail}`)).toContain(tail);
  });

  it('two sessions of one instant are two tokens (the nonce), and both verify', () => {
    const other = issueMediaToken(CLAIMS, HOLDER, Buffer.from('1112131415161718', 'hex'), mac);
    expect(other).not.toBe(issue());
    expect(readMediaToken(other, HOLDER, NOW, mac).ok).toBe(true);
  });

  it('refuses to issue what it could not read back', () => {
    expect(() => issue({ evidenceId: 'EV-1' })).toThrow();
    expect(() => issue({ expiresAt: -1 })).toThrow();
    expect(() => issue({ fileId: 'AUDIO-01' as never })).toThrow();
    expect(() => issueMediaToken(CLAIMS, HOLDER, Buffer.alloc(7), mac)).toThrow();
    expect(() => issueMediaToken(CLAIMS, { operatorId: '', sessionId: 'AS-1' }, NONCE, mac)).toThrow();
  });
});

describe('the binding (SEC35-12): rejected if any component differs', () => {
  const token = issue();

  it('another operator, and the same operator in another sign-in session, are refused with ONE code', () => {
    expect(readMediaToken(token, HOLDER, NOW, mac).ok).toBe(true); // control
    expect(readMediaToken(token, { ...HOLDER, operatorId: 'OPR-002' }, NOW, mac)).toEqual(INVALID);
    expect(readMediaToken(token, { ...HOLDER, sessionId: 'AS-000042' }, NOW, mac)).toEqual(INVALID);
    // The two parts are length-prefixed: moving a character from one to the other is another holder.
    expect(readMediaToken(issue({}, { operatorId: 'OPR-0011', sessionId: 'AS-1' }), { operatorId: 'OPR-001', sessionId: '1AS-1' }, NOW, mac)).toEqual(INVALID);
  });

  it('the file, the evidence item, the expiry, the nonce and the MAC cannot be edited: every byte of the token is under the MAC', () => {
    const length = Buffer.from(token.slice(EVIDENCE_MEDIA_TOKEN_PREFIX.length), 'base64url').byteLength;
    for (let index = 0; index < length; index += 1) expect(readMediaToken(flipped(token, index), HOLDER, NOW, mac), `byte ${index}`).toEqual(INVALID);
    // By name: the file (byte 1), the expiry (bytes 2 to 7), the evidence ID (from byte 17), the MAC (the last 32).
    expect(readMediaToken(flipped(token, 1), HOLDER, NOW, mac)).toEqual(INVALID);
    expect(readMediaToken(flipped(token, 7), HOLDER, NOW - 10, mac)).toEqual(INVALID);
    expect(readMediaToken(flipped(token, 30), HOLDER, NOW, mac)).toEqual(INVALID);
    expect(readMediaToken(flipped(token, -1), HOLDER, NOW, mac)).toEqual(INVALID);
  });

  it('a token of another key is refused: the separate media-session key is what signs', () => {
    const otherKey = randomBytes(32);
    expect(readMediaToken(token, HOLDER, NOW, (message) => createHmac('sha256', otherKey).update(message).digest())).toEqual(INVALID);
  });

  it('what is not a token is refused without an exception', () => {
    for (const value of [undefined, null, 7, '', 'mts_', 'mts_short', `ses_${token.slice(4)}`, `${token}=`, `${token}.x`, `mts_${'A'.repeat(200)}`, token.slice(0, -1), `${token.slice(0, -1)}!`]) {
      expect(readMediaToken(value, HOLDER, NOW, mac), String(value).slice(0, 12)).toEqual(INVALID);
    }
    expect(readMediaToken(token, HOLDER, NOW, () => { throw new Error('store gone'); })).toEqual(INVALID);
  });
});

describe('the lifetime: the replay window is exactly the TTL', () => {
  const token = issue();

  it('accepted until the instant before `expiresAt`, refused as EXPIRED from it on', () => {
    expect(readMediaToken(token, HOLDER, CLAIMS.expiresAt - 1, mac).ok).toBe(true);
    expect(readMediaToken(token, HOLDER, CLAIMS.expiresAt, mac)).toEqual({ ok: false, refusal: MediaTokenRefusal.EXPIRED });
    expect(readMediaToken(token, HOLDER, CLAIMS.expiresAt + 86_400_000, mac)).toEqual({ ok: false, refusal: MediaTokenRefusal.EXPIRED });
  });

  it('EXPIRED is said only of an authentic token of this holder: a stranger learns nothing from the expiry', () => {
    expect(readMediaToken(token, { ...HOLDER, sessionId: 'AS-000042' }, CLAIMS.expiresAt + 1, mac)).toEqual(INVALID);
    expect(readMediaToken(flipped(token, -1), HOLDER, CLAIMS.expiresAt + 1, mac)).toEqual(INVALID);
  });
});
