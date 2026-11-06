/**
 * The fields of a request log line (SR-49): method, route pattern, status, duration, request ID
 * and a principal reference. The raw URL is never among them, so the log is safe whatever a
 * caller puts into a query string or a path parameter.
 *
 * This folder and `plugins/error-envelope` are the only places in the server that read the raw
 * request URL; a static test keeps it that way.
 */
import type { FastifyReply, FastifyRequest } from 'fastify';
import type { Principal } from '../authenticate';

/** Longest unmatched path that is logged; the rest is cut. */
const UNMATCHED_PATH_MAX_LENGTH = 200;

function withoutControlCharacters(text: string): string {
  let out = '';
  for (const char of text) {
    const code = char.codePointAt(0) ?? 0;
    if (code > 0x1f && code !== 0x7f) out += char;
  }
  return out;
}

/** The path of a raw URL: no query string, no fragment, no control character, bounded length. */
export function pathWithoutQuery(rawUrl: string | undefined): string {
  const url = rawUrl ?? '';
  const cut = url.search(/[?#]/);
  const path = cut >= 0 ? url.slice(0, cut) : url;
  return withoutControlCharacters(path).slice(0, UNMATCHED_PATH_MAX_LENGTH);
}

// Two facts about a request that are known before its log line is written: the pattern of a
// known path that was called with another method (405), and the error code of a refusal. A
// WeakMap needs no request decorator and holds nothing after the request object is gone.
const knownPatterns = new WeakMap<FastifyRequest, string>();
const failureCodes = new WeakMap<FastifyRequest, string>();

/** Called by the not-found handler for a 405: the log then holds the pattern, not the path. */
export function noteRoutePattern(request: FastifyRequest, pattern: string): void {
  knownPatterns.set(request, pattern);
}

/** Called by the error envelope: the request line then carries the code, and only the code (SR-48). */
export function noteFailureCode(request: FastifyRequest, code: string): void {
  failureCodes.set(request, code);
}

/**
 * The registry's route pattern, for example `/api/v1/session/:id/start`. For a path that
 * matched no route: the path without its query string (SR-49).
 */
export function routeOf(request: FastifyRequest): string {
  const pattern = request.routeOptions?.url;
  if (!request.is404 && typeof pattern === 'string') return pattern;
  return knownPatterns.get(request) ?? pathWithoutQuery(request.raw.url);
}

/**
 * A principal reference that is safe to log: an operator ID or a device ID, in the form of the
 * throttle keys (`operator:<id>`, `device:<id>`). Null for an anonymous caller.
 */
export function principalReference(principal: Principal | null | undefined): string | null {
  if (principal === null || principal === undefined) return null;
  if (principal.kind === 'OPERATOR') return `operator:${principal.operatorId}`;
  if (principal.kind === 'DEVICE') return `device:${principal.deviceId}`;
  return null;
}

export interface RequestLogLine {
  readonly method: string;
  readonly route: string;
  readonly status: number;
  readonly durationMs: number;
  readonly principal: string | null;
  readonly code?: string;
}

export function requestLogLine(request: FastifyRequest, reply: FastifyReply): RequestLogLine {
  const code = failureCodes.get(request);
  return {
    method: request.method,
    route: routeOf(request),
    status: reply.statusCode,
    durationMs: Math.round(reply.elapsedTime),
    // Absent on a request that never reached the first hook (a malformed URL).
    principal: principalReference(request.principal ?? null),
    ...(code === undefined ? {} : { code }),
  };
}
