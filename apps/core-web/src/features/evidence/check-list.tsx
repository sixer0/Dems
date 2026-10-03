import { Chip, Spinner } from '@heroui/react'
import { motion } from 'motion/react'
import { CircleCheck, CircleDashed, CircleX } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { DEMO_PRECOMPUTED_LABEL } from '@dems/shared/demo-data'
import { TextScramble } from '@/components/ui/text-scramble'
import { useMotionPolicy } from '@/motion'
import { cn } from '@/lib/utils'
import { checkLabel } from './labels'
import { shortHash } from './model'
import type { VerifyCheckView, VerifyState } from './use-verification'

const HEX = '0123456789abcdef'

function display(value: string | null): string {
  if (value === null) return '—'
  return /^[0-9a-f]{40,}$/.test(value) ? shortHash(value, 10) : value
}

export interface CheckListProps {
  state: VerifyState
  /** `full`: expected and found values (Integrity tab). `compact`: label and status (export wizard). */
  variant?: 'full' | 'compact'
  className?: string
}

/**
 * The per-check verification list (M-C-21): each row goes pending → running (Spinner) → PASS
 * (check) or FAIL (cross), and the found hash resolves with MP TextScramble (800 ms, 0-9a-f). A FAIL
 * row shows the sealed value next to the found one. Precomputed and simulated checks are labelled
 * (P13). Reduced motion: the final text at once, no scramble.
 */
export function CheckList({ state, variant = 'full', className }: CheckListProps) {
  const { t } = useTranslation()
  return (
    <ol className={cn('evi-checks', `evi-checks-${variant}`, className)} data-testid="evidence-checks" aria-live="polite">
      {state.checks.map((check) => (
        <CheckRow key={check.id} check={check} runId={state.runId} variant={variant} label={checkLabel(t, check.id)} />
      ))}
    </ol>
  )
}

interface CheckRowProps {
  check: VerifyCheckView
  runId: number
  variant: 'full' | 'compact'
  label: string
}

function CheckRow({ check, runId, variant, label }: CheckRowProps) {
  const { t } = useTranslation()
  const m = useMotionPolicy()
  const settled = check.phase === 'pass' || check.phase === 'fail'
  const Icon = check.phase === 'pass' ? CircleCheck : check.phase === 'fail' ? CircleX : CircleDashed

  return (
    <li className="evi-check" data-check={check.id} data-phase={check.phase} data-source={check.source ?? undefined}>
      <span className="evi-check-icon" aria-hidden="true">
        {check.phase === 'running' ? (
          <Spinner size="sm" color="current" />
        ) : (
          <motion.span
            key={`${check.phase}-${runId}`}
            className="inline-flex"
            initial={settled && !m.reduced ? { scale: 0.6, opacity: 0 } : false}
            animate={{ scale: 1, opacity: 1 }}
            transition={check.phase === 'pass' ? m.transitions.completion : m.transitions.crossFade}
          >
            <Icon className="size-4" />
          </motion.span>
        )}
      </span>
      <span className="evi-check-label">{label}</span>
      <span className="evi-check-status">
        {check.source === 'precomputed' ? (
          <Chip size="sm" variant="secondary" className="evi-source-chip">
            <Chip.Label>{DEMO_PRECOMPUTED_LABEL}</Chip.Label>
          </Chip>
        ) : null}
        {check.source === 'simulated' ? (
          <Chip size="sm" variant="secondary" className="evi-source-chip">
            <Chip.Label>{t('common.simulated.chip')}</Chip.Label>
          </Chip>
        ) : null}
        <span className="sr-only">{t(`evidence.verify.phase.${check.phase}`)}</span>
      </span>
      {variant === 'full' && settled ? (
        <span className="evi-check-values">
          <span className="evi-check-value" data-kind="actual">
            <span className="evi-check-key">{t('evidence.verify.found')}</span>
            <TextScramble key={`found-${runId}`} as="span" className="evi-mono" characterSet={HEX} duration={0.8}>
              {display(check.actual)}
            </TextScramble>
          </span>
          {check.phase === 'fail' ? (
            <span className="evi-check-value" data-kind="expected">
              <span className="evi-check-key">{t('evidence.verify.sealed')}</span>
              <span className="evi-mono">{display(check.expected)}</span>
            </span>
          ) : null}
        </span>
      ) : null}
    </li>
  )
}
