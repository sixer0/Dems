import { incompleteSessionFactOf, type SessionHistoryEntry } from '@dems/shared/sim'

/**
 * The state of one finished session, as the page words it (`incompleteSessionFactOf`, read BY NAME):
 *
 * | kind | when | the page says |
 * |---|---|---|
 * | SEALED | the session was sealed | "Sealed", with the link to its evidence item |
 * | QUARANTINED | INCOMPLETE, it recorded, NO evidence item | recorded, could not be sealed; the recordings are kept in the Core's quarantine folder; what to do |
 * | RECORDED_NOT_SEALED | INCOMPLETE with an item | interrupted; its item is a never-sealed record |
 * | NEVER_RECORDED | INCOMPLETE, it never started | ended before a recording started; nothing was recorded |
 */
export type SessionRowState =
  | { readonly kind: 'SEALED'; readonly evidenceId: string | null; readonly cause: null }
  | { readonly kind: 'QUARANTINED' | 'RECORDED_NOT_SEALED' | 'NEVER_RECORDED'; readonly evidenceId: string | null; readonly cause: string | null }

export function evidenceStatusOfHistory(entry: SessionHistoryEntry): SessionRowState {
  const fact = incompleteSessionFactOf(entry)
  if (fact === null) return { kind: 'SEALED', evidenceId: entry.evidenceId, cause: null }
  return { kind: fact.kind, evidenceId: fact.evidenceId, cause: fact.cause }
}
