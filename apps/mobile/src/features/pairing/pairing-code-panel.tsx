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
 *
 * **LIVE mode** (backend task W57; 04_client_integration_spec §9.4, §6.6, §3.5). The card, its
 * slots, its buttons and their test IDs stay. What is added, and only in LIVE mode:
 *
 * | State | The card |
 * |---|---|
 * | A notice of the pairing gate (`revoked`, `unknown`, `unpaired`) | An Alert above the card, until the next attempt |
 * | The Core server unreachable | Slots disabled; a danger Alert with a paced Retry (reconnect) |
 * | 401 `INVALID_CODE` | "Code not accepted" and the Core's count, worded as what it is: the attempts before the LOCK. Never why the code failed (SR-29) |
 * | 423 `LOCKED` | The existing countdown, to the Core's `lockedUntil`. The lock is global: the text blames nobody |
 * | 429 | A warning: a limit, not a wrong code; no count; the code stays; Retry after `retry-after` (decision D116) |
 * | No answer, a 5xx, a credential that could not be stored | "Pairing is not available right now." with a paced Retry |
 * | The request is out | Cancel is disabled: a request that left cannot be taken back |
 * | The gate holds | "Use Simulated mode" in place of Cancel (LIVE exists in debug builds only) |
 */
import { Alert, Button, InputOTP, REGEXP_ONLY_DIGITS, Spinner } from 'heroui-native';
import { CircleCheck } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, ReduceMotion } from 'react-native-reanimated';
import { useLiveSelector } from '@dems/shared/live';
import { PAIRING_CODE_LENGTH } from '@dems/shared/sim';
import { derived, fontFamily, motion, palette, spacing, statusText, typography } from '@dems/shared/tokens';
import { RollingNumber } from '@/components/composed/rolling-number';
import { SectionCard, StatusChip } from '@/components/kit';
import { EASING, REDUCED_FADE_MS, durationMs, type MotionSettings } from '@/motion';
import type { MobileLiveSim } from '@/runtime';
import { noticeStatusFor } from './pairing-live-model';
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
  if (!flow.live) return <CodeEntry flow={flow} settings={settings} />;
  return (
    <View style={styles.stack} testID="pairing-live-stack">
      <GateNotice flow={flow} settings={settings} />
      <CodeEntry flow={flow} settings={settings} />
    </View>
  );
}

/** The Alert's entrance (M-C-07: it slides in, rising 6 dp; a plain fade under reduced motion). */
function alertEntering(settings: MotionSettings) {
  return settings.policy === 'reduced'
    ? FadeIn.duration(REDUCED_FADE_MS).reduceMotion(ReduceMotion.Never)
    : FadeInDown.duration(durationMs('base', settings))
        .easing(EASING.luxe)
        .withInitialValues({ opacity: 0, translateY: motion.distance.riseSm })
        .reduceMotion(ReduceMotion.System);
}

function CodeEntry({ flow, settings }: { flow: PairingFlow; settings: MotionSettings }) {
  const { t } = useTranslation();
  const pairing = flow.view === 'pairing';
  const locked = flow.view === 'locked';
  // LIVE mode: nothing is sent while the Core server cannot be reached.
  const offline = flow.link === 'offline' && !pairing;
  const slots = Array.from({ length: PAIRING_CODE_LENGTH }, (_, i) => i);
  const half = PAIRING_CODE_LENGTH / 2;

  return (
    <SectionCard
      testID="pairing-code-card"
      title={t('features.pairing.code.title')}
      description={t(flow.live ? 'features.pairing.live.code.description' : 'features.pairing.code.description')}
    >
      <NoticeAlert flow={flow} settings={settings} />
      <View style={styles.otpRow} testID="pairing-code">
        <InputOTP
          maxLength={PAIRING_CODE_LENGTH}
          value={flow.code}
          onChange={flow.setCode}
          pattern={REGEXP_ONLY_DIGITS}
          inputMode="numeric"
          isDisabled={pairing || locked || offline}
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
        {flow.live && flow.blocked && !pairing ? (
          // The gate holds: there is no screen to cancel to. LIVE exists in debug builds only (MD-3).
          <Button testID="pairing-use-simulated" variant="outline" size="lg" onPress={flow.switchToSimulated}>
            <Button.Label>{t('features.pairing.live.code.useSimulated')}</Button.Label>
          </Button>
        ) : (
          <Button
            testID="pairing-cancel"
            variant="outline"
            size="lg"
            // LIVE mode: once the code left the tablet the answer decides.
            isDisabled={flow.sent}
            onPress={flow.cancel}
            {...(flow.sent ? { accessibilityState: { disabled: true } } : {})}
          >
            <Button.Label>{t('mobile.pairing.cancel')}</Button.Label>
          </Button>
        )}
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

/**
 * LIVE mode, above the code card: why this tablet is not paired any more (§9.4, §6.6). The pairing
 * gate of the runtime sets the notice; it shows until the next attempt of this visit.
 */
function GateNotice({ flow, settings }: { flow: PairingFlow; settings: MotionSettings }) {
  const { t } = useTranslation();
  // §6.6: "If the last known session state was RECORDING: The recording continues on the Core."
  const end = useLiveSelector((live: MobileLiveSim | null) => live?.lastSessionEnd ?? null);
  const notice = flow.notice;
  if (notice === null) return null;
  const recording = notice === 'revoked' && end !== null && end.kind === 'DEVICE_REVOKED' && end.sessionState === 'RECORDING';
  return (
    <Animated.View key={notice} entering={alertEntering(settings)} testID={`pairing-notice-${notice}`}>
      <Alert status={noticeStatusFor(notice)}>
        <Alert.Indicator />
        <Alert.Content>
          <Alert.Title>{t(`features.pairing.live.notice.${notice}Title`)}</Alert.Title>
          <Text style={styles.alertText} testID="pairing-notice-body" accessibilityLiveRegion="polite">
            {t(`features.pairing.live.notice.${notice}`)}
            {recording ? ` ${t('features.pairing.live.notice.revokedRecording')}` : ''}
          </Text>
        </Alert.Content>
      </Alert>
    </Animated.View>
  );
}

/**
 * The one Alert inside the card: Core unreachable (LIVE), locked (warning + C-6 countdown), FAILED
 * (danger + attempts left), no judgement of the code (LIVE: a limit, or "not available"), or a
 * thrown error.
 */
function NoticeAlert({ flow, settings }: { flow: PairingFlow; settings: MotionSettings }) {
  const { t } = useTranslation();
  const entering = alertEntering(settings);

  if (flow.link === 'offline' && flow.view !== 'pairing') {
    const { coreRetry } = flow;
    return (
      <Animated.View key="offline" entering={entering} testID="pairing-alert-offline">
        <Alert status="danger">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>{t('features.pairing.live.code.offlineTitle')}</Alert.Title>
            <Text style={styles.alertText} testID="pairing-alert-body">
              {t('features.pairing.live.code.offlineBody')}
            </Text>
            <Button testID="pairing-core-retry" variant="outline" size="sm" isDisabled={!coreRetry.canRetry} onPress={coreRetry.retry} style={styles.retry}>
              <Button.Label>
                {coreRetry.exhausted
                  ? t('features.pairing.live.code.retryLimit')
                  : coreRetry.cooldown > 0
                    ? t('common.actions.retryIn', { seconds: coreRetry.cooldown })
                    : t('common.actions.retry')}
              </Button.Label>
            </Button>
          </Alert.Content>
        </Alert>
      </Animated.View>
    );
  }

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

  const outcome = flow.outcome;
  if (flow.view !== 'failed' || outcome === null) return null;

  if (outcome.kind === 'limited' || outcome.kind === 'unavailable') {
    const limited = outcome.kind === 'limited';
    return (
      <Animated.View key={limited ? 'limited' : 'unavailable'} entering={entering} testID={limited ? 'pairing-alert-limited' : 'pairing-alert-unavailable'}>
        <Alert status={limited ? 'warning' : 'danger'}>
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>{t('features.pairing.live.code.unavailableTitle')}</Alert.Title>
            <Text style={styles.alertText} testID="pairing-alert-body">
              {limited ? t('features.pairing.live.code.limited') : t(`features.pairing.live.code.unavailable.${outcome.reason}`)}
            </Text>
            {flow.retryOffered ? (
              <Button testID="pairing-retry" variant="outline" size="sm" isDisabled={!flow.canPair} onPress={flow.pair} style={styles.retry}>
                <Button.Label>
                  {flow.retrySeconds > 0 ? t('common.actions.retryIn', { seconds: flow.retrySeconds }) : t('common.actions.retry')}
                </Button.Label>
              </Button>
            ) : (
              <>
                {outcome.exhausted ? (
                  <Text style={styles.alertText} testID="pairing-retry-exhausted">
                    {t('features.pairing.live.code.retryExhausted')}
                  </Text>
                ) : null}
                {flow.retrySeconds > 0 ? (
                  <Text style={styles.alertText} testID="pairing-wait" accessibilityLiveRegion="polite">
                    {t('features.pairing.live.code.wait', { count: flow.retrySeconds })}
                  </Text>
                ) : null}
              </>
            )}
          </Alert.Content>
        </Alert>
      </Animated.View>
    );
  }

  const error = outcome.kind === 'error';
  return (
    <Animated.View key={error ? 'error' : 'invalid'} entering={entering} testID={error ? 'pairing-alert-error' : 'pairing-alert-invalid'}>
      <Alert status="danger">
        <Alert.Indicator />
        <Alert.Content>
          <Alert.Title>{error ? t('features.pairing.code.errorTitle') : t('features.pairing.code.invalidTitle')}</Alert.Title>
          <Text style={styles.alertText} testID="pairing-alert-body">
            {outcome.kind === 'invalid' ? invalidBody(t, flow.live, outcome.attemptsRemaining) : t('features.pairing.code.errorBody')}
          </Text>
        </Alert.Content>
      </Alert>
    </Animated.View>
  );
}

/**
 * What stands under "Code not accepted". Simulated: the simulator's count, as before. LIVE: the
 * Core's `attemptsRemaining` is the count before the LOCK (three wrong codes lock redeeming for a
 * short time; a code closes after five), so it is worded as that. Neither says why the code failed.
 */
function invalidBody(t: ReturnType<typeof useTranslation>['t'], live: boolean, attemptsRemaining: number): string {
  if (!live) return t('login.errors.attemptsRemaining', { count: attemptsRemaining });
  return attemptsRemaining > 0 ? t('features.pairing.live.code.attemptsBeforeLock', { count: attemptsRemaining }) : t('features.pairing.live.code.invalidBody');
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
        <Text maxFontSizeMultiplier={1.2} style={styles.body} testID="pairing-paired-body">
          {flow.live ? t('features.pairing.live.paired.body', { device, tablet: flow.tabletId ?? '' }) : t('features.pairing.paired.body', { device })}
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
  stack: { gap: spacing[2] },
  otpRow: { alignItems: 'center', paddingVertical: spacing[1] },
  slotValue: { fontFamily: fontFamily.native.monoMedium },
  actions: { gap: spacing[2] },
  countdownRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
  retry: { alignSelf: 'flex-start', marginTop: spacing[0] },
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
