/**
 * Home (Dashboard) at `/home` (04_mobile_specs §4.3, MB 2; §2.4 "Home" row; §7.3 "Home";
 * 05_mobile_plan M-08). Owner: step 77 (P6). The route file `src/app/(app)/(tabs)/home.tsx` renders
 * `<DashboardScreen />`; the root stays `SafeScreen id="home"` (`screen-home`, T-M02, MA-04).
 *
 * Regions, in MB 2 order: H1 header · H2 System Status · H3 status tiles · H4 Quick Actions ·
 * H5 Recent Sessions (H6, the tab bar, is the shell's). Layouts per class (§2.4):
 *
 * | Class | Layout |
 * |---|---|
 * | compact (phone portrait) | MB 2, one column |
 * | compact-landscape | 2 columns: status, tiles, actions \| recent sessions |
 * | medium (tablet portrait) | 2 columns, 5 \| 3 of 8: GlowRing hero + status + tiles \| actions + recent |
 * | expanded (tablet landscape) | 3 zones: GlowRing hero + status + chip row \| device tiles 2x2 \| recent + actions |
 *
 * Data: the shared simulator only (`useSim`, D19); the operator from `useAuth()`. Motion: the §7.3
 * beats (`home-motion.ts`) with the ring sweep last; loops stop off-focus and under reduced motion.
 * A new seal while Home is open shows a success toast and ticks the sealed-today count (§7.3).
 */
import { useIsFocused } from 'expo-router';
import { useToast } from 'heroui-native';
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { BackHandler, ScrollView, StyleSheet, View, type ViewStyle } from 'react-native';
import { useSim, type SimState } from '@dems/shared/sim';
import { Pane, PaneLayout, SafeScreen, useLayoutClass, type LayoutClass } from '@/layout';
import { DeviceTiles } from './device-tiles';
import { HomeHeader } from './home-header';
import { PanelBoundary } from './panel-boundary';
import { QuickActions } from './quick-actions';
import { RecentSessions } from './recent-sessions';
import { StatusChipRow } from './status-chip-row';
import { StatusTiles } from './status-tiles';
import { SystemStatusCard } from './system-status-card';
import { useHomeStatus, useHomeTiles, usePrimaryAction, useRecentRows, useSealedToday } from './use-home-data';

/** Hero ring size per class (GlowRing `hero` clamps to 240–340; 04 §4.3 "hero (280 dp)"). */
const HERO_SIZE: Partial<Record<LayoutClass, number>> = { medium: 280, expanded: 256 };
/** Fixed widths of the expanded side zones (dp); the device zone takes the rest. */
const EXPANDED_ZONES = { status: 320, activity: 300 } as const;
/** Flex panes state `width: 'auto'` explicitly, so a pane never inherits a fixed width (S77-9). */
const FLEX_PANE: ViewStyle = { width: 'auto' };

export function DashboardScreen() {
  const { layoutClass } = useLayoutClass();
  useNewSealToast();
  useLeaveAppGuard();
  const tablet = layoutClass === 'medium' || layoutClass === 'expanded';

  return (
    <SafeScreen id="home">
      <HomeScreenHeader layoutClass={layoutClass} />
      <ScrollView
        testID="home-scroll"
        style={styles.scroll}
        contentContainerStyle={[styles.content, tablet ? styles.contentTablet : null]}
      >
        {/*
         * Keyed per tablet class (S77-9): switching between the medium and expanded arrangements
         * remounts the panes. Re-using them left stale geometry on the device (the status pane kept
         * its expanded size inside the medium flex row: 520 | 120 dp instead of 5 | 3, even with
         * `width: 'auto'`), from the panes' re-flow transition. Phone rotations keep one tree.
         */}
        <HomeBody key={tablet ? layoutClass : 'phone'} layoutClass={layoutClass} />
      </ScrollView>
    </SafeScreen>
  );
}

function HomeScreenHeader({ layoutClass }: { layoutClass: LayoutClass }) {
  const status = useHomeStatus();
  return <HomeHeader layoutClass={layoutClass} status={status} />;
}

function HomeBody({ layoutClass }: { layoutClass: LayoutClass }) {
  const status = useHomeStatus();
  const tiles = useHomeTiles();
  const action = usePrimaryAction();
  const rows = useRecentRows();

  switch (layoutClass) {
    case 'compact':
    case 'compact-landscape':
      return (
        <PaneLayout testID="home-panes">
          <Pane name="status" flex={1} style={FLEX_PANE}>
            <View style={styles.stack}>
              <PanelBoundary name="status">
                <SystemStatusCard status={status} variant="card" />
              </PanelBoundary>
              <PanelBoundary name="tiles">
                <StatusTiles tiles={tiles} />
              </PanelBoundary>
              {layoutClass === 'compact-landscape' ? (
                <PanelBoundary name="actions">
                  <QuickActions action={action} status={status} />
                </PanelBoundary>
              ) : null}
            </View>
          </Pane>
          <Pane name="activity" flex={1} style={FLEX_PANE}>
            <View style={styles.stack}>
              {layoutClass === 'compact' ? (
                <PanelBoundary name="actions">
                  <QuickActions action={action} status={status} />
                </PanelBoundary>
              ) : null}
              <PanelBoundary name="recent">
                <RecentSessions rows={rows} />
              </PanelBoundary>
            </View>
          </Pane>
        </PaneLayout>
      );
    case 'medium':
      return (
        <PaneLayout testID="home-panes">
          <Pane name="status" flex={5} style={FLEX_PANE}>
            <View style={styles.stack}>
              <PanelBoundary name="status">
                <SystemStatusCard status={status} variant="hero" heroSize={HERO_SIZE.medium} />
              </PanelBoundary>
              <PanelBoundary name="tiles">
                <StatusTiles tiles={tiles} />
              </PanelBoundary>
            </View>
          </Pane>
          <Pane name="activity" flex={3} style={FLEX_PANE}>
            <View style={styles.stack}>
              <PanelBoundary name="actions">
                <QuickActions action={action} status={status} stacked />
              </PanelBoundary>
              <PanelBoundary name="recent">
                <RecentSessions rows={rows} chipBelow showSealedToday />
              </PanelBoundary>
            </View>
          </Pane>
        </PaneLayout>
      );
    case 'expanded':
      return (
        <PaneLayout testID="home-panes">
          <Pane name="status" width={EXPANDED_ZONES.status}>
            <View style={styles.stack}>
              <PanelBoundary name="status">
                <SystemStatusCard status={status} variant="hero" heroSize={HERO_SIZE.expanded} />
              </PanelBoundary>
              <PanelBoundary name="chips">
                <StatusChipRow withStorage />
              </PanelBoundary>
            </View>
          </Pane>
          <Pane name="devices" flex={1} minWidth={320} style={FLEX_PANE}>
            <PanelBoundary name="devices">
              <DeviceTiles live={status.live} />
            </PanelBoundary>
          </Pane>
          <Pane name="activity" width={EXPANDED_ZONES.activity}>
            <View style={styles.stack}>
              <PanelBoundary name="recent">
                <RecentSessions rows={rows} chipBelow showSealedToday />
              </PanelBoundary>
              <PanelBoundary name="actions">
                <QuickActions action={action} status={status} stacked />
              </PanelBoundary>
            </View>
          </Pane>
        </PaneLayout>
      );
  }
}

/** The newest sealed evidence id (stable string; a new seal changes it). */
function newestSealedId(s: SimState): string | null {
  let best: { id: string; at: number } | null = null;
  for (const item of s.evidence) {
    if (item.sealedAt !== null && (best === null || item.sealedAt > best.at)) best = { id: item.id, at: item.sealedAt };
  }
  return best?.id ?? null;
}

/**
 * §7.3 data moment "new seal: toast + count tick": while Home is focused, a count increase of the
 * sealed-today items shows one success toast naming the new evidence item.
 */
function useNewSealToast(): void {
  const { t } = useTranslation();
  const { toast } = useToast();
  const focused = useIsFocused();
  const count = useSealedToday();
  const newest = useSim(newestSealedId);
  const seen = useRef(count);

  useEffect(() => {
    const previous = seen.current;
    seen.current = count;
    if (!focused || count <= previous || newest === null) return;
    toast.show({ variant: 'success', label: t('dashboard.sealedToday.newSeal', { evidenceId: newest }) });
  }, [count, newest, focused, toast, t]);
}

/** How long the "press Back again" answer stands. */
export const LEAVE_APP_WINDOW_MS = 2_500;

/**
 * Fix wave J (JT-19): Android Back on Home left the app without a word (and the operator found Login on the
 * way back). Home is the root: the first Back answers "Press Back again to leave DEMS" and stays; a second
 * Back within the window leaves as before. Only while Home is the screen in view; a popover or a menu that is
 * open takes the Back first (the kit registers its handler later, so it runs before this one).
 */
function useLeaveAppGuard(): void {
  const { t } = useTranslation();
  const { toast } = useToast();
  const focused = useIsFocused();
  const armedAt = useRef(0);
  const toastRef = useRef(toast);
  useEffect(() => {
    toastRef.current = toast;
  }, [toast]);
  useEffect(() => {
    if (!focused) return undefined;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      const now = Date.now();
      if (now - armedAt.current < LEAVE_APP_WINDOW_MS) return false;
      armedAt.current = now;
      toastRef.current.show({ id: 'home-leave-app', variant: 'default', label: t('features.dashboard.leaveApp'), duration: LEAVE_APP_WINDOW_MS });
      return true;
    });
    return () => subscription.remove();
  }, [focused, t]);
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 16, flexGrow: 1 },
  contentTablet: { paddingHorizontal: 24, paddingTop: 4, paddingBottom: 24 },
  stack: { gap: 12 },
});
