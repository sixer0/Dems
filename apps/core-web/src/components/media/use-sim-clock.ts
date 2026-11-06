/**
 * Simulator-clock readers for media overlays and compositions.
 *
 * - `useSimSecond()` re-renders once per simulator second (1 Hz UI, 03_motion_spec §9.3), not on
 *   every 20 Hz store change: zustand's selector subscription only notifies when the whole second
 *   changes.
 * - `useSimNowReader()` returns a function for render-free readers (canvas painters) that want
 *   the current simulator time.
 * Both work outside a `SimProvider` (component galleries, isolated tests): they fall back to the
 * wall clock.
 */
import { useCallback, useContext, useEffect, useState, useSyncExternalStore } from 'react'
import { SimContext } from '@dems/shared/sim'

function wallSecond(): number {
  return Math.floor(Date.now() / 1000)
}

/** The simulator clock in whole seconds (epoch s), updated at 1 Hz. */
export function useSimSecond(): number {
  const sim = useContext(SimContext)
  const subscribe = useCallback(
    (notify: () => void) =>
      sim ? sim.store.subscribe((state) => Math.floor(state.clock.now / 1000), notify) : () => undefined,
    [sim],
  )
  const simSecond = useSyncExternalStore(
    subscribe,
    () => (sim ? Math.floor(sim.store.getState().clock.now / 1000) : -1),
    () => -1,
  )
  const [wall, setWall] = useState(wallSecond)
  useEffect(() => {
    if (sim) return undefined
    const id = setInterval(() => setWall(wallSecond()), 1000)
    return () => clearInterval(id)
  }, [sim])
  return sim ? simSecond : wall
}

/** A stable reader of the simulator time in epoch ms (wall clock without a provider). */
export function useSimNowReader(): () => number {
  const sim = useContext(SimContext)
  return useCallback(() => (sim ? sim.store.getState().clock.now : Date.now()), [sim])
}
