/**
 * T2 Capacity card (04_mobile_specs §4.13; MB 8 (645–890, 648–780)): a `SectionCard` with the
 * donut (centre C-6 "20%" + USED, D28/Q1: MB 8 prints 80%, the free share, 04 §9 #4), the
 * headline "3.2 TB Free" / "of 4.0 TB", and the legend Used 804 GB · Free 3.2 TB · Sealed Evidence
 * 7 · Pending 1 (gold, track grey, violet D28/Q4, amber; the web page's colours, not MB 8's).
 *
 * LOW / FULL (simulator `storage.state`): an inline kit `Alert` above the ring carries the state for
 * as long as it lasts; the ring morphs colour and pulses once (`use-storage-alerts.ts`).
 * Phone: the KPI strip sits in the card footer.
 */
import { Alert } from 'heroui-native';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { derived, fontFamily, palette, typography } from '@dems/shared/tokens';
import { RollingNumber } from '@/components/composed/rolling-number';
import { SectionCard } from '@/components/kit';
import { withAlpha } from '@/components/media/color';
import { useMotionSettings } from '@/motion';
import { CapacityRing } from './capacity-ring';
import { StorageKpis } from './storage-kpis';
import { RING_COLOR, THRESHOLDS, formatShortBytes } from './storage-model';
import { STORAGE_BEATS, beatAt, centreValueDelay, storageEnter } from './storage-motion';
import { useEscalationKey, useStorageAlerts } from './use-storage-alerts';
import { useEvidenceCounts, useStorageCapacity } from './use-storage-data';
import { useHeldValue } from './use-held-value';

export interface CapacityCardProps {
  ringSize: number;
  /** Phone: the KPI strip in the card footer. */
  withKpiStrip: boolean;
}

export function CapacityCard({ ringSize, withKpiStrip }: CapacityCardProps) {
  const { t } = useTranslation();
  const settings = useMotionSettings();
  const capacity = useStorageCapacity();
  const counts = useEvidenceCounts();
  const pulseKey = useEscalationKey(capacity.state);
  useStorageAlerts(capacity.state);

  const reduced = settings.policy === 'reduced';
  const centre = useHeldValue(capacity.usedPercent, centreValueDelay(settings), reduced);
  const stateWord = t(`common.enums.storageState.${capacity.state}`);
  const free = formatShortBytes(capacity.freeBytes);
  const total = formatShortBytes(capacity.totalBytes);

  // Fix wave J (JA2-38 / JT-21): the two counts are named for what the Core's evidence list says they are -
  // items sealed TODAY and items recorded but not sealed - so they are not read as the size of the Evidence list.
  const legend = [
    { id: 'used', color: RING_COLOR[capacity.state], label: t('common.storage.used'), value: formatShortBytes(capacity.usedBytes) },
    { id: 'free', color: withAlpha(palette.gray, 0.55), label: t('common.storage.free'), value: free },
    { id: 'sealed', color: palette.sealed, label: t('features.storage.capacity.sealedToday'), value: String(counts.sealedToday) },
    { id: 'pending', color: palette.warning, label: t('features.storage.capacity.notSealed'), value: String(counts.pending) },
  ] as const;

  return (
    <SectionCard testID="storage-capacity" accessibilityLabel={t('features.storage.capacity.label')} footer={withKpiStrip ? <StorageKpis variant="strip" /> : undefined}>
      {capacity.state !== 'READY' ? (
        <Alert status={capacity.state === 'FULL' ? 'danger' : 'warning'} testID={`storage-alert-${capacity.state}`}>
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>{t(`storage.banner.${capacity.state}`)}</Alert.Title>
            <Alert.Description>
              {capacity.state === 'FULL' ? t('storage.toast.FULLDetail') : t('storage.toast.LOWDetail', { percent: THRESHOLDS.low })}
            </Alert.Description>
          </Alert.Content>
        </Alert>
      ) : null}
      <View style={styles.row}>
        <CapacityRing
          testID="storage-ring"
          size={ringSize}
          usedRatioPercent={capacity.usedRatioPercent}
          state={capacity.state}
          motion={settings}
          sweepBeatMs={STORAGE_BEATS.ringSweep}
          pulseKey={pulseKey}
          accessibilityLabel={t('features.storage.capacity.ringA11y', { percent: capacity.usedPercent, state: stateWord })}
        >
          <RollingNumber
            testID="storage-ring-percent"
            value={centre}
            mode="slide"
            motion={settings.policy}
            size="h1"
            face="sans"
            suffix="%"
            accessibilityLabel={`${capacity.usedPercent}%`}
          />
          <Text testID="storage-ring-label" maxFontSizeMultiplier={1.2} style={styles.usedLabel}>
            {t('common.storage.usedLabel')}
          </Text>
        </CapacityRing>
        <View style={styles.summary}>
          <Text testID="storage-free-headline" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} maxFontSizeMultiplier={1.2} style={styles.headline}>
            {t('features.storage.capacity.freeHeadline', { free })}
          </Text>
          <Text testID="storage-free-total" maxFontSizeMultiplier={1.2} style={styles.ofTotal}>
            {t('storage.capacity.ofTotal', { total })}
          </Text>
          <View style={styles.divider} />
          <View testID="storage-legend" accessibilityLabel={t('storage.capacity.legendLabel')} style={styles.legend}>
            {legend.map((row, index) => (
              <Animated.View
                key={row.id}
                entering={storageEnter(beatAt(STORAGE_BEATS.legend, STORAGE_BEATS.legendStagger, index), settings)}
                testID={`storage-legend-${row.id}`}
                accessible
                accessibilityLabel={t('features.storage.capacity.legendA11y', { label: row.label, value: row.value })}
                style={styles.legendRow}
              >
                <View style={[styles.dot, { backgroundColor: row.color }]} />
                <Text numberOfLines={2} maxFontSizeMultiplier={1.2} style={styles.legendLabel}>
                  {row.label}
                </Text>
                <Text testID={`storage-legend-${row.id}-value`} maxFontSizeMultiplier={1.2} style={styles.legendValue}>
                  {row.value}
                </Text>
              </Animated.View>
            ))}
          </View>
        </View>
      </View>
    </SectionCard>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  summary: { flex: 1, minWidth: 0 },
  headline: {
    fontFamily: fontFamily.native.semibold,
    fontSize: typography.h2.size,
    lineHeight: typography.h2.lineHeight,
    color: palette.foreground,
  },
  ofTotal: {
    fontFamily: fontFamily.native.normal,
    fontSize: typography.body.size,
    lineHeight: typography.body.lineHeight,
    color: palette.gray,
  },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: derived.border, marginVertical: 8 },
  legend: { gap: 6 },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  legendLabel: {
    flex: 1,
    fontFamily: fontFamily.native.normal,
    fontSize: typography.body.size,
    lineHeight: typography.body.lineHeight,
    color: derived.foreground2,
  },
  legendValue: {
    fontFamily: fontFamily.native.medium,
    fontSize: typography.body.size,
    lineHeight: typography.body.lineHeight,
    color: palette.foreground,
    fontVariant: ['tabular-nums'],
  },
  usedLabel: {
    fontFamily: fontFamily.native.medium,
    fontSize: typography.label.size,
    lineHeight: typography.label.lineHeight,
    letterSpacing: typography.label.letterSpacing * typography.label.size,
    textTransform: 'uppercase',
    color: palette.gray,
  },
});
