import { useRef } from 'react'
import { Chip } from '@heroui/react'
import { motion } from 'motion/react'
import { useTranslation } from 'react-i18next'
import { motion as tokens } from '@dems/shared/tokens'
import { formatDuration } from '@dems/shared/realtime'
import { SlidingNumber } from '@/components/ui/sliding-number'
import { useAmbientLoop, useMotionPolicy } from '@/motion'
import { cn } from '@/lib/utils'
import { useSimSecond } from './use-sim-clock'

/** M-C-05: the halo ring grows to 2.2× while fading 0.5 → 0, once per pulse cycle. */
const HALO_SCALE = 2.2
const PULSE_DOT_OPACITY = [1, 0.35, 1]
const PULSE_DOT_SCALE = [1, 0.9, 1]
const HALO_OPACITY = [0.5, 0]

export interface RecIndicatorProps {
  /** Recording start on the simulator clock (epoch ms). `null` or absent shows REC without a timer. */
  since?: number | null
  /** Default: `session.feed.rec` ("REC"). */
  label?: string
  size?: 'sm' | 'md'
  /** `overlay`: the L4 black media chip (research/04 §1.4). `soft`: a danger soft chip on panels. */
  look?: 'overlay' | 'soft'
  className?: string
}

/**
 * The REC chip (03_motion_spec M-C-05): a red dot that breathes `1 → 0.35 → 1` with a slight
 * scale over `recPulse` (1.2 s ≈ 0.83 Hz, under `flashMaxHz`), a halo that expands once per
 * cycle, and the elapsed time as Motion Primitives `SlidingNumber` digits (tabular, 1 Hz).
 *
 * - The pulse is an ambient loop in the shared group `rec-pulse`, so every REC chip on a page
 *   counts as one of the four slots (§9.4 "REC pulse").
 * - Reduced motion: a static red dot, no halo; the timer still ticks (§8).
 * - The timer digits are `aria-hidden`; a visually hidden text carries "REC 00:18:42".
 */
export function RecIndicator({ since = null, label, size = 'sm', look = 'overlay', className }: RecIndicatorProps) {
  const { t } = useTranslation()
  const m = useMotionPolicy()
  const rootRef = useRef<HTMLSpanElement>(null)
  const loop = useAmbientLoop('rec-pulse', { ref: rootRef, group: 'rec-pulse' })
  const nowSecond = useSimSecond()
  const text = label ?? t('session.feed.rec')
  const elapsed = since === null ? null : formatDuration(nowSecond * 1000 - since)
  const [hh, mm, ss] = (elapsed ?? '00:00:00').split(':').map((part) => Number(part))
  const pulse = m.loop(tokens.ambient.recPulse, { mirror: false, ease: 'easeInOut' })

  return (
    <Chip
      color="danger"
      variant="soft"
      size={size}
      data-testid="rec-indicator"
      className={cn(
        'gap-1.5 font-semibold',
        look === 'overlay' && 'border-0 bg-black/65 text-white',
        className,
      )}
    >
      <span ref={rootRef} className="relative inline-flex size-2.5 items-center justify-center" aria-hidden="true" {...loop.attrs}>
        {loop.running ? (
          <motion.span
            className="absolute inset-0 rounded-full border border-danger"
            initial={{ opacity: 0.5, scale: 1 }}
            animate={{ opacity: HALO_OPACITY, scale: [1, HALO_SCALE] }}
            transition={pulse}
          />
        ) : null}
        <motion.span
          className="relative size-2.5 rounded-full bg-danger"
          initial={false}
          animate={loop.running ? { opacity: PULSE_DOT_OPACITY, scale: PULSE_DOT_SCALE } : { opacity: 1, scale: 1 }}
          transition={loop.running ? pulse : { duration: 0 }}
        />
      </span>
      <Chip.Label className="inline-flex items-center gap-1.5 tabular-nums">
        <span aria-hidden="true">{text}</span>
        {elapsed !== null ? (
          <span aria-hidden="true" className="inline-flex items-center font-mono" data-testid="rec-timer">
            <SlidingNumber value={hh ?? 0} padStart />
            <span>:</span>
            <SlidingNumber value={mm ?? 0} padStart />
            <span>:</span>
            <SlidingNumber value={ss ?? 0} padStart />
          </span>
        ) : null}
        <span className="sr-only">{elapsed !== null ? `${text} ${elapsed}` : text}</span>
      </Chip.Label>
    </Chip>
  )
}
