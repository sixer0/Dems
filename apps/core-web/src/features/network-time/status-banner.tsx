import { Card } from '@heroui/react'
import { useTranslation } from 'react-i18next'
import { useSim } from '@dems/shared/sim'
import type { StatusTone } from '@dems/shared/tokens'
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
    source: s.time.source,
    stratum: s.time.stratum,
    network: networkLevel(s.network.linkUp, s.network.poe.activePorts, s.network.poe.totalPorts),
    ip: s.network.ip,
  }))
  const pulse = useTimeEscalationKey(view.time)
  const timeTone = TIME_TONE[view.time]
  const networkTone = NETWORK_TONE[view.network]
  const tone = RANK[networkTone] > RANK[timeTone] ? networkTone : timeTone
  return (
    <Card
      variant="secondary"
      className="nt-banner"
      data-tone={tone}
      data-time={view.time}
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
            time: t(`networkTime.bannerState.time.${view.time}`),
            network: t(`networkTime.bannerState.network.${view.network}`),
          })}
        </p>
        <p className="nt-banner-detail">
          {t('networkTime.bannerState.detail', { source: view.source, stratum: view.stratum, ip: view.ip })}
        </p>
      </div>
    </Card>
  )
}
