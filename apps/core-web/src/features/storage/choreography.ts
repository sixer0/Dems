/**
 * M-PG-STOR choreography (03_motion_spec §6 M-PG-STOR, R1, R3, R4, §8, §9.3).
 *
 * Enter order: the capacity ring sweep (hero moment, starts first), then the legend (stagger), the
 * KPI counters, the AreaChart draw (900 ms) and BarChart grow, the volume bars (fill 700), then the
 * activity list, the calculator and the policy panel. The page is calm: no ambient loop at all.
 * Numbers and charts wait for the "held beat" after their card lands (R4). Under reduced motion
 * everything is at its final value at once (§8), and in `?motion=slow` every delay is ×10.
 */
import { useEffect, useMemo, useState } from 'react'
import type { Variants } from 'motion/react'
import { useRouteEnterDelay } from '@/components/shell'
import { HELD_BEAT_MS, useMotionPolicy, type MotionPolicyValue } from '@/motion'

export type StoragePanelId =
  | 'capacity'
  | 'kpis'
  | 'usage'
  | 'sealed'
  | 'volumes'
  | 'activity'
  | 'calculator'
  | 'policy'

/** Panel beats in ms after the route enter (reading order, 60 ms apart after the KPI row). */
export const PANEL_BEAT_MS: Record<StoragePanelId, number> = {
  capacity: 80,
  kpis: 140,
  usage: 380,
  sealed: 440,
  volumes: 500,
  activity: 560,
  calculator: 620,
  policy: 680,
}

/** The four KPI cards land 60 ms apart, starting on the KPI beat. */
export const KPI_STEP_MS = 60
/** Legend rows reveal 60 ms apart after the ring sweep starts. */
export const LEGEND_STEP_MS = 60

/** A card lands in about `base` (240 ms); data starts one held beat later (R4). */
export const DATA_AFTER_ENTER_MS = 240 + HELD_BEAT_MS
/** The hero ring does not wait for the card to land: its sweep starts 120 ms into the enter. */
export const RING_AFTER_ENTER_MS = HELD_BEAT_MS

/** M-C-03 ring sweep, M-PG-STOR chart draws, volume bar fill and calculator meter (spec values). */
export const RING_SWEEP_MS = 900
export const AREA_DRAW_MS = 900
export const BAR_GROW_MS = 700
export const VOLUME_FILL_MS = 700
export const METER_FILL_MS = 400
/** M-C-03: threshold colour change. */
export const COLOUR_MS = 400

/** R1 panel enter delayed to its beat; reduced motion: opacity only, no delay. */
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

export function usePanelVariants(beatMs: number): Variants {
  const m = useMotionPolicy()
  const routeDelay = useRouteEnterDelay()
  return useMemo(() => panelVariants(m, m.reduced ? 0 : routeDelay + beatMs), [m, routeDelay, beatMs])
}

/** Time-scaled ms from the route enter to `beatMs + afterMs` (0 under reduced motion). */
export function useBeatDelayMs(beatMs: number, afterMs = DATA_AFTER_ENTER_MS): number {
  const m = useMotionPolicy()
  const routeDelay = useRouteEnterDelay()
  return m.flags.animateNumbers ? (routeDelay + beatMs + afterMs) * m.timeScale : 0
}

/**
 * False until the panel's data beat has passed, then true (R4). Values bound to it start at zero
 * and tick or sweep to the real value. Under reduced motion it is true from the first render, so
 * numbers show their final value at once (§8 "Number tickers: jump to final").
 */
export function useDataReady(beatMs: number, afterMs = DATA_AFTER_ENTER_MS): boolean {
  const m = useMotionPolicy()
  const delayMs = useBeatDelayMs(beatMs, afterMs)
  const immediate = !m.flags.animateNumbers
  const [ready, setReady] = useState(immediate)
  useEffect(() => {
    if (immediate || ready) return undefined
    const timer = setTimeout(() => setReady(true), delayMs)
    return () => clearTimeout(timer)
  }, [immediate, ready, delayMs])
  return ready || immediate
}

export interface ChartMotion {
  /** Recharts `isAnimationActive`: only for the mount draw (streaming updates never animate, §9.3). */
  active: boolean
  /** Recharts `animationBegin` / `animationDuration`, ms, time-scaled. */
  begin: number
  duration: number
}

/** Mount animation for a chart that later streams (the usage curve updates at 1 Hz while recording). */
export function useChartMotion(beatMs: number, durationMs: number): ChartMotion {
  const m = useMotionPolicy()
  const begin = useBeatDelayMs(beatMs)
  const duration = durationMs * m.timeScale
  const enabled = m.flags.chartAnimation
  const [done, setDone] = useState(!enabled)
  useEffect(() => {
    if (!enabled || done) return undefined
    const timer = setTimeout(() => setDone(true), begin + duration + 100)
    return () => clearTimeout(timer)
  }, [enabled, done, begin, duration])
  return { active: enabled && !done, begin, duration }
}
