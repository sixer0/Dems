/**
 * The code card of the Pairing screen (04_mobile_specs §4.2 Code entry, Actions, States):
 *
 * - UNPAIRED / FAILED / locked: `InputOTP` with 6 digits (VM-03; 3 + 3 slots), the one Alert
 *   (danger "Code not accepted" + attempts left; warning "Pairing locked" + the C-6 countdown on the
 *   simulator clock), Pair (primary) and Cancel (outline);
 * - PAIRING: the slots lock, Pair shows a Spinner and "Pairing…" while the connection steps run;
 * - PAIRED: a success Chip, the hand-off action (Continue to sign-in / Done) and Unpair
 *   (`danger-soft`, behind a Dialog the screen owns).
 *
 * The demo code is never shown here: only the Login "Demo operators" accordion shows it (§4.2).
 */
import { Alert, Button, InputOTP, REGEXP_ONLY_DIGITS, Spinner } from 'heroui-native';
import { CircleCheck } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, ReduceMotion } from 'react-native-reanimated';
import { PAIRING_CODE_LENGTH } from '@dems/shared/sim';
import { derived, fontFamily, motion, palette, spacing, statusText, typography } from '@dems/shared/tokens';
import { RollingNumber } from '@/components/composed/rolling-number';
import { SectionCard, StatusChip } from '@/components/kit';
import { EASING, REDUCED_FADE_MS, durationMs, type MotionSettings } from '@/motion';
import type { PairingFlow } from './use-pairing-flow';

const COUNTDOWN_TOKEN = '\u0000';

export interface PairingCodePanelProps {
  flow: PairingFlow;
  device: string;
  /** Signed in: the hand-off returns to the app; signed out: to sign-in. */
  signedIn: boolean;
  settings: MotionSettings;
  onRequestUnpair: () => void;
}

export function PairingCodePanel({ flow, device, signedIn, settings, onRequestUnpair }: PairingCodePanelProps) {
  if (flow.view === 'paired') {
    return <PairedPanel flow={flow} device={device} signedIn={signedIn} settings={settings} onRequestUnpair={onRequestUnpair} />;
  }
  return <CodeEntry flow={flow} settings={settings} />;
}

function CodeEntry({ flow, settings }: { flow: PairingFlow; settings: MotionSettings }) {
  const { t } = useTranslation();
  const pairing = flow.view === 'pairing';
  const locked = flow.view === 'locked';
  const slots = Array.from({ length: PAIRING_CODE_LENGTH }, (_, i) => i);
  const half = PAIRING_CODE_LENGTH / 2;

  return (
    <SectionCard testID="pairing-code-card" title={t('features.pairing.code.title')} description={t('features.pairing.code.description')}>
      <NoticeAlert flow={flow} settings={settings} />
      <View style={styles.otpRow} testID="pairing-code">
        <InputOTP
          maxLength={PAIRING_CODE_LENGTH}
          value={flow.code}
          onChange={flow.setCode}
          pattern={REGEXP_ONLY_DIGITS}
          inputMode="numeric"
          isDisabled={pairing || locked}
          isInvalid={flow.codeInvalid}
          textInputProps={{
            testID: 'pairing-code-input',
            accessibilityLabel: t('features.pairing.code.a11y'),
            autoComplete: 'one-time-code',
            // The keypad's submit key pairs too (the Pair button can sit under the keyboard on phones).
            returnKeyType: 'go',
            onSubmitEditing: flow.pair,
          }}
        >
          <InputOTP.Group>
            {slots.slice(0, half).map((index) => (
              <CodeSlot key={index} index={index} />
            ))}
          </InputOTP.Group>
          <InputOTP.Separator />
          <InputOTP.Group>
            {slots.slice(half).map((index) => (
              <CodeSlot key={index} index={index} />
            ))}
          </InputOTP.Group>
        </InputOTP>
      </View>
      <View style={styles.actions}>
        <Button
          testID="pairing-pair"
          variant="primary"
          size="lg"
          isDisabled={!flow.canPair}
          onPress={flow.pair}
          accessibilityState={{ busy: pairing, disabled: !flow.canPair }}
        >
          {pairing ? <Spinner size="sm" color={palette.black} /> : null}
          <Button.Label>{pairing ? t('features.pairing.code.pairing') : t('mobile.pairing.pair')}</Button.Label>
        </Button>
        <Button testID="pairing-cancel" variant="outline" size="lg" onPress={flow.cancel}>
          <Button.Label>{t('mobile.pairing.cancel')}</Button.Label>
        </Button>
      </View>
    </SectionCard>
  );
}

function CodeSlot({ index }: { index: number }) {
  return (
    <InputOTP.Slot index={index} testID={`pairing-code-slot-${index}`}>
      <InputOTP.SlotPlaceholder />
      <InputOTP.SlotValue style={styles.slotValue} />
      <InputOTP.SlotCaret />
    </InputOTP.Slot>
  );
}

/** FAILED (danger + attempts left), locked (warning + C-6 countdown) or a thrown error. */
function NoticeAlert({ flow, settings }: { flow: PairingFlow; settings: MotionSettings }) {
  const { t } = useTranslation();
  const entering =
    settings.policy === 'reduced'
      ? FadeIn.duration(REDUCED_FADE_MS).reduceMotion(ReduceMotion.Never)
      : FadeInDown.duration(durationMs('base', settings))
          .easing(EASING.luxe)
          .withInitialValues({ opacity: 0, translateY: motion.distance.riseSm })
          .reduceMotion(ReduceMotion.System);

  if (flow.view === 'locked') {
    const text = t('login.errors.lockedBody', { countdown: COUNTDOWN_TOKEN });
    const at = text.indexOf(COUNTDOWN_TOKEN);
    const before = at < 0 ? text : text.slice(0, at);
    const after = at < 0 ? '' : text.slice(at + COUNTDOWN_TOKEN.length);
    return (
      <Animated.View key="locked" entering={entering} testID="pairing-alert-locked">
        <Alert status="warning">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>{t('features.pairing.code.lockedTitle')}</Alert.Title>
            <View
              style={styles.countdownRow}
              accessible
              accessibilityLabel={t('features.pairing.code.lockedA11y', { seconds: flow.lockSeconds })}
              accessibilityLiveRegion="polite"
            >
              {before ? <Text style={styles.alertText}>{before}</Text> : null}
              <RollingNumber
                testID="pairing-lockout-countdown"
                value={flow.lockSeconds}
                format={{ kind: 'countdown' }}
                motion={settings.policy}
                size="body"
                face="mono"
                color={statusText.warning}
              />
              {after ? <Text style={styles.alertText}>{after}</Text> : null}
            </View>
          </Alert.Content>
        </Alert>
      </Animated.View>
    );
  }

  if (flow.view !== 'failed' || flow.outcome === null) return null;
  const error = flow.outcome.kind === 'error';
  return (
    <Animated.View key={error ? 'error' : 'invalid'} entering={entering} testID={error ? 'pairing-alert-error' : 'pairing-alert-invalid'}>
      <Alert status="danger">
        <Alert.Indicator />
        <Alert.Content>
          <Alert.Title>{error ? t('features.pairing.code.errorTitle') : t('features.pairing.code.invalidTitle')}</Alert.Title>
          <Text style={styles.alertText} testID="pairing-alert-body">
            {flow.outcome.kind === 'invalid'
              ? t('login.errors.attemptsRemaining', { count: flow.outcome.attemptsRemaining })
              : t('features.pairing.code.errorBody')}
          </Text>
        </Alert.Content>
      </Alert>
    </Animated.View>
  );
}

function PairedPanel({ flow, device, signedIn, settings, onRequestUnpair }: PairingCodePanelProps) {
  const { t } = useTranslation();
  const entering =
    settings.policy === 'reduced'
      ? FadeIn.duration(REDUCED_FADE_MS).reduceMotion(ReduceMotion.Never)
      : FadeInDown.duration(durationMs('base', settings)).easing(EASING.luxe).reduceMotion(ReduceMotion.System);
  return (
    <Animated.View entering={entering}>
      <SectionCard
        testID="pairing-paired-card"
        title={t('features.pairing.paired.title')}
        action={<StatusChip testID="pairing-paired-chip" tone="success" label={t('common.pairingState.PAIRED')} icon={CircleCheck} size="sm" />}
      >
        <Text maxFontSizeMultiplier={1.2} style={styles.body}>
          {t('features.pairing.paired.body', { device })}
        </Text>
        <View style={styles.actions}>
          <Button testID="pairing-continue" variant="primary" size="lg" onPress={flow.leave}>
            <Button.Label>{signedIn ? t('features.pairing.paired.done') : t('features.pairing.paired.continueToSignIn')}</Button.Label>
          </Button>
          {flow.handingOff ? (
            <Text testID="pairing-handoff" maxFontSizeMultiplier={1.2} style={styles.handoff}>
              {t('features.pairing.paired.handoff')}
            </Text>
          ) : null}
          <Button testID="pairing-unpair" variant="danger-soft" size="lg" onPress={onRequestUnpair}>
            <Button.Label>{t('mobile.pairing.unpair')}</Button.Label>
          </Button>
        </View>
      </SectionCard>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  otpRow: { alignItems: 'center', paddingVertical: spacing[1] },
  slotValue: { fontFamily: fontFamily.native.monoMedium },
  actions: { gap: spacing[2] },
  countdownRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
  alertText: {
    fontFamily: fontFamily.native.normal,
    fontSize: typography.body.size,
    lineHeight: typography.body.lineHeight,
    color: derived.foreground2,
  },
  body: {
    fontFamily: fontFamily.native.normal,
    fontSize: typography.body.size,
    lineHeight: typography.body.lineHeight,
    color: derived.foreground2,
  },
  handoff: {
    fontFamily: fontFamily.native.normal,
    fontSize: typography.caption.size,
    lineHeight: typography.caption.lineHeight,
    color: palette.gray,
    textAlign: 'center',
  },
});
