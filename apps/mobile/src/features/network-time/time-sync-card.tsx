/**
 * N3 Time Synchronization (04_mobile_specs §4.14; MB 9 (945–1190, 790–900)): a `SectionCard` with
 *
 * - the GNSS / NTP row: the GNSS icon inside the Skia orbit (while locked), the sync `StatusChip`
 *   ("Synchronized", "NTP fallback" or "RTC holdover", warning for both fallbacks, P7) and the
 *   display zone caption "UTC+07:00" (D28/Q2) from the shared arithmetic formatter;
 * - Last Sync (UTC+07:00 date-time, shared `formatDate`), Time Source ("GPS (GNSS Stratum-1)" while
 *   GNSS disciplines the clock) and Server (the NTP server);
 * - the hierarchy row GNSS → NTP → RTC with the moving `time-tier` indicator.
 *
 * Closing-fix CF2-B, defect RF-T-5 (decision D227): in the tablet's third pane (row about 290 dp) the
 * values had one line: "Last Sync" drew only "6 Oct 2026" of "6 Oct 2026 16:46:47" and "Time Source"
 * ended "GPS (GNSS Str…". The values now have no line cap and wrap between words, right-aligned
 * ("6 Oct 2026" over "16:46:47"); where they fit (the phone) they stay on one line.
 */
import { ListGroup, Separator } from 'heroui-native';
import { Clock, Satellite, Server, type LucideIcon } from 'lucide-react-native';
import { Fragment } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { DATE_PATTERNS, formatDate, formatUtcOffset } from '@dems/shared/realtime';
import { fontFamily, palette, toneTextHex, typography } from '@dems/shared/tokens';
import { SectionCard, StatusChip } from '@/components/kit';
import { GnssOrbit, ORBIT_SIZE } from './gnss-orbit';
import { ICON_TILE_SIZE, IconTile } from './icon-tile';
import { TIME_TONE, timeLevel, type TimeView } from './network-time-model';
import { TierRow } from './tier-row';

export interface TimeSyncCardProps {
  time: TimeView;
  escalationKey: number;
}

interface FactRow {
  id: string;
  icon: LucideIcon;
  label: string;
  value: string;
  mono?: boolean;
}

export function TimeSyncCard({ time, escalationKey }: TimeSyncCardProps) {
  const { t } = useTranslation();
  const level = timeLevel(time.source);
  const tone = TIME_TONE[level];
  const zone = t('networkTime.systemTime.zone', { offset: formatUtcOffset() });
  // Closing pass J (G75b-06): a host system clock is no lost synchronisation. One row names the clock, one
  // sentence says what does not exist; no orbit ("no fix"), no last sync, no server, no tier row.
  if (time.hostClock) {
    const value = t('common.hostClockTime.value');
    return (
      <SectionCard testID="network-time-time" title={t('features.network-time.time.title')}>
        <ListGroup variant="transparent" className="rounded-xl">
          <ListGroup.Item testID="network-time-sync" accessible accessibilityLabel={`${t('common.hostClockTime.label')}, ${value}, ${zone}`} className="gap-3 py-2">
            <ListGroup.ItemPrefix>
              <IconTile icon={Clock} tone="default" />
            </ListGroup.ItemPrefix>
            <ListGroup.ItemContent>
              <Text maxFontSizeMultiplier={1.2} numberOfLines={1} style={styles.rowTitle}>
                {t('common.hostClockTime.label')}
              </Text>
            </ListGroup.ItemContent>
            <ListGroup.ItemSuffix style={styles.syncSuffix}>
              <StatusChip testID="network-time-sync-chip" tone="default" label={value} icon="Circle" iconFilled size="sm" />
              <Text testID="network-time-zone" maxFontSizeMultiplier={1.2} style={[styles.zone, { color: toneTextHex.default }]}>
                {zone}
              </Text>
            </ListGroup.ItemSuffix>
          </ListGroup.Item>
        </ListGroup>
        <Text testID="network-time-host-clock" maxFontSizeMultiplier={1.2} style={styles.factLabel}>
          {t('common.hostClockTime.notice')}
        </Text>
      </SectionCard>
    );
  }
  const stateLabel = t(`networkTime.bannerState.time.${level}`);
  const facts: FactRow[] = [
    {
      id: 'last-sync',
      icon: Clock,
      label: t('features.network-time.time.lastSync'),
      value: formatDate(time.lastSyncAt, DATE_PATTERNS.dateTime),
      mono: true,
    },
    {
      id: 'source',
      icon: Satellite,
      label: t('features.network-time.time.timeSource'),
      value: t(`features.network-time.time.sourceValue.${time.source}`, { stratum: time.stratum }),
    },
    { id: 'server', icon: Server, label: t('features.network-time.time.server'), value: time.ntpServer, mono: true },
  ];

  return (
    <SectionCard testID="network-time-time" title={t('features.network-time.time.title')}>
      <ListGroup variant="transparent" className="rounded-xl">
        <ListGroup.Item
          testID="network-time-sync"
          accessible
          accessibilityLabel={`${t('features.network-time.time.gnssNtp')}, ${stateLabel}, ${zone}. ${
            time.gnssLocked
              ? t('features.network-time.time.orbitLabel', { satellites: time.satellites })
              : t('features.network-time.time.orbitLost')
          }`}
          className="gap-3 py-2"
        >
          <ListGroup.ItemPrefix>
            <IconTile icon={Satellite} tone={time.gnssLocked ? 'success' : 'warning'}>
              <GnssOrbit
                testID="network-time-orbit"
                locked={time.gnssLocked}
                satellites={time.satellites}
                style={{ left: (ICON_TILE_SIZE - ORBIT_SIZE) / 2, top: (ICON_TILE_SIZE - ORBIT_SIZE) / 2 }}
              />
            </IconTile>
          </ListGroup.ItemPrefix>
          <ListGroup.ItemContent>
            <Text maxFontSizeMultiplier={1.2} numberOfLines={1} style={styles.rowTitle}>
              {t('features.network-time.time.gnssNtp')}
            </Text>
          </ListGroup.ItemContent>
          <ListGroup.ItemSuffix style={styles.syncSuffix}>
            <StatusChip testID="network-time-sync-chip" tone={tone} label={stateLabel} icon="Circle" iconFilled size="sm" />
            <Text testID="network-time-zone" maxFontSizeMultiplier={1.2} style={[styles.zone, { color: toneTextHex[tone] }]}>
              {zone}
            </Text>
          </ListGroup.ItemSuffix>
        </ListGroup.Item>
        {facts.map((row) => (
          <Fragment key={row.id}>
            <Separator />
            <ListGroup.Item
              testID={`network-time-${row.id}`}
              accessible
              accessibilityLabel={`${row.label}, ${row.value}`}
              className="gap-3 py-2"
            >
              <ListGroup.ItemPrefix style={styles.factIcon}>
                <row.icon size={16} color={palette.gray} />
              </ListGroup.ItemPrefix>
              <View style={styles.fixedContent}>
                <Text maxFontSizeMultiplier={1.2} numberOfLines={1} style={styles.factLabel}>
                  {row.label}
                </Text>
              </View>
              <ListGroup.ItemSuffix style={styles.factSuffix}>
                {/* CF2-B (RF-T-5): no line cap; a value too wide for the card wraps between words. */}
                <Text
                  maxFontSizeMultiplier={1.2}
                  selectable={row.mono}
                  testID={`network-time-${row.id}-value`}
                  style={[styles.factValue, row.mono ? styles.mono : null]}
                >
                  {row.value}
                </Text>
              </ListGroup.ItemSuffix>
            </ListGroup.Item>
          </Fragment>
        ))}
      </ListGroup>
      <View style={styles.hierarchy}>
        <Text maxFontSizeMultiplier={1.2} style={styles.hierarchyTitle}>
          {t('features.network-time.time.hierarchy')}
        </Text>
        <TierRow source={time.source} gnssLocked={time.gnssLocked} ntpReachable={time.ntpReachable} escalationKey={escalationKey} />
      </View>
    </SectionCard>
  );
}

const styles = StyleSheet.create({
  rowTitle: {
    fontFamily: fontFamily.native.medium,
    fontSize: typography.body.size,
    lineHeight: typography.body.lineHeight,
    color: palette.foreground,
  },
  syncSuffix: { alignItems: 'flex-end', gap: 2 },
  zone: { fontFamily: fontFamily.native.monoMedium, fontSize: typography.data.size, lineHeight: typography.data.lineHeight },
  factIcon: { width: 36, alignItems: 'center' },
  factLabel: {
    fontFamily: fontFamily.native.normal,
    fontSize: typography.body.size,
    lineHeight: typography.body.lineHeight,
    color: palette.gray,
  },
  // A plain View, not ListGroup.ItemContent: the kit's `.list-group__item-content { flex: 1 }`
  // makes Yoga resolve an `auto` basis to 0, so a non-growing label slot collapsed to zero width
  // (device finding, dems_phone2 10:15).
  fixedContent: { flexShrink: 0 },
  factSuffix: { flex: 1, alignItems: 'flex-end' },
  factValue: {
    fontFamily: fontFamily.native.medium,
    fontSize: typography.body.size,
    lineHeight: typography.body.lineHeight,
    color: palette.foreground,
    flexShrink: 1,
    textAlign: 'right',
  },
  mono: { fontFamily: fontFamily.native.mono, fontSize: 13 },
  hierarchy: { gap: 6 },
  hierarchyTitle: {
    fontFamily: fontFamily.native.medium,
    fontSize: typography.label.size,
    lineHeight: typography.label.lineHeight,
    letterSpacing: typography.label.letterSpacing * typography.label.size,
    textTransform: 'uppercase',
    color: palette.gray,
  },
});
