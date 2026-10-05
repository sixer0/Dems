/**
 * System and maintenance module (plan row W40; spec §7.14, §7.17 members 32, 35, 36, 38, 39,
 * §13.2; contract `packages/shared/src/api/system.ts`).
 *
 *   #   operationId           method and path                        access (registry)   audit on success
 *   64  getSystemStatus       GET  /api/v1/system/status             AUTHENTICATED       none (a read)
 *   65  runDiagnostics        POST /api/v1/system/diagnostics        DIAGNOSTICS_RUN     DIAGNOSTICS_RUN; none while a run is in progress
 *   66  restartServices       POST /api/v1/system/services/restart   MAINTENANCE         DEVICE_COMMAND (details.scope CORE_SERVICES)
 *   67  startSoftwareUpdate   POST /api/v1/system/update             MAINTENANCE         UPDATE_STARTED; none when nothing started
 *   68  updateSettings        POST /api/v1/settings                  AUTHENTICATED       none (parity); one log line
 *
 * Method, path and schemas are the registry's: each route is built from its registry entry
 * (`routeOfOperation`) and names it in `config.operationId`.
 *
 * WHO MAY CALL is not checked here. The access rule of the registry is applied by stage 6
 * (`plugins/permission-guard`), before the body is read, and stage 6 writes the one
 * `ACCESS_DENIED` row of a refused call. For `updateSettings` the simulator checks nothing, so
 * that rule is the only check there is.
 *
 * THE READ (64) answers from the engine's COMMITTED state (`app.engine.state()`: no pipeline, no
 * transaction, by reference; nothing here changes it), taken once, so the five slices of an
 * answer belong to one committed state (`status.ts`).
 *
 * THE COMMANDS (65 to 68) are hosted actions of the shared simulator, each in ONE unit of work
 * of the engine host, under the caller's identity. The answer leaves after the commit; the
 * engine's unit gives it the epoch and the revision of the outcome (API-7;
 * `src/engine/api-headers.ts`). What a command does over time is the
 * simulator's, on the engine's ticks: the eight checks of a diagnostics run and the six steps of
 * an update resolve in the `diagnostics` and `update` slices; a restart of the services is
 * complete with its row.
 *
 *   65, 66, 67   `app.engine.command(request.principal, action)`. The value of the action is
 *                the answer: the run ID (202), the number of services restarted (200), nothing
 *                (202 without a body).
 *   68           `app.engine.run`, with ONE hosted action inside: the unit reads the `settings`
 *                slice before and after the action and returns the NAMES of the settings that
 *                changed. Read outside the unit, another console's change could be counted as
 *                this caller's. The answer is the committed slice.
 *
 * REFUSALS are not built here. A refusal of the simulator arrives as the `ApiFailure` of the
 * engine host with `details.simCode` and propagates: 409 `SESSION_ACTIVE` for a restart of the
 * services or an update while a session is open. A body that breaks the schema is the 422
 * `INVALID_INPUT` of stage 7. An engine that is not running is 503 `NOT_READY`.
 *
 * THE LOG LINE of operation 68 (SR-82, AC-B-89; `settings.ts`). A call that changed a setting
 * writes ONE line at level info with the operator's ID and the names of the changed settings,
 * and no audit row. It is written once the unit has committed, before the committed slice is
 * read: an engine that is stopped in that instant answers 503 although the change is stored,
 * and the line is in the log.
 *
 * ERRORS. The module catches nothing: an unexpected failure reaches the error envelope, which
 * writes it to the log and to the persistent error log; a hosted action that fails is logged
 * and persisted by the engine host.
 *
 * The plugin function opens no database connection: `buildApp()` works without PostgreSQL.
 *
 * CONTRACT with the scaffold (P25: `app.ts` is frozen): `systemModule` keeps its name.
 */
import {
  DiagnosticsRunStartedSchema,
  ServicesRestartedSchema,
  SettingsSliceSchema,
  SettingsUpdateRequestSchema,
  SystemStatusSchema,
  type DiagnosticsRunStarted,
  type ServicesRestarted,
  type SettingsSliceBody,
  type SystemStatus,
} from '@dems/shared/api';
import type { FastifyPluginAsync } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { routeOfOperation } from '../../plugins/permission-guard';
import { SYSTEM_ACTION_OF_OPERATION, registryEntry } from './operations';
import { SETTINGS_CHANGED_MESSAGE, SETTINGS_UNIT_LABEL, changedSettingsKeys, settingsChangeLine, settingsPatchOf } from './settings';
import { systemStatusOf } from './status';

export { SYSTEM_ACTION_OF_OPERATION, SYSTEM_MODULE_OPERATIONS, registryEntry, type SystemModuleOperation } from './operations';
export {
  SETTINGS_CHANGED_MESSAGE,
  SETTINGS_UNIT_LABEL,
  changedSettingsKeys,
  settingsChangeLine,
  settingsPatchOf,
  type SettingsChangeLine,
} from './settings';
export { systemStatusOf, type SystemStatusSource } from './status';

export const systemModule: FastifyPluginAsync = async (app) => {
  const routes = app.withTypeProvider<ZodTypeProvider>();

  // 64 getSystemStatus
  routes.route({
    ...routeOfOperation(registryEntry('getSystemStatus')),
    schema: { response: { 200: SystemStatusSchema } },
    handler: async (): Promise<SystemStatus> => systemStatusOf(app.engine.state()),
  });

  // 65 runDiagnostics
  routes.route({
    ...routeOfOperation(registryEntry('runDiagnostics')),
    schema: { response: { 202: DiagnosticsRunStartedSchema } },
    handler: async (request, reply): Promise<DiagnosticsRunStarted> => {
      const { value: runId } = await app.engine.command(request.principal, SYSTEM_ACTION_OF_OPERATION.runDiagnostics);
      void reply.code(202);
      return { runId };
    },
  });

  // 66 restartServices
  routes.route({
    ...routeOfOperation(registryEntry('restartServices')),
    schema: { response: { 200: ServicesRestartedSchema } },
    handler: async (request): Promise<ServicesRestarted> => {
      const { value: restarted } = await app.engine.command(request.principal, SYSTEM_ACTION_OF_OPERATION.restartServices);
      return { restarted };
    },
  });

  // 67 startSoftwareUpdate
  routes.route({
    ...routeOfOperation(registryEntry('startSoftwareUpdate')),
    handler: async (request, reply) => {
      await app.engine.command(request.principal, SYSTEM_ACTION_OF_OPERATION.startSoftwareUpdate);
      return reply.code(202).send();
    },
  });

  // 68 updateSettings
  routes.route({
    ...routeOfOperation(registryEntry('updateSettings')),
    schema: { body: SettingsUpdateRequestSchema, response: { 200: SettingsSliceSchema } },
    handler: async (request): Promise<SettingsSliceBody> => {
      const caller = request.principal;
      const patch = settingsPatchOf(request.body);
      const { value: changedKeys } = await app.engine.run(SETTINGS_UNIT_LABEL, async (scope) => {
        const before = scope.pending().settings;
        await scope.command(caller, SYSTEM_ACTION_OF_OPERATION.updateSettings, patch);
        return changedSettingsKeys(before, scope.pending().settings);
      });
      // The unit has committed: the change is stored. The line of SR-82 is written first, so a
      // read that fails below (an engine that stops in this instant) cannot lose it.
      if (changedKeys.length > 0) request.log.info(settingsChangeLine(caller, changedKeys), SETTINGS_CHANGED_MESSAGE);
      return app.engine.slice('settings');
    },
  });
};
