/**
 * Storage page (masterplan/01_specs.md §14.5.5; research/04 §5.3; 03_motion_spec M-PG-STOR; AC-75).
 * Replaces the step-38 stub: the export name `StoragePage` (imported by `routes/_app/storage.tsx`)
 * and the root `data-testid="page-storage"` (AC-48) are kept.
 *
 * Layout (12 columns from 1280 px; two columns 1024–1279; one column below):
 *   capacity ring + legend 5 | KPI cards 7
 *   usage over 24 h 7        | sealed per hour 5
 *   volumes & health 6       | recent storage activity 6
 *   retention calculator 8   | storage policy + Manage Storage 4
 */
import { lazy, Suspense } from 'react'
import { ChartArea, ChartColumn, Database } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { PageHeader } from '@/components/shell/page-header'
import { ActivityPanel } from './activity-panel'
import { CapacityPanel } from './capacity-panel'
import { KpiCards } from './kpi-cards'
import { StoragePanelBoundary } from './panel'
import { PolicyPanel } from './policy-panel'
import { RetentionCalculator } from './retention-calculator'
import { ChartSkeletonPanel } from './chart-skeleton'
import { StorageBanner } from './status-banner'
import { useStorageAlerts } from './use-storage-alerts'
import { VolumesPanel } from './volumes-panel'
import './storage.css'

// Recharts is the heaviest dependency of the page: the two chart panels load as their own chunk,
// so the page (header, ring, KPIs) paints without waiting for it (M-C-24 skeleton meanwhile). The
// fetch starts as soon as this route chunk evaluates, so it normally lands before the chart beats.
const usageChunk = import('./usage-chart')
const sealedChunk = import('./sealed-chart')
const UsageChartPanel = lazy(() => usageChunk.then((m) => ({ default: m.UsageChartPanel })))
const SealedChartPanel = lazy(() => sealedChunk.then((m) => ({ default: m.SealedChartPanel })))

export function StoragePage() {
  const { t } = useTranslation()
  useStorageAlerts()
  return (
    <div className="dems-page stor-page" data-testid="page-storage">
      <PageHeader icon={Database} title={t('storage.title')} subtitle={t('storage.subtitle')} status={<StorageBanner />} />
      <div className="stor-grid">
        <CapacityPanel />
        <StoragePanelBoundary panel="kpis">
          <KpiCards />
        </StoragePanelBoundary>
        <Suspense fallback={<ChartSkeletonPanel id="usage" icon={ChartArea} titleKey="storage.charts.usage24h" />}>
          <UsageChartPanel />
        </Suspense>
        <Suspense fallback={<ChartSkeletonPanel id="sealed" icon={ChartColumn} titleKey="storage.charts.sealedPerHour" />}>
          <SealedChartPanel />
        </Suspense>
        <VolumesPanel />
        <ActivityPanel />
        <RetentionCalculator />
        <PolicyPanel />
      </div>
    </div>
  )
}
