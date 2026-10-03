/**
 * Shell choreography (03_motion_spec §4 M-APP-01..03 shell side; R1, R2, R5; §8 reduced motion).
 *
 * One variant set per shell part, all with the kit's state names (`hidden`, `visible`, `exit`), so
 * the AppShell root drives every part through Motion's variant propagation: the root sets
 * `initial` and `animate`, and each part only declares `variants`. Timings are relative to the
 * moment the shell mounts.
 *
 * | Entrance | Emblem | Top bar (bg, cluster) | Wordmark | Sidebar | Content (page R1) |
 * |---|---|---|---|---|---|
 * | handoff (M-APP-01) | shared `layoutId` flight from Login | +150 drop-in `y -24 → 0` | rack-focus +150 | +230 `x -24 → 0`, items 30 ms apart | +350 |
 * | cold (M-APP-03) | strokes draw: shield 500, arcs 70 ms apart | fade +600 (240) | rack-focus +600 | fade +600 (240) | +600 |
 * | plain | static | none | none | none | 0 |
 *
 * The hand-off offsets are the spec timeline re-based to the flight start (450 → 0: top bar 600,
 * sidebar 680, panels 800). Exit (M-APP-02, sign out): content at 0, sidebar at `stagger` (60),
 * top bar at 2 × `stagger`, each `fast` with `exit` easing (R2); the emblem stays for the flight
 * back. Reduced motion (§8): every part is opacity only, at most `fast`, with no delay or stagger.
 *
 * Spec literals (not tokens, D49): 150 / 230 / 350 hand-off offsets, the 30 ms item stagger,
 * 600 ms cold-entry beat, 500 ms shield draw and 70 ms arc spacing.
 */
import type { Transition, Variants } from 'motion/react'
import { motion as tokens } from '@dems/shared/tokens'
import { cappedStagger, tween, type MotionKit } from '@/motion'
import type { ShellEntrance } from './shell-entrance'

/** M-APP-01 shell-side offsets (ms after the shell mounts). */
export const HANDOFF_TOP_BAR_MS = 150
export const HANDOFF_SIDEBAR_MS = 230
export const HANDOFF_CONTENT_MS = 350
/** M-APP-01: sidebar items stagger 30 ms. */
export const HANDOFF_ITEM_STAGGER_MS = 30
/** M-APP-03: the wordmark and the rest of the shell arrive at t = 600. */
export const COLD_BEAT_MS = 600
/** M-APP-03: the shield stroke draws over 500 ms, then the six arcs start 70 ms apart. */
export const COLD_SHIELD_MS = 500
export const COLD_ARC_STAGGER_MS = 70
/** Drop-in and slide-in distance (M-APP-01: `y -24 → 0`, `x -24 → 0`) = token `riseLg`. */
const ENTER_OFFSET = tokens.distance.riseLg

export interface EmblemDrawTiming {
  /** Shield stroke draw (ms). */
  shieldMs: number
  /** Each arc's draw (ms). */
  arcMs: number
  /** Arc `n` (1-based) starts at `shieldMs + (n - 1) × arcStaggerMs`. */
  arcStaggerMs: number
}

export interface ShellChoreography {
  entrance: ShellEntrance
  /** `initial` for the shell root: `false` for a plain arrival (everything starts at rest). */
  initial: false | 'hidden'
  root: Variants
  topBar: Variants
  wordmark: Variants
  sidebar: Variants
  navItem: Variants
  bottomTabs: Variants
  /** Delay before the first page's R1 enter (ms, unscaled). */
  contentDelayMs: number
  /** M-APP-03 stroke draw, or `null` when the emblem does not draw. */
  emblemDraw: EmblemDrawTiming | null
}

const REST: Variants = { hidden: {}, visible: {}, exit: {} }

function withDelay(transition: Transition, delayMs: number, kit: MotionKit): Transition {
  return delayMs > 0 ? { ...transition, delay: kit.seconds(delayMs) } : transition
}

/** Builds the variants for one shell mount. Pure; memoise per (entrance, kit). */
export function buildShellChoreography(entrance: ShellEntrance, kit: MotionKit): ShellChoreography {
  const reduced = kit.policy === 'reduced'
  const exit = kit.transitions.exit
  const exitStep = tokens.choreography.stagger
  // The root only orchestrates: it waits for every part before reporting the exit complete.
  const root: Variants = {
    hidden: {},
    visible: {},
    exit: { transition: { when: 'afterChildren' } },
  }

  if (reduced) {
    // §8: opacity only, at most `fast`, no delay or stagger; the Login hand-off is a cross-fade.
    // `visible` pins the keys the full set moves at their resting value (step-36 D-1), so a live
    // switch to reduced motion never makes a settled part jump.
    const fade = (rest: Record<string, number | string>): Variants => ({
      hidden: { opacity: 0 },
      visible: { opacity: 1, ...rest, transition: kit.transitions.enter },
      exit: { opacity: 0, transition: exit },
    })
    const animated = entrance !== 'plain'
    return {
      entrance,
      initial: animated ? 'hidden' : false,
      root,
      topBar: fade({ y: 0 }),
      wordmark: fade({ filter: 'blur(0px)' }),
      sidebar: fade({ x: 0 }),
      navItem: { hidden: {}, visible: { opacity: 1, x: 0 }, exit: {} },
      bottomTabs: fade({ y: 0 }),
      contentDelayMs: 0,
      emblemDraw: null,
    }
  }

  const exitAfter = (steps: number): Transition => withDelay(exit, steps * exitStep, kit)
  const topBarExit = { opacity: 0, y: -tokens.distance.exitDrop, transition: exitAfter(2) }
  const sidebarExit = { opacity: 0, x: -tokens.distance.exitDrop, transition: exitAfter(1) }

  if (entrance === 'handoff') {
    const enter = kit.transitions.enter
    return {
      entrance,
      initial: 'hidden',
      root,
      topBar: {
        hidden: { opacity: 0, y: -ENTER_OFFSET },
        visible: { opacity: 1, y: 0, transition: withDelay(enter, HANDOFF_TOP_BAR_MS, kit) },
        exit: topBarExit,
      },
      wordmark: {
        hidden: { opacity: 0, filter: `blur(${tokens.blur.focusIn}px)` },
        visible: {
          opacity: 1,
          filter: 'blur(0px)',
          transition: withDelay(tween('slow', 'luxe', kit.timeScale), HANDOFF_TOP_BAR_MS, kit),
        },
        exit: {},
      },
      sidebar: {
        hidden: { opacity: 0, x: -ENTER_OFFSET },
        visible: {
          opacity: 1,
          x: 0,
          transition: {
            ...withDelay(enter, HANDOFF_SIDEBAR_MS, kit),
            // Items follow the panel, 30 ms apart in reading order (R1 cap of 8 applies).
            delayChildren: cappedStagger(
              { stagger: HANDOFF_ITEM_STAGGER_MS, delayChildren: HANDOFF_SIDEBAR_MS },
              kit.timeScale,
            ),
          },
        },
        exit: sidebarExit,
      },
      navItem: {
        hidden: { opacity: 0, x: -tokens.distance.exitDrop },
        visible: { opacity: 1, x: 0, transition: enter },
        exit: {},
      },
      bottomTabs: {
        hidden: { opacity: 0, y: ENTER_OFFSET },
        visible: { opacity: 1, y: 0, transition: withDelay(enter, HANDOFF_SIDEBAR_MS, kit) },
        exit: { opacity: 0, transition: exitAfter(1) },
      },
      contentDelayMs: HANDOFF_CONTENT_MS,
      emblemDraw: null,
    }
  }

  if (entrance === 'cold') {
    const shellFade = withDelay(tween('base', 'standard', kit.timeScale), COLD_BEAT_MS, kit)
    const fadeIn = (exitState: Variants[string]): Variants => ({
      hidden: { opacity: 0 },
      visible: { opacity: 1, transition: shellFade },
      exit: exitState,
    })
    return {
      entrance,
      initial: 'hidden',
      root,
      topBar: fadeIn(topBarExit),
      wordmark: {
        hidden: { opacity: 0, filter: `blur(${tokens.blur.focusIn}px)` },
        visible: {
          opacity: 1,
          filter: 'blur(0px)',
          transition: withDelay(tween('slow', 'luxe', kit.timeScale), COLD_BEAT_MS, kit),
        },
        exit: {},
      },
      sidebar: fadeIn(sidebarExit),
      navItem: REST,
      bottomTabs: fadeIn({ opacity: 0, transition: exitAfter(1) }),
      contentDelayMs: COLD_BEAT_MS,
      emblemDraw: {
        shieldMs: COLD_SHIELD_MS,
        arcMs: tokens.duration.base,
        arcStaggerMs: COLD_ARC_STAGGER_MS,
      },
    }
  }

  // plain: nothing enters (the root's `initial={false}`), but sign out still exits (M-APP-02).
  return {
    entrance,
    initial: false,
    root,
    topBar: { hidden: {}, visible: { opacity: 1, y: 0 }, exit: topBarExit },
    wordmark: REST,
    sidebar: { hidden: {}, visible: { opacity: 1, x: 0 }, exit: sidebarExit },
    navItem: REST,
    bottomTabs: { hidden: {}, visible: { opacity: 1 }, exit: { opacity: 0, transition: exitAfter(1) } },
    contentDelayMs: 0,
    emblemDraw: null,
  }
}
