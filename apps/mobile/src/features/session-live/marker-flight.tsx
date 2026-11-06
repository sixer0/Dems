/**
 * M-C-17 Add Marker flight (03_motion_spec M-C-17; 04_mobile_specs §7.3 Session Monitor, §7.4).
 *
 * A chip with the marker label starts at the Bookmark tile and travels on the `gentle` spring
 * (≈ 520 ms) to the History icon (phone: the badge then pops) or into the inline timeline (tablet),
 * where the new node plays its own insertion beat (M-C-08). Cross-route shared elements are off on
 * mobile (VM-05), so this is an in-screen overlay measured with `measureInWindow`. Reduced motion:
 * no flight; the node appears directly.
 */
import { Chip } from 'heroui-native';
import { useEffect, useRef } from 'react';
import { StyleSheet } from 'react-native';
import Animated, { interpolate, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { motion as motionTokens, palette } from '@dems/shared/tokens';
import { withAlpha } from '@/components/media/color';

export interface FlightRect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface MarkerFlightSpec {
  /** Changes for every flight. */
  readonly key: number;
  readonly from: FlightRect;
  readonly to: FlightRect;
  readonly label: string;
}

export interface MarkerFlightProps {
  flight: MarkerFlightSpec | null;
  onDone: () => void;
}

const CHIP_W = 150;
const CHIP_H = 30;

/** Centre of `rect`, shifted so a chip of the flight size sits on it. */
function chipOrigin(rect: FlightRect): { x: number; y: number } {
  return { x: rect.x + rect.width / 2 - CHIP_W / 2, y: rect.y + rect.height / 2 - CHIP_H / 2 };
}

export function MarkerFlight({ flight, onDone }: MarkerFlightProps) {
  const progress = useSharedValue(0);
  const fromX = useSharedValue(0);
  const fromY = useSharedValue(0);
  const toX = useSharedValue(0);
  const toY = useSharedValue(0);
  // The latest callback, so a new `onDone` identity never restarts a flight in progress.
  const done = useRef(onDone);
  useEffect(() => {
    done.current = onDone;
  }, [onDone]);

  useEffect(() => {
    if (flight === null) return;
    const a = chipOrigin(flight.from);
    const b = chipOrigin(flight.to);
    fromX.set(a.x);
    fromY.set(a.y);
    toX.set(b.x);
    toY.set(b.y);
    const finish = () => done.current();
    progress.set(0);
    progress.set(
      withSpring(1, motionTokens.spring.gentle, (finished) => {
        'worklet';
        if (finished) scheduleOnRN(finish);
      }),
    );
    return undefined;
  }, [flight, progress, fromX, fromY, toX, toY]);

  const style = useAnimatedStyle(() => {
    const p = progress.get();
    return {
      opacity: interpolate(p, [0, 0.1, 0.85, 1], [0, 1, 1, 0]),
      transform: [
        { translateX: fromX.get() + (toX.get() - fromX.get()) * p },
        // A shallow arc: the chip lifts a little mid-flight.
        { translateY: fromY.get() + (toY.get() - fromY.get()) * p - 28 * Math.sin(Math.PI * Math.min(Math.max(p, 0), 1)) },
        { scale: interpolate(p, [0, 1], [1, 0.55]) },
      ],
    };
  });

  if (flight === null) return null;
  return (
    <Animated.View key={flight.key} pointerEvents="none" style={[styles.chip, style]} testID="monitor-marker-flight">
      <Chip size="sm" variant="soft" color="accent" style={styles.inner}>
        <Chip.Label numberOfLines={1}>{flight.label}</Chip.Label>
      </Chip>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  chip: { position: 'absolute', left: 0, top: 0, width: CHIP_W, height: CHIP_H, alignItems: 'center', justifyContent: 'center', zIndex: 50 },
  inner: { maxWidth: CHIP_W, backgroundColor: withAlpha(palette.black, 0.85), borderColor: palette.gold },
});
