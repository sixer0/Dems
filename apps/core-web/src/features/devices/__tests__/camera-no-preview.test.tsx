/**
 * @vitest-environment jsdom
 * @vitest-environment-options { "url": "http://127.0.0.1:5178/" }
 */
// Wave H, driver D (gate 70 finding G70-03, repeated as G75-13; ruling D196: "a real-capture Core
// shows no stock picture as a preview (a neutral 'No preview' state)"). The console has no live
// preview of a camera in this build; what it drew was the bundled demo loop, whose frames carry
// their own caption. On a Core that records for real that picture stood beside real evidence.
//
// How the console knows: the Core's own data. A Core in real capture states the class of its
// sources (`sourceClass` on the devices of `captureDevices`); a Core in simulated capture states
// none (D91, D131). Simulated client mode is never real capture.
//
// | Surface | Core in real capture | Core in simulated capture / Simulated mode |
// |---------|----------------------|--------------------------------------------|
// | Devices & Inputs camera tiles | "No preview" tile: the track, the device, its state; the accessible name says the live preview is not open; no picture element | the demo picture, as before |
//
// Since decisions D51 / D53 a PRODUCTION camera on a track shows the Core's live preview on Devices & Inputs,
// Session New and the Session Monitor feed (`camera-live-preview.test.tsx`). The sources of this file are
// development sources (`FAKE`, class DEVELOPMENT), which have no live preview: their tiles stay "No preview".
// | Session New pre-check tiles | the same tile | (existing tests) |
// | Dashboard device tiles | the same tile | (existing tests) |
// | Session Monitor feed and input thumbs, during a recording | the same tile; the REC state stays | (existing tests) |
import { cleanup, configure, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { QueryClient } from '@tanstack/react-query'
import { createMemoryHistory, RouterProvider } from '@tanstack/react-router'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { enWeb } from '@/i18n-web'
import { en } from '@dems/shared/i18n'
import type { SocketLike } from '@dems/shared/realtime'
import { ALWAYS_VISIBLE, cameraLinesInForce, clearCaptureWarningTransition, createMemoryAuthStorage, createSim, OPERATOR_IDS, raiseCaptureWarningTransition, type Sim, type SimState } from '@dems/shared/sim'
import { SHELL_INTRO_STORAGE_KEY } from '@/components/shell/shell-entrance'
import { coreWithSession, CORE_START_MS, stubMediaForJsdom } from '@/features/session-new/__tests__/live-session-new-bed'
import { resetCoreErrorPresenter } from '@/lib/core-errors'
import { createAppRouter } from '@/router'
import { createLiveTestBed, SUPERVISOR_SESSION, type LiveTestBed } from '@/runtime/testing/live-harness'
import { isRealCaptureCore } from '../source-class'

configure({ asyncUtilTimeout: 8_000 })
vi.setConfig({ testTimeout: 30_000 })

const P = en.devices.noPreview
type Device = SimState['captureDevices']['devices'][number]

/** The served state of a Core in real capture: every source carries the class its registry gives it. */
const realCapture = (state: SimState): SimState => ({
  ...state,
  captureDevices: { devices: state.captureDevices.devices.map((device) => ({ ...device, adapter: 'FAKE', sourceClass: 'DEVELOPMENT' }) as Device) },
})

let bed: LiveTestBed | undefined
const sims: Sim[] = []

async function livePage(path: string, pageId: string, served?: (idle: SimState) => SimState) {
  const created = createLiveTestBed({ session: SUPERVISOR_SESSION })
  bed = created
  if (served) created.core.served = served(created.core.served)
  const page = await created.load()
  await created.mount(page, path)
  return screen.findByTestId(pageId, {}, { timeout: 15_000 })
}

const feeds = (root: ParentNode = document) => root.querySelectorAll('[data-testid="camera-feed"]')
const tiles = (root: ParentNode = document) => Array.from(root.querySelectorAll<HTMLElement>('[data-testid="camera-no-preview"]'))
/** No picture of any kind, and no caption that calls anything live or demo. */
function expectNeutral(tile: HTMLElement) {
  expect(tile.querySelector('video, canvas, img, picture')).toBeNull()
  expect(tile.textContent ?? '').not.toMatch(/\b(LIVE|DEMO)\b/)
  expect(tile).toHaveTextContent(P.title)
  // Decisions D51 / D53 moved the sentence (OD-12 reversed): a development source has no live preview, so its tile says the preview is not open.
  expect(tile.getAttribute('aria-label') ?? '').toContain('The live preview is not open.')
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
  cleanup()
  for (const sim of sims.splice(0)) sim.stop()
  bed?.dispose()
  bed = undefined
  vi.restoreAllMocks()
})

describe('G70-03 the rule (pure)', () => {
  it('real capture = Live mode and a Core that states a source class (or holds no source at all); never Simulated mode', () => {
    const builtIn = { sourceClass: undefined }
    expect(isRealCaptureCore(true, [{ sourceClass: 'DEVELOPMENT' }, builtIn])).toBe(true)
    expect(isRealCaptureCore(true, [{ sourceClass: 'PRODUCTION' }])).toBe(true)
    // A Core in simulated capture states no class for its built-in devices: the demo picture stays.
    expect(isRealCaptureCore(true, [builtIn, builtIn])).toBe(false)
    // No device known (not answered yet, or a Core without one): nothing says "simulated", so no demo picture.
    expect(isRealCaptureCore(true, [])).toBe(true)
    expect(isRealCaptureCore(false, [{ sourceClass: 'DEVELOPMENT' }])).toBe(false)
  })
})

describe('G70-03 Devices & Inputs', () => {
  it('real capture: each camera tile is the "No preview" tile with the track, the device and its state; no picture, no LIVE / DEMO', async () => {
    const page = await livePage('/devices', 'page-devices', realCapture)
    const tile = await within(page).findByTestId('camera-tile-VIDEO-01')
    await waitFor(() => expect(tiles(tile)).toHaveLength(1))
    expect(feeds(page)).toHaveLength(0)
    const [first] = tiles(tile)
    expectNeutral(first!)
    expect(first).toHaveAttribute('role', 'img')
    expect(first).toHaveTextContent(en.common.tracks['VIDEO-01'])
    expect(first).toHaveTextContent('CAM-01')
    // Fix wave L (G70c-02), pins moved by delta: "Online" was said of a source nobody opened; at rest the tile reads "Not checked".
    expect(first).not.toHaveTextContent(en.devices.selector.online)
    expect(first).toHaveTextContent(enWeb.web.source.notChecked)
    expect(first).toHaveAttribute('aria-label', P.aria.replace('{{name}}', first!.querySelector('[data-part="name"]')!.textContent!).replace('{{state}}', enWeb.web.source.notChecked))
    expect(tiles(within(page).getByTestId('camera-tile-VIDEO-02'))).toHaveLength(1)
  })

  it('real capture: an offline source and a lost stream are said as the Core says them', async () => {
    const page = await livePage('/devices', 'page-devices', (idle) => {
      const state = realCapture(idle)
      return {
        ...state,
        captureConfig: {
          ...state.captureConfig,
          cameras: state.captureConfig.cameras.map((line) => (line.trackId === 'VIDEO-01' ? { ...line, online: false } : { ...line, streamState: 'LOST' })),
        },
      }
    })
    await waitFor(() => expect(tiles(page).length).toBeGreaterThanOrEqual(2))
    expect(tiles(within(page).getByTestId('camera-tile-VIDEO-01'))[0]).toHaveTextContent(en.common.developmentRoster.notReachable)
    expect(tiles(within(page).getByTestId('camera-tile-VIDEO-02'))[0]).toHaveTextContent(en.devices.selector.stream.LOST)
  })

  it('a Core in simulated capture (no class stated) keeps the demo picture in Live mode, unchanged', async () => {
    const page = await livePage('/devices', 'page-devices')
    const tile = await within(page).findByTestId('camera-tile-VIDEO-01')
    await waitFor(() => expect(feeds(tile)).toHaveLength(1))
    expect(tiles(page)).toHaveLength(0)
  })

  it('Simulated mode keeps the demo picture, unchanged', async () => {
    const authStorage = createMemoryAuthStorage()
    authStorage.save({ operatorId: OPERATOR_IDS.ANDI, issuedAt: Date.now() })
    const sim = createSim({ scenario: 'idle', storage: null, authStorage, visibility: ALWAYS_VISIBLE, scheduler: () => () => undefined })
    sims.push(sim)
    // Even a state that names a class: the Simulated mode banner already says what the data is.
    sim.store.setState({ captureDevices: realCapture(sim.store.getState()).captureDevices })
    const router = createAppRouter(
      { sim, queryClient: new QueryClient({ defaultOptions: { queries: { retry: false } } }), socketFactory: () => new SilentSocket() },
      { history: createMemoryHistory({ initialEntries: ['/devices'] }) },
    )
    render(<RouterProvider router={router} />)
    const page = await screen.findByTestId('page-devices', undefined, { timeout: 8_000 })
    await waitFor(() => expect(feeds(within(page).getByTestId('camera-tile-VIDEO-01'))).toHaveLength(1))
    expect(tiles(page)).toHaveLength(0)
  })
})

// ── Task 4 row W4 (review `verification/060c` R-01 to R-06, `060b` S-01; decisions C36, C98) ─────────────────────────
// On a Core in real capture every reader states the STORED stream statement of the track's selector line - "Not
// stated" where the line names none - and never the `cameras` slice, which still holds the simulator's
// `1080p / 25 / H.264`, `9 Mbps` there. Where the Core reports the camera's fault, the fault is said in the place of
// the facts. Simulated mode is unchanged (the cases above and `devices-page.test.tsx`; one control below).
describe('row W4: the readers of a Core in real capture state the stored stream facts, never the slice', () => {
  /** The selector lines as a real Core holds them: VIDEO-01 with a stored statement, VIDEO-02 with a code that is none. */
  const profiles = (first: string, second: string) => (idle: SimState): SimState => {
    const state = realCapture(idle)
    const stated = <L extends { readonly trackId: string }>(lines: readonly L[]) => lines.map((line) => ({ ...line, profile: line.trackId === 'VIDEO-01' ? first : second }))
    // The selector IN FORCE is the open session's snapshot (`selectorInForce`): a recording state carries its own lines.
    const snapshot = (state.session as { readonly captureConfig?: { readonly cameras: readonly { readonly trackId: string }[] } } | null)?.captureConfig
    return {
      ...state,
      captureConfig: { ...state.captureConfig, cameras: stated(state.captureConfig.cameras) } as SimState['captureConfig'],
      session: state.session === null || snapshot === undefined ? state.session : ({ ...state.session, captureConfig: { ...snapshot, cameras: stated(snapshot.cameras) } } as SimState['session']),
    }
  }
  const SLICE_WORDS = /1080p|25 fps|Mbps/
  const format = (root: HTMLElement, track: string) => within(root).getByTestId(`camera-format-${track}`)

  it('Devices: stated facts and "Not stated" in the fact row; no bitrate, no PoE port, nothing of the slice; the drawer says the same', async () => {
    const page = await livePage('/devices', 'page-devices', profiles('HEVC_2560X1920P', 'STANDARD'))
    const first = await within(page).findByTestId('camera-tile-VIDEO-01')
    const second = within(page).getByTestId('camera-tile-VIDEO-02')
    await waitFor(() => expect(format(first, 'VIDEO-01')).toHaveTextContent(/^Format\s*2560x1920 • HEVC$/))
    expect(format(first, 'VIDEO-01')).toHaveAttribute('data-source', 'stored')
    expect(format(second, 'VIDEO-02')).toHaveTextContent(new RegExp(`^Format\\s*${en.common.devices.cameraFormatNotStated}$`))
    for (const [tile, track] of [[first, 'VIDEO-01'], [second, 'VIDEO-02']] as const) {
      expect(within(tile).queryByTestId(`camera-bitrate-${track}`)).toBeNull()
      expect(within(tile).queryByTestId(`camera-poe-${track}`)).toBeNull()
      expect(tile).not.toHaveTextContent(SLICE_WORDS)
      // The fact row states the format: the "No preview" tile does not say it a second time.
      expect(within(tile).queryByTestId('camera-no-preview-format')).toBeNull()
    }
    // The slice the page was served still holds the simulator's record: it is what must not be read.
    expect(bed!.core.served.cameras.map((camera) => [camera.resolution, camera.fps, camera.codec, camera.bitrateMbps])).toEqual([['1080p', 25, 'H.264', 9], ['1080p', 25, 'H.264', 9]])
    // The drawer's Overview: the stored facts in the Format row; the bitrate, the model, the firmware and the port stay "Not reported".
    fireEvent.click(first.querySelector<HTMLElement>('button.dev-cam-media')!)
    const overview = within(await screen.findByTestId('device-drawer')).getByTestId('device-overview')
    const fact = (name: string): string | null | undefined =>
      [...overview.querySelectorAll('.dev-facts-row')].find((row) => row.querySelector('dt')?.textContent === name)?.querySelector('dd')?.textContent
    await waitFor(() => expect(fact('Format')).toBe('2560x1920 • HEVC'))
    expect(fact(en.devices.drawer.field.bitrate)).toBe(en.common.platformNotReported.value)
    expect(overview).not.toHaveTextContent(SLICE_WORDS)
  })

  it('Devices, while a session RECORDS: still no bitrate (the figure was the simulator\'s 9) and the stored facts', async () => {
    const recording = createSim({ scenario: 'recording', storage: null, authStorage: createMemoryAuthStorage(), visibility: ALWAYS_VISIBLE, scheduler: () => () => undefined })
    sims.push(recording)
    const page = await livePage('/devices', 'page-devices', () => profiles('H264_720P30', 'STANDARD')(recording.store.getState()))
    const first = await within(page).findByTestId('camera-tile-VIDEO-01')
    await waitFor(() => expect(format(first, 'VIDEO-01')).toHaveTextContent(/^Format\s*720p • 30 fps • H\.264$/))
    expect(format(within(page).getByTestId('camera-tile-VIDEO-02'), 'VIDEO-02')).toHaveTextContent(en.common.devices.cameraFormatNotStated)
    expect(page.querySelector('[data-testid^="camera-bitrate-"]')).toBeNull()
    for (const track of ['VIDEO-01', 'VIDEO-02']) expect(within(page).getByTestId(`camera-tile-${track}`)).not.toHaveTextContent(/Mbps|1080p|25 fps/)
  })

  it('a camera in fault: the fault stands in the place of the facts - a lost stream, a source not reachable; the other track keeps its facts', async () => {
    const page = await livePage('/devices', 'page-devices', (idle) => {
      const state = profiles('H264_720P30', 'H264_720P30')(idle)
      return { ...state, captureConfig: { ...state.captureConfig, cameras: state.captureConfig.cameras.map((line) => (line.trackId === 'VIDEO-01' ? { ...line, streamState: 'LOST' } : line)) } as SimState['captureConfig'] }
    })
    const first = await within(page).findByTestId('camera-tile-VIDEO-01')
    await waitFor(() => expect(format(first, 'VIDEO-01')).toHaveTextContent(new RegExp(`^Format\\s*${en.devices.selector.stream.LOST}$`)))
    expect(format(first, 'VIDEO-01')).toHaveAttribute('data-fault', 'STREAM_LOST')
    expect(first).not.toHaveTextContent(/720p|30 fps|H\.264/)
    // CONTROL: the track whose camera is not in fault states its stored facts.
    const second = within(page).getByTestId('camera-tile-VIDEO-02')
    expect(format(second, 'VIDEO-02')).toHaveTextContent(/^Format\s*720p • 30 fps • H\.264$/)
    expect(format(second, 'VIDEO-02')).not.toHaveAttribute('data-fault')
  })

  it('Dashboard: the "No preview" tile states the stored format on its state line, "Not stated" where null, and nothing while the camera is in fault', async () => {
    const page = await livePage('/', 'page-dashboard', profiles('H264_720P30', 'STANDARD'))
    const first = await within(page).findByTestId('device-tile-VIDEO-01')
    await waitFor(() => expect(within(first).getByTestId('camera-no-preview-format')).toHaveTextContent('Format: 720p • 30 fps'))
    expect(within(within(page).getByTestId('device-tile-VIDEO-02')).getByTestId('camera-no-preview-format')).toHaveTextContent(`Format: ${en.common.devices.cameraFormatNotStated}`)
    for (const tile of tiles(page)) {
      // On the state's own line (the box of fix waves L and Q keeps its four lines), and described for assistive technology.
      const part = within(tile).getByTestId('camera-no-preview-format')
      expect(part.parentElement).toHaveAttribute('data-part', 'state')
      expect(tile).toHaveAttribute('aria-describedby', part.id)
      expect(tile).not.toHaveTextContent(SLICE_WORDS)
      expectNeutral(tile)
    }
  })

  it('Dashboard, a camera in fault: the tile says the fault and no format', async () => {
    const page = await livePage('/', 'page-dashboard', (idle) => {
      const state = profiles('H264_720P30', 'H264_720P30')(idle)
      return { ...state, captureConfig: { ...state.captureConfig, cameras: state.captureConfig.cameras.map((line) => (line.trackId === 'VIDEO-01' ? { ...line, online: false } : line)) } as SimState['captureConfig'] }
    })
    const first = await within(page).findByTestId('device-tile-VIDEO-01')
    await waitFor(() => expect(tiles(first)[0]).toHaveTextContent(en.common.developmentRoster.notReachable))
    expect(within(first).queryByTestId('camera-no-preview-format')).toBeNull()
    expect(tiles(first)[0]).not.toHaveAttribute('aria-describedby')
    expect(first).not.toHaveTextContent(/720p|30 fps/)
    // CONTROL: the other track.
    expect(within(within(page).getByTestId('device-tile-VIDEO-02')).getByTestId('camera-no-preview-format')).toHaveTextContent('Format: 720p • 30 fps')
  })

  it('Session New pre-check and the Session Monitor: the stored format, never the literal "1080p • 25 fps"', async () => {
    const core = coreWithSession(CORE_START_MS, 'ARMED')
    const page = await livePage('/session/new?step=2', 'page-session-new', () => profiles('HEVC_2160P', 'STANDARD')(core.state()))
    const step = await within(page).findByTestId('sn-step-devices')
    await waitFor(() => expect(tiles(step)).toHaveLength(2))
    await waitFor(() => expect(within(tiles(step)[0]!).getByTestId('camera-no-preview-format')).toHaveTextContent('Format: 2160p'))
    expect(within(tiles(step)[1]!).getByTestId('camera-no-preview-format')).toHaveTextContent(`Format: ${en.common.devices.cameraFormatNotStated}`)
    for (const tile of tiles(step)) expect(tile).not.toHaveTextContent(/1080p|25 fps/)
    cleanup()
    bed?.dispose()
    bed = undefined

    const recording = createSim({ scenario: 'recording', storage: null, authStorage: createMemoryAuthStorage(), visibility: ALWAYS_VISIBLE, scheduler: () => () => undefined })
    sims.push(recording)
    const monitor = await livePage('/session', 'page-session-monitor', () => profiles('H264_720P30', 'STANDARD')(recording.store.getState()))
    // The input cards: the line beside the thumb (the thumb itself has no room for words).
    await waitFor(() => expect(within(monitor).getByTestId('sm-input-format-VIDEO-01')).toHaveTextContent(/^720p • 30 fps$/))
    expect(within(monitor).getByTestId('sm-input-format-VIDEO-02')).toHaveTextContent(new RegExp(`^${en.common.devices.cameraFormatNotStated}$`))
    // The feed of the active track (VIDEO-01).
    const feed = tiles(monitor).find((tile) => tile.parentElement?.getAttribute('data-variant') === 'feed')!
    expect(within(feed).getByTestId('camera-no-preview-format')).toHaveTextContent('Format: 720p • 30 fps')
    expect(within(monitor).getByTestId('sm-inputs')).not.toHaveTextContent(/1080p|25 fps/)
  })

  it('CONTROL - a Core in simulated capture (Live mode, no class stated) reads the slice as before: format, PoE port and bitrate', async () => {
    const page = await livePage('/devices', 'page-devices')
    const tile = await within(page).findByTestId('camera-tile-VIDEO-01')
    await waitFor(() => expect(format(tile, 'VIDEO-01')).toHaveTextContent(/^Format\s*1080p • 25 fps • H\.264$/))
    expect(format(tile, 'VIDEO-01')).not.toHaveAttribute('data-source')
    expect(within(tile).getByTestId('camera-bitrate-VIDEO-01')).toHaveTextContent('9 Mbps')
    expect(within(tile).getByTestId('camera-poe-VIDEO-01')).toBeInTheDocument()
    expect(within(tile).queryByTestId('camera-no-preview-format')).toBeNull()
  })
})

describe('G70-03 the other surfaces, real capture', () => {
  it('Session New, device check: both pre-check tiles are "No preview"', async () => {
    const core = coreWithSession(CORE_START_MS, 'ARMED')
    const page = await livePage('/session/new?step=2', 'page-session-new', () => realCapture(core.state()))
    const step = await within(page).findByTestId('sn-step-devices')
    await waitFor(() => expect(tiles(step)).toHaveLength(2))
    expect(feeds(page)).toHaveLength(0)
    tiles(step).forEach(expectNeutral)
  })

  it('Dashboard: the two device tiles are "No preview"', async () => {
    const page = await livePage('/', 'page-dashboard', realCapture)
    await waitFor(() => expect(tiles(within(page).getByTestId('device-tile-VIDEO-01'))).toHaveLength(1))
    expect(tiles(within(page).getByTestId('device-tile-VIDEO-02'))).toHaveLength(1)
    expect(feeds(page)).toHaveLength(0)
    tiles(page).forEach(expectNeutral)
    // Fix wave Q (CW-02): at 1440 x 900 the picture box of a Dashboard tile was 44 px high for 64 px of text ("No
    // preview" cut at the top, the state at the bottom): its lines lay OVER the box (`absolute inset-0`, cut by
    // `overflow-hidden`) and the box could shrink to nothing (`min-h-0`). In a Dashboard tile the lines are in the
    // flow and the frame never shrinks under them - in every `tile` frame (the Devices page's too, whose 16:9 frame is tall enough anyway). (The geometry at 1280 / 1440 / 1920 is the browser box check's.)
    for (const tile of tiles(page)) {
      const frame = tile.parentElement!
      expect(frame).toHaveAttribute('data-variant', 'tile')
      expect(frame).toHaveClass('min-h-fit', 'shrink-0', 'flex', 'flex-col')
      expect(frame).not.toHaveClass('min-h-0')
      expect(tile).toHaveClass('relative', 'flex-1')
      expect(tile).not.toHaveClass('absolute')
      expect(tile).not.toHaveClass('overflow-hidden')
    }
  })

  it('Session Monitor during a recording: the feed and the input thumbs are "No preview"; nothing is drawn as a picture', async () => {
    const recording = createSim({ scenario: 'recording', storage: null, authStorage: createMemoryAuthStorage(), visibility: ALWAYS_VISIBLE, scheduler: () => () => undefined })
    sims.push(recording)
    const page = await livePage('/session', 'page-session-monitor', () => realCapture(recording.store.getState()))
    await waitFor(() => expect(tiles(page).length).toBeGreaterThanOrEqual(3))
    expect(feeds(page)).toHaveLength(0)
    tiles(page).forEach(expectNeutral)
  })
})

// Task 4 row W5 (review 060d finding Q-01; decision C111). A camera lost INSIDE a session: the Core raises a
// `CAPTURE_FAULT` about the camera device and changes no selector line (the worker's ingest stays connected while
// the relay re-opens its camera), so the track read "Stream live" and its stored format under a critical notice.
// The double: the served state of the fake Core, with the fault raised and cleared by the Core's own transitions
// (`raiseCaptureWarningTransition` / `clearCaptureWarningTransition`). No browser session.
// Seen RED on the mutation "`trackFactsOf` does not read the raised fault": the feed kept its stored format under the fault.
describe('row W5 (Q-01): a camera lost inside a session shows its fault in the Session Monitor, not "Stream live"', () => {
  const S = en.devices.selector.stream
  const lost = (state: SimState): SimState => {
    const deviceId = cameraLinesInForce(state).find((line) => line.trackId === 'VIDEO-01')!.deviceId
    return raiseCaptureWarningTransition(state, state.clock.now, { code: 'CAPTURE_FAULT', subject: deviceId, reason: 'CAMERA_STREAM_ENDED' } as Parameters<typeof raiseCaptureWarningTransition>[2])
  }
  const back = (state: SimState): SimState => {
    const deviceId = cameraLinesInForce(state).find((line) => line.trackId === 'VIDEO-01')!.deviceId
    return clearCaptureWarningTransition(state, state.clock.now, { code: 'CAPTURE_FAULT', subject: deviceId, reason: 'CAMERA_STREAM_ENDED' } as Parameters<typeof clearCaptureWarningTransition>[2])
  }
  const recordingState = (): SimState => {
    const recording = createSim({ scenario: 'recording', storage: null, authStorage: createMemoryAuthStorage(), visibility: ALWAYS_VISIBLE, scheduler: () => () => undefined })
    sims.push(recording)
    return realCapture(recording.store.getState())
  }
  const feedOf = (page: HTMLElement) => tiles(page).find((tile) => tile.parentElement?.getAttribute('data-variant') === 'feed')!
  const stateOf = (tile: HTMLElement) => tile.querySelector('[data-part="state"]')!

  it('CONTROL then the fault: with no fault the feed of the recording track says "Stream live"; with the fault active it says "Stream lost", shows no format, and the input card says so too', async () => {
    const control = await livePage('/session', 'page-session-monitor', () => recordingState())
    await waitFor(() => expect(tiles(control).length).toBeGreaterThanOrEqual(3))
    expect(stateOf(feedOf(control))).toHaveTextContent(S.LIVE)
    expect(within(control).getByTestId('sm-input-state-VIDEO-01')).not.toHaveAttribute('data-fault')
    cleanup()
    bed?.dispose()
    bed = undefined

    const page = await livePage('/session', 'page-session-monitor', () => lost(recordingState()))
    await waitFor(() => expect(tiles(page).length).toBeGreaterThanOrEqual(3))
    const feed = feedOf(page)
    await waitFor(() => expect(feed).toHaveAttribute('data-fault', 'STREAM_LOST'))
    // The line itself still reads LIVE (the finding's premise): the fault is what is said.
    expect(feed).toHaveAttribute('data-state', 'ONLINE')
    expect(stateOf(feed)).toHaveTextContent(S.LOST)
    expect(stateOf(feed)).not.toHaveTextContent(S.LIVE)
    expect(within(feed).queryByTestId('camera-no-preview-format')).toBeNull()
    expect(feed.getAttribute('aria-label') ?? '').toContain(S.LOST)
    // The input card of the track: the fault in the state's place and in the place of the stored format.
    const card = within(page).getByTestId('sm-input-state-VIDEO-01')
    expect(card).toHaveAttribute('data-fault', 'STREAM_LOST')
    expect(card).toHaveTextContent(new RegExp(`^${S.LOST}$`))
    expect(within(page).getByTestId('sm-input-format-VIDEO-01')).toHaveAttribute('data-fault', 'STREAM_LOST')
    // The other track is not touched.
    expect(within(page).getByTestId('sm-input-state-VIDEO-02')).not.toHaveAttribute('data-fault')
    expect(within(page).getByTestId('sm-input-format-VIDEO-02')).not.toHaveAttribute('data-fault')
  })

  it('the re-open: once the Core cleared the fault the track is "Stream live" again and states its format', async () => {
    const page = await livePage('/session', 'page-session-monitor', () => back(lost(recordingState())))
    await waitFor(() => expect(tiles(page).length).toBeGreaterThanOrEqual(3))
    const feed = feedOf(page)
    expect(feed).not.toHaveAttribute('data-fault')
    expect(stateOf(feed)).toHaveTextContent(S.LIVE)
    expect(within(page).getByTestId('sm-input-state-VIDEO-01')).not.toHaveAttribute('data-fault')
    expect(within(page).getByTestId('sm-input-format-VIDEO-01')).not.toHaveAttribute('data-fault')
  })

  it('CONTROL - a Core in simulated capture (Live mode, no class stated) and the same alert: the simulated lane keeps its own drawing', async () => {
    const recording = createSim({ scenario: 'recording', storage: null, authStorage: createMemoryAuthStorage(), visibility: ALWAYS_VISIBLE, scheduler: () => () => undefined })
    sims.push(recording)
    const page = await livePage('/session', 'page-session-monitor', () => lost(recording.store.getState()))
    const card = await within(page).findByTestId('sm-input-state-VIDEO-01')
    expect(card).not.toHaveAttribute('data-fault')
    expect(tiles(page)).toHaveLength(0)
  })
})

// Task 4 row W6 (request line 569 (3); decisions C141, C143): the Core states `streamState: null` for an idle registered
// camera's line. The tile's `data-state` was 'ONLINE' for it (`!== 'LOST'`); it is 'NOT_READ' now, and its words are never
// "Stream live" or "Online". Seen RED on the mutation "the null branch of `data-state` removed" (back to 'ONLINE').
describe('row W6: a selector line whose stream nobody reads is "not read" on the tile', () => {
  const unread = (state: SimState): SimState => {
    const real = realCapture(state)
    return { ...real, captureConfig: { ...real.captureConfig, cameras: real.captureConfig.cameras.map((line) => ({ ...line, streamState: null })) } }
  }

  it('Devices & Inputs, idle: data-state NOT_READ; no "Stream live", no "Online"', async () => {
    const page = await livePage('/devices', 'page-devices', unread)
    const tile = await within(page).findByTestId('camera-tile-VIDEO-01')
    await waitFor(() => expect(tiles(tile)).toHaveLength(1))
    const [first] = tiles(tile)
    expect(first).toHaveAttribute('data-state', 'NOT_READ')
    expect(first).not.toHaveTextContent(en.devices.selector.stream.LIVE)
    expect(first).not.toHaveTextContent(en.devices.selector.online)
    // The selector line of the same track: the neutral chip "Stream not read".
    const row = await within(page).findByTestId('selector-camera-VIDEO-01')
    await waitFor(() => expect(within(row).getByTestId('source-state-chips')).toHaveAttribute('data-stream', 'NOT_READ'))
    expect(within(row).getByTestId('source-state-chips')).toHaveTextContent(enWeb.web.source.streamNotRead)
  })
})
