/**
 * Pure model of the Sessions page (fix wave J, driver J-W; finding JW-22; `contract_wave_j.md` J-S 10).
 *
 * The four quarantined sessions of lane 2, and every INCOMPLETE or cancelled session, existed nowhere
 * on the web console: no session list, and the Evidence search answered "No evidence matches" for a
 * session that has no item. The data was always there - the replicated `sessionHistory` slice
 * (operation 38), what the devices' Sessions hub reads. This page lists it, with the state of each
 * session read by the ONE shared reader `incompleteSessionFactOf`.
 */
import { evidenceStatusOfHistory, type SessionRowState } from './state'
import { unsealableCauseOf, type SessionHistoryEntry } from '@dems/shared/sim'

export type { SessionRowState }

export interface SessionRow {
  readonly entry: SessionHistoryEntry
  readonly state: SessionRowState
  /**
   * WHY THE SEAL WAS GIVEN UP, for a session whose recording is in quarantine (fix wave J round three;
   * `contract_wave_j.md` J2-S 4): the code the Core recorded, read by the ONE shared reader
   * `unsealableCauseOf`. `null`: not such a session, or the Core states none. It is not `state.cause`:
   * that one is the fault that ended the RECORDING (`faultKind`).
   */
  readonly unsealableCause: string | null
}

/** What the page knows beside the slice: the Core's alerts, and the causes operation 38 states (by session id). */
export interface SessionCauseFacts {
  readonly alerts?: unknown
  readonly causes?: Readonly<Record<string, string>>
}

/**
 * The cause of a quarantined session. The entry's own member `unsealableCause` comes first: the
 * replicated slice does not carry it (no column), operation 38 does, so `causes` holds what that
 * operation answered for the session and is laid over the entry BY THE MEMBER'S NAME before the
 * shared reader runs. The reader then falls back to the session's alert (a ring of 100).
 */
export function unsealableCauseOfRow(entry: SessionHistoryEntry, state: SessionRowState, facts: SessionCauseFacts = {}): string | null {
  if (state.kind !== 'QUARANTINED') return null
  const stated = facts.causes !== undefined && Object.prototype.hasOwnProperty.call(facts.causes, entry.id) ? facts.causes[entry.id] : undefined
  return unsealableCauseOf(stated === undefined ? entry : { ...entry, unsealableCause: stated }, facts.alerts)
}

/** The ids of the sessions whose recording is in quarantine: the ones operation 38 is asked about. */
export function quarantinedSessionIds(history: readonly SessionHistoryEntry[]): string[] {
  return history.filter((entry) => evidenceStatusOfHistory(entry).kind === 'QUARANTINED').map((entry) => entry.id)
}

const normalise = (value: string): string => value.toLowerCase().replace(/\s+/g, ' ').trim()

/** Case- and space-insensitive match on the session id, the evidence id, the case number and the subject. */
export function matchesSession(entry: Pick<SessionHistoryEntry, 'id' | 'evidenceId' | 'caseNumber' | 'subjectName'>, query: string | undefined): boolean {
  const needle = normalise(query ?? '')
  if (needle === '') return true
  return [entry.id, entry.evidenceId ?? '', entry.caseNumber, entry.subjectName].some((value) => normalise(value).includes(needle))
}

export type SessionFilter = 'ALL' | 'SEALED' | 'INCOMPLETE'

/** The rows of the page: newest first (the slice's order), filtered. */
export function sessionRows(history: readonly SessionHistoryEntry[], filter: SessionFilter, query: string | undefined, facts: SessionCauseFacts = {}): SessionRow[] {
  const rows: SessionRow[] = []
  for (const entry of history) {
    const state = evidenceStatusOfHistory(entry)
    if (filter === 'SEALED' && state.kind !== 'SEALED') continue
    if (filter === 'INCOMPLETE' && state.kind === 'SEALED') continue
    if (!matchesSession(entry, query)) continue
    rows.push({ entry, state, unsealableCause: unsealableCauseOfRow(entry, state, facts) })
  }
  return rows
}

/** The sessions of `history` that match `query` and have NO evidence item: what the Evidence search cannot show. */
export function sessionsWithoutItem(history: readonly SessionHistoryEntry[], query: string | undefined): SessionHistoryEntry[] {
  if (normalise(query ?? '') === '') return []
  return history.filter((entry) => entry.evidenceId === null && matchesSession(entry, query))
}
