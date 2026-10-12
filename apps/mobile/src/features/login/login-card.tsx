/**
 * The Login auth card and its companions (04_mobile_specs §4.1 L4–L11; MB 1 (66–286, 270–470)):
 * - L9 the one Alert (generic error + attempts left, lockout with the C-6 countdown, Core offline
 *   with a rate-limited Retry, biometric results, signed out / expired);
 * - L4 Username and L5 Password (`TextField` + `InputGroup`, `FieldError`; eye toggle, M-C-16);
 * - L6 Sign In (primary, dark label, `Spinner` while pending);
 * - L7 the fingerprint button (§6.3; hidden without hardware, disabled with a caption otherwise);
 * - L10 Demo operators (`Accordion` + `ListGroup`; a row fills the form; hidden in presentation
 *   mode, D28/Q14);
 * - L11 the Core trust line (Core link chip, pairing line, "Pair this device" / "Pairing details" → `/pair`);
 * - L8 the dataset version.
 *
 * The card carries the M-C-22 moments: one shake on a credential error (red borders only under
 * reduced motion), the lock shackle closing on a lockout, one gold glow pulse when the lockout ends,
 * and the one-lap border beam of M-PG-LOGIN.
 *
 * LIVE mode (backend task W59; 04_client_integration_spec §9.2, §3.5, §6.5; AC-C-72, AC-C-104):
 * the Core server is the Core, and every text below that is drawn only then says nothing about a
 * simulation. Each LIVE branch hangs on `controller.live`; the other modes render what they did.
 * - L9: the auth layer's notice (`<AuthNoticeAlert />`: `TOKEN_REUSE`, a dead biometric token, a
 *   disabled account, the 8-hour limit) takes the one Alert slot; the offline Alert names no
 *   address and offers "Use Simulated mode" beside Retry; a sign-in without an answer shows the
 *   refusal presenter's sentences in place;
 * - L10: the plain sentence of condition C1 first, no role chip (a role is the Core's data), no
 *   pairing-code hint (the simulator's code means nothing to the Core server);
 * - L11: "Core: DEMS-IR-01 • paired as DEV-0003", and the link reads "Pairing details".
 */
import { router } from 'expo-router';
import { Accordion, Alert, Button, Card, FieldError, InputGroup, LinkButton, ListGroup, Spinner, TextField } from 'heroui-native';
import { Eye, EyeOff, Fingerprint, KeyRound, Lock, User } from 'lucide-react-native';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Controller } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useShownVersion } from '@/lib/app-version';
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
  useSim,
  type SimState,
} from '@dems/shared/sim';
import { derived, fontFamily, motion, palette, radius, spacing, statusText, typography } from '@dems/shared/tokens';
import { AuthNoticeAlert } from '@/auth';
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
import { usePairing } from '@/runtime';
import { BorderBeam } from './login-ambient';
import { liveTrustLineFor, liveTrustTextFor } from './login-live-model';
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
  /**
   * Where L11 (the Core trust line) and L8 (the version) are drawn. `inline` (default): under the card,
   * as before. `detached`: not here; the screen draws `<LoginFooter />` itself, pinned under the scroll
   * area (phone portrait, fix wave J JA2-14).
   */
  footer?: 'inline' | 'detached';
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
  footer = 'inline',
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
    live,
    switchToSimulated,
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
                live={live}
                onUseSimulated={switchToSimulated}
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
              // Fix wave J (JA2-15): the button always carries its own name. Without one, Android builds
              // the content description from the state alone ("busy") and does not clear it when the
              // attempt ends, so the button stayed announced "busy" after a failed sign-in.
              accessibilityLabel={pending ? t('login.submitting') : t('login.submit')}
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
        <DemoOperators onFill={controller.fill} live={live} />
        {footer === 'inline' ? <LoginFooter controller={controller} settings={settings} loopsAllowed={loopsAllowed} /> : null}
      </Animated.View>
    </View>
  );
}

export interface LoginFooterProps {
  controller: LoginController;
  settings: MotionSettings;
  loopsAllowed: boolean;
  /** Phone portrait: the chip and the link share one row, so the pinned footer stays low. */
  compact?: boolean;
}

/**
 * L11 and L8: the Core trust line and the version (fix wave J, JA2-14). One component for both places:
 * under the card (tablets, phone landscape) and pinned under the scroll area on a phone in portrait,
 * where a notice or the keyboard used to push it under the gesture bar and off the screen. The version
 * line keeps its line height whatever the column does (`minHeight`, no shrink).
 */
export function LoginFooter({ controller, settings, loopsAllowed, compact = false }: LoginFooterProps) {
  const { t } = useTranslation();
  const shown = useShownVersion();
  return (
    <View style={compact ? styles.footerCompact : styles.footer}>
      <TrustLine controller={controller} settings={settings} loopsAllowed={loopsAllowed} compact={compact} />
      <Text style={[styles.version, compact ? styles.versionCompact : null]} numberOfLines={1} testID="login-version">
        {/* Round two (JW-26): in Live mode the app states its OWN build, named as the app's - never the model's "2.4.1". */}
        {shown.kind === 'APP' ? t('mobile.app.ownVersion', { version: shown.version }) : t('common.brand.version', { version: shown.version })}
      </Text>
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
  /** LIVE mode: the Core server is the Core. */
  live: boolean;
  /** LIVE, Core offline: "Use Simulated mode". */
  onUseSimulated: () => void;
}

function NoticeAlert({ notice, settings, delayMs, coreRetry, live, onUseSimulated }: NoticeAlertProps) {
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

  // LIVE: the auth layer's notice is its own Alert (its sentence and its status are the auth
  // layer's); this screen gives it the slot and the entrance of every other notice.
  if (notice.kind === 'auth-notice') {
    return (
      <Animated.View key={`auth-notice-${notice.notice}`} entering={entering} testID="login-alert-auth-notice">
        <AuthNoticeAlert />
      </Animated.View>
    );
  }

  let title: string;
  let body: ReactNode = null;
  switch (notice.kind) {
    case 'locked':
      title = t('login.errors.lockedTitle');
      body = <LockoutCountdown seconds={notice.retryInSeconds} policy={settings.policy} />;
      break;
    case 'core-offline': {
      const retry = (
        <Button
          testID="login-core-retry"
          variant="outline"
          size="sm"
          isDisabled={!coreRetry.canRetry}
          onPress={coreRetry.retry}
          style={live ? undefined : styles.retry}
        >
          <Button.Label>
            {coreRetry.exhausted
              ? t('features.login.retryExhausted')
              : coreRetry.cooldown > 0
                ? t('common.actions.retryIn', { seconds: coreRetry.cooldown })
                : t('common.actions.retry')}
          </Button.Label>
        </Button>
      );
      // LIVE (§3.5): the Core server, no address (the runtime's adapters alone name it), and the
      // explicit way out. LIVE exists in debug builds only (MD-3), so the second action needs no gate.
      title = live ? t('mobile.live.refusal.offline') : t('login.errors.coreOfflineTitle');
      body = live ? (
        <View style={styles.alertBody}>
          <Text style={styles.alertText}>{t('features.login.live.offlineBody')}</Text>
          <View style={styles.alertActions}>
            {retry}
            <Button testID="login-use-simulated" variant="ghost" size="sm" onPress={onUseSimulated}>
              <Button.Label>{t('common.coreMode.useSimulated')}</Button.Label>
            </Button>
          </View>
        </View>
      ) : (
        <View style={styles.alertBody}>
          <Text style={styles.alertText}>{t('login.errors.coreOfflineBody', { address: coreAddress() })}</Text>
          {retry}
        </View>
      );
      break;
    }
    case 'no-answer':
      // LIVE: the sign-in left and the Core server did not answer. The refusal presenter's own
      // two sentences (i18n keys), so the Alert and a toast of any other screen say the same.
      title = t(notice.title.key, notice.title.values ?? {});
      body = notice.body ? <Text style={styles.alertText}>{t(notice.body.key, notice.body.values ?? {})}</Text> : null;
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
      // Round two, ruling (c) (JT-18 / JA2-35; the web's JW-19): "Lock console" ends the sign-in as before, and
      // the Login says so in the web's own words - never the plain sign-out notice.
      title = notice.kind === 'signed-out' && notice.reason === 'LOCK' ? t('login.notices.consoleLocked') : t('login.notices.signedOut');
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

function DemoOperators({ onFill, live }: { onFill: LoginController['fill']; live: boolean }) {
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
          {live ? (
            // Condition C1 (SR-63): the disclosure says in plain words what it is, before anything else.
            <Text style={styles.demoHint} testID="login-demo-notice">
              {t('login.live.demoNotice')}
            </Text>
          ) : null}
          <Text style={styles.demoHint}>{t('login.demoOperators.hint')}</Text>
          <ListGroup>
            {operators.map((operator) => (
              <ListGroup.Item
                key={operator.id}
                testID={`login-demo-operator-${operator.username}`}
                onPress={() => onFill(operator.username, DEMO_OPERATOR_PASSWORD)}
                accessibilityRole="button"
                // Fix wave J (JA2-N6): the row is announced with the operator's role. LIVE draws no role
                // chip (condition C2: the Core may have changed the role), so its label says what the
                // role is: the one the demo account was created with.
                accessibilityLabel={t(live ? 'features.login.demo.rowLabelLive' : 'features.login.demo.rowLabel', {
                  name: operator.displayName,
                  username: operator.username,
                  role: t(`common.roles.${operator.role}`),
                })}
                accessibilityHint={t('features.login.demo.fillHint', { name: operator.displayName })}
              >
                <ListGroup.ItemContent>
                  <ListGroup.ItemTitle>{operator.displayName}</ListGroup.ItemTitle>
                  <ListGroup.ItemDescription style={styles.mono}>{operator.username}</ListGroup.ItemDescription>
                </ListGroup.ItemContent>
                {live ? null : (
                  // Condition C2: in LIVE mode a role is the Core's data and may have changed; no chip.
                  <ListGroup.ItemSuffix>
                    <StatusChip tone={ROLE_TONE[operator.role]} label={t(`common.roles.${operator.role}`)} icon={null} size="sm" />
                  </ListGroup.ItemSuffix>
                )}
              </ListGroup.Item>
            ))}
          </ListGroup>
          <Text style={[styles.demoHint, styles.mono]} testID="login-demo-password">
            {t('login.demoOperators.password', { password: DEMO_OPERATOR_PASSWORD })}
          </Text>
          {live ? null : (
            // The simulator's fixed code means nothing to the Core server (§9.2): not rendered in LIVE mode.
            <Text style={[styles.demoHint, styles.mono]}>{t('features.login.demo.pairingCode', { code: DEMO_PAIRING_CODE })}</Text>
          )}
        </Accordion.Content>
      </Accordion.Item>
    </Accordion>
  );
}

// ---------------------------------------------------------------------------------------------
// L11
// ---------------------------------------------------------------------------------------------

function TrustLine({ controller, settings, loopsAllowed, compact = false }: { controller: LoginController; settings: MotionSettings; loopsAllowed: boolean; compact?: boolean }) {
  const { t } = useTranslation();
  const pairingState = useSim(selectPairingState);
  const device = useSim(selectCoreDeviceId);
  const gate = usePairing();
  // LIVE: the runtime's look of the link (row M2 follow-up, D180): still connecting is not "offline".
  const chip = coreChipFor(controller.coreLink, controller.coreLook);
  // LIVE (§9.2, AC-C-72): the pairing gate says whether this tablet is paired, and as which device.
  const liveText = controller.live ? liveTrustTextFor(liveTrustLineFor(gate, device)) : null;
  const paired = controller.live ? gate.state === 'PAIRED' && gate.deviceId !== null : pairingState === 'PAIRED';

  // Core offline: the chip breathes slowly (`glowBreath`, M-C-22); an ambient loop (≤ 4 per screen).
  const breathing = useAmbientLoop('login-core-breath', { active: chip.kind === 'OFFLINE', paused: !loopsAllowed });
  const breath = useSharedValue(1);
  useEffect(() => {
    breath.set(breathing ? animateBreath(0.55, 1, 'glowBreath', settings, 1) : 1);
  }, [breathing, settings, breath]);
  const breathStyle = useAnimatedStyle(() => ({ opacity: breath.get() }));

  const chipView = (
    <Animated.View style={breathStyle}>
      <StatusChip
        testID="login-core-chip"
        tone={chip.tone}
        label={t(`features.login.coreChip.${chip.kind}`)}
        icon={chip.kind === 'ONLINE' || chip.kind === 'SETTLING' ? 'Wifi' : 'TriangleAlert'}
        size="sm"
      />
    </Animated.View>
  );
  const textView = (
    <Text style={[styles.trustText, !paired && styles.trustUnpaired]} testID="login-trust-text">
      {liveText
        ? t(liveText.textKey, liveText.values)
        : paired
          ? t('mobile.pairing.trustLinePaired', { device })
          : t('mobile.pairing.trustLineUnpaired', { device })}
    </Text>
  );
  // Fix wave J (JA2-13, N-05): the link is named for what it opens. A paired device opens its pairing
  // details; only an unpaired one is asked to pair ("Pair this device", the same on both layouts).
  const linkView = (
    <LinkButton size="sm" onPress={() => router.push('/pair')} testID="login-pair-link">
      <LinkButton.Label>{t(liveText ? liveText.linkKey : paired ? 'mobile.pairing.linkPaired' : 'mobile.pairing.link')}</LinkButton.Label>
    </LinkButton>
  );

  if (compact) {
    return (
      <View style={styles.trustCompact} testID="login-trust-line">
        <View style={styles.trustRow}>
          {chipView}
          {linkView}
        </View>
        {textView}
      </View>
    );
  }
  return (
    <View style={styles.trust} testID="login-trust-line">
      {chipView}
      {textView}
      {linkView}
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
  alertActions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing[1], marginTop: spacing[0] },
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
  trustCompact: { alignItems: 'center', gap: spacing[0] },
  trustRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap', columnGap: spacing[2] },
  footer: { gap: spacing[3], alignItems: 'stretch' },
  footerCompact: { gap: spacing[0], alignItems: 'stretch' },
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
    // JA2-14: the line was 3 px high on the phone. It keeps one full line whatever the column does.
    minHeight: typography.caption.lineHeight,
    flexShrink: 0,
  },
  versionCompact: { marginTop: 0 },
});
