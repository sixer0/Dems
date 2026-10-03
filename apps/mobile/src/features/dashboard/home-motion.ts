/**
 * Home choreography (04_mobile_specs §7.3 "Home"; 03_motion_spec M-PG-DASH, Appendix A).
 *
 * Enter beats, in ms from route enter: 0 header; 120 status card; 250 tiles (stagger 50, values
 * tick after the 120 ms held beat, which RollingNumber `count` owns); 450 quick actions; 650 recent
 * sessions (stagger); 900 GlowRing sweep last, the hero moment. Ambient loops (≤ 4 with the chrome,
 * 03M P3): ring rotation (hero ring only), ring breathing, the Start-button sheen every 8 s.
 *
 * The panels use the R1 enter of the motion kit (FadeInDown on the `gentle` spring, 12 px rise),
 * delayed to the beat instead of R1's `80 + i × 60` stagger. Proof mode (`?motion=slow`) multiplies
 * the beats by 10; reduced motion is a 160 ms opacity fade with no stagger (03M §8).
 */
import { FadeIn, FadeInDown, ReduceMotion, type EntryOrExitLayoutType } from 'react-native-reanimated';
import { motion } from '@dems/shared/tokens';
import { EASING, REDUCED_FADE_MS, SPEC_LITERALS, durationMs, slowSpringTiming, type MotionSettings } from '@/motion';

/** §7.3 Home beats (ms from route enter). */
export const HOME_BEATS = {
  header: 0,
  status: 120,
  tiles: 250,
  tileStagger: 50,
  actions: 450,
  recent: 650,
  /** "650 recent sessions (stagger)": the R1 step (`choreography.stagger`). */
  recentStagger: motion.choreography.stagger,
  /** "900 GlowRing sweep last". */
  ringSweep: 900,
} as const;

/** 04 §7.3 / M-C-23: the Start-button sheen runs once every 8 s (a spec value, not a token). */
export const SHEEN_EVERY_MS = 8_000;
/** One sheen sweep (`motion.ambient.sheen`, 700 ms). */
export const SHEEN_SWEEP_MS = motion.ambient.sheen;

/** Loop names for the `?debug=1` overlay and the P3 cap (`useAmbientLoop`). */
export const HOME_LOOPS = {
  ringRotate: 'home-ring-rotate',
  ringBreath: 'home-ring-breath',
  ringRec: 'home-ring-rec',
  startSheen: 'home-start-sheen',
} as const;

/** The beat of the i-th item of a staggered group (capped like R1, `threshold.staggerCap`). */
export function beatAt(base: number, step: number, index: number): number {
  const slot = Math.min(Math.max(0, Math.floor(index)), motion.threshold.staggerCap - 1);
  return base + slot * step;
}

/** A panel's delay under the current settings: the beat, ×10 in proof mode, 0 when reduced. */
export function beatDelay(beatMs: number, m: MotionSettings): number {
  if (m.policy === 'reduced') return 0;
  return durationMs(beatMs, m);
}

/**
 * When a tile's number may start counting: 120 ms after its card settles (03M R4 "held beat";
 * 04 §7.3 "values tick after the 120 ms held beat"). The card's `gentle` spring settles in about
 * `duration.slow` (420 ms). Proof mode ×10; reduced: 0 (the number jumps, 03M §8).
 */
export function valueTickDelay(beatMs: number, m: MotionSettings): number {
  if (m.policy === 'reduced') return 0;
  return beatDelay(beatMs, m) + durationMs('slow', m) + durationMs(SPEC_LITERALS.heldBeatMs, m);
}

/**
 * R1 panel enter at a §7.3 beat: `FadeInDown` on the `gentle` spring rising 12 px (`distance.rise`).
 * Proof mode: timing `slower × 10`. Reduced: a 160 ms opacity fade, no delay (03M §8).
 */
export function homeEnter(beatMs: number, m: MotionSettings): EntryOrExitLayoutType {
  if (m.policy === 'reduced') return FadeIn.duration(REDUCED_FADE_MS).reduceMotion(ReduceMotion.Never);
  const builder = m.slow
    ? FadeInDown.duration(slowSpringTiming().duration ?? 0).easing(EASING.luxe)
    : FadeInDown.springify()
        .stiffness(motion.spring.gentle.stiffness)
        .damping(motion.spring.gentle.damping)
        .mass(motion.spring.gentle.mass);
  return builder
    .delay(beatDelay(beatMs, m))
    .withInitialValues({ opacity: 0, translateY: motion.distance.rise })
    .reduceMotion(ReduceMotion.System);
}
