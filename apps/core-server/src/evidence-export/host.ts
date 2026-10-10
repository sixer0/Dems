/**
 * The export jobs on the running Core (blueprint row 91): what the app itself can give them.
 *
 *   coreExportDirectory(app)   the committed REQUEST of an export and the seal of an item, read
 *                              from the engine's committed state (the `audit` and `evidence`
 *                              slices). Always available: operation 87 answers from it for an
 *                              export of an item that is not a real v2 package, exactly as the
 *                              simulator does.
 *   coreExportHost(app, w)     the `EvidenceExportHost` of the jobs: the clock, the directory, the
 *                              failure row through one server-native unit of the pipeline, the
 *                              persistent error log, the fragment opener over the Core credential
 *                              store - and the wiring `w` that only the sealing row can give
 *                              (which items are real packages, where a package lies, the signer).
 *
 * TO WIRE WHEN ROW 82 LANDS (decision D133: this row was built before the product seal exists):
 * one call, where the sealing composition knows the signer and the media store -
 *
 *     evidenceExport(app).provide(createEvidenceExportRuntime(coreExportHost(app, wiring)))
 *
 * Until then no runtime is provided, operation 42 behaves as before this row and operation 87
 * answers from the directory.
 *
 * THE REQUEST ROW is found in the engine's audit ring (the newest 1000 rows), as the simulator
 * finds it. A request older than the ring is not found: the durable `exports` table would answer
 * it, and reading that table is left to the wiring row with the item lookup (one reader of
 * `evidence_items` for both).
 */
import type { FragmentOpener } from '@dems/shared/evidence-verify';
import { AuditType, type AuditRow, type EvidenceItem } from '@dems/shared/sim';
import type { LoadedSigner } from '../capture';
import type { AuditEntry } from '../core';
import type { RealEvidenceItem } from '../evidence-verify';
import type { CompositeEncoder } from './composite';
import type { EvidenceExportHost, ExportRequestRecord } from './jobs';
import { ExportKind } from './package-export';

/** What operation 87 needs to know of an export whatever the item is. */
export interface ExportDirectory {
  requestOf(exportId: string): ExportRequestRecord | null;
  /** The sealed manifest hash and signature of an item, as the engine's state holds them. */
  sealOf(evidenceId: string): { readonly manifestHash: string; readonly signatureValue: string } | null;
}

/** The part of the app the directory reads. */
export interface ExportDirectoryApp {
  readonly engine: { state(): { readonly audit: { readonly rows: readonly AuditRow[] }; readonly evidence: readonly EvidenceItem[] } };
}

const text = (value: unknown): string | null => (typeof value === 'string' ? value : null);

export function coreExportDirectory(app: ExportDirectoryApp): ExportDirectory {
  return {
    requestOf(exportId) {
      const rows = app.engine.state().audit.rows;
      for (let index = rows.length - 1; index >= 0; index -= 1) {
        const row = rows[index];
        if (row === undefined || row.type !== AuditType.EVIDENCE_EXPORTED || row.details['exportId'] !== exportId) continue;
        const destination = text(row.details['destination']);
        const reason = text(row.details['reason']);
        if (row.evidenceId === null || row.evidenceId === undefined || row.actorId === null || destination === null || reason === null) return null;
        const kind = row.details['kind'];
        return {
          exportId,
          evidenceId: row.evidenceId,
          auditId: row.id,
          at: row.at,
          operatorId: row.actorId,
          destination,
          reason,
          kind: kind === ExportKind.PACKAGE || kind === ExportKind.COMPOSITE ? kind : null,
        };
      }
      return null;
    },
    sealOf(evidenceId) {
      const item = app.engine.state().evidence.find((candidate) => candidate.id === evidenceId);
      return item === undefined ? null : { manifestHash: item.manifestHash, signatureValue: item.signature.value };
    },
  };
}

/** What only the sealing composition knows (row 82). */
export interface CoreExportWiring {
  findItem(evidenceId: string): RealEvidenceItem | null | Promise<RealEvidenceItem | null>;
  packageDirOf(sessionId: string): string;
  /** The Core's evidence signer, or null while it cannot sign (then a job fails `SIGNER_UNAVAILABLE`). */
  signer(): LoadedSigner | null;
  trustedCertificateSha256(): readonly string[];
  /** The opener over the Core credential store: `coreFragmentOpener(app)` of the verify unit. */
  opener(): FragmentOpener | null;
  /** `selectedCompositeEncoder()` - null while the licence decision is open. */
  composite(): CompositeEncoder | null;
}

/** The part of the app the host uses. */
export interface ExportHostApp extends ExportDirectoryApp {
  readonly clock: { now(): number };
  readonly pipeline: { run<Value>(label: string, work: (unit: { readonly audit: { append(entry: AuditEntry): Promise<unknown> } }) => Promise<Value>): Promise<Value> };
  readonly errorLog: { append(entry: { level: 'error'; source: string; message: string; code?: string; context?: Readonly<Record<string, string>> }): void };
}

export const EXPORT_FAILED_UNIT_LABEL = 'evidenceExport.failed';

/** The audit row of a failed job: the three detail keys of C3 §5.2 and nothing else. */
export function exportFailedEntry(failure: { readonly jobId: string; readonly evidenceId: string; readonly kind: ExportKind; readonly reason: string; readonly operatorId: string | null }): AuditEntry {
  return {
    type: AuditType.EVIDENCE_EXPORT_FAILED,
    message: `Evidence export failed · ${failure.evidenceId}`,
    severity: 'WARNING',
    actorId: failure.operatorId,
    deviceId: null,
    evidenceId: failure.evidenceId,
    details: { jobId: failure.jobId, kind: failure.kind, reason: failure.reason },
  };
}

export function coreExportHost(app: ExportHostApp, wiring: CoreExportWiring): EvidenceExportHost {
  const directory = coreExportDirectory(app);
  return {
    now: () => app.clock.now(),
    findItem: (evidenceId) => wiring.findItem(evidenceId),
    packageDirOf: (sessionId) => wiring.packageDirOf(sessionId),
    requestOf: (exportId) => directory.requestOf(exportId),
    ports: () => ({ opener: wiring.opener(), signer: wiring.signer(), trustedCertificateSha256: wiring.trustedCertificateSha256(), composite: wiring.composite() }),
    recordFailure: async (failure) => {
      await app.pipeline.run(EXPORT_FAILED_UNIT_LABEL, async (unit) => {
        await unit.audit.append(exportFailedEntry(failure));
      });
    },
    reportError: (entry) => app.errorLog.append({ level: 'error', source: entry.source, message: entry.message, code: entry.code, context: entry.context }),
  };
}
