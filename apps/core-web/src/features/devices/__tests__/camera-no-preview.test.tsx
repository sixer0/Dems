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
// | Devices & Inputs camera tiles | "No preview" tile: the track, the device, its state; the accessible name says the build shows no live preview; no picture element | the demo picture, as before |
// | Session New pre-check tiles | the same tile | (existing tests) |
// | Dashboard device tiles | the same tile | (existing tests) |
// | Session Monitor feed and input thumbs, during a recording | the same tile; the REC state stays | (existing tests) |
import { cleanup, configure, render, screen, waitFor, within } from '@testing-library/react'
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
  expect(tile.getAttribute('aria-label') ?? '').toContain('This build shows no live preview.')
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
    expect(first).toHaveTextContent(en.devices.selector.online)
    expect(first).toHaveAttribute('aria-label', P.aria.replace('{{name}}', first!.querySelector('[data-part="name"]')!.textContent!).replace('{{state}}', en.devices.selector.online))
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
    expect(tiles(within(page).getByTestId('camera-tile-VIDEO-01'))[0]).toHaveTextContent(en.devices.selector.offline)
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
