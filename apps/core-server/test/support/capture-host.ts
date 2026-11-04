/**
 * Test support (not a test file, imports no Vitest): THE EXPLICIT TEST HOST of a `REAL_PRODUCTION`
 * boot (task 4 row 85; decision C46; code review finding F-07).
 *
 * Since row 85 a production start ALWAYS runs the host checks and the checks of the delivered
 * programs (steps 4d and 4e of `src/capture/boot/checks.ts`): a Core that was handed no host facts
 * is refused. Nothing in `src/` gives a host that passes, so a test that boots `REAL_PRODUCTION`
 * says what it assumes, in two places it can see:
 *
 *   1. THE HOST FACTS - `provideTestCaptureHost(app)` after `app.ready()` and before the boot steps
 *      (the same door the entry point uses), or `TEST_CAPTURE_HOST` as the seam `host` of a bare
 *      mount. The facts are those of a PREPARED host that is not Linux: core-file limit 0, no
 *      diagnostic switch, no option variable, and a runner that STARTS NOTHING - it answers the one
 *      question asked off Linux (the relay's library statement) with the relay's own "past the
 *      statement" exit code and every other question with "not started".
 *   2. THE TWO DELIVERED PROGRAMS - `testHostPrograms(directory)` spread into the configuration: a
 *      relay and a guard stand-in, written into the suite's own private data directory with mode
 *      0700, so that the path rule of the boot (the worker's rule) passes by real means. They are
 *      never started by the boot: the runner above answers for the relay.
 *
 * WHAT THIS DOUBLE DOES NOT STAND FOR: a relay that relays, a guard that guards, or a Linux host.
 * A test of the relay path configures the built relay itself.
 */
import { chmodSync, writeFileSync } from 'node:fs';
import type { FastifyInstance } from 'fastify';
import { captureBootControl, type CaptureBootHostFacts } from '../../src/capture/boot';

/** The relay's exit code when it is started with no start message and is past its library statement (`relay.h`; row 81, DD-1). */
const RELAY_PAST_LIBRARY_STATEMENT = 10;

/**
 * The platform word of the test host: `darwin` - the ONE platform a production Core is allowed on where no question
 * of the Linux host profile is asked (row P1, decision U21 (2); check 4d-2 of `checks.ts` refuses every word but
 * `linux` and `darwin`, so the invented word `test-host` of before this row would be refused). A FIXED word, not the
 * platform of the machine the suite runs on: on a Linux machine the suite still boots the Mac case, and this runner
 * still starts nothing.
 */
export const TEST_HOST_PLATFORM = 'darwin';

/** The facts of a prepared test host. It starts no process. */
export const TEST_CAPTURE_HOST: CaptureBootHostFacts = Object.freeze({
  platform: TEST_HOST_PLATFORM,
  coreFileLimit: (): number | null => 0,
  startArguments: Object.freeze([]),
  nodeOptionsSet: false,
  run: async (command: { readonly args: readonly string[] }) =>
    command.args.length === 0 ? ({ outcome: 'RAN', exitCode: RELAY_PAST_LIBRARY_STATEMENT, output: '' } as const) : ({ outcome: 'NOT_STARTED' } as const),
});

/** The file names of the two microphone-listing stand-ins (bench-port seam, 2026-11-04): a test
 * host that fakes `darwin` on a Linux machine has none of the system programs of row N13 on disk,
 * so the fixture hands in two stand-ins of its own — same rule, nothing started. */
export const TEST_LISTING_NAMES = Object.freeze(['test-listing-usb', 'test-listing-audio']);

/** Writes the two microphone-listing stand-ins (row N13's pair) into an existing private directory
 * of the suite and returns their paths — the bench-port seam of 2026-11-04: a test host that fakes
 * `darwin` on a Linux machine has none of the system programs on disk; same rule, nothing started. */
export function testListingStandIns(directory: string): readonly string[] {
  return TEST_LISTING_NAMES.map((name) => {
    const path = `${directory}/${name}`;
    writeFileSync(path, `#!/bin/sh\nexit 0\n`, { mode: 0o700 });
    chmodSync(path, 0o700);
    return path;
  });
}

/** Hands the test host to the boot checks of `app`: after `app.ready()`, before `app.readiness.boot()`. */
export function provideTestCaptureHost(app: FastifyInstance): void {
  captureBootControl(app).provideHost({ ...TEST_CAPTURE_HOST, systemListingPrograms: testListingStandIns(app.config.dataDir) });
}

/** The file names of the two stand-ins inside a suite's data directory. */
export const TEST_RELAY_NAME = 'test-host-relay';
export const TEST_GUARD_NAME = 'test-host-guard';

/**
 * Writes the two stand-in programs into `directory` (an existing private directory of the suite,
 * removed by the suite) and returns the two configuration members. Each is a script that ends at
 * once with the relay's "past the statement" code; the boot inspects them and starts neither.
 */
export function testHostPrograms(directory: string): { readonly captureRelayPath: string; readonly captureGuardPath: string } {
  const write = (name: string): string => {
    const path = `${directory}/${name}`;
    writeFileSync(path, `#!/bin/sh\nexit ${RELAY_PAST_LIBRARY_STATEMENT}\n`, { mode: 0o700 });
    chmodSync(path, 0o700);
    return path;
  };
  return Object.freeze({ captureRelayPath: write(TEST_RELAY_NAME), captureGuardPath: write(TEST_GUARD_NAME) });
}
