/**
 * Live video decode budget (step 45b, F45-01, D96; 03_motion_spec §9.3 decode budget).
 *
 * The step-45 audit measured the Dashboard at 30 fps in windowed GPU Chrome while its two camera
 * tiles each decoded a live loop, and at 60 fps with one video playing (Session Monitor, or the
 * Dashboard with Camera 2 at NO SIGNAL). So the page-wide rule is: **at most one live tile video
 * decodes at a time**.
 *
 * - A `feed` (Session Monitor L and its fullscreen copy) always plays and uses the budget, so no
 *   tile decodes beside it.
 * - Among `tile` and `thumb` feeds the one the user last hovered or focused plays (sticky, so a
 *   pointer leaving does not flip the video back), otherwise the first one mounted.
 * - Only feeds that actually want to play count: off-screen, hidden-tab, NO SIGNAL, reduced-motion
 *   and `live={false}` feeds never claim, so the next tile takes over (Camera 2 lost → Camera 1).
 *
 * A plain module store (like `feed-scheduler.ts`), consumed through `useSyncExternalStore`.
 */
import { useCallback, useEffect, useId, useSyncExternalStore } from 'react'

export type LiveDecodePriority = 'feed' | 'tile'

/** Live video decoders allowed per page (F45-01). */
export const LIVE_DECODE_BUDGET = 1

interface Entry {
  priority: LiveDecodePriority
  /** Mount order: the first tile on the page wins when nobody has hovered or focused one. */
  mountOrder: number
  /** Last hover / focus stamp (0 = never). Higher wins. */
  focus: number
  wants: boolean
}

const entries = new Map<string, Entry>()
const listeners = new Set<() => void>()
let mountSeq = 0
let focusSeq = 0
let granted: ReadonlySet<string> = new Set()

function compute(): ReadonlySet<string> {
  const feeds: string[] = []
  const tiles: Array<[string, Entry]> = []
  for (const [id, entry] of entries) {
    if (!entry.wants) continue
    if (entry.priority === 'feed') feeds.push(id)
    else tiles.push([id, entry])
  }
  tiles.sort(([, a], [, b]) => b.focus - a.focus || a.mountOrder - b.mountOrder)
  const room = Math.max(0, LIVE_DECODE_BUDGET - feeds.length)
  return new Set([...feeds, ...tiles.slice(0, room).map(([id]) => id)])
}

function sameSet(a: ReadonlySet<string>, b: ReadonlySet<string>): boolean {
  if (a.size !== b.size) return false
  for (const id of a) if (!b.has(id)) return false
  return true
}

function publish() {
  const next = compute()
  if (sameSet(next, granted)) return
  granted = next
  for (const listener of listeners) listener()
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function getGranted(): ReadonlySet<string> {
  return granted
}

/** Feeds currently allowed to decode (tests and diagnostics). */
export function liveDecodersGranted(): number {
  return granted.size
}

/** Feeds that want to decode, granted or not (tests and diagnostics). */
export function liveDecodersRequested(): number {
  let count = 0
  for (const entry of entries.values()) if (entry.wants) count += 1
  return count
}

export interface LiveDecodeSlot {
  /** True when this feed may decode now (implies `wants`). */
  granted: boolean
  /** Marks this feed as the one the user is looking at (hover or keyboard focus). */
  focus: () => void
}

/**
 * Claims the page's live decode slot while `wants` is true. Feeds that are not granted stay on
 * their poster or last frame (the caller shows a standby treatment).
 */
export function useLiveDecodeSlot(wants: boolean, priority: LiveDecodePriority): LiveDecodeSlot {
  const id = useId()

  // The entry lives as long as the component (declared first, so its cleanup runs on unmount).
  useEffect(
    () => () => {
      if (entries.delete(id)) publish()
    },
    [id],
  )

  useEffect(() => {
    let entry = entries.get(id)
    if (!entry) {
      entry = { priority, mountOrder: ++mountSeq, focus: 0, wants }
      entries.set(id, entry)
    }
    entry.wants = wants
    entry.priority = priority
    publish()
  }, [id, wants, priority])

  const current = useSyncExternalStore(subscribe, getGranted, getGranted)

  const focus = useCallback(() => {
    const entry = entries.get(id)
    if (!entry || entry.priority === 'feed') return
    entry.focus = ++focusSeq
    publish()
  }, [id])

  return { granted: wants && current.has(id), focus }
}
