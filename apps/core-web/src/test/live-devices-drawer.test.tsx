/**
 * @vitest-environment jsdom
 * @vitest-environment-options { "url": "http://127.0.0.1:5178/" }
 */
// Plan row W70: the "Paired devices" row of the device drawer in Live mode (backend task
// 04_client_integration_spec §7.3 note G6, gap GS-16) and the drawer's other Live words (§3.2), on
// the contract-checked fake transport, with the Simulated drawer as the control group.
//
// | Criterion | Where it is proven here |
// |-----------|-------------------------|
// | G6: in Live mode the row is titled "Paired devices"; a holder of PAIRING_MANAGE sees "n paired, m online" from operation 19 with a link to the Paired Devices page | "PAIRING_MANAGE" |
// | G6: any other operator sees whether a paired device is connected, from `tabletLink`, and no request is sent | "without PAIRING_MANAGE" |
// | PG-6: the count follows `admin.changed` DEVICES; CONTRACT-GAP-W70-1: it also follows a change of the tablet link | "PAIRING_MANAGE" |
// | Rule 2 / AC-C-48: a 403 of operation 19 is worded by the presenter; an outage and a 429 too; the row falls back to the tablet sentence with a rate-limited retry | "a refused or failed read" |
// | Rule 6 / CL-22: with the link down the registry is not read | "a refused or failed read" |
// | §3.2: the Health caption, the Log's command words and the display's label say nothing of a simulation in Live mode | "the drawer's other words" |
// | Simulated mode: the "Pairing" row as before, and no request | "Simulated mode is unchanged" |
import { act, cleanup, configure, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { toast } from '@heroui/react'
import { QueryClient } from '@tanstack/react-query'
import { createMemoryHistory, RouterProvider } from '@tanstack/react-router'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AuthSessionInfo, PairedDevice } from '@dems/shared/api'
import { en } from '@dems/shared/i18n'
import { LiveLinkState } from '@dems/shared/live'
import { rateLimited, type FakeCommandOptions } from '@dems/shared/live/testing'
import type { SocketLike } from '@dems/shared/realtime'
import {
  ALWAYS_VISIBLE,
  createManualClock,
  createMemoryAuthStorage,
  createSim,
  OPERATOR_IDS,
  type Sim,
  type SimState,
} from '@dems/shared/sim'
import { SHELL_INTRO_STORAGE_KEY } from '@/components/shell/shell-entrance'
import { getMissingI18nKeys, resetMissingI18nKeys } from '@/i18n'
import { resetCoreErrorPresenter } from '@/lib/core-errors'
import { createAppRouter } from '@/router'
import { CORE_QUERY_KEYS, webErrorSink } from '@/runtime'
import {
  createLiveTestBed,
  INVESTIGATOR_SESSION,
  SUPERVISOR_SESSION,
  type LivePage,
  type LiveTestBed,
  type MountedPage,
} from '@/runtime/testing/live-harness'

configure({ asyncUtilTimeout: 8_000 })
vi.setConfig({ testTimeout: 25_000 })

const G = en.devices.live.pairedDevices
const SUMMARY = (paired: number, online: number) => G.summary.replace('{{paired}}', String(paired)).replace('{{online}}', String(online))
const DENIED = en.common.rbac.deniedTitle
const REQUIRES = (role: string) => en.common.rbac.requiresRole.replace('{{role}}', role)
const OFFLINE = en.common.coreErrors.offline

const originalMatchMedia = window.matchMedia
/** Empties the kit's toast queue, which is one per page and outlives a test (F76-9). */
async function clearToasts() {
  window.matchMedia = (() => ({ matches: true })) as unknown as typeof window.matchMedia
  toast.clear()
  window.matchMedia = originalMatchMedia
  const queue = toast.getQueue() as { getExitingKeys?: () => ReadonlySet<string> }
  if ((queue.getExitingKeys?.().size ?? 0) > 0) await new Promise((resolve) => setTimeout(resolve, 350))
}
const toastTexts = (): string[] => Array.from(document.querySelectorAll('[data-slot="toast"]')).map((element) => element.textContent ?? '')
const toastWith = (text: string) => toastTexts().filter((entry) => entry.includes(text))

let bed: LiveTestBed | undefined

interface LiveDrawerOptions {
  readonly session?: Pick<AuthSessionInfo, 'operator' | 'permissions'>
  /** Changes the state the Core serves before the page loads. */
  readonly serve?: (state: SimState) => SimState
  /** Scripts answers before the page loads (the drawer is not open yet). */
  readonly script?: (bed: LiveTestBed) => void
}

/** Devices & Inputs in Live mode, signed in, the page on screen (the drawer closed). */
async function liveDevices(options: LiveDrawerOptions = {}): Promise<{ bed: LiveTestBed; page: LivePage; mounted: MountedPage }> {
  const created = createLiveTestBed({ session: options.session ?? SUPERVISOR_SESSION })
  bed = created
  if (options.serve) created.core.served = options.serve(created.core.served)
  options.script?.(created)
  const page = await created.load()
  const mounted = await created.mount(page, '/devices')
  await screen.findByTestId('page-devices')
  await screen.findByTestId('other-TABLET')
  return { bed: created, page, mounted }
}

/** Opens the drawer of `deviceId` from its Other Devices row and returns its Overview. */
async function openDrawer(deviceId: string): Promise<HTMLElement> {
  fireEvent.click(screen.getByTestId(`other-${deviceId}`))
  const drawer = await screen.findByTestId('device-drawer')
  await waitFor(() => expect(drawer).toHaveAttribute('data-device', deviceId))
  return within(drawer).getByTestId('device-overview')
}
/** The `dd` of the overview row whose `dt` reads `label`. */
function factValue(overview: HTMLElement, label: string): HTMLElement | null {
  const term = within(overview).queryByText(label, { selector: 'dt' })
  return (term?.nextElementSibling as HTMLElement | null) ?? null
}
const requests = (operationId: string) => bed!.fake.log.requestsOf(operationId)

/** A registry entry built from the contract's own example (`registry`), changed where a test needs it. */
function registryDevice(change: Partial<PairedDevice>): PairedDevice {
  const example = bed!.fake.example('listPairedDevices').body as { devices: PairedDevice[] }
  return { ...example.devices[0]!, ...change }
}
const registry = (devices: PairedDevice[]) => ({ status: 200, body: { devices } })
const withTabletLink = (state: SimState, linkState: 'CONNECTED' | 'OFFLINE'): SimState => ({ ...state, tabletLink: { ...state.tabletLink, state: linkState } })

const originalPlay = HTMLMediaElement.prototype.play
const originalPause = HTMLMediaElement.prototype.pause
const originalGetContext = HTMLCanvasElement.prototype.getContext
beforeAll(() => {
  HTMLCanvasElement.prototype.getContext = (() => null) as unknown as HTMLCanvasElement['getContext']
  HTMLMediaElement.prototype.play = (() => Promise.resolve()) as unknown as HTMLMediaElement['play']
  HTMLMediaElement.prototype.pause = (() => undefined) as unknown as HTMLMediaElement['pause']
  Element.prototype.getAnimations ??= function getAnimations() {
    return []
  }
})
afterAll(() => {
  HTMLCanvasElement.prototype.getContext = originalGetContext
  HTMLMediaElement.prototype.play = originalPlay
  HTMLMediaElement.prototype.pause = originalPause
})

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
  bed?.dispose()
  bed = undefined
  vi.restoreAllMocks()
})

describe('G6 with PAIRING_MANAGE (the SUPERVISOR)', () => {
  it('the row is titled "Paired devices" and reads "n paired, m online" from operation 19, with a link to the Paired Devices page; no "Pairing" row', async () => {
    const { mounted } = await liveDevices({ script: (b) => b.fake.answerFromExample('listPairedDevices') })
    expect(requests('listPairedDevices')).toHaveLength(0)
    const overview = await openDrawer('TABLET')
    await waitFor(() => expect(within(overview).getByTestId('drawer-paired-summary')).toHaveTextContent(SUMMARY(1, 1)))
    expect(factValue(overview, G.label)).not.toBeNull()
    expect(factValue(overview, en.devices.drawer.field.pairing)).toBeNull()
    const link = within(overview).getByTestId('drawer-paired-open')
    expect(link).toHaveAttribute('href', '/admin/devices')
    expect(link).toHaveTextContent(G.open)
    expect(requests('listPairedDevices')).toHaveLength(1)
    expect(requests('listPairedDevices')[0]).toMatchObject({ method: 'GET', path: '/api/v1/pairing/devices' })
    // The answer is held under the key of PG-6, as the operation's own answer (`PairedDeviceList`).
    expect(mounted.queryClient.getQueryData(CORE_QUERY_KEYS.pairedDevices)).toMatchObject({ devices: [{ id: 'DEV-0001', state: 'PAIRED', online: true }] })
    expect(getMissingI18nKeys()).toEqual([])
  })

  it('counts only PAIRED devices, and of them the online ones', async () => {
    await liveDevices({
      script: (b) => {
        b.fake.answer('listPairedDevices', () =>
          registry([
            registryDevice({ id: 'DEV-0003', online: false }),
            registryDevice({ id: 'DEV-0002', online: true }),
            registryDevice({ id: 'DEV-0001', state: 'REVOKED', online: false, revokedAt: Date.parse('2026-10-01T09:00:00+07:00'), revokedBy: 'OPR-002', revokeReason: 'Tablet reported lost' }),
          ]),
        )
      },
    })
    const overview = await openDrawer('TABLET')
    await waitFor(() => expect(within(overview).getByTestId('drawer-paired-summary')).toHaveTextContent(SUMMARY(2, 1)))
  })

  it('the link opens the Paired Devices page', async () => {
    const { mounted } = await liveDevices({ script: (b) => b.fake.answerFromExample('listPairedDevices') })
    const overview = await openDrawer('TABLET')
    fireEvent.click(await within(overview).findByTestId('drawer-paired-open'))
    await screen.findByTestId('page-paired-devices')
    expect(mounted.router.state.location.pathname).toBe('/admin/devices')
  })

  it('PG-6: an `admin.changed` DEVICES reads the registry again and the count follows', async () => {
    const { bed, mounted } = await liveDevices({ script: (b) => b.fake.answerFromExample('listPairedDevices') })
    const overview = await openDrawer('TABLET')
    await waitFor(() => expect(within(overview).getByTestId('drawer-paired-summary')).toHaveTextContent(SUMMARY(1, 1)))
    bed.fake.answer('listPairedDevices', () => registry([registryDevice({}), registryDevice({ id: 'DEV-0002', online: false })]))
    await act(async () => {
      bed.core.adminChanged('DEVICES')
    })
    await bed.flush()
    await waitFor(() => expect(within(overview).getByTestId('drawer-paired-summary')).toHaveTextContent(SUMMARY(2, 1)))
    expect(requests('listPairedDevices')).toHaveLength(2)
    expect(mounted.queryClient.getQueryData(CORE_QUERY_KEYS.pairedDevices)).toMatchObject({ devices: [{ id: 'DEV-0001' }, { id: 'DEV-0002' }] })
  })

  it('CONTRACT-GAP-W70-1: a change of the replicated tablet link reads the registry again, so `online` does not go stale', async () => {
    const { bed } = await liveDevices({ script: (b) => b.fake.answerFromExample('listPairedDevices') })
    const overview = await openDrawer('TABLET')
    await waitFor(() => expect(within(overview).getByTestId('drawer-paired-summary')).toHaveTextContent(SUMMARY(1, 1)))
    bed.fake.answer('listPairedDevices', () => registry([registryDevice({ online: false })]))
    const tabletLink = { ...bed.core.served.tabletLink, state: 'OFFLINE', changedAt: bed.fake.clock.now() + 1_000 }
    await act(async () => {
      bed.fake.connection().delta([{ op: 'replace', slice: 'tabletLink', value: tabletLink }] as FakeCommandOptions['ops'], { revision: bed.fake.position.revision + 1 })
    })
    await bed.flush()
    await waitFor(() => expect(within(overview).getByTestId('drawer-paired-summary')).toHaveTextContent(SUMMARY(1, 0)))
    expect(requests('listPairedDevices')).toHaveLength(2)
  })
})

describe('G6 without PAIRING_MANAGE (the INVESTIGATOR)', () => {
  it('a connected tablet link reads "A paired device is connected", and the registry is not asked', async () => {
    await liveDevices({ session: INVESTIGATOR_SESSION, serve: (state) => withTabletLink(state, 'CONNECTED') })
    const overview = await openDrawer('TABLET')
    expect(within(factValue(overview, G.label)!).getByTestId('drawer-paired-link')).toHaveTextContent(G.connected)
    expect(within(overview).queryByTestId('drawer-paired-open')).not.toBeInTheDocument()
    await bed!.flush()
    expect(requests('listPairedDevices')).toHaveLength(0)
  })

  it('an offline tablet link reads "No paired device is connected"', async () => {
    await liveDevices({ session: INVESTIGATOR_SESSION, serve: (state) => withTabletLink(state, 'OFFLINE') })
    const overview = await openDrawer('TABLET')
    expect(within(overview).getByTestId('drawer-paired-link')).toHaveTextContent(G.none)
    expect(requests('listPairedDevices')).toHaveLength(0)
  })
})

describe('a refused or failed read of the registry (rule 2; LB-6; LB-10; rule 6)', () => {
  it('AC-C-48: a 403 NOT_PERMITTED (the contract\'s `notPermitted` example) shows the denied toast naming the Supervisor; the row falls back to the tablet sentence with a retry', async () => {
    const { bed } = await liveDevices({ serve: (state) => withTabletLink(state, 'CONNECTED') })
    bed.fake.answerOnce('listPairedDevices', bed.fake.example('listPairedDevices', 403, 'notPermitted'))
    const overview = await openDrawer('TABLET')
    await waitFor(() => expect(toastWith(DENIED)).toHaveLength(1))
    expect(toastWith(DENIED)[0]).toContain(REQUIRES(en.common.roles.SUPERVISOR))
    const fallback = await within(overview).findByTestId('drawer-paired-error')
    expect(within(fallback).getByTestId('drawer-paired-link')).toHaveTextContent(G.connected)
    expect(fallback).toHaveTextContent(G.unavailable)
    expect(within(fallback).getByTestId('drawer-paired-retry')).toHaveTextContent(en.common.actions.retry)
    // The presenter worded it: no record of the page's own.
    expect(webErrorSink.records().filter((record) => record.source === 'features/devices.pairedDevices')).toHaveLength(0)
  })

  it('an outage shows the presenter\'s sentence; Retry reads again and then cools down', async () => {
    const { bed } = await liveDevices()
    bed.fake.failOnce('listPairedDevices')
    const overview = await openDrawer('TABLET')
    await waitFor(() => expect(toastWith(OFFLINE)).toHaveLength(1))
    const retry = await within(overview).findByTestId('drawer-paired-retry')
    bed.fake.answerFromExample('listPairedDevices')
    fireEvent.click(retry)
    await waitFor(() => expect(within(overview).getByTestId('drawer-paired-summary')).toHaveTextContent(SUMMARY(1, 1)))
    expect(requests('listPairedDevices')).toHaveLength(2)
  })

  it('LB-10: a 429 shows the limit toast, never the outage sentence', async () => {
    const { bed } = await liveDevices()
    bed.fake.answerOnce('listPairedDevices', rateLimited(9))
    const overview = await openDrawer('TABLET')
    await waitFor(() => expect(toastWith(en.common.coreErrors.limited.replace('{{seconds}}', '9'))).toHaveLength(1))
    expect(toastWith(OFFLINE)).toHaveLength(0)
    await within(overview).findByTestId('drawer-paired-error')
  })

  it('with the link down the registry is not read and the row shows the tablet sentence; no toast of the page\'s own', async () => {
    const { bed, page } = await liveDevices({ script: (b) => b.fake.answerFromExample('listPairedDevices') })
    bed.core.unreachable()
    await bed.flush()
    expect(page.live.link).toBe(LiveLinkState.OFFLINE)
    const overview = await openDrawer('TABLET')
    await bed.flush()
    expect(within(factValue(overview, G.label)!).getByTestId('drawer-paired-link')).toBeInTheDocument()
    expect(requests('listPairedDevices')).toHaveLength(0)
    expect(toastWith(G.unavailable)).toHaveLength(0)
  })
})

describe('the drawer\'s other words in Live mode (§3.2)', () => {
  it('the Health caption, the display\'s label and the Log\'s command words say nothing of a simulation', async () => {
    // The served state holds one test signal of CAM-01, as the Core's own engine records it.
    const authStorage = createMemoryAuthStorage()
    authStorage.save({ operatorId: OPERATOR_IDS.RINA, issuedAt: Date.parse('2026-10-01T10:00:00+07:00') })
    const source = createSim({
      clock: createManualClock(Date.parse('2026-10-01T10:00:00+07:00')),
      scenario: 'idle',
      storage: null,
      authStorage,
      visibility: ALWAYS_VISIBLE,
      scheduler: () => () => undefined,
    })
    source.actions.deviceCommand('CAM-01', 'TEST_SIGNAL')
    const row = source.store.getState().audit.rows.at(-1)!
    source.stop()
    await liveDevices({ serve: (state) => ({ ...state, audit: { ...state.audit, rows: [...state.audit.rows, row] } }) })

    expect(screen.getByTestId('front-lcd').getAttribute('aria-label') ?? '').not.toMatch(/simulat/i)
    fireEvent.click(screen.getByRole('button', { name: 'Open details for Camera 1' }))
    const drawer = await screen.findByTestId('device-drawer')
    fireEvent.click(within(drawer).getByRole('tab', { name: 'Health' }))
    const health = await within(drawer).findByTestId('device-health')
    expect(health.textContent ?? '').not.toMatch(/simulat/i)
    fireEvent.click(within(drawer).getByRole('tab', { name: 'Log' }))
    const log = await within(drawer).findByTestId('device-log')
    expect(within(log).getByText(en.devices.live.menu.testSignal)).toBeInTheDocument()
    expect(log.textContent ?? '').not.toMatch(/simulat/i)
    expect(getMissingI18nKeys()).toEqual([])
  })
})

// ── The control group: the Simulated drawer ──────────────────────────────────────────────────

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

const DEMO_NOW = Date.parse('2026-10-01T10:00:00+07:00')
const sims: Sim[] = []

describe('Simulated mode is unchanged (CLG (a))', () => {
  const fetchSpy = vi.fn(async (_input: RequestInfo | URL) => new Response('{}', { status: 503 }))
  beforeEach(() => {
    fetchSpy.mockClear()
    vi.stubGlobal('fetch', fetchSpy)
  })
  afterEach(() => {
    for (const sim of sims.splice(0)) sim.stop()
    vi.unstubAllGlobals()
  })

  it('the tablet drawer shows the "Pairing" row with the simulator\'s pairing state, the simulated words, and asks no registry', async () => {
    const authStorage = createMemoryAuthStorage()
    authStorage.save({ operatorId: OPERATOR_IDS.ANDI, issuedAt: DEMO_NOW })
    const sim = createSim({
      clock: createManualClock(DEMO_NOW),
      scenario: 'idle',
      storage: null,
      authStorage,
      visibility: ALWAYS_VISIBLE,
      scheduler: () => () => undefined,
    })
    sims.push(sim)
    const router = createAppRouter(
      { sim, queryClient: new QueryClient({ defaultOptions: { queries: { retry: false } } }), socketFactory: () => new SilentSocket() },
      { history: createMemoryHistory({ initialEntries: ['/devices'] }) },
    )
    render(<RouterProvider router={router} />)
    await screen.findByTestId('other-TABLET')
    expect(screen.getByTestId('front-lcd').getAttribute('aria-label')).toContain('(simulated)')
    const overview = await openDrawer('TABLET')
    const pairing = factValue(overview, en.devices.drawer.field.pairing)
    expect(pairing).toHaveTextContent(en.common.pairingState[sim.store.getState().pairing.state])
    expect(factValue(overview, G.label)).toBeNull()
    expect(within(overview).queryByTestId('drawer-paired-link')).not.toBeInTheDocument()
    expect(fetchSpy.mock.calls.map(([url]) => String(url)).filter((url) => url.includes('/pairing/'))).toEqual([])
  })
})
