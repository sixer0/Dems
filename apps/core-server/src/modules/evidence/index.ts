/**
 * Evidence module (plan row W35; spec §7.9, §7.2, §7.3, §7.17, §11; SR-59, SR-66; AC-B-69,
 * AC-B-70): operations 39 to 43 of the shared registry.
 *
 *   #   operationId       method and path                    access (registry)   audit on success
 *   39  listEvidence      GET  /api/v1/evidence              EVIDENCE_VIEW       none (a read)
 *   40  getEvidence       GET  /api/v1/evidence/{id}         EVIDENCE_VIEW       none (a read)
 *   41  verifyEvidence    POST /api/v1/evidence/{id}/verify  EVIDENCE_VIEW       EVIDENCE_VERIFIED or EVIDENCE_VERIFY_FAILED
 *   42  exportEvidence    POST /api/v1/evidence/{id}/export  EVIDENCE_EXPORT     EVIDENCE_EXPORTED
 *   43  archiveEvidence   POST /api/v1/evidence/{id}/archive EVIDENCE_REVIEW     EVIDENCE_ARCHIVED; none when already archived
 *
 * Method, path and schemas are the registry's: each route is built from its registry entry.
 *
 * WHO MAY CALL is not checked here. The access rule of the registry is applied by stage 6
 * (`plugins/permission-guard`) before the body is read, and it also writes the one row of a
 * refused call, the export's included (decision D83 DN-4). `verify` is one of the hosted actions
 * the simulator does not check at all: for it the access rule is the only check there is.
 *
 * THE TWO READS (39, 40) answer from PostgreSQL, through the pool of the runtime role
 * (`reads.ts` says why, and why the answer equals the engine's committed `evidence` slice).
 * Operation 40 adds the media reference (`media.ts`: the join of the bundled demo packages) and
 * everything `src/evidence-facts` states of the item (wave H C1): the media state of a product-sealed
 * item, the facts of its sealed manifest, what this caller may do, its finished exports.
 *
 * THE THREE COMMANDS (41, 42, 43) are hosted actions of the shared simulator: one call of
 * `app.engine.command` under the caller's identity, one unit of work, the answer after the
 * commit; the engine's unit gives it the state position of API-7 (`src/engine/api-headers.ts`).
 * The module changes no row itself and writes no audit
 * row and no event: the engine's are written through, by the engine host.
 *
 *   - A refusal the simulator THROWS (an unknown item, an item that was never sealed) arrives
 *     as the answer of spec §7.2 with `details.simCode`; it passes through with the wording of
 *     this area. Nothing was changed.
 *   - A refusal the simulator reports IN ITS RESULT (the export's) is taken out of the unit as
 *     a value and answered AFTER the unit has ended: such a result may have written a row.
 *
 * OPERATION 41 AND A REAL PACKAGE (task 3 row 85). An item whose package is a real sealed
 * `dems.evidence-manifest/2` folder is not verified by the simulator: the route hands it to the
 * verification another unit provides (`real-verification.ts`), which reads the files, forms the
 * verdict of the 14 checks of the evidence package spec §D and records it. Every other item -
 * every item of today - takes the hosted `verify` unchanged.
 *
 * WHAT NO OPERATION DOES (I11, AC-B-69): none changes a track, a track hash, the manifest hash
 * or the signature of an item. A verification, an export and an archive add a custody entry and
 * an audit row and change the status or the verification state; the sealed columns cannot be
 * updated by the runtime role at all (database contract §7.3). AUDIO-01 and AUDIO-02 are two
 * tracks in every answer that lists tracks (AC-B-70).
 *
 * WHAT IS NOT HERE (SR-66, MS-1 to MS-4): no route returns a file or takes one, and no value of
 * a request is ever used as a path.
 *
 * The plugin function opens no database connection: `buildApp()` works without PostgreSQL.
 *
 * CONTRACT with the scaffold (P25: `app.ts` is frozen): `evidenceModule` keeps its name.
 */
import {
  API_PAGE_LIMIT_DEFAULT,
  EvidenceDetailSchema,
  EvidenceExportAcceptedSchema,
  EvidenceListQuerySchema,
  EvidencePageSchema,
  EvidenceVerifyResultSchema,
  findCoreApiOperation,
  type CoreApiRegistryOperation,
  type EvidenceDetail,
  type EvidenceExportAccepted,
  type EvidencePage,
  type EvidenceVerifyResultBody,
} from '@dems/shared/api';
import type { ExportResult } from '@dems/shared/sim';
import type { FastifyPluginAsync, FastifyRequest } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import type { Pool } from 'pg';
import { z } from 'zod';
import { MappingError } from '../../db/mapping';
import { simCodeOf, simRefusal, type EngineOutcome } from '../../engine';
import { EXPORT_IN_PROGRESS_TEXT, createExportService, evidenceExport, exportJobIdOf, exportKindOfBody } from '../../evidence-export';
import { evidenceFacts } from '../../evidence-facts';
import { ApiFailure, NOT_SIGNED_IN_TEXT, invalidInput } from '../../plugins/error-envelope';
import { routeOfOperation } from '../../plugins/permission-guard';
import { decodeEvidenceCursor, encodeEvidenceCursor, type EvidenceCursor } from './cursor';
import { NO_REASON, readExportBody } from './export-request';
import { mediaRefOf } from './media';
import { readEvidenceItem, readEvidencePage } from './reads';
import { evidenceVerification } from './real-verification';

/** The operations this module answers, in registry order of their numbers (39 to 43). */
export const EVIDENCE_MODULE_OPERATIONS = ['listEvidence', 'getEvidence', 'verifyEvidence', 'exportEvidence', 'archiveEvidence'] as const;
export type EvidenceModuleOperation = (typeof EVIDENCE_MODULE_OPERATIONS)[number];
export { evidenceVerification, type EvidenceVerificationControl, type RealEvidenceVerification } from './real-verification';

/** The one text of every "no such item" answer of the area: the contract's example text. */
const NOT_FOUND_TEXT = 'Evidence not found.';

/** The wording of this area for a refusal the simulator threw; status, code and details stay the host's. */
const REFUSAL_WORDING: Readonly<Record<string, string>> = {
  NOT_FOUND: NOT_FOUND_TEXT,
  UNSEALED_EVIDENCE: 'Unsealed evidence cannot be archived.',
};

type ExportRefusal = Extract<ExportResult, { ok: false }>;

/** The texts of the export's refusals: the ones the contract's examples show. Fixed; none quotes the request. */
const EXPORT_REFUSAL_TEXT: Readonly<Record<ExportRefusal['reason'], string>> = {
  NOT_SIGNED_IN: NOT_SIGNED_IN_TEXT,
  FORBIDDEN: 'Your role cannot export evidence (RBAC). The attempt was audited.',
  NOT_FOUND: NOT_FOUND_TEXT,
  NOT_SEALED: 'Only sealed evidence can be exported.',
  SECURITY_FAULT: 'A security fault blocks export.',
  INVALID_REASON: 'An export reason of at least 5 characters is required.',
  EXPORT_IN_PROGRESS: EXPORT_IN_PROGRESS_TEXT,
};

const exportRefused = (refusal: ExportRefusal): ApiFailure => new ApiFailure(refusal.status, refusal.reason, EXPORT_REFUSAL_TEXT[refusal.reason]);

/** 404 for an item no table holds: the form a hosted action's own "not found" has, so a client reads one form. */
const evidenceNotFound = (): ApiFailure => new ApiFailure(404, 'NOT_FOUND', NOT_FOUND_TEXT, { details: { simCode: 'NOT_FOUND' } });

/** The registry entry of one of this module's operations. A missing one stops the start. */
function operationOf(operationId: EvidenceModuleOperation): CoreApiRegistryOperation {
  const operation = findCoreApiOperation(operationId);
  if (operation === undefined) throw new Error(`the contract registry has no operation ${operationId}`);
  return operation;
}

/** The pattern the registry gives the `{id}` of an operation. */
function idPatternOf(operation: CoreApiRegistryOperation): RegExp {
  const pattern = operation.pathParam?.pattern;
  if (pattern === undefined) throw new Error(`the registry gives ${operation.operationId} no path parameter`);
  return pattern;
}

/** The path parameters of an operation as a schema: `{ id }`, held to the registry's pattern. */
const idParams = (operation: CoreApiRegistryOperation) => z.object({ id: z.string().regex(idPatternOf(operation)) });

/** The `{id}` of a route that validates it itself. */
function pathIdOf(request: FastifyRequest): string {
  const params: unknown = request.params;
  const id: unknown = typeof params === 'object' && params !== null && 'id' in params ? params.id : undefined;
  return typeof id === 'string' ? id : '';
}

/**
 * Runs one hosted action. A refusal the simulator threw keeps the status, the code and the
 * details the engine host gave it and gets the wording of this area; everything else (a unit
 * that was not committed, an engine that is not running, an unexpected failure) passes as it is.
 */
async function hosted<Value>(run: () => Promise<EngineOutcome<Value>>): Promise<EngineOutcome<Value>> {
  try {
    return await run();
  } catch (error) {
    const simCode = simCodeOf(error);
    if (!(error instanceof ApiFailure) || simCode === null || !Object.hasOwn(REFUSAL_WORDING, simCode)) throw error;
    throw simRefusal(error.cause, REFUSAL_WORDING[simCode]) ?? error;
  }
}

export const evidenceModule: FastifyPluginAsync = async (app) => {
  const routes = app.withTypeProvider<ZodTypeProvider>();
  const operations = {
    listEvidence: operationOf('listEvidence'),
    getEvidence: operationOf('getEvidence'),
    verifyEvidence: operationOf('verifyEvidence'),
    exportEvidence: operationOf('exportEvidence'),
    archiveEvidence: operationOf('archiveEvidence'),
  } as const satisfies Record<EvidenceModuleOperation, CoreApiRegistryOperation>;
  const exportIdPattern = idPatternOf(operations.exportEvidence);
  // Fix pass F-M8: what operation 42 asks of the export unit before its hosted action (`evidence-export/service.ts`).
  const exportService = createExportService(app);
  const realVerification = evidenceVerification(app);
  // Wave H C1 (gate findings G94-01, G94-04, G94-05; decision D200): what the Core says of an item
  // beyond its stored rows - the media state of every kind of item, the facts of its sealed
  // manifest, what this caller may do, its finished exports (`src/evidence-facts`). The module
  // hands it the request whole and the item; it reads no package and decides nothing itself.
  const facts = evidenceFacts(app);
  facts.register();

  /**
   * One read on the pool of the runtime role, through the pool plugin's helper (`app.db.read`;
   * review finding CPB1-8). A database that does not answer is the server's failure, not the
   * caller's: the helper writes one error line as `{ err }` with the request's logger, one entry
   * in the persistent error log, starts a fresh readiness probe, and answers 503 `NOT_READY`.
   *
   * A stored row the mapping cannot read is NOT the database's failure: it is a defect and stays
   * an unexpected failure (500, reported by the envelope). The helper would answer 503 for it,
   * so it is carried out of the helper as a value and thrown here.
   */
  async function read<Value>(request: FastifyRequest, operationId: EvidenceModuleOperation, run: (pool: Pool) => Promise<Value>): Promise<Value> {
    const outcome = await app.db.read(
      `evidence.${operationId}`,
      async (pool): Promise<{ readonly value: Value } | { readonly defect: MappingError }> => {
        try {
          return { value: await run(pool) };
        } catch (error) {
          if (error instanceof MappingError) return { defect: error };
          throw error;
        }
      },
      request,
    );
    if ('defect' in outcome) throw outcome.defect;
    return outcome.value;
  }

  // 39 listEvidence
  routes.route({
    ...routeOfOperation(operations.listEvidence),
    schema: { querystring: EvidenceListQuerySchema, response: { 200: EvidencePageSchema } },
    handler: async (request): Promise<EvidencePage> => {
      const { status, caseType, q, cursor, limit } = request.query;
      let after: EvidenceCursor | undefined;
      if (cursor !== undefined) {
        // A value that has the form of a cursor but is none of this list: "a cursor that is not one".
        const position = decodeEvidenceCursor(cursor);
        if (position === null) throw invalidInput('querystring');
        after = position;
      }
      const page = await read(request, 'listEvidence', (pool) =>
        readEvidencePage(pool, { status, caseType, search: q, after, limit: limit ?? API_PAGE_LIMIT_DEFAULT }),
      );
      return { items: facts.overlay(page.items), nextCursor: page.next === null ? null : encodeEvidenceCursor(page.next) };
    },
  });

  // 40 getEvidence
  routes.route({
    ...routeOfOperation(operations.getEvidence),
    schema: { params: idParams(operations.getEvidence), response: { 200: EvidenceDetailSchema } },
    handler: async (request): Promise<EvidenceDetail> => {
      const evidence = await read(request, 'getEvidence', (pool) => readEvidenceItem(pool, request.params.id));
      if (evidence === null) throw evidenceNotFound();
      // `mediaRefOf` is the join of the BUNDLED demo packages; a product-sealed item's media state is the Core's own (G94-01).
      return facts.detail(request, evidence, mediaRefOf(evidence));
    },
  });

  // 41 verifyEvidence. A failed verification is an answer (200, `ok: false`), not an error.
  // An item with a real sealed v2 package is verified by the provided verification
  // (`real-verification.ts`); it answers null for every other item, and that item is verified by
  // the hosted `verify` exactly as before (the dataset items, the v1 demo packages).
  routes.route({
    ...routeOfOperation(operations.verifyEvidence),
    schema: { params: idParams(operations.verifyEvidence), response: { 200: EvidenceVerifyResultSchema } },
    handler: async (request): Promise<EvidenceVerifyResultBody> => {
      const real = await (realVerification.current()?.verify(request.principal, request.params.id) ?? null);
      if (real !== null) return real;
      return (await hosted(() => app.engine.command(request.principal, 'verify', request.params.id))).value;
    },
  });

  // 42 exportEvidence: hosted `exportEvidence`. The design-book operation: its `{id}` has no
  // schema of its own, because an ID that is no evidence ID answers 404 as in Simulated mode.
  routes.route({
    ...routeOfOperation(operations.exportEvidence),
    schema: { response: { 202: EvidenceExportAcceptedSchema } },
    handler: async (request, reply): Promise<EvidenceExportAccepted> => {
      // Line 8 of the precedence table: a body that does not match its schema, before the engine.
      const body = readExportBody(request.body);
      if (body.kind === 'INVALID') throw invalidInput('body');
      // Line 10, in the order the hosted action checks: 404, 409, then the reason. No item has
      // an ID of another form (a CHECK of the table), so such an ID is unknown without a unit.
      const evidenceId = pathIdOf(request);
      if (!exportIdPattern.test(evidenceId)) throw exportRefused({ ok: false, status: 404, reason: 'NOT_FOUND' });

      // Fix pass F-M8 (review findings R93-01, R93-03; ruling D178). An item whose sealed package
      // lies in this Core's store is exported by a JOB: the REAL-evidence case scope is held, the
      // jobs must be composed (else the request is refused by name and nothing is marked), and the
      // request is committed DEFERRED - status EXPORTED and the custody entry are the job's
      // completion, never the request's. Every other item takes the hosted action as it is.
      const admitted = await exportService.admitRequest(request, evidenceId);

      // Task 3 row 91: an item with an unfinished export job takes no second request (C3 §4). The
      // ticket is taken BEFORE the hosted action, so two requests cannot both pass; while no export
      // jobs are provided (`src/evidence-export`), nothing is asked and nothing is refused here.
      const exportJobs = evidenceExport(app).current();
      const ticket = exportJobs === null ? null : exportJobs.begin(evidenceId);
      if (exportJobs !== null && ticket === null) throw new ApiFailure(409, 'EXPORT_IN_PROGRESS', EXPORT_IN_PROGRESS_TEXT);

      const kind = exportKindOfBody(request.body);
      let result: ExportResult;
      try {
        // R93-06: the kind the body named goes onto the request row; `completion` is the server's own member, never the body's.
        // G94-10 (wave H C1): a request that becomes a JOB of this Core always says its kind on the row (C3 §5.2
        // `details.kind: PACKAGE|COMPOSITE`), also when the body left it to the default.
        const hostedRequest = body.kind === 'VALID' ? { ...body.request, ...(body.named || admitted.job ? { kind } : {}), ...(admitted.job ? { completion: 'DEFERRED' as const } : {}) } : NO_REASON;
        const outcome = await app.engine.command(request.principal, 'exportEvidence', evidenceId, hostedRequest);
        result = outcome.value;
      } catch (error) {
        ticket?.cancel();
        throw error;
      }
      // The unit has ended. A refusal in the result is answered only now: it may have written a row.
      if (!result.ok) {
        ticket?.cancel();
        throw exportRefused(result);
      }
      // The request is committed. For a sealed package the background job is queued now (operation
      // 87 polls it); a deferred request no job could be queued for ends FAILED, with its row. For
      // every other item this changes nothing. It never rejects.
      await ticket?.accepted({ exportId: result.exportId, kind, deferred: admitted.job });
      void reply.code(202);
      // R93-06: the job operation 87 polls, as the contract and the simulator name it.
      return { exportId: result.exportId, evidenceId, status: 'QUEUED', jobId: exportJobIdOf(result.exportId) };
    },
  });

  // 43 archiveEvidence: hosted `archiveEvidence`. An item that is already archived changes nothing and answers 204.
  routes.route({
    ...routeOfOperation(operations.archiveEvidence),
    schema: { params: idParams(operations.archiveEvidence) },
    handler: async (request, reply) => {
      await hosted(() => app.engine.command(request.principal, 'archiveEvidence', request.params.id));
      return reply.code(204).send();
    },
  });
};
