import { useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { useTranslation } from 'react-i18next'
import { useSim } from '@dems/shared/sim'
import { useSelfCaptureCore } from '@/lib/own-capture'
import { useMotionPolicy } from '@/motion'
import { useDeviceLabels } from './labels'
import { BANNER_RANK, BANNER_TONE, selectBanner } from './model'

/**
 * Page-header status banner (research/04 §5.2 "All devices ready 9/9"; 01_specs §14.4 template):
 * a glowing status dot, a title and one detail line. States READY, RECORDING, ATTENTION and
 * CRITICAL. The title cross-fades (120 ms); an escalation plays one halo pulse, then the colour
 * holds (P7, R8). No ambient loop here: the page keeps its budget for the camera feeds, the
 * recording lamp and the port LEDs (§9.4). Announced politely.
 */
export function DevicesBanner() {
  const { t } = useTranslation()
  const m = useMotionPolicy()
  const banner = useSim(selectBanner)
  const labels = useDeviceLabels()
  const tone = BANNER_TONE[banner.kind]

  const [seen, setSeen] = useState({ kind: banner.kind, pulses: 0 })
  let pulses = seen.pulses
  if (seen.kind !== banner.kind) {
    pulses = BANNER_RANK[banner.kind] > BANNER_RANK[seen.kind] ? seen.pulses + 1 : seen.pulses
    setSeen({ kind: banner.kind, pulses })
  }

  // Fix wave J (JW-23 (2)): "ALL DEVICES READY 7/7 - Every input and link is operating normally" counted the three
  // synthetic "other devices" and sources nobody had checked. A Core in its own capture states no such sum.
  const ownCore = useSelfCaptureCore()
  const title =
    banner.issues === 0
      ? ownCore
        ? t('web.waveJ.devices.bannerTitle')
        : t('devices.banner.allReady', { ready: banner.ready, total: banner.total })
      : t('devices.banner.attention', { count: banner.issues })
  let detail: string
  if (banner.worst && banner.worstCode) {
    const one = t('devices.banner.issueDetail', {
      device: labels.name(banner.worst),
      status: t(`devices.status.${banner.worstCode}`),
    })
    detail = banner.issues > 1 ? t('devices.banner.moreIssues', { detail: one, count: banner.issues - 1 }) : one
  } else {
    detail = banner.kind === 'RECORDING' ? t('devices.banner.recordingDetail') : ownCore ? t('web.waveJ.devices.bannerDetail') : t('devices.banner.readyDetail')
  }

  return (
    <div className="dev-banner" data-testid="devices-banner" data-kind={banner.kind} data-tone={ownCore && banner.issues === 0 && banner.kind !== 'RECORDING' ? 'default' : tone} data-own-core={ownCore ? 'true' : undefined} role="status" aria-live="polite">
      <span className="dev-banner-dot" aria-hidden="true">
        <span className="dev-banner-dot-glow" />
        <span className="dev-banner-dot-core" />
        {pulses > 0 && m.flags.flashes ? (
          <motion.span key={pulses} className="dev-banner-dot-halo" variants={m.variants.halo} initial="hidden" animate="visible" />
        ) : null}
      </span>
      <span className="dev-banner-text">
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={title}
            className="dev-banner-title"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: m.seconds(120) }}
          >
            {title}
          </motion.span>
        </AnimatePresence>
        <span className="dev-banner-detail" data-testid="devices-banner-detail">
          {detail}
        </span>
      </span>
    </div>
  )
}
