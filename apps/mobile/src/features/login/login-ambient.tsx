/**
 * Login ambient accents on Skia (04_mobile_specs §7.3 Login, §7.4 M-C-23; 03M M-C-23):
 * - `GoldDust`: ≤ 24 gold points drifting up through the backdrop (an ambient loop: it runs only
 *   while the caller's `useAmbientLoop` allows it, and is not drawn at all under reduced motion);
 * - `BorderBeam`: one light segment travelling once around the auth card (6 s), then unmounted.
 *
 * Both canvases ignore touches and are sized from `onLayout` (D58: no Skia `onSize`). All
 * animation runs on the UI thread: one shared loop value drives every point (no React renders).
 */
import { BlurMask, Canvas, Group, Path, Points, Skia, type SkPoint } from '@shopify/react-native-skia';
import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import {
  Easing,
  cancelAnimation,
  useDerivedValue,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { palette } from '@dems/shared/tokens';
import { durationMs, type MotionSettings } from '@/motion';
import {
  BEAM_LAP_MS,
  DUST_COUNT,
  DUST_LAYERS,
  DUST_PERIOD_MS,
  beamOpacity,
  beamWindows,
  dustPosition,
  dustSeeds,
  type DustSeed,
} from './login-ambient.math';

const DUST_SEED = 20261001;

interface Size {
  width: number;
  height: number;
}

function sizeOf(event: LayoutChangeEvent): Size {
  const { width, height } = event.nativeEvent.layout;
  return { width, height };
}

export interface GoldDustProps {
  /** False stops the drift where it is (reduced motion, unfocused, app backgrounded, Core offline). */
  running: boolean;
  /** Reduced motion: nothing is drawn (M-C-23 "Reduced: off"). */
  reduced: boolean;
  settings: MotionSettings;
}

/** The Login gold dust (Skia `Points`, 3 depth layers, ≤ 24 points). */
export function GoldDust({ running, reduced, settings }: GoldDustProps) {
  const [size, setSize] = useState<Size>({ width: 0, height: 0 });
  const seeds = useMemo(() => dustSeeds(DUST_COUNT, DUST_SEED), []);
  const t = useSharedValue(0);
  const period = durationMs(DUST_PERIOD_MS, settings);

  useEffect(() => {
    if (!running || reduced) {
      cancelAnimation(t);
      return;
    }
    // Continue from where the loop stopped, then loop 0 → 1 forever.
    const from = t.get();
    t.set(
      withTiming(1, { duration: period * (1 - from), easing: Easing.linear }, (finished) => {
        'worklet';
        if (!finished) return;
        t.set(0);
        t.set(withRepeat(withTiming(1, { duration: period, easing: Easing.linear }), -1));
      }),
    );
    return () => cancelAnimation(t);
  }, [running, reduced, period, t]);

  if (reduced) return null;
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill} onLayout={(event) => setSize(sizeOf(event))} testID="login-gold-dust">
      {size.width > 0 ? (
        <Canvas style={StyleSheet.absoluteFill}>
          {DUST_LAYERS.map((layer, index) => (
            <DustLayer
              key={index}
              seeds={seeds.filter((seed) => seed.layer === index)}
              t={t}
              width={size.width}
              height={size.height}
              pointSize={layer.size}
              alpha={layer.alpha}
              glow={index === DUST_LAYERS.length - 1}
            />
          ))}
        </Canvas>
      ) : null}
    </View>
  );
}

interface DustLayerProps {
  seeds: DustSeed[];
  t: SharedValue<number>;
  width: number;
  height: number;
  pointSize: number;
  alpha: number;
  glow: boolean;
}

function DustLayer({ seeds, t, width, height, pointSize, alpha, glow }: DustLayerProps) {
  const points = useDerivedValue<SkPoint[]>(() => {
    const now = t.get();
    const out: SkPoint[] = [];
    for (let i = 0; i < seeds.length; i += 1) {
      const seed = seeds[i];
      if (seed) out.push(dustPosition(seed, now, width, height));
    }
    return out;
  });
  return (
    <Points points={points} mode="points" color={palette.gold} strokeWidth={pointSize} strokeCap="round" opacity={alpha}>
      {glow ? <BlurMask blur={pointSize} style="solid" /> : null}
    </Points>
  );
}

export interface BorderBeamProps {
  /** Corner radius of the card (dp). */
  radius: number;
  settings: MotionSettings;
  /** Delay before the lap starts (ms, before proof-mode scaling). */
  delayMs: number;
  /** Called once the lap is over; the caller unmounts the beam. */
  onDone: () => void;
}

/** Padding around the card so the beam's glow is not clipped. */
const BEAM_PAD = 6;

/** One lap of a gold light segment around the card (absolute overlay of the card). */
export function BorderBeam({ radius, settings, delayMs, onDone }: BorderBeamProps) {
  const [size, setSize] = useState<Size>({ width: 0, height: 0 });
  const progress = useSharedValue(0);
  const lap = durationMs(BEAM_LAP_MS, settings);
  const delay = durationMs(delayMs, settings);

  useEffect(() => {
    progress.set(0);
    progress.set(withDelay(delay, withTiming(1, { duration: lap, easing: Easing.linear })));
    const timer = setTimeout(onDone, delay + lap + 50);
    return () => {
      clearTimeout(timer);
      cancelAnimation(progress);
    };
    // onDone is a notification; a new identity must not restart the lap.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [delay, lap, progress]);

  const path = useMemo(() => {
    if (size.width <= 0 || size.height <= 0) return null;
    const rect = Skia.XYWHRect(BEAM_PAD, BEAM_PAD, size.width - BEAM_PAD * 2, size.height - BEAM_PAD * 2);
    return Skia.PathBuilder.Make().addRRect(Skia.RRectXY(rect, radius, radius)).build();
  }, [size.width, size.height, radius]);

  const headStart = useDerivedValue(() => beamWindows(progress.get()).head[0]);
  const headEnd = useDerivedValue(() => beamWindows(progress.get()).head[1]);
  const tailEnd = useDerivedValue(() => beamWindows(progress.get()).tail[1]);
  const opacity = useDerivedValue(() => beamOpacity(progress.get()));

  return (
    <View
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, { margin: -BEAM_PAD }]}
      onLayout={(event) => setSize(sizeOf(event))}
      testID="login-border-beam"
    >
      {path ? (
        <Canvas style={StyleSheet.absoluteFill}>
          <Group opacity={opacity}>
            <Path path={path} start={headStart} end={headEnd} style="stroke" strokeWidth={4} strokeCap="round" color={palette.bronze}>
              <BlurMask blur={4} style="normal" />
            </Path>
            <Path path={path} start={headStart} end={headEnd} style="stroke" strokeWidth={1.5} strokeCap="round" color={palette.gold} />
            <Path path={path} start={0} end={tailEnd} style="stroke" strokeWidth={1.5} strokeCap="round" color={palette.gold} />
          </Group>
        </Canvas>
      ) : null}
    </View>
  );
}
