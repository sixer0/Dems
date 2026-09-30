import type { Transition, Variants } from 'motion/react'
import { motion as motionTokens } from '@dems/shared/tokens'

/** `slow` is the Motion proof mode (`?motion=slow`, masterplan/01_specs.md §4.5). */
export type MotionMode = 'normal' | 'slow'

/**
 * The only place enter-transition properties are defined (AC-23). Opacity and transform only,
 * so the transition stays compositor-friendly (NFR3).
 */
export const enterVariants: Variants = {
  hidden: { opacity: 0, y: 24, scale: 0.98 },
  visible: { opacity: 1, y: 0, scale: 1 },
}

export function enterTransition(mode: MotionMode): Transition {
  const { spring, choreography, duration, easing, proofSlowFactor } = motionTokens
  const factor = mode === 'slow' ? proofSlowFactor : 1
  const orchestration = {
    staggerChildren: (choreography.stagger * factor) / 1000,
    delayChildren: choreography.delayChildren / 1000,
  }
  if (mode === 'slow') {
    return {
      type: 'tween',
      duration: (duration.slower * proofSlowFactor) / 1000,
      ease: easing.luxe,
      ...orchestration,
    }
  }
  return { type: 'spring', ...spring.gentle, ...orchestration }
}
