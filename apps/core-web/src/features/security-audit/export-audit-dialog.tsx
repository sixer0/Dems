import { useEffect, useRef, useState } from 'react'
import { Alert, Button, Description, FieldError, Label, Modal, Spinner, TextArea, TextField, toast } from '@heroui/react'
import { Download, FileDown } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { settle, useCoreActions } from '@dems/shared/live'
import { Permission, useSim, useSimInstance, type ExportResult } from '@dems/shared/sim'
import { Stepper, type StepperStatus, type StepperStep } from '@/components/composed/stepper'
import { useCoreErrorPresenter } from '@/lib/core-errors'
import { usePendingControl } from '@/lib/pending-control'
import { useMotionPolicy } from '@/motion'
import { useWebLive, type WebLive } from '@/runtime'
import {
  AUDIT_PAGE_LIMIT,
  AuditWalkError,
  auditExportFileName,
  auditPageCount,
  buildAuditExportFile,
  downloadAuditFile,
  readExportedRows,
  type AuditExportFile,
} from './export-file'
import { logSecurityAudit } from './log'
import { roleFor, shortHash, type ChainReport } from './model'
import { AUDIT_EXPORT_REASON_MIN, auditExportOutcome, isValidExportReason, type AuditExportReceipt } from './sim-adapter'

/** Chain-of-custody steps (design book §19.3: authorize → verify → build → hash → audit event). */
const STEP_IDS = ['authorize', 'verify', 'build', 'seal', 'record'] as const
type StepId = (typeof STEP_IDS)[number]
/** Steps resolve one after another at this pace (UI choreography of one synchronous sim call). */
const STEP_PACE_MS = 220
/** Live mode: the pipeline holds on "Build export package" until the file is built from the Core's pages. */
const BUILD_INDEX = STEP_IDS.indexOf('build')

type Phase =
  | { kind: 'form' }
  | { kind: 'running'; resolved: number; receipt: AuditExportReceipt }
  | { kind: 'done'; receipt: AuditExportReceipt }

/** Live mode only: the file built from operation 59 after the Core accepted the export (§8.2 A7). */
type FileState =
  | { status: 'none' }
  | { status: 'reading'; page: number; pages: number | null }
  | { status: 'ready'; fileName: string; file: AuditExportFile }
  | { status: 'failed' }

const NO_FILE: FileState = { status: 'none' }

export interface ExportAuditDialogProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  chain: ChainReport
}

/** Reads one page of operation 59 through the Live source's typed client (rule 1: the one way in). */
function auditPageReader(live: WebLive) {
  return (cursor: string | null) =>
    live.client.call('listAuditRows', { query: { limit: AUDIT_PAGE_LIMIT, ...(cursor === null ? {} : { cursor }) } })
}

/**
 * "Export audit" dialog (01_specs §14.5.7 Export audit; design book §19.2 item 8, §19.3; S20,
 * S21). A reason is mandatory (≥ 5 characters, validated inline). On Export the action
 * `exportAudit({ reason })` runs once through `settle` (rule 1 of the page rows); the Stepper then
 * resolves the custody steps in order and the result shows the export ID, the entry count and
 * the chain head recorded in the new AUDIT_EXPORTED row. Errors: a friendly toast and inline
 * message (layer 1), a structured record in the page's own log (layer 2), the dialog stays usable
 * (layer 3).
 *
 * Simulated mode is as before: the simulator answers in the press, so `settle` runs the
 * continuation before it returns and nothing else changes.
 *
 * Live mode (plan row W75; 04_client_integration_spec §8.2 A7, §8.1 LB-1, LB-2, LB-6, LB-10):
 * - Waiting for the Core: the Export button is busy at once and shows the kit's spinner only after
 *   the reveal time (`usePendingControl`); a second press sends nothing; the form keeps the reason.
 * - 202: the receipt is read from the AUDIT_EXPORTED row in the replica (CL-16); the file is built
 *   from ALL pages of operation 59 (200 rows a page), because the Core's table may hold more rows
 *   than the ring; the "Build export package" step shows the page count and holds until the file is
 *   ready, then the file is downloaded (and can be downloaded again).
 * - 403: the denied state naming the role (the Core wrote `EXPORT_DENIED`). 422: the reason field's
 *   error; the Core is the judge of the reason (F59). No answer or a 429: the refusal presenter's
 *   toast (LB-6, LB-10); the dialog stays open with the reason.
 */
export function ExportAuditDialog({ isOpen, onOpenChange, chain }: ExportAuditDialogProps) {
  const { t } = useTranslation()
  const m = useMotionPolicy()
  const sim = useSimInstance()
  const actions = useCoreActions()
  const live = useWebLive()
  const isLive = live !== null
  const presentCoreError = useCoreErrorPresenter()
  // The busy mark goes on the pressed button through `ref` (08a §15); destructured, as Session New does.
  const { run: runExport, busy: exportBusy, pending: exportPending, ref: exportRef } = usePendingControl()
  const ringEntries = useSim((s) => s.audit.rows.length)
  const storedEntries = useSim((s) => s.audit.total)
  /** Simulated: the ring the simulator exports. Live: the stored chain the file is built from. */
  const entries = isLive ? storedEntries : ringEntries
  const [reason, setReason] = useState('')
  const [touched, setTouched] = useState(false)
  const [phase, setPhase] = useState<Phase>({ kind: 'form' })
  const [error, setError] = useState<string | null>(null)
  /** Live: the Core refused the reason (422); shown on the field until the reason changes. */
  const [reasonRefused, setReasonRefused] = useState(false)
  const [file, setFile] = useState<FileState>(NO_FILE)
  const fileRef = useRef<FileState>(NO_FILE)
  /** Bumped by every reset: an answer or a page of an earlier export changes nothing after it. */
  const generation = useRef(0)
  const timer = useRef<ReturnType<typeof setInterval> | null>(null)

  const stopTimer = () => {
    if (timer.current !== null) clearInterval(timer.current)
    timer.current = null
  }
  useEffect(
    () => () => {
      generation.current += 1
      stopTimer()
    },
    [],
  )

  const updateFile = (next: FileState) => {
    fileRef.current = next
    setFile(next)
  }

  const reset = () => {
    generation.current += 1
    stopTimer()
    setReason('')
    setTouched(false)
    setError(null)
    setReasonRefused(false)
    updateFile(NO_FILE)
    setPhase({ kind: 'form' })
  }

  const close = (open: boolean) => {
    // LB-6: while the Core has not answered, the dialog keeps what the operator typed.
    if (!open && exportBusy) return
    if (!open) reset()
    onOpenChange(open)
  }

  const invalid = (touched && !isValidExportReason(reason)) || reasonRefused
  const role = roleFor(Permission.AUDIT_EXPORT)
  const roleLabel = role ? t(`common.roles.${role}`) : ''

  /** Live: the file from every page of operation 59 up to the rows the export covers. */
  const buildFile = (webLive: WebLive, receipt: AuditExportReceipt, reasonText: string) => {
    const mine = generation.current
    const pages = auditPageCount(receipt.entries)
    updateFile({ status: 'reading', page: 1, pages })
    const target = { exportId: receipt.exportId, rows: receipt.entries, head: receipt.head }
    void readExportedRows(auditPageReader(webLive), target, {
      // D176: a page is asked for only while an operator is signed in (the walk checks before each one).
      signedIn: () => webLive.session != null,
      onPage: (read) => {
        if (generation.current === mine) updateFile({ status: 'reading', page: Math.min(read + 1, pages ?? read + 1), pages })
      },
    }).then(
      (rows) => {
        if (generation.current !== mine) return
        const built = buildAuditExportFile({
          exportId: receipt.exportId,
          deviceId: sim.store.getState().device.id,
          at: sim.store.getState().clock.now,
          reason: reasonText,
          rows,
        })
        const fileName = auditExportFileName(receipt.exportId)
        try {
          downloadAuditFile(fileName, built)
        } catch (caught) {
          // The file is kept: "Download again" offers it once more.
          logSecurityAudit('error', 'ExportAuditDialog.download', caught, { exportId: receipt.exportId, rows: rows.length })
        }
        updateFile({ status: 'ready', fileName, file: built })
        if (m.reduced) setPhase({ kind: 'done', receipt })
      },
      (caught: unknown) => {
        if (generation.current !== mine) return
        // W92-13: the export was accepted, so the outage sentence leaves out "Nothing was changed".
        const presented = caught instanceof AuditWalkError && caught.reason.kind === 'CALL' ? presentCoreError(caught.reason.failure, { afterAcceptedCommand: true }) : null
        if (presented === null) {
          logSecurityAudit('error', 'ExportAuditDialog.buildFile', caught, { exportId: receipt.exportId, pages: pages ?? -1 })
        }
        const message = t('securityAudit.live.exportAudit.fileFailed', { exportId: receipt.exportId })
        setError(message)
        if (presented === null) toast.danger(message)
        updateFile({ status: 'failed' })
        stopTimer()
        setPhase({ kind: 'done', receipt })
      },
    )
  }

  const refused = (outcome: Exclude<ReturnType<typeof auditExportOutcome>, { ok: true }>, reasonText: string) => {
    logSecurityAudit('warn', 'ExportAuditDialog.submit', { code: outcome.reason, status: outcome.status }, {
      status: outcome.status,
      reasonLength: reasonText.trim().length,
    })
    if (isLive && outcome.reason === 'INVALID_REASON') {
      // F59: the Core is the judge of the reason; its refusal is the field's error, the reason stays.
      setReasonRefused(true)
      return
    }
    const message =
      outcome.reason === 'FORBIDDEN'
        ? t('securityAudit.exportAudit.denied', { role: roleLabel })
        : outcome.reason === 'NOT_SIGNED_IN'
          ? t('securityAudit.exportAudit.notSignedIn')
          : outcome.reason === 'INVALID_REASON'
            ? t('securityAudit.exportAudit.reasonError', { min: AUDIT_EXPORT_REASON_MIN })
            : t('securityAudit.exportAudit.failed')
    setError(message)
    toast.danger(message)
  }

  const accepted = (receipt: AuditExportReceipt) => {
    if (live !== null) {
      // The pipeline spans the file: it holds on "Build export package" until every page is read.
      setPhase({ kind: 'running', resolved: m.reduced ? BUILD_INDEX : 0, receipt })
      buildFile(live, receipt, receipt.reason)
    } else if (m.reduced) {
      setPhase({ kind: 'done', receipt })
    } else {
      setPhase({ kind: 'running', resolved: 0, receipt })
    }
    if (!m.reduced) {
      stopTimer()
      timer.current = setInterval(() => {
        setPhase((current) => {
          if (current.kind !== 'running') return current
          const resolved = current.resolved + 1
          if (live !== null && resolved > BUILD_INDEX && fileRef.current.status !== 'ready') return current
          if (resolved >= STEP_IDS.length) {
            stopTimer()
            return { kind: 'done', receipt: current.receipt }
          }
          return { ...current, resolved }
        })
      }, m.seconds(STEP_PACE_MS) * 1000)
    }
    toast.success(t(isLive ? 'securityAudit.live.exportAudit.success' : 'securityAudit.exportAudit.success'), {
      description: t('securityAudit.exportAudit.successBody', {
        exportId: receipt.exportId,
        count: receipt.entries ?? entries,
      }),
    })
  }

  const failed = (caught: unknown, reasonText: string) => {
    const message = t('securityAudit.exportAudit.failed')
    setError(message)
    toast.danger(message)
    logSecurityAudit('error', 'ExportAuditDialog.submit', caught, { reasonLength: reasonText.trim().length })
  }

  const submit = () => {
    setTouched(true)
    setError(null)
    if (!isValidExportReason(reason)) return
    const reasonText = reason.trim()
    runExport((release) =>
      settle(() => actions.exportAudit({ reason: reasonText }), {
        ok: (result: ExportResult) => {
          try {
            const outcome = auditExportOutcome(result, sim.store.getState().audit.rows, reasonText, isLive)
            if (outcome.ok) accepted(outcome.receipt)
            else refused(outcome, reasonText)
          } catch (caught) {
            failed(caught, reasonText)
          }
        },
        fail: (caught) => {
          // Rule 2: the refusal presenter speaks first (an outage, a limit, a refusal it words).
          if (presentCoreError(caught) !== null) return
          failed(caught, reasonText)
        },
        done: release,
      }),
    )
  }

  const changeReason = (value: string) => {
    setReason(value)
    if (reasonRefused) setReasonRefused(false)
  }

  const downloadAgain = () => {
    if (file.status !== 'ready') return
    try {
      downloadAuditFile(file.fileName, file.file)
    } catch (caught) {
      logSecurityAudit('error', 'ExportAuditDialog.downloadAgain', caught, { exportId: file.file.exportId })
      toast.danger(t('common.errors.generic'))
    }
  }

  const receipt = phase.kind === 'form' ? null : phase.receipt
  const resolved = phase.kind === 'done' ? STEP_IDS.length : phase.kind === 'running' ? phase.resolved : -1
  const fileFailed = file.status === 'failed'
  const stepStatus = (index: number, id: StepId): StepperStatus => {
    if (resolved < 0) return 'pending'
    if (fileFailed && index >= BUILD_INDEX) return index === BUILD_INDEX ? 'error' : 'pending'
    if (index < resolved) return id === 'verify' && receipt?.chainOk === false ? 'warn' : 'done'
    if (index === resolved) return 'active'
    return 'pending'
  }
  const buildDescription =
    file.status === 'reading'
      ? file.pages === null
        ? t('securityAudit.live.exportAudit.readingPage', { page: file.page })
        : t('securityAudit.live.exportAudit.readingPages', { page: file.page, pages: file.pages })
      : undefined
  const steps: StepperStep[] = STEP_IDS.map((id, index) => ({
    id,
    label: t(`securityAudit.exportAudit.steps.${id}`),
    status: stepStatus(index, id),
    ...(id === 'build' && buildDescription !== undefined ? { description: <span data-testid="export-audit-pages">{buildDescription}</span> } : {}),
  }))
  const count = receipt?.entries ?? entries

  return (
    <Modal.Backdrop isOpen={isOpen} onOpenChange={close} variant="blur">
      <Modal.Container size="md" placement="center">
        <Modal.Dialog aria-label={t('securityAudit.exportAudit.title')} data-testid="export-audit-dialog">
          <Modal.Header>
            <Modal.Icon>
              <FileDown className="size-5" aria-hidden="true" />
            </Modal.Icon>
            <Modal.Heading>{t('securityAudit.exportAudit.title')}</Modal.Heading>
          </Modal.Header>
          <Modal.Body className="sa-export-body">
            <p className="sa-rule">
              {isLive ? t('securityAudit.live.exportAudit.body', { count }) : t('securityAudit.exportAudit.body', { count })}
            </p>
            {!chain.ok ? (
              <Alert status="warning">
                <Alert.Indicator />
                <Alert.Content>
                  <Alert.Description>{t('securityAudit.exportAudit.chainWarning', { seq: chain.breakSeq ?? 0 })}</Alert.Description>
                </Alert.Content>
              </Alert>
            ) : null}

            {phase.kind === 'form' ? (
              <>
                <TextField
                  isRequired
                  isInvalid={invalid}
                  value={reason}
                  onChange={changeReason}
                  onBlur={() => setTouched(true)}
                  data-testid="export-reason"
                >
                  <Label>{t('securityAudit.exportAudit.reasonLabel')}</Label>
                  <TextArea rows={3} maxLength={500} placeholder={t('securityAudit.exportAudit.reasonPlaceholder')} />
                  {reasonRefused ? (
                    <FieldError>{t('securityAudit.live.exportAudit.reasonRefused')}</FieldError>
                  ) : invalid ? (
                    <FieldError>{t('securityAudit.exportAudit.reasonError', { min: AUDIT_EXPORT_REASON_MIN })}</FieldError>
                  ) : (
                    <Description>{t('securityAudit.exportAudit.reasonHint', { min: AUDIT_EXPORT_REASON_MIN })}</Description>
                  )}
                </TextField>
                <p className="sa-rule">
                  {t('securityAudit.exportAudit.destination')}:{' '}
                  {isLive ? t('securityAudit.live.exportAudit.destinationValue') : t('securityAudit.exportAudit.destinationValue')}
                </p>
              </>
            ) : (
              <Stepper
                steps={steps}
                orientation="vertical"
                variant="pipeline"
                ariaLabel={t('securityAudit.exportAudit.title')}
              />
            )}

            {phase.kind === 'done' && receipt ? (
              <dl className="sa-export-result" data-testid="export-audit-result">
                <dt>{t('securityAudit.exportAudit.result.exportId')}</dt>
                <dd className="sa-mono">{receipt.exportId}</dd>
                <dt>{t('securityAudit.exportAudit.result.entries')}</dt>
                <dd>{receipt.entries ?? entries}</dd>
                <dt>{t('securityAudit.exportAudit.result.head')}</dt>
                <dd className="sa-mono">{receipt.head ? `${shortHash(receipt.head, 16)}…` : '—'}</dd>
                <dt>{t('securityAudit.exportAudit.result.chain')}</dt>
                <dd>{receipt.chainOk === false ? t('securityAudit.chain.fail') : t('securityAudit.chain.pass')}</dd>
                <dt>{t('securityAudit.exportAudit.result.reason')}</dt>
                <dd>
                  {receipt.reason}
                  <br />
                  <span className="sa-muted">
                    {isLive ? t('securityAudit.live.exportAudit.reasonNote') : t('securityAudit.exportAudit.result.reasonNote')}
                  </span>
                </dd>
                {file.status === 'ready' ? (
                  <>
                    <dt>{t('securityAudit.live.exportAudit.fileName')}</dt>
                    <dd className="sa-export-file" data-testid="export-audit-file" data-rows={file.file.rows.length}>
                      <span className="sa-mono">{file.fileName}</span>
                      <Button size="sm" variant="ghost" onPress={downloadAgain} data-testid="export-audit-download">
                        <Download className="size-4" aria-hidden="true" />
                        {t('securityAudit.live.exportAudit.download')}
                      </Button>
                    </dd>
                  </>
                ) : null}
              </dl>
            ) : null}

            {error ? (
              <p role="alert" className="sa-rule" style={{ color: 'var(--danger-soft-foreground)' }}>
                {error}
              </p>
            ) : null}
          </Modal.Body>
          <Modal.Footer>
            {phase.kind === 'form' ? (
              <>
                <Button variant="ghost" onPress={() => close(false)} isDisabled={exportBusy}>
                  {t('common.actions.cancel')}
                </Button>
                <Button
                  ref={exportRef}
                  variant="primary"
                  onPress={submit}
                  isPending={exportPending}
                  data-pending={exportPending ? 'true' : undefined}
                  data-testid="export-confirm"
                >
                  {exportPending ? <Spinner size="sm" color="current" aria-hidden="true" /> : null}
                  {t('securityAudit.exportAudit.confirm')}
                </Button>
              </>
            ) : (
              <Button variant="primary" onPress={() => close(false)} isDisabled={phase.kind === 'running'}>
                {phase.kind === 'running' ? t('securityAudit.exportAudit.exporting') : t('securityAudit.exportAudit.close')}
              </Button>
            )}
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  )
}
