/**
 * Storage at `/storage` (04_mobile_specs §4.13, MB 8; §2.4 "Storage" row; §7.3 "Storage";
 * 05_mobile_plan M-14 part a). Owner: step 85 (P6). The route file renders `<StorageScreen />`; the
 * root stays `SafeScreen id="storage"` (`screen-storage`, 04 §4.0; T-M02, MA-04).
 *
 * Regions, in MB 8 order: T1 header (back + "Storage") · T2 capacity card (donut 20% USED, D28/Q1;
 * "3.2 TB Free" of 4.0 TB; legend; phone KPI strip) · T3 Recent Storage Activity · T4 Manage
 * Storage → sheet (the tab bar is the shell's). Layouts per class (§2.4; brief: tablet = donut and
 * activity side by side):
 *
 * | Class | Layout |
 * |---|---|
 * | compact (phone portrait) | MB 8, one column |
 * | compact-landscape | capacity card \| activity + Manage Storage |
 * | medium, expanded (tablet) | capacity card + 4 KPI tiles \| activity + Manage Storage |
 *
 * Data: the shared simulator only (`useSim`, D19) plus `useAuth()` for the role gate. Motion: the
 * §7.3 beats (`storage-motion.ts`): ring sweep hero, legend stagger, activity rows; no ambient loop.
 * LOW / FULL: colour morph + one pulse + toast + inline Alert (calm escalation).
 */
import { useRouter } from 'expo-router';
import { Button, useToast } from 'heroui-native';
import { ArrowLeft, Layers } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSimActions } from '@dems/shared/sim';
import { derived, fontFamily, palette, spacing, typography } from '@dems/shared/tokens';
import { Pane, PaneLayout, SafeScreen, useLayoutClass, type LayoutClass } from '@/layout';
import { triggerHaptic, useMotionSettings } from '@/motion';
import { newCorrelationId, reportRuntimeIssue, useAuth } from '@/runtime';
import { CapacityCard } from './capacity-card';
import { ManageStorageSheet, type PolicyDraft } from './manage-storage-sheet';
import { PanelBoundary } from './panel-boundary';
import { StorageActivity } from './storage-activity';
import { StorageKpis } from './storage-kpis';
import { STORAGE_BEATS, storageEnter } from './storage-motion';
import { useStoragePolicy } from './use-storage-data';

/**
 * Donut box per class (dp). MB 8's ring is ≈ 118 of the 245 px column; the box adds the glow's fade
 * margin around the ring (`donutGeometry`), so the visible ring is ≈ 0.8 of the box.
 */
export const RING_SIZE: Record<LayoutClass, number> = { compact: 148, 'compact-landscape': 132, medium: 188, expanded: 200 };
/** Flex panes state `width: 'auto'` explicitly, so a pane never inherits a fixed width (S77-9). */
const FLEX_PANE: ViewStyle = { width: 'auto' };

export function StorageScreen() {
  const { layoutClass } = useLayoutClass();
  const tablet = layoutClass === 'medium' || layoutClass === 'expanded';
  const phoneChrome = layoutClass === 'compact' || layoutClass === 'compact-landscape';
  const [manageOpen, setManageOpen] = useState(false);
  const { operator } = useAuth();
  const policy = useStoragePolicy();
  const applyPolicy = useApplyStoragePolicy();
  const openManage = useCallback(() => setManageOpen(true), []);
  const closeManage = useCallback(() => setManageOpen(false), []);

  return (
    <SafeScreen id="storage">
      <StorageHeader withBack={phoneChrome} condensed={layoutClass === 'compact-landscape'} />
      <ScrollView testID="storage-scroll" style={styles.scroll} contentContainerStyle={[styles.content, tablet ? styles.contentTablet : null]}>
        {/* Keyed per class group (S77-9): a tablet ↔ phone arrangement switch remounts the panes. */}
        <StorageBody key={tablet ? 'tablet' : 'phone'} layoutClass={layoutClass} onManage={openManage} />
      </ScrollView>
      <ManageStorageSheet isOpen={manageOpen} onClose={closeManage} role={operator?.role ?? null} policy={policy} onApply={applyPolicy} />
    </SafeScreen>
  );
}

function StorageHeader({ withBack, condensed }: { withBack: boolean; condensed: boolean }) {
  const { t } = useTranslation();
  const router = useRouter();
  const settings = useMotionSettings();
  return (
    <Animated.View
      entering={storageEnter(STORAGE_BEATS.header, settings)}
      testID="storage-header"
      style={[styles.header, condensed ? styles.headerCondensed : null, withBack ? null : styles.headerTablet]}
    >
      {withBack ? (
        <Button
          isIconOnly
          variant="ghost"
          size="md"
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/more'))}
          accessibilityLabel={t('features.storage.header.back')}
          testID="storage-back"
        >
          <ArrowLeft size={22} color={palette.gold} />
        </Button>
      ) : null}
      <Text maxFontSizeMultiplier={1.2} accessibilityRole="header" style={styles.title}>
        {t('features.storage.header.title')}
      </Text>
    </Animated.View>
  );
}

function StorageBody({ layoutClass, onManage }: { layoutClass: LayoutClass; onManage: () => void }) {
  const settings = useMotionSettings();
  const tablet = layoutClass === 'medium' || layoutClass === 'expanded';
  const capacity = (
    <Animated.View entering={storageEnter(STORAGE_BEATS.capacity, settings)}>
      <PanelBoundary name="capacity">
        <CapacityCard ringSize={RING_SIZE[layoutClass]} withKpiStrip={!tablet} />
      </PanelBoundary>
    </Animated.View>
  );
  const kpiTiles = tablet ? (
    <PanelBoundary name="kpis">
      <StorageKpis variant="tiles" />
    </PanelBoundary>
  ) : null;
  const activity = (
    <Animated.View entering={storageEnter(STORAGE_BEATS.activity, settings)}>
      <PanelBoundary name="activity">
        <StorageActivity />
      </PanelBoundary>
    </Animated.View>
  );
  const manage = (
    <Animated.View entering={storageEnter(STORAGE_BEATS.manage, settings)}>
      <ManageStorageButton onPress={onManage} />
    </Animated.View>
  );

  if (layoutClass === 'compact') {
    return (
      <View testID="storage-panes" style={styles.stack}>
        {capacity}
        {activity}
        {manage}
      </View>
    );
  }
  return (
    <PaneLayout testID="storage-panes">
      <Pane name="capacity" flex={1} style={FLEX_PANE}>
        <View style={styles.stack}>
          {capacity}
          {kpiTiles}
        </View>
      </Pane>
      <Pane name="activity" flex={1} style={FLEX_PANE}>
        <View style={styles.stack}>
          {activity}
          {manage}
        </View>
      </Pane>
    </PaneLayout>
  );
}

/** T4: MB 8's gold-edged "Manage Storage" button (`Button variant="outline" size="lg"` + `Layers`). */
function ManageStorageButton({ onPress }: { onPress: () => void }) {
  const { t } = useTranslation();
  return (
    <Button
      testID="storage-manage"
      variant="outline"
      size="lg"
      className="h-14 flex-row gap-3"
      style={styles.manage}
      accessibilityLabel={t('storage.manage.button')}
      accessibilityHint={t('features.storage.manage.a11yHint')}
      onPress={() => {
        triggerHaptic('primaryPress');
        onPress();
      }}
    >
      <Layers size={22} color={palette.gold} />
      <Button.Label className="text-base">{t('storage.manage.button')}</Button.Label>
    </Button>
  );
}

/**
 * Apply → `setStoragePolicy` (simulated, audited by the simulator). Three-layer handling: a success
 * or a friendly failure toast; the failure goes to the runtime log (`dems.mobile.log.v1`) with a
 * correlation id; the sheet stays open on failure so the operator can retry.
 */
function useApplyStoragePolicy(): (draft: PolicyDraft) => boolean {
  const { t } = useTranslation();
  const { toast } = useToast();
  const actions = useSimActions();
  return useCallback(
    (draft: PolicyDraft) => {
      const correlationId = newCorrelationId('storage-policy');
      try {
        actions.setStoragePolicy({ retentionPolicy: draft.retentionPolicy, autoArchive: draft.autoArchive });
        reportRuntimeIssue('info', 'storage.manage.apply', 'Storage policy applied', { ...draft }, correlationId);
        toast.show({ variant: 'success', label: t('storage.manage.applied') });
        return true;
      } catch (error) {
        reportRuntimeIssue('error', 'storage.manage.apply', error, { ...draft }, correlationId);
        toast.show({ variant: 'danger', label: t('storage.manage.failed') });
        return false;
      }
    },
    [actions, toast, t],
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing[1], minHeight: 56, paddingHorizontal: spacing[1] },
  headerCondensed: { minHeight: 48 },
  headerTablet: { minHeight: 64, paddingHorizontal: spacing[4] },
  title: {
    fontFamily: fontFamily.native.semibold,
    fontSize: typography.h2.size,
    lineHeight: typography.h2.lineHeight,
    color: palette.foreground,
  },
  scroll: { flex: 1 },
  content: { paddingHorizontal: spacing[3], paddingBottom: spacing[4], gap: spacing[3] },
  contentTablet: { paddingHorizontal: spacing[4] },
  stack: { gap: spacing[3] },
  manage: { borderColor: palette.gold, backgroundColor: derived.surfaceTertiary },
});
