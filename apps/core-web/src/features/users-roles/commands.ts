/**
 * The commands of the Users & Roles page (backend task 04_client_integration_spec §10.2, §10.1 PG-11,
 * §6.2; §8.1 LB-1, LB-6, LB-10; plan row W77; W0 §15; RB-9 as amended 02-11-2026).
 *
 * | Command | Operation | Body |
 * |---------|-----------|------|
 * | Change role | 12 `assignUserRole` | `{ role, reason? }` |
 * | Disable | 14 `disableUser` | `{ reason? }` |
 * | Enable | 13 `enableUser` | none (the dialog of §10.2 has no reason) |
 * | Add user | 15 `createUser` | `{ username, name, displayName?, initials, rank?, role, password?, reason? }` |
 * | Edit profile | 16 `updateUser` | the profile fields that differ, `rank: null` to clear one; never a password |
 * | Delete user | 17 `deleteUser` | `{ confirm, reason? }` — `confirm` repeats the target's username |
 *
 * The last three are the vendor trio: the page offers them only to the signed-in `root` account
 * (`model.ts` `isVendorRoot`), and the server checks the same rule itself — a caller who holds
 * `USER_ADMIN` without being `root` gets 403 `NOT_PERMITTED`, which the presenter words and the
 * dialog closes (PG-11). The UI gate is cosmetic; the server's answer is the authority.
 *
 * None of them is a simulator action (`@dems/shared/api/administration.ts:1-18`), so they go through
 * the one way in for an operation, `useWebLive()?.client.call(…)` (rule 1). A reason is trimmed and
 * bounded here to `ADMIN_REASON_MAX_LENGTH`; the server's 422 is still the judge (F59).
 *
 * What the operator sees, per answer — the first matching row decides:
 *
 * | Answer | Outcome | The dialog |
 * |--------|---------|------------|
 * | 200 | the row is replaced by the answer, the list is read again, a success toast | closes |
 * | 403 (`notPermitted`) | the presenter's denied toast naming the Supervisor (AC-C-48) | closes (PG-11) |
 * | 401, a stopped source | nothing: the shell shows the Login page | — |
 * | no answer, 503, 429, 500 | the presenter's toast, coalesced (LB-6, LB-10) | stays open (PG-11) |
 * | 409 `LAST_ADMIN` | the inline `Alert` with the hint's sentence; nothing changed (AC-C-88) | stays open |
 * | 409 `INVALID_STATE` | the inline `Alert` with the delete's own sentence; nothing changed | stays open |
 * | 400, 422 | an inline sentence: the server did not accept the input (F59) | stays open |
 * | 404 | a toast; the list is read again | closes |
 * | anything else | a toast; one record in the page's own log | stays open |
 *
 * A 200 of `createUser` carries a row the list does not hold yet, and a 200 of `deleteUser` names a
 * row that no longer exists, so those two only ask for the list to be read again.
 *
 * **The cache after a 200** (PG-6a): the answer replaces its row only in an entry that still EXISTS.
 * A self-demotion or a self-disable makes the bridge remove every `['core', …]` entry, and the
 * `session.updated` / `session.ended` of that change may arrive before the HTTP answer
 * (`implementation/33_user_role_admin.md` §9: the publications precede the answer). An updater that
 * returns `undefined` for a missing entry creates nothing, so no row of this page is put back into
 * the cache for the next operator.
 *
 * **The initial password** (rule of `features/login`, AC-50): it is passed straight into the body of
 * `createUser` and is never held in the cache, written to the page's log or put in a toast.
 */
import { useCallback } from 'react'
import { toast } from '@heroui/react'
import { useQueryClient, type QueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { ADMIN_REASON_MAX_LENGTH, ApiErrorCode, type AdminUser, type AdminUserList, type DeletedUser } from '@dems/shared/api'
import type { CoreCallFailure } from '@dems/shared/client'
import { settle } from '@dems/shared/live'
import { Permission, type OperatorRole } from '@dems/shared/sim'
import { CoreErrorNoticeKind, useCoreErrorPresenter } from '@/lib/core-errors'
import type { PendingControl } from '@/lib/pending-control'
import { CORE_QUERY_KEYS, useWebLive, type WebLive } from '@/runtime'
import { createUserBody, deleteUserBody, updateUserBody, type ProfileDraft } from './account-form'
import { usersOf } from './model'
import { reportUsersError } from './report'

export type AdminCommand =
  | { readonly kind: 'role'; readonly target: AdminUser; readonly role: OperatorRole; readonly reason: string }
  | { readonly kind: 'disable'; readonly target: AdminUser; readonly reason: string }
  | { readonly kind: 'enable'; readonly target: AdminUser }
  | { readonly kind: 'create'; readonly draft: ProfileDraft; readonly role: OperatorRole; readonly password: string; readonly reason: string }
  | { readonly kind: 'update'; readonly target: AdminUser; readonly draft: ProfileDraft; readonly reason: string }
  | { readonly kind: 'delete'; readonly target: AdminUser; readonly confirm: string; readonly reason: string }

export type CommandOutcome =
  /** 200: the operator after the change; `null` when the command removed the row (a delete). */
  | { readonly kind: 'done'; readonly user: AdminUser | null }
  /** 409 `LAST_ADMIN`: the inline Alert; the dialog stays open. */
  | { readonly kind: 'lastAdmin' }
  /** 409 `INVALID_STATE`: the inline Alert of the delete dialog; the dialog stays open. */
  | { readonly kind: 'invalidState' }
  /** 400 or 422: the inline sentence; the dialog stays open. */
  | { readonly kind: 'invalid' }
  /** The dialog closes: a 403 (the presenter's denied toast) or a 404 (toast and refetch). */
  | { readonly kind: 'closeDialog' }
  /** The presenter or the page worded it; the dialog stays open (an outage, a limit, an unknown answer). */
  | { readonly kind: 'kept' }

/** What a command answers: the operator after the change, or what a delete removed. */
export type AdminCommandAnswer = AdminUser | DeletedUser

const OPERATION: Record<AdminCommand['kind'], 'assignUserRole' | 'disableUser' | 'enableUser' | 'createUser' | 'updateUser' | 'deleteUser'> = {
  role: 'assignUserRole',
  disable: 'disableUser',
  enable: 'enableUser',
  create: 'createUser',
  update: 'updateUser',
  delete: 'deleteUser',
}

/** A failed answer of a command, carried through `settle`'s `fail`. */
export class AdminCommandError extends Error {
  override readonly name = 'AdminCommandError'
  readonly failure: CoreCallFailure
  readonly status: number | null
  readonly code: string
  constructor(failure: CoreCallFailure) {
    super('A command of Users & Roles was refused or not answered.')
    this.failure = failure
    this.status = failure.status
    this.code = failure.error.code
  }
}

/** The reason as sent: trimmed, bounded, and left out when empty. */
export function reasonBody(reason: string): { reason?: string } {
  const trimmed = reason.trim().slice(0, ADMIN_REASON_MAX_LENGTH)
  return trimmed === '' ? {} : { reason: trimmed }
}

/** Who the command is about, as the toast names it. A create has no row yet: its typed name stands in. */
export function subjectName(command: AdminCommand): string {
  if (command.kind === 'create') return command.draft.name.trim() === '' ? command.draft.username.trim() : command.draft.name.trim()
  return command.target.displayName
}

/** What `control.run` names the command in flight: a create has no row ID yet. */
const lockKey = (command: AdminCommand): string => (command.kind === 'create' ? 'new-user' : command.target.id)

/** Sends one command. Resolves with the answer; rejects with `AdminCommandError` for a failed answer. */
export async function sendAdminCommand(live: WebLive, command: AdminCommand): Promise<AdminCommandAnswer> {
  const answer = await (async () => {
    switch (command.kind) {
      case 'role':
        return live.client.call('assignUserRole', { params: { id: command.target.id }, body: { role: command.role, ...reasonBody(command.reason) } })
      case 'disable':
        return live.client.call('disableUser', { params: { id: command.target.id }, body: reasonBody(command.reason) })
      case 'enable':
        return live.client.call('enableUser', { params: { id: command.target.id } })
      case 'create':
        return live.client.call('createUser', { body: createUserBody(command.draft, command.role, command.password, command.reason) })
      case 'update': {
        // The dialog disables its confirm until a field differs, so an empty body cannot be pressed.
        const body = updateUserBody(command.target, command.draft, command.reason)
        if (body === null) throw new AdminCommandEmptyProfile()
        return live.client.call('updateUser', { params: { id: command.target.id }, body })
      }
      case 'delete':
        return live.client.call('deleteUser', { params: { id: command.target.id }, body: deleteUserBody(command.confirm, command.reason) })
    }
  })()
  if (answer.ok) return answer.data
  throw new AdminCommandError(answer)
}

/** Pressed with a draft that holds no change: nothing is sent (the dialog's confirm is disabled while this cannot happen). */
export class AdminCommandEmptyProfile extends Error {
  override readonly name = 'AdminCommandEmptyProfile'
  constructor() {
    super('An update of Users & Roles was pressed without a changed profile field.')
  }
}

/** PG-6a: replaces the operator's row in the users entry, and creates no entry that the bridge removed. */
export function applyUserToCache(queryClient: QueryClient, user: AdminUser): void {
  queryClient.setQueryData<AdminUserList>(CORE_QUERY_KEYS.users, (held) => {
    if (held === undefined) return undefined
    const users = usersOf(held)
    if (!users.some((row) => row.id === user.id)) return held
    return { ...held, users: users.map((row) => (row.id === user.id ? user : row)) }
  })
}

const FAILED_RECORD: Record<AdminCommand['kind'], string> = {
  role: 'A role change of Users & Roles was not carried out.',
  disable: 'A disable of Users & Roles was not carried out.',
  enable: 'An enable of Users & Roles was not carried out.',
  create: 'A created account of Users & Roles was not carried out.',
  update: 'A profile change of Users & Roles was not carried out.',
  delete: 'A delete of Users & Roles was not carried out.',
}

/**
 * `send(control, command, onOutcome)`: one command on the dialog's pending control (LB-1: busy at
 * once, the kit's pending look late, a second press sends nothing). Returns whether it was sent.
 */
export function useAdminCommand(): (control: PendingControl, command: AdminCommand, onOutcome: (outcome: CommandOutcome) => void) => boolean {
  const { t } = useTranslation()
  const live = useWebLive()
  const queryClient = useQueryClient()
  const presentCoreError = useCoreErrorPresenter()

  return useCallback(
    (control, command, onOutcome) => {
      if (live === null) return false
      const name = subjectName(command)
      return control.run(
        (release) =>
          settle(() => sendAdminCommand(live, command), {
            ok: (answer) => {
              if (command.kind === 'delete') {
                // The row is gone from the Core: only a fresh read may change what the page shows.
                void queryClient.invalidateQueries({ queryKey: CORE_QUERY_KEYS.users })
                toast.success(t('usersRoles.toasts.deleted', { username: command.target.username }), { description: t('usersRoles.toasts.deletedBody') })
                onOutcome({ kind: 'done', user: null })
                return
              }
              const user = answer as AdminUser
              applyUserToCache(queryClient, user)
              void queryClient.invalidateQueries({ queryKey: CORE_QUERY_KEYS.users })
              if (command.kind === 'create')
                toast.success(t('usersRoles.toasts.created', { name }), {
                  description: t(command.password.trim() === '' ? 'usersRoles.toasts.createdNoPassword' : 'usersRoles.toasts.createdWithPassword'),
                })
              else if (command.kind === 'update') toast.success(t('usersRoles.toasts.updated', { name }))
              else if (command.kind === 'role') toast.success(t('usersRoles.toasts.roleChanged', { name, role: t(`common.roles.${user.role}`) }))
              else if (command.kind === 'disable') toast.success(t('usersRoles.toasts.disabled', { name }), { description: t('usersRoles.toasts.disabledBody') })
              else toast.success(t('usersRoles.toasts.enabled', { name }), { description: t('usersRoles.toasts.enabledBody') })
              onOutcome({ kind: 'done', user })
            },
            fail: (error) => {
              const failure = error instanceof AdminCommandError ? error.failure : error
              // Rule 2: the presenter first. A 403 closes the dialog (PG-11); every other notice keeps it.
              const notice = presentCoreError(failure, { permission: Permission.USER_ADMIN })
              if (notice !== null) {
                onOutcome({ kind: notice.kind === CoreErrorNoticeKind.PERMISSION ? 'closeDialog' : 'kept' })
                return
              }
              const status = error instanceof AdminCommandError ? error.status : null
              const code = error instanceof AdminCommandError ? error.code : null
              if (status === 409 && code === ApiErrorCode.LAST_ADMIN) {
                onOutcome({ kind: 'lastAdmin' })
                return
              }
              if (status === 409 && code === ApiErrorCode.INVALID_STATE) {
                onOutcome({ kind: 'invalidState' })
                return
              }
              if (status === 400 || status === 422) {
                onOutcome({ kind: 'invalid' })
                return
              }
              const context = { operationId: OPERATION[command.kind], operatorId: command.kind === 'create' ? null : command.target.id, ...(code === null ? {} : { code }) }
              if (status === 404) {
                toast.danger(t('usersRoles.toasts.notFound'), { description: t('usersRoles.toasts.notFoundBody') })
                reportUsersError(`features/users-roles.${OPERATION[command.kind]}`, error, FAILED_RECORD[command.kind], context, 'warn')
                void queryClient.invalidateQueries({ queryKey: CORE_QUERY_KEYS.users })
                onOutcome({ kind: 'closeDialog' })
                return
              }
              toast.danger(t('usersRoles.toasts.failed'))
              reportUsersError(`features/users-roles.${OPERATION[command.kind]}`, error, FAILED_RECORD[command.kind], context)
              onOutcome({ kind: 'kept' })
            },
            done: release,
          }),
        lockKey(command),
      )
    },
    [live, presentCoreError, queryClient, t],
  )
}
