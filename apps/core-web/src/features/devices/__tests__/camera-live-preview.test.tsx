/**
 * @vitest-environment jsdom
 * @vitest-environment-options { "url": "http://127.0.0.1:5178/" }
 */
// Decisions D51 / D53 (plan D53 part (d), row 92): the live camera preview of the web console. Operation 112
// `createCameraPreviewSession` issues a short-lived token; its PATH is the `src` of an `<img>` streamed by the Core.
//
// | Surface | A PRODUCTION camera on a Core in real capture | A development source / Simulated mode |
// |---------|-----------------------------------------------|---------------------------------------|
// | Devices & Inputs camera tiles | the live preview | "No preview" / the demo picture (`camera-no-preview.test.tsx`) |
// | Session New camera previews | the live preview; "paused" while the session is being started | the same |
// | Session Monitor live feed | the live preview; the input thumbs keep "No preview" | the same |
// | Dashboard | "No preview" (no preview there) | the same |
//
// The double is the contract-checked fake transport of the Live test bed; jsdom loads no image, so a test fires the
// picture's `load` and `error` itself. No browser and no Core were run (the bench check is the controller's).
import { cleanup, configure, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { QueryClient } from '@tanstack/react-query'
import { createMemoryHistory, RouterProvider } from '@tanstack/react-router'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { en } from '@dems/shared/i18n'
import type { SocketLike } from '@dems/shared/realtime'
import { ALWAYS_VISIBLE, createMemoryAuthStorage, createSim, OPERATOR_IDS, type Sim, type SimState } from '@dems/shared/sim'
import { SHELL_INTRO_STORAGE_KEY } from '@/components/shell/shell-entrance'
import { coreWithSession, CORE_START_MS, stubMediaForJsdom } from '@/features/session-new/__tests__/live-session-new-bed'
import { resetCoreErrorPresenter } from '@/lib/core-errors'
import { createAppRouter } from '@/router'
import { createLiveTestBed, SUPERVISOR_SESSION, type LiveTestBed } from '@/runtime/testing/live-harness'
import { pageTimersFake, pageTimersReal, pass } from '@/runtime/testing/fake-time'
import {
  isLivePreviewDevice,
  isSessionStarting,
  PREVIEW_AUTH_REFUSED_RETRY_MS,
  PREVIEW_NOT_AVAILABLE_RETRY_MS,
  previewPathOf,
  previewRefusalOf,
  previewRetryDelayMs,
} from '../camera-live-preview'

configure({ asyncUtilTimeout: 8_000 })
vi.setConfig({ testTimeout: 30_000 })

const PV = en.devices.preview
type Device = SimState['captureDevices']['devices'][number]
/** The contract example's placeholder token: the path the console must use (never the example's loopback host). */
const EXAMPLE_PATH = `/preview/cps_${'0'.repeat(43)}`

/** A Core in real capture whose cameras in `production` are production cameras (ONVIF); every other source is a development source. */
const production =
  (ids: readonly string[] = ['CAM-01']) =>
  (state: SimState): SimState => ({
    ...state,
    captureDevices: {
      devices: state.captureDevices.devices.map((device) =>
        (device.kind === 'CAMERA' && ids.includes(device.id) ? { ...device, adapter: 'ONVIF_RTSP', sourceClass: 'PRODUCTION' } : { ...device, adapter: 'FAKE', sourceClass: 'DEVELOPMENT' }) as Device,
      ),
    },
  })

let bed: LiveTestBed | undefined
const sims: Sim[] = []

async function livePage(path: string, pageId: string, served: (idle: SimState) => SimState, script?: (bed: LiveTestBed) => void) {
  const created = createLiveTestBed({ session: SUPERVISOR_SESSION })
  bed = created
  created.core.served = served(created.core.served)
  script?.(created)
  const page = await created.load()
  const entry = await created.mount(page, path)
  const root = await screen.findByTestId(pageId, {}, { timeout: 15_000 })
  return { root, entry }
}

const previews = (root: ParentNode = document) => Array.from(root.querySelectorAll<HTMLElement>('[data-testid="camera-live-preview"]'))
const noPreviews = (root: ParentNode = document) => Array.from(root.querySelectorAll<HTMLElement>('[data-testid="camera-no-preview"]'))
const imageOf = (preview: HTMLElement) => preview.querySelector<HTMLImageElement>('[data-testid="camera-live-preview-image"]')
const issued = () => bed!.fake.log.requestsOf('createCameraPreviewSession')

/** A refusal of operation 112 built on the contract's 409 example: its `details` replaced, its status and code as given. */
function refusal(status: 409 | 429, details: Record<string, string>) {
  const example = bed!.fake.example('createCameraPreviewSession', 409, 'notAvailable') as { status: number; body: { error: Record<string, unknown> } }
  return {
    status,
    body: { error: { ...example.body.error, code: status === 429 ? 'RATE_LIMITED' : 'INVALID_STATE', details } },
    ...(status === 429 ? { retryAfterSeconds: 5 } : {}),
  }
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

let restoreMedia: () => void = () => undefined
beforeAll(() => {
  restoreMedia = stubMediaForJsdom()
  Element.prototype.scrollTo ??= function scrollTo() {}
  window.scrollTo = (() => undefined) as typeof window.scrollTo
  Element.prototype.getAnimations ??= function getAnimations() {
    return []
  }
})
afterAll(() => restoreMedia())
beforeEach(() => {
  resetCoreErrorPresenter()
  window.localStorage.clear()
  window.sessionStorage.clear()
  window.sessionStorage.setItem(SHELL_INTRO_STORAGE_KEY, '1')
})
afterEach(() => {
  pageTimersReal()
  cleanup()
  for (const sim of sims.splice(0)) sim.stop()
  bed?.dispose()
  bed = undefined
  vi.restoreAllMocks()
})

describe('the rules (pure)', () => {
  it('backoff 2 s, 4 s, 8 s, 16 s, then 30 s at most', () => {
    expect([1, 2, 3, 4, 5, 6, 20].map(previewRetryDelayMs)).toEqual([2_000, 4_000, 8_000, 16_000, 30_000, 30_000, 30_000])
  })

  it('only the path of the answered URL is used; anything else is refused', () => {
    expect(previewPathOf(`http://127.0.0.1:4420${EXAMPLE_PATH}`)).toBe(EXAMPLE_PATH)
    expect(previewPathOf('http://127.0.0.1:4420/media/mts_abc')).toBeNull()
    expect(previewPathOf(`http://127.0.0.1:4420${EXAMPLE_PATH}?x=1`)).toBeNull()
    expect(previewPathOf('/preview/cps_abc')).toBeNull()
    expect(previewPathOf(42)).toBeNull()
  })

  it('a refusal: 429 -> the limit after retry-after (at least the backoff); 409 AUTH_REFUSED -> 5 min; 409 -> 1 min; else the backoff', () => {
    expect(previewRefusalOf({ status: 429, error: { details: { reason: 'PREVIEW_LIMIT' } }, retryAfterSeconds: 5 }, 1)).toEqual({ kind: 'LIMIT', retryMs: 5_000 })
    expect(previewRefusalOf({ status: 429, error: {}, retryAfterSeconds: null }, 3)).toEqual({ kind: 'LIMIT', retryMs: 8_000 })
    expect(previewRefusalOf({ status: 409, error: { details: { reason: 'PREVIEW_NOT_AVAILABLE', cause: 'AUTH_REFUSED' } }, retryAfterSeconds: null }, 1)).toEqual({ kind: 'AUTH_REFUSED', retryMs: PREVIEW_AUTH_REFUSED_RETRY_MS })
    expect(previewRefusalOf({ status: 409, error: { details: { reason: 'PREVIEW_NOT_AVAILABLE' } }, retryAfterSeconds: null }, 1)).toEqual({ kind: 'NOT_AVAILABLE', retryMs: PREVIEW_NOT_AVAILABLE_RETRY_MS })
    expect(previewRefusalOf({ status: null, error: {}, retryAfterSeconds: null }, 2)).toEqual({ kind: 'OTHER', retryMs: 4_000 })
  })

  it('a session is "being started" in CREATE, PRECHECK and ARMED; only a production camera has a preview', () => {
    expect(['CREATE', 'PRECHECK', 'ARMED'].map(isSessionStarting)).toEqual([true, true, true])
    expect(['RECORDING', 'SEALED', null].map(isSessionStarting)).toEqual([false, false, false])
    expect(isLivePreviewDevice({ kind: 'CAMERA', sourceClass: 'PRODUCTION' })).toBe(true)
    expect(isLivePreviewDevice({ kind: 'CAMERA', sourceClass: 'DEVELOPMENT' })).toBe(false)
    expect(isLivePreviewDevice({ kind: 'MIC', sourceClass: 'PRODUCTION' })).toBe(false)
    expect(isLivePreviewDevice(undefined)).toBe(false)
  })
})

describe('Devices & Inputs: the live preview of a production camera', () => {
  it('issues ONE token for the camera on the track, sets the path as the picture, says connecting, then live; the development source keeps "No preview"', async () => {
    const { root } = await livePage('/devices', 'page-devices', production())
    const tile = await within(root).findByTestId('camera-tile-VIDEO-01')
    await waitFor(() => expect(previews(tile)).toHaveLength(1))
    const [preview] = previews(tile)
    await waitFor(() => expect(imageOf(preview!)).not.toBeNull())
    expect(issued()).toHaveLength(1)
    expect(issued()[0]!.params).toEqual({ id: 'CAM-01' })
    // The PATH, resolved against the console's own origin: never the Core's loopback host of the answer.
    expect(imageOf(preview!)!.getAttribute('src')).toBe(EXAMPLE_PATH)
    expect(preview).toHaveAttribute('role', 'img')
    expect(preview).toHaveAttribute('data-state', 'CONNECTING')
    expect(preview!.getAttribute('aria-label')).toMatch(new RegExp(`^Live preview of ${en.common.tracks['VIDEO-01']} · .*CAM-01.*\\. ${PV.connecting}$`))
    expect(preview).toHaveTextContent(PV.connecting)
    fireEvent.load(imageOf(preview!)!)
    await waitFor(() => expect(preview).toHaveAttribute('data-state', 'LIVE'))
    expect(preview!.getAttribute('aria-label')).toMatch(new RegExp(`\\. ${PV.live}$`))
    // The other track's camera is a development source: no preview there, and no token asked for it.
    expect(previews(within(root).getByTestId('camera-tile-VIDEO-02'))).toHaveLength(0)
    expect(noPreviews(within(root).getByTestId('camera-tile-VIDEO-02'))).toHaveLength(1)
    expect(issued().every((call) => call.params.id === 'CAM-01')).toBe(true)
  })

  it('StrictMode (main.tsx, and this console is a dev build): the fake unmount takes the src away and the re-attach gives ' +
     'it back — one token, one picture, no eternal "Connecting…" (the bench finding of 2026-11-04)', async () => {
    const created = createLiveTestBed({ session: SUPERVISOR_SESSION })
    bed = created
    created.core.served = production()(created.core.served)
    const page = await created.load()
    const entry = await created.mount(page, '/devices', { strict: true })
    const root = await screen.findByTestId('page-devices', {}, { timeout: 15_000 })
    const tile = await within(root).findByTestId('camera-tile-VIDEO-01')
    await waitFor(() => expect(previews(tile)).toHaveLength(1))
    const [preview] = previews(tile)
    await waitFor(() => expect(imageOf(preview!)).not.toBeNull())
    // The double mount stays ONE token (deferEffectStart) — and the double ref-attach keeps the src SET (the ref applies it).
    await waitFor(() => expect(issued()).toHaveLength(1))
    expect(imageOf(preview!)!.getAttribute('src')).toBe(EXAMPLE_PATH)
    fireEvent.load(imageOf(preview!)!)
    await waitFor(() => expect(preview).toHaveAttribute('data-state', 'LIVE'))
    entry.unmount()
  })

  it('a failed picture: the src goes, a new token after 2 s, then after 4 s (backoff); a picture that loads resets it', async () => {
    const { root } = await livePage('/devices', 'page-devices', production())
    const tile = await within(root).findByTestId('camera-tile-VIDEO-01')
    await waitFor(() => expect(imageOf(previews(tile)[0]!)).not.toBeNull())
    expect(issued()).toHaveLength(1)
    pageTimersFake()
    fireEvent.error(imageOf(previews(tile)[0]!)!)
    await pass(100)
    expect(imageOf(previews(tile)[0]!)).toBeNull()
    expect(previews(tile)[0]).toHaveAttribute('data-state', 'CONNECTING')
    await pass(1_800)
    expect(issued()).toHaveLength(1)
    await pass(200)
    expect(issued()).toHaveLength(2)
    await pass(100)
    expect(imageOf(previews(tile)[0]!)).not.toBeNull()
    // The second failure in a row waits 4 s.
    fireEvent.error(imageOf(previews(tile)[0]!)!)
    await pass(3_800)
    expect(issued()).toHaveLength(2)
    await pass(300)
    expect(issued()).toHaveLength(3)
    await pass(100)
    // A picture that loads: the next failure is the first again (2 s).
    fireEvent.load(imageOf(previews(tile)[0]!)!)
    await pass(50)
    fireEvent.error(imageOf(previews(tile)[0]!)!)
    await pass(2_100)
    expect(issued()).toHaveLength(4)
  })

  // 2026-11-03 (bench, the principal's CAM-03): the Core refuses the stream for an unreachable
  // camera but an <img> cannot read that — three failed pictures without one frame must say the
  // unavailable sentence, keep the backoff alive, and return to LIVE when a frame finally arrives.
  // 2026-11-04 (bench, CAM-03 moved to a dead PoE port): a SILENT host never fires `error` either —
  // the first-frame watchdog counts the missing frame as the failure the events failed to report.
  it('a silent picture (no load, no error, host unreachable): the watchdog fails it at 10 s and three of them say unavailable', async () => {
    const { root } = await livePage('/devices', 'page-devices', production())
    const tile = await within(root).findByTestId('camera-tile-VIDEO-01')
    await waitFor(() => expect(imageOf(previews(tile)[0]!)).not.toBeNull())
    pageTimersFake()
    // The mount's own timer predates the fake clock, so failure one arrives as an event; from the
    // SECOND picture on, nothing is fired at all — the watchdog alone must carry it to the sentence.
    fireEvent.error(imageOf(previews(tile)[0]!)!) // failure 1: retry at 2 s
    await pass(2_100)
    expect(issued()).toHaveLength(2)
    await pass(10_050) // silence two: the watchdog fails it, no event fired; retry at 4 s
    expect(previews(tile)[0]).toHaveAttribute('data-state', 'CONNECTING')
    expect(issued()).toHaveLength(2)
    await pass(4_100)
    expect(issued()).toHaveLength(3)
    await pass(10_050) // silence three: the honest sentence
    expect(previews(tile)[0]).toHaveAttribute('data-state', 'UNAVAILABLE')
    expect(previews(tile)[0]).toHaveTextContent(PV.unavailable)
    pageTimersReal()
  })

  it('three failed pictures without a frame: the honest sentence, still retrying; a frame returns it to LIVE', async () => {
    const { root } = await livePage('/devices', 'page-devices', production())
    const tile = await within(root).findByTestId('camera-tile-VIDEO-01')
    await waitFor(() => expect(imageOf(previews(tile)[0]!)).not.toBeNull())
    pageTimersFake()
    fireEvent.error(imageOf(previews(tile)[0]!)!) // failure 1: still connecting, retry at 2 s
    await pass(2_100)
    await pass(200)
    expect(imageOf(previews(tile)[0]!)).not.toBeNull()
    fireEvent.error(imageOf(previews(tile)[0]!)!) // failure 2: connecting, retry at 4 s
    await pass(4_100)
    await pass(200)
    expect(imageOf(previews(tile)[0]!)).not.toBeNull()
    expect(previews(tile)[0]).toHaveAttribute('data-state', 'CONNECTING')
    fireEvent.error(imageOf(previews(tile)[0]!)!) // failure 3: the tile now says what the Core knows
    await pass(50)
    expect(previews(tile)[0]).toHaveAttribute('data-state', 'UNAVAILABLE')
    expect(previews(tile)[0]!.textContent).toContain(PV.unavailable)
    // The retry is not abandoned: at the 8 s step a new token is asked and the picture returns.
    await pass(8_100)
    await pass(200)
    expect(issued().length).toBeGreaterThanOrEqual(4)
    expect(imageOf(previews(tile)[0]!)).not.toBeNull()
    expect(previews(tile)[0]).toHaveAttribute('data-state', 'UNAVAILABLE')
    fireEvent.load(imageOf(previews(tile)[0]!)!)
    await pass(50)
    expect(previews(tile)[0]).toHaveAttribute('data-state', 'LIVE')
  })

  // The refusal is answered to the SECOND token: the first one opens the picture, its failure arms a retry on the fake
  // clock (a timer armed on the system clock before `pageTimersFake` stays real), and that retry is refused.
  async function refusedOnRetry(reply: () => unknown) {
    let calls = 0
    const { root } = await livePage('/devices', 'page-devices', production(), (created) => {
      created.fake.answer('createCameraPreviewSession', () => {
        calls += 1
        return (calls === 2 ? reply() : created.fake.example('createCameraPreviewSession', 201, 'opened')) as ReturnType<typeof created.fake.example>
      })
    })
    const tile = await within(root).findByTestId('camera-tile-VIDEO-01')
    await waitFor(() => expect(imageOf(previews(tile)[0]!)).not.toBeNull())
    pageTimersFake()
    fireEvent.error(imageOf(previews(tile)[0]!)!)
    await pass(2_100)
    expect(issued()).toHaveLength(2)
    return tile
  }

  it('429 PREVIEW_LIMIT: the limit sentence, and a new token only after the Core\'s retry-after', async () => {
    const tile = await refusedOnRetry(() => refusal(429, { reason: 'PREVIEW_LIMIT' }))
    expect(previews(tile)[0]).toHaveAttribute('data-state', 'LIMIT')
    expect(previews(tile)[0]).toHaveTextContent(PV.limit)
    expect(previews(tile)[0]!.getAttribute('aria-label')?.endsWith(`. ${PV.limit}`)).toBe(true)
    expect(imageOf(previews(tile)[0]!)).toBeNull()
    // retry-after 5 s (more than the 4 s backoff step of the second failure).
    await pass(4_700)
    expect(issued()).toHaveLength(2)
    await pass(400)
    expect(issued()).toHaveLength(3)
    await pass(100)
    expect(imageOf(previews(tile)[0]!)!.getAttribute('src')).toBe(EXAMPLE_PATH)
  })

  it('409 with cause AUTH_REFUSED: "not available", and no new token before the Core\'s 5 min window ends', async () => {
    const tile = await refusedOnRetry(() => refusal(409, { reason: 'PREVIEW_NOT_AVAILABLE', cause: 'AUTH_REFUSED' }))
    expect(previews(tile)[0]).toHaveAttribute('data-state', 'UNAVAILABLE')
    expect(previews(tile)[0]).toHaveTextContent(PV.unavailable)
    await pass(PREVIEW_NOT_AVAILABLE_RETRY_MS + 1_000)
    expect(issued()).toHaveLength(2)
    await pass(PREVIEW_AUTH_REFUSED_RETRY_MS - PREVIEW_NOT_AVAILABLE_RETRY_MS)
    expect(issued()).toHaveLength(3)
  })

  it('unmount ends the stream: the picture\'s src is removed', async () => {
    const { root, entry } = await livePage('/devices', 'page-devices', production())
    const tile = await within(root).findByTestId('camera-tile-VIDEO-01')
    await waitFor(() => expect(imageOf(previews(tile)[0]!)).not.toBeNull())
    const image = imageOf(previews(tile)[0]!)!
    expect(image.getAttribute('src')).toBe(EXAMPLE_PATH)
    entry.unmount()
    expect(image.hasAttribute('src')).toBe(false)
  })

  it('Simulated mode: no token is asked for and no live preview is drawn; the demo picture stays', async () => {
    const authStorage = createMemoryAuthStorage()
    authStorage.save({ operatorId: OPERATOR_IDS.ANDI, issuedAt: Date.now() })
    const sim = createSim({ scenario: 'idle', storage: null, authStorage, visibility: ALWAYS_VISIBLE, scheduler: () => () => undefined })
    sims.push(sim)
    sim.store.setState({ captureDevices: production()(sim.store.getState()).captureDevices })
    const router = createAppRouter(
      { sim, queryClient: new QueryClient({ defaultOptions: { queries: { retry: false } } }), socketFactory: () => new SilentSocket() },
      { history: createMemoryHistory({ initialEntries: ['/devices'] }) },
    )
    render(<RouterProvider router={router} />)
    const page = await screen.findByTestId('page-devices', undefined, { timeout: 8_000 })
    await waitFor(() => expect(page.querySelectorAll('[data-testid="camera-feed"]').length).toBeGreaterThanOrEqual(2))
    expect(previews(page)).toHaveLength(0)
    expect(noPreviews(page)).toHaveLength(0)
  })
})

describe('the other surfaces', () => {
  it('Session New while the session is being started (ARMED): the live preview says it is paused for the recording', async () => {
    const core = coreWithSession(CORE_START_MS, 'ARMED')
    // D60 (2026-11-04): all four built-in cameras are production here — four preview tiles pause.
    const { root } = await livePage('/session/new?step=2', 'page-session-new', () => production(['CAM-01', 'CAM-02', 'CAM-03', 'CAM-04'])(core.state()))
    const step = await within(root).findByTestId('sn-step-devices')
    await waitFor(() => expect(previews(step)).toHaveLength(4))
    for (const preview of previews(step)) {
      expect(preview).toHaveAttribute('data-state', 'PAUSED')
      expect(preview).toHaveTextContent(PV.pausedForRecording)
    }
    expect(noPreviews(step)).toHaveLength(0)
  })

  it('Session Monitor during a recording: the feed is the live preview with its REC badge; the input thumbs keep "No preview"', async () => {
    const recording = createSim({ scenario: 'recording', storage: null, authStorage: createMemoryAuthStorage(), visibility: ALWAYS_VISIBLE, scheduler: () => () => undefined })
    sims.push(recording)
    const { root } = await livePage('/session', 'page-session-monitor', () => production(['CAM-01', 'CAM-02'])(recording.store.getState()))
    await waitFor(() => expect(previews(root)).toHaveLength(1))
    const frame = previews(root)[0]!.parentElement!
    expect(frame).toHaveAttribute('data-variant', 'feed')
    expect(within(frame).getByTestId('rec-indicator')).toBeInTheDocument()
    await waitFor(() => expect(imageOf(previews(root)[0]!)).not.toBeNull())
    fireEvent.load(imageOf(previews(root)[0]!)!)
    await waitFor(() => expect(previews(root)[0]).toHaveAttribute('data-state', 'LIVE'))
    // The input thumbs are no live preview (D53: thumbnails keep the tile).
    expect(noPreviews(within(root).getByTestId('sm-inputs')).length).toBeGreaterThanOrEqual(2)
  })

  it('Dashboard: the device tiles keep "No preview" and ask for no token', async () => {
    const { root } = await livePage('/', 'page-dashboard', production(['CAM-01', 'CAM-02']))
    await waitFor(() => expect(noPreviews(within(root).getByTestId('device-tile-VIDEO-01'))).toHaveLength(1))
    expect(previews(root)).toHaveLength(0)
    expect(issued()).toHaveLength(0)
  })
})
