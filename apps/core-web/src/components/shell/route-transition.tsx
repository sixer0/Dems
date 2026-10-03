import { useMemo, useState, type ReactNode } from 'react'
import { useRouterState } from '@tanstack/react-router'
import { motion, type Transition, type Variants } from 'motion/react'
import { motion as tokens } from '@dems/shared/tokens'
import { useMotionPolicy } from '@/motion'
import { historyIndex, supportsRouteViewTransition } from './route-view-transition'
import { RouteEnterDelayContext, useShellMotion } from './shell-motion-context'

export interface RouteTransitionProps {
  children: ReactNode
}

interface RouteTrack {
  pathname: string
  index: number
  /** +1 forward or replace, −1 history back (R7). */
  direction: 1 | -1
  /** False for the page the shell mounted with (its delay comes from the shell entrance). */
  navigated: boolean
}

/**
 * The routed content wrapper (03_motion_spec M-APP-04; R1, R2, R6, R7; §8).
 *
 * - **Exit.** The browser's view transition fades a snapshot of the old content area over `fast`
 *   (160 ms, `exit` easing; `route-view-transition.ts`, `shell.css`). The shell is outside the
 *   snapshot group and never moves.
 * - **Enter.** Keyed by pathname, the wrapper mounts hidden and enters after the exit: opacity plus
 *   `y ±rise` (+1 from below for forward, −1 from above for history back, R7), spring `gentle`.
 *   Its `delayChildren` holds page rows that inherit its variants until then, and the page title's
 *   TextEffect reads the same delay (`useRouteEnterDelay`). Exit 160 + enter ≤ 900 ms.
 * - **First page.** It waits for the shell's own entrance instead (M-APP-01/03, `contentDelayMs`).
 * - **Sign out (M-APP-02).** While the shell is leaving, the wrapper and every inheriting row play
 *   `exit` together with no stagger (R2).
 * - **Reduced motion.** Cross-fade: the snapshot fades out while the page fades in, opacity only.
 * - Search-only changes keep the same key, so filters and wizard steps never replay the enter.
 * - The router resets `#main-content` to the top before the new page is shown (`router.tsx`).
 */
export function RouteTransition({ children }: RouteTransitionProps) {
  const m = useMotionPolicy()
  const { choreography, leaving } = useShellMotion()
  // Key on the COMMITTED leaf match, not on `location`: the router moves `location` as soon as a
  // navigation starts, and re-keying then would remount the old page hidden just before the view
  // transition snapshots it (the exit would fade an empty area).
  const pathname = useRouterState({ select: (state) => state.matches[state.matches.length - 1]?.pathname ?? '' })
  const locationPathname = useRouterState({ select: (state) => state.location.pathname })
  const index = useRouterState({ select: (state) => historyIndex(state.location) })

  // Derived while rendering (no effect, no extra frame). At the commit of a path change the
  // location already holds the new history index, so it is compared with the index of the page
  // that was on screen (R7). Search-only steps (same path) just record their index.
  const [track, setTrack] = useState<RouteTrack>({ pathname, index, direction: 1, navigated: false })
  let current = track
  if (track.pathname !== pathname) {
    current = { pathname, index, direction: index < track.index ? -1 : 1, navigated: true }
    setTrack(current)
  } else if (track.index !== index && locationPathname === pathname) {
    current = { ...track, index }
    setTrack(current)
  }

  const exitMs =
    current.navigated && !m.reduced && supportsRouteViewTransition() ? tokens.duration.fast : 0
  const delayMs = current.navigated ? exitMs : choreography.contentDelayMs
  const variants = useMemo(() => withEnterDelay(m.variants.route, m.seconds(delayMs)), [m, delayMs])

  return (
    <RouteEnterDelayContext.Provider value={delayMs}>
      <motion.div
        key={pathname}
        className="dems-route"
        data-route-key={pathname}
        data-direction={current.direction > 0 ? 'forward' : 'back'}
        {...(m.reduced ? { 'data-motion': 'reduced' } : {})}
        custom={current.direction}
        variants={variants}
        initial="hidden"
        animate={leaving ? 'exit' : 'visible'}
      >
        {children}
      </motion.div>
    </RouteEnterDelayContext.Provider>
  )
}

/** The kit's route variants with the enter held back by `delay` seconds (own values and children). */
function withEnterDelay(route: Variants, delay: number): Variants {
  if (delay <= 0) return route
  const visible = route.visible
  if (!visible || typeof visible === 'function') return route
  const transition = (visible.transition ?? {}) as Transition
  return {
    ...route,
    visible: { ...visible, transition: { ...transition, delay, delayChildren: delay } },
  }
}
