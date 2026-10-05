/**
 * @vitest-environment jsdom
 * @vitest-environment-options { "url": "http://127.0.0.1:5178/" }
 */
// Plan row W55, follow-up (decision D128; finding F77-3): the presentation follow-up of WS-10 is
// installed in ONE place, the root route, so it holds on every route (backend task
// 04_client_integration_spec §5.5 WS-10; AC-C-47). Since decision D144(4) (finding CPW1-4) the
// function itself lives in `runtime/presentation-follow.ts`, which is what the mock below wraps.
// The real router, the real Live source, the contract-checked fake transport. The page of this
// file is `http://127.0.0.1:5178/`.
//
// | What | Where it is proven here |
// |------|-------------------------|
// | A page loaded directly inside the shell, without passing the Login page, follows the server's presentation mode: at the load, and on every change | "a page load that starts inside the shell" |
// | After that page's sign-out the Login page follows the server's last value | "a page load that starts inside the shell" |
// | It is installed once: under `StrictMode` (mount, clean-up, mount) exactly one subscription is left, and the root's unmount ends it | "installed once" |
// | The Login page installs nothing of its own | "installed once" |
// | Nothing is installed on the simulator | "the simulator" |
import { cleanup, configure, render, screen, waitFor } from '@testing-library/react'
import { toast } from '@heroui/react'
import { QueryClient } from '@tanstack/react-query'
import { createMemoryHistory, RouterProvider } from '@tanstack/react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { HealthResponse } from '@dems/shared/api'
import { ALWAYS_VISIBLE, createMemoryAuthStorage, createSim, selectIsSignedIn, type Sim } from '@dems/shared/sim'
import { resetCoreErrorPresenter } from '@/lib/core-errors'
import { getPresentationMode, PRESENTATION_MODE_STORAGE_KEY, resetPresentationModeForTests } from '@/lib/presentation-mode'
import { createAppRouter } from '@/router'
import { createLiveTestBed, SUPERVISOR_SESSION, type LivePage, type LiveTestBed } from '@/runtime/testing/live-harness'

/**
 * How often the follow-up was installed and ended. The real function runs: this wrapper only
 * counts the calls of the one export and of the clean-up each call returns.
 */
const follow = vi.hoisted(() => ({ installed: 0, ended: 0 }))
vi.mock('@/runtime/presentation-follow', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/runtime/presentation-follow')>()
  return {
    ...actual,
    followServerPresentationMode: (live: Parameters<typeof actual.followServerPresentationMode>[0]) => {
      follow.installed += 1
      const end = actual.followServerPresentationMode(live)
      return () => {
        follow.ended += 1
        end()
      }
    },
  }
})
const active = () => follow.installed - follow.ended

configure({ asyncUtilTimeout: 6_000 })
vi.setConfig({ testTimeout: 20_000 })

const coreHealth: HealthResponse = {
  status: 'ok',
  service: 'dems-core-server',
  version: '0.2.0',
  apiVersion: 'v1',
  serverTime: '2026-10-04T03:00:00.000Z',
  uptimeMs: 1000,
  ws: { path: '/ws', heartbeatIntervalMs: 1000, clients: 1 },
  ready: { database: true, engine: true },
}

const originalMatchMedia = window.matchMedia
/** Empties the kit's toast queue: it is one per page and outlives a test. */
async function clearToasts() {
  window.matchMedia = (() => ({ matches: true })) as unknown as typeof window.matchMedia
  toast.clear()
  window.matchMedia = originalMatchMedia
  const queue = toast.getQueue() as { getExitingKeys?: () => ReadonlySet<string> }
  if ((queue.getExitingKeys?.().size ?? 0) > 0) await new Promise((resolve) => setTimeout(resolve, 350))
}

let bed: LiveTestBed | undefined
const sims: Sim[] = []
const flag = () => window.sessionStorage.getItem(PRESENTATION_MODE_STORAGE_KEY)

/** A signed-in console whose Core serves `presentationMode`, loaded DIRECTLY at a page of the shell. */
async function insideTheShell(presentationMode: boolean, strict = false): Promise<{ bed: LiveTestBed; live: LivePage; mounted: Awaited<ReturnType<LiveTestBed['mount']>> }> {
  const created = createLiveTestBed({ session: SUPERVISOR_SESSION })
  bed = created
  created.core.served = { ...created.core.served, settings: { ...created.core.served.settings, presentationMode } }
  const live = await created.load()
  const mounted = await created.mount(live, '/stack-check', strict ? { strict: true } : {})
  await screen.findByTestId('page-stack-check')
  return { bed: created, live, mounted }
}

/** The server changes its setting: one delta of the `settings` slice on the session's socket. */
async function serverSets(created: LiveTestBed, live: LivePage, presentationMode: boolean) {
  const settings = live.live.store.getState().settings
  live.sockets.at(-1)?.delta([{ op: 'replace', slice: 'settings', value: { ...settings, presentationMode } }])
  await created.flush()
}

beforeEach(() => {
  follow.installed = 0
  follow.ended = 0
  resetCoreErrorPresenter()
  window.localStorage.clear()
  window.sessionStorage.clear()
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(JSON.stringify(coreHealth), { status: 200 })),
  )
})

afterEach(async () => {
  cleanup()
  await clearToasts()
  for (const sim of sims.splice(0)) sim.stop()
  bed?.dispose()
  bed = undefined
  resetPresentationModeForTests()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('a page load that starts inside the shell (F77-3)', () => {
  it('follows the server\'s presentation mode without the Login page ever being shown: at the load, on every change, and the Login page then follows the last value', async () => {
    const { bed, live } = await insideTheShell(true)
    // The Login page was never on screen in this page load.
    expect(screen.queryByTestId('page-login')).not.toBeInTheDocument()
    expect(selectIsSignedIn(live.live.store.getState())).toBe(true)
    // At the load: the setting of the snapshot is copied at once.
    expect(flag()).toBe('1')
    expect(getPresentationMode()).toBe(true)

    await serverSets(bed, live, false)
    expect(flag()).toBe('0')
    await serverSets(bed, live, true)
    expect(flag()).toBe('1')

    // The sign-out empties the replica; the flag keeps the server's last value, and the Login page reads it.
    await live.live.actions.signOut('USER')
    await bed.elapse(2_000, 500)
    await screen.findByTestId('page-login')
    expect(selectIsSignedIn(live.live.store.getState())).toBe(false)
    expect(flag()).toBe('1')
    expect(screen.getByTestId('page-login')).toHaveAttribute('data-presentation', 'true')
    expect(screen.queryByTestId('login-demo-operators')).not.toBeInTheDocument()
    // The Login page installed nothing of its own: still the root's one.
    expect(follow.installed).toBe(1)
    expect(active()).toBe(1)
  })

  it('a setting that is off, with no flag in the tab, writes nothing at the load', async () => {
    await insideTheShell(false)
    expect(flag()).toBeNull()
    expect(active()).toBe(1)
  })
})

describe('installed once (no double subscription)', () => {
  it('under StrictMode the root installs, cleans up and installs again: ONE subscription is left, and one change is one write', async () => {
    const { bed, live, mounted } = await insideTheShell(false, true)
    // React's strict effects: mount, clean-up, mount.
    expect(follow.installed).toBe(2)
    expect(follow.ended).toBe(1)
    expect(active()).toBe(1)

    const writes = vi.spyOn(Storage.prototype, 'setItem')
    const flagWrites = () => writes.mock.calls.filter(([key]) => key === PRESENTATION_MODE_STORAGE_KEY).length
    await serverSets(bed, live, true)
    expect(flag()).toBe('1')
    expect(flagWrites()).toBe(1)
    await serverSets(bed, live, false)
    expect(flag()).toBe('0')
    expect(flagWrites()).toBe(2)

    // The root's unmount ends it; the Live source runs on (its life is the page's), and a later change is not copied.
    mounted.unmount()
    expect(active()).toBe(0)
    await serverSets(bed, live, true)
    expect(live.live.store.getState().settings.presentationMode).toBe(true)
    expect(flag()).toBe('0')
    expect(flagWrites()).toBe(2)
  })

  it('without StrictMode: one installation for the lifetime of the root, whatever is navigated to', async () => {
    const { bed, live, mounted } = await insideTheShell(false)
    expect(follow.installed).toBe(1)
    await mounted.router.navigate({ to: '/dashboard' })
    await bed.flush()
    await screen.findByTestId('page-dashboard')
    await serverSets(bed, live, true)
    expect(flag()).toBe('1')
    expect(follow.installed).toBe(1)
    expect(active()).toBe(1)
  })
})

describe('the simulator', () => {
  it('nothing is installed: the simulator\'s own setting and the flag are read as before', async () => {
    const sim = createSim({ storage: null, authStorage: createMemoryAuthStorage(), visibility: ALWAYS_VISIBLE, scheduler: () => () => undefined })
    sims.push(sim)
    const router = createAppRouter(
      {
        sim,
        queryClient: new QueryClient({ defaultOptions: { queries: { retry: false } } }),
        socketFactory: () => ({ readyState: 0, onopen: null, onmessage: null, onclose: null, onerror: null, close() {} }),
      },
      { history: createMemoryHistory({ initialEntries: ['/login'] }) },
    )
    render(<RouterProvider router={router} />)
    await screen.findByTestId('page-login')
    await waitFor(() => expect(screen.getByTestId('login-demo-operators')).toBeInTheDocument())
    expect(follow.installed).toBe(0)
    expect(flag()).toBeNull()
  })
})
