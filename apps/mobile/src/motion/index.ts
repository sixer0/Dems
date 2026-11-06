/**
 * Mobile motion kit (step 69; 04_mobile_specs §7; 05_mobile_plan M-02 motion part).
 *
 * - Token → Reanimated mapping: `./tokens` (springs, timings, easings, stagger, proof mode).
 * - Builders: `./builders` (value animations and entering / exiting / layout builders).
 * - Policy: `MotionPolicyProvider`, `useMotionPolicy`, `useMotionSettings`, `useAmbientLoop`,
 *   `useMotionPreferences`, `kitAnimation` (HeroUI `'disable-all'`), the D43 `?motion=off` switch.
 * - `GlowLayer`: glow as a cross-faded pre-rendered layer (03M §9.2).
 * - Haptics: the one service over expo-haptics (§7.6, MA-20).
 * - `?debug=1` overlay and `reportMeterFrame` (§7.8, MA-17).
 */
export {
  EASING,
  FULL_MOTION,
  REDUCED_FADE_MS,
  REDUCED_MOTION,
  SLOW_MOTION,
  SPEC_LITERALS,
  ambientPeriodMs,
  durationMs,
  slowSpringTiming,
  springConfig,
  staggerDelay,
  timingConfig,
  type MotionPolicy,
  type MotionSettings,
  type StaggerOptions,
} from './tokens';
export {
  animateAfter,
  animateBreath,
  animateFade,
  animatePulseOnce,
  animateRecPulse,
  animateRotation,
  animateShake,
  animateSpring,
  animateTiming,
  crossFadeIn,
  crossFadeOut,
  enterRise,
  exitUp,
  layoutTransition,
  listInsert,
  rowReveal,
  stackAnimation,
  type EnterOptions,
  type RiseDistance,
  type RouteMotionKind,
  type StackAnimation,
} from './builders';
export {
  INITIAL_MOTION_STATE,
  getMotionSettings,
  kitAnimation,
  motionStore,
  parseMotionLink,
  reducedReasons,
  resetMotionStateForTests,
  resolvePolicy,
  resolveSettings,
  resolveSlow,
  type LinkMotionMode,
  type MotionActions,
  type MotionLinkFlags,
  type MotionState,
  type MotionStateData,
  type ReducedReason,
} from './policy';
export {
  useAmbientLoop,
  useMotionPolicy,
  useMotionPreferences,
  useMotionSettings,
  useMotionState,
  useReducedReasons,
  type AmbientLoopOptions,
  type MotionPreferences,
} from './use-motion-policy';
export {
  MotionPolicyProvider,
  UiRuntimeBoundary,
  reducedMotionMode,
  type MotionPolicyProviderProps,
} from './motion-policy-provider';
export {
  AMBIENT_LOOP_CAP,
  activeLoopNames,
  loopRegistry,
  registerAmbientLoop,
  resetLoopRegistryForTests,
  type AmbientLoopEntry,
} from './loops';
export { GlowLayer, glowShadow, layerOpacities, type GlowLayerProps, type GlowLevel } from './glow-layer';
export {
  HAPTIC_EVENTS,
  HAPTIC_MIN_GAP_MS,
  HAPTIC_PRIORITY,
  createHapticsService,
  expoHapticsDriver,
  haptics,
  triggerHaptic,
  useHaptics,
  type HapticEvent,
  type HapticKind,
  type HapticOutcome,
  type HapticsDriver,
  type HapticsService,
  type HapticsServiceOptions,
} from './haptics';
export { MotionDebugOverlay, type MotionDebugOverlayProps } from './debug-overlay';
export { drainMeterFrames, fpsFromWindow, isMeterFrameCounting, reportMeterFrame, setMeterFrameCounting } from './debug-metrics';
export {
  DEFAULT_MOTION_PREFS,
  MOBILE_PREFS_KEY,
  parseMotionPrefs,
  readMotionPrefs,
  writeMotionPrefs,
  type MotionPrefs,
} from './prefs';
export { reportMotionIssue, setMotionLogSink, type MotionLogRecord, type MotionLogSink } from './log';
export { UI_RUNTIME_BEAT_MS, UI_RUNTIME_MISSES, installUiRuntimeErrorTrap, markUiRuntimeStalled, useUiRuntimeWatch } from './ui-runtime-watch';
