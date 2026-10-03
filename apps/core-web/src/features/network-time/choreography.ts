/**
 * M-PG-NET choreography (03_motion_spec §6 M-PG-NET, R1, R3, R4, R5, §8, §9.4).
 *
 * Enter order: the system-time hero (SlidingNumber clock), the time-source tiers (the active tier
 * carries the `time-tier` highlight), the network cards (the sparkline streams), the domains diagram
 * (AnimatedBeam paths), then the offset chart and the event log. The hero moment is the GNSS orbit.
 * Ambient loops on this page: the orbit, the beams (one shared slot each) and the streaming
 * sparkline, which is data at 1 Hz and never animates (§9.3). Reduced motion: opacity only, no
 * delay, no loops (§8). `?motion=slow` scales every beat ×10.
 */
import { useMemo } from 'react'
import type { Variants } from 'motion/react'
import { useRouteEnterDelay } from '@/components/shell'
import { useMotionPolicy, type MotionPolicyValue } from '@/motion'

export type NetworkTimePanelId = 'system-time' | 'hierarchy' | 'network' | 'domains' | 'offset' | 'log'

export const PANEL_IDS: readonly NetworkTimePanelId[] = ['system-time', 'hierarchy', 'network', 'domains', 'offset', 'log']

/** Panel beats in ms after the route enter (reading order, 60 ms apart after the first row). */
export const PANEL_BEAT_MS: Record<NetworkTimePanelId, number> = {
  'system-time': 80,
  hierarchy: 140,
  network: 380,
  domains: 440,
  offset: 500,
  log: 560,
}

/** R5 registered shared-element id for the active-tier highlight. */
export const TIME_TIER_LAYOUT_ID = 'time-tier'

/** The orbit fades out on GNSS loss and back in on recovery (`slow`, 420 ms). */
export const ORBIT_FADE_MS = 420

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
