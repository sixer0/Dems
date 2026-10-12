/**
 * Pure view-model logic of the Operator Audit View (04_mobile_specs §4.16; step 87). No React, no
 * i18n: the screen passes the translated text it shows into `filterAuditRows`, so search matches
 * what the operator reads (event labels by code, never the simulator's English `message`).
 *
 * Mirrors the web Security & Audit model (implementation/30_page_security_audit.md §2) where the
 * two apps must agree: the actor rule (a null actor on AUTH_FAILED / AUTH_LOCKED is an unverified
 * person at the sign-in form, otherwise the system), the operator filter value for rows without an
 * operator, the reference IDs shown under an event, and the chain-link status. The web file is not
 * imported (P6: apps do not share feature code).
 */
import {
  AuditCategory,
  FaultKind,
  Severity,
  type AuditRow,
  type AuditType,
} from '@dems/shared/sim';

// ── Filters ──────────────────────────────────────────────────────────────────────────────

/** "No filter" value of every filter. */
export const ALL = 'ALL';
/** Operator filter value for rows without an operator (system and unverified actors). */
export const NO_OPERATOR = 'NONE';
/** Longest search text kept (the field's `maxLength`). */
export const SEARCH_MAX_LENGTH = 80;

export type CategoryFilter = AuditCategory | typeof ALL;
export type SeverityFilter = Severity | typeof ALL;

/** Category chips in 04 §4.16 order, plus Pairing and System (pairing rows are PAIRING rows, §4.16). */
export const CATEGORY_FILTERS: readonly CategoryFilter[] = [
  ALL,
  AuditCategory.AUTH,
  AuditCategory.SESSION,
  AuditCategory.EVIDENCE,
  AuditCategory.DEVICE,
  AuditCategory.SECURITY,
  AuditCategory.STORAGE,
  AuditCategory.PAIRING,
  AuditCategory.SYSTEM,
];

export const SEVERITY_FILTERS: readonly SeverityFilter[] = [
  ALL,
  Severity.INFO,
  Severity.SUCCESS,
  Severity.WARNING,
  Severity.CRITICAL,
];

export interface AuditQuery {
  readonly text: string;
  readonly category: CategoryFilter;
  readonly severity: SeverityFilter;
  /** An operator ID, `NO_OPERATOR` or `ALL`. */
  readonly operator: string;
}

export const DEFAULT_AUDIT_QUERY: AuditQuery = { text: '', category: ALL, severity: ALL, operator: ALL };

export function isCategoryFilter(value: unknown): value is CategoryFilter {
  return typeof value === 'string' && (CATEGORY_FILTERS as readonly string[]).includes(value);
}

export function isSeverityFilter(value: unknown): value is SeverityFilter {
  return typeof value === 'string' && (SEVERITY_FILTERS as readonly string[]).includes(value);
}

/** Filters in the "More filters" menu that are on (severity, operator). */
export function menuFilterCount(query: AuditQuery): number {
  return (query.severity === ALL ? 0 : 1) + (query.operator === ALL ? 0 : 1);
}

export function isFiltered(query: AuditQuery): boolean {
  return query.text.trim() !== '' || query.category !== ALL || menuFilterCount(query) > 0;
}

// ── Row facts ────────────────────────────────────────────────────────────────────────────

export type ActorKind = 'OPERATOR' | 'SYSTEM' | 'UNVERIFIED';

/** Types whose null actor is an unidentified person at the sign-in form, not the system. */
const UNVERIFIED_WHEN_NULL: ReadonlySet<AuditType> = new Set<AuditType>(['AUTH_FAILED', 'AUTH_LOCKED']);

export function actorKindOf(row: Pick<AuditRow, 'actorId' | 'type'>): ActorKind {
  if (row.actorId) return 'OPERATOR';
  return UNVERIFIED_WHEN_NULL.has(row.type) ? 'UNVERIFIED' : 'SYSTEM';
}

/**
 * A failed or locked sign-in that names an operator (backend task W80; security review CPS1-12 (a)).
 * The Core server writes AUTH_FAILED and AUTH_LOCKED with `actorId` = the operator whose USERNAME
 * WAS TYPED at the sign-in form (01_specs ID-4, as the simulator does): nobody was authenticated, so
 * the actor column must not read as if that operator acted. The screen words these rows in Live
 * mode as "Username typed: <name>"; Simulated mode keeps its wording (decision for the controller).
 */
export function isTypedUsernameActor(row: Pick<AuditRow, 'actorId' | 'type'>): boolean {
  return actorKindOf(row) === 'OPERATOR' && UNVERIFIED_WHEN_NULL.has(row.type);
}

export function detailString(row: Pick<AuditRow, 'details'>, key: string): string | null {
  const value = row.details[key];
  return typeof value === 'string' && value.length > 0 ? value : null;
}

/** Reference IDs worth showing under the event: evidence, session, export, case, device (at most 2). */
export function rowRefs(row: AuditRow): string[] {
  const refs = [row.evidenceId, row.sessionId, detailString(row, 'exportId'), detailString(row, 'caseNumber'), row.deviceId]
    .filter((value): value is string => typeof value === 'string' && value.length > 0);
  return [...new Set(refs)].slice(0, 2);
}

const FAULT_KINDS: ReadonlySet<string> = new Set(Object.values(FaultKind));

/** The fault kind of FAULT_* and discontinuity rows (`details.kind`, a sim code), or null. */
export function faultKindOf(row: Pick<AuditRow, 'details'>): FaultKind | null {
  const kind = detailString(row, 'kind');
  return kind !== null && FAULT_KINDS.has(kind) ? (kind as FaultKind) : null;
}

const AUTH_METHODS: ReadonlySet<string> = new Set(['PASSWORD', 'BIOMETRIC', 'SECURITY_KEY']);

/** The sign-in method code of AUTH_* rows (`details.method`), or null. */
export function authMethodOf(row: Pick<AuditRow, 'details' | 'category'>): string | null {
  if (row.category !== AuditCategory.AUTH) return null;
  const method = detailString(row, 'method');
  return method !== null && AUTH_METHODS.has(method) ? method : null;
}

/**
 * What a `CAPTURE_CONFIG_CHANGED` row changed (task 3 row 68; register MB-12; C3 §5.2 detail keys
 * `scope`, `field`, `trackId` / `inputId`, `from`, `to`): the target and the two values, or null for
 * any other row and for a row without both. Ids and role words only; the row's details never hold a
 * credential (C3 §5.1).
 */
export function captureChangeOf(row: Pick<AuditRow, 'type' | 'details'>): { target: string | null; from: string | null; to: string } | null {
  if (row.type !== 'CAPTURE_CONFIG_CHANGED') return null;
  const to = detailString(row, 'to');
  if (to === null) return null;
  return { target: detailString(row, 'trackId') ?? detailString(row, 'inputId'), from: detailString(row, 'from'), to };
}

/** The short hash column: the first `length` hex digits. */
export function shortHash(hash: string, length = 8): string {
  return hash.slice(0, length);
}

export type ChainLink = 'LINKED' | 'BROKEN';

/**
 * Chain-link status of one row. The simulator's AUDIT_TAMPER edits one row without re-hashing, so
 * exactly that row fails its own hash while the next row's `prevHash` still matches the stored
 * hash (13_sim_engine §2.5; the web page shows exactly one BROKEN row for the same fault).
 */
export function chainLinkOf(row: Pick<AuditRow, 'seq'>, breakSeq: number | null): ChainLink {
  return breakSeq !== null && row.seq === breakSeq ? 'BROKEN' : 'LINKED';
}

/**
 * The event record shown in the detail sheet: the hashed fields of the entry (`AuditEventBody`)
 * without the English `message` fallback, which is never shown as a label (MA-21).
 */
export function eventRecordJson(row: AuditRow): string {
  const record = {
    seq: row.seq,
    id: row.id,
    at: row.at,
    type: row.type,
    category: row.category,
    severity: row.severity,
    actorId: row.actorId,
    sessionId: row.sessionId,
    evidenceId: row.evidenceId,
    deviceId: row.deviceId,
    details: row.details,
  };
  return JSON.stringify(record, null, 2);
}

// ── Filtering ────────────────────────────────────────────────────────────────────────────

export function matchesOperator(row: Pick<AuditRow, 'actorId'>, operator: string): boolean {
  if (operator === ALL) return true;
  if (operator === NO_OPERATOR) return row.actorId === null;
  return row.actorId === operator;
}

function searchWords(text: string): string[] {
  return text.trim().toLowerCase().split(/\s+/).filter(Boolean);
}

/**
 * Visible rows, NEWEST FIRST (the ring holds them oldest first). `textOf` returns what the row
 * shows (translated event label, actor, method or fault label); the search also covers the entry
 * ID, `#seq`, the type code, the reference IDs and the hash. Every word must match.
 */
export function filterAuditRows(rows: readonly AuditRow[], query: AuditQuery, textOf: (row: AuditRow) => string): AuditRow[] {
  const words = searchWords(query.text);
  const out: AuditRow[] = [];
  for (let index = rows.length - 1; index >= 0; index -= 1) {
    const row = rows[index] as AuditRow;
    if (query.category !== ALL && row.category !== query.category) continue;
    if (query.severity !== ALL && row.severity !== query.severity) continue;
    if (!matchesOperator(row, query.operator)) continue;
    if (words.length > 0) {
      const haystack = [textOf(row), row.id, `#${row.seq}`, row.type, ...rowRefs(row), row.hash].join(' ').toLowerCase();
      if (!words.every((word) => haystack.includes(word))) continue;
    }
    out.push(row);
  }
  return out;
}

// ── Live mode: the stored chain and the lineage of operation 60 ────────────────────────────

/** `stored` of operation 60 `verifyAuditChain` (the check over the Core's table, which no demo fault breaks). */
export interface StoredChainCheck {
  readonly ok: boolean;
  /** The `seq` the stored chain has been verified through. */
  readonly checked: number;
  /** `seq` of the first stored row that does not verify; null while the chain verifies. */
  readonly firstBadSeq: number | null;
}

/** A translation key with its values (the screen translates it). */
export interface KeyedText {
  readonly key: string;
  readonly values: Readonly<Record<string, number>>;
}

/**
 * The stored-chain line under the verdict in Live mode (client spec §8.2 A9, the mobile form): the
 * sequence the Core verified its table through, or the first stored row that does not verify. The
 * Core's own numbers, nothing computed on the tablet. A broken answer without `firstBadSeq` (not in
 * the contract's examples) names the row after the last verified one, which is where the check stopped.
 */
export function storedChainLine(stored: StoredChainCheck, verdictOk = true): KeyedText {
  // Fix wave J (JA2-31): the verdict above failed while the stored log verifies. The sentence says
  // where the break is (the chain the Core holds) and that the stored log was checked separately.
  if (stored.ok && !verdictOk) return { key: 'features.audit.live.storedVerifiedAfterBreak', values: { seq: stored.checked } };
  if (stored.ok) return { key: 'features.audit.live.storedVerified', values: { seq: stored.checked } };
  return { key: 'features.audit.live.storedBroken', values: { seq: stored.firstBadSeq ?? stored.checked + 1 } };
}

/**
 * Fix wave J (JA2-31): whether a stored verification verdict is still a statement about the chain as
 * it is now. The verdict keeps the chain's break state of the moment it was given (`breakSeqAtVerdict`,
 * the header chip's own fact); it is stale once that state has changed: the break was cleared, a break
 * appeared, or the break is at another entry. The rule compares the chain with ITSELF over time, never
 * the verdict with the chip: a Core verdict that disagrees with the chip at once is a finding, not an
 * old one. New entries alone do not make a verdict stale: its sentence carries its count and its time.
 */
export function verdictStale(breakSeqAtVerdict: number | null, breakSeqNow: number | null): boolean {
  return breakSeqAtVerdict !== breakSeqNow;
}

/**
 * The hash-chain strip: the newest `count` entries, oldest first, plus the broken entry when it is
 * older than the strip (pinned in front of it, like the web strip).
 */
export function stripEntries(rows: readonly AuditRow[], breakSeq: number | null, count = 8): { tail: AuditRow[]; olderBreakSeq: number | null } {
  const tail = rows.slice(-count);
  const first = tail[0];
  const olderBreakSeq = breakSeq !== null && first !== undefined && breakSeq < first.seq ? breakSeq : null;
  return { tail, olderBreakSeq };
}
