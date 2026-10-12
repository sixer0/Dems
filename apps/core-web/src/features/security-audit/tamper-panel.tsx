import { memo, useMemo } from 'react'
import { Chip } from '@heroui/react'
import { ShieldAlert } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useSim, type FaultKind } from '@dems/shared/sim'
import { toneChipProps } from '@dems/shared/tokens'
import { useSelfCaptureCore } from '@/lib/own-capture'
import { cn } from '@/lib/utils'
import { useAuditLog } from './audit-context'
import { Feed, type FeedItem } from './feed'
import { isTamperRow, newestMatching } from './model'
import { Panel } from './panel'
import { coreVerifyOutcomes, itemsWithoutVerifyRow } from './core-verify-rows'
import { useEvidenceVerificationCounts } from './evidence-verification'
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
  // Fix wave K (C-2 / G75c-04): a Core in its own capture has no enclosure switch to read; "Closed" is the device model's constant. A raised tamper fault is a fact of the state and stays.
  const selfCapture = useSelfCaptureCore()
  const enclosureNotReported = selfCapture && !enclosureOpen
  // Fix wave L (G89c-02): on a Core in its own capture the third tile is the Core's OWN verify rows, never the bundled demonstration index.
  const verified = useMemo(() => (selfCapture ? coreVerifyOutcomes(rows) : null), [rows, selfCapture])
  const evidence = useSim((s) => s.evidence)
  const integrity = useMemo(() => packageIntegrity(evidence), [evidence])
  // Fix wave M (G89d-02): the tile counts verify RUNS; one sentence says how many of the Core's items have none.
  const coverage = useMemo(() => (selfCapture ? itemsWithoutVerifyRow(rows, evidence.map((item) => item.id)) : null), [rows, evidence, selfCapture])
  // Fix wave J (GM-02; contract J-S 9): where the Core states `evidenceVerification` the tile and its sentence read THE
  // CORE'S count over every sealed item by its verification of record - not the verify rows of the newest 1,000 audit rows.
  const counts = useEvidenceVerificationCounts(selfCapture)
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
        <div className={cn('sa-kpi', enclosureOpen ? 'sa-tone-warning' : enclosureNotReported ? 'sa-tone-default' : 'sa-tone-success')} data-testid="tamper-enclosure" data-reported={enclosureNotReported ? 'false' : undefined}>
          <span className="sa-stat-label">{t('securityAudit.tamper.enclosure')}</span>
          <span className="sa-kpi-value" data-tone>
            {enclosureOpen ? t('securityAudit.tamper.open') : enclosureNotReported ? t('common.platformNotReported.value') : t('securityAudit.tamper.closed')}
          </span>
        </div>
        <div className={cn('sa-kpi', chainOk ? 'sa-tone-success' : 'sa-tone-danger')} data-testid="tamper-chain">
          <span className="sa-stat-label">{t('securityAudit.tamper.chain')}</span>
          <span className="sa-kpi-value" data-tone>
            {chainOk ? t('securityAudit.tamper.intact') : t('securityAudit.tamper.broken')}
          </span>
        </div>
        {verified !== null ? (
          <div
            className={cn('sa-kpi', (counts?.failed ?? verified.fail) > 0 ? 'sa-tone-danger' : (counts?.passed ?? verified.pass) > 0 ? 'sa-tone-success' : 'sa-tone-default')}
            data-testid="tamper-packages"
            data-source={counts !== null ? 'core-evidence-verification' : 'core-verify-rows'}
            data-reported={(counts !== null ? counts.passed + counts.failed : verified.pass + verified.fail) > 0 ? 'true' : 'false'}
          >
            <span className="sa-stat-label">{t('web.waveL.tamper.verifyLabel')}</span>
            <span className="sa-kpi-value" data-tone>
              {counts !== null
                ? t('securityAudit.tamper.packagesSummary', { pass: counts.passed, fail: counts.failed })
                : verified.pass + verified.fail > 0
                  ? t('securityAudit.tamper.packagesSummary', { pass: verified.pass, fail: verified.fail })
                  : t('web.waveL.tamper.noVerifyRows')}
            </span>
          </div>
        ) : (
          <div className={cn('sa-kpi', integrity.fail > 0 ? 'sa-tone-danger' : 'sa-tone-success')} data-testid="tamper-packages">
            <span className="sa-stat-label">{t('securityAudit.tamper.packages')}</span>
            <span className="sa-kpi-value" data-tone>
              {t('securityAudit.tamper.packagesSummary', { pass: integrity.pass, fail: integrity.fail })}
            </span>
          </div>
        )}
      </div>
      {verified !== null ? (
        <div className="flex flex-wrap items-center gap-2" data-testid="tamper-core-verify">
          {verified.failures.map((failure) => (
            <Chip key={failure.evidenceId} size="sm" variant="soft" {...toneChipProps('danger')} data-testid={`tamper-core-verify-${failure.evidenceId}`}>
              {failure.places.length > 0
                ? t('web.waveL.tamper.failedAt', {
                    id: failure.evidenceId,
                    place: failure.places.map((place) => (place.seq === null ? place.trackId : t('web.waveL.tamper.place', { track: place.trackId, seq: place.seq }))).join(', '),
                  })
                : t('web.waveL.tamper.failedNoPlace', { id: failure.evidenceId })}
            </Chip>
          ))}
          <Chip size="sm" variant="soft" color="default">
            {counts !== null ? t('web.waveJ.tamper.fromItems') : verified.pass + verified.fail > 0 ? t('web.waveL.tamper.fromRows') : t('web.waveL.tamper.noVerifyRowsHint')}
          </Chip>
          {counts !== null ? (
            <p className="w-full text-caption text-foreground-2" data-testid="tamper-not-verified" data-source="core-evidence-verification" data-total={counts.sealed} data-not-verified={counts.neverVerified}>
              {counts.neverVerified > 0 ? t('web.waveJ.tamper.neverVerified', { count: counts.neverVerified, total: counts.sealed }) : t('web.waveJ.tamper.allVerified', { total: counts.sealed })}
            </p>
          ) : coverage !== null && coverage.total > 0 ? (
            <p className="w-full text-caption text-foreground-2" data-testid="tamper-not-verified" data-total={coverage.total} data-not-verified={coverage.notVerified}>
              {coverage.notVerified > 0 ? t('web.waveM.tamper.notVerified', { count: coverage.notVerified, total: coverage.total }) : t('web.waveM.tamper.allVerified', { total: coverage.total })}
            </p>
          ) : null}
        </div>
      ) : integrity.failures.length > 0 ? (
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
