/**
 * @vitest-environment jsdom
 * @vitest-environment-options { "url": "http://127.0.0.1:5178/" }
 */
// Plan row W0, item 7 (finding F70-4, decision D156): in Live mode the camera feed's OWN words say
// what is true (04_client_integration_spec §3.2; decision MS-1): the camera's state is the Core's,
// the picture is the bundled demo loop. The component-made words change in Live mode only:
//
// | Word | Simulated (unchanged) | Live |
// |------|-----------------------|------|
// | The procedural fallback's burnt-in OSD line (`osdLabel`) | `CAM-01 \| VIDEO-01 \| LIVE \| DEMO` | `CAM-01 \| VIDEO-01 \| BUNDLED DEMO` |
// | The picture's default accessible name | "Camera 1 · LIVE SESSION FEED" | "Camera 1 · Bundled demo picture" |
// | The Devices camera tile's own name (`features/devices/camera-tile.tsx`) | "Live preview, Camera 1" | "Camera 1, bundled demo picture" |
//
// The line burnt into the frames of the bundled MP4 loops ("… LIVE | DEMO") is pixels of a frozen asset
// (P13) and is NOT changed by W0: it is a decision for the controller (W0 report, item 7).
import { cleanup, configure, render, screen } from '@testing-library/react'
import { toast } from '@heroui/react'
import { QueryClient } from '@tanstack/react-query'
import { createMemoryHistory, RouterProvider } from '@tanstack/react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { en } from '@dems/shared/i18n'
import type { SocketLike } from '@dems/shared/realtime'
import { ALWAYS_VISIBLE, createManualClock, createMemoryAuthStorage, createSim, OPERATOR_IDS, SimProvider } from '@dems/shared/sim'
import { createTestSim } from '@/components/composed/__tests__/test-utils'
import { CameraFeed } from '@/components/media'
import { osdLabel } from '@/components/media/camera-feed.math'
import { createProceduralFeed } from '@/components/media/procedural-feed'
import { SHELL_INTRO_STORAGE_KEY } from '@/components/shell/shell-entrance'
import { getMissingI18nKeys, resetMissingI18nKeys } from '@/i18n'
import { resetCoreErrorPresenter } from '@/lib/core-errors'
import { createAppRouter } from '@/router'
import { createLiveTestBed, SUPERVISOR_SESSION, type LiveTestBed } from '@/runtime/testing/live-harness'

configure({ asyncUtilTimeout: 8_000 })
vi.setConfig({ testTimeout: 25_000 })

const DEMO_NOW = Date.parse('2026-10-01T10:00:00+07:00')
const SIMULATED_NAME = `${en.common.tracks['VIDEO-01']} · ${en.session.feed.title}`
const LIVE_NAME = `${en.common.tracks['VIDEO-01']} · ${en.session.feed.bundledPicture}`

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

const originalMatchMedia = window.matchMedia
async function clearToasts() {
  window.matchMedia = (() => ({ matches: true })) as unknown as typeof window.matchMedia
  toast.clear()
  window.matchMedia = originalMatchMedia
  const queue = toast.getQueue() as { getExitingKeys?: () => ReadonlySet<string> }
  if ((queue.getExitingKeys?.().size ?? 0) > 0) await new Promise((resolve) => setTimeout(resolve, 350))
}

/** A 2D context that records every `fillText` and answers every other call with another recorder. */
function recordingContext(texts: string[]): CanvasRenderingContext2D {
  const recorder: ProxyHandler<object> = {
    get(_target, property) {
      if (property === 'fillText') return (text: string) => texts.push(text)
      return () => new Proxy({}, recorder)
    },
    set: () => true,
  }
  return new Proxy({}, recorder) as CanvasRenderingContext2D
}

let bed: LiveTestBed | undefined

beforeEach(() => {
  resetMissingI18nKeys()
  resetCoreErrorPresenter()
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

describe('the procedural OSD line (`osdLabel`)', () => {
  it('Simulated keeps its line; Live keeps DEMO (P13) and drops LIVE', () => {
    expect(osdLabel('VIDEO-01')).toBe('CAM-01 | VIDEO-01 | LIVE | DEMO')
    expect(osdLabel('VIDEO-02', false)).toBe('CAM-02 | VIDEO-02 | LIVE | DEMO')
    expect(osdLabel('VIDEO-01', true)).toBe('CAM-01 | VIDEO-01 | BUNDLED DEMO')
    expect(osdLabel('VIDEO-02', true)).not.toMatch(/\bLIVE\b/)
    expect(osdLabel('VIDEO-02', true)).toMatch(/\bDEMO\b/)
  })

  it('the painter writes the line of its mode on the canvas', () => {
    for (const [liveData, expected] of [
      [false, 'CAM-01 | VIDEO-01 | LIVE | DEMO'],
      [true, 'CAM-01 | VIDEO-01 | BUNDLED DEMO'],
    ] as const) {
      const texts: string[] = []
      const context = recordingContext(texts)
      vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation((() => recordingContext([])) as unknown as HTMLCanvasElement['getContext'])
      const canvas = { width: 0, height: 0, getContext: () => context } as unknown as HTMLCanvasElement
      const feed = createProceduralFeed(canvas, 'VIDEO-01', undefined, liveData)
      expect(feed).not.toBeNull()
      feed!.resize(640, 360)
      feed!.paint(0, { animate: false, now: Date.parse('2026-10-01T03:00:00.000Z') })
      expect(texts).toContain(expected)
      feed!.destroy()
      vi.restoreAllMocks()
    }
  })
})

describe('the picture\'s default accessible name', () => {
  it('Simulated (a simulator in the context, or none): "Camera 1 · LIVE SESSION FEED", unchanged', () => {
    const sim = createTestSim()
    const view = render(
      <SimProvider sim={sim}>
        <CameraFeed cameraId="VIDEO-01" />
      </SimProvider>,
    )
    expect(screen.getByRole('img', { name: SIMULATED_NAME })).toBeInTheDocument()
    view.unmount()
    render(<CameraFeed cameraId="VIDEO-01" />)
    expect(screen.getByRole('img', { name: SIMULATED_NAME })).toBeInTheDocument()
    sim.stop()
  })

  it('Live (the Live source in the context, as on the Session Monitor): "Camera 1 · Bundled demo picture"; the picture is not called a live feed', async () => {
    const created = createLiveTestBed({ session: SUPERVISOR_SESSION })
    bed = created
    const page = await created.load()
    render(
      <SimProvider sim={page.runtime.sim}>
        <CameraFeed cameraId="VIDEO-01" variant="feed" />
      </SimProvider>,
    )
    expect(screen.getByRole('img', { name: LIVE_NAME })).toBeInTheDocument()
    expect(screen.queryAllByRole('img', { name: new RegExp(en.session.feed.title) })).toEqual([])
    expect(getMissingI18nKeys()).toEqual([])
  })

  it('Devices & Inputs, its camera tiles\' own name: "Live preview, Camera 1" in Simulated mode (unchanged), "Camera 1, bundled demo picture" in Live mode', async () => {
    const authStorage = createMemoryAuthStorage()
    authStorage.save({ operatorId: OPERATOR_IDS.ANDI, issuedAt: DEMO_NOW })
    const sim = createSim({ clock: createManualClock(DEMO_NOW), scenario: 'idle', storage: null, authStorage, visibility: ALWAYS_VISIBLE, scheduler: () => () => undefined })
    const router = createAppRouter(
      { sim, queryClient: new QueryClient({ defaultOptions: { queries: { retry: false } } }), socketFactory: () => new SilentSocket() },
      { history: createMemoryHistory({ initialEntries: ['/devices'] }) },
    )
    const simulated = render(<RouterProvider router={router} />)
    await screen.findByTestId('page-devices', {}, { timeout: 15_000 })
    expect(screen.getByRole('img', { name: en.devices.cameras.feedAria.replace('{{name}}', 'Camera 1') })).toBeInTheDocument()
    simulated.unmount()
    sim.stop()

    const created = createLiveTestBed({ session: SUPERVISOR_SESSION })
    bed = created
    const page = await created.load()
    await created.mount(page, '/devices')
    await screen.findByTestId('page-devices', {}, { timeout: 15_000 })
    expect(screen.getByRole('img', { name: en.devices.live.feedAria.replace('{{name}}', 'Camera 1') })).toBeInTheDocument()
    expect(screen.queryAllByRole('img', { name: /Live preview/ })).toEqual([])
    expect(getMissingI18nKeys()).toEqual([])
  })

  it('a caller\'s own accessible name is kept in both modes', () => {
    const sim = createTestSim()
    render(
      <SimProvider sim={sim}>
        <CameraFeed cameraId="VIDEO-01" ariaLabel="Camera 1 preview" />
      </SimProvider>,
    )
    expect(screen.getByRole('img', { name: 'Camera 1 preview' })).toBeInTheDocument()
    sim.stop()
  })
})
