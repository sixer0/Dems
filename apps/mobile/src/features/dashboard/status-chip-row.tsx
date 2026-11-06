/**
 * Tablet chip row "Security, Time & Network" (04_mobile_specs §4.3 "Tablet additions"; web
 * Dashboard G parity): Security posture, GNSS / Time sync and the network link as tone chips.
 */
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { StatusChip } from '@/components/kit';
import { useChipRow } from './use-home-data';

const ICON = { security: 'ShieldCheck', time: 'CircleCheck', network: 'Wifi', storage: 'CircleCheck' } as const;

export function StatusChipRow({ withStorage = false }: { withStorage?: boolean }) {
  const { t } = useTranslation();
  const chips = useChipRow(withStorage);
  return (
    <View testID="home-chips" accessibilityLabel={t('features.dashboard.chips.label')} style={styles.row}>
      {chips.map((chip) => {
        const label = t(chip.labelKey);
        const value = t(chip.valueKey, chip.valueParams ?? {});
        return (
          <StatusChip
            key={chip.id}
            testID={`home-chip-${chip.id}`}
            tone={chip.tone}
            label={t('features.dashboard.chips.value', { label, value })}
            icon={chip.tone === 'success' ? ICON[chip.id] : 'TriangleAlert'}
            size="sm"
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8 },
});
