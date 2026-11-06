/**
 * Pure maths of the dBFS meter (01_specs §14.6 DbfsMeter; 03_motion_spec M-C-04; §14.7 audio).
 */
import { toneHex, type StatusTone } from '@dems/shared/tokens'

/** The 10 segment thresholds in dBFS, bottom (or left) to top (or right). */
export const METER_THRESHOLDS = [-60, -48, -40, -32, -26, -20, -14, -9, -5, -2] as const

export const METER_MIN_DB = -60
export const METER_MAX_DB = 0
/** Unlit segment opacity (M-C-04). */
export const SEGMENT_REST_OPACITY = 0.12

/** Green ≤ −20, amber −14 / −9, red −5 / −2 (§14.6). */
export function segmentTone(threshold: number): Extract<StatusTone, 'success' | 'warning' | 'danger'> {
  if (threshold <= -20) return 'success'
  if (threshold <= -9) return 'warning'
  return 'danger'
}

export function segmentColor(threshold: number): string {
  return toneHex[segmentTone(threshold)]
}

/** The `useTransform` input range of one segment: it fades in over the 1 dB below its threshold. */
export function segmentInputRange(threshold: number): [number, number] {
  return [threshold - 1, threshold]
}

/** Opacity of a segment at `db` (the same mapping the motion values use, clamped). */
export function segmentOpacity(threshold: number, db: number): number {
  const [from, to] = segmentInputRange(threshold)
  if (db <= from) return SEGMENT_REST_OPACITY
  if (db >= to) return 1
  return SEGMENT_REST_OPACITY + ((db - from) / (to - from)) * (1 - SEGMENT_REST_OPACITY)
}

/** Number of fully lit segments at `db`. −18 dBFS lights 6 (the −60 … −20 greens). */
export function litSegments(db: number): number {
  return METER_THRESHOLDS.filter((threshold) => db >= threshold).length
}

/**
 * Position of the peak-hold tick along the meter, 0 (floor) to 1 (top): piecewise linear so the
 * tick sits on the far edge of the highest segment the peak reaches, and between two segment
 * edges for a peak between their thresholds. Below −61 dBFS the tick is hidden (−1).
 */
export function peakPosition(db: number): number {
  const count = METER_THRESHOLDS.length
  if (!Number.isFinite(db) || db < METER_MIN_DB - 1) return -1
  if (db < METER_MIN_DB) return (db - (METER_MIN_DB - 1)) / count
  // From the top threshold (−2) up, the top segment is lit: the tick sits at the far end.
  for (let i = 0; i < count - 1; i += 1) {
    const low = METER_THRESHOLDS[i] ?? METER_MIN_DB
    const high = METER_THRESHOLDS[i + 1] ?? METER_MAX_DB
    if (db < high) return (i + 1 + (db - low) / (high - low)) / count
  }
  return 1
}

/** Staircase height of segment `index` for the tile and panel looks (30% → 100%). */
export function staircaseHeight(index: number, count: number = METER_THRESHOLDS.length): number {
  if (count <= 1) return 1
  return 0.3 + (0.7 * index) / (count - 1)
}

/** Readout text: whole dBFS with a typographic minus, e.g. "−18 dBFS" (U+2212). */
export function formatDbfsValue(db: number): string {
  const rounded = Math.round(Math.max(-90, Math.min(0, db)))
  return rounded < 0 ? `−${Math.abs(rounded)}` : '0'
}

/** `aria-valuenow`: the level clamped to the meter range and rounded (1 Hz). */
export function ariaValueNow(db: number): number {
  return Math.round(Math.max(METER_MIN_DB, Math.min(METER_MAX_DB, db)))
}

/**
 * A rate limiter on the simulator timestamps of the frames (not wall time, so tests and a tab
 * resuming from the background stay deterministic): `take(at)` is true when at least `minGapMs`
 * passed since the last accepted frame.
 */
export function createFrameGate(minGapMs: number) {
  let last = Number.NEGATIVE_INFINITY
  return {
    take(at: number): boolean {
      if (at - last >= minGapMs) {
        last = at
        return true
      }
      return false
    },
    reset() {
      last = Number.NEGATIVE_INFINITY
    },
  }
}
