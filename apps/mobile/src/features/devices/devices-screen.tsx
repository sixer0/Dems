/**
 * Devices & Inputs (04_mobile_specs §4.12, MB 7) at `/devices`. Owner: step 84 (P6). The route file
 * `src/app/(app)/(tabs)/devices/index.tsx` renders `<DevicesScreen selectedId />` and parses
 * `?selected=`; the root stays `SafeScreen id="devices"` (`screen-devices`, T-M02, MA-04).
 *
 * Regions in MB 7 order: V1 header (icon + "Devices & Inputs") · V2 Camera Devices · V3 Audio
 * Inputs · V4 Other Devices; each row has a chevron to its detail (V5). When a device needs
 * attention a calm `Alert` sits under the header (one fade-in, no loop; 03M P7).
 *
 * Layouts per class (§2.4 "Devices" row, §2.5 rule 3):
 *
 * | Class | Layout |
 * |---|---|
 * | compact (phone portrait) | MB 7 list; a row pushes `/devices/<id>` |
 * | compact-landscape | the sections in 2 columns; a row pushes the detail |
 * | medium (tablet portrait) | `pane-list` 360 dp \| `pane-detail` |
 * | expanded (tablet landscape) | `pane-list` 40% \| `pane-detail` 60% |
 *
 * On multi-pane windows the selection lives in `?selected=` (the route hands a deep-linked detail
 * over to it), so rotation and split-screen keep it (MA-13). Mic rows carry a `compact` meter there.
 */
import { useRouter, type Href } from 'expo-router';
import { Alert, ListGroup, Separator, SkeletonGroup } from 'heroui-native';
import { Boxes } from 'lucide-react-native';
import { Fragment, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { fontFamily, palette, spacing, typography } from '@dems/shared/tokens';
import { SectionCard } from '@/components/kit';
import { Pane, PaneLayout, SafeScreen, useLayoutClass } from '@/layout';
import { enterRise, rowReveal, useMotionSettings } from '@/motion';
import { useRuntimeStatus } from '@/runtime';
import { DeviceDetail } from './device-detail';
import { DeviceRow } from './device-row';
import { DEVICE_SHORT_NAME_KEY, SECTIONS, STATUS_LABEL_KEY, STATUS_RANK, attentionDevices, type DeviceId, type DeviceSection, type DeviceStatus } from './devices-model';
import { useDeviceStatuses } from './use-devices-data';

export interface DevicesScreenProps {
  /** Device selected with `?selected=` (the detail pane on medium and expanded, 04 §2.4), or null. */
  readonly selectedId: string | null;
}

/** Medium: a 360 dp list; expanded: list 40% | detail 60% (04 §2.4). */
const MEDIUM_LIST_WIDTH = 360;

export function DevicesScreen({ selectedId }: DevicesScreenProps) {
  const router = useRouter();
  const { layoutClass, isMultiPane } = useLayoutClass();

  const select = useCallback(
    (id: DeviceId) => {
      if (isMultiPane) router.setParams({ selected: id });
      else router.push(`/devices/${id}` as Href);
    },
    [isMultiPane, router],
  );

  const list = <DevicesList selectedId={isMultiPane ? selectedId : null} twoColumns={layoutClass === 'compact-landscape'} onSelect={select} />;

  return (
    <SafeScreen id="devices">
      {isMultiPane ? (
        <PaneLayout testID="devices-panes" style={styles.panes}>
          <Pane name="list" {...(layoutClass === 'medium' ? { width: MEDIUM_LIST_WIDTH } : { flex: 2, style: styles.flexBasisZero })}>
            {list}
          </Pane>
          <Pane name="detail" flex={3} style={styles.flexBasisZero}>
            {selectedId ? <DeviceDetail key={selectedId} deviceId={selectedId} variant="pane" /> : <DetailPlaceholder />}
          </Pane>
        </PaneLayout>
      ) : (
        list
      )}
    </SafeScreen>
  );
}

interface DevicesListProps {
  selectedId: string | null;
  twoColumns: boolean;
  onSelect: (id: DeviceId) => void;
}

function DevicesList({ selectedId, twoColumns, onSelect }: DevicesListProps) {
  const { t } = useTranslation();
  const m = useMotionSettings();
  const status = useRuntimeStatus();
  const statuses = useDeviceStatuses();
  const { isMultiPane } = useLayoutClass();
  const attention = attentionDevices(statuses);

  const section = (id: DeviceSection, index: number) => {
    const spec = SECTIONS.find((entry) => entry.id === id)!;
    return (
      <Animated.View key={id} entering={enterRise(index + 1, m)}>
        <SectionCard title={t(spec.titleKey)} testID={`devices-section-${id}`}>
          <ListGroup variant="transparent">
            {spec.devices.map((deviceId, row) => (
              <Fragment key={deviceId}>
                {row > 0 ? <Separator /> : null}
                <Animated.View entering={rowReveal(row, m)}>
                  <DeviceRow deviceId={deviceId} status={statuses[deviceId]} selected={deviceId === selectedId} onPress={onSelect} />
                </Animated.View>
              </Fragment>
            ))}
          </ListGroup>
        </SectionCard>
      </Animated.View>
    );
  };

  return (
    <View style={styles.column} testID="devices-list" accessibilityLabel={t('features.devices.list.label')}>
      <Animated.View entering={enterRise(0, m)} style={[styles.header, isMultiPane ? styles.headerPane : null]}>
        <Boxes size={28} color={palette.gold} />
        <Text maxFontSizeMultiplier={1.2} accessibilityRole="header" style={styles.title}>
          {t('features.devices.header.title')}
        </Text>
      </Animated.View>
      {!status.ready ? (
        <SkeletonGroup isLoading style={styles.skeletons} testID="devices-loading">
          {[0, 1, 2].map((i) => (
            <SkeletonGroup.Item key={i} className="h-32 w-full rounded-xl" />
          ))}
        </SkeletonGroup>
      ) : (
        <ScrollView style={styles.scroll} contentContainerStyle={styles.content} testID="devices-scroll">
          {attention.length > 0 ? <AttentionAlert devices={attention} statuses={statuses} /> : null}
          {twoColumns ? (
            <View style={styles.columns}>
              <View style={styles.col}>
                {section('cameras', 0)}
                {section('audio', 1)}
              </View>
              <View style={styles.col}>{section('other', 2)}</View>
            </View>
          ) : (
            <>
              {section('cameras', 0)}
              {section('audio', 1)}
              {section('other', 2)}
            </>
          )}
        </ScrollView>
      )}
    </View>
  );
}

/** Calm escalation (03M P7): one fade-in, a steady colour, the worst device named first. */
function AttentionAlert({ devices, statuses }: { devices: readonly DeviceId[]; statuses: Readonly<Record<DeviceId, DeviceStatus>> }) {
  const { t } = useTranslation();
  const m = useMotionSettings();
  const worst = devices[0]!;
  const critical = STATUS_RANK[statuses[worst]] >= 2;
  const detail = t('devices.banner.issueDetail', {
    device: t(DEVICE_SHORT_NAME_KEY[worst]),
    status: t(STATUS_LABEL_KEY[statuses[worst]]),
  });
  return (
    <Animated.View entering={enterRise(0, m)}>
      <Alert status={critical ? 'danger' : 'warning'} testID="devices-attention">
        <Alert.Indicator />
        <Alert.Content>
          <Alert.Title>{t('features.devices.attention.title', { count: devices.length })}</Alert.Title>
          <Alert.Description>
            {devices.length > 1 ? t('devices.banner.moreIssues', { detail, count: devices.length - 1 }) : detail}
            {` · ${t('features.devices.attention.recordingContinues')}`}
          </Alert.Description>
        </Alert.Content>
      </Alert>
    </Animated.View>
  );
}

function DetailPlaceholder() {
  const { t } = useTranslation();
  return (
    <View style={styles.placeholder} testID="device-detail-empty">
      <SectionCard title={t('features.devices.pane.emptyTitle')} description={t('features.devices.pane.emptyBody')} />
    </View>
  );
}

const styles = StyleSheet.create({
  panes: { paddingRight: spacing[3] },
  // Step 83 device finding: `flex: n` keeps an automatic basis, which skewed the split after a
  // rotation; a zero basis makes it depend on the flex ratio alone.
  flexBasisZero: { flexBasis: 0 },
  column: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], minHeight: 56, paddingHorizontal: spacing[3] },
  headerPane: { minHeight: 64 },
  title: { flex: 1, fontFamily: fontFamily.native.semibold, fontSize: typography.h2.size, lineHeight: typography.h2.lineHeight, color: palette.foreground },
  scroll: { flex: 1 },
  content: { paddingHorizontal: spacing[3], paddingTop: spacing[1], paddingBottom: spacing[4], gap: spacing[2] },
  columns: { flexDirection: 'row', gap: spacing[2], alignItems: 'flex-start' },
  col: { flex: 1, gap: spacing[2] },
  skeletons: { paddingHorizontal: spacing[3], gap: spacing[2] },
  placeholder: { flex: 1, paddingTop: spacing[5], paddingHorizontal: spacing[3] },
});
