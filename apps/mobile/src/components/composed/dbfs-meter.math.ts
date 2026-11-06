/**
 * C-2 DbfsMeter maths (04_mobile_specs §4.0, §5.4; 03_motion_spec M-C-04). Pure and worklet-safe:
 * the meter evaluates these on the UI thread every frame, and the jest suite tests them directly.
 */
import { motion, type SpringToken } from '@dems/shared/tokens';

/** Segment thresholds in dBFS, bottom (quietest) to top (01_specs §14.6). */
export const DBFS_THRESHOLDS = [-60, -48, -40, -32, -26, -20, -14, -9, -5, -2] as const;
export const SEGMENT_COUNT = DBFS_THRESHOLDS.length;
/** Silence floor used by the simulator for "no signal". */
export const DBFS_FLOOR = -90;
/** Unlit segment opacity (04 §5.4). */
export const UNLIT_OPACITY = 0.12;
/** Peak hold, then fall (03M M-C-04). */
export const PEAK_HOLD_MS = 1500;
export const PEAK_FALL_DB_PER_S = 20;
/** Text that must be read changes at most 4 times a second (03M P8, `numberTextMaxHz`). */
export const READOUT_MAX_HZ = 4;
/** Reduced motion: direct updates, no spring, at most 10 Hz (03M §8: meters stay functional). */
export const REDUCED_UPDATE_HZ = 10;
export const NO_SIGNAL_FADE_MS = 400;
/** Monitoring paused (UI-only, D28/Q8) dims the meter to this opacity. */
export const PAUSED_DIM = 0.35;
/** The CLIP chip flashes once: 1 → 0.4 → 1 in 180 ms (P8). */
export const CLIP_FLASH_MS = 180;
export const CLIP_FLASH_LOW = 0.4;

const tokenSprings = motion.spring as Readonly<Record<string, SpringToken | undefined>>;
/** 03M §2.3 `meter` spring; the shared token wins once step 30 publishes it (SCR-07 fallback). */
export const METER_SPRING: SpringToken = tokenSprings.meter ?? { stiffness: 600, damping: 40, mass: 0.6 };

export type SegmentTone = 'success' | 'warning' | 'danger';

/** Green up to −20, amber at −14 and −9, red at −5 and −2. */
export function segmentTone(index: number): SegmentTone {
  'worklet';
  if (index >= 8) return 'danger';
  if (index >= 6) return 'warning';
  return 'success';
}

/**
 * Opacity of segment `index` for a (smoothed) level: `interpolate(level, [t − 1, t], [0.12, 1])`,
 * clamped (04 §5.4). A segment is fully lit once the level reaches its threshold.
 */
export function segmentOpacity(level: number, index: number): number {
  'worklet';
  const threshold = DBFS_THRESHOLDS[index];
  if (threshold === undefined) return UNLIT_OPACITY;
  if (level <= threshold - 1) return UNLIT_OPACITY;
  if (level >= threshold) return 1;
  return UNLIT_OPACITY + (level - (threshold - 1)) * (1 - UNLIT_OPACITY);
}

/** Number of fully lit segments. */
export function litSegmentCount(level: number): number {
  'worklet';
  let count = 0;
  for (let i = 0; i < SEGMENT_COUNT; i += 1) {
    if (level >= DBFS_THRESHOLDS[i]) count += 1;
  }
  return count;
}

/**
 * Position of a level along the meter axis (0 = empty, 1 = full), piecewise-linear over the
 * segments so that the peak marker lines up with the segment edges it has lit.
 */
export function levelToFraction(level: number): number {
  'worklet';
  const n = SEGMENT_COUNT;
  if (level < DBFS_THRESHOLDS[0]) return 0;
  for (let i = 0; i < n - 1; i += 1) {
    const lo = DBFS_THRESHOLDS[i];
    const hi = DBFS_THRESHOLDS[i + 1];
    if (level < hi) return (i + 1) / n + ((level - lo) / (hi - lo)) * (1 / n);
  }
  return 1;
}

/** Peak-hold state kept on the UI thread (ms timestamps from the frame clock). */
export interface PeakState {
  peak: number;
  heldUntil: number;
  updatedAt: number;
}

export function initialPeakState(): PeakState {
  'worklet';
  return { peak: DBFS_FLOOR, heldUntil: 0, updatedAt: 0 };
}

/**
 * One peak-hold step: a new maximum is held for 1.5 s, then the marker falls at 20 dB/s until it
 * meets the live input again (03M M-C-04; the simulator uses the same ballistics).
 */
export function stepPeakHold(prev: PeakState, input: number, now: number): PeakState {
  'worklet';
  // Strictly greater: a steady input equal to the held peak keeps the hold timer (no churn).
  if (input > prev.peak) {
    return { peak: input, heldUntil: now + PEAK_HOLD_MS, updatedAt: now };
  }
  if (now <= prev.heldUntil) {
    return { peak: prev.peak, heldUntil: prev.heldUntil, updatedAt: now };
  }
  const from = Math.max(prev.updatedAt, prev.heldUntil);
  const fallen = prev.peak - (PEAK_FALL_DB_PER_S * (now - from)) / 1000;
  return { peak: Math.max(input, fallen, DBFS_FLOOR), heldUntil: prev.heldUntil, updatedAt: now };
}

/** Throttle gate: true when at least 1/hz seconds have passed since `lastAt`. */
export function isDue(lastAt: number, now: number, hz: number): boolean {
  'worklet';
  return now - lastAt >= 1000 / hz;
}

/** Readout text, e.g. `-18 dBFS` (tabular mono face in the canvas). */
export function formatDbfs(level: number, unitArg?: string): string {
  'worklet';
  const unit = unitArg ?? 'dBFS';
  const rounded = Math.round(Math.max(level, DBFS_FLOOR));
  return `${rounded === 0 ? 0 : rounded} ${unit}`;
}

export type MeterVariant = 'card' | 'large' | 'compact';
export type MeterOrientation = 'horizontal' | 'vertical';

export interface SegmentRect {
  x: number;
  y: number;
  width: number;
  height: number;
  r: number;
}

export interface MeterLayout {
  segments: SegmentRect[];
  /** The bar area (segments plus gaps). */
  bars: { x: number; y: number; width: number; height: number };
  /** Readout baseline and size, or null when the variant has no readout. */
  readout: { x: number; y: number; size: number } | null;
  /** Peak marker thickness (px). */
  peakThickness: number;
  /** Glow blur radius for lit segments (0 = no glow copy). */
  glow: number;
}

/** Readout font size per variant (px). */
export function readoutSize(variant: MeterVariant): number {
  'worklet';
  if (variant === 'large') return 22;
  if (variant === 'card') return 15;
  return 0;
}

/**
 * Geometry for a canvas of `width` × `height`. Horizontal meters are a row of vertical bars
 * (MB 4 MIC cards, AS "Audio input card"); vertical meters stack bars bottom-up. The `card`
 * variant ramps bar heights gently upward, as the design draws them.
 */
export function meterLayout(
  width: number,
  height: number,
  variant: MeterVariant,
  orientation: MeterOrientation,
): MeterLayout {
  'worklet';
  const n = SEGMENT_COUNT;
  const size = readoutSize(variant);
  const band = size > 0 ? Math.round(size * 1.7) : 0;
  const barsHeight = Math.max(0, height - band);
  const gap = variant === 'compact' ? 2 : variant === 'large' ? 4 : 3;
  const r = variant === 'large' ? 3 : 2;
  const segments: SegmentRect[] = [];

  if (orientation === 'horizontal') {
    const w = Math.max(0, (width - gap * (n - 1)) / n);
    for (let i = 0; i < n; i += 1) {
      const ramp = variant === 'card' ? 0.64 + 0.36 * (i / (n - 1)) : 1;
      const h = barsHeight * ramp;
      segments.push({ x: i * (w + gap), y: barsHeight - h, width: w, height: h, r });
    }
  } else {
    const h = Math.max(0, (barsHeight - gap * (n - 1)) / n);
    for (let i = 0; i < n; i += 1) {
      segments.push({ x: 0, y: barsHeight - (i + 1) * h - i * gap, width, height: h, r });
    }
  }

  return {
    segments,
    bars: { x: 0, y: 0, width, height: barsHeight },
    readout: size > 0 ? { x: 0, y: height - Math.round(size * 0.38), size } : null,
    peakThickness: variant === 'large' ? 2.5 : variant === 'card' ? 2 : 1.5,
    glow: variant === 'compact' ? 0 : variant === 'large' ? 6 : 4,
  };
}

/** Peak marker offset along the meter axis for a peak level, in canvas px. */
export function peakOffset(layout: MeterLayout, orientation: MeterOrientation, peak: number): number {
  'worklet';
  const f = levelToFraction(peak);
  if (orientation === 'horizontal') return layout.bars.x + f * layout.bars.width;
  return layout.bars.y + layout.bars.height - f * layout.bars.height;
}
