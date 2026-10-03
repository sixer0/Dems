/**
 * Emblem asset renderer (04_mobile_specs §8.1, §7.2 M-APP-03; 01_specs §14.10).
 *
 * - `Emblem`: static react-native-svg rendering (header 32 dp, login ring centre).
 * - `EmblemDraw`: Skia variant whose strokes draw on the UI thread (`end` 0 → 1): the shield in
 *   500 ms, then the six fingerprint arcs 70 ms apart, then one soft bloom (the boot moment,
 *   M-APP-03). `scanning` pulses the arcs in sequence while a sign-in is pending (M-C-22).
 *
 * Path data defaults to the shared brand module (step 35, SCR-03) since step 72, through
 * `EMBLEM_SHARED`; `data={EMBLEM_PLACEHOLDER}` still renders the step-71 stand-in. With the shared
 * data all seven paths share one user-space gradient ramp, as the web emblem does.
 */
import {
  BlurMask,
  Canvas,
  Group,
  LinearGradient as SkiaLinearGradient,
  Path as SkiaPath,
  vec,
} from '@shopify/react-native-skia';
import { useEffect, useId, type ReactNode } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import {
  Easing,
  cancelAnimation,
  useDerivedValue,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';
import { motion as motionTokens, palette } from '@dems/shared/tokens';
import { EMBLEM_SHARED } from './brand-assets';
import { withAlpha } from './color';
import { EMBLEM_DRAW, emblemArcDelay, emblemDrawTotalMs, type EmblemPathData } from './emblem-paths';

export interface EmblemProps {
  /** Width in dp; the height follows the data's viewBox aspect (square for the shared emblem). */
  size?: number;
  data?: EmblemPathData;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  accessibilityLabel?: string;
}

const LUXE = Easing.bezier(...motionTokens.easing.luxe);
const SINE = Easing.inOut(Easing.sin);

function heightFor(size: number, data: EmblemPathData): number {
  return (size * data.viewBox.height) / data.viewBox.width;
}

/** The gradient vector in viewBox units: the data's own (shared module) or top to bottom. */
function gradientVector(data: EmblemPathData): { x1: number; y1: number; x2: number; y2: number } {
  return data.gradient ?? { x1: 0, y1: 0, x2: 0, y2: data.viewBox.height };
}

/** Static emblem (react-native-svg). */
export function Emblem({ size = 32, data = EMBLEM_SHARED, style, testID, accessibilityLabel = 'DEMS emblem' }: EmblemProps) {
  // D48: every instance gets its own gradient id (the Login → shell flight shows two emblems).
  const gradientId = `emblem-gradient-${useId().replace(/[^A-Za-z0-9_-]/g, '')}`;
  const { width, height } = data.viewBox;
  const vector = gradientVector(data);
  const stroke = `url(#${gradientId})`;
  return (
    <View testID={testID} style={style} accessible accessibilityRole="image" accessibilityLabel={accessibilityLabel}>
      <Svg width={size} height={heightFor(size, data)} viewBox={`0 0 ${width} ${height}`}>
        <Defs>
          <LinearGradient
            id={gradientId}
            gradientUnits="userSpaceOnUse"
            x1={vector.x1}
            y1={vector.y1}
            x2={vector.x2}
            y2={vector.y2}
          >
            {data.stops.map((s) => (
              <Stop key={s.offset} offset={s.offset} stopColor={s.color} />
            ))}
          </LinearGradient>
        </Defs>
        <Path
          id="emblem-shield"
          d={data.shield.outer}
          fill={withAlpha(palette.black, 0.6)}
          stroke={stroke}
          strokeWidth={data.strokeWidth.shield}
          strokeLinejoin="round"
        />
        {data.shield.inner ? (
          <Path
            d={data.shield.inner}
            fill="none"
            stroke={stroke}
            strokeWidth={data.strokeWidth.inner ?? data.strokeWidth.shield / 2}
            strokeLinejoin="round"
            opacity={0.75}
          />
        ) : null}
        {data.arcs.map((d, i) => (
          <Path
            key={i}
            id={`emblem-arc-${i + 1}`}
            d={d}
            fill="none"
            stroke={stroke}
            strokeWidth={data.strokeWidth.arc}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ))}
      </Svg>
    </View>
  );
}

export interface EmblemDrawProps extends EmblemProps {
  /** Motion policy from `useMotionPolicy()` (04 §7.7); reduced draws the static emblem at once. */
  motion: 'full' | 'reduced';
  /** Changing it replays the draw. */
  replayKey?: string | number;
  /** Sign-in pending: the arcs pulse 0.4 → 1, 150 ms apart, until it clears (M-C-22). */
  scanning?: boolean;
  /** Called once the strokes are drawn (the boot screen hands over, M-APP-03). */
  onDrawn?: () => void;
}

/** Skia emblem that draws itself (boot, login hero). */
export function EmblemDraw({
  size = 96,
  data = EMBLEM_SHARED,
  motion,
  replayKey,
  scanning = false,
  onDrawn,
  style,
  testID,
  accessibilityLabel = 'DEMS emblem',
}: EmblemDrawProps) {
  const reduced = motion === 'reduced';
  const scale = size / data.viewBox.width;
  const height = heightFor(size, data);

  const outerEnd = useSharedValue(reduced ? 1 : 0);
  const innerEnd = useSharedValue(reduced ? 1 : 0);
  const fill = useSharedValue(reduced ? 1 : 0);
  const bloom = useSharedValue(0);

  useEffect(() => {
    if (reduced) {
      outerEnd.set(1);
      innerEnd.set(1);
      fill.set(1);
      bloom.set(0);
      onDrawn?.();
      return;
    }
    outerEnd.set(0);
    innerEnd.set(0);
    fill.set(0);
    outerEnd.set(withTiming(1, { duration: EMBLEM_DRAW.shield.duration, easing: LUXE }));
    innerEnd.set(withDelay(EMBLEM_DRAW.inner.delay, withTiming(1, { duration: EMBLEM_DRAW.inner.duration, easing: LUXE })));
    fill.set(withDelay(EMBLEM_DRAW.fill.delay, withTiming(1, { duration: EMBLEM_DRAW.fill.duration, easing: LUXE })));
    const total = emblemDrawTotalMs(data.arcs.length);
    bloom.set(
      withDelay(
        total,
        withSequence(
          withTiming(1, { duration: EMBLEM_DRAW.bloom.up, easing: LUXE }),
          withTiming(0, { duration: EMBLEM_DRAW.bloom.down, easing: SINE }),
        ),
      ),
    );
    const timer = setTimeout(() => onDrawn?.(), total);
    return () => clearTimeout(timer);
    // onDrawn is a notification; replaying the draw because its identity changed would be wrong.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduced, replayKey, data, outerEnd, innerEnd, fill, bloom]);

  const colors = data.stops.map((s) => s.color);
  const positions = data.stops.map((s) => s.offset);
  const vector = gradientVector(data);
  const gradient = (
    <SkiaLinearGradient
      start={vec(vector.x1, vector.y1)}
      end={vec(vector.x2, vector.y2)}
      colors={colors}
      positions={positions}
    />
  );
  const fillOpacity = useDerivedValue(() => 0.6 * fill.get());

  return (
    <View testID={testID} style={style} accessible accessibilityRole="image" accessibilityLabel={accessibilityLabel}>
      <Canvas style={{ width: size, height }}>
        <Group transform={[{ scale }]}>
          <SkiaPath path={data.shield.outer} color={palette.black} opacity={fillOpacity} />
          <Group opacity={bloom}>
            <SkiaPath path={data.shield.outer} style="stroke" strokeWidth={data.strokeWidth.shield * 1.5} color={palette.gold}>
              <BlurMask blur={4} style="normal" />
            </SkiaPath>
          </Group>
          <SkiaPath path={data.shield.outer} start={0} end={outerEnd} style="stroke" strokeWidth={data.strokeWidth.shield} strokeJoin="round">
            {gradient}
          </SkiaPath>
          {data.shield.inner ? (
            <Group opacity={0.75}>
              <SkiaPath
                path={data.shield.inner}
                start={0}
                end={innerEnd}
                style="stroke"
                strokeWidth={data.strokeWidth.inner ?? data.strokeWidth.shield / 2}
                strokeJoin="round"
              >
                {gradient}
              </SkiaPath>
            </Group>
          ) : null}
          {data.arcs.map((d, i) => (
            <ArcStroke
              key={i}
              d={d}
              width={data.strokeWidth.arc}
              index={i}
              reduced={reduced}
              scanning={scanning}
              replayKey={replayKey}
              bloom={bloom}
            >
              {gradient}
            </ArcStroke>
          ))}
        </Group>
      </Canvas>
    </View>
  );
}

interface ArcStrokeProps {
  d: string;
  width: number;
  index: number;
  reduced: boolean;
  scanning: boolean;
  replayKey?: string | number;
  bloom: SharedValue<number>;
  children: ReactNode;
}

function ArcStroke({ d, width, index, reduced, scanning, replayKey, bloom, children }: ArcStrokeProps) {
  const end = useSharedValue(reduced ? 1 : 0);
  const pulse = useSharedValue(1);

  useEffect(() => {
    if (reduced) {
      end.set(1);
      return;
    }
    end.set(0);
    end.set(withDelay(emblemArcDelay(index), withTiming(1, { duration: EMBLEM_DRAW.arcs.duration, easing: LUXE })));
  }, [reduced, replayKey, index, end]);

  useEffect(() => {
    if (!scanning || reduced) {
      cancelAnimation(pulse);
      pulse.set(1);
      return;
    }
    pulse.set(
      withDelay(
        index * 150,
        withRepeat(withSequence(withTiming(0.4, { duration: 300, easing: SINE }), withTiming(1, { duration: 300, easing: SINE })), -1),
      ),
    );
    return () => cancelAnimation(pulse);
  }, [scanning, reduced, index, pulse]);

  const glow = useDerivedValue(() => 0.8 * bloom.get());
  return (
    <Group opacity={pulse}>
      <Group opacity={glow}>
        <SkiaPath path={d} style="stroke" strokeWidth={width * 1.8} strokeCap="round" color={palette.gold}>
          <BlurMask blur={3} style="normal" />
        </SkiaPath>
      </Group>
      <SkiaPath path={d} start={0} end={end} style="stroke" strokeWidth={width} strokeCap="round" strokeJoin="round">
        {children}
      </SkiaPath>
    </Group>
  );
}

export { EMBLEM_SHARED } from './brand-assets';
export { EMBLEM_PLACEHOLDER, type EmblemPathData } from './emblem-paths';
