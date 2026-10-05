import { memo, useMemo } from 'react'
import { Chip } from '@heroui/react'
import { Fingerprint } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { AUTH_MAX_FAILURES, selectLockout, useSim, type AuditRow } from '@dems/shared/sim'
import { toneChipProps } from '@dems/shared/tokens'
import { cn } from '@/lib/utils'
import { useWebLive } from '@/runtime'
import { useAuditLog } from './audit-context'
import { Feed, type FeedItem } from './feed'
import { actorKindOf, countMatching, isAuthRow, namesTypedUsername, newestMatching } from './model'
import { Panel } from './panel'
import { SEVERITY_TONE, toneClass } from './tones'
import { useNewestArrival, useStableRows } from './use-newest'

const FEED_SIZE = 5

export interface AuthPanelProps {
  className?: string
}

/**
 * Authentication events (design book §21.3 AuthenticationEvent, §20.1 brute-force protection;
 * research/04 §5.5: Login success, failure and lockout appear here). KPIs from the audit ring,
 * the live lockout state (whole seconds derived in the selector, R8) and the newest auth rows.
 */
export const AuthPanel = memo(function AuthPanel({ className }: AuthPanelProps) {
  const { t } = useTranslation()
  const { rows } = useAuditLog()
  const operators = useSim((s) => s.operators)
  // Live mode (W75; CPS1-12 (a)): a failed sign-in names the operator whose username was typed.
  const isLive = useWebLive() !== null
  const locked = useSim((s) => selectLockout(s).locked)
  const lockSeconds = useSim((s) => Math.ceil(selectLockout(s).retryInMs / 1000))
  const attemptsRemaining = useSim((s) => selectLockout(s).attemptsRemaining)

  const signIns = useMemo(() => countMatching(rows, (row) => row.type === 'AUTH_SUCCESS'), [rows])
  const failed = useMemo(() => countMatching(rows, (row) => row.type === 'AUTH_FAILED' || row.type === 'AUTH_LOCKED'), [rows])
  const recent = useStableRows(useMemo(() => newestMatching(rows, isAuthRow, FEED_SIZE), [rows]))
  const highlight = useNewestArrival(recent[0]?.id ?? null)

  const items: FeedItem[] = useMemo(() => {
    const names = new Map(operators.map((operator) => [operator.id, operator.displayName]))
    const named = (row: AuditRow, actorId: string) => {
      const name = names.get(actorId) ?? actorId
      return isLive && namesTypedUsername(row) ? t('securityAudit.live.audit.typedActor', { name }) : name
    }
    const actor = (row: AuditRow) =>
      row.actorId
        ? named(row, row.actorId)
        : actorKindOf(row) === 'UNVERIFIED'
          ? t('securityAudit.audit.unverifiedUser')
          : t('securityAudit.audit.system')
    return recent.map((row) => {
      const method = typeof row.details.method === 'string' ? row.details.method : null
      return {
        id: row.id,
        at: row.at,
        tone: toneClass(SEVERITY_TONE[row.severity]),
        title: t(`common.auditType.${row.type}`),
        sub: method
          ? `${actor(row)} • ${t('securityAudit.auth.via', { method: t(`common.authMethod.${method as 'PASSWORD'}`) })}`
          : actor(row),
      }
    })
  }, [recent, t, operators, isLive])

  const failuresInWindow = AUTH_MAX_FAILURES - attemptsRemaining

  return (
    <Panel id="auth" icon={Fingerprint} title={t('securityAudit.auth.title')} className={className}>
      <div className="sa-kpis">
        <div className="sa-kpi">
          <span className="sa-stat-label">{t('securityAudit.auth.signIns')}</span>
          <span className="sa-kpi-value">{signIns}</span>
        </div>
        <div className={cn('sa-kpi', failed > 0 ? 'sa-tone-warning' : 'sa-tone-default')}>
          <span className="sa-stat-label">{t('securityAudit.auth.failed')}</span>
          <span className="sa-kpi-value" data-tone={failed > 0 || undefined}>
            {failed}
          </span>
        </div>
        <div className={cn('sa-kpi', locked ? 'sa-tone-danger' : 'sa-tone-success')} data-testid="auth-lockout">
          <span className="sa-stat-label">{t('securityAudit.auth.lockout')}</span>
          <span className="sa-kpi-value" data-tone>
            {locked ? t('securityAudit.auth.lockedFor', { seconds: lockSeconds }) : t('securityAudit.auth.notLocked')}
          </span>
        </div>
      </div>
      <Chip size="sm" variant="soft" className="self-start" {...toneChipProps(failuresInWindow > 0 ? 'warning' : 'default')}>
        {t('securityAudit.auth.windowHint', { count: failuresInWindow, max: AUTH_MAX_FAILURES })}
      </Chip>
      <Feed
        items={items}
        label={t('securityAudit.auth.listLabel')}
        empty={t('securityAudit.auth.empty')}
        highlightId={highlight}
        testId="auth-feed"
      />
    </Panel>
  )
})
