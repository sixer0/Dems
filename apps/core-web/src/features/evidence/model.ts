/**
 * Evidence page model: pure joins, filters and formatting (01_specs §14.5.3; research/04 §5.1;
 * D28, D61, D67; P13).
 *
 * - **Join rule (D61, P13; review 40 M4/R2).** A simulator evidence item joins to its DEMO package
 *   by the stable numeric suffix of its ID (`EV-YYYYMMDD-NNNN` → `NNNN`, `demoIdSuffix`), and the
 *   package is accepted only when its case number, subject and session suffix equal the item's. A
 *   presenter-created session that seals as EV 0014 (the recording scenario's package suffix) with
 *   another case or subject therefore gets no package and shows simulator data, labelled.
 *   Media, stills and files always come from the package paths, never from a folder convention.
 * - **Tones (research/04 §5.1; D28/Q4).** Status: Recorded green, Sealed violet, Exported blue,
 *   Under Review amber, Archived grey. Subject type: Tersangka red, Saksi blue, Lainnya neutral.
 * - **Times** are shown at UTC+07:00, the simulator's zone.
 */
import {
  EvidenceStatus,
  formatDuration,
  SubjectType,
  wibDateParts,
  type EpochMs,
  type EvidenceItem,
  type SimOperator,
} from '@dems/shared/sim'
import { demoIdSuffix, matchDemoPackage, type DemoEvidencePackage } from '@dems/shared/demo-data'
import type { StatusTone } from '@dems/shared/tokens'

// ── Tones ───────────────────────────────────────────────────────────────────────────────────

export const STATUS_TONE = {
  RECORDED: 'success',
  SEALED: 'sealed',
  EXPORTED: 'info',
  UNDER_REVIEW: 'warning',
  ARCHIVED: 'default',
} as const satisfies Record<EvidenceStatus, StatusTone>

export const SUBJECT_TONE = {
  TERSANGKA: 'danger',
  SAKSI: 'info',
  LAINNYA: 'default',
} as const satisfies Record<SubjectType, StatusTone>

/** The status filter order of the toolbar (01_specs §14.5.3; mobile MB 5 shows the first four). */
export const STATUS_FILTERS: readonly (EvidenceStatus | 'ALL')[] = [
  'ALL',
  EvidenceStatus.RECORDED,
  EvidenceStatus.SEALED,
  EvidenceStatus.EXPORTED,
  EvidenceStatus.UNDER_REVIEW,
  EvidenceStatus.ARCHIVED,
]

export const SUBJECT_TYPES: readonly SubjectType[] = [SubjectType.TERSANGKA, SubjectType.SAKSI, SubjectType.LAINNYA]

/** Evidence the export action accepts (sim `exportEvidence`: SEALED, UNDER_REVIEW, EXPORTED). */
export const EXPORTABLE_STATUSES: readonly EvidenceStatus[] = [
  EvidenceStatus.SEALED,
  EvidenceStatus.UNDER_REVIEW,
  EvidenceStatus.EXPORTED,
]

/** Evidence the archive action accepts (sim `archiveEvidence`). */
export const ARCHIVABLE_STATUSES: readonly EvidenceStatus[] = [
  EvidenceStatus.SEALED,
  EvidenceStatus.UNDER_REVIEW,
  EvidenceStatus.EXPORTED,
]

// ── Rows ────────────────────────────────────────────────────────────────────────────────────

export interface EvidenceRow {
  id: string
  /** The join key (`NNNN`), or null for an ID outside the `EV-…-NNNN` format. */
  suffix: string | null
  item: EvidenceItem
  investigatorName: string
  /** The DEMO package (step 93) when the guarded join accepts it, else null (simulator data only). */
  pkg: DemoEvidencePackage | null
  /** VIDEO-01 thumbnail and poster paths from the package (relative to packages/shared/assets/). */
  thumbPath: string | null
  posterPath: string | null
  /** `YYYY-MM-DD` of `recordedAt` at UTC+07:00 (date-range filter). */
  recordedDay: string
}

export function evidenceSuffix(evidenceId: string): string | null {
  return demoIdSuffix(evidenceId, 'EV')
}

export function investigatorNameOf(operators: readonly SimOperator[], investigatorId: string): string {
  return operators.find((operator) => operator.id === investigatorId)?.displayName ?? investigatorId
}

/**
 * The DEMO package of an evidence item: the shared `matchDemoPackage` (step 54, D84): same evidence
 * suffix, session suffix, case SEQUENCE and subject name (review 40 M4), so the join holds on any
 * demo day (F-47-1: the dated parts of the IDs and case number are ignored). Otherwise null.
 */
export function joinDemoPackage(
  item: Pick<EvidenceItem, 'id' | 'caseNumber' | 'subjectName' | 'sessionId'>,
): DemoEvidencePackage | null {
  return matchDemoPackage(item)
}

export function buildEvidenceRow(item: EvidenceItem, operators: readonly SimOperator[]): EvidenceRow {
  const pkg = joinDemoPackage(item)
  const video = pkg?.tracks.find((track) => track.trackId === 'VIDEO-01') ?? null
  return {
    id: item.id,
    suffix: evidenceSuffix(item.id),
    item,
    investigatorName: investigatorNameOf(operators, item.investigatorId),
    pkg,
    thumbPath: video?.thumbnail?.path ?? null,
    posterPath: video?.poster?.path ?? null,
    recordedDay: wibDay(item.recordedAt),
  }
}

/**
 * Whether the DEMO package the guarded join gave the row describes THIS record: the package's own
 * evidence ID, session ID and case number equal the item's (E-fix FX-W, E2E-W1-4). The join ignores
 * the dated parts on purpose (D84 on F-47-1), so on any day but the generator's `asOf` day the joined
 * package is the same demo interview with another record (`EV-20261001-0012` for `EV-20261006-0012`):
 * its media may play, but its manifest is not this item's metadata.
 */
export function packageDescribesItem(
  pkg: Pick<DemoEvidencePackage, 'evidenceId' | 'sessionId' | 'caseNumber'> | null,
  item: Pick<EvidenceItem, 'id' | 'sessionId' | 'caseNumber'>,
): boolean {
  return pkg !== null && pkg.evidenceId === item.id && pkg.sessionId === item.sessionId && pkg.caseNumber === item.caseNumber
}

// ── Stored verification (E-fix FX-W, E2E-W1-3) ─────────────────────────────────────────────

/** The custody action each verdict writes (simulator `verifyEvidenceTransition`; the Core's operation 41). */
const VERIFY_CUSTODY_ACTION = { PASS: 'VERIFIED', FAIL: 'VERIFY_FAILED' } as const

/** The record's last verification: its verdict, when, and who ran it. */
export interface StoredVerification {
  status: 'PASS' | 'FAIL'
  at: EpochMs | null
  /** The operator of the verification's custody entry; null for the system. */
  actorId: string | null
  /** False when the custody list holds no entry of that verification (who ran it is then not known). */
  actorKnown: boolean
}

/**
 * The verification the record holds (`item.verification`, kept by the Core server in Live mode and by
 * the simulator in Simulated mode), with the actor of its custody entry: the entry of the same verdict
 * at the same instant, else the latest entry of that verdict. Null when the record holds none.
 */
export function storedVerification(item: Pick<EvidenceItem, 'verification' | 'custody'>): StoredVerification | null {
  const { status, at } = item.verification
  if (status !== 'PASS' && status !== 'FAIL') return null
  const action = VERIFY_CUSTODY_ACTION[status]
  const entries = item.custody.filter((entry) => entry.action === action)
  const entry = entries.findLast((candidate) => candidate.at === at) ?? entries.at(-1) ?? null
  return { status, at, actorId: entry?.actorId ?? null, actorKnown: entry !== null }
}

/** Newest first (the list's default order). */
export function buildEvidenceRows(items: readonly EvidenceItem[], operators: readonly SimOperator[]): EvidenceRow[] {
  return items.map((item) => buildEvidenceRow(item, operators)).sort((a, b) => b.item.recordedAt - a.item.recordedAt)
}

// ── Filters (AC-64) ─────────────────────────────────────────────────────────────────────────

/** Case- and space-insensitive match on the evidence ID, case number and subject (AC-64). */
export function matchesSearch(row: Pick<EvidenceRow, 'id' | 'item'>, query: string | undefined): boolean {
  const needle = normalise(query ?? '')
  if (!needle) return true
  return [row.id, row.item.caseNumber, row.item.subjectName, row.item.sessionId].some((value) =>
    normalise(value).includes(needle),
  )
}

function normalise(value: string): string {
  return value.toLowerCase().replace(/\s+/g, ' ').trim()
}

/** Inclusive `YYYY-MM-DD` range on the recorded day; open ends are allowed. */
export function withinDateRange(recordedDay: string, from?: string, to?: string): boolean {
  if (from && recordedDay < from) return false
  if (to && recordedDay > to) return false
  return true
}

// ── Formatting ──────────────────────────────────────────────────────────────────────────────

function pad(value: number): string {
  return String(value).padStart(2, '0')
}

const MONTHS_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const

/** `YYYY-MM-DD` at UTC+07:00. */
export function wibDay(ms: EpochMs): string {
  const p = wibDateParts(ms)
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`
}

/** `26 May 2025` at UTC+07:00 (the mockup's date style, MB 6). */
export function formatWibDate(ms: EpochMs): string {
  const p = wibDateParts(ms)
  return `${p.day} ${MONTHS_EN[p.month - 1]} ${p.year}`
}

/** `14:12` at UTC+07:00. */
export function formatWibClock(ms: EpochMs): string {
  const p = wibDateParts(ms)
  return `${pad(p.hour)}:${pad(p.minute)}`
}

/** `14:12:07` at UTC+07:00. */
export function formatWibClockSeconds(ms: EpochMs): string {
  const p = wibDateParts(ms)
  return `${pad(p.hour)}:${pad(p.minute)}:${pad(p.second)}`
}

/** `26 May 2025 14:12:07` at UTC+07:00. */
export function formatWibDateTime(ms: EpochMs): string {
  return `${formatWibDate(ms)} ${formatWibClockSeconds(ms)}`
}

/** `01:24:32` (mono in the table, MB 5). */
export function formatEvidenceDuration(ms: number): string {
  return formatDuration(ms)
}

/** `m:ss` for player positions. */
export function formatPlayerTime(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds))
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const rest = total % 60
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(rest)}` : `${minutes}:${pad(rest)}`
}

export interface ByteSize {
  value: string
  unit: 'tb' | 'gb' | 'mb'
}

/** Decimal units (the storage pages use decimal GB/TB too): 3963333333 → `{ value: '3.96', unit: 'gb' }`. */
export function byteSize(bytes: number): ByteSize {
  if (bytes >= 1e12) return { value: trim(bytes / 1e12, 2), unit: 'tb' }
  if (bytes >= 1e9) return { value: trim(bytes / 1e9, bytes >= 1e11 ? 0 : 1), unit: 'gb' }
  return { value: trim(bytes / 1e6, bytes >= 1e8 ? 0 : 1), unit: 'mb' }
}

function trim(value: number, digits: number): string {
  return value.toFixed(digits).replace(/\.0+$/, '')
}

/** First and last `count` characters of a hash: `a1b2c3d4…e5f6a7b8`. */
export function shortHash(hash: string, count = 8): string {
  return hash.length <= count * 2 + 1 ? hash : `${hash.slice(0, count)}…${hash.slice(-count)}`
}
