/**
 * The test bed of the Users & Roles page in Live mode (plan row W77). FOR TESTS ONLY: the folder
 * `__tests__` is outside the production scans (CLG (c), W0's static guard).
 *
 * It opens `/admin/users` on W50's harness (`@/runtime/testing/live-harness`): the real router, the
 * real Live start-up and the query bridge, the contract-checked fake transport. The harness's model
 * Core answers `listUsers` with the contract's seeded list; this bed adds `getRoleMatrix` (the
 * contract's seeded matrix), which the harness does not script (finding F77-1 of the row's
 * document). A test scripts anything else itself, before or after the page loads.
 *
 * The seeded operators (`@dems/shared/api/administration.ts`, examples): OPR-001 INVESTIGATOR,
 * OPR-002 SUPERVISOR (the signed-in operator of `SUPERVISOR_SESSION`, and the only holder of
 * USER_ADMIN), OPR-003 TECHNICIAN.
 */
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { toast } from '@heroui/react'
import { expect } from 'vitest'
import type { AdminUser, AuthSessionInfo, RoleMatrix } from '@dems/shared/api'
import { createLiveTestBed, SUPERVISOR_SESSION, type LivePage, type LiveTestBed, type MountedPage, type MountOptions } from '@/runtime/testing/live-harness'

export const PAGE_URL = 'http://127.0.0.1:5178/admin/users'

/**
 * The vendor account (RB-9 as amended 02-11-2026): `USER_ADMIN` like the SUPERVISOR, but with the
 * username the Core server and this page require for create, edit and delete. The ID is outside the
 * seeded list on purpose: the trio is about the gate, not about a row of one's own.
 */
export const ROOT_SESSION: Pick<AuthSessionInfo, 'operator' | 'permissions'> = {
  operator: { ...SUPERVISOR_SESSION.operator, id: 'OPR-009', username: 'root', rank: null, name: 'Vendor Root', displayName: 'Vendor Root', initials: 'VR' },
  permissions: SUPERVISOR_SESSION.permissions,
}

/** A holder of `USER_ADMIN` who is NOT the vendor account: the trio must stay out of sight. */
export const SUPERVISOR_ADMIN_SESSION: Pick<AuthSessionInfo, 'operator' | 'permissions'> = SUPERVISOR_SESSION

export interface OpenOptions {
  readonly session?: Pick<AuthSessionInfo, 'operator' | 'permissions'> | null
  /** Scripts answers before the page loads. */
  readonly script?: (bed: LiveTestBed) => void
  readonly mount?: MountOptions
  /** Wait for the operators table (default) or only for the page root. */
  readonly waitFor?: 'table' | 'page'
}

export interface OpenedPage {
  readonly bed: LiveTestBed
  readonly page: LivePage
  readonly mounted: MountedPage
}

/** The beds of the running test; `disposeBeds()` ends them (and checks the fake for violations). */
const beds: LiveTestBed[] = []

export async function openUsersRoles(options: OpenOptions = {}): Promise<OpenedPage> {
  const bed = createLiveTestBed({ session: options.session === undefined ? SUPERVISOR_SESSION : options.session })
  beds.push(bed)
  bed.fake.answerFromExample('getRoleMatrix', 200, 'seeded')
  options.script?.(bed)
  const page = await bed.load()
  const mounted = await bed.mount(page, '/admin/users', options.mount ?? {})
  await screen.findByTestId('page-users-roles')
  if ((options.waitFor ?? 'table') === 'table') await screen.findByTestId('ur-users-table')
  return { bed, page, mounted }
}

export function disposeBeds(): void {
  for (const bed of beds.splice(0)) bed.dispose()
}

/** The contract's seeded list (`listUsers` 200 `seeded`). */
export function seededUsers(bed: LiveTestBed): AdminUser[] {
  return (bed.fake.example('listUsers', 200, 'seeded').body as { users: AdminUser[] }).users.map((user) => ({ ...user }))
}

/** The contract's seeded matrix (`getRoleMatrix` 200 `seeded`). */
export function seededMatrix(bed: LiveTestBed): RoleMatrix {
  return bed.fake.example('getRoleMatrix', 200, 'seeded').body as RoleMatrix
}

/** The seeded list with one operator changed. */
export function usersWith(bed: LiveTestBed, id: string, change: Partial<AdminUser>): AdminUser[] {
  return seededUsers(bed).map((user) => (user.id === id ? { ...user, ...change } : user))
}

export const list = (users: AdminUser[]) => ({ status: 200, body: { users } })
export const one = (user: AdminUser) => ({ status: 200, body: user })

const originalMatchMedia = window.matchMedia
/** Empties the kit's toast queue, which is one per page and outlives a test (F76-9). */
export async function clearToasts(): Promise<void> {
  window.matchMedia = (() => ({ matches: true })) as unknown as typeof window.matchMedia
  toast.clear()
  window.matchMedia = originalMatchMedia
  const queue = toast.getQueue() as { getExitingKeys?: () => ReadonlySet<string> }
  if ((queue.getExitingKeys?.().size ?? 0) > 0) await new Promise((resolve) => setTimeout(resolve, 350))
}

/** The text of every toast on screen, scoped to the kit's toast slot (F76-9). */
export const toastTexts = (): string[] => Array.from(document.querySelectorAll('[data-slot="toast"]')).map((element) => element.textContent ?? '')
export const toastsWith = (text: string): string[] => toastTexts().filter((entry) => entry.includes(text))

/** Opens the row menu of `operatorId` and returns the menu. */
export async function openRowMenu(operatorId: string): Promise<HTMLElement> {
  fireEvent.click(screen.getByTestId(`ur-actions-${operatorId}`))
  return screen.findByRole('menu')
}

/** Opens the row menu and presses the item of `testId`; returns the dialog of `dialogId`. */
export async function openDialog(operatorId: string, item: 'change-role' | 'disable' | 'enable' | 'edit-user' | 'delete-user', dialogId: string): Promise<HTMLElement> {
  const menu = await openRowMenu(operatorId)
  fireEvent.click(within(menu).getByTestId(`ur-${item}-${operatorId}`))
  return screen.findByTestId(dialogId)
}

/** Chooses a role in the open role dialog. */
export function chooseRole(dialog: HTMLElement, role: string): void {
  fireEvent.click(within(within(dialog).getByTestId(`ur-role-option-${role}`)).getByRole('radio'))
}

/** Types into a kit `TextField` by its test ID (the `Input` or `TextArea` inside it). */
export function typeField(dialog: HTMLElement, fieldTestId: string, value: string): void {
  fireEvent.change(within(within(dialog).getByTestId(fieldTestId)).getByRole('textbox'), { target: { value } })
}

/** Picks a role of a create dialog. */
export function chooseCreateRole(dialog: HTMLElement, role: string): void {
  fireEvent.click(within(within(dialog).getByTestId(`ur-create-role-option-${role}`)).getByRole('radio'))
}

/** Types a reason into a dialog's reason field. */
export function typeReason(dialog: HTMLElement, fieldTestId: string, reason: string): void {
  fireEvent.change(within(within(dialog).getByTestId(fieldTestId)).getByRole('textbox'), { target: { value: reason } })
}

/** Presses a kit button by test ID, inside `act`. */
export async function press(element: HTMLElement): Promise<void> {
  await act(async () => {
    fireEvent.click(element)
  })
}

/** Waits until the dialog of `dialogId` is gone. */
export async function waitClosed(dialogId: string): Promise<void> {
  await waitFor(() => expect(screen.queryByTestId(dialogId)).not.toBeInTheDocument())
}
