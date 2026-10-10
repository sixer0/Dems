/**
 * Session detail body (04_mobile_specs §4.9 "row → the session"), shared by the phone route
 * `/sessions/[sessionId]` (`variant="screen"`) and the tablet detail pane (`variant="pane"`).
 *
 * In MB 6's language (hero, key-values) with the §4.7 summary fields:
 * - Hero: Camera 1's poster of the session's evidence (D50, joined on the suffix, D61) with a
 *   gradient fade and the state chip, the session ID (mono h2), the time range, case and subject.
 * - Notice: an unacknowledged summary (gold) or an INCOMPLETE session (amber, SYS-008, with the
 *   fault that ended it).
 * - Key-values: Case Number, Subject + `SubjectTypeChip`, Investigator, Room, Start, End,
 *   Duration, Size, Evidence ID.
 * - Hand-offs (step-82 brief): Return to monitor (RECORDING), Open finalization, Open recovery,
 *   Open summary (pending), View in Evidence (sealed; the Evidence detail pane on tablets),
 *   View recorded evidence (an INCOMPLETE session's RECORDED item).
 */
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Alert, Button } from 'heroui-native';
import { ArrowLeft } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { DATE_PATTERNS, formatDate, formatDuration } from '@dems/shared/realtime';
import { useSim } from '@dems/shared/sim';
import { derived, fontFamily, palette, radius, spacing, typography } from '@dems/shared/tokens';
import { KeyValueList, SectionCard, SubjectTypeChip, type KeyValueItem } from '@/components/kit';
import { withAlpha } from '@/components/media/color';
import { NOTICE_REASON_NO_CAMERA_CONNECTED, failedStartWords, type FailedStart } from '@/features/capture-selector/capture-notices-model';
import { HERO_FOCUS } from '@/components/media/brand-assets';
import { useLayoutClass } from '@/layout';
import { enterRise, triggerHaptic, useMotionSettings } from '@/motion';
import { posterForRow } from './session-row';
import { SessionStatusChip } from './session-status-chip';
import { evidenceHrefFor, sizeParts, type SessionRow } from './sessions-model';
import { useSafePush } from './use-hand-off';
import { useLiveElapsedSeconds, useOperatorName, useSessionRow } from './use-sessions-data';

export interface SessionDetailProps {
  sessionId: string;
  variant: 'screen' | 'pane';
}

export function SessionDetail({ sessionId, variant }: SessionDetailProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const m = useMotionSettings();
  const row = useSessionRow(sessionId);

  const header =
    variant === 'screen' ? (
      <View style={styles.header}>
        <Button
          isIconOnly
          variant="ghost"
          size="lg"
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/sessions'))}
          accessibilityLabel={t('features.sessions.header.back')}
          testID="session-detail-back"
        >
          <ArrowLeft size={22} color={palette.gold} />
        </Button>
        <Text maxFontSizeMultiplier={1.2} accessibilityRole="header" style={styles.headerTitle}>
          {t('features.sessions.header.detailTitle')}
        </Text>
      </View>
    ) : (
      <View style={styles.paneHeader}>
        <Text maxFontSizeMultiplier={1.2} accessibilityRole="header" style={styles.headerTitle}>
          {t('features.sessions.header.detailTitle')}
        </Text>
      </View>
    );

  if (!row) {
    return (
      <View style={styles.root} testID="session-detail-missing">
        {header}
        <View style={styles.missing}>
          <SectionCard description={t('features.sessions.detail.notFound')}>
            {variant === 'screen' ? (
              <Button variant="outline" onPress={() => router.replace('/sessions')} testID="session-detail-missing-back">
                <Button.Label>{t('features.sessions.header.back')}</Button.Label>
              </Button>
            ) : null}
          </SectionCard>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.root} testID={`session-detail-${variant}`}>
      {header}
      <ScrollView contentContainerStyle={styles.scroll}>
        <Animated.View entering={enterRise(0, m)}>
          <Hero row={row} />
        </Animated.View>
        <Notice row={row} />
        <Animated.View entering={enterRise(1, m)}>
          <Details row={row} />
        </Animated.View>
        <Animated.View entering={enterRise(2, m)}>
          <Actions row={row} />
        </Animated.View>
      </ScrollView>
    </View>
  );
}

function Hero({ row }: { row: SessionRow }) {
  const { t } = useTranslation();
  const poster = posterForRow(row);
  const range =
    row.endedAt === null
      ? formatDate(row.startedAt, DATE_PATTERNS.dateTime)
      : t('features.sessions.detail.timeRange', {
          start: formatDate(row.startedAt, DATE_PATTERNS.dateTime),
          end: formatDate(row.endedAt, DATE_PATTERNS.time),
        });
  return (
    <SectionCard testID="session-detail-hero">
      <View style={styles.heroMedia}>
        <Image
          source={poster.source}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          contentPosition={poster.still ? HERO_FOCUS : 'center'}
          accessible={false}
          transition={0}
        />
        <LinearGradient
          colors={[withAlpha(derived.surface, 0), withAlpha(derived.surface, 0.9)]}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
        {/* W93-9 (FXR-M; O-CF2-B-2): an opaque backplate under the chip laid over the photo, as the Evidence
            hero does (`evidence-detail.tsx` heroChip): the chip's soft tone is see-through and read faded
            over the bright ceiling of the still. */}
        <View style={styles.heroChip} testID="session-detail-status-plate">
          <SessionStatusChip status={row.status} sessionId={row.id} size="md" testID="session-detail-status" />
        </View>
      </View>
      <Text selectable maxFontSizeMultiplier={1.2} numberOfLines={1} adjustsFontSizeToFit style={styles.heroId} testID="session-detail-id">
        {row.id}
      </Text>
      <Text maxFontSizeMultiplier={1.2} style={styles.heroRange} testID="session-detail-range">
        {range}
      </Text>
      <View style={styles.heroLine}>
        <Text maxFontSizeMultiplier={1.2} numberOfLines={1} style={styles.mono}>
          {row.caseNumber}
        </Text>
        <SubjectTypeChip type={row.subjectType} size="sm" testID="session-detail-subject-chip" />
      </View>
    </SectionCard>
  );
}

/**
 * Integration pass D7 follow-up (D158 item 4): the cause of a closed session that recorded nothing. "No
 * camera connected" only when the Core said so: a `CAPTURE_FAULT` alert with `params.reason:
 * NO_CAMERA_CONNECTED` raised while that session was open (one session at a time on a Core, so the
 * window from its creation to its end names it). Otherwise the generic title.
 */
function useClosedFailedStart(row: SessionRow): FailedStart | null {
  const named = useSim((s) =>
    row.recordedNothing === true && row.endedAt !== null
      ? s.alerts.some((alert) => alert.kind === 'CAPTURE_FAULT' && alert.params?.['reason'] === NOTICE_REASON_NO_CAMERA_CONNECTED && alert.at >= row.startedAt && alert.at <= (row.endedAt ?? 0))
      : false,
  );
  if (row.recordedNothing !== true) return null;
  return named ? NOTICE_REASON_NO_CAMERA_CONNECTED : 'OTHER';
}

function Notice({ row }: { row: SessionRow }) {
  const { t } = useTranslation();
  const closedFailedStart = useClosedFailedStart(row);
  if (row.pendingSummary) {
    return (
      <Alert status="accent" testID="session-detail-pending">
        <Alert.Indicator />
        <Alert.Content>
          <Alert.Title>{t('features.sessions.detail.pendingTitle')}</Alert.Title>
          <Alert.Description>{t('features.sessions.detail.pendingBody')}</Alert.Description>
        </Alert.Content>
      </Alert>
    );
  }
  if (row.status !== 'INCOMPLETE') return null;
  return (
    <Alert status="warning" testID="session-detail-incomplete">
      <Alert.Indicator />
      <Alert.Content>
        <Alert.Title>{t('features.sessions.detail.incompleteTitle')}</Alert.Title>
        <Alert.Description>
          {closedFailedStart !== null
            ? `${failedStartWords(t, closedFailedStart).title}. ${failedStartWords(t, closedFailedStart).body}`
            : `${row.faultKind ? `${t(`common.faultKind.${row.faultKind}`)}. ` : ''}${
                row.evidenceId ? t('features.sessions.detail.incompleteBody', { evidenceId: row.evidenceId }) : t('features.sessions.detail.incompleteBodyNoEvidence')
              }`}
        </Alert.Description>
      </Alert.Content>
    </Alert>
  );
}

function Details({ row }: { row: SessionRow }) {
  const { t } = useTranslation();
  const investigator = useOperatorName(row.investigatorId);
  const size = sizeParts(row.sizeBytes);
  const items: KeyValueItem[] = [
    { id: 'case', label: t('session.details.caseNumber'), value: row.caseNumber, mono: true, testID: 'session-detail-case' },
    {
      id: 'subject',
      label: t('session.details.subject'),
      value: (
        <View style={styles.subject} testID="session-detail-subject-row">
          <Text maxFontSizeMultiplier={1.2} numberOfLines={2} style={[styles.valueText, styles.subjectName]} testID="session-detail-subject-name">
            {row.subjectName}
          </Text>
          <SubjectTypeChip type={row.subjectType} size="sm" />
        </View>
      ),
      testID: 'session-detail-subject',
    },
    { id: 'investigator', label: t('session.details.investigator'), value: investigator ?? row.investigatorId, testID: 'session-detail-investigator' },
    { id: 'room', label: t('session.details.room'), value: row.room, testID: 'session-detail-room' },
    { id: 'start', label: t('session.details.startTime'), value: formatDate(row.startedAt, DATE_PATTERNS.dateTime), mono: true, testID: 'session-detail-start' },
    {
      id: 'end',
      label: t('features.sessions.detail.endTime'),
      value: row.endedAt === null ? '—' : formatDate(row.endedAt, DATE_PATTERNS.dateTime),
      mono: true,
      testID: 'session-detail-end',
    },
    {
      id: 'duration',
      label: t('session.details.duration'),
      value: row.durationMs === null ? <LiveDurationValue /> : formatDuration(row.durationMs),
      mono: true,
      testID: 'session-detail-duration',
    },
    {
      id: 'size',
      label: t('features.sessions.detail.size'),
      value: size ? t(`common.units.${size.unit}`, { value: size.value }) : '—',
      testID: 'session-detail-size',
    },
    { id: 'evidence', label: t('session.details.evidenceId'), value: row.evidenceId ?? '—', mono: true, testID: 'session-detail-evidence' },
  ];
  return (
    <SectionCard title={t('session.details.title')} testID="session-detail-details">
      <KeyValueList items={items} />
    </SectionCard>
  );
}

function LiveDurationValue() {
  const seconds = useLiveElapsedSeconds();
  return (
    <Text maxFontSizeMultiplier={1.2} style={styles.mono}>
      {formatDuration(seconds * 1_000)}
    </Text>
  );
}

function Actions({ row }: { row: SessionRow }) {
  const { t } = useTranslation();
  const { isMultiPane } = useLayoutClass();
  const push = useSafePush();
  const go = (href: string, source: string) => {
    triggerHaptic('primaryPress');
    push(href, `detail.${source}`, { sessionId: row.id });
  };

  const buttons: { id: string; label: string; variant: 'primary' | 'outline' | 'danger'; href: string }[] = [];
  if (row.status === 'RECORDING') buttons.push({ id: 'monitor', label: t('features.sessions.active.returnToMonitor'), variant: 'primary', href: '/session/live' });
  if (row.status === 'FINALIZING') buttons.push({ id: 'finalizing', label: t('features.sessions.active.openFinalizing'), variant: 'primary', href: '/session/finalizing' });
  if (row.status === 'FAULT') buttons.push({ id: 'recovery', label: t('features.sessions.active.openRecovery'), variant: 'danger', href: '/session/recovery' });
  if (row.pendingSummary) buttons.push({ id: 'summary', label: t('features.sessions.detail.actions.openSummary'), variant: 'primary', href: `/session/summary/${row.id}` });
  if (row.status === 'SEALED' && row.evidenceId) {
    buttons.push({
      id: 'evidence',
      label: t('features.sessions.detail.actions.viewEvidence'),
      variant: row.pendingSummary ? 'outline' : 'primary',
      href: evidenceHrefFor(row.evidenceId, isMultiPane),
    });
  }
  if (row.status === 'INCOMPLETE' && row.evidenceId) {
    buttons.push({ id: 'evidence', label: t('features.sessions.detail.actions.viewRecorded'), variant: 'outline', href: evidenceHrefFor(row.evidenceId, isMultiPane) });
  }
  if (buttons.length === 0) return null;

  return (
    <View style={[styles.actions, isMultiPane ? styles.actionsRow : null]} testID="session-detail-actions">
      {buttons.map((button) => (
        <Button
          key={button.id}
          testID={`session-detail-action-${button.id}`}
          variant={button.variant}
          size="lg"
          onPress={() => go(button.href, button.id)}
          style={isMultiPane ? styles.actionFlex : undefined}
        >
          <Button.Label>{button.label}</Button.Label>
        </Button>
      ))}
    </View>
  );
}

/** The opaque backplate of a chip laid over media (W93-9; the Evidence hero's recipe). */
export const MEDIA_CHIP_PLATE = withAlpha(palette.black, 0.7);

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing[0], minHeight: 56, paddingHorizontal: spacing[1] },
  paneHeader: { minHeight: 64, justifyContent: 'center', paddingHorizontal: spacing[3] },
  headerTitle: {
    flex: 1,
    fontFamily: fontFamily.native.semibold,
    fontSize: typography.h3.size,
    lineHeight: typography.h3.lineHeight,
    color: palette.foreground,
  },
  missing: { paddingHorizontal: spacing[3], paddingTop: spacing[3] },
  scroll: { paddingHorizontal: spacing[3], paddingBottom: spacing[4], gap: spacing[3] },
  heroMedia: { height: 150, borderRadius: radius.px.lg, overflow: 'hidden', backgroundColor: derived.surfaceSecondary },
  heroChip: { position: 'absolute', top: spacing[1], right: spacing[1], borderRadius: radius.px.full, backgroundColor: MEDIA_CHIP_PLATE },
  heroId: {
    fontFamily: fontFamily.native.monoMedium,
    fontSize: typography.h2.size,
    lineHeight: typography.h2.lineHeight,
    color: palette.foreground,
  },
  heroRange: {
    fontFamily: fontFamily.native.mono,
    fontSize: typography.caption.size,
    lineHeight: typography.caption.lineHeight,
    color: palette.gray,
    fontVariant: ['tabular-nums'],
  },
  heroLine: { flexDirection: 'row', alignItems: 'center', gap: spacing[1], flexWrap: 'wrap' },
  mono: {
    flexShrink: 1,
    fontFamily: fontFamily.native.mono,
    fontSize: typography.data.size,
    lineHeight: typography.data.lineHeight,
    color: palette.foreground,
  },
  // W93-8 (FXR-M; RF2-1): the row WRAPS, and the name is never shrunk below its own width (`flexShrink: 0`),
  // capped at the row (`maxWidth: '100%'`): a long name breaks between its words over the full value width,
  // and the chip moves under it. Before, Yoga shrank the name below its longest word next to the chip and
  // Android broke inside the word ("Retno W / ulandari", "Siti Rahm / awati" on the tablet's detail pane).
  subject: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'flex-end', gap: spacing[1], flexShrink: 1 },
  subjectName: { flexShrink: 0, maxWidth: '100%' },
  valueText: {
    flexShrink: 1,
    textAlign: 'right',
    fontFamily: fontFamily.native.normal,
    fontSize: typography.body.size,
    lineHeight: typography.body.lineHeight,
    color: palette.foreground,
  },
  actions: { gap: spacing[2] },
  actionsRow: { flexDirection: 'row', justifyContent: 'flex-end' },
  actionFlex: { flex: 1 },
});
