/**
 * Pure view models for the System & Maintenance page (masterplan/01_specs.md §14.5.8; research/04
 * §5.6; design book §6.1, §20.2, §20.3, §24 via research/01_explore.md). No React, no DOM: every
 * function here is unit-tested in `__tests__/system-model.test.tsx`.
 */
import {
  FaultEvt,
  FaultKind,
  OperatorRole,
  ROLE_PERMISSIONS,
  type DiagnosticsRun,
  type FaultTarget,
  type Permission,
  type ServiceStatus,
  type UpdateSlice,
} from '@dems/shared/sim'

// ── RBAC (S20) ──────────────────────────────────────────────────────────────────────────────
const ROLE_ORDER = [OperatorRole.INVESTIGATOR, OperatorRole.SUPERVISOR, OperatorRole.TECHNICIAN] as const

/** The first role (least privileged first) holding a permission, for "Requires the … role". */
export function requiredRoleFor(permission: Permission): OperatorRole | null {
  return ROLE_ORDER.find((role) => (ROLE_PERMISSIONS[role] as readonly Permission[]).includes(permission)) ?? null
}

// ── Services board (§6.1) ───────────────────────────────────────────────────────────────────
export type Tone = 'success' | 'warning' | 'danger' | 'accent' | 'default'

export const SERVICE_TONE: Record<ServiceStatus, Tone> = {
  RUNNING: 'success',
  DEGRADED: 'warning',
  STOPPED: 'danger',
}

export interface ServiceCounts {
  total: number
  running: number
  attention: number
  stopped: number
}

export function countServices(statuses: readonly ServiceStatus[]): ServiceCounts {
  let running = 0
  let stopped = 0
  for (const status of statuses) {
    if (status === 'RUNNING') running += 1
    else if (status === 'STOPPED') stopped += 1
  }
  return { total: statuses.length, running, attention: statuses.length - running, stopped }
}

/** Banner tone: all running → success; any STOPPED → danger; otherwise warning. */
export function bannerTone(counts: ServiceCounts): Tone {
  if (counts.stopped > 0) return 'danger'
  return counts.attention > 0 ? 'warning' : 'success'
}

/** `3d 04:12:09`, `04:12:09` or `12:09` (mono, tabular). Negative or NaN input reads as zero. */
export function formatUptime(ms: number): string {
  const total = Number.isFinite(ms) && ms > 0 ? Math.floor(ms / 1000) : 0
  const days = Math.floor(total / 86_400)
  const hours = Math.floor((total % 86_400) / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const seconds = total % 60
  const pad = (value: number) => String(value).padStart(2, '0')
  const clock = `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`
  return days > 0 ? `${days}d ${clock}` : clock
}

// ── Health mini charts ──────────────────────────────────────────────────────────────────────
/**
 * An SVG polyline path for a streaming sparkline in a `width × height` box. `min`/`max` fix the
 * scale (so a fan stall visibly drops to the floor); values outside are clamped.
 */
export function sparklinePath(values: readonly number[], width: number, height: number, min: number, max: number): string {
  if (values.length === 0) return ''
  const span = max - min || 1
  const step = values.length > 1 ? width / (values.length - 1) : 0
  return values
    .map((value, index) => {
      const clamped = Math.min(max, Math.max(min, value))
      const x = values.length > 1 ? index * step : width
      const y = height - ((clamped - min) / span) * height
      return `${index === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`
    })
    .join(' ')
}

export const HEALTH_SCALES = {
  cpuPercent: { min: 0, max: 100, warn: 85 },
  temperatureC: { min: 20, max: 90, warn: 70 },
  fanRpm: { min: 0, max: 3200, warn: 1000 },
} as const

// ── Software update (§20.2 pipeline, §20.3 partitions) ──────────────────────────────────────
export interface UpdateView {
  state: UpdateSlice['state']
  done: number
  total: number
  /** The slot the next (or running) install writes to. */
  targetSlot: 'A' | 'B'
  canInstall: boolean
}

export function updateView(update: UpdateSlice): UpdateView {
  const done = update.steps.filter((step) => step.status === 'done').length
  return {
    state: update.state,
    done,
    total: update.steps.length,
    targetSlot: update.activeSlot === 'A' ? 'B' : 'A',
    canInstall: update.state !== 'RUNNING' && update.availableVersion !== null,
  }
}

/** §20.3 partition strategy, with relative sizes for the layout bar (illustrative, not measured). */
export const NVME_PARTITIONS = [
  { id: 'BOOT_RECOVERY', weight: 1 },
  { id: 'SLOT_A', weight: 3 },
  { id: 'SLOT_B', weight: 3 },
  { id: 'CONFIG', weight: 1 },
  { id: 'DATABASE', weight: 3 },
  { id: 'LOGS', weight: 2 },
  { id: 'CACHE', weight: 2 },
] as const
export type PartitionId = (typeof NVME_PARTITIONS)[number]['id']

// ── Diagnostics ─────────────────────────────────────────────────────────────────────────────
export interface DiagnosticsSummary {
  done: number
  total: number
  pass: number
  warn: number
  fail: number
  complete: boolean
}

export function summarizeDiagnostics(run: DiagnosticsRun | null): DiagnosticsSummary | null {
  if (!run) return null
  let pass = 0
  let warn = 0
  let fail = 0
  for (const check of run.checks) {
    if (check.status === 'PASS') pass += 1
    else if (check.status === 'WARN') warn += 1
    else if (check.status === 'FAIL') fail += 1
  }
  const done = pass + warn + fail
  return { done, total: run.checks.length, pass, warn, fail, complete: run.completedAt !== null }
}

export function diagnosticsTone(summary: DiagnosticsSummary): Tone {
  if (summary.fail > 0) return 'danger'
  if (summary.warn > 0) return 'warning'
  return 'success'
}

// ── Demo Control Panel (C17) ────────────────────────────────────────────────────────────────
export interface DemoFaultSpec {
  kind: FaultKind
  evt: string
  critical: boolean
  /** Target used for both inject and clear (undefined = the sim default / every target). */
  target?: FaultTarget
  /** Target key whose presence in `faults.active` means "on" (undefined = any target). */
  activeKey?: string | null
}

// Severity mirrors the shared `FAULT_SEVERITY` map (dbc-3 §C.2): CAPTURE_FAULT is CRITICAL (danger
// toast), MIC_SILENT is a WARNING (warning toast). Neither moves the session machine to FAULT here —
// that is SH-06 behaviour in the simulator, not a demo-panel decision.
const CRITICAL = new Set<FaultKind>([FaultKind.STORAGE_FULL, FaultKind.TPM_FAILURE, FaultKind.POWER_FAIL, FaultKind.SECURITY_FAULT, FaultKind.CAMERA_LOSS, FaultKind.AUDIT_TAMPER, FaultKind.CAPTURE_FAULT])

function spec(kind: FaultKind, extra: Partial<DemoFaultSpec> = {}): DemoFaultSpec {
  return { kind, evt: FaultEvt[kind], critical: CRITICAL.has(kind), ...extra }
}

/**
 * The toggles, in the order a presenter walks through them. GNSS_LOSS is not here: it is the
 * three-way time-source control (GNSS lock → NTP fallback → RTC fallback).
 * TAMPER is the enclosure switch only (target key null), never the evidence-media hook.
 */
export const DEMO_FAULTS: readonly DemoFaultSpec[] = [
  spec(FaultKind.CAMERA_LOSS),
  spec(FaultKind.MIC_NO_SIGNAL, { target: { channel: 'AUDIO-01' }, activeKey: 'AUDIO-01' }),
  spec(FaultKind.MIC_CLIP, { target: { channel: 'AUDIO-02' }, activeKey: 'AUDIO-02' }),
  // SH-03 (row 47) widened FaultKind to 14; these two are the client-side catch-up of this exhaustive
  // list. Both are injectable through the generic `actions.inject` (sim `injectFaultTransition` handles
  // them, row 51) and their demo labels were authored in shared i18n (SH-23). MIC_SILENT keys to the
  // channel feeding AUDIO-01 (the active input's channel), so no explicit target; CAPTURE_FAULT has none.
  spec(FaultKind.MIC_SILENT),
  spec(FaultKind.STORAGE_LOW),
  spec(FaultKind.STORAGE_FULL),
  spec(FaultKind.FAN_STALL),
  spec(FaultKind.TAMPER, { target: {}, activeKey: null }),
  spec(FaultKind.TPM_FAILURE),
  spec(FaultKind.SECURITY_FAULT),
  spec(FaultKind.AUDIT_TAMPER),
  spec(FaultKind.POWER_FAIL),
  spec(FaultKind.CAPTURE_FAULT),
]

export type TimeSourceChoice = 'GNSS' | 'NTP' | 'RTC'
export const TIME_SOURCE_CHOICES: readonly TimeSourceChoice[] = ['GNSS', 'NTP', 'RTC']

/** Active fault entries → the set of `kind` or `kind:target` keys the toggles look up. */
export function activeFaultKeys(active: readonly { kind: FaultKind; target: string | null }[]): Set<string> {
  const keys = new Set<string>()
  for (const fault of active) {
    keys.add(fault.kind)
    keys.add(`${fault.kind}:${fault.target ?? 'null'}`)
  }
  return keys
}

export function isSpecActive(keys: ReadonlySet<string>, fault: DemoFaultSpec): boolean {
  return fault.activeKey === undefined ? keys.has(fault.kind) : keys.has(`${fault.kind}:${fault.activeKey ?? 'null'}`)
}

/** The time-source control's value from the active GNSS_LOSS fallback (none → GNSS). */
export function timeSourceChoice(active: readonly { kind: FaultKind; target: string | null }[]): TimeSourceChoice {
  const gnss = active.find((fault) => fault.kind === FaultKind.GNSS_LOSS)
  if (!gnss) return 'GNSS'
  return gnss.target === 'RTC' ? 'RTC' : 'NTP'
}

/** `2026-10-01T10:00` → `1 Oct 2026, 10:00` (the D64 `--as-of` value is WIB wall time). */
export function formatAsOf(asOf: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(asOf)
  if (!match) return asOf
  const [, year, month, day, hour, minute] = match
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return `${Number(day)} ${months[Number(month) - 1] ?? month} ${year}, ${hour}:${minute}`
}
