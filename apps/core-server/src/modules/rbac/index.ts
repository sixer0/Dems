/**
 * RBAC module (plan row W28; spec §4.3, §4.4, §4.6 RB-9, §7.6): operation 10 of the shared
 * registry, and the boot step of the stored matrix.
 *
 *   #   operationId     method and path            access (registry)   audit
 *   10  getRoleMatrix   GET /api/v1/rbac/matrix    AUTHENTICATED       none (a read)
 *
 * OPERATION 10 answers the three roles, the twelve permissions and which role holds which, as
 * they are stored in PostgreSQL at the moment of the call (one statement, on the pool: a read
 * needs no unit of work), in the contract's shape, with `editable: false` (RB-9). Method, path
 * and response schema are the registry's. WHO MAY CALL is not checked here: the access rule of
 * the registry is applied by stage 6 (`plugins/permission-guard`).
 *
 * THE BOOT STEP `rbac.matrix` runs after the database checks and the engine's rehydration (the
 * order of the units in `app.ts`). First it holds every route of the router against the
 * registry (`checkRouter`: also a route that was added before the plugins ran). Then it reads
 * the stored matrix and stops the boot when the access rule of a registered route names a
 * permission that is not stored, when the stored roles or permissions are not exactly the
 * shared vocabulary, or when the stored grants are not exactly the shared role table (decision
 * D88: the hosted simulator's own checks read that table, so the two must agree). The
 * per-request decision does not use what the step loaded: it reads the caller's permissions
 * with every request.
 *
 * Its place after the engine's step is of no consequence for a request: the entry point opens
 * the listener only after the last boot step has passed, so no request can arrive between the
 * two steps, and a step that fails stops the process before it listens.
 *
 * The plugin function opens no database connection: `buildApp()` works without PostgreSQL.
 *
 * CONTRACT with the scaffold (P25: `app.ts` is frozen): `rbacModule` keeps its name.
 */
import { ADMINISTRATION_OPERATIONS, RoleMatrixSchema, type RoleMatrix } from '@dems/shared/api';
import type { FastifyPluginAsync } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { permissionGuard, readStoredMatrix, roleMatrixOf, routeOfOperation } from '../../plugins/permission-guard';

/** The operations this module answers, in registry order. */
export const RBAC_OPERATIONS = ['getRoleMatrix'] as const;
export type RbacOperation = (typeof RBAC_OPERATIONS)[number];

/** ID of the boot step this module adds. It appears in the log line of a boot that stops at it. */
export const RBAC_BOOT_STEP = 'rbac.matrix';

export const rbacModule: FastifyPluginAsync = async (app) => {
  const operation = ADMINISTRATION_OPERATIONS.find((candidate) => candidate.operationId === RBAC_OPERATIONS[0]);
  if (operation === undefined) throw new Error(`the contract registry has no operation ${RBAC_OPERATIONS[0]}`);

  app.readiness.addBootStep({
    id: RBAC_BOOT_STEP,
    async run() {
      // A failure is logged and persisted by the guard, with the routes and operations it is
      // about; a pass is the readiness plugin's line "boot step passed".
      const guard = permissionGuard(app);
      guard.checkRouter();
      await guard.reloadMatrix();
    },
  });

  // 10 getRoleMatrix
  app.withTypeProvider<ZodTypeProvider>().route({
    ...routeOfOperation(operation),
    schema: { response: { 200: RoleMatrixSchema } },
    handler: async (request): Promise<RoleMatrix> => {
      // Through the pool plugin's helper (review finding CPB1-8): it hands over the current pool
      // (a reset replaces the pool). A failure is the database's, not the caller's: logged by its
      // code (a driver's message can quote a statement), persisted, told to readiness, answered 503.
      const stored = await app.db.read('rbac.getRoleMatrix', (pool) => readStoredMatrix(pool), request);
      return roleMatrixOf(stored);
    },
  });
};
