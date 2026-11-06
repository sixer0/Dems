import { Chip, Spinner } from '@heroui/react'
import { AnimatePresence, motion } from 'motion/react'
import { Archive, CircleDot, Eye, LockKeyhole, Share2, ShieldAlert, ShieldCheck, ShieldQuestion, type LucideIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { evidenceStatusLabel } from './status-label'
import { verificationOfRecordFailed, type EvidenceStatus, type SubjectType } from '@dems/shared/sim'
import { toneChipProps } from '@dems/shared/tokens'
import { GlowLayer, useMotionPolicy } from '@/motion'
import { cn } from '@/lib/utils'
import { STATUS_TONE, SUBJECT_TONE } from './model'

const STATUS_ICON: Record<EvidenceStatus, LucideIcon> = {
  RECORDED: CircleDot,
  SEALED: LockKeyhole,
  EXPORTED: Share2,
  UNDER_REVIEW: Eye,
  ARCHIVED: Archive,
}

export interface EvidenceStatusChipProps {
  status: EvidenceStatus
  /**
   * Fix wave J (JT-04 / JW-09; truth rule 3b): the item itself, so the chip can state its verification of
   * record. An item whose stored verdict is FAIL (`verificationOfRecordFailed`) NEVER reads plain "Sealed" -
   * on the list row, the header, the Status fact and the preview alike, because they all draw this chip.
   */
  item?: unknown
  size?: 'sm' | 'md'
  className?: string
}

/**
 * Evidence status chip (research/04 §5.1): Recorded green, **Sealed violet** (D28/Q4, the `sealed`
 * tone), Exported blue, Under Review amber, Archived grey. Label changes cross-fade (M-C-10).
 * A failed verification of record turns it to the danger tone with "Sealed · verification FAILED" (wave J).
 */
export function EvidenceStatusChip({ status, item, size = 'sm', className }: EvidenceStatusChipProps) {
  const { t } = useTranslation()
  const m = useMotionPolicy()
  const failed = verificationOfRecordFailed(item) && status !== 'RECORDED'
  const tone = toneChipProps(failed ? 'danger' : STATUS_TONE[status])
  const Icon = failed ? ShieldAlert : STATUS_ICON[status]
  return (
    <Chip
      color={tone.color}
      variant="soft"
      size={size}
      data-evidence-status={status}
      data-verification-failed={failed ? 'true' : undefined}
      className={cn('evi-status-chip transition-colors duration-[400ms]', tone.className, className)}
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={`${status}-${failed ? 'F' : ''}`}
          className="inline-flex items-center gap-1"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={m.transitions.crossFade}
        >
          <Icon className="size-3" aria-hidden="true" strokeWidth={2.2} />
          <Chip.Label>{evidenceStatusLabel(t, status, item)}</Chip.Label>
        </motion.span>
      </AnimatePresence>
    </Chip>
  )
}

export interface SubjectTypeChipProps {
  type: SubjectType
  className?: string
}

/** Subject-type chip, Indonesian verbatim with the EN gloss as a hint (D28/Q3): Tersangka red, Saksi blue, Lainnya neutral. */
export function SubjectTypeChip({ type, className }: SubjectTypeChipProps) {
  const { t } = useTranslation()
  const tone = toneChipProps(SUBJECT_TONE[type])
  return (
    <Chip
      color={tone.color}
      variant="soft"
      size="sm"
      title={t(`common.subjectTypeGloss.${type}`)}
      data-subject-type={type}
      className={cn('evi-subject-chip', tone.className, className)}
    >
      <Chip.Label>{t(`common.subjectType.${type}`)}</Chip.Label>
    </Chip>
  )
}

export type VerdictState = 'NOT_RUN' | 'RUNNING' | 'PASS' | 'FAIL' | 'ERROR'

export interface VerdictChipProps {
  verdict: VerdictState
  /** Changes per run, so the completion moment replays. */
  runKey?: number
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const VERDICT_ICON: Record<Exclude<VerdictState, 'RUNNING'>, LucideIcon> = {
  NOT_RUN: ShieldQuestion,
  PASS: ShieldCheck,
  FAIL: ShieldAlert,
  ERROR: ShieldQuestion,
}

/**
 * The integrity verdict (M-C-21, P4, P7): PASS pops on the `bouncy` spring with one green glow;
 * FAIL is a calm escalation, a red chip with one glow pulse and no bounce or shake; RUNNING shows a
 * Spinner. Reduced motion: static.
 */
export function VerdictChip({ verdict, runKey = 0, size = 'md', className }: VerdictChipProps) {
  const { t } = useTranslation()
  const m = useMotionPolicy()
  const color = verdict === 'PASS' ? 'success' : verdict === 'FAIL' || verdict === 'ERROR' ? 'danger' : verdict === 'RUNNING' ? 'accent' : 'default'
  const label =
    verdict === 'RUNNING'
      ? t('evidence.verify.running')
      : verdict === 'ERROR'
        ? t('evidence.verify.error')
        : t(`common.verificationStatus.${verdict}`)
  const Icon = verdict === 'RUNNING' ? null : VERDICT_ICON[verdict]
  const settled = verdict === 'PASS' || verdict === 'FAIL'
  return (
    <span
      data-testid="evidence-verdict"
      data-verdict={verdict}
      className={cn('relative inline-flex rounded-full', className)}
    >
      {/* Persistent layer: a new settled verdict of a new run blooms once (the first value never does). */}
      <GlowLayer level={0} tone={verdict === 'FAIL' || verdict === 'ERROR' ? 'danger' : 'success'} pulseKey={settled ? `${verdict}-${runKey}` : undefined} />
      <motion.span
        key={`${verdict}-${runKey}`}
        className="relative inline-flex"
        initial={settled && !m.reduced ? (verdict === 'PASS' ? { scale: 0.8, opacity: 0 } : { opacity: 0 }) : false}
        animate={{ scale: 1, opacity: 1 }}
        transition={verdict === 'PASS' ? m.transitions.completion : m.transitions.crossFade}
      >
        <Chip color={color} variant="soft" size={size} className="font-semibold uppercase">
          {Icon ? <Icon className="size-3.5" aria-hidden="true" /> : <Spinner size="sm" color="current" aria-hidden="true" />}
          <Chip.Label>{label}</Chip.Label>
        </Chip>
      </motion.span>
    </span>
  )
}
