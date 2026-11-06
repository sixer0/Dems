/**
 * THE HOST FACTS OF THE CORE'S OWN PROCESS, as the entry point hands them to the boot checks (task 4
 * row 85; decision C46; code review finding F-07; rows 80 and 81 built the checks that ask them).
 *
 * C46: the host checks and the program checks of a `REAL_PRODUCTION` start (steps 4d and 4e of
 * `checks.ts`) are FAIL-CLOSED at the real entry point. The entry point (`src/index.ts`) knows its
 * own process - it is the one file that reads the environment - and states four plain facts of it;
 * this file makes of them what the mount takes (`CaptureBootHostFacts`) and adds the runner of the
 * host's questions. Nothing here reads the process, the environment or a file: every fact is a
 * parameter (static rules G-R2 and row 80's block).
 *
 * THE ONE CALLER OF `hostCommandRunnerOver` IN THE PRODUCT is here. The door behind the runner is
 * the local helper door (`startHelperProcess`): the questions carry no secret and need no start
 * message, and a child is started with an EMPTY environment (the door's default), as the process
 * listing of the fence uses it. Row 80 left that choice to the composition (its driver decision 7).
 *
 * THE CORE-FILE LIMIT. The runtime has no call that reads a resource limit. It states its limits in
 * the `userLimits` member of its in-memory report (`process.report.getReport()`: an object, no file
 * is written and no switch is set). The entry point hands that member in as a function, asked once,
 * in `REAL_PRODUCTION` only; `coreFileLimitOf` reads ONE value of it - the soft limit of the core
 * file size - and answers null for anything it does not understand, which the check refuses
 * (`LIMIT_UNREADABLE`): a limit that cannot be read is never "in place".
 *
 * NOT PROVEN WITHOUT THE HOST: that the runtime of the installed Core states that member in this
 * form on Ubuntu 24.04 (hardware check `9A/H-04`), and everything rows 80 and 81 list.
 */
import { startHelperProcess } from '../adapters/local';
import type { CaptureTimers } from '../types';
import { hostCommandRunnerOver, type CaptureHostDeps } from './host-checks';

/** What the entry point states of its own process. Plain values: this file reads none of them itself. */
export interface OwnProcessFacts {
  /** `process.platform`. */
  readonly platform: string;
  /** `process.execArgv`: the runtime's own start arguments. Judged by the check, never repeated. */
  readonly startArguments: readonly string[];
  /** True when the runtime's option variable is set in the environment, whatever it holds. */
  readonly nodeOptionsSet: boolean;
  /** The `userLimits` member of the runtime's in-memory report, read when asked. Anything else, or a throw: not readable. */
  userLimits(): unknown;
}

/** The host facts without the two program paths: those are the configuration's, and the mount adds them. */
export type OwnHostFacts = Omit<CaptureHostDeps, 'relayProgram' | 'guardProgram'>;

/**
 * The soft limit of the core file size out of the runtime's `userLimits`: 0, a number above it,
 * `Infinity` for "unlimited", or null when the member is not there or is of another form.
 */
export function coreFileLimitOf(userLimits: unknown): number | null {
  if (typeof userLimits !== 'object' || userLimits === null) return null;
  const entry = (userLimits as Record<string, unknown>)['core_file_size_blocks'];
  if (typeof entry !== 'object' || entry === null) return null;
  const soft = (entry as Record<string, unknown>)['soft'];
  if (soft === 'unlimited') return Number.POSITIVE_INFINITY;
  return typeof soft === 'number' && Number.isFinite(soft) && soft >= 0 ? soft : null;
}

/**
 * THE RUNNER OF THE HOST'S QUESTIONS over the local helper door: the ONE call of `hostCommandRunnerOver` in the product.
 * Made for the host facts below, and - task 4 row 106c, decision C82, named amendment SR-11 - once more by the entry
 * point, which hands it to the composition for the single purpose of reading the address helper's interface file by a
 * fixed row. The door never leaves the capture unit: a caller gets a runner, not the means to start a program of its own.
 */
export function captureHostRunnerOf(timers: CaptureTimers): OwnHostFacts['run'] {
  return hostCommandRunnerOver(startHelperProcess, timers);
}

/** The host facts of this process, with the runner of the host's questions over the local helper door. */
export function captureHostOfProcess(own: OwnProcessFacts, timers: CaptureTimers): OwnHostFacts {
  const startArguments = Object.freeze([...own.startArguments]);
  return Object.freeze({
    platform: own.platform,
    startArguments,
    nodeOptionsSet: own.nodeOptionsSet,
    coreFileLimit(): number | null {
      try {
        return coreFileLimitOf(own.userLimits());
      } catch {
        // A report that cannot be made is a limit that cannot be read.
        return null;
      }
    },
    run: captureHostRunnerOf(timers),
  });
}
