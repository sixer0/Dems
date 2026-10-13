// The password policy for a new password (task 4 blueprint row 212; SX-13; R-X2-6; UD-6, UD-12),
// in its shared home since row V3 (decision C53 (2)). Moved here from
// apps/core-server/src/modules/identity/__tests__/password-policy.test.ts, which keeps the cases of
// what the server binds (the demonstration constant, the per-run key).
//
// EVERY VALUE OF THE RULE TABLE IS BUILT IN THIS RUN, from `node:crypto`. No password is a literal
// of this file. The published demonstration password is named by its imported constant only and is
// never written out; the usernames are the dataset's, by import. Nothing is written to disk.
import { createHmac, randomBytes, randomInt } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  PASSWORD_POLICY,
  PASSWORD_POLICY_REFUSAL,
  PasswordPolicyFactsError,
  RunRepeatGuardError,
  SIGN_IN_LIMITS,
  checkNewPasswordAgainst,
  createRunRepeatGuardWith,
  type PasswordPolicyFacts,
  type PasswordPolicyRefusalCode,
  type RunRepeatDigest,
} from '../src/api';
import * as api from '../src/api';
import { DEMO_OPERATOR_PASSWORD, OPERATORS } from '../src/sim';

const LETTERS = 'abcdefghijkmnopqrstuvwxyz';
const MIXED = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!#%&()*+,-./:;<=>?@[]^_{|}~';
const pick = (alphabet: string, length: number): string => Array.from({ length }, () => alphabet[randomInt(alphabet.length)]).join('');

const USERNAMES = OPERATORS.map((operator) => operator.username);
const USERNAME = USERNAMES[randomInt(USERNAMES.length)] ?? '';
const OPERATOR = { username: USERNAME };
const FACTS: PasswordPolicyFacts = { demonstrationPassword: DEMO_OPERATOR_PASSWORD };
const MIN = PASSWORD_POLICY.minimumCharacters;
const MAX = PASSWORD_POLICY.maximumCodeUnits;

/** Every value this file judged; none may reach a process stream or the console. */
const judged: string[] = [];
/**
 * A value of `length` characters from `alphabet` that meets no rule by chance: more than one
 * character, and neither the demonstration password nor a username inside it. Drawn again until so.
 */
function runValue(length: number, alphabet: string = MIXED): string {
  for (;;) {
    const value = pick(alphabet, length);
    const folded = value.toLowerCase();
    const plain = new Set(value).size > 1 && !folded.includes(DEMO_OPERATOR_PASSWORD.toLowerCase()) && USERNAMES.every((name) => !folded.includes(name.toLowerCase()));
    if (plain) {
      judged.push(value);
      return value;
    }
  }
}
const judge = (value: string, operator: { username: string } = OPERATOR): PasswordPolicyRefusalCode | null => {
  judged.push(value);
  const answer = checkNewPasswordAgainst(value, operator, FACTS);
  if (answer !== null) {
    // A refusal is its code and the fixed words of that code: no part of the value, no length of it.
    expect(answer).toEqual({ code: answer.code, message: PASSWORD_POLICY_REFUSAL[answer.code] });
  }
  return answer?.code ?? null;
};
/** The letter case of every second letter turned. */
const turned = (value: string): string =>
  Array.from(value, (character, index) => (index % 2 === 0 ? character.toUpperCase() : character.toLowerCase())).join('');

/** A keyed digest of one run, as a caller hands it in: a random key of this call, never kept elsewhere. */
function runDigest(): RunRepeatDigest {
  const key = randomBytes(32);
  return async (password) => createHmac('sha256', key).update(password, 'utf8').digest('hex');
}

const captured: string[] = [];
const text = (part: unknown): string => (typeof part === 'string' ? part : Buffer.isBuffer(part) ? part.toString('latin1') : JSON.stringify(part) ?? String(part));
beforeEach(() => {
  vi.spyOn(process.stdout, 'write').mockImplementation((chunk: unknown) => {
    captured.push(text(chunk));
    return true;
  });
  vi.spyOn(process.stderr, 'write').mockImplementation((chunk: unknown) => {
    captured.push(text(chunk));
    return true;
  });
  for (const method of ['log', 'info', 'warn', 'error', 'debug', 'trace'] as const) {
    vi.spyOn(console, method).mockImplementation((...parts: unknown[]) => {
      captured.push(parts.map(text).join(' '));
    });
  }
});
afterEach(() => {
  vi.restoreAllMocks();
});
afterAll(() => {
  // The module has no log sink (it imports none, see "the module itself"). Checked once over the whole file:
  // no judged value reached a process stream or the console. Values of fewer than 8 characters are too short to search for.
  const all = captured.join('\n');
  const searched = judged.filter((value) => value.length >= 8);
  if (searched.length < 40) throw new Error('the capture covered fewer values than the rule table judges');
  if (searched.some((value) => all.includes(value))) throw new Error('a judged value reached a process stream or the console');
});

describe('the numbers', () => {
  it('minimum 12; the maximum is the bound of the sign-in contract, not a second number', () => {
    expect(MIN).toBe(12);
    expect(MAX).toBe(128);
    expect(MAX).toBe(SIGN_IN_LIMITS.passwordMax);
    expect(PASSWORD_POLICY_REFUSAL.PASSWORD_TOO_SHORT).toContain(` ${MIN} `);
    expect(PASSWORD_POLICY_REFUSAL.PASSWORD_TOO_LONG).toContain(` ${MAX} `);
  });

  it('every refusal is a named code with fixed words, and no two share their words', () => {
    const codes = Object.keys(PASSWORD_POLICY_REFUSAL);
    expect(codes).toEqual([
      'PASSWORD_NOT_TEXT',
      'PASSWORD_TOO_LONG',
      'PASSWORD_CONTROL_CHARACTER',
      'PASSWORD_NOT_PRINTABLE_ASCII',
      'PASSWORD_IS_DEMONSTRATION',
      'PASSWORD_HOLDS_USERNAME',
      'PASSWORD_TOO_SHORT',
      'PASSWORD_ONE_CHARACTER',
      'PASSWORD_REPEATED_IN_RUN',
      'USERNAME_MISSING',
    ]);
    const words = Object.values(PASSWORD_POLICY_REFUSAL);
    expect(new Set(words).size).toBe(words.length);
    for (const sentence of words) expect(sentence.toLowerCase().includes(DEMO_OPERATOR_PASSWORD.toLowerCase())).toBe(false);
  });
});

describe('the rule table: one accepted and one refused value per rule, each built in this run', () => {
  it('minimum length: 12 characters accepted, 11 refused', () => {
    expect(judge(runValue(MIN))).toBeNull();
    expect(judge(runValue(MIN - 1))).toBe('PASSWORD_TOO_SHORT');
    expect(judge('')).toBe('PASSWORD_TOO_SHORT');
  });

  it('maximum length: 128 code units accepted, 129 refused', () => {
    expect(judge(runValue(MAX))).toBeNull();
    expect(judge(runValue(MAX + 1))).toBe('PASSWORD_TOO_LONG');
  });

  it('printable ASCII only: every printable character accepted; an accented letter, another script, an astral character and a no-break space refused', () => {
    const everyPrintable = Array.from({ length: 0x7e - 0x20 + 1 }, (_, index) => String.fromCharCode(0x20 + index)).join('');
    expect(everyPrintable).toHaveLength(95);
    // The 95 printable characters hold no username and not the demonstration password only by their order; asked, not assumed.
    expect(judge(everyPrintable)).toBeNull();
    for (const foreign of [0xe9, 0x3b1, 0x4e2d, 0x1f511, 0xa0, 0x2028, 0xfeff]) {
      const value = `${runValue(8)}${String.fromCodePoint(foreign)}${runValue(8)}`;
      expect(judge(value)).toBe('PASSWORD_NOT_PRINTABLE_ASCII');
    }
  });

  it('control characters: a value without one accepted; tab, line feed, NUL, escape, delete and one of the second block refused', () => {
    expect(judge(runValue(16))).toBeNull();
    for (const control of [0x09, 0x0a, 0x0d, 0x00, 0x1b, 0x7f, 0x85, 0x9f]) {
      expect(judge(`${runValue(8)}${String.fromCharCode(control)}${runValue(8)}`)).toBe('PASSWORD_CONTROL_CHARACTER');
    }
    // A control character names the refusal also beside a foreign character.
    expect(judge(`${runValue(8)}${String.fromCodePoint(0xe9)}${String.fromCharCode(0x07)}${runValue(8)}`)).toBe('PASSWORD_CONTROL_CHARACTER');
  });

  it('the demonstration password: refused as it is, in another letter case, and as a part - whatever its length; a value without it accepted', () => {
    const demo: string = DEMO_OPERATOR_PASSWORD;
    expect(demo.length).toBeGreaterThanOrEqual(1);
    expect(judge(runValue(20))).toBeNull();
    for (const form of [demo, demo.toUpperCase(), demo.toLowerCase(), turned(demo)]) {
      expect(judge(form)).toBe('PASSWORD_IS_DEMONSTRATION');
      expect(judge(`${runValue(9)}${form}`)).toBe('PASSWORD_IS_DEMONSTRATION');
      expect(judge(`${form}${runValue(9)}`)).toBe('PASSWORD_IS_DEMONSTRATION');
      expect(judge(`${runValue(6)}${form}${runValue(6)}`)).toBe('PASSWORD_IS_DEMONSTRATION');
    }
    // The demonstration password with one character taken out of its middle is no longer it (and is judged by the other rules).
    const cut = Math.floor(demo.length / 2);
    const broken = `${runValue(9)}${demo.slice(0, cut)}${demo.slice(cut + 1)}${runValue(9)}`;
    expect(judge(broken)).not.toBe('PASSWORD_IS_DEMONSTRATION');
  });

  it('the demonstration password is a handed-in fact: another fact refuses another value, and a missing one THROWS - the rule cannot be skipped', () => {
    const other = runValue(10);
    const carrying = `${runValue(6)}${turned(other)}${runValue(6)}`;
    judged.push(carrying);
    expect(checkNewPasswordAgainst(carrying, OPERATOR, { demonstrationPassword: other })?.code).toBe('PASSWORD_IS_DEMONSTRATION');
    expect(judge(carrying)).toBeNull();
    const accepted = runValue(20);
    for (const facts of [undefined, null, {}, { demonstrationPassword: '' }, { demonstrationPassword: 12 }, { demonstrationPassword: null }]) {
      const thrown = (() => {
        try {
          checkNewPasswordAgainst(accepted, OPERATOR, facts as unknown as PasswordPolicyFacts);
          return null;
        } catch (error) {
          return error;
        }
      })();
      expect(thrown).toBeInstanceOf(PasswordPolicyFactsError);
      expect((thrown as PasswordPolicyFactsError).code).toBe('PASSWORD_POLICY_FACTS_MISSING');
      // The error names the rule, never a value.
      expect((thrown as Error).message.includes(accepted)).toBe(false);
    }
  });

  it('the username of the operator: refused as it is, in another letter case, and as a part; the username of ANOTHER operator is not this rule', () => {
    for (const username of USERNAMES) {
      const operator = { username };
      expect(judge(runValue(20), operator)).toBeNull();
      for (const form of [username, username.toUpperCase(), turned(username)]) {
        expect(judge(`${form}${runValue(MIN)}`, operator)).toBe('PASSWORD_HOLDS_USERNAME');
        expect(judge(`${runValue(MIN)}${form}`, operator)).toBe('PASSWORD_HOLDS_USERNAME');
        expect(judge(`${runValue(4)}${form}${runValue(4)}`, operator)).toBe('PASSWORD_HOLDS_USERNAME');
        // The username alone is refused as the username, whatever its length.
        expect(judge(form, operator)).toBe('PASSWORD_HOLDS_USERNAME');
      }
      // The stored username in capitals, the typed password in small letters.
      expect(judge(`${runValue(4)}${username.toLowerCase()}${runValue(4)}`, { username: username.toUpperCase() })).toBe('PASSWORD_HOLDS_USERNAME');
    }
    const [first, second] = USERNAMES;
    expect(first).not.toBe(second);
    expect(judge(`${runValue(4)}${second}${runValue(4)}`, { username: first ?? '' })).toBeNull();
    // Without a username nothing is accepted: the rule cannot be skipped by leaving it out.
    expect(judge(runValue(20), { username: '' })).toBe('USERNAME_MISSING');
  });

  it('one repeated character: refused at 12 and at 128, also for the space; two different characters accepted', () => {
    const character = pick(MIXED, 1);
    expect(judge(character.repeat(MIN))).toBe('PASSWORD_ONE_CHARACTER');
    expect(judge(character.repeat(MAX))).toBe('PASSWORD_ONE_CHARACTER');
    expect(judge(' '.repeat(MIN))).toBe('PASSWORD_ONE_CHARACTER');
    const other = pick(MIXED.replace(character, ''), 1);
    expect(judge(`${character.repeat(MIN - 1)}${other}`)).toBeNull();
  });

  it('no composition rule: small letters only, digits only and capitals only are accepted at the minimum length', () => {
    expect(judge(runValue(MIN, LETTERS))).toBeNull();
    expect(judge(runValue(MIN, '0123456789'))).toBeNull();
    expect(judge(runValue(MIN, LETTERS.toUpperCase()))).toBeNull();
  });

  it('no trim and no fold: a space at either end counts as a character and is not removed', () => {
    const inner = runValue(MIN - 2);
    // 10 characters alone are too short; with a space at each end they are 12 and accepted: nothing was trimmed.
    expect(judge(inner)).toBe('PASSWORD_TOO_SHORT');
    expect(judge(` ${inner} `)).toBeNull();
    // 128 characters with a space added are 129 and refused: nothing was trimmed here either.
    expect(judge(`${runValue(MAX)} `)).toBe('PASSWORD_TOO_LONG');
    // The judgement leaves the value as it was (a text cannot be changed in place; the function returns no value of its own).
    const spaced = ` ${runValue(MIN)} `;
    const copy = `${spaced}`;
    judge(spaced);
    expect(spaced).toBe(copy);
  });

  it('what is not text is refused', () => {
    for (const value of [undefined, null, 12345678901234, ['a'], { length: 20 }]) {
      expect(checkNewPasswordAgainst(value as unknown as string, OPERATOR, FACTS)?.code).toBe('PASSWORD_NOT_TEXT');
    }
  });

  it('the order of the rules: the first that refuses names the refusal', () => {
    const demo: string = DEMO_OPERATOR_PASSWORD;
    // Too long comes before everything; a control character before a foreign one; the demonstration password and the username before the length.
    expect(judge(`${demo}${runValue(MAX)}`)).toBe('PASSWORD_TOO_LONG');
    expect(judge(`${demo}${String.fromCharCode(0x09)}`)).toBe('PASSWORD_CONTROL_CHARACTER');
    expect(judge(`${demo}${USERNAME}`)).toBe('PASSWORD_IS_DEMONSTRATION');
    expect(judge(`${USERNAME}${String.fromCodePoint(0xe9)}`)).toBe('PASSWORD_NOT_PRINTABLE_ASCII');
    // Too short comes before "one character repeated".
    expect(judge(pick(MIXED, 1).repeat(MIN - 1))).toBe('PASSWORD_TOO_SHORT');
  });
});

describe('the repeat helper of one run, on a handed-in keyed digest', () => {
  it('refuses a second use of a value in one run, by the exact value only', async () => {
    const guard = createRunRepeatGuardWith(runDigest());
    const first = runValue(18);
    const second = runValue(18);
    expect(await guard.refusalOf(first)).toBeNull();
    // Asking does not remember: the value is remembered only when the command says it was set.
    expect(await guard.refusalOf(first)).toBeNull();
    await guard.remember(first);
    expect(await guard.refusalOf(first)).toEqual({ code: 'PASSWORD_REPEATED_IN_RUN', message: PASSWORD_POLICY_REFUSAL.PASSWORD_REPEATED_IN_RUN });
    expect(await guard.refusalOf(second)).toBeNull();
    // Taken as typed here too: another letter case, or a space more, is another value.
    expect(await guard.refusalOf(turned(first) === first ? `${first} ` : turned(first))).toBeNull();
    expect(await guard.refusalOf(`${first} `)).toBeNull();
    await guard.remember(second);
    expect((await guard.refusalOf(second))?.code).toBe('PASSWORD_REPEATED_IN_RUN');
    expect((await guard.refusalOf(first))?.code).toBe('PASSWORD_REPEATED_IN_RUN');
  });

  it('is of ONE run: a guard on another key knows nothing of the first, and exposes two functions and no value', async () => {
    const one = createRunRepeatGuardWith(runDigest());
    const other = createRunRepeatGuardWith(runDigest());
    const value = runValue(18);
    await one.remember(value);
    expect(await other.refusalOf(value)).toBeNull();
    expect(Object.keys(one).sort()).toEqual(['refusalOf', 'remember']);
    expect(JSON.stringify(one)).toBe('{}');
  });

  it('keeps what the digest answers and never the value: the digest is asked once per call, with the value as typed', async () => {
    const seen: string[] = [];
    const inner = runDigest();
    const guard = createRunRepeatGuardWith(async (password) => {
      seen.push(password);
      return inner(password);
    });
    const value = ` ${runValue(16)} `;
    await guard.remember(value);
    await guard.refusalOf(value);
    expect(seen).toEqual([value, value]);
  });

  it('a comparer that fails, answers no text, or is no function is RunRepeatGuardError: a repeat is never "not found" because the comparer broke', async () => {
    const value = runValue(18);
    const broken: readonly RunRepeatDigest[] = [
      async () => {
        throw new Error('synthetic');
      },
      async () => '',
      (async () => 7) as unknown as RunRepeatDigest,
    ];
    for (const digest of broken) {
      const guard = createRunRepeatGuardWith(digest);
      for (const call of [() => guard.refusalOf(value), () => guard.remember(value)]) {
        const failure = await call().then(
          () => null,
          (error: unknown) => error,
        );
        expect(failure).toBeInstanceOf(RunRepeatGuardError);
        expect((failure as RunRepeatGuardError).code).toBe('RUN_REPEAT_GUARD_UNAVAILABLE');
        expect((failure as Error).message.includes(value)).toBe(false);
      }
    }
    expect(() => createRunRepeatGuardWith(undefined as unknown as RunRepeatDigest)).toThrow(RunRepeatGuardError);
  });

  it('works on the Web Crypto of this package\'s own test runtime, as the server binds it: HMAC-SHA-256 under a key that cannot be exported', async () => {
    const subtle = globalThis.crypto.subtle;
    const material = globalThis.crypto.getRandomValues(new Uint8Array(32));
    const key = await subtle.importKey('raw', material, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    material.fill(0);
    const guard = createRunRepeatGuardWith(async (password) => Buffer.from(await subtle.sign('HMAC', key, new TextEncoder().encode(password))).toString('hex'));
    const value = runValue(18);
    expect(await guard.refusalOf(value)).toBeNull();
    await guard.remember(value);
    expect((await guard.refusalOf(value))?.code).toBe('PASSWORD_REPEATED_IN_RUN');
    expect(await guard.refusalOf(runValue(18))).toBeNull();
    await expect(subtle.exportKey('raw', key)).rejects.toBeDefined();
  });
});

describe('the module itself', () => {
  const path = fileURLToPath(new URL('../src/api/password-policy.ts', import.meta.url));
  const source = readFileSync(path, 'utf8');
  const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:\\])\/\/.*$/gm, '$1');

  it('imports the sign-in bound of its own folder and nothing else: no simulator file, no package, no Node built-in', () => {
    const specifiers = [...code.matchAll(/(?:from\s+|import\s*\(\s*|require\s*\(\s*)['"]([^'"]+)['"]/g)].map((match) => match[1]);
    expect(specifiers).toEqual(['./identity']);
    expect(code.match(/\bconsole\s*\.|\bprocess\s*\.|\blog\s*\.|\brequire\s*\(|\bnode:/g)).toBeNull();
  });

  it('is platform neutral: it names no Web Crypto, no global object and no random source (the phone and tablet runtime has none)', () => {
    expect(code.match(/\bcrypto\b|\bsubtle\b|\bglobalThis\b|\bCryptoKey\b|getRandomValues|Math\s*\.\s*random|\bBuffer\b|\bwindow\b|\bdocument\b/g)).toBeNull();
  });

  it('holds the demonstration password nowhere and does not name its constant: the value is handed in', () => {
    const demo: string = DEMO_OPERATOR_PASSWORD;
    expect(/\bDEMO_OPERATOR_PASSWORD\b/.test(code)).toBe(false);
    expect(source.toLowerCase().includes(demo.toLowerCase())).toBe(false);
    expect(readFileSync(fileURLToPath(import.meta.url), 'utf8').toLowerCase().includes(demo.toLowerCase())).toBe(false);
    // Its one comparison, on the handed-in text.
    expect(code.split('\n').filter((line) => /PASSWORD_IS_DEMONSTRATION'\)/.test(line)).map((line) => line.trim())).toEqual([
      "if (holdsFolded(password, demonstration.toLowerCase())) return refusal('PASSWORD_IS_DEMONSTRATION');",
    ]);
  });

  it('does not trim, fold the password or normalise it, and calls no hash wrapper', () => {
    expect(code.match(/\.trim\w*\(|\.normalize\(|password\.to(?:Lower|Upper)Case\(/g)).toBeNull();
    expect(code.match(/hashPassword|verifyPassword|password-hash/g)).toBeNull();
  });

  it('is exported by the contract barrel with ONE line, the same functions', () => {
    expect(api.checkNewPasswordAgainst).toBe(checkNewPasswordAgainst);
    expect(api.createRunRepeatGuardWith).toBe(createRunRepeatGuardWith);
    expect(api.PASSWORD_POLICY).toBe(PASSWORD_POLICY);
    const barrel = readFileSync(fileURLToPath(new URL('../src/api/index.ts', import.meta.url)), 'utf8');
    expect(barrel.split('\n').filter((line) => line.includes('password-policy'))).toEqual(["export * from './password-policy';"]);
  });
});
