/**
 * Evidence-export module (task 3 blueprint row 91 / M8-W2; contract C3 §3 operation 87; UX flow 5
 * step 7; register NM-12, SH-14): the route of operation 87.
 *
 *   87  getEvidenceExportJob  GET /api/v1/evidence/exports/{id}   EVIDENCE_EXPORT   none (a read)
 *
 * WHO MAY CALL is not checked here: the access rule of the registry is applied by stage 6
 * (`plugins/permission-guard`) before the handler runs. An `{id}` that is no `EXPJ-NNNNNN` is the
 * 422 of the route's schema.
 *
 * WHAT IT ANSWERS. The job itself is another unit's (`src/evidence-export`, reached through
 * `evidenceExport(app)`):
 *
 *   - an export of a REAL sealed v2 package: the job as the export jobs hold it - QUEUED, RUNNING,
 *     COMPLETE with the export manifest's hash and signature, or FAILED with its code (a FAILED
 *     job is a `200`, C3 §4);
 *   - every other export (every item of today: the dataset and the demo packages): the answer of
 *     Simulated mode, read from the committed REQUEST row - the export was complete inside the
 *     request that made it, so the job is COMPLETE with the item's sealed manifest hash and
 *     signature;
 *   - no request row with that export ID: 404.
 *
 * Operation 42 is NOT here: its route stays in `modules/evidence` (the hosted action commits the
 * request) and hands an accepted request to the same unit.
 *
 * The module changes nothing, writes no row and no file, and opens no database connection:
 * `buildApp()` works without PostgreSQL.
 */
import { EvidenceExportJobSchema, findCoreApiOperation, type CoreApiRegistryOperation, type EvidenceExportJobBody } from '@dems/shared/api';
import type { FastifyPluginAsync } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { coreExportDirectory, evidenceExport, exportIdOfJob } from '../../evidence-export';
import { ApiFailure } from '../../plugins/error-envelope';
import { routeOfOperation } from '../../plugins/permission-guard';

/** The operations this module answers. */
export const EVIDENCE_EXPORT_MODULE_OPERATIONS = ['getEvidenceExportJob'] as const;
export type EvidenceExportModuleOperation = (typeof EVIDENCE_EXPORT_MODULE_OPERATIONS)[number];

const NOT_FOUND_TEXT = 'No export job has this ID.';
/** The form the contract gives a signature in a job answer. */
const SIGNATURE_FORM = /^(?:[0-9a-f]{64}|[0-9a-f]{128})$/;
const HASH_FORM = /^[0-9a-f]{64}$/;

/** 404 in the form a hosted action's own "not found" has, so a client reads one form in both modes. */
const jobNotFound = (): ApiFailure => new ApiFailure(404, 'NOT_FOUND', NOT_FOUND_TEXT, { details: { simCode: 'NOT_FOUND' } });

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
  const exports = evidenceExport(app);
  const directory = coreExportDirectory(app);

  // 87 getEvidenceExportJob
  routes.route({
    ...routeOfOperation(operations.getEvidenceExportJob),
    schema: { params: z.object({ id: z.string().regex(pattern) }), response: { 200: EvidenceExportJobSchema } },
    handler: async (request): Promise<EvidenceExportJobBody> => {
      const jobId = request.params.id;
      const real = await (exports.current()?.job(jobId) ?? null);
      if (real !== null) return real;

      const exportId = exportIdOfJob(jobId);
      const made = exportId === null ? null : directory.requestOf(exportId);
      if (made === null) throw jobNotFound();
      const seal = directory.sealOf(made.evidenceId);
      return {
        jobId,
        evidenceId: made.evidenceId,
        kind: 'PACKAGE',
        // The simulated export is complete inside the request that queued it.
        status: 'COMPLETE',
        progressPct: 100,
        etaMs: 0,
        ...(seal !== null && HASH_FORM.test(seal.manifestHash) ? { manifestHash: seal.manifestHash } : {}),
        ...(seal !== null && SIGNATURE_FORM.test(seal.signatureValue) ? { signature: seal.signatureValue } : {}),
        derived: false,
        createdAt: made.at,
        completedAt: made.at,
      };
    },
  });
};
