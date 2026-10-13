// Static guards of the identity core (plan row W24). They read the production sources of this
// row's two folders as text, with the scaffold's scanner, and keep its rules true for every
// later row that touches them:
//
//   1. One clock: nothing here reads the system time; every instant is `app.clock` (ENG-13).
//   2. One random source and one hash: only `tokens.ts` names `node:crypto`. The runtime's Web
//      Crypto needs no import, so the rule reads it by its names too; ONE named helper uses it
//      (`password-policy.ts` `createRunRepeatGuard`, decision C72), and any other use fails.
//   3. One cookie writer: only `cookie.ts` writes the session cookie, and no header by hand.
//   4. No secret in the log: a log call here carries codes and identifiers only (SR-15, SR-48).
//   5. Statements: constant texts with bind parameters, every table with its schema, and no
//      token hash and no hash set in an answer path (SR-67; NL-1, NL-3, NL-6).
//   6. One audit path: nothing here inserts into the audit table or the events table itself.
//
// Every forbidden text is built from fragments, so that this file does not contain it.
import { describe, expect, it } from 'vitest';
import { SCAN_COVERS, WORKSPACE, codeOnly, isProductionSource, occurrences, readTree, scanCoverage, type SourceFile } from '../../../../test/static/scan';
import * as store from '../session-store';

const OWN_FOLDERS = ['src/modules/identity/', 'src/plugins/authenticate/'];
/** Sub-folders of other rows inside `modules/identity`. */
const OTHER_ROWS = ['src/modules/identity/password-hash/', 'src/modules/identity/biometric/'];

const all = readTree(WORKSPACE).filter(
  (file) => isProductionSource(file.path) && OWN_FOLDERS.some((folder) => file.path.startsWith(folder)) && !OTHER_ROWS.some((folder) => file.path.startsWith(folder)),
);
const code = codeOnly(all);
const files = (pattern: RegExp, where: readonly SourceFile[] = code): string[] => [
  ...new Set(occurrences(where, pattern).map((place) => place.replace(/:\d+$/, ''))),
];

const SYSTEM_TIME = new RegExp([`\\bDate\\s*\\.\\s*${'now'}\\s*\\(`, `\\bnew\\s+Date\\s*\\(`, `\\bperformance\\s*\\.\\s*${'now'}\\b`, `\\bhr${'time'}\\b`].join('|'), 'g');
const TIMER = new RegExp(`\\bset(?:${'Timeout'}|${'Interval'}|${'Immediate'})\\s*\\(`, 'g');
const CRYPTO = new RegExp(`['"](?:node:)?${'crypto'}['"]|\\bMath\\s*\\.\\s*${'random'}\\b`, 'g');
// WEB CRYPTO (task 4 row X4; decision C72; security review 221 C-1; code review 222 F-07). The
// runtime's generator and key objects are reached without an import, so `CRYPTO` above, which
// reads a module name, was blind to them: rule 2 and SR-61 were green by the spelling of the API.
// These two patterns read the names themselves: the global object, its `subtle` member under any
// holder (`runtime.subtle`), the generator, the key type; and every way to make or use a key.
const WEB_CRYPTO = new RegExp(
  [
    `\\bglobalThis\\s*\\.\\s*${'crypto'}\\b`,
    `\\b${'crypto'}\\s*\\.\\s*(?:subtle|getRandom${'Values'}|random${'UUID'})\\b`,
    `\\.\\s*${'subtle'}\\b`,
    `\\bgetRandom${'Values'}\\b`,
    `\\bweb${'crypto'}\\b`,
    `\\bCrypto${'Key'}\\b`,
  ].join('|'),
  'g',
);
const KEYED_DIGEST = new RegExp(
  [`\\b(?:import|generate|derive|export|wrap|unwrap)${'Key'}\\b`, `\\bderive${'Bits'}\\b`, `\\b${'subtle'}\\s*\\.\\s*(?:sign|verify|encrypt|decrypt|digest)\\b`, `['"]${'HMAC'}['"]`].join('|'),
  'g',
);

/**
 * THE ONE NAMED USER OF WEB CRYPTO in the two folders (decision C72, which adopts the ruling of
 * code review 222 section 5.4: "the code is right, the rule is blind - widen the rule, name the
 * helper"; C53 (2) and C67 (2) end with it).
 *
 * The helper is the repeat guard of ONE run of the host command that sets operator passwords
 * (SX-13): a random key made for the run, imported as a key object that cannot be exported, and an
 * HMAC under it. Its purpose is the one line below. It is no signing secret and no pepper in the
 * sense of SR-61: nothing it makes is verified by anyone, stored, or sent.
 */
const RUN_REPEAT_GUARD = {
  file: 'src/modules/identity/password-policy.ts',
  symbol: 'createRunRepeatGuard',
  /** The algorithm name the symbol hands to the runtime, declared beside it. */
  constant: 'DIGEST_ALGORITHM',
  purpose: 'comparison in memory, per run, nothing derived is stored or leaves the process',
} as const;

/** The text of the named symbol: from its declaration to the bracket that closes it. Empty when it is not there. */
function namedSymbolSpan(text: string): { from: number; to: number } | null {
  const from = text.indexOf(`export async function ${RUN_REPEAT_GUARD.symbol}(`);
  if (from < 0) return null;
  let depth = 0;
  for (let index = text.indexOf('{', text.indexOf(')', from)); index >= 0 && index < text.length; index += 1) {
    if (text[index] === '{') depth += 1;
    else if (text[index] === '}') {
      depth -= 1;
      if (depth === 0) return { from, to: index + 1 };
    }
  }
  return null;
}

/** Where `pattern` occurs OUTSIDE the named entry: in another file, or in that file outside the symbol and its constant. */
function outsideNamedEntry(where: readonly SourceFile[], pattern: RegExp): string[] {
  const found: string[] = [];
  for (const file of where) {
    const span = file.path === RUN_REPEAT_GUARD.file ? namedSymbolSpan(file.text) : null;
    const constant = file.path === RUN_REPEAT_GUARD.file ? new RegExp(`^const ${RUN_REPEAT_GUARD.constant} = [^;\\n]*;$`, 'm').exec(file.text) : null;
    for (const match of file.text.matchAll(pattern)) {
      const inSymbol = span !== null && match.index >= span.from && match.index < span.to;
      const inConstant = constant !== null && match.index >= constant.index && match.index < constant.index + constant[0].length;
      if (!inSymbol && !inConstant) found.push(`${file.path}:${file.text.slice(0, match.index).split('\n').length}`);
    }
  }
  return found;
}
const COOKIE_WRITE = new RegExp(`\\.\\s*(?:set|clear)${'Cookie'}\\s*\\(|['"\`]set-${'cookie'}['"\`]`, 'gi');
const CONSOLE = new RegExp(`\\b${'console'}\\s*\\.`, 'g');
const RAW_URL = new RegExp(`\\brequest\\s*\\.\\s*(?:raw\\s*\\.\\s*)?${'url'}\\b|\\boriginal${'Url'}\\b`, 'g');
const ENVIRONMENT = new RegExp(`\\bprocess\\s*\\.\\s*${'env'}\\b|\\.\\s*${'listen'}\\s*\\(`, 'g');
const SIGNING = new RegExp([`\\bcreate${'Hmac'}\\b`, `\\bjson${'webtoken'}\\b`, `\\b${'jwt'}\\b`, `\\b${'pepper'}\\b`, `\\bsign${'Cookie'}\\b`, `\\bsigned\\s*:`].join('|'), 'gi');
const OWN_AUDIT_INSERT = new RegExp(`\\binsert\\s+into\\s+(?:public\\s*\\.\\s*)?(?:${['audit', 'log'].join('_')}|events)\\b`, 'gi');

describe('the scan itself', () => {
  it('reads the production sources of the two folders, without the sub-folders of other rows', () => {
    expect(scanCoverage(all, OWN_FOLDERS.map((folder) => ({ folder, without: OTHER_ROWS })))).toEqual(SCAN_COVERS);
  });

  it('finds each forbidden text when it is present (positive control)', () => {
    const planted: SourceFile[] = [
      { path: 'a.ts', text: `const t = Date.${'now'}(); const d = new Date(); const p = performance.${'now'}();` },
      { path: 'b.ts', text: `set${'Timeout'}(() => {}, 1); set${'Interval'}(tick, 5);` },
      { path: 'c.ts', text: `import { randomBytes } from 'node:${'crypto'}'; const r = Math.${'random'}();` },
      { path: 'd.ts', text: `reply.set${'Cookie'}('a', 'b'); reply.header('Set-${'Cookie'}', 'a=b'); reply.clear${'Cookie'}('a');` },
      { path: 'e.ts', text: `${'console'}.log(request.${'url'}, request.raw.${'url'}, process.${'env'}.X); app.${'listen'}({ port: 1 });` },
      { path: 'f.ts', text: `await unit.query('INSERT INTO public.${['audit', 'log'].join('_')} (seq) VALUES ($1)'); await unit.query('insert into events (seq) values ($1)');` },
    ];
    expect(files(SYSTEM_TIME, planted)).toEqual(['a.ts']);
    expect(occurrences(planted, SYSTEM_TIME)).toHaveLength(3);
    expect(occurrences(planted, TIMER)).toHaveLength(2);
    expect(occurrences(planted, CRYPTO)).toHaveLength(2);
    expect(occurrences(planted, COOKIE_WRITE)).toHaveLength(3);
    expect(occurrences(planted, CONSOLE)).toHaveLength(1);
    expect(occurrences(planted, RAW_URL)).toHaveLength(2);
    expect(occurrences(planted, ENVIRONMENT)).toHaveLength(2);
    expect(occurrences(planted, OWN_AUDIT_INSERT)).toHaveLength(2);
  });
});

describe('rule 1: one clock', () => {
  it('no file reads the system time', () => {
    expect(occurrences(code, SYSTEM_TIME)).toEqual([]);
  });

  it('no timer of its own: the sweeper\'s interval is the core\'s (`src/core/sweeper.ts`, review finding W91-11)', () => {
    expect(files(TIMER)).toEqual([]);
    expect(all.find((file) => file.path === 'src/modules/identity/sweeper.ts')?.text).toContain("from '../../core'");
  });

  it('the sweeper is started by the listener and stopped before the close, not by the app factory', () => {
    const index = code.find((file) => file.path === 'src/modules/identity/index.ts')?.text ?? '';
    expect(index).toMatch(/addHook\('onListen', async \(\) => \{\s*sweeper\.start\(\);/);
    expect(index).toMatch(/addHook\('preClose', async \(\) => \{\s*sweeper\.stop\(\);/);
    expect(index.match(/sweeper\.start\(/g)).toHaveLength(1);
  });
});

describe('rule 2: one random source, one hash', () => {
  it('only tokens.ts names the crypto module, and nothing uses a weak random source', () => {
    expect(files(CRYPTO)).toEqual(['src/modules/identity/tokens.ts']);
  });

  it('Web Crypto is named by ONE file, inside ONE named symbol (decision C72)', () => {
    expect(files(WEB_CRYPTO)).toEqual([RUN_REPEAT_GUARD.file]);
    expect(outsideNamedEntry(code, WEB_CRYPTO)).toEqual([]);
    // The entry names something that is there, and the rule reads it: the symbol holds the uses.
    const guard = code.find((file) => file.path === RUN_REPEAT_GUARD.file)?.text ?? '';
    const span = namedSymbolSpan(guard);
    expect(span).not.toBeNull();
    expect(occurrences([{ path: 'symbol', text: guard.slice(span?.from, span?.to) }], WEB_CRYPTO).length).toBeGreaterThanOrEqual(6);
    expect(RUN_REPEAT_GUARD.purpose).toBe('comparison in memory, per run, nothing derived is stored or leaves the process');
  });

  it('the named helper is what its purpose says: a key that cannot be exported, zeroed bytes, digests kept in memory only', () => {
    const guard = code.find((file) => file.path === RUN_REPEAT_GUARD.file)?.text ?? '';
    const span = namedSymbolSpan(guard);
    const symbol = guard.slice(span?.from, span?.to);
    // PER RUN: the key is made inside the symbol, from the runtime's generator, once per call.
    expect(symbol.match(/\bruntime\.getRandomValues\(new Uint8Array\(RUN_KEY_BYTES\)\)/g)).toHaveLength(1);
    // IN MEMORY: imported once, NOT extractable, for one use; the bytes it was made from are zeroed on every way out.
    expect(symbol.match(/\bsubtle\.importKey\(/g)).toHaveLength(1);
    expect(symbol).toContain(`runtime.subtle.importKey('raw', material, ${RUN_REPEAT_GUARD.constant}, false, ['sign'])`);
    expect(symbol).toMatch(/\} finally \{\s*material\.fill\(0\);\s*\}/);
    expect(symbol).toMatch(/\} finally \{\s*bytes\.fill\(0\);\s*\}/);
    // COMPARISON: the one use of the key is a digest, handed to the shared guard and to nothing else.
    expect(symbol.match(/\bsubtle\.sign\(/g)).toHaveLength(1);
    expect(symbol.match(/\breturn\b[^;]*;/g)).toEqual([`return hexOf(new Uint8Array(await runtime.subtle.sign(${RUN_REPEAT_GUARD.constant}.name, key, bytes)));`, 'return createRunRepeatGuardWith(digestOf);']);
    // NOTHING STORED, NOTHING LEAVES: the file imports the shared package only (no file system, no
    // network, no logger), exports no key, and names no output and no serialiser.
    expect([...guard.matchAll(/\bfrom\s*'([^']+)';/g)].map((match) => match[1])).toEqual(['@dems/shared/api', '@dems/shared/sim']);
    expect(guard).not.toMatch(/\b(?:exportKey|wrapKey|JSON\s*\.\s*stringify|writeFile\w*|appendFile\w*|fetch|postMessage)\b|\blog\s*\.|\bprocess\s*\.|\brequire\s*\(|\bimport\s*\(/);
    expect(occurrences([{ path: 'guard', text: guard }], CONSOLE)).toEqual([]);
  });

  it('finds any OTHER use of Web Crypto: in another file, and in the named file outside the symbol (planted control)', () => {
    const guard = code.find((file) => file.path === RUN_REPEAT_GUARD.file) ?? { path: RUN_REPEAT_GUARD.file, text: '' };
    const elsewhere: SourceFile = {
      path: 'src/modules/identity/sessions.ts',
      text: `const id = globalThis.${'crypto'}.random${'UUID'}();\nconst bytes = runtime.getRandom${'Values'}(new Uint8Array(16));\nconst d = await runtime.${'subtle'}.digest('SHA-256', bytes);\nlet key: Crypto${'Key'};\nimport { web${'crypto'} } from 'node:${'crypto'}';`,
    };
    expect(outsideNamedEntry([guard, elsewhere], WEB_CRYPTO)).toEqual([
      'src/modules/identity/sessions.ts:1',
      'src/modules/identity/sessions.ts:2',
      'src/modules/identity/sessions.ts:3',
      'src/modules/identity/sessions.ts:4',
      'src/modules/identity/sessions.ts:5',
    ]);
    expect(files(WEB_CRYPTO, [guard, elsewhere])).not.toEqual([RUN_REPEAT_GUARD.file]);
    expect(files(CRYPTO, [elsewhere])).toEqual(['src/modules/identity/sessions.ts']);
    // A second use in the named file itself is no part of the entry.
    const lines = guard.text.split('\n').length;
    const second: SourceFile = { path: guard.path, text: `${guard.text}\nexport function sessionSalt(): Uint8Array {\n  return globalThis.${'crypto'}.getRandom${'Values'}(new Uint8Array(16));\n}\n` };
    expect(outsideNamedEntry([second], WEB_CRYPTO)).toEqual([`${guard.path}:${lines + 2}`, `${guard.path}:${lines + 2}`]);
    // The symbol renamed or gone: the entry covers nothing, and every use is reported.
    const renamed: SourceFile = { path: guard.path, text: guard.text.replace(`function ${RUN_REPEAT_GUARD.symbol}(`, 'function makeGuard(') };
    expect(outsideNamedEntry([renamed], WEB_CRYPTO).length).toBeGreaterThanOrEqual(6);
  });
});

describe('SR-61: no signing secret and no pepper', () => {
  it('finds each when it is present (positive control), and none in the two folders', () => {
    const planted: SourceFile[] = [{ path: 'g.ts', text: `create${'Hmac'}('sha256', key); import x from 'json${'webtoken'}'; const ${'pepper'} = 1; reply.sign${'Cookie'}(v); setCookie(n, v, { signed: true });` }];
    expect(occurrences(planted, SIGNING)).toHaveLength(5);
    expect(occurrences(code, SIGNING)).toEqual([]);
  });

  it('a key object or a keyed digest of Web Crypto is made in the ONE named place, and nowhere else (decision C72)', () => {
    // SR-61 read `createHmac` only: an HMAC key made through the runtime's `subtle` passed it unseen.
    // The run key of the repeat guard is neither a signing secret nor a pepper (see RUN_REPEAT_GUARD);
    // it is named, and every other key or keyed digest in the two folders fails here.
    expect(files(KEYED_DIGEST)).toEqual([RUN_REPEAT_GUARD.file]);
    expect(outsideNamedEntry(code, KEYED_DIGEST)).toEqual([]);
    const guard = code.find((file) => file.path === RUN_REPEAT_GUARD.file) ?? { path: RUN_REPEAT_GUARD.file, text: '' };
    const planted: SourceFile[] = [
      guard,
      { path: 'src/modules/identity/cookie.ts', text: `const key = await runtime.${'subtle'}.import${'Key'}('raw', secret, { name: '${'HMAC'}', hash: 'SHA-256' }, true, ['sign']);\nconst tag = await runtime.${'subtle'}.sign('${'HMAC'}', key, value);\nconst raw = await runtime.${'subtle'}.export${'Key'}('raw', key);` },
    ];
    expect(outsideNamedEntry(planted, KEYED_DIGEST)).toEqual([
      'src/modules/identity/cookie.ts:1',
      'src/modules/identity/cookie.ts:1',
      'src/modules/identity/cookie.ts:2',
      'src/modules/identity/cookie.ts:2',
      'src/modules/identity/cookie.ts:3',
    ]);
    // In the named file, outside the symbol and its constant: a stored pepper under the same API.
    const lines = guard.text.split('\n').length;
    const second: SourceFile = { path: guard.path, text: `${guard.text}\nexport const stored = (k: Crypto${'Key'}, v: Uint8Array) => globalThis.${'crypto'}.${'subtle'}.sign('${'HMAC'}', k, v);\n` };
    expect(outsideNamedEntry([second], KEYED_DIGEST)).toEqual([`${guard.path}:${lines + 1}`, `${guard.path}:${lines + 1}`]);
  });
});

describe('rule 3: one cookie writer', () => {
  it('only cookie.ts writes a cookie, and nobody writes the header by hand', () => {
    expect(files(COOKIE_WRITE)).toEqual(['src/modules/identity/cookie.ts']);
  });

  it('the routes set the cookie in one place and clear it in one place', () => {
    const routes = code.find((file) => file.path === 'src/modules/identity/routes.ts')?.text ?? '';
    expect(routes.match(/\bsetSessionCookie\(/g)).toHaveLength(1);
    expect(routes.match(/\bclearSessionCookie\(/g)).toHaveLength(1);
    // The one clear is behind "a session without a device"; the one set is after the device's return.
    expect(routes).toMatch(/if \(session\.deviceId === null\) clearSessionCookie\(/);
    expect(routes).toMatch(/if \(consoleIdentity\.kind === 'DEVICE'\) return \{[^}]*\};\s*setSessionCookie\(/);
  });
});

describe('rule 4: no secret in the log', () => {
  /** The keys of the object a log call is given, for every log call of the two folders. */
  function loggedKeys(): Array<{ path: string; keys: string[] }> {
    const calls: Array<{ path: string; keys: string[] }> = [];
    for (const file of code) {
      for (const match of file.text.matchAll(/\blog\s*\.\s*(?:trace|debug|info|warn|error|fatal)\(\s*(\{[^}]*\})?/g)) {
        const body = match[1] ?? '{}';
        const keys = body
          .slice(1, -1)
          .split(',')
          .map((part) => part.trim().split(':')[0]?.trim() ?? '')
          .filter((key) => key !== '');
        calls.push({ path: file.path, keys });
      }
    }
    return calls;
  }

  it('every log call carries codes and identifiers only', () => {
    const calls = loggedKeys();
    expect(calls.length).toBeGreaterThanOrEqual(3);
    const allowed = new Set(['code', 'reason', 'route', 'err', 'source', 'operatorId']);
    for (const call of calls) expect(call.keys.filter((key) => !allowed.has(key)), call.path).toEqual([]);
  });

  it('no console call, no raw URL, no environment, no listener', () => {
    expect(occurrences(code, CONSOLE)).toEqual([]);
    expect(occurrences(code, RAW_URL)).toEqual([]);
    expect(occurrences(code, ENVIRONMENT)).toEqual([]);
  });
});

describe('rule 5: the statements', () => {
  const statements = Object.entries(store).flatMap(([name, value]): Array<[string, string]> => {
    if (typeof value === 'string') return [[name, value]];
    if (typeof value === 'object' && value !== null) return Object.entries(value).map(([key, text]) => [`${name}.${key}`, String(text)]);
    return [];
  });

  it('are constant texts: every exported statement of the store is listed here', () => {
    expect(statements.map(([name]) => name).sort()).toEqual([
      'ANY_EXPIRED_SESSION',
      'END_BIOMETRIC_SESSIONS',
      'END_SESSION',
      'END_SESSIONS_OF_DEVICE',
      'END_SESSIONS_OF_OPERATOR',
      'EXPIRE_SESSION',
      'EXPIRE_SESSIONS',
      'FIND_OPERATOR_ID',
      'FIND_SESSION_BY_TRANSPORT.BEARER',
      'FIND_SESSION_BY_TRANSPORT.COOKIE',
      'FIND_SIGN_IN_CANDIDATE',
      'INSERT_SESSION',
      'MARK_SIGNED_IN',
      'READ_OPERATOR_ENABLED',
      'READ_ROLE_PERMISSIONS',
      'READ_SESSION_STATE',
      'REPLACE_CREDENTIALS',
      'TOUCH_SESSION',
    ]);
  });

  it('name every table with its schema, and hold no value: only bind parameters', () => {
    for (const [name, text] of statements) {
      const tables = [...text.matchAll(/\b(?:FROM|JOIN|UPDATE|INTO)\s+([a-z_.]+)/g)].map((match) => match[1]);
      expect(tables.length, name).toBeGreaterThan(0);
      expect(tables.filter((table) => !table?.startsWith('public.')), name).toEqual([]);
      // A quoted literal in a statement is one of the fixed words of the schema, never data.
      const literals = [...text.matchAll(/'([^']*)'/g)].map((match) => match[1]);
      expect(literals.filter((word) => !['ROTATED', 'ABSOLUTE_EXPIRED', 'IDLE_EXPIRED', 'TOKEN_REUSE', 'BIOMETRIC'].includes(word ?? '')), name).toEqual([]);
      expect(text, name).toMatch(/\$1\b/);
    }
  });

  it('a session is ended, expired and touched only where it is still open (compare-and-set)', () => {
    for (const name of ['END_SESSION', 'END_SESSIONS_OF_OPERATOR', 'END_SESSIONS_OF_DEVICE', 'END_BIOMETRIC_SESSIONS', 'EXPIRE_SESSION', 'EXPIRE_SESSIONS', 'TOUCH_SESSION']) {
      const text = statements.find(([candidate]) => candidate === name)?.[1] ?? '';
      expect(text, name).toMatch(/^UPDATE public\.auth_sessions SET /);
      expect(text, name).toMatch(/\bWHERE\b.*\bended_at IS NULL\b/);
      expect(text, name).toMatch(/\bRETURNING\b/);
    }
  });

  it('the token hash is a WHERE parameter and an INSERT column, never selected or returned', () => {
    const hash = ['token', 'hash'].join('_');
    const naming = statements.filter(([, text]) => text.includes(hash)).map(([name]) => name);
    expect(naming.sort()).toEqual(['FIND_SESSION_BY_TRANSPORT.BEARER', 'FIND_SESSION_BY_TRANSPORT.COOKIE', 'INSERT_SESSION']);
    for (const [name, text] of statements) {
      const selected = /^SELECT\s+(.*?)\s+FROM\s+public\./s.exec(text)?.[1] ?? '';
      const returned = /\bRETURNING\s+(.*)$/s.exec(text)?.[1] ?? '';
      expect(selected.includes(hash), name).toBe(false);
      expect(returned.includes(hash), name).toBe(false);
    }
    // Nothing outside the store names the column at all.
    expect(files(new RegExp(hash, 'g')).sort()).toEqual(['src/modules/identity/session-store.ts']);
  });

  it('the hash set of an operator is read by one statement, for the hash wrapper, and written by one', () => {
    const credentials = ['operator', 'credentials'].join('_');
    expect(statements.filter(([, text]) => text.includes(credentials)).map(([name]) => name).sort()).toEqual(['FIND_SIGN_IN_CANDIDATE', 'REPLACE_CREDENTIALS']);
    expect(files(new RegExp(credentials, 'g')).sort()).toEqual(['src/modules/identity/session-store.ts']);
  });

  it('no statement is written outside the store', () => {
    const sql = /['"`](?:SELECT|INSERT|UPDATE|DELETE)\s/g;
    expect(files(sql)).toEqual(['src/modules/identity/session-store.ts']);
  });
});

describe('rule 6: one audit path', () => {
  it('nothing here inserts into the audit table or the events table itself: the rows go through the unit\'s writers', () => {
    expect(occurrences(code, OWN_AUDIT_INSERT)).toEqual([]);
    const activity = code.find((file) => file.path === 'src/modules/identity/activity.ts')?.text ?? '';
    expect(activity).toMatch(/unit\.audit\.append\(/);
    expect(activity).toMatch(/unit\.events\.append\(/);
  });
});
