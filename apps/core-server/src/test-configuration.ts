/**
 * The mark of a TEST CONFIGURATION (checkpoint findings CPB1-5 and CPS1-2; fix round B2b).
 *
 * `app.seams.replace` and `app.stages.replace` exist for tests: a test puts a stand-in behind a
 * seam, or takes a request stage out of the pipeline. In a running server a replaced stage 6 is
 * a server without its access rule, so the app factory lets `replace` work only on an app that
 * was built from a configuration this file marked, and throws on every other app.
 *
 *   testConfiguration(config)     TESTS ONLY. Marks `config` and returns it. Called by the
 *                                 neutral test support for every configuration it hands out
 *                                 (`test/support/config.ts`), and by nothing in `src/`.
 *   isTestConfiguration(config)   read by `buildApp`, once, when it starts.
 *
 * A file of its own, with no import but a type: the test support marks a configuration without
 * loading the app factory and every unit behind it.
 *
 * WHY THIS HOLDS IN PRODUCTION. The entry point builds its configuration with `loadConfig` and
 * hands it to `buildApp` in the next statement; nothing marks it. `buildApp` decides before any
 * unit is registered, so a unit cannot make its own app replaceable, and the configuration
 * object is frozen, so the mark is not a member somebody could set. The static test
 * `test/static/slot-replacement.test.ts` refuses a production source that names
 * `testConfiguration`, and a second caller of `buildApp`.
 */
import type { CoreServerConfig } from './config';

const TEST_CONFIGURATIONS = new WeakSet<CoreServerConfig>();

/** TESTS ONLY: marks `config` as the configuration of a test app and returns it. */
export function testConfiguration(config: CoreServerConfig): CoreServerConfig {
  TEST_CONFIGURATIONS.add(config);
  return config;
}

/** Whether `config` was marked by `testConfiguration`. */
export function isTestConfiguration(config: CoreServerConfig): boolean {
  return TEST_CONFIGURATIONS.has(config);
}
