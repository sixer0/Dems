/**
 * M-PG-DEV choreography (03_motion_spec §6 M-PG-DEV, R1–R4, R8, §8) and the page's structured
 * error record. Kept in a `.ts` module so component files export only components.
 */
import { useMemo } from 'react'
import type { Variants } from 'motion/react'
import { useRouteEnterDelay } from '@/components/shell'
import { cappedStagger, useMotionPolicy, type MotionPolicyValue } from '@/motion'

/** Panel IDs, which are also the `data-testid="panel-<id>"` suffixes (01_specs §14.5.4 regions). */
export type DevicesPanelId = 'cameras' | 'summary' | 'audio' | 'other' | 'search' | 'selector' | 'front' | 'ports'

/**
 * M-PG-DEV enter order (ms after the route enter): camera tiles (media-in) 80, metric cards 160,
 * audio inputs 240, other devices 320, front panel 400, port map 460 (its LEDs switch on 40 ms
 * apart). The hero, the two large meters, **finishes last** (R3): the audio panel's glow blooms
 * once at `HERO_BLOOM_MS`, after the last port LED is lit.
 */
export const PANEL_BEAT_MS: Record<DevicesPanelId, number> = {
  cameras: 80,
  summary: 160,
  audio: 240,
  other: 320,
  // Task 3 R-9 (blueprint row 137): the camera search enters with the selector it stands above.
  search: 340,
  // Task 3 M4 (blueprint row 67): the capture device selector enters with the row it follows.
  selector: 360,
  front: 400,
  ports: 460,
}
export const HERO_BLOOM_MS = 1_150
/** Port LEDs switch on in sequence 40 ms apart (M-PG-DEV). */
export const LED_STAGGER_MS = 40
/** Other-device rows and metric cards stagger (R1 token `stagger`, 60 ms). */
export const ROW_STAGGER_MS = 60

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

/** Panel enter variants on the panel's beat; reduced motion: opacity only, no delay (§8). */
export function usePanelVariants(beatMs: number): Variants {
  const m = useMotionPolicy()
  const routeDelay = useRouteEnterDelay()
  return useMemo(() => panelVariants(m, m.reduced ? 0 : routeDelay + beatMs), [m, routeDelay, beatMs])
}

/**
 * Children that reveal in sequence after their panel settles (R1, R4 held beat). Put
 * `variants={m.variants.row}` (or `fade`) on each child. Reduced motion: no orchestration.
 */
export function useStaggerVariants(beatMs: number, stepMs: number, cap = 8): Variants {
  const m = useMotionPolicy()
  const routeDelay = useRouteEnterDelay()
  return useMemo<Variants>(() => {
    if (m.reduced) return m.variants.rowContainer
    const start = routeDelay + beatMs + 120
    return {
      hidden: {},
      visible: { transition: { delayChildren: cappedStagger({ stagger: stepMs, delayChildren: start, cap }, m.timeScale) } },
      exit: {},
    }
  }, [m, routeDelay, beatMs, stepMs, cap])
}

/** Time-scaled delay (ms, including the route enter) of the hero bloom; null under reduced motion. */
export function useHeroBloomDelayMs(): number | null {
  const m = useMotionPolicy()
  const routeDelay = useRouteEnterDelay()
  return m.reduced || !m.flags.flashes ? null : (routeDelay + HERO_BLOOM_MS) * m.timeScale
}
