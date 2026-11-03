/**
 * @vitest-environment jsdom
 * @vitest-environment-options { "url": "http://127.0.0.1:5178/" }
 */
// RB-9 as amended 02-11-2026: the Users & Roles page gains create / edit / delete, gated to the
// vendor `root` account. Operations 15, 16 and 17 of `@dems/shared/api/administration.ts` on the
// contract-checked fake transport, in the pattern of `src/test/live-users-roles-commands.test.tsx`.
//
// | What the principal asked | Where it is proven here |
// |--------------------------|-------------------------|
// | (a) the three controls are NOT offered to a holder of USER_ADMIN whose username is not `root` | "the gate" |
// | (b) they ARE offered to `root` | "the gate" |
// | (c) `deleteUser` carries `confirm` = the target's username | "deleteUser", first test |
// | (c') a create without a password succeeds and says the account cannot sign in yet | "createUser" |
// | (d) a 409 `INVALID_STATE` words the refusal and leaves the dialog open | "deleteUser" |
// | The per-field validation of `set-ip.tsx` (`isInvalid` + `FieldError`) stands before the press | "createUser", first test |
// | The initial password is sent and nothing else ever holds it | "createUser", with a password |
import { cleanup, configure, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { en } from '@dems/shared/i18n'
import { getMissingI18nKeys, resetMissingI18nKeys } from '@/i18n'
import { resetCoreErrorPresenter } from '@/lib/core-errors'
import { webErrorSink } from '@/runtime'
import type { LiveTestBed } from '@/runtime/testing/live-harness'
import { SHELL_INTRO_STORAGE_KEY } from '@/components/shell/shell-entrance'
import {
  clearToasts,
  disposeBeds,
  list,
  one,
  openDialog,
  openRowMenu,
  openUsersRoles,
  press,
  ROOT_SESSION,
  seededUsers,
  SUPERVISOR_ADMIN_SESSION,
  toastsWith,
  typeField,
  usersWith,
  waitClosed,
} from '@/features/users-roles/__tests__/users-roles-bed'

configure({ asyncUtilTimeout: 8_000 })
vi.setConfig({ testTimeout: 25_000 })

const U = en.usersRoles
const RINA = 'Rina Wijaya'
const fill = (text: string, values: Record<string, string>) => Object.entries(values).reduce((out, [key, value]) => out.replace(`{{${key}}}`, value), text)
const requests = (bed: LiveTestBed, op: string) => bed.fake.log.requestsOf(op)

/** The body of a create that the fields are ready to send. */
const NEW_OPERATOR = { username: 'sari.officer', name: 'Sari Melati', initials: 'SM', role: 'INVESTIGATOR' }

async function openAsRoot(script?: (bed: LiveTestBed) => void) {
  const opened = await openUsersRoles({
    session: ROOT_SESSION,
    script: (bed) => {
      bed.fake.answer('createUser', () => one({ ...seededUsers(bed)[0]!, id: 'OPR-006', username: NEW_OPERATOR.username, name: 'Sari Melati', displayName: 'Sari Melati', initials: 'SM', lastSignInAt: null, activeSessions: 0, roleChangedAt: null }))
      bed.fake.answer('updateUser', () => one({ ...seededUsers(bed).find((user) => user.id === 'OPR-003')!, name: 'Sari M. Halim', initials: 'SH' }))
      bed.fake.answer('deleteUser', { status: 200, body: { operatorId: 'OPR-003', username: 'rina.wijaya', sessionsEnded: 1, credentialsRemoved: 1 } })
      script?.(bed)
    },
  })
  return opened
}

/** Fills the four required fields of the create dialog. */
async function fillCreateForm(dialog: HTMLElement, over: Partial<typeof NEW_OPERATOR> = {}): Promise<void> {
  typeField(dialog, 'ur-create-username', over.username ?? NEW_OPERATOR.username)
  typeField(dialog, 'ur-create-name', over.name ?? NEW_OPERATOR.name)
  typeField(dialog, 'ur-create-initials', over.initials ?? NEW_OPERATOR.initials)
  if (over.role && over.role !== 'INVESTIGATOR') fireEvent.click(within(within(dialog).getByTestId(`ur-create-role-option-${over.role}`)).getByRole('radio'))
}

beforeEach(() => {
  resetMissingI18nKeys()
  resetCoreErrorPresenter()
  webErrorSink.clear()
  window.localStorage.clear()
  window.sessionStorage.clear()
  window.sessionStorage.setItem(SHELL_INTRO_STORAGE_KEY, '1')
})

afterEach(async () => {
  cleanup()
  await clearToasts()
  disposeBeds()
  vi.restoreAllMocks()
})

describe('RB-9 as amended: the trio belongs to the vendor `root` account', () => {
  it('a holder of USER_ADMIN who is not `root` is offered none of the three, and keeps the three of §10.2', async () => {
    const { bed } = await openUsersRoles({ session: SUPERVISOR_ADMIN_SESSION })
    expect(requests(bed, 'getAuthSession').length).toBeGreaterThan(0)
    // The page is there, the list is there — only the account actions are not.
    expect(screen.getByTestId('ur-users-table')).toBeInTheDocument()
    expect(screen.queryByTestId('ur-create-user')).not.toBeInTheDocument()

    const menu = await openRowMenu('OPR-003')
    expect(await within(menu).findByTestId('ur-change-role-OPR-003')).toBeInTheDocument()
    expect(within(menu).getByTestId('ur-disable-OPR-003')).toBeInTheDocument()
    expect(within(menu).queryByTestId('ur-edit-user-OPR-003')).not.toBeInTheDocument()
    expect(within(menu).queryByTestId('ur-delete-user-OPR-003')).not.toBeInTheDocument()
    expect(getMissingI18nKeys()).toEqual([])
  })

  it('the vendor `root` account is offered all three', async () => {
    await openAsRoot()
    expect(await screen.findByTestId('ur-create-user')).toBeEnabled()
    const menu = await openRowMenu('OPR-003')
    expect(await within(menu).findByTestId('ur-edit-user-OPR-003')).toBeInTheDocument()
    expect(within(menu).getByTestId('ur-delete-user-OPR-003')).toBeInTheDocument()
    // The three of §10.2 are still there: the trio joins them, it does not replace them.
    expect(within(menu).getByTestId('ur-change-role-OPR-003')).toBeInTheDocument()
    expect(getMissingI18nKeys()).toEqual([])
  })

  it('the last enabled administrator cannot be deleted either: the item is disabled with the hint', async () => {
    await openAsRoot()
    const menu = await openRowMenu('OPR-002')
    const item = await within(menu).findByTestId('ur-delete-user-OPR-002')
    expect(item.textContent).toContain(U.lastAdmin)
    // [SP:RB-8]: `disabledKeys` holds the delete as it holds the disable (the page's own pin).
    expect(item).toHaveAttribute('aria-disabled', 'true')
    expect(within(menu).getByTestId('ur-disable-OPR-002')).toHaveAttribute('aria-disabled', 'true')
    expect(within(menu).getByTestId('ur-edit-user-OPR-002')).not.toHaveAttribute('aria-disabled', 'true')
  })
})

describe('createUser (operation 15)', () => {
  it('a press with empty or malformed fields names the field and sends nothing', async () => {
    const { bed } = await openAsRoot()
    await press(screen.getByTestId('ur-create-user'))
    const dialog = await screen.findByTestId('ur-create-dialog')

    await press(within(dialog).getByTestId('ur-create-confirm'))
    expect(within(dialog).getByTestId('ur-create-username-error')).toHaveTextContent(t_required(U.fields.usernameLabel))
    expect(within(dialog).getByTestId('ur-create-name-error')).toBeInTheDocument()
    expect(within(dialog).getByTestId('ur-create-initials-error')).toBeInTheDocument()
    expect(requests(bed, 'createUser')).toHaveLength(0)

    // A username the contract's pattern refuses, and one the list already holds.
    typeField(dialog, 'ur-create-username', 'Sari Officer!')
    await press(within(dialog).getByTestId('ur-create-confirm'))
    expect(within(dialog).getByTestId('ur-create-username-error')).toHaveTextContent(U.fields.errors.username.replace('{{max}}', '64'))
    typeField(dialog, 'ur-create-username', 'rina.wijaya')
    await press(within(dialog).getByTestId('ur-create-confirm'))
    expect(within(dialog).getByTestId('ur-create-username-error')).toHaveTextContent(U.fields.errors.usernameTaken)
    expect(requests(bed, 'createUser')).toHaveLength(0)
    // Typing again clears the field's own error.
    typeField(dialog, 'ur-create-username', 'sari.officer')
    expect(within(dialog).queryByTestId('ur-create-username-error')).not.toBeInTheDocument()
  })

  it('200 with an initial password: one body with the trimmed values, the toast, and the password in nothing but the body', async () => {
    const { bed } = await openAsRoot()
    bed.fake.answer('listUsers', () => list([...seededUsers(bed), { ...seededUsers(bed)[0]!, id: 'OPR-006', username: NEW_OPERATOR.username, displayName: 'Sari Melati', initials: 'SM' }]))
    await press(screen.getByTestId('ur-create-user'))
    const dialog = await screen.findByTestId('ur-create-dialog')
    await fillCreateForm(dialog)
    fireEvent.change(within(dialog).getByTestId('ur-create-password-input'), { target: { value: '  shift-2026-start  ' } })
    typeField(dialog, 'ur-create-reason', '  Covers the night shift  ')
    await press(within(dialog).getByTestId('ur-create-confirm'))
    await bed.flush()

    await waitClosed('ur-create-dialog')
    expect(requests(bed, 'createUser')).toHaveLength(1)
    expect(requests(bed, 'createUser')[0]).toMatchObject({ method: 'POST', path: '/api/v1/admin/users' })
    expect(requests(bed, 'createUser')[0]!.body).toEqual({
      username: 'sari.officer',
      name: 'Sari Melati',
      initials: 'SM',
      role: 'INVESTIGATOR',
      password: 'shift-2026-start',
      reason: 'Covers the night shift',
    })
    await waitFor(() => expect(toastsWith(fill(U.toasts.created, { name: 'Sari Melati' }))).toHaveLength(1))
    expect(toastsWith(U.toasts.createdWithPassword)).toHaveLength(1)
    // The new row arrives with the read the page asks for after a 200.
    await waitFor(() => expect(screen.getByTestId('ur-user-OPR-006')).toBeInTheDocument())
    // The password is never written down anywhere else.
    expect(JSON.stringify(webErrorSink.records())).not.toContain('shift-2026-start')
    expect(JSON.stringify(requests(bed, 'deleteUser'))).not.toContain('shift-2026-start')
    expect(getMissingI18nKeys()).toEqual([])
  })

  it('200 without a password still creates the account and says it cannot sign in yet', async () => {
    const { bed } = await openAsRoot()
    await press(screen.getByTestId('ur-create-user'))
    const dialog = await screen.findByTestId('ur-create-dialog')
    await fillCreateForm(dialog)
    await press(within(dialog).getByTestId('ur-create-confirm'))
    await bed.flush()

    await waitClosed('ur-create-dialog')
    expect(requests(bed, 'createUser')).toHaveLength(1)
    // The member is left out entirely — the contract reads an absent `password` as "no credential".
    expect(requests(bed, 'createUser')[0]!.body).not.toHaveProperty('password')
    await waitFor(() => expect(toastsWith(fill(U.toasts.created, { name: 'Sari Melati' }))).toHaveLength(1))
    expect(toastsWith(U.toasts.createdNoPassword)).toHaveLength(1)
    expect(toastsWith(U.toasts.createdWithPassword)).toHaveLength(0)
  })

  it('a 422 (a username the server says is taken) words itself inline and keeps the dialog open', async () => {
    await openAsRoot((b) => b.fake.answerOnce('createUser', b.fake.example('createUser', 422)))
    await press(screen.getByTestId('ur-create-user'))
    const dialog = await screen.findByTestId('ur-create-dialog')
    await fillCreateForm(dialog)
    await press(within(dialog).getByTestId('ur-create-confirm'))
    await waitFor(() => expect(within(dialog).getByTestId('ur-create-error')).toHaveTextContent(U.createDialog.invalid))
    expect(screen.getByTestId('ur-create-dialog')).toBeInTheDocument()
  })
})

describe('updateUser (operation 16)', () => {
  it('the profile starts from the row, the confirm waits for a change, and the body holds only what differs', async () => {
    const { bed } = await openAsRoot()
    const dialog = await openDialog('OPR-003', 'edit-user', 'ur-edit-dialog')
    expect(within(dialog).getByTestId('ur-edit-target')).toHaveTextContent(`${RINA} (rina.wijaya)`)
    // No username field: `updateUser` is the profile only.
    expect(within(dialog).queryByTestId('ur-edit-username')).not.toBeInTheDocument()
    expect(within(dialog).getByTestId('ur-edit-confirm')).toBeDisabled()
    expect(within(dialog).getByTestId('ur-edit-untouched')).toHaveTextContent(U.editDialog.untouched)

    typeField(dialog, 'ur-edit-initials', 'SH')
    expect(within(dialog).getByTestId('ur-edit-confirm')).toBeEnabled()
    await press(within(dialog).getByTestId('ur-edit-confirm'))
    await bed.flush()

    await waitClosed('ur-edit-dialog')
    expect(requests(bed, 'updateUser')).toHaveLength(1)
    expect(requests(bed, 'updateUser')[0]).toMatchObject({ method: 'POST', path: '/api/v1/admin/users/OPR-003/profile' })
    expect(requests(bed, 'updateUser')[0]!.body).toEqual({ initials: 'SH' })
    await waitFor(() => expect(toastsWith(fill(U.toasts.updated, { name: RINA }))).toHaveLength(1))
    expect(getMissingI18nKeys()).toEqual([])
  })

  it('clearing the rank of a ranked operator sends `rank: null`', async () => {
    const { bed } = await openAsRoot((b) => b.fake.answer('updateUser', () => one({ ...seededUsers(bed).find((user) => user.id === 'OPR-001')!, rank: null })))
    const dialog = await openDialog('OPR-001', 'edit-user', 'ur-edit-dialog')
    typeField(dialog, 'ur-edit-rank', '')
    expect(within(dialog).getByTestId('ur-edit-confirm')).toBeEnabled()
    await press(within(dialog).getByTestId('ur-edit-confirm'))
    await bed.flush()
    expect(requests(bed, 'updateUser')[0]!.body).toEqual({ rank: null })
    await waitClosed('ur-edit-dialog')
  })

  it('an initials field emptied by hand is refused before the press, not sent', async () => {
    const { bed } = await openAsRoot()
    const dialog = await openDialog('OPR-003', 'edit-user', 'ur-edit-dialog')
    typeField(dialog, 'ur-edit-name', 'Rina W.')
    typeField(dialog, 'ur-edit-initials', '   ')
    expect(within(dialog).getByTestId('ur-edit-confirm')).toBeEnabled()
    await press(within(dialog).getByTestId('ur-edit-confirm'))
    expect(within(dialog).getByTestId('ur-edit-initials-error')).toHaveTextContent(t_required(U.fields.initialsLabel))
    expect(requests(bed, 'updateUser')).toHaveLength(0)
    expect(screen.getByTestId('ur-edit-dialog')).toBeInTheDocument()
  })
})

describe('deleteUser (operation 17)', () => {
  it('the confirm waits for the typed username and the body carries it as `confirm`', async () => {
    const { bed } = await openAsRoot()
    // The row is there until the Core has answered the delete; the read after the 200 drops it.
    bed.fake.answer('listUsers', () => list(requests(bed, 'deleteUser').length === 0 ? seededUsers(bed) : seededUsers(bed).filter((user) => user.id !== 'OPR-003')))
    const dialog = await openDialog('OPR-003', 'delete-user', 'ur-delete-dialog')
    expect(dialog).toHaveTextContent(fill(U.deleteDialog.body, { name: RINA, username: 'rina.wijaya' }))
    expect(within(dialog).getByTestId('ur-delete-confirm')).toBeDisabled()

    typeField(dialog, 'ur-delete-confirm-input', 'rina')
    // A near miss is not a confirmation: the press would refuse it, and the button is out of reach.
    expect(within(dialog).getByTestId('ur-delete-confirm')).toBeDisabled()
    typeField(dialog, 'ur-delete-confirm-input', ' rina.wijaya ')
    expect(within(dialog).getByTestId('ur-delete-confirm')).toBeEnabled()

    typeField(dialog, 'ur-delete-reason', 'Left the unit')
    await press(within(dialog).getByTestId('ur-delete-confirm'))
    await bed.flush()

    expect(requests(bed, 'deleteUser')).toHaveLength(1)
    expect(requests(bed, 'deleteUser')[0]).toMatchObject({ method: 'POST', path: '/api/v1/admin/users/OPR-003/delete' })
    expect(requests(bed, 'deleteUser')[0]!.body).toEqual({ confirm: 'rina.wijaya', reason: 'Left the unit' })
    await waitClosed('ur-delete-dialog')
    await waitFor(() => expect(toastsWith(fill(U.toasts.deleted, { username: 'rina.wijaya' }))).toHaveLength(1))
    // The row leaves with the read the page asks for after the 200.
    await waitFor(() => expect(screen.queryByTestId('ur-user-OPR-003')).not.toBeInTheDocument())
    expect(getMissingI18nKeys()).toEqual([])
  })

  it('409 `INVALID_STATE` (the account is still named by a live row): the sentence, the dialog open, nothing removed', async () => {
    const { bed } = await openAsRoot((b) => b.fake.answerOnce('deleteUser', { status: 409, body: { error: { code: 'INVALID_STATE', message: 'The operator is named by an open session.' } } }))
    const dialog = await openDialog('OPR-003', 'delete-user', 'ur-delete-dialog')
    typeField(dialog, 'ur-delete-confirm-input', 'rina.wijaya')
    await press(within(dialog).getByTestId('ur-delete-confirm'))

    await waitFor(() => expect(within(dialog).getByTestId('ur-delete-error')).toHaveTextContent(U.deleteDialog.invalidState))
    expect(within(dialog).getByTestId('ur-delete-error')).toHaveAttribute('data-error', 'invalidState')
    // Still open, still holding what was typed, and the row is where it was.
    expect(screen.getByTestId('ur-delete-dialog')).toBeInTheDocument()
    expect(within(dialog).getByTestId('ur-delete-confirm-input')).toBeInTheDocument()
    expect(screen.getByTestId('ur-user-OPR-003')).toBeInTheDocument()
    expect(requests(bed, 'deleteUser')).toHaveLength(1)
  })

  it('409 `LAST_ADMIN` words the hint of §10.2 and keeps the dialog open', async () => {
    // Two enabled administrators in the list: the client's hint lets the delete through, and the
    // server's answer is what decides (the hint of §10.2 is only a hint).
    const { bed } = await openAsRoot((b) => {
      b.fake.answer('listUsers', () => list(usersWith(b, 'OPR-001', { role: 'SUPERVISOR' })))
      b.fake.answerOnce('deleteUser', b.fake.example('deleteUser', 409, 'lastAdmin'))
    })
    const dialog = await openDialog('OPR-002', 'delete-user', 'ur-delete-dialog')
    typeField(dialog, 'ur-delete-confirm-input', 'andi.pratama')
    await press(within(dialog).getByTestId('ur-delete-confirm'))
    await waitFor(() => expect(within(dialog).getByTestId('ur-delete-error')).toHaveTextContent(U.lastAdmin))
    expect(screen.getByTestId('ur-delete-dialog')).toBeInTheDocument()
    expect(requests(bed, 'deleteUser')).toHaveLength(1)
  })

  it('a 403 (the UI gate is cosmetics; the server is the authority) closes the dialog', async () => {
    const { bed } = await openAsRoot((b) => b.fake.answerOnce('deleteUser', b.fake.example('deleteUser', 403, 'notPermitted')))
    const dialog = await openDialog('OPR-003', 'delete-user', 'ur-delete-dialog')
    typeField(dialog, 'ur-delete-confirm-input', 'rina.wijaya')
    await press(within(dialog).getByTestId('ur-delete-confirm'))
    await waitClosed('ur-delete-dialog')
    expect(screen.getByTestId('ur-user-OPR-003')).toBeInTheDocument()
    expect(requests(bed, 'deleteUser')).toHaveLength(1)
  })
})

/** `usersRoles.fields.errors.required` worded for one label (the same sentence the dialog builds). */
function t_required(label: string): string {
  return U.fields.errors.required.replace('{{label}}', label)
}
