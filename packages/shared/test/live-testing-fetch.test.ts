// HB-11, the contract-checked fake transport: its HTTP half (backend task 04_client_integration_spec
// §12.2, TS-10 to TS-14; AC-C-17; plan row W31). Every test drives the fake through the REAL typed
// client (`createCoreClient`), so the fake is proven against the consumer it stands in front of.
// No network, no port, no real timer.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import {
  CORE_API_EXAMPLES,
  CORE_API_OPERATIONS,
  CORE_API_SCHEMAS,
  CoreApiMode,
  CoreApiTag,
  EPOCH_HEADER_NAME,
  REQUEST_ID_HEADER_NAME,
  RETRY_AFTER_HEADER_NAME,
  REVISION_HEADER_NAME,
  matchCoreApiOperation,
  validateCoreApiResponse,
  type CoreApiOperation,
} from '../src/api';
import { CoreErrorKind, LIVE_COMMAND_TIMEOUT_MS, createCoreClient, type CoreCredentials } from '../src/client';
import {
  FAKE_CREDENTIALS,
  FakeRequestViolation,
  FakeResponseViolation,
  FakeTransportError,
  FakeTransportRequestError,
  FakeTransportResponseError,
  FakeTransportUnscriptedError,
  FakeTransportUsageError,
  NO_ANSWER,
  OUTAGE,
  clockFromTimers,
  createFakeTransport,
  exampleAnswer,
  exampleInput,
  notReady,
  rateLimited,
  refusal,
  withFakeTransport,
  type FakeAnswer,
  type FakeTransport,
} from '../src/live/testing';

const BASE = 'http://127.0.0.1:4420';
const SESSION_ID = 'SES-20261001-0024';

/** The real typed client on the fake `fetch`, on the registry's widened view (string IDs, loose input). */
function clientOn(fake: Pick<FakeTransport, 'fetch'>, credentials: CoreCredentials = 'browser-cookie') {
  return createCoreClient({ baseUrl: BASE, credentials, fetch: fake.fetch, operations: CORE_API_OPERATIONS });
}
const mobile = (fake: Pick<FakeTransport, 'fetch'>) => clientOn(fake, () => FAKE_CREDENTIALS.sessionToken);

/** The first recorded violation, as the class the test expects. */
function firstViolation<Raised extends FakeTransportError>(fake: FakeTransport, type: new (...args: never[]) => Raised): Raised {
  const first = fake.violations[0];
  expect(first).toBeInstanceOf(type);
  return first as Raised;
}

function thrownBy(run: () => unknown): unknown {
  try {
    run();
  } catch (error) {
    return error;
  }
  throw new Error('nothing was thrown');
}

afterEach(() => {
  vi.useRealTimers();
});

// ═══════════════════════════════════════════════════════════════════════════════════════
// Scripting answers
// ═══════════════════════════════════════════════════════════════════════════════════════

describe('scripted answers reach the real typed client', () => {
  it('a repeating answer answers every call of its operation; the client returns it parsed', async () => {
    const fake = createFakeTransport();
    fake.answerFromExample('getServiceHealth');
    const client = clientOn(fake);
    const first = await client.call('getServiceHealth');
    const second = await client.call('getServiceHealth');
    expect(first).toMatchObject({ ok: true, status: 200, data: CORE_API_EXAMPLES.getServiceHealth?.responses[200]?.live?.value });
    expect(second.ok).toBe(true);
    expect(fake.calls).toHaveLength(2);
    fake.assertDone();
  });

  it('one-shot answers are used in the order they were scripted, before the repeating one', async () => {
    const fake = createFakeTransport();
    fake.answerFromExample('getCurrentSession', 200, 'idle');
    fake.answerOnceFromExample('getCurrentSession', 200, 'recording');
    fake.answerOnce('getCurrentSession', notReady());
    const client = clientOn(fake);
    const results = [await client.call('getCurrentSession'), await client.call('getCurrentSession'), await client.call('getCurrentSession')];
    expect(results[0]).toMatchObject({ ok: true, data: { session: { id: SESSION_ID } } });
    expect(results[1]).toMatchObject({ ok: false, kind: CoreErrorKind.NOT_READY, status: 503 });
    expect(results[2]).toMatchObject({ ok: true, data: { session: null } });
    expect(fake.calls.map((call) => call.status)).toEqual([200, 503, 200]);
    fake.assertDone();
  });

  it('scripted headers reach the client: epoch, revision, request ID and retry-after', async () => {
    const fake = createFakeTransport();
    fake.answerOnce('stopSession', { ...exampleAnswer('stopSession'), epoch: 3, revision: 129, requestId: 'req-7' });
    fake.answerOnce('stopSession', { ...rateLimited(12), headers: { [REQUEST_ID_HEADER_NAME]: 'req-8' } });
    const client = clientOn(fake);
    const input = exampleInput('stopSession');
    expect(await client.call('stopSession', input)).toMatchObject({ ok: true, status: 202, epoch: 3, revision: 129, requestId: 'req-7' });
    expect(await client.call('stopSession', input)).toMatchObject({
      ok: false,
      kind: CoreErrorKind.RATE_LIMITED,
      retryAfterSeconds: 12,
      transport: 'UNAVAILABLE',
      requestId: 'req-8',
    });
    fake.assertDone();
  });

  it('a 2xx answer of a POST carries the position of the fake Core server by default (API-7); a GET carries none', async () => {
    const fake = createFakeTransport({ epoch: 4, revision: 17 });
    fake.answerFromExample('stopSession');
    fake.answerFromExample('getServiceHealth');
    const client = clientOn(fake);
    expect(await client.call('stopSession', exampleInput('stopSession'))).toMatchObject({ ok: true, epoch: 4, revision: 17 });
    fake.setPosition({ revision: 18 });
    expect(await client.call('stopSession', exampleInput('stopSession'))).toMatchObject({ ok: true, epoch: 4, revision: 18 });
    expect(fake.startEpoch()).toEqual({ epoch: 5, revision: 0 });
    expect(await client.call('stopSession', exampleInput('stopSession'))).toMatchObject({ ok: true, epoch: 5, revision: 0 });
    expect(await client.call('getServiceHealth')).toMatchObject({ ok: true, epoch: null, revision: null });
    expect(() => fake.setPosition({ revision: -1 })).toThrow(FakeTransportUsageError);
  });

  it('an error envelope repeats its request ID in the header; every other answer gets a counter value', async () => {
    const fake = createFakeTransport();
    fake.answerOnceFromExample('getAuthSession', 401);
    fake.answerOnce('getAuthSession', refusal(401, 'NOT_SIGNED_IN', 'Sign in first.'));
    const client = clientOn(fake);
    const envelope = exampleAnswer('getAuthSession', 401).body as { error: { requestId: string } };
    expect(envelope.error.requestId).toMatch(/^[0-9a-f-]{36}$/);
    expect((await client.call('getAuthSession')).requestId).toBe(envelope.error.requestId);
    expect((await client.call('getAuthSession')).requestId).toBe(`fake-request-${fake.calls[1]?.seq}`);
  });

  it('a responder function builds the answer from the request it is given', async () => {
    const fake = createFakeTransport();
    fake.answer('exportEvidence', (call) => ({
      status: 202,
      // Task 3 M2-W7 (C3 §3 op 42): the accepted answer is a QUEUED job, not a finished export.
      body: { exportId: 'EXP-000031', evidenceId: call.params.id, status: 'QUEUED' },
    }));
    const result = await clientOn(fake).call('exportEvidence', { params: { id: 'EV-20260930-0004' }, body: { reason: 'Prosecutor review' } });
    expect(result).toMatchObject({ ok: true, data: { evidenceId: 'EV-20260930-0004' } });
    fake.assertNoViolations();
  });

  it('a held answer keeps the request in flight until the test releases it', async () => {
    const fake = createFakeTransport();
    const held = fake.hold('createSession');
    expect(held.call).toBeNull();
    let settled = false;
    const pending = clientOn(fake)
      .call('createSession', exampleInput('createSession'))
      .then((result) => {
        settled = true;
        return result;
      });
    await fake.arrived();
    expect(settled).toBe(false);
    expect(held.call).toMatchObject({ operationId: 'createSession', outcome: 'pending', status: null });
    held.release(fake.example('createSession', 201));
    expect(await pending).toMatchObject({ ok: true, status: 201 });
    expect(held).toMatchObject({ settled: true, call: { outcome: 'answered', status: 201 } });
    expect(() => held.release()).toThrow(FakeTransportUsageError);
  });

  it('a held answer released before its request arrives is delivered when it does; without an argument it is the first success example', async () => {
    const fake = createFakeTransport();
    const held = fake.hold('createSession');
    held.release();
    expect(await clientOn(fake).call('createSession', exampleInput('createSession'))).toMatchObject({ ok: true, status: 200 });
    const failing = fake.hold('createSession');
    failing.fail();
    expect(await clientOn(fake).call('createSession', exampleInput('createSession'))).toMatchObject({ ok: false, kind: CoreErrorKind.NETWORK });
    fake.assertDone();
  });

  it('a delay is kept on the fake clock: the answer arrives when the test advances it', async () => {
    const fake = createFakeTransport();
    fake.answer('getDeviceHealth', { ...exampleAnswer('getDeviceHealth'), delayMs: 1_000 });
    let result: unknown = null;
    const pending = clientOn(fake)
      .call('getDeviceHealth')
      .then((value) => {
        result = value;
        return value;
      });
    await fake.arrived();
    fake.clock.advance(999);
    await fake.idle();
    expect(result).toBeNull();
    expect(fake.clock.pendingTasks).toBe(1);
    expect(fake.calls[0]).toMatchObject({ outcome: 'pending', status: null });
    fake.clock.advance(1);
    expect(await pending).toMatchObject({ ok: true, status: 200 });
    expect(fake.clock.pendingTasks).toBe(0);
    fake.assertDone();
  });

  it('a clock on the runner timers: one advance of the fake timers moves the client and the delayed answer together', async () => {
    vi.useFakeTimers();
    const clock = clockFromTimers({
      now: () => Date.now(),
      setTimeout: (task, ms) => setTimeout(task, ms),
      clearTimeout: (handle) => clearTimeout(handle),
    });
    const fake = createFakeTransport({ clock });
    fake.answer('getDeviceHealth', { ...exampleAnswer('getDeviceHealth'), delayMs: 1_000 });
    const pending = clientOn(fake).call('getDeviceHealth');
    await vi.advanceTimersByTimeAsync(1_000);
    expect(await pending).toMatchObject({ ok: true });
    expect(fake.calls[0]?.at).toBe(Date.now() - 1_000);
  });

  it('an outage rejects like an unreachable server: the client reports NETWORK, and nothing is a violation', async () => {
    const fake = createFakeTransport();
    fake.failOnce('getDeviceHealth');
    fake.answer('getDeviceHealth', OUTAGE);
    const client = clientOn(fake);
    for (let attempt = 0; attempt < 2; attempt += 1) {
      expect(await client.call('getDeviceHealth')).toMatchObject({ ok: false, kind: CoreErrorKind.NETWORK, status: null, transport: 'CORE_OFFLINE' });
    }
    expect(fake.calls.map((call) => call.outcome)).toEqual(['outage', 'outage']);
    await expect(fake.fetch(`${BASE}/api/v1/device/health`)).rejects.toBeInstanceOf(TypeError);
    fake.fail('getAudioStatus');
    expect(await client.call('getAudioStatus')).toMatchObject({ ok: false, kind: CoreErrorKind.NETWORK });
    fake.assertDone();
  });

  it('"no answer" stays in flight until the client time-out aborts it (CL-6): TIMEOUT, and the log says aborted', async () => {
    vi.useFakeTimers();
    const fake = createFakeTransport();
    fake.answer('getDeviceHealth', NO_ANSWER);
    const pending = clientOn(fake).call('getDeviceHealth');
    await vi.advanceTimersByTimeAsync(LIVE_COMMAND_TIMEOUT_MS - 1);
    expect(fake.calls[0]?.outcome).toBe('pending');
    await vi.advanceTimersByTimeAsync(1);
    expect(await pending).toMatchObject({ ok: false, kind: CoreErrorKind.TIMEOUT });
    expect(fake.calls[0]?.outcome).toBe('aborted');
    fake.assertNoViolations();
  });

  it('a request whose signal is already aborted is rejected with an AbortError and logged', async () => {
    const fake = createFakeTransport();
    fake.answerFromExample('getDeviceHealth');
    const controller = new AbortController();
    controller.abort();
    await expect(fake.fetch(`${BASE}/api/v1/device/health`, { signal: controller.signal })).rejects.toMatchObject({ name: 'AbortError' });
    expect(fake.calls[0]).toMatchObject({ operationId: 'getDeviceHealth', outcome: 'aborted' });
  });

  it('answerAllFromExamples: every operation without a script answers its first success example', async () => {
    const fake = createFakeTransport();
    fake.answerAllFromExamples();
    fake.answerOnce('getDeviceHealth', notReady());
    const client = clientOn(fake);
    expect(await client.call('getDeviceHealth')).toMatchObject({ ok: false, status: 503 });
    expect(await client.call('getDeviceHealth')).toMatchObject({ ok: true, status: 200 });
    expect(await client.call('signOut')).toMatchObject({ ok: true, status: 204, data: undefined });
    fake.assertDone();
  });

  it('the fetch response has the members a fetch caller reads, and no stream', async () => {
    const fake = createFakeTransport();
    fake.answerFromExample('getServiceHealth');
    const response = await fake.fetch({ href: `${BASE}/api/v1/health` });
    expect(response).toMatchObject({ ok: true, status: 200, url: `${BASE}/api/v1/health`, redirected: false, type: 'basic' });
    expect(response.headers.get('Content-Type')).toBe('application/json; charset=utf-8');
    expect(response.headers.has(REQUEST_ID_HEADER_NAME)).toBe(true);
    const names: string[] = [];
    response.headers.forEach((_value, name) => names.push(name));
    expect(names.sort()).toEqual(['content-type', REQUEST_ID_HEADER_NAME]);
    const copy = response.clone();
    expect(response.bodyUsed).toBe(false);
    expect(await response.json()).toEqual(JSON.parse(await copy.text()));
    // The body is read once, as with a fetch response; there is no stream to read it from (CL-3).
    expect(response.bodyUsed).toBe(true);
    await expect(response.text()).rejects.toBeInstanceOf(TypeError);
    expect(() => response.clone()).toThrow(TypeError);
    expect('body' in response).toBe(false);
    fake.assertNoViolations();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════════════
// The whole registry
// ═══════════════════════════════════════════════════════════════════════════════════════

describe('the whole registry, answered from the contract examples', () => {
  it('holds at least the 37 operations of contracts A and B', () => {
    expect(CORE_API_OPERATIONS.length).toBeGreaterThanOrEqual(37);
  });

  it('every operation is called through the real client once per status it names, with its own example as input and as answer', async () => {
    const fake = createFakeTransport();
    const client = mobile(fake);
    let exchanges = 0;
    for (const operation of CORE_API_OPERATIONS) {
      const input = fake.exampleInput(operation.operationId);
      for (const status of Object.keys(operation.responses).map(Number)) {
        fake.answerOnceFromExample(operation.operationId, status);
        const result = await client.call(operation.operationId, input);
        const label = `${operation.operationId} ${status}`;
        expect(result.status, label).toBe(status);
        expect(result.ok, label).toBe(status >= 200 && status <= 299);
        // The request was matched to its own operation, by method and path template.
        expect(fake.calls.at(-1), label).toMatchObject({ operationId: operation.operationId, method: operation.method.toUpperCase(), status });
        expect(matchCoreApiOperation(operation.method, fake.calls.at(-1)?.path ?? '')?.operation.operationId, label).toBe(operation.operationId);
        exchanges += 1;
      }
    }
    fake.assertDone();
    const statuses = CORE_API_OPERATIONS.reduce((sum, operation) => sum + Object.keys(operation.responses).length, 0);
    expect(exchanges).toBe(statuses);
    expect(fake.calls).toHaveLength(statuses);
    expect(new Set(fake.log.operationIds())).toEqual(new Set(CORE_API_OPERATIONS.map((operation) => operation.operationId)));
    expect(fake.calls.every((call) => call.outcome === 'answered')).toBe(true);
  });

  it('every operation takes the pipeline answers of the envelope: 429 with retry-after, 503, 500 and 413', async () => {
    const fake = createFakeTransport();
    const client = mobile(fake);
    const pipeline: readonly [FakeAnswer, CoreErrorKind][] = [
      [rateLimited(5), CoreErrorKind.RATE_LIMITED],
      [notReady(), CoreErrorKind.NOT_READY],
      [refusal(500, 'INTERNAL_ERROR', 'An unexpected failure.'), CoreErrorKind.SERVER],
      [refusal(413, 'PAYLOAD_TOO_LARGE', 'The request body is too large.'), CoreErrorKind.BAD_REQUEST],
    ];
    for (const operation of CORE_API_OPERATIONS) {
      for (const [answer, kind] of pipeline) {
        fake.answerOnce(operation.operationId, answer);
        const result = await client.call(operation.operationId, fake.exampleInput(operation.operationId));
        expect(result, `${operation.operationId} ${answer.status}`).toMatchObject({ ok: false, kind, status: answer.status });
      }
    }
    fake.assertDone();
  });

  it('agrees with the contract checker on every example, and on a body that is not the schema of its status', () => {
    const fake = createFakeTransport();
    const wrong = { neverAMember: true };
    let checked = 0;
    for (const operation of CORE_API_OPERATIONS) {
      for (const [status, spec] of Object.entries(operation.responses)) {
        const code = Number(status);
        if (!spec.schema) continue;
        for (const example of Object.values(CORE_API_EXAMPLES[operation.operationId]?.responses[code] ?? {})) {
          expect(validateCoreApiResponse(operation.operationId, code, example.value).ok, `${operation.operationId} ${status}`).toBe(true);
          expect(() => fake.answerOnce(operation.operationId, { status: code, body: example.value })).not.toThrow();
          checked += 1;
        }
        const contractAccepts = validateCoreApiResponse(operation.operationId, code, wrong).ok;
        const fakeAccepts = (() => {
          try {
            fake.answerOnce(operation.operationId, { status: code, body: wrong });
            return true;
          } catch (error) {
            expect(error).toBeInstanceOf(FakeTransportResponseError);
            return false;
          }
        })();
        expect(fakeAccepts, `${operation.operationId} ${status}`).toBe(contractAccepts);
      }
    }
    expect(checked).toBeGreaterThanOrEqual(CORE_API_OPERATIONS.length);
  });

  it('the example helpers name what the contract lacks instead of inventing it', () => {
    const fake = createFakeTransport();
    expect(exampleAnswer('signOut')).toEqual({ status: 204 });
    expect(exampleInput('stopSession')).toEqual({ params: { id: SESSION_ID }, body: { reason: 'Interview completed' } });
    expect(exampleInput('getServiceHealth')).toEqual({});
    expect(thrownBy(() => fake.example('getServiceHealth', 200, 'noSuchExample'))).toMatchObject({ name: 'FakeTransportUsageError', reason: 'NO_EXAMPLE' });
    expect(thrownBy(() => exampleAnswer('noSuchOperation'))).toMatchObject({ name: 'FakeTransportUsageError', reason: 'NO_EXAMPLE' });
    expect(thrownBy(() => fake.example('noSuchOperation'))).toMatchObject({ name: 'FakeTransportResponseError', reason: 'UNKNOWN_OPERATION' });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════════════
// Contract check on the way in
// ═══════════════════════════════════════════════════════════════════════════════════════

describe('contract check on the way in: a request that is not the contract fails with a named error', () => {
  it('a request body that violates the schema of its operation is refused: FakeTransportRequestError with the operation ID and the issue paths', async () => {
    const fake = createFakeTransport();
    fake.answerFromExample('stopSession');
    const result = await clientOn(fake).call('stopSession', { params: { id: SESSION_ID }, body: { reason: 'x' } });
    // The typed client turns any transport rejection into NETWORK (CL-1), so the finding is read from the fake.
    expect(result).toMatchObject({ ok: false, kind: CoreErrorKind.NETWORK });
    const error = firstViolation(fake, FakeTransportRequestError);
    expect(error).toMatchObject({
      name: 'FakeTransportRequestError',
      reason: FakeRequestViolation.INVALID_BODY,
      operationId: 'stopSession',
      method: 'POST',
      route: '/api/v1/session/{id}/stop',
      issues: ['reason: too_small'],
    });
    expect(fake.calls[0]).toMatchObject({ operationId: 'stopSession', outcome: 'refused', status: null });
    expect(() => fake.assertNoViolations()).toThrow(FakeTransportRequestError);
    expect(() => fake.assertDone()).toThrow(error);
  });

  it('the error of a refused request never holds a value of the request: not a password, not a name, not the URL', async () => {
    const fake = createFakeTransport();
    const secret = 'Correct-Horse-Battery-9';
    const username = 'x'.repeat(500);
    await clientOn(fake).call('signIn', { body: { username, password: secret } });
    const error = firstViolation(fake, FakeTransportRequestError);
    expect(error).toMatchObject({ reason: FakeRequestViolation.INVALID_BODY, operationId: 'signIn', issues: ['username: too_big'] });
    for (const text of [error.message, String(error), error.issues.join(' '), error.route]) {
      expect(text).not.toContain(secret);
      expect(text).not.toContain(username);
      expect(text).not.toContain(BASE);
    }
    // The log keeps the body as given, for assertions; its text shows the member names only.
    expect(fake.calls[0]?.body).toEqual({ username, password: secret });
    expect(String(fake.log)).not.toContain(secret);
    expect(JSON.stringify(fake.calls[0])).not.toContain(secret);
  });

  it.each([
    ['no operation has this path', '/api/v1/nope', undefined, FakeRequestViolation.UNKNOWN_ROUTE, '/api/v1/{?}'],
    ['a value in an unknown path is not echoed', '/api/v1/sesion/SES-20261001-0024/start', 'POST', FakeRequestViolation.UNKNOWN_ROUTE, '/api/v1/{?}/{?}/start'],
    ['the path exists with another method', '/api/v1/health', 'POST', FakeRequestViolation.METHOD_NOT_ALLOWED, '/api/v1/health'],
    ['a method the contract does not have', '/api/v1/health', 'PUT', FakeRequestViolation.METHOD_NOT_ALLOWED, '/api/v1/health'],
    ['a fragment', '/api/v1/health#top', undefined, FakeRequestViolation.INVALID_URL, '/api/v1/health'],
    ['a query part that is not valid percent-encoding', '/api/v1/health?a=%E0%A4%A', undefined, FakeRequestViolation.INVALID_URL, '(unreadable)'],
  ])('%s: rejected and recorded', async (_name, path, method, reason, route) => {
    const fake = createFakeTransport();
    fake.answerAllFromExamples();
    const rejection = fake.fetch(`${BASE}${path}`, method ? { method } : undefined);
    await expect(rejection).rejects.toBeInstanceOf(FakeTransportRequestError);
    await expect(rejection).rejects.toMatchObject({ reason, route, operationId: null });
    expect(fake.violations).toHaveLength(1);
    expect(fake.calls[0]).toMatchObject({ operationId: null, outcome: 'refused' });
  });

  it('a scheme that is not http is refused; a relative URL is the same-origin form of the web console', async () => {
    const fake = createFakeTransport();
    fake.answerFromExample('getServiceHealth');
    await expect(fake.fetch('ftp://127.0.0.1/api/v1/health')).rejects.toMatchObject({ reason: FakeRequestViolation.INVALID_URL });
    const sameOrigin = createCoreClient({ baseUrl: '', credentials: 'browser-cookie', fetch: fake.fetch });
    expect(await sameOrigin.call('getServiceHealth')).toMatchObject({ ok: true });
    expect(fake.calls[1]).toMatchObject({ url: '/api/v1/health', path: '/api/v1/health', operationId: 'getServiceHealth' });
  });

  it('a path parameter that does not match the pattern of its operation is refused, without the value', async () => {
    const fake = createFakeTransport();
    fake.answerFromExample('startSession');
    await clientOn(fake).call('startSession', { params: { id: 'session-twenty-four' } });
    const error = firstViolation(fake, FakeTransportRequestError);
    expect(error).toMatchObject({ reason: FakeRequestViolation.INVALID_PATH_PARAM, operationId: 'startSession', route: '/api/v1/session/{id}/start' });
    expect(error.message).not.toContain('session-twenty-four');
  });

  it.each([
    ['a path segment', `/api/v1/session/${FAKE_CREDENTIALS.sessionToken}/start`, 'POST', ['path segment 4']],
    ['a query value', `/api/v1/health?token=${FAKE_CREDENTIALS.deviceCredential}`, 'GET', ['query.token']],
    ['a query name', `/api/v1/health?${FAKE_CREDENTIALS.biometricToken}=1`, 'GET', ['query name']],
    ['a short value with the prefix of a credential', '/api/v1/health?q=ses_abc', 'GET', ['query.q']],
  ])('a credential in the URL (%s) is refused and never echoed (CL-6a, SR-15)', async (_name, path, method, issues) => {
    const fake = createFakeTransport();
    fake.answerAllFromExamples();
    const error: unknown = await fake.fetch(`${BASE}${path}`, { method }).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(FakeTransportRequestError);
    expect(error).toMatchObject({ reason: FakeRequestViolation.CREDENTIAL_IN_URL, issues });
    expect(String(error)).not.toMatch(/FAKE-TRANSPORT|ses_abc/);
    expect(String(fake.log)).not.toMatch(/FAKE-TRANSPORT|ses_abc/);
  });

  it('a user part in the URL is a credential in the URL', async () => {
    const fake = createFakeTransport();
    await expect(fake.fetch('http://operator:hunter2@127.0.0.1:4420/api/v1/health')).rejects.toMatchObject({
      reason: FakeRequestViolation.CREDENTIAL_IN_URL,
      issues: ['user part'],
    });
    expect(String(fake.log)).not.toContain('hunter2');
  });

  it('a query on an operation that states none, and a query on a POST, are refused', async () => {
    const fake = createFakeTransport();
    fake.answerAllFromExamples();
    await clientOn(fake).call('getServiceHealth', { query: { limit: 5 } });
    expect(firstViolation(fake, FakeTransportRequestError)).toMatchObject({
      reason: FakeRequestViolation.UNEXPECTED_QUERY,
      operationId: 'getServiceHealth',
      issues: ['query.limit: not in the contract'],
    });
    await expect(fake.fetch(`${BASE}/api/v1/auth/touch?x=1`, { method: 'POST' })).rejects.toMatchObject({
      reason: FakeRequestViolation.UNEXPECTED_QUERY,
      operationId: 'touchSession',
    });
  });

  it.each([
    ['a bearer value without the form of a token', 'Bearer not-a-token', 'omit'],
    ['a biometric token, which never travels in a header (01_specs §5.6)', `Bearer ${FAKE_CREDENTIALS.biometricToken}`, 'omit'],
    ['another scheme', `Basic ${FAKE_CREDENTIALS.sessionToken}`, 'omit'],
    ['a bearer value on a request that also sends the cookie (ID-12)', `Bearer ${FAKE_CREDENTIALS.sessionToken}`, 'same-origin'],
  ])('credential form: %s is refused, and the value is not in the error', async (_name, authorization, credentials) => {
    const fake = createFakeTransport();
    fake.answerAllFromExamples();
    const error: unknown = await fake.fetch(`${BASE}/api/v1/auth/session`, { headers: { Authorization: authorization }, credentials }).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(FakeTransportRequestError);
    expect(error).toMatchObject({ reason: FakeRequestViolation.INVALID_CREDENTIAL_FORM, operationId: 'getAuthSession' });
    expect(String(error)).not.toMatch(/FAKE-TRANSPORT|not-a-token/);
  });

  it('a cookie header beside a bearer value is two credentials in one request (ID-12)', async () => {
    const fake = createFakeTransport();
    const headers = { authorization: `Bearer ${FAKE_CREDENTIALS.sessionToken}`, cookie: 'dems_session_4420=abc' };
    await expect(fake.fetch(`${BASE}/api/v1/auth/session`, { headers, credentials: 'omit' })).rejects.toMatchObject({
      reason: FakeRequestViolation.INVALID_CREDENTIAL_FORM,
      issues: ['cookie: one credential per request, no cookie beside a bearer value'],
    });
  });

  it('the typed client with a credential provider that returns no token form is caught through the real client', async () => {
    const fake = createFakeTransport();
    fake.answerAllFromExamples();
    expect(await clientOn(fake, () => 'plainvalue').call('getAuthSession')).toMatchObject({ ok: false, kind: CoreErrorKind.NETWORK });
    expect(firstViolation(fake, FakeTransportRequestError).reason).toBe(FakeRequestViolation.INVALID_CREDENTIAL_FORM);
  });

  it.each([
    ['a body on a GET', '/api/v1/health', { method: 'GET', body: '{}', headers: { 'content-type': 'application/json' } }, FakeRequestViolation.UNEXPECTED_BODY],
    ['a body on an operation that takes none', '/api/v1/auth/touch', { method: 'POST', body: '{}', headers: { 'content-type': 'application/json' } }, FakeRequestViolation.UNEXPECTED_BODY],
    ['a required body left out', '/api/v1/session', { method: 'POST' }, FakeRequestViolation.MISSING_BODY],
    ['a body that is not JSON', `/api/v1/session/${SESSION_ID}/stop`, { method: 'POST', body: 'reason=done', headers: { 'content-type': 'application/json' } }, FakeRequestViolation.BODY_NOT_JSON],
    ['a body that is not text', `/api/v1/session/${SESSION_ID}/stop`, { method: 'POST', body: { reason: 'Interview completed' }, headers: { 'content-type': 'application/json' } }, FakeRequestViolation.BODY_NOT_JSON],
    ['a body without content-type: application/json', `/api/v1/session/${SESSION_ID}/stop`, { method: 'POST', body: '{"reason":"Interview completed"}' }, FakeRequestViolation.INVALID_HEADERS],
    ['a header value that is not text', '/api/v1/health', { headers: { 'x-count': 3 } }, FakeRequestViolation.INVALID_HEADERS],
    ['a body above 65,536 bytes (API-4)', `/api/v1/session/${SESSION_ID}/stop`, { method: 'POST', body: JSON.stringify({ reason: 'é'.repeat(32_768) }), headers: { 'content-type': 'application/json' } }, FakeRequestViolation.BODY_TOO_LARGE],
  ])('%s is refused', async (_name, path, init, reason) => {
    const fake = createFakeTransport();
    fake.answerAllFromExamples();
    await expect(fake.fetch(`${BASE}${path}`, init)).rejects.toMatchObject({ name: 'FakeTransportRequestError', reason });
    expect(fake.violations).toHaveLength(1);
  });

  it('headers are read from a record, from a list of pairs and from an object with forEach', async () => {
    const fake = createFakeTransport();
    fake.answerAllFromExamples();
    const bearer = `Bearer ${FAKE_CREDENTIALS.deviceCredential}`;
    await fake.fetch(`${BASE}/api/v1/pairing/device`, { headers: { Authorization: bearer }, credentials: 'omit' });
    await fake.fetch(`${BASE}/api/v1/pairing/device`, { headers: [['Authorization', bearer]], credentials: 'omit' });
    await fake.fetch(`${BASE}/api/v1/pairing/device`, { headers: new Map([['Authorization', bearer]]), credentials: 'omit' });
    expect(fake.calls.map((call) => call.headers.authorization)).toEqual([bearer, bearer, bearer]);
    fake.assertNoViolations();
  });

  it('a valid request with no scripted answer fails with FakeTransportUnscriptedError', async () => {
    const fake = createFakeTransport();
    expect(await clientOn(fake).call('getDeviceHealth')).toMatchObject({ ok: false, kind: CoreErrorKind.NETWORK });
    const error = firstViolation(fake, FakeTransportUnscriptedError);
    expect(error).toMatchObject({ name: 'FakeTransportUnscriptedError', operationId: 'getDeviceHealth', reason: 'NO_ANSWER_SCRIPTED' });
    expect(error.message).toContain('GET /api/v1/device/health (getDeviceHealth)');
    expect(fake.calls[0]?.outcome).toBe('unscripted');
  });
});

// ── A table written by hand: the query schema, before the registry has a list read ───────────────

const LIST_TABLE: readonly CoreApiOperation[] = [
  {
    operationId: 'listThings',
    method: 'get',
    path: '/api/v1/things',
    tag: CoreApiTag.SERVICE,
    mode: CoreApiMode.LIVE,
    summary: 'List',
    description: 'A list read with a query schema.',
    source: 'test',
    query: { schema: 'SessionStartRequest' },
    responses: { 200: { description: 'ok', schema: 'HealthResponse' } },
  },
  {
    operationId: 'removeThing',
    method: 'post',
    path: '/api/v1/things/{id}/remove',
    tag: CoreApiTag.SERVICE,
    mode: CoreApiMode.LIVE,
    summary: 'Remove',
    description: 'A command without a body.',
    source: 'test',
    pathParam: { name: 'id', description: 'thing', pattern: /^T-\d+$/ },
    responses: { 204: { description: 'done' }, 404: { description: 'not found', schema: 'ApiError' } },
  },
];
const LIST_SCHEMAS = {
  ...CORE_API_SCHEMAS,
  // Stands in for a list query: a number, a boolean and a text member.
  SessionStartRequest: z.strictObject({ limit: z.int().min(1).max(100), all: z.boolean().optional(), cursor: z.string().min(1).optional() }),
};
const HEALTH = CORE_API_EXAMPLES.getServiceHealth?.responses[200]?.live?.value;

describe('a table passed in: the same checks against its own operations and schemas', () => {
  const listFake = () => createFakeTransport({ operations: LIST_TABLE, schemas: LIST_SCHEMAS });
  const listClient = (fake: FakeTransport) =>
    createCoreClient({ baseUrl: BASE, credentials: 'browser-cookie', fetch: fake.fetch, operations: LIST_TABLE, schemas: LIST_SCHEMAS });

  it('a query the schema accepts passes: a number and a boolean travel as text and are read back', async () => {
    const fake = listFake();
    fake.answer('listThings', { status: 200, body: HEALTH });
    const client = listClient(fake);
    expect(await client.call('listThings', { query: { limit: 20, all: true, cursor: 'abc' } })).toMatchObject({ ok: true });
    expect(fake.calls[0]).toMatchObject({ query: { limit: '20', all: 'true', cursor: 'abc' }, operationId: 'listThings' });
    fake.assertDone();
  });

  it('a query the schema refuses fails with the issue path: out of range, a missing member, an unknown member, a repeated member', async () => {
    const fake = listFake();
    fake.answer('listThings', { status: 200, body: HEALTH });
    const refused = async (query: string) => (await fake.fetch(`${BASE}/api/v1/things${query}`).catch((error: unknown) => error)) as FakeTransportRequestError;
    expect(await refused('?limit=500')).toMatchObject({ name: 'FakeTransportRequestError', reason: FakeRequestViolation.INVALID_QUERY, issues: ['limit: too_big'] });
    expect(await refused('')).toMatchObject({ reason: FakeRequestViolation.INVALID_QUERY, issues: ['limit: invalid_type'] });
    expect(await refused('?limit=5&stray=1')).toMatchObject({ reason: FakeRequestViolation.INVALID_QUERY, issues: ['(root): unrecognized_keys'] });
    expect(await refused('?limit=5&limit=6')).toMatchObject({ reason: FakeRequestViolation.INVALID_QUERY, issues: ['limit: repeated'] });
    expect(await refused('?limit=abc')).toMatchObject({ reason: FakeRequestViolation.INVALID_QUERY, issues: ['limit: invalid_type'] });
    expect(fake.violations).toHaveLength(5);
  });

  it('answers are checked against the table: a 204 has no body, a status the table lacks is refused, the pipeline answers pass', async () => {
    const fake = listFake();
    expect(thrownBy(() => fake.answer('removeThing', { status: 204, body: {} }))).toMatchObject({ reason: FakeResponseViolation.UNEXPECTED_BODY });
    expect(thrownBy(() => fake.answer('removeThing', { status: 200, body: {} }))).toMatchObject({ reason: FakeResponseViolation.UNDOCUMENTED_STATUS });
    expect(thrownBy(() => fake.answer('listThings', { status: 200, body: { status: 'ok' } }))).toMatchObject({ reason: FakeResponseViolation.INVALID_BODY });
    expect(thrownBy(() => fake.answer('getServiceHealth', { status: 200, body: HEALTH }))).toMatchObject({ reason: FakeResponseViolation.UNKNOWN_OPERATION });
    fake.answerOnce('removeThing', { status: 204 });
    fake.answerOnce('removeThing', rateLimited(3));
    fake.answerOnce('removeThing', refusal(404, 'NOT_FOUND', 'No such thing.'));
    const client = listClient(fake);
    expect(await client.call('removeThing', { params: { id: 'T-1' } })).toMatchObject({ ok: true, status: 204, epoch: 1, revision: 0 });
    expect(await client.call('removeThing', { params: { id: 'T-1' } })).toMatchObject({ ok: false, status: 429, retryAfterSeconds: 3 });
    expect(await client.call('removeThing', { params: { id: 'T-1' } })).toMatchObject({ ok: false, status: 404 });
    await client.call('removeThing', { params: { id: 'thing-1' } });
    expect(firstViolation(fake, FakeTransportRequestError).reason).toBe(FakeRequestViolation.INVALID_PATH_PARAM);
  });

  it('a table that names an operation twice, or a schema the table lacks, is a usage error', async () => {
    const [first] = LIST_TABLE;
    expect(() => createFakeTransport({ operations: [first as CoreApiOperation, first as CoreApiOperation] })).toThrow(FakeTransportUsageError);
    const fake = createFakeTransport({ operations: LIST_TABLE, schemas: {} });
    expect(() => fake.answer('listThings', { status: 200, body: HEALTH })).toThrow(FakeTransportUsageError);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════════════
// Contract check on the way out
// ═══════════════════════════════════════════════════════════════════════════════════════

describe('contract check on the way out: a scripted answer the Core server may not send fails with a named error (AC-C-17)', () => {
  it('a scripted response that violates the schema of its status fails at scripting time: FakeTransportResponseError', () => {
    const fake = createFakeTransport();
    const good = exampleAnswer('getDeviceHealth').body as Record<string, unknown>;
    const error = thrownBy(() => fake.answer('getDeviceHealth', { status: 200, body: { ...good, systemState: 'ON_FIRE' } }));
    expect(error).toBeInstanceOf(FakeTransportResponseError);
    expect(error).toBeInstanceOf(FakeTransportError);
    expect(error).toMatchObject({
      name: 'FakeTransportResponseError',
      reason: FakeResponseViolation.INVALID_BODY,
      operationId: 'getDeviceHealth',
      status: 200,
      stage: 'scripting',
    });
    expect((error as FakeTransportResponseError).issues.join(' ')).toMatch(/^systemState: /);
    expect((error as Error).message).toContain('checked at scripting time');
    // Thrown into the test body, so it is not a recorded violation, and nothing was scripted.
    expect(fake.violations).toEqual([]);
    expect(fake.calls).toEqual([]);
  });

  it.each([
    ['a status the operation does not name', 'getDeviceHealth', { status: 201, body: {} }, FakeResponseViolation.UNDOCUMENTED_STATUS],
    ['a routing answer for a matched operation', 'getDeviceHealth', refusal(405, 'METHOD_NOT_ALLOWED'), FakeResponseViolation.UNDOCUMENTED_STATUS],
    ['a number that is no HTTP status', 'getDeviceHealth', { status: 99 }, FakeResponseViolation.UNDOCUMENTED_STATUS],
    ['a body on a 204', 'signOut', { status: 204, body: {} }, FakeResponseViolation.UNEXPECTED_BODY],
    ['a null body on a 204', 'signOut', { status: 204, body: null }, FakeResponseViolation.UNEXPECTED_BODY],
    ['no body where the status has a schema', 'getDeviceHealth', { status: 200 }, FakeResponseViolation.INVALID_BODY],
    ['an error status whose body is no envelope', 'getAuthSession', { status: 401, body: { message: 'no' } }, FakeResponseViolation.INVALID_BODY],
    ['a pipeline status with a code that is not its own', 'getDeviceHealth', refusal(503, 'RATE_LIMITED'), FakeResponseViolation.INVALID_BODY],
    ['a body that is not a JSON value', 'getDeviceHealth', { status: 200, body: () => 1 }, FakeResponseViolation.INVALID_BODY],
    ['a body given as raw text', 'getDeviceHealth', { status: 200, text: '<html>' }, FakeResponseViolation.BODY_NOT_JSON],
    ['a 429 without retry-after', 'getDeviceHealth', refusal(429, 'RATE_LIMITED'), FakeResponseViolation.INVALID_HEADERS],
    ['a retry-after that is not whole seconds', 'getDeviceHealth', { ...refusal(429, 'RATE_LIMITED'), headers: { [RETRY_AFTER_HEADER_NAME]: 'soon' } }, FakeResponseViolation.INVALID_HEADERS],
    ['a 2xx of a POST without its revision (API-7)', 'stopSession', { ...exampleAnswer('stopSession'), headers: { [REVISION_HEADER_NAME]: null } }, FakeResponseViolation.INVALID_HEADERS],
    ['an epoch that is not an integer', 'stopSession', { ...exampleAnswer('stopSession'), headers: { [EPOCH_HEADER_NAME]: 'e-3' } }, FakeResponseViolation.INVALID_HEADERS],
    ['no request ID', 'getDeviceHealth', { ...exampleAnswer('getDeviceHealth'), headers: { [REQUEST_ID_HEADER_NAME]: null } }, FakeResponseViolation.INVALID_HEADERS],
    ['a request ID that differs from the one of the envelope', 'getAuthSession', { ...exampleAnswer('getAuthSession', 401), requestId: 'another' }, FakeResponseViolation.INVALID_HEADERS],
    ['something that is no reply at all', 'getDeviceHealth', { body: {} } as unknown as FakeAnswer, FakeResponseViolation.NOT_A_REPLY],
  ])('%s is refused at scripting time', (_name, operationId, answer, reason) => {
    const fake = createFakeTransport();
    for (const script of [() => fake.answer(operationId, answer), () => fake.answerOnce(operationId, answer)]) {
      expect(thrownBy(script)).toMatchObject({ name: 'FakeTransportResponseError', reason, operationId, stage: 'scripting' });
    }
    expect(fake.violations).toEqual([]);
  });

  it('an answer for an operation ID the registry does not hold is refused at scripting time', () => {
    const fake = createFakeTransport();
    for (const script of [
      () => fake.answer('launchMissiles', { status: 200 }),
      () => fake.answerOnce('launchMissiles', { status: 200 }),
      () => fake.hold('launchMissiles'),
      () => fake.fail('launchMissiles'),
      () => fake.answerFromExample('launchMissiles'),
    ]) {
      expect(thrownBy(script)).toMatchObject({ name: 'FakeTransportResponseError', reason: FakeResponseViolation.UNKNOWN_OPERATION, operationId: 'launchMissiles' });
    }
  });

  it('what a responder function returns is checked at answer time: rejected, recorded, and the log says so', async () => {
    const fake = createFakeTransport();
    fake.answer('getDeviceHealth', () => ({ status: 200, body: { systemState: 'ON_FIRE' } }));
    expect(await clientOn(fake).call('getDeviceHealth')).toMatchObject({ ok: false, kind: CoreErrorKind.NETWORK });
    const error = firstViolation(fake, FakeTransportResponseError);
    expect(error).toMatchObject({ reason: FakeResponseViolation.INVALID_BODY, operationId: 'getDeviceHealth', status: 200, stage: 'answering' });
    expect(error.message).toContain('checked at answering time');
    expect(fake.calls[0]?.outcome).toBe('bad-answer');
    expect(() => fake.assertNoViolations()).toThrow(error);
  });

  it('a responder that returns no reply, or throws, fails the request; a named error it throws is recorded', async () => {
    const fake = createFakeTransport();
    fake.answerOnce('getDeviceHealth', () => undefined as unknown as FakeAnswer);
    fake.answerOnce('getDeviceHealth', () => fake.example('getDeviceHealth', 200, 'noSuchExample'));
    fake.answerOnce('getDeviceHealth', () => {
      throw new RangeError('responder broke');
    });
    await expect(fake.fetch(`${BASE}/api/v1/device/health`)).rejects.toMatchObject({ reason: FakeResponseViolation.NOT_A_REPLY, stage: 'answering' });
    await expect(fake.fetch(`${BASE}/api/v1/device/health`)).rejects.toMatchObject({ name: 'FakeTransportUsageError', reason: 'NO_EXAMPLE' });
    await expect(fake.fetch(`${BASE}/api/v1/device/health`)).rejects.toBeInstanceOf(RangeError);
    expect(fake.violations.map((violation) => violation.name)).toEqual(['FakeTransportResponseError', 'FakeTransportUsageError']);
    expect(fake.calls.map((call) => call.outcome)).toEqual(['bad-answer', 'bad-answer', 'bad-answer']);
  });

  it('a held answer is checked when it is released, in the test body', async () => {
    const fake = createFakeTransport();
    const held = fake.hold('getDeviceHealth');
    const pending = clientOn(fake).call('getDeviceHealth');
    await fake.arrived();
    expect(thrownBy(() => held.release({ status: 418, body: {} }))).toMatchObject({ name: 'FakeTransportResponseError', stage: 'scripting' });
    expect(held.settled).toBe(false);
    held.release();
    expect(await pending).toMatchObject({ ok: true });
    fake.assertDone();
  });

  it.each([
    ['a body its schema refuses', 'getDeviceHealth', { status: 200, body: { systemState: 'ON_FIRE' } }, 'does not match DeviceHealthResponse'],
    ['a 2xx status the operation does not name', 'getDeviceHealth', { status: 201, body: {} }, 'not a documented answer'],
    ['a body on a 204', 'signOut', { status: 204, body: { left: true } }, 'has a body where the contract has none'],
    ['text that is not JSON', 'getDeviceHealth', { status: 200, text: '<html>gateway</html>' }, 'is not JSON'],
    ['an error status without an envelope', 'getDeviceHealth', { status: 502, text: 'Bad Gateway' }, 'not a JSON error envelope'],
  ])('a deliberate violation (%s) is delivered as scripted, and the real client reports CONTRACT_VIOLATION', async (_name, operationId, answer, message) => {
    const fake = createFakeTransport();
    fake.answer(operationId, { ...answer, violatesContract: true });
    const result = await clientOn(fake).call(operationId);
    expect(result).toMatchObject({ ok: false, kind: CoreErrorKind.CONTRACT_VIOLATION, status: answer.status, error: { code: 'CONTRACT_VIOLATION' } });
    expect(result.ok ? '' : result.error.message).toContain(message);
    expect(fake.calls[0]).toMatchObject({ outcome: 'answered', status: answer.status });
    fake.assertDone();
  });

  it('a deliberate violation may leave out a header the contract requires: the client reads null (API-7)', async () => {
    const fake = createFakeTransport();
    fake.answer('stopSession', { ...exampleAnswer('stopSession'), headers: { [REVISION_HEADER_NAME]: null }, violatesContract: true });
    expect(await clientOn(fake).call('stopSession', exampleInput('stopSession'))).toMatchObject({ ok: true, epoch: 1, revision: null });
    fake.assertDone();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════════════
// Ending a test
// ═══════════════════════════════════════════════════════════════════════════════════════

describe('ending a test: what the client swallowed still fails it', () => {
  it('assertDone names the one-shot answers nobody asked for', async () => {
    const fake = createFakeTransport();
    fake.answerOnceFromExample('getDeviceHealth');
    fake.answerOnceFromExample('getAudioStatus');
    fake.hold('getVideoStatus');
    await clientOn(fake).call('getDeviceHealth');
    const error = thrownBy(() => fake.assertDone());
    expect(error).toMatchObject({ name: 'FakeTransportUsageError', reason: 'UNUSED_ANSWERS' });
    expect((error as Error).message).toContain('getAudioStatus, getVideoStatus');
    expect(() => fake.assertNoViolations()).not.toThrow();
  });

  it('reset forgets the answers, the violations and the log', async () => {
    const fake = createFakeTransport();
    fake.answerFromExample('getDeviceHealth');
    await clientOn(fake).call('getDeviceHealth');
    await clientOn(fake).call('getAudioStatus');
    expect(fake.violations).toHaveLength(1);
    fake.reset();
    expect(fake.violations).toEqual([]);
    expect(fake.calls).toEqual([]);
    expect(await clientOn(fake).call('getDeviceHealth')).toMatchObject({ ok: false, kind: CoreErrorKind.NETWORK });
    expect(fake.violations[0]).toBeInstanceOf(FakeTransportUnscriptedError);
  });

  it('withFakeTransport fails a test whose client swallowed a violation, and passes the result of a clean one', async () => {
    await expect(
      withFakeTransport(async (fake) => {
        // No answer is scripted: the client reports NETWORK and the body itself does not fail.
        return (await clientOn(fake).call('getDeviceHealth')).ok;
      }),
    ).rejects.toBeInstanceOf(FakeTransportUnscriptedError);

    await expect(
      withFakeTransport(async (fake) => {
        fake.answerFromExample('getDeviceHealth');
        return (await clientOn(fake).call('getDeviceHealth')).status;
      }),
    ).resolves.toBe(200);
  });

  it('withFakeTransport reports the violation when the body fails after one, with the failure of the body as its cause', async () => {
    const bodyFailure = new Error('expected ok to be true');
    const error = await withFakeTransport(async (fake) => {
      const result = await clientOn(fake).call('stopSession', { params: { id: SESSION_ID }, body: { reason: 'x' } });
      if (!result.ok) throw bodyFailure;
    }).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(FakeTransportRequestError);
    expect((error as Error).cause).toBe(bodyFailure);

    const alone = new Error('a failure without a violation');
    await expect(withFakeTransport(() => Promise.reject(alone))).rejects.toBe(alone);
  });

  it('withFakeTransport takes the options of createFakeTransport', async () => {
    const position = await withFakeTransport((fake) => ({ ...fake.position }), { epoch: 9, revision: 2 });
    expect(position).toEqual({ epoch: 9, revision: 2 });
  });
});
