import { useRef, useState } from 'react'
import { Button, Popover } from '@heroui/react'
import { Link } from '@tanstack/react-router'
import { motion } from 'motion/react'
import {
  CircleCheck,
  CircleHelp,
  CircleX,
  Lock,
  Shield,
  ShieldAlert,
  ShieldQuestion,
  ShieldX,
  TriangleAlert,
  type LucideIcon,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { openUnsealableNoticesOf, useSim, useSimReady } from '@dems/shared/sim'
import { palette } from '@dems/shared/tokens'
import { BorderBeam } from '@/components/ui/border-beam'
import { tween, useAmbientLoop, useMotionPolicy } from '@/motion'
import { useOwnCaptureCore, usePlatformNotReported } from '@/lib/own-capture'
import { selectStatedAlertCount, selectStatedAlertMessage, useSystemStatement } from '@/lib/system-statement'
import {
  INTEGRITY_CHECK_IDS,
  ownCoreRow,
  pillSubtitle,
  selectIntegrityChecks,
  selectPillCause,
  type CheckStatus,
  type PillState,
} from './integrity-checks'

const PILL_ICON: Record<PillState, LucideIcon> = {
  SECURE: Lock,
  ATTENTION: ShieldAlert,
  CRITICAL: ShieldX,
  UNKNOWN: ShieldQuestion,
}

const CHECK_ICON: Record<CheckStatus | 'UNKNOWN', LucideIcon> = {
  OK: CircleCheck,
  ATTENTION: TriangleAlert,
  CRITICAL: CircleX,
  UNKNOWN: CircleHelp,
}

/** Escalation order (R8: only a rise pulses; a fall is a colour transition only). */
const PILL_SEVERITY: Record<PillState, number> = { UNKNOWN: -1, SECURE: 0, ATTENTION: 1, CRITICAL: 2 }
/** M-SH-05 ring pulse: scale 1 → 1.6, opacity 0.5 → 0 over 600 ms (spec literals, D49). */
const RING_PULSE_MS = 600
const RING_PULSE_SCALE = 1.6
/** M-SH-05 BorderBeam: one lap per 6 s (M-C-23 `duration 6`). */
const BEAM_LAP_MS = 6000
/** Beam size (px), M-C-23 `size 220` (the beam square travelling the border; see DR-41-6). */
const BEAM_SIZE = 220

/**
 * SECURE pill (01_specs §14.4 item 10; research/04 §2.1 #11): a kit outline `Button` restyled to
 * the mockup, opening a `Popover` with the integrity checklist. States SECURE / ATTENTION /
 * CRITICAL / UNKNOWN (UNKNOWN until the simulator has hydrated).
 *
 * Motion (M-SH-05; 03_motion_spec R8, §8, §9.4):
 * - the status dot breathes over `glowBreath` (2.4 s): only its pre-rendered glow layer's opacity
 *   moves (CSS). It shares the one `shell` ambient slot with the topographic drift;
 * - a state change transitions the dot colour over 400 ms; an **escalation** (SECURE → ATTENTION →
 *   CRITICAL) also plays one ring pulse. Hydration (UNKNOWN →) and recovery do not pulse (R8);
 * - while ATTENTION or CRITICAL, MU **BorderBeam** travels the border (6 s per lap, amber or red to
 *   bronze) and stops on recovery;
 * - reduced motion: steady dot, no pulse, no beam; the colour still changes.
 */
export function SecurePill() {
  const { t } = useTranslation()
  const m = useMotionPolicy()
  const [open, setOpen] = useState(false)
  const ready = useSimReady()
  const checks = useSim(selectIntegrityChecks)
  // G75b-07: the CRITICAL line names the fault; the integrity sentence is kept for integrity flags.
  const cause = useSim(selectPillCause)
  // G75b-06: a Core in its own capture reports no TPM / Secure Boot state and no time service.
  const ownCore = useOwnCaptureCore()
  // Closing pass J (D217 (7)): the platform row reads the Core's own statement `security.platformNotReported`.
  const platformNotReported = usePlatformNotReported()
  // Fix wave J: the pill's state IS the one statement's (declared here, used by the dot and the pulse below).
  const statement = useSystemStatement()
  const state: PillState = statement.kind === 'UNKNOWN' ? 'UNKNOWN' : statement.kind === 'CRITICAL' ? 'CRITICAL' : statement.kind === 'ATTENTION' ? 'ATTENTION' : 'SECURE'
  const dotRef = useRef<HTMLSpanElement>(null)
  const dotLoop = useAmbientLoop('secure-dot', {
    ref: dotRef,
    priority: 'shell',
    group: 'shell',
    enabled: state !== 'UNKNOWN',
  })

  // Counts escalations, derived while rendering: each new value replays the ring pulse.
  const [seen, setSeen] = useState({ state, pulses: 0 })
  let pulses = seen.pulses
  if (seen.state !== state) {
    const escalated = seen.state !== 'UNKNOWN' && PILL_SEVERITY[state] > PILL_SEVERITY[seen.state]
    pulses = escalated ? seen.pulses + 1 : seen.pulses
    setSeen({ state, pulses })
  }
  // Fix wave J (JW-04, JW-05; truth rule 3c): the pill's word is `systemStatementOf` - ONE pure function of the Core's
  // facts (`lib/system-statement.ts`), the same the Dashboard ring reads. It is never "SECURE / All systems operational"
  // while the Core link is lost, a seal is retried, an alert is active, a recording sits in quarantine (waves L and M),
  // or while the Core states that it reports no platform posture.
  const openNotices = useSim((s) => openUnsealableNoticesOf(s).length)
  const alertCount = useSim(selectStatedAlertCount)
  const alertMessage = useSim(selectStatedAlertMessage)
  const retrying = statement.kind === 'SEAL_RETRYING'
  const openNotice = statement.kind === 'OPEN_NOTICE'
  const alertActive = statement.kind === 'ALERT_ACTIVE'
  const offline = statement.kind === 'CORE_OFFLINE'
  const notReported = statement.kind === 'NO_FAULT_REPORTED'
  const raised = retrying || openNotice || alertActive
  const Icon = raised ? ShieldAlert : offline ? ShieldQuestion : notReported ? Shield : PILL_ICON[state]
  const title = retrying
    ? t('web.waveM.pill.retryLabel')
    : openNotice
      ? t('web.waveL.notice.pillLabel')
      : alertActive
        ? t('web.waveJ.pill.alertLabel')
        : offline
          ? t('web.waveJ.pill.offlineLabel')
          : notReported
            ? t('web.waveJ.pill.noFaultLabel')
            : t(`shell.securePill.${state}.title`)
  const subtitle = retrying
    ? t('web.waveM.pill.retrySub')
    : openNotice
      ? t('web.waveL.notice.pillSub', { count: openNotices })
      : alertActive
        ? t('web.waveJ.pill.alertSub', { count: alertCount })
        : offline
          ? t('web.waveJ.pill.offlineSub')
          : notReported
            ? t('web.waveJ.pill.noFaultSub')
            : state === 'CRITICAL' && cause === '' && alertCount > 0
              ? t('web.waveJ.pill.alertSub', { count: alertCount })
              : pillSubtitle(t, state, cause)
  const pillTone = raised ? 'ATTENTION' : offline || notReported ? 'UNKNOWN' : state

  return (
    <Popover isOpen={open} onOpenChange={setOpen}>
      <Button
        variant="outline"
        className="dems-secure-pill"
        data-state={pillTone}
        data-statement={statement.kind}
        data-open-notice={openNotice ? 'true' : undefined}
        data-seal-retrying={retrying ? 'true' : undefined}
        data-testid="secure-pill"
        aria-label={`${title}. ${subtitle}`}
      >
        <SecureBeam state={state} />
        <Icon className="dems-secure-icon" aria-hidden="true" strokeWidth={1.75} />
        <span className="dems-secure-text">
          <span className="dems-secure-title">{title}</span>
          <span className="dems-secure-subtitle">{subtitle}</span>
        </span>
        <span
          ref={dotRef}
          className="dems-status-dot"
          data-tone={pillTone === 'UNKNOWN' ? 'UNKNOWN' : state}
          data-shell-slot="secure-dot"
          data-pulses={pulses}
          aria-hidden="true"
          {...dotLoop.attrs}
        >
          {pulses > 0 && m.flags.flashes ? (
            <motion.span
              key={pulses}
              className="dems-status-dot-ring"
              data-testid="secure-ring-pulse"
              initial={{ scale: 1, opacity: 0.5 }}
              animate={{ scale: RING_PULSE_SCALE, opacity: 0 }}
              transition={tween(RING_PULSE_MS, 'standard', m.timeScale)}
            />
          ) : null}
        </span>
      </Button>
      <Popover.Content placement="bottom end" offset={8} className="w-[340px] max-w-[calc(100vw-24px)]">
        <Popover.Dialog aria-label={t('shell.securePill.popoverTitle')}>
          <Popover.Heading className="dems-popover-heading">{t('shell.securePill.popoverTitle')}</Popover.Heading>
          {openNotices > 0 ? (
            <p className="dems-popover-empty" role="status" data-testid="secure-pill-open-notice">
              {t('web.waveL.notice.pillSub', { count: openNotices })}. {t('web.waveL.notice.ringSub')}
            </p>
          ) : null}
          {alertActive && alertMessage !== '' ? (
            <p className="dems-popover-empty" role="status" data-testid="secure-pill-alert">
              {alertMessage}
            </p>
          ) : null}
          {offline ? (
            <p className="dems-popover-empty" role="status" data-testid="secure-pill-offline">
              {t('web.waveJ.pill.offlineDetail')}
            </p>
          ) : null}
          <ul className="dems-check-list" data-testid="integrity-checklist">
            {INTEGRITY_CHECK_IDS.map((id, index) => {
              const stated: CheckStatus | 'UNKNOWN' = ready && !offline ? (checks[index] ?? 'OK') : 'UNKNOWN'
              const notStated = ready && !offline ? ownCoreRow(id, stated, { hostClock: ownCore, platformNotReported }) : null
              const status: CheckStatus | 'UNKNOWN' = notStated !== null ? 'UNKNOWN' : stated
              const CheckIcon = CHECK_ICON[status]
              return (
                <li key={id} className="dems-check-row" data-status={status}>
                  <CheckIcon className="dems-check-icon" aria-hidden="true" size={16} />
                  <span className="dems-check-label">{t(`shell.securePill.checks.${id}`)}</span>
                  <span className="dems-check-status">
                    {notStated !== null ? t(`web.securePill.checkStatus.${notStated}`) : t(`shell.securePill.checkStatus.${status}`)}
                  </span>
                </li>
              )
            })}
          </ul>
          <Link to="/security-audit" className="dems-popover-link" onClick={() => setOpen(false)}>
            {t('shell.securePill.openDetails')}
          </Link>
        </Popover.Dialog>
      </Popover.Content>
    </Popover>
  )
}

/**
 * M-SH-05 BorderBeam slot: mounts MU BorderBeam only while the pill is degraded and the loop holds
 * the `shell` ambient slot (visible tab, on screen, motion allowed). While degraded the beam asks
 * with `escalation` priority, so the shell slot outranks page decoration and the beam is never
 * starved by a page that already shows four loops (step 45b, F45-02; R8, D-42-11).
 */
function SecureBeam({ state }: { state: PillState }) {
  const m = useMotionPolicy()
  const ref = useRef<HTMLSpanElement>(null)
  const degraded = state === 'ATTENTION' || state === 'CRITICAL'
  const loop = useAmbientLoop('secure-beam', {
    ref,
    priority: degraded ? 'escalation' : 'shell',
    group: 'shell',
    enabled: degraded,
  })
  return (
    <span ref={ref} className="dems-secure-beam" data-shell-slot="secure-beam" aria-hidden="true" {...loop.attrs}>
      {loop.running ? (
        <BorderBeam
          size={BEAM_SIZE}
          duration={m.seconds(BEAM_LAP_MS)}
          colorFrom={state === 'CRITICAL' ? palette.danger : palette.warning}
          colorTo={palette.bronze}
          borderWidth={1.5}
        />
      ) : null}
    </span>
  )
}
