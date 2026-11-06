/**
 * Motion policy resolution (03_motion_spec §8 and §12; 01_specs §4.5; D43).
 *
 * Pure functions only, so the rules are testable without React:
 * - **reduced** when the OS asks for it (`prefers-reduced-motion: reduce`), OR the in-app
 *   "Reduce motion" switch is on (localStorage `dems.motion.reduced`), OR the URL carries the
 *   test switch `?motion=off` (D43: loops must be pausable for automation);
 * - **slow** (proof mode M-PX-01) when the URL carries `?motion=slow`, on any route. Every duration,
 *   delay and stagger is multiplied by `proofSlowFactor` (10), and springs become tweens.
 */
import { motion as tokens } from '@dems/shared/tokens'

/** 03_motion_spec §8: what `useMotionPolicy()` reports. */
export type MotionPolicy = 'full' | 'reduced'
/** `slow` is the proof mode (`?motion=slow`). */
export type MotionSpeed = 'normal' | 'slow'
/** The parsed `?motion=` switch: `slow` (proof mode), `off` (test / reduced switch, D43) or none. */
export type MotionQuery = 'slow' | 'off' | null

export const MOTION_QUERY_PARAM = 'motion'
export const DEBUG_QUERY_PARAM = 'debug'
/** 03_motion_spec §8: the persisted in-app override. */
export const REDUCED_MOTION_STORAGE_KEY = 'dems.motion.reduced'
export const REDUCED_MOTION_MEDIA_QUERY = '(prefers-reduced-motion: reduce)'

/** `?motion=off` is the documented switch (D43); `reduced` and `reduce` are accepted aliases. */
const OFF_VALUES: ReadonlySet<string> = new Set(['off', 'reduced', 'reduce'])

/** Accepts a bare search string (`?a=1`), a path with a search (`/evidence/EV-1?a=1`) or a full URL. */
function searchParamsOf(input: string): URLSearchParams {
  const start = input.indexOf('?')
  const query = start === -1 ? (input.includes('=') ? input : '') : input.slice(start + 1)
  return new URLSearchParams(query.split('#')[0])
}

export function parseMotionQuery(search: string): MotionQuery {
  const value = searchParamsOf(search).get(MOTION_QUERY_PARAM)?.trim().toLowerCase()
  if (value === 'slow') return 'slow'
  if (value !== undefined && OFF_VALUES.has(value)) return 'off'
  return null
}

/** `?debug=1` (or `?debug=true`) shows the measurement overlay (03_motion_spec §9.5). */
export function parseDebugQuery(search: string): boolean {
  const value = searchParamsOf(search).get(DEBUG_QUERY_PARAM)?.trim().toLowerCase()
  return value === '1' || value === 'true'
}

export interface MotionPolicyInputs {
  /** The OS setting, `prefers-reduced-motion: reduce`. */
  osReduced: boolean
  /** The in-app "Reduce motion" switch (System & Maintenance → Settings). */
  override: boolean
  /** The URL switch. */
  query: MotionQuery
}

export interface ResolvedMotionPolicy {
  policy: MotionPolicy
  speed: MotionSpeed
  /** 1, or `proofSlowFactor` (10) in proof mode. */
  timeScale: number
  /** Ambient loops may run (they never do under the reduced policy, §8). */
  ambient: boolean
  sources: MotionPolicyInputs
}

export function resolveMotionPolicy(inputs: MotionPolicyInputs): ResolvedMotionPolicy {
  const reduced = inputs.osReduced || inputs.override || inputs.query === 'off'
  const speed: MotionSpeed = inputs.query === 'slow' ? 'slow' : 'normal'
  return {
    policy: reduced ? 'reduced' : 'full',
    speed,
    timeScale: speed === 'slow' ? tokens.proofSlowFactor : 1,
    ambient: !reduced,
    sources: { ...inputs },
  }
}

type ReadableStorage = Pick<Storage, 'getItem'>
type WritableStorage = Pick<Storage, 'setItem' | 'removeItem'>

/**
 * Storage can be missing or throw (private windows, blocked site data). Every failure falls back
 * to "no override", so the OS setting still applies; nothing is shown to the user because the
 * switch is a preference, not data.
 */
export function readReducedOverride(storage: ReadableStorage | null | undefined): boolean {
  try {
    const value = storage?.getItem(REDUCED_MOTION_STORAGE_KEY)
    return value === '1' || value === 'true'
  } catch {
    return false
  }
}

/** Returns `false` when the value could not be persisted (it still applies for this page view). */
export function writeReducedOverride(
  storage: WritableStorage | null | undefined,
  value: boolean,
): boolean {
  if (!storage) return false
  try {
    if (value) storage.setItem(REDUCED_MOTION_STORAGE_KEY, '1')
    else storage.removeItem(REDUCED_MOTION_STORAGE_KEY)
    return true
  } catch {
    return false
  }
}

export function browserStorage(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage
  } catch {
    return null
  }
}

/**
 * The URL search as it was when the app's modules first loaded. Reading it this early means a
 * router redirect (for example `/` → `/dashboard`) cannot drop `?motion=slow` or `?debug=1`
 * before the provider mounts.
 */
export const INITIAL_LOCATION_SEARCH: string =
  typeof window === 'undefined' ? '' : window.location.search
