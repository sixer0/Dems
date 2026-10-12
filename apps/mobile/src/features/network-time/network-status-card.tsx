/**
 * N2 Network Status (04_mobile_specs §4.14; MB 9 (945–1190, 650–785)): a `SectionCard` with a kit
 * `ListGroup` of three rows in MB order:
 *
 * 1. LAN Connection: `StatusChip` Connected + chevron; the row opens the LAN detail sheet;
 * 2. PoE Network: `StatusChip` Active (Degraded when a port drops);
 * 3. Bandwidth: the 12-bar streaming sparkline (`victory-native`, animation off) and the C-6
 *    `slide` readout "12.4 Mbps" over "↑ 3.1 Mbps", at 1 Hz.
 *
 * Closing-fix CF-M2, defect R-T-3: in the tablet's three-pane layout the card is about 290 dp wide,
 * narrower than label + bars + readout need on one line (`bandwidthInlineMinWidth`, about 314 dp), so
 * the readout and the bars overflowed to the left over the label ("Bandwidt", re-test
 * `P12_network_time.png`). The row measures itself: when it is narrower than that, the sparkline moves
 * under the label in the content column and the readout keeps the right side; the label always has
 * its whole width. A phone (about 348 dp) keeps the MB 9 one-line row.
 */
import { ListGroup, Separator } from 'heroui-native';
import { ChevronRight, Gauge, Network, PlugZap } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View, useWindowDimensions, type LayoutChangeEvent } from 'react-native';
import { fontFamily, palette, typography } from '@dems/shared/tokens';
import { RollingNumber } from '@/components/composed/rolling-number';
import { SectionCard, StatusChip } from '@/components/kit';
import { useLayoutClass } from '@/layout';
import { useMotionPolicy } from '@/motion';
import { BANDWIDTH_CHART_SIZE, BandwidthBars } from './bandwidth-bars';
import { ICON_TILE_SIZE, IconTile } from './icon-tile';
import { LAN_TONE, POE_TONE, fixed1, lanLevel, poeLevel, type NetworkView } from './network-time-model';
import { useBandwidthWindow } from './use-network-time';

const DECIMAL_1 = { kind: 'decimal', decimals: 1 } as const;

/**
 * What the Bandwidth row needs on ONE line, in dp (R-T-3). Item padding and gaps are the kit's
 * (`.list-group__item` padding `spacing * 4`, the row's `gap-3`); the two text widths are the
 * label "Bandwidth" (body, medium) and the readout "13.3 Mbps" (h3) at font scale 1, as measured on
 * the phone's capture (`31_network_time.png`: 71.5 dp and 83.6 dp).
 */
export const BANDWIDTH_ROW_METRICS = {
  itemPaddingX: 16,
  gap: 12,
  icon: ICON_TILE_SIZE,
  label: 72,
  suffixGap: 10,
  bars: BANDWIDTH_CHART_SIZE.minWidth,
  readout: 84,
} as const;

/** The texts of the row cap their font scale at 1.2 (`maxFontSizeMultiplier`). */
const MAX_FONT_SCALE = 1.2;

/** The narrowest Bandwidth row (its full width, padding included) that holds label, bars and readout on one line. */
export function bandwidthInlineMinWidth(fontScale: number): number {
  const m = BANDWIDTH_ROW_METRICS;
  const scale = Math.min(Math.max(fontScale, 1), MAX_FONT_SCALE);
  return Math.ceil(2 * m.itemPaddingX + m.icon + 2 * m.gap + m.suffixGap + m.bars + (m.label + m.readout) * scale);
}

export interface NetworkStatusCardProps {
  network: NetworkView;
  onOpenLan: () => void;
  /**
   * Fix wave J (JT-03 / JW-04; THE ONE RULE): the Core is in its own capture - it reports no LAN, PoE or
   * bandwidth fact. The three rows read "Not reported" (no chip of the model, no bars, no moving figure, no
   * sheet of model values); the one thing known, this device's own link to the Core, is stated.
   */
  notReported?: boolean;
}

export function NetworkStatusCard({ network, onOpenLan, notReported = false }: NetworkStatusCardProps) {
  const { t } = useTranslation();
  if (notReported) return <NetworkNotReportedCard network={network} />;
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

const NOT_REPORTED_ROWS = [
  { id: 'lan', icon: Network, nameKey: 'networkTime.network.lanConnection' },
  { id: 'poe', icon: PlugZap, nameKey: 'networkTime.network.poe' },
  { id: 'bandwidth', icon: Gauge, nameKey: 'networkTime.network.bandwidth' },
] as const;

function NetworkNotReportedCard({ network }: { network: NetworkView }) {
  const { t } = useTranslation();
  const word = t('common.platformNotReported.value');
  const linked = network.tabletLink === 'CONNECTED';
  const linkLabel = t(`features.network-time.lan.deviceState.${linked ? 'CONNECTED' : 'OFFLINE'}`);
  return (
    <SectionCard testID="network-time-network" title={t('networkTime.network.title')}>
      <View testID="network-time-not-reported">
        {NOT_REPORTED_ROWS.map((row, index) => (
          <View key={row.id}>
            {index > 0 ? <Separator /> : null}
            {/* Plain rows: nothing to open, so nothing is announced as a button. */}
            <View style={styles.plainRow} testID={`network-time-${row.id}`} accessible accessibilityRole="text" accessibilityLabel={t('features.network-time.network.notReportedLabel', { name: t(row.nameKey) })}>
              <IconTile icon={row.icon} tone="default" />
              <Text maxFontSizeMultiplier={1.2} style={[styles.rowTitle, styles.plainTitle]}>
                {t(row.nameKey)}
              </Text>
              <StatusChip testID={`network-time-${row.id}-chip`} tone="default" label={word} icon={null} size="sm" />
            </View>
          </View>
        ))}
        <Separator />
        <View style={styles.plainRow} testID="network-time-device-link" accessible accessibilityRole="text" accessibilityLabel={`${t('features.network-time.lan.tablet')}, ${linkLabel}`}>
          <IconTile icon={Network} tone={linked ? 'success' : 'warning'} />
          <Text maxFontSizeMultiplier={1.2} style={[styles.rowTitle, styles.plainTitle]}>
            {t('features.network-time.lan.tablet')}
          </Text>
          <StatusChip testID="network-time-device-link-chip" tone={linked ? 'success' : 'warning'} label={linkLabel} icon="Circle" iconFilled size="sm" />
        </View>
        <Text maxFontSizeMultiplier={1.2} style={styles.note} testID="network-time-not-reported-note">
          {t('features.network-time.network.notReportedNote')}
        </Text>
      </View>
    </SectionCard>
  );
}

function BandwidthRow() {
  const { t } = useTranslation();
  const policy = useMotionPolicy();
  const window = useBandwidthWindow();
  const { fontScale } = useWindowDimensions();
  const { isMultiPane } = useLayoutClass();
  // The row's measured width; before the first layout, multi-pane cards are the narrow ones.
  const [rowWidth, setRowWidth] = useState<number | null>(null);
  const stacked = rowWidth === null ? isMultiPane : rowWidth < bandwidthInlineMinWidth(fontScale);
  const onLayout = (event: LayoutChangeEvent) => {
    const next = Math.round(event.nativeEvent.layout.width);
    if (next > 0 && next !== rowWidth) setRowWidth(next);
  };
  const down = fixed1(window.downMbps);
  const up = fixed1(window.upMbps);
  const label = (
    <Text maxFontSizeMultiplier={MAX_FONT_SCALE} numberOfLines={1} style={styles.rowTitle} testID="network-time-bandwidth-label">
      {t('networkTime.network.bandwidth')}
    </Text>
  );
  const bars = (
    <BandwidthBars
      testID="network-time-bandwidth-bars"
      bars={window.bars}
      accessibilityLabel={t('networkTime.network.sparklineLabel', { seconds: window.samples, down, up })}
    />
  );
  return (
    <ListGroup.Item testID="network-time-bandwidth" className="gap-3 py-2" onLayout={onLayout}>
      <ListGroup.ItemPrefix>
        <IconTile icon={Gauge} tone="info" />
      </ListGroup.ItemPrefix>
      {stacked ? (
        // Narrow card: the label on its own line with the sparkline under it (its own row, so the
        // bars' `flex: 1` sizes their width, not their height).
        <View style={styles.stackedContent} testID="network-time-bandwidth-stacked">
          {label}
          <View style={styles.stackedBars}>{bars}</View>
        </View>
      ) : (
        <View style={styles.fixedContent} testID="network-time-bandwidth-inline">
          {label}
        </View>
      )}
      <ListGroup.ItemSuffix style={stacked ? styles.readoutSuffix : styles.bandwidthSuffix}>
        {stacked ? null : bars}
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
  plainRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8, paddingHorizontal: 16 },
  plainTitle: { flex: 1 },
  note: { fontFamily: fontFamily.native.normal, fontSize: typography.caption.size, lineHeight: typography.caption.lineHeight, color: palette.gray, paddingHorizontal: 16, paddingTop: 8 },
  // Device finding (tablet 3-pane, ~290 dp card): the content slot collapsed to one letter per
  // line, so the label keeps its width and the bars flex instead (BANDWIDTH_CHART_SIZE bounds).
  // A plain View, not ListGroup.ItemContent: the kit's `.list-group__item-content { flex: 1 }`
  // makes Yoga resolve an `auto` basis to 0, so a non-growing label slot collapsed to zero width
  // (device finding, dems_phone2 10:15).
  fixedContent: { flexShrink: 0 },
  bandwidthSuffix: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: BANDWIDTH_ROW_METRICS.suffixGap },
  // R-T-3 narrow card: label over bars on the left (taking the room), the readout on the right.
  stackedContent: { flex: 1, minWidth: 0, gap: 4 },
  stackedBars: { flexDirection: 'row' },
  readoutSuffix: { flexShrink: 0, flexDirection: 'row', alignItems: 'center' },
  readout: { alignItems: 'flex-end', minWidth: 78 },
  up: {
    fontFamily: fontFamily.native.mono,
    fontSize: typography.caption.size,
    lineHeight: typography.caption.lineHeight,
    color: palette.gray,
    fontVariant: ['tabular-nums'],
  },
});
