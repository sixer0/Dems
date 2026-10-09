/**
 * The process door of the local-device helpers (blueprint row 134; capture spec §A.6.4 HL-2, HL-4,
 * HL-7, §G.1 G-R12; SEC35-25, SEC35-43; decision D95).
 *
 * THIS IS THE ONE FILE UNDER `adapters/local/` THAT STARTS A PROCESS OR READS THE FILE SYSTEM.
 * The worker's door (`src/capture/ipc.ts`) is closed code of rows 57 and 58; decision D95 gives
 * the helpers a second, pinned door of their own instead of a variant inside it. It follows the
 * first door rule for rule:
 *   - no shell: the program is executed directly, with an argument list;
 *   - the program is an absolute path; nothing is looked up on a search path;
 *   - the child's environment is the one the caller hands over, EMPTY by default, and never the
 *     server's own;
 *   - standard input is closed for the child; standard output and standard error are read by code
 *     into bounded buffers (64 KiB each) and are never logged, never written to a file;
 *   - when the server process exits, every live child of this door is killed in the exit handler.
 *
 * It knows nothing about cameras: which program, which arguments and what an exit means are the
 * caller's (`camera-helper-args.ts`, `camera-helper.ts`). What it reads of the file system is the
 * ownership and the mode bits on the way to a program (`inspectProgram`): facts only, the rule is
 * `helper-program.ts`.
 */
import { spawn } from 'node:child_process';
import { lstatSync, realpathSync, statSync } from 'node:fs';
import { dirname, isAbsolute } from 'node:path';

/** How much of each output stream is kept (HL-7). What comes after is counted, not kept. */
export const HELPER_OUTPUT_CAP_BYTES = 64 * 1024;

export interface HelperProcessOptions {
  /** The program: an absolute path. */
  readonly command: string;
  /** Its whole argument list. */
  readonly args: readonly string[];
  /** The child's whole environment. Default: empty. */
  readonly env?: Readonly<Record<string, string>>;
  /**
   * Told every chunk of standard output as it arrives, beside the bounded copy (pass C2: the progress
   * report a helper is watched by, `createDeliveryWatch` of `camera-helper.ts`). The observer keeps what it needs; it must not throw.
   */
  readonly onOutput?: (chunk: Buffer) => void;
}

export interface HelperExit {
  readonly exitCode: number | null;
  readonly signal: string | null;
  /** True when the program could not be started at all. */
  readonly spawnFailed: boolean;
  /** The head of standard error, at most `HELPER_OUTPUT_CAP_BYTES`. For classification only (HL-7). */
  readonly diagnostics: string;
  /** The head of standard output, with the same bound. */
  readonly output: string;
}

export interface HelperProcess {
  readonly pid: number | null;
  /** Settles once, when the process has ended and its streams are closed. Never rejects. */
  readonly ended: Promise<HelperExit>;
  /** True until the process has ended. */
  alive(): boolean;
  kill(signal: 'SIGTERM' | 'SIGKILL'): void;
}

/** Starts a helper. Used through this type, so that a test passes a door that starts nothing. */
export type HelperDoor = (options: HelperProcessOptions) => HelperProcess;

function boundedText(): { push(chunk: Buffer): void; text(): string } {
  const kept: Buffer[] = [];
  let size = 0;
  return {
    push(chunk) {
      if (size >= HELPER_OUTPUT_CAP_BYTES) return;
      const part = chunk.subarray(0, HELPER_OUTPUT_CAP_BYTES - size);
      kept.push(part);
      size += part.length;
    },
    text: () => Buffer.concat(kept).toString('utf8'),
  };
}

export const startHelperProcess: HelperDoor = (options) => {
  const failed = (): HelperProcess => ({
    pid: null,
    ended: Promise.resolve({ exitCode: null, signal: null, spawnFailed: true, diagnostics: '', output: '' }),
    alive: () => false,
    kill: () => {},
  });
  if (!isAbsolute(options.command)) return failed();

  let child;
  try {
    child = spawn(options.command, [...options.args], {
      env: { ...options.env },
      shell: false,
      detached: false,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch {
    return failed();
  }
  const started = child;
  const diagnostics = boundedText();
  const output = boundedText();
  let over = false;
  let spawnFailed = false;
  const killAtExit = (): void => {
    started.kill('SIGKILL');
  };
  process.once('exit', killAtExit);

  // The streams are read as fast as they come and never paused: a full pipe would stop the helper.
  started.stderr?.on('data', (chunk: Buffer) => diagnostics.push(chunk));
  started.stdout?.on('data', (chunk: Buffer) => {
    output.push(chunk);
    try {
      options.onOutput?.(chunk);
    } catch {
      // An observer never stops the reading of the stream.
    }
  });
  started.stderr?.on('error', () => {});
  started.stdout?.on('error', () => {});

  const ended = new Promise<HelperExit>((resolve) => {
    const end = (exitCode: number | null, signal: string | null): void => {
      if (over) return;
      over = true;
      process.removeListener('exit', killAtExit);
      resolve({ exitCode, signal, spawnFailed, diagnostics: diagnostics.text(), output: output.text() });
    };
    started.on('error', () => {
      // No such file, no permission to execute: the process never existed.
      if (started.pid === undefined) {
        spawnFailed = true;
        end(null, null);
      }
    });
    // `close`, not `exit`: everything the helper wrote before it ended has been read.
    started.on('close', (exitCode, signal) => end(exitCode, signal));
  });

  return {
    get pid() {
      return started.pid ?? null;
    },
    ended,
    alive: () => !over,
    kill(signal) {
      if (!over) started.kill(signal);
    },
  };
};

/** One step on the way to a program: who owns it and its permission bits. No name, no content. */
export interface PathStepFacts {
  readonly ownerUid: number;
  /** The permission bits (`mode & 0o7777`). */
  readonly mode: number;
}

/** What the file system says about a program path. Facts only: the rule is `helperProgramRefusal`. */
export interface ProgramFacts {
  readonly absolute: boolean;
  readonly exists: boolean;
  readonly regularFile: boolean;
  readonly symbolicLink: boolean;
  /** The program file itself, after links are followed. */
  readonly file: PathStepFacts | null;
  /** Every directory from the root to the folder of the path as written. */
  readonly directoriesAsWritten: readonly PathStepFacts[];
  /** Every directory from the root to the folder of the file the path resolves to. */
  readonly directoriesResolved: readonly PathStepFacts[];
  /** The user the server runs as. */
  readonly serverUid: number;
}

export type ProgramInspector = (path: string) => ProgramFacts;

function directoryChain(folder: string): PathStepFacts[] {
  const steps: PathStepFacts[] = [];
  let current = folder;
  for (;;) {
    const status = statSync(current);
    steps.unshift({ ownerUid: status.uid, mode: status.mode & 0o7777 });
    const parent = dirname(current);
    if (parent === current) return steps;
    current = parent;
  }
}

export const inspectProgram: ProgramInspector = (path) => {
  const serverUid = typeof process.getuid === 'function' ? process.getuid() : -1;
  const nothing: ProgramFacts = { absolute: isAbsolute(path), exists: false, regularFile: false, symbolicLink: false, file: null, directoriesAsWritten: [], directoriesResolved: [], serverUid };
  if (!nothing.absolute) return nothing;
  try {
    const link = lstatSync(path);
    const resolved = realpathSync(path);
    const status = statSync(resolved);
    return {
      absolute: true,
      exists: true,
      regularFile: status.isFile(),
      symbolicLink: link.isSymbolicLink() || resolved !== path,
      file: { ownerUid: status.uid, mode: status.mode & 0o7777 },
      directoriesAsWritten: directoryChain(dirname(path)),
      directoriesResolved: directoryChain(dirname(resolved)),
      serverUid,
    };
  } catch {
    return nothing;
  }
};
