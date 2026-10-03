/**
 * Storage page model (masterplan/01_specs.md §14.5.5; research/04 §5.3; research/01_explore §10).
 * Pure functions only: unit formatting, the design-book §10.2 retention formula, and the chart and
 * list view models. Everything here is deterministic, so the page test and the model test can pin
 * the exact numbers (AC-54, AC-75).
 */
import {
  GB,
  STORAGE_FULL_PERCENT,
  STORAGE_LOW_PERCENT,
  TB,
  wibDateParts,
  type EpochMs,
  type StorageHistoryPoint,
} from '@dems/shared/sim'
import type { StatusTone } from '@dems/shared/tokens'

// ── Units (decimal, as the dataset states them: 4.0 TB = 4,000 GB) ──────────────────────────
export const MB = 1_000_000

/** `3.196e12` → `"3.2"` (one decimal, the D1/MB 8 "3.2 TB" figure). */
export function tb(bytes: number, digits = 1): number {
  return round(bytes / TB, digits)
}

export function gb(bytes: number, digits = 1): number {
  return round(bytes / GB, digits)
}

export function round(value: number, digits: number): number {
  const factor = 10 ** digits
  return Math.round(value * factor) / factor
}

export function fixed(value: number, digits: number): string {
  return value.toFixed(digits)
}

/** Short capacity text: ≥ 1 TB → `3.2 TB`; ≥ 100 GB → `804 GB`; ≥ 10 GB → `48.1 GB`; else `2.56 GB`. */
export function shortBytes(bytes: number): { value: string; unit: 'TB' | 'GB' } {
  if (bytes >= TB) return { value: fixed(bytes / TB, 1), unit: 'TB' }
  const g = bytes / GB
  if (g >= 100) return { value: fixed(g, 0), unit: 'GB' }
  if (g >= 10) return { value: fixed(g, 1), unit: 'GB' }
  return { value: fixed(g, 2), unit: 'GB' }
}

export function formatShortBytes(bytes: number): string {
  const { value, unit } = shortBytes(bytes)
  return `${value} ${unit}`
}

/** Whole hours and minutes of a duration (`1_403_121_951 ms` → `{ hours: 389, minutes: 45 }`). */
export function hoursMinutes(ms: number): { hours: number; minutes: number } {
  const totalMinutes = Math.max(0, Math.floor(ms / 60_000))
  return { hours: Math.floor(totalMinutes / 60), minutes: totalMinutes % 60 }
}

function pad(value: number): string {
  return String(value).padStart(2, '0')
}

/** `HH:mm` at UTC+07:00 (D28/Q2). */
export function wibHm(at: EpochMs): string {
  const p = wibDateParts(at)
  return `${pad(p.hour)}:${pad(p.minute)}`
}

// ── Storage state and thresholds (sim constants, 04 gap G8) ────────────────────────────────
export type StorageLevel = 'READY' | 'LOW' | 'FULL'

export const STORAGE_LEVEL_RANK: Record<StorageLevel, number> = { READY: 0, LOW: 1, FULL: 2 }

/** Ring and bar tone per state: gold while READY (the brand ring), amber LOW, red FULL. */
export const STORAGE_LEVEL_TONE: Record<StorageLevel, StatusTone> = {
  READY: 'accent',
  LOW: 'warning',
  FULL: 'danger',
}

/** Chip tone per state (01_specs §2.8 StorageStateTone: READY success). */
export const STORAGE_CHIP_TONE: Record<StorageLevel, StatusTone> = {
  READY: 'success',
  LOW: 'warning',
  FULL: 'danger',
}

export const THRESHOLDS = { low: STORAGE_LOW_PERCENT, full: STORAGE_FULL_PERCENT } as const

/** True when the state moved to a more severe level (R8: escalations pulse once and toast). */
export function isEscalation(previous: StorageLevel, next: StorageLevel): boolean {
  return STORAGE_LEVEL_RANK[next] > STORAGE_LEVEL_RANK[previous]
}

// ── ProgressCircle geometry (the kit's 36-unit viewBox, stroke 4) ───────────────────────────
export const RING_CENTER = 18
export const RING_RADIUS = 16
export const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS

/** Dash offset that shows `percent` of the ring (0 → empty, 100 → full). */
export function ringDashOffset(percent: number): number {
  const clamped = Math.min(100, Math.max(0, percent))
  return RING_CIRCUMFERENCE - (clamped / 100) * RING_CIRCUMFERENCE
}

/** A tick on the ring at `percent`, clockwise from 12 o'clock, between radii `r1` and `r2`. */
export function ringTick(percent: number, r1: number, r2: number) {
  const angle = (percent / 100) * 2 * Math.PI - Math.PI / 2
  const cos = Math.cos(angle)
  const sin = Math.sin(angle)
  return {
    x1: round(RING_CENTER + r1 * cos, 3),
    y1: round(RING_CENTER + r1 * sin, 3),
    x2: round(RING_CENTER + r2 * cos, 3),
    y2: round(RING_CENTER + r2 * sin, 3),
  }
}

// ── Retention calculator (design book §10.2; example §10.3) ────────────────────────────────
/** §10.3 example: two 8 Mbps video streams. */
export const BOOK_VIDEO_MBPS = 8
export const CAMERA_COUNT = 2
/** §10.3 audio: 24 bit × 48,000 Hz × 2 mono channels = 2.304 Mbps ("approximately 2.3 Mbps"). */
export const AUDIO_MBPS = (24 * 48_000 * 2) / 1_000_000

/**
 * Demo defaults for the two values the book leaves open (assumption A-49-1): 4 recording hours
 * per day and a 10% overhead for manifests, hashes, signatures and filesystem slack.
 */
export const DEFAULT_HOURS_PER_DAY = 4
export const DEFAULT_OVERHEAD = 1.1

export const CALCULATOR_LIMITS = {
  videoMbps: { min: 1, max: 20, step: 0.5 },
  hoursPerDay: { min: 1, max: 24, step: 0.5 },
  retentionDays: { min: 7, max: 365, step: 1, fieldMax: 3_650 },
  overhead: { min: 1, max: 1.5, step: 0.05 },
} as const

export interface RetentionInputs {
  videoMbps: number
  hoursPerDay: number
  retentionDays: number
  overhead: number
}

export interface RetentionResult {
  totalMbps: number
  gbPerHour: number
  dailyGb: number
  requiredGb: number
  capacityGb: number
  freeGb: number
  /** Required ÷ capacity, in percent (may exceed 100). */
  requiredPercent: number
  /** Recording hours the free space holds at this bitrate. */
  hoursLeft: number
  /** Calendar days until full at this duty cycle. */
  daysUntilFull: number
  /** Retention days the whole evidence volume covers, overhead included. */
  coverageDays: number
  /** TB above capacity (0 when it fits). */
  excessTb: number
  tone: StatusTone
}

/**
 * `Daily_GB = ((Video1 + Video2 + Audio1 + Audio2) / 8) × 3600 × Hours / 1000` and
 * `Required = Daily_GB × Retention_Days × Overhead` (01_explore §10.2, quoted from the book).
 */
export function retentionMath(inputs: RetentionInputs, capacityBytes: number, freeBytes: number): RetentionResult {
  const totalMbps = inputs.videoMbps * CAMERA_COUNT + AUDIO_MBPS
  const gbPerHour = ((totalMbps / 8) * 3_600) / 1_000
  const dailyGb = gbPerHour * inputs.hoursPerDay
  const requiredGb = dailyGb * inputs.retentionDays * inputs.overhead
  const capacityGb = capacityBytes / GB
  const freeGb = freeBytes / GB
  const requiredPercent = capacityGb > 0 ? (requiredGb / capacityGb) * 100 : 0
  const hoursLeft = gbPerHour > 0 ? freeGb / gbPerHour : 0
  const daysUntilFull = dailyGb > 0 ? freeGb / dailyGb : 0
  const coverageDays = dailyGb > 0 ? capacityGb / (dailyGb * inputs.overhead) : 0
  const excessTb = Math.max(0, (requiredGb - capacityGb) / 1_000)
  const tone: StatusTone =
    requiredPercent > 100 ? 'danger' : requiredPercent >= STORAGE_LOW_PERCENT ? 'warning' : 'success'
  return {
    totalMbps,
    gbPerHour,
    dailyGb,
    requiredGb,
    capacityGb,
    freeGb,
    requiredPercent,
    hoursLeft,
    daysUntilFull,
    coverageDays,
    excessTb,
    tone,
  }
}

export function clampInput(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min
  return Math.min(max, Math.max(min, value))
}

// ── Chart view models ──────────────────────────────────────────────────────────────────────
export interface UsagePoint {
  at: EpochMs
  label: string
  usedGb: number
  /** GB written since the first point of the window (the area; honest zero baseline). */
  writtenGb: number
}

export function usageSeries(history: readonly StorageHistoryPoint[]): UsagePoint[] {
  const first = history[0]
  if (!first) return []
  return history.map((point) => ({
    at: point.at,
    label: wibHm(point.at),
    usedGb: round(point.usedBytes / GB, 1),
    writtenGb: round(Math.max(0, point.usedBytes - first.usedBytes) / GB, 1),
  }))
}

export interface HourBucket {
  hour: number
  label: string
  count: number
  current: boolean
}

export function hourlyBuckets(counts: readonly number[], nowAt: EpochMs): HourBucket[] {
  const currentHour = wibDateParts(nowAt).hour
  return counts.map((count, hour) => ({ hour, label: pad(hour), count, current: hour === currentHour }))
}

/** `08` → `08:00` and `09:00` (tooltip range). */
export function hourRange(hour: number): { from: string; to: string } {
  return { from: `${pad(hour)}:00`, to: `${pad((hour + 1) % 24)}:00` }
}
