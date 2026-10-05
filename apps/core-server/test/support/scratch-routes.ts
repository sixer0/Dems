/**
 * Test support (not a test file): scratch routes behind the real stage 6 (plan row W28).
 *
 * FOR A TEST OF ANOTHER STAGE OR MODULE THAT ADDS SCRATCH ROUTES TO THE REAL APP. A scratch
 * route is no operation of the contract registry, so stage 6 refuses it (deny by default).
 * `passScratchRoutes(app)`, called after `app.ready()`, lets only the routes that are no registry
 * operation pass; every registry route (sign-in, the session operations, …) keeps the REAL guard.
 *
 * A FILE OF ITS OWN (fix round B1, review finding CPB1-12). The function was part of the guard's
 * test support, which imports the identity row's support (a signed-in operator), while the
 * identity row's support imported this one function from the guard's: a cycle between the test
 * support of two rows. Here it depends on the guard plugin alone, and both import it.
 */
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { isAccessRule, permissionGuard } from '../../src/plugins/permission-guard';

/**
 * Lets every route that is no registry operation pass stage 6 and leaves the real guard on
 * every route that is one. Call after `app.ready()`.
 */
export function passScratchRoutes(app: FastifyInstance): void {
  const guard = app.stages.get('accessRule');
  const { rules } = permissionGuard(app);
  app.stages.replace('accessRule', (request: FastifyRequest, reply: FastifyReply) => {
    const resolved = rules.resolve({
      method: request.method,
      url: request.routeOptions.url ?? '',
      operationId: request.routeOptions.config.operationId,
    });
    if (!isAccessRule(resolved)) return undefined;
    return guard(request, reply);
  });
}
