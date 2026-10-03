/**
 * The Login auth card and its companions (04_mobile_specs §4.1 L4–L11; MB 1 (66–286, 270–470)):
 * - L9 the one Alert (generic error + attempts left, lockout with the C-6 countdown, Core offline
 *   with a rate-limited Retry, biometric results, signed out / expired);
 * - L4 Username and L5 Password (`TextField` + `InputGroup`, `FieldError`; eye toggle, M-C-16);
 * - L6 Sign In (primary, dark label, `Spinner` while pending);
 * - L7 the fingerprint button (§6.3; hidden without hardware, disabled with a caption otherwise);
 * - L10 Demo operators (`Accordion` + `ListGroup`; a row fills the form; hidden in presentation
 *   mode, D28/Q14);
 * - L11 the Core trust line (Core link chip, pairing line, "Pair this tablet" → `/pair`);
 * - L8 the dataset version.
 *
 * The card carries the M-C-22 moments: one shake on a credential error (red borders only under
 * reduced motion), the lock shackle closing on a lockout, one gold glow pulse when the lockout ends,
 * and the one-lap border beam of M-PG-LOGIN.
 */
import { router } from 'expo-router';
import { Accordion, Alert, Button, Card, FieldError, InputGroup, LinkButton, ListGroup, Spinner, TextField } from 'heroui-native';
import { Eye, EyeOff, Fingerprint, KeyRound, Lock, User } from 'lucide-react-native';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Controller } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View, type TextInput, type ViewStyle } from 'react-native';
import Animated, {
  FadeIn,
  FadeInDown,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  type AnimatedStyle,
} from 'react-native-reanimated';
import {
  AUTH_IDLE_TIMEOUT_MS,
  DEMO_OPERATOR_PASSWORD,
  DEMO_PAIRING_CODE,
  OPERATORS,
  SOFTWARE_VERSION,
  useSim,
  type SimState,
} from '@dems/shared/sim';
import { derived, fontFamily, motion, palette, radius, spacing, statusText, typography } from '@dems/shared/tokens';
import { RollingNumber } from '@/components/composed/rolling-number';
import { StatusChip } from '@/components/kit';
import { withAlpha } from '@/components/media/color';
import type { LayoutClass } from '@/layout';
import {
  EASING,
  GlowLayer,
  REDUCED_FADE_MS,
  animateBreath,
  animateSpring,
  animateTiming,
  durationMs,
  useAmbientLoop,
  type MotionPolicy,
  type MotionSettings,
} from '@/motion';
import { BorderBeam } from './login-ambient';
import {
  alertStatusFor,
  biometricButtonFor,
  coreAddress,
  coreChipFor,
  splitAroundToken,
  type LoginNotice,
} from './login-model';
import { usePresentationMode } from './presentation-mode';
import type { LoginController } from './use-login-controller';

const CARD_RADIUS = radius.px.xl;
const ICON = 18;
/** The shackle starts open by this much when a lockout begins (M-C-22 "rotate 20° → 0"). */
const SHACKLE_OPEN_DEG = 20;

// F74-13 (D73): `useSim` selectors return primitives only (its equality is shallow, top level).
const selectPairingState = (s: SimState) => s.pairing.state;
const selectCoreDeviceId = (s: SimState) => s.pairing.coreDeviceId;

export interface LoginCardProps {
  controller: LoginController;
  layoutClass: LayoutClass;
  policy: MotionPolicy;
  settings: MotionSettings;
  cardStyle: AnimatedStyle<ViewStyle>;
  /** L10, L11 and L8 enter with the card. */
  companionStyle: AnimatedStyle<ViewStyle>;
  beamActive: boolean;
  beamDelayMs: number;
  onBeamDone: () => void;
  alertDelayMs: number;
  /** The card has settled: the Username field takes focus once (M-PG-LOGIN t = 1,200). */
  focusReady: boolean;
  /** Ambient loops may run (the Core-offline chip breath). */
  loopsAllowed: boolean;
}

export function LoginCard({
  controller,
  layoutClass,
  policy,
  settings,
  cardStyle,
  companionStyle,
  beamActive,
  beamDelayMs,
  onBeamDone,
  alertDelayMs,
  focusReady,
  loopsAllowed,
}: LoginCardProps) {
  // react-hook-form hands out mutable objects; keep this component out of React Compiler
  // memoisation (F-70-1: device-only bugs that jest cannot see).
  'use no memo';
  const { t } = useTranslation();
  const {
    form,
    submit,
    signInWithBiometric,
    onEdit,
    pending,
    notice,
    lockout,
    biometric,
    submitDisabled,
    credentialsFlagged,
    unlockPulse,
    coreRetry,
    overrides,
    rejectSeq,
  } = controller;
  const usernameRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);
  const [showPassword, setShowPassword] = useState(false);
  const reduced = policy === 'reduced';

  // M-PG-LOGIN: Username takes focus once the card settles (only if the operator has not started).
  // The focus is "quiet": the soft keyboard stays down (it would cover half of MB 1 on a phone)
  // until the operator taps the field; a hardware keyboard types straight away (DR-S75-6).
  const [focusDone, setFocusDone] = useState(false);
  const quietFocus = focusReady && !focusDone;
  useEffect(() => {
    if (!focusReady || focusDone) return;
    if (!form.getValues('username')) usernameRef.current?.focus();
    const timer = setTimeout(() => setFocusDone(true), 250);
    return () => clearTimeout(timer);
  }, [focusReady, focusDone, form]);

  // After a rejected attempt the (remounted, empty) password field takes focus again.
  const lastRejectSeq = useRef(rejectSeq);
  useEffect(() => {
    if (rejectSeq === lastRejectSeq.current) return;
    lastRejectSeq.current = rejectSeq;
    if (!lockout.locked) passwordRef.current?.focus();
  }, [rejectSeq, lockout.locked]);

  // M-C-22 lockout: the shackle closes (20° → 0, `snappy`).
  const shackle = useSharedValue(0);
  useEffect(() => {
    if (!lockout.locked) return;
    shackle.set(SHACKLE_OPEN_DEG);
    shackle.set(animateSpring(0, 'snappy', settings));
  }, [lockout.locked, settings, shackle]);
  const shackleStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${shackle.get()}deg` }] }));

  // M-C-16: the password eye rotates 90° while its icon swaps (160 ms).
  const eye = useSharedValue(0);
  useEffect(() => {
    eye.set(animateTiming(showPassword ? 1 : 0, 'fast', 'standard', settings));
  }, [showPassword, settings, eye]);
  const eyeStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${eye.get() * 90}deg` }] }));

  const view = biometricButtonFor({
    availability: biometric.availability,
    enabled: biometric.enabled,
    hasOperator: biometric.lastOperator !== null,
    blocked: submitDisabled,
  });
  const iconColor = palette.gray;
  const surfaceAlpha = layoutClass === 'compact' ? 0.55 : 0.8;

  return (
    <View style={styles.column} testID="login-auth">
      <Animated.View style={[styles.cardHost, cardStyle]}>
        <GlowLayer level={1} radius={CARD_RADIUS} pulseKey={unlockPulse} motion={policy} />
        <Card
          className="rounded-xl"
          style={{ backgroundColor: withAlpha(derived.surface, surfaceAlpha), borderColor: derived.border, borderWidth: StyleSheet.hairlineWidth }}
          testID="login-card"
        >
          <Card.Body className="gap-3">
            {notice ? (
              <NoticeAlert
                notice={notice}
                settings={settings}
                delayMs={alertDelayMs}
                coreRetry={coreRetry}
              />
            ) : null}

            <Controller
              control={form.control}
              name="username"
              render={({ field, fieldState }) => (
                <TextField isRequired isInvalid={Boolean(fieldState.error) || credentialsFlagged}>
                  <InputGroup>
                    <InputGroup.Prefix isDecorative>
                      <User size={ICON} color={iconColor} />
                    </InputGroup.Prefix>
                    <InputGroup.Input
                      ref={usernameRef}
                      testID="login-username"
                      showSoftInputOnFocus={!quietFocus}
                      value={overrides.username}
                      onChangeText={(value) => {
                        field.onChange(value);
                        onEdit('username');
                      }}
                      onBlur={field.onBlur}
                      placeholder={t('login.username.label')}
                      accessibilityLabel={t('login.username.label')}
                      autoComplete="username"
                      textContentType="username"
                      autoCapitalize="none"
                      autoCorrect={false}
                      returnKeyType="next"
                      submitBehavior="submit"
                      onSubmitEditing={() => passwordRef.current?.focus()}
                    />
                  </InputGroup>
                  {fieldState.error?.message ? (
                    <FieldError testID="login-username-error">{t(fieldState.error.message)}</FieldError>
                  ) : null}
                </TextField>
              )}
            />

            <Controller
              control={form.control}
              name="password"
              render={({ field, fieldState }) => (
                <TextField isRequired isInvalid={Boolean(fieldState.error) || credentialsFlagged}>
                  <InputGroup>
                    <InputGroup.Prefix isDecorative>
                      <Animated.View style={shackleStyle}>
                        <Lock size={ICON} color={lockout.locked ? statusText.warning : iconColor} />
                      </Animated.View>
                    </InputGroup.Prefix>
                    <InputGroup.Input
                      ref={passwordRef}
                      testID="login-password"
                      value={overrides.password}
                      onChangeText={(value) => {
                        field.onChange(value);
                        onEdit('password');
                      }}
                      onBlur={field.onBlur}
                      placeholder={t('login.password.label')}
                      accessibilityLabel={t('login.password.label')}
                      secureTextEntry={!showPassword}
                      autoComplete="current-password"
                      textContentType="password"
                      autoCapitalize="none"
                      autoCorrect={false}
                      returnKeyType="go"
                      onSubmitEditing={() => void submit()}
                    />
                    <InputGroup.Suffix>
                      <Button
                        isIconOnly
                        variant="ghost"
                        size="sm"
                        onPress={() => setShowPassword((shown) => !shown)}
                        accessibilityLabel={t(showPassword ? 'login.password.hide' : 'login.password.show')}
                        testID="login-password-toggle"
                      >
                        <Animated.View style={eyeStyle}>
                          {showPassword ? <EyeOff size={ICON} color={palette.foreground} /> : <Eye size={ICON} color={palette.foreground} />}
                        </Animated.View>
                      </Button>
                    </InputGroup.Suffix>
                  </InputGroup>
                  {fieldState.error?.message ? (
                    <FieldError testID="login-password-error">{t(fieldState.error.message)}</FieldError>
                  ) : null}
                </TextField>
              )}
            />

            <Button
              testID="login-submit"
              variant="primary"
              size="lg"
              isDisabled={submitDisabled}
              onPress={() => void submit()}
              accessibilityState={{ busy: pending, disabled: submitDisabled }}
            >
              {pending ? <Spinner size="sm" color={palette.black} /> : null}
              <Button.Label>{pending ? t('login.submitting') : t('login.submit')}</Button.Label>
            </Button>

            {view.kind !== 'hidden' ? (
              <View style={styles.biometric} testID="login-biometric-block">
                <Button
                  testID="login-biometric"
                  isIconOnly
                  variant="outline"
                  size="lg"
                  isDisabled={view.kind === 'disabled'}
                  onPress={() => void signInWithBiometric()}
                  accessibilityLabel={t('mobile.biometric.button')}
                  {...(biometric.lastOperator
                    ? { accessibilityHint: t('features.login.biometric.boundTo', { name: biometric.lastOperator.displayName }) }
                    : {})}
                >
                  <Fingerprint size={26} color={view.kind === 'enabled' ? palette.gold : palette.gray} />
                </Button>
                <Text style={styles.biometricCaption} testID="login-biometric-caption">
                  {view.kind === 'disabled' ? t(view.captionKey) : t('mobile.biometric.button')}
                </Text>
              </View>
            ) : null}
          </Card.Body>
        </Card>
        {beamActive && !reduced ? (
          <BorderBeam radius={CARD_RADIUS} settings={settings} delayMs={beamDelayMs} onDone={onBeamDone} />
        ) : null}
      </Animated.View>

      <Animated.View style={[styles.companions, companionStyle]}>
        <DemoOperators onFill={controller.fill} />
        <TrustLine controller={controller} settings={settings} loopsAllowed={loopsAllowed} />
        <Text style={styles.version} testID="login-version">
          {t('common.brand.version', { version: SOFTWARE_VERSION })}
        </Text>
      </Animated.View>
    </View>
  );
}

// ---------------------------------------------------------------------------------------------
// L9
// ---------------------------------------------------------------------------------------------

interface NoticeAlertProps {
  notice: LoginNotice;
  settings: MotionSettings;
  delayMs: number;
  coreRetry: LoginController['coreRetry'];
}

function NoticeAlert({ notice, settings, delayMs, coreRetry }: NoticeAlertProps) {
  const { t } = useTranslation();
  const status = alertStatusFor(notice);
  // An Alert present during the entrance waits for its beat (M-APP-02: the "signed out" Alert
  // "enters last"); the parent passes 0 once the card has settled, so later Alerts slide in at once.
  const entering = useMemo(() => {
    if (settings.policy === 'reduced') return FadeIn.duration(REDUCED_FADE_MS).reduceMotion(ReduceMotion.Never);
    // M-C-22 / M-C-07: the Alert slides in (240 ms, rising 6 dp).
    return FadeInDown.duration(durationMs('base', settings))
      .easing(EASING.luxe)
      .withInitialValues({ opacity: 0, translateY: motion.distance.riseSm })
      .delay(durationMs(delayMs, settings))
      .reduceMotion(ReduceMotion.System);
    // One builder per notice kind (the key changes with it); later delay changes must not replay it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notice.kind]);

  let title: string;
  let body: ReactNode = null;
  switch (notice.kind) {
    case 'locked':
      title = t('login.errors.lockedTitle');
      body = <LockoutCountdown seconds={notice.retryInSeconds} policy={settings.policy} />;
      break;
    case 'core-offline':
      title = t('login.errors.coreOfflineTitle');
      body = (
        <View style={styles.alertBody}>
          <Text style={styles.alertText}>{t('login.errors.coreOfflineBody', { address: coreAddress() })}</Text>
          <Button
            testID="login-core-retry"
            variant="outline"
            size="sm"
            isDisabled={!coreRetry.canRetry}
            onPress={coreRetry.retry}
            style={styles.retry}
          >
            <Button.Label>
              {coreRetry.exhausted
                ? t('features.login.retryExhausted')
                : coreRetry.cooldown > 0
                  ? t('common.actions.retryIn', { seconds: coreRetry.cooldown })
                  : t('common.actions.retry')}
            </Button.Label>
          </Button>
        </View>
      );
      break;
    case 'invalid':
      title = t('login.errors.invalid');
      body = <Text style={styles.alertText}>{t('login.errors.attemptsRemaining', { count: notice.attemptsRemaining })}</Text>;
      break;
    case 'biometric-failed':
      title = t('features.login.biometric.failedTitle');
      body = <Text style={styles.alertText}>{t('login.errors.attemptsRemaining', { count: notice.attemptsRemaining })}</Text>;
      break;
    case 'biometric-lockout':
      title = t('mobile.biometric.lockout');
      break;
    case 'biometric-error':
      title = t('features.login.biometric.error');
      break;
    case 'unavailable':
      title = t('features.login.unavailable.title');
      body = <Text style={styles.alertText}>{t('features.login.unavailable.body')}</Text>;
      break;
    case 'expired':
      title = t('login.notices.sessionExpired', { minutes: AUTH_IDLE_TIMEOUT_MS / 60_000 });
      break;
    default:
      title = t('login.notices.signedOut');
  }

  return (
    <Animated.View key={notice.kind} entering={entering} testID={`login-alert-${notice.kind}`}>
      <Alert status={status}>
        <Alert.Indicator />
        <Alert.Content>
          <Alert.Title>{title}</Alert.Title>
          {body}
        </Alert.Content>
      </Alert>
    </Animated.View>
  );
}

/** "Try again in 00:42." with the C-6 countdown in the middle (M-C-22 SlidingNumber → C-6 `slide`). */
function LockoutCountdown({ seconds, policy }: { seconds: number; policy: MotionPolicy }) {
  const { t } = useTranslation();
  const parts = splitAroundToken((token) => t('login.errors.lockedBody', { countdown: token }));
  const label = t('features.login.lockout.a11y', { seconds });
  return (
    <View style={styles.countdownRow} accessible accessibilityLabel={label} accessibilityLiveRegion="polite">
      {parts.before ? <Text style={styles.alertText}>{parts.before}</Text> : null}
      <RollingNumber
        testID="login-lockout-countdown"
        value={seconds}
        format={{ kind: 'countdown' }}
        motion={policy}
        size="body"
        face="mono"
        color={statusText.warning}
      />
      {parts.after ? <Text style={styles.alertText}>{parts.after}</Text> : null}
    </View>
  );
}

// ---------------------------------------------------------------------------------------------
// L10
// ---------------------------------------------------------------------------------------------

const ROLE_TONE = { INVESTIGATOR: 'accent', SUPERVISOR: 'info', TECHNICIAN: 'default' } as const;

function DemoOperators({ onFill }: { onFill: LoginController['fill'] }) {
  const { t } = useTranslation();
  const presentation = usePresentationMode();
  // The three demo operators are fixed dataset constants (§6.1), so no store subscription.
  const operators = OPERATORS;
  // Unknown (still reading) or presentation mode: the demo credentials are not rendered at all.
  if (presentation !== false) return null;
  return (
    <Accordion variant="surface" selectionMode="single" isCollapsible testID="login-demo-operators" style={styles.demo}>
      <Accordion.Item value="demo">
        <Accordion.Trigger testID="login-demo-trigger">
          <View style={styles.demoTrigger}>
            <KeyRound size={ICON} color={palette.gold} />
            <Text style={styles.demoTitle}>{t('login.demoOperators.title')}</Text>
          </View>
          <Accordion.Indicator />
        </Accordion.Trigger>
        <Accordion.Content>
          <Text style={styles.demoHint}>{t('login.demoOperators.hint')}</Text>
          <ListGroup>
            {operators.map((operator) => (
              <ListGroup.Item
                key={operator.id}
                testID={`login-demo-operator-${operator.username}`}
                onPress={() => onFill(operator.username, DEMO_OPERATOR_PASSWORD)}
                accessibilityRole="button"
                accessibilityHint={t('features.login.demo.fillHint', { name: operator.displayName })}
              >
                <ListGroup.ItemContent>
                  <ListGroup.ItemTitle>{operator.displayName}</ListGroup.ItemTitle>
                  <ListGroup.ItemDescription style={styles.mono}>{operator.username}</ListGroup.ItemDescription>
                </ListGroup.ItemContent>
                <ListGroup.ItemSuffix>
                  <StatusChip tone={ROLE_TONE[operator.role]} label={t(`common.roles.${operator.role}`)} icon={null} size="sm" />
                </ListGroup.ItemSuffix>
              </ListGroup.Item>
            ))}
          </ListGroup>
          <Text style={[styles.demoHint, styles.mono]} testID="login-demo-password">
            {t('login.demoOperators.password', { password: DEMO_OPERATOR_PASSWORD })}
          </Text>
          <Text style={[styles.demoHint, styles.mono]}>{t('features.login.demo.pairingCode', { code: DEMO_PAIRING_CODE })}</Text>
        </Accordion.Content>
      </Accordion.Item>
    </Accordion>
  );
}

// ---------------------------------------------------------------------------------------------
// L11
// ---------------------------------------------------------------------------------------------

function TrustLine({ controller, settings, loopsAllowed }: { controller: LoginController; settings: MotionSettings; loopsAllowed: boolean }) {
  const { t } = useTranslation();
  const pairingState = useSim(selectPairingState);
  const device = useSim(selectCoreDeviceId);
  const chip = coreChipFor(controller.coreLink);
  const paired = pairingState === 'PAIRED';

  // Core offline: the chip breathes slowly (`glowBreath`, M-C-22); an ambient loop (≤ 4 per screen).
  const breathing = useAmbientLoop('login-core-breath', { active: chip.kind === 'OFFLINE', paused: !loopsAllowed });
  const breath = useSharedValue(1);
  useEffect(() => {
    breath.set(breathing ? animateBreath(0.55, 1, 'glowBreath', settings, 1) : 1);
  }, [breathing, settings, breath]);
  const breathStyle = useAnimatedStyle(() => ({ opacity: breath.get() }));

  return (
    <View style={styles.trust} testID="login-trust-line">
      <Animated.View style={breathStyle}>
        <StatusChip
          testID="login-core-chip"
          tone={chip.tone}
          label={t(`features.login.coreChip.${chip.kind}`)}
          icon={chip.kind === 'ONLINE' ? 'Wifi' : 'TriangleAlert'}
          size="sm"
        />
      </Animated.View>
      <Text style={[styles.trustText, !paired && styles.trustUnpaired]} testID="login-trust-text">
        {paired ? t('mobile.pairing.trustLinePaired', { device }) : t('mobile.pairing.trustLineUnpaired', { device })}
      </Text>
      <LinkButton size="sm" onPress={() => router.push('/pair')} testID="login-pair-link">
        <LinkButton.Label>{t('mobile.pairing.link')}</LinkButton.Label>
      </LinkButton>
    </View>
  );
}

const styles = StyleSheet.create({
  column: { width: '100%', gap: spacing[3], alignItems: 'stretch' },
  cardHost: { borderRadius: CARD_RADIUS },
  companions: { gap: spacing[3], alignItems: 'stretch' },
  biometric: { alignItems: 'center', gap: spacing[1], marginTop: spacing[1] },
  biometricCaption: {
    fontFamily: fontFamily.native.normal,
    fontSize: typography.caption.size + 1,
    lineHeight: typography.caption.lineHeight + 2,
    color: derived.foreground2,
    textAlign: 'center',
  },
  alertBody: { gap: spacing[1] },
  alertText: {
    fontFamily: fontFamily.native.normal,
    fontSize: typography.body.size,
    lineHeight: typography.body.lineHeight,
    color: derived.foreground2,
  },
  retry: { alignSelf: 'flex-start', marginTop: spacing[0] },
  countdownRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
  demo: { borderRadius: CARD_RADIUS, backgroundColor: withAlpha(derived.surface, 0.7) },
  demoTrigger: { flexDirection: 'row', alignItems: 'center', gap: spacing[1], flex: 1 },
  demoTitle: {
    fontFamily: fontFamily.native.semibold,
    fontSize: typography.body.size,
    lineHeight: typography.body.lineHeight,
    color: palette.foreground,
  },
  demoHint: {
    fontFamily: fontFamily.native.normal,
    fontSize: typography.caption.size,
    lineHeight: typography.caption.lineHeight,
    color: palette.gray,
    marginVertical: spacing[0],
  },
  mono: { fontFamily: fontFamily.native.mono },
  trust: { alignItems: 'center', gap: spacing[1] },
  trustText: {
    fontFamily: fontFamily.native.normal,
    fontSize: typography.caption.size,
    lineHeight: typography.caption.lineHeight,
    color: derived.foreground2,
    textAlign: 'center',
  },
  trustUnpaired: { color: statusText.warning },
  version: {
    fontFamily: fontFamily.native.mono,
    fontSize: typography.caption.size,
    lineHeight: typography.caption.lineHeight,
    color: palette.gray,
    textAlign: 'center',
    marginTop: spacing[1],
  },
});
