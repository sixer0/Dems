// Task 3 blueprint row 113, fix round 1 (navigator finding N-1): the one rule set of the two client
// log-blanking lists (`src/api/redaction.ts`). The web error sink and the mobile runtime log call
// it and hold the same forms in their own tests; this file holds the rule set itself.
import { describe, expect, it } from 'vitest';
import { CREDENTIAL_WALK_DEPTH, isCredentialKeyName, redactCredentialText, redactCredentialValue } from '../src/api';

// Synthetic markers, built from parts: nothing here is a real key.
const KEY = ['NAV', 'MARKER', '7f3a', 'Zq9Lm2Xw8Rt5'].join('-');
const REF = ['navstore', 'MARKER/zz9.key'].join(':');
const escaped = (value: unknown, times: number): string => {
  let text = JSON.stringify(value);
  for (let n = 0; n < times; n += 1) text = JSON.stringify(text);
  return text;
};

describe('redactCredentialText', () => {
  it.each([
    ['canonical SECRET', `{"credential":{"kind":"SECRET","value":"${KEY}"}}`, '{"credential":{"kind":"SECRET","value":"***"}}'],
    ['the other order', `{"credential":{"value":"${KEY}","kind":"SECRET"}}`, '{"credential":{"value":"***","kind":"SECRET"}}'],
    ['REFERENCE, the other order', `{"ref":"${REF}","kind":"REFERENCE"}`, '{"ref":"***","kind":"REFERENCE"}'],
    ['a value holding an escaped quote', `{"kind":"SECRET","value":"pre\\"${KEY}"}`, '{"kind":"SECRET","value":"***"}'],
    ['a value holding an apostrophe', `{"kind":"SECRET","value":"it's ${KEY}"}`, '{"kind":"SECRET","value":"***"}'],
    ['a text member', `{"credential":"${KEY}","next":1}`, '{"credential":"***","next":1}'],
    ['a query string', `kind=SECRET&value=${KEY}&x=1`, 'kind=SECRET&value=***&x=1'],
    ['a query string, the other order', `value=${KEY}&kind=SECRET`, 'value=***&kind=SECRET'],
    ['a secret of two words', `{"secret":"two words ${KEY}"}`, '{"secret":"***"}'],
    ['authorization with any scheme', `authorization: Basic ${KEY}\nnext line`, 'authorization: ***\nnext line'],
    ['a name that ends in secret', `client_secret=${KEY}`, 'client_secret=***'],
    ['an unterminated value', `{"apiKey":"${KEY}`, '{"apiKey":"***'],
    ['tokens of this server', 'Bearer ses_Abc-123_xyz and dvc_9f8e7d', 'Bearer ses_*** and dvc_***'],
  ])('%s', (_name, text, expected) => {
    expect(redactCredentialText(text)).toBe(expected);
  });

  it.each([1, 2, 3])('JSON inside a JSON string, %i level(s) deep, in both member orders', (times) => {
    for (const body of [{ credential: { kind: 'SECRET', value: KEY } }, { credential: { value: KEY, kind: 'SECRET' } }, { credential: { ref: REF, kind: 'REFERENCE' } }, { apiKey: KEY }]) {
      const blanked = redactCredentialText(escaped(body, times));
      expect(blanked, escaped(body, times)).not.toContain('MARKER');
      expect(blanked).toContain('***');
    }
  });

  it('is idempotent, and leaves a text that names no credential exactly as it is', () => {
    const once = redactCredentialText(`{"credential":{"value":"${KEY}","kind":"SECRET"}}`);
    expect(redactCredentialText(once)).toBe(once);
    for (const text of ['', 'value: 42, ref: main', 'credentialSet: true, credentialKind: REFERENCE', 'credentials: same-origin', '{"kind":"PACKAGE","value":"EXPJ-000001"}', 'href=/x&prevalue=1']) {
      expect(redactCredentialText(text)).toBe(text);
    }
  });

  it('never throws and never returns the marker, whatever is cut out of a credential text', () => {
    const whole = `x {"a":"\\\\","credential":{"kind":"SECRET","value":"${KEY}"},"authorization":"Basic ${KEY}"} y`;
    const from = whole.indexOf('"credential"');
    for (let end = whole.length; end > from + 40; end -= 1) {
      const cut = whole.slice(0, end);
      const blanked = redactCredentialText(cut);
      // Whatever of the marker the cut still holds in full is gone.
      if (cut.includes(KEY)) expect(blanked, cut).not.toContain(KEY);
    }
  });
});

describe('redactCredentialValue', () => {
  it('blanks by member name at any depth, value and ref beside a credential kind, and whole what is deeper than the walk', () => {
    let abyss: Record<string, unknown> = { plain: KEY };
    for (let level = 0; level < CREDENTIAL_WALK_DEPTH + 3; level += 1) abyss = { next: abyss };
    const out = redactCredentialValue({
      a: { b: { c: { d: { e: { f: { clientSecret: KEY, 'x-api-key': KEY } } } } } },
      write: { value: KEY, kind: 'SECRET' },
      list: [{ kind: 'REFERENCE', ref: REF }, `api_key=${KEY}`],
      job: { kind: 'PACKAGE', value: 'EXPJ-000001' },
      abyss,
      count: 3,
      nothing: null,
    });
    expect(JSON.stringify(out)).not.toContain('MARKER');
    expect(out).toMatchObject({
      a: { b: { c: { d: { e: { f: { clientSecret: '***', 'x-api-key': '***' } } } } } },
      write: { value: '***', kind: 'SECRET' },
      list: [{ kind: 'REFERENCE', ref: '***' }, 'api_key=***'],
      job: { kind: 'PACKAGE', value: 'EXPJ-000001' },
      count: 3,
      nothing: null,
    });
  });

  it('the names that say credential, and the ones that do not', () => {
    for (const name of ['apiKey', 'api_key', 'X-Api-Key', 'Authorization', 'proxy-authorization', 'credential', 'credentialRef', 'credential_value', 'secret', 'client_secret', 'secret_ciphertext']) expect(isCredentialKeyName(name), name).toBe(true);
    for (const name of ['credentialSet', 'credentialKind', 'credentialChanged', 'credentials', 'value', 'ref', 'kind', 'secretary', 'model']) expect(isCredentialKeyName(name), name).toBe(false);
  });
});
