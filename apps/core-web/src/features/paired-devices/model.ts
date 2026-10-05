/**
 * The pure rules of the Paired Devices page (backend task 04_client_integration_spec §10.3; plan
 * row W81). No React, no request, no clock of its own: every function takes what it decides on.
 *
 * | Rule | Function |
 * |------|----------|
 * | The state of the issue-code panel, from what this page load holds, the Core's status, the registry and the replica | `issuePanelState` |
 * | The newest `PAIRING_CODE_CLOSED` reason of one code in the replica's audit ring | `closedReasonOf` |
 * | The countdown: whole seconds left, `m:ss`, the share of the lifetime left, the tone of the hairline | `secondsLeft`, `formatCountdown`, `lifetimeShare`, `countdownTone` |
 * | The device list: the filter, the order (PAIRED first, then newest `pairedAt`), the header counts | `filterDevices`, `orderDevices`, `deviceSummary` |
 * | "Last seen" as a relative time | `lastSeenParts` |
 */
import type { ActivePairingCode, PairedDevice } from '@dems/shared/api'
import { AuditType, type AuditRow } from '@dems/shared/sim'

/** What this page load knows of the code it issued (the code itself lives in `code-memory.ts`). */
export interface HeldCodeFacts {
  readonly codeId: string
  readonly issuedAt: number
  readonly expiresAt: number
  readonly attemptsAllowed: number
  /** How many answers of operation 16 the cache had taken when the code was held (`dataUpdateCount`). */
  readonly statusCount: number
}

/** How a code of this page load ended, kept after the code itself was dropped. */
export type CodeOutcome =
  | { readonly kind: 'REDEEMED'; readonly codeId: string; readonly deviceId: string; readonly deviceName: string; readonly at: number }
  | { readonly kind: 'EXHAUSTED' | 'CANCELLED_ELSEWHERE'; readonly codeId: string; readonly at: number }

/** Reasons the Core writes into `PAIRING_CODE_CLOSED` (`apps/core-server/src/modules/pairing/codes.ts`, `redeem.ts`). */
export type ClosedReason = 'EXPIRED' | 'EXHAUSTED' | 'CANCELLED'

/** The states of §10.3's issue-code panel (Issuing and Error are the control's, not derived here). */
export const IssuePanelKind = {
  IDLE: 'IDLE',
  ACTIVE_KNOWN: 'ACTIVE_KNOWN',
  ACTIVE_UNKNOWN: 'ACTIVE_UNKNOWN',
  REDEEMED: 'REDEEMED',
  EXPIRED: 'EXPIRED',
  EXHAUSTED: 'EXHAUSTED',
  CANCELLED_ELSEWHERE: 'CANCELLED_ELSEWHERE',
} as const
export type IssuePanelKind = (typeof IssuePanelKind)[keyof typeof IssuePanelKind]

export type IssuePanelState =
  | { readonly kind: typeof IssuePanelKind.IDLE }
  | { readonly kind: typeof IssuePanelKind.ACTIVE_KNOWN; readonly expiresAt: number; readonly issuedAt: number; readonly attemptsRemaining: number }
  | { readonly kind: typeof IssuePanelKind.ACTIVE_UNKNOWN; readonly issuedBy: string; readonly expiresAt: number; readonly issuedAt: number; readonly attemptsRemaining: number }
  | { readonly kind: typeof IssuePanelKind.REDEEMED; readonly deviceId: string; readonly deviceName: string }
  | { readonly kind: typeof IssuePanelKind.EXPIRED }
  | { readonly kind: typeof IssuePanelKind.EXHAUSTED }
  | { readonly kind: typeof IssuePanelKind.CANCELLED_ELSEWHERE }

/** How long the Redeemed state stays before the panel returns to Idle (§10.3: "after 4 s"). */
export const REDEEMED_HOLD_MS = 4_000

export interface IssuePanelInput {
  /** The code this page load issued and still holds, or `null`. */
  readonly held: HeldCodeFacts | null
  /** How the last held code ended, when it was dropped for that reason. */
  readonly outcome: CodeOutcome | null
  /** Operation 16's answer, when one arrived. */
  readonly status: ActivePairingCode | undefined
  /** How many answers of operation 16 the cache has taken (`dataUpdateCount`): newer than `held.statusCount` means read after the issue. */
  readonly statusCount: number
  /** Operation 19's answer, when one arrived. */
  readonly devices: readonly PairedDevice[] | undefined
  /** The newest `PAIRING_CODE_CLOSED` reason of the held code in the replica, or `null`. */
  readonly closedReason: ClosedReason | null
  /** The code this page cancelled itself (its own `CANCELLED` row is no "cancelled elsewhere"). */
  readonly cancelledHere: string | null
  /** The Live clock. */
  readonly now: number
}

/** The status's active code, unless its time is over (the Core answers `active: null` then; a held answer may not know yet). */
function liveActive(status: ActivePairingCode | undefined, now: number): ActivePairingCode['active'] {
  const active = status?.active ?? null
  return active !== null && active.expiresAt > now ? active : null
}

/**
 * The panel's state (§10.3). Precedence for a held code:
 * 1. the registry holds a device paired with it → Redeemed (the code is spent);
 * 2. a status read AFTER the issue reports another active code, issued no earlier than the held one
 *    → Active, code not known (an issue elsewhere replaced it). A status read before the issue (the
 *    previous code, still in the cache) proves nothing and is passed over;
 * 3. the replica's newest `PAIRING_CODE_CLOSED` of it → Expired, Closed (exhausted), Cancelled
 *    elsewhere, or Idle when this page cancelled it;
 * 4. its time is over on the Live clock → Expired;
 * 5. otherwise → Active, code known (attempts from the status when it is about this code).
 * Without a held code: a recent Redeemed outcome, then the status (unless it still names the code
 * whose end this page knows: the answer is older than that end), then an outcome that is kept.
 */
export function issuePanelState(input: IssuePanelInput): IssuePanelState {
  const { held, outcome, status, statusCount, devices, closedReason, cancelledHere, now } = input
  const active = liveActive(status, now)
  if (held !== null) {
    const device = devices?.find((entry) => entry.pairedWithCodeId === held.codeId)
    if (device !== undefined) return { kind: IssuePanelKind.REDEEMED, deviceId: device.id, deviceName: device.name }
    if (active !== null && active.codeId !== held.codeId && statusCount > held.statusCount && active.issuedAt >= held.issuedAt) {
      return { kind: IssuePanelKind.ACTIVE_UNKNOWN, issuedBy: active.issuedBy, expiresAt: active.expiresAt, issuedAt: active.issuedAt, attemptsRemaining: active.attemptsRemaining }
    }
    if (closedReason === 'EXPIRED') return { kind: IssuePanelKind.EXPIRED }
    if (closedReason === 'EXHAUSTED') return { kind: IssuePanelKind.EXHAUSTED }
    if (closedReason === 'CANCELLED') return cancelledHere === held.codeId ? { kind: IssuePanelKind.IDLE } : { kind: IssuePanelKind.CANCELLED_ELSEWHERE }
    if (now >= held.expiresAt) return { kind: IssuePanelKind.EXPIRED }
    const attemptsRemaining = active !== null && active.codeId === held.codeId ? active.attemptsRemaining : held.attemptsAllowed
    return { kind: IssuePanelKind.ACTIVE_KNOWN, expiresAt: held.expiresAt, issuedAt: held.issuedAt, attemptsRemaining }
  }
  if (outcome !== null && outcome.kind === 'REDEEMED' && now - outcome.at < REDEEMED_HOLD_MS) {
    return { kind: IssuePanelKind.REDEEMED, deviceId: outcome.deviceId, deviceName: outcome.deviceName }
  }
  const endedHere = active !== null && (outcome?.codeId === active.codeId || cancelledHere === active.codeId)
  if (active !== null && !endedHere) {
    return { kind: IssuePanelKind.ACTIVE_UNKNOWN, issuedBy: active.issuedBy, expiresAt: active.expiresAt, issuedAt: active.issuedAt, attemptsRemaining: active.attemptsRemaining }
  }
  if (outcome !== null && outcome.kind === 'EXHAUSTED') return { kind: IssuePanelKind.EXHAUSTED }
  if (outcome !== null && outcome.kind === 'CANCELLED_ELSEWHERE') return { kind: IssuePanelKind.CANCELLED_ELSEWHERE }
  return { kind: IssuePanelKind.IDLE }
}

const CLOSED_REASONS: readonly ClosedReason[] = ['EXPIRED', 'EXHAUSTED', 'CANCELLED']

/** The reason of the newest `PAIRING_CODE_CLOSED` row of `codeId` in the replica's audit ring, or `null`. */
export function closedReasonOf(rows: readonly AuditRow[], codeId: string | null): ClosedReason | null {
  if (codeId === null) return null
  for (let index = rows.length - 1; index >= 0; index -= 1) {
    const row = rows[index]
    if (row === undefined || row.type !== AuditType.PAIRING_CODE_CLOSED || row.details?.codeId !== codeId) continue
    const reason = row.details.reason
    return typeof reason === 'string' && (CLOSED_REASONS as readonly string[]).includes(reason) ? (reason as ClosedReason) : null
  }
  return null
}

/** Whole seconds until `expiresAt` (never below 0), rounded up: the countdown shows 0:00 only at the instant itself. */
export function secondsLeft(expiresAt: number, now: number): number {
  return Math.max(0, Math.ceil((expiresAt - now) / 1000))
}

/** `m:ss`. */
export function formatCountdown(seconds: number): string {
  const whole = Math.max(0, Math.floor(seconds))
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`
}

/** The share of the code's lifetime that is left, 0 to 1 (the hairline's `scaleX`). */
export function lifetimeShare(issuedAt: number, expiresAt: number, now: number): number {
  const lifetime = expiresAt - issuedAt
  if (lifetime <= 0) return 0
  return Math.min(1, Math.max(0, (expiresAt - now) / lifetime))
}

/** The hairline's tone: gold, amber from 60 s, red from 15 s (§10.3). */
export type CountdownTone = 'gold' | 'amber' | 'red'
export const AMBER_FROM_S = 60
export const RED_FROM_S = 15
export function countdownTone(seconds: number): CountdownTone {
  if (seconds <= RED_FROM_S) return 'red'
  if (seconds <= AMBER_FROM_S) return 'amber'
  return 'gold'
}

/** The list filter of §10.3. */
export const DeviceFilter = { ALL: 'ALL', PAIRED: 'PAIRED', ENDED: 'ENDED' } as const
export type DeviceFilter = (typeof DeviceFilter)[keyof typeof DeviceFilter]
export const DEVICE_FILTERS: readonly DeviceFilter[] = [DeviceFilter.ALL, DeviceFilter.PAIRED, DeviceFilter.ENDED]

export function filterDevices(devices: readonly PairedDevice[], filter: DeviceFilter): PairedDevice[] {
  if (filter === DeviceFilter.PAIRED) return devices.filter((device) => device.state === 'PAIRED')
  if (filter === DeviceFilter.ENDED) return devices.filter((device) => device.state !== 'PAIRED')
  return [...devices]
}

/** PAIRED first, then by `pairedAt`, newest first; the ID breaks a tie so the order is stable. */
export function orderDevices(devices: readonly PairedDevice[]): PairedDevice[] {
  return [...devices].sort((a, b) => {
    const paired = Number(b.state === 'PAIRED') - Number(a.state === 'PAIRED')
    if (paired !== 0) return paired
    if (b.pairedAt !== a.pairedAt) return b.pairedAt - a.pairedAt
    return a.id.localeCompare(b.id)
  })
}

/** The header chip: PAIRED devices, and of them the online ones (the drawer counts the same way). */
export function deviceSummary(devices: readonly PairedDevice[]): { paired: number; online: number } {
  const paired = devices.filter((device) => device.state === 'PAIRED')
  return { paired: paired.length, online: paired.filter((device) => device.online).length }
}

/** "Last seen" as one relative unit: under a minute, minutes, hours, days. */
export type LastSeenParts = { readonly unit: 'justNow' } | { readonly unit: 'minutes' | 'hours' | 'days'; readonly count: number }
export function lastSeenParts(lastSeenAt: number, now: number): LastSeenParts {
  const minutes = Math.floor(Math.max(0, now - lastSeenAt) / 60_000)
  if (minutes < 1) return { unit: 'justNow' }
  if (minutes < 60) return { unit: 'minutes', count: minutes }
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return { unit: 'hours', count: hours }
  return { unit: 'days', count: Math.floor(hours / 24) }
}

/** "Last seen" refreshes every 30 s, without animation (§10.3). */
export const LAST_SEEN_REFRESH_MS = 30_000
