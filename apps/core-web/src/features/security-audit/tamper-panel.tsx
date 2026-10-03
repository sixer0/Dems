import { memo, useMemo } from 'react'
import { Chip } from '@heroui/react'
import { ShieldAlert } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useSim, type FaultKind } from '@dems/shared/sim'
import { toneChipProps } from '@dems/shared/tokens'
import { cn } from '@/lib/utils'
import { useAuditLog } from './audit-context'
import { Feed, type FeedItem } from './feed'
import { isTamperRow, newestMatching } from './model'
import { Panel } from './panel'
import { packageIntegrity } from './sim-adapter'
import { SEVERITY_TONE, toneClass } from './tones'
import { useNewestArrival, useStableRows } from './use-newest'

const FEED_SIZE = 4

export interface TamperPanelProps {
  chainOk: boolean
  className?: string
}

/**
 * Tamper & integrity (design book §21.3 TamperEvent; EVT-12 enclosure, EVT-13/14 evidence media,
 * EVT-30 audit chain). Three tiles: the enclosure switch, the audit chain (this page's own
 * verification) and the DEMO evidence packages' precomputed verification, labelled
 * "DEMO - precomputed" and joined to the simulator's evidence with the M4 guard (P13). Below,
 * the newest tamper audit rows.
 */
export const TamperPanel = memo(function TamperPanel({ chainOk, className }: TamperPanelProps) {
  const { t } = useTranslation()
  const { rows } = useAuditLog()
  const enclosureOpen = useSim((s) => s.security.tamper)
  const evidence = useSim((s) => s.evidence)
  const integrity = useMemo(() => packageIntegrity(evidence), [evidence])
  const recent = useStableRows(useMemo(() => newestMatching(rows, isTamperRow, FEED_SIZE), [rows]))
  const highlight = useNewestArrival(recent[0]?.id ?? null)

  const items: FeedItem[] = useMemo(() => recent.map((row) => {
    const kind = typeof row.details.kind === 'string' ? (row.details.kind as FaultKind) : null
    return {
      id: row.id,
      at: row.at,
      tone: toneClass(SEVERITY_TONE[row.severity]),
      title: t(`common.auditType.${row.type}`),
      sub: [kind ? t(`common.faultKind.${kind}`) : null, row.evidenceId, row.id].filter(Boolean).join(' • '),
    }
  }), [recent, t])

  return (
    <Panel id="tamper" icon={ShieldAlert} title={t('securityAudit.tamper.title')} className={className}>
      <div className="sa-tiles">
        <div className={cn('sa-kpi', enclosureOpen ? 'sa-tone-warning' : 'sa-tone-success')} data-testid="tamper-enclosure">
          <span className="sa-stat-label">{t('securityAudit.tamper.enclosure')}</span>
          <span className="sa-kpi-value" data-tone>
            {enclosureOpen ? t('securityAudit.tamper.open') : t('securityAudit.tamper.closed')}
          </span>
        </div>
        <div className={cn('sa-kpi', chainOk ? 'sa-tone-success' : 'sa-tone-danger')} data-testid="tamper-chain">
          <span className="sa-stat-label">{t('securityAudit.tamper.chain')}</span>
          <span className="sa-kpi-value" data-tone>
            {chainOk ? t('securityAudit.tamper.intact') : t('securityAudit.tamper.broken')}
          </span>
        </div>
        <div className={cn('sa-kpi', integrity.fail > 0 ? 'sa-tone-danger' : 'sa-tone-success')} data-testid="tamper-packages">
          <span className="sa-stat-label">{t('securityAudit.tamper.packages')}</span>
          <span className="sa-kpi-value" data-tone>
            {t('securityAudit.tamper.packagesSummary', { pass: integrity.pass, fail: integrity.fail })}
          </span>
        </div>
      </div>
      {integrity.failures.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          {integrity.failures.map((failure) => (
            <Chip key={failure.evidenceSuffix} size="sm" variant="soft" {...toneChipProps('danger')}>
              {t('securityAudit.tamper.packageFail', { id: failure.evidenceId, track: failure.failed.join(', ') })}
            </Chip>
          ))}
          <Chip size="sm" variant="soft" color="warning">
            {integrity.label || t('securityAudit.tamper.precomputed')}
          </Chip>
        </div>
      ) : null}
      <Feed
        items={items}
        label={t('securityAudit.tamper.listLabel')}
        empty={t('securityAudit.tamper.empty')}
        highlightId={highlight}
        testId="tamper-feed"
      />
    </Panel>
  )
})
