/**
 * @vitest-environment jsdom
 * @vitest-environment-options { "url": "http://127.0.0.1:5178/" }
 */
// Plan row W54: what the shell says in Live mode (backend task 04_client_integration_spec §3.5,
// §6.3, §6.5; LB-6, LB-10; brief list rows 16, 17, 30 of implementation/44_live_source.md §17.4).
// Every test runs the real Live start-up and the real router on the contract-checked fake transport.
//
// | Criterion | Where it is proven here |
// |-----------|-------------------------|
// | AC-C-26 link lost while signed in: one persistent toast, the indicator LIVE · OFFLINE, meters at "no signal", a command rejects without a request; after the link returns the replica equals a fresh snapshot | "the link notice" |
// | AC-C-59 offline: a command rejects at once, five presses show one toast, and no request is sent | "the link notice" |
// | LB-10, SD-03, AC-C-110 (the shell's part): a 429 shows the limit toast, not the link notice, and leaves the indicator unchanged | "a limit is not an outage" |
// | AC-C-49 `session.updated` shows the role notice, without a reload or a sign-in | "the role notice" |
// | AC-C-45 (the shell's part): an expired session leaves for `/login?redirect=<href>`; a disabled user for `/login` | "a session that ended" |
// | Decision D120: a tab whose socket the Core closed with 1013 shows the link notice and reconnects | "a socket the Core replaced" |
import { act, cleanup, configure, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { toast } from '@heroui/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { pickReplicatedState, SIM_ACTION_OPERATIONS, type AuthSessionInfo, type HealthResponse, type ReplicatedState } from '@dems/shared/api'
import { en } from '@dems/shared/i18n'
import { CoreMode, LIVE_RESYNCED_NOTICE_MS, LiveLinkState, LiveTransportError, settle } from '@dems/shared/live'
import { rateLimited } from '@dems/shared/live/testing'
import { AuthStatus, OperatorRole, SEAL_UNSEALABLE_EXAMPLE_ALERT, selectAuth, type AudioSlice, type SimAlert, type SimState } from '@dems/shared/sim'
import { getMissingI18nKeys, i18n, resetMissingI18nKeys } from '@/i18n'
import { presentCoreError, resetCoreErrorPresenter } from '@/lib/core-errors'
import { webErrorSink, type CoreModeControl } from '@/runtime'
import { createLiveTestBed, INVESTIGATOR_SESSION, SUPERVISOR_SESSION, type LivePage, type LiveTestBed } from '@/runtime/testing/live-harness'

const coreHealth: HealthResponse = {
  status: 'ok',
  service: 'dems-core-server',
  version: '0.2.0',
  apiVersion: 'v1',
  serverTime: '2026-10-04T03:00:00.000Z',
  uptimeMs: 1000,
  ws: { path: '/ws', heartbeatIntervalMs: 1000, clients: 1 },
  ready: { database: true, engine: true },
}

// A page's chunk is loaded by a dynamic import: under load that can take longer than the library's default second.
configure({ asyncUtilTimeout: 6_000 })
vi.setConfig({ testTimeout: 20_000 })

const LOST_TITLE = en.common.coreLink.lostTitle
const LOST_BODY = en.common.coreLink.lostBody
const RESTORED = en.common.coreLink.restored
const OFFLINE_COMMAND = en.common.coreErrors.offline
/** Longer than the longest reconnect delay of the socket (8,000 ms and its jitter). */
const RECONNECT_MS = 10_000
const STORAGE_POLICY_OPERATION = SIM_ACTION_OPERATIONS.setStoragePolicy.operations[0]!

const originalMatchMedia = window.matchMedia
/**
 * Empties the kit's toast queue, which is one per page and outlives a test. A toast that is still
 * open is closed without its exit animation; one that a test closed is waited for (300 ms).
 */
async function clearToasts() {
  window.matchMedia = (() => ({ matches: true })) as unknown as typeof window.matchMedia
  toast.clear()
  window.matchMedia = originalMatchMedia
  const queue = toast.getQueue() as { getExitingKeys?: () => ReadonlySet<string> }
  if ((queue.getExitingKeys?.().size ?? 0) > 0) await new Promise((resolve) => setTimeout(resolve, 350))
}

const wire = (state: SimState): ReplicatedState => pickReplicatedState(JSON.parse(JSON.stringify(state)) as ReplicatedState)

const control = (mode: CoreMode, switchTo: CoreModeControl['switchTo'] = vi.fn(async () => true)): CoreModeControl => ({ mode, selectable: true, switchTo })

const indicator = () => screen.getByTestId('shell-mode')
/** The link notices on screen: toasts only (the Login page has an offline state of its own, with the same words). */
const lostToasts = () => screen.queryAllByText(LOST_TITLE).filter((element) => element.closest('[data-slot="toast"]') !== null)

let bed: LiveTestBed | undefined

/** A signed-in SUPERVISOR on `path`, in Live mode. */
async function signedIn(path: string, coreMode?: CoreModeControl): Promise<{ bed: LiveTestBed; page: LivePage; router: Awaited<ReturnType<LiveTestBed['mount']>>['router'] }> {
  const created = createLiveTestBed({ session: SUPERVISOR_SESSION })
  bed = created
  const page = await created.load()
  const { router } = await created.mount(page, path, coreMode ? { coreMode } : {})
  return { bed: created, page, router }
}

/** A call site as the page rows write it: the action through `settle`, its error to the presenter first. */
function pressStoragePolicy(page: LivePage, body: unknown): { settled: () => boolean; error: () => unknown } {
  let settled = false
  let failure: unknown = null
  settle(() => page.live.actions.setStoragePolicy(body as Parameters<typeof page.live.actions.setStoragePolicy>[0]), {
    fail: (error) => {
      failure = error
      presentCoreError(error, { t: i18n.t })
    },
    done: () => {
      settled = true
    },
  })
  return { settled: () => settled, error: () => failure }
}

beforeEach(() => {
  resetMissingI18nKeys()
  resetCoreErrorPresenter()
  window.localStorage.clear()
  window.sessionStorage.clear()
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(JSON.stringify(coreHealth), { status: 200 })),
  )
})

afterEach(async () => {
  cleanup()
  await clearToasts()
  bed?.dispose()
  bed = undefined
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

// Fix wave J round three, driver J3-W: the bell's "Acknowledge all". Lane 2's bell read "84 new alerts"
// after the counting rule of round one; an operator clears a backlog with ONE press, a confirmation
// that NAMES THE COUNT, and one request per alert through the existing operation 70.
describe('the bell: "Acknowledge all" (operation 70, one request per alert)', () => {
  const alertOf = (n: number, over: Partial<SimAlert> = {}): SimAlert => ({ id: `ALR-${String(n).padStart(6, '0')}`, at: 1_790_000_000_000 + n * 1_000, severity: 'WARNING', kind: 'SYSTEM', message: `Backlog alert ${n}`, active: true, acknowledged: false, resolvedAt: null, ...over })
  const NOTICE: SimAlert = { ...SEAL_UNSEALABLE_EXAMPLE_ALERT, id: 'ALR-000090', at: 1_790_000_090_000 }
  /** Three open alerts (one the Core resolved), one acknowledged, and the open notice of a recording that could not be sealed. */
  const BACKLOG = [alertOf(1), alertOf(2, { active: false, resolvedAt: 1_790_000_002_500 }), alertOf(3), alertOf(4, { acknowledged: true }), NOTICE]
  const LEFT_ONE = '1 notice of a recording that could not be sealed (kept in quarantine) is not included. It is left for individual acknowledgement on its own row.'

  async function withAlerts(session: Pick<AuthSessionInfo, 'operator' | 'permissions'>, alerts: SimAlert[]) {
    const created = createLiveTestBed({ session })
    bed = created
    created.core.served = { ...created.core.served, alerts }
    // Operation 70 answers 204 in every case; the acknowledged alert comes back with the next delta, which these cases do not need.
    created.fake.answer('acknowledgeAlert', () => ({ status: 204 }))
    const page = await created.load()
    await created.mount(page, '/dashboard')
    await screen.findByTestId('page-dashboard')
    return created
  }
  const sentIds = () => bedOrThrow().fake.log.requestsOf('acknowledgeAlert').map((request) => /alerts\/(ALR-\d+)\/acknowledge$/.exec(request.path ?? '')?.[1])
  const bedOrThrow = (): LiveTestBed => {
    if (bed === undefined) throw new Error('no bed')
    return bed
  }
  const openBell = async () => {
    fireEvent.click(screen.getByTestId('notifications-bell'))
    return screen.findByTestId('acknowledge-all-bell')
  }

  it('an investigator: one press asks first and NAMES THE COUNT; the confirmation sends ONE request per alert, oldest first, the resolved one included - and leaves the unsealable notice for individual acknowledgement', async () => {
    await withAlerts(INVESTIGATOR_SESSION, BACKLOG)
    const all = await openBell()
    expect(all).toHaveAttribute('data-count', '3')
    expect(all).toHaveTextContent('Acknowledge all (3)')
    fireEvent.click(all)
    const dialog = await screen.findByTestId('acknowledge-all-confirm')
    // Nothing was sent by the press.
    expect(sentIds()).toEqual([])
    expect(dialog).toHaveTextContent('Acknowledge 3 alerts?')
    expect(within(dialog).getByTestId('acknowledge-all-confirm-body')).toHaveTextContent('3 alerts are marked as acknowledged for every console of this Core, one after the other. The faults behind them are not cleared by this.')
    expect(within(dialog).getByTestId('acknowledge-all-confirm-left')).toHaveTextContent(LEFT_ONE)
    fireEvent.click(within(dialog).getByTestId('acknowledge-all-confirm-action'))
    await waitFor(() => expect(sentIds()).toHaveLength(3))
    expect(sentIds()).toEqual(['ALR-000001', 'ALR-000002', 'ALR-000003'])
    for (const request of bedOrThrow().fake.log.requestsOf('acknowledgeAlert')) expect(request.method).toBe('POST')
    expect(await screen.findByText('3 alerts acknowledged')).toBeInTheDocument()
    // No other operation was invented for it.
    expect(bedOrThrow().fake.violations).toEqual([])
  })

  // Fix wave J closing pass (J4, item 1; the controller's ruling REPLACES the case of round three, in which a supervisor's
  // "all" closed the notice): no role sweeps up the notice of a recording in quarantine.
  it('a supervisor (holds the review permission): the unsealable notice is NOT in "all" either - the same count, the same sentence, and the notice is not sent', async () => {
    await withAlerts(SUPERVISOR_SESSION, BACKLOG)
    const all = await openBell()
    expect(all).toHaveAttribute('data-count', '3')
    fireEvent.click(all)
    const dialog = await screen.findByTestId('acknowledge-all-confirm')
    expect(dialog).toHaveTextContent('Acknowledge 3 alerts?')
    expect(within(dialog).getByTestId('acknowledge-all-confirm-left')).toHaveTextContent(LEFT_ONE)
    expect(dialog).not.toHaveTextContent(/closes/)
    fireEvent.click(within(dialog).getByTestId('acknowledge-all-confirm-action'))
    await waitFor(() => expect(sentIds()).toHaveLength(3))
    expect(await screen.findByText('3 alerts acknowledged')).toBeInTheDocument()
    expect(sentIds()).toEqual(['ALR-000001', 'ALR-000002', 'ALR-000003'])
    expect(sentIds()).not.toContain(NOTICE.id)
    // Its own row keeps its own control: that is where it is acknowledged, knowingly.
    fireEvent.click(screen.getByTestId('notifications-bell'))
    expect(await screen.findByTestId(`alert-unsealable-acknowledge-${NOTICE.id}`)).toBeInTheDocument()
  })

  it('Cancel sends nothing; a refused acknowledgement STOPS the run and says how many were done - never "all"', async () => {
    const created = await withAlerts(INVESTIGATOR_SESSION, BACKLOG)
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    fireEvent.click(await openBell())
    fireEvent.click(within(await screen.findByTestId('acknowledge-all-confirm')).getByTestId('acknowledge-all-cancel'))
    await created.flush()
    expect(sentIds()).toEqual([])

    webErrorSink.clear()
    // The second of the three is refused (the limit of the Core).
    let asked = 0
    created.fake.answer('acknowledgeAlert', () => {
      asked += 1
      return asked === 2 ? rateLimited(30) : { status: 204 }
    })
    fireEvent.click(await openBell())
    fireEvent.click(within(await screen.findByTestId('acknowledge-all-confirm')).getByTestId('acknowledge-all-confirm-action'))
    expect(await screen.findByText('1 of 3 alerts acknowledged. The rest is unchanged.')).toBeInTheDocument()
    // The run stopped at the refusal: the third alert was not asked.
    expect(sentIds()).toEqual(['ALR-000001', 'ALR-000002'])
    expect(screen.queryByText('3 alerts acknowledged')).toBeNull()
    const kept = webErrorSink.records().filter((record) => record.source === 'AcknowledgeAll.acknowledge')
    expect(kept).toHaveLength(1)
    expect(kept[0]?.context).toMatchObject({ surface: 'bell', done: 1, total: 3 })
  })

  it('CONTROL - one open alert: no "Acknowledge all" (its row has its own control); none on a quiet bell', async () => {
    await withAlerts(INVESTIGATOR_SESSION, [alertOf(1), alertOf(4, { acknowledged: true }), NOTICE])
    fireEvent.click(screen.getByTestId('notifications-bell'))
    await screen.findByTestId('bell-open-alerts')
    expect(screen.queryByTestId('acknowledge-all-bell')).toBeNull()
    expect(screen.getByTestId('alert-acknowledge-ALR-000001')).toBeInTheDocument()
  })
})

describe('the link notice (§3.5; AC-C-26, AC-C-59)', () => {
  it('AC-C-26: one persistent toast, the indicator LIVE · OFFLINE, meters at "no signal", a command rejected without a request', async () => {
    const { bed, page } = await signedIn('/dashboard')
    await screen.findByTestId('page-dashboard')
    // A meter frame arrives while the link is up: the level is a real one.
    const frame = { seq: 1, at: bed.fake.clock.now(), dbfs: -18, peak: -9, clip: false, noSignal: false }
    page.sockets.at(-1)!.meters({ inputs: { 'MIC-01': frame, 'MIC-02': frame }, activeInputId: 'MIC-01' } as AudioSlice)
    await bed.flush()
    expect(page.live.store.getState().audio.inputs['MIC-01'].noSignal).toBe(false)
    expect(lostToasts()).toHaveLength(0)
    const danger = vi.spyOn(toast, 'danger')

    bed.core.unreachable()
    await bed.flush()
    expect(page.live.link).toBe(LiveLinkState.OFFLINE)
    expect(await screen.findByText(LOST_TITLE)).toBeInTheDocument()
    // Persistent: it has no time-out of its own.
    expect(danger).toHaveBeenCalledTimes(1)
    expect(danger).toHaveBeenCalledWith(LOST_TITLE, expect.objectContaining({ timeout: 0, description: LOST_BODY }))
    expect(screen.getByText(LOST_BODY)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: en.common.coreLink.retryNow })).toBeEnabled()
    expect(indicator()).toHaveTextContent(/^LIVE · OFFLINE$/)
    // Meters fall to "no signal": a meter never freezes on a stale level.
    const audio = page.live.store.getState().audio
    expect(audio.inputs['MIC-01'].noSignal).toBe(true)
    expect(audio.inputs['MIC-02'].noSignal).toBe(true)
    // The operator stays signed in and the page stays: nothing is inserted into it.
    expect(selectAuth(page.live.store.getState()).status).toBe(AuthStatus.SIGNED_IN)
    expect(screen.getByTestId('page-dashboard')).toBeInTheDocument()

    // The socket retries (OFFLINE, CONNECTING, OFFLINE …): still ONE toast, and it does not close by itself.
    await bed.elapse(RECONNECT_MS * 2, 500)
    expect(page.sockets.length).toBeGreaterThan(2)
    expect(lostToasts()).toHaveLength(1)
    expect(screen.queryByText(RESTORED)).not.toBeInTheDocument()

    // A command is refused here, at once, and nothing is sent (CL-22).
    const requests = bed.fake.log.requests.length
    const press = pressStoragePolicy(page, bed.fake.exampleInput(STORAGE_POLICY_OPERATION).body)
    expect(press.settled()).toBe(true)
    expect(press.error()).toBeInstanceOf(LiveTransportError)
    expect(bed.fake.log.requests.length).toBe(requests)
    expect(bed.fake.log.requestsOf(STORAGE_POLICY_OPERATION)).toHaveLength(0)
    expect(getMissingI18nKeys()).toEqual([])
  })

  it('AC-C-59: five presses while offline show ONE "nothing was changed" toast beside the notice, and send nothing', async () => {
    const { bed, page } = await signedIn('/dashboard')
    await screen.findByTestId('page-dashboard')
    bed.core.unreachable()
    await bed.flush()
    await screen.findByText(LOST_TITLE)
    const requests = bed.fake.log.requests.length
    const body = bed.fake.exampleInput(STORAGE_POLICY_OPERATION).body

    const presses = [1, 2, 3, 4, 5].map(() => pressStoragePolicy(page, body))
    // Each one is settled before the next line runs: rejected at once.
    for (const press of presses) {
      expect(press.settled()).toBe(true)
      expect(press.error()).toBeInstanceOf(LiveTransportError)
    }
    await bed.flush()
    expect(await screen.findAllByText(OFFLINE_COMMAND)).toHaveLength(1)
    expect(lostToasts()).toHaveLength(1)
    expect(bed.fake.log.requests.length).toBe(requests)
  })

  it('AC-C-26: after the link returns, the replica equals a fresh snapshot, the notice goes and "Reconnected to the Core" shows', async () => {
    const { bed, page } = await signedIn('/dashboard')
    await screen.findByTestId('page-dashboard')
    bed.core.unreachable()
    await bed.flush()
    await screen.findByText(LOST_TITLE)

    // The Core's state moves while this console cannot hear it.
    bed.core.served = { ...bed.core.served, device: { ...bed.core.served.device, name: 'Interview Room 9' } }
    expect(page.live.store.getState().device.name).not.toBe('Interview Room 9')
    const restored = vi.spyOn(toast, 'success')

    bed.core.back()
    await bed.elapse(RECONNECT_MS, 500)
    expect(page.live.link).toBe(LiveLinkState.ONLINE)
    // Wave J (JW-07): the bed's Core runs the demonstration, so the chip names it; a bare "LIVE" read as "this is live".
    expect(indicator()).toHaveTextContent(/^LIVE · DEMO CORE$/)
    expect(wire(page.live.store.getState())).toEqual(wire(bed.core.served))
    expect(await screen.findByText('Interview Room 9')).toBeInTheDocument()

    expect(await screen.findByText(RESTORED)).toBeInTheDocument()
    expect(restored).toHaveBeenCalledTimes(1)
    expect(restored).toHaveBeenCalledWith(RESTORED, { timeout: LIVE_RESYNCED_NOTICE_MS })
    await waitFor(() => expect(lostToasts()).toHaveLength(0))
    // A second outage is a second notice.
    bed.core.unreachable()
    await bed.flush()
    await waitFor(() => expect(lostToasts()).toHaveLength(1))
  })

  it('"Retry now" asks for a new socket at once, and then cools down: a second press does nothing', async () => {
    const { bed, page } = await signedIn('/dashboard')
    await screen.findByTestId('page-dashboard')
    bed.core.unreachable()
    await bed.flush()
    await screen.findByText(LOST_TITLE)
    const reconnect = vi.spyOn(page.live, 'reconnect')
    const sockets = page.sockets.length

    fireEvent.click(screen.getByRole('button', { name: en.common.coreLink.retryNow }))
    await bed.flush()
    expect(reconnect).toHaveBeenCalledTimes(1)
    expect(reconnect).toHaveBeenCalledWith('RETRY')
    expect(page.sockets.length).toBe(sockets + 1)
    const cooling = await screen.findByRole('button', { name: 'Retry in 3s' })
    expect(cooling).toBeDisabled()
    fireEvent.click(cooling)
    await bed.flush()
    expect(reconnect).toHaveBeenCalledTimes(1)
    expect(lostToasts()).toHaveLength(1)
  })

  it('a notice the operator closed stays closed for this outage, also while the retry control cools down', async () => {
    const { bed } = await signedIn('/dashboard')
    await screen.findByTestId('page-dashboard')
    bed.core.unreachable()
    await bed.flush()
    const title = await screen.findByText(LOST_TITLE)
    fireEvent.click(screen.getByRole('button', { name: en.common.coreLink.retryNow }))
    await screen.findByRole('button', { name: 'Retry in 3s' })

    const close = title.closest('[data-slot="toast"]')?.querySelector<HTMLElement>('[data-slot="toast-close"]')
    expect(close).toBeTruthy()
    fireEvent.click(close!)
    await waitFor(() => expect(lostToasts()).toHaveLength(0))
    // The cooldown ticks once a second: the toast must not come back with it.
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 1_300))
    })
    expect(lostToasts()).toHaveLength(0)
    expect(indicator()).toHaveTextContent(/^LIVE · OFFLINE$/)
  })

  it('"Switch to Simulated mode" is offered only where the build offers the choice, and asks before it switches', async () => {
    const switchTo = vi.fn(async () => true)
    const { bed } = await signedIn('/dashboard', control(CoreMode.LIVE, switchTo))
    await screen.findByTestId('page-dashboard')
    bed.core.unreachable()
    await bed.flush()
    await screen.findByText(LOST_TITLE)

    fireEvent.click(screen.getByTestId('link-notice-use-simulated'))
    const dialog = await screen.findByTestId('mode-switch-dialog')
    expect(within(dialog).getByText('Switch to Simulated mode?')).toBeInTheDocument()
    expect(switchTo).not.toHaveBeenCalled()
    fireEvent.click(within(dialog).getByTestId('mode-switch-confirm'))
    await waitFor(() => expect(switchTo).toHaveBeenCalledWith(CoreMode.SIMULATED))
  })

  it('without the choice the notice has one action', async () => {
    const { bed } = await signedIn('/dashboard')
    await screen.findByTestId('page-dashboard')
    bed.core.unreachable()
    await bed.flush()
    await screen.findByText(LOST_TITLE)
    expect(screen.queryByTestId('link-notice-use-simulated')).not.toBeInTheDocument()
    expect(screen.queryByText(en.common.coreMode.switchConfirm.SIMULATED)).not.toBeInTheDocument()
  })
})

describe('operator activity (CL-27; the shell\'s `touch` call site)', () => {
  it('pointer and key activity reach the Core as ONE `touchSession` a minute, and show nothing', async () => {
    const { bed } = await signedIn('/dashboard')
    await screen.findByTestId('page-dashboard')
    expect(bed.fake.log.requestsOf('touchSession')).toHaveLength(0)
    const anyToast = vi.spyOn(toast, 'danger')

    fireEvent.pointerDown(document.body)
    await bed.flush()
    expect(bed.fake.log.requestsOf('touchSession')).toHaveLength(1)
    fireEvent.keyDown(document.body, { key: 'a' })
    fireEvent.pointerDown(document.body)
    await bed.flush()
    expect(bed.fake.log.requestsOf('touchSession')).toHaveLength(1)

    // With the link down a touch is not sent, and the shell words nothing for it: the link notice is the one notice.
    bed.core.unreachable()
    await bed.flush()
    await screen.findByText(LOST_TITLE)
    fireEvent.pointerDown(document.body)
    await bed.flush()
    expect(bed.fake.log.requestsOf('touchSession')).toHaveLength(1)
    expect(anyToast.mock.calls.map((call) => call[0])).toEqual([LOST_TITLE])
    expect(screen.queryByText(OFFLINE_COMMAND)).not.toBeInTheDocument()
  })
})

describe('a socket the Core replaced (decision D120: close 1013 for the oldest of five)', () => {
  it('the displaced tab shows the link notice, reconnects by itself and says "Reconnected to the Core"', async () => {
    const { bed, page } = await signedIn('/dashboard')
    await screen.findByTestId('page-dashboard')
    const first = page.sockets.at(-1)!

    first.close(1013, 'replaced by a newer connection')
    await bed.flush()
    expect(page.live.link).toBe(LiveLinkState.OFFLINE)
    expect(await screen.findByText(LOST_TITLE)).toBeInTheDocument()
    expect(indicator()).toHaveTextContent(/^LIVE · OFFLINE$/)
    expect(selectAuth(page.live.store.getState()).status).toBe(AuthStatus.SIGNED_IN)

    // The first reconnect delay is 500 ms and its jitter.
    await bed.elapse(1_000, 250)
    expect(page.sockets.at(-1)).not.toBe(first)
    expect(page.live.link).toBe(LiveLinkState.ONLINE)
    // Wave J (JW-07): the bed's Core runs the demonstration, so the chip names it; a bare "LIVE" read as "this is live".
    expect(indicator()).toHaveTextContent(/^LIVE · DEMO CORE$/)
    expect(await screen.findByText(RESTORED)).toBeInTheDocument()
    await waitFor(() => expect(lostToasts()).toHaveLength(0))
    expect(bed.fake.log.requestsOf('signOut')).toHaveLength(0)
  })
})

describe('a limit is not an outage (LB-10; SD-03; AC-C-110, the shell\'s part)', () => {
  it('a 429 shows the limit toast with the seconds of `retry-after`, no link notice, and an unchanged indicator', async () => {
    const { bed, page } = await signedIn('/dashboard')
    await screen.findByTestId('page-dashboard')
    const lost = vi.spyOn(toast, 'danger')
    bed.fake.answer(STORAGE_POLICY_OPERATION, rateLimited(7))
    expect(indicator()).toHaveAttribute('data-state', 'LIVE')

    const press = pressStoragePolicy(page, bed.fake.exampleInput(STORAGE_POLICY_OPERATION).body)
    await bed.flush()
    expect(press.settled()).toBe(true)
    expect(bed.fake.log.requestsOf(STORAGE_POLICY_OPERATION)).toHaveLength(1)
    expect(await screen.findByText('The Core server is limiting requests from this console. Try again in 7 s.')).toBeInTheDocument()

    // Not an outage: the link did not move, no link notice, no "unreachable" sentence, the indicator as it was.
    await bed.elapse(3_000, 500)
    expect(page.live.link).toBe(LiveLinkState.ONLINE)
    // Wave J (JW-07): the bed's Core runs the demonstration, so the chip names it; a bare "LIVE" read as "this is live".
    expect(indicator()).toHaveTextContent(/^LIVE · DEMO CORE$/)
    expect(indicator()).toHaveAttribute('data-state', 'LIVE')
    expect(lostToasts()).toHaveLength(0)
    expect(screen.queryByText(OFFLINE_COMMAND)).not.toBeInTheDocument()
    expect(lost).not.toHaveBeenCalled()
    expect(selectAuth(page.live.store.getState()).status).toBe(AuthStatus.SIGNED_IN)
  })

  it('five limited presses show one limit toast', async () => {
    const { bed, page } = await signedIn('/dashboard')
    await screen.findByTestId('page-dashboard')
    bed.fake.answer(STORAGE_POLICY_OPERATION, rateLimited(12))
    const body = bed.fake.exampleInput(STORAGE_POLICY_OPERATION).body
    for (let press = 0; press < 5; press += 1) {
      pressStoragePolicy(page, body)
      await bed.flush()
    }
    expect(await screen.findAllByText('The Core server is limiting requests from this console. Try again in 12 s.')).toHaveLength(1)
    expect(lostToasts()).toHaveLength(0)
    expect(indicator()).toHaveAttribute('data-state', 'LIVE')
  })
})

describe('the role notice (§6.3; RC-1, RC-2; AC-C-49)', () => {
  const ROLE_NOTICE = (role: string) => `Your role is now ${role}. The available actions have changed.`

  it('`session.updated` shows ONE info toast that names the new role; nobody is signed out and the page stays', async () => {
    const { bed, page, router } = await signedIn('/evidence')
    await screen.findByTestId('page-evidence')
    const info = vi.spyOn(toast, 'info')

    bed.core.changeRole(OperatorRole.INVESTIGATOR, INVESTIGATOR_SESSION.permissions)
    await bed.flush()
    expect(await screen.findByText(ROLE_NOTICE('Investigator'))).toBeInTheDocument()
    expect(info).toHaveBeenCalledTimes(1)
    // No page was left: the notice has no second sentence.
    expect(info).toHaveBeenCalledWith(ROLE_NOTICE('Investigator'), undefined)
    expect(screen.queryByText(en.shell.roleNotice.pageLeft)).not.toBeInTheDocument()
    expect(selectAuth(page.live.store.getState()).status).toBe(AuthStatus.SIGNED_IN)
    expect(router.state.location.pathname).toBe('/evidence')
    expect(screen.getByTestId('page-evidence')).toBeInTheDocument()
    expect(bed.fake.log.requestsOf('signIn')).toHaveLength(0)
    expect(getMissingI18nKeys()).toEqual([])
  })

  it('the same role again says nothing; the way back to the seed role is the same event and gets the same notice (RC-2)', async () => {
    const { bed } = await signedIn('/evidence')
    await screen.findByTestId('page-evidence')
    const info = vi.spyOn(toast, 'info')

    bed.core.changeRole(OperatorRole.TECHNICIAN, INVESTIGATOR_SESSION.permissions)
    await bed.flush()
    expect(info).toHaveBeenCalledTimes(1)
    bed.core.changeRole(OperatorRole.TECHNICIAN, INVESTIGATOR_SESSION.permissions)
    await bed.flush()
    expect(info).toHaveBeenCalledTimes(1)

    bed.core.changeRole(OperatorRole.SUPERVISOR, SUPERVISOR_SESSION.permissions)
    await bed.flush()
    expect(info).toHaveBeenCalledTimes(2)
    expect(info).toHaveBeenLastCalledWith(ROLE_NOTICE('Supervisor'), undefined)
  })

  it('the role line of the user menu follows the role the Core holds', async () => {
    const { bed, page } = await signedIn('/evidence')
    await screen.findByTestId('page-evidence')
    fireEvent.click(screen.getByTestId('user-menu'))
    expect(await screen.findByRole('menuitem', { name: /Role: Supervisor/ })).toBeInTheDocument()

    // The Core sends the role twice: `session.updated`, and the `operators` slice as a delta.
    bed.core.changeRole(OperatorRole.INVESTIGATOR, INVESTIGATOR_SESSION.permissions)
    const operators = wire(bed.core.served).operators.map((operator) =>
      operator.id === SUPERVISOR_SESSION.operator.id ? { ...operator, role: OperatorRole.INVESTIGATOR } : operator,
    )
    page.sockets.at(-1)!.delta([{ op: 'replace', slice: 'operators', value: operators }])
    await bed.flush()
    expect(await screen.findByRole('menuitem', { name: /Role: Investigator/ })).toBeInTheDocument()
    expect(screen.queryByRole('menuitem', { name: /Role: Supervisor/ })).not.toBeInTheDocument()
  })
})

describe('a session that ended is not an outage (§6.4, §6.5; AC-C-45, the shell\'s part; brief list row 16)', () => {
  /** The first argument of every call of a toast function: the title it was given. */
  const titlesOf = (spy: { mock: { calls: readonly (readonly unknown[])[] } }): unknown[] => spy.mock.calls.map((call) => call[0])
  const noLinkNotice = (danger: Parameters<typeof titlesOf>[0], success: Parameters<typeof titlesOf>[0]) => {
    expect(titlesOf(danger).filter((title) => title === LOST_TITLE)).toEqual([])
    expect(titlesOf(success).filter((title) => title === RESTORED)).toEqual([])
  }

  it.each([
    ['IDLE_EXPIRED', AuthStatus.EXPIRED, { redirect: '/evidence' }],
    ['ABSOLUTE_EXPIRED', AuthStatus.EXPIRED, { redirect: '/evidence' }],
    ['USER_DISABLED', AuthStatus.SIGNED_OUT, {}],
    ['SIGNED_OUT', AuthStatus.SIGNED_OUT, {}],
  ] as const)('`session.ended` %s: the shell leaves for /login with the right search, and shows no link notice', async (reason, status, search) => {
    const { bed, page, router } = await signedIn('/evidence')
    await screen.findByTestId('page-evidence')
    const danger = vi.spyOn(toast, 'danger')
    const success = vi.spyOn(toast, 'success')

    bed.core.end(reason)
    await bed.flush()
    expect(selectAuth(page.live.store.getState()).status).toBe(status)
    expect(page.live.lastSessionEnd?.reason).toBe(reason)
    await waitFor(() => expect(router.state.location.pathname).toBe('/login'))
    expect(router.state.location.search).toEqual(search)
    await waitFor(() => expect(screen.queryByTestId('app-shell')).not.toBeInTheDocument())
    // The socket of the ended session was closed and an anonymous one opened: none of it is "the link was lost".
    await bed.elapse(2_000, 500)
    noLinkNotice(danger, success)
    expect(lostToasts()).toHaveLength(0)
  })

  it('Sign out and Lock console from the user menu: one sign-out with the reason, /login, no link notice', async () => {
    for (const [item, reason] of [
      ['Sign out', 'USER'],
      ['Lock console', 'LOCK'],
    ] as const) {
      const { bed, page, router } = await signedIn('/evidence')
      await screen.findByTestId('page-evidence')
      const danger = vi.spyOn(toast, 'danger')
      const success = vi.spyOn(toast, 'success')

      fireEvent.click(screen.getByTestId('user-menu'))
      fireEvent.click(await screen.findByRole('menuitem', { name: item }))
      await bed.flush()
      expect(selectAuth(page.live.store.getState()).status).toBe(AuthStatus.SIGNED_OUT)
      expect(page.live.lastSessionEnd?.signOut).toBe(reason)
      const sent = bed.fake.log.requestsOf('signOut')
      expect(sent).toHaveLength(1)
      expect(JSON.parse(sent[0]!.bodyText ?? '{}')).toEqual({ reason })
      await waitFor(() => expect(router.state.location.pathname).toBe('/login'))
      // Fix wave J (JT-18 / JW-19): after "Lock console" the next sign-in returns to the page that was locked; a
      // sign-out carries nothing.
      expect(router.state.location.search).toEqual(reason === 'LOCK' ? { redirect: '/evidence' } : {})
      await bed.elapse(2_000, 500)
      noLinkNotice(danger, success)

      cleanup()
      await clearToasts()
      bed.dispose()
      vi.restoreAllMocks()
    }
    bed = undefined
  })

  // Fix wave J round three (JT-18 / JW-19; ruling D244): "Lock console" ends the session. The Login then shows
  // the DISTINCT notice "Console locked — sign in to continue" (not the sign-out notice), and the next
  // sign-in returns to the page that was locked.
  it('JW-19: after Lock console the Login shows "Console locked — sign in to continue", and signing in returns to the locked page', async () => {
    const { bed, router } = await signedIn('/evidence?status=SEALED')
    await screen.findByTestId('page-evidence')
    fireEvent.click(screen.getByTestId('user-menu'))
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Lock console' }))
    await bed.flush()
    await bed.elapse(2_000, 500)
    const login = await screen.findByTestId('page-login')
    const notice = await within(login).findByTestId('login-alert')
    expect(notice).toHaveAttribute('data-kind', 'console-locked')
    // The SHARED key (closing pass J4, item 2): one sentence for the web console and the devices.
    expect(notice.textContent).toBe(en.login.notices.consoleLocked)
    expect(notice.textContent).not.toMatch(/signed out/i)
    expect(router.state.location.search).toEqual({ redirect: '/evidence?status=SEALED' })

    // The sign-in: the page that was locked comes back, filter and all.
    fireEvent.change(within(login).getByLabelText(/username/i), { target: { value: SUPERVISOR_SESSION.operator.username } })
    fireEvent.change(within(login).getByLabelText(/password/i), { target: { value: ['not', 'a', 'real', 'password'].join('-') } })
    fireEvent.click(within(login).getByRole('button', { name: /sign in/i }))
    await bed.elapse(3_000, 250)
    await waitFor(() => expect(router.state.location.pathname).toBe('/evidence'))
    expect(router.state.location.search).toMatchObject({ status: 'SEALED' })
    expect(await screen.findByTestId('page-evidence')).toBeInTheDocument()
    expect(bed.fake.log.requestsOf('signIn')).toHaveLength(1)
  })

  it('CONTROL (JW-19) - "Sign out" shows the sign-out notice, not the lock notice, and carries no page', async () => {
    const { bed, router } = await signedIn('/evidence')
    await screen.findByTestId('page-evidence')
    fireEvent.click(screen.getByTestId('user-menu'))
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Sign out' }))
    await bed.flush()
    await bed.elapse(2_000, 500)
    const notice = await within(await screen.findByTestId('page-login')).findByTestId('login-alert')
    expect(notice).toHaveAttribute('data-kind', 'signed-out')
    expect(notice.textContent).not.toMatch(/Console locked/)
    expect(router.state.location.search).toEqual({})
  })

  it('Lock console with the Core unreachable: the session ends here at once, the link notice goes without "Reconnected"', async () => {
    const { bed, page, router } = await signedIn('/evidence')
    await screen.findByTestId('page-evidence')
    bed.core.unreachable()
    await bed.flush()
    await screen.findByText(LOST_TITLE)
    const success = vi.spyOn(toast, 'success')
    const close = vi.spyOn(toast, 'close')

    fireEvent.click(screen.getByTestId('user-menu'))
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Lock console' }))
    await bed.flush()
    // Brief list row 16: Lock never does nothing and never fails.
    expect(selectAuth(page.live.store.getState()).status).toBe(AuthStatus.SIGNED_OUT)
    expect(page.live.lastSessionEnd?.signOut).toBe('LOCK')
    expect(page.live.lastSessionEnd?.source).toBe('LOCAL')
    // The notice is closed in the turn of the session's end, while the shell still plays its exit.
    expect(screen.getByTestId('app-shell')).toHaveAttribute('data-leaving', 'true')
    expect(close).toHaveBeenCalledTimes(1)
    await waitFor(() => expect(router.state.location.pathname).toBe('/login'))
    await waitFor(() => expect(lostToasts()).toHaveLength(0))
    expect(titlesOf(success).filter((title) => title === RESTORED)).toEqual([])
    expect(screen.queryByText(en.common.errors.generic)).not.toBeInTheDocument()
  })

  it('Sign out that the Core refuses: the session still ends here, and no error is shown for it', async () => {
    const { bed, page, router } = await signedIn('/evidence')
    await screen.findByTestId('page-evidence')
    const danger = vi.spyOn(toast, 'danger')
    bed.fake.answerOnce('signOut', bed.fake.example('signOut', 403, 'originNotAllowed'))

    fireEvent.click(screen.getByTestId('user-menu'))
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Sign out' }))
    await bed.flush()
    // The refused one, and then the debt the Live source pays for a sign-out the Core has not taken (its own business).
    const sent = bed.fake.log.requestsOf('signOut')
    expect(sent.length).toBeGreaterThanOrEqual(1)
    for (const request of sent) expect(JSON.parse(request.bodyText ?? '{}')).toEqual({ reason: 'USER' })
    // Brief list row 16: Sign out never fails. The action resolved, so the `fail` branch of the menu did not run.
    expect(selectAuth(page.live.store.getState()).status).toBe(AuthStatus.SIGNED_OUT)
    expect(page.live.lastSessionEnd?.signOut).toBe('USER')
    await waitFor(() => expect(router.state.location.pathname).toBe('/login'))
    expect(titlesOf(danger)).toEqual([])
    expect(screen.queryByText(en.common.errors.generic)).not.toBeInTheDocument()
    expect(screen.queryByText(en.common.rbac.deniedTitle)).not.toBeInTheDocument()
  })

  it('a close with 4401 and no message before it: /login, and no link notice', async () => {
    const { bed, page, router } = await signedIn('/evidence')
    await screen.findByTestId('page-evidence')
    const danger = vi.spyOn(toast, 'danger')
    const success = vi.spyOn(toast, 'success')
    bed.core.session!.open = false
    page.sockets.at(-1)!.close(4401)
    await bed.flush()
    expect(selectAuth(page.live.store.getState()).status).toBe(AuthStatus.SIGNED_OUT)
    await waitFor(() => expect(router.state.location.pathname).toBe('/login'))
    await bed.elapse(2_000, 500)
    noLinkNotice(danger, success)
  })
})
