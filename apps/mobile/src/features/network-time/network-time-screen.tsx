/**
 * Network & Time (04_mobile_specs §4.14, MB 9) at `/network-time`. Owner: step 86 (P6). The route
 * file under `src/app/` renders `<NetworkTimeScreen />`; the root stays `SafeScreen id="network-time"`
 * (testID `screen-network-time`, 04 §4.0; T-M02, MA-04).
 *
 * Regions in MB 9 order: N1 header (back + "Network & Time") · N2 Network Status · N3 Time
 * Synchronization (GNSS / NTP, Last Sync, Time Source, Server; the GNSS → NTP → RTC tier row) ·
 * N4 System Time. Web parity: the page model of implementation/29 (same tier rules, same tones, the
 * same shared copy and toasts).
 *
 * Layouts per class (§2.4 "Network & Time" row; brief: tablet shows network and time side by side):
 *
 * | Class | Layout |
 * |---|---|
 * | compact (phone portrait) | MB 9 single column: Network, Time, System Time |
 * | compact-landscape | Network \| Time + System Time |
 * | medium (tablet portrait) | System Time hero on top, then Network \| Time |
 * | expanded (tablet landscape) | System Time \| Network \| Time (hierarchy with the GNSS orbit) |
 *
 * Motion (§7.3 M-PG-NET): System Time rises first, then the time card with the tier row, then the
 * network card with the bars. Hero moment: the GNSS orbit (the one ambient loop). Data moment: GNSS
 * loss fades the orbit, slides the tier indicator to NTP (`indicator` spring) with one pulse, and
 * raises one warning toast; RTC fallback steps again; recovery says so quietly (P7).
 */
import { useRouter } from 'expo-router';
import { Button } from 'heroui-native';
import { ArrowLeft } from 'lucide-react-native';
import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { fontFamily, palette, spacing, typography } from '@dems/shared/tokens';
import { StatusChip } from '@/components/kit';
import { Pane, PaneLayout, SafeScreen, useLayoutClass, type LayoutClass } from '@/layout';
import { enterRise, useMotionSettings } from '@/motion';
import { CameraClockCard } from '@/features/capture-selector/camera-clock-card';
import { CardBoundary } from './card-boundary';
import { LanSheet } from './lan-sheet';
import { LAN_TONE, TIME_TONE, lanLevel, timeLevel } from './network-time-model';
import { NetworkStatusCard } from './network-status-card';
import { SystemTimeCard } from './system-time-card';
import { TimeSyncCard } from './time-sync-card';
import { useNetworkTimeAlerts, useNetworkView, useTimeEscalationKey, useTimeView } from './use-network-time';

/** Enter order (§7.3): system time, then the time card, then the network card. */
const ENTER = { systemTime: 0, time: 1, network: 2 } as const;

export function NetworkTimeScreen() {
  const { layoutClass } = useLayoutClass();
  const m = useMotionSettings();
  const time = useTimeView();
  const network = useNetworkView();
  const level = timeLevel(time.source);
  const escalationKey = useTimeEscalationKey(level);
  const [lanOpen, setLanOpen] = useState(false);
  useNetworkTimeAlerts();

  const systemTime = (
    <Animated.View entering={enterRise(ENTER.systemTime, m)}>
      <CardBoundary name="system-time">
        <SystemTimeCard synchronized={time.locked} hostClock={time.hostClock} variant={layoutClass === 'medium' ? 'hero' : 'card'} />
      </CardBoundary>
    </Animated.View>
  );
  const timeCard = (
    <Animated.View entering={enterRise(ENTER.time, m)}>
      <CardBoundary name="time">
        <TimeSyncCard time={time} escalationKey={escalationKey} />
      </CardBoundary>
      {/* Task 3 row 68 (MB-10): camera clock offsets (op 57), in their own boundary. */}
      <View style={styles.cameraClocks}>
        <CardBoundary name="camera-clocks">
          <CameraClockCard />
        </CardBoundary>
      </View>
    </Animated.View>
  );
  const networkCard = (
    <Animated.View entering={enterRise(ENTER.network, m)}>
      <CardBoundary name="network">
        <NetworkStatusCard network={network} onOpenLan={() => setLanOpen(true)} />
      </CardBoundary>
    </Animated.View>
  );

  return (
    <SafeScreen id="network-time">
      <Header layoutClass={layoutClass} />
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} testID="network-time-scroll">
        <Body layoutClass={layoutClass} systemTime={systemTime} timeCard={timeCard} networkCard={networkCard} />
      </ScrollView>
      <LanSheet isOpen={lanOpen} onClose={() => setLanOpen(false)} network={network} />
    </SafeScreen>
  );
}

interface BodyProps {
  layoutClass: LayoutClass;
  systemTime: ReactNode;
  timeCard: ReactNode;
  networkCard: ReactNode;
}

function Body({ layoutClass, systemTime, timeCard, networkCard }: BodyProps) {
  switch (layoutClass) {
    case 'compact-landscape':
      return (
        <PaneLayout testID="network-time-panes" stackOn={[]} style={styles.panes}>
          <Pane name="network">{networkCard}</Pane>
          <Pane name="time" style={styles.column}>
            {timeCard}
            {systemTime}
          </Pane>
        </PaneLayout>
      );
    case 'medium':
      return (
        <View style={styles.column}>
          {systemTime}
          <PaneLayout testID="network-time-panes" stackOn={[]} style={styles.panes}>
            <Pane name="network">{networkCard}</Pane>
            <Pane name="time">{timeCard}</Pane>
          </PaneLayout>
        </View>
      );
    case 'expanded':
      return (
        <PaneLayout testID="network-time-panes" stackOn={[]} style={styles.panes}>
          <Pane name="system-time">{systemTime}</Pane>
          <Pane name="network">{networkCard}</Pane>
          <Pane name="time">{timeCard}</Pane>
        </PaneLayout>
      );
    default:
      // compact: MB 9 order.
      return (
        <View style={styles.column}>
          {networkCard}
          {timeCard}
          {systemTime}
        </View>
      );
  }
}

/**
 * N1: back arrow (gold) + "Network & Time" on phones (MB 9; the screen is reached from More); on
 * tablets the rail is the navigation, so the 64 dp header carries the title plus the time and LAN
 * status chips instead (§2.3 "Header").
 */
function Header({ layoutClass }: { layoutClass: LayoutClass }) {
  const { t } = useTranslation();
  const router = useRouter();
  const time = useTimeView();
  const network = useNetworkView();
  const title = (
    <Text maxFontSizeMultiplier={1.2} accessibilityRole="header" style={styles.headerTitle}>
      {t('features.network-time.header.title')}
    </Text>
  );
  if (layoutClass === 'medium' || layoutClass === 'expanded') {
    const level = timeLevel(time.source);
    const lan = lanLevel(network.linkUp);
    return (
      <View style={styles.tabletHeader} testID="network-time-header">
        <View style={styles.flex}>{title}</View>
        <View style={styles.headerChips}>
          <StatusChip testID="network-time-header-time" size="sm" tone={time.hostClock ? 'default' : TIME_TONE[level]} label={time.hostClock ? t('common.hostClockTime.value') : t(`networkTime.bannerState.time.${level}`)} icon="Circle" iconFilled />
          <StatusChip testID="network-time-header-lan" size="sm" tone={LAN_TONE[lan]} label={t(`networkTime.bannerState.network.${lan}`)} icon="Circle" iconFilled />
        </View>
      </View>
    );
  }
  return (
    <View style={[styles.header, layoutClass === 'compact-landscape' ? styles.headerCondensed : null]} testID="network-time-header">
      <Button
        isIconOnly
        variant="ghost"
        size="md"
        onPress={() => (router.canGoBack() ? router.back() : router.replace('/more'))}
        accessibilityLabel={t('features.network-time.header.back')}
        testID="network-time-back"
      >
        <ArrowLeft size={22} color={palette.gold} />
      </Button>
      {title}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  cameraClocks: { marginTop: spacing[3] },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing[1], minHeight: 56, paddingHorizontal: spacing[1] },
  headerCondensed: { minHeight: 48 },
  tabletHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], minHeight: 64, paddingHorizontal: spacing[3] },
  headerChips: { flexDirection: 'row', alignItems: 'center', gap: spacing[1] },
  headerTitle: {
    fontFamily: fontFamily.native.semibold,
    fontSize: typography.h2.size,
    lineHeight: typography.h2.lineHeight,
    color: palette.foreground,
  },
  scroll: { flex: 1 },
  content: { paddingHorizontal: spacing[3], paddingBottom: spacing[4], gap: spacing[3] },
  column: { gap: spacing[3] },
  panes: { flex: 0 },
});
