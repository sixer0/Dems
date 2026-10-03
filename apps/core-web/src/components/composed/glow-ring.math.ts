/**
 * Pure maths of the SYSTEM READY ring (01_specs §14.6 GlowRing; 03_motion_spec M-C-01;
 * research/04 §3.1 A: an outer tick ring, two bright bracket arcs at 9 and 3 o'clock, an inner
 * solid ring and a centre).
 */
import { palette, toneHex } from '@dems/shared/tokens'
import type { GlowTone } from '@/motion'

export type GlowRingState = 'READY' | 'ATTENTION' | 'CRITICAL' | 'UNKNOWN' | 'RECORDING'
export type GlowRingMode = 'hero' | 'mini' | 'login'

/** SVG user space: a 200 × 200 box centred on (100, 100). */
export const RING_VIEWBOX = 200
export const RING_CENTER = 100
export const RING_RADII = { ticks: 95, bracket: 86, track: 86, inner: 74 } as const
export const TICK_COUNT = 72
/** Every 6th tick (30°) is long. */
export const LONG_TICK_EVERY = 6

/** Typical rendered sizes per mode (M-C-01): hero ≈320, login ≈340, mini ≈120. */
export const RING_MODE_SIZE: Record<GlowRingMode, number> = { hero: 320, login: 340, mini: 120 }

export interface RingColours {
  /** Ticks, track and inner ring (`--ring-color`). */
  ring: string
  /** Bracket arcs (`--ring-arc-color`); red while recording. */
  arc: string
  /** GlowLayer tone for the escalation bloom. */
  tone: GlowTone
}

export const RING_COLOURS: Record<GlowRingState, RingColours> = {
  READY: { ring: palette.gold, arc: palette.gold, tone: 'brand' },
  RECORDING: { ring: palette.gold, arc: toneHex.danger, tone: 'danger' },
  ATTENTION: { ring: toneHex.warning, arc: toneHex.warning, tone: 'warning' },
  CRITICAL: { ring: toneHex.danger, arc: toneHex.danger, tone: 'danger' },
  UNKNOWN: { ring: palette.gray, arc: palette.gray, tone: 'brand' },
}

/** Severity rank for R8: a rise (READY → ATTENTION → CRITICAL) is an escalation. */
export function stateRank(state: GlowRingState): number {
  if (state === 'CRITICAL') return 2
  if (state === 'ATTENTION') return 1
  return 0
}

export function isEscalation(from: GlowRingState, to: GlowRingState): boolean {
  return stateRank(to) > stateRank(from)
}

/** Polar → SVG point; angle in degrees, 0° = 3 o'clock, clockwise (SVG y points down). */
export function polar(radius: number, angleDeg: number): { x: number; y: number } {
  const a = (angleDeg * Math.PI) / 180
  return { x: RING_CENTER + radius * Math.cos(a), y: RING_CENTER + radius * Math.sin(a) }
}

/** An SVG arc path from `startDeg` to `endDeg` (clockwise) at `radius`. */
export function arcPath(radius: number, startDeg: number, endDeg: number): string {
  const start = polar(radius, startDeg)
  const end = polar(radius, endDeg)
  const sweep = ((endDeg - startDeg) % 360 + 360) % 360
  const large = sweep > 180 ? 1 : 0
  const f = (n: number) => Number(n.toFixed(3))
  return `M${f(start.x)} ${f(start.y)}A${radius} ${radius} 0 ${large} 1 ${f(end.x)} ${f(end.y)}`
}

/** A full circle as two arcs (so `pathLength` draws it from the top, clockwise). */
export function circlePath(radius: number): string {
  const top = polar(radius, -90)
  const bottom = polar(radius, 90)
  return `M${top.x} ${top.y}A${radius} ${radius} 0 1 1 ${bottom.x} ${bottom.y}A${radius} ${radius} 0 1 1 ${top.x} ${top.y}`
}

/** The two bracket arcs: 60° each, centred on 3 o'clock (0°) and 9 o'clock (180°). */
export const BRACKET_ARCS = [
  { id: 'right', start: -30, end: 30 },
  { id: 'left', start: 150, end: 210 },
] as const

/** Tick segments of the outer ring, as `[x1, y1, x2, y2]`. */
export function tickLines(): Array<{ long: boolean; line: [number, number, number, number] }> {
  const out: Array<{ long: boolean; line: [number, number, number, number] }> = []
  for (let i = 0; i < TICK_COUNT; i += 1) {
    const long = i % LONG_TICK_EVERY === 0
    const angle = (360 / TICK_COUNT) * i
    const outer = polar(RING_RADII.ticks, angle)
    const inner = polar(RING_RADII.ticks - (long ? 7 : 3.5), angle)
    const f = (n: number) => Number(n.toFixed(3))
    out.push({ long, line: [f(inner.x), f(inner.y), f(outer.x), f(outer.y)] })
  }
  return out
}
