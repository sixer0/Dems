/**
 * S2 REC row (04_mobile_specs §4.5; 03_motion_spec M-C-05; MB 4 (948–1185, 88–112)).
 *
 * - The dot breathes `opacity 1 → 0.35 → 1` and `scale 1 → 0.9 → 1` over `recPulse` (1,200 ms,
 *   0.83 Hz, below the P8 flash limit); a halo ring scales 1 → 2.2 while fading 0.5 → 0 once per
 *   cycle. It is one ambient loop (`monitor-rec`) and stops under reduced motion, `?motion=off` or
 *   while the screen is unfocused: then a static red dot, and the timer still ticks.
 * - The timer is fed whole seconds by `useMonitorElapsedSeconds` (the runtime's `useRecordingElapsedSeconds`:
 *   the store's clock, S4, so it survives a relaunch without resetting, MA-08; in LIVE the Core clock's ticker
 *   when it is ahead, CF2-A RF-PH-1). It was the C-6 RollingNumber in `slide` mode; closing-fix row CF-M1 (R-P-2, R-P-1)
 *   draws it with `TimerReadout`, the same columns positioned by React, because a JS stall made Reanimated
 *   drop settled digit positions and the columns fell back to the digits of their mount ("04:22" ->
 *   "04:12"; `timer-readout.tsx` has the mechanism). Full motion still rolls the digits that change.
 */
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { fontFamily, motion as motionTokens, palette, statusText, typography, type TypographyToken } from '@dems/shared/tokens';
import { ambientPeriodMs, useAmbientLoop, useMotionPolicy, useMotionSettings } from '@/motion';
import { TimerReadout } from './timer-readout';
import { useMonitorElapsedSeconds } from './use-monitor';

const DOT = 12;

export interface RecDotProps {
  /** Screen focus; an unfocused monitor stops the loop (04 §7.1 Loops). */
  paused: boolean;
  size?: number;
  testID?: string;
}

/** The pulsing REC dot with its halo (M-C-05). */
export function RecDot({ paused, size = DOT, testID }: RecDotProps) {
  const settings = useMotionSettings();
  const running = useAmbientLoop('monitor-rec', { paused });
  const phase = useSharedValue(0);

  useEffect(() => {
    if (!running) {
      phase.set(0);
      return;
    }
    const period = ambientPeriodMs('recPulse', settings);
    phase.set(0);
    phase.set(withRepeat(withTiming(1, { duration: period, easing: Easing.linear }), -1, false));
  }, [running, settings, phase]);

  const dotStyle = useAnimatedStyle(() => {
    const p = phase.get();
    // One sine cycle: 1 → dim → 1 (opacity) and 1 → 0.9 → 1 (scale).
    const wave = 0.5 - 0.5 * Math.cos(2 * Math.PI * p);
    return { opacity: 1 - 0.65 * wave, transform: [{ scale: 1 - 0.1 * wave }] };
  });
  const haloStyle = useAnimatedStyle(() => {
    const p = phase.get();
    return running
      ? { opacity: 0.5 * (1 - p), transform: [{ scale: 1 + 1.2 * p }] }
      : { opacity: 0, transform: [{ scale: 1 }] };
  }, [running]);

  return (
    <View testID={testID} style={{ width: size * 2.2, height: size * 2.2, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View
        pointerEvents="none"
        style={[
          { position: 'absolute', width: size, height: size, borderRadius: size / 2, borderWidth: 2, borderColor: palette.danger },
          haloStyle,
        ]}
      />
      <Animated.View style={[{ width: size, height: size, borderRadius: size / 2, backgroundColor: palette.danger }, dotStyle]} />
    </View>
  );
}

export interface RecTimerProps {
  size?: TypographyToken;
  testID?: string;
}

/** HH:MM:SS since the recording started (1 Hz re-render of this component only), drawn by React (CF-M1). */
export function RecTimer({ size = 'display', testID }: RecTimerProps) {
  const seconds = useMonitorElapsedSeconds();
  const policy = useMotionPolicy();
  return <TimerReadout seconds={seconds} motion={policy} size={size} color={palette.foreground} testID={testID} />;
}

export interface RecRowProps {
  paused: boolean;
  /** `display` (Orbitron 32/40, MB 4) or a smaller token in tight layouts. */
  timerSize?: TypographyToken;
}

/** "● Recording      00:24:18" (MB 4 S2). */
export function RecRow({ paused, timerSize = 'display' }: RecRowProps) {
  const { t } = useTranslation();
  return (
    <View testID="monitor-rec-row" style={styles.row} accessibilityRole="summary">
      <View style={styles.left}>
        <RecDot paused={paused} testID="monitor-rec-dot" />
        <Text maxFontSizeMultiplier={1.2} style={styles.label}>
          {t('common.enums.sessionState.RECORDING')}
        </Text>
      </View>
      <RecTimer size={timerSize} testID="monitor-timer" />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, minHeight: 48 },
  left: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  label: {
    fontFamily: fontFamily.native.semibold,
    fontSize: typography.h2.size,
    lineHeight: typography.h2.lineHeight,
    color: statusText.danger,
  },
});

/** Exported for tests: the loop period in full motion (M-C-05). */
export const REC_PULSE_MS = motionTokens.ambient.recPulse;
