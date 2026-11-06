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
 *
 * E2E-T-2 (E-fix row FX-M2; decision D200/D201): the screen always shows one of three things: the
 * loading skeleton (until the runtime has hydrated), the data (the store, synchronously: this screen
 * sends no request and waits for no query, suspense or focus effect), or the panel's error card with
 * a rate-limited Retry (`PanelBoundary` around the list and around the detail pane). The blank pane
 * seen once on the tablet is traced in `gateway_check/11d_efix_mobile_screens.md`.
 */
import { useRouter, type Href } from 'expo-router';
import { Alert, Button, ListGroup, Separator, SkeletonGroup } from 'heroui-native';
import { Boxes } from 'lucide-react-native';
import { Fragment, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { fontFamily, palette, spacing, typography } from '@dems/shared/tokens';
import { SectionCard } from '@/components/kit';
import { CameraSearchPanel } from '@/features/capture-selector/camera-search-panel';
import { CaptureNoticesBanner } from '@/features/capture-selector/capture-notices';
import { CaptureSelector } from '@/features/capture-selector/capture-selector';
import { CameraSearchProvider } from '@/features/capture-selector/use-camera-search';
import { Pane, PaneLayout, SafeScreen, useLayoutClass } from '@/layout';
import { enterRise, rowReveal, useMotionSettings } from '@/motion';
import { useRuntimeStatus } from '@/runtime';
import { DeviceDetail } from './device-detail';
import { DeviceRow } from './device-row';
import { NO_PRODUCER_DEVICES, useNoProducerView } from './device-status-chip';
import { DEVICE_SHORT_NAME_KEY, SECTIONS, STATUS_LABEL_KEY, STATUS_RANK, attentionDevices, isDeviceId, type DeviceId, type DeviceSection, type DeviceStatus } from './devices-model';
import { PanelBoundary } from './panel-boundary';
import { RegisteredDeviceRows, useRegisteredDevices } from './registered-device-rows';
import { useDeviceStatuses, useIsRecording } from './use-devices-data';

export interface DevicesScreenProps {
  /** Device selected with `?selected=` (the detail pane on medium and expanded, 04 §2.4), or null. */
  readonly selectedId: string | null;
}

/** Medium: a 360 dp list; expanded: list 40% | detail 60% (04 §2.4). */
const MEDIUM_LIST_WIDTH = 360;

export function DevicesScreen({ selectedId }: DevicesScreenProps) {
  const router = useRouter();
  const { layoutClass, isMultiPane } = useLayoutClass();

  // Row 140: a registered device beyond the built-in ids (`CAM-03`, `MIC-03`) is selected by its id as text.
  const select = useCallback(
    (id: string) => {
      if (isMultiPane) router.setParams({ selected: id });
      else router.push(`/devices/${id}` as Href);
    },
    [isMultiPane, router],
  );

  const list = (
    <PanelBoundary name="list">
      <DevicesList selectedId={isMultiPane ? selectedId : null} twoColumns={layoutClass === 'compact-landscape'} onSelect={select} />
    </PanelBoundary>
  );

  return (
    <SafeScreen id="devices">
      {isMultiPane ? (
        <PaneLayout testID="devices-panes" style={styles.panes}>
          <Pane name="list" {...(layoutClass === 'medium' ? { width: MEDIUM_LIST_WIDTH } : { flex: 2, style: styles.flexBasisZero })}>
            {list}
          </Pane>
          <Pane name="detail" flex={3} style={styles.flexBasisZero}>
            <PanelBoundary key={selectedId ?? 'none'} name="detail">
              {selectedId ? <DeviceDetail key={selectedId} deviceId={selectedId} variant="pane" /> : <DetailPlaceholder />}
            </PanelBoundary>
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
  onSelect: (id: string) => void;
}

function DevicesList({ selectedId, twoColumns, onSelect }: DevicesListProps) {
  const { t } = useTranslation();
  const m = useMotionSettings();
  const status = useRuntimeStatus();
  const statuses = useDeviceStatuses();
  const { isMultiPane } = useLayoutClass();
  // Audit row 227 (D213): on a Core in its own capture (the row 198 gate) the model-only PoE switch and indicator read
  // "Not reported", so their model status raises no attention; cameras, microphones and the tablet still do.
  const noProducer = useNoProducerView();
  const attention = attentionDevices(statuses, noProducer ? NO_PRODUCER_DEVICES : undefined);
  // Row 140 (D137 (2)): the devices the Core registered beyond the built-in ids, from its own list.
  const registered = useRegisteredDevices();

  const section = (id: DeviceSection, index: number) => {
    const spec = SECTIONS.find((entry) => entry.id === id)!;
    return (
      <Animated.View key={id} entering={enterRise(index + 1, m)}>
        {/* M3-10 R3 (audit row 198; D52, I4): no "Synthetic demo values" chip on any section. On a Core in its own capture the
            PoE switch and the indicator rows read "Not reported" themselves (`device-row.tsx`); the tablet row is its own link fact. */}
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
            {/* Row 140: the registered cameras / microphones beyond the built-in ids; nothing when the Core lists none. */}
            {id === 'cameras' ? <RegisteredDeviceRows kind="CAMERA" selectedId={selectedId} onPress={onSelect} /> : null}
            {id === 'audio' ? <RegisteredDeviceRows kind="MIC" selectedId={selectedId} onPress={onSelect} /> : null}
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
          {attention.length > 0 ? <AttentionAlert devices={attention} statuses={statuses} onOpen={onSelect} /> : null}
          {/* Task 3 row 138 (MB-08; ux §8c flow 9, §8e flow 11): the no-device notifications and the "Camera
              search" panel, above the selector. One provider = one search for the banner, the panel and the
              selector's empty state (G13). Each in its own boundary, as the selector. */}
          <CameraSearchProvider>
            <PanelBoundary name="capture-notices">
              <CaptureNoticesBanner />
            </PanelBoundary>
            <Animated.View entering={enterRise(1, m)}>
              <PanelBoundary name="camera-search">
                <CameraSearchPanel viewDevice={(id) => (isDeviceId(id) || registered.some((device) => device.id === id) ? () => onSelect(id) : null)} />
              </PanelBoundary>
            </Animated.View>
            {/* Task 3 row 68 (MB-08; ux §2 flow 1): the device selector, in its own boundary so a render
                failure of it never takes the device list with it. */}
            <Animated.View entering={enterRise(1, m)}>
              <PanelBoundary name="capture-selector">
                <CaptureSelector />
              </PanelBoundary>
            </Animated.View>
          </CameraSearchProvider>
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
function AttentionAlert({ devices, statuses, onOpen }: { devices: readonly DeviceId[]; statuses: Readonly<Record<DeviceId, DeviceStatus>>; onOpen: (id: string) => void }) {
  const { t } = useTranslation();
  const m = useMotionSettings();
  // Fix wave J (JA2-26): "Recording continues on the Core." is said only while a session records; a latched
  // clip names its remedy and the way to it.
  const recording = useIsRecording();
  const clipped = devices.find((id) => statuses[id] === 'CLIP') ?? null;
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
            {` · ${t(recording ? 'features.devices.attention.recordingContinues' : 'features.devices.attention.noSession')}`}
          </Alert.Description>
          {clipped === null ? null : (
            <>
              <Alert.Description testID="devices-attention-clip-remedy">{t('features.devices.attention.clipRemedy', { device: t(DEVICE_SHORT_NAME_KEY[clipped]) })}</Alert.Description>
              <View style={styles.alertActions}>
                <Button variant="outline" size="sm" onPress={() => onOpen(clipped)} testID="devices-attention-open-clip">
                  <Button.Label>{t('features.devices.attention.openDevice', { device: t(DEVICE_SHORT_NAME_KEY[clipped]) })}</Button.Label>
                </Button>
              </View>
            </>
          )}
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
  alertActions: { flexDirection: 'row', marginTop: spacing[1] },
  placeholder: { flex: 1, paddingTop: spacing[5], paddingHorizontal: spacing[3] },
});
