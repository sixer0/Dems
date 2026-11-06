// Task 3, integration pass D7 items 3 and 5, web (row 139's request, file_requests.md 16:42:26Z;
// masterplan/08_client_ux_spec.md §8e.1 "told apart by reason", §8e.2 situation C and "Between the
// accepted start and the first durable fragment"; decisions D84, D91 R-1 option A, D156).
//
// Two placement groups of the web console, one case each, on the real router and shell over a
// simulator in the recording scenario (it never writes `captureDurable`, so the state is put on the
// store as the Core sends it):
// - Dashboard (WB-02: the ring, the hero and the Active Session tile): "Connecting cameras…", no REC
//   and no timer while `captureDurable` is false; a failed start says "Nothing was recorded." in full
//   and is not presented as a fault to recover;
// - alert centre (the notifications bell): the alert of a failed start is worded from
//   `params.reason`, the degraded warning names the camera.
// Each case holds its CONTROL: the session without the member, and a durable one, read as recording.
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { QueryClient } from '@tanstack/react-query'
import { createMemoryHistory, RouterProvider } from '@tanstack/react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { SocketLike } from '@dems/shared/realtime'
import { ALWAYS_VISIBLE, createManualClock, createMemoryAuthStorage, createSim, OPERATOR_IDS, type Sim, type SimAlert } from '@dems/shared/sim'
import { failedStartAlertLine } from '@/components/shell/failed-start-alert'
import { SHELL_INTRO_STORAGE_KEY } from '@/components/shell/shell-entrance'
import { getMissingI18nKeys, resetMissingI18nKeys } from '@/i18n'
import { REDUCED_MOTION_MEDIA_QUERY } from '@/motion'
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

/** `matchMedia` for a 1920 px viewport with reduced motion (jsdom has no layout; the views swap at once). */
function stubMatchMedia() {
  window.matchMedia = ((query: string) => {
    const min = /min-width:\s*(\d+)px/.exec(query)
    return {
      matches: query === REDUCED_MOTION_MEDIA_QUERY ? true : min ? 1920 >= Number(min[1]) : false,
      media: query,
      onchange: null,
      addListener: () => undefined,
      removeListener: () => undefined,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      dispatchEvent: () => false,
    } as MediaQueryList
  }) as typeof window.matchMedia
}

const DEMO_NOW = Date.parse('2026-10-01T10:00:00+07:00')
const sims: Sim[] = []
const originalMatchMedia = window.matchMedia
Element.prototype.scrollTo ??= function scrollTo() {}
window.scrollTo = (() => undefined) as typeof window.scrollTo

function mount(): Sim {
  const authStorage = createMemoryAuthStorage()
  authStorage.save({ operatorId: OPERATOR_IDS.BUDI, issuedAt: DEMO_NOW })
  const sim = createSim({ clock: createManualClock(DEMO_NOW), scenario: 'recording', storage: null, authStorage, visibility: ALWAYS_VISIBLE, scheduler: () => () => undefined })
  sims.push(sim)
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const router = createAppRouter({ sim, queryClient, socketFactory: () => new SilentSocket() }, { history: createMemoryHistory({ initialEntries: ['/dashboard'] }) })
  render(<RouterProvider router={router} />)
  return sim
}

const alertOf = (patch: Partial<SimAlert>): SimAlert => ({
  id: 'ALR-000900',
  at: DEMO_NOW,
  severity: 'CRITICAL',
  kind: 'CAPTURE_FAULT',
  message: 'Capture fault',
  active: true,
  acknowledged: false,
  resolvedAt: null,
  target: null,
  params: { kind: 'CAPTURE_FAULT' },
  ...patch,
})
const noCamera = alertOf({ id: 'ALR-000901', params: { kind: 'CAPTURE_FAULT', reason: 'NO_CAMERA_CONNECTED', evidenceFiles: 0 } })
const plainFault = alertOf({ id: 'ALR-000903' })
const cameraNotConnected = alertOf({
  id: 'ALR-000902',
  severity: 'WARNING',
  kind: 'SYSTEM',
  message: 'CAM-02 is not connected',
  target: 'CAM-02',
  params: { reason: 'CAPTURE_DEVICE_UNREACHABLE', deviceId: 'CAM-02', deviceKind: 'CAMERA', phase: 'SESSION_START', cause: 'NOT_CONNECTED' },
})

const setDurable = (sim: Sim, captureDurable: boolean) => act(() => sim.store.setState({ session: { ...sim.store.getState().session!, captureDurable } }))
const panel = (id: 'a' | 'b' | 'd') => screen.findByTestId(`panel-${id}`, {}, { timeout: 8000 })

beforeEach(() => {
  window.sessionStorage.setItem(SHELL_INTRO_STORAGE_KEY, '1')
  vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 503 })))
  stubMatchMedia()
  resetMissingI18nKeys()
})

afterEach(() => {
  cleanup()
  for (const sim of sims.splice(0)) sim.stop()
  window.matchMedia = originalMatchMedia
  window.sessionStorage.removeItem(SHELL_INTRO_STORAGE_KEY)
  vi.unstubAllGlobals()
})

describe('session start on the web console (pass D7 items 3 and 5)', () => {
  it('Dashboard: "Connecting cameras…" on the ring, the hero and the session tile, with no REC and no timer, while captureDurable is false; a failed start is not a fault to recover', async () => {
    const sim = mount()
    const id = sim.store.getState().session!.id
    const [ring, hero, tile] = [await panel('a'), await panel('b'), await panel('d')]
    // CONTROL: the session without the member reads as recording, in all three.
    await waitFor(() => expect(within(ring).getByTestId('ring-status-line')).toHaveTextContent('SECURE • HEALTHY • RECORDING'))
    expect(within(ring).getAllByTestId('rec-indicator').length).toBeGreaterThan(0)
    expect(within(hero).getByTestId('hero-session-line')).toHaveTextContent(`Recording ${id}`)
    expect(within(tile).getAllByTestId('rec-indicator').length).toBeGreaterThan(0)
    expect(within(tile).queryByTestId('session-connecting')).toBeNull()

    setDurable(sim, false)
    await waitFor(() => expect(within(ring).getByTestId('ring-status-line')).toHaveTextContent('Connecting cameras…'))
    expect(within(ring).queryByTestId('rec-indicator')).toBeNull()
    expect(within(ring).getByText('Connecting cameras… Recording has not started.')).toBeInTheDocument()
    expect(within(hero).getByTestId('hero-session-line')).toHaveTextContent(`Connecting cameras… ${id}`)
    expect(within(hero).queryByText(/^Recording /)).toBeNull()
    expect(within(tile).getByTestId('session-connecting')).toHaveTextContent('Connecting cameras…')
    expect(within(tile).queryByTestId('rec-indicator')).toBeNull()
    expect(within(tile).queryByTestId('rec-timer')).toBeNull()
    expect(within(tile).getByTestId('session-start')).toHaveTextContent('—')

    // The first durable fragment: recording again.
    setDurable(sim, true)
    await waitFor(() => expect(within(ring).getByTestId('ring-status-line')).toHaveTextContent('SECURE • HEALTHY • RECORDING'))
    expect(within(hero).getByTestId('hero-session-line')).toHaveTextContent(`Recording ${id}`)
    expect(within(tile).getAllByTestId('rec-indicator').length).toBeGreaterThan(0)
    expect(within(tile).queryByTestId('session-connecting')).toBeNull()

    // FAULT. CONTROL first: an interrupted (durable) recording is a fault the Monitor recovers.
    const fault = { kind: 'CAPTURE_FAULT' as const, at: DEMO_NOW, fromState: 'RECORDING' as const }
    act(() => sim.store.setState({ session: { ...sim.store.getState().session!, state: 'FAULT', fault, captureDurable: true }, alerts: [...sim.store.getState().alerts, noCamera] }))
    await waitFor(() => expect(within(tile).getByTestId('session-incident-title')).toHaveTextContent('Session fault'))
    expect(within(tile).getByTestId('session-incident-body')).toHaveTextContent('A fault interrupted the session. Open the Session Monitor to recover it.')
    // The failed start: nothing was recorded, nothing to recover.
    setDurable(sim, false)
    await waitFor(() => expect(within(tile).getByTestId('session-incident-title')).toHaveTextContent('No camera connected'))
    expect(within(tile).getByTestId('session-incident-body')).toHaveTextContent('Nothing was recorded.')
    expect(within(tile).queryByText(/recover/i)).toBeNull()
    expect(within(tile).getByRole('button', { name: 'Open Session Monitor' })).toBeInTheDocument()
    expect(getMissingI18nKeys()).toEqual([])
  })

  it('alert centre: the failed start is worded from params.reason, the degraded warning names the camera', async () => {
    const sim = mount()
    await panel('a')
    act(() => sim.store.setState({ alerts: [...sim.store.getState().alerts, plainFault, cameraNotConnected, noCamera] }))
    fireEvent.click(screen.getByTestId('notifications-bell'))
    const list = await waitFor(() => {
      const found = document.querySelector('.dems-alert-list')
      expect(found).not.toBeNull()
      return found as HTMLElement
    })
    const lines = within(list).getAllByRole('listitem').map((item) => item.querySelector('.dems-alert-message')!)
    const byNotice = (kind: string) => lines.filter((line) => line.getAttribute('data-notice') === kind).map((line) => line.textContent)
    expect(byNotice('FAILED_START')).toEqual(['No camera connected. Nothing was recorded.'])
    // D60 (2026-11-04): the session-start unreachable body reworded — four tracks, so a lost camera is "one fewer", not "one only".
    expect(byNotice('UNREACHABLE')).toEqual(['Camera 2 (CAM-02) is not connected. The session is recording with one camera fewer. It did not connect in time.'])
    // CONTROL: a capture fault that names no cause, on a session that is not a failed start, keeps its own text.
    expect(lines.filter((line) => line.getAttribute('data-notice') === null).map((line) => line.textContent)).toContain('Capture fault')
    expect(getMissingI18nKeys()).toEqual([])
  })

  it('the rule (pure): "no camera" from the alert alone; the generic sentence only for an active alert of a failed start', () => {
    const t = ((key: string) => key) as unknown as Parameters<typeof failedStartAlertLine>[0]
    expect(failedStartAlertLine(t, noCamera, null)).toBe('common.captureNotice.noCamera.title. common.captureNotice.noCamera.body')
    expect(failedStartAlertLine(t, plainFault, 'OTHER')).toBe('common.session.failedStart.title. common.captureNotice.noCamera.body')
    expect(failedStartAlertLine(t, plainFault, null)).toBeNull()
    expect(failedStartAlertLine(t, { ...plainFault, active: false }, 'OTHER')).toBeNull()
    expect(failedStartAlertLine(t, cameraNotConnected, 'OTHER')).toBeNull()
  })
})
