/**
 * Storage indicators (04_mobile_specs §4.13 T5, web parity with the Storage page KPI cards): write
 * speed, session size and est. remaining, computed from free space at 8.2 GB/h (04 §9 #17, AC-54:
 * 389h 45m at load). Phone: a 3-column strip in the capacity card's footer, so MB 8's region order
 * stays intact. Tablet: four kit `Surface variant="secondary"` tiles (plus retention days).
 * Session size ticks while recording at a 10 MB step (the selector rounds), never per frame.
 */
import { Surface } from 'heroui-native';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { GB, isPlatformNotReported, useSim } from '@dems/shared/sim';
import { derived, fontFamily, palette, toneTextHex, typography } from '@dems/shared/tokens';
import { useMotionSettings } from '@/motion';
import { RATE_GB_PER_HOUR, hoursMinutes, megabytesPerSecond } from './storage-model';
import { STORAGE_BEATS, beatAt, storageEnter } from './storage-motion';
import { useStorageKpis, useStoragePolicy } from './use-storage-data';

interface KpiSpec {
  id: 'writeSpeed' | 'sessionSize' | 'estRemaining' | 'retention';
  label: string;
  value: string;
  unit?: string;
  caption: string;
  /** Phone strip: a caption that fits a third of the card ("Recording · 8.2 GB/h" truncated, F-85-3). */
  captionShort?: string;
  live?: boolean;
}

function useKpiSpecs(withRetention: boolean): KpiSpec[] {
  const { t } = useTranslation();
  const k = useStorageKpis();
  const policy = useStoragePolicy();
  const rate = RATE_GB_PER_HOUR.toFixed(1);
  const remaining = hoursMinutes(k.remainingMinutes * 60_000);
  // Fix wave K (the mirror of the web's C-2; G75c-04): the write speed and the time left are figures of the
  // SIMULATED device (a fixed 8.2 GB/h). A Core in its own capture - it states `security.platformNotReported` -
  // measures neither, so both read "Not reported": no rate, no "at 8.2 GB/h". The session's size is the Core's own count.
  const ownCapture = useSim((s) => isPlatformNotReported(s.security));
  const notReported = t('common.platformNotReported.value');
  const specs: KpiSpec[] = [
    ownCapture
      ? { id: 'writeSpeed', label: t('common.storage.writeSpeed'), value: '—', caption: notReported }
      : {
          id: 'writeSpeed',
          label: t('common.storage.writeSpeed'),
          value: megabytesPerSecond(k.writeBytesPerSec),
          unit: t('storage.units.mbPerSecond'),
          caption: k.recording ? t('features.storage.kpi.recording', { rate }) : t('features.storage.kpi.idle'),
          captionShort: k.recording ? t('features.storage.kpi.recordingShort') : t('features.storage.kpi.idle'),
          live: k.recording,
        },
    {
      id: 'sessionSize',
      label: t('common.storage.sessionSize'),
      value: k.sessionId ? (k.sessionBytes / GB).toFixed(2) : '—',
      ...(k.sessionId ? { unit: t('storage.units.gb') } : {}),
      caption: k.sessionId ? (k.recording ? t('features.storage.kpi.live') : k.sessionId) : t('features.storage.kpi.noSession'),
      live: k.recording,
    },
    ownCapture
      ? { id: 'estRemaining', label: t('common.storage.estRemaining'), value: '—', caption: notReported }
      : {
          id: 'estRemaining',
          label: t('common.storage.estRemaining'),
          value: t('features.storage.kpi.remaining', { hours: remaining.hours, minutes: remaining.minutes }),
          caption: t('features.storage.kpi.atRate', { rate }),
        },
  ];
  if (withRetention) {
    specs.push({
      id: 'retention',
      label: t('features.storage.kpi.retention'),
      value: t('features.storage.kpi.retentionValue', { days: policy.retentionDays }),
      caption: t(`storage.manage.policies.${policy.retentionPolicy}`),
    });
  }
  return specs;
}

export interface StorageKpisProps {
  variant: 'strip' | 'tiles';
}

export function StorageKpis({ variant }: StorageKpisProps) {
  const { t } = useTranslation();
  const specs = useKpiSpecs(variant === 'tiles');
  const settings = useMotionSettings();

  if (variant === 'strip') {
    return (
      <View testID="storage-kpis" accessibilityLabel={t('features.storage.kpi.groupLabel')} style={styles.strip}>
        {specs.map((spec, index) => (
          <View key={spec.id} style={[styles.stripCell, index > 0 ? styles.stripDivider : null]}>
            <KpiBody spec={spec} compact />
          </View>
        ))}
      </View>
    );
  }
  return (
    <View testID="storage-kpis" accessibilityLabel={t('features.storage.kpi.groupLabel')} style={styles.grid}>
      {specs.map((spec, index) => (
        <Animated.View key={spec.id} entering={storageEnter(beatAt(STORAGE_BEATS.kpis, 60, index), settings)} style={styles.tileCell}>
          <Surface variant="secondary" style={styles.tile}>
            <KpiBody spec={spec} compact={false} />
          </Surface>
        </Animated.View>
      ))}
    </View>
  );
}

function KpiBody({ spec, compact }: { spec: KpiSpec; compact: boolean }) {
  const { t } = useTranslation();
  const value = spec.unit ? `${spec.value} ${spec.unit}` : spec.value;
  const caption = compact ? (spec.captionShort ?? spec.caption) : spec.caption;
  return (
    <View
      testID={`storage-kpi-${spec.id}`}
      accessible
      accessibilityLabel={t('features.storage.kpi.a11y', { label: spec.label, value, caption: spec.caption })}
      style={styles.body}
    >
      <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} maxFontSizeMultiplier={1.2} style={styles.label}>
        {spec.label}
      </Text>
      <View style={styles.valueRow}>
        <Text
          testID={`storage-kpi-${spec.id}-value`}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.7}
          maxFontSizeMultiplier={1.2}
          style={[styles.value, compact ? styles.valueCompact : null]}
        >
          {spec.value}
        </Text>
        {spec.unit ? (
          <Text maxFontSizeMultiplier={1.2} style={styles.unit}>
            {spec.unit}
          </Text>
        ) : null}
      </View>
      <Text
        testID={`storage-kpi-${spec.id}-caption`}
        numberOfLines={1}
        maxFontSizeMultiplier={1.2}
        style={[styles.caption, spec.live ? styles.captionLive : null]}
      >
        {caption}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  strip: { flexDirection: 'row' },
  stripCell: { flex: 1, minWidth: 0, paddingHorizontal: 8 },
  stripDivider: { borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: derived.border },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  tileCell: { flexBasis: '46%', flexGrow: 1, minWidth: 150 },
  tile: { borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12 },
  body: { gap: 2 },
  label: {
    fontFamily: fontFamily.native.medium,
    fontSize: typography.label.size,
    lineHeight: typography.label.lineHeight,
    letterSpacing: typography.label.letterSpacing * typography.label.size,
    textTransform: 'uppercase',
    color: palette.gray,
  },
  valueRow: { flexDirection: 'row', alignItems: 'baseline', gap: 4 },
  value: {
    fontFamily: fontFamily.native.semibold,
    fontSize: typography.h2.size,
    lineHeight: typography.h2.lineHeight,
    color: palette.foreground,
    fontVariant: ['tabular-nums'],
    flexShrink: 1,
  },
  valueCompact: { fontSize: typography.h3.size, lineHeight: typography.h3.lineHeight },
  unit: {
    fontFamily: fontFamily.native.normal,
    fontSize: typography.caption.size,
    lineHeight: typography.caption.lineHeight,
    color: palette.gray,
  },
  caption: {
    fontFamily: fontFamily.native.normal,
    fontSize: typography.caption.size,
    lineHeight: typography.caption.lineHeight,
    color: derived.foreground2,
  },
  captionLive: { color: toneTextHex.danger },
});
