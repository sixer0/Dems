/**
 * Which bundled media belongs to an evidence item in Live mode (backend task 01_specs §11 MS-2;
 * 04_client_integration_spec §7.3 group G7 "40 `getEvidence` (the media reference)", §14 point 7;
 * plan row W69).
 *
 * In Live mode the Core server decides whether the demo package this console bundles belongs to an
 * item: operation 40 answers `EvidenceMediaRef` (`DEMO_PACKAGE` with its suffix, or `NONE`). The
 * detail page shows bundled media, and runs the bundled-package check, only for `DEMO_PACKAGE`. In
 * Simulated mode nothing is asked: the guarded join of `model.ts` stands, as before.
 *
 * | Rule | How |
 * |------|-----|
 * | The ONE way to call an operation that is no action (rule 1 of the page rows) | `useWebLive()?.client.call('getEvidence', …)` |
 * | Cache contract (rule 3) | Under the Core root `['core', …]` built from `CORE_QUERY_KEY`, so the query bridge removes it at every session end and refetches it after a resynchronisation; `retry: false` is the bridge's default and is not set again |
 * | Every error to the presenter first (rule 2) | A refused or failed read is handed to the presenter (it names the role of a 403, coalesces an outage); what it leaves to the page (a 404, an answer it does not word) gets one record in the page's own log |
 * | Graceful degradation | Without an answer no bundled media is shown and the header says the reference is unavailable; the Core's verdict still works (operation 41 does not need it) |
 * | Read only while signed in (D176, finding F75-2; FXR-W W92-3) | `enabled` holds `useCoreSignedIn()`: when the session ends the bridge removes the entry, and a detail page still on screen until the shell leaves asks nothing |
 */
import { useQuery } from '@tanstack/react-query'
import { getDemoEvidencePackage, type DemoEvidencePackage } from '@dems/shared/demo-data'
import type { EvidenceMediaRef } from '@dems/shared/api'
import { Permission } from '@dems/shared/sim'
import { useCoreErrorPresenter } from '@/lib/core-errors'
import { useCoreSignedIn } from '@/lib/core-queries'
import { CORE_QUERY_KEY, useWebLive } from '@/runtime'
import { logEvidence, newCorrelationId } from './log'
import type { EvidenceRow } from './model'

/**
 * The query key of one item's media reference. Built under the Core root, so the bridge's
 * `removeQueries(['core'])` and `invalidateQueries(['core'])` reach it (RESIDUAL-W69-2, W83 ledger #44: the
 * runtime's `CORE_QUERY_KEYS` table names no evidence key, and `runtime/**` is closed to this row).
 */
export function evidenceMediaQueryKey(evidenceId: string) {
  return [...CORE_QUERY_KEY, 'evidence-media', evidenceId] as const
}

/** What the page keeps of a failed answer of operation 40 (its status and code, never its text). */
interface MediaReadFailure {
  readonly status: number | null
  readonly error: { readonly code: string }
}

/** A failed answer of operation 40, carried through the query's error. */
export class EvidenceMediaReadError extends Error {
  override readonly name = 'EvidenceMediaReadError'
  readonly status: number | null
  readonly code: string
  constructor(failure: MediaReadFailure) {
    super('The media reference of an evidence item could not be read.')
    this.status = failure.status
    this.code = failure.error.code
  }
}

export type EvidenceMediaState =
  /** Simulated mode: nothing is asked; the guarded join stands. */
  | { readonly status: 'simulated'; readonly media: null }
  | { readonly status: 'loading'; readonly media: null }
  | { readonly status: 'ready'; readonly media: EvidenceMediaRef }
  /** No answer: no bundled media is shown. */
  | { readonly status: 'unavailable'; readonly media: null }

const SIMULATED: EvidenceMediaState = { status: 'simulated', media: null }
const LOADING: EvidenceMediaState = { status: 'loading', media: null }
const UNAVAILABLE: EvidenceMediaState = { status: 'unavailable', media: null }

export function useEvidenceMedia(evidenceId: string): EvidenceMediaState {
  const live = useWebLive()
  const presentCoreError = useCoreErrorPresenter()
  const signedIn = useCoreSignedIn()
  const query = useQuery({
    queryKey: evidenceMediaQueryKey(evidenceId),
    enabled: live !== null && signedIn,
    queryFn: async (): Promise<EvidenceMediaRef> => {
      if (live === null) throw new Error('No Live source')
      const answer = await live.client.call('getEvidence', { params: { id: evidenceId } })
      if (answer.ok) return answer.data.media
      const error = new EvidenceMediaReadError(answer)
      if (presentCoreError(answer, { permission: Permission.EVIDENCE_VIEW }) === null) {
        logEvidence('warn', 'detail.mediaReference', error, { evidenceId, correlationId: newCorrelationId('media') })
      }
      throw error
    },
  })
  if (live === null) return SIMULATED
  if (query.data !== undefined) return { status: 'ready', media: query.data }
  if (query.status === 'error') return UNAVAILABLE
  return LOADING
}

/**
 * The row as the Core server's media reference allows it to be shown (MS-2). Simulated mode keeps
 * the row of the guarded join. In Live mode the package is the one the server names by its suffix,
 * and none for `NONE`, while the reference is unknown, or when this console bundles no package
 * with that suffix.
 */
export function rowForMedia(row: EvidenceRow, media: EvidenceMediaState): EvidenceRow {
  if (media.status === 'simulated') return row
  const pkg: DemoEvidencePackage | null =
    media.status === 'ready' && media.media.source === 'DEMO_PACKAGE' && media.media.packageSuffix !== null
      ? (row.pkg?.evidenceSuffix === media.media.packageSuffix ? row.pkg : (getDemoEvidencePackage(media.media.packageSuffix) ?? null))
      : null
  if (pkg === row.pkg) return row
  const video = pkg?.tracks.find((track) => track.trackId === 'VIDEO-01') ?? null
  return { ...row, pkg, thumbPath: video?.thumbnail?.path ?? null, posterPath: video?.poster?.path ?? null }
}
