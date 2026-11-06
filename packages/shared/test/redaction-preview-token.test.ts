// Decisions D51 / D53: the token of a live camera preview session carries the prefix `cps_`, and the
// ONE rule set of the log-blanking lists blanks it by that prefix, like `ses_`, `dvc_`, `bio_`, `mts_`
// and `exs_`.
import { describe, expect, it } from 'vitest';
import * as api from '../src/api';

// A synthetic token of the real form (prefix, then 43 characters of base64url): nothing here was ever issued.
const BODY = ['AQEBnyfKXzCA', 'MARKER', 'x9_-Zq7Lm2Xw8Rt5Kd0Pu3Vb6'].join('');
const TOKEN = `cps_${BODY}`;

describe('the live camera preview token in the shared rule set', () => {
  it('the prefix and the lifetime are constants of the contract', () => {
    expect(api.CAMERA_PREVIEW_TOKEN_PREFIX).toBe('cps_');
    expect(api.CAMERA_PREVIEW_SESSION_TTL_MS).toBe(60_000);
    expect(BODY).toHaveLength(43);
  });

  it.each([
    ['a bare token', `refused ${TOKEN}`, 'refused cps_***'],
    ['a path', `GET /preview/${TOKEN} failed`, 'GET /preview/cps_*** failed'],
    ['a URL member', `{"url":"http://127.0.0.1:4420/preview/${TOKEN}","expiresAt":1}`, '{"url":"http://127.0.0.1:4420/preview/cps_***","expiresAt":1}'],
    ['after the Bearer scheme', `Bearer ${TOKEN}`, 'Bearer cps_***'],
  ])('%s', (_name, text, expected) => {
    const blanked = api.redactCredentialText(text);
    expect(blanked).toBe(expected);
    expect(blanked).not.toContain('MARKER');
  });

  it('the answer of operation 112 holds the token in the form the schema states', () => {
    expect(api.CameraPreviewSessionSchema.safeParse({ url: `http://127.0.0.1:4420/preview/${TOKEN}`, expiresAt: 1 }).success).toBe(true);
    // Control: another host, another route, another prefix, a short token are refused.
    for (const url of [`http://10.0.0.1:4420/preview/${TOKEN}`, `http://127.0.0.1:4420/media/${TOKEN}`, `http://127.0.0.1:4420/preview/mts_${BODY}`, 'http://127.0.0.1:4420/preview/cps_short']) {
      expect(api.CameraPreviewSessionSchema.safeParse({ url, expiresAt: 1 }).success, url).toBe(false);
    }
  });

  it('control: the same body under another prefix stays', () => {
    expect(api.redactCredentialText(`cpx_${BODY}`)).toBe(`cpx_${BODY}`);
  });
});
