import { useState } from 'react'
import { Chip } from '@heroui/react'
import { AnimatePresence, motion } from 'motion/react'
import { useMotionPolicy } from '@/motion'
import { cn } from '@/lib/utils'
import type { DeviceTone } from './model'

export interface StatusChipProps {
  tone: DeviceTone
  label: string
  /** Escalation rank (0 healthy, 1 attention, 2 fault). A rise plays one halo pulse (R8). */
  severity: number
  testId?: string
  className?: string
}

/**
 * Device status chip (M-C-10): kit `Chip` (soft, dot start content). The label cross-fades
 * (120 ms, `AnimatePresence mode="wait"`), fill and border colours transition over 400 ms (CSS),
 * and only an **escalation** plays one halo pulse (scale 1 → 1.35, opacity 0.5 → 0, 600 ms);
 * de-escalation is a colour change only (P7, R8). Reduced motion: no halo.
 */
export function StatusChip({ tone, label, severity, testId, className }: StatusChipProps) {
  const m = useMotionPolicy()
  // Escalations counted while rendering (no effect): each new count replays the halo once.
  const [seen, setSeen] = useState({ severity, pulses: 0 })
  let pulses = seen.pulses
  if (seen.severity !== severity) {
    pulses = severity > seen.severity ? seen.pulses + 1 : seen.pulses
    setSeen({ severity, pulses })
  }
  return (
    <span className={cn('dev-chip-wrap', className)} data-testid={testId} data-tone={tone}>
      <Chip color={tone} variant="soft" size="sm" className="dev-chip">
        <span className="dev-chip-dot" aria-hidden="true" />
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={label}
            className="inline-flex"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: m.seconds(120) }}
          >
            <Chip.Label>{label}</Chip.Label>
          </motion.span>
        </AnimatePresence>
      </Chip>
      {pulses > 0 && m.flags.flashes ? (
        <motion.span
          key={pulses}
          aria-hidden="true"
          className="dev-chip-halo"
          variants={m.variants.halo}
          initial="hidden"
          animate="visible"
        />
      ) : null}
    </span>
  )
}

export interface StatusDotProps {
  tone: DeviceTone
  className?: string
}

/** The mockup's glowing status dot (AS #4): a filled dot in a dark ring with a static halo. */
export function StatusDot({ tone, className }: StatusDotProps) {
  return <span className={cn('dev-dot', className)} data-tone={tone} aria-hidden="true" />
}
