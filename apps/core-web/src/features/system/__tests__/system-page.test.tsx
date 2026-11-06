// Step 52 System & Maintenance page tests (masterplan/01_specs.md §14.5.8; AC-65 in unit form; AC-66).
// Each test builds the real router (route tree, guard, providers, shell) around its own simulator
// with in-memory storage, a manual clock and no engine ticks, exactly like the storage page tests.
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
  evaluatePrecheck,
  OPERATOR_IDS,
  SimPermissionError,
  type ControllableClock,
  type ScenarioName,
  type Sim,
} from '@dems/shared/sim'
import { SHELL_INTRO_STORAGE_KEY } from '@/components/shell/shell-entrance'
import { getMissingI18nKeys, resetMissingI18nKeys } from '@/i18n'
import { PRESENTATION_MODE_STORAGE_KEY, resetPresentationModeForTests } from '@/lib/presentation-mode'
import { REDUCED_MOTION_STORAGE_KEY } from '@/motion'
import { createAppRouter } from '@/router'
import { DEMO_CONTROLS_STORAGE_KEY } from '../sim-adapter'

const PAGE_WAIT = { timeout: 10_000 }
const PANEL_IDS = ['quick', 'services', 'health', 'update', 'maintenance', 'about', 'settings', 'demo'] as const

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

function mount(options: { scenario?: ScenarioName; operatorId?: string } = {}): { sim: Sim; clock: ControllableClock } {
  const clock = createManualClock(Date.now())
  const authStorage = createMemoryAuthStorage()
  authStorage.save({ operatorId: options.operatorId ?? OPERATOR_IDS.BUDI, issuedAt: clock.now() })
  const sim = createSim({
    storage: null,
    authStorage,
    clock,
    visibility: ALWAYS_VISIBLE,
    scheduler: () => () => undefined, // no engine ticks: the tests drive state and time directly
    scenario: options.scenario ?? 'idle',
  })
  sims.push(sim)
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const router = createAppRouter(
    { sim, queryClient, socketFactory: () => new SilentSocket() },
    { history: createMemoryHistory({ initialEntries: ['/system'] }) },
  )
  render(<RouterProvider router={router} />)
  return { sim, clock }
}

async function openDemoPanel() {
  const page = await screen.findByTestId('page-system', {}, PAGE_WAIT)
  const demo = within(page).getByTestId('system-panel-demo')
  fireEvent.click(within(within(demo).getByTestId('system-demo-toggle')).getByRole('switch'))
  return within(await within(demo).findByTestId('system-demo-body'))
}

function lastAudit(sim: Sim) {
  return sim.store.getState().audit.rows.at(-1)
}

Element.prototype.scrollTo ??= function scrollTo() {}
Element.prototype.scrollIntoView ??= function scrollIntoView() {}
window.scrollTo = (() => undefined) as typeof window.scrollTo

beforeEach(() => {
  resetMissingI18nKeys()
  window.sessionStorage.setItem(SHELL_INTRO_STORAGE_KEY, '1')
  window.sessionStorage.removeItem(DEMO_CONTROLS_STORAGE_KEY)
  window.sessionStorage.removeItem(PRESENTATION_MODE_STORAGE_KEY)
  window.localStorage.removeItem(REDUCED_MOTION_STORAGE_KEY)
  resetPresentationModeForTests()
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(JSON.stringify(health), { status: 200 })),
  )
})

afterEach(() => {
  cleanup()
  for (const sim of sims.splice(0)) sim.stop()
  window.sessionStorage.removeItem(SHELL_INTRO_STORAGE_KEY)
  window.localStorage.removeItem(REDUCED_MOTION_STORAGE_KEY)
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('System & Maintenance page (01_specs §14.5.8)', { timeout: 30_000 }, () => {
  it('renders page-system with the banner, every panel and the 17 services inside the shell, with 0 missing keys', async () => {
    mount()
    const page = await screen.findByTestId('page-system', {}, PAGE_WAIT)
    expect(screen.getByRole('main')).toContainElement(page)
    expect(within(page).getByRole('heading', { level: 1 })).toHaveTextContent('SYSTEM & MAINTENANCE')
    for (const id of PANEL_IDS) expect(within(page).getByTestId(`system-panel-${id}`)).toBeInTheDocument()
    expect(within(page).getByTestId('system-banner')).toHaveTextContent('All core services running')
    expect(within(page).getByTestId('system-banner')).toHaveTextContent('17 of 17 running · v2.4.1 · slot A')
    expect(within(page).getAllByTestId(/^system-service-SVC-/)).toHaveLength(17)
    expect(within(page).getByTestId('system-service-SVC-01')).toHaveTextContent('API Gateway')
    expect(within(page).getByTestId('system-uptime-SVC-01').textContent).toMatch(/^(\d+d )?\d{2}:\d{2}:\d{2}$/)
    expect(within(page).getByTestId('system-about-deviceId')).toHaveTextContent('DEMS-IR-01')
    expect(within(page).getByTestId('system-about-release')).toHaveTextContent('v2.4.1')
    expect(within(page).getByTestId('system-update-current')).toHaveTextContent('v2.4.1')
    expect(within(page).getByTestId('system-drift')).toHaveTextContent('None detected')
    // The Demo Control Panel is collapsed on entry (M-PG-SYS) and labelled DEMO.
    expect(within(page).getByTestId('system-demo-badge')).toHaveTextContent('DEMO')
    expect(within(page).queryByTestId('system-demo-body')).toBeNull()
    expect(getMissingI18nKeys()).toEqual([])
  })

  it('AC-65: "MIC 2 clip" then "Storage full" latch CLIP, write AUDIO_CLIP, raise toasts and make Storage FULL (pre-check BLOCK)', async () => {
    const { sim } = mount()
    const demo = await openDemoPanel()

    fireEvent.click(demo.getByTestId('system-demo-fault-MIC_CLIP'))
    let state = sim.store.getState()
    expect(state.mics.find((mic) => mic.id === 'AUDIO-02')?.clipLatched).toBe(true)
    expect(state.faults.active.some((fault) => fault.kind === 'MIC_CLIP' && fault.target === 'AUDIO-02')).toBe(true)
    expect(lastAudit(sim)?.type).toBe('FAULT_RAISED')
    expect(lastAudit(sim)?.details.eventKind).toBe('AUDIO_CLIP')
    expect(await screen.findByText('MIC 2 clip injected')).toBeInTheDocument()
    expect(screen.getByText('Audit: Fault raised · Audio clip')).toBeInTheDocument()
    expect(demo.getByTestId('system-demo-fault-MIC_CLIP')).toHaveAttribute('aria-pressed', 'true')
    // Every open panel reacts: the Audio Capture Service degrades and the banner escalates.
    await waitFor(() => expect(screen.getByTestId('system-service-SVC-06')).toHaveAttribute('data-status', 'DEGRADED'))
    expect(screen.getByTestId('system-banner')).toHaveTextContent('1 service needs attention')
    expect(demo.getByTestId('system-demo-audit')).toHaveTextContent('Fault raised')
    expect(demo.getByTestId('system-demo-audit')).toHaveTextContent('Audio clip')

    fireEvent.click(demo.getByTestId('system-demo-fault-STORAGE_FULL'))
    state = sim.store.getState()
    expect(state.storage.state).toBe('FULL')
    expect(evaluatePrecheck(state, 'STORAGE').status).toBe('BLOCK')
    expect(evaluatePrecheck(state, 'MIC_2').status).toBe('WARN')
    expect(lastAudit(sim)?.details.kind).toBe('STORAGE_FULL')
    expect(await screen.findByText('Storage full injected')).toBeInTheDocument()

    // Toggling MIC 2 clip off clears the fault and the latch (FAULT_CLEARED row).
    fireEvent.click(demo.getByTestId('system-demo-fault-MIC_CLIP'))
    state = sim.store.getState()
    expect(state.mics.find((mic) => mic.id === 'AUDIO-02')?.clipLatched).toBe(false)
    expect(state.faults.active.some((fault) => fault.kind === 'MIC_CLIP')).toBe(false)
    expect(state.audit.rows.some((row) => row.type === 'FAULT_CLEARED' && row.details.kind === 'MIC_CLIP')).toBe(true)
    expect(getMissingI18nKeys()).toEqual([])
  })

  it('injects every other fault kind and walks the GNSS → NTP → RTC fallback, each with an audit row', async () => {
    const { sim } = mount()
    const demo = await openDemoPanel()
    const kinds = ['CAMERA_LOSS', 'MIC_NO_SIGNAL', 'STORAGE_LOW', 'FAN_STALL', 'TAMPER', 'TPM_FAILURE', 'SECURITY_FAULT', 'AUDIT_TAMPER', 'POWER_FAIL'] as const
    for (const kind of kinds) {
      const before = sim.store.getState().audit.total
      fireEvent.click(demo.getByTestId(`system-demo-fault-${kind}`))
      const state = sim.store.getState()
      expect(state.faults.active.some((fault) => fault.kind === kind), kind).toBe(true)
      expect(state.audit.total, kind).toBeGreaterThan(before)
    }
    expect(screen.getByTestId('system-demo-active-count')).toHaveTextContent('9 faults active')

    fireEvent.click(demo.getByTestId('system-demo-time-NTP'))
    expect(sim.store.getState().time.source).toBe('NTP')
    fireEvent.click(demo.getByTestId('system-demo-time-RTC'))
    expect(sim.store.getState().time.source).toBe('RTC')
    expect(lastAudit(sim)?.details.kind).toBe('GNSS_LOSS')
    fireEvent.click(demo.getByTestId('system-demo-time-GNSS'))
    expect(sim.store.getState().time.source).toBe('GNSS')

    fireEvent.click(demo.getByTestId('system-demo-clear-all'))
    expect(sim.store.getState().faults.active).toEqual([])
  })

  it('loads a scenario and resets the demo through loadScenario, writing SCENARIO_LOADED', async () => {
    const { sim } = mount()
    const demo = await openDemoPanel()
    fireEvent.click(within(demo.getByTestId('system-demo-scenario')).getByRole('button'))
    fireEvent.click(await screen.findByRole('option', { name: 'Recording' }))
    fireEvent.click(demo.getByTestId('system-demo-load'))
    expect(sim.store.getState().session?.state).toBe('RECORDING')
    expect(lastAudit(sim)?.type).toBe('SCENARIO_LOADED')
    expect(await screen.findByText('Recording scenario loaded')).toBeInTheDocument()
    // The update is refused during a session; the Technician-only button is disabled anyway.

    fireEvent.click(demo.getByTestId('system-demo-fault-STORAGE_FULL'))
    expect(sim.store.getState().session?.state).toBe('FAULT')
    expect(await demo.findByTestId('system-demo-recover')).toBeInTheDocument()

    fireEvent.click(demo.getByTestId('system-demo-reset'))
    const state = sim.store.getState()
    expect(state.session).toBeNull()
    expect(state.faults.active).toEqual([])
    expect(state.meta.scenario).toBe('idle')
    expect(lastAudit(sim)?.type).toBe('SCENARIO_LOADED')
    expect(await screen.findByText('Demo reset: idle scenario, faults cleared')).toBeInTheDocument()
  })

  it('turns a SimPermissionError from the sim into a "Requires the … role" toast, never raw sim text', async () => {
    const { sim } = mount()
    const demo = await openDemoPanel()
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    vi.spyOn(sim.actions, 'inject').mockImplementation(() => {
      throw new SimPermissionError('inject', 'MAINTENANCE')
    })
    fireEvent.click(demo.getByTestId('system-demo-fault-FAN_STALL'))
    expect(await screen.findByText('Not permitted')).toBeInTheDocument()
    // The toast's description (wave J: the same sentence also stands, visibly, beside the page's disabled controls).
    expect(screen.getAllByText('Requires the Technician role').some((node) => node.closest('.dems-role-reason') === null)).toBe(true)
    expect(screen.queryByText(/needs permission/)).toBeNull()
    expect(sim.store.getState().faults.active).toEqual([])
  })

  it('Run Diagnostics opens the Modal, resolves 8 checks in sequence and ends with the summary Alert', async () => {
    const { sim, clock } = mount()
    const page = await screen.findByTestId('page-system', {}, PAGE_WAIT)
    fireEvent.click(within(page).getByTestId('system-quick-runDiagnostics'))
    const modal = await screen.findByTestId('system-diagnostics-modal')
    expect(within(modal).getAllByTestId(/^system-diag-/)).toHaveLength(8)
    expect(within(modal).getByTestId('system-diag-CPU')).toHaveAttribute('data-status', 'RUNNING')
    expect(lastAudit(sim)?.type).toBe('DIAGNOSTICS_RUN')
    for (let step = 0; step < 12; step += 1) {
      act(() => {
        clock.advance(600)
        sim.tick()
      })
    }
    expect(sim.store.getState().diagnostics?.completedAt).not.toBeNull()
    expect(await within(modal).findByTestId('system-diagnostics-summary')).toHaveTextContent('All checks passed')
    expect(within(modal).getByTestId('system-diag-SECURITY')).toHaveAttribute('data-status', 'PASS')
    expect(within(page).getByTestId('system-diagnostics-last')).toHaveTextContent('All checks passed')
  })

  it('gates update and restart on MAINTENANCE for an Investigator (S20)', async () => {
    mount()
    const page = await screen.findByTestId('page-system', {}, PAGE_WAIT)
    expect(within(page).getByTestId('system-update-install')).toBeDisabled()
    // Fix wave J (JW-14): the reason of each disabled control is VISIBLE beside it (it lived in a tooltip).
    expect(within(within(page).getByTestId('system-update-locked')).getByTestId('role-reason')).toHaveTextContent('Requires the Technician role')
    expect(within(page).getByTestId('system-restart-services')).toBeDisabled()
    expect(within(page).getByTestId('system-export-logs')).toBeDisabled()
    const gates = within(page).getAllByTestId('system-rbac-gate')
    expect(gates.map((gate) => gate.getAttribute('data-permission')).sort()).toEqual(['AUDIT_EXPORT', 'MAINTENANCE'])
    expect(gates.map((gate) => within(gate).getByTestId('role-reason').textContent).sort()).toEqual(['Requires the Supervisor role', 'Requires the Technician role'])
    expect(within(page).getByTestId('system-run-diagnostics')).toBeEnabled()
  })

  it('lets a Technician restart services (audited) and run the A/B update to v2.5.0 on slot B', async () => {
    const { sim, clock } = mount({ operatorId: OPERATOR_IDS.RINA })
    const page = await screen.findByTestId('page-system', {}, PAGE_WAIT)
    fireEvent.click(within(page).getByTestId('system-restart-services'))
    const restart = lastAudit(sim)
    expect(restart?.type).toBe('DEVICE_COMMAND')
    expect(restart?.details.scope).toBe('CORE_SERVICES')
    expect(restart?.actorId).toBe(OPERATOR_IDS.RINA)
    expect(sim.actions.verifyAuditChain().ok).toBe(true)
    expect(await screen.findByText('Core services restarted (simulated)')).toBeInTheDocument()
    expect(within(page).getByTestId('system-uptime-SVC-01')).toHaveTextContent('00:00:00')

    // Fix wave J (JT-06 / JW-06; truth rule 3e): "Install update" asks first, naming the version, the slot and the restart.
    fireEvent.click(within(page).getByTestId('system-update-install'))
    expect(sim.store.getState().update.state).not.toBe('RUNNING')
    const confirm = await screen.findByTestId('system-update-confirm')
    expect(confirm).toHaveTextContent('Install v2.5.0?')
    expect(within(confirm).getByTestId('system-update-confirm-body')).toHaveTextContent('inactive slot B')
    expect(confirm).toHaveTextContent(/restarts into the new slot/)
    // Cancel starts nothing.
    fireEvent.click(within(confirm).getByTestId('system-update-confirm-cancel'))
    await waitFor(() => expect(screen.queryByTestId('system-update-confirm')).toBeNull())
    expect(sim.store.getState().update.state).not.toBe('RUNNING')
    fireEvent.click(within(page).getByTestId('system-update-install'))
    fireEvent.click(within(await screen.findByTestId('system-update-confirm')).getByTestId('system-update-confirm-install'))
    expect(sim.store.getState().update.state).toBe('RUNNING')
    expect(await screen.findByText('Installing v2.5.0 (simulated)')).toBeInTheDocument()
    expect(within(page).getByTestId('system-slot-B')).toHaveAttribute('data-target', 'true')
    for (let step = 0; step < 14; step += 1) {
      act(() => {
        clock.advance(1000)
        sim.tick()
      })
    }
    const update = sim.store.getState().update
    expect(update.state).toBe('PASS')
    expect(update.currentVersion).toBe('2.5.0')
    expect(update.activeSlot).toBe('B')
    await waitFor(() => expect(within(page).getByTestId('system-update-current')).toHaveTextContent('v2.5.0'))
    expect(within(page).getByTestId('system-slot-B')).toHaveAttribute('data-active', 'true')
    expect(within(page).getByTestId('system-slot-A')).toHaveTextContent('v2.4.1')
    expect(within(page).getByTestId('system-drift')).toHaveTextContent('None detected')
    expect(await screen.findByText('Update installed: v2.5.0 on slot B')).toBeInTheDocument()
  })

  it('binds Reduce motion to setReducedOverride (D59) and Presentation mode to lib/presentation-mode (D74)', async () => {
    mount()
    const page = await screen.findByTestId('page-system', {}, PAGE_WAIT)
    fireEvent.click(within(within(page).getByTestId('system-reduce-motion')).getByRole('switch'))
    await waitFor(() => expect(document.documentElement.dataset.motion).toBe('reduced'))
    expect(window.localStorage.getItem(REDUCED_MOTION_STORAGE_KEY)).toBe('1')

    fireEvent.click(within(within(page).getByTestId('system-presentation-mode')).getByRole('switch'))
    expect(window.sessionStorage.getItem(PRESENTATION_MODE_STORAGE_KEY)).toBe('1')
    // The Demo Control Panel's switch follows the same flag.
    const demo = await openDemoPanel()
    expect(within(demo.getByTestId('system-demo-presentation')).getByRole('switch')).toBeChecked()
  })
})
