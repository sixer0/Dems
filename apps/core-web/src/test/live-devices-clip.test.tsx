/**
 * @vitest-environment jsdom
 * @vitest-environment-options { "url": "http://127.0.0.1:5178/" }
 */
// Plan row W70: settle site B-8 of Devices & Inputs — the clip-latch reset of an audio card
// (`features/devices/audio-input-card.tsx`, `resetClip` → operation 52 `resetMicClip`) — in Live
// mode on the contract-checked fake transport, and the same button in Simulated mode as the
// control group (backend task 04_client_integration_spec §8.3 B-8, §8.1 LB-1 to LB-10, §6.2; gate
// CLG (b) of 02_plan §11).
//
// | Criterion | Where it is proven here |
// |-----------|-------------------------|
// | B-8 success: one request with the channel, the CLIP latch leaves when the Core's delta arrives, the toast after it | "B-8 success" |
// | B-8 refusal (AC-C-48 for an operation every signed-in role may call): a 403 is worded by the presenter, the latch stays, the button returns to idle | "B-8 refusal" |
// | B-8 outage (LB-6) and a limit (LB-10) | "B-8 outage" |
// | LB-1: busy at once (a second press sends nothing, the fact is `aria-busy`), spinner late | "B-8 pending" |
// | Simulated mode: the reset settles in the press, as before | "Simulated mode is unchanged" |
import { act, cleanup, configure, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { toast } from '@heroui/react'
import { QueryClient } from '@tanstack/react-query'
import { createMemoryHistory, RouterProvider } from '@tanstack/react-router'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { en } from '@dems/shared/i18n'
import { LiveLinkState } from '@dems/shared/live'
import { rateLimited, refusal, type FakeCommandOptions } from '@dems/shared/live/testing'
import type { SocketLike } from '@dems/shared/realtime'
import { ALWAYS_VISIBLE, createManualClock, createMemoryAuthStorage, createSim, OPERATOR_IDS, type Sim, type SimState } from '@dems/shared/sim'
import { SHELL_INTRO_STORAGE_KEY } from '@/components/shell/shell-entrance'
import { getMissingI18nKeys, resetMissingI18nKeys } from '@/i18n'
import { resetCoreErrorPresenter } from '@/lib/core-errors'
import { createAppRouter } from '@/router'
import { webErrorSink } from '@/runtime'
import { createLiveTestBed, INVESTIGATOR_SESSION, LIVE_TEST_ORIGIN, type LivePage, type LiveTestBed } from '@/runtime/testing/live-harness'

configure({ asyncUtilTimeout: 8_000 })
vi.setConfig({ testTimeout: 25_000 })

const CLIP_RESET = (name: string) => en.devices.actions.clipReset.replace('{{name}}', name)
const FAILED = en.devices.actions.failed
const DENIED = en.common.rbac.deniedTitle
const OFFLINE = en.common.coreErrors.offline
const PAGE_SOURCE = 'features/devices.resetClip'

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

/** A state whose AUDIO-01 latch is lit (a clipped peak the operator has not reset). */
const withLatch = (state: SimState, latched: boolean): SimState => ({
  ...state,
  mics: state.mics.map((mic) => (mic.id === 'AUDIO-01' ? { ...mic, clipLatched: latched } : mic)),
})
/** The served mics with the latch cleared: the effect of operation 52 on the Core. */
const micsCleared = (state: SimState) => JSON.parse(JSON.stringify(withLatch(state, false).mics))

let bed: LiveTestBed | undefined

/** Devices & Inputs in Live mode with the AUDIO-01 latch lit. Every signed-in role may reset it (operation 52). */
async function liveDevicesLatched(): Promise<{ bed: LiveTestBed; page: LivePage }> {
  const created = createLiveTestBed({ session: INVESTIGATOR_SESSION })
  bed = created
  created.core.served = withLatch(created.core.served, true)
  const page = await created.load()
  await created.mount(page, '/devices')
  await screen.findByTestId('page-devices')
  await screen.findByTestId('clip-reset-AUDIO-01')
  return { bed: created, page }
}

const resetButton = () => screen.getByTestId('clip-reset-AUDIO-01')
/** The clip fact of the card: it carries `aria-busy` while the reset is out (the kit's Button drops it, F63-2). */
const clipFact = () => screen.getByTestId('audio-input-AUDIO-01').querySelector('[data-fact="clip"]') as HTMLElement
const requests = (operationId: string) => bed!.fake.log.requestsOf(operationId)
const pageRecords = () => webErrorSink.records().filter((record) => record.source === PAGE_SOURCE)

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

describe('B-8 success (§8.3: settle; the CLIP chip leaves when the delta arrives)', () => {
  it('one POST to operation 52 with the channel; the latch and the button leave with the Core\'s delta, and the toast follows', async () => {
    const { bed } = await liveDevicesLatched()
    expect(screen.getByTestId('audio-input-AUDIO-01')).toHaveAttribute('data-status', 'CLIP')
    const command = bed.fake.scriptCommand('resetMicClip', {
      ops: [{ op: 'replace', slice: 'mics', value: micsCleared(bed.core.served) }] as FakeCommandOptions['ops'],
      order: 'delta-first',
    })
    fireEvent.click(resetButton())
    await waitFor(() => expect(toastWith(CLIP_RESET('MIC 1'))).toHaveLength(1))
    expect(command.deltaSent).toBe(true)
    expect(requests('resetMicClip')).toHaveLength(1)
    expect(requests('resetMicClip')[0]).toMatchObject({ method: 'POST', path: '/api/v1/audio/clip/reset' })
    expect(requests('resetMicClip')[0]?.body).toEqual({ channel: 'AUDIO-01' })
    expect(screen.queryByTestId('clip-reset-AUDIO-01')).not.toBeInTheDocument()
    expect(screen.getByTestId('audio-input-AUDIO-01')).toHaveAttribute('data-status', 'READY')
    expect(clipFact()).not.toHaveAttribute('aria-busy')
    expect(pageRecords()).toHaveLength(0)
    expect(getMissingI18nKeys()).toEqual([])
  })

  it('when the answer comes first, nothing is announced until the delta arrives: the button stays busy, then leaves with the toast (CL-16)', async () => {
    const { bed } = await liveDevicesLatched()
    const command = bed.fake.scriptCommand('resetMicClip', {
      ops: [{ op: 'replace', slice: 'mics', value: micsCleared(bed.core.served) }] as FakeCommandOptions['ops'],
      order: 'answer-first',
    })
    fireEvent.click(resetButton())
    await waitFor(() => expect(requests('resetMicClip')).toHaveLength(1))
    await bed.flush()
    expect(command.deltaSent).toBe(false)
    expect(resetButton()).toBeInTheDocument()
    expect(clipFact()).toHaveAttribute('aria-busy', 'true')
    expect(toastWith(CLIP_RESET('MIC 1'))).toHaveLength(0)

    await act(async () => {
      command.sendDelta()
    })
    await bed.flush()
    await waitFor(() => expect(toastWith(CLIP_RESET('MIC 1'))).toHaveLength(1))
    expect(screen.queryByTestId('clip-reset-AUDIO-01')).not.toBeInTheDocument()
    expect(clipFact()).not.toHaveAttribute('aria-busy')
  })
})

describe('B-8 refusal (§6.2; LB-5)', () => {
  it('a 403 FORBIDDEN is worded by the presenter as the denied toast; the latch stays and the button is idle again, with no record of the page\'s own', async () => {
    const { bed } = await liveDevicesLatched()
    // Operation 52 needs a session only, so its 403 is FORBIDDEN (`forbidden()`), never NOT_PERMITTED.
    bed.fake.answerOnce('resetMicClip', refusal(403, 'FORBIDDEN', 'Refused.'))
    fireEvent.click(resetButton())
    await waitFor(() => expect(toastWith(DENIED)).toHaveLength(1))
    expect(toastWith(CLIP_RESET('MIC 1'))).toHaveLength(0)
    expect(toastWith(FAILED)).toHaveLength(0)
    expect(resetButton()).toBeInTheDocument()
    expect(clipFact()).not.toHaveAttribute('aria-busy')
    expect(pageRecords()).toHaveLength(0)
    // Idle again: a second press sends a second request.
    bed.fake.answerFromExample('resetMicClip')
    fireEvent.click(resetButton())
    await waitFor(() => expect(requests('resetMicClip')).toHaveLength(2))
  })

  it('the contract\'s own 403 of a web console (`originNotAllowed`) names the address to open (WT-2a)', async () => {
    const { bed } = await liveDevicesLatched()
    bed.fake.answerOnce('resetMicClip', bed.fake.example('resetMicClip', 403, 'originNotAllowed'))
    fireEvent.click(resetButton())
    const expected = en.common.coreErrors.originNotAllowed.replace('{{address}}', LIVE_TEST_ORIGIN)
    await waitFor(() => expect(toastWith(expected)).toHaveLength(1))
    expect(toastWith(CLIP_RESET('MIC 1'))).toHaveLength(0)
    expect(resetButton()).toBeInTheDocument()
  })

  it('a refusal the presenter leaves to the page (422 INVALID_INPUT) keeps the existing friendly toast and writes one record with code and status only', async () => {
    const { bed } = await liveDevicesLatched()
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    bed.fake.answerOnce('resetMicClip', bed.fake.example('resetMicClip', 422, 'invalidInput'))
    fireEvent.click(resetButton())
    await waitFor(() => expect(toastWith(FAILED)).toHaveLength(1))
    const records = pageRecords()
    expect(records).toHaveLength(1)
    expect(records[0]).toMatchObject({ level: 'error', message: 'A clip latch reset of Devices & Inputs was not carried out.' })
    expect(records[0]?.context).toMatchObject({ channel: 'AUDIO-01' })
    expect(records[0]?.context?.errorName).toEqual(expect.any(String))
    expect(String(records[0]?.context?.correlationId)).toMatch(/^dev-/)
    expect(records[0]?.stack).toBeUndefined()
    expect(resetButton()).toBeInTheDocument()
  })
})

describe('B-8 outage (LB-6; LB-10)', () => {
  it('a request that gets no answer shows the presenter\'s sentence; the latch stays and the button is idle', async () => {
    const { bed } = await liveDevicesLatched()
    bed.fake.failOnce('resetMicClip')
    fireEvent.click(resetButton())
    await waitFor(() => expect(toastWith(OFFLINE)).toHaveLength(1))
    expect(toastWith(CLIP_RESET('MIC 1'))).toHaveLength(0)
    expect(resetButton()).toBeInTheDocument()
    expect(clipFact()).not.toHaveAttribute('aria-busy')
    expect(pageRecords()).toHaveLength(0)
  })

  it('with the link down the reset is refused at once without a request', async () => {
    const { bed, page } = await liveDevicesLatched()
    bed.core.unreachable()
    await bed.flush()
    expect(page.live.link).toBe(LiveLinkState.OFFLINE)
    fireEvent.click(resetButton())
    await waitFor(() => expect(toastWith(OFFLINE)).toHaveLength(1))
    expect(requests('resetMicClip')).toHaveLength(0)
  })

  it('LB-10: a 429 shows the limit toast, never the outage sentence', async () => {
    const { bed } = await liveDevicesLatched()
    bed.fake.answerOnce('resetMicClip', rateLimited(7))
    fireEvent.click(resetButton())
    await waitFor(() => expect(toastWith(en.common.coreErrors.limited.replace('{{seconds}}', '7'))).toHaveLength(1))
    expect(toastWith(OFFLINE)).toHaveLength(0)
    expect(toastWith(FAILED)).toHaveLength(0)
    expect(resetButton()).toBeInTheDocument()
  })
})

describe('B-8 pending (LB-1: busy at once, spinner late)', () => {
  it('a second press while the reset is out sends nothing; the spinner replaces the icon only after LIVE_PENDING_REVEAL_MS', async () => {
    const { bed } = await liveDevicesLatched()
    const held = bed.fake.hold('resetMicClip')
    fireEvent.click(resetButton())
    await waitFor(() => expect(requests('resetMicClip')).toHaveLength(1))
    await bed.flush()
    expect(clipFact()).toHaveAttribute('aria-busy', 'true')
    expect(resetButton()).not.toHaveAttribute('data-pending')
    expect(resetButton().querySelector('svg.lucide-rotate-ccw')).not.toBeNull()
    fireEvent.click(resetButton())
    await bed.flush()
    expect(requests('resetMicClip')).toHaveLength(1)

    await waitFor(() => expect(resetButton()).toHaveAttribute('data-pending', 'true'), { timeout: 3_000 })
    expect(resetButton().querySelector('svg.lucide-rotate-ccw')).toBeNull()
    expect(resetButton()).toHaveTextContent(en.devices.audio.resetClip)

    await act(async () => {
      held.release()
    })
    await bed.flush()
    await waitFor(() => expect(toastWith(CLIP_RESET('MIC 1'))).toHaveLength(1))
    expect(clipFact()).not.toHaveAttribute('aria-busy')
    expect(requests('resetMicClip')).toHaveLength(1)
  })
})

// ── The control group: the same button in Simulated mode ───────────────────────────────────

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
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 503 })))
  })
  afterEach(() => {
    for (const sim of sims.splice(0)) sim.stop()
    vi.unstubAllGlobals()
  })

  it('the reset clears the latch in the press, shows its toast, and never marks the fact busy', async () => {
    const authStorage = createMemoryAuthStorage()
    authStorage.save({ operatorId: OPERATOR_IDS.BUDI, issuedAt: DEMO_NOW })
    const sim = createSim({
      clock: createManualClock(DEMO_NOW),
      scenario: 'idle',
      storage: null,
      authStorage,
      visibility: ALWAYS_VISIBLE,
      scheduler: () => () => undefined,
    })
    sims.push(sim)
    sim.store.setState(withLatch(sim.store.getState(), true))
    const router = createAppRouter(
      { sim, queryClient: new QueryClient({ defaultOptions: { queries: { retry: false } } }), socketFactory: () => new SilentSocket() },
      { history: createMemoryHistory({ initialEntries: ['/devices'] }) },
    )
    render(<RouterProvider router={router} />)
    const button = await screen.findByTestId('clip-reset-AUDIO-01')
    const fact = clipFact()
    fireEvent.click(button)
    // Synchronous: the simulator cleared the latch in the press.
    expect(sim.store.getState().mics.find((mic) => mic.id === 'AUDIO-01')?.clipLatched).toBe(false)
    expect(fact).not.toHaveAttribute('aria-busy')
    await waitFor(() => expect(toastWith(CLIP_RESET('MIC 1'))).toHaveLength(1))
    expect(screen.queryByTestId('clip-reset-AUDIO-01')).not.toBeInTheDocument()
  })
})
