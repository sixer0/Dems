/**
 * Test support (not a test file) for the helper's own database tests: runs that a test starts
 * for itself, beside the run of the global setup, to exercise the parts a test file never
 * calls (templates from hooks, the teardown, the sweep).
 */
import { ENV_TEST_STEP } from '../constants';
import { injectedResolver, standardDefinitions, type DefinitionResolver, type TemplateDefinition } from '../hooks';
import { providedRun } from '../index';
import { TestRun, type StartOptions } from '../run';
import { PROBE_HOOKS, SELFTEST_TEMPLATE } from './probe-hooks';

/**
 * The environment of a private run: the label of the run in progress plus a short tag, so that
 * its databases are told apart in `pg_database` (`dems_test_step_33tpl_...` beside
 * `dems_test_step_33_...`) and two rows that run the helper's tests do not look alike.
 */
export function privateRunEnv(tag: string): Record<string, string> {
  const label = providedRun().label;
  const base = label.startsWith('step_') ? label.slice('step_'.length) : label;
  return { [ENV_TEST_STEP]: `${base.slice(0, 12 - tag.length)}${tag}` };
}

/** The three standard templates from the stand-in hooks, and the helper's private template. */
export function probeResolver(extra: readonly TemplateDefinition[] = []): DefinitionResolver {
  return injectedResolver([...standardDefinitions(PROBE_HOOKS), SELFTEST_TEMPLATE, ...extra]);
}

/** Starts a private run. The caller ends it with `teardown()`. */
export function startPrivateRun(tag: string, options: StartOptions = {}): Promise<TestRun> {
  return TestRun.start({ env: privateRunEnv(tag), resolveDefinition: probeResolver(), ...options });
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

/** The median of a list of numbers. */
export function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  const upper = sorted[middle] ?? Number.NaN;
  const lower = sorted[middle - 1] ?? upper;
  return sorted.length % 2 === 1 ? upper : (lower + upper) / 2;
}
