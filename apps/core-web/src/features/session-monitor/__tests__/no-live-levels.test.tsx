// Wave H, driver B (gate 75, G75-04; ux §8e.2 "no meters"; check `M5-NODEV-C-W` "0 generated meters"):
// no live microphone level is drawn before the first durable fragment, and none for a session that
// recorded nothing. Written RED: while the cameras connected the "Camera & Input Status" panel still
// drew both meters, and in a failed start the Audio Monitor cards, that panel and the Dashboard tiles did.
import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react'
import { QueryClient } from '@tanstack/react-query'
import { createMemoryHistory, RouterProvider } from '@tanstack/react-router'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { en } from '@dems/shared/i18n'
import type { SocketLike } from '@dems/shared/realtime'
import { ALWAYS_VISIBLE, createMemoryAuthStorage, createSim, OPERATOR_IDS, type Sim, type SimAlert } from '@dems/shared/sim'
import '@/i18n'
import { createAppRouter } from '@/router'

vi.setConfig({ testTimeout: 30_000 })

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

function mount(path: '/session' | '/'): Sim {
  const authStorage = createMemoryAuthStorage()
  authStorage.save({ operatorId: OPERATOR_IDS.BUDI, issuedAt: Date.now() })
  const sim = createSim({ scenario: 'recording', storage: null, authStorage, visibility: ALWAYS_VISIBLE, scheduler: () => () => undefined })
  sims.push(sim)
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const router = createAppRouter({ sim, queryClient, socketFactory: () => new SilentSocket() }, { history: createMemoryHistory({ initialEntries: [path] }) })
  render(<RouterProvider router={router} />)
  return sim
}

const setDurable = (sim: Sim, captureDurable: boolean) => act(() => sim.store.setState({ session: { ...sim.store.getState().session!, captureDurable } }))

/** A failed start as the Core's engine leaves it (`failedCaptureStartTransition`): FAULT, no start time, no byte. */
function failStart(sim: Sim) {
  const state = sim.store.getState()
  const fault: SimAlert = { id: 'ALR-000901', at: state.clock.now, severity: 'CRITICAL', kind: 'CAPTURE_FAULT', message: 'No camera connected. Nothing was recorded.', active: true, acknowledged: false, resolvedAt: null, target: null, params: { kind: 'CAPTURE_FAULT', reason: 'NO_CAMERA_CONNECTED', evidenceFiles: 0 } }
  act(() =>
    sim.store.setState({
      session: { ...state.session!, state: 'FAULT', fault: { kind: 'CAPTURE_FAULT', at: state.clock.now, fromState: 'RECORDING' }, startedAt: null, bytesWritten: 0, captureDurable: false },
      alerts: [...state.alerts, fault],
    }),
  )
}

const meters = (place: HTMLElement) => within(place).queryAllByTestId('dbfs-meter')
const originalPlay = HTMLMediaElement.prototype.play
const originalPause = HTMLMediaElement.prototype.pause
const originalGetContext = HTMLCanvasElement.prototype.getContext

beforeAll(() => {
  HTMLCanvasElement.prototype.getContext = (() => null) as unknown as HTMLCanvasElement['getContext']
  Element.prototype.scrollTo ??= function scrollTo() {}
  window.scrollTo = (() => undefined) as typeof window.scrollTo
})
afterAll(() => {
  HTMLCanvasElement.prototype.getContext = originalGetContext
  HTMLMediaElement.prototype.play = originalPlay
  HTMLMediaElement.prototype.pause = originalPause
})
beforeEach(() => {
  HTMLMediaElement.prototype.play = vi.fn(() => Promise.resolve()) as unknown as HTMLMediaElement['play']
  HTMLMediaElement.prototype.pause = vi.fn() as unknown as HTMLMediaElement['pause']
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ status: 'ok' }), { status: 200 })))
})
afterEach(() => {
  cleanup()
  for (const sim of sims.splice(0)) sim.stop()
  vi.unstubAllGlobals()
})

describe('G75-04: the Session Monitor draws no live level it does not have', () => {
  it('while the cameras connect the Camera & Input Status panel draws no meter; the meters come back with the first durable fragment', async () => {
    const sim = mount('/session')
    const inputs = await screen.findByTestId('sm-inputs', {}, { timeout: 15_000 })
    // CONTROL: a durable recording draws the two microphone meters of the panel.
    expect(meters(inputs)).toHaveLength(4) // D61 (2026-11-04): four simultaneous channels
    setDurable(sim, false)
    await waitFor(() => expect(meters(inputs)).toHaveLength(0))
    expect(within(inputs).queryByRole('meter')).toBeNull()
    expect(within(inputs).getByTestId('sm-input-no-level-AUDIO-01').textContent).toBe(en.common.session.trackConnecting)
    setDurable(sim, true)
    await waitFor(() => expect(meters(inputs)).toHaveLength(4)) // D61 (2026-11-04): four simultaneous channels
  })

  it('a failed start: neither the Audio Monitor cards nor the status panel draw a meter - nothing was recorded', async () => {
    const sim = mount('/session')
    const audio = await screen.findByTestId('panel-O', {}, { timeout: 15_000 })
    const inputs = await screen.findByTestId('sm-inputs')
    expect(meters(audio)).toHaveLength(4) // D61 (2026-11-04): four simultaneous channels
    failStart(sim)
    await waitFor(() => expect(meters(audio)).toHaveLength(0))
    expect(meters(inputs)).toHaveLength(0)
    expect(within(audio).queryByText(/dBFS/)).toBeNull()
    expect(within(inputs).queryByText(/dBFS/)).toBeNull()
    for (const channel of ['AUDIO-01', 'AUDIO-02']) {
      expect(within(audio).getByTestId(`sm-audio-no-level-${channel}`).textContent).toBe(en.common.session.failedStart.title)
      expect(within(inputs).getByTestId(`sm-input-no-level-${channel}`).textContent).toBe(en.common.session.failedStart.title)
    }
  })
})

describe('G75-04: the Dashboard microphone tiles in a failed start', () => {
  it('no meter on either microphone tile; a durable recording draws them (control)', async () => {
    const sim = mount('/')
    const tile = await screen.findByTestId('device-tile-AUDIO-01', {}, { timeout: 15_000 })
    expect(meters(tile)).toHaveLength(1)
    failStart(sim)
    await waitFor(() => expect(meters(screen.getByTestId('device-tile-AUDIO-01'))).toHaveLength(0))
    expect(meters(screen.getByTestId('device-tile-AUDIO-02'))).toHaveLength(0)
    expect(within(screen.getByTestId('device-tile-AUDIO-01')).queryByText(/dBFS/)).toBeNull()
  })
})
