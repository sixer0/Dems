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
 *   provideCoreEvidenceExport(app, w)
 *                              THE COMPOSITION (fix pass F-M8; review finding R93-01, ruling D178):
 *                              called ONCE by the sealing composition of a REAL capture operation
 *                              (`sealing-host`), which knows the Core's evidence signer. It builds
 *                              the wiring from the app (the item lookup, the package folder, the
 *                              one fragment opener, the composite gate), PROVIDES the export jobs,
 *                              and registers the boot sweep of interrupted exports (R93-04,
 *                              `boot-sweep.ts`). In capture operation SIMULATED it is never
 *                              called: no export job exists there, and an item with a sealed
 *                              package in the store is then refused by operation 42, by name.
 *
 * THE REQUEST ROW AND THE FAILURE ROW ARE READ FROM THE STORED ROWS (closing pass F-X; review
 * finding R93-11, second half). The engine's audit ring holds the newest 1000 rows and starts
 * again from them at every start of the Core, so it is only a SHORT CUT: `findRequest` and
 * `findFailure` look into it first (a row it holds is the row the database holds - a unit of work
 * commits before the ring gets its rows) and, when it has none, read the database through the
 * app's read door (`app.db.read`, `stored-trail.ts`): the `exports` row joined with its
 * `EVIDENCE_EXPORTED` audit row for a request, the newest `EVIDENCE_EXPORT_FAILED` row for a
 * failure. The answer of a job is therefore the same whatever the ring holds and after any
 * restart. A stored read that FAILS is the database's failure: the door logs and persists it and
 * the caller answers 503 `NOT_READY` - never "no such export".
 * `requestOf` / `failureOf` are the ring alone (synchronous); nothing that answers a caller uses them.
 */
import type { FragmentOpener } from '@dems/shared/evidence-verify';
import { AuditType, type AuditRow, type EvidenceItem } from '@dems/shared/sim';
import type { FastifyInstance } from 'fastify';
import type { Pool } from 'pg';
import type { LoadedSigner } from '../capture';
import type { AuditEntry } from '../core';
import { exportDoorsOf } from '../engine';
import { coreFragmentOpener, hasSealedPackageHere, sessionPackageDir, type RealEvidenceItem } from '../evidence-verify';
import { createTranscriptStore } from '../modules/transcripts';
import type { ReadContext } from '../plugins/db';
import { sweepExportPartials } from './boot-sweep';
import { selectedCompositeEncoder, type CompositeEncoder } from './composite';
import { evidenceExport } from './control';
import { createEvidenceExportRuntime, exportJobIdOf, type EvidenceExportHost, type ExportRequestRecord } from './jobs';
import { ExportFailureCode, ExportKind } from './package-export';
import { readStoredExportFailure, readStoredExportRequest } from './stored-trail';

/** What operation 87 needs to know of an export whatever the item is. */
export interface ExportDirectory {
  /** The request row of that export ID when the RING still holds it. A short cut: `findRequest` is the answer. */
  requestOf(exportId: string): ExportRequestRecord | null;
  /**
   * R93-11: the committed request of that export ID - the ring's row, else the STORED rows (the
   * `exports` row with its `EVIDENCE_EXPORTED` audit row). Null: no export has the ID. Rejects
   * 503 `NOT_READY` when the stored rows could not be read (logged and persisted by the read door).
   */
  findRequest(exportId: string, context?: ReadContext): Promise<ExportRequestRecord | null>;
  /** R93-11: the reason of the newest `EVIDENCE_EXPORT_FAILED` row of that job - the ring's, else the STORED row. Null: the job has none. */
  findFailure(jobId: string, context?: ReadContext): Promise<string | null>;
  /** The sealed manifest hash and signature of an item, as the engine's state holds them. */
  sealOf(evidenceId: string): { readonly manifestHash: string; readonly signatureValue: string } | null;
  /** The reason of the `EVIDENCE_EXPORT_FAILED` row of that job when the RING still holds it. A short cut: `findFailure` is the answer. */
  failureOf(jobId: string): string | null;
  /** What operations 42 and 87 and the download route need to know of an item before they act. Null: no such item. */
  itemOf(evidenceId: string): ExportItemFacts | null;
}

/** An item as the export routes judge it. */
export interface ExportItemFacts {
  readonly evidenceId: string;
  readonly sessionId: string;
  /** A sealed v2 package lies in THIS Core's store (a REAL seal, or a seed-sealed demo item): its export is a job, never the simulator's. */
  readonly sealedHere: boolean;
  /** `integritySource === 'REAL'`: the case scope of SEC35-16 applies. */
  readonly real: boolean;
  /** The operator who holds the case. */
  readonly investigatorId: string;
  /** True when the item's custody chain holds an `EXPORTED` entry of that instant (the simulator completes inside its request). */
  exportedAt(at: number): boolean;
}

/** The part of the app the directory reads. */
export interface ExportDirectoryApp {
  readonly engine: { state(): { readonly audit: { readonly rows: readonly AuditRow[] }; readonly evidence: readonly EvidenceItem[] } };
  /**
   * The read door of the runtime pool (`plugins/db`): where the stored rows of an export are read.
   * The app always has it. A double of a unit test may leave it out: then the ring alone answers.
   */
  readonly db?: { read<T>(source: string, work: (pool: Pool) => Promise<T>, context?: ReadContext): Promise<T> };
}

/** `source` of a failed stored read in the log and the persistent error log. */
export const EXPORT_REQUEST_READ_SOURCE = 'evidenceExport.storedRequest';
export const EXPORT_FAILURE_READ_SOURCE = 'evidenceExport.storedFailure';

const text = (value: unknown): string | null => (typeof value === 'string' ? value : null);

export function coreExportDirectory(app: ExportDirectoryApp): ExportDirectory {
  const directory: ExportDirectory = {
    async findRequest(exportId, context) {
      const recent = directory.requestOf(exportId);
      if (recent !== null || app.db === undefined) return recent;
      return app.db.read(EXPORT_REQUEST_READ_SOURCE, (pool) => readStoredExportRequest(pool, exportId), context);
    },
    async findFailure(jobId, context) {
      const recent = directory.failureOf(jobId);
      if (recent !== null || app.db === undefined) return recent;
      return app.db.read(EXPORT_FAILURE_READ_SOURCE, (pool) => readStoredExportFailure(pool, jobId), context);
    },
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
    failureOf(jobId) {
      const rows = app.engine.state().audit.rows;
      for (let index = rows.length - 1; index >= 0; index -= 1) {
        const row = rows[index];
        if (row === undefined || row.type !== AuditType.EVIDENCE_EXPORT_FAILED || row.details['jobId'] !== jobId) continue;
        return text(row.details['reason']);
      }
      return null;
    },
    itemOf(evidenceId) {
      const item = app.engine.state().evidence.find((candidate) => candidate.id === evidenceId);
      if (item === undefined) return null;
      const custody = Array.isArray(item.custody) ? item.custody : [];
      return {
        evidenceId: item.id,
        sessionId: item.sessionId,
        sealedHere: typeof item.signature === 'object' && item.signature !== null && hasSealedPackageHere(item as Parameters<typeof hasSealedPackageHere>[0]),
        real: item.integritySource === 'REAL',
        investigatorId: typeof item.investigatorId === 'string' ? item.investigatorId : '',
        exportedAt: (at) => custody.some((entry) => entry.action === 'EXPORTED' && entry.at === at),
      };
    },
  };
  return directory;
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

export function coreExportHost(app: ExportHostApp & { readonly engine: FastifyInstance['engine'] }, wiring: CoreExportWiring): EvidenceExportHost {
  const directory = coreExportDirectory(app);
  return {
    // R93-03: the item is marked EXPORTED, with its custody entry, when the job has completed.
    completeExport: async (completion) => void (await exportDoorsOf(app.engine).completeEvidenceExport(completion)),
    // R93-11: both from the stored rows when the ring does not hold them.
    failureOf: (jobId) => directory.findFailure(jobId),
    now: () => app.clock.now(),
    findItem: (evidenceId) => wiring.findItem(evidenceId),
    packageDirOf: (sessionId) => wiring.packageDirOf(sessionId),
    requestOf: (exportId) => directory.findRequest(exportId),
    ports: () => ({ opener: wiring.opener(), signer: wiring.signer(), trustedCertificateSha256: wiring.trustedCertificateSha256(), composite: wiring.composite() }),
    recordFailure: async (failure) => {
      await app.pipeline.run(EXPORT_FAILED_UNIT_LABEL, async (unit) => {
        await unit.audit.append(exportFailedEntry(failure));
      });
    },
    reportError: (entry) => app.errorLog.append({ level: 'error', source: entry.source, message: entry.message, code: entry.code, context: entry.context }),
  };
}

// ── The composition (fix pass F-M8) ──────────────────────────────────────────────────────────────

/** The boot step that removes the partial artefacts of interrupted exports. Registered after the engine's. */
export const EXPORT_SWEEP_BOOT_STEP = 'evidenceExport.sweepPartials';
const SWEEP_SOURCE = 'evidence-export.bootSweep';

/** What only the sealing composition holds: the Core's evidence signer (loaded when first read; it may throw). */
export interface CoreExportComposition {
  signer(): LoadedSigner;
}

/**
 * THE BOOT SWEEP on the app (R93-04): removes every `.partial` export artefact under every package
 * folder of the media store, and records each interrupted export ONCE as
 * `EVIDENCE_EXPORT_FAILED { reason: EXPORT_INTERRUPTED }` (the partial is gone afterwards, so the
 * next start finds nothing to record). Never rejects: what it could not do goes to the persistent
 * error log, and the boot goes on.
 */
export async function sweepInterruptedExports(app: ExportHostApp & { readonly config: { readonly mediaStoreDir: string } }): Promise<{ readonly removed: number; readonly recorded: number }> {
  let recorded = 0;
  try {
    const swept = await sweepExportPartials(app.config.mediaStoreDir);
    for (const entry of swept.skipped) {
      app.errorLog.append({ level: 'error', source: SWEEP_SOURCE, message: 'an entry of an export folder was not swept', code: entry.reason, context: { sessionId: entry.sessionId ?? '', entry: entry.entry } });
    }
    const directory = coreExportDirectory(app);
    const seen = new Set<string>();
    for (const partial of swept.removed) {
      if (partial.exportId === null || seen.has(partial.exportId)) continue;
      seen.add(partial.exportId);
      const item = app.engine.state().evidence.find((candidate) => candidate.sessionId === partial.sessionId);
      // R93-11: the request of an interrupted export may be older than the ring - the stored rows say whose it was.
      let request: ExportRequestRecord | null = null;
      try {
        request = await directory.findRequest(partial.exportId);
      } catch {
        // The read door has logged the database's failure; the failure row is still written, without the operator.
        app.errorLog.append({ level: 'error', source: SWEEP_SOURCE, message: 'the request of an interrupted export could not be read', code: 'EXPORT_REQUEST_NOT_READ', context: { sessionId: partial.sessionId, exportId: partial.exportId } });
      }
      const composite = swept.removed.some((other) => other.exportId === partial.exportId && other.composite);
      const jobId = exportJobIdOf(partial.exportId);
      if (item === undefined) {
        app.errorLog.append({ level: 'error', source: SWEEP_SOURCE, message: 'an interrupted export was removed and its evidence item is not known', code: 'EXPORT_INTERRUPTED_ITEM_UNKNOWN', context: { sessionId: partial.sessionId, jobId } });
        continue;
      }
      try {
        await app.pipeline.run(EXPORT_FAILED_UNIT_LABEL, async (unit) => {
          await unit.audit.append(
            exportFailedEntry({ jobId, evidenceId: item.id, kind: composite ? ExportKind.COMPOSITE : (request?.kind ?? ExportKind.PACKAGE), reason: ExportFailureCode.EXPORT_INTERRUPTED, operatorId: request?.operatorId ?? null }),
          );
        });
        recorded += 1;
      } catch {
        app.errorLog.append({ level: 'error', source: SWEEP_SOURCE, message: 'the audit row of an interrupted export could not be written', code: 'EXPORT_FAILURE_NOT_AUDITED', context: { jobId, evidenceId: item.id } });
      }
    }
    return { removed: swept.removed.length, recorded };
  } catch {
    app.errorLog.append({ level: 'error', source: SWEEP_SOURCE, message: 'the export folders could not be swept for interrupted exports', code: 'EXPORT_SWEEP_FAILED', context: {} });
    return { removed: 0, recorded };
  }
}

/**
 * Provides the export jobs of real packages to the app and registers the boot sweep. Called ONCE,
 * by the sealing composition of a real capture operation (one line there). Builds nothing that
 * opens a file, a key or a connection before the first job runs.
 */
export function provideCoreEvidenceExport(app: FastifyInstance, composition: CoreExportComposition): void {
  const mediaStoreDir = app.config.mediaStoreDir;
  const signer = (): LoadedSigner | null => {
    try {
      return composition.signer();
    } catch {
      // No usable signing key: a job then fails `SIGNER_UNAVAILABLE`, and no certificate is trusted.
      return null;
    }
  };
  const opener = coreFragmentOpener(app);
  const wiring: CoreExportWiring = {
    findItem: async (evidenceId) => {
      const item = app.engine.state().evidence.find((entry) => entry.id === evidenceId);
      if (item === undefined || !hasSealedPackageHere(item as Parameters<typeof hasSealedPackageHere>[0])) return null;
      const transcriptSha256 = item.transcriptSha256 ?? null;
      const revisionCount = transcriptSha256 === null ? 0 : (await createTranscriptStore(app.db.pool).revisionHead(evidenceId)).revisionNo;
      return { evidenceId, sessionId: item.sessionId, manifestSha256: item.manifestHash, transcriptSha256, revisionCount };
    },
    packageDirOf: (sessionId) => sessionPackageDir(mediaStoreDir, sessionId),
    signer,
    trustedCertificateSha256: () => {
      const loaded = signer();
      return loaded === null ? [] : [loaded.certificate.sha256];
    },
    opener: () => opener,
    composite: () => selectedCompositeEncoder(),
  };
  const runtime = createEvidenceExportRuntime(coreExportHost(app, wiring));
  evidenceExport(app).provide(runtime);
  // G94-12 (wave H C1): a Core that stops does not let an export run on. The job in flight is aborted
  // (its partial artefact is removed by its own failure path), queued jobs end without running, each
  // FAILED `EXPORT_INTERRUPTED`; the close waits until none is left. Never rejects.
  app.addHook('onClose', async () => {
    try {
      await runtime.stop();
    } catch {
      app.errorLog.append({ level: 'error', source: 'evidence-export.stop', message: 'the export jobs could not be stopped at the close of the server', code: 'EXPORT_STOP_FAILED', context: {} });
    }
  });
  app.readiness.addBootStep({
    id: EXPORT_SWEEP_BOOT_STEP,
    run: async () => {
      const swept = await sweepInterruptedExports(app);
      if (swept.removed > 0) app.log.warn({ code: ExportFailureCode.EXPORT_INTERRUPTED, source: SWEEP_SOURCE, removed: swept.removed, recorded: swept.recorded }, 'partial artefacts of interrupted exports were removed');
    },
  });
}
