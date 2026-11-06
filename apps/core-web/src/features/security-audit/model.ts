/**
 * Security & Audit page model: pure derivations from simulator state (01_specs §14.5.7;
 * research/04 §5.5; design book §12, §19.3, §20, §21.3, SYS-012). No React, no i18n: the
 * panels translate the IDs and statuses returned here.
 *
 * - `verifyChain(log)`: the audit hash chain, checked row by row with the simulator's own rule
 *   (`chainHash(prevHash, auditBody(row))`, prev-link, seq +1, head). It reports the same first
 *   break as the simulator's `verifyAuditChain` (AC-55) and, in addition, a status per row for
 *   the table's chain-link column and the chain strip. Row hashes are cached per row object, so a
 *   new audit row costs one SHA-256, not a full re-verification (03_motion_spec §9.3).
 * - Controls checklist, tamper/auth/custody lenses and the RBAC matrix.
 */
import {
  chainHash,
  auditBody,
  GENESIS_HASH,
  isPlatformNotReported,
  Permission,
  ROLE_PERMISSIONS,
  OperatorRole,
  type AuditCategory,
  type AuditLogSlice,
  type AuditRow,
  type AuditType,
  type ChainVerifyResult,
  type FaultKind,
  type SecuritySlice,
  type Severity,
  type SimOperator,
  type TimeSlice,
} from '@dems/shared/sim'

// ── Hash chain (SYS-012, EVT-30, AC-55) ─────────────────────────────────────────────────

export type ChainLinkStatus = 'LINKED' | 'BROKEN' | 'ANCHOR'
export type ChainBreakReason = Extract<ChainVerifyResult, { ok: false }>['reason']

export interface ChainReport {
  ok: boolean
  /** Rows checked before the first failure (all rows when intact), as the simulator counts. */
  checked: number
  total: number
  /** Position in `audit.rows` of the first bad row (the simulator's "tampered index"). */
  breakIndex: number | null
  breakSeq: number | null
  breakId: string | null
  reason: ChainBreakReason | null
  head: string
  /** Entries dropped off the front of the 1,000-row ring (the first kept row is then an anchor). */
  dropped: number
  /** Status per row, aligned with `audit.rows`. */
  statuses: readonly ChainLinkStatus[]
}

const selfHashOk = new WeakMap<AuditRow, boolean>()

/** Recomputes one row's hash once per row object (rows are immutable; a tamper makes a new object). */
function rowHashMatches(row: AuditRow): boolean {
  let ok = selfHashOk.get(row)
  if (ok === undefined) {
    ok = chainHash(row.prevHash, auditBody(row)) === row.hash
    selfHashOk.set(row, ok)
  }
  return ok
}

const reportCache = new WeakMap<AuditLogSlice, ChainReport>()

/**
 * Verifies the kept rows. Rule order per row matches `verifyAuditChain` (sim `events.ts`):
 * prev-link, then seq gap (rows after the first), then the recomputed hash; finally the head.
 */
export function verifyChain(log: AuditLogSlice): ChainReport {
  const cached = reportCache.get(log)
  if (cached) return cached
  const { rows } = log
  const statuses: ChainLinkStatus[] = new Array<ChainLinkStatus>(rows.length)
  let first: { index: number; seq: number; id: string; reason: ChainBreakReason } | null = null
  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index] as AuditRow
    let reason: ChainBreakReason | null = null
    if (index > 0) {
      const previous = rows[index - 1] as AuditRow
      if (row.prevHash !== previous.hash) reason = 'PREV_LINK_BROKEN'
      else if (row.seq !== previous.seq + 1) reason = 'SEQ_GAP'
    } else if (log.dropped === 0 && row.prevHash !== GENESIS_HASH) {
      reason = 'PREV_LINK_BROKEN'
    }
    if (reason === null && !rowHashMatches(row)) reason = 'HASH_MISMATCH'
    if (reason !== null) {
      statuses[index] = 'BROKEN'
      if (first === null) first = { index, seq: row.seq, id: row.id, reason }
    } else {
      statuses[index] = index === 0 && log.dropped > 0 ? 'ANCHOR' : 'LINKED'
    }
  }
  const last = rows[rows.length - 1]
  if (first === null && last && last.hash !== log.head) {
    const index = rows.length - 1
    statuses[index] = 'BROKEN'
    first = { index, seq: last.seq, id: last.id, reason: 'HASH_MISMATCH' }
  }
  const report: ChainReport = {
    ok: first === null,
    checked: first === null ? rows.length : first.index,
    total: rows.length,
    breakIndex: first?.index ?? null,
    breakSeq: first?.seq ?? null,
    breakId: first?.id ?? null,
    reason: first?.reason ?? null,
    head: log.head,
    dropped: log.dropped,
    statuses,
  }
  reportCache.set(log, report)
  return report
}

/** "Last N blocks" of the hash-chain strip (01_specs §14.5.7). */
export const STRIP_SIZE = 12

export interface StripBlock {
  row: AuditRow
  index: number
  status: ChainLinkStatus
  /** A gap in the strip precedes this block (the break lies before the last N blocks). */
  gapBefore: boolean
}

/** The last `size` rows, plus the broken row in front when the break is older than that. */
export function stripBlocks(
  rows: readonly AuditRow[],
  chain: Pick<ChainReport, 'breakIndex' | 'statuses'>,
  size: number = STRIP_SIZE,
): StripBlock[] {
  const blocks: StripBlock[] = []
  let start = Math.max(0, rows.length - size)
  const breakIndex = chain.breakIndex
  if (breakIndex !== null && breakIndex < start) {
    blocks.push({ row: rows[breakIndex] as AuditRow, index: breakIndex, status: 'BROKEN', gapBefore: false })
    start += 1
  }
  for (let index = start; index < rows.length; index += 1) {
    blocks.push({
      row: rows[index] as AuditRow,
      index,
      status: chain.statuses[index] ?? 'LINKED',
      gapBefore: blocks.length === 1 && breakIndex !== null && index > breakIndex + 1,
    })
  }
  return blocks
}

/** The short hash shown in chips and cells (first 8 hex, M-C-07). */
export function shortHash(hash: string, length = 8): string {
  return hash.slice(0, length)
}

/** Colon-grouped fingerprint of the first `bytes` bytes of a hex digest ("76:0B:E9:…"). */
export function colonFingerprint(hex: string, bytes = 8): string {
  const pairs = hex.slice(0, bytes * 2).toUpperCase().match(/.{2}/g) ?? []
  return pairs.join(':')
}

// ── Audit rows (table, filters) ──────────────────────────────────────────────────────────

export type ActorKind = 'OPERATOR' | 'SYSTEM' | 'UNVERIFIED'

/** Types whose null actor is an unidentified person at the sign-in form, not the system. */
const UNVERIFIED_WHEN_NULL: ReadonlySet<AuditType> = new Set<AuditType>(['AUTH_FAILED', 'AUTH_LOCKED'])

export interface AuditRowView {
  id: string
  seq: number
  at: number
  type: AuditType
  category: AuditCategory
  severity: Severity
  actorId: string | null
  actorKind: ActorKind
  /** Operator display name, or null for system and unverified actors. */
  actorName: string | null
  /** Reference IDs worth showing under the event (evidence, session, export, case). */
  refs: string[]
  /** Fault kind for FAULT_* and discontinuity rows (translated by the table). */
  faultKind: FaultKind | null
  /** The row's `details.coreNotRunning` (closing pass J, D217 (5)): the fault is worded "Core was not running", not by its kind. */
  coreNotRunning?: true
  /** Auth method for AUTH_* rows. */
  method: string | null
  hash: string
  prevHash: string
  chain: ChainLinkStatus
}

function detailString(row: AuditRow, key: string): string | null {
  const value = row.details[key]
  return typeof value === 'string' && value.length > 0 ? value : null
}

export function actorKindOf(row: Pick<AuditRow, 'actorId' | 'type'>): ActorKind {
  if (row.actorId) return 'OPERATOR'
  return UNVERIFIED_WHEN_NULL.has(row.type) ? 'UNVERIFIED' : 'SYSTEM'
}

/**
 * A failed sign-in or a lockout that names an operator: the operator whose username was TYPED at
 * the form, not a signed-in actor (01_specs ID-4; security review CPS1-12 (a)). Live mode words the
 * actor column so; Simulated mode is as it was.
 */
export function namesTypedUsername(row: Pick<AuditRow, 'actorId' | 'type'>): boolean {
  return row.actorId !== null && UNVERIFIED_WHEN_NULL.has(row.type)
}

function buildView(row: AuditRow, chain: ChainLinkStatus, actorName: string | null): AuditRowView {
  const refs = [row.evidenceId, row.sessionId, detailString(row, 'exportId'), detailString(row, 'caseNumber'), row.deviceId]
    .filter((value): value is string => typeof value === 'string' && value.length > 0)
  const kind = detailString(row, 'kind')
  return {
    id: row.id,
    seq: row.seq,
    at: row.at,
    type: row.type,
    category: row.category,
    severity: row.severity,
    actorId: row.actorId,
    actorKind: actorKindOf(row),
    actorName,
    refs: [...new Set(refs)].slice(0, 2),
    faultKind: (kind as FaultKind | null) ?? null,
    ...(row.details['coreNotRunning'] === true ? { coreNotRunning: true as const } : {}),
    method: detailString(row, 'method'),
    hash: row.hash,
    prevHash: row.prevHash,
    chain,
  }
}

const viewCache = new WeakMap<AuditRow, AuditRowView>()

/**
 * Builds the table rows, oldest first (the table sorts). A row's view object is reused while its
 * audit row object, chain status and actor name stay the same, so the table's React Aria
 * collection (cached by item identity) renders only new or changed rows when an entry arrives
 * (03_motion_spec §9.3).
 */
export function toRowViews(
  rows: readonly AuditRow[],
  chain: Pick<ChainReport, 'statuses'>,
  operators: readonly SimOperator[],
): AuditRowView[] {
  const names = new Map(operators.map((operator) => [operator.id, operator.displayName]))
  return rows.map((row, index) => {
    const status = chain.statuses[index] ?? 'LINKED'
    const actorName = row.actorId ? (names.get(row.actorId) ?? row.actorId) : null
    const cached = viewCache.get(row)
    if (cached && cached.chain === status && cached.actorName === actorName) return cached
    const view = buildView(row, status, actorName)
    viewCache.set(row, view)
    return view
  })
}

/** Filter value meaning "no filter" for the Select filters. */
export const ALL = 'ALL'
/** Operator filter value for rows without an operator (system and unverified). */
export const NO_OPERATOR = 'NONE'

export interface AuditFilterState {
  query: string
  category: AuditCategory | typeof ALL
  severity: Severity | typeof ALL
  operator: string
}

export const EMPTY_FILTERS: AuditFilterState = { query: '', category: ALL, severity: ALL, operator: ALL }

export function isFiltered(filters: AuditFilterState): boolean {
  return (
    filters.query.trim() !== '' || filters.category !== ALL || filters.severity !== ALL || filters.operator !== ALL
  )
}

/** Operator filter: an operator ID, `NONE` (system/unverified) or `ALL`. */
export function matchesOperator(row: Pick<AuditRowView, 'actorId'>, operator: string): boolean {
  if (operator === ALL) return true
  if (operator === NO_OPERATOR) return row.actorId === null
  return row.actorId === operator
}

/**
 * Free-text search over what the row shows: the translated event label, the actor, the entry
 * ID and number, the reference IDs and the hash prefix. Case-insensitive; every word must match.
 */
export function matchesQuery(row: AuditRowView, query: string, label: string, actor: string): boolean {
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean)
  if (words.length === 0) return true
  const haystack = [label, actor, row.id, `#${row.seq}`, row.type, ...row.refs, row.hash]
    .join(' ')
    .toLowerCase()
  return words.every((word) => haystack.includes(word))
}

// ── Controls checklist (§12, §20, D1 G, SM N) ────────────────────────────────────────────

export const CONTROL_ORDER = [
  'TPM',
  'SECURE_BOOT',
  'KEY_CUSTODY',
  'ENCRYPTION',
  'SIGNATURE',
  'HASH_CHAIN',
  'SECURE_TIMESTAMP',
  'TAMPER',
  'SIGNED_FIRMWARE',
] as const
export type ControlId = (typeof CONTROL_ORDER)[number]
export type ControlStatus = 'OK' | 'ATTENTION' | 'FAIL' | 'UNKNOWN'

/** Interpolation values for the controls' detail copy (the same set for every item). */
export type ControlParams = {
  seq: number
  source: string
  version: string
  algorithm: string
}

export interface ControlView {
  id: ControlId
  status: ControlStatus
  params: ControlParams
  /**
   * The Core states `security.platformNotReported` (closing pass J, D217 (7)) and this control is a
   * platform fact it does not read: the row says "Not reported" (status UNKNOWN), never "Active".
   */
  notReported?: true
  /**
   * Fix wave K (C-2 / G75c-04): what such a Core DOES state for a control it does not read as a
   * status - the key its sealed items are signed with (`SIGNING_KEY`, null fields when no item names
   * one), or its time source being the host system clock (`HOST_CLOCK`).
   */
  fact?: { readonly kind: 'SIGNING_KEY'; readonly key: ControlSigningKey | null } | { readonly kind: 'HOST_CLOCK' }
}

/** The signing key a Core reports through its sealed items (`reportedSigningKeyOf`, `@/lib/own-capture`). */
export interface ControlSigningKey {
  readonly keyId: string
  readonly algorithm: string
  readonly developmentKey: boolean | null
}

/** The controls a Core that states `security.platformNotReported` does not read: the TPM, Secure Boot, and the key custody that rests on the TPM. */
export const PLATFORM_CONTROLS: readonly ControlId[] = ['TPM', 'SECURE_BOOT', 'KEY_CUSTODY']

/**
 * Fix wave K (C-2 / G75c-04, ruling D222 (1)): the controls whose "Active" on such a Core comes from
 * the simulator's device model and not from a reading - the encryption status flag, the signing
 * service state (with the DEMO key name), the enclosure switch, the firmware signature - and, on a
 * Core whose time is the host system clock, the secure timestamp. The audit hash chain is NOT one of
 * them: this page checks every kept row itself.
 */
export const DEVICE_MODEL_CONTROLS: readonly ControlId[] = ['ENCRYPTION', 'SIGNATURE', 'TAMPER', 'SIGNED_FIRMWARE']

export interface ControlInputs {
  security: SecuritySlice
  time: Pick<TimeSlice, 'source' | 'locked'>
  chain: Pick<ChainReport, 'ok' | 'breakSeq'>
  softwareVersion: string
  /** The manifest signature algorithm of the DEMO packages (Ed25519, D67). */
  signatureAlgorithm: string
  /** False until the simulator has hydrated: every control shows UNKNOWN. */
  ready: boolean
  /** Fix wave K: the time of this Core is the host system clock (`time.hostClock`). */
  hostClock?: boolean
  /** Fix wave K: the signing key this Core reports through its sealed items; null: none names one. */
  signingKey?: ControlSigningKey | null
}

function simControlOk(security: SecuritySlice, id: string): boolean {
  return security.controls.find((control) => control.id === id)?.ok ?? false
}

export function buildControls(input: ControlInputs): ControlView[] {
  const { security, time, chain, ready } = input
  const status = (ok: boolean, whenNot: ControlStatus = 'FAIL'): ControlStatus =>
    !ready ? 'UNKNOWN' : ok ? 'OK' : whenNot
  const timeOk = (time.source === 'GNSS' || time.source === 'NTP') && time.locked
  const params: ControlParams = {
    seq: chain.breakSeq ?? 0,
    source: time.source,
    version: input.softwareVersion,
    algorithm: input.signatureAlgorithm,
  }
  const statuses: Record<ControlId, ControlStatus> = {
    TPM: status(simControlOk(security, 'TPM') && security.tpm.ok),
    SECURE_BOOT: status(simControlOk(security, 'SECURE_BOOT') && security.secureBoot),
    KEY_CUSTODY: status(security.tpm.ok),
    ENCRYPTION: status(simControlOk(security, 'ENCRYPTION')),
    SIGNATURE: status(security.state === 'READY'),
    HASH_CHAIN: status(chain.ok && simControlOk(security, 'HASH_CHAIN')),
    SECURE_TIMESTAMP: status(timeOk, 'ATTENTION'),
    TAMPER: status(simControlOk(security, 'TAMPER') && !security.tamper, 'ATTENTION'),
    SIGNED_FIRMWARE: status(simControlOk(security, 'SIGNED_FIRMWARE')),
  }
  // A control that would read "Active" from the placeholders of a Core that reads no platform fact says so instead. A control that shows a fault keeps it.
  const notReported = ready && isPlatformNotReported(security)
  // Fix wave K: the secure timestamp of a Core on its host clock is neither "locked" nor an "RTC holdover" - no time service exists.
  const hostClock = ready && input.hostClock === true
  const view = (id: ControlId): ControlView => {
    const plain: ControlView = { id, status: statuses[id], params }
    if (id === 'SECURE_TIMESTAMP') return hostClock ? { id, status: 'UNKNOWN', params, notReported: true, fact: { kind: 'HOST_CLOCK' } } : plain
    if (!notReported || statuses[id] !== 'OK') return plain
    if (PLATFORM_CONTROLS.includes(id)) return { id, status: 'UNKNOWN', params, notReported: true }
    if (!DEVICE_MODEL_CONTROLS.includes(id)) return plain
    // Fix wave L (G89c-05): where a sealed item of this Core names its signing key, the control STATES it - the chip beside
    // "Ed25519, Core key ..." read "Not reported" and the header counted it among the controls not reported. The sealed
    // items of this Core are signed with that key (their own member), so the control is active; no item yet: not reported.
    if (id === 'SIGNATURE' && (input.signingKey ?? null) !== null) return { id, status: 'OK', params, fact: { kind: 'SIGNING_KEY', key: input.signingKey ?? null } }
    return id === 'SIGNATURE' ? { id, status: 'UNKNOWN', params, notReported: true, fact: { kind: 'SIGNING_KEY', key: input.signingKey ?? null } } : { id, status: 'UNKNOWN', params, notReported: true }
  }
  return CONTROL_ORDER.map(view)
}

export type PostureState = 'SECURE' | 'ATTENTION' | 'CRITICAL' | 'UNKNOWN'
const POSTURE_RANK: Record<PostureState, number> = { UNKNOWN: -1, SECURE: 0, ATTENTION: 1, CRITICAL: 2 }

/** The shown posture: the simulator's, raised to CRITICAL whenever the page itself finds a chain break. */
export function postureOf(simPosture: PostureState, chainOk: boolean, ready: boolean, platformNotReported = false): PostureState {
  if (!ready) return 'UNKNOWN'
  if (!chainOk) return 'CRITICAL'
  // Closing pass J (D217 (7)): "SECURE" that no Core computed is not shown; a posture that names a fault is.
  if (platformNotReported && simPosture === 'SECURE') return 'UNKNOWN'
  return simPosture
}

/** R8: only a rise in severity pulses; a fall is a colour transition only. */
export function isEscalation(from: PostureState, to: PostureState): boolean {
  return from !== 'UNKNOWN' && POSTURE_RANK[to] > POSTURE_RANK[from]
}

// ── Lenses: authentication, tamper, custody (§21.3 AuthenticationEvent, TamperEvent, ExportEvent) ─

const AUTH_TYPES: ReadonlySet<AuditType> = new Set<AuditType>([
  'AUTH_SUCCESS',
  'AUTH_FAILED',
  'AUTH_LOCKED',
  'AUTH_SIGNED_OUT',
  'AUTH_EXPIRED',
])
/** Fault kinds that are tamper events (EVT-12, EVT-30). */
export const TAMPER_FAULTS: ReadonlySet<string> = new Set<FaultKind>(['TAMPER', 'TPM_FAILURE', 'SECURITY_FAULT', 'AUDIT_TAMPER'])
const CUSTODY_TYPES: ReadonlySet<AuditType> = new Set<AuditType>(['EVIDENCE_EXPORTED', 'EXPORT_DENIED', 'AUDIT_EXPORTED'])

export function isAuthRow(row: Pick<AuditRow, 'type'>): boolean {
  return AUTH_TYPES.has(row.type)
}

export function isTamperRow(row: Pick<AuditRow, 'type' | 'details'>): boolean {
  if (row.type === 'AUDIT_CHAIN_DISCONTINUITY' || row.type === 'EVIDENCE_VERIFY_FAILED') return true
  if (row.type !== 'FAULT_RAISED' && row.type !== 'FAULT_CLEARED') return false
  const kind = row.details.kind
  return typeof kind === 'string' && TAMPER_FAULTS.has(kind)
}

export function isCustodyRow(row: Pick<AuditRow, 'type'>): boolean {
  return CUSTODY_TYPES.has(row.type)
}

/** The newest `limit` rows matching `predicate`, newest first. */
export function newestMatching(rows: readonly AuditRow[], predicate: (row: AuditRow) => boolean, limit: number): AuditRow[] {
  const out: AuditRow[] = []
  for (let index = rows.length - 1; index >= 0 && out.length < limit; index -= 1) {
    const row = rows[index] as AuditRow
    if (predicate(row)) out.push(row)
  }
  return out
}

export function countMatching(rows: readonly AuditRow[], predicate: (row: AuditRow) => boolean): number {
  let count = 0
  for (const row of rows) if (predicate(row)) count += 1
  return count
}

/** The latest AUTH_SUCCESS time per operator ID. */
export function lastSignInByOperator(rows: readonly AuditRow[]): Map<string, number> {
  const out = new Map<string, number>()
  for (const row of rows) {
    if (row.type === 'AUTH_SUCCESS' && row.actorId) out.set(row.actorId, row.at)
  }
  return out
}

// ── RBAC (S20; §14.7 "Roles", demo assumption 01 G1) ────────────────────────────────────

export const PERMISSION_ORDER = [
  Permission.SESSION_START,
  Permission.SESSION_NOTE,
  Permission.EVIDENCE_VIEW,
  Permission.EVIDENCE_REVIEW,
  Permission.EVIDENCE_EXPORT,
  Permission.AUDIT_EXPORT,
  Permission.DEVICE_MANAGE,
  Permission.DIAGNOSTICS_RUN,
  Permission.MAINTENANCE,
] as const

export const ROLE_ORDER = [OperatorRole.INVESTIGATOR, OperatorRole.SUPERVISOR, OperatorRole.TECHNICIAN] as const

export function roleGrants(role: OperatorRole, permission: Permission): boolean {
  return (ROLE_PERMISSIONS[role] as readonly Permission[]).includes(permission)
}

/** The first role (in ROLE_ORDER) that holds a permission: the role a disabled control names (S20). */
export function roleFor(permission: Permission): OperatorRole | null {
  return ROLE_ORDER.find((role) => roleGrants(role, permission)) ?? null
}

/** Live mode: the Core's grants (operation 10) as `ROLE:PERMISSION` keys, for the matrix cells. */
export function coreGrantSet(grants: readonly { role: string; permission: string }[]): ReadonlySet<string> {
  return new Set(grants.map((grant) => `${grant.role}:${grant.permission}`))
}

// ── Keys & certificates expiry ───────────────────────────────────────────────────────────

export const DAY_MS = 86_400_000
/** Expiry chip tone: > 90 days success, ≤ 90 warning, expired danger. */
export type ExpiryTone = 'success' | 'warning' | 'danger'

export function daysUntil(expiresAt: number, now: number): number {
  return Math.floor((expiresAt - now) / DAY_MS)
}

export function expiryTone(expiresAt: number, now: number): ExpiryTone {
  if (expiresAt <= now) return 'danger'
  return daysUntil(expiresAt, now) <= 90 ? 'warning' : 'success'
}
