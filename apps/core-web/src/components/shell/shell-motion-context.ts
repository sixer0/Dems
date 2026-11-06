/**
 * Shell motion context (step 41): the choreography of the current shell mount, whether the shell
 * is leaving (M-APP-02), and the current page's enter delay (M-APP-04). Kept in a `.ts` module so
 * component files export only components (oxlint `only-export-components`).
 */
import { createContext, useContext, useMemo } from 'react'
import { useMotionPolicy } from '@/motion'
import { buildShellChoreography, type ShellChoreography } from './shell-choreography'

export interface ShellMotionValue {
  choreography: ShellChoreography
  /** True while the shell plays its sign-out exit (M-APP-02), before navigating to `/login`. */
  leaving: boolean
}

export const ShellMotionContext = createContext<ShellMotionValue | null>(null)

/**
 * The shell's choreography. Outside an AppShell (isolated component tests, the Drawer rendered on
 * its own) it falls back to a plain arrival, so parts render at rest.
 */
export function useShellMotion(): ShellMotionValue {
  const value = useContext(ShellMotionContext)
  const kit = useMotionPolicy()
  const fallback = useMemo<ShellMotionValue>(
    () => ({ choreography: buildShellChoreography('plain', kit), leaving: false }),
    [kit],
  )
  return value ?? fallback
}

/**
 * Delay (ms, not time-scaled) before the current page starts its enter: after the route exit
 * (M-APP-04) or after the shell's own entrance (M-APP-01/03). Page rows that animate on their own
 * (`initial="hidden" animate="visible"`) can add it to their first delay; rows that inherit the
 * route wrapper's variants get it for free. `PageHeader` uses it for the TextEffect title.
 */
export const RouteEnterDelayContext = createContext(0)

export function useRouteEnterDelay(): number {
  return useContext(RouteEnterDelayContext)
}
