// Error envelope (plan row W08; spec §7.2, §7.3; SR-50, SR-64; AC-B-14 in unit form): every
// answer that is not a handler's success has the envelope, validates against the shared
// `ApiErrorSchema`, and shows no stack trace and no internal message.
import { ApiErrorSchema } from '@dems/shared/api';
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { buildApp } from '../../../app';
import { BODY_LIMIT_BYTES } from '../../../config';
import { unitTestConfig } from '../../../../test/support/config';
import { ApiFailure, classify, createRouteTable, patternToRegExp } from '../index';

const INTERNAL_MARKER = 'MARK-internal-63a0f2';

let app: FastifyInstance;

interface Envelope {
  error: { code: string; message: string; details?: Record<string, unknown>; requestId: string };
}

function envelope(response: { json: () => unknown; body: string }): Envelope['error'] {
  const body = response.json() as Envelope;
  // The shared schema accepts the body (the two new members are additive and optional).
  expect(ApiErrorSchema.safeParse(body).success).toBe(true);
  expect(Object.keys(body)).toEqual(['error']);
  expect(typeof body.error.requestId).toBe('string');
  expect(response.body).not.toContain('    at ');
  expect(response.body).not.toContain(INTERNAL_MARKER);
  return body.error;
}

beforeAll(async () => {
  app = buildApp({ config: unitTestConfig() });
  const typed = app.withTypeProvider<ZodTypeProvider>();

  typed.post(
    '/api/v1/thing/:id/start',
    {
      schema: {
        params: z.object({ id: z.string().regex(/^T-[0-9]+$/) }),
        body: z.object({ reason: z.string().min(5).optional(), count: z.int().optional() }),
      },
    },
    async (request) => ({ id: request.params.id, body: request.body }),
  );
  typed.get('/api/v1/thing/:id', async (request) => ({ id: (request.params as { id: string }).id }));
  typed.post('/api/v1/thing', async (request) => ({ body: request.body ?? null }));
  typed.get('/api/v1/thing', async () => ({ list: [] }));
  app.get('/api/v1/boom', async () => {
    throw new Error(`select * from operators failed: ${INTERNAL_MARKER}`);
  });
  app.get('/api/v1/refused', async () => {
    throw new ApiFailure(409, 'SESSION_ACTIVE', 'A session is already active.', {
      details: { simCode: 'SESSION_ACTIVE', retryInMs: 1500, locked: false, lockedUntil: null },
      headers: { 'retry-after': '2' },
    });
  });
  typed.get(
    '/api/v1/wrong-answer',
    { schema: { response: { 200: z.object({ value: z.number() }) } } },
    // The handler breaks its own response schema.
    async () => ({ value: INTERNAL_MARKER }) as unknown as { value: number },
  );

  await app.ready();
  app.stages.replace('readiness', () => {});
  // By-design change (plan row W28): not about stage 6; a scratch route is no registry operation.
  app.stages.replace('accessRule', () => {});
});

afterAll(() => app.close());

describe('stage 1, routing', () => {
  it('an unknown path answers 404 NOT_FOUND', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/v1/nope?x=1' });
    expect(response.statusCode).toBe(404);
    expect(envelope(response)).toMatchObject({ code: 'NOT_FOUND', message: 'No such endpoint.' });
  });

  it('a known path with another method answers 405 METHOD_NOT_ALLOWED with allow', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/v1/thing/T-1/start' });
    expect(response.statusCode).toBe(405);
    expect(response.headers.allow).toBe('POST');
    expect(envelope(response)).toMatchObject({
      code: 'METHOD_NOT_ALLOWED',
      message: 'GET is not allowed on this endpoint.',
    });
  });

  it('allow lists every method of the path, and HEAD is not a method of this API', async () => {
    for (const method of ['PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'] as const) {
      const response = await app.inject({ method, url: '/api/v1/thing' });
      expect(response.statusCode, method).toBe(405);
      expect(response.headers.allow, method).toBe('GET, POST');
    }
  });

  it('a URL that cannot be decoded answers 400 INVALID_PATH', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/v1/thing/%E0%A4%A' });
    expect(response.statusCode).toBe(400);
    expect(envelope(response).code).toBe('INVALID_PATH');
  });
});

describe('stage 7, parsing and validation', () => {
  const json = { 'content-type': 'application/json' };

  it('malformed JSON answers 400 INVALID_JSON without the parser message', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/thing',
      headers: json,
      payload: `{"note": "${INTERNAL_MARKER}"`,
    });
    expect(response.statusCode).toBe(400);
    expect(envelope(response)).toMatchObject({
      code: 'INVALID_JSON',
      message: 'The request body must be a JSON object.',
    });
  });

  it.each(['[1,2]', '"text"', '42', 'null', 'true'])('valid JSON that is not an object (%s) answers 400', async (payload) => {
    const response = await app.inject({ method: 'POST', url: '/api/v1/thing', headers: json, payload });
    expect(response.statusCode).toBe(400);
    expect(envelope(response).code).toBe('INVALID_JSON');
  });

  it('a body that is not JSON by its content type answers 400 INVALID_JSON', async () => {
    for (const type of ['text/plain', 'application/x-www-form-urlencoded', 'application/octet-stream']) {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/thing',
        headers: { 'content-type': type },
        payload: 'a=1',
      });
      expect(response.statusCode, type).toBe(400);
      expect(envelope(response).code, type).toBe('INVALID_JSON');
    }
  });

  it('a prototype-poisoning body is refused', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/thing',
      headers: json,
      payload: '{"__proto__": {"admin": true}}',
    });
    expect(response.statusCode).toBe(400);
    expect(envelope(response).code).toBe('INVALID_JSON');
  });

  it('an empty body and a missing body both count as {}', async () => {
    const empty = await app.inject({ method: 'POST', url: '/api/v1/thing', headers: json, payload: '' });
    const missing = await app.inject({ method: 'POST', url: '/api/v1/thing' });
    expect([empty.statusCode, missing.statusCode]).toEqual([200, 200]);
    expect(empty.json()).toEqual({ body: {} });
    expect(missing.json()).toEqual({ body: {} });
  });

  it(`a body over ${BODY_LIMIT_BYTES} bytes answers 413 PAYLOAD_TOO_LARGE`, async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/thing',
      headers: json,
      payload: JSON.stringify({ note: 'x'.repeat(BODY_LIMIT_BYTES) }),
    });
    expect(response.statusCode).toBe(413);
    expect(envelope(response).code).toBe('PAYLOAD_TOO_LARGE');
  });

  it(`a body of exactly ${BODY_LIMIT_BYTES} bytes is accepted`, async () => {
    const frame = JSON.stringify({ note: '' });
    const payload = JSON.stringify({ note: 'x'.repeat(BODY_LIMIT_BYTES - frame.length) });
    expect(Buffer.byteLength(payload)).toBe(BODY_LIMIT_BYTES);
    const response = await app.inject({ method: 'POST', url: '/api/v1/thing', headers: json, payload });
    expect(response.statusCode).toBe(200);
  });

  it('a body that breaks the zod schema answers 422 INVALID_INPUT and names the part, not the value', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/thing/T-1/start',
      headers: json,
      payload: { reason: INTERNAL_MARKER.slice(0, 3), count: 1.5 },
    });
    expect(response.statusCode).toBe(422);
    expect(envelope(response)).toMatchObject({ code: 'INVALID_INPUT', details: { in: 'body' } });
  });

  it('a path parameter that breaks its schema answers 422 with details.in params', async () => {
    const response = await app.inject({ method: 'POST', url: '/api/v1/thing/not-an-id/start', headers: json, payload: {} });
    expect(response.statusCode).toBe(422);
    expect(envelope(response)).toMatchObject({ code: 'INVALID_INPUT', details: { in: 'params' } });
  });

  it('unknown keys are dropped by the schema', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/thing/T-7/start',
      headers: json,
      payload: { reason: 'long enough', extra: 'dropped' },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ id: 'T-7', body: { reason: 'long enough' } });
  });
});

describe('failures raised by the server', () => {
  it('an ApiFailure becomes its status, code, message, details and headers', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/v1/refused' });
    expect(response.statusCode).toBe(409);
    expect(response.headers['retry-after']).toBe('2');
    expect(envelope(response)).toMatchObject({
      code: 'SESSION_ACTIVE',
      message: 'A session is already active.',
      details: { simCode: 'SESSION_ACTIVE', retryInMs: 1500, locked: false, lockedUntil: null },
    });
  });

  it('an unexpected error answers the generic 500 INTERNAL_ERROR with no detail (SR-50)', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/v1/boom' });
    expect(response.statusCode).toBe(500);
    const error = envelope(response);
    expect(error).toEqual({
      code: 'INTERNAL_ERROR',
      message: 'The server could not complete the request.',
      requestId: error.requestId,
    });
    expect(response.body).not.toContain('select');
    expect(response.body).not.toContain('operators');
  });

  it('an answer that breaks its own response schema is a 500, and the wrong value is not sent', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/v1/wrong-answer' });
    expect(response.statusCode).toBe(500);
    expect(envelope(response).code).toBe('INTERNAL_ERROR');
  });

  it('every error answer is JSON with a request ID that differs per request', async () => {
    const first = await app.inject({ method: 'GET', url: '/api/v1/nope' });
    const second = await app.inject({ method: 'GET', url: '/api/v1/nope' });
    expect(first.headers['content-type']).toBe('application/json; charset=utf-8');
    expect(envelope(first).requestId).not.toBe(envelope(second).requestId);
    expect(envelope(first).requestId).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('a request ID is never taken from a request header', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/nope',
      headers: { 'request-id': 'chosen-by-caller', 'x-request-id': 'chosen-by-caller' },
    });
    expect(envelope(response).requestId).not.toBe('chosen-by-caller');
  });
});

describe('error precedence (spec §7.3; assumption SA-01)', () => {
  it('a refusal raised in onRequest wins over an invalid JSON body', async () => {
    app.stages.replace('originGuard', () => {
      throw new ApiFailure(403, 'ORIGIN_NOT_ALLOWED', 'This origin may not call the server.');
    });
    try {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/thing',
        headers: { 'content-type': 'application/json' },
        payload: '{"broken": ',
      });
      expect(response.statusCode).toBe(403);
      expect(envelope(response).code).toBe('ORIGIN_NOT_ALLOWED');

      const tooLarge = await app.inject({
        method: 'POST',
        url: '/api/v1/thing',
        headers: { 'content-type': 'application/json' },
        payload: JSON.stringify({ note: 'x'.repeat(BODY_LIMIT_BYTES) }),
      });
      expect(tooLarge.statusCode).toBe(403);

      const invalid = await app.inject({
        method: 'POST',
        url: '/api/v1/thing/T-1/start',
        headers: { 'content-type': 'application/json' },
        payload: { reason: 'x' },
      });
      expect(invalid.statusCode).toBe(403);
    } finally {
      app.stages.replace('originGuard', () => {});
    }
  });

  it('404 and 405 come before a refusal of a stage (line 1 before lines 2 to 7)', async () => {
    app.stages.replace('originGuard', () => {
      throw new ApiFailure(403, 'ORIGIN_NOT_ALLOWED', 'This origin may not call the server.');
    });
    try {
      expect((await app.inject({ method: 'GET', url: '/api/v1/nope' })).statusCode).toBe(404);
      expect((await app.inject({ method: 'DELETE', url: '/api/v1/thing' })).statusCode).toBe(405);
    } finally {
      app.stages.replace('originGuard', () => {});
    }
  });
});

describe('classify', () => {
  it('maps Fastify parse and validation errors by their code, and everything else to 500', () => {
    const coded = (code: string): Error => Object.assign(new Error(`raw ${INTERNAL_MARKER}`), { code });
    const of = (error: unknown): string => {
      const { failure, unexpected } = classify(error);
      return `${failure.statusCode} ${failure.code} ${unexpected ? 'unexpected' : 'expected'}`;
    };
    expect(of(coded('FST_ERR_CTP_BODY_TOO_LARGE'))).toBe('413 PAYLOAD_TOO_LARGE expected');
    expect(of(coded('FST_ERR_CTP_INVALID_JSON_BODY'))).toBe('400 INVALID_JSON expected');
    expect(of(coded('FST_ERR_CTP_EMPTY_JSON_BODY'))).toBe('400 INVALID_JSON expected');
    expect(of(coded('FST_ERR_CTP_INVALID_MEDIA_TYPE'))).toBe('400 INVALID_JSON expected');
    expect(of(coded('FST_ERR_CTP_INVALID_CONTENT_LENGTH'))).toBe('400 INVALID_JSON expected');
    expect(of(coded('FST_ERR_VALIDATION'))).toBe('422 INVALID_INPUT expected');
    expect(of(Object.assign(new Error('x'), { validation: [], validationContext: 'querystring' }))).toBe(
      '422 INVALID_INPUT expected',
    );
    expect(of(coded('ECONNREFUSED'))).toBe('500 INTERNAL_ERROR unexpected');
    expect(of(new Error('plain'))).toBe('500 INTERNAL_ERROR unexpected');
    expect(of('a string')).toBe('500 INTERNAL_ERROR unexpected');
    expect(of(undefined)).toBe('500 INTERNAL_ERROR unexpected');
    expect(classify(coded('FST_ERR_CTP_INVALID_JSON_BODY')).failure.message).not.toContain(INTERNAL_MARKER);
  });
});

describe('the route table', () => {
  it('turns a route pattern into an exact matcher', () => {
    expect(patternToRegExp('/api/v1/session/:id/start').test('/api/v1/session/S-1/start')).toBe(true);
    expect(patternToRegExp('/api/v1/session/:id/start').test('/api/v1/session/S-1/start/')).toBe(false);
    expect(patternToRegExp('/api/v1/session/:id/start').test('/api/v1/session/a/b/start')).toBe(false);
    expect(patternToRegExp('/api/v1/health').test('/api/v1/healthz')).toBe(false);
    expect(patternToRegExp('/a.b').test('/aXb')).toBe(false);
    expect(patternToRegExp('/files/*').test('/files/a/b')).toBe(true);
  });

  it('gives the pattern and the sorted methods of a path, or null', () => {
    const table = createRouteTable();
    table.record({ method: 'POST', url: '/api/v1/pairing/code' });
    table.record({ method: ['get'], url: '/api/v1/pairing/code' });
    table.record({ method: 'POST', url: '/api/v1/device/:id/restart' });
    expect(table.lookup('/api/v1/pairing/code')).toEqual({ pattern: '/api/v1/pairing/code', methods: ['GET', 'POST'] });
    expect(table.lookup('/api/v1/device/CAM-01/restart')).toEqual({
      pattern: '/api/v1/device/:id/restart',
      methods: ['POST'],
    });
    expect(table.lookup('/api/v1/unknown')).toBeNull();
  });
});
