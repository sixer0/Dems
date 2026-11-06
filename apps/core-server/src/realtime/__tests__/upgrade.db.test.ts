// The upgrade of `GET /ws` over a REAL handshake (plan row W42; spec §9.1, §9.2, §14.2; SR-38 to
// SR-40, SR-42, SR-49, SR-69, SR-70, SR-75; AC-B-42, AC-B-43, AC-B-73, AC-B-74, AC-B-84, AC-B-85).
//
// The real app on a seeded clone, every stage as the server has it, a listener on 127.0.0.1 at an
// ephemeral port. A socket of a test sends exactly the headers the test names: nothing adds an
// `Origin`. The web cookie is the session of the seeded SUPERVISOR; the bearer values are the
// credential of a real paired device and the session of the seeded INVESTIGATOR on it.
//
// Test IDs. A cell of the socket decision table of spec §14.2 is `S-<row><column>`: rows C
// (cookie), B (bearer), N (none), X (cookie and bearer); columns 1 (no `Origin`), 2 (one of the
// instance's own origins), 3 (a web console origin), 4 (any other origin), 5 (the literal
// `null`). A letter after it names the case inside a cell.
import { randomBytes } from 'node:crypto';
import { connect, type Socket } from 'node:net';
import { REALTIME_CLIENT_MESSAGE_MAX_BYTES, WS_PATH, type Heartbeat, type HelloMessage } from '@dems/shared/api';
import { ROLE_PERMISSIONS } from '@dems/shared/sim';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { useTestDatabase } from '../../../test/helpers/db';
import { FOREIGN_ORIGIN, SIGN_OUT, type Headers } from '../../../test/support/identity';
import { revokeUrl } from '../../../test/support/pairing';
import { credentialLeaks } from '../../../test/support/config';
import {
  CLOSE_REASON,
  REALTIME_DELTA_PACE_MS,
  REALTIME_HANDSHAKE_TIMEOUT_MS,
  REALTIME_MAX_ANONYMOUS,
  REALTIME_MAX_CONNECTIONS,
  REALTIME_MAX_PENDING_HANDSHAKES,
  REALTIME_MAX_PER_DEVICE,
  REALTIME_MAX_PER_SESSION,
} from '../limits';
import {
  INVESTIGATOR,
  OWN_ORIGIN,
  SUPERVISOR,
  TECHNICIAN,
  WEB_ORIGIN,
  bearer,
  deviceHeaders,
  deviceOperator,
  eventually,
  openSocket,
  operatorSocket,
  pairedDevice,
  realtimeApp,
  setMeters,
  settle,
  untilSockets,
  useSockets,
  webHeaders,
  webOperator,
  webPost,
  type DeviceOperator,
  type RealtimeApp,
  type TestSocket,
  type WebOperator,
} from '../../../test/support/realtime';
import type { PairedTestDevice } from '../../../test/support/pairing';

const db = useTestDatabase({ template: 'seed' });
let rt: RealtimeApp;
let supervisor: WebOperator;
let tablet: PairedTestDevice;
let onTablet: DeviceOperator;
/** A cookie of a web session that was signed out: it no longer resolves. */
let deadCookie: Headers;
/** A session token of the paired device whose session was signed out. */
let endedToken: string;
/** The credential of a device that was revoked, and a session token of that device. */
let retiredCredential: string;
let retiredToken: string;

/** Values of the right form that no session and no device has. */
const unknownSession = (): string => `ses_${randomBytes(32).toString('base64url')}`;
const unknownCredential = (): string => `dvc_${randomBytes(32).toString('base64url')}`;

/** The text of an upgrade request, for a client that speaks TCP itself. */
function upgradeRequest(path: string, headers: Headers): string {
  const lines = [
    `GET ${path} HTTP/1.1`,
    'Host: 127.0.0.1',
    'Connection: Upgrade',
    'Upgrade: websocket',
    'Sec-WebSocket-Version: 13',
    `Sec-WebSocket-Key: ${randomBytes(16).toString('base64')}`,
    ...Object.entries(headers).map(([name, value]) => `${name}: ${value}`),
  ];
  return `${lines.join('\r\n')}\r\n\r\n`;
}

/** Sends an upgrade request over a plain TCP connection and resolves with the head of the answer; the connection is left open. */
function rawUpgrade(url: string, headers: Headers): Promise<{ response: string; socket: Socket }> {
  const { port, pathname, search } = new URL(url);
  return new Promise((resolve, reject) => {
    const socket = connect(Number(port), '127.0.0.1');
    let response = '';
    socket.on('error', reject);
    socket.on('data', (chunk: Buffer) => {
      response += chunk.toString('utf8');
      if (response.includes('\r\n\r\n')) resolve({ response, socket });
    });
    socket.on('connect', () => socket.write(upgradeRequest(`${pathname}${search}`, headers)));
  });
}

/** Markers: values a caller could try to authenticate with outside the headers. Never an issued token. */
const QUERY_MARKER = 'w42-query-marker-7f3a';
const PROTOCOL_MARKER = 'w42-subprotocol-marker-9c1e';

useSockets(() => rt);

beforeAll(async () => {
  rt = await realtimeApp(db);
  supervisor = await webOperator(rt, SUPERVISOR);
  tablet = await pairedDevice(rt, supervisor, 'Interview tablet 01');
  onTablet = await deviceOperator(rt, tablet, INVESTIGATOR);

  const technician = await webOperator(rt, TECHNICIAN);
  expect((await webPost(rt.app, SIGN_OUT, technician.cookie, { reason: 'USER' })).statusCode).toBe(204);
  deadCookie = technician.cookie;

  const ended = await deviceOperator(rt, tablet, TECHNICIAN);
  expect((await rt.app.inject({ method: 'POST', url: SIGN_OUT, headers: bearer(ended.token), payload: { reason: 'USER' } })).statusCode).toBe(204);
  endedToken = ended.token;

  const second = await pairedDevice(rt, supervisor, 'Interview tablet 02');
  retiredToken = (await deviceOperator(rt, second, TECHNICIAN)).token;
  expect((await webPost(rt.app, revokeUrl(second.deviceId), supervisor.cookie, { reason: 'Revoked for the upgrade table' })).statusCode).toBe(200);
  retiredCredential = second.credential;
  await rt.channel.settled();
});

beforeEach(() => {
  rt.forgetCounters();
});

const helloOf = async (socket: TestSocket): Promise<HelloMessage> => {
  await socket.opened;
  return socket.nextOf('hello');
};

/** The handshake was refused with this status and code, and the server holds no socket for it. */
async function expectRefused(headers: Headers, status: number, code: string, url: string = rt.wsUrl): Promise<Record<string, unknown> | null> {
  const before = rt.channel.stats().sockets;
  const socket = openSocket(url, headers);
  const refusal = await socket.refused;
  expect([refusal.status, refusal.code]).toEqual([status, code]);
  expect(Object.keys(refusal.headers).filter((name) => name.startsWith('access-control-'))).toEqual([]);
  expect(rt.channel.stats().sockets).toBe(before);
  return refusal.details;
}

const cookie = (): Headers => supervisor.cookie;
const ORIGINS = { 1: {}, 2: { origin: OWN_ORIGIN }, 3: { origin: WEB_ORIGIN }, 4: { origin: FOREIGN_ORIGIN }, 5: { origin: 'null' } } as const satisfies Record<number, Headers>;

describe('AC-B-73: the decision table for the WebSocket upgrade of spec §14.2, over a real handshake', () => {
  describe('row C: the cookie', () => {
    it.each([
      ['S-C1', 1],
      ['S-C2', 2],
      ['S-C4', 4],
      ['S-C5', 5],
    ] as const)('%s: HTTP 403 ORIGIN_NOT_ALLOWED at the handshake', async (_id, column) => {
      await expectRefused({ ...cookie(), ...ORIGINS[column] }, 403, 'ORIGIN_NOT_ALLOWED');
    });

    it('S-C3a: with a web console origin and a session that resolves: OPERATOR, with the snapshot', async () => {
      const socket = openSocket(rt.wsUrl, webHeaders(cookie()));
      const hello = await helloOf(socket);
      expect(hello).toMatchObject({ principal: 'OPERATOR', topics: ['heartbeat', 'control', 'state', 'meters', 'admin'], epoch: rt.engine.epoch });
      expect('reason' in hello).toBe(false);
      await socket.nextOf('heartbeat');
      expect(socket.types()).toEqual(['hello', 'snapshot', 'heartbeat']);
      expect(rt.channel.connections()).toMatchObject([{ principal: 'OPERATOR', operatorId: SUPERVISOR.id, deviceId: null, role: 'SUPERVISOR' }]);
    });

    it('S-C3b: with a web console origin and a cookie that no longer resolves: ANONYMOUS with hello.reason SESSION_INVALID, and the socket stays open for the heartbeat', async () => {
      for (const dead of [deadCookie, { cookie: `${rt.cookieName}=not-a-session-token` }]) {
        const socket = openSocket(rt.wsUrl, webHeaders(dead));
        const hello = await helloOf(socket);
        expect(hello).toMatchObject({ principal: 'ANONYMOUS', reason: 'SESSION_INVALID', topics: ['heartbeat'] });
        await settle(rt, socket);
        expect(socket.types()).toEqual(['hello', 'heartbeat', 'heartbeat']);
        expect(socket.ws.readyState).toBe(socket.ws.OPEN);
      }
    });
  });

  describe.each([
    ['1', ORIGINS[1]],
    ['2', ORIGINS[2]],
  ] as const)('row B, column %s: a bearer value with no Origin, or with one of the instance\'s own', (column, origin) => {
    it(`S-B${column}a: a device credential of a PAIRED device: DEVICE`, async () => {
      const socket = openSocket(rt.wsUrl, { ...origin, ...bearer(tablet.credential) });
      const hello = await helloOf(socket);
      expect(hello).toMatchObject({ principal: 'DEVICE', topics: ['heartbeat', 'control'] });
      expect('reason' in hello).toBe(false);
      await settle(rt, socket);
      expect(socket.types()).toEqual(['hello', 'heartbeat', 'heartbeat']);
      expect(rt.channel.connections()).toMatchObject([{ principal: 'DEVICE', deviceId: tablet.deviceId, operatorId: null }]);
    });

    it(`S-B${column}b: a session token bound to a PAIRED device: OPERATOR`, async () => {
      const socket = openSocket(rt.wsUrl, { ...origin, ...bearer(onTablet.token) });
      const hello = await helloOf(socket);
      expect(hello).toMatchObject({ principal: 'OPERATOR', topics: ['heartbeat', 'control', 'state', 'meters'] });
      await socket.nextOf('heartbeat');
      expect(socket.types()).toEqual(['hello', 'snapshot', 'heartbeat']);
      expect(rt.channel.connections()).toMatchObject([{ principal: 'OPERATOR', operatorId: INVESTIGATOR.id, deviceId: tablet.deviceId, role: 'INVESTIGATOR' }]);
    });

    it.each([
      ['c1', 'an unknown session token', (): string => unknownSession()],
      ['c2', 'an unknown device credential', (): string => unknownCredential()],
      ['c3', 'a session token whose session ended', (): string => endedToken],
      ['c4', 'a value that is neither form', (): string => 'not-a-token-of-this-server'],
    ] as const)(`S-B${column}%s: %s: the handshake completes, hello says SESSION_INVALID, then close 4401`, async (_case, _name, value) => {
      const socket = openSocket(rt.wsUrl, { ...origin, ...bearer(value()) });
      const hello = await helloOf(socket);
      expect(hello).toMatchObject({ principal: 'ANONYMOUS', reason: 'SESSION_INVALID', topics: ['heartbeat'] });
      expect((await socket.closed).code).toBe(4401);
      expect(socket.types()).toEqual(['hello']);
    });

    it(`S-B${column}c5: another scheme than Bearer: the same, close 4401`, async () => {
      const socket = openSocket(rt.wsUrl, { ...origin, authorization: 'Basic bm90OmE=' });
      expect(await helloOf(socket)).toMatchObject({ principal: 'ANONYMOUS', reason: 'SESSION_INVALID' });
      expect((await socket.closed).code).toBe(4401);
    });

    it.each([
      ['d1', 'the credential of a revoked device', (): string => retiredCredential],
      ['d2', 'a session token of a revoked device', (): string => retiredToken],
    ] as const)(`S-B${column}%s: %s: the handshake completes, hello says DEVICE_REVOKED, then close 4403`, async (_case, _name, value) => {
      const socket = openSocket(rt.wsUrl, { ...origin, ...bearer(value()) });
      const hello = await helloOf(socket);
      expect(hello).toMatchObject({ principal: 'ANONYMOUS', reason: 'DEVICE_REVOKED', topics: ['heartbeat'] });
      expect((await socket.closed).code).toBe(4403);
      expect(socket.types()).toEqual(['hello']);
    });
  });

  describe('row B, columns 3 to 5', () => {
    it.each([
      ['S-B3', 3],
      ['S-B4', 4],
      ['S-B5', 5],
    ] as const)('%s: HTTP 403 ORIGIN_NOT_ALLOWED at the handshake, for a session token and for a device credential', async (_id, column) => {
      await expectRefused({ ...bearer(onTablet.token), ...ORIGINS[column] }, 403, 'ORIGIN_NOT_ALLOWED');
      await expectRefused({ ...bearer(tablet.credential), ...ORIGINS[column] }, 403, 'ORIGIN_NOT_ALLOWED');
    });
  });

  describe('row N: no credential', () => {
    it.each([
      ['S-N1', 1],
      ['S-N2', 2],
      ['S-N3', 3],
    ] as const)('%s: ANONYMOUS, with no reason', async (_id, column) => {
      const socket = openSocket(rt.wsUrl, { ...ORIGINS[column] });
      const hello = await helloOf(socket);
      expect(hello).toMatchObject({ principal: 'ANONYMOUS', topics: ['heartbeat'] });
      expect('reason' in hello).toBe(false);
      await settle(rt, socket);
      expect(socket.types()).toEqual(['hello', 'heartbeat', 'heartbeat']);
    });

    it.each([
      ['S-N4', 4],
      ['S-N5', 5],
    ] as const)('%s: HTTP 403 ORIGIN_NOT_ALLOWED at the handshake', async (_id, column) => {
      await expectRefused({ ...ORIGINS[column] }, 403, 'ORIGIN_NOT_ALLOWED');
    });
  });

  describe('row X: the cookie and an Authorization header together', () => {
    it.each([
      ['S-X1', 1],
      ['S-X2', 2],
      ['S-X4', 4],
      ['S-X5', 5],
    ] as const)('%s: HTTP 403 ORIGIN_NOT_ALLOWED at the handshake', async (_id, column) => {
      await expectRefused({ ...cookie(), ...bearer(onTablet.token), ...ORIGINS[column] }, 403, 'ORIGIN_NOT_ALLOWED');
    });

    it('S-X3: with a web console origin: HTTP 401 NOT_SIGNED_IN with CREDENTIAL_CONFLICT, whatever either one holds', async () => {
      for (const authorization of [bearer(onTablet.token), bearer(unknownSession()), { authorization: 'Basic bm90OmE=' }]) {
        const details = await expectRefused({ ...cookie(), ...authorization, origin: WEB_ORIGIN }, 401, 'NOT_SIGNED_IN');
        expect(details).toEqual({ reason: 'CREDENTIAL_CONFLICT' });
      }
    });
  });
});

describe('AC-B-74, SR-70: the Origin of an upgrade is compared as an exact string', () => {
  it.each([
    ['http://localhost:5173'],
    ['null'],
    ['http://127.0.0.1:5173/'],
    ['HTTP://127.0.0.1:5173'],
    ['http://127.0.0.1:5174'],
    ['http://localhost:4420'],
    ['http://127.0.0.1:4420/'],
  ])('%s answers HTTP 403 with no credential, with the cookie and with a bearer value', async (origin) => {
    await expectRefused({ origin }, 403, 'ORIGIN_NOT_ALLOWED');
    await expectRefused({ origin, ...cookie() }, 403, 'ORIGIN_NOT_ALLOWED');
    await expectRefused({ origin, ...bearer(onTablet.token) }, 403, 'ORIGIN_NOT_ALLOWED');
  });

  it('every web console origin is accepted with the cookie, and only those (AC-B-43)', async () => {
    for (const origin of rt.app.config.webConsoleOrigins) {
      const socket = openSocket(rt.wsUrl, { origin, ...cookie() });
      expect(await helloOf(socket)).toMatchObject({ principal: 'OPERATOR' });
    }
    expect(rt.app.config.webConsoleOrigins.some((origin) => origin.includes('localhost'))).toBe(false);
  });
});

describe('decision D69, finding F55: what the mobile app\'s socket really sends', () => {
  it('the own origin, the bearer value, an HTTP library\'s agent, an offered permessage-deflate: OPERATOR; nothing keys on Host or User-Agent', async () => {
    const socket = openSocket(rt.wsUrl, deviceHeaders(onTablet.token));
    expect(await helloOf(socket)).toMatchObject({ principal: 'OPERATOR' });
    const other = openSocket(rt.wsUrl, { ...deviceHeaders(onTablet.token), host: '127.0.0.1:4420', 'user-agent': 'Mozilla/5.0' });
    expect(await helloOf(other)).toMatchObject({ principal: 'OPERATOR' });
  });

  it('a cookie of another instance, or a foreign cookie, beside the bearer value is neither a credential nor a conflict', async () => {
    for (const stray of ['dems_session_4421=ses_AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', 'theme=dark; other=1']) {
      const socket = openSocket(rt.wsUrl, { ...deviceHeaders(tablet.credential), cookie: stray });
      expect(await helloOf(socket)).toMatchObject({ principal: 'DEVICE' });
    }
  });
});

describe('AC-B-42, SR-38, SR-40, SR-49: a socket without a credential, and credentials outside the headers', () => {
  it('receives hello and heartbeat only, with sessionState null, whatever happens on the server', async () => {
    const socket = openSocket(rt.wsUrl);
    await helloOf(socket);
    const operator = await operatorSocket(rt, webHeaders(cookie()));
    await setMeters(rt, operator, true);

    // State changes, meter frames and every control event, while both sockets are open. The
    // engine's 1 Hz step falls on the whole second; its delta leaves at the pace step after it.
    await rt.drive(1_250);
    rt.app.publish({ kind: 'admin.changed', resource: 'USERS' });
    rt.app.publish({ kind: 'admin.changed', resource: 'DEVICES' });
    rt.app.publish({ kind: 'session.updated', operatorId: SUPERVISOR.id, role: 'SUPERVISOR', permissions: ROLE_PERMISSIONS.SUPERVISOR });
    rt.app.publish({ kind: 'session.ended', sessionIds: ['00000000-0000-4000-8000-000000000000'], reason: 'SIGNED_OUT' });
    rt.app.publish({ kind: 'device.revoked', deviceId: 'DEV-9999', reason: 'REVOKED' });
    await settle(rt, socket, operator);

    expect(new Set(socket.types())).toEqual(new Set(['hello', 'heartbeat']));
    expect(socket.types()[0]).toBe('hello');
    expect((socket.messages.filter((message) => message.type === 'heartbeat') as Heartbeat[]).every((beat) => beat.sessionState === null)).toBe(true);
    // The operator beside it did get them: the server had something to send.
    expect(new Set(operator.types())).toEqual(new Set(['hello', 'snapshot', 'heartbeat', 'delta', 'meters', 'admin.changed', 'session.updated']));
  });

  it('a ?token= query on the upgrade authenticates nothing, and the marker is not in the server log', async () => {
    for (const query of [`token=${QUERY_MARKER}`, `access_token=${QUERY_MARKER}`, `authorization=Bearer%20${QUERY_MARKER}`, `session=${QUERY_MARKER}&token=${QUERY_MARKER}`]) {
      const socket = openSocket(`${rt.wsUrl}?${query}`);
      const hello = await helloOf(socket);
      expect(hello).toMatchObject({ principal: 'ANONYMOUS', topics: ['heartbeat'] });
      expect('reason' in hello).toBe(false);
    }
    // With a credential in the headers the query changes nothing either.
    const operator = openSocket(`${rt.wsUrl}?token=${QUERY_MARKER}`, webHeaders(cookie()));
    expect(await helloOf(operator)).toMatchObject({ principal: 'OPERATOR' });
    await settle(rt, operator);
    expect(rt.log.text()).not.toContain(QUERY_MARKER);
  });

  it('a subprotocol authenticates nothing: none is selected or echoed, the caller is ANONYMOUS, and the marker is not in the log', async () => {
    const socket = openSocket(rt.wsUrl, {}, { protocols: [PROTOCOL_MARKER, 'bearer'] });
    // The server completes the handshake without a `Sec-WebSocket-Protocol` header. A client that
    // offered one gives the connection up at that point (this library and a browser both do),
    // so what the server made of the caller is read from its side.
    await socket.closed;
    expect(socket.upgradeHeaders['upgrade']).toBe('websocket');
    expect(socket.upgradeHeaders['sec-websocket-protocol']).toBeUndefined();
    expect(socket.ws.protocol).toBe('');
    await untilSockets(rt, 0);
    const opened = rt.log.lines().filter((line) => line['msg'] === 'socket opened');
    expect(opened.at(-1)).toMatchObject({ kind: 'ANONYMOUS', principal: null });
    expect(rt.log.text()).not.toContain(PROTOCOL_MARKER);
  });

  it('a message authenticates nothing: it closes the socket with 1008, and nothing of it is logged (SR-51)', async () => {
    const socket = openSocket(rt.wsUrl);
    await helloOf(socket);
    socket.send({ type: 'authenticate', token: QUERY_MARKER });
    expect((await socket.closed).code).toBe(1008);
    expect(rt.log.text()).not.toContain(QUERY_MARKER);
  });

  it('compression is off (RT-P7): an offered permessage-deflate is not negotiated', async () => {
    const socket = openSocket(rt.wsUrl, webHeaders(cookie()), { offerCompression: true });
    await helloOf(socket);
    expect(socket.ws.extensions).toBe('');
    expect(socket.upgradeHeaders['sec-websocket-extensions']).toBeUndefined();
    expect(socket.upgradeHeaders['upgrade']).toBe('websocket');
  });

  it('the log of all of the above holds no credential, no cookie value and no raw URL', async () => {
    const text = rt.log.text();
    expect(credentialLeaks(text)).toEqual([]);
    for (const secret of [onTablet.token, tablet.credential, endedToken, retiredCredential, retiredToken]) expect(text.includes(secret)).toBe(false);
    expect(text).not.toContain('?');
    const opened = rt.log.lines().filter((line) => line['msg'] === 'socket opened');
    expect(opened.length).toBeGreaterThan(0);
    for (const line of opened) expect(Object.keys(line).filter((key) => !['level', 'time', 'pid', 'hostname', 'msg'].includes(key)).sort()).toEqual(['connectionId', 'kind', 'principal']);
  });
});

describe('an upgrade is offered on /ws only', () => {
  it('an upgrade on a REST route answers HTTP 404 NOT_FOUND at the handshake; no socket opens and the query is not logged', async () => {
    const base = rt.wsUrl.slice(0, -WS_PATH.length);
    await expectRefused({}, 404, 'NOT_FOUND', `${base}/api/v1/health?token=${QUERY_MARKER}`);
    await expectRefused(webHeaders(cookie()), 404, 'NOT_FOUND', `${base}/api/v1/auth/session?token=${QUERY_MARKER}`);
    await expectRefused({}, 404, 'NOT_FOUND', `${base}/nowhere?token=${QUERY_MARKER}`);
    expect(rt.log.text()).not.toContain(QUERY_MARKER);
    expect(rt.log.text()).not.toContain('closed incoming websocket connection');
  });

  it('a GET of /ws without an upgrade answers 404 NOT_FOUND in the envelope, with the response headers of every answer', async () => {
    const response = await rt.app.inject({ method: 'GET', url: WS_PATH });
    expect(response.statusCode).toBe(404);
    expect((response.json() as { error: { code: string } }).error.code).toBe('NOT_FOUND');
    expect(response.headers['cache-control']).toBe('no-store');
    const post = await rt.app.inject({ method: 'POST', url: WS_PATH, headers: { origin: WEB_ORIGIN } });
    expect(post.statusCode).toBe(405);
  });
});

describe('a handshake that is answered over HTTP leaves no socket on the server', () => {
  /** The connections the listener holds, as Node counts them. */
  const connections = (): Promise<number> =>
    new Promise((resolve, reject) => rt.app.server.getConnections((error, count) => (error ? reject(error) : resolve(count))));

  /** Lets the event loop run until the listener holds exactly `count` connections; a guard, not a pause. */
  async function untilConnections(count: number): Promise<void> {
    for (let turn = 0; turn < 5_000; turn += 1) {
      if ((await connections()) === count) return;
      await new Promise((resolve) => setImmediate(resolve));
    }
    throw new Error(`the listener holds ${await connections()} connection(s), not ${count}`);
  }
  const untilNoConnection = (): Promise<void> => untilConnections(0);
  const closeOf = (socket: Socket): Promise<void> => new Promise((resolve) => (socket.destroyed ? resolve() : socket.once('close', () => resolve())));
  const base = (): string => rt.wsUrl.slice(0, -WS_PATH.length);
  /** A path with an escape the router cannot decode: it is answered where no hook runs. */
  const UNDECODABLE = '/%E0%A4%A';

  it('after a 403, a 401, a 404 and a 429 the socket of the upgrade is destroyed by the server, whatever the client does', async () => {
    const cases: ReadonlyArray<readonly [Headers, number, string?]> = [
      [{ origin: FOREIGN_ORIGIN }, 403],
      [{ ...cookie(), ...bearer(onTablet.token), origin: WEB_ORIGIN }, 401],
      [{}, 404, `${rt.wsUrl.slice(0, -WS_PATH.length)}/api/v1/health`],
    ];
    for (const [headers, status, url] of cases) {
      // A raw client that does NOT close after the answer: the server must.
      const { response, socket } = await rawUpgrade(url ?? rt.wsUrl, headers);
      expect(response.startsWith(`HTTP/1.1 ${status} `), `status ${status}`).toBe(true);
      await new Promise<void>((resolve) => socket.once('close', () => resolve()));
    }
    await untilNoConnection();
    expect(await connections()).toBe(0);
  });

  it('a path the router cannot decode answers 400 INVALID_PATH; the socket is gone when the peer ends', async () => {
    const refused = openSocket(`${rt.wsUrl.slice(0, -WS_PATH.length)}/%zz`);
    const refusal = await refused.refused;
    expect([refusal.status, refusal.code]).toEqual([400, 'INVALID_PATH']);
    await untilNoConnection();
  });

  it('CPS1-4: an upgrade on a path the router cannot decode, whose peer keeps the connection: answered 400, held by the guard, destroyed at the pace step after 5,000 ms; nothing of its query is logged', async () => {
    expect([REALTIME_HANDSHAKE_TIMEOUT_MS, REALTIME_DELTA_PACE_MS]).toEqual([5_000, 250]);
    const logMark = rt.log.lines().length;
    const before = rt.channel.handshakes();
    const { response, socket } = await rawUpgrade(`${base()}${UNDECODABLE}?token=${QUERY_MARKER}`, {});
    expect(response.startsWith('HTTP/1.1 400 ')).toBe(true);
    let closed = false;
    socket.once('close', () => {
      closed = true;
    });
    // No hook ran for it, so nothing destroyed it: the guard holds it, outside the hub's sockets.
    expect(rt.channel.handshakes().pending).toBe(before.pending + 1);
    expect(rt.channel.stats().sockets).toBe(0);
    expect(await connections()).toBe(1);

    // The peer does nothing. One pace step before the bound the socket is still there.
    rt.steps.advance(REALTIME_HANDSHAKE_TIMEOUT_MS - REALTIME_DELTA_PACE_MS);
    await new Promise((resolve) => setImmediate(resolve));
    expect(rt.channel.handshakes().pending).toBe(before.pending + 1);
    expect(closed).toBe(false);
    // At the latest one pace step after the bound the server has destroyed it.
    rt.steps.advance(2 * REALTIME_DELTA_PACE_MS);
    expect(rt.channel.handshakes()).toMatchObject({ pending: before.pending, expired: before.expired + 1 });
    await closeOf(socket);
    await untilNoConnection();

    const lines = rt.log.lines().slice(logMark);
    expect(JSON.stringify(lines)).not.toContain(QUERY_MARKER);
    expect(JSON.stringify(lines)).not.toContain('?');
    // The request line holds the path without its query; the guard's line holds a count and the bound.
    expect(lines.filter((line) => line['msg'] === 'request completed').map((line) => [line['status'], line['route']])).toEqual([[400, UNDECODABLE]]);
    const swept = lines.filter((line) => line['msg'] === 'upgrade sockets destroyed: not taken by the socket route within the bound');
    expect(swept).toHaveLength(1);
    expect(swept[0]).toMatchObject({ destroyed: 1, boundMs: 5_000 });
  });

  it('CPS1-4: an upgrade to an unknown path and to a REST route, each with a query, is answered 404 and its socket destroyed at once, with no step of the clock; the query is not logged', async () => {
    const logMark = rt.log.lines().length;
    for (const path of ['/nowhere', '/api/v1/health', '/api/v1/auth/status']) {
      const { response, socket } = await rawUpgrade(`${base()}${path}?token=${QUERY_MARKER}`, {});
      expect(response.startsWith('HTTP/1.1 404 '), path).toBe(true);
      await closeOf(socket);
    }
    expect(rt.channel.handshakes().pending).toBe(0);
    await untilNoConnection();
    const lines = rt.log.lines().slice(logMark);
    expect(JSON.stringify(lines)).not.toContain(QUERY_MARKER);
    expect(lines.filter((line) => line['msg'] === 'request completed').map((line) => [line['status'], line['route']])).toEqual([
      [404, '/nowhere'],
      [404, '/api/v1/health'],
      [404, '/api/v1/auth/status'],
    ]);
  });

  it('CPS1-4: a flood of such upgrades holds 32 sockets and no more: the 33rd destroys the oldest; none takes a place of the hub, and a real handshake still gets through', async () => {
    expect(REALTIME_MAX_PENDING_HANDSHAKES).toBe(32);
    const before = rt.channel.handshakes();
    const held: Socket[] = [];
    for (let index = 0; index < REALTIME_MAX_PENDING_HANDSHAKES + 1; index += 1) {
      const { response, socket } = await rawUpgrade(`${base()}${UNDECODABLE}`, {});
      expect(response.startsWith('HTTP/1.1 400 ')).toBe(true);
      held.push(socket);
    }
    await closeOf(held[0]!);
    expect(rt.channel.handshakes()).toMatchObject({ pending: 32, displaced: before.displaced + 1 });
    await untilConnections(32);
    expect(held.filter((socket) => socket.destroyed)).toHaveLength(1);
    // They are outside the hub: sixteen places are free, and an operator connects.
    expect(rt.channel.stats()).toMatchObject({ sockets: 0, connections: 0 });
    const operator = await operatorSocket(rt, webHeaders(cookie()));
    expect(operator.ws.readyState).toBe(operator.ws.OPEN);
    expect(rt.channel.stats()).toMatchObject({ connections: 1, operators: 1 });

    // The bound ends the rest, whatever their peers do.
    rt.steps.advance(REALTIME_HANDSHAKE_TIMEOUT_MS + REALTIME_DELTA_PACE_MS);
    await Promise.all(held.map(closeOf));
    expect(rt.channel.handshakes().pending).toBe(0);
    await untilConnections(1);
    await settle(rt, operator);
    expect(operator.ws.readyState).toBe(operator.ws.OPEN);
  });

  it('a handshake the socket library itself refuses (no key) is answered 400 and its socket is closed by the server', async () => {
    const answered = new Promise<{ response: string; closed: Promise<void> }>((resolve, reject) => {
      const socket = connect(rt.port, '127.0.0.1');
      let response = '';
      const closed = new Promise<void>((done) => socket.once('close', () => done()));
      socket.on('error', reject);
      socket.on('data', (chunk: Buffer) => {
        response += chunk.toString('utf8');
        if (response.includes('\r\n\r\n')) resolve({ response, closed });
      });
      socket.on('connect', () => socket.write(['GET /ws HTTP/1.1', 'Host: 127.0.0.1', 'Connection: Upgrade', 'Upgrade: websocket', 'Sec-WebSocket-Version: 13'].join('\r\n') + '\r\n\r\n'));
    });
    const { response, closed } = await answered;
    expect(response.startsWith('HTTP/1.1 400 ')).toBe(true);
    await closed;
    await untilNoConnection();
    expect(rt.channel.stats().sockets).toBe(0);
    const headers = response.split('\r\n\r\n')[0]?.split('\r\n').slice(1).map((line) => line.split(':')[0]?.toLowerCase()) ?? [];
    console.info(`[w42] a handshake refused by the socket library: ${response.split('\r\n')[0]}; headers: ${headers.join(', ')}`);
  });

  it('a peer that resets the connection before the answer is written does not end the process', async () => {
    // The class of a caller without a principal is used up, so the next upgrade is answered 429
    // AFTER stage 4 asked the database: time for the peer to reset the connection in between.
    for (let index = 0; index < 30; index += 1) await rt.app.inject({ method: 'GET', url: '/api/v1/auth/status' });
    for (let round = 0; round < 5; round += 1) {
      const upgraded = new Promise<void>((resolve) => rt.app.server.once('upgrade', () => resolve()));
      const socket = connect(rt.port, '127.0.0.1');
      socket.on('error', () => {});
      socket.write(upgradeRequest(WS_PATH, bearer(unknownSession())));
      await upgraded;
      socket.resetAndDestroy();
    }
    await untilNoConnection();
    // The server still answers, and what it logged about the lost peers is no failure of its own.
    expect((await rt.app.inject({ method: 'GET', url: '/api/v1/health' })).statusCode).toBe(200);
    expect(rt.log.lines().filter((line) => line['msg'] === 'unexpected error while handling a request')).toEqual([]);
  });
});

describe('what a client may send (RT-P4, RT-P5)', () => {
  it('a message of exactly 65,536 bytes is read; one byte more closes the socket with 1009 before it is buffered', async () => {
    expect(REALTIME_CLIENT_MESSAGE_MAX_BYTES).toBe(65_536);
    const atLimit = await operatorSocket(rt, webHeaders(cookie()));
    const resync = '{"type":"resync"}';
    atLimit.sendRaw(resync + ' '.repeat(REALTIME_CLIENT_MESSAGE_MAX_BYTES - resync.length));
    await atLimit.nextOf('snapshot', 2);
    expect(atLimit.ws.readyState).toBe(atLimit.ws.OPEN);

    const over = await operatorSocket(rt, webHeaders(cookie()));
    over.sendRaw(resync + ' '.repeat(REALTIME_CLIENT_MESSAGE_MAX_BYTES - resync.length + 1));
    expect((await over.closed).code).toBe(1009);
    expect(over.types().filter((type) => type === 'snapshot')).toHaveLength(1);
  });

  it('a binary frame, text that is no client message, and a 31st message in 10 s close with 1008', async () => {
    const binary = await operatorSocket(rt, webHeaders(cookie()));
    binary.sendRaw(Buffer.from('{"type":"resync"}'), true);
    expect((await binary.closed).code).toBe(1008);

    const unknown = await operatorSocket(rt, webHeaders(cookie()));
    unknown.send({ type: 'ping' });
    expect((await unknown.closed).code).toBe(1008);

    const chatty = await operatorSocket(rt, webHeaders(cookie()));
    for (let index = 0; index < 31; index += 1) chatty.send({ type: 'subscribe', topic: 'meters' });
    expect((await chatty.closed).code).toBe(1008);
  });
});

describe('AC-B-85, SR-42: the connection caps over real sockets', () => {
  it('with six anonymous sockets open a seventh is closed with 1013, an operator\'s and a device\'s upgrade are accepted, and the 17th connection of any kind is closed with 1013', async () => {
    expect([REALTIME_MAX_ANONYMOUS, REALTIME_MAX_CONNECTIONS]).toEqual([6, 16]);
    const anonymous = Array.from({ length: 6 }, () => openSocket(rt.wsUrl));
    for (const socket of anonymous) await helloOf(socket);

    const seventh = openSocket(rt.wsUrl);
    await seventh.opened;
    expect((await seventh.closed).code).toBe(1013);
    expect(seventh.messages).toEqual([]);

    const operator = openSocket(rt.wsUrl, webHeaders(cookie()));
    expect(await helloOf(operator)).toMatchObject({ principal: 'OPERATOR' });
    const device = openSocket(rt.wsUrl, deviceHeaders(tablet.credential));
    expect(await helloOf(device)).toMatchObject({ principal: 'DEVICE' });
    await untilSockets(rt, 8);
    expect(rt.channel.stats()).toMatchObject({ connections: 8, anonymous: 6, operators: 1, devices: 1 });

    // The health answer counts every socket: anonymous, device and operator.
    const health = (await rt.app.inject({ method: 'GET', url: '/api/v1/health' })).json() as { ws: { clients: number } };
    expect(health.ws.clients).toBe(8);

    // The ten places of the principals, each principal within its own cap (CPS1-5): the
    // supervisor's session with four tabs, a second operator's session with four, the tablet
    // with its own socket and the socket of the session on it.
    const investigatorWeb = await webOperator(rt, INVESTIGATOR);
    const more = [
      ...Array.from({ length: 3 }, () => openSocket(rt.wsUrl, webHeaders(cookie()))),
      ...Array.from({ length: 4 }, () => openSocket(rt.wsUrl, webHeaders(investigatorWeb.cookie))),
      openSocket(rt.wsUrl, deviceHeaders(onTablet.token)),
    ];
    for (const socket of more) expect(await helloOf(socket)).toMatchObject({ principal: 'OPERATOR' });
    const full = rt.channel.stats();
    expect(full).toMatchObject({ connections: 16, anonymous: 6, operators: 9, devices: 1 });

    // The 17th, of a principal that holds no socket yet, of any kind, is closed with 1013.
    const technicianWeb = await webOperator(rt, TECHNICIAN);
    const otherTablet = await pairedDevice(rt, supervisor, 'Interview tablet 03');
    for (const headers of [webHeaders(technicianWeb.cookie), deviceHeaders(otherTablet.credential), {}]) {
      const beyond = openSocket(rt.wsUrl, headers);
      await beyond.opened;
      expect(await beyond.closed).toEqual({ code: 1013, reason: CLOSE_REASON.CAP });
      expect(beyond.messages).toEqual([]);
    }
    await untilSockets(rt, 16);
    expect(rt.channel.stats()).toMatchObject({ connections: 16, displaced: full.displaced, refusedByCap: full.refusedByCap + 3 });

    // A principal at its own cap is not kept out by the full hub: its newest socket takes the
    // place of its oldest, and the total stays 16.
    const reconnected = openSocket(rt.wsUrl, webHeaders(cookie()));
    expect(await helloOf(reconnected)).toMatchObject({ principal: 'OPERATOR' });
    expect(await operator.closed).toEqual({ code: 1013, reason: CLOSE_REASON.REPLACED });
    await untilSockets(rt, 16);
    expect(rt.channel.stats()).toMatchObject({ connections: 16, displaced: full.displaced + 1, refusedByCap: full.refusedByCap + 3 });

    // A place that is freed is given again.
    anonymous[0]?.terminate();
    more[3]?.terminate();
    await untilSockets(rt, 14);
    expect(await helloOf(openSocket(rt.wsUrl))).toMatchObject({ principal: 'ANONYMOUS' });
    expect(await helloOf(openSocket(rt.wsUrl, webHeaders(technicianWeb.cookie)))).toMatchObject({ principal: 'OPERATOR' });
  });

  it('after the sockets closed the health answer counts none', async () => {
    await untilSockets(rt, 0);
    const health = (await rt.app.inject({ method: 'GET', url: '/api/v1/health' })).json() as { ws: { clients: number } };
    expect(health.ws.clients).toBe(0);
    expect(rt.channel.stats()).toMatchObject({ connections: 0, sockets: 0 });
  });
});

describe('CPS1-5: the cap of one principal, over real sockets', () => {
  const REPLACED = { code: 1013, reason: CLOSE_REASON.REPLACED };

  it('one web session: four tabs are open; a fifth is admitted and the first is closed with 1013; a second operator and a device are not touched. One device credential: two sockets beside the session on that device; a third closes its oldest', async () => {
    expect([REALTIME_MAX_PER_SESSION, REALTIME_MAX_PER_DEVICE]).toEqual([4, 2]);
    const before = rt.channel.stats();
    const tabs: TestSocket[] = [];
    for (let index = 0; index < 4; index += 1) tabs.push(await operatorSocket(rt, webHeaders(cookie())));
    const other = await operatorSocket(rt, webHeaders((await webOperator(rt, INVESTIGATOR)).cookie));
    const device = openSocket(rt.wsUrl, deviceHeaders(tablet.credential));
    expect(await helloOf(device)).toMatchObject({ principal: 'DEVICE' });
    expect(rt.channel.stats()).toMatchObject({ operators: 5, devices: 1, displaced: before.displaced });

    const fifth = await operatorSocket(rt, webHeaders(cookie()));
    expect(await tabs[0]!.closed).toEqual(REPLACED);
    expect(fifth.types().slice(0, 2)).toEqual(['hello', 'snapshot']);
    await untilSockets(rt, 6);
    await settle(rt, ...tabs.slice(1), fifth, other, device);
    for (const socket of [...tabs.slice(1), fifth, other, device]) expect(socket.ws.readyState).toBe(socket.ws.OPEN);
    expect(rt.channel.stats()).toMatchObject({ operators: 5, devices: 1, displaced: before.displaced + 1, refusedByCap: before.refusedByCap });

    // The tablet. The session on it is a principal of its own (a device may hold several
    // sessions): with it and two sockets of the device credential, three sockets of one device
    // are open and nothing is displaced.
    const session = await operatorSocket(rt, deviceHeaders(onTablet.token));
    await rt.channel.settled();
    const again = openSocket(rt.wsUrl, deviceHeaders(tablet.credential));
    expect(await helloOf(again)).toMatchObject({ principal: 'DEVICE' });
    await untilSockets(rt, 8);
    await settle(rt, device, session, again);
    for (const socket of [device, session, again]) expect(socket.ws.readyState).toBe(socket.ws.OPEN);
    expect(rt.channel.stats()).toMatchObject({ operators: 6, devices: 2, displaced: before.displaced + 1, refusedByCap: before.refusedByCap });

    // A third socket of the device credential closes that credential's oldest; the session stays.
    const third = openSocket(rt.wsUrl, deviceHeaders(tablet.credential));
    expect(await helloOf(third)).toMatchObject({ principal: 'DEVICE' });
    expect(await device.closed).toEqual(REPLACED);
    await untilSockets(rt, 8);
    await settle(rt, session, again, third);
    for (const socket of [session, again, third]) expect(socket.ws.readyState).toBe(socket.ws.OPEN);
    expect(rt.channel.stats()).toMatchObject({ operators: 6, devices: 2, displaced: before.displaced + 2, refusedByCap: before.refusedByCap });
    // The device never left: the registry lists it online, and the link was not toggled.
    await rt.channel.settled();
    expect(rt.engine.slice('tabletLink').state).toBe('CONNECTED');
  });

  it('a reconnect storm of one client does not lock it out: twelve sockets of one session one after another, then ten at once, none closed by the client; every handshake is admitted as OPERATOR and four stay open', async () => {
    const before = rt.channel.stats();
    const bystander = await operatorSocket(rt, webHeaders((await webOperator(rt, INVESTIGATOR)).cookie));
    const codes: number[] = [];
    const watch = (socket: TestSocket): TestSocket => {
      void socket.whenClosed.then((closed) => codes.push(closed.code));
      return socket;
    };

    const storm: TestSocket[] = [];
    for (let index = 0; index < 12; index += 1) {
      const socket = watch(openSocket(rt.wsUrl, webHeaders(cookie())));
      expect(await helloOf(socket), `socket ${index + 1}`).toMatchObject({ principal: 'OPERATOR' });
      await socket.nextOf('snapshot');
      storm.push(socket);
      expect(rt.channel.stats().operators).toBeLessThanOrEqual(1 + REALTIME_MAX_PER_SESSION);
    }
    for (const socket of storm.slice(0, 8)) expect((await socket.closed).code).toBe(1013);
    await untilSockets(rt, 5);
    for (const socket of storm.slice(8)) expect(socket.ws.readyState).toBe(socket.ws.OPEN);

    // Ten at once: the order of admission is the server's; whichever four came last stay.
    const burst = Array.from({ length: 10 }, () => watch(openSocket(rt.wsUrl, webHeaders(cookie()))));
    for (const hello of await Promise.all(burst.map(helloOf))) expect(hello).toMatchObject({ principal: 'OPERATOR' });
    await untilSockets(rt, 5);
    await eventually('the clients seeing their closes', () => codes.length === 18);
    expect(codes.every((code) => code === 1013)).toBe(true);
    expect([...storm, ...burst].filter((socket) => socket.ws.readyState === socket.ws.OPEN)).toHaveLength(4);

    // Nobody else paid for it: the bystander is open, nothing was refused, the session holds four.
    await settle(rt, bystander);
    expect(bystander.ws.readyState).toBe(bystander.ws.OPEN);
    expect(rt.channel.stats()).toMatchObject({ connections: 5, operators: 5, displaced: before.displaced + 18, refusedByCap: before.refusedByCap });
    expect(rt.channel.connections().filter((connection) => connection.operatorId === SUPERVISOR.id)).toHaveLength(4);
  });
});

describe('AC-B-84, SR-24, SR-75: upgrades are counted by the throttle', () => {
  it('after 30 anonymous upgrades within 60 s the next one is refused with HTTP 429 at the handshake; another class and a principal are not; 60 s later it is counted afresh', async () => {
    for (let index = 0; index < 30; index += 1) {
      const socket = openSocket(rt.wsUrl);
      await helloOf(socket);
      socket.terminate();
      await untilSockets(rt, 0);
    }
    const before = rt.channel.stats().sockets;
    const refused = openSocket(rt.wsUrl);
    const refusal = await refused.refused;
    expect([refusal.status, refusal.code]).toEqual([429, 'RATE_LIMITED']);
    expect(Number(refusal.headers['retry-after'])).toBeGreaterThan(0);
    expect(Number(refusal.headers['retry-after'])).toBeLessThanOrEqual(60);
    expect(rt.channel.stats().sockets).toBe(before);
    // A value the caller chose changes nothing: an unknown bearer value is counted in the same class.
    expect((await openSocket(rt.wsUrl, bearer(unknownSession())).refused).status).toBe(429);
    expect((await openSocket(rt.wsUrl, { origin: OWN_ORIGIN }).refused).status).toBe(429);

    // The web class is another bucket; an operator and a device have their own.
    expect(await helloOf(openSocket(rt.wsUrl, { origin: WEB_ORIGIN }))).toMatchObject({ principal: 'ANONYMOUS' });
    expect(await helloOf(openSocket(rt.wsUrl, webHeaders(cookie())))).toMatchObject({ principal: 'OPERATOR' });
    expect(await helloOf(openSocket(rt.wsUrl, deviceHeaders(tablet.credential)))).toMatchObject({ principal: 'DEVICE' });

    rt.steps.advance(60_000);
    expect(await helloOf(openSocket(rt.wsUrl))).toMatchObject({ principal: 'ANONYMOUS' });

    // A throttled upgrade is logged, never audited (GS-07).
    expect(rt.log.lines().some((line) => line['msg'] === 'rate limit reached' && line['limiter'] === 'throttle' && line['key'] === 'class:local')).toBe(true);
  });

  it('a refusal by the throttle wrote no audit row', async () => {
    const { rows } = await db.ownerPool().query<{ count: string }>("SELECT count(*) AS count FROM public.audit_log WHERE type = 'ACCESS_DENIED'");
    expect(Number(rows[0]?.count)).toBe(0);
  });
});
