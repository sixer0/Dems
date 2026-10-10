/**
 * Demo-control module (plan row W43; spec §7.16, §7.17 members 26, 27, 30, 31, §12; contract
 * `packages/shared/src/api/demo-controls.ts`): operations 71 to 75 of the shared registry.
 *
 *   #   operationId     method and path                  access (registry)              audit on success
 *   71  getDemoStatus   GET  /api/v1/demo/status         DEMO_CONTROL and the demo flag none (a read)
 *   72  loadScenario    POST /api/v1/demo/scenario       DEMO_CONTROL and the demo flag SCENARIO_LOADED (the routine's)
 *   73  injectFault     POST /api/v1/demo/faults         DEMO_CONTROL and the demo flag FAULT_RAISED, or AUDIT_CHAIN_DISCONTINUITY; none when already active
 *   74  clearFault      POST /api/v1/demo/faults/clear   DEMO_CONTROL and the demo flag FAULT_CLEARED; none when nothing matches
 *   75  resetDemo       POST /api/v1/demo/reset          DEMO_CONTROL and the demo flag SCENARIO_LOADED with `reset: true` (the routine's)
 *
 * WHO MAY CALL is not checked here, and neither is the demo flag. Stage 6
 * (`plugins/permission-guard`) applies the access rule of the registry before the body is read:
 * a caller without `DEMO_CONTROL` gets 403 `NOT_PERMITTED` with one `ACCESS_DENIED` row whatever
 * the flag, and a holder gets 403 `DEMO_DISABLED` while the flag is off (DC-1, DC-2). So with
 * the flag off no handler of this file runs, and the reset routine, the only code of the server
 * that opens the owner connection file, is never reached (HC-2).
 *
 * THE READ (71) answers from the engine's committed state and from one row of `core_state`
 * (`status.ts`). It changes nothing.
 *
 * THE TWO FAULTS (73, 74) are hosted actions: ONE call of `app.engine.command` each, with the
 * caller's principal. The shared simulator's `inject` and `clearFault` do the work in one unit of
 * work and write their rows; they name no actor, by design (decision D28 D-3). The one record of
 * WHO raised or cleared a fault is the info line this file writes after the command committed:
 * the operator's ID and the fault's kind and target, all values the schema stage has checked.
 * `AUDIT_TAMPER` changes one row of the audit view the engine holds and never the stored table:
 * that is the engine host's write-through rule (SR-59), not something this file does.
 *
 * THE TWO RESETS (72, 75) are server-native: the reset routine of `src/db/reset`, with the server
 * side of it in `reset.ts` (what is stopped before and what is brought back after). The answer
 * is the epoch the routine wrote: previous + 1, once. A reset that fails after the engine was
 * stopped also moves the epoch by 1 (a resync, decision D101). The routine writes the `SCENARIO_LOADED`
 * row into the new chain and the lineage row of the discarded one, both with the operator of the
 * request as the actor; this module writes no audit row at all.
 *
 * WHICH DATABASE. The instance's own: `app.config.database.database`, which follows the listen
 * port. The routine's name guard accepts the four project databases and nothing else, so this
 * module cannot name another one.
 *
 * ERRORS. A refusal of the simulator, a unit that could not be committed and an engine that is
 * not running arrive as the `ApiFailure` of the engine host and are left to propagate. A failed
 * read is logged and persisted by `app.db.read` and answers 503. A reset that did not happen
 * answers 503 after `reset.ts` wrote its log line and its entry in the persistent error log.
 *
 * The plugin function opens no database connection: `buildApp()` works without PostgreSQL.
 *
 * CONTRACT with the scaffold (P25: `app.ts` is frozen): `demoModule` keeps its name.
 */
import {
  DemoEpochSchema,
  DemoFaultRequestSchema,
  DemoStatusSchema,
  ScenarioLoadRequestSchema,
  type DemoEpoch,
  type DemoStatus,
} from '@dems/shared/api';
import type { FastifyInstance, FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { resetDatabase, type ResetReport } from '../../db/reset';
import { routeOfOperation } from '../../plugins/permission-guard';
import { createResetHost } from './host';
import { RESET_DEMO_SCENARIO, operationOf } from './operations';
import { createDemoReset, type ResetHost, type ResetRoutine } from './reset';
import { READ_SEED_FACTS, demoStatusOf, seedFactsOf, type SeedFactsRow } from './status';

export { OPERATOR_ROLES_SOURCE, READ_OPERATOR_ROLES, createResetHost, runBootChecks } from './host';
export { DEMO_MODULE_OPERATIONS, RESET_DEMO_SCENARIO, RESET_REASON_OF_OPERATION, operationOf, type DemoModuleOperation, type ResetOperation } from './operations';
export {
  RECOVERY,
  RESET_ERROR_SOURCE,
  RESET_HOLD_NAME,
  RESUME_STEPS,
  RESYNC_STEP,
  ResetRefusal,
  ResumeFailure,
  createDemoReset,
  roleChanges,
  type DemoReset,
  type GrantRow,
  type OperatorRoleRow,
  type ResetCall,
  type ResetHost,
  type ResetRoutine,
  type ResumeStep,
} from './reset';
export { LOADABLE_SCENARIOS, READ_SEED_FACTS, demoStatusOf, seedFactsOf, type SeedFacts, type SeedFactsRow } from './status';

/** `source` of the read of operation 71 in a log line. */
export const DEMO_STATUS_SOURCE = 'demo.getDemoStatus';

const FAULT_INJECTED = 'demo fault injected';
const FAULT_CLEARED = 'demo fault cleared';

/**
 * What this module offers beside its routes: for a test. Reached with `demoControl(app)`.
 * Nothing of the server calls it (a static test of this folder says so).
 */
export interface DemoControl {
  /** True while a reset or a scenario load of this server runs. */
  readonly resetInFlight: boolean;
  /**
   * TESTS ONLY. Replaces parts of what a reset needs of the server, for this app. A database test
   * passes `routine`: the routine of `src/db/reset` with the seam that accepts a database of the
   * test's own run, which no entry point sets and no request can reach. Passing nothing puts the
   * server's own parts back.
   */
  replace(parts?: Partial<ResetHost>): void;
}

// Keyed by the app's stage registry: one object per app, the same from every scope of it.
const controls = new WeakMap<object, DemoControl>();

/** The module's controls of an app. Available after `ready()`. */
export function demoControl(app: FastifyInstance): DemoControl {
  const control = controls.get(app.stages);
  if (control === undefined) throw new Error('the demo-control module is not loaded: call it after app.ready()');
  return control;
}

/**
 * The operator of the request: the actor a reset hands to the routine, and the name in the log
 * line of a fault. Stage 6 lets only an operator who holds `DEMO_CONTROL` reach a handler of this
 * file; anything else here is a defect of the server and answers 500.
 */
function operatorIdOf(request: FastifyRequest): string {
  const { principal } = request;
  if (principal.kind !== 'OPERATOR') throw new Error('a demo operation ran without an operator: the access rule of its route was not applied');
  return principal.operatorId;
}

/** The paired device the caller's session is bound to; null for a web console session (decision D216 (2)). */
function deviceIdOf(request: FastifyRequest): string | null {
  const { principal } = request;
  return principal.kind === 'OPERATOR' ? principal.deviceId : null;
}

/**
 * The answer of a hosted command that committed: 204, no body. Its two headers of API-7 are the
 * engine unit's (`src/engine/api-headers.ts`): the position of the command's outcome.
 */
const commandDone = (reply: FastifyReply): FastifyReply => reply.code(204).send();

export const demoModule: FastifyPluginAsync = async (app) => {
  const routes = app.withTypeProvider<ZodTypeProvider>();

  // The routine as the server calls it: one argument, so no test seam of the routine is set and
  // its name guard accepts the four project databases only.
  const serverRoutine: ResetRoutine = (options) => resetDatabase(options);
  const serverHost = createResetHost(app, () => serverRoutine);
  let host: ResetHost = serverHost;
  // Every member is read from the current host at the moment it is used: what a test replaces
  // after `ready()` is what runs, and the one reset guard of this app outlives a replacement.
  const reset = createDemoReset(new Proxy(serverHost, { get: (_target, member) => Reflect.get(host, member) as unknown }));
  controls.set(app.stages, {
    get resetInFlight() {
      return reset.inFlight;
    },
    replace(parts = {}) {
      // Own properties only, and the getters of the server's host are kept as getters.
      host = Object.create(serverHost, Object.getOwnPropertyDescriptors(parts)) as ResetHost;
    },
  });

  /**
   * The answer of a reset. API-7: the engine was reloaded, so the position the engine's unit
   * writes when the answer is sent is the new epoch at the revision it has then.
   */
  const resetDone = (report: ResetReport): DemoEpoch => ({ epoch: report.epoch });

  // 71 getDemoStatus
  routes.route({
    ...routeOfOperation(operationOf('getDemoStatus')),
    schema: { response: { 200: DemoStatusSchema } },
    handler: async (request): Promise<DemoStatus> => {
      const facts = seedFactsOf(await app.db.read(DEMO_STATUS_SOURCE, async (pool) => (await pool.query<SeedFactsRow>(READ_SEED_FACTS)).rows, request));
      // After the read, in one turn: the state and the epoch belong together.
      return demoStatusOf(app.engine.state(), app.engine.epoch, facts);
    },
  });

  // 72 loadScenario
  routes.route({
    ...routeOfOperation(operationOf('loadScenario')),
    schema: { body: ScenarioLoadRequestSchema, response: { 200: DemoEpochSchema } },
    handler: async (request): Promise<DemoEpoch> =>
      resetDone(await reset.run({ operation: 'loadScenario', scenario: request.body.name, actorId: operatorIdOf(request), deviceId: deviceIdOf(request), requestId: request.id, log: request.log })),
  });

  // 73 injectFault
  routes.route({
    ...routeOfOperation(operationOf('injectFault')),
    schema: { body: DemoFaultRequestSchema },
    handler: async (request, reply) => {
      const { kind, target } = request.body;
      const outcome = await app.engine.command(request.principal, 'inject', kind, target);
      // Decision D28 D-3: the simulator's row names no actor; this line names the operator.
      request.log.info({ operationId: 'injectFault', operatorId: operatorIdOf(request), kind, target: target ?? null, epoch: outcome.epoch, revision: outcome.revision }, FAULT_INJECTED);
      return commandDone(reply);
    },
  });

  // 74 clearFault
  routes.route({
    ...routeOfOperation(operationOf('clearFault')),
    schema: { body: DemoFaultRequestSchema },
    handler: async (request, reply) => {
      const { kind, target } = request.body;
      const outcome = await app.engine.command(request.principal, 'clearFault', kind, target);
      request.log.info({ operationId: 'clearFault', operatorId: operatorIdOf(request), kind, target: target ?? null, epoch: outcome.epoch, revision: outcome.revision }, FAULT_CLEARED);
      return commandDone(reply);
    },
  });

  // 75 resetDemo
  routes.route({
    ...routeOfOperation(operationOf('resetDemo')),
    schema: { response: { 200: DemoEpochSchema } },
    handler: async (request): Promise<DemoEpoch> =>
      resetDone(await reset.run({ operation: 'resetDemo', scenario: RESET_DEMO_SCENARIO, actorId: operatorIdOf(request), deviceId: deviceIdOf(request), requestId: request.id, log: request.log })),
  });
};
