// Step 39: DbfsMeter (01_specs §14.6 accessibility contract; 03_motion_spec M-C-04, §9.3, MS-08).
import { Profiler } from 'react'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { captureMicLines, micInputOfChannel, type Sim } from '@dems/shared/sim'
import { drainMeterFrames, setDebugMetricsEnabled } from '@/motion'
import { DbfsMeter } from '../dbfs-meter'
import {
  ariaValueNow,
  formatDbfsValue,
  litSegments,
  METER_THRESHOLDS,
  peakPosition,
  segmentOpacity,
  segmentTone,
} from '../dbfs-meter.math'
import { createTestSim, pushAudioFrame, withProviders } from './test-utils'

const MINUS = '−'

let sim: Sim
let t0: number

beforeEach(() => {
  sim = createTestSim()
  const state = sim.store.getState()
  t0 = state.audio.inputs[micInputOfChannel(captureMicLines(state), 'AUDIO-01')].at
  // A known starting frame: −18 dBFS on MIC 1 (the mockup value).
  pushAudioFrame(sim, 'AUDIO-01', { at: t0, dbfs: -18, peak: -12, clip: false, noSignal: false })
})

/** The policy provider syncs the debug counters to `?debug=1` on mount; turn them on after it. */
function countFrames() {
  setDebugMetricsEnabled(true)
  drainMeterFrames()
}

afterEach(() => {
  cleanup()
  setDebugMetricsEnabled(false)
})

describe('dBFS maths (§14.6 segments, M-C-04)', () => {
  it('has the ten §14.6 thresholds with their tones', () => {
    expect(METER_THRESHOLDS).toEqual([-60, -48, -40, -32, -26, -20, -14, -9, -5, -2])
    expect(METER_THRESHOLDS.map(segmentTone)).toEqual([
      'success', 'success', 'success', 'success', 'success', 'success',
      'warning', 'warning', 'danger', 'danger',
    ])
  })

  it('lights 6 segments at −18 dBFS and fades each segment over the 1 dB below its threshold', () => {
    expect(litSegments(-18)).toBe(6)
    expect(litSegments(-90)).toBe(0)
    expect(litSegments(0)).toBe(10)
    expect(segmentOpacity(-20, -21)).toBeCloseTo(0.12)
    expect(segmentOpacity(-20, -20.5)).toBeCloseTo(0.56)
    expect(segmentOpacity(-20, -20)).toBe(1)
  })

  it('places the peak tick monotonically and hides it below the floor', () => {
    expect(peakPosition(-90)).toBe(-1)
    expect(peakPosition(0)).toBe(1)
    let previous = -Infinity
    for (let db = -61; db <= 0; db += 0.5) {
      const p = peakPosition(db)
      expect(p).toBeGreaterThanOrEqual(previous)
      previous = p
    }
    // On the far edge of the 6th segment at its own threshold's next edge.
    expect(peakPosition(-14)).toBeCloseTo(0.7)
  })

  it('formats the readout and the ARIA value', () => {
    expect(formatDbfsValue(-18.4)).toBe(`${MINUS}18`)
    expect(formatDbfsValue(0.3)).toBe('0')
    expect(ariaValueNow(-90)).toBe(-60)
    expect(ariaValueNow(-17.6)).toBe(-18)
  })
})

describe('DbfsMeter', () => {
  it('meets the §14.6 accessibility contract (role meter, −60…0, valuetext)', () => {
    render(withProviders(<DbfsMeter channel="AUDIO-01" variant="panel" />, { sim }))
    const meter = screen.getByRole('meter', { name: 'MIC 1 - Interviewer' })
    expect(meter).toHaveAttribute('aria-valuemin', '-60')
    expect(meter).toHaveAttribute('aria-valuemax', '0')
    expect(meter).toHaveAttribute('aria-valuenow', '-18')
    expect(meter).toHaveAttribute('aria-valuetext', `${MINUS}18 dBFS`)
    expect(meter.querySelectorAll('[data-meter-segment]')).toHaveLength(10)
    expect(screen.getByTestId('dbfs-meter')).toHaveAttribute('data-motion', 'full')
  })

  it('applies 20 audio frames with 0 React commits (MS-08 unit form) and ARIA at 1 Hz', async () => {
    let commits = 0
    render(
      withProviders(
        <Profiler id="meter" onRender={() => (commits += 1)}>
          <DbfsMeter channel="AUDIO-01" variant="tile" />
        </Profiler>,
        { sim },
      ),
    )
    const meter = screen.getByRole('meter')
    const readout = document.querySelector('[data-meter-readout]') as HTMLElement
    await waitFor(() => expect(readout.textContent).toBe(`${MINUS}18 dBFS`))
    countFrames()
    commits = 0

    // 20 frames at 20 Hz (50 ms apart): a level sweep from −29 to −10 dBFS.
    for (let i = 1; i <= 19; i += 1) {
      pushAudioFrame(sim, 'AUDIO-01', { at: t0 + i * 50, dbfs: -30 + i, peak: -10 })
    }
    // ARIA moves at 1 Hz: frames at +50 … +950 ms leave it on the mount value …
    expect(meter).toHaveAttribute('aria-valuenow', '-18')
    expect(meter).toHaveAttribute('aria-valuetext', `${MINUS}18 dBFS`)
    // … and the 20th frame, 1 s after the mount frame, updates it.
    pushAudioFrame(sim, 'AUDIO-01', { at: t0 + 20 * 50, dbfs: -9.6, peak: -9 })
    expect(meter).toHaveAttribute('aria-valuenow', '-10')
    expect(meter).toHaveAttribute('aria-valuetext', `${MINUS}10 dBFS`)

    expect(commits).toBe(0)
    expect(drainMeterFrames()['AUDIO-01']).toBe(20)
    // The readout (≤ 4 Hz) followed too, still without a commit.
    expect(readout.textContent).toBe(`${MINUS}10 dBFS`)
    expect(commits).toBe(0)
  })

  it('drives the segment opacities from the frames (motion values, no render)', async () => {
    render(withProviders(<DbfsMeter channel="AUDIO-01" variant="panel" />, { sim, reduced: true }))
    const segment = (threshold: number) =>
      document.querySelector(`[data-meter-segment="${threshold}"]`) as HTMLElement
    await waitFor(() => expect(Number(segment(-20).style.opacity)).toBeCloseTo(1))
    expect(Number(segment(-14).style.opacity)).toBeCloseTo(0.12)
    pushAudioFrame(sim, 'AUDIO-01', { at: t0 + 200, dbfs: -6, peak: -6 })
    await waitFor(() => expect(Number(segment(-9).style.opacity)).toBeCloseTo(1))
    expect(Number(segment(-5).style.opacity)).toBeCloseTo(0.12)
  })

  it('throttles to 10 Hz under reduced motion and stays functional (§8)', () => {
    render(withProviders(<DbfsMeter channel="AUDIO-01" variant="compact" />, { sim, reduced: true }))
    expect(screen.getByTestId('dbfs-meter')).toHaveAttribute('data-motion', 'reduced')
    countFrames()
    for (let i = 1; i <= 20; i += 1) pushAudioFrame(sim, 'AUDIO-01', { at: t0 + i * 50, dbfs: -20 })
    expect(drainMeterFrames()['AUDIO-01']).toBe(10)
  })

  it('latches CLIP with one render, and the chip resets the latch through the simulator', async () => {
    let commits = 0
    render(
      withProviders(
        <Profiler id="meter" onRender={() => (commits += 1)}>
          <DbfsMeter channel="AUDIO-02" variant="panel" />
        </Profiler>,
        { sim },
      ),
    )
    commits = 0
    act(() => sim.actions.inject('MIC_CLIP', { channel: 'AUDIO-02' }))
    pushAudioFrame(sim, 'AUDIO-02', { at: t0 + 100, dbfs: -0.2, peak: -0.2, clip: true })
    expect(commits).toBe(1)
    expect(screen.getByTestId('dbfs-meter')).toHaveAttribute('data-clip', 'latched')
    // The top segment is locked at full opacity.
    await waitFor(() =>
      expect(Number((document.querySelector('[data-meter-segment="-2"]') as HTMLElement).style.opacity)).toBe(1),
    )

    const reset = screen.getByRole('button', { name: 'Reset clip: MIC 2 - Subject' })
    expect(reset).toHaveTextContent('CLIP')
    fireEvent.click(reset)
    expect(sim.store.getState().mics.find((mic) => mic.id === 'AUDIO-02')?.clipLatched).toBe(false)
    pushAudioFrame(sim, 'AUDIO-02', { at: t0 + 150, dbfs: -20, peak: -20, clip: false })
    await waitFor(() => expect(screen.queryByRole('button', { name: /Reset clip/ })).toBeNull())
  })

  it('shows NO SIGNAL with a flat line and says so to assistive technology', async () => {
    render(withProviders(<DbfsMeter channel="AUDIO-01" variant="panel" />, { sim }))
    pushAudioFrame(sim, 'AUDIO-01', { at: t0 + 60, dbfs: -90, peak: -90, noSignal: true })
    const meter = screen.getByRole('meter')
    expect(meter).toHaveAttribute('aria-valuetext', 'No signal')
    expect(meter).toHaveAttribute('aria-valuenow', '-60')
    expect(screen.getByText('NO SIGNAL')).toBeInTheDocument()
    expect(document.querySelector('[data-meter-flat]')).not.toBeNull()
  })

  it('dims while monitoring is paused and keeps metering (M-C-20)', () => {
    render(withProviders(<DbfsMeter channel="AUDIO-01" variant="panel" monitoringPaused />, { sim }))
    expect(screen.getByText('Monitoring paused. Recording continues.')).toBeInTheDocument()
    countFrames()
    pushAudioFrame(sim, 'AUDIO-01', { at: t0 + 60, dbfs: -20 })
    expect(drainMeterFrames()['AUDIO-01']).toBe(1)
  })
})
