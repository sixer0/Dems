import { useRef, useState, type ReactNode } from 'react'
import { Button, buttonVariants, Spinner } from '@heroui/react'
import { Link } from '@tanstack/react-router'
import { AnimatePresence, motion } from 'motion/react'
import { useTranslation } from 'react-i18next'
import { useSim } from '@dems/shared/sim'
import { motion as tokens } from '@dems/shared/tokens'
import { useAmbientLoop, useMotionPolicy } from '@/motion'
import { cn } from '@/lib/utils'
import { BANNER_RANK, BANNER_TONE, selectBanner, type BannerModel } from './model'

export interface StatusBannerProps {
  canStart: boolean
  onRecover: () => void
  /** LB-1 (Live mode only): the recovery request is out; the button ignores presses and is `aria-busy`. */
  recoverBusy?: boolean
  /** LB-1: out for longer than the reveal time; the button shows the kit's pending state. */
  recoverPending?: boolean
}

/** Detail line of the banner (research/04 §3.2 K states plus the step-44 additions). */
function useBannerText(banner: BannerModel): { title: string; detail: string } {
  const { t } = useTranslation()
  const reason = banner.reasonKind ? t(`common.faultKind.${banner.reasonKind}`) : (banner.reasonText ?? '')
  switch (banner.kind) {
    case 'ACTIVE':
      return { title: t('session.banner.ACTIVE.title'), detail: t('session.banner.ACTIVE.detail') }
    case 'CONNECTING':
      return { title: t('session.audioSource.connecting.title'), detail: t('session.audioSource.connecting.detail') }
    case 'ATTENTION':
      return { title: t('session.banner.ATTENTION.title'), detail: t('session.banner.ATTENTION.detail', { reason }) }
    case 'FAULT':
      return {
        title: t('session.banner.FAULT.title'),
        detail: banner.whileRecording
          ? t('session.banner.recordingContinues', { reason })
          : t('session.banner.FAULT.detail', { reason }),
      }
    case 'FINALIZING':
      return {
        title: t('session.banner.FINALIZING.title'),
        detail: banner.stopping
          ? t('session.banner.FINALIZING.stopping')
          : t('session.banner.FINALIZING.detail', { current: banner.current, total: banner.total }),
      }
    case 'SETUP':
      return {
        title: t('session.banner.SETUP.title'),
        detail: t('session.banner.SETUP.detail', {
          state: banner.sessionState ? t(`common.enums.sessionState.${banner.sessionState}`) : '',
        }),
      }
    case 'SEALED':
      return {
        title: t('session.banner.SEALED.title'),
        detail: t('session.banner.SEALED.detail', { evidenceId: banner.evidenceId ?? '—' }),
      }
    case 'RECOVERY':
      return {
        title: t('session.banner.RECOVERY.title'),
        detail: t('session.banner.RECOVERY.detail', {
          stage: banner.recoveryStage ? t(`common.enums.bootRecoveryState.${banner.recoveryStage}`) : '',
        }),
      }
    case 'NO_SESSION':
      return { title: t('session.banner.NO_SESSION.title'), detail: t('session.banner.NO_SESSION.detail') }
  }
}

/**
 * K: the page-header status banner (01_specs §14.5.2 K; research/04 §3.2 K; M-PG-SM t = 0).
 * States ACTIVE & SECURE / ATTENTION / FAULT / NO SESSION + CTA / FINALIZING, plus SETUP, SEALED
 * and RECOVERY. The dot breathes while something is alive (one of the page's four ambient loops,
 * §9.4), escalations pulse once (R8, M-C-10) and the label cross-fades (120 ms). Announced
 * politely to screen readers.
 */
export function StatusBanner({ canStart, onRecover, recoverBusy = false, recoverPending = false }: StatusBannerProps) {
  const { t } = useTranslation()
  const m = useMotionPolicy()
  const banner = useSim(selectBanner)
  const tone = BANNER_TONE[banner.kind]
  const { title, detail } = useBannerText(banner)

  // R8: one halo pulse each time the banner escalates (derived during render, no effect).
  const [escalation, setEscalation] = useState({ kind: banner.kind, pulses: 0 })
  if (escalation.kind !== banner.kind) {
    const rose = BANNER_RANK[banner.kind] > BANNER_RANK[escalation.kind]
    setEscalation({ kind: banner.kind, pulses: rose ? escalation.pulses + 1 : escalation.pulses })
  }

  const dotRef = useRef<HTMLSpanElement>(null)
  const alive = banner.kind !== 'NO_SESSION' && banner.kind !== 'SEALED'
  const breath = useAmbientLoop('banner-dot', { ref: dotRef, enabled: alive })

  let cta: ReactNode = null
  if ((banner.kind === 'NO_SESSION' || banner.kind === 'SEALED') && canStart) {
    cta = (
      <Link to="/session/new" className={buttonVariants({ variant: 'primary', size: 'sm' })} data-testid="sm-banner-cta">
        {t('common.actions.startNewSession')}
      </Link>
    )
  } else if (banner.kind === 'SETUP' && canStart) {
    cta = (
      <Link to="/session/new" className={buttonVariants({ variant: 'outline', size: 'sm' })} data-testid="sm-banner-cta">
        {t('session.banner.cta.continueSetup')}
      </Link>
    )
  } else if (banner.kind === 'FAULT' && !banner.whileRecording && canStart) {
    cta = (
      <Button
        size="sm"
        variant="danger-soft"
        onPress={onRecover}
        isPending={recoverPending}
        data-busy={recoverBusy || undefined}
        data-testid="sm-banner-cta"
      >
        {recoverPending ? <Spinner size="sm" color="current" /> : null}
        {t('session.banner.cta.recover')}
      </Button>
    )
  }

  return (
    <div
      className="sm-banner"
      data-testid="sm-status-banner"
      data-kind={banner.kind}
      data-tone={tone}
      role="status"
      aria-live="polite"
    >
      <span ref={dotRef} className="sm-banner-dot" aria-hidden="true" {...breath.attrs}>
        <motion.span
          className="sm-banner-dot-glow"
          initial={false}
          animate={breath.running ? { opacity: [0.55, 1] } : { opacity: 1 }}
          transition={breath.running ? m.loop(tokens.ambient.glowBreath) : m.transitions.glow}
        />
        <span className="sm-banner-dot-core" />
        {escalation.pulses > 0 && m.flags.flashes ? (
          <motion.span
            key={escalation.pulses}
            className="sm-banner-dot-halo"
            variants={m.variants.halo}
            initial="hidden"
            animate="visible"
          />
        ) : null}
      </span>
      <span className="sm-banner-text">
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={banner.kind}
            className="sm-banner-title"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: m.seconds(120) }}
          >
            {title}
          </motion.span>
        </AnimatePresence>
        <span className={cn('sm-banner-detail')} data-testid="sm-banner-detail">
          {detail}
        </span>
      </span>
      {cta ? (
        <span className="sm-banner-cta" aria-busy={recoverBusy || undefined}>
          {cta}
        </span>
      ) : null}
    </div>
  )
}
