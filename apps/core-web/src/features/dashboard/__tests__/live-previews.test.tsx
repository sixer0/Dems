/**
 * @vitest-environment jsdom
 * @vitest-environment-options { "url": "http://127.0.0.1:5178/" }
 */
// Row W4-1 (L8, D231): the Dashboard's camera tiles and the active session's Camera 1 thumbnail are the Core's
// reach-gated live pictures (the rule of Session New and the Session Monitor feed, row 130b): no token while the Core
// states NOT_REACHABLE, the stream closes on a hidden tab and on unmount. jsdom loads no image.
import { act, cleanup, configure, screen, waitFor, within } from '@testing-library/react'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { en } from '@dems/shared/i18n'
import { enWeb } from '@/i18n-web'
import { ALWAYS_VISIBLE, createMemoryAuthStorage, createSim, type Sim, type SimState } from '@dems/shared/sim'
import { SHELL_INTRO_STORAGE_KEY } from '@/components/shell/shell-entrance'
import { resetPreviewRetries } from '@/features/devices/camera-live-preview'
import { stubMediaForJsdom } from '@/features/session-new/__tests__/live-session-new-bed'
import { resetCoreErrorPresenter } from '@/lib/core-errors'
import { createLiveTestBed, SUPERVISOR_SESSION, type LiveTestBed, type MountedPage } from '@/runtime/testing/live-harness'
import { pageTimersFake, pageTimersReal, pass } from '@/runtime/testing/fake-time'

configure({ asyncUtilTimeout: 8_000 })
vi.setConfig({ testTimeout: 30_000 })

type Device = SimState['captureDevices']['devices'][number]

const production =
  (ids: readonly string[]) =>
  (state: SimState): SimState => ({
    ...state,
    captureDevices: {
      devices: state.captureDevices.devices.map((device) =>
        (device.kind === 'CAMERA' && ids.includes(device.id) ? { ...device, adapter: 'ONVIF_RTSP', sourceClass: 'PRODUCTION' } : { ...device, adapter: 'FAKE', sourceClass: 'DEVELOPMENT' }) as Device,
      ),
    },
  })
const reading =
  (ids: readonly string[], reach: 'REACHABLE' | 'NOT_REACHABLE' | null, checkedAt: number | null) =>
  (state: SimState): SimState => ({
    ...state,
    captureDevices: { devices: state.captureDevices.devices.map((device) => (ids.includes(device.id) ? ({ ...device, reach, checkedAt } as Device) : device)) },
  })

let bed: LiveTestBed | undefined
const sims: Sim[] = []
let visibility: DocumentVisibilityState = 'visible'

/** The Dashboard on a Core whose state `served` shapes from `base` (null: the bed's idle Core). */
async function dashboard(scenario: 'idle' | 'recording', served: (state: SimState, coreNow: number) => SimState): Promise<{ root: HTMLElement; entry: MountedPage }> {
  const created = createLiveTestBed({ session: SUPERVISOR_SESSION })
  bed = created
  let base = created.core.served
  if (scenario === 'recording') {
    const recording = createSim({ scenario: 'recording', storage: null, authStorage: createMemoryAuthStorage(), visibility: ALWAYS_VISIBLE, scheduler: () => () => undefined })
    sims.push(recording)
    base = recording.store.getState()
  }
  created.core.served = served(base, created.fake.clock.now())
  const page = await created.load()
  const entry = await created.mount(page, '/')
  const root = await screen.findByTestId('page-dashboard', {}, { timeout: 15_000 })
  return { root, entry }
}

const previews = (root: ParentNode) => Array.from(root.querySelectorAll<HTMLElement>('[data-testid="camera-live-preview"]'))
const noPreviews = (root: ParentNode) => Array.from(root.querySelectorAll<HTMLElement>('[data-testid="camera-no-preview"]'))
const images = (root: ParentNode) => Array.from(root.querySelectorAll<HTMLImageElement>('[data-testid="camera-live-preview-image"]'))
const issued = () => bed!.fake.log.requestsOf('createCameraPreviewSession')
const issuedFor = (id: string) => issued().filter((call) => call.params.id === id)
const settle = async () => {
  pageTimersFake()
  await pass(3_000)
  pageTimersReal()
}
const setVisibility = (next: DocumentVisibilityState) => {
  act(() => {
    visibility = next
    document.dispatchEvent(new Event('visibilitychange'))
  })
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
afterAll(async () => {
  restoreMedia()
  Reflect.deleteProperty(document, 'visibilityState')
  await new Promise<void>((resolve) => setTimeout(resolve, 250))
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
  resetPreviewRetries()
  vi.restoreAllMocks()
})

describe('row W4-1: the Dashboard camera tiles are the reach-gated live preview', () => {
  it('a REACHABLE camera opens in its tile (one token); a NOT_REACHABLE one asks for none and says Not reachable, with no in-tile control', async () => {
    const { root } = await dashboard('idle', (state, now) => reading(['CAM-02'], 'NOT_REACHABLE', now - 5_000)(reading(['CAM-01'], 'REACHABLE', now - 5_000)(production(['CAM-01', 'CAM-02'])(state))))
    const tile1 = await within(root).findByTestId('device-tile-VIDEO-01')
    await waitFor(() => expect(previews(tile1)).toHaveLength(1))
    await waitFor(() => expect(issuedFor('CAM-01')).toHaveLength(1))
    const tile2 = within(root).getByTestId('device-tile-VIDEO-02')
    expect(previews(tile2)).toHaveLength(0)
    expect(noPreviews(tile2)[0]).toHaveAttribute('data-state', 'NOT_REACHABLE')
    await settle()
    expect(issuedFor('CAM-02')).toHaveLength(0)
    expect(issuedFor('CAM-01')).toHaveLength(1)
    // The development sources keep the neutral tile.
    expect(noPreviews(within(root).getByTestId('device-tile-VIDEO-03'))).toHaveLength(1)
  })

  it('the tile\'s stream closes on a hidden tab, re-opens when visible, and closes on unmount', async () => {
    const { root, entry } = await dashboard('idle', (state) => production(['CAM-01'])(state))
    const tile = await within(root).findByTestId('device-tile-VIDEO-01')
    await waitFor(() => expect(images(tile)).toHaveLength(1))
    setVisibility('hidden')
    await waitFor(() => expect(previews(tile)).toHaveLength(0))
    setVisibility('visible')
    await waitFor(() => expect(images(tile)).toHaveLength(1))
    expect(issuedFor('CAM-01')).toHaveLength(2)
    const [image] = images(tile)
    expect(image!.getAttribute('src')).not.toBeNull()
    act(() => entry.unmount())
    expect(image!.getAttribute('src')).toBeNull()
  })

  it('during a recording: Camera 1 has its tile and the session thumbnail (2 viewers, the worst case per camera on this page); unreachable, neither asks', async () => {
    const { root } = await dashboard('recording', (state) => production(['CAM-01'])(state))
    const thumb = await within(root).findByTestId('session-recording')
    await waitFor(() => expect(previews(thumb)).toHaveLength(1))
    await waitFor(() => expect(issuedFor('CAM-01')).toHaveLength(2))
    await settle()
    expect(issuedFor('CAM-01')).toHaveLength(2)
    cleanup()
    bed!.dispose()
    bed = undefined
    const unreachable = await dashboard('recording', (state, now) => reading(['CAM-01'], 'NOT_REACHABLE', now - 5_000)(production(['CAM-01'])(state)))
    const held = await within(unreachable.root).findByTestId('session-recording')
    await waitFor(() => expect(noPreviews(held)).toHaveLength(1))
    // The thumb (room enough) offers the reach gate's "Try again"; nothing is asked for until it is pressed.
    expect(within(held).getByTestId('camera-preview-try-again-VIDEO-01')).toBeInTheDocument()
    await settle()
    expect(issued()).toHaveLength(0)
  })

  it('D226 domino (routing D238): a READY microphone the Core never checked reads "Not checked", as /devices says (one reader, trackReachOf)', async () => {
    const { root } = await dashboard('idle', (state) => production(['CAM-01'])(state))
    const tile = await within(root).findByTestId('device-tile-AUDIO-01')
    await waitFor(() => expect(tile).toHaveTextContent(enWeb.web.source.notChecked))
    expect(tile).not.toHaveTextContent(en.common.enums.micState.READY)
  })
})
