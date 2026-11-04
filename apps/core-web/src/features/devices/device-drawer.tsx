import { auditTypeWords, faultKindWords } from '@/lib/event-words'
import { useEffect, useRef, useState, type Key, type ReactNode } from 'react'
import { Button, Drawer, EmptyState, Table, Tabs } from '@heroui/react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import {
  ArrowRight,
  Camera,
  Lightbulb,
  MapPinned,
  Mic,
  MonitorCog,
  Network,
  ShieldCheck,
  TabletSmartphone,
  type LucideIcon,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import type { EnResources } from '@dems/shared/i18n'
import { CoreMode, LiveLinkState, useCoreMode, useCorePermission, useLiveLink } from '@dems/shared/live'
import { DATE_PATTERNS, EMPTY_DATE_TEXT, formatDate, useRetryCooldown } from '@dems/shared/realtime'
import {
  DEVICE_IDENTITY,
  DeviceCommand,
  Permission,
  selectCameraById,
  selectMicById,
  TabletLinkState,
  useSim,
  type AuditRow,
  type FaultKind,
} from '@dems/shared/sim'
import { useCoreErrorPresenter } from '@/lib/core-errors'
import { useOwnCaptureCore, usePlatformNotReported, useSelfCaptureCore } from '@/lib/own-capture'
import { CoreReadError, pairedDevicesQueryOptions, retryCoreQuery, usePairedDevicesGate, useQueryFailure } from '@/lib/core-queries'
import { CORE_QUERY_KEYS } from '@/runtime'
import { HealthChart } from './health-chart'
import { useDeviceLabels } from './labels'
import { useDeviceWords, type DeviceWords } from './live'
import { deviceStatus, STATUS_SEVERITY, STATUS_TONE, type DeviceTone } from './model'
import { DevicesErrorBoundary } from './panel'
import { reportDevicesError } from './report'
import {
  bookPoe,
  CAMERA_TRACK_POE_PORT, // D60 (2026-11-04): the tile shows its own port
  DEVICE_CAMERA,
  DEVICE_MIC,
  deviceLog,
  frontPanelLeds,
  POE_PORT_BUDGET_W,
  type DeviceId,
} from './sim-adapter'
import { DeviceSourceMarks } from './source-badge'
import { useRealCaptureCore } from './source-class'
import { StatusChip, StatusDot } from './status-chip'
import { useStatedFormat } from './stream-facts'

type DrawerTab = 'overview' | 'health' | 'log'

const ICONS: Record<DeviceId, LucideIcon> = {
  'CAM-01': Camera,
  'CAM-02': Camera,
  'CAM-03': Camera, // D60 (2026-11-04)
  'CAM-04': Camera, // D60
  'MIC-01': Mic,
  'MIC-02': Mic,
  'MIC-03': Mic, // D61 (2026-11-04): the four-channel microphone plane
  'MIC-04': Mic, // D61
  'POE-SWITCH': Network,
  'REC-INDICATOR': Lightbulb,
  TABLET: TabletSmartphone,
  GNSS: MapPinned,
  TPM: ShieldCheck,
  'FRONT-PANEL': MonitorCog,
}

export interface DeviceDrawerProps {
  /** The device to show, or null (closed). */
  deviceId: DeviceId | null
  onClose: () => void
}

/**
 * Device Drawer (01_specs §14.5.4 "Device Drawer: Overview, Health, Log"; research/04 §5.2): the
 * kit `Drawer` from the right with kit `Tabs`: Overview (key facts), Health (Recharts line,
 * the simulator's per-device series) and Log (kit `Table` of the device's audit rows, mapped to i18n by type and
 * kind, review 40 m4). Transitions are the kit defaults (M-C-15, D6). The last device stays
 * rendered while the drawer closes, so the exit shows content, not an empty panel.
 */
export function DeviceDrawer({ deviceId, onClose }: DeviceDrawerProps) {
  const labels = useDeviceLabels()
  const [shown, setShown] = useState<DeviceId | null>(deviceId)
  if (deviceId !== null && deviceId !== shown) setShown(deviceId)
  const current = deviceId ?? shown
  return (
    <Drawer.Backdrop
      isOpen={deviceId !== null}
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <Drawer.Content placement="right">
        <Drawer.Dialog
          aria-label={current ? labels.name(current) : undefined}
          className="dev-drawer w-[460px] max-w-[92vw]"
          data-testid="device-drawer"
          data-device={current ?? undefined}
        >
          {current ? <DrawerContent key={current} deviceId={current} /> : null}
        </Drawer.Dialog>
      </Drawer.Content>
    </Drawer.Backdrop>
  )
}

function DrawerContent({ deviceId }: { deviceId: DeviceId }) {
  const { t } = useTranslation()
  const labels = useDeviceLabels()
  const [tab, setTab] = useState<DrawerTab>('overview')
  const status = useSim((s) => deviceStatus(s, deviceId))
  const Icon = ICONS[deviceId]
  const counted = deviceId !== 'FRONT-PANEL'
  return (
    <>
      <Drawer.Header className="dev-drawer-header">
        <span className="dev-drawer-icon" data-tone={counted ? STATUS_TONE[status] : 'success'}>
          <Icon aria-hidden="true" size={22} strokeWidth={1.6} />
        </span>
        <div className="dev-drawer-titles">
          <Drawer.Heading className="dev-drawer-heading">{labels.fullName(deviceId)}</Drawer.Heading>
          <p className="dev-drawer-sub">
            {labels.kind(deviceId)} · {deviceId === 'FRONT-PANEL' ? DEVICE_IDENTITY.serialNumber : deviceId}
          </p>
          {/* Task 3 R-11 (blueprint row 137; ux §8f.2 "the device drawer header"): the one badge, from the Core's `sourceClass`. */}
          <DeviceSourceMarks deviceId={deviceId} place="drawer" />
        </div>
        {counted ? (
          <StatusChip tone={STATUS_TONE[status]} label={t(`devices.status.${status}`)} severity={STATUS_SEVERITY[status]} testId="drawer-status" />
        ) : null}
        <Drawer.CloseTrigger aria-label={t('common.actions.close')} />
      </Drawer.Header>
      <Drawer.Body className="dev-drawer-body">
        <DevicesErrorBoundary panel="drawer">
          <Tabs selectedKey={tab} onSelectionChange={(key: Key) => setTab(String(key) as DrawerTab)} className="dev-tabs">
            <Tabs.List aria-label={t('devices.drawer.tabsLabel')} className="dev-tab-list">
              <Tabs.Tab id="overview" data-testid="drawer-tab-overview">
                {t('devices.drawer.tabs.overview')}
                <Tabs.Indicator />
              </Tabs.Tab>
              <Tabs.Tab id="health" data-testid="drawer-tab-health">
                {t('devices.drawer.tabs.health')}
                <Tabs.Indicator />
              </Tabs.Tab>
              <Tabs.Tab id="log" data-testid="drawer-tab-log">
                {t('devices.drawer.tabs.log')}
                <Tabs.Indicator />
              </Tabs.Tab>
            </Tabs.List>
            <Tabs.Panel id="overview" className="dev-tab-panel">
              <Overview deviceId={deviceId} />
            </Tabs.Panel>
            <Tabs.Panel id="health" className="dev-tab-panel">
              <HealthChart deviceId={deviceId} />
            </Tabs.Panel>
            <Tabs.Panel id="log" className="dev-tab-panel">
              <DeviceLog deviceId={deviceId} />
            </Tabs.Panel>
          </Tabs>
        </DevicesErrorBoundary>
      </Drawer.Body>
    </>
  )
}

// ── Overview ─────────────────────────────────────────────────────────────────────────────
type Fact = readonly [label: string, value: ReactNode]

function Facts({ facts }: { facts: readonly Fact[] }) {
  return (
    <dl className="dev-facts" data-testid="device-overview">
      {facts.map(([label, value]) => (
        <div key={label} className="dev-facts-row">
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  )
}

function Overview({ deviceId }: { deviceId: DeviceId }) {
  switch (deviceId) {
    case 'CAM-01':
    case 'CAM-02':
      return <CameraOverview deviceId={deviceId} />
    case 'MIC-01':
    case 'MIC-02':
      return <MicOverview deviceId={deviceId} />
    case 'POE-SWITCH':
      return <PoeOverview />
    case 'REC-INDICATOR':
      return <RelayOverview />
    case 'TABLET':
      return <TabletOverview />
    case 'GNSS':
      return <GnssOverview />
    case 'TPM':
      return <TpmOverview />
    case 'FRONT-PANEL':
      return <PanelOverview />
  }
}

type FieldKey = keyof EnResources['devices']['drawer']['field']

function useFieldLabel(): (key: FieldKey) => string {
  const { t } = useTranslation()
  return (key) => t(`devices.drawer.field.${key}`)
}

function CameraOverview({ deviceId }: { deviceId: 'CAM-01' | 'CAM-02' | 'CAM-03' | 'CAM-04' }) { // D60 (2026-11-04): four built-in cameras
  const { t } = useTranslation()
  const label = useFieldLabel()
  const labels = useDeviceLabels()
  const trackId = DEVICE_CAMERA[deviceId] ?? 'VIDEO-01'
  const camera = useSim((s) => selectCameraById(s, trackId))
  const status = useSim((s) => deviceStatus(s, deviceId))
  // Fix wave K (C-2, ruling D222 (2)): on a Core in real capture the model ("Dual-lens IP camera DL-2"), the firmware,
  // the format, the bitrate and the PoE port are the simulator's camera record - the source behind the track may be a generated one.
  const realCapture = useRealCaptureCore()
  const notReported = t('common.platformNotReported.value')
  // Task 4 row W4 (review 060c R-04): on a Core in real capture the format is the stored stream statement of the track's
  // selector line - "Not stated" where it names none - or the camera's fault where the Core reports one (`stream-facts.ts`).
  // The model, the firmware, the bitrate and the PoE port have no statement of the Core: "Not reported", as before.
  const stated = useStatedFormat(trackId, 'line')
  if (!camera) return null
  return (
    <Facts
      facts={[
        [label('status'), t(`devices.status.${status}`)],
        [label('deviceId'), <Mono key="id">{camera.deviceId}</Mono>],
        [label('model'), realCapture ? notReported : camera.model],
        [label('firmware'), realCapture ? notReported : <Mono key="fw">{camera.firmware}</Mono>],
        [label('track'), <Mono key="track">{camera.id}</Mono>],
        // A stream that states no rate (`fps` null) reads its picture and codec without one (task 4 row 54 / I-3, P12-F08).
        [
          label('format'),
          stated !== null
            ? stated.text
            : realCapture
            ? notReported
            : // Row V6 (S-01): no stored stream statement - "Not stated", never a default.
              camera.resolution === null || camera.codec === null
              ? t('common.devices.cameraFormatNotStated')
              : camera.fps === null
              ? t('common.devices.cameraFormatCodecNoRate', { resolution: camera.resolution, codec: camera.codec })
              : t('common.devices.cameraFormatCodec', { resolution: camera.resolution, fps: camera.fps, codec: camera.codec }),
        ],
        // Pass I-9b: null = no telemetry states a bitrate - "Not reported", never a figure.
        [label('bitrate'), realCapture || camera.bitrateMbps === null ? notReported : t('common.units.mbps', { value: camera.bitrateMbps })],
        [label('port'), realCapture ? notReported : labels.port(CAMERA_TRACK_POE_PORT[trackId])], // D60 (2026-11-04): each track's own port
        [label('recState'), camera.recState ? t(`common.enums.trackRecState.${camera.recState}`) : EMPTY_DATE_TEXT],
      ]}
    />
  )
}

function MicOverview({ deviceId }: { deviceId: 'MIC-01' | 'MIC-02' }) {
  const { t } = useTranslation()
  const label = useFieldLabel()
  const labels = useDeviceLabels()
  const channel = DEVICE_MIC[deviceId] ?? 'AUDIO-01'
  const mic = useSim((s) => selectMicById(s, channel))
  const status = useSim((s) => deviceStatus(s, deviceId))
  // Fix wave L (G75d-06): the channel, the rear port, the gain, the phantom power and the converter are the simulator's
  // microphone record - on a Core in real capture the source behind the line may be a generated one.
  const realCapture = useRealCaptureCore()
  const notReported = t('common.platformNotReported.value')
  if (!mic) return null
  return (
    <Facts
      facts={[
        [label('status'), t(`devices.status.${status}`)],
        [label('deviceId'), <Mono key="id">{mic.deviceId}</Mono>],
        [label('track'), <Mono key="track">{mic.id}</Mono>],
        [label('channel'), realCapture ? notReported : t('devices.drawer.value.channel', { channel: mic.channel })],
        [label('port'), realCapture ? notReported : labels.port(channel === 'AUDIO-01' ? 'MIC_IN_1' : 'MIC_IN_2')],
        [label('gain'), realCapture ? notReported : t('devices.audio.gainValue', { value: mic.gainDb })],
        [label('phantom'), realCapture ? notReported : mic.phantom ? t('devices.audio.phantomOn') : t('devices.audio.phantomOff')],
        [label('adc'), realCapture ? notReported : t('devices.drawer.value.adc')],
        [label('recState'), mic.recState ? t(`common.enums.trackRecState.${mic.recState}`) : EMPTY_DATE_TEXT],
      ]}
    />
  )
}

function PoeOverview() {
  const { t } = useTranslation()
  const label = useFieldLabel()
  const poe = useSim(bookPoe)
  return (
    <Facts
      facts={[
        [label('status'), t(`devices.status.${poe.cam1Link ? 'ACTIVE' : 'FAULT'}`)],
        [label('ports'), t('devices.other.poeSummary', { active: poe.active, spare: poe.spare })],
        [label('power'), `${poe.drawW.toFixed(1)} W`],
        [label('budget'), `${POE_PORT_BUDGET_W} W + ${POE_PORT_BUDGET_W} W (${poe.budgetW} W)`],
        [t('devices.ports.poeCam1'), poe.cam1Link ? t('devices.ports.tip.poeCam1', { watts: poe.cam1DrawW.toFixed(1) }) : t('devices.ports.linkDown')],
        [t('devices.ports.poeCam2'), t('devices.ports.tip.poeCam2')],
      ]}
    />
  )
}

function RelayOverview() {
  const { t } = useTranslation()
  const label = useFieldLabel()
  const lit = useSim((s) => deviceStatus(s, 'REC-INDICATOR') === 'LAMP_ON')
  const relayLink = useSim((s) => s.ports.find((port) => port.id === 'RELAY_IO')?.link ?? false)
  return (
    <Facts
      facts={[
        [label('status'), t(`devices.status.${lit ? 'LAMP_ON' : 'STANDBY'}`)],
        [label('lamp'), lit ? `${t('devices.other.recordingLamp')} · ${t('devices.other.recordingLampGloss')}` : t('devices.front.lcd.off')],
        [label('port'), t('devices.ports.relayIo')],
        [label('link'), relayLink ? t('devices.ports.linkUp') : t('devices.ports.linkDown')],
      ]}
    />
  )
}

function TabletOverview() {
  const { t } = useTranslation()
  const label = useFieldLabel()
  const live = useCoreMode() === CoreMode.LIVE
  const link = useSim((s) => s.tabletLink)
  // In Live mode this is the neutral value of the web console, which no screen reads (§2.3).
  const pairing = useSim((s) => s.pairing.state)
  const ip = useSim((s) => s.network.ip)
  return (
    <Facts
      facts={[
        [label('status'), t(`common.tabletLinkState.${link.state}`)],
        [label('since'), <Mono key="since">{formatDate(link.changedAt, DATE_PATTERNS.dateTime)}</Mono>],
        [label('link'), t('devices.other.tabletLink')],
        [label('address'), <Mono key="ip">{ip}</Mono>],
        live
          ? [t('devices.live.pairedDevices.label'), <PairedDevicesFact key="paired" />]
          : [label('pairing'), t(`common.pairingState.${pairing}`)],
      ]}
    />
  )
}

/** The fixed sentence of the page's own record when the registry could not be read for a reason the presenter left to the page. */
const REGISTRY_FAILED_RECORD = 'The paired-device registry could not be read for the device drawer.'

/**
 * The "Paired devices" row of the tablet drawer in Live mode (04_client_integration_spec §7.3 note
 * G6, gap GS-16; plan row W70). The web console does not pair [SP:§6.9], so the Simulated row
 * (`s.pairing.state`) would describe nothing here. A holder of `PAIRING_MANAGE` (the server's hint,
 * which follows `session.updated`) sees "n paired, m online" from operation 19 with a link to the
 * Paired Devices page; any other operator sees whether a paired device is connected, from
 * `tabletLink`, which the Core sets from real device connections [SP:§6.8].
 */
function PairedDevicesFact() {
  const canList = useCorePermission(Permission.PAIRING_MANAGE)
  return canList ? <PairedDevicesSummary /> : <TabletLinkSentence />
}

function TabletLinkSentence() {
  const { t } = useTranslation()
  const connected = useSim((s) => s.tabletLink.state === TabletLinkState.CONNECTED)
  return (
    <span data-testid="drawer-paired-link" data-connected={connected ? 'true' : 'false'}>
      {connected ? t('devices.live.pairedDevices.connected') : t('devices.live.pairedDevices.none')}
    </span>
  )
}

/**
 * "n paired, m online" from `listPairedDevices`, kept under `CORE_QUERY_KEYS.pairedDevices` as the
 * operation's own answer (`PairedDeviceList`): the query bridge refetches it on `admin.changed`
 * DEVICES and on a resync, and removes it when the session ends or loses `PAIRING_MANAGE`
 * (PG-6, PG-6a). It is read only while the link is up: with the link down the row shows the
 * tablet link sentence, and the shell says the Core is unreachable (rule 6).
 *
 * RESIDUAL-W70-1 (W83 ledger #45), closed by E-fix FX-C (ruling R4 of D201, gated in D202): the Core
 * server now publishes one debounced `admin.changed` DEVICES (1 s after the last change, at most 5 s
 * after the first) when a paired device's socket is admitted or departs and when a device signs in or
 * out, so the bridge refetch keeps the `online` member current. The refetch on a change of the
 * replicated tablet link, added while that message was missing, stays as a second path.
 */
function PairedDevicesSummary() {
  const { t } = useTranslation()
  const linkUp = useLiveLink() === LiveLinkState.ONLINE
  const presentCoreError = useCoreErrorPresenter()
  const queryClient = useQueryClient()
  const tabletChangedAt = useSim((s) => s.tabletLink.changedAt)

  // W92-3 / W92-8: the one definition of operation 19 (`lib/core-queries.ts`), whose gate holds the
  // signed-in term of D176 as well as the link and PAIRING_MANAGE: after a sign-out this row, still on
  // screen until the shell leaves, asks nothing.
  const query = useQuery(pairedDevicesQueryOptions(usePairedDevicesGate()))
  useQueryFailure(query, (error) => {
    const answer = error instanceof CoreReadError ? error.failure : null
    if (answer === null) return
    // Rule 2 of the page rows: the presenter first (a 403 names the role; an outage, a 429 ...).
    if (presentCoreError(answer, { permission: Permission.PAIRING_MANAGE }) === null) {
      reportDevicesError('features/devices.pairedDevices', answer, REGISTRY_FAILED_RECORD, { operationId: 'listPairedDevices', code: answer.error.code }, 'warn')
    }
  })

  // RESIDUAL-W70-1 (closed, D202): the tablet link changes when a device comes or goes; this refetch came
  // before the Core's debounced `admin.changed` DEVICES and stays as a second path.
  const seenChange = useRef(tabletChangedAt)
  useEffect(() => {
    if (seenChange.current === tabletChangedAt) return
    seenChange.current = tabletChangedAt
    void queryClient.invalidateQueries({ queryKey: CORE_QUERY_KEYS.pairedDevices })
  }, [queryClient, tabletChangedAt])

  // W92-4: Retry through the key, so the read's gate holds for a press as it does for a mount.
  const { retry, cooldown, exhausted, canRetry } = useRetryCooldown(() => {
    retryCoreQuery(queryClient, CORE_QUERY_KEYS.pairedDevices)
  })

  if (query.data !== undefined) {
    const paired = query.data.devices.filter((device) => device.state === 'PAIRED')
    const online = paired.filter((device) => device.online).length
    return (
      <span className="dev-facts-paired" data-testid="drawer-paired-summary">
        <span>{t('devices.live.pairedDevices.summary', { paired: paired.length, online })}</span>
        <Link to="/admin/devices" className="dev-facts-link" data-testid="drawer-paired-open">
          <span>{t('devices.live.pairedDevices.open')}</span>
          <ArrowRight aria-hidden="true" size={14} />
        </Link>
      </span>
    )
  }
  if (query.isError) {
    // Layer 3: what every operator sees, the registry's absence named, a rate-limited retry.
    return (
      <span className="dev-facts-paired" data-testid="drawer-paired-error">
        <TabletLinkSentence />
        <span className="text-foreground-2">{t('devices.live.pairedDevices.unavailable')}</span>
        <Button size="sm" variant="outline" isDisabled={!canRetry || !linkUp} onPress={retry} data-testid="drawer-paired-retry">
          {exhausted ? t('common.errors.maxRetries') : cooldown > 0 ? t('common.actions.retryIn', { seconds: cooldown }) : t('common.actions.retry')}
        </Button>
      </span>
    )
  }
  if (query.isFetching) {
    return (
      <span className="text-foreground-2" data-testid="drawer-paired-loading">
        {t('devices.live.pairedDevices.loading')}
      </span>
    )
  }
  // Not read: the link is down. What every operator sees.
  return <TabletLinkSentence />
}

function GnssOverview() {
  const { t } = useTranslation()
  const label = useFieldLabel()
  const time = useSim((s) => s.time)
  // Fix wave K (C-2 / G75c-04): a Core on its host clock has no GNSS receiver - no "No fix", no "RTC", no stratum, offset, last sync or server.
  const hostClock = useOwnCaptureCore()
  if (hostClock) {
    return (
      <Facts
        facts={[
          [label('status'), t('web.ownCore.time.notConfigured')],
          [label('source'), t('web.ownCore.time.value')],
        ]}
      />
    )
  }
  return (
    <Facts
      facts={[
        [label('status'), t(`devices.status.${time.gnss.locked && time.source === 'GNSS' ? 'LOCKED' : 'NO_FIX'}`)],
        [label('source'), t(`common.enums.timeSource.${time.source}`)],
        [label('satellites'), <Mono key="sats">{time.gnss.satellites}</Mono>],
        [label('stratum'), <Mono key="stratum">{time.stratum}</Mono>],
        [label('offset'), <Mono key="offset">{t('common.units.ms', { value: time.offsetMs.toFixed(1) })}</Mono>],
        [label('lastSync'), <Mono key="sync">{formatDate(time.lastSyncAt, DATE_PATTERNS.dateTime)}</Mono>],
        [label('ntp'), <Mono key="ntp">{time.ntp.server}</Mono>],
      ]}
    />
  )
}

function TpmOverview() {
  const { t } = useTranslation()
  const label = useFieldLabel()
  const security = useSim((s) => s.security)
  // Fix wave K (C-2): a Core that reads no TPM states no model, no attestation, no Secure Boot state. A failed TPM (a raised fault) keeps its rows.
  const platformNotReported = usePlatformNotReported()
  if (platformNotReported && security.tpm.ok) {
    const notReported = t('common.platformNotReported.value')
    return (
      <Facts
        facts={[
          [label('status'), notReported],
          [label('model'), notReported],
          [label('attestation'), t('common.platformNotReported.note')],
          [label('secureBoot'), notReported],
        ]}
      />
    )
  }
  return (
    <Facts
      facts={[
        [label('status'), t(`devices.status.${security.tpm.ok ? 'OK' : 'FAILED'}`)],
        [label('model'), DEVICE_IDENTITY.tpmModelFirmware],
        [label('attestation'), security.tpm.ok ? t('devices.other.tpmOk') : t('devices.other.tpmFail')],
        [label('secureBoot'), security.secureBoot ? t('common.status.enabled') : t('common.status.disabled')],
        [label('encryption'), <Mono key="enc">{security.encryption}</Mono>],
      ]}
    />
  )
}

function PanelOverview() {
  const { t } = useTranslation()
  const label = useFieldLabel()
  const leds = useSim(frontPanelLeds)
  const health = useSim((s) => s.health)
  const ownCore = useSelfCaptureCore()
  return (
    <Facts
      facts={[
        [label('display'), t('devices.drawer.value.display')],
        [
          label('leds'),
          <span key="leds" className="dev-facts-leds">
            {(Object.keys(leds) as (keyof typeof leds)[]).map((id) => (
              <span key={id} className="dev-facts-led" data-state={leds[id]}>
                {t(`devices.front.leds.${id}`)}: {t(`devices.front.ledState.${leds[id]}`)}
              </span>
            ))}
          </span>,
        ],
        [label('temperature'), <Mono key="temp">{t('common.units.celsius', { value: health.cpuTempC.toFixed(1) })}</Mono>],
        [label('fan'), <Mono key="fan">{health.fanOk ? t('common.units.rpm', { value: health.fanRpm }) : t('common.faultKind.FAN_STALL')}</Mono>],
        // Fix wave J round three (JW-26): the firmware of the appliance model's front panel is not a version of a Core in its own capture.
        [label('firmware'), ownCore ? <span key="fw" data-testid="drawer-panel-firmware">{t('common.platformNotReported.value')}</span> : <Mono key="fw">{`v${DEVICE_IDENTITY.coreSoftwareVersion}`}</Mono>],
      ]}
    />
  )
}

function Mono({ children }: { children: ReactNode }) {
  return <span className="font-mono tabular-nums">{children}</span>
}

// ── Log ──────────────────────────────────────────────────────────────────────────────────
const SEVERITY_TONE: Record<AuditRow['severity'], DeviceTone> = {
  INFO: 'default',
  SUCCESS: 'success',
  WARNING: 'warning',
  CRITICAL: 'danger',
}

/**
 * The detail cell from codes only (type, fault kind, command, link state), never the simulator's
 * English text (m4). The command words follow the data mode (§3.2, plan row W70). An Identify row
 * reads "Identify (blink)", the menu's own word, in both modes (plan row W0, item 6: finding F70-1,
 * decision D156 — before W0 every command that was not a test signal read as a restart).
 */
function logDetail(row: AuditRow, t: TFunction, words: DeviceWords): string {
  const kind = typeof row.details.kind === 'string' ? (row.details.kind as FaultKind) : null
  switch (row.type) {
    case 'FAULT_RAISED':
    case 'FAULT_CLEARED':
    case 'AUDIT_CHAIN_DISCONTINUITY':
      return kind ? faultKindWords(t, kind) : EMPTY_DATE_TEXT
    case 'DEVICE_COMMAND':
      if (row.details.command === DeviceCommand.TEST_SIGNAL) return t(words.testSignal)
      if (row.details.command === DeviceCommand.IDENTIFY) return t('common.deviceMenu.identify')
      return t(words.restart)
    case 'TABLET_LINK_CHANGED':
      return typeof row.details.state === 'string' ? t(`common.tabletLinkState.${row.details.state as TabletLinkState}`) : EMPTY_DATE_TEXT
    default:
      return row.sessionId ?? row.evidenceId ?? EMPTY_DATE_TEXT
  }
}

function DeviceLog({ deviceId }: { deviceId: DeviceId }) {
  const { t } = useTranslation()
  const words = useDeviceWords()
  const rows = useSim((s) => deviceLog(s.audit.rows, deviceId))
  if (rows.length === 0) {
    return (
      <EmptyState className="dev-log-empty" data-testid="device-log-empty">
        {t('devices.drawer.emptyLog')}
      </EmptyState>
    )
  }
  return (
    <Table className="dev-log" data-testid="device-log">
      <Table.ScrollContainer className="dev-log-scroll">
        <Table.Content aria-label={t('devices.drawer.log.label')}>
          <Table.Header>
            <Table.Column isRowHeader>{t('devices.drawer.log.time')}</Table.Column>
            <Table.Column>{t('devices.drawer.log.event')}</Table.Column>
            <Table.Column>{t('devices.drawer.log.detail')}</Table.Column>
          </Table.Header>
          <Table.Body>
            {rows.map((row) => (
              <Table.Row key={row.id} id={row.id}>
                <Table.Cell className="font-mono tabular-nums whitespace-nowrap">{formatDate(row.at, 'D MMM HH:mm:ss')}</Table.Cell>
                <Table.Cell>
                  <span className="dev-log-event">
                    <StatusDot tone={SEVERITY_TONE[row.severity]} />
                    {auditTypeWords(t, row.type)}
                  </span>
                </Table.Cell>
                <Table.Cell className="text-foreground-2">{logDetail(row, t, words)}</Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table.Content>
      </Table.ScrollContainer>
    </Table>
  )
}
