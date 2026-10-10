/**
 * Media-stream module (blueprint row 90, M8-W1; register NM-11; C3 §2.2 operation 88, §2.4):
 * the REGISTRATION of the two media routes, and nothing else.
 *
 *   88  createEvidenceMediaSession   POST /api/v1/evidence/{id}/media-sessions   EVIDENCE_VIEW
 *       the media route              GET  /media/:token                          registry-external
 *
 * Routes are registered by modules only, so that every route is shown to the boot check of the
 * permission guard. What the two routes DO - the signed media session, its binding, the Range
 * answer, the audit rows, the case scope of REAL evidence - is the closed unit `src/media-stream`
 * (`createMediaStreamService`): this module sets no header, reads no file, opens no key and
 * decides nothing about access.
 *
 * Operation 88 is built from its registry entry (`routeOfOperation`): method, path and the answer
 * schema are the registry's, and stage 6 applies the registry's rule (EVIDENCE_VIEW) before the
 * handler runs.
 *
 * THE MEDIA ROUTE IS NO REGISTRY OPERATION (C3 §2.4: registry-external, like the realtime
 * channel). The rule book of the permission guard holds a fixed rule for it (controller ruling
 * D140): the rule of operation 88 itself, EVIDENCE_VIEW, at `GET /media/:token`. So stage 6
 * refuses a caller without the permission, with the row, before the handler looks at the token;
 * `app.ts` registers this module (waived by the same ruling).
 *
 * The plugin function opens no database connection, no file and no key, and registers no boot
 * step, no hook and no seam: `buildApp()` works without PostgreSQL and without a data directory.
 */
import { EvidenceMediaSessionSchema, type EvidenceMediaSessionBody } from '@dems/shared/api';
import type { FastifyPluginAsync } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { MEDIA_ROUTE_URL, MEDIA_STREAM_OPERATIONS, createMediaStreamService, mediaStream } from '../../media-stream';
import { routeOfOperation } from '../../plugins/permission-guard';

export { MEDIA_ROUTE_URL, MEDIA_STREAM_OPERATIONS };

export const mediaStreamModule: FastifyPluginAsync = async (app) => {
  const routes = app.withTypeProvider<ZodTypeProvider>();
  const service = createMediaStreamService(app, () => mediaStream(app).parts());

  // 88 createEvidenceMediaSession
  routes.route({
    ...routeOfOperation(service.operation),
    schema: { params: service.sessionParams, response: { 201: EvidenceMediaSessionSchema } },
    handler: (request, reply): Promise<EvidenceMediaSessionBody> => service.createSession(request, request.params.id, reply),
  });

  // The media route: registry-external. The handler reads the token of the path and the `Range` header.
  app.route({ method: 'GET', url: MEDIA_ROUTE_URL, handler: (request, reply) => service.serve(request, reply) });
};
