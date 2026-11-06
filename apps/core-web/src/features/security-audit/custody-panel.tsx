import { memo, useMemo } from 'react'
import { FileOutput } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useSim, type AuditRow, type EvidenceItem } from '@dems/shared/sim'
import { useAuditLog } from './audit-context'
import { Feed, type FeedItem } from './feed'
import { isCustodyRow, newestMatching, shortHash } from './model'
import { Panel } from './panel'
import { packageExportOf } from './sim-adapter'
import { toneClass } from './tones'
import { useNewestArrival, useStableRows } from './use-newest'

const FEED_SIZE = 4

function detailText(row: AuditRow, key: string): string | null {
  const value = row.details[key]
  return typeof value === 'string' && value.length > 0 ? value : null
}

export interface CustodyPanelProps {
  className?: string
}

/**
 * Export & chain of custody (design book §19.2, §19.3; SYS-010; §21.3 ExportEvent). The newest
 * EVIDENCE_EXPORTED, EXPORT_DENIED and AUDIT_EXPORTED rows with operator, reason and destination;
 * an exported item with a DEMO package also shows its export package ID, zip SHA-256 and the
 * authorization reference (guarded join, P13, M4).
 */
export const CustodyPanel = memo(function CustodyPanel({ className }: CustodyPanelProps) {
  const { t } = useTranslation()
  const { rows } = useAuditLog()
  const operators = useSim((s) => s.operators)
  const evidence = useSim((s) => s.evidence)
  const recent = useStableRows(useMemo(() => newestMatching(rows, isCustodyRow, FEED_SIZE), [rows]))
  const highlight = useNewestArrival(recent[0]?.id ?? null)
  const names = useMemo(() => new Map(operators.map((operator) => [operator.id, operator.displayName])), [operators])
  const byId = useMemo(() => new Map<string, EvidenceItem>(evidence.map((item) => [item.id, item])), [evidence])

  const items: FeedItem[] = useMemo(() => recent.map((row) => {
    const by = row.actorId ? t('securityAudit.custody.by', { name: names.get(row.actorId) ?? row.actorId }) : null
    if (row.type === 'AUDIT_EXPORTED') {
      const exportId = detailText(row, 'exportId')
      const entries = typeof row.details.rows === 'number' ? row.details.rows : null
      const head = detailText(row, 'head')
      return {
        id: row.id,
        at: row.at,
        tone: 'sa-tone-accent',
        title: `${t('securityAudit.custody.auditExport')} • ${exportId ?? row.id}`,
        sub: [by, entries !== null ? `${entries} ${t('securityAudit.posture.stats.entries').toLowerCase()}` : null, head ? `${t('securityAudit.chain.headHash')} ${shortHash(head)}` : null]
          .filter(Boolean)
          .join(' • '),
      }
    }
    if (row.type === 'EXPORT_DENIED') {
      const target = row.evidenceId ?? (row.details.scope === 'AUDIT' ? t('securityAudit.audit.title') : row.id)
      return {
        id: row.id,
        at: row.at,
        tone: 'sa-tone-warning',
        title: `${t('securityAudit.custody.denied')} • ${target}`,
        sub: [by, typeof row.details.role === 'string' ? t(`common.roles.${row.details.role as 'INVESTIGATOR'}`) : null]
          .filter(Boolean)
          .join(' • '),
      }
    }
    const item = row.evidenceId ? (byId.get(row.evidenceId) ?? null) : null
    const record = packageExportOf(item)
    const reason = detailText(row, 'reason')
    const destination = detailText(row, 'destination')
    return {
      id: row.id,
      at: row.at,
      tone: toneClass('success'),
      title: `${t('securityAudit.custody.exported')} • ${row.evidenceId ?? row.id}`,
      sub: [
        by,
        reason ? t('securityAudit.custody.reason', { reason }) : null,
        destination ? t('securityAudit.custody.destination', { destination }) : null,
        record ? t('securityAudit.custody.packageLine', { exportId: record.exportId, hash: shortHash(record.sha256) }) : null,
        record ? t('securityAudit.custody.authorization', { ref: record.authorizationRef }) : null,
      ]
        .filter(Boolean)
        .join(' • '),
    }
  }), [recent, t, names, byId])

  return (
    <Panel id="custody" icon={FileOutput} title={t('securityAudit.custody.title')} className={className}>
      <p className="sa-rule">{t('securityAudit.custody.rule')}</p>
      <Feed
        items={items}
        label={t('securityAudit.custody.listLabel')}
        empty={t('securityAudit.custody.empty')}
        highlightId={highlight}
        testId="custody-feed"
      />
    </Panel>
  )
})
