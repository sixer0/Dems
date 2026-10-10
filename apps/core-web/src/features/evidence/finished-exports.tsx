import { useState } from 'react'
import { Button, Card } from '@heroui/react'
import { Download, PackageCheck } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { formatUtcOffset } from '@dems/shared/realtime'
import { Permission } from '@dems/shared/sim'
import { useCoreErrorPresenter } from '@/lib/core-errors'
import { useWebLive } from '@/runtime'
import { startExportDownload, type ExportDownloadStart } from './export-job'
import type { DetailFacts, FinishedExport } from './item-facts'
import { logEvidence } from './log'
import { formatWibDateTime } from './model'
import { useRetryCooldown } from './use-retry-cooldown'

export interface FinishedExportsProps {
  evidenceId: string
  /** What operation 40 stated for this item and this operator; null: no answer. */
  facts: DetailFacts | null
}

/**
 * The finished exports of an item on its page (wave H C2; gate finding G94-05; UX spec §6.6): the
 * list the Core reports in operation 40 (`exports`), newest first, each with "Download export".
 *
 * - NOTHING is asked on the page view: the list is part of the one answer of operation 40. The
 *   press reads operation 87 once for a FRESH signed path and hands it to the browser
 *   (`startExportDownload`, the same way the export dialog does). The path is a bearer value: it is
 *   in no state, cache, record or markup of this component.
 * - `access.export === false`: the Core says this operator may not download: the sentence, no control.
 * - No `exports` member: "Finished exports: not reported" - never "none".
 * - LIVE only: in Simulated client mode no Core stores an export.
 */
export function FinishedExports({ evidenceId, facts }: FinishedExportsProps) {
  const { t } = useTranslation()
  const live = useWebLive()
  if (live === null || facts === null) return null
  const denied = facts.access.export === false
  const exports = facts.exports
  return (
    <Card className="evi-tabs-card" data-testid="evidence-exports" data-count={exports?.length ?? undefined}>
      <h3 className="evi-section-title">
        <PackageCheck className="size-4 text-accent" aria-hidden="true" />
        {t('evidence.itemFacts.exports.title')}
      </h3>
      {denied ? (
        <p className="evi-caption" data-testid="evidence-exports-denied">
          {t('evidence.itemFacts.exports.mayNotDownload')}
        </p>
      ) : exports === null ? (
        <p className="evi-caption">{t('evidence.itemFacts.exports.notReported')}</p>
      ) : exports.length === 0 ? (
        <p className="evi-caption">{t('evidence.itemFacts.exports.none')}</p>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {exports.map((entry) => (
            <ExportEntry key={entry.jobId} evidenceId={evidenceId} entry={entry} />
          ))}
        </ul>
      )}
    </Card>
  )
}

function ExportEntry({ evidenceId, entry }: { evidenceId: string; entry: FinishedExport }) {
  const { t } = useTranslation()
  const live = useWebLive()
  const presentCoreError = useCoreErrorPresenter()
  const retry = useRetryCooldown()
  const [state, setState] = useState<{ readonly busy: boolean; readonly last: ExportDownloadStart | null }>({ busy: false, last: null })
  const failed = state.last !== null && state.last !== 'STARTED'

  const start = async () => {
    if (live === null || state.busy) return
    // A press after a failed start is rate-limited (3 s, 6 s, 12 s; three tries).
    if (failed && !retry.consume()) return
    setState({ busy: true, last: null })
    const result = await startExportDownload(live, entry.jobId)
    if (result.outcome === 'STARTED') retry.reset()
    else if (result.failure === null || presentCoreError(result.failure, { permission: Permission.EVIDENCE_EXPORT, afterAcceptedCommand: true }) === null) {
      // Codes only: the path of a download is never part of a record.
      logEvidence('warn', 'export.downloadFinished', null, { evidenceId, exportId: entry.exportId, outcome: result.outcome, status: result.failure?.status ?? null, code: result.failure?.error.code ?? 'NO_DOWNLOAD' })
    }
    setState({ busy: false, last: result.outcome })
  }

  const kind = entry.kind === 'PACKAGE' || entry.kind === 'COMPOSITE' ? t(`evidence.exportJob.kind.${entry.kind}`) : entry.kind
  return (
    <li className="flex flex-wrap items-center gap-2" data-testid={`evidence-export-entry-${entry.jobId}`} data-export-id={entry.exportId}>
      <span className="evi-strong evi-mono">{t('evidence.itemFacts.exports.entry', { exportId: entry.exportId, kind })}</span>
      {entry.completedAt !== null ? <span className="evi-caption">{t('evidence.itemFacts.exports.at', { at: `${formatWibDateTime(entry.completedAt)} UTC${formatUtcOffset()}` })}</span> : null}
      <Button size="sm" variant="outline" className="ml-auto" isPending={state.busy} isDisabled={state.busy || (failed && !retry.canRetry)} onPress={() => void start()} data-testid={`evidence-export-download-${entry.jobId}`}>
        <Download className="size-4" aria-hidden="true" />
        {state.busy
          ? t('evidence.exportJob.downloadStarting')
          : failed && retry.exhausted
            ? t('common.errors.maxRetries')
            : failed && retry.cooldownSeconds > 0
              ? t('common.actions.retryIn', { seconds: retry.cooldownSeconds })
              : t('evidence.exportJob.download')}
      </Button>
      {failed ? (
        <span className="evi-caption evi-bad" role="alert" data-testid={`evidence-export-download-failed-${entry.jobId}`} data-outcome={state.last ?? undefined}>
          {t(state.last === 'FAILED' ? 'evidence.exportJob.downloadFailed' : 'evidence.exportJob.downloadUnavailable')}
        </span>
      ) : null}
    </li>
  )
}
