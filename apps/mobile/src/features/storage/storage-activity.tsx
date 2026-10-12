/**
 * T3 Recent Storage Activity (04_mobile_specs §4.13; MB 8 (645–890, 788–905)): a `SectionCard` with
 * the 5 newest storage events (tone dot, WIB time in mono, title + detail) and a `LinkButton`
 * "See All" → `/audit?category=storage`. Data: the simulator's `events`, filtered to storage
 * (SIM-GAP-M85-1). Rows on screen at mount reveal 30 ms apart (M-C-11); a row that arrives later
 * slides in (M-C-07 `listInsert`). Copy: shared `common.eventType.*` and `storage.activity.*`.
 */
import { useRouter } from 'expo-router';
import { LinkButton } from 'heroui-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { exportPhaseOfEvent, formatWibTime, type SimEvent } from '@dems/shared/sim';
import { derived, fontFamily, palette, typography } from '@dems/shared/tokens';
import { SectionCard } from '@/components/kit';
import { listInsert, rowReveal, useMotionSettings } from '@/motion';
import { ACTIVITY_DOT, activityDetail, activityTone, storageFaultKind } from './storage-model';
import { useStorageActivity } from './use-storage-data';

export const ACTIVITY_ROWS = 5;

/** The row text: the event title (plus the storage fault kind), then its detail. */
export function useActivityText(): (event: SimEvent) => string {
  const { t } = useTranslation();
  return (event) => {
    const fault = storageFaultKind(event);
    // Fix wave J (JW-03, contract J-S 3): an export that was only REQUESTED is not "Evidence exported".
    if (exportPhaseOfEvent(event) === 'REQUESTED') return t('common.truth.exportRequested');
    const title = fault ? `${t(`common.eventType.${event.type}`)} · ${t(`common.faultKind.${fault}`)}` : t(`common.eventType.${event.type}`);
    const detail = activityDetail(event);
    if (!detail) return title;
    if (detail.kind === 'text') return `${title} ${detail.text}`;
    if (detail.kind === 'segment') return `${title} · ${t('storage.activity.segment', { segment: detail.segment, size: detail.sizeGb })}`;
    return `${title} · ${t('storage.activity.policy', { days: detail.days, autoArchive: detail.autoArchive ? t('storage.kpi.on') : t('storage.kpi.off') })}`;
  };
}

export function StorageActivity() {
  const { t } = useTranslation();
  const router = useRouter();
  const settings = useMotionSettings();
  const events = useStorageActivity(ACTIVITY_ROWS);
  const textOf = useActivityText();
  // Rows present at mount reveal in sequence; later rows insert (M-C-07).
  const [initial] = useState<ReadonlySet<string>>(() => new Set(events.map((event) => event.id)));

  return (
    <SectionCard
      testID="storage-activity"
      title={t('storage.activity.title')}
      action={
        <LinkButton
          testID="storage-activity-see-all"
          onPress={() => router.push({ pathname: '/audit', params: { category: 'storage' } })}
        >
          {t('features.storage.activity.seeAll')}
        </LinkButton>
      }
    >
      {events.length === 0 ? (
        <Text testID="storage-activity-empty" maxFontSizeMultiplier={1.2} style={styles.empty}>
          {t('storage.activity.empty')}
        </Text>
      ) : (
        <View accessibilityLabel={t('storage.activity.listLabel')} style={styles.list}>
          {events.map((event, index) => {
            const time = formatWibTime(event.at);
            const text = textOf(event);
            const fresh = !initial.has(event.id);
            return (
              <Animated.View
                key={event.id}
                entering={fresh ? listInsert(settings) : rowReveal(index, settings)}
                testID="storage-activity-row"
                accessible
                accessibilityLabel={t('features.storage.activity.rowA11y', { time, title: text })}
                style={[styles.row, index > 0 ? styles.rowDivider : null]}
              >
                <View style={[styles.dot, { backgroundColor: ACTIVITY_DOT[activityTone(event)] }]} />
                <Text maxFontSizeMultiplier={1.2} style={styles.time}>
                  {time}
                </Text>
                {/* Fix wave J (JA2-27): two lines - "Storage policy changed · 365 days · ..." was cut on the phone. */}
                <Text numberOfLines={2} maxFontSizeMultiplier={1.2} style={styles.text} testID="storage-activity-text">
                  {text}
                </Text>
              </Animated.View>
            );
          })}
        </View>
      )}
    </SectionCard>
  );
}

const styles = StyleSheet.create({
  list: { gap: 0 },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 8 },
  rowDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: derived.border },
  dot: { width: 10, height: 10, borderRadius: 5, marginTop: 5 },
  time: {
    fontFamily: fontFamily.native.mono,
    fontSize: typography.data.size,
    lineHeight: typography.data.lineHeight,
    color: palette.gray,
    fontVariant: ['tabular-nums'],
  },
  text: {
    flex: 1,
    fontFamily: fontFamily.native.normal,
    fontSize: typography.body.size,
    lineHeight: typography.body.lineHeight,
    color: derived.foreground2,
  },
  empty: {
    fontFamily: fontFamily.native.normal,
    fontSize: typography.body.size,
    lineHeight: typography.body.lineHeight,
    color: palette.gray,
  },
});
