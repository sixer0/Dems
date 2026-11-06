// HB-11, the contract-checked fake transport: the one call log of both halves, its masked text, and
// the common sequences (backend task 04_client_integration_spec §12.2, TS-13, TS-14; AC-C-04; plan
// row W31). The log is filled by the REAL typed client and the REAL heartbeat client.
import { inspect } from 'node:util';
import { describe, expect, it } from 'vitest';
import { CORE_API_OPERATIONS, REALTIME_SERVER_EXAMPLES, pickReplicatedState, type ReplicatedState, type WsServerMessage } from '../src/api';
import { CoreErrorKind, createCoreClient, type CoreCredentials } from '../src/client';
import {
  FAKE_CREDENTIALS,
  FakeTransportUsageError,
  createFakeClock,
  createFakeTransport,
  describeLogEntry,
  exampleInput,
  holdsCredential,
  maskCredentials,
  maskHeaderValue,
  type FakeTransport,
} from '../src/live/testing';
import { createHeartbeatClient } from '../src/realtime/heartbeat-client';
import { DEFAULT_SEED, createIdleState } from '../src/sim';

const BASE = 'http://127.0.0.1:4420';
const SOCKET_URL = 'ws://127.0.0.1:4420/ws';
const SESSION_BEARER = `Bearer ${FAKE_CREDENTIALS.sessionToken}`;
const DEVICE_BEARER = `Bearer ${FAKE_CREDENTIALS.deviceCredential}`;
const PASSWORD = 'Correct-Horse-Battery-9';
const STATE = pickReplicatedState(JSON.parse(JSON.stringify(createIdleState({ now: createFakeClock().now(), seed: DEFAULT_SEED }))) as ReplicatedState);

function clientOn(fake: Pick<FakeTransport, 'fetch'>, credentials: CoreCredentials = 'browser-cookie') {
  return createCoreClient({ baseUrl: BASE, credentials, fetch: fake.fetch, operations: CORE_API_OPERATIONS });
}

/** A fake after a mobile sign-in, a web read, and one socket of each client. */
async function used() {
  const fake = createFakeTransport();
  fake.answerAllFromExamples();
  const mobile = clientOn(fake, () => FAKE_CREDENTIALS.deviceCredential);
  await mobile.call('signIn', { body: { username: 'andi.pratama', password: PASSWORD } });
  await clientOn(fake).call('getCurrentSession');
  fake.socketFactory(SOCKET_URL, { Authorization: SESSION_BEARER });
  fake.connection().startOperator(STATE);
  fake.connection().socket.send(JSON.stringify({ type: 'subscribe', topic: 'meters' }));
  fake.connection().sessionEnded('SIGNED_OUT');
  await mobile.call('stopSession', exampleInput('stopSession'));
  return fake;
}

describe('the call log holds what a test asserts on (TS-14)', () => {
  it('per request: method, path, operation ID, headers and body, with the status that was delivered', async () => {
    const fake = await used();
    expect(fake.calls).toHaveLength(3);
    expect(fake.calls).toBe(fake.log.requests);
    expect(fake.calls[0]).toEqual({
      kind: 'http',
      seq: 1,
      at: fake.clock.now(),
      method: 'POST',
      url: `${BASE}/api/v1/auth/sign-in`,
      path: '/api/v1/auth/sign-in',
      query: {},
      operationId: 'signIn',
      params: {},
      headers: { accept: 'application/json', 'content-type': 'application/json', authorization: DEVICE_BEARER },
      credentials: 'omit',
      bodyText: JSON.stringify({ username: 'andi.pratama', password: PASSWORD }),
      body: { username: 'andi.pratama', password: PASSWORD },
      status: 200,
      outcome: 'answered',
    });
    expect(fake.calls[1]).toMatchObject({
      method: 'GET',
      path: '/api/v1/session/current',
      operationId: 'getCurrentSession',
      headers: { accept: 'application/json' },
      credentials: 'same-origin',
      bodyText: null,
      body: undefined,
      status: 200,
    });
    expect(fake.calls[2]).toMatchObject({
      method: 'POST',
      path: '/api/v1/session/SES-20261001-0024/stop',
      operationId: 'stopSession',
      params: { id: 'SES-20261001-0024' },
      body: { reason: 'Interview completed' },
      status: 202,
    });
  });

  it('per socket: the URL, the upgrade headers and every message of both directions', async () => {
    const fake = await used();
    expect(fake.log.sockets).toHaveLength(1);
    const [socket] = fake.log.sockets;
    expect(socket).toMatchObject({
      kind: 'socket',
      id: 1,
      url: SOCKET_URL,
      protocols: [],
      headers: { authorization: SESSION_BEARER },
      state: 'CLOSED',
      closed: { by: 'server', code: 4401, reason: '' },
    });
    expect(socket?.frames.map((frame) => [frame.direction, frame.type])).toEqual([
      ['server', 'hello'],
      ['server', 'snapshot'],
      ['client', 'subscribe'],
      ['server', 'session.ended'],
    ]);
    expect(socket?.frames[2]).toMatchObject({ data: '{"type":"subscribe","topic":"meters"}', message: { type: 'subscribe', topic: 'meters' }, deliberate: false });
    expect(socket?.frames[0]?.message).toMatchObject({ type: 'hello', principal: 'OPERATOR' });
    expect(socket?.frames).toBe(fake.connection().frames);
  });

  it('one scale for both halves: requests, sockets and frames are numbered in the order they happened', async () => {
    const fake = await used();
    expect(fake.log.entries.map((entry) => [entry.kind, entry.seq])).toEqual([
      ['http', 1],
      ['http', 2],
      ['socket', 3],
      ['http', 8],
    ]);
    expect(fake.log.sockets[0]?.frames.map((frame) => frame.seq)).toEqual([4, 5, 6, 7]);
    expect(fake.log.operationIds()).toEqual(['signIn', 'getCurrentSession', 'stopSession']);
    expect(fake.log.requestsOf('stopSession')).toEqual([fake.calls[2]]);
    expect(fake.log.requestsOf('resetDemo')).toEqual([]);
    expect(fake.log.urls()).toEqual([`${BASE}/api/v1/auth/sign-in`, `${BASE}/api/v1/session/current`, SOCKET_URL, `${BASE}/api/v1/session/SES-20261001-0024/stop`]);
  });

  it('AC-C-04 on the log: no URL holds a credential, the web client sends no Authorization header, the mobile client exactly one', async () => {
    const fake = await used();
    expect(fake.log.urls().some((url) => holdsCredential(url))).toBe(false);
    const authorizations = fake.calls.map((call) => Object.keys(call.headers).filter((name) => name === 'authorization').length);
    expect(authorizations).toEqual([1, 0, 1]);
    // Kept as given: a test can assert on the presence and on the prefix of a credential.
    expect(fake.calls[0]?.headers.authorization).toBe(DEVICE_BEARER);
    expect(fake.calls[0]?.headers.authorization?.startsWith('Bearer dvc_')).toBe(true);
    expect(fake.log.sockets[0]?.headers.authorization?.startsWith('Bearer ses_')).toBe(true);
  });

  it('a request the contract refuses and a request with no answer are in the log too', async () => {
    const fake = createFakeTransport();
    await clientOn(fake).call('getDeviceHealth');
    await fake.fetch(`${BASE}/api/v1/unknown`).catch(() => undefined);
    expect(fake.calls).toMatchObject([
      { operationId: 'getDeviceHealth', outcome: 'unscripted', status: null },
      { operationId: null, path: '/api/v1/unknown', outcome: 'refused', status: null },
    ]);
    expect(fake.log.operationIds()).toEqual(['getDeviceHealth']);
    expect(String(fake.log)).toContain('(no operation) -> refused');
  });

  it('clear empties the log and keeps the scripts; an empty log says so', async () => {
    const fake = await used();
    fake.log.clear();
    expect(fake.log.entries).toEqual([]);
    expect(fake.calls).toEqual([]);
    expect(String(fake.log)).toBe('(no call)');
    expect(await clientOn(fake).call('getDeviceHealth')).toMatchObject({ ok: true });
    expect(fake.calls).toHaveLength(1);
  });
});

describe('every text the log produces masks credentials and shows no value of a body', () => {
  const secrets = [FAKE_CREDENTIALS.sessionToken, FAKE_CREDENTIALS.deviceCredential, 'FAKE-TRANSPORT', PASSWORD];

  it('toString: bearer values keep scheme and prefix only; a body shows its size and member names', async () => {
    const fake = await used();
    const text = fake.log.toString();
    expect(text).toBe(String(fake.log));
    expect(text).toBe(`${fake.log}`);
    expect(text.split('\n')).toEqual([
      `#1 POST ${BASE}/api/v1/auth/sign-in signIn -> 200`,
      '    accept: application/json',
      '    authorization: Bearer dvc_***',
      '    content-type: application/json',
      '    credentials: omit',
      `    body: ${JSON.stringify({ username: 'andi.pratama', password: PASSWORD }).length} characters, members: username, password`,
      `#2 GET ${BASE}/api/v1/session/current getCurrentSession -> 200`,
      '    accept: application/json',
      '    credentials: same-origin',
      '    body: none',
      `#3 WS ${SOCKET_URL} (socket 1) CLOSED by server 4401`,
      '    authorization: Bearer ses_***',
      '    #4 <- hello',
      '    #5 <- snapshot',
      '    #6 -> subscribe',
      '    #7 <- session.ended',
      `#8 POST ${BASE}/api/v1/session/SES-20261001-0024/stop stopSession -> 202`,
      '    accept: application/json',
      '    authorization: Bearer dvc_***',
      '    content-type: application/json',
      '    credentials: omit',
      '    body: 32 characters, members: reason',
    ]);
    for (const secret of secrets) expect(text).not.toContain(secret);
  });

  it('the console form and the JSON form of the log are masked the same way', async () => {
    const fake = await used();
    const printed = inspect(fake.log, { depth: 6 });
    expect(printed).toBe(fake.log.toString());
    const json = JSON.stringify(fake.log);
    for (const secret of secrets) {
      expect(printed).not.toContain(secret);
      expect(json).not.toContain(secret);
    }
    expect(JSON.parse(json)).toMatchObject([
      { kind: 'http', seq: 1, method: 'POST', operationId: 'signIn', headers: { authorization: 'Bearer dvc_***' }, status: 200, outcome: 'answered' },
      { kind: 'http', seq: 2, operationId: 'getCurrentSession', path: '/api/v1/session/current', bodyText: null, body: 'none' },
      { kind: 'socket', seq: 3, url: SOCKET_URL, headers: { authorization: 'Bearer ses_***' }, closed: { by: 'server', code: 4401 } },
      { kind: 'http', seq: 8, operationId: 'stopSession' },
    ]);
    expect((JSON.parse(json) as { frames?: unknown[] }[])[2]?.frames).toEqual([
      { seq: 4, direction: 'server', type: 'hello' },
      { seq: 5, direction: 'server', type: 'snapshot' },
      { seq: 6, direction: 'client', type: 'subscribe' },
      { seq: 7, direction: 'server', type: 'session.ended' },
    ]);
  });

  it('one entry and its header record print masked too, while their members stay as recorded', async () => {
    const fake = await used();
    const [call] = fake.calls;
    const [socket] = fake.log.sockets;
    if (!call || !socket) throw new Error('the log is empty');
    for (const printed of [String(call), inspect(call), JSON.stringify(call), describeLogEntry(call), String(call.headers), inspect(call.headers), JSON.stringify(call.headers)]) {
      expect(printed).toContain('dvc_***');
      for (const secret of secrets) expect(printed).not.toContain(secret);
    }
    for (const printed of [String(socket), inspect(socket), JSON.stringify(socket), String(socket.headers), JSON.stringify(socket.headers)]) {
      expect(printed).toContain('ses_***');
      for (const secret of secrets) expect(printed).not.toContain(secret);
    }
    // The masking members are not enumerable: what a test compares is exactly what was recorded.
    expect(Object.keys(call.headers).sort()).toEqual(['accept', 'authorization', 'content-type']);
    expect({ ...call.headers }).toEqual({ accept: 'application/json', 'content-type': 'application/json', authorization: DEVICE_BEARER });
    expect(Object.keys(call)).not.toContain('toString');
  });

  it('a URL prints with its path and the names of its query members only; a deliberate frame is marked', async () => {
    const fake = createFakeTransport();
    await fake.fetch(`${BASE}/api/v1/health?code=123456&token=${FAKE_CREDENTIALS.sessionToken}`).catch(() => undefined);
    fake.socketFactory(SOCKET_URL);
    fake.connection().startAnonymous().send({ type: 'nope' }, { violatesContract: true }).sendRaw('{}');
    const text = String(fake.log);
    expect(text).toContain(`#1 GET ${BASE}/api/v1/health?code&token getServiceHealth -> refused`);
    expect(text).not.toContain('123456');
    expect(text).toContain('<- nope (deliberate violation)');
    expect(text).toContain('<- (no type) (deliberate violation)');
    expect(text).toContain('(socket 1) OPEN');
  });

  it.each([
    ['authorization', SESSION_BEARER, 'Bearer ses_***'],
    ['Authorization', DEVICE_BEARER, 'Bearer dvc_***'],
    ['authorization', `Bearer ${FAKE_CREDENTIALS.biometricToken}`, 'Bearer bio_***'],
    ['authorization', 'Bearer something-else', 'Bearer ***'],
    ['authorization', 'opaque', '***'],
    ['proxy-authorization', 'Basic dXNlcjpwYXNz', 'Basic ***'],
    ['cookie', 'dems_session_4420=abc123; theme=dark', 'dems_session_4420=***; theme=***'],
    ['cookie', 'broken', '***'],
    ['set-cookie', 'dems_session_4420=abc123; HttpOnly; SameSite=Strict; Path=/', 'dems_session_4420=***; HttpOnly; SameSite=Strict; Path=/'],
    ['x-note', `token ${FAKE_CREDENTIALS.sessionToken} here`, 'token ses_*** here'],
    ['accept', 'application/json', 'application/json'],
  ])('maskHeaderValue(%s): %s', (name, value, masked) => {
    expect(maskHeaderValue(name, value)).toBe(masked);
  });

  it('maskCredentials cuts every credential-shaped value down to its prefix, and nothing else', () => {
    expect(maskCredentials(`a ${FAKE_CREDENTIALS.sessionToken}, ${FAKE_CREDENTIALS.deviceCredential} and ${FAKE_CREDENTIALS.biometricToken}.`)).toBe('a ses_***, dvc_*** and bio_***.');
    expect(maskCredentials('sessions_total uses_this dvc')).toBe('sessions_total uses_this dvc');
    expect(holdsCredential('x=ses_abc')).toBe(true);
    expect(holdsCredential('x=ses_abc')).toBe(true);
    expect(holdsCredential('assess_abc')).toBe(false);
  });

  it('the fake credentials have the form of the contract and are told apart from each other', () => {
    expect(FAKE_CREDENTIALS.sessionToken).toMatch(/^ses_[A-Za-z0-9_-]{43}$/);
    expect(FAKE_CREDENTIALS.deviceCredential).toMatch(/^dvc_[A-Za-z0-9_-]{43}$/);
    expect(FAKE_CREDENTIALS.biometricToken).toMatch(/^bio_[A-Za-z0-9_-]{43}$/);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════════════
// Common sequences (TS-13)
// ═══════════════════════════════════════════════════════════════════════════════════════

describe('common sequences on both halves (TS-13)', () => {
  it('an anonymous start: the session probe answers 401, the sign-in status its example, the socket says ANONYMOUS', async () => {
    const fake = createFakeTransport();
    fake.scriptAnonymousStart('SESSION_INVALID');
    const client = clientOn(fake);
    expect(await client.call('getAuthSession')).toMatchObject({ ok: false, kind: CoreErrorKind.UNAUTHENTICATED, error: { code: 'NOT_SIGNED_IN' } });
    expect(await client.call('getSignInStatus')).toMatchObject({ ok: true, status: 200 });
    const heartbeat = createHeartbeatClient({ url: SOCKET_URL, socketFactory: fake.socketFactory, now: fake.clock.now, onInvalidMessage: () => undefined });
    heartbeat.start();
    await Promise.resolve();
    expect(fake.connection()).toMatchObject({ state: 'OPEN', principal: 'ANONYMOUS', topics: ['heartbeat'] });
    expect(fake.connection().sent).toMatchObject([{ type: 'hello', reason: 'SESSION_INVALID' }]);
    fake.connection().heartbeat();
    expect(heartbeat.getSnapshot().state).toBe('LIVE');
    heartbeat.stop();
    fake.assertNoViolations();
  });

  it('a signed-in start: the session probe answers 200, the socket says OPERATOR and sends the snapshot', async () => {
    const fake = createFakeTransport({ epoch: 2, revision: 40 });
    fake.scriptSignedInStart(STATE, { admin: true });
    expect(await clientOn(fake).call('getAuthSession')).toMatchObject({ ok: true, status: 200 });
    fake.socketFactory(SOCKET_URL);
    fake.runPendingConnects();
    expect(fake.connection()).toMatchObject({ principal: 'OPERATOR', topics: ['heartbeat', 'control', 'state', 'meters', 'admin'] });
    expect(fake.connection().sent).toMatchObject([{ type: 'hello', epoch: 2 }, { type: 'snapshot', epoch: 2, revision: 40, state: STATE }]);

    const other = createFakeTransport();
    const session = other.example('getAuthSession').body;
    other.scriptSignedInStart(STATE, { session });
    expect(await clientOn(other).call('getAuthSession')).toMatchObject({ ok: true, data: session });
    expect(() => createFakeTransport().scriptSignedInStart(STATE, { session: { nope: true } })).toThrow(/INVALID_BODY/);
  });

  const ops = REALTIME_SERVER_EXAMPLES.delta.tabletConnected.value.ops;

  /** A client, a socket that records what arrives, and the order in which the answer and the delta arrived. */
  async function commandSetup(order: 'delta-first' | 'answer-first') {
    const fake = createFakeTransport({ epoch: 3, revision: 128 });
    const arrivals: string[] = [];
    const socket = fake.socketFactory(SOCKET_URL);
    socket.onmessage = (event) => {
      const message = JSON.parse(String(event.data)) as WsServerMessage;
      if (message.type === 'delta') arrivals.push(`delta ${message.revision}`);
    };
    fake.connection().startOperator(STATE);
    const script = fake.scriptCommand('stopSession', { ops, order });
    const pending = clientOn(fake)
      .call('stopSession', exampleInput('stopSession'))
      .then((result) => {
        arrivals.push(`answer ${result.ok ? result.revision : 'failed'}`);
        return result;
      });
    return { fake, arrivals, script, pending };
  }

  it('a command preceded by its delta: the delta of revision N arrives, then the answer with revision N', async () => {
    const { fake, arrivals, script, pending } = await commandSetup('delta-first');
    expect(script).toMatchObject({ revision: null, deltaSent: false });
    expect(await pending).toMatchObject({ ok: true, status: 202, epoch: 3, revision: 129 });
    expect(arrivals).toEqual(['delta 129', 'answer 129']);
    expect(script).toMatchObject({ revision: 129, deltaSent: true });
    expect(fake.position).toEqual({ epoch: 3, revision: 129 });
    expect(() => script.sendDelta()).toThrow(FakeTransportUsageError);
    fake.assertDone();
  });

  it('a command followed by its delta: the answer with revision N arrives, the delta when the test sends it', async () => {
    const { fake, arrivals, script, pending } = await commandSetup('answer-first');
    expect(() => script.sendDelta()).toThrow(FakeTransportUsageError);
    expect(await pending).toMatchObject({ ok: true, revision: 129 });
    expect(arrivals).toEqual(['answer 129']);
    // The answer names a revision the socket has not delivered yet: the state a Live action waits in.
    expect(fake.position.revision).toBe(128);
    script.sendDelta();
    expect(arrivals).toEqual(['answer 129', 'delta 129']);
    expect(script).toMatchObject({ revision: 129, deltaSent: true });
    expect(fake.position.revision).toBe(129);
    fake.assertDone();
  });

  it('a scripted command takes its own answer and its own connection; without a socket it fails by name', async () => {
    const fake = createFakeTransport();
    fake.socketFactory(SOCKET_URL);
    const first = fake.connection().startOperator(STATE);
    fake.socketFactory(SOCKET_URL);
    fake.connection().startAnonymous();
    fake.scriptCommand('createSession', { ops, order: 'delta-first', answer: fake.example('createSession', 201), connection: first });
    expect(await clientOn(fake).call('createSession', exampleInput('createSession'))).toMatchObject({ ok: true, status: 201, revision: 1 });
    expect(first.sent.at(-1)).toMatchObject({ type: 'delta', revision: 1 });
    fake.assertDone();

    const alone = createFakeTransport();
    alone.scriptCommand('stopSession', { ops, order: 'delta-first' });
    expect(await clientOn(alone).call('stopSession', exampleInput('stopSession'))).toMatchObject({ ok: false, kind: CoreErrorKind.NETWORK });
    expect(alone.violations[0]).toMatchObject({ name: 'FakeTransportUsageError', reason: 'NO_SOCKET' });
  });
});
