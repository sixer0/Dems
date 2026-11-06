/**
 * Enter beats of the Users & Roles page (backend task 04_client_integration_spec §10.1 PG-9,
 * §10.2 "Enter beats"; the pattern of `features/security-audit/choreography.ts`).
 *
 * The header enters with the route (`PageHeader`, M-APP-04); "Operators" is the hero at 0 ms
 * (`variants.hero`, R3) with its rows staggered (`ROW_STAGGER_MS`, capped at `ROW_STAGGER_CAP`,
 * M-C-11); "Roles and permissions" follows at 120 ms (`variants.panel`, R1). No ambient loop on
 * this page. Reduced motion: opacity only, no delay, no stagger (the kit's flags).
 */
import { useMemo } from 'react'
import type { Variants } from 'motion/react'
import { useRouteEnterDelay } from '@/components/shell'
import { useMotionPolicy, type MotionPolicyValue } from '@/motion'

export type PanelId = 'users' | 'matrix'

/** Enter beat per panel, in ms after the route enter (§10.2). */
export const PANEL_BEAT_MS: Record<PanelId, number> = {
  users: 0,
  matrix: 120,
}

export function panelVariants(m: MotionPolicyValue, delayMs: number, hero: boolean): Variants {
  const base = hero ? m.variants.hero : m.variants.panel
  if (m.reduced) return base
  const visible = base.visible as { transition?: object }
  return {
    ...base,
    visible: {
      ...(base.visible as object),
      transition: { ...(visible.transition ?? {}), delay: m.seconds(delayMs) },
    },
  }
}

/** Panel enter variants on the panel's beat. */
export function usePanelVariants(beatMs: number, hero: boolean): Variants {
  const m = useMotionPolicy()
  const routeDelay = useRouteEnterDelay()
  return useMemo(() => panelVariants(m, routeDelay + beatMs, hero), [m, routeDelay, beatMs, hero])
}
