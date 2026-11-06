/**
 * @vitest-environment jsdom
 * @vitest-environment-options { "url": "http://127.0.0.1:5178/" }
 */
// Row W4-1 (L8, D231): the Session Monitor's input thumbnails are the Core's reach-gated live pictures (as the feed,
// row 130b), every stream of the page closes on a hidden tab and on unmount, and opening the monitor re-checks a stale
// NOT_REACHABLE camera ONCE through the "Try again" path (`reach-recheck.ts`; no new operation).
// The double is the contract-checked fake transport of the Live test bed; jsdom loads no image.
import { act, cleanup, configure, screen, waitFor, within } from '@testing-library/react'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import type { FakeCommandOptions } from '@dems/shared/live/testing'
import { ALWAYS_VISIBLE, createMemoryAuthStorage, createSim, type Sim, type SimState } from '@dems/shared/sim'
import { SHELL_INTRO_STORAGE_KEY } from '@/components/shell/shell-entrance'
import { resetPreviewRetries, PREVIEW_NOT_AVAILABLE_RETRY_MS } from '@/features/devices/camera-live-preview'
import { stubMediaForJsdom } from '@/features/session-new/__tests__/live-session-new-bed'
import { resetCoreErrorPresenter } from '@/lib/core-errors'
import { createLiveTestBed, SUPERVISOR_SESSION, type LivePage, type LiveTestBed, type MountedPage } from '@/runtime/testing/live-harness'
import { pageTimersFake, pageTimersReal, pass } from '@/runtime/testing/fake-time'
import { reachRecheckTargets } from '../reach-recheck'

configure({ asyncUtilTimeout: 8_000 })
vi.setConfig({ testTimeout: 30_000 })

type Device = SimState['captureDevices']['devices'][number]
type Reach = 'REACHABLE' | 'NOT_REACHABLE' | null

/** A Core in real capture: the cameras in `ids` are production cameras (ONVIF); every other source is a development source. */
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
/** The Core's last reading of the devices in `ids` (row 125's `reach` + `checkedAt`). */
const reading =
  (ids: readonly string[], reach: Reach, checkedAt: number | null) =>
  (state: SimState): SimState => ({
    ...state,
    captureDevices: { devices: state.captureDevices.devices.map((device) => (ids.includes(device.id) ? ({ ...device, reach, checkedAt } as Device) : device)) },
  })

let bed: LiveTestBed | undefined
const sims: Sim[] = []
let visibility: DocumentVisibilityState = 'visible'

/** The Session Monitor during a recording, on a Core whose state `served` shapes (it gets the Core clock's now). */
async function monitor(served: (state: SimState, coreNow: number) => SimState): Promise<{ root: HTMLElement; page: LivePage; entry: MountedPage }> {
  const recording = createSim({ scenario: 'recording', storage: null, authStorage: createMemoryAuthStorage(), visibility: ALWAYS_VISIBLE, scheduler: () => () => undefined })
  sims.push(recording)
  const created = createLiveTestBed({ session: SUPERVISOR_SESSION })
  bed = created
  created.core.served = served(recording.store.getState(), created.fake.clock.now())
  const page = await created.load()
  const entry = await created.mount(page, '/session')
  const root = await screen.findByTestId('page-session-monitor', {}, { timeout: 15_000 })
  return { root, page, entry }
}

const previews = (root: ParentNode) => Array.from(root.querySelectorAll<HTMLElement>('[data-testid="camera-live-preview"]'))
const noPreviews = (root: ParentNode) => Array.from(root.querySelectorAll<HTMLElement>('[data-testid="camera-no-preview"]'))
const ofCamera = (tiles: HTMLElement[], track: string) => tiles.filter((tile) => tile.getAttribute('data-camera') === track)
const issued = () => bed!.fake.log.requestsOf('createCameraPreviewSession')
const issuedFor = (id: string) => issued().filter((call) => call.params.id === id)
const inputs = (root: HTMLElement) => within(root).getByTestId('sm-inputs')
const settle = async (ms = 3_000) => {
  pageTimersFake()
  await pass(ms)
  pageTimersReal()
}
const republishDevices = async (page: LivePage) => {
  await act(async () => {
    page.sockets.at(-1)!.delta([{ op: 'replace', slice: 'captureDevices', value: JSON.parse(JSON.stringify(bed!.core.served.captureDevices)) }] as FakeCommandOptions['ops'])
  })
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
  // The charts' rAF fallback (see camera-live-preview.test.tsx, D90): let it fire while the window still stands.
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

describe('row W4-1: the input thumbnails are the reach-gated live preview', () => {
  it('a REACHABLE camera opens in its thumb; a NOT_REACHABLE one asks for no token (0 op 112) and its thumb says Not reachable', async () => {
    const { root } = await monitor((state, now) => reading(['CAM-02'], 'NOT_REACHABLE', now - 5_000)(reading(['CAM-01'], 'REACHABLE', now - 5_000)(production(['CAM-01', 'CAM-02'])(state))))
    // CAM-01 (VIDEO-01, the feed's camera): the feed and its thumb, two viewers of the Core's one pipeline.
    await waitFor(() => expect(ofCamera(previews(inputs(root)), 'VIDEO-01')).toHaveLength(1))
    await waitFor(() => expect(issuedFor('CAM-01')).toHaveLength(2))
    expect(ofCamera(previews(root), 'VIDEO-01')).toHaveLength(2)
    // CAM-02 (VIDEO-02): a fresh NOT_REACHABLE reading (5 s old) - no token, now or at any backoff.
    const held = ofCamera(noPreviews(inputs(root)), 'VIDEO-02')
    expect(held).toHaveLength(1)
    expect(held[0]).toHaveAttribute('data-state', 'NOT_REACHABLE')
    await settle()
    expect(issuedFor('CAM-02')).toHaveLength(0)
    // The development sources (VIDEO-03, VIDEO-04) keep the neutral tile and ask nothing.
    expect(issued().every((call) => call.params.id === 'CAM-01')).toBe(true)
  })

  it('every stream of the page closes on a hidden tab, opens again when visible, and closes on unmount', async () => {
    const { root, entry } = await monitor((state, now) => reading(['CAM-01'], 'REACHABLE', now - 5_000)(production(['CAM-01'])(state)))
    await waitFor(() => expect(ofCamera(previews(root), 'VIDEO-01')).toHaveLength(2))
    await waitFor(() => expect(root.querySelectorAll('[data-testid="camera-live-preview-image"]')).toHaveLength(2))
    const before = issued().length
    setVisibility('hidden')
    await waitFor(() => expect(previews(root)).toHaveLength(0))
    expect(root.querySelectorAll('[data-testid="camera-live-preview-image"]')).toHaveLength(0)
    await settle()
    expect(issued()).toHaveLength(before)
    setVisibility('visible')
    await waitFor(() => expect(previews(root)).toHaveLength(2))
    await waitFor(() => expect(issued()).toHaveLength(before + 2))
    await waitFor(() => expect(root.querySelectorAll('[data-testid="camera-live-preview-image"]')).toHaveLength(2))
    const images = Array.from(root.querySelectorAll<HTMLImageElement>('[data-testid="camera-live-preview-image"]'))
    expect(images.every((image) => image.getAttribute('src') !== null)).toBe(true)
    act(() => entry.unmount())
    // The unmount takes each picture's src away, so the browser ends both streams; nothing more is asked for.
    expect(images.every((image) => image.getAttribute('src') === null)).toBe(true)
    const after = issued().length
    await settle()
    expect(issued()).toHaveLength(after)
  })
})

describe('row W4-1: opening the monitor re-checks a stale unreachable camera once (the "Try again" path)', () => {
  it('pure: only an online production camera, stated NOT_REACHABLE, read at least 60 s ago (or never dated)', () => {
    const now = 1_800_000_000_000
    const recording = createSim({ scenario: 'recording', storage: null, authStorage: createMemoryAuthStorage(), visibility: ALWAYS_VISIBLE, scheduler: () => () => undefined })
    sims.push(recording)
    const base = production(['CAM-01', 'CAM-02', 'CAM-03'])(recording.store.getState())
    const state = reading(['CAM-01'], 'NOT_REACHABLE', now - PREVIEW_NOT_AVAILABLE_RETRY_MS)(
      reading(['CAM-02'], 'NOT_REACHABLE', now - PREVIEW_NOT_AVAILABLE_RETRY_MS + 1)(reading(['CAM-03'], 'REACHABLE', now - 10 * 60_000)(reading(['CAM-04'], 'NOT_REACHABLE', null)(base))),
    )
    // CAM-01 stale: re-checked; CAM-02 59.999 s old: not; CAM-03 REACHABLE: not; CAM-04 a development source: not.
    expect(reachRecheckTargets(state, now)).toEqual([{ deviceId: 'CAM-01', checkedAt: now - PREVIEW_NOT_AVAILABLE_RETRY_MS }])
    expect(reachRecheckTargets(reading(['CAM-01'], 'NOT_REACHABLE', null)(base), now)).toEqual([{ deviceId: 'CAM-01', checkedAt: null }])
  })

  it('a stale NOT_REACHABLE reading is asked for once on open; the Core\'s newer NOT_REACHABLE closes it and nothing more is asked', async () => {
    const { root, page } = await monitor((state, now) => reading(['CAM-01', 'CAM-02'], 'NOT_REACHABLE', now - 10 * 60_000)(production(['CAM-01', 'CAM-02'])(state)))
    // One re-check per camera: CAM-01 has the feed and its thumb on the page (2 calls of op 112, the Core's ONE pipeline),
    // CAM-02 its thumb (1 call).
    await waitFor(() => expect(issuedFor('CAM-01')).toHaveLength(2))
    await waitFor(() => expect(issuedFor('CAM-02')).toHaveLength(1))
    // The Core's newer reading: still unreachable. Every gate closes; this hook never asks again while the page stands.
    bed!.core.served = reading(['CAM-01', 'CAM-02'], 'NOT_REACHABLE', bed!.fake.clock.now())(bed!.core.served)
    await republishDevices(page)
    await waitFor(() => expect(previews(root)).toHaveLength(0))
    const after = issued().length
    await settle(PREVIEW_NOT_AVAILABLE_RETRY_MS + 5_000)
    expect(issued()).toHaveLength(after)
    expect(ofCamera(noPreviews(inputs(root)), 'VIDEO-01')[0]).toHaveAttribute('data-state', 'NOT_REACHABLE')
  })

  it('a fresh NOT_REACHABLE reading (under 60 s) is not re-checked: 0 op 112', async () => {
    const { root } = await monitor((state, now) => reading(['CAM-01'], 'NOT_REACHABLE', now - 5_000)(production(['CAM-01'])(state)))
    await waitFor(() => expect(ofCamera(noPreviews(root), 'VIDEO-01').length).toBeGreaterThanOrEqual(2))
    await settle()
    expect(issued()).toHaveLength(0)
  })
})
