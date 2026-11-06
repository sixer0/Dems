/**
 * The enter beats of the Paired Devices page (backend task 04_client_integration_spec §10.1 PG-9,
 * §10.3 "Enter beats"; 03_motion_spec R1, R3, R4, M-C-11), in the pattern of
 * `features/security-audit/choreography.ts` (each feature folder owns its copy, PG-7).
 *
 * Header at the route enter; "Pair a device" at 0 ms (the hero, `variants.hero`); "Devices" at
 * 120 ms, its rows staggered after the held beat (`ROW_STAGGER_MS` 30, capped at `ROW_STAGGER_CAP`
 * 10; a CSS delay per row in `devices-panel.tsx`, because the kit's table rows are no motion
 * elements). No ambient loop on this page. Reduced motion: the kit's flags (no stagger, no halo,
 * numbers jump).
 */
import { useMemo } from 'react'
import type { Variants } from 'motion/react'
import { useRouteEnterDelay } from '@/components/shell'
import { useMotionPolicy, type MotionPolicyValue } from '@/motion'

export type PanelId = 'issue' | 'devices'

/** Enter beat per panel, in ms after the route enter. */
export const PANEL_BEAT_MS: Record<PanelId, number> = {
  issue: 0,
  devices: 120,
}

export function panelVariants(m: MotionPolicyValue, delayMs: number, hero: boolean): Variants {
  const base = hero ? m.variants.hero : m.variants.panel
  if (m.reduced) return base
  const visible = base.visible as { transition?: object }
  return {
    ...base,
    visible: { ...(base.visible as object), transition: { ...(visible.transition ?? {}), delay: m.seconds(delayMs) } },
  }
}

/** Panel enter variants (R1) on the panel's beat; the first panel is the hero (R3). */
export function usePanelVariants(id: PanelId): Variants {
  const m = useMotionPolicy()
  const routeDelay = useRouteEnterDelay()
  return useMemo(() => panelVariants(m, routeDelay + PANEL_BEAT_MS[id], id === 'issue'), [m, routeDelay, id])
}
