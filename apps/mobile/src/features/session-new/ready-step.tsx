/**
 * Step 3: Ready (ARMED) (04_mobile_specs §4.4 step 3; derived from MB 6 key-values + the mini
 * GlowRing, AS #3) and the optional 3-2-1 countdown overlay (03M M-PG-NEW).
 *
 * - Summary `SectionCard` + `KeyValueList`: case, subject + chip, investigator, room, profile and
 *   the device verdict ("All devices ready", or the number of acknowledged warnings).
 * - C-1 GlowRing `mini` (120 dp): its sweep is the hero moment; it breathes while shown and stops
 *   off-focus (ambient loop 1 of 4).
 * - `Switch` "3-2-1 countdown" (default on). "Start Recording" is the screen's footer.
 */
import { Button, Label, Switch, Typography } from 'heroui-native';
import { ShieldCheck } from 'lucide-react-native';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import type { SessionCreateInput, SimOperator } from '@dems/shared/sim';
import { fontFamily, palette, spacing, statusText } from '@dems/shared/tokens';
import { GlowRing } from '@/components/composed/glow-ring';
import { KeyValueList, SectionCard, StatusChip, SubjectTypeChip, type KeyValueItem } from '@/components/kit';
import { withAlpha } from '@/components/media/color';
import { animateFade, animateTiming, enterRise, triggerHaptic, useMotionPolicy, useMotionSettings } from '@/motion';
import { useConfiguredProfile } from './configured-profile';
import { COUNTDOWN_DIGIT_MS } from './session-new-model';

export interface ReadyStepProps {
  input: SessionCreateInput | null;
  operators: readonly SimOperator[];
  /** WARN checks acknowledged before arming (0 = all passed). */
  warnings: number;
  countdown: boolean;
  onCountdownChange(value: boolean): void;
  paused: boolean;
  /** Ring beside the summary (tablets, phone landscape) instead of above it. */
  wide: boolean;
}

export function ReadyStep({ input, operators, warnings, countdown, onCountdownChange, paused, wide }: ReadyStepProps) {
  const { t } = useTranslation();
  const policy = useMotionPolicy();
  const settings = useMotionSettings();
  const investigator = operators.find((operator) => operator.id === input?.investigatorId);
  const configured = useConfiguredProfile();
  const verdict =
    warnings === 0
      ? t('sessionNew.ready.summary.allReady')
      : warnings === 1
        ? t('features.session-new.ready.warningAcknowledged')
        : t('features.session-new.ready.warningsAcknowledged', { count: warnings });

  const items: KeyValueItem[] = input
    ? [
        { id: 'case', label: t('sessionNew.ready.summary.caseNumber'), value: input.caseNumber, mono: true, testID: 'session-new-summary-case' },
        {
          id: 'subject',
          label: t('sessionNew.ready.summary.subject'),
          value: (
            <View style={styles.subject} testID="session-new-summary-subject">
              {/* Round two (JA2-09 / JT-12): the name is whole on the last screen before recording - two lines, the chip under it. */}
              <Typography type="body" numberOfLines={2} style={styles.subjectName}>
                {input.subjectName}
              </Typography>
              <SubjectTypeChip type={input.subjectType} size="sm" />
            </View>
          ),
        },
        {
          id: 'investigator',
          label: t('sessionNew.ready.summary.investigator'),
          value: investigator?.displayName ?? input.investigatorId,
          testID: 'session-new-summary-investigator',
        },
        { id: 'room', label: t('sessionNew.ready.summary.room'), value: input.room },
        // Fix wave Q (CT-08): the selector's lines on a Core in its own capture, never the `profileId` label.
        {
          id: 'profile',
          label: t('sessionNew.ready.summary.profile'),
          value: configured.ownCapture ? (configured.lines === '' ? t('common.platformNotReported.value') : configured.lines) : t('sessionNew.info.profile.standard'),
          testID: 'session-new-summary-profile',
        },
        {
          id: 'devices',
          label: t('sessionNew.ready.summary.devices'),
          value: <StatusChip size="sm" tone={warnings === 0 ? 'success' : 'warning'} label={verdict} icon={warnings === 0 ? 'CircleCheck' : 'TriangleAlert'} />,
          testID: 'session-new-summary-devices',
        },
      ]
    : [];

  const ring = (
    <View style={styles.ringBox} testID="session-new-ready-ring">
      <GlowRing mode="mini" size={120} state={warnings === 0 ? 'ready' : 'attention'} motion={policy} paused={paused} sweepDelayMs={200}>
        <ShieldCheck size={36} color={warnings === 0 ? statusText.success : statusText.warning} />
      </GlowRing>
      <Typography type="h5" align="center">
        {t('sessionNew.ready.title')}
      </Typography>
    </View>
  );

  return (
    <Animated.View entering={enterRise(0, settings)} style={wide ? styles.wide : styles.stack}>
      {wide ? null : ring}
      <SectionCard testID="session-new-ready" style={wide ? styles.summaryWide : undefined}>
        <KeyValueList items={items} />
        <View style={styles.switchRow}>
          <Switch
            testID="session-new-countdown"
            isSelected={countdown}
            onSelectedChange={(value) => {
              triggerHaptic('switchToggle');
              onCountdownChange(value);
            }}
            accessibilityLabel={t('sessionNew.ready.countdown')}
          />
          <View style={styles.switchText}>
            <Label onPress={() => onCountdownChange(!countdown)}>{t('sessionNew.ready.countdown')}</Label>
            <Typography type="body-xs" color="muted">
              {/* Round two (JT-22): the caption follows the switch - it promised a countdown with the switch off. */}
              {t(countdown ? 'features.session-new.ready.countdownHint' : 'features.session-new.ready.countdownOffHint')}
            </Typography>
          </View>
        </View>
      </SectionCard>
      {wide ? ring : null}
    </Animated.View>
  );
}

export interface CountdownOverlayProps {
  /** Seconds left (3, 2, 1). */
  seconds: number;
  onCancel(): void;
}

/**
 * The centred 3-2-1 (03M M-PG-NEW: each digit rack-focuses in and scales 1.1 → 1 over 600 ms,
 * 1 s apart). Reduced motion: the digits change without scaling.
 */
export function CountdownOverlay({ seconds, onCancel }: CountdownOverlayProps) {
  const { t } = useTranslation();
  const settings = useMotionSettings();
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);

  useEffect(() => {
    scale.set(1.1);
    opacity.set(0.4);
    scale.set(animateTiming(1, COUNTDOWN_DIGIT_MS, 'luxe', settings));
    opacity.set(animateFade(1, settings, COUNTDOWN_DIGIT_MS));
  }, [seconds, settings, scale, opacity]);

  const digitStyle = useAnimatedStyle(() => ({ opacity: opacity.get(), transform: [{ scale: scale.get() }] }));

  return (
    <View style={styles.overlay} testID="session-new-countdown-overlay" accessibilityViewIsModal accessibilityLiveRegion="assertive">
      <Animated.Text style={[styles.digit, digitStyle]} testID="session-new-countdown-digit" accessibilityLabel={t('sessionNew.ready.countdownValue', { seconds })}>
        {seconds}
      </Animated.Text>
      <Typography type="body" align="center">
        {t('sessionNew.ready.countdownValue', { seconds })}
      </Typography>
      <Button variant="outline" onPress={onCancel} testID="session-new-countdown-cancel">
        <Button.Label>{t('features.session-new.ready.cancelCountdown')}</Button.Label>
      </Button>
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: spacing[3] },
  wide: { flexDirection: 'row', gap: spacing[4], alignItems: 'flex-start' },
  summaryWide: { flex: 1 },
  ringBox: { alignItems: 'center', gap: spacing[1], paddingVertical: spacing[1], minWidth: 160 },
  subject: { alignItems: 'flex-end', gap: spacing[1], flexShrink: 1 },
  subjectName: { flexShrink: 1, textAlign: 'right' },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], minHeight: 48 },
  switchText: { flex: 1 },
  overlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: withAlpha(palette.black, 0.88),
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[3],
    zIndex: 10,
  },
  digit: { fontFamily: fontFamily.native.display, fontSize: 112, lineHeight: 128, color: palette.gold },
});
