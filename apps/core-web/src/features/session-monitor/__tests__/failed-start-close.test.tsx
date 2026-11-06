// Task 3, integration pass D7 follow-up (controller decision D158, item 1; found by reading in pass D7
// item 5; masterplan/08_client_ux_spec.md §8e.2 situation C, OP-125-5; decisions D84, D91, D156).
//
// On the web Session Monitor "Close session" of a FAILED START calls the Core's recovery of that
// session; the session passes through RECOVERY in the store, and the page opened its recovery
// overlay (recovery scan / incomplete-session analysis) for a session that recorded nothing.
// Held here on the real router in Simulated client mode (the state is put on the store as the Core
// sends it): closing a failed start opens NO overlay and shows no recovery wording — the failed-start
// banner stays, without its control, until the session has left the store; then the Monitor is idle.
// CONTROL: a durable FAULT still opens the recovery overlay.
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { QueryClient } from '@tanstack/react-query'
import { createMemoryHistory, RouterProvider } from '@tanstack/react-router'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import type { SocketLike } from '@dems/shared/realtime'
import { ALWAYS_VISIBLE, createMemoryAuthStorage, createSim, OPERATOR_IDS, type Sim, type SimAlert } from '@dems/shared/sim'
import { getMissingI18nKeys, resetMissingI18nKeys } from '@/i18n'
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

/** FAULT of the recording scenario's session, as the Core leaves a start that failed (`captureDurable: false`) or an interrupted recording (`true`). */
function mountFault(captureDurable: boolean): Sim {
  const authStorage = createMemoryAuthStorage()
  authStorage.save({ operatorId: OPERATOR_IDS.BUDI, issuedAt: Date.now() })
  const sim = createSim({ scenario: 'recording', storage: null, authStorage, visibility: ALWAYS_VISIBLE, scheduler: () => () => undefined })
  sims.push(sim)
  const state = sim.store.getState()
  const alert: SimAlert = {
    id: 'ALR-000901',
    at: state.clock.now,
    severity: 'CRITICAL',
    kind: 'CAPTURE_FAULT',
    message: 'Capture fault',
    active: true,
    acknowledged: false,
    resolvedAt: null,
    target: null,
    params: { kind: 'CAPTURE_FAULT', reason: 'NO_CAMERA_CONNECTED', evidenceFiles: 0 },
  }
  sim.store.setState({
    session: {
      ...state.session!,
      state: 'FAULT',
      fault: { kind: 'CAPTURE_FAULT', at: state.clock.now, fromState: 'RECORDING' },
      ...(captureDurable ? {} : { startedAt: null, bytesWritten: 0 }),
      captureDurable,
    },
    alerts: [...state.alerts, alert],
  })
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const router = createAppRouter({ sim, queryClient, socketFactory: () => new SilentSocket() }, { history: createMemoryHistory({ initialEntries: ['/session'] }) })
  render(<RouterProvider router={router} />)
  return sim
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

describe('closing a failed start on the Session Monitor (pass D7 follow-up, D158 item 1)', () => {
  it('"Close session" opens no recovery overlay and shows no recovery wording; the banner stays until the session is gone, then the Monitor is idle', async () => {
    const sim = mountFault(false)
    const shown = await banner()
    expect(shown).toHaveAttribute('data-failed-start', 'NO_CAMERA_CONNECTED')
    fireEvent.click(within(shown).getByTestId('sm-banner-cta'))
    await waitFor(() => expect(sim.store.getState().session?.state).toBe('RECOVERY'))
    // The store passes through RECOVERY; the page presents none of it.
    await waitFor(() => expect(screen.getByTestId('page-session-monitor')).toHaveAttribute('data-session-state', 'RECOVERY'))
    expect(screen.queryByTestId('finalization-modal')).not.toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    const closing = screen.getByTestId('sm-status-banner')
    expect(closing).toHaveAttribute('data-kind', 'FAULT')
    expect(closing).toHaveAttribute('data-failed-start', 'NO_CAMERA_CONNECTED')
    expect(within(closing).getByTestId('sm-banner-detail')).toHaveTextContent('No camera connected. Nothing was recorded.')
    expect(within(closing).queryByTestId('sm-banner-cta')).not.toBeInTheDocument()
    const page = screen.getByTestId('page-session-monitor')
    expect(within(screen.getByTestId('panel-K')).queryByText(/recover/i)).not.toBeInTheDocument()
    expect(within(screen.getByTestId('sm-invitation')).queryByText(/recover|interrupted/i)).not.toBeInTheDocument()
    expect(within(screen.getByTestId('sm-invitation')).getByText('No camera connected')).toBeInTheDocument()

    // The Core has closed it (a history entry, no evidence item): the idle Monitor, still no overlay.
    act(() => sim.store.setState({ session: null }))
    await waitFor(() => expect(screen.getByTestId('sm-status-banner')).toHaveAttribute('data-kind', 'NO_SESSION'))
    expect(page).toHaveAttribute('data-session-state', 'IDLE')
    expect(screen.queryByTestId('finalization-modal')).not.toBeInTheDocument()
    expect(getMissingI18nKeys()).toEqual([])
  })

  it('CONTROL: a durable FAULT is recovered — the same press opens the recovery overlay', async () => {
    const sim = mountFault(true)
    const shown = await banner()
    expect(shown).not.toHaveAttribute('data-failed-start')
    expect(within(shown).getByTestId('sm-banner-cta')).toHaveTextContent('Start recovery')
    fireEvent.click(within(shown).getByTestId('sm-banner-cta'))
    await waitFor(() => expect(sim.store.getState().session?.state).toBe('RECOVERY'))
    expect(await screen.findByTestId('finalization-modal')).toBeInTheDocument()
    expect(screen.getByTestId('sm-status-banner')).toHaveAttribute('data-kind', 'RECOVERY')
  })
})
