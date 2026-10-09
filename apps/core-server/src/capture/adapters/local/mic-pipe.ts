/**
 * The named pipe of a local microphone (blueprint row 135; capture spec §A.7.1 ML-2, §G.1 G-R6;
 * decisions D86 SEC35-43; check `M4-SEC-HELPER-1`, pipe-path half).
 *
 * The pipe lives at `<runDir>/<sessionId>/<MIC-NN>.pcm` (`micPipePath`), under the git-ignored data
 * directory, mode 0600, and is removed when the handle closes. It is created by `/usr/bin/mkfifo`
 * through the process door of this folder; Node has no call that creates one.
 *
 * WHAT IS REFUSED, each with `OPEN_FAILED` / `TARGET_REFUSED` and nothing started:
 *   - an id that is not of its pattern (the path is never built: `micPipePath` refuses it);
 *   - a path that the helper's argument table would not accept (a double slash, a shell mark, a user-info `@`);
 *   - a run directory or a session directory that is not a real directory owned by the server's
 *     user and closed to writing by group and others - a link is never followed to get there;
 *   - a session directory whose resolved path is not exactly `<resolved run directory>/<sessionId>`;
 *   - a path that already holds anything but a pipe owned by the server's user: a regular file, a
 *     link, a directory, a socket, another user's pipe. A leftover pipe of a crashed run IS removed;
 *   - a pipe that `mkfifo` did not make exclusively (it refuses an existing path), or that does not
 *     read back as a pipe, owned by the server's user, with mode 0600.
 * Nothing in the product ever writes through an existing regular file: the only writer of the pipe
 * is the helper, and the worker refuses a path that is not a pipe (`MIC_INPUT_NOT_FIFO`).
 */
import { micPipePath } from '../mic-transport';
import type { CaptureTimers } from '../../types';
import { LocalSourceError, LocalSourceErrorCode, LocalSourceErrorReason } from './errors';
import { helperProgramRefusal } from './helper-program';
import { isMicPipeArgument } from './mic-helper-args';
import type { PipeEntryFacts, PipeFiles } from './pipe-files';
import type { HelperDoor, HelperExit, ProgramInspector } from './process-door';

/** The program that creates the pipe: a system program, an absolute path, nothing looked up. */
export const MKFIFO_PROGRAM = '/usr/bin/mkfifo';
/** `mkfifo` returns at once; a bound is kept so that nothing waits for it for ever. */
export const MKFIFO_BOUND_MS = 5_000;

const GROUP_OR_OTHER_WRITE = 0o022;
const DIRECTORY_MODE = 0o700;
const PIPE_MODE_ARGUMENT = '600';

export interface BoundedRun {
  readonly exit: HelperExit;
  readonly timedOut: boolean;
  readonly aborted: boolean;
}

/** Runs a short program to its end, killing it when it outlives `boundMs` or when the caller gives up. */
export async function runBounded(door: HelperDoor, timers: CaptureTimers, command: string, args: readonly string[], boundMs: number, signal?: AbortSignal): Promise<BoundedRun> {
  const running = door({ command, args, env: {} });
  let timedOut = false;
  let aborted = false;
  const cancel = timers.after(boundMs, () => {
    timedOut = true;
    running.kill('SIGKILL');
  });
  const onAbort = (): void => {
    aborted = true;
    running.kill('SIGKILL');
  };
  signal?.addEventListener('abort', onAbort, { once: true });
  const exit = await running.ended;
  cancel();
  signal?.removeEventListener('abort', onAbort);
  return { exit, timedOut, aborted };
}

export interface PreparePipeOptions {
  readonly runDir: string;
  readonly sessionId: string;
  readonly deviceId: string;
  readonly files: PipeFiles;
  readonly door: HelperDoor;
  readonly timers: CaptureTimers;
  readonly inspector: ProgramInspector;
  /** Default `/usr/bin/mkfifo`. */
  readonly mkfifoProgram?: string;
}

const refusal = (reason: LocalSourceErrorReason, deviceId: string): LocalSourceError => new LocalSourceError(LocalSourceErrorCode.OPEN_FAILED, reason, deviceId);

function ownedByServer(files: PipeFiles, facts: PipeEntryFacts): boolean {
  return files.serverUid >= 0 && facts.ownerUid === files.serverUid;
}

/** A directory the product may put a pipe in: a real directory (not a link), the server's own, closed to writing by group and others. */
function trustedDirectory(files: PipeFiles, facts: PipeEntryFacts): boolean {
  return facts.kind === 'directory' && ownedByServer(files, facts) && (facts.mode & GROUP_OR_OTHER_WRITE) === 0;
}

function parentOf(path: string): string {
  return path.slice(0, path.lastIndexOf('/'));
}

/**
 * Creates the pipe and returns its path. Throws `LocalSourceError` (`OPEN_FAILED`, reason
 * `TARGET_REFUSED` or `PROGRAM_REFUSED`) and leaves nothing behind that it created in this call but
 * possibly the session directory. Throws `CaptureAdapterError` (`LOCATOR_INVALID`) for a bad id.
 */
export async function preparePipe(options: PreparePipeOptions): Promise<string> {
  const { files, deviceId } = options;
  const path = micPipePath(options.runDir, options.sessionId, deviceId);
  const runDir = options.runDir.replace(/\/+$/, '');
  const sessionDir = parentOf(path);
  // The path will be an argument of the helper: it must be of the shape the argument table accepts, so that a run directory that could not be
  // used is refused HERE, before a directory or a pipe exists, and not when the helper is started.
  if (!isMicPipeArgument(path)) throw refusal(LocalSourceErrorReason.TARGET_REFUSED, deviceId);

  const mkfifo = options.mkfifoProgram ?? MKFIFO_PROGRAM;
  if (helperProgramRefusal(options.inspector(mkfifo)) !== null) throw refusal(LocalSourceErrorReason.PROGRAM_REFUSED, deviceId);

  // An existing run directory is vouched for BEFORE anything is made below it (a link would send the new directory elsewhere).
  const existingRun = files.inspect(runDir);
  if (existingRun.kind !== 'absent' && !trustedDirectory(files, existingRun)) throw refusal(LocalSourceErrorReason.TARGET_REFUSED, deviceId);
  try {
    files.makeDirectory(sessionDir, DIRECTORY_MODE);
  } catch {
    throw refusal(LocalSourceErrorReason.TARGET_REFUSED, deviceId);
  }
  // Both directories are the server's own and closed to writing by others, and neither is a link.
  if (!trustedDirectory(files, files.inspect(runDir)) || !trustedDirectory(files, files.inspect(sessionDir))) throw refusal(LocalSourceErrorReason.TARGET_REFUSED, deviceId);
  // The session directory is where it says it is: one level below the run directory, once every link is resolved.
  const realRun = files.realpath(runDir);
  const realSession = files.realpath(sessionDir);
  if (realRun === null || realSession === null || realSession !== `${realRun}/${options.sessionId}`) throw refusal(LocalSourceErrorReason.TARGET_REFUSED, deviceId);

  // A leftover pipe of a crashed run is removed; anything else at the path stops the open.
  const found = files.inspect(path);
  if (found.kind !== 'absent') {
    if (found.kind !== 'fifo' || !ownedByServer(files, found)) throw refusal(LocalSourceErrorReason.TARGET_REFUSED, deviceId);
    try {
      files.remove(path);
    } catch {
      throw refusal(LocalSourceErrorReason.TARGET_REFUSED, deviceId);
    }
  }

  // `mkfifo` refuses a path that exists, so the creation is exclusive.
  const run = await runBounded(options.door, options.timers, mkfifo, ['-m', PIPE_MODE_ARGUMENT, path], MKFIFO_BOUND_MS);
  if (run.timedOut || run.exit.spawnFailed || run.exit.exitCode !== 0) throw refusal(LocalSourceErrorReason.TARGET_REFUSED, deviceId);

  const made = files.inspect(path);
  if (made.kind !== 'fifo' || !ownedByServer(files, made) || (made.mode & 0o777) !== 0o600) {
    removePipe(files, path);
    throw refusal(LocalSourceErrorReason.TARGET_REFUSED, deviceId);
  }
  return path;
}

/** Removes the pipe, and only a pipe owned by the server's user. Never throws; true when nothing is left at the path. */
export function removePipe(files: PipeFiles, path: string): boolean {
  const found = files.inspect(path);
  if (found.kind === 'absent') return true;
  if (found.kind !== 'fifo' || !ownedByServer(files, found)) return false;
  try {
    files.remove(path);
    return true;
  } catch {
    return false;
  }
}
