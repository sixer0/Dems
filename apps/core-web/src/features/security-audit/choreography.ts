/**
 * M-PG-SEC choreography (03_motion_spec §6 M-PG-SEC, R1, R3, R4, §8).
 *
 * Enter order: the posture shield first (the hero moment: scale 0.9 → 1 with a glow bloom), then
 * the controls checklist (checks draw one by one), keys and certificates, the hash-chain strip
 * (links light in sequence), the audit table (rows stagger, M-C-11), then the lenses and access
 * control. The strip sits above the table on this page (DR-51-1), so the spec's sequence
 * "controls → table → strip → keys" is played in reading order (R1) with the hero first (R3).
 */
import { useMemo } from 'react'
import type { Variants } from 'motion/react'
import { useRouteEnterDelay } from '@/components/shell'
import { cappedStagger, useMotionPolicy, type MotionPolicyValue } from '@/motion'

export type PanelId = 'posture' | 'controls' | 'keys' | 'chain' | 'audit' | 'auth' | 'tamper' | 'custody' | 'rbac'

/** Enter beat per panel, in ms after the route enter. */
export const PANEL_BEAT_MS: Record<PanelId, number> = {
  posture: 0,
  controls: 100,
  keys: 180,
  chain: 260,
  audit: 340,
  auth: 420,
  tamper: 470,
  custody: 520,
  rbac: 580,
}

/** M-C-21: chain links light up in sequence, 80 ms apart (opacity 0.3 → 1). */
export const CHAIN_LINK_STAGGER_MS = 80
/** M-PG-SEC: controls checks draw one by one (same 80 ms rhythm as SM N). */
export const CONTROL_STAGGER_MS = 80
/** Held beat (R4) before panel content starts. */
export const CONTENT_BEAT_MS = 120

export function panelVariants(m: MotionPolicyValue, delayMs: number, hero = false): Variants {
  const base = hero ? m.variants.hero : m.variants.panel
  const visible = base.visible as { transition?: object }
  if (m.reduced) return base
  const heroHidden = hero ? { ...(base.hidden as object), scale: 0.9, y: 0 } : base.hidden
  return {
    ...base,
    hidden: heroHidden as Variants[string],
    visible: {
      ...(base.visible as object),
      transition: { ...(visible.transition ?? {}), delay: m.seconds(delayMs) },
    },
  }
}

/** Panel enter variants (R1) delayed to the panel's beat; reduced motion: opacity only, no delay. */
export function usePanelVariants(beatMs: number, hero = false): Variants {
  const m = useMotionPolicy()
  const routeDelay = useRouteEnterDelay()
  return useMemo(() => panelVariants(m, routeDelay + beatMs, hero), [m, routeDelay, beatMs, hero])
}

/** Stagger container for a panel's children (put `variants={m.variants.row}` on each child). */
export function useStaggerVariants(beatMs: number, stepMs: number, cap = 8): Variants {
  const m = useMotionPolicy()
  const routeDelay = useRouteEnterDelay()
  return useMemo<Variants>(() => {
    if (m.reduced) return m.variants.rowContainer
    const start = routeDelay + beatMs + CONTENT_BEAT_MS
    return {
      hidden: {},
      visible: { transition: { delayChildren: cappedStagger({ stagger: stepMs, delayChildren: start, cap }, m.timeScale) } },
      exit: {},
    }
  }, [m, routeDelay, beatMs, stepMs, cap])
}
