/**
 * Console launcher (04_mobile_specs §4.17 `ListGroup` "Storage, Network & Time, Audit, Settings"):
 * on phones these four tab routes have no visible trigger (H-MB-01), so More is their entrance.
 * Each is a pressable tile in the panel language (warm L2 surface, bronze hairline, gold icon
 * badge, chevron) with one live line from the simulator and a soft status chip:
 *
 * | Tile | Live line | Chip |
 * |---|---|---|
 * | Storage | used % (C-6 RollingNumber `slide`) | Healthy / Low / Full |
 * | Network & Time | time source + LAN state | Synchronized / Attention |
 * | Audit | audit event count | Chain OK / Discontinuity |
 * | Settings | its sections | section count |
 *
 * Two columns on a phone in portrait, four in phone landscape. Tiles enter on the R1 stagger
 * (`enterRise`, 80 + i × 60 ms, `gentle` spring; reduced motion: a 160 ms fade, no stagger).
 */
import { PressableFeedback, Surface } from 'heroui-native';
import { ChevronRight, type LucideIcon } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSim } from '@dems/shared/sim';
import { derived, fontFamily, palette, typography, type StatusTone } from '@dems/shared/tokens';
import { RollingNumber } from '@/components/composed/rolling-number';
import { StatusChip } from '@/components/kit';
import { enterRise, useMotionPolicy, useMotionSettings } from '@/motion';
import { SETTINGS_SECTIONS } from '@/navigation/params';
import { TAB_DESTINATIONS } from '@/navigation/routes';
import {
  CONSOLE_DESTINATIONS,
  chainTone,
  networkTimeTone,
  selectAuditCount,
  selectChainBroken,
  selectLinkUp,
  selectStorageState,
  selectTimeLocked,
  selectTimeSource,
  selectUsedPercent,
  storageTone,
  type ConsoleDestination,
} from './more-model';
import { useMoreNavigate } from './use-more-navigate';

export interface ConsoleTilesProps {
  columns: 2 | 4;
  /** Stagger slot of the first tile (the sections above it take the earlier slots). */
  firstSlot: number;
}

export function ConsoleTiles({ columns, firstSlot }: ConsoleTilesProps) {
  const { t } = useTranslation();
  const rows: ConsoleDestination[][] = [];
  for (let i = 0; i < CONSOLE_DESTINATIONS.length; i += columns) rows.push(CONSOLE_DESTINATIONS.slice(i, i + columns));

  return (
    <View testID="more-console" style={styles.grid}>
      <Text accessibilityRole="header" maxFontSizeMultiplier={1.2} style={styles.sectionTitle}>
        {t('features.more.console.title')}
      </Text>
      {rows.map((row, r) => (
        <View key={row.join('-')} testID={`more-console-row-${r}`} style={styles.row}>
          {row.map((name, c) => (
            <ConsoleTile key={name} name={name} slot={firstSlot + r * columns + c} />
          ))}
        </View>
      ))}
    </View>
  );
}

interface TileView {
  /** Plain-text detail for the accessibility label. */
  detail: string;
  /** Visible detail (may hold a RollingNumber). */
  body: ReactNode;
  tone: StatusTone;
  chip: string;
}

function ConsoleTile({ name, slot }: { name: ConsoleDestination; slot: number }) {
  const { t } = useTranslation();
  const settings = useMotionSettings();
  const navigate = useMoreNavigate();
  const destination = TAB_DESTINATIONS[name];
  const Icon: LucideIcon = destination.icon;
  const title = t(destination.labelKey);
  const view = useTileView(name);

  return (
    <Animated.View entering={enterRise(slot, settings)} style={styles.cell}>
      <PressableFeedback
        testID={`more-dest-${name}`}
        accessibilityRole="button"
        accessibilityLabel={`${title}, ${view.detail}, ${view.chip}`}
        accessibilityHint={t('features.more.console.openHint', { name: title })}
        onPress={() => navigate(destination.href as `/${ConsoleDestination}`, { tabJump: true })}
        style={styles.fill}
      >
        <Surface variant="default" style={styles.tile}>
          <View style={styles.head}>
            <View style={styles.badge}>
              <Icon size={20} color={palette.gold} />
            </View>
            <ChevronRight size={18} color={palette.gray} />
          </View>
          <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85} maxFontSizeMultiplier={1.2} style={styles.title}>
            {title}
          </Text>
          <View testID={`more-dest-${name}-detail`} style={styles.detail}>
            {view.body}
          </View>
          <StatusChip testID={`more-dest-${name}-chip`} tone={view.tone} label={view.chip} icon={null} size="sm" className="self-start" />
        </Surface>
      </PressableFeedback>
    </Animated.View>
  );
}

/** The live line and chip of one tile (flat simulator selectors, one primitive each). */
function useTileView(name: ConsoleDestination): TileView {
  const { t } = useTranslation();
  const policy = useMotionPolicy();
  const usedPercent = useSim(selectUsedPercent);
  const storageState = useSim(selectStorageState);
  const timeSource = useSim(selectTimeSource);
  const timeLocked = useSim(selectTimeLocked);
  const linkUp = useSim(selectLinkUp);
  const auditCount = useSim(selectAuditCount);
  const chainBroken = useSim(selectChainBroken);

  switch (name) {
    case 'storage': {
      const detail = t('features.more.console.storage.detail', { percent: usedPercent });
      return {
        detail,
        body: (
          <View style={styles.valueRow}>
            <RollingNumber
              testID="more-dest-storage-value"
              value={usedPercent}
              mode="slide"
              motion={policy}
              size="h3"
              face="sans"
              color={palette.foreground}
              suffix="%"
              accessibilityLabel={`${usedPercent}%`}
            />
            <Text maxFontSizeMultiplier={1.2} style={styles.unit}>
              {t('features.more.console.storage.used')}
            </Text>
          </View>
        ),
        tone: storageTone(storageState),
        chip: t(`features.more.console.storage.state.${storageState}`),
      };
    }
    case 'network-time': {
      const source = t(`common.enums.timeSource.${timeSource}`);
      const lan = t(linkUp ? 'features.more.console.networkTime.lanUp' : 'features.more.console.networkTime.lanDown');
      const healthy = linkUp && timeLocked;
      const detail = `${t('features.more.console.networkTime.detail', { source })} · ${lan}`;
      return {
        detail,
        body: <DetailLines first={t('features.more.console.networkTime.detail', { source })} second={lan} />,
        tone: networkTimeTone(linkUp, timeLocked),
        chip: t(healthy ? 'features.more.console.networkTime.synced' : 'features.more.console.networkTime.attention'),
      };
    }
    case 'audit': {
      const detail = t('features.more.console.audit.detail', { count: auditCount });
      return {
        detail,
        body: <DetailLines first={detail} />,
        tone: chainTone(chainBroken),
        chip: t(chainBroken ? 'features.more.console.audit.chainBroken' : 'features.more.console.audit.chainOk'),
      };
    }
    case 'settings': {
      const detail = t('features.more.console.settings.detail');
      return {
        detail,
        body: <DetailLines first={detail} />,
        tone: 'default',
        chip: t('features.more.console.settings.sections', { count: SETTINGS_SECTIONS.length }),
      };
    }
  }
}

function DetailLines({ first, second }: { first: string; second?: string }) {
  return (
    <>
      <Text numberOfLines={1} maxFontSizeMultiplier={1.2} style={styles.detailText}>
        {first}
      </Text>
      {second ? (
        <Text numberOfLines={1} maxFontSizeMultiplier={1.2} style={styles.detailMuted}>
          {second}
        </Text>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  grid: { gap: 12 },
  sectionTitle: {
    fontFamily: fontFamily.native.medium,
    fontSize: typography.label.size,
    lineHeight: typography.label.lineHeight,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: palette.gray,
    paddingHorizontal: 4,
  },
  row: { flexDirection: 'row', gap: 12 },
  cell: { flex: 1, minWidth: 0 },
  fill: { flex: 1 },
  tile: {
    flex: 1,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: derived.border,
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 8,
  },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  badge: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: derived.surfaceTertiary,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: derived.border,
  },
  title: {
    marginTop: 4,
    fontFamily: fontFamily.native.semibold,
    fontSize: typography.h3.size,
    lineHeight: typography.h3.lineHeight,
    color: palette.foreground,
  },
  detail: { minHeight: 36, justifyContent: 'center' },
  valueRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  unit: {
    fontFamily: fontFamily.native.medium,
    fontSize: typography.label.size,
    lineHeight: typography.label.lineHeight,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: palette.gray,
  },
  detailText: {
    fontFamily: fontFamily.native.normal,
    fontSize: typography.caption.size,
    lineHeight: typography.caption.lineHeight,
    color: derived.foreground2,
  },
  detailMuted: {
    fontFamily: fontFamily.native.normal,
    fontSize: typography.caption.size,
    lineHeight: typography.caption.lineHeight,
    color: palette.gray,
  },
});
