import { useState, type Key, type ReactNode } from 'react'
import { Drawer, EmptyState, Table, Tabs } from '@heroui/react'
import { Camera, Lightbulb, MapPinned, Mic, MonitorCog, Network, ShieldCheck, TabletSmartphone, type LucideIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import type { EnResources } from '@dems/shared/i18n'
import { DATE_PATTERNS, EMPTY_DATE_TEXT, formatDate } from '@dems/shared/realtime'
import {
  DEVICE_IDENTITY,
  selectCameraById,
  selectMicById,
  useSim,
  type AuditRow,
  type FaultKind,
  type TabletLinkState,
} from '@dems/shared/sim'
import { HealthChart } from './health-chart'
import { useDeviceLabels } from './labels'
import { deviceStatus, STATUS_SEVERITY, STATUS_TONE, type DeviceTone } from './model'
import { DevicesErrorBoundary } from './panel'
import {
  bookPoe,
  CAMERA_POE_PORT,
  DEVICE_CAMERA,
  DEVICE_MIC,
  deviceLog,
  frontPanelLeds,
  POE_PORT_BUDGET_W,
  type DeviceId,
} from './sim-adapter'
import { StatusChip, StatusDot } from './status-chip'

type DrawerTab = 'overview' | 'health' | 'log'

const ICONS: Record<DeviceId, LucideIcon> = {
  'CAM-01': Camera,
  'CAM-02': Camera,
  'MIC-01': Mic,
  'MIC-02': Mic,
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

function CameraOverview({ deviceId }: { deviceId: 'CAM-01' | 'CAM-02' }) {
  const { t } = useTranslation()
  const label = useFieldLabel()
  const labels = useDeviceLabels()
  const trackId = DEVICE_CAMERA[deviceId] ?? 'VIDEO-01'
  const camera = useSim((s) => selectCameraById(s, trackId))
  const status = useSim((s) => deviceStatus(s, deviceId))
  if (!camera) return null
  return (
    <Facts
      facts={[
        [label('status'), t(`devices.status.${status}`)],
        [label('deviceId'), <Mono key="id">{camera.deviceId}</Mono>],
        [label('model'), camera.model],
        [label('firmware'), <Mono key="fw">{camera.firmware}</Mono>],
        [label('track'), <Mono key="track">{camera.id}</Mono>],
        [label('format'), t('common.devices.cameraFormatCodec', { resolution: camera.resolution, fps: camera.fps, codec: camera.codec })],
        [label('bitrate'), t('common.units.mbps', { value: camera.bitrateMbps })],
        [label('port'), labels.port(CAMERA_POE_PORT)],
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
  if (!mic) return null
  return (
    <Facts
      facts={[
        [label('status'), t(`devices.status.${status}`)],
        [label('deviceId'), <Mono key="id">{mic.deviceId}</Mono>],
        [label('track'), <Mono key="track">{mic.id}</Mono>],
        [label('channel'), t('devices.drawer.value.channel', { channel: mic.channel })],
        [label('port'), labels.port(channel === 'AUDIO-01' ? 'MIC_IN_1' : 'MIC_IN_2')],
        [label('gain'), t('devices.audio.gainValue', { value: mic.gainDb })],
        [label('phantom'), mic.phantom ? t('devices.audio.phantomOn') : t('devices.audio.phantomOff')],
        [label('adc'), t('devices.drawer.value.adc')],
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
  const link = useSim((s) => s.tabletLink)
  const pairing = useSim((s) => s.pairing.state)
  const ip = useSim((s) => s.network.ip)
  return (
    <Facts
      facts={[
        [label('status'), t(`common.tabletLinkState.${link.state}`)],
        [label('since'), <Mono key="since">{formatDate(link.changedAt, DATE_PATTERNS.dateTime)}</Mono>],
        [label('link'), t('devices.other.tabletLink')],
        [label('address'), <Mono key="ip">{ip}</Mono>],
        [label('pairing'), t(`common.pairingState.${pairing}`)],
      ]}
    />
  )
}

function GnssOverview() {
  const { t } = useTranslation()
  const label = useFieldLabel()
  const time = useSim((s) => s.time)
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
        [label('firmware'), <Mono key="fw">{`v${DEVICE_IDENTITY.coreSoftwareVersion}`}</Mono>],
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

/** The detail cell from codes only (type, fault kind, command, link state), never the simulator's English text (m4). */
function logDetail(row: AuditRow, t: TFunction): string {
  const kind = typeof row.details.kind === 'string' ? (row.details.kind as FaultKind) : null
  switch (row.type) {
    case 'FAULT_RAISED':
    case 'FAULT_CLEARED':
    case 'AUDIT_CHAIN_DISCONTINUITY':
      return kind ? t(`common.faultKind.${kind}`) : EMPTY_DATE_TEXT
    case 'DEVICE_COMMAND':
      return row.details.command === 'TEST_SIGNAL' ? t('common.deviceMenu.testSignal') : t('common.deviceMenu.restart')
    case 'TABLET_LINK_CHANGED':
      return typeof row.details.state === 'string' ? t(`common.tabletLinkState.${row.details.state as TabletLinkState}`) : EMPTY_DATE_TEXT
    default:
      return row.sessionId ?? row.evidenceId ?? EMPTY_DATE_TEXT
  }
}

function DeviceLog({ deviceId }: { deviceId: DeviceId }) {
  const { t } = useTranslation()
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
                    {t(`common.auditType.${row.type}`)}
                  </span>
                </Table.Cell>
                <Table.Cell className="text-foreground-2">{logDetail(row, t)}</Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table.Content>
      </Table.ScrollContainer>
    </Table>
  )
}
