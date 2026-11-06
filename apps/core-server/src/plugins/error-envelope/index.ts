/**
 * Error envelope plugin (plan row W08; spec §7.2, §7.3; SR-48, SR-50, SR-64).
 *
 * It owns every answer that is not a handler's success:
 *   - stage 1 of the pipeline (routing): 400 `INVALID_PATH`, 404 `NOT_FOUND`,
 *     405 `METHOD_NOT_ALLOWED` with `allow`;
 *   - stage 7 (parsing and validation): 413 `PAYLOAD_TOO_LARGE`, 400 `INVALID_JSON`,
 *     422 `INVALID_INPUT`;
 *   - every `ApiFailure` thrown by a stage, a handler or a unit of work;
 *   - anything else: 500 `INTERNAL_ERROR` with no detail.
 *
 * Logging: a refusal puts its code on the request line and nothing more. A parse or validation
 * failure is logged by its code only, never with the parser's message. An unexpected failure is
 * written to the log and to the persistent error log with its name, code and stack frames.
 *
 * Other rows import `ApiFailure` from here and throw it; they do not build error bodies.
 */
import type { FastifyError, FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import {
  describeError,
  noteFailureCode,
  noteRoutePattern,
  pathWithoutQuery,
  requestLogLine,
  routeOf,
} from '../logger';
import { applyResponseHeaders } from '../response-headers';
import {
  ApiFailure,
  errorBody,
  internalError,
  invalidInput,
  invalidJson,
  invalidPath,
  methodNotAllowed,
  notFound,
  payloadTooLarge,
} from './api-failure';
import { installJsonBodyParser } from './json-body';
import type { RouteTable } from './route-table';

export {
  ApiFailure,
  EnvelopeCode,
  errorBody,
  internalError,
  invalidInput,
  invalidJson,
  invalidPath,
  methodNotAllowed,
  NOT_SIGNED_IN_TEXT,
  notFound,
  notReady,
  payloadTooLarge,
  type ApiFailureOptions,
  type ErrorBody,
  type ErrorDetails,
} from './api-failure';
export { createRouteTable, patternToRegExp, type KnownPath, type RouteTable } from './route-table';

const UNEXPECTED = 'unexpected error while handling a request';

function codeOf(error: unknown): string | undefined {
  return typeof error === 'object' && error !== null && 'code' in error && typeof error.code === 'string'
    ? error.code
    : undefined;
}

function validationContextOf(error: unknown): string | undefined {
  return typeof error === 'object' &&
    error !== null &&
    'validationContext' in error &&
    typeof error.validationContext === 'string'
    ? error.validationContext
    : undefined;
}

function isValidationError(error: unknown): boolean {
  return (
    codeOf(error) === 'FST_ERR_VALIDATION' ||
    (typeof error === 'object' && error !== null && 'validation' in error && Array.isArray(error.validation))
  );
}

export interface Classified {
  readonly failure: ApiFailure;
  /** True when the thrown value was neither an `ApiFailure` nor a known parse or validation error. */
  readonly unexpected: boolean;
}

/** Maps a thrown value to the answer the caller gets (spec §7.2, §7.3 line 8). */
export function classify(error: unknown): Classified {
  if (error instanceof ApiFailure) return { failure: error, unexpected: false };
  const code = codeOf(error);
  if (code === 'FST_ERR_CTP_BODY_TOO_LARGE') return { failure: payloadTooLarge(), unexpected: false };
  // Every other content-type-parser error: malformed JSON, an empty or mis-sized body, a media
  // type other than JSON. In each case the body is not a JSON object.
  if (code?.startsWith('FST_ERR_CTP_')) return { failure: invalidJson(), unexpected: false };
  if (isValidationError(error)) return { failure: invalidInput(validationContextOf(error)), unexpected: false };
  return { failure: internalError(error), unexpected: true };
}

/** Writes an unexpected failure to the log and to the persistent error log. */
function reportUnexpected(error: unknown, request: FastifyRequest): void {
  request.log.error({ err: error }, UNEXPECTED);
  request.server.errorLog.append({
    level: 'error',
    source: 'error-envelope.errorHandler',
    message: UNEXPECTED,
    ...describeError(error),
    context: { requestId: request.id, method: request.method, route: routeOf(request) },
  });
}

export function sendFailure(request: FastifyRequest, reply: FastifyReply, failure: ApiFailure): FastifyReply {
  noteFailureCode(request, failure.code);
  if (failure.headers !== undefined) reply.headers(failure.headers);
  return reply.code(failure.statusCode).send(errorBody(request, failure));
}

/**
 * Fastify's `frameworkErrors` option: a URL the router cannot decode, or a path parameter over
 * the length limit. No hook runs on this path and Fastify writes no completion line for it, so
 * the response headers are set and the request line is written here.
 */
export function handleFrameworkError(error: FastifyError, request: FastifyRequest, reply: FastifyReply): void {
  applyResponseHeaders(reply);
  const badPath = error.code === 'FST_ERR_BAD_URL' || error.code === 'FST_ERR_MAX_PARAM_LENGTH';
  if (!badPath) reportUnexpected(error, request);
  sendFailure(request, reply, badPath ? invalidPath() : internalError(error));
  request.log.info(requestLogLine(request, reply), 'request completed');
}

export interface ErrorEnvelopeOptions {
  /** Filled by the `onRoute` hook that the app factory installs before any route exists. */
  readonly routeTable: RouteTable;
}

export const errorEnvelopePlugin: FastifyPluginAsync<ErrorEnvelopeOptions> = async (app, options) => {
  installJsonBodyParser(app);

  app.setNotFoundHandler((request, reply) => {
    const known = options.routeTable.lookup(pathWithoutQuery(request.raw.url));
    if (known === null) return sendFailure(request, reply, notFound());
    noteRoutePattern(request, known.pattern);
    return sendFailure(request, reply, methodNotAllowed(request.method, known.methods));
  });

  app.setErrorHandler((error, request, reply) => {
    const { failure, unexpected } = classify(error);
    if (unexpected) reportUnexpected(error, request);
    return sendFailure(request, reply, failure);
  });
};
