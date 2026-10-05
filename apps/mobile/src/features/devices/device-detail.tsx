/**
 * Device detail body (04_mobile_specs §4.12 V5), shared by the phone route
 * (`/devices/[deviceId]`, `variant="screen"`) and the tablet detail pane (`variant="pane"`).
 *
 * Regions: header (back + name on the phone) · hero (cameras: the live CameraFeed; microphones:
 * the C-2 `large` meter with the CLIP reset; other devices: an icon plate) · status chip and device
 * ID · kit `Tabs` Overview / Health / Log · actions Run diagnostics, Test signal, Restart.
 *
 * - Overview: a `KeyValueList` of the device's facts; gain and phantom are read-only (G13).
 * - Health: a victory-native line, 1 Hz, no animation (SIM-GAP-M84-2 derives the series).
 * - Log: the device's audit rows, newest first, labelled from codes (never the simulator's English).
 * - Restart needs the Technician role and is unavailable while recording (D79; SIM-GAP-M84-3).
 * - Faults escalate calmly (03M P7): the chip pulses once and holds its colour; the hero greys to
 *   NO SIGNAL; a tablet-offline note says recording continues.
 *
 * Both data modes (backend task W78; 04_client_integration_spec §8.6 S2-8, §8.7 S3-2 and S5-4): the
 * actions come from `useCoreActions()` and every result is consumed through `settle`, so one call
 * site serves the simulator (it settles before `settle` returns: the screens behave as before) and
 * the Core server (it settles once the Core answered and the store holds what the answer named,
 * CL-16).
 *
 * | Site | What | Live behaviour |
 * |---|---|---|
 * | S2-8 | `startDiagnostics` (operation 65) | The sheet opens in `ok`, only once the Core accepted the run; "Diagnostics" and "Run again" ignore further presses until then, with the kit's `Spinner` after `LIVE_PENDING_REVEAL_MS` (LB-1). A refusal goes to the presenter; the sheet stays closed |
 * | S3-2 | `DeviceCommandDialog`, `onConfirm` (operations 48, 49) | The dialog waits for the answer: success toast in `ok`, danger toast in `fail`, closed in `done` (AC-C-63) |
 * | S5-4 | the Restart hint (`useCanManageDevices`, `restartBlocked`) | Kept as a hint (the role comes from the replicated `operators` slice); the Core enforces DEVICE_MANAGE on operation 48 and its 403 shows the denied toast (AC-C-48) |
 * | — | `resetClip` (operation 52), result ignored as before | Through `settle` as well, so a refusal or an outage is presented and logged instead of an unhandled rejection |
 *
 * Every rejection goes to the refusal presenter first in Live mode (`useCoreErrorPresenter`, §6.2,
 * LB-5 to LB-10), and only what it leaves gets the site's own message; every failure writes the
 * persistent runtime log (`reportRuntimeIssue`). In LIVE mode the copy says nothing about a
 * simulation (MD-8): the dialog bodies, the toasts, the log's command names, the health caption and
 * the diagnostics subtitle take `features.devices.live.*`.
 */
import { useIsFocused, useRouter } from 'expo-router';
import { Alert, Button, Tabs, useToast } from 'heroui-native';
import { Activity, ArrowLeft, EthernetPort, RotateCcw, Siren, Stethoscope, Tablet, type LucideIcon } from 'lucide-react-native';
import { useCallback, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import type { AudioTrackId } from '@dems/shared/domain';
import { EMPTY_DATE_TEXT, formatClock } from '@dems/shared/realtime';
import { settle, useCoreActions } from '@dems/shared/live';
import type { AuditRow, DeviceCommand } from '@dems/shared/sim';
import { derived, fontFamily, palette, radius, spacing, toneHex, typography } from '@dems/shared/tokens';
import { KeyValueList, type KeyValueItem } from '@/components/kit';
import { CameraFeed } from '@/components/media';
import { DEMO_MEDIA_LIVE } from '@/components/media/demo-media';
import { useLayoutClass } from '@/layout';
import { crossFadeIn, enterRise, triggerHaptic, useMotionPolicy, useMotionSettings, useMotionState } from '@/motion';
import { PendingSpinner, busyState, reportRuntimeIssue, useCoreErrorPresenter, useCoreLink } from '@/runtime';
import { DeviceCommandDialog } from './device-command-dialog';
import { DeviceMicMeter } from './device-mic-meter';
import { DeviceStatusChip } from './device-status-chip';
import {
  DEVICE_CAMERA,
  DEVICE_KIND,
  DEVICE_NAME_KEY,
  DEVICE_SHORT_NAME_KEY,
  STATUS_LABEL_KEY,
  STATUS_TONE,
  isDeviceId,
  type DeviceId,
  type DeviceStatus,
} from './devices-model';
import { DiagnosticsSheet } from './diagnostics-sheet';
import { HealthChart } from './health-chart';
import { CAMERA_POE_PORT_KEY, channelOf } from './sim-adapter';
import { usePendingPress } from './use-pending-press';
import {
  useBookPoe,
  useCamera,
  useCanManageDevices,
  useDeviceLog,
  useDeviceStatus,
  useHealthSeries,
  useIsRecording,
  useMic,
  useMicLevelSeries,
  useTabletLink,
} from './use-devices-data';

type DetailTab = 'overview' | 'health' | 'log';
const TABS: readonly DetailTab[] = ['overview', 'health', 'log'];

export interface DeviceDetailProps {
  deviceId: string;
  variant: 'screen' | 'pane';
}

export function DeviceDetail({ deviceId, variant }: DeviceDetailProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const known = isDeviceId(deviceId);
  const name = known ? t(DEVICE_NAME_KEY[deviceId]) : deviceId;
  const header =
    variant === 'screen' ? (
      <View style={styles.header}>
        <Button
          isIconOnly
          variant="ghost"
          size="md"
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/devices'))}
          accessibilityLabel={t('features.devices.header.back')}
          testID="device-detail-back"
        >
          <ArrowLeft size={22} color={palette.gold} />
        </Button>
        <Text maxFontSizeMultiplier={1.2} accessibilityRole="header" numberOfLines={1} style={styles.headerTitle}>
          {known ? name : t('features.devices.header.detailTitle')}
        </Text>
      </View>
    ) : (
      <View style={styles.paneHeader}>
        <Text maxFontSizeMultiplier={1.2} accessibilityRole="header" numberOfLines={1} style={styles.headerTitle}>
          {known ? name : t('features.devices.header.detailTitle')}
        </Text>
      </View>
    );

  if (!known) {
    return (
      <View style={styles.root} testID="device-detail-missing">
        {header}
        <View style={styles.missing}>
          <Text maxFontSizeMultiplier={1.2} style={styles.body}>
            {t('features.devices.detail.notFound')}
          </Text>
          {variant === 'screen' ? (
            <Button variant="outline" onPress={() => router.replace('/devices')}>
              <Button.Label>{t('features.devices.detail.notFoundBack')}</Button.Label>
            </Button>
          ) : null}
        </View>
      </View>
    );
  }
  return <KnownDeviceDetail deviceId={deviceId} variant={variant} header={header} />;
}

function KnownDeviceDetail({ deviceId, variant, header }: { deviceId: DeviceId; variant: 'screen' | 'pane'; header: ReactNode }) {
  const { t } = useTranslation();
  const m = useMotionSettings();
  const actions = useCoreActions();
  const live = useCoreLink().source === 'LIVE';
  const presentCoreError = useCoreErrorPresenter();
  const { toast } = useToast();
  const diagnosticsPress = usePendingPress();
  const status = useDeviceStatus(deviceId);
  const recording = useIsRecording();
  const canManage = useCanManageDevices();
  const { layoutClass } = useLayoutClass();
  const [tab, setTab] = useState<DetailTab>('overview');
  const [diagnosticsOpen, setDiagnosticsOpen] = useState(false);
  const [command, setCommand] = useState<DeviceCommand | null>(null);
  const shortName = t(DEVICE_SHORT_NAME_KEY[deviceId]);

  // S2-8: a diagnostics run; `started` runs once the simulator or the Core accepted it (the sheet opens there).
  const startDiagnostics = useCallback(
    (started?: () => void) => {
      diagnosticsPress.run((release) => {
        settle(() => actions.runDiagnostics(), {
          ok: () => started?.(),
          fail: (error) => {
            // Live mode: a denial, an outage or a limit is the presenter's (one wording on every screen).
            if (live && presentCoreError(error)) {
              reportRuntimeIssue('warn', 'devices.diagnostics', error, { deviceId });
              return;
            }
            reportRuntimeIssue('error', 'devices.diagnostics', error, { deviceId });
            if (live) toast.show({ variant: 'danger', label: t('features.devices.diagnostics.failedToStart') });
          },
          done: release,
        });
      });
    },
    [actions, deviceId, diagnosticsPress, live, presentCoreError, t, toast],
  );

  // The CLIP latch reset; its result is ignored as before, but a Live rejection is presented and logged.
  const resetClip = useCallback(
    (channel: AudioTrackId) => {
      settle(() => actions.resetClip(channel), {
        fail: (error) => {
          // Live mode: the presenter words a denial, an outage or a limit; the latch stays lit either way.
          if (live) presentCoreError(error);
          reportRuntimeIssue('warn', 'devices.resetClip', error, { deviceId, channel });
        },
      });
    },
    [actions, deviceId, live, presentCoreError],
  );

  const restartBlocked = !canManage || recording;
  const restartHint = !canManage ? t('features.devices.actions.restartNeedsTechnician') : recording ? t('devices.actions.restartWhileRecording') : undefined;
  const landscape = variant === 'screen' && layoutClass === 'compact-landscape';

  const top = (
    <Animated.View entering={enterRise(0, m, { distance: 'riseLg' })} style={styles.block}>
      <DeviceHero deviceId={deviceId} status={status} onClipReset={resetClip} />
      <View style={styles.statusRow}>
        <DeviceStatusChip status={status} size="md" testID="device-detail-status" />
        <Text maxFontSizeMultiplier={1.2} selectable style={styles.deviceId} testID="device-detail-id">
          {deviceId}
        </Text>
      </View>
      {deviceId === 'TABLET' && status === 'OFFLINE' ? (
        <Alert status="warning" testID="device-tablet-offline">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>{t('devices.other.tabletOfflineTitle')}</Alert.Title>
            <Alert.Description>{t('devices.other.tabletOfflineBody')}</Alert.Description>
          </Alert.Content>
        </Alert>
      ) : null}
    </Animated.View>
  );

  const tabs = (
    <Animated.View entering={enterRise(1, m)} style={styles.block}>
      <Tabs
        value={tab}
        onValueChange={(value) => {
          triggerHaptic('tabSelect');
          setTab(value as DetailTab);
        }}
        variant="primary"
      >
        <Tabs.List accessibilityLabel={t('devices.drawer.tabsLabel')}>
          <Tabs.Indicator />
          {TABS.map((key) => (
            <Tabs.Trigger key={key} value={key} testID={`device-tab-${key}`}>
              <Tabs.Label>{t(`devices.drawer.tabs.${key}`)}</Tabs.Label>
            </Tabs.Trigger>
          ))}
        </Tabs.List>
      </Tabs>
      <Animated.View key={tab} entering={crossFadeIn(m)} style={styles.tabBody}>
        {tab === 'overview' ? (
          <OverviewTab deviceId={deviceId} status={status} onClipReset={resetClip} />
        ) : tab === 'health' ? (
          <HealthTab deviceId={deviceId} live={live} />
        ) : (
          <LogTab deviceId={deviceId} live={live} />
        )}
      </Animated.View>
    </Animated.View>
  );

  return (
    <View style={styles.root} testID={`device-detail-${variant}`}>
      {header}
      {landscape ? (
        <View style={styles.split}>
          <ScrollView style={styles.splitHero} contentContainerStyle={styles.content}>
            {top}
          </ScrollView>
          <ScrollView style={styles.splitTabs} contentContainerStyle={styles.content}>
            {tabs}
          </ScrollView>
        </View>
      ) : (
        <ScrollView style={styles.scroll} contentContainerStyle={styles.content} testID="device-detail-scroll">
          {top}
          {tabs}
        </ScrollView>
      )}
      <View style={styles.actions} testID="device-detail-actions">
        <Button
          variant="tertiary"
          size="sm"
          style={styles.action}
          onPress={() => {
            triggerHaptic('primaryPress');
            startDiagnostics(() => setDiagnosticsOpen(true));
          }}
          accessibilityLabel={t('features.devices.actions.diagnosticsLabel')}
          testID="device-action-diagnostics"
          {...busyState(diagnosticsPress.busy)}
        >
          {diagnosticsPress.pending ? <PendingSpinner color={palette.gold} testID="device-action-diagnostics-spinner" /> : <Stethoscope size={18} color={palette.gold} />}
          <Button.Label numberOfLines={1}>{t('features.devices.actions.diagnostics')}</Button.Label>
        </Button>
        <Button variant="outline" size="sm" style={styles.action} onPress={() => setCommand('TEST_SIGNAL')} testID="device-action-test-signal">
          <Activity size={18} color={palette.gold} />
          <Button.Label numberOfLines={1}>{t('features.devices.actions.testSignal')}</Button.Label>
        </Button>
        <Button
          variant="outline"
          size="sm"
          style={styles.action}
          isDisabled={restartBlocked}
          onPress={() => setCommand('RESTART')}
          accessibilityHint={restartHint}
          testID="device-action-restart"
        >
          <RotateCcw size={18} color={restartBlocked ? palette.gray : palette.gold} />
          <Button.Label numberOfLines={1}>{t('features.devices.actions.restart')}</Button.Label>
        </Button>
      </View>
      {restartHint ? (
        <Text maxFontSizeMultiplier={1.2} style={styles.hint} testID="device-restart-hint">
          {restartHint}
        </Text>
      ) : null}
      <DiagnosticsSheet
        isOpen={diagnosticsOpen}
        onClose={() => setDiagnosticsOpen(false)}
        onRunAgain={() => {
          startDiagnostics();
        }}
        live={live}
        runAgainBusy={diagnosticsPress.busy}
        runAgainPending={diagnosticsPress.pending}
      />
      <DeviceCommandDialog
        command={command}
        deviceId={deviceId}
        deviceName={shortName}
        live={live}
        onClose={() => setCommand(null)}
        onConfirm={(next) => actions.deviceCommand(deviceId, next)}
      />
    </View>
  );
}

// ── Hero ─────────────────────────────────────────────────────────────────────────────────
const OTHER_ICON: Readonly<Partial<Record<DeviceId, LucideIcon>>> = { 'POE-SWITCH': EthernetPort, 'REC-INDICATOR': Siren, TABLET: Tablet };

function DeviceHero({ deviceId, status, onClipReset }: { deviceId: DeviceId; status: DeviceStatus; onClipReset: (channel: AudioTrackId) => void }) {
  switch (DEVICE_KIND[deviceId]) {
    case 'camera':
      return <CameraHero deviceId={deviceId} status={status} />;
    case 'microphone':
      return <MicHero deviceId={deviceId} onClipReset={onClipReset} />;
    default:
      return <IconHero deviceId={deviceId} status={status} />;
  }
}

function CameraHero({ deviceId, status }: { deviceId: DeviceId; status: DeviceStatus }) {
  const { t } = useTranslation();
  const policy = useMotionPolicy();
  const focused = useIsFocused();
  const testSwitch = useMotionState((s) => s.linkMotion === 'off');
  const trackId = DEVICE_CAMERA[deviceId] ?? 'VIDEO-01';
  const index = trackId === 'VIDEO-02' ? 2 : 1;
  const name = t(DEVICE_NAME_KEY[deviceId]);
  return (
    <View style={styles.feedWrap}>
      <CameraFeed
        testID="device-detail-feed"
        cameraId={`CAM-${index}`}
        cameraLabel={`CAM ${index}`}
        mode={testSwitch ? 'poster' : 'live'}
        {...(testSwitch ? { image: DEMO_MEDIA_LIVE.poster[trackId] } : {})}
        motion={policy}
        paused={!focused}
        noSignal={status === 'FAULT'}
        labels={{ noSignal: t('common.status.noSignal') }}
        accessibilityLabel={t('devices.cameras.feedAria', { name })}
        style={styles.feed}
      />
    </View>
  );
}

function MicHero({ deviceId, onClipReset }: { deviceId: DeviceId; onClipReset: (channel: AudioTrackId) => void }) {
  const mic = useMic(deviceId);
  const focused = useIsFocused();
  const testSwitch = useMotionState((s) => s.linkMotion === 'off');
  if (!mic) return null;
  return (
    <View style={styles.meterPlate} testID="device-detail-meter-plate">
      <DeviceMicMeter
        mic={mic}
        variant="large"
        paused={!focused || testSwitch}
        holdReadout={testSwitch}
        onClipReset={() => onClipReset(mic.id)}
        testID="device-detail-meter"
      />
    </View>
  );
}

function IconHero({ deviceId, status }: { deviceId: DeviceId; status: DeviceStatus }) {
  const { t } = useTranslation();
  const Icon = OTHER_ICON[deviceId] ?? Tablet;
  const color = deviceId === 'REC-INDICATOR' ? palette.danger : deviceId === 'POE-SWITCH' ? palette.gold : toneHex[STATUS_TONE[status]];
  return (
    <View style={styles.iconPlate} testID="device-detail-icon-plate">
      <Icon size={48} color={color} />
      <Text maxFontSizeMultiplier={1.2} style={styles.iconPlateText}>
        {t(STATUS_LABEL_KEY[status])}
      </Text>
    </View>
  );
}

// ── Overview ─────────────────────────────────────────────────────────────────────────────
function OverviewTab({ deviceId, status, onClipReset }: { deviceId: DeviceId; status: DeviceStatus; onClipReset: (channel: AudioTrackId) => void }) {
  switch (DEVICE_KIND[deviceId]) {
    case 'camera':
      return <CameraOverview deviceId={deviceId} status={status} />;
    case 'microphone':
      return <MicOverview deviceId={deviceId} status={status} onClipReset={onClipReset} />;
    case 'poe':
      return <PoeOverview status={status} />;
    case 'relay':
      return <RelayOverview status={status} />;
    case 'tablet':
      return <TabletOverview status={status} />;
  }
}

function useFieldLabel() {
  const { t } = useTranslation();
  return (key: string) => t(`devices.drawer.field.${key}`);
}

function Facts({ items }: { items: readonly KeyValueItem[] }) {
  return <KeyValueList items={items} testID="device-overview" />;
}

function CameraOverview({ deviceId, status }: { deviceId: DeviceId; status: DeviceStatus }) {
  const { t } = useTranslation();
  const label = useFieldLabel();
  const camera = useCamera(deviceId);
  if (!camera) return null;
  return (
    <Facts
      items={[
        { id: 'status', label: label('status'), value: t(STATUS_LABEL_KEY[status]) },
        { id: 'deviceId', label: label('deviceId'), value: deviceId, mono: true },
        { id: 'model', label: label('model'), value: camera.model },
        { id: 'firmware', label: label('firmware'), value: camera.firmware, mono: true },
        { id: 'port', label: label('port'), value: t(CAMERA_POE_PORT_KEY), testID: 'device-fact-port' },
        {
          id: 'format',
          label: label('format'),
          value: t('common.devices.cameraFormatCodec', { resolution: camera.resolution, fps: camera.fps, codec: camera.codec }),
        },
        { id: 'bitrate', label: label('bitrate'), value: t('features.devices.detail.mbps', { value: camera.bitrateMbps }) },
        { id: 'recState', label: label('recState'), value: camera.recState ? t(`common.enums.trackRecState.${camera.recState}`) : EMPTY_DATE_TEXT },
      ]}
    />
  );
}

function MicOverview({ deviceId, status, onClipReset }: { deviceId: DeviceId; status: DeviceStatus; onClipReset: (channel: AudioTrackId) => void }) {
  const { t } = useTranslation();
  const label = useFieldLabel();
  const mic = useMic(deviceId);
  if (!mic) return null;
  return (
    <View style={styles.block}>
      <Facts
        items={[
          { id: 'status', label: label('status'), value: t(STATUS_LABEL_KEY[status]) },
          { id: 'deviceId', label: label('deviceId'), value: deviceId, mono: true },
          { id: 'channel', label: label('channel'), value: t('devices.drawer.value.channel', { channel: mic.channel }) },
          { id: 'gain', label: label('gain'), value: t('devices.audio.gainValue', { value: mic.gainDb }), testID: 'device-fact-gain' },
          { id: 'phantom', label: label('phantom'), value: mic.phantom ? t('devices.audio.phantomOn') : t('devices.audio.phantomOff'), testID: 'device-fact-phantom' },
          {
            id: 'clip',
            label: t('devices.audio.clip'),
            testID: 'device-fact-clip',
            value: mic.clipLatched ? (
              <Button size="sm" variant="danger-soft" onPress={() => onClipReset(mic.id)} testID="device-clip-reset">
                <Button.Label>{t('devices.audio.resetClip')}</Button.Label>
              </Button>
            ) : (
              t('devices.audio.clipClear')
            ),
          },
          { id: 'recState', label: label('recState'), value: mic.recState ? t(`common.enums.trackRecState.${mic.recState}`) : EMPTY_DATE_TEXT },
          { id: 'adc', label: label('adc'), value: t('devices.drawer.value.adc') },
        ]}
      />
      <Text maxFontSizeMultiplier={1.2} style={styles.hint}>
        {t('features.devices.detail.readOnlyNote')}
      </Text>
    </View>
  );
}

function PoeOverview({ status }: { status: DeviceStatus }) {
  const { t } = useTranslation();
  const label = useFieldLabel();
  const poe = useBookPoe();
  return (
    <Facts
      items={[
        { id: 'status', label: label('status'), value: t(STATUS_LABEL_KEY[status]) },
        { id: 'ports', label: label('ports'), value: t('devices.other.poeSummary', { active: poe.active, spare: poe.spare }), testID: 'device-fact-ports' },
        { id: 'cam1', label: t('devices.ports.poeCam1'), value: poe.cam1Link ? t('devices.ports.linkUp') : t('devices.ports.linkDown') },
        { id: 'cam2', label: t('devices.ports.poeCam2'), value: t('devices.ports.spare') },
        { id: 'power', label: label('power'), value: t('features.devices.detail.watts', { value: poe.drawW.toFixed(1) }) },
        { id: 'budget', label: label('budget'), value: t('features.devices.detail.watts', { value: poe.budgetW }) },
      ]}
    />
  );
}

function RelayOverview({ status }: { status: DeviceStatus }) {
  const { t } = useTranslation();
  const label = useFieldLabel();
  const recording = useIsRecording();
  return (
    <Facts
      items={[
        { id: 'status', label: label('status'), value: t(STATUS_LABEL_KEY[status]) },
        {
          id: 'lamp',
          label: label('lamp'),
          testID: 'device-fact-lamp',
          value: recording ? (
            <Text maxFontSizeMultiplier={1.2} style={styles.lampOn}>
              {t('devices.other.recordingLamp')}
            </Text>
          ) : (
            t('features.devices.detail.lampOff')
          ),
        },
        { id: 'link', label: label('link'), value: t('devices.other.relay') },
      ]}
    />
  );
}

function TabletOverview({ status }: { status: DeviceStatus }) {
  const { t } = useTranslation();
  const label = useFieldLabel();
  const link = useTabletLink();
  return (
    <Facts
      items={[
        { id: 'status', label: label('status'), value: t(STATUS_LABEL_KEY[status]) },
        { id: 'link', label: label('link'), value: t('devices.other.tabletLink') },
        { id: 'since', label: label('since'), value: t('features.devices.detail.sinceValue', { time: formatClock(link.changedAt) }), mono: true },
        { id: 'self', label: label('pairing'), value: t('features.devices.detail.tabletSelf') },
      ]}
    />
  );
}

// ── Health ───────────────────────────────────────────────────────────────────────────────
function HealthTab({ deviceId, live }: { deviceId: DeviceId; live: boolean }) {
  const channel = channelOf(deviceId);
  return channel ? <MicHealth channel={channel} live={live} /> : <DeviceHealth deviceId={deviceId} live={live} />;
}

function DeviceHealth({ deviceId, live }: { deviceId: DeviceId; live: boolean }) {
  const series = useHealthSeries(deviceId);
  return <HealthChart series={series} testID="device-health" live={live} />;
}

function MicHealth({ channel, live }: { channel: AudioTrackId; live: boolean }) {
  const series = useMicLevelSeries(channel);
  return <HealthChart series={series} testID="device-health" live={live} />;
}

// ── Log ──────────────────────────────────────────────────────────────────────────────────
/** LIVE mode: a DEVICE_COMMAND row names its command without "(simulated)"; IDENTIFY comes from the web console. */
const LIVE_COMMAND_KEY: Readonly<Record<string, string>> = {
  TEST_SIGNAL: 'features.devices.live.command.TEST_SIGNAL',
  RESTART: 'features.devices.live.command.RESTART',
  IDENTIFY: 'features.devices.live.command.IDENTIFY',
};

/** The detail cell from codes only (fault kind, command, link state), never the simulator's English. */
function logDetail(row: AuditRow, t: (key: string) => string, live: boolean): string {
  const kind = typeof row.details.kind === 'string' ? row.details.kind : null;
  switch (row.type) {
    case 'FAULT_RAISED':
    case 'FAULT_CLEARED':
      return kind ? t(`common.faultKind.${kind}`) : EMPTY_DATE_TEXT;
    case 'DEVICE_COMMAND': {
      if (live) {
        const key = typeof row.details.command === 'string' && Object.prototype.hasOwnProperty.call(LIVE_COMMAND_KEY, row.details.command) ? LIVE_COMMAND_KEY[row.details.command] : undefined;
        return key ? t(key) : EMPTY_DATE_TEXT;
      }
      return row.details.command === 'TEST_SIGNAL' ? t('common.deviceMenu.testSignal') : t('common.deviceMenu.restart');
    }
    case 'TABLET_LINK_CHANGED':
      return typeof row.details.state === 'string' ? t(`common.tabletLinkState.${row.details.state}`) : EMPTY_DATE_TEXT;
    default:
      return row.sessionId ?? EMPTY_DATE_TEXT;
  }
}

const SEVERITY_COLOR: Readonly<Record<AuditRow['severity'], string>> = {
  INFO: palette.gray,
  SUCCESS: palette.success,
  WARNING: palette.warning,
  CRITICAL: palette.danger,
};

function LogTab({ deviceId, live }: { deviceId: DeviceId; live: boolean }) {
  const { t } = useTranslation();
  const rows = useDeviceLog(deviceId);
  if (rows.length === 0) {
    return (
      <Text maxFontSizeMultiplier={1.2} style={styles.body} testID="device-log-empty">
        {t('devices.drawer.emptyLog')}
      </Text>
    );
  }
  return (
    <View style={styles.log} testID="device-log" accessibilityLabel={t('devices.drawer.log.label')}>
      {rows.map((row) => (
        <View key={row.id} style={styles.logRow} testID={`device-log-${row.type}`}>
          <View style={[styles.logDot, { backgroundColor: SEVERITY_COLOR[row.severity] }]} />
          <Text maxFontSizeMultiplier={1.2} style={styles.logTime}>
            {formatClock(row.at)}
          </Text>
          <View style={styles.logText}>
            <Text maxFontSizeMultiplier={1.2} style={styles.logEvent} numberOfLines={1}>
              {t(`common.auditType.${row.type}`)}
            </Text>
            <Text maxFontSizeMultiplier={1.2} style={styles.logDetail} numberOfLines={1}>
              {logDetail(row, t, live)}
            </Text>
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing[1], minHeight: 56, paddingHorizontal: spacing[2] },
  paneHeader: { minHeight: 64, justifyContent: 'center', paddingHorizontal: spacing[3] },
  headerTitle: { flex: 1, fontFamily: fontFamily.native.semibold, fontSize: typography.h2.size, lineHeight: typography.h2.lineHeight, color: palette.foreground },
  scroll: { flex: 1 },
  content: { paddingHorizontal: spacing[3], paddingBottom: spacing[4], gap: spacing[3] },
  split: { flex: 1, flexDirection: 'row' },
  splitHero: { flex: 2 },
  splitTabs: { flex: 3 },
  block: { gap: spacing[2] },
  feedWrap: { borderRadius: radius.px.xl, overflow: 'hidden' },
  feed: { width: '100%', aspectRatio: 16 / 9 },
  meterPlate: { borderRadius: radius.px.xl, backgroundColor: derived.surfaceSecondary, padding: spacing[3], minHeight: 96, justifyContent: 'center' },
  iconPlate: {
    borderRadius: radius.px.xl,
    backgroundColor: derived.surfaceSecondary,
    paddingVertical: spacing[4],
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[1],
  },
  iconPlateText: { fontFamily: fontFamily.native.medium, fontSize: typography.body.size, lineHeight: typography.body.lineHeight, color: derived.foreground2 },
  statusRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing[2] },
  deviceId: { fontFamily: fontFamily.native.mono, fontSize: typography.data.size, lineHeight: typography.data.lineHeight, color: palette.gray },
  tabBody: { marginTop: spacing[2] },
  actions: { flexDirection: 'row', gap: spacing[1], paddingHorizontal: spacing[3], paddingTop: spacing[2], paddingBottom: spacing[1] },
  action: { flex: 1 },
  hint: {
    fontFamily: fontFamily.native.normal,
    fontSize: typography.caption.size,
    lineHeight: typography.caption.lineHeight,
    color: palette.gray,
    paddingHorizontal: spacing[3],
    paddingBottom: spacing[1],
  },
  missing: { padding: spacing[3], gap: spacing[2] },
  body: { fontFamily: fontFamily.native.normal, fontSize: typography.body.size, lineHeight: typography.body.lineHeight, color: derived.foreground2 },
  lampOn: { fontFamily: fontFamily.native.bold, fontSize: typography.body.size, lineHeight: typography.body.lineHeight, color: palette.danger, letterSpacing: 0.5 },
  log: { gap: spacing[1] },
  logRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], minHeight: 40 },
  logDot: { width: 8, height: 8, borderRadius: 4 },
  logTime: { fontFamily: fontFamily.native.mono, fontSize: typography.data.size, lineHeight: typography.data.lineHeight, color: palette.gray },
  logText: { flex: 1, minWidth: 0 },
  logEvent: { fontFamily: fontFamily.native.medium, fontSize: typography.body.size, lineHeight: typography.body.lineHeight, color: palette.foreground },
  logDetail: { fontFamily: fontFamily.native.normal, fontSize: typography.caption.size, lineHeight: typography.caption.lineHeight, color: palette.gray },
});
