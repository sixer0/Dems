/**
 * Reading the background export job (operation 87) until it is finished (blueprint row 92, M8-W3;
 * UX spec flow 5 step 7; API contract C3 §3 op 42, §2.2 op 87; OD-16).
 *
 * | Rule | How |
 * |------|-----|
 * | The ONE way to call an operation that is no action | `useWebLive()?.client.call('getEvidenceExportJob', …)` |
 * | Polled by the query client, no timer of this page | `refetchInterval`: every `EXPORT_JOB_POLL_MS` while the job is QUEUED or RUNNING; it stops at COMPLETE, at FAILED and at a failed read |
 * | A FAILED job is an answer (HTTP 200) | It is the query's DATA, drawn with the FAIL wording; only a read that got no job is the query's error |
 * | Progress only moves forward on screen | `shownPct` keeps the greatest percent the Core reported for the job |
 * | Cache contract | Under the Core root `['core', …]`: removed by the query bridge at every session end |
 * | A failed read | Is not repeated by itself; the status line offers a rate-limited "Read again" |
 *
 * LIVE only: in Simulated mode the export completes inside the request that queued it and the
 * wizard keeps its bundled download.
 *
 * THE DOWNLOAD OF A FINISHED EXPORT (fix pass F-M8; review finding R93-05, ruling D178; UX §6.6).
 * A COMPLETE job of a sealed package carries a signed path of the Core's download route. That
 * path is a BEARER value (60 s, bound to this sign-in session), so:
 *
 * | Rule | How |
 * |------|-----|
 * | Never in the query cache, a query key, a state, a log or storage | `readExportJob` keeps only the FACT (`downloadable`); the cached job holds no path |
 * | Asked for at the press, used once | `startExportDownload`: ONE fresh call of operation 87 outside the query client, the path in a local of that call only |
 * | Same origin, straight to disk | A transient `<a href>` on this console's own origin is clicked and removed: the browser streams the attachment to a file (an archive can be many gigabytes - it is never read into memory) and the session cookie travels |
 * | Only a path of the download route | `readExportDownload`: no host, no query, no other route is taken from an answer |
 */
import { useQuery, useQueryClient, type QueryKey } from '@tanstack/react-query'
import { useCoreSignedIn } from '@/lib/core-queries'
import { CORE_QUERY_KEY, useWebLive } from '@/runtime'
import { EXPORT_JOB_POLL_MS, forwardProgress, isTerminalJob, readExportDownload, readExportJob, type ExportJob } from './export-job-model'

/** What this page keeps of a failed call: the Core's envelope. The presenter takes it as it is. */
export interface CoreFailure {
  readonly status: number | null
  readonly error: { readonly code: string }
}

export interface PolledExportJob extends ExportJob {
  /** The percent drawn: never below what was drawn before for this job. */
  readonly shownPct: number
}

/** A read that got no job: the status and the code of the Core's envelope. */
export class ExportJobReadError extends Error {
  override readonly name = 'ExportJobReadError'
  readonly status: number | null
  readonly code: string
  /** `404`: the Core has no job with this ID. */
  readonly unknownJob: boolean
  readonly failure: CoreFailure | null
  constructor(status: number | null, code: string, failure: CoreFailure | null) {
    super('The export job could not be read.')
    this.status = status
    this.code = code
    this.unknownJob = status === 404
    this.failure = failure
  }
}

export const exportJobQueryKey = (jobId: string): QueryKey => [...CORE_QUERY_KEY, 'evidence-export-job', jobId]

/** The job `jobId`, read again while it is not finished. `jobId: null` asks nothing. */
export function useExportJob(jobId: string | null, pollMs: number = EXPORT_JOB_POLL_MS) {
  const live = useWebLive()
  const signedIn = useCoreSignedIn()
  const queryClient = useQueryClient()
  const queryKey = exportJobQueryKey(jobId ?? 'none')
  return useQuery<PolledExportJob, ExportJobReadError>({
    queryKey,
    enabled: live !== null && signedIn && jobId !== null,
    retry: false,
    refetchInterval: (query) => (query.state.status === 'error' || isTerminalJob(query.state.data ?? null) ? false : pollMs),
    queryFn: async () => {
      if (live === null || jobId === null) throw new ExportJobReadError(null, 'NO_LIVE_SOURCE', null)
      const answer = await live.client.call('getEvidenceExportJob', { params: { id: jobId } })
      if (!answer.ok) throw new ExportJobReadError(answer.status, answer.error.code, answer)
      const job = readExportJob(answer.data)
      if (job === null) throw new ExportJobReadError(answer.status, 'ANSWER_UNREADABLE', null)
      const previous = queryClient.getQueryData<PolledExportJob>(queryKey)
      return { ...job, shownPct: forwardProgress(previous?.shownPct ?? 0, job) }
    },
  })
}

export type ExportDownloadStart =
  /** The browser was handed the download. */
  | 'STARTED'
  /** The job names no download right now (not COMPLETE any more for this Core, no key store, a simulated export). */
  | 'UNAVAILABLE'
  /** The job could not be read. `failure`: the Core's envelope, for the presenter. */
  | 'FAILED'

export interface ExportDownloadResult {
  readonly outcome: ExportDownloadStart
  readonly failure: CoreFailure | null
}

/** Hands a same-origin path to the browser as a download. The element lives for one click. */
function followDownloadPath(path: string): void {
  const anchor = document.createElement('a')
  anchor.href = path
  anchor.rel = 'noopener'
  anchor.style.display = 'none'
  document.body.append(anchor)
  try {
    anchor.click()
  } finally {
    anchor.removeAttribute('href')
    anchor.remove()
  }
}

/**
 * Starts the download of a finished export: one fresh read of the job, its signed path handed to
 * the browser, and nothing kept. Never throws; the path is in no return value and no thrown text.
 */
export async function startExportDownload(live: NonNullable<ReturnType<typeof useWebLive>>, jobId: string, follow: (path: string) => void = followDownloadPath): Promise<ExportDownloadResult> {
  const read = async () => live.client.call('getEvidenceExportJob', { params: { id: jobId } })
  let answer: Awaited<ReturnType<typeof read>>
  try {
    answer = await read()
  } catch {
    return { outcome: 'FAILED', failure: null }
  }
  if (!answer.ok) return { outcome: 'FAILED', failure: answer }
  const download = readExportDownload(answer.data)
  if (download === null) return { outcome: 'UNAVAILABLE', failure: null }
  try {
    follow(download.path)
  } catch {
    return { outcome: 'FAILED', failure: null }
  }
  return { outcome: 'STARTED', failure: null }
}
