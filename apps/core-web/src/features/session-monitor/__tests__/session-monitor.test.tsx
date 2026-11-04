// Step 44: Session Monitor render, End Session → SEALED (AC-63 unit form), actions, states and
// reduced motion. Every test builds the real router (guards, providers, shell) around its own
// simulator with in-memory storage (D54(a)) and a heartbeat socket that never connects, as the
// step-38 route tests do (implementation/19_app_shell.md §2).
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { QueryClient } from '@tanstack/react-query'
import { createMemoryHistory, RouterProvider } from '@tanstack/react-router'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { expectPressOutsideDismisses, pressOutside } from '@/test/press-outside'
import type { SocketLike } from '@dems/shared/realtime'
import {
  ALWAYS_VISIBLE,
  createManualClock,
  createMemoryAuthStorage,
  createSim,
  OPERATOR_IDS,
  type ControllableClock,
  type ScenarioName,
  type Sim,
  type SimScheduler,
} from '@dems/shared/sim'
import { getMissingI18nKeys, resetMissingI18nKeys } from '@/i18n'
import { createAppRouter } from '@/router'
import { selectBanner, selectFeed } from '../model'
import { audioPeakLevel, autosaveSegment, bytesAt } from '../sim-adapter'

// Full-router renders with a lazy route chunk: generous per-test time on a shared, busy host (P9/P11).
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

interface MountOptions {
  scenario?: ScenarioName
  operatorId?: string
  clock?: ControllableClock
  /** Default: a scheduler that never ticks (the tests drive state). */
  scheduler?: SimScheduler
}

const sims: Sim[] = []

function mountSession({ scenario = 'recording', operatorId = OPERATOR_IDS.BUDI, clock, scheduler }: MountOptions = {}) {
  const authStorage = createMemoryAuthStorage()
  authStorage.save({ operatorId, issuedAt: clock?.now() ?? Date.now() })
  const sim = createSim({
    scenario,
    storage: null,
    authStorage,
    visibility: ALWAYS_VISIBLE,
    scheduler: scheduler ?? (() => () => undefined),
    ...(clock ? { clock } : {}),
  })
  sims.push(sim)
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const router = createAppRouter(
    { sim, queryClient, socketFactory: () => new SilentSocket() },
    { history: createMemoryHistory({ initialEntries: ['/session'] }) },
  )
  render(<RouterProvider router={router} />)
  return { sim, router }
}

// jsdom implements neither media playback nor a 2D canvas, and has no scrolling.
const originalPlay = HTMLMediaElement.prototype.play
const originalPause = HTMLMediaElement.prototype.pause
const originalGetContext = HTMLCanvasElement.prototype.getContext
const originalMatchMedia = window.matchMedia

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
  window.matchMedia = originalMatchMedia
})

const PANELS = ['K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T'] as const

/** The route is a lazy chunk (autoCodeSplitting): the first load transforms it, so allow time. */
function findPage() {
  return screen.findByTestId('page-session-monitor', {}, { timeout: 15_000 })
}

describe('Session Monitor: recording scenario (row 44 render test)', () => {
  it('renders the page and panels K–T, the feed on the step-92 live loop and both MIC track labels', async () => {
    mountSession()
    const page = await findPage()
    expect(page).toHaveAttribute('data-phase', 'RECORDING')
    for (const id of PANELS) expect(within(page).getByTestId(`panel-${id}`)).toBeInTheDocument()

    // L: the step-92 recording-session loop (D50) through CameraFeed, with REC and the timer.
    const feed = within(screen.getByTestId('panel-L')).getAllByTestId('camera-feed')[0]
    expect(feed).toHaveAttribute('data-camera', 'VIDEO-01')
    expect(feed).toHaveAttribute('data-feed-mode', 'video')
    const video = within(feed).getByTestId('camera-feed-video')
    expect(video.getAttribute('src')).toMatch(/demo-media\/live\/VIDEO-01\.loop\.mp4$/)
    expect(within(feed).getByTestId('rec-indicator')).toHaveTextContent(/REC 00:18:4\d/)
    expect(within(feed).getByTestId('camera-feed-label')).toHaveTextContent('Camera 1 - Interview Room 1')

    // O: the audio track labels match the step-92/93 demo tracks.
    expect(screen.getByTestId('sm-track-label-AUDIO-01')).toHaveTextContent('MIC 1 – Interviewer')
    expect(screen.getByTestId('sm-track-label-AUDIO-02')).toHaveTextContent('MIC 2 – Subject')
    const meters = within(screen.getByTestId('panel-O')).getAllByRole('meter')
    expect(meters.map((meter) => meter.getAttribute('aria-label'))).toEqual(['MIC 1 – Interviewer', 'MIC 2 – Subject'])

    // K: SESSION ACTIVE & SECURE.
    const banner = screen.getByTestId('sm-status-banner')
    expect(banner).toHaveAttribute('data-kind', 'ACTIVE')
    expect(banner).toHaveTextContent('SESSION ACTIVE & SECURE')
    expect(banner).toHaveTextContent('Recording in progress • All integrity checks passing')

    // M: the canonical recording session (AC-74 unit form: same IDs as the sim).
    const details = screen.getByTestId('sm-details')
    expect(details).toHaveTextContent(/SES-\d{8}-0024/)
    expect(details).toHaveTextContent('AKP Budi Santoso')
    expect(details).toHaveTextContent('Tersangka')
    expect(details).toHaveTextContent('Ahmad Fauzi')
    expect(details).toHaveTextContent('Standard (1080p / 25 fps)')
    expect(screen.getByTestId('sm-duration')).toHaveTextContent(/00:18:4\d/)

    // N: four passing checks, UTC+07:00 time source.
    const checks = within(screen.getByTestId('sm-integrity-checks')).getAllByRole('listitem')
    expect(checks.map((check) => check.getAttribute('data-status'))).toEqual(['pass', 'pass', 'pass', 'pass'])
    expect(screen.getByTestId('sm-integrity-checks')).toHaveTextContent('GNSS (UTC+07:00)')

    // Q, S, T: timeline from the scenario, 20% USED ring, 12 audit rows.
    expect(within(screen.getByTestId('panel-Q')).getAllByRole('listitem').length).toBeGreaterThanOrEqual(5)
    expect(screen.getByTestId('sm-storage-ring')).toHaveTextContent('USED')
    expect(within(screen.getByTestId('sm-audit-list')).getAllByRole('listitem')).toHaveLength(12)

    // P: every session action is available while recording.
    expect(screen.getByTestId('sm-action-end')).not.toBeDisabled()
    expect(getMissingI18nKeys()).toEqual([])
  })

  it('switches the live feed to Camera 2 (the second step-92 loop)', async () => {
    const { sim } = mountSession()
    await findPage()
    fireEvent.click(screen.getByTestId('sm-camera-VIDEO-02'))
    expect(sim.store.getState().activeCameraId).toBe('VIDEO-02')
    const feed = within(screen.getByTestId('panel-L')).getAllByTestId('camera-feed')[0]
    expect(feed).toHaveAttribute('data-camera', 'VIDEO-02')
    // The switch cross-fades (M-C-12): the old loop leaves once its exit ends.
    await waitFor(() => expect(within(feed).getAllByTestId('camera-feed-video')).toHaveLength(1))
    expect(within(feed).getByTestId('camera-feed-video').getAttribute('src')).toMatch(/demo-media\/live\/VIDEO-02\.loop\.mp4$/)
    expect(within(feed).getByTestId('camera-feed-label')).toHaveTextContent('Camera 2 - Interview Room 1')
  })

  // Row 54 (P12-F08): the overlay's format chip is the slice's statement.
  it('row 54: the live overlay states the simulated format as before, and HEVC without a rate for an HEVC slice that states none', async () => {
    const { sim } = mountSession()
    await findPage()
    const feed = within(screen.getByTestId('panel-L')).getAllByTestId('camera-feed')[0]
    expect(within(feed).getByText('1080p • 25 fps • H.264')).toBeInTheDocument()
    act(() =>
      sim.store.setState((state) => ({
        cameras: state.cameras.map((camera) => ({ ...camera, fps: null, codec: 'HEVC' as const })),
      })),
    )
    await waitFor(() => expect(within(feed).getByText('1080p • HEVC')).toBeInTheDocument())
    expect(feed).not.toHaveTextContent(/fps|H\.264/)
    expect(getMissingI18nKeys()).toEqual([])
  })

  // Task 4 row 54 / integration pass I-3 (P12-F08): the Inputs panel keeps the format line of a slice that states no rate.
  it('I-3: the Inputs panel states the picture without a rate for a camera slice that states none, never nothing and never an empty rate', async () => {
    const { sim } = mountSession()
    await findPage()
    const inputs = screen.getByTestId('sm-inputs')
    const formats = (): (string | null)[] => [...inputs.querySelectorAll('[data-device^="VIDEO-"] .sm-input-meta')].map((line) => line.textContent)
    // CONTROL: the rate the slice states is printed as stated, one line per camera.
    // D60 (2026-11-04): one line per camera of the four-track Inputs panel.
    expect(formats()).toEqual(['1080p • 25 fps', '1080p • 25 fps', '1080p • 25 fps', '1080p • 25 fps'])
    act(() =>
      sim.store.setState((state) => ({
        cameras: state.cameras.map((camera) => ({ ...camera, resolution: '2160p', fps: null, codec: 'HEVC' as const })),
      })),
    )
    await waitFor(() => expect(formats()).toEqual(['2160p', '2160p', '2160p', '2160p'])) // D60
    expect(getMissingI18nKeys()).toEqual([])
  })
})

describe('Session Monitor: End Session → SEALED (AC-63 unit form, fake timers)', () => {
  it('ends the session with a reason and reaches SEALED within 10 s of simulator time', { timeout: 60_000 }, async () => {
    // A manual simulator clock at the step-92/93 --as-of (10:00 WIB), advanced by the engine's
    // 50 ms scheduler, which the fake timers drive once the page (a lazy route chunk) is mounted.
    const clock = createManualClock(Date.parse('2026-10-01T03:00:00.000Z'))
    let engineTick: (() => void) | null = null
    const scheduler: SimScheduler = (tick) => {
      engineTick = tick
      return () => {
        engineTick = null
      }
    }
    const { sim } = mountSession({ operatorId: OPERATOR_IDS.ANDI, clock, scheduler })
    await findPage()
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] })
    const engine = setInterval(() => {
      clock.advance(50)
      engineTick?.()
    }, 50)
    const flush = async (ms: number) => {
      await act(async () => {
        await vi.advanceTimersByTimeAsync(ms)
      })
    }
    await flush(200)
    expect(screen.getByTestId('page-session-monitor')).toHaveAttribute('data-phase', 'RECORDING')

    // Keyboard and assistive-tech activation opens the dialog directly (M-C-19).
    fireEvent.click(screen.getByTestId('sm-action-end'))
    await flush(50)
    const dialog = screen.getByTestId('sm-end-dialog')
    const reason = within(dialog).getByTestId('sm-end-reason')

    // The reason is mandatory (S21): 4 characters are refused inline, the session keeps recording.
    fireEvent.change(reason, { target: { value: 'done' } })
    fireEvent.click(within(dialog).getByTestId('sm-end-confirm'))
    await flush(50)
    expect(within(dialog).getByText('Enter a reason of at least 5 characters.')).toBeInTheDocument()
    expect(sim.store.getState().session?.state).toBe('RECORDING')

    fireEvent.change(reason, { target: { value: 'Interview completed' } })
    fireEvent.click(within(dialog).getByTestId('sm-end-confirm'))
    const stoppedAt = sim.store.getState().clock.now
    await flush(50)
    expect(sim.store.getState().session?.state).toBe('STOPPING')

    // The finalization overlay follows STOPPING → FINALIZING (6 steps) → SEALED.
    await flush(50)
    const overlay = screen.getByTestId('finalization-modal')
    expect(overlay).toHaveAttribute('data-mode', 'finalization')
    let sealedAt: number | null = null
    for (let elapsed = 0; elapsed <= 10_000 && sealedAt === null; elapsed += 250) {
      await flush(250)
      if (sim.store.getState().session?.state === 'SEALED') sealedAt = sim.store.getState().clock.now
    }
    expect(sealedAt).not.toBeNull()
    expect((sealedAt ?? Infinity) - stoppedAt).toBeLessThanOrEqual(10_000)

    const modal = screen.getByTestId('finalization-modal')
    expect(modal).toHaveAttribute('data-state', 'SEALED')
    expect(within(modal).getByTestId('stepper-stamp')).toHaveTextContent('SEALED')
    const steps = within(modal).getAllByRole('listitem')
    expect(steps).toHaveLength(6)
    expect(steps.every((step) => step.getAttribute('data-status') === 'done')).toBe(true)
    const evidenceId = sim.store.getState().session?.evidenceId ?? ''
    expect(evidenceId).toMatch(/^EV-\d{8}-0014$/)
    expect(within(modal).getByTestId('sm-final-sealed')).toHaveTextContent(`Evidence ${evidenceId} sealed`)
    expect(within(modal).getByTestId('sm-final-view-evidence')).toHaveAttribute('href', `/evidence/${evidenceId}`)
    expect(screen.getByTestId('sm-status-banner')).toHaveAttribute('data-kind', 'SEALED')

    // The step-93 package joins (same case, subject and session at --as-of) and shows its digest.
    await act(async () => {
      await vi.dynamicImportSettled()
    })
    await flush(10)
    expect(within(modal).getByTestId('sm-final-package')).toHaveAttribute('data-source', 'package')

    // Review 40 M5: the stop is attributed to the signed-in operator, not the session creator.
    const sessionId = sim.store.getState().session?.id
    const stopRow = sim.store.getState().audit.rows.findLast((row) => row.type === 'RECORDING_STOPPED' && row.sessionId === sessionId)
    expect(stopRow?.actorId).toBe(OPERATOR_IDS.ANDI)
    expect(sim.store.getState().audit.rows.some((row) => row.type === 'EVIDENCE_SEALED')).toBe(true)
    expect(getMissingI18nKeys()).toEqual([])
    clearInterval(engine)
  })

  it('opens the reason dialog only after a 1.5 s hold with the pointer (M-C-19)', { timeout: 20_000 }, async () => {
    mountSession()
    await findPage()
    const end = screen.getByTestId('sm-action-end')
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] })
    const flush = async (ms: number) => {
      await act(async () => {
        await vi.advanceTimersByTimeAsync(ms)
      })
    }

    // A short press is not enough: the fill springs back and the hint says to hold.
    fireEvent.pointerDown(end, { pointerId: 1, pointerType: 'mouse', button: 0, width: 1, height: 1, pressure: 0.5 })
    await flush(600)
    fireEvent.pointerUp(end, { pointerId: 1, pointerType: 'mouse', button: 0, width: 1, height: 1, pressure: 0.5 })
    // React Aria ends a pointer press on the click that follows pointerup (or its own click at 80 ms).
    await flush(120)
    expect(screen.queryByTestId('sm-end-dialog')).not.toBeInTheDocument()
    expect(end).toHaveTextContent('Hold to end the session')

    // A full hold opens the dialog.
    fireEvent.pointerDown(end, { pointerId: 2, pointerType: 'mouse', button: 0, width: 1, height: 1, pressure: 0.5 })
    await flush(1_600)
    expect(screen.getByTestId('sm-end-dialog')).toBeInTheDocument()
    fireEvent.pointerUp(end, { pointerId: 2, pointerType: 'mouse', button: 0, width: 1, height: 1, pressure: 0.5 })
  })
})

describe('Session Monitor: session actions', () => {
  // Fix wave J (JW-16; "by code only" in round one, proven here): the marker dialog had no Cancel (only the X),
  // and a press outside "End Session?" closed it and discarded the typed reason without a question.
  it('JW-16: the marker dialog has a Cancel that adds nothing; a press outside "End Session?" keeps the dialog and the typed reason; Escape closes it', async () => {
    await expectPressOutsideDismisses()
    const { sim } = mountSession()
    await findPage()
    const before = sim.store.getState().session?.timeline.length ?? 0

    fireEvent.click(screen.getByTestId('sm-action-marker'))
    fireEvent.change(await screen.findByTestId('sm-marker-input'), { target: { value: 'Typed and given up' } })
    fireEvent.click(screen.getByTestId('sm-marker-cancel'))
    await waitFor(() => expect(screen.queryByTestId('sm-marker-input')).not.toBeInTheDocument())
    expect(sim.store.getState().session?.timeline.length ?? 0).toBe(before)

    fireEvent.click(screen.getByTestId('sm-action-end'))
    const dialog = await screen.findByTestId('sm-end-dialog')
    fireEvent.change(within(dialog).getByTestId('sm-end-reason'), { target: { value: 'Interview finished for today' } })
    await pressOutside()
    await new Promise((resolve) => setTimeout(resolve, 100))
    expect(screen.getByTestId('sm-end-dialog')).toBeInTheDocument()
    expect((within(screen.getByTestId('sm-end-dialog')).getByTestId('sm-end-reason') as HTMLTextAreaElement).value).toBe('Interview finished for today')
    expect(sim.store.getState().session?.state).toBe('RECORDING')
    fireEvent.keyDown(screen.getByTestId('sm-end-dialog'), { key: 'Escape' })
    await waitFor(() => expect(screen.queryByTestId('sm-end-dialog')).not.toBeInTheDocument())
    expect(sim.store.getState().session?.state).toBe('RECORDING')
  })

  it('adds a marker, a note and a snapshot to the session timeline (M-C-17, M-C-18)', async () => {
    const { sim } = mountSession()
    await findPage()
    const before = sim.store.getState().session?.timeline.length ?? 0

    fireEvent.click(screen.getByTestId('sm-action-marker'))
    fireEvent.change(await screen.findByTestId('sm-marker-input'), { target: { value: 'Subject changes statement' } })
    fireEvent.click(screen.getByTestId('sm-marker-submit'))
    const marker = sim.store.getState().session?.timeline.at(-1)
    expect(marker?.kind).toBe('MARKER')
    expect(marker?.label).toBe('Subject changes statement')

    fireEvent.click(screen.getByTestId('sm-action-note'))
    const drawer = await screen.findByTestId('sm-note-drawer')
    fireEvent.click(within(drawer).getByTestId('sm-note-submit'))
    expect(within(drawer).getByText('Write a note first.')).toBeInTheDocument()
    fireEvent.change(within(drawer).getByTestId('sm-note-input'), { target: { value: 'Counsel present from 10:05' } })
    fireEvent.click(within(drawer).getByTestId('sm-note-submit'))
    expect(sim.store.getState().session?.notes.at(-1)?.text).toBe('Counsel present from 10:05')

    const snapshotsBefore = sim.store.getState().session?.snapshotCount ?? 0
    fireEvent.click(screen.getByTestId('sm-action-snapshot'))
    expect(sim.store.getState().session?.snapshotCount).toBe(snapshotsBefore + 1)
    // The badge pops with the new count (the previous one fades out, AnimatePresence).
    await waitFor(() => expect(screen.getAllByTestId('sm-queue-badge')).toHaveLength(1))
    expect(screen.getByTestId('sm-queue-badge')).toHaveTextContent(String(snapshotsBefore + 1))
    expect(screen.getByTestId('sm-shutter')).toBeInTheDocument()

    expect(sim.store.getState().session?.timeline.length).toBe(before + 3)
    expect(screen.getByTestId('sm-action-queue')).toHaveAttribute('href', '/evidence?status=RECORDED')
    expect(getMissingI18nKeys()).toEqual([])
  })

  it('pauses monitoring in the UI only: the feed and meters dim, REC and the recording continue (D28/Q8, M-C-20)', async () => {
    const { sim } = mountSession()
    await findPage()
    fireEvent.click(screen.getByTestId('sm-action-pause'))
    expect(screen.getByTestId('sm-action-pause')).toHaveAttribute('data-paused', 'true')
    expect(screen.getByTestId('sm-action-pause')).toHaveTextContent('Resume Monitoring')
    const feed = within(screen.getByTestId('panel-L')).getAllByTestId('camera-feed')[0]
    expect(within(feed).getByText('Monitoring paused. Recording continues.')).toBeInTheDocument()
    expect(within(feed).getByTestId('rec-indicator')).toBeInTheDocument()
    expect(sim.store.getState().session?.state).toBe('RECORDING')
  })

  it('gates End Session on SESSION_START until step 54 enforces it (review 40 M5/R4)', async () => {
    mountSession({ operatorId: OPERATOR_IDS.RINA }) // TECHNICIAN: no session start/stop
    await findPage()
    const end = screen.getByTestId('sm-action-end')
    expect(end).toBeDisabled()
    expect(end).toHaveAttribute('data-permitted', 'false')
    expect(end.getAttribute('aria-describedby')).toBe('sm-actions-not-permitted')
    expect(screen.getByText('Your role cannot end sessions.')).toBeInTheDocument()
  })
})

describe('Session Monitor: other states', () => {
  it('shows NO SESSION with the Start New Session invitation when idle', async () => {
    mountSession({ scenario: 'idle' })
    const page = await findPage()
    expect(page).toHaveAttribute('data-phase', 'IDLE')
    for (const id of PANELS) expect(within(page).getByTestId(`panel-${id}`)).toBeInTheDocument()
    expect(screen.getByTestId('sm-status-banner')).toHaveAttribute('data-kind', 'NO_SESSION')
    expect(screen.getByTestId('sm-banner-cta')).toHaveAttribute('href', '/session/new')
    const invitation = screen.getByTestId('sm-invitation')
    expect(invitation).toHaveTextContent('No active session')
    expect(within(invitation).getByTestId('sm-start-new-session')).toHaveAttribute('href', '/session/new')
    expect(within(invitation).getByRole('img', { name: /System ready/i })).toBeInTheDocument()
    expect(screen.getByTestId('sm-action-end')).toBeDisabled()
    expect(screen.getByTestId('sm-action-marker')).toBeDisabled()
    expect(within(screen.getByTestId('panel-Q')).getByText('The timeline starts when recording starts.')).toBeInTheDocument()
    expect(within(screen.getByTestId('panel-L')).getAllByTestId('camera-feed')[0]).toHaveAttribute('data-live', 'false')
    expect(getMissingI18nKeys()).toEqual([])
  })

  it('escalates the banner once on MIC 2 clip (ATTENTION) and on camera loss (FAULT, recording continues)', async () => {
    const { sim } = mountSession()
    await findPage()
    act(() => sim.actions.inject('MIC_CLIP', { channel: 'AUDIO-02' }))
    const banner = screen.getByTestId('sm-status-banner')
    expect(banner).toHaveAttribute('data-kind', 'ATTENTION')
    expect(banner).toHaveTextContent('Recording continues • Microphone clipping')
    act(() => sim.actions.inject('CAMERA_LOSS', { cameraId: 'VIDEO-01' }))
    expect(banner).toHaveAttribute('data-kind', 'FAULT')
    expect(banner).toHaveTextContent('Recording continues • Camera signal lost')
    expect(within(screen.getByTestId('panel-L')).getByTestId('camera-feed-no-signal')).toBeInTheDocument()
    expect(sim.store.getState().session?.state).toBe('RECORDING')
  })

  it('re-verifies the audit hash chain: PASS, then FAIL at the tampered row (M-C-21)', async () => {
    const { sim } = mountSession()
    await findPage()
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] })
    const flush = async (ms: number) => {
      await act(async () => {
        await vi.advanceTimersByTimeAsync(ms)
      })
    }
    fireEvent.click(screen.getByTestId('sm-reverify'))
    await flush(800)
    expect(screen.getByTestId('sm-chain-result')).toHaveAttribute('data-result', 'PASS')
    act(() => sim.actions.inject('AUDIT_TAMPER'))
    expect(within(screen.getByTestId('sm-integrity-checks')).getAllByRole('listitem')[1]).toHaveAttribute('data-status', 'fail')
    fireEvent.click(screen.getByTestId('sm-reverify'))
    await flush(800)
    expect(screen.getByTestId('sm-chain-result')).toHaveAttribute('data-result', 'FAIL')
  })

  it('under reduced motion marks the page reduced, keeps the meters and skips the title shimmer (§8)', async () => {
    window.matchMedia = ((query: string) => ({
      matches: query.includes('prefers-reduced-motion'),
      media: query,
      onchange: null,
      addListener: () => undefined,
      removeListener: () => undefined,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      dispatchEvent: () => false,
    })) as typeof window.matchMedia
    mountSession()
    const page = await findPage()
    expect(page).toHaveAttribute('data-motion', 'reduced')
    expect(within(screen.getByTestId('panel-O')).getAllByRole('meter')).toHaveLength(2)
    expect(screen.queryByTestId('sm-title-shimmer')).not.toBeInTheDocument()
    expect(screen.getByTestId('sm-status-banner').querySelector('[data-ambient]')).toHaveAttribute('data-motion', 'reduced')
  })
})

describe('Session Monitor: view models and simulator reads', () => {
  it('derives the banner from the session state and the worst alert', () => {
    const sim = createSim({ scenario: 'recording', storage: null, authStorage: null, scheduler: () => () => undefined })
    expect(selectBanner(sim.store.getState()).kind).toBe('ACTIVE')
    sim.actions.inject('GNSS_LOSS')
    expect(selectBanner(sim.store.getState())).toMatchObject({ kind: 'ATTENTION', whileRecording: true, reasonKind: 'GNSS_LOSS' })
    const idle = createSim({ scenario: 'idle', storage: null, authStorage: null, scheduler: () => () => undefined })
    expect(selectBanner(idle.store.getState()).kind).toBe('NO_SESSION')
    const finalizing = createSim({ scenario: 'finalizing', storage: null, authStorage: null, scheduler: () => () => undefined })
    expect(selectBanner(finalizing.store.getState())).toMatchObject({ kind: 'FINALIZING', total: 6 })
  })

  // Row 54 (P12-F08): the feed model repeats the camera slice; it holds no rate and no codec of its own.
  it('row 54: the feed states the slice\'s picture, rate and codec; a null rate stays null; no camera states nothing', () => {
    const sim = createSim({ scenario: 'recording', storage: null, authStorage: null, scheduler: () => () => undefined })
    expect(selectFeed(sim.store.getState())).toMatchObject({ resolution: '1080p', fps: 25, codec: 'H.264' })
    sim.store.setState((state) => ({
      cameras: state.cameras.map((camera) => ({ ...camera, fps: null, codec: 'HEVC' as const })),
    }))
    expect(selectFeed(sim.store.getState())).toMatchObject({ resolution: '1080p', fps: null, codec: 'HEVC' })
    sim.store.setState({ cameras: [] })
    expect(selectFeed(sim.store.getState())).toMatchObject({ resolution: null, fps: null, codec: null })
  })

  it('W44-2: reads peak levels and autosave sizes from the timeline params, with the label rule as fallback', () => {
    // Step 54: the simulator's params win over the EN label.
    expect(audioPeakLevel({ label: 'Audio peak -9.9 dBFS', params: { dbfs: -3.1, track: 'AUDIO-02' } })).toBe(-3.1)
    expect(autosaveSegment({ label: 'Autosave', params: { segment: 4, bytesWritten: 1_000 } })).toBe(4)
    expect(bytesAt({ at: 1_800_000, params: { segment: 4, bytesWritten: 1_000 } }, 0)).toBe(1_000)
    // Items from before step 54 (a restored snapshot) still parse.
    expect(audioPeakLevel({ label: 'Audio peak -3.1 dBFS' })).toBe(-3.1)
    expect(audioPeakLevel({ label: 'Health check OK' })).toBeNull()
    expect(autosaveSegment({ label: 'Autosave · segment 3' })).toBe(3)
    // 8.2 GB/h: 30 min into the recording, 4.1 GB were written.
    expect(bytesAt({ at: 1_800_000 }, 0)).toBe(4_100_000_000)
    expect(bytesAt({ at: 10 }, null)).toBeNull()
  })
})
