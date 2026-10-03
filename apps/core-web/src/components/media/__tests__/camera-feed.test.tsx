// Step 39: CameraFeed plays the step-92 demo videos and falls back to the procedural canvas
// (01_specs §14.10 as amended by D50; 03_motion_spec M-C-12, M-C-05, §8, R10).
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { CameraFeed } from '../camera-feed'
import { backingSize, kenBurnsScale, osdLabel, osdTimestamp, scanlineTop } from '../camera-feed.math'
import {
  demoMediaPaths,
  evidenceMedia,
  evidenceMediaSuffixes,
  evidenceSuffixOf,
  excerptPositionSec,
  liveAudio,
  liveVideo,
} from '../demo-media'
import { activeFeedPainters } from '../feed-scheduler'
import { OnScreenObserver, createTestSim, withProviders } from '@/components/composed/__tests__/test-utils'

// jsdom implements neither media playback nor a 2D canvas: stub both, and record paints.
const originalPlay = HTMLMediaElement.prototype.play
const originalPause = HTMLMediaElement.prototype.pause
const originalGetContext = HTMLCanvasElement.prototype.getContext
const originalObserver = (globalThis as unknown as Record<string, unknown>).IntersectionObserver
let play: ReturnType<typeof vi.fn>
let pause: ReturnType<typeof vi.fn>
const drawCalls: string[] = []

function fakeContext(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const gradient = { addColorStop: () => undefined }
  const target: Record<string, unknown> = {
    canvas,
    createLinearGradient: () => gradient,
    createRadialGradient: () => gradient,
    createPattern: () => ({}),
    createImageData: (w: number, h: number) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }),
    measureText: () => ({ width: 10 }),
  }
  return new Proxy(target, {
    get(obj, key: string) {
      if (key in obj) return obj[key]
      return (...args: unknown[]) => {
        drawCalls.push(key)
        void args
      }
    },
    set(obj, key: string, value) {
      obj[key] = value
      return true
    },
  }) as unknown as CanvasRenderingContext2D
}

beforeAll(() => {
  ;(globalThis as unknown as Record<string, unknown>).IntersectionObserver = OnScreenObserver
  HTMLCanvasElement.prototype.getContext = function getContext(this: HTMLCanvasElement) {
    return fakeContext(this)
  } as unknown as typeof originalGetContext
})

afterAll(() => {
  ;(globalThis as unknown as Record<string, unknown>).IntersectionObserver = originalObserver
  HTMLCanvasElement.prototype.getContext = originalGetContext
  HTMLMediaElement.prototype.play = originalPlay
  HTMLMediaElement.prototype.pause = originalPause
})

beforeEach(() => {
  play = vi.fn(() => Promise.resolve())
  pause = vi.fn()
  HTMLMediaElement.prototype.play = play as unknown as HTMLMediaElement['play']
  HTMLMediaElement.prototype.pause = pause as unknown as HTMLMediaElement['pause']
  drawCalls.length = 0
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe('demo media resolver (D50, D61; implementation/64 §5)', () => {
  it('resolves the live loops, posters and MIC loops of the recording scenario', () => {
    for (const camera of ['VIDEO-01', 'VIDEO-02'] as const) {
      const media = liveVideo(camera)
      expect(media?.src).toMatch(new RegExp(`demo-media/live/${camera}\\.loop\\.mp4$`))
      expect(media?.poster).toMatch(new RegExp(`demo-media/live/${camera}\\.poster\\.jpg$`))
      expect(media?.thumb).toMatch(new RegExp(`demo-media/live/${camera}\\.thumb\\.jpg$`))
    }
    expect(liveAudio('AUDIO-02')).toMatch(/demo-media\/live\/AUDIO-02\.loop\.m4a$/)
  })

  it('joins evidence media by the evidence number and returns null without media', () => {
    expect(evidenceSuffixOf('EV-20260929-0001')).toBe('0001')
    expect(evidenceSuffixOf('0013')).toBe('0013')
    expect(evidenceSuffixOf('SES-20261001-0024')).toBeNull()
    expect(evidenceMediaSuffixes()).toEqual(
      ['0001', '0002', '0003', '0004', '0005', '0006', '0007', '0008', '0009', '0010', '0011', '0012', '0013'],
    )
    const ev = evidenceMedia('EV-20261001-0007')
    expect(ev?.video['VIDEO-02'].src).toMatch(/demo-media\/evidence\/0007\/VIDEO-02\.mp4$/)
    expect(ev?.audio['AUDIO-01']).toMatch(/demo-media\/evidence\/0007\/AUDIO-01\.m4a$/)
    expect(evidenceMedia('EV-20261001-0014')).toBeNull()
    expect(demoMediaPaths().some((path) => path.startsWith('mobile/'))).toBe(false)
  })

  it('maps a full-recording position into the excerpt (p mod L)', () => {
    expect(excerptPositionSec(95, 40)).toBe(15)
    expect(excerptPositionSec(-5, 40)).toBe(35)
    expect(excerptPositionSec(10, 0)).toBe(0)
  })
})

describe('procedural feed maths (M-C-12)', () => {
  it('pushes in 1.00 → 1.06 over 30 s and back, with the Cam 2 phase offset', () => {
    expect(kenBurnsScale(0)).toBeCloseTo(1)
    expect(kenBurnsScale(30_000)).toBeCloseTo(1.06)
    expect(kenBurnsScale(60_000)).toBeCloseTo(1)
    expect(kenBurnsScale(11_000, 11_000)).toBeCloseTo(1)
  })

  it('sweeps the scanline for 1.2 s of every 6 s', () => {
    expect(scanlineTop(0)).toBeCloseTo(-0.14)
    expect(scanlineTop(1_199)).toBeGreaterThan(0.9)
    expect(scanlineTop(1_200)).toBeNull()
    expect(scanlineTop(6_600)).not.toBeNull()
  })

  it('burns in a UTC+07:00 timestamp and a DEMO label', () => {
    expect(osdTimestamp(Date.UTC(2026, 9, 1, 3, 0, 0))).toBe('2026-10-01  10:00:00  UTC+07:00')
    expect(osdLabel('VIDEO-02')).toBe('CAM-02 | VIDEO-02 | LIVE | DEMO')
    expect(backingSize(640, 360, 2)).toEqual({ width: 1280, height: 720 })
    expect(backingSize(1920, 1080, 2)).toEqual({ width: 1280, height: 720 })
  })
})

describe('CameraFeed', () => {
  it('plays the live-loop video, muted and looped, when it is available (D50)', async () => {
    render(withProviders(<CameraFeed cameraId="VIDEO-01" label="Camera 1 - Interview Room 1" formatLabel="1080p • 25 fps • H.264" />))
    const root = screen.getByTestId('camera-feed')
    expect(root).toHaveAttribute('data-feed-mode', 'video')
    expect(root).toHaveAttribute('data-feed-fallback', 'none')
    const video = screen.getByTestId('camera-feed-video') as HTMLVideoElement
    expect(video.getAttribute('src')).toMatch(/demo-media\/live\/VIDEO-01\.loop\.mp4$/)
    expect(video.getAttribute('poster')).toMatch(/demo-media\/live\/VIDEO-01\.poster\.jpg$/)
    expect(video.muted).toBe(true)
    expect(video.loop).toBe(true)
    expect(video).toHaveAttribute('playsinline')
    await waitFor(() => expect(play).toHaveBeenCalled())
    expect(screen.queryByTestId('camera-feed-canvas')).toBeNull()
    expect(screen.getByRole('img', { name: 'Camera 1 · LIVE SESSION FEED' })).toBeInTheDocument()
    expect(screen.getByText('Camera 1 - Interview Room 1')).toBeInTheDocument()
    expect(screen.getByText('1080p • 25 fps • H.264')).toBeInTheDocument()
  })

  it('switches to the procedural canvas after a media error (D50 fallback)', async () => {
    const modes: string[] = []
    render(withProviders(<CameraFeed cameraId="VIDEO-02" onModeChange={(mode, reason) => modes.push(`${mode}:${reason}`)} />))
    const video = screen.getByTestId('camera-feed-video')
    fireEvent.error(video)
    await waitFor(() => expect(screen.getByTestId('camera-feed')).toHaveAttribute('data-feed-mode', 'procedural'))
    expect(screen.getByTestId('camera-feed')).toHaveAttribute('data-feed-fallback', 'error')
    await waitFor(() => expect(screen.getByTestId('camera-feed-canvas')).toBeInTheDocument())
    expect(modes).toEqual(['video:none', 'procedural:error'])
    // The shared scheduler paints the canvas (gradient room until the still decodes).
    await waitFor(() => expect(drawCalls).toContain('fillRect'))
    expect(activeFeedPainters()).toBeGreaterThan(0)
  })

  it('falls back when autoplay is refused', async () => {
    play.mockImplementation(() => Promise.reject(new DOMException('blocked', 'NotAllowedError')))
    render(withProviders(<CameraFeed cameraId="VIDEO-01" />))
    await waitFor(() => expect(screen.getByTestId('camera-feed')).toHaveAttribute('data-feed-fallback', 'autoplay'))
    expect(screen.getByTestId('camera-feed-canvas')).toBeInTheDocument()
  })

  it('ignores an interrupted play() (AbortError) and falls back when no frame arrives in time', async () => {
    vi.useFakeTimers()
    play.mockImplementation(() => Promise.reject(new DOMException('interrupted', 'AbortError')))
    render(withProviders(<CameraFeed cameraId="VIDEO-01" loadTimeoutMs={3000} />))
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2900)
    })
    expect(screen.getByTestId('camera-feed')).toHaveAttribute('data-feed-mode', 'video')
    await act(async () => {
      await vi.advanceTimersByTimeAsync(200)
    })
    expect(screen.getByTestId('camera-feed')).toHaveAttribute('data-feed-fallback', 'timeout')
  })

  it('renders the procedural feed directly for `src={null}` and a fresh try for a new source', async () => {
    const { rerender } = render(withProviders(<CameraFeed cameraId="VIDEO-01" src={null} />))
    expect(screen.getByTestId('camera-feed')).toHaveAttribute('data-feed-fallback', 'no-source')
    rerender(withProviders(<CameraFeed cameraId="VIDEO-01" src="/clip.mp4" />))
    expect(screen.getByTestId('camera-feed')).toHaveAttribute('data-feed-mode', 'video')
  })

  it('shows the poster without decoding when `live={false}` (thumbnail budget)', async () => {
    render(withProviders(<CameraFeed cameraId="VIDEO-02" variant="thumb" live={false} />))
    const video = screen.getByTestId('camera-feed-video')
    expect(video.getAttribute('poster')).toMatch(/demo-media\/live\/VIDEO-02\.thumb\.jpg$/)
    expect(screen.getByTestId('camera-feed')).toHaveAttribute('data-live', 'false')
    await waitFor(() => expect(pause).toHaveBeenCalled())
    expect(play).not.toHaveBeenCalled()
  })

  it('overlays REC with the simulator timer and NO SIGNAL', () => {
    const sim = createTestSim()
    // The timer reads the simulator clock at whole-second resolution (1 Hz).
    const nowSecond = Math.floor(sim.store.getState().clock.now / 1000) * 1000
    render(withProviders(<CameraFeed cameraId="VIDEO-01" recordingSince={nowSecond - 1_122_000} noSignal />, { sim }))
    expect(screen.getByTestId('rec-indicator')).toBeInTheDocument()
    expect(screen.getByText('REC 00:18:42')).toHaveClass('sr-only')
    expect(screen.getByTestId('camera-feed-no-signal')).toHaveTextContent('NO SIGNAL')
    // A camera without signal does not decode video.
    expect(play).not.toHaveBeenCalled()
  })

  it('pauses the video and marks itself reduced under reduced motion (§8)', async () => {
    render(withProviders(<CameraFeed cameraId="VIDEO-01" dimmed />, { reduced: true }))
    const root = screen.getByTestId('camera-feed')
    expect(root).toHaveAttribute('data-motion', 'reduced')
    await waitFor(() => expect(pause).toHaveBeenCalled())
    expect(play).not.toHaveBeenCalled()
    expect(screen.getByText('Monitoring paused. Recording continues.')).toBeInTheDocument()
  })
})
