/**
 * @vitest-environment jsdom
 * @vitest-environment-options { "url": "http://127.0.0.1:5178/" }
 */
// Plan row W55: what the Login page shows in Live mode, beside what it shows on the simulator
// (backend task 04_client_integration_spec §3.2, §3.3, §3.5, §5.5 WS-5 to WS-10, §5.6 WS-14, §6.4,
// §6.5). The real router, the real Live source, the contract-checked fake transport. The page of
// this file is `http://127.0.0.1:5178/`.
//
// | Criterion | Where it is proven here |
// |-----------|-------------------------|
// | AC-C-23 switching the mode shows the confirmation, signs out, writes the key and reloads to `/login` (the Login page's selector) | "the mode selector" |
// | AC-C-25 unreachable at start: the offline Alert, Retry and "Use Simulated mode"; nothing simulated is shown | "the Core server cannot be reached" |
// | AC-C-42 the trust line: the Simulated strings on the simulator, the Live string on the Live source, with neither "simulated" nor "paired" | "the trust line" |
// | AC-C-43 `login-security-key` is in the DOM in Simulated mode and absent in Live mode | "the security key" |
// | AC-C-45 `IDLE_EXPIRED` leads to `/login?redirect=<href>` with the expired notice; `ABSOLUTE_EXPIRED` shows the 8-hour sentence; `USER_DISABLED` shows the disabled Alert | "why the operator is on the page" |
// | AC-C-47 the disclosure is hidden while `dems.presentation.v1` is on; no role chip in Live mode; the server's setting is copied into the flag while signed in | "the demo operators", "presentation mode" |
// | AC-C-104 the plain sentence (C1), three usernames, no role chip, no other server data; as before on the simulator | "the demo operators" |
// | WS-5 the device strip shows what the Core server makes public | "the device strip" |
import { act, cleanup, configure, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { toast } from '@heroui/react'
import { QueryClient } from '@tanstack/react-query'
import { createMemoryHistory, RouterProvider } from '@tanstack/react-router'
import { MotionGlobalConfig } from 'motion/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { pickReplicatedState, type HealthResponse, type ReplicatedState } from '@dems/shared/api'
import { CoreMode, LiveLinkState } from '@dems/shared/live'
import { OUTAGE } from '@dems/shared/live/testing'
import type { SocketLike } from '@dems/shared/realtime'
import {
  ALWAYS_VISIBLE,
  AuthStatus,
  createMemoryAuthStorage,
  createSim,
  DEMO_OPERATOR_PASSWORD,
  OPERATORS,
  selectAuth,
  selectIsSignedIn,
  SOFTWARE_VERSION,
  type Sim,
  type SimState,
} from '@dems/shared/sim'
import { en } from '@dems/shared/i18n'
import { getMissingI18nKeys, resetMissingI18nKeys } from '@/i18n'
import { resetCoreErrorPresenter } from '@/lib/core-errors'
import { WEB_CONSOLE_VERSION } from '@/lib/product-versions'
import { getPresentationMode, PRESENTATION_MODE_STORAGE_KEY, resetPresentationModeForTests, setPresentationMode } from '@/lib/presentation-mode'
import { REDUCED_MOTION_MEDIA_QUERY } from '@/motion'
import { createAppRouter } from '@/router'
import { webErrorSink, type CoreModeControl } from '@/runtime'
import { createCoreModeControl } from '@/runtime/boot'
import { CORE_MODE_STORAGE_KEY, CoreModeSource } from '@/runtime/core-mode'
import { createErrorSink } from '@/runtime/error-sink'
import {
  createLiveTestBed,
  createMemoryStorage,
  createTestLocation,
  INVESTIGATOR_SESSION,
  SUPERVISOR_SESSION,
  type LivePage,
  type LiveTestBed,
  type LiveTestBedOptions,
} from '@/runtime/testing/live-harness'

configure({ asyncUtilTimeout: 6_000 })
vi.setConfig({ testTimeout: 20_000 })

const healthOf = (ready: HealthResponse['ready']): HealthResponse => ({
  status: 'ok',
  service: 'dems-core-server',
  version: '0.2.0',
  apiVersion: 'v1',
  serverTime: '2026-10-04T03:00:00.000Z',
  uptimeMs: 1000,
  ws: { path: '/ws', heartbeatIntervalMs: 1000, clients: 1 },
  ...(ready === undefined ? {} : { ready }),
})

/** No credential: a text typed into the password field of a test. */
const TYPED = ['not', 'a', 'real', 'password'].join('-')
const USERNAME = SUPERVISOR_SESSION.operator.username
const LIVE_TRUST_LINE = 'Core server on this computer • web console, no pairing required'
const DEMO_NOTICE = 'Published demo credentials for synthetic accounts on this local demo. They are not a secret.'

const originalMatchMedia = window.matchMedia
function stubMatchMedia(width = 1920) {
  window.matchMedia = ((query: string) => {
    const min = /min-width:\s*(\d+)px/.exec(query)
    const minHeight = /min-height:\s*(\d+)px/.exec(query)
    const matches = query === REDUCED_MOTION_MEDIA_QUERY ? false : min ? width >= Number(min[1]) : minHeight ? 1080 >= Number(minHeight[1]) : false
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

/** Empties the kit's toast queue: it is one per page and outlives a test. */
async function clearToasts() {
  window.matchMedia = (() => ({ matches: true })) as unknown as typeof window.matchMedia
  toast.clear()
  window.matchMedia = originalMatchMedia
  const queue = toast.getQueue() as { getExitingKeys?: () => ReadonlySet<string> }
  if ((queue.getExitingKeys?.().size ?? 0) > 0) await new Promise((resolve) => setTimeout(resolve, 350))
}

const wire = (state: SimState): ReplicatedState => pickReplicatedState(JSON.parse(JSON.stringify(state)) as ReplicatedState)

let bed: LiveTestBed | undefined
const bedOrThrow = (): LiveTestBed => {
  if (bed === undefined) throw new Error('no Live test bed')
  return bed
}
const sims: Sim[] = []
/** The heartbeat sockets a simulated page opened (mock-core's, driven by the test). */
let simSockets: SocketLike[] = []
/** What the health reader of the page is answered with; a test changes it. */
let health: () => Response = () => new Response(JSON.stringify(healthOf({ database: true, engine: true })), { status: 200 })
let fetched: string[] = []

interface LiveMount {
  bed: LiveTestBed
  live: LivePage
  router: Awaited<ReturnType<LiveTestBed['mount']>>['router']
}

/** A page in Live mode at `path`. Default: the Login page, nobody signed in. */
async function livePage(path = '/login', options: LiveTestBedOptions & { coreMode?: (created: LiveTestBed, live: LivePage) => CoreModeControl; before?: (created: LiveTestBed) => void } = {}): Promise<LiveMount> {
  stubMatchMedia()
  const { coreMode, before, ...bedOptions } = options
  const created = createLiveTestBed(bedOptions)
  bed = created
  before?.(created)
  const live = await created.load()
  const { router } = await created.mount(live, path, coreMode ? { coreMode: coreMode(created, live) } : {})
  return { bed: created, live, router }
}

/** The Login page on the simulator, as the tests of the feature folder mount it. */
async function simulatedPage(coreMode?: (sim: Sim) => CoreModeControl): Promise<{ sim: Sim }> {
  stubMatchMedia()
  const sim = createSim({ storage: null, authStorage: createMemoryAuthStorage(), visibility: ALWAYS_VISIBLE, scheduler: () => () => undefined })
  sims.push(sim)
  const router = createAppRouter(
    {
      sim,
      queryClient: new QueryClient({ defaultOptions: { queries: { retry: false } } }),
      socketFactory: () => {
        const socket: SocketLike = { readyState: 0, onopen: null, onmessage: null, onclose: null, onerror: null, close() {} }
        simSockets.push(socket)
        return socket
      },
      ...(coreMode ? { coreMode: coreMode(sim) } : {}),
    },
    { history: createMemoryHistory({ initialEntries: ['/login'] }) },
  )
  render(<RouterProvider router={router} />)
  await screen.findByTestId('page-login')
  return { sim }
}

const page = () => screen.getByTestId('page-login')
const usernameInput = () => within(page()).getByLabelText(/username/i) as HTMLInputElement
const passwordInput = () => within(page()).getByLabelText(/password/i) as HTMLInputElement
const signInButton = () => within(page()).getByRole('button', { name: /sign in/i })
const alertKind = () => screen.queryByTestId('login-alert')?.getAttribute('data-kind') ?? null
const openDisclosure = () => fireEvent.click(within(page()).getByRole('button', { name: /demo operators/i }))

async function signInThroughTheForm(created: LiveTestBed) {
  fireEvent.change(usernameInput(), { target: { value: USERNAME } })
  fireEvent.change(passwordInput(), { target: { value: TYPED } })
  fireEvent.click(signInButton())
  await created.flush()
}

beforeEach(() => {
  resetMissingI18nKeys()
  resetCoreErrorPresenter()
  webErrorSink.clear()
  window.localStorage.clear()
  window.sessionStorage.clear()
  fetched = []
  simSockets = []
  health = () => new Response(JSON.stringify(healthOf({ database: true, engine: true })), { status: 200 })
  // CPW1-3: a page in Live mode gets its health answer from the bed's fake transport, not from here
  // (the bed owns the global `fetch` while it lives). This stub is what a SIMULATED page would call,
  // and what proves that the Login page asks nothing of a server in Simulated mode.
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: unknown) => {
      fetched.push(String(input))
      return health()
    }),
  )
})

afterEach(async () => {
  cleanup()
  await clearToasts()
  for (const sim of sims.splice(0)) sim.stop()
  bed?.dispose()
  bed = undefined
  window.matchMedia = originalMatchMedia
  resetPresentationModeForTests()
  MotionGlobalConfig.skipAnimations = true
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('the trust line (WS-7; Q13; AC-C-42)', () => {
  it('Live: it says what is true of the web console, with neither "simulated" nor "paired"; the pairing slice is not read', async () => {
    const { live } = await livePage()
    await screen.findByTestId('page-login')
    const line = screen.getByTestId('login-trust-line')
    expect(line).toHaveTextContent(LIVE_TRUST_LINE)
    expect(line.textContent).not.toMatch(/simulated/i)
    expect(line.textContent).not.toMatch(/paired/i)
    expect(line).toHaveAttribute('data-reachable', 'true')
    // The line is the same whatever the replica's pairing slice holds: the web console does not pair.
    expect(live.live.store.getState().pairing.state).not.toBe('PAIRED')
    expect(getMissingI18nKeys()).toEqual([])
  })

  it('Live, the Core server unreachable: "Core server unreachable", beside the offline Alert', async () => {
    const { bed } = await livePage()
    await screen.findByTestId('page-login')
    bed.core.unreachable()
    await bed.elapse(4_000, 500)
    await waitFor(() => expect(screen.getByTestId('login-trust-line')).toHaveAttribute('data-reachable', 'false'))
    expect(screen.getByTestId('login-trust-line')).toHaveTextContent('Core server unreachable')
    expect(screen.getByTestId('login-trust-line').textContent).not.toMatch(/simulated|paired/i)
    expect(alertKind()).toBe('core-offline')
  })

  it('Simulated: the two strings of the simulator, as before', async () => {
    const { sim } = await simulatedPage()
    const { device, pairing } = sim.store.getState()
    expect(page()).toHaveAttribute('data-core-mode', 'SIMULATED')
    // The line follows the simulator's pairing slice, and both of its strings end "(simulated)".
    expect(screen.getByTestId('login-trust-line')).toHaveTextContent(
      pairing.state === 'PAIRED' ? `Console: ${device.id} • paired (simulated)` : `Console: ${device.id} • not paired (simulated)`,
    )
    expect(screen.getByTestId('login-trust-line')).not.toHaveAttribute('data-reachable')
    // Nothing was asked of a server by the page's own health reader: Simulated mode starts nothing of the Live layer.
    expect(fetched).toEqual([])
  })
})

describe('the security key (WS-8; Q11; AC-C-43)', () => {
  it('Live: no `login-security-key` and no "or" divider; Sign In is the only way in', async () => {
    await livePage()
    await screen.findByTestId('page-login')
    expect(screen.queryByTestId('login-security-key')).not.toBeInTheDocument()
    expect(page().querySelector('.dems-login-divider')).toBeNull()
    expect(within(page()).queryByText(/security key/i)).not.toBeInTheDocument()
    expect(screen.getByTestId('login-submit')).toBeInTheDocument()
  })

  it('Simulated: the button and its divider are in the DOM', async () => {
    await simulatedPage()
    expect(screen.getByTestId('login-security-key')).toHaveTextContent('Use security key (simulated)')
    expect(page().querySelector('.dems-login-divider')).not.toBeNull()
  })
})

describe('the demo operators (WS-9; conditions C1 to C3 of SR-63; AC-C-47, AC-C-104)', () => {
  it('Live: the plain sentence above the list, the three seeded usernames, no role chip and no other server data; a row fills the form', async () => {
    const { live } = await livePage()
    await screen.findByTestId('page-login')
    // C2: before sign-in the replica holds no operator; the rows come from the shared constant.
    expect(live.live.store.getState().operators).toEqual([])
    openDisclosure()

    const notice = await screen.findByTestId('login-demo-notice')
    expect(notice).toHaveTextContent(DEMO_NOTICE)
    const disclosure = screen.getByTestId('login-demo-operators')
    const rows = within(disclosure).getAllByTestId(/^login-operator-/)
    expect(rows.map((row) => row.getAttribute('data-testid'))).toEqual(OPERATORS.map((operator) => `login-operator-${operator.username}`))
    for (const operator of OPERATORS) expect(disclosure).toHaveTextContent(operator.username)
    // C1 comes first: the sentence precedes the hint, the password line and the list.
    expect(notice.compareDocumentPosition(rows[0] as HTMLElement) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    // No role chip, no role word: a role is server data and may have changed.
    expect(disclosure.textContent).not.toMatch(/Investigator|Supervisor|Technician/)
    expect(disclosure.querySelector('.chip, [data-slot="chip"]')).toBeNull()
    expect(disclosure.textContent).not.toMatch(/simulated/i)

    fireEvent.click(screen.getByTestId('login-operator-rina.wijaya'))
    expect(usernameInput().value).toBe('rina.wijaya')
    expect(passwordInput().value).toBe(DEMO_OPERATOR_PASSWORD)
    expect(getMissingI18nKeys()).toEqual([])
  })

  it('Simulated: as before, role chips and no added sentence', async () => {
    await simulatedPage()
    openDisclosure()
    const disclosure = await screen.findByTestId('login-demo-operators')
    await within(disclosure).findByTestId('login-operator-rina.wijaya')
    expect(disclosure).toHaveTextContent('Technician')
    expect(disclosure).toHaveTextContent('Supervisor')
    expect(disclosure).toHaveTextContent('Investigator')
    expect(screen.queryByTestId('login-demo-notice')).not.toBeInTheDocument()
  })
})

describe('presentation mode before sign-in (WS-10; C3; AC-C-47)', () => {
  it('Live: the disclosure is hidden while the tab-local flag `dems.presentation.v1` is on, live', async () => {
    await livePage()
    await screen.findByTestId('page-login')
    expect(screen.getByTestId('login-demo-operators')).toBeInTheDocument()
    expect(page()).toHaveAttribute('data-presentation', 'false')

    setPresentationMode(true)
    await waitFor(() => expect(screen.queryByTestId('login-demo-operators')).not.toBeInTheDocument())
    expect(page()).toHaveAttribute('data-presentation', 'true')
    setPresentationMode(false)
    await waitFor(() => expect(screen.getByTestId('login-demo-operators')).toBeInTheDocument())
  })

  it('the server\'s setting is copied into the flag while an operator is signed in, at the sign-in and on every change; after the sign-out the page follows it', async () => {
    const { bed, live } = await livePage('/login', {
      before: (created) => {
        created.core.served = { ...created.core.served, settings: { ...created.core.served.settings, presentationMode: true } }
      },
    })
    await screen.findByTestId('page-login')
    // A fresh tab knows nothing of the server's setting before sign-in (gap GC-07): the disclosure is shown.
    expect(window.sessionStorage.getItem(PRESENTATION_MODE_STORAGE_KEY)).toBeNull()
    expect(screen.getByTestId('login-demo-operators')).toBeInTheDocument()

    await signInThroughTheForm(bed)
    expect(await screen.findByTestId('page-dashboard')).toBeInTheDocument()
    expect(window.sessionStorage.getItem(PRESENTATION_MODE_STORAGE_KEY)).toBe('1')
    expect(getPresentationMode()).toBe(true)

    // A change while signed in (the System page of this or of another console): the flag follows.
    const settings = live.live.store.getState().settings
    live.sockets.at(-1)?.delta([{ op: 'replace', slice: 'settings', value: { ...settings, presentationMode: false } }])
    await bed.flush()
    expect(window.sessionStorage.getItem(PRESENTATION_MODE_STORAGE_KEY)).toBe('0')
    live.sockets.at(-1)?.delta([{ op: 'replace', slice: 'settings', value: { ...settings, presentationMode: true } }])
    await bed.flush()
    expect(window.sessionStorage.getItem(PRESENTATION_MODE_STORAGE_KEY)).toBe('1')

    // After the sign-out the replica is empty again, and the Login page follows the server's last value.
    await live.live.actions.signOut('USER')
    await bed.elapse(2_000, 500)
    await screen.findByTestId('page-login')
    expect(selectIsSignedIn(live.live.store.getState())).toBe(false)
    expect(window.sessionStorage.getItem(PRESENTATION_MODE_STORAGE_KEY)).toBe('1')
    expect(page()).toHaveAttribute('data-presentation', 'true')
    expect(screen.queryByTestId('login-demo-operators')).not.toBeInTheDocument()
  })

  it('Simulated: the simulator\'s own setting hides the disclosure as before, without the flag', async () => {
    const { sim } = await simulatedPage()
    expect(screen.getByTestId('login-demo-operators')).toBeInTheDocument()
    act(() => sim.actions.setPresentationMode(true))
    await waitFor(() => expect(screen.queryByTestId('login-demo-operators')).not.toBeInTheDocument())
    expect(page()).toHaveAttribute('data-presentation', 'true')
    expect(window.sessionStorage.getItem(PRESENTATION_MODE_STORAGE_KEY)).toBeNull()
    act(() => sim.actions.setPresentationMode(false))
    await waitFor(() => expect(screen.getByTestId('login-demo-operators')).toBeInTheDocument())
  })

  it('a setting that equals the flag writes nothing: a Live session leaves the tab\'s storage as it was', async () => {
    const { bed } = await livePage()
    await screen.findByTestId('page-login')
    await signInThroughTheForm(bed)
    expect(await screen.findByTestId('page-dashboard')).toBeInTheDocument()
    expect(window.sessionStorage.getItem(PRESENTATION_MODE_STORAGE_KEY)).toBeNull()
  })
})

describe('the device strip (WS-5): what the Core server makes public', () => {
  it('shows the service and its version, its time, the readiness of the database and of the engine, the link and the mode; nothing of a simulator', async () => {
    await livePage()
    await screen.findByTestId('page-login')
    // One heartbeat of the Live socket: the link cell follows it.
    await bedOrThrow().elapse(1_500, 500)
    const strip = screen.getByTestId('login-device-strip')
    expect(within(strip).getByRole('group', { name: 'Core server status' })).toBeInTheDocument()
    await waitFor(() => expect(screen.getByTestId('login-core-service')).toHaveTextContent('dems-core-server 0.2.0'))
    expect(screen.getByTestId('login-core-database')).toHaveAttribute('data-state', 'ready')
    expect(screen.getByTestId('login-core-database')).toHaveTextContent('Ready')
    expect(screen.getByTestId('login-core-engine')).toHaveAttribute('data-state', 'ready')
    expect(screen.getByTestId('login-core-link')).toHaveAttribute('data-state', 'online')
    expect(screen.getByTestId('login-core-mode')).toHaveTextContent('Live')
    expect(within(strip).getByTestId('login-clock')).toBeInTheDocument()
    // Six cells, as on the simulator.
    expect(strip.querySelectorAll('.dems-login-strip-cell')).toHaveLength(6)
    expect(strip.textContent).not.toMatch(/DEMS-IR|Interview Room|GNSS|RTC|simulat/i)
    // The health answer came from the page's own origin (AC-C-37), and from nowhere else. Since
    // CPW1-3 it arrives on the bed's fake transport: the reader's global `fetch` reaches no real port.
    const asked = bedOrThrow().fake.log.requestsOf('getServiceHealth')
    expect(asked.length).toBeGreaterThan(0)
    for (const call of asked) expect(call.url).toBe('http://127.0.0.1:5178/api/v1/health')
    // §3.2: a screen that shows server data says nothing about a simulation.
    expect(page().textContent).not.toMatch(/simulat/i)
    expect(getMissingI18nKeys()).toEqual([])
  })

  // Fix wave J round three (JW-26; contract J2-S 2, client rule 5): before a sign-in a Live console
  // states its OWN version by name; the Core states its own in the strip. The model's "v2.4.1" is the
  // in-app simulator's (pinned by `features/login/__tests__/login-page.test.tsx`).
  it('JW-26: the footer names the web console and its own version; the Core\'s version is the strip\'s; no model version', async () => {
    await livePage()
    await screen.findByTestId('page-login')
    expect(screen.getByTestId('login-footer-version')).toHaveTextContent(`Web console ${WEB_CONSOLE_VERSION}`)
    await waitFor(() => expect(screen.getByTestId('login-core-service')).toHaveTextContent('dems-core-server 0.2.0'))
    expect(page().textContent).not.toContain(SOFTWARE_VERSION)
    expect(page().textContent).not.toMatch(/v\d+\.\d+\.\d+/)
    expect(getMissingI18nKeys()).toEqual([])
  })

  it('a health answer that failed says nothing: the cells read "Unknown", and sign-in is not blocked by it', async () => {
    // CPW1-3: an unreachable Core is the fake's OUTAGE, scripted before the page mounts, because the
    // bed answers the health reader while it lives.
    await livePage('/login', { before: (created) => created.fake.answer('getServiceHealth', OUTAGE) })
    await screen.findByTestId('page-login')
    await waitFor(() => expect(bedOrThrow().fake.log.requestsOf('getServiceHealth').length).toBeGreaterThan(0))
    expect(screen.getByTestId('login-core-service')).toHaveTextContent('Unknown')
    expect(screen.getByTestId('login-core-database')).toHaveAttribute('data-state', 'unknown')
    expect(screen.getByTestId('login-core-engine')).toHaveAttribute('data-state', 'unknown')
    expect(signInButton()).toBeEnabled()
    expect(alertKind()).toBeNull()
  })

  it('§3.5: a Core server that answers but is not ready blocks sign-in with the "starting" wording; Retry asks again', async () => {
    // CPW1-3: the answer is scripted on the bed, and one flag moves it from "starting" to "ready".
    let engineReady = false
    const { live } = await livePage('/login', {
      before: (created) => created.fake.answer('getServiceHealth', () => ({ status: 200, body: healthOf({ database: true, engine: engineReady }) })),
    })
    await screen.findByTestId('page-login')
    await waitFor(() => expect(alertKind()).toBe('core-starting'))
    expect(page()).toHaveAttribute('data-state', 'offline')
    expect(screen.getByTestId('login-alert')).toHaveTextContent('The Core server is starting')
    expect(screen.getByTestId('login-core-engine')).toHaveAttribute('data-state', 'not-ready')
    expect(screen.getByTestId('login-core-database')).toHaveAttribute('data-state', 'ready')
    expect(signInButton()).toBeDisabled()
    expect(screen.getByTestId('glow-ring')).toHaveAttribute('data-state', 'CRITICAL')
    // The link itself is up: this is not the "unreachable" state.
    expect(live.live.link).toBe(LiveLinkState.ONLINE)
    expect(screen.getByTestId('login-trust-line')).toHaveAttribute('data-reachable', 'true')

    engineReady = true
    fireEvent.click(screen.getByTestId('login-core-retry'))
    await waitFor(() => expect(alertKind()).toBeNull())
    expect(signInButton()).toBeEnabled()
    expect(screen.getByTestId('glow-ring')).toHaveAttribute('data-state', 'READY')
  })
})

describe('the Core server cannot be reached (WS-4; §3.5; AC-C-25)', () => {
  const control = (switchTo: CoreModeControl['switchTo']) => (): CoreModeControl => ({ mode: CoreMode.LIVE, selectable: true, switchTo })

  it('at the start: the offline Alert with Retry and "Use Simulated mode"; Sign In disabled; no simulator, nothing simulated on screen', async () => {
    const switchTo = vi.fn(async () => true)
    const { bed, live } = await livePage('/login', { before: (created) => created.core.unreachable(), coreMode: control(switchTo) })
    await screen.findByTestId('page-login')
    await bed.elapse(2_000, 500)
    await waitFor(() => expect(alertKind()).toBe('core-offline'))
    expect(page()).toHaveAttribute('data-state', 'offline')
    expect(signInButton()).toBeDisabled()
    expect(screen.getByTestId('glow-ring')).toHaveAttribute('data-state', 'CRITICAL')
    expect(screen.getByTestId('login-core-retry')).toBeInTheDocument()
    expect(screen.getByTestId('login-use-simulated')).toHaveTextContent('Use Simulated mode')
    // No silent fallback: the replica holds no operator, and the Alert names the page's own address,
    // never mock-core's (the one word "Simulated" in it is the action that leaves Live mode).
    expect(live.live.store.getState().operators).toEqual([])
    expect(screen.getByTestId('login-alert')).toHaveTextContent('Core service unreachable at 127.0.0.1:5178.')
    expect(screen.getByTestId('login-alert').textContent).not.toMatch(/4400|mock/i)
    expect(screen.getByTestId('login-device-strip').textContent).not.toMatch(/simulat|DEMS-IR/i)
    expect(switchTo).not.toHaveBeenCalled()

    // "Use Simulated mode" is a mode change: it asks first (§3.3 step 1).
    fireEvent.click(screen.getByTestId('login-use-simulated'))
    const dialog = await screen.findByTestId('mode-switch-dialog')
    expect(dialog).toHaveTextContent('Switch to Simulated mode?')
    expect(dialog).toHaveTextContent('You will be signed out and the console reloads. Simulated data and Live data are separate.')
    expect(switchTo).not.toHaveBeenCalled()
    fireEvent.click(within(dialog).getByTestId('mode-switch-confirm'))
    await waitFor(() => expect(switchTo).toHaveBeenCalledWith(CoreMode.SIMULATED))
  })

  it('Retry asks the Live source for a new socket now, on the cooldown; when the Core server is back the page is ready again', async () => {
    const { bed, live } = await livePage('/login', { before: (created) => created.core.unreachable() })
    await screen.findByTestId('page-login')
    await bed.elapse(2_000, 500)
    await waitFor(() => expect(alertKind()).toBe('core-offline'))
    // In a build that offers no choice (no `coreMode` in the router) the Alert has its one action.
    expect(screen.queryByTestId('login-use-simulated')).not.toBeInTheDocument()

    bed.core.back()
    const socketsBefore = live.sockets.length
    // CPW1-3: the health calls of this page are on the bed's transport, not on the global stub.
    const healthAsked = () => bedOrThrow().fake.log.requestsOf('getServiceHealth').length
    await waitFor(() => expect(healthAsked()).toBeGreaterThan(0))
    const askedBefore = healthAsked()
    fireEvent.click(screen.getByTestId('login-core-retry'))
    await bed.flush()
    expect(live.sockets.length).toBeGreaterThan(socketsBefore)
    expect(live.live.socketStatus().lastReconnectReason).toBe('RETRY')
    // The health answer is asked for again when the socket is back (the query bridge; its own interval is ten seconds away).
    await waitFor(() => expect(healthAsked()).toBeGreaterThan(askedBefore), { timeout: 2_000 })
    await bed.elapse(1_000, 250)
    await waitFor(() => expect(alertKind()).toBeNull())
    expect(signInButton()).toBeEnabled()
    expect(screen.getByTestId('login-trust-line')).toHaveAttribute('data-reachable', 'true')
    expect(live.live.link).toBe(LiveLinkState.ONLINE)
  })
})

describe('the offline Alert on the simulator stays as it was', () => {
  it('Simulated, in a build that offers the choice: Retry only; "Use Simulated mode" belongs to Live mode', async () => {
    await simulatedPage(() => ({ mode: CoreMode.SIMULATED, selectable: true, switchTo: vi.fn(async () => true) }))
    act(() => simSockets[0]?.onclose?.({ code: 1006 }))
    await waitFor(() => expect(alertKind()).toBe('core-offline'))
    expect(screen.getByTestId('login-alert')).toHaveTextContent('Core service unreachable at 127.0.0.1:4400.')
    expect(screen.getByTestId('login-core-retry')).toBeInTheDocument()
    expect(screen.queryByTestId('login-use-simulated')).not.toBeInTheDocument()
    expect(fetched).toEqual([])
  })
})

describe('why the operator is on the page (WS-6, WS-14; §6.4, §6.5; AC-C-45)', () => {
  /** A signed-in console on the Stack Check page; the Core ends the session; the shell leaves for the Login page. */
  async function endedBy(reason: 'SIGNED_OUT' | 'IDLE_EXPIRED' | 'ABSOLUTE_EXPIRED' | 'USER_DISABLED'): Promise<LiveMount> {
    const mounted = await livePage('/stack-check', { session: SUPERVISOR_SESSION })
    await screen.findByTestId('page-stack-check')
    mounted.bed.core.end(reason)
    await mounted.bed.elapse(2_000, 500)
    await screen.findByTestId('page-login')
    return mounted
  }

  it('IDLE_EXPIRED: `/login?redirect=<href>` with the "session expired" notice', async () => {
    const { live, router } = await endedBy('IDLE_EXPIRED')
    expect(router.state.location.pathname).toBe('/login')
    expect(router.state.location.search).toMatchObject({ redirect: '/stack-check' })
    await waitFor(() => expect(alertKind()).toBe('expired'))
    expect(screen.getByTestId('login-alert')).toHaveTextContent('Your session expired after 15 minutes without activity. Sign in again.')
    expect(screen.getByTestId('login-alert')).toHaveAttribute('role', 'status')
    expect(page()).toHaveAttribute('data-state', 'signed-out')
    expect(live.live.lastSessionEnd).toMatchObject({ reason: 'IDLE_EXPIRED', wasSignedIn: true })
  })

  it('ABSOLUTE_EXPIRED: the 8-hour sentence', async () => {
    const { router } = await endedBy('ABSOLUTE_EXPIRED')
    expect(router.state.location.search).toMatchObject({ redirect: '/stack-check' })
    await waitFor(() => expect(alertKind()).toBe('expired-absolute'))
    expect(screen.getByTestId('login-alert')).toHaveTextContent('Your session reached its 8-hour limit. Sign in again.')
    expect(screen.getByTestId('login-alert')).toHaveAttribute('role', 'status')
  })

  it('USER_DISABLED: the disabled Alert, as a danger; a later attempt gets the generic refusal and never the word "disabled"', async () => {
    const { bed } = await endedBy('USER_DISABLED')
    await waitFor(() => expect(alertKind()).toBe('disabled'))
    const alert = screen.getByTestId('login-alert')
    expect(alert).toHaveTextContent('This account was disabled by an administrator.')
    expect(alert).toHaveAttribute('role', 'alert')

    bed.fake.answerOnceFromExample('signIn', 401)
    fireEvent.change(usernameInput(), { target: { value: USERNAME } })
    fireEvent.change(passwordInput(), { target: { value: TYPED } })
    fireEvent.click(signInButton())
    await waitFor(() => expect(alertKind()).toBe('invalid'))
    expect(screen.getByTestId('login-alert')).toHaveTextContent('Invalid username or password.')
    expect(screen.getByTestId('login-alert').textContent).not.toMatch(/disabled/i)
  })

  it('a sign-out the Core reports without this console having sent it: "You have been signed out."', async () => {
    await endedBy('SIGNED_OUT')
    await waitFor(() => expect(alertKind()).toBe('signed-out'))
    expect(screen.getByTestId('login-alert')).toHaveTextContent('You have been signed out.')
  })

  it('this console\'s own Lock and Sign out: the notice comes from what the Live source says about the end, not from the action', async () => {
    const locked = await livePage('/stack-check', { session: INVESTIGATOR_SESSION })
    await screen.findByTestId('page-stack-check')
    await locked.live.live.actions.signOut('LOCK')
    await locked.bed.elapse(2_000, 500)
    await screen.findByTestId('page-login')
    await waitFor(() => expect(alertKind()).toBe('console-locked'))
    expect(screen.getByTestId('login-alert')).toHaveTextContent(en.login.notices.consoleLocked)
    expect(locked.live.live.lastSessionEnd).toMatchObject({ signOut: 'LOCK' })
    // `auth.status` has no value LOCKED: the store alone could not have said this.
    expect(selectAuth(locked.live.live.store.getState()).status).toBe(AuthStatus.SIGNED_OUT)
  })

  it('a fresh visit, and a reload after the session ended, show no notice: the reason is in memory only', async () => {
    const first = await livePage('/stack-check', { session: SUPERVISOR_SESSION })
    await screen.findByTestId('page-stack-check')
    first.bed.core.end('IDLE_EXPIRED')
    await first.bed.elapse(2_000, 500)
    await screen.findByTestId('page-login')
    await waitFor(() => expect(alertKind()).toBe('expired'))

    cleanup()
    first.bed.close(first.live)
    const reloaded = await first.bed.load()
    await first.bed.mount(reloaded, '/login')
    await screen.findByTestId('page-login')
    expect(reloaded.live.lastSessionEnd).toBeNull()
    expect(alertKind()).toBeNull()
    expect(page()).toHaveAttribute('data-state', 'idle')
  })
})

describe('the mode selector (§3.2, §3.3; MD-4; AC-C-23)', () => {
  const stored = (created: LiveTestBed) => created.storage?.getItem(CORE_MODE_STORAGE_KEY) ?? null
  /** The runtime's own control, as the entry builds it for a Live page load. */
  const liveControl = (created: LiveTestBed, live: LivePage): CoreModeControl =>
    createCoreModeControl({
      resolution: { mode: CoreMode.LIVE, selectable: true, source: CoreModeSource.STORED },
      sim: live.runtime.sim,
      storage: created.storage,
      location: created.location,
      sink: createErrorSink({ dev: false }),
      stop: () => live.runtime.stop(),
    })

  it('Live: "Live" is the selected segment; choosing "Simulated" asks first, and Cancel changes nothing', async () => {
    const { bed, live } = await livePage('/login', { storage: createMemoryStorage({ [CORE_MODE_STORAGE_KEY]: 'LIVE' }), coreMode: liveControl })
    await screen.findByTestId('page-login')
    const selector = screen.getByTestId('login-mode-selector')
    expect(selector).toHaveAttribute('data-mode', 'LIVE')
    expect(within(selector).getByRole('radio', { name: 'Live' })).toBeChecked()
    expect(within(selector).getByRole('radio', { name: 'Simulated' })).not.toBeChecked()

    fireEvent.click(screen.getByTestId('login-mode-SIMULATED'))
    const dialog = await screen.findByTestId('mode-switch-dialog')
    expect(dialog).toHaveTextContent('Switch to Simulated mode?')
    fireEvent.click(within(dialog).getByTestId('mode-switch-cancel'))
    await waitFor(() => expect(screen.queryByTestId('mode-switch-dialog')).not.toBeInTheDocument())
    expect(stored(bed)).toBe('LIVE')
    expect(bed.location.assigned).toEqual([])
    expect(live.live.isRunning()).toBe(true)
    // The selection is the mode of this page load: it did not move.
    expect(within(screen.getByTestId('login-mode-selector')).getByRole('radio', { name: 'Live' })).toBeChecked()
  })

  it('Live to Simulated, confirmed: the choice is stored, the Live source is stopped, and the page is loaded again at `/login`', async () => {
    const { bed, live } = await livePage('/login', { storage: createMemoryStorage({ [CORE_MODE_STORAGE_KEY]: 'LIVE' }), coreMode: liveControl })
    await screen.findByTestId('page-login')
    fireEvent.click(screen.getByTestId('login-mode-SIMULATED'))
    fireEvent.click(within(await screen.findByTestId('mode-switch-dialog')).getByTestId('mode-switch-confirm'))
    await waitFor(() => expect(bed.location.assigned).toEqual(['/login']))
    expect(stored(bed)).toBe('SIMULATED')
    expect(live.live.isRunning()).toBe(false)
    // Nobody was signed in: no sign-out was sent.
    expect(bed.fake.log.requestsOf('signOut')).toHaveLength(0)
  })

  it('Simulated to Live, confirmed: the same three steps on the simulator', async () => {
    const storage = createMemoryStorage()
    const location = createTestLocation()
    const stop = vi.fn()
    await simulatedPage((sim) =>
      createCoreModeControl({
        resolution: { mode: CoreMode.SIMULATED, selectable: true, source: CoreModeSource.DEFAULT },
        sim,
        storage,
        location,
        sink: createErrorSink({ dev: false }),
        stop,
      }),
    )
    const selector = screen.getByTestId('login-mode-selector')
    expect(selector).toHaveAttribute('data-mode', 'SIMULATED')
    expect(within(selector).getByRole('radio', { name: 'Simulated' })).toBeChecked()

    fireEvent.click(screen.getByTestId('login-mode-LIVE'))
    const dialog = await screen.findByTestId('mode-switch-dialog')
    expect(dialog).toHaveTextContent('Switch to Live mode?')
    fireEvent.click(within(dialog).getByTestId('mode-switch-confirm'))
    await waitFor(() => expect(location.assigned).toEqual(['/login']))
    expect(storage.getItem(CORE_MODE_STORAGE_KEY)).toBe('LIVE')
    expect(stop).toHaveBeenCalledTimes(1)
  })

  it('a choice that could not be stored: one toast says so, the dialog closes, nothing is loaded again', async () => {
    const switchTo = vi.fn(async () => false)
    await livePage('/login', { coreMode: () => ({ mode: CoreMode.LIVE, selectable: true, switchTo }) })
    await screen.findByTestId('page-login')
    fireEvent.click(screen.getByTestId('login-mode-SIMULATED'))
    fireEvent.click(within(await screen.findByTestId('mode-switch-dialog')).getByTestId('mode-switch-confirm'))
    expect(await screen.findByText('The mode could not be saved in this browser. Nothing was changed.')).toBeInTheDocument()
    await waitFor(() => expect(screen.queryByTestId('mode-switch-dialog')).not.toBeInTheDocument())
    expect(switchTo).toHaveBeenCalledTimes(1)
  })

  // CPW1-1 / CPW1-8 (decision D144(1)): the Login page uses the shell's one copy and names itself
  // in the page's own log, with the login discipline — a fixed sentence and the class of the cause,
  // never the text of an unknown error.
  it('a switch that throws is recorded by this page under `login.modeSwitch`, without the text of the cause', async () => {
    const before = webErrorSink.records().length
    const cause = new Error('a cause the page does not repeat')
    cause.name = 'StorageError'
    await livePage('/login', { coreMode: () => ({ mode: CoreMode.LIVE, selectable: true, switchTo: vi.fn(() => Promise.reject(cause)) }) })
    await screen.findByTestId('page-login')
    fireEvent.click(screen.getByTestId('login-mode-SIMULATED'))
    fireEvent.click(within(await screen.findByTestId('mode-switch-dialog')).getByTestId('mode-switch-confirm'))
    expect(await screen.findByText('The mode could not be saved in this browser. Nothing was changed.')).toBeInTheDocument()
    const written = webErrorSink.records().slice(before)
    expect(written).toEqual([
      expect.objectContaining({
        level: 'error',
        source: 'login.modeSwitch',
        message: 'The data mode could not be changed.',
        context: { from: 'LIVE', to: 'SIMULATED', errorName: 'StorageError' },
      }),
    ])
    expect(JSON.stringify(written)).not.toContain('a cause the page does not repeat')
  })

  it('MD-4: no selector in a build that offers no choice, nor in a router built without `coreMode`', async () => {
    await livePage('/login', { coreMode: () => ({ mode: CoreMode.LIVE, selectable: false, switchTo: vi.fn(async () => false) }) })
    await screen.findByTestId('page-login')
    expect(screen.queryByTestId('login-mode-selector')).not.toBeInTheDocument()
    cleanup()
    bed?.dispose()
    bed = undefined

    await livePage()
    await screen.findByTestId('page-login')
    expect(screen.queryByTestId('login-mode-selector')).not.toBeInTheDocument()
    cleanup()

    await simulatedPage()
    expect(screen.queryByTestId('login-mode-selector')).not.toBeInTheDocument()
  })
})

describe('a hand-off that the session did not outlive', () => {
  it('the Core ends the session between its answer and the hand-off: the form comes back, and the page stays', async () => {
    // Real animations: the outcome of a sign-in is applied a verification beat (600 ms) after it was sent.
    MotionGlobalConfig.skipAnimations = false
    const { bed, live, router } = await livePage()
    await screen.findByTestId('page-login')
    fireEvent.change(usernameInput(), { target: { value: USERNAME } })
    fireEvent.change(passwordInput(), { target: { value: TYPED } })
    fireEvent.click(signInButton())
    await bed.flush()
    expect(selectIsSignedIn(live.live.store.getState())).toBe(true)
    expect(page()).toHaveAttribute('data-state', 'submitting')

    // Inside the beat: the account is disabled.
    bed.core.end('USER_DISABLED')
    await bed.flush()
    expect(selectIsSignedIn(live.live.store.getState())).toBe(false)

    await waitFor(() => expect(page()).not.toHaveAttribute('data-state', 'submitting'), { timeout: 3_000 })
    expect(page()).toHaveAttribute('data-leaving', 'false')
    expect(page()).not.toHaveAttribute('data-state', 'success')
    expect(usernameInput()).toBeEnabled()
    expect(router.state.location.pathname).toBe('/login')
  })
})

describe('the served state of this file', () => {
  it('is a snapshot the contract accepts (the bed sends it to every OPERATOR socket)', () => {
    bed = createLiveTestBed()
    expect(wire(bed.core.served).settings).toMatchObject({ presentationMode: false })
  })
})
