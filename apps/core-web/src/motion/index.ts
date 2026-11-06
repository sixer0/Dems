/**
 * Web motion library (step 36; 02_plan §4 W-07 part a; 03_motion_spec §2, §3, §8, §9).
 *
 * Mount `MotionPolicyProvider` once around the app (step 38), then read everything from
 * `useMotionPolicy()`. Loops go through `useAmbientLoop`, glow through `GlowLayer`, and meters
 * report frames to the `?debug=1` overlay with `reportMeterFrame`.
 */
export { MotionPolicyProvider, type MotionPolicyProviderProps } from './motion-policy-provider'
export {
  MotionPolicyContext,
  STATIC_MOTION_POLICY,
  useMotionPolicy,
  type MotionPolicyValue,
} from './use-motion-policy'
export {
  useAmbientLoop,
  useAmbientSnapshot,
  type AmbientLoopOptions,
  type AmbientLoopState,
} from './use-ambient-loop'
export {
  createAmbientRegistry,
  type AmbientLoopInfo,
  type AmbientLoopRequest,
  type AmbientPriority,
  type AmbientRegistry,
  type AmbientSnapshot,
} from './ambient-registry'
export { GlowLayer, type GlowLayerProps } from './glow-layer'
export { GLOW_LEVELS, glowShadow, type GlowLevel, type GlowTone } from './glow'
export { MotionDebugOverlayGate } from './debug-overlay-gate'
export {
  drainMeterFrames,
  isDebugMetricsEnabled,
  reportMeterFrame,
  setDebugMetricsEnabled,
} from './debug-metrics'
export {
  buildMotionKit,
  HALO_MS,
  HALO_SCALE,
  HELD_BEAT_MS,
  HOVER_MS,
  ICON_PRESS_SCALE,
  MEDIA_IN_MS,
  REDUCED_METER_HZ,
  ROW_EXIT_MS,
  ROW_STAGGER_CAP,
  ROW_STAGGER_MS,
  type MotionFlags,
  type MotionInteractionSet,
  type MotionKit,
  type MotionTransitionSet,
  type MotionVariantSet,
} from './variants'
export {
  cappedStagger,
  loopTransition,
  springOptions,
  springTransition,
  toSeconds,
  tween,
  type LoopOptions,
  type StaggerOptions,
} from './transitions'
export {
  DEBUG_QUERY_PARAM,
  INITIAL_LOCATION_SEARCH,
  MOTION_QUERY_PARAM,
  parseDebugQuery,
  parseMotionQuery,
  readReducedOverride,
  REDUCED_MOTION_MEDIA_QUERY,
  REDUCED_MOTION_STORAGE_KEY,
  resolveMotionPolicy,
  writeReducedOverride,
  type MotionPolicy,
  type MotionPolicyInputs,
  type MotionQuery,
  type MotionSpeed,
  type ResolvedMotionPolicy,
} from './policy'
export { useMediaQuery, type MatchMedia } from './use-media-query'
