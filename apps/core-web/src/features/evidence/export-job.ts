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
 */
import { useQuery, useQueryClient, type QueryKey } from '@tanstack/react-query'
import { useCoreSignedIn } from '@/lib/core-queries'
import { CORE_QUERY_KEY, useWebLive } from '@/runtime'
import { EXPORT_JOB_POLL_MS, forwardProgress, isTerminalJob, readExportJob, type ExportJob } from './export-job-model'

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
