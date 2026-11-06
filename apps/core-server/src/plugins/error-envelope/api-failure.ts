/**
 * The error envelope (spec §7.2): `{ error: { code, message, details?, requestId } }`.
 *
 * `ApiFailure` is how every part of the server refuses a request: a pipeline stage, a handler
 * or a unit of work throws one, and the error handler of this folder turns it into the answer.
 * Anything else that is thrown is an unexpected failure and answers the generic
 * 500 `INTERNAL_ERROR` with no detail (SR-50).
 */
import { ApiErrorCode } from '@dems/shared/api';
import type { FastifyRequest } from 'fastify';
import { BODY_LIMIT_BYTES } from '../../config';

/** A flat map, the form of audit details (spec §7.2). */
export type ErrorDetails = Readonly<Record<string, string | number | boolean | null>>;

export interface ApiFailureOptions {
  readonly details?: ErrorDetails;
  /** Response headers that belong to the answer, for example `allow` or `retry-after`. */
  readonly headers?: Readonly<Record<string, string>>;
  readonly cause?: unknown;
}

export class ApiFailure extends Error {
  readonly statusCode: number;
  /**
   * Machine-readable code, for example `NOT_PERMITTED`. Its type is the error-code vocabulary of
   * the shared contract (`ApiErrorCode` of `@dems/shared/api`; review finding CPB1-9): a code
   * that no client knows does not compile.
   */
  readonly code: ApiErrorCode;
  readonly details: ErrorDetails | undefined;
  readonly headers: Readonly<Record<string, string>> | undefined;

  /** `message` is operator-safe English text. It never holds a credential or a part of the input. */
  constructor(statusCode: number, code: ApiErrorCode, message: string, options: ApiFailureOptions = {}) {
    super(message, options.cause === undefined ? undefined : { cause: options.cause });
    this.name = 'ApiFailure';
    this.statusCode = statusCode;
    this.code = code;
    this.details = options.details;
    this.headers = options.headers;
  }
}

/**
 * The codes that are defined once at envelope level, not per operation (spec §7.2). Each is the
 * contract's own value: a name that the contract does not have, or a value that differs from
 * it, does not compile.
 */
export const EnvelopeCode = {
  INVALID_PATH: ApiErrorCode.INVALID_PATH,
  NOT_FOUND: ApiErrorCode.NOT_FOUND,
  METHOD_NOT_ALLOWED: ApiErrorCode.METHOD_NOT_ALLOWED,
  PAYLOAD_TOO_LARGE: ApiErrorCode.PAYLOAD_TOO_LARGE,
  INVALID_JSON: ApiErrorCode.INVALID_JSON,
  INVALID_INPUT: ApiErrorCode.INVALID_INPUT,
  INTERNAL_ERROR: ApiErrorCode.INTERNAL_ERROR,
  NOT_READY: ApiErrorCode.NOT_READY,
} as const satisfies Readonly<Record<string, ApiErrorCode>>;
export type EnvelopeCode = (typeof EnvelopeCode)[keyof typeof EnvelopeCode];

export const invalidPath = (): ApiFailure =>
  new ApiFailure(400, EnvelopeCode.INVALID_PATH, 'The request path is not valid.');

export const notFound = (): ApiFailure => new ApiFailure(404, EnvelopeCode.NOT_FOUND, 'No such endpoint.');

export const methodNotAllowed = (method: string, allowed: readonly string[]): ApiFailure =>
  new ApiFailure(405, EnvelopeCode.METHOD_NOT_ALLOWED, `${method} is not allowed on this endpoint.`, {
    headers: { allow: allowed.join(', ') },
  });

export const payloadTooLarge = (): ApiFailure =>
  new ApiFailure(
    413,
    EnvelopeCode.PAYLOAD_TOO_LARGE,
    `The request body is larger than ${BODY_LIMIT_BYTES} bytes.`,
  );

export const invalidJson = (): ApiFailure =>
  new ApiFailure(400, EnvelopeCode.INVALID_JSON, 'The request body must be a JSON object.');

/** `where` is the part of the request that failed its schema: body, params, querystring or headers. */
export const invalidInput = (where: string | undefined): ApiFailure =>
  new ApiFailure(
    422,
    EnvelopeCode.INVALID_INPUT,
    'The request does not match the expected input.',
    where === undefined ? {} : { details: { in: where } },
  );

export const internalError = (cause?: unknown): ApiFailure =>
  new ApiFailure(500, EnvelopeCode.INTERNAL_ERROR, 'The server could not complete the request.', { cause });

/**
 * The one text of `401 NOT_SIGNED_IN` for a caller without an operator, wherever the server
 * refuses it: stage 4, the engine's backstop and the hosted actions' refusal table, and the
 * modules' own refusals (review findings CPB1-18, W91-5). It is the text of the contract's
 * examples and of the simulator's API (`packages/shared/src/sim/api.ts`), so a client sees one
 * message for one condition.
 */
export const NOT_SIGNED_IN_TEXT = 'Sign in first.';

export const notReady = (): ApiFailure =>
  new ApiFailure(503, EnvelopeCode.NOT_READY, 'The server is not ready. Try again shortly.');

export interface ErrorBody {
  readonly error: {
    readonly code: ApiErrorCode;
    readonly message: string;
    readonly details?: ErrorDetails;
    readonly requestId: string;
  };
}

export function errorBody(request: FastifyRequest, failure: ApiFailure): ErrorBody {
  return {
    error: {
      code: failure.code,
      message: failure.message,
      ...(failure.details === undefined ? {} : { details: failure.details }),
      requestId: request.id,
    },
  };
}
