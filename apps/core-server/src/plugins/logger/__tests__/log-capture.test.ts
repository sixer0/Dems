// Log capture (plan row W08; SR-48, SR-49, SR-50): requests carry a marker in every place a
// caller controls (a header, a cookie, a body, a query string, a path parameter, malformed
// JSON, an unmatched path's query) and the captured log, at level `trace`, holds none of them.
//
// Two searches run over the captured log. The markers find the values this file sent. The
// credential search (`credentialLeaks`) finds anything that has the SHAPE of a credential: a
// bearer value, a token by its prefix, a session cookie with its value. It does not take the
// bare word for a credential: the Origin guard's refusal line has a field named `hasBearer`.
import { mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { FastifyInstance, LightMyRequestResponse } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../../../app';
import { captureLog, credentialLeaks, unitTestConfig } from '../../../../test/support/config';
import { REDACTED, describeError, pathWithoutQuery, principalReference, scrubMessage } from '../index';

const MARKERS = {
  authorization: 'MARK-auth-9c41e0',
  cookie: 'MARK-cookie-55d2aa',
  setCookie: 'MARK-setcookie-0be7f3',
  body: 'MARK-body-71fa2c',
  query: 'MARK-query-c3d9b4',
  pathParameter: 'MARK-param-8e06d1',
  malformedJson: 'MARK-json-4a7f95',
  errorMessage: 'MARK-error-2d18c6',
} as const;

const REQUEST_LINE_KEYS = ['level', 'time', 'pid', 'hostname', 'reqId', 'method', 'route', 'status', 'durationMs', 'principal'];

const log = captureLog();
const logDir = mkdtempSync(join(tmpdir(), 'dems-w08-log-'));
const errorLogFile = join(logDir, 'errors.log');
let app: FastifyInstance;
/** The answers to the eight requests of the set-up, in the order they were sent. */
let answers: LightMyRequestResponse[] = [];

// Shaped as the clients send them: a session token as the bearer value and as the cookie, a
// device credential as another bearer value, a biometric token in a body.
const credentials = {
  authorization: `Bearer ses_${MARKERS.authorization}`,
  cookie: `dems_session_4420=ses_${MARKERS.cookie}; other=${MARKERS.cookie}`,
};
const deviceCredentials = { authorization: `Bearer dvc_${MARKERS.authorization}` };
const biometricBody = { note: MARKERS.body, token: `bio_${MARKERS.body}` };

function requestLines(): Array<Record<string, unknown>> {
  return log.lines().filter((line) => line.msg === 'request completed');
}

beforeAll(async () => {
  app = buildApp({ config: unitTestConfig({ logLevel: 'trace' }), logStream: log.stream, errorLogFile });

  app.post('/api/v1/probe/:id', async (_request, reply) => {
    reply.header('set-cookie', `dems_session_4420=${MARKERS.setCookie}; HttpOnly`);
    return { ok: true };
  });
  app.get('/api/v1/boom/:id', async () => {
    throw new Error(`failed while handling ${MARKERS.errorMessage}`);
  });
  // A handler that answers twice: Fastify itself then writes a warning that quotes the raw URL.
  app.get('/api/v1/twice', async (_request, reply) => {
    reply.raw.writeHead(200);
    reply.raw.end('first');
    return { second: true };
  });
  // What a careless later row could write by hand.
  app.get('/api/v1/by-hand', async (request, reply) => {
    request.log.info({ req: request, res: reply, headers: request.headers }, 'logged by hand');
    request.log.info({ nested: { headers: request.headers } }, 'logged by hand, nested');
    request.log.error(new Error(`thrown with ${MARKERS.errorMessage}`));
    request.log.error({ err: new Error(`thrown with ${MARKERS.errorMessage}`) }, 'with err');
    return {};
  });

  await app.ready();
  // About the log, not the guards: these requests carry the cookie and a bearer value together (D52).
  app.stages.replace('originGuard', () => {});
  app.stages.replace('authenticate', () => {});
  app.stages.replace('throttle', () => {});
  app.stages.replace('accessRule', () => {});
  app.readiness.set('database', true);
  app.readiness.set('engine', true);

  answers = await Promise.all([
    app.inject({
      method: 'POST',
      url: `/api/v1/probe/${MARKERS.pathParameter}?token=${MARKERS.query}`,
      headers: credentials,
      payload: biometricBody,
    }),
    app.inject({
      method: 'POST',
      url: `/api/v1/probe/${MARKERS.pathParameter}?token=${MARKERS.query}`,
      headers: { ...credentials, 'content-type': 'application/json' },
      payload: `{"note": "${MARKERS.malformedJson}"`,
    }),
    app.inject({ method: 'GET', url: `/no/such/path?token=${MARKERS.query}`, headers: deviceCredentials }),
    app.inject({ method: 'GET', url: `/api/v1/boom/${MARKERS.pathParameter}?token=${MARKERS.query}` }),
    app.inject({ method: 'POST', url: `/api/v1/boom/${MARKERS.pathParameter}?token=${MARKERS.query}` }),
    app.inject({ method: 'GET', url: `/api/v1/twice?token=${MARKERS.query}`, headers: credentials }),
    app.inject({ method: 'GET', url: `/api/v1/by-hand?token=${MARKERS.query}`, headers: credentials }),
    app.inject({ method: 'GET', url: `/api/v1/%E0%A4%A?token=${MARKERS.query}` }),
  ]);
  expect(answers.map((response) => response.statusCode)).toEqual([200, 400, 404, 500, 405, 200, 200, 400]);
});

afterAll(async () => {
  await app.close();
  rmSync(logDir, { recursive: true, force: true });
});

describe('the captured log', () => {
  it('holds no credential, no body, no query value, no path parameter value and no error message', () => {
    const text = log.text();
    expect(text.length).toBeGreaterThan(0);
    for (const [where, marker] of Object.entries(MARKERS)) expect(text, where).not.toContain(marker);
    expect(text).not.toContain('token=');
    // Nothing with the shape of a credential either: no bearer value, no `ses_`, `dvc_` or
    // `bio_` token, no session cookie with its value.
    expect(credentialLeaks(text)).toEqual([]);
  });

  it('has one request line per request, with exactly the fields of SR-49', () => {
    const lines = requestLines();
    expect(lines).toHaveLength(8);
    for (const line of lines) {
      const keys = Object.keys(line).filter((key) => key !== 'msg' && key !== 'code');
      expect(keys).toEqual(REQUEST_LINE_KEYS);
      expect(String(line.route)).not.toContain('?');
      expect(typeof line.reqId).toBe('string');
      expect(typeof line.durationMs).toBe('number');
    }
  });

  it('the request ID is the correlation key: an error answer names the reqId of its log line', () => {
    const lines = requestLines();
    const ids = lines.map((line) => String(line.reqId));
    // Made by the server: a UUID each, and no two requests share one.
    for (const id of ids) expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(new Set(ids).size).toBe(ids.length);

    const errors = answers.filter((response) => response.statusCode >= 400);
    expect(errors).toHaveLength(5);
    for (const response of errors) {
      const { requestId } = (response.json() as { error: { requestId: string } }).error;
      const matching = lines.filter((line) => line.reqId === requestId);
      expect(matching).toHaveLength(1);
      expect(matching[0]?.status).toBe(response.statusCode);
    }
    // Every other line a request wrote carries the same key, so one search finds them all.
    const failure = log.lines().find((line) => line.msg === 'unexpected error while handling a request');
    const failed = answers.find((response) => response.statusCode === 500);
    if (failed === undefined) throw new Error('the set-up sent no request that answers 500');
    expect(failure?.reqId).toBe((failed.json() as { error: { requestId: string } }).error.requestId);
  });

  it('names the route pattern, never the raw URL', () => {
    const seen = requestLines().map((line) => `${String(line.method)} ${String(line.route)} ${String(line.status)}`);
    expect(seen.sort()).toEqual(
      [
        'POST /api/v1/probe/:id 200',
        'POST /api/v1/probe/:id 400',
        // An unmatched path: the path without its query string.
        'GET /no/such/path 404',
        'GET /api/v1/boom/:id 500',
        // A known path with another method: the pattern, not the path.
        'POST /api/v1/boom/:id 405',
        'GET /api/v1/twice 200',
        'GET /api/v1/by-hand 200',
        'GET /api/v1/%E0%A4%A 400',
      ].sort(),
    );
  });

  it('logs a parse failure by its code only', () => {
    const line = requestLines().find((entry) => entry.status === 400 && entry.route === '/api/v1/probe/:id');
    expect(line?.code).toBe('INVALID_JSON');
    expect(log.text()).not.toContain('Unexpected');
    expect(log.text()).not.toContain('JSON at position');
    expect(log.text()).not.toContain('is not valid JSON');
  });

  it('logs every refusal with its code', () => {
    const codes = requestLines()
      .filter((line) => typeof line.code === 'string')
      .map((line) => `${String(line.status)} ${String(line.code)}`);
    expect(codes.sort()).toEqual(
      ['400 INVALID_JSON', '400 INVALID_PATH', '404 NOT_FOUND', '405 METHOD_NOT_ALLOWED', '500 INTERNAL_ERROR'].sort(),
    );
  });

  it('logs an unexpected failure with its name and stack frames, without its message', () => {
    const line = log.lines().find((entry) => entry.msg === 'unexpected error while handling a request');
    expect(line?.level).toBe(50);
    const err = line?.err as Record<string, unknown>;
    expect(err.type).toBe('Error');
    expect(err.message).toBe('Error');
    expect(String(err.stack)).toContain('log-capture.test.ts');
    expect(String(err.stack)).not.toContain('failed while handling');
  });

  it('redacts authorization, cookie and set-cookie where a header object is logged by hand', () => {
    const byHand = log.lines().find((entry) => entry.msg === 'logged by hand');
    expect(byHand?.headers).toMatchObject({ authorization: REDACTED, cookie: REDACTED });
    expect(byHand?.req).toEqual({ method: 'GET', route: '/api/v1/by-hand' });
    expect(byHand?.res).toEqual({ statusCode: 200 });
    const nested = log.lines().find((entry) => entry.msg === 'logged by hand, nested');
    expect(nested?.nested).toMatchObject({ headers: { authorization: REDACTED, cookie: REDACTED } });
  });

  it('never makes an error message the log message', () => {
    const messages = log.lines().map((entry) => String(entry.msg));
    expect(messages).toContain('error');
    expect(messages).toContain('with err');
    expect(messages.filter((message) => message.includes('thrown with'))).toEqual([]);
  });

  it("keeps the raw URL out of Fastify's own warning about a second answer", () => {
    // Fastify logs `{ err }` here, and that error's message quotes the URL with its query.
    const warning = log.lines().find((entry) => (entry.err as { code?: string } | undefined)?.code === 'FST_ERR_REP_ALREADY_SENT');
    expect(warning).toBeDefined();
    expect(warning?.level).toBe(40);
    expect(warning?.msg).toBe('error');
    expect(JSON.stringify(warning)).not.toContain('/api/v1/twice');
  });

  it('replaces a quoted path in a message text (the other form of that warning)', () => {
    app.log.warn(
      `Reply was already sent, did you forget to "return reply" in the "/api/v1/twice?token=${MARKERS.query}" (GET) route?`,
    );
    const warning = log.lines().find((entry) => String(entry.msg).startsWith('Reply was already sent'));
    expect(warning?.msg).toBe('Reply was already sent, did you forget to "return reply" in the "[path]" (GET) route?');
  });
});

describe('the credential search (positive control)', () => {
  it('finds a bearer value, a token of each prefix and a session cookie with its value', () => {
    const leaked = [
      '{"level":30,"authorization":"Bearer ses_Zm9vYmFyYmF6cXV4"}',
      '{"level":30,"note":"Bearer some-opaque-value"}',
      '{"level":30,"header":"bearer dvc_AbCdEf012345"}',
      '{"level":30,"body":{"token":"bio_0123456789abcdef"}}',
      '{"level":30,"cookie":"dems_session_4421=AbCdEf; other=1"}',
    ].join('\n');
    expect(credentialLeaks(leaked).sort()).toEqual(
      [
        'bearer value in line 1',
        'token in line 1',
        'bearer value in line 2',
        'bearer value in line 3',
        'token in line 3',
        'token in line 4',
        'session cookie in line 5',
      ].sort(),
    );
    // An entry names a kind and a line, never the value it found.
    expect(credentialLeaks(leaked).join(' ')).not.toMatch(/Zm9v|opaque|AbCdEf|0123456789abcdef/);
  });

  it('does not take a field name, a code, a cookie name or a sentence for a credential', () => {
    const harmless = [
      // The shape of the Origin guard's refusal line.
      '{"level":40,"code":"ORIGIN_NOT_ALLOWED","category":"OTHER","hasCookie":true,"hasBearer":true,"msg":"origin refused"}',
      '{"level":30,"kind":"BEARER_WITH_WEB_ORIGIN","msg":"a bearer request with a web console origin was refused"}',
      '{"level":30,"sessionCookieName":"dems_session_4420","msg":"configuration loaded"}',
      '{"level":30,"authorization":"[redacted]","cookie":"[redacted]"}',
      '{"level":30,"method":"POST","route":"/api/v1/auth/biometric/sign-in","principal":"device:DEV-0001"}',
      '{"level":30,"database":"dems_unit_test","msg":"uses_default and sessions_ended are not tokens"}',
    ].join('\n');
    // The search for the bare word, which this file used before, would have matched here.
    expect(harmless).toContain('Bearer');
    expect(credentialLeaks(harmless)).toEqual([]);
  });

  it('finds a deliberate leak end to end: an app that logs the headers and the body it received', async () => {
    const own = captureLog();
    const leaky = buildApp({ config: unitTestConfig({ logLevel: 'info' }), logStream: own.stream });
    leaky.post('/api/v1/leak', async (request) => {
      // Not `headers`, `authorization` or `cookie`: keys the redaction does not know.
      request.log.info(
        { sent: request.headers.authorization, jar: request.headers.cookie, received: request.body },
        'a careless line',
      );
      // And a line of the guard's shape beside it, which is not a leak.
      request.log.warn({ hasCookie: true, hasBearer: true }, 'origin refused');
      return {};
    });
    await leaky.ready();
    for (const stage of ['readiness', 'originGuard', 'authenticate', 'throttle', 'accessRule'] as const) {
      leaky.stages.replace(stage, () => {});
    }
    const response = await leaky.inject({
      method: 'POST',
      url: '/api/v1/leak',
      headers: credentials,
      payload: biometricBody,
    });
    await leaky.close();
    expect(response.statusCode).toBe(200);

    const careless = own
      .text()
      .split('\n')
      .filter((line) => line.includes('a careless line'))
      .join('\n');
    // Pass D1a (decision D134): layer 5 of the logger now blanks what it can know even under these
    // keys - the member NAMED `token` and every `ses_` / `bio_` token inside a text - so the token
    // entry and the authorization marker are gone. What it cannot know is still written and still
    // found: the second cookie value and the free text of the body. The search reports the scheme
    // and the session cookie by their shape (their values read `ses_***`).
    expect(credentialLeaks(careless).sort()).toEqual(['bearer value in line 1', 'session cookie in line 1'].sort());
    expect(careless).not.toContain(MARKERS.authorization);
    expect(careless).toContain('ses_***');
    // The markers find the leak that remains, so the two searches agree on a real one.
    expect(careless).toContain(MARKERS.cookie);
    expect(careless).toContain(MARKERS.body);

    // Every other line of that log, the guard-shaped one included, is clean.
    const rest = own
      .text()
      .split('\n')
      .filter((line) => !line.includes('a careless line'))
      .join('\n');
    expect(rest).toContain('hasBearer');
    expect(credentialLeaks(rest)).toEqual([]);
  });
});

describe('the persistent error log', () => {
  it('gets one entry for the unexpected failure: identifiers and frames, no message, no URL', () => {
    const rows = readFileSync(errorLogFile, 'utf8')
      .split('\n')
      .filter((row) => row !== '')
      .map((row) => JSON.parse(row) as Record<string, unknown>);
    const failures = rows.filter((row) => row.source === 'error-envelope.errorHandler');
    expect(failures).toHaveLength(1);
    const [entry] = failures;
    expect(entry).toMatchObject({
      level: 'error',
      service: 'dems-core-server',
      message: 'unexpected error while handling a request',
      errorName: 'Error',
      context: { method: 'GET', route: '/api/v1/boom/:id' },
    });
    const context = (entry?.context ?? {}) as Record<string, unknown>;
    expect(typeof context.requestId).toBe('string');
    expect(typeof entry?.timestamp).toBe('string');
    const text = readFileSync(errorLogFile, 'utf8');
    for (const marker of Object.values(MARKERS)) expect(text).not.toContain(marker);
    expect(text).not.toContain('token=');
  });

  it('is a file of mode 0600', () => {
    expect((statSync(errorLogFile).mode & 0o777).toString(8)).toBe('600');
  });

  it('the app factory writes none unless a file is given', () => {
    const silent = buildApp({ config: unitTestConfig() });
    expect(silent.errorLog.file).toBeNull();
    expect(() => silent.errorLog.append({ level: 'error', source: 'test', message: 'ignored' })).not.toThrow();
  });
});

describe('the principal reference of a request line', () => {
  it('is the operator ID or the device ID, and null for an anonymous caller', async () => {
    const own = captureLog();
    const second = buildApp({ config: unitTestConfig({ logLevel: 'info' }), logStream: own.stream });
    second.get('/api/v1/who', async () => ({}));
    await second.ready();
    second.stages.replace('readiness', () => {});

    await second.inject({ method: 'GET', url: '/api/v1/who' });
    second.stages.replace('authenticate', (request) => {
      request.principal = {
        kind: 'OPERATOR',
        operatorId: 'OP-0002',
        sessionId: 'AS-000001',
        deviceId: null,
        role: 'SUPERVISOR',
        permissions: [],
      };
    });
    await second.inject({ method: 'GET', url: '/api/v1/who' });
    second.stages.replace('authenticate', (request) => {
      request.principal = { kind: 'DEVICE', deviceId: 'DEV-0001' };
    });
    await second.inject({ method: 'GET', url: '/api/v1/who' });
    await second.close();

    const principals = own
      .lines()
      .filter((line) => line.msg === 'request completed')
      .map((line) => line.principal);
    expect(principals).toEqual([null, 'operator:OP-0002', 'device:DEV-0001']);
  });

  it('principalReference never returns more than an identifier', () => {
    expect(principalReference(null)).toBeNull();
    expect(principalReference(undefined)).toBeNull();
    expect(principalReference({ kind: 'ANONYMOUS', retiredDeviceId: 'DEV-0009' })).toBeNull();
  });
});

describe('the helpers', () => {
  it('pathWithoutQuery cuts the query, the fragment, control characters and an overlong path', () => {
    expect(pathWithoutQuery('/a/b?token=x')).toBe('/a/b');
    expect(pathWithoutQuery('/a/b#frag')).toBe('/a/b');
    expect(pathWithoutQuery('/a\u0000\n\tb')).toBe('/ab');
    expect(pathWithoutQuery(undefined)).toBe('');
    expect(pathWithoutQuery(`/${'x'.repeat(500)}`)).toHaveLength(200);
  });

  it('scrubMessage replaces a quoted absolute path and leaves other text alone', () => {
    expect(scrubMessage('did you forget "return reply" in the "/api/v1/x?token=abc" (GET) route?')).toBe(
      'did you forget "return reply" in the "[path]" (GET) route?',
    );
    expect(scrubMessage('request completed')).toBe('request completed');
  });

  it('describeError gives the name, the code and the frames, never the message', () => {
    const error = Object.assign(new Error(`secret ${MARKERS.errorMessage}`), { code: 'E_TEST' });
    const description = describeError(error);
    expect(description.errorName).toBe('Error');
    expect(description.code).toBe('E_TEST');
    expect(description.stackTrace).toContain('    at ');
    expect(JSON.stringify(description)).not.toContain(MARKERS.errorMessage);
    expect(describeError('a string')).toEqual({ errorName: 'string' });
  });
});
