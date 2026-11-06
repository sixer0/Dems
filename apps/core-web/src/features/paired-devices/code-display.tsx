import { useEffect, useState } from 'react'
import { motion } from 'motion/react'
import { QRCodeSVG } from 'qrcode.react'
import { useTranslation } from 'react-i18next'
import { SlidingNumber } from '@/components/ui/sliding-number'
import { TextScramble } from '@/components/ui/text-scramble'
import { useMotionPolicy } from '@/motion'
import { cn } from '@/lib/utils'
import { countdownTone, formatCountdown, lifetimeShare, secondsLeft } from './model'

/** `TextScramble` over digits only, for 600 ms (§10.3); reduced motion: at once (the component's own rule). */
const SCRAMBLE_DIGITS = '0123456789'
const SCRAMBLE_SECONDS = 0.6
/** The QR of §10.3: 200 px, level M, dark modules on a light tile with a quiet zone of four modules. */
const QR_SIZE_PX = 200
const QR_QUIET_ZONE_MODULES = 4

export interface CodeDigitsProps {
  /** The six digits of the answer of operation 15. Rendered as text here and passed to nothing else. */
  code: string
  /** Revealed once already (a later visit of the page shows the digits at once). */
  revealed: boolean
  onRevealed: () => void
  dimmed?: boolean
}

/**
 * The six digits in two groups of three, mono, large (§10.3), revealed ONCE by `TextScramble`. The
 * reveal is recorded when the digits are first shown, and whether this mount scrambles is decided at
 * mount: the first mount plays the scramble to its end, any later mount (a visit of another page and
 * back, a re-render of the route after a permission refresh) shows the digits at once.
 */
export function CodeDigits({ code, revealed, onRevealed, dimmed = false }: CodeDigitsProps) {
  const { t } = useTranslation()
  const [scramble] = useState(() => !revealed)
  // The first showing of the digits records the reveal (`onRevealed` is stable and idempotent).
  useEffect(() => {
    if (scramble) onRevealed()
  }, [scramble, onRevealed])
  const groups = [code.slice(0, 3), code.slice(3)]
  return (
    <div className={cn('pd-code', dimmed && 'pd-dimmed')} data-testid="pd-code" role="group" aria-label={t('pairedDevices.issue.codeLabel')}>
      {groups.map((group, index) => (
        <TextScramble key={index} as="span" className="pd-code-group" characterSet={SCRAMBLE_DIGITS} duration={SCRAMBLE_SECONDS} trigger={scramble}>
          {group}
        </TextScramble>
      ))}
    </div>
  )
}

export interface CodeQrProps {
  /** The answer's `qrPayload` as it arrived (`DEMS-PAIR:1:` and the code, [SP:PR-P7]); never rebuilt here. */
  payload: string
  dimmed?: boolean
}

/** `QRCodeSVG` with the server's `qrPayload` as its value (§10.3; AC-C-92). */
export function CodeQr({ payload, dimmed = false }: CodeQrProps) {
  const { t } = useTranslation()
  return (
    <div className={cn('pd-qr-tile', dimmed && 'pd-dimmed')}>
      <QRCodeSVG
        value={payload}
        size={QR_SIZE_PX}
        level="M"
        boostLevel={false}
        marginSize={QR_QUIET_ZONE_MODULES}
        bgColor="#FFFFFF"
        fgColor="#111111"
        role="img"
        aria-label={t('pairedDevices.issue.qrLabel')}
        data-testid="pd-qr"
      />
    </div>
  )
}

export interface CountdownProps {
  issuedAt: number
  expiresAt: number
  /** The Live clock. */
  now: number
}

/**
 * The countdown to expiry (§10.3): minutes and seconds in `SlidingNumber` from `expiresAt` and the
 * Live clock; a hairline that shrinks with `scaleX` (composite only), gold, amber from 60 s, red
 * from 15 s, each step with one halo (R8). Reduced motion: the numbers jump, no halo.
 */
export function Countdown({ issuedAt, expiresAt, now }: CountdownProps) {
  const { t } = useTranslation()
  const m = useMotionPolicy()
  const seconds = secondsLeft(expiresAt, now)
  const tone = countdownTone(seconds)
  const text = formatCountdown(seconds)
  return (
    <div className="pd-countdown-block">
      <div className={`pd-countdown pd-tone-${tone}`} data-testid="pd-countdown" data-seconds={seconds} data-tone={tone} role="timer">
        <span className="sr-only">{t('pairedDevices.issue.expiresIn', { time: text })}</span>
        <span className="pd-countdown-digits" aria-hidden="true">
          {m.flags.animateNumbers ? (
            <>
              <SlidingNumber value={Math.floor(seconds / 60)} />
              <span>:</span>
              <SlidingNumber value={seconds % 60} padStart />
            </>
          ) : (
            text
          )}
        </span>
        {m.flags.flashes ? <motion.span key={tone} aria-hidden="true" className="pd-halo" variants={m.variants.halo} initial="hidden" animate="visible" /> : null}
      </div>
      <div className="pd-expiry-track" aria-hidden="true">
        <div className={`pd-expiry-bar pd-tone-${tone}`} data-testid="pd-expiry-bar" data-tone={tone} style={{ transform: `scaleX(${lifetimeShare(issuedAt, expiresAt, now)})` }} />
      </div>
    </div>
  )
}
