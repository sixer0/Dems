/**
 * H5 Recent Sessions (04_mobile_specs §4.3; MB 2 (352–592, 335–488)): `SectionCard` with the three
 * latest sessions (thumbnail, id in mono, "Today 09:35", `SubjectTypeChip`) and a `LinkButton`
 * "See All" → `/sessions`. Thumbnails are `expo-image` crops of the bundled evidence posters (D50,
 * joined on the evidence number, D61), never a canvas per row (§7.8). Rows stagger in at 650 ms.
 * On tablets the card also carries the "items sealed today" count (web Dashboard H parity; D61: 7).
 */
import { Image } from 'expo-image';
import { useRouter, type Href } from 'expo-router';
import { LinkButton, PressableFeedback } from 'heroui-native';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { derived, fontFamily, palette, typography } from '@dems/shared/tokens';
import { RollingNumber } from '@/components/composed/rolling-number';
import { SectionCard, SubjectTypeChip } from '@/components/kit';
import { HERO_FOCUS, HERO_STILL } from '@/components/media/brand-assets';
import { demoMediaForEvidence } from '@/components/media/demo-media';
import { useMotionPolicy, useMotionSettings } from '@/motion';
import type { RecentRow } from './home-model';
import { HOME_BEATS, beatAt, homeEnter, valueTickDelay } from './home-motion';
import { useHeldValue } from './use-held-value';
import { useSealedToday } from './use-home-data';

export interface RecentSessionsProps {
  rows: readonly RecentRow[];
  /** Put the subject chip under the time (narrow tablet pane) instead of at the row end (MB 2). */
  chipBelow?: boolean;
  /** Show the sealed-today count in the card header (tablets). */
  showSealedToday?: boolean;
}

export function RecentSessions({ rows, chipBelow = false, showSealedToday = false }: RecentSessionsProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const settings = useMotionSettings();

  return (
    <Animated.View testID="home-recent" entering={homeEnter(HOME_BEATS.recent, settings)}>
      <SectionCard
        title={t('features.dashboard.recent.title')}
        action={
          <LinkButton testID="home-recent-see-all" onPress={() => router.push('/sessions')}>
            {t('features.dashboard.recent.seeAll')}
          </LinkButton>
        }
      >
        {showSealedToday ? <SealedToday /> : null}
        {rows.length === 0 ? (
          <Text testID="home-recent-empty" style={styles.empty}>
            {t('features.dashboard.recent.empty')}
          </Text>
        ) : (
          <View>
            {rows.map((row, index) => (
              <RecentSessionRow key={row.sessionId} row={row} index={index} chipBelow={chipBelow} last={index === rows.length - 1} />
            ))}
          </View>
        )}
      </SectionCard>
    </Animated.View>
  );
}

function RecentSessionRow({ row, index, chipBelow, last }: { row: RecentRow; index: number; chipBelow: boolean; last: boolean }) {
  const { t } = useTranslation();
  const router = useRouter();
  const settings = useMotionSettings();
  const when = t(`features.dashboard.recent.${row.whenKey}`, { time: row.time, date: row.date });
  const poster = row.posterSuffix ? demoMediaForEvidence(row.posterSuffix)?.poster['VIDEO-01'] : undefined;
  const chip = <SubjectTypeChip testID={`home-recent-row-${index}-subject`} type={row.subjectType} size="sm" />;

  return (
    <Animated.View entering={homeEnter(beatAt(HOME_BEATS.recent, HOME_BEATS.recentStagger, index + 1), settings)}>
      <PressableFeedback
        testID={`home-recent-row-${index}`}
        accessibilityRole="button"
        accessibilityLabel={t('features.dashboard.recent.rowLabel', { id: row.displayId, when })}
        accessibilityHint={t('features.dashboard.recent.rowHint')}
        onPress={() => router.push(`/sessions/${row.sessionId}` as Href)}
        style={[styles.row, last ? null : styles.rowDivider]}
      >
        <Image
          testID={`home-recent-row-${index}-thumb`}
          source={poster ?? HERO_STILL}
          contentFit="cover"
          contentPosition={poster ? 'center' : HERO_FOCUS}
          style={styles.thumb}
          accessible={false}
        />
        <View style={styles.rowText}>
          <Text testID={`home-recent-row-${index}-id`} numberOfLines={1} maxFontSizeMultiplier={1.2} style={styles.id}>
            {row.displayId}
          </Text>
          <Text testID={`home-recent-row-${index}-when`} numberOfLines={1} maxFontSizeMultiplier={1.2} style={styles.when}>
            {when}
          </Text>
          {chipBelow ? <View style={styles.chipBelow}>{chip}</View> : null}
        </View>
        {chipBelow ? null : chip}
      </PressableFeedback>
    </Animated.View>
  );
}

/** "7 items sealed today" (C-6 `slide` after the held beat, DR-S77-1; a new seal ticks +1). */
function SealedToday() {
  const { t } = useTranslation();
  const policy = useMotionPolicy();
  const settings = useMotionSettings();
  const count = useSealedToday();
  const shown = useHeldValue(count, valueTickDelay(HOME_BEATS.recent, settings), policy === 'reduced');
  return (
    <View testID="home-sealed-today" style={styles.sealed}>
      <RollingNumber
        testID="home-sealed-today-count"
        value={shown}
        mode="slide"
        motion={policy}
        size="h1"
        face="sans"
        color={palette.gold}
        accessibilityLabel={String(count)}
      />
      <Text maxFontSizeMultiplier={1.2} style={styles.sealedCaption}>
        {t('dashboard.sealedToday.caption', { count })}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  sealed: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
  sealedCaption: {
    fontFamily: fontFamily.native.normal,
    fontSize: typography.body.size,
    lineHeight: typography.body.lineHeight,
    color: palette.foreground,
  },
  empty: {
    paddingVertical: 16,
    fontFamily: fontFamily.native.normal,
    fontSize: typography.body.size,
    lineHeight: typography.body.lineHeight,
    color: palette.gray,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8, minHeight: 56 },
  rowDivider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: derived.separator },
  thumb: { width: 64, height: 44, borderRadius: 8, backgroundColor: derived.surfaceSecondary },
  rowText: { flex: 1, minWidth: 0, gap: 2 },
  id: {
    fontFamily: fontFamily.native.monoMedium,
    fontSize: typography.data.size,
    lineHeight: typography.data.lineHeight,
    color: palette.foreground,
  },
  when: {
    fontFamily: fontFamily.native.normal,
    fontSize: typography.caption.size,
    lineHeight: typography.caption.lineHeight,
    color: palette.gray,
    fontVariant: ['tabular-nums'],
  },
  chipBelow: { flexDirection: 'row', marginTop: 4 },
});
