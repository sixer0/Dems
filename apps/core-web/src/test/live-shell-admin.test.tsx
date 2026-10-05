/**
 * @vitest-environment jsdom
 * @vitest-environment-options { "url": "http://127.0.0.1:5178/" }
 */
// Plan row W54: the ADMINISTRATION group of the navigation, the two administration routes with
// their guards and page stubs, and what the shell does when a role change takes the permission of
// the page that is open (backend task 04_client_integration_spec §6.3, §10.1; RC-1, RC-3; CA-03).
//
// | Criterion | Where it is proven here |
// |-----------|-------------------------|
// | PG-1, PG-2 the routes `/admin/users` and `/admin/devices`, their page roots, route files with the guard only | "the two routes" |
// | PG-3 the guard: Live mode without the permission goes to `/dashboard`; Simulated mode shows the "Live mode only" state | "the two routes" |
// | PG-4, AC-C-51 the ADMINISTRATION entries are rendered only in Live mode and only with their permission, in the sidebar, the Drawer and the "More" sheet; they appear and disappear on `session.updated` | "the ADMINISTRATION group" |
// | PG-10 the two namespaces and the navigation labels | "the words" |
// | AC-C-50 losing the permission of the current route leaves `/session/new`, `/admin/users` and `/admin/devices` for `/dashboard`; every other route stays | "leaving the page" |
// | CA-03 `router.invalidate()` runs `beforeLoad` again; RC-3 the cache is empty before the guard redirects | "leaving the page" |
// | CLG (c) no `useSimActions` and no `.actions` read on a `Sim` in the shell's production files | "the shell's call sites" |
import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { cleanup, configure, fireEvent, render, renderHook, screen, waitFor, within } from '@testing-library/react'
import { toast } from '@heroui/react'
import { QueryClient } from '@tanstack/react-query'
import { createMemoryHistory, RouterProvider } from '@tanstack/react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { pickReplicatedState, type AuthSessionInfo, type HealthResponse, type ReplicatedState } from '@dems/shared/api'
import { en, SHARED_NAMESPACES } from '@dems/shared/i18n'
import { CoreMode } from '@dems/shared/live'
import type { SocketLike } from '@dems/shared/realtime'
import {
  ALWAYS_VISIBLE,
  AuthStatus,
  createMemoryAuthStorage,
  createSim,
  OPERATOR_IDS,
  OperatorRole,
  Permission,
  ROLE_PERMISSIONS,
  selectAuth,
  selectOperator,
  SimProvider,
  type Sim,
  type SimState,
} from '@dems/shared/sim'
import { ADMIN_NAV_ITEMS, NAV_ITEMS, type NavItem } from '@/components/shell/nav-items'
import { ROUTE_PERMISSIONS, routePermission } from '@/components/shell/route-permissions'
import { useVisibleNavItems } from '@/components/shell/use-visible-nav-items'
import { getMissingI18nKeys, resetMissingI18nKeys } from '@/i18n'
import { createAppRouter, type AppRouter } from '@/router'
import { CORE_QUERY_KEYS, type CoreModeControl } from '@/runtime'
import { createLiveTestBed, INVESTIGATOR_SESSION, SUPERVISOR_SESSION, type LivePage, type LiveTestBed } from '@/runtime/testing/live-harness'

const SRC_DIR = join(dirname(fileURLToPath(import.meta.url)), '..')

const health: HealthResponse = {
  status: 'ok',
  service: 'dems-mock-core',
  version: '0.1.0',
  apiVersion: 'v1',
  serverTime: '2026-10-04T03:00:00.000Z',
  uptimeMs: 1000,
  ws: { path: '/ws', heartbeatIntervalMs: 1000, clients: 1 },
}

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

// A page's chunk is loaded by a dynamic import: under load that can take longer than the library's default second.
configure({ asyncUtilTimeout: 6_000 })
vi.setConfig({ testTimeout: 20_000 })

const originalMatchMedia = window.matchMedia
/** matchMedia that answers `(min-width: Npx)` for a given viewport width (jsdom has no layout). */
function viewport(width: number) {
  window.matchMedia = ((query: string) => {
    const min = /min-width:\s*(\d+)px/.exec(query)
    return {
      matches: min ? width >= Number(min[1]) : false,
      media: query,
      onchange: null,
      addListener: () => undefined,
      removeListener: () => undefined,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      dispatchEvent: () => false,
    } as MediaQueryList
  }) as typeof window.matchMedia
}

/**
 * Empties the kit's toast queue, which is one per page and outlives a test. A toast that is still
 * open is closed without its exit animation; one that a test closed is waited for (300 ms).
 */
async function clearToasts() {
  window.matchMedia = (() => ({ matches: true })) as unknown as typeof window.matchMedia
  toast.clear()
  window.matchMedia = originalMatchMedia
  const queue = toast.getQueue() as { getExitingKeys?: () => ReadonlySet<string> }
  if ((queue.getExitingKeys?.().size ?? 0) > 0) await new Promise((resolve) => setTimeout(resolve, 350))
}

Element.prototype.scrollTo ??= function scrollTo() {}
window.scrollTo = (() => undefined) as typeof window.scrollTo

type Session = Pick<AuthSessionInfo, 'operator' | 'permissions'>
type Permissions = AuthSessionInfo['permissions']

/** The effective permission list the Core server reads for a role: the seeded matrix (01_specs AC-B-17). */
const permissionsOf = (role: OperatorRole): Permissions => [...ROLE_PERMISSIONS[role]] as Permissions
const without = (permissions: Permissions, permission: Permission): Permissions => permissions.filter((entry) => entry !== permission) as Permissions

const wire = (state: SimState): ReplicatedState => pickReplicatedState(JSON.parse(JSON.stringify(state)) as ReplicatedState)

const control = (mode: CoreMode, switchTo: CoreModeControl['switchTo'] = vi.fn(async () => true)): CoreModeControl => ({ mode, selectable: true, switchTo })

let bed: LiveTestBed | undefined
const sims: Sim[] = []

/** The console on the simulator, signed in as the seeded SUPERVISOR (or as nobody). */
function mountSimulated(path: string, options: { operatorId?: string | null; coreMode?: CoreModeControl } = {}) {
  const authStorage = createMemoryAuthStorage()
  const operatorId = options.operatorId === undefined ? OPERATOR_IDS.ANDI : options.operatorId
  if (operatorId !== null) authStorage.save({ operatorId, issuedAt: Date.now() })
  const sim = createSim({ storage: null, authStorage, visibility: ALWAYS_VISIBLE, scheduler: () => () => undefined })
  sims.push(sim)
  const router = createAppRouter(
    {
      sim,
      queryClient: new QueryClient({ defaultOptions: { queries: { retry: false } } }),
      socketFactory: () => new SilentSocket(),
      ...(options.coreMode ? { coreMode: options.coreMode } : {}),
    },
    { history: createMemoryHistory({ initialEntries: [path] }) },
  )
  render(<RouterProvider router={router} />)
  return { sim, router }
}

/** The console in Live mode, signed in with `session` (or as nobody). */
async function mountLive(
  path: string,
  session: Session | null = SUPERVISOR_SESSION,
  coreMode?: CoreModeControl,
): Promise<{ bed: LiveTestBed; page: LivePage; router: AppRouter; queryClient: QueryClient }> {
  const created = createLiveTestBed({ session })
  bed = created
  const page = await created.load()
  const { router, queryClient } = await created.mount(page, path, coreMode ? { coreMode } : {})
  return { bed: created, page, router, queryClient }
}

/** The replicated `operators` slice with the session's operator in `role`: the delta the Core sends beside `session.updated`. */
function operatorsDelta(created: LiveTestBed, role: OperatorRole) {
  const operators = wire(created.core.served).operators.map((operator) =>
    operator.id === SUPERVISOR_SESSION.operator.id ? { ...operator, role } : operator,
  )
  return [{ op: 'replace' as const, slice: 'operators' as const, value: operators }]
}

const primaryNav = () => screen.getByRole('navigation', { name: 'Primary' })
const linkNames = (nav: HTMLElement) => within(nav).getAllByRole('link').map((link) => link.textContent?.replace('DEV', '').trim())

const MAIN = ['Dashboard', 'Session Monitor', 'Evidence', 'Devices & Inputs', 'Storage', 'Network & Time', 'Security & Audit', 'System & Maintenance']

beforeEach(() => {
  resetMissingI18nKeys()
  window.localStorage.clear()
  window.sessionStorage.clear()
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(JSON.stringify(health), { status: 200 })),
  )
})

afterEach(async () => {
  cleanup()
  await clearToasts()
  for (const sim of sims.splice(0)) sim.stop()
  bed?.dispose()
  bed = undefined
  window.matchMedia = originalMatchMedia
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('the words (PG-10)', () => {
  it('two namespaces, registered, and the three navigation labels', () => {
    expect(SHARED_NAMESPACES).toEqual(expect.arrayContaining(['usersRoles', 'pairedDevices']))
    expect(en.usersRoles.title).toBe('Users & Roles')
    expect(en.usersRoles.subtitle).toBe('Operators, their roles and what each role may do')
    expect(en.pairedDevices.title).toBe('Paired Devices')
    expect(en.pairedDevices.subtitle).toBe('Tablets and phones allowed to operate this Core')
    expect(en.shell.nav.adminGroup).toBe('ADMINISTRATION')
    expect(en.shell.nav.usersRoles).toBe('Users & Roles')
    expect(en.shell.nav.pairedDevices).toBe('Paired Devices')
    expect(en.shell.liveOnly.title).toBe('This page needs the Core server')
    expect(en.shell.roleNotice.changed).toBe('Your role is now {{role}}. The available actions have changed.')
  })

  it('the navigation table: two items of the group `admin`, Live only, each with its permission; the nine others carry neither', () => {
    expect(ADMIN_NAV_ITEMS.map(({ id, to, labelKey, permission, liveOnly }) => ({ id, to, labelKey, permission, liveOnly }))).toEqual([
      { id: 'users-roles', to: '/admin/users', labelKey: 'shell.nav.usersRoles', permission: Permission.USER_ADMIN, liveOnly: true },
      { id: 'paired-devices', to: '/admin/devices', labelKey: 'shell.nav.pairedDevices', permission: Permission.PAIRING_MANAGE, liveOnly: true },
    ])
    const others = NAV_ITEMS.filter((item) => item.group !== 'admin')
    expect(others).toHaveLength(9)
    for (const item of others) {
      expect(item.permission).toBeUndefined()
      expect(item.liveOnly).toBeUndefined()
    }
    // The group stands between the product pages and DEVELOPER.
    expect(NAV_ITEMS.map((item) => item.group)).toEqual([...Array<string>(8).fill('main'), 'admin', 'admin', 'developer'])
  })

  it('the map of routes whose guard needs a permission has three entries', () => {
    expect(ROUTE_PERMISSIONS).toEqual({
      '/session/new': Permission.SESSION_START,
      '/admin/users': Permission.USER_ADMIN,
      '/admin/devices': Permission.PAIRING_MANAGE,
    })
    expect(routePermission('/admin/users')).toBe(Permission.USER_ADMIN)
    expect(routePermission('/evidence')).toBeNull()
    expect(routePermission('constructor')).toBeNull()
  })
})

describe('which items are rendered (PG-4): `useVisibleNavItems`', () => {
  const base = NAV_ITEMS[0]!
  const ITEMS: readonly NavItem[] = [
    { ...base, id: 'plain' },
    { ...base, id: 'live-only', liveOnly: true },
    { ...base, id: 'needs-user-admin', permission: Permission.USER_ADMIN },
    { ...base, id: 'needs-evidence-export', permission: Permission.EVIDENCE_EXPORT },
  ]
  const visibleIn = (sim: Sim) =>
    renderHook(() => useVisibleNavItems(ITEMS), { wrapper: ({ children }) => <SimProvider sim={sim} autoStart={false}>{children}</SimProvider> }).result.current.map((item) => item.id)

  it('Simulated mode: a Live-only item and an item that names a permission are not rendered, whatever the simulator\'s role holds', () => {
    const authStorage = createMemoryAuthStorage()
    authStorage.save({ operatorId: OPERATOR_IDS.ANDI, issuedAt: Date.now() })
    const sim = createSim({ storage: null, authStorage, visibility: ALWAYS_VISIBLE, scheduler: () => () => undefined })
    sims.push(sim)
    expect(visibleIn(sim)).toEqual(['plain'])
  })

  it('Live mode: a Live-only item is rendered, and an item with a permission only while the session holds it', async () => {
    bed = createLiveTestBed({ session: SUPERVISOR_SESSION })
    const supervisor = await bed.load()
    expect(SUPERVISOR_SESSION.permissions).toEqual(expect.arrayContaining([Permission.USER_ADMIN, Permission.EVIDENCE_EXPORT]))
    expect(visibleIn(supervisor.runtime.sim)).toEqual(['plain', 'live-only', 'needs-user-admin', 'needs-evidence-export'])
    bed.dispose()

    const onlyExport: Session = { operator: INVESTIGATOR_SESSION.operator, permissions: [Permission.EVIDENCE_EXPORT] as Permissions }
    bed = createLiveTestBed({ session: onlyExport })
    const investigator = await bed.load()
    expect(visibleIn(investigator.runtime.sim)).toEqual(['plain', 'live-only', 'needs-evidence-export'])
    bed.dispose()

    // Nobody signed in: the Core's list does not exist.
    bed = createLiveTestBed({ session: null })
    const anonymous = await bed.load()
    expect(visibleIn(anonymous.runtime.sim)).toEqual(['plain', 'live-only'])
  })
})

describe('the ADMINISTRATION group (PG-4; AC-C-51)', () => {
  it('Simulated mode: not rendered, also for the SUPERVISOR; the nine entries are as before', async () => {
    viewport(1920)
    const { sim } = mountSimulated('/storage')
    await screen.findByTestId('page-storage')
    expect(selectOperator(sim.store.getState())?.role).toBe(OperatorRole.SUPERVISOR)
    expect(linkNames(primaryNav())).toEqual([...MAIN, 'API Reference'])
    expect(screen.queryByTestId('nav-admin-group')).not.toBeInTheDocument()
    expect(within(primaryNav()).queryByText('ADMINISTRATION')).not.toBeInTheDocument()
    expect(within(primaryNav()).getByText('DEVELOPER')).toBeInTheDocument()
  })

  it('Live mode with both permissions: the group stands between the product pages and DEVELOPER, with its label', async () => {
    viewport(1920)
    await mountLive('/storage')
    await screen.findByTestId('page-storage')
    const nav = primaryNav()
    expect(linkNames(nav)).toEqual([...MAIN, 'Users & Roles', 'Paired Devices', 'API Reference'])
    const group = within(nav).getByTestId('nav-admin-group')
    expect(within(group).getByText('ADMINISTRATION')).toBeInTheDocument()
    expect(within(group).getByRole('list', { name: 'ADMINISTRATION' })).toBeInTheDocument()
    expect(within(group).getByRole('link', { name: 'Users & Roles' })).toHaveAttribute('href', '/admin/users')
    expect(within(group).getByRole('link', { name: 'Paired Devices' })).toHaveAttribute('href', '/admin/devices')
    expect(within(group).getByRole('link', { name: 'Users & Roles' })).toHaveAttribute('data-group', 'admin')
    // The same separator and micro label as DEVELOPER, which follows it.
    expect(group.querySelector('.dems-nav-separator')).not.toBeNull()
    expect(group.querySelector('.dems-nav-group-label')).not.toBeNull()
    expect(group.compareDocumentPosition(within(nav).getByText('DEVELOPER')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    // The list says that it holds the group (the brand footer keeps its height then: shell.css).
    expect(nav.querySelector('.dems-nav-list')).toHaveAttribute('data-admin', 'true')
    expect(getMissingI18nKeys()).toEqual([])
  })

  it('Live mode without the permissions: not rendered', async () => {
    viewport(1920)
    await mountLive('/storage', INVESTIGATOR_SESSION)
    await screen.findByTestId('page-storage')
    expect(linkNames(primaryNav())).toEqual([...MAIN, 'API Reference'])
    expect(screen.queryByTestId('nav-admin-group')).not.toBeInTheDocument()
    expect(screen.queryByText('ADMINISTRATION')).not.toBeInTheDocument()
    expect(primaryNav().querySelector('.dems-nav-list')).not.toHaveAttribute('data-admin')
  })

  it('each entry needs its own permission: with `USER_ADMIN` alone the group holds one item', async () => {
    viewport(1920)
    const onlyUsers: Session = { operator: SUPERVISOR_SESSION.operator, permissions: without(SUPERVISOR_SESSION.permissions, Permission.PAIRING_MANAGE) }
    await mountLive('/storage', onlyUsers)
    await screen.findByTestId('page-storage')
    expect(linkNames(primaryNav())).toEqual([...MAIN, 'Users & Roles', 'API Reference'])
    expect(within(screen.getByTestId('nav-admin-group')).getAllByRole('link')).toHaveLength(1)
  })

  it('the rail at 1200 px keeps the entries, with their names', async () => {
    viewport(1200)
    await mountLive('/storage')
    await screen.findByTestId('page-storage')
    expect(screen.getByTestId('app-shell')).toHaveAttribute('data-sidebar', 'rail')
    expect(within(primaryNav()).getByRole('link', { name: 'Users & Roles' })).toBeInTheDocument()
    expect(within(primaryNav()).getByRole('link', { name: 'Paired Devices' })).toBeInTheDocument()
  })

  it.each([
    [900, 'drawer', 'Open navigation'],
    [600, 'tabs', 'More'],
  ] as const)('at %i px the %s navigation shows the same groups', async (width, sidebar, opener) => {
    viewport(width)
    await mountLive('/storage')
    await screen.findByTestId('page-storage')
    expect(screen.getByTestId('app-shell')).toHaveAttribute('data-sidebar', sidebar)
    fireEvent.click(screen.getByRole('button', { name: opener }))
    const drawer = await screen.findByRole('dialog', { name: 'Primary' })
    expect(linkNames(drawer)).toEqual([...MAIN, 'Users & Roles', 'Paired Devices', 'API Reference'])
    expect(within(drawer).getByText('ADMINISTRATION')).toBeInTheDocument()
    cleanup()
    bed?.dispose()

    // The same width without the permissions.
    await mountLive('/storage', INVESTIGATOR_SESSION)
    await screen.findByTestId('page-storage')
    fireEvent.click(screen.getByRole('button', { name: opener }))
    const plain = await screen.findByRole('dialog', { name: 'Primary' })
    expect(linkNames(plain)).toEqual([...MAIN, 'API Reference'])
    expect(within(plain).queryByText('ADMINISTRATION')).not.toBeInTheDocument()
  })

  it('AC-C-51: the entries disappear and appear on `session.updated`, without a reload or a sign-in', async () => {
    viewport(1920)
    const { bed, page, router } = await mountLive('/storage')
    await screen.findByTestId('page-storage')
    expect(screen.getByTestId('nav-admin-group')).toBeInTheDocument()

    bed.core.changeRole(OperatorRole.INVESTIGATOR, permissionsOf(OperatorRole.INVESTIGATOR))
    await bed.flush()
    await waitFor(() => expect(screen.queryByTestId('nav-admin-group')).not.toBeInTheDocument())
    expect(linkNames(primaryNav())).toEqual([...MAIN, 'API Reference'])

    bed.core.changeRole(OperatorRole.SUPERVISOR, permissionsOf(OperatorRole.SUPERVISOR))
    await bed.flush()
    expect(await screen.findByTestId('nav-admin-group')).toBeInTheDocument()
    expect(linkNames(primaryNav())).toEqual([...MAIN, 'Users & Roles', 'Paired Devices', 'API Reference'])

    // A gained permission navigates nowhere; nobody was signed out, nothing was loaded again.
    expect(router.state.location.pathname).toBe('/storage')
    expect(selectAuth(page.live.store.getState()).status).toBe(AuthStatus.SIGNED_IN)
    expect(page.sockets).toHaveLength(1)
    expect(bed.fake.log.requestsOf('signIn')).toHaveLength(0)
  })
})

describe('the two routes (PG-1, PG-2, PG-3)', () => {
  it.each([
    ['/admin/users', 'page-users-roles', 'ur-stub', 'USERS & ROLES', 'Users & Roles'],
    ['/admin/devices', 'page-paired-devices', 'pd-stub', 'PAIRED DEVICES', 'Paired Devices'],
  ] as const)('Live mode with the permission: %s renders %s inside the shell, and its entry is the active one', async (path, testId, stubId, _title, entry) => {
    viewport(1920)
    const { router } = await mountLive(path)
    const page = await screen.findByTestId(testId)
    expect(screen.getByRole('main')).toContainElement(page)
    expect(router.state.location.pathname).toBe(path)
    expect(within(page).getByRole('heading', { level: 1 })).toHaveTextContent(new RegExp(entry, 'i'))
    expect(within(page).getByTestId(stubId)).toBeInTheDocument()
    expect(within(page).queryByText(en.shell.liveOnly.title)).not.toBeInTheDocument()
    expect(within(primaryNav()).getByRole('link', { name: entry })).toHaveAttribute('aria-current', 'page')
    expect(getMissingI18nKeys()).toEqual([])
  })

  it.each([['/admin/users'], ['/admin/devices']] as const)('Live mode without the permission: %s goes to /dashboard, with replace', async (path) => {
    viewport(1920)
    const { router } = await mountLive(path, INVESTIGATOR_SESSION)
    await screen.findByTestId('page-dashboard')
    expect(router.state.location.pathname).toBe('/dashboard')
    expect(router.history.length).toBe(1)
    expect(screen.queryByTestId('page-users-roles')).not.toBeInTheDocument()
    expect(screen.queryByTestId('page-paired-devices')).not.toBeInTheDocument()
  })

  it.each([
    ['/admin/devices', Permission.PAIRING_MANAGE, '/admin/users', 'page-users-roles'],
    ['/admin/users', Permission.USER_ADMIN, '/admin/devices', 'page-paired-devices'],
  ] as const)('each permission opens its own page only: %s without %s', async (path, missing, otherPath, otherPage) => {
    viewport(1920)
    const session: Session = { operator: SUPERVISOR_SESSION.operator, permissions: without(SUPERVISOR_SESSION.permissions, missing) }
    const refused = await mountLive(path, session)
    await screen.findByTestId('page-dashboard')
    expect(refused.router.state.location.pathname).toBe('/dashboard')
    cleanup()
    bed?.dispose()

    const allowed = await mountLive(otherPath, session)
    await screen.findByTestId(otherPage)
    expect(allowed.router.state.location.pathname).toBe(otherPath)
  })

  it.each([
    ['/admin/users', 'page-users-roles', 'ur-live-only', en.usersRoles.states.liveOnly],
    ['/admin/devices', 'page-paired-devices', 'pd-live-only', en.pairedDevices.states.liveOnly],
  ] as const)('Simulated mode: %s is not redirected and shows its "Live mode only" state', async (path, testId, stateId, sentence) => {
    viewport(1920)
    // The INVESTIGATOR of the simulator: no role is redirected in Simulated mode.
    const { router } = mountSimulated(path, { operatorId: OPERATOR_IDS.BUDI })
    const page = await screen.findByTestId(testId)
    expect(router.state.location.pathname).toBe(path)
    const state = within(page).getByTestId(stateId)
    expect(within(state).getByText('This page needs the Core server')).toBeInTheDocument()
    expect(within(state).getByText(sentence)).toBeInTheDocument()
    // No selectable mode in this router: no switch is offered.
    expect(within(state).queryByRole('button')).not.toBeInTheDocument()
    expect(getMissingI18nKeys()).toEqual([])
  })

  it('Simulated mode, where the build offers the choice: "Switch to Live mode" asks first, then hands over to the runtime', async () => {
    viewport(1920)
    const switchTo = vi.fn(async () => true)
    mountSimulated('/admin/users', { coreMode: control(CoreMode.SIMULATED, switchTo) })
    const state = await screen.findByTestId('ur-live-only')
    fireEvent.click(within(state).getByTestId('ur-live-only-switch'))
    const dialog = await screen.findByTestId('mode-switch-dialog')
    expect(within(dialog).getByText('Switch to Live mode?')).toBeInTheDocument()
    expect(switchTo).not.toHaveBeenCalled()
    fireEvent.click(within(dialog).getByTestId('mode-switch-confirm'))
    await waitFor(() => expect(switchTo).toHaveBeenCalledWith(CoreMode.LIVE))
  })

  it('a signed-out visit goes to /login with the page as `redirect`, in both modes', async () => {
    const simulated = mountSimulated('/admin/users', { operatorId: null })
    await waitFor(() => expect(simulated.router.state.location.pathname).toBe('/login'))
    expect(simulated.router.state.location.search).toEqual({ redirect: '/admin/users' })
    cleanup()

    const live = await mountLive('/admin/devices', null)
    await waitFor(() => expect(live.router.state.location.pathname).toBe('/login'))
    expect(live.router.state.location.search).toEqual({ redirect: '/admin/devices' })
  })

  it('PG-1: a route file holds `createFileRoute` and the guard, and the page body lives in its feature folder', () => {
    for (const [file, feature, permission] of [
      ['users.tsx', '@/features/users-roles', 'USER_ADMIN'],
      ['devices.tsx', '@/features/paired-devices', 'PAIRING_MANAGE'],
    ] as const) {
      const text = readFileSync(join(SRC_DIR, 'routes/_app/admin', file), 'utf8')
      const imports = [...text.matchAll(/from '([^']+)'/g)].map((match) => match[1])
      expect(imports.sort()).toEqual(['./-guard', '@dems/shared/sim', '@tanstack/react-router', feature].sort())
      expect(text).toContain(`requireCorePermission(context.sim, Permission.${permission})`)
      expect(text).not.toMatch(/\buse[A-Z]\w*\(/) // no hook, no component body
    }
    expect(readdirSync(join(SRC_DIR, 'routes/_app/admin')).sort()).toEqual(['-guard.ts', 'devices.tsx', 'users.tsx'])
  })
})

describe('leaving the page whose permission was taken away (§6.3; RC-1, RC-3; CA-03; AC-C-50)', () => {
  it.each([
    ['/admin/users', 'page-users-roles'],
    ['/admin/devices', 'page-paired-devices'],
  ] as const)('%s: `session.updated` without the permission leaves for /dashboard, and the notice says why', async (path, testId) => {
    viewport(1920)
    const { bed, page, router, queryClient } = await mountLive(path)
    await screen.findByTestId(testId)
    const info = vi.spyOn(toast, 'info')
    // What the page would hold: a list of the Core in the cache. RC-3: it is gone before the guard redirects.
    queryClient.setQueryData(CORE_QUERY_KEYS.users, [{ id: 'OPR-001' }])
    queryClient.setQueryData(CORE_QUERY_KEYS.pairedDevices, [{ id: 'DEV-0001' }])
    const cachedWhenLeaving: unknown[] = []
    const stop = router.subscribe('onBeforeNavigate', (event) => {
      if (event.toLocation.pathname === '/dashboard') cachedWhenLeaving.push(queryClient.getQueryData(CORE_QUERY_KEYS.users), queryClient.getQueryData(CORE_QUERY_KEYS.pairedDevices))
    })

    bed.core.changeRole(OperatorRole.INVESTIGATOR, permissionsOf(OperatorRole.INVESTIGATOR))
    await bed.flush()
    await screen.findByTestId('page-dashboard')
    stop()
    expect(router.state.location.pathname).toBe('/dashboard')
    expect(screen.queryByTestId(testId)).not.toBeInTheDocument()
    expect(cachedWhenLeaving).toEqual([undefined, undefined])
    // With `replace`: Back does not return to the page that was lost.
    expect(router.history.length).toBe(1)
    expect(info).toHaveBeenCalledTimes(1)
    expect(info).toHaveBeenCalledWith('Your role is now Investigator. The available actions have changed.', {
      description: en.shell.roleNotice.pageLeft,
    })
    expect(await screen.findByText(en.shell.roleNotice.pageLeft)).toBeInTheDocument()
    // Nobody is signed out by a role change.
    expect(selectAuth(page.live.store.getState()).status).toBe(AuthStatus.SIGNED_IN)
    expect(screen.getByTestId('app-shell')).toBeInTheDocument()
    expect(getMissingI18nKeys()).toEqual([])
  })

  it('/admin/users stays when the permission that was lost is the other page\'s', async () => {
    viewport(1920)
    const { bed, router } = await mountLive('/admin/users')
    await screen.findByTestId('page-users-roles')
    const info = vi.spyOn(toast, 'info')
    // The same role with a shorter list (a permission refresh): no role notice, the guards run, the page stays.
    bed.core.changeRole(OperatorRole.SUPERVISOR, without(SUPERVISOR_SESSION.permissions, Permission.PAIRING_MANAGE))
    await bed.flush()
    await waitFor(() => expect(within(primaryNav()).queryByRole('link', { name: 'Paired Devices' })).not.toBeInTheDocument())
    expect(router.state.location.pathname).toBe('/admin/users')
    expect(screen.getByTestId('page-users-roles')).toBeInTheDocument()
    expect(info).not.toHaveBeenCalled()
  })

  it('a permission that goes without a role change (a permission refresh) leaves the page too, without a role notice', async () => {
    viewport(1920)
    const { bed, router } = await mountLive('/admin/users')
    await screen.findByTestId('page-users-roles')
    const info = vi.spyOn(toast, 'info')
    bed.core.changeRole(OperatorRole.SUPERVISOR, without(SUPERVISOR_SESSION.permissions, Permission.USER_ADMIN))
    await bed.flush()
    await screen.findByTestId('page-dashboard')
    expect(router.state.location.pathname).toBe('/dashboard')
    expect(info).not.toHaveBeenCalled()
  })

  it.each([
    ['`session.updated` first, then the delta of `operators`', true],
    ['the delta of `operators` first, then `session.updated`', false],
  ] as const)('/session/new: %s; the route is left for /dashboard', async (_order, sessionFirst) => {
    viewport(1920)
    const { bed, page, router } = await mountLive('/session/new')
    await screen.findByTestId('page-session-new')
    const info = vi.spyOn(toast, 'info')
    const technician = permissionsOf(OperatorRole.TECHNICIAN)
    expect(technician).not.toContain(Permission.SESSION_START)
    const socket = page.sockets.at(-1)!

    if (sessionFirst) {
      bed.core.changeRole(OperatorRole.TECHNICIAN, technician)
      await bed.flush()
      // The guard of this route reads the replicated `operators` slice, which has not changed yet.
      socket.delta(operatorsDelta(bed, OperatorRole.TECHNICIAN))
    } else {
      socket.delta(operatorsDelta(bed, OperatorRole.TECHNICIAN))
      await bed.flush()
      bed.core.changeRole(OperatorRole.TECHNICIAN, technician)
    }
    await bed.flush()
    await screen.findByTestId('page-dashboard')
    expect(router.state.location.pathname).toBe('/dashboard')
    expect(info).toHaveBeenCalledTimes(1)
    expect(info).toHaveBeenCalledWith('Your role is now Technician. The available actions have changed.', { description: en.shell.roleNotice.pageLeft })
    expect(selectAuth(page.live.store.getState()).status).toBe(AuthStatus.SIGNED_IN)
  })

  it('a role change that keeps the permission of the page that is open: /session/new stays, and the notice has one sentence', async () => {
    viewport(1920)
    const { bed, page, router } = await mountLive('/session/new')
    await screen.findByTestId('page-session-new')
    const info = vi.spyOn(toast, 'info')
    const investigator = permissionsOf(OperatorRole.INVESTIGATOR)
    expect(investigator).toContain(Permission.SESSION_START)

    bed.core.changeRole(OperatorRole.INVESTIGATOR, investigator)
    page.sockets.at(-1)!.delta(operatorsDelta(bed, OperatorRole.INVESTIGATOR))
    await bed.flush()
    await waitFor(() => expect(screen.queryByTestId('nav-admin-group')).not.toBeInTheDocument())
    expect(router.state.location.pathname).toBe('/session/new')
    expect(screen.getByTestId('page-session-new')).toBeInTheDocument()
    expect(info).toHaveBeenCalledTimes(1)
    expect(info).toHaveBeenCalledWith('Your role is now Investigator. The available actions have changed.', undefined)
  })

  it.each([['/evidence', 'page-evidence'], ['/storage', 'page-storage'], ['/security-audit', 'page-security-audit']] as const)(
    'every other route stays: %s',
    async (path, testId) => {
      viewport(1920)
      const { bed, page, router } = await mountLive(path)
      const before = await screen.findByTestId(testId)
      bed.core.changeRole(OperatorRole.INVESTIGATOR, permissionsOf(OperatorRole.INVESTIGATOR))
      page.sockets.at(-1)!.delta(operatorsDelta(bed, OperatorRole.INVESTIGATOR))
      await bed.flush()
      await waitFor(() => expect(screen.queryByTestId('nav-admin-group')).not.toBeInTheDocument())
      expect(router.state.location.pathname).toBe(path)
      // The same page element: nothing was mounted again, so nothing the operator typed is discarded.
      expect(screen.getByTestId(testId)).toBe(before)
    },
  )

  it('CA-03: the leave is the guard\'s, run again by `router.invalidate()`; the shell names no destination', async () => {
    viewport(1920)
    const { bed, router } = await mountLive('/admin/users')
    await screen.findByTestId('page-users-roles')
    const invalidate = vi.spyOn(router, 'invalidate')
    const navigate = vi.spyOn(router, 'navigate')
    bed.core.changeRole(OperatorRole.INVESTIGATOR, permissionsOf(OperatorRole.INVESTIGATOR))
    await bed.flush()
    await screen.findByTestId('page-dashboard')
    expect(invalidate).toHaveBeenCalled()
    // Nobody called `navigate`: the router followed the redirect the guard threw while it loaded the matches again.
    expect(navigate).not.toHaveBeenCalled()
    // (Finding CPW1-5) The two source-text pins that stood here — that `live-notices.tsx` contains
    // `router.invalidate()` and does not contain `navigate(` — are dropped: the two assertions above
    // measure exactly that on the running router, and a text pin of another file only adds a way for
    // a reformatting to redden a gated row.
  })

  it('another operator takes the session of this browser (a sign-in in another tab): the guards run for them, without a role notice', async () => {
    viewport(1920)
    const { bed, page, router } = await mountLive('/admin/users')
    await screen.findByTestId('page-users-roles')
    const info = vi.spyOn(toast, 'info')
    const danger = vi.spyOn(toast, 'danger')

    bed.core.signIn(INVESTIGATOR_SESSION)
    await bed.elapse(2_000, 250)
    expect(page.live.session?.operator.id).toBe(INVESTIGATOR_SESSION.operator.id)
    await screen.findByTestId('page-dashboard')
    expect(router.state.location.pathname).toBe('/dashboard')
    expect(screen.queryByTestId('nav-admin-group')).not.toBeInTheDocument()
    expect(info).not.toHaveBeenCalled()
    expect(danger.mock.calls.map(([title]) => title)).toEqual([])
  })
})

describe('the shell\'s call sites (CLG (c); AC-C-53; brief list row 18)', () => {
  const SHELL_DIR = join(SRC_DIR, 'components/shell')
  const production = readdirSync(SHELL_DIR)
    .filter((name) => /\.tsx?$/.test(name) && !name.includes('.test.'))
    .map((name) => ({ name, text: readFileSync(join(SHELL_DIR, name), 'utf8') }))
  /** The code without its comments: a rule is about what runs. */
  const code = (text: string) => text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')

  it('reads the shell\'s production files', () => {
    expect(production.map(({ name }) => name)).toEqual(expect.arrayContaining(['app-shell.tsx', 'user-menu.tsx', 'live-notices.tsx', 'mode-indicator.tsx', 'sidebar.tsx']))
  })

  it('no file takes the actions from `useSimActions` or reads `.actions` from a `Sim`', () => {
    for (const { name, text } of production) {
      expect(code(text), name).not.toMatch(/\buseSimActions\b/)
      expect(code(text), name).not.toMatch(/\bsim\.actions\b|\buseSimInstance\(\)\.actions\b|context\.sim\.actions\b/)
    }
  })

  it('the two call sites take them from `useCoreActions()` and consume the result through `settle`', () => {
    const using = production.filter(({ text }) => /\buseCoreActions\(\)/.test(code(text))).map(({ name }) => name)
    expect(using.sort()).toEqual(['app-shell.tsx', 'user-menu.tsx'])
    for (const name of using) {
      const text = code(production.find((file) => file.name === name)!.text)
      const calls = [...text.matchAll(/\bactions\.(\w+)\(/g)]
      expect(calls.length).toBeGreaterThan(0)
      // Every call of an action stands inside the `run` of a `settle(...)`.
      for (const call of calls) expect(text.slice(Math.max(0, (call.index ?? 0) - 16), call.index), `${name}: actions.${call[1]}`).toMatch(/settle\(\(\) => $/)
    }
  })
})

describe('the Stack Check page names the service that answered (decision D121, finding F72-3)', () => {
  it('prints the service name of the health answer, and reads as before for mock-core', async () => {
    viewport(1920)
    mountSimulated('/stack-check')
    await waitFor(() => expect(screen.getByTestId('health-version')).toHaveTextContent(/^mock-core v0\.1\.0 · api v1$/))
    cleanup()

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ ...health, service: 'dems-core-server', version: '0.2.0', ready: { database: true, engine: true } }), { status: 200 })),
    )
    await mountLive('/stack-check')
    await waitFor(() => expect(screen.getByTestId('health-version')).toHaveTextContent(/^core-server v0\.2\.0 · api v1$/))
  })
})
