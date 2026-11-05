// Step 48: Devices & Inputs render (row 48: page and every §14.5.4 panel test ID in the idle
// scenario), the device drawer, calm fault states, kebab actions, reduced motion and the local
// simulator views (W48-1..5, in the simulator since step 54). The page tests build the real router (guards,
// providers, shell) around their own simulator with in-memory storage (D54(a)) and a heartbeat
// socket that never connects, as the step-38 route tests do (implementation/19_app_shell.md §2).
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { QueryClient } from '@tanstack/react-query'
import { createMemoryHistory, RouterProvider } from '@tanstack/react-router'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import type { SocketLike } from '@dems/shared/realtime'
import {
  ALWAYS_VISIBLE,
  createMemoryAuthStorage,
  createSim,
  OPERATOR_IDS,
  SimPermissionError,
  SimProvider,
  type AuditRow,
  type ScenarioName,
  type Sim,
} from '@dems/shared/sim'
import { getMissingI18nKeys, resetMissingI18nKeys } from '@/i18n'
import { createAppRouter } from '@/router'
import { createTestSim, withProviders } from '@/components/composed/__tests__/test-utils'
import { realCore } from '@/test/real-core-bed'
import { selectBanner, selectStatusMap, selectSummary } from '../model'
import { OtherDevices, tabletOfflineBodyKey } from '../other-devices'
import {
  auditRowDevice,
  bookPoe,
  deviceLog,
  frontPanelLeds,
  healthSeries,
  MicLevelSampler,
  REAR_PORT_ORDER,
  rearPorts,
} from '../sim-adapter'

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

function newSim(scenario: ScenarioName = 'idle', operatorId: string = OPERATOR_IDS.BUDI): Sim {
  const authStorage = createMemoryAuthStorage()
  authStorage.save({ operatorId, issuedAt: Date.now() })
  const sim = createSim({
    scenario,
    storage: null,
    authStorage,
    visibility: ALWAYS_VISIBLE,
    scheduler: () => () => undefined, // no engine ticks: the tests drive state directly
  })
  sims.push(sim)
  return sim
}

async function mountDevices(scenario: ScenarioName = 'idle', operatorId: string = OPERATOR_IDS.BUDI) {
  const sim = newSim(scenario, operatorId)
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const router = createAppRouter(
    { sim, queryClient, socketFactory: () => new SilentSocket() },
    { history: createMemoryHistory({ initialEntries: ['/devices'] }) },
  )
  render(<RouterProvider router={router} />)
  // The route chunk loads lazily (autoCodeSplitting); allow for a busy host (P9 parallel run).
  const page = await screen.findByTestId('page-devices', undefined, { timeout: 5000 })
  return { sim, router, page }
}

// jsdom implements neither media playback nor a 2D canvas, and has no scrolling.
const originalPlay = HTMLMediaElement.prototype.play
const originalPause = HTMLMediaElement.prototype.pause
const originalGetContext = HTMLCanvasElement.prototype.getContext

beforeAll(() => {
  HTMLCanvasElement.prototype.getContext = (() => null) as unknown as HTMLCanvasElement['getContext']
  Element.prototype.scrollTo ??= function scrollTo() {}
  window.scrollTo = (() => undefined) as typeof window.scrollTo
  // The kit Tabs indicator (React Aria SelectionIndicator) reads Web Animations, which jsdom lacks.
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
  HTMLMediaElement.prototype.play = vi.fn(() => Promise.resolve()) as unknown as HTMLMediaElement['play']
  HTMLMediaElement.prototype.pause = vi.fn() as unknown as HTMLMediaElement['pause']
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(JSON.stringify({ status: 'ok' }), { status: 200 })),
  )
})

afterEach(() => {
  cleanup()
  for (const sim of sims.splice(0)) sim.stop()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

/** The §14.5.4 regions as panel test IDs (plus the front panel of the brief). */
const PANELS = ['cameras', 'summary', 'audio', 'other', 'front', 'ports'] as const

describe('Devices & Inputs: idle scenario (row 48 render test)', () => {
  it('renders the page test ID and every §14.5.4 panel test ID, with 0 missing i18n keys', async () => {
    const { page } = await mountDevices()
    for (const id of PANELS) expect(within(page).getByTestId(`panel-${id}`)).toBeInTheDocument()

    // Camera Devices: both lenses of the dual-lens camera and the two further built-in cameras
    // (D60, 2026-11-04), live through CameraFeed — each on its own PoE port.
    for (const [cameraId, poeName] of [['VIDEO-01', 'PoE CAM 1'], ['VIDEO-02', 'PoE CAM 1'], ['VIDEO-03', 'PoE CAM 3'], ['VIDEO-04', 'PoE CAM 4']] as const) {
      const tile = screen.getByTestId(`camera-tile-${cameraId}`)
      expect(tile).toHaveAttribute('data-status', 'READY')
      const feed = within(tile).getByTestId('camera-feed')
      expect(feed).toHaveAttribute('data-camera', cameraId)
      expect(feed).toHaveAttribute('data-live', 'true')
      expect(within(tile).getByText('1080p • 25 fps • H.264')).toBeInTheDocument()
      expect(within(tile).getByText(poeName)).toBeInTheDocument()
    }

    // Audio Inputs: two large meters with read-only gain and phantom.
    for (const channel of ['AUDIO-01', 'AUDIO-02']) {
      const card = screen.getByTestId(`audio-input-${channel}`)
      expect(card).toHaveAttribute('data-status', 'READY')
      expect(within(card).getByTestId('dbfs-meter')).toHaveAttribute('data-variant', 'large')
      expect(within(card).getByText('32 dB')).toBeInTheDocument()
      expect(within(card).getByText('48 V ON')).toBeInTheDocument()
    }
    expect(within(screen.getByTestId('panel-audio')).getAllByRole('meter').map((m) => m.getAttribute('aria-label'))).toEqual([
      'MIC 1 - Interviewer (Ch 1)',
      'MIC 2 - Subject (Ch 2)',
      'MIC 3 - Channel 3 (Ch 3)', // D61 (2026-11-04): the four-channel microphone plane
      'MIC 4 - Channel 4 (Ch 4)', // D61
    ])

    // Summary metric cards and the banner (D60, 2026-11-04: four cameras, four PoE ports;
    // D61, 2026-11-04: four microphones and eleven rear ports - MIC_IN_3/MIC_IN_4 join the plane).
    expect(screen.getByTestId('summary-cameras')).toHaveAttribute('data-value', '4')
    expect(screen.getByTestId('summary-microphones')).toHaveAttribute('data-value', '4')
    expect(screen.getByTestId('summary-other')).toHaveAttribute('data-value', '5')
    expect(screen.getByTestId('summary-ports')).toHaveAttribute('data-value', '11')
    expect(screen.getByTestId('summary-ports')).toHaveAttribute('data-total', '11')
    const banner = screen.getByTestId('devices-banner')
    expect(banner).toHaveAttribute('data-kind', 'READY')
    expect(banner).toHaveTextContent('All devices ready 13/13')

    // Other Devices: PoE (book view, 3 active + 1 spare since D60), relay lamp, tablet, GNSS, TPM.
    expect(screen.getByTestId('other-POE-SWITCH')).toHaveTextContent('3 active · 1 spare')
    expect(screen.getByTestId('recording-lamp')).toHaveAttribute('data-lit', 'false')
    expect(screen.getByTestId('other-status-TABLET')).toHaveTextContent('CONNECTED')
    expect(screen.getByTestId('other-GNSS')).toHaveTextContent(/Locked · \d+ satellites/)
    expect(screen.getByTestId('other-status-TPM')).toHaveTextContent('OK')
    expect(screen.queryByTestId('tablet-offline-alert')).toBeNull()

    // Port map: the book's rear panel, left to right.
    for (const id of REAR_PORT_ORDER) expect(screen.getByTestId(`port-${id}`)).toBeInTheDocument()
    expect(screen.getByTestId('port-POE_CAM_2_AUX')).toHaveAttribute('data-link', 'spare')
    expect(screen.getByTestId('port-SERVICE_USB')).toHaveAttribute('data-link', 'disabled')

    // Front panel: the 800×480 LCD and five LEDs.
    expect(screen.getByTestId('front-lcd')).toHaveAttribute('viewBox', '0 0 800 480')
    expect(screen.getByTestId('led-POWER')).toHaveAttribute('data-state', 'on')
    expect(screen.getByTestId('led-RECORD')).toHaveAttribute('data-state', 'off')
    expect(screen.getByTestId('led-NETWORK')).toHaveAttribute('data-state', 'activity')
    expect(screen.getByTestId('led-STORAGE')).toHaveAttribute('data-state', 'on')
    expect(screen.getByTestId('led-FAULT')).toHaveAttribute('data-state', 'off')

    expect(getMissingI18nKeys()).toEqual([])
  })

  it('cycles the LCD pages with UP / DOWN and returns home with BACK', async () => {
    await mountDevices()
    const lcd = screen.getByTestId('front-lcd')
    expect(lcd).toHaveAttribute('data-page', 'status')
    fireEvent.click(screen.getByTestId('lcd-down'))
    await waitFor(() => expect(screen.getByTestId('front-lcd')).toHaveAttribute('data-page', 'network'))
    fireEvent.click(screen.getByTestId('lcd-down'))
    await waitFor(() => expect(screen.getByTestId('front-lcd')).toHaveAttribute('data-page', 'storage'))
    expect(screen.getByTestId('front-lcd')).toHaveTextContent('20% USED')
    expect(screen.getByTestId('front-lcd')).toHaveTextContent('3.2 TB FREE OF 4.0 TB')
    fireEvent.click(screen.getByTestId('lcd-up'))
    await waitFor(() => expect(screen.getByTestId('front-lcd')).toHaveAttribute('data-page', 'network'))
    fireEvent.click(screen.getByTestId('lcd-back'))
    await waitFor(() => expect(screen.getByTestId('front-lcd')).toHaveAttribute('data-page', 'status'))
    expect(getMissingI18nKeys()).toEqual([])
  })
})

describe('Device drawer (Overview, Health, Log)', () => {
  it('opens from a camera tile with the three tabs and switches to Health and Log', async () => {
    const { sim } = await mountDevices()
    act(() => sim.actions.deviceCommand('CAM-01', 'TEST_SIGNAL'))
    fireEvent.click(screen.getByRole('button', { name: 'Open details for Camera 1' }))
    const drawer = await screen.findByTestId('device-drawer')
    expect(drawer).toHaveAttribute('data-device', 'CAM-01')
    const tabs = within(drawer).getAllByRole('tab').map((tab) => tab.textContent)
    expect(tabs).toEqual(['Overview', 'Health', 'Log'])
    expect(within(drawer).getByTestId('device-overview')).toHaveTextContent('Dual-lens IP camera DL-2 (lens 1)')

    fireEvent.click(within(drawer).getByRole('tab', { name: 'Health' }))
    await waitFor(() => expect(within(drawer).getByTestId('device-health')).toHaveAttribute('data-metric', 'linkQuality'))

    fireEvent.click(within(drawer).getByRole('tab', { name: 'Log' }))
    const log = await within(drawer).findByTestId('device-log')
    expect(within(log).getByText('Device command sent')).toBeInTheDocument()
    expect(within(log).getByText('Test signal (simulated)')).toBeInTheDocument()
    expect(getMissingI18nKeys()).toEqual([])
  })

  // Task 4 row 54 / integration pass I-3 (P12-F08): the Overview's format fact of a slice that states no rate is its picture and codec.
  it('the camera Overview states picture and codec without a rate for a slice that states none, never "Not reported" and never an empty rate', async () => {
    const { sim } = await mountDevices()
    fireEvent.click(screen.getByRole('button', { name: 'Open details for Camera 1' }))
    const drawer = await screen.findByTestId('device-drawer')
    const formatFact = (): string | null | undefined =>
      [...within(drawer).getByTestId('device-overview').querySelectorAll('.dev-facts-row')].find((row) => row.querySelector('dt')?.textContent === 'Format')?.querySelector('dd')?.textContent
    // CONTROL: the rate the slice states is printed as stated.
    expect(formatFact()).toBe('1080p • 25 fps • H.264')
    act(() =>
      sim.store.setState((state) => ({
        cameras: state.cameras.map((camera) => (camera.id === 'VIDEO-01' ? { ...camera, resolution: '2160p', fps: null, codec: 'HEVC' as const } : camera)),
      })),
    )
    await waitFor(() => expect(formatFact()).toBe('2160p • HEVC'))
    expect(getMissingI18nKeys()).toEqual([])
  })

  it('opens the GNSS receiver from its Other Devices row', async () => {
    await mountDevices()
    fireEvent.click(screen.getByTestId('other-GNSS'))
    const drawer = await screen.findByTestId('device-drawer')
    expect(drawer).toHaveAttribute('data-device', 'GNSS')
    expect(within(drawer).getByTestId('device-overview')).toHaveTextContent('192.168.10.1')
  })
})

describe('Fault states render calmly (P7) and follow the simulator', () => {
  it('shows NO SIGNAL, a camera loss and the banner escalation without touching the other lens', async () => {
    const { sim } = await mountDevices()
    act(() => sim.actions.inject('MIC_NO_SIGNAL', { channel: 'AUDIO-01' }))
    await waitFor(() => expect(screen.getByTestId('audio-input-AUDIO-01')).toHaveAttribute('data-status', 'NO_SIGNAL'))
    expect(screen.getByTestId('audio-hint-AUDIO-01')).toHaveTextContent('No signal on MIC IN 1')
    expect(screen.getByTestId('devices-banner')).toHaveAttribute('data-kind', 'ATTENTION')
    expect(screen.getByTestId('devices-banner')).toHaveTextContent('1 device needs attention')
    expect(screen.getByTestId('port-MIC_IN_1')).toHaveAttribute('data-link', 'down')

    act(() => sim.actions.inject('CAMERA_LOSS', { cameraId: 'VIDEO-02' }))
    await waitFor(() => expect(screen.getByTestId('camera-tile-VIDEO-02')).toHaveAttribute('data-status', 'FAULT'))
    expect(within(screen.getByTestId('camera-tile-VIDEO-02')).getByTestId('camera-feed-no-signal')).toBeInTheDocument()
    expect(screen.getByTestId('camera-tile-VIDEO-01')).toHaveAttribute('data-status', 'READY')
    expect(screen.getByTestId('port-POE_CAM_1')).toHaveAttribute('data-link', 'up')
    expect(screen.getByTestId('devices-banner')).toHaveAttribute('data-kind', 'CRITICAL')
    expect(screen.getByTestId('devices-banner')).toHaveTextContent('2 devices need attention')
    expect(screen.getByTestId('led-FAULT')).toHaveAttribute('data-state', 'fault')
    expect(getMissingI18nKeys()).toEqual([])
  })

  it('latches CLIP and resets it from the card once the fault is cleared', async () => {
    const { sim } = await mountDevices()
    act(() => sim.actions.inject('MIC_CLIP', { channel: 'AUDIO-02' }))
    await waitFor(() => expect(screen.getByTestId('audio-input-AUDIO-02')).toHaveAttribute('data-status', 'CLIP'))
    act(() => sim.actions.clearFault('MIC_CLIP'))
    expect(screen.getByTestId('audio-input-AUDIO-02')).toHaveAttribute('data-status', 'CLIP') // latched until reset
    fireEvent.click(screen.getByTestId('clip-reset-AUDIO-02'))
    await waitFor(() => expect(screen.getByTestId('audio-input-AUDIO-02')).toHaveAttribute('data-status', 'READY'))
    expect(sim.store.getState().mics.find((mic) => mic.id === 'AUDIO-02')?.clipLatched).toBe(false)
  })

  // DF-22 / U-11 (register S10, S13): with nothing recording the Alert no longer claims "Recording continues on the Core".
  it('slides in the operator-device-offline Alert when the tablet goes OFFLINE (S9), with no recording claim while idle', async () => {
    const { sim } = await mountDevices()
    act(() => sim.actions.setTabletLink('OFFLINE'))
    const alert = await screen.findByTestId('tablet-offline-alert')
    expect(alert).toHaveTextContent('Operator device offline. Nothing is recording on the Core. Reconnect the device to regain control.')
    expect(alert).not.toHaveTextContent('Recording continues')
    expect(alert).toHaveAttribute('data-recording', 'false')
    expect(screen.getByTestId('other-status-TABLET')).toHaveTextContent('OFFLINE')
    expect(screen.getByTestId('led-NETWORK')).toHaveAttribute('data-state', 'warn')
    act(() => sim.actions.setTabletLink('CONNECTED'))
    await waitFor(() => expect(screen.queryByTestId('tablet-offline-alert')).toBeNull())
  })
})

describe('Recording scenario', () => {
  // DF-22 (register S13): the "Recording continues on the Core" body is shown only while a session is RECORDING.
  it('keeps the "recording continues" body on the operator-device-offline Alert while a session is RECORDING', async () => {
    const { sim } = await mountDevices('recording')
    act(() => sim.actions.setTabletLink('OFFLINE'))
    const alert = await screen.findByTestId('tablet-offline-alert')
    expect(alert).toHaveTextContent('Recording continues on the Core. Reconnect the device to regain control.')
    expect(alert).toHaveAttribute('data-recording', 'true')
  })

  it('lights the SEDANG MEREKAM lamp and the RECORD LED, and shows REC on both tracks', async () => {
    await mountDevices('recording')
    expect(screen.getByTestId('recording-lamp')).toHaveAttribute('data-lit', 'true')
    expect(screen.getByTestId('led-RECORD')).toHaveAttribute('data-state', 'rec')
    expect(screen.getByTestId('camera-rec-VIDEO-01')).toHaveTextContent('REC')
    expect(screen.getByTestId('camera-rec-VIDEO-02')).toHaveTextContent('REC')
    expect(screen.getByTestId('devices-banner')).toHaveAttribute('data-kind', 'RECORDING')
    expect(screen.getByTestId('front-lcd')).toHaveTextContent(/REC\s*00:18:4\d/)
    expect(getMissingI18nKeys()).toEqual([])
  })
})

// Row 54 (P12-F08): the tile states the camera slice's picture, rate and codec - no "H.264" and no 25 of its own.
describe('Camera tile: the format is the slice\'s statement', () => {
  it('states HEVC for an HEVC slice, with the rate the slice states and with no rate when it states none', async () => {
    const { sim } = await mountDevices()
    act(() =>
      sim.store.setState((state) => ({
        cameras: state.cameras.map((camera) =>
          camera.id === 'VIDEO-01'
            ? { ...camera, resolution: '1080p', fps: null, codec: 'HEVC' as const }
            : { ...camera, resolution: '2160p', fps: 30, codec: 'HEVC' as const },
        ),
      })),
    )

    // No rate stated: picture and codec only, on the line and on the picture's chip.
    const first = screen.getByTestId('camera-tile-VIDEO-01')
    await waitFor(() => expect(within(first).getByTestId('camera-format-VIDEO-01')).toHaveTextContent(/^Format\s*1080p • HEVC$/))
    expect(within(first).getByTestId('camera-feed')).toHaveTextContent('1080p')
    expect(first).not.toHaveTextContent(/fps|H\.264/)

    // A stated rate is printed as stated.
    const second = screen.getByTestId('camera-tile-VIDEO-02')
    expect(within(second).getByText('2160p • 30 fps • HEVC')).toBeInTheDocument()
    expect(within(second).getByText('2160p • 30 fps')).toBeInTheDocument()
    expect(second).not.toHaveTextContent(/H\.264|25 fps|1080p/)
    expect(getMissingI18nKeys()).toEqual([])
  })
})

describe('Kebab actions (simulated device commands; Identify audited since step 54)', () => {
  it('sends a test signal (audit DEVICE_COMMAND) and blinks Identify', async () => {
    const { sim } = await mountDevices()
    fireEvent.click(screen.getByTestId('device-menu-MIC-02'))
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Test signal (simulated)' }))
    await waitFor(() => {
      const rows = sim.store.getState().audit.rows.filter((row) => row.type === 'DEVICE_COMMAND')
      expect(rows.at(-1)).toMatchObject({ deviceId: 'MIC-02', details: { command: 'TEST_SIGNAL' } })
    })

    fireEvent.click(screen.getByTestId('device-menu-CAM-02'))
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Identify (blink)' }))
    expect(await screen.findByTestId('identify-CAM-02')).toBeInTheDocument()
  })

  it('keeps Restart unavailable without DEVICE_MANAGE (INVESTIGATOR) and allows it for a TECHNICIAN', async () => {
    await mountDevices('idle', OPERATOR_IDS.BUDI)
    fireEvent.click(screen.getByTestId('device-menu-CAM-01'))
    const restart = await screen.findByRole('menuitem', { name: /Restart \(simulated\)/ })
    expect(restart).toHaveAttribute('aria-disabled', 'true')
    expect(restart).toHaveTextContent('Requires the Technician role')
    cleanup()

    const { sim } = await mountDevices('idle', OPERATOR_IDS.RINA)
    fireEvent.click(screen.getByTestId('device-menu-CAM-01'))
    fireEvent.click(await screen.findByRole('menuitem', { name: /Restart \(simulated\)/ }))
    await waitFor(() =>
      expect(sim.store.getState().audit.rows.at(-1)).toMatchObject({ type: 'DEVICE_COMMAND', details: { command: 'RESTART' } }),
    )
  })
})

describe('Reduced motion (§8, AC-70)', () => {
  it('keeps the recording lamp steady: marked reduced and not looping', () => {
    const sim = createTestSim('recording')
    sims.push(sim)
    render(withProviders(<OtherDevices />, { sim, reduced: true }))
    const lamp = screen.getByTestId('recording-lamp')
    expect(lamp).toHaveAttribute('data-lit', 'true')
    expect(lamp).toHaveAttribute('data-motion', 'reduced')
    expect(lamp).toHaveAttribute('data-ambient', 'paused')
  })
})

describe('Simulator device views (W48-1..4, step 54)', () => {
  it('presents the book PoE view: PoE CAM 1 active while either lens streams, CAM 2/AUX spare', () => {
    const sim = newSim()
    // D60 (2026-11-04): four camera ports on the switch — CAM 1, CAM 3 and CAM 4 powered, CAM 2/AUX spare.
    expect(bookPoe(sim.store.getState())).toMatchObject({ cam1Link: true, active: 3, spare: 1, total: 4, drawW: 37.2 })
    sim.actions.inject('CAMERA_LOSS', { cameraId: 'VIDEO-02' })
    // D60: lens 2 shares PoE CAM 1 — its loss leaves the other three tracks powered.
    expect(bookPoe(sim.store.getState())).toMatchObject({ cam1Link: true, active: 3 })
    for (const cameraId of ['VIDEO-01', 'VIDEO-03', 'VIDEO-04'] as const) sim.actions.inject('CAMERA_LOSS', { cameraId })
    const poe = bookPoe(sim.store.getState())
    expect(poe).toMatchObject({ cam1Link: false, active: 0, spare: 1, drawW: 0 })
    const ports = rearPorts(sim.store.getState())
    expect(ports.map((port) => port.id)).toEqual(REAR_PORT_ORDER)
    expect(ports.find((port) => port.id === 'POE_CAM_1')?.link).toBe('down')
    expect(ports.find((port) => port.id === 'POE_CAM_2_AUX')?.link).toBe('spare')
    // D60 (2026-11-04): the two further camera ports go down with their cameras.
    expect(ports.find((port) => port.id === 'POE_CAM_3')?.link).toBe('down')
    expect(ports.find((port) => port.id === 'POE_CAM_4')?.link).toBe('down')
  })

  it('derives the five front-panel LEDs from the simulator state', () => {
    const idle = newSim()
    expect(frontPanelLeds(idle.store.getState())).toEqual({ POWER: 'on', RECORD: 'off', NETWORK: 'activity', STORAGE: 'on', FAULT: 'off' })
    idle.actions.inject('STORAGE_LOW')
    expect(frontPanelLeds(idle.store.getState())).toMatchObject({ STORAGE: 'warn', FAULT: 'warn' })
    idle.actions.inject('STORAGE_FULL')
    expect(frontPanelLeds(idle.store.getState())).toMatchObject({ STORAGE: 'fault', FAULT: 'fault' })
    const recording = newSim('recording')
    expect(frontPanelLeds(recording.store.getState()).RECORD).toBe('rec')
    recording.actions.inject('POWER_FAIL')
    expect(frontPanelLeds(recording.store.getState())).toMatchObject({ POWER: 'warn', RECORD: 'fault', FAULT: 'fault' })
  })

  it('builds health series from the simulator series and the page mic sampler', () => {
    const sim = newSim()
    const now = sim.store.getState().clock.now
    sim.store.setState((state) => ({
      network: {
        ...state.network,
        bandwidth: {
          ...state.network.bandwidth,
          history: Array.from({ length: 5 }, (_, i) => ({ at: now - (4 - i) * 1000, downMbps: 12.4, upMbps: 3.1 })),
        },
      },
    }))
    const camera = healthSeries(sim.store.getState(), 'CAM-01')
    expect(camera.metric).toBe('linkQuality')
    expect(camera.points).toHaveLength(5)
    expect(camera.points.every((point) => point.v >= 97 && point.v <= 100)).toBe(true)
    sim.actions.inject('CAMERA_LOSS', { cameraId: 'VIDEO-01' })
    const lost = healthSeries(sim.store.getState(), 'CAM-01')
    expect(lost.points.at(-1)?.v).toBeGreaterThanOrEqual(97) // points before the fault stay healthy
    expect(healthSeries(sim.store.getState(), 'TPM').points.every((point) => point.v === 100)).toBe(true)

    const sampler = new MicLevelSampler()
    sampler.push('AUDIO-01', { at: 1_000, dbfs: -30, noSignal: false })
    sampler.push('AUDIO-01', { at: 1_500, dbfs: -12, noSignal: false })
    sampler.push('AUDIO-01', { at: 2_050, dbfs: -40, noSignal: false })
    sampler.push('AUDIO-01', { at: 3_000, dbfs: -40, noSignal: true })
    expect(sampler.pointsOf('AUDIO-01')).toEqual([
      { t: 1_000, v: -12 },
      { t: 2_000, v: -40 },
    ])
    expect(healthSeries(sim.store.getState(), 'MIC-01', sampler.pointsOf('AUDIO-01')).domain).toEqual([-90, 0])
  })

  it('files audit rows under their device for the drawer Log', () => {
    const sim = newSim('recording')
    sim.actions.inject('GNSS_LOSS')
    sim.actions.setTabletLink('OFFLINE')
    // Step 54 (D79): RESTART needs DEVICE_MANAGE and is refused while recording; IDENTIFY is open to
    // any signed-in operator and is audited like the other device commands.
    expect(() => sim.actions.deviceCommand('POE-SWITCH', 'RESTART')).toThrow(SimPermissionError)
    sim.actions.deviceCommand('POE-SWITCH', 'IDENTIFY')
    const rows = sim.store.getState().audit.rows
    expect(deviceLog(rows, 'GNSS').map((row) => row.type)).toContain('FAULT_RAISED')
    expect(deviceLog(rows, 'TABLET').map((row) => row.type)).toContain('TABLET_LINK_CHANGED')
    expect(deviceLog(rows, 'POE-SWITCH').map((row) => row.type)).toEqual(['DEVICE_COMMAND'])
    expect(deviceLog(rows, 'REC-INDICATOR').map((row) => row.type)).toContain('RECORDING_STARTED')
    const boot = { deviceId: 'DEMS-IR-01', type: 'SYSTEM_BOOT', details: {} } as unknown as AuditRow
    expect(auditRowDevice(boot)).toBe('FRONT-PANEL')
  })

  // DF-22 (register S13): the banner condition - "recording" wording only while a session is RECORDING.
  it('picks the recording claim only while a session is RECORDING (banner condition)', () => {
    expect(tabletOfflineBodyKey(true)).toBe('devices.other.tabletOfflineBody')
    expect(tabletOfflineBodyKey(false)).toBe('devices.other.tabletOfflineIdleBody')
    const idle = newSim()
    idle.actions.setTabletLink('OFFLINE')
    expect(idle.store.getState().session?.state).not.toBe('RECORDING')
    expect(selectBanner(idle.store.getState()).kind).not.toBe('RECORDING')
    const recording = newSim('recording')
    expect(recording.store.getState().session?.state).toBe('RECORDING')
    expect(selectBanner(recording.store.getState()).kind).toBe('RECORDING')
  })

  // D60 (2026-11-04): the four built-in cameras join the tally; D61 (2026-11-04): and so do the
  // two further microphones - the banner counts thirteen.
  it('counts 13 devices and summarises faults for the banner and the metric cards', () => {
    const sim = newSim()
    expect(selectBanner(sim.store.getState())).toMatchObject({ kind: 'READY', ready: 13, total: 13, issues: 0 })
    sim.actions.inject('TPM_FAILURE')
    const state = sim.store.getState()
    expect(selectStatusMap(state).TPM).toBe('FAILED')
    expect(selectBanner(state)).toMatchObject({ kind: 'CRITICAL', worst: 'TPM', worstCode: 'FAILED', issues: 1 })
    expect(selectSummary(state)).toMatchObject({ otherOk: 4, otherTotal: 5, otherTone: 'danger' })
  })

  it('renders standalone without the router (SimProvider only)', () => {
    const sim = newSim('idle')
    render(
      <SimProvider sim={sim} autoStart={false}>
        <OtherDevices />
      </SimProvider>,
    )
    expect(screen.getByTestId('other-TPM')).toBeInTheDocument()
  })

  // Audit fix rows 104/107 (DF-21, U-10, register S7): on a Core in its own capture the PoE switch and the relay lamp have
  // no producer - "Not reported", no book view, no lamp; the operator-device row stays the Core's own link state.
  it('reads "Not reported" for the PoE switch and the relay lamp on a Core in its own capture (U-10)', () => {
    const sim = newSim('idle')
    realCore(sim)
    render(
      <SimProvider sim={sim} autoStart={false}>
        <OtherDevices />
      </SimProvider>,
    )
    for (const id of ['POE-SWITCH', 'REC-INDICATOR']) {
      expect(screen.getByTestId(`other-${id}`)).toHaveAttribute('data-reported', 'false')
      expect(screen.getByTestId(`other-status-${id}`)).toHaveTextContent('Not reported')
    }
    expect(screen.getByTestId('other-POE-SWITCH')).not.toHaveTextContent('active ·')
    expect(screen.queryByTestId('recording-lamp')).toBeNull()
    expect(screen.getByTestId('other-TABLET')).not.toHaveAttribute('data-reported')
  })
})
