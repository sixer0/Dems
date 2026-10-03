/**
 * One Sessions hub row (04_mobile_specs §4.9, in the Evidence row language of MB 5): poster
 * thumbnail, session ID (mono), date and time, subject with its `SubjectTypeChip`, duration (mono),
 * the state `StatusChip` and a chevron. A sealed session whose summary is still unacknowledged
 * carries a gold "Summary pending" chip. The current session's row shows a live duration on the
 * simulator clock (1 Hz, that row only). On tablets the selected row carries glow e2 (§2.4).
 */
import { Image } from 'expo-image';
import { Card, PressableFeedback } from 'heroui-native';
import { ChevronRight } from 'lucide-react-native';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { DATE_PATTERNS, formatDate, formatDuration } from '@dems/shared/realtime';
import { derived, fontFamily, palette, radius, spacing, typography } from '@dems/shared/tokens';
import { StatusChip, SubjectTypeChip } from '@/components/kit';
// Direct module imports: the media barrel also loads the Skia renderers.
import { HERO_FOCUS, HERO_STILL } from '@/components/media/brand-assets';
import { withAlpha } from '@/components/media/color';
import { DEMO_MEDIA_LIVE, demoMediaForEvidence, type DemoMediaAsset } from '@/components/media/demo-media';
import { GlowLayer } from '@/motion';
import { SessionStatusChip } from './session-status-chip';
import { evidenceSuffix, handOffFor, type SessionRow as SessionRowModel } from './sessions-model';
import { useLiveElapsedSeconds } from './use-sessions-data';

export interface SessionRowProps {
  row: SessionRowModel;
  selected: boolean;
  isMultiPane: boolean;
  onPress: (row: SessionRowModel) => void;
}

/** Camera 1's poster of the session's evidence (D50, joined on the suffix, D61), the live loop's for the current session, else the room still. */
export function posterForRow(row: Pick<SessionRowModel, 'evidenceId' | 'active'>): { source: DemoMediaAsset; still: boolean } {
  const suffix = evidenceSuffix(row.evidenceId);
  const poster = suffix ? demoMediaForEvidence(suffix)?.poster['VIDEO-01'] : undefined;
  if (poster) return { source: poster, still: false };
  if (row.active) return { source: DEMO_MEDIA_LIVE.poster['VIDEO-01'], still: false };
  return { source: HERO_STILL, still: true };
}

function SessionRowImpl({ row, selected, isMultiPane, onPress }: SessionRowProps) {
  const { t } = useTranslation();
  const date = formatDate(row.startedAt, DATE_PATTERNS.dateTimeMinutes);
  const status = t(`common.enums.sessionState.${row.status}`);
  const duration = row.durationMs === null ? null : formatDuration(row.durationMs);
  const hint = t(`features.sessions.list.hint.${handOffFor(row, isMultiPane).kind}`);
  const poster = posterForRow(row);

  return (
    <View style={styles.wrap}>
      {selected ? <GlowLayer level={2} radius={radius.px.xl} testID={`session-row-glow-${row.id}`} /> : null}
      <PressableFeedback
        testID={`session-row-${row.id}`}
        accessibilityRole="button"
        accessibilityState={{ selected }}
        accessibilityLabel={t('features.sessions.list.rowLabel', {
          id: row.id,
          subject: row.subjectName,
          status,
          date,
          duration: duration ?? t('features.sessions.list.live'),
        })}
        accessibilityHint={hint}
        onPress={() => onPress(row)}
        style={styles.pressable}
      >
        <Card className="rounded-xl" style={[styles.card, selected ? styles.cardSelected : null]}>
          <View style={styles.row}>
            <View style={styles.thumbWrap}>
              <Image
                source={poster.source}
                style={styles.thumb}
                contentFit="cover"
                contentPosition={poster.still ? HERO_FOCUS : 'center'}
                accessible={false}
                recyclingKey={row.id}
                transition={0}
              />
              {row.active ? (
                <View style={styles.liveBadge} testID={`session-row-live-${row.id}`}>
                  <View style={styles.liveDot} />
                  <Text maxFontSizeMultiplier={1.2} style={styles.liveText}>
                    {t('features.sessions.list.live')}
                  </Text>
                </View>
              ) : null}
            </View>
            <View style={styles.body}>
              <Text maxFontSizeMultiplier={1.2} numberOfLines={1} style={styles.id} testID={`session-row-id-${row.id}`}>
                {row.id}
              </Text>
              <Text maxFontSizeMultiplier={1.2} numberOfLines={1} style={styles.meta}>
                {date}
              </Text>
              <Text maxFontSizeMultiplier={1.2} numberOfLines={1} style={styles.subject}>
                {row.subjectName}
              </Text>
              <View style={styles.chips}>
                <SubjectTypeChip type={row.subjectType} size="sm" testID={`session-row-subject-${row.id}`} />
                {duration === null ? (
                  <LiveDuration testID={`session-row-duration-${row.id}`} />
                ) : (
                  <Text maxFontSizeMultiplier={1.2} style={styles.duration} testID={`session-row-duration-${row.id}`}>
                    {duration}
                  </Text>
                )}
              </View>
            </View>
            <View style={styles.trailing}>
              <SessionStatusChip status={row.status} testID={`session-row-status-${row.id}`} />
              {row.pendingSummary ? (
                <StatusChip
                  tone="accent"
                  icon={null}
                  size="sm"
                  label={t('features.sessions.list.summaryPending')}
                  testID={`session-row-pending-${row.id}`}
                />
              ) : null}
              <ChevronRight size={18} color={palette.gray} />
            </View>
          </View>
        </Card>
      </PressableFeedback>
    </View>
  );
}

/** Rows re-render only when their row model (rebuilt only when the simulator data changes) or props change. */
export const SessionRow = memo(SessionRowImpl);

/** The current session's recording time, ticking once per simulator second (this text only). */
function LiveDuration({ testID }: { testID: string }) {
  const seconds = useLiveElapsedSeconds();
  return (
    <Text maxFontSizeMultiplier={1.2} style={[styles.duration, styles.durationLive]} testID={testID}>
      {formatDuration(seconds * 1_000)}
    </Text>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: spacing[1] + 2, borderRadius: radius.px.xl },
  pressable: { borderRadius: radius.px.xl },
  card: { padding: spacing[1] + 2 },
  cardSelected: { borderColor: palette.gold, borderWidth: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  thumbWrap: { width: 88, height: 68, borderRadius: radius.px.lg, overflow: 'hidden', backgroundColor: derived.surfaceSecondary },
  thumb: { width: '100%', height: '100%' },
  liveBadge: {
    position: 'absolute',
    left: 4,
    top: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: radius.px.sm,
    backgroundColor: withAlpha(palette.black, 0.7),
  },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: palette.danger },
  liveText: { fontFamily: fontFamily.native.semibold, fontSize: 10, lineHeight: 14, color: palette.foreground },
  body: { flex: 1, minWidth: 0, gap: 2 },
  id: { fontFamily: fontFamily.native.monoMedium, fontSize: 13, lineHeight: 18, color: palette.foreground },
  meta: { fontFamily: fontFamily.native.normal, fontSize: typography.caption.size, lineHeight: typography.caption.lineHeight, color: palette.gray },
  subject: { fontFamily: fontFamily.native.medium, fontSize: typography.body.size, lineHeight: typography.body.lineHeight, color: derived.foreground2 },
  chips: { flexDirection: 'row', alignItems: 'center', gap: spacing[1], marginTop: 2 },
  duration: {
    fontFamily: fontFamily.native.mono,
    fontSize: typography.data.size,
    lineHeight: typography.data.lineHeight,
    color: palette.foreground,
    fontVariant: ['tabular-nums'],
  },
  durationLive: { color: palette.danger },
  trailing: { alignItems: 'flex-end', justifyContent: 'center', gap: spacing[1] },
});
