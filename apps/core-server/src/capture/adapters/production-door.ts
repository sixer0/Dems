/**
 * The process door of the PRODUCTION programs (task 4 blueprint row 21, work package WP-02; design
 * addendum 2.3 step 4; decision text SR-1; security S13-02 (b) (d), AD-03 point 6, AD-09 point 3,
 * BR-07 (4); review verdict on WP-02: a second pinned door, standard input kept open).
 *
 * THIS IS THE ONE FILE THAT STARTS A PRODUCTION PROGRAM: the relay of a camera, the guard, the
 * audio helper on Linux. The door of the local-device helpers (`local/process-door.ts`) closes the
 * child's standard input and is development code; it is not edited and not reused. This door
 * follows its rules and adds what a program that takes a secret needs:
 *   - no shell: the program is executed directly, by an absolute path, with an argument list;
 *   - the child's environment is built HERE from a closed list of keys
 *     (`PRODUCTION_ENVIRONMENT_KEYS`); a key outside it is a refusal, and nothing of the server's
 *     own environment is handed over;
 *   - the START MESSAGE goes to the child's standard input and nowhere else. This door makes its
 *     bytes with the one serialiser (`startMessageBytes` of `credential.ts`), writes them, and
 *     zero-fills them when the write has completed, failed or run into its bound. It makes no text
 *     of them, puts none of them in an argument, the environment, an error or a log line;
 *   - the write is BOUNDED: a child that does not take the message within `writeBoundMs` is killed;
 *   - standard input STAYS OPEN after the message. Its end is the child's order to stop
 *     (`endInput`), and it ends by itself when the server process ends: the same liveness rule on
 *     macOS and Linux;
 *   - a child is started only when the server's own core-file limit is 0, because a child
 *     inherits it (AD-09): a dump of a process that holds a credential is never written;
 *   - standard output and standard error are read into bounded buffers (64 KiB each), are never
 *     logged, and what is handed on has the user part of every locator blanked (S13-02 (b));
 *   - a refusal is a code (`ProductionDoorRefusal`) with a fixed sentence: no part of the message,
 *     of the argument list or of the system's error text is in it;
 *   - every child is waited for (`ended` settles when it has ended and its streams are closed), a
 *     child of a refused start is killed, and every live child is killed when the server exits.
 *
 * It knows nothing about cameras or sound cards: which program, which arguments, what a line of
 * output or an exit means, and the bound within which a stopped child must have ended are the
 * caller's.
 */
import { spawn } from 'node:child_process';
import { isAbsolute } from 'node:path';
import type { CaptureTimers } from '../types';
import { blankCredentialLocators, startMessageBytes, type StartMessage } from './credential';

/** How much of each output stream is kept. What comes after is read and dropped. */
export const PRODUCTION_OUTPUT_CAP_BYTES = 64 * 1024;

/** How long the child has to take the start message before it is killed. */
export const START_MESSAGE_WRITE_BOUND_MS = 5_000;

/**
 * The keys a production program may be started with. A closed list: another key is a decision.
 * `ALSA_CONFIG_PATH` names the sound configuration the Core writes under its run directory for
 * the audio helper. Its value is an absolute path; it is never a secret.
 */
export const PRODUCTION_ENVIRONMENT_KEYS = Object.freeze(['ALSA_CONFIG_PATH'] as const);
export type ProductionEnvironmentKey = (typeof PRODUCTION_ENVIRONMENT_KEYS)[number];
export type ProductionEnvironment = Readonly<Partial<Record<ProductionEnvironmentKey, string>>>;

export const ProductionDoorRefusal = {
  /** The program is not an absolute path: nothing is looked up on a search path. */
  PROGRAM_NOT_ABSOLUTE: 'PRODUCTION_PROGRAM_NOT_ABSOLUTE',
  /** A key outside the closed list, or a value that is not an absolute path. */
  ENVIRONMENT_NOT_ALLOWED: 'PRODUCTION_ENVIRONMENT_NOT_ALLOWED',
  /** The server's own core-file limit is not 0, or cannot be read: a child would inherit it. */
  CORE_FILE_LIMIT_NOT_ZERO: 'PRODUCTION_CORE_FILE_LIMIT_NOT_ZERO',
  /** The serialiser refused the start message. */
  START_MESSAGE_INVALID: 'PRODUCTION_START_MESSAGE_INVALID',
  /** The program could not be started at all. */
  PROGRAM_NOT_STARTED: 'PRODUCTION_PROGRAM_NOT_STARTED',
  /** The child ended, or closed its standard input, before it had taken the whole start message. */
  START_MESSAGE_NOT_TAKEN: 'PRODUCTION_START_MESSAGE_NOT_TAKEN',
  /** The child did not take the start message within the bound. It was killed. */
  START_MESSAGE_TIMEOUT: 'PRODUCTION_START_MESSAGE_TIMEOUT',
} as const;
export type ProductionDoorRefusal = (typeof ProductionDoorRefusal)[keyof typeof ProductionDoorRefusal];

const TEXT: Readonly<Record<ProductionDoorRefusal, string>> = Object.freeze({
  PRODUCTION_PROGRAM_NOT_ABSOLUTE: 'a production program is started by an absolute path',
  PRODUCTION_ENVIRONMENT_NOT_ALLOWED: 'a production program is started with the listed environment keys only',
  PRODUCTION_CORE_FILE_LIMIT_NOT_ZERO: 'no production program is started while the core-file limit of the server is not 0',
  PRODUCTION_START_MESSAGE_INVALID: 'the start message could not be made into bytes',
  PRODUCTION_PROGRAM_NOT_STARTED: 'the production program could not be started',
  PRODUCTION_START_MESSAGE_NOT_TAKEN: 'the production program ended before it had taken its start message',
  PRODUCTION_START_MESSAGE_TIMEOUT: 'the production program did not take its start message in time',
});

/** A refusal of the door: a code and its fixed sentence. It has no cause and names no value. */
export class ProductionDoorError extends Error {
  readonly code: ProductionDoorRefusal;
  constructor(code: ProductionDoorRefusal) {
    super(TEXT[code]);
    this.name = 'ProductionDoorError';
    this.code = code;
  }
}

/** The soft core-file limit of the server process in blocks (`Infinity`: unlimited), or null when it cannot be read. */
export type CoreFileLimitReader = () => number | null;

let knownCoreFileLimit: number | null | undefined;

/**
 * Reads the limit from the runtime's own report of the process, in memory: no file, no program.
 * Read once: the runtime has no call that changes a limit of its own process. The network part of
 * the report is left out for this one reading, so that no name lookup is made for it.
 */
export const coreFileLimitOfThisProcess: CoreFileLimitReader = () => {
  if (knownCoreFileLimit !== undefined) return knownCoreFileLimit;
  let limit: number | null = null;
  const report = process.report as unknown as { excludeNetwork?: boolean; getReport(): unknown } | undefined;
  if (report !== undefined) {
    const before = report.excludeNetwork;
    try {
      report.excludeNetwork = true;
      const limits = (report.getReport() as { userLimits?: { core_file_size_blocks?: { soft?: unknown } } }).userLimits;
      const soft = limits?.core_file_size_blocks?.soft;
      if (typeof soft === 'number' && Number.isFinite(soft) && soft >= 0) limit = soft;
      else if (soft === 'unlimited') limit = Number.POSITIVE_INFINITY;
    } catch {
      limit = null;
    } finally {
      report.excludeNetwork = before;
    }
  }
  knownCoreFileLimit = limit;
  return limit;
};

export interface ProductionProcessOptions {
  /** The program: an absolute path. */
  readonly command: string;
  /** Its whole argument list. Never a member of the start message. */
  readonly args: readonly string[];
  /** The child's whole environment, of the listed keys. Default: empty. */
  readonly env?: ProductionEnvironment;
  /** The start message, or null for a program that takes none. Its standard input stays open either way. */
  readonly message: StartMessage | null;
  /** The timers of the capture unit: the bound of the write. */
  readonly timers: CaptureTimers;
  /** Default: `START_MESSAGE_WRITE_BOUND_MS`. */
  readonly writeBoundMs?: number;
  /** Default: the limit of this process. A test passes a fixed answer. */
  readonly coreFileLimit?: CoreFileLimitReader;
  /** Told every chunk of standard output as it arrives, beside the bounded copy. The observer must not throw. */
  readonly onOutput?: (chunk: Buffer) => void;
}

export interface ProductionExit {
  readonly exitCode: number | null;
  readonly signal: string | null;
  /** True when no process ever existed. */
  readonly spawnFailed: boolean;
  /** The head of standard error, at most `PRODUCTION_OUTPUT_CAP_BYTES`, user parts blanked. For classification only. */
  readonly diagnostics: string;
  /** The head of standard output, with the same bound and the same blanking. */
  readonly output: string;
}

export interface ProductionProcess {
  readonly pid: number | null;
  /**
   * Resolves when the whole start message has left this process (at once for a program without
   * one). Rejects with a `ProductionDoorError`; the child of a rejected start is killed.
   */
  readonly started: Promise<void>;
  /** Settles once, when the process has ended and its streams are closed. Never rejects. */
  readonly ended: Promise<ProductionExit>;
  /** True until the process has ended. */
  alive(): boolean;
  /** Ends the child's standard input: its order to stop. */
  endInput(): void;
  kill(signal: 'SIGTERM' | 'SIGKILL'): void;
}

/** Starts a production program. Used through this type, so that a test passes a door that starts nothing. */
export type ProductionDoor = (options: ProductionProcessOptions) => ProductionProcess;

function boundedText(): { push(chunk: Buffer): void; text(): string } {
  const kept: Buffer[] = [];
  let size = 0;
  return {
    push(chunk) {
      if (size >= PRODUCTION_OUTPUT_CAP_BYTES) return;
      const part = chunk.subarray(0, PRODUCTION_OUTPUT_CAP_BYTES - size);
      kept.push(part);
      size += part.length;
    },
    text: () => blankCredentialLocators(Buffer.concat(kept).toString('utf8')),
  };
}

/** The child's environment: the listed keys the caller gave, each an absolute path. Null: refused. */
function environmentOf(given: ProductionEnvironment | undefined): Record<string, string> | null {
  const environment: Record<string, string> = {};
  for (const [key, value] of Object.entries(given ?? {})) {
    if (!PRODUCTION_ENVIRONMENT_KEYS.some((allowed) => allowed === key)) return null;
    if (typeof value !== 'string' || !isAbsolute(value) || value.includes('\0')) return null;
    environment[key] = value;
  }
  return environment;
}

function refused(code: ProductionDoorRefusal): ProductionProcess {
  const started = Promise.reject<void>(new ProductionDoorError(code));
  // A caller that reads `ended` only must not turn the refusal into an unhandled rejection.
  started.catch(() => {});
  return {
    pid: null,
    started,
    ended: Promise.resolve({ exitCode: null, signal: null, spawnFailed: true, diagnostics: '', output: '' }),
    alive: () => false,
    endInput: () => {},
    kill: () => {},
  };
}

export const startProductionProcess: ProductionDoor = (options) => {
  if (!isAbsolute(options.command)) return refused(ProductionDoorRefusal.PROGRAM_NOT_ABSOLUTE);
  const environment = environmentOf(options.env);
  if (environment === null) return refused(ProductionDoorRefusal.ENVIRONMENT_NOT_ALLOWED);
  if ((options.coreFileLimit ?? coreFileLimitOfThisProcess)() !== 0) return refused(ProductionDoorRefusal.CORE_FILE_LIMIT_NOT_ZERO);

  // The bytes exist from here to `settle`. A message the serialiser refuses starts no process.
  let startBytes: Buffer | null = null;
  if (options.message !== null) {
    try {
      startBytes = startMessageBytes(options.message);
    } catch {
      return refused(ProductionDoorRefusal.START_MESSAGE_INVALID);
    }
  }

  let child;
  try {
    child = spawn(options.command, [...options.args], {
      env: environment,
      shell: false,
      detached: false,
      windowsHide: true,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
  } catch {
    startBytes?.fill(0);
    return refused(ProductionDoorRefusal.PROGRAM_NOT_STARTED);
  }
  const running = child;
  const input = running.stdin;
  const diagnostics = boundedText();
  const output = boundedText();
  let over = false;
  let spawnFailed = running.pid === undefined;
  /**
   * The ONE place that signals the child. A start that failed has no process ID, and a signal sent
   * through its handle would go to process ID 0, which is the server's whole process group: never.
   */
  const signalChild = (signal: 'SIGTERM' | 'SIGKILL'): void => {
    if (!over && running.pid !== undefined) running.kill(signal);
  };
  const killAtExit = (): void => signalChild('SIGKILL');
  process.once('exit', killAtExit);

  // The streams are read as fast as they come and never paused: a full pipe would stop the child.
  running.stderr?.on('data', (chunk: Buffer) => diagnostics.push(chunk));
  running.stdout?.on('data', (chunk: Buffer) => {
    output.push(chunk);
    try {
      options.onOutput?.(chunk);
    } catch {
      // An observer never stops the reading of the stream.
    }
  });
  running.stderr?.on('error', () => {});
  running.stdout?.on('error', () => {});

  let settled = false;
  let cancelBound: () => void = () => {};
  let resolveStarted: () => void = () => {};
  let rejectStarted: (error: ProductionDoorError) => void = () => {};
  const started = new Promise<void>((resolve, reject) => {
    resolveStarted = resolve;
    rejectStarted = reject;
  });
  started.catch(() => {});

  /** The one end of the start: the bound is cancelled, the bytes are zero-filled, a refused child is killed. */
  const settle = (refusal: ProductionDoorRefusal | null): void => {
    if (settled) return;
    settled = true;
    cancelBound();
    // A refused write is taken from the stream BEFORE the bytes are cleared: no cleared byte is ever sent.
    if (refusal !== null) input?.destroy();
    startBytes?.fill(0);
    startBytes = null;
    if (refusal === null) {
      resolveStarted();
      return;
    }
    signalChild('SIGKILL');
    rejectStarted(new ProductionDoorError(spawnFailed ? ProductionDoorRefusal.PROGRAM_NOT_STARTED : refusal));
  };

  const ended = new Promise<ProductionExit>((resolve) => {
    const end = (exitCode: number | null, signal: string | null): void => {
      if (over) return;
      over = true;
      process.removeListener('exit', killAtExit);
      // A child that is gone takes nothing more: a start that was still open is refused, its bytes cleared.
      settle(ProductionDoorRefusal.START_MESSAGE_NOT_TAKEN);
      resolve({ exitCode, signal, spawnFailed, diagnostics: diagnostics.text(), output: output.text() });
    };
    running.on('error', () => {
      // No such file, no permission to execute: the process never existed.
      if (running.pid === undefined) {
        spawnFailed = true;
        end(null, null);
      }
    });
    // `close`, not `exit`: the child has been waited for and everything it wrote has been read.
    running.on('close', (exitCode, signal) => end(exitCode, signal));
  });

  // A write to a child that is gone fails here, also long after the start: it is never thrown.
  input?.on('error', () => settle(ProductionDoorRefusal.START_MESSAGE_NOT_TAKEN));
  if (spawnFailed || input === null) {
    settle(ProductionDoorRefusal.PROGRAM_NOT_STARTED);
  } else if (startBytes === null) {
    settle(null);
  } else {
    cancelBound = options.timers.after(options.writeBoundMs ?? START_MESSAGE_WRITE_BOUND_MS, () => settle(ProductionDoorRefusal.START_MESSAGE_TIMEOUT));
    input.write(startBytes, (error) => settle(error ? ProductionDoorRefusal.START_MESSAGE_NOT_TAKEN : null));
  }

  return {
    get pid() {
      return running.pid ?? null;
    },
    started,
    ended,
    alive: () => !over,
    endInput() {
      if (!over && input !== null && !input.destroyed) input.end();
    },
    kill: signalChild,
  };
};
