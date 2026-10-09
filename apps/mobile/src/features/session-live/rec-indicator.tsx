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
 * - Task 3 M5 (row 73; decisions D84, D91 ruling R-1 option A; ux §8 step 5, erratum PE-128-79): between the
 *   accepted start and the first durable fragment the stored state is already RECORDING while the session's
 *   `captureDurable` is `false`. Then the row reads "Connecting cameras…": no dot, no timer, nothing that says
 *   "recording" (`RecLabel`, `useConnectingCameras`; the member is read behind ONE defensive helper,
 *   `captureDurableOf` of `mic-source-model.ts`, and a session without it reads as durable, as before). The
 *   dot keeps its views mounted and is hidden by a plain opacity that React sets, so the change to
 *   "Recording" removes no Reanimated view (D208).
 */
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View, type StyleProp, type TextStyle } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { fontFamily, motion as motionTokens, palette, statusText, typography, type TypographyToken } from '@dems/shared/tokens';
import { ambientPeriodMs, useAmbientLoop, useMotionPolicy, useMotionSettings } from '@/motion';
import { useSim } from '@dems/shared/sim';
import { selectConnectingCameras } from './mic-source-model';
import { TimerReadout } from './timer-readout';
import { useMonitorElapsedSeconds } from './use-monitor';

const DOT = 12;

/** RECORDING before the first durable fragment (D84): the monitor reads "Connecting cameras…". */
export function useConnectingCameras(): boolean {
  return useSim(selectConnectingCameras);
}

export interface RecDotProps {
  /** Screen focus; an unfocused monitor stops the loop (04 §7.1 Loops). */
  paused: boolean;
  size?: number;
  testID?: string;
}

/** The pulsing REC dot with its halo (M-C-05). */
export function RecDot({ paused, size = DOT, testID }: RecDotProps) {
  const settings = useMotionSettings();
  const connecting = useConnectingCameras();
  const running = useAmbientLoop('monitor-rec', { paused: paused || connecting });
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
    <View
      testID={testID}
      style={{ width: size * 2.2, height: size * 2.2, alignItems: 'center', justifyContent: 'center', opacity: connecting ? 0 : 1 }}
    >
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
  const connecting = useConnectingCameras();
  // D84: no recording timer before the first durable fragment.
  if (connecting) return null;
  return <TimerReadout seconds={seconds} motion={policy} size={size} color={palette.foreground} testID={testID} />;
}

export interface RecLabelProps {
  style?: StyleProp<TextStyle>;
  testID?: string;
}

/** "Recording", or "Connecting cameras…" until the first durable fragment (D84). */
export function RecLabel({ style, testID = 'monitor-rec-label' }: RecLabelProps) {
  const { t } = useTranslation();
  const connecting = useConnectingCameras();
  return (
    <Text maxFontSizeMultiplier={1.2} style={[styles.label, connecting ? styles.labelConnecting : null, style]} testID={testID}>
      {connecting ? t('features.session-live.connecting') : t('common.enums.sessionState.RECORDING')}
    </Text>
  );
}

export interface RecRowProps {
  paused: boolean;
  /** `display` (Orbitron 32/40, MB 4) or a smaller token in tight layouts. */
  timerSize?: TypographyToken;
}

/** "● Recording      00:24:18" (MB 4 S2). */
export function RecRow({ paused, timerSize = 'display' }: RecRowProps) {
  return (
    <View testID="monitor-rec-row" style={styles.row} accessibilityRole="summary">
      <View style={styles.left}>
        <RecDot paused={paused} testID="monitor-rec-dot" />
        <RecLabel />
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
  labelConnecting: { color: statusText.warning },
});

/** Exported for tests: the loop period in full motion (M-C-05). */
export const REC_PULSE_MS = motionTokens.ambient.recPulse;
