import { useEffect, useRef } from 'react'
import { motion, useAnimate } from 'motion/react'
import { motion as tokens } from '@dems/shared/tokens'
import { cn } from '@/lib/utils'
import type { AmbientPriority } from './ambient-registry'
import { GLOW_LEVELS, glowShadow, type GlowLevel, type GlowTone } from './glow'
import { useAmbientLoop } from './use-ambient-loop'
import { useMotionPolicy } from './use-motion-policy'

/** M-C-01: a breathing glow copy moves between these opacities over `glowBreath`. */
const BREATHE_LOW_OPACITY = 0.55
const MIN_PULSE_GAP_MS = 1000 / tokens.threshold.flashMaxHz

export interface GlowLayerProps {
  /** Elevation glow level 0–3 (01_specs §2.7 rev 3). Changing it cross-fades the layers. */
  level: GlowLevel
  /** `brand` (bronze and gold, default) or a status tone. */
  tone?: GlowTone
  /** Ambient breathing of the current level (P3: counts against the 4-loop cap). */
  breathe?: boolean
  /** Name shown in the debug overlay while breathing. */
  loopLabel?: string
  loopPriority?: AmbientPriority
  loopGroup?: string
  /**
   * Change this value to play one bloom pulse (R8 escalation, completion glows). The first value
   * never pulses, and pulses closer than 1/`flashMaxHz` s are dropped (P8).
   */
  pulseKey?: string | number
  /** Bloom length in ms (default token `slow`, 420). */
  pulseDurationMs?: number
  className?: string
}

/**
 * Pre-rendered glow layers whose opacity is the only thing that moves (03_motion_spec §2.2,
 * §9.2). Place it as the first child of a `relative` element with rounded corners; it inherits
 * the radius and takes no pointer events. Under the reduced policy it cross-fades in `fast`,
 * never breathes or pulses, and is marked `data-motion="reduced"` (AC-70).
 */
export function GlowLayer({
  level,
  tone = 'brand',
  breathe = false,
  loopLabel = 'glow-breath',
  loopPriority = 'page',
  loopGroup,
  pulseKey,
  pulseDurationMs = tokens.duration.slow,
  className,
}: GlowLayerProps) {
  const { transitions, flags, loop, seconds } = useMotionPolicy()
  const rootRef = useRef<HTMLSpanElement>(null)
  const breathing = useAmbientLoop(loopLabel, {
    ref: rootRef,
    priority: loopPriority,
    group: loopGroup,
    enabled: breathe && level > 0,
  })
  const [bloomRef, animateBloom] = useAnimate<HTMLSpanElement>()
  const lastPulse = useRef<{ key: string | number | undefined; at: number }>({
    key: pulseKey,
    at: Number.NEGATIVE_INFINITY,
  })

  useEffect(() => {
    const previous = lastPulse.current
    if (pulseKey === undefined || pulseKey === previous.key) return
    previous.key = pulseKey
    const now = performance.now()
    if (!flags.flashes || now - previous.at < MIN_PULSE_GAP_MS || !bloomRef.current) return
    previous.at = now
    void animateBloom(
      bloomRef.current,
      { opacity: [0, 1, 0] },
      { duration: seconds(pulseDurationMs), ease: tokens.easing.standard },
    )
  }, [pulseKey, flags.flashes, pulseDurationMs, seconds, animateBloom, bloomRef])

  const breathingNow = breathing.running
  const breathTransition = loop(tokens.ambient.glowBreath)

  return (
    <span
      ref={rootRef}
      aria-hidden
      data-testid="glow-layer"
      data-glow-level={level}
      data-glow-tone={tone}
      {...breathing.attrs}
      className={cn('pointer-events-none absolute inset-0 rounded-[inherit]', className)}
    >
      {GLOW_LEVELS.map((layer) => {
        const active = layer === level
        const breathes = active && breathingNow
        return (
          <motion.span
            key={layer}
            data-glow-layer={layer}
            className="absolute inset-0 rounded-[inherit]"
            style={{ boxShadow: glowShadow(tone, layer) }}
            initial={false}
            animate={breathes ? { opacity: [BREATHE_LOW_OPACITY, 1] } : { opacity: active ? 1 : 0 }}
            transition={breathes ? breathTransition : transitions.glow}
          />
        )
      })}
      <span
        ref={bloomRef}
        data-glow-layer="bloom"
        className="absolute inset-0 rounded-[inherit] opacity-0"
        style={{ boxShadow: glowShadow(tone, 3) }}
      />
    </span>
  )
}
