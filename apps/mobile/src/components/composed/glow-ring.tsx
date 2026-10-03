/**
 * C-1 GlowRing (04_mobile_specs §4.0, §7.4 M-C-01; 03_motion_spec M-C-01, App. A).
 *
 * Skia layers, all animated on the UI thread: a rotating tick ring, six bracket arcs that trim open
 * (900 ms `luxe`, 120 ms apart), an inner solid ring that sweeps from 12 o'clock with a travelling
 * spark, and a pre-blurred glow copy whose opacity breathes (glow is never a moving shadow, 03M §9.2).
 * The state colour morphs over 600 ms; escalation adds one bloom (03M R8). With `motion="reduced"`
 * everything is the static final frame (03M §8), which also serves the D43 test switch.
 */
import {
  BlendColor,
  BlurMask,
  Canvas,
  Circle,
  Group,
  Path,
  RadialGradient,
  Skia,
  vec,
  type SkPath,
} from '@shopify/react-native-skia';
import { useEffect, useMemo, useRef, type ReactNode } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  interpolateColor,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { motion as motionTokens, palette } from '@dems/shared/tokens';
import { withAlpha } from '@/components/media/color';
import {
  BRACKET_ARCS,
  BREATH_MAX,
  BREATH_MIN,
  BREATH_STATIC,
  GLOW_BREATH_MS,
  INNER_START_DEG,
  REC_PULSE_MS,
  RING_ROTATE_MS,
  RING_SCHEDULE,
  STATE_MORPH_MS,
  arcDelay,
  isEscalation,
  pointOnCircle,
  resolveRingSize,
  ringGeometry,
  ringStateColor,
  tickSegments,
  type ArcSpec,
  type GlowRingMode,
  type GlowRingState,
  type RingGeometry,
} from './glow-ring.math';

export type { GlowRingMode, GlowRingState } from './glow-ring.math';

export interface GlowRingProps {
  mode?: GlowRingMode;
  /** dp; clamped to the mode's range (login 200–340, hero 240–340, mini 72–120). */
  size?: number;
  state?: GlowRingState;
  /** Motion policy from `useMotionPolicy()` (04 §7.7). */
  motion: 'full' | 'reduced';
  /** Pauses the ambient loops (screen unfocused, app backgrounded); they resume in phase. */
  paused?: boolean;
  /** Delay before the mount sweep, so a screen can land it last as its hero moment (04 §7.3). */
  sweepDelayMs?: number;
  /** Changing this replays the mount sweep (for example after sign-in, M-APP-01). */
  replayKey?: string | number;
  /** Centre slot: Emblem, a Lucide shield or a status label. */
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  accessibilityLabel?: string;
}

const LUXE = Easing.bezier(...motionTokens.easing.luxe);
const STANDARD = Easing.bezier(...motionTokens.easing.standard);
const SINE = Easing.inOut(Easing.sin);
const TWO_PI = Math.PI * 2;

interface RingPaths {
  ticks: SkPath;
  hairline: SkPath;
  arcs: SkPath[];
  inner: SkPath;
}

function buildPaths(g: RingGeometry): RingPaths {
  // Skia 2.6 builds immutable paths through PathBuilder (the mutating SkPath API is deprecated).
  const oval = (r: number) => Skia.XYWHRect(g.c - r, g.c - r, r * 2, r * 2);
  const ticks = Skia.PathBuilder.Make();
  for (const t of tickSegments(g)) ticks.moveTo(t.x1, t.y1).lineTo(t.x2, t.y2);
  const arcs = BRACKET_ARCS.map((a) => Skia.PathBuilder.Make().addArc(oval(g.bracketRadius), a.start, a.sweep).build());
  return {
    ticks: ticks.build(),
    hairline: Skia.PathBuilder.Make().addCircle(g.c, g.c, g.tickOuter + 1).build(),
    arcs,
    inner: Skia.PathBuilder.Make().addArc(oval(g.innerRadius), INNER_START_DEG, 359.9).build(),
  };
}

export function GlowRing({
  mode = 'hero',
  size: requestedSize,
  state = 'ready',
  motion,
  paused = false,
  sweepDelayMs = 0,
  replayKey,
  children,
  style,
  testID,
  accessibilityLabel,
}: GlowRingProps) {
  const reduced = motion === 'reduced';
  const size = resolveRingSize(mode, requestedSize);
  const g = useMemo(() => ringGeometry(size), [size]);
  const paths = useMemo(() => buildPaths(g), [g]);
  const loopsOn = !reduced && !paused;

  // Mount sweep.
  const tickOpacity = useSharedValue(reduced ? 1 : 0);
  const innerEnd = useSharedValue(reduced ? 1 : 0);
  const centre = useSharedValue(reduced ? 1 : 0);
  useEffect(() => {
    if (reduced) {
      tickOpacity.set(1);
      innerEnd.set(1);
      centre.set(1);
      return;
    }
    const d = sweepDelayMs;
    tickOpacity.set(0);
    innerEnd.set(0);
    centre.set(0);
    tickOpacity.set(withDelay(d, withTiming(1, { duration: RING_SCHEDULE.ticks.duration, easing: LUXE })));
    innerEnd.set(
      withDelay(d + RING_SCHEDULE.inner.delay, withTiming(1, { duration: RING_SCHEDULE.inner.duration, easing: LUXE })),
    );
    centre.set(
      withDelay(d + RING_SCHEDULE.centre.delay, withTiming(1, { duration: RING_SCHEDULE.centre.duration, easing: LUXE })),
    );
  }, [reduced, sweepDelayMs, replayKey, tickOpacity, innerEnd, centre]);

  // Ambient loops: rotation (not in mini mode), breathing glow, recording pulse.
  const rotation = useSharedValue(0);
  const breath = useSharedValue(reduced ? BREATH_STATIC : BREATH_MIN);
  const pulse = useSharedValue(1);
  useEffect(() => {
    if (!loopsOn) {
      cancelAnimation(rotation);
      cancelAnimation(breath);
      if (reduced) {
        rotation.set(0);
        breath.set(BREATH_STATIC);
      }
      return;
    }
    if (mode !== 'mini') {
      const from = rotation.get();
      rotation.set(withRepeat(withTiming(from + TWO_PI, { duration: RING_ROTATE_MS, easing: Easing.linear }), -1));
    }
    breath.set(
      withRepeat(
        withSequence(
          withTiming(BREATH_MAX, { duration: GLOW_BREATH_MS / 2, easing: SINE }),
          withTiming(BREATH_MIN, { duration: GLOW_BREATH_MS / 2, easing: SINE }),
        ),
        -1,
      ),
    );
    return () => {
      cancelAnimation(rotation);
      cancelAnimation(breath);
    };
  }, [loopsOn, reduced, mode, rotation, breath]);

  useEffect(() => {
    if (state === 'recording' && loopsOn) {
      pulse.set(
        withRepeat(
          withSequence(
            withTiming(0.55, { duration: REC_PULSE_MS / 2, easing: SINE }),
            withTiming(1, { duration: REC_PULSE_MS / 2, easing: SINE }),
          ),
          -1,
        ),
      );
      return () => cancelAnimation(pulse);
    }
    cancelAnimation(pulse);
    pulse.set(1);
  }, [state, loopsOn, pulse]);

  // State colour morph (600 ms) plus one bloom on escalation.
  const target = ringStateColor(state);
  const fromColor = useSharedValue(target);
  const toColor = useSharedValue(target);
  const mix = useSharedValue(1);
  const bloom = useSharedValue(0);
  const color = useDerivedValue(() => interpolateColor(mix.get(), [0, 1], [fromColor.get(), toColor.get()]));
  const previousState = useRef(state);
  useEffect(() => {
    const from = previousState.current;
    previousState.current = state;
    if (from === state) return;
    fromColor.set(color.get());
    toColor.set(target);
    if (reduced) {
      mix.set(1);
      return;
    }
    mix.set(0);
    mix.set(withTiming(1, { duration: STATE_MORPH_MS, easing: STANDARD }));
    if (isEscalation(from, state)) {
      bloom.set(withSequence(withTiming(1, { duration: 240, easing: LUXE }), withTiming(0, { duration: 900, easing: SINE })));
    }
  }, [state, target, reduced, color, fromColor, toColor, mix, bloom]);

  const rotate = useDerivedValue(() => [{ rotate: rotation.get() }]);
  const tickLayer = useDerivedValue(() => tickOpacity.get() * 0.5);
  const backdropOpacity = useDerivedValue(() => 0.16 + 0.1 * breath.get() + 0.3 * bloom.get());
  const innerGlow = useDerivedValue(() => (0.45 + 0.55 * breath.get()) * pulse.get() + 0.4 * bloom.get());
  const spark = useDerivedValue(() => pointOnCircle(g.c, g.innerRadius, INNER_START_DEG + 359.9 * innerEnd.get()));
  const sparkX = useDerivedValue(() => spark.get().x);
  const sparkY = useDerivedValue(() => spark.get().y);
  const sparkOpacity = useDerivedValue(() => {
    const e = innerEnd.get();
    return e <= 0 || e >= 1 ? 0 : Math.min(1, e * 8) * Math.min(1, (1 - e) * 6);
  });
  const centreStyle = useAnimatedStyle(() => ({
    opacity: centre.get(),
    transform: [{ scale: 0.92 + 0.08 * centre.get() }],
  }));

  return (
    <View
      testID={testID}
      style={[{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }, style]}
      accessible={accessibilityLabel !== undefined}
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel}
    >
      <Canvas style={{ position: 'absolute', width: size, height: size }}>
        {/* Warm bloom behind the ring: a white radial alpha ramp tinted with the state colour. */}
        <Circle cx={g.c} cy={g.c} r={g.tickOuter} opacity={backdropOpacity}>
          <RadialGradient
            c={vec(g.c, g.c)}
            r={g.tickOuter}
            colors={[withAlpha(palette.foreground, 0), withAlpha(palette.foreground, 0.55), withAlpha(palette.foreground, 0)]}
            positions={[0.55, 0.78, 1]}
          />
          <BlendColor color={color} mode="srcIn" />
        </Circle>

        <Group transform={rotate} origin={vec(g.c, g.c)} opacity={tickLayer}>
          <Path path={paths.ticks} style="stroke" strokeWidth={1} color={color} />
          <Path path={paths.hairline} style="stroke" strokeWidth={0.75} color={color} opacity={0.6} />
        </Group>

        {BRACKET_ARCS.map((spec, index) => (
          <Arc
            key={index}
            index={index}
            spec={spec}
            path={paths.arcs[index]}
            g={g}
            color={color}
            breath={breath}
            pulse={pulse}
            reduced={reduced}
            sweepDelayMs={sweepDelayMs}
            replayKey={replayKey}
          />
        ))}

        <Path path={paths.inner} start={0} end={innerEnd} style="stroke" strokeWidth={g.innerStroke * 3} color={color} opacity={innerGlow}>
          <BlurMask blur={g.glowBlur} style="normal" />
        </Path>
        <Path path={paths.inner} start={0} end={innerEnd} style="stroke" strokeWidth={g.innerStroke} strokeCap="round" color={color} />
        <Circle cx={sparkX} cy={sparkY} r={g.innerStroke * 2.2} color={palette.foreground} opacity={sparkOpacity}>
          <BlurMask blur={g.innerStroke * 1.5} style="solid" />
        </Circle>
      </Canvas>
      {children !== undefined ? <Animated.View style={centreStyle}>{children}</Animated.View> : null}
    </View>
  );
}

interface ArcProps {
  index: number;
  spec: ArcSpec;
  path: SkPath;
  g: RingGeometry;
  color: SharedValue<string>;
  breath: SharedValue<number>;
  pulse: SharedValue<number>;
  reduced: boolean;
  sweepDelayMs: number;
  replayKey?: string | number;
}

/** One bracket arc: trims open on mount; bright arcs carry a breathing glow copy. */
function Arc({ index, spec, path, g, color, breath, pulse, reduced, sweepDelayMs, replayKey }: ArcProps) {
  const end = useSharedValue(reduced ? 1 : 0);
  useEffect(() => {
    if (reduced) {
      end.set(1);
      return;
    }
    end.set(0);
    end.set(
      withDelay(arcDelay(index, sweepDelayMs), withTiming(1, { duration: RING_SCHEDULE.arcs.duration, easing: LUXE })),
    );
  }, [reduced, sweepDelayMs, replayKey, index, end]);

  const toneOpacity = spec.tone === 'dim' ? 0.36 : spec.tone === 'accent' ? 0.85 : 1;
  const glowWeight = spec.tone === 'bright' ? 0.9 : 0;
  const opacity = useDerivedValue(() => toneOpacity * pulse.get());
  const glowOpacity = useDerivedValue(() => glowWeight * breath.get());

  return (
    <Group opacity={opacity}>
      {glowWeight > 0 ? (
        <Path path={path} start={0} end={end} style="stroke" strokeWidth={g.bracketStroke * 1.8} color={color} opacity={glowOpacity}>
          <BlurMask blur={g.glowBlur} style="normal" />
        </Path>
      ) : null}
      <Path path={path} start={0} end={end} style="stroke" strokeWidth={g.bracketStroke} color={color} />
    </Group>
  );
}
