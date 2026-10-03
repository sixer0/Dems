// Step 41 shell-motion tests (03_motion_spec §4 M-APP-01..04, M-SH-01..08, §8, §9.4; AC-70 for
// the shell loops; row 41: H-M1 outcome, reduced-motion test for shell loops). Every test builds
// the real router (route tree, guards, providers) around its own simulator, like routes.test.tsx.
import { Component, type ReactNode } from 'react'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { QueryClient } from '@tanstack/react-query'
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
  useRouterState,
} from '@tanstack/react-router'
import { AnimatePresence, motion, MotionGlobalConfig } from 'motion/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { SocketLike } from '@dems/shared/realtime'
import {
  ALWAYS_VISIBLE,
  createMemoryAuthStorage,
  createSim,
  FaultKind,
  OPERATOR_IDS,
  selectUnacknowledgedAlertCount,
  SignOutReason,
  type Sim,
} from '@dems/shared/sim'
import { motion as tokens } from '@dems/shared/tokens'
import { ExitGuard } from '@/components/shell/exit-guard'
import {
  ROUTE_BACK_TYPE,
  ROUTE_FORWARD_TYPE,
  ROUTE_TRANSITION_TYPE,
  routeViewTransitionTypes,
} from '@/components/shell/route-view-transition'
import { buildShellChoreography, HANDOFF_CONTENT_MS } from '@/components/shell/shell-choreography'
import { SHELL_INTRO_STORAGE_KEY } from '@/components/shell/shell-entrance'
import { buildMotionKit, REDUCED_MOTION_MEDIA_QUERY, REDUCED_MOTION_STORAGE_KEY } from '@/motion'
import { createAppRouter, type AppRouter } from '@/router'

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

/** `matchMedia` for a viewport width plus the OS reduced-motion setting (jsdom has no layout). */
function stubMatchMedia({ width, reduced }: { width: number; reduced: boolean }) {
  window.matchMedia = ((query: string) => {
    const min = /min-width:\s*(\d+)px/.exec(query)
    const matches = query === REDUCED_MOTION_MEDIA_QUERY ? reduced : min ? width >= Number(min[1]) : false
    return {
      matches,
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

/** An IntersectionObserver that reports every observed element as on screen (R10 lets loops run). */
class VisibleObserver {
  private readonly callback: IntersectionObserverCallback
  constructor(callback: IntersectionObserverCallback) {
    this.callback = callback
  }
  observe(target: Element) {
    queueMicrotask(() =>
      this.callback([{ target, isIntersecting: true, intersectionRatio: 1 } as IntersectionObserverEntry], this as never),
    )
  }
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return []
  }
}

const originalMatchMedia = window.matchMedia
const originalObserver = globalThis.IntersectionObserver

Element.prototype.scrollTo ??= function scrollTo() {}
window.scrollTo = (() => undefined) as typeof window.scrollTo

beforeEach(() => {
  window.sessionStorage.setItem(SHELL_INTRO_STORAGE_KEY, '1') // most tests want a plain arrival
  window.localStorage.removeItem(REDUCED_MOTION_STORAGE_KEY)
  window.localStorage.removeItem('dems.shell.rail')
  vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 503 })))
  globalThis.IntersectionObserver = VisibleObserver as unknown as typeof IntersectionObserver
})

afterEach(() => {
  cleanup()
  for (const sim of sims.splice(0)) sim.stop()
  window.matchMedia = originalMatchMedia
  globalThis.IntersectionObserver = originalObserver
  window.sessionStorage.removeItem(SHELL_INTRO_STORAGE_KEY)
  MotionGlobalConfig.skipAnimations = true
  vi.unstubAllGlobals()
})

const slot = (name: string) => document.querySelector<HTMLElement>(`[data-shell-slot="${name}"]`)

describe('H-M1: can a keyed AnimatePresence keep the exiting Login route mounted?', () => {
  // The native M-APP-01 pattern (03_motion_spec §4): the root wraps the top-level outlet in
  // AnimatePresence keyed by the top-level match, and the exiting copy is expected to keep showing
  // Login while the emblem flies. This probe runs that exact pattern with real exit animations.
  it('does not hold for TanStack Router 1.170: the exiting copy re-renders with the NEW route', async () => {
    MotionGlobalConfig.skipAnimations = false
    function ProbeRoot() {
      const topLevel = useRouterState({ select: (state) => state.matches[1]?.routeId ?? 'none' })
      return (
        <AnimatePresence mode="sync" initial={false}>
          <motion.div key={topLevel} data-testid="probe-wrapper" data-key={topLevel} exit={{ opacity: 0 }} transition={{ duration: 10 }}>
            <Outlet />
          </motion.div>
        </AnimatePresence>
      )
    }
    const rootRoute = createRootRoute({ component: ProbeRoot })
    const loginRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/login',
      component: () => <p data-testid="probe-login">login</p>,
    })
    const appRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/app',
      component: () => <p data-testid="probe-app">shell</p>,
    })
    const router = createRouter({
      routeTree: rootRoute.addChildren([loginRoute, appRoute]),
      history: createMemoryHistory({ initialEntries: ['/login'] }),
    })
    render(<RouterProvider router={router} />)
    await screen.findByTestId('probe-login')

    await act(() => router.navigate({ href: '/app' }))
    const wrappers = await waitFor(() => {
      const found = screen.getAllByTestId('probe-wrapper')
      expect(found).toHaveLength(2) // the exiting copy is still mounted (10 s exit)...
      return found
    })
    const exiting = wrappers.find((wrapper) => wrapper.dataset.key === '/login')
    expect(exiting).toBeDefined()
    // ...but it no longer shows Login: its <Outlet /> follows the router store to the new match.
    expect(within(exiting!).queryByTestId('probe-login')).toBeNull()
    expect(within(exiting!).getByTestId('probe-app')).toBeInTheDocument()
    expect(screen.getAllByTestId('probe-app')).toHaveLength(2) // the shell would mount twice
    expect(screen.queryByTestId('probe-login')).toBeNull()
  })
})

describe('MotionPolicyProvider mounted at the root (D59)', () => {
  it('marks <html> with the resolved policy: full by default', async () => {
    stubMatchMedia({ width: 1920, reduced: false })
    mount('/dashboard')
    await screen.findByTestId('page-dashboard')
    expect(document.documentElement.dataset.motion).toBe('full')
    expect(document.documentElement.dataset.motionSpeed).toBe('normal')
  })

  it('follows the OS reduced-motion setting and the in-app switch (localStorage dems.motion.reduced)', async () => {
    stubMatchMedia({ width: 1920, reduced: true })
    mount('/dashboard')
    await screen.findByTestId('page-dashboard')
    expect(document.documentElement.dataset.motion).toBe('reduced')
    cleanup()

    stubMatchMedia({ width: 1920, reduced: false })
    window.localStorage.setItem(REDUCED_MOTION_STORAGE_KEY, '1')
    mount('/dashboard')
    await screen.findByTestId('page-dashboard')
    expect(document.documentElement.dataset.motion).toBe('reduced')
  })
})

describe('shell ambient loops (M-SH-04/05/07; §9.4 one shell slot; AC-70)', () => {
  it('runs the topographic drift, SECURE dot and clock colon as one shell loop in full motion', async () => {
    stubMatchMedia({ width: 1920, reduced: false })
    mount('/storage')
    await screen.findByTestId('page-storage')
    await waitFor(() => expect(slot('topo')).toHaveAttribute('data-ambient', 'running'))
    await waitFor(() => expect(slot('secure-dot')).toHaveAttribute('data-ambient', 'running'))
    const face = document.querySelector<HTMLElement>('.dems-clock-face')!
    await waitFor(() => expect(face).toHaveAttribute('data-ambient', 'running'))
    for (const element of [slot('topo'), slot('secure-dot'), face]) {
      expect(element).toHaveAttribute('data-motion', 'full')
    }
    // M-SH-04: SlidingNumber digits (ten glyphs per digit) behind an aria-hidden face.
    expect(face).toHaveAttribute('data-sliding', 'true')
    expect(face).toHaveAttribute('aria-hidden', 'true')
    expect(screen.getByTestId('top-bar-clock').textContent).toMatch(/^\d{2}:\d{2}:\d{2}$/)
    // No BorderBeam while SECURE (M-SH-05).
    expect(slot('secure-beam')?.childElementCount).toBe(0)
  })

  it('reduced motion: every shell loop is static and marked data-motion="reduced" (the row-41 test)', async () => {
    stubMatchMedia({ width: 1920, reduced: true })
    const { sim } = mount('/storage')
    await screen.findByTestId('page-storage')
    await waitFor(() => expect(screen.getByTestId('secure-pill')).toHaveAttribute('data-state', 'SECURE'))
    // A degraded state would start the beam in full motion; reduced keeps it off.
    act(() => sim.actions.inject(FaultKind.FAN_STALL))
    await waitFor(() => expect(screen.getByTestId('secure-pill')).toHaveAttribute('data-state', 'ATTENTION'))

    const face = document.querySelector<HTMLElement>('.dems-clock-face')!
    for (const element of [slot('topo'), slot('secure-dot'), slot('secure-beam'), face]) {
      expect(element).toHaveAttribute('data-motion', 'reduced')
      expect(element).toHaveAttribute('data-ambient', 'paused')
    }
    expect(slot('secure-beam')?.childElementCount).toBe(0) // no BorderBeam
    expect(screen.queryByTestId('secure-ring-pulse')).toBeNull() // no escalation pulse (flashes off)
    expect(face).toHaveAttribute('data-sliding', 'false') // §8 number tickers jump to final
    expect(face.textContent).toMatch(/^\d{2}:\d{2}:\d{2}$/)
    expect(slot('nav-active')).not.toHaveAttribute('data-layout-id') // no flight, cross-fade instead
    expect(slot('route-content')?.querySelector('.dems-route')).toHaveAttribute('data-motion', 'reduced')
    // The CSS side: motion.css stops [data-ambient] loops under html[data-motion="reduced"].
    expect(document.documentElement.dataset.motion).toBe('reduced')
  })
})

describe('SECURE pill (M-SH-05) and bell (M-SH-06)', () => {
  it('escalation pulses once and starts the BorderBeam; recovery stops it without a pulse', async () => {
    stubMatchMedia({ width: 1920, reduced: false })
    const { sim } = mount('/dashboard')
    await screen.findByTestId('page-dashboard')
    const pill = screen.getByTestId('secure-pill')
    await waitFor(() => expect(pill).toHaveAttribute('data-state', 'SECURE'))
    expect(slot('secure-dot')).toHaveAttribute('data-pulses', '0') // hydration never pulses

    act(() => sim.actions.inject(FaultKind.FAN_STALL))
    await waitFor(() => expect(pill).toHaveAttribute('data-state', 'ATTENTION'))
    expect(slot('secure-dot')).toHaveAttribute('data-pulses', '1')
    expect(screen.getByTestId('secure-ring-pulse')).toBeInTheDocument()
    await waitFor(() => expect(slot('secure-beam')).toHaveAttribute('data-ambient', 'running'))
    expect(slot('secure-beam')?.childElementCount).toBe(1) // BorderBeam mounted

    act(() => sim.actions.inject(FaultKind.CAMERA_LOSS))
    await waitFor(() => expect(pill).toHaveAttribute('data-state', 'CRITICAL'))
    expect(slot('secure-dot')).toHaveAttribute('data-pulses', '2')

    act(() => {
      sim.actions.clearFault(FaultKind.CAMERA_LOSS)
      sim.actions.clearFault(FaultKind.FAN_STALL)
    })
    await waitFor(() => expect(pill).toHaveAttribute('data-state', 'SECURE'))
    expect(slot('secure-dot')).toHaveAttribute('data-pulses', '2') // de-escalation: colour only (R8)
    await waitFor(() => expect(slot('secure-beam')?.childElementCount).toBe(0))
  })

  it('swings the bell when unacknowledged alerts rise, at most once per 5 s burst', async () => {
    stubMatchMedia({ width: 1920, reduced: false })
    const { sim } = mount('/dashboard')
    await screen.findByTestId('page-dashboard')
    const scope = document.querySelector<HTMLElement>('.dems-bell-scope')!
    expect(scope).toHaveAttribute('data-swings', '0')
    const before = selectUnacknowledgedAlertCount(sim.store.getState())

    act(() => sim.actions.inject(FaultKind.FAN_STALL))
    await waitFor(() => expect(selectUnacknowledgedAlertCount(sim.store.getState())).toBeGreaterThan(before))
    await waitFor(() => expect(scope).toHaveAttribute('data-swings', '1'))

    act(() => sim.actions.inject(FaultKind.GNSS_LOSS)) // a second alert inside the 5 s burst
    await waitFor(() => expect(selectUnacknowledgedAlertCount(sim.store.getState())).toBeGreaterThan(before + 1))
    expect(scope).toHaveAttribute('data-swings', '1')
  })
})

describe('sidebar (M-SH-01..03)', () => {
  it('moves the one nav-active card (layoutId) to the new item on navigation', async () => {
    stubMatchMedia({ width: 1920, reduced: false })
    const { router } = mount('/storage')
    await screen.findByTestId('page-storage')
    const nav = screen.getByRole('navigation', { name: 'Primary' })
    const active = () => nav.querySelectorAll('[data-shell-slot="nav-active"]')
    expect(active()).toHaveLength(1)
    expect(active()[0]).toHaveAttribute('data-layout-id', 'nav-active')
    expect(active()[0]?.closest('a')).toHaveAttribute('data-nav-id', 'storage')

    await act(() => router.navigate({ to: '/devices' }))
    await screen.findByTestId('page-devices')
    expect(active()).toHaveLength(1)
    expect(active()[0]?.closest('a')).toHaveAttribute('data-nav-id', 'devices')
    // M-SH-01: the hover-follow background (AnimatedBackground) wraps every item.
    expect(nav.querySelectorAll('li[data-checked]')).toHaveLength(9)
    expect(nav.querySelectorAll('.dems-nav-sheen')).toHaveLength(9)
  })

  it('collapses to the rail and back; expanding replays the label enter', async () => {
    stubMatchMedia({ width: 1920, reduced: false })
    mount('/dashboard')
    await screen.findByTestId('page-dashboard')
    const shell = screen.getByTestId('app-shell')
    fireEvent.keyDown(document.body, { key: '[' })
    expect(shell).toHaveAttribute('data-sidebar', 'rail')
    fireEvent.keyDown(document.body, { key: '[' })
    expect(shell).toHaveAttribute('data-sidebar', 'full')
    expect(slot('topo')).toBeInTheDocument() // the footer returns with the full sidebar
  })
})

describe('route transitions (M-APP-04)', () => {
  it('re-keys the content wrapper per path, forward on navigate and back on history back (R7)', async () => {
    stubMatchMedia({ width: 1920, reduced: false })
    const { router } = mount('/dashboard')
    await screen.findByTestId('page-dashboard')
    const wrapper = () => slot('route-content')!.querySelector<HTMLElement>('.dems-route')!
    expect(wrapper()).toHaveAttribute('data-route-key', '/dashboard')
    expect(wrapper()).toContainElement(screen.getByTestId('page-dashboard'))

    await act(() => router.navigate({ to: '/devices' }))
    await screen.findByTestId('page-devices')
    expect(wrapper()).toHaveAttribute('data-route-key', '/devices')
    expect(wrapper()).toHaveAttribute('data-direction', 'forward')

    await act(async () => {
      router.history.back()
    })
    await screen.findByTestId('page-dashboard')
    expect(wrapper()).toHaveAttribute('data-route-key', '/dashboard')
    expect(wrapper()).toHaveAttribute('data-direction', 'back')
  })

  it('keeps the wrapper (no enter replay) for search-only changes', async () => {
    stubMatchMedia({ width: 1920, reduced: false })
    const { router } = mount('/evidence')
    const page = await screen.findByTestId('page-evidence')
    await act(() => router.navigate({ to: '/evidence', search: { page: 2 } }))
    expect(screen.getByTestId('page-evidence')).toBe(page) // same element: not remounted
  })

  it('plays the TextEffect title while the <h1> keeps its accessible name', async () => {
    stubMatchMedia({ width: 1920, reduced: false })
    mount('/devices')
    await screen.findByTestId('page-devices')
    const heading = screen.getByRole('heading', { level: 1, name: 'DEVICES & INPUTS' })
    expect(heading).toHaveAttribute('data-text-effect')
    expect(heading.querySelectorAll('[aria-hidden="true"]').length).toBeGreaterThan(1) // animated words
  })

  it('asks the router for a typed view transition only for in-shell path changes', () => {
    const at = (pathname: string, index: number) => ({ pathname, state: { __TSR_index: index } as never })
    expect(routeViewTransitionTypes({ fromLocation: at('/dashboard', 0), toLocation: at('/devices', 1), pathChanged: true })).toEqual([
      ROUTE_TRANSITION_TYPE,
      ROUTE_FORWARD_TYPE,
    ])
    expect(routeViewTransitionTypes({ fromLocation: at('/devices', 1), toLocation: at('/dashboard', 0), pathChanged: true })).toEqual([
      ROUTE_TRANSITION_TYPE,
      ROUTE_BACK_TYPE,
    ])
    // Search-only change, the Login ↔ shell hand-off (two-phase), and the very first load: none.
    expect(routeViewTransitionTypes({ fromLocation: at('/evidence', 1), toLocation: at('/evidence', 2), pathChanged: false })).toBe(false)
    expect(routeViewTransitionTypes({ fromLocation: at('/login', 0), toLocation: at('/dashboard', 1), pathChanged: true })).toBe(false)
    expect(routeViewTransitionTypes({ fromLocation: at('/dashboard', 1), toLocation: at('/login', 2), pathChanged: true })).toBe(false)
    expect(routeViewTransitionTypes({ toLocation: at('/dashboard', 0), pathChanged: true })).toBe(false)
  })
})

describe('app-level entrances and exit (M-APP-01..03, H-M1 fallback)', () => {
  it('M-APP-03: the first shell of a browser session is a cold entry (emblem draw), then plain', async () => {
    window.sessionStorage.removeItem(SHELL_INTRO_STORAGE_KEY)
    stubMatchMedia({ width: 1920, reduced: false })
    mount('/dashboard')
    await screen.findByTestId('page-dashboard')
    expect(screen.getByTestId('app-shell')).toHaveAttribute('data-entrance', 'cold')
    expect(slot('brand-emblem')?.querySelector('svg')).toHaveAttribute('data-emblem-draw')
    expect(window.sessionStorage.getItem(SHELL_INTRO_STORAGE_KEY)).toBe('1')
    cleanup()

    mount('/dashboard')
    await screen.findByTestId('page-dashboard')
    expect(screen.getByTestId('app-shell')).toHaveAttribute('data-entrance', 'plain')
    expect(slot('brand-emblem')?.querySelector('svg')).not.toHaveAttribute('data-emblem-draw')
  })

  it('M-APP-03 under reduced motion: no stroke draw', async () => {
    window.sessionStorage.removeItem(SHELL_INTRO_STORAGE_KEY)
    stubMatchMedia({ width: 1920, reduced: true })
    mount('/dashboard')
    await screen.findByTestId('page-dashboard')
    expect(screen.getByTestId('app-shell')).toHaveAttribute('data-entrance', 'cold')
    expect(slot('brand-emblem')?.querySelector('svg')).not.toHaveAttribute('data-emblem-draw')
  })

  it('M-APP-01: a shell that replaces /login plays the hand-off entrance', async () => {
    stubMatchMedia({ width: 1920, reduced: false })
    mount('/dashboard', null)
    const login = await screen.findByTestId('page-login')
    fireEvent.change(within(login).getByLabelText(/username/i), { target: { value: 'budi.santoso' } })
    fireEvent.change(within(login).getByLabelText(/password/i), { target: { value: 'demo-2026' } })
    fireEvent.click(within(login).getByRole('button', { name: /sign in/i }))
    await screen.findByTestId('page-dashboard')
    expect(screen.getByTestId('app-shell')).toHaveAttribute('data-entrance', 'handoff')
  })

  it('M-APP-02: sign out plays the shell exit (inert) before /login opens', async () => {
    stubMatchMedia({ width: 1920, reduced: false })
    const { router, sim } = mount('/devices')
    await screen.findByTestId('page-devices')
    act(() => sim.actions.signOut(SignOutReason.USER))
    const shell = screen.getByTestId('app-shell')
    expect(shell).toHaveAttribute('data-leaving', 'true')
    expect(shell).toHaveAttribute('inert')
    expect(await screen.findByTestId('page-login')).toBeInTheDocument()
    expect(router.state.location.href).toBe('/login')
  })

  it('ExitGuard hides a page that fails while leaving, and passes errors on otherwise', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    function Thrower(): ReactNode {
      throw new Error('no operator')
    }
    class Outer extends Component<{ children: ReactNode }, { failed: boolean }> {
      override state = { failed: false }
      static getDerivedStateFromError() {
        return { failed: true }
      }
      override render() {
        return this.state.failed ? <p data-testid="outer-fallback" /> : this.props.children
      }
    }
    render(
      <Outer>
        <ExitGuard leaving>
          <Thrower />
        </ExitGuard>
      </Outer>,
    )
    expect(screen.queryByTestId('outer-fallback')).toBeNull()
    cleanup()
    render(
      <Outer>
        <ExitGuard leaving={false}>
          <Thrower />
        </ExitGuard>
      </Outer>,
    )
    expect(screen.getByTestId('outer-fallback')).toBeInTheDocument()
    consoleError.mockRestore()
    consoleWarn.mockRestore()
  })

  it('choreography: hand-off holds the first page for the shell, reduced is opacity-only with no delay', () => {
    const full = buildShellChoreography('handoff', buildMotionKit('full', 1))
    expect(full.contentDelayMs).toBe(HANDOFF_CONTENT_MS)
    expect(full.initial).toBe('hidden')
    const reduced = buildShellChoreography('handoff', buildMotionKit('reduced', 1))
    expect(reduced.contentDelayMs).toBe(0)
    expect(reduced.emblemDraw).toBeNull()
    const hidden = reduced.sidebar.hidden as Record<string, unknown>
    expect(Object.keys(hidden)).toEqual(['opacity'])
    const plain = buildShellChoreography('plain', buildMotionKit('full', 1))
    expect(plain.initial).toBe(false)
    // Proof mode (×10) stretches the choreography too.
    const slow = buildShellChoreography('handoff', buildMotionKit('full', 10))
    const slowVisible = slow.topBar.visible as { transition?: { delay?: number } }
    expect(slowVisible.transition?.delay).toBeCloseTo(1.5)
  })
})

describe('shell.css motion literals mirror the motion tokens', () => {
  // Read from disk: Vitest does not process CSS, so a `?raw` import would come back empty. The
  // test runs with the core-web package as its working directory (`npm test -w @dems/core-web`).
  const nodeProcess = (
    globalThis as unknown as {
      process: {
        cwd(): string
        getBuiltinModule(name: 'node:fs'): { readFileSync(path: string, encoding: 'utf8'): string }
      }
    }
  ).process
  const shellCss = nodeProcess
    .getBuiltinModule('node:fs')
    .readFileSync(`${nodeProcess.cwd()}/src/components/shell/shell.css`, 'utf8')
  const cssVar = (name: string) => new RegExp(`${name}:\\s*([^;]+);`).exec(shellCss)?.[1]?.trim()
  const bezier = (points: readonly number[]) => `cubic-bezier(${points.join(', ')})`
  it.each([
    ['--dems-dur-instant', `${tokens.duration.instant}ms`],
    ['--dems-dur-fast', `${tokens.duration.fast}ms`],
    ['--dems-dur-base', `${tokens.duration.base}ms`],
    ['--dems-ease-standard', bezier(tokens.easing.standard)],
    ['--dems-ease-luxe', bezier(tokens.easing.luxe)],
    ['--dems-ease-exit', bezier(tokens.easing.exit)],
    ['--dems-sheen-ms', `${tokens.ambient.sheen}ms`],
    ['--dems-glow-breath-ms', `${tokens.ambient.glowBreath}ms`],
    ['--dems-colon-breath-ms', `${tokens.ambient.colonBreath}ms`],
    ['--dems-topo-drift-ms', `${tokens.ambient.topoDrift}ms`],
  ])('%s = %s', (name, expected) => {
    expect(cssVar(name)).toBe(expected)
  })

  // §9.2 (the CSS side of MS-01 and MS-02): keyframes move transform and opacity only, and no
  // declared transition touches a layout property, an outline or a shadow.
  it('keyframes and CSS transitions stay composite-only (§9.2)', () => {
    const keyframes = shellCss.match(/@keyframes[^{]+\{(?:[^{}]*\{[^{}]*\})*[^{}]*\}/g) ?? []
    expect(keyframes.length).toBeGreaterThanOrEqual(5)
    for (const block of keyframes) {
      const properties = [...block.matchAll(/([a-z-]+)\s*:/g)].map((match) => match[1])
      expect(properties.every((property) => property === 'transform' || property === 'opacity')).toBe(true)
    }
    const layoutOrShadow = /(box-shadow|width|height|outline|top|left|margin|padding)/
    const declared = shellCss.match(/transition(-property)?:[^;]*/g) ?? []
    expect(declared.length).toBeGreaterThan(0)
    expect(declared.filter((declaration) => layoutOrShadow.test(declaration))).toEqual([])
  })
})
