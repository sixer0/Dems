/**
 * `useAmbientLoop()` (03_motion_spec P3, R10, §8, §9.4).
 *
 * An ambient loop runs only when all of these hold:
 * 1. the policy allows ambient motion (not reduced, not `?motion=off`);
 * 2. the caller enables it (for example "only while recording");
 * 3. the tab is visible (Motion `usePageInView`);
 * 4. the element is on screen, when a `ref` is given (Motion `useInView`);
 * 5. the registry grants it one of the four viewport slots (page loops before shell loops).
 *
 * Spread `attrs` on the looping element: `data-motion` marks the policy (AC-70) and
 * `data-ambient` is `running` or `paused`, which `motion.css` uses to pause CSS keyframe loops.
 */
import { useEffect, useId, useRef, useSyncExternalStore, type RefObject } from 'react'
import { useInView, usePageInView } from 'motion/react'
import type { AmbientPriority } from './ambient-registry'
import type { MotionPolicy } from './policy'
import { useMotionPolicy } from './use-motion-policy'

export interface AmbientLoopOptions {
  /** The looping element; off-screen loops pause (R10). Omit for loops without a DOM node. */
  ref?: RefObject<Element | null>
  priority?: AmbientPriority
  /** Loops with the same group share one viewport slot. */
  group?: string
  /** The caller's own condition (default true). */
  enabled?: boolean
}

export interface AmbientLoopState {
  running: boolean
  attrs: { 'data-motion': MotionPolicy; 'data-ambient': 'running' | 'paused' }
}

export function useAmbientLoop(label: string, options: AmbientLoopOptions = {}): AmbientLoopState {
  const { ref, priority = 'page', group, enabled = true } = options
  const { ambient, policy, ambientRegistry } = useMotionPolicy()
  const id = useId()
  const noElement = useRef<Element | null>(null)
  const pageVisible = usePageInView()
  // Without an element there is nothing to observe, so the loop counts as on screen.
  const onScreen = useInView(ref ?? noElement, { initial: ref === undefined })
  const wantsToRun = ambient && enabled && pageVisible && onScreen

  useEffect(() => {
    if (!wantsToRun) return undefined
    return ambientRegistry.acquire(id, { label, priority, group })
  }, [wantsToRun, ambientRegistry, id, label, priority, group])

  const snapshot = useSyncExternalStore(
    ambientRegistry.subscribe,
    ambientRegistry.getSnapshot,
    ambientRegistry.getSnapshot,
  )
  const running = wantsToRun && snapshot.grantedIds.has(id)

  return { running, attrs: { 'data-motion': policy, 'data-ambient': running ? 'running' : 'paused' } }
}

/** The registry snapshot, for the debug overlay and tests. */
export function useAmbientSnapshot() {
  const { ambientRegistry } = useMotionPolicy()
  return useSyncExternalStore(
    ambientRegistry.subscribe,
    ambientRegistry.getSnapshot,
    ambientRegistry.getSnapshot,
  )
}
