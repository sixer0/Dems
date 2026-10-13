/**
 * THE PASSWORD POLICY for a NEW password (task 4 blueprint row 212, package X2-1; design
 * `masterplan/05_design_x1_x2.md` section 3.5; security review SX-13; requirement R-X2-6; the
 * working defaults UD-6 and UD-12 of decisions C42 and C44). Its HOME is this package since row V3
 * (decision C53 (2)): it came from `apps/core-server/src/modules/identity/password-policy.ts`, which
 * now re-exports it and binds the two facts named below.
 *
 * ONE module, for the host command now (row 215) and for a console operation later. It judges a
 * password BEFORE it is hashed. It does not hash, store, log or print anything.
 *
 * THE RULES, in the order they are asked. The first that refuses names the refusal:
 *   1. at most 128 UTF-16 code units - the bound of the sign-in contract and of the hash wrapper
 *      (`SIGN_IN_LIMITS.passwordMax`), imported, not copied;
 *   2. no control character;
 *   3. printable ASCII only (U+0020 to U+007E, the space included). An AVAILABILITY rule, not a
 *      strength rule: the hash takes the bytes as typed, without normalisation, and three keyboards
 *      (the console's, the tablet's, the phone's) can send one accented letter as different bytes;
 *   4. not the published demonstration password, in any letter case, and not a value that
 *      contains it. The compared text is handed in (`PasswordPolicyFacts`), see below;
 *   5. not the operator's own username, in any letter case, and not a value that contains it;
 *   6. at least 12 characters, counted in code points;
 *   7. not one character repeated.
 * NOT rules: no composition rule (digits, signs, capitals), no expiry, no history. The password is
 * taken AS TYPED: nothing here trims, folds or normalises it, and a space at either end counts.
 *
 * COMPARISON WITHOUT AN EARLY EXIT. Rules 4 and 5 visit every position of the password and every
 * character of the compared text, whatever they find: the time depends on the two lengths only.
 *
 * TWO THINGS ARE HANDED IN, and why (row V3; both are bound by the Core server's identity module):
 *   (a) THE DEMONSTRATION PASSWORD. The seed's constant lives in `sim/dataset.ts`, the simulator's
 *       dataset. `@dems/shared/api` may load two leaf modules of the simulator and nothing else of
 *       it (`test/live-source-platform-neutral.test.ts` holds the dataset out of the Live graph), so
 *       this file does not import it: the caller names the constant BY IMPORT and hands it in.
 *       Facts that are no text, or an empty one, are a programming error and THROW
 *       (`PasswordPolicyFactsError`): the rule can never be skipped by leaving the fact out.
 *   (b) THE KEYED DIGEST OF THE REPEAT HELPER. `createRunRepeatGuardWith` tells, inside ONE run of
 *       a command, that a value was already set for another operator - which salted hashes cannot
 *       show. It keeps what the handed-in digest answers and nothing else. The digest is made
 *       where the key can be made: this package is loaded by the phone and tablet client too, and
 *       its runtime (Hermes) has no Web Crypto (`demo-data/verify.ts` says the same), so the
 *       per-run random key and the HMAC stay on the server.
 *
 * PLATFORM NEUTRAL: no Node built-in, no Web Crypto, no file system, no logger, no clock. The one
 * import is the sign-in bound of this folder.
 *
 * No refusal holds the password, a part of it, or its length: a refusal is a code and fixed words.
 */
import { SIGN_IN_LIMITS } from './identity';

/** The two numbers of the policy (UD-6). The maximum is the sign-in contract's. */
export const PASSWORD_POLICY = {
  /** Counted in code points. */
  minimumCharacters: 12,
  /** Counted in UTF-16 code units, as the hash wrapper counts. */
  maximumCodeUnits: SIGN_IN_LIMITS.passwordMax,
} as const;

/** Every refusal: its code and its fixed words. The words quote no input. */
export const PASSWORD_POLICY_REFUSAL = {
  PASSWORD_NOT_TEXT: 'The password is not text.',
  PASSWORD_TOO_LONG: 'The password is longer than 128 characters.',
  PASSWORD_CONTROL_CHARACTER: 'The password holds a control character.',
  PASSWORD_NOT_PRINTABLE_ASCII: 'The password holds a character that is not a plain letter, a digit, a space or a common sign (letters with accents and other scripts are not accepted).',
  PASSWORD_IS_DEMONSTRATION: 'The password is, or contains, the published demonstration password.',
  PASSWORD_HOLDS_USERNAME: 'The password is, or contains, the username of its operator.',
  PASSWORD_TOO_SHORT: 'The password is shorter than 12 characters.',
  PASSWORD_ONE_CHARACTER: 'The password is one character repeated.',
  PASSWORD_REPEATED_IN_RUN: 'This password was already set for another operator in this run.',
  USERNAME_MISSING: 'The username of the operator was not given, so the password cannot be judged.',
} as const;
export type PasswordPolicyRefusalCode = keyof typeof PASSWORD_POLICY_REFUSAL;

export interface PasswordPolicyRefusal {
  readonly code: PasswordPolicyRefusalCode;
  /** The fixed words of the code. */
  readonly message: string;
}

/** What the caller hands in for rule 4. Named by import where it is bound; never typed out. */
export interface PasswordPolicyFacts {
  /** The published demonstration password of the seed: the value rule 4 refuses, in any letter case. */
  readonly demonstrationPassword: string;
}

/** The facts of the policy were not handed in as text: a programming error, never an answer about a password. A code only. */
export class PasswordPolicyFactsError extends Error {
  readonly code = 'PASSWORD_POLICY_FACTS_MISSING';
  constructor() {
    super('The password policy was not given the text it compares with.');
    this.name = 'PasswordPolicyFactsError';
  }
}

function refusal(code: PasswordPolicyRefusalCode): PasswordPolicyRefusal {
  return { code, message: PASSWORD_POLICY_REFUSAL[code] };
}

/** A capital letter of ASCII as its small letter; every other code unit as it is. */
function foldUnit(unit: number): number {
  return unit >= 0x41 && unit <= 0x5a ? unit + 0x20 : unit;
}

/**
 * Whether `text` contains `part`, letter case of ASCII ignored. NO EARLY EXIT: every position and
 * every character of `part` is visited, so the time depends on the two lengths only.
 */
function holdsFolded(text: string, part: string): boolean {
  if (part.length === 0 || part.length > text.length) return false;
  let found = 0;
  for (let at = 0; at + part.length <= text.length; at += 1) {
    let different = 0;
    for (let index = 0; index < part.length; index += 1) {
      different |= foldUnit(text.charCodeAt(at + index)) ^ foldUnit(part.charCodeAt(index));
    }
    found |= different === 0 ? 1 : 0;
  }
  return found === 1;
}

function countCodePoints(text: string): number {
  let count = 0;
  for (const _character of text) count += 1;
  return count;
}

function isOneCharacterRepeated(text: string): boolean {
  let first: string | null = null;
  let same = 1;
  for (const character of text) {
    if (first === null) first = character;
    else same &= character === first ? 1 : 0;
  }
  return first !== null && same === 1;
}

/** 0 = printable ASCII, 1 = a control character, 2 = anything else. The worst of the whole text. */
function worstCharacterClass(text: string): 0 | 1 | 2 {
  let control = 0;
  let foreign = 0;
  for (let index = 0; index < text.length; index += 1) {
    const unit = text.charCodeAt(index);
    // U+0000 to U+001F, U+007F, and the second control block U+0080 to U+009F.
    if (unit < 0x20 || (unit >= 0x7f && unit <= 0x9f)) control = 1;
    else if (unit > 0x7e) foreign = 1;
  }
  return control === 1 ? 1 : foreign === 1 ? 2 : 0;
}

/**
 * Judges a NEW password for one operator. `null` = accepted. Pure: the same input gives the same
 * answer, and nothing is read or written. Called before the password is hashed (R-X2-6).
 * `facts` is what rule 4 compares with; it throws `PasswordPolicyFactsError` when that is missing.
 */
export function checkNewPasswordAgainst(password: string, operator: { readonly username: string }, facts: PasswordPolicyFacts): PasswordPolicyRefusal | null {
  const demonstration: unknown = (facts as PasswordPolicyFacts | null | undefined)?.demonstrationPassword;
  if (typeof demonstration !== 'string' || demonstration.length === 0) throw new PasswordPolicyFactsError();
  if (typeof password !== 'string') return refusal('PASSWORD_NOT_TEXT');
  if (typeof operator?.username !== 'string' || operator.username.length === 0) return refusal('USERNAME_MISSING');
  if (password.length > PASSWORD_POLICY.maximumCodeUnits) return refusal('PASSWORD_TOO_LONG');
  const worst = worstCharacterClass(password);
  if (worst === 1) return refusal('PASSWORD_CONTROL_CHARACTER');
  if (worst === 2) return refusal('PASSWORD_NOT_PRINTABLE_ASCII');
  if (holdsFolded(password, demonstration.toLowerCase())) return refusal('PASSWORD_IS_DEMONSTRATION');
  if (holdsFolded(password, operator.username.toLowerCase())) return refusal('PASSWORD_HOLDS_USERNAME');
  if (countCodePoints(password) < PASSWORD_POLICY.minimumCharacters) return refusal('PASSWORD_TOO_SHORT');
  if (isOneCharacterRepeated(password)) return refusal('PASSWORD_ONE_CHARACTER');
  return null;
}

/** Tells a repeat inside one run. Made once per run of a command; never shared between runs. */
export interface RunRepeatGuard {
  /** The refusal `PASSWORD_REPEATED_IN_RUN` when this value was remembered in this run, else `null`. */
  refusalOf(password: string): Promise<PasswordPolicyRefusal | null>;
  /** Remembers a value that WAS set (after its transaction committed), as its keyed digest only. */
  remember(password: string): Promise<void>;
}

/** Why the guard could not be made, or could not digest. A code only. */
export class RunRepeatGuardError extends Error {
  readonly code = 'RUN_REPEAT_GUARD_UNAVAILABLE';
  constructor() {
    super('The repeat check of this run could not be prepared.');
    this.name = 'RunRepeatGuardError';
  }
}

/**
 * The comparer a guard is built on: a KEYED digest of a value, as text. The same value gives the
 * same text inside one run and another text in another run (the key is made per run by whoever
 * hands this in). It must not keep, log or return the value.
 */
export type RunRepeatDigest = (password: string) => Promise<string>;

/**
 * A guard for one run on a handed-in keyed digest. It keeps the digests it was told to remember,
 * in memory, and nothing else: no value, no key. A digest that fails, or answers no text, is
 * `RunRepeatGuardError` - a repeat is never "not found" because the comparer broke.
 */
export function createRunRepeatGuardWith(digestOf: RunRepeatDigest): RunRepeatGuard {
  if (typeof digestOf !== 'function') throw new RunRepeatGuardError();
  const remembered = new Set<string>();

  async function digest(password: string): Promise<string> {
    let answer: unknown;
    try {
      answer = await digestOf(password);
    } catch {
      throw new RunRepeatGuardError();
    }
    if (typeof answer !== 'string' || answer.length === 0) throw new RunRepeatGuardError();
    return answer;
  }

  return {
    async refusalOf(password) {
      return remembered.has(await digest(password)) ? refusal('PASSWORD_REPEATED_IN_RUN') : null;
    },
    async remember(password) {
      remembered.add(await digest(password));
    },
  };
}
