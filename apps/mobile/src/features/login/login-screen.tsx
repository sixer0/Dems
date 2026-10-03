/**
 * Login (04_mobile_specs §4.1, MB 1; §6 auth; §2.4 layouts; §7.2–§7.3 motion) at `/login`.
 *
 * Step 75 owns this file (P6). The route file `src/app/(auth)/login.tsx` renders `<LoginScreen />`
 * and is not edited; the root stays `SafeScreen id="login"` (testID `screen-login`, T-M02).
 *
 * Layouts (§2.4, D17), from the window size class:
 * - compact (phone portrait, the mockup): full-bleed backdrop, one centred scrolling stack;
 * - compact-landscape (phone landscape): brand 40 % | auth card 60 %, scrollable;
 * - medium (tablet portrait): a 360 dp brand band above the card;
 * - expanded (tablet landscape): split 7 | 5, a 340 dp ring on the brand side | the 440 dp card.
 *
 * Navigation after a sign-in is the guard's (step 70): `Stack.Protected` removes `/login` and the
 * boot router opens the §3.3 target (resync, pending link, Home). This screen never navigates on
 * success; it only plays the Login half of M-APP-01 while it is still mounted (DR-S75-1).
 */
import { useIsFocused } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fontFamily, palette, spacing, typography } from '@dems/shared/tokens';
import { useAuthSession } from '@/auth';
import { HeroBackdrop } from '@/components/media';
import { withAlpha } from '@/components/media/color';
import { SafeScreen, useLayoutClass } from '@/layout';
import { useAmbientLoop, useMotionSettings } from '@/motion';
import { GoldDust } from './login-ambient';
import { LoginBrand } from './login-brand';
import { LoginCard } from './login-card';
import { ringSizeFor, ringStateFor } from './login-model';
import { useLoginChoreography } from './use-login-choreography';
import { useLoginController } from './use-login-controller';

/** §2.4: the auth card is 440 dp wide on tablets (web parity, 01S §14.8). */
const CARD_MAX_WIDTH = 440;
/** §2.4 medium: the brand band above the card. */
const BRAND_BAND_HEIGHT = 360;
/** The phone stack's width cap (MB 1 fields span ≈ 368 of 411 dp). */
const PHONE_MAX_WIDTH = 400;

export function LoginScreen() {
  const { t } = useTranslation();
  const settings = useMotionSettings();
  const policy = settings.policy;
  const { layoutClass } = useLayoutClass();
  const insets = useSafeAreaInsets();
  const focused = useIsFocused();
  const { lastSignOut } = useAuthSession();

  // M-APP-02 after a sign-out; M-PG-LOGIN otherwise (chosen once, at mount).
  const choreography = useLoginChoreography(lastSignOut !== null ? 'return' : 'enter', settings);
  const controller = useLoginController({ onRejected: choreography.shake, onAccepted: choreography.leave });

  // Ambient loops (§7.3 Login, ≤ 4): ring rotation, bracket breathing, Ken Burns, gold dust. The
  // dust yields its slot to the Core-offline chip breath (login-card.tsx) while the Core is down.
  const coreOffline = controller.coreLink.state === 'OFFLINE';
  const ringLoops = useAmbientLoop('login-ring-rotation', { paused: !focused });
  useAmbientLoop('login-ring-breath', { paused: !focused });
  const kenBurns = useAmbientLoop('login-ken-burns', { paused: !focused });
  const dust = useAmbientLoop('login-gold-dust', { paused: !focused, active: !coreOffline });

  const ringState = ringStateFor({ coreLink: controller.coreLink, locked: controller.lockout.locked });
  const ringSize = ringSizeFor(layoutClass);

  const brand = (
    <LoginBrand
      layoutClass={layoutClass}
      ringSize={ringSize}
      ringState={ringState}
      policy={policy}
      loopsRunning={ringLoops}
      ringDelayMs={choreography.ringDelayMs}
      emblemReady={choreography.emblemReady}
      scanning={controller.pending}
      entrance={choreography.entrance}
      emblemStyle={choreography.emblemStyle}
      wordmarkStyle={choreography.wordmarkStyle}
      captionStyle={choreography.captionStyle}
      onEmblemOrigin={choreography.flyEmblemFrom}
    />
  );

  const card = (
    <LoginCard
      controller={controller}
      layoutClass={layoutClass}
      policy={policy}
      settings={settings}
      cardStyle={choreography.cardStyle}
      companionStyle={choreography.companionStyle}
      beamActive={choreography.beamActive}
      beamDelayMs={choreography.beamDelayMs}
      onBeamDone={choreography.endBeam}
      alertDelayMs={choreography.cardSettled ? 0 : choreography.alertDelayMs}
      focusReady={choreography.cardSettled}
      loopsAllowed={focused}
    />
  );

  const padding = {
    paddingTop: insets.top + spacing[4],
    paddingBottom: insets.bottom + spacing[4],
    paddingLeft: insets.left + spacing[3],
    paddingRight: insets.right + spacing[3],
  };

  let body: ReactNode;
  switch (layoutClass) {
    case 'expanded':
      body = (
        <View style={styles.row}>
          <View style={[styles.brandPane, { flex: 7, paddingTop: insets.top, paddingBottom: insets.bottom, paddingLeft: insets.left }]} testID="pane-brand">
            <View style={styles.centre}>{brand}</View>
            <Text style={styles.triplet}>{t('common.brand.triplet')}</Text>
          </View>
          <View style={{ flex: 5 }} testID="pane-auth">
            <LinearGradient
              pointerEvents="none"
              colors={[withAlpha(palette.black, 0), withAlpha(palette.black, 0.55), withAlpha(palette.black, 0.72)]}
              locations={[0, 0.3, 1]}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={StyleSheet.absoluteFill}
            />
            <KeyboardAwareScrollView
              bottomOffset={spacing[4]}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={[styles.scrollCentre, padding]}
            >
              <View style={styles.cardSlot}>{card}</View>
            </KeyboardAwareScrollView>
          </View>
        </View>
      );
      break;
    case 'compact-landscape':
      body = (
        <View style={styles.row}>
          <View style={[styles.brandPane, { flex: 4, paddingLeft: insets.left, paddingTop: insets.top, paddingBottom: insets.bottom }]} testID="pane-brand">
            <View style={styles.centre}>{brand}</View>
          </View>
          <View style={{ flex: 6 }} testID="pane-auth">
            <KeyboardAwareScrollView
              bottomOffset={spacing[4]}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={[styles.scrollCentre, padding, { paddingLeft: spacing[3] }]}
            >
              <View style={styles.cardSlot}>{card}</View>
            </KeyboardAwareScrollView>
          </View>
        </View>
      );
      break;
    case 'medium':
      body = (
        <KeyboardAwareScrollView bottomOffset={spacing[4]} keyboardShouldPersistTaps="handled" contentContainerStyle={[styles.scrollCentre, padding]}>
          <View style={[styles.band, { height: BRAND_BAND_HEIGHT }]} testID="pane-brand">
            {brand}
          </View>
          <View style={styles.cardSlot} testID="pane-auth">
            {card}
          </View>
        </KeyboardAwareScrollView>
      );
      break;
    default:
      body = (
        <KeyboardAwareScrollView bottomOffset={spacing[4]} keyboardShouldPersistTaps="handled" contentContainerStyle={[styles.scrollCentre, padding]}>
          <View style={[styles.phoneStack, { maxWidth: PHONE_MAX_WIDTH }]} testID="pane-auth">
            {brand}
            {card}
          </View>
        </KeyboardAwareScrollView>
      );
  }

  return (
    <SafeScreen id="login" edges={[]}>
      {/* L1: the licensed room still (W-05), graded; never the MB 1 officer photo (D28). */}
      <Animated.View style={[StyleSheet.absoluteFill, choreography.backdropStyle]} pointerEvents="none" testID="login-backdrop">
        <HeroBackdrop motion={policy} paused={!kenBurns} />
      </Animated.View>
      <GoldDust running={dust} reduced={policy === 'reduced'} settings={settings} />
      {body}
    </SafeScreen>
  );
}

const styles = StyleSheet.create({
  row: { flex: 1, flexDirection: 'row' },
  brandPane: { justifyContent: 'center', alignItems: 'center' },
  centre: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  band: { justifyContent: 'center', alignItems: 'center', alignSelf: 'stretch' },
  scrollCentre: { flexGrow: 1, justifyContent: 'center', alignItems: 'center' },
  cardSlot: { width: '100%', maxWidth: CARD_MAX_WIDTH },
  phoneStack: { width: '100%', alignItems: 'center', gap: spacing[4] },
  triplet: {
    fontFamily: fontFamily.native.medium,
    fontSize: typography.label.size,
    lineHeight: typography.label.lineHeight,
    letterSpacing: typography.label.letterSpacing * typography.label.size * 2,
    color: withAlpha(palette.gold, 0.7),
    textAlign: 'center',
    marginBottom: spacing[5],
  },
});
