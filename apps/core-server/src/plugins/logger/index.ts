/**
 * The server's logging (plan row W08; SR-48, SR-49, SR-50):
 *   - `buildLoggerOptions`: options of Fastify's built-in logger (serializers, the formatter that
 *     makes every error safe at every key, redaction, hook);
 *   - `describeError`, `codedCauseOf`: the safe description of a thrown value, and the one walk
 *     over a `cause` chain (the query builder wraps the driver's error);
 *   - `CoreLogController`: one request line with the route pattern, never the raw URL;
 *   - `createErrorLog`: the persistent error log.
 *
 * The logger is configured when the Fastify instance is created, so the app factory calls these
 * directly; there is no plugin to register. Every module logs through `request.log` or
 * `app.log` and never through the console, which would bypass all of this.
 */
export {
  CAUSE_CHAIN_DEPTH,
  DEFAULT_ERROR_LOG_FILE,
  ERROR_LOG_ROTATE_BYTES,
  codedCauseOf,
  createErrorLog,
  describeError,
  rotatedErrorLogFile,
  type CodedCause,
  type ErrorDescription,
  type ErrorLog,
  type ErrorLogContext,
  type ErrorLogEntry,
  type ErrorLogOptions,
} from './error-log';
export { CoreLogController } from './log-controller';
export {
  LOG_DEPTH_LIMIT,
  LOG_MEMBER_LIMIT,
  NOT_LOGGED,
  REDACTED,
  REDACT_PATHS,
  buildLoggerOptions,
  loggedError,
  safeLogObject,
  scrubMessage,
  type LogStream,
  type LoggedError,
  type LoggerOptions,
  type LoggerOptionsInput,
} from './logger-options';
export {
  noteFailureCode,
  noteRoutePattern,
  pathWithoutQuery,
  principalReference,
  requestLogLine,
  routeOf,
  type RequestLogLine,
} from './request-log';
