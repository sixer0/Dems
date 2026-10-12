/**
 * The live paths of operations 98 and 99 (task 4, blueprint row 70, package WP-07c; the contract
 * `packages/shared/src/api/capture-audio-cards.ts`).
 *
 *   #   operationId                method and path                            access (registry)                       audit on success
 *   98  searchCaptureAudioCards    POST /api/v1/capture/audio-cards/search    CAPTURE_CONFIG + WEB_CONSOLE_SESSION    CAPTURE_DISCOVERY_SEARCHED (scope AUDIO_CARDS)
 *   99  registerCaptureAudioInput  POST /api/v1/capture/audio-cards/inputs    CAPTURE_CONFIG + WEB_CONSOLE_SESSION    CAPTURE_AUDIO_INPUT_CHANGED
 *
 * RBAC AND THE CLIENT KIND ARE STAGE 6 (`plugins/permission-guard`), from the registry entry: a
 * role without CAPTURE_CONFIG and a session of a tablet or a phone (`WEB_CONSOLE_ONLY`) never
 * reach a handler here and get their one ACCESS_DENIED row there, before the body is read. The
 * permission is the contract's own, CAPTURE_CONFIG (SUPERVISOR, TECHNICIAN): the commissioning
 * permission of decision U10 is for the network functions, and a registration changes no network.
 *
 * OPERATION 98 takes no body. OPERATION 99 takes three members and nothing else (a strict
 * object): a card id of the kernel's form and two integers. A body that is no JSON is `400`, one
 * that does not match is `422`; neither refusal quotes the input.
 *
 * What the operations do, and the order of their refusals, is `service.ts`.
 */
import {
  CAPTURE_AUDIO_CARD_OPERATIONS,
  CaptureAudioCardSearchSchema,
  CaptureAudioInputRegisterRequestSchema,
  CaptureAudioInputRegistrationSchema,
  type CaptureAudioCardSearch,
  type CaptureAudioInputRegistration,
  type CoreApiRegistryOperation,
} from '@dems/shared/api';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { notSignedIn } from '../../../plugins/authenticate';
import { routeOfOperation } from '../../../plugins/permission-guard';
import { registerAudioInput, searchAudioCards, type AudioCardsCaller, type AudioCardsSeams } from './service';

/** The operations this module answers itself, in registry order (operations 98 and 99). */
export const CAPTURE_AUDIO_CARDS_MODULE_OPERATIONS = ['searchCaptureAudioCards', 'registerCaptureAudioInput'] as const;
export type CaptureAudioCardsModuleOperation = (typeof CAPTURE_AUDIO_CARDS_MODULE_OPERATIONS)[number];

/** The registry entry of one of this module's operations. Throws at load for a name the registry does not hold. */
export function captureAudioCardsOperation(operationId: CaptureAudioCardsModuleOperation): CoreApiRegistryOperation {
  const operation: CoreApiRegistryOperation | undefined = CAPTURE_AUDIO_CARD_OPERATIONS.find((candidate) => candidate.operationId === operationId);
  if (operation === undefined) throw new Error(`the contract registry has no operation ${operationId}`);
  return operation;
}

/** Stage 6 lets only an operator reach these routes; the refusal here is the same backstop the engine host has. */
function callerOf(request: FastifyRequest): AudioCardsCaller {
  const { principal } = request;
  if (principal.kind !== 'OPERATOR') throw notSignedIn();
  return { operatorId: principal.operatorId, deviceId: principal.deviceId };
}

/** Registers operations 98 and 99 on the app. Called once, by the module's plugin. The seams are read at each call. */
export function registerCaptureAudioCardsRoutes(app: FastifyInstance, seams: () => AudioCardsSeams): void {
  const routes = app.withTypeProvider<ZodTypeProvider>();

  // 98 searchCaptureAudioCards
  routes.route({
    ...routeOfOperation(captureAudioCardsOperation('searchCaptureAudioCards')),
    schema: { response: { 200: CaptureAudioCardSearchSchema } },
    handler: async (request): Promise<CaptureAudioCardSearch> => searchAudioCards(seams(), callerOf(request)),
  });

  // 99 registerCaptureAudioInput
  routes.route({
    ...routeOfOperation(captureAudioCardsOperation('registerCaptureAudioInput')),
    schema: { body: CaptureAudioInputRegisterRequestSchema, response: { 200: CaptureAudioInputRegistrationSchema, 201: CaptureAudioInputRegistrationSchema } },
    handler: async (request, reply): Promise<CaptureAudioInputRegistration> => {
      const outcome = await registerAudioInput(seams(), callerOf(request), request.body);
      void reply.code(outcome.created ? 201 : 200);
      return outcome.registration;
    },
  });
}
