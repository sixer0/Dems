import { Alert, Button, Chip, ProgressBar } from '@heroui/react'
import { useQueryClient } from '@tanstack/react-query'
import { RotateCcw } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Permission } from '@dems/shared/sim'
import { useCoreErrorPresenter } from '@/lib/core-errors'
import { retryCoreQuery, useQueryFailure } from '@/lib/core-queries'
import { ExportJobReadError, exportJobQueryKey, useExportJob } from './export-job'
import { COMPOSITE_NOT_SELECTED, exportJobIdOf, type ExportJobStatus as JobStatus } from './export-job-model'
import { logEvidence } from './log'
import { shortHash } from './model'
import { useRetryCooldown } from './use-retry-cooldown'

const STATUS_COLOR = { QUEUED: 'default', RUNNING: 'accent', COMPLETE: 'success', FAILED: 'danger' } as const satisfies Record<JobStatus, 'default' | 'accent' | 'success' | 'danger'>

export interface ExportJobStatusProps {
  /** The export ID of the accepted request (operation 42, `EXP-NNNNNN`). */
  exportId: string
  evidenceId: string
  /** The job the 202 answer named, when it named one. */
  jobId?: string | null
}

/**
 * The state of one accepted export, read from the Core until the job is finished (blueprint row 92;
 * UX spec flow 5 step 7, §6.5): Queued / Running with the Core's percent, Complete with the hash
 * and the signature of the export manifest, or FAILED with the Core's cause (a failed job is an
 * answer, worded as a FAIL — never as an error of this page).
 *
 * A composite is marked "Derived output — not the sealed evidence"; a composite job that ends
 * `COMPOSITE_ENCODER_NOT_SELECTED` reads "Composite video is not available in this build" (a state
 * of the product, not a fault of the operator). There is no download operation: the line says "The
 * export is stored on the Core", and no download control is drawn.
 */
export function ExportJobStatus({ exportId, evidenceId, jobId: answeredJobId = null }: ExportJobStatusProps) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const presentCoreError = useCoreErrorPresenter()
  const retry = useRetryCooldown()
  const jobId = exportJobIdOf(exportId, answeredJobId)
  const query = useExportJob(jobId)

  useQueryFailure(query, (error) => {
    const read = error instanceof ExportJobReadError ? error : null
    if (read?.unknownJob === true) return
    // The export itself was accepted: the presenter must not say "Nothing was changed."
    if (read?.failure != null && presentCoreError(read.failure, { permission: Permission.EVIDENCE_EXPORT, afterAcceptedCommand: true }) !== null) return
    logEvidence('warn', 'export.job', null, { evidenceId, exportId, status: read?.status ?? null, code: read?.code ?? 'UNKNOWN' })
  })

  const job = query.data ?? null
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
      {job?.status === 'COMPLETE' ? (
        <span className="evi-caption" data-testid="export-job-on-core">
          {t('evidence.exportJob.onCore', { exportId })}
        </span>
      ) : null}

      {job?.status === 'FAILED' ? (
        // A composite that cannot be made in this build is a state of the product, not a fault of the operator.
        <Alert status={job.failureReason === COMPOSITE_NOT_SELECTED ? 'warning' : 'danger'} role={job.failureReason === COMPOSITE_NOT_SELECTED ? 'status' : 'alert'} data-testid="export-job-failed" data-reason={job.failureReason ?? undefined}>
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>
              {job.failureReason === COMPOSITE_NOT_SELECTED
                ? t('evidence.exportJob.compositeUnavailable')
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
