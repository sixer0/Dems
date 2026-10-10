/**
 * @vitest-environment jsdom
 * @vitest-environment-options { "url": "http://127.0.0.1:5178/" }
 */
// Fix pass F-M4, review findings R69-02 (web half: confirm) and R69-07 (the pre-check row) — the web
// console in Live mode on the real router and the real Live source over the contract-checked fake
// transport; the Core's side is a simulator whose state is served as the Core's. The "local"
// devices are a fixture state that SAYS `adapter: LOCAL_DEVICE` / `sourceOpen`: nothing is opened.
//
// NOT proven here: a real Core, a browser (gate-75 flow M5-SEC-PRIV-2-W).
//
// | Rule (ux §8f.3, SEC35-44 (4): a fixed "is on" state whenever the Core holds a local device open) | Where |
// |---|---|
// | Session New, the pre-check rows: "This Mac's camera is on" / "…microphone is on" from `sourceOpen: true`; nothing when false or absent | "pre-check rows" |
// | Session Monitor: the camera on screen and the microphone card | "Session Monitor" |
// | Dashboard: the camera tile and the microphone tile | "Dashboard" |
// | R69-07: the pre-check row of a LOCAL microphone says the limit sentence (open or not); a test-source microphone and a camera do not | "pre-check rows" |
import { cleanup, configure, screen, waitFor } from '@testing-library/react'
import { toast } from '@heroui/react'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { en } from '@dems/shared/i18n'
import { ALWAYS_VISIBLE, createManualClock, createMemoryAuthStorage, createSim, OPERATOR_IDS, type Sim, type SimState } from '@dems/shared/sim'
import { SHELL_INTRO_STORAGE_KEY } from '@/components/shell/shell-entrance'
import { CORE_START_MS, coreWithSession, mountSessionNew, type MountedSessionNew } from '@/features/session-new/__tests__/live-session-new-bed'
import { resetCoreErrorPresenter } from '@/lib/core-errors'
import { createLiveTestBed, SUPERVISOR_SESSION, type LiveTestBed } from '@/runtime/testing/live-harness'

configure({ asyncUtilTimeout: 8_000 })
vi.setConfig({ testTimeout: 30_000 })

const S = en.common.sourceClass
const LIMIT = en.common.localSourceNotice.microphoneLimit

const originalMatchMedia = window.matchMedia
const originalPlay = HTMLMediaElement.prototype.play
const originalPause = HTMLMediaElement.prototype.pause
const originalGetContext = HTMLCanvasElement.prototype.getContext

type Device = SimState['captureDevices']['devices'][number]
type Mark = { adapter: string; sourceOpen?: boolean }

/** The Core's devices with the given marks (a development source each); the others are untouched. */
function marked(state: SimState, marks: Readonly<Record<string, Mark>>): SimState {
  return {
    ...state,
    captureDevices: {
      ...state.captureDevices,
      devices: state.captureDevices.devices.map((device) => {
        const mark = marks[device.id]
        return (mark === undefined ? device : { ...device, sourceClass: 'DEVELOPMENT', ...mark }) as Device
      }),
    },
  }
}
const LOCAL = (open: boolean | undefined): Readonly<Record<string, Mark>> => {
  const mark: Mark = open === undefined ? { adapter: 'LOCAL_DEVICE' } : { adapter: 'LOCAL_DEVICE', sourceOpen: open }
  return { 'CAM-01': mark, 'MIC-01': mark }
}

let bed: LiveTestBed | undefined
let core: Sim | undefined
let sessionNew: MountedSessionNew | undefined

async function livePage(path: string, scenario: 'idle' | 'recording', shape: (state: SimState) => SimState): Promise<void> {
  const created = createLiveTestBed({ session: SUPERVISOR_SESSION })
  bed = created
  const authStorage = createMemoryAuthStorage()
  authStorage.save({ operatorId: OPERATOR_IDS.ANDI, issuedAt: created.fake.clock.now() })
  core = createSim({ scenario, clock: createManualClock(created.fake.clock.now()), storage: null, authStorage, visibility: ALWAYS_VISIBLE, scheduler: () => () => undefined })
  created.core.served = shape(core.store.getState())
  const page = await created.load()
  await created.mount(page, path)
}

const texts = (prefix: string) =>
  Array.from(document.querySelectorAll(`[data-testid^="${prefix}"]`)).map((element) => [element.getAttribute('data-testid'), element.textContent])

beforeAll(() => {
  HTMLCanvasElement.prototype.getContext = (() => null) as unknown as HTMLCanvasElement['getContext']
})
afterAll(() => {
  HTMLCanvasElement.prototype.getContext = originalGetContext
  HTMLMediaElement.prototype.play = originalPlay
  HTMLMediaElement.prototype.pause = originalPause
})
beforeEach(() => {
  resetCoreErrorPresenter()
  window.localStorage.clear()
  window.sessionStorage.clear()
  window.sessionStorage.setItem(SHELL_INTRO_STORAGE_KEY, '1')
  HTMLMediaElement.prototype.play = vi.fn(() => Promise.resolve()) as unknown as HTMLMediaElement['play']
  HTMLMediaElement.prototype.pause = vi.fn() as unknown as HTMLMediaElement['pause']
})
afterEach(async () => {
  cleanup()
  window.matchMedia = (() => ({ matches: true })) as unknown as typeof window.matchMedia
  toast.clear()
  window.matchMedia = originalMatchMedia
  sessionNew?.bed.dispose()
  sessionNew = undefined
  bed?.dispose()
  bed = undefined
  core?.stop()
  core = undefined
  vi.restoreAllMocks()
})

describe('Session New, the pre-check rows', () => {
  /** A session whose pre-check ran (step 2); the rows stand for CAM-01 and MIC-01. */
  async function precheckRows(marks: Readonly<Record<string, Mark>>) {
    const driver = coreWithSession(CORE_START_MS, 'WARN')
    sessionNew = await mountSessionNew({ served: marked(driver.state(), marks) })
    await waitFor(() => expect(screen.getByTestId('page-session-new')).toHaveAttribute('data-step', '2'))
    await screen.findByTestId('sn-check-LENS_1')
  }

  it('`sourceOpen: true`: the camera row and the microphone rows of the open local devices say "is on"', async () => {
    await precheckRows(LOCAL(true))
    await waitFor(() => expect(screen.getByTestId('source-on-precheck-LENS_1')).toHaveTextContent(S.cameraOn.web))
    const on = texts('source-on-precheck-')
    expect(on.filter(([, text]) => text === S.cameraOn.web).map(([id]) => id)).toEqual(['source-on-precheck-LENS_1'])
    const microphones = on.filter(([, text]) => text === S.microphoneOn.web)
    expect(microphones.length).toBeGreaterThan(0)
    expect(on).toHaveLength(1 + microphones.length)
    expect(screen.getByTestId('source-on-precheck-LENS_1')).toHaveAttribute('role', 'status')
  })

  it('CONTROL: `sourceOpen` false or absent: the badge stands, no "is on" line', async () => {
    await precheckRows(LOCAL(false))
    await screen.findByTestId('source-badge-precheck-LENS_1')
    expect(texts('source-on-precheck-')).toEqual([])
    cleanup()
    sessionNew!.bed.dispose()
    sessionNew = undefined
    await precheckRows(LOCAL(undefined))
    await screen.findByTestId('source-badge-precheck-LENS_1')
    expect(texts('source-on-precheck-')).toEqual([])
  })

  it('R69-07: the row of a LOCAL microphone says the limit sentence, open or not; the camera row does not', async () => {
    await precheckRows(LOCAL(undefined))
    await screen.findByTestId('source-badge-precheck-LENS_1')
    const limits = texts('source-limit-precheck-')
    expect(limits.length).toBeGreaterThan(0)
    expect(limits.every(([id, text]) => text === LIMIT && id!.startsWith('source-limit-precheck-MIC_'))).toBe(true)
  })

  it('R69-07 CONTROL: a test-source microphone (`adapter: FAKE`) carries no limit sentence', async () => {
    await precheckRows({ 'CAM-01': { adapter: 'FAKE' }, 'MIC-01': { adapter: 'FAKE' } })
    await screen.findByTestId('source-badge-precheck-LENS_1')
    expect(texts('source-limit-')).toEqual([])
    expect(document.body.textContent).not.toContain(LIMIT)
  })
})

describe('Session Monitor', () => {
  it('`sourceOpen: true`: the camera on screen and the microphone card say "is on"', async () => {
    await livePage('/session', 'recording', (state) => marked(state, LOCAL(true)))
    await screen.findByTestId('page-session-monitor', {}, { timeout: 15_000 })
    await waitFor(() => expect(screen.getByTestId('source-on-monitor-VIDEO-01')).toHaveTextContent(S.cameraOn.web))
    expect(screen.getByTestId('source-on-monitor-AUDIO-01')).toHaveTextContent(S.microphoneOn.web)
    expect(texts('source-on-monitor-')).toHaveLength(2)
  })

  it('CONTROL: `sourceOpen: false`: the badges stand, no "is on" line', async () => {
    await livePage('/session', 'recording', (state) => marked(state, LOCAL(false)))
    await screen.findByTestId('page-session-monitor', {}, { timeout: 15_000 })
    await screen.findByTestId('source-badge-monitor-VIDEO-01')
    await screen.findByTestId('source-badge-monitor-AUDIO-01')
    expect(texts('source-on-')).toEqual([])
  })
})

describe('Dashboard', () => {
  it('`sourceOpen: true`: the camera tile and the microphone tile say "is on"', async () => {
    await livePage('/dashboard', 'idle', (state) => marked(state, LOCAL(true)))
    await screen.findByTestId('device-tile-AUDIO-02')
    await waitFor(() => expect(screen.getByTestId('source-on-dashboard-VIDEO-01')).toHaveTextContent(S.cameraOn.web))
    expect(screen.getByTestId('source-on-dashboard-AUDIO-01')).toHaveTextContent(S.microphoneOn.web)
    expect(texts('source-on-dashboard-')).toHaveLength(2)
  })

  it('CONTROL: `sourceOpen` absent: the badges stand, no "is on" line', async () => {
    await livePage('/dashboard', 'idle', (state) => marked(state, LOCAL(undefined)))
    await screen.findByTestId('device-tile-AUDIO-02')
    await screen.findByTestId('source-badge-dashboard-VIDEO-01')
    await screen.findByTestId('source-badge-dashboard-AUDIO-01')
    expect(texts('source-on-')).toEqual([])
  })
})
