/**
 * THE EXPORT JOBS: the background side of operation 42 and what operation 87 polls (blueprint
 * row 91 / M8-W2; C3 §3 operations 42 and 87, §4 `EXPORT_IN_PROGRESS`, §5.2
 * `EVIDENCE_EXPORT_FAILED`; evidence package spec §G; register NM-12, SH-14).
 *
 * WHAT IS A JOB. Operation 42: the hosted action commits the REQUEST - the audit row
 * `EVIDENCE_EXPORTED` and the `exports` row - and answers `202 QUEUED` with the export ID
 * `EXP-NNNNNN`. For an item that has a sealed v2 package in this Core's store the request is
 * DEFERRED (it changes nothing of the item), the route hands it over here, and a job
 * `EXPJ-NNNNNN` (the same six digits) writes the artefact (`package-export.ts`). Every other item
 * is none of this unit's: its export is the simulator's.
 *
 * CUSTODY IS WRITTEN WHEN THE JOB HAS COMPLETED (review finding R93-03, ruling D178): the item's
 * status `EXPORTED` and the custody entry are applied through the host's `completeExport` (the
 * engine's export door) after the archive, its manifest and its signature exist. A job that
 * FAILS leaves the item as it was: its one record is the audit row `EVIDENCE_EXPORT_FAILED`.
 *
 * NO TABLE (the row brief: no migration). What is durable about a job is what exists anyway:
 *
 *   the request     the audit row and the `exports` row the hosted action committed;
 *   COMPLETE        `export/EXP-<id>.manifest.sig` of the package (written last) with its manifest;
 *   FAILED          the audit row `EVIDENCE_EXPORT_FAILED` this unit writes.
 *
 * QUEUED, RUNNING and the percentage live in memory. After a restart a job is answered from what
 * is STORED (review finding R93-11; the host reads the stored rows, not only the audit ring): its
 * request row says that it exists; COMPLETE when its artefact is complete; else FAILED - with the
 * reason of its `EVIDENCE_EXPORT_FAILED` row, or `EXPORT_INTERRUPTED` when it has none (it is not
 * resumed: the request can be made again). Decision D-91-1.
 *
 * THE REQUEST OF A JOB IS READ ONCE, when the route hands the accepted request over (R93-11): the
 * row was committed a moment before, so it is the newest of the trail. The job keeps it; a busy
 * trail (playback writes a row per answered range) cannot move it out of reach before the job runs.
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
import { EXPORT_ID_PATTERN, EXPORT_JOB_ID_PATTERN, exportJobIdOf as contractJobIdOf, type EvidenceExportJobBody } from '@dems/shared/api';
import type { RealEvidenceItem } from '../evidence-verify';
import { archiveFactsOf, archiveFileOf, completedOnDisk, rememberArchive } from './finished';
import { ExportFailure, ExportFailureCode, ExportKind, exportPackage, type ExportOutcome, type ExportPorts } from './package-export';

/** `EXPJ-NNNNNN` of `EXP-NNNNNN`: the same digits (the rule the simulator applies in reverse). */
export function exportJobIdOf(exportId: string): string {
  // The rule itself is the contract's (`exportJobIdOf` of `@dems/shared/api`); here an ID of another form is a defect.
  const jobId = contractJobIdOf(exportId);
  if (jobId === null) throw new Error('not an export ID');
  return jobId;
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
  /**
   * The committed request of that export ID, or null when no export has it. R93-11: the host
   * answers from the STORED rows, so the answer does not depend on how busy the trail was or on a
   * restart. May reject when the stored rows cannot be read (the host has logged it).
   */
  requestOf(exportId: string): ExportRequestRecord | null | Promise<ExportRequestRecord | null>;
  /** Read when a job starts: the opener, the signer, the trusted certificates, the composite encoder. */
  ports(): ExportPorts;
  /** Commits the audit row `EVIDENCE_EXPORT_FAILED`. Rejects when it could not. */
  recordFailure(failure: { readonly jobId: string; readonly evidenceId: string; readonly kind: ExportKind; readonly reason: string; readonly operatorId: string | null }): Promise<void>;
  /**
   * R93-03: marks the item EXPORTED with its custody entry, now that the artefact exists (the
   * engine's export door). Rejects when it could not.
   */
  completeExport(completion: { readonly evidenceId: string; readonly exportId: string; readonly operatorId: string | null; readonly destination: string }): Promise<void>;
  /** R93-11: the reason of the STORED `EVIDENCE_EXPORT_FAILED` row of that job, or null when it has none. May reject like `requestOf`. */
  failureOf?(jobId: string): string | null | Promise<string | null>;
  /** The persistent error log: a fixed source, a code and IDs. */
  reportError(entry: { readonly source: string; readonly code: string; readonly message: string; readonly context: Readonly<Record<string, string>> }): void;
  /** Runs `work` off the request that queued it. Default: `setImmediate`. */
  defer?(work: () => void): void;
}

export interface ExportTicket {
  /**
   * The hosted action accepted the request: queues the job when the item is a real v2 package.
   * Never rejects. `deferred: true` says the request was committed WITHOUT its completion: when no
   * job can be queued for it, the request is recorded as FAILED (`EXPORT_NOT_QUEUED`) so that it
   * never stays open without an end.
   */
  accepted(request: { readonly exportId: string; readonly kind: ExportKind; readonly deferred?: boolean }): Promise<'QUEUED' | 'NOT_A_REAL_PACKAGE'>;
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
  /**
   * G94-12 (wave H C1): the Core is stopping. The job that runs is ABORTED (its failure path removes
   * its partial artefact at once) and every job still queued ends without running; each ends FAILED
   * `EXPORT_INTERRUPTED` with its row (or, when the trail takes no row any more, its entry in the
   * persistent error log). Resolves when no job is left. A job is never resumed: the request can be made again.
   */
  stop(): Promise<void>;
}

interface Job {
  readonly jobId: string;
  readonly exportId: string;
  readonly evidenceId: string;
  readonly kind: ExportKind;
  readonly createdAt: number;
  /** The committed request, read when the job was queued (R93-11). */
  readonly request: ExportRequestRecord | null;
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
    ...(job.outcome === null ? {} : { manifestHash: job.outcome.manifestSha256, signature: job.outcome.signature, archive: { bytes: job.outcome.archive.bytes, sha256: job.outcome.archive.sha256 } }),
    derived: job.kind === ExportKind.COMPOSITE,
    createdAt: job.createdAt,
    completedAt: job.completedAt,
    ...(job.failureReason === null ? {} : { failureReason: job.failureReason }),
  };
}

export function createEvidenceExportRuntime(host: EvidenceExportHost): EvidenceExportRuntime {
  const jobs = new Map<string, Job>();
  /** Items with a request between its ticket and its hand-over. */
  const reserved = new Set<string>();
  let queue: Promise<void> = Promise.resolve();
  /** G94-12: aborted when the Core stops; the run in flight sees it before its next piece. */
  const stopping = new AbortController();
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
    if (stopping.signal.aborted) {
      // G94-12: queued behind a job the stop interrupted. Nothing was written for it.
      await fail(job, ExportFailureCode.EXPORT_INTERRUPTED, job.request?.operatorId ?? null);
      return;
    }
    job.status = 'RUNNING';
    let request = job.request;
    if (request === null) {
      try {
        request = await host.requestOf(job.exportId);
      } catch {
        host.reportError({ source: `${SOURCE}.run`, code: 'EXPORT_REQUEST_NOT_READ', message: 'the request of an export job could not be read', context: { jobId: job.jobId, evidenceId: job.evidenceId } });
      }
    }
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
        { ...host.ports(), signal: stopping.signal },
        (percent) => {
          if (percent > job.progressPct) job.progressPct = Math.min(99, percent);
        },
      );
      // R93-03: the artefact exists; only now is the item marked EXPORTED with its custody entry.
      // The job is not COMPLETE to a poller before that record is committed.
      try {
        await host.completeExport({ evidenceId: job.evidenceId, exportId: job.exportId, operatorId: request.operatorId, destination: request.destination });
      } catch {
        // The archive, its manifest and its signature are there and stay; what is missing is the
        // custody entry. It is said in the persistent error log - the job is not reported FAILED
        // for an export that exists.
        host.reportError({ source: `${SOURCE}.completeExport`, code: 'EXPORT_COMPLETION_NOT_RECORDED', message: 'a completed export could not be recorded on its evidence item', context: { jobId: job.jobId, evidenceId: job.evidenceId } });
      }
      await rememberArchive(archiveFileOf(host.packageDirOf(item.sessionId), job.exportId), outcome.archive);
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

  const idle = async (): Promise<void> => {
    let seen: Promise<void> | null = null;
    while (seen !== queue) {
      seen = queue;
      await seen;
    }
  };

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
            let made: ExportRequestRecord | null = null;
            try {
              made = await host.requestOf(request.exportId);
            } catch {
              // The job reads it again when it runs; a request that stays unread fails there, with its row.
              host.reportError({ source: `${SOURCE}.accepted`, code: 'EXPORT_REQUEST_NOT_READ', message: 'the request of an accepted export could not be read', context: { evidenceId, exportId: request.exportId } });
            }
            const base = { jobId: exportJobIdOf(request.exportId), exportId: request.exportId, evidenceId, kind: request.kind, createdAt: made?.at ?? host.now(), request: made, progressPct: 0, completedAt: null, outcome: null, failureReason: null } as const;
            let item: RealEvidenceItem | null = null;
            let lookupFailed = false;
            try {
              item = await host.findItem(evidenceId);
            } catch {
              lookupFailed = true;
            }
            if (item === null) {
              if (request.deferred === true) {
                // A deferred request with no job would stay open for ever: it ends here, FAILED, with its row.
                const dead: Job = { ...base, status: 'QUEUED' };
                jobs.set(dead.jobId, dead);
                await fail(dead, ExportFailureCode.EXPORT_NOT_QUEUED, made?.operatorId ?? null);
              } else if (lookupFailed) {
                host.reportError({ source: `${SOURCE}.accepted`, code: 'EXPORT_JOB_NOT_QUEUED', message: 'an accepted export request could not be queued', context: { evidenceId, exportId: request.exportId } });
              }
              return 'NOT_A_REAL_PACKAGE';
            }
            const queuedItem = item;
            const job: Job = { ...base, status: 'QUEUED' };
            jobs.set(job.jobId, job);
            queue = queue.then(
              () =>
                new Promise<void>((resolve) => {
                  defer(() => {
                    run(job, queuedItem)
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
      // R93-11: the request and the failure reason are the host's STORED rows. A read that fails
      // rejects (503 at the route): "the trail cannot be read" is never answered as "no such job".
      const request = await host.requestOf(exportId);
      if (request === null) return null;
      const item = await host.findItem(request.evidenceId);
      if (item === null) return null;
      // A job of an earlier run of the server: what the package folder says.
      const packageDir = host.packageDirOf(item.sessionId);
      const done = await completedOnDisk(packageDir, exportId, item.evidenceId);
      // Ruling D200: the archive's hash is stated by the job answer. Computed from the file (and remembered) when this run did not write it.
      const archive = done === null ? null : await archiveFactsOf(archiveFileOf(packageDir, exportId), { hash: true });
      const kind = done === null ? (request.kind ?? ExportKind.PACKAGE) : done.derived ? ExportKind.COMPOSITE : ExportKind.PACKAGE;
      const failureReason = done === null ? ((await host.failureOf?.(jobId)) ?? ExportFailureCode.EXPORT_INTERRUPTED) : null;
      return {
        jobId,
        evidenceId: item.evidenceId,
        kind,
        status: done === null ? 'FAILED' : 'COMPLETE',
        progressPct: done === null ? 0 : 100,
        etaMs: 0,
        ...(done === null ? {} : { manifestHash: done.manifestSha256, signature: done.signature }),
        ...(archive === null || archive.sha256 === undefined ? {} : { archive: { bytes: archive.bytes, sha256: archive.sha256 } }),
        derived: kind === ExportKind.COMPOSITE,
        createdAt: request.at,
        completedAt: done === null ? null : done.exportedAt,
        ...(failureReason === null ? {} : { failureReason }),
      };
    },

    idle,

    async stop() {
      stopping.abort();
      await idle();
    },
  };
}
