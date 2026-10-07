import { useRouter } from 'expo-router';
import { PressableFeedback, Surface } from 'heroui-native';
import { ChevronRight } from 'lucide-react-native';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  FadeInDown,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  type EntryOrExitLayoutType,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fontFamily, motion as motionTokens, palette, typography } from '@dems/shared/tokens';
import { RollingNumber } from '@/components/composed/rolling-number';
import { withAlpha } from '@/components/media/color';
import {
  animateRecPulse,
  crossFadeIn,
  crossFadeOut,
  slowSpringTiming,
  useAmbientLoop,
  useMotionPolicy,
  useMotionSettings,
  type MotionSettings,
} from '@/motion';
import { useRecordingElapsedSeconds, type ActiveSessionInfo } from '@/runtime';

export type LiveMiniBarPlacement = 'above-bar' | 'top';

export interface LiveMiniBarProps {
  session: ActiveSessionInfo;
  /** `above-bar` on phones (over the tab bar); `top` at the head of the content column (§2.3). */
  placement: LiveMiniBarPlacement;
}

/** How far above its slot the mini-bar starts (04 §7.5 M-MB-02 "enters from y −24"). */
const MINI_BAR_DROP = -24;

/** M-MB-02 enter: `gentle` spring + opacity from y −24; proof mode ×10; reduced: a 160 ms fade. */
function miniBarEntering(settings: MotionSettings): EntryOrExitLayoutType {
  if (settings.policy === 'reduced') return crossFadeIn(settings);
  const { gentle } = motionTokens.spring;
  const builder = settings.slow
    ? FadeInDown.duration(slowSpringTiming().duration ?? motionTokens.duration.slower)
    : FadeInDown.springify().stiffness(gentle.stiffness).damping(gentle.damping).mass(gentle.mass);
  return builder.withInitialValues({ opacity: 0, translateY: MINI_BAR_DROP }).reduceMotion(ReduceMotion.System);
}

/**
 * The recording time: the runtime's one rule (`useRecordingElapsedSeconds`, `runtime/recording-elapsed.ts`).
 *
 * E2E-P-3 (FX-M2b, D201): the bar used to sample `Date.now()` on its own 1 s interval and showed one second
 * less than Home's System Status timer for part of each second; it then read the store's clock. Post-review
 * fix FXR-M (W93-1, D243): the store's clock alone holds for 5-21 s under load in LIVE (RF-PH-1), which CF2-A
 * fixed for the monitor only. The bar now reads the monitor's own rule (the store's clock, or the Core clock's
 * ticker when it is ahead) and shares its ticker with the monitor, Home and the Sessions hub, so all of them
 * draw the same second in every commit.
 */
function useRecordingSeconds(): number {
  return useRecordingElapsedSeconds();
}

/**
 * Live mini-bar (C-5; 04_mobile_specs §3.8): shown while RECORDING on any tab route (the monitor
 * itself is a flow screen without chrome). REC dot (M-C-05), "Recording", the session id in mono,
 * the timer (C-6 RollingNumber, slide: digit columns positioned by React, W93-3) and a chevron, on a `Surface` with a danger-tinted hairline;
 * a tap opens `/session/live`. Motion M-MB-02: it drops in from y −24 on the `gentle` spring with
 * opacity and fades out in 160 ms; reduced motion: fades only, static red dot.
 */
export function LiveMiniBar({ session, placement }: LiveMiniBarProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const settings = useMotionSettings();
  const policy = useMotionPolicy();
  const seconds = useRecordingSeconds();
  const pulsing = useAmbientLoop('mini-bar-rec', { active: true });
  const dot = useSharedValue(1);

  useEffect(() => {
    dot.set(pulsing ? animateRecPulse(settings) : 1);
  }, [pulsing, settings, dot]);
  const dotStyle = useAnimatedStyle(() => ({ opacity: dot.get() }));

  return (
    <Animated.View
      entering={miniBarEntering(settings)}
      exiting={crossFadeOut(settings)}
      style={placement === 'top' ? [styles.top, { paddingTop: insets.top + 8 }] : styles.aboveBar}
    >
      <PressableFeedback
        testID="nav-mini-bar"
        accessibilityRole="button"
        accessibilityLabel={`${t('mobile.miniBar.recording')} ${session.sessionId ?? ''}`.trim()}
        accessibilityHint={t('mobile.miniBar.openMonitor')}
        onPress={() => router.push('/session/live')}
      >
        <Surface variant="secondary" style={styles.surface}>
          <View style={styles.row}>
            <Animated.View style={[styles.dot, dotStyle]} />
            <Text maxFontSizeMultiplier={1.2} style={styles.recording}>
              {t('mobile.miniBar.recording')}
            </Text>
            {session.sessionId ? (
              <Text numberOfLines={1} maxFontSizeMultiplier={1.2} style={styles.sessionId}>
                {session.sessionId}
              </Text>
            ) : (
              <View style={styles.flex} />
            )}
            <RollingNumber
              value={seconds}
              mode="slide"
              format={{ kind: 'duration' }}
              motion={policy}
              size="data"
              face="mono"
              color={palette.foreground}
              testID="nav-mini-bar-timer"
            />
            <ChevronRight size={18} color={palette.gray} />
          </View>
        </Surface>
      </PressableFeedback>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  aboveBar: { paddingHorizontal: 12, paddingBottom: 8 },
  top: { paddingHorizontal: 16, paddingBottom: 4 },
  surface: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: withAlpha(palette.danger, 0.45),
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 28 },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: palette.danger },
  recording: {
    fontFamily: fontFamily.native.semibold,
    fontSize: typography.body.size,
    lineHeight: typography.body.lineHeight,
    color: palette.foreground,
  },
  sessionId: {
    flex: 1,
    fontFamily: fontFamily.native.mono,
    fontSize: typography.data.size,
    lineHeight: typography.data.lineHeight,
    color: palette.gray,
  },
  flex: { flex: 1 },
});
