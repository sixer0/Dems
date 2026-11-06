/**
 * C-1 GlowRing maths (04_mobile_specs §4.0, §7.4 M-C-01; 03_motion_spec M-C-01, App. A):
 * sizes per mode, ring geometry, the bracket-arc layout, the mount sweep schedule and state tones.
 * Pure; the numeric helpers are worklet-safe.
 */
import { motion, palette } from '@dems/shared/tokens';

export type GlowRingMode = 'login' | 'hero' | 'mini';
export type GlowRingState = 'ready' | 'attention' | 'critical' | 'offline' | 'recording';

/** dp ranges per mode (04 §4.0 C-1: login 200–340, hero 280, mini 72–120). */
export const GLOW_RING_SIZE: Record<GlowRingMode, { min: number; max: number; default: number }> = {
  login: { min: 200, max: 340, default: 200 },
  hero: { min: 240, max: 340, default: 280 },
  mini: { min: 72, max: 120, default: 72 },
};

export function resolveRingSize(mode: GlowRingMode, requested?: number): number {
  const range = GLOW_RING_SIZE[mode];
  if (requested === undefined || !Number.isFinite(requested)) return range.default;
  return Math.min(range.max, Math.max(range.min, requested));
}

const tokenAmbient = motion.ambient as Readonly<Record<string, number | undefined>>;
/** 03M §2.3 `ringRotate`; the shared token wins once step 30 publishes it (SCR-07 fallback). */
export const RING_ROTATE_MS = tokenAmbient.ringRotate ?? 60_000;
export const GLOW_BREATH_MS = motion.ambient.glowBreath;
export const REC_PULSE_MS = motion.ambient.recPulse;
export const STATE_MORPH_MS = 600;
export const BREATH_MIN = 0.55;
export const BREATH_MAX = 1;
/** Reduced motion: breathing stops at a static 0.8 (03M M-C-01). */
export const BREATH_STATIC = 0.8;

/** Mount choreography in ms (03M M-C-01 layer table). */
export const RING_SCHEDULE = {
  ticks: { delay: 0, duration: 420 },
  arcs: { delay: 0, stagger: 120, duration: 900 },
  inner: { delay: 200, duration: 1200 },
  centre: { delay: 900, duration: 600 },
} as const;

export function arcDelay(index: number, baseDelay = 0): number {
  return baseDelay + RING_SCHEDULE.arcs.delay + index * RING_SCHEDULE.arcs.stagger;
}

/** Total length of the mount sweep (the "hero moment" lands at this point). */
export function sweepTotalMs(arcCount: number, baseDelay = 0): number {
  const arcsEnd = arcDelay(arcCount - 1, baseDelay) + RING_SCHEDULE.arcs.duration;
  const innerEnd = baseDelay + RING_SCHEDULE.inner.delay + RING_SCHEDULE.inner.duration;
  const centreEnd = baseDelay + RING_SCHEDULE.centre.delay + RING_SCHEDULE.centre.duration;
  return Math.max(arcsEnd, innerEnd, centreEnd);
}

export type ArcTone = 'bright' | 'dim' | 'accent';

/** Arc on the bracket radius, degrees: 0 = 3 o'clock, clockwise (Skia `addArc`). */
export interface ArcSpec {
  start: number;
  sweep: number;
  tone: ArcTone;
}

/**
 * Bracket arcs: bright brackets at 9 and 3 o'clock (03M M-C-01), dim bands at 12 and 6, and two
 * short accent arcs on the diagonals, echoing the segmented band of the AssetSample ring. Listed in
 * sweep order.
 */
export const BRACKET_ARCS: readonly ArcSpec[] = [
  { start: 150, sweep: 60, tone: 'bright' },
  { start: 330, sweep: 60, tone: 'bright' },
  { start: 248, sweep: 44, tone: 'dim' },
  { start: 68, sweep: 44, tone: 'dim' },
  { start: 222, sweep: 10, tone: 'accent' },
  { start: 42, sweep: 10, tone: 'accent' },
];

export interface RingGeometry {
  size: number;
  c: number;
  tickOuter: number;
  tickShort: number;
  tickLong: number;
  tickCount: number;
  bracketRadius: number;
  bracketStroke: number;
  innerRadius: number;
  innerStroke: number;
  glowBlur: number;
}

/** Radii as fractions of the half-size, leaving room at the edge for the outer glow. */
export function ringGeometry(size: number): RingGeometry {
  const c = size / 2;
  return {
    size,
    c,
    tickOuter: 0.94 * c,
    tickShort: 0.905 * c,
    tickLong: 0.875 * c,
    tickCount: 72,
    bracketRadius: 0.8 * c,
    bracketStroke: Math.max(2, 0.06 * c),
    innerRadius: 0.68 * c,
    innerStroke: Math.max(1.5, 0.024 * c),
    glowBlur: Math.max(3, 0.05 * c),
  };
}

export interface TickSegment {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  long: boolean;
}

/** 72 ticks (every 5°), every 6th long (every 30°). */
export function tickSegments(g: RingGeometry): TickSegment[] {
  const out: TickSegment[] = [];
  for (let i = 0; i < g.tickCount; i += 1) {
    const a = (i / g.tickCount) * Math.PI * 2;
    const long = i % 6 === 0;
    const inner = long ? g.tickLong : g.tickShort;
    out.push({
      x1: g.c + Math.cos(a) * inner,
      y1: g.c + Math.sin(a) * inner,
      x2: g.c + Math.cos(a) * g.tickOuter,
      y2: g.c + Math.sin(a) * g.tickOuter,
      long,
    });
  }
  return out;
}

/** Normalised [0, 360) intervals of the arcs; used to prove the arcs never overlap. */
export function arcIntervals(arcs: readonly ArcSpec[]): [number, number][] {
  return arcs
    .map((a): [number, number] => {
      const s = ((a.start % 360) + 360) % 360;
      return [s, s + a.sweep];
    })
    .sort((p, q) => p[0] - q[0]);
}

/** State tone (03M M-C-01 "state morph": gold / amber / red / grey). */
export function ringStateColor(state: GlowRingState): string {
  switch (state) {
    case 'attention':
      return palette.warning;
    case 'critical':
    case 'recording':
      return palette.danger;
    case 'offline':
      return palette.gray;
    default:
      return palette.gold;
  }
}

const SEVERITY: Record<GlowRingState, number> = { ready: 0, recording: 0, offline: 1, attention: 2, critical: 3 };

/** Escalation gets exactly one bloom pulse; de-escalation only a colour change (03M R8). */
export function isEscalation(from: GlowRingState, to: GlowRingState): boolean {
  return SEVERITY[to] > SEVERITY[from];
}

/** Point on a circle at `angleDeg` (0 = 3 o'clock, clockwise). */
export function pointOnCircle(c: number, r: number, angleDeg: number): { x: number; y: number } {
  'worklet';
  const a = (angleDeg * Math.PI) / 180;
  return { x: c + Math.cos(a) * r, y: c + Math.sin(a) * r };
}

/** The inner ring sweeps clockwise from 12 o'clock. */
export const INNER_START_DEG = -90;
