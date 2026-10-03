import { useEffect, useRef, useState } from 'react'
import { Alert, Button, Description, FieldError, Label, Modal, TextArea, TextField, toast } from '@heroui/react'
import { FileDown } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Permission, useSim, useSimInstance } from '@dems/shared/sim'
import { Stepper, type StepperStatus, type StepperStep } from '@/components/composed/stepper'
import { useMotionPolicy } from '@/motion'
import { logSecurityAudit } from './log'
import { roleFor, shortHash, type ChainReport } from './model'
import { AUDIT_EXPORT_REASON_MIN, exportAuditWithReason, isValidExportReason, type AuditExportReceipt } from './sim-adapter'

/** Chain-of-custody steps (design book §19.3: authorize → verify → build → hash → audit event). */
const STEP_IDS = ['authorize', 'verify', 'build', 'seal', 'record'] as const
type StepId = (typeof STEP_IDS)[number]
/** Steps resolve one after another at this pace (UI choreography of one synchronous sim call). */
const STEP_PACE_MS = 220

type Phase =
  | { kind: 'form' }
  | { kind: 'running'; resolved: number; receipt: AuditExportReceipt }
  | { kind: 'done'; receipt: AuditExportReceipt }

export interface ExportAuditDialogProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  chain: ChainReport
}

/**
 * "Export audit" dialog (01_specs §14.5.7 Export audit; design book §19.2 item 8, §19.3; S20,
 * S21). A reason is mandatory (≥ 5 characters, validated inline). On Export the simulator's
 * `exportAudit({ reason })` runs once through `exportAuditWithReason`; the Stepper then
 * resolves the custody steps in order and the result shows the export ID, the entry count and
 * the chain head recorded in the new AUDIT_EXPORTED row. Errors: a friendly toast and inline
 * message (layer 1), a structured log record (layer 2), the dialog stays usable (layer 3).
 */
export function ExportAuditDialog({ isOpen, onOpenChange, chain }: ExportAuditDialogProps) {
  const { t } = useTranslation()
  const m = useMotionPolicy()
  const sim = useSimInstance()
  const entries = useSim((s) => s.audit.rows.length)
  const [reason, setReason] = useState('')
  const [touched, setTouched] = useState(false)
  const [phase, setPhase] = useState<Phase>({ kind: 'form' })
  const [error, setError] = useState<string | null>(null)
  const timer = useRef<ReturnType<typeof setInterval> | null>(null)

  const stopTimer = () => {
    if (timer.current !== null) clearInterval(timer.current)
    timer.current = null
  }
  useEffect(() => stopTimer, [])

  const reset = () => {
    stopTimer()
    setReason('')
    setTouched(false)
    setError(null)
    setPhase({ kind: 'form' })
  }

  const close = (open: boolean) => {
    if (!open) reset()
    onOpenChange(open)
  }

  const invalid = touched && !isValidExportReason(reason)
  const role = roleFor(Permission.AUDIT_EXPORT)
  const roleLabel = role ? t(`common.roles.${role}`) : ''

  const submit = () => {
    setTouched(true)
    setError(null)
    if (!isValidExportReason(reason)) return
    try {
      const outcome = exportAuditWithReason(sim, reason)
      if (!outcome.ok) {
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
        logSecurityAudit('warn', 'ExportAuditDialog.submit', `export refused: ${outcome.reason}`, {
          status: outcome.status,
          reasonLength: reason.trim().length,
        })
        return
      }
      const { receipt } = outcome
      if (m.reduced) {
        setPhase({ kind: 'done', receipt })
      } else {
        setPhase({ kind: 'running', resolved: 0, receipt })
        stopTimer()
        timer.current = setInterval(() => {
          setPhase((current) => {
            if (current.kind !== 'running') return current
            const resolved = current.resolved + 1
            if (resolved >= STEP_IDS.length) {
              stopTimer()
              return { kind: 'done', receipt: current.receipt }
            }
            return { ...current, resolved }
          })
        }, m.seconds(STEP_PACE_MS) * 1000)
      }
      toast.success(t('securityAudit.exportAudit.success'), {
        description: t('securityAudit.exportAudit.successBody', {
          exportId: receipt.exportId,
          count: receipt.entries ?? entries,
        }),
      })
    } catch (caught) {
      const message = t('securityAudit.exportAudit.failed')
      setError(message)
      toast.danger(message)
      logSecurityAudit('error', 'ExportAuditDialog.submit', caught, { reasonLength: reason.trim().length })
    }
  }

  const receipt = phase.kind === 'form' ? null : phase.receipt
  const resolved = phase.kind === 'done' ? STEP_IDS.length : phase.kind === 'running' ? phase.resolved : -1
  const stepStatus = (index: number, id: StepId): StepperStatus => {
    if (resolved < 0) return 'pending'
    if (index < resolved) return id === 'verify' && receipt?.chainOk === false ? 'warn' : 'done'
    if (index === resolved) return 'active'
    return 'pending'
  }
  const steps: StepperStep[] = STEP_IDS.map((id, index) => ({
    id,
    label: t(`securityAudit.exportAudit.steps.${id}`),
    status: stepStatus(index, id),
  }))

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
            <p className="sa-rule">{t('securityAudit.exportAudit.body', { count: receipt?.entries ?? entries })}</p>
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
                  onChange={setReason}
                  onBlur={() => setTouched(true)}
                  data-testid="export-reason"
                >
                  <Label>{t('securityAudit.exportAudit.reasonLabel')}</Label>
                  <TextArea rows={3} maxLength={500} placeholder={t('securityAudit.exportAudit.reasonPlaceholder')} />
                  {invalid ? (
                    <FieldError>{t('securityAudit.exportAudit.reasonError', { min: AUDIT_EXPORT_REASON_MIN })}</FieldError>
                  ) : (
                    <Description>{t('securityAudit.exportAudit.reasonHint', { min: AUDIT_EXPORT_REASON_MIN })}</Description>
                  )}
                </TextField>
                <p className="sa-rule">
                  {t('securityAudit.exportAudit.destination')}: {t('securityAudit.exportAudit.destinationValue')}
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
                  <span className="sa-muted">{t('securityAudit.exportAudit.result.reasonNote')}</span>
                </dd>
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
                <Button variant="ghost" onPress={() => close(false)}>
                  {t('common.actions.cancel')}
                </Button>
                <Button variant="primary" onPress={submit} data-testid="export-confirm">
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
