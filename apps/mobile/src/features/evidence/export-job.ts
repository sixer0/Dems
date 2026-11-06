/**
 * Reading the background export job (operation 87) until it is finished (blueprint row 92, M8-W3;
 * UX spec flow 5 step 7; API contract C3 §3 op 42, §2.2 op 87; OD-16; the client contract of row 91).
 *
 * | Rule | How |
 * |------|-----|
 * | The ONE way to call an operation that is no simulator action | `useMobileLive()?.client.call('getEvidenceExportJob', …)` |
 * | Polled by the query client, no timer of this screen | `refetchInterval`: every `EXPORT_JOB_POLL_MS` while the job is QUEUED or RUNNING; it stops at COMPLETE, at FAILED and at a failed read |
 * | A FAILED job is an answer (HTTP 200) | It is the query's DATA, drawn with the FAIL wording; only a read that got no job is the query's error |
 * | Progress only moves forward on screen | `shownPct` keeps the greatest percent the Core reported for the job |
 * | A failed read | Is not repeated by itself (the sheet offers "Read again"); one record with its status and code goes to the persistent runtime log |
 *
 * LIVE only: outside Live mode the export completes inside the request that queued it.
 */
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { operatorScope, useOperatorId } from '@/lib/operator-query-scope';
import { reportRuntimeIssue, useMobileLive } from '@/runtime';
import { EXPORT_JOB_POLL_MS, forwardProgress, isTerminalJob, readExportJob, type ExportJob } from './export-job-model';

export interface PolledExportJob extends ExportJob {
  /** The percent drawn: never below what was drawn before for this job. */
  readonly shownPct: number;
}

/** A read that got no job: the status and the code of the Core's envelope. */
export class ExportJobReadError extends Error {
  override readonly name = 'ExportJobReadError';
  readonly status: number | null;
  readonly code: string;
  /** `404`: the Core has no job with this ID. */
  readonly unknownJob: boolean;
  constructor(status: number | null, code: string) {
    super('The export job could not be read.');
    this.status = status;
    this.code = code;
    this.unknownJob = status === 404;
  }
}

/** The job's key ends with the operator (fix wave K, G81b-02): operation 87 answers by the caller's role (its `download` member). */
export const exportJobQueryKey = (jobId: string, operatorId: string | null = null) => ['core-server', 'evidence-export-job', jobId, operatorScope(operatorId)] as const;

/** The job `jobId`, read again while it is not finished. `jobId: null` asks nothing. */
export function useExportJob(jobId: string | null, pollMs: number = EXPORT_JOB_POLL_MS) {
  const live = useMobileLive();
  const queryClient = useQueryClient();
  const operatorId = useOperatorId();
  const queryKey = exportJobQueryKey(jobId ?? 'none', operatorId);
  return useQuery<PolledExportJob, ExportJobReadError>({
    queryKey,
    enabled: live !== null && jobId !== null,
    retry: false,
    refetchInterval: (query) => (query.state.status === 'error' || isTerminalJob(query.state.data ?? null) ? false : pollMs),
    queryFn: async () => {
      if (live === null || jobId === null) throw new ExportJobReadError(null, 'NO_LIVE_SOURCE');
      const answer = await live.client.call('getEvidenceExportJob', { params: { id: jobId } });
      if (!answer.ok) {
        if (answer.status !== 404) reportRuntimeIssue('warn', 'evidence.export.job', `getEvidenceExportJob -> ${answer.error.code}`, { jobId, status: answer.status, code: answer.error.code });
        throw new ExportJobReadError(answer.status, answer.error.code);
      }
      const job = readExportJob(answer.data);
      if (job === null) {
        reportRuntimeIssue('warn', 'evidence.export.job', 'getEvidenceExportJob -> an answer that is no job', { jobId });
        throw new ExportJobReadError(answer.status, 'ANSWER_UNREADABLE');
      }
      const previous = queryClient.getQueryData<PolledExportJob>(queryKey);
      return { ...job, shownPct: forwardProgress(previous?.shownPct ?? 0, job) };
    },
  });
}
