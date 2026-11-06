// Response headers (plan row W08; OR-9, SR-76; AC-B-14 in unit form; assumption SA-13): every
// answer, success or error, carries the five headers with their exact values, the request ID
// under the name the shared contract pins (contract A; decision D55), and nothing else. No
// `Strict-Transport-Security`, no CORS header.
import { REQUEST_ID_HEADER_NAME } from '@dems/shared/api';
import type { FastifyInstance, InjectOptions } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../../../app';
import { BODY_LIMIT_BYTES } from '../../../config';
import { captureLog, unitTestConfig } from '../../../../test/support/config';
import { ApiFailure } from '../../error-envelope';
import {
  CONTENT_SECURITY_POLICY_DIRECTIVES,
  FORBIDDEN_RESPONSE_HEADERS,
  HELMET_OPTIONS,
  RESPONSE_HEADERS,
} from '../index';

/** What a response may carry besides the five and the request ID: set by Fastify, Node or an answer itself. */
const TRANSPORT_HEADERS = ['content-type', 'content-length', 'date', 'connection', 'allow', 'retry-after'];

/** The server's request IDs are UUIDs (version 4): 36 characters, none of them from the request. */
const REQUEST_ID_FORMAT = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

let app: FastifyInstance;

interface Case {
  readonly label: string;
  readonly status: number;
  readonly request: InjectOptions;
}

const json = { 'content-type': 'application/json' };

const CASES: readonly Case[] = [
  { label: 'the health operation', status: 200, request: { method: 'GET', url: '/api/v1/health' } },
  { label: 'a POST that succeeds', status: 200, request: { method: 'POST', url: '/api/v1/echo', payload: { a: 1 } } },
  { label: 'an unknown path', status: 404, request: { method: 'GET', url: '/api/v1/nope' } },
  { label: 'another method', status: 405, request: { method: 'DELETE', url: '/api/v1/health' } },
  { label: 'a URL that cannot be decoded', status: 400, request: { method: 'GET', url: '/api/v1/%E0%A4%A' } },
  {
    label: 'malformed JSON',
    status: 400,
    request: { method: 'POST', url: '/api/v1/echo', headers: json, payload: '{"a": ' },
  },
  {
    label: 'a body over the limit',
    status: 413,
    request: { method: 'POST', url: '/api/v1/echo', headers: json, payload: JSON.stringify({ a: 'x'.repeat(BODY_LIMIT_BYTES) }) },
  },
  { label: 'a refusal thrown by a handler', status: 409, request: { method: 'GET', url: '/api/v1/refused' } },
  { label: 'an unexpected failure', status: 500, request: { method: 'GET', url: '/api/v1/boom' } },
  { label: 'a refusal by a request stage', status: 503, request: { method: 'GET', url: '/api/v1/guarded' } },
];

/** The scratch routes of `CASES`, and one with a path parameter. */
function addScratchRoutes(instance: FastifyInstance): void {
  instance.post('/api/v1/echo', async (request) => ({ body: request.body }));
  instance.post('/api/v1/echo/:id', async (request) => ({ body: request.body }));
  instance.get('/api/v1/refused', async () => {
    throw new ApiFailure(409, 'INVALID_STATE', 'Not in that state.');
  });
  instance.get('/api/v1/boom', async () => {
    throw new Error('boom');
  });
  instance.get('/api/v1/guarded', { config: { operationId: 'guarded' } }, async () => ({}));
}

/** Only `/api/v1/guarded` is refused at stage 2. */
function refuseGuardedAtReadiness(instance: FastifyInstance): void {
  instance.stages.replace('readiness', (request) => {
    if (request.routeOptions.config.operationId === 'guarded') {
      throw new ApiFailure(503, 'NOT_READY', 'The server is not ready. Try again shortly.');
    }
  });
}

/** `error.requestId` of an answer, or undefined when the answer is not an error envelope. */
function envelopeRequestId(response: { json: () => unknown }): string | undefined {
  const body = response.json() as { error?: { requestId?: string } };
  return body.error?.requestId;
}

beforeAll(async () => {
  app = buildApp({ config: unitTestConfig() });
  addScratchRoutes(app);
  await app.ready();
  // By-design change (plan row W28): not about stage 6; a scratch route is no registry operation.
  app.stages.replace('accessRule', () => {});
  refuseGuardedAtReadiness(app);
});

afterAll(() => app.close());

describe('the header set of OR-9', () => {
  it('is these five values', () => {
    expect(RESPONSE_HEADERS).toEqual({
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
      'content-security-policy': "default-src 'none'; frame-ancestors 'none'",
      'cross-origin-resource-policy': 'same-origin',
      'referrer-policy': 'no-referrer',
    });
  });

  it.each(CASES)(
    '$label ($status) carries the five headers, the request ID and nothing else',
    async ({ status, request }) => {
      const response = await app.inject(request);
      expect(response.statusCode).toBe(status);
      for (const [name, value] of Object.entries(RESPONSE_HEADERS)) expect(response.headers[name], name).toBe(value);
      for (const name of FORBIDDEN_RESPONSE_HEADERS) expect(response.headers[name], name).toBeUndefined();
      expect(response.headers[REQUEST_ID_HEADER_NAME]).toMatch(REQUEST_ID_FORMAT);
      const others = Object.keys(response.headers).filter(
        (name) => !(name in RESPONSE_HEADERS) && name !== REQUEST_ID_HEADER_NAME && !TRANSPORT_HEADERS.includes(name),
      );
      expect(others).toEqual([]);
      expect(response.headers['content-type']).toBe('application/json; charset=utf-8');
    },
  );

  it('no answer carries Strict-Transport-Security or a CORS header, whatever the Origin', async () => {
    for (const origin of ['http://127.0.0.1:5173', 'http://evil.example', 'null']) {
      for (const { request } of CASES) {
        const response = await app.inject({ ...request, headers: { ...request.headers, origin } });
        const names = Object.keys(response.headers);
        expect(names).not.toContain('strict-transport-security');
        expect(names.filter((name) => name.startsWith('access-control-'))).toEqual([]);
      }
    }
  });

  it('a preflight request is not answered: there is no CORS plugin (SR-04)', async () => {
    const response = await app.inject({
      method: 'OPTIONS',
      url: '/api/v1/health',
      headers: { origin: 'http://127.0.0.1:5173', 'access-control-request-method': 'POST' },
    });
    expect(response.statusCode).toBe(405);
    expect(Object.keys(response.headers).filter((name) => name.startsWith('access-control-'))).toEqual([]);
  });
});

describe('the request ID header (contract A; decision D55)', () => {
  // Its own app: a captured log, and the guard stages replaced by no-ops, because this is about
  // the header and the log, not about who may call.
  const log = captureLog();
  let quiet: FastifyInstance;

  function requestLines(id: unknown): Array<Record<string, unknown>> {
    return log.lines().filter((line) => line.msg === 'request completed' && line.reqId === id);
  }

  beforeAll(async () => {
    quiet = buildApp({ config: unitTestConfig({ logLevel: 'info' }), logStream: log.stream });
    addScratchRoutes(quiet);
    await quiet.ready();
    refuseGuardedAtReadiness(quiet);
    for (const stage of ['originGuard', 'authenticate', 'throttle', 'accessRule'] as const) {
      quiet.stages.replace(stage, () => {});
    }
  });

  afterAll(() => quiet.close());

  it('has the name the shared contract pins', () => {
    expect(REQUEST_ID_HEADER_NAME).toBe('x-request-id');
  });

  it.each(CASES)(
    '$label ($status): the header is the ID of the request, in the answer and in the log',
    async ({ status, request }) => {
      const response = await quiet.inject(request);
      expect(response.statusCode).toBe(status);

      // The format the contract states: a non-empty string. The server's own: a UUID.
      const id = response.headers[REQUEST_ID_HEADER_NAME];
      expect(typeof id).toBe('string');
      expect(String(id).length).toBeGreaterThanOrEqual(1);
      expect(id).toMatch(REQUEST_ID_FORMAT);

      // An error envelope repeats it; a success has no envelope, so the header is its only place.
      if (status >= 400) expect(envelopeRequestId(response)).toBe(id);
      else expect(envelopeRequestId(response)).toBeUndefined();

      // The correlation key: exactly one request line of the log has this ID, with this status.
      const lines = requestLines(id);
      expect(lines).toHaveLength(1);
      expect(lines[0]?.status).toBe(status);
    },
  );

  it('is made by the server: a request ID sent by the caller is never echoed, in any answer', async () => {
    const CALLER = 'chosen-by-caller-MARK-7c1e9a';
    const callerHeaders = { 'x-request-id': CALLER, 'request-id': CALLER, 'x-correlation-id': CALLER };

    const success = await quiet.inject({
      method: 'POST',
      url: `/api/v1/echo/${CALLER}?requestId=${CALLER}`,
      headers: callerHeaders,
      payload: { requestId: CALLER },
    });
    const refused = await quiet.inject({ method: 'GET', url: '/api/v1/refused', headers: callerHeaders });
    const unknown = await quiet.inject({ method: 'GET', url: '/api/v1/nope', headers: callerHeaders });
    const undecodable = await quiet.inject({ method: 'GET', url: '/api/v1/%E0%A4%A', headers: callerHeaders });
    expect([success, refused, unknown, undecodable].map((response) => response.statusCode)).toEqual([200, 409, 404, 400]);

    for (const response of [success, refused, unknown, undecodable]) {
      const id = String(response.headers[REQUEST_ID_HEADER_NAME]);
      // A UUID from start to end, so it holds nothing of the request: no header, path, query or body value.
      expect(id).toMatch(REQUEST_ID_FORMAT);
      expect(id).not.toContain(CALLER);
      // The caller's value is not sent back under any header name either.
      expect(Object.values(response.headers).map(String).filter((value) => value.includes(CALLER))).toEqual([]);
      // And the log knows the request by the server's ID, not by the caller's.
      expect(requestLines(id)).toHaveLength(1);
    }
    for (const response of [refused, unknown, undecodable]) {
      expect(envelopeRequestId(response)).toBe(response.headers[REQUEST_ID_HEADER_NAME]);
    }
    expect(log.text()).not.toContain(CALLER);
  });

  it('is different for every request', async () => {
    const responses = await Promise.all(
      Array.from({ length: 50 }, () => quiet.inject({ method: 'GET', url: '/api/v1/health' })),
    );
    const ids = responses.map((response) => response.headers[REQUEST_ID_HEADER_NAME]);
    expect(new Set(ids).size).toBe(50);
    for (const id of ids) expect(id).toMatch(REQUEST_ID_FORMAT);
  });
});

describe('the helmet options (SA-13)', () => {
  it('switch Strict-Transport-Security off and every default that OR-9 does not list', () => {
    expect(HELMET_OPTIONS.strictTransportSecurity).toBe(false);
    const off = [
      'crossOriginEmbedderPolicy',
      'crossOriginOpenerPolicy',
      'originAgentCluster',
      'xDnsPrefetchControl',
      'xDownloadOptions',
      'xFrameOptions',
      'xPermittedCrossDomainPolicies',
      'xPoweredBy',
      'xXssProtection',
    ] as const;
    for (const name of off) expect(HELMET_OPTIONS[name], name).toBe(false);
  });

  it('give helmet the same policy that the header states', () => {
    // helmet writes `default-src 'none';frame-ancestors 'none'`; OR-9 has a space after the
    // semicolon. Compared without it, the directives and the header text are the same policy.
    const fromDirectives = Object.entries(CONTENT_SECURITY_POLICY_DIRECTIVES)
      .map(([name, values]) => `${name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)} ${values.join(' ')}`)
      .join(';');
    expect(fromDirectives).toBe("default-src 'none';frame-ancestors 'none'");
    expect(RESPONSE_HEADERS['content-security-policy'].replaceAll('; ', ';')).toBe(fromDirectives);
  });
});
