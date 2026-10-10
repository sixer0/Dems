import { useEffect, useState, type CSSProperties } from 'react'
import { Button, buttonVariants, Chip, Modal, ProgressBar, Spinner } from '@heroui/react'
import { Link } from '@tanstack/react-router'
import { AnimatePresence, motion } from 'motion/react'
import { FileLock2, LifeBuoy } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { BootRecoveryState, SessionState } from '@dems/shared/domain'
import { CoreMode, useCoreMode } from '@dems/shared/live'
import { captureFactsOf, useSim } from '@dems/shared/sim'
import { Stepper, StepperStamp, type StepperStep } from '@/components/composed'
import { GlowLayer, useMotionPolicy } from '@/motion'
import { logSessionMonitorError } from './log'
import { shortHash } from './model'
import { useSealAttention } from '@/lib/seal-attention'
import { SealAttentionNotice } from './seal-attention'
import { etaSeconds, useSealingProgress } from './sealing-progress'
import { InterruptedSealNotice } from './interrupted-seal'
import { realSealFactsOf, type RealSealFacts } from './real-seal-facts'
import { useInterruptedSeal } from './use-interrupted-seal'
import { UnsealableNotice } from './unsealable-notice'

export type OverlayMode = 'finalization' | 'recovery'

export interface FinalizationModalProps {
  mode: OverlayMode
  isOpen: boolean
  /** The session whose finalization or recovery this overlay follows. */
  sessionId: string
  onClose: () => void
}

interface PackageInfo {
  manifestSha256: string
  keyId: string
}

type PackageState = { status: 'idle' } | { status: 'loading' } | { status: 'missing' } | { status: 'ready'; info: PackageInfo }

/** The sealed item as the simulator knows it (the M4 join guard and the "simulated" fallback). */
interface SealedItem {
  evidenceId: string
  caseNumber: string
  subjectName: string
  sessionId: string
  simulatedManifestHash: string | null
}

/**
 * The finalization overlay (01_specs §14.5.2 "Finalization overlay"; 03_motion_spec M-C-09,
 * M-PG-SM "End Session"): a non-dismissible kit Modal that follows the simulator from STOPPING
 * (1.5 s) through the six FinalizationSteps (0.6–1.2 s each) to SEALED (≤ 8.7 s after the stop,
 * implementation/13_sim_engine.md §2.2). The Stepper `pipeline` resolves each step (Spinner → check
 * draw, connector fill), a transform-only progress bar tracks it, and at SEALED the violet stamp
 * lands on the `bouncy` spring with one e3 glow flash and a hairline ring: the page's completion
 * moment (P4). The sealed item then shows its DEMO evidence package digest (step 93, loaded on
 * demand; D67(c): integrity views show package data) and the CTA "View in Evidence".
 *
 * `recovery` mode follows FAULT → RECOVERY (RECOVERY_SCAN → INCOMPLETE_SESSION_ANALYSIS, 3 s) and
 * ends with the INCOMPLETE notice (SYS-008): the session is never sealed.
 *
 * Blueprint row 87 (WB-01 modal; UX spec flows 3 and 4; E-13):
 * - **Forward-only progress.** The bar, the percent, each step's status and the ETA come from
 *   `useSealingProgress` (`sealing-progress.ts`): a pure function of the finalization states the
 *   Core sent. No timer of this page moves them; a step drawn DONE stays DONE and the percent never
 *   falls, also when a resumed attempt rewrites a step on the Core. Without an ETA from the Core NO
 *   time-left line is drawn (fix wave K, G75c-05: `etaMs: null` is the Core saying it has no measured basis).
 * - **Resumed sealing, in place (OD-08).** When a RECOVERY turns into a resumed seal (the session
 *   is FINALIZING or SEALED while this overlay is in `recovery` mode, or the page switches the mode
 *   back to `finalization`), the SAME dialog draws the finalization body: one Modal, no close and
 *   reopen, so nothing flickers. A recovery that ends SEALED can be closed (before, only an
 *   INCOMPLETE end could: the dialog would have stayed locked).
 *
 * Fix wave I, driver B (finding G75b-02; contract note `contract_wave_i.md`):
 * - **A seal that is blocked or retried** (`useSealAttention`, the shared `sealAttentionOf`): the
 *   dialog states it (`SealAttentionNotice`), draws NO percentage, ETA or "Resumed" note, names the
 *   state in its heading and CAN BE LEFT (Close, Escape, a click outside). Closing it changes
 *   nothing on the Core: the session stays open there, and the notice says so.
 * - **"Resumed after restart" is no reading of `attempt`.** The attempt of a step grows with every
 *   run of the seal, the Core's own retries included (at re-gate 75 the note appeared with no
 *   restart). The truthful fact is `resumed` of operation 83, which this dialog does not poll. So
 *   the note is shown only where the attempt can grow by a recovery alone: beside a session of the
 *   SIMULATOR's capture (no capture member), or when this dialog itself followed the session
 *   through RECOVERY (`mode: 'recovery'`). Beside a session of the Core's own capture it is not.
 */
export function FinalizationModal({ mode, isOpen, sessionId, onClose }: FinalizationModalProps) {
  const { t } = useTranslation()
  const state = useSim((s) => (s.session?.id === sessionId ? s.session.state : null))
  // Row 87 (flow 4): a recovery that resumed the seal shows the finalization body in this same dialog.
  const resumedSeal = mode === 'recovery' && (state === SessionState.FINALIZING || state === SessionState.SEALED)
  const body: OverlayMode = mode === 'finalization' || resumedSeal ? 'finalization' : 'recovery'
  const sealed = body === 'finalization' && state === SessionState.SEALED
  const recoveryDone = body === 'recovery' && state === null
  // G75b-02: a blocked or retried seal never locks the operator into this dialog.
  const attention = useSealAttention(body === 'finalization' && !sealed ? sessionId : null)
  const closable = sealed || recoveryDone || (body === 'finalization' && state === null) || attention !== null

  return (
    <Modal.Backdrop
      isOpen={isOpen}
      onOpenChange={(open) => {
        if (!open && closable) onClose()
      }}
      isDismissable={closable}
      isKeyboardDismissDisabled={!closable}
      variant="blur"
    >
      <Modal.Container size="md" placement="center">
        <Modal.Dialog
          aria-label={body === 'finalization' ? t('session.finalization.title') : t('session.recovery.title')}
          className="sm-final-dialog"
          data-testid="finalization-modal"
          data-mode={mode}
          data-body={body}
          data-state={state ?? 'NONE'}
          data-seal={attention?.kind}
        >
          {body === 'finalization' ? (
            <FinalizationBody sessionId={sessionId} state={state} onClose={onClose} sawRecovery={mode === 'recovery'} />
          ) : (
            <RecoveryBody sessionId={sessionId} state={state} onClose={onClose} />
          )}
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  )
}

function FinalizationBody({ sessionId, state, onClose, sawRecovery }: { sessionId: string; state: SessionState | null; onClose: () => void; sawRecovery: boolean }) {
  const { t } = useTranslation()
  const m = useMotionPolicy()
  const steps = useSim((s) => (s.session?.id === sessionId ? s.session.finalization.steps : null))
  const evidenceId = useSim((s) => (s.session?.id === sessionId ? s.session.evidenceId : null))
  const stoppedAt = useSim((s) => (s.session?.id === sessionId ? s.session.stoppedAt : null))
  const sealedAt = useSim((s) => (s.session?.id === sessionId ? s.session.sealedAt : null))
  const sealed = state === SessionState.SEALED
  const stopping = state === SessionState.STOPPING
  // Wave H driver B (G75-03, ruling D197): an interrupted seal is named in the heading, the stamp and the sealed line.
  const interrupted = useInterruptedSeal(sessionId)
  // Fix wave I (G75b-02): the seal is blocked or retried - stated, with no invented progress.
  const attention = useSealAttention(sealed ? null : sessionId)
  // "Resumed after restart" is said only where `attempt` can grow by a recovery alone (see the header).
  const ownCapture = useSim((s) => (s.session?.id === sessionId ? captureFactsOf(s.session) !== null : false))

  // Row 87 (E-13): forward-only, from the Core's states alone (no timer here).
  const progress = useSealingProgress(sessionId, steps, sealed)
  const stepperSteps: StepperStep[] = (steps ?? []).map((step, index) => {
    const drawn = progress.steps[index]
    const status = drawn?.status ?? step.status
    return {
      id: step.id,
      label: t(`common.enums.finalizationStep.${step.id}`),
      status,
      description:
        status === 'done' && step.status === 'done' && step.durationMs !== null
          ? t('session.finalization.stepDuration', { seconds: (step.durationMs / 1000).toFixed(1) })
          : status === 'active' && typeof step.progress === 'number' && drawn !== undefined
            ? t('session.finalization.stepProgress', { percent: drawn.percent })
            : undefined,
    }
  })
  const percent = progress.percent
  const finalizing = state === SessionState.FINALIZING
  const caseNumber = useSim((s) => (s.session?.id === sessionId ? s.session.input.caseNumber : null))
  const subjectName = useSim((s) => (s.session?.id === sessionId ? s.session.input.subjectName : null))
  const simulatedManifestHash = useSim((s) =>
    evidenceId ? (s.evidence.find((item) => item.id === evidenceId)?.manifestHash ?? null) : null,
  )
  const item: SealedItem | null =
    sealed && evidenceId && caseNumber !== null && subjectName !== null
      ? { evidenceId, caseNumber, subjectName, sessionId, simulatedManifestHash }
      : null
  const pkg = useDemoPackage(item)
  // Fix wave K (G89b-05): the sealed item as THIS Core signed it - a real item says its key and its sources, never a word about DEMO packages.
  const sealedItem = useSim((s) => (sealed && evidenceId ? (s.evidence.find((entry) => entry.id === evidenceId) ?? null) : null))
  const realSeal = realSealFactsOf(sealedItem)

  return (
    <>
      <Modal.Header className="sm-final-header">
        <span className="sm-final-icon" data-sealed={sealed ? 'true' : undefined} aria-hidden="true">
          <FileLock2 className="size-5" />
        </span>
        <span className="flex min-w-0 flex-col">
          <Modal.Heading className="sm-final-title">
            {sealed
              ? (interrupted?.title ?? t('session.finalization.sealedTitle'))
              : attention?.kind === 'BLOCKED'
                ? t('web.sealBlocked.title')
                : attention?.kind === 'RETRYING'
                  ? t('web.sealBlocked.retryTitle')
                  : t('session.finalization.title')}
          </Modal.Heading>
          <span className="sm-final-subtitle font-mono">{t('session.finalization.subtitle', { sessionId })}</span>
        </span>
      </Modal.Header>
      <Modal.Body className="sm-final-body">
        <UnsealableNotice sessionId={sessionId} />
        <InterruptedSealNotice sessionId={sessionId} sealed={sealed} />
        {attention !== null ? (
          <SealAttentionNotice attention={attention} />
        ) : (
          <>
          <ProgressBar
            aria-label={t('session.finalization.progress', { percent })}
            value={percent}
            color={sealed ? 'success' : 'accent'}
            size="sm"
            className="sm-final-progress"
            style={{ '--sm-progress': String(percent / 100) } as CSSProperties}
            data-testid="sm-final-progress"
          >
            <span className="sm-final-progress-label">{t('session.finalization.progress', { percent })}</span>
            <ProgressBar.Track>
              <ProgressBar.Fill />
            </ProgressBar.Track>
          </ProgressBar>

          {/* Fix wave K (G75c-05; `contract_wave_k.md` S1 section 5): the time-left line exists ONLY when the Core states one
              (`etaMs` of the running step, measured). `null` - always so for the transcript step - draws no line at all:
              no "estimating", no number made here. */}
          {finalizing && progress.etaMs !== null && progress.etaMs > 0 ? (
            <p className="sm-final-package-note" role="status" data-testid="sm-final-eta" data-eta="core">
              {t('session.sealingEta.step', { seconds: etaSeconds(progress.etaMs) })}
            </p>
          ) : null}
          {progress.resumed && !sealed && (!ownCapture || sawRecovery) ? (
            <p className="sm-final-package-note" role="status" data-testid="sm-final-resumed" data-attempt={progress.attempt}>
              {t('session.finalization.resumed')}
            </p>
          ) : null}
          </>
        )}

        <AnimatePresence initial={false}>
          {stopping ? (
            <motion.p
              key="stopping"
              className="sm-final-stopping"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={m.transitions.crossFade}
            >
              <Spinner size="sm" color="current" aria-hidden="true" />
              {t('session.finalization.stopping')}
            </motion.p>
          ) : null}
        </AnimatePresence>

        <Stepper
          ariaLabel={t('session.finalization.title')}
          orientation="vertical"
          variant="pipeline"
          steps={stepperSteps}
          className="sm-final-stepper"
        />

        <AnimatePresence>
          {sealed ? (
            <motion.div
              key="sealed"
              className="sm-final-sealed"
              data-testid="sm-final-sealed"
              variants={m.variants.fade}
              initial="hidden"
              animate="visible"
            >
              <span className="sm-final-stamp-wrap">
                <GlowLayer level={0} tone="sealed" pulseKey={evidenceId ?? 'sealed'} />
                <StepperStamp show label={interrupted !== null ? t('common.interruptedSeal.short') : t('session.finalization.sealed')} className="sm-final-stamp" />
              </span>
              <div className="sm-final-sealed-text">
                <p className="sm-final-sealed-title" data-interrupted={interrupted !== null ? 'true' : undefined}>
                  {interrupted !== null ? `${evidenceId ?? '—'} · ${interrupted.title}` : t('session.finalization.sealedBody', { evidenceId: evidenceId ?? '—' })}
                </p>
                {stoppedAt !== null && sealedAt !== null ? (
                  <p className="sm-final-sealed-meta" data-testid="sm-sealed-in">
                    {t('session.finalization.sealedIn', { seconds: ((sealedAt - stoppedAt) / 1000).toFixed(1) })}
                  </p>
                ) : null}
              </div>
              <PackageBlock pkg={pkg} simulatedManifestHash={simulatedManifestHash} real={realSeal} />
            </motion.div>
          ) : null}
        </AnimatePresence>
      </Modal.Body>
      <Modal.Footer className="sm-final-footer">
        {sealed || state === null || attention !== null ? (
          <Button variant="ghost" onPress={onClose} data-testid="sm-final-close">
            {t('session.finalization.close')}
          </Button>
        ) : null}
        {sealed && evidenceId ? (
          <Link
            to="/evidence/$evidenceId"
            params={{ evidenceId }}
            className={buttonVariants({ variant: 'primary' })}
            data-testid="sm-final-view-evidence"
          >
            {t('session.finalization.viewEvidence')}
          </Link>
        ) : null}
      </Modal.Footer>
    </>
  )
}

function PackageBlock({ pkg, simulatedManifestHash, real }: { pkg: PackageState; simulatedManifestHash: string | null; real: RealSealFacts | null }) {
  const { t } = useTranslation()
  // [CS] §3.2: "a screen that shows simulator data says 'simulated'; a screen that says 'live' shows
  // server data". In Live mode the digest is the Core server's (the replica), so it is labelled LIVE
  // (plan row W65; found by the row's lane check).
  const live = useCoreMode() === CoreMode.LIVE
  if (real !== null) {
    // G89b-05: a real item - the manifest digest, the key it is signed with and its mark, the development sources where so. No DEMO vocabulary.
    return (
      <dl className="sm-final-package" data-testid="sm-final-package" data-source="core" data-kind="real">
        <div className="sm-final-package-head">
          <span>{t('session.finalization.manifestDigest')}</span>
        </div>
        {real.manifestHash ? (
          <div>
            <dt className="sr-only">{t('session.finalization.manifestDigest')}</dt>
            <dd className="font-mono" title={real.manifestHash}>
              {shortHash(real.manifestHash, 24)}…
            </dd>
          </div>
        ) : null}
        <div>
          <dt>{t('session.finalization.signature')}</dt>
          <dd className="font-mono" data-testid="sm-final-real-key">
            {t('evidence.itemFacts.signature.realShort', { algorithm: real.algorithm, key: real.keyId })}
          </dd>
        </div>
        {real.developmentKey ? (
          <p className="sm-final-package-note" data-testid="sm-final-development-key">
            {t('evidence.itemFacts.signature.developmentKey')}
          </p>
        ) : null}
        {real.developmentSources ? (
          <p className="sm-final-package-note" data-testid="sm-final-development-sources">
            {t('web.sealDialog.developmentSources')}
          </p>
        ) : null}
      </dl>
    )
  }
  if (pkg.status === 'idle') return null
  if (pkg.status === 'loading') return <p className="sm-final-package-note">{t('session.finalization.loadingPackage')}</p>
  if (pkg.status === 'missing') {
    // No guarded DEMO package joins (review 40 M4/R3): the simulator's hash, labelled simulated.
    return (
      <dl className="sm-final-package" data-testid="sm-final-package" data-source={live ? 'core' : 'simulated'}>
        <div className="sm-final-package-head">
          <span>{t('session.finalization.manifestDigest')}</span>
          <Chip size="sm" variant="soft" color="default">
            <Chip.Label>{live ? t('common.coreMode.chip.LIVE') : t('common.simulated.chip')}</Chip.Label>
          </Chip>
        </div>
        {simulatedManifestHash ? (
          <div>
            <dt className="sr-only">{t('session.finalization.manifestDigest')}</dt>
            <dd className="font-mono" title={simulatedManifestHash}>
              {shortHash(simulatedManifestHash, 24)}…
            </dd>
          </div>
        ) : null}
        <p className="sm-final-package-note">{t('session.finalization.noPackage')}</p>
      </dl>
    )
  }
  return (
    <dl className="sm-final-package" data-testid="sm-final-package" data-source="package">
      <div className="sm-final-package-head">
        <span>{t('session.finalization.packageTitle')}</span>
        <Chip size="sm" variant="soft" color="warning">
          <Chip.Label>DEMO</Chip.Label>
        </Chip>
      </div>
      <div>
        <dt>{t('session.finalization.manifestDigest')}</dt>
        <dd className="font-mono" title={pkg.info.manifestSha256}>
          {shortHash(pkg.info.manifestSha256, 24)}…
        </dd>
      </div>
      <div>
        <dt>{t('session.finalization.signature')}</dt>
        <dd className="font-mono">{t('session.finalization.signatureValue', { keyId: pkg.info.keyId })}</dd>
      </div>
      <p className="sm-final-package-note">{t('session.finalization.demoNote')}</p>
    </dl>
  )
}

/**
 * The step-93 DEMO package of a sealed item, loaded on demand so the 270 KB index never weighs on
 * the page chunk (review 40 m12). Joined with the shared `matchDemoPackage` (D84): evidence suffix,
 * session suffix, case sequence and subject (review 40 M4/R2): a session the presenter creates live
 * also seals as EV-…-0014 but is another interview.
 */
function useDemoPackage(item: SealedItem | null): PackageState {
  const evidenceId = item?.evidenceId ?? null
  const caseNumber = item?.caseNumber ?? null
  const subjectName = item?.subjectName ?? null
  const sessionId = item?.sessionId ?? null
  const [state, setState] = useState<{ id: string | null; value: PackageState }>({ id: null, value: { status: 'idle' } })
  useEffect(() => {
    if (!evidenceId) return undefined
    let active = true
    import('@dems/shared/demo-data')
      .then((module) => {
        if (!active) return
        // D84 (step 54): the shared join (case sequence + subject + session suffix), any demo day.
        const pkg = module.matchDemoPackage({ id: evidenceId, caseNumber: caseNumber ?? '', subjectName: subjectName ?? '' }, sessionId)
        setState({
          id: evidenceId,
          value: pkg ? { status: 'ready', info: { manifestSha256: pkg.files.manifest.sha256, keyId: pkg.signature.keyId } } : { status: 'missing' },
        })
      })
      .catch((error: unknown) => {
        logSessionMonitorError('FinalizationModal.loadPackage', error, { evidenceId })
        if (active) setState({ id: evidenceId, value: { status: 'missing' } })
      })
    return () => {
      active = false
    }
  }, [evidenceId, caseNumber, subjectName, sessionId])
  if (!evidenceId) return { status: 'idle' }
  return state.id === evidenceId ? state.value : { status: 'loading' }
}

function RecoveryBody({ sessionId, state, onClose }: { sessionId: string; state: SessionState | null; onClose: () => void }) {
  const { t } = useTranslation()
  const stage = useSim((s) => s.session?.recovery?.stage ?? null)
  const done = state === null
  const statusOf = (id: BootRecoveryState): StepperStep['status'] => {
    if (done) return 'done'
    if (stage === id) return 'active'
    if (stage === BootRecoveryState.INCOMPLETE_SESSION_ANALYSIS && id === BootRecoveryState.RECOVERY_SCAN) return 'done'
    return 'pending'
  }
  const steps: StepperStep[] = [BootRecoveryState.RECOVERY_SCAN, BootRecoveryState.INCOMPLETE_SESSION_ANALYSIS].map((id) => ({
    id,
    label: t(`common.enums.bootRecoveryState.${id}`),
    status: statusOf(id),
  }))
  return (
    <>
      <Modal.Header className="sm-final-header">
        <span className="sm-final-icon sm-final-icon-warning" aria-hidden="true">
          <LifeBuoy className="size-5" />
        </span>
        <Modal.Heading className="sm-final-title">{t('session.recovery.title')}</Modal.Heading>
      </Modal.Header>
      <Modal.Body className="sm-final-body">
        <Stepper ariaLabel={t('session.recovery.stagesLabel')} orientation="vertical" variant="pipeline" steps={steps} />
        <UnsealableNotice sessionId={sessionId} />
        {done ? (
          <p className="sm-final-incomplete" role="status" data-testid="sm-recovery-done">
            <Chip size="sm" variant="soft" color="warning">
              <Chip.Label>{t('common.sessionOutcome.INCOMPLETE')}</Chip.Label>
            </Chip>
            {t('session.recovery.incomplete')}
          </p>
        ) : null}
      </Modal.Body>
      <Modal.Footer className="sm-final-footer">
        {done ? (
          <Button variant="primary" onPress={onClose}>
            {t('session.recovery.acknowledge')}
          </Button>
        ) : null}
      </Modal.Footer>
    </>
  )
}
