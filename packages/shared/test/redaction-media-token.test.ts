// Task 3 blueprint row 90 (C3 §2.4, §7; SEC35-13; E-31; check M8-BLK-1): the signed media session
// token of operation 88 carries the prefix `mts_`, and the ONE rule set of the two client
// log-blanking lists (`src/api/redaction.ts`) blanks it by that prefix, like `ses_`, `dvc_`, `bio_`.
import { describe, expect, it } from 'vitest';
import { EVIDENCE_MEDIA_TOKEN_PREFIX, redactCredentialText, redactCredentialValue } from '../src/api';

// A synthetic token of the real form (prefix, then unpadded base64url): nothing here was ever issued.
const BODY = ['AQEBnyfKXzCA', 'MARKER', 'x9_-Zq7Lm2Xw8Rt5Kd0Pu3Vb6Nc1Hy4Gj'].join('');
const TOKEN = `${EVIDENCE_MEDIA_TOKEN_PREFIX}${BODY}`;
const URL_TEXT = `http://127.0.0.1:4420/media/${TOKEN}`;

describe('M8-BLK-1: the media session token in the shared rule set', () => {
  it('the prefix is the contract\'s constant', () => {
    expect(EVIDENCE_MEDIA_TOKEN_PREFIX).toBe('mts_');
  });

  it.each([
    ['a bare token', `refused ${TOKEN}`, 'refused mts_***'],
    ['the signed URL', `GET ${URL_TEXT} failed`, 'GET http://127.0.0.1:4420/media/mts_*** failed'],
    ['the URL as a member', `{"url":"${URL_TEXT}","expiresAt":1}`, '{"url":"http://127.0.0.1:4420/media/mts_***","expiresAt":1}'],
    ['a path', `/media/${TOKEN}`, '/media/mts_***'],
    ['after the Bearer scheme', `Bearer ${TOKEN}`, 'Bearer mts_***'],
    ['beside a session token', `ses_abcDEF123 then ${TOKEN}`, 'ses_*** then mts_***'],
    ['twice', `${TOKEN} ${TOKEN}`, 'mts_*** mts_***'],
  ])('%s', (_name, text, expected) => {
    const blanked = redactCredentialText(text);
    expect(blanked).toBe(expected);
    expect(blanked).not.toContain('MARKER');
  });

  it('in an object, at any depth, under any member name', () => {
    const blanked = JSON.stringify(redactCredentialValue({ media: { url: URL_TEXT, list: [TOKEN] }, note: `src=${URL_TEXT}` }));
    expect(blanked).not.toContain('MARKER');
    expect(blanked).toContain('mts_***');
    expect(blanked).not.toMatch(/mts_(?!\*\*\*)/);
  });

  it('control: only the prefix of a token is one - the same body under another prefix, or inside a word, stays', () => {
    expect(redactCredentialText(`xyz_${BODY}`)).toBe(`xyz_${BODY}`);
    expect(redactCredentialText(`format_${BODY}`)).toBe(`format_${BODY}`);
    expect(redactCredentialText('the mts prefix')).toBe('the mts prefix');
  });
});
