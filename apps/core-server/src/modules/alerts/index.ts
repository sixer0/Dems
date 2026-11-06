/**
 * Alerts module (plan row W40; spec §7.15, §7.17 member 29, §13.2; contract
 * `packages/shared/src/api/alerts.ts`).
 *
 *   #   operationId        method and path                        access (registry)   audit on success
 *   69  listAlerts         GET  /api/v1/alerts                    AUTHENTICATED       none (a read)
 *   70  acknowledgeAlert   POST /api/v1/alerts/{id}/acknowledge   AUTHENTICATED       none (parity); one log line
 *
 * Method, path and schemas are the registry's: each route is built from its registry entry
 * (`routeOfOperation`) and names it in `config.operationId`.
 *
 * WHO MAY CALL is not checked here. The access rule of the registry is applied by stage 6
 * (`plugins/permission-guard`): every signed-in role may call both (the bell is on every page).
 * The simulator checks nothing for `acknowledgeAlert`, so that rule is the only check there is.
 *
 * THE READ (69) answers the `alerts` slice of the engine's COMMITTED state in its wire form,
 * under its slice name (API-6): the newest 100 alerts, active and resolved, oldest first. No
 * pipeline, no transaction, by reference; nothing here changes it. An alert is raised by a
 * fault, and the unit that raises it writes its audit row (`FAULT_RAISED`); neither is done
 * here.
 *
 * THE COMMAND (70) is the hosted action `acknowledgeAlert` in one unit of work of the engine
 * host (`app.engine.run`, with ONE hosted action inside): the unit reads the alert before and
 * after the action and returns whether this call acknowledged it. Read outside the unit, another
 * console's acknowledgement could be counted as this caller's. The answer is 204, also for an
 * alert the Core does not have and for one that is acknowledged already: nothing changes then,
 * as in the simulator. The epoch and the revision of the outcome (API-7) are set by the engine's
 * unit when the answer is sent (`src/engine/api-headers.ts`).
 *
 * REFUSALS are not built here. An `{id}` outside the registry's pattern is the 422
 * `INVALID_INPUT` of stage 7. An engine that is not running is 503 `NOT_READY`.
 *
 * THE LOG LINE of operation 70 (SR-82, AC-B-89; `acknowledge.ts`). A call that acknowledged an
 * alert writes ONE line at level info with the operator's ID and the alert's ID, once the unit
 * has committed, and no audit row.
 *
 * ERRORS. The module catches nothing: an unexpected failure reaches the error envelope, which
 * writes it to the log and to the persistent error log; a hosted action that fails is logged
 * and persisted by the engine host.
 *
 * The plugin function opens no database connection: `buildApp()` works without PostgreSQL.
 *
 * CONTRACT with the scaffold (P25: `app.ts` is frozen): `alertsModule` keeps its name.
 */
import { AlertListSchema, CORE_API_OPERATIONS, type AlertList, type CoreApiRegistryOperation } from '@dems/shared/api';
import type { FastifyPluginAsync } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { routeOfOperation } from '../../plugins/permission-guard';
import { ACKNOWLEDGE_UNIT_LABEL, ALERT_ACKNOWLEDGED_MESSAGE, acknowledgementLine, becameAcknowledged } from './acknowledge';

export { ACKNOWLEDGE_UNIT_LABEL, ALERT_ACKNOWLEDGED_MESSAGE, acknowledgementLine, becameAcknowledged, type AcknowledgementLine } from './acknowledge';

/** The operations this module answers, in registry order (69, 70). */
export const ALERTS_MODULE_OPERATIONS = ['listAlerts', 'acknowledgeAlert'] as const;
export type AlertsModuleOperation = (typeof ALERTS_MODULE_OPERATIONS)[number];

/** The hosted simulator action behind operation 70 (spec §7.17 member 29). */
export const ACKNOWLEDGE_ACTION = 'acknowledgeAlert';

/** The registry entry of one of this module's operations. Throws at load for a name the registry does not hold. */
export function registryEntry(operationId: AlertsModuleOperation): CoreApiRegistryOperation {
  const operation = CORE_API_OPERATIONS.find((candidate) => candidate.operationId === operationId);
  if (operation === undefined) throw new Error(`the contract registry has no operation ${operationId}`);
  return operation;
}

/**
 * The `{id}` of the path (API-3: the one path parameter is named `id`), held to the pattern the
 * registry entry gives for it. A value outside it is the schema stage's 422.
 */
function alertParamsOf(operation: CoreApiRegistryOperation) {
  if (operation.pathParam === undefined) throw new Error(`the registry entry of ${operation.operationId} has no path parameter`);
  return z.object({ id: z.string().regex(operation.pathParam.pattern) });
}

export const alertsModule: FastifyPluginAsync = async (app) => {
  const routes = app.withTypeProvider<ZodTypeProvider>();

  // 69 listAlerts
  routes.route({
    ...routeOfOperation(registryEntry('listAlerts')),
    schema: { response: { 200: AlertListSchema } },
    handler: async (): Promise<AlertList> => ({ alerts: app.engine.slice('alerts') }),
  });

  // 70 acknowledgeAlert
  routes.route({
    ...routeOfOperation(registryEntry('acknowledgeAlert')),
    schema: { params: alertParamsOf(registryEntry('acknowledgeAlert')) },
    handler: async (request, reply) => {
      const caller = request.principal;
      const alertId = request.params.id;
      const { value: acknowledged } = await app.engine.run(ACKNOWLEDGE_UNIT_LABEL, async (scope) => {
        const before = scope.pending().alerts;
        await scope.command(caller, ACKNOWLEDGE_ACTION, alertId);
        return becameAcknowledged(before, scope.pending().alerts, alertId);
      });
      // The unit has committed: the acknowledgement is stored. The line of SR-82.
      if (acknowledged) request.log.info(acknowledgementLine(caller, alertId), ALERT_ACKNOWLEDGED_MESSAGE);
      return reply.code(204).send();
    },
  });
};
