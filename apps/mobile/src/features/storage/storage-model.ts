/**
 * Storage screen model (04_mobile_specs §4.13; web parity with apps/core-web storage `model.ts`,
 * implementation/28 §2). Pure functions only, so the screen test and the model test pin the exact
 * MB 8 numbers: ring 20% USED (D28/Q1), "3.2 TB Free" of 4.0 TB, Used 804 GB, est. remaining
 * 389h 45m at 8.2 GB/h (AC-54, 04 §9 #17).
 */
import {
  GB,
  RECORDING_BYTES_PER_HOUR,
  STORAGE_FULL_PERCENT,
  STORAGE_LOW_PERCENT,
  TB,
  type SimEvent,
} from '@dems/shared/sim';
import type { StorageState } from '@dems/shared/domain';
import { palette, type StatusTone } from '@dems/shared/tokens';

// ── Units (decimal, as the dataset states them: 4.0 TB = 4,000 GB) ─────────────────────────────
export const MB = 1_000_000;

/** 8.2, the GB/h rate the simulator writes at (AC-54). */
export const RATE_GB_PER_HOUR = RECORDING_BYTES_PER_HOUR / GB;

export interface ShortBytes {
  value: string;
  unit: 'TB' | 'GB';
}

/** ≥ 1 TB → `3.2 TB`; ≥ 100 GB → `804 GB`; ≥ 10 GB → `48.1 GB`; else `2.56 GB` (web `shortBytes`). */
export function shortBytes(bytes: number): ShortBytes {
  if (bytes >= TB) return { value: (bytes / TB).toFixed(1), unit: 'TB' };
  const g = bytes / GB;
  if (g >= 100) return { value: g.toFixed(0), unit: 'GB' };
  if (g >= 10) return { value: g.toFixed(1), unit: 'GB' };
  return { value: g.toFixed(2), unit: 'GB' };
}

export function formatShortBytes(bytes: number): string {
  const { value, unit } = shortBytes(bytes);
  return `${value} ${unit}`;
}

/** Whole hours and minutes (`1_403_121_951 ms` → 389 h 45 m). */
export function hoursMinutes(ms: number): { hours: number; minutes: number } {
  const totalMinutes = Math.max(0, Math.floor(ms / 60_000));
  return { hours: Math.floor(totalMinutes / 60), minutes: totalMinutes % 60 };
}

/** MB/s with one decimal (`2_277_778 B/s` → `2.3`). */
export function megabytesPerSecond(bytesPerSec: number): string {
  return (Math.max(0, bytesPerSec) / MB).toFixed(1);
}

// ── Levels and tones (sim thresholds, 04 gap G8) ───────────────────────────────────────────────
export const THRESHOLDS = { low: STORAGE_LOW_PERCENT, full: STORAGE_FULL_PERCENT } as const;

const LEVEL_RANK: Record<StorageState, number> = { READY: 0, LOW: 1, FULL: 2 };

/** True when the state moved to a more severe level (03M R8: escalations pulse once and toast). */
export function isEscalation(previous: StorageState, next: StorageState): boolean {
  return LEVEL_RANK[next] > LEVEL_RANK[previous];
}

/** Ring arc colour: the brand gold while READY, amber at LOW, red at FULL (web parity). */
export const RING_COLOR: Record<StorageState, string> = {
  READY: palette.gold,
  LOW: palette.warning,
  FULL: palette.danger,
};

/** The ring colour mix input: 0 READY, 1 LOW, 2 FULL (`interpolateColor` over RING_COLOR). */
export function ringColorIndex(state: StorageState): number {
  return LEVEL_RANK[state];
}

/** Chip / banner tone per state (01_specs §2.8 StorageStateTone). */
export const LEVEL_TONE: Record<StorageState, StatusTone> = {
  READY: 'success',
  LOW: 'warning',
  FULL: 'danger',
};

// ── Ring geometry ──────────────────────────────────────────────────────────────────────────────
export interface DonutGeometry {
  size: number;
  center: number;
  radius: number;
  stroke: number;
  /** The blurred glow copy: its stroke width and blur sigma. */
  glowWidth: number;
  glowBlur: number;
}

/**
 * A donut inside a `size` box. The glow (a wider, blurred copy of the arc) must fade out inside the
 * box: a Skia canvas clips at its bounds, and a clipped blur shows a hard square edge (seen on
 * dems_phone, F-85-2). So the ring is inset by the glow's reach (half its extra width + 3 sigma).
 */
export function donutGeometry(size: number): DonutGeometry {
  const stroke = Math.max(8, Math.round(size * 0.095));
  const glowWidth = stroke * 1.3;
  const glowBlur = Math.max(3, Math.round(stroke * 0.3));
  const margin = Math.ceil((glowWidth - stroke) / 2 + 3 * glowBlur) + 2;
  return { size, center: size / 2, stroke, radius: size / 2 - stroke / 2 - margin, glowWidth, glowBlur };
}

/** The arc's trim end for a used share (0..1), clamped; a tiny share still shows a sliver. */
export function sweepEnd(usedRatioPercent: number): number {
  if (!Number.isFinite(usedRatioPercent) || usedRatioPercent <= 0) return 0;
  return Math.min(1, Math.max(0.005, usedRatioPercent / 100));
}

// ── Activity rows ──────────────────────────────────────────────────────────────────────────────
export type ActivityTone = 'sealed' | 'info' | 'danger' | 'warning' | 'success' | 'accent';

/** Dot tone per event: sealed violet (D28/Q4), export blue, faults by severity (web parity). */
export function activityTone(event: Pick<SimEvent, 'type' | 'severity'>): ActivityTone {
  if (event.type === 'EVIDENCE_SEALED') return 'sealed';
  if (event.type === 'EVIDENCE_EXPORTED') return 'info';
  if (event.severity === 'CRITICAL') return 'danger';
  if (event.severity === 'WARNING') return 'warning';
  if (event.severity === 'SUCCESS') return 'success';
  return 'accent';
}

export const ACTIVITY_DOT: Record<ActivityTone, string> = {
  sealed: palette.sealed,
  info: palette.info,
  danger: palette.danger,
  warning: palette.warning,
  success: palette.success,
  accent: palette.gold,
};

/** What an activity row says after its title: the evidence id, segment size, policy or session. */
export type ActivityDetail =
  | { kind: 'text'; text: string }
  | { kind: 'segment'; segment: string; sizeGb: string }
  | { kind: 'policy'; days: number; autoArchive: boolean }
  | null;

export function activityDetail(event: Pick<SimEvent, 'type' | 'params' | 'sessionId'>): ActivityDetail {
  const p = event.params;
  if (typeof p.evidenceId === 'string') return { kind: 'text', text: p.evidenceId };
  if (event.type === 'AUTOSAVE' && typeof p.bytesWritten === 'number') {
    return { kind: 'segment', segment: String(p.segment ?? ''), sizeGb: (p.bytesWritten / GB).toFixed(2) };
  }
  if (event.type === 'STORAGE_POLICY_CHANGED' && typeof p.retentionDays === 'number') {
    return { kind: 'policy', days: p.retentionDays, autoArchive: p.autoArchive === true };
  }
  return event.sessionId ? { kind: 'text', text: event.sessionId } : null;
}

/** The fault kind of a FAULT_RAISED / FAULT_CLEARED storage row (only the two storage kinds pass). */
export function storageFaultKind(event: Pick<SimEvent, 'type' | 'params'>): 'STORAGE_LOW' | 'STORAGE_FULL' | null {
  if (event.type !== 'FAULT_RAISED' && event.type !== 'FAULT_CLEARED') return null;
  return event.params.kind === 'STORAGE_FULL' ? 'STORAGE_FULL' : 'STORAGE_LOW';
}
