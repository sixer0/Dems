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
  Spinner,
  TextArea,
  TextField,
  toast,
} from '@heroui/react'
import { AnimatePresence, motion } from 'motion/react'
import { Download, FileJson, FileArchive, ShieldCheck, UserRound } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { CoreMode, settle, useCoreActions, useCoreMode } from '@dems/shared/live'
import {
  EXPORT_REASON_MIN_LENGTH,
  OperatorRole,
  Permission,
  selectCan,
  selectOperator,
  useSim,
  useSimInstance,
  type ExportResult,
} from '@dems/shared/sim'
import { Stepper, type StepperStep } from '@/components/composed/stepper'
import { TransitionPanel } from '@/components/ui/transition-panel'
import { useCoreErrorPresenter } from '@/lib/core-errors'
import { deferEffectStart } from '@/lib/effect-start'
import { usePendingControl } from '@/lib/pending-control'
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
import {
  anyExportPastGuard,
  everyExportDenied,
  exportFailureText,
  reasonRefused as coreRefusedReason,
  type ExportOutcome,
} from './export-outcome'
import { answeredArchiveOnCoreOf, answeredJobIdOf, type ExportJobKind } from './export-job-model'
import { isDemoItem } from './item-facts'
import { ExportJobStatus } from './export-job-status'
import { LockShackle } from './lock-shackle'
import { logEvidenceError, newCorrelationId } from './log'
import { byteSize, shortHash, type EvidenceRow } from './model'
import { latestAuditRowFor } from './sim-adapter'
import { isV2Item, useEvidenceVerification, type VerifyState } from './use-verification'

export interface ExportWizardProps {
  rows: EvidenceRow[]
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  /**
   * `exportDestinationDefault` of operation 40 (fix wave K, G94b-11 / -12): the destination text the
   * Core records for an export that names none. The option whose recorded text equals it is
   * pre-selected; null / absent (a list of items, the simulator, an older Core): the first option.
   */
  destinationDefault?: string | null
}

type StepIndex = 0 | 1 | 2 | 3
type Destination = 'CASE_FILE' | 'USB' | 'NETWORK'
const DESTINATIONS: Destination[] = ['CASE_FILE', 'USB', 'NETWORK']
/** Operation 42, schema v2 (integration pass D5): what a new export job builds. PACKAGE is the default and is not named in the request. */
const EXPORT_KINDS: ExportJobKind[] = ['PACKAGE', 'COMPOSITE']
const REASON_MAX = 500

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
 *
 * Live mode (backend task, plan row W69; 04_client_integration_spec §8.2 A5, §8.4 C-5 and D-6;
 * F59; LB-1, LB-2, LB-6, LB-10). Every export goes through `useCoreActions()` and `settle`, one
 * row after the other (nested `settle` calls in row order), and the Core server is the judge:
 * - Authorise, for a role without EVIDENCE_EXPORT (D-6): one export per selected row, so the Core
 *   writes its `EXPORT_DENIED` row for each; with more than 20 refusals within 60 s the later calls
 *   answer 429, which the presenter shows once (LB-10). The denied Alert follows the answers; if
 *   the Core let a call through (the console's permission hint was out of date), its answers are
 *   shown as the export's result instead.
 * - Export (A5): the request starts at the press and the step stays on its pipeline step until the
 *   last answer (LB-2). `202` → accepted, and the audit row of the export is read from the replica
 *   (C-5). `403` for every row → the denied Alert. `422 INVALID_REASON` → back to the Reason step,
 *   the reason kept. `404`, `409` → the existing sentence of the reason. No answer → the presenter's
 *   toast and the row's failure state with the presenter's own sentence.
 * - While a request is out its control ignores presses, its step panel carries `aria-busy`, and
 *   after `LIVE_PENDING_REVEAL_MS` the button shows the kit's spinner (LB-1).
 * In Simulated mode every `settle` runs before it returns, so the wizard behaves as before.
 */
export function ExportWizard({ rows, isOpen, onOpenChange, destinationDefault = null }: ExportWizardProps) {
  const { t } = useTranslation()
  const m = useMotionPolicy()
  const sim = useSimInstance()
  const actions = useCoreActions()
  const live = useCoreMode() === CoreMode.LIVE
  const presentCoreError = useCoreErrorPresenter()
  const authorising = usePendingControl()
  const exporting = usePendingControl()
  const assets = useEvidenceAssets()
  const operator = useSim(selectOperator)
  const canExport = useSim((s) => selectCan(s, Permission.EVIDENCE_EXPORT))
  const [step, setStep] = useState<StepIndex>(0)
  const [direction, setDirection] = useState<1 | -1>(1)
  const [reason, setReason] = useState('')
  const [reasonTouched, setReasonTouched] = useState(false)
  /** Live mode: the Core answered `422 INVALID_REASON` for this reason (F59: the Core is the judge). */
  const [reasonRejected, setReasonRejected] = useState(false)
  /** The operator's own choice; null until one is made - the Core's default (or the first option) stands until then. */
  const [chosenDestination, setChosenDestination] = useState<Destination | null>(null)
  const [kind, setKind] = useState<ExportJobKind>('PACKAGE')
  const [auth, setAuth] = useState<'idle' | 'granted' | 'denied'>('idle')
  const [verification, setVerification] = useState<Record<string, VerifyState>>({})
  const [outcomes, setOutcomes] = useState<ExportOutcome[] | null>(null)
  const [downloads, setDownloads] = useState<Record<string, 'idle' | 'busy' | 'done' | 'error'>>({})
  const [zipChecks, setZipChecks] = useState<Record<string, { ok: boolean; actual: string | null; expected: string | null }>>({})

  const trimmed = reason.trim()
  const reasonValid = trimmed.length >= EXPORT_REASON_MIN_LENGTH
  // Wave H C2 (G94-09): on a Core, an item that is not a v1 / simulated demo item is exported by the
  // Core itself: nothing in its dialog is labelled DEMO or simulated, and no bundled DEMO manifest is
  // offered beside the Core's archive. A demo item (and Simulated mode) keeps what it had.
  const coreOnly = live && rows.length > 0 && rows.every((row) => !isDemoItem(row.item))
  const destinationLabel = (key: Destination): string => t(coreOnly ? `evidence.itemFacts.exportReal.destination.${key}` : `evidence.exportWizard.destinations.${key}`)
  const destination: Destination = chosenDestination ?? (destinationDefault === null ? undefined : DESTINATIONS.find((key) => destinationLabel(key) === destinationDefault)) ?? DESTINATIONS[0]!
  const destinationText = destinationLabel(destination)
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
    if (index < step || (index === 3 && outcomes?.every((outcome) => outcome.result?.ok === true))) return 'done'
    return index === step ? 'active' : 'pending'
  }
  const steps: StepperStep[] = [
    { id: 'reason', label: t('evidence.exportWizard.steps.reason'), status: stepStatus(0) },
    { id: 'authorise', label: t('evidence.exportWizard.steps.authorise'), status: stepStatus(1) },
    { id: 'verify', label: t('evidence.exportWizard.steps.verify'), status: stepStatus(2) },
    { id: 'export', label: t('evidence.exportWizard.steps.export'), status: stepStatus(3) },
  ]

  /** One export through `settle`; `onAnswer` gets the result, or `null` and the presenter's notice when there was none. */
  const exportOne = (
    row: EvidenceRow,
    source: 'export.authorise' | 'export.run',
    correlationId: string,
    onAnswer: (result: ExportResult | null, failureText: string | null) => void,
  ) => {
    // The kind is a Live choice (the job of operations 42 / 87); the Core cannot say beforehand whether
    // this build has a composite encoder, so a COMPOSITE is asked for and its job answers (FAILED with its cause).
    settle(() => actions.exportEvidence(row.id, { reason: trimmed, destination: destinationText, ...(live && kind === 'COMPOSITE' ? { kind } : {}) }), {
      ok: (result) => onAnswer(result, null),
      fail: (error) => {
        // Rule 2: the presenter speaks first (an outage, a time-out, a limit); the page records the rest.
        const notice = presentCoreError(error)
        if (notice === null) logEvidenceError(source, error, { evidenceId: row.id, correlationId, reasonLength: trimmed.length })
        // Simulated mode keeps its fallback (an item that is gone); in Live mode the Core gave no result.
        if (!live && notice === null) onAnswer({ ok: false, status: 404, reason: 'NOT_FOUND' }, null)
        else onAnswer(null, exportFailureText(t, notice))
      },
    })
  }

  /** The audit row of an accepted export, read from the replica (C-5), and the row's outcome. */
  const outcomeOf = (row: EvidenceRow, result: ExportResult | null, failureText: string | null): ExportOutcome => {
    const state = sim.store.getState()
    const audit = result?.ok ? latestAuditRowFor(state, row.id, 'EVIDENCE_EXPORTED') : null
    return {
      rowId: row.id,
      result,
      auditRowId: audit?.id ?? null,
      auditHash: audit?.hash ?? null,
      exportedAt: state.clock.now,
      failureText,
    }
  }

  /**
   * The result list and its toast (all accepted, or how many of how many). When nothing was
   * accepted and no row has an answer of the Core (Live mode: an outage), the presenter has already
   * spoken (LB-6: one toast) and the rows show its sentence, so no second toast is added.
   */
  const showOutcomes = (results: ExportOutcome[]) => {
    setOutcomes(results)
    const accepted = results.filter((outcome) => outcome.result?.ok === true)
    if (accepted.length === results.length) toast.success(t('evidence.exportWizard.successToast', { id: idLabel }))
    else if (accepted.length > 0 || results.some((outcome) => outcome.result !== null)) {
      toast.danger(t('evidence.exportWizard.partialToast', { ok: accepted.length, total: results.length }))
    }
  }

  /** §19.3 rule 2: every attempt is audited. A denied role gets EXPORT_DENIED rows (D-6: one per row, in row order). */
  const requestAuthorisation = () => {
    if (canExport) {
      setAuth('granted')
      return
    }
    const correlationId = newCorrelationId('export')
    authorising.run((release) => {
      const answers: { row: EvidenceRow; result: ExportResult | null; failureText: string | null }[] = []
      const finish = () => {
        const results = answers.map((answer) => answer.result)
        if (live && anyExportPastGuard(results)) {
          // The Core is the judge: it let a call through, so its answers are the export's result.
          setAuth('granted')
          showOutcomes(answers.map((answer) => outcomeOf(answer.row, answer.result, answer.failureText)))
          goTo(3)
        } else {
          setAuth('denied')
        }
        release()
      }
      const next = (index: number) => {
        const row = rows[index]
        if (!row) {
          finish()
          return
        }
        exportOne(row, 'export.authorise', correlationId, (result, failureText) => {
          answers.push({ row, result, failureText })
          next(index + 1)
        })
      }
      next(0)
    })
  }

  const runExport = () => {
    const correlationId = newCorrelationId('export')
    exporting.run((release) => {
      const results: ExportOutcome[] = []
      const finish = () => {
        const answers = results.map((outcome) => outcome.result)
        if (live && everyExportDenied(answers)) {
          // A5: 403 → the wizard's denied Alert; the Core wrote EXPORT_DENIED for each call.
          setAuth('denied')
          goTo(1)
        } else if (live && coreRefusedReason(answers)) {
          // A5, F59: INVALID_REASON returns to the Reason step; what was typed stays.
          setReasonRejected(true)
          setReasonTouched(true)
          goTo(0)
        } else {
          showOutcomes(results)
        }
        release()
      }
      const next = (index: number) => {
        const row = rows[index]
        if (!row) {
          finish()
          return
        }
        exportOne(row, 'export.run', correlationId, (result, failureText) => {
          results.push(outcomeOf(row, result, failureText))
          next(index + 1)
        })
      }
      next(0)
    })
  }

  const download = async (row: EvidenceRow, outcome: ExportOutcome, plan: ExportDownloadPlan) => {
    if (!outcome.result?.ok || !operator) return
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

  const reasonError = reasonRejected
    ? t('evidence.live.export.reasonRefused')
    : reasonTouched && !reasonValid
      ? t('evidence.exportWizard.reasonTooShort', { min: EXPORT_REASON_MIN_LENGTH })
      : null

  const panels = [
    <div key="reason" className="evi-wizard-panel" data-testid="export-step-reason">
      <p className="evi-wizard-lead">{t('evidence.exportWizard.reasonLead', { id: idLabel })}</p>
      <TextField
        isRequired
        value={reason}
        onChange={(value) => {
          setReason(value.slice(0, REASON_MAX))
          setReasonRejected(false)
        }}
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
          if (value && DESTINATIONS.includes(value as Destination)) setChosenDestination(value as Destination)
        }}
        className="evi-field"
      >
        <Label>{t(coreOnly ? 'evidence.itemFacts.exportReal.destinationLabel' : 'evidence.exportWizard.destinationLabel')}</Label>
        <Select.Trigger data-testid="export-destination">
          <Select.Value />
          <Select.Indicator />
        </Select.Trigger>
        <Select.Popover>
          <ListBox>
            {DESTINATIONS.map((key) => (
              <ListBox.Item key={key} id={key} textValue={destinationLabel(key)}>
                {destinationLabel(key)}
                <ListBox.ItemIndicator />
              </ListBox.Item>
            ))}
          </ListBox>
        </Select.Popover>
      </Select>
      {coreOnly ? (
        <p className="evi-caption" data-testid="export-real-note">
          {t('evidence.itemFacts.exportReal.note')}
        </p>
      ) : null}
      {live ? (
        <Select
          value={kind}
          onChange={(value) => {
            if (value && EXPORT_KINDS.includes(value as ExportJobKind)) setKind(value as ExportJobKind)
          }}
          className="evi-field"
        >
          <Label>{t('evidence.exportJob.kindLabel')}</Label>
          <Select.Trigger data-testid="export-kind">
            <Select.Value />
            <Select.Indicator />
          </Select.Trigger>
          <Select.Popover>
            <ListBox>
              {EXPORT_KINDS.map((key) => (
                <ListBox.Item key={key} id={key} textValue={t(`evidence.exportJob.kind.${key}`)}>
                  {t(`evidence.exportJob.kind.${key}`)}
                  <ListBox.ItemIndicator />
                </ListBox.Item>
              ))}
            </ListBox>
          </Select.Popover>
        </Select>
      ) : null}
    </div>,

    <div key="authorise" className="evi-wizard-panel" data-testid="export-step-authorise" aria-busy={authorising.busy || undefined}>
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

    <div key="export" className="evi-wizard-panel" data-testid="export-step-export" aria-busy={exporting.busy || undefined}>
      {outcomes === null ? (
        <>
          <p className="evi-wizard-lead">{t('evidence.exportWizard.summary', { id: idLabel, destination: destinationText })}</p>
          <dl className="evi-kv evi-kv-compact">
            <div>
              <dt>{t('evidence.exportWizard.reasonLabel')}</dt>
              <dd>{trimmed}</dd>
            </div>
            <div>
              <dt>{t(coreOnly ? 'evidence.itemFacts.exportReal.destinationLabel' : 'evidence.exportWizard.destinationLabel')}</dt>
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
            if (!outcome.result?.ok) {
              return (
                <li key={row.id} data-export-failure={outcome.result?.reason ?? 'NO_RESULT'}>
                  <Alert status="danger">
                    <Alert.Indicator />
                    <Alert.Content>
                      <Alert.Title>{row.id}</Alert.Title>
                      <Alert.Description>
                        {outcome.result
                          ? t(`evidence.exportWizard.failure.${outcome.result.reason}`)
                          : (outcome.failureText ?? t('evidence.live.export.notCompleted'))}
                      </Alert.Description>
                    </Alert.Content>
                  </Alert>
                </li>
              )
            }
            const plan = exportDownloadPlan(row, outcome.result.exportId)
            const state = downloads[row.id] ?? 'idle'
            const zip = zipChecks[row.id]
            // Row 92: a Core-sealed (schema-v2) item has no bundled DEMO file to hand over, and the
            // contract sends no export archive to a client: its result is the Core's job, below.
            // Wave H C2 (G94-09): also for a REAL item whose replicated copy names no `files[]` (`isV2Item`), and for any item that is not a demo item.
            const coreArchiveOnly = live && (isV2Item(row) || !isDemoItem(row.item))
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
                {/* Operation 42 only queued the export: operation 87 says when it is done, or that it FAILED. */}
                {live ? <ExportJobStatus exportId={outcome.result.exportId} evidenceId={row.id} jobId={answeredJobIdOf(outcome.result)} archiveOnCore={answeredArchiveOnCoreOf(outcome.result)} /> : null}
                {coreArchiveOnly ? null : (
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
                )}
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
      <Button variant="outline" isDisabled={exporting.busy || authorising.busy} onPress={() => goTo((step - 1) as StepIndex)}>
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
          <Button
            variant="primary"
            onPress={requestAuthorisation}
            isPending={authorising.pending}
            data-pending={authorising.pending ? 'true' : undefined}
            data-testid="export-authorise"
          >
            {authorising.pending ? <Spinner size="sm" color="current" aria-hidden="true" /> : null}
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
        <Button
          variant="primary"
          onPress={runExport}
          isPending={exporting.pending}
          data-pending={exporting.pending ? 'true' : undefined}
          data-testid="export-submit"
        >
          {exporting.pending ? <Spinner size="sm" color="current" aria-hidden="true" /> : null}
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
            {coreOnly ? null : (
              <Chip size="sm" variant="secondary" className="evi-demo-chip">
                <Chip.Label>{t('evidence.demo.chip')}</Chip.Label>
              </Chip>
            )}
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
  // Live mode: the Core's verdict decides (§19.3 rule 3); the bundled package's check is not repeated here.
  const { state, run } = useEvidenceVerification(row, { record: true, toasts: false, bundled: false })
  const runRef = useRef(run)
  useEffect(() => {
    runRef.current = run
  })
  // §19.3 rule 3: the source is verified as soon as this step opens (once per mount). The start
  // waits one task, so React StrictMode's simulated unmount (every dev build, where Live mode lives)
  // cancels the first start instead of sending a second verification to the Core (plan row W69; the
  // shared helper, W0).
  useEffect(() => deferEffectStart(() => void runRef.current()), [])

  useEffect(() => {
    onState(row.id, state)
  }, [onState, row.id, state])

  const verdict = state.phase === 'running' ? 'RUNNING' : state.phase === 'error' ? 'ERROR' : (state.verdict ?? 'NOT_RUN')
  const summary = useMemo(() => {
    // Row 87: a schema-v2 item has no v1 rows to count; its result is the Core's verdict (the chip).
    if (state.awaitsV2 === true) return state.phase === 'running' ? t('evidence.verifyV2.waiting') : ''
    const done = state.checks.filter((check) => check.phase === 'pass' || check.phase === 'fail').length
    return t('evidence.verify.progress', { done, total: state.checks.length })
  }, [state.awaitsV2, state.checks, state.phase, t])

  return (
    <section className="evi-source-check" data-testid={`export-source-${row.id}`} data-verdict={verdict}>
      <header className="evi-source-check-head">
        <span className="evi-id">{row.id}</span>
        <span className="evi-caption">{summary}</span>
        <VerdictChip verdict={verdict} runKey={state.runId} size="sm" className="ml-auto" />
      </header>
      {state.awaitsV2 === true ? null : <CheckList state={state} variant="compact" />}
      <p className="evi-caption">
        {state.mode === 'core'
          ? t('evidence.live.verify.sourceCaption')
          : state.mode === 'package'
            ? (state.label ?? t('evidence.verify.packageMode'))
            : t('evidence.verify.simulatedMode')}
      </p>
    </section>
  )
}
