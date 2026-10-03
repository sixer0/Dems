import { Button, Card, Chip, Description, Label, Switch } from '@heroui/react'
import { AnimatePresence, motion } from 'motion/react'
import { Circle, Lock, ShieldCheck, TriangleAlert } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { OperatorRole, type SimOperator, type SubjectType } from '@dems/shared/sim'
import { toneChipProps } from '@dems/shared/tokens'
import { GlowRing } from '@/components/composed/glow-ring'
import { GlowLayer, tween, useMotionPolicy } from '@/motion'
import { cn } from '@/lib/utils'
import { SUBJECT_TONE } from './model'

export interface ReadySummary {
  sessionId: string | null
  caseNumber: string
  subjectName: string
  subjectType: SubjectType | null
  investigator: SimOperator | null
  room: string
}

export interface ReadyStepProps {
  summary: ReadySummary
  /** Warnings acknowledged at the gate (0 when every check passed). */
  warnings: number
  countdownOn: boolean
  onCountdownChange: (on: boolean) => void
  /** The current countdown digit (3, 2, 1) or null. */
  countdown: number | null
  onStart: () => void
  onCancelCountdown: () => void
  /** R4/M5: Start needs SESSION_START. */
  canStart: boolean
  /** Delay before the hero sweep (route enter), ms. */
  enterDelayMs: number
}

/**
 * Step 3, Ready (01_specs §14.5.11; research/04 §5.7): a summary `Card` (case, subject with its
 * chip, investigator, room, profile, devices), the mini GlowRing (the **hero moment**: it sweeps on
 * arrival), the "3-2-1 countdown" `Switch` (default on) and the large primary "Start Recording".
 * The countdown is a centred 3-2-1: each digit rack-focuses in and scales 1.1 → 1 over 600 ms, one
 * second apart (M-PG-NEW). Start is gated on SESSION_START (review 40 M5, rule R4).
 */
export function ReadyStep({ summary, warnings, countdownOn, onCountdownChange, countdown, onStart, onCancelCountdown, canStart, enterDelayMs }: ReadyStepProps) {
  const { t } = useTranslation()
  const m = useMotionPolicy()
  const subjectTone = summary.subjectType ? toneChipProps(SUBJECT_TONE[summary.subjectType]) : null
  const ringState = warnings > 0 ? 'ATTENTION' : 'READY'
  const rise = {
    initial: m.reduced ? { opacity: 0 } : { opacity: 0, y: 16 },
    animate: { opacity: 1, y: 0 },
    transition: { ...m.transitions.enter, delay: m.seconds(enterDelayMs) },
  }
  const counting = countdown !== null

  return (
    <div className="sn-ready-grid" data-testid="sn-step-ready">
      <motion.div {...rise} className="sn-ready-rise">
        <Card className="sn-card sn-ready-card">
          <div className="sn-ready-hero">
            <GlowRing
              state={ringState}
              mode="mini"
              size={148}
              label={warnings > 0 ? t('sessionNew.ready.ringAttention') : t('sessionNew.ready.ringLabel')}
              delayMs={enterDelayMs + 120}
            />
            <div className="sn-ready-heading">
              <h2 className="sn-ready-title">{t('sessionNew.ready.title')}</h2>
              <p className="sn-caption">{t('sessionNew.ready.startHint')}</p>
              {summary.sessionId ? (
                <span className="sn-session-id" data-testid="sn-session-id">
                  <span className="sn-muted">{t('sessionNew.ready.summary.sessionId')}</span>
                  <span className="sn-mono">{summary.sessionId}</span>
                </span>
              ) : null}
            </div>
          </div>

          <dl className="sn-kv sn-ready-kv" data-testid="sn-summary">
            <div>
              <dt>{t('sessionNew.ready.summary.caseNumber')}</dt>
              <dd className="sn-mono">{summary.caseNumber}</dd>
            </div>
            <div>
              <dt>{t('sessionNew.ready.summary.subject')}</dt>
              <dd className="sn-subject-line">
                <span className="sn-ellipsis">{summary.subjectName}</span>
                {summary.subjectType && subjectTone ? (
                  <Chip size="sm" variant="soft" color={subjectTone.color} className={cn('sn-subject-chip', subjectTone.className)} data-subject-type={summary.subjectType} title={t(`common.subjectTypeGloss.${summary.subjectType}`)}>
                    <Chip.Label>{t(`common.subjectType.${summary.subjectType}`)}</Chip.Label>
                  </Chip>
                ) : null}
              </dd>
            </div>
            <div>
              <dt>{t('sessionNew.ready.summary.investigator')}</dt>
              <dd>{summary.investigator?.displayName ?? '—'}</dd>
            </div>
            <div>
              <dt>{t('sessionNew.ready.summary.room')}</dt>
              <dd>{summary.room}</dd>
            </div>
            <div>
              <dt>{t('sessionNew.ready.summary.profile')}</dt>
              <dd>{t('sessionNew.info.profile.standard')}</dd>
            </div>
            <div>
              <dt>{t('sessionNew.ready.summary.devices')}</dt>
              <dd className={warnings > 0 ? 'sn-warn-text' : 'sn-ok-text'} data-testid="sn-summary-devices">
                {warnings > 0 ? <TriangleAlert className="size-4" aria-hidden="true" /> : <ShieldCheck className="size-4" aria-hidden="true" />}
                {warnings > 0 ? t('sessionNew.devices.outcome.acknowledged', { count: warnings }) : t('sessionNew.ready.summary.allReady')}
              </dd>
            </div>
          </dl>

          <div className="sn-ready-actions">
            <Switch isSelected={countdownOn} onChange={onCountdownChange} isDisabled={counting} data-testid="sn-countdown-switch">
              <Switch.Content>
                <Switch.Control>
                  <Switch.Thumb />
                </Switch.Control>
                <Label>{t('sessionNew.ready.countdown')}</Label>
              </Switch.Content>
              <Description>{t('sessionNew.ready.countdownHint')}</Description>
            </Switch>
            <div className="sn-start-wrap">
              <span className="sn-start-glow">
                <GlowLayer level={canStart && !counting ? 2 : 0} />
                <Button
                  variant="primary"
                  size="lg"
                  onPress={onStart}
                  isDisabled={!canStart || counting}
                  className="sn-start"
                  data-testid="sn-start"
                >
                  <Circle className="sn-rec-dot" aria-hidden="true" />
                  {counting ? t('sessionNew.ready.starting') : t('sessionNew.ready.start')}
                </Button>
              </span>
              {!canStart ? (
                <span className="sn-caption sn-rbac" data-testid="sn-start-denied">
                  <Lock className="size-3.5" aria-hidden="true" />
                  {t('common.rbac.requiresRole', { role: t(`common.roles.${OperatorRole.INVESTIGATOR}`) })}
                </span>
              ) : null}
            </div>
          </div>

          <AnimatePresence>
            {counting ? (
              <motion.div
                key="countdown"
                className="sn-countdown"
                data-testid="sn-countdown"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={tween('fast', 'standard', m.timeScale)}
              >
                <div className="sn-countdown-digit-wrap" role="status" aria-live="assertive">
                  <span className="sr-only">{t('sessionNew.ready.countdownValue', { seconds: countdown })}</span>
                  <AnimatePresence mode="popLayout" initial={false}>
                    <motion.span
                      key={countdown}
                      className="sn-countdown-digit"
                      aria-hidden="true"
                      initial={m.reduced ? { opacity: 0 } : { opacity: 0, scale: 1.1, filter: m.flags.blur ? 'blur(10px)' : 'blur(0px)' }}
                      animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
                      exit={{ opacity: 0 }}
                      transition={tween(600, 'luxe', m.timeScale)}
                    >
                      {countdown}
                    </motion.span>
                  </AnimatePresence>
                </div>
                <Button variant="ghost" size="sm" onPress={onCancelCountdown} data-testid="sn-countdown-cancel">
                  {t('sessionNew.ready.cancelCountdown')}
                </Button>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </Card>
      </motion.div>
    </div>
  )
}
