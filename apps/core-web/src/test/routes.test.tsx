// Step 38 route and shell tests (masterplan/01_specs.md §14.2–§14.4, §14.13; AC-48, AC-49 and
// AC-66 at stub level). Every test builds the real router (route tree, guards, providers) around
// its own simulator with in-memory storage (D54(a): Node 26 and jsdom expose a global
// sessionStorage) and a heartbeat socket that never connects.
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { toast } from '@heroui/react'
import { QueryClient } from '@tanstack/react-query'
import { createMemoryHistory, RouterProvider } from '@tanstack/react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { HealthResponse } from '@dems/shared/api'
import type { SocketLike } from '@dems/shared/realtime'
import {
  ALWAYS_VISIBLE,
  AuthStatus,
  createMemoryAuthStorage,
  createSim,
  OPERATOR_IDS,
  SignOutReason,
  type Sim,
} from '@dems/shared/sim'
import { SHELL_RAIL_STORAGE_KEY } from '@/components/shell'
import { BOTTOM_TABS, NAV_ITEMS } from '@/components/shell/nav-items'
import { getMissingI18nKeys, resetMissingI18nKeys } from '@/i18n'
import { installRestoredPageGuard } from '@/lib/restored-page'
import { createAppRouter, type AppRouter } from '@/router'

/** §14.2 page paths → the stub test IDs (AC-48; `/login` is covered signed-out, see below). */
const SHELL_PAGES: ReadonlyArray<readonly [path: string, testId: string]> = [
  ['/dashboard', 'page-dashboard'],
  ['/session', 'page-session-monitor'],
  ['/session/new', 'page-session-new'],
  ['/evidence', 'page-evidence'],
  ['/evidence/EV-20260930-0001', 'page-evidence-detail'],
  ['/devices', 'page-devices'],
  ['/storage', 'page-storage'],
  ['/network-time', 'page-network-time'],
  ['/security-audit', 'page-security-audit'],
  ['/system', 'page-system'],
  ['/developer/api', 'page-api-reference'],
  ['/stack-check', 'page-stack-check'],
]

const health: HealthResponse = {
  status: 'ok',
  service: 'dems-mock-core',
  version: '0.1.0',
  apiVersion: 'v1',
  serverTime: '2026-10-01T03:00:00.000Z',
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

interface Harness {
  sim: Sim
  router: AppRouter
}

const sims: Sim[] = []

function mount(path: string, operatorId: string | null = OPERATOR_IDS.BUDI): Harness {
  const authStorage = createMemoryAuthStorage()
  if (operatorId) authStorage.save({ operatorId, issuedAt: Date.now() })
  const sim = createSim({
    storage: null,
    authStorage,
    visibility: ALWAYS_VISIBLE,
    scheduler: () => () => undefined, // no engine ticks: the tests drive state directly
  })
  sims.push(sim)
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const router = createAppRouter(
    { sim, queryClient, socketFactory: () => new SilentSocket() },
    { history: createMemoryHistory({ initialEntries: [path] }) },
  )
  render(<RouterProvider router={router} />)
  return { sim, router }
}

/** matchMedia that answers `(min-width: Npx)` for a given viewport width (jsdom has no layout). */
function useViewportWidth(width: number) {
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

const originalMatchMedia = window.matchMedia

// jsdom has no scrolling; the router resets `#main-content` on navigation (scrollToTopSelectors).
Element.prototype.scrollTo ??= function scrollTo() {}
window.scrollTo = (() => undefined) as typeof window.scrollTo

beforeEach(() => {
  resetMissingI18nKeys()
  window.localStorage.removeItem(SHELL_RAIL_STORAGE_KEY)
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(JSON.stringify(health), { status: 200 })),
  )
})

afterEach(() => {
  cleanup()
  for (const sim of sims.splice(0)) sim.stop()
  window.matchMedia = originalMatchMedia
  vi.unstubAllGlobals()
})

describe('routes (AC-48 at stub level)', () => {
  it.each(SHELL_PAGES)('%s renders %s inside the shell for a signed-in operator', async (path, testId) => {
    const { router } = mount(path)
    expect(await screen.findByTestId(testId)).toBeInTheDocument()
    expect(screen.getByTestId('app-shell')).toBeInTheDocument()
    expect(screen.getByRole('main')).toContainElement(screen.getByTestId(testId))
    expect(router.state.location.pathname).toBe(path)
    expect(getMissingI18nKeys()).toEqual([]) // AC-66
  })

  it('/login renders page-login outside the shell when signed out', async () => {
    mount('/login', null)
    expect(await screen.findByTestId('page-login')).toBeInTheDocument()
    expect(screen.queryByTestId('app-shell')).not.toBeInTheDocument()
    expect(getMissingI18nKeys()).toEqual([])
  })

  it('/login sends a signed-in operator to /dashboard', async () => {
    const { router } = mount('/login')
    expect(await screen.findByTestId('page-dashboard')).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/dashboard')
  })

  it('/ redirects to /dashboard', async () => {
    const { router } = mount('/')
    expect(await screen.findByTestId('page-dashboard')).toBeInTheDocument()
    expect(router.state.location.href).toBe('/dashboard')
  })

  it('an unknown path shows the not-found screen', async () => {
    mount('/no-such-page')
    expect(await screen.findByTestId('page-not-found')).toBeInTheDocument()
  })
})

describe('guard (AC-49)', () => {
  it('redirects signed-out /dashboard to /login?redirect=%2Fdashboard, then returns there after sign-in', async () => {
    const { router, sim } = mount('/dashboard', null)
    expect(await screen.findByTestId('page-login')).toBeInTheDocument()
    expect(router.state.location.href).toBe('/login?redirect=%2Fdashboard')

    const page = screen.getByTestId('page-login')
    fireEvent.change(within(page).getByLabelText(/username/i), { target: { value: 'budi.santoso' } })
    fireEvent.change(within(page).getByLabelText(/password/i), { target: { value: 'demo-2026' } })
    fireEvent.click(within(page).getByRole('button', { name: /sign in/i }))

    expect(await screen.findByTestId('page-dashboard')).toBeInTheDocument()
    expect(router.state.location.href).toBe('/dashboard')
    expect(sim.store.getState().auth.status).toBe(AuthStatus.SIGNED_IN)
  })

  it('keeps the full requested href (path and search) in ?redirect=', async () => {
    const { router } = mount('/evidence?status=SEALED&page=2', null)
    await screen.findByTestId('page-login')
    // The router's canonical href (strings unquoted, numbers as JSON).
    expect(router.state.location.search).toEqual({ redirect: '/evidence?status=SEALED&page=2' })
  })

  it('drops a foreign ?redirect= target (open-redirect guard)', async () => {
    const { router } = mount('/login?redirect=%2F%2Fevil.example', null)
    await screen.findByTestId('page-login')
    expect(router.state.location.search).toEqual({})
  })

  it('leaves the shell for /login when the operator signs out', async () => {
    const { router, sim } = mount('/devices')
    await screen.findByTestId('page-devices')
    act(() => sim.actions.signOut(SignOutReason.USER))
    expect(await screen.findByTestId('page-login')).toBeInTheDocument()
    expect(router.state.location.href).toBe('/login')
  })

  // Fix wave J (JW-14 (d)): the leave stays (the guard), and it is no longer silent - the shell says which page was
  // refused and which roles open it. This case REPLACES the one that pinned the redirect alone.
  it('sends an operator without SESSION_START (TECHNICIAN) from /session/new to /dashboard AND says why, naming the roles', async () => {
    const warning = vi.spyOn(toast, 'warning')
    const { router } = mount('/session/new', OPERATOR_IDS.RINA)
    expect(await screen.findByTestId('page-dashboard')).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/dashboard')
    await waitFor(() => expect(warning).toHaveBeenCalledTimes(1))
    expect(warning).toHaveBeenCalledWith('Start New Session: not available to your role', { description: 'Requires the Investigator or Supervisor role' })
  })

  it('NEGATIVE CONTROL: an investigator opens /session/new and nothing is said', async () => {
    const warning = vi.spyOn(toast, 'warning')
    mount('/session/new', OPERATOR_IDS.BUDI)
    expect(await screen.findByTestId('page-session-new')).toBeInTheDocument()
    expect(warning).not.toHaveBeenCalled()
  })
})

describe('search validation (§14.2)', () => {
  it('falls back instead of failing on malformed search values', async () => {
    const { router } = mount('/session/new?step=9')
    await screen.findByTestId('page-session-new')
    expect(router.state.location.search).toEqual({ step: 1 })
  })

  it('keeps valid evidence filters and drops invalid ones', async () => {
    const { router } = mount('/evidence?q=Rahma&status=%22BOGUS%22&page=2&from=%222026-09-30%22&to=%22yesterday%22')
    await screen.findByTestId('page-evidence')
    expect(router.state.location.search).toEqual({ q: 'Rahma', page: 2, from: '2026-09-30' })
  })

  it('accepts the evidence detail tabs', async () => {
    const { router } = mount('/evidence/EV-20260930-0003?tab=%22integrity%22')
    await screen.findByTestId('page-evidence-detail')
    expect(router.state.location.search).toEqual({ tab: 'integrity' })
    expect(screen.getByText('EV-20260930-0003')).toBeInTheDocument()
  })
})

describe('AppShell (§14.3–§14.4)', () => {
  it('shows the top bar and the Primary nav with the DEVELOPER group at 1920 px', async () => {
    useViewportWidth(1920)
    mount('/storage')
    await screen.findByTestId('page-storage')

    const shell = screen.getByTestId('app-shell')
    expect(shell).toHaveAttribute('data-shell-tier', 'xl')
    expect(shell).toHaveAttribute('data-sidebar', 'full')

    const nav = screen.getByRole('navigation', { name: 'Primary' })
    const links = within(nav).getAllByRole('link')
    expect(links.map((link) => link.textContent?.replace('DEV', '').trim())).toEqual([
      'Dashboard',
      'Session Monitor',
      'Evidence',
      'Devices & Inputs',
      'Storage',
      'Network & Time',
      'Security & Audit',
      'System & Maintenance',
      'API Reference',
    ])
    expect(within(nav).getByRole('link', { name: /Storage/ })).toHaveAttribute('aria-current', 'page')
    expect(within(nav).getByText('DEVELOPER')).toBeInTheDocument()
    expect(within(nav).getByText('DEV')).toBeInTheDocument()

    const header = screen.getByRole('banner')
    expect(within(header).getByRole('link', { name: /go to Dashboard/i })).toHaveAttribute('href', '/dashboard')
    expect(within(header).getByTestId('top-bar-clock').textContent).toMatch(/^\d{2}:\d{2}:\d{2}$/)
    expect(within(header).getByText('DEMS-IR-01')).toBeInTheDocument()
    expect(within(header).getByText('AKP Budi Santoso')).toBeInTheDocument()
    expect(within(header).getByTestId('secure-pill')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Skip to main content' })).toHaveAttribute('href', '#main-content')
    expect(getMissingI18nKeys()).toEqual([])
  })

  // Fix wave J rounds one and three (JW-20): `/stack-check` stays reachable by address for every role
  // (01_specs §14.2: a URL-only diagnostic) - and it is NOT part of the operator's navigation: no entry of
  // the sidebar, the bottom tabs or any page links to it, and the page says what it is.
  it('JW-20: /stack-check is linked from no operator navigation, on no role, and names itself a developer diagnostic', async () => {
    expect([...NAV_ITEMS, ...BOTTOM_TABS].map((item) => item.to as string)).not.toContain('/stack-check')
    for (const operatorId of [OPERATOR_IDS.BUDI, OPERATOR_IDS.ANDI, OPERATOR_IDS.RINA]) {
      useViewportWidth(1920)
      mount('/dashboard', operatorId)
      await screen.findByTestId('page-dashboard')
      const hrefs = Array.from(document.querySelectorAll('a[href]')).map((link) => link.getAttribute('href') ?? '')
      expect(hrefs.length).toBeGreaterThan(8)
      expect(hrefs.filter((href) => href.includes('stack-check')), operatorId).toEqual([])
      cleanup()
    }
    // The page itself, opened by address: it says what it is.
    mount('/stack-check', OPERATOR_IDS.BUDI)
    const page = await screen.findByTestId('page-stack-check')
    expect(page).toHaveTextContent('Developer diagnostic of this console build. It is not an operator page and shows no evidence.')
    // Static: no production file outside the page and its route names the path in code.
    const code = (text: string) => text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
    const sources = import.meta.glob(['../**/*.{ts,tsx}', '!../**/*.test.{ts,tsx}', '!../**/__tests__/**', '!../test/**', '!../runtime/testing/**', '!../routeTree.gen.ts', '!../routes/_app/stack-check.tsx', '!../features/stack-check/**'], { query: '?raw', import: 'default', eager: true }) as Record<string, string>
    expect(Object.keys(sources).length).toBeGreaterThan(200)
    expect(Object.entries(sources).filter(([, text]) => /['"`]\/stack-check/.test(code(text))).map(([name]) => name)).toEqual([])
  })

  // Fix wave J (JW-15; "by code only" in round one, proven here): after "Sign out" the browser's Back could
  // restore a page from its back / forward cache with the operator still shown as signed in. A restored
  // document (`pageshow`, `persisted: true`) is loaded again, so the start-up asks the Core for the session.
  it('JW-15: a page restored from the back / forward cache is reloaded; an ordinary page show is not; the shell installs the guard and removes it', async () => {
    const listeners = new Map<string, EventListener>()
    const reload = vi.fn()
    const target = {
      addEventListener: (type: string, listener: EventListener) => void listeners.set(type, listener),
      removeEventListener: (type: string, listener: EventListener) => void (listeners.get(type) === listener ? listeners.delete(type) : undefined),
      location: { reload },
    }
    const remove = installRestoredPageGuard(target as never)
    const show = (persisted: boolean) => listeners.get('pageshow')?.(Object.assign(new Event('pageshow'), { persisted }))
    // CONTROL - the first show of a page load is not a restore.
    show(false)
    expect(reload).not.toHaveBeenCalled()
    show(true)
    expect(reload).toHaveBeenCalledTimes(1)
    remove()
    expect(listeners.has('pageshow')).toBe(false)

    // The shell: the guard is on the window while a signed-in page is mounted, and gone after it.
    const added = vi.spyOn(window, 'addEventListener')
    const removed = vi.spyOn(window, 'removeEventListener')
    mount('/developer/api')
    await screen.findByTestId('app-shell')
    const installed = added.mock.calls.filter(([type]) => type === 'pageshow')
    expect(installed.length).toBeGreaterThan(0)
    cleanup()
    const guard = installed.at(-1)![1]
    expect(removed.mock.calls.some(([type, listener]) => type === 'pageshow' && listener === guard)).toBe(true)
  })

  it('reads SECURE once the simulator is ready', async () => {
    useViewportWidth(1920)
    mount('/dashboard')
    await screen.findByTestId('page-dashboard')
    await waitFor(() => expect(screen.getByTestId('secure-pill')).toHaveAttribute('data-state', 'SECURE'))
  })

  it('collapses to the icon rail with [ and remembers it', async () => {
    useViewportWidth(1440)
    mount('/dashboard')
    await screen.findByTestId('page-dashboard')
    const shell = screen.getByTestId('app-shell')
    expect(shell).toHaveAttribute('data-sidebar', 'full')

    fireEvent.keyDown(document.body, { key: '[' })
    expect(shell).toHaveAttribute('data-sidebar', 'rail')
    expect(window.localStorage.getItem(SHELL_RAIL_STORAGE_KEY)).toBe('1')
    // Labels stay as accessible names in the rail.
    expect(within(screen.getByRole('navigation', { name: 'Primary' })).getByRole('link', { name: 'Evidence' })).toBeInTheDocument()

    fireEvent.keyDown(document.body, { key: '[' })
    expect(shell).toHaveAttribute('data-sidebar', 'full')
  })

  it('uses the rail at 1200 px and hides the sidebar behind a Drawer at 900 px', async () => {
    useViewportWidth(1200)
    mount('/dashboard')
    await screen.findByTestId('page-dashboard')
    expect(screen.getByTestId('app-shell')).toHaveAttribute('data-sidebar', 'rail')
    cleanup()

    useViewportWidth(900)
    mount('/dashboard')
    await screen.findByTestId('page-dashboard')
    expect(screen.getByTestId('app-shell')).toHaveAttribute('data-sidebar', 'drawer')
    expect(screen.getByRole('button', { name: 'Open navigation' })).toHaveAttribute('aria-expanded', 'false')
  })

  it('signs out from the user menu and lands on /login', async () => {
    useViewportWidth(1920)
    const { router, sim } = mount('/system')
    await screen.findByTestId('page-system')
    fireEvent.click(screen.getByTestId('user-menu'))
    const menu = await screen.findByRole('menu')
    expect(within(menu).getByRole('menuitem', { name: /Role: Investigator/ })).toHaveAttribute('aria-disabled', 'true')
    fireEvent.click(within(menu).getByRole('menuitem', { name: 'Sign out' }))
    expect(await screen.findByTestId('page-login')).toBeInTheDocument()
    expect(router.state.location.href).toBe('/login')
    expect(sim.store.getState().audit.rows.at(-1)?.type).toBe('AUTH_SIGNED_OUT')
  })

  it('opens the integrity checklist from the SECURE pill', async () => {
    useViewportWidth(1920)
    mount('/dashboard')
    await screen.findByTestId('page-dashboard')
    await waitFor(() => expect(screen.getByTestId('secure-pill')).toHaveAttribute('data-state', 'SECURE'))
    fireEvent.click(screen.getByTestId('secure-pill'))
    const list = await screen.findByTestId('integrity-checklist')
    const rows = within(list).getAllByRole('listitem')
    expect(rows).toHaveLength(9)
    expect(rows.every((row) => row.getAttribute('data-status') === 'OK')).toBe(true)
    expect(getMissingI18nKeys()).toEqual([])
  })

  it('shows the bottom tab bar below 768 px', async () => {
    useViewportWidth(600)
    mount('/evidence')
    await screen.findByTestId('page-evidence')
    const tabs = screen.getByTestId('bottom-tabs')
    expect(within(tabs).getByRole('link', { name: 'Evidence' })).toHaveAttribute('aria-current', 'page')
    expect(within(tabs).getByRole('button', { name: 'More' })).toBeInTheDocument()
  })
})
