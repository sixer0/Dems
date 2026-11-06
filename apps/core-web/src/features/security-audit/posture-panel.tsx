import { memo } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Shield, ShieldAlert, ShieldCheck, ShieldQuestion, ShieldX, type LucideIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { DATE_PATTERNS, formatDate } from '@dems/shared/realtime'
import { GlowLayer, useMotionPolicy, type GlowTone } from '@/motion'
import { cn } from '@/lib/utils'
import type { PostureState } from './model'
import { useAuditLog } from './audit-context'
import { Panel } from './panel'
import { POSTURE_TONE, toneClass } from './tones'
import { useEscalationCount } from './use-security-data'

/** 04 AS #5: the four shields; Unknown uses ShieldQuestion. */
const POSTURE_ICON: Record<PostureState, LucideIcon> = {
  SECURE: ShieldCheck,
  ATTENTION: ShieldAlert,
  CRITICAL: ShieldX,
  UNKNOWN: ShieldQuestion,
}

const POSTURE_GLOW: Record<PostureState, GlowTone> = {
  SECURE: 'success',
  ATTENTION: 'warning',
  CRITICAL: 'danger',
  UNKNOWN: 'brand',
}

/** Concentric hairline rings with tick marks behind the shield (static SVG, decorative). */
function ShieldRings() {
  const ticks = Array.from({ length: 36 }, (_, index) => index * 10)
  return (
    <svg className="sa-shield-rings" viewBox="0 0 124 124" aria-hidden="true" fill="none">
      <circle cx="62" cy="62" r="60" stroke="currentColor" strokeOpacity="0.25" strokeWidth="1" />
      <circle cx="62" cy="62" r="50" stroke="currentColor" strokeOpacity="0.55" strokeWidth="1.5" />
      {ticks.map((angle) => (
        <line
          key={angle}
          x1="62"
          y1="4"
          x2="62"
          y2={angle % 90 === 0 ? 11 : 8}
          stroke="currentColor"
          strokeOpacity={angle % 90 === 0 ? 0.8 : 0.35}
          strokeWidth="1"
          transform={`rotate(${angle} 62 62)`}
        />
      ))}
    </svg>
  )
}

export interface PosturePanelProps {
  posture: PostureState
  controlsOk: number
  controlsTotal: number
  chainOk: boolean
  /** Entries ever written (kept rows plus rotated-out rows). */
  entries: number
  className?: string
  /** The Core states `security.platformNotReported` (closing pass J): an UNKNOWN posture reads "Not reported". */
  platformNotReported?: boolean
}

/**
 * Posture shield, the page's hero moment (01_specs §14.5.7 "Posture shield"; M-PG-SEC; M-C-10).
 * Enters from scale 0.9 with one glow bloom; a state change cross-fades the shield icon and label
 * (base, scale 0.9 → 1) and an escalation plays one halo pulse plus one glow bloom (R8, P7).
 * Reduced motion: opacity only, no bloom, no halo.
 */
export const PosturePanel = memo(function PosturePanel({ posture, controlsOk, controlsTotal, chainOk, entries, className, platformNotReported = false }: PosturePanelProps) {
  const { t } = useTranslation()
  const m = useMotionPolicy()
  const pulses = useEscalationCount(posture)
  const audit = useAuditLog()
  const lastAt = audit.rows[audit.rows.length - 1]?.at ?? null
  const Icon = POSTURE_ICON[posture]
  const notReported = posture === 'UNKNOWN' && platformNotReported
  const stateLabel = notReported ? t('common.platformNotReported.value') : t(`common.posture.${posture}`)

  return (
    <Panel id="posture" hero icon={Shield} title={t('securityAudit.posture.title')} className={className}>
      <div className={cn('sa-posture', toneClass(POSTURE_TONE[posture]))} data-posture={posture}>
        <div
          className="sa-shield"
          role="img"
          aria-label={t('securityAudit.posture.shieldLabel', { state: stateLabel })}
          data-testid="posture-shield"
        >
          <GlowLayer level={posture === 'UNKNOWN' ? 1 : 2} tone={POSTURE_GLOW[posture]} pulseKey={pulses} />
          {m.flags.flashes ? (
            <motion.span
              className="sa-shield-bloom"
              aria-hidden="true"
              initial={{ opacity: 0 }}
              animate={{ opacity: [0, 1, 0.35] }}
              transition={{ duration: m.seconds(1200), delay: m.seconds(200), ease: 'easeOut' }}
            />
          ) : (
            <span className="sa-shield-bloom" aria-hidden="true" style={{ opacity: 0.35 }} />
          )}
          <ShieldRings />
          <AnimatePresence mode="wait" initial={false}>
            <motion.span
              key={posture}
              className="relative grid place-items-center"
              initial={m.reduced ? { opacity: 0 } : { opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, transition: m.transitions.exit }}
              transition={m.transitions.crossFade}
            >
              <Icon className="sa-shield-icon" aria-hidden="true" strokeWidth={1.5} />
            </motion.span>
          </AnimatePresence>
          {pulses > 0 && !m.reduced ? (
            <motion.span key={pulses} className="sa-halo" aria-hidden="true" variants={m.variants.halo} initial="hidden" animate="visible" />
          ) : null}
        </div>

        <AnimatePresence mode="wait" initial={false}>
          <motion.p
            key={posture}
            className="sa-posture-state"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: m.seconds(120) }}
            data-testid="posture-state"
          >
            {stateLabel}
          </motion.p>
        </AnimatePresence>
        <p className="sa-posture-message" aria-live="polite">
          {notReported ? t('common.platformNotReported.note') : t(`securityAudit.posture.${posture}`)}
        </p>

        <dl className="sa-stats">
          <div>
            <dt className="sa-stat-label">{t('securityAudit.posture.stats.controls')}</dt>
            <dd className="sa-stat-value">
              {controlsOk}/{controlsTotal}
            </dd>
          </div>
          <div>
            <dt className="sa-stat-label">{t('securityAudit.posture.stats.chain')}</dt>
            <dd className={cn('sa-stat-value', chainOk ? 'sa-tone-success' : 'sa-tone-danger')} style={{ color: 'var(--sa-tone-text)' }}>
              {chainOk ? t('securityAudit.posture.chainIntact') : t('securityAudit.posture.chainBroken')}
            </dd>
          </div>
          <div>
            <dt className="sa-stat-label">{t('securityAudit.posture.stats.entries')}</dt>
            <dd className="sa-stat-value">{entries}</dd>
          </div>
          <div>
            <dt className="sa-stat-label">{t('securityAudit.posture.stats.lastEvent')}</dt>
            <dd className="sa-stat-value sa-mono">{formatDate(lastAt, DATE_PATTERNS.time)}</dd>
          </div>
        </dl>
      </div>
    </Panel>
  )
})
