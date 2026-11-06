/**
 * Errors of the core services (plan row W21).
 *
 * Two kinds, because they mean two different things to a caller:
 *
 *   `PipelineFailure`  the SERVER cannot run or commit the unit now: the queue is full or
 *                      closed, the unit ran too long, the database does not answer, the commit
 *                      failed, the audit chain refused a row. It is an `ApiFailure` with the
 *                      envelope's 503 `NOT_READY` (spec §2.3 stage 9, §8.2 ENG-5), so a handler
 *                      that lets it propagate answers correctly. `reason` says which case; it is
 *                      for the log and for tests and never part of the answer.
 *
 *   `CoreError`        the CALLING CODE is wrong: a row that breaks a rule of the writers (a
 *                      type outside the vocabulary, a payload that is not flat, a key that may
 *                      name a secret), a unit used after it ended, a statement that would end
 *                      the unit's transaction. It is not an `ApiFailure`: it propagates as an
 *                      unexpected failure, the unit rolls back and the request answers 500.
 *                      `code` names the rule.
 *
 * A message of either kind is a fixed text written here. It never quotes a row, a payload, a
 * statement or a value (SR-48, SR-54): an error's `code` is what the log carries.
 */
import { ApiFailure, notReady } from '../plugins/error-envelope';

/** Why the pipeline could not run or commit a unit. */
export const PipelineRefusal = {
  /** `PIPELINE_MAX_PENDING` units are already waiting. */
  QUEUE_FULL: 'QUEUE_FULL',
  /** The pipeline was closed (shutdown) before the unit could start. */
  CLOSED: 'CLOSED',
  /** The unit ran longer than `PIPELINE_UNIT_TIMEOUT_MS`. Nothing of it is committed. */
  UNIT_TIMEOUT: 'UNIT_TIMEOUT',
  /** No connection, or `BEGIN`, the chain lock or the connection itself failed. */
  DATABASE_UNAVAILABLE: 'DATABASE_UNAVAILABLE',
  /** `COMMIT` failed or did not commit. */
  COMMIT_FAILED: 'COMMIT_FAILED',
  /** The database refused an audit row: it does not continue the chain (SQLSTATE ZA001). */
  AUDIT_CHAIN_REFUSED: 'AUDIT_CHAIN_REFUSED',
  /** Rows built by the engine do not continue the stored head (append protocol AP-6). */
  AUDIT_HEAD_DIVERGED: 'AUDIT_HEAD_DIVERGED',
} as const;
export type PipelineRefusal = (typeof PipelineRefusal)[keyof typeof PipelineRefusal];

const NOT_READY = notReady();

/** 503 `NOT_READY` with the reason the pipeline had. See the header of this file. */
export class PipelineFailure extends ApiFailure {
  readonly reason: PipelineRefusal;

  constructor(reason: PipelineRefusal, cause?: unknown) {
    super(NOT_READY.statusCode, NOT_READY.code, NOT_READY.message, cause === undefined ? {} : { cause });
    this.name = 'PipelineFailure';
    this.reason = reason;
  }
}

/** The rules a caller of the core services can break. Each is the `code` of a `CoreError`. */
export const CoreErrorCode = {
  // The pipeline and the unit of work.
  UNIT_LABEL_INVALID: 'UNIT_LABEL_INVALID',
  PIPELINE_REENTRANT: 'PIPELINE_REENTRANT',
  UNIT_NOT_ACTIVE: 'UNIT_NOT_ACTIVE',
  UNIT_ENDED: 'UNIT_ENDED',
  UNIT_STATEMENT_NOT_ALLOWED: 'UNIT_STATEMENT_NOT_ALLOWED',
  CLOCK_VALUE_INVALID: 'CLOCK_VALUE_INVALID',
  // The audit writer.
  AUDIT_ENTRY_INVALID: 'AUDIT_ENTRY_INVALID',
  AUDIT_TYPE_UNKNOWN: 'AUDIT_TYPE_UNKNOWN',
  AUDIT_SEVERITY_INVALID: 'AUDIT_SEVERITY_INVALID',
  AUDIT_ACTOR_INVALID: 'AUDIT_ACTOR_INVALID',
  AUDIT_REFERENCE_INVALID: 'AUDIT_REFERENCE_INVALID',
  AUDIT_MESSAGE_INVALID: 'AUDIT_MESSAGE_INVALID',
  AUDIT_DETAILS_NOT_FLAT: 'AUDIT_DETAILS_NOT_FLAT',
  AUDIT_DETAIL_KEY_FORBIDDEN: 'AUDIT_DETAIL_KEY_FORBIDDEN',
  AUDIT_DETAIL_KEY_NOT_ALLOWED: 'AUDIT_DETAIL_KEY_NOT_ALLOWED',
  AUDIT_DETAIL_MISSING: 'AUDIT_DETAIL_MISSING',
  AUDIT_DETAIL_VALUE_INVALID: 'AUDIT_DETAIL_VALUE_INVALID',
  AUDIT_TEXT_INVALID: 'AUDIT_TEXT_INVALID',
  AUDIT_SECRET_SHAPED_VALUE: 'AUDIT_SECRET_SHAPED_VALUE',
  AUDIT_ROW_INVALID: 'AUDIT_ROW_INVALID',
  AUDIT_ROW_HASH_MISMATCH: 'AUDIT_ROW_HASH_MISMATCH',
  // The operator purge (migration 0036): a function that answered with something other than what
  // the unit counted and announced. Both are the unit's own refusal to commit an erasure it cannot
  // account for, so they are engine faults rather than anything an administrator can cause.
  AUDIT_PURGE_ANSWER_INVALID: 'AUDIT_PURGE_ANSWER_INVALID',
  AUDIT_PURGE_FORECAST_MISMATCH: 'AUDIT_PURGE_FORECAST_MISMATCH',
  AUDIT_RESEAL_ANSWER_INVALID: 'AUDIT_RESEAL_ANSWER_INVALID',
  // The event writer.
  EVENT_ENTRY_INVALID: 'EVENT_ENTRY_INVALID',
  EVENT_TYPE_UNKNOWN: 'EVENT_TYPE_UNKNOWN',
  EVENT_SEVERITY_INVALID: 'EVENT_SEVERITY_INVALID',
  EVENT_REFERENCE_INVALID: 'EVENT_REFERENCE_INVALID',
  EVENT_MESSAGE_INVALID: 'EVENT_MESSAGE_INVALID',
  EVENT_PARAMS_NOT_FLAT: 'EVENT_PARAMS_NOT_FLAT',
  EVENT_PARAM_KEY_FORBIDDEN: 'EVENT_PARAM_KEY_FORBIDDEN',
  EVENT_PARAM_VALUE_INVALID: 'EVENT_PARAM_VALUE_INVALID',
  EVENT_TEXT_INVALID: 'EVENT_TEXT_INVALID',
  EVENT_SECRET_SHAPED_VALUE: 'EVENT_SECRET_SHAPED_VALUE',
  EVENT_ROW_INVALID: 'EVENT_ROW_INVALID',
  EVENT_COUNTER_MISSING: 'EVENT_COUNTER_MISSING',
} as const;
export type CoreErrorCode = (typeof CoreErrorCode)[keyof typeof CoreErrorCode];

/** A rule of the core services was broken by the calling code. See the header of this file. */
export class CoreError extends Error {
  readonly code: CoreErrorCode;

  /** `message` is a fixed text chosen by the core services. It never quotes a value. */
  constructor(code: CoreErrorCode, message: string, cause?: unknown) {
    super(message, cause === undefined ? undefined : { cause });
    this.name = 'CoreError';
    this.code = code;
  }
}

/** SQLSTATE values the core services name (database contract §6.3; PG-07). */
export const SqlState = {
  /** A row that does not continue the audit chain, or a writer that skipped the lock. */
  CHAIN_DISCONTINUITY: 'ZA001',
  /** UPDATE, DELETE or TRUNCATE on an append-only table. */
  APPEND_ONLY: 'ZA002',
  /** The server cancelled a statement: here, because it ran past the unit's statement limit. */
  QUERY_CANCELED: '57014',
} as const;

/** Class 08 of SQLSTATE: connection exceptions (the connection does not exist, it failed, ...). */
const CONNECTION_EXCEPTION = /^08[0-9A-Z]{3}$/;
/** The server is going away or is not accepting work: admin shutdown, crash shutdown, cannot connect now. */
const SERVER_GONE: ReadonlySet<string> = new Set(['57P01', '57P02', '57P03']);
/** What the driver reports when the socket itself fails. */
const SOCKET_FAILURES: ReadonlySet<string> = new Set([
  'ECONNRESET',
  'ECONNREFUSED',
  'ECONNABORTED',
  'EPIPE',
  'ETIMEDOUT',
  'ENOTCONN',
  'EHOSTUNREACH',
  'ENETUNREACH',
  'ENETDOWN',
]);

/** True when `code` says that the connection or the server went away, not that a statement was wrong. */
export function isConnectionFailureCode(code: string | undefined): boolean {
  return code !== undefined && (CONNECTION_EXCEPTION.test(code) || SERVER_GONE.has(code) || SOCKET_FAILURES.has(code));
}

/**
 * True when a failure means "the connection or the server went away": SQLSTATE class 08, 57P01
 * to 57P03, or a socket error of the driver. The code is read as `sqlStateOf` reads it, so a
 * failure that the query builder wrapped is recognised too. A failure without a code is not
 * recognised here: the unit of work knows such a loss from the `error` event of its connection.
 */
export function isConnectionFailure(error: unknown): boolean {
  return isConnectionFailureCode(sqlStateOf(error));
}

/**
 * The driver's own error behind a failure. The driver puts `code` on the error itself; the query
 * builder (drizzle-orm) wraps it in an error whose MESSAGE quotes the statement and its
 * parameters, with the driver's error as `cause` (decision D38). The writers hand on the
 * driver's error, never the wrapper: a parameter of theirs is the content of a row.
 */
export function driverErrorOf(error: unknown): unknown {
  let current: unknown = error;
  for (let depth = 0; depth < 4 && typeof current === 'object' && current !== null; depth += 1) {
    const candidate = current as { code?: unknown; cause?: unknown };
    if (typeof candidate.code === 'string') return current;
    current = candidate.cause;
  }
  return error;
}

/**
 * The SQLSTATE of a failure. The driver puts `code` on the error itself; drizzle-orm wraps the
 * driver's error, so the same field is on `error.cause` (decision D38).
 */
export function sqlStateOf(error: unknown): string | undefined {
  let current: unknown = error;
  for (let depth = 0; depth < 4 && typeof current === 'object' && current !== null; depth += 1) {
    const candidate = current as { code?: unknown; cause?: unknown };
    if (typeof candidate.code === 'string') return candidate.code;
    current = candidate.cause;
  }
  return undefined;
}
