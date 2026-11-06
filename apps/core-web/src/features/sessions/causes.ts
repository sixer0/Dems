/**
 * WHY A SEAL WAS GIVEN UP, read from the Core (fix wave J round three, driver J3-W; findings JW-22
 * remainder / JW-13; `contract_wave_j.md` J2-S 4).
 *
 * The Sessions page lists the replicated `sessionHistory` slice, which has no column for the cause.
 * Operation 38 `listSessionHistory` states it per entry as the optional member `unsealableCause`
 * (read at each call from the session's audit row). So a Live console whose list holds at least one
 * session in quarantine walks operation 38 - newest first, the contract's largest page - until every
 * such session was seen or the list ended, and keeps `id -> unsealableCause` for the entries that
 * carry the member. Nothing else of the answer is used: the list itself stays the slice.
 *
 * - Read only when it is shown: Live, signed in, link up, and at least one quarantined session.
 * - The key names the sessions asked about, so a new quarantined session asks again.
 * - A failed read leaves the page with the shared reader's fallback (the session's alert, while the
 *   Core's ring of 100 holds it) and writes ONE record to the console's log; no toast - the row then
 *   simply states no cause code.
 */
import { queryOptions, useQueries, type QueryKey } from '@tanstack/react-query'
import type { SessionHistoryPage } from '@dems/shared/api'
import { CoreReadError, useQueryFailure, useRoleMatrixGate } from '@/lib/core-queries'
import { CORE_PAGE_LIMIT } from '@/lib/core-page-walk'
import { createPageReporter } from '@/lib/page-report'
import { CORE_QUERY_ROOT, type WebLive } from '@/runtime'

/** A hard stop for a server that keeps handing out cursors: 20 pages of 200 are 4000 sessions. */
const MAX_PAGES = 20
const CAUSE_CODE = /^[A-Z][A-Z0-9_]{1,63}$/

export const sessionCausesQueryKey = (wanted: readonly string[]): QueryKey => [CORE_QUERY_ROOT, 'session-history-causes', [...wanted].sort().join(',')]

/** `id -> unsealableCause` of the entries of one page that carry the member, read BY NAME. */
export function causesOfPage(page: SessionHistoryPage): Record<string, string> {
  const causes: Record<string, string> = {}
  for (const entry of page.items) {
    const cause = (entry as { unsealableCause?: unknown }).unsealableCause
    if (typeof cause === 'string' && CAUSE_CODE.test(cause)) causes[entry.id] = cause
  }
  return causes
}

async function readSessionCauses(live: WebLive | null, wanted: readonly string[]): Promise<Record<string, string>> {
  if (live === null) throw new CoreReadError('listSessionHistory', null)
  const missing = new Set(wanted)
  const causes: Record<string, string> = {}
  let cursor: string | null = null
  const readPage = (after: string | null) => live.client.call('listSessionHistory', { query: after === null ? { limit: CORE_PAGE_LIMIT } : { limit: CORE_PAGE_LIMIT, cursor: after } })
  for (let read = 0; read < MAX_PAGES && missing.size > 0; read += 1) {
    // D176: a Core read runs only while an operator is signed in; a session that ended ends the walk.
    if (live.session === null) throw new CoreReadError('listSessionHistory', null)
    const answer = await readPage(cursor)
    if (!answer.ok) throw new CoreReadError('listSessionHistory', answer)
    Object.assign(causes, causesOfPage(answer.data))
    for (const entry of answer.data.items) missing.delete(entry.id)
    cursor = answer.data.nextCursor
    if (cursor === null) break
  }
  return causes
}

export function sessionCausesQueryOptions(gate: { readonly live: WebLive | null; readonly enabled: boolean }, wanted: readonly string[]) {
  return queryOptions({
    queryKey: sessionCausesQueryKey(wanted),
    enabled: gate.live !== null && gate.enabled && wanted.length > 0,
    queryFn: () => readSessionCauses(gate.live, wanted),
  })
}

const sessionsReport = createPageReporter('ses')
/** What the reader sees while its gate is closed: nothing read, nothing failed. */
const IDLE_READ = { data: undefined, error: null, errorUpdatedAt: 0, status: 'pending' } as const
const NO_CAUSES: Readonly<Record<string, string>> = Object.freeze({})

/** The causes operation 38 states for the quarantined sessions `wanted`; empty until it answered, in Simulated mode, or after a failed read. */
export function useSessionCauses(wanted: readonly string[]): Readonly<Record<string, string>> {
  const gate = useRoleMatrixGate()
  // A closed gate mounts NO observer: a disabled `useQuery` would still leave an entry under `['core', …]` in the cache (AC-C-106).
  const options = sessionCausesQueryOptions(gate, wanted)
  const [query = IDLE_READ] = useQueries({ queries: [options].filter((entry) => entry.enabled === true) })
  useQueryFailure(query, (error) => {
    sessionsReport.report('Sessions.listSessionHistory', error, 'The causes of the sessions in quarantine could not be read from the Core.', { operation: 'listSessionHistory', sessions: wanted.length }, 'warn')
  })
  return query.data ?? NO_CAUSES
}
