/**
 * The persistent, structured log of the transcriber, with the log-blanking rule (SEC35-14; E-31).
 *
 * One JSON object per line: `timestamp`, `level`, `source`, `message`, `stackTrace`, `context`,
 * `correlationId`. Every record is blanked before it is written (`blankRecord`), so a header value,
 * a credential-named member or the key itself (in any position, in any written form) never reaches
 * the file. The by-position rules are the shared ones of `@dems/shared/api` (one rule set for the
 * web sink, the mobile log and this log); the by-value rule is this workspace's, because only the
 * transcriber holds the key. The file is
 * rotated by size. A log that cannot be written never stops a transcription: the line goes to the
 * standard error stream instead, blanked the same way.
 *
 * No duration, rate or speed is ever a member of a record (D230).
 */
import { appendFileSync, mkdirSync, renameSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { redactCredentialText, redactCredentialValue } from '@dems/shared/api';
import { scrubCredential, type Credential } from './key-loader';

export type LogLevel = 'error' | 'warn' | 'info';
export type LogContext = Readonly<Record<string, string | number | boolean | null | readonly string[]>>;

export interface LogRecord {
  readonly timestamp: string;
  readonly level: LogLevel;
  readonly source: string;
  readonly message: string;
  readonly stackTrace: string | null;
  readonly context: LogContext;
  readonly correlationId: string | null;
}

export interface LogEntry {
  readonly source: string;
  readonly message: string;
  readonly error?: unknown;
  readonly context?: LogContext;
  readonly correlationId?: string;
}

export interface TranscriberLog {
  error(entry: LogEntry): void;
  warn(entry: LogEntry): void;
  info(entry: LogEntry): void;
  /** Adds a credential whose text is blanked wherever it appears from now on. */
  protect(credential: Credential | null): void;
}

/**
 * The blanking rule of a TEXT. Two parts:
 *
 *   by value     every protected credential, in each form it can be written in (`scrubCredential`):
 *                this is the part only the transcriber can do, because only it holds the key;
 *   by position  the ONE shared rule set of the client logs (`redactCredentialText` of
 *                `@dems/shared/api`, row 113): after `Bearer`, under a credential-named member,
 *                quoted or not, escaped any number of times; it fails closed.
 */
export function blankText(text: string, credentials: readonly Credential[] = []): string {
  let out = text;
  for (const credential of credentials) out = scrubCredential(out, credential);
  return redactCredentialText(out);
}

/** The blanking rule of a VALUE: every text inside it by value, then the shared rule set by name and position. */
function blankValue(value: unknown, credentials: readonly Credential[], depth = 0): unknown {
  if (typeof value === 'string') return credentials.reduce((text, credential) => scrubCredential(text, credential), value);
  if (value === null || typeof value !== 'object' || depth > 16) return value;
  if (Array.isArray(value)) return value.map((entry) => blankValue(entry, credentials, depth + 1));
  return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, entry]) => [key, blankValue(entry, credentials, depth + 1)]));
}

/** One log line: the record blanked member by member BEFORE it becomes JSON, then the line by value once more. */
export function blankRecord(record: LogRecord, credentials: readonly Credential[] = []): string {
  const line = JSON.stringify(redactCredentialValue(blankValue(record, credentials)));
  return credentials.reduce((text, credential) => scrubCredential(text, credential), line);
}

function toRecord(level: LogLevel, entry: LogEntry, now: () => Date): LogRecord {
  const error = entry.error;
  return {
    timestamp: now().toISOString(),
    level,
    source: entry.source,
    message: error instanceof Error ? `${entry.message}: ${error.message}` : entry.message,
    stackTrace: error instanceof Error ? (error.stack ?? null) : null,
    context: entry.context ?? {},
    correlationId: entry.correlationId ?? null,
  };
}

function buildLog(write: (line: string) => void, now: () => Date): TranscriberLog {
  const credentials: Credential[] = [];
  const emit = (level: LogLevel, entry: LogEntry): void => {
    write(blankRecord(toRecord(level, entry, now), credentials));
  };
  return {
    error: (entry) => emit('error', entry),
    warn: (entry) => emit('warn', entry),
    info: (entry) => emit('info', entry),
    protect(credential) {
      if (credential !== null) credentials.push(credential);
    },
  };
}

export const LOG_FILE_NAME = 'transcriber.log';
export const LOG_ROTATE_BYTES = 5 * 1024 * 1024;

export interface FileLogOptions {
  /** The directory of the log file: from configuration, under a git-ignored data root. */
  readonly dir: string;
  readonly rotateBytes?: number;
  readonly now?: () => Date;
}

/** The persistent log: appended line by line, rotated to `transcriber.log.1` at the size bound. */
export function createFileLog(options: FileLogOptions): TranscriberLog {
  const file = join(options.dir, LOG_FILE_NAME);
  const rotateBytes = options.rotateBytes ?? LOG_ROTATE_BYTES;
  const write = (line: string): void => {
    try {
      mkdirSync(options.dir, { recursive: true });
      let size = 0;
      try {
        size = statSync(file).size;
      } catch {
        size = 0; // No file yet: the first line creates it.
      }
      if (size >= rotateBytes) renameSync(file, `${file}.1`);
      appendFileSync(file, `${line}\n`, { encoding: 'utf8', mode: 0o600 });
    } catch {
      // The store is not writable: the (already blanked) line is still not lost silently.
      process.stderr.write(`${line}\n`);
    }
  };
  return buildLog(write, options.now ?? (() => new Date()));
}

export interface MemoryLog extends TranscriberLog {
  readonly lines: string[];
  records(): LogRecord[];
}

/** A log that keeps its blanked lines in memory: for tests and for a caller with its own sink. */
export function createMemoryLog(now: () => Date = () => new Date()): MemoryLog {
  const lines: string[] = [];
  const log = buildLog((line) => lines.push(line), now);
  return { ...log, lines, records: () => lines.map((line) => JSON.parse(line) as LogRecord) };
}
