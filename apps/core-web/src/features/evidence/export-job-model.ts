/**
 * The background export job of operations 42 and 87: the pure rules (blueprint row 92, M8-W3; UX
 * spec flow 5 step 7; API contract C3 §3 op 42, §2.2 op 87; evidence package spec §G; OD-16).
 *
 * | Rule | Where |
 * |------|-------|
 * | Operation 42 answers "queued", never "the file exists": the job is polled to COMPLETE or FAILED | `isTerminalJob` |
 * | A FAILED job is an ANSWER (HTTP 200), drawn with the FAIL wording; it is not an error of the read | `readExportJob` |
 * | Progress is the Core's and only moves forward on screen | `forwardProgress` |
 * | A COMPOSITE is a derived output and is marked so | `ExportJob.derived` |
 *
 * SEAM (request filed, `delegation_progress/file_requests.md`): operation 42 answers an export ID
 * `EXP-NNNNNN`, operation 87 is addressed by a job ID `EXPJ-NNNNNN`, and the contract does not tie
 * them. `exportJobIdOf` is the ONE place: it takes the `jobId` of the 202 when the answer names
 * one, and follows the contract's rule (the same digits) otherwise.
 */
import { exportJobIdOf } from '@dems/shared/api'

export type ExportJobStatus = 'QUEUED' | 'RUNNING' | 'COMPLETE' | 'FAILED'
export type ExportJobKind = 'PACKAGE' | 'COMPOSITE'

export interface ExportJob {
  readonly jobId: string
  readonly evidenceId: string
  readonly kind: ExportJobKind
  readonly status: ExportJobStatus
  /** 0 to 100, as the Core reports it. */
  readonly progressPct: number
  /** True for a COMPOSITE: derived, hashed in the export manifest, never the sealed evidence. */
  readonly derived: boolean
  readonly manifestHash: string | null
  readonly signature: string | null
  /** SCREAMING_SNAKE cause of a FAILED job, or null. */
  readonly failureReason: string | null
  /**
   * Fix F-M8 (R93-05): the Core named a signed download path for this COMPLETE job. Only the FACT
   * is kept: the path is a bearer value and is never part of a job this app holds, caches or logs
   * (`readExportDownload` reads it from a fresh answer, at the press of the control).
   */
  readonly downloadable: boolean
}

/** The download member of a COMPLETE job: a same-origin path of the Core's download route and the instant it dies. */
export interface ExportDownload {
  readonly path: string
  readonly expiresAt: number
}

const DOWNLOAD_PATH = /^\/exports\/exs_[A-Za-z0-9_-]{60,96}$/

/**
 * The download member of an answer of operation 87, or null when it names none (a job that is not
 * COMPLETE, a simulated export, a Core without a key store) or one that is not exactly a path of
 * the download route: no host, no query, no other route is ever taken from an answer.
 */
export function readExportDownload(value: unknown): ExportDownload | null {
  const download = typeof value === 'object' && value !== null ? (value as { status?: unknown; download?: unknown }) : null
  if (download === null || download.status !== 'COMPLETE' || typeof download.download !== 'object' || download.download === null) return null
  const { path, expiresAt } = download.download as { path?: unknown; expiresAt?: unknown }
  return typeof path === 'string' && DOWNLOAD_PATH.test(path) && typeof expiresAt === 'number' && Number.isFinite(expiresAt) ? { path, expiresAt } : null
}

/** The cause of a job the Core's restart interrupted, and of an item this Core cannot export (R93-01, R93-04). */
export const EXPORT_INTERRUPTED = 'EXPORT_INTERRUPTED'
export const EXPORT_JOBS_NOT_AVAILABLE = 'EXPORT_JOBS_NOT_AVAILABLE'

/** The cause of a COMPOSITE job in a build whose encoder is not chosen yet (row 91: the licence decision is open). */
export const COMPOSITE_NOT_SELECTED = 'COMPOSITE_ENCODER_NOT_SELECTED'

/**
 * The reason of an export the Core refused with `409 EXPORT_IN_PROGRESS`: a job of the item is still
 * QUEUED or RUNNING (C3 §3 op 42; mapped by the shared Live source, integration pass D5). The
 * refusal names no job, so the screen says it and draws no job state.
 */
export const EXPORT_IN_PROGRESS = 'EXPORT_IN_PROGRESS'

/** How often a job that is not finished is read again. */
export const EXPORT_JOB_POLL_MS = 2_000

const STATUSES: readonly string[] = ['QUEUED', 'RUNNING', 'COMPLETE', 'FAILED']
const JOB_ID = /^EXPJ-\d{6,}$/

/**
 * The job ID of an accepted export: the ONE rule of the shared contract (`exportJobIdOf`, closing
 * pass F-X; review question 11). The `jobId` the 202 answered wins when it is one.
 */
export { exportJobIdOf }

/** The job ID an accepted export result carries (the Live source adds it from the 202), or null. */
export function answeredJobIdOf(result: unknown): string | null {
  const jobId = (typeof result === 'object' && result !== null ? (result as { jobId?: unknown }).jobId : null)
  return exportJobIdOf('', jobId)
}

/**
 * `archiveOnCore` of the 202 of operation 42 (`contract_wave_k.md` S2 section 3), read BY THAT NAME from
 * the accepted result: `true` an export job of the Core writes an archive, `false` the request was only
 * recorded (a demonstration item, no archive), null: the Core did not say - nothing is then derived.
 */
export function answeredArchiveOnCoreOf(result: unknown): boolean | null {
  const value = typeof result === 'object' && result !== null ? (result as { archiveOnCore?: unknown }).archiveOnCore : null
  return typeof value === 'boolean' ? value : null
}

/** The answer of operation 87, or null when it cannot be read. */
export function readExportJob(value: unknown): ExportJob | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null
  const source = value as Record<string, unknown>
  const { jobId, evidenceId, status, progressPct } = source
  if (typeof jobId !== 'string' || !JOB_ID.test(jobId) || typeof evidenceId !== 'string' || typeof status !== 'string' || !STATUSES.includes(status)) return null
  const kind: ExportJobKind = source.kind === 'COMPOSITE' ? 'COMPOSITE' : 'PACKAGE'
  const hex = (text: unknown, pattern: RegExp): string | null => (typeof text === 'string' && pattern.test(text) ? text : null)
  return {
    jobId,
    evidenceId,
    kind,
    status: status as ExportJobStatus,
    progressPct: typeof progressPct === 'number' && Number.isFinite(progressPct) ? Math.min(100, Math.max(0, Math.floor(progressPct))) : 0,
    // A composite is derived whatever the flag says; a package is derived only when the Core says so.
    derived: kind === 'COMPOSITE' || source.derived === true,
    manifestHash: hex(source.manifestHash, /^[0-9a-f]{64}$/),
    signature: hex(source.signature, /^(?:[0-9a-f]{64}|[0-9a-f]{128})$/),
    failureReason: status === 'FAILED' ? hex(source.failureReason, /^[A-Z][A-Z0-9_]{0,63}$/) : null,
    downloadable: readExportDownload(value) !== null,
  }
}

export function isTerminalJob(job: Pick<ExportJob, 'status'> | null): boolean {
  return job?.status === 'COMPLETE' || job?.status === 'FAILED'
}

/** The percent drawn: the greatest the Core has reported for this job; a FAILED job keeps what was reached. */
export function forwardProgress(shown: number, job: Pick<ExportJob, 'status' | 'progressPct'>): number {
  if (job.status === 'COMPLETE') return 100
  return Math.max(shown, job.progressPct)
}
