/**
 * @vitest-environment jsdom
 * @vitest-environment-options { "url": "http://127.0.0.1:5178/" }
 */
// Fix wave H, closing pass Z2 (driver D's note 124, section 4 item 2; decision D206): the two audio
// cards of Devices & Inputs mapped AUDIO-01 / AUDIO-02 to `MIC-01` / `MIC-02` by a constant
// (`sim-adapter.ts` `MIC_DEVICE`), so with another pair on the selector's lines the badge, the
// "is on" mark and the unreachable mark of a card were those of the wrong microphone - or missing.
// A card is a LINE (ruling D137: channel 1 is the first microphone line, channel 2 the second,
// whatever their ids): its marks are those of the microphone that IS on that line.
//
// Proven with the pair MIC-03 (PRIMARY, line 1, this Mac's microphone, open) / MIC-01 (STANDBY,
// line 2, a generated source): the AUDIO-01 card carries MIC-03's marks, the AUDIO-02 card MIC-01's.
// CONTROL: the built-in pair reads as before.
import { cleanup, configure, render, screen, within } from '@testing-library/react'
import { QueryClient } from '@tanstack/react-query'
import { createMemoryHistory, RouterProvider } from '@tanstack/react-router'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AuthSessionInfo } from '@dems/shared/api'
import { en } from '@dems/shared/i18n'
import type { SocketLike } from '@dems/shared/realtime'
import { ALWAYS_VISIBLE, createMemoryAuthStorage, createSim, OPERATOR_IDS, OPERATORS, ROLE_PERMISSIONS, type Sim, type SimState } from '@dems/shared/sim'
import { SHELL_INTRO_STORAGE_KEY } from '@/components/shell/shell-entrance'
import { getMissingI18nKeys, resetMissingI18nKeys } from '@/i18n'
import { resetCoreErrorPresenter } from '@/lib/core-errors'
import { createAppRouter } from '@/router'
import { createLiveTestBed, type LiveTestBed } from '@/runtime/testing/live-harness'

configure({ asyncUtilTimeout: 8_000 })
vi.setConfig({ testTimeout: 30_000 })

type Device = SimState['captureDevices']['devices'][number]
type MicLine = SimState['captureConfig']['mics'][number]

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

const sims: Sim[] = []
let bed: LiveTestBed | undefined

/** The pair MIC-03 (PRIMARY) / MIC-01 (STANDBY), in input order as the Core sends the lines. */
const pairOf = (mics: readonly MicLine[]): MicLine[] => [
  { ...mics[0]!, inputId: 'MIC-03', deviceId: 'MIC-03', role: 'PRIMARY' } as MicLine,
  { ...mics[0]!, inputId: 'MIC-01', deviceId: 'MIC-01', role: 'STANDBY' } as MicLine,
]

function sessionOf(operatorId: string): Pick<AuthSessionInfo, 'operator' | 'permissions'> {
  const operator = OPERATORS.find((entry) => entry.id === operatorId)!
  return {
    operator: { id: operator.id, username: operator.username, rank: operator.rank, name: operator.name, displayName: operator.displayName, initials: operator.initials, role: operator.role },
    permissions: [...ROLE_PERMISSIONS[operator.role]],
  }
}

/** A Live console on a Core in real capture. `pair`: MIC-03 / MIC-01 on the lines; else the built-in pair. */
async function liveDevices(pair: boolean) {
  const created = createLiveTestBed({ session: sessionOf(OPERATOR_IDS.ANDI) })
  bed = created
  const served = created.core.served
  const devices = served.captureDevices.devices.map((device) => ({ ...device, adapter: 'FAKE', sourceClass: 'DEVELOPMENT' }) as Device)
  const like = devices.find((device) => device.kind === 'MIC')!
  served.captureDevices = { devices: [...devices, { ...like, id: 'MIC-03', model: 'Added microphone', adapter: 'LOCAL_DEVICE', sourceClass: 'DEVELOPMENT', sourceOpen: true } as Device] }
  if (pair) served.captureConfig = { ...served.captureConfig, mics: pairOf(served.captureConfig.mics) }
  const page = await created.load()
  await created.mount(page, '/devices')
  await screen.findByTestId('page-devices')
  return created
}

const card = (channel: 'AUDIO-01' | 'AUDIO-02') => screen.findByTestId(`audio-input-${channel}`)

const originalPlay = HTMLMediaElement.prototype.play
const originalPause = HTMLMediaElement.prototype.pause
const originalGetContext = HTMLCanvasElement.prototype.getContext
beforeAll(() => {
  HTMLCanvasElement.prototype.getContext = (() => null) as unknown as HTMLCanvasElement['getContext']
  HTMLMediaElement.prototype.play = (() => Promise.resolve()) as unknown as HTMLMediaElement['play']
  HTMLMediaElement.prototype.pause = (() => undefined) as unknown as HTMLMediaElement['pause']
  Element.prototype.scrollTo ??= function scrollTo() {}
  window.scrollTo = (() => undefined) as typeof window.scrollTo
  Element.prototype.getAnimations ??= function getAnimations() {
    return []
  }
})
afterAll(() => {
  HTMLCanvasElement.prototype.getContext = originalGetContext
  HTMLMediaElement.prototype.play = originalPlay
  HTMLMediaElement.prototype.pause = originalPause
})
beforeEach(() => {
  resetMissingI18nKeys()
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

describe('the audio cards follow the selector\'s lines (pair MIC-03 / MIC-01)', () => {
  it('real capture: the AUDIO-01 card carries the badge and the "is on" mark of MIC-03, the AUDIO-02 card the badge of MIC-01', async () => {
    await liveDevices(true)
    const first = await card('AUDIO-01')
    const second = await card('AUDIO-02')
    expect(first).toHaveAttribute('data-mic-input', 'MIC-03')
    expect(second).toHaveAttribute('data-mic-input', 'MIC-01')
    // Line 1: this Mac's microphone (LOCAL_DEVICE), and it is open.
    expect(await within(first).findByTestId('source-badge-AUDIO-01')).toHaveAttribute('data-adapter', 'LOCAL_DEVICE')
    expect(within(first).getByTestId('source-on-AUDIO-01')).toHaveTextContent(en.common.sourceClass.microphoneOn.web)
    expect(within(first).getByTestId('audio-line-input-AUDIO-01')).toHaveTextContent(en.common.sourceClass.kind.localMicrophone)
    // Line 2: MIC-01, a generated source that is not this Mac's - and nothing says it is on.
    expect(within(second).getByTestId('source-badge-AUDIO-02')).toHaveAttribute('data-adapter', 'FAKE')
    expect(within(second).queryByTestId('source-on-AUDIO-02')).toBeNull()
    expect(within(second).getByTestId('audio-line-input-AUDIO-02')).toHaveTextContent(en.common.devices.mic1)
    expect(getMissingI18nKeys()).toEqual([])
  })

  it('CONTROL - the built-in pair: each card carries its own microphone\'s badge and names no other input', async () => {
    await liveDevices(false)
    const first = await card('AUDIO-01')
    const second = await card('AUDIO-02')
    expect(first).toHaveAttribute('data-mic-input', 'MIC-01')
    expect(second).toHaveAttribute('data-mic-input', 'MIC-02')
    expect(await within(first).findByTestId('source-badge-AUDIO-01')).toHaveAttribute('data-adapter', 'FAKE')
    expect(within(second).getByTestId('source-badge-AUDIO-02')).toHaveAttribute('data-adapter', 'FAKE')
    expect(within(first).queryByTestId('source-on-AUDIO-01')).toBeNull()
    expect(within(first).queryByTestId('audio-line-input-AUDIO-01')).toBeNull()
    expect(within(second).queryByTestId('audio-line-input-AUDIO-02')).toBeNull()
  })

  it('Simulated mode: the card names the line\'s input from the selector, with no development badge', async () => {
    const authStorage = createMemoryAuthStorage()
    authStorage.save({ operatorId: OPERATOR_IDS.ANDI, issuedAt: Date.now() })
    const sim = createSim({ scenario: 'idle', storage: null, authStorage, visibility: ALWAYS_VISIBLE, scheduler: () => () => undefined })
    sims.push(sim)
    const state = sim.store.getState()
    sim.store.setState({ captureConfig: { ...state.captureConfig, mics: pairOf(state.captureConfig.mics) } })
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const router = createAppRouter({ sim, queryClient, socketFactory: () => new SilentSocket() }, { history: createMemoryHistory({ initialEntries: ['/devices'] }) })
    render(<RouterProvider router={router} />)
    const first = await card('AUDIO-01')
    expect(first).toHaveAttribute('data-mic-input', 'MIC-03')
    expect(within(first).getByTestId('audio-line-input-AUDIO-01')).toHaveTextContent('MIC 3')
    expect(within(first).queryByTestId('source-badge-AUDIO-01')).toBeNull()
    expect(await card('AUDIO-02')).toHaveAttribute('data-mic-input', 'MIC-01')
  })
})
