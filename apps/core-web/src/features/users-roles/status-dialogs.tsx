import { useState } from 'react'
import { Alert, AlertDialog, Button, Description, Label, Spinner, TextArea, TextField } from '@heroui/react'
import { useTranslation } from 'react-i18next'
import { ADMIN_REASON_MAX_LENGTH, type AdminUser } from '@dems/shared/api'
import { usePendingControl, type PendingControl } from '@/lib/pending-control'
import { useAdminCommand } from './commands'

export interface StatusDialogProps {
  readonly isOpen: boolean
  /** The operator; kept while the dialog plays its exit. */
  readonly target: AdminUser | null
  readonly selfId: string | null
  readonly linkUp: boolean
  readonly onClose: () => void
}

/**
 * "Disable user" (backend task 04_client_integration_spec §10.2 "Enable and disable"; AC-C-89; plan
 * row W77): a kit `AlertDialog` with status `danger`, in the pattern of
 * `features/session-new/cancel-dialog.tsx`. On the caller's own row it warns first: "You will be
 * signed out." A 409 `LAST_ADMIN` shows the hint's sentence inline and changes nothing; the menu
 * item is also disabled by the hint. A 200 closes it; the row's status chip morphs to Disabled with
 * one halo (an escalation).
 */
export function DisableDialog({ isOpen, target, selfId, linkUp, onClose }: StatusDialogProps) {
  const { t } = useTranslation()
  const control = usePendingControl()
  return (
    <AlertDialog.Backdrop
      isOpen={isOpen}
      onOpenChange={(open) => {
        if (!open && !control.busy) onClose()
      }}
      isDismissable={!control.busy}
    >
      <AlertDialog.Container size="sm">
        <AlertDialog.Dialog aria-label={t('usersRoles.disableDialog.title')} data-testid="ur-disable-dialog">
          {target === null ? null : <DisableBody key={target.id} target={target} selfId={selfId} linkUp={linkUp} onClose={onClose} control={control} />}
        </AlertDialog.Dialog>
      </AlertDialog.Container>
    </AlertDialog.Backdrop>
  )
}

type InlineError = 'lastAdmin' | 'invalid' | null

function DisableBody({
  target,
  selfId,
  linkUp,
  onClose,
  control,
}: Omit<StatusDialogProps, 'isOpen' | 'target'> & { readonly target: AdminUser; readonly control: PendingControl }) {
  const { t } = useTranslation()
  const send = useAdminCommand()
  const { busy, pending, ref } = control
  const [reason, setReason] = useState('')
  const [error, setError] = useState<InlineError>(null)

  const confirm = () => {
    if (!linkUp) return
    setError(null)
    send(control, { kind: 'disable', target, reason }, (outcome) => {
      if (outcome.kind === 'done' || outcome.kind === 'closeDialog') onClose()
      else if (outcome.kind === 'lastAdmin' || outcome.kind === 'invalid') setError(outcome.kind)
    })
  }

  return (
    <>
      <AlertDialog.Header>
        <AlertDialog.Icon status="danger" />
        <AlertDialog.Heading>{t('usersRoles.disableDialog.title')}</AlertDialog.Heading>
      </AlertDialog.Header>
      <AlertDialog.Body className="ur-dialog-body">
        <p className="ur-dialog-text">{t('usersRoles.disableDialog.body', { name: target.displayName })}</p>
        {selfId === target.id ? (
          <Alert status="warning" data-testid="ur-disable-own">
            <Alert.Indicator />
            <Alert.Content>
              <Alert.Description>{t('usersRoles.disableDialog.ownRow')}</Alert.Description>
            </Alert.Content>
          </Alert>
        ) : null}
        <TextField value={reason} onChange={setReason} data-testid="ur-disable-reason">
          <Label>{t('usersRoles.disableDialog.reasonLabel')}</Label>
          <TextArea rows={2} maxLength={ADMIN_REASON_MAX_LENGTH} />
          <Description>{t('usersRoles.disableDialog.reasonHint', { max: ADMIN_REASON_MAX_LENGTH })}</Description>
        </TextField>
        {error === null ? null : (
          <Alert status="danger" data-testid="ur-disable-error" data-error={error}>
            <Alert.Indicator />
            <Alert.Content>
              <Alert.Description>{error === 'lastAdmin' ? t('usersRoles.lastAdmin') : t('usersRoles.disableDialog.invalid')}</Alert.Description>
            </Alert.Content>
          </Alert>
        )}
      </AlertDialog.Body>
      <AlertDialog.Footer>
        <Button variant="ghost" onPress={onClose} isDisabled={busy} data-testid="ur-disable-cancel">
          {t('common.actions.cancel')}
        </Button>
        <Button ref={ref} variant="danger" onPress={confirm} isDisabled={!linkUp} isPending={pending} data-testid="ur-disable-confirm">
          {pending ? <Spinner size="sm" color="current" aria-hidden="true" /> : null}
          {t('usersRoles.disableDialog.confirm')}
        </Button>
      </AlertDialog.Footer>
    </>
  )
}

/**
 * "Enable user" (§10.2; AC-C-89): a kit `AlertDialog` with a neutral status and no reason, as the
 * specification draws it. A 200 closes it; the status chip changes colour only (no halo: a
 * de-escalation).
 */
export function EnableDialog({ isOpen, target, linkUp, onClose }: Omit<StatusDialogProps, 'selfId'>) {
  const { t } = useTranslation()
  const control = usePendingControl()
  const { busy, pending, ref } = control
  const send = useAdminCommand()

  const confirm = () => {
    if (target === null || !linkUp) return
    send(control, { kind: 'enable', target }, (outcome) => {
      if (outcome.kind === 'done' || outcome.kind === 'closeDialog') onClose()
    })
  }

  return (
    <AlertDialog.Backdrop
      isOpen={isOpen}
      onOpenChange={(open) => {
        if (!open && !busy) onClose()
      }}
      isDismissable={!busy}
    >
      <AlertDialog.Container size="sm">
        <AlertDialog.Dialog aria-label={t('usersRoles.enableDialog.title')} data-testid="ur-enable-dialog">
          <AlertDialog.Header>
            <AlertDialog.Icon status="default" />
            <AlertDialog.Heading>{t('usersRoles.enableDialog.title')}</AlertDialog.Heading>
          </AlertDialog.Header>
          <AlertDialog.Body className="ur-dialog-body">
            <p className="ur-dialog-text">{target === null ? null : t('usersRoles.enableDialog.body', { name: target.displayName })}</p>
          </AlertDialog.Body>
          <AlertDialog.Footer>
            <Button variant="ghost" onPress={onClose} isDisabled={busy} data-testid="ur-enable-cancel">
              {t('common.actions.cancel')}
            </Button>
            <Button ref={ref} variant="primary" onPress={confirm} isDisabled={!linkUp} isPending={pending} data-testid="ur-enable-confirm">
              {pending ? <Spinner size="sm" color="current" aria-hidden="true" /> : null}
              {t('usersRoles.enableDialog.confirm')}
            </Button>
          </AlertDialog.Footer>
        </AlertDialog.Dialog>
      </AlertDialog.Container>
    </AlertDialog.Backdrop>
  )
}
