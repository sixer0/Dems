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
import { accessSync, constants, statSync } from 'node:fs';
import { isAbsolute } from 'node:path';

/** The longest one generated camera file may take (it is a few seconds of 720p). */
export const DEMO_HELPER_TIMEOUT_MS = 120_000;

export const SeedHelperProblem = {
  /** No helper program is configured (`DEMS_CAPTURE_HELPER_FFMPEG` is not set). */
  NOT_SET: 'HELPER_NOT_SET',
  NOT_ABSOLUTE: 'HELPER_NOT_ABSOLUTE',
  /** The configured path names nothing: the helper copy is absent. */
  ABSENT: 'HELPER_ABSENT',
  NOT_A_FILE: 'HELPER_NOT_A_FILE',
  NOT_EXECUTABLE: 'HELPER_NOT_EXECUTABLE',
} as const;
export type SeedHelperProblem = (typeof SeedHelperProblem)[keyof typeof SeedHelperProblem];

/** Why the configured helper program cannot be started, or null. Reads what the path IS; opens no file. */
export function seedHelperProblemOf(program: string | null): SeedHelperProblem | null {
  if (program === null || program === '') return SeedHelperProblem.NOT_SET;
  if (!isAbsolute(program)) return SeedHelperProblem.NOT_ABSOLUTE;
  let regular: boolean;
  try {
    regular = statSync(program).isFile();
  } catch {
    return SeedHelperProblem.ABSENT;
  }
  if (!regular) return SeedHelperProblem.NOT_A_FILE;
  try {
    accessSync(program, constants.X_OK);
  } catch {
    return SeedHelperProblem.NOT_EXECUTABLE;
  }
  return null;
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
    const killAtExit = (): void => void started.kill('SIGKILL');
    process.once('exit', killAtExit);
    const timer = setTimeout(() => {
      timedOut = true;
      started.kill('SIGKILL');
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
