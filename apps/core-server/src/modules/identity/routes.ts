/**
 * The routes of the identity core: operations 2 to 6 of the shared registry (plan row W24; spec
 * §7.5; contract `packages/shared/src/api/identity.ts`).
 *
 *   #  operationId       method and path             access (registry)                  audit
 *   2  signIn            POST /api/v1/auth/sign-in   PUBLIC + the console rule ID-1     AUTH_SUCCESS; AUTH_FAILED, AUTH_LOCKED
 *   3  getSignInStatus   GET  /api/v1/auth/status    PUBLIC                             none (a read)
 *   4  getAuthSession    GET  /api/v1/auth/session   AUTHENTICATED                      none (a read)
 *   5  signOut           POST /api/v1/auth/sign-out  AUTHENTICATED                      AUTH_SIGNED_OUT
 *   6  touchSession      POST /api/v1/auth/touch     AUTHENTICATED                      none (parity)
 *
 * Method, path and schemas are the registry's: each route is built with `routeOfOperation` from
 * its registry entry (standing rule M2), which names it in `config.operationId`; the readiness
 * stage, the throttle and the access rule read that. Operations 7 to 9 of the same area (the
 * biometric token) are plan row W41's.
 *
 * WHO MAY CALL is not decided here (standing rule M3; decision D83 DN-8). The access rule of the
 * registry is applied by stage 6 (`plugins/permission-guard`) before the body is read: a caller
 * without a console identity on `signIn`, a caller without an operator's session on operations 4
 * to 6, and a retired device on any of them (with its one `ACCESS_DENIED` row) never reach a
 * handler. So a refusal for who the caller is always comes before a refusal for what the body
 * holds (spec §7.3). No route carries a hook of its own. Two handler calls remain because they
 * RETURN what the handler works with, not because they guard: `requireConsoleIdentity` gives the
 * console of a sign-in, `operatorSessionOf` the session of operations 4 to 6.
 *
 * COOKIES. Only the answer to a web console's sign-in sets the session cookie, and only the
 * answer to a web session's sign-out clears it. No answer to a device carries `Set-Cookie`.
 */
import {
  AuthSessionExpirySchema,
  AuthSessionInfoSchema,
  SignInRequestSchema,
  SignInResponseSchema,
  SignInStatusSchema,
  SignOutRequestSchema,
  type AuthSessionExpiry,
  type AuthSessionInfo,
  type SignInResponse,
  type SignInStatus,
} from '@dems/shared/api';
import { SignOutReason } from '@dems/shared/sim';
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { operatorSessionOf } from '../../plugins/authenticate';
import { routeOfOperation } from '../../plugins/permission-guard';
import { requireConsoleIdentity, statusConsoleKeyOf } from './console';
import { clearSessionCookie, setSessionCookie } from './cookie';
import { SESSION_IDLE_TIMEOUT_MS } from './limits';
import { operationOf, type IdentityOperationId } from './operations';
import { signOutSession } from './sessions';
import { authSessionInfo, signInWithPassword, type SignInServices } from './sign-in';

/** The operations this module answers, in registry order. */
export const IDENTITY_CORE_OPERATIONS = ['signIn', 'getSignInStatus', 'getAuthSession', 'signOut', 'touchSession'] as const;
export type IdentityCoreOperation = (typeof IDENTITY_CORE_OPERATIONS)[number];
// Each of the five is an operation of the registry's identity table: checked by the compiler.
IDENTITY_CORE_OPERATIONS satisfies readonly IdentityOperationId[];


export function registerIdentityRoutes(app: FastifyInstance, services: SignInServices): void {
  const routes = app.withTypeProvider<ZodTypeProvider>();
  const cookieName = app.config.sessionCookieName;

  // API-7: a 2xx answer of a POST carries the epoch and the revision of the replicated state
  // that holds the command's effect. The engine's unit sets both headers, for every route of the
  // server (`src/engine/api-headers.ts`): no handler of this file sets either. The rows a unit
  // of this module appended are taken into the engine when the unit commits, before the handler
  // continues, so the revision the engine has when the answer is sent holds them.

  // 2 signIn
  routes.route({
    ...routeOfOperation(operationOf('signIn')),
    schema: { body: SignInRequestSchema, response: { 200: SignInResponseSchema } },
    handler: async (request, reply): Promise<SignInResponse> => {
      // ID-1 was decided by stage 6 before the body was read: a caller without a console identity
      // learned nothing from a validation message, took no attempt and wrote no row. This call
      // returns the console the sign-in is for (the lockout key, and the device of the session).
      const consoleIdentity = requireConsoleIdentity(app, request);
      const outcome = await signInWithPassword(app, services, request, consoleIdentity, request.body);
      if (consoleIdentity.kind === 'DEVICE') return { session: outcome.info, sessionToken: outcome.token };
      // A web console: the token travels in the cookie only, never in the body (SR-16).
      setSessionCookie(reply, cookieName, outcome.token);
      return { session: outcome.info };
    },
  });

  // 3 getSignInStatus
  routes.route({
    ...routeOfOperation(operationOf('getSignInStatus')),
    schema: { response: { 200: SignInStatusSchema } },
    handler: async (request): Promise<SignInStatus> => {
      const now = app.clock.now();
      const status = await services.lockout.status(statusConsoleKeyOf(request), now);
      return { ...status, serverTime: now };
    },
  });

  // 4 getAuthSession
  routes.route({
    ...routeOfOperation(operationOf('getAuthSession')),
    schema: { response: { 200: AuthSessionInfoSchema } },
    handler: async (request): Promise<AuthSessionInfo> => {
      const session = operatorSessionOf(request);
      return authSessionInfo(app, session, session.operator, session.permissions);
    },
  });

  // 5 signOut
  routes.route({
    ...routeOfOperation(operationOf('signOut')),
    schema: { body: SignOutRequestSchema },
    handler: async (request, reply) => {
      const session = operatorSessionOf(request);
      await signOutSession(app, session, request.body.reason ?? SignOutReason.USER);
      // A web session came with the cookie: clear it. A device session never had one.
      if (session.deviceId === null) clearSessionCookie(reply, cookieName);
      return reply.code(204).send();
    },
  });

  // 6 touchSession
  routes.route({
    ...routeOfOperation(operationOf('touchSession')),
    schema: { response: { 200: AuthSessionExpirySchema } },
    handler: async (request): Promise<AuthSessionExpiry> => {
      // The activity itself was recorded by the `preHandler` hook of the `authenticate` plugin,
      // as for every POST of an operator; this is what the session's limits are now.
      const session = operatorSessionOf(request);
      return {
        idleExpiresAt: session.lastSeenAt + SESSION_IDLE_TIMEOUT_MS,
        absoluteExpiresAt: session.absoluteExpiresAt,
      };
    },
  });
}
