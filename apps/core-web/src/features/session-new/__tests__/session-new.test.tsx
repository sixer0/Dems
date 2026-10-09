// Step 46: Start New Session flow. Validation (sessionCreateSchema, D62), the §5.3 gate (BLOCK
// blocks Next, WARN needs the acknowledgement), and the happy path to RECORDING on /session with
// SESSION_CREATED, PRECHECK_PASSED and RECORDING_STARTED in the audit (AC-62 unit form, fake
// timers). Every test builds the real router (guards, providers, shell) around its own simulator
// with in-memory storage (D54(a)) and a heartbeat socket that never connects, as the step-38 route
// tests and the step-44 Session Monitor tests do.
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { QueryClient } from '@tanstack/react-query'
import { createMemoryHistory, RouterProvider } from '@tanstack/react-router'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import type { SocketLike } from '@dems/shared/realtime'
import { SESSION_CREATE_MESSAGES } from '@dems/shared/api'
import {
  ALWAYS_VISIBLE,
  createManualClock,
  createMemoryAuthStorage,
  createSim,
  OPERATOR_IDS,
  PRECHECK_TOTAL_MAX_MS,
  type ScenarioName,
  type Sim,
  type SimScheduler,
} from '@dems/shared/sim'
import { getMissingI18nKeys, i18n, resetMissingI18nKeys } from '@/i18n'
import { createAppRouter } from '@/router'

// Full-router renders with lazy route chunks on a shared, busy host (P9/P11).
vi.setConfig({ testTimeout: 60_000 })

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
/** The step-92/93 --as-of (10:00 WIB): case numbers read LP/2026/1001-NNNN. */
const AS_OF = Date.parse('2026-10-01T03:00:00.000Z')

interface Mounted {
  sim: Sim
  router: ReturnType<typeof createAppRouter>
  /** Starts the fake-timer engine: the manual clock advances 50 ms per 50 ms engine tick. */
  startEngine: () => void
  flush: (ms: number) => Promise<void>
}

function mount({ scenario = 'idle', path = '/session/new' }: { scenario?: ScenarioName; path?: string } = {}): Mounted {
  const clock = createManualClock(AS_OF)
  let engineTick: (() => void) | null = null
  const scheduler: SimScheduler = (tick) => {
    engineTick = tick
    return () => {
      engineTick = null
    }
  }
  const authStorage = createMemoryAuthStorage()
  authStorage.save({ operatorId: OPERATOR_IDS.BUDI, issuedAt: AS_OF })
  const sim = createSim({ scenario, storage: null, authStorage, visibility: ALWAYS_VISIBLE, scheduler, clock })
  sims.push(sim)
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const router = createAppRouter({ sim, queryClient, socketFactory: () => new SilentSocket() }, { history: createMemoryHistory({ initialEntries: [path] }) })
  render(<RouterProvider router={router} />)
  return {
    sim,
    router,
    startEngine() {
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] })
      setInterval(() => {
        clock.advance(50)
        engineTick?.()
      }, 50)
    },
    async flush(ms: number) {
      await act(async () => {
        await vi.advanceTimersByTimeAsync(ms)
      })
    },
  }
}

/** Advances fake time in 100 ms slices (settling lazy route chunks) until `done()` or `maxMs`. */
async function flushUntil(flush: Mounted['flush'], done: () => boolean, maxMs: number): Promise<boolean> {
  for (let elapsed = 0; elapsed <= maxMs; elapsed += 100) {
    if (done()) return true
    await flush(100)
    await act(async () => {
      await vi.dynamicImportSettled()
    })
  }
  return done()
}

function findPage() {
  return screen.findByTestId('page-session-new', {}, { timeout: 20_000 })
}

function nextButton() {
  return screen.getByTestId('sn-next')
}

function isDisabled(element: HTMLElement) {
  return element.hasAttribute('disabled') || element.getAttribute('aria-disabled') === 'true' || element.hasAttribute('data-disabled')
}

function fillForm({ caseNumber = 'LP/2026/1001-0101', name = 'Rudi Hartono' } = {}) {
  const caseInput = screen.getByTestId('sn-case-number')
  fireEvent.change(caseInput, { target: { value: caseNumber } })
  fireEvent.blur(caseInput)
  fireEvent.click(screen.getByTestId('sn-subject-TERSANGKA'))
  const nameInput = screen.getByTestId('sn-subject-name')
  fireEvent.change(nameInput, { target: { value: name } })
  fireEvent.blur(nameInput)
}

// jsdom implements neither media playback nor a 2D canvas, and has no scrolling.
const originalPlay = HTMLMediaElement.prototype.play
const originalPause = HTMLMediaElement.prototype.pause
const originalGetContext = HTMLCanvasElement.prototype.getContext

beforeAll(() => {
  HTMLCanvasElement.prototype.getContext = (() => null) as unknown as HTMLCanvasElement['getContext']
  Element.prototype.scrollTo ??= function scrollTo() {}
  window.scrollTo = (() => undefined) as typeof window.scrollTo
})

afterAll(() => {
  HTMLCanvasElement.prototype.getContext = originalGetContext
  HTMLMediaElement.prototype.play = originalPlay
  HTMLMediaElement.prototype.pause = originalPause
})

beforeEach(() => {
  resetMissingI18nKeys()
  HTMLMediaElement.prototype.play = vi.fn(() => Promise.resolve()) as unknown as HTMLMediaElement['play']
  HTMLMediaElement.prototype.pause = vi.fn() as unknown as HTMLMediaElement['pause']
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ status: 'ok' }), { status: 200 })))
})

afterEach(() => {
  cleanup()
  for (const sim of sims.splice(0)) sim.stop()
  vi.clearAllTimers()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('Start New Session: step 1 validation (sessionCreateSchema, D62)', () => {
  it('has every schema message in the i18n namespace, including the 5 D62 additions', () => {
    for (const key of Object.values(SESSION_CREATE_MESSAGES)) expect(i18n.exists(key), key).toBe(true)
  })

  it('keeps Next disabled until the form is valid, shows inline field errors and defaults investigator, room and profile', async () => {
    const { sim } = mount()
    const page = await findPage()
    expect(page).toHaveAttribute('data-step', '1')
    expect(within(page).getByTestId('sn-step-info')).toBeInTheDocument()
    expect(screen.getByTestId('sn-step-position')).toHaveTextContent('Step 1 of 3')
    expect(isDisabled(nextButton())).toBe(true)

    // Defaults: the signed-in operator, the device room, the standard profile.
    expect(screen.getByTestId('sn-investigator-input')).toHaveValue('AKP Budi Santoso')
    expect(screen.getByTestId('sn-room')).toHaveTextContent('Interview Room 1')
    expect(screen.getByTestId('sn-profile')).toHaveTextContent('Standard (1080p / 25 fps)')

    // A malformed case number is refused inline once the field was touched.
    const caseInput = screen.getByTestId('sn-case-number')
    fireEvent.change(caseInput, { target: { value: 'ABC' } })
    fireEvent.blur(caseInput)
    expect(await screen.findByText('Use the case format LP/YYYY/MMDD-NNNN.')).toBeInTheDocument()
    expect(isDisabled(nextButton())).toBe(true)

    // The simulated scanner fills the next case number (the sim's scanCaseNumber, step 54) and clears the error.
    fireEvent.click(screen.getByTestId('sn-scan'))
    await vi.waitFor(() => expect(screen.getByTestId('sn-case-number')).toHaveValue('LP/2026/1001-0008'))
    await vi.waitFor(() => expect(screen.queryByText('Use the case format LP/YYYY/MMDD-NNNN.')).not.toBeInTheDocument())

    fireEvent.click(screen.getByTestId('sn-subject-SAKSI'))
    const nameInput = screen.getByTestId('sn-subject-name')
    fireEvent.change(nameInput, { target: { value: '   ' } })
    fireEvent.blur(nameInput)
    expect(await screen.findByText('Enter the subject name.')).toBeInTheDocument()
    expect(isDisabled(nextButton())).toBe(true)

    fireEvent.change(nameInput, { target: { value: 'Siti Rahma' } })
    await vi.waitFor(() => expect(isDisabled(nextButton())).toBe(false))
    expect(screen.getByTestId('sn-subject-SAKSI')).toHaveAttribute('data-selected', 'true')
    expect(screen.getByTestId('sn-preview')).toHaveTextContent('Siti Rahma')
    // Nothing is created before Next.
    expect(sim.store.getState().session).toBeNull()
    expect(getMissingI18nKeys()).toEqual([])
  })
})

describe('Start New Session: step 2 gate (§5.3, fake timers)', () => {
  it('blocks on a BLOCK check, then passes after the fault clears and the checks re-run', async () => {
    const m = mount()
    await findPage()
    m.sim.actions.setTabletLink('OFFLINE')
    fillForm()
    m.startEngine()
    await m.flush(50)
    expect(isDisabled(nextButton())).toBe(false)
    fireEvent.click(nextButton())
    await m.flush(400)
    expect(m.sim.store.getState().session?.state).toBe('PRECHECK')
    expect(screen.getByTestId('page-session-new')).toHaveAttribute('data-step', '2')

    const blocked = await flushUntil(m.flush, () => m.sim.store.getState().session?.precheck.outcome !== null, PRECHECK_TOTAL_MAX_MS + 200)
    expect(blocked).toBe(true)
    expect(m.sim.store.getState().session?.precheck.outcome).toBe('BLOCK')
    expect(screen.getByTestId('sn-step-devices')).toHaveAttribute('data-gate', 'block')
    expect(screen.getByTestId('sn-gate-blocked')).toHaveTextContent('Core link offline')
    expect(screen.getByTestId('sn-check-CORE')).toHaveAttribute('data-status', 'BLOCK')
    expect(isDisabled(nextButton())).toBe(true)
    expect(screen.getByTestId('stepper').querySelector('[data-step="devices"]')).toHaveAttribute('data-status', 'error')
    expect(m.sim.store.getState().audit.rows.some((row) => row.type === 'PRECHECK_BLOCKED')).toBe(true)

    // Clear the fault, re-run: all 8 pass and the simulator arms the session.
    m.sim.actions.setTabletLink('CONNECTED')
    fireEvent.click(screen.getByTestId('sn-retry'))
    const armed = await flushUntil(m.flush, () => m.sim.store.getState().session?.state === 'ARMED', PRECHECK_TOTAL_MAX_MS + 200)
    expect(armed).toBe(true)
    expect(screen.getByTestId('sn-gate-outcome')).toHaveAttribute('data-phase', 'pass')
    expect(isDisabled(nextButton())).toBe(false)
    expect(getMissingI18nKeys()).toEqual([])
  })

  it('needs the acknowledgement for a WARN check before Next arms the session', async () => {
    const m = mount()
    await findPage()
    m.sim.actions.inject('MIC_NO_SIGNAL')
    fillForm({ caseNumber: 'LP/2026/1001-0102', name: 'Bayu Saputra' })
    m.startEngine()
    await m.flush(50)
    fireEvent.click(nextButton())
    await m.flush(400)
    const resolved = await flushUntil(m.flush, () => m.sim.store.getState().session?.precheck.outcome !== null, PRECHECK_TOTAL_MAX_MS + 200)
    expect(resolved).toBe(true)
    expect(m.sim.store.getState().session?.precheck.outcome).toBe('WARN')
    expect(m.sim.store.getState().session?.state).toBe('PRECHECK')
    expect(screen.getByTestId('sn-check-MIC_PRIMARY')).toHaveAttribute('data-status', 'WARN')
    expect(screen.getByTestId('sn-check-MIC_PRIMARY')).toHaveTextContent('MIC (primary): no signal')
    const warn = screen.getByTestId('sn-gate-warn')
    expect(isDisabled(nextButton())).toBe(true)

    fireEvent.click(within(warn).getByRole('checkbox'))
    await m.flush(50)
    expect(isDisabled(nextButton())).toBe(false)
    fireEvent.click(nextButton())
    await m.flush(100)
    const state = m.sim.store.getState()
    expect(state.session?.state).toBe('ARMED')
    const passed = state.audit.rows.findLast((row) => row.type === 'PRECHECK_PASSED')
    expect(passed?.details).toMatchObject({ warnings: 1, acknowledged: true })
    expect(screen.getByTestId('page-session-new')).toHaveAttribute('data-step', '3')
    expect(screen.getByTestId('sn-summary-devices')).toHaveTextContent('1 warning acknowledged')
    expect(getMissingI18nKeys()).toEqual([])
  })
})

describe('Start New Session: happy path to RECORDING (AC-62 unit form, fake timers)', () => {
  it('creates, checks 8 devices within 5 s, counts down 3-2-1 and lands on /session recording', async () => {
    const m = mount()
    await findPage()
    fillForm({ caseNumber: 'LP/2026/1001-0103', name: 'Rudi Hartono' })
    m.startEngine()
    await m.flush(50)
    fireEvent.click(nextButton())
    await m.flush(0)
    expect(screen.getByTestId('sn-next')).toHaveTextContent('Creating session…')
    await m.flush(400)
    const session = m.sim.store.getState().session
    expect(session?.state).toBe('PRECHECK')
    expect(session?.input).toMatchObject({ caseNumber: 'LP/2026/1001-0103', subjectType: 'TERSANGKA', subjectName: 'Rudi Hartono', investigatorId: OPERATOR_IDS.BUDI, room: 'Interview Room 1', profileId: 'STANDARD_1080P25' })
    const sessionId = session?.id ?? ''
    const precheckStart = session?.precheck.startedAt ?? 0
    expect(screen.getByTestId('sn-header-session')).toHaveTextContent(sessionId)

    // The checks resolve one by one; all 8 PASS within 5 s of simulator time and the session arms.
    const armed = await flushUntil(m.flush, () => m.sim.store.getState().session?.state === 'ARMED', 5_000)
    expect(armed).toBe(true)
    const precheck = m.sim.store.getState().session?.precheck
    expect(precheck?.items.map((item) => item.status)).toEqual(Array(8).fill('PASS'))
    expect((precheck?.completedAt ?? Infinity) - precheckStart).toBeLessThanOrEqual(5_000)
    expect(screen.getAllByTestId('sn-check-chip')).toHaveLength(8)

    fireEvent.click(nextButton())
    await m.flush(100)
    expect(screen.getByTestId('page-session-new')).toHaveAttribute('data-step', '3')
    expect(screen.getByTestId('sn-summary')).toHaveTextContent('LP/2026/1001-0103')
    expect(screen.getByTestId('sn-summary-devices')).toHaveTextContent('All devices ready')

    // 3-2-1 (default on), then RECORDING and the route change.
    fireEvent.click(screen.getByTestId('sn-start'))
    await m.flush(50)
    expect(screen.getByTestId('sn-countdown')).toHaveTextContent('3')
    await m.flush(1_000)
    expect(screen.getByTestId('sn-countdown')).toHaveTextContent('2')
    expect(m.sim.store.getState().session?.state).toBe('ARMED')
    await m.flush(1_000)
    expect(screen.getByTestId('sn-countdown')).toHaveTextContent('1')
    expect(m.sim.store.getState().session?.state).toBe('ARMED')
    await m.flush(1_000)
    expect(m.sim.store.getState().session?.state).toBe('RECORDING')

    const landed = await flushUntil(m.flush, () => screen.queryByTestId('page-session-monitor') !== null, 8_000)
    expect(landed).toBe(true)
    expect(m.router.state.location.pathname).toBe('/session')
    expect(screen.getByTestId('page-session-monitor')).toHaveAttribute('data-phase', 'RECORDING')

    const types = m.sim.store.getState().audit.rows.filter((row) => row.sessionId === sessionId).map((row) => row.type)
    const created = types.indexOf('SESSION_CREATED')
    const passed = types.indexOf('PRECHECK_PASSED')
    const started = types.indexOf('RECORDING_STARTED')
    expect(created).toBeGreaterThanOrEqual(0)
    expect(passed).toBeGreaterThan(created)
    expect(started).toBeGreaterThan(passed)
    const startRow = m.sim.store.getState().audit.rows.find((row) => row.type === 'RECORDING_STARTED' && row.sessionId === sessionId)
    expect(startRow?.actorId).toBe(OPERATOR_IDS.BUDI)
    expect(getMissingI18nKeys()).toEqual([])
  })
})

describe('Start New Session: guards', () => {
  it('sends the operator to the Session Monitor when a session is already recording (R4 n5)', async () => {
    const m = mount({ scenario: 'recording' })
    expect(await screen.findByTestId('page-session-monitor', {}, { timeout: 20_000 })).toHaveAttribute('data-phase', 'RECORDING')
    expect(m.router.state.location.pathname).toBe('/session')
  })

  it('discards a setup session through the AlertDialog and returns to the Dashboard', async () => {
    const m = mount()
    await findPage()
    fillForm({ caseNumber: 'LP/2026/1001-0104' })
    m.startEngine()
    await m.flush(50)
    fireEvent.click(nextButton())
    await m.flush(400)
    expect(m.sim.store.getState().session?.state).toBe('PRECHECK')
    fireEvent.click(screen.getByTestId('sn-cancel'))
    await m.flush(100)
    fireEvent.click(within(screen.getByTestId('sn-cancel-dialog')).getByTestId('sn-cancel-confirm'))
    await m.flush(100)
    expect(m.sim.store.getState().session).toBeNull()
    expect(m.sim.store.getState().audit.rows.some((row) => row.type === 'SESSION_CANCELLED')).toBe(true)
    const left = await flushUntil(m.flush, () => m.router.state.location.pathname === '/dashboard', 4_000)
    expect(left).toBe(true)
  })
})
