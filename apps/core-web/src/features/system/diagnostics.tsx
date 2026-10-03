import { useState, type ReactNode } from 'react'
import { Alert, Button, Chip, Modal, ProgressBar, toast, Tooltip } from '@heroui/react'
import { CircleCheck, Download, RefreshCw, RotateCw, Stethoscope, TriangleAlert, Wrench, XCircle } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import {
  formatWibTime,
  Permission,
  selectCan,
  useSim,
  useSimActions,
  useSimInstance,
  type DiagnosticCheck,
  type DiagnosticStatus,
  type SimState,
} from '@dems/shared/sim'
import { GlowLayer, useMotionPolicy } from '@/motion'
import { DIAG_BAR_FILL_MS } from './choreography'
import { logSystemError } from './log'
import { diagnosticsTone, requiredRoleFor, summarizeDiagnostics, type DiagnosticsSummary } from './model'
import { SystemPanel } from './panel'
import { restartCoreServices } from './sim-adapter'
import { useSimCommand, useStartDiagnostics } from './use-sim-command'

const selectRun = (s: SimState) => s.diagnostics
const selectCanRun = (s: SimState) => selectCan(s, Permission.DIAGNOSTICS_RUN)
const selectCanMaintain = (s: SimState) => selectCan(s, Permission.MAINTENANCE)
const selectCanExportAudit = (s: SimState) => selectCan(s, Permission.AUDIT_EXPORT)

const STATUS_COLOR: Record<DiagnosticStatus, 'default' | 'accent' | 'success' | 'warning' | 'danger'> = {
  PENDING: 'default',
  RUNNING: 'accent',
  PASS: 'success',
  WARN: 'warning',
  FAIL: 'danger',
}

/** The summary line for a run: failures first, then warnings, else all passed. */
function useSummaryText(): (summary: DiagnosticsSummary) => string {
  const { t } = useTranslation()
  return (summary) => {
    if (summary.fail > 0) return t('system.diagnostics.failed', { count: summary.fail })
    if (summary.warn > 0) return t('system.diagnostics.warned', { count: summary.warn })
    return t('system.diagnostics.passed')
  }
}

function RbacGate({ allowed, permission, label, children }: { allowed: boolean; permission: Permission; label: string; children: ReactNode }) {
  const { t } = useTranslation()
  if (allowed) return <>{children}</>
  const role = requiredRoleFor(permission)
  const reason = t('common.rbac.requiresRole', { role: role ? t(`common.roles.${role}`) : '' })
  return (
    <Tooltip delay={200}>
      <Tooltip.Trigger className="rounded-lg" aria-label={`${label}: ${reason}`}>
        {children}
      </Tooltip.Trigger>
      <Tooltip.Content placement="top">{reason}</Tooltip.Content>
    </Tooltip>
  )
}

/** Triggers a JSON download in the browser. Throws when the platform cannot create the file. */
function downloadJson(fileName: string, data: unknown): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  anchor.rel = 'noopener'
  document.body.append(anchor)
  anchor.click()
  anchor.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/**
 * Diagnostics & Maintenance: the last Run Diagnostics result, Run Diagnostics (DIAGNOSTICS_RUN),
 * Restart services (MAINTENANCE; the sim's `restartServices`, simulated and audited) and Export
 * logs (the sim's `exportLogs`: AUDIT_EXPORT, audited either way; step 54). RBAC per S20: disabled with a
 * Tooltip naming the role; refusals from the sim still become friendly toasts.
 */
export function MaintenancePanel({ anchorId, onOpenDiagnostics }: { anchorId: string; onOpenDiagnostics: () => void }) {
  const { t } = useTranslation()
  const sim = useSimInstance()
  const actions = useSimActions()
  const runCommand = useSimCommand()
  const run = useSim(selectRun)
  const canRun = useSim(selectCanRun)
  const canMaintain = useSim(selectCanMaintain)
  const canExport = useSim(selectCanExportAudit)
  const summaryText = useSummaryText()
  const summary = summarizeDiagnostics(run)

  const restart = () => {
    const count = runCommand(() => restartCoreServices(sim), {
      source: 'Maintenance.restart',
      transitionMessage: t('system.maintenance.restartBlocked'),
    })
    if (count !== undefined) toast.success(t('system.maintenance.restartDone'), { description: t('system.maintenance.restartBody', { count }) })
  }

  const exportLogs = () => {
    const result = runCommand(() => actions.exportLogs(), { source: 'Maintenance.exportLogs' })
    if (!result) return
    if (!result.ok) {
      toast.danger(t('system.maintenance.exportDenied'), {
        description:
          result.status === 401
            ? t('system.maintenance.exportNotSignedIn')
            : t('common.rbac.requiresRole', { role: t(`common.roles.${requiredRoleFor(Permission.AUDIT_EXPORT) ?? 'SUPERVISOR'}`) }),
      })
      return
    }
    const state = sim.store.getState()
    try {
      downloadJson(`dems-logs-${state.device.id}-${result.exportId}.json`, {
        demo: true,
        notice: 'DEMO - simulated log export from the DEMS demo stack.',
        exportId: result.exportId,
        deviceId: state.device.id,
        softwareVersion: state.device.softwareVersion,
        exportedAt: new Date(state.clock.now).toISOString(),
        audit: { head: state.audit.head, rows: state.audit.rows },
        events: state.events,
        services: state.services,
        diagnostics: state.diagnostics,
      })
      toast.success(t('system.maintenance.exportDone', { rows: state.audit.rows.length }))
    } catch (error) {
      toast.danger(t('system.maintenance.exportFailed'))
      logSystemError('Maintenance.exportLogs.download', error, { exportId: result.exportId })
    }
  }

  return (
    <SystemPanel id="maintenance" anchorId={anchorId} icon={Wrench} title={t('system.maintenance.title')} bodyClassName="sys-maint-body">
      <div className="sys-maint-last" data-testid="system-diagnostics-last">
        <span className="sys-label">{t('system.maintenance.lastRun')}</span>
        {run && summary ? (
          <div className="sys-maint-last-row">
            <Chip
              size="sm"
              variant="soft"
              color={summary.complete ? diagnosticsTone(summary) : 'accent'}
              className="sys-status-chip"
            >
              <Chip.Label>
                {summary.complete ? summaryText(summary) : t('system.diagnostics.progress', { done: summary.done, total: summary.total })}
              </Chip.Label>
            </Chip>
            <span className="sys-mono sys-small sys-muted">{t('system.maintenance.lastRunAt', { id: run.id, time: formatWibTime(run.startedAt) })}</span>
          </div>
        ) : (
          <p className="sys-muted sys-small">{t('system.maintenance.neverRun')}</p>
        )}
      </div>

      <div className="sys-maint-actions">
        <MaintenanceAction
          icon={Stethoscope}
          title={t('system.diagnostics.title')}
          hint={t('system.diagnostics.subtitle')}
          button={
            <RbacGate allowed={canRun} permission={Permission.DIAGNOSTICS_RUN} label={t('system.diagnostics.title')}>
              <Button size="sm" variant="primary" isDisabled={!canRun} onPress={onOpenDiagnostics} data-testid="system-run-diagnostics">
                {t('system.diagnostics.title')}
              </Button>
            </RbacGate>
          }
        />
        <MaintenanceAction
          icon={RotateCw}
          title={t('system.maintenance.restart')}
          hint={t('system.maintenance.restartHint')}
          button={
            <RbacGate allowed={canMaintain} permission={Permission.MAINTENANCE} label={t('system.maintenance.restart')}>
              <Button size="sm" variant="outline" isDisabled={!canMaintain} onPress={restart} data-testid="system-restart-services">
                {t('system.maintenance.restart')}
              </Button>
            </RbacGate>
          }
        />
        <MaintenanceAction
          icon={Download}
          title={t('system.maintenance.exportLogs')}
          hint={t('system.maintenance.exportLogsHint')}
          button={
            <RbacGate allowed={canExport} permission={Permission.AUDIT_EXPORT} label={t('system.maintenance.exportLogs')}>
              <Button size="sm" variant="outline" isDisabled={!canExport} onPress={exportLogs} data-testid="system-export-logs">
                {t('system.maintenance.exportLogs')}
              </Button>
            </RbacGate>
          }
        />
      </div>
    </SystemPanel>
  )
}

function MaintenanceAction({ icon: Icon, title, hint, button }: { icon: typeof Wrench; title: string; hint: string; button: ReactNode }) {
  return (
    <div className="sys-maint-action">
      <Icon className="sys-maint-icon" aria-hidden="true" strokeWidth={1.6} />
      <div className="sys-maint-text">
        <span className="sys-maint-title">{title}</span>
        <span className="sys-maint-hint">{hint}</span>
      </div>
      <div className="sys-maint-button">{button}</div>
    </div>
  )
}

function CheckRow({ check }: { check: DiagnosticCheck }) {
  const { t } = useTranslation()
  const m = useMotionPolicy()
  const resolved = check.status === 'PASS' || check.status === 'WARN' || check.status === 'FAIL'
  const fill = resolved || check.status === 'RUNNING' ? 1 : 0
  const label = t(`system.diagnostics.checks.${check.id}` as 'system.diagnostics.checks.CPU', { defaultValue: check.label })
  return (
    <li className="sys-diag-row" data-status={check.status} data-testid={`system-diag-${check.id}`}>
      <div className="sys-diag-head">
        <span className="sys-diag-label">{label}</span>
        <Chip size="sm" variant="soft" color={STATUS_COLOR[check.status]} className="sys-status-chip">
          <Chip.Label>{t(`common.diagnosticStatus.${check.status}`)}</Chip.Label>
        </Chip>
      </div>
      <ProgressBar aria-label={label} value={resolved ? 100 : check.status === 'RUNNING' ? 50 : 0} size="sm" className="sys-bar" data-tone={STATUS_COLOR[check.status]}>
        <ProgressBar.Track className="sys-bar-track">
          <ProgressBar.Fill
            className="sys-bar-fill"
            style={{
              ['--sys-fill' as string]: String(fill),
              ['--sys-fill-transition' as string]: m.reduced ? 'none' : `transform ${DIAG_BAR_FILL_MS * m.timeScale}ms cubic-bezier(0.22, 1, 0.36, 1)`,
            }}
          />
        </ProgressBar.Track>
      </ProgressBar>
      {check.detail ? <span className="sys-diag-detail sys-mono">{check.detail}</span> : null}
    </li>
  )
}

/**
 * The M-PG-SYS hero moment: a Modal with one ProgressBar per check filling in sequence (700 ms,
 * sim-timed resolution), then a summary Alert with one success pulse (GlowLayer `pulseKey`).
 */
export function DiagnosticsModal({ isOpen, onOpenChange }: { isOpen: boolean; onOpenChange: (open: boolean) => void }) {
  const { t } = useTranslation()
  const run = useSim(selectRun)
  const canRun = useSim(selectCanRun)
  const start = useStartDiagnostics()
  const summaryText = useSummaryText()
  const summary = summarizeDiagnostics(run)
  const complete = summary?.complete ?? false
  // One pulse per completed run (keyed by the run ID).
  const [pulsed, setPulsed] = useState<string | null>(null)
  if (complete && run && pulsed !== run.id) setPulsed(run.id)

  const tone = summary && complete ? diagnosticsTone(summary) : 'accent'
  const AlertIcon = tone === 'danger' ? XCircle : tone === 'warning' ? TriangleAlert : CircleCheck

  return (
    <Modal.Backdrop isOpen={isOpen} onOpenChange={onOpenChange} variant="blur">
      <Modal.Container size="md" placement="center" scroll="inside">
        <Modal.Dialog aria-label={t('system.diagnostics.title')} className="sys-diag-dialog" data-testid="system-diagnostics-modal">
          <Modal.Header className="sys-diag-header">
            <Stethoscope className="sys-card-icon" aria-hidden="true" strokeWidth={1.75} />
            <Modal.Heading>{t('system.diagnostics.title')}</Modal.Heading>
            <Chip size="sm" variant="secondary" className="sys-sim-chip">
              <Chip.Label>{t('common.simulated.chip')}</Chip.Label>
            </Chip>
          </Modal.Header>
          <Modal.Body className="sys-diag-body">
            <p className="sys-muted sys-small">
              {summary && !complete ? t('system.diagnostics.running') : t('system.diagnostics.subtitle')}
            </p>
            <ol className="sys-diag-list" aria-label={t('system.diagnostics.title')}>
              {(run?.checks ?? []).map((check) => (
                <CheckRow key={check.id} check={check} />
              ))}
            </ol>
            {summary && complete ? (
              <div className="sys-diag-summary">
                <GlowLayer level={1} tone={tone === 'accent' ? 'brand' : tone === 'default' ? 'brand' : tone} pulseKey={pulsed ?? undefined} />
                <Alert status={tone === 'danger' ? 'danger' : tone === 'warning' ? 'warning' : 'success'} data-testid="system-diagnostics-summary">
                  <Alert.Indicator>
                    <AlertIcon aria-hidden="true" />
                  </Alert.Indicator>
                  <Alert.Content>
                    <Alert.Title>{summaryText(summary)}</Alert.Title>
                    <Alert.Description>{t('system.diagnostics.progress', { done: summary.done, total: summary.total })}</Alert.Description>
                  </Alert.Content>
                </Alert>
              </div>
            ) : null}
          </Modal.Body>
          <Modal.Footer className="sys-diag-footer">
            <Button variant="ghost" onPress={() => onOpenChange(false)}>
              {t('common.actions.close')}
            </Button>
            <Button variant="outline" isDisabled={!complete || !canRun} onPress={() => start()} data-testid="system-diagnostics-again">
              <RefreshCw className="size-4" aria-hidden="true" />
              {t('system.diagnostics.runAgain')}
            </Button>
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  )
}
