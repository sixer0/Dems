/**
 * C-2 DbfsMeter (04_mobile_specs §4.0, §5.4, §7.4 M-C-04; 03_motion_spec M-C-04, App. A).
 *
 * Input is UI-thread shared values written by the runtime at 20 Hz. Segment opacity, spring
 * smoothing, peak hold and the 4 Hz readout are worklets and Skia props, so an audio frame causes
 * zero React renders (MA-16). This file deliberately holds no React state.
 */
import { JetBrainsMono_500Medium } from '@expo-google-fonts/jetbrains-mono/500Medium';
import {
  BlurMask,
  Canvas,
  DashPathEffect,
  Group,
  Line,
  Rect,
  RoundedRect,
  Text as SkiaText,
  rect,
  rrect,
  useFont,
  vec,
  type SkSize,
} from '@shopify/react-native-skia';
import { Chip, Typography } from 'heroui-native';
import { memo, useEffect } from 'react';
import { View, type AccessibilityValue, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  useAnimatedReaction,
  useAnimatedStyle,
  useDerivedValue,
  useFrameCallback,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { motion as motionTokens, palette, toneHex } from '@dems/shared/tokens';
import { withAlpha } from '@/components/media/color';
import {
  CLIP_FLASH_LOW,
  CLIP_FLASH_MS,
  DBFS_FLOOR,
  DBFS_THRESHOLDS,
  METER_SPRING,
  NO_SIGNAL_FADE_MS,
  PAUSED_DIM,
  READOUT_MAX_HZ,
  REDUCED_UPDATE_HZ,
  SEGMENT_COUNT,
  UNLIT_OPACITY,
  formatDbfs,
  initialPeakState,
  isDue,
  meterLayout,
  peakOffset,
  readoutSize,
  segmentOpacity,
  segmentTone,
  stepPeakHold,
  type MeterLayout,
  type MeterOrientation,
  type MeterVariant,
  type PeakState,
} from './dbfs-meter.math';

export type { MeterOrientation, MeterVariant } from './dbfs-meter.math';

export interface DbfsMeterLabels {
  unit?: string;
  clip?: string;
  noSignal?: string;
  clipResetHint?: string;
}

export interface DbfsMeterProps {
  /** Live level in dBFS (the runtime writes it at 20 Hz, 04 §5.4). */
  level: SharedValue<number>;
  /** Simulator peak in dBFS; the meter also holds its own peak from `level`. */
  peak?: SharedValue<number>;
  /** Clip latch, 0 or 1. */
  clip?: SharedValue<number>;
  variant?: MeterVariant;
  orientation?: MeterOrientation;
  /** Motion policy from `useMotionPolicy()` (04 §7.7); `reduced` = 10 Hz direct, no spring, no flash. */
  motion: 'full' | 'reduced';
  /** Stops the UI-thread clock while the screen is unfocused or off-screen (04 §7.8). */
  paused?: boolean;
  signal?: 'ok' | 'no-signal';
  /** "Pause monitoring" (UI-only, D28/Q8) dims the meter; recording is unaffected. */
  monitoringPaused?: boolean;
  onClipReset?: () => void;
  /** i18n strings from the screen; English defaults. */
  labels?: DbfsMeterLabels;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  accessibilityLabel?: string;
  /** Updated by the screen at 1 Hz (01_specs §14.6); never per frame. */
  accessibilityValue?: AccessibilityValue;
}

const DEFAULT_HEIGHT: Record<MeterVariant, number> = { card: 64, large: 150, compact: 10 };
const LUXE = Easing.bezier(...motionTokens.easing.luxe);

/**
 * The meter. Screens pass `accessibilityValue` at 1 Hz; that re-renders only this outer view,
 * because the canvas below is memoised and receives stable shared-value props.
 */
export function DbfsMeter({
  variant = 'card',
  orientation = 'horizontal',
  style,
  testID,
  accessibilityLabel,
  accessibilityValue,
  ...canvasProps
}: DbfsMeterProps) {
  const heightStyle = orientation === 'horizontal' ? { height: DEFAULT_HEIGHT[variant] } : { minHeight: 120 };
  return (
    <View
      testID={testID}
      style={[heightStyle, style]}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={accessibilityValue ?? { min: -60, max: 0 }}
    >
      <MeterCanvas variant={variant} orientation={orientation} {...canvasProps} />
    </View>
  );
}

type MeterCanvasProps = Omit<DbfsMeterProps, 'style' | 'testID' | 'accessibilityLabel' | 'accessibilityValue'> & {
  variant: MeterVariant;
  orientation: MeterOrientation;
};

const MeterCanvas = memo(function MeterCanvas({
  level,
  peak,
  clip,
  variant,
  orientation,
  motion,
  paused = false,
  signal = 'ok',
  monitoringPaused = false,
  onClipReset,
  labels,
}: MeterCanvasProps) {
  const reduced = motion === 'reduced';
  const unit = labels?.unit ?? 'dBFS';

  const size = useSharedValue<SkSize>({ width: 0, height: 0 });
  const layout = useDerivedValue(() => meterLayout(size.get().width, size.get().height, variant, orientation));

  // Displayed level: spring-smoothed in full motion, direct 10 Hz updates when reduced.
  const display = useSharedValue(DBFS_FLOOR);
  const peakState = useSharedValue<PeakState>(initialPeakState());
  const readout = useSharedValue(formatDbfs(DBFS_FLOOR, unit));
  const lastReadoutAt = useSharedValue(0);
  const lastDirectAt = useSharedValue(0);
  const signalFactor = useSharedValue(signal === 'no-signal' ? 0 : 1);
  const dim = useSharedValue(monitoringPaused ? PAUSED_DIM : 1);

  useAnimatedReaction(
    () => level.get(),
    (value) => {
      if (!reduced) display.set(withSpring(value, METER_SPRING));
    },
    [reduced],
  );

  // One UI-thread clock per meter: peak ballistics, the reduced-motion sampler and the 4 Hz readout.
  const clock = useFrameCallback((frame) => {
    'worklet';
    const now = frame.timestamp;
    const input = level.get();
    const prev = peakState.get();
    const next = stepPeakHold(prev, peak ? Math.max(peak.get(), input) : input, now);
    if (next.peak !== prev.peak || next.heldUntil !== prev.heldUntil) peakState.set(next);
    if (reduced && isDue(lastDirectAt.get(), now, REDUCED_UPDATE_HZ)) {
      if (display.get() !== input) display.set(input);
      lastDirectAt.set(now);
    }
    if (isDue(lastReadoutAt.get(), now, READOUT_MAX_HZ)) {
      const text = formatDbfs(input, unit);
      if (text !== readout.get()) readout.set(text);
      lastReadoutAt.set(now);
    }
  }, false);

  // The hook unregisters the callback on unmount; this only toggles it.
  useEffect(() => {
    clock.setActive(!paused);
  }, [clock, paused]);

  useEffect(() => {
    const target = signal === 'no-signal' ? 0 : 1;
    signalFactor.set(reduced ? target : withTiming(target, { duration: NO_SIGNAL_FADE_MS, easing: LUXE }));
  }, [signal, reduced, signalFactor]);

  useEffect(() => {
    const target = monitoringPaused ? PAUSED_DIM : 1;
    dim.set(reduced ? target : withTiming(target, { duration: motionTokens.duration.base }));
  }, [monitoringPaused, reduced, dim]);

  const peakRect = useDerivedValue(() => {
    const l = layout.get();
    const at = peakOffset(l, orientation, peakState.get().peak);
    const t = l.peakThickness;
    return orientation === 'horizontal'
      ? rect(Math.min(Math.max(at - t / 2, 0), l.bars.width - t), l.bars.y, t, l.bars.height)
      : rect(l.bars.x, Math.min(Math.max(at - t / 2, 0), l.bars.height - t), l.bars.width, t);
  });
  const peakOpacity = useDerivedValue(() =>
    peakState.get().peak >= DBFS_THRESHOLDS[0] ? 0.9 * signalFactor.get() : 0,
  );
  const flatP1 = useDerivedValue(() => vec(0, Math.max(layout.get().bars.height - 1, 0)));
  const flatP2 = useDerivedValue(() => vec(layout.get().bars.width, Math.max(layout.get().bars.height - 1, 0)));
  const flatOpacity = useDerivedValue(() => (1 - signalFactor.get()) * 0.6);
  const readoutX = useDerivedValue(() => layout.get().readout?.x ?? 0);
  const readoutY = useDerivedValue(() => layout.get().readout?.y ?? 0);

  const fontSize = readoutSize(variant);
  const font = useFont(JetBrainsMono_500Medium, fontSize > 0 ? fontSize : 1);

  // Layout arrives through onLayout into a shared value. Skia's `onSize` is avoided on purpose: it
  // runs a per-frame `measure()` loop, even when idle, and warns on detached screens (step 71).
  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    size.set({ width, height });
  };

  return (
    <View style={{ flex: 1 }} onLayout={onLayout}>
      <Canvas style={{ flex: 1 }}>
        <Group opacity={dim}>
          {Array.from({ length: SEGMENT_COUNT }, (_, index) => (
            <Segment
              key={index}
              index={index}
              layout={layout}
              display={display}
              clip={clip}
              signalFactor={signalFactor}
            />
          ))}
          <Rect rect={peakRect} color={palette.foreground} opacity={peakOpacity} />
          <Line p1={flatP1} p2={flatP2} color={palette.gray} strokeWidth={1} opacity={flatOpacity}>
            <DashPathEffect intervals={[4, 4]} />
          </Line>
          {fontSize > 0 ? (
            <SkiaText x={readoutX} y={readoutY} text={readout} font={font} color={palette.foreground} />
          ) : null}
        </Group>
      </Canvas>
      {variant !== 'compact' ? (
        <ClipChip clip={clip} reduced={reduced} label={labels?.clip ?? 'CLIP'} hint={labels?.clipResetHint} onPress={onClipReset} />
      ) : null}
      {signal === 'no-signal' && variant !== 'compact' ? (
        <Animated.View
          pointerEvents="none"
          entering={reduced ? undefined : FadeIn.duration(NO_SIGNAL_FADE_MS)}
          exiting={reduced ? undefined : FadeOut.duration(motionTokens.duration.fast)}
          style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' }}
        >
          <Typography type="body-xs" color="muted" weight="semibold">
            {labels?.noSignal ?? 'NO SIGNAL'}
          </Typography>
        </Animated.View>
      ) : null}
    </View>
  );
});

interface SegmentProps {
  index: number;
  layout: SharedValue<MeterLayout>;
  display: SharedValue<number>;
  clip?: SharedValue<number>;
  signalFactor: SharedValue<number>;
}

/** One bar: a soft glow copy (outer blur) under the solid bar, sharing one animated opacity. */
function Segment({ index, layout, display, clip, signalFactor }: SegmentProps) {
  const color = toneHex[segmentTone(index)];
  const isTop = index === SEGMENT_COUNT - 1;
  const box = useDerivedValue(() => {
    const s = layout.get().segments[index];
    return s ? rrect(rect(s.x, s.y, s.width, s.height), s.r, s.r) : rrect(rect(0, 0, 0, 0), 0, 0);
  });
  const opacity = useDerivedValue(() => {
    // The top segment locks red while the clip latch holds (M-C-04).
    const lit = isTop && clip !== undefined && clip.get() > 0.5 ? 1 : segmentOpacity(display.get(), index);
    return UNLIT_OPACITY + (lit - UNLIT_OPACITY) * signalFactor.get();
  });
  const glow = useDerivedValue(() => layout.get().glow);
  return (
    <Group opacity={opacity}>
      <RoundedRect rect={box} color={withAlpha(color, 0.5)}>
        <BlurMask blur={glow} style="outer" />
      </RoundedRect>
      <RoundedRect rect={box} color={color} />
    </Group>
  );
}

interface ClipChipProps {
  clip?: SharedValue<number>;
  reduced: boolean;
  label: string;
  hint?: string;
  onPress?: () => void;
}

/** CLIP latch chip: pops with the bouncy spring and flashes once (180 ms); tap resets. */
function ClipChip({ clip, reduced, label, hint, onPress }: ClipChipProps) {
  const visual = useSharedValue(0);
  const flash = useSharedValue(1);

  useAnimatedReaction(
    () => (clip ? clip.get() > 0.5 : false),
    (latched, previous) => {
      if (latched === previous) return;
      if (latched) {
        if (reduced) {
          visual.set(1);
        } else {
          visual.set(withSpring(1, motionTokens.spring.bouncy));
          flash.set(
            withSequence(
              withTiming(CLIP_FLASH_LOW, { duration: CLIP_FLASH_MS / 2 }),
              withTiming(1, { duration: CLIP_FLASH_MS / 2 }),
            ),
          );
        }
      } else {
        visual.set(reduced ? 0 : withTiming(0, { duration: motionTokens.duration.fast }));
      }
    },
    [reduced],
  );

  const style = useAnimatedStyle(() => {
    const v = visual.get();
    return {
      opacity: Math.min(v, 1) * flash.get(),
      // Scale 0 when hidden so the invisible chip has no touch area.
      transform: [{ scale: v < 0.01 ? 0 : 0.8 + 0.2 * v }],
    };
  });

  if (!clip) return null;
  return (
    <Animated.View style={[{ position: 'absolute', top: 0, right: 0 }, style]}>
      <Chip
        size="sm"
        color="danger"
        variant="soft"
        onPress={onPress}
        accessibilityRole="button"
        accessibilityHint={hint ?? 'Resets the clip indicator'}
        style={reduced ? { borderWidth: 1, borderColor: toneHex.danger } : undefined}
      >
        <Chip.Label>{label}</Chip.Label>
      </Chip>
    </Animated.View>
  );
}
