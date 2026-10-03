import { useState } from 'react'
import { Card } from '@heroui/react'
import { useTranslation } from 'react-i18next'
import { useSim, type SimState } from '@dems/shared/sim'
import { GlowLayer, type GlowTone } from '@/motion'
import { bannerTone, countServices, type Tone } from './model'

const GLOW: Record<Tone, GlowTone> = {
  success: 'brand',
  warning: 'warning',
  danger: 'danger',
  accent: 'brand',
  default: 'brand',
}

const TONE_RANK: Record<Tone, number> = { success: 0, default: 0, accent: 0, warning: 1, danger: 2 }

// Primitives only (R1): the counts come from the store-owned `services` array.
const selectBanner = (s: SimState) => {
  const counts = countServices(s.services.map((service) => service.status))
  return {
    running: counts.running,
    total: counts.total,
    attention: counts.attention,
    stopped: counts.stopped,
    version: s.update.currentVersion,
    slot: s.update.activeSlot,
  }
}

/**
 * The page-header status banner (04 §5.6 "All core services running"): a kit Card with a status
 * dot, the services line and "running · version · slot". Escalation blooms the glow once (R8);
 * de-escalation only changes colour.
 */
export function SystemBanner() {
  const { t } = useTranslation()
  const view = useSim(selectBanner)
  const tone = bannerTone(view)
  // R8: one pulse per escalation, derived during render (no effect).
  const [track, setTrack] = useState({ tone, pulses: 0 })
  if (track.tone !== tone) {
    setTrack({ tone, pulses: TONE_RANK[tone] > TONE_RANK[track.tone] ? track.pulses + 1 : track.pulses })
  }
  return (
    <Card
      variant="secondary"
      className="sys-banner"
      data-tone={tone}
      role="status"
      aria-label={t('system.banner.label')}
      data-testid="system-banner"
    >
      <GlowLayer level={1} tone={GLOW[tone]} pulseKey={track.pulses} />
      <span className="sys-banner-dot" aria-hidden="true" />
      <div className="sys-banner-text">
        <p className="sys-banner-title">
          {view.attention === 0 ? t('system.banner.ok') : t('system.banner.attention', { count: view.attention })}
        </p>
        <p className="sys-banner-detail">
          {t('system.banner.detail', { running: view.running, total: view.total, version: view.version, slot: view.slot })}
        </p>
      </div>
    </Card>
  )
}
