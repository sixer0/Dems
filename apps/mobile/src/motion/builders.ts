/**
 * Motion builders (04_mobile_specs §7.1, §7.2, §7.4; 03_motion_spec §3 R1, R2, R7, R8 and §8).
 *
 * Two kinds:
 * - **Value animations** (`animate*`) return what a shared value is assigned
 *   (`sv.value = animateSpring(1, 'gentle', m)`). They are worklets.
 * - **Layout animation builders** (`enterRise`, `exitUp`, `layoutTransition`, …) return the
 *   Reanimated builder for the `entering`, `exiting` and `layout` props.
 *
 * Every builder takes the `MotionSettings` from `useMotionSettings()` and applies the policy
 * itself: full motion, proof mode (×10) or reduced motion (03M §8: loops off, enters and exits
 * opacity ≤ 160 ms, flights cross-fade, tickers jump, flashes become static, no shake).
 *
 * Reduce-motion flags on layout builders are explicit: full motion uses `ReduceMotion.System`
 * (which the `ReducedMotionConfig` in `MotionPolicyProvider` resolves), and the reduced opacity
 * fades use `ReduceMotion.Never` so that they still run while the config says `Always`.
 */
import {
  Easing,
  FadeIn,
  FadeInDown,
  FadeOut,
  FadeOutUp,
  LinearTransition,
  ReduceMotion,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
  type AnimationCallback,
  type EntryOrExitLayoutType,
} from 'react-native-reanimated';
import {
  motion,
  type AmbientToken,
  type DurationToken,
  type EasingToken,
  type SpringTokenName,
} from '@dems/shared/tokens';
import {
  EASING,
  REDUCED_FADE_MS,
  SPEC_LITERALS,
  ambientPeriodMs,
  durationMs,
  slowSpringTiming,
  springConfig,
  staggerDelay,
  timingConfig,
  type MotionSettings,
} from './tokens';

const TWO_PI = Math.PI * 2;

// ---------------------------------------------------------------------------------------------
// Value animations (worklets)
// ---------------------------------------------------------------------------------------------

/** Instant assignment that still reports completion (reduced motion: "jump to the final value"). */
function jump(to: number, callback?: AnimationCallback): number {
  'worklet';
  return withTiming(to, { duration: 0 }, callback);
}

/**
 * A token spring (`gentle`, `snappy`, `bouncy`, `counter`, `meter`, `indicator`), §7.1.
 * Proof mode: `withTiming(slower × 10)`. Reduced: jump.
 */
export function animateSpring(
  to: number,
  name: SpringTokenName,
  m: MotionSettings,
  callback?: AnimationCallback,
): number {
  'worklet';
  if (m.policy === 'reduced') return jump(to, callback);
  if (m.slow) return withTiming(to, slowSpringTiming(), callback);
  return withSpring(to, springConfig(name), callback);
}

/** A token timing (`duration.*` or a spec literal in ms, `easing.*`). Reduced: jump. */
export function animateTiming(
  to: number,
  duration: DurationToken | number,
  easing: EasingToken,
  m: MotionSettings,
  callback?: AnimationCallback,
): number {
  'worklet';
  if (m.policy === 'reduced') return jump(to, callback);
  return withTiming(to, timingConfig(duration, easing, m), callback);
}

/**
 * An opacity fade that survives reduced motion as a short fade (≤ `fast`, 03M §8 "opacity only"):
 * use it for enters, exits and cross-fades, never for loops.
 */
export function animateFade(
  to: number,
  m: MotionSettings,
  duration: DurationToken | number = 'base',
  callback?: AnimationCallback,
): number {
  'worklet';
  if (m.policy === 'reduced') {
    const d = Math.min(typeof duration === 'number' ? duration : motion.duration[duration], REDUCED_FADE_MS);
    return withTiming(to, { duration: d, easing: EASING.standard, reduceMotion: ReduceMotion.Never }, callback);
  }
  return withTiming(to, timingConfig(duration, 'standard', m), callback);
}

/**
 * Ambient breathing loop `low ↔ high` over one period (for example `glowBreath` 2,400 ms: the glow
 * layer opacity, 03M §2.1). Reduced: the static `rest` value (03M §8 "static final frame").
 * The caller also registers the loop with `useAmbientLoop` so it pauses off-focus (§7.1 Loops).
 */
export function animateBreath(
  low: number,
  high: number,
  period: AmbientToken | number,
  m: MotionSettings,
  rest: number = high,
): number {
  'worklet';
  if (m.policy === 'reduced') return rest;
  const half = ambientPeriodMs(period, m) / 2;
  const ease = Easing.inOut(Easing.sin);
  return withRepeat(
    withSequence(withTiming(high, { duration: half, easing: ease }), withTiming(low, { duration: half, easing: ease })),
    -1,
  );
}

/**
 * Linear rotation loop from `from` through one full turn per period (for example `ringRotate`
 * 60 s). Radians by default (Skia `Group` transforms); pass `'deg'` for RN `rotate` strings built
 * by the caller. Reduced: stays at `from`.
 */
export function animateRotation(
  period: AmbientToken | number,
  m: MotionSettings,
  from = 0,
  unit: 'rad' | 'deg' = 'rad',
): number {
  'worklet';
  if (m.policy === 'reduced') return from;
  const turn = unit === 'rad' ? TWO_PI : 360;
  return withRepeat(withTiming(from + turn, { duration: ambientPeriodMs(period, m), easing: Easing.linear }), -1);
}

/**
 * The REC pulse (M-C-05): 1 → `dim` → 1 over `recPulse` (1,200 ms, 0.83 Hz, below the 3 Hz flash
 * limit of P8). Reduced: static 1 (a steady red dot; the timer still ticks).
 */
export function animateRecPulse(m: MotionSettings, dim = 0.35): number {
  'worklet';
  return animateBreath(dim, 1, 'recPulse', m, 1);
}

/**
 * One pulse or flash `rest → peak → rest` (R8 escalation: exactly one, then a steady colour;
 * M-C-18 shutter). Reduced: `rest` (the caller shows a static colour or border instead).
 */
export function animatePulseOnce(
  peak: number,
  rest: number,
  m: MotionSettings,
  totalMs: number = SPEC_LITERALS.escalationPulseMs,
  callback?: AnimationCallback,
): number {
  'worklet';
  if (m.policy === 'reduced') return jump(rest, callback);
  const half = durationMs(totalMs, m) / 2;
  return withSequence(
    withTiming(peak, { duration: half, easing: EASING.standard }),
    withTiming(rest, { duration: half, easing: EASING.standard }, callback),
  );
}

/**
 * The one login-error shake (M-C-22, 03M P7: never looping): x through `[0, −6, 6, −4, 4, 0]` over
 * 300 ms. Reduced: 0 (the screen shows a red border instead).
 */
export function animateShake(m: MotionSettings, callback?: AnimationCallback): number {
  'worklet';
  if (m.policy === 'reduced') return jump(0, callback);
  const offsets = SPEC_LITERALS.shakeOffsets;
  const last = offsets.length - 1;
  const step = durationMs(SPEC_LITERALS.shakeMs, m) / last;
  const animations: number[] = [];
  for (let i = 1; i <= last; i += 1) {
    animations.push(
      withTiming(offsets[i] ?? 0, { duration: step, easing: EASING.standard }, i === last ? callback : undefined),
    );
  }
  return withSequence(...animations);
}

/** Delays a value animation by a stagger or held beat; reduced motion never waits. */
export function animateAfter(delayMs: number, animation: number, m: MotionSettings): number {
  'worklet';
  if (m.policy === 'reduced' || delayMs <= 0) return animation;
  return withDelay(durationMs(delayMs, m), animation);
}

// ---------------------------------------------------------------------------------------------
// Layout animation builders (entering / exiting / layout props)
// ---------------------------------------------------------------------------------------------

export type RiseDistance = keyof typeof motion.distance;

export interface EnterOptions {
  /** Rise distance token; default `rise` (12 px, R1 panels). `riseSm` for rows, `riseLg` for heroes. */
  distance?: RiseDistance;
  /** Extra delay before the stagger slot, ms (for example a screen's enter beat, §7.3). */
  afterMs?: number;
}

/**
 * R1 enter (§7.1): `FadeInDown.springify()` with the `gentle` numbers, delayed `80 + i × 60` and
 * capped at 8 items, rising `distance` px (H-MB-05: `withInitialValues` overrides the builder's
 * 25 px default; confirmed in Reanimated 4.5.1 `resolveTransformSlot`).
 * Proof mode: timing `slower × 10` and stagger ×10. Reduced: a 160 ms opacity fade, no stagger.
 */
export function enterRise(index: number, m: MotionSettings, options: EnterOptions = {}): EntryOrExitLayoutType {
  if (m.policy === 'reduced') {
    return FadeIn.duration(REDUCED_FADE_MS).reduceMotion(ReduceMotion.Never);
  }
  const rise = motion.distance[options.distance ?? 'rise'];
  const delay = staggerDelay(index, m) + durationMs(options.afterMs ?? 0, m);
  const builder = m.slow
    ? FadeInDown.duration(slowSpringTiming().duration ?? 0).easing(EASING.luxe)
    : FadeInDown.springify()
        .stiffness(motion.spring.gentle.stiffness)
        .damping(motion.spring.gentle.damping)
        .mass(motion.spring.gentle.mass);
  return builder
    .delay(delay)
    .withInitialValues({ opacity: 0, translateY: rise })
    .reduceMotion(ReduceMotion.System);
}

/**
 * R2 exit (§7.1): `FadeOutUp.duration(160).easing(exit)`, no stagger, lifting `exitDrop` (8 px).
 * Exits are always faster than enters (P2). Reduced: a 160 ms opacity fade.
 */
export function exitUp(m: MotionSettings): EntryOrExitLayoutType {
  if (m.policy === 'reduced') {
    return FadeOut.duration(REDUCED_FADE_MS).reduceMotion(ReduceMotion.Never);
  }
  return FadeOutUp.duration(durationMs('fast', m))
    .easing(EASING.exit)
    .withTargetValues({ opacity: 0, translateY: -motion.distance.exitDrop })
    .reduceMotion(ReduceMotion.System);
}

/**
 * Layout (FLIP) re-flow (§7.1; M-MB-03 rotation and split-screen; filter re-flow in lists):
 * `LinearTransition.springify()` with the `gentle` numbers. Reduced: NO transition (`undefined`),
 * so the platform lays the view out itself.
 *
 * WHY `undefined` AND NOT A ZERO-LENGTH TRANSITION (wave K M1, gate finding G81b-03; proven on the
 * tablet, `implementation/142_fix_wave_k_m1.md` section 2). On this stack (Reanimated 4.5 on the
 * new architecture) a layout transition that is REDUCED - `.reduceMotion(ReduceMotion.Always)`, or
 * `ReduceMotion.System` while the app's `ReducedMotionConfig` says reduce - is skipped WITHOUT the
 * new frame being applied: the native view keeps the size it had before its content changed. A
 * view whose content grew then draws children outside its own box, and Android delivers no touch
 * there. A view with no `layout` prop is laid out by the platform and has no such state.
 */
export function layoutTransition(m: MotionSettings) {
  if (m.policy === 'reduced') return undefined;
  if (m.slow) return LinearTransition.duration(slowSpringTiming().duration ?? 0).easing(EASING.luxe);
  return LinearTransition.springify()
    .stiffness(motion.spring.gentle.stiffness)
    .damping(motion.spring.gentle.damping)
    .mass(motion.spring.gentle.mass)
    .reduceMotion(ReduceMotion.System);
}

/**
 * Live list insertion (M-C-07): `FadeInDown.duration(240)` rising `riseSm`; pair it with
 * `layoutTransition`. Insertions closer than `insertionMinGapMs` are coalesced by the caller (R9).
 * Reduced: instant (the highlight still fades, M-C-07).
 */
export function listInsert(m: MotionSettings): EntryOrExitLayoutType | undefined {
  if (m.policy === 'reduced') return undefined;
  return FadeInDown.duration(durationMs('base', m))
    .easing(EASING.luxe)
    .withInitialValues({ opacity: 0, translateY: motion.distance.riseSm })
    .reduceMotion(ReduceMotion.System);
}

/**
 * First-load row reveal (M-C-11): rows stagger 30 ms with a 6 px rise, capped at `staggerCap`.
 * Reduced: no stagger and no rise (instant).
 */
export function rowReveal(index: number, m: MotionSettings): EntryOrExitLayoutType | undefined {
  if (m.policy === 'reduced') return undefined;
  return FadeInDown.duration(durationMs('base', m))
    .easing(EASING.luxe)
    .delay(staggerDelay(index, m, { stepMs: SPEC_LITERALS.rowStaggerMs, baseMs: 0 }))
    .withInitialValues({ opacity: 0, translateY: motion.distance.riseSm })
    .reduceMotion(ReduceMotion.System);
}

/**
 * Cross-fade in (tab switches 160 ms, M-APP-04; the cross-screen replacement for shared elements,
 * App. A). Reduced keeps the 160 ms cross-fade (03M §8 route transitions).
 */
export function crossFadeIn(m: MotionSettings): EntryOrExitLayoutType {
  return FadeIn.duration(m.policy === 'reduced' ? REDUCED_FADE_MS : durationMs('fast', m))
    .easing(EASING.standard)
    .reduceMotion(ReduceMotion.Never);
}

/** Cross-fade out, the pair of `crossFadeIn`. */
export function crossFadeOut(m: MotionSettings): EntryOrExitLayoutType {
  return FadeOut.duration(m.policy === 'reduced' ? REDUCED_FADE_MS : durationMs('fast', m))
    .easing(EASING.exit)
    .reduceMotion(ReduceMotion.Never);
}

// ---------------------------------------------------------------------------------------------
// Route transitions (M-APP-04)
// ---------------------------------------------------------------------------------------------

/** The navigation moments of M-APP-04 and their direction (R7). */
export type RouteMotionKind = 'tabs' | 'auth' | 'drillIn' | 'sessionFlow';

/** Native-stack animation names used by the kit (react-native-screens `StackAnimationTypes`). */
export type StackAnimation = 'fade' | 'slide_from_right' | 'fade_from_bottom';

/**
 * Stack `animation` per M-APP-04: `fade` (tabs and auth), `slide_from_right` (drill-in, R7
 * forward), `fade_from_bottom` (entering the session flow). Reduced: `fade` (cross-fade 160).
 */
export function stackAnimation(kind: RouteMotionKind, m: MotionSettings): StackAnimation {
  if (m.policy === 'reduced') return 'fade';
  switch (kind) {
    case 'drillIn':
      return 'slide_from_right';
    case 'sessionFlow':
      return 'fade_from_bottom';
    case 'tabs':
    case 'auth':
    default:
      return 'fade';
  }
}
