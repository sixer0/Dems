import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Alert,
  Button,
  Chip,
  Description,
  FieldError,
  Label,
  ListBox,
  Modal,
  Select,
  TextArea,
  TextField,
  toast,
} from '@heroui/react'
import { AnimatePresence, motion } from 'motion/react'
import { Download, FileJson, FileArchive, ShieldCheck, UserRound } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import {
  EXPORT_REASON_MIN_LENGTH,
  OperatorRole,
  Permission,
  selectCan,
  selectOperator,
  useSim,
  useSimActions,
  useSimInstance,
  type ExportResult,
} from '@dems/shared/sim'
import { Stepper, type StepperStep } from '@/components/composed/stepper'
import { TransitionPanel } from '@/components/ui/transition-panel'
import { useMotionPolicy } from '@/motion'
import { CheckList } from './check-list'
import { VerdictChip } from './chips'
import { useEvidenceAssets } from './demo-assets'
import {
  buildDemoExportManifest,
  exportDownloadPlan,
  prepareZipDownload,
  saveBytes,
  type ExportDownloadPlan,
} from './export-download'
import { LockShackle } from './lock-shackle'
import { logEvidenceError, newCorrelationId } from './log'
import { byteSize, shortHash, type EvidenceRow } from './model'
import { latestAuditRowFor } from './sim-adapter'
import { useEvidenceVerification, type VerifyState } from './use-verification'

export interface ExportWizardProps {
  rows: EvidenceRow[]
  isOpen: boolean
  onOpenChange: (open: boolean) => void
}

type StepIndex = 0 | 1 | 2 | 3
type Destination = 'CASE_FILE' | 'USB' | 'NETWORK'
const DESTINATIONS: Destination[] = ['CASE_FILE', 'USB', 'NETWORK']
const REASON_MAX = 500

interface ExportOutcome {
  rowId: string
  result: ExportResult
  auditRowId: string | null
  auditHash: string | null
  exportedAt: number
}

/**
 * Export wizard (01_specs §14.5.3 "Export → Modal export wizard"; design book §19.2, §19.3; C9;
 * 03_motion_spec M-PG-EVID, M-C-09).
 *
 * Order per §19.3: **Reason** (mandatory, at least 5 characters, S21) → **Authorise** (RBAC through
 * the simulator: a role without EVIDENCE_EXPORT gets the danger Alert and an EXPORT_DENIED audit row,
 * §19.3 rule 2) → **Verify source** (the REAL package re-verification, §19.3 rule 3; a FAIL blocks the
 * export) → **Export** (`exportEvidence` writes the custody entry and EVIDENCE_EXPORTED audit row; the
 * download is EV 0004's prebuilt `EXP-000031.zip`, hash-checked against its export manifest, or the
 * DEMO export manifest JSON for other items). The source package is never modified (§19.3 rule 1).
 */
export function ExportWizard({ rows, isOpen, onOpenChange }: ExportWizardProps) {
  const { t } = useTranslation()
  const m = useMotionPolicy()
  const sim = useSimInstance()
  const actions = useSimActions()
  const assets = useEvidenceAssets()
  const operator = useSim(selectOperator)
  const canExport = useSim((s) => selectCan(s, Permission.EVIDENCE_EXPORT))
  const [step, setStep] = useState<StepIndex>(0)
  const [direction, setDirection] = useState<1 | -1>(1)
  const [reason, setReason] = useState('')
  const [reasonTouched, setReasonTouched] = useState(false)
  const [destination, setDestination] = useState<Destination>('CASE_FILE')
  const [auth, setAuth] = useState<'idle' | 'granted' | 'denied'>('idle')
  const [verification, setVerification] = useState<Record<string, VerifyState>>({})
  const [outcomes, setOutcomes] = useState<ExportOutcome[] | null>(null)
  const [downloads, setDownloads] = useState<Record<string, 'idle' | 'busy' | 'done' | 'error'>>({})
  const [zipChecks, setZipChecks] = useState<Record<string, { ok: boolean; actual: string | null; expected: string | null }>>({})

  const trimmed = reason.trim()
  const reasonValid = trimmed.length >= EXPORT_REASON_MIN_LENGTH
  const destinationText = t(`evidence.exportWizard.destinations.${destination}`)
  const allVerified = rows.length > 0 && rows.every((row) => verification[row.id]?.phase === 'done')
  const failedSources = rows.filter((row) => verification[row.id]?.verdict === 'FAIL')
  const erroredSources = rows.filter((row) => verification[row.id]?.phase === 'error')
  const sourcesOk = allVerified && failedSources.length === 0
  const idLabel = rows.length === 1 ? (rows[0]?.id ?? '') : t('evidence.exportWizard.itemCount', { count: rows.length })

  const goTo = (next: StepIndex) => {
    setDirection(next > step ? 1 : -1)
    setStep(next)
  }

  const stepStatus = (index: number): StepperStep['status'] => {
    if (index === 1 && auth === 'denied') return 'error'
    if (index === 2 && allVerified && !sourcesOk) return 'error'
    if (index < step || (index === 3 && outcomes?.every((outcome) => outcome.result.ok))) return 'done'
    return index === step ? 'active' : 'pending'
  }
  const steps: StepperStep[] = [
    { id: 'reason', label: t('evidence.exportWizard.steps.reason'), status: stepStatus(0) },
    { id: 'authorise', label: t('evidence.exportWizard.steps.authorise'), status: stepStatus(1) },
    { id: 'verify', label: t('evidence.exportWizard.steps.verify'), status: stepStatus(2) },
    { id: 'export', label: t('evidence.exportWizard.steps.export'), status: stepStatus(3) },
  ]

  /** §19.3 rule 2: every attempt is audited. A denied role gets EXPORT_DENIED rows from the sim. */
  const requestAuthorisation = () => {
    if (canExport) {
      setAuth('granted')
      return
    }
    for (const row of rows) {
      try {
        actions.exportEvidence(row.id, { reason: trimmed, destination: destinationText })
      } catch (error) {
        logEvidenceError('export.authorise', error, { evidenceId: row.id, reasonLength: trimmed.length })
      }
    }
    setAuth('denied')
  }

  const runExport = () => {
    const correlationId = newCorrelationId('export')
    const results: ExportOutcome[] = rows.map((row) => {
      try {
        const result = actions.exportEvidence(row.id, { reason: trimmed, destination: destinationText })
        const state = sim.store.getState()
        const audit = result.ok ? latestAuditRowFor(state, row.id, 'EVIDENCE_EXPORTED') : null
        return { rowId: row.id, result, auditRowId: audit?.id ?? null, auditHash: audit?.hash ?? null, exportedAt: state.clock.now }
      } catch (error) {
        logEvidenceError('export.run', error, { evidenceId: row.id, correlationId, reasonLength: trimmed.length })
        return { rowId: row.id, result: { ok: false, status: 404, reason: 'NOT_FOUND' }, auditRowId: null, auditHash: null, exportedAt: Date.now() }
      }
    })
    setOutcomes(results)
    const accepted = results.filter((outcome) => outcome.result.ok)
    if (accepted.length === results.length) toast.success(t('evidence.exportWizard.successToast', { id: idLabel }))
    else toast.danger(t('evidence.exportWizard.partialToast', { ok: accepted.length, total: results.length }))
  }

  const download = async (row: EvidenceRow, outcome: ExportOutcome, plan: ExportDownloadPlan) => {
    if (!outcome.result.ok || !operator) return
    const correlationId = newCorrelationId('export')
    setDownloads((previous) => ({ ...previous, [row.id]: 'busy' }))
    try {
      if (plan.kind === 'zip') {
        const prepared = await prepareZipDownload(assets.load, plan)
        setZipChecks((previous) => ({ ...previous, [row.id]: { ok: prepared.check.ok, actual: prepared.check.actual, expected: prepared.check.expected } }))
        if (!prepared.check.ok) throw new Error('Export zip hash differs from its export manifest')
        saveBytes(prepared.bytes, plan.fileName, 'application/zip')
      } else {
        const state = sim.store.getState()
        const json = buildDemoExportManifest({
          row,
          exportId: outcome.result.exportId,
          exportedAt: outcome.exportedAt,
          operator,
          destination: destinationText,
          reason: trimmed,
          authorizationRef: outcome.auditRowId,
          device: state.device,
          verification: { report: verification[row.id]?.report ?? null, simulated: null },
        })
        saveBytes(json, plan.fileName, 'application/json')
      }
      setDownloads((previous) => ({ ...previous, [row.id]: 'done' }))
    } catch (error) {
      logEvidenceError('export.download', error, { evidenceId: row.id, plan: plan.kind, correlationId })
      setDownloads((previous) => ({ ...previous, [row.id]: 'error' }))
      toast.danger(t('evidence.exportWizard.downloadError'))
    }
  }

  const onVerified = useCallback((rowId: string, state: VerifyState) => {
    setVerification((previous) => (previous[rowId] === state ? previous : { ...previous, [rowId]: state }))
  }, [])

  const reasonError = reasonTouched && !reasonValid ? t('evidence.exportWizard.reasonTooShort', { min: EXPORT_REASON_MIN_LENGTH }) : null

  const panels = [
    <div key="reason" className="evi-wizard-panel" data-testid="export-step-reason">
      <p className="evi-wizard-lead">{t('evidence.exportWizard.reasonLead', { id: idLabel })}</p>
      <TextField
        isRequired
        value={reason}
        onChange={(value) => setReason(value.slice(0, REASON_MAX))}
        onBlur={() => setReasonTouched(true)}
        isInvalid={reasonError !== null}
        className="evi-field"
      >
        <Label>{t('evidence.exportWizard.reasonLabel')}</Label>
        <TextArea placeholder={t('evidence.exportWizard.reasonPlaceholder')} rows={3} data-testid="export-reason" />
        {reasonError ? <FieldError>{reasonError}</FieldError> : <Description>{t('evidence.exportWizard.reasonHint', { min: EXPORT_REASON_MIN_LENGTH })}</Description>}
      </TextField>
      <Select
        value={destination}
        onChange={(value) => {
          if (value && DESTINATIONS.includes(value as Destination)) setDestination(value as Destination)
        }}
        className="evi-field"
      >
        <Label>{t('evidence.exportWizard.destinationLabel')}</Label>
        <Select.Trigger data-testid="export-destination">
          <Select.Value />
          <Select.Indicator />
        </Select.Trigger>
        <Select.Popover>
          <ListBox>
            {DESTINATIONS.map((key) => (
              <ListBox.Item key={key} id={key} textValue={t(`evidence.exportWizard.destinations.${key}`)}>
                {t(`evidence.exportWizard.destinations.${key}`)}
                <ListBox.ItemIndicator />
              </ListBox.Item>
            ))}
          </ListBox>
        </Select.Popover>
      </Select>
    </div>,

    <div key="authorise" className="evi-wizard-panel" data-testid="export-step-authorise">
      <div className="evi-operator-card">
        <UserRound className="size-5 text-accent" aria-hidden="true" />
        <div className="flex flex-col">
          <span className="evi-strong">{operator?.displayName ?? '—'}</span>
          <span className="evi-caption">
            {operator ? t(`common.roles.${operator.role}`) : ''} · {t('evidence.exportWizard.requiredPermission')}
          </span>
        </div>
        {auth === 'granted' ? (
          <Chip color="success" variant="soft" size="sm" className="ml-auto">
            <ShieldCheck className="size-3.5" aria-hidden="true" />
            <Chip.Label>{t('evidence.exportWizard.authorised')}</Chip.Label>
          </Chip>
        ) : null}
      </div>
      <AnimatePresence initial={false}>
        {auth === 'denied' ? (
          <motion.div
            key="denied"
            initial={m.reduced ? { opacity: 0 } : { opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={m.transitions.crossFade}
          >
            <Alert status="danger" data-testid="export-denied">
              <Alert.Indicator>
                <LockShackle />
              </Alert.Indicator>
              <Alert.Content>
                <Alert.Title>{t('evidence.exportWizard.deniedTitle')}</Alert.Title>
                <Alert.Description>{t('evidence.exportWizard.deniedBody', { role: t(`common.roles.${OperatorRole.SUPERVISOR}`) })}</Alert.Description>
              </Alert.Content>
            </Alert>
          </motion.div>
        ) : null}
      </AnimatePresence>
      {auth === 'idle' ? <p className="evi-caption">{t('evidence.exportWizard.authoriseHint')}</p> : null}
    </div>,

    <div key="verify" className="evi-wizard-panel" data-testid="export-step-verify">
      <p className="evi-wizard-lead">{t('evidence.exportWizard.verifyLead')}</p>
      {rows.map((row) => (
        <SourceCheck key={row.id} row={row} onState={onVerified} />
      ))}
      {allVerified && !sourcesOk ? (
        <Alert status="danger" data-testid="export-blocked">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>{t('evidence.exportWizard.blockedTitle')}</Alert.Title>
            <Alert.Description>{t('evidence.exportWizard.blockedBody', { ids: failedSources.map((row) => row.id).join(', ') })}</Alert.Description>
          </Alert.Content>
        </Alert>
      ) : null}
      {erroredSources.length > 0 ? (
        <Alert status="warning">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>{t('evidence.verify.errorToast')}</Alert.Title>
          </Alert.Content>
        </Alert>
      ) : null}
    </div>,

    <div key="export" className="evi-wizard-panel" data-testid="export-step-export">
      {outcomes === null ? (
        <>
          <p className="evi-wizard-lead">{t('evidence.exportWizard.summary', { id: idLabel, destination: destinationText })}</p>
          <dl className="evi-kv evi-kv-compact">
            <div>
              <dt>{t('evidence.exportWizard.reasonLabel')}</dt>
              <dd>{trimmed}</dd>
            </div>
            <div>
              <dt>{t('evidence.exportWizard.destinationLabel')}</dt>
              <dd>{destinationText}</dd>
            </div>
          </dl>
          <p className="evi-caption">{t('evidence.exportWizard.custodyNote')}</p>
        </>
      ) : (
        <ul className="evi-export-results" data-testid="export-results">
          {rows.map((row) => {
            const outcome = outcomes.find((entry) => entry.rowId === row.id)
            if (!outcome) return null
            if (!outcome.result.ok) {
              return (
                <li key={row.id}>
                  <Alert status="danger">
                    <Alert.Indicator />
                    <Alert.Content>
                      <Alert.Title>{row.id}</Alert.Title>
                      <Alert.Description>{t(`evidence.exportWizard.failure.${outcome.result.reason}`)}</Alert.Description>
                    </Alert.Content>
                  </Alert>
                </li>
              )
            }
            const plan = exportDownloadPlan(row, outcome.result.exportId)
            const state = downloads[row.id] ?? 'idle'
            const zip = zipChecks[row.id]
            return (
              <li key={row.id} className="evi-export-result" data-export-id={outcome.result.exportId} data-plan={plan.kind}>
                <div className="evi-export-result-head">
                  <span className="evi-id">{row.id}</span>
                  <Chip color="success" variant="soft" size="sm">
                    <Chip.Label>{t('evidence.exportWizard.accepted', { exportId: outcome.result.exportId })}</Chip.Label>
                  </Chip>
                </div>
                <p className="evi-caption">
                  {t('evidence.exportWizard.auditRecorded', { audit: outcome.auditRowId ?? '—', hash: outcome.auditHash ? shortHash(outcome.auditHash) : '—' })}
                </p>
                <div className="evi-export-download">
                  {plan.kind === 'zip' ? <FileArchive className="size-5 text-accent" aria-hidden="true" /> : <FileJson className="size-5 text-accent" aria-hidden="true" />}
                  <div className="flex min-w-0 flex-col">
                    <span className="evi-strong evi-mono">{plan.fileName}</span>
                    <span className="evi-caption">
                      {plan.kind === 'zip'
                        ? t('evidence.exportWizard.zipLabel', {
                            exportId: plan.prebuiltExportId,
                            size: t(`common.units.${byteSize(plan.bytes).unit}`, { value: byteSize(plan.bytes).value }),
                          })
                        : t('evidence.exportWizard.manifestLabel')}
                    </span>
                    {zip ? (
                      <span className={zip.ok ? 'evi-caption evi-ok' : 'evi-caption evi-bad'} data-testid="export-zip-check" data-ok={zip.ok ? 'true' : 'false'}>
                        {zip.ok
                          ? t('evidence.exportWizard.zipHashOk', { hash: zip.actual ? shortHash(zip.actual) : '—' })
                          : t('evidence.exportWizard.zipHashBad')}
                      </span>
                    ) : null}
                  </div>
                  <Button
                    variant={state === 'done' ? 'outline' : 'primary'}
                    size="sm"
                    isPending={state === 'busy'}
                    onPress={() => void download(row, outcome, plan)}
                    className="ml-auto"
                    data-testid={`export-download-${row.id}`}
                  >
                    <Download className="size-4" aria-hidden="true" />
                    {state === 'done' ? t('evidence.exportWizard.downloadAgain') : t('common.actions.download')}
                  </Button>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>,
  ]

  const footer = (() => {
    const cancel = (
      <Button variant="ghost" onPress={() => onOpenChange(false)} data-testid="export-cancel">
        {outcomes ? t('common.actions.close') : t('common.actions.cancel')}
      </Button>
    )
    const back = step > 0 && outcomes === null && auth !== 'denied' ? (
      <Button variant="outline" onPress={() => goTo((step - 1) as StepIndex)}>
        {t('common.actions.back')}
      </Button>
    ) : null
    let primary = null
    if (step === 0) {
      primary = (
        <Button
          variant="primary"
          onPress={() => {
            setReasonTouched(true)
            if (reasonValid) goTo(1)
          }}
          data-testid="export-next"
        >
          {t('common.actions.next')}
        </Button>
      )
    } else if (step === 1) {
      primary =
        auth === 'granted' ? (
          <Button variant="primary" onPress={() => goTo(2)} data-testid="export-next">
            {t('common.actions.next')}
          </Button>
        ) : auth === 'idle' ? (
          <Button variant="primary" onPress={requestAuthorisation} data-testid="export-authorise">
            {t('evidence.exportWizard.requestAuthorisation')}
          </Button>
        ) : null
    } else if (step === 2) {
      primary = (
        <Button variant="primary" isDisabled={!sourcesOk} onPress={() => goTo(3)} data-testid="export-next">
          {t('common.actions.next')}
        </Button>
      )
    } else if (outcomes === null) {
      primary = (
        <Button variant="primary" onPress={runExport} data-testid="export-submit">
          {t('evidence.exportWizard.submit')}
        </Button>
      )
    }
    return (
      <>
        {cancel}
        <span className="flex-1" />
        {back}
        {primary}
      </>
    )
  })()

  return (
    <Modal.Backdrop isOpen={isOpen} onOpenChange={onOpenChange} variant="blur">
      <Modal.Container size="lg" placement="center" scroll="inside">
        <Modal.Dialog aria-label={t('evidence.exportWizard.title')} className="evi-wizard" data-testid="export-wizard">
          <Modal.Header className="evi-wizard-header">
            <Modal.Heading>{t('evidence.exportWizard.title')}</Modal.Heading>
            <Chip size="sm" variant="secondary" className="evi-demo-chip">
              <Chip.Label>{t('evidence.demo.chip')}</Chip.Label>
            </Chip>
          </Modal.Header>
          <Modal.Body className="evi-wizard-body">
            <Stepper steps={steps} orientation="horizontal" variant="wizard" ariaLabel={t('evidence.exportWizard.title')} />
            <TransitionPanel activeIndex={step} custom={direction} className="evi-wizard-panels">
              {panels}
            </TransitionPanel>
          </Modal.Body>
          <Modal.Footer className="evi-wizard-footer">{footer}</Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  )
}

interface SourceCheckProps {
  row: EvidenceRow
  onState: (rowId: string, state: VerifyState) => void
}

/** One source's verification inside the wizard (§19.3 rule 3), started on mount. */
function SourceCheck({ row, onState }: SourceCheckProps) {
  const { t } = useTranslation()
  const { state, run } = useEvidenceVerification(row, { record: true, toasts: false })
  const runRef = useRef(run)
  useEffect(() => {
    runRef.current = run
  })
  // §19.3 rule 3: the source is verified as soon as this step opens (once per mount).
  useEffect(() => {
    void runRef.current()
  }, [])

  useEffect(() => {
    onState(row.id, state)
  }, [onState, row.id, state])

  const verdict = state.phase === 'running' ? 'RUNNING' : state.phase === 'error' ? 'ERROR' : (state.verdict ?? 'NOT_RUN')
  const summary = useMemo(() => {
    const done = state.checks.filter((check) => check.phase === 'pass' || check.phase === 'fail').length
    return t('evidence.verify.progress', { done, total: state.checks.length })
  }, [state.checks, t])

  return (
    <section className="evi-source-check" data-testid={`export-source-${row.id}`} data-verdict={verdict}>
      <header className="evi-source-check-head">
        <span className="evi-id">{row.id}</span>
        <span className="evi-caption">{summary}</span>
        <VerdictChip verdict={verdict} runKey={state.runId} size="sm" className="ml-auto" />
      </header>
      <CheckList state={state} variant="compact" />
      <p className="evi-caption">{state.mode === 'package' ? (state.label ?? t('evidence.verify.packageMode')) : t('evidence.verify.simulatedMode')}</p>
    </section>
  )
}
