/**
 * System & Maintenance page (masterplan/01_specs.md §14.5.8; research/04 §5.6 + MB 10; 03_motion_spec
 * M-PG-SYS; AC-65). Replaces the step-38 stub: the export name `SystemPage` (imported by
 * `routes/_app/system.tsx`) and the root `data-testid="page-system"` (AC-48) are kept.
 *
 * Layout (12 columns from 1280 px; two columns 1024–1279; one column below):
 *   quick actions 12
 *   services board 8          | health 4
 *   software update 7         | diagnostics & maintenance 5
 *   about / identity + SBOM 6 | settings 6
 *   Demo Control Panel 12 (DEMO, behind the "Demo controls" switch)
 *
 * Plan row W76 (Live mode): Run Diagnostics opens the modal when the Core accepted the run (A10,
 * the starter's `ok`); the Demo Control Panel is rendered in Live mode only for a session that holds
 * `DEMO_CONTROL` on a Core server with the demo flag on (AC-C-52, DC-3), and as today in Simulated
 * mode.
 */
import { useState } from 'react'
import { Settings } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { PageHeader } from '@/components/shell/page-header'
import { useMotionPolicy } from '@/motion'
import { AboutPanel } from './about-panel'
import { DemoPanel } from './demo-panel'
import { DiagnosticsModal, MaintenancePanel } from './diagnostics'
import { HealthPanel } from './health-panel'
import { QuickActions } from './quick-actions'
import { ServicesPanel } from './services-panel'
import { SettingsPanel } from './settings-panel'
import { SystemBanner } from './status-banner'
import { UpdatePanel } from './update-panel'
import { useDemoPanelVisible } from './live'
import { useStartDiagnostics } from './use-sim-command'
import './system.css'

const ANCHORS = {
  update: 'system-update',
  maintenance: 'system-maintenance',
  about: 'system-about',
} as const

export function SystemPage() {
  const { t } = useTranslation()
  const m = useMotionPolicy()
  const { start: startDiagnostics, busy: diagnosticsBusy, pending: diagnosticsPending, ref: diagnosticsRef } = useStartDiagnostics()
  const showDemoPanel = useDemoPanelVisible()
  const [diagnosticsOpen, setDiagnosticsOpen] = useState(false)

  const openDiagnostics = () => {
    startDiagnostics(() => setDiagnosticsOpen(true))
  }

  const focusUpdate = () => {
    const target = document.getElementById(ANCHORS.update)
    target?.scrollIntoView?.({ behavior: m.reduced ? 'auto' : 'smooth', block: 'start' })
    const button = target?.querySelector<HTMLElement>('[data-testid="system-update-install"]')
    if (button && !button.hasAttribute('disabled') && button.getAttribute('aria-disabled') !== 'true') button.focus({ preventScroll: true })
  }

  return (
    <div className="dems-page sys-page" data-testid="page-system">
      <PageHeader icon={Settings} title={t('system.title')} subtitle={t('system.subtitle')} status={<SystemBanner />} />
      <div className="sys-grid">
        <QuickActions onRunDiagnostics={openDiagnostics} onSoftwareUpdate={focusUpdate} runBusy={diagnosticsBusy} />
        <ServicesPanel />
        <HealthPanel />
        <UpdatePanel anchorId={ANCHORS.update} />
        <MaintenancePanel anchorId={ANCHORS.maintenance} onOpenDiagnostics={openDiagnostics} runPending={diagnosticsPending}
          runRef={diagnosticsRef} />
        <AboutPanel anchorId={ANCHORS.about} />
        <SettingsPanel maintenanceAnchor={ANCHORS.maintenance} aboutAnchor={ANCHORS.about} />
        {showDemoPanel ? <DemoPanel /> : null}
      </div>
      <DiagnosticsModal isOpen={diagnosticsOpen} onOpenChange={setDiagnosticsOpen} />
    </div>
  )
}
