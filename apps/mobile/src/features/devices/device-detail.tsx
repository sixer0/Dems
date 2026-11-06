/**
 * Device detail body (04_mobile_specs §4.12 V5), shared by the phone route
 * (`/devices/[deviceId]`, `variant="screen"`) and the tablet detail pane (`variant="pane"`).
 *
 * Regions: header (back + name on the phone) · hero (cameras: the live CameraFeed; microphones:
 * the C-2 `large` meter with the CLIP reset; other devices: an icon plate) · status chip and device
 * ID · kit `Tabs` Overview / Health / Log · actions Run diagnostics, Test signal, Restart.
 *
 * - M3-10 R3 (audit row 198; D52, register I4; tablet half of web U-10, rows 104/107): on a Core in its own capture
 *   (`useNoProducerView`, the one reader `isOwnCaptureCoreState` or the picture rule) no "Synthetic demo values" chip
 *   is drawn. A value of the simulator's model reads "Not reported" (`system.noProducer`): the PoE switch and the
 *   indicator (overview, status chip), a microphone's channel, gain, phantom power and converter, and the derived
 *   health series. The measured microphone level (meter, `MicHealth`) is a real reading and stays. The tablet row is
 *   the tablet's own link fact and stays.
 * - Overview: a `KeyValueList` of the device's facts; gain and phantom are read-only (G13).
 * - Health: a victory-native line, 1 Hz, no animation (SIM-GAP-M84-2 derives the series).
 * - Log: the device's audit rows, newest first, labelled from codes (never the simulator's English).
 * - Restart needs the Technician role and is unavailable while recording (D79; SIM-GAP-M84-3).
 * - M3-11 (D96, D106; register 3.11 D4): on a Core in its own capture (`isOwnCaptureCoreState`, the one reader) Test
 *   signal and Restart are drawn disabled for every role, with `common.deviceMenuHint.notAvailable` beneath them
 *   (`device-command-not-available`), and nothing is sent: that Core refuses operations 48-50 (409
 *   COMMAND_UNSUPPORTED, DEVICE_COMMAND_NOT_AVAILABLE). It is the first and lasting block, said before the role or
 *   the recording (the web console's `NOT_AVAILABLE`). The dialog's 409 handler stays as defence in depth. Identify
 *   (operation 50) is not offered on the tablet. Diagnostics (operation 65) is no device command and stays as it is.
 * - Faults escalate calmly (03M P7): the chip pulses once and holds its colour; the hero greys to
 *   NO SIGNAL; a tablet-offline note says "Recording continues on the Core" only while a session records
 *   (M3-12, D50: shared `devices.other.tabletOfflineBody`), and the idle sentence otherwise
 *   (`devices.other.tabletOfflineIdleBody`), as the web console's `tabletOfflineBodyKey`.
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
 * simulation (MD-8): the dialog bodies, the toasts, the log's command names and the health caption
 * take `features.devices.live.*`; the diagnostics subtitle is the shared `system.live.diagnosticsSubtitle`,
 * the words of the web console and of Settings (closing copy round, D177 DN-5).
 */
import { cameraLinesInForce, micLinesInForce } from '@/features/capture-selector/selector-in-force';
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
import { Permission, isOwnCaptureCoreState, selectRole, useSim, type AuditRow, type DeviceCommand } from '@dems/shared/sim';
import { derived, fontFamily, palette, radius, spacing, toneHex, typography } from '@dems/shared/tokens';
import { KeyValueList, type KeyValueItem } from '@/components/kit';
import { CameraPreview } from './camera-preview';
import { DEMO_MEDIA_LIVE, demoVideoAssetOf } from '@/components/media/demo-media';
import { useLayoutClass } from '@/layout';
import { crossFadeIn, enterRise, triggerHaptic, useMotionPolicy, useMotionSettings, useMotionState } from '@/motion';
import { PendingSpinner, busyState, reportRuntimeIssue, useCoreErrorPresenter, useCoreLink } from '@/runtime';
import { DevelopmentSourceBadge, useSourceBadgeMode } from '@/features/capture-selector/development-source-badge';
import { useRoleGate } from '@/features/rbac/use-role-gate';
import { DeviceCommandDialog } from './device-command-dialog';
import { DeviceMicMeter } from './device-mic-meter';
import { DeviceStatusChip, NO_PRODUCER_DEVICES, NoProducerNotice, useNoProducerView, useNoProducerWord } from './device-status-chip';
import {
  DEVICE_CAMERA,
  DEVICE_KIND,
  DEVICE_NAME_KEY,
  DEVICE_SHORT_NAME_KEY,
  STATUS_LABEL_KEY,
  STATUS_TONE,
  cameraDetailFactsOf,
  detailFactsOf,
  // D61 (2026-11-04): the "Channel" fact names the ordinal of the channel code the mics slice states.
  micChannelNumber,
  relayWords,
  type DetailFacts,
  type DeviceId,
  type DeviceStatus,
} from './devices-model';
import { DiagnosticsSheet } from './diagnostics-sheet';
import { HealthChart } from './health-chart';
import { RegisteredDeviceDetail } from './registered-device-detail';
import { useDeviceDetailTarget } from './registered-device-rows';
import { rosterDeviceName } from './registered-devices-model';
import { cameraPoePortKey, channelOf } from './sim-adapter';
import { statedFormatText, statedTrackOf } from './stream-facts';
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
  useSourceRow,
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
  // Row 140 (D137 (2)): a device the Core registered beyond the built-in ids has its own details, from the Core's list.
  // Audit row 222 (D173): the key decides - a plain fixed-row id is that fixed row; `registered.<id>` is the Core's
  // device of that id (the bench's CAM-03 on VIDEO-01), unless it is back on its own line (`drawnByOwnTile`).
  const target = useDeviceDetailTarget(deviceId);
  const builtInId = target.builtInId;
  const known = builtInId !== null;
  const registered = target.registered;
  // The same "Live" as the badge reads (one rule for the name and the badge, D83 / D131).
  const { live } = useSourceBadgeMode();
  // Fix wave M (G70d-02): a built-in microphone line is named from the selector in force on a Core in its own capture.
  const builtIn = useSourceRow(known ? builtInId : 'TABLET', 'ONLINE');
  const name = known ? builtIn.name : registered !== null ? rosterDeviceName(t, registered, live) : deviceId;
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
          {known || registered !== null ? name : t('features.devices.header.detailTitle')}
        </Text>
      </View>
    ) : (
      <View style={styles.paneHeader}>
        <Text maxFontSizeMultiplier={1.2} accessibilityRole="header" numberOfLines={1} style={styles.headerTitle}>
          {known || registered !== null ? name : t('features.devices.header.detailTitle')}
        </Text>
      </View>
    );

  if (!known && registered !== null) return <RegisteredDeviceDetail device={registered} header={header} />;
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
  return <KnownDeviceDetail deviceId={builtInId} variant={variant} header={header} />;
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
  // Fix wave J (the one RBAC rule): operations 65 and 49 need DIAGNOSTICS_RUN. Every role of today holds it, so
  // the gate only ever says "Checking your permissions…" - but a role without it gets a disabled control with
  // the role's name, never a failing press.
  const diagnosticsGate = useRoleGate(Permission.DIAGNOSTICS_RUN);
  const roleKnown = useSim((state) => selectRole(state) !== null);
  const { layoutClass } = useLayoutClass();
  const [tab, setTab] = useState<DetailTab>('overview');
  const [diagnosticsOpen, setDiagnosticsOpen] = useState(false);
  const [command, setCommand] = useState<DeviceCommand | null>(null);
  const shortName = t(DEVICE_SHORT_NAME_KEY[deviceId]);
  // Fix wave M (G70d-02): the chip and the "Status" row say the selector line's word, as the tile above them.
  const row = useSourceRow(deviceId, status);
  // M3-10 R3 (row 198): the PoE switch and the indicator have no producer on a Core in its own capture - their chip reads I4.
  const noProducerView = useNoProducerView();
  const noProducerWord = useNoProducerWord();
  const chipWord = noProducerView && NO_PRODUCER_DEVICES.has(deviceId) ? noProducerWord : row.word;

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

  // M3-11 (D96, D106): a Core in its own capture refuses every device command, for every role and in every state.
  const commandsNotAvailable = useSim(isOwnCaptureCoreState);
  const notAvailableHint = t('common.deviceMenuHint.notAvailable');
  const testSignalBlocked = commandsNotAvailable || !diagnosticsGate.allowed;
  const testSignalHint = commandsNotAvailable ? notAvailableHint : diagnosticsGate.hint;
  const restartBlocked = commandsNotAvailable || !canManage || recording;
  // Task 3 row 68 (G9; ux §11, E-16): an unknown role reads "Checking your permissions…", never "Requires …".
  // M3-11: the not-available sentence is said first and alone (its own line below), so no restart hint then.
  const restartHint = commandsNotAvailable
    ? undefined
    : !roleKnown
    ? t('mobile.rbac.checking')
    : !canManage
      ? t('features.devices.actions.restartNeedsTechnician')
      : recording
        ? t('devices.actions.restartWhileRecording')
        : undefined;
  const landscape = variant === 'screen' && layoutClass === 'compact-landscape';

  const top = (
    <Animated.View entering={enterRise(0, m, { distance: 'riseLg' })} style={styles.block}>
      <DeviceHero deviceId={deviceId} status={status} onClipReset={resetClip} />
      <View style={styles.statusRow}>
        <DeviceStatusChip status={status} word={chipWord} size="md" testID="device-detail-status" />
        <Text maxFontSizeMultiplier={1.2} selectable style={styles.deviceId} testID="device-detail-id">
          {deviceId}
        </Text>
      </View>
      {/* Task 3 row 138 (ux §8f.2 "Devices rows"): the one "Development source" badge; no node when the Core sent no class. */}
      <DevelopmentSourceBadge deviceId={deviceId} testID="device-detail-source" />
      {deviceId === 'TABLET' && status === 'OFFLINE' ? (
        <Alert status="warning" testID="device-tablet-offline">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>{t('features.devices.other.deviceOfflineTitle')}</Alert.Title>
            {/* M3-12 (D50): the recording claim only while a session records; W1 idle, W2 recording (shared pair). */}
            <Alert.Description>
              {t(recording ? 'devices.other.tabletOfflineBody' : 'devices.other.tabletOfflineIdleBody')}
            </Alert.Description>
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
          <OverviewTab deviceId={deviceId} status={status} statusLabel={row.statusLabel} onClipReset={resetClip} />
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
          isDisabled={!diagnosticsGate.allowed}
          {...(diagnosticsGate.hint === null ? {} : { accessibilityHint: diagnosticsGate.hint })}
          {...busyState(diagnosticsPress.busy)}
        >
          {diagnosticsPress.pending ? <PendingSpinner color={palette.gold} testID="device-action-diagnostics-spinner" /> : <Stethoscope size={18} color={palette.gold} />}
          <Button.Label numberOfLines={1}>{t('features.devices.actions.diagnostics')}</Button.Label>
        </Button>
        <Button
          variant="outline"
          size="sm"
          style={styles.action}
          isDisabled={testSignalBlocked}
          // M3-11: nothing is sent while the block stands, even if a press reaches a disabled control.
          onPress={() => (testSignalBlocked ? undefined : setCommand('TEST_SIGNAL'))}
          testID="device-action-test-signal"
          {...(testSignalHint === null ? {} : { accessibilityHint: testSignalHint })}
        >
          <Activity size={18} color={commandsNotAvailable ? palette.gray : palette.gold} />
          <Button.Label numberOfLines={1}>{t('features.devices.actions.testSignal')}</Button.Label>
        </Button>
        <Button
          variant="outline"
          size="sm"
          style={styles.action}
          isDisabled={restartBlocked}
          onPress={() => (restartBlocked ? undefined : setCommand('RESTART'))}
          accessibilityHint={commandsNotAvailable ? notAvailableHint : restartHint}
          testID="device-action-restart"
        >
          <RotateCcw size={18} color={restartBlocked ? palette.gray : palette.gold} />
          <Button.Label numberOfLines={1}>{t('features.devices.actions.restart')}</Button.Label>
        </Button>
      </View>
      {commandsNotAvailable ? (
        <Text maxFontSizeMultiplier={1.2} style={styles.hint} testID="device-command-not-available">
          {notAvailableHint}
        </Text>
      ) : null}
      {diagnosticsGate.hint !== null && diagnosticsGate.hint !== restartHint ? (
        <Text maxFontSizeMultiplier={1.2} style={styles.hint} testID="device-diagnostics-hint">
          {diagnosticsGate.hint}
        </Text>
      ) : null}
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
  // D60 (2026-11-04): four camera tracks — the index is the track number (VIDEO-0n → n).
  const index = Number(trackId.slice(-1)) as 1 | 2 | 3 | 4;
  const name = t(DEVICE_NAME_KEY[deviceId]);
  return (
    <View style={styles.feedWrap}>
      {/* Fix wave H (G70-03; D196): the demo feed for a simulated Core, the "No preview" tile for a Core in real capture. */}
      <CameraPreview
        livePreview
        trackId={trackId}
        name={name}
        testID="device-detail-feed"
        cameraId={`CAM-${index}`}
        cameraLabel={`CAM ${index}`}
        mode={testSwitch ? 'poster' : 'live'}
        {...(testSwitch ? { image: demoVideoAssetOf(DEMO_MEDIA_LIVE, 'poster', trackId) } : {})}
        motion={policy}
        paused={!focused}
        noSignal={status === 'FAULT'}
        labels={{ noSignal: t('common.status.noSignal') }}
        // Fix wave J (JA2-33): the picture of a simulated Core is the bundled demo picture - never "Live preview".
        accessibilityLabel={t('devices.live.feedAria', { name })}
        style={styles.feed}
      />
    </View>
  );
}

function MicHero({ deviceId, onClipReset }: { deviceId: DeviceId; onClipReset: (channel: AudioTrackId) => void }) {
  const mic = useMic(deviceId);
  const focused = useIsFocused();
  if (!mic) return null;
  return (
    <View style={styles.meterPlate} testID="device-detail-meter-plate">
      <DeviceMicMeter
        mic={mic}
        variant="large"
        // Fix wave J (JA2-34): the large meter draws its own number, so the test switch does not stop its clock -
        // under that switch the motion policy is reduced (no tween), and the number stays the input's.
        paused={!focused}
        onClipReset={() => onClipReset(mic.id)}
        testID="device-detail-meter"
      />
    </View>
  );
}

function IconHero({ deviceId, status }: { deviceId: DeviceId; status: DeviceStatus }) {
  const { t } = useTranslation();
  const recording = useIsRecording();
  const Icon = OTHER_ICON[deviceId] ?? Tablet;
  // Fix wave J (JA2-33): ONE statement of the indicator, from the Core's session fact - red and "recording" only while a session records.
  const relay = deviceId === 'REC-INDICATOR' ? relayWords(status, recording) : null;
  const color = relay !== null ? (relay.lit ? palette.danger : relay.fault ? toneHex.danger : palette.gray) : deviceId === 'POE-SWITCH' ? palette.gold : toneHex[STATUS_TONE[status]];
  return (
    <View style={styles.iconPlate} testID="device-detail-icon-plate">
      <Icon size={48} color={color} />
      <Text maxFontSizeMultiplier={1.2} style={styles.iconPlateText} testID="device-detail-icon-state">
        {relay !== null ? t(relay.key) : t(STATUS_LABEL_KEY[status])}
      </Text>
    </View>
  );
}

// ── Overview ─────────────────────────────────────────────────────────────────────────────
function OverviewTab({ deviceId, status, statusLabel, onClipReset }: { deviceId: DeviceId; status: DeviceStatus; statusLabel: string; onClipReset: (channel: AudioTrackId) => void }) {
  switch (DEVICE_KIND[deviceId]) {
    case 'camera':
      return <CameraOverview deviceId={deviceId} statusLabel={statusLabel} />;
    case 'microphone':
      return <MicOverview deviceId={deviceId} statusLabel={statusLabel} onClipReset={onClipReset} />;
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

function Facts({ items, note }: { items: readonly KeyValueItem[]; note?: string }) {
  if (note === undefined) return <KeyValueList items={items} testID="device-overview" />;
  return (
    <View style={styles.block}>
      <KeyValueList items={items} testID="device-overview" />
      {/* Fix wave J (JA2-26): where the latch is shown, its remedy is said. */}
      <Text maxFontSizeMultiplier={1.2} style={styles.note} testID="device-clip-remedy" accessibilityLiveRegion="polite">
        {note}
      </Text>
    </View>
  );
}

/**
 * Fix wave L, closing pass L-Z (the ONE RULE; decision 5 of note 155): what this device's blocks may draw
 * (`detailFactsOf`). The adapter is the Core's own fact on the registry entry of the same id.
 */
function useDetailFacts(deviceId: DeviceId): DetailFacts {
  const ownCapture = useNoProducerView(); // row 198: the one own-capture reader, or the picture rule
  const adapter = useSim((s) => s.captureDevices.devices.find((device) => device.id === deviceId)?.adapter ?? null);
  return detailFactsOf(ownCapture, adapter);
}

/** A block of model values: on a Core in its own capture I4 in its place (row 198; no chip, no value); in every other case the block alone, as before. */
function ModelValues({ block, notReported, children }: { block: string; notReported: boolean; children: ReactNode }) {
  if (!notReported) return <>{children}</>;
  return <NoProducerNotice block={block} />;
}

function CameraOverview({ deviceId, statusLabel }: { deviceId: DeviceId; statusLabel: string }) {
  const { t } = useTranslation();
  const label = useFieldLabel();
  const camera = useCamera(deviceId);
  // Task 4 row W4 (review 060c R-02): a camera's own rule - a production camera draws only what the Core states, never the model's record.
  const ownCapture = useNoProducerView(); // row 198: the one own-capture reader, or the picture rule
  const adapter = useSim((s) => s.captureDevices.devices.find((device) => device.id === deviceId)?.adapter ?? null);
  const facts = cameraDetailFactsOf(ownCapture, adapter);
  // The stored stream statement of this camera's selector line, and the camera's fault where the Core reports one (`stream-facts.ts`).
  const stated = useSim((s) => statedTrackOf(s, (line) => line.deviceId === deviceId));
  // The format of a track on a Core in its own capture is its selector line's profile, never the model's resolution / fps.
  const profile = useSim((s) => {
    const stated = (cameraLinesInForce(s).find((line) => line.deviceId === deviceId) as { readonly profile?: unknown } | undefined)?.profile;
    return typeof stated === 'string' && stated !== '' ? stated : null;
  });
  if (!camera) return null;
  if (facts === 'GENERATED') {
    return (
      <Facts
        items={[
          { id: 'status', label: label('status'), value: statusLabel, testID: 'device-fact-status' },
          { id: 'deviceId', label: label('deviceId'), value: deviceId, mono: true },
          { id: 'source', label: t('common.developmentRoster.field.source'), value: t('common.developmentRoster.source.FAKE'), testID: 'device-fact-source' },
          { id: 'format', label: label('format'), value: profile ?? t('common.platformNotReported.value'), mono: profile !== null, testID: 'device-fact-format' },
          { id: 'recState', label: label('recState'), value: camera.recState ? t(`common.enums.trackRecState.${camera.recState}`) : EMPTY_DATE_TEXT },
        ]}
      />
    );
  }
  if (facts === 'STATED') {
    return (
      <Facts
        items={[
          { id: 'status', label: label('status'), value: statusLabel, testID: 'device-fact-status' },
          { id: 'deviceId', label: label('deviceId'), value: deviceId, mono: true },
          // The stored stream facts, "Not stated" where the line names none; the fault in their place while the Core reports one.
          { id: 'format', label: label('format'), value: statedFormatText(t, stated, 'line'), testID: 'device-fact-format' },
          { id: 'recState', label: label('recState'), value: camera.recState ? t(`common.enums.trackRecState.${camera.recState}`) : EMPTY_DATE_TEXT },
        ]}
      />
    );
  }
  return (
    <ModelValues block="camera" notReported={false}>
      <Facts
        items={[
          { id: 'status', label: label('status'), value: statusLabel, testID: 'device-fact-status' },
          { id: 'deviceId', label: label('deviceId'), value: deviceId, mono: true },
          { id: 'model', label: label('model'), value: camera.model },
          { id: 'firmware', label: label('firmware'), value: camera.firmware, mono: true },
          { id: 'port', label: label('port'), value: t(cameraPoePortKey(deviceId)), testID: 'device-fact-port' },
          {
            id: 'format',
            label: label('format'),
            // Row 55 (P12-F08): the slice's picture, rate and codec; a stream that states no rate (`fps` null) reads without one.
            // Row V6 (S-01): a track with no stored stream statement (`resolution` or `codec` null) reads "Not stated", never a default.
            value:
              camera.resolution === null || camera.codec === null
                ? t('common.devices.cameraFormatNotStated')
                : camera.fps === null
                  ? t('common.devices.cameraFormatCodecNoRate', { resolution: camera.resolution, codec: camera.codec })
                  : t('common.devices.cameraFormatCodec', { resolution: camera.resolution, fps: camera.fps, codec: camera.codec }),
            testID: 'device-fact-format',
          },
          { id: 'bitrate', label: label('bitrate'), value: t('features.devices.detail.mbps', { value: camera.bitrateMbps }) },
          { id: 'recState', label: label('recState'), value: camera.recState ? t(`common.enums.trackRecState.${camera.recState}`) : EMPTY_DATE_TEXT },
        ]}
      />
    </ModelValues>
  );
}

function MicOverview({ deviceId, statusLabel, onClipReset }: { deviceId: DeviceId; statusLabel: string; onClipReset: (channel: AudioTrackId) => void }) {
  const { t } = useTranslation();
  const label = useFieldLabel();
  const mic = useMic(deviceId);
  const facts = useDetailFacts(deviceId);
  if (!mic) return null;
  const clip: KeyValueItem = {
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
  };
  if (facts === 'GENERATED') {
    // No channel, gain, phantom power or converter: those are the simulator's model, and a generated tone has none.
    return (
      <Facts
        items={[
          { id: 'status', label: label('status'), value: statusLabel, testID: 'device-fact-status' },
          { id: 'deviceId', label: label('deviceId'), value: deviceId, mono: true },
          { id: 'source', label: t('common.developmentRoster.field.source'), value: t('common.developmentRoster.source.FAKE'), testID: 'device-fact-source' },
          clip,
          { id: 'recState', label: label('recState'), value: mic.recState ? t(`common.enums.trackRecState.${mic.recState}`) : EMPTY_DATE_TEXT },
        ]}
        {...(mic.clipLatched ? { note: t('features.devices.detail.clipRemedy') } : {})}
      />
    );
  }
  // M3-10 R3 (row 198; D52, I4): on a Core in its own capture the model's channel, gain, phantom power and converter
  // read "Not reported", with no chip and no "read-only in this demo" note. Status, id, CLIP latch and recording state are the Core's.
  const notReported = facts === 'MODEL_VALUES';
  const model = (value: string): string => (notReported ? t('system.noProducer') : value);
  return (
    <View style={styles.block}>
      <Facts
        items={[
          { id: 'status', label: label('status'), value: statusLabel, testID: 'device-fact-status' },
          { id: 'deviceId', label: label('deviceId'), value: deviceId, mono: true },
          { id: 'channel', label: label('channel'), value: model(t('devices.drawer.value.channel', { channel: micChannelNumber(mic.channel) })), testID: 'device-fact-channel' }, // D61 (2026-11-04): the slice states the code; the fact keeps the ordinal
          { id: 'gain', label: label('gain'), value: model(t('devices.audio.gainValue', { value: mic.gainDb })), testID: 'device-fact-gain' },
          { id: 'phantom', label: label('phantom'), value: model(mic.phantom ? t('devices.audio.phantomOn') : t('devices.audio.phantomOff')), testID: 'device-fact-phantom' },
          clip,
          { id: 'recState', label: label('recState'), value: mic.recState ? t(`common.enums.trackRecState.${mic.recState}`) : EMPTY_DATE_TEXT },
          { id: 'adc', label: label('adc'), value: model(t('devices.drawer.value.adc')), testID: 'device-fact-adc' },
        ]}
        {...(mic.clipLatched ? { note: t('features.devices.detail.clipRemedy') } : {})}
      />
      {notReported ? null : (
        <Text maxFontSizeMultiplier={1.2} style={styles.hint}>
          {t('features.devices.detail.readOnlyNote')}
        </Text>
      )}
    </View>
  );
}

function PoeOverview({ status }: { status: DeviceStatus }) {
  const { t } = useTranslation();
  const label = useFieldLabel();
  const poe = useBookPoe();
  const notReported = useNoProducerView();
  return (
    <ModelValues block="poe" notReported={notReported}>
      <Facts
        items={[
          { id: 'status', label: label('status'), value: t(STATUS_LABEL_KEY[status]) },
          { id: 'ports', label: label('ports'), value: t('devices.other.poeSummary', { active: poe.active, spare: poe.spare }), testID: 'device-fact-ports' },
          { id: 'cam1', label: t('devices.ports.poeCam1'), value: poe.cam1Link ? t('devices.ports.linkUp') : t('devices.ports.linkDown') },
          { id: 'cam2', label: t('devices.ports.poeCam2'), value: t('devices.ports.spare') },
          // D60 (2026-11-04): the two further camera ports on the switch.
          { id: 'cam3', label: t('devices.ports.poeCam3'), value: poe.cam3Link ? t('devices.ports.linkUp') : t('devices.ports.linkDown') },
          { id: 'cam4', label: t('devices.ports.poeCam4'), value: poe.cam4Link ? t('devices.ports.linkUp') : t('devices.ports.linkDown') },
          { id: 'power', label: label('power'), value: t('features.devices.detail.watts', { value: poe.drawW.toFixed(1) }) },
          { id: 'budget', label: label('budget'), value: t('features.devices.detail.watts', { value: poe.budgetW }) },
        ]}
      />
    </ModelValues>
  );
}

function RelayOverview({ status }: { status: DeviceStatus }) {
  const { t } = useTranslation();
  const label = useFieldLabel();
  const recording = useIsRecording();
  const notReported = useNoProducerView();
  return (
    <ModelValues block="relay" notReported={notReported}>
      <Facts
        items={[
          { id: 'status', label: label('status'), value: t(relayWords(status, recording).key), testID: 'device-fact-relay-status' },
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
    </ModelValues>
  );
}

function TabletOverview({ status }: { status: DeviceStatus }) {
  const { t } = useTranslation();
  const label = useFieldLabel();
  const link = useTabletLink();
  // M3-10 R3 (row 198): the tablet's own link fact, as the web's TABLET row (row 107) - drawn on every Core, no chip.
  return (
    <ModelValues block="tablet" notReported={false}>
      <Facts
        items={[
          { id: 'status', label: label('status'), value: t(STATUS_LABEL_KEY[status]) },
          { id: 'link', label: label('link'), value: t('devices.other.tabletLink') },
          { id: 'since', label: label('since'), value: t('features.devices.detail.sinceValue', { time: formatClock(link.changedAt) }), mono: true },
          { id: 'self', label: label('pairing'), value: t('features.devices.detail.tabletSelf') },
        ]}
      />
    </ModelValues>
  );
}

// ── Health ───────────────────────────────────────────────────────────────────────────────
function HealthTab({ deviceId, live }: { deviceId: DeviceId; live: boolean }) {
  // Ruling D137: the meter channel of a microphone is the position of its line in the capture configuration.
  const channel = useSim((s) => channelOf(deviceId, micLinesInForce(s)));
  return channel ? <MicHealth channel={channel} live={live} /> : <DeviceHealth deviceId={deviceId} live={live} />;
}

function DeviceHealth({ deviceId, live }: { deviceId: DeviceId; live: boolean }) {
  const series = useHealthSeries(deviceId);
  // The series is derived from the simulator's model (see the file header, Health): on a Core in its own capture it reads I4 (row 198).
  const notReported = useNoProducerView();
  const facts = useDetailFacts(deviceId);
  const { t } = useTranslation();
  // Fix wave J (JT-03): a generated source of a Core in its own capture has no link the Core measures - "Link
  // quality 99.9%" beside "Not checked" was the model's figure. Nothing is drawn but the statement.
  if (facts === 'GENERATED') {
    return (
      <View style={styles.block} testID="device-health-not-reported" accessible accessibilityRole="text">
        <Text maxFontSizeMultiplier={1.2} style={styles.body}>
          {t('common.platformNotReported.value')}
        </Text>
        <Text maxFontSizeMultiplier={1.2} style={styles.note}>
          {t('features.devices.health.notReported')}
        </Text>
      </View>
    );
  }
  return (
    <ModelValues block="health" notReported={notReported}>
      <HealthChart series={series} testID="device-health" live={live} />
    </ModelValues>
  );
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
  note: { fontFamily: fontFamily.native.normal, fontSize: typography.caption.size, lineHeight: typography.caption.lineHeight, color: palette.gray },
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
