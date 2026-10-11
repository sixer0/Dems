/**
 * ONE table for the rules the module folders hold word for word (not a test file; test-suite
 * consolidation, test/14, action SV-U4).
 *
 * The static guards of `alerts`, `system`, `storage` and `network-time` each wrote the same
 * cases out: "no file reads the system time", "no slot of the scaffold is replaced", ... - the
 * same assertions on another folder. A rule is now defined ONCE here, as the patterns that must
 * occur nowhere in the folder's code, and every folder that holds it states it with one line:
 *
 *   itHoldsNone(MODULE_RULES.noSlotReplaced, rules, code);
 *
 * The patterns themselves stay where they are, with their planted texts (the positive controls):
 * `src/modules/system/__tests__/static-rules.ts` and `src/modules/storage/__tests__/static-rules.ts`.
 * This table names them; the type of `itHoldsNone` refuses a rule table that lacks one of them.
 * A folder whose sentence for a rule is its own passes it as the title: the assertions are the
 * table's either way.
 */
import { expect, it } from 'vitest';
import type { SourceFile } from './scan';

export interface ModuleRule<Pattern extends string> {
  /** The sentence of the rule: the title of the case unless the folder has its own. */
  readonly title: string;
  /** The patterns of the folder's rule table that must occur in no file of the folder. */
  readonly absent: readonly Pattern[];
}

const rule = <Pattern extends string>(title: string, ...absent: Pattern[]): ModuleRule<Pattern> => ({ title, absent });

export const MODULE_RULES = {
  /** Row rule 3, ENG-13: every instant in an answer is the engine's. */
  noSystemTimeNoTimer: rule('no file reads the system time or sets a timer', 'SYSTEM_TIME', 'TIMER'),
  noClockAtAll: rule('no file reads a clock at all: the engine stamps what is stamped', 'ANY_CLOCK'),
  noTimeAtAll: rule('no file reads the system time, sets a timer or reads a clock at all', 'SYSTEM_TIME', 'TIMER', 'ANY_CLOCK'),
  /** Row rule 3: nothing of the host. */
  noHost: rule("no file imports a module of the runtime or names the host's network state", 'HOST_MODULE', 'HOST_STATE'),
  noHostConsoleRandom: rule('no file imports a module of the runtime, names the process or the network, uses the console or a random source', 'HOST_MODULE', 'HOST_STATE', 'CONSOLE', 'RANDOM'),
  noConsoleRandomLog: rule('no console, no random source, no log line of its own', 'CONSOLE', 'RANDOM', 'LOG_CALL'),
  /** M3: who may call is stage 6's. */
  noAccessCheck: rule('no file reads a role, a permission, a session or a device, or names a caller that is no operator', 'ACCESS_CHECK'),
  /** M4, M5: one state, the engine's. */
  noOwnStorage: rule('no unit of work, no table, no statement, no audit writer, no publication', 'OWN_STORAGE'),
  /** M8: the scaffold stays whole. */
  noSlotReplaced: rule('no slot of the scaffold is provided or replaced, and no test file is imported', 'SLOT_REPLACED', 'TEST_IMPORT'),
  /** M14: an error is logged by its code. */
  noErrorMember: rule('no object of the folder holds a member under which an error would be logged (M14)', 'ERROR_MEMBER'),
} as const;

/** What a rule table of a module folder gives a shared rule: the patterns it names, and where a pattern occurs. */
export type RuleTable<Pattern extends string> = Record<Pattern, RegExp> & {
  places(where: readonly SourceFile[], pattern: RegExp): string[];
};

/**
 * States one rule of the table for one folder: a case that fails with `path:line` of every
 * occurrence, under the name of the pattern that found it.
 */
export function itHoldsNone<Pattern extends string>(shared: ModuleRule<Pattern>, rules: RuleTable<Pattern>, code: readonly SourceFile[], title: string = shared.title): void {
  it(title, () => {
    for (const pattern of shared.absent) expect(rules.places(code, rules[pattern]), pattern).toEqual([]);
  });
}
