/**
 * @vitest-environment jsdom
 * @vitest-environment-options { "url": "http://127.0.0.1:5178/" }
 */
// Decision D62 (2026-11-05), part (5): the console AUTO-OLPS the live preview of every assigned+online
// camera tile on the Devices page. The session itself and its honest rule (UNAVAILABLE after 3 frame-less
// failures, retry continuing) are the D51/D53 machine of `camera-live-preview.test.tsx` and stay as they
// were - THIS file tests only the gate above it:
//
// | Rule | Test |
// |------|------|
// | An assigned, ONLINE production tile opens by itself ~1 s after mount (no click) | `auto-opens ... debounced` |
// | An OFFLINE tile opens nothing and asks for no token; going offline CLOSES an open session, coming back re-opens it | `offline ... no auto-open` / `going offline closes` |
// | A hidden tab closes the session; visible again it re-opens (debounced) | `hidden tab` |
// | At most the Core's global pipeline cap (`CAMERA_PREVIEW_LIMITS.pipelines`) auto sessions at once; a freed slot goes to a waiter | `caps the concurrent auto sessions at the Core's pipeline bound` |
// | Simulated mode asks the Core for nothing (unchanged) | `Simulated mode` |
// | The tile's click still opens the drawer (the manual path survives) | `click still opens the drawer` |
//
// The double is the contract-checked fake transport of the Live test bed; jsdom loads no image, so the
// picture's events are fired by hand where a test needs them. No browser and no Core were run.
import { act, cleanup, configure, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { QueryClient } from '@tanstack/react-query'
import { createMemoryHistory, RouterProvider } from '@tanstack/react-router'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import type { FakeCommandOptions } from '@dems/shared/live/testing'
import { CAMERA_PREVIEW_LIMITS } from '@dems/shared/api'
import type { SocketLike } from '@dems/shared/realtime'
import { ALWAYS_VISIBLE, createMemoryAuthStorage, createSim, OPERATOR_IDS, type Sim, type SimState } from '@dems/shared/sim'
import { SHELL_INTRO_STORAGE_KEY } from '@/components/shell/shell-entrance'
import { stubMediaForJsdom } from '@/features/session-new/__tests__/live-session-new-bed'
import { resetCoreErrorPresenter } from '@/lib/core-errors'
import { createAppRouter } from '@/router'
import { createLiveTestBed, SUPERVISOR_SESSION, type LivePage, type LiveTestBed, type MountedPage } from '@/runtime/testing/live-harness'
import { pageTimersFake, pageTimersReal, pass, until } from '@/runtime/testing/fake-time'
import {
  claimPreviewSlot,
  PREVIEW_AUTO_MAX_CONCURRENT,
  PREVIEW_AUTO_OPEN_DEBOUNCE_MS,
  previewSlotsTakenCount,
  releasePreviewSlot,
  subscribePreviewSlots,
} from '../camera-live-preview'

configure({ asyncUtilTimeout: 8_000 })
vi.setConfig({ testTimeout: 30_000 })

type Device = SimState['captureDevices']['devices'][number]

/** A Core in real capture whose cameras in `ids` are production cameras (ONVIF); every other source is a development source. */
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

/** The selector line of `trackId` reads offline / online (the registry flag the Core republishes). */
const lineOnline =
  (trackId: string, online: boolean) =>
  (state: SimState): SimState => ({
    ...state,
    captureConfig: { ...state.captureConfig, cameras: state.captureConfig.cameras.map((line) => (line.trackId === trackId ? { ...line, online } : line)) },
  })

let bed: LiveTestBed | undefined
const sims: Sim[] = []
let visibility: DocumentVisibilityState = 'visible'

async function livePage(path: string, served: (idle: SimState) => SimState, options: { strict?: boolean; fakePageTimers?: boolean } = {}): Promise<{ root: HTMLElement; entry: MountedPage; page: LivePage }> {
  const created = createLiveTestBed({ session: SUPERVISOR_SESSION })
  bed = created
  created.core.served = served(created.core.served)
  const page = await created.load()
  // D62: a test that drives the auto-open debounce must own the page's timers BEFORE the mount arms them.
  if (options.fakePageTimers === true) pageTimersFake()
  const entry = await created.mount(page, path, { strict: options.strict === true })
  // While the page's timers are fake, `findBy` hangs (the rule of `fake-time.ts`): wait with `until`.
  const root = options.fakePageTimers === true ? await until(() => screen.getByTestId('page-devices')) : await screen.findByTestId('page-devices', undefined, { timeout: 15_000 })
  return { root, entry, page }
}

const previews = (root: ParentNode = document) => Array.from(root.querySelectorAll<HTMLElement>('[data-testid="camera-live-preview"]'))
const noPreviews = (root: ParentNode = document) => Array.from(root.querySelectorAll<HTMLElement>('[data-testid="camera-no-preview"]'))
const imageOf = (preview: HTMLElement) => preview.querySelector<HTMLImageElement>('[data-testid="camera-live-preview-image"]')
const issued = () => bed!.fake.log.requestsOf('createCameraPreviewSession')

/** The Core republishes a slice: the fake socket's delta stands for it (the rule of `camera-profile.test.tsx`). */
async function republish(page: LivePage, slice: 'captureConfig', value: unknown): Promise<void> {
  await act(async () => {
    page.sockets.at(-1)!.delta([{ op: 'replace', slice, value: JSON.parse(JSON.stringify(value)) }] as FakeCommandOptions['ops'])
  })
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
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => visibility })
})
afterAll(() => {
  restoreMedia()
  Reflect.deleteProperty(document, 'visibilityState')
})
beforeEach(() => {
  visibility = 'visible'
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

describe('D62: the Devices tile opens its live preview by itself', () => {
  it('auto-opens an assigned, online production tile on mount, debounced ~1 s: no click, no token before the second, one token after it', async () => {
    // The debounce must run on the fake clock: the page's timers are faked BEFORE the mount arms them.
    const { root } = await livePage('/devices', production(['CAM-01']), { fakePageTimers: true })
    const tile = await until(() => within(root).getByTestId('camera-tile-VIDEO-01'))
    // While the debounce stands: the neutral tile states the condition, the Core is asked for NOTHING.
    expect(previews(tile)).toHaveLength(0)
    expect(issued()).toHaveLength(0)
    await pass(PREVIEW_AUTO_OPEN_DEBOUNCE_MS - 100)
    expect(issued()).toHaveLength(0)
    await pass(150)
    await until(() => expect(issued()).toHaveLength(1))
    expect(issued()[0]!.params).toEqual({ id: 'CAM-01' })
    await until(() => expect(imageOf(previews(tile)[0]!)).not.toBeNull())
    expect(previews(tile)[0]).toHaveAttribute('data-state', 'CONNECTING')
    pageTimersReal()
  })

  it('an OFFLINE tile auto-opens nothing: no live preview, no token, at any later time', async () => {
    const { root } = await livePage('/devices', (idle) => lineOnline('VIDEO-01', false)(production(['CAM-01'])(idle)))
    const tile = await within(root).findByTestId('camera-tile-VIDEO-01')
    await waitFor(() => expect(noPreviews(tile)).toHaveLength(1))
    expect(noPreviews(tile)[0]).toHaveAttribute('data-state', 'OFFLINE')
    pageTimersFake()
    await pass(3_000)
    pageTimersReal()
    expect(previews(tile)).toHaveLength(0)
    expect(issued()).toHaveLength(0)
  })

  it('a track with no device on it auto-opens nothing (unassigned stays the neutral tile, no token)', async () => {
    // The selector line of VIDEO-03 removed: the track holds no device at all.
    const { root } = await livePage('/devices', (idle) => {
      const state = production(['CAM-01'])(idle)
      return { ...state, captureConfig: { ...state.captureConfig, cameras: state.captureConfig.cameras.filter((line) => line.trackId !== 'VIDEO-03') } }
    })
    const tile = await within(root).findByTestId('camera-tile-VIDEO-03')
    await waitFor(() => expect(noPreviews(tile)).toHaveLength(1))
    expect(noPreviews(tile)[0]).toHaveAttribute('data-state', 'NOT_ASSIGNED')
    // The CONTROL: the online production tile opens on its own - and only IT is ever asked about.
    await waitFor(() => expect(previews(within(root).getByTestId('camera-tile-VIDEO-01'))).toHaveLength(1), { timeout: 4_000 })
    await waitFor(() => expect(issued().length).toBeGreaterThanOrEqual(1))
    expect(issued().every((call) => call.params.id === 'CAM-01')).toBe(true)
  })

  it('going offline CLOSES the open session (the stream ends); coming back online re-opens it, debounced', async () => {
    const { root, page } = await livePage('/devices', production(['CAM-01']))
    const tile = await within(root).findByTestId('camera-tile-VIDEO-01')
    await waitFor(() => expect(imageOf(previews(tile)[0]!)).not.toBeNull())
    expect(issued()).toHaveLength(1)
    const image = imageOf(previews(tile)[0]!)!
    // The Core republishes the selector line offline: the gate closes the session at once.
    bed!.core.served = lineOnline('VIDEO-01', false)(bed!.core.served)
    await republish(page, 'captureConfig', bed!.core.served.captureConfig)
    await waitFor(() => expect(previews(tile)).toHaveLength(0))
    expect(image.hasAttribute('src')).toBe(false)
    await waitFor(() => expect(noPreviews(tile)[0]).toHaveAttribute('data-state', 'OFFLINE'))
    expect(issued()).toHaveLength(1)
    // Back online: the tile re-opens on its own, after the debounce (the real clock here - no fake was armed).
    bed!.core.served = lineOnline('VIDEO-01', true)(bed!.core.served)
    await republish(page, 'captureConfig', bed!.core.served.captureConfig)
    await waitFor(() => expect(issued()).toHaveLength(2), { timeout: 4_000 })
    await waitFor(() => expect(imageOf(previews(tile)[0]!)).not.toBeNull())
  })

  it('a hidden tab closes the session; visible again, the tile re-opens debounced', async () => {
    const { root } = await livePage('/devices', production(['CAM-01']))
    const tile = await within(root).findByTestId('camera-tile-VIDEO-01')
    await waitFor(() => expect(imageOf(previews(tile)[0]!)).not.toBeNull())
    expect(issued()).toHaveLength(1)
    const image = imageOf(previews(tile)[0]!)!
    act(() => {
      visibility = 'hidden'
      document.dispatchEvent(new Event('visibilitychange'))
    })
    await waitFor(() => expect(previews(tile)).toHaveLength(0))
    expect(image.hasAttribute('src')).toBe(false)
    expect(issued()).toHaveLength(1)
    act(() => {
      visibility = 'visible'
      document.dispatchEvent(new Event('visibilitychange'))
    })
    await waitFor(() => expect(issued()).toHaveLength(2), { timeout: 4_000 })
    await waitFor(() => expect(imageOf(previews(tile)[0]!)).not.toBeNull())
  })

  it("caps the concurrent auto sessions at the Core's pipeline bound: the next tile waits and takes the slot that frees first", () => {
    // The registry rule of D62, pure. The cap is the Core's OWN global pipeline bound (correction
    // 2026-11-05: a cap of four made the live bench answer 429 PREVIEW_LIMIT on the third tile).
    expect(PREVIEW_AUTO_MAX_CONCURRENT).toBe(CAMERA_PREVIEW_LIMITS.pipelines)
    let notified = 0
    const unsubscribe = subscribePreviewSlots(() => {
      notified += 1
    })
    expect(previewSlotsTakenCount()).toBe(0)
    for (let i = 0; i < PREVIEW_AUTO_MAX_CONCURRENT; i += 1) expect(claimPreviewSlot()).toBe(true)
    expect(claimPreviewSlot()).toBe(false)
    expect(previewSlotsTakenCount()).toBe(PREVIEW_AUTO_MAX_CONCURRENT)
    releasePreviewSlot()
    expect(notified).toBe(1)
    expect(claimPreviewSlot()).toBe(true)
    while (previewSlotsTakenCount() > 0) releasePreviewSlot()
    expect(previewSlotsTakenCount()).toBe(0)
    unsubscribe()
  })

  it('Simulated mode: the gate asks the Core for nothing and draws nothing - the demo picture stays', async () => {
    const authStorage = createMemoryAuthStorage()
    authStorage.save({ operatorId: OPERATOR_IDS.ANDI, issuedAt: Date.now() })
    const sim = createSim({ scenario: 'idle', storage: null, authStorage, visibility: ALWAYS_VISIBLE, scheduler: () => () => undefined })
    sims.push(sim)
    sim.store.setState({ captureDevices: production(['CAM-01'])(sim.store.getState()).captureDevices })
    const router = createAppRouter(
      { sim, queryClient: new QueryClient({ defaultOptions: { queries: { retry: false } } }), socketFactory: () => new SilentSocket() },
      { history: createMemoryHistory({ initialEntries: ['/devices'] }) },
    )
    render(<RouterProvider router={router} />)
    const page = await screen.findByTestId('page-devices', undefined, { timeout: 8_000 })
    await waitFor(() => expect(page.querySelectorAll('[data-testid="camera-feed"]').length).toBeGreaterThanOrEqual(2))
    pageTimersFake()
    await pass(3_000)
    pageTimersReal()
    expect(previews(page)).toHaveLength(0)
    expect(noPreviews(page)).toHaveLength(0)
  })

  it('the manual path survives: the tile click still opens the device drawer over an auto-opened preview', async () => {
    const { root } = await livePage('/devices', production(['CAM-01']))
    const tile = await within(root).findByTestId('camera-tile-VIDEO-01')
    await waitFor(() => expect(imageOf(previews(tile)[0]!)).not.toBeNull())
    fireEvent.click(within(tile).getByRole('button', { name: /^Open details/ }))
    await waitFor(() => expect(screen.getByTestId('device-drawer')).toBeInTheDocument())
  })
})
