/**
 * Start New Session `/session/new` (step 46; masterplan/01_specs.md §14.5.11; research/04 §5.7;
 * ui_design/DEMS-Mobile.png MB 3 in the web design language; 03_motion_spec M-PG-NEW, M-C-09).
 *
 * Keeps the step-38 stub contract (implementation/19_app_shell.md §2): the route imports
 * `SessionNewPage`, and the root carries `data-testid="page-session-new"` (AC-48). The route
 * already sends roles without SESSION_START to the Dashboard.
 *
 * Flow (`?step=1|2|3`, deep-linkable and back-button friendly):
 * 1. **Session Info**: React Hook Form + the shared `sessionCreateSchema` (D62). "Next" stays
 *    disabled until the form is valid; pressing it shows "Creating session…", then
 *    `createSession` + `beginPrecheck` (a changed form on an existing setup session cancels it and
 *    creates a new one; the same form reuses it, S26).
 * 2. **Devices Check**: the §5.3 gate run by the simulator (8 checks, 300–700 ms each). PASS arms
 *    the session; WARN needs "Acknowledge warnings" (`acknowledgePrecheckWarnings` on Next); BLOCK
 *    disables Next and offers "Re-run checks" once the fault is cleared.
 * 3. **Ready**: summary, mini GlowRing, optional 3-2-1, "Start Recording" (`startRecording`, gated
 *    on SESSION_START, R4), then `/session`, where the Session Monitor (step 44) shows RECORDING.
 *
 * The URL never shows a step the session does not allow (`model.effectiveStep`); a live session
 * owned by the Session Monitor sends the operator there (R4 n5). Errors: every simulator call is
 * wrapped; the operator sees generic kit toasts (no `SimTransitionError` text, m8), the console
 * gets a structured record (`log.ts`), and a failing step renders a retryable fallback.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Button, Chip, Spinner, toast } from '@heroui/react'
import { getRouteApi, useNavigate } from '@tanstack/react-router'
import { zodResolver } from '@hookform/resolvers/zod'
import { motion } from 'motion/react'
import { ArrowLeft, ArrowRight, MonitorPlay } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { SessionState } from '@dems/shared/domain'
import {
  DEFAULT_SESSION_ROOM,
  sessionCreateSchema,
  type SessionCreateFormValues,
  type SessionCreateRequest,
} from '@dems/shared/api'
import {
  Permission,
  RecordingProfileId,
  roleHas,
  selectCan,
  selectOperator,
  selectSessionState,
  useSim,
  useSimActions,
  useSimInstance,
  type SimState,
} from '@dems/shared/sim'
import { Stepper, type StepperStatus, type StepperStep } from '@/components/composed/stepper'
import { PageHeader, useRouteEnterDelay } from '@/components/shell'
import { TransitionPanel } from '@/components/ui/transition-panel'
import { GlowLayer, useMotionPolicy } from '@/motion'
import { CancelDialog } from './cancel-dialog'
import { DevicesStep } from './devices-step'
import { FlowErrorBoundary } from './error-boundary'
import { InfoStep } from './info-step'
import { logSessionNew, newFlowCorrelationId } from './log'
import {
  COUNTDOWN_FROM,
  COUNTDOWN_STEP_MS,
  CREATE_BEAT_MS,
  effectiveStep,
  gateView,
  isLiveElsewhere,
  isSetupState,
  maxStepFor,
  type FlowStep,
} from './model'
import { ReadyStep, type ReadySummary } from './ready-step'
import { scanCaseNumber } from './sim-adapter'
import './session-new.css'

const route = getRouteApi('/_app/session/new')

const selectSessionId = (s: SimState) => s.session?.id ?? null
const selectPrecheck = (s: SimState) => s.session?.precheck ?? null
const selectCanStart = (s: SimState) => selectCan(s, Permission.SESSION_START)
const selectOperators = (s: SimState) => s.operators

/** Form values for a fresh page: the setup session's input (resume), or defaults (04 §5.7). */
function initialValues(state: SimState): SessionCreateFormValues {
  const session = state.session
  if (session && isSetupState(session.state)) {
    const input = session.input
    return {
      caseNumber: input.caseNumber,
      subjectType: input.subjectType,
      subjectName: input.subjectName,
      investigatorId: input.investigatorId,
      room: input.room,
      profileId: input.profileId,
      notes: input.notes ?? '',
    }
  }
  const operator = selectOperator(state)
  return {
    caseNumber: '',
    // No subject type until the operator picks one ("Choose a subject type").
    subjectType: undefined as unknown as SessionCreateFormValues['subjectType'],
    subjectName: '',
    investigatorId: operator && roleHas(operator.role, Permission.SESSION_START) ? operator.id : '',
    room: DEFAULT_SESSION_ROOM,
    profileId: RecordingProfileId.STANDARD_1080P25,
    notes: '',
  }
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export function SessionNewPage() {
  const { t } = useTranslation()
  const m = useMotionPolicy()
  const sim = useSimInstance()
  const actions = useSimActions()
  const navigate = useNavigate()
  const search = route.useSearch()
  const enterDelayMs = useRouteEnterDelay()

  const sessionState = useSim(selectSessionState)
  const sessionId = useSim(selectSessionId)
  const precheck = useSim(selectPrecheck)
  const canStart = useSim(selectCanStart)
  const operators = useSim(selectOperators)

  const [defaults] = useState(() => initialValues(sim.store.getState()))
  const form = useForm<SessionCreateFormValues, unknown, SessionCreateRequest>({
    resolver: zodResolver(sessionCreateSchema),
    mode: 'onTouched',
    defaultValues: defaults,
  })
  const { isValid, isDirty, isSubmitted } = form.formState

  const step = effectiveStep(search.step, sessionState)
  const [view, setView] = useState<{ step: FlowStep; direction: 1 | -1 }>({ step, direction: 1 })
  if (view.step !== step) setView({ step, direction: step > view.step ? 1 : -1 })

  const [creating, setCreating] = useState(false)
  const [cancelOpen, setCancelOpen] = useState(false)
  const [countdownOn, setCountdownOn] = useState(true)
  const [countdown, setCountdown] = useState<number | null>(null)
  // The acknowledgement belongs to one gate run: a re-run clears it.
  const [ack, setAck] = useState<{ runAt: number | null; value: boolean }>({ runAt: null, value: false })
  const acknowledged = ack.runAt === (precheck?.startedAt ?? null) ? ack.value : false
  const gate = gateView(precheck, sessionState, acknowledged)

  const correlation = useRef(newFlowCorrelationId())
  const startedHere = useRef(false)
  const leaving = useRef(false)

  const goTo = useCallback(
    (next: FlowStep, replace = false) => {
      void navigate({ to: '/session/new', search: { step: next }, replace })
    },
    [navigate],
  )

  // ── URL and session guards ─────────────────────────────────────────────────────────────
  const resumed = useRef(false)
  useEffect(() => {
    if (leaving.current) return
    if (isLiveElsewhere(sessionState)) {
      // R4 n5: a recording (or finalizing, faulted) session belongs to the Session Monitor.
      if (startedHere.current) return
      leaving.current = true
      toast.info(t('sessionNew.alreadyActive'))
      void navigate({ to: '/session', replace: true })
      return
    }
    if (!resumed.current) {
      resumed.current = true
      // "Continue setup": a fresh page on a setup session resumes at the furthest allowed step.
      if (isSetupState(sessionState) && search.step === 1) {
        goTo(maxStepFor(sessionState), true)
        return
      }
    }
    if (search.step !== step) goTo(step, true)
  }, [sessionState, search.step, step, goTo, navigate, t])

  // A session left in CREATE (a reload between create and precheck) starts its gate on step 2.
  useEffect(() => {
    if (step !== 2 || sessionState !== SessionState.CREATE) return
    try {
      actions.beginPrecheck()
    } catch (error) {
      logSessionNew('error', 'beginPrecheck.resume', error, { sessionId, correlationId: correlation.current })
      toast.danger(t('sessionNew.errors.precheck'))
    }
  }, [step, sessionState, actions, sessionId, t])

  // ── Step 1 → 2 ──────────────────────────────────────────────────────────────────────────
  const createAndCheck = async (values: SessionCreateRequest) => {
    if (creating) return
    setCreating(true)
    try {
      await wait(CREATE_BEAT_MS)
      const before = sim.store.getState().session
      let result = actions.createSession(values)
      if (!result.ok && result.reason === 'SESSION_ACTIVE' && before && isSetupState(before.state)) {
        // A changed form on an existing setup session: discard it and create the new one.
        actions.cancel()
        result = actions.createSession(values)
      }
      if (!result.ok) {
        logSessionNew('warn', 'createSession', result.reason, { reason: result.reason, correlationId: correlation.current })
        toast.danger(t(`sessionNew.errors.create.${result.reason}`))
        return
      }
      if (sim.store.getState().session?.state === SessionState.CREATE) actions.beginPrecheck()
      goTo(2)
    } catch (error) {
      logSessionNew('error', 'submitInfo', error, { sessionId: sim.store.getState().session?.id ?? null, correlationId: correlation.current })
      toast.danger(t('sessionNew.errors.precheck'))
    } finally {
      setCreating(false)
    }
  }
  const submitInfo = () => form.handleSubmit(createAndCheck)()

  const scan = () => {
    form.setValue('caseNumber', scanCaseNumber(sim), { shouldValidate: true, shouldDirty: true, shouldTouch: true })
  }

  // ── Step 2 → 3 ──────────────────────────────────────────────────────────────────────────
  const proceedFromDevices = () => {
    if (!gate.canProceed) return
    if (sessionState === SessionState.PRECHECK && gate.phase === 'warn') {
      try {
        actions.acknowledgePrecheckWarnings()
      } catch (error) {
        logSessionNew('error', 'acknowledgePrecheckWarnings', error, { sessionId, correlationId: correlation.current })
        toast.danger(t('sessionNew.errors.acknowledge'))
        return
      }
    }
    goTo(3)
  }

  const retryChecks = () => {
    try {
      actions.retryPrecheck()
      setAck({ runAt: null, value: false })
    } catch (error) {
      logSessionNew('error', 'retryPrecheck', error, { sessionId, correlationId: correlation.current })
      toast.danger(t('sessionNew.errors.precheck'))
    }
  }

  // ── Step 3: Start ───────────────────────────────────────────────────────────────────────
  const startNow = useCallback(() => {
    const id = sim.store.getState().session?.id ?? null
    try {
      startedHere.current = true
      actions.startRecording()
      toast.success(t('sessionNew.ready.startedToast', { sessionId: id ?? '' }))
      void navigate({ to: '/session' })
    } catch (error) {
      startedHere.current = false
      logSessionNew('error', 'startRecording', error, { sessionId: id, correlationId: correlation.current })
      toast.danger(t('sessionNew.errors.start'))
    }
  }, [actions, navigate, sim, t])

  const start = () => {
    if (!canStart || countdown !== null) return
    if (countdownOn) setCountdown(COUNTDOWN_FROM)
    else startNow()
  }

  useEffect(() => {
    if (countdown === null) return undefined
    const timer = setTimeout(() => {
      if (countdown > 1) setCountdown(countdown - 1)
      else {
        setCountdown(null)
        startNow()
      }
    }, COUNTDOWN_STEP_MS)
    return () => clearTimeout(timer)
  }, [countdown, startNow])

  // ── Cancel ──────────────────────────────────────────────────────────────────────────────
  const requestCancel = () => {
    if (isDirty || isSetupState(sessionState)) setCancelOpen(true)
    else void navigate({ to: '/dashboard' })
  }

  const confirmCancel = () => {
    const current = sim.store.getState().session
    if (current && isSetupState(current.state)) {
      try {
        actions.cancel()
      } catch (error) {
        logSessionNew('error', 'cancel', error, { sessionId: current.id, correlationId: correlation.current })
        toast.danger(t('sessionNew.errors.cancel'))
        return
      }
    }
    leaving.current = true
    setCountdown(null)
    setCancelOpen(false)
    toast.info(t('sessionNew.discarded'))
    void navigate({ to: '/dashboard' })
  }

  // ── View model ──────────────────────────────────────────────────────────────────────────
  let devicesStatus: StepperStatus = 'pending'
  if (step === 3) devicesStatus = 'done'
  else if (gate.phase === 'block') devicesStatus = 'error'
  else if (gate.phase === 'warn' && gate.needsAck) devicesStatus = 'warn'
  else if (step === 2) devicesStatus = 'active'
  else if (sessionState === SessionState.ARMED) devicesStatus = 'done'
  const steps: StepperStep[] = [
    { id: 'info', label: t('sessionNew.steps.info'), status: step === 1 ? 'active' : 'done' },
    { id: 'devices', label: t('sessionNew.steps.devices'), status: devicesStatus },
    { id: 'ready', label: t('sessionNew.steps.ready'), status: step === 3 ? 'active' : 'pending' },
  ]

  const values = form.getValues()
  const summary: ReadySummary = useMemo(
    () => ({
      sessionId,
      caseNumber: values.caseNumber,
      subjectName: values.subjectName,
      subjectType: values.subjectType ?? null,
      investigator: operators.find((operator) => operator.id === values.investigatorId) ?? null,
      room: values.room,
    }),
    [sessionId, values.caseNumber, values.subjectName, values.subjectType, values.investigatorId, values.room, operators],
  )

  const nextEnabled = step === 1 ? isValid && !creating : step === 2 ? gate.canProceed : false
  const counting = countdown !== null

  const panels = [
    <FlowErrorBoundary key="info" part="info">
      <InfoStep control={form.control} submitted={isSubmitted} onSubmit={() => void submitInfo()} onScan={scan} enterDelayMs={enterDelayMs} />
    </FlowErrorBoundary>,
    <FlowErrorBoundary key="devices" part="devices">
      <DevicesStep
        gate={gate}
        acknowledged={acknowledged}
        onAcknowledgedChange={(value) => setAck({ runAt: precheck?.startedAt ?? null, value })}
        onRetry={retryChecks}
      />
    </FlowErrorBoundary>,
    <FlowErrorBoundary key="ready" part="ready">
      <ReadyStep
        summary={summary}
        warnings={gate.warnings}
        countdownOn={countdownOn}
        onCountdownChange={setCountdownOn}
        countdown={countdown}
        onStart={start}
        onCancelCountdown={() => setCountdown(null)}
        canStart={canStart}
        enterDelayMs={0}
      />
    </FlowErrorBoundary>,
  ]

  return (
    <div className="dems-page sn-page" data-testid="page-session-new" data-step={step} data-session-state={sessionState ?? 'IDLE'} data-motion={m.policy}>
      <PageHeader
        icon={MonitorPlay}
        title={t('sessionNew.title')}
        subtitle={t('sessionNew.subtitle')}
        status={
          <div className="sn-header-status">
            {sessionId ? (
              <Chip size="sm" variant="secondary" data-testid="sn-header-session">
                <Chip.Label>
                  <span className="sn-mono">{sessionId}</span>
                </Chip.Label>
              </Chip>
            ) : null}
            <Chip size="sm" variant="soft" color="accent" data-testid="sn-step-position">
              <Chip.Label>{t('sessionNew.steps.position', { current: step, total: 3 })}</Chip.Label>
            </Chip>
          </div>
        }
      />

      <motion.section
        className="sn-shell"
        aria-label={t('sessionNew.steps.label')}
        initial={m.reduced ? { opacity: 0 } : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ...m.transitions.enter, delay: m.seconds(enterDelayMs) }}
      >
        <div className="sn-stepper-wrap">
          <Stepper steps={steps} orientation="horizontal" variant="wizard" ariaLabel={t('sessionNew.steps.label')} className="sn-stepper" />
        </div>

        <TransitionPanel activeIndex={step - 1} custom={view.direction} className="sn-panel">
          {panels}
        </TransitionPanel>

        <footer className="sn-footer">
          <Button variant="ghost" onPress={requestCancel} isDisabled={creating} data-testid="sn-cancel">
            {t('common.actions.cancel')}
          </Button>
          <div className="sn-footer-right">
            {step > 1 ? (
              <Button variant="outline" onPress={() => goTo((step - 1) as FlowStep)} isDisabled={creating || counting} data-testid="sn-back">
                <ArrowLeft className="size-4" aria-hidden="true" />
                {t('common.actions.back')}
              </Button>
            ) : null}
            {step < 3 ? (
              <span className="sn-next-wrap">
                <GlowLayer level={nextEnabled ? 2 : 0} />
                <Button
                  variant="primary"
                  onPress={step === 1 ? () => void submitInfo() : proceedFromDevices}
                  isDisabled={!nextEnabled}
                  isPending={creating}
                  className="sn-next"
                  data-testid="sn-next"
                >
                  {creating ? <Spinner size="sm" color="current" aria-hidden="true" /> : null}
                  {creating ? t('sessionNew.creating') : t('common.actions.next')}
                  {creating ? null : <ArrowRight className="size-4" aria-hidden="true" />}
                </Button>
              </span>
            ) : null}
          </div>
        </footer>
      </motion.section>

      <CancelDialog isOpen={cancelOpen} onOpenChange={setCancelOpen} onConfirm={confirmCancel} />
    </div>
  )
}
