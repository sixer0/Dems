/**
 * Pure view maths for the mobile Network & Time screen (04_mobile_specs §4.14, MB 9). No React and
 * no store access: hooks select flat slices, these helpers shape them. The rules follow the web
 * page model (core-web `features/network-time/model.ts`, implementation/29) so both apps escalate
 * the same way: GNSS → NTP → RTC (design book §2.2; FMEA §23.1), both fallbacks warning (P7).
 *
 * Display time is always UTC+07:00 through the shared arithmetic formatters (`@dems/shared/realtime`,
 * D28/Q2, H-MB-08): no `Intl`, identical on Hermes and Node.
 */
import { DISPLAY_UTC_OFFSET_MINUTES } from '@dems/shared/realtime';
import type { BandwidthPoint, SimState } from '@dems/shared/sim';
import type { StatusTone } from '@dems/shared/tokens';

export type TimeTier = 'GNSS' | 'NTP' | 'RTC';

/** §2.2 priority, first to last (the tier row reads left to right). */
export const TIERS: readonly TimeTier[] = ['GNSS', 'NTP', 'RTC'];

/** LOCKED (GNSS), FALLBACK (trusted NTP), HOLDOVER (free-running RTC). */
export type TimeLevel = 'LOCKED' | 'FALLBACK' | 'HOLDOVER';

export function timeLevel(source: TimeTier): TimeLevel {
  if (source === 'GNSS') return 'LOCKED';
  return source === 'NTP' ? 'FALLBACK' : 'HOLDOVER';
}

const LEVEL_RANK: Record<TimeLevel, number> = { LOCKED: 0, FALLBACK: 1, HOLDOVER: 2 };

/** True when the time service moved DOWN the hierarchy (one escalation pulse, R8). */
export function isTimeEscalation(from: TimeLevel, to: TimeLevel): boolean {
  return LEVEL_RANK[to] > LEVEL_RANK[from];
}

/** Calm escalation (P7): both fallbacks are warnings, as the simulator raises them (web DR-50-1). */
export const TIME_TONE: Record<TimeLevel, StatusTone> = { LOCKED: 'success', FALLBACK: 'warning', HOLDOVER: 'warning' };

export type TierState = 'ACTIVE' | 'STANDBY' | 'LOST' | 'UNREACHABLE';

export const TIER_TONE: Record<TierState, StatusTone> = {
  ACTIVE: 'success',
  STANDBY: 'default',
  LOST: 'danger',
  UNREACHABLE: 'danger',
};

/** The state of one tier. The active tier is always the simulator's `source`. */
export function tierState(
  time: { source: TimeTier; gnssLocked: boolean; ntpReachable: boolean },
  tier: TimeTier,
): TierState {
  if (time.source === tier) return 'ACTIVE';
  if (tier === 'GNSS') return time.gnssLocked ? 'STANDBY' : 'LOST';
  if (tier === 'NTP') return time.ntpReachable ? 'STANDBY' : 'UNREACHABLE';
  return 'STANDBY';
}

export function tierIndex(source: TimeTier): number {
  return Math.max(0, TIERS.indexOf(source));
}

export type LanLevel = 'UP' | 'DOWN';
export type PoeLevel = 'UP' | 'DEGRADED';

export const LAN_TONE: Record<LanLevel, StatusTone> = { UP: 'success', DOWN: 'danger' };
export const POE_TONE: Record<PoeLevel, StatusTone> = { UP: 'success', DEGRADED: 'warning' };

export function lanLevel(linkUp: boolean): LanLevel {
  return linkUp ? 'UP' : 'DOWN';
}

export function poeLevel(activePorts: number, totalPorts: number): PoeLevel {
  return activePorts < totalPorts ? 'DEGRADED' : 'UP';
}

/** MB 9 N2 shows 12 bars. */
export const BANDWIDTH_BARS = 12;

export interface BandwidthWindow {
  /** Exactly `BANDWIDTH_BARS` values, oldest first; 0 pads the left while samples are collected. */
  bars: number[];
  /** Real samples in the window (0…12). */
  samples: number;
  /** The newest sample's down/up rates, or the slice's current values when no sample exists. */
  downMbps: number;
  upMbps: number;
}

/**
 * The bandwidth bars and readout. `endAt` (the D43 test switch) holds the window at a fixed instant
 * (the start of the current minute) so the screen stops changing between minutes; `null` follows
 * the newest sample. The simulator's history starts empty on every boot (SIM-GAP-W50-4), so the bars
 * stream in from the right instead of inventing points.
 */
export function bandwidthWindow(
  history: readonly BandwidthPoint[],
  current: { downMbps: number; upMbps: number },
  endAt: number | null,
): BandwidthWindow {
  let end = history.length;
  if (endAt !== null) {
    while (end > 0 && (history[end - 1]?.at ?? 0) > endAt) end -= 1;
  }
  const window = history.slice(Math.max(0, end - BANDWIDTH_BARS), end);
  const newest = window[window.length - 1];
  const pad = BANDWIDTH_BARS - window.length;
  return {
    bars: [...Array.from({ length: pad }, () => 0), ...window.map((point) => point.downMbps)],
    samples: window.length,
    downMbps: newest?.downMbps ?? current.downMbps,
    upMbps: newest?.upMbps ?? current.upMbps,
  };
}

/** Upper bound of the bar scale: 15% headroom over the largest bar, never below 1 Mbps. */
export function bandwidthScaleMax(bars: readonly number[]): number {
  const max = bars.reduce((acc, value) => (value > acc ? value : acc), 0);
  return Math.max(1, Math.ceil(max * 1.15));
}

/** Seconds of the UTC+07:00 day for an epoch second (the C-6 `clock` format input). */
export function displaySecondsOfDay(epochSecond: number, offsetMinutes: number = DISPLAY_UTC_OFFSET_MINUTES): number {
  const shifted = epochSecond + offsetMinutes * 60;
  return ((shifted % 86_400) + 86_400) % 86_400;
}

/** Under the D43 test switch the clock steps once per minute (uiautomator idle, MA-12). */
export function heldSecond(epochSecond: number, testSwitch: boolean): number {
  return testSwitch ? Math.floor(epochSecond / 60) * 60 : epochSecond;
}

/** Whole seconds since `at` (never negative). */
export function secondsSince(nowSecond: number, at: number): number {
  return Math.max(0, nowSecond - Math.floor(at / 1_000));
}

/** One decimal for Mbps and watts. */
export function fixed1(value: number): string {
  return (Math.round(value * 10) / 10).toFixed(1);
}

/** Flat time view (F74-13): primitives only, so the shallow `useSim` compare holds. */
export interface TimeView {
  source: TimeTier;
  locked: boolean;
  stratum: number;
  lastSyncAt: number;
  gnssLocked: boolean;
  satellites: number;
  ntpServer: string;
  ntpReachable: boolean;
  ntpStratum: number;
}

export function selectTimeView(s: SimState): TimeView {
  const time = s.time;
  return {
    source: time.source,
    locked: time.locked,
    stratum: time.stratum,
    lastSyncAt: time.lastSyncAt,
    gnssLocked: time.gnss.locked,
    satellites: time.gnss.satellites,
    ntpServer: time.ntp.server,
    ntpReachable: time.ntp.reachable,
    ntpStratum: time.ntp.stratum,
  };
}

/** Flat network view (F74-13). */
export interface NetworkView {
  ip: string;
  lanName: string;
  gateway: string;
  linkUp: boolean;
  linkSpeedMbps: number;
  activePorts: number;
  totalPorts: number;
  budgetW: number;
  drawW: number;
  tabletLink: SimState['tabletLink']['state'];
}

export function selectNetworkView(s: SimState): NetworkView {
  const network = s.network;
  return {
    ip: network.ip,
    lanName: network.lanName,
    gateway: network.gateway,
    linkUp: network.linkUp,
    linkSpeedMbps: network.linkSpeedMbps,
    activePorts: network.poe.activePorts,
    totalPorts: network.poe.totalPorts,
    budgetW: network.poe.budgetW,
    drawW: network.poe.drawW,
    tabletLink: s.tabletLink.state,
  };
}
