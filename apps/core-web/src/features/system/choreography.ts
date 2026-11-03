/**
 * M-PG-SYS choreography (03_motion_spec §6 M-PG-SYS, R1, R3, R4, §8, §9.4).
 *
 * Enter order: quick actions (Spotlight), the services board (rows stagger, chips colour in), the
 * health mini charts, the update card (Stepper), About and Settings, then the Demo Control Panel
 * (collapsed). The hero moment is Run Diagnostics (the Modal: one bar per check, 700 ms each, then
 * a summary Alert with one success pulse), so the page enter itself stays quiet. Ambient loops:
 * none (the health sparklines stream without animation). Reduced motion: opacity only, no delay.
 */
import { useMemo } from 'react'
import type { Variants } from 'motion/react'
import { useRouteEnterDelay } from '@/components/shell'
import { useMotionPolicy, type MotionPolicyValue } from '@/motion'

export type SystemPanelId = 'quick' | 'services' | 'health' | 'update' | 'maintenance' | 'about' | 'settings' | 'panelSetup' | 'demo'

/** Panel beats in ms after the route enter (reading order). */
export const PANEL_BEAT_MS: Record<SystemPanelId, number> = {
  quick: 80,
  services: 160,
  health: 220,
  update: 300,
  maintenance: 360,
  about: 420,
  settings: 480,
  panelSetup: 510,
  demo: 540,
}

/** M-C-11: table rows stagger 30 ms; only the first 10 stagger, the rest land with the 10th. */
export const ROW_STAGGER_MS = 30
export const ROW_STAGGER_CAP = 10
/** M-PG-SYS hero: each diagnostics bar fills over 700 ms. */
export const DIAG_BAR_FILL_MS = 700

function panelVariants(m: MotionPolicyValue, delayMs: number): Variants {
  const base = m.variants.panel
  const visible = base.visible as { transition?: object }
  return {
    ...base,
    visible: { ...(base.visible as object), transition: { ...(visible.transition ?? {}), delay: m.seconds(delayMs) } },
  }
}

export function usePanelVariants(beatMs: number): Variants {
  const m = useMotionPolicy()
  const routeDelay = useRouteEnterDelay()
  return useMemo(() => panelVariants(m, m.reduced ? 0 : routeDelay + beatMs), [m, routeDelay, beatMs])
}

/** Seconds of delay for the i-th row of a table that enters on `beatMs` (capped stagger). */
export function useRowDelay(beatMs: number): (index: number) => number {
  const m = useMotionPolicy()
  const routeDelay = useRouteEnterDelay()
  return (index: number) =>
    m.reduced ? 0 : m.seconds(routeDelay + beatMs + 120 + Math.min(index, ROW_STAGGER_CAP - 1) * ROW_STAGGER_MS)
}
