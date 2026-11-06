/**
 * The text rule of the contract (backend task: 2026-10-04 01_specs §7.1 API-13, SR-64; decisions
 * D14 SPEC-GAP-1 and D30 D-b; 03_database_contract §13.1).
 *
 * Every free-text string a client may send refuses two things, with 422 `INVALID_INPUT`, before
 * the engine runs:
 * - the character U+0000: PostgreSQL `text` and `jsonb` cannot store it, so the insert would fail
 *   and the command would end as a commit failure;
 * - ill-formed UTF-16 (an unpaired surrogate): the driver encodes it as U+FFFD, so the stored
 *   audit row would no longer hash to its chain hash.
 *
 * `apiText()` is the one string schema that carries the rule. A string that is bound by a pattern
 * or an enum (an ID, a code, a value set) needs no rule of its own: its pattern already refuses
 * both. The password of `SignInRequest` is free text and carries the rule too (D30 D-b).
 * test/api-text-rule.test.ts walks every request schema of the registry and fails when a string
 * of it accepts either.
 *
 * The rule is a refinement, which JSON Schema cannot express, so `openapi.json` does not change.
 */
import { z } from 'zod';

/** Message of the issue the rule raises. English and operator-safe; it quotes no input. */
export const API_TEXT_RULE_MESSAGE = 'Text must not contain the character U+0000 or an unpaired UTF-16 surrogate.';

/**
 * True when `value` holds no U+0000 and every surrogate is half of a pair. A plain loop over the
 * code units: `String.prototype.isWellFormed` is not in every runtime the contract loads in.
 */
export function isWellFormedText(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const unit = value.charCodeAt(index);
    if (unit === 0) return false;
    if (unit >= 0xd800 && unit <= 0xdbff) {
      const next = value.charCodeAt(index + 1);
      if (!(next >= 0xdc00 && next <= 0xdfff)) return false;
      index += 1;
    } else if (unit >= 0xdc00 && unit <= 0xdfff) {
      return false;
    }
  }
  return true;
}

/**
 * A string schema with the text rule. Chain `.overwrite()`, `.min()`, `.max()` after it. When the
 * rule fails, the later checks do not run, so the caller gets one issue with `message`.
 */
export function apiText(message: string = API_TEXT_RULE_MESSAGE) {
  return z.string().refine(isWellFormedText, { error: message, abort: true });
}
