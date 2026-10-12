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
import { crossFadeIn, layoutTransition, useAmbientLoop, useMotionPolicy, useMotionSettings } from '@/motion';
import { durationText, homeChipKey, type FlagLine, type HomeStatus } from './home-model';
import { HOME_BEATS, HOME_LOOPS, beatDelay, homeEnter } from './home-motion';
import { useElapsedSeconds, useHomeSession } from './use-home-data';
import { openNoticeCloseKey, openNoticeDetail, useCanCloseNotice, useOpenNotices } from '@/features/session-finalizing/open-notice';
import { SEAL_RECORDING_KEPT_SENTENCE } from '@dems/shared/sim';

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
 * Fix wave J (JA2-04 / JT-01, truth rule 3c): this card decides NOTHING about the system's state. Ring,
 * tone, title and subtitle follow `status.presentation` - `homeStatusOf` of the Core's facts
 * (`home-model.ts`), the same value the header chip, the tiles and the primary action read:
 *
 * - `OFFLINE`: "Core offline - state unknown" on the neutral ring (the link is down: nothing is known).
 * - `CAMERAS_CONNECTING` (pass D7 item 3, ux §8e.2): RECORDING before the first durable fragment - no REC chip,
 *   no timer, no red ring.
 * - `SEAL_RETRYING` / `SEAL_BLOCKED` (fix wave I G75b-02; JT-01 (a)): the seal of the open session, from
 *   its FIRST failed step.
 * - `NOTICE` (fix wave L, G75d-01): READY with an open unsealable notice is amber "Open notice".
 */
export function SystemStatusCard({ status, variant, heroSize = 280 }: SystemStatusCardProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const settings = useMotionSettings();
  // The way to the monitor is offered while a session records and the link is up (the monitor words a lost link itself).
  const recording = status.presentation === 'RECORDING' || status.presentation === 'CAMERAS_CONNECTING';

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
  const presentation = status.presentation;
  const connecting = presentation === 'CAMERAS_CONNECTING';
  const offline = presentation === 'OFFLINE';
  const noticed = presentation === 'NOTICE';
  const breathing = useAmbientLoop(HOME_LOOPS.ringBreath, { paused: !focused || offline });
  useAmbientLoop(HOME_LOOPS.ringRotate, { active: mode === 'hero' && !offline, paused: !focused });
  useAmbientLoop(HOME_LOOPS.ringRec, { active: presentation === 'RECORDING', paused: !focused });
  const plainReady = presentation === 'READY';
  const Icon = connecting || offline ? SHIELD.UNKNOWN : status.tone === 'warning' ? SHIELD.ATTENTION : presentation === 'RECORDING' ? SHIELD.RECORDING : status.tone === 'danger' ? SHIELD.CRITICAL : SHIELD[status.kind];
  const tone = connecting || offline ? palette.gray : toneHex[status.tone];
  // The ring is the presentation's: neutral while the cameras connect or the link is down, amber for a notice or a retried seal.
  const ringState = status.ring;
  const stateWord = t(homeChipKey(status));
  const spokenState = noticed ? t('features.session-finalizing.openNotice.ringState') : stateWord;

  return (
    <GlowRing
      testID="home-status-ring"
      mode={mode}
      size={size}
      state={ringState}
      motion={policy}
      paused={!breathing}
      sweepDelayMs={beatDelay(HOME_BEATS.ringSweep, settings)}
      accessibilityLabel={t('features.dashboard.status.ringLabel', { state: spokenState })}
    >
      {mode === 'mini' ? (
        presentation === 'RECORDING' ? (
          <Icon size={22} color={tone} fill={tone} />
        ) : (
          <Icon size={34} color={palette.black} fill={plainReady ? palette.gold : tone} strokeWidth={1.75} />
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
            style={[styles.stateWord, { color: connecting || offline ? palette.gray : plainReady ? palette.gold : toneTextHex[status.tone] }]}
          >
            {noticed ? t(`common.systemState.${status.kind}`) : stateWord}
          </Text>
          {/* "SECURE - HEALTHY - OPERATIONAL" is said ONLY of plain READY: never beside a notice, a fault or a lost link. */}
          {plainReady || noticed || offline ? (
            <Text numberOfLines={2} maxFontSizeMultiplier={1.2} style={[styles.ringFlags, noticed ? { color: toneTextHex.warning } : null]} testID="home-status-ring-sub">
              {offline
                ? t('features.dashboard.status.OFFLINE.ringSub')
                : noticed
                  ? t('features.session-finalizing.openNotice.ringSub')
                  : status.platformNotReported
                    ? t('features.dashboard.status.READY.ringSubNotReported')
                    : t('dashboard.systemRing.flags')}
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
  const presentation = status.presentation;
  const connecting = presentation === 'CAMERAS_CONNECTING';
  const offline = presentation === 'OFFLINE';
  // Pass D7 item 3 (ux §8e.2 situation C): a session that recorded nothing says so, in full.
  const failedStart = useFailedStart();
  const failedWords = failedStart === null || offline ? null : failedStartWords(t, failedStart);
  const centred = align === 'center';
  const extra = status.flags.length - MAX_FLAGS;
  // Wave H driver B (G75-07 (b)): CRITICAL while the open session is RECORDING - the recording continues, nothing is blocked.
  const criticalRecording = presentation === 'CRITICAL' && status.sessionState === 'RECORDING';
  // Fix wave I (G75b-02) / fix wave J (JT-01 (a)): the seal of the open session, blocked or retried - Home names
  // that state from the first failed step; nothing is "ready" while the Core takes no new session.
  const seal = status.seal;
  const sealBlocked = presentation === 'SEAL_BLOCKED' ? seal : null;
  const sealRetrying = presentation === 'SEAL_RETRYING' ? seal : null;
  // Fix wave L (G75d-01): READY with an open unsealable notice - stated, with who closes it.
  const openNotices = useOpenNotices();
  const canClose = useCanCloseNotice();
  const noticed = presentation === 'NOTICE' && failedWords === null;
  const plain = presentation === 'RECORDING' || presentation === 'UNKNOWN' || connecting || offline;
  const colour = plain ? palette.foreground : toneTextHex[status.tone];
  const lines = presentation === 'ATTENTION' || presentation === 'CRITICAL' || presentation === 'CRITICAL_ALERT' || presentation === 'SEAL_BLOCKED' || presentation === 'SEAL_RETRYING';

  const subtitle =
    offline
      ? t(status.sessionState === 'RECORDING' ? 'features.dashboard.status.OFFLINE.subtitleRecording' : 'features.dashboard.status.OFFLINE.subtitle')
      : failedWords !== null
      ? `${failedWords.title}. ${failedWords.body}`
      : sealBlocked !== null
        ? `${sealBlocked.sessionId} · ${SEAL_RECORDING_KEPT_SENTENCE}`
      : sealRetrying !== null
        ? [sealRetrying.sessionId, sealRetrying.sentence, SEAL_RECORDING_KEPT_SENTENCE].filter((part): part is string => part !== null && part !== '').join(' · ')
      : noticed
        ? openNoticeDetail(t, openNotices)
      : criticalRecording
        ? t('common.criticalWhileRecording.subtitle', { sessionId: session.sessionId ?? '' })
        : presentation === 'ATTENTION'
          ? t('features.dashboard.status.ATTENTION.subtitle', { count: status.flags.length })
          : presentation === 'CRITICAL_ALERT'
            ? t('features.dashboard.status.CRITICAL_ALERT.subtitle')
          : presentation === 'RECORDING' || connecting
            ? connecting
              ? (session.sessionId ?? '')
              : t('features.dashboard.status.RECORDING.subtitle', { sessionId: session.sessionId ?? '' })
            : presentation === 'READY' && status.platformNotReported
              ? t('features.dashboard.status.READY.subtitleNotReported')
              : t(`${status.copyKey}.subtitle`);

  return (
    <Animated.View key={presentation} entering={crossFadeIn(settings)} style={[styles.text, centred ? styles.textCentre : null]}>
      <Text
        testID="home-status-title"
        maxFontSizeMultiplier={1.2}
        style={[styles.title, { color: colour }, centred ? styles.centre : null]}
      >
        {offline
          ? t('features.dashboard.status.OFFLINE.title')
          : connecting
          ? t('common.session.connectingCameras')
          : sealBlocked !== null
            ? t('features.session-finalizing.sealAttention.chip')
            : sealRetrying !== null
              ? t('features.session-finalizing.sealAttention.retryingTitle')
            : criticalRecording
              ? t('common.criticalWhileRecording.title')
              : noticed
                ? t('features.session-finalizing.openNotice.title')
                : presentation === 'ATTENTION'
                  ? t('features.dashboard.status.ATTENTION.title')
                  : presentation === 'CRITICAL_ALERT'
                    ? t('features.dashboard.status.CRITICAL_ALERT.title')
                    : t(`${status.copyKey}.title`)}
      </Text>
      <Text
        testID="home-status-subtitle"
        maxFontSizeMultiplier={1.2}
        style={[styles.subtitle, { color: noticed ? toneTextHex.warning : presentation === 'READY' ? toneTextHex.success : palette.gray }, centred ? styles.centre : null]}
      >
        {subtitle}
      </Text>
      {noticed ? (
        <Text testID="home-status-notice-close" maxFontSizeMultiplier={1.2} style={[styles.flag, centred ? styles.centre : null]}>
          {t(openNoticeCloseKey(canClose))}
        </Text>
      ) : null}
      {/* Truth rule 3f (JA2-N1): on a simulated Core Home says ONCE that what it shows is a demonstration. */}
      {status.simulatedCore ? (
        <View style={[styles.simulated, centred ? styles.textCentre : null]}>
          <StatusChip testID="home-status-simulated" tone="info" label={t('features.dashboard.status.simulatedCore')} icon={null} size="sm" />
        </View>
      ) : null}
      {presentation === 'RECORDING' ? <RecRow centred={centred} /> : null}
      {lines ? (
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
  simulated: { marginTop: 6, flexDirection: 'row' },
  flag: {
    fontFamily: fontFamily.native.normal,
    fontSize: typography.caption.size,
    lineHeight: typography.caption.lineHeight,
    color: palette.gray,
  },
  recRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 6 },
});
