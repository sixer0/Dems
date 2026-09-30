import { BlurMask, Canvas, Circle, Group, RadialGradient, vec } from '@shopify/react-native-skia';
import { useEffect } from 'react';
import { Easing, useDerivedValue, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';
import { motion, palette } from '@dems/shared/tokens';

const SIZE = 120;
const CENTER = SIZE / 2;
const GLOW_RADIUS = 48;

export interface PulseRingProps {
  /** Heartbeat sequence; every change fires one pulse. */
  seq: number | null;
  /** Solid core colour (the heartbeat tone's base hex, success when LIVE). */
  coreColor: string;
}

/**
 * Skia heartbeat ring (masterplan/01_specs.md §5.5). The radius is a Reanimated derived value
 * (a worklet), so the pulse animates entirely on the UI thread (NFR3).
 */
export function PulseRing({ seq, coreColor }: PulseRingProps) {
  const pulse = useSharedValue(0);
  const radius = useDerivedValue(() => 14 + pulse.get() * 34);

  useEffect(() => {
    if (seq === null) return;
    pulse.set(
      withSequence(
        withTiming(1, { duration: motion.duration.beatIn, easing: Easing.bezier(...motion.easing.luxe) }),
        withTiming(0, { duration: motion.duration.beatOut, easing: Easing.bezier(...motion.easing.standard) }),
      ),
    );
  }, [seq, pulse]);

  return (
    <Canvas style={{ width: SIZE, height: SIZE }}>
      <Group>
        <Circle cx={CENTER} cy={CENTER} r={radius}>
          <RadialGradient c={vec(CENTER, CENTER)} r={GLOW_RADIUS} colors={[palette.gold, `${palette.gold}00`]} />
          <BlurMask blur={6} style="normal" />
        </Circle>
        <Circle cx={CENTER} cy={CENTER} r={8} color={coreColor} />
      </Group>
    </Canvas>
  );
}
