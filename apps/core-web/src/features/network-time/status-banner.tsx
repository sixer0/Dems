import { Card } from '@heroui/react'
import { useTranslation } from 'react-i18next'
import { useSim } from '@dems/shared/sim'
import type { StatusTone } from '@dems/shared/tokens'
import { isOwnCaptureCore } from '@/lib/own-capture'
import { GlowLayer, type GlowTone } from '@/motion'
import { networkLevel, NETWORK_TONE, timeLevel, TIME_TONE } from './model'
import { useTimeEscalationKey } from './use-network-time-alerts'

const RANK: Record<StatusTone, number> = { success: 0, accent: 0, default: 0, info: 0, sealed: 0, warning: 1, danger: 2 }
const GLOW_TONE: Record<StatusTone, GlowTone> = {
  success: 'brand',
  accent: 'brand',
  default: 'brand',
  info: 'brand',
  sealed: 'brand',
  warning: 'warning',
  danger: 'danger',
}

/**
 * The page-header status banner (04 §5.4 "Synchronized • Connected"): the time half and the network
 * half, each from the simulator, the worse of the two setting the tone. The dot is steady (no extra
 * loop: this page already spends its budget on the orbit and the beams); an escalation blooms the
 * card glow once (R8, P7).
 */
export function NetworkTimeBanner() {
  const { t } = useTranslation()
  const view = useSim((s) => ({
    time: timeLevel(s.time.source),
    // G75b-06: a Core in its own capture - the host system clock, not an "RTC holdover".
    hostClock: isOwnCaptureCore(s),
    source: s.time.source,
    stratum: s.time.stratum,
    network: networkLevel(s.network.linkUp, s.network.poe.activePorts, s.network.poe.totalPorts),
    ip: s.network.ip,
  }))
  const pulse = useTimeEscalationKey(view.time)
  const timeTone: StatusTone = view.hostClock ? 'default' : TIME_TONE[view.time]
  const networkTone: StatusTone = view.hostClock && NETWORK_TONE[view.network] === 'success' ? 'default' : NETWORK_TONE[view.network]
  const tone = RANK[networkTone] > RANK[timeTone] ? networkTone : timeTone
  return (
    <Card
      variant="secondary"
      className="nt-banner"
      data-tone={tone}
      data-time={view.hostClock ? 'HOST_CLOCK' : view.time}
      data-network={view.network}
      role="status"
      aria-label={t('networkTime.bannerState.label')}
      data-testid="network-time-banner"
    >
      <GlowLayer level={1} tone={GLOW_TONE[tone]} pulseKey={pulse} />
      <span className="nt-banner-dot" aria-hidden="true" />
      <div className="nt-banner-text">
        <p className="nt-banner-title">
          {t('networkTime.banner', {
            time: view.hostClock ? t('web.ownCore.time.value') : t(`networkTime.bannerState.time.${view.time}`),
            // Fix wave J (JW-23 (3)): "CONNECTED" is the appliance model's LAN link; a Core on its host clock reports no network
            // status (a link the state says is down keeps its word).
            network: view.hostClock && NETWORK_TONE[view.network] === 'success' ? t('web.waveJ.network.notReported') : t(`networkTime.bannerState.network.${view.network}`),
          })}
        </p>
        <p className="nt-banner-detail">
          {view.hostClock
            ? // Fix wave L (G75d-07): the address is the appliance model's; the banner of a Core on its host clock does not print it.
              t('web.waveL.networkBannerDetail')
            : t('networkTime.bannerState.detail', { source: view.source, stratum: view.stratum, ip: view.ip })}
        </p>
      </div>
    </Card>
  )
}
