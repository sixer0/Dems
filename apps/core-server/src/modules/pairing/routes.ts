/**
 * The routes of the pairing module: operations 15 to 23 of the shared registry (plan row W32;
 * spec §7.7; contract `packages/shared/src/api/pairing.ts`).
 *
 *   #   operationId             method and path                           access (registry)   recipe
 *   15  issuePairingCode        POST /api/v1/pairing/code                 PAIRING_MANAGE      one unit
 *   16  getPairingCodeStatus    GET  /api/v1/pairing/code                 PAIRING_MANAGE      a read on the pool
 *   17  cancelPairingCode       POST /api/v1/pairing/code/cancel          PAIRING_MANAGE      one unit
 *   18  redeemPairingCode       POST /api/v1/pairing/redeem               PUBLIC              one unit (`redeem.ts`)
 *   19  listPairedDevices       GET  /api/v1/pairing/devices              PAIRING_MANAGE      a read on the pool
 *   20  revokeDevice            POST /api/v1/pairing/devices/:id/revoke   PAIRING_MANAGE      one unit
 *   21  getDeviceRegistration   GET  /api/v1/pairing/device               DEVICE              two reads on the pool
 *   22  unpairDevice            POST /api/v1/pairing/device/unpair        DEVICE              one unit
 *   23  rotateDeviceCredential  POST /api/v1/pairing/device/credential    DEVICE              one unit
 *
 * All nine are server-native: none hosts a simulator action. Method, path and schemas are the
 * registry's: each route is built with `routeOfOperation` from its registry entry, which the
 * readiness stage, the throttle and the access rule read.
 *
 * WHO MAY CALL is not decided here. The access rule of the registry is applied by stage 6
 * (`plugins/permission-guard`) before the body is read, with its one `ACCESS_DENIED` row for a
 * refused call. A handler only reads WHO ACTS from what stage 4 resolved: the operator of the
 * session for the rows of operations 15, 17 and 20, the device for operations 21 to 23. No
 * route carries a hook of its own.
 *
 * API-7: every 2xx answer of a POST carries `x-dems-epoch` and `x-dems-revision`. The engine's
 * unit sets them when the answer is sent (`src/engine/api-headers.ts`); no handler here does.
 * No answer of this module sets a cookie.
 */
import {
  ActivePairingCodeSchema,
  DeviceCredentialRotatedSchema,
  DeviceRegistrationSchema,
  DeviceRevokeRequestSchema,
  PAIRING_OPERATIONS,
  PairedDeviceListSchema,
  PairedDeviceSchema,
  PairingCodeIssuedSchema,
  PairingRedeemRequestSchema,
  PairingRedeemedSchema,
  type ActivePairingCode,
  type DeviceCredentialRotated,
  type DeviceRegistration,
  type PairedDevice,
  type PairedDeviceList,
  type PairingCodeIssued,
  type PairingRedeemed,
} from '@dems/shared/api';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { looksLikeSecret } from '../../core';
import { authenticationOf, notSignedIn, operatorSessionOf, pairedDeviceOf } from '../../plugins/authenticate';
import { invalidInput } from '../../plugins/error-envelope';
import { routeOfOperation } from '../../plugins/permission-guard';
import { activeCodeStatus, cancelCode, issueCode } from './codes';
import { deviceRegistration, listPairedDevices, refuseShortRevokeReason, revokePairedDevice, rotateDeviceCredential, unpairPairedDevice } from './devices';
import type { DevicePresence } from './presence';
import { redeemPairingCode } from './redeem';
import type { RedeemLock } from './redeem-lock';

/** The operations this module answers, in registry order: the whole of area 3. */
export const PAIRING_OPERATION_IDS = [
  'issuePairingCode',
  'getPairingCodeStatus',
  'cancelPairingCode',
  'redeemPairingCode',
  'listPairedDevices',
  'revokeDevice',
  'getDeviceRegistration',
  'unpairDevice',
  'rotateDeviceCredential',
] as const;
export type PairingOperationId = (typeof PAIRING_OPERATION_IDS)[number];

/** What the routes need from the module. */
export interface PairingServices {
  readonly lock: RedeemLock;
  readonly presence: DevicePresence;
}

type PairingOperation = (typeof PAIRING_OPERATIONS)[number];

function operationOf(operationId: PairingOperationId): PairingOperation {
  const operation = PAIRING_OPERATIONS.find((candidate) => candidate.operationId === operationId);
  if (operation === undefined) throw new Error(`the contract registry has no operation ${operationId}`);
  return operation;
}

/** The path parameter of operation 20, by the pattern its registry entry names. */
function revokeParamsSchema(): z.ZodObject<{ id: z.ZodString }> {
  const operation = operationOf('revokeDevice');
  if (!('pathParam' in operation)) throw new Error('the contract registry names no path parameter for revokeDevice');
  return z.object({ id: z.string().regex(operation.pathParam.pattern) });
}

/** The operator a request acts as: the actor of the rows of operations 15, 17 and 20. */
const operatorOf = (request: FastifyRequest): string => operatorSessionOf(request).operatorId;

/** The paired device a request speaks for: its own credential, or a session that is bound to it. */
function deviceOf(request: FastifyRequest): string {
  const deviceId = pairedDeviceOf(request);
  // Stage 6 lets only a paired device reach a DEVICE operation; this is what a route answers
  // if it is ever reached without one.
  if (deviceId === null) throw notSignedIn();
  return deviceId;
}

interface RevokeInput {
  readonly deviceId: string;
  /** What the operator typed, trimmed, 5 to 500 characters; empty when it was too short. */
  readonly reason: string;
  readonly reasonTooShort: boolean;
}

/**
 * The input of a revoke. The route attaches a validation failure instead of answering it, so
 * that the one case the specification names can get its own code: a reason under five
 * characters is 422 `INVALID_REASON`, and only after the device was found PAIRED. Everything
 * else that does not match the registry's schemas is 422 `INVALID_INPUT`, here and now.
 */
function revokeInputOf(request: FastifyRequest<{ Params: { id: string }; Body: { reason: string } }>): RevokeInput {
  const failure = request.validationError;
  if (failure === undefined) return { deviceId: request.params.id, reason: request.body.reason, reasonTooShort: false };
  if (failure.validationContext !== 'body') throw invalidInput(failure.validationContext);
  // The body as it was sent, judged by the registry's own schema: is the short reason all that is wrong?
  const judged = DeviceRevokeRequestSchema.safeParse(request.body);
  const onlyTooShort =
    !judged.success &&
    judged.error.issues.length > 0 &&
    judged.error.issues.every((issue) => issue.code === 'too_small' && issue.path.length === 1 && issue.path[0] === 'reason');
  if (!onlyTooShort) throw invalidInput('body');
  return { deviceId: request.params.id, reason: '', reasonTooShort: true };
}

export function registerPairingRoutes(app: FastifyInstance, services: PairingServices): void {
  const routes = app.withTypeProvider<ZodTypeProvider>();
  const { lock, presence } = services;

  // API-7: a 2xx answer of a POST carries the epoch and the revision of the replicated state
  // that holds the command's effect. The engine's unit sets both headers, for every route of the
  // server (`src/engine/api-headers.ts`): no handler of this file sets either. The rows a unit
  // of this module appended are taken into the engine when the unit commits, before the handler
  // continues, so the revision the engine has when the answer is sent holds them.

  // 15 issuePairingCode
  routes.route({
    ...routeOfOperation(operationOf('issuePairingCode')),
    schema: { response: { 201: PairingCodeIssuedSchema } },
    handler: async (request, reply): Promise<PairingCodeIssued> => {
      const issued = await issueCode(app, operatorOf(request));
      void reply.code(201);
      return issued;
    },
  });

  // 16 getPairingCodeStatus
  routes.route({
    ...routeOfOperation(operationOf('getPairingCodeStatus')),
    schema: { response: { 200: ActivePairingCodeSchema } },
    handler: async (): Promise<ActivePairingCode> => activeCodeStatus(app),
  });

  // 17 cancelPairingCode
  routes.route({
    ...routeOfOperation(operationOf('cancelPairingCode')),
    handler: async (request, reply) => {
      await cancelCode(app, operatorOf(request));
      return reply.code(204).send();
    },
  });

  // 18 redeemPairingCode
  routes.route({
    ...routeOfOperation(operationOf('redeemPairingCode')),
    schema: { body: PairingRedeemRequestSchema, response: { 201: PairingRedeemedSchema } },
    handler: async (request, reply): Promise<PairingRedeemed> => {
      const redeemed = await redeemPairingCode(app, lock, request, request.body);
      void reply.code(201);
      return redeemed;
    },
  });

  // 19 listPairedDevices
  routes.route({
    ...routeOfOperation(operationOf('listPairedDevices')),
    schema: { response: { 200: PairedDeviceListSchema } },
    handler: async (): Promise<PairedDeviceList> => ({ devices: await listPairedDevices(app, presence) }),
  });

  // 20 revokeDevice
  routes.route({
    ...routeOfOperation(operationOf('revokeDevice')),
    schema: { params: revokeParamsSchema(), body: DeviceRevokeRequestSchema, response: { 200: PairedDeviceSchema } },
    // See `revokeInputOf`: the handler answers what did not validate.
    attachValidation: true,
    handler: async (request): Promise<PairedDevice> => {
      const input = revokeInputOf(request);
      const operatorId = operatorOf(request);
      if (input.reasonTooShort) return refuseShortRevokeReason(app, input.deviceId);
      // The reason is stored and audited as it is: it never holds something of the form of a credential.
      if (looksLikeSecret(input.reason)) throw invalidInput('body');
      return revokePairedDevice(app, presence, operatorId, input.deviceId, input.reason);
    },
  });

  // 21 getDeviceRegistration
  routes.route({
    ...routeOfOperation(operationOf('getDeviceRegistration')),
    schema: { response: { 200: DeviceRegistrationSchema } },
    handler: async (request): Promise<DeviceRegistration> => deviceRegistration(app, deviceOf(request)),
  });

  // 22 unpairDevice
  routes.route({
    ...routeOfOperation(operationOf('unpairDevice')),
    handler: async (request, reply) => {
      // The row names the operator who is signed in on the device, if the call came with a session.
      await unpairPairedDevice(app, presence, deviceOf(request), authenticationOf(request).session?.operatorId ?? null);
      return reply.code(204).send();
    },
  });

  // 23 rotateDeviceCredential
  routes.route({
    ...routeOfOperation(operationOf('rotateDeviceCredential')),
    schema: { response: { 200: DeviceCredentialRotatedSchema } },
    handler: async (request): Promise<DeviceCredentialRotated> => rotateDeviceCredential(app, deviceOf(request)),
  });
}
