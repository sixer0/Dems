import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useRouter } from '@tanstack/react-router'
import { motion } from 'motion/react'
import { useTranslation } from 'react-i18next'
import { settle, useCoreActions, useCoreMode } from '@dems/shared/live'
import { useMotionPolicy } from '@/motion'
import { BottomTabs } from './bottom-tabs'
import { LiveNotices } from './live-notices'
import { NavDrawer } from './nav-drawer'
import { buildShellChoreography } from './shell-choreography'
import { reportShellError } from './shell-report'
import { markShellIntroShown, resolveShellEntrance } from './shell-entrance'
import { ShellMotionContext, type ShellMotionValue } from './shell-motion-context'
import { Sidebar } from './sidebar'
import { TopBar } from './top-bar'
import { useShellLayout, type SidebarMode } from './use-shell-layout'

export interface AppShellProps {
  children: ReactNode
  /** True once the operator is signed out: the shell plays its M-APP-02 exit and stops input. */
  leaving?: boolean
  /** Called when the M-APP-02 exit has finished (the layout then navigates to `/login`). */
  onExitComplete?: () => void
}

/**
 * AppShell, custom composition 5 of 5 (masterplan/01_specs.md §14.3, §14.4, §14.6).
 *
 * Landmarks: skip link → `<header>` (top bar) → `<nav aria-label="Primary">` (sidebar) → `<main>`.
 * The shell is fixed; only `<main id="main-content">` scrolls (the router resets it on navigation).
 * Sizes come from `shell.css` via `data-shell-tier` and `data-sidebar`; see `use-shell-layout.ts`.
 * `data-core-mode` (SIMULATED or LIVE) lets the top bar make room for the mode indicator's longer
 * Live labels.
 *
 * CSS variables for page rows: `--shell-pad`, `--shell-gutter`, `--shell-topbar-h`,
 * `--shell-sidebar-w` (use `gap-[var(--shell-gutter)]` for panel grids).
 *
 * Motion (03_motion_spec §4; step 41): the root is a Motion variant root. On mount it plays the
 * entrance chosen by `resolveShellEntrance` (M-APP-01 hand-off, M-APP-03 cold entry, or none) and
 * on sign-out the M-APP-02 exit; every part (top bar, sidebar, bottom tabs, routed content) only
 * declares variants and follows. The root itself never moves, so the shell is still during route
 * changes (M-APP-04) and the emblem is never faded during its flight.
 *
 * Live mode (backend task 04_client_integration_spec §3.5, §6.3; plan row W54): `LiveNotices`
 * shows the link notice and the role notice as toasts while an operator is signed in. It adds no
 * element to the page and renders nothing in Simulated mode.
 */
export function AppShell({ children, leaving = false, onExitComplete }: AppShellProps) {
  const { t } = useTranslation()
  const router = useRouter()
  const kit = useMotionPolicy()
  const coreMode = useCoreMode()
  const { tier, mode, canToggleRail, toggleRail } = useShellLayout()
  // The Drawer is open only in the mode it was opened in, so crossing 1024 px closes it.
  const [drawerOpenIn, setDrawerOpenIn] = useState<SidebarMode | null>(null)
  const hasDrawer = mode === 'drawer' || mode === 'tabs'
  const drawerOpen = hasDrawer && drawerOpenIn === mode
  const setDrawerOpen = (open: boolean) => setDrawerOpenIn(open ? mode : null)
  useOperatorActivity()

  const [entrance] = useState(() => resolveShellEntrance(router))
  useEffect(() => markShellIntroShown(), [])
  const choreography = useMemo(() => buildShellChoreography(entrance, kit), [entrance, kit])
  const motionValue = useMemo<ShellMotionValue>(() => ({ choreography, leaving }), [choreography, leaving])

  return (
    <ShellMotionContext.Provider value={motionValue}>
      <motion.div
        className="dems-shell"
        data-shell-tier={tier}
        data-sidebar={mode}
        data-core-mode={coreMode}
        data-entrance={entrance}
        data-leaving={leaving ? 'true' : undefined}
        data-testid="app-shell"
        inert={leaving}
        variants={choreography.root}
        initial={choreography.initial}
        animate={leaving ? 'exit' : 'visible'}
        onAnimationComplete={(definition) => {
          if (definition === 'exit') onExitComplete?.()
        }}
      >
        <a href="#main-content" className="dems-skip-link">
          {t('shell.skipToContent')}
        </a>
        <TopBar mode={mode} drawerOpen={drawerOpen} onToggleDrawer={() => setDrawerOpen(!drawerOpen)} />
        <div className="dems-shell-body">
          {mode === 'full' || mode === 'rail' ? (
            <Sidebar mode={mode} canToggleRail={canToggleRail} onToggleRail={toggleRail} />
          ) : (
            // Below 1024 px the sidebar is hidden (width 0, AC-59); navigation moves to the Drawer.
            <nav aria-label={t('shell.nav.label')} className="dems-sidebar" data-mode={mode} hidden />
          )}
          <main id="main-content" tabIndex={-1} className="dems-content" data-shell-slot="route-content">
            {children}
          </main>
        </div>
        {mode === 'tabs' ? <BottomTabs moreOpen={drawerOpen} onMore={() => setDrawerOpen(true)} /> : null}
        {hasDrawer ? <NavDrawer isOpen={drawerOpen} onOpenChange={setDrawerOpen} /> : null}
      </motion.div>
      <LiveNotices active={!leaving} />
    </ShellMotionContext.Provider>
  )
}

/**
 * Pointer and key activity keeps the operator session alive (15 min idle timeout, 01_specs §14.8).
 * `touch()` is throttled to once per second inside the simulator. In Live mode the Live source
 * throttles it to one `touchSession` a minute (CL-27) and reports a failed one itself: the shell
 * shows nothing for a touch, so an outage is worded once, by the link notice.
 */
function useOperatorActivity(): void {
  const actions = useCoreActions()
  useEffect(() => {
    const onActivity = () => settle(() => actions.touch(), { fail: (error) => reportShellError('shell.touch', error) })
    document.addEventListener('pointerdown', onActivity, { passive: true })
    document.addEventListener('keydown', onActivity)
    return () => {
      document.removeEventListener('pointerdown', onActivity)
      document.removeEventListener('keydown', onActivity)
    }
  }, [actions])
}
