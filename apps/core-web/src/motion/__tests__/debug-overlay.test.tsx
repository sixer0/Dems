// ?debug=1 overlay: fps, long tasks, ambient-loop count, meter frames per channel
// (03_motion_spec §9.5; AC-61, AC-71, MS-04).
import { act, cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { drainMeterFrames, reportMeterFrame, setDebugMetricsEnabled } from '../debug-metrics'
import MotionDebugOverlay from '../debug-overlay'
import { MotionPolicyProvider } from '../motion-policy-provider'
import { useAmbientLoop } from '../use-ambient-loop'
import { fakeMatchMedia, memoryStorage } from './helpers'

afterEach(() => {
  cleanup()
})

function Loop({ label }: { label: string }) {
  useAmbientLoop(label)
  return null
}

describe('debug metrics', () => {
  it('counts meter frames only while the overlay is on, and drains per window', () => {
    setDebugMetricsEnabled(false)
    reportMeterFrame('AUDIO-01')
    expect(drainMeterFrames()).toEqual({})

    setDebugMetricsEnabled(true)
    for (let i = 0; i < 20; i += 1) reportMeterFrame('AUDIO-01')
    reportMeterFrame('AUDIO-02')
    expect(drainMeterFrames()).toEqual({ 'AUDIO-01': 20, 'AUDIO-02': 1 })
    expect(drainMeterFrames()).toEqual({ 'AUDIO-01': 0, 'AUDIO-02': 0 })
    setDebugMetricsEnabled(false)
  })
})

describe('MotionDebugOverlay', () => {
  it('is absent without ?debug=1', async () => {
    render(
      <MotionPolicyProvider search="/session" storage={memoryStorage()} matchMedia={fakeMatchMedia(false).matchMedia}>
        <span>page</span>
      </MotionPolicyProvider>,
    )
    await act(async () => {
      await Promise.resolve()
    })
    expect(screen.queryByTestId('motion-debug-overlay')).toBeNull()
  })

  it('loads lazily with ?debug=1 on any route and shows the ambient-loop count against the cap', async () => {
    render(
      <MotionPolicyProvider
        search="/session?debug=1"
        storage={memoryStorage()}
        matchMedia={fakeMatchMedia(false).matchMedia}
      >
        <Loop label="rec-pulse" />
        <Loop label="feed-glow" />
      </MotionPolicyProvider>,
    )
    const overlay = await screen.findByTestId('motion-debug-overlay')
    expect(overlay).toHaveAttribute('data-ambient-running', '2')
    expect(overlay).toHaveTextContent('2/4')
    expect(screen.getByTestId('motion-debug-ambient-list')).toHaveTextContent('rec-pulse, feed-glow')
    expect(overlay).toHaveClass('pointer-events-none')
  })

  it('shows meter frames per second per channel from reportMeterFrame', async () => {
    render(
      <MotionPolicyProvider
        search="?debug=1"
        debugOverlay={false}
        storage={memoryStorage()}
        matchMedia={fakeMatchMedia(false).matchMedia}
      >
        <MotionDebugOverlay sampleIntervalMs={100} />
      </MotionPolicyProvider>,
    )
    const overlay = screen.getByTestId('motion-debug-overlay')
    expect(overlay).toHaveTextContent('no frames')

    // A 20 Hz meter for one window: 2 frames per 100 ms.
    reportMeterFrame('AUDIO-01')
    reportMeterFrame('AUDIO-01')
    reportMeterFrame('AUDIO-02')
    reportMeterFrame('AUDIO-02')

    await vi.waitFor(() => {
      const rates = JSON.parse(overlay.getAttribute('data-meter-rates') ?? '{}') as Record<string, number>
      expect(rates['AUDIO-01']).toBeGreaterThan(0)
      expect(rates['AUDIO-02']).toBeGreaterThan(0)
    })
    expect(overlay).toHaveTextContent(/AUDIO-01 \d+\/s/)
  })

  it('flags an ambient budget breach (a fifth page loop)', async () => {
    render(
      <MotionPolicyProvider search="?debug=1" storage={memoryStorage()} matchMedia={fakeMatchMedia(false).matchMedia}>
        {['a', 'b', 'c', 'd', 'e'].map((label) => (
          <Loop key={label} label={label} />
        ))}
      </MotionPolicyProvider>,
    )
    const overlay = await screen.findByTestId('motion-debug-overlay')
    expect(overlay).toHaveAttribute('data-ambient-requested', '5')
    expect(overlay).toHaveAttribute('data-ambient-breach', 'true')
    expect(overlay).toHaveTextContent('4/4 (over budget: 5 requested)')
    expect(screen.getByTestId('motion-debug-ambient-list')).toHaveTextContent('paused: e')
  })

  it('does not flag the shell loop yielding to four page loops (§9.4 by design)', async () => {
    function ShellLoop() {
      useAmbientLoop('topo-drift', { priority: 'shell' })
      return null
    }
    render(
      <MotionPolicyProvider search="?debug=1" storage={memoryStorage()} matchMedia={fakeMatchMedia(false).matchMedia}>
        <ShellLoop />
        {['ring-rotate', 'ring-breathe', 'ken-burns', 'particles'].map((label) => (
          <Loop key={label} label={label} />
        ))}
      </MotionPolicyProvider>,
    )
    const overlay = await screen.findByTestId('motion-debug-overlay')
    expect(overlay).toHaveAttribute('data-ambient-breach', 'false')
    expect(overlay).toHaveTextContent('4/4 (shell paused)')
    expect(screen.getByTestId('motion-debug-ambient-list')).toHaveTextContent('paused: topo-drift')
  })
})
