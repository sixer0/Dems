// The realtime unit inside the app factory, without a database and without a listener (plan row
// W42; P25; decision D83 DN-3). What the scaffold and the other units rely on: the seam `publish`
// is filled here and never throws, the one socket route is registered under the guard's fixed
// rule, the timers run only while the server listens, and a stop closes every socket with 1001.
// A socket here is opened through the socket plugin's own `injectWS`: the upgrade passes the real
// stages (no credential is presented, so no database is asked), with no port bound.
import { WS_PATH, WsServerMessageSchema, type WsServerMessage } from '@dems/shared/api';
import type { FastifyInstance } from 'fastify';
import { afterEach, describe, expect, it } from 'vitest';
import type { WebSocket } from 'ws';
import { buildApp } from '../../app';
import { createManualClock } from '@dems/shared/sim';
import { captureLog, unitTestConfig, type CapturedLog } from '../../../test/support/config';
import { REALTIME_CHANNEL_ID, REALTIME_CHANNEL_RULE, permissionGuard } from '../../plugins/permission-guard';
import {
  REALTIME_CLOSE_GRACE_MS,
  REALTIME_DELTA_PACE_MS,
  REALTIME_HANDSHAKE_TIMEOUT_MS,
  REALTIME_LIMITS,
  REALTIME_PING_INTERVAL_MS,
  realtimeControl,
  type Publication,
} from '../index';

const apps: FastifyInstance[] = [];
const CLOCK_START = Date.UTC(2031, 0, 1);

interface ReadyApp {
  readonly app: FastifyInstance;
  readonly log: CapturedLog;
  readonly clock: ReturnType<typeof createManualClock>;
}

/** The real app, ready, both readiness flags set by hand: no boot, no database, no listener. */
async function readyApp(): Promise<ReadyApp> {
  const log = captureLog();
  const app = buildApp({ config: unitTestConfig({ logLevel: 'info' }), logStream: log.stream });
  apps.push(app);
  await app.ready();
  const clock = createManualClock(CLOCK_START);
  app.seams.replace('clock', clock);
  app.readiness.set('database', true);
  app.readiness.set('engine', true);
  return { app, log, clock };
}

interface Injected {
  readonly socket: WebSocket;
  readonly messages: WsServerMessage[];
  readonly closed: Promise<number>;
  next(type: WsServerMessage['type'], from?: number): Promise<WsServerMessage>;
}

/** A socket opened in-process; its listeners are attached before the handshake completes, so no frame is missed. */
async function inject(app: FastifyInstance, headers: Record<string, string> = {}): Promise<Injected> {
  const messages: WsServerMessage[] = [];
  const waiting: Array<() => void> = [];
  let resolveClosed!: (code: number) => void;
  const closed = new Promise<number>((resolve) => {
    resolveClosed = resolve;
  });
  const socket = await app.injectWS(WS_PATH, { headers }, {
    onInit(ws) {
      ws.on('message', (data) => {
        messages.push(WsServerMessageSchema.parse(JSON.parse(data.toString())));
        for (const wake of waiting.splice(0)) wake();
      });
      ws.on('close', (code) => resolveClosed(code));
    },
  });
  return {
    socket,
    messages,
    closed,
    async next(type, from = 0) {
      for (;;) {
        const found = messages.slice(from).find((message) => message.type === type);
        if (found !== undefined) return found;
        await new Promise<void>((resolve) => waiting.push(resolve));
      }
    },
  };
}

afterEach(async () => {
  for (const app of apps.splice(0)) await app.close();
});

describe('the seam publish (P25)', () => {
  it('is provided by this unit, with its controls behind it; another function behind the seam has none', async () => {
    const { app } = await readyApp();
    expect(app.seams.get('publish')).toBe(app.publish);
    const control = realtimeControl(app);
    expect(control.limits).toBe(REALTIME_LIMITS);
    expect(control.stats()).toMatchObject({ connections: 0, sockets: 0, beats: 0 });
    app.seams.replace('publish', () => {});
    expect(() => realtimeControl(app)).toThrow('app.publish is not the channel of src/realtime: the seam was replaced');
  });

  it('returns at once and never throws, for every kind of publication, with nobody connected and with the engine not started', async () => {
    const { app } = await readyApp();
    const publications: Publication[] = [
      { kind: 'state', change: { epoch: 1, revision: 0, at: CLOCK_START, cause: 'start', records: false, ops: [] } },
      { kind: 'state', change: { epoch: 1, revision: 1, at: CLOCK_START, cause: 'tick', records: false, ops: [] } },
      { kind: 'meters', frame: { at: CLOCK_START, seq: 1, audio: { channels: {} } as never } },
      { kind: 'session.updated', operatorId: 'OPR-001', role: 'SUPERVISOR', permissions: [] },
      { kind: 'session.ended', sessionIds: ['a', 'b'], reason: 'SIGNED_OUT' },
      { kind: 'device.revoked', deviceId: 'DEV-0001', reason: 'REVOKED' },
      { kind: 'admin.changed', resource: 'USERS' },
    ];
    for (const publication of publications) expect(app.publish(publication), publication.kind).toBeUndefined();
    expect(realtimeControl(app).stats().heldDeltas).toBe(0);
  });
});

describe('the socket route (decision D83 DN-3)', () => {
  it('is GET /ws, the one route of this unit, under the guard\'s fixed rule and outside the registry', async () => {
    const { app } = await readyApp();
    expect(app.hasRoute({ method: 'GET', url: WS_PATH })).toBe(true);
    expect(app.hasRoute({ method: 'POST', url: WS_PATH })).toBe(false);
    const rule = permissionGuard(app).registeredRules().find((entry) => entry.operationId === REALTIME_CHANNEL_ID);
    expect(rule).toBe(REALTIME_CHANNEL_RULE);
    expect(permissionGuard(app).routeProblems()).toEqual([]);
  });

  it('a GET without an upgrade answers 404 NOT_FOUND in the envelope; while not ready the handshake answers 503', async () => {
    const { app } = await readyApp();
    const plain = await app.inject({ method: 'GET', url: WS_PATH });
    expect([plain.statusCode, (plain.json() as { error: { code: string } }).error.code]).toEqual([404, 'NOT_FOUND']);
    app.readiness.set('engine', false);
    await expect(app.injectWS(WS_PATH)).rejects.toThrow('Unexpected server response: 503');
    expect(realtimeControl(app).stats().sockets).toBe(0);
  });

  it('an upgrade passes the real stages: a foreign Origin is refused with 403 before the channel sees it', async () => {
    const { app } = await readyApp();
    await expect(app.injectWS(WS_PATH, { headers: { origin: 'http://evil.example' } })).rejects.toThrow('Unexpected server response: 403');
    await expect(app.injectWS('/api/v1/health')).rejects.toThrow('Unexpected server response: 404');
    expect(realtimeControl(app).stats().sockets).toBe(0);
    // The socket of each refused handshake was handed to the guard and destroyed with the answer.
    expect(realtimeControl(app).handshakes()).toEqual({ pending: 0, expired: 0, displaced: 0 });
  });

  it('a socket the route took is the socket library\'s: the guard holds none, and its bound never ends an open socket', async () => {
    const { app, clock } = await readyApp();
    const control = realtimeControl(app);
    const { socket, next } = await inject(app);
    await next('heartbeat');
    expect(control.handshakes()).toEqual({ pending: 0, expired: 0, displaced: 0 });
    clock.advance(10 * REALTIME_HANDSHAKE_TIMEOUT_MS);
    control.pace();
    expect(socket.readyState).toBe(socket.OPEN);
    expect(control.stats()).toMatchObject({ connections: 1, sockets: 1 });
    expect(control.handshakes().expired).toBe(0);
  });

  it('a socket without a credential: hello and a heartbeat, epoch 0 while the engine never started, and nothing of what is published', async () => {
    const { app, clock } = await readyApp();
    const control = realtimeControl(app);
    const { messages, next } = await inject(app);
    await next('heartbeat');
    expect(messages.map((message) => message.type)).toEqual(['hello', 'heartbeat']);
    expect(messages[0]).toMatchObject({ principal: 'ANONYMOUS', topics: ['heartbeat'], epoch: 0, serverTime: CLOCK_START, heartbeatIntervalMs: 1000 });
    expect(control.stats()).toMatchObject({ connections: 1, anonymous: 1 });

    app.publish({ kind: 'admin.changed', resource: 'USERS' });
    app.publish({ kind: 'session.ended', sessionIds: ['x'], reason: 'SIGNED_OUT' });
    clock.advance(1_000);
    control.beat();
    await next('heartbeat', 2);
    expect(messages.map((message) => message.type)).toEqual(['hello', 'heartbeat', 'heartbeat']);
    expect(messages[2]).toMatchObject({ seq: 1, uptimeMs: 1_000, clients: 1, sessionState: null });
  });
});

describe('the timers and the stop (spec §8.6)', () => {
  it('no timer runs before the server listens; the timer can be replaced until then', async () => {
    const { app } = await readyApp();
    const control = realtimeControl(app);
    expect(control.running).toBe(false);
    const registered: number[] = [];
    control.useTimer({
      every(intervalMs) {
        registered.push(intervalMs);
        return () => {};
      },
    });
    expect(registered).toEqual([]);
    // The three intervals the plugin asks for when the listener opens.
    expect([1_000, REALTIME_DELTA_PACE_MS, REALTIME_PING_INTERVAL_MS]).toEqual([1_000, 250, 30_000]);
    expect(REALTIME_CLOSE_GRACE_MS + REALTIME_DELTA_PACE_MS).toBe(1_000);
  });

  it('closing the app closes every socket with 1001, and the log names each socket by its ID only', async () => {
    const { app, log } = await readyApp();
    const first = await inject(app);
    const second = await inject(app, { origin: 'http://127.0.0.1:5173' });
    await Promise.all([first.next('heartbeat'), second.next('heartbeat')]);
    expect(realtimeControl(app).stats().sockets).toBe(2);

    apps.splice(apps.indexOf(app), 1);
    await app.close();
    expect(await Promise.all([first.closed, second.closed])).toEqual([1001, 1001]);
    expect(realtimeControl(app).stats().sockets).toBe(0);
    const lines = log.lines().filter((line) => line['msg'] === 'socket closed');
    expect(lines).toHaveLength(2);
    for (const line of lines) expect(line).toMatchObject({ code: 1001, closedBy: 'server', principal: null });
  });
});
