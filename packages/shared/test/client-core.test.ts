// HB-9, the registry-driven typed client (backend task 04_client_integration_spec §2.1, CL-1 to
// CL-6a; AC-C-01, AC-C-03, AC-C-04). No network: every test injects a recording fake transport.
//
// Most tests here are about what the client does at run time with input the types forbid (an unknown
// ID, an empty body, a missing parameter). They build the client on the registry's widened view,
// `operations: CORE_API_OPERATIONS`, which takes plain string IDs and loose input. The default client
// (no `operations`) is typed per operation; its types are tested in client-types.test.ts and its run
// time in the block "the default client" below.
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
  REVISION_HEADER_NAME,
  type CoreApiOperation,
} from '../src/api';
import {
  CoreClientUsageError,
  CoreErrorKind,
  LIVE_COMMAND_TIMEOUT_MS,
  coreErrorKindForStatus,
  coreTransportReason,
  createCoreClient,
  parseCounterHeader,
  parseRetryAfter,
  type CoreClientLogLine,
  type CoreClientReport,
  type CoreCredentials,
  type CoreFetch,
  type CoreFetchInit,
} from '../src/client';

const BASE = 'http://127.0.0.1:4420';
/** An obviously fake value with the shape of a device credential; built at run time, never a real one. */
const FAKE_BEARER = `dvc_TEST_FAKE_${'0123456789abcdef'.repeat(2)}`;

interface Answer {
  status: number;
  body?: unknown;
  /** Sent as the body text as is (for answers that are not JSON). */
  text?: string;
  headers?: Record<string, string>;
}
interface Recorded {
  url: string;
  init: CoreFetchInit;
}

/** A fetch-compatible fake: records every call and answers with what `answer` returns. */
function fakeTransport(answer: (call: Recorded) => Answer | Promise<Answer>) {
  const calls: Recorded[] = [];
  const fetch: CoreFetch = async (url, init) => {
    const call = { url, init };
    calls.push(call);
    const reply = await answer(call);
    const headers = new Map(Object.entries(reply.headers ?? {}).map(([name, value]) => [name.toLowerCase(), value]));
    return {
      status: reply.status,
      headers: { get: (name: string) => headers.get(name.toLowerCase()) ?? null },
      text: async () => reply.text ?? (reply.body === undefined ? '' : JSON.stringify(reply.body)),
    };
  };
  return { fetch, calls };
}

function example(operationId: string, status: number): unknown {
  const byName = CORE_API_EXAMPLES[operationId]?.responses[status];
  const first = byName ? Object.values(byName)[0] : undefined;
  if (!first) throw new Error(`no example for ${operationId} ${status}`);
  return first.value;
}

function mobileClient(answer: (call: Recorded) => Answer | Promise<Answer>, credentials: CoreCredentials = () => FAKE_BEARER) {
  const transport = fakeTransport(answer);
  const log: CoreClientLogLine[] = [];
  const reports: CoreClientReport[] = [];
  const client = createCoreClient({
    baseUrl: BASE,
    credentials,
    fetch: transport.fetch,
    operations: CORE_API_OPERATIONS, // the widened view: string IDs, loose input
    log: (line) => log.push(line),
    report: (entry) => reports.push(entry),
  });
  return { client, calls: transport.calls, log, reports };
}

const EXPORT_INPUT = { params: { id: 'EV-20260930-0004' }, body: { reason: 'Prosecutor review', destination: 'USB-01' } };
const apiError = (code: string, message = 'refused') => ({ error: { code, message } });

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('AC-C-01: every registry operation is callable', () => {
  it('offers exactly the operation IDs of the registry, in its order', () => {
    const { client } = mobileClient(() => ({ status: 500 }));
    expect(client.operationIds).toEqual(CORE_API_OPERATIONS.map((operation) => operation.operationId));
    expect(client.operationIds).toHaveLength(CORE_API_OPERATIONS.length);
    expect(new Set(client.operationIds).size).toBe(CORE_API_OPERATIONS.length);
  });

  it('describes each operation from the registry and knows no other', () => {
    const { client } = mobileClient(() => ({ status: 500 }));
    for (const operation of CORE_API_OPERATIONS) {
      expect(client.describe(operation.operationId)).toEqual({
        operationId: operation.operationId,
        method: operation.method.toUpperCase(),
        path: operation.path,
        hasBody: operation.requestBody !== undefined,
        pathParam: operation.pathParam?.name ?? null,
      });
    }
    expect(client.describe('noSuchOperation')).toBeNull();
  });

  it('calls each operation and returns every documented example as a typed success or a typed error envelope', async () => {
    let exchanges = 0;
    for (const operation of CORE_API_OPERATIONS) {
      const examples = CORE_API_EXAMPLES[operation.operationId];
      expect(examples, `examples of ${operation.operationId}`).toBeDefined();
      const requestExample = examples?.request ? Object.values(examples.request)[0]?.value : undefined;
      const input = {
        ...(examples?.pathParams ? { params: examples.pathParams } : {}),
        ...(requestExample !== undefined ? { body: requestExample } : {}),
      };
      const statuses = Object.keys(operation.responses).map(Number);
      expect(statuses.some((status) => status >= 200 && status <= 299)).toBe(true);

      for (const status of statuses) {
        // A success without a body (204) has no schema and no example: the answer is empty.
        const schemaName = operation.responses[status]?.schema;
        const body = schemaName ? example(operation.operationId, status) : undefined;
        const { client, calls } = mobileClient(() => ({ status, body }));
        const result = await client.call(operation.operationId, input);
        exchanges += 1;

        expect(calls).toHaveLength(1);
        expect(calls[0]?.init.method).toBe(operation.method.toUpperCase());
        const expectedPath = operation.path.replace('{id}', encodeURIComponent(examples?.pathParams?.id ?? ''));
        expect(calls[0]?.url).toBe(`${BASE}${expectedPath}`);

        if (status >= 200 && status <= 299) {
          expect(result).toMatchObject({ ok: true, operationId: operation.operationId, status });
          if (result.ok && schemaName) expect(result.data).toEqual(CORE_API_SCHEMAS[schemaName].parse(body));
          if (result.ok && !schemaName) expect(result.data).toBeUndefined();
        } else {
          expect(result).toMatchObject({
            ok: false,
            operationId: operation.operationId,
            status,
            kind: coreErrorKindForStatus(status),
            error: (body as { error: unknown }).error,
          });
        }
      }
    }
    // The loop follows the registry: 37 operations after contract A, 75 at the end.
    expect(exchanges).toBe(CORE_API_OPERATIONS.reduce((sum, operation) => sum + Object.keys(operation.responses).length, 0));
    expect(CORE_API_OPERATIONS.length).toBeGreaterThanOrEqual(37);
  });
});

describe('request building', () => {
  it('GET: no body, no content-type, accept JSON', async () => {
    const { client, calls } = mobileClient(() => ({ status: 200, body: example('getServiceHealth', 200) }));
    await client.call('getServiceHealth');
    expect(calls[0]?.url).toBe(`${BASE}/api/v1/health`);
    expect(calls[0]?.init.method).toBe('GET');
    expect(calls[0]?.init.body).toBeUndefined();
    expect(calls[0]?.init.headers).toEqual({ accept: 'application/json', authorization: `Bearer ${FAKE_BEARER}` });
  });

  it('POST with a body: the JSON text and its content-type', async () => {
    const { client, calls } = mobileClient(() => ({ status: 202, body: example('exportEvidence', 202) }));
    await client.call('exportEvidence', EXPORT_INPUT);
    expect(calls[0]?.init.method).toBe('POST');
    expect(calls[0]?.init.headers['content-type']).toBe('application/json');
    expect(JSON.parse(calls[0]?.init.body ?? '')).toEqual(EXPORT_INPUT.body);
  });

  it('POST with an optional body left out: no body and no content-type', async () => {
    const { client, calls } = mobileClient(() => ({ status: 202, body: example('startSession', 202) }));
    const result = await client.call('startSession', { params: { id: 'SES-20261001-0024' } });
    expect(result.ok).toBe(true);
    expect(calls[0]?.url).toBe(`${BASE}/api/v1/session/SES-20261001-0024/start`);
    expect(calls[0]?.init.body).toBeUndefined();
    expect(calls[0]?.init.headers).not.toHaveProperty('content-type');
  });

  it('a path parameter is percent-encoded into the template', async () => {
    const { client, calls } = mobileClient(() => ({ status: 404, body: apiError('NOT_FOUND') }));
    await client.call('exportEvidence', { params: { id: 'a/b c?d#e' }, body: EXPORT_INPUT.body });
    expect(calls[0]?.url).toBe(`${BASE}/api/v1/evidence/a%2Fb%20c%3Fd%23e/export`);
  });

  it('a query is encoded on a GET; null and undefined members are left out', async () => {
    const { client, calls } = mobileClient(() => ({ status: 200, body: example('getCurrentSession', 200) }));
    await client.call('getCurrentSession', { query: { cursor: 'a b&c', limit: 50, all: false, skipped: undefined, none: null } });
    expect(calls[0]?.url).toBe(`${BASE}/api/v1/session/current?cursor=a%20b%26c&limit=50&all=false`);
  });

  it('the base URL may end with one slash, or be empty for same-origin relative URLs', async () => {
    const answer = () => ({ status: 200, body: example('getServiceHealth', 200) });
    const slash = fakeTransport(answer);
    await createCoreClient({ baseUrl: `${BASE}/`, credentials: 'browser-cookie', fetch: slash.fetch }).call('getServiceHealth');
    expect(slash.calls[0]?.url).toBe(`${BASE}/api/v1/health`);
    const relative = fakeTransport(answer);
    await createCoreClient({ baseUrl: '', credentials: 'browser-cookie', fetch: relative.fetch }).call('getServiceHealth');
    expect(relative.calls[0]?.url).toBe('/api/v1/health');
  });

  it('uses the global fetch when none is injected (CL-3)', async () => {
    const seen: string[] = [];
    vi.stubGlobal('fetch', async (url: string) => {
      seen.push(url);
      return { status: 200, headers: { get: () => null }, text: async () => JSON.stringify(example('getServiceHealth', 200)) };
    });
    const result = await createCoreClient({ baseUrl: BASE, credentials: 'browser-cookie' }).call('getServiceHealth');
    expect(result.ok).toBe(true);
    expect(seen).toEqual([`${BASE}/api/v1/health`]);
  });
});

describe('programming errors reject with CoreClientUsageError (CL-1), before any request', () => {
  const cases: [string, (client: ReturnType<typeof mobileClient>['client']) => Promise<unknown>][] = [
    ['an unknown operation', (client) => client.call('noSuchOperation')],
    ['a missing path parameter', (client) => client.call('exportEvidence', { body: EXPORT_INPUT.body })],
    ['an unknown path parameter', (client) => client.call('getServiceHealth', { params: { id: 'x' } })],
    ['a body on an operation without one', (client) => client.call('getServiceHealth', { body: {} })],
    ['a missing required body', (client) => client.call('exportEvidence', { params: EXPORT_INPUT.params })],
    ['a query on a POST', (client) => client.call('exportEvidence', { ...EXPORT_INPUT, query: { limit: 1 } })],
    ['a credential in a query value (CL-6a)', (client) => client.call('getCurrentSession', { query: { token: 'ses_abc' } })],
    ['the bearer value in a query value (CL-6a)', (client) => client.call('getCurrentSession', { query: { q: `x${FAKE_BEARER}` } })],
    ['a credential as a path parameter (CL-6a)', (client) => client.call('exportEvidence', { params: { id: 'dvc_abc' }, body: EXPORT_INPUT.body })],
  ];
  it.each(cases)('%s', async (_name, run) => {
    const { client, calls } = mobileClient(() => ({ status: 200, body: {} }));
    await expect(run(client)).rejects.toBeInstanceOf(CoreClientUsageError);
    expect(calls).toHaveLength(0);
  });

  it('a bearer value that cannot be a header value', async () => {
    const { client, calls } = mobileClient(() => ({ status: 200, body: {} }), () => 'two words');
    await expect(client.call('getServiceHealth')).rejects.toBeInstanceOf(CoreClientUsageError);
    expect(calls).toHaveLength(0);
  });

  it.each(['ftp://127.0.0.1', 'http://127.0.0.1:4420/api', 'http://user:pw@127.0.0.1:4420', 'http://127.0.0.1:4420?x=1', '127.0.0.1:4420'])(
    'a base URL that is not a bare origin: %s',
    (baseUrl) => {
      expect(() => createCoreClient({ baseUrl, credentials: 'browser-cookie' })).toThrow(CoreClientUsageError);
    },
  );

  it('an operation table that names an ID twice', () => {
    const twice = [CORE_API_OPERATIONS[0], CORE_API_OPERATIONS[0]] as readonly CoreApiOperation[];
    expect(() => createCoreClient({ baseUrl: BASE, credentials: 'browser-cookie', operations: twice })).toThrow(CoreClientUsageError);
  });
});

describe('AC-C-03: response validation (CL-4)', () => {
  it('a valid 2xx body is returned as parsed by its schema', async () => {
    const body = example('createSession', 201);
    const { client, reports } = mobileClient(() => ({ status: 201, body }));
    const result = await client.call('createSession', { body: Object.values(CORE_API_EXAMPLES.createSession?.request ?? {})[0]?.value });
    expect(result).toEqual({ ok: true, operationId: 'createSession', status: 201, data: body, epoch: null, revision: null, requestId: null });
    expect(reports).toEqual([]);
  });

  it('members the schema does not know are dropped, not passed on', async () => {
    const { client } = mobileClient(() => ({ status: 201, body: { sessionId: 'SES-20261001-0024', state: 'CREATE', created: true, extra: 'x' } }));
    const result = await client.call('createSession', { body: {} });
    expect(result.ok && result.data).toEqual({ sessionId: 'SES-20261001-0024', state: 'CREATE', created: true });
  });

  it('a 2xx body that violates its schema becomes CONTRACT_VIOLATION, is reported, and its content is not returned', async () => {
    const { client, reports } = mobileClient(() => ({ status: 201, body: { sessionId: 'not-an-id', state: 'NOPE', leaked: 'value' } }));
    const result = await client.call('createSession', { body: {} });
    expect(result).toMatchObject({
      ok: false,
      kind: CoreErrorKind.CONTRACT_VIOLATION,
      status: 201,
      error: { code: 'CONTRACT_VIOLATION' },
      transport: 'UNAVAILABLE',
    });
    expect(result).not.toHaveProperty('data');
    expect(!result.ok && result.issues).toEqual(['sessionId: invalid_format', 'state: invalid_value']);
    expect(JSON.stringify(result)).not.toContain('leaked');
    expect(reports).toHaveLength(1);
    expect(reports[0]).toMatchObject({ level: 'error', source: 'CoreClient.call', operationId: 'createSession', method: 'POST', path: '/api/v1/session', kind: 'CONTRACT_VIOLATION', status: 201 });
    expect(JSON.stringify(reports[0])).not.toContain('leaked');
  });

  it.each([
    ['a 2xx status the operation does not document', { status: 204 }],
    ['a 2xx answer that is not JSON', { status: 201, text: '<html>ok</html>' }],
    ['a 2xx answer with an empty body', { status: 201, text: '' }],
    ['a status outside 2xx, 4xx and 5xx', { status: 302, body: apiError('MOVED') }],
  ])('%s is a CONTRACT_VIOLATION', async (_name, answer) => {
    const { client } = mobileClient(() => answer);
    const result = await client.call('createSession', { body: {} });
    expect(result).toMatchObject({ ok: false, kind: 'CONTRACT_VIOLATION', error: { code: 'CONTRACT_VIOLATION' }, status: answer.status });
  });

  it('a non-2xx body parses as ApiError', async () => {
    const body = example('exportEvidence', 403);
    const { client, reports } = mobileClient(() => ({ status: 403, body }));
    const result = await client.call('exportEvidence', EXPORT_INPUT);
    expect(result).toEqual({
      ok: false,
      operationId: 'exportEvidence',
      kind: 'FORBIDDEN',
      status: 403,
      error: { code: 'FORBIDDEN', message: 'Your role cannot export evidence (RBAC). The attempt was audited.' },
      retryAfterSeconds: null,
      transport: null,
      requestId: null,
    });
    expect(reports).toEqual([]);
  });

  it('a non-2xx body that is not an error envelope is a CONTRACT_VIOLATION; a gateway answer counts as CORE_OFFLINE (WT-4)', async () => {
    const proxyDown = mobileClient(() => ({ status: 502, text: '' }));
    expect(await proxyDown.client.call('getServiceHealth')).toMatchObject({ ok: false, kind: 'CONTRACT_VIOLATION', status: 502, transport: 'CORE_OFFLINE' });
    const wrongShape = mobileClient(() => ({ status: 403, body: { message: 'no envelope' } }));
    expect(await wrongShape.client.call('getServiceHealth')).toMatchObject({ ok: false, kind: 'CONTRACT_VIOLATION', status: 403, transport: 'UNAVAILABLE' });
    expect(wrongShape.reports).toHaveLength(1);
  });
});

describe('error envelope to failure class', () => {
  it.each([
    [400, 'INVALID_JSON', 'BAD_REQUEST', null],
    [401, 'NOT_SIGNED_IN', 'UNAUTHENTICATED', null],
    [403, 'NOT_PERMITTED', 'FORBIDDEN', null],
    [404, 'NOT_FOUND', 'NOT_FOUND', null],
    [405, 'METHOD_NOT_ALLOWED', 'BAD_REQUEST', null],
    [409, 'SESSION_ACTIVE', 'CONFLICT', null],
    [413, 'PAYLOAD_TOO_LARGE', 'BAD_REQUEST', null],
    [422, 'INVALID_INPUT', 'INVALID', null],
    [423, 'LOCKED', 'LOCKED', null],
    [429, 'RATE_LIMITED', 'RATE_LIMITED', 'UNAVAILABLE'],
    [500, 'INTERNAL_ERROR', 'SERVER', 'UNAVAILABLE'],
    [502, 'INTERNAL_ERROR', 'SERVER', 'UNAVAILABLE'],
    [503, 'NOT_READY', 'NOT_READY', 'CORE_OFFLINE'],
  ] as const)('%i %s is %s (transport %s)', async (status, code, kind, transport) => {
    const { client, calls } = mobileClient(() => ({ status, body: apiError(code, 'Operator-safe text.') }));
    const result = await client.call('createSession', { body: {} });
    expect(result).toMatchObject({ ok: false, status, kind, transport, error: { code, message: 'Operator-safe text.' } });
    expect(coreErrorKindForStatus(status)).toBe(kind);
    expect(coreTransportReason(kind, status)).toBe(transport);
    // API-11: nothing is retried.
    expect(calls).toHaveLength(1);
  });

  it('a 429 keeps retry-after as seconds', async () => {
    const { client } = mobileClient(() => ({ status: 429, body: apiError('RATE_LIMITED'), headers: { 'Retry-After': '42' } }));
    const result = await client.call('createSession', { body: {} });
    expect(result).toMatchObject({ ok: false, kind: 'RATE_LIMITED', status: 429, retryAfterSeconds: 42, transport: 'UNAVAILABLE' });
  });

  it('retry-after: delta-seconds, an HTTP date against the clock, absent, unreadable', () => {
    const now = Date.UTC(2026, 9, 4, 0, 0, 0);
    expect(parseRetryAfter('7', now)).toBe(7);
    expect(parseRetryAfter(' 0 ', now)).toBe(0);
    expect(parseRetryAfter('Sun, 04 Oct 2026 00:00:30 GMT', now)).toBe(30);
    expect(parseRetryAfter('Sun, 04 Oct 2026 00:00:00 GMT', now + 5_000)).toBe(0);
    expect(parseRetryAfter(null, now)).toBeNull();
    expect(parseRetryAfter('soon', now)).toBeNull();
  });

  it('a network failure is NETWORK / CORE_OFFLINE, reported, and its message names no URL', async () => {
    const { client, reports, calls } = mobileClient(() => {
      throw new TypeError(`Network request failed: ${BASE}/api/v1/session?secret=1`);
    });
    const result = await client.call('createSession', { body: {} });
    expect(result).toEqual({
      ok: false,
      operationId: 'createSession',
      kind: 'NETWORK',
      status: null,
      error: { code: 'NETWORK', message: 'The Core server did not answer.' },
      retryAfterSeconds: null,
      transport: 'CORE_OFFLINE',
      requestId: null,
    });
    expect(calls).toHaveLength(1);
    expect(reports).toMatchObject([{ level: 'warn', kind: 'NETWORK', status: null, path: '/api/v1/session' }]);
    expect(JSON.stringify([result, reports])).not.toContain('secret');
  });

  it('CL-6: no answer within the time-out is TIMEOUT / CORE_OFFLINE and the request is aborted, not retried', async () => {
    vi.useFakeTimers();
    const signals: (AbortSignal | undefined)[] = [];
    const transport = fakeTransport((call) => {
      signals.push(call.init.signal);
      return new Promise<Answer>(() => undefined); // never answers
    });
    const client = createCoreClient({ baseUrl: BASE, credentials: () => FAKE_BEARER, fetch: transport.fetch, operations: CORE_API_OPERATIONS });
    const pending = client.call('createSession', { body: {} });
    await vi.advanceTimersByTimeAsync(LIVE_COMMAND_TIMEOUT_MS - 1);
    expect(signals[0]?.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(await pending).toMatchObject({ ok: false, kind: 'TIMEOUT', status: null, transport: 'CORE_OFFLINE', error: { code: 'TIMEOUT' } });
    expect(signals[0]?.aborted).toBe(true);
    expect(transport.calls).toHaveLength(1);
    expect(LIVE_COMMAND_TIMEOUT_MS).toBe(8_000);
  });

  it('the time-out also bounds a body that never finishes', async () => {
    vi.useFakeTimers();
    const fetch: CoreFetch = async () => ({ status: 200, headers: { get: () => null }, text: () => new Promise<string>(() => undefined) });
    const pending = createCoreClient({ baseUrl: BASE, credentials: 'browser-cookie', fetch, timeoutMs: 250 }).call('getServiceHealth');
    await vi.advanceTimersByTimeAsync(250);
    expect(await pending).toMatchObject({ ok: false, kind: 'TIMEOUT' });
  });
});

describe('CL-5: x-dems-epoch and x-dems-revision reach the caller as integers (API-7)', () => {
  it('a 2xx answer of a POST carries both', async () => {
    const { client } = mobileClient(() => ({
      status: 201,
      body: example('createSession', 201),
      headers: { 'X-Dems-Epoch': '3', 'x-dems-revision': '1207', 'x-request-id': 'req-000042' },
    }));
    const result = await client.call('createSession', { body: {} });
    expect(result).toMatchObject({ ok: true, epoch: 3, revision: 1207, requestId: 'req-000042' });
    expect(result.ok && Number.isInteger(result.epoch) && Number.isInteger(result.revision)).toBe(true);
  });

  it('a success without a body carries them too', async () => {
    const { client } = mobileClient(() => ({ status: 204, headers: { [EPOCH_HEADER_NAME]: '0', [REVISION_HEADER_NAME]: '0' } }));
    expect(await client.call('signOut')).toMatchObject({ ok: true, status: 204, epoch: 0, revision: 0 });
  });

  it('absent headers are null; a value that is not a non-negative integer is null', async () => {
    const plain = mobileClient(() => ({ status: 200, body: example('getServiceHealth', 200) }));
    expect(await plain.client.call('getServiceHealth')).toMatchObject({ ok: true, epoch: null, revision: null });
    const bad = mobileClient(() => ({ status: 201, body: example('createSession', 201), headers: { 'x-dems-epoch': 'e-1', 'x-dems-revision': '12x' } }));
    expect(await bad.client.call('createSession', { body: {} })).toMatchObject({ ok: true, epoch: null, revision: null });
  });

  it('the header value: decimal digits only, surrounding spaces allowed', () => {
    expect(parseCounterHeader('0')).toBe(0);
    expect(parseCounterHeader(' 42 ')).toBe(42);
    expect(parseCounterHeader(null)).toBeNull();
    for (const value of ['', '-1', '1.5', '1e3', '0x10', 'e-1', '12x', '1234567890123456']) expect(parseCounterHeader(value)).toBeNull();
  });
});

describe('contract A: a success without a body (the five 204 operations)', () => {
  const BODILESS = CORE_API_OPERATIONS.filter((operation) => operation.responses[204] && !operation.responses[204].schema);

  it('the registry has them', () => {
    expect(BODILESS.map((operation) => operation.operationId)).toEqual(
      expect.arrayContaining(['signOut', 'cancelPairingCode', 'unpairDevice', 'injectFault', 'clearFault']),
    );
  });

  it('an empty 204 is a success with no data: nothing is parsed, nothing is reported', async () => {
    const parse = vi.spyOn(JSON, 'parse');
    try {
      const { client, reports, log } = mobileClient(() => ({ status: 204, headers: { [REQUEST_ID_HEADER_NAME]: 'req-204' } }));
      const result = await client.call('cancelPairingCode');
      expect(result).toEqual({ ok: true, operationId: 'cancelPairingCode', status: 204, data: undefined, epoch: null, revision: null, requestId: 'req-204' });
      expect(parse).not.toHaveBeenCalled();
      expect(reports).toEqual([]);
      expect(log).toEqual([{ method: 'POST', path: '/api/v1/pairing/code/cancel', status: 204, requestId: 'req-204' }]);
    } finally {
      parse.mockRestore();
    }
  });

  it('each of them resolves as a success with undefined data', async () => {
    for (const operation of BODILESS) {
      const examples = CORE_API_EXAMPLES[operation.operationId];
      const requestExample = Object.values(examples?.request ?? {})[0]?.value;
      const { client } = mobileClient(() => ({ status: 204 }));
      // Contract C: ten of the 204 operations have a path parameter (`cancelSession`, `archiveEvidence`, ...).
      const result = await client.call(operation.operationId, {
        ...(examples?.pathParams ? { params: examples.pathParams } : {}),
        ...(requestExample !== undefined ? { body: requestExample } : {}),
      });
      expect(result, operation.operationId).toMatchObject({ ok: true, status: 204, data: undefined });
    }
  });

  it('a 204 that does carry a body is a CONTRACT_VIOLATION, and the body is not returned', async () => {
    const { client, reports } = mobileClient(() => ({ status: 204, body: { leaked: 'value' } }));
    const result = await client.call('signOut');
    expect(result).toMatchObject({ ok: false, kind: 'CONTRACT_VIOLATION', status: 204 });
    expect(JSON.stringify([result, reports])).not.toContain('leaked');
  });
});

describe('contract A: the envelope members `details` and `requestId` (01_specs §7.2)', () => {
  const details = { lockedUntil: 1_790_809_889_802, retryInMs: 30_000, attemptsRemaining: 0, reason: 'LOCKOUT', flag: true, none: null };
  const signIn = { body: Object.values(CORE_API_EXAMPLES.signIn?.request ?? {})[0]?.value };

  it('both travel into the failure as the server sent them', async () => {
    const { client } = mobileClient(() => ({ status: 423, body: { error: { code: 'LOCKED', message: 'Too many attempts.', details, requestId: 'req-env-1' } } }));
    const result = await client.call('signIn', signIn);
    expect(result).toEqual({
      ok: false,
      operationId: 'signIn',
      kind: 'LOCKED',
      status: 423,
      error: { code: 'LOCKED', message: 'Too many attempts.', details, requestId: 'req-env-1' },
      retryAfterSeconds: null,
      transport: null,
      requestId: 'req-env-1',
    });
  });

  it('the request ID is the header when the answer has one, the envelope member otherwise', async () => {
    const both = mobileClient(() => ({
      status: 403,
      body: { error: { code: 'NOT_PERMITTED', message: 'Refused.', details: { permission: 'USER_ADMIN' }, requestId: 'req-env-2' } },
      headers: { 'X-Request-Id': 'req-hdr-2' },
    }));
    const withHeader = await both.client.call('listUsers');
    expect(withHeader).toMatchObject({ ok: false, requestId: 'req-hdr-2', error: { requestId: 'req-env-2', details: { permission: 'USER_ADMIN' } } });
    expect(both.log).toEqual([{ method: 'GET', path: '/api/v1/admin/users', status: 403, requestId: 'req-hdr-2' }]);

    const envelopeOnly = mobileClient(() => ({ status: 403, body: { error: { code: 'NOT_PERMITTED', message: 'Refused.', requestId: 'req-env-3' } } }));
    expect(await envelopeOnly.client.call('listUsers')).toMatchObject({ ok: false, requestId: 'req-env-3' });
    expect(envelopeOnly.log[0]?.requestId).toBe('req-env-3');

    const neither = mobileClient(() => ({ status: 403, body: { error: { code: 'NOT_PERMITTED', message: 'Refused.' } } }));
    const plain = await neither.client.call('listUsers');
    expect(plain).toMatchObject({ ok: false, requestId: null });
    expect(!plain.ok && plain.error).toEqual({ code: 'NOT_PERMITTED', message: 'Refused.' });
  });

  it('a `details` that is not a flat map is not the contract: CONTRACT_VIOLATION', async () => {
    const { client } = mobileClient(() => ({ status: 422, body: { error: { code: 'INVALID_INPUT', message: 'No.', details: { nested: { a: 1 } } } } }));
    expect(await client.call('signIn', signIn)).toMatchObject({ ok: false, kind: 'CONTRACT_VIOLATION', status: 422, issues: ['error.details.nested: invalid_union'] });
  });
});

describe('contract A: the query of a GET is parsed with the schema its registry entry names', () => {
  // No operation of contract A has a query; the first list reads come with contract C. A table of one
  // list read stands in, and `SessionStartRequest` is overridden by a list query of the API-9 form.
  const LIST = [
    {
      operationId: 'listThings',
      method: 'get',
      path: '/api/v1/things',
      tag: CoreApiTag.SERVICE,
      mode: CoreApiMode.LIVE,
      summary: 'test',
      description: 'test',
      source: 'test',
      query: { schema: 'SessionStartRequest' },
      responses: { 204: { description: 'nothing to say' } },
    },
    {
      operationId: 'readFree',
      method: 'get',
      path: '/api/v1/free',
      tag: CoreApiTag.SERVICE,
      mode: CoreApiMode.LIVE,
      summary: 'test',
      description: 'test',
      source: 'test',
      responses: { 204: { description: 'nothing to say' } },
    },
  ] as const satisfies readonly CoreApiOperation[];
  const ListQuery = z.object({
    cursor: z.string().min(1).optional(),
    limit: z.int().min(1).max(200).default(50),
    state: z.string().overwrite((value) => value.trim().toUpperCase()).optional(),
  });
  const schemas = { ...CORE_API_SCHEMAS, SessionStartRequest: ListQuery };
  const listClient = () => {
    const transport = fakeTransport(() => ({ status: 204 }));
    const widened: readonly CoreApiOperation[] = LIST;
    return { client: createCoreClient({ baseUrl: BASE, credentials: () => FAKE_BEARER, fetch: transport.fetch, operations: widened, schemas }), calls: transport.calls };
  };

  it('a valid query is sent as the schema parses it: defaults and normalisation apply', async () => {
    const { client, calls } = listClient();
    await client.call('listThings', { query: { cursor: 'abc', limit: 20, state: ' sealed ' } });
    await client.call('listThings', { query: {} });
    await client.call('listThings');
    expect(calls.map((call) => call.url)).toEqual([
      `${BASE}/api/v1/things?cursor=abc&limit=20&state=SEALED`,
      `${BASE}/api/v1/things?limit=50`,
      `${BASE}/api/v1/things?limit=50`,
    ]);
  });

  it('members the schema does not know are not sent', async () => {
    const { client, calls } = listClient();
    await client.call('listThings', { query: { limit: 5, stray: 'x' } });
    expect(calls[0]?.url).toBe(`${BASE}/api/v1/things?limit=5`);
  });

  it.each([
    ['a value out of range', { limit: 500 }, 'limit: too_big'],
    ['a value of the wrong type', { limit: 'ten' }, 'limit: invalid_type'],
    ['an empty cursor', { cursor: '' }, 'cursor: too_small'],
  ])('%s is a programming error, before any request', async (_name, query, issue) => {
    const { client, calls } = listClient();
    const call = client.call('listThings', { query });
    await expect(call).rejects.toBeInstanceOf(CoreClientUsageError);
    await expect(call).rejects.toThrow(issue);
    expect(calls).toHaveLength(0);
  });

  it('the credential guard still applies to a parsed query (CL-6a)', async () => {
    const { client, calls } = listClient();
    await expect(client.call('listThings', { query: { cursor: 'ses_abc' } })).rejects.toBeInstanceOf(CoreClientUsageError);
    expect(calls).toHaveLength(0);
  });

  it('an operation without a query schema sends the flat record as given', async () => {
    const { client, calls } = listClient();
    await client.call('readFree', { query: { limit: 500, any: 'thing' } });
    expect(calls[0]?.url).toBe(`${BASE}/api/v1/free?limit=500&any=thing`);
  });

  it('a query schema that is not an object schema is a programming error', async () => {
    const transport = fakeTransport(() => ({ status: 204 }));
    const widened: readonly CoreApiOperation[] = LIST;
    const client = createCoreClient({
      baseUrl: BASE,
      credentials: 'browser-cookie',
      fetch: transport.fetch,
      operations: widened,
      schemas: { ...CORE_API_SCHEMAS, SessionStartRequest: z.string() },
    });
    await expect(client.call('listThings', { query: {} })).rejects.toBeInstanceOf(CoreClientUsageError);
    expect(transport.calls).toHaveLength(0);
  });
});

describe('the default client: the registry with its literal types', () => {
  it('calls typed operations and returns typed data at run time', async () => {
    const transport = fakeTransport(({ url }) =>
      url.endsWith('/export')
        ? { status: 202, body: example('exportEvidence', 202) }
        : url.endsWith('/sign-out')
          ? { status: 204 }
          : { status: 200, body: example('getServiceHealth', 200) },
    );
    const client = createCoreClient({ baseUrl: BASE, credentials: () => FAKE_BEARER, fetch: transport.fetch });
    expect(client.operationIds).toEqual(CORE_API_OPERATIONS.map((operation) => operation.operationId));

    const health = await client.call('getServiceHealth');
    expect(health.ok && health.data.status).toBe('ok');
    const exported = await client.call('exportEvidence', EXPORT_INPUT);
    expect(exported.ok && exported.data.status).toBe('EXPORTED');
    const signedOut = await client.call('signOut');
    expect(signedOut.ok && signedOut.status).toBe(204);
    expect(transport.calls.map((call) => `${call.init.method} ${call.url}`)).toEqual([
      `GET ${BASE}/api/v1/health`,
      `POST ${BASE}/api/v1/evidence/EV-20260930-0004/export`,
      `POST ${BASE}/api/v1/auth/sign-out`,
    ]);
  });
});

describe('AC-C-04: credentials (CL-2) and the debug log (CL-6a)', () => {
  it('mobile: exactly one Authorization header with the bearer value, and no cookie', async () => {
    const { client, calls } = mobileClient(() => ({ status: 202, body: example('exportEvidence', 202) }));
    await client.call('exportEvidence', EXPORT_INPUT);
    const names = Object.keys(calls[0]?.init.headers ?? {}).filter((name) => name.toLowerCase() === 'authorization');
    expect(names).toEqual(['authorization']);
    expect(calls[0]?.init.headers.authorization).toBe(`Bearer ${FAKE_BEARER}`);
    expect(calls[0]?.init.credentials).toBe('omit');
  });

  it('mobile: the provider is asked at every call, may be asynchronous, and no value means no header', async () => {
    const values: (string | null)[] = ['ses_first_fake', null, 'dvc_third_fake'];
    const { client, calls } = mobileClient(
      () => ({ status: 200, body: example('getServiceHealth', 200) }),
      async () => values.shift(),
    );
    await client.call('getServiceHealth');
    await client.call('getServiceHealth');
    await client.call('getServiceHealth');
    expect(calls.map((call) => call.init.headers.authorization)).toEqual(['Bearer ses_first_fake', undefined, 'Bearer dvc_third_fake']);
  });

  it('web: the same-origin cookie and no Authorization header', async () => {
    const transport = fakeTransport(() => ({ status: 202, body: example('exportEvidence', 202) }));
    const client = createCoreClient({ baseUrl: 'http://127.0.0.1:5173', credentials: 'browser-cookie', fetch: transport.fetch });
    await client.call('exportEvidence', EXPORT_INPUT);
    await client.call('exportEvidence', EXPORT_INPUT);
    for (const call of transport.calls) {
      expect(Object.keys(call.init.headers).map((name) => name.toLowerCase())).not.toContain('authorization');
      expect(Object.keys(call.init.headers).map((name) => name.toLowerCase())).not.toContain('cookie');
      expect(call.init.credentials).toBe('same-origin');
    }
  });

  it('no URL of the call log holds a token, a credential or a code', async () => {
    const { client, calls } = mobileClient(({ url }) =>
      url.endsWith('/health') ? { status: 200, body: example('getServiceHealth', 200) } : { status: 403, body: example('exportEvidence', 403) },
    );
    await client.call('getServiceHealth');
    await client.call('exportEvidence', EXPORT_INPUT);
    await client.call('getServiceHealth', { query: { limit: 2 } });
    expect(calls).toHaveLength(3);
    for (const call of calls) {
      expect(call.url).not.toContain(FAKE_BEARER);
      expect(call.url).not.toMatch(/dvc_|ses_|bio_|Bearer|token|password|code=/i);
    }
  });

  it('the debug log holds method, route template, status and request ID, and nothing else', async () => {
    const { client, log } = mobileClient(({ url }) =>
      url.includes('/evidence/')
        ? { status: 403, body: example('exportEvidence', 403), headers: { 'x-request-id': 'req-7' } }
        : { status: 200, body: example('getServiceHealth', 200) },
    );
    await client.call('getServiceHealth', { query: { limit: 5 } });
    await client.call('exportEvidence', EXPORT_INPUT);
    expect(log).toEqual([
      { method: 'GET', path: '/api/v1/health', status: 200, requestId: null },
      { method: 'POST', path: '/api/v1/evidence/{id}/export', status: 403, requestId: 'req-7' },
    ]);
    expect(JSON.stringify(log)).not.toContain(FAKE_BEARER);
    expect(JSON.stringify(log)).not.toContain('EV-20260930-0004');
  });

  it('a log or report sink that throws does not break the call', async () => {
    const transport = fakeTransport(() => ({ status: 201, body: { wrong: true } }));
    const client = createCoreClient({
      baseUrl: BASE,
      credentials: 'browser-cookie',
      fetch: transport.fetch,
      operations: CORE_API_OPERATIONS,
      log: () => {
        throw new Error('log sink failed');
      },
      report: () => {
        throw new Error('report sink failed');
      },
    });
    expect(await client.call('createSession', { body: {} })).toMatchObject({ ok: false, kind: 'CONTRACT_VIOLATION' });
  });
});

describe('an injected operation table (the registry is the default, not the only one)', () => {
  const TABLE = [
    {
      operationId: 'readThing',
      method: 'get',
      path: '/api/v1/thing/{id}',
      tag: CoreApiTag.SERVICE,
      mode: CoreApiMode.LIVE,
      summary: 'test',
      description: 'test',
      source: 'test',
      pathParam: { name: 'id', description: 'test', pattern: /^.+$/ },
      responses: { 200: { description: 'ok', schema: 'SessionCommandResponse' }, 204: { description: 'nothing to say' } },
    },
  ] as const satisfies readonly CoreApiOperation[];

  it('a documented 2xx status without a schema returns undefined data', async () => {
    const transport = fakeTransport(() => ({ status: 204 }));
    const client = createCoreClient({ baseUrl: BASE, credentials: 'browser-cookie', fetch: transport.fetch, operations: TABLE });
    expect(client.operationIds).toEqual(['readThing']);
    const result = await client.call('readThing', { params: { id: 'T-1' } });
    expect(result).toMatchObject({ ok: true, status: 204, data: undefined });
    expect(transport.calls[0]?.url).toBe(`${BASE}/api/v1/thing/T-1`);
  });

  it('a body on a status that has none is a CONTRACT_VIOLATION', async () => {
    const transport = fakeTransport(() => ({ status: 204, body: { unexpected: true } }));
    const client = createCoreClient({ baseUrl: BASE, credentials: 'browser-cookie', fetch: transport.fetch, operations: TABLE });
    expect(await client.call('readThing', { params: { id: 'T-1' } })).toMatchObject({ ok: false, kind: 'CONTRACT_VIOLATION', status: 204 });
  });
});
