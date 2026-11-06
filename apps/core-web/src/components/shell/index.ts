/**
 * AppShell (masterplan/01_specs.md §14.3, §14.4, §14.6). Page rows import `PageHeader` from here;
 * the rest is used by the `_app` route and step 41 (shell motion).
 *
 * Backend task (plan row W54) for the page rows: `LiveOnlyState` is the "Live mode only" state of
 * a page without a simulator equivalent; `useModeSwitch()` is the confirmed mode change (§3.3);
 * `routePermission(pathname)` names the permission a route's guard needs.
 *
 * Motion hand-offs (step 41, implementation/21_shell_motion.md §2):
 * - `BRAND_EMBLEM_LAYOUT_ID` is the Login ↔ top-bar emblem flight ID (M-APP-01/02, step 43);
 * - `useRouteEnterDelay()` gives page rows the delay before their enter (M-APP-04).
 */
export { AppLayout } from './app-layout'
export { AppShell, type AppShellProps } from './app-shell'
export { BrandEmblem, type BrandEmblemProps } from './brand-emblem'
export { LiveOnlyState, type LiveOnlyStateProps } from './live-only-state'
export { modeIndicatorState, type ModeIndicatorState } from './mode-indicator-state'
export { useModeSwitch, type ModeSwitch } from './mode-switch'
export { NAV_ITEMS, type NavItem, type NavPath } from './nav-items'
export { PageHeader, type PageHeaderProps } from './page-header'
export { ROUTE_PERMISSIONS, routePermission } from './route-permissions'
export { RouteTransition, type RouteTransitionProps } from './route-transition'
export { useRouteEnterDelay } from './shell-motion-context'
export type { ShellEntrance } from './shell-entrance'
export { BRAND_EMBLEM_LAYOUT_ID } from './shared-layout-ids'
export {
  SHELL_RAIL_STORAGE_KEY,
  sidebarModeFor,
  useShellLayout,
  useShellTier,
  type ShellLayout,
  type ShellTier,
  type SidebarMode,
} from './use-shell-layout'
