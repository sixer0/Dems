// The signed download token of a finished export (fix pass F-M8; review finding R93-05, ruling
// D178): form, binding, expiry, and that it is no media session token. Pure: a test key, no store.
import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { issueMediaToken, readMediaToken } from '../../media-stream';
import { DOWNLOAD_TOKEN_MAX_CHARS, DOWNLOAD_TOKEN_PATTERN, DownloadTokenRefusal, issueDownloadToken, readDownloadToken, type DownloadMac } from '../download-token';

const macOf = (key: string): DownloadMac => (message) => createHmac('sha256', key).update(message).digest();
const MAC = macOf('test key');
const HOLDER = { operatorId: 'OPR-002', sessionId: '0b6f2f0e-7d1c-4c55-9e0b-3d2a5f1c8a11' };
const CLAIMS = { exportId: 'EXP-000032', evidenceId: 'EV-20261009-0001', expiresAt: 1_791_500_060_000 };
const NONCE = Buffer.from('0102030405060708', 'hex');
const NOW = CLAIMS.expiresAt - 60_000;

describe('the download token', () => {
  it('reads back what was issued, for the holder it was issued to, before its expiry; it fits one path segment of the router', () => {
    const token = issueDownloadToken(CLAIMS, HOLDER, NONCE, MAC);
    expect(token.startsWith('exs_')).toBe(true);
    expect(DOWNLOAD_TOKEN_PATTERN.test(token)).toBe(true);
    expect(token.length).toBeLessThanOrEqual(DOWNLOAD_TOKEN_MAX_CHARS);
    expect(readDownloadToken(token, HOLDER, NOW, MAC)).toEqual({ ok: true, claims: CLAIMS });
    // Two downloads of one instant are two tokens.
    expect(issueDownloadToken(CLAIMS, HOLDER, Buffer.alloc(8, 9), MAC)).not.toBe(token);
  });

  it('NEGATIVE CONTROLS: another operator, another sign-in session, another key, an edited export / item / expiry, a cut or padded token - ONE refusal for all', () => {
    const token = issueDownloadToken(CLAIMS, HOLDER, NONCE, MAC);
    const invalid = { ok: false, refusal: DownloadTokenRefusal.INVALID };
    expect(readDownloadToken(token, { ...HOLDER, operatorId: 'OPR-001' }, NOW, MAC)).toEqual(invalid);
    expect(readDownloadToken(token, { ...HOLDER, sessionId: '11111111-7d1c-4c55-9e0b-3d2a5f1c8a11' }, NOW, MAC)).toEqual(invalid);
    expect(readDownloadToken(token, HOLDER, NOW, macOf('another key'))).toEqual(invalid);
    // The payload of another export, item or expiry under the MAC of this one.
    for (const other of [{ ...CLAIMS, exportId: 'EXP-000033' }, { ...CLAIMS, evidenceId: 'EV-20261009-0002' }, { ...CLAIMS, expiresAt: CLAIMS.expiresAt + 3_600_000 }]) {
      const forged = issueDownloadToken(other, HOLDER, NONCE, MAC);
      const spliced = `exs_${Buffer.concat([Buffer.from(forged.slice(4), 'base64url').subarray(0, -32), Buffer.from(token.slice(4), 'base64url').subarray(-32)]).toString('base64url')}`;
      expect(readDownloadToken(spliced, HOLDER, NOW, MAC)).toEqual(invalid);
    }
    expect(readDownloadToken(token.slice(0, -2), HOLDER, NOW, MAC)).toEqual(invalid);
    expect(readDownloadToken(`${token}A`, HOLDER, NOW, MAC)).toEqual(invalid);
    expect(readDownloadToken(token.replace('exs_', 'mts_'), HOLDER, NOW, MAC)).toEqual(invalid);
    for (const nothing of [undefined, null, 7, '', 'exs_', {}]) expect(readDownloadToken(nothing, HOLDER, NOW, MAC)).toEqual(invalid);
  });

  it('expires on the Core clock: the last accepted instant is the one before `expiresAt`; the expiry is believed only after the MAC', () => {
    const token = issueDownloadToken(CLAIMS, HOLDER, NONCE, MAC);
    expect(readDownloadToken(token, HOLDER, CLAIMS.expiresAt - 1, MAC).ok).toBe(true);
    expect(readDownloadToken(token, HOLDER, CLAIMS.expiresAt, MAC)).toEqual({ ok: false, refusal: DownloadTokenRefusal.EXPIRED });
    // An expired token of another holder is INVALID, not EXPIRED: nothing is learned from it.
    expect(readDownloadToken(token, { ...HOLDER, operatorId: 'OPR-001' }, CLAIMS.expiresAt + 1, MAC)).toEqual({ ok: false, refusal: DownloadTokenRefusal.INVALID });
  });

  it('DOMAIN SEPARATION under the one signing key: a media session token is no download token, and a download token is no media session token', () => {
    const media = issueMediaToken({ evidenceId: CLAIMS.evidenceId, fileId: 'VIDEO-01', expiresAt: CLAIMS.expiresAt }, HOLDER, NONCE, MAC);
    expect(readMediaToken(media, HOLDER, NOW, MAC).ok).toBe(true);
    expect(readDownloadToken(`exs_${media.slice(4)}`, HOLDER, NOW, MAC).ok).toBe(false);
    const download = issueDownloadToken(CLAIMS, HOLDER, NONCE, MAC);
    expect(readMediaToken(`mts_${download.slice(4)}`, HOLDER, NOW, MAC).ok).toBe(false);
  });

  it('refuses to issue for claims that are not of the contract\'s forms', () => {
    expect(() => issueDownloadToken({ ...CLAIMS, exportId: 'EXPJ-000032' }, HOLDER, NONCE, MAC)).toThrow();
    expect(() => issueDownloadToken({ ...CLAIMS, evidenceId: '../etc' }, HOLDER, NONCE, MAC)).toThrow();
    expect(() => issueDownloadToken(CLAIMS, { ...HOLDER, operatorId: '' }, NONCE, MAC)).toThrow();
    expect(() => issueDownloadToken(CLAIMS, HOLDER, Buffer.alloc(4), MAC)).toThrow();
  });
});
