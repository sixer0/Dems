/**
 * Token → Motion `Transition` converters (03_motion_spec §2; 11_token_pipeline §3).
 *
 * Every value comes from `motion` in `@dems/shared/tokens`. `timeScale` is 1 normally and
 * `proofSlowFactor` (10) in proof mode: it multiplies every duration, delay and stagger, and turns
 * springs into tweens of `slower` × 10 (01_specs §4.5; 03_motion_spec §12).
 */
import type { DynamicOption, Transition } from 'motion/react'
import {
  motion as tokens,
  type DurationToken,
  type EasingToken,
  type SpringToken,
  type SpringTokenName,
} from '@dems/shared/tokens'

/** Milliseconds (a token value or a documented spec literal) to Motion seconds, time-scaled. */
export function toSeconds(ms: number, timeScale = 1): number {
  return (ms * timeScale) / 1000
}

function durationMs(duration: DurationToken | number): number {
  return typeof duration === 'number' ? duration : tokens.duration[duration]
}

/** A cubic-bezier tween. `duration` is a token name or a spec literal in ms. */
export function tween(
  duration: DurationToken | number,
  easing: EasingToken = 'standard',
  timeScale = 1,
): Transition {
  return {
    type: 'tween',
    duration: toSeconds(durationMs(duration), timeScale),
    ease: tokens.easing[easing],
  }
}

/**
 * A token spring. In proof mode it becomes a tween of `slower` × `timeScale` with `luxe` easing,
 * exactly as 01_specs §4.5 defines M-PX-01.
 */
export function springTransition(name: SpringTokenName, timeScale = 1): Transition {
  if (timeScale !== 1) {
    return {
      type: 'tween',
      duration: toSeconds(tokens.duration.slower, timeScale),
      ease: tokens.easing.luxe,
    }
  }
  const { stiffness, damping, mass } = tokens.spring[name]
  return { type: 'spring', stiffness, damping, mass }
}

/**
 * Spring options for `useSpring`-driven values (AnimatedNumber counters, meter smoothing), which
 * cannot take a tween. Scaling stiffness by 1/f² and damping by 1/f keeps the damping ratio ζ and
 * stretches the settle time by exactly f, so proof mode still slows them tenfold.
 */
export function springOptions(name: SpringTokenName, timeScale = 1): SpringToken {
  const { stiffness, damping, mass } = tokens.spring[name]
  if (timeScale === 1) return { stiffness, damping, mass }
  return { stiffness: stiffness / (timeScale * timeScale), damping: damping / timeScale, mass }
}

export interface StaggerOptions {
  /** ms between siblings (default: token `stagger`, 60). */
  stagger?: number
  /** ms before the first child (default: token `delayChildren`, 80). */
  delayChildren?: number
  /** Children after this many enter together with the last staggered one (default `staggerCap`, 8). */
  cap?: number
}

/**
 * R1: children stagger in reading order after `delayChildren`; the (cap+1)-th child and later enter
 * with the cap-th. Uses Motion's native dynamic `delayChildren` (`(index, total) => seconds`).
 */
export function cappedStagger(options: StaggerOptions = {}, timeScale = 1): DynamicOption<number> {
  const stagger = options.stagger ?? tokens.choreography.stagger
  const delay = options.delayChildren ?? tokens.choreography.delayChildren
  const cap = Math.max(1, options.cap ?? tokens.threshold.staggerCap)
  return (index: number) => toSeconds(delay + stagger * Math.min(index, cap - 1), timeScale)
}

export interface LoopOptions {
  /**
   * `true` (default): out and back, and one full out-and-back cycle equals `periodMs`
   * (breathing, pulsing). `false`: restart each period (rotation), linear by default.
   */
  mirror?: boolean
  /** ms before the first cycle (for phase offsets such as the second camera's Ken Burns). */
  delayMs?: number
  ease?: Transition['ease']
}

/** An ambient loop transition (P2 "ambient" tempo). Only start it when `useAmbientLoop` says so. */
export function loopTransition(periodMs: number, options: LoopOptions = {}, timeScale = 1): Transition {
  const mirror = options.mirror ?? true
  return {
    type: 'tween',
    duration: toSeconds(mirror ? periodMs / 2 : periodMs, timeScale),
    delay: toSeconds(options.delayMs ?? 0, timeScale),
    repeat: Infinity,
    repeatType: mirror ? 'mirror' : 'loop',
    ease: options.ease ?? (mirror ? 'easeInOut' : 'linear'),
  }
}
