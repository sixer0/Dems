/**
 * @vitest-environment jsdom
 * @vitest-environment-options { "url": "http://127.0.0.1:5178/" }
 */
// Plan row W50: the Live start-up of the web console and the root route in Live mode (backend task
// 04_client_integration_spec §5.1, §5.2, §5.4; CL-2, CL-7, CL-8; MD-5; brief list rows 1, 3, 4 of
// implementation/44_live_source.md §17.4). The page of this file is `http://127.0.0.1:5178/`: the
// address the console is opened at in Live mode (WT-2a).
//
// | Criterion | Where it is proven here |
// |-----------|-------------------------|
// | AC-C-18 one socket per client in Live mode (the root's part; the API Reference page is W84's) | "one socket" |
// | AC-C-21 a stored LIVE builds the Live source; `dems.sim.v1` and `dems.auth` are byte-equal after a Live session | "the simulator's stored state" |
// | AC-C-25 no silent fallback: unreachable at start, the Login page with the offline Alert; no simulator, an empty replica | "unreachable at start" |
// | AC-C-37 every request goes to the page's own origin | "the start-up sequence" |
// | AC-C-40 a reload while signed in returns to the same route without credentials; after the Core ended the session it lands on /login | "a reload" |
// | AC-C-41 a Live route test: an anonymous visit goes to /login with `redirect` | "the guards" |
// | AC-C-46 the socket after a sign-in and after a sign-out is a new connection; the one after a sign-out gets no state message | "a new socket" |
// | AC-C-106 (through the root) the bridge is mounted by the root route | "the root route mounts the bridge" |
// | Rule 2 of the row: in Simulated mode nothing of the Live layer starts | "Simulated mode is untouched" |
// | The StrictMode decision: the provider does not start or stop the Live source | "StrictMode" |
import { StrictMode } from 'react'
import { act, cleanup, configure, render, screen, waitFor } from '@testing-library/react'
import { QueryClient } from '@tanstack/react-query'
import { createMemoryHistory, RouterProvider } from '@tanstack/react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { HealthResponse } from '@dems/shared/api'
import { coreModeOf, liveOf } from '@dems/shared/live'
import type { SocketLike } from '@dems/shared/realtime'
import {
  ALWAYS_VISIBLE,
  AuthStatus,
  createMemoryAuthStorage,
  createSim,
  OPERATOR_IDS,
  selectAuth,
  selectIsSignedIn,
  SimProvider,
  type Sim,
} from '@dems/shared/sim'
import { coreHttpOrigin, coreWsUrl, isLiveCore } from '@/lib/core-endpoint'
import { createAppRouter } from '@/router'
import { bootCoreRuntime } from '@/runtime/boot'
import { CORE_MODE_STORAGE_KEY } from '@/runtime/core-mode'
import { createErrorSink } from '@/runtime/error-sink'
import { OWED_SIGN_OUT_STORAGE_KEY } from '@/runtime/owed-sign-out-storage'
import { CORE_QUERY_KEY, CORE_QUERY_KEYS } from '@/runtime/query-bridge'
import {
  createLiveTestBed,
  createMemoryStorage,
  LIVE_TEST_ORIGIN,
  SUPERVISOR_SESSION,
  type LiveTestBed,
} from '@/runtime/testing/live-harness'

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

// A page's chunk is loaded by a dynamic import: under load (other suites, a lane) that can take
// longer than the library's default second. The waits below end as soon as their condition holds.
configure({ asyncUtilTimeout: 6_000 })
vi.setConfig({ testTimeout: 20_000 })

let bed: LiveTestBed | undefined
const sims: Sim[] = []
/** Every URL the page fetched with the global `fetch` (the health query of the Stack Check page). */
let fetched: string[] = []
/** Every socket the page opened with the global `WebSocket` constructor. */
let globalSockets: string[] = []

class CountingSocket {
  readyState = 0
  onopen: unknown = null
  onmessage: unknown = null
  onclose: unknown = null
  onerror: unknown = null
  constructor(url: string) {
    globalSockets.push(url)
  }
  close() {
    this.readyState = 3
  }
}

beforeEach(() => {
  fetched = []
  globalSockets = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: unknown) => {
      fetched.push(String(input))
      return new Response(JSON.stringify(coreHealth), { status: 200 })
    }),
  )
  vi.stubGlobal('WebSocket', CountingSocket)
  window.sessionStorage.clear()
  window.localStorage.clear()
})

afterEach(() => {
  cleanup()
  for (const sim of sims.splice(0)) sim.stop()
  bed?.dispose()
  bed = undefined
  vi.unstubAllGlobals()
})

/** The message types the Core's end of a socket sent, in order. */
const typesOf = (sent: readonly unknown[]): string[] => sent.map((message) => String((message as { type?: unknown }).type))

describe('the page of this file', () => {
  it('is opened at the address Live mode needs', () => {
    expect(window.location.origin).toBe(LIVE_TEST_ORIGIN)
  })
})

describe('the start-up sequence (§5.1 steps 2 to 5)', () => {
  it('signed out: the session probe is refused, ONE anonymous socket opens, the lockout view is asked; everything goes to the page\'s own origin, with the cookie and no bearer value', async () => {
    bed = createLiveTestBed()
    const page = await bed.load()
    expect(page.live.isReady()).toBe(true)
    expect(page.live.isRunning()).toBe(true)
    expect(selectAuth(page.live.store.getState()).status).toBe(AuthStatus.SIGNED_OUT)
    expect(page.live.session).toBeNull()
    expect(page.live.link).toBe('ONLINE')
    // Both questions of a signed-out start, once each: who the cookie names, and the lockout view.
    expect(bed.fake.calls.map((call) => call.operationId).sort()).toEqual(['getAuthSession', 'getSignInStatus'])

    // AC-C-37: every request goes to the page's own origin. CL-2: the browser's cookie, never a bearer value.
    for (const call of bed.fake.calls) {
      expect(call.url.startsWith(`${LIVE_TEST_ORIGIN}/api/v1/`), call.url).toBe(true)
      expect(call.credentials).toBe('same-origin')
      expect(call.headers.authorization).toBeUndefined()
    }
    // CL-7, CL-8: one socket, at the page's own host, with no header of the page's making and no subprotocol.
    expect(page.sockets).toHaveLength(1)
    expect(bed.fake.connections).toHaveLength(1)
    expect(page.sockets[0]?.url).toBe('ws://127.0.0.1:5178/ws')
    expect(page.sockets[0]?.headers).toEqual({})
    expect(page.sockets[0]?.protocols).toEqual([])
    expect(page.sockets[0]?.principal).toBe('ANONYMOUS')
    expect(page.sink.records()).toEqual([])
  })

  it('signed in: the session is known, the snapshot is applied, and `ready` resolves only then', async () => {
    bed = createLiveTestBed({ session: SUPERVISOR_SESSION })
    const page = await bed.load()
    const state = page.live.store.getState()
    expect(selectIsSignedIn(state)).toBe(true)
    expect(state.auth.operatorId).toBe(SUPERVISOR_SESSION.operator.id)
    expect(state.operators).toHaveLength(3)
    expect(state.device.id).not.toBe('')
    expect(page.live.session?.permissions).toContain('USER_ADMIN')
    expect(page.sockets.map((socket) => socket.principal)).toEqual(['OPERATOR'])
    // No credential was typed: the cookie signed the page in.
    expect(bed.fake.log.requestsOf('signIn')).toEqual([])
  })

  it('brief list row 1: the pages get the observed view of the typed client, never the client itself', async () => {
    bed = createLiveTestBed({ session: SUPERVISOR_SESSION })
    const page = await bed.load()
    expect(Object.keys(page.live.client)).toEqual(['call'])
    const answer = await page.live.client.call('listUsers')
    expect(answer.ok).toBe(true)
    expect(bed.fake.log.requestsOf('listUsers')[0]?.url).toBe(`${LIVE_TEST_ORIGIN}/api/v1/admin/users`)
  })

  it('the entry builds it through the real module: a stored LIVE at 127.0.0.1 gives a started Live source and no simulator', async () => {
    bed = createLiveTestBed({ session: SUPERVISOR_SESSION, storage: createMemoryStorage({ [CORE_MODE_STORAGE_KEY]: 'LIVE' }) })
    const loadSimulator = vi.fn()
    const sink = createErrorSink({ dev: false })
    const runtime = await bootCoreRuntime({
      onSimError: vi.fn(),
      dev: true,
      packaged: false,
      env: undefined,
      storage: bed.storage,
      location: bed.location,
      storageEvents: bed.storageEvents,
      sink,
      loadSimulator,
      live: { fetch: bed.fake.fetch, socketFactory: bed.fake.socketFactory, now: bed.fake.clock.now, timers: bed.fake.clock.timers, random: () => 0 },
    })
    try {
      expect(runtime.kind).toBe('LIVE')
      expect(loadSimulator).not.toHaveBeenCalled()
      if (runtime.kind !== 'LIVE') throw new Error('unreachable')
      expect(coreModeOf(runtime.sim)).toBe('LIVE')
      expect(liveOf(runtime.sim)).toBe(runtime.live)
      // §5.1 step 5: the entry awaited the bootstrap.
      expect(runtime.live.isReady()).toBe(true)
      expect(selectIsSignedIn(runtime.sim.store.getState())).toBe(true)
      expect(runtime.owedSignOutPersisted).toBe(true)
      expect(runtime.coreMode).toMatchObject({ mode: 'LIVE', selectable: true })
    } finally {
      if (runtime.kind === 'LIVE') runtime.stop()
    }
    if (runtime.kind === 'LIVE') expect(runtime.live.isRunning()).toBe(false)
    expect(bed.storageEvents.listeners).toBe(0)
  })
})

describe('unreachable at start (AC-C-25, ADQ-7): no silent fallback', () => {
  it('the bootstrap ends with the link down, the replica holds no Core data, and no simulator is built', async () => {
    bed = createLiveTestBed({ session: SUPERVISOR_SESSION, storage: createMemoryStorage({ [CORE_MODE_STORAGE_KEY]: 'LIVE' }) })
    bed.core.unreachable()
    const loadSimulator = vi.fn()
    const booting = bootCoreRuntime({
      onSimError: vi.fn(),
      dev: true,
      packaged: false,
      env: undefined,
      storage: bed.storage,
      location: bed.location,
      storageEvents: null,
      sink: createErrorSink({ dev: false }),
      loadSimulator,
      live: { fetch: bed.fake.fetch, socketFactory: bed.fake.socketFactory, now: bed.fake.clock.now, timers: bed.fake.clock.timers, random: () => 0 },
    })
    // `ready` never rejects; at the latest the boot time-out (4,000 ms) ends the wait.
    await bed.elapse(4_000)
    const runtime = await booting
    try {
      expect(runtime.kind).toBe('LIVE')
      expect(loadSimulator).not.toHaveBeenCalled()
      if (runtime.kind !== 'LIVE') throw new Error('unreachable')
      const state = runtime.sim.store.getState()
      expect(selectIsSignedIn(state)).toBe(false)
      expect(state.evidence).toEqual([])
      expect(state.session).toBeNull()
      expect(state.operators).toEqual([])
      expect(runtime.live.session).toBeNull()
      expect(runtime.live.link).not.toBe('ONLINE')
    } finally {
      if (runtime.kind === 'LIVE') runtime.stop()
    }
  })

  it('the Login page is shown with its offline Alert and Retry; the heartbeat it reads is the Live socket\'s', async () => {
    bed = createLiveTestBed()
    bed.core.unreachable()
    const page = await bed.load()
    await bed.mount(page, '/login')
    expect(await screen.findByTestId('page-login')).toBeInTheDocument()
    await bed.elapse(2_000)
    await waitFor(() => expect(screen.getByTestId('login-core-retry')).toBeInTheDocument())
    expect(page.live.heartbeat.getSnapshot().state).not.toBe('LIVE')
    expect(selectIsSignedIn(page.live.store.getState())).toBe(false)
    // Nothing but the Live source's own socket: no second client was built for the heartbeat.
    expect(globalSockets).toEqual([])
  })
})

describe('one socket per client in Live mode (AC-C-18; CL-7)', () => {
  it('the root route builds no heartbeat client: the heartbeat of the page is a view of the Live source\'s one socket', async () => {
    bed = createLiveTestBed({ session: SUPERVISOR_SESSION })
    const page = await bed.load()
    await bed.mount(page, '/stack-check')
    expect(await screen.findByTestId('page-stack-check')).toBeInTheDocument()
    await bed.elapse(3_000)
    // The heartbeat card reads `useHeartbeat()`: it follows the beats of the Live socket.
    const seq = page.live.heartbeat.getSnapshot().seq ?? 0
    expect(seq).toBeGreaterThan(0)
    expect(screen.getByTestId('heartbeat-seq')).toHaveAttribute('aria-label', `Heartbeat sequence ${seq}`)
    expect(page.live.heartbeat.getSnapshot().state).toBe('LIVE')
    // ONE socket, the Live source's; the global constructor was never used.
    expect(bed.fake.connections).toHaveLength(1)
    expect(page.sockets).toHaveLength(1)
    expect(globalSockets).toEqual([])
  })

  it('AC-C-37: the health query of the page goes to the page\'s own origin, and the resolvers answer with the Live row', async () => {
    bed = createLiveTestBed({ session: SUPERVISOR_SESSION })
    const page = await bed.load()
    await bed.mount(page, '/stack-check')
    await waitFor(() => expect(screen.getByTestId('health-version')).toBeInTheDocument())
    expect(isLiveCore()).toBe(true)
    expect(coreHttpOrigin()).toBe(LIVE_TEST_ORIGIN)
    expect(coreWsUrl()).toBe('ws://127.0.0.1:5178/ws')
    // CPW1-3: while a bed lives it answers the global `fetch` the health reader uses, so this call is
    // on the fake transport: the page's own origin, and no real port anywhere.
    const healthCalls = bed.fake.log.requestsOf('getServiceHealth')
    expect(healthCalls.length).toBeGreaterThan(0)
    for (const call of healthCalls) expect(call.url).toBe(`${LIVE_TEST_ORIGIN}/api/v1/health`)
    for (const url of bed.fake.log.urls()) expect(url.startsWith(`${LIVE_TEST_ORIGIN}/`) || url.startsWith('ws://127.0.0.1:5178/')).toBe(true)
  })
})

describe('the guards are unchanged and read the Live source (§5.4; AC-C-41)', () => {
  it('an anonymous visit to a page of the shell goes to /login with `redirect`', async () => {
    bed = createLiveTestBed()
    const page = await bed.load()
    const { router } = await bed.mount(page, '/evidence')
    await waitFor(() => expect(router.state.location.pathname).toBe('/login'))
    expect(router.state.location.search).toMatchObject({ redirect: '/evidence' })
    expect(await screen.findByTestId('page-login')).toBeInTheDocument()
  })

  it('a signed-in visit to /login goes to the dashboard', async () => {
    bed = createLiveTestBed({ session: SUPERVISOR_SESSION })
    const page = await bed.load()
    const { router } = await bed.mount(page, '/login')
    await waitFor(() => expect(router.state.location.pathname).toBe('/dashboard'))
  })
})

describe('a reload (AC-C-40)', () => {
  it('while signed in: the same route again, without credentials', async () => {
    bed = createLiveTestBed({ session: SUPERVISOR_SESSION })
    const first = await bed.load()
    const mounted = await bed.mount(first, '/stack-check')
    expect(mounted.router.state.location.pathname).toBe('/stack-check')
    mounted.unmount()
    bed.close(first)

    const reloaded = await bed.load()
    const again = await bed.mount(reloaded, '/stack-check')
    expect(again.router.state.location.pathname).toBe('/stack-check')
    expect(await screen.findByTestId('page-stack-check')).toBeInTheDocument()
    expect(selectIsSignedIn(reloaded.live.store.getState())).toBe(true)
    expect(bed.fake.log.requestsOf('signIn')).toEqual([])
    // One probe per page load.
    expect(bed.fake.log.requestsOf('getAuthSession')).toHaveLength(2)
  })

  it('after the Core ended the session: the login screen, with the page as `redirect`', async () => {
    bed = createLiveTestBed({ session: SUPERVISOR_SESSION })
    const first = await bed.load()
    bed.close(first)
    // The Core ends the session while no page is open (a sign-out elsewhere, an expiry).
    if (bed.core.session === null) throw new Error('the Core holds a session')
    bed.core.session.open = false

    const reloaded = await bed.load()
    const { router } = await bed.mount(reloaded, '/stack-check')
    await waitFor(() => expect(router.state.location.pathname).toBe('/login'))
    expect(router.state.location.search).toMatchObject({ redirect: '/stack-check' })
    expect(selectIsSignedIn(reloaded.live.store.getState())).toBe(false)
  })
})

describe('a new socket after a sign-in and after a sign-out (AC-C-46; CL-11a)', () => {
  it('each is a new connection; the socket after a sign-out is anonymous and receives no state message', async () => {
    bed = createLiveTestBed()
    const page = await bed.load()
    expect(page.sockets.map((socket) => socket.principal)).toEqual(['ANONYMOUS'])

    const result = await page.live.actions.signIn(SUPERVISOR_SESSION.operator.username, 'not-a-real-password')
    await bed.flush()
    expect(result).toMatchObject({ ok: true })
    expect(page.sockets.map((socket) => socket.principal)).toEqual(['ANONYMOUS', 'OPERATOR'])
    expect(page.sockets[0]?.state).toBe('CLOSED')
    expect(page.sockets[0]?.closed).toMatchObject({ by: 'client' })
    expect(page.sockets[1]?.id).not.toBe(page.sockets[0]?.id)
    expect(typesOf(page.sockets[1]?.sent ?? [])).toContain('snapshot')

    await page.live.actions.signOut('USER')
    await bed.elapse(2_000)
    expect(page.sockets.map((socket) => socket.principal)).toEqual(['ANONYMOUS', 'OPERATOR', 'ANONYMOUS'])
    expect(page.sockets[2]?.id).not.toBe(page.sockets[1]?.id)
    expect(page.sockets[2]?.state).toBe('OPEN')
    // Only `hello` and beats: an anonymous client receives no Core state (01_specs §9.2).
    const afterSignOut = typesOf(page.sockets[2]?.sent ?? [])
    expect(afterSignOut[0]).toBe('hello')
    expect(afterSignOut.filter((type) => type !== 'hello' && type !== 'heartbeat')).toEqual([])
    // One socket at a time: every earlier one is closed.
    expect(bed.fake.connections.filter((connection) => connection.state === 'OPEN')).toHaveLength(1)
    // The replica is empty again.
    expect(page.live.store.getState().operators).toEqual([])
  })
})

describe('the simulator\'s stored state is not touched in Live mode (MD-5; AC-C-21)', () => {
  it('`dems.sim.v1` and `dems.auth` are byte-equal after a Live session with the shell mounted, and nothing about the session is stored', async () => {
    const SNAPSHOT = '{"state":{"marker":"a snapshot the simulator wrote earlier"},"version":1}'
    const AUTH = '{"operatorId":"OPR-001","issuedAt":1790823000000}'
    window.sessionStorage.setItem('dems.sim.v1', SNAPSHOT)
    window.sessionStorage.setItem('dems.auth', AUTH)
    const before = { session: { ...window.sessionStorage }, local: { ...window.localStorage } }

    bed = createLiveTestBed({ storage: window.localStorage })
    const page = await bed.load()
    await bed.mount(page, '/login')
    await page.live.actions.signIn(SUPERVISOR_SESSION.operator.username, 'not-a-real-password')
    await bed.flush()
    expect(selectIsSignedIn(page.live.store.getState())).toBe(true)
    await bed.elapse(2_000)
    await page.live.actions.signOut('USER')
    await bed.elapse(2_000)

    expect(window.sessionStorage.getItem('dems.sim.v1')).toBe(SNAPSHOT)
    expect(window.sessionStorage.getItem('dems.auth')).toBe(AUTH)
    // The Login page hands off a session it did not submit (§5.4, W55), so the shell is really mounted here and writes its own intro marker: nothing about the session.
    expect({ ...window.sessionStorage }).toEqual({ ...before.session, 'dems.shell.intro': '1' })
    // The Live session left nothing in `localStorage` either: the debt key exists only while a sign-out is owed.
    expect(window.localStorage.getItem(OWED_SIGN_OUT_STORAGE_KEY)).toBeNull()
    for (const storage of [window.sessionStorage, window.localStorage]) {
      for (const value of Object.values({ ...storage })) expect(String(value)).not.toMatch(/\b(ses|dvc|bio)_/)
    }
  })
})

describe('the root route mounts the bridge (AC-C-106 through the app\'s own tree)', () => {
  it('a session end while the shell is on screen: the shell leaves for /login, and the page\'s query cache holds no core entry', async () => {
    bed = createLiveTestBed({ session: SUPERVISOR_SESSION })
    const page = await bed.load()
    const { router, queryClient } = await bed.mount(page, '/stack-check')
    queryClient.setQueryData(CORE_QUERY_KEYS.users, [{ id: 'OPR-001' }])
    queryClient.setQueryData(CORE_QUERY_KEYS.pairedDevices, [{ id: 'DEV-0001' }])
    expect(queryClient.getQueryCache().findAll({ queryKey: CORE_QUERY_KEY })).toHaveLength(2)

    await act(async () => {
      bed?.core.end('USER_DISABLED')
    })
    await bed.flush()
    expect(queryClient.getQueryCache().findAll({ queryKey: CORE_QUERY_KEY })).toEqual([])
    await waitFor(() => expect(router.state.location.pathname).toBe('/login'))
  })

  it('the sign-out of the user menu\'s own action empties it too', async () => {
    bed = createLiveTestBed({ session: SUPERVISOR_SESSION })
    const page = await bed.load()
    const mounted = await bed.mount(page, '/stack-check')
    mounted.queryClient.setQueryData(CORE_QUERY_KEYS.users, [{ id: 'OPR-001' }])
    await act(async () => {
      await page.live.actions.signOut('USER')
    })
    await bed.flush()
    expect(mounted.queryClient.getQueryCache().findAll({ queryKey: CORE_QUERY_KEY })).toEqual([])
  })

  it('the bridge lives with the root: after the unmount it no longer listens, and the Live source runs on (its life is the page\'s)', async () => {
    bed = createLiveTestBed({ session: SUPERVISOR_SESSION })
    const page = await bed.load()
    const mounted = await bed.mount(page, '/stack-check')
    await screen.findByTestId('page-stack-check')
    mounted.unmount()
    await bed.flush()
    expect(page.live.isRunning()).toBe(true)
    expect(page.sockets).toHaveLength(1)
    expect(page.sockets[0]?.state).toBe('OPEN')

    mounted.queryClient.setQueryData(CORE_QUERY_KEYS.users, [{ id: 'OPR-001' }])
    bed.core.end('SIGNED_OUT')
    await bed.flush()
    expect(selectIsSignedIn(page.live.store.getState())).toBe(false)
    expect(mounted.queryClient.getQueryCache().findAll({ queryKey: CORE_QUERY_KEY })).toHaveLength(1)

    // What ends the source: the page's own stop (the mode switch calls it before the reload).
    bed.close(page)
    expect(page.live.isRunning()).toBe(false)
    expect(bed.fake.connections.filter((connection) => connection.state === 'OPEN')).toEqual([])
  })
})

describe('StrictMode: the provider does not own the life of the Live source', () => {
  it('as `main.tsx` renders it (the router in StrictMode): ONE socket and ONE session probe per page load, and the bridge works', async () => {
    bed = createLiveTestBed({ session: SUPERVISOR_SESSION })
    const page = await bed.load()
    const probesBefore = bed.fake.log.requestsOf('getAuthSession').length
    const { queryClient } = await bed.mount(page, '/stack-check', { strict: true })
    await screen.findByTestId('page-stack-check')
    await bed.elapse(1_000)
    // The source was started once, by its creation: nothing was closed and nothing was asked again.
    expect(page.sockets).toHaveLength(1)
    expect(page.sockets[0]?.state).toBe('OPEN')
    expect(bed.fake.log.requestsOf('getAuthSession').length).toBe(probesBefore)
    expect(page.live.isRunning()).toBe(true)
    expect(page.live.link).toBe('ONLINE')
    // The root's effect ran twice (attach, detach, attach); one bridge is left, and it works.
    queryClient.setQueryData(CORE_QUERY_KEYS.users, [{ id: 'OPR-001' }])
    await act(async () => {
      bed?.core.end('SIGNED_OUT')
    })
    await bed.flush()
    expect(queryClient.getQueryCache().findAll({ queryKey: CORE_QUERY_KEY })).toEqual([])
  })

  it('the reason, measured: a provider that starts and stops the source closes and reopens the socket once under StrictMode, and asks for the session again', async () => {
    bed = createLiveTestBed({ session: SUPERVISOR_SESSION })
    const page = await bed.load()
    const probesBefore = bed.fake.log.requestsOf('getAuthSession').length
    // The simulator's own provider with `autoStart`, as the root route uses it for a simulator.
    render(
      <StrictMode>
        <SimProvider sim={page.runtime.sim} autoStart>
          <span data-testid="strict-child" />
        </SimProvider>
      </StrictMode>,
    )
    await bed.elapse(1_000)
    expect(page.sockets).toHaveLength(2)
    expect(page.sockets[0]?.closed).toMatchObject({ by: 'client' })
    expect(bed.fake.log.requestsOf('getAuthSession').length).toBe(probesBefore + 1)
    // The Live source is built for it (it is signed in again); the console does not do it at every page load.
    expect(selectIsSignedIn(page.live.store.getState())).toBe(true)
  })
})

describe('Simulated mode is untouched: nothing of the Live layer starts (rule 2 of the row; MD-5)', () => {
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

  it('the entry in Simulated mode: no request, no socket, and not one timer beyond the simulator\'s own', async () => {
    const authStorage = createMemoryAuthStorage()
    const build = () => {
      const sim = createSim({ storage: null, authStorage, visibility: ALWAYS_VISIBLE, scheduler: () => () => undefined })
      sims.push(sim)
      return sim
    }
    const timeouts = vi.spyOn(globalThis, 'setTimeout')
    const intervals = vi.spyOn(globalThis, 'setInterval')
    // What the simulator alone sets up when it is built.
    build()
    const alone = { timeouts: timeouts.mock.calls.length, intervals: intervals.mock.calls.length }
    timeouts.mockClear()
    intervals.mockClear()

    const loadLive = vi.fn()
    const runtime = await bootCoreRuntime({
      onSimError: vi.fn(),
      dev: true,
      packaged: false,
      env: undefined,
      storage: createMemoryStorage(),
      location: { ...window.location, assign: vi.fn(), reload: vi.fn() } as never,
      storageEvents: null,
      sink: createErrorSink({ dev: false }),
      loadSimulator: async () => ({ createSim: build }),
      loadLive,
    })
    expect(runtime.kind).toBe('SIMULATED')
    expect(loadLive).not.toHaveBeenCalled()
    expect({ timeouts: timeouts.mock.calls.length, intervals: intervals.mock.calls.length }).toEqual(alone)
    expect(fetched).toEqual([])
    expect(globalSockets).toEqual([])
    timeouts.mockRestore()
    intervals.mockRestore()
  })

  it('a console built around a simulator talks to mock-core as before: the resolvers, the heartbeat socket and the health query', async () => {
    const authStorage = createMemoryAuthStorage()
    authStorage.save({ operatorId: OPERATOR_IDS.BUDI, issuedAt: Date.now() })
    const sim = createSim({ storage: null, authStorage, visibility: ALWAYS_VISIBLE, scheduler: () => () => undefined })
    sims.push(sim)
    const opened: string[] = []
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const router = createAppRouter(
      {
        sim,
        queryClient,
        socketFactory: (url) => {
          opened.push(url)
          return new SilentSocket()
        },
      },
      { history: createMemoryHistory({ initialEntries: ['/stack-check'] }) },
    )
    render(<RouterProvider router={router} />)
    await waitFor(() => expect(screen.getByTestId('page-stack-check')).toBeInTheDocument())
    await waitFor(() => expect(fetched.length).toBeGreaterThan(0))
    expect(coreModeOf(sim)).toBe('SIMULATED')
    expect(isLiveCore()).toBe(false)
    expect(coreHttpOrigin()).toBe('http://127.0.0.1:4400')
    // The one heartbeat client of the root, to mock-core; nothing goes to the page's own origin.
    expect(opened).toEqual(['ws://127.0.0.1:4400/ws'])
    for (const url of fetched) expect(url).toBe('http://127.0.0.1:4400/api/v1/health')
    expect(queryClient.getQueryDefaults(CORE_QUERY_KEYS.users).retry).toBeUndefined()
    // The simulator is started by its provider at mount and stopped at unmount, as before.
    expect(sim.isRunning()).toBe(true)
    cleanup()
    expect(sim.isRunning()).toBe(false)
  })
})
