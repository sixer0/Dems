/**
 * Storage choreography (04_mobile_specs §7.3 "Storage"; 03_motion_spec M-PG-STOR, M-C-03, App. A).
 *
 * Enter beats, ms from route enter: 0 header; 80 capacity card; 200 ring sweep (the hero moment,
 * 120 ms into the card as on the web page, 900 ms `luxe`); 260 legend rows (stagger 60); 420 KPIs;
 * 520 activity card, its rows 30 ms apart (M-C-11); 680 Manage Storage. Ambient loops: none (a calm
 * page, 03M M-PG-STOR). Data moments: LOW / FULL morph the ring colour (400 ms) with ONE pulse
 * (600 ms, `totalMs` passed explicitly, F74-02) plus a toast; recoveries only morph.
 *
 * Proof mode (`?motion=slow`) multiplies every beat by 10; reduced motion is a 160 ms opacity fade
 * with no delay, no sweep and no pulse (03M §8).
 */
import { FadeIn, FadeInDown, ReduceMotion, type EntryOrExitLayoutType } from 'react-native-reanimated';
import { motion } from '@dems/shared/tokens';
import { EASING, REDUCED_FADE_MS, SPEC_LITERALS, durationMs, slowSpringTiming, type MotionSettings } from '@/motion';

export const STORAGE_BEATS = {
  header: 0,
  capacity: 80,
  ringSweep: 200,
  legend: 260,
  legendStagger: 60,
  kpis: 420,
  activity: 520,
  manage: 680,
} as const;

/** M-C-03: the donut sweeps from 0 to the value over 900 ms `luxe`. */
export const RING_SWEEP_MS = 900;
/** M-C-03: threshold colour change. */
export const RING_COLOR_MS = 400;
/** M-C-10 / R8: one escalation pulse. */
export const RING_PULSE_MS = SPEC_LITERALS.escalationPulseMs;

/** The beat of the i-th item of a staggered group (capped like R1, `threshold.staggerCap`). */
export function beatAt(base: number, step: number, index: number): number {
  const slot = Math.min(Math.max(0, Math.floor(index)), motion.threshold.staggerCap - 1);
  return base + slot * step;
}

/** A beat under the current settings: ×10 in proof mode, 0 when reduced. */
export function beatDelay(beatMs: number, m: MotionSettings): number {
  if (m.policy === 'reduced') return 0;
  return durationMs(beatMs, m);
}

/** When the centre % may roll in: with the sweep (the number lands as the arc does). */
export function centreValueDelay(m: MotionSettings): number {
  return beatDelay(STORAGE_BEATS.ringSweep, m);
}

/**
 * R1 panel enter at a beat: `FadeInDown` on the `gentle` spring rising 12 px. Proof mode: timing
 * `slower × 10`. Reduced: a 160 ms opacity fade, no delay.
 */
export function storageEnter(beatMs: number, m: MotionSettings): EntryOrExitLayoutType {
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
