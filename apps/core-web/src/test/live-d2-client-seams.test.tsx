/**
 * @vitest-environment jsdom
 * @vitest-environment-options { "url": "http://127.0.0.1:5178/" }
 */
// Integration pass D2 (client seams of rows 137 / 138; decisions D83, D100, D131, D133) — the web
// console in Live mode, on the real router and the real Live source over the contract-checked fake
// transport. The Core's side is a simulator whose state is served as the Core's.
//
// NOT proven here: a real Core, a browser (gate-70 flows W-DEVSRC, W-MIC of row 137).
//
// | Rule | Where it is proven here |
// |------|-------------------------|
// | Item 2: the Dashboard tiles carry the "Development source" badge of the device behind each tile, from the Core's `sourceClass` only | "Dashboard tiles" |
// | Item 2: the Session Monitor camera on screen and the mic meters carry it too | "Session Monitor" |
// | Item 4 (WB-07): System has the entry link to the camera search of Devices & Inputs | "System" |
// | Item 5: the microphones of the Monitor are named by the id the Core sends; a third microphone (`MIC-03`) is the active input, named "MIC 3" or "This Mac's microphone" | "a third microphone" |
import { cleanup, configure, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { toast } from '@heroui/react'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { en } from '@dems/shared/i18n'
import { ALWAYS_VISIBLE, createManualClock, createMemoryAuthStorage, createSim, OPERATOR_IDS, type Sim, type SimState } from '@dems/shared/sim'
import { SHELL_INTRO_STORAGE_KEY } from '@/components/shell/shell-entrance'
import { getMissingI18nKeys, resetMissingI18nKeys } from '@/i18n'
import { resetCoreErrorPresenter } from '@/lib/core-errors'
import { webErrorSink } from '@/runtime'
import { createLiveTestBed, SUPERVISOR_SESSION, type LiveTestBed } from '@/runtime/testing/live-harness'

configure({ asyncUtilTimeout: 8_000 })
vi.setConfig({ testTimeout: 30_000 })

const BADGE = en.common.sourceClass.badge
const KIND = en.common.sourceClass.kind

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

let bed: LiveTestBed | undefined
let core: Sim | undefined

type Mark = { sourceClass: 'DEVELOPMENT' | 'PRODUCTION'; adapter: string }
type Device = SimState['captureDevices']['devices'][number]

/** The Core's devices with the given marks; every other device carries no `sourceClass` and no `adapter` at all. */
function marked(state: SimState, marks: Readonly<Record<string, Mark>>): SimState {
  return {
    ...state,
    captureDevices: {
      ...state.captureDevices,
      devices: state.captureDevices.devices.map((device) => {
        const { sourceClass: _sourceClass, adapter: _adapter, ...bare } = device as Device & { sourceClass?: string; adapter?: string }
        const mark = marks[device.id]
        return (mark === undefined ? bare : { ...bare, ...mark }) as Device
      }),
    },
  }
}

/** The Core's model: a simulator, the SUPERVISOR signed in. */
function coreModel(at: number, scenario: 'idle' | 'recording'): Sim {
  const authStorage = createMemoryAuthStorage()
  authStorage.save({ operatorId: OPERATOR_IDS.ANDI, issuedAt: at })
  return createSim({ scenario, clock: createManualClock(at), storage: null, authStorage, visibility: ALWAYS_VISIBLE, scheduler: () => () => undefined })
}

/** The SUPERVISOR on `path` in Live mode; `shape` changes what the Core holds before the page loads. */
async function livePage(path: string, scenario: 'idle' | 'recording', shape: (state: SimState) => SimState): Promise<LiveTestBed> {
  const created = createLiveTestBed({ session: SUPERVISOR_SESSION })
  bed = created
  core = coreModel(created.fake.clock.now(), scenario)
  created.core.served = shape(core.store.getState())
  const page = await created.load()
  await created.mount(page, path)
  return created
}

const badges = (place: string) => Array.from(document.querySelectorAll(`[data-testid^="source-badge-${place}-"]`)).map((element) => element.getAttribute('data-testid'))

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
  cleanup()
  await clearToasts()
  bed?.dispose()
  bed = undefined
  core?.stop()
  core = undefined
  window.matchMedia = originalMatchMedia
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('Dashboard tiles (WB-02): the development-source badge', () => {
  it('no device carries `sourceClass`: no tile has a badge', async () => {
    await livePage('/dashboard', 'idle', (state) => marked(state, {}))
    await screen.findByTestId('device-tile-AUDIO-02')
    expect(badges('dashboard')).toEqual([])
    expect(screen.getByTestId('panel-e')).not.toHaveTextContent(BADGE)
  })

  it('the Core marks CAM-02 and MIC-01 as development sources: exactly their tiles carry the one badge, with the kind beside it', async () => {
    await livePage('/dashboard', 'idle', (state) =>
      marked(state, { 'CAM-02': { sourceClass: 'DEVELOPMENT', adapter: 'FAKE' }, 'MIC-01': { sourceClass: 'DEVELOPMENT', adapter: 'LOCAL_DEVICE' }, 'CAM-01': { sourceClass: 'PRODUCTION', adapter: 'ONVIF_RTSP' } }),
    )
    await screen.findByTestId('device-tile-AUDIO-02')
    await waitFor(() => expect(badges('dashboard')).toEqual(['source-badge-dashboard-VIDEO-02', 'source-badge-dashboard-AUDIO-01']))
    expect(screen.getByTestId('source-badge-dashboard-VIDEO-02')).toHaveTextContent(`${BADGE}${KIND.test}`)
    expect(screen.getByTestId('source-badge-dashboard-AUDIO-01')).toHaveTextContent(`${BADGE}${KIND.localMicrophone}`)
    expect(within(screen.getByTestId('device-tile-VIDEO-01')).queryByText(BADGE)).toBeNull()
    expect(within(screen.getByTestId('device-tile-AUDIO-02')).queryByText(BADGE)).toBeNull()
    expect(getMissingI18nKeys()).toEqual([])
  })
})

describe('Session Monitor (WB-01): the development-source badge', () => {
  it('the camera on screen and the mic meter of a development source carry the badge; the others do not', async () => {
    await livePage('/session', 'recording', (state) => marked(state, { 'CAM-01': { sourceClass: 'DEVELOPMENT', adapter: 'LOCAL_DEVICE' }, 'MIC-02': { sourceClass: 'DEVELOPMENT', adapter: 'FAKE' } }))
    await screen.findByTestId('page-session-monitor', {}, { timeout: 15_000 })
    await waitFor(() => expect(badges('monitor')).toEqual(['source-badge-monitor-VIDEO-01', 'source-badge-monitor-AUDIO-02']))
    expect(screen.getByTestId('source-badge-monitor-VIDEO-01')).toHaveTextContent(`${BADGE}${KIND.localCamera}`)
    expect(screen.getByTestId('source-badge-monitor-AUDIO-02')).toHaveTextContent(`${BADGE}${KIND.test}`)
  })

  it('no device carries `sourceClass`: nothing is drawn', async () => {
    await livePage('/session', 'recording', (state) => marked(state, {}))
    await screen.findByTestId('page-session-monitor', {}, { timeout: 15_000 })
    await waitFor(() => expect(screen.getByTestId('page-session-monitor')).toHaveAttribute('data-phase', 'RECORDING'))
    expect(badges('monitor')).toEqual([])
  })
})

describe('System (WB-07): the entry link to the camera search', () => {
  it('"Search for cameras" points at the camera search panel of Devices & Inputs and sends nothing', async () => {
    const created = await livePage('/system', 'idle', (state) => state)
    const link = await screen.findByTestId('system-camera-search-entry')
    expect(link).toHaveTextContent(en.devices.search.openFromSystem)
    expect(link.getAttribute('href')).toBe('/devices#camera-search')
    expect(created.fake.log.requestsOf('startCaptureDiscovery')).toHaveLength(0)
    expect(screen.getByTestId('system-capture-selector-entry').getAttribute('href')).toBe('/devices#capture-selector')
  })
})

describe('a third microphone (`MIC-03`) on the Session Monitor: named by the id the Core sends', () => {
  /** The session records with MIC-03 inside AUDIO-01 and MIC-01 as the standby. */
  const withThirdMic = (local: boolean) => (state: SimState): SimState => {
    const session = state.session!
    const template = state.captureDevices.devices.find((device) => device.kind === 'MIC')!
    const third = { ...template, id: 'MIC-03', ...(local ? { sourceClass: 'DEVELOPMENT', adapter: 'LOCAL_DEVICE' } : { sourceClass: 'PRODUCTION', adapter: 'USB_AUDIO' }) } as Device
    return {
      ...state,
      captureDevices: { ...state.captureDevices, devices: [...state.captureDevices.devices, third] },
      session: { ...session, audioSource: { sessionId: session.id, activeInputId: 'MIC-03', standbyInputId: 'MIC-01', switchedAt: null, intervalFromMs: 0 } } as typeof session,
    }
  }

  it('the pair is the Core`s: active MIC-03, the toggle offers MIC 1, the confirmation names "MIC 3"', async () => {
    await livePage('/session', 'recording', withThirdMic(false))
    await screen.findByTestId('page-session-monitor', {}, { timeout: 15_000 })
    const audio = screen.getByTestId('panel-O')
    await waitFor(() => expect(audio.querySelector('.sm-audio-body')).toHaveAttribute('data-active-input', 'MIC-03'))
    const toggle = within(audio).getByTestId('sm-audio-switch')
    expect(toggle).toHaveTextContent(en.session.audioSource.switchTo.replace('{{mic}}', 'MIC 1'))
    await waitFor(() => expect(toggle).not.toBeDisabled())
    fireEvent.click(toggle)
    const dialog = await screen.findByTestId('sm-audio-switch-dialog')
    expect(dialog).toHaveTextContent(en.session.audioSource.confirm.body.replace('{{from}}', 'MIC 3'))
    expect(getMissingI18nKeys()).toEqual([])
  })

  it('when the Core says MIC-03 is its local microphone, the confirmation says "This Mac`s microphone" (D83)', async () => {
    await livePage('/session', 'recording', withThirdMic(true))
    await screen.findByTestId('page-session-monitor', {}, { timeout: 15_000 })
    const audio = screen.getByTestId('panel-O')
    const toggle = within(audio).getByTestId('sm-audio-switch')
    await waitFor(() => expect(toggle).not.toBeDisabled())
    fireEvent.click(toggle)
    const dialog = await screen.findByTestId('sm-audio-switch-dialog')
    expect(dialog).toHaveTextContent(en.session.audioSource.confirm.body.replace('{{from}}', KIND.localMicrophone))
  })
})
