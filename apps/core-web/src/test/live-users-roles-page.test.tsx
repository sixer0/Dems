/**
 * @vitest-environment jsdom
 * @vitest-environment-options { "url": "http://127.0.0.1:5178/" }
 */
// Plan row W77: the Users & Roles page, `/admin/users`, in Live mode on the contract-checked fake
// transport (W50's harness), with the Simulated page as the control group (backend task
// 04_client_integration_spec §10.1, §10.2, §13.9).
//
// | Criterion | Where it is proven here |
// |-----------|-------------------------|
// | AC-C-86 the test IDs of §10.2 with three operators and twelve matrix rows from the fake transport; operations 11 and 10 asked once each, held under `CORE_QUERY_KEYS` as the operations' own answers | "AC-C-86" |
// | AC-C-90 `admin.changed` USERS reads the list again without a reload; the changed row is highlighted; DEVICES does not touch it | "AC-C-90" |
// | AC-C-91 Loading, Empty, Error (with the cooled-down Retry), Forbidden and "Live mode only"; in Simulated mode the navigation entry is absent; the Offline state keeps the rows and disables the menus | "AC-C-91" |
// | PG-6a / SD-20 the page's queries are REMOVED on a sign-out, on any session end, on the loss of `USER_ADMIN` (before the guard redirects) and when another operator takes the browser | "PG-6a" |
// | W0 §15 under StrictMode each read is sent once (reads in `useQuery`; the page starts nothing from an effect) | "StrictMode" |
// | Rule 2 a failed read goes to the presenter first (an outage, a 429, a 403 are worded there, with no record of the page's own); the page's own records are proven in `live-users-roles-commands.test.tsx` | "AC-C-91" (error, forbidden) |
import { act, cleanup, configure, render, screen, waitFor, within } from '@testing-library/react'
import { QueryClient } from '@tanstack/react-query'
import { createMemoryHistory, RouterProvider } from '@tanstack/react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { en } from '@dems/shared/i18n'
import { LiveLinkState } from '@dems/shared/live'
import { rateLimited } from '@dems/shared/live/testing'
import type { SocketLike } from '@dems/shared/realtime'
import { ALWAYS_VISIBLE, createMemoryAuthStorage, createSim, OPERATOR_IDS, OperatorRole, Permission, type Sim } from '@dems/shared/sim'
import { SHELL_INTRO_STORAGE_KEY } from '@/components/shell/shell-entrance'
import { getMissingI18nKeys, resetMissingI18nKeys } from '@/i18n'
import { resetCoreErrorPresenter } from '@/lib/core-errors'
import { createAppRouter } from '@/router'
import { CORE_QUERY_KEYS, webErrorSink } from '@/runtime'
import { INVESTIGATOR_SESSION, SUPERVISOR_SESSION } from '@/runtime/testing/live-harness'
import {
  clearToasts,
  disposeBeds,
  list,
  openRowMenu,
  openUsersRoles,
  press,
  seededMatrix,
  seededUsers,
  toastsWith,
  usersWith,
} from '@/features/users-roles/__tests__/users-roles-bed'

// A page's chunk is loaded by a dynamic import: under load that can take longer than the library's default second.
configure({ asyncUtilTimeout: 8_000 })
vi.setConfig({ testTimeout: 25_000 })

const U = en.usersRoles
const DENIED = en.common.rbac.deniedTitle
const REQUIRES_SUPERVISOR = en.common.rbac.requiresRole.replace('{{role}}', en.common.roles.SUPERVISOR)
const OFFLINE = en.common.coreErrors.offline
const IDS = ['OPR-001', 'OPR-002', 'OPR-003'] as const
const requestsOf = (bed: { fake: { log: { requestsOf(op: string): readonly unknown[] } } }, op: string) => bed.fake.log.requestsOf(op)

class SilentSocket implements SocketLike {
  readyState = 0
  onopen: SocketLike['onopen'] = null
  onmessage: SocketLike['onmessage'] = null
  onclose: SocketLike['onclose'] = null
  onerror: SocketLike['onerror'] = null
  close() {
    this.readyState = 3
  }
}
const sims: Sim[] = []

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
  for (const sim of sims.splice(0)) sim.stop()
  disposeBeds()
  vi.restoreAllMocks()
})

describe('AC-C-86: the page renders the test IDs of §10.2 from the fake transport', () => {
  it('three operators, twelve matrix rows, the summary, the own row and the row menus', async () => {
    const { bed, mounted } = await openUsersRoles()
    const page = screen.getByTestId('page-users-roles')
    expect(within(page).getByRole('heading', { level: 1 })).toHaveTextContent(/Users & Roles/i)
    expect(within(page).getByTestId('panel-users')).toBeInTheDocument()
    expect(within(page).getByTestId('panel-matrix')).toBeInTheDocument()
    expect(within(page).getByTestId('ur-summary')).toHaveTextContent('3 users, 3 enabled')

    const table = within(page).getByTestId('ur-users-table')
    for (const id of IDS) {
      const row = within(table).getByTestId(`ur-user-${id}`)
      expect(within(row).getByTestId(`ur-role-${id}`)).toBeInTheDocument()
      expect(within(row).getByTestId(`ur-status-${id}`)).toHaveAttribute('data-enabled', 'true')
      expect(within(row).getByTestId(`ur-actions-${id}`)).toBeInTheDocument()
    }
    expect(within(table).getByTestId('ur-role-OPR-001')).toHaveTextContent(en.common.roles.INVESTIGATOR)
    expect(within(table).getByTestId('ur-role-OPR-002')).toHaveTextContent(en.common.roles.SUPERVISOR)
    expect(within(table).getByTestId('ur-role-OPR-003')).toHaveTextContent(en.common.roles.TECHNICIAN)
    expect(within(table).getByTestId('ur-status-OPR-001')).toHaveTextContent(U.users.enabled)
    expect(within(table).getByTestId('ur-user-OPR-002')).toHaveTextContent('andi.pratama')
    // "You" on the caller's own row only (the session's operator is OPR-002).
    expect(within(table).getAllByTestId('ur-self')).toHaveLength(1)
    expect(within(within(table).getByTestId('ur-user-OPR-002')).getByTestId('ur-self')).toHaveTextContent(U.users.you)
    // The technician never signed in (the contract's example).
    expect(within(table).getByTestId('ur-last-sign-in-OPR-003')).toHaveTextContent(U.users.neverSignedIn)

    // The matrix: fourteen rows by three roles, read-only, 22 grants as seeded (SH-04, row 47).
    const matrix = within(page).getByTestId('ur-matrix')
    expect(within(page).getByTestId('ur-matrix-readonly')).toHaveTextContent(U.matrix.readOnly)
    expect(within(matrix).getAllByRole('row')).toHaveLength(15)
    const seeded = seededMatrix(bed)
    expect(seeded.permissions).toHaveLength(14)
    let granted = 0
    for (const role of seeded.roles) {
      for (const permission of seeded.permissions) {
        const cell = within(matrix).getByTestId(`ur-grant-${role}-${permission}`)
        const expected = seeded.grants.some((grant) => grant.role === role && grant.permission === permission)
        expect(cell, `${role} ${permission}`).toHaveAttribute('data-granted', expected ? 'true' : 'false')
        if (expected) granted += 1
      }
    }
    expect(granted).toBe(22)
    expect(within(matrix).getByTestId('ur-grant-SUPERVISOR-USER_ADMIN')).toHaveAttribute('aria-label', U.matrix.granted)
    expect(within(matrix).getByTestId('ur-grant-TECHNICIAN-USER_ADMIN')).toHaveAttribute('aria-label', U.matrix.notGranted)

    // One read each, by the registry's routes, held as the operations' own answers (PG-6).
    expect(requestsOf(bed, 'listUsers')).toHaveLength(1)
    expect(bed.fake.log.requestsOf('listUsers')[0]).toMatchObject({ method: 'GET', path: '/api/v1/admin/users' })
    expect(bed.fake.log.requestsOf('getRoleMatrix')[0]).toMatchObject({ method: 'GET', path: '/api/v1/rbac/matrix' })
    expect(requestsOf(bed, 'getRoleMatrix')).toHaveLength(1)
    expect(mounted.queryClient.getQueryData(CORE_QUERY_KEYS.users)).toEqual({ users: seededUsers(bed) })
    expect(mounted.queryClient.getQueryData(CORE_QUERY_KEYS.roleMatrix)).toEqual(seeded)

    // The row menus and their items (§10.2 test IDs).
    const menu = await openRowMenu('OPR-001')
    expect(within(menu).getByTestId('ur-change-role-OPR-001')).toHaveTextContent(U.actions.changeRole)
    expect(within(menu).getByTestId('ur-disable-OPR-001')).toHaveTextContent(U.actions.disable)
    expect(within(menu).queryByTestId('ur-enable-OPR-001')).not.toBeInTheDocument()
    expect(getMissingI18nKeys()).toEqual([])
  })

  it('the last-administrator hint disables "Disable user…" of the only enabled holder of USER_ADMIN, with the sentence', async () => {
    await openUsersRoles()
    const menu = await openRowMenu('OPR-002')
    const item = within(menu).getByTestId('ur-disable-OPR-002')
    expect(item).toHaveAttribute('aria-disabled', 'true')
    expect(item).toHaveTextContent(U.lastAdmin)
    expect(within(menu).getByTestId('ur-change-role-OPR-002')).not.toHaveAttribute('aria-disabled', 'true')
  })

  it('a disabled operator is shown as Disabled, counted out of "enabled", and offers "Enable user"', async () => {
    await openUsersRoles({ script: (bed) => bed.fake.answer('listUsers', () => list(usersWith(bed, 'OPR-003', { enabled: false, activeSessions: 0 }))) })
    expect(screen.getByTestId('ur-summary')).toHaveTextContent('3 users, 2 enabled')
    expect(screen.getByTestId('ur-status-OPR-003')).toHaveAttribute('data-enabled', 'false')
    expect(screen.getByTestId('ur-status-OPR-003')).toHaveTextContent(U.users.disabled)
    const menu = await openRowMenu('OPR-003')
    expect(within(menu).getByTestId('ur-enable-OPR-003')).toHaveTextContent(U.actions.enable)
    expect(within(menu).queryByTestId('ur-disable-OPR-003')).not.toBeInTheDocument()
  })
})

describe('AC-C-90: `admin.changed` USERS reads the list again without a reload', () => {
  it('a change made elsewhere appears, the changed row is highlighted, and nothing is loaded again', async () => {
    const { bed, page } = await openUsersRoles()
    expect(screen.getByTestId('ur-user-OPR-003')).not.toHaveAttribute('data-highlight')
    bed.fake.answer('listUsers', () => list(usersWith(bed, 'OPR-003', { role: 'INVESTIGATOR', roleChangedAt: bed.fake.clock.now() })))
    await act(async () => {
      bed.core.adminChanged('USERS')
    })
    await bed.flush()
    await waitFor(() => expect(screen.getByTestId('ur-role-OPR-003')).toHaveAttribute('data-role', 'INVESTIGATOR'))
    expect(screen.getByTestId('ur-role-OPR-003')).toHaveTextContent(en.common.roles.INVESTIGATOR)
    expect(screen.getByTestId('ur-user-OPR-003')).toHaveAttribute('data-highlight', 'true')
    expect(screen.getByTestId('ur-user-OPR-001')).not.toHaveAttribute('data-highlight')
    expect(requestsOf(bed, 'listUsers')).toHaveLength(2)
    // The matrix is not a list of `admin.changed` USERS.
    expect(requestsOf(bed, 'getRoleMatrix')).toHaveLength(1)
    // No reload: one socket, no new sign-in, no second session read.
    expect(page.sockets).toHaveLength(1)
    expect(requestsOf(bed, 'signIn')).toHaveLength(0)

    // A disable made elsewhere (DR-12: `admin.changed` USERS follows a disable too).
    bed.fake.answer('listUsers', () => list(usersWith(bed, 'OPR-001', { enabled: false, activeSessions: 0 })))
    await act(async () => {
      bed.core.adminChanged('USERS')
    })
    await bed.flush()
    await waitFor(() => expect(screen.getByTestId('ur-status-OPR-001')).toHaveAttribute('data-enabled', 'false'))
    expect(screen.getByTestId('ur-summary')).toHaveTextContent('3 users, 2 enabled')
  })

  it('`admin.changed` DEVICES or PAIRING_CODE does not read the users list', async () => {
    const { bed } = await openUsersRoles()
    await act(async () => {
      bed.core.adminChanged('DEVICES')
      bed.core.adminChanged('PAIRING_CODE')
    })
    await bed.flush()
    expect(requestsOf(bed, 'listUsers')).toHaveLength(1)
  })
})

describe('AC-C-91: the states of §10.1', () => {
  it('Loading: three skeleton rows while the first read is out; the table when it is answered', async () => {
    let release: (() => void) | undefined
    const { bed } = await openUsersRoles({
      waitFor: 'page',
      script: (b) => {
        const held = b.fake.hold('listUsers')
        release = () => held.release(list(seededUsers(b)))
      },
    })
    const loading = await screen.findByTestId('ur-loading')
    expect(loading.querySelectorAll('.ur-skeleton-row')).toHaveLength(3)
    expect(screen.getByTestId('panel-users')).toBeInTheDocument()
    expect(screen.queryByTestId('ur-users-table')).not.toBeInTheDocument()
    // The summary waits for the answer.
    expect(screen.queryByTestId('ur-summary')).not.toBeInTheDocument()
    await waitFor(() => expect(requestsOf(bed, 'listUsers')).toHaveLength(1))
    await act(async () => {
      release?.()
    })
    await bed.flush()
    await screen.findByTestId('ur-users-table')
    expect(screen.queryByTestId('ur-loading')).not.toBeInTheDocument()
    expect(screen.getByTestId('ur-summary')).toHaveTextContent('3 users, 3 enabled')
  })

  it('Empty: the kit EmptyState inside the panel', async () => {
    await openUsersRoles({ waitFor: 'page', script: (bed) => bed.fake.answer('listUsers', () => list([])) })
    const empty = await screen.findByTestId('ur-empty')
    expect(within(screen.getByTestId('panel-users')).getByTestId('ur-empty')).toBe(empty)
    expect(empty).toHaveTextContent(U.states.empty)
    expect(screen.getByTestId('ur-summary')).toHaveTextContent('0 users, 0 enabled')
  })

  it('Error: an outage shows the presenter\'s sentence once and the panel\'s Alert; Retry reads again, then cools down', async () => {
    const { bed } = await openUsersRoles({ waitFor: 'page', script: (b) => b.fake.failOnce('listUsers') })
    const error = await screen.findByTestId('ur-error')
    expect(error).toHaveTextContent(U.states.error)
    await waitFor(() => expect(toastsWith(OFFLINE)).toHaveLength(1))
    // The presenter worded it: no record of the page's own.
    expect(webErrorSink.records().filter((record) => record.source.startsWith('features/users-roles'))).toHaveLength(0)
    const retry = screen.getByTestId('ur-retry')
    expect(retry).toHaveTextContent(en.common.actions.retry)
    await press(retry)
    await screen.findByTestId('ur-users-table')
    expect(requestsOf(bed, 'listUsers')).toHaveLength(2)
  })

  it('Error: the Retry button of a failed read cools down after a press (3 s first)', async () => {
    const { bed } = await openUsersRoles({ waitFor: 'page', script: (b) => b.fake.fail('listUsers') })
    await screen.findByTestId('ur-error')
    await press(screen.getByTestId('ur-retry'))
    await bed.flush()
    await waitFor(() => expect(screen.getByTestId('ur-retry')).toHaveTextContent(en.common.actions.retryIn.replace('{{seconds}}', '3')))
    expect(screen.getByTestId('ur-retry')).toBeDisabled()
  })

  it('Error (LB-10): a 429 shows the limit toast, never the outage sentence', async () => {
    await openUsersRoles({ waitFor: 'page', script: (bed) => bed.fake.answerOnce('listUsers', rateLimited(7)) })
    await screen.findByTestId('ur-error')
    await waitFor(() => expect(toastsWith(en.common.coreErrors.limited.replace('{{seconds}}', '7'))).toHaveLength(1))
    expect(toastsWith(OFFLINE)).toHaveLength(0)
  })

  it('Error of the matrix alone: its own Alert and Retry; the operators stay', async () => {
    const { bed } = await openUsersRoles({ script: (b) => b.fake.failOnce('getRoleMatrix') })
    const error = await screen.findByTestId('ur-matrix-error')
    expect(error).toHaveTextContent(U.states.matrixError)
    expect(screen.getByTestId('ur-users-table')).toBeInTheDocument()
    await press(screen.getByTestId('ur-matrix-retry'))
    await screen.findByTestId('ur-matrix')
    expect(requestsOf(bed, 'getRoleMatrix')).toHaveLength(2)
  })

  it('Forbidden: a 403 of the list (the contract\'s `notPermitted`) shows the page-level state with a link to the Dashboard, and the denied toast', async () => {
    await openUsersRoles({ waitFor: 'page', script: (bed) => bed.fake.answer('listUsers', bed.fake.example('listUsers', 403, 'notPermitted')) })
    const forbidden = await screen.findByTestId('ur-forbidden')
    expect(forbidden).toHaveTextContent(U.states.forbidden)
    expect(within(forbidden).getByTestId('ur-forbidden-link')).toHaveAttribute('href', '/dashboard')
    expect(screen.queryByTestId('panel-users')).not.toBeInTheDocument()
    await waitFor(() => expect(toastsWith(DENIED)).toHaveLength(1))
    expect(toastsWith(DENIED)[0]).toContain(REQUIRES_SUPERVISOR)
  })

  it('Offline: the link goes down, the rows stay, every row menu is disabled; nothing is asked', async () => {
    const { bed, page } = await openUsersRoles()
    bed.core.unreachable()
    await bed.flush()
    await waitFor(() => expect(page.live.link).not.toBe(LiveLinkState.ONLINE))
    await waitFor(() => expect(screen.getByTestId('ur-actions-OPR-001')).toBeDisabled())
    expect(screen.getByTestId('ur-users-table')).toBeInTheDocument()
    expect(screen.getByTestId('ur-role-OPR-001')).toHaveTextContent(en.common.roles.INVESTIGATOR)
    expect(requestsOf(bed, 'listUsers')).toHaveLength(1)
  })

  it('"Live mode only": in Simulated mode the page shows the shared state in its own grid, and the navigation entry is absent', async () => {
    const authStorage = createMemoryAuthStorage()
    authStorage.save({ operatorId: OPERATOR_IDS.ANDI, issuedAt: Date.now() })
    const sim = createSim({ storage: null, authStorage, visibility: ALWAYS_VISIBLE, scheduler: () => () => undefined })
    sims.push(sim)
    const router = createAppRouter(
      { sim, queryClient: new QueryClient({ defaultOptions: { queries: { retry: false } } }), socketFactory: () => new SilentSocket() },
      { history: createMemoryHistory({ initialEntries: ['/admin/users'] }) },
    )
    render(<RouterProvider router={router} />)
    const page = await screen.findByTestId('page-users-roles')
    const state = within(page).getByTestId('ur-live-only')
    expect(state).toHaveTextContent(en.shell.liveOnly.title)
    expect(state).toHaveTextContent(U.states.liveOnly)
    expect(state.closest('.ur-state-wrap')).not.toBeNull()
    expect(within(page).queryByTestId('panel-users')).not.toBeInTheDocument()
    expect(screen.queryByTestId('nav-admin-group')).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: en.shell.nav.usersRoles })).not.toBeInTheDocument()
    expect(getMissingI18nKeys()).toEqual([])
  })
})

describe('PG-6a / SD-20: the page\'s queries are removed, never kept for the next operator', () => {
  it('on a sign-out (the Core ends the session): both entries are gone and the page is left for /login', async () => {
    const { bed, mounted } = await openUsersRoles()
    expect(mounted.queryClient.getQueryData(CORE_QUERY_KEYS.users)).toBeDefined()
    await act(async () => {
      bed.core.end('SIGNED_OUT')
    })
    await bed.flush()
    expect(mounted.queryClient.getQueryData(CORE_QUERY_KEYS.users)).toBeUndefined()
    expect(mounted.queryClient.getQueryData(CORE_QUERY_KEYS.roleMatrix)).toBeUndefined()
    await waitFor(() => expect(mounted.router.state.location.pathname).toBe('/login'))
    expect(screen.queryByTestId('ur-users-table')).not.toBeInTheDocument()
  })

  it('on the loss of USER_ADMIN: both entries are gone BEFORE the guard redirects to /dashboard', async () => {
    const { bed, mounted } = await openUsersRoles()
    const cachedWhenLeaving: unknown[] = []
    const stop = mounted.router.subscribe('onBeforeNavigate', (event) => {
      if (event.toLocation.pathname === '/dashboard') {
        cachedWhenLeaving.push(mounted.queryClient.getQueryData(CORE_QUERY_KEYS.users), mounted.queryClient.getQueryData(CORE_QUERY_KEYS.roleMatrix))
      }
    })
    await act(async () => {
      bed.core.changeRole(OperatorRole.SUPERVISOR, SUPERVISOR_SESSION.permissions.filter((permission) => permission !== Permission.USER_ADMIN))
    })
    await bed.flush()
    await screen.findByTestId('page-dashboard')
    stop()
    expect(mounted.router.state.location.pathname).toBe('/dashboard')
    expect(cachedWhenLeaving).toEqual([undefined, undefined])
    expect(mounted.queryClient.getQueryData(CORE_QUERY_KEYS.users)).toBeUndefined()
  })

  it('when another operator takes the session of this browser: the entries are gone and the guard sends them away', async () => {
    const { bed, mounted, page } = await openUsersRoles()
    bed.core.signIn(INVESTIGATOR_SESSION)
    await bed.elapse(2_000, 250)
    expect(page.live.session?.operator.id).toBe(INVESTIGATOR_SESSION.operator.id)
    expect(mounted.queryClient.getQueryData(CORE_QUERY_KEYS.users)).toBeUndefined()
    expect(mounted.queryClient.getQueryData(CORE_QUERY_KEYS.roleMatrix)).toBeUndefined()
    await screen.findByTestId('page-dashboard')
  })

  it('a socket resync reads both again (the bridge invalidates every Core entry)', async () => {
    const { bed, page } = await openUsersRoles()
    bed.core.unreachable()
    await bed.flush()
    await waitFor(() => expect(page.live.link).not.toBe(LiveLinkState.ONLINE))
    bed.core.back()
    await bed.elapse(10_000, 500)
    await waitFor(() => expect(page.live.link).toBe(LiveLinkState.ONLINE))
    await bed.flush()
    await waitFor(() => expect(requestsOf(bed, 'listUsers').length).toBeGreaterThanOrEqual(2))
    expect(requestsOf(bed, 'getRoleMatrix').length).toBeGreaterThanOrEqual(2)
  })
})

describe('StrictMode (W0 §15; `main.tsx` renders the console under StrictMode)', () => {
  it('each read is sent once: the page starts nothing from an effect', async () => {
    const { bed } = await openUsersRoles({ mount: { strict: true } })
    await bed.flush()
    expect(requestsOf(bed, 'listUsers')).toHaveLength(1)
    expect(requestsOf(bed, 'getRoleMatrix')).toHaveLength(1)
  })
})
