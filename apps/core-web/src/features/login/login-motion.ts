/**
 * Motion props for the Login page's elements, built from the motion kit (03_motion_spec §2, §3
 * R1/R2, §8) and the page choreography (`login-choreography.ts`).
 *
 * Each element enters once (`initial` → `animate`) and, when the hand-off starts, fades with the
 * M-APP-01 schedule. Only opacity, transform and (small text only) blur move (§9.2, AC-72).
 */
import type { TargetAndTransition, Transition } from 'motion/react'
import { motion as tokens } from '@dems/shared/tokens'
import { springTransition, tween, type MotionPolicyValue } from '@/motion'
import { HANDOFF } from './login-choreography'

export interface RevealOptions {
  /** Entrance delay in ms (unscaled). */
  delayMs: number
  /** Entrance rise in px (R1); 0 for a fade. */
  rise?: number
  /** Rack focus (§1): blur `focusIn` → 0. Small text only (§9.2). */
  rackFocus?: boolean
  /** The M-APP-01 hand-off has started: fade out on the hand-off schedule. */
  leaving: boolean
  /** Hand-off fade start (ms), default `HANDOFF.fadeDelayMs`. */
  exitDelayMs?: number
  /** Hand-off fade length (ms), default `HANDOFF.fadeMs`. */
  exitMs?: number
}

export interface RevealProps {
  initial: TargetAndTransition
  animate: TargetAndTransition
  transition: Transition
}

/** Enter (R1, or opacity-only under §8) and leave (M-APP-01) for one element. */
export function revealProps(m: MotionPolicyValue, options: RevealOptions): RevealProps {
  const { delayMs, rise = 0, rackFocus = false, leaving } = options
  const exitDelayMs = options.exitDelayMs ?? HANDOFF.fadeDelayMs
  const exitMs = options.exitMs ?? HANDOFF.fadeMs

  if (m.reduced) {
    const fade = tween('fast', 'standard', m.timeScale)
    return {
      initial: { opacity: 0 },
      animate: leaving ? { opacity: 0 } : { opacity: 1, y: 0, filter: 'blur(0px)' },
      transition: leaving ? tween(HANDOFF.reducedFadeMs, 'exit', m.timeScale) : fade,
    }
  }

  const blur = rackFocus && m.flags.blur
  const enter: Transition = blur
    ? {
        ...springTransition('gentle', m.timeScale),
        filter: tween('slow', 'luxe', m.timeScale),
        opacity: tween('slow', 'luxe', m.timeScale),
        delay: m.seconds(delayMs),
      }
    : { ...springTransition('gentle', m.timeScale), delay: m.seconds(delayMs) }

  return {
    initial: { opacity: 0, y: rise, ...(blur ? { filter: `blur(${tokens.blur.focusIn}px)` } : {}) },
    animate: leaving ? { opacity: 0 } : { opacity: 1, y: 0, ...(blur ? { filter: 'blur(0px)' } : {}) },
    transition: leaving ? { ...tween(exitMs, 'exit', m.timeScale), delay: m.seconds(exitDelayMs) } : enter,
  }
}
