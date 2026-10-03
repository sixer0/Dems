/**
 * Motion variants built from the motion tokens (03_motion_spec §2, §3, §8).
 *
 * `buildMotionKit(policy, timeScale)` returns one coherent set per policy:
 * - **full**: R1 enter (opacity + rise + scale, spring `gentle`, capped stagger), R2 exit
 *   (opacity + `exitDrop`, `fast`, `exit` easing, no stagger), R4 held beat, R5 layout spring,
 *   R7 direction-aware route and step variants;
 * - **reduced** (§8): opacity only, at most `fast` (160 ms), no stagger, no blur, no flights,
 *   no flashes; ambient loops off.
 *
 * Only opacity, transform and (small-element) blur are animated, never layout properties or
 * shadows (§9.2, AC-72, MS-01, MS-02). Glow changes go through `GlowLayer` opacity.
 *
 * Values that the spec gives as literals rather than tokens (the 120 ms held beat, the 30 ms / 10
 * row stagger of M-C-11, the 600 ms media-in and halo) are used as documented literals (D49).
 */
import type { TargetAndTransition, Transition, Variants } from 'motion/react'
import { motion as tokens, type SpringToken, type SpringTokenName } from '@dems/shared/tokens'
import type { MotionPolicy } from './policy'
import {
  cappedStagger,
  loopTransition,
  springOptions,
  springTransition,
  toSeconds,
  tween,
  type LoopOptions,
} from './transitions'

/** R4 "held beat": numbers and charts start this long after their card settles (literal, D49). */
export const HELD_BEAT_MS = 120
/** M-C-11: table rows stagger 30 ms, and only the first 10 rows stagger (literals). */
export const ROW_STAGGER_MS = 30
export const ROW_STAGGER_CAP = 10
/** M-C-11: rows leaving a filtered table fade over 120 ms (literal). */
export const ROW_EXIT_MS = 120
/** M-C-12: camera tile first paint, blur `mediaIn` → 0 over 600 ms `luxe` (literal). */
export const MEDIA_IN_MS = 600
/** M-C-10: escalation halo, scale 1 → 1.35 while fading 0.5 → 0 over 600 ms (literals). */
export const HALO_MS = 600
export const HALO_SCALE = 1.35
/** M-C-16: card hover lift and glow fade take 200 ms `standard` (literal). */
export const HOVER_MS = 200
/** M-C-16: icon-only buttons press to 0.94 (literal). */
export const ICON_PRESS_SCALE = 0.94
/** §8: reduced meters update directly at 10 Hz. */
export const REDUCED_METER_HZ = 10

export interface MotionTransitionSet {
  /** The `MotionConfig` default for motion components that set no transition of their own. */
  default: Transition
  /** R1 enter: spring `gentle`. */
  enter: Transition
  /** R2 exit: `fast`, `exit` easing. */
  exit: Transition
  /** P2 feedback (press, toggle): spring `snappy`. */
  feedback: Transition
  /** P4 completion moments only (SEALED, PASS, badge pop): spring `bouncy`. */
  completion: Transition
  /** Sidebar and tab indicators (`layoutId`): spring `indicator`. */
  indicator: Transition
  /** R5 shared-element position and size: spring `gentle` (instant under reduced motion). */
  layout: Transition
  /** R5 content cross-fade: `base`, `standard`. */
  crossFade: Transition
  /** Glow level cross-fade (§2.2): `base`, `standard`. */
  glow: Transition
  /** M-C-11 row reveal: `base`, `standard`. */
  row: Transition
}

export interface MotionVariantSet {
  /** R1 panel enter / R2 exit. States: hidden, visible, exit. */
  panel: Variants
  /** Hero element enter (`riseLg`). States: hidden, visible, exit. */
  hero: Variants
  /** M-C-11 table or list row (`riseSm`). States: hidden, visible, exit. */
  row: Variants
  /** Opacity only. States: hidden, visible, exit. */
  fade: Variants
  /** Rack focus (§1): blur `focusIn` → 0 with an opacity rise. Small text only (§9.2). */
  rackFocus: Variants
  /** M-C-12 first paint: blur `mediaIn` → 0, once. */
  mediaIn: Variants
  /** R1 stagger container (60 ms after 80 ms, capped at 8). States: hidden, visible, exit. */
  container: Variants
  /** M-C-11 table container (30 ms, first 10 rows). States: hidden, visible, exit. */
  rowContainer: Variants
  /** M-APP-04 content area. `custom` = +1 forward, −1 back (R7). States: hidden, visible, exit. */
  route: Variants
  /**
   * M-C-09 wizard content for Motion Primitives `TransitionPanel`: states enter, center, exit;
   * `custom` = +1 next step, −1 previous step (R7).
   */
  step: Variants
  /** M-C-09 SEALED stamp (`stampFrom` → 1, spring `bouncy`). States: hidden, visible. */
  stamp: Variants
  /** M-C-10 one escalation halo pulse; remount with a new `key` to replay. States: hidden, visible. */
  halo: Variants
}

export interface MotionInteractionSet {
  /** M-C-16 pressable card: lift `hoverLift`, press `press` (spring `snappy`). */
  card: { whileHover: TargetAndTransition; whileTap: TargetAndTransition }
  /** Buttons: press `press`. */
  press: { whileTap: TargetAndTransition }
  /** Icon-only buttons: press 0.94. */
  iconPress: { whileTap: TargetAndTransition }
  /** Media tiles only: hover scale `hover`. */
  mediaTile: { whileHover: TargetAndTransition }
}

/** What the reduced-motion policy switches off (03_motion_spec §8), for components to consult. */
export interface MotionFlags {
  /** Ambient loops may run (still subject to `useAmbientLoop` visibility and the cap). */
  ambient: boolean
  stagger: boolean
  /** `layoutId` flights; when false, cross-fade at the destination instead. */
  sharedLayout: boolean
  /** Rack-focus and media-in blur. */
  blur: boolean
  /** Tickers spring or slide; when false, values jump to final. */
  animateNumbers: boolean
  /** One-shot flashes (shutter, clip, bloom); when false, use a static colour or border change. */
  flashes: boolean
  /** Recharts `isAnimationActive` for static datasets (streaming series are always false). */
  chartAnimation: boolean
  /** Meter smoothing spring (`meter`, time-scaled); `null` means set the value directly. */
  meterSpring: SpringToken | null
  /** Meter update cap in Hz; `null` means every simulator frame (20 Hz). */
  meterMaxHz: number | null
  /** P8: fast-changing number text updates at most this often. */
  numberTextMaxHz: number
}

export interface MotionKit {
  policy: MotionPolicy
  timeScale: number
  transitions: MotionTransitionSet
  variants: MotionVariantSet
  interactions: MotionInteractionSet
  flags: MotionFlags
  /** Time-scaled delays in seconds. */
  delays: { heldBeat: number }
  /** Milliseconds → time-scaled Motion seconds (for kit and copied-in item `duration` props). */
  seconds: (ms: number) => number
  /** A token spring transition (a tween in proof mode). */
  spring: (name: SpringTokenName) => Transition
  /** Time-scaled spring options for `useSpring` consumers. */
  springOptions: (name: SpringTokenName) => SpringToken
  /** An ambient loop transition, time-scaled. */
  loop: (periodMs: number, options?: LoopOptions) => Transition
}

const { distance, scale, blur } = tokens

function buildFull(timeScale: number): Pick<MotionKit, 'transitions' | 'variants' | 'interactions'> {
  const enter = springTransition('gentle', timeScale)
  const exit = tween('fast', 'exit', timeScale)
  const transitions: MotionTransitionSet = {
    default: enter,
    enter,
    exit,
    feedback: springTransition('snappy', timeScale),
    completion: springTransition('bouncy', timeScale),
    indicator: springTransition('indicator', timeScale),
    layout: enter,
    crossFade: tween('base', 'standard', timeScale),
    glow: tween('base', 'standard', timeScale),
    row: tween('base', 'standard', timeScale),
  }

  const riseVariants = (rise: number): Variants => ({
    hidden: { opacity: 0, y: rise, scale: scale.enterFrom },
    visible: { opacity: 1, y: 0, scale: 1, transition: enter },
    exit: { opacity: 0, y: -distance.exitDrop, transition: exit },
  })

  const variants: MotionVariantSet = {
    panel: riseVariants(distance.rise),
    hero: riseVariants(distance.riseLg),
    row: {
      hidden: { opacity: 0, y: distance.riseSm },
      visible: { opacity: 1, y: 0, transition: transitions.row },
      exit: { opacity: 0, transition: tween(ROW_EXIT_MS, 'exit', timeScale) },
    },
    fade: {
      hidden: { opacity: 0 },
      visible: { opacity: 1, transition: transitions.crossFade },
      exit: { opacity: 0, transition: exit },
    },
    rackFocus: {
      hidden: { opacity: 0, filter: `blur(${blur.focusIn}px)` },
      visible: { opacity: 1, filter: 'blur(0px)', transition: tween('slow', 'luxe', timeScale) },
      exit: { opacity: 0, transition: exit },
    },
    mediaIn: {
      hidden: { opacity: 0, filter: `blur(${blur.mediaIn}px)` },
      visible: { opacity: 1, filter: 'blur(0px)', transition: tween(MEDIA_IN_MS, 'luxe', timeScale) },
      exit: { opacity: 0, transition: exit },
    },
    container: {
      hidden: {},
      visible: { transition: { delayChildren: cappedStagger({}, timeScale) } },
      exit: {},
    },
    rowContainer: {
      hidden: {},
      visible: {
        transition: {
          delayChildren: cappedStagger(
            { stagger: ROW_STAGGER_MS, delayChildren: 0, cap: ROW_STAGGER_CAP },
            timeScale,
          ),
        },
      },
      exit: {},
    },
    route: {
      hidden: (direction: number = 1) => ({ opacity: 0, y: direction * distance.rise }),
      visible: { opacity: 1, y: 0, transition: enter },
      exit: { opacity: 0, transition: exit },
    },
    step: {
      enter: (direction: number = 1) => ({ opacity: 0, x: direction * distance.riseLg }),
      center: { opacity: 1, x: 0, transition: enter },
      exit: (direction: number = 1) => ({ opacity: 0, x: -direction * distance.riseLg, transition: exit }),
    },
    stamp: {
      hidden: { opacity: 0, scale: scale.stampFrom },
      visible: { opacity: 1, scale: 1, transition: transitions.completion },
    },
    halo: {
      hidden: { opacity: 0.5, scale: 1 },
      visible: { opacity: 0, scale: HALO_SCALE, transition: tween(HALO_MS, 'standard', timeScale) },
    },
  }

  const interactions: MotionInteractionSet = {
    card: {
      whileHover: { y: -distance.hoverLift, transition: tween(HOVER_MS, 'standard', timeScale) },
      whileTap: { scale: scale.press, transition: transitions.feedback },
    },
    press: { whileTap: { scale: scale.press, transition: transitions.feedback } },
    iconPress: { whileTap: { scale: ICON_PRESS_SCALE, transition: transitions.feedback } },
    mediaTile: {
      whileHover: { scale: scale.hover, transition: tween(HOVER_MS, 'standard', timeScale) },
    },
  }

  return { transitions, variants, interactions }
}

function buildReduced(timeScale: number): Pick<MotionKit, 'transitions' | 'variants' | 'interactions'> {
  // §8: every enter and exit is opacity only and at most `fast`; nothing staggers or travels.
  const fade = tween('fast', 'standard', timeScale)
  const exit = tween('fast', 'exit', timeScale)
  const transitions: MotionTransitionSet = {
    default: fade,
    enter: fade,
    exit,
    feedback: fade,
    completion: fade,
    indicator: fade,
    layout: { duration: 0 },
    crossFade: fade,
    glow: fade,
    row: fade,
  }

  // Only opacity animates. `visible` also pins every transform or filter key that the full set
  // animates, at its resting value: when the policy flips to reduced on a live page, a key that
  // simply disappeared from the target would make Motion return it to its mount-time `initial`
  // value (a settled card would drop 12 px). Pinned at rest, nothing that has landed moves.
  const opacityIn = (rest: Record<string, number | string> = {}): Variants => ({
    hidden: { opacity: 0 },
    visible: { opacity: 1, ...rest, transition: fade },
    exit: { opacity: 0, transition: exit },
  })
  const noOrchestration: Variants = { hidden: {}, visible: {}, exit: {} }
  const unblurred = { filter: 'blur(0px)' }

  const variants: MotionVariantSet = {
    panel: opacityIn({ y: 0, scale: 1 }),
    hero: opacityIn({ y: 0, scale: 1 }),
    row: opacityIn({ y: 0 }),
    fade: opacityIn(),
    rackFocus: opacityIn(unblurred),
    mediaIn: opacityIn(unblurred),
    container: noOrchestration,
    rowContainer: noOrchestration,
    route: opacityIn({ y: 0 }),
    step: {
      enter: { opacity: 0 },
      center: { opacity: 1, x: 0, transition: fade },
      exit: { opacity: 0, transition: exit },
    },
    stamp: { hidden: { opacity: 0 }, visible: { opacity: 1, scale: 1, transition: fade } },
    // No pulse: the colour change carries the escalation (R8, §8 flashes).
    halo: { hidden: { opacity: 0 }, visible: { opacity: 0, scale: 1, transition: { duration: 0 } } },
  }

  const interactions: MotionInteractionSet = {
    card: { whileHover: {}, whileTap: {} },
    press: { whileTap: {} },
    iconPress: { whileTap: {} },
    mediaTile: { whileHover: {} },
  }

  return { transitions, variants, interactions }
}

/** One coherent motion kit for a policy and time scale. Pure; memoise per (policy, timeScale). */
export function buildMotionKit(policy: MotionPolicy, timeScale = 1): MotionKit {
  const reduced = policy === 'reduced'
  const sets = reduced ? buildReduced(timeScale) : buildFull(timeScale)
  const flags: MotionFlags = {
    ambient: !reduced,
    stagger: !reduced,
    sharedLayout: !reduced,
    blur: !reduced,
    animateNumbers: !reduced,
    flashes: !reduced,
    chartAnimation: !reduced,
    meterSpring: reduced ? null : springOptions('meter', timeScale),
    meterMaxHz: reduced ? REDUCED_METER_HZ : null,
    numberTextMaxHz: tokens.threshold.numberTextMaxHz,
  }
  return {
    policy,
    timeScale,
    ...sets,
    flags,
    delays: { heldBeat: toSeconds(HELD_BEAT_MS, timeScale) },
    seconds: (ms) => toSeconds(ms, timeScale),
    spring: (name) => (reduced ? sets.transitions.enter : springTransition(name, timeScale)),
    springOptions: (name) => springOptions(name, timeScale),
    loop: (periodMs, options) => loopTransition(periodMs, options, timeScale),
  }
}
