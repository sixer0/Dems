import { useState, type ReactNode } from 'react'
import { Chip, Separator, Spinner } from '@heroui/react'
import { AnimatePresence, motion, type Transition } from 'motion/react'
import { TriangleAlert, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toneChipProps, motion as tokens } from '@dems/shared/tokens'
import { GlowLayer, glowShadow, tween, useMotionPolicy, type GlowTone } from '@/motion'
import { cn } from '@/lib/utils'

export type StepperStatus = 'pending' | 'active' | 'done' | 'warn' | 'error'

export interface StepperStep {
  id: string
  label: string
  status: StepperStatus
  /** Optional second line (a value, a reason, a duration). */
  description?: ReactNode
}

export interface StepperProps {
  steps: readonly StepperStep[]
  orientation: 'horizontal' | 'vertical'
  /** `wizard`: numbered badges (Start Session, Export). `pipeline`: Spinner → check (Finalization, Update, Lifecycle). */
  variant: 'wizard' | 'pipeline'
  /** Accessible name of the list. */
  ariaLabel?: string
  className?: string
}

/** M-C-09 literals (D49): the connector fill (`slow`, 420 ms `luxe`) and the check draw (300 ms). */
export const CONNECTOR_FILL_MS = tokens.duration.slow
export const CHECK_DRAW_MS = 300

const BADGE_COLOR: Record<StepperStatus, 'default' | 'accent' | 'success' | 'warning' | 'danger'> = {
  pending: 'default',
  active: 'accent',
  done: 'success',
  warn: 'warning',
  error: 'danger',
}

const BADGE_TONE: Record<StepperStatus, GlowTone> = {
  pending: 'brand',
  active: 'brand',
  done: 'success',
  warn: 'warning',
  error: 'danger',
}

function isAttention(status: StepperStatus): boolean {
  return status === 'active' || status === 'warn' || status === 'error'
}

function CheckMark({ animateDraw }: { animateDraw: boolean }) {
  const m = useMotionPolicy()
  return (
    <svg viewBox="0 0 24 24" className="size-3.5" fill="none" stroke="currentColor" strokeWidth={3} aria-hidden="true">
      <motion.path
        d="M5 12.5l4.5 4.5L19 7.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={animateDraw && !m.reduced ? { pathLength: 0 } : false}
        animate={{ pathLength: 1 }}
        transition={tween(CHECK_DRAW_MS, 'standard', m.timeScale)}
      />
    </svg>
  )
}

interface StepItemProps {
  step: StepperStep
  index: number
  count: number
  horizontal: boolean
  variant: StepperProps['variant']
  doneAtMount: boolean
  statusText: string
}

function StepItem({ step, index, count, horizontal, variant, doneAtMount, statusText }: StepItemProps) {
  const m = useMotionPolicy()
  const { status } = step
  // R8: one pulse each time the step enters active, warn or error (derived during render).
  const [track, setTrack] = useState({ status, pulses: 0 })
  if (track.status !== status) {
    setTrack({ status, pulses: isAttention(status) ? track.pulses + 1 : track.pulses })
  }
  const last = index === count - 1
  const fill: Transition = tween(CONNECTOR_FILL_MS, 'luxe', m.timeScale)

  let badgeContent: ReactNode
  if (status === 'done') badgeContent = <CheckMark animateDraw={!doneAtMount} />
  else if (status === 'active' && variant === 'pipeline') badgeContent = <Spinner size="sm" color="current" aria-hidden="true" />
  else if (status === 'warn') badgeContent = <TriangleAlert className="size-3.5" aria-hidden="true" />
  else if (status === 'error') badgeContent = <X className="size-3.5" aria-hidden="true" />
  else badgeContent = <span className="font-mono text-caption font-semibold">{variant === 'wizard' ? index + 1 : ''}</span>

  const badge = (
    <Chip
      color={BADGE_COLOR[status]}
      variant={status === 'pending' ? 'secondary' : 'soft'}
      size="sm"
      data-step-badge={status}
      className="relative size-7 shrink-0 justify-center rounded-full p-0 transition-colors duration-[400ms]"
    >
      <GlowLayer level={status === 'active' ? 2 : 0} tone={BADGE_TONE[status]} pulseKey={track.pulses} />
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={status === 'active' && variant === 'wizard' ? 'pending' : status}
          className="relative inline-flex items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={m.transitions.crossFade}
        >
          {badgeContent}
        </motion.span>
      </AnimatePresence>
    </Chip>
  )

  const connector = last ? null : (
    <span
      aria-hidden="true"
      data-step-connector={status === 'done' ? 'filled' : 'empty'}
      className={cn('relative flex', horizontal ? 'mx-2 h-7 min-w-6 flex-1 items-center' : 'ml-3.5 w-px flex-1 self-stretch py-1')}
    >
      <Separator orientation={horizontal ? 'horizontal' : 'vertical'} className={horizontal ? 'w-full' : 'h-full min-h-4'} />
      <motion.span
        className={cn('absolute bg-accent', horizontal ? 'inset-x-0 top-1/2 h-px origin-left' : 'inset-y-1 left-0 w-px origin-top')}
        initial={false}
        animate={horizontal ? { scaleX: status === 'done' ? 1 : 0 } : { scaleY: status === 'done' ? 1 : 0 }}
        transition={fill}
      />
    </span>
  )

  const labelBlock = (
    <span className={cn('flex min-w-0 flex-col', horizontal ? 'items-center text-center' : 'pb-3')}>
      <span
        className={cn(
          'text-body font-medium',
          status === 'pending' ? 'text-foreground-2' : 'text-foreground',
          status === 'error' && 'text-danger',
        )}
      >
        {step.label}
      </span>
      {step.description ? <span className="text-caption text-foreground-2">{step.description}</span> : null}
      <span className="sr-only">{statusText}</span>
    </span>
  )

  if (horizontal) {
    return (
      <li
        data-step={step.id}
        data-status={status}
        aria-current={status === 'active' ? 'step' : undefined}
        className={cn('flex min-w-0 items-start', !last && 'flex-1')}
      >
        <span className="flex flex-col items-center gap-1.5">
          {badge}
          {labelBlock}
        </span>
        {connector}
      </li>
    )
  }
  return (
    <li
      data-step={step.id}
      data-status={status}
      aria-current={status === 'active' ? 'step' : undefined}
      className="flex min-w-0 gap-3"
    >
      <span className="flex flex-col items-start">
        {badge}
        {connector}
      </span>
      <span className="pt-1">{labelBlock}</span>
    </li>
  )
}

/**
 * Stepper (01_specs §14.6; 03_motion_spec M-C-09). Kit `Chip` badges, kit `Separator`
 * connectors and Motion.
 * - Connector fill: `scaleX` (or `scaleY`) 0 → 1 over 420 ms `luxe` when a step completes.
 * - Badge: pending → active adds the e2 glow and one pulse; done draws the check (300 ms);
 *   warn or error changes colour with one pulse. Pipeline steps show a Spinner while active.
 * - Reduced motion: instant state changes (the check is drawn, no pulses).
 * Accessibility: `<ol>`; the active step has `aria-current="step"`; each step carries its status
 * as visually hidden text. Wizard content transitions (TransitionPanel) belong to the page.
 */
export function Stepper({ steps, orientation, variant, ariaLabel, className }: StepperProps) {
  const { t } = useTranslation()
  const m = useMotionPolicy()
  const horizontal = orientation === 'horizontal'
  const [doneAtMount] = useState(() => new Set(steps.filter((step) => step.status === 'done').map((step) => step.id)))
  const statusText: Record<StepperStatus, string> = {
    pending: t('common.status.pending'),
    active: t('common.status.active'),
    done: t('common.actions.done'),
    warn: t('common.status.warning'),
    error: t('common.status.fault'),
  }

  return (
    <ol
      data-testid="stepper"
      data-variant={variant}
      data-orientation={orientation}
      data-motion={m.policy}
      aria-label={ariaLabel}
      className={cn(horizontal ? 'flex w-full items-start' : 'flex flex-col', className)}
    >
      {steps.map((step, index) => (
        <StepItem
          key={step.id}
          step={step}
          index={index}
          count={steps.length}
          horizontal={horizontal}
          variant={variant}
          doneAtMount={doneAtMount.has(step.id)}
          statusText={`${index + 1}/${steps.length}: ${statusText[step.status]}`}
        />
      ))}
    </ol>
  )
}

/** M-C-09 SEALED stamp literals: the e3 glow flash and the hairline ring. */
export const STAMP_GLOW_MS = 400
export const STAMP_RING_MS = 700

export interface StepperStampProps {
  /** Shown when true (the finalization pipeline ended). */
  show: boolean
  /** Default `common.evidenceStatus.SEALED` ("Sealed"). */
  label?: string
  className?: string
}

/**
 * The SEALED stamp that ends a finalization pipeline (M-C-09): the violet chip scales from
 * `stampFrom` (1.2) to 1 on the `bouncy` spring, with one e3 glow flash (400 ms) and a single
 * hairline ring that expands and fades (700 ms). Reduced motion: a static stamp.
 */
export function StepperStamp({ show, label, className }: StepperStampProps) {
  return <AnimatePresence>{show ? <StampBody key="stamp" label={label} className={className} /> : null}</AnimatePresence>
}

function StampBody({ label, className }: Omit<StepperStampProps, 'show'>) {
  const { t } = useTranslation()
  const m = useMotionPolicy()
  const sealed = toneChipProps('sealed')
  return (
        <motion.span
          data-testid="stepper-stamp"
          className={cn('relative inline-flex rounded-full', className)}
          variants={m.variants.stamp}
          initial="hidden"
          animate="visible"
          exit={{ opacity: 0 }}
        >
          {m.flags.flashes ? (
            // One e3 glow flash: a pre-rendered glow whose opacity alone moves (§9.2).
            <motion.span
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 rounded-[inherit]"
              style={{ boxShadow: glowShadow('sealed', 3) }}
              initial={{ opacity: 0 }}
              animate={{ opacity: [0, 1, 0] }}
              transition={tween(STAMP_GLOW_MS, 'standard', m.timeScale)}
            />
          ) : null}
          {m.flags.flashes ? (
            <motion.span
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 rounded-full border border-sealed"
              initial={{ opacity: 0.8, scale: 1 }}
              animate={{ opacity: 0, scale: 1.8 }}
              transition={tween(STAMP_RING_MS, 'standard', m.timeScale)}
            />
          ) : null}
          <Chip color={sealed.color} variant="soft" size="md" className={cn('font-semibold uppercase', sealed.className)}>
            <Chip.Label>{label ?? t('common.evidenceStatus.SEALED')}</Chip.Label>
          </Chip>
        </motion.span>
  )
}
