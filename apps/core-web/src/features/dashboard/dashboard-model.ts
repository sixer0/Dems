/**
 * Dashboard view model (step 42; 01_specs §14.5.1; research/04 §3.1; 03_motion_spec §7).
 *
 * Pure functions that turn simulator slices into what the panels show: tones, units, the
 * Active Session variant, event rows grouped by day, the hourly chart data and the quick
 * actions with their RBAC rule. No React and no i18next here, so every rule is unit-tested
 * without rendering (`__tests__/dashboard-model.test.tsx`).
 */
import type { LucideIcon } from 'lucide-react'
import { FileText, Settings, Stethoscope, Upload } from 'lucide-react'
import { SessionState } from '@dems/shared/domain'
import { DATE_PATTERNS, formatDate } from '@dems/shared/realtime'
import {
  OperatorRole,
  Permission,
  ROLE_PERMISSIONS,
  type ActiveSession,
  type DeviceStats,
  type MicStatus,
  type SimEvent,
  type SimState,
  type StorageSummary,
} from '@dems/shared/sim'
import { StorageStateTone, type StatusTone } from '@dems/shared/tokens'

// ── Units ───────────────────────────────────────────────────────────────────────────────────
/** Decimal units, as the simulator sizes its volumes (4.0 TB = 4 × 10¹² bytes). */
export const TB_BYTES = 1e12
export const GB_BYTES = 1e9

/** One decimal, rounded half up: 3.196 × 10¹² bytes → 3.2. */
export function toTb(bytes: number): number {
  return Math.round((bytes / TB_BYTES) * 10) / 10
}

/** Whole gigabytes: 804 × 10⁹ bytes → 804. */
export function toGb(bytes: number): number {
  return Math.round(bytes / GB_BYTES)
}

/** "3.2" (always one decimal, tabular). */
export function formatOneDecimal(value: number): string {
  return (Math.round(value * 10) / 10).toFixed(1)
}

// ── Status strip (panel C) ──────────────────────────────────────────────────────────────────
export type StripCellId = 'cameras' | 'mics' | 'storage' | 'time' | 'security' | 'network'

/** Every cell links to the page that explains it (research/04 §3.1 C). */
export const STRIP_CELL_ROUTES = {
  cameras: '/devices',
  mics: '/devices',
  storage: '/storage',
  time: '/network-time',
  security: '/security-audit',
  network: '/network-time',
} as const satisfies Record<StripCellId, string>

export function cameraTone(stats: Pick<DeviceStats, 'camerasOnline' | 'camerasTotal'>): StatusTone {
  if (stats.camerasTotal === 0) return 'default'
  return stats.camerasOnline < stats.camerasTotal ? 'danger' : 'success'
}

export type MicSummary = 'ready' | 'noSignal' | 'clip'

/** The worst microphone condition: a CLIP latch beats NO SIGNAL (MicStateTone: danger > warning). */
export function micSummary(mics: readonly Pick<MicStatus, 'state' | 'clipLatched'>[]): MicSummary {
  if (mics.some((mic) => mic.state === 'CLIP' || mic.clipLatched)) return 'clip'
  if (mics.some((mic) => mic.state === 'NO_SIGNAL')) return 'noSignal'
  return 'ready'
}

export const MIC_SUMMARY_TONE = { ready: 'success', noSignal: 'warning', clip: 'danger' } as const satisfies Record<
  MicSummary,
  StatusTone
>

export function storageTone(state: StorageSummary['state']): StatusTone {
  return StorageStateTone[state]
}

export type TimeSourceName = SimState['time']['source']

/** GNSS locked is the only "synchronized" state; the fallbacks warn (systemStatus TIME_FALLBACK). */
export function timeTone(source: TimeSourceName, locked: boolean): StatusTone {
  return source === 'GNSS' && locked ? 'success' : 'warning'
}

export type PostureName = SimState['security']['posture']

export const POSTURE_TONE = {
  SECURE: 'success',
  ATTENTION: 'warning',
  CRITICAL: 'danger',
  UNKNOWN: 'default',
} as const satisfies Record<PostureName, StatusTone>

export function networkTone(linkUp: boolean): StatusTone {
  return linkUp ? 'success' : 'danger'
}

/** Tone → the Tailwind classes of a status dot (the DS "status LED": filled dot with a halo). */
export const DOT_CLASS = {
  accent: 'bg-accent shadow-[0_0_6px_rgb(255_200_107/0.7)]',
  default: 'bg-muted',
  success: 'bg-success shadow-[0_0_6px_rgb(34_197_94/0.7)]',
  warning: 'bg-warning shadow-[0_0_6px_rgb(245_158_11/0.7)]',
  danger: 'bg-danger shadow-[0_0_6px_rgb(239_68_68/0.7)]',
  info: 'bg-info shadow-[0_0_6px_rgb(59_130_246/0.7)]',
  sealed: 'bg-sealed shadow-[0_0_6px_rgb(139_92_246/0.7)]',
} as const satisfies Record<StatusTone, string>

/** Tone → value text colour (AA 400-step text colours, 01_specs §2.7). */
export const TONE_TEXT_CLASS = {
  accent: 'text-accent',
  default: 'text-muted',
  success: 'text-success-soft-foreground',
  warning: 'text-warning-soft-foreground',
  danger: 'text-danger-soft-foreground',
  info: 'text-info-text',
  sealed: 'text-sealed-text',
} as const satisfies Record<StatusTone, string>

const TONE_RANK: Record<StatusTone, number> = {
  success: 0,
  accent: 0,
  info: 0,
  sealed: 0,
  default: 1,
  warning: 2,
  danger: 3,
}

/** Severity rank of a tone: success/accent/info/sealed 0, default 1, warning 2, danger 3. */
export function toneRank(tone: StatusTone): number {
  return TONE_RANK[tone]
}

/** The worst of several tones (header summaries). */
export function worstTone(tones: readonly StatusTone[]): StatusTone {
  return tones.reduce<StatusTone>((worst, tone) => (TONE_RANK[tone] > TONE_RANK[worst] ? tone : worst), 'success')
}

/** Tone → HeroUI Chip colour (info and sealed have no kit colour; not used by these chips). */
export function chipColor(tone: StatusTone): 'success' | 'warning' | 'danger' | 'default' | 'accent' {
  if (tone === 'info' || tone === 'sealed') return 'default'
  return tone
}

// ── Security, Time & Network (panel G) ──────────────────────────────────────────────────────
export interface SecurityColumns {
  tpm: StatusTone
  time: StatusTone
  network: StatusTone
  posture: StatusTone
}

export function securityColumns(input: {
  tpmOk: boolean
  secureBoot: boolean
  timeSource: TimeSourceName
  timeLocked: boolean
  linkUp: boolean
  posture: PostureName
}): SecurityColumns {
  return {
    tpm: input.tpmOk && input.secureBoot ? 'success' : 'danger',
    time: timeTone(input.timeSource, input.timeLocked),
    network: networkTone(input.linkUp),
    posture: POSTURE_TONE[input.posture],
  }
}

/** Header summary: all secure, N items needing attention, or N critical items. */
export function securityHeader(columns: SecurityColumns): { tone: StatusTone; attention: number; critical: number } {
  const tones = Object.values(columns)
  const critical = tones.filter((tone) => tone === 'danger').length
  const attention = tones.filter((tone) => tone === 'warning' || tone === 'default').length
  return { tone: worstTone(tones), attention, critical }
}

// ── Active Session (panel D) ────────────────────────────────────────────────────────────────
export type SessionPanelKind = 'idle' | 'setup' | 'recording' | 'finalizing' | 'sealed' | 'fault' | 'recovery'

/** Which variant of panel D a session state shows (research/04 §3.1 D, 03_motion_spec §7). */
export function sessionPanelKind(state: SessionState | null): SessionPanelKind {
  switch (state) {
    case null:
      return 'idle'
    case SessionState.CREATE:
    case SessionState.PRECHECK:
    case SessionState.ARMED:
      return 'setup'
    case SessionState.RECORDING:
      return 'recording'
    case SessionState.STOPPING:
    case SessionState.FINALIZING:
      return 'finalizing'
    case SessionState.SEALED:
      return 'sealed'
    case SessionState.FAULT:
      return 'fault'
    case SessionState.RECOVERY:
      return 'recovery'
    default:
      return 'idle'
  }
}

/** Pre-check progress: resolved items of all items (Start Session step 2). */
export function precheckProgress(session: Pick<ActiveSession, 'precheck'>): { done: number; total: number } {
  const items = session.precheck.items
  const done = items.filter((item) => item.status !== 'PENDING' && item.status !== 'RUNNING').length
  return { done, total: items.length }
}

/** Finalization progress: the 1-based active (or last done) step of the six (M-C-09). */
export function finalizationProgress(session: Pick<ActiveSession, 'finalization'>): { current: number; total: number } {
  const steps = session.finalization.steps
  const total = steps.length
  const active = steps.findIndex((step) => step.status === 'active')
  if (active >= 0) return { current: active + 1, total }
  const done = steps.filter((step) => step.status === 'done').length
  return { current: Math.max(1, Math.min(total, done)), total }
}

/** `/session/new?step=` for "Continue setup": the step that matches the current state. */
export function setupStepFor(state: SessionState): 1 | 2 | 3 {
  if (state === SessionState.ARMED) return 3
  if (state === SessionState.PRECHECK) return 2
  return 1
}

// ── Recent Events (panel I) ─────────────────────────────────────────────────────────────────
export const EVENT_TONE = {
  SUCCESS: 'success',
  INFO: 'accent',
  WARNING: 'warning',
  CRITICAL: 'danger',
} as const satisfies Record<SimEvent['severity'], StatusTone>

export interface EventGroup {
  /** `YYYY-MM-DD` at UTC+07:00. */
  dayKey: string
  /** `today`, `yesterday`, or a date to print ("30 Sep 2026"). */
  label: { kind: 'today' | 'yesterday' } | { kind: 'date'; text: string }
  events: SimEvent[]
}

const DAY_MS = 86_400_000

/**
 * Newest-first events grouped by their UTC+07:00 day (research/04 §9 #34: the mockup repeats the
 * date on every row). Order is kept inside each group.
 */
export function groupEventsByDay(events: readonly SimEvent[], nowMs: number): EventGroup[] {
  const today = formatDate(nowMs, DATE_PATTERNS.dayKey)
  const yesterday = formatDate(nowMs - DAY_MS, DATE_PATTERNS.dayKey)
  const groups: EventGroup[] = []
  for (const event of events) {
    const dayKey = formatDate(event.at, DATE_PATTERNS.dayKey)
    let group = groups[groups.length - 1]
    if (!group || group.dayKey !== dayKey) {
      const label: EventGroup['label'] =
        dayKey === today
          ? { kind: 'today' }
          : dayKey === yesterday
            ? { kind: 'yesterday' }
            : { kind: 'date', text: formatDate(event.at, DATE_PATTERNS.date) }
      group = { dayKey, label, events: [] }
      groups.push(group)
    }
    group.events.push(event)
  }
  return groups
}

/**
 * WHAT AN ACCEPTED START CAME TO (wave H closing pass Z2, finding G75-11). The event
 * `RECORDING_STARTED` is written when the Core accepts the start - before any camera is connected in
 * the Core's own capture - and it is the contract's only type, so it stays in the slice. The row is
 * worded by the state of its session:
 *
 *   FAILED      the open session is a failed start (FAULT, or its RECOVERY, with `captureDurable:
 *               false`: the capture ended before a durable fragment), or the session is closed and
 *               its history entry has no start time (`startedAt: null`, the failed start's entry)
 *   CONNECTING  the open session records but has no durable fragment yet
 *   STARTED     anything else, and an event that names no session or one this console knows nothing of
 */
export type RecordingStartOutcome = 'STARTED' | 'CONNECTING' | 'FAILED'

export function recordingStartOutcome(state: Pick<SimState, 'session' | 'sessionHistory'>, sessionId: string | null): RecordingStartOutcome {
  if (sessionId === null) return 'STARTED'
  const session = state.session
  if (session !== null && session.id === sessionId) {
    if (session.captureDurable !== false) return 'STARTED'
    if (session.state === SessionState.RECORDING) return 'CONNECTING'
    return session.state === SessionState.FAULT || session.state === SessionState.RECOVERY ? 'FAILED' : 'STARTED'
  }
  const entry = state.sessionHistory.find((item) => item.id === sessionId)
  return entry !== undefined && entry.startedAt === null ? 'FAILED' : 'STARTED'
}

/**
 * The detail column of an event row: the evidence or session it concerns, the operator, the
 * device, or the time source. Returns `null` when the event carries nothing more than its title.
 */
export function eventDetail(event: SimEvent, operatorName: (operatorId: string) => string | null): string | null {
  const params = event.params
  const evidenceId = params.evidenceId
  if (typeof evidenceId === 'string' && evidenceId) return evidenceId
  if (event.sessionId) return event.sessionId
  const operatorId = params.operatorId
  if (typeof operatorId === 'string' && operatorId) return operatorName(operatorId) ?? operatorId
  if (event.deviceId) return event.deviceId
  const source = params.source
  if (typeof source === 'string' && source) return source
  return null
}

// ── Sealed Evidence Today (panel H) ─────────────────────────────────────────────────────────
export interface HourBar {
  /** "00" … "23". */
  hour: string
  count: number
}

export function hourlyBars(buckets: readonly number[]): HourBar[] {
  return Array.from({ length: 24 }, (_, hour) => ({ hour: String(hour).padStart(2, '0'), count: buckets[hour] ?? 0 }))
}

/** The hour with the most seals ("09"), or null when nothing was sealed. Ties keep the earliest. */
export function busiestHour(buckets: readonly number[]): string | null {
  let best = -1
  let bestCount = 0
  buckets.forEach((count, hour) => {
    if (count > bestCount) {
      best = hour
      bestCount = count
    }
  })
  return best < 0 ? null : String(best).padStart(2, '0')
}

// ── RBAC (S20) ──────────────────────────────────────────────────────────────────────────────
const ROLE_ORDER = [OperatorRole.INVESTIGATOR, OperatorRole.SUPERVISOR, OperatorRole.TECHNICIAN] as const

/** The first role (least privileged first) that holds a permission, for "Requires the … role". */
export function requiredRoleFor(permission: Permission): OperatorRole | null {
  return ROLE_ORDER.find((role) => (ROLE_PERMISSIONS[role] as readonly Permission[]).includes(permission)) ?? null
}

// ── Quick Actions (panel J) ─────────────────────────────────────────────────────────────────
export type QuickActionId = 'runDiagnostics' | 'reviewAudit' | 'exportEvidence' | 'openMaintenance'
/** M-C-16 icon micro-motions on hover. */
export type QuickActionMicro = 'swing' | 'tilt' | 'rise' | 'rotate'

export interface QuickActionSpec {
  id: QuickActionId
  to: '/system' | '/security-audit' | '/evidence'
  icon: LucideIcon
  /**
   * The permission of the action the card names, or null when it only opens a page every role
   * may view (the target page gates its own actions, S20).
   */
  permission: Permission | null
  micro: QuickActionMicro
}

export const QUICK_ACTIONS: readonly QuickActionSpec[] = [
  { id: 'runDiagnostics', to: '/system', icon: Stethoscope, permission: Permission.DIAGNOSTICS_RUN, micro: 'swing' },
  { id: 'reviewAudit', to: '/security-audit', icon: FileText, permission: null, micro: 'tilt' },
  { id: 'exportEvidence', to: '/evidence', icon: Upload, permission: Permission.EVIDENCE_EXPORT, micro: 'rise' },
  { id: 'openMaintenance', to: '/system', icon: Settings, permission: null, micro: 'rotate' },
]
