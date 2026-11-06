// Step 45b (F45-01, D96): at most one live tile video decodes per page; a `feed` keeps priority.
// The audit measured 30 fps in windowed GPU Chrome with two decoding tiles and 60 fps with one.
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { CameraFeed } from '../camera-feed'
import { LIVE_DECODE_BUDGET, liveDecodersGranted, liveDecodersRequested } from '../live-decode-budget'
import { OnScreenObserver, withProviders } from '@/components/composed/__tests__/test-utils'

const originalPlay = HTMLMediaElement.prototype.play
const originalPause = HTMLMediaElement.prototype.pause
const originalObserver = (globalThis as unknown as Record<string, unknown>).IntersectionObserver
let play: ReturnType<typeof vi.fn>

beforeAll(() => {
  ;(globalThis as unknown as Record<string, unknown>).IntersectionObserver = OnScreenObserver
})

afterAll(() => {
  ;(globalThis as unknown as Record<string, unknown>).IntersectionObserver = originalObserver
  HTMLMediaElement.prototype.play = originalPlay
  HTMLMediaElement.prototype.pause = originalPause
})

beforeEach(() => {
  play = vi.fn(() => Promise.resolve())
  HTMLMediaElement.prototype.play = play as unknown as HTMLMediaElement['play']
  HTMLMediaElement.prototype.pause = vi.fn() as unknown as HTMLMediaElement['pause']
})

afterEach(() => {
  cleanup()
})

function feeds() {
  return screen.getAllByTestId('camera-feed')
}

function decodeStates() {
  return feeds().map((feed) => `${feed.getAttribute('data-camera')}:${feed.getAttribute('data-decode')}`)
}

/** The camera whose <video> received the latest play() call. */
function lastPlayed(): string | null {
  const contexts = play.mock.contexts as HTMLVideoElement[]
  const video = contexts[contexts.length - 1]
  return video?.closest('[data-testid="camera-feed"]')?.getAttribute('data-camera') ?? null
}

describe('live decode budget (F45-01)', () => {
  it('lets one of two tiles decode; the other holds its frame under the standby sweep', async () => {
    render(
      withProviders(
        <>
          <CameraFeed cameraId="VIDEO-01" variant="tile" />
          <CameraFeed cameraId="VIDEO-02" variant="tile" />
        </>,
      ),
    )
    expect(LIVE_DECODE_BUDGET).toBe(1)
    await waitFor(() => expect(decodeStates()).toEqual(['VIDEO-01:live', 'VIDEO-02:standby']))
    expect(liveDecodersRequested()).toBe(2)
    expect(liveDecodersGranted()).toBe(1)
    await waitFor(() => expect(play).toHaveBeenCalled())
    // Every play() went to Camera 1; Camera 2's video was never started.
    const cameras = new Set((play.mock.contexts as HTMLVideoElement[]).map((video) => video.closest('[data-testid="camera-feed"]')?.getAttribute('data-camera')))
    expect([...cameras]).toEqual(['VIDEO-01'])
    const standby = feeds()[1].querySelectorAll('[data-testid="camera-feed-standby"]')
    expect(standby).toHaveLength(1)
    expect(feeds()[0].querySelector('[data-testid="camera-feed-standby"]')).toBeNull()
  })

  it('hands the slot to the tile the user hovers or focuses, and keeps it there (sticky)', async () => {
    render(
      withProviders(
        <>
          <div>
            <CameraFeed cameraId="VIDEO-01" variant="tile" />
          </div>
          <button type="button" data-testid="host-2">
            <CameraFeed cameraId="VIDEO-02" variant="tile" />
          </button>
        </>,
      ),
    )
    await waitFor(() => expect(decodeStates()).toEqual(['VIDEO-01:live', 'VIDEO-02:standby']))

    // Keyboard focus on the tile's host claims the slot.
    act(() => {
      screen.getByTestId('host-2').focus()
    })
    await waitFor(() => expect(decodeStates()).toEqual(['VIDEO-01:standby', 'VIDEO-02:live']))
    await waitFor(() => expect(lastPlayed()).toBe('VIDEO-02'))

    // Blur does not flip it back.
    act(() => {
      screen.getByTestId('host-2').blur()
    })
    expect(decodeStates()).toEqual(['VIDEO-01:standby', 'VIDEO-02:live'])

    // A pointer hover on Camera 1 takes it back.
    fireEvent.pointerEnter(feeds()[0], { pointerType: 'mouse' })
    fireEvent.mouseEnter(feeds()[0])
    await waitFor(() => expect(decodeStates()).toEqual(['VIDEO-01:live', 'VIDEO-02:standby']))
  })

  it('gives the next tile the slot when the playing one loses its signal', async () => {
    const { rerender } = render(
      withProviders(
        <>
          <CameraFeed cameraId="VIDEO-01" variant="tile" />
          <CameraFeed cameraId="VIDEO-02" variant="tile" />
        </>,
      ),
    )
    await waitFor(() => expect(decodeStates()).toEqual(['VIDEO-01:live', 'VIDEO-02:standby']))
    rerender(
      withProviders(
        <>
          <CameraFeed cameraId="VIDEO-01" variant="tile" noSignal />
          <CameraFeed cameraId="VIDEO-02" variant="tile" />
        </>,
      ),
    )
    await waitFor(() => expect(decodeStates()).toEqual(['VIDEO-01:off', 'VIDEO-02:live']))
  })

  it('keeps a Session Monitor feed live and puts every tile on standby beside it', async () => {
    render(
      withProviders(
        <>
          <CameraFeed cameraId="VIDEO-01" variant="feed" />
          <CameraFeed cameraId="VIDEO-02" variant="tile" />
        </>,
      ),
    )
    await waitFor(() => expect(decodeStates()).toEqual(['VIDEO-01:live', 'VIDEO-02:standby']))
    expect(liveDecodersGranted()).toBe(1)
  })

  it('claims nothing under reduced motion or `live={false}` (poster, no standby sweep)', async () => {
    render(
      withProviders(
        <>
          <CameraFeed cameraId="VIDEO-01" variant="tile" />
          <CameraFeed cameraId="VIDEO-02" variant="thumb" live={false} />
        </>,
        { reduced: true },
      ),
    )
    await waitFor(() => expect(decodeStates()).toEqual(['VIDEO-01:off', 'VIDEO-02:off']))
    expect(screen.queryByTestId('camera-feed-standby')).toBeNull()
    expect(play).not.toHaveBeenCalled()
    expect(liveDecodersRequested()).toBe(0)
  })

  it('releases its claim on unmount', async () => {
    const { unmount } = render(withProviders(<CameraFeed cameraId="VIDEO-01" variant="tile" />))
    await waitFor(() => expect(liveDecodersGranted()).toBe(1))
    unmount()
    expect(liveDecodersGranted()).toBe(0)
    expect(liveDecodersRequested()).toBe(0)
  })
})
