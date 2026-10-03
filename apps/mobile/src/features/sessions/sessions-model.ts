/**
 * Sessions hub view model (04_mobile_specs §4.9; D61, D73). Pure TypeScript: no React, no hooks,
 * so every rule is unit-tested directly.
 *
 * - Rows: the simulator's `sessionHistory` (SEALED and INCOMPLETE, D61: 17 at load, one of them
 *   INCOMPLETE) plus the current session while it is RECORDING, finalizing (STOPPING, FINALIZING)
 *   or interrupted (FAULT, RECOVERY). A SEALED current session is already in the history (the seal
 *   transition prepends it), so it is never listed twice.
 * - Status chips: RECORDING danger with a filled dot, SEALED violet with a lock (D28/Q4, the same
 *   recipe as the Evidence list), INCOMPLETE amber, FAULT danger, FINALIZING info.
 * - Filters (§4.9): All, Sealed, Incomplete, Today (the WIB day of the simulator clock). Search
 *   over the session ID, case number, subject and evidence ID.
 * - Hand-offs (step-82 brief): a recording row opens the monitor, a finalizing row the finalization
 *   screen, an interrupted row recovery, a sealed row whose summary is still unacknowledged the
 *   summary; a sealed row opens its evidence on a phone and the detail pane on a tablet; an
 *   incomplete row opens the session detail (phone) or the detail pane (tablet).
 */
import { SessionState } from '@dems/shared/domain';
import {
  SessionOutcome,
  startOfWibDay,
  type EpochMs,
  type FaultKind,
  type SessionHistoryEntry,
  type SubjectType,
} from '@dems/shared/sim';
import type { StatusTone } from '@dems/shared/tokens';

// ---------------------------------------------------------------------------------------------
// Rows
// ---------------------------------------------------------------------------------------------

/** The hub's row states (chip words come from `common.enums.sessionState.<status>`). */
export const HUB_STATUSES = ['RECORDING', 'FINALIZING', 'FAULT', 'SEALED', 'INCOMPLETE'] as const;
export type HubStatus = (typeof HUB_STATUSES)[number];

export interface SessionRow {
  id: string;
  status: HubStatus;
  caseNumber: string;
  subjectName: string;
  subjectType: SubjectType;
  investigatorId: string;
  room: string;
  /** When the recording started (or the session was created, if it never started). */
  startedAt: EpochMs;
  /** When it ended; null while the session is still the current one. */
  endedAt: EpochMs | null;
  /** History: the recorded duration. Current session: null (the row shows the live timer). */
  durationMs: number | null;
  sizeBytes: number | null;
  evidenceId: string | null;
  faultKind: FaultKind | null;
  /** SEALED and its summary not yet acknowledged (SCR-02 `selectPendingSummaryId`). */
  pendingSummary: boolean;
  /** The simulator's current session (RECORDING, finalizing or interrupted). */
  active: boolean;
  /** Sort key: newest first. History sorts on `endedAt`; the current session sorts first. */
  sortAt: EpochMs;
}

export function historyRow(entry: SessionHistoryEntry, pendingSummaryId: string | null): SessionRow {
  const sealed = entry.outcome === SessionOutcome.SEALED;
  return {
    id: entry.id,
    status: sealed ? 'SEALED' : 'INCOMPLETE',
    caseNumber: entry.caseNumber,
    subjectName: entry.subjectName,
    subjectType: entry.subjectType,
    investigatorId: entry.investigatorId,
    room: entry.room,
    startedAt: entry.startedAt ?? entry.createdAt,
    endedAt: entry.endedAt,
    durationMs: entry.durationMs,
    sizeBytes: entry.sizeBytes,
    evidenceId: entry.evidenceId,
    faultKind: entry.faultKind,
    pendingSummary: sealed && pendingSummaryId === entry.id,
    active: false,
    sortAt: entry.endedAt,
  };
}

/** The flat fields of the current session the hub reads (relay F74-13: flat `useSim` values). */
export interface ActiveSessionFields {
  id: string;
  state: SessionState;
  caseNumber: string;
  subjectName: string;
  subjectType: SubjectType;
  investigatorId: string;
  room: string;
  createdAt: EpochMs;
  startedAt: EpochMs | null;
  evidenceId: string | null;
  faultKind: FaultKind | null;
}

/** The hub status of a current-session state, or null when the session is not listed. */
export function activeStatusFor(state: SessionState | null): HubStatus | null {
  switch (state) {
    case SessionState.RECORDING:
      return 'RECORDING';
    case SessionState.STOPPING:
    case SessionState.FINALIZING:
      return 'FINALIZING';
    case SessionState.FAULT:
    case SessionState.RECOVERY:
      return 'FAULT';
    default:
      // CREATE, PRECHECK, ARMED: nothing recorded yet (the Start button continues the setup).
      // SEALED: already a history row.
      return null;
  }
}

export function activeRow(fields: ActiveSessionFields): SessionRow | null {
  const status = activeStatusFor(fields.state);
  if (status === null) return null;
  const startedAt = fields.startedAt ?? fields.createdAt;
  return {
    id: fields.id,
    status,
    caseNumber: fields.caseNumber,
    subjectName: fields.subjectName,
    subjectType: fields.subjectType,
    investigatorId: fields.investigatorId,
    room: fields.room,
    startedAt,
    endedAt: null,
    durationMs: null,
    sizeBytes: null,
    evidenceId: fields.evidenceId,
    faultKind: fields.faultKind,
    pendingSummary: false,
    active: true,
    sortAt: Number.MAX_SAFE_INTEGER,
  };
}

/** Every row, newest first: the current session (if listed) and then the history. */
export function buildRows(
  history: readonly SessionHistoryEntry[],
  active: ActiveSessionFields | null,
  pendingSummaryId: string | null,
): SessionRow[] {
  const rows = history.map((entry) => historyRow(entry, pendingSummaryId));
  const current = active ? activeRow(active) : null;
  if (current && !rows.some((row) => row.id === current.id)) rows.push(current);
  return rows.sort(compareRows);
}

function compareRows(a: SessionRow, b: SessionRow): number {
  return a.sortAt === b.sortAt ? b.id.localeCompare(a.id) : b.sortAt - a.sortAt;
}

// ---------------------------------------------------------------------------------------------
// Filters and search
// ---------------------------------------------------------------------------------------------

/** §4.9 filter chips, in order. */
export const HUB_FILTERS = ['ALL', 'SEALED', 'INCOMPLETE', 'TODAY'] as const;
export type HubFilter = (typeof HUB_FILTERS)[number];

/** Search input cap (the shared 64-character ID/case limit, D61). */
export const SEARCH_MAX_LENGTH = 64;

export function isHubFilter(value: unknown): value is HubFilter {
  return typeof value === 'string' && (HUB_FILTERS as readonly string[]).includes(value);
}

/** True when `at` falls on the same WIB day as `nowMs` (UTC+07:00, D28). */
export function isSameWibDay(at: EpochMs, nowMs: EpochMs): boolean {
  return startOfWibDay(at) === startOfWibDay(nowMs);
}

export function matchesFilter(row: SessionRow, filter: HubFilter, nowMs: EpochMs): boolean {
  switch (filter) {
    case 'ALL':
      return true;
    case 'SEALED':
      return row.status === 'SEALED';
    case 'INCOMPLETE':
      return row.status === 'INCOMPLETE';
    case 'TODAY':
      return isSameWibDay(row.endedAt ?? row.startedAt, nowMs);
  }
}

/** Normalised search text: trimmed, lower-case, inner whitespace collapsed, capped. */
export function normalizeQuery(query: string): string {
  return query.trim().replace(/\s+/g, ' ').slice(0, SEARCH_MAX_LENGTH).toLowerCase();
}

export function matchesQuery(row: SessionRow, query: string): boolean {
  const q = normalizeQuery(query);
  if (q.length === 0) return true;
  return [row.id, row.caseNumber, row.subjectName, row.evidenceId ?? ''].some((field) => field.toLowerCase().includes(q));
}

export interface HubQuery {
  filter: HubFilter;
  query: string;
}

export const DEFAULT_HUB_QUERY: HubQuery = { filter: 'ALL', query: '' };

/** The visible rows (input order kept: `buildRows` already sorts newest first). */
export function filterRows(rows: readonly SessionRow[], { filter, query }: HubQuery, nowMs: EpochMs): SessionRow[] {
  return rows.filter((row) => matchesFilter(row, filter, nowMs) && matchesQuery(row, query));
}

/** Rows per filter for the current search (the expanded filter pane's counts). */
export function filterCounts(rows: readonly SessionRow[], query: string, nowMs: EpochMs): Record<HubFilter, number> {
  const searched = rows.filter((row) => matchesQuery(row, query));
  return {
    ALL: searched.length,
    SEALED: searched.filter((row) => matchesFilter(row, 'SEALED', nowMs)).length,
    INCOMPLETE: searched.filter((row) => matchesFilter(row, 'INCOMPLETE', nowMs)).length,
    TODAY: searched.filter((row) => matchesFilter(row, 'TODAY', nowMs)).length,
  };
}

export function isFiltered({ filter, query }: HubQuery): boolean {
  return filter !== 'ALL' || normalizeQuery(query).length > 0;
}

// ---------------------------------------------------------------------------------------------
// Status chips
// ---------------------------------------------------------------------------------------------

export type HubStatusIcon = 'dot' | 'loader' | 'octagon' | 'lock' | 'triangle';

export interface HubStatusSpec {
  tone: StatusTone;
  icon: HubStatusIcon;
  /** Fill the icon with the tone colour (the Recording dot). */
  filled: boolean;
}

export const HUB_STATUS_SPEC: Readonly<Record<HubStatus, HubStatusSpec>> = {
  RECORDING: { tone: 'danger', icon: 'dot', filled: true },
  FINALIZING: { tone: 'info', icon: 'loader', filled: false },
  FAULT: { tone: 'danger', icon: 'octagon', filled: false },
  SEALED: { tone: 'sealed', icon: 'lock', filled: false },
  INCOMPLETE: { tone: 'warning', icon: 'triangle', filled: false },
};

// ---------------------------------------------------------------------------------------------
// Hand-offs
// ---------------------------------------------------------------------------------------------

export type HandOffKind = 'live' | 'finalizing' | 'recovery' | 'summary' | 'evidence' | 'detail';

export interface HandOff {
  kind: HandOffKind;
  /** The route to open; `detail` on a multi-pane window selects into the pane instead (`?selected=`). */
  href: string;
}

/**
 * Where a row tap goes. Session-flow states always open their flow screen; a sealed row opens its
 * evidence on single-pane windows; everything else opens the session detail, which multi-pane
 * windows show in the detail pane.
 */
export function handOffFor(row: SessionRow, isMultiPane: boolean): HandOff {
  switch (row.status) {
    case 'RECORDING':
      return { kind: 'live', href: '/session/live' };
    case 'FINALIZING':
      return { kind: 'finalizing', href: '/session/finalizing' };
    case 'FAULT':
      return { kind: 'recovery', href: '/session/recovery' };
    case 'SEALED':
      if (row.pendingSummary) return { kind: 'summary', href: `/session/summary/${row.id}` };
      if (row.evidenceId && !isMultiPane) return { kind: 'evidence', href: `/evidence/${row.evidenceId}` };
      return { kind: 'detail', href: `/sessions/${row.id}` };
    case 'INCOMPLETE':
      return { kind: 'detail', href: `/sessions/${row.id}` };
  }
}

/** The evidence route for the detail's "View in Evidence": the pane on tablets, the pushed detail on phones. */
export function evidenceHrefFor(evidenceId: string, isMultiPane: boolean): string {
  return isMultiPane ? `/evidence?selected=${evidenceId}` : `/evidence/${evidenceId}`;
}

// ---------------------------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------------------------

export interface SizeParts {
  unit: 'tb' | 'gb' | 'mb';
  value: string;
}

/** Bytes → the `common.units.<unit>` key and a one-decimal value (decimal units, as the Storage screen). */
export function sizeParts(bytes: number | null): SizeParts | null {
  if (bytes === null || !Number.isFinite(bytes) || bytes < 0) return null;
  if (bytes >= 1e12) return { unit: 'tb', value: (bytes / 1e12).toFixed(1) };
  if (bytes >= 1e9) return { unit: 'gb', value: (bytes / 1e9).toFixed(1) };
  return { unit: 'mb', value: (bytes / 1e6).toFixed(1) };
}

/** Whole recording seconds of the current session at `nowMs` (the hub's 1 Hz live duration). */
export function elapsedSeconds(startedAt: EpochMs | null, stoppedAt: EpochMs | null, nowMs: EpochMs): number {
  if (startedAt === null) return 0;
  return Math.max(0, Math.floor(((stoppedAt ?? nowMs) - startedAt) / 1_000));
}

/** The stable numeric suffix of an evidence ID (`EV-20261001-0013` → `0013`; P13, D61). */
export function evidenceSuffix(evidenceId: string | null): string | null {
  if (!evidenceId) return null;
  return /-(\d{4})$/.exec(evidenceId)?.[1] ?? null;
}
