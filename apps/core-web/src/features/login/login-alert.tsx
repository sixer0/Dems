import { useState } from 'react'
import { Alert, Button, Spinner } from '@heroui/react'
import { AnimatePresence, LayoutGroup, motion } from 'motion/react'
import { useTranslation } from 'react-i18next'
import type { RetryCooldown } from '@dems/shared/realtime'
import { AnimatedNumber } from '@/components/ui/animated-number'
import { SlidingNumber } from '@/components/ui/sliding-number'
import { tween, useMotionPolicy } from '@/motion'
import {
  alertStatusFor,
  coreAddress,
  countdownParts,
  IDLE_TIMEOUT_MINUTES,
  isArrivalNotice,
  splitAroundNumber,
  splitAroundToken,
  type LoginNotice,
} from './login-model'

export interface LoginAlertProps {
  notice: LoginNotice | null
  /** Bumps each time the console locks: the shackle closes once more (M-C-22). */
  lockKey: number
  /** Core offline Retry (rate-limited, `useRetryCooldown`). */
  coreRetry: RetryCooldown
  /** The heartbeat is reconnecting right now: Retry shows a Spinner (M-C-22). */
  reconnecting: boolean
  /** The arrival notice ("You have been signed out.") enters last on the page (ms, unscaled). */
  arrivalDelayMs: number
  /**
   * Live mode in a build that offers the choice (§3.5): the offline Alert gets a second action,
   * "Use Simulated mode", which asks for the confirmation of a mode change. Absent or `null`: the
   * Alert has its one action, as on the simulator.
   */
  onUseSimulated?: (() => void) | null
}

/**
 * The one Alert of the Login card (01_specs §14.8 "States"; research/04 §5.8), most urgent first:
 * Locked out (warning, live countdown), Core offline (danger, Retry), Error (danger, generic copy
 * plus attempts remaining), Signed out / Console locked / Expired (accent).
 *
 * Motion (M-C-22, M-C-14): the Alert slides in (`y -6 → 0`, 240) and cross-fades between kinds;
 * the lock shackle closes (rotate 20° → 0, `snappy`); the countdown slides (SlidingNumber); the
 * attempts caption ticks (AnimatedNumber). Reduced motion: opacity only, numbers jump.
 *
 * Accessibility: danger and warning are `role="alert"`, notices are `role="status"`. The live
 * countdown digits are `aria-hidden`; a static sentence carries the time for screen readers, so
 * the Alert is announced once instead of every second.
 *
 * Live mode (backend task, plan row W55) adds wording, not structure: a Core server that is
 * starting (§3.5), the server's refusal of the input (422), the 8-hour limit of a session (WS-14)
 * and a disabled account (§6.4, danger). No text of this Alert names a simulated value.
 */
export function LoginAlert({ notice, lockKey, coreRetry, reconnecting, arrivalDelayMs, onUseSimulated = null }: LoginAlertProps) {
  const m = useMotionPolicy()
  const isArrival = isArrivalNotice(notice)
  const enter = m.reduced
    ? tween('fast', 'standard', m.timeScale)
    : { ...tween('base', 'standard', m.timeScale), delay: isArrival ? m.seconds(arrivalDelayMs) : 0 }

  return (
    <div className="dems-login-alert-slot" data-testid="login-alert-slot">
      <AnimatePresence mode="wait" initial={isArrival}>
        {notice ? (
          <motion.div
            key={notice.kind}
            initial={m.reduced ? { opacity: 0 } : { opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0, transition: enter }}
            exit={{ opacity: 0, transition: tween('fast', 'exit', m.timeScale) }}
          >
            <NoticeAlert notice={notice} lockKey={lockKey} coreRetry={coreRetry} reconnecting={reconnecting} onUseSimulated={onUseSimulated} />
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  )
}

function NoticeAlert({
  notice,
  lockKey,
  coreRetry,
  reconnecting,
  onUseSimulated,
}: {
  notice: LoginNotice
  lockKey: number
  coreRetry: RetryCooldown
  reconnecting: boolean
  onUseSimulated: (() => void) | null
}) {
  const { t } = useTranslation()
  const status = alertStatusFor(notice)
  const role = status === 'accent' ? 'status' : 'alert'

  switch (notice.kind) {
    case 'locked':
      return (
        <Alert status={status} role={role} data-testid="login-alert" data-kind={notice.kind}>
          <Alert.Indicator>
            <LockShackle closeKey={lockKey} />
          </Alert.Indicator>
          <Alert.Content>
            <Alert.Title>{t('login.errors.lockedTitle')}</Alert.Title>
            <Alert.Description>
              <LockCountdown seconds={notice.retryInSeconds} />
            </Alert.Description>
          </Alert.Content>
        </Alert>
      )
    case 'core-offline':
    case 'core-starting': {
      const retry = (
        <Button
          size="sm"
          variant="danger-soft"
          className="dems-login-retry"
          isDisabled={!coreRetry.canRetry}
          onPress={coreRetry.retry}
          data-testid="login-core-retry"
        >
          {reconnecting && coreRetry.retryCount > 0 ? <Spinner size="sm" color="current" /> : null}
          {coreRetry.exhausted
            ? t('common.errors.maxRetries')
            : coreRetry.cooldown > 0
              ? t('common.actions.retryIn', { seconds: coreRetry.cooldown })
              : t('common.actions.retry')}
        </Button>
      )
      return (
        <Alert status={status} role={role} data-testid="login-alert" data-kind={notice.kind}>
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>{notice.kind === 'core-starting' ? t('common.coreLink.starting') : t('login.errors.coreOfflineTitle')}</Alert.Title>
            <Alert.Description>
              {notice.kind === 'core-starting' ? t('login.live.errors.startingBody') : t('login.errors.coreOfflineBody', { address: coreAddress() })}
            </Alert.Description>
          </Alert.Content>
          {onUseSimulated ? (
            <div className="dems-login-alert-actions">
              {retry}
              <Button size="sm" variant="ghost" className="dems-login-retry" onPress={onUseSimulated} data-testid="login-use-simulated">
                {t('common.coreMode.useSimulated')}
              </Button>
            </div>
          ) : (
            retry
          )}
        </Alert>
      )
    }
    case 'invalid':
      return (
        <Alert status={status} role={role} data-testid="login-alert" data-kind={notice.kind}>
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>{t('login.errors.invalid')}</Alert.Title>
            <Alert.Description>
              <AttemptsCaption count={notice.attemptsRemaining} />
            </Alert.Description>
          </Alert.Content>
        </Alert>
      )
    case 'unexpected':
      return (
        <Alert status={status} role={role} data-testid="login-alert" data-kind={notice.kind}>
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>{t('common.errors.generic')}</Alert.Title>
          </Alert.Content>
        </Alert>
      )
    case 'input-rejected':
      return (
        <Alert status={status} role={role} data-testid="login-alert" data-kind={notice.kind}>
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>{t('login.live.errors.inputRejected')}</Alert.Title>
          </Alert.Content>
        </Alert>
      )
    default: {
      const text =
        notice.kind === 'expired'
          ? t('login.notices.sessionExpired', { minutes: IDLE_TIMEOUT_MINUTES })
          : notice.kind === 'expired-absolute'
            ? t('login.live.notices.absoluteExpired')
            : notice.kind === 'disabled'
              ? t('login.live.notices.userDisabled')
              : notice.kind === 'console-locked'
                ? t('login.notices.consoleLocked')
                : t('login.notices.signedOut')
      return (
        <Alert status={status} role={role} data-testid="login-alert" data-kind={notice.kind}>
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>{text}</Alert.Title>
          </Alert.Content>
        </Alert>
      )
    }
  }
}

/** "Try again in 00:59." with sliding digits; screen readers get one static sentence. */
function LockCountdown({ seconds }: { seconds: number }) {
  const { t } = useTranslation()
  const m = useMotionPolicy()
  const [announced] = useState(seconds)
  const parts = countdownParts(seconds)
  const { before, after } = splitAroundToken((token) => t('login.errors.lockedBody', { countdown: token }))
  const slide = m.flags.animateNumbers
  return (
    <>
      <span aria-hidden="true" className="dems-login-countdown" data-testid="login-lock-countdown" data-seconds={seconds}>
        {before}
        <span className="dems-login-countdown-digits">
          <LayoutGroup id="login-countdown" inherit={false}>
            {slide ? <SlidingNumber value={parts.minutes} padStart /> : String(parts.minutes).padStart(2, '0')}
            <span>:</span>
            {slide ? <SlidingNumber value={parts.seconds} padStart /> : String(parts.seconds).padStart(2, '0')}
          </LayoutGroup>
        </span>
        {after}
      </span>
      {/* Fixed at the moment the Alert appeared, so it is announced once, not every second. */}
      <span className="sr-only">{t('login.errors.lockedBody', { countdown: countdownParts(announced).text })}</span>
    </>
  )
}

/** "3 attempts remaining", the number ticking down (AnimatedNumber, M-C-22). */
function AttemptsCaption({ count }: { count: number }) {
  const { t } = useTranslation()
  const text = t('login.errors.attemptsRemaining', { count })
  const parts = splitAroundNumber(text, count)
  if (!parts) return <span data-testid="login-attempts">{text}</span>
  return (
    <span data-testid="login-attempts" aria-label={text}>
      <span aria-hidden="true">
        {parts.before}
        <AnimatedNumber value={count} className="tabular-nums" />
        {parts.after}
      </span>
    </span>
  )
}

/**
 * The Lucide `lock` glyph (ISC; same geometry) drawn as two parts, so the shackle can close:
 * rotate 20° → 0 around its right leg with spring `snappy` (M-C-22). `closeKey` replays it.
 */
function LockShackle({ closeKey }: { closeKey: number }) {
  const m = useMotionPolicy()
  return (
    <svg
      viewBox="0 0 24 24"
      width={20}
      height={20}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      data-testid="login-lock-icon"
    >
      <rect x={3} y={11} width={18} height={11} rx={2} ry={2} />
      <motion.path
        key={closeKey}
        d="M7 11V7a5 5 0 0 1 10 0v4"
        style={{ originX: 1, originY: 1 }}
        initial={m.reduced ? false : { rotate: 20, y: -2 }}
        animate={{ rotate: 0, y: 0 }}
        transition={m.spring('snappy')}
      />
    </svg>
  )
}
