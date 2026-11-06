/**
 * The three vendor-only dialogs of Users & Roles: "Add user", "Edit profile" and "Delete user"
 * (operations 15, 16 and 17 of `@dems/shared/api/administration.ts`; RB-9 as amended 02-11-2026).
 * The page renders them only for the signed-in `root` account (`model.ts` `isVendorRoot`); the
 * server checks the same rule, so a dialog opened by anyone else would close on its 403 (PG-11).
 *
 * In the pattern of the two dialog files this one joins:
 * - `role-dialog.tsx` for a form: a kit `Modal` `md`, the reason field, the inline `Alert` of a
 *   refusal, and LB-1 busy through `usePendingControl()` — `aria-busy` on the confirm from the
 *   press, the kit's pending look late, a second press sends nothing, no dismissal while it is out.
 * - `status-dialogs.tsx` for the destructive one: a kit `AlertDialog` `danger`, the own-row warning.
 * - Per-field errors in the one pattern the console has (`features/commissioning/set-ip.tsx`:
 *   `isInvalid` on the `TextField`, a `FieldError` in place of its `Description`). They are computed
 *   on the press from `account-form.ts`, which mirrors the contract's bounds; the server's 422 stays
 *   the judge for anything that passes here.
 *
 * A create with no password is a success, not a warning: the account exists and cannot sign in until
 * one is set, which is what the toast says (`usersRoles.toasts.createdNoPassword`).
 */
import { useState } from 'react'
import { Alert, AlertDialog, Button, Description, FieldError, Input, Label, Modal, Radio, RadioGroup, Spinner, TextArea, TextField } from '@heroui/react'
import { Trash, UserPlus, UserRoundPen } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { ADMIN_REASON_MAX_LENGTH, OPERATOR_INITIALS_MAX_LENGTH, OPERATOR_NAME_MAX_LENGTH, type AdminUser, type RoleMatrix } from '@dems/shared/api'
import { usePendingControl, type PendingControl } from '@/lib/pending-control'
import { useAdminCommand } from './commands'
import {
  OPERATOR_USERNAME_MAX_LENGTH,
  draftOf,
  EMPTY_DRAFT,
  normalizeUsername,
  OPERATOR_RANK_MAX_LENGTH,
  profileChanged,
  validateCreate,
  validateDelete,
  validateEdit,
  type FieldErrors,
  type ProfileDraft,
  type ProfileField,
} from './account-form'
import { rolesOf } from './model'

/** What an inline refusal of these dialogs says. */
type InlineError = 'invalid' | 'lastAdmin' | 'invalidState' | null

/** One text field of a profile form, with the per-field error of `set-ip.tsx`. */
function ProfileFieldRow({
  testId,
  label,
  hint,
  value,
  onChange,
  error,
  disabled,
  mono = false,
  maxLength,
  autoComplete = 'off',
  type = 'text',
}: {
  readonly testId: string
  readonly label: string
  readonly hint: string
  readonly value: string
  readonly onChange: (value: string) => void
  readonly error?: string
  readonly disabled: boolean
  readonly mono?: boolean
  readonly maxLength?: number
  readonly autoComplete?: string
  readonly type?: string
}) {
  return (
    <TextField
      type={type}
      value={value}
      onChange={onChange}
      isInvalid={error !== undefined}
      isDisabled={disabled}
      autoComplete={autoComplete}
      data-testid={testId}
    >
      <Label>{label}</Label>
      <Input className={mono ? 'ur-mono' : undefined} spellCheck={false} autoCapitalize="off" autoCorrect="off" maxLength={maxLength} />
      {error === undefined ? <Description>{hint}</Description> : <FieldError data-testid={`${testId}-error`}>{error}</FieldError>}
    </TextField>
  )
}

/** The five fields a create and an edit share (a create adds the role and the password above them). */
function ProfileFields({
  prefix,
  draft,
  errors,
  onChange,
  disabled,
  displayNameHint,
  showUsername,
}: {
  readonly prefix: string
  readonly draft: ProfileDraft
  readonly errors: FieldErrors
  readonly onChange: (field: ProfileField, value: string) => void
  readonly disabled: boolean
  readonly displayNameHint: string
  readonly showUsername: boolean
}) {
  const { t } = useTranslation()
  const errorOf = (field: ProfileField, label: string): string | undefined => {
    const problem = errors[field]
    if (problem === undefined) return undefined
    switch (problem) {
      case 'required':
        return t('usersRoles.fields.errors.required', { label })
      case 'username':
        return t('usersRoles.fields.errors.username', { max: OPERATOR_USERNAME_MAX_LENGTH })
      case 'name':
        return t('usersRoles.fields.errors.name', { label, max: OPERATOR_NAME_MAX_LENGTH })
      case 'initials':
        return t('usersRoles.fields.errors.initials', { max: OPERATOR_INITIALS_MAX_LENGTH })
      case 'rank':
        return t('usersRoles.fields.errors.rank', { max: OPERATOR_RANK_MAX_LENGTH })
      case 'usernameTaken':
        return t('usersRoles.fields.errors.usernameTaken')
      case 'confirmMismatch':
        return t('usersRoles.fields.errors.confirmMismatch')
    }
  }
  const labelOf: Record<Exclude<ProfileField, 'confirm'>, string> = {
    username: t('usersRoles.fields.usernameLabel'),
    name: t('usersRoles.fields.nameLabel'),
    displayName: t('usersRoles.fields.displayNameLabel'),
    initials: t('usersRoles.fields.initialsLabel'),
    rank: t('usersRoles.fields.rankLabel'),
  }
  return (
    <>
      {showUsername ? (
        <ProfileFieldRow
          testId={`${prefix}-username`}
          label={t('usersRoles.fields.usernameLabel')}
          hint={t('usersRoles.fields.usernameHint', { max: OPERATOR_USERNAME_MAX_LENGTH })}
          value={draft.username}
          onChange={(value) => onChange('username', value)}
          error={errorOf('username', labelOf.username)}
          disabled={disabled}
          mono
          maxLength={OPERATOR_USERNAME_MAX_LENGTH}
          autoComplete="off"
        />
      ) : null}
      <ProfileFieldRow
        testId={`${prefix}-name`}
        label={t('usersRoles.fields.nameLabel')}
        hint={t('usersRoles.fields.nameHint', { max: OPERATOR_NAME_MAX_LENGTH })}
        value={draft.name}
        onChange={(value) => onChange('name', value)}
        error={errorOf('name', labelOf.name)}
        disabled={disabled}
        maxLength={OPERATOR_NAME_MAX_LENGTH}
      />
      <ProfileFieldRow
        testId={`${prefix}-display-name`}
        label={t('usersRoles.fields.displayNameLabel')}
        hint={displayNameHint}
        value={draft.displayName}
        onChange={(value) => onChange('displayName', value)}
        error={errorOf('displayName', labelOf.displayName)}
        disabled={disabled}
        maxLength={OPERATOR_NAME_MAX_LENGTH}
      />
      <ProfileFieldRow
        testId={`${prefix}-initials`}
        label={t('usersRoles.fields.initialsLabel')}
        hint={t('usersRoles.fields.initialsHint', { max: OPERATOR_INITIALS_MAX_LENGTH })}
        value={draft.initials}
        onChange={(value) => onChange('initials', value)}
        error={errorOf('initials', labelOf.initials)}
        disabled={disabled}
        mono
        maxLength={OPERATOR_INITIALS_MAX_LENGTH}
      />
      <ProfileFieldRow
        testId={`${prefix}-rank`}
        label={t('usersRoles.fields.rankLabel')}
        hint={t('usersRoles.fields.rankHint', { max: OPERATOR_RANK_MAX_LENGTH })}
        value={draft.rank}
        onChange={(value) => onChange('rank', value)}
        error={errorOf('rank', labelOf.rank)}
        disabled={disabled}
        maxLength={OPERATOR_RANK_MAX_LENGTH}
      />
    </>
  )
}

/** The reason field of the three dialogs, in the wording of the two existing ones. */
function ReasonField({ testId, value, onChange, disabled }: { readonly testId: string; readonly value: string; readonly onChange: (value: string) => void; readonly disabled: boolean }) {
  const { t } = useTranslation()
  return (
    <TextField value={value} onChange={onChange} data-testid={testId}>
      <Label>{t('usersRoles.fields.reasonLabel')}</Label>
      <TextArea rows={2} maxLength={ADMIN_REASON_MAX_LENGTH} disabled={disabled} />
      <Description>{t('usersRoles.fields.reasonHint', { max: ADMIN_REASON_MAX_LENGTH })}</Description>
    </TextField>
  )
}

/** The inline `Alert` of a refusal the dialog keeps open. */
function InlineAlert({ testId, error, sentences }: { readonly testId: string; readonly error: Exclude<InlineError, null>; readonly sentences: Record<Exclude<InlineError, null>, string> }) {
  return (
    <Alert status="danger" data-testid={testId} data-error={error}>
      <Alert.Indicator />
      <Alert.Content>
        <Alert.Description>{sentences[error]}</Alert.Description>
      </Alert.Content>
    </Alert>
  )
}

export interface CreateUserDialogProps {
  readonly isOpen: boolean
  /** The current rows: only their usernames matter, for the duplicate hint before the round trip. */
  readonly users: readonly AdminUser[]
  readonly matrix: RoleMatrix | null
  readonly linkUp: boolean
  readonly onClose: () => void
}

/** "Add user" (operation 15): the profile, the role and an optional initial password. */
export function CreateUserDialog({ isOpen, users, matrix, linkUp, onClose }: CreateUserDialogProps) {
  const { t } = useTranslation()
  const control = usePendingControl()
  return (
    <Modal.Backdrop
      isOpen={isOpen}
      onOpenChange={(open) => {
        if (!open && !control.busy) onClose()
      }}
      isDismissable={!control.busy}
      variant="blur"
    >
      <Modal.Container size="md" placement="center">
        <Modal.Dialog aria-label={t('usersRoles.createDialog.title')} data-testid="ur-create-dialog">
          {/* The page keys this dialog by its opening (`create-${seq}`), so the draft is fresh every time. */}
          <CreateUserBody users={users} matrix={matrix} linkUp={linkUp} onClose={onClose} control={control} />
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  )
}

function CreateUserBody({ users, matrix, linkUp, onClose, control }: Omit<CreateUserDialogProps, 'isOpen'> & { readonly control: PendingControl }) {
  const { t } = useTranslation()
  const send = useAdminCommand()
  const { busy, pending, ref } = control
  const [draft, setDraft] = useState<ProfileDraft>(EMPTY_DRAFT)
  const [role, setRole] = useState(rolesOf(matrix)[0] ?? 'INVESTIGATOR')
  const [password, setPassword] = useState('')
  const [reason, setReason] = useState('')
  const [errors, setErrors] = useState<FieldErrors>({})
  const [error, setError] = useState<InlineError>(null)

  const change = (field: ProfileField, value: string) => {
    setDraft((current) => ({ ...current, [field]: value }))
    setErrors((current) => ({ ...current, [field]: undefined }))
    setError(null)
  }

  const confirm = () => {
    if (!linkUp || busy) return
    const taken = users.map((user) => normalizeUsername(user.username))
    const found = validateCreate(draft, taken)
    if (Object.keys(found).length > 0) {
      setErrors(found)
      return
    }
    setErrors({})
    setError(null)
    send(control, { kind: 'create', draft, role, password, reason }, (outcome) => {
      if (outcome.kind === 'done' || outcome.kind === 'closeDialog') onClose()
      else if (outcome.kind !== 'kept') setError(outcome.kind)
    })
  }

  return (
    <>
      <Modal.Header>
        <Modal.Icon>
          <UserPlus className="size-5" aria-hidden="true" />
        </Modal.Icon>
        <Modal.Heading>{t('usersRoles.createDialog.title')}</Modal.Heading>
      </Modal.Header>
      <Modal.Body className="ur-dialog-body">
        <p className="ur-dialog-text">{t('usersRoles.createDialog.intro')}</p>
        <ProfileFields prefix="ur-create" draft={draft} errors={errors} onChange={change} disabled={busy} displayNameHint={t('usersRoles.fields.displayNameHint')} showUsername />
        <RadioGroup
          value={role}
          onChange={(value) => {
            const next = rolesOf(matrix).find((option) => option === value)
            if (next === undefined) return
            setRole(next)
            setError(null)
          }}
          className="ur-role-options"
          data-testid="ur-create-role"
        >
          <Label>{t('usersRoles.fields.roleLabel')}</Label>
          {rolesOf(matrix).map((option) => (
            <Radio key={option} value={option} data-testid={`ur-create-role-option-${option}`}>
              <Radio.Content>
                <Radio.Control>
                  <Radio.Indicator />
                </Radio.Control>
                <Label>{t(`common.roles.${option}`)}</Label>
              </Radio.Content>
            </Radio>
          ))}
        </RadioGroup>
        <TextField type="password" value={password} onChange={setPassword} isDisabled={busy} autoComplete="new-password" data-testid="ur-create-password">
          <Label>{t('usersRoles.fields.passwordLabel')}</Label>
          <Input data-testid="ur-create-password-input" spellCheck={false} autoCapitalize="off" autoCorrect="off" />
          <Description>{t('usersRoles.fields.passwordHint')}</Description>
        </TextField>
        <ReasonField testId="ur-create-reason" value={reason} onChange={setReason} disabled={busy} />
        {error === null ? null : (
          <InlineAlert testId="ur-create-error" error={error} sentences={{ invalid: t('usersRoles.createDialog.invalid'), lastAdmin: t('usersRoles.lastAdmin'), invalidState: t('usersRoles.createDialog.invalid') }} />
        )}
      </Modal.Body>
      <Modal.Footer>
        <Button variant="ghost" onPress={onClose} isDisabled={busy} data-testid="ur-create-cancel">
          {t('common.actions.cancel')}
        </Button>
        <Button ref={ref} variant="primary" onPress={confirm} isDisabled={!linkUp} isPending={pending} data-testid="ur-create-confirm">
          {pending ? <Spinner size="sm" color="current" aria-hidden="true" /> : null}
          {t('usersRoles.createDialog.confirm')}
        </Button>
      </Modal.Footer>
    </>
  )
}

export interface EditUserDialogProps {
  readonly isOpen: boolean
  /** The operator whose profile is edited; kept while the dialog plays its exit. */
  readonly target: AdminUser | null
  readonly linkUp: boolean
  readonly onClose: () => void
}

/**
 * "Edit profile" (operation 16): the name, the display name, the initials and the rank. The body
 * carries only what differs from the row, so the confirm waits for a change (the schema refuses an
 * empty profile). The username is not editable, the role is `assignUserRole`, and a password never
 * passes through this dialog.
 */
export function EditUserDialog({ isOpen, target, linkUp, onClose }: EditUserDialogProps) {
  const { t } = useTranslation()
  const control = usePendingControl()
  return (
    <Modal.Backdrop
      isOpen={isOpen}
      onOpenChange={(open) => {
        if (!open && !control.busy) onClose()
      }}
      isDismissable={!control.busy}
      variant="blur"
    >
      <Modal.Container size="md" placement="center">
        <Modal.Dialog aria-label={t('usersRoles.editDialog.title')} data-testid="ur-edit-dialog">
          {target === null ? null : (
            // A new body per target: the draft, the errors and the inline refusal start from the row.
            <EditUserBody key={target.id} target={target} linkUp={linkUp} onClose={onClose} control={control} />
          )}
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  )
}

function EditUserBody({ target, linkUp, onClose, control }: Omit<EditUserDialogProps, 'isOpen' | 'target'> & { readonly target: AdminUser; readonly control: PendingControl }) {
  const { t } = useTranslation()
  const send = useAdminCommand()
  const { busy, pending, ref } = control
  const [draft, setDraft] = useState<ProfileDraft>(() => draftOf(target))
  const [reason, setReason] = useState('')
  const [errors, setErrors] = useState<FieldErrors>({})
  const [error, setError] = useState<InlineError>(null)
  const changed = profileChanged(target, draft)

  const change = (field: ProfileField, value: string) => {
    setDraft((current) => ({ ...current, [field]: value }))
    setErrors((current) => ({ ...current, [field]: undefined }))
    setError(null)
  }

  const confirm = () => {
    if (!linkUp || busy) return
    const found = validateEdit(draft)
    if (Object.keys(found).length > 0) {
      setErrors(found)
      return
    }
    setErrors({})
    setError(null)
    send(control, { kind: 'update', target, draft, reason }, (outcome) => {
      if (outcome.kind === 'done' || outcome.kind === 'closeDialog') onClose()
      else if (outcome.kind !== 'kept') setError(outcome.kind)
    })
  }

  return (
    <>
      <Modal.Header>
        <Modal.Icon>
          <UserRoundPen className="size-5" aria-hidden="true" />
        </Modal.Icon>
        <Modal.Heading>{t('usersRoles.editDialog.title')}</Modal.Heading>
      </Modal.Header>
      <Modal.Body className="ur-dialog-body">
        <p className="ur-dialog-target" data-testid="ur-edit-target">
          {t('usersRoles.editDialog.target', { name: target.displayName, username: target.username })}
        </p>
        <ProfileFields prefix="ur-edit" draft={draft} errors={errors} onChange={change} disabled={busy} displayNameHint={t('usersRoles.fields.displayNameKeepHint')} showUsername={false} />
        <p className="ur-muted">{t('usersRoles.editDialog.note')}</p>
        <ReasonField testId="ur-edit-reason" value={reason} onChange={setReason} disabled={busy} />
        {!changed && error === null ? <p className="ur-muted" data-testid="ur-edit-untouched">{t('usersRoles.editDialog.untouched')}</p> : null}
        {error === null ? null : (
          <InlineAlert testId="ur-edit-error" error={error} sentences={{ invalid: t('usersRoles.editDialog.invalid'), lastAdmin: t('usersRoles.lastAdmin'), invalidState: t('usersRoles.editDialog.invalid') }} />
        )}
      </Modal.Body>
      <Modal.Footer>
        <Button variant="ghost" onPress={onClose} isDisabled={busy} data-testid="ur-edit-cancel">
          {t('common.actions.cancel')}
        </Button>
        <Button ref={ref} variant="primary" onPress={confirm} isDisabled={!changed || !linkUp} isPending={pending} data-testid="ur-edit-confirm">
          {pending ? <Spinner size="sm" color="current" aria-hidden="true" /> : null}
          {t('usersRoles.editDialog.confirm')}
        </Button>
      </Modal.Footer>
    </>
  )
}

export interface DeleteUserDialogProps {
  readonly isOpen: boolean
  readonly target: AdminUser | null
  /** The signed-in operator's ID: deleting one's own account is said before it is offered. */
  readonly selfId: string | null
  readonly linkUp: boolean
  readonly onClose: () => void
}

/**
 * "Delete user" (operation 17): a kit `AlertDialog` `danger` in the pattern of `DisableDialog`. The
 * username must be typed back — the body's `confirm` — so the confirm stays disabled until the field
 * holds it exactly. A 409 `LAST_ADMIN` shows the hint's sentence, a 409 `INVALID_STATE` (the account
 * is still named by a row the database points at) shows the delete's own sentence; both leave the
 * dialog open with nothing removed. A 200 closes it and the row leaves the table on the next read.
 */
export function DeleteUserDialog({ isOpen, target, selfId, linkUp, onClose }: DeleteUserDialogProps) {
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
        <AlertDialog.Dialog aria-label={t('usersRoles.deleteDialog.title')} data-testid="ur-delete-dialog">
          {target === null ? null : <DeleteBody key={target.id} target={target} selfId={selfId} linkUp={linkUp} onClose={onClose} control={control} />}
        </AlertDialog.Dialog>
      </AlertDialog.Container>
    </AlertDialog.Backdrop>
  )
}

function DeleteBody({ target, selfId, linkUp, onClose, control }: Omit<DeleteUserDialogProps, 'isOpen' | 'target'> & { readonly target: AdminUser; readonly control: PendingControl }) {
  const { t } = useTranslation()
  const send = useAdminCommand()
  const { busy, pending, ref } = control
  const [confirmText, setConfirmText] = useState('')
  const [reason, setReason] = useState('')
  const [errors, setErrors] = useState<FieldErrors>({})
  const [error, setError] = useState<InlineError>(null)
  const repeated = confirmText.trim() === target.username

  const confirm = () => {
    if (!linkUp || busy) return
    const found = validateDelete(target, confirmText)
    if (Object.keys(found).length > 0) {
      setErrors(found)
      return
    }
    setErrors({})
    setError(null)
    send(control, { kind: 'delete', target, confirm: confirmText, reason }, (outcome) => {
      if (outcome.kind === 'done' || outcome.kind === 'closeDialog') onClose()
      else if (outcome.kind !== 'kept') setError(outcome.kind)
    })
  }

  return (
    <>
      <AlertDialog.Header>
        <AlertDialog.Icon status="danger" />
        <AlertDialog.Heading>{t('usersRoles.deleteDialog.title')}</AlertDialog.Heading>
      </AlertDialog.Header>
      <AlertDialog.Body className="ur-dialog-body">
        <p className="ur-dialog-text">{t('usersRoles.deleteDialog.body', { name: target.displayName, username: target.username })}</p>
        {selfId === target.id ? (
          <Alert status="warning" data-testid="ur-delete-own">
            <Alert.Indicator />
            <Alert.Content>
              <Alert.Description>{t('usersRoles.deleteDialog.ownRow')}</Alert.Description>
            </Alert.Content>
          </Alert>
        ) : null}
        <TextField
          value={confirmText}
          onChange={(value) => {
            setConfirmText(value)
            setErrors((current) => ({ ...current, confirm: undefined }))
            setError(null)
          }}
          isInvalid={errors.confirm !== undefined}
          isDisabled={busy}
          autoComplete="off"
          data-testid="ur-delete-confirm-input"
        >
          <Label>{t('usersRoles.deleteDialog.confirmLabel')}</Label>
          <Input className="ur-mono" spellCheck={false} autoCapitalize="off" autoCorrect="off" />
          {errors.confirm === undefined ? (
            <Description>{t('usersRoles.deleteDialog.confirmHint', { username: target.username })}</Description>
          ) : (
            <FieldError data-testid="ur-delete-confirm-input-error">{t('usersRoles.fields.errors.confirmMismatch')}</FieldError>
          )}
        </TextField>
        <ReasonField testId="ur-delete-reason" value={reason} onChange={setReason} disabled={busy} />
        {error === null ? null : (
          <InlineAlert
            testId="ur-delete-error"
            error={error}
            sentences={{ invalid: t('usersRoles.deleteDialog.invalid'), lastAdmin: t('usersRoles.lastAdmin'), invalidState: t('usersRoles.deleteDialog.invalidState') }}
          />
        )}
      </AlertDialog.Body>
      <AlertDialog.Footer>
        <Button variant="ghost" onPress={onClose} isDisabled={busy} data-testid="ur-delete-cancel">
          {t('common.actions.cancel')}
        </Button>
        <Button ref={ref} variant="danger" onPress={confirm} isDisabled={!repeated || !linkUp} isPending={pending} data-testid="ur-delete-confirm">
          {pending ? <Spinner size="sm" color="current" aria-hidden="true" /> : null}
          <Trash aria-hidden="true" size={16} />
          {t('usersRoles.deleteDialog.confirm')}
        </Button>
      </AlertDialog.Footer>
    </>
  )
}
