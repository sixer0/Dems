import { lazy, Suspense, type ReactNode } from 'react'
import { Alert, Chip, Skeleton } from '@heroui/react'
import { Activity, ArrowDown, ArrowUp, EthernetPort, Network, PlugZap, TabletSmartphone, type LucideIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useSim } from '@dems/shared/sim'
import { toneChipProps, type StatusTone } from '@dems/shared/tokens'
import { fixed1 } from './model'
import { NetworkTimePanel } from './panel'

const chartsChunk = import('./charts')
const BandwidthSparkline = lazy(() => chartsChunk.then((m) => ({ default: m.BandwidthSparkline })))

/** The PoE ports shown with link LEDs (the camera NIC side, design book §21.1 Camera Domain). */
const POE_PORTS = ['POE_CAM_1', 'POE_CAM_2_AUX'] as const

/**
 * Network status (01_specs §14.5.6 row 3; MB 9 "Network Status"; 04 §5.4): LAN connection, the PoE
 * network with its port LEDs and power budget, bandwidth with a streaming sparkline, and the tablet
 * link (FMEA §23.1 "Tablet disconnect: recording continues; reconnect/resync").
 */
export function NetworkPanel() {
  const { t } = useTranslation()
  const net = useSim((s) => ({
    ip: s.network.ip,
    name: s.network.lanName,
    gateway: s.network.gateway,
    linkUp: s.network.linkUp,
    speedGbps: s.network.linkSpeedMbps / 1_000,
    activePorts: s.network.poe.activePorts,
    totalPorts: s.network.poe.totalPorts,
    drawW: s.network.poe.drawW,
    budgetW: s.network.poe.budgetW,
  }))
  const poeUp = net.activePorts >= net.totalPorts
  const lanTone: StatusTone = net.linkUp ? 'success' : 'danger'
  return (
    <NetworkTimePanel id="network" icon={Network} title={t('networkTime.network.title')} bodyClassName="nt-network-body">
      <NetRow
        id="lan"
        icon={EthernetPort}
        label={t('networkTime.network.lanConnection')}
        chip={<StateChip tone={lanTone}>{t(`networkTime.network.lanState.${net.linkUp ? 'UP' : 'DOWN'}`)}</StateChip>}
      >
        <p className="nt-row-detail nt-mono">
          {t('networkTime.network.lanDetail', { ip: net.ip, name: net.name, speed: net.speedGbps, gateway: net.gateway })}
        </p>
      </NetRow>
      <NetRow
        id="poe"
        icon={PlugZap}
        label={t('networkTime.network.poe')}
        chip={
          <StateChip tone={poeUp ? 'success' : 'warning'}>
            {t(`networkTime.network.poeState.${poeUp ? 'UP' : 'DEGRADED'}`)}
          </StateChip>
        }
      >
        <div className="nt-poe">
          <PortLeds />
          <span className="nt-row-detail nt-mono">
            {t('networkTime.network.poePorts', { active: net.activePorts, total: net.totalPorts })}
          </span>
          <div
            className="nt-budget"
            role="meter"
            aria-valuemin={0}
            aria-valuemax={net.budgetW}
            aria-valuenow={net.drawW}
            aria-label={t('networkTime.network.poeBudget', { draw: fixed1(net.drawW), budget: net.budgetW })}
          >
            <span className="nt-budget-fill" style={{ transform: `scaleX(${Math.min(1, net.drawW / net.budgetW)})` }} />
          </div>
          <span className="nt-row-detail">{t('networkTime.network.poeBudget', { draw: fixed1(net.drawW), budget: net.budgetW })}</span>
        </div>
      </NetRow>
      <BandwidthRow />
      <TabletRow />
    </NetworkTimePanel>
  )
}

function StateChip({ tone, children }: { tone: StatusTone; children: ReactNode }) {
  return (
    <Chip size="sm" variant="soft" {...toneChipProps(tone)}>
      {children}
    </Chip>
  )
}

interface NetRowProps {
  id: string
  icon: LucideIcon
  label: string
  chip?: ReactNode
  children?: ReactNode
}

function NetRow({ id, icon: Icon, label, chip, children }: NetRowProps) {
  return (
    <div className="nt-row" data-testid={`network-time-row-${id}`}>
      <span className="nt-row-badge" aria-hidden="true">
        <Icon className="nt-row-icon" strokeWidth={1.75} />
      </span>
      <div className="nt-row-main">
        <div className="nt-row-head">
          <p className="nt-row-label">{label}</p>
          {chip}
        </div>
        {children}
      </div>
    </div>
  )
}

function PortLeds() {
  const { t } = useTranslation()
  const ports = useSim((s) => s.ports.filter((port) => (POE_PORTS as readonly string[]).includes(port.id)))
  return (
    <ul className="nt-leds">
      {ports.map((port) => (
        <li key={port.id} className="nt-led" data-link={port.link ? 'up' : 'down'} data-testid={`network-time-port-${port.id}`}>
          <span className="nt-led-dot" aria-hidden="true" />
          <span className="nt-led-label">{t(`networkTime.network.ports.${port.id as (typeof POE_PORTS)[number]}`)}</span>
          <span className="sr-only">{port.link ? t('networkTime.network.linkUp') : t('networkTime.network.linkDown')}</span>
        </li>
      ))}
    </ul>
  )
}

function BandwidthRow() {
  const { t } = useTranslation()
  const bandwidth = useSim((s) => s.network.bandwidth)
  const down = fixed1(bandwidth.downMbps)
  const up = fixed1(bandwidth.upMbps)
  const enough = bandwidth.history.length >= 2
  const label = t('networkTime.network.sparklineLabel', { seconds: bandwidth.history.length, down, up })
  return (
    <NetRow id="bandwidth" icon={Activity} label={t('networkTime.network.bandwidth')}>
      <div className="nt-bw">
        <div className="nt-bw-chart">
          {enough ? (
            <Suspense fallback={<Skeleton className="nt-spark rounded-md" />}>
              <BandwidthSparkline history={bandwidth.history} label={label} />
            </Suspense>
          ) : (
            <p className="nt-collecting">{t('networkTime.network.collecting')}</p>
          )}
        </div>
        <div className="nt-bw-values" data-testid="network-time-bandwidth">
          <p className="nt-bw-down">
            <ArrowDown className="nt-bw-arrow" aria-label={t('networkTime.network.down')} strokeWidth={2} />
            <span className="nt-mono">{t('networkTime.network.mbps', { value: down })}</span>
          </p>
          <p className="nt-bw-up">
            <ArrowUp className="nt-bw-arrow" aria-label={t('networkTime.network.up')} strokeWidth={2} />
            <span className="nt-mono">{t('networkTime.network.mbps', { value: up })}</span>
          </p>
        </div>
      </div>
    </NetRow>
  )
}

function TabletRow() {
  const { t } = useTranslation()
  const link = useSim((s) => s.tabletLink.state)
  const offline = link === 'OFFLINE'
  return (
    <NetRow
      id="tablet"
      icon={TabletSmartphone}
      label={t('networkTime.network.tablet')}
      chip={
        <span data-testid="network-time-tablet-state">
          <StateChip tone={offline ? 'warning' : 'success'}>{t(`networkTime.network.tabletState.${link}`)}</StateChip>
        </span>
      }
    >
      {offline ? (
        <Alert status="warning" className="nt-alert" data-testid="network-time-tablet-alert">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Description>{t('networkTime.network.tabletOffline')}</Alert.Description>
          </Alert.Content>
        </Alert>
      ) : (
        <p className="nt-row-detail">{t('networkTime.network.tabletDetail')}</p>
      )}
    </NetRow>
  )
}
