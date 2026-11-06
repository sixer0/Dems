// Step 49 model tests: units, the design-book §10.2 retention formula, ring geometry, chart view
// models, and the simulator's storage views (W49-1/2, step 54). Pure functions, no rendering.
import { describe, expect, it } from 'vitest'
import {
  createMemoryAuthStorage,
  createSim,
  GB,
  RECORDING_BYTES_PER_HOUR,
  selectStorage,
  TB,
  type SimState,
} from '@dems/shared/sim'
import {
  AUDIO_MBPS,
  DEFAULT_HOURS_PER_DAY,
  DEFAULT_OVERHEAD,
  formatShortBytes,
  hourlyBuckets,
  hoursMinutes,
  isEscalation,
  retentionMath,
  RING_CIRCUMFERENCE,
  ringDashOffset,
  ringTick,
  usageSeries,
} from '../model'
import { selectStorageActivity, volumeHealth } from '../sim-adapter'
import { sparklinePath } from '../sparkline-path'

function idleSim() {
  return createSim({ storage: null, authStorage: createMemoryAuthStorage(), scheduler: () => () => undefined })
}

describe('retention formula (design book §10.2, example §10.3)', () => {
  const book = { videoMbps: 8, hoursPerDay: DEFAULT_HOURS_PER_DAY, retentionDays: 90, overhead: DEFAULT_OVERHEAD }

  it('reproduces the book example: 2 × 8 Mbps + 2.304 Mbps audio ≈ 18.3 Mbps ≈ 8.2 GB per hour', () => {
    expect(AUDIO_MBPS).toBeCloseTo(2.304, 6) // 24 bit × 48 kHz × 2 mono channels
    const r = retentionMath(book, 4 * TB, 3_196 * GB)
    expect(r.totalMbps).toBeCloseTo(18.304, 6)
    expect(r.gbPerHour).toBeCloseTo(8.2368, 4)
    expect(Math.round(r.gbPerHour * 10) / 10).toBe(8.2) // "approximately 8.2 GB/hour before overhead"
  })

  it('computes daily, required, coverage and the verdict tone', () => {
    const r = retentionMath(book, 4 * TB, 3_196 * GB)
    expect(r.dailyGb).toBeCloseTo(32.947, 3)
    expect(r.requiredGb).toBeCloseTo(32.947 * 90 * 1.1, 1) // 3,261.8 GB
    expect(r.requiredPercent).toBeCloseTo(81.5, 1)
    expect(r.tone).toBe('success') // below the simulator's LOW threshold (85 %)
    expect(Math.floor(r.hoursLeft)).toBe(388) // 3,196 ÷ 8.2368
    expect(Math.floor(r.daysUntilFull)).toBe(97)
    expect(Math.floor(r.coverageDays)).toBe(110)
    expect(r.excessTb).toBe(0)
  })

  it('flags a retention period the evidence volume cannot hold', () => {
    const r = retentionMath({ ...book, hoursPerDay: 8 }, 4 * TB, 3_196 * GB)
    expect(r.requiredGb).toBeCloseTo(8.2368 * 8 * 90 * 1.1, 6) // 6,523.55 GB
    expect(r.tone).toBe('danger')
    expect(r.excessTb).toBeCloseTo(2.52, 2)
    expect(retentionMath({ ...book, hoursPerDay: 4.3 }, 4 * TB, 3_196 * GB).tone).toBe('warning') // 87.6 %
  })
})

describe('units and geometry', () => {
  it('formats capacities the way the mockups print them', () => {
    expect(formatShortBytes(3_196 * GB)).toBe('3.2 TB')
    expect(formatShortBytes(804 * GB)).toBe('804 GB')
    expect(formatShortBytes(48.1 * GB)).toBe('48.1 GB')
    expect(formatShortBytes(2.5557 * GB)).toBe('2.56 GB')
  })

  it('AC-54: free ÷ 8.2 GB/h at load is 389 h 45 m', () => {
    const summary = selectStorage(idleSim().store.getState())
    expect(summary.usedPercent).toBe(20)
    expect(summary.freeBytes).toBe(3_196 * GB)
    expect(summary.estimatedRemainingMs).toBeCloseTo((3_196 * GB / RECORDING_BYTES_PER_HOUR) * 3_600_000, 0)
    expect(hoursMinutes(summary.estimatedRemainingMs)).toEqual({ hours: 389, minutes: 45 })
  })

  it('maps percentages to the kit ProgressCircle dash offset and ticks', () => {
    expect(ringDashOffset(0)).toBeCloseTo(RING_CIRCUMFERENCE, 6)
    expect(ringDashOffset(100)).toBe(0)
    expect(ringDashOffset(20.1)).toBeCloseTo(RING_CIRCUMFERENCE * 0.799, 6)
    expect(ringDashOffset(140)).toBe(0) // clamped
    expect(ringTick(0, 18, 20)).toEqual({ x1: 18, y1: 0, x2: 18, y2: -2 }) // 12 o'clock
    expect(ringTick(25, 18, 20)).toEqual({ x1: 36, y1: 18, x2: 38, y2: 18 }) // 3 o'clock
  })

  it('treats only a rise in storage state as an escalation (R8)', () => {
    expect(isEscalation('READY', 'LOW')).toBe(true)
    expect(isEscalation('LOW', 'FULL')).toBe(true)
    expect(isEscalation('FULL', 'LOW')).toBe(false)
    expect(isEscalation('READY', 'READY')).toBe(false)
  })
})

describe('chart view models', () => {
  it('turns the 24 hourly history points into GB written since the window start', () => {
    const state = idleSim().store.getState()
    const series = usageSeries(state.storage.history)
    expect(series).toHaveLength(24)
    expect(series[0]?.writtenGb).toBe(0)
    const last = series[series.length - 1]
    expect(last?.usedGb).toBe(804)
    for (let i = 1; i < series.length; i += 1) {
      expect(series[i]!.writtenGb).toBeGreaterThanOrEqual(series[i - 1]!.writtenGb) // never negative
    }
    expect(series[0]?.label).toMatch(/^\d{2}:\d{2}$/)
  })

  it('marks the current WIB hour among 24 sealed-per-hour buckets', () => {
    const state = idleSim().store.getState()
    const buckets = hourlyBuckets(Array.from({ length: 24 }, (_, i) => i % 3), state.clock.now)
    expect(buckets).toHaveLength(24)
    expect(buckets.filter((b) => b.current)).toHaveLength(1)
    expect(buckets[7]).toMatchObject({ hour: 7, label: '07', count: 1 })
  })

  it('draws a sparkline only from two points', () => {
    expect(sparklinePath([40], 88, 24)).toBeNull()
    expect(sparklinePath([38, 38.5, 39], 88, 24)).toMatch(/^M0\.0 [\d.]+ L44\.0 [\d.]+ L88\.0 [\d.]+$/)
  })
})

describe('simulator storage views (W49-1, W49-2; step 54)', () => {
  it('derives per-volume health from the simulator (HDD = storageTempC; SMART PASSED)', () => {
    const state = idleSim().store.getState()
    const [nvme, hdd] = state.storage.volumes
    const h = volumeHealth(state, hdd!)
    expect(h).toMatchObject({ kind: 'EVIDENCE', smart: 'PASSED', temperatureC: state.health.storageTempC, tempLevel: 'OK' })
    expect(h.reallocatedSectors).toBe(0)
    const n = volumeHealth(state, nvme!)
    expect(n).toMatchObject({ kind: 'SYSTEM', smart: 'PASSED', wearPercent: 2, mediaErrors: 0 })
    expect(n.temperatureC).toBeGreaterThanOrEqual(state.health.storageTempC)
  })

  it('turns a hot evidence drive into a SMART warning', () => {
    const state = idleSim().store.getState()
    const hot: SimState = { ...state, health: { ...state.health, storageTempC: 61 } }
    expect(volumeHealth(hot, hot.storage.volumes[1]!)).toMatchObject({ tempLevel: 'HOT', smart: 'WARNING' })
  })

  it('keeps storage events only, newest first, including storage faults but not other faults', () => {
    const sim = idleSim()
    sim.actions.inject('CAMERA_LOSS')
    sim.actions.inject('STORAGE_LOW')
    const rows = selectStorageActivity(sim.store.getState(), 7)
    expect(rows.length).toBeGreaterThan(1)
    expect(rows[0]).toMatchObject({ type: 'FAULT_RAISED', params: { kind: 'STORAGE_LOW' } })
    expect(rows.some((row) => row.params.kind === 'CAMERA_LOSS')).toBe(false)
    expect(rows.some((row) => row.type === 'EVIDENCE_SEALED')).toBe(true)
    for (let i = 1; i < rows.length; i += 1) expect(rows[i]!.at).toBeLessThanOrEqual(rows[i - 1]!.at)
    // Stable references: the same state gives the same row objects (shallow-stable for useSim).
    expect(selectStorageActivity(sim.store.getState(), 7)[0]).toBe(rows[0])
  })
})
