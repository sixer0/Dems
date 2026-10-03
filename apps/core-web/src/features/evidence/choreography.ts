/**
 * M-PG-EVID choreography (03_motion_spec §6 M-PG-EVID, R1–R4, R7, §8, M-C-11).
 *
 * List: the page header (PageHeader, t = 0), then the KPI cards (stagger 60 ms, counters after the
 * held beat), then the toolbar, then the table rows, the hero moment: rows reveal last (R3), 30 ms
 * apart, first 10 only (M-C-11). The sticky preview fades in beside the table.
 * Detail: the evidence header (growing out of the clicked row, H-M1 stored-rect fallback), then the
 * tab strip, then the tab panel; the lifecycle Stepper fills on mount (M-C-09).
 * Reduced motion: opacity only, no delays, no stagger (§8).
 */
import { useMemo } from 'react'
import type { Variants } from 'motion/react'
import { useRouteEnterDelay } from '@/components/shell/shell-motion-context'
import { cappedStagger, useMotionPolicy, type MotionPolicyValue } from '@/motion'

/** Beats in ms after the route enter. */
export const LIST_BEAT_MS = { kpis: 80, toolbar: 320, table: 400, preview: 460 } as const
export const DETAIL_BEAT_MS = { header: 0, tabs: 160, panel: 240, aside: 300 } as const
/** M-C-11: rows start after the table card settles (held beat) and stagger 30 ms, first 10. */
export const ROW_REVEAL_DELAY_MS = LIST_BEAT_MS.table + 120

export function panelVariants(m: MotionPolicyValue, delayMs: number): Variants {
  const base = m.variants.panel
  const visible = base.visible as { transition?: object }
  return {
    ...base,
    visible: { ...(base.visible as object), transition: { ...(visible.transition ?? {}), delay: m.seconds(delayMs) } },
  }
}

/** Panel enter variants (R1) at a beat after the route enter; reduced motion: opacity, no delay. */
export function usePanelVariants(beatMs: number): Variants {
  const m = useMotionPolicy()
  const routeDelay = useRouteEnterDelay()
  return useMemo(() => panelVariants(m, m.reduced ? 0 : routeDelay + beatMs), [m, routeDelay, beatMs])
}

/** A container whose children (`variants={m.variants.row}` or panel) stagger from a beat (R1, cap 8). */
export function useStaggerVariants(beatMs: number, stepMs: number, cap = 8): Variants {
  const m = useMotionPolicy()
  const routeDelay = useRouteEnterDelay()
  return useMemo<Variants>(() => {
    if (m.reduced) return m.variants.rowContainer
    return {
      hidden: {},
      visible: {
        transition: { delayChildren: cappedStagger({ stagger: stepMs, delayChildren: routeDelay + beatMs, cap }, m.timeScale) },
      },
      exit: {},
    }
  }, [m, routeDelay, beatMs, stepMs, cap])
}
