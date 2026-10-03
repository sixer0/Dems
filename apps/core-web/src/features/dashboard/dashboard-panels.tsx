/**
 * The ten Dashboard panels (01_specs §14.5.1), in grid order. Loaded as their own chunk by
 * `index.tsx`: the route chunk then holds only the page root, so `page-dashboard` renders at once
 * and the panels (compositions, media, Recharts) follow and play their M-PG-DASH enter.
 */
import { ActiveSessionPanel } from './active-session-panel'
import { DevicesPanel } from './devices-panel'
import { HeroPanel } from './hero-panel'
import { QuickActionsPanel } from './quick-actions-panel'
import { RecentEventsPanel } from './recent-events-panel'
import { SealedTodayPanel } from './sealed-today-panel'
import { SecurityPanel } from './security-panel'
import { StatusStripPanel } from './status-strip'
import { StoragePanel } from './storage-panel'
import { SystemRingPanel } from './system-ring-panel'

export default function DashboardPanels() {
  return (
    <>
      <SystemRingPanel />
      <HeroPanel />
      <StatusStripPanel />
      <ActiveSessionPanel />
      <DevicesPanel />
      <StoragePanel />
      <SecurityPanel />
      <SealedTodayPanel />
      <RecentEventsPanel />
      <QuickActionsPanel />
    </>
  )
}
