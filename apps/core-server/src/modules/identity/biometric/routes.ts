/**
 * The routes of the biometric token: operations 7 to 9 of the shared registry (plan row W41;
 * spec §7.5; contract `packages/shared/src/api/identity.ts`).
 *
 *   #  operationId             method and path                       access (registry)                recipe
 *   7  setBiometricEnrollment  POST /api/v1/auth/biometric           AUTHENTICATED + DEVICE_SESSION   one unit (`enrolment.ts`)
 *   8  signInWithBiometric     POST /api/v1/auth/biometric/sign-in   DEVICE + DEVICE_CREDENTIAL       one unit (`sign-in.ts`)
 *   9  reportBiometricFailure  POST /api/v1/auth/biometric/failure   DEVICE                           one unit (`failure.ts`)
 *
 * All three are server-native: none hosts a simulator action. Method, path and schemas are the
 * registry's: each route is built with `routeOfOperation` from its registry entry, which the
 * readiness stage, the throttle and the access rule read.
 *
 * WHO MAY CALL is not decided here. The access rule of the registry is applied by stage 6
 * (`plugins/permission-guard`) before the body is read: a caller without a session, a web
 * console session on operation 7, a caller that is no paired device on operations 8 and 9, the
 * session token of an operator on the device on operation 8 (it needs the device's own
 * credential: finding F77, decision D118), and a retired device (with its one `ACCESS_DENIED`
 * row) never reach a handler. A handler only
 * reads WHO ACTS from what stage 4 resolved: the session of the operator for operation 7, the
 * device for operations 8 and 9. No route carries a hook of its own.
 *
 * API-7: every 2xx answer carries `x-dems-epoch` and `x-dems-revision`. The engine's unit sets
 * them when the answer is sent (`src/engine/api-headers.ts`); no handler here does. No answer of
 * this folder sets a cookie: every caller here is a device (decision D69).
 */
import {
  BiometricEnrollmentRequestSchema,
  BiometricEnrollmentSchema,
  BiometricFailureRequestSchema,
  BiometricSignInRequestSchema,
  SignInResponseSchema,
  SignInStatusSchema,
  type BiometricEnrollment,
  type SignInResponse,
  type SignInStatus,
} from '@dems/shared/api';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { notSignedIn, operatorSessionOf } from '../../../plugins/authenticate';
import { routeOfOperation } from '../../../plugins/permission-guard';
import { pairedDeviceOf } from '../console';
import { operationOf, type IdentityOperationId } from '../operations';
import { notADeviceSession, setBiometricEnrollment } from './enrolment';
import { reportBiometricFailure } from './failure';
import { signInWithBiometricToken, type BiometricServices } from './sign-in';

/** The operations this folder answers, in registry order. */
export const BIOMETRIC_OPERATION_IDS = ['setBiometricEnrollment', 'signInWithBiometric', 'reportBiometricFailure'] as const;
export type BiometricOperationId = (typeof BIOMETRIC_OPERATION_IDS)[number];

// Each of the three is an operation of the registry's identity table: checked by the compiler.
BIOMETRIC_OPERATION_IDS satisfies readonly IdentityOperationId[];

/**
 * The paired device a request speaks for: its own credential, or a session that is bound to it.
 * Operation 9 is reached by both; operation 8 by the device's own credential only (stage 6).
 */
function deviceOf(request: FastifyRequest): string {
  const deviceId = pairedDeviceOf(request);
  // Stage 6 lets only a paired device reach a DEVICE operation; this is what a route answers
  // if it is ever reached without one.
  if (deviceId === null) throw notSignedIn();
  return deviceId;
}

export function registerBiometricRoutes(app: FastifyInstance, services: BiometricServices): void {
  const routes = app.withTypeProvider<ZodTypeProvider>();

  // API-7: a 2xx answer of a POST carries the epoch and the revision of the replicated state
  // that holds the command's effect. The engine's unit sets both headers, for every route of the
  // server (`src/engine/api-headers.ts`): no handler of this file sets either. The rows a unit
  // of this folder appended are taken into the engine when the unit commits, before the handler
  // continues, so the revision the engine has when the answer is sent holds them.

  // 7 setBiometricEnrollment
  routes.route({
    ...routeOfOperation(operationOf('setBiometricEnrollment')),
    schema: { body: BiometricEnrollmentRequestSchema, response: { 200: BiometricEnrollmentSchema } },
    handler: async (request): Promise<BiometricEnrollment> => {
      const session = operatorSessionOf(request);
      // Stage 6 lets only a session that is bound to a device reach this operation.
      if (session.deviceId === null) throw notADeviceSession();
      return setBiometricEnrollment(app, { sessionId: session.id, operatorId: session.operatorId, deviceId: session.deviceId }, request.body.enabled);
    },
  });

  // 8 signInWithBiometric
  routes.route({
    ...routeOfOperation(operationOf('signInWithBiometric')),
    schema: { body: BiometricSignInRequestSchema, response: { 200: SignInResponseSchema } },
    handler: async (request): Promise<SignInResponse> => {
      const signedIn = await signInWithBiometricToken(app, services, request, deviceOf(request), request.body.token);
      // A device: both tokens travel in the body, once. No cookie.
      return { session: signedIn.info, sessionToken: signedIn.sessionToken, biometricToken: signedIn.biometricToken };
    },
  });

  // 9 reportBiometricFailure
  routes.route({
    ...routeOfOperation(operationOf('reportBiometricFailure')),
    schema: { body: BiometricFailureRequestSchema, response: { 200: SignInStatusSchema } },
    handler: async (request): Promise<SignInStatus> => reportBiometricFailure(app, services.lockout, request, deviceOf(request), request.body.operatorId),
  });
}
