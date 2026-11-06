/**
 * Network and time module (plan row W37; spec §7.12, §8.4 (Q15); contract
 * `packages/shared/src/api/network-time.ts`).
 *
 *   #   operationId        method and path              access (registry)   audit
 *   56  getNetworkStatus   GET /api/v1/network/status   AUTHENTICATED       none (a read)
 *   57  getTimeStatus      GET /api/v1/time/status      AUTHENTICATED       none (a read)
 *
 * The area has no command. Its values are simulated hardware signals of the engine: the LAN of
 * the Core device, the link of the tablet (set by the server from real connections), and the
 * time service of the Core device. A fault of one of them is a demo control (spec §12).
 *
 * Method, path and schemas are the registry's: each route is built from its registry entry
 * (`routeOfOperation`) and names it in `config.operationId`. WHO MAY CALL is not checked here:
 * the access rule of the registry is applied by stage 6 (`plugins/permission-guard`).
 *
 * BOTH READS answer from the engine's COMMITTED state (`app.engine.state()`: no pipeline, no
 * transaction, by reference; nothing here changes it), each slice in its wire form and under its
 * slice name (API-6): operation 56 `{ network, tabletLink }`, operation 57 `{ time }`.
 *
 * TIME (Q15, ENG-13). Every instant in an answer (`tabletLink.changedAt`, the points of
 * `network.bandwidth.history`, `time.lastSyncAt`, the points of `time.history`) was stamped by
 * the engine, which runs on the server clock (`app.clock`). This folder reads no clock, no
 * system time and nothing of the host: no interface, no address, no name lookup, no socket. The
 * `network` slice describes the simulated LAN of the Core device and says nothing about the
 * server's own listener; the `time` slice is the device's time service, not the server clock.
 *
 * CONTRACT with the scaffold (P25: `app.ts` is frozen): `networkTimeModule` keeps its name.
 */
import {
  NetworkStatusSchema,
  TimeStatusSchema,
  findCoreApiOperation,
  type CoreApiRegistryOperation,
  type NetworkStatus,
  type TimeStatus,
} from '@dems/shared/api';
import type { FastifyPluginAsync } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { routeOfOperation } from '../../plugins/permission-guard';

/** The operations this module answers, in registry order (56, 57). */
export const NETWORK_TIME_MODULE_OPERATIONS = ['getNetworkStatus', 'getTimeStatus'] as const;
export type NetworkTimeModuleOperation = (typeof NETWORK_TIME_MODULE_OPERATIONS)[number];

function registryEntry(operationId: NetworkTimeModuleOperation): CoreApiRegistryOperation {
  const operation = findCoreApiOperation(operationId);
  if (operation === undefined) throw new Error(`the contract registry has no operation ${operationId}`);
  return operation;
}

export const networkTimeModule: FastifyPluginAsync = async (app) => {
  const routes = app.withTypeProvider<ZodTypeProvider>();

  // 56 getNetworkStatus
  routes.route({
    ...routeOfOperation(registryEntry('getNetworkStatus')),
    schema: { response: { 200: NetworkStatusSchema } },
    handler: async (): Promise<NetworkStatus> => {
      const { network, tabletLink } = app.engine.state();
      return { network, tabletLink };
    },
  });

  // 57 getTimeStatus
  routes.route({
    ...routeOfOperation(registryEntry('getTimeStatus')),
    schema: { response: { 200: TimeStatusSchema } },
    handler: async (): Promise<TimeStatus> => ({ time: app.engine.slice('time') }),
  });
};
