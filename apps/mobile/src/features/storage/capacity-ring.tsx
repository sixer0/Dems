/**
 * Capacity donut (04_mobile_specs §4.13 T2; §7.4 M-C-03; MB 8 ring at (645–760, 655–775)).
 *
 * Skia, all on the UI thread: a dim full track, the USED arc trimmed from 12 o'clock (`end` 0 →
 * share, 900 ms `luxe`, after the sweep beat), and a blurred copy of the arc as its glow. The arc
 * colour follows READY gold → LOW amber → FULL red over 400 ms; an escalation (`pulseKey` change)
 * brightens the glow once (600 ms, `totalMs` passed explicitly, F74-02). Reduced motion draws the
 * final frame: no sweep, no pulse (03M §8). The centre content (C-6 "20%" + USED) is a plain View
 * over the canvas. Fixed size: no Skia `onSize` (D58).
 *
 * DR-M85-1: a Skia arc instead of victory-native `PolarChart` + `Pie` (04 §4.13 names VM-12). One
 * trimmed arc is the whole chart here; it needs no layout measurement and the motion kit drives
 * it directly, the same primitives as C-1 GlowRing.
 */
import { BlurMask, Canvas, Path, Skia } from '@shopify/react-native-skia';
import { useEffect, useMemo, useRef, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { interpolateColor, useDerivedValue, useSharedValue, withDelay } from 'react-native-reanimated';
import type { StorageState } from '@dems/shared/domain';
import { palette } from '@dems/shared/tokens';
import { withAlpha } from '@/components/media/color';
import { animatePulseOnce, animateTiming, type MotionSettings } from '@/motion';
import { RING_COLOR, donutGeometry, ringColorIndex, sweepEnd } from './storage-model';
import { RING_COLOR_MS, RING_PULSE_MS, RING_SWEEP_MS, beatDelay } from './storage-motion';

const TRACK_COLOR = withAlpha(palette.gray, 0.16);
/** Resting glow opacity of the arc's blurred copy (the MB 8 ring's soft bloom). */
const GLOW_REST = 0.35;

export interface CapacityRingProps {
  size: number;
  /** Unrounded used share, 0–100. */
  usedRatioPercent: number;
  state: StorageState;
  motion: MotionSettings;
  /** The sweep's beat from route enter (ms; ×10 in proof mode, 0 when reduced). */
  sweepBeatMs: number;
  /** Change it to play one escalation pulse (never on mount). */
  pulseKey: number;
  children?: ReactNode;
  testID?: string;
  accessibilityLabel: string;
}

export function CapacityRing({
  size,
  usedRatioPercent,
  state,
  motion: m,
  sweepBeatMs,
  pulseKey,
  children,
  testID,
  accessibilityLabel,
}: CapacityRingProps) {
  const g = useMemo(() => donutGeometry(size), [size]);
  const paths = useMemo(() => {
    const oval = Skia.XYWHRect(g.center - g.radius, g.center - g.radius, g.radius * 2, g.radius * 2);
    return {
      track: Skia.PathBuilder.Make().addCircle(g.center, g.center, g.radius).build(),
      arc: Skia.PathBuilder.Make().addArc(oval, -90, 359.9).build(),
    };
  }, [g]);

  const target = sweepEnd(usedRatioPercent);
  const reduced = m.policy === 'reduced';
  const end = useSharedValue(reduced ? target : 0);
  const colorIndex = useSharedValue(ringColorIndex(state));
  const pulse = useSharedValue(0);

  // First value: sweep after the beat. Later values (a storage fault, a recovery): sweep at once.
  const swept = useRef(false);
  useEffect(() => {
    const animation = animateTiming(target, RING_SWEEP_MS, 'luxe', m);
    if (!swept.current && !reduced) {
      end.set(withDelay(beatDelay(sweepBeatMs, m), animation));
    } else {
      end.set(animation);
    }
    swept.current = true;
  }, [target, m, reduced, sweepBeatMs, end]);

  useEffect(() => {
    colorIndex.set(animateTiming(ringColorIndex(state), RING_COLOR_MS, 'standard', m));
  }, [state, m, colorIndex]);

  const lastPulse = useRef(pulseKey);
  useEffect(() => {
    if (lastPulse.current === pulseKey) return;
    lastPulse.current = pulseKey;
    if (reduced) return;
    pulse.set(animatePulseOnce(1, 0, m, RING_PULSE_MS));
  }, [pulseKey, reduced, m, pulse]);

  const color = useDerivedValue(() =>
    interpolateColor(colorIndex.get(), [0, 1, 2], [RING_COLOR.READY, RING_COLOR.LOW, RING_COLOR.FULL]),
  );
  const glowOpacity = useDerivedValue(() => GLOW_REST + (1 - GLOW_REST) * pulse.get());

  return (
    <View
      testID={testID}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(usedRatioPercent) }}
      style={{ width: size, height: size }}
    >
      <Canvas style={{ position: 'absolute', width: size, height: size }}>
        <Path path={paths.track} style="stroke" strokeWidth={g.stroke} color={TRACK_COLOR} />
        <Path path={paths.arc} start={0} end={end} style="stroke" strokeWidth={g.glowWidth} color={color} opacity={glowOpacity}>
          <BlurMask blur={g.glowBlur} style="normal" />
        </Path>
        <Path path={paths.arc} start={0} end={end} style="stroke" strokeWidth={g.stroke} strokeCap="butt" color={color} />
      </Canvas>
      <View style={styles.centre} pointerEvents="none">
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  centre: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, alignItems: 'center', justifyContent: 'center' },
});
