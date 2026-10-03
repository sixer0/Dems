/**
 * N2 Network Status (04_mobile_specs §4.14; MB 9 (945–1190, 650–785)): a `SectionCard` with a kit
 * `ListGroup` of three rows in MB order:
 *
 * 1. LAN Connection: `StatusChip` Connected + chevron; the row opens the LAN detail sheet;
 * 2. PoE Network: `StatusChip` Active (Degraded when a port drops);
 * 3. Bandwidth: the 12-bar streaming sparkline (`victory-native`, animation off) and the C-6
 *    `slide` readout "12.4 Mbps" over "↑ 3.1 Mbps", at 1 Hz.
 */
import { ListGroup, Separator } from 'heroui-native';
import { ChevronRight, Gauge, Network, PlugZap } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { fontFamily, palette, typography } from '@dems/shared/tokens';
import { RollingNumber } from '@/components/composed/rolling-number';
import { SectionCard, StatusChip } from '@/components/kit';
import { useMotionPolicy } from '@/motion';
import { BandwidthBars } from './bandwidth-bars';
import { IconTile } from './icon-tile';
import { LAN_TONE, POE_TONE, fixed1, lanLevel, poeLevel, type NetworkView } from './network-time-model';
import { useBandwidthWindow } from './use-network-time';

const DECIMAL_1 = { kind: 'decimal', decimals: 1 } as const;

export interface NetworkStatusCardProps {
  network: NetworkView;
  onOpenLan: () => void;
}

export function NetworkStatusCard({ network, onOpenLan }: NetworkStatusCardProps) {
  const { t } = useTranslation();
  const lan = lanLevel(network.linkUp);
  const poe = poeLevel(network.activePorts, network.totalPorts);
  const lanLabel = t(`networkTime.network.lanState.${lan}`);
  const poeLabel = t(`networkTime.network.poeState.${poe}`);

  return (
    <SectionCard testID="network-time-network" title={t('networkTime.network.title')}>
      <ListGroup variant="transparent" className="rounded-xl">
        <ListGroup.Item
          testID="network-time-lan"
          onPress={onOpenLan}
          accessibilityRole="button"
          accessibilityLabel={`${t('networkTime.network.lanConnection')}, ${lanLabel}`}
          accessibilityHint={t('features.network-time.network.lanDetailHint')}
          className="gap-3 py-2"
        >
          <ListGroup.ItemPrefix>
            <IconTile icon={Network} tone={LAN_TONE[lan]} />
          </ListGroup.ItemPrefix>
          <ListGroup.ItemContent>
            <Text maxFontSizeMultiplier={1.2} style={styles.rowTitle}>
              {t('networkTime.network.lanConnection')}
            </Text>
          </ListGroup.ItemContent>
          <ListGroup.ItemSuffix style={styles.suffixRow}>
            <StatusChip testID="network-time-lan-chip" tone={LAN_TONE[lan]} label={lanLabel} icon="Circle" iconFilled size="sm" />
            <ChevronRight size={18} color={palette.gold} />
          </ListGroup.ItemSuffix>
        </ListGroup.Item>
        <Separator />
        <ListGroup.Item
          testID="network-time-poe"
          accessible
          accessibilityLabel={t('features.network-time.network.poeLabel', {
            state: poeLabel,
            active: network.activePorts,
            total: network.totalPorts,
          })}
          className="gap-3 py-2"
        >
          <ListGroup.ItemPrefix>
            <IconTile icon={PlugZap} tone={POE_TONE[poe]} />
          </ListGroup.ItemPrefix>
          <ListGroup.ItemContent>
            <Text maxFontSizeMultiplier={1.2} style={styles.rowTitle}>
              {t('networkTime.network.poe')}
            </Text>
          </ListGroup.ItemContent>
          <ListGroup.ItemSuffix style={styles.suffixRow}>
            <StatusChip testID="network-time-poe-chip" tone={POE_TONE[poe]} label={poeLabel} icon="Circle" iconFilled size="sm" />
          </ListGroup.ItemSuffix>
        </ListGroup.Item>
        <Separator />
        <BandwidthRow />
      </ListGroup>
    </SectionCard>
  );
}

function BandwidthRow() {
  const { t } = useTranslation();
  const policy = useMotionPolicy();
  const window = useBandwidthWindow();
  const down = fixed1(window.downMbps);
  const up = fixed1(window.upMbps);
  return (
    <ListGroup.Item testID="network-time-bandwidth" className="gap-3 py-2">
      <ListGroup.ItemPrefix>
        <IconTile icon={Gauge} tone="info" />
      </ListGroup.ItemPrefix>
      <View style={styles.fixedContent}>
        <Text maxFontSizeMultiplier={1.2} numberOfLines={1} style={styles.rowTitle}>
          {t('networkTime.network.bandwidth')}
        </Text>
      </View>
      <ListGroup.ItemSuffix style={styles.bandwidthSuffix}>
        <BandwidthBars
          testID="network-time-bandwidth-bars"
          bars={window.bars}
          accessibilityLabel={t('networkTime.network.sparklineLabel', { seconds: window.samples, down, up })}
        />
        <View
          testID="network-time-bandwidth-readout"
          accessible
          accessibilityLabel={t('features.network-time.network.bandwidthLabel', { down, up })}
          style={styles.readout}
        >
          <RollingNumber
            testID="network-time-bandwidth-down"
            value={window.downMbps}
            mode="slide"
            format={DECIMAL_1}
            motion={policy}
            size="h3"
            face="sans"
            suffix=" Mbps"
          />
          <Text maxFontSizeMultiplier={1.2} style={styles.up}>
            {t('features.network-time.network.bandwidthUp', { value: up })}
          </Text>
        </View>
      </ListGroup.ItemSuffix>
    </ListGroup.Item>
  );
}

const styles = StyleSheet.create({
  rowTitle: {
    fontFamily: fontFamily.native.medium,
    fontSize: typography.body.size,
    lineHeight: typography.body.lineHeight,
    color: palette.foreground,
  },
  suffixRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  // Device finding (tablet 3-pane, ~290 dp card): the content slot collapsed to one letter per
  // line, so the label keeps its width and the bars flex instead (BANDWIDTH_CHART_SIZE bounds).
  // A plain View, not ListGroup.ItemContent: the kit's `.list-group__item-content { flex: 1 }`
  // makes Yoga resolve an `auto` basis to 0, so a non-growing label slot collapsed to zero width
  // (device finding, dems_phone2 10:15).
  fixedContent: { flexShrink: 0 },
  bandwidthSuffix: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 10 },
  readout: { alignItems: 'flex-end', minWidth: 78 },
  up: {
    fontFamily: fontFamily.native.mono,
    fontSize: typography.caption.size,
    lineHeight: typography.caption.lineHeight,
    color: palette.gray,
    fontVariant: ['tabular-nums'],
  },
});
