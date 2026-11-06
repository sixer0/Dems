// The password policy for a new password (task 4 blueprint row 212; SX-13; R-X2-6; UD-6, UD-12):
// WHAT THE SERVER BINDS. The policy itself and its rule table moved to the shared package with row V3
// (decision C53 (2)): `packages/shared/src/api/password-policy.ts`, tested by
// `packages/shared/test/api-password-policy.test.ts`. This file keeps what lives here: the judge
// with the seed's demonstration constant bound, the per-run key of the repeat helper (the runtime's
// Web Crypto), and the identity module's exports.
//
// EVERY VALUE IS BUILT IN THIS RUN, from `node:crypto`. No password is a literal
// of this file. The published demonstration password is named by its imported constant only and is
// never written out; the usernames are the dataset's, by import. Nothing is written to disk.
import { randomInt } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import * as sharedApi from '@dems/shared/api';
import { SIGN_IN_LIMITS, checkNewPasswordAgainst } from '@dems/shared/api';
import { DEMO_OPERATOR_PASSWORD, OPERATORS } from '@dems/shared/sim';
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  PASSWORD_POLICY,
  PASSWORD_POLICY_REFUSAL,
  RunRepeatGuardError,
  checkNewPassword,
  createRunRepeatGuard,
  type PasswordPolicyRefusalCode,
} from '../password-policy';
import { PASSWORD_MAX_LENGTH } from '../password-hash';
import * as identity from '../index';

const MIXED = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!#%&()*+,-./:;<=>?@[]^_{|}~';
const pick = (alphabet: string, length: number): string => Array.from({ length }, () => alphabet[randomInt(alphabet.length)]).join('');

const USERNAMES = OPERATORS.map((operator) => operator.username);
const USERNAME = USERNAMES[randomInt(USERNAMES.length)] ?? '';
const OPERATOR = { username: USERNAME };
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
  const answer = checkNewPassword(value, operator);
  if (answer !== null) {
    // A refusal is its code and the fixed words of that code: no part of the value, no length of it.
    expect(answer).toEqual({ code: answer.code, message: PASSWORD_POLICY_REFUSAL[answer.code] });
  }
  return answer?.code ?? null;
};
/** The letter case of every second letter turned. */
const turned = (value: string): string =>
  Array.from(value, (character, index) => (index % 2 === 0 ? character.toUpperCase() : character.toLowerCase())).join('');

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
  if (searched.length < 12) throw new Error('the capture covered fewer values than this file judges');
  if (searched.some((value) => all.includes(value))) throw new Error('a judged value reached a process stream or the console');
});

describe('the numbers', () => {
  it('minimum 12; the maximum is the bound of the sign-in contract and of the hash wrapper, not a third number', () => {
    expect(MIN).toBe(12);
    expect(MAX).toBe(128);
    expect(MAX).toBe(SIGN_IN_LIMITS.passwordMax);
    expect(MAX).toBe(PASSWORD_MAX_LENGTH);
    expect(PASSWORD_POLICY_REFUSAL.PASSWORD_TOO_SHORT).toContain(` ${MIN} `);
    expect(PASSWORD_POLICY_REFUSAL.PASSWORD_TOO_LONG).toContain(` ${MAX} `);
  });
});

describe('the judge with the seed\'s demonstration password bound (the rule table is the shared package\'s)', () => {
  it('is the shared policy for every input: the same answer as the shared judge with the seed\'s constant handed in', () => {
    const demo: string = DEMO_OPERATOR_PASSWORD;
    const values = [
      runValue(MIN),
      runValue(MIN - 1),
      runValue(MAX),
      runValue(MAX + 1),
      `${runValue(8)}${String.fromCodePoint(0xe9)}${runValue(8)}`,
      `${runValue(8)}${String.fromCharCode(0x09)}${runValue(8)}`,
      `${runValue(6)}${turned(demo)}${runValue(6)}`,
      `${runValue(4)}${USERNAME.toUpperCase()}${runValue(4)}`,
      pick(MIXED, 1).repeat(MIN),
      ` ${runValue(MIN - 2)} `,
    ];
    const codes = values.map((value) => judge(value));
    expect(codes).toEqual(values.map((value) => checkNewPasswordAgainst(value, OPERATOR, { demonstrationPassword: demo })?.code ?? null));
    // Every kind of answer is among them: the comparison is not of ten equal answers.
    expect(new Set(codes)).toEqual(
      new Set([null, 'PASSWORD_TOO_SHORT', 'PASSWORD_TOO_LONG', 'PASSWORD_NOT_PRINTABLE_ASCII', 'PASSWORD_CONTROL_CHARACTER', 'PASSWORD_IS_DEMONSTRATION', 'PASSWORD_HOLDS_USERNAME', 'PASSWORD_ONE_CHARACTER']),
    );
  });

  it('refuses the demonstration password as it is, in another letter case and as a part, with no fact handed in by the caller', () => {
    const demo: string = DEMO_OPERATOR_PASSWORD;
    expect(checkNewPassword.length).toBe(2);
    for (const form of [demo, demo.toUpperCase(), turned(demo)]) {
      expect(judge(form)).toBe('PASSWORD_IS_DEMONSTRATION');
      expect(judge(`${runValue(6)}${form}${runValue(6)}`)).toBe('PASSWORD_IS_DEMONSTRATION');
    }
    expect(judge(runValue(20), { username: '' })).toBe('USERNAME_MISSING');
    expect(checkNewPassword(undefined as unknown as string, OPERATOR)?.code).toBe('PASSWORD_NOT_TEXT');
  });
});

describe('the repeat helper of one run', () => {
  it('refuses a second use of a value in one run, by the exact value only', async () => {
    const guard = await createRunRepeatGuard();
    const first = runValue(18);
    const second = runValue(18);
    judged.push(first, second);
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

  it('is of ONE run: another guard knows nothing of the first, and keeps no value in a form that can be read', async () => {
    const one = await createRunRepeatGuard();
    const other = await createRunRepeatGuard();
    const value = runValue(18);
    await one.remember(value);
    expect(await other.refusalOf(value)).toBeNull();
    // What a guard exposes is two functions; no member holds the value, the key or a digest.
    expect(Object.keys(one).sort()).toEqual(['refusalOf', 'remember']);
    expect(JSON.stringify(one)).toBe('{}');
  });

  it('the key is made by the runtime and cannot be exported; without the runtime\'s generator no guard is made', async () => {
    const importKey = vi.spyOn(globalThis.crypto.subtle, 'importKey');
    const random = vi.spyOn(globalThis.crypto, 'getRandomValues');
    await createRunRepeatGuard();
    expect(random).toHaveBeenCalledTimes(1);
    expect(importKey).toHaveBeenCalledTimes(1);
    const [format, material, algorithm, extractable, usages] = importKey.mock.calls[0] ?? [];
    expect([format, algorithm, extractable, usages]).toEqual(['raw', { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']]);
    // The bytes the key was made from: 32 of them, zeroed once the key object exists.
    expect((material as Uint8Array).length).toBe(32);
    expect((material as Uint8Array).every((byte) => byte === 0)).toBe(true);
    importKey.mockRejectedValueOnce(new Error('synthetic'));
    const failure = await createRunRepeatGuard().then(
      () => null,
      (error: unknown) => error,
    );
    expect(failure).toBeInstanceOf(RunRepeatGuardError);
    expect((failure as RunRepeatGuardError).code).toBe('RUN_REPEAT_GUARD_UNAVAILABLE');
  });
});

describe('the module itself', () => {
  const source = readFileSync(resolve(import.meta.dirname, '..', 'password-policy.ts'), 'utf8');
  const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:\\])\/\/.*$/gm, '$1');

  it('imports the shared package twice and nothing else: no file system, no logger, no Node built-in', () => {
    const specifiers = [...code.matchAll(/(?:from\s+|import\s*\(\s*|require\s*\(\s*)['"]([^'"]+)['"]/g)].map((match) => match[1]);
    expect(specifiers.sort()).toEqual(['@dems/shared/api', '@dems/shared/sim']);
    expect(code.match(/\bconsole\s*\.|\bprocess\s*\.|\blog\s*\.|\brequire\s*\(|\bnode:/g)).toBeNull();
  });

  it('holds no rule of its own: the policy is the shared package\'s, re-exported - the same objects', () => {
    expect(PASSWORD_POLICY).toBe(sharedApi.PASSWORD_POLICY);
    expect(PASSWORD_POLICY_REFUSAL).toBe(sharedApi.PASSWORD_POLICY_REFUSAL);
    expect(RunRepeatGuardError).toBe(sharedApi.RunRepeatGuardError);
    // No comparison, no count and no character class is written here: one call of the shared judge, one of the shared guard.
    expect(code.match(/charCodeAt|codePointAt|\.length\s*[<>]|holdsFolded|new Set\b/g)).toBeNull();
    expect(code.match(/\bcheckNewPasswordAgainst\s*\(/g)).toHaveLength(1);
    expect(code.match(/\bcreateRunRepeatGuardWith\s*\(/g)).toHaveLength(1);
  });

  it('names the demonstration constant in two lines - its import and the one place it is handed to the shared judge - and holds its value nowhere', () => {
    const naming = code.split('\n').filter((line) => /\bDEMO_OPERATOR_PASSWORD\b/.test(line)).map((line) => line.trim());
    expect(naming).toEqual([
      "import { DEMO_OPERATOR_PASSWORD } from '@dems/shared/sim';",
      'return checkNewPasswordAgainst(password, operator, { demonstrationPassword: DEMO_OPERATOR_PASSWORD });',
    ]);
    const demo: string = DEMO_OPERATOR_PASSWORD;
    expect(source.toLowerCase().includes(demo.toLowerCase())).toBe(false);
    expect(readFileSync(import.meta.filename, 'utf8').toLowerCase().includes(demo.toLowerCase())).toBe(false);
  });

  it('does not trim, fold the password or normalise it, and calls no hash wrapper', () => {
    expect(code.match(/\.trim\w*\(|\.normalize\(|password\.to(?:Lower|Upper)Case\(/g)).toBeNull();
    expect(code.match(/hashPassword|verifyPassword|password-hash/g)).toBeNull();
  });

  it('is exported by the identity module, the same functions', () => {
    expect(identity.checkNewPassword).toBe(checkNewPassword);
    expect(identity.createRunRepeatGuard).toBe(createRunRepeatGuard);
    expect(identity.PASSWORD_POLICY).toBe(PASSWORD_POLICY);
    expect(identity.PASSWORD_POLICY_REFUSAL).toBe(PASSWORD_POLICY_REFUSAL);
  });
});
