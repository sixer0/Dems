/**
 * Response headers of the Core server (spec §14.2 OR-9; SR-76; assumption SA-13; contract A).
 *
 * Every answer, success or error, carries the five headers of OR-9:
 *
 *   Cache-Control: no-store
 *   X-Content-Type-Options: nosniff
 *   Content-Security-Policy: default-src 'none'; frame-ancestors 'none'
 *   Cross-Origin-Resource-Policy: same-origin
 *   Referrer-Policy: no-referrer
 *
 * and the request ID, under the header name the shared contract pins (`x-request-id`):
 *
 *   x-request-id: <the ID of this request>
 *
 * It is the ID the server made for the request (a UUID; never a value of an incoming header),
 * the `reqId` of the request's log lines, and the `error.requestId` of an error envelope. A
 * client can so name a request, successful or not, and an operator can find it in the log.
 *
 * `@fastify/helmet` 13.1.1 sets four of them in its `onRequest` hook, so a refusal raised by a
 * later hook already has them. One `onSend` hook adds `Cache-Control`. `Strict-Transport-Security`
 * is switched off (plain HTTP on loopback, no TLS), and so is every other helmet default: this
 * server answers JSON only and sends nothing that those headers govern.
 *
 * Outcome of SA-13: helmet 8.3.0 writes the policy as `default-src 'none';frame-ancestors 'none'`,
 * without the space that OR-9 has after the semicolon. It is the same policy. The `onSend` hook
 * states it again with the text of OR-9, so that the header equals the specification
 * byte for byte; a test keeps the directives given to helmet and that text in step.
 *
 * This governs the Core server's own answers only. The packaged content-security policy of the
 * web console is another file and is not touched (OR-6).
 */
import { REQUEST_ID_HEADER_NAME } from '@dems/shared/api';
import helmet, { type FastifyHelmetOptions } from '@fastify/helmet';
import type { FastifyPluginAsync, FastifyReply } from 'fastify';

export const CONTENT_SECURITY_POLICY_DIRECTIVES = {
  defaultSrc: ["'none'"],
  frameAncestors: ["'none'"],
};

/** The five headers of OR-9 with their exact values (lower-case names, as Node reports them). */
export const RESPONSE_HEADERS = {
  'cache-control': 'no-store',
  'x-content-type-options': 'nosniff',
  'content-security-policy': "default-src 'none'; frame-ancestors 'none'",
  'cross-origin-resource-policy': 'same-origin',
  'referrer-policy': 'no-referrer',
} as const;

/** Headers this server never sends (no TLS; no CORS plugin, SR-04). */
export const FORBIDDEN_RESPONSE_HEADERS = ['strict-transport-security'] as const;

export const HELMET_OPTIONS: FastifyHelmetOptions = {
  global: true,
  contentSecurityPolicy: { useDefaults: false, directives: CONTENT_SECURITY_POLICY_DIRECTIVES },
  crossOriginResourcePolicy: { policy: 'same-origin' },
  referrerPolicy: { policy: 'no-referrer' },
  xContentTypeOptions: true,
  // Off: there is no TLS on loopback.
  strictTransportSecurity: false,
  // Off: defaults of helmet that OR-9 does not list.
  crossOriginEmbedderPolicy: false,
  crossOriginOpenerPolicy: false,
  originAgentCluster: false,
  xDnsPrefetchControl: false,
  xDownloadOptions: false,
  xFrameOptions: false,
  xPermittedCrossDomainPolicies: false,
  xPoweredBy: false,
  xXssProtection: false,
};

/**
 * Sets the five headers and the request ID on one reply. For the one answer that passes no hook
 * at all: a request whose URL the router cannot decode (400 `INVALID_PATH`).
 */
export function applyResponseHeaders(reply: FastifyReply): void {
  reply.headers(RESPONSE_HEADERS);
  reply.header(REQUEST_ID_HEADER_NAME, reply.request.id);
}

export const responseHeadersPlugin: FastifyPluginAsync = async (app) => {
  await app.register(helmet, HELMET_OPTIONS);

  app.addHook('onSend', async (request, reply) => {
    reply.header('cache-control', RESPONSE_HEADERS['cache-control']);
    reply.header('content-security-policy', RESPONSE_HEADERS['content-security-policy']);
    // The server's own ID of the request (`genReqId` in the app factory), on every answer.
    reply.header(REQUEST_ID_HEADER_NAME, request.id);
  });
};
