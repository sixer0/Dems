/**
 * Persistent error log: one JSON object per line in `apps/core-server/logs/errors.log`
 * (git-ignored by the root `*.log` rule; mode 0600). It complements the stream logger, so that
 * a failure survives a closed terminal. The same pattern as mock-core's error log.
 *
 * What an entry may hold (SR-48, SR-49, SR-50): a fixed description written by the server, an
 * error name, an error code, the stack frames, and identifiers that are safe to log (request
 * ID, method, route pattern, boot check ID). Never an error's own message, a URL, a header or
 * a body: a parser's or a driver's message can quote the input.
 *
 * `describeError` is the one safe description of a thrown value, for this file and for the
 * stream logger (`logger-options.ts`). `codedCauseOf` is the one walk over a `cause` chain: the
 * query builder wraps what the driver throws, so the SQLSTATE of a failed statement is on
 * `error.cause`, not on the error (decision D38).
 *
 * Writing never throws: the error log must not take the service down.
 *
 * Hand-built (decision D241 DN-W91-1, HBX-4: accepted with a rotation test instead of a switch to
 * a pino file transport). The writes stay synchronous ON PURPOSE: the entry point appends a
 * `fatal` entry and calls `process.exit(1)` in the next statement (`src/index.ts`), and an
 * asynchronous write would be lost there. An append is bounded to two calls in the steady state
 * (review finding W91-8): the size check for the rotation and the append itself. The folder is
 * made and the mode set to 0600 once per file (again after a rotation or a failed append), not on
 * every entry.
 */
import { appendFileSync, chmodSync, mkdirSync, renameSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SERVICE_NAME } from '../../config';

/** `apps/core-server/logs/errors.log`. The entry point passes it; the app factory has no default. */
export const DEFAULT_ERROR_LOG_FILE = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  '..',
  'logs',
  'errors.log',
);

/** At this size the file is moved to `errors.1.log` (one generation) and a new one is started. */
export const ERROR_LOG_ROTATE_BYTES = 5 * 1024 * 1024;

/**
 * The name of the one older generation: `errors.log` -> `errors.1.log`. A path that does not end
 * in `.log` gets `.1` appended (review finding W91-8): replacing a missing `.log` would return
 * the same name, and the rename would leave the file growing forever.
 */
export function rotatedErrorLogFile(file: string): string {
  return file.endsWith('.log') ? `${file.slice(0, -'.log'.length)}.1.log` : `${file}.1`;
}

export interface ErrorLogOptions {
  /** The size at which the file is rotated. Default `ERROR_LOG_ROTATE_BYTES`; a test passes a small one. */
  readonly rotateBytes?: number | undefined;
}

export type ErrorLogContext = Readonly<Record<string, string | number | boolean | null>>;

export interface ErrorLogEntry {
  readonly level: 'fatal' | 'error' | 'warn';
  /** Module and function, for example "error-envelope.errorHandler". */
  readonly source: string;
  /** A fixed description chosen by the caller. Never text taken from a request or from an error. */
  readonly message: string;
  readonly code?: string | undefined;
  readonly errorName?: string | undefined;
  /** The name of the wrapped error that carried `code` (see `describeError`). */
  readonly causeName?: string | undefined;
  /** Stack frames only (see `describeError`). */
  readonly stackTrace?: string | undefined;
  /** Request ID (the correlation ID), method, route pattern, boot check ID. */
  readonly context?: ErrorLogContext | undefined;
}

export interface ErrorLog {
  /** The file entries go to, or null when persistence is off (in-process tests). */
  readonly file: string | null;
  append(entry: ErrorLogEntry): void;
}

export interface ErrorDescription {
  readonly errorName: string;
  /** The `code` of the error itself, or of the first error down its `cause` chain that has one. */
  readonly code?: string;
  /** The name of the error that carried `code`, when that is a cause and not the error itself. */
  readonly causeName?: string;
  readonly stackTrace?: string;
}

/** How many errors of a `cause` chain are read: the error itself and three causes. */
export const CAUSE_CHAIN_DEPTH = 4;

export interface CodedCause {
  /** The error that carries the code: the value itself (depth 0) or one of its causes. */
  readonly error: object;
  readonly code: string;
  readonly depth: number;
}

/**
 * The first error of a `cause` chain that carries a `code`: a Fastify code, a Node system code,
 * an SQLSTATE. The value itself comes first, then `cause`, `cause.cause`, ..., at most
 * `CAUSE_CHAIN_DEPTH` errors in all. Undefined when none of them has a string `code`.
 *
 * The driver puts the SQLSTATE on its own error; the query builder wraps that error in one whose
 * MESSAGE quotes the statement and its parameters. Whoever needs the code or the driver's error
 * takes it from here and never reads the wrapper's message.
 */
export function codedCauseOf(error: unknown): CodedCause | undefined {
  let current: unknown = error;
  for (let depth = 0; depth < CAUSE_CHAIN_DEPTH && typeof current === 'object' && current !== null; depth += 1) {
    const code: unknown = 'code' in current ? current.code : undefined;
    if (typeof code === 'string') return { error: current, code, depth };
    current = 'cause' in current ? current.cause : undefined;
  }
  return undefined;
}

/**
 * A line of a stack trace as V8 writes it: `at fn (file:line:column)`, `at file:line:column`,
 * `at fn (<anonymous>)`, `at async Promise.all (index 0)`. A line of text that merely starts
 * with "at" is not one.
 */
const FRAME_LINE = /^\s+at .+(?::\d+:\d+\)?|\(<anonymous>\)|\(native\)|\(index \d+\)|<anonymous>)$/;

/**
 * The frames of a stack, without the text of the error. A stack starts with the error's own
 * text, and a message can have many lines (the query builder's holds the statement and its
 * parameters); one of them could look like a frame. So the message is cut out first, and of
 * what remains only lines in the form of a frame are kept.
 */
function stackFramesOf(error: Error): string {
  const stack = typeof error.stack === 'string' ? error.stack : '';
  const message = typeof error.message === 'string' ? error.message : '';
  const at = message === '' ? -1 : stack.indexOf(message);
  const afterMessage = at < 0 ? stack : stack.slice(at + message.length);
  return afterMessage
    .split('\n')
    .filter((line) => FRAME_LINE.test(line))
    .join('\n');
}

function nameOf(value: object): string {
  if (value instanceof Error) return value.name;
  const name: unknown = 'name' in value ? value.name : undefined;
  return typeof name === 'string' ? name : typeof value;
}

/**
 * What may be logged about a thrown value: its name, a `code` (a Fastify code, a Node system
 * code, an SQLSTATE) and the frames of its stack. The code is the error's own or, when it has
 * none, that of the first error down its `cause` chain that has one; `causeName` then names that
 * error. No message is read, of the error or of a cause, and nothing else of a cause: not its
 * statement, its parameters, its `detail`, its `hint` or its `where`.
 */
export function describeError(error: unknown): ErrorDescription {
  if (!(error instanceof Error)) return { errorName: typeof error };
  const coded = codedCauseOf(error);
  const frames = stackFramesOf(error);
  return {
    errorName: error.name,
    ...(coded === undefined ? {} : { code: coded.code }),
    ...(coded === undefined || coded.depth === 0 ? {} : { causeName: nameOf(coded.error) }),
    ...(frames === '' ? {} : { stackTrace: frames }),
  };
}

/** True when the file was moved aside: the next append starts a new file. */
function rotateIfLarge(file: string, rotateBytes: number): boolean {
  try {
    if (statSync(file).size < rotateBytes) return false;
    renameSync(file, rotatedErrorLogFile(file));
    return true;
  } catch {
    // No file yet, or it cannot be moved: appending decides what happens next.
    return false;
  }
}

export function createErrorLog(file: string | null, options: ErrorLogOptions = {}): ErrorLog {
  const rotateBytes = options.rotateBytes ?? ERROR_LOG_ROTATE_BYTES;
  /** False until the folder exists and the file's mode was set in this process. */
  let prepared = false;
  return {
    file,
    append(entry) {
      if (file === null) return;
      try {
        if (!prepared) mkdirSync(dirname(file), { recursive: true });
        if (rotateIfLarge(file, rotateBytes)) prepared = false;
        const row = { timestamp: new Date().toISOString(), service: SERVICE_NAME, ...entry };
        // `mode` applies to a file this call creates; an existing file keeps its mode, so the
        // first append of this process (and the first after a rotation) sets it.
        appendFileSync(file, `${JSON.stringify(row)}\n`, { mode: 0o600 });
        if (!prepared) {
          chmodSync(file, 0o600);
          prepared = true;
        }
      } catch {
        // The stream logger still has the event. The next append prepares the file again.
        prepared = false;
      }
    },
  };
}
