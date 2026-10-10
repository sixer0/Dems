/**
 * Sealing module (task 3 blueprint row 82b, M7; contract C3 §2.2 operation 83, §4; controller
 * ruling D147 (E)): the route of operation 83 and the MOUNT of the sealing composition.
 *
 *   83  getSealingProgress   GET /api/v1/session/{id}/sealing   any signed-in operator   none (a read)
 *
 * WHO MAY CALL is not checked here: the access rule of the registry (a signed-in operator, every
 * role) is applied by stage 6 (`plugins/permission-guard`) before the handler runs. An `{id}`
 * that is no session ID is the 422 of the route's schema.
 *
 * WHAT IT ANSWERS, in both capture modes, from the engine's COMMITTED state and nothing else:
 *
 *   - `{id}` is not the open session: 404 `NOT_FOUND`;
 *   - the open session's finalization has not started: 409 `INVALID_STATE` (C3 §4);
 *   - otherwise the progress of `src/sealing-host` (`sealingProgressOf`): in real capture the step
 *     states the sealing pipeline reported from its checkpoints, with the per-step percent in
 *     `progressPct` and the RUNNING step's remaining time as `etaMs` (D121); in Simulated mode the
 *     simulator's timed seal with the figure the simulator itself answers.
 *
 * THE MOUNT. Routes are registered by modules only, and `app.ts` registers this module (waived by
 * ruling D147): its plugin function calls `mountSealingHost(app)` once. In capture mode
 * `simulated` that call builds nothing - the simulator's seal stays the seal. The module itself
 * changes nothing, writes no row and no file, and opens no database connection: `buildApp()` works
 * without PostgreSQL.
 */
import { SealingProgressSchema, findCoreApiOperation, type SealingProgressBody } from '@dems/shared/api';
import type { FastifyPluginAsync } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { ApiFailure } from '../../plugins/error-envelope';
import { routeOfOperation } from '../../plugins/permission-guard';
import { mountSealingHost, sealingProgressOf } from '../../sealing-host';

/** The operations this module answers. */
export const SEALING_MODULE_OPERATIONS = ['getSealingProgress'] as const;

const NOT_OPEN_TEXT = 'This session is not the open session.';

export const sealingModule: FastifyPluginAsync = async (app) => {
  const routes = app.withTypeProvider<ZodTypeProvider>();
  const operation = findCoreApiOperation('getSealingProgress');
  if (operation === undefined) throw new Error('the contract registry has no operation getSealingProgress');
  const pattern = operation.pathParam?.pattern;
  if (pattern === undefined) throw new Error('the registry gives getSealingProgress no path parameter');

  // The composition of the pipeline: real capture modes only (inert in mode `simulated`).
  mountSealingHost(app);

  // 83 getSealingProgress
  routes.route({
    ...routeOfOperation(operation),
    schema: { params: z.object({ id: z.string().regex(pattern) }), response: { 200: SealingProgressSchema } },
    handler: async (request): Promise<SealingProgressBody> => {
      const session = app.engine.state().session;
      // 404 in the form a hosted action's own "not found" has, so a client reads one form in both modes.
      if (session === null || session.id !== request.params.id) throw new ApiFailure(404, 'NOT_FOUND', NOT_OPEN_TEXT, { details: { simCode: 'NOT_FOUND' } });
      if (session.finalization.startedAt === null) {
        throw new ApiFailure(409, 'INVALID_STATE', `Sealing has not started for session ${session.id}.`, { details: { simCode: 'ILLEGAL_STATE', from: session.state, event: 'getSealingProgress' } });
      }
      return sealingProgressOf(session, app.clock.now());
    },
  });
};
