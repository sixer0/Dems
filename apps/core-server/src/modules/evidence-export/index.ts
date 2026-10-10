/**
 * Evidence-export module (task 3 blueprint row 91 / M8-W2; fix pass F-M8, ruling D178; contract
 * C3 §3 operation 87; UX flow 5 step 7; register NM-12, SH-14): the REGISTRATION of two routes.
 *
 *   87  getEvidenceExportJob  GET /api/v1/evidence/exports/{id}   EVIDENCE_EXPORT   none (a read)
 *       the download route    GET /exports/:token                 registry-external
 *
 * WHO MAY CALL is not checked here: the access rule of the registry is applied by stage 6
 * (`plugins/permission-guard`) before the handler runs - operation 87 by its registry entry, the
 * download route by the guard's fixed rule for it (the rule of operation 87, EVIDENCE_EXPORT). An
 * `{id}` that is no `EXPJ-NNNNNN` is the 422 of the route's schema.
 *
 * WHAT THE ROUTES DO is the closed unit `src/evidence-export` (`createExportService`): the job as
 * a real record says it - never a fabricated COMPLETE (review finding R93-01) -, the REAL-evidence
 * case scope, the signed download member of a COMPLETE job, and the download itself (R93-05). This
 * module sets no header, reads no file, opens no key and decides nothing about access.
 *
 * THE DOWNLOAD ROUTE IS NO REGISTRY OPERATION (ruling D178: the contract totals do not move). It
 * is registry-external like the media route of operation 88.
 *
 * Operation 42 is NOT here: its route stays in `modules/evidence` (the hosted action commits the
 * request) and hands an accepted request to the same unit.
 *
 * The plugin function opens no database connection, no file and no key: `buildApp()` works
 * without PostgreSQL.
 */
import { EvidenceExportJobSchema, findCoreApiOperation, type CoreApiRegistryOperation, type EvidenceExportJobBody } from '@dems/shared/api';
import type { FastifyPluginAsync } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { EXPORT_DOWNLOAD_ROUTE_URL, createExportService } from '../../evidence-export';
import { routeOfOperation } from '../../plugins/permission-guard';

export { EXPORT_DOWNLOAD_ROUTE_URL };

/** The operations this module answers. */
export const EVIDENCE_EXPORT_MODULE_OPERATIONS = ['getEvidenceExportJob'] as const;
export type EvidenceExportModuleOperation = (typeof EVIDENCE_EXPORT_MODULE_OPERATIONS)[number];

function operationOf(operationId: EvidenceExportModuleOperation): CoreApiRegistryOperation {
  const operation = findCoreApiOperation(operationId);
  if (operation === undefined) throw new Error(`the contract registry has no operation ${operationId}`);
  return operation;
}

export const evidenceExportModule: FastifyPluginAsync = async (app) => {
  const routes = app.withTypeProvider<ZodTypeProvider>();
  const operations = { getEvidenceExportJob: operationOf('getEvidenceExportJob') } as const;
  const pattern = operations.getEvidenceExportJob.pathParam?.pattern;
  if (pattern === undefined) throw new Error('the registry gives getEvidenceExportJob no path parameter');
  const service = createExportService(app);

  // 87 getEvidenceExportJob
  routes.route({
    ...routeOfOperation(operations.getEvidenceExportJob),
    schema: { params: z.object({ id: z.string().regex(pattern) }), response: { 200: EvidenceExportJobSchema } },
    handler: (request): Promise<EvidenceExportJobBody> => service.job(request, request.params.id),
  });

  // The download route: registry-external. The handler reads the token of the path and nothing else of the request.
  app.route({ method: 'GET', url: EXPORT_DOWNLOAD_ROUTE_URL, handler: (request, reply) => service.download(request, reply) });
};
