/**
 * Dashboard choreography (03_motion_spec M-PG-DASH, R1–R4, R9; §8 reduced motion).
 *
 * The beats are the M-PG-DASH table, relative to the route enter (M-APP-04): the hero photo
 * and overline at 0, the tagline at 120, the status strip at 250 (cells 50 ms apart), row 2
 * at 450, row 3 at 650, row 4 at 850, and the hero moment, the SYSTEM READY ring sweep, from
 * 900 to about 1,800. Panels inherit the route wrapper's `hidden → visible` labels and carry
 * their own delay (a variant's own delay replaces the parent's `delayChildren`), so each delay
 * adds the route's enter delay itself (`useRouteEnterDelay`, 21_shell_motion §2).
 *
 * Reduced motion (§8): the kit's opacity-only `panel` variants, at most `fast`, no stagger.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import type { Transition, Variants } from 'motion/react'
import { motion as tokens } from '@dems/shared/tokens'
import { useRouteEnterDelay } from '@/components/shell'
import { HELD_BEAT_MS, useMotionPolicy, type MotionPolicyValue } from '@/motion'

/** M-PG-DASH beats in ms after the route enter (spec literals, D49). */
export const DASH_BEATS = {
  hero: 0,
  tagline: 120,
  strip: 250,
  /** Status-strip cells stagger 50 ms (M-PG-DASH). */
  stripStagger: 50,
  row2: 450,
  row3: 650,
  row4: 850,
  /** The hero moment starts last and finishes at about 1,800 (R3). */
  ring: 900,
  /** Siblings inside a row follow the R1 stagger token. */
  stagger: tokens.choreography.stagger,
} as const

/** M-C-13: the hero still fades up like the Login room still (M-PG-LOGIN t = 0: 900 ms `luxe`). */
export const HERO_PHOTO_FADE_MS = 900
/** M-C-13: the gold rule wipes in `slow` (420) `luxe`; the pillars fade 120 ms apart. */
export const RULE_WIPE_MS = tokens.duration.slow
export const PILLAR_GAP_MS = 120
/** M-C-13 / M-C-12: Ken Burns scale 1.00 → 1.06, transform-origin 60% 40%. */
export const KEN_BURNS_SCALE = 1.06
/** A panel reads as landed this long after its enter starts (`base`); R4 adds the held beat. */
export const PANEL_LAND_MS = tokens.duration.base
/** R4: data starts the held beat (120 ms) after the panel lands. */
export const HELD_BEAT_AFTER_LAND_MS = PANEL_LAND_MS + HELD_BEAT_MS
/** M-PG-DASH row 3: Recharts bar growth. */
export const BAR_GROW_MS = 700
/** M-C-03: ProgressCircle sweep. */
export const DONUT_SWEEP_MS = 900
/** One-shot chip glint (the `sheen` light sweep, §1 "Light sweep"). */
export const GLINT_MS = tokens.ambient.sheen
/** Icon draw-on in panel G ("icons draw"). */
export const ICON_DRAW_MS = 600

/** R1 panel enter delayed to its beat; R2 exit unchanged; reduced: the kit's opacity-only set. */
export function panelVariants(m: MotionPolicyValue, delayMs: number): Variants {
  if (m.reduced) return m.variants.panel
  const base = m.variants.panel
  const visible = base.visible
  if (!visible || typeof visible === 'function') return base
  const transition = (visible.transition ?? m.transitions.enter) as Transition
  return { ...base, visible: { ...visible, transition: { ...transition, delay: m.seconds(delayMs) } } }
}

/** Panel variants for a beat, including the route's enter delay. */
export function usePanelVariants(beatMs: number): Variants {
  const m = useMotionPolicy()
  const routeDelay = useRouteEnterDelay()
  return useMemo(() => panelVariants(m, routeDelay + beatMs), [m, routeDelay, beatMs])
}

/** Milliseconds (not time-scaled) from mount until the beat starts: route delay + beat. */
export function useBeatDelay(beatMs: number): number {
  return useRouteEnterDelay() + beatMs
}

/**
 * R4 "held beat": true once the panel at `beatMs` has landed and 120 ms more have passed, so
 * numbers and charts start after their card settles. Immediately true under reduced motion
 * (values jump to final, §8). Proof mode (`?motion=slow`) stretches the wait tenfold.
 */
export function useHeldBeat(beatMs: number): boolean {
  const m = useMotionPolicy()
  const routeDelay = useRouteEnterDelay()
  const waitMs = m.reduced ? 0 : (routeDelay + beatMs + HELD_BEAT_AFTER_LAND_MS) * m.timeScale
  const [elapsed, setElapsed] = useState(false)
  useEffect(() => {
    if (elapsed || waitMs <= 0) return undefined
    const id = setTimeout(() => setElapsed(true), waitMs)
    return () => clearTimeout(id)
  }, [elapsed, waitMs])
  return elapsed || waitMs <= 0
}

/**
 * R8 attention budget: a key that changes only when `rank` rises (an escalation), so a one-shot
 * effect (a glint, a halo) plays on escalation and never on recovery. Derived while rendering.
 */
export function useEscalationKey(rank: number): number {
  const [track, setTrack] = useState({ rank, key: 0 })
  if (track.rank !== rank) {
    const next = { rank, key: rank > track.rank ? track.key + 1 : track.key }
    setTrack(next)
    return next.key
  }
  return track.key
}

/**
 * R9 coalescing: shows the latest `value`, but changes it at most once per `gapMs` (400 ms,
 * `insertionMinGapMs`), so a burst of insertions animates as one group.
 */
export function useCoalesced<T>(value: T, gapMs: number = tokens.threshold.insertionMinGapMs): T {
  const [shown, setShown] = useState(value)
  const lastChange = useRef(Number.NEGATIVE_INFINITY)
  useEffect(() => {
    if (Object.is(value, shown)) return undefined
    const wait = Math.max(0, lastChange.current + gapMs - performance.now())
    const id = setTimeout(() => {
      lastChange.current = performance.now()
      setShown(value)
    }, wait)
    return () => clearTimeout(id)
  }, [value, shown, gapMs])
  return shown
}

/**
 * IDs that appeared after the first render, each kept for `holdMs` (the M-C-07 highlight fades
 * over 1,500 ms). The first render's IDs are never "new", so a page load highlights nothing.
 */
export function useNewIds(ids: readonly string[], holdMs: number): ReadonlySet<string> {
  const [track, setTrack] = useState(() => ({
    ids,
    known: new Set(ids) as ReadonlySet<string>,
    fresh: new Set<string>() as ReadonlySet<string>,
    batch: { seq: 0, added: [] as readonly string[] },
  }))
  const timers = useRef(new Set<ReturnType<typeof setTimeout>>())

  // Derived while rendering (no effect round-trip): the IDs this `ids` value adds.
  let current = track
  if (track.ids !== ids) {
    const added = ids.filter((id) => !track.known.has(id))
    current =
      added.length === 0
        ? { ...track, ids }
        : {
            ids,
            known: new Set([...track.known, ...added]),
            fresh: new Set([...track.fresh, ...added]),
            batch: { seq: track.batch.seq + 1, added },
          }
    setTrack(current)
  }

  useEffect(() => {
    const pending = timers.current
    return () => {
      for (const timer of pending) clearTimeout(timer)
      pending.clear()
    }
  }, [])

  // Each batch expires after its own full hold; a later batch never cancels an earlier one (R9).
  const { seq, added } = current.batch
  useEffect(() => {
    if (seq === 0 || added.length === 0) return
    const timer = setTimeout(() => {
      timers.current.delete(timer)
      setTrack((state) => {
        const fresh = new Set(state.fresh)
        for (const id of added) fresh.delete(id)
        return { ...state, fresh }
      })
    }, holdMs)
    timers.current.add(timer)
  }, [seq, added, holdMs])

  return current.fresh
}
