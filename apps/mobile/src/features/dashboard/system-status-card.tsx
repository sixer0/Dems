/**
 * H2 System Status (04_mobile_specs §4.3; MB 2 (352–592, 88–160)) and its tablet hero variant.
 *
 * - Phone: `SectionCard` "System Status" with a C-1 GlowRing `mini` (72 dp) around the state shield,
 *   the state title in the tone's 400 step (READY: success-400) and its subtitle.
 * - Tablet (`hero`): the GlowRing `hero` (280 dp; 240 when the pane is narrow) with "SYSTEM /
 *   READY / SECURE • HEALTHY • OPERATIONAL" in its centre (web Dashboard A parity) above the same
 *   title block.
 *
 * States follow `selectSystemState`: READY; ATTENTION and CRITICAL list their flags; RECORDING shows
 * "Session in progress", the REC chip and the timer, and the card opens the live monitor. The ring
 * sweep lands last (§7.3 beat 900, the hero moment); escalation blooms once (GlowRing, 03M R8).
 */
import { useIsFocused, useRouter } from 'expo-router';
import { PressableFeedback } from 'heroui-native';
import { Circle, Shield, ShieldAlert, ShieldCheck, ShieldX, type LucideIcon } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { fontFamily, palette, toneHex, toneTextHex, typography } from '@dems/shared/tokens';
import { GlowRing } from '@/components/composed/glow-ring';
import { RollingNumber } from '@/components/composed/rolling-number';
import { SectionCard, StatusChip } from '@/components/kit';
import { failedStartWords } from '@/features/capture-selector/capture-notices-model';
import { useFailedStart } from '@/features/session-live/capture-start-notice';
import { useConnectingCameras } from '@/features/session-live/rec-indicator';
import { crossFadeIn, layoutTransition, useAmbientLoop, useMotionPolicy, useMotionSettings } from '@/motion';
import { durationText, type FlagLine, type HomeStatus } from './home-model';
import { HOME_BEATS, HOME_LOOPS, beatDelay, homeEnter } from './home-motion';
import { useElapsedSeconds, useHomeSession } from './use-home-data';

/** Share of the hero ring's width the centre text may use (inside the inner ring). */
const HERO_TEXT_SHARE = 0.58;

/** Flag lines shown before "+N more". */
const MAX_FLAGS = 3;

const SHIELD: Record<HomeStatus['kind'], LucideIcon> = {
  READY: ShieldCheck,
  ATTENTION: ShieldAlert,
  CRITICAL: ShieldX,
  RECORDING: Circle,
  UNKNOWN: Shield,
};

export interface SystemStatusCardProps {
  status: HomeStatus;
  variant: 'card' | 'hero';
  /** Hero ring size in dp (clamped by GlowRing to 240–340). */
  heroSize?: number;
}

/**
 * Integration pass D7 item 3 (ux §8e.2; D84, D91 R-1 option A): RECORDING before the first durable
 * fragment (`captureDurable: false`) is "Connecting cameras…" — no REC chip, no timer, no red ring,
 * nothing that says a recording exists. A session without the member reads as recording, as before.
 */
function useConnectingStatus(status: HomeStatus): boolean {
  const connecting = useConnectingCameras();
  return connecting && status.kind === 'RECORDING';
}

export function SystemStatusCard({ status, variant, heroSize = 280 }: SystemStatusCardProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const settings = useMotionSettings();
  const recording = status.kind === 'RECORDING';

  const body =
    variant === 'hero' ? (
      <View style={styles.hero}>
        <StatusRing status={status} mode="hero" size={heroSize} />
        <StatusText status={status} align="center" />
      </View>
    ) : (
      <View style={styles.row}>
        <StatusRing status={status} mode="mini" size={72} />
        <StatusText status={status} align="left" />
      </View>
    );

  return (
    <Animated.View testID="home-status" entering={homeEnter(HOME_BEATS.status, settings)} layout={layoutTransition(settings)}>
      {recording ? (
        <PressableFeedback
          testID="home-status-open-live"
          accessibilityRole="button"
          accessibilityLabel={t('features.dashboard.status.RECORDING.title')}
          accessibilityHint={t('features.dashboard.status.openLive')}
          onPress={() => router.push('/session/live')}
        >
          <SectionCard title={t('features.dashboard.status.title')}>{body}</SectionCard>
        </PressableFeedback>
      ) : (
        <SectionCard title={t('features.dashboard.status.title')}>{body}</SectionCard>
      )}
    </Animated.View>
  );
}

/** The GlowRing with the state shield (mini) or the SYSTEM / state readout (hero) in its centre. */
function StatusRing({ status, mode, size }: { status: HomeStatus; mode: 'mini' | 'hero'; size: number }) {
  const { t } = useTranslation();
  const policy = useMotionPolicy();
  const settings = useMotionSettings();
  const focused = useIsFocused();
  const connecting = useConnectingStatus(status);
  const breathing = useAmbientLoop(HOME_LOOPS.ringBreath, { paused: !focused });
  useAmbientLoop(HOME_LOOPS.ringRotate, { active: mode === 'hero', paused: !focused });
  useAmbientLoop(HOME_LOOPS.ringRec, { active: status.ring === 'recording' && !connecting, paused: !focused });
  const Icon = connecting ? SHIELD.UNKNOWN : SHIELD[status.kind];
  const tone = connecting ? palette.gray : toneHex[status.tone];
  // The neutral ring while the cameras connect: not the red recording ring, not a fault colour.
  const ringState = connecting ? 'offline' : status.ring;
  const stateWord = connecting ? t('common.session.trackConnecting') : t(`common.systemState.${status.kind}`);

  return (
    <GlowRing
      testID="home-status-ring"
      mode={mode}
      size={size}
      state={ringState}
      motion={policy}
      paused={!breathing}
      sweepDelayMs={beatDelay(HOME_BEATS.ringSweep, settings)}
      accessibilityLabel={t('features.dashboard.status.ringLabel', { state: stateWord })}
    >
      {mode === 'mini' ? (
        status.kind === 'RECORDING' && !connecting ? (
          <Icon size={22} color={tone} fill={tone} />
        ) : (
          <Icon size={34} color={palette.black} fill={status.kind === 'READY' ? palette.gold : tone} strokeWidth={1.75} />
        )
      ) : (
        <View style={[styles.heroCentre, { maxWidth: size * HERO_TEXT_SHARE }]}>
          <Text maxFontSizeMultiplier={1.2} style={styles.overline}>
            {t('dashboard.systemRing.overline')}
          </Text>
          <Text
            testID="home-status-ring-state"
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.5}
            maxFontSizeMultiplier={1.2}
            style={[styles.stateWord, { color: connecting ? palette.gray : status.kind === 'READY' ? palette.gold : toneTextHex[status.tone] }]}
          >
            {stateWord}
          </Text>
          {status.kind === 'READY' ? (
            <Text numberOfLines={2} maxFontSizeMultiplier={1.2} style={styles.ringFlags}>
              {t('dashboard.systemRing.flags')}
            </Text>
          ) : null}
        </View>
      )}
    </GlowRing>
  );
}

/** Title, subtitle, flags or the REC chip and timer. Cross-fades when the state changes (M-C-10). */
function StatusText({ status, align }: { status: HomeStatus; align: 'left' | 'center' }) {
  const { t } = useTranslation();
  const settings = useMotionSettings();
  const session = useHomeSession();
  const connecting = useConnectingStatus(status);
  // Pass D7 item 3 (ux §8e.2 situation C): a session that recorded nothing says so, in full.
  const failedStart = useFailedStart();
  const failedWords = failedStart === null ? null : failedStartWords(t, failedStart);
  const colour = status.kind === 'RECORDING' || status.kind === 'UNKNOWN' ? palette.foreground : toneTextHex[status.tone];
  const centred = align === 'center';
  const extra = status.flags.length - MAX_FLAGS;

  const subtitle =
    failedWords !== null
      ? `${failedWords.title}. ${failedWords.body}`
      : status.kind === 'ATTENTION'
        ? t('features.dashboard.status.ATTENTION.subtitle', { count: status.flags.length })
        : status.kind === 'RECORDING'
          ? connecting
            ? (session.sessionId ?? '')
            : t('features.dashboard.status.RECORDING.subtitle', { sessionId: session.sessionId ?? '' })
          : t(`${status.copyKey}.subtitle`);

  return (
    <Animated.View key={status.kind} entering={crossFadeIn(settings)} style={[styles.text, centred ? styles.textCentre : null]}>
      <Text
        testID="home-status-title"
        maxFontSizeMultiplier={1.2}
        style={[styles.title, { color: colour }, centred ? styles.centre : null]}
      >
        {connecting ? t('common.session.connectingCameras') : t(`${status.copyKey}.title`)}
      </Text>
      <Text
        testID="home-status-subtitle"
        maxFontSizeMultiplier={1.2}
        style={[styles.subtitle, { color: status.kind === 'READY' ? toneTextHex.success : palette.gray }, centred ? styles.centre : null]}
      >
        {subtitle}
      </Text>
      {status.kind === 'RECORDING' && !connecting ? <RecRow centred={centred} /> : null}
      {status.kind === 'ATTENTION' || status.kind === 'CRITICAL' ? (
        <View testID="home-status-flags" style={[styles.flags, centred ? styles.textCentre : null]}>
          {status.flags.slice(0, MAX_FLAGS).map((flag) => (
            <FlagText key={flag.id} flag={flag} />
          ))}
          {extra > 0 ? <Text style={styles.flag}>{t('features.dashboard.status.moreFlags', { count: extra })}</Text> : null}
        </View>
      ) : null}
    </Animated.View>
  );
}

function FlagText({ flag }: { flag: FlagLine }) {
  const { t } = useTranslation();
  const text = flag.key
    ? t(flag.key, { ...flag.params, ...(flag.nameKey ? { name: t(flag.nameKey) } : {}) })
    : (flag.params.message ?? '');
  return (
    <Text testID={`home-flag-${flag.id}`} maxFontSizeMultiplier={1.2} style={[styles.flag, { color: flag.severity === 'CRITICAL' ? toneTextHex.danger : toneTextHex.warning }]}>
      {`• ${text}`}
    </Text>
  );
}

/** REC chip + recording timer (1 Hz from the simulator clock; C-6 `slide`). */
function RecRow({ centred }: { centred: boolean }) {
  const { t } = useTranslation();
  const policy = useMotionPolicy();
  const seconds = useElapsedSeconds();
  return (
    <View style={[styles.recRow, centred ? styles.textCentre : null]}>
      <StatusChip testID="home-status-rec" tone="danger" label={t('features.dashboard.status.rec')} icon={Circle} iconFilled size="sm" />
      <View accessible accessibilityLabel={t('features.dashboard.status.timerLabel', { time: durationText(seconds) })}>
        <RollingNumber
          testID="home-status-timer"
          value={seconds}
          mode="slide"
          format={{ kind: 'duration' }}
          motion={policy}
          size="h3"
          face="mono"
          color={palette.foreground}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  hero: { alignItems: 'center', gap: 12, paddingVertical: 4 },
  heroCentre: { alignItems: 'center', gap: 2 },
  overline: {
    fontFamily: fontFamily.native.semibold,
    fontSize: typography.label.size,
    lineHeight: typography.label.lineHeight,
    letterSpacing: 2,
    color: palette.foreground,
  },
  stateWord: {
    textAlign: 'center',
    fontFamily: fontFamily.native.display,
    fontSize: typography.display.size,
    lineHeight: typography.display.lineHeight,
    letterSpacing: 1,
  },
  ringFlags: {
    fontFamily: fontFamily.native.medium,
    fontSize: 9,
    lineHeight: 12,
    letterSpacing: 1,
    color: palette.gray,
    textAlign: 'center',
  },
  text: { flex: 1, gap: 2 },
  textCentre: { alignItems: 'center', alignSelf: 'stretch' },
  centre: { textAlign: 'center' },
  title: {
    fontFamily: fontFamily.native.semibold,
    fontSize: typography.h2.size,
    lineHeight: typography.h2.lineHeight,
  },
  subtitle: {
    fontFamily: fontFamily.native.normal,
    fontSize: typography.body.size,
    lineHeight: typography.body.lineHeight,
  },
  flags: { marginTop: 4, gap: 2 },
  flag: {
    fontFamily: fontFamily.native.normal,
    fontSize: typography.caption.size,
    lineHeight: typography.caption.lineHeight,
    color: palette.gray,
  },
  recRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 6 },
});
