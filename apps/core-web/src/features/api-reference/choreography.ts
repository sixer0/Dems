/**
 * M-PG-API choreography (03_motion_spec §6 M-PG-API, R1, §8).
 *
 * Enter: the page header (the shell's template), then the server-strip chips (stagger), then the
 * renderer panel (opacity fade 240; Scalar paints at once, with no internal stagger), then the
 * Realtime panel, whose hero moment is the first heartbeat pulse. The only ambient motion is the
 * 1 Hz heartbeat pulse, which is data. "Show simulated endpoints" cross-fades the renderer (160),
 * because Scalar re-renders. Reduced motion: opacity only, no delay, no stagger (§8).
 */
import { useMemo } from 'react'
import type { Transition, Variants } from 'motion/react'
import { useRouteEnterDelay } from '@/components/shell'
import { useMotionPolicy, type MotionPolicyValue } from '@/motion'

export type ApiPanelId = 'strip' | 'renderer' | 'realtime'

/** Beats in ms after the route enter. */
export const PANEL_BEAT_MS: Record<ApiPanelId, number> = {
  strip: 80,
  renderer: 260,
  realtime: 420,
}

/** Renderer panel enter: opacity only over `base` (240 ms). */
export const RENDERER_FADE_MS = 240
/** Renderer cross-fade when the simulated filter changes (`fast`, 160 ms). */
export const RENDERER_SWAP_MS = 160

function withDelay(base: Variants, m: MotionPolicyValue, delayMs: number): Variants {
  const visible = base.visible as { transition?: Transition }
  return {
    ...base,
    visible: { ...(base.visible as object), transition: { ...(visible.transition ?? {}), delay: m.seconds(delayMs) } },
  }
}

/** R1 panel enter at its beat (reduced: opacity only, no delay). */
export function usePanelVariants(id: ApiPanelId): Variants {
  const m = useMotionPolicy()
  const routeDelay = useRouteEnterDelay()
  return useMemo(
    () => withDelay(id === 'renderer' ? rendererFade(m) : m.variants.panel, m, m.reduced ? 0 : routeDelay + PANEL_BEAT_MS[id]),
    [m, routeDelay, id],
  )
}

function rendererFade(m: MotionPolicyValue): Variants {
  return {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { duration: m.seconds(m.reduced ? 160 : RENDERER_FADE_MS), ease: [0.2, 0, 0, 1] } },
    exit: { opacity: 0, transition: m.transitions.exit },
  }
}

/** The server-strip chip stagger (R1 container), delayed to the strip beat. */
export function useStripVariants(): { container: Variants; item: Variants } {
  const m = useMotionPolicy()
  const routeDelay = useRouteEnterDelay()
  return useMemo(() => {
    const delay = m.reduced ? 0 : routeDelay + PANEL_BEAT_MS.strip
    const container = m.variants.container
    const visible = container.visible as { transition?: Transition }
    return {
      container: {
        ...container,
        visible: { ...(container.visible as object), transition: { ...(visible.transition ?? {}), delayChildren: m.seconds(delay) } },
      },
      item: m.variants.row,
    }
  }, [m, routeDelay])
}
