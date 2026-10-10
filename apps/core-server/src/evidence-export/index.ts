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
 *
 * CLOSED: imported through this index only. It registers NO ROUTE (routes are registered by
 * modules, so that the permission guard covers them): operation 87 is `modules/evidence-export`,
 * operation 42 stays in `modules/evidence`; both reach this unit through `evidenceExport(app)`.
 */
import type { EvidenceExportRuntime } from './jobs';

export { COMPOSITE_ENCODER_GATE, COMPOSITE_LICENCE_RECORD, GPL_ONLY_ENCODERS, compositeEncoderAllowed, selectedCompositeEncoder, type CompositeEncoder, type CompositeSource } from './composite';
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
  compositeMarkingHolds,
  computeExportManifestSha256,
  parseExportManifest,
  parseExportSignature,
  type ExportManifest,
  type ExportSignature,
} from './export-manifest';
export { EXPORT_FAILED_UNIT_LABEL, coreExportDirectory, coreExportHost, exportFailedEntry, type CoreExportWiring, type ExportDirectory, type ExportDirectoryApp, type ExportHostApp } from './host';
export { createEvidenceExportRuntime, exportIdOfJob, exportJobIdOf, type EvidenceExportHost, type EvidenceExportRuntime, type ExportRequestRecord, type ExportTicket } from './jobs';
export { ExportFailure, ExportFailureCode, ExportKind, exportManifestPathOf, exportPackage, exportSignaturePathOf, type ExportOutcome, type ExportPorts, type ExportRequestFacts } from './package-export';
export { RECEIVER_CHECKS, RECEIVER_VERIFY_V2_CHECKS, verifyExportAtDestination, type ReceiverVerifyInput, type ReceiverVerifyResult } from './receiver-verify';
export { SecretForm, secretFormsIn, sweepForSecrets, type SecretFinding } from './secret-sweep';
export { createArchive, isArchiveEntryName, type ArchiveWriter } from './zip-store';

/** `kind` of an export request body: COMPOSITE only when the body says so; PACKAGE otherwise (C3 §3 op 42). */
export function exportKindOfBody(body: unknown): 'PACKAGE' | 'COMPOSITE' {
  return typeof body === 'object' && body !== null && (body as Record<string, unknown>)['kind'] === 'COMPOSITE' ? 'COMPOSITE' : 'PACKAGE';
}

/** The text of `409 EXPORT_IN_PROGRESS` (C3 §4). */
export const EXPORT_IN_PROGRESS_TEXT = 'An export job is already running for this evidence item.';

export interface EvidenceExportControl {
  /** Hands in the export jobs of real packages. Once per app. */
  provide(runtime: EvidenceExportRuntime): void;
  /** What was provided, or null. */
  current(): EvidenceExportRuntime | null;
}

// Keyed by the app's stage registry: one object per app, the same from every scope of it
// (the `sttConfigControl(app)` idiom).
const controls = new WeakMap<object, EvidenceExportControl>();

/** The control of an app. It exists from the first call. */
export function evidenceExport(app: { readonly stages: object }): EvidenceExportControl {
  const known = controls.get(app.stages);
  if (known !== undefined) return known;
  let provided: EvidenceExportRuntime | null = null;
  const control: EvidenceExportControl = {
    provide(runtime) {
      if (provided !== null) throw new Error('the export jobs of real evidence packages were provided twice');
      provided = runtime;
    },
    current: () => provided,
  };
  controls.set(app.stages, control);
  return control;
}
