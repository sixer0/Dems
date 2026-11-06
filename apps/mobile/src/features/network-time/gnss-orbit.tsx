/**
 * The GNSS orbit, the screen's hero moment (04_mobile_specs §4.14 N3 "Skia orbit around the GNSS
 * icon while locked"; §7.3 M-PG-NET; 03M M-PG-NET "Hero moment: the GNSS orbit").
 *
 * - A fixed-size Skia canvas around the row's GNSS icon (no Skia `onSize`): a hairline orbit ring
 *   and one satellite that circles it once per `ORBIT_PERIOD_MS` on the UI thread.
 * - It is the screen's one registered ambient loop (`network-time-orbit`, the P3 cap of 4); it runs
 *   only while GNSS is locked, the policy is full and the app is active (`useAmbientLoop`).
 * - GNSS loss: the orbit fades out over `slow` (M-PG-NET data moment) and the loop stops; a fix
 *   brings it back. Reduced motion: a static satellite (no loop), the fade becomes a jump.
 */
import { Canvas, Circle, Group, vec } from '@shopify/react-native-skia';
import { useEffect } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { cancelAnimation, Easing, useDerivedValue, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { palette } from '@dems/shared/tokens';
import { withAlpha } from '@/components/media';
import { animateTiming, durationMs, useAmbientLoop, useMotionSettings } from '@/motion';

export const ORBIT_SIZE = 48;
export const ORBIT_PERIOD_MS = 8_000;
const C = ORBIT_SIZE / 2;
const ORBIT_R = 21;
const SAT_R = 2.5;
const TWO_PI = Math.PI * 2;
/** Resting angle of the satellite under reduced motion (upper right, as a still frame). */
const REST_ANGLE = -Math.PI / 4;

export interface GnssOrbitProps {
  locked: boolean;
  satellites: number;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export function GnssOrbit({ locked, style, testID }: GnssOrbitProps) {
  const m = useMotionSettings();
  const running = useAmbientLoop('network-time-orbit', { active: locked });
  const rotation = useSharedValue(REST_ANGLE);
  const opacity = useSharedValue(locked ? 1 : 0);

  useEffect(() => {
    opacity.set(animateTiming(locked ? 1 : 0, 'slow', 'luxe', m));
  }, [locked, m, opacity]);

  useEffect(() => {
    if (!running) {
      cancelAnimation(rotation);
      if (m.policy === 'reduced') rotation.set(REST_ANGLE);
      return undefined;
    }
    const from = rotation.get();
    rotation.set(withRepeat(withTiming(from + TWO_PI, { duration: durationMs(ORBIT_PERIOD_MS, m), easing: Easing.linear }), -1));
    return () => cancelAnimation(rotation);
  }, [running, m, rotation]);

  const transform = useDerivedValue(() => [{ rotate: rotation.get() }]);

  return (
    <View
      testID={testID}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[{ position: 'absolute', width: ORBIT_SIZE, height: ORBIT_SIZE }, style]}
    >
      <Canvas style={{ width: ORBIT_SIZE, height: ORBIT_SIZE }}>
        <Group opacity={opacity}>
          <Circle cx={C} cy={C} r={ORBIT_R} color={withAlpha(palette.success, 0.35)} style="stroke" strokeWidth={1} />
          <Group transform={transform} origin={vec(C, C)}>
            <Circle cx={C + ORBIT_R} cy={C} r={SAT_R} color={palette.success} />
          </Group>
        </Group>
      </Canvas>
    </View>
  );
}
