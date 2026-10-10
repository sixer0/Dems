// Blueprint row 92 (M8-W3; UX spec flow 5, R-3, R-4): the pure rules of sealed playback and the
// audio-source band it draws.
//
// | What is held | Where |
// |--------------|-------|
// | The band is the item's intervals over the recorded duration: order, clamping, the open last interval | "bandSegments" |
// | Which microphone is audible at a playhead position | "segmentAt" |
// | The second camera file is re-aligned only beyond the tolerance | "needsResync" |
// | The class of a source comes from a verify result only | "development marks" |
// | G6 / G7: Checking, then allowed or refused | "permissionGate" |
// | The component: one rect per interval with its text, the legend, the line at the playhead; static under a moving playhead | "AudioSourceBand" |
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { withProviders } from '@/components/composed/__tests__/test-utils'
import { getMissingI18nKeys, resetMissingI18nKeys } from '@/i18n'
import { AudioSourceBand } from '../audio-source-band'
import type { ItemAudioInterval } from '../item-v2'
import {
  PLAYER_SYNC_TOLERANCE_S,
  bandDurationMs,
  bandInputs,
  bandSegments,
  clampSeek,
  fileIsDevelopment,
  formatMediaTime,
  intervalIsDevelopment,
  needsResync,
  permissionGate,
  segmentAt,
  type VerifiedSources,
} from '../sealed-playback'

afterEach(cleanup)

const INTERVALS: ItemAudioInterval[] = [
  { seq: 1, inputId: 'MIC-01', fromMs: 0, toMs: 30_000, reason: 'START' },
  { seq: 2, inputId: 'MIC-02', fromMs: 30_000, toMs: 90_000, reason: 'MANUAL' },
  { seq: 3, inputId: 'MIC-01', fromMs: 90_000, toMs: null, reason: 'MANUAL' },
]
const DEVELOPMENT: VerifiedSources = {
  state: 'DEVELOPMENT',
  tracks: [
    { trackId: 'VIDEO-01', sourceClass: 'LOCAL_DEVICE' },
    { trackId: 'VIDEO-02', sourceClass: 'PRODUCTION' },
  ],
  audioIntervals: [
    { seq: 1, micDeviceId: 'MIC-01', sourceClass: 'PRODUCTION' },
    { seq: 2, micDeviceId: 'MIC-02', sourceClass: 'FAKE' },
  ],
}

describe('bandSegments', () => {
  it('each interval as a share of the recorded duration; the open one runs to the end; tones by first appearance', () => {
    const segments = bandSegments(INTERVALS, 120_000)
    expect(segments.map((segment) => [segment.seq, segment.inputId, segment.fromMs, segment.toMs, segment.startPct, segment.widthPct, segment.tone])).toEqual([
      [1, 'MIC-01', 0, 30_000, 0, 25, 0],
      [2, 'MIC-02', 30_000, 90_000, 25, 50, 1],
      [3, 'MIC-01', 90_000, 120_000, 75, 25, 0],
    ])
    expect(segments.reduce((sum, segment) => sum + segment.widthPct, 0)).toBe(100)
    expect(bandInputs(segments)).toEqual([
      { inputId: 'MIC-01', tone: 0 },
      { inputId: 'MIC-02', tone: 1 },
    ])
  })

  it('is ordered by media time whatever the order sent; a segment without width is dropped; nothing leaves the recording', () => {
    const shuffled = [INTERVALS[2]!, INTERVALS[0]!, { seq: 9, inputId: 'MIC-02', fromMs: 30_000, toMs: 30_000, reason: null }, INTERVALS[1]!]
    expect(bandSegments(shuffled, 120_000).map((segment) => segment.seq)).toEqual([1, 2, 3])
    // An interval that ends after the item's duration extends the span, so no segment is cut short.
    expect(bandDurationMs([{ seq: 1, inputId: 'MIC-01', fromMs: 0, toMs: 150_000, reason: 'START' }], 120_000)).toBe(150_000)
    expect(bandSegments([], 120_000)).toEqual([])
    expect(bandSegments(INTERVALS, 0).at(-1)).toMatchObject({ seq: 2, toMs: 90_000 })
  })
})

describe('segmentAt, needsResync, clampSeek, formatMediaTime', () => {
  const segments = bandSegments(INTERVALS, 120_000)
  it('the interval that holds the playhead: an end is exclusive, except the very end of the recording', () => {
    expect(segmentAt(segments, 0)?.seq).toBe(1)
    expect(segmentAt(segments, 29_999)?.seq).toBe(1)
    expect(segmentAt(segments, 30_000)?.seq).toBe(2)
    expect(segmentAt(segments, 120_000)?.seq).toBe(3)
    expect(segmentAt(segments, 120_001)).toBeNull()
    expect(segmentAt([], 5)).toBeNull()
  })

  it('the following player is re-aligned only beyond the tolerance', () => {
    expect(needsResync(10, 10 + PLAYER_SYNC_TOLERANCE_S)).toBe(false)
    expect(needsResync(10, 10 + PLAYER_SYNC_TOLERANCE_S + 0.01)).toBe(true)
    expect(needsResync(10, 9.5)).toBe(true)
    expect(needsResync(Number.NaN, 3)).toBe(false)
  })

  it('a seek stays inside the recording; times read m:ss and h:mm:ss', () => {
    expect([clampSeek(-3, 120), clampSeek(500, 120), clampSeek(60, 120), clampSeek(Number.NaN, 120)]).toEqual([0, 120, 60, 0])
    expect([formatMediaTime(0), formatMediaTime(65_400), formatMediaTime(3_725_000)]).toEqual(['0:00', '1:05', '1:02:05'])
  })
})

describe('development marks come from a verify result only', () => {
  it('a file or an interval is marked only when the result states a development class for it', () => {
    expect([fileIsDevelopment(DEVELOPMENT, 'VIDEO-01'), fileIsDevelopment(DEVELOPMENT, 'VIDEO-02')]).toEqual([true, false])
    expect([intervalIsDevelopment(DEVELOPMENT, 1), intervalIsDevelopment(DEVELOPMENT, 2), intervalIsDevelopment(DEVELOPMENT, 3)]).toEqual([false, true, false])
    // No run yet, and a result that states nothing: no mark (and no word "production" either).
    expect(fileIsDevelopment(null, 'VIDEO-01')).toBe(false)
    expect(fileIsDevelopment({ ...DEVELOPMENT, state: 'NOT_TRUSTWORTHY' }, 'VIDEO-01')).toBe(false)
    expect(intervalIsDevelopment({ ...DEVELOPMENT, state: 'DECLARED_PRODUCTION' }, 2)).toBe(false)
  })
})

describe('permissionGate', () => {
  it('Checking until the role is known, then allowed or refused', () => {
    expect(permissionGate({ operatorKnown: false, permitted: true })).toBe('CHECKING')
    expect(permissionGate({ operatorKnown: false, permitted: false })).toBe('CHECKING')
    expect(permissionGate({ operatorKnown: true, permitted: true })).toBe('ALLOWED')
    expect(permissionGate({ operatorKnown: true, permitted: false })).toBe('REFUSED')
  })
})

describe('AudioSourceBand', () => {
  const segments = bandSegments(INTERVALS, 120_000)
  const draw = (positionMs: number) => render(withProviders(<AudioSourceBand segments={segments} totalMs={120_000} positionMs={positionMs} sources={null} />))

  it('one rect per interval at its place, each with a text; the legend names both microphones with their spans', () => {
    resetMissingI18nKeys()
    draw(0)
    const rects = [1, 2, 3].map((seq) => screen.getByTestId(`evidence-band-segment-${seq}`))
    expect(rects.map((rect) => [rect.getAttribute('x'), rect.getAttribute('width'), rect.getAttribute('data-input')])).toEqual([
      ['0', '25', 'MIC-01'],
      ['25', '50', 'MIC-02'],
      ['75', '25', 'MIC-01'],
    ])
    expect(rects[1]!.querySelector('title')?.textContent).toBe('MIC 2, 0:30 to 1:30')
    const legend = Array.from(screen.getByTestId('evidence-band-legend').querySelectorAll('li')).map((entry) => entry.textContent)
    expect(legend).toEqual(['MIC 10:00–0:30, 1:30–2:00', 'MIC 20:30–1:30'])
    expect(getMissingI18nKeys()).toEqual([])
  })

  it('the playhead moves, the band does not: the same rects, another mark and another "audio at the playhead"', () => {
    const view = draw(10_000)
    const places = () => [1, 2, 3].map((seq) => `${screen.getByTestId(`evidence-band-segment-${seq}`).getAttribute('x')}/${screen.getByTestId(`evidence-band-segment-${seq}`).getAttribute('width')}`)
    const before = places()
    expect(screen.getByTestId('evidence-band-now')).toHaveTextContent('Audio at the playhead: MIC 1')
    view.rerender(withProviders(<AudioSourceBand segments={segments} totalMs={120_000} positionMs={45_000} sources={null} />))
    expect(places()).toEqual(before)
    expect(screen.getByTestId('evidence-band-now')).toHaveTextContent('Audio at the playhead: MIC 2')
    expect(screen.getByTestId('evidence-band-head')).toHaveAttribute('x1', '37.5')
  })

  it('no interval: the band says so and draws nothing', () => {
    render(withProviders(<AudioSourceBand segments={[]} totalMs={120_000} positionMs={0} sources={null} />))
    expect(screen.getByTestId('evidence-band-none')).toHaveTextContent('This item carries no audio-source intervals.')
    expect(screen.queryByTestId('evidence-band')).toBeNull()
  })
})
