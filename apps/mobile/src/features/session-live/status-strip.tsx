/**
 * S2b §5.4 status strip (04_mobile_specs §4.5; research 01 §5.4): the book's recording-screen
 * elements that MB 4 omits — VIDEO 1 REC, VIDEO 2 REC, STORAGE OK, TIME GNSS LOCKED — as a
 * `ScrollShadow` row of StatusChips. The MIC rows are the meter cards.
 *
 * `direction="column"` lists them vertically (the tablet status column, 04 §2.4).
 */
import { LinearGradient } from 'expo-linear-gradient';
import { ScrollShadow } from 'heroui-native';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, View } from 'react-native';
import { palette } from '@dems/shared/tokens';
import { StatusChip } from '@/components/kit';
import { SessionCaptureCheckpoints } from './capture-checkpoints';
import type { StripChip } from './session-live.math';
import { useMonitorStrip } from './use-monitor';
import { useSimulatedCoreLink } from '@/features/evidence/evidence-chips';

export interface StatusStripProps {
  direction?: 'row' | 'column';
}

export function StatusStrip({ direction = 'row' }: StatusStripProps) {
  const { t } = useTranslation();
  const simulatedCore = useSimulatedCoreLink();
  const chips = useMonitorStrip();
  const labelOf = (chip: StripChip): string => {
    switch (chip.kind) {
      case 'video': {
        const name = t('features.session-live.strip.video', { index: chip.index });
        const value =
          chip.value === 'OFFLINE'
            ? t('features.session-live.strip.offline')
            : chip.value === 'CONNECTING'
              ? t('common.session.trackConnecting')
              : t(`common.enums.trackRecState.${chip.value}`);
        return `${name} ${value}`;
      }
      case 'storage':
        return `${t('features.session-live.strip.storage')} ${t(`common.enums.storageRecordingState.${chip.value}`)}`;
      case 'time': {
        // Wave H closing pass Z2: the host system clock of a Core in its own capture is named as that - no GNSS, no lock word.
        if (chip.host) return `${t('features.session-live.strip.time')} ${t('session.captureFacts.timeSource.hostClock')}`;
        const source = t(`common.enums.timeSource.${chip.value}`);
        const quality = chip.locked ? ` ${t('common.enums.timeQuality.LOCKED')}` : '';
        return `${t('features.session-live.strip.time')} ${source}${quality}`;
      }
    }
  };

  // Fix wave Q (CP-10, truth rule 3f): on a SIMULATED Core the monitor's own words say that the feeds and the
  // recording state are a demonstration - the only mark was the one burnt into the bundled picture.
  const demonstration = simulatedCore ? (
    <StatusChip key="demonstration" testID="monitor-strip-demonstration" tone="info" label={t('features.dashboard.status.simulatedCore')} icon={null} size="sm" />
  ) : null;
  const items = chips.map((chip) => (
    <StatusChip
      key={chip.id}
      testID={`monitor-strip-${chip.id}`}
      tone={chip.tone}
      label={labelOf(chip)}
      icon={chip.tone === 'success' ? 'CircleCheck' : chip.tone === 'danger' || chip.tone === 'warning' ? 'TriangleAlert' : 'Info'}
      size="sm"
    />
  ));

  if (direction === 'column') {
    return (
      <View testID="monitor-status-strip" accessibilityLabel={t('features.session-live.strip.label')} style={styles.column}>
        {demonstration}
        {items}
        <SessionCaptureCheckpoints />
      </View>
    );
  }
  return (
    <View testID="monitor-status-strip" accessibilityLabel={t('features.session-live.strip.label')}>
      <ScrollShadow LinearGradientComponent={LinearGradient} color={palette.black} size={24}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
          {demonstration}
          {items}
        </ScrollView>
      </ScrollShadow>
      <SessionCaptureCheckpoints />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8, paddingVertical: 2 },
  column: { gap: 8, alignItems: 'flex-start' },
});
