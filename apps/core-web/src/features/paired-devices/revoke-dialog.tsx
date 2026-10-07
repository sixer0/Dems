import { useState } from 'react'
import { AlertDialog, Button, FieldError, Form, Label, Spinner, TextArea, TextField, toast } from '@heroui/react'
import { useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { PAIRING_INPUT_LIMITS, type PairedDevice, type PairedDeviceList } from '@dems/shared/api'
import { settle } from '@dems/shared/live'
import { CoreErrorNoticeKind, useCoreErrorPresenter } from '@/lib/core-errors'
import { usePendingControl } from '@/lib/pending-control'
import { CORE_QUERY_KEYS, useWebLive } from '@/runtime'
import { callFailureOf, PAIRING_PERMISSION, revokeDevice } from './live-data'
import { PAIRING_RECORD, reportPairingError } from './report'

/** Notices that close the dialog: a refusal of the role and an ended session (PG-11). An outage, a time-out and a limit keep it open with the reason (LB-6, LB-7, LB-10). */
const CLOSING_NOTICES: ReadonlySet<string> = new Set([CoreErrorNoticeKind.PERMISSION, CoreErrorNoticeKind.SIGNED_OUT, CoreErrorNoticeKind.STOPPED])

export interface RevokeDialogProps {
  /** The device to revoke; `null` closes the dialog. */
  device: PairedDevice | null
  onClose: () => void
}

/**
 * The revoke dialog (backend task 04_client_integration_spec §10.3; AC-C-98; operation 20), a kit
 * `AlertDialog` with a form in the pattern of the End Session dialog
 * (`features/session-monitor/action-bar.tsx`).
 *
 * | Answer | What the operator sees |
 * |--------|------------------------|
 * | 200 | The dialog closes; toast "{{device ID}} revoked"; the row morphs to REVOKED (the answer is written into the registry entry, then refetched) |
 * | 422 `INVALID_REASON` | The field's error ("at least 5 characters"; the Core counts the trimmed text itself, F59); the dialog stays |
 * | 422 `INVALID_INPUT` | The field's error (the Core refuses a reason of the form of a credential, as the contract says since W83: gap W32-2); the dialog stays |
 * | 409 `INVALID_STATE`, 404 | The dialog closes; info toast "already revoked or unpaired"; refetch |
 * | 403 | The dialog closes; the presenter's denied toast names the role (PG-11) |
 * | An outage, a time-out, a 429 | The presenter's words; the dialog stays open with the reason (LB-6, LB-7, LB-10) |
 *
 * The reason is never written to the page's log; only its length is.
 */
export function RevokeDialog({ device, onClose }: RevokeDialogProps) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const live = useWebLive()
  const presentCoreError = useCoreErrorPresenter()
  const { run, busy, pending, ref: confirmRef } = usePendingControl()
  const [reason, setReason] = useState('')
  const [touched, setTouched] = useState(false)
  /** The reason the Core refused with 422 and its words; the error shows while the text is unchanged. */
  const [refused, setRefused] = useState<{ text: string; message: string } | null>(null)
  const trimmed = reason.trim()
  const tooShort = trimmed.length < PAIRING_INPUT_LIMITS.revokeReasonMin
  const refusedNow = refused !== null && refused.text === trimmed
  const tooShortText = t('pairedDevices.revoke.reasonTooShort', { min: PAIRING_INPUT_LIMITS.revokeReasonMin })
  const error = touched && tooShort ? tooShortText : refusedNow ? refused.message : null

  const close = () => {
    setReason('')
    setTouched(false)
    setRefused(null)
    onClose()
  }

  const refetch = () => void queryClient.invalidateQueries({ queryKey: CORE_QUERY_KEYS.pairedDevices })

  const confirm = () => {
    setTouched(true)
    if (tooShort || device === null || live === null) return
    const deviceId = device.id
    const sent = trimmed
    // LB-1: the confirm is busy at once, its spinner after the reveal; the dialog closes in `ok`.
    run((release) =>
      settle(() => revokeDevice(live, deviceId, sent), {
        ok: (revoked) => {
          queryClient.setQueryData<PairedDeviceList>(CORE_QUERY_KEYS.pairedDevices, (list) =>
            list === undefined ? list : { devices: list.devices.map((entry) => (entry.id === revoked.id ? revoked : entry)) },
          )
          refetch()
          toast.success(t('pairedDevices.toasts.revoked', { deviceId }))
          close()
        },
        fail: (caught) => {
          const notice = presentCoreError(caught, { permission: PAIRING_PERMISSION })
          if (notice !== null) {
            if (notice.kind === CoreErrorNoticeKind.TIMED_OUT) refetch()
            if (CLOSING_NOTICES.has(notice.kind)) close()
            return
          }
          const failure = callFailureOf(caught)
          const code = failure?.error.code ?? null
          if (failure?.status === 422) {
            setRefused({ text: sent, message: code === 'INVALID_REASON' ? tooShortText : t('pairedDevices.revoke.reasonRefused') })
            return
          }
          if (failure?.status === 409 || failure?.status === 404) {
            toast.info(t('pairedDevices.toasts.alreadyEnded'))
            refetch()
            close()
            return
          }
          reportPairingError('features/paired-devices.revoke', caught, PAIRING_RECORD.revoke, {
            operationId: 'revokeDevice',
            deviceId,
            code,
            status: failure?.status ?? null,
            reasonLength: sent.length,
          })
          toast.danger(t('pairedDevices.toasts.revokeFailed'))
          close()
        },
        done: release,
      }),
    )
  }

  return (
    <AlertDialog.Backdrop isOpen={device !== null} onOpenChange={(open) => (open ? undefined : busy ? undefined : close())}>
      <AlertDialog.Container size="md">
        <AlertDialog.Dialog aria-label={t('pairedDevices.revoke.title')} data-testid="pd-revoke-dialog">
          <AlertDialog.Header>
            <AlertDialog.Icon status="danger" />
            <AlertDialog.Heading>{t('pairedDevices.revoke.title')}</AlertDialog.Heading>
          </AlertDialog.Header>
          <Form
            onSubmit={(event) => {
              event.preventDefault()
              confirm()
            }}
          >
            <AlertDialog.Body className="flex flex-col gap-4">
              <p className="text-body text-foreground-2">{t('pairedDevices.revoke.body', { deviceId: device?.id ?? '' })}</p>
              <TextField
                value={reason}
                onChange={setReason}
                isRequired
                // The page validates on submit with its own words (§10.3): the browser's own check of
                // an empty required field would stop the submit before it.
                validationBehavior="aria"
                isInvalid={error !== null}
                maxLength={PAIRING_INPUT_LIMITS.revokeReasonMax}
                name="reason"
                autoFocus
              >
                <Label>{t('pairedDevices.revoke.reasonLabel')}</Label>
                <TextArea rows={3} placeholder={t('pairedDevices.revoke.reasonPlaceholder')} data-testid="pd-revoke-reason" />
                <FieldError>{error}</FieldError>
              </TextField>
            </AlertDialog.Body>
            <AlertDialog.Footer>
              <Button variant="ghost" onPress={close} isDisabled={busy} data-testid="pd-revoke-cancel">
                {t('pairedDevices.revoke.keep')}
              </Button>
              <Button ref={confirmRef} type="submit" variant="danger" isPending={pending} data-busy={busy || undefined} data-testid="pd-revoke-confirm">
                {pending ? <Spinner size="sm" color="current" /> : null}
                {t('pairedDevices.revoke.confirm')}
              </Button>
            </AlertDialog.Footer>
          </Form>
        </AlertDialog.Dialog>
      </AlertDialog.Container>
    </AlertDialog.Backdrop>
  )
}
