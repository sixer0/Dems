/**
 * The transcriber's log, written to the Core's two sinks (blueprint row 115; SEC35-14, E-31).
 *
 * `@dems/transcriber` logs through a `TranscriberLog`. In the Core that is: one line of the
 * server's log for every entry, and one entry of the PERSISTENT error log for every `warn` and
 * `error` (the file the team reads the next morning). Three rules hold for every line:
 *
 *   - the line is blanked by the transcriber's own rule first (`blankRecord`): by VALUE for every
 *     credential a backend protected, then by name and position through the one shared rule set;
 *   - the MESSAGE of the Core's line is a fixed text of this file. What the transcriber wrote goes
 *     into the fields `detail` (its own message, blanked) and `transcriberSource`;
 *   - of an error only its code and its `reason` are kept. Its message and its stack are not
 *     passed on to the persistent log.
 */
import { blankRecord, TranscriberError, type Credential, type LogEntry, type LogLevel, type LogRecord, type TranscriberLog } from '@dems/transcriber';

const LOG_SOURCE = 'transcription.transcriber';
const LINE = 'transcriber log entry';
const PROTECTED_CREDENTIALS = 16;

export interface CoreLogSinks {
  readonly log: {
    info(fields: Record<string, unknown>, message: string): void;
    warn(fields: Record<string, unknown>, message: string): void;
    error(fields: Record<string, unknown>, message: string): void;
  };
  readonly errorLog: { append(entry: { level: 'error' | 'warn'; source: string; message: string; code?: string; context?: Readonly<Record<string, string | number | boolean | null>> }): void };
  readonly now: () => number;
}

const primitive = (value: unknown): value is string | number | boolean | null => value === null || ['string', 'number', 'boolean'].includes(typeof value);

export function createCoreTranscriberLog(sinks: CoreLogSinks): TranscriberLog {
  const credentials: Credential[] = [];
  const emit = (level: LogLevel, entry: LogEntry): void => {
    const error = entry.error;
    const code = error instanceof TranscriberError ? error.code : error instanceof Error ? error.name : undefined;
    const reason = error instanceof TranscriberError && typeof error.detail['reason'] === 'string' ? error.detail['reason'] : undefined;
    const record: LogRecord = {
      timestamp: new Date(sinks.now()).toISOString(),
      level,
      source: entry.source,
      message: entry.message,
      stackTrace: null,
      context: entry.context ?? {},
      correlationId: entry.correlationId ?? null,
    };
    // Blanked as ONE line by the transcriber's rule, then read back: nothing below sees the entry itself.
    const blanked = JSON.parse(blankRecord(record, credentials)) as LogRecord;
    const context: Record<string, string | number | boolean | null> = {};
    for (const [key, value] of Object.entries(blanked.context)) if (primitive(value)) context[key] = value;
    if (reason !== undefined && context['reason'] === undefined) context['reason'] = reason;
    const fields = { source: LOG_SOURCE, transcriberSource: blanked.source, detail: blanked.message, correlationId: blanked.correlationId, ...(code === undefined ? {} : { code }), ...context };
    sinks.log[level](fields, LINE);
    if (level !== 'info') {
      sinks.errorLog.append({
        level,
        source: blanked.source,
        message: blanked.message,
        ...(code === undefined ? {} : { code }),
        context: { ...context, ...(blanked.correlationId === null ? {} : { correlationId: blanked.correlationId }) },
      });
    }
  };
  return {
    error: (entry) => emit('error', entry),
    warn: (entry) => emit('warn', entry),
    info: (entry) => emit('info', entry),
    protect(credential) {
      if (credential === null) return;
      credentials.push(credential);
      // Every probe and every session loads the key anew: the holders of the last few are kept,
      // which is all a line written from now on can name.
      if (credentials.length > PROTECTED_CREDENTIALS) credentials.shift();
    },
  };
}
