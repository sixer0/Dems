// Task 3, blueprint row 139 (NEW SCOPE R-10): the session start with cameras not connected, on the
// web console (Session Monitor WB-01; masterplan/08_client_ux_spec.md §8e flow 11 situation C, §8
// step 5; masterplan/03_api_contract.md §3.1, §5.4; decisions D72(k), D84, D91 R-1 option A).
// Check M5-NODEV-C-W, client half, in Simulated client mode: the simulator never writes
// `captureDurable`, so each state is put on the store as the Core would send it.
//
// | Rule | Where it is proven here |
// |------|-------------------------|
// | Before the first durable fragment nothing is presented as recording: no REC, no timer, no live picture; End Session is disabled WITH its reason | "connecting cameras" |
// | A failed start says "Nothing was recorded." in full, offers no recovery of evidence and no evidence link, and points to Devices | "a failed start" |
// | One camera of two: a warning naming the missing camera by label and id; its tile reads NO SIGNAL; the timer runs | "one camera of two" |
// | The failed start is read from the session (`FAULT` + `captureDurable: false`), the cause from the alert's `params.reason` | "the rule" |
import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react'
import { QueryClient } from '@tanstack/react-query'
import { createMemoryHistory, RouterProvider } from '@tanstack/react-router'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { en } from '@dems/shared/i18n'
import type { SocketLike } from '@dems/shared/realtime'
import { ALWAYS_VISIBLE, createMemoryAuthStorage, createSim, OPERATOR_IDS, type ScenarioName, type Sim, type SimAlert } from '@dems/shared/sim'
import { getMissingI18nKeys, resetMissingI18nKeys } from '@/i18n'
import { camerasNotConnectedOf, captureFailedStartOf } from '@/lib/capture-notices'
import { createAppRouter } from '@/router'
import { selectBanner, selectFeed } from '../model'

vi.setConfig({ testTimeout: 30_000 })

const S = en.common.session
const N = en.common.captureNotice

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

function mount(operatorId: string, prepare: (sim: Sim) => void, scenario: ScenarioName = 'recording') {
  const authStorage = createMemoryAuthStorage()
  authStorage.save({ operatorId, issuedAt: Date.now() })
  const sim = createSim({ scenario, storage: null, authStorage, visibility: ALWAYS_VISIBLE, scheduler: () => () => undefined })
  sims.push(sim)
  prepare(sim)
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const router = createAppRouter({ sim, queryClient, socketFactory: () => new SilentSocket() }, { history: createMemoryHistory({ initialEntries: ['/session'] }) })
  render(<RouterProvider router={router} />)
  return sim
}

/** The session as the Core sends it in real capture: `captureDurable` beside the stored state. */
function setDurable(sim: Sim, captureDurable: boolean) {
  const session = sim.store.getState().session!
  sim.store.setState({ session: { ...session, captureDurable } })
}

/** A failed start as the Core's engine leaves it (`failedCaptureStartTransition`): FAULT, no start time, no byte. */
function failStart(sim: Sim, reason: string | null) {
  const state = sim.store.getState()
  const session = state.session!
  const fault: SimAlert = {
    id: 'ALR-000901',
    at: state.clock.now,
    severity: 'CRITICAL',
    kind: 'CAPTURE_FAULT',
    message: 'Capture fault',
    active: true,
    acknowledged: false,
    resolvedAt: null,
    target: null,
    params: reason === null ? { kind: 'CAPTURE_FAULT' } : { kind: 'CAPTURE_FAULT', reason, evidenceFiles: 0 },
  }
  sim.store.setState({
    session: { ...session, state: 'FAULT', fault: { kind: 'CAPTURE_FAULT', at: state.clock.now, fromState: 'RECORDING' }, startedAt: null, bytesWritten: 0, captureDurable: false },
    alerts: [...state.alerts, fault],
  })
}

/** The degraded warning of a session start, as `raiseCaptureNoticeTransition` writes it. */
const notConnected = (deviceId: string, at: number): SimAlert => ({
  id: 'ALR-000902',
  at,
  severity: 'WARNING',
  kind: 'SYSTEM',
  message: `${deviceId} is not connected`,
  active: true,
  acknowledged: false,
  resolvedAt: null,
  target: deviceId,
  params: { reason: 'CAPTURE_DEVICE_UNREACHABLE', deviceId, deviceKind: 'CAMERA', phase: 'SESSION_START', cause: 'NOT_CONNECTED' },
})

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

describe('the rule: a failed start is read from the session, its cause from the alert', () => {
  const fault = (reason?: string, active = true): Pick<SimAlert, 'kind' | 'active' | 'params'>[] => [{ kind: 'CAPTURE_FAULT', active, params: reason === undefined ? {} : { reason } }]

  it('FAULT with an explicit `captureDurable: false` only; "no camera" only when the Core says so', () => {
    expect(captureFailedStartOf({ state: 'FAULT', captureDurable: false }, fault('NO_CAMERA_CONNECTED'))).toBe('NO_CAMERA_CONNECTED')
    expect(captureFailedStartOf({ state: 'FAULT', captureDurable: false }, fault())).toBe('OTHER')
    expect(captureFailedStartOf({ state: 'FAULT', captureDurable: false }, [])).toBe('OTHER')
    // A resolved alert names nothing any more.
    expect(captureFailedStartOf({ state: 'FAULT', captureDurable: false }, fault('NO_CAMERA_CONNECTED', false))).toBe('OTHER')
    // CONTROLS: an interrupted recording (durable), a session without the member (the simulator), any other state.
    expect(captureFailedStartOf({ state: 'FAULT', captureDurable: true }, fault('NO_CAMERA_CONNECTED'))).toBeNull()
    expect(captureFailedStartOf({ state: 'FAULT' }, fault('NO_CAMERA_CONNECTED'))).toBeNull()
    expect(captureFailedStartOf({ state: 'RECORDING', captureDurable: false }, fault('NO_CAMERA_CONNECTED'))).toBeNull()
    expect(captureFailedStartOf(null, fault('NO_CAMERA_CONNECTED'))).toBeNull()
  })

  it('the cameras a session start names: active SESSION_START notices of cameras only', () => {
    const at = Date.UTC(2026, 9, 1)
    expect(camerasNotConnectedOf([notConnected('CAM-02', at)])).toEqual(['CAM-02'])
    expect(camerasNotConnectedOf([{ ...notConnected('CAM-02', at), active: false }])).toEqual([])
    expect(camerasNotConnectedOf([{ ...notConnected('CAM-02', at), params: { ...notConnected('CAM-02', at).params, phase: 'PRECHECK' } }])).toEqual([])
  })
})

describe('connecting cameras: between the accepted start and the first durable fragment (D84)', () => {
  it('nothing is presented as recording and End Session is disabled with its reason; the first durable fragment brings both back', async () => {
    const sim = mount(OPERATOR_IDS.BUDI, (created) => setDurable(created, false))
    expect(await banner()).toHaveAttribute('data-kind', 'CONNECTING')

    // NEGATIVE CONTROL of "recording": no REC indicator, no timer, no live picture, no "Recording in progress".
    expect(screen.queryByTestId('rec-indicator')).not.toBeInTheDocument()
    expect(screen.queryByTestId('rec-timer')).not.toBeInTheDocument()
    expect(screen.getByTestId('sm-status-banner')).not.toHaveTextContent(en.session.banner.ACTIVE.detail)
    expect(selectFeed(sim.store.getState())).toMatchObject({ recording: false, connecting: true })
    const invitation = screen.getByTestId('sm-invitation')
    expect(invitation).toHaveAttribute('data-connecting', 'true')
    expect(invitation).toHaveTextContent(S.connectingCameras)
    // Nothing to start, nothing to recover, no evidence to open while the cameras connect.
    expect(within(invitation).queryByRole('link')).not.toBeInTheDocument()
    expect(within(invitation).queryByRole('button')).not.toBeInTheDocument()

    // End Session: disabled, and it says why (the Core would answer 409 CAPTURE_NOT_DURABLE).
    const end = screen.getByTestId('sm-action-end')
    expect(end).toBeDisabled()
    expect(end).toHaveAttribute('data-connecting', 'true')
    expect(end).toHaveAttribute('aria-describedby', 'sm-actions-connecting')
    expect(document.getElementById('sm-actions-connecting')).toHaveTextContent(S.stopWhileConnecting)
    expect(end.closest('.sm-action-unavailable')).toHaveAttribute('title', S.stopWhileConnecting)

    await act(async () => setDurable(sim, true))
    await waitFor(() => expect(screen.getByTestId('sm-status-banner')).toHaveAttribute('data-kind', 'ACTIVE'))
    // The same reads that were absent above are present now: the control can fail.
    expect(screen.getAllByTestId('rec-indicator').length).toBeGreaterThan(0)
    expect(selectFeed(sim.store.getState())).toMatchObject({ recording: true, connecting: false })
    await waitFor(() => expect(screen.queryByTestId('sm-invitation')).not.toBeInTheDocument())
    expect(screen.getByTestId('sm-action-end')).not.toBeDisabled()
    expect(screen.getByTestId('sm-action-end')).not.toHaveAttribute('data-connecting')
    expect(document.getElementById('sm-actions-connecting')).toBeNull()
    expect(getMissingI18nKeys()).toEqual([])
  })

  it('an operator who may not end a session is told the role, not the cameras', async () => {
    mount(OPERATOR_IDS.RINA, (created) => setDurable(created, false))
    await banner()
    const end = screen.getByTestId('sm-action-end')
    expect(end).toBeDisabled()
    expect(end).not.toHaveAttribute('data-connecting')
    expect(end).toHaveAttribute('aria-describedby', 'sm-actions-not-permitted')
  })
})

describe('a failed start: no camera connected (situation C, CRITICAL)', () => {
  it('"No camera connected. Nothing was recorded." as an alert; no timer, no REC; the session is closed, not recovered; the pointer is Devices', async () => {
    const sim = mount(OPERATOR_IDS.BUDI, (created) => failStart(created, 'NO_CAMERA_CONNECTED'))
    const shown = await banner()
    expect(shown).toHaveAttribute('data-kind', 'FAULT')
    expect(shown).toHaveAttribute('data-failed-start', 'NO_CAMERA_CONNECTED')
    // ux §8e.6: the CRITICAL fault is announced assertively.
    expect(shown).toHaveAttribute('role', 'alert')
    expect(within(shown).getByTestId('sm-banner-detail')).toHaveTextContent(`${N.noCamera.title}. ${N.noCamera.body}`)
    expect(within(shown).getByTestId('sm-banner-cta')).toHaveTextContent(S.failedStart.close)
    expect(shown).not.toHaveTextContent(en.session.banner.cta.recover)
    expect(selectBanner(sim.store.getState()).failedStart).toBe('NO_CAMERA_CONNECTED')

    // What situation C must not draw.
    expect(screen.queryByTestId('rec-indicator')).not.toBeInTheDocument()
    expect(screen.queryByTestId('rec-timer')).not.toBeInTheDocument()
    expect(selectFeed(sim.store.getState()).recording).toBe(false)

    const invitation = screen.getByTestId('sm-invitation')
    expect(invitation).toHaveAttribute('data-failed-start', 'NO_CAMERA_CONNECTED')
    expect(invitation).toHaveTextContent(N.noCamera.title)
    expect(invitation).toHaveTextContent(N.noCamera.body)
    // No wording that suggests evidence exists: not "interrupted", not "keep the recorded part", no evidence link.
    expect(invitation).not.toHaveTextContent(en.session.idle.faultTitle)
    expect(invitation).not.toHaveTextContent(en.session.idle.faultBody)
    expect(within(invitation).queryByText(en.common.actions.openEvidenceQueue)).not.toBeInTheDocument()
    const devices = within(invitation).getByTestId('sm-failed-start-devices')
    expect(devices).toHaveAttribute('href', '/devices')
    expect(devices).toHaveTextContent(S.failedStart.openDevices)
    expect(getMissingI18nKeys()).toEqual([])
  })

  it('a failed start the Core gives no camera reason for still says that nothing was recorded', async () => {
    mount(OPERATOR_IDS.BUDI, (created) => failStart(created, null))
    const shown = await banner()
    expect(shown).toHaveAttribute('data-failed-start', 'OTHER')
    expect(within(shown).getByTestId('sm-banner-detail')).toHaveTextContent(`${S.failedStart.title}. ${N.noCamera.body}`)
    expect(shown).not.toHaveTextContent(N.noCamera.title)
  })

  it('CONTROL: an interrupted recording (durable) keeps the fault presentation and its recovery', async () => {
    const sim = mount(OPERATOR_IDS.BUDI, (created) => {
      failStart(created, 'NO_CAMERA_CONNECTED')
      const session = created.store.getState().session!
      created.store.setState({ session: { ...session, captureDurable: true, startedAt: created.store.getState().clock.now - 60_000 } })
    })
    const shown = await banner()
    expect(shown).toHaveAttribute('data-kind', 'FAULT')
    expect(shown).not.toHaveAttribute('data-failed-start')
    expect(shown).toHaveAttribute('role', 'status')
    expect(shown).not.toHaveTextContent(N.noCamera.body)
    expect(within(shown).getByTestId('sm-banner-cta')).toHaveTextContent(en.session.banner.cta.recover)
    expect(screen.getByTestId('sm-invitation')).toHaveTextContent(en.session.idle.faultTitle)
    expect(screen.queryByTestId('sm-failed-start-devices')).not.toBeInTheDocument()
    expect(selectBanner(sim.store.getState()).failedStart).toBeNull()
  })
})

describe('one camera of two: a degraded session (WARNING)', () => {
  it('the banner names the missing camera by label and id; its tile reads NO SIGNAL; the recording runs', async () => {
    const sim = mount(OPERATOR_IDS.BUDI, (created) => {
      setDurable(created, true)
      const state = created.store.getState()
      created.store.setState({ alerts: [...state.alerts, notConnected('CAM-02', state.clock.now)] })
    })
    const shown = await banner()
    expect(shown).toHaveAttribute('data-kind', 'ATTENTION')
    expect(shown).toHaveAttribute('role', 'status')
    const detail = within(shown).getByTestId('sm-banner-detail')
    expect(detail).toHaveTextContent('Camera 2 (CAM-02) is not connected')
    expect(detail).toHaveTextContent(N.unreachable.sessionStart.body)
    // The recording timer and the other tile run normally.
    expect(selectFeed(sim.store.getState())).toMatchObject({ activeCameraId: 'VIDEO-01', recording: true, noSignal: false })
    expect(screen.getAllByTestId('rec-indicator').length).toBeGreaterThan(0)

    // The camera the Core named is NO SIGNAL when it is the one on screen.
    await act(async () => sim.store.setState({ activeCameraId: 'VIDEO-02' }))
    expect(selectFeed(sim.store.getState())).toMatchObject({ activeCameraId: 'VIDEO-02', noSignal: true })
    await waitFor(() => expect(screen.getAllByTestId('camera-feed-no-signal').length).toBeGreaterThan(0))

    // CONTROL: cleared by the Core only - when the alert is resolved the tile and the banner follow.
    await act(async () => sim.store.setState({ alerts: sim.store.getState().alerts.map((alert) => (alert.id === 'ALR-000902' ? { ...alert, active: false } : alert)) }))
    expect(selectFeed(sim.store.getState()).noSignal).toBe(false)
    await waitFor(() => expect(screen.getByTestId('sm-status-banner')).toHaveAttribute('data-kind', 'ACTIVE'))
    expect(getMissingI18nKeys()).toEqual([])
  })
})
