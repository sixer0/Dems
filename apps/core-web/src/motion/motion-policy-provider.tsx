import './motion.css'
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { MotionConfig } from 'motion/react'
import { createAmbientRegistry } from './ambient-registry'
import { setDebugMetricsEnabled } from './debug-metrics'
import { MotionDebugOverlayGate } from './debug-overlay-gate'
import {
  browserStorage,
  INITIAL_LOCATION_SEARCH,
  parseDebugQuery,
  parseMotionQuery,
  readReducedOverride,
  REDUCED_MOTION_MEDIA_QUERY,
  resolveMotionPolicy,
  writeReducedOverride,
} from './policy'
import { browserMatchMedia, useMediaQuery, type MatchMedia } from './use-media-query'
import { MotionPolicyContext, type MotionPolicyValue } from './use-motion-policy'
import { buildMotionKit } from './variants'

export interface MotionPolicyProviderProps {
  children: ReactNode
  /**
   * The URL search to read `?motion=` and `?debug=` from. Defaults to the search captured when the
   * app loaded, so it works on any route and survives router redirects.
   */
  search?: string
  /** Test seam; defaults to `window.localStorage` (guarded). */
  storage?: Storage | null
  /** Test seam; defaults to `window.matchMedia`. */
  matchMedia?: MatchMedia
  /** Render the `?debug=1` overlay (default true). */
  debugOverlay?: boolean
}

/**
 * The motion policy root (03_motion_spec §8, §9.5, §12). Mount it once, around the router outlet.
 * It replaces a bare `<MotionConfig reducedMotion="user">`: it resolves the policy, provides the
 * kit to `useMotionPolicy()`, sets Motion's `reducedMotion` ('always' when reduced for any reason,
 * otherwise 'user') and the default token transition, marks `<html>` for CSS, and shows the
 * lazily loaded debug overlay when `?debug=1` is present.
 */
export function MotionPolicyProvider({
  children,
  search = INITIAL_LOCATION_SEARCH,
  storage,
  matchMedia,
  debugOverlay = true,
}: MotionPolicyProviderProps) {
  const store = useMemo(() => (storage === undefined ? browserStorage() : storage), [storage])
  const media = useMemo(() => matchMedia ?? browserMatchMedia(), [matchMedia])
  const osReduced = useMediaQuery(REDUCED_MOTION_MEDIA_QUERY, media)
  const [override, setOverride] = useState(() => readReducedOverride(store))
  const query = useMemo(() => parseMotionQuery(search), [search])
  const debug = useMemo(() => parseDebugQuery(search), [search])
  const [ambientRegistry] = useState(() => createAmbientRegistry())

  const resolved = resolveMotionPolicy({ osReduced, override, query })
  const { policy, speed, timeScale, ambient } = resolved
  const kit = useMemo(() => buildMotionKit(policy, timeScale), [policy, timeScale])

  const setReducedOverride = useCallback(
    (reduced: boolean) => {
      writeReducedOverride(store, reduced)
      setOverride(reduced)
    },
    [store],
  )

  const value = useMemo<MotionPolicyValue>(
    () => ({
      ...kit,
      reduced: policy === 'reduced',
      speed,
      ambient,
      debug,
      sources: { osReduced, override, query },
      ambientRegistry,
      setReducedOverride,
    }),
    [kit, policy, speed, ambient, debug, osReduced, override, query, ambientRegistry, setReducedOverride],
  )

  useEffect(() => {
    const root = document.documentElement
    root.dataset.motion = policy
    root.dataset.motionSpeed = speed
    root.style.setProperty('--motion-time-scale', String(timeScale))
    return () => {
      delete root.dataset.motion
      delete root.dataset.motionSpeed
      root.style.removeProperty('--motion-time-scale')
    }
  }, [policy, speed, timeScale])

  useEffect(() => {
    setDebugMetricsEnabled(debug)
    return () => setDebugMetricsEnabled(false)
  }, [debug])

  return (
    <MotionPolicyContext.Provider value={value}>
      <MotionConfig reducedMotion={policy === 'reduced' ? 'always' : 'user'} transition={kit.transitions.default}>
        {children}
        {debug && debugOverlay ? <MotionDebugOverlayGate /> : null}
      </MotionConfig>
    </MotionPolicyContext.Provider>
  )
}
