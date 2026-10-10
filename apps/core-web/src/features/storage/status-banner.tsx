import { Card } from '@heroui/react'
import { useTranslation } from 'react-i18next'
import { GB, selectStorage, useSim } from '@dems/shared/sim'
import { useSelfCaptureCore } from '@/lib/own-capture'
import { GlowLayer, type GlowTone } from '@/motion'
import { formatShortBytes, STORAGE_CHIP_TONE, type StorageLevel } from './model'
import { useEscalationKey } from './use-storage-alerts'

const GLOW_TONE: Record<StorageLevel, GlowTone> = { READY: 'brand', LOW: 'warning', FULL: 'danger' }

/**
 * The page-header status banner (04 §3.2 K template; 04 §5.3 "banner READY / LOW / FULL"): a kit
 * Card with a status dot, the state line and "free · remaining" computed from the simulator. The
 * page is calm (no ambient loop): the dot is steady, and an escalation blooms the card glow once (R8).
 */
export function StorageBanner() {
  const { t } = useTranslation()
  const view = useSim((s) => {
    const summary = selectStorage(s)
    return {
      state: summary.state as StorageLevel,
      // Whole GB for the free text and whole minutes for the remaining time (≤ 1 Hz, R8).
      freeGb: Math.round(summary.freeBytes / GB),
      remainingMinutes: Math.floor(summary.estimatedRemainingMs / 60_000),
    }
  })
  const escalation = useEscalationKey(view.state)
  const selfCapture = useSelfCaptureCore()
  const remaining = t('common.units.hoursMinutes', {
    hours: Math.floor(view.remainingMinutes / 60),
    minutes: view.remainingMinutes % 60,
  })
  return (
    <Card
      variant="secondary"
      className="stor-banner"
      data-state={view.state}
      data-tone={STORAGE_CHIP_TONE[view.state]}
      role="status"
      aria-label={t('storage.banner.label')}
      data-testid="storage-banner"
    >
      <GlowLayer level={1} tone={GLOW_TONE[view.state]} pulseKey={escalation} />
      <span className="stor-banner-dot" aria-hidden="true" />
      <div className="stor-banner-text">
        <p className="stor-banner-title">{t(`storage.banner.${view.state}`)}</p>
        <p className="stor-banner-detail">
          {/* Fix wave K (G75c-04): "about N of recording left" is free space divided by the device model's 8.2 GB per hour. */}
          {selfCapture ? t('web.realCore.storage.bannerFree', { free: formatShortBytes(view.freeGb * GB) }) : t('storage.banner.detail', { free: formatShortBytes(view.freeGb * GB), remaining })}
        </p>
      </div>
    </Card>
  )
}
