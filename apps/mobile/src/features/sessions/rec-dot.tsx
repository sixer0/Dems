/**
 * The REC dot of the hub's active-session card (04_mobile_specs §4.9 "REC, timer"; 03M M-C-05):
 * opacity 1 → 0.35 → 1 and scale 1 → 0.9 → 1 over the `recPulse` period (1,200 ms, 0.83 Hz, under
 * the P8 flash limit), with a halo ring that scales 1 → 2.2 while fading out once per cycle.
 *
 * One ambient loop (`sessions-rec`); it stops under reduced motion, `?motion=off`, in the
 * background or while the screen is unfocused, leaving a static red dot (§7.7). The worklets read
 * only shared values and closure constants (no default parameters inside worklets, relay F74-02).
 */
import { useIsFocused } from 'expo-router';
import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { palette } from '@dems/shared/tokens';
import { ambientPeriodMs, useAmbientLoop, useMotionSettings } from '@/motion';

export interface RecDotProps {
  size?: number;
  testID?: string;
}

export function RecDot({ size = 10, testID }: RecDotProps) {
  const settings = useMotionSettings();
  const focused = useIsFocused();
  const running = useAmbientLoop('sessions-rec', { paused: !focused });
  const phase = useSharedValue(0);

  useEffect(() => {
    phase.set(0);
    if (!running) return;
    const period = ambientPeriodMs('recPulse', settings);
    phase.set(withRepeat(withTiming(1, { duration: period, easing: Easing.linear }), -1, false));
  }, [running, settings, phase]);

  const dotStyle = useAnimatedStyle(() => {
    const p = phase.get();
    const wave = 0.5 - 0.5 * Math.cos(2 * Math.PI * p);
    return { opacity: 1 - 0.65 * wave, transform: [{ scale: 1 - 0.1 * wave }] };
  });
  const haloStyle = useAnimatedStyle(() => {
    const p = phase.get();
    return running ? { opacity: 0.5 * (1 - p), transform: [{ scale: 1 + 1.2 * p }] } : { opacity: 0, transform: [{ scale: 1 }] };
  }, [running]);

  const box = size * 2.2;
  return (
    <View testID={testID} style={{ width: box, height: box, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View
        pointerEvents="none"
        style={[{ position: 'absolute', width: size, height: size, borderRadius: size / 2, borderWidth: 2, borderColor: palette.danger }, haloStyle]}
      />
      <Animated.View style={[{ width: size, height: size, borderRadius: size / 2, backgroundColor: palette.danger }, dotStyle]} />
    </View>
  );
}
