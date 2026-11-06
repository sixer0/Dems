// Task 3, integration pass D7 follow-up (controller decision D158, item 3; ux §8e.2 situation C).
// The demo panel of System & Maintenance said "run recovery to close it as Incomplete" for any FAULT.
// For a FAILED START (`FAULT` + explicit `captureDurable: false`, put on the store as the Core sends
// it) it says what is true — nothing was recorded; the control closes the session. CONTROL: a FAULT
// of a recording keeps the recovery wording.
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { QueryClient } from '@tanstack/react-query'
import { createMemoryHistory, RouterProvider } from '@tanstack/react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { SocketLike } from '@dems/shared/realtime'
import { ALWAYS_VISIBLE, createManualClock, createMemoryAuthStorage, createSim, OPERATOR_IDS, type Sim, type SimAlert } from '@dems/shared/sim'
import { SHELL_INTRO_STORAGE_KEY } from '@/components/shell/shell-entrance'
import { getMissingI18nKeys, resetMissingI18nKeys } from '@/i18n'
import { createAppRouter } from '@/router'
import { DEMO_CONTROLS_STORAGE_KEY } from '../sim-adapter'

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
Element.prototype.scrollTo ??= function scrollTo() {}
Element.prototype.scrollIntoView ??= function scrollIntoView() {}
window.scrollTo = (() => undefined) as typeof window.scrollTo

const noCamera = (at: number): SimAlert => ({
  id: 'ALR-000901',
  at,
  severity: 'CRITICAL',
  kind: 'CAPTURE_FAULT',
  message: 'Capture fault',
  active: true,
  acknowledged: false,
  resolvedAt: null,
  target: null,
  params: { kind: 'CAPTURE_FAULT', reason: 'NO_CAMERA_CONNECTED', evidenceFiles: 0 },
})

beforeEach(() => {
  resetMissingI18nKeys()
  window.sessionStorage.setItem(SHELL_INTRO_STORAGE_KEY, '1')
  window.sessionStorage.removeItem(DEMO_CONTROLS_STORAGE_KEY)
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ status: 'ok' }), { status: 200 })))
})

afterEach(() => {
  cleanup()
  for (const sim of sims.splice(0)) sim.stop()
  window.sessionStorage.removeItem(SHELL_INTRO_STORAGE_KEY)
  vi.unstubAllGlobals()
})

describe('System demo panel on a failed start (pass D7 follow-up, D158 item 3)', { timeout: 30_000 }, () => {
  it('a FAULT of a recording says "run recovery"; a failed start says nothing was recorded and offers "Close session"', async () => {
    const clock = createManualClock(Date.now())
    const authStorage = createMemoryAuthStorage()
    authStorage.save({ operatorId: OPERATOR_IDS.BUDI, issuedAt: clock.now() })
    const sim = createSim({ storage: null, authStorage, clock, visibility: ALWAYS_VISIBLE, scheduler: () => () => undefined, scenario: 'recording' })
    sims.push(sim)
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const router = createAppRouter({ sim, queryClient, socketFactory: () => new SilentSocket() }, { history: createMemoryHistory({ initialEntries: ['/system'] }) })
    render(<RouterProvider router={router} />)
    const page = await screen.findByTestId('page-system', {}, { timeout: 10_000 })
    const panel = within(page).getByTestId('system-panel-demo')
    fireEvent.click(within(within(panel).getByTestId('system-demo-toggle')).getByRole('switch'))
    const demo = within(await within(panel).findByTestId('system-demo-body'))

    // CONTROL: the FAULT of a recording (no member, then an explicit `true`).
    fireEvent.click(demo.getByTestId('system-demo-fault-STORAGE_FULL'))
    expect(sim.store.getState().session?.state).toBe('FAULT')
    const recover = await demo.findByTestId('system-demo-recover')
    expect(within(recover).getByTestId('system-demo-recover-hint')).toHaveTextContent('The session is in FAULT: run recovery to close it as Incomplete.')
    expect(within(recover).getByRole('button')).toHaveTextContent('Recover session')
    act(() => sim.store.setState({ session: { ...sim.store.getState().session!, captureDurable: true }, alerts: [...sim.store.getState().alerts, noCamera(clock.now())] }))
    expect(within(recover).getByTestId('system-demo-recover-hint')).toHaveTextContent('run recovery')

    // The failed start.
    act(() => sim.store.setState({ session: { ...sim.store.getState().session!, captureDurable: false } }))
    await waitFor(() => expect(demo.getByTestId('system-demo-recover')).toHaveAttribute('data-failed-start', 'NO_CAMERA_CONNECTED'))
    const failed = demo.getByTestId('system-demo-recover')
    expect(within(failed).getByTestId('system-demo-recover-hint')).toHaveTextContent('No camera connected. Nothing was recorded.')
    expect(failed).not.toHaveTextContent(/recover|Incomplete/i)
    expect(within(failed).getByRole('button')).toHaveTextContent('Close session')
    expect(getMissingI18nKeys()).toEqual([])
  })
})
