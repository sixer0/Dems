// Step 50 Network & Time page tests (masterplan/01_specs.md §14.5.6; 03_motion_spec M-PG-NET; AC-66).
// Each test builds the real router (route tree, guard, providers, shell) around its own simulator
// with in-memory storage and no engine ticks, like src/test/routes.test.tsx (D54(a)). FAST LANE
// (D75): render and key states only.
import { en } from '@dems/shared/i18n'
import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react'
import { QueryClient } from '@tanstack/react-query'
import { createMemoryHistory, RouterProvider } from '@tanstack/react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { HealthResponse } from '@dems/shared/api'
import type { SocketLike } from '@dems/shared/realtime'
import {
  ALWAYS_VISIBLE,
  createMemoryAuthStorage,
  createSim,
  OPERATOR_IDS,
  type ScenarioName,
  type Sim,
  type TimeHistoryPoint,
} from '@dems/shared/sim'
import { SHELL_INTRO_STORAGE_KEY } from '@/components/shell/shell-entrance'
import { getMissingI18nKeys, resetMissingI18nKeys } from '@/i18n'
import { REDUCED_MOTION_MEDIA_QUERY } from '@/motion'
import { createAppRouter } from '@/router'

/** Cold route-tree import on a loaded machine can exceed testing-library's 1 s default (P11). */
const PAGE_WAIT = { timeout: 10_000 }

const PANEL_IDS = ['system-time', 'hierarchy', 'network', 'domains', 'offset', 'log'] as const
const WIB_MS = 7 * 3_600_000

/** HH:mm:ss at UTC+07:00, computed independently of the app's formatter. */
function wibClock(at: number): string {
  const d = new Date(at + WIB_MS)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`
}

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

const sims: Sim[] = []

function mount(scenario: ScenarioName = 'idle'): Sim {
  const authStorage = createMemoryAuthStorage()
  authStorage.save({ operatorId: OPERATOR_IDS.BUDI, issuedAt: Date.now() })
  const sim = createSim({
    storage: null,
    authStorage,
    visibility: ALWAYS_VISIBLE,
    scheduler: () => () => undefined, // no engine ticks: the tests drive state directly
    scenario,
  })
  sims.push(sim)
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const router = createAppRouter(
    { sim, queryClient, socketFactory: () => new SilentSocket() },
    { history: createMemoryHistory({ initialEntries: ['/network-time'] }) },
  )
  render(<RouterProvider router={router} />)
  return sim
}

function stubMatchMedia(reduced: boolean) {
  window.matchMedia = ((query: string) =>
    ({
      matches: query === REDUCED_MOTION_MEDIA_QUERY ? reduced : false,
      media: query,
      onchange: null,
      addListener: () => undefined,
      removeListener: () => undefined,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      dispatchEvent: () => false,
    }) as MediaQueryList) as typeof window.matchMedia
}

const originalMatchMedia = window.matchMedia
Element.prototype.scrollTo ??= function scrollTo() {}
window.scrollTo = (() => undefined) as typeof window.scrollTo

beforeEach(() => {
  resetMissingI18nKeys()
  window.sessionStorage.setItem(SHELL_INTRO_STORAGE_KEY, '1')
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(JSON.stringify(health), { status: 200 })),
  )
})

afterEach(() => {
  cleanup()
  for (const sim of sims.splice(0)) sim.stop()
  window.matchMedia = originalMatchMedia
  window.sessionStorage.removeItem(SHELL_INTRO_STORAGE_KEY)
  vi.unstubAllGlobals()
})

describe('Network & Time page (01_specs §14.5.6)', { timeout: 30_000 }, () => {
  it('renders page-network-time with the banner and every panel, UTC+07:00 timestamps and 0 missing keys', async () => {
    const sim = mount()
    const page = await screen.findByTestId('page-network-time', {}, PAGE_WAIT)
    expect(screen.getByRole('main')).toContainElement(page)
    expect(within(page).getByRole('heading', { level: 1 })).toHaveTextContent('NETWORK & TIME')
    for (const id of PANEL_IDS) expect(within(page).getByTestId(`network-time-panel-${id}`)).toBeInTheDocument()

    const state = sim.store.getState()
    // System time hero: the sim clock at UTC+07:00 (D28/Q2), the zone chip and the WIB date.
    expect(screen.getByTestId('network-time-clock')).toHaveTextContent(wibClock(state.clock.now))
    expect(screen.getByTestId('network-time-zone')).toHaveTextContent('UTC+07:00')
    expect(screen.getByTestId('network-time-date')).toHaveTextContent(/^\w{3}, \d{1,2} \w{3} \d{4}$/)
    expect(screen.getByTestId('network-time-source')).toHaveTextContent('GPS (GNSS stratum 1)')

    // Banner and hierarchy: GNSS locked, active tier on top, orbit turning.
    expect(screen.getByTestId('network-time-banner')).toHaveTextContent('Synchronized • Connected')
    expect(screen.getByTestId('network-time-banner')).toHaveTextContent('GNSS · stratum 1 · 192.168.10.21')
    expect(screen.getByTestId('network-time-tiers')).toHaveAttribute('data-active', 'GNSS')
    expect(screen.getByTestId('network-time-tier-GNSS')).toHaveTextContent('Active')
    expect(screen.getByTestId('network-time-tier-NTP')).toHaveTextContent('Standby')
    expect(screen.getByTestId('network-time-orbit')).toHaveAttribute('data-locked', 'true')
    expect(screen.getByTestId('network-time-orbit-caption')).toHaveTextContent('11 SV')
    // Last sync is shown at UTC+07:00 too.
    expect(screen.getByTestId('network-time-last-sync')).toHaveTextContent(wibClock(state.time.lastSyncAt))

    // Network status and the four §21.1 domains.
    expect(screen.getByTestId('network-time-row-lan')).toHaveTextContent('Connected')
    expect(screen.getByTestId('network-time-row-lan')).toHaveTextContent('192.168.10.21 · Interview LAN · 1 Gbps')
    // D79 (step 54): the design book's 2 PoE ports, both healthy (CAM 1 powered, CAM 2/AUX spare).
    expect(screen.getByTestId('network-time-row-poe')).toHaveTextContent('2/2 ports')
    expect(screen.getByTestId('network-time-row-poe')).toHaveTextContent('18.6 W of 60 W budget')
    expect(screen.getByTestId('network-time-tablet-state')).toHaveTextContent('Connected')
    expect(screen.getByTestId('network-time-domain-CAMERA')).toHaveTextContent('Camera ↔ Core only')
    expect(screen.getByTestId('network-time-domain-CAMERA')).toHaveTextContent('Active')
    expect(screen.getByTestId('network-time-domain-SERVICE_UPDATE')).toHaveTextContent('Restricted')
    expect(screen.getByTestId('network-time-domain-EXPORT_TRANSFER')).toHaveTextContent('On demand')

    // Event log: dataset rows (boot, GNSS time sync, update notice), newest first, times at UTC+07:00.
    const rows = within(page).getAllByTestId('network-time-log-row')
    expect(rows.length).toBeGreaterThan(0)
    const matching = state.events.filter((e) =>
      ['TIME_SYNC', 'SYSTEM_BOOT', 'UPDATE_AVAILABLE', 'EVIDENCE_EXPORTED', 'TABLET_CONNECTED'].includes(e.type),
    )
    const newest = matching[matching.length - 1]
    expect(newest).toBeDefined()
    expect(rows[0]).toHaveTextContent(wibClock(newest?.at ?? 0))
    expect(within(page).getByText('Time synchronized')).toBeInTheDocument()

    // The simulator back-fills the offset history since boot (step 54, W50-4): the chart is full at load.
    expect(screen.queryByTestId('network-time-offset-empty')).toBeNull()
    expect(await screen.findByTestId('network-time-offset-chart', {}, PAGE_WAIT)).toHaveAttribute('data-points', String(state.time.history.length))
    expect(getMissingI18nKeys()).toEqual([])
  })

  it('GNSS loss moves the active tier to NTP, fades the orbit and raises a toast; RTC and recovery follow (M-PG-NET)', async () => {
    stubMatchMedia(true)
    const sim = mount()
    await screen.findByTestId('page-network-time', {}, PAGE_WAIT)

    act(() => sim.actions.inject('GNSS_LOSS'))
    await waitFor(() => expect(screen.getByTestId('network-time-tiers')).toHaveAttribute('data-active', 'NTP'))
    expect(screen.getByTestId('network-time-tier-GNSS')).toHaveTextContent('Signal lost')
    expect(screen.getByTestId('network-time-orbit')).toHaveAttribute('data-locked', 'false')
    expect(screen.getByTestId('network-time-orbit-caption')).toHaveTextContent('NO FIX')
    expect(screen.getByTestId('network-time-banner')).toHaveTextContent('NTP fallback')
    expect(screen.getByTestId('network-time-banner')).toHaveAttribute('data-tone', 'warning')
    expect(screen.getByTestId('network-time-sync-chip')).toHaveTextContent('NTP fallback')
    expect(await screen.findByText('GNSS signal lost')).toBeInTheDocument()
    expect(screen.getByTestId('network-time-port-POE_CAM_1')).toHaveAttribute('data-link', 'up')
    // The FAULT_RAISED event joins the log (the network/time event filter).
    expect(screen.getAllByTestId('network-time-log-row')[0]).toHaveTextContent('Fault raised · GNSS signal lost')

    act(() => sim.actions.inject('GNSS_LOSS', { fallback: 'RTC' }))
    await waitFor(() => expect(screen.getByTestId('network-time-tiers')).toHaveAttribute('data-active', 'RTC'))
    expect(screen.getByTestId('network-time-tier-NTP')).toHaveTextContent('Unreachable')
    expect(screen.getByTestId('network-time-banner')).toHaveTextContent('RTC holdover')
    expect(await screen.findByText('No time reference')).toBeInTheDocument()
    expect(screen.getByTestId('network-time-av-sync')).toHaveAttribute('data-state', 'DEGRADED')

    act(() => sim.actions.clearFault('GNSS_LOSS'))
    await waitFor(() => expect(screen.getByTestId('network-time-tiers')).toHaveAttribute('data-active', 'GNSS'))
    expect(screen.getByTestId('network-time-banner')).toHaveTextContent('Synchronized')
    expect(await screen.findByText('GNSS lock restored')).toBeInTheDocument()
    expect(getMissingI18nKeys()).toEqual([])
  })

  it('tablet offline and camera loss degrade the Management and Camera domains (FMEA §23.1)', async () => {
    stubMatchMedia(true)
    const sim = mount()
    await screen.findByTestId('page-network-time', {}, PAGE_WAIT)

    act(() => sim.actions.setTabletLink('OFFLINE'))
    await waitFor(() => expect(screen.getByTestId('network-time-tablet-state')).toHaveTextContent('Offline'))
    expect(screen.getByTestId('network-time-tablet-alert')).toHaveTextContent('Recording continues on the Core')
    expect(screen.getByTestId('network-time-domain-MANAGEMENT')).toHaveTextContent('Degraded')
    // Wave J (J-S, contract J-S 12): the shared sentence names the operator device, not "the tablet" (a phone may be paired).
    expect(await screen.findByText(en.networkTime.toast.tabletOffline)).toBeInTheDocument()

    act(() => sim.actions.inject('CAMERA_LOSS', { cameraId: 'VIDEO-02' }))
    await waitFor(() => expect(screen.getByTestId('network-time-domain-CAMERA')).toHaveTextContent('Degraded'))
    // D79: one lens lost keeps the dual-lens camera powered on PoE CAM 1 (2/2 ports, network UP; the
    // Camera domain shows the loss). Losing both lenses takes PoE CAM 1 down: 1/2 ports, DEGRADED.
    expect(screen.getByTestId('network-time-row-poe')).toHaveTextContent('2/2 ports')
    expect(screen.getByTestId('network-time-banner')).toHaveAttribute('data-network', 'UP')
    act(() => sim.actions.inject('CAMERA_LOSS', { cameraId: 'VIDEO-01' }))
    await waitFor(() => expect(screen.getByTestId('network-time-row-poe')).toHaveTextContent('1/2 ports'))
    expect(screen.getByTestId('network-time-banner')).toHaveAttribute('data-network', 'DEGRADED')
    expect(screen.getByTestId('network-time-domain-CAMERA')).toHaveTextContent('Down')
    expect(getMissingI18nKeys()).toEqual([])
  })

  it('under reduced motion the clock digits are plain and the offset chart renders from history (§8, §9.3)', async () => {
    stubMatchMedia(true)
    const sim = mount()
    await screen.findByTestId('page-network-time', {}, PAGE_WAIT)
    expect(document.documentElement).toHaveAttribute('data-motion', 'reduced')
    const face = screen.getByTestId('network-time-panel-system-time').querySelector('.nt-clock-digits')
    expect(face).toHaveAttribute('data-sliding', 'false')
    expect(face?.textContent).toBe(wibClock(sim.store.getState().clock.now))

    const now = sim.store.getState().clock.now
    const history: TimeHistoryPoint[] = [
      { at: now - 30_000, offsetMs: 2.1, source: 'GNSS' },
      { at: now - 20_000, offsetMs: -1.4, source: 'GNSS' },
      { at: now - 10_000, offsetMs: 6.8, source: 'NTP' },
    ]
    act(() => {
      sim.store.setState((s) => ({
        ...s,
        time: { ...s.time, history },
        network: {
          ...s.network,
          bandwidth: {
            ...s.network.bandwidth,
            history: [
              { at: now - 2_000, downMbps: 12.1, upMbps: 3.0 },
              { at: now - 1_000, downMbps: 12.6, upMbps: 3.2 },
            ],
          },
        },
      }))
    })
    const chart = await screen.findByTestId('network-time-offset-chart', {}, PAGE_WAIT)
    expect(chart).toHaveAttribute('data-points', '3')
    expect(chart).toHaveAccessibleName('Clock offset over the last 3 samples, now +3.0 ms from GNSS')
    expect(await screen.findByTestId('network-time-bandwidth-chart', {}, PAGE_WAIT)).toHaveAttribute('data-points', '2')
    expect(screen.getByTestId('network-time-bandwidth')).toHaveTextContent('12.4 Mbps')
    expect(getMissingI18nKeys()).toEqual([])
  })
})
