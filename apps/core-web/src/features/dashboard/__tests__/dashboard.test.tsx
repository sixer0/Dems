// Step 42 Dashboard tests (01_specs §14.5.1, AC-60 panel IDs, AC-74 and AC-75 unit forms;
// 03_motion_spec M-PG-DASH, §8, §9.4; review 06 rules R1, R3, R4). Every test builds the real
// router and shell around its own simulator (in-memory storage, no engine ticks: the tests drive
// state), as src/test/routes.test.tsx does.
// The simulator runs on a manual clock at 2026-10-01 10:00 WIB, so the seeded dataset (today's sealed
// count, the `-2026` evidence IDs) does not depend on the date or the hour the suite runs at.
import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react'
import { QueryClient } from '@tanstack/react-query'
import { createMemoryHistory, RouterProvider } from '@tanstack/react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { SocketLike } from '@dems/shared/realtime'
import {
  ALWAYS_VISIBLE,
  createManualClock,
  createMemoryAuthStorage,
  createSim,
  FaultKind,
  OPERATOR_IDS,
  selectSealedToday,
  type ScenarioName,
  type Sim,
  type SimEvent,
} from '@dems/shared/sim'
import { SHELL_INTRO_STORAGE_KEY } from '@/components/shell/shell-entrance'
import { getMissingI18nKeys, resetMissingI18nKeys } from '@/i18n'
import { REDUCED_MOTION_MEDIA_QUERY, REDUCED_MOTION_STORAGE_KEY } from '@/motion'
import { createAppRouter } from '@/router'

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

/** Reports every observed element as on screen, so ambient loops may run (R10). */
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

/**
 * The simulator's fixed "now". Today's seven sealed sessions are scheduled backwards from it
 * (`todaySchedule`): the newest ends 25 minutes before now, so a simulator on the wall clock has
 * none sealed today from 00:00 to about 00:25 WIB, and its evidence IDs carry the year of the run.
 */
const DEMO_NOW = Date.parse('2026-10-01T10:00:00+07:00')

const sims: Sim[] = []
const originalMatchMedia = window.matchMedia
const originalObserver = globalThis.IntersectionObserver
Element.prototype.scrollTo ??= function scrollTo() {}
window.scrollTo = (() => undefined) as typeof window.scrollTo

function mount({ scenario = 'idle', operatorId = OPERATOR_IDS.BUDI }: { scenario?: ScenarioName; operatorId?: string } = {}) {
  const authStorage = createMemoryAuthStorage()
  authStorage.save({ operatorId, issuedAt: DEMO_NOW })
  const sim = createSim({
    clock: createManualClock(DEMO_NOW),
    scenario,
    storage: null,
    authStorage,
    visibility: ALWAYS_VISIBLE,
    scheduler: () => () => undefined,
  })
  sims.push(sim)
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const router = createAppRouter(
    { sim, queryClient, socketFactory: () => new SilentSocket() },
    { history: createMemoryHistory({ initialEntries: ['/dashboard'] }) },
  )
  render(<RouterProvider router={router} />)
  return { sim, router }
}

const PANELS = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'] as const
/** The panels are a lazily loaded chunk (index.tsx); the first import is slow in jsdom. */
const findPanel = (id: (typeof PANELS)[number]) => screen.findByTestId(`panel-${id}`, {}, { timeout: 8000 })
const HELD_BEAT_WAIT = { timeout: 4000 }

beforeEach(() => {
  window.sessionStorage.setItem(SHELL_INTRO_STORAGE_KEY, '1') // plain arrival (no cold intro delay)
  window.localStorage.removeItem(REDUCED_MOTION_STORAGE_KEY)
  vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 503 })))
  globalThis.IntersectionObserver = VisibleObserver as unknown as typeof IntersectionObserver
  stubMatchMedia({ width: 1920, reduced: false })
  resetMissingI18nKeys()
})

afterEach(() => {
  cleanup()
  for (const sim of sims.splice(0)) sim.stop()
  window.matchMedia = originalMatchMedia
  globalThis.IntersectionObserver = originalObserver
  window.sessionStorage.removeItem(SHELL_INTRO_STORAGE_KEY)
  vi.unstubAllGlobals()
})

describe('Dashboard, idle scenario (row 42; AC-60 panel IDs; AC-75)', () => {
  it('renders page-dashboard with panels A–J inside the shell and no missing i18n key', { timeout: 15_000 }, async () => {
    mount()
    const page = await screen.findByTestId('page-dashboard', {}, { timeout: 8000 })
    expect(within(page).getByRole('heading', { level: 1, name: 'Dashboard' })).toHaveClass('sr-only')
    await findPanel('a')
    for (const id of PANELS) {
      const panel = within(page).getByTestId(`panel-${id}`)
      expect(panel).toHaveAttribute('data-panel', id.toUpperCase())
    }
    expect(screen.getByTestId('app-shell')).toHaveAttribute('data-shell-tier', 'xl')
    expect(getMissingI18nKeys()).toEqual([])
  })

  it('plays the step-92 live-feed loops in the camera tiles through CameraFeed (D50)', async () => {
    mount()
    const devices = await findPanel('e')
    for (const cameraId of ['VIDEO-01', 'VIDEO-02'] as const) {
      const tile = within(devices).getByTestId(`device-tile-${cameraId}`)
      const feed = within(tile).getByTestId('camera-feed')
      expect(feed).toHaveAttribute('data-camera', cameraId)
      expect(feed).toHaveAttribute('data-variant', 'tile')
      expect(feed).toHaveAttribute('data-feed-mode', 'video')
      const video = within(feed).getByTestId('camera-feed-video')
      expect(video.getAttribute('src')).toMatch(new RegExp(`demo-media/live/${cameraId}\\.loop\\.mp4$`))
      expect(video).toHaveProperty('muted', true)
      expect(video).toHaveAttribute('loop')
      expect(within(tile).getByText('1080p • 25 fps')).toBeInTheDocument()
    }
    // MIC tiles: the tile DbfsMeter (role="meter", −60…0 dBFS).
    for (const channel of ['AUDIO-01', 'AUDIO-02'] as const) {
      const tile = within(devices).getByTestId(`device-tile-${channel}`)
      expect(within(tile).getByRole('meter')).toHaveAttribute('aria-valuemin', '-60')
    }
  })

  it('reads 20% USED and "3.2 TB free of 4.0 TB" in the storage panel (AC-75 unit form)', { timeout: 15_000 }, async () => {
    mount()
    const storage = await findPanel('f')
    const ring = within(storage).getByRole('progressbar', { name: 'Evidence storage used' })
    expect(ring).toHaveAttribute('aria-valuetext', '20% used, 3.2 TB free of 4.0 TB')
    // After the held beat the ring sweeps to 20 and the numbers land (M-C-03, R4).
    await waitFor(() => expect(ring).toHaveAttribute('aria-valuenow', '20'), HELD_BEAT_WAIT)
    await waitFor(() => expect(within(ring).getByTestId('storage-used-percent')).toHaveTextContent(/^20%$/), HELD_BEAT_WAIT)
    expect(within(ring).getByText('USED')).toBeInTheDocument()
    await waitFor(() => expect(within(storage).getByTestId('storage-free')).toHaveTextContent('3.2 TB Free'), HELD_BEAT_WAIT)
    expect(within(storage).getByTestId('storage-free')).toHaveTextContent('of 4.0 TB')
    expect(within(storage).getByTestId('storage-legend-used')).toHaveTextContent('804 GB')
    expect(within(storage).getByTestId('storage-legend-free')).toHaveTextContent('3.2 TB')
    expect(within(storage).getByTestId('storage-legend-pending')).toHaveTextContent('1')
  })

  it('links the six status-strip cells to their pages with tone and value', async () => {
    mount()
    const strip = await findPanel('c')
    const expected: Array<[string, string, RegExp]> = [
      ['cameras', '/devices', /2 Cameras: Ready/],
      ['mics', '/devices', /2 Microphones: Ready/],
      ['storage', '/storage', /Storage: 3\.2 TB Free/],
      ['time', '/network-time', /GNSS \/ Time: Synchronized/],
      ['security', '/security-audit', /Security: Secure/],
      ['network', '/network-time', /Network: Connected/],
    ]
    for (const [id, href, name] of expected) {
      const cell = within(strip).getByTestId(`strip-${id}`)
      expect(cell).toHaveAttribute('href', href)
      expect(cell).toHaveAttribute('data-tone', 'success')
      expect(cell).toHaveAccessibleName(name)
    }
  })

  it('shows the idle Active Session with an RBAC-enabled split Start button (R4)', async () => {
    mount()
    const panel = await findPanel('d')
    expect(within(panel).getByTestId('session-idle')).toBeInTheDocument()
    expect(within(panel).getByText('No active session')).toBeInTheDocument()
    expect(within(panel).getByTestId('start-new-session')).not.toBeDisabled()
    expect(within(panel).getByRole('button', { name: 'More start options' })).toBeInTheDocument()
    expect(within(panel).getByRole('button', { name: /Open Evidence Queue/ })).toBeInTheDocument()
  })

  it('shows the ring READY with the flags line, and G with every column secure', async () => {
    mount()
    const ringPanel = await findPanel('a')
    expect(within(ringPanel).getByTestId('glow-ring')).toHaveAttribute('data-state', 'READY')
    expect(within(ringPanel).getByTestId('ring-status-line')).toHaveTextContent('SECURE • HEALTHY • OPERATIONAL')
    const g = screen.getByTestId('panel-g')
    for (const id of ['stn-tpm', 'stn-time', 'stn-network', 'stn-posture']) {
      expect(within(g).getByTestId(id)).toHaveAttribute('data-tone', 'success')
    }
    expect(within(g).getByTestId('stn-summary')).toHaveTextContent('All systems secure')
    expect(within(g).getByTestId('stn-time')).toHaveAccessibleName(/UTC\+07:00/)
  })

  it('shows today\'s sealed count and six recent events grouped by day at UTC+07:00', { timeout: 15_000 }, async () => {
    const { sim } = mount()
    const h = await findPanel('h')
    const sealedToday = sim.store.getState().evidence.filter((item) => item.sealedAt !== null && item.id.includes('-2026')).length
    expect(sealedToday).toBeGreaterThan(0)
    await waitFor(() => expect(within(h).getByTestId('sealed-today-count').textContent).not.toBe('0'), HELD_BEAT_WAIT)
    const events = within(screen.getByTestId('panel-i')).getAllByTestId('recent-event')
    expect(events).toHaveLength(6)
    expect(screen.getByTestId('panel-i')).toHaveTextContent(/UTC\+07:00/)
    for (const row of events) expect(row).toHaveAttribute('data-fresh', 'false')
  })
})

describe('Dashboard, recording scenario (AC-74 unit form; M-PG-DASH data moments)', () => {
  it('shows the same session ID, case and investigator as the simulator, at UTC+07:00', async () => {
    const { sim } = mount({ scenario: 'recording' })
    const session = sim.store.getState().session
    expect(session?.state).toBe('RECORDING')
    const panel = await findPanel('d')
    const recording = await within(panel).findByTestId('session-recording')
    expect(within(recording).getByTestId('session-session')).toHaveTextContent(session?.id ?? 'missing')
    expect(within(recording).getByTestId('session-case')).toHaveTextContent(session?.input.caseNumber ?? 'missing')
    expect(within(recording).getByTestId('session-investigator')).toHaveTextContent('AKP Budi Santoso')
    expect(within(recording).getByTestId('session-subject')).toHaveTextContent('Tersangka · Ahmad Fauzi')
    expect(within(recording).getByTestId('session-start')).toHaveTextContent(/UTC\+07:00$/)
    // The REC thumbnail is a poster-only CameraFeed (decode budget) with the REC timer.
    const thumb = within(recording).getByTestId('camera-feed')
    expect(thumb).toHaveAttribute('data-variant', 'thumb')
    expect(thumb).toHaveAttribute('data-live', 'false')
    expect(within(thumb).getByTestId('rec-indicator')).toBeInTheDocument()
    // The ring and the hero follow the recording (M-C-01, M-C-13).
    expect(within(screen.getByTestId('panel-a')).getByTestId('glow-ring')).toHaveAttribute('data-state', 'RECORDING')
    expect(within(screen.getByTestId('panel-b')).getByTestId('hero-copy')).toHaveAttribute('data-copy', 'recording')
    expect(screen.getByTestId('panel-b')).toHaveTextContent(`Recording ${session?.id} • Case ${session?.input.caseNumber}`)
  })
})

describe('Dashboard RBAC (S20; review rule R4)', () => {
  it('locks Start New Session for a role without SESSION_START and names the role', async () => {
    mount({ operatorId: OPERATOR_IDS.RINA }) // TECHNICIAN
    const panel = await findPanel('d')
    expect(within(panel).getByTestId('start-new-session')).toBeDisabled()
    // Fix wave J (JW-14): the reason is VISIBLE beside the disabled control (it lived in a tooltip), and it names every
    // role that may start a session.
    const locked = within(panel).getByTestId('start-new-session-locked')
    expect(locked).toHaveAttribute('aria-label', 'Start New Session: Requires the Investigator or Supervisor role')
    expect(within(locked).getByTestId('role-reason')).toHaveTextContent('Requires the Investigator or Supervisor role')
    expect(within(locked).getByTestId('role-reason')).toBeVisible()
  })

  it('disables Export Evidence for an investigator and keeps the page shortcuts enabled', async () => {
    mount() // INVESTIGATOR
    const j = await findPanel('j')
    const exportCard = within(j).getByTestId('quick-action-exportEvidence')
    expect(exportCard).toHaveAttribute('data-enabled', 'false')
    expect(exportCard).toHaveAttribute('aria-disabled', 'true')
    expect(exportCard).toHaveAccessibleName('Export Evidence: Requires the Supervisor role')
    expect(within(j).getByTestId('quick-action-runDiagnostics')).toHaveAttribute('href', '/system')
    expect(within(j).getByTestId('quick-action-reviewAudit')).toHaveAttribute('href', '/security-audit')
    expect(within(j).getByTestId('quick-action-openMaintenance')).toHaveAttribute('href', '/system')
  })

  it('enables Export Evidence for a supervisor', async () => {
    mount({ operatorId: OPERATOR_IDS.ANDI }) // SUPERVISOR
    const j = await findPanel('j')
    expect(within(j).getByTestId('quick-action-exportEvidence')).toHaveAttribute('href', '/evidence')
  })
})

describe('Dashboard motion (§9.4 cap, §8 reduced motion, M-C-07, §7 new seal)', () => {
  it('runs the four page loops (ring rotation, ring breath, hero Ken Burns, idle invitation) and the shell yields', async () => {
    mount()
    await findPanel('a')
    const ticks = () => document.querySelector('[data-ring-layer="ticks"]')
    const breath = () => document.querySelector('[data-ring-layer="bracket-glow"]')
    await waitFor(() => expect(ticks()).toHaveAttribute('data-ambient', 'running'))
    await waitFor(() => expect(breath()).toHaveAttribute('data-ambient', 'running'))
    await waitFor(() => expect(screen.getByTestId('hero-media')).toHaveAttribute('data-ambient', 'running'))
    const idle = screen.getByTestId('session-idle')
    await waitFor(() => {
      const loops = [...idle.querySelectorAll('[data-ambient]')]
      expect(loops.length).toBe(2) // Ripple + ShineBorder, one shared slot (D63)
      for (const loop of loops) expect(loop).toHaveAttribute('data-ambient', 'running')
    })
    // Four page slots are taken, so the shell's topographic drift is paused (§9.4).
    await waitFor(() => expect(document.querySelector('[data-shell-slot="topo"]')).toHaveAttribute('data-ambient', 'paused'))
  })

  it('pauses the idle invitation while degraded, so the shell SECURE beam gets its slot (R8, §9.4)', async () => {
    const { sim } = mount()
    await findPanel('d')
    const invitation = () => [...screen.getByTestId('session-idle').querySelectorAll('[data-ambient]')]
    await waitFor(() => {
      for (const loop of invitation()) expect(loop).toHaveAttribute('data-ambient', 'running')
    })
    act(() => sim.actions.inject(FaultKind.FAN_STALL))
    await waitFor(() => {
      for (const loop of invitation()) expect(loop).toHaveAttribute('data-ambient', 'paused')
    })
    await waitFor(() => expect(document.querySelector('[data-shell-slot="secure-beam"]')).toHaveAttribute('data-ambient', 'running'))
    expect(within(screen.getByTestId('panel-a')).getByTestId('glow-ring')).toHaveAttribute('data-state', 'ATTENTION')
  })

  it('is static under reduced motion: every loop paused, values final at once (AC-70, §8)', async () => {
    stubMatchMedia({ width: 1920, reduced: true })
    mount()
    await findPanel('j')
    await waitFor(() => expect(document.documentElement).toHaveAttribute('data-motion', 'reduced'))
    expect(screen.getByTestId('dashboard-hero')).toHaveAttribute('data-motion', 'reduced')
    for (const element of document.querySelectorAll('[data-testid="page-dashboard"] [data-ambient]')) {
      expect(element).toHaveAttribute('data-ambient', 'paused')
      expect(element).toHaveAttribute('data-motion', 'reduced')
    }
    const ring = within(screen.getByTestId('panel-f')).getByRole('progressbar')
    expect(ring).toHaveAttribute('aria-valuenow', '20')
    expect(screen.getByTestId('storage-free')).toHaveTextContent('3.2 TB Free')
  })

  it('inserts a new event at the top with the highlight (M-C-07)', async () => {
    const { sim } = mount()
    const panel = await findPanel('i')
    const now = sim.store.getState().clock.now
    const event: SimEvent = {
      id: 'LOG-990001',
      seq: 990001,
      at: now,
      type: 'HEALTH_CHECK_OK',
      severity: 'SUCCESS',
      message: 'System health check completed',
      params: {},
      sessionId: null,
      deviceId: null,
    }
    act(() => {
      sim.store.setState((state) => ({ events: [...state.events, event] }))
    })
    await waitFor(() => {
      const first = within(panel).getAllByTestId('recent-event')[0]
      expect(first).toHaveAttribute('data-event-id', 'LOG-990001')
      expect(first).toHaveAttribute('data-fresh', 'true')
    })
    // The oldest row leaves (opacity exit, R2), so six rows remain.
    await waitFor(() => expect(within(panel).getAllByTestId('recent-event')).toHaveLength(6))
    expect(within(panel).getByText('System health check completed')).toBeInTheDocument()
  })

  it('announces a new seal with a toast and ticks the count (§7 FINALIZING → SEALED)', { timeout: 15_000 }, async () => {
    const { sim } = mount()
    const h = await findPanel('h')
    const before = selectSealedToday(sim.store.getState())
    await waitFor(() => expect(within(h).getByTestId('sealed-today-count')).toHaveTextContent(String(before)), HELD_BEAT_WAIT)
    const recorded = sim.store.getState().evidence.find((item) => item.status === 'RECORDED')
    expect(recorded).toBeDefined()
    act(() => {
      sim.store.setState((state) => ({
        evidence: state.evidence.map((item) =>
          item.id === recorded?.id ? { ...item, status: 'SEALED' as const, sealedAt: state.clock.now } : item,
        ),
      }))
    })
    expect(await screen.findByText(`Evidence ${recorded?.id} sealed`)).toBeInTheDocument()
    expect(selectSealedToday(sim.store.getState())).toBe(before + 1)
    await waitFor(() => expect(within(h).getByTestId('sealed-today-count')).toHaveTextContent(String(before + 1)), HELD_BEAT_WAIT)
  })
})

// Fix wave J, driver J-W - JW-07 (truth rule 3f) and JW-04 / JW-05 (rule 3c). The demonstration says DEMO on its ring, its
// strip and every card that shows a feed, a recording state or an integrity statement; a Core in its own capture draws no
// such mark, and its pill never reads "SECURE".
describe('wave J: the demonstration is marked, a real-capture Core is not, and the pill reads the one statement', () => {
  it('JW-07: the simulated Dashboard carries the DEMO marks (ring, strip, the cards), and the feeds say DEMO', async () => {
    mount()
    await findPanel('a')
    const blocks = Array.from(document.querySelectorAll<HTMLElement>('[data-demo-block]'), (element) => element.dataset.demoBlock)
    for (const block of ['dashboard-ring', 'dashboard-strip', 'dashboard-d', 'dashboard-e', 'dashboard-f', 'dashboard-g', 'dashboard-h']) expect(blocks).toContain(block)
    // Recent Events and Quick Actions show no feed, recording state or integrity statement: no mark.
    expect(blocks).not.toContain('dashboard-i')
    expect(blocks).not.toContain('dashboard-j')
    expect(screen.getByTestId('demo-mark-dashboard-ring')).toHaveTextContent('DEMO · SIMULATED')
    expect(within(await findPanel('e')).getAllByTestId('demo-mark-feed').length).toBeGreaterThan(0)
    expect(screen.getByTestId('secure-pill')).toHaveAttribute('data-statement', 'SECURE')
  })

  it('JW-07 NEGATIVE CONTROL / JW-04: a Core that states its own capture draws no DEMO mark, and its pill is "NO FAULT REPORTED", never SECURE', async () => {
    const { sim } = mount()
    await findPanel('a')
    act(() => {
      sim.store.setState((state) => ({ security: { ...state.security, platformNotReported: true }, time: { ...state.time, hostClock: true } }))
    })
    await waitFor(() => expect(document.querySelectorAll('[data-demo-block]')).toHaveLength(0))
    const pill = screen.getByTestId('secure-pill')
    expect(pill).toHaveAttribute('data-statement', 'NO_FAULT_REPORTED')
    expect(pill).toHaveTextContent('NO FAULT REPORTED')
    expect(pill).toHaveTextContent('Platform security: not reported')
    expect(pill).not.toHaveTextContent(/SECURE|All systems operational/)
  })

  it('JW-05 / JT-01: an active unreachable-camera alert takes "SECURE" off the pill AND the ring at once', async () => {
    const { sim } = mount()
    await findPanel('a')
    act(() => {
      sim.store.setState((state) => ({
        alerts: [{ id: 'ALR-000900', at: state.clock.now, severity: 'WARNING', kind: 'SYSTEM', message: 'Camera 2 (CAM-02) is not reachable.', active: true, acknowledged: false, resolvedAt: null, params: { reason: 'CAPTURE_DEVICE_UNREACHABLE', deviceId: 'CAM-02', deviceKind: 'CAMERA', phase: 'PRECHECK', cause: 'UNREACHABLE' } }],
      }))
    })
    await waitFor(() => expect(screen.getByTestId('secure-pill')).toHaveAttribute('data-statement', 'ALERT_ACTIVE'))
    expect(screen.getByTestId('secure-pill')).toHaveTextContent('ALERT ACTIVE')
    expect(screen.getByTestId('secure-pill')).toHaveTextContent('1 active alert')
    expect(screen.getByTestId('secure-pill')).not.toHaveTextContent('All systems operational')
    const ring = within(await findPanel('a'))
    expect(ring.getByTestId('ring-status-line')).toHaveTextContent('1 ACTIVE ALERT')
    expect(ring.getByTestId('glow-ring')).toHaveAttribute('data-state', 'ATTENTION')
    expect(document.querySelector('.dems-dash-ring-cell')).toHaveAttribute('data-statement', 'ALERT_ACTIVE')
  })
})
