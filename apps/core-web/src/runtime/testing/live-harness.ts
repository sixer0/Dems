/**
 * Test harness of the web console in Live mode (plan row W50). FOR TESTS ONLY: it imports the
 * contract-checked fake transport (`@dems/shared/live/testing`, TS-15) and a test renderer. No
 * production file imports this folder.
 *
 * It gives a test what the app has at run time, with the Core server replaced by a small model:
 *
 * | Part | What it is |
 * |------|------------|
 * | `fake` | The fake transport: a `fetch` and a socket factory that check every request and every answer against the contract, on a manual clock |
 * | `core` | The Core's one session behind the browser's cookie, with the Core's own rules: a sign-in replaces the session, a sign-out ends it and tells its sockets, each answer goes by what the Core holds when the request arrives (brief list rows 26 and 27 of implementation/44_live_source.md §17.4) |
 * | `load()` | ONE page load: the real Live start-up (`startLiveRuntime`) on the fake transport and the fake clock (row 25), awaited until its bootstrap is over. Calling it again is a reload: a new source, the same cookie, the same storage |
 * | `mount(page, path)` | The real router (route tree, guards, providers, the query bridge) around that page's source, with a real query client |
 * | `flush()`, `elapse(ms)` | Let the promise jobs run; move the fake clock in steps, with the promise jobs in between |
 * | `dispose()` | Unmounts, stops every source, puts back the global `fetch` the bed took, and ends with `fake.assertNoViolations()`. The root route does not stop a Live source when it unmounts (the source's life is the page's): a test that builds a source without this harness stops it itself |
 *
 * **The bed owns the global `fetch` for its lifetime** (finding CPW1-3, decision D144). The console's
 * one health reader, `lib/core-endpoint.ts → fetchCoreHealth()`, calls the global `fetch` rather than
 * the typed client, so a Live test that lands on `/login` — a sign-out, a guard redirect — would
 * otherwise issue a REAL request attempt at `http://127.0.0.1:5178/api/v1/health`: noise under P11, a
 * slow failure, and a result that depends on whether another agent's lane happens to be listening.
 * While a bed is alive that call is answered by the bed's own model on the fake transport, like every
 * other request, and `dispose()` puts back whatever `fetch` was there before. A test that wants a
 * particular health answer scripts `fake.answer('getServiceHealth', …)`; one that wants to prove
 * nothing is asked of a server reads `fake.log.requestsOf('getServiceHealth')`.
 *
 * A test file that renders pages sets its page address with the docblock
 * `@vitest-environment-options { "url": "http://127.0.0.1:5178/" }`: `lib/core-endpoint.ts` reads
 * `window.location` in Live mode, and jsdom's default page is under `localhost`.
 */
import { createElement, StrictMode } from 'react'
import { act, cleanup, render } from '@testing-library/react'
import { QueryClient } from '@tanstack/react-query'
import { createMemoryHistory, RouterProvider } from '@tanstack/react-router'
import { CORE_API_EXAMPLES, pickReplicatedState, SYSTEM_COMPONENTS_EXAMPLE, type AuthSessionInfo, type HealthResponse, type ReplicatedState } from '@dems/shared/api'
import {
  createFakeTransport,
  OUTAGE,
  type FakeConnection,
  type FakeReply,
  type FakeTransport,
} from '@dems/shared/live/testing'
import { AUTH_IDLE_TIMEOUT_MS, createIdleState, DEFAULT_SEED, isOwnCaptureCoreState, type SimState } from '@dems/shared/sim'
import { setCoreEndpointMode } from '@/lib/core-endpoint'
import { createAppRouter, type AppRouter } from '@/router'
import type { CoreModeControl } from '../core-mode'
import { createErrorSink, type ErrorSink } from '../error-sink'
import type { ConsoleLocation } from '../live-host'
import { startLiveRuntime, type LiveRuntime, type StartLiveRuntimeOptions } from '../live-start'
import type { OwedSignOutStorageEvent, StorageEventTarget } from '../owed-sign-out-storage'

/** The address of a lane's dev server: where the console is opened in Live mode (WT-2a). */
export const LIVE_TEST_ORIGIN = 'http://127.0.0.1:5178'

export type TestLocation = ConsoleLocation & Pick<Location, 'host'> & { assign(url: string): void; reload(): void; readonly assigned: string[]; readonly reloads: number }

/** A page address with recorded `assign` and `reload` calls (jsdom's own cannot be replaced). */
export function createTestLocation(href: string = `${LIVE_TEST_ORIGIN}/`): TestLocation {
  const url = new URL(href)
  const assigned: string[] = []
  let reloads = 0
  return {
    origin: url.origin,
    protocol: url.protocol,
    host: url.host,
    hostname: url.hostname,
    port: url.port,
    pathname: url.pathname,
    search: url.search,
    hash: url.hash,
    assigned,
    get reloads() {
      return reloads
    },
    assign: (next) => {
      assigned.push(next)
    },
    reload: () => {
      reloads += 1
    },
  }
}

/** An in-memory `Storage`: the origin's `localStorage` or `sessionStorage` of a test. */
export function createMemoryStorage(initial: Readonly<Record<string, string>> = {}): Storage {
  const entries = new Map<string, string>(Object.entries(initial))
  return {
    get length() {
      return entries.size
    },
    clear: () => entries.clear(),
    getItem: (key) => entries.get(key) ?? null,
    key: (index) => Array.from(entries.keys())[index] ?? null,
    removeItem: (key) => {
      entries.delete(key)
    },
    setItem: (key, value) => {
      entries.set(key, String(value))
    },
  }
}

/** A source of `storage` events a test fires by hand (the event another tab's write causes). */
export function createStorageEvents(): StorageEventTarget & { emit(event: OwedSignOutStorageEvent): void; readonly listeners: number } {
  const listeners = new Set<(event: OwedSignOutStorageEvent) => void>()
  return {
    addEventListener: (_type, listener) => {
      listeners.add(listener)
    },
    removeEventListener: (_type, listener) => {
      listeners.delete(listener)
    },
    emit: (event) => {
      for (const listener of Array.from(listeners)) listener(event)
    },
    get listeners() {
      return listeners.size
    },
  }
}

const SESSION_EXAMPLES = CORE_API_EXAMPLES.getAuthSession?.responses[200] as Record<string, { value: AuthSessionInfo }>
/** The contract's own example of a SUPERVISOR on the web console: holds `USER_ADMIN` and `PAIRING_MANAGE`. */
export const SUPERVISOR_SESSION: AuthSessionInfo = SESSION_EXAMPLES.webConsole!.value
/** An INVESTIGATOR on the web console: no administration permission. */
export const INVESTIGATOR_SESSION: AuthSessionInfo = { ...SESSION_EXAMPLES.pairedDevice!.value, deviceId: null }

const MINUTE = 60_000

interface CoreSession {
  operator: AuthSessionInfo['operator']
  permissions: AuthSessionInfo['permissions']
  issuedAt: number
  lastActivityAt: number
  absoluteExpiresAt: number
  open: boolean
}

/** The Core server's side of a test: one session behind the browser's cookie. */
export interface LiveTestCore {
  /** What the cookie names; `null` before the first sign-in. */
  session: CoreSession | null
  /** False: every request is an outage and every upgrade is refused. */
  reachable: boolean
  /** The state every OPERATOR socket gets as its snapshot. */
  served: SimState
  /** Who the next `signIn` request of the page signs in as. Default: the SUPERVISOR. */
  signInAs: Pick<AuthSessionInfo, 'operator' | 'permissions'>
  alive(): boolean
  info(): AuthSessionInfo
  /** A sign-in with this browser: the session behind the cookie is replaced, and the sockets of the earlier one are told (ROTATED). */
  signIn(as?: Pick<AuthSessionInfo, 'operator' | 'permissions'>): void
  /** The Core ends the session and tells its sockets (`session.ended`, then close 4401). */
  end(reason: 'SIGNED_OUT' | 'IDLE_EXPIRED' | 'ABSOLUTE_EXPIRED' | 'USER_DISABLED'): void
  /** A role change of the session's operator: `session.updated` on its sockets. Nobody is signed out. */
  changeRole(role: AuthSessionInfo['operator']['role'], permissions: AuthSessionInfo['permissions']): void
  /** `admin.changed` on every OPERATOR socket. */
  adminChanged(resource: 'USERS' | 'DEVICES' | 'PAIRING_CODE'): void
  /** Every socket is lost and nothing answers. */
  unreachable(): void
  back(): void
}

export interface LivePage {
  readonly runtime: LiveRuntime
  readonly live: LiveRuntime['live']
  /** Every socket this page load opened, in order. */
  readonly sockets: FakeConnection[]
  readonly sink: ErrorSink
}

export interface MountedPage {
  readonly router: AppRouter
  readonly queryClient: QueryClient
  unmount(): void
}

export interface MountOptions {
  /** The router context's `coreMode` (the app passes it; a test that needs no selector leaves it out). */
  readonly coreMode?: CoreModeControl
  /** The router in `StrictMode`, as `main.tsx` renders it. */
  readonly strict?: boolean
  /** The query client of the page. Default: a new one, built as `main.tsx` builds it. */
  readonly queryClient?: QueryClient
}

export interface LiveTestBedOptions {
  /** Who is signed in when the first page loads. Default: nobody. */
  readonly session?: Pick<AuthSessionInfo, 'operator' | 'permissions'> | null
  /** The address of the page. Default `LIVE_TEST_ORIGIN`. */
  readonly href?: string
  /** The origin's `localStorage`. Default: an empty memory storage. `null`: the browser has none. */
  readonly storage?: Storage | null
}

export interface LiveTestBed {
  readonly fake: FakeTransport
  readonly core: LiveTestCore
  readonly location: TestLocation
  /** The origin's `localStorage`: it outlives a reload. */
  readonly storage: Storage | null
  /** `storage` events of the page's window. */
  readonly storageEvents: ReturnType<typeof createStorageEvents>
  /**
   * One page load. A second call is a reload: a new source on the same cookie and the same storage.
   * `onStart` gets the page right after its source was created, before anything arrived: a test
   * subscribes there to see every store update of the start.
   */
  load(options?: Partial<StartLiveRuntimeOptions>, onStart?: (page: LivePage) => void): Promise<LivePage>
  /** The real router around `page`, at `path`. */
  mount(page: LivePage, path: string, options?: MountOptions): Promise<MountedPage>
  /** Lets the promise jobs run, inside `act`. */
  flush(): Promise<void>
  /** Moves the fake clock by `ms` in steps, with the promise jobs in between. */
  elapse(ms: number, step?: number): Promise<void>
  /** Stops the page's source as a closed tab does (the cookie and the storage stay). */
  close(page: LivePage): void
  /** Unmounts, stops every source, and checks that the fake recorded no violation. */
  dispose(): void
}

const wire = (state: SimState): ReplicatedState => pickReplicatedState(JSON.parse(JSON.stringify(state)) as ReplicatedState)

/** What the bed's model Core makes public on `GET /api/v1/health` (CPW1-3). */
const healthAnswer = (now: number): HealthResponse => ({
  status: 'ok',
  service: 'dems-core-server',
  version: '0.2.0',
  apiVersion: 'v1',
  serverTime: new Date(now).toISOString(),
  uptimeMs: 1_000,
  ws: { path: '/ws', heartbeatIntervalMs: 1_000, clients: 1 },
  ready: { database: true, engine: true },
})

/**
 * The beds whose global `fetch` hold has not been released, oldest first: the last one owns the
 * global (CPW1-3). A bed that is disposed while a newer one is alive leaves that newer one in place.
 */
const fetchHolds: Array<{ readonly fakeFetch: typeof globalThis.fetch; readonly previous: typeof globalThis.fetch }> = []

/** Puts `fakeFetch` on the global `fetch` for the lifetime of one bed, and returns its release. */
function holdGlobalFetch(fakeFetch: typeof globalThis.fetch): () => void {
  const previous = globalThis.fetch
  fetchHolds.push({ fakeFetch, previous })
  globalThis.fetch = fakeFetch
  let released = false
  return () => {
    if (released) return
    released = true
    const index = fetchHolds.findIndex((hold) => hold.fakeFetch === fakeFetch)
    if (index >= 0) fetchHolds.splice(index, 1)
    const owner = fetchHolds.at(-1)
    globalThis.fetch = owner ? owner.fakeFetch : previous
  }
}

/** jsdom has no scrolling; the router resets `#main-content` on navigation. */
function installJsdomStubs(): void {
  if (typeof Element !== 'undefined') Element.prototype.scrollTo ??= function scrollTo() {}
  if (typeof window !== 'undefined') window.scrollTo = (() => undefined) as typeof window.scrollTo
}

export function createLiveTestBed(options: LiveTestBedOptions = {}): LiveTestBed {
  installJsdomStubs()
  const fake = createFakeTransport({ epoch: 3, revision: 40 })
  // CPW1-3: the bed answers the global `fetch` too, because the console's health reader uses it.
  const releaseFetch = holdGlobalFetch(fake.fetch as unknown as typeof globalThis.fetch)
  const coreHealth = (): HealthResponse => healthAnswer(fake.clock.now())
  const location = createTestLocation(options.href)
  const storage = options.storage === undefined ? createMemoryStorage() : options.storage
  const storageEvents = createStorageEvents()
  const pages: LivePage[] = []
  const mounted: MountedPage[] = []

  const open = (): FakeConnection[] => fake.connections.filter((connection) => connection.state === 'OPEN')
  const operatorSockets = (): FakeConnection[] => open().filter((connection) => connection.principal === 'OPERATOR')
  const holdsAdmin = (): boolean =>
    core.session !== null && (core.session.permissions.includes('USER_ADMIN') || core.session.permissions.includes('PAIRING_MANAGE'))

  const sessionFor = (as: Pick<AuthSessionInfo, 'operator' | 'permissions'>): CoreSession => {
    const now = fake.clock.now()
    return { operator: as.operator, permissions: as.permissions, issuedAt: now, lastActivityAt: now, absoluteExpiresAt: now + 8 * 60 * MINUTE, open: true }
  }

  const core: LiveTestCore = {
    session: options.session ? sessionFor(options.session) : null,
    reachable: true,
    served: createIdleState({ now: fake.clock.now(), seed: DEFAULT_SEED }),
    signInAs: SUPERVISOR_SESSION,
    alive: () =>
      core.session !== null &&
      core.session.open &&
      fake.clock.now() < core.session.lastActivityAt + AUTH_IDLE_TIMEOUT_MS &&
      fake.clock.now() < core.session.absoluteExpiresAt,
    info: () => {
      if (core.session === null) throw new Error('the Core holds no session')
      return {
        ...SUPERVISOR_SESSION,
        operator: core.session.operator,
        permissions: core.session.permissions,
        issuedAt: core.session.issuedAt,
        lastActivityAt: core.session.lastActivityAt,
        idleExpiresAt: core.session.lastActivityAt + AUTH_IDLE_TIMEOUT_MS,
        absoluteExpiresAt: core.session.absoluteExpiresAt,
        serverTime: fake.clock.now(),
      }
    },
    signIn: (as = SUPERVISOR_SESSION) => {
      if (core.alive()) for (const connection of operatorSockets()) connection.sessionEnded('ROTATED')
      core.session = sessionFor(as)
    },
    end: (reason) => {
      if (core.session !== null) core.session.open = false
      for (const connection of operatorSockets()) connection.sessionEnded(reason)
    },
    changeRole: (role, permissions) => {
      if (core.session === null) throw new Error('the Core holds no session')
      core.session.operator = { ...core.session.operator, role }
      core.session.permissions = permissions
      for (const connection of operatorSockets()) connection.sessionUpdated({ id: core.session.operator.id, role }, permissions)
    },
    adminChanged: (resource) => {
      for (const connection of operatorSockets()) connection.adminChanged(resource)
    },
    unreachable: () => {
      core.reachable = false
      for (const connection of open()) connection.close(1001)
    },
    back: () => {
      core.reachable = true
    },
  }

  // Brief list row 26: one connect script for every socket; it answers by what the Core holds NOW,
  // and it does not act on a socket the client already gave up.
  fake.onConnect((connection) => {
    if (connection.state !== 'CONNECTING') return
    if (!core.reachable) connection.refuse()
    else if (core.alive()) connection.startOperator(wire(core.served), { admin: holdsAdmin() }).beatEvery()
    else connection.startAnonymous().beatEvery()
  })

  const answered = (operationId: string, reply: () => FakeReply): void =>
    fake.answer(operationId, () => (core.reachable ? reply() : OUTAGE))
  answered('getAuthSession', () => (core.alive() ? { status: 200, body: core.info() } : fake.example('getAuthSession', 401)))
  // Brief list row 27: asked after every session end.
  answered('getSignInStatus', () => fake.example('getSignInStatus', 200, 'open'))
  answered('signIn', () => {
    core.signIn(core.signInAs)
    return { status: 200, body: { session: core.info() } }
  })
  answered('signOut', () => {
    if (!core.alive()) return fake.example('signOut', 401, 'notSignedIn')
    core.end('SIGNED_OUT')
    return fake.example('signOut')
  })
  answered('touchSession', () => {
    if (!core.alive() || core.session === null) return fake.example('touchSession', 401, 'notSignedIn')
    core.session.lastActivityAt = fake.clock.now()
    return {
      status: 200,
      body: { idleExpiresAt: core.session.lastActivityAt + AUTH_IDLE_TIMEOUT_MS, absoluteExpiresAt: core.session.absoluteExpiresAt },
    }
  })

  // One list of an administration page, answered by what the Core holds: a page row scripts its own.
  answered('listUsers', () => (core.alive() ? fake.example('listUsers', 200, 'seeded') : fake.example('listUsers', 401, 'notSignedIn')))
  // Plan row W0, decision D172 (finding F77-1): the reads of the other administration pages, in the same
  // form, so a test that opens one of them without scripting it finds what an idle seeded Core holds:
  // the seeded matrix, the registry's one paired tablet, and no active pairing code.
  answered('getRoleMatrix', () => (core.alive() ? fake.example('getRoleMatrix', 200, 'seeded') : fake.example('getRoleMatrix', 401, 'notSignedIn')))
  answered('listPairedDevices', () => (core.alive() ? fake.example('listPairedDevices', 200, 'registry') : fake.example('listPairedDevices', 401, 'notSignedIn')))
  answered('getPairingCodeStatus', () => (core.alive() ? fake.example('getPairingCodeStatus', 200, 'none') : fake.example('getPairingCodeStatus', 401, 'notSignedIn')))
  // Task 3 M4 (blueprint row 67; WB-11): the two reads of the capture device selector, which Devices
  // & Inputs asks for on mount. Answered by what the model Core holds (`core.served`, the same slices
  // its snapshot carries), so a test that opens the page without scripting them finds the seeded
  // selector; a page row that needs another answer scripts its own.
  answered('getCaptureConfig', () =>
    core.alive() ? { status: 200, body: JSON.parse(JSON.stringify(core.served.captureConfig)) } : fake.example('getCaptureConfig', 401),
  )
  answered('getCaptureDevices', () =>
    core.alive() ? { status: 200, body: JSON.parse(JSON.stringify(core.served.captureDevices)) } : fake.example('getCaptureDevices', 401),
  )
  // Task 3 R-9 (blueprint row 137; ux §8c.1 "Read on entry"): Devices & Inputs reads the caller's own
  // camera search once on mount, for a session that holds CAPTURE_CONFIG (operation 94; it never
  // probes). An idle Core holds none: `search: null`. A page row that needs a search scripts its own.
  answered('getCaptureDiscovery', () =>
    core.alive() ? { status: 200, body: { search: null, candidates: [], truncated: false } } : fake.example('getCaptureDiscovery', 401),
  )
  // Task 3 M5 (blueprint row 72; WB-10): the Session Monitor asks for the audio-source intervals of
  // the open session on mount (operation 82). Answered by what the model Core holds: the one interval
  // the run opened, for the input its session names as active; a page row that needs a switch in the
  // list scripts its own. `seq` counts from 1 (the contract's rule since pass D6 item 9).
  answered('listAudioSourceIntervals', () => {
    if (!core.alive()) return fake.example('listAudioSourceIntervals', 401)
    const session = core.served.session
    if (session === null || session.startedAt === null) return { status: 200, body: { items: [], nextCursor: null } }
    const inputId = session.audioSource?.activeInputId ?? core.served.audio.activeInputId
    return {
      status: 200,
      body: {
        items: [{ sessionId: session.id, seq: 1, inputId, role: 'PRIMARY', fromMs: 0, toMs: null, fromAt: session.startedAt, toAt: null, switchedBy: null, reason: 'START' }],
        nextCursor: null,
      },
    }
  })
  // Fix wave J round three (JW-26): a console on a Core in its own capture reads operation 64 for the
  // versions of the Core's components. Answered by what the model Core holds: its five slices and the
  // contract's `components` - with the capture worker only when the served state is a Core in its own
  // capture (a SIMULATED Core starts none). A page row that needs another answer scripts its own.
  answered('getSystemStatus', () => {
    if (!core.alive()) return fake.example('getSystemStatus', 401)
    const { captureWorker, ...simulated } = SYSTEM_COMPONENTS_EXAMPLE
    const served = JSON.parse(JSON.stringify(core.served)) as SimState
    return {
      status: 200,
      body: {
        device: served.device,
        services: served.services,
        update: served.update,
        diagnostics: served.diagnostics,
        settings: served.settings,
        components: isOwnCaptureCoreState(core.served) ? { ...simulated, captureWorker } : simulated,
      },
    }
  })
  // Fix wave J round three (contract J2-S 4): the Sessions page asks operation 38 why a seal was given
  // up when its list holds a session in quarantine. Answered by what the model Core holds: its history
  // in one page (an entry carries `unsealableCause` only when the served entry does).
  answered('listSessionHistory', () =>
    core.alive() ? { status: 200, body: { items: JSON.parse(JSON.stringify(core.served.sessionHistory)), nextCursor: null } } : fake.example('listSessionHistory', 401),
  )
  // CPW1-3: the console's health reader uses the global `fetch`, not the typed client. Answered here,
  // by what the model Core holds, so no Live test can reach a real port through it — including a test
  // that lands on `/login`, whose device strip asks for health on the page's own origin. A page row
  // that needs another answer scripts `fake.answer('getServiceHealth', …)` of its own.
  answered('getServiceHealth', () => ({ status: 200, body: coreHealth() }))

  const flush = async (): Promise<void> => {
    await act(async () => {
      for (let turn = 0; turn < 40; turn += 1) await Promise.resolve()
    })
  }

  return {
    fake,
    core,
    location,
    storage,
    storageEvents,
    async load(start = {}, onStart) {
      const sockets: FakeConnection[] = []
      const sink = createErrorSink({ dev: false })
      const runtime = startLiveRuntime({
        location,
        storage,
        sink,
        storageEvents,
        fetch: fake.fetch,
        socketFactory: (url, headers) => {
          const before = fake.connections.length
          const socket = fake.socketFactory(url, headers)
          sockets.push(...fake.connections.slice(before))
          return socket
        },
        // Brief list row 25: a real local clock beside the fake's time would expire the session early.
        now: fake.clock.now,
        timers: fake.clock.timers,
        random: () => 0,
        ...start,
      })
      const page: LivePage = { runtime, live: runtime.live, sockets, sink }
      pages.push(page)
      onStart?.(page)
      await runtime.live.ready
      await flush()
      return page
    },
    async mount(page, path, mount = {}) {
      // The page's own query client, built as `main.tsx` builds it: the router factory sets the Core defaults.
      const queryClient = mount.queryClient ?? new QueryClient()
      const router = createAppRouter(
        {
          sim: page.runtime.sim,
          queryClient,
          ...(mount.coreMode === undefined ? {} : { coreMode: mount.coreMode }),
        },
        { history: createMemoryHistory({ initialEntries: [path] }) },
      )
      // Plain `createElement`: this file exports helpers, not components.
      const app = createElement(RouterProvider, { router })
      const view = render(mount.strict ? createElement(StrictMode, null, app) : app)
      const entry: MountedPage = { router, queryClient, unmount: () => view.unmount() }
      mounted.push(entry)
      // The guards have run and the matched route is loaded; a page's own chunk may still be on its way
      // (a test waits for the page with `findByTestId`).
      await act(async () => {
        await router.load()
      })
      await flush()
      return entry
    },
    flush,
    async elapse(ms, step = 250) {
      for (let elapsed = 0; elapsed < ms; elapsed += step) {
        await act(async () => {
          fake.clock.advance(Math.min(step, ms - elapsed))
        })
        await flush()
      }
    },
    close(page) {
      page.runtime.stop()
    },
    dispose() {
      cleanup()
      for (const page of pages) page.runtime.stop()
      setCoreEndpointMode('SIMULATED')
      releaseFetch()
      fake.assertNoViolations()
    },
  }
}
