// Task 3 blueprint row 113, fix round 1 (navigator finding N-1): the one rule set of the two client
// log-blanking lists (`src/api/redaction.ts`). The web error sink and the mobile runtime log call
// it and hold the same forms in their own tests; this file holds the rule set itself.
import { describe, expect, it } from 'vitest';
import { CREDENTIAL_WALK_DEPTH, CREDENTIAL_WALK_NODE_BUDGET, isCredentialKeyName, redactCredentialText, redactCredentialValue } from '../src/api';

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
    for (const text of ['', 'value: 42, ref: main', 'credentialSet: true, credentialKind: REFERENCE', '{"kind":"PACKAGE","value":"EXPJ-000001"}', 'href=/x&prevalue=1']) {
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
    // `credentials` is a credential name since fix round 2 (R-1): the fetch option of that name loses its value in a log, a secret under it does not get through.
    for (const name of ['credentialSet', 'credentialKind', 'credentialChanged', 'value', 'ref', 'kind', 'secretary', 'model']) expect(isCredentialKeyName(name), name).toBe(false);
  });
});

// ── Fix round 2 (navigator re-check, findings R-1 and R-2) ──────────────────────────────────────

describe('R-2: the object walk is bounded: cycles are cut, and a node budget blanks the rest', () => {
  /** An object with `refs` members that each answer the object itself, counting how often a member is read. */
  function selfReferencing(refs: number): { value: Record<string, unknown>; reads: () => number } {
    let reads = 0;
    const value: Record<string, unknown> = { name: 'node' };
    for (let n = 0; n < refs; n += 1) {
      Object.defineProperty(value, `self${n}`, {
        enumerable: true,
        get() {
          reads += 1;
          return value;
        },
      });
    }
    return { value, reads: () => reads };
  }

  it.each([2, 3, 4, 8])('an object with %i references to itself is walked once: each reference is read once and blanked', (refs) => {
    const { value, reads } = selfReferencing(refs);
    const out = redactCredentialValue(value) as Record<string, unknown>;
    // Structural bound, not a clock: the walk reads every member of the one node once (it was refs^12).
    expect(reads()).toBe(refs);
    expect(out['name']).toBe('node');
    for (let n = 0; n < refs; n += 1) expect(out[`self${n}`]).toBe('***');
  });

  it('a longer cycle (a -> b -> c -> a) is cut where it closes', () => {
    const a: Record<string, unknown> = { id: 'a' };
    const b: Record<string, unknown> = { id: 'b', back: a };
    const c: Record<string, unknown> = { id: 'c', back: a, up: b };
    a['next'] = b;
    b['next'] = c;
    expect(redactCredentialValue(a)).toEqual({ id: 'a', next: { id: 'b', back: '***', next: { id: 'c', back: '***', up: '***' } } });
  });

  it('an object that is merely used twice (no cycle) is walked both times', () => {
    const shared = { apiKey: KEY, model: 'm' };
    expect(redactCredentialValue({ first: shared, second: shared })).toEqual({ first: { apiKey: '***', model: 'm' }, second: { apiKey: '***', model: 'm' } });
  });

  it('a wide object over the node budget is blanked, not left open: what the walk did not reach is ***', () => {
    // `plain` is no credential name and the text names no credential: only the budget can blank it.
    const wide = Array.from({ length: CREDENTIAL_WALK_NODE_BUDGET + 500 }, (_unused, index) => ({ index, plain: KEY }));
    const out = redactCredentialValue({ wide }) as { wide: unknown[] };
    expect(out.wide).toHaveLength(wide.length);
    expect(out.wide[0]).toEqual({ index: 0, plain: KEY });
    expect(out.wide.at(-1)).toBe('***');
    const kept = out.wide.filter((entry) => entry !== '***').length;
    expect(kept).toBeGreaterThan(0);
    expect(kept).toBeLessThanOrEqual(CREDENTIAL_WALK_NODE_BUDGET);
    // Past the budget a text is blanked too: nothing is returned as it came.
    const tail = redactCredentialValue([...wide, `tail ${KEY}`, 7, null]) as unknown[];
    expect(tail.slice(-3)).toEqual(['***', 7, null]);
  });

  it('a shared sub-tree used many times (a diamond 2^40 wide if unfolded) ends within the budget', () => {
    let level: Record<string, unknown> = { leaf: 'x' };
    let reads = 0;
    for (let depth = 0; depth < 11; depth += 1) {
      const below = level;
      level = {
        get left() {
          reads += 1;
          return below;
        },
        get right() {
          reads += 1;
          return below;
        },
      };
    }
    expect(JSON.stringify(redactCredentialValue(level))).toContain('***');
    expect(reads).toBeLessThanOrEqual(2 * CREDENTIAL_WALK_NODE_BUDGET);
  });
});

describe('R-1: the cheap, unambiguous forms', () => {
  it.each([
    ['Bearer with a quoted value', `Bearer "${KEY}"`, 'Bearer "***"'],
    ['Bearer with a token holding : and %', `Bearer abc:${KEY}%2Fx next`, 'Bearer *** next'],
    ['any-case scheme', `BeArEr abc:${KEY}`, 'BeArEr ***'],
    ['Basic with a base64 value', `Basic dXNlcjpwYXNz${KEY} sent`, 'Basic *** sent'],
    ['Basic, quoted', `basic 'dXNlcjpwYXNz${KEY}'`, "basic '***'"],
    ['a header as a tuple', `["authorization","Basic ${KEY}"]`, '["authorization","***"]'],
    ['a header as a tuple, another name', `[ "X-Api-Key" , "${KEY}" ]`, '[ "X-Api-Key" , "***" ]'],
    ['credentials', `{"credentials":"${KEY}"}`, '{"credentials":"***"}'],
    ['sttCredential', `sttCredential=${KEY}`, 'sttCredential=***'],
    ['apiKeyValue', `{"apiKeyValue":"${KEY}"}`, '{"apiKeyValue":"***"}'],
    ['secretKey', `secretKey: ${KEY}`, 'secretKey: ***'],
    ['token', `?access_token=${KEY}&page=2`, '?access_token=***&page=2'],
    ['password', `{"password":"${KEY}","user":"a"}`, '{"password":"***","user":"a"}'],
    ['a name of two words', `API Key: ${KEY}`, 'API Key: ***'],
    ['Kind and Value in another case', `{"Kind":"SECRET","Value":"${KEY}"}`, '{"Kind":"SECRET","Value":"***"}'],
    ['upper-case keys', `{"KIND":"SECRET","VALUE":"${KEY}"}`, '{"KIND":"SECRET","VALUE":"***"}'],
    ['a lower-case kind', `{"kind":"secret","value":"${KEY}"}`, '{"kind":"secret","value":"***"}'],
  ])('%s', (_name, text, expected) => {
    expect(redactCredentialText(text)).toBe(expected);
  });

  it.each([
    ['a form body', `revision=1&credential%5Bkind%5D=SECRET&credential%5Bvalue%5D=${KEY}`],
    ['a JSON body, URL-encoded', encodeURIComponent(`{"credential":{"kind":"SECRET","value":"${KEY}"}}`)],
    ['an encoded member name', `api%5Fkey=${KEY}`],
  ])('a URL-encoded body: %s', (_name, text) => {
    const blanked = redactCredentialText(text);
    expect(blanked).not.toContain('MARKER');
    expect(blanked).toContain('***');
  });

  it('one predicate for the text rule and the object rule: a name either rule blanks, the other blanks too', () => {
    const names = ['credentials', 'sttCredential', 'apiKeyValue', 'secretKey', 'token', 'accessToken', 'password', 'passphrase', 'Authorization', 'client_secret', 'credential', 'credentialRef', 'x-api-key'];
    for (const name of names) {
      expect(isCredentialKeyName(name), name).toBe(true);
      expect(redactCredentialValue({ [name]: KEY }), name).toEqual({ [name]: '***' });
      expect(redactCredentialText(`${name}=${KEY}`), name).toBe(`${name}=***`);
      expect(redactCredentialText(JSON.stringify({ [name]: KEY })), name).toBe(JSON.stringify({ [name]: '***' }));
    }
    for (const name of ['credentialSet', 'credentialKind', 'credentialChanged', 'key', 'keyRef', 'secretary', 'tokenCount', 'value', 'ref', 'kind', 'model', 'href']) {
      expect(isCredentialKeyName(name), name).toBe(false);
      expect(redactCredentialValue({ [name]: 'kept' }), name).toEqual({ [name]: 'kept' });
      expect(redactCredentialText(`${name}=kept`), name).toBe(`${name}=kept`);
    }
  });

  it('the object rule knows kind, value and ref in any case', () => {
    expect(redactCredentialValue({ Kind: 'secret', Value: KEY })).toEqual({ Kind: 'secret', Value: '***' });
    expect(redactCredentialValue({ KIND: 'REFERENCE', REF: REF })).toEqual({ KIND: 'REFERENCE', REF: '***' });
    expect(redactCredentialValue({ kind: 'PACKAGE', value: 'EXPJ-000001' })).toEqual({ kind: 'PACKAGE', value: 'EXPJ-000001' });
  });

  // DECLINED, with the boundary: these names and shapes are ordinary log text.
  it('declined: `key` alone, prose after Basic or bearer, and an unquoted value that holds a separator are not guessed at', () => {
    for (const text of [
      'key: dems.sim.v1',
      '{"key":"dems.mobile.log.v1","count":2}',
      'Basic authentication is not offered; a bearer of news; basic information',
      'the token bucket is empty; password policy: see docs',
      'value: 42, ref: main',
    ]) {
      const blanked = redactCredentialText(text);
      if (text.startsWith('the token bucket')) expect(blanked).toBe('the token bucket is empty; password policy: ***');
      else expect(blanked, text).toBe(text);
    }
    // `Bearer` as a header writes it takes ANY next word (fail closed, as before round 2): a sentence loses one word.
    expect(redactCredentialText('Bearer token missing')).toBe('Bearer *** missing');
    // An unquoted value runs to the next `,` (the canonical `credentialRef: x, next` needs that), so a `,` inside one cuts it.
    expect(redactCredentialText(`secret=abc,${KEY}`)).toBe(`secret=***,${KEY}`);
  });
});

