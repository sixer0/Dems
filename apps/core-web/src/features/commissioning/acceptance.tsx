/**
 * The installation acceptance and its revocation (task 4, blueprint row 118, derived; operations
 * 109 `acceptInstallation` and 110 `revokeInstallationAcceptance`; contract record
 * `implementation/116_acceptance_contract.md`, routes `implementation/117_acceptance_ops.md`;
 * decisions U10, U11, C2, C80). One panel of `/admin/commissioning`, TECHNICIAN only: the page
 * draws it only behind its role gate, so it is absent for a role without `CAPTURE_COMMISSION`.
 *
 * | Part | What it is |
 * |------|------------|
 * | The standing sentences | RECORDING IS NOT GATED ON AN ACCEPTANCE (a session starts whether or not one is in force, a revocation stops nothing); what the Core records by itself; that the console cannot read whether an acceptance is in force |
 * | "Record an acceptance" | The site address (optional) and the steps: a tick and a one-line note each. Nothing else can be typed, because the contract has no member for anything else |
 * | "Revoke the acceptance in force" | The reason, 5 to 500 characters. No id: the Core revokes the one in force |
 * | The answered record | What the Core stored, as the last answer of this page states it. Texts an operator typed are drawn as text only |
 *
 * EVERY REFUSAL WITH ITS SENTENCE: the contract's own for its six reasons
 * (`INSTALLATION_ACCEPTANCE_REFUSAL_SENTENCES`), this console's for an open session, the role, a
 * body not accepted and an unanswered request. Never the answer's text.
 *
 * Kit: `@heroui/react` (Alert, Button, Checkbox, TextArea, TextField), react-hook-form with the
 * zod resolver.
 */
import { useState, type FormEvent } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { Button, Checkbox, Description, FieldError, Input, Label, Spinner, TextArea, TextField, toast } from '@heroui/react'
import { ClipboardCheck } from 'lucide-react'
import { Controller, useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { INSTALLATION_ACCEPTANCE_LIMITS, INSTALLATION_ACCEPTANCE_REFUSAL_SENTENCES, type InstallationAcceptance } from '@dems/shared/api'
import { DATE_PATTERNS, formatDate } from '@dems/shared/realtime'
import { usePendingControl } from '@/lib/pending-control'
import {
  ACCEPTANCE_STEP_IDS,
  acceptBodyOf,
  acceptInstallation,
  acceptanceFormSchema,
  acceptancePassedCount,
  acceptanceRefusal,
  acceptanceStepTitle,
  emptyAcceptanceForm,
  revokeBodyOf,
  revokeFormSchema,
  revokeInstallationAcceptance,
  type AcceptanceFormValues,
  type AcceptanceRefusal,
  type RevokeFormValues,
} from './acceptance-model'
import type { CommissioningFailure, CommissioningTarget } from './model'
import { Panel, SentenceAlert } from './parts'
import { usePresentUnworded } from './refusal'
import { COMMISSIONING_RECORD, reportCommissioningError } from './report'

const L = INSTALLATION_ACCEPTANCE_LIMITS

/** The sentence of a refusal: the contract's own for its six reasons, this console's for the rest. */
function useAcceptanceSentence(): (refusal: AcceptanceRefusal) => string {
  const { t } = useTranslation()
  return (refusal) => (refusal.kind === 'REASON' ? INSTALLATION_ACCEPTANCE_REFUSAL_SENTENCES[refusal.reason] : t(`web.commissioning.acceptance.refusal.${refusal.kind}`))
}

/** Classes a failed request and hands what the panel does not word to the shared presenter. */
function useAcceptanceRefused(): (failure: CommissioningFailure) => AcceptanceRefusal {
  const presentUnworded = usePresentUnworded()
  return (failure) => {
    const refusal = acceptanceRefusal(failure)
    if (refusal.kind === 'OTHER') presentUnworded(failure)
    return refusal
  }
}

function AcceptanceRefusalAlert({ refusal, testId }: { refusal: AcceptanceRefusal | null; testId: string }) {
  const sentenceOf = useAcceptanceSentence()
  if (refusal === null) return null
  return <SentenceAlert sentence={sentenceOf(refusal)} tone={refusal.kind === 'OTHER' ? 'danger' : 'warning'} testId={testId} kind={refusal.kind} reason={refusal.kind === 'REASON' ? refusal.reason : undefined} />
}

export function AcceptancePanel({ target }: { target: CommissioningTarget }) {
  const { t } = useTranslation()
  /** The record of the last answer of THIS page. No read exists (decision C80): before an answer the page knows nothing. */
  const [record, setRecord] = useState<InstallationAcceptance | null>(null)
  return (
    <Panel id="acceptance" icon={ClipboardCheck} title={t('web.commissioning.acceptance.title')}>
      <p data-testid="com-acceptance-not-gated">{t('web.commissioning.acceptance.notGated')}</p>
      <p className="com-text">{t('web.commissioning.acceptance.intro')}</p>
      <p className="com-text" data-testid="com-acceptance-no-read">
        {t('web.commissioning.acceptance.noRead')}
      </p>
      {target.live === null ? (
        // SIMULATOR-ONLY: the simulator keeps no installation record; both requests are answered as refused.
        <p className="com-text" data-testid="com-acceptance-simulated">
          {t('web.commissioning.acceptance.simulated')}
        </p>
      ) : null}
      {record === null ? null : <AcceptanceRecord record={record} />}
      <AcceptForm target={target} onStored={setRecord} />
      <RevokeForm target={target} onStored={setRecord} />
    </Panel>
  )
}

// ── The answered record ──────────────────────────────────────────────────────────────────

function AcceptanceRecord({ record }: { record: InstallationAcceptance }) {
  const { t } = useTranslation()
  const inForce = record.revokedAt === null
  const passed = acceptancePassedCount(record.steps)
  const at = (ms: number) => formatDate(ms, DATE_PATTERNS.dateTime)
  return (
    <div className="com-card-body" data-testid="com-acceptance-record" data-acceptance={record.acceptanceId} data-in-force={inForce ? 'true' : 'false'}>
      <SentenceAlert
        sentence={inForce ? t('web.commissioning.acceptance.record.inForce') : t('web.commissioning.acceptance.record.revoked')}
        tone={inForce ? 'success' : 'accent'}
        testId="com-acceptance-record-state"
      />
      <dl className="com-facts">
        <div>
          <dt>{t('web.commissioning.acceptance.record.acceptedAt')}</dt>
          <dd className="font-mono">{at(record.acceptedAt)}</dd>
        </div>
        <div>
          <dt>{t('web.commissioning.acceptance.record.acceptedBy')}</dt>
          <dd className="font-mono">{record.acceptedBy}</dd>
        </div>
        <div>
          <dt>{t('web.commissioning.acceptance.record.softwareVersion')}</dt>
          <dd>
            <bdi>{record.softwareVersion}</bdi>
          </dd>
        </div>
        <div>
          <dt>{t('web.commissioning.acceptance.record.core')}</dt>
          <dd>
            <bdi>{[record.coreDeviceId, record.siteName, record.room].join(' · ')}</bdi>
          </dd>
        </div>
        <div>
          <dt>{t('web.commissioning.acceptance.record.steps')}</dt>
          <dd data-testid="com-acceptance-record-steps">{t('web.commissioning.acceptance.record.stepsPassed', { passed, count: record.steps.length })}</dd>
        </div>
        <div>
          <dt>{t('web.commissioning.acceptance.record.diagnostics')}</dt>
          <dd className="font-mono">{record.diagnostics.id}</dd>
        </div>
        {record.siteAddress === null ? null : (
          <div>
            <dt>{t('web.commissioning.acceptance.record.siteAddress')}</dt>
            {/* As the operator typed it, several lines allowed: text only. */}
            <dd className="com-lines" data-testid="com-acceptance-record-address">
              <bdi>{record.siteAddress}</bdi>
            </dd>
          </div>
        )}
        {record.revokedAt === null ? null : (
          <>
            <div>
              <dt>{t('web.commissioning.acceptance.record.revokedAt')}</dt>
              <dd className="font-mono">{at(record.revokedAt)}</dd>
            </div>
            <div>
              <dt>{t('web.commissioning.acceptance.record.revokedBy')}</dt>
              <dd className="font-mono">{record.revokedBy}</dd>
            </div>
            <div>
              <dt>{t('web.commissioning.acceptance.record.revokeReason')}</dt>
              <dd className="com-lines" data-testid="com-acceptance-record-reason">
                <bdi>{record.revokeReason}</bdi>
              </dd>
            </div>
          </>
        )}
      </dl>
    </div>
  )
}

// ── Record an acceptance (operation 109) ─────────────────────────────────────────────────

function AcceptForm({ target, onStored }: { target: CommissioningTarget; onStored: (record: InstallationAcceptance) => void }) {
  const { t } = useTranslation()
  const refused = useAcceptanceRefused()
  const control = usePendingControl()
  const { ref: acceptRef } = control
  const [refusal, setRefusal] = useState<AcceptanceRefusal | null>(null)
  const form = useForm<AcceptanceFormValues>({ resolver: zodResolver(acceptanceFormSchema), mode: 'onTouched', defaultValues: emptyAcceptanceForm() })

  const onValid = (values: AcceptanceFormValues) => {
    setRefusal(null)
    const body = acceptBodyOf(values)
    if (body === null) {
      // Outside the contract's schema as a whole (the steps larger than their bound): nothing leaves the page.
      setRefusal({ kind: 'INVALID_INPUT' })
      return
    }
    control.run((release) => {
      void acceptInstallation(target, body)
        .then((answer) => {
          if (answer.ok) {
            onStored(answer.data)
            form.reset(emptyAcceptanceForm())
            toast.success(t('web.commissioning.acceptance.accept.stored'))
            return
          }
          setRefusal(refused(answer))
        })
        .catch((error: unknown) => {
          reportCommissioningError('features/commissioning.acceptance', error, COMMISSIONING_RECORD.threw, { operationId: 'acceptInstallation' })
          setRefusal({ kind: 'OTHER' })
        })
        .finally(release)
    })
  }

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    void form.handleSubmit(onValid)()
  }

  return (
    <form className="com-form" onSubmit={onSubmit} noValidate data-testid="com-acceptance-form">
      <h3 className="com-subtitle">{t('web.commissioning.acceptance.accept.title')}</h3>
      <p className="com-text" data-testid="com-acceptance-core-facts">
        {t('web.commissioning.acceptance.accept.coreFacts')}
      </p>
      <Controller
        control={form.control}
        name="siteAddress"
        render={({ field, fieldState }) => (
          <TextField name={field.name} value={field.value} onChange={field.onChange} onBlur={field.onBlur} isInvalid={fieldState.invalid} isDisabled={control.busy}>
            <Label>{t('web.commissioning.acceptance.accept.siteAddress.label')}</Label>
            <TextArea ref={field.ref} rows={3} autoComplete="off" data-testid="com-acceptance-site-address" />
            {fieldState.invalid ? (
              <FieldError data-testid="com-acceptance-site-address-error">{t('web.commissioning.acceptance.accept.siteAddress.error', { max: L.siteAddressMax })}</FieldError>
            ) : (
              <Description>{t('web.commissioning.acceptance.accept.siteAddress.hint', { max: L.siteAddressMax })}</Description>
            )}
          </TextField>
        )}
      />
      <fieldset className="com-steps" data-testid="com-acceptance-steps">
        <legend className="com-text">{t('web.commissioning.acceptance.accept.stepsLegend')}</legend>
        {ACCEPTANCE_STEP_IDS.map((id, index) => (
          <div key={id} className="com-step" data-testid={`com-acceptance-step-${id}`}>
            <Controller
              control={form.control}
              name={`steps.${index}.passed`}
              render={({ field }) => (
                <Checkbox isSelected={field.value} onChange={field.onChange} isDisabled={control.busy} data-testid={`com-acceptance-passed-${id}`}>
                  <Checkbox.Content>
                    <Checkbox.Control>
                      <Checkbox.Indicator />
                    </Checkbox.Control>
                    {/* The check's id and title are THE CONTRACT'S (row V6): the id of the hardware acceptance package, then its words. */}
                    <Label>
                      <span className="font-mono">{id}</span> {acceptanceStepTitle(id)}
                    </Label>
                  </Checkbox.Content>
                </Checkbox>
              )}
            />
            <Controller
              control={form.control}
              name={`steps.${index}.notRun`}
              render={({ field }) => (
                <Checkbox isSelected={field.value} onChange={field.onChange} isDisabled={control.busy} data-testid={`com-acceptance-notrun-${id}`}>
                  <Checkbox.Content>
                    <Checkbox.Control>
                      <Checkbox.Indicator />
                    </Checkbox.Control>
                    <Label>{t('web.commissioning.acceptance.accept.notRun')}</Label>
                  </Checkbox.Content>
                </Checkbox>
              )}
            />
            <Controller
              control={form.control}
              name={`steps.${index}.detail`}
              render={({ field, fieldState }) => (
                <TextField name={field.name} value={field.value} onChange={field.onChange} onBlur={field.onBlur} isInvalid={fieldState.invalid} isDisabled={control.busy} aria-label={t('web.commissioning.acceptance.accept.detail.label', { step: `${id} ${acceptanceStepTitle(id)}` })}>
                  <Input ref={field.ref} autoComplete="off" placeholder={t('web.commissioning.acceptance.accept.detail.placeholder')} data-testid={`com-acceptance-detail-${id}`} />
                  {fieldState.invalid ? <FieldError data-testid={`com-acceptance-detail-error-${id}`}>{t('web.commissioning.acceptance.accept.detail.error', { max: L.textMax })}</FieldError> : null}
                </TextField>
              )}
            />
          </div>
        ))}
      </fieldset>
      <AcceptanceRefusalAlert refusal={refusal} testId="com-acceptance-refusal" />
      <div>
        <Button ref={acceptRef} type="submit" variant="primary" isPending={control.pending} data-testid="com-acceptance-submit">
          {control.pending ? <Spinner size="sm" color="current" aria-hidden="true" /> : null}
          {t('web.commissioning.acceptance.accept.action')}
        </Button>
      </div>
    </form>
  )
}

// ── Revoke the acceptance in force (operation 110) ───────────────────────────────────────

function RevokeForm({ target, onStored }: { target: CommissioningTarget; onStored: (record: InstallationAcceptance) => void }) {
  const { t } = useTranslation()
  const refused = useAcceptanceRefused()
  const control = usePendingControl()
  const { ref: revokeRef } = control
  const [refusal, setRefusal] = useState<AcceptanceRefusal | null>(null)
  const form = useForm<RevokeFormValues>({ resolver: zodResolver(revokeFormSchema), mode: 'onTouched', defaultValues: { reason: '' } })

  const onValid = (values: RevokeFormValues) => {
    setRefusal(null)
    const body = revokeBodyOf(values)
    if (body === null) {
      setRefusal({ kind: 'INVALID_INPUT' })
      return
    }
    control.run((release) => {
      void revokeInstallationAcceptance(target, body)
        .then((answer) => {
          if (answer.ok) {
            onStored(answer.data)
            form.reset({ reason: '' })
            toast.success(t('web.commissioning.acceptance.revoke.stored'))
            return
          }
          setRefusal(refused(answer))
        })
        .catch((error: unknown) => {
          reportCommissioningError('features/commissioning.acceptance', error, COMMISSIONING_RECORD.threw, { operationId: 'revokeInstallationAcceptance' })
          setRefusal({ kind: 'OTHER' })
        })
        .finally(release)
    })
  }

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    void form.handleSubmit(onValid)()
  }

  return (
    <form className="com-form" onSubmit={onSubmit} noValidate data-testid="com-revoke-form">
      <h3 className="com-subtitle">{t('web.commissioning.acceptance.revoke.title')}</h3>
      <p className="com-text">{t('web.commissioning.acceptance.revoke.intro')}</p>
      <Controller
        control={form.control}
        name="reason"
        render={({ field, fieldState }) => (
          <TextField name={field.name} value={field.value} onChange={field.onChange} onBlur={field.onBlur} isInvalid={fieldState.invalid} isDisabled={control.busy}>
            <Label>{t('web.commissioning.acceptance.revoke.reason.label')}</Label>
            <TextArea ref={field.ref} rows={2} autoComplete="off" data-testid="com-revoke-reason" />
            {fieldState.invalid ? (
              <FieldError data-testid="com-revoke-reason-error">{t('web.commissioning.acceptance.revoke.reason.error', { min: L.revokeReasonMin, max: L.revokeReasonMax })}</FieldError>
            ) : (
              <Description>{t('web.commissioning.acceptance.revoke.reason.hint', { min: L.revokeReasonMin, max: L.revokeReasonMax })}</Description>
            )}
          </TextField>
        )}
      />
      <AcceptanceRefusalAlert refusal={refusal} testId="com-revoke-refusal" />
      <div>
        <Button ref={revokeRef} type="submit" variant="outline" isPending={control.pending} data-testid="com-revoke-submit">
          {control.pending ? <Spinner size="sm" color="current" aria-hidden="true" /> : null}
          {t('web.commissioning.acceptance.revoke.action')}
        </Button>
      </div>
    </form>
  )
}
