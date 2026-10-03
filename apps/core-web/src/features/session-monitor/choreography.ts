/**
 * M-PG-SM choreography helpers (03_motion_spec §6 M-PG-SM, R1, R3, §8).
 */
import { useMemo } from 'react'
import type { Variants } from 'motion/react'
import { useRouteEnterDelay } from '@/components/shell'
import { cappedStagger, useMotionPolicy, type MotionPolicyValue } from '@/motion'

/** Session Monitor panel IDs (research/04 §3.2; 01_specs §14.5.2). K is the page header. */
export type PanelId = 'L' | 'M' | 'N' | 'O' | 'P' | 'Q' | 'R' | 'S' | 'T'

/**
 * M-PG-SM enter beats (ms after the route enter): K 0, L 80, M 140, N 200, O 260, P 320, Q 400,
 * R 460, S 520, T 580. The hero (REC indicator and timer in L) starts first (R3).
 */
export const PANEL_BEAT_MS: Record<PanelId | 'K', number> = {
  K: 0,
  L: 80,
  M: 140,
  N: 200,
  O: 260,
  P: 320,
  Q: 400,
  R: 460,
  S: 520,
  T: 580,
}

/** Panel enter variants (R1) delayed to the panel's beat; reduced motion: opacity only, no delay. */
export function usePanelVariants(beatMs: number): Variants {
  const m = useMotionPolicy()
  const routeDelay = useRouteEnterDelay()
  return useMemo(() => panelVariants(m, m.reduced ? 0 : routeDelay + beatMs), [m, routeDelay, beatMs])
}

export function panelVariants(m: MotionPolicyValue, delayMs: number): Variants {
  const base = m.variants.panel
  const visible = base.visible as { transition?: object }
  return {
    ...base,
    visible: {
      ...(base.visible as object),
      transition: { ...(visible.transition ?? {}), delay: m.seconds(delayMs) },
    },
  }
}

/**
 * Children of a panel that reveal in sequence (M-PG-SM: detail rows 30 ms, integrity checks
 * 80 ms, action buttons 40 ms, audit rows 30 ms; cap 8, R1). Put `variants={m.variants.row}` on
 * each child. Under reduced motion there is no orchestration.
 */
export function useStaggerVariants(beatMs: number, stepMs: number, cap = 8): Variants {
  const m = useMotionPolicy()
  const routeDelay = useRouteEnterDelay()
  return useMemo<Variants>(() => {
    if (m.reduced) return m.variants.rowContainer
    const start = routeDelay + beatMs + 120
    return {
      hidden: {},
      visible: {
        transition: {
          delayChildren: cappedStagger({ stagger: stepMs, delayChildren: start, cap }, m.timeScale),
        },
      },
      exit: {},
    }
  }, [m, routeDelay, beatMs, stepMs, cap])
}

