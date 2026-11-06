// Integration pass D10, item 1 (pass D6 item 12; decision D156): the Session Monitor reaches
// "connecting cameras", "recording" and "nothing was recorded" THROUGH THE SIMULATOR'S OWN ACTIONS
// in Simulated client mode. Row 139's `situation-c.test.tsx` puts each state on the store by hand;
// here nothing is put on the store: the operator's start, the simulator's clock and the existing
// demo control (the fault CAMERA_LOSS on each camera) produce them.
import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react'
import { QueryClient } from '@tanstack/react-query'
import { createMemoryHistory, RouterProvider } from '@tanstack/react-router'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { en } from '@dems/shared/i18n'
import type { SocketLike } from '@dems/shared/realtime'
import { ALWAYS_VISIBLE, CAPTURE_CONNECT_MS, createManualClock, createMemoryAuthStorage, createSim, OPERATOR_IDS, type Sim } from '@dems/shared/sim'
import { getMissingI18nKeys, resetMissingI18nKeys } from '@/i18n'
import { createAppRouter } from '@/router'
import { selectBanner, selectFeed } from '../model'

vi.setConfig({ testTimeout: 30_000 })

const S = en.common.session
const N = en.common.captureNotice
const START = Date.UTC(2026, 9, 1, 3, 0, 0)

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

/** An ARMED session on a simulator the test drives by its clock; nothing is written to the store by hand. */
function mountArmed() {
  const clock = createManualClock(START)
  const authStorage = createMemoryAuthStorage()
  authStorage.save({ operatorId: OPERATOR_IDS.BUDI, issuedAt: START })
  const sim = createSim({ clock, scenario: 'idle', storage: null, authStorage, visibility: ALWAYS_VISIBLE, scheduler: () => () => undefined })
  sims.push(sim)
  const run = (ms: number) => {
    for (let elapsed = 0; elapsed < ms; elapsed += 50) {
      clock.advance(50)
      sim.tick()
    }
  }
  sim.actions.createSession({ caseNumber: 'LP/2026/1001-0008', subjectType: 'SAKSI', subjectName: 'Test Saksi', investigatorId: OPERATOR_IDS.BUDI, room: 'Interview Room 1', profileId: 'STANDARD_1080P25' })
  sim.actions.beginPrecheck()
  run(5_000)
  expect(sim.store.getState().session?.state).toBe('ARMED')
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const router = createAppRouter({ sim, queryClient, socketFactory: () => new SilentSocket() }, { history: createMemoryHistory({ initialEntries: ['/session'] }) })
  render(<RouterProvider router={router} />)
  return { sim, run }
}

const banner = () => screen.findByTestId('sm-status-banner', {}, { timeout: 15_000 })

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
  resetMissingI18nKeys()
  HTMLMediaElement.prototype.play = vi.fn(() => Promise.resolve()) as unknown as HTMLMediaElement['play']
  HTMLMediaElement.prototype.pause = vi.fn() as unknown as HTMLMediaElement['pause']
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ status: 'ok' }), { status: 200 })))
})

afterEach(() => {
  cleanup()
  for (const sim of sims.splice(0)) sim.stop()
  vi.unstubAllGlobals()
})

describe('Session Monitor on the simulator itself: a recording start', () => {
  it('connecting -> recording: the start shows "connecting cameras" with no REC and End Session disabled; the simulated delay later it records', async () => {
    const { sim, run } = mountArmed()
    await banner()
    await act(async () => sim.actions.startRecording())
    await waitFor(() => expect(screen.getByTestId('sm-status-banner')).toHaveAttribute('data-kind', 'CONNECTING'))
    expect(sim.store.getState().session).toMatchObject({ state: 'RECORDING', captureDurable: false })
    expect(screen.queryByTestId('rec-indicator')).not.toBeInTheDocument()
    expect(screen.queryByTestId('rec-timer')).not.toBeInTheDocument()
    expect(selectFeed(sim.store.getState())).toMatchObject({ recording: false, connecting: true })
    expect(screen.getByTestId('sm-invitation')).toHaveTextContent(S.connectingCameras)
    const end = screen.getByTestId('sm-action-end')
    expect(end).toBeDisabled()
    expect(end).toHaveAttribute('data-connecting', 'true')

    // CONTROL: one tick short of the delay nothing has changed.
    await act(async () => run(CAPTURE_CONNECT_MS - 50))
    expect(screen.getByTestId('sm-status-banner')).toHaveAttribute('data-kind', 'CONNECTING')

    await act(async () => run(50))
    await waitFor(() => expect(screen.getByTestId('sm-status-banner')).toHaveAttribute('data-kind', 'ACTIVE'))
    expect(screen.getAllByTestId('rec-indicator').length).toBeGreaterThan(0)
    expect(selectFeed(sim.store.getState())).toMatchObject({ recording: true, connecting: false })
    expect(screen.getByTestId('sm-action-end')).not.toBeDisabled()
    expect(getMissingI18nKeys()).toEqual([])
  })

  it('connecting -> failed start: with the demo fault CAMERA_LOSS on all four cameras the start ends as "No camera connected. Nothing was recorded."', async () => { // D60 (2026-11-04): four tracks
    const { sim, run } = mountArmed()
    await banner()
    await act(async () => {
      // D60: the failed start needs every track lost — two were not enough since the fourth track.
      for (const cameraId of ['VIDEO-01', 'VIDEO-02', 'VIDEO-03', 'VIDEO-04'] as const) sim.actions.inject('CAMERA_LOSS', { cameraId })
    })
    const evidenceBefore = sim.store.getState().evidence.length
    await act(async () => sim.actions.startRecording())
    await waitFor(() => expect(screen.getByTestId('sm-status-banner')).toHaveAttribute('data-kind', 'CONNECTING'))

    await act(async () => run(CAPTURE_CONNECT_MS))
    await waitFor(() => expect(screen.getByTestId('sm-status-banner')).toHaveAttribute('data-kind', 'FAULT'))
    const shown = screen.getByTestId('sm-status-banner')
    expect(shown).toHaveAttribute('data-failed-start', 'NO_CAMERA_CONNECTED')
    expect(within(shown).getByTestId('sm-banner-detail')).toHaveTextContent(`${N.noCamera.title}. ${N.noCamera.body}`)
    expect(selectBanner(sim.store.getState()).failedStart).toBe('NO_CAMERA_CONNECTED')
    expect(screen.queryByTestId('rec-indicator')).not.toBeInTheDocument()
    expect(screen.queryByTestId('rec-timer')).not.toBeInTheDocument()
    expect(screen.getByTestId('sm-failed-start-devices')).toHaveAttribute('href', '/devices')
    // Nothing was recorded: no evidence item, in the store or on the page.
    expect(sim.store.getState().evidence).toHaveLength(evidenceBefore)
    expect(sim.store.getState().session).toMatchObject({ state: 'FAULT', startedAt: null, bytesWritten: 0, captureDurable: false })
    expect(getMissingI18nKeys()).toEqual([])
  })
})
