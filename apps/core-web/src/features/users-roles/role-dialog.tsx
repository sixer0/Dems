import { useState } from 'react'
import { Alert, Button, Description, Label, Modal, Radio, RadioGroup, Spinner, TextArea, TextField } from '@heroui/react'
import { UserCog } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { ADMIN_REASON_MAX_LENGTH, type AdminUser, type RoleMatrix } from '@dems/shared/api'
import type { OperatorRole, Permission } from '@dems/shared/sim'
import { usePendingControl } from '@/lib/pending-control'
import { useAdminCommand } from './commands'
import { blockedRolesFor, roleDiff, rolesOf } from './model'

export interface RoleDialogProps {
  readonly isOpen: boolean
  /** The operator whose role changes; kept while the dialog plays its exit. */
  readonly target: AdminUser | null
  readonly users: readonly AdminUser[]
  readonly matrix: RoleMatrix | null
  /** The signed-in operator's ID (the own-row warning). */
  readonly selfId: string | null
  /** The link is up (CL-22 locally: no command is offered while the Core cannot be reached). */
  readonly linkUp: boolean
  readonly onClose: () => void
}

/**
 * The role-change dialog (backend task 04_client_integration_spec §10.2; AC-C-87, AC-C-88; plan row
 * W77): a kit `Modal` (`md`, as the existing dialogs) with the three roles, what the operator gains
 * and loses by the stored matrix, the own-row warning, an optional reason and the confirm, which is
 * disabled until another role is chosen.
 *
 * The last-administrator hint disables the roles without `USER_ADMIN` for the only enabled holder,
 * with the sentence of §10.2; the server's 409 `LAST_ADMIN` is the authority and shows the same
 * sentence inline, with the dialog left open and nothing changed. Busy per LB-1 through
 * `usePendingControl()` (W0 §15): `aria-busy` on the confirm from the press, the kit's pending look
 * late, a second press sends nothing; the dialog cannot be dismissed while the command is out.
 */
export function RoleDialog({ isOpen, target, users, matrix, selfId, linkUp, onClose }: RoleDialogProps) {
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
        <Modal.Dialog aria-label={t('usersRoles.roleDialog.title')} data-testid="ur-role-dialog">
          {target === null ? null : (
            // A new body per target: the choice, the reason and an inline error start fresh.
            <RoleDialogBody key={target.id} target={target} users={users} matrix={matrix} selfId={selfId} linkUp={linkUp} onClose={onClose} control={control} />
          )}
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  )
}

type InlineError = 'lastAdmin' | 'invalid' | null

function RoleDialogBody({
  target,
  users,
  matrix,
  selfId,
  linkUp,
  onClose,
  control,
}: Omit<RoleDialogProps, 'isOpen' | 'target'> & { readonly target: AdminUser; readonly control: ReturnType<typeof usePendingControl> }) {
  const { t } = useTranslation()
  const send = useAdminCommand()
  const { busy, pending, ref } = control
  const [role, setRole] = useState<OperatorRole>(target.role)
  const [reason, setReason] = useState('')
  const [error, setError] = useState<InlineError>(null)
  const blocked = blockedRolesFor(target, users, matrix)
  const changed = role !== target.role
  const diff = changed && matrix !== null ? roleDiff(matrix, target.role, role) : null
  const permissionLabel = (permission: Permission): string => t(`securityAudit.rbac.permissions.${permission}`)

  const confirm = () => {
    if (!changed || !linkUp) return
    setError(null)
    send(control, { kind: 'role', target, role, reason }, (outcome) => {
      if (outcome.kind === 'done' || outcome.kind === 'closeDialog') onClose()
      else if (outcome.kind === 'lastAdmin' || outcome.kind === 'invalid') setError(outcome.kind)
    })
  }

  return (
    <>
      <Modal.Header>
        <Modal.Icon>
          <UserCog className="size-5" aria-hidden="true" />
        </Modal.Icon>
        <Modal.Heading>{t('usersRoles.roleDialog.title')}</Modal.Heading>
      </Modal.Header>
      <Modal.Body className="ur-dialog-body">
        <p className="ur-dialog-target" data-testid="ur-role-target">
          {t('usersRoles.roleDialog.target', { name: target.displayName, username: target.username })}
        </p>

        {selfId === target.id ? (
          <Alert status="warning" data-testid="ur-role-own">
            <Alert.Indicator />
            <Alert.Content>
              <Alert.Description>{t('usersRoles.roleDialog.ownRow')}</Alert.Description>
            </Alert.Content>
          </Alert>
        ) : null}

        <RadioGroup
          value={role}
          onChange={(value) => {
            const next = rolesOf(matrix).find((option) => option === value)
            if (next === undefined) return
            setRole(next)
            setError(null)
          }}
          className="ur-role-options"
        >
          <Label>{t('usersRoles.roleDialog.roleLabel')}</Label>
          {rolesOf(matrix).map((option) => {
            const isBlocked = blocked.has(option)
            return (
              <Radio key={option} value={option} isDisabled={isBlocked} data-testid={`ur-role-option-${option}`} data-blocked={isBlocked ? 'true' : undefined}>
                <Radio.Content>
                  <Radio.Control>
                    <Radio.Indicator />
                  </Radio.Control>
                  <Label>
                    {t(`common.roles.${option}`)}
                    {option === target.role ? <span className="ur-role-current"> · {t('usersRoles.roleDialog.current')}</span> : null}
                  </Label>
                </Radio.Content>
                {isBlocked ? <Description>{t('usersRoles.lastAdmin')}</Description> : null}
              </Radio>
            )
          })}
        </RadioGroup>

        <section className="ur-role-diff" data-testid="ur-role-diff" aria-label={t('usersRoles.roleDialog.diffTitle')}>
          <p className="ur-role-diff-title">{t('usersRoles.roleDialog.diffTitle')}</p>
          {diff === null ? (
            <p className="ur-muted">{t('usersRoles.roleDialog.sameRole')}</p>
          ) : (
            <div className="ur-role-diff-lists">
              <DiffList testId="ur-role-gains" title={t('usersRoles.roleDialog.gains')} items={diff.gains.map(permissionLabel)} empty={t('usersRoles.roleDialog.nothing')} tone="gain" />
              <DiffList testId="ur-role-loses" title={t('usersRoles.roleDialog.loses')} items={diff.loses.map(permissionLabel)} empty={t('usersRoles.roleDialog.nothing')} tone="loss" />
            </div>
          )}
          <p className="ur-muted">{t('usersRoles.roleDialog.note')}</p>
        </section>

        <TextField value={reason} onChange={setReason} data-testid="ur-role-reason">
          <Label>{t('usersRoles.roleDialog.reasonLabel')}</Label>
          <TextArea rows={2} maxLength={ADMIN_REASON_MAX_LENGTH} />
          <Description>{t('usersRoles.roleDialog.reasonHint', { max: ADMIN_REASON_MAX_LENGTH })}</Description>
        </TextField>

        {error === null ? null : (
          <Alert status="danger" data-testid="ur-role-error" data-error={error}>
            <Alert.Indicator />
            <Alert.Content>
              <Alert.Description>{error === 'lastAdmin' ? t('usersRoles.lastAdmin') : t('usersRoles.roleDialog.invalid')}</Alert.Description>
            </Alert.Content>
          </Alert>
        )}
      </Modal.Body>
      <Modal.Footer>
        <Button variant="ghost" onPress={onClose} isDisabled={busy} data-testid="ur-role-cancel">
          {t('common.actions.cancel')}
        </Button>
        <Button ref={ref} variant="primary" onPress={confirm} isDisabled={!changed || !linkUp} isPending={pending} data-testid="ur-role-confirm">
          {pending ? <Spinner size="sm" color="current" aria-hidden="true" /> : null}
          {t('usersRoles.roleDialog.confirm')}
        </Button>
      </Modal.Footer>
    </>
  )
}

function DiffList({ testId, title, items, empty, tone }: { testId: string; title: string; items: string[]; empty: string; tone: 'gain' | 'loss' }) {
  return (
    <div className="ur-diff-list" data-tone={tone} data-testid={testId}>
      <p className="ur-diff-list-title">{title}</p>
      {items.length === 0 ? (
        <p className="ur-muted">{empty}</p>
      ) : (
        <ul>
          {items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      )}
    </div>
  )
}
