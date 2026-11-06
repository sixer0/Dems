/**
 * Camera-preview module (decisions D51, D53): the REGISTRATION of the three routes, and nothing else.
 *
 *   112  createCameraPreviewSession   POST /api/v1/capture/devices/{id}/preview-sessions   ANY-OF(SESSION_START, CAPTURE_CONFIG, DEVICE_MANAGE)
 *   113  holdIdleMeters               POST /api/v1/capture/idle-meters/lease                ANY-OF(CAPTURE_CONFIG, DEVICE_MANAGE, SESSION_START)
 *        the preview route            GET  /preview/:token                                  registry-external
 *
 * Routes are registered by modules only, so that every route is shown to the boot check of the
 * permission guard. What the routes DO - the token, its binding, the stream and its headers, the
 * audit row, the lease - is the unit `src/camera-preview` (`createCameraPreviewService`): this module
 * sets no header, reads no row and decides nothing about access.
 *
 * Operations 112 and 113 are built from their registry entries (`routeOfOperation`); stage 6 applies
 * the registry's rule before the handler runs. THE PREVIEW ROUTE IS NO REGISTRY OPERATION: the rule
 * book of the permission guard holds a fixed rule for it (entry 5 of `access-rules.ts`): the rule of
 * operation 112 itself, at `GET /preview/:token`.
 *
 * The plugin function opens no database connection, no file and no socket. At the close of the app
 * every stream in flight is ended.
 */
import { CameraPreviewSessionSchema, IdleMeterLeaseSchema, type CameraPreviewSessionBody, type IdleMeterLeaseBody } from '@dems/shared/api';
import type { FastifyPluginAsync } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { CAMERA_PREVIEW_OPERATIONS, PREVIEW_ROUTE_URL, cameraPreview, createCameraPreviewService } from '../../camera-preview';
import { routeOfOperation } from '../../plugins/permission-guard';

export { CAMERA_PREVIEW_OPERATIONS, PREVIEW_ROUTE_URL };

export const cameraPreviewModule: FastifyPluginAsync = async (app) => {
  const routes = app.withTypeProvider<ZodTypeProvider>();
  const service = createCameraPreviewService(app, () => cameraPreview(app).parts());

  // 112 createCameraPreviewSession
  routes.route({
    ...routeOfOperation(service.sessionOperation),
    schema: { params: service.sessionParams, response: { 201: CameraPreviewSessionSchema } },
    handler: (request, reply): Promise<CameraPreviewSessionBody> => service.createSession(request, request.params.id, reply),
  });

  // 113 holdIdleMeters
  routes.route({
    ...routeOfOperation(service.leaseOperation),
    schema: { response: { 200: IdleMeterLeaseSchema } },
    handler: (request): Promise<IdleMeterLeaseBody> => service.holdLease(request),
  });

  // The preview route: registry-external. The handler reads the token of the path and nothing else.
  app.route({ method: 'GET', url: PREVIEW_ROUTE_URL, handler: (request, reply) => service.serve(request, reply) });

  app.addHook('onClose', async () => {
    service.closeAll();
    await cameraPreview(app).close();
  });
};
