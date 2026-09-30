/**
 * Heartbeat plugin (masterplan/01_specs.md §3.1, §3.3).
 *
 * Owns `seq`, the client registry, the 1 Hz ticker (started on `onReady`, cleared on
 * `onClose`) and the broadcast to every open client. Also registers the `GET /ws` upgrade
 * route with its Origin allowlist (SPEC-C5), enforced in `preValidation`, which runs before
 * the upgrade (V22).
 */
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { WebSocket } from 'ws';
import {
  HEARTBEAT_INTERVAL_MS,
  SELF_ORIGINS,
  WEB_DEV_ORIGINS,
  WS_PATH,
  type Heartbeat,
} from '@dems/shared/api';
import { appendErrorLog, toErrorFields } from './error-log';

export const ALLOWED_WS_ORIGINS: ReadonlySet<string> = new Set([...WEB_DEV_ORIGINS, ...SELF_ORIGINS]);

export interface HeartbeatHub {
  /** Global tick counter since server start. */
  readonly seq: number;
  /** Currently connected WS clients. */
  readonly clientCount: number;
  uptimeMs(): number;
}

interface HubState extends HeartbeatHub {
  seq: number;
  nextClientId: number;
  clients: Map<number, WebSocket>;
}

export function createHeartbeatHub(startedAt: number = Date.now()): HubState {
  const clients = new Map<number, WebSocket>();
  return {
    seq: 0,
    nextClientId: 1,
    clients,
    get clientCount() {
      return clients.size;
    },
    uptimeMs: () => Math.max(0, Math.round(Date.now() - startedAt)),
  };
}

function heartbeatMessage(hub: HubState): Heartbeat {
  return {
    type: 'heartbeat',
    v: 1,
    seq: hub.seq,
    serverTime: new Date().toISOString(),
    uptimeMs: hub.uptimeMs(),
    intervalMs: HEARTBEAT_INTERVAL_MS,
    clients: hub.clientCount,
    sessionState: null,
  };
}

async function checkOrigin(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const origin = request.headers.origin;
  if (origin === undefined || ALLOWED_WS_ORIGINS.has(origin)) return;
  request.log.warn({ origin }, 'ws origin rejected');
  await reply.code(403).send({ error: 'origin_not_allowed' });
}

export function registerHeartbeat(app: FastifyInstance, hub: HubState): void {
  let ticker: ReturnType<typeof setInterval> | null = null;

  function broadcast(): void {
    const frame = JSON.stringify(heartbeatMessage(hub));
    for (const socket of hub.clients.values()) {
      if (socket.readyState === socket.OPEN) socket.send(frame);
    }
  }

  app.addHook('onReady', async () => {
    ticker = setInterval(() => {
      hub.seq += 1;
      broadcast();
    }, HEARTBEAT_INTERVAL_MS);
  });

  app.addHook('onClose', async () => {
    if (ticker !== null) clearInterval(ticker);
    ticker = null;
  });

  app.get(WS_PATH, { websocket: true, preValidation: checkOrigin }, (socket, request) => {
    const clientId = hub.nextClientId++;
    hub.clients.set(clientId, socket);
    request.log.info(
      { clientId, clients: hub.clientCount, origin: request.headers.origin ?? null },
      'ws client connected',
    );
    // Immediate heartbeat so clients show LIVE within ~100 ms.
    socket.send(JSON.stringify(heartbeatMessage(hub)));

    socket.on('message', (data: Buffer | ArrayBuffer | Buffer[]) => {
      const bytes = Array.isArray(data)
        ? data.reduce((sum, part) => sum + part.length, 0)
        : data instanceof ArrayBuffer
          ? data.byteLength
          : data.length;
      request.log.debug({ clientId, bytes }, 'ws inbound message ignored');
    });

    socket.on('close', (code: number) => {
      hub.clients.delete(clientId);
      request.log.info({ clientId, clients: hub.clientCount, code }, 'ws client disconnected');
    });

    socket.on('error', (error: Error) => {
      appendErrorLog({
        level: 'warn',
        source: 'mock-core.heartbeat.socket',
        ...toErrorFields(error),
        context: { clientId, reqId: request.id },
      });
    });
  });
}
