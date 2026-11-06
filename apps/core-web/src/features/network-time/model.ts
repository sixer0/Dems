/**
 * Pure view maths for the Network & Time page (01_specs §14.5.6; design book §2.2, §21.1, §23.1).
 * No React and no store access: the components select slices, these helpers shape them.
 */
import type { StatusTone } from '@dems/shared/tokens'
import type { BandwidthPoint, SimState, TimeHistoryPoint } from '@dems/shared/sim'
import type { DomainState } from './sim-adapter'

export type TimeTier = 'GNSS' | 'NTP' | 'RTC'
/** §2.2 priority, top to bottom. */
export const TIERS: readonly TimeTier[] = ['GNSS', 'NTP', 'RTC']

/** LOCKED (GNSS), FALLBACK (trusted NTP), HOLDOVER (free-running RTC), FMEA §23.1 "GNSS loss". */
export type TimeLevel = 'LOCKED' | 'FALLBACK' | 'HOLDOVER'

export function timeLevel(source: TimeTier): TimeLevel {
  if (source === 'GNSS') return 'LOCKED'
  return source === 'NTP' ? 'FALLBACK' : 'HOLDOVER'
}

const LEVEL_RANK: Record<TimeLevel, number> = { LOCKED: 0, FALLBACK: 1, HOLDOVER: 2 }

export function isTimeEscalation(from: TimeLevel, to: TimeLevel): boolean {
  return LEVEL_RANK[to] > LEVEL_RANK[from]
}

/** Calm escalation (P7): both fallbacks are warnings, as the simulator raises them. */
export const TIME_TONE: Record<TimeLevel, StatusTone> = { LOCKED: 'success', FALLBACK: 'warning', HOLDOVER: 'warning' }

export type TierState = 'ACTIVE' | 'STANDBY' | 'LOST' | 'UNREACHABLE'

export const TIER_TONE: Record<TierState, StatusTone> = {
  ACTIVE: 'success',
  STANDBY: 'default',
  LOST: 'danger',
  UNREACHABLE: 'danger',
}

/** The state of one tier of the hierarchy. The active tier is always the simulator's `source`. */
export function tierState(time: Pick<SimState['time'], 'source' | 'gnss' | 'ntp'>, tier: TimeTier): TierState {
  if (time.source === tier) return 'ACTIVE'
  if (tier === 'GNSS') return time.gnss.locked ? 'STANDBY' : 'LOST'
  if (tier === 'NTP') return time.ntp.reachable ? 'STANDBY' : 'UNREACHABLE'
  return 'STANDBY'
}

export type NetworkLevel = 'UP' | 'DEGRADED' | 'DOWN'

export const NETWORK_TONE: Record<NetworkLevel, StatusTone> = { UP: 'success', DEGRADED: 'warning', DOWN: 'danger' }

/** LAN link and PoE ports together: the banner's network half. */
export function networkLevel(linkUp: boolean, activePorts: number, totalPorts: number): NetworkLevel {
  if (!linkUp) return 'DOWN'
  return activePorts < totalPorts ? 'DEGRADED' : 'UP'
}

export const DOMAIN_TONE: Record<DomainState, StatusTone> = {
  ACTIVE: 'success',
  DEGRADED: 'warning',
  DOWN: 'danger',
  RESTRICTED: 'default',
  ON_DEMAND: 'default',
  TRANSFER: 'info',
  UPDATING: 'info',
}

/** Signed offset text with one decimal: +3.0, -1.2, 0.0. */
export function formatOffset(ms: number): string {
  const rounded = Math.round(ms * 10) / 10
  if (rounded === 0) return '0.0'
  return `${rounded > 0 ? '+' : '−'}${Math.abs(rounded).toFixed(1)}`
}

/** One decimal, for Mbps and watts. */
export function fixed1(value: number): string {
  return (Math.round(value * 10) / 10).toFixed(1)
}

export interface OffsetPoint {
  at: number
  /** One series per source, null elsewhere, so the line changes colour where the tier changed. */
  GNSS: number | null
  NTP: number | null
  RTC: number | null
  offsetMs: number
  source: TimeTier
}

/**
 * Chart rows for the offset history. Where the source changes, the previous row also carries the
 * new series' value, so the coloured segments meet instead of leaving a gap.
 */
export function offsetSeries(history: readonly TimeHistoryPoint[]): OffsetPoint[] {
  const rows: OffsetPoint[] = history.map((point) => ({
    at: point.at,
    GNSS: point.source === 'GNSS' ? point.offsetMs : null,
    NTP: point.source === 'NTP' ? point.offsetMs : null,
    RTC: point.source === 'RTC' ? point.offsetMs : null,
    offsetMs: point.offsetMs,
    source: point.source,
  }))
  for (let i = 1; i < rows.length; i += 1) {
    const prev = rows[i - 1]
    const row = rows[i]
    if (prev && row && prev.source !== row.source) prev[row.source] = prev.offsetMs
  }
  return rows
}

export interface BandwidthRow {
  at: number
  down: number
  up: number
}

export function bandwidthSeries(history: readonly BandwidthPoint[]): BandwidthRow[] {
  return history.map((point) => ({ at: point.at, down: point.downMbps, up: point.upMbps }))
}

/** 60 second ticks: lit up to and including the current second. */
export function secondTicks(second: number): boolean[] {
  return Array.from({ length: 60 }, (_, i) => i <= second)
}

/** Whole seconds since `at` (never negative). */
export function secondsSince(nowSecond: number, at: number): number {
  return Math.max(0, nowSecond - Math.floor(at / 1_000))
}
