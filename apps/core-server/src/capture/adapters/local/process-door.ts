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
import { closeSync, fstatSync, lstatSync, openSync, readSync, realpathSync, statSync } from 'node:fs';
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
  /**
   * The ONE place that signals the child. A start that failed has no process ID, and a signal sent
   * through its handle would go to process ID 0, which is the server's whole process group: never.
   */
  const signalChild = (signal: 'SIGTERM' | 'SIGKILL'): void => {
    if (!over && started.pid !== undefined) started.kill(signal);
  };
  const killAtExit = (): void => signalChild('SIGKILL');
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
    kill: signalChild,
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

/**
 * THE FIRST BYTES OF A FILE (wave H closing pass Z1; driver E decision 5, ruling D201 (5)): what the
 * fence needs to hold the speech fixture to its format before a helper is given the path. Read
 * here because this file is the one file-system door of the local helpers (static rule G-R2).
 *
 * At most `bytes` bytes (bounded by `FILE_HEAD_MAX_BYTES`) from offset 0 of a REGULAR file at an
 * absolute path; fewer when the file is shorter. `null` when the path is not absolute, is no regular
 * file, or cannot be opened or read - never a throw, and nothing of the content is logged. The
 * caller applies the path rule (`helperProgramRefusal`) FIRST: this function reads whatever it is
 * pointed at.
 */
export type FileHeadReader = (path: string, bytes: number) => Uint8Array | null;

export const FILE_HEAD_MAX_BYTES = 65_536;

export const readFileHead: FileHeadReader = (path, bytes) => {
  if (!isAbsolute(path) || !Number.isSafeInteger(bytes) || bytes < 0) return null;
  const wanted = Math.min(bytes, FILE_HEAD_MAX_BYTES);
  let descriptor: number | null = null;
  try {
    descriptor = openSync(path, 'r');
    if (!fstatSync(descriptor).isFile()) return null;
    const buffer = new Uint8Array(wanted);
    let filled = 0;
    while (filled < wanted) {
      const read = readSync(descriptor, buffer, filled, wanted - filled, filled);
      if (read === 0) break;
      filled += read;
    }
    return buffer.subarray(0, filled);
  } catch {
    return null;
  } finally {
    if (descriptor !== null) {
      try {
        closeSync(descriptor);
      } catch {
        // Nothing to do for a descriptor that would not close: the read already has its answer.
      }
    }
  }
};

/**
 * THE WHOLE OF A FILE, BOUNDED (audit 2026-11-05 row 88, C-P0-1b, DF-02): what the boot needs to compare the worker
 * program in place with the hash its build stamp names (`boot/worker-stamp.ts`). Read here because this file is the
 * one file-system door of the local helpers (static rule G-R2): the boot folder imports no file system of its own.
 *
 * Every byte of a REGULAR file at an absolute path, when the file holds at most `maxBytes` bytes (bounded by
 * `FILE_WHOLE_MAX_BYTES`). `null` when the path is not absolute, is no regular file, is larger than the bound, changed
 * its size while it was read, or cannot be opened or read - never a throw, and nothing of the content is logged. The
 * caller applies the path rule (`helperProgramRefusal`) FIRST: this function reads whatever it is pointed at.
 */
export type WholeFileReader = (path: string, maxBytes: number) => Uint8Array | null;

/** 64 MiB: the worker program is about 0.35 MiB (2026-11-05); the bound keeps a wrong path from filling the memory. */
export const FILE_WHOLE_MAX_BYTES = 64 * 1024 * 1024;

export const readWholeFile: WholeFileReader = (path, maxBytes) => {
  if (!isAbsolute(path) || !Number.isSafeInteger(maxBytes) || maxBytes < 0) return null;
  const bound = Math.min(maxBytes, FILE_WHOLE_MAX_BYTES);
  let descriptor: number | null = null;
  try {
    descriptor = openSync(path, 'r');
    const status = fstatSync(descriptor);
    if (!status.isFile() || status.size > bound) return null;
    // One byte more than the size: a file that grew while it was read is seen, not cut.
    const buffer = new Uint8Array(status.size + 1);
    let filled = 0;
    while (filled < buffer.length) {
      const read = readSync(descriptor, buffer, filled, buffer.length - filled, filled);
      if (read === 0) break;
      filled += read;
    }
    return filled === status.size ? buffer.subarray(0, filled) : null;
  } catch {
    return null;
  } finally {
    if (descriptor !== null) {
      try {
        closeSync(descriptor);
      } catch {
        // Nothing to do for a descriptor that would not close: the read already has its answer.
      }
    }
  }
};
