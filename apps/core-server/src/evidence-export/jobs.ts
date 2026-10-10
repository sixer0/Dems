/**
 * THE EXPORT JOBS: the background side of operation 42 and what operation 87 polls (blueprint
 * row 91 / M8-W2; C3 §3 operations 42 and 87, §4 `EXPORT_IN_PROGRESS`, §5.2
 * `EVIDENCE_EXPORT_FAILED`; evidence package spec §G; register NM-12, SH-14).
 *
 * WHAT IS A JOB. Operation 42 stays what it was: the hosted action commits the REQUEST - the audit
 * row `EVIDENCE_EXPORTED`, the `exports` row, the custody entry - and answers `202 QUEUED` with the
 * export ID `EXP-NNNNNN`. For an item that has a real sealed v2 package the route then hands the
 * accepted request over here, and a job `EXPJ-NNNNNN` (the same six digits) writes the artefact
 * (`package-export.ts`). Every other item is none of this unit's: its export is the simulator's.
 *
 * NO TABLE (the row brief: no migration). What is durable about a job is what exists anyway:
 *
 *   the request     the audit row and the `exports` row the hosted action committed;
 *   COMPLETE        `export/EXP-<id>.manifest.sig` of the package (written last) with its manifest;
 *   FAILED          the audit row `EVIDENCE_EXPORT_FAILED` this unit writes.
 *
 * QUEUED, RUNNING and the percentage live in memory. After a restart a job whose artefact is not
 * complete is answered FAILED with `EXPORT_INTERRUPTED` (it is not resumed: the request can be
 * made again). Decision D-91-1.
 *
 * ONE JOB AT A TIME on the whole Core (a serial queue: an export reads and decrypts whole
 * recordings), and at most one unfinished job per evidence item: a second request for that item
 * is refused `409 EXPORT_IN_PROGRESS` BEFORE the hosted action runs. The route takes a ticket
 * first (`begin`), so two requests cannot both pass the check.
 *
 * A FAILED JOB writes `EVIDENCE_EXPORT_FAILED { jobId, kind, reason }` through the host and
 * removes its partial artefact. When that audit row cannot be written the failure is put into the
 * persistent error log through the host and the job stays FAILED: nothing is retried in a loop.
 *
 * Nothing of a request's text, no path and no key material is in a job's answer, a log entry or a
 * thrown error: codes, IDs and counts only.
 */
import { EXPORT_ID_PATTERN, EXPORT_JOB_ID_PATTERN, type EvidenceExportJobBody } from '@dems/shared/api';
import { readFile } from 'node:fs/promises';
import { sep } from 'node:path';
import type { RealEvidenceItem } from '../evidence-verify';
import { computeExportManifestSha256, parseExportManifest, parseExportSignature } from './export-manifest';
import { ExportFailure, ExportFailureCode, ExportKind, exportManifestPathOf, exportPackage, exportSignaturePathOf, type ExportOutcome, type ExportPorts } from './package-export';

/** `EXPJ-NNNNNN` of `EXP-NNNNNN`: the same digits (the rule the simulator applies in reverse). */
export function exportJobIdOf(exportId: string): string {
  if (!EXPORT_ID_PATTERN.test(exportId)) throw new Error('not an export ID');
  return `EXPJ-${exportId.slice('EXP-'.length)}`;
}

/** `EXP-NNNNNN` of `EXPJ-NNNNNN`, or null for a job ID no export has (more than six digits that are not zeros). */
export function exportIdOfJob(jobId: string): string | null {
  if (!EXPORT_JOB_ID_PATTERN.test(jobId)) return null;
  const digits = jobId.slice('EXPJ-'.length);
  const head = digits.slice(0, -6);
  return /^0*$/.test(head) ? `EXP-${digits.slice(-6)}` : null;
}

/** The committed request of operation 42, as the audit trail holds it. */
export interface ExportRequestRecord {
  readonly exportId: string;
  readonly evidenceId: string;
  /** The ID of the `EVIDENCE_EXPORTED` row: the authorisation reference of the export. */
  readonly auditId: string;
  readonly at: number;
  readonly operatorId: string;
  readonly destination: string;
  readonly reason: string;
  /** `details.kind` of the row when it carries one. */
  readonly kind: ExportKind | null;
}

/** What the jobs need of the Core. A test hands in doubles; `host.ts` hands in the app's own. */
export interface EvidenceExportHost {
  now(): number;
  /** The item of that ID when it has a real sealed v2 package, else null. */
  findItem(evidenceId: string): RealEvidenceItem | null | Promise<RealEvidenceItem | null>;
  /** The folder of a session's package. */
  packageDirOf(sessionId: string): string;
  /** The committed request row of that export ID, or null. */
  requestOf(exportId: string): ExportRequestRecord | null;
  /** Read when a job starts: the opener, the signer, the trusted certificates, the composite encoder. */
  ports(): ExportPorts;
  /** Commits the audit row `EVIDENCE_EXPORT_FAILED`. Rejects when it could not. */
  recordFailure(failure: { readonly jobId: string; readonly evidenceId: string; readonly kind: ExportKind; readonly reason: string; readonly operatorId: string | null }): Promise<void>;
  /** The persistent error log: a fixed source, a code and IDs. */
  reportError(entry: { readonly source: string; readonly code: string; readonly message: string; readonly context: Readonly<Record<string, string>> }): void;
  /** Runs `work` off the request that queued it. Default: `setImmediate`. */
  defer?(work: () => void): void;
}

export interface ExportTicket {
  /** The hosted action accepted the request: queues the job when the item is a real v2 package. Never rejects. */
  accepted(request: { readonly exportId: string; readonly kind: ExportKind }): Promise<'QUEUED' | 'NOT_A_REAL_PACKAGE'>;
  /** The request was refused or failed: the item is free again. */
  cancel(): void;
}

export interface EvidenceExportRuntime {
  /** A ticket for one request on that item, or null while a job of the item is unfinished (409). */
  begin(evidenceId: string): ExportTicket | null;
  inProgress(evidenceId: string): boolean;
  /** The job of that ID as operation 87 answers it; null when the ID belongs to no export of a real package. */
  job(jobId: string): Promise<EvidenceExportJobBody | null>;
  /** Resolves when no job is queued or running (tests, shutdown). */
  idle(): Promise<void>;
}

interface Job {
  readonly jobId: string;
  readonly exportId: string;
  readonly evidenceId: string;
  readonly kind: ExportKind;
  readonly createdAt: number;
  status: EvidenceExportJobBody['status'];
  progressPct: number;
  completedAt: number | null;
  outcome: ExportOutcome | null;
  failureReason: string | null;
}

const SOURCE = 'evidence-export.jobs';

function bodyOf(job: Job): EvidenceExportJobBody {
  const done = job.status === 'COMPLETE' || job.status === 'FAILED';
  return {
    jobId: job.jobId,
    evidenceId: job.evidenceId,
    kind: job.kind,
    status: job.status,
    progressPct: job.progressPct,
    // No estimate is made: a figure nobody measured is not answered.
    etaMs: done ? 0 : null,
    ...(job.outcome === null ? {} : { manifestHash: job.outcome.manifestSha256, signature: job.outcome.signature }),
    derived: job.kind === ExportKind.COMPOSITE,
    createdAt: job.createdAt,
    completedAt: job.completedAt,
    ...(job.failureReason === null ? {} : { failureReason: job.failureReason }),
  };
}

/** What `export/EXP-<id>.manifest.{json,sig}` of a package say of a finished export, or null. */
async function completedOnDisk(packageDir: string, exportId: string, evidenceId: string): Promise<{ manifestSha256: string; signature: string; derived: boolean; exportedAt: number } | null> {
  const place = (relative: string): string => `${packageDir}${sep}${relative.split('/').join(sep)}`;
  try {
    const manifest = parseExportManifest(await readFile(place(exportManifestPathOf(exportId)), 'utf8'));
    const signature = parseExportSignature(await readFile(place(exportSignaturePathOf(exportId)), 'utf8'));
    if (manifest.export.exportId !== exportId || manifest.source.evidenceId !== evidenceId) return null;
    if (computeExportManifestSha256(manifest) !== manifest.export.manifestSha256 || signature.signedDigest !== manifest.export.manifestSha256) return null;
    return { manifestSha256: manifest.export.manifestSha256, signature: signature.signature, derived: manifest.export.derived, exportedAt: manifest.export.exportedAt };
  } catch {
    return null;
  }
}

export function createEvidenceExportRuntime(host: EvidenceExportHost): EvidenceExportRuntime {
  const jobs = new Map<string, Job>();
  /** Items with a request between its ticket and its hand-over. */
  const reserved = new Set<string>();
  let queue: Promise<void> = Promise.resolve();
  const defer = host.defer ?? ((work: () => void): void => void setImmediate(work));

  const unfinished = (evidenceId: string): boolean => [...jobs.values()].some((job) => job.evidenceId === evidenceId && (job.status === 'QUEUED' || job.status === 'RUNNING'));
  const inProgress = (evidenceId: string): boolean => reserved.has(evidenceId) || unfinished(evidenceId);

  async function fail(job: Job, reason: string, operatorId: string | null): Promise<void> {
    job.status = 'FAILED';
    job.failureReason = reason;
    job.completedAt = host.now();
    try {
      await host.recordFailure({ jobId: job.jobId, evidenceId: job.evidenceId, kind: job.kind, reason, operatorId });
    } catch {
      // The failure row could not be committed: the persistent error log is the record that is left.
      host.reportError({ source: `${SOURCE}.recordFailure`, code: 'EXPORT_FAILURE_NOT_AUDITED', message: 'the audit row of a failed export job could not be written', context: { jobId: job.jobId, evidenceId: job.evidenceId, reason } });
    }
  }

  async function run(job: Job, item: RealEvidenceItem): Promise<void> {
    job.status = 'RUNNING';
    const request = host.requestOf(job.exportId);
    if (request === null || request.evidenceId !== job.evidenceId) {
      await fail(job, ExportFailureCode.EXPORT_REQUEST_NOT_FOUND, null);
      return;
    }
    try {
      const outcome = await exportPackage(
        host.packageDirOf(item.sessionId),
        item,
        {
          exportId: job.exportId,
          kind: job.kind,
          exportedAt: host.now(),
          exportedBy: request.operatorId,
          authorizationRef: request.auditId,
          destination: request.destination,
          purpose: request.reason,
        },
        host.ports(),
        (percent) => {
          if (percent > job.progressPct) job.progressPct = Math.min(99, percent);
        },
      );
      job.outcome = outcome;
      job.progressPct = 100;
      job.completedAt = host.now();
      job.status = 'COMPLETE';
    } catch (error) {
      const failure = error instanceof ExportFailure ? error : new ExportFailure(ExportFailureCode.EXPORT_FAILED);
      if (failure.code === ExportFailureCode.EXPORT_FAILED || failure.code === ExportFailureCode.EXPORT_WRITE_FAILED || failure.code === ExportFailureCode.SECRET_SHAPE_FOUND) {
        host.reportError({
          source: `${SOURCE}.run`,
          code: failure.code,
          message: 'an export job failed',
          context: { jobId: job.jobId, evidenceId: job.evidenceId, ...(failure.findings.length === 0 ? {} : { findings: failure.findings.map((finding) => `${finding.file}:${finding.form}`).join(',') }) },
        });
      }
      await fail(job, failure.code, request.operatorId);
    }
  }

  return {
    inProgress,

    begin(evidenceId) {
      if (inProgress(evidenceId)) return null;
      reserved.add(evidenceId);
      let open = true;
      const release = (): void => {
        if (open) reserved.delete(evidenceId);
        open = false;
      };
      return {
        cancel: release,
        async accepted(request) {
          try {
            if (!open || !EXPORT_ID_PATTERN.test(request.exportId)) return 'NOT_A_REAL_PACKAGE';
            const item = await host.findItem(evidenceId);
            if (item === null) return 'NOT_A_REAL_PACKAGE';
            const job: Job = {
              jobId: exportJobIdOf(request.exportId),
              exportId: request.exportId,
              evidenceId,
              kind: request.kind,
              createdAt: host.requestOf(request.exportId)?.at ?? host.now(),
              status: 'QUEUED',
              progressPct: 0,
              completedAt: null,
              outcome: null,
              failureReason: null,
            };
            jobs.set(job.jobId, job);
            queue = queue.then(
              () =>
                new Promise<void>((resolve) => {
                  defer(() => {
                    run(job, item)
                      .catch(() => {
                        // `run` handles its own failures; this is a defect of this file.
                        job.status = 'FAILED';
                        job.failureReason = ExportFailureCode.EXPORT_FAILED;
                        host.reportError({ source: `${SOURCE}.queue`, code: 'EXPORT_JOB_DEFECT', message: 'an export job ended outside its own failure path', context: { jobId: job.jobId, evidenceId } });
                      })
                      .finally(resolve);
                  });
                }),
            );
            return 'QUEUED';
          } catch {
            host.reportError({ source: `${SOURCE}.accepted`, code: 'EXPORT_JOB_NOT_QUEUED', message: 'an accepted export request could not be queued', context: { evidenceId, exportId: request.exportId } });
            return 'NOT_A_REAL_PACKAGE';
          } finally {
            // From here on the job itself (if any) holds the item.
            release();
          }
        },
      };
    },

    async job(jobId) {
      const known = jobs.get(jobId);
      if (known !== undefined) return bodyOf(known);
      const exportId = exportIdOfJob(jobId);
      if (exportId === null) return null;
      const request = host.requestOf(exportId);
      if (request === null) return null;
      const item = await host.findItem(request.evidenceId);
      if (item === null) return null;
      // A job of an earlier run of the server: what the package folder says.
      const done = await completedOnDisk(host.packageDirOf(item.sessionId), exportId, item.evidenceId);
      const kind = done === null ? (request.kind ?? ExportKind.PACKAGE) : done.derived ? ExportKind.COMPOSITE : ExportKind.PACKAGE;
      return {
        jobId,
        evidenceId: item.evidenceId,
        kind,
        status: done === null ? 'FAILED' : 'COMPLETE',
        progressPct: done === null ? 0 : 100,
        etaMs: 0,
        ...(done === null ? {} : { manifestHash: done.manifestSha256, signature: done.signature }),
        derived: kind === ExportKind.COMPOSITE,
        createdAt: request.at,
        completedAt: done === null ? null : done.exportedAt,
        ...(done === null ? { failureReason: ExportFailureCode.EXPORT_INTERRUPTED } : {}),
      };
    },

    idle: async () => {
      let seen: Promise<void> | null = null;
      while (seen !== queue) {
        seen = queue;
        await seen;
      }
    },
  };
}
