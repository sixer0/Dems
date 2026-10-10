/**
 * The capture worker as a child process (blueprint row 57 / M3-W1; register NM-03; capture spec
 * §B.2; static rule G-R2, SEC35-25).
 *
 * THIS IS THE ONE FILE OF THE SERVER RUNTIME THAT STARTS A PROCESS. The static guard of this
 * folder pins it: no other file under `src/capture/` imports the process module or the file
 * system, and `test/static/credentials.test.ts` exempts this path alone from "the server runtime
 * starts no child process".
 *
 * WHAT A WORKER IS GIVEN, AND WHAT IT IS NOT.
 *   - the command and its arguments are fixed when the launcher is created (from the
 *     configuration of the capture rows); nothing of a request, a session or a plan becomes an
 *     argument, so no secret and no device address can show in a process listing;
 *   - no shell: the command is executed directly;
 *   - its environment is the one the launcher was created with, EMPTY by default. It is never the
 *     server's own environment: the database password and every other variable of the Core stay
 *     in the Core;
 *   - everything else reaches it as frames on its standard input (`@dems/capture-protocol`).
 *
 * THE CHANNEL. Commands are written to the worker's standard input, one frame per line; a write
 * that the pipe did not take at once resolves when the pipe drained. The worker's standard output
 * is cut into lines with a bound (`createLineSplitter`) and each line is validated before the
 * supervisor sees it. The output is read as fast as it comes and is never paused: a paused pipe
 * would hide the heartbeats. Standard error is not read: it is closed for the worker unless
 * `inheritDiagnostics` hands it the server's own, for a developer.
 *
 * NO ORPHAN. When the server process exits, by a normal end or by `process.exit`, every live
 * worker is killed in the exit handler. A server that is killed outright runs no handler: then the
 * worker's standard input ends, and a worker that keeps the protocol exits on that.
 */
import { spawn, type ChildProcess } from 'node:child_process';
import { CAPTURE_IPC_DEFAULTS, FrameViolation, createLineSplitter, decodeWorkerLine, encodeFrame } from '@dems/capture-protocol';
import { WorkerDownCode, WorkerLaunchError, type WorkerChannel, type WorkerLauncher } from './types';

export interface ProcessLauncherOptions {
  /** The worker program: an absolute path. */
  readonly command: string;
  /** Its fixed arguments. Never a secret, never anything of a session. */
  readonly args?: readonly string[];
  readonly cwd?: string;
  /** The worker's whole environment. Default: empty. */
  readonly env?: Readonly<Record<string, string>>;
  /** Longest line of a frame. Default: the protocol's. */
  readonly maxFrameChars?: number;
  /** Hand the worker the server's standard error. Default: false (the worker's is closed). */
  readonly inheritDiagnostics?: boolean;
}

/** A launcher that starts `command` once per call: one worker process per session attempt. */
export function createProcessLauncher(options: ProcessLauncherOptions): WorkerLauncher {
  const maxFrameChars = options.maxFrameChars ?? CAPTURE_IPC_DEFAULTS.maxFrameChars;

  return (_launch, handlers) => {
    let child: ChildProcess;
    try {
      child = spawn(options.command, [...(options.args ?? [])], {
        cwd: options.cwd,
        env: { ...options.env },
        shell: false,
        detached: false,
        windowsHide: true,
        stdio: ['pipe', 'pipe', options.inheritDiagnostics === true ? 'inherit' : 'ignore'],
      });
    } catch {
      throw new WorkerLaunchError(WorkerDownCode.SPAWN_FAILED, 'the capture worker process could not be started', true);
    }
    const { stdin, stdout } = child;
    if (stdin === null || stdout === null) {
      child.kill('SIGKILL');
      throw new WorkerLaunchError(WorkerDownCode.SPAWN_FAILED, 'the capture worker process has no standard streams', true);
    }

    let ended = false;
    let spawnFailed = false;
    const killAtExit = (): void => {
      child.kill('SIGKILL');
    };
    process.once('exit', killAtExit);

    const end = (exitCode: number | null, signal: string | null): void => {
      if (ended) return;
      ended = true;
      process.removeListener('exit', killAtExit);
      handlers.exit({ exitCode, signal, spawnFailed });
    };

    const splitter = createLineSplitter(maxFrameChars);
    stdout.setEncoding('utf8');
    stdout.on('data', (chunk: string) => {
      for (const line of splitter.push(chunk)) {
        if (ended) return;
        if (line === null) {
          handlers.violation(FrameViolation.TOO_LONG);
          continue;
        }
        const frame = decodeWorkerLine(line, maxFrameChars);
        if (frame.ok) handlers.message(frame.message);
        else handlers.violation(frame.violation);
      }
    });
    // A pipe that broke is reported by the exit that follows it; without a listener the error
    // event of a stream would end the server.
    stdin.on('error', () => {});
    stdout.on('error', () => {});
    child.on('error', () => {
      // Emitted when the process could not be started (no such file, no permission) or could not
      // be signalled. Only the first case ends the channel here.
      if (child.pid === undefined) {
        spawnFailed = true;
        end(null, null);
      }
    });
    // `close`, not `exit`: every line the worker wrote before it ended has been handed on.
    child.on('close', (exitCode, signal) => end(exitCode, signal));

    const channel: WorkerChannel = {
      get pid() {
        return child.pid ?? null;
      },
      send(message) {
        return new Promise<void>((resolve, reject) => {
          if (ended || !stdin.writable) {
            reject(new Error('the input of the capture worker is closed'));
            return;
          }
          const taken = stdin.write(encodeFrame(message), (error) => {
            if (error != null) reject(error);
          });
          if (taken) resolve();
          else stdin.once('drain', resolve);
        });
      },
      closeInput() {
        if (!stdin.writableEnded) stdin.end();
      },
      kill(signal) {
        if (!ended) child.kill(signal);
      },
    };
    return channel;
  };
}

/**
 * The launcher of a server that has no worker command: capture mode `simulated` (the default), or
 * mode `real` without `config.captureWorkerPath` (`index.ts` chooses; brought up to date by fix
 * pass F-M3, review R63-17). A session start then fails at once and cleanly with `CAPTURE_FAULT`,
 * and is not retried.
 */
export const unconfiguredLauncher: WorkerLauncher = () => {
  throw new WorkerLaunchError(WorkerDownCode.NOT_CONFIGURED, 'no capture worker is configured', false);
};
