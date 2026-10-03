import { memo } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { useTranslation } from 'react-i18next'
import { useMotionPolicy } from '@/motion'
import { cn } from '@/lib/utils'
import type { PostureState } from './model'
import { POSTURE_TONE, toneClass } from './tones'
import { useEscalationCount } from './use-security-data'

export interface SecurityBannerProps {
  posture: PostureState
  controlsOk: number
  controlsTotal: number
  chainOk: boolean
  breakSeq: number | null
}

/**
 * Page-header status banner (01_specs §14.4 template; research/04 §5.5 "banner shield state").
 * A glowing dot (static glow, no loop: the page's single ambient loop is the chain head), the
 * posture title and a detail line. An escalation pulses the dot's halo once (R8, M-C-10); the
 * label cross-fades (120 ms). Announced politely.
 */
export const SecurityBanner = memo(function SecurityBanner({ posture, controlsOk, controlsTotal, chainOk, breakSeq }: SecurityBannerProps) {
  const { t } = useTranslation()
  const m = useMotionPolicy()
  const pulses = useEscalationCount(posture)
  const detail =
    posture === 'UNKNOWN'
      ? t('securityAudit.banner.checking')
      : `${t('securityAudit.banner.controls', { ok: controlsOk, total: controlsTotal })} • ${
          chainOk ? t('securityAudit.banner.chainIntact') : t('securityAudit.banner.chainBroken', { seq: breakSeq ?? 0 })
        }`

  return (
    <div
      className={cn('sa-banner', toneClass(POSTURE_TONE[posture]))}
      role="status"
      aria-live="polite"
      aria-label={t('securityAudit.banner.label')}
      data-testid="security-banner"
      data-state={posture}
    >
      <span className="sa-banner-dot-wrap" aria-hidden="true">
        <span className="sa-banner-dot" />
        {pulses > 0 && !m.reduced ? (
          <motion.span key={pulses} className="sa-halo" variants={m.variants.halo} initial="hidden" animate="visible" />
        ) : null}
      </span>
      <span className="min-w-0">
        <AnimatePresence mode="wait" initial={false}>
          <motion.p
            key={posture}
            className="sa-banner-title"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: m.seconds(120) }}
          >
            {t(`securityAudit.banner.${posture}`)}
          </motion.p>
        </AnimatePresence>
        <p className="sa-banner-detail">{detail}</p>
      </span>
    </div>
  )
})
