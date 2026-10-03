/**
 * `useMotionPolicy()` (03_motion_spec §8, §9.5; 01_specs §14 motion foundation).
 *
 * Returns the resolved policy (`policy` is `'full' | 'reduced'`), the proof-mode speed, and the
 * matching motion kit (variants, transitions, interactions, flags), so every component animates
 * from the same tokens and degrades the same way. `MotionPolicyProvider` supplies the live value;
 * without a provider the hook returns a static full-motion, normal-speed value, which keeps
 * isolated component tests simple.
 */
import { createContext, useContext } from 'react'
import { createAmbientRegistry, type AmbientRegistry } from './ambient-registry'
import type { MotionPolicyInputs, MotionSpeed } from './policy'
import { buildMotionKit, type MotionKit } from './variants'

export interface MotionPolicyValue extends MotionKit {
  /** `policy === 'reduced'`. */
  reduced: boolean
  speed: MotionSpeed
  /** Ambient loops may run under this policy. */
  ambient: boolean
  /** `?debug=1` is active (the overlay is shown). */
  debug: boolean
  /** Which inputs produced the policy (OS setting, in-app override, URL switch). */
  sources: MotionPolicyInputs
  ambientRegistry: AmbientRegistry
  /** Sets the in-app "Reduce motion" switch and persists it (localStorage `dems.motion.reduced`). */
  setReducedOverride: (reduced: boolean) => void
}

const staticKit = buildMotionKit('full', 1)

export const STATIC_MOTION_POLICY: MotionPolicyValue = {
  ...staticKit,
  reduced: false,
  speed: 'normal',
  ambient: true,
  debug: false,
  sources: { osReduced: false, override: false, query: null },
  ambientRegistry: createAmbientRegistry(),
  setReducedOverride: () => undefined,
}

export const MotionPolicyContext = createContext<MotionPolicyValue>(STATIC_MOTION_POLICY)

export function useMotionPolicy(): MotionPolicyValue {
  return useContext(MotionPolicyContext)
}
