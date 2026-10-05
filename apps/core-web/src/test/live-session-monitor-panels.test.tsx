/**
 * @vitest-environment jsdom
 * @vitest-environment-options { "url": "http://127.0.0.1:5178/" }
 */
// Plan row W65: the panels of the Session Monitor in Live mode — settle sites A9 (`verifyAuditChain`,
// `features/session-monitor/integrity-panel.tsx`), B-3 (`recover`, `index.tsx`) and B-4
// (`setActiveCamera`, `live-feed-panel.tsx`), and the meters, which arrive as `meters` publications
// on the socket (requirement I8) — through the real router and the real Live source on the
// contract-checked fake transport (backend task 04_client_integration_spec §8.2 A9, §8.3 B-3, B-4,
// §8.1 LB-1 to LB-10, §6.2; brief list §17.4 of implementation/44_live_source.md; gate CLG (b) of
// 02_plan §11). The page of this file is `http://127.0.0.1:5178/`.
//
// | Criterion | Where it is proven here |
// |-----------|-------------------------|
// | A9: the Spinner holds until the answer (LB-2); the result is the check over the audit VIEW; a refusal and an outage go to the presenter | "A9 re-verify" |
// | B-3: settle, then the recovery overlay follows the state; refusal (AC-C-48, SESSION_START); a 409 keeps the page's own toast; outage | "B-3 recover" |
// | B-4: the toggle shows the pressed camera at once (LB-4), yields to the store on the settle, reverts on a failure; refusal; outage | "B-4 camera" |
// | I8: the meters move with the socket's `meters` frames; no request is sent for them; a lost link shows NO SIGNAL | "the meters" |
//
// A9 and B-4 call operations whose access rule is AUTHENTICATED (60 `verifyAuditChain`, 51
// `setActiveCamera`): the Core never answers them 403 NOT_PERMITTED, so the contract has no
// `notPermitted` example for them and AC-C-48's denied toast cannot occur there. Their refusal case
// is the 403 the contract does document, ORIGIN_NOT_ALLOWED, which the presenter words with the
// address to open (WT-2a).
import { act, cleanup, configure, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { toast } from '@heroui/react'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { en } from '@dems/shared/i18n'
import type { FakeConnection, FakeCommandOptions } from '@dems/shared/live/testing'
import {
  ALWAYS_VISIBLE,
  createManualClock,
  createMemoryAuthStorage,
  createSim,
  OPERATOR_IDS,
  type AudioFrame,
  type Sim,
} from '@dems/shared/sim'
import { SHELL_INTRO_STORAGE_KEY } from '@/components/shell/shell-entrance'
import { ariaValueNow, formatDbfsValue } from '@/components/composed/dbfs-meter.math'
import { getMissingI18nKeys, resetMissingI18nKeys } from '@/i18n'
import { resetCoreErrorPresenter } from '@/lib/core-errors'
import { webErrorSink } from '@/runtime'
import { createLiveTestBed, SUPERVISOR_SESSION, type LivePage, type LiveTestBed } from '@/runtime/testing/live-harness'

configure({ asyncUtilTimeout: 8_000 })
vi.setConfig({ testTimeout: 30_000 })

const SI = en.session.integrity
const DENIED = en.common.rbac.deniedTitle
const REQUIRES = (role: string) => en.common.rbac.requiresRole.replace('{{role}}', role)
const OFFLINE = en.common.coreErrors.offline
const ORIGIN_REFUSED = en.common.coreErrors.originNotAllowed.split('{{')[0]!
const DBFS = (db: number) => en.common.units.dbfs.replace('{{value}}', formatDbfsValue(db))

type Ops = FakeCommandOptions['ops']

const originalMatchMedia = window.matchMedia
const originalPlay = HTMLMediaElement.prototype.play
const originalPause = HTMLMediaElement.prototype.pause
const originalGetContext = HTMLCanvasElement.prototype.getContext

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
let core: Sim | undefined
/** The page load of the test: its own sink must hold no `live.misuse` report (brief list row 18). */
let loaded: LivePage | undefined

/** The Core's model: a simulator of the recording scenario on the fake clock, the SUPERVISOR signed in. */
function coreModel(at: number, prepare?: (sim: Sim) => void): Sim {
  const authStorage = createMemoryAuthStorage()
  authStorage.save({ operatorId: OPERATOR_IDS.ANDI, issuedAt: at })
  const sim = createSim({
    scenario: 'recording',
    clock: createManualClock(at),
    storage: null,
    authStorage,
    visibility: ALWAYS_VISIBLE,
    scheduler: () => () => undefined,
  })
  prepare?.(sim)
  return sim
}

/** The session slice the Core holds after `run`, as the delta of a command. */
function effect(run: (sim: Sim) => void): Ops {
  run(core!)
  return [{ op: 'replace', slice: 'session', value: JSON.parse(JSON.stringify(core!.store.getState().session)) }] as Ops
}

async function liveMonitor(prepare?: (sim: Sim) => void): Promise<{ bed: LiveTestBed; page: LivePage }> {
  const created = createLiveTestBed({ session: SUPERVISOR_SESSION })
  bed = created
  core = coreModel(created.fake.clock.now(), prepare)
  created.core.served = core.store.getState()
  const page = await created.load()
  loaded = page
  await created.mount(page, '/session')
  await screen.findByTestId('page-session-monitor', {}, { timeout: 15_000 })
  return { bed: created, page }
}

const requests = (operationId: string) => bed!.fake.log.requestsOf(operationId)
const operatorSocket = (page: LivePage): FakeConnection => {
  const socket = page.sockets.filter((connection) => connection.principal === 'OPERATOR' && connection.state === 'OPEN').at(-1)
  if (!socket) throw new Error('the page holds no open operator socket')
  return socket
}

beforeAll(() => {
  HTMLCanvasElement.prototype.getContext = (() => null) as unknown as HTMLCanvasElement['getContext']
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
  HTMLMediaElement.prototype.play = vi.fn(() => Promise.resolve()) as unknown as HTMLMediaElement['play']
  HTMLMediaElement.prototype.pause = vi.fn() as unknown as HTMLMediaElement['pause']
})

afterEach(async () => {
  // Brief list row 18 of implementation/44_live_source.md §17.4: no call site read a Live result as a value.
  const misuse = loaded?.sink.records().filter((record) => record.source === 'live.misuse') ?? []
  loaded = undefined
  cleanup()
  await clearToasts()
  bed?.dispose()
  bed = undefined
  core?.stop()
  core = undefined
  window.matchMedia = originalMatchMedia
  vi.restoreAllMocks()
  expect(misuse.map((record) => `${record.level} ${record.message}`)).toEqual([])
})

describe('A9 re-verify (LB-2; [CS] §8.2)', () => {
  it('success: the Spinner holds until the Core answered; the chip shows the check over the audit view (PASS, then FAIL during a tamper)', async () => {
    const { bed } = await liveMonitor()
    const held = bed.fake.hold('verifyAuditChain')
    fireEvent.click(screen.getByTestId('sm-reverify'))
    expect(screen.getByTestId('sm-reverify')).toHaveTextContent(SI.verifying)
    // The request goes out once the Spinner's literal 700 ms are over, and the Spinner stays while it is out.
    await waitFor(() => expect(requests('verifyAuditChain')).toHaveLength(1), { timeout: 4_000 })
    await new Promise((resolve) => setTimeout(resolve, 300))
    expect(screen.getByTestId('sm-reverify')).toBeDisabled()
    expect(screen.queryByTestId('sm-chain-result')).not.toBeInTheDocument()
    fireEvent.click(screen.getByTestId('sm-reverify'))
    expect(requests('verifyAuditChain')).toHaveLength(1)

    held.release(bed.fake.example('verifyAuditChain', 200, 'intact'))
    await bed.flush()
    await waitFor(() => expect(screen.getByTestId('sm-chain-result')).toHaveAttribute('data-result', 'PASS'))
    expect(screen.getByTestId('sm-chain-result')).toHaveTextContent(SI.verifiedRows.replace('{{count}}', '82'))
    expect(screen.getByTestId('sm-reverify')).not.toBeDisabled()

    // AUDIT_TAMPER: the view is broken (the stored chain is the Security & Audit page's line).
    bed.fake.answerOnce('verifyAuditChain', bed.fake.example('verifyAuditChain', 200, 'viewTampered'))
    fireEvent.click(screen.getByTestId('sm-reverify'))
    await waitFor(() => expect(screen.getByTestId('sm-chain-result')).toHaveAttribute('data-result', 'FAIL'))
    expect(screen.getByTestId('sm-chain-result')).toHaveTextContent(SI.brokenAt.replace('{{index}}', '77'))
    expect(getMissingI18nKeys()).toEqual([])
  })

  it('refusal: the documented 403 (ORIGIN_NOT_ALLOWED) is worded by the presenter with the address; the button returns to idle', async () => {
    const { bed } = await liveMonitor()
    bed.fake.answerOnce('verifyAuditChain', bed.fake.example('verifyAuditChain', 403, 'originNotAllowed'))
    fireEvent.click(screen.getByTestId('sm-reverify'))
    await waitFor(() => expect(toastWith(ORIGIN_REFUSED)).toHaveLength(1))
    expect(toastWith(ORIGIN_REFUSED)[0]).toContain('http://127.0.0.1:5178')
    expect(toastWith(SI.verifyFailed)).toHaveLength(0)
    await waitFor(() => expect(screen.getByTestId('sm-reverify')).not.toBeDisabled())
    expect(screen.getByTestId('sm-reverify')).toHaveTextContent(SI.reverify)
    expect(screen.queryByTestId('sm-chain-result')).not.toBeInTheDocument()
  })

  it('outage (LB-6): the presenter\'s sentence; no result chip, no page toast', async () => {
    const { bed } = await liveMonitor()
    bed.fake.failOnce('verifyAuditChain')
    fireEvent.click(screen.getByTestId('sm-reverify'))
    await waitFor(() => expect(toastWith(OFFLINE)).toHaveLength(1))
    expect(toastWith(SI.verifyFailed)).toHaveLength(0)
    await waitFor(() => expect(screen.getByTestId('sm-reverify')).not.toBeDisabled())
    expect(screen.queryByTestId('sm-chain-result')).not.toBeInTheDocument()
    expect(webErrorSink.records().filter((record) => record.source === 'SessionMonitor.IntegrityPanel.reverify')).toHaveLength(1)
  })
})

describe('B-3 recover ([CS] §8.3)', () => {
  /** A critical fault stopped the recording: the session is in FAULT and the banner offers recovery. */
  const faulted = (sim: Sim) => sim.actions.inject('POWER_FAIL')

  it('success: one POST for the open session; the button is busy until the settle; the recovery overlay follows the state', async () => {
    const { bed, page } = await liveMonitor(faulted)
    expect(screen.getByTestId('page-session-monitor')).toHaveAttribute('data-phase', 'FAULT')
    const sessionId = page.live.store.getState().session!.id
    const command = bed.fake.scriptCommand('recoverSession', { ops: effect((sim) => sim.actions.recover()), order: 'answer-first', answer: bed.fake.example('recoverSession', 202) })
    fireEvent.click(screen.getByTestId('sm-banner-cta'))
    await bed.fake.arrived()
    await bed.flush()
    expect(requests('recoverSession')).toHaveLength(1)
    expect(requests('recoverSession')[0]).toMatchObject({ method: 'POST', params: { id: sessionId } })
    expect(screen.getByTestId('sm-banner-cta')).toHaveAttribute('data-busy', 'true')
    expect(screen.getByTestId('sm-banner-cta').closest('.sm-banner-cta')).toHaveAttribute('aria-busy', 'true')
    fireEvent.click(screen.getByTestId('sm-banner-cta'))
    await bed.flush()
    expect(requests('recoverSession')).toHaveLength(1)
    command.sendDelta()
    await bed.flush()
    const overlay = await screen.findByTestId('finalization-modal')
    expect(overlay).toHaveAttribute('data-mode', 'recovery')
    expect(toastWith(en.session.recovery.failed)).toHaveLength(0)
  })

  it('refusal (AC-C-48): a 403 NOT_PERMITTED shows the denied toast naming the role (SESSION_START)', async () => {
    const { bed } = await liveMonitor(faulted)
    bed.fake.answerOnce('recoverSession', bed.fake.example('recoverSession', 403, 'notPermitted'))
    fireEvent.click(screen.getByTestId('sm-banner-cta'))
    await waitFor(() => expect(toastWith(DENIED)).toHaveLength(1))
    expect(toastWith(DENIED)[0]).toContain(REQUIRES(en.common.roles.INVESTIGATOR))
    expect(toastWith(en.session.recovery.failed)).toHaveLength(0)
    await waitFor(() => expect(screen.getByTestId('sm-banner-cta')).not.toHaveAttribute('data-busy'))
    expect(screen.queryByTestId('finalization-modal')).not.toBeInTheDocument()
  })

  it('a 409 keeps the page\'s own toast; an outage shows the presenter\'s sentence', async () => {
    const { bed } = await liveMonitor(faulted)
    bed.fake.answerOnce('recoverSession', bed.fake.example('recoverSession', 409, 'invalidState'))
    fireEvent.click(screen.getByTestId('sm-banner-cta'))
    await waitFor(() => expect(toastWith(en.session.recovery.failed)).toHaveLength(1))
    await clearToasts()
    bed.fake.failOnce('recoverSession')
    fireEvent.click(screen.getByTestId('sm-banner-cta'))
    await waitFor(() => expect(toastWith(OFFLINE)).toHaveLength(1))
    expect(toastWith(en.session.recovery.failed)).toHaveLength(0)
    expect(requests('recoverSession')).toHaveLength(2)
  })
})

describe('B-4 camera (LB-4; [CS] §8.3)', () => {
  const selected = (id: string) => screen.getByTestId(`sm-camera-${id}`).getAttribute('data-selected') === 'true'
  const feedCamera = () => within(screen.getByTestId('panel-L')).getAllByTestId('camera-feed')[0]!.getAttribute('data-camera')

  it('success: the toggle shows Camera 2 at once while the feed waits for the store; both follow the settle', async () => {
    const { bed, page } = await liveMonitor()
    await waitFor(() => expect(screen.getByTestId('page-session-monitor')).toHaveAttribute('data-phase', 'RECORDING'))
    const command = bed.fake.scriptCommand('setActiveCamera', { ops: [{ op: 'replace', slice: 'activeCameraId', value: 'VIDEO-02' }] as Ops, order: 'answer-first' })
    fireEvent.click(screen.getByTestId('sm-camera-VIDEO-02'))
    await bed.fake.arrived()
    await bed.flush()
    expect(requests('setActiveCamera')[0]).toMatchObject({ method: 'POST', body: { cameraId: 'VIDEO-02' } })
    expect(selected('VIDEO-02')).toBe(true)
    expect(selected('VIDEO-01')).toBe(false)
    expect(feedCamera()).toBe('VIDEO-01')
    expect(screen.getByTestId('sm-camera-VIDEO-02').closest('.sm-card-action')).toHaveAttribute('aria-busy', 'true')
    command.sendDelta()
    await bed.flush()
    await waitFor(() => expect(feedCamera()).toBe('VIDEO-02'))
    expect(page.live.store.getState().activeCameraId).toBe('VIDEO-02')
    expect(selected('VIDEO-02')).toBe(true)
    expect(screen.getByTestId('sm-camera-VIDEO-02').closest('.sm-card-action')).not.toHaveAttribute('aria-busy')
  })

  it('refusal: the documented 403 (ORIGIN_NOT_ALLOWED) is worded by the presenter and the toggle reverts; a 422 reverts with the page\'s log line only', async () => {
    const { bed } = await liveMonitor()
    bed.fake.answerOnce('setActiveCamera', bed.fake.example('setActiveCamera', 403, 'originNotAllowed'))
    fireEvent.click(screen.getByTestId('sm-camera-VIDEO-02'))
    await waitFor(() => expect(toastWith(ORIGIN_REFUSED)).toHaveLength(1))
    await waitFor(() => expect(selected('VIDEO-01')).toBe(true))
    expect(feedCamera()).toBe('VIDEO-01')

    await clearToasts()
    bed.fake.answerOnce('setActiveCamera', bed.fake.example('setActiveCamera', 422))
    fireEvent.click(screen.getByTestId('sm-camera-VIDEO-02'))
    await waitFor(() => expect(requests('setActiveCamera')).toHaveLength(2))
    await waitFor(() => expect(selected('VIDEO-01')).toBe(true))
    expect(toastTexts()).toHaveLength(0)
    expect(webErrorSink.records().filter((record) => record.source === 'SessionMonitor.LiveFeedPanel.switchCamera')).toHaveLength(2)
  })

  it('outage (LB-6): the presenter\'s sentence and the toggle reverts', async () => {
    const { bed } = await liveMonitor()
    bed.fake.failOnce('setActiveCamera')
    fireEvent.click(screen.getByTestId('sm-camera-VIDEO-02'))
    await waitFor(() => expect(toastWith(OFFLINE)).toHaveLength(1))
    await waitFor(() => expect(selected('VIDEO-01')).toBe(true))
    expect(feedCamera()).toBe('VIDEO-01')
  })
})

describe('the meters (I8; [LS] §4 slice `audio`)', () => {
  const frame = (at: number, dbfs: number): AudioFrame => ({ seq: 0, at, dbfs, peak: dbfs + 3, clip: false, noSignal: false })
  const panelMeter = (channel: string) => within(screen.getByTestId('panel-O')).getAllByTestId('dbfs-meter').find((meter) => meter.getAttribute('data-channel') === channel)!
  const meterValue = (channel: string) => panelMeter(channel).querySelector('[role="meter"]')!

  it('move with the socket\'s `meters` frames, send no request for them, and read NO SIGNAL when the link is lost', async () => {
    const { bed, page } = await liveMonitor()
    await waitFor(() => expect(screen.getByTestId('page-session-monitor')).toHaveAttribute('data-phase', 'RECORDING'))
    const socket = operatorSocket(page)
    // Before the first frame the Live source shows a flat "no signal" frame (it never freezes on a stale level).
    expect(panelMeter('AUDIO-01')).toHaveAttribute('data-no-signal', 'true')
    const before = bed.fake.log.requests.length

    const t0 = bed.fake.clock.now()
    act(() => {
      socket.meters({ channels: { 'AUDIO-01': frame(t0, -18.2), 'AUDIO-02': frame(t0, -31.6) } })
    })
    await waitFor(() => expect(panelMeter('AUDIO-01')).not.toHaveAttribute('data-no-signal'))
    expect(meterValue('AUDIO-01')).toHaveAttribute('aria-valuetext', DBFS(-18.2))
    expect(meterValue('AUDIO-01')).toHaveAttribute('aria-valuenow', String(ariaValueNow(-18.2)))
    expect(meterValue('AUDIO-02')).toHaveAttribute('aria-valuetext', DBFS(-31.6))

    // One second later (the ARIA value is written at 1 Hz) the levels moved.
    await bed.elapse(1_000)
    const t1 = bed.fake.clock.now()
    act(() => {
      socket.meters({ channels: { 'AUDIO-01': frame(t1, -9.4), 'AUDIO-02': frame(t1, -24.1) } })
    })
    await waitFor(() => expect(meterValue('AUDIO-01')).toHaveAttribute('aria-valuetext', DBFS(-9.4)))
    expect(meterValue('AUDIO-02')).toHaveAttribute('aria-valuetext', DBFS(-24.1))
    expect(page.live.store.getState().audio.channels['AUDIO-01'].dbfs).toBe(-9.4)

    // The frames are pushed: no request was sent for them, and none in five quiet seconds either.
    await bed.elapse(5_000, 500)
    expect(bed.fake.log.requests.slice(before).map((call) => call.operationId)).toEqual([])

    // The link is lost: both meters read NO SIGNAL (a flat frame of the Live source), not the last level.
    act(() => bed.core.unreachable())
    await bed.flush()
    await waitFor(() => expect(panelMeter('AUDIO-01')).toHaveAttribute('data-no-signal', 'true'))
    expect(panelMeter('AUDIO-02')).toHaveAttribute('data-no-signal', 'true')
    act(() => bed.core.back())
    await bed.elapse(4_000, 500)
  })
})
