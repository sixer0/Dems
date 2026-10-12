/**
 * Token → Reanimated mapping (04_mobile_specs §7.1; 03_motion_spec §2 and Appendix A).
 *
 * Every number comes from the shared `motion` tokens (step 30, `@dems/shared/tokens`,
 * implementation/11_token_pipeline.md §3). Nothing here re-declares a token value; the only local
 * literals are spec values that are not tokens (listed in `SPEC_LITERALS`, D49 / N-1).
 *
 * The helpers are worklets, so they run on the JS thread and on the UI thread (gesture callbacks,
 * `useDerivedValue`) alike. They read only plain numbers and the pre-built easing factories.
 */
import { Easing, type EasingFunctionFactory, type WithSpringConfig, type WithTimingConfig } from 'react-native-reanimated';
import {
  motion,
  type AmbientToken,
  type DurationToken,
  type EasingToken,
  type SpringTokenName,
} from '@dems/shared/tokens';

/** The motion policy the whole app follows (04 §7.7): OS reduce-motion OR the in-app override. */
export type MotionPolicy = 'full' | 'reduced';

/**
 * What a builder needs to know. `slow` is the proof mode (`?motion=slow`, §7.1): durations and
 * stagger × `proofSlowFactor`, springs become `withTiming(slower × factor)`. `slow` is only ever
 * true together with `policy: 'full'`.
 */
export interface MotionSettings {
  readonly policy: MotionPolicy;
  readonly slow: boolean;
  /**
   * True once the animation runtime of this process has stopped (fix wave J, JM-01 d;
   * `./ui-runtime-watch`). The policy is then `reduced`, and the layout builders return NO animation at all:
   * even the short reduced fade is played by the runtime that no longer runs, and a view entered with it
   * would stay at its first, hidden frame.
   */
  readonly still?: boolean;
}

export const FULL_MOTION: MotionSettings = { policy: 'full', slow: false };
export const REDUCED_MOTION: MotionSettings = { policy: 'reduced', slow: false };
export const SLOW_MOTION: MotionSettings = { policy: 'full', slow: true };

/**
 * Spec values that are not tokens (03M §2.3 lacks them; D49 keeps them as documented literals).
 * Each cites its source so a later token can replace it in one place.
 */
export const SPEC_LITERALS = {
  /** 03M §1 "Held beat" and R4: numbers start 120 ms after their card settles. */
  heldBeatMs: 120,
  /** 03M R9 / 04 M-C-07: the newest-row highlight fades over 1,500 ms. */
  highlightFadeMs: 1500,
  /** 04 M-C-11 / §7.3 Evidence: row reveals stagger 30 ms. */
  rowStaggerMs: 30,
  /** 04 M-C-10: escalation halo pulse, once. */
  escalationPulseMs: 600,
  /** 04 M-C-22 / 03M P7: one login-error shake, x offsets over 300 ms. */
  shakeMs: 300,
  shakeOffsets: [0, -6, 6, -4, 4, 0] as readonly number[],
  /** 04 §7.6: at most one haptic per 400 ms. */
  hapticMinGapMs: 400,
} as const;

/** Pre-built easing factories for the four `motion.easing` curves (cubic-bézier). */
export const EASING: Readonly<Record<EasingToken, EasingFunctionFactory>> = {
  standard: Easing.bezier(...motion.easing.standard),
  luxe: Easing.bezier(...motion.easing.luxe),
  emphasized: Easing.bezier(...motion.easing.emphasized),
  exit: Easing.bezier(...motion.easing.exit),
};

/** Reduced-motion enters and exits are opacity only, at most `fast` (03M §8, 04 §7.7). */
export const REDUCED_FADE_MS = motion.duration.fast;

/** A duration token (or a spec literal in ms) under the current settings: ×10 in proof mode. */
export function durationMs(duration: DurationToken | number, m: MotionSettings): number {
  'worklet';
  const base = typeof duration === 'number' ? duration : motion.duration[duration];
  return m.slow ? base * motion.proofSlowFactor : base;
}

/** `withSpring` config for a spring token, same numbers as the web (Appendix A). */
export function springConfig(name: SpringTokenName): WithSpringConfig {
  'worklet';
  const s = motion.spring[name];
  return { stiffness: s.stiffness, damping: s.damping, mass: s.mass };
}

/** `withTiming` config: `{ duration, easing: Easing.bezier(...easing) }` (§7.1 row 1). */
export function timingConfig(
  duration: DurationToken | number,
  easing: EasingToken,
  m: MotionSettings,
): WithTimingConfig {
  'worklet';
  return { duration: durationMs(duration, m), easing: EASING[easing] };
}

/** Proof mode turns every spring into `withTiming(slower × proofSlowFactor)` (§7.1). */
export function slowSpringTiming(): WithTimingConfig {
  'worklet';
  return { duration: motion.duration.slower * motion.proofSlowFactor, easing: EASING.luxe };
}

export interface StaggerOptions {
  /** ms between items; default `choreography.stagger` (60). */
  stepMs?: number;
  /** ms before the first item; default `choreography.delayChildren` (80). */
  baseMs?: number;
  /** Items after this many enter with the last one; default `threshold.staggerCap` (8, R1). */
  cap?: number;
}

/**
 * R1 stagger: `delayChildren + min(i, cap − 1) × stagger`, ×10 in proof mode, 0 when reduced
 * (no stagger under reduced motion, 03M §8).
 */
export function staggerDelay(index: number, m: MotionSettings, options: StaggerOptions = {}): number {
  'worklet';
  if (m.policy === 'reduced') return 0;
  const step = options.stepMs ?? motion.choreography.stagger;
  const base = options.baseMs ?? motion.choreography.delayChildren;
  const cap = Math.max(1, options.cap ?? motion.threshold.staggerCap);
  const slot = Math.min(Math.max(0, Math.floor(index)), cap - 1);
  const delay = base + slot * step;
  return m.slow ? delay * motion.proofSlowFactor : delay;
}

/** An ambient loop period (`motion.ambient.*`) under the current settings (×10 in proof mode). */
export function ambientPeriodMs(period: AmbientToken | number, m: MotionSettings): number {
  'worklet';
  const base = typeof period === 'number' ? period : motion.ambient[period];
  return m.slow ? base * motion.proofSlowFactor : base;
}
