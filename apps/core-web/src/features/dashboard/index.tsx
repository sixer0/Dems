/**
 * Dashboard (step 42; masterplan/01_specs.md §14.5.1; research/04 §3.1; 03_motion_spec M-PG-DASH).
 * Replaces the step-38 stub and keeps its contract (19_app_shell.md §2): the export name
 * `DashboardPage` and `data-testid="page-dashboard"` (AC-48). The Dashboard does not use the
 * page-header template (§14.4); its heading is visually hidden.
 *
 * Panels A–J (test IDs `panel-a` … `panel-j`, AC-60) on the §14.5.1 grid 3|9, 5|7, 4|5|3, 6|6, with
 * the status strip (C) on the hero's lower edge. At 1920×1080 the rows are 340 / 256 / 180 / 148
 * in proportion and fill the content area, so <main> does not scroll (dashboard.css).
 *
 * Choreography (M-PG-DASH): hero photo and overline at 0, tagline 120, strip 250, row 2 at 450,
 * row 3 at 650, row 4 at 850, and the SYSTEM READY ring sweep (the hero moment) from 900 to about
 * 1,800, after the route enter (M-APP-04). Four ambient loops at most (§9.4): ring rotation, ring
 * breathing, hero Ken Burns, and the idle Ripple + ShineBorder sharing one slot (D63).
 *
 * Loading: the page root renders at once; the panels are a lazily loaded chunk
 * (`dashboard-panels.tsx`) and enter on their beats when it arrives. The panels fade in from
 * opacity 0 anyway, so the empty grid is the correct first frame (no skeleton loop, §9.4).
 */
import './dashboard.css'
import { lazy, Suspense } from 'react'
import { useTranslation } from 'react-i18next'

const DashboardPanels = lazy(() => import('./dashboard-panels'))

export function DashboardPage() {
  const { t } = useTranslation()
  return (
    <div className="dems-page dems-dash" data-testid="page-dashboard">
      <h1 className="sr-only">{t('dashboard.title')}</h1>
      <Suspense fallback={null}>
        <DashboardPanels />
      </Suspense>
    </div>
  )
}
