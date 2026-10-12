import { alertRows } from './model'
import { useMemo } from 'react'
import { Button, Card, Chip, Spinner, toast } from '@heroui/react'
import { BellRing } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { settle, useCoreActions } from '@dems/shared/live'
import { DATE_PATTERNS, formatDate, formatUtcOffset } from '@dems/shared/realtime'
import { isUnsealableAlert, useSim, type SimAlert, type SimState } from '@dems/shared/sim'
import { AcknowledgeAllAlerts } from '@/components/shell/acknowledge-all'
import { PageHeader } from '@/components/shell/page-header'
import { reportShellError } from '@/components/shell/shell-report'
import { captureNoticeLine, captureNoticeOf } from '@/lib/capture-notices'
import { useCoreErrorPresenter } from '@/lib/core-errors'
import { usePendingControl } from '@/lib/pending-control'
import '@/features/sessions/sessions.css'

const selectAlerts = (s: SimState) => s.alerts
const SEVERITY_COLOR = { INFO: 'default', SUCCESS: 'success', WARNING: 'warning', CRITICAL: 'danger' } as const

/**
 * Alerts, `/alerts` (fix wave J, driver J-W; findings JW-21 / JA2-25). The console had no alerts
 * page: "View all events" opened the audit log, the bell listed ACTIVE alerts only and offered no
 * acknowledgement, so a cleared alert stayed unacknowledged for ever (lane 1: 12 alerts, none
 * acknowledged, the bell saying "Notifications"). This page lists every alert the Core holds, with
 * its state in words, and acknowledges one through operation 70 - the Core decides who may.
 */
export function AlertsPage() {
  const { t } = useTranslation()
  const alerts = useSim(selectAlerts)
  const rows = useMemo(() => alertRows(alerts), [alerts])
  const open = rows.filter((alert) => !alert.acknowledged).length
  return (
    <div className="dems-page ses-page" data-testid="page-alerts">
      <PageHeader
        icon={BellRing}
        title={t('web.waveJ.alerts.title')}
        subtitle={t('web.waveJ.alerts.subtitle')}
        status={
          <Chip size="sm" variant="soft" color={open > 0 ? 'warning' : 'default'} data-testid="alerts-summary">
            <Chip.Label>{t('web.waveJ.alerts.summary', { total: rows.length, open })}</Chip.Label>
          </Chip>
        }
      />
      <Card className="ses-card">
        {/* Fix wave J round three: the same confirmed "Acknowledge all" as the bell's. */}
        <div className="alr-toolbar">
          <AcknowledgeAllAlerts surface="page" />
        </div>
        {rows.length === 0 ? (
          <p className="ses-empty" role="status" data-testid="alerts-empty">
            {t('web.waveJ.alerts.none')}
          </p>
        ) : (
          <ul className="alr-list" aria-label={t('web.waveJ.alerts.title')}>
            {rows.map((alert) => (
              <AlertRow key={alert.id} alert={alert} />
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}

function AlertRow({ alert }: { alert: SimAlert }) {
  const { t } = useTranslation()
  const actions = useCoreActions()
  const presentCoreError = useCoreErrorPresenter()
  const { busy, pending, run } = usePendingControl()
  const notice = captureNoticeOf(alert)
  const acknowledge = () =>
    run((release) => {
      settle(() => actions.acknowledgeAlert(alert.id), {
        ok: () => {
          toast.success(t('web.waveJ.alerts.acknowledged', { id: alert.id }))
        },
        fail: (error) => {
          if (presentCoreError(error) !== null) return
          reportShellError('AlertsPage.acknowledge', error, 'The acknowledgement of an alert was not accepted', { alertId: alert.id })
          toast.danger(t('common.errors.generic'))
        },
        done: release,
      })
    })
  return (
    <li className="alr-row" data-testid={`alert-row-${alert.id}`} data-active={alert.active ? 'true' : 'false'} data-acknowledged={alert.acknowledged ? 'true' : 'false'} aria-busy={busy || undefined}>
      <Chip size="sm" variant="soft" color={SEVERITY_COLOR[alert.severity] ?? 'default'}>
        <Chip.Label>{t(`common.severity.${alert.severity}` as never, { defaultValue: alert.severity }) as string}</Chip.Label>
      </Chip>
      <span className="ses-stack alr-text">
        <span className="alr-message">{notice === null ? alert.message : captureNoticeLine(t, notice)}</span>
        <span className="ses-caption">
          {alert.id} · {formatDate(alert.at, DATE_PATTERNS.dateTime)} UTC{formatUtcOffset()} · {t(alert.active ? 'web.waveJ.alerts.active' : 'web.waveJ.alerts.cleared')} ·{' '}
          {t(alert.acknowledged ? 'web.waveJ.alerts.ackDone' : 'web.waveJ.alerts.ackOpen')}
          {isUnsealableAlert(alert) && alert.active ? ` · ${t('web.waveL.notice.closeBySupervisor')}` : ''}
        </span>
      </span>
      {alert.acknowledged && !(isUnsealableAlert(alert) && alert.active) ? null : (
        <Button size="sm" variant="outline" onPress={acknowledge} isDisabled={busy} isPending={pending} data-testid={`alert-acknowledge-${alert.id}`}>
          {pending ? <Spinner size="sm" color="current" aria-hidden="true" /> : null}
          {t('web.waveJ.alerts.acknowledge')}
        </Button>
      )}
    </li>
  )
}
