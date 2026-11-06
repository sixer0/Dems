/**
 * Evidence export (blueprint row 91 / M8-W2; evidence package spec §B.11, §G; C3 §3 operations 42
 * and 87; OD-16; register NM-12, SH-14; SEC35-09).
 *
 *   jobs.ts             the background jobs: queue, one per item, status for operation 87
 *   package-export.ts   one export: verify the source, the archive with the DECRYPTED camera
 *                       files, the export manifest, its signature, the names; cleans up on failure
 *   export-manifest.ts  `dems.export-manifest/2` (the 9 export fields in it), its hash, its signature
 *   zip-store.ts        the archive writer (stored entries, ZIP64)
 *   composite.ts        the composite seam and the LICENCE GATE (no encoder selected: blocked)
 *   secret-sweep.ts     the sweep for credential-shaped values over the artefact
 *   receiver-verify.ts  what a receiver verifies at the destination, without any key of the Core
 *   host.ts             the app's side: the request directory, the failure row, the error log
 *   stored-trail.ts     the STORED rows of an export (R93-11): its request (`exports` with its audit
 *                       row) and its failure row, read from the database - not from the audit ring
 *   control.ts          `evidenceExport(app)`: where the composition hands the jobs in
 *   boot-sweep.ts       the removal of `.partial` artefacts an interrupted export left (R93-04)
 *   download-token.ts   the signed download token of a finished export (`exs_`, R93-05)
 *   service.ts          what operations 42 / 87 and the download route do: the case scope, the
 *                       refusal without export jobs, the job answer, the download
 *
 * CLOSED: imported through this index only. It registers NO ROUTE (routes are registered by
 * modules, so that the permission guard covers them): operation 87 is `modules/evidence-export`,
 * operation 42 stays in `modules/evidence`; both reach this unit through `evidenceExport(app)`.
 */
export { COMPOSITE_ENCODER_GATE, COMPOSITE_LICENCE_RECORD, GPL_ONLY_ENCODERS, compositeEncoderAllowed, exportKindsOf, selectedCompositeEncoder, type CompositeEncoder, type CompositeSource } from './composite';
export {
  COMPOSITE_ENTRY,
  EXPORT_MANIFEST_FILE,
  EXPORT_MANIFEST_SCHEMA_ID,
  EXPORT_SIGNATURE_FILE,
  EXPORT_SIGNATURE_SCHEMA_ID,
  ExportManifestError,
  ExportManifestSchema,
  ExportSignatureSchema,
  buildExportManifest,
  isSelfContainedExport,
  compositeMarkingHolds,
  computeExportManifestSha256,
  parseExportManifest,
  parseExportSignature,
  type ExportManifest,
  type ExportSignature,
} from './export-manifest';
export {
  EXPORT_FAILED_UNIT_LABEL,
  EXPORT_FAILURE_READ_SOURCE,
  EXPORT_REQUEST_READ_SOURCE,
  EXPORT_SWEEP_BOOT_STEP,
  coreExportDirectory,
  coreExportHost,
  exportFailedEntry,
  provideCoreEvidenceExport,
  sweepInterruptedExports,
  type CoreExportComposition,
  type CoreExportWiring,
  type ExportDirectory,
  type ExportDirectoryApp,
  type ExportHostApp,
  type ExportItemFacts,
} from './host';
export { READ_STORED_EXPORT_FAILURE, READ_STORED_EXPORT_REQUEST, readStoredExportFailure, readStoredExportRequest, type ExportTrailQueryable } from './stored-trail';
export { EXPORT_PARTIAL_SUFFIX, sweepExportPartials, type ExportSweepResult, type SweptPartial } from './boot-sweep';
export { createEvidenceExportRuntime, exportIdOfJob, exportJobIdOf, type EvidenceExportHost, type EvidenceExportRuntime, type ExportRequestRecord, type ExportTicket } from './jobs';
export { ExportFailure, ExportFailureCode, ExportKind, exportManifestPathOf, exportPackage, exportSignaturePathOf, type ExportOutcome, type ExportPorts, type ExportRequestFacts } from './package-export';
export {
  DOWNLOAD_TOKEN_MAC_BYTES,
  DOWNLOAD_TOKEN_MAX_CHARS,
  DOWNLOAD_TOKEN_NONCE_BYTES,
  DOWNLOAD_TOKEN_PATTERN,
  DOWNLOAD_TOKEN_VERSION,
  DownloadTokenRefusal,
  issueDownloadToken,
  readDownloadToken,
  type DownloadMac,
  type DownloadTokenClaims,
  type DownloadTokenHolder,
  type DownloadTokenReading,
} from './download-token';
export {
  EXPORT_ARCHIVE_MEDIA_TYPE,
  EXPORT_DENIED_UNIT,
  EXPORT_DOWNLOAD_ROUTE_URL,
  EXPORT_DOWNLOAD_TTL_MS,
  EXPORT_JOBS_NOT_AVAILABLE_REASON,
  EXPORT_JOB_OPERATION,
  EXPORT_REQUEST_OPERATION,
  createExportService,
  downloadFileNameOf,
  replaceExportServicePartsForTest,
  type ExportService,
  type ExportServiceParts,
} from './service';
export { FINISHED_EXPORTS_LISTED, archiveFactsOf, archiveFileOf, completedOnDisk, listFinishedExports, rememberArchive, type CompletedExportFacts } from './finished';
export { RECEIVER_CHECKS, RECEIVER_VERIFY_V2_CHECKS, verifyExportAtDestination, type ReceiverVerifyInput, type ReceiverVerifyResult } from './receiver-verify';
export { SecretForm, secretFormsIn, sweepForSecrets, type SecretFinding } from './secret-sweep';
export { createArchive, isArchiveEntryName, type ArchiveWriter } from './zip-store';

/** `kind` of an export request body: COMPOSITE only when the body says so; PACKAGE otherwise (C3 §3 op 42). */
export function exportKindOfBody(body: unknown): 'PACKAGE' | 'COMPOSITE' {
  return typeof body === 'object' && body !== null && (body as Record<string, unknown>)['kind'] === 'COMPOSITE' ? 'COMPOSITE' : 'PACKAGE';
}

/** The text of `409 EXPORT_IN_PROGRESS` (C3 §4). */
export const EXPORT_IN_PROGRESS_TEXT = 'An export job is already running for this evidence item.';

export { evidenceExport, type EvidenceExportControl } from './control';
