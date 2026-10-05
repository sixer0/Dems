/**
 * @vitest-environment jsdom
 * @vitest-environment-options { "url": "http://127.0.0.1:5178/" }
 */
// Plan row W77: the three commands of the Users & Roles page in Live mode on the contract-checked
// fake transport (backend task 04_client_integration_spec §10.2, §10.1 PG-11, §6.2; §8.1 LB-1,
// LB-6, LB-10; §13.9). Each command: success, the refusal with the denied toast (a 403 by its
// `notPermitted` example: the FIRST 403 example of every operation is `deviceRevoked`, F76-8), the
// 409 `LAST_ADMIN` inline where the operation has it, an outage.
//
// | Criterion | Where it is proven here |
// |-----------|-------------------------|
// | AC-C-87 a role change sends operation 12, closes the dialog, shows the toast and updates the row; the confirm is disabled while the role is unchanged; "Gains" / "Loses" from the matrix | "AC-C-87" |
// | AC-C-88 409 `LAST_ADMIN` shows the inline Alert, keeps the dialog open and changes nothing; the hint disables the options for the last administrator | "AC-C-88" |
// | AC-C-89 disable and enable send operations 14 and 13 and morph the status chip; disabling the caller's own account warns first | "AC-C-89" |
// | AC-C-48 / PG-11 a 403 closes the dialog and shows the denied toast naming the Supervisor; an outage keeps the dialog open with the presenter's sentence; a 429 is a limit, never an outage | each command's block |
// | LB-1 (W0 §15) `aria-busy` on the confirm from the press, the kit's pending look only after the reveal time, a second press sends nothing | "LB-1" |
// | PG-6a a 200 that arrives after the session ended puts nothing back into the cache | "PG-6a" |
// | Rule 2 the page's own branch (a 404) writes one record with a fixed sentence and a `usr-` correlation ID; never the reason typed | "AC-C-87" (404) |
import { act, cleanup, configure, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { en } from '@dems/shared/i18n'
import { rateLimited } from '@dems/shared/live/testing'
import { SHELL_INTRO_STORAGE_KEY } from '@/components/shell/shell-entrance'
import { getMissingI18nKeys, resetMissingI18nKeys } from '@/i18n'
import { resetCoreErrorPresenter } from '@/lib/core-errors'
import { CORE_QUERY_KEYS, webErrorSink } from '@/runtime'
import type { LiveTestBed } from '@/runtime/testing/live-harness'
import {
  chooseRole,
  clearToasts,
  disposeBeds,
  list,
  one,
  openDialog,
  openRowMenu,
  openUsersRoles,
  press,
  seededUsers,
  toastsWith,
  typeReason,
  usersWith,
  waitClosed,
} from '@/features/users-roles/__tests__/users-roles-bed'

configure({ asyncUtilTimeout: 8_000 })
vi.setConfig({ testTimeout: 25_000 })

const U = en.usersRoles
const P = en.securityAudit.rbac.permissions
const DENIED = en.common.rbac.deniedTitle
const REQUIRES_SUPERVISOR = en.common.rbac.requiresRole.replace('{{role}}', en.common.roles.SUPERVISOR)
const OFFLINE = en.common.coreErrors.offline
const RINA = 'Rina Wijaya'
const BUDI = 'AKP Budi Santoso'
const fill = (text: string, values: Record<string, string>) => Object.entries(values).reduce((out, [key, value]) => out.replace(`{{${key}}}`, value), text)
const requests = (bed: LiveTestBed, op: string) => bed.fake.log.requestsOf(op)
/** The seeded list with a second enabled SUPERVISOR (OPR-001): nobody is the last administrator. */
const twoAdmins = (bed: LiveTestBed) => usersWith(bed, 'OPR-001', { role: 'SUPERVISOR' })

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

describe('AC-C-87: a role change (operation 12)', () => {
  it('the current role is preselected and the confirm is disabled until another role is chosen; "Gains" and "Loses" come from the matrix', async () => {
    await openUsersRoles()
    const dialog = await openDialog('OPR-003', 'change-role', 'ur-role-dialog')
    expect(within(dialog).getByTestId('ur-role-target')).toHaveTextContent(`${RINA} (rina.wijaya)`)
    expect(within(within(dialog).getByTestId('ur-role-option-TECHNICIAN')).getByRole('radio')).toBeChecked()
    expect(within(dialog).getByTestId('ur-role-confirm')).toBeDisabled()
    expect(within(dialog).getByTestId('ur-role-diff')).toHaveTextContent(U.roleDialog.sameRole)
    expect(within(dialog).queryByTestId('ur-role-own')).not.toBeInTheDocument()
    // Nobody is blocked: the technician is no administrator.
    for (const role of ['INVESTIGATOR', 'SUPERVISOR', 'TECHNICIAN']) expect(within(dialog).getByTestId(`ur-role-option-${role}`)).not.toHaveAttribute('data-blocked')

    chooseRole(dialog, 'INVESTIGATOR')
    expect(within(dialog).getByTestId('ur-role-confirm')).toBeEnabled()
    const gains = within(dialog).getByTestId('ur-role-gains')
    const loses = within(dialog).getByTestId('ur-role-loses')
    expect(within(gains).getAllByRole('listitem').map((item) => item.textContent)).toEqual([P.SESSION_START, P.SESSION_NOTE])
    expect(within(loses).getAllByRole('listitem').map((item) => item.textContent)).toEqual([P.DEVICE_MANAGE, P.MAINTENANCE])
    expect(within(dialog).getByTestId('ur-role-diff')).toHaveTextContent(U.roleDialog.note)

    // Back to the current role: the confirm is disabled again.
    chooseRole(dialog, 'TECHNICIAN')
    expect(within(dialog).getByTestId('ur-role-confirm')).toBeDisabled()
    expect(getMissingI18nKeys()).toEqual([])
  })

  it('200: sends operation 12 with the role and the trimmed reason, closes the dialog, shows the toast, updates the row and reads the list again', async () => {
    const { bed, mounted } = await openUsersRoles()
    const changed = { ...seededUsers(bed).find((user) => user.id === 'OPR-003')!, role: 'INVESTIGATOR' as const, roleChangedAt: bed.fake.clock.now() }
    bed.fake.answer('assignUserRole', one(changed))
    bed.fake.answer('listUsers', () => list(usersWith(bed, 'OPR-003', changed)))
    const dialog = await openDialog('OPR-003', 'change-role', 'ur-role-dialog')
    chooseRole(dialog, 'INVESTIGATOR')
    typeReason(dialog, 'ur-role-reason', '  Covers the interview shift  ')
    await press(within(dialog).getByTestId('ur-role-confirm'))
    await bed.flush()

    await waitClosed('ur-role-dialog')
    expect(requests(bed, 'assignUserRole')).toHaveLength(1)
    expect(requests(bed, 'assignUserRole')[0]).toMatchObject({
      method: 'POST',
      path: '/api/v1/admin/users/OPR-003/role',
      body: { role: 'INVESTIGATOR', reason: 'Covers the interview shift' },
    })
    await waitFor(() => expect(toastsWith(fill(U.toasts.roleChanged, { name: RINA, role: en.common.roles.INVESTIGATOR }))).toHaveLength(1))
    await waitFor(() => expect(screen.getByTestId('ur-role-OPR-003')).toHaveAttribute('data-role', 'INVESTIGATOR'))
    expect(screen.getByTestId('ur-user-OPR-003')).toHaveAttribute('data-highlight', 'true')
    await waitFor(() => expect(requests(bed, 'listUsers')).toHaveLength(2))
    expect(mounted.queryClient.getQueryData(CORE_QUERY_KEYS.users)).toMatchObject({ users: expect.arrayContaining([expect.objectContaining({ id: 'OPR-003', role: 'INVESTIGATOR' })]) })
    // The reason never reaches the page's own log.
    expect(JSON.stringify(webErrorSink.records())).not.toContain('interview shift')
  })

  it('an empty reason (spaces only) is left out of the body', async () => {
    const { bed } = await openUsersRoles()
    bed.fake.answer('assignUserRole', one({ ...seededUsers(bed).find((user) => user.id === 'OPR-001')!, role: 'TECHNICIAN' }))
    const dialog = await openDialog('OPR-001', 'change-role', 'ur-role-dialog')
    chooseRole(dialog, 'TECHNICIAN')
    typeReason(dialog, 'ur-role-reason', '   ')
    await press(within(dialog).getByTestId('ur-role-confirm'))
    await waitClosed('ur-role-dialog')
    expect(requests(bed, 'assignUserRole')[0]!.body).toEqual({ role: 'TECHNICIAN' })
  })

  it('403 (`notPermitted`): the dialog closes, the denied toast names the Supervisor, the row is unchanged', async () => {
    const { bed } = await openUsersRoles()
    bed.fake.answerOnce('assignUserRole', bed.fake.example('assignUserRole', 403, 'notPermitted'))
    const dialog = await openDialog('OPR-003', 'change-role', 'ur-role-dialog')
    chooseRole(dialog, 'INVESTIGATOR')
    await press(within(dialog).getByTestId('ur-role-confirm'))
    await bed.flush()
    await waitClosed('ur-role-dialog')
    await waitFor(() => expect(toastsWith(DENIED)).toHaveLength(1))
    expect(toastsWith(DENIED)[0]).toContain(REQUIRES_SUPERVISOR)
    expect(screen.getByTestId('ur-role-OPR-003')).toHaveAttribute('data-role', 'TECHNICIAN')
    expect(toastsWith(fill(U.toasts.roleChanged, { name: RINA, role: en.common.roles.INVESTIGATOR }))).toHaveLength(0)
  })

  it('an outage: the presenter\'s sentence, and the dialog stays open with the choice kept', async () => {
    const { bed } = await openUsersRoles()
    bed.fake.failOnce('assignUserRole')
    const dialog = await openDialog('OPR-003', 'change-role', 'ur-role-dialog')
    chooseRole(dialog, 'INVESTIGATOR')
    await press(within(dialog).getByTestId('ur-role-confirm'))
    await bed.flush()
    await waitFor(() => expect(toastsWith(OFFLINE)).toHaveLength(1))
    expect(screen.getByTestId('ur-role-dialog')).toBeInTheDocument()
    expect(within(screen.getByTestId('ur-role-dialog')).getByTestId('ur-role-confirm')).toBeEnabled()
    expect(within(within(screen.getByTestId('ur-role-dialog')).getByTestId('ur-role-option-INVESTIGATOR')).getByRole('radio')).toBeChecked()
    expect(screen.getByTestId('ur-role-OPR-003')).toHaveAttribute('data-role', 'TECHNICIAN')
    // The control was released: no busy mark, Cancel usable, and a second press is sent and can succeed.
    const confirm = within(screen.getByTestId('ur-role-dialog')).getByTestId('ur-role-confirm')
    expect(confirm).not.toHaveAttribute('aria-busy')
    expect(within(screen.getByTestId('ur-role-dialog')).getByTestId('ur-role-cancel')).toBeEnabled()
    bed.fake.answer('assignUserRole', one({ ...seededUsers(bed).find((user) => user.id === 'OPR-003')!, role: 'INVESTIGATOR' }))
    await press(confirm)
    await bed.flush()
    await waitClosed('ur-role-dialog')
    expect(requests(bed, 'assignUserRole')).toHaveLength(2)
  })

  it('LB-10: a 429 shows the limit toast and keeps the dialog open; no outage sentence', async () => {
    const { bed } = await openUsersRoles()
    bed.fake.answerOnce('assignUserRole', rateLimited(5))
    const dialog = await openDialog('OPR-003', 'change-role', 'ur-role-dialog')
    chooseRole(dialog, 'INVESTIGATOR')
    await press(within(dialog).getByTestId('ur-role-confirm'))
    await bed.flush()
    await waitFor(() => expect(toastsWith(en.common.coreErrors.limited.replace('{{seconds}}', '5'))).toHaveLength(1))
    expect(toastsWith(OFFLINE)).toHaveLength(0)
    expect(screen.getByTestId('ur-role-dialog')).toBeInTheDocument()
  })

  it('422: the inline sentence; the dialog stays open', async () => {
    const { bed } = await openUsersRoles()
    bed.fake.answerOnce('assignUserRole', bed.fake.example('assignUserRole', 422, 'invalidInput'))
    const dialog = await openDialog('OPR-003', 'change-role', 'ur-role-dialog')
    chooseRole(dialog, 'INVESTIGATOR')
    await press(within(dialog).getByTestId('ur-role-confirm'))
    await bed.flush()
    const error = await within(screen.getByTestId('ur-role-dialog')).findByTestId('ur-role-error')
    expect(error).toHaveTextContent(U.roleDialog.invalid)
    expect(error).toHaveAttribute('data-error', 'invalid')
  })

  it('404: a toast, the dialog closes, the list is read again, and the page writes one record with a fixed sentence', async () => {
    const { bed } = await openUsersRoles()
    bed.fake.answerOnce('assignUserRole', bed.fake.example('assignUserRole', 404, 'notFound'))
    const dialog = await openDialog('OPR-003', 'change-role', 'ur-role-dialog')
    chooseRole(dialog, 'INVESTIGATOR')
    typeReason(dialog, 'ur-role-reason', 'secret-marker-77')
    await press(within(dialog).getByTestId('ur-role-confirm'))
    await bed.flush()
    await waitClosed('ur-role-dialog')
    await waitFor(() => expect(toastsWith(U.toasts.notFound)).toHaveLength(1))
    await waitFor(() => expect(requests(bed, 'listUsers')).toHaveLength(2))
    const records = webErrorSink.records().filter((record) => record.source === 'features/users-roles.assignUserRole')
    expect(records).toHaveLength(1)
    expect(records[0]).toMatchObject({
      level: 'warn',
      message: 'A role change of Users & Roles was not carried out.',
      context: { operationId: 'assignUserRole', operatorId: 'OPR-003', code: 'NOT_FOUND', errorName: 'AdminCommandError' },
    })
    expect(String(records[0]!.context?.correlationId)).toMatch(/^usr-/)
    expect(JSON.stringify(webErrorSink.records())).not.toContain('secret-marker-77')
  })
})

describe('AC-C-88: the last administrator', () => {
  it('the hint: the only enabled holder of USER_ADMIN cannot be given a role without it; the own row warns', async () => {
    await openUsersRoles()
    const dialog = await openDialog('OPR-002', 'change-role', 'ur-role-dialog')
    expect(within(dialog).getByTestId('ur-role-own')).toHaveTextContent(U.roleDialog.ownRow)
    for (const role of ['INVESTIGATOR', 'TECHNICIAN']) {
      const option = within(dialog).getByTestId(`ur-role-option-${role}`)
      expect(option).toHaveAttribute('data-blocked', 'true')
      expect(within(option).getByRole('radio')).toBeDisabled()
      expect(option).toHaveTextContent(U.lastAdmin)
    }
    expect(within(dialog).getByTestId('ur-role-option-SUPERVISOR')).not.toHaveAttribute('data-blocked')
    expect(within(dialog).getByTestId('ur-role-confirm')).toBeDisabled()
  })

  it('409 `LAST_ADMIN` (the server decides: the list still showed two administrators): the inline Alert, the dialog stays open, nothing changed', async () => {
    const { bed, mounted } = await openUsersRoles({ script: (b) => b.fake.answer('listUsers', () => list(twoAdmins(b))) })
    const before = mounted.queryClient.getQueryData(CORE_QUERY_KEYS.users)
    bed.fake.answerOnce('assignUserRole', bed.fake.example('assignUserRole', 409, 'lastAdmin'))
    const dialog = await openDialog('OPR-002', 'change-role', 'ur-role-dialog')
    expect(within(dialog).getByTestId('ur-role-option-INVESTIGATOR')).not.toHaveAttribute('data-blocked')
    chooseRole(dialog, 'INVESTIGATOR')
    await press(within(dialog).getByTestId('ur-role-confirm'))
    await bed.flush()
    const error = await within(screen.getByTestId('ur-role-dialog')).findByTestId('ur-role-error')
    expect(error).toHaveTextContent(U.lastAdmin)
    expect(error).toHaveAttribute('data-error', 'lastAdmin')
    expect(screen.getByTestId('ur-role-dialog')).toBeInTheDocument()
    // Nothing changed: no success toast, the same row, the list not read again, no denied or outage toast.
    expect(screen.getByTestId('ur-role-OPR-002')).toHaveAttribute('data-role', 'SUPERVISOR')
    expect(mounted.queryClient.getQueryData(CORE_QUERY_KEYS.users)).toBe(before)
    expect(requests(bed, 'listUsers')).toHaveLength(1)
    expect(toastsWith(DENIED)).toHaveLength(0)
    expect(toastsWith(OFFLINE)).toHaveLength(0)
    // Choosing again clears the inline Alert.
    chooseRole(screen.getByTestId('ur-role-dialog'), 'TECHNICIAN')
    expect(within(screen.getByTestId('ur-role-dialog')).queryByTestId('ur-role-error')).not.toBeInTheDocument()
  })
})

describe('AC-C-89: disable (operation 14) and enable (operation 13)', () => {
  it('disable 200: sends operation 14 with the reason, closes, the status chip turns Disabled, the toast, and the menu now offers "Enable user"', async () => {
    const { bed } = await openUsersRoles()
    const disabled = { ...seededUsers(bed).find((user) => user.id === 'OPR-001')!, enabled: false, activeSessions: 0 }
    bed.fake.answer('disableUser', one(disabled))
    bed.fake.answer('listUsers', () => list(usersWith(bed, 'OPR-001', disabled)))
    const dialog = await openDialog('OPR-001', 'disable', 'ur-disable-dialog')
    expect(dialog).toHaveTextContent(fill(U.disableDialog.body, { name: BUDI }))
    expect(within(dialog).queryByTestId('ur-disable-own')).not.toBeInTheDocument()
    typeReason(dialog, 'ur-disable-reason', 'On leave')
    await press(within(dialog).getByTestId('ur-disable-confirm'))
    await bed.flush()
    await waitClosed('ur-disable-dialog')
    expect(requests(bed, 'disableUser')[0]).toMatchObject({ method: 'POST', path: '/api/v1/admin/users/OPR-001/disable', body: { reason: 'On leave' } })
    await waitFor(() => expect(screen.getByTestId('ur-status-OPR-001')).toHaveAttribute('data-enabled', 'false'))
    expect(screen.getByTestId('ur-status-OPR-001')).toHaveTextContent(U.users.disabled)
    await waitFor(() => expect(toastsWith(fill(U.toasts.disabled, { name: BUDI }))).toHaveLength(1))
    const menu = await openRowMenu('OPR-001')
    expect(within(menu).getByTestId('ur-enable-OPR-001')).toBeInTheDocument()
  })

  it('disabling the caller\'s own account warns first ("You will be signed out."), before anything is sent', async () => {
    const { bed } = await openUsersRoles({ script: (b) => b.fake.answer('listUsers', () => list(twoAdmins(b))) })
    const dialog = await openDialog('OPR-002', 'disable', 'ur-disable-dialog')
    expect(within(dialog).getByTestId('ur-disable-own')).toHaveTextContent(U.disableDialog.ownRow)
    expect(requests(bed, 'disableUser')).toHaveLength(0)
    fireEvent.click(within(dialog).getByTestId('ur-disable-cancel'))
    await waitClosed('ur-disable-dialog')
    expect(requests(bed, 'disableUser')).toHaveLength(0)
  })

  it('disable 409 `LAST_ADMIN`: the inline Alert, the dialog stays open, the chip stays Enabled', async () => {
    const { bed } = await openUsersRoles({ script: (b) => b.fake.answer('listUsers', () => list(twoAdmins(b))) })
    bed.fake.answerOnce('disableUser', bed.fake.example('disableUser', 409, 'lastAdmin'))
    const dialog = await openDialog('OPR-001', 'disable', 'ur-disable-dialog')
    await press(within(dialog).getByTestId('ur-disable-confirm'))
    await bed.flush()
    const error = await within(screen.getByTestId('ur-disable-dialog')).findByTestId('ur-disable-error')
    expect(error).toHaveTextContent(U.lastAdmin)
    expect(screen.getByTestId('ur-status-OPR-001')).toHaveAttribute('data-enabled', 'true')
    expect(requests(bed, 'listUsers')).toHaveLength(1)
  })

  it('disable 403 (`notPermitted`): the dialog closes and the denied toast names the Supervisor', async () => {
    const { bed } = await openUsersRoles()
    bed.fake.answerOnce('disableUser', bed.fake.example('disableUser', 403, 'notPermitted'))
    const dialog = await openDialog('OPR-001', 'disable', 'ur-disable-dialog')
    await press(within(dialog).getByTestId('ur-disable-confirm'))
    await bed.flush()
    await waitClosed('ur-disable-dialog')
    await waitFor(() => expect(toastsWith(DENIED)).toHaveLength(1))
    expect(toastsWith(DENIED)[0]).toContain(REQUIRES_SUPERVISOR)
    expect(screen.getByTestId('ur-status-OPR-001')).toHaveAttribute('data-enabled', 'true')
  })

  it('disable outage: the presenter\'s sentence; the dialog stays open', async () => {
    const { bed } = await openUsersRoles()
    bed.fake.failOnce('disableUser')
    const dialog = await openDialog('OPR-001', 'disable', 'ur-disable-dialog')
    await press(within(dialog).getByTestId('ur-disable-confirm'))
    await bed.flush()
    await waitFor(() => expect(toastsWith(OFFLINE)).toHaveLength(1))
    expect(screen.getByTestId('ur-disable-dialog')).toBeInTheDocument()
    expect(screen.getByTestId('ur-status-OPR-001')).toHaveAttribute('data-enabled', 'true')
  })

  it('enable 200: sends operation 13 without a body, closes, the status chip turns Enabled, the toast', async () => {
    const { bed } = await openUsersRoles({ script: (b) => b.fake.answer('listUsers', () => list(usersWith(b, 'OPR-003', { enabled: false }))) })
    const enabled = seededUsers(bed).find((user) => user.id === 'OPR-003')!
    bed.fake.answer('enableUser', one(enabled))
    bed.fake.answer('listUsers', () => list(seededUsers(bed)))
    const dialog = await openDialog('OPR-003', 'enable', 'ur-enable-dialog')
    expect(dialog).toHaveTextContent(fill(U.enableDialog.body, { name: RINA }))
    await press(within(dialog).getByTestId('ur-enable-confirm'))
    await bed.flush()
    await waitClosed('ur-enable-dialog')
    expect(requests(bed, 'enableUser')[0]).toMatchObject({ method: 'POST', path: '/api/v1/admin/users/OPR-003/enable', bodyText: null })
    await waitFor(() => expect(screen.getByTestId('ur-status-OPR-003')).toHaveAttribute('data-enabled', 'true'))
    expect(screen.getByTestId('ur-status-OPR-003')).toHaveTextContent(U.users.enabled)
    await waitFor(() => expect(toastsWith(fill(U.toasts.enabled, { name: RINA }))).toHaveLength(1))
  })

  it('enable 403 (`notPermitted`): the dialog closes, the denied toast; enable outage: the dialog stays open', async () => {
    const { bed } = await openUsersRoles({ script: (b) => b.fake.answer('listUsers', () => list(usersWith(b, 'OPR-003', { enabled: false }))) })
    bed.fake.answerOnce('enableUser', bed.fake.example('enableUser', 403, 'notPermitted'))
    let dialog = await openDialog('OPR-003', 'enable', 'ur-enable-dialog')
    await press(within(dialog).getByTestId('ur-enable-confirm'))
    await bed.flush()
    await waitClosed('ur-enable-dialog')
    await waitFor(() => expect(toastsWith(DENIED)).toHaveLength(1))
    expect(screen.getByTestId('ur-status-OPR-003')).toHaveAttribute('data-enabled', 'false')

    bed.fake.failOnce('enableUser')
    dialog = await openDialog('OPR-003', 'enable', 'ur-enable-dialog')
    await press(within(dialog).getByTestId('ur-enable-confirm'))
    await bed.flush()
    await waitFor(() => expect(toastsWith(OFFLINE)).toHaveLength(1))
    expect(screen.getByTestId('ur-enable-dialog')).toBeInTheDocument()
  })
})

describe('LB-1: busy at once, spinner late, one command per press (W0 §15)', () => {
  it('while the role change is out the confirm is `aria-busy`, a second press sends nothing, and the pending look comes only after the reveal time', async () => {
    const { bed } = await openUsersRoles()
    const held = bed.fake.hold('assignUserRole')
    const dialog = await openDialog('OPR-003', 'change-role', 'ur-role-dialog')
    chooseRole(dialog, 'INVESTIGATOR')
    const confirm = within(dialog).getByTestId('ur-role-confirm')
    await press(confirm)
    await waitFor(() => expect(requests(bed, 'assignUserRole')).toHaveLength(1))
    // Busy at once, on the pressed button itself (the hook's ref); the look is unchanged.
    expect(confirm).toHaveAttribute('aria-busy', 'true')
    expect(confirm).not.toHaveAttribute('data-pending')
    expect(within(dialog).getByTestId('ur-role-cancel')).toBeDisabled()
    await press(confirm)
    await bed.flush()
    expect(requests(bed, 'assignUserRole')).toHaveLength(1)
    await waitFor(() => expect(confirm).toHaveAttribute('data-pending', 'true'), { timeout: 3_000 })
    const changed = { ...seededUsers(bed).find((user) => user.id === 'OPR-003')!, role: 'INVESTIGATOR' as const }
    await act(async () => {
      held.release(one(changed))
    })
    await bed.flush()
    await waitClosed('ur-role-dialog')
    expect(requests(bed, 'assignUserRole')).toHaveLength(1)
  })
})

describe('PG-6a: an answer that arrives after the session ended puts nothing back into the cache', () => {
  it('a self-disable: `session.ended` USER_DISABLED arrives before the 200; the users entry stays removed and the page is left', async () => {
    const { bed, mounted } = await openUsersRoles({ script: (b) => b.fake.answer('listUsers', () => list(twoAdmins(b))) })
    const held = bed.fake.hold('disableUser')
    const dialog = await openDialog('OPR-002', 'disable', 'ur-disable-dialog')
    await press(within(dialog).getByTestId('ur-disable-confirm'))
    await waitFor(() => expect(requests(bed, 'disableUser')).toHaveLength(1))
    await act(async () => {
      bed.core.end('USER_DISABLED')
    })
    await bed.flush()
    expect(mounted.queryClient.getQueryData(CORE_QUERY_KEYS.users)).toBeUndefined()
    const self = { ...twoAdmins(bed).find((user) => user.id === 'OPR-002')!, enabled: false, activeSessions: 0 }
    await act(async () => {
      held.release(one(self))
    })
    await bed.flush()
    expect(mounted.queryClient.getQueryData(CORE_QUERY_KEYS.users)).toBeUndefined()
    expect(mounted.queryClient.getQueryData(CORE_QUERY_KEYS.roleMatrix)).toBeUndefined()
    await waitFor(() => expect(mounted.router.state.location.pathname).toBe('/login'))
  })
})
