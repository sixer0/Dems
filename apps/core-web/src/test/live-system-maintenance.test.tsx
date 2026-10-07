/**
 * @vitest-environment jsdom
 * @vitest-environment-options { "url": "http://127.0.0.1:5178/" }
 */
// Plan row W76: settle sites A10 (Run Diagnostics), A11 (Restart services) and the Install command of
// B-10 (the update panel) of the System page in Live mode on the contract-checked fake transport, and
// the same controls in Simulated mode as the control group (backend task 04_client_integration_spec
// §8.2 A10, A11, §8.3 B-10, §8.1 LB-1 to LB-10, §6.2, AC-C-48; gate CLG (b) of 02_plan §11).
//
// | Criterion | Where it is proven here |
// |-----------|-------------------------|
// | A11 success: one POST to operation 66; the toast prints the Core's count after the answer and says nothing of a simulation | "A11 Restart services" |
// | A11 refusal, AC-C-48: the `notPermitted` 403 shows the denied toast naming the Technician role; 409 SESSION_ACTIVE keeps the friendly warning and one record | "A11 Restart services" |
// | A11 outage (LB-6) and limit (LB-10) | "A11 Restart services" |
// | A10 success: one POST to operation 65; the modal opens on the 202, its checks come from the `diagnostics` slice; no "SIMULATED" chip in Live mode | "A10 Run Diagnostics" |
// | A10 refusal and outage: the modal does not open, the control returns to idle | "A10 Run Diagnostics" |
// | B-10 Install: one POST to operation 67, the toast after the 202 without "(simulated)"; the 403 names the role; an outage | "B-10 Install" |
// | LB-1 / AC-C-57 / AC-C-58 on A11: two quick presses send one request, no spinner at 300 ms, the spinner at the reveal, nothing added outside the control | "pending" |
// | Simulated mode is unchanged: the synchronous restart and its "(simulated)" words, the modal with its chip | "Simulated mode is unchanged" |
import { act, cleanup, configure, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { toast } from '@heroui/react'
import { QueryClient } from '@tanstack/react-query'
import { createMemoryHistory, RouterProvider } from '@tanstack/react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AuthSessionInfo } from '@dems/shared/api'
import { en } from '@dems/shared/i18n'
import { LIVE_PENDING_REVEAL_MS, LiveLinkState } from '@dems/shared/live'
import { rateLimited, refusal, type FakeCommandOptions } from '@dems/shared/live/testing'
import type { SocketLike } from '@dems/shared/realtime'
import {
  ALWAYS_VISIBLE,
  createManualClock,
  createMemoryAuthStorage,
  createSim,
  OPERATOR_IDS,
  OPERATORS,
  ROLE_PERMISSIONS,
  type DiagnosticsRun,
  type Sim,
} from '@dems/shared/sim'
import { SHELL_INTRO_STORAGE_KEY } from '@/components/shell/shell-entrance'
import { getMissingI18nKeys, resetMissingI18nKeys } from '@/i18n'
import { resetCoreErrorPresenter } from '@/lib/core-errors'
import { createAppRouter } from '@/router'
import { webErrorSink } from '@/runtime'
import { createLiveTestBed, SUPERVISOR_SESSION, type LivePage, type LiveTestBed } from '@/runtime/testing/live-harness'

// The page is a lazily loaded chunk: under load the first import can take longer than the library's second.
configure({ asyncUtilTimeout: 8_000 })
vi.setConfig({ testTimeout: 30_000 })

const RINA = OPERATORS.find((operator) => operator.id === OPERATOR_IDS.RINA)!
/** The seeded TECHNICIAN: holds MAINTENANCE (restart, install) and DIAGNOSTICS_RUN. */
const TECHNICIAN_SESSION: Pick<AuthSessionInfo, 'operator' | 'permissions'> = {
  operator: { id: RINA.id, username: RINA.username, rank: RINA.rank, name: RINA.name, displayName: RINA.displayName, initials: RINA.initials, role: RINA.role },
  permissions: [...ROLE_PERMISSIONS.TECHNICIAN],
}

const S = en.system
const DENIED = en.common.rbac.deniedTitle
const REQUIRES = (role: string) => en.common.rbac.requiresRole.replace('{{role}}', role)
const OFFLINE = en.common.coreErrors.offline
const LIMITED = (seconds: number) => en.common.coreErrors.limited.replace('{{seconds}}', String(seconds))
const RESTART_BODY = (count: number) => S.maintenance.restartBody.replace('{{count}}', String(count))
const LIVE_STARTED = (version: string) => S.live.startedToast.replace('{{version}}', version)

const originalMatchMedia = window.matchMedia
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

Element.prototype.scrollIntoView ??= function scrollIntoView() {}

let bed: LiveTestBed | undefined

/** A signed-in operator on the System page in Live mode. */
async function liveSystem(session: Pick<AuthSessionInfo, 'operator' | 'permissions'> = TECHNICIAN_SESSION): Promise<{ bed: LiveTestBed; page: LivePage }> {
  const created = createLiveTestBed({ session })
  bed = created
  const page = await created.load()
  await created.mount(page, '/system')
  await screen.findByTestId('page-system')
  await screen.findByTestId('system-restart-services')
  return { bed: created, page }
}

const requests = (operationId: string) => bed!.fake.log.requestsOf(operationId)
const records = (source: string) => webErrorSink.records().filter((record) => record.source === source)
const restartButton = () => screen.getByTestId('system-restart-services')
const runButton = () => screen.getByTestId('system-run-diagnostics')
const installButton = () => screen.getByTestId('system-update-install')

/** The Core's `diagnostics` slice for a run that has just started: the first check RUNNING, the others PENDING. */
function runningDiagnostics(id: string): DiagnosticsRun {
  const ids = ['CPU', 'STORAGE', 'FAN', 'NETWORK', 'CAMERA', 'AUDIO', 'TIME', 'SECURITY'] as const
  return {
    id,
    startedAt: bed!.fake.clock.now(),
    completedAt: null,
    checks: ids.map((check, index) => ({ id: check, label: check, status: index === 0 ? 'RUNNING' : 'PENDING', detail: null })),
  } as unknown as DiagnosticsRun
}

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

describe('A11 Restart services (§8.2 A11; B-10)', () => {
  it('success: one POST to operation 66; the toast prints the Core\'s count after the answer, without "(simulated)"', async () => {
    const { bed } = await liveSystem()
    bed.fake.answerOnce('restartServices', { status: 200, body: { restarted: 16 } })
    expect(screen.getByTestId('system-panel-maintenance')).toHaveTextContent(S.live.restartHint)
    fireEvent.click(restartButton())
    await waitFor(() => expect(toastWith(S.live.restartDone)).toHaveLength(1))
    expect(toastWith(S.live.restartDone)[0]).toContain(RESTART_BODY(16))
    expect(requests('restartServices')).toHaveLength(1)
    expect(requests('restartServices')[0]).toMatchObject({ method: 'POST', path: '/api/v1/system/services/restart' })
    expect(toastTexts().join(' ')).not.toMatch(/simulat/i)
    expect(screen.getByTestId('system-panel-maintenance').textContent ?? '').not.toMatch(/simulat/i)
    expect(restartButton()).not.toHaveAttribute('aria-busy')
    expect(getMissingI18nKeys()).toEqual([])
  })

  it('AC-C-48: the `notPermitted` 403 shows the denied toast naming the Technician role; no success toast; the control returns to idle', async () => {
    const { bed } = await liveSystem()
    bed.fake.answerOnce('restartServices', bed.fake.example('restartServices', 403, 'notPermitted'))
    fireEvent.click(restartButton())
    await waitFor(() => expect(toastWith(DENIED)).toHaveLength(1))
    expect(toastWith(DENIED)[0]).toContain(REQUIRES(en.common.roles.TECHNICIAN))
    expect(toastWith(S.live.restartDone)).toHaveLength(0)
    expect(restartButton()).not.toHaveAttribute('aria-busy')
    // The presenter worded it: the page wrote no record of its own (CL-24).
    expect(records('System.Maintenance.restart')).toHaveLength(0)
    expect(requests('restartServices')).toHaveLength(1)
  })

  it('409 SESSION_ACTIVE (rebuilt as `SimTransitionError`) keeps the friendly warning and writes one record with code and status only', async () => {
    const { bed } = await liveSystem()
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    bed.fake.answerOnce('restartServices', bed.fake.example('restartServices', 409, 'sessionActive'))
    fireEvent.click(restartButton())
    await waitFor(() => expect(toastWith(S.maintenance.restartBlocked)).toHaveLength(1))
    expect(toastWith(DENIED)).toHaveLength(0)
    expect(toastWith(OFFLINE)).toHaveLength(0)
    const kept = records('System.Maintenance.restart')
    expect(kept).toHaveLength(1)
    expect(kept[0]).toMatchObject({ level: 'warn', message: 'System: the step "Maintenance.restart" did not complete.' })
    expect(kept[0]?.context).toMatchObject({ errorName: 'SimTransitionError', code: 'SESSION_ACTIVE' })
    expect(String(kept[0]?.context?.correlationId)).toMatch(/^sys-/)
    expect(JSON.stringify(kept[0])).not.toMatch(/stack/i)
  })

  it('an outage shows the presenter\'s sentence and no success toast; with the link down five presses send nothing and show one toast', async () => {
    const { bed, page } = await liveSystem()
    bed.fake.failOnce('restartServices')
    fireEvent.click(restartButton())
    await waitFor(() => expect(toastWith(OFFLINE)).toHaveLength(1))
    expect(toastWith(S.live.restartDone)).toHaveLength(0)
    expect(requests('restartServices')).toHaveLength(1)
    expect(restartButton()).not.toHaveAttribute('aria-busy')

    await clearToasts()
    resetCoreErrorPresenter()
    bed.core.unreachable()
    await bed.flush()
    expect(page.live.link).toBe(LiveLinkState.OFFLINE)
    for (let press = 0; press < 5; press += 1) {
      fireEvent.click(restartButton())
      await bed.flush()
    }
    await waitFor(() => expect(toastWith(OFFLINE)).toHaveLength(1))
    expect(requests('restartServices')).toHaveLength(1)
  })

  it('LB-10: a 429 is a limit with the seconds of `retry-after`, never the outage sentence', async () => {
    const { bed, page } = await liveSystem()
    bed.fake.answerOnce('restartServices', rateLimited(9))
    fireEvent.click(restartButton())
    await waitFor(() => expect(toastWith(LIMITED(9))).toHaveLength(1))
    expect(toastWith(OFFLINE)).toHaveLength(0)
    expect(page.live.link).toBe(LiveLinkState.ONLINE)
  })
})

describe('A10 Run Diagnostics (§8.2 A10)', () => {
  it('success: one POST to operation 65; the modal opens on the 202 and its checks come from the Core\'s `diagnostics` slice; no SIMULATED chip', async () => {
    const { bed } = await liveSystem()
    bed.fake.scriptCommand('runDiagnostics', {
      ops: [{ op: 'replace', slice: 'diagnostics', value: runningDiagnostics('DIAG-000042') }] as FakeCommandOptions['ops'],
      order: 'delta-first',
      answer: { status: 202, body: { runId: 'DIAG-000042' } },
    })
    expect(screen.queryByTestId('system-diagnostics-modal')).toBeNull()
    fireEvent.click(runButton())
    const modal = await screen.findByTestId('system-diagnostics-modal')
    expect(requests('runDiagnostics')).toHaveLength(1)
    expect(requests('runDiagnostics')[0]).toMatchObject({ method: 'POST', path: '/api/v1/system/diagnostics' })
    expect(within(modal).getAllByTestId(/^system-diag-/)).toHaveLength(8)
    expect(within(modal).getByTestId('system-diag-CPU')).toHaveAttribute('data-status', 'RUNNING')
    expect(modal).toHaveTextContent(S.diagnostics.running)
    expect(modal.textContent ?? '').not.toMatch(/simulat/i)
    expect(screen.getByTestId('system-panel-maintenance')).toHaveTextContent(S.live.diagnosticsSubtitle)
    expect(runButton()).not.toHaveAttribute('aria-busy')
  })

  it('the quick-action card starts the same run: one request, the modal on the 202', async () => {
    const { bed } = await liveSystem()
    bed.fake.answerOnce('runDiagnostics', { status: 202, body: { runId: 'DIAG-000043' } })
    fireEvent.click(screen.getByTestId('system-quick-runDiagnostics'))
    await screen.findByTestId('system-diagnostics-modal')
    expect(requests('runDiagnostics')).toHaveLength(1)
  })

  it('AC-C-48: a 403 NOT_PERMITTED shows the denied toast naming the first role with DIAGNOSTICS_RUN; the modal does not open', async () => {
    const { bed } = await liveSystem()
    // Operation 65 has no `notPermitted` example (every seeded role holds DIAGNOSTICS_RUN; the RESIDUAL-W63-1 (W83 ledger #40) pattern): the envelope is written here.
    bed.fake.answerOnce('runDiagnostics', refusal(403, 'NOT_PERMITTED', 'Not permitted.', { permission: 'DIAGNOSTICS_RUN' }))
    fireEvent.click(runButton())
    await waitFor(() => expect(toastWith(DENIED)).toHaveLength(1))
    expect(toastWith(DENIED)[0]).toContain(REQUIRES(en.common.roles.INVESTIGATOR))
    expect(screen.queryByTestId('system-diagnostics-modal')).toBeNull()
    expect(runButton()).not.toHaveAttribute('aria-busy')
    expect(records('System.Diagnostics.start')).toHaveLength(0)
  })

  it('an outage: the presenter\'s sentence, no modal, the control idle again', async () => {
    const { bed } = await liveSystem()
    bed.fake.failOnce('runDiagnostics')
    fireEvent.click(runButton())
    await waitFor(() => expect(toastWith(OFFLINE)).toHaveLength(1))
    expect(screen.queryByTestId('system-diagnostics-modal')).toBeNull()
    expect(runButton()).not.toHaveAttribute('aria-busy')
  })
})

describe('B-10 Install (the update panel, operation 67)', () => {
  it('success: one POST; the "installing" toast follows the 202 and says nothing of a simulation', async () => {
    const { bed } = await liveSystem()
    const version = bed.core.served.update.availableVersion
    expect(version).toBeTruthy()
    bed.fake.answerOnce('startSoftwareUpdate', { status: 202 })
    expect(installButton()).toHaveTextContent(S.live.install)
    fireEvent.click(installButton())
    await waitFor(() => expect(toastWith(LIVE_STARTED(version!))).toHaveLength(1))
    expect(requests('startSoftwareUpdate')).toHaveLength(1)
    expect(requests('startSoftwareUpdate')[0]).toMatchObject({ method: 'POST', path: '/api/v1/system/update' })
    expect(toastTexts().join(' ')).not.toMatch(/simulat/i)
    expect(installButton()).not.toHaveAttribute('aria-busy')
  })

  it('AC-C-48: the `notPermitted` 403 names the Technician role; 409 SESSION_ACTIVE keeps the friendly warning', async () => {
    const { bed } = await liveSystem()
    bed.fake.answerOnce('startSoftwareUpdate', bed.fake.example('startSoftwareUpdate', 403, 'notPermitted'))
    fireEvent.click(installButton())
    await waitFor(() => expect(toastWith(DENIED)).toHaveLength(1))
    expect(toastWith(DENIED)[0]).toContain(REQUIRES(en.common.roles.TECHNICIAN))
    expect(toastWith(S.live.startedToast.split(' ')[0]!)).toHaveLength(0)

    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    bed.fake.answerOnce('startSoftwareUpdate', bed.fake.example('startSoftwareUpdate', 409, 'sessionActive'))
    fireEvent.click(installButton())
    await waitFor(() => expect(toastWith(S.update.blockedBySession)).toHaveLength(1))
    expect(records('System.UpdatePanel.install')).toHaveLength(1)
  })

  it('an outage: the presenter\'s sentence and no "installing" toast', async () => {
    const { bed } = await liveSystem()
    bed.fake.failOnce('startSoftwareUpdate')
    fireEvent.click(installButton())
    await waitFor(() => expect(toastWith(OFFLINE)).toHaveLength(1))
    expect(toastTexts().join(' ')).not.toContain('Installing')
  })

  it('a SUPERVISOR (no MAINTENANCE) sees Install and Restart disabled with the role named: the gates follow the replicated role', async () => {
    await liveSystem(SUPERVISOR_SESSION)
    expect(installButton()).toBeDisabled()
    expect(screen.getByTestId('system-update-locked')).toHaveAccessibleName(new RegExp(`^${S.live.install}: .*Technician`))
    expect(restartButton()).toBeDisabled()
  })
})

describe('pending (LB-1; AC-C-57, AC-C-58) on A11', () => {
  it('two quick presses send one request; no spinner at 300 ms; the in-button spinner at the reveal; nothing is added outside the pressed control', async () => {
    const { bed } = await liveSystem()
    const held = bed.fake.hold('restartServices')
    const panel = screen.getByTestId('system-panel-maintenance')
    const elementsBefore = panel.querySelectorAll('*').length
    const buttonChildrenBefore = restartButton().querySelectorAll('*').length

    fireEvent.click(restartButton())
    fireEvent.click(restartButton())
    await waitFor(() => expect(requests('restartServices')).toHaveLength(1))
    await bed.flush()
    // Busy at once: the busy mark on the pressed button, the look unchanged.
    expect(restartButton()).toHaveAttribute('aria-busy', 'true')
    expect(restartButton()).not.toHaveAttribute('data-pending')

    // 300 ms: still no spinner (real timers; the motion policy's time scale is 1 here).
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 300))
    })
    expect(restartButton()).not.toHaveAttribute('data-pending')
    expect(restartButton().querySelector('[data-slot="spinner"], .spinner, [role="progressbar"]')).toBeNull()

    // After the reveal time: the kit's pending state, the spinner inside the button.
    await waitFor(() => expect(restartButton()).toHaveAttribute('data-pending', 'true'), { timeout: LIVE_PENDING_REVEAL_MS * 4 })
    // AC-C-58: only the pressed control changed; the panel holds the same elements except the button's own spinner.
    expect(panel.querySelectorAll('*').length - elementsBefore).toBe(restartButton().querySelectorAll('*').length - buttonChildrenBefore)

    fireEvent.click(restartButton())
    await bed.flush()
    expect(requests('restartServices')).toHaveLength(1)

    await act(async () => {
      held.release({ status: 200, body: { restarted: 16 } })
    })
    await bed.flush()
    await waitFor(() => expect(toastWith(S.live.restartDone)).toHaveLength(1))
    expect(restartButton()).not.toHaveAttribute('aria-busy')
    expect(restartButton()).not.toHaveAttribute('data-pending')
    expect(panel.querySelectorAll('*').length).toBe(elementsBefore)
    expect(requests('restartServices')).toHaveLength(1)
  })

  it('an answer after 50 ms never shows a spinner', async () => {
    const { bed } = await liveSystem()
    const held = bed.fake.hold('restartServices')
    fireEvent.click(restartButton())
    await waitFor(() => expect(requests('restartServices')).toHaveLength(1))
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50))
      held.release({ status: 200, body: { restarted: 16 } })
    })
    await bed.flush()
    await waitFor(() => expect(toastWith(S.live.restartDone)).toHaveLength(1))
    expect(restartButton()).not.toHaveAttribute('data-pending')
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, LIVE_PENDING_REVEAL_MS + 100))
    })
    expect(restartButton()).not.toHaveAttribute('data-pending')
    expect(restartButton()).not.toHaveAttribute('aria-busy')
  })
})

// ── The control group: the same controls in Simulated mode, as before this row ─────────────────

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

async function simulatedSystem(operatorId: string): Promise<Sim> {
  const clock = createManualClock(Date.now())
  const authStorage = createMemoryAuthStorage()
  authStorage.save({ operatorId, issuedAt: clock.now() })
  const sim = createSim({ storage: null, authStorage, clock, visibility: ALWAYS_VISIBLE, scheduler: () => () => undefined, scenario: 'idle' })
  sims.push(sim)
  const router = createAppRouter(
    { sim, queryClient: new QueryClient({ defaultOptions: { queries: { retry: false } } }), socketFactory: () => new SilentSocket() },
    { history: createMemoryHistory({ initialEntries: ['/system'] }) },
  )
  render(<RouterProvider router={router} />)
  await screen.findByTestId('page-system')
  return sim
}

describe('Simulated mode is unchanged', () => {
  afterEach(() => {
    for (const sim of sims.splice(0)) sim.stop()
  })

  it('Restart answers in the press with the "(simulated)" words; Run Diagnostics opens the modal with its SIMULATED chip; no request is made', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 503 })))
    const sim = await simulatedSystem(OPERATOR_IDS.RINA)
    expect(screen.getByTestId('system-panel-maintenance')).toHaveTextContent(S.maintenance.restartHint)
    fireEvent.click(restartButton())
    // Synchronous: the audit row is written in the press.
    expect(sim.store.getState().audit.rows.at(-1)?.type).toBe('DEVICE_COMMAND')
    expect(restartButton()).not.toHaveAttribute('aria-busy')
    await waitFor(() => expect(toastWith(S.maintenance.restartDone)).toHaveLength(1))

    fireEvent.click(runButton())
    const modal = await screen.findByTestId('system-diagnostics-modal')
    expect(sim.store.getState().audit.rows.at(-1)?.type).toBe('DIAGNOSTICS_RUN')
    expect(modal).toHaveTextContent(en.common.simulated.chip)
    expect(modal).toHaveTextContent(S.diagnostics.running)
    expect(screen.getByTestId('system-panel-maintenance')).toHaveTextContent(S.diagnostics.subtitle)
    expect(installButton()).toHaveTextContent(S.update.install)
    vi.unstubAllGlobals()
  })
})
