/**
 * LAN Connection detail sheet (04_mobile_specs §4.14 N2: "LAN Connection (`StatusChip` Connected +
 * chevron → detail sheet)"). Kit `BottomSheet`, content-sized (a content-sized sheet opens reliably
 * on dems_phone, F-79-2), mounted only while open or closing (`useSheetPresence`).
 *
 * The kit portals sheet content above the simulator's provider (04 §3.2), so the sheet takes its
 * data as props (a flat `NetworkView`) and never calls `useSim` itself.
 */
import { BottomSheet } from 'heroui-native';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { spacing } from '@dems/shared/tokens';
import { KeyValueList, StatusChip, type KeyValueItem } from '@/components/kit';
import { LAN_TONE, POE_TONE, fixed1, lanLevel, poeLevel, type NetworkView } from './network-time-model';
import { SheetContentSignal, useSheetPresence } from './use-sheet-presence';

export interface LanSheetProps {
  isOpen: boolean;
  onClose: () => void;
  network: NetworkView;
}

export function LanSheet({ isOpen, onClose, network }: LanSheetProps) {
  const { t } = useTranslation();
  const presence = useSheetPresence(isOpen);
  if (!presence.mounted) return null;

  const lan = lanLevel(network.linkUp);
  const poe = poeLevel(network.activePorts, network.totalPorts);
  const tabletTone = network.tabletLink === 'CONNECTED' ? 'success' : 'warning';
  const items: KeyValueItem[] = [
    { id: 'ip', label: t('features.network-time.lan.ipAddress'), value: network.ip, mono: true, testID: 'network-time-lan-ip' },
    { id: 'name', label: t('features.network-time.lan.network'), value: network.lanName },
    {
      id: 'speed',
      label: t('features.network-time.lan.linkSpeed'),
      value: t('features.network-time.lan.linkSpeedValue', { value: network.linkSpeedMbps / 1000 }),
    },
    { id: 'gateway', label: t('features.network-time.lan.gateway'), value: network.gateway, mono: true },
    {
      id: 'ports',
      label: t('features.network-time.lan.poePorts'),
      value: (
        <StatusChip
          size="sm"
          tone={POE_TONE[poe]}
          label={t('networkTime.network.poePorts', { active: network.activePorts, total: network.totalPorts })}
        />
      ),
    },
    {
      id: 'budget',
      label: t('features.network-time.lan.poeBudget'),
      value: t('networkTime.network.poeBudget', { draw: fixed1(network.drawW), budget: network.budgetW }),
    },
    {
      id: 'tablet',
      label: t('features.network-time.lan.tablet'),
      value: (
        <StatusChip size="sm" tone={tabletTone} label={t(`networkTime.network.tabletState.${network.tabletLink}`)} />
      ),
    },
  ];

  return (
    <BottomSheet isOpen={presence.open} onOpenChange={(open) => (open ? undefined : onClose())}>
      <BottomSheet.Portal>
        <BottomSheet.Overlay />
        <BottomSheet.Content>
          <SheetContentSignal onChange={presence.setContentMounted}>
            <View style={styles.header} testID="network-time-lan-sheet">
              <View style={styles.headerText}>
                <BottomSheet.Title>{t('features.network-time.lan.title')}</BottomSheet.Title>
                <BottomSheet.Description>{t('features.network-time.lan.description')}</BottomSheet.Description>
                <View style={styles.badges}>
                  <StatusChip size="sm" tone={LAN_TONE[lan]} label={t(`networkTime.network.lanState.${lan}`)} icon={lan === 'UP' ? 'CircleCheck' : 'TriangleAlert'} />
                </View>
              </View>
              {/* Also closes directly, so a close within the opening frame is never lost. */}
              <BottomSheet.Close accessibilityLabel={t('common.actions.close')} testID="network-time-lan-sheet-close" onPress={onClose} />
            </View>
            <KeyValueList items={items} />
          </SheetContentSignal>
        </BottomSheet.Content>
      </BottomSheet.Portal>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing[2], marginBottom: spacing[2] },
  headerText: { flex: 1, gap: spacing[0] },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[1], marginTop: spacing[1] },
});
