/**
 * mock-core application factory (masterplan/01_specs.md §3.1). Performs no listen.
 *
 * Registration order: @fastify/cors → @fastify/websocket → heartbeat plugin → routes.
 */
import cors from '@fastify/cors';
import websocket from '@fastify/websocket';
import Fastify, { type FastifyInstance } from 'fastify';
import {
  API_VERSION,
  HEALTH_PATH,
  HEARTBEAT_INTERVAL_MS,
  SERVICE_NAME,
  WEB_DEV_ORIGINS,
  WS_PATH,
  type HealthResponse,
} from '@dems/shared/api';
import pkg from '../package.json' with { type: 'json' };
import { appendErrorLog, toErrorFields } from './error-log';
import { createHeartbeatHub, registerHeartbeat } from './heartbeat';

export const SERVICE_VERSION: string = pkg.version;

/** How long `preClose` waits for clients to finish the 1001 close handshake before terminating them. */
export const WS_CLOSE_GRACE_MS = 1000;

export interface BuildAppOptions {
  /** `false` silences the logger (tests). Default: JSON logger at `LOG_LEVEL` or `info`. */
  logger?: boolean;
}

export function buildApp(opts: BuildAppOptions = {}): FastifyInstance {
  const app = Fastify({
    logger: opts.logger === false ? false : { level: process.env.LOG_LEVEL ?? 'info' },
  });
  const hub = createHeartbeatHub();

  app.register(cors, {
    origin: [...WEB_DEV_ORIGINS],
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type'],
    credentials: false,
    maxAge: 600,
  });

  app.register(websocket, {
    options: { maxPayload: 65536 },
    // Custom preClose (V22): close every client with 1001, give it a short grace period to
    // finish the close handshake, terminate stragglers, then close the WS server.
    preClose: async () => {
      const server = app.websocketServer;
      for (const client of server.clients) client.close(1001, 'server shutting down');
      const deadline = Date.now() + WS_CLOSE_GRACE_MS;
      while ([...server.clients].some((c) => c.readyState !== c.CLOSED) && Date.now() < deadline) {
        await new Promise((resolve) => setTimeout(resolve, 25));
      }
      for (const client of server.clients) {
        if (client.readyState !== client.CLOSED) client.terminate();
      }
      await new Promise<void>((resolve) => server.close(() => resolve()));
    },
    errorHandler: (error, socket, request) => {
      request.log.error({ err: error }, 'ws handler error');
      appendErrorLog({
        level: 'error',
        source: 'mock-core.websocket',
        ...toErrorFields(error),
        context: { reqId: request.id, url: request.url },
      });
      socket.terminate();
    },
  });

  app.register(async (instance) => {
    registerHeartbeat(instance, hub);

    instance.get(HEALTH_PATH, async (): Promise<HealthResponse> => ({
      status: 'ok',
      service: SERVICE_NAME,
      version: SERVICE_VERSION,
      apiVersion: API_VERSION,
      serverTime: new Date().toISOString(),
      uptimeMs: hub.uptimeMs(),
      ws: {
        path: WS_PATH,
        heartbeatIntervalMs: HEARTBEAT_INTERVAL_MS,
        clients: hub.clientCount,
      },
    }));
  });

  // Persist every request error (Fastify still sends its default JSON error reply).
  app.addHook('onError', async (request, _reply, error) => {
    appendErrorLog({
      level: 'error',
      source: 'mock-core.http',
      ...toErrorFields(error),
      context: { reqId: request.id, method: request.method, url: request.url },
    });
  });

  return app;
}
