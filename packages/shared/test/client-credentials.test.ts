// HB-9, the typed client: the credential provider and the credential guard.
// Fix round after the checkpoint review CP-C1 (backend task, decision D80):
//
// - CPC1-3: the credential provider runs inside the call's ONE time-out budget (CL-6), and a provider
//   that rejects or does not answer becomes a failure of the client (CL-1), never a hang and never a
//   rejection with the provider's own error. A provider that answers after the time-out sends nothing.
// - CPC1-12: the prefixes the URL guard refuses (CL-6a) are tied to the contract's token patterns.
//
// No network. A call is tracked without awaiting it, so that a call that never settles fails an
// assertion instead of hanging the test.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CORE_API_EXAMPLES, CORE_API_OPERATIONS } from '../src/api';
import * as contractPatterns from '../src/api/patterns';
import {
  CoreClientUsageError,
  LIVE_COMMAND_TIMEOUT_MS,
  createCoreClient,
  type CoreCallResult,
  type CoreClientLogLine,
  type CoreClientReport,
  type CoreCredentials,
  type CoreFetch,
} from '../src/client';

const BASE = 'http://127.0.0.1:4420';
/** An obviously fake value with the shape of a device credential; never a real one. */
const FAKE_BEARER = `dvc_TEST_FAKE_${'0123456789abcdef'.repeat(2)}`;
const HEALTH_BODY = JSON.stringify(Object.values(CORE_API_EXAMPLES.getServiceHealth?.responses[200] ?? {})[0]?.value);
const EXPORT_BODY = { reason: 'Prosecutor review' };

const answering: CoreFetch = async () => ({ status: 200, headers: { get: () => null }, text: async () => HEALTH_BODY });
const silent: CoreFetch = () => new Promise(() => undefined);

function clientWith(credentials: CoreCredentials, transport: CoreFetch = answering) {
  const fetch = vi.fn<CoreFetch>(transport);
  const reports: CoreClientReport[] = [];
  const log: CoreClientLogLine[] = [];
  const client = createCoreClient({
    baseUrl: BASE,
    credentials,
    fetch,
    operations: CORE_API_OPERATIONS, // the widened view: these tests also send what the types forbid
    report: (entry) => reports.push(entry),
    log: (line) => log.push(line),
  });
  return { client, fetch, reports, log };
}

interface Tracked {
  settled: boolean;
  result: CoreCallResult | undefined;
  rejected: unknown;
}
function track(pending: Promise<CoreCallResult>): Tracked {
  const state: Tracked = { settled: false, result: undefined, rejected: undefined };
  pending.then(
    (result) => {
      state.result = result;
      state.settled = true;
    },
    (error: unknown) => {
      state.rejected = error;
      state.settled = true;
    },
  );
  return state;
}

afterEach(() => {
  vi.useRealTimers();
});

describe('CPC1-3: the credential provider is inside the call\'s one time-out (CL-6) and cannot make the call reject (CL-1)', () => {
  it('a provider that never resolves: the call settles at the time-out as CREDENTIALS / CREDENTIALS_TIMEOUT and nothing is sent', async () => {
    vi.useFakeTimers();
    const { client, fetch, reports, log } = clientWith(() => new Promise<string>(() => undefined));
    const state = track(client.call('getServiceHealth'));

    await vi.advanceTimersByTimeAsync(LIVE_COMMAND_TIMEOUT_MS - 1);
    expect(state.settled).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(state.settled).toBe(true);
    expect(state.rejected).toBeUndefined();
    expect(state.result).toEqual({
      ok: false,
      operationId: 'getServiceHealth',
      kind: 'CREDENTIALS',
      status: null,
      error: { code: 'CREDENTIALS_TIMEOUT', message: `The credential for this request was not available within ${LIVE_COMMAND_TIMEOUT_MS} ms. Nothing was sent.` },
      retryAfterSeconds: null,
      transport: 'CORE_OFFLINE',
      requestId: null,
    });
    expect(fetch).not.toHaveBeenCalled();
    expect(reports).toMatchObject([{ level: 'warn', source: 'CoreClient.call', operationId: 'getServiceHealth', kind: 'CREDENTIALS', status: null }]);
    expect(log).toEqual([{ method: 'GET', path: '/api/v1/health', status: null, requestId: null }]);
  });

  const PROVIDER_TEXT = `secure store refused: ${FAKE_BEARER}`;
  it.each<[string, CoreCredentials]>([
    ['with a rejected promise', () => Promise.reject(new Error(PROVIDER_TEXT))],
    [
      'by throwing',
      () => {
        throw new Error(PROVIDER_TEXT);
      },
    ],
    ['with something that is not an Error', () => Promise.reject(PROVIDER_TEXT)],
  ])('a provider that fails %s: the call resolves with CREDENTIALS / CREDENTIALS_UNAVAILABLE, without the provider\'s text', async (_name, provider) => {
    const { client, fetch, reports } = clientWith(provider);
    const state = track(client.call('getServiceHealth'));
    await vi.waitFor(() => expect(state.settled).toBe(true));

    expect(state.rejected).toBeUndefined();
    expect(state.result).toEqual({
      ok: false,
      operationId: 'getServiceHealth',
      kind: 'CREDENTIALS',
      status: null,
      error: { code: 'CREDENTIALS_UNAVAILABLE', message: 'The credential for this request could not be read. Nothing was sent.' },
      retryAfterSeconds: null,
      transport: 'CORE_OFFLINE',
      requestId: null,
    });
    expect(fetch).not.toHaveBeenCalled();
    expect(reports).toMatchObject([{ level: 'warn', kind: 'CREDENTIALS', status: null }]);
    // Neither the provider's own words nor a token reach the result or the report.
    const text = JSON.stringify([state.result, reports]);
    expect(text).not.toContain('secure store');
    expect(text).not.toContain(FAKE_BEARER);
    expect(text).not.toContain('dvc_');
  });

  it('a provider that answers after the time-out has fired: no request is made, late or otherwise', async () => {
    vi.useFakeTimers();
    let release: (value: string) => void = () => undefined;
    const { client, fetch } = clientWith(
      () =>
        new Promise<string>((resolve) => {
          release = resolve;
        }),
    );
    const state = track(client.call('getServiceHealth'));
    await vi.advanceTimersByTimeAsync(LIVE_COMMAND_TIMEOUT_MS);

    release(FAKE_BEARER);
    await vi.advanceTimersByTimeAsync(LIVE_COMMAND_TIMEOUT_MS * 2);
    expect(fetch).not.toHaveBeenCalled();
    expect(state.rejected).toBeUndefined();
    expect(state.result).toMatchObject({ ok: false, kind: 'CREDENTIALS', error: { code: 'CREDENTIALS_TIMEOUT' }, transport: 'CORE_OFFLINE' });
  });

  it('a provider that answers late with a value that is no bearer token, or rejects late: nothing is sent and nothing is thrown', async () => {
    vi.useFakeTimers();
    for (const late of ['resolve-invalid', 'reject'] as const) {
      let finish: () => void = () => undefined;
      const { client, fetch } = clientWith(
        () =>
          new Promise<string>((resolve, reject) => {
            finish = () => (late === 'reject' ? reject(new Error('too late')) : resolve('two words'));
          }),
      );
      const state = track(client.call('getServiceHealth'));
      await vi.advanceTimersByTimeAsync(LIVE_COMMAND_TIMEOUT_MS);
      finish();
      await vi.advanceTimersByTimeAsync(LIVE_COMMAND_TIMEOUT_MS);
      expect(fetch, late).not.toHaveBeenCalled();
      expect(state.rejected, late).toBeUndefined();
      expect(state.result, late).toMatchObject({ ok: false, kind: 'CREDENTIALS', error: { code: 'CREDENTIALS_TIMEOUT' } });
    }
  });

  it('one budget, not two: 3 s in the provider leave 5 s for the answer; the call ends 8 s after it began', async () => {
    vi.useFakeTimers();
    const { client, fetch } = clientWith(() => new Promise<string>((resolve) => setTimeout(() => resolve(FAKE_BEARER), 3_000)), silent);
    const state = track(client.call('getServiceHealth'));

    await vi.advanceTimersByTimeAsync(3_000);
    expect(fetch).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(LIVE_COMMAND_TIMEOUT_MS - 3_000 - 1);
    expect(state.settled).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(state.settled).toBe(true);
    // The request was sent, so this is the exchange's time-out: the command may have been applied.
    expect(state.result).toMatchObject({ ok: false, kind: 'TIMEOUT', error: { code: 'TIMEOUT' }, transport: 'CORE_OFFLINE' });
    expect(fetch.mock.calls[0]?.[1].signal?.aborted).toBe(true);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('an invalid call is refused before the provider is asked: no credential is read for a request that cannot be sent', async () => {
    const provider = vi.fn(() => FAKE_BEARER);
    const { client, fetch } = clientWith(provider);
    await expect(client.call('exportEvidence', { body: EXPORT_BODY })).rejects.toBeInstanceOf(CoreClientUsageError); // no path parameter
    await expect(client.call('noSuchOperation')).rejects.toBeInstanceOf(CoreClientUsageError);
    await expect(client.call('getServiceHealth', { body: {} })).rejects.toBeInstanceOf(CoreClientUsageError);
    await expect(client.call('getServiceHealth', { query: { q: 'ses_abc' } })).rejects.toBeInstanceOf(CoreClientUsageError);
    expect(provider).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });

  describe('the normal path is unchanged', () => {
    it('a slow provider inside the budget: the request goes out with its value and the answer is returned', async () => {
      vi.useFakeTimers();
      const { client, fetch, reports } = clientWith(() => new Promise<string>((resolve) => setTimeout(() => resolve(FAKE_BEARER), 3_000)));
      const state = track(client.call('getServiceHealth'));
      await vi.advanceTimersByTimeAsync(2_999);
      expect(fetch).not.toHaveBeenCalled();
      await vi.advanceTimersByTimeAsync(1);
      expect(state.result).toMatchObject({ ok: true, status: 200 });
      expect(fetch).toHaveBeenCalledTimes(1);
      expect(fetch.mock.calls[0]?.[1].headers).toEqual({ accept: 'application/json', authorization: `Bearer ${FAKE_BEARER}` });
      expect(reports).toEqual([]);
      // No timer is left behind by a call that ended.
      expect(vi.getTimerCount()).toBe(0);
    });

    it('a synchronous provider, an asynchronous one, and one without a value', async () => {
      for (const [provider, authorization] of [
        [() => FAKE_BEARER, `Bearer ${FAKE_BEARER}`],
        [async () => FAKE_BEARER, `Bearer ${FAKE_BEARER}`],
        [() => null, undefined],
        [async () => undefined, undefined],
      ] as const) {
        const { client, fetch } = clientWith(provider);
        expect(await client.call('getServiceHealth')).toMatchObject({ ok: true, status: 200 });
        expect(fetch.mock.calls[0]?.[1].headers.authorization).toBe(authorization);
        expect(fetch.mock.calls[0]?.[1].credentials).toBe('omit');
      }
    });

    it('the web client asks no provider and is bounded by the same time-out', async () => {
      vi.useFakeTimers();
      const { client, fetch } = clientWith('browser-cookie', silent);
      const state = track(client.call('getServiceHealth'));
      await vi.advanceTimersByTimeAsync(0);
      expect(fetch).toHaveBeenCalledTimes(1);
      expect(fetch.mock.calls[0]?.[1].headers).toEqual({ accept: 'application/json' });
      expect(fetch.mock.calls[0]?.[1].credentials).toBe('same-origin');
      await vi.advanceTimersByTimeAsync(LIVE_COMMAND_TIMEOUT_MS - 1);
      expect(state.settled).toBe(false);
      await vi.advanceTimersByTimeAsync(1);
      expect(state.result).toMatchObject({ ok: false, kind: 'TIMEOUT' });
    });

    it('a value the provider returns that cannot be a bearer token is still a programming error', async () => {
      const { client, fetch } = clientWith(() => 'two words');
      await expect(client.call('getServiceHealth')).rejects.toBeInstanceOf(CoreClientUsageError);
      expect(fetch).not.toHaveBeenCalled();
    });

    it('the bearer value in a URL is still a programming error, found after the provider answered', async () => {
      const provider = vi.fn(() => FAKE_BEARER);
      const { client, fetch } = clientWith(provider);
      // Neither value starts with a token prefix; each holds the whole current bearer value.
      await expect(client.call('getServiceHealth', { query: { q: `x${FAKE_BEARER}` } })).rejects.toBeInstanceOf(CoreClientUsageError);
      await expect(client.call('exportEvidence', { params: { id: `id-${FAKE_BEARER}` }, body: EXPORT_BODY })).rejects.toBeInstanceOf(CoreClientUsageError);
      expect(provider).toHaveBeenCalledTimes(2);
      expect(fetch).not.toHaveBeenCalled();
    });
  });
});

describe('CPC1-12: the URL guard knows every bearer secret of the contract (CL-6a)', () => {
  // The contract states the three secrets as patterns (`api/patterns.ts`) and, since the close-out W83,
  // also as the list `BEARER_SECRET_PREFIXES`, which the client's guard is built from. This test reads
  // the literal head of every token pattern the contract exports, holds the list to those heads and the
  // guard to both. A fourth secret added to the contract turns the first test red.
  const secrets = Object.entries(contractPatterns)
    .filter((entry): entry is [string, RegExp] => /(?:_TOKEN|_CREDENTIAL)_PATTERN$/.test(entry[0]) && entry[1] instanceof RegExp)
    .map(([name, pattern]) => ({ name, pattern, head: /^\^([a-z]+_)/.exec(pattern.source)?.[1] ?? '' }));

  it('the contract has exactly the three secrets the guard was written for, each with a literal prefix', () => {
    expect(secrets.map(({ name, head }) => [name, head])).toEqual([
      ['SESSION_TOKEN_PATTERN', 'ses_'],
      ['DEVICE_CREDENTIAL_PATTERN', 'dvc_'],
      ['BIOMETRIC_TOKEN_PATTERN', 'bio_'],
    ]);
    // The contract's list of prefixes is exactly those heads (W83).
    expect([...contractPatterns.BEARER_SECRET_PREFIXES]).toEqual(secrets.map(({ head }) => head));
  });

  it.each(secrets)('a value of the form of $name is refused in a query value and as a path parameter, before any request', async ({ pattern, head }) => {
    const whole = `${head}${'A'.repeat(43)}`;
    expect(pattern.test(whole)).toBe(true);
    for (const value of [whole, `${head}x`]) {
      const { client, fetch } = clientWith(() => null);
      await expect(client.call('getServiceHealth', { query: { q: value } })).rejects.toBeInstanceOf(CoreClientUsageError);
      await expect(client.call('exportEvidence', { params: { id: value }, body: EXPORT_BODY })).rejects.toBeInstanceOf(CoreClientUsageError);
      expect(fetch).not.toHaveBeenCalled();
    }
  });

  it('a value that only resembles a prefix is not refused', async () => {
    const { client, fetch } = clientWith(() => null);
    expect(await client.call('getServiceHealth', { query: { q: 'session_1', r: 'DVC_upper', s: 'x-ses_inside' } })).toMatchObject({ ok: true });
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
