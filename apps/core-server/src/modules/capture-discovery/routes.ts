/**
 * The live paths of operations 93 and 94 (blueprint row 132; contract C3 §2.6, §4 erratum
 * PE-121-08, §5.2; specs R-9 AC-1 to AC-4, AC-11 to AC-13; checks M4-DISC-*, M4-SEC-RATE-1).
 *
 *   #   operationId            method and path                  access (registry)   audit on success
 *   93  startCaptureDiscovery  POST /api/v1/capture/discovery   CAPTURE_CONFIG      CAPTURE_DISCOVERY_SEARCHED, when the window closes
 *   94  getCaptureDiscovery    GET  /api/v1/capture/discovery   CAPTURE_CONFIG      none (a read)
 *
 * RBAC is stage 6 (`plugins/permission-guard`): a role without CAPTURE_CONFIG never reaches a
 * handler here and gets its one ACCESS_DENIED row there; no datagram is sent for it. Both
 * operations are open to a tablet and a phone (no condition) and are NOT locked by an open session
 * (D80(4)): operation 93 never answers `CAPTURE_CONFIG_LOCKED`.
 *
 * OPERATION 93 takes no body: there is nothing a caller could steer a search with (no address,
 * subnet, interface, port, timeout or filter exists). It answers as soon as the search is RUNNING:
 * `202` for a new search, `200` with `created: false` while the caller's own search still runs.
 * The refusals of `search.ts`, in its order: 503 `DISCOVERY_NOT_READY`, 409
 * `DISCOVERY_NOT_ALLOWED_WHILE_RECORDING`, 409 `DISCOVERY_IN_PROGRESS`, 429
 * `DISCOVERY_RATE_LIMITED` with `retry-after`. None of them sends a datagram or writes a row.
 *
 * OPERATION 94 answers the CALLER'S OWN search from the store, by the ID of its authenticated
 * session. It takes no search ID, sends nothing to the network and writes nothing. Another
 * session - of the same operator, of a SUPERVISOR - reads `search: null`.
 */
import {
  ApiErrorCode,
  CAPTURE_DISCOVERY_OPERATIONS,
  CaptureDiscoverySearchSchema,
  CaptureDiscoveryStateSchema,
  CaptureDiscoveryTrigger,
  RETRY_AFTER_HEADER_NAME,
  type CaptureDiscoverySearch,
  type CaptureDiscoveryStateBody,
  type CoreApiRegistryOperation,
} from '@dems/shared/api';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { notSignedIn } from '../../plugins/authenticate';
import { ApiFailure } from '../../plugins/error-envelope';
import { routeOfOperation } from '../../plugins/permission-guard';
import type { SearchRefusal, SearchRunner } from './search';
import type { CandidateStore } from './store';

/** The operations this module answers itself, in registry order (operations 93 and 94). */
export const CAPTURE_DISCOVERY_MODULE_OPERATIONS = ['startCaptureDiscovery', 'getCaptureDiscovery'] as const;
export type CaptureDiscoveryModuleOperation = (typeof CAPTURE_DISCOVERY_MODULE_OPERATIONS)[number];

const NOT_READY_TEXT = 'Camera search is not available on this Core.';
const RECORDING_TEXT = 'A camera search cannot run while a session is recording.';
const IN_PROGRESS_TEXT = 'Another camera search is running. Try again shortly.';
const RATE_LIMITED_TEXT = 'Too many camera searches. Try again shortly.';

/** The registry entry of one of this module's operations. Throws at load for a name the registry does not hold. */
export function captureDiscoveryOperation(operationId: CaptureDiscoveryModuleOperation): CoreApiRegistryOperation {
  const operation: CoreApiRegistryOperation | undefined = CAPTURE_DISCOVERY_OPERATIONS.find((candidate) => candidate.operationId === operationId);
  if (operation === undefined) throw new Error(`the contract registry has no operation ${operationId}`);
  return operation;
}

/** The answer of a search that did not start. Fixed texts; `details.reason` is the contract's (C3 §4). */
export function searchRefused(refusal: SearchRefusal): ApiFailure {
  switch (refusal.kind) {
    case 'NOT_READY':
      return new ApiFailure(503, ApiErrorCode.NOT_READY, NOT_READY_TEXT, { details: { reason: refusal.reason } });
    case 'RECORDING':
      return new ApiFailure(409, ApiErrorCode.INVALID_STATE, RECORDING_TEXT, { details: { reason: refusal.reason } });
    case 'IN_PROGRESS':
      return new ApiFailure(409, ApiErrorCode.INVALID_STATE, IN_PROGRESS_TEXT, { details: { reason: refusal.reason } });
    case 'RATE_LIMITED': {
      const seconds = Math.max(1, Math.ceil(refusal.retryAfterMs / 1000));
      return new ApiFailure(429, ApiErrorCode.RATE_LIMITED, RATE_LIMITED_TEXT, {
        details: { reason: refusal.reason, retryInMs: refusal.retryAfterMs },
        headers: { [RETRY_AFTER_HEADER_NAME]: String(seconds) },
      });
    }
  }
}

/** The caller as a search needs it. Stage 6 lets only an operator reach these routes; this is the same backstop the engine host has. */
function ownerOf(request: FastifyRequest): { sessionId: string; operatorId: string; deviceId: string | null } {
  const { principal } = request;
  if (principal.kind !== 'OPERATOR') throw notSignedIn();
  return { sessionId: principal.sessionId, operatorId: principal.operatorId, deviceId: principal.deviceId };
}

export interface CaptureDiscoveryRouteSeams {
  readonly runner: SearchRunner;
  readonly store: CandidateStore;
}

/** Registers operations 93 and 94 on the app. Called once, by the module's plugin. */
export function registerCaptureDiscoveryRoutes(app: FastifyInstance, seams: CaptureDiscoveryRouteSeams): void {
  const routes = app.withTypeProvider<ZodTypeProvider>();

  // 93 startCaptureDiscovery
  routes.route({
    ...routeOfOperation(captureDiscoveryOperation('startCaptureDiscovery')),
    schema: { response: { 200: CaptureDiscoverySearchSchema, 202: CaptureDiscoverySearchSchema } },
    handler: async (request, reply): Promise<CaptureDiscoverySearch> => {
      const outcome = await seams.runner.start({ ...ownerOf(request), trigger: CaptureDiscoveryTrigger.MANUAL });
      if (!outcome.started) throw searchRefused(outcome.refusal);
      // The window closes after this answer: its row, its log line and its alert are the runner's.
      void reply.code(outcome.created ? 202 : 200);
      return outcome.search;
    },
  });

  // 94 getCaptureDiscovery
  routes.route({
    ...routeOfOperation(captureDiscoveryOperation('getCaptureDiscovery')),
    schema: { response: { 200: CaptureDiscoveryStateSchema } },
    handler: async (request): Promise<CaptureDiscoveryStateBody> => seams.store.stateOf(ownerOf(request).sessionId, app.clock.now()),
  });
}
