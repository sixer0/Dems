/**
 * THE ONE-SHOT HELPER RUN OF THE SEED COMMANDS (integration pass E3 item 6; evidence package spec
 * F.4; capture spec A.6.4). A COMMAND-LINE FILE: `db:seed` and `db:reset` run as the owner role in
 * a process of their own, never inside the server (the server's runtime starts a helper through
 * its one door, `capture/adapters/local/process-door.ts`, and through nothing else; the static
 * rule of `test/static/credentials.test.ts` holds that for every source outside `src/db/`).
 *
 * WHAT IT RUNS. The private helper program (the copy `scripts/capture/dev-setup.mjs` makes under
 * `.data/helpers/`) with EXACTLY the argument list it is handed - the generated-source table of
 * `sealing-host/demo-seed/source-arguments.ts`: a generated picture and a generated tone written
 * to one file. No device is named in that table, so none can be opened.
 *
 * HOW. One `spawn`: no shell, an EMPTY environment, no input, standard output discarded, standard
 * error read and dropped (never kept, printed or put in an error: it may hold a path). The run is
 * bounded; a helper that outlives the bound is killed. A failure is a code and an exit status.
 */
import { spawn } from 'node:child_process';
import { isAbsolute } from 'node:path';
import { HelperProgramProblem, helperProgramProblemOf, inspectHelperProgram, type HelperProgramInspector } from '../../capture/fence';

/** The longest one generated camera file may take (it is a few seconds of 720p). */
export const DEMO_HELPER_TIMEOUT_MS = 120_000;

/**
 * Why the configured helper program is not started. ONE RULE WITH THE SERVER'S BOOT (fix F-M4;
 * review row 69, question 5 / finding R69-06; SEC35-43 (a)): the codes are the capture fence's
 * `HelperProgramProblem` under the prefix `HELPER_` - not set, not executable, and every refusal of
 * the path rule (`capture/adapters/local/helper-program.ts`): not absolute, not found, not a
 * regular file, a file or a directory on the way (as written and as resolved) that is not owned by
 * root or by this user, or that its group or others may write. A path the server refuses to start
 * is a path the seed does not start.
 */
export const SeedHelperProblem = Object.freeze(
  Object.fromEntries(Object.values(HelperProgramProblem).map((problem) => [problem, `HELPER_${problem}`])) as { readonly [Problem in HelperProgramProblem]: `HELPER_${Problem}` },
);
export type SeedHelperProblem = (typeof SeedHelperProblem)[keyof typeof SeedHelperProblem];

/**
 * Why the configured helper program cannot be started, or null: the answer of the boot's own
 * function (`helperProgramProblemOf`) for the same path. Reads what the path IS; opens no file.
 */
export function seedHelperProblemOf(program: string | null, inspect: HelperProgramInspector = inspectHelperProgram): SeedHelperProblem | null {
  const problem = helperProgramProblemOf(program, inspect);
  return problem === null ? null : SeedHelperProblem[problem];
}

/** A helper run that did not end well. Carries a code and the exit facts, never output. */
export class SeedHelperError extends Error {
  readonly code: 'HELPER_NOT_STARTED' | 'HELPER_FAILED' | 'HELPER_TIMED_OUT';
  constructor(code: SeedHelperError['code'], detail: string) {
    super(`the helper program did not write its file (${code}${detail === '' ? '' : `: ${detail}`})`);
    this.name = 'SeedHelperError';
    this.code = code;
  }
}

/** Runs the helper once and resolves when it has ended with exit status 0. */
export function runSeedHelper(program: string, args: readonly string[], timeoutMs: number = DEMO_HELPER_TIMEOUT_MS): Promise<void> {
  return new Promise((resolvePromise, rejectPromise) => {
    if (!isAbsolute(program)) {
      rejectPromise(new SeedHelperError('HELPER_NOT_STARTED', 'the path is not absolute'));
      return;
    }
    let child;
    try {
      child = spawn(program, [...args], { env: {}, shell: false, detached: false, windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] });
    } catch {
      rejectPromise(new SeedHelperError('HELPER_NOT_STARTED', ''));
      return;
    }
    const started = child;
    let over = false;
    let timedOut = false;
    // The ONE place that signals the helper (task 4 rows 21 and 180, integration pass I-3). A start that failed has no
    // process ID, and a signal sent through its handle would go to process ID 0, this process's whole group: never.
    const signalChild = (): void => {
      if (!over && started.pid !== undefined) started.kill('SIGKILL');
    };
    const killAtExit = (): void => signalChild();
    process.once('exit', killAtExit);
    const timer = setTimeout(() => {
      timedOut = true;
      signalChild();
    }, timeoutMs);
    // Read and dropped: a full pipe would stop the helper, and nothing of it is kept.
    started.stderr?.on('data', () => {});
    started.stderr?.on('error', () => {});
    const end = (error: SeedHelperError | null): void => {
      if (over) return;
      over = true;
      clearTimeout(timer);
      process.removeListener('exit', killAtExit);
      if (error === null) resolvePromise();
      else rejectPromise(error);
    };
    started.on('error', () => end(new SeedHelperError('HELPER_NOT_STARTED', '')));
    started.on('close', (exitCode, signal) => {
      if (timedOut) end(new SeedHelperError('HELPER_TIMED_OUT', `${String(timeoutMs)} ms`));
      else if (exitCode === 0) end(null);
      else end(new SeedHelperError('HELPER_FAILED', exitCode === null ? `signal ${String(signal)}` : `exit status ${String(exitCode)}`));
    });
  });
}
