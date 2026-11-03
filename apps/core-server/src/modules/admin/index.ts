/**
 * User and role administration (plan row W33; spec §4.6 RB-8, §4.7, §7.6, §13.1; contract
 * `packages/shared/src/api/administration.ts`): operations 11 to 14 of the shared registry.
 *
 *   #   operationId      method and path                         access      audit on success
 *   11  listUsers        GET  /api/v1/admin/users                USER_ADMIN  none (a read)
 *   12  assignUserRole   POST /api/v1/admin/users/{id}/role      USER_ADMIN  ROLE_CHANGED; none when the role is unchanged
 *   13  enableUser       POST /api/v1/admin/users/{id}/enable    USER_ADMIN  USER_ENABLED; none when already enabled
 *   14  disableUser      POST /api/v1/admin/users/{id}/disable   USER_ADMIN  USER_DISABLED; none when already disabled
 *
 * Method, path and schemas are the registry's: each route is built from its registry entry
 * (`routeOfOperation`) and names it in `config.operationId`. Operation 10 of the same area
 * (`getRoleMatrix`) is the RBAC module's. RB-9 as amended by the principal (PT GSP, 02-11-2026)
 * adds three operations that do create, edit and delete a user; each of them checks, inside its
 * own unit and under the unit's lock, that the caller's username is the vendor `root` account
 * (`rule.ts`, `isVendorRoot`). None of them resets the password of an existing operator: that
 * stays the host command's alone (decision U19), and `createUser` only gives a NEW account one.
 *
 * WHO MAY CALL is not checked here. The access rule of the registry (`USER_ADMIN`) is applied by
 * stage 6 (`plugins/permission-guard`) before the body is read, and the guard writes the one
 * `ACCESS_DENIED` row of a refused call. A role change needs no call on the guard: the caller's
 * permissions are read from PostgreSQL with every request (RB-3), so the change applies to the
 * next request of the same session, both ways.
 *
 * HOW A WRITE RUNS (`changes.ts`). One unit of work: the lock, the last-administrator rule
 * (`rule.ts`), the compare-and-set transition, for a disable the operator's sessions ended and
 * the biometric tokens revoked, the audit row. After the COMMIT, in this order:
 *
 *   1. the publications of the unit (`unit.afterCommit`): `session.updated` (a role change),
 *      `session.ended` (a disable that ended sessions), `admin.changed` with `USERS` (all three);
 *   2. `await app.engine.mirrorOperators()`: the engine's `operators` slice follows the table
 *      (ENG-3) and clients get it as a `delta`. Only a role change alters that slice: it holds no
 *      `enabled` flag (spec §9.5);
 *   3. the answer. Its `x-dems-epoch` and `x-dems-revision` (API-7) are set by the engine's
 *      unit when it is sent (`src/engine/api-headers.ts`): the position of the mirror when one
 *      ran, the engine's as it is then otherwise. No handler of this file sets either.
 *
 * A mirror that fails does not change the answer: the unit is committed, the operator is as
 * answered, and every later command of the engine mirrors the table before it runs. The failure
 * is logged by its code and written to the error log.
 *
 * INPUT. The body and the path parameter are validated by the registry's schemas at stage 7
 * (422 `INVALID_INPUT`). A reason that has the form of a credential is refused the same way
 * before any unit runs: an audit row never holds one (SR-54).
 *
 * The plugin function opens no database connection: `buildApp()` works without PostgreSQL.
 *
 * CONTRACT with the scaffold (P25: `app.ts` is frozen): `adminModule` keeps its name.
 */
import {
  ADMINISTRATION_OPERATIONS,
  AdminUserListSchema,
  AdminUserSchema,
  CreateUserRequestSchema,
  DeletedUserSchema,
  DeleteUserRequestSchema,
  UpdateUserRequestSchema,
  UserRoleRequestSchema,
  UserStatusRequestSchema,
  type AdminUser,
  type AdminUserList,
  type CoreApiRegistryOperation,
  type DeletedUser,
} from '@dems/shared/api';
import type { FastifyInstance, FastifyPluginAsync, FastifyRequest } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { looksLikeSecret } from '../../core';
import { notSignedIn } from '../../plugins/authenticate';
import { ApiFailure, invalidInput } from '../../plugins/error-envelope';
import { describeError } from '../../plugins/logger';
import { routeOfOperation } from '../../plugins/permission-guard';
import { assignUserRole, createUser, deleteUser, disableUser, enableUser, updateUser, type Actor, type ChangeOutcome, type DeletedOutcome } from './changes';
import { listUsers } from './statements';

export { ADMINISTRATION_PERMISSION, ADMIN_UNIT_LABEL, lastAdministrator, unknownOperator, type Actor, type ChangeOutcome } from './changes';
export { administratorsOf, applyChange, leavesNoAdministrator, type OperatorChange } from './rule';

/** The operations this module answers, in registry order. */
export const ADMIN_OPERATIONS = ['listUsers', 'assignUserRole', 'enableUser', 'disableUser', 'createUser', 'updateUser', 'deleteUser'] as const;
export type AdminOperation = (typeof ADMIN_OPERATIONS)[number];

/** `source` of the read of operation 11 in a log line and in the persistent error log. */
const LIST_USERS_SOURCE = 'admin.listUsers';
const MIRROR_FAILED = 'the operators mirror of the engine could not be refreshed after a committed change';

/** The registry entry of an operation of this module. */
function operationOf(operationId: AdminOperation): CoreApiRegistryOperation {
  const operation: CoreApiRegistryOperation | undefined = ADMINISTRATION_OPERATIONS.find((candidate) => candidate.operationId === operationId);
  if (operation === undefined) throw new Error(`the contract registry has no operation ${operationId}`);
  return operation;
}

/** The schema of the one path parameter (API-3: it is named `id`), from the pattern the registry entry gives it. */
function operatorParams(operation: CoreApiRegistryOperation) {
  if (operation.pathParam === undefined) throw new Error(`the contract registry gives ${operation.operationId} no path parameter`);
  return z.object({ id: z.string().regex(operation.pathParam.pattern) });
}

/**
 * The actor of a row: the operator and the device of the caller's session. Stage 6 lets only an
 * operator reach these routes; the refusal here is the same backstop the engine host has, and
 * it reads no permission and no role.
 */
function actorOf(request: FastifyRequest): Actor {
  const { principal } = request;
  if (principal.kind !== 'OPERATOR') throw notSignedIn();
  return { operatorId: principal.operatorId, deviceId: principal.deviceId };
}

/**
 * The reason of a change as the audit row takes it: what the schema left (trimmed, at most 500
 * characters), or nothing when it is empty. A text that has the form of a credential is refused
 * as input, so that the row never holds one and the writer never has to refuse the unit.
 */
function reasonOf(reason: string | undefined): string | undefined {
  if (reason === undefined || reason === '') return undefined;
  if (looksLikeSecret(reason)) throw invalidInput('body');
  return reason;
}

export const adminModule: FastifyPluginAsync = async (app: FastifyInstance) => {
  const routes = app.withTypeProvider<ZodTypeProvider>();

  /**
   * After the unit that changed an operator has committed: the engine's `operators` slice
   * follows the table and is published. A failure here leaves the committed change as it is.
   */
  const mirrorOperators = async (request: FastifyRequest, source: string): Promise<void> => {
    try {
      await app.engine.mirrorOperators();
    } catch (error) {
      const description = describeError(error);
      const code = error instanceof ApiFailure ? error.code : (description.code ?? description.errorName);
      request.log.error({ code, source }, MIRROR_FAILED);
      app.errorLog.append({ level: 'error', source, message: MIRROR_FAILED, ...description, code, context: { requestId: request.id } });
    }
  };

  /** Mirrors when something changed, and answers the operator. */
  const answer = async (request: FastifyRequest, source: string, outcome: ChangeOutcome): Promise<AdminUser> => {
    if (outcome.changed) await mirrorOperators(request, source);
    return outcome.user;
  };

  // 11 listUsers
  const list = operationOf('listUsers');
  routes.route({
    ...routeOfOperation(list),
    schema: { response: { 200: AdminUserListSchema } },
    // A read needs no unit of work. Through the pool plugin's helper (review finding CPB1-8): it
    // hands over the current pool (a reset replaces the pool); a failure is the database's, not
    // the caller's, and is logged as `{ err }`, persisted, told to readiness and answered 503.
    handler: async (request): Promise<AdminUserList> => ({
      users: await app.db.read(LIST_USERS_SOURCE, (pool) => listUsers({ query: (text, values) => pool.query(text, values === undefined ? [] : [...values]) }), request),
    }),
  });

  // 12 assignUserRole
  const role = operationOf('assignUserRole');
  routes.route({
    ...routeOfOperation(role),
    schema: { params: operatorParams(role), body: UserRoleRequestSchema, response: { 200: AdminUserSchema } },
    handler: async (request): Promise<AdminUser> => {
      const outcome = await assignUserRole(app, actorOf(request), request.params.id, request.body.role, reasonOf(request.body.reason));
      return answer(request, 'admin.assignUserRole', outcome);
    },
  });

  // 13 enableUser
  const enable = operationOf('enableUser');
  routes.route({
    ...routeOfOperation(enable),
    schema: { params: operatorParams(enable), body: UserStatusRequestSchema, response: { 200: AdminUserSchema } },
    handler: async (request): Promise<AdminUser> => {
      const outcome = await enableUser(app, actorOf(request), request.params.id, reasonOf(request.body.reason));
      return answer(request, 'admin.enableUser', outcome);
    },
  });

  // 14 disableUser
  const disable = operationOf('disableUser');
  routes.route({
    ...routeOfOperation(disable),
    schema: { params: operatorParams(disable), body: UserStatusRequestSchema, response: { 200: AdminUserSchema } },
    handler: async (request): Promise<AdminUser> => {
      const outcome = await disableUser(app, actorOf(request), request.params.id, reasonOf(request.body.reason));
      return answer(request, 'admin.disableUser', outcome);
    },
  });

  // 15 createUser (RB-9 as amended 02-11-2026: USER_ADMIN plus the vendor `root` identity, which
  // the unit itself checks on the row it holds locked — see changes.ts).
  const create = operationOf('createUser');
  routes.route({
    ...routeOfOperation(create),
    schema: { body: CreateUserRequestSchema, response: { 200: AdminUserSchema } },
    handler: async (request): Promise<AdminUser> => {
      const outcome = await createUser(app, actorOf(request), request.body, reasonOf(request.body.reason));
      return answer(request, 'admin.createUser', outcome);
    },
  });

  // 16 updateUser: the profile only.
  const update = operationOf('updateUser');
  routes.route({
    ...routeOfOperation(update),
    schema: { params: operatorParams(update), body: UpdateUserRequestSchema, response: { 200: AdminUserSchema } },
    handler: async (request): Promise<AdminUser> => {
      const outcome = await updateUser(app, actorOf(request), request.params.id, request.body, reasonOf(request.body.reason));
      return answer(request, 'admin.updateUser', outcome);
    },
  });

  // 17 deleteUser: the account and its credential go; the audit chain keeps every row the operator wrote.
  const remove = operationOf('deleteUser');
  routes.route({
    ...routeOfOperation(remove),
    schema: { params: operatorParams(remove), body: DeleteUserRequestSchema, response: { 200: DeletedUserSchema } },
    handler: async (request): Promise<DeletedUser> => {
      const outcome: DeletedOutcome = await deleteUser(app, actorOf(request), request.params.id, request.body, reasonOf(request.body.reason));
      await mirrorOperators(request, 'admin.deleteUser');
      return outcome.deleted;
    },
  });
};
