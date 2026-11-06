/**
 * @vitest-environment jsdom
 * @vitest-environment-options { "url": "http://127.0.0.1:5178/" }
 */
// Row W4-8 (D239): the camera previews of Session New (step 2, device check) close their live stream while the tab is
// hidden, open it again when the tab is visible, and close it on unmount - the rule W4-1 gave the Dashboard and the
// Session Monitor (`useDocumentVisible`, `features/devices/idle-meter-lease.ts`). jsdom loads no image.
import { act, cleanup, configure, screen, waitFor, within } from '@testing-library/react'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import type { SimState } from '@dems/shared/sim'
import { SHELL_INTRO_STORAGE_KEY } from '@/components/shell/shell-entrance'
import { resetPreviewRetries } from '@/features/devices/camera-live-preview'
import { resetCoreErrorPresenter } from '@/lib/core-errors'
import { createLiveTestBed, SUPERVISOR_SESSION, type LiveTestBed } from '@/runtime/testing/live-harness'
import { pageTimersReal } from '@/runtime/testing/fake-time'
import { coreWithSession, CORE_START_MS, stubMediaForJsdom } from './live-session-new-bed'

configure({ asyncUtilTimeout: 8_000 })
vi.setConfig({ testTimeout: 30_000 })

type Device = SimState['captureDevices']['devices'][number]

/** A Core in real capture whose cameras in `ids` are production cameras (ONVIF); every other source is a development source. */
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

let bed: LiveTestBed | undefined
let visibility: DocumentVisibilityState = 'visible'

const previewsOf = (root: ParentNode) =>
  Array.from(root.querySelectorAll<HTMLElement>('[data-testid="camera-live-preview"]')).filter((preview) => preview.getAttribute('data-camera') === 'VIDEO-01')
const imagesOf = (root: ParentNode) => previewsOf(root).flatMap((preview) => Array.from(preview.querySelectorAll<HTMLImageElement>('[data-testid="camera-live-preview-image"]')))
const issuedFor = (id: string) => bed!.fake.log.requestsOf('createCameraPreviewSession').filter((call) => call.params.id === id)
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
  bed?.dispose()
  bed = undefined
  resetPreviewRetries()
  vi.restoreAllMocks()
})

describe('row W4-8: the Session New camera previews follow the tab visibility', () => {
  it('the stream closes on a hidden tab, re-opens when visible, and closes on unmount', async () => {
    // The bed of the existing Session New preview cases (camera-live-preview.test.tsx): a session whose pre-check is
    // resolved (ARMED), so the page sends no `beginPrecheck`. The tile reads "paused" but holds its stream (op 112).
    const core = coreWithSession(CORE_START_MS, 'ARMED')
    const created = createLiveTestBed({ session: SUPERVISOR_SESSION })
    bed = created
    created.core.served = production(['CAM-01'])(core.state())
    const page = await created.load()
    const entry = await created.mount(page, '/session/new?step=2')
    const root = await screen.findByTestId('page-session-new', {}, { timeout: 15_000 })
    const step = await within(root).findByTestId('sn-step-devices')

    await waitFor(() => expect(imagesOf(step)).toHaveLength(1))
    expect(issuedFor('CAM-01')).toHaveLength(1)

    setVisibility('hidden')
    await waitFor(() => expect(previewsOf(step)).toHaveLength(0))
    expect(issuedFor('CAM-01')).toHaveLength(1)

    setVisibility('visible')
    await waitFor(() => expect(imagesOf(step)).toHaveLength(1))
    expect(issuedFor('CAM-01')).toHaveLength(2)

    const [image] = imagesOf(step)
    expect(image!.getAttribute('src')).not.toBeNull()
    act(() => entry.unmount())
    expect(image!.getAttribute('src')).toBeNull()
  })
})
