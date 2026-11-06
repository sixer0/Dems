/**
 * What the export routes DO (fix pass F-M8; review findings R93-01, R93-05, controller ruling
 * D178; C3 §3 operations 42 and 87). THIS FILE REGISTERS NO ROUTE: routes are registered by
 * modules only (`modules/evidence` for operation 42, `modules/evidence-export` for operation 87
 * and the download route), which hand each request to the functions built here.
 *
 *   admitRequest(42)   BEFORE the hosted action: is the item one whose export is a JOB of this
 *                      Core (a sealed v2 package in its store)? Then the REAL-evidence case scope
 *                      is held, and the jobs must be composed - an item with a sealed package and
 *                      no export jobs is REFUSED, by name (`503 NOT_READY`,
 *                      `details.reason: EXPORT_JOBS_NOT_AVAILABLE`), and nothing is marked.
 *   job(87)            the job as a REAL RECORD says it, and nothing else:
 *                        - an item with a sealed package: the job of the export jobs (memory, or
 *                          the package folder after a restart). Never the simulated answer; with
 *                          no job record it is FAILED with a code;
 *                        - every other item (the dataset, the v1 demo packages): the simulator's
 *                          export, which completes inside its request - COMPLETE only when the
 *                          item's custody chain holds the `EXPORTED` entry of that request;
 *                        - no request row with that export ID: 404.
 *                      The request and the failure reason are read from the STORED rows when the
 *                      audit ring does not hold them (R93-11): the answer is the same after any
 *                      restart. A stored read that fails is 503 `NOT_READY`, never a 404.
 *                      A COMPLETE job of a sealed package gains the optional `download` member:
 *                      a short-lived signed path for the caller's own sign-in session.
 *   download           `GET /exports/:token` (registry-external): streams the finished archive
 *                      as an attachment. Nothing is decrypted at serve time - the archive already
 *                      is the decrypted copy. Range requests are not answered.
 *
 * THE REAL-EVIDENCE CASE SCOPE (SEC35-16) is the ONE predicate of `src/media-stream`
 * (`holdsCase`): operation 42, operation 87 and the download route hold it for an item whose
 * integrity source is REAL exactly as operation 88 and the media route do, with the same audited
 * refusal (`403 NOT_PERMITTED`, `details.reason: EVIDENCE_CASE_SCOPE`, one `ACCESS_DENIED` row).
 *
 * THE DOWNLOAD, in order:
 *
 *   401   the caller is no operator (the token alone opens nothing)
 *   403   stage 6: a role without EVIDENCE_EXPORT, with its ACCESS_DENIED row (the fixed rule of
 *         the guard: the rule of operation 87)
 *   503   no signing key store
 *   403   NOT_PERMITTED `EXPORT_DOWNLOAD_INVALID`, one ACCESS_DENIED row: not a token, an altered
 *         token, a token of another operator or of another sign-in session - one answer for all
 *   403   NOT_PERMITTED `EXPORT_DOWNLOAD_EXPIRED`, no row
 *   403   the case scope, as above
 *   404   the export is not there (no request, another item, no finished archive)
 *   200   the archive: `content-type: application/zip`, `content-length`,
 *         `content-disposition: attachment; filename="DEMS-export-EXP-NNNNNN.zip"` (a fixed
 *         pattern over the export ID of the verified token - no value of the request, no
 *         destination text), `cache-control: no-store` (the response-headers hook).
 *
 * THE AUDIT of a download: one row and one custody entry through the engine's export door,
 * committed BEFORE the first byte (a download the trail does not know of does not happen). No
 * audit type exists for a download and none was added (ruling D178): the row is the export's own
 * type `EVIDENCE_EXPORTED` with `details.reason: EXPORT_DOWNLOADED`, the job ID and the length -
 * and no `exportId`, so it is never read as a request.
 *
 * WHAT IS NEVER LOGGED: the token, the path with it. The request line of the server holds the
 * route PATTERN (`/exports/:token`); the lines of this file hold codes, IDs and counts.
 */
import { createReadStream } from 'node:fs';
import { lstat } from 'node:fs/promises';
import { sep } from 'node:path';
import { randomBytes } from 'node:crypto';
import { ApiErrorCode, CaptureDiscoveryReason, EVIDENCE_EXPORT_DOWNLOAD_ROUTE_PREFIX, EVIDENCE_MEDIA_SESSION_TTL_MS, type EvidenceExportJobBody, type EvidenceFinishedExport } from '@dems/shared/api';
import { exportArchivePath } from '@dems/shared/evidence-package';
import { AuditType, Permission, Severity } from '@dems/shared/sim';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { AuditEntry } from '../core';
import { exportDoorsOf } from '../engine';
import { sessionPackageDir } from '../evidence-verify';
import { EVIDENCE_CASE_SCOPE_REASON, holdsCase, mediaSessionMacOf } from '../media-stream';
import { notSignedIn, type Principal } from '../plugins/authenticate';
import { ApiFailure } from '../plugins/error-envelope';
import { principalReference } from '../plugins/logger';
import { EVIDENCE_EXPORT_DOWNLOAD_URL } from '../plugins/permission-guard';
import { exportKindsOf, selectedCompositeEncoder } from './composite';
import { evidenceExport } from './control';
import { archiveFactsOf, listFinishedExports } from './finished';
import { DOWNLOAD_TOKEN_NONCE_BYTES, DOWNLOAD_TOKEN_PATTERN, DownloadTokenRefusal, issueDownloadToken, readDownloadToken, type DownloadMac } from './download-token';
import { coreExportDirectory, type ExportItemFacts } from './host';
import { exportIdOfJob, exportJobIdOf } from './jobs';
import { ExportFailureCode } from './package-export';

/** The download route as the router holds it. Registry-external, like the media route (ruling D178). */
export const EXPORT_DOWNLOAD_ROUTE_URL = EVIDENCE_EXPORT_DOWNLOAD_URL;
/** `details.operationId` of the rows of this file: the registry operation whose rule the download route gets. */
export const EXPORT_JOB_OPERATION = 'getEvidenceExportJob';
export const EXPORT_REQUEST_OPERATION = 'exportEvidence';
export const EXPORT_DENIED_UNIT = 'evidenceExport.denied';
/** `details.reason` of the refusal of operation 42 for an item with a sealed package while no export jobs are composed. */
export const EXPORT_JOBS_NOT_AVAILABLE_REASON = ExportFailureCode.EXPORT_JOBS_NOT_AVAILABLE;
/** The lifetime of a download path: the media session's setting (ruling D178). */
export const EXPORT_DOWNLOAD_TTL_MS = EVIDENCE_MEDIA_SESSION_TTL_MS;
export const EXPORT_ARCHIVE_MEDIA_TYPE = 'application/zip';

const SOURCE = 'evidenceExport';
const JOB_NOT_FOUND_TEXT = 'No export job has this ID.';
const DOWNLOAD_NOT_FOUND_TEXT = 'No finished export is available for download.';
const NOT_PERMITTED_TEXT = 'Your role does not allow this action. The attempt was audited.';
const DOWNLOAD_REFUSED_TEXT = 'This download link cannot be used. Open the export again.';
const STORE_NOT_READY_TEXT = 'The server cannot open a download yet. Try again shortly.';
/** The text of the refusal of an export output this Core cannot produce (fix wave J; the contract's example text). */
export const COMPOSITE_UNAVAILABLE_TEXT = 'Composite video is not available in this build.';
const JOBS_NOT_AVAILABLE_TEXT = 'This server cannot export this evidence item: its export jobs are not available.';
const DENIED = 'Export refused';
/** The form the contract gives a signature and a hash in a job answer. */
const SIGNATURE_FORM = /^(?:[0-9a-f]{64}|[0-9a-f]{128})$/;
const HASH_FORM = /^[0-9a-f]{64}$/;

type Operator = Extract<Principal, { kind: 'OPERATOR' }>;

/** The file name a browser saves a download under: a fixed pattern over an export ID. */
export function downloadFileNameOf(exportId: string): string {
  return `DEMS-export-${exportId}.zip`;
}

/** What the service is handed beside the app (a test replaces members). */
export interface ExportServiceParts {
  /** The MAC of the signing key, or null while the Core has no credential store. */
  mac(): DownloadMac | null;
  /** Eight random bytes. */
  nonce(): Uint8Array;
  /** The folder of a session's sealed package. */
  packageDirOf(sessionId: string): string;
  /** Fix wave J: whether this Core can produce a COMPOSITE - an encoder is selected (`composite.ts`: none in this build). */
  compositeAvailable(): boolean;
}

export interface ExportService {
  /**
   * Operation 42, before the hosted action. Resolves with `job: true` when the item's export is a
   * job of this Core (the request is then committed DEFERRED), `job: false` for every other item.
   * Refuses - audited where it is a refusal of access - and then nothing was changed.
   */
  admitRequest(request: FastifyRequest, evidenceId: string, kind?: 'PACKAGE' | 'COMPOSITE'): Promise<{ readonly job: boolean }>;
  /**
   * Fix wave J (truth rule 3d; findings JA2-03 / JW-03): the export outputs of operation 42 and whether this
   * Core can produce each, as operation 40 states them (`exportKinds`).
   */
  kinds(): { kind: 'PACKAGE' | 'COMPOSITE'; available: boolean; reason?: string }[];
  /** Whether a COMPOSITE can be produced by this Core. */
  compositeAvailable(): boolean;
  /** Operation 87. */
  job(request: FastifyRequest, jobId: string): Promise<EvidenceExportJobBody>;
  /** `GET /exports/:token`. */
  download(request: FastifyRequest, reply: FastifyReply): Promise<FastifyReply>;
  /**
   * G94-05 (wave H C1): the finished exports of an item whose sealed package lies in this Core's
   * store, newest first, as its `export/` folder holds them - for operation 40. Reads the folder;
   * decides nothing about access (the caller lists them only for an operator who may export).
   */
  finished(item: { readonly evidenceId: string; readonly sessionId: string }): Promise<EvidenceFinishedExport[]>;
}

const controls = new WeakMap<object, { parts: Partial<ExportServiceParts> }>();

/** A TEST puts its own parts in the place of the app's. No production file calls it. */
export function replaceExportServicePartsForTest(app: { readonly stages: object }, parts: Partial<ExportServiceParts>): void {
  const known = controls.get(app.stages) ?? { parts: {} };
  known.parts = { ...known.parts, ...parts };
  controls.set(app.stages, known);
}

export function createExportService(app: FastifyInstance): ExportService {
  const directory = coreExportDirectory(app);
  const own: ExportServiceParts = {
    mac: () => mediaSessionMacOf(app),
    nonce: () => randomBytes(DOWNLOAD_TOKEN_NONCE_BYTES),
    packageDirOf: (sessionId) => sessionPackageDir(app.config.mediaStoreDir, sessionId),
    compositeAvailable: () => selectedCompositeEncoder() !== null,
  };
  const parts = (): ExportServiceParts => ({ ...own, ...controls.get(app.stages)?.parts });

  const append = (label: string, entry: AuditEntry): Promise<unknown> => app.pipeline.run(label, async (unit) => void (await unit.audit.append(entry)));

  /** An audited refusal: the denial budget first, then ONE `ACCESS_DENIED` row, committed before the answer. */
  async function refuse(request: FastifyRequest, principal: Operator, operationId: string, why: { readonly reason: string; readonly evidenceId?: string }): Promise<never> {
    await app.denialBudget.consume(request);
    const named = { operationId, permission: Permission.EVIDENCE_EXPORT, role: principal.role, reason: why.reason };
    await append(EXPORT_DENIED_UNIT, {
      type: AuditType.ACCESS_DENIED,
      severity: Severity.WARNING,
      message: `Access denied: ${why.reason} (${operationId})`,
      actorId: principal.operatorId,
      deviceId: principal.deviceId,
      ...(why.evidenceId === undefined ? {} : { evidenceId: why.evidenceId }),
      details: named,
    });
    request.log.warn({ code: ApiErrorCode.NOT_PERMITTED, source: SOURCE, operationId, principal: principalReference(principal), refusedBy: why.reason, audited: true }, DENIED);
    throw new ApiFailure(403, ApiErrorCode.NOT_PERMITTED, why.reason === DownloadTokenRefusal.INVALID ? DOWNLOAD_REFUSED_TEXT : NOT_PERMITTED_TEXT, { details: named });
  }

  /** The case scope of REAL evidence: the ONE predicate of `src/media-stream`. */
  async function holdScope(request: FastifyRequest, principal: Operator, operationId: string, item: ExportItemFacts): Promise<void> {
    if (!item.real || holdsCase(principal, item)) return;
    await refuse(request, principal, operationId, { reason: EVIDENCE_CASE_SCOPE_REASON, evidenceId: item.evidenceId });
  }

  const jobNotFound = (): ApiFailure => new ApiFailure(404, ApiErrorCode.NOT_FOUND, JOB_NOT_FOUND_TEXT, { details: { simCode: 'NOT_FOUND' } });
  const downloadNotFound = (): ApiFailure => new ApiFailure(404, ApiErrorCode.NOT_FOUND, DOWNLOAD_NOT_FOUND_TEXT, { details: { simCode: 'NOT_FOUND' } });
  const storeNotReady = (): ApiFailure => new ApiFailure(503, ApiErrorCode.NOT_READY, STORE_NOT_READY_TEXT, { details: { reason: CaptureDiscoveryReason.CREDENTIAL_STORE_NOT_READY } });

  /** The signed download member of a COMPLETE job, for THIS caller's sign-in session; nothing when no key store is there. */
  function downloadOf(principal: Operator, exportId: string, evidenceId: string): { readonly download: { readonly path: string; readonly expiresAt: number } } | Record<string, never> {
    const mac = parts().mac();
    if (mac === null) return {};
    const expiresAt = app.clock.now() + EXPORT_DOWNLOAD_TTL_MS;
    const token = issueDownloadToken({ exportId, evidenceId, expiresAt }, { operatorId: principal.operatorId, sessionId: principal.sessionId }, parts().nonce(), mac);
    return { download: { path: `${EVIDENCE_EXPORT_DOWNLOAD_ROUTE_PREFIX}/${token}`, expiresAt } };
  }

  return {
    kinds: () => exportKindsOf(parts().compositeAvailable()),
    compositeAvailable: () => parts().compositeAvailable(),

    async admitRequest(request, evidenceId, kind = 'PACKAGE') {
      const item = directory.itemOf(evidenceId);
      // An unknown item: the hosted action decides (404).
      if (item === null) return { job: false };
      const principal = request.principal;
      if (item.sealedHere) {
        if (principal.kind !== 'OPERATOR') throw notSignedIn();
        await holdScope(request, principal, EXPORT_REQUEST_OPERATION, item);
      }
      // Fix wave J (truth rule 3d; findings JA2-03 / JW-03). An output this Core cannot produce is REFUSED here - after
      // the refusals of access, before the ticket, the hosted action and any job: no export id, no request row, no event,
      // nothing in the activity lists. Until wave J a real-capture Core accepted it (an export id, an `EVIDENCE_EXPORTED`
      // row, "Evidence exported" in Storage) and its job then FAILED; a Core in simulated capture delivered "Package".
      if (kind === 'COMPOSITE' && !parts().compositeAvailable()) {
        throw new ApiFailure(409, ApiErrorCode.COMMAND_UNSUPPORTED, COMPOSITE_UNAVAILABLE_TEXT, { details: { simCode: 'COMMAND_UNSUPPORTED', reason: ExportFailureCode.COMPOSITE_ENCODER_NOT_SELECTED } });
      }
      // Every item without a sealed package here: the hosted action decides (409, 422, 202).
      if (!item.sealedHere) return { job: false };
      if (evidenceExport(app).current() === null) {
        // R93-01: never the simulated export for an item whose package lies in this store.
        request.log.error({ code: EXPORT_JOBS_NOT_AVAILABLE_REASON, source: SOURCE, evidenceId }, 'an export of a sealed package was asked for and no export jobs are composed');
        app.errorLog.append({ level: 'error', source: `${SOURCE}.admitRequest`, message: 'an export of a sealed package was asked for and no export jobs are composed', code: EXPORT_JOBS_NOT_AVAILABLE_REASON, context: { requestId: request.id, evidenceId } });
        throw new ApiFailure(503, ApiErrorCode.NOT_READY, JOBS_NOT_AVAILABLE_TEXT, { details: { reason: EXPORT_JOBS_NOT_AVAILABLE_REASON } });
      }
      return { job: true };
    },

    async job(request, jobId) {
      const principal = request.principal;
      if (principal.kind !== 'OPERATOR') throw notSignedIn();
      const exportId = exportIdOfJob(jobId);
      const runtime = evidenceExport(app).current();
      const real = await (runtime?.job(jobId) ?? null);
      // R93-11: the committed request, from the stored rows when the ring does not hold it. Needed only where the jobs hold no record.
      const made = real !== null || exportId === null ? null : await directory.findRequest(exportId, request);
      const evidenceId = real?.evidenceId ?? made?.evidenceId ?? null;
      if (evidenceId === null) throw jobNotFound();
      const item = directory.itemOf(evidenceId);
      if (item !== null) await holdScope(request, principal, EXPORT_JOB_OPERATION, item);

      if (real !== null) {
        return real.status === 'COMPLETE' && exportId !== null ? { ...real, ...downloadOf(principal, exportId, real.evidenceId) } : real;
      }
      if (made === null) throw jobNotFound();
      if (item === null || item.sealedHere) {
        // R93-01: an item with a sealed package here has no simulated export. No job record: FAILED, with a code.
        return {
          jobId,
          evidenceId: made.evidenceId,
          kind: made.kind ?? 'PACKAGE',
          status: 'FAILED',
          progressPct: 0,
          etaMs: 0,
          derived: made.kind === 'COMPOSITE',
          createdAt: made.at,
          completedAt: null,
          failureReason: (await directory.findFailure(jobId, request)) ?? (runtime === null ? ExportFailureCode.EXPORT_JOBS_NOT_AVAILABLE : ExportFailureCode.EXPORT_INTERRUPTED),
        };
      }
      // The simulator's export of an item without a package here: complete inside its request,
      // and COMPLETE only when the item's custody chain says so.
      const seal = directory.sealOf(made.evidenceId);
      if (!item.exportedAt(made.at)) {
        return { jobId, evidenceId: made.evidenceId, kind: 'PACKAGE', status: 'FAILED', progressPct: 0, etaMs: 0, derived: false, createdAt: made.at, completedAt: null, failureReason: ExportFailureCode.EXPORT_FAILED };
      }
      return {
        jobId,
        evidenceId: made.evidenceId,
        kind: 'PACKAGE',
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

    async download(request, reply) {
      if (request.principal.kind !== 'OPERATOR') throw notSignedIn();
      const principal: Operator = request.principal;
      const mac = parts().mac();
      if (mac === null) throw storeNotReady();

      const params: unknown = request.params;
      const token: unknown = typeof params === 'object' && params !== null && 'token' in params ? params.token : undefined;
      const reading =
        typeof token === 'string' && DOWNLOAD_TOKEN_PATTERN.test(token)
          ? readDownloadToken(token, { operatorId: principal.operatorId, sessionId: principal.sessionId }, app.clock.now(), mac)
          : ({ ok: false, refusal: DownloadTokenRefusal.INVALID } as const);
      if (!reading.ok) {
        if (reading.refusal === DownloadTokenRefusal.EXPIRED) {
          throw new ApiFailure(403, ApiErrorCode.NOT_PERMITTED, DOWNLOAD_REFUSED_TEXT, { details: { operationId: EXPORT_JOB_OPERATION, reason: DownloadTokenRefusal.EXPIRED } });
        }
        return refuse(request, principal, EXPORT_JOB_OPERATION, { reason: DownloadTokenRefusal.INVALID });
      }
      const { exportId, evidenceId } = reading.claims;

      // The role is read from the database for THIS request (stage 4); stage 6 has applied the
      // rule already, and a permission taken away since the path was issued is gone here too.
      if (!principal.permissions.includes(Permission.EVIDENCE_EXPORT)) return refuse(request, principal, EXPORT_JOB_OPERATION, { reason: Permission.EVIDENCE_EXPORT, evidenceId });
      const item = directory.itemOf(evidenceId);
      if (item === null || !item.sealedHere) throw downloadNotFound();
      await holdScope(request, principal, EXPORT_JOB_OPERATION, item);

      // Only a job the export jobs call COMPLETE is handed out (the signature file is its mark).
      const jobId = exportJobIdOf(exportId);
      const job = await (evidenceExport(app).current()?.job(jobId) ?? null);
      if (job === null || job.status !== 'COMPLETE' || job.evidenceId !== evidenceId) throw downloadNotFound();

      // The path is built from the session ID of the engine's item and the export ID of the
      // verified token: no value of the request is a path. A link in the archive's place is not followed.
      const file = `${parts().packageDirOf(item.sessionId)}${sep}${exportArchivePath(exportId).split('/').join(sep)}`;
      let bytes: number;
      try {
        const facts = await lstat(file);
        if (!facts.isFile()) throw downloadNotFound();
        bytes = facts.size;
      } catch (error) {
        if (error instanceof ApiFailure) throw error;
        throw downloadNotFound();
      }

      // Ruling D200: the archive carries its export manifest inside and cannot contain its own hash -
      // the row of the download states the hash of the file that is handed out (remembered per file).
      const archive = await archiveFactsOf(file, { hash: true });
      if (archive === null || archive.bytes !== bytes) throw downloadNotFound();

      // The record BEFORE the first byte: a download the trail does not know of does not happen.
      await exportDoorsOf(app.engine).noteEvidenceExportDownload({ evidenceId, jobId, operatorId: principal.operatorId, deviceId: principal.deviceId, bytes, ...(archive.sha256 === undefined ? {} : { archiveSha256: archive.sha256 }) });
      request.log.info({ code: 'EXPORT_DOWNLOADED', source: SOURCE, evidenceId, jobId, bytes }, 'Export archive downloaded');

      void reply.code(200);
      void reply.headers({
        'content-type': EXPORT_ARCHIVE_MEDIA_TYPE,
        'content-length': String(bytes),
        'content-disposition': `attachment; filename="${downloadFileNameOf(exportId)}"`,
      });
      return reply.send(createReadStream(file, { start: 0, end: Math.max(0, bytes - 1) }));
    },

    finished: (item) => listFinishedExports(parts().packageDirOf(item.sessionId), item.evidenceId),
  };
}
