/**
 * Network & Time page (masterplan/01_specs.md §14.5.6; research/04 §5.4; 03_motion_spec M-PG-NET).
 * Replaces the step-38 stub: the export name `NetworkTimePage` (imported by
 * `routes/_app/network-time.tsx`) and the root `data-testid="page-network-time"` (AC-48) are kept.
 *
 * Layout (12 columns from 1280 px; two columns 1024–1279; one column below):
 *   system time hero 5      | time-source hierarchy (GNSS orbit) 7
 *   network status 6        | network domains (beams) 6
 *   time-offset history 6   | network and time events 6
 */
import { Network } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { PageHeader } from '@/components/shell/page-header'
import { DomainsPanel } from './domains-panel'
import { EventsPanel } from './events-panel'
import { HierarchyPanel } from './hierarchy-panel'
import { NetworkPanel } from './network-panel'
import { OffsetPanel } from './offset-panel'
import { NetworkTimeBanner } from './status-banner'
import { SystemTimePanel } from './system-time-panel'
import { useNetworkTimeAlerts } from './use-network-time-alerts'
import './network-time.css'

export function NetworkTimePage() {
  const { t } = useTranslation()
  useNetworkTimeAlerts()
  return (
    <div className="dems-page nt-page" data-testid="page-network-time">
      <PageHeader
        icon={Network}
        title={t('networkTime.title')}
        subtitle={t('networkTime.subtitle')}
        status={<NetworkTimeBanner />}
      />
      <div className="nt-grid">
        <SystemTimePanel />
        <HierarchyPanel />
        <NetworkPanel />
        <DomainsPanel />
        <OffsetPanel />
        <EventsPanel />
      </div>
    </div>
  )
}
