// Step 49 Storage page tests (masterplan/01_specs.md §14.5.5, AC-54 and AC-75 in unit form, AC-66).
// Each test builds the real router (route tree, guard, providers, shell) around its own simulator
// with in-memory storage and no engine ticks, exactly like src/test/routes.test.tsx (D54(a)).
// The simulator runs on a manual clock at 2026-10-01 10:00 WIB, so the seeded dataset (and with it
// "Sealed Evidence 7 today") does not depend on the date or the hour the suite runs at.
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { QueryClient } from '@tanstack/react-query'
import { createMemoryHistory, RouterProvider } from '@tanstack/react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { HealthResponse } from '@dems/shared/api'
import type { SocketLike } from '@dems/shared/realtime'
import {
  ALWAYS_VISIBLE,
  createManualClock,
  createMemoryAuthStorage,
  createSim,
  OPERATOR_IDS,
  type ScenarioName,
  type Sim,
} from '@dems/shared/sim'
import { SHELL_INTRO_STORAGE_KEY } from '@/components/shell/shell-entrance'
import { getMissingI18nKeys, resetMissingI18nKeys } from '@/i18n'
import { REDUCED_MOTION_MEDIA_QUERY } from '@/motion'
import { createAppRouter } from '@/router'

/**
 * The first render in a worker pays the cold import of the route tree, the shell and this page. On a
 * loaded machine (parallel runs, P11) that can exceed testing-library's 1 s default, so the page
 * waits get a wider window; assertions after the page is up keep their defaults.
 */
const PAGE_WAIT = { timeout: 10_000 }

/**
 * The simulator's fixed "now". Today's seven sealed sessions are scheduled backwards from it
 * (`todaySchedule`); in the first hours after 00:00 WIB some of them fall on the previous day, so
 * a simulator on the wall clock shows fewer than 7 there.
 */
const DEMO_NOW = Date.parse('2026-10-01T10:00:00+07:00')

const PANEL_IDS = ['capacity', 'kpis', 'usage', 'sealed', 'volumes', 'activity', 'calculator', 'policy'] as const

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

function mount(scenario: ScenarioName = 'idle', operatorId: string = OPERATOR_IDS.BUDI): Sim {
  const authStorage = createMemoryAuthStorage()
  authStorage.save({ operatorId, issuedAt: DEMO_NOW })
  const sim = createSim({
    clock: createManualClock(DEMO_NOW),
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
    { history: createMemoryHistory({ initialEntries: ['/storage'] }) },
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
  // The shell's once-per-session cold intro is not under test: start from a plain entrance.
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

describe('Storage page (01_specs §14.5.5)', { timeout: 30_000 }, () => {
  it('renders page-storage with the banner and every panel inside the shell, with 0 missing keys', async () => {
    mount()
    const page = await screen.findByTestId('page-storage', {}, PAGE_WAIT)
    expect(screen.getByRole('main')).toContainElement(page)
    for (const id of PANEL_IDS) expect(within(page).getByTestId(`storage-panel-${id}`)).toBeInTheDocument()
    expect(within(page).getByTestId('storage-banner')).toHaveTextContent('Storage ready')
    expect(within(page).getByRole('heading', { level: 1 })).toHaveTextContent('STORAGE')
    expect(within(page).getAllByTestId(/^storage-kpi-/)).toHaveLength(4)
    expect(within(page).getByTestId('storage-volume-NVME-SYS')).toBeInTheDocument()
    expect(within(page).getByTestId('storage-volume-HDD-EVIDENCE')).toBeInTheDocument()
    expect(getMissingI18nKeys()).toEqual([]) // AC-66
  })

  it('AC-75: the ring shows 20% labelled USED, with "3.2 TB free of 4.0 TB" (after the sweep beat)', async () => {
    mount()
    const ring = await screen.findByRole('progressbar', { name: 'Evidence storage used' }, PAGE_WAIT)
    // The accessible value is right from the first frame; only the drawn arc sweeps.
    expect(ring).toHaveAttribute('aria-valuetext', '20% used')
    expect(Number(ring.getAttribute('aria-valuenow'))).toBeCloseTo(20.1, 1)
    await waitFor(() => expect(screen.getByTestId('storage-ring-percent')).toHaveTextContent('20%'), { timeout: 5000 })
    expect(screen.getByTestId('storage-ring-label')).toHaveTextContent('USED')
    await waitFor(() => expect(screen.getByTestId('storage-free')).toHaveTextContent('3.2 TB free of 4.0 TB'), {
      timeout: 5000,
    })
    // The legend matches D1 F and MB 8: Used 804 GB, Free 3.2 TB, Sealed Evidence 7 (today), Pending 1.
    await waitFor(() => expect(screen.getByTestId('storage-legend-used')).toHaveTextContent('Used804 GB'))
    expect(screen.getByTestId('storage-legend-free')).toHaveTextContent('Free3.2 TB')
    expect(screen.getByTestId('storage-legend-sealed')).toHaveTextContent('Sealed Evidence7 today')
    expect(screen.getByTestId('storage-legend-pending')).toHaveTextContent('Pending1')
  })

  it('under reduced motion every value is final at once and the ring is drawn without a sweep (§8)', async () => {
    stubMatchMedia(true)
    mount()
    await screen.findByTestId('page-storage', {}, PAGE_WAIT)
    expect(screen.getByTestId('storage-ring-percent')).toHaveTextContent('20%')
    expect(screen.getByTestId('storage-free')).toHaveTextContent('3.2 TB free of 4.0 TB')
    const fill = screen.getByTestId('storage-ring-fill')
    expect(fill.style.transition).toBe('none')
    // 20.1 % of the r = 16 circle: offset = C × (1 − 0.201).
    const circumference = 2 * Math.PI * 16
    expect(Number.parseFloat(fill.style.strokeDashoffset)).toBeCloseTo(circumference * (1 - 0.201), 2)
    expect(document.documentElement).toHaveAttribute('data-motion', 'reduced')
  })

  it('AC-54 on screen: KPI cards show est. remaining = free ÷ 8.2 GB/h, retention 90 days, idle write speed', async () => {
    stubMatchMedia(true)
    mount()
    await screen.findByTestId('page-storage', {}, PAGE_WAIT)
    // 3,196 GB ÷ 8.2 GB/h = 389.756 h = 389 h 45 m.
    expect(screen.getByTestId('storage-kpi-estRemaining')).toHaveTextContent('389h 45m')
    expect(screen.getByTestId('storage-kpi-estRemaining')).toHaveTextContent('at 8.2 GB per hour')
    expect(screen.getByTestId('storage-kpi-estRemaining')).toHaveTextContent('About 16 days of continuous recording')
    expect(screen.getByTestId('storage-kpi-retentionDays')).toHaveTextContent('90days')
    expect(screen.getByTestId('storage-kpi-retentionDays')).toHaveTextContent('90 days · auto-archive on')
    expect(screen.getByTestId('storage-kpi-writeSpeed')).toHaveTextContent('0.0MB/s')
    expect(screen.getByTestId('storage-kpi-writeSpeed')).toHaveTextContent('Idle · no active recording')
    expect(screen.getByTestId('storage-kpi-sessionSize')).toHaveTextContent('No active session')
  })

  it('in the recording scenario the session size follows the live session (SES-…-0024)', async () => {
    stubMatchMedia(true)
    const sim = mount('recording')
    await screen.findByTestId('page-storage', {}, PAGE_WAIT)
    const session = sim.store.getState().session
    expect(session?.state).toBe('RECORDING')
    const kpi = screen.getByTestId('storage-kpi-sessionSize')
    expect(kpi).toHaveTextContent(`${((session?.bytesWritten ?? 0) / 1e9).toFixed(2)}GB`)
    expect(kpi).toHaveTextContent(`${session?.id} · live`)
    expect(kpi).toHaveAttribute('data-live', 'true')
  })

  it('STORAGE_FULL escalates the ring and banner to FULL and raises a toast (AC-65 storage part, M-PG-STOR)', async () => {
    stubMatchMedia(true)
    const sim = mount()
    await screen.findByTestId('page-storage', {}, PAGE_WAIT)
    expect(screen.getByTestId('storage-ring-wrap')).toHaveAttribute('data-state', 'READY')
    act(() => {
      sim.actions.inject('STORAGE_FULL')
    })
    await waitFor(() => expect(screen.getByTestId('storage-ring-wrap')).toHaveAttribute('data-state', 'FULL'))
    expect(screen.getByTestId('storage-banner')).toHaveTextContent('Storage full. Recording is blocked.')
    expect(screen.getByTestId('storage-state-chip')).toHaveTextContent('FULL')
    expect(await screen.findByText('Evidence storage is full')).toBeInTheDocument()
    // The FAULT_RAISED storage event joins the activity list (the storage-activity filter).
    expect(screen.getAllByTestId('storage-activity-row')[0]).toHaveTextContent('Fault raised · Storage full')
    expect(getMissingI18nKeys()).toEqual([])
  })

  it('the retention calculator applies the §10.2 formula and reacts to its inputs', async () => {
    stubMatchMedia(true)
    mount()
    await screen.findByTestId('page-storage', {}, PAGE_WAIT)
    const calc = screen.getByTestId('storage-panel-calculator')
    // Book example (2 × 8 Mbps + 2.304 Mbps audio), 4 h/day, 90 days, overhead × 1.10.
    expect(within(calc).getByTestId('storage-calc-out-totalBitrate')).toHaveTextContent('18.3Mbps')
    expect(within(calc).getByTestId('storage-calc-out-gbPerHour')).toHaveTextContent('8.24GB/h')
    expect(within(calc).getByTestId('storage-calc-out-gbPerDay')).toHaveTextContent('32.9GB')
    expect(within(calc).getByTestId('storage-formula')).toHaveTextContent('= 3.26 TB')
    expect(within(calc).getByTestId('storage-calc-meter')).toHaveAttribute('aria-valuetext', '82% of the 4.0 TB evidence volume')
    expect(within(calc).getByTestId('storage-calc-verdict')).toHaveTextContent('covers about 110 days')

    // 8 recording hours a day: 65.9 GB/day, 6.52 TB for 90 days → over capacity.
    const hours = within(within(calc).getByTestId('storage-calc-hoursPerDay')).getByRole('textbox')
    fireEvent.change(hours, { target: { value: '8' } })
    fireEvent.blur(hours)
    await waitFor(() => expect(within(calc).getByTestId('storage-calc-out-gbPerDay')).toHaveTextContent('65.9GB'))
    expect(within(calc).getByTestId('storage-calc-verdict')).toHaveTextContent('Exceeds the evidence volume by 2.52 TB')
    expect(within(calc).getByTestId('storage-calc-meter')).toHaveAttribute('data-tone', 'danger')

    fireEvent.click(within(calc).getByTestId('storage-calc-reset'))
    await waitFor(() => expect(within(calc).getByTestId('storage-calc-out-gbPerDay')).toHaveTextContent('32.9GB'))
  })

  it('Manage Storage is SUPERVISOR or TECHNICIAN only: an INVESTIGATOR sees Apply disabled with the roles (F-49-1)', async () => {
    stubMatchMedia(true)
    mount()
    await screen.findByTestId('page-storage', {}, PAGE_WAIT)
    fireEvent.click(screen.getByTestId('storage-manage-open'))
    const drawer = await screen.findByTestId('storage-manage-drawer')
    expect(within(drawer).getByTestId('storage-policy-rbac')).toHaveTextContent('Requires the Supervisor / Technician role')
    fireEvent.click(within(within(drawer).getByTestId('storage-policy-select')).getByRole('button'))
    fireEvent.click(await screen.findByRole('option', { name: '1 year' }))
    expect(within(drawer).getByTestId('storage-policy-apply')).toBeDisabled()
    expect(getMissingI18nKeys()).toEqual([])
  })

  it('Manage Storage applies a policy through the simulator, audited, and the page follows it', async () => {
    stubMatchMedia(true)
    // Step 54 (F-49-1): the simulator lets a SUPERVISOR or TECHNICIAN change the retention policy.
    const sim = mount('idle', OPERATOR_IDS.RINA)
    await screen.findByTestId('page-storage', {}, PAGE_WAIT)
    fireEvent.click(screen.getByTestId('storage-manage-open'))
    const drawer = await screen.findByTestId('storage-manage-drawer')
    const apply = within(drawer).getByTestId('storage-policy-apply')
    expect(apply).toBeDisabled() // nothing changed yet

    // Retention policy: 1 year.
    fireEvent.click(within(within(drawer).getByTestId('storage-policy-select')).getByRole('button'))
    fireEvent.click(await screen.findByRole('option', { name: '1 year' }))
    // Auto-archive off.
    fireEvent.click(within(drawer).getByRole('switch'))
    await waitFor(() => expect(apply).not.toBeDisabled())
    fireEvent.click(apply)

    await waitFor(() =>
      expect(sim.store.getState().storagePolicy).toEqual({ retentionPolicy: 'YEAR_1', retentionDays: 365, autoArchive: false }),
    )
    expect(sim.store.getState().audit.rows.at(-1)?.type).toBe('STORAGE_POLICY_CHANGED')
    expect(await screen.findByText('Storage policy updated (simulated)')).toBeInTheDocument()
    await waitFor(() => expect(screen.getByTestId('storage-kpi-retentionDays')).toHaveTextContent('365days'))
    expect(screen.getByTestId('storage-policy-retention')).toHaveTextContent('1 year')
    // The calculator follows the new retention, and the activity list shows the change first.
    expect(screen.getByTestId('storage-formula')).toHaveTextContent('× 365 days')
    expect(screen.getAllByTestId('storage-activity-row')[0]).toHaveTextContent('Storage policy changed')
    expect(screen.getAllByTestId('storage-activity-row')[0]).toHaveTextContent('365 days · auto-archive off')
    expect(getMissingI18nKeys()).toEqual([])
  })
})
