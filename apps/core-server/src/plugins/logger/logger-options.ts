/**
 * Options of Fastify's built-in logger (SR-48, SR-49; decision record TD-01 "Logging rule").
 *
 * Four layers keep credentials, bodies and URLs out of the log, at every level:
 *   1. Serializers. `req` gives the method and the route pattern, `res` the status, `err` the
 *      name, the code and the stack frames (its `message` is the code). So even a line written
 *      with `{ req, res, err }` holds no URL, no header, no body and no error message (a
 *      parser's message can quote the body, SA-12).
 *   2. Every error, at every key. The convention is `{ err }`, and a static test keeps it
 *      (`test/static/log-calls.test.ts`). The log does not depend on it: before a line is
 *      serialised, every `Error` found in its object, under any key, inside nested objects and
 *      arrays, is replaced by the same safe description the `err` serializer gives
 *      (`safeLogObject`). An error of the query builder holds the statement, its parameters and
 *      the driver's error with the server's `DETAIL` as plain members; none of them is written.
 *   3. Redaction. `authorization`, `cookie` and `set-cookie` are censored wherever a header
 *      object is logged by hand.
 *   4. A log-method hook. An error logged without a text would lend its own message to the
 *      line; it gets a fixed text instead. A quoted path inside a message text is replaced:
 *      Fastify has warnings that quote the raw URL (a handler that answered twice). And an
 *      error passed as a value for a `%s` or `%o` of the text is described the same way.
 *   5. Member names (integration pass D1a, decision D134). Layers 1 to 4 rest on "no credential
 *      is handed to the log". This one stands when one is: the object of every line goes through
 *      the ONE rule set of the clients' log lists (`@dems/shared/redaction`), so the value of a
 *      member whose name says credential (`password`, `secret`, `token`, `apiKey`, ...) at any
 *      depth, the `value` beside a naming member (`{ field: 'credential.password', value }`), the
 *      account name beside a credential member, and a token of this server inside a text are
 *      written as `***`. No second list lives here.
 * Request and response bodies are logged nowhere in the server.
 *
 * What layer 2 does not reach: the bindings of a child logger. The logger serialises them when
 * the child is created and applies no formatter to them, so only the three serializers act
 * there. The server creates no child logger of its own; the static test keeps that too.
 */
import { redactCredentialValue } from '@dems/shared/redaction';
import type { FastifyRequest, FastifyServerOptions } from 'fastify';
import type { LogLevel } from '../../config';
import { describeError } from './error-log';
import { routeOf } from './request-log';

export type LoggerOptions = Exclude<NonNullable<FastifyServerOptions['logger']>, boolean>;
export type LogStream = NonNullable<LoggerOptions['stream']>;

export const REDACTED = '[redacted]';

/** The three headers of SR-48, at the places a header object can appear in a log line. */
export const REDACT_PATHS = [
  'authorization',
  'cookie',
  '["set-cookie"]',
  'headers.authorization',
  'headers.cookie',
  'headers["set-cookie"]',
  '*.headers.authorization',
  '*.headers.cookie',
  '*.headers["set-cookie"]',
] as const;

function isFastifyRequest(value: unknown): value is FastifyRequest {
  return typeof value === 'object' && value !== null && 'routeOptions' in value && 'raw' in value;
}

function methodOf(value: unknown): string | undefined {
  return typeof value === 'object' && value !== null && 'method' in value && typeof value.method === 'string'
    ? value.method
    : undefined;
}

function statusOf(value: unknown): number | undefined {
  return typeof value === 'object' && value !== null && 'statusCode' in value && typeof value.statusCode === 'number'
    ? value.statusCode
    : undefined;
}

/** The log message when a caller gave an error and no text. */
const FALLBACK_MESSAGE = 'error';

/**
 * What a log line holds about an error, at whatever key it was logged. A type alias, not an
 * interface: Fastify's type for the `err` serializer asks for an object with an index signature.
 */
export type LoggedError = {
  /** The error's name. */
  readonly type: string;
  /** Its `code`, or that of the first error down its `cause` chain that has one. */
  readonly code: string | undefined;
  /** The name of the cause that carried the code, when it was not the error itself. */
  readonly causeType?: string;
  /** The code, or the name: never the error's own message. */
  readonly message: string;
  /** Stack frames only. */
  readonly stack: string;
};

/**
 * The description of an error in a log line. Fastify's type for the `err` serializer asks for
 * `type`, `message` and `stack`. `message` is the code (or the name), never the error's own
 * message; `stack` is the frames without the message lines.
 */
export function loggedError(value: unknown): LoggedError {
  const { errorName, code, causeName, stackTrace } = describeError(value);
  return {
    type: errorName,
    code,
    ...(causeName === undefined ? {} : { causeType: causeName }),
    message: code ?? errorName,
    stack: stackTrace ?? '',
  };
}

/** Top-level members that a serializer replaces as a whole. */
const SERIALIZED_KEYS: ReadonlySet<string> = new Set(['req', 'res', 'err']);

/** How deep the object of a log line is read. Deeper objects are not written. */
export const LOG_DEPTH_LIMIT = 6;
/** How many members of one log line are read. A container that goes past it is not written. */
export const LOG_MEMBER_LIMIT = 2_000;
/** Stands in the log for an object that was too deep or too large to check. */
export const NOT_LOGGED = '[not logged]';

interface Budget {
  left: number;
}

/**
 * `value` as it may be written: every `Error` in it replaced by `loggedError`, at any depth the
 * logger would serialise. The same object comes back when it holds none (nothing is copied and
 * nothing is changed in place). What cannot be checked within the limits is not written.
 */
function safeValue(value: unknown, depth: number, budget: Budget): unknown {
  if (typeof value !== 'object' || value === null) return value;
  if (value instanceof Error) return loggedError(value);
  if (depth > LOG_DEPTH_LIMIT || budget.left <= 0) return NOT_LOGGED;
  try {
    // What the serialiser would write for an object that has its own JSON form (a date).
    if ('toJSON' in value && typeof value.toJSON === 'function') {
      budget.left -= 1;
      const json: unknown = (value.toJSON as () => unknown).call(value);
      return typeof json === 'object' && json !== null ? safeValue(json, depth + 1, budget) : value;
    }
    if (Array.isArray(value)) {
      const items: readonly unknown[] = value;
      let copy: unknown[] | undefined;
      for (const [index, item] of items.entries()) {
        budget.left -= 1;
        if (budget.left < 0) return NOT_LOGGED;
        const safe = safeValue(item, depth + 1, budget);
        if (safe !== item) {
          copy ??= [...items];
          copy[index] = safe;
        }
      }
      return copy ?? value;
    }
    let copy: Record<string, unknown> | undefined;
    const members = value as Record<string, unknown>;
    for (const key of Object.keys(members)) {
      budget.left -= 1;
      if (budget.left < 0) return NOT_LOGGED;
      const member = members[key];
      const safe = safeValue(member, depth + 1, budget);
      if (safe !== member) {
        copy ??= { ...members };
        copy[key] = safe;
      }
    }
    return copy ?? value;
  } catch {
    // A member that throws when it is read: the serialiser would fail on it as well.
    return NOT_LOGGED;
  }
}

/**
 * The object of a log line as it may be written (layer 2 of the header). `req`, `res` and `err`
 * at the top are left to their serializers, which replace them as a whole.
 */
export function safeLogObject<T extends object>(object: T): T | Record<string, unknown> {
  const budget: Budget = { left: LOG_MEMBER_LIMIT };
  const members = object as Record<string, unknown>;
  let copy: Record<string, unknown> | undefined;
  for (const key of Object.keys(members)) {
    if (SERIALIZED_KEYS.has(key)) continue;
    const member = members[key];
    const safe = safeValue(member, 1, budget);
    if (safe !== member) {
      copy ??= { ...members };
      copy[key] = safe;
    }
  }
  return copy ?? object;
}

/**
 * `value` with every object that has its own JSON form replaced by that form (a date, a buffer, a
 * sealed credential's fixed mark): what the serialiser would write, so that the member-name rule
 * judges the line as written and never walks the inside of such an object. Runs on the answer of
 * `safeLogObject`, which is already bounded in depth and size.
 */
function writtenForm(value: unknown, depth: number): unknown {
  if (typeof value !== 'object' || value === null) return value;
  if (depth > LOG_DEPTH_LIMIT + 2) return NOT_LOGGED;
  try {
    if ('toJSON' in value && typeof value.toJSON === 'function') return writtenForm((value.toJSON as () => unknown).call(value), depth + 1);
    if (Array.isArray(value)) return (value as readonly unknown[]).map((item) => writtenForm(item, depth + 1));
    return Object.fromEntries(Object.entries(value).map(([key, member]) => [key, writtenForm(member, depth + 1)]));
  } catch {
    return NOT_LOGGED;
  }
}

/**
 * Layer 5 of the header: the object of a log line with credential members blanked by the shared
 * rule set. `req`, `res` and `err` at the top stay as they are for their serializers. Never
 * throws: a line that cannot be judged loses its members, not the process its log.
 */
export function blankCredentialMembers(object: Record<string, unknown>): Record<string, unknown> {
  const kept: Record<string, unknown> = {};
  const judged: Record<string, unknown> = {};
  for (const key of Object.keys(object)) (SERIALIZED_KEYS.has(key) ? kept : judged)[key] = object[key];
  try {
    return { ...(redactCredentialValue(writtenForm(judged, 0)) as Record<string, unknown>), ...kept };
  } catch {
    return { ...kept, members: NOT_LOGGED };
  }
}

function isErrorCarrier(value: unknown): value is { err: Error } {
  return typeof value === 'object' && value !== null && 'err' in value && value.err instanceof Error;
}

/** Replaces a quoted absolute path inside a message text, for example `"/api/v1/x?token=…"`. */
export function scrubMessage(text: string): string {
  return text.replace(/"\/[^"]*"/g, '"[path]"');
}

export interface LoggerOptionsInput {
  readonly level: LogLevel;
  /** Where the lines go. Default: standard output. Tests pass a capturing stream. */
  readonly stream?: LogStream | undefined;
}

export function buildLoggerOptions(input: LoggerOptionsInput): LoggerOptions {
  return {
    level: input.level,
    ...(input.stream === undefined ? {} : { stream: input.stream }),
    redact: { paths: [...REDACT_PATHS], censor: REDACTED },
    serializers: {
      req: (value: unknown) =>
        isFastifyRequest(value) ? { method: value.method, route: routeOf(value) } : { method: methodOf(value) },
      res: (value: unknown) => ({ statusCode: statusOf(value) }),
      err: loggedError,
    },
    formatters: {
      // Layer 2: runs on the object of every line, before the serializers.
      // Then layer 5: credential members by name, through the shared rule set.
      log: (object) => blankCredentialMembers(safeLogObject(object) as Record<string, unknown>),
    },
    hooks: {
      logMethod(args, method) {
        const [first, second] = args as readonly unknown[];
        const hasText = typeof second === 'string';
        if (first instanceof Error) {
          // `log.error(error)`: the logger would make the error's own message the log message.
          method.call(this, { err: first }, hasText ? scrubMessage(second) : FALLBACK_MESSAGE);
          return;
        }
        if (!hasText && isErrorCarrier(first)) {
          // `log.warn({ err })` with no text: the same. Fastify does this when a handler answers
          // twice, and that error's message quotes the raw URL.
          method.call(this, first, FALLBACK_MESSAGE);
          return;
        }
        // The first argument, when it is an object, is the line's object: the formatter above
        // reads it. Every later one is a text, or a value for a `%s` or `%o` of the text.
        const scrubbed = args.map((arg: unknown, index: number) => {
          if (typeof arg === 'string') return scrubMessage(arg);
          return index === 0 ? arg : safeValue(arg, 1, { left: LOG_MEMBER_LIMIT });
        });
        method.apply(this, scrubbed as Parameters<typeof method>);
      },
    },
  };
}
