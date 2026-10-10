// Fix pass F-M8 (review finding R93-05, ruling D178): the signed download token of a finished
// export carries the prefix `exs_`, and the ONE rule set of the log-blanking lists blanks it by
// that prefix, like `ses_`, `dvc_`, `bio_` and `mts_`.
import { describe, expect, it } from 'vitest';
import * as api from '../src/api';

const PREFIX = (api as unknown as Record<string, string>)['EVIDENCE_EXPORT_DOWNLOAD_TOKEN_PREFIX'];
// A synthetic token of the real form (prefix, then unpadded base64url): nothing here was ever issued.
const BODY = ['AQEBnyfKXzCA', 'MARKER', 'x9_-Zq7Lm2Xw8Rt5Kd0Pu3Vb6Nc1Hy4Gj'].join('');
const TOKEN = `exs_${BODY}`;

describe('the export download token in the shared rule set', () => {
  it('the prefix is a constant of the contract', () => {
    expect(PREFIX).toBe('exs_');
  });

  it.each([
    ['a bare token', `refused ${TOKEN}`, 'refused exs_***'],
    ['a path', `GET /exports/${TOKEN} failed`, 'GET /exports/exs_*** failed'],
    ['a member', `{"path":"/exports/${TOKEN}","expiresAt":1}`, '{"path":"/exports/exs_***","expiresAt":1}'],
    ['after the Bearer scheme', `Bearer ${TOKEN}`, 'Bearer exs_***'],
  ])('%s', (_name, text, expected) => {
    const blanked = api.redactCredentialText(text);
    expect(blanked).toBe(expected);
    expect(blanked).not.toContain('MARKER');
  });

  it('in an object, at any depth', () => {
    const blanked = JSON.stringify(api.redactCredentialValue({ job: { download: { path: `/exports/${TOKEN}` } }, list: [TOKEN] }));
    expect(blanked).not.toContain('MARKER');
    expect(blanked).not.toMatch(/exs_(?!\*\*\*)/);
  });

  it('control: the same body under another prefix stays', () => {
    expect(api.redactCredentialText(`exq_${BODY}`)).toBe(`exq_${BODY}`);
  });
});
