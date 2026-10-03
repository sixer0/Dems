/**
 * M-APP-04 route exit through the browser's View Transitions API (03_motion_spec §4, §8, R6, R7).
 *
 * Why View Transitions: TanStack Router 1.170 cannot keep an exiting route mounted (the Outlet of an
 * exiting copy re-renders with the new match, and the old match store is cleared; see
 * implementation/21_shell_motion.md §3, H-M1). The router's ready-made `defaultViewTransition`
 * option wraps the state commit in `document.startViewTransition`, so the browser keeps a static
 * snapshot of the old content area and fades it out (`shell.css`, `::view-transition-old(dems-route)`),
 * while the new page mounts live underneath and enters with Motion after the exit (RouteTransition).
 *
 * Only path changes inside the shell transition. Search-only changes (filters, wizard steps) and the
 * Login ↔ shell hand-off (M-APP-01/02, two-phase) return `false`, which makes the router commit
 * without a view transition. The type names let `shell.css` pick the exit and the direction (R7).
 *
 * Kept free of React and Motion imports: `router.tsx` imports it into the entry chunk.
 */
import type { ParsedLocation } from '@tanstack/react-router'

/** View-transition type set on every in-shell route change. */
export const ROUTE_TRANSITION_TYPE = 'dems-route'
/** Added for a history step back (R7: the new page enters from above). */
export const ROUTE_BACK_TYPE = 'dems-back'
/** Added for forward and replace navigations (R7: the new page enters from below). */
export const ROUTE_FORWARD_TYPE = 'dems-forward'

/** M-APP-04: the content area exits with opacity → 0 over `fast` (160 ms, `exit` easing). */
export const ROUTE_EXIT_TOKEN = 'fast' as const

/** Routes outside the shell (M-APP-01/02 own those hand-offs). */
const OUTSIDE_SHELL = new Set(['/login'])

export interface RouteChangeInfo {
  fromLocation?: Pick<ParsedLocation, 'pathname' | 'state'>
  toLocation: Pick<ParsedLocation, 'pathname' | 'state'>
  pathChanged: boolean
}

/** History index of a location (TanStack history keeps it in `state.__TSR_index`). */
export function historyIndex(location: Pick<ParsedLocation, 'state'> | undefined): number {
  const index = location?.state?.__TSR_index
  return typeof index === 'number' ? index : 0
}

/**
 * The router's `defaultViewTransition.types` callback: `false` (no view transition) unless the
 * path changes between two shell pages; otherwise the route type plus the direction type.
 */
export function routeViewTransitionTypes(info: RouteChangeInfo): string[] | false {
  const { fromLocation, toLocation, pathChanged } = info
  if (!fromLocation || !pathChanged) return false
  if (OUTSIDE_SHELL.has(fromLocation.pathname) || OUTSIDE_SHELL.has(toLocation.pathname)) return false
  const back = historyIndex(toLocation) < historyIndex(fromLocation)
  return [ROUTE_TRANSITION_TYPE, back ? ROUTE_BACK_TYPE : ROUTE_FORWARD_TYPE]
}

/** The router option (`createRouter({ defaultViewTransition })`). */
export const ROUTE_VIEW_TRANSITION = { types: routeViewTransitionTypes }

/**
 * True when this browser runs the typed view transition the router asks for: TanStack only passes
 * `types` when `:active-view-transition-type()` is supported, and without types the `shell.css`
 * exit rule never matches. When false (jsdom, older browsers) there is no exit, so the new page
 * enters at once instead of waiting for it.
 */
export function supportsRouteViewTransition(): boolean {
  if (typeof document === 'undefined' || typeof document.startViewTransition !== 'function') return false
  try {
    return window.CSS?.supports?.('selector(:active-view-transition-type(a))') === true
  } catch {
    return false
  }
}
