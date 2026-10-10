// Token → Reanimated mapping and builders (04_mobile_specs §7.1, §7.2; 03_motion_spec §3, §8,
// Appendix A). Numbers are compared with the shared tokens, so a token change flows through.
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act } from '@testing-library/react-native';
import { ReduceMotion, makeMutable } from 'react-native-reanimated';
import { motion } from '@dems/shared/tokens';
import {
  animateBreath,
  animateFade,
  animatePulseOnce,
  animateRecPulse,
  animateRotation,
  animateShake,
  animateSpring,
  animateTiming,
  crossFadeIn,
  enterRise,
  exitUp,
  layoutTransition,
  listInsert,
  rowReveal,
  stackAnimation,
} from './builders';
import {
  FULL_MOTION,
  REDUCED_FADE_MS,
  REDUCED_MOTION,
  SLOW_MOTION,
  ambientPeriodMs,
  durationMs,
  springConfig,
  staggerDelay,
  timingConfig,
} from './tokens';

/** Layout builders keep their settings in public fields (Reanimated 4.5.1 BaseAnimationBuilder). */
interface BuilderFields {
  durationV?: number;
  delayV?: number;
  stiffnessV?: number;
  dampingV?: number;
  massV?: number;
  initialValues?: Record<string, unknown>;
  targetValues?: Record<string, unknown>;
  getDuration(): number;
  getDelay(): number;
  getReduceMotion(): ReduceMotion;
  build(): () => { initialValues: Record<string, unknown> };
}
const fields = (b: unknown) => b as BuilderFields;

describe('token mapping (§7.1)', () => {
  it.each(['gentle', 'snappy', 'bouncy', 'counter', 'meter', 'indicator'] as const)(
    'spring %s → withSpring with the same stiffness, damping and mass',
    (name) => {
      expect(springConfig(name)).toEqual(motion.spring[name]);
    },
  );

  it('timings use the duration tokens and ×proofSlowFactor in proof mode', () => {
    expect(durationMs('base', FULL_MOTION)).toBe(motion.duration.base);
    expect(durationMs('base', SLOW_MOTION)).toBe(motion.duration.base * motion.proofSlowFactor);
    expect(durationMs(1500, SLOW_MOTION)).toBe(15000);
    expect(timingConfig('slow', 'luxe', FULL_MOTION).duration).toBe(motion.duration.slow);
    expect(ambientPeriodMs('ringRotate', FULL_MOTION)).toBe(motion.ambient.ringRotate);
    expect(ambientPeriodMs('glowBreath', SLOW_MOTION)).toBe(motion.ambient.glowBreath * motion.proofSlowFactor);
  });

  it('R1 stagger: 80 + i × 60, capped at 8 items, ×10 in proof mode, none when reduced', () => {
    const { delayChildren, stagger } = motion.choreography;
    expect(staggerDelay(0, FULL_MOTION)).toBe(delayChildren);
    expect(staggerDelay(3, FULL_MOTION)).toBe(delayChildren + 3 * stagger);
    expect(staggerDelay(7, FULL_MOTION)).toBe(delayChildren + 7 * stagger);
    expect(staggerDelay(12, FULL_MOTION)).toBe(staggerDelay(7, FULL_MOTION));
    expect(staggerDelay(2, SLOW_MOTION)).toBe((delayChildren + 2 * stagger) * motion.proofSlowFactor);
    expect(staggerDelay(5, REDUCED_MOTION)).toBe(0);
  });
});

describe('layout builders', () => {
  it('R1 enterRise: FadeInDown.springify() with the gentle numbers, the stagger delay and a 12 px rise (H-MB-05)', () => {
    const b = fields(enterRise(2, FULL_MOTION));
    expect([b.stiffnessV, b.dampingV, b.massV]).toEqual([
      motion.spring.gentle.stiffness,
      motion.spring.gentle.damping,
      motion.spring.gentle.mass,
    ]);
    expect(b.getDelay()).toBe(staggerDelay(2, FULL_MOTION));
    expect(b.getReduceMotion()).toBe(ReduceMotion.System);
    // The built worklet starts 12 px low instead of the builder's 25 px default.
    expect(b.build()().initialValues).toEqual({ opacity: 0, transform: [{ translateY: motion.distance.rise }] });
    expect(fields(enterRise(0, FULL_MOTION, { distance: 'riseLg' })).build()().initialValues).toEqual({
      opacity: 0,
      transform: [{ translateY: motion.distance.riseLg }],
    });
  });

  it('enterRise in proof mode is a slower×10 timing with a ×10 stagger', () => {
    const b = fields(enterRise(1, SLOW_MOTION));
    expect(b.getDuration()).toBe(motion.duration.slower * motion.proofSlowFactor);
    expect(b.getDelay()).toBe(staggerDelay(1, SLOW_MOTION));
    expect(b.stiffnessV).toBeUndefined();
  });

  it('reduced enters and exits are opacity-only fades of at most 160 ms that still run (ReduceMotion.Never)', () => {
    for (const b of [enterRise(5, REDUCED_MOTION), exitUp(REDUCED_MOTION), crossFadeIn(REDUCED_MOTION)]) {
      expect(fields(b).getDuration()).toBeLessThanOrEqual(REDUCED_FADE_MS);
      expect(fields(b).getDelay()).toBe(0);
      expect(fields(b).getReduceMotion()).toBe(ReduceMotion.Never);
      expect(fields(b).build()().initialValues).toEqual({ opacity: expect.any(Number) });
    }
    expect(REDUCED_FADE_MS).toBe(motion.duration.fast);
  });

  it('R2 exitUp: 160 ms, exit easing, lifts exitDrop (8 px), faster than any enter', () => {
    const b = fields(exitUp(FULL_MOTION));
    expect(b.getDuration()).toBe(motion.duration.fast);
    expect(b.targetValues).toEqual({ opacity: 0, translateY: -motion.distance.exitDrop });
  });

  it('layout (FLIP) uses the gentle spring; reduced re-flow is NO transition (wave K M1, G81b-03: a reduced one leaves the native frame stale)', () => {
    const full = fields(layoutTransition(FULL_MOTION));
    expect([full.stiffnessV, full.dampingV, full.massV]).toEqual([170, 26, 1]);
    expect(layoutTransition(REDUCED_MOTION)).toBeUndefined();
  });

  it('list insertion and row reveal rise riseSm (6 px); reduced = instant (undefined builder)', () => {
    expect(fields(listInsert(FULL_MOTION)).build()().initialValues).toEqual({
      opacity: 0,
      transform: [{ translateY: motion.distance.riseSm }],
    });
    expect(fields(rowReveal(3, FULL_MOTION)).getDelay()).toBe(3 * 30);
    expect(fields(rowReveal(30, FULL_MOTION)).getDelay()).toBe((motion.threshold.staggerCap - 1) * 30);
    expect(listInsert(REDUCED_MOTION)).toBeUndefined();
    expect(rowReveal(3, REDUCED_MOTION)).toBeUndefined();
  });

  it('M-APP-04 stack animations; reduced always cross-fades', () => {
    expect(stackAnimation('tabs', FULL_MOTION)).toBe('fade');
    expect(stackAnimation('auth', FULL_MOTION)).toBe('fade');
    expect(stackAnimation('drillIn', FULL_MOTION)).toBe('slide_from_right');
    expect(stackAnimation('sessionFlow', FULL_MOTION)).toBe('fade_from_bottom');
    expect(stackAnimation('drillIn', REDUCED_MOTION)).toBe('fade');
    expect(stackAnimation('sessionFlow', REDUCED_MOTION)).toBe('fade');
  });
});

describe('value animations', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  function run(ms: number) {
    act(() => {
      jest.advanceTimersByTime(ms);
    });
  }

  it('loops are off under reduced motion: breath, rotation and REC pulse return their static frame', () => {
    expect(animateBreath(0.55, 1, 'glowBreath', REDUCED_MOTION, 0.8)).toBe(0.8);
    expect(animateBreath(0.55, 1, 'glowBreath', REDUCED_MOTION)).toBe(1);
    expect(animateRotation('ringRotate', REDUCED_MOTION, 1.5)).toBe(1.5);
    expect(animateRecPulse(REDUCED_MOTION)).toBe(1);
  });

  it('full-motion loops are animations, not static values', () => {
    expect(typeof animateBreath(0.55, 1, 'glowBreath', FULL_MOTION)).not.toBe('number');
    expect(typeof animateRotation('ringRotate', FULL_MOTION)).not.toBe('number');
  });

  it('a spring settles on its target; reduced motion jumps there on the next frame', () => {
    const full = makeMutable(0);
    const reduced = makeMutable(0);
    full.set(animateSpring(1, 'gentle', FULL_MOTION));
    reduced.set(animateSpring(1, 'gentle', REDUCED_MOTION));
    run(34);
    expect(reduced.get()).toBe(1);
    expect(full.get()).toBeGreaterThan(0);
    expect(full.get()).toBeLessThan(1);
    run(2000);
    expect(full.get()).toBeCloseTo(1, 2);
  });

  it('proof mode stretches a spring into a slower × 10 timing', () => {
    const v = makeMutable(0);
    v.set(animateSpring(1, 'snappy', SLOW_MOTION));
    run(3000);
    expect(v.get()).toBeLessThan(1);
    run(motion.duration.slower * motion.proofSlowFactor);
    expect(v.get()).toBe(1);
  });

  it('timings finish after their token duration', () => {
    const v = makeMutable(0);
    v.set(animateTiming(1, 'base', 'luxe', FULL_MOTION));
    run(motion.duration.base / 2);
    expect(v.get()).toBeGreaterThan(0);
    expect(v.get()).toBeLessThan(1);
    run(motion.duration.base);
    expect(v.get()).toBe(1);
  });

  it('a reduced fade still fades (≤ 160 ms) instead of jumping', () => {
    const v = makeMutable(0);
    v.set(animateFade(1, REDUCED_MOTION, 'slow'));
    run(50);
    expect(v.get()).toBeGreaterThan(0);
    expect(v.get()).toBeLessThan(1);
    run(REDUCED_FADE_MS);
    expect(v.get()).toBe(1);
  });

  it('one pulse returns to rest; reduced shows no pulse', () => {
    const v = makeMutable(0);
    v.set(animatePulseOnce(1, 0, FULL_MOTION));
    run(300);
    expect(v.get()).toBeGreaterThan(0.5);
    run(400);
    expect(v.get()).toBe(0);
    const r = makeMutable(0);
    r.set(animatePulseOnce(1, 0, REDUCED_MOTION));
    run(34);
    expect(r.get()).toBe(0);
  });

  it('the login shake visits the spec offsets once and ends at 0; reduced does not shake', () => {
    const x = makeMutable(0);
    x.set(animateShake(FULL_MOTION));
    const seen: number[] = [];
    for (let t = 0; t < 400; t += 10) {
      run(10);
      seen.push(x.get());
    }
    expect(Math.min(...seen)).toBeCloseTo(-6, 0);
    expect(Math.max(...seen)).toBeCloseTo(6, 0);
    expect(x.get()).toBe(0);
    const r = makeMutable(0);
    r.set(animateShake(REDUCED_MOTION));
    run(20);
    expect(r.get()).toBe(0);
  });
});
