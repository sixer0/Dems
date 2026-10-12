import { Alert, Button, Chip, ProgressBar } from '@heroui/react'
import { useQueryClient } from '@tanstack/react-query'
import { Download, RotateCcw } from 'lucide-react'
import { useEffect, useEffectEvent, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Permission } from '@dems/shared/sim'
import { useCoreErrorPresenter } from '@/lib/core-errors'
import { retryCoreQuery, useQueryFailure } from '@/lib/core-queries'
import { deferEffectStart } from '@/lib/effect-start'
import { useWebLive } from '@/runtime'
import { ExportJobReadError, exportJobQueryKey, startExportDownload, useExportJob, type ExportDownloadStart } from './export-job'
import { COMPOSITE_NOT_SELECTED, EXPORT_INTERRUPTED, EXPORT_JOBS_NOT_AVAILABLE, exportJobIdOf, type ExportJobStatus as JobStatus } from './export-job-model'
import { logEvidence } from './log'
import { shortHash } from './model'
import { evidenceMediaQueryKey } from './use-evidence-media'
import { useRetryCooldown } from './use-retry-cooldown'

const STATUS_COLOR = { QUEUED: 'default', RUNNING: 'accent', COMPLETE: 'success', FAILED: 'danger' } as const satisfies Record<JobStatus, 'default' | 'accent' | 'success' | 'danger'>

export interface ExportJobStatusProps {
  /** The export ID of the accepted request (operation 42, `EXP-NNNNNN`). */
  exportId: string
  evidenceId: string
  /** The job the 202 answer named, when it named one. */
  jobId?: string | null
  /** `archiveOnCore` of the accepted request (operation 42); null / absent: the Core did not say. */
  archiveOnCore?: boolean | null
  /** Fix wave J (JW-03): told once when the job reaches its end, so the wizard's last step never reads "Done" for a job that FAILED. */
  onEnd?: (exportId: string, status: 'COMPLETE' | 'FAILED') => void
}

/**
 * The state of one accepted export, read from the Core until the job is finished (blueprint row 92;
 * UX spec flow 5 step 7, §6.5): Queued / Running with the Core's percent, Complete with the hash
 * and the signature of the export manifest, or FAILED with the Core's cause (a failed job is an
 * answer, worded as a FAIL — never as an error of this page).
 *
 * A composite is marked "Derived output — not the sealed evidence"; a composite job that ends
 * `COMPOSITE_ENCODER_NOT_SELECTED` reads "Composite video is not available in this build" (a state
 * of the product, not a fault of the operator).
 *
 * A COMPLETE job the Core names a download for draws "Download export" (fix pass F-M8, R93-05; UX
 * §6.6): the press reads the job once more for a fresh signed path and hands it to the browser
 * (`startExportDownload`); nothing of that path is kept by this component. A COMPLETE job without
 * a download says "The export is stored on the Core" only when the 202 stated `archiveOnCore: true`; an export the Core only recorded
 * (`false`) says a demonstration writes no archive; no statement says no archive is stated. It draws no control.
 */
export function ExportJobStatus({ exportId, evidenceId, jobId: answeredJobId = null, archiveOnCore = null, onEnd }: ExportJobStatusProps) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const presentCoreError = useCoreErrorPresenter()
  const retry = useRetryCooldown()
  const jobId = exportJobIdOf(exportId, answeredJobId)
  const query = useExportJob(jobId)
  const live = useWebLive()
  const downloadRetry = useRetryCooldown()
  const [download, setDownload] = useState<{ readonly busy: boolean; readonly last: ExportDownloadStart | null }>({ busy: false, last: null })

  const startDownload = async () => {
    if (live === null || jobId === null || download.busy) return
    // A press after a failed start is rate-limited (3 s, 6 s, 12 s; three tries).
    if (download.last !== null && download.last !== 'STARTED' && !downloadRetry.consume()) return
    setDownload({ busy: true, last: null })
    const result = await startExportDownload(live, jobId)
    if (result.outcome === 'STARTED') downloadRetry.reset()
    else if (result.failure === null || presentCoreError(result.failure, { permission: Permission.EVIDENCE_EXPORT, afterAcceptedCommand: true }) === null) {
      // Codes only: the path of a download is never part of a record.
      logEvidence('warn', 'export.download', null, { evidenceId, exportId, outcome: result.outcome, status: result.failure?.status ?? null, code: result.failure?.error.code ?? 'NO_DOWNLOAD' })
    }
    setDownload({ busy: false, last: result.outcome })
  }

  useQueryFailure(query, (error) => {
    const read = error instanceof ExportJobReadError ? error : null
    if (read?.unknownJob === true) return
    // The export itself was accepted: the presenter must not say "Nothing was changed."
    if (read?.failure != null && presentCoreError(read.failure, { permission: Permission.EVIDENCE_EXPORT, afterAcceptedCommand: true }) !== null) return
    logEvidence('warn', 'export.job', null, { evidenceId, exportId, status: read?.status ?? null, code: read?.code ?? 'UNKNOWN' })
  })

  const job = query.data ?? null
  // Fix wave L (G94c-02): the finished-exports list of the item's page is part of the ONE answer of operation 40, read
  // when the page opened. When this job reaches its end the item is asked again, once per job and end state, so the
  // page lists the export without a reload ("Status Exported" stood beside "No finished export of this item.").
  const endState = job !== null && (job.status === 'COMPLETE' || job.status === 'FAILED') ? job.status : null
  useEffect(() => {
    if (endState === null) return undefined
    // The start waits one task (the shared helper): StrictMode's simulated unmount cancels the first start.
    return deferEffectStart(() => {
      void queryClient.invalidateQueries({ queryKey: evidenceMediaQueryKey(evidenceId) })
    })
  }, [endState, evidenceId, queryClient])
  const reportEnd = useEffectEvent((status: 'COMPLETE' | 'FAILED') => onEnd?.(exportId, status))
  useEffect(() => {
    if (endState !== null) reportEnd(endState)
  }, [endState])
  const unknown = jobId === null || (query.error instanceof ExportJobReadError && query.error.unknownJob)
  const readFailed = query.isError && !unknown

  return (
    <div className="evi-export-job" data-testid={`export-job-${evidenceId}`} data-status={job?.status ?? (unknown ? 'UNKNOWN' : readFailed ? 'READ_FAILED' : 'WAITING')} data-kind={job?.kind}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="evi-strong">{t('evidence.exportJob.title', { jobId: job?.jobId ?? jobId ?? exportId })}</span>
        {job !== null ? (
          <>
            <Chip size="sm" variant="soft" color={STATUS_COLOR[job.status]} data-testid="export-job-status">
              <Chip.Label>{t(`evidence.exportJob.status.${job.status}`)}</Chip.Label>
            </Chip>
            <span className="evi-caption">{t(`evidence.exportJob.kind.${job.kind}`)}</span>
            {job.derived ? (
              <Chip size="sm" variant="secondary" color="warning" data-testid="export-job-derived">
                <Chip.Label>{t('evidence.exportJob.derived')}</Chip.Label>
              </Chip>
            ) : null}
          </>
        ) : null}
      </div>

      {job === null && !unknown && !readFailed ? (
        <span className="evi-caption" role="status" data-testid="export-job-waiting">
          {t('evidence.exportJob.waiting')}
        </span>
      ) : null}

      {job !== null && (job.status === 'QUEUED' || job.status === 'RUNNING') ? (
        <>
          <ProgressBar aria-label={t('evidence.exportJob.progress', { percent: job.shownPct })} value={job.shownPct} size="sm" data-testid="export-job-progress">
            <ProgressBar.Track>
              <ProgressBar.Fill />
            </ProgressBar.Track>
          </ProgressBar>
          <span className="evi-caption">{t('evidence.exportJob.progress', { percent: job.shownPct })}</span>
        </>
      ) : null}

      {job?.status === 'COMPLETE' ? (
        <dl className="evi-kv evi-kv-compact" data-testid="export-job-complete">
          <div>
            <dt>{t('evidence.exportJob.manifestHash')}</dt>
            <dd className="evi-mono">{job.manifestHash !== null ? shortHash(job.manifestHash, 16) : '—'}</dd>
          </div>
          <div>
            <dt>{t('evidence.exportJob.signature')}</dt>
            <dd className="evi-mono">{job.signature !== null ? shortHash(job.signature, 16) : '—'}</dd>
          </div>
        </dl>
      ) : null}
      {job?.status === 'COMPLETE' && !job.downloadable ? (
        // Fix wave K (G94b-06): the sentence follows the Core's own fact `archiveOnCore` of the 202 -
        // stored on the Core only when the Core said an archive is written; a demonstration writes none.
        <span className="evi-caption" data-testid={archiveOnCore === true ? 'export-job-on-core' : 'export-job-no-archive'} data-archive-on-core={archiveOnCore === null ? 'not-stated' : String(archiveOnCore)}>
          {archiveOnCore === true ? t('evidence.exportJob.onCore', { exportId }) : t(archiveOnCore === false ? 'web.exportJob.noArchive' : 'web.exportJob.archiveNotStated')}
        </span>
      ) : null}
      {job?.status === 'COMPLETE' && job.downloadable ? (
        <div className="flex flex-wrap items-center gap-2" data-testid="export-job-download-row">
          <Button
            size="sm"
            variant="primary"
            isDisabled={download.busy || (download.last !== null && download.last !== 'STARTED' && !downloadRetry.canRetry)}
            isPending={download.busy}
            onPress={() => void startDownload()}
            data-testid="export-job-download"
          >
            <Download className="size-4" aria-hidden="true" />
            {download.busy
              ? t('evidence.exportJob.downloadStarting')
              : download.last !== null && download.last !== 'STARTED' && downloadRetry.exhausted
                ? t('common.errors.maxRetries')
                : download.last !== null && download.last !== 'STARTED' && downloadRetry.cooldownSeconds > 0
                  ? t('common.actions.retryIn', { seconds: downloadRetry.cooldownSeconds })
                  : t('evidence.exportJob.download')}
          </Button>
          {download.last === 'FAILED' || download.last === 'UNAVAILABLE' ? (
            <span className="evi-caption evi-bad" role="alert" data-testid="export-job-download-failed" data-outcome={download.last}>
              {t(download.last === 'FAILED' ? 'evidence.exportJob.downloadFailed' : 'evidence.exportJob.downloadUnavailable')}
            </span>
          ) : null}
        </div>
      ) : null}

      {job?.status === 'FAILED' ? (
        // A composite that cannot be made in this build is a state of the product, not a fault of the operator.
        <Alert status={job.failureReason === COMPOSITE_NOT_SELECTED ? 'warning' : 'danger'} role={job.failureReason === COMPOSITE_NOT_SELECTED ? 'status' : 'alert'} data-testid="export-job-failed" data-reason={job.failureReason ?? undefined}>
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>
              {job.failureReason === COMPOSITE_NOT_SELECTED
                ? t('evidence.exportJob.compositeUnavailable')
                : job.failureReason === EXPORT_INTERRUPTED
                  ? t('evidence.exportJob.failedInterrupted')
                  : job.failureReason === EXPORT_JOBS_NOT_AVAILABLE
                    ? t('evidence.exportJob.failedNotAvailable')
                    : job.failureReason !== null
                  ? t('evidence.exportJob.failed', { reason: job.failureReason })
                  : t('evidence.exportJob.failedNoReason')}
            </Alert.Title>
          </Alert.Content>
        </Alert>
      ) : null}

      {unknown ? (
        <span className="evi-caption evi-bad" role="alert" data-testid="export-job-unknown">
          {t('evidence.exportJob.unknown')}
        </span>
      ) : null}
      {readFailed ? (
        <div className="flex flex-wrap items-center gap-2" role="alert" data-testid="export-job-read-failed">
          <span className="evi-caption evi-bad">{t('evidence.exportJob.pollFailed')}</span>
          <Button
            size="sm"
            variant="outline"
            isDisabled={!retry.canRetry || jobId === null}
            onPress={() => {
              if (jobId !== null && retry.consume()) retryCoreQuery(queryClient, exportJobQueryKey(jobId))
            }}
            data-testid="export-job-retry"
          >
            <RotateCcw className="size-4" aria-hidden="true" />
            {retry.exhausted ? t('common.errors.maxRetries') : retry.cooldownSeconds > 0 ? t('common.actions.retryIn', { seconds: retry.cooldownSeconds }) : t('evidence.exportJob.retry')}
          </Button>
        </div>
      ) : null}
    </div>
  )
}
