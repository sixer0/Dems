import { useRef, useState, type ReactNode } from 'react'
import { Button, buttonVariants, Spinner } from '@heroui/react'
import { Link } from '@tanstack/react-router'
import { AnimatePresence, motion } from 'motion/react'
import { useTranslation } from 'react-i18next'
import { faultKindLabelKey, isCoreNotRunningKind, useSim } from '@dems/shared/sim'
import { motion as tokens } from '@dems/shared/tokens'
import { useAmbientLoop, useMotionPolicy } from '@/motion'
import { cn } from '@/lib/utils'
import { captureFailedStartText, captureNoticeLine, captureNoticeOf } from '@/lib/capture-notices'
import { useOwnCapture } from '@/lib/own-capture'
import { sealAttentionLine, useOpenSealAttention } from '@/lib/seal-attention'
import { useInterruptedSeal } from './use-interrupted-seal'
import { BANNER_RANK, BANNER_TONE, selectBanner, selectBannerNoticeAlert, selectCoveredDegradedNotice, type BannerModel, type BannerTone } from './model'

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
  // Row 139 (ux §8e.1 "told apart by reason"; §8e.2 "C, degraded"): a no-device notice is worded from its
  // `params`, with the device named by label and id, never by the alert's own text.
  const noticeAlert = useSim(selectBannerNoticeAlert)
  const notice = noticeAlert === null ? null : captureNoticeOf(noticeAlert)
  // Closing pass J (G75b-03, D217 (5)): the restart fault of a Core in its own capture is worded from its member `coreNotRunning`, never "Power failure".
  const coreNotRunning = useSim((s) => isCoreNotRunningKind(s, banner.reasonKind))
  const reason = notice !== null ? captureNoticeLine(t, notice) : banner.reasonKind ? t(faultKindLabelKey(banner.reasonKind, coreNotRunning ? { coreNotRunning: true } : null)) : (banner.reasonText ?? '')
  // Wave H driver B (G75-03, ruling D197): a sealed recording that was interrupted is named, never the plain sealed state.
  const interrupted = useInterruptedSeal(banner.kind === 'SEALED' ? banner.sessionId : null)
  // Wave H closing pass Z2 (driver A's line of 10:20:55Z): beside a recording of the Core's own capture no
  // integrity check runs and the media is not protected until the seal - the banner names the capture state.
  const ownCapture = useOwnCapture()
  const sealAttention = useOpenSealAttention()
  switch (banner.kind) {
    case 'ACTIVE':
      if (ownCapture) return { title: t('session.captureFacts.banner.title'), detail: t('session.integrityFacts.capture.DURABLE') }
      return { title: t('session.banner.ACTIVE.title'), detail: t('session.banner.ACTIVE.detail') }
    case 'CONNECTING':
      return { title: t('session.audioSource.connecting.title'), detail: t('session.audioSource.connecting.detail') }
    case 'ATTENTION':
      return { title: t('session.banner.ATTENTION.title'), detail: t('session.banner.ATTENTION.detail', { reason }) }
    case 'FAULT':
      // Row 139 (ux §8e.2 situation C): a failed start. "Nothing was recorded." is said in full.
      if (banner.failedStart !== null) {
        const failed = captureFailedStartText(t, banner.failedStart)
        return { title: t('session.banner.FAULT.title'), detail: `${failed.title}. ${failed.body}` }
      }
      return {
        title: t('session.banner.FAULT.title'),
        detail: banner.whileRecording
          ? t('session.banner.recordingContinues', { reason })
          : t('session.banner.FAULT.detail', { reason }),
      }
    case 'FINALIZING':
      // Fix wave I (G75b-02): a blocked or retried seal is no running "step 1 of 6".
      if (sealAttention !== null) {
        return {
          title: t(sealAttention.kind === 'BLOCKED' ? 'web.sealBlocked.bannerTitle' : 'web.sealBlocked.retryBannerTitle'),
          detail: sealAttentionLine(sealAttention, t('web.sealBlocked.retryNoSentence')),
        }
      }
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
      if (interrupted !== null) return { title: interrupted.title, detail: `${banner.evidenceId ?? '—'} · ${interrupted.cause} ${interrupted.kept}` }
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
  const interruptedSeal = useInterruptedSeal(banner.kind === 'SEALED' ? banner.sessionId : null) !== null
  // An interrupted seal is not the calm sealed state: the warning tone.
  // Fix wave I (G75b-02): a blocked seal is the danger tone, a retried one the warning tone.
  const sealAttention = useOpenSealAttention()
  const sealKind = banner.kind === 'FINALIZING' ? (sealAttention?.kind ?? null) : null
  const tone: BannerTone = sealKind === 'BLOCKED' ? 'danger' : sealKind === 'RETRYING' || interruptedSeal ? 'warning' : BANNER_TONE[banner.kind]
  const { title, detail } = useBannerText(banner)
  // Wave H driver B (G75-07 (a)): the degraded-start warning keeps a place of its own when a more severe alert has the banner.
  const coveredAlert = useSim(selectCoveredDegradedNotice)
  const coveredNotice = coveredAlert === null ? null : captureNoticeOf(coveredAlert)

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
  } else if (banner.kind === 'FAULT' && !banner.whileRecording && !banner.failedStartClosing && canStart) {
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
        {/* Row 139 (OP-125-5): a session that recorded nothing is closed; no recovery of evidence is offered. */}
        {banner.failedStart !== null ? t('common.session.failedStart.close') : t('session.banner.cta.recover')}
      </Button>
    )
  }
  // ux §8e.6: banners are `role="status"`; the CRITICAL fault of situation C is `role="alert"`.
  const critical = banner.failedStart !== null

  return (
    <div
      className="sm-banner"
      data-testid="sm-status-banner"
      data-kind={banner.kind}
      data-seal={sealKind ?? undefined}
      data-tone={tone}
      data-failed-start={banner.failedStart ?? undefined}
      data-interrupted={interruptedSeal ? 'true' : undefined}
      role={critical ? 'alert' : 'status'}
      aria-live={critical ? 'assertive' : 'polite'}
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
        {coveredNotice !== null ? (
          <span className={cn('sm-banner-detail')} data-testid="sm-banner-degraded">
            {captureNoticeLine(t, coveredNotice)}
          </span>
        ) : null}
      </span>
      {cta ? (
        <span className="sm-banner-cta" aria-busy={recoverBusy || undefined}>
          {cta}
        </span>
      ) : null}
    </div>
  )
}
