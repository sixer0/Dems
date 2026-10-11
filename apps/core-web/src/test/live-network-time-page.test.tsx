/**
 * @vitest-environment jsdom
 * @vitest-environment-options { "url": "http://127.0.0.1:5178/" }
 */
// Plan row W71 (row 72 merged): the Network & Time page in Live mode. The page changes no production
// file in this task (04_client_integration_spec §7.3 group G9: "Operations in Live mode: none",
// "No change"; §17.4 Row 21 #3): these tests prove that, unchanged, it shows the Core server's data
// from the replica, follows the Core's deltas, claims no simulation (§3.2), asks the Core for nothing
// of its own, and keeps the folder's static rules (gate CLG (c) of 02_plan §11; AC-C-53).
//
// | Criterion | Where it is proven here |
// |-----------|-------------------------|
// | G9: the six panels render on the Live source's replica with the Core's values (time source, satellites, LAN, PoE, tablet link, events) | "the page on the Core's data" |
// | §3.2: no word of the Live page speaks of a simulation | "the page on the Core's data", "the Core's deltas", "an outage" |
// | G9: no operation is called by the page (operations 56 and 57 stay unused; the replica is the source) | "the page on the Core's data" |
// | The page follows a delta of the Core (GNSS loss, tablet link loss) with its own data moments | "the Core's deltas" |
// | An outage: the page keeps the last data and shows no notice of its own (§21.2 of row W54) | "an outage" |
// | CLG (c), AC-C-53: no production file imports `useSimActions` or reads `.actions` of a `Sim` | "static rules of the folder" |
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { cleanup, configure, screen, waitFor, within } from '@testing-library/react'
import { toast } from '@heroui/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { expectScanCovers } from './static-scan'
import { en } from '@dems/shared/i18n'
import type { FakeCommandOptions } from '@dems/shared/live/testing'
import type { SimState } from '@dems/shared/sim'
import { SHELL_INTRO_STORAGE_KEY } from '@/components/shell/shell-entrance'
import { getMissingI18nKeys, resetMissingI18nKeys } from '@/i18n'
import { resetCoreErrorPresenter } from '@/lib/core-errors'
import { REDUCED_MOTION_MEDIA_QUERY } from '@/motion'
import { createLiveTestBed, SUPERVISOR_SESSION, type LivePage, type LiveTestBed } from '@/runtime/testing/live-harness'

// The page is a lazily loaded chunk: under load the first import can take longer than the library's second.
configure({ asyncUtilTimeout: 8_000 })
vi.setConfig({ testTimeout: 25_000 })

const N = en.networkTime
const PANEL_IDS = ['system-time', 'hierarchy', 'network', 'domains', 'offset', 'log'] as const
const WIB_MS = 7 * 60 * 60 * 1000
/** HH:MM:SS at UTC+07:00, as the page writes every time (D28/Q2). */
function wibClock(at: number): string {
  const d = new Date(at + WIB_MS)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`
}

const originalMatchMedia = window.matchMedia
/** Reduced motion, as the folder's own tests run the page: the clock digits are plain text. */
function stubReducedMotion() {
  window.matchMedia = ((query: string) =>
    ({
      matches: query === REDUCED_MOTION_MEDIA_QUERY,
      media: query,
      onchange: null,
      addListener: () => undefined,
      removeListener: () => undefined,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      dispatchEvent: () => false,
    }) as MediaQueryList) as typeof window.matchMedia
}
/** Empties the kit's toast queue, which is one per page and outlives a test (F76-9). */
async function clearToasts() {
  window.matchMedia = (() => ({ matches: true })) as unknown as typeof window.matchMedia
  toast.clear()
  window.matchMedia = originalMatchMedia
  const queue = toast.getQueue() as { getExitingKeys?: () => ReadonlySet<string> }
  if ((queue.getExitingKeys?.().size ?? 0) > 0) await new Promise((resolve) => setTimeout(resolve, 350))
}
/** The toasts on screen, by their text (scoped to the kit's toast slot, F76-9). */
const toastTexts = (): string[] => Array.from(document.querySelectorAll('[data-slot="toast"]')).map((element) => element.textContent ?? '')
const toastWith = (text: string) => toastTexts().filter((entry) => entry.includes(text))

/** Every word of the page a person or a screen reader meets: its text and its accessible names. */
function pageWords(): string {
  const labels = Array.from(document.body.querySelectorAll('[aria-label], [title], [alt]')).map((element) =>
    ['aria-label', 'title', 'alt'].map((name) => element.getAttribute(name) ?? '').join(' '),
  )
  return `${document.body.textContent ?? ''} ${labels.join(' ')}`
}

let bed: LiveTestBed | undefined

/** The SUPERVISOR on the Network & Time page in Live mode, with `serve` applied to the Core's state. */
async function liveNetworkTime(serve?: (idle: SimState) => SimState): Promise<{ bed: LiveTestBed; page: LivePage }> {
  const created = createLiveTestBed({ session: SUPERVISOR_SESSION })
  bed = created
  if (serve) created.core.served = serve(created.core.served)
  const page = await created.load()
  await created.mount(page, '/network-time')
  await screen.findByTestId('page-network-time')
  for (const id of PANEL_IDS) await screen.findByTestId(`network-time-panel-${id}`)
  return { bed: created, page }
}

/** A Core whose network no simulator in a browser shows at load: its own address and LAN name, 9 satellites, one PoE port down. */
function distinctCore(idle: SimState): SimState {
  return {
    ...idle,
    time: { ...idle.time, gnss: { ...idle.time.gnss, satellites: 9 } },
    network: {
      ...idle.network,
      ip: '192.168.10.77',
      lanName: 'Core LAN B',
      poe: { ...idle.network.poe, activePorts: 1 },
    },
  }
}

/** The Core's `time` slice after a GNSS loss with the NTP fallback, as a delta op. */
function gnssLostOps(state: SimState): FakeCommandOptions['ops'] {
  const time = { ...state.time, source: 'NTP', locked: true, stratum: 2, gnss: { locked: false, satellites: 0 } }
  return [{ op: 'replace', slice: 'time', value: JSON.parse(JSON.stringify(time)) }] as FakeCommandOptions['ops']
}

beforeEach(() => {
  resetMissingI18nKeys()
  resetCoreErrorPresenter()
  window.localStorage.clear()
  window.sessionStorage.clear()
  window.sessionStorage.setItem(SHELL_INTRO_STORAGE_KEY, '1')
  stubReducedMotion()
})

afterEach(async () => {
  cleanup()
  window.matchMedia = originalMatchMedia
  await clearToasts()
  bed?.dispose()
  bed = undefined
  vi.restoreAllMocks()
})

describe('the page on the Core\'s data (G9; §3.2)', () => {
  it('renders the six panels on the Live source with the Core\'s time, network and events; the shell says LIVE; no word says "simulated"; no operation is called', async () => {
    const { bed } = await liveNetworkTime(distinctCore)
    const served = bed.core.served
    expect(screen.getByTestId('shell-mode')).toHaveTextContent('LIVE')
    // System time: the Live clock at UTC+07:00 and the Core's source.
    expect(screen.getByTestId('network-time-clock')).toHaveTextContent(wibClock(bed.fake.clock.now()))
    expect(screen.getByTestId('network-time-zone')).toHaveTextContent('UTC+07:00')
    expect(screen.getByTestId('network-time-source')).toHaveTextContent('GPS (GNSS stratum 1)')
    // Hierarchy: GNSS active with the Core's satellites.
    expect(screen.getByTestId('network-time-tiers')).toHaveAttribute('data-active', 'GNSS')
    expect(screen.getByTestId('network-time-orbit-caption')).toHaveTextContent('9 SV')
    expect(screen.getByTestId('network-time-last-sync')).toHaveTextContent(wibClock(served.time.lastSyncAt))
    // Network: the Core's address and LAN name, and its PoE port count.
    expect(screen.getByTestId('network-time-row-lan')).toHaveTextContent('192.168.10.77 · Core LAN B')
    expect(screen.getByTestId('network-time-row-poe')).toHaveTextContent('1/2 ports')
    expect(screen.getByTestId('network-time-tablet-state')).toHaveTextContent('Connected')
    // Events: the Core's network and time events, newest first.
    const rows = within(screen.getByTestId('page-network-time')).getAllByTestId('network-time-log-row')
    expect(rows.length).toBeGreaterThan(0)
    expect(within(screen.getByTestId('page-network-time')).getByText('Time synchronized')).toBeInTheDocument()
    // The offset history the Core keeps is drawn as it is.
    expect(await screen.findByTestId('network-time-offset-chart')).toHaveAttribute('data-points', String(served.time.history.length))
    // §3.2: nothing on the screen speaks of a simulation.
    expect(pageWords()).not.toMatch(/simulat/i)
    // G9: no operation of its own — the two Core operations of the area stay unused.
    expect(bed.fake.log.requestsOf('getTimeStatus')).toHaveLength(0)
    expect(bed.fake.log.requestsOf('getNetworkStatus')).toHaveLength(0)
    const pageCalls = bed.fake.calls.map((call) => call.operationId).filter((id) => !['getAuthSession', 'getServiceHealth', 'getSignInStatus', 'touchSession'].includes(id ?? ''))
    expect(pageCalls).toEqual([])
    expect(getMissingI18nKeys()).toEqual([])
  })
})

describe('the Core\'s deltas (M-PG-NET in Live mode)', () => {
  it('a GNSS loss on the Core moves the active tier to NTP, raises the page\'s warning, and its recovery says so', async () => {
    const { bed, page } = await liveNetworkTime()
    page.sockets.at(-1)!.delta(gnssLostOps(bed.core.served))
    await bed.flush()
    await waitFor(() => expect(screen.getByTestId('network-time-tiers')).toHaveAttribute('data-active', 'NTP'))
    expect(screen.getByTestId('network-time-banner')).toHaveTextContent('NTP fallback')
    expect(screen.getByTestId('network-time-banner')).toHaveAttribute('data-tone', 'warning')
    expect(screen.getByTestId('network-time-orbit')).toHaveAttribute('data-locked', 'false')
    await waitFor(() => expect(toastWith(N.toast.gnssLost)).toHaveLength(1))

    page.sockets.at(-1)!.delta([{ op: 'replace', slice: 'time', value: JSON.parse(JSON.stringify(bed.core.served.time)) }] as FakeCommandOptions['ops'])
    await bed.flush()
    await waitFor(() => expect(screen.getByTestId('network-time-tiers')).toHaveAttribute('data-active', 'GNSS'))
    await waitFor(() => expect(toastWith(N.toast.restored)).toHaveLength(1))
    expect(pageWords()).not.toMatch(/simulat/i)
  })

  it('a tablet link the Core reports offline degrades the Management domain and reminds that recording continues on the Core', async () => {
    const { bed, page } = await liveNetworkTime()
    page.sockets.at(-1)!.delta([
      { op: 'replace', slice: 'tabletLink', value: { ...bed.core.served.tabletLink, state: 'OFFLINE', changedAt: bed.fake.clock.now() } },
    ] as FakeCommandOptions['ops'])
    await bed.flush()
    await waitFor(() => expect(screen.getByTestId('network-time-tablet-state')).toHaveTextContent('Offline'))
    expect(screen.getByTestId('network-time-tablet-alert')).toHaveTextContent('Recording continues on the Core')
    expect(screen.getByTestId('network-time-domain-MANAGEMENT')).toHaveTextContent('Degraded')
    await waitFor(() => expect(toastWith(N.toast.tabletOffline)).toHaveLength(1))
  })
})

describe('an outage (§21.2 of row W54: the shell speaks, the page does not)', () => {
  it('with the Core unreachable the page keeps the Core\'s last data and adds no notice of its own', async () => {
    const { bed } = await liveNetworkTime(distinctCore)
    const networkTimePage = screen.getByTestId('page-network-time')
    bed.core.unreachable()
    await bed.flush()
    await waitFor(() => expect(screen.getByTestId('shell-mode')).toHaveTextContent(/OFFLINE|RECONNECTING/))
    expect(screen.getByTestId('network-time-row-lan')).toHaveTextContent('192.168.10.77 · Core LAN B')
    expect(screen.getByTestId('network-time-orbit-caption')).toHaveTextContent('9 SV')
    expect(within(networkTimePage).queryByText(new RegExp(en.common.coreErrors.offline.split('.')[0]!))).not.toBeInTheDocument()
    expect(pageWords()).not.toMatch(/simulat/i)
  })
})

describe('static rules of the folder (CLG (c); AC-C-53; MD-6)', () => {
  // `import.meta.dirname` (Node, through Vitest): jsdom replaces the global `URL`, so no file URL is built here.
  const folder = resolve(import.meta.dirname, '../features/network-time')
  const walk = (directory: string): string[] =>
    readdirSync(directory).flatMap((name) => {
      const path = join(directory, name)
      if (statSync(path).isDirectory()) return name === '__tests__' ? [] : walk(path)
      return /\.tsx?$/.test(name) ? [path] : []
    })
  const production = walk(folder).map((path) => ({ name: relative(folder, path), text: readFileSync(path, 'utf8') }))
  /** The code of a file without its comments: a rule is about what runs. */
  const code = (text: string) => text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

  it('reads the files it means to read', () => {
    // Rule R1 (`static-scan.ts`): the scan equals an independent listing of the folder and is not empty.
    expectScanCovers({ scanned: production.map((file) => file.name), listed: import.meta.glob('../features/network-time/**/*.{ts,tsx}'), root: '../features/network-time' })
  })

  it('AC-C-53: no file imports `useSimActions`, reads `.actions` of a `Sim`, or calls any action: the page only reads the replica', () => {
    const withoutActionWords = (text: string) => code(text).replace(/common\.actions\.[A-Za-z]+/g, '')
    for (const { name, text } of production) {
      expect(text, name).not.toMatch(/useSimActions|useCoreActions/)
      expect(withoutActionWords(text), name).not.toMatch(/\.actions\b/)
      expect(code(text), name).not.toMatch(/\bSimContext\b|live\.source/)
    }
  })

  it('MD-6, TS-15: no file loads the typed client or the Live source, builds a client, opens a socket or imports a test double', () => {
    for (const { name, text } of production) {
      const source = code(text)
      expect(source, name).not.toMatch(/from '@dems\/shared\/(client|live\/source|live\/testing)'/)
      expect(source, name).not.toMatch(/createCoreClient|createLiveSim|runtime\/(testing|live-start|boot)|new WebSocket|useWebLive/)
    }
  })
})
