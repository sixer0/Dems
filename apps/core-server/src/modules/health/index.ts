/**
 * Health module (plan row W08; spec §7.4, operation 1 `getServiceHealth`; AC-B-08).
 *
 * `GET /api/v1/health` is liveness plus readiness: it answers 200 for as long as the process
 * answers, and `ready` says what is usable. A stopped or unreachable database shows as
 * `ready.database: false`; the status stays 200. It is the one operation that stage 2 lets
 * through while the server is not ready, and it holds no Core data (access `PUBLIC`).
 *
 * Each call asks the pool whether the database answers (`app.db.probe()`, reused for one
 * second), so `ready.database` follows the pool.
 *
 * The answer is validated and serialised through the shared `HealthResponseSchema`, the one
 * schema that mock-core, the packaged launcher and both clients use as well.
 *
 * The route is built with `routeOfOperation` from its registry entry, as every route of the
 * server is (standing rule M2; review finding CPB1-17): method and path are the registry's
 * (`GET` on `HEALTH_PATH`), and `config.operationId` names the operation.
 */
import {
  API_VERSION,
  HEARTBEAT_INTERVAL_MS,
  HealthResponseSchema,
  WS_PATH,
  findCoreApiOperation,
  type HealthResponse,
} from '@dems/shared/api';
import type { FastifyInstance, FastifyPluginAsync } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { SERVICE_NAME } from '../../config';
import { routeOfOperation } from '../../plugins/permission-guard';
import { READINESS_EXEMPT_OPERATION } from '../../plugins/readiness';
import { CORE_SERVER_VERSION } from '../../version';

/**
 * What this server answers: the shared `HealthResponse` under the server's own name, and with
 * `ready`, which the shared type leaves optional because mock-core does not send it. A type
 * only: the handler cannot forget `ready`.
 */
export type CoreServerHealth = HealthResponse & {
  readonly service: typeof SERVICE_NAME;
  readonly ready: NonNullable<HealthResponse['ready']>;
};

/** `operationId` of this module's one route in the shared registry. */
export const HEALTH_OPERATION_ID = READINESS_EXEMPT_OPERATION;

/**
 * Sockets connected to the realtime channel. `@fastify/websocket` decorates `websocketServer`
 * when the realtime channel registers it; before that there is no socket server and the count
 * is 0.
 */
function connectedSockets(app: FastifyInstance): number {
  const candidate: unknown = 'websocketServer' in app ? app.websocketServer : undefined;
  if (typeof candidate !== 'object' || candidate === null || !('clients' in candidate)) return 0;
  return candidate.clients instanceof Set ? candidate.clients.size : 0;
}

export const healthModule: FastifyPluginAsync = async (app) => {
  const startedAt = performance.now();
  const operation = findCoreApiOperation(HEALTH_OPERATION_ID);
  if (operation === undefined) throw new Error(`the contract registry has no operation ${HEALTH_OPERATION_ID}`);

  // 1 getServiceHealth
  app.withTypeProvider<ZodTypeProvider>().route({
    ...routeOfOperation(operation),
    schema: { response: { 200: HealthResponseSchema } },
    handler: async (): Promise<CoreServerHealth> => {
      await app.db.probe();
      return {
        status: 'ok',
        service: SERVICE_NAME,
        version: CORE_SERVER_VERSION,
        apiVersion: API_VERSION,
        serverTime: new Date(app.clock.now()).toISOString(),
        uptimeMs: Math.round(performance.now() - startedAt),
        ws: {
          path: WS_PATH,
          heartbeatIntervalMs: HEARTBEAT_INTERVAL_MS,
          clients: connectedSockets(app),
        },
        ready: app.readiness.snapshot(),
      };
    },
  });
};
