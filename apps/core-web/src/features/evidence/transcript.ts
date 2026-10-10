/**
 * The transcript of a sealed item and its revisions: operations 84, 85 and 86 in both data modes
 * (blueprint row 92, M8-W3; UX spec flow 6; API contract C3 §2.3; decision OD-15).
 *
 * | Rule | How |
 * |------|-----|
 * | The ONE way to call an operation that is no action | `useWebLive()?.client.call(…)` in Live mode; the simulator's own router (`sim.request`) in Simulated mode, which answers the same three operations |
 * | Cache contract | Under the Core root `['core', …]`, so the query bridge removes it at every session end. A successful revision invalidates both reads of the item |
 * | Every answer is read defensively | `transcript-model.ts`; an answer that cannot be read whole is a failed read, never a partial list |
 * | A revision NEVER edits the sealed transcript | The request carries the corrected text of one segment and the revision number it was built on; the Core appends and signs. Nothing here writes a segment |
 * | Errors | The caller hands a failed read or command to the shared presenter first, then records it by its codes. The typed text is never logged: a record holds the segment index and the lengths only |
 */
import { useQuery, useQueryClient, type QueryKey } from '@tanstack/react-query'
import { useCallback, useEffect, useRef } from 'react'
import { useSimInstance, type Sim } from '@dems/shared/sim'
import { useCoreSignedIn } from '@/lib/core-queries'
import { deferEffectStart } from '@/lib/effect-start'
import { CORE_QUERY_KEY, useWebLive, type WebLive } from '@/runtime'
import {
  readRefusalOf,
  readTranscriptDocument,
  readTranscriptRevision,
  readTranscriptRevisions,
  reviseRefusalOf,
  type ReviseRefusal,
  type RevisionRequest,
  type TranscriptDocument,
  type TranscriptReadRefusal,
  type TranscriptRevision,
} from './transcript-model'

/** What this page keeps of a failed call: the Core's envelope. The presenter takes it as it is. */
export interface CoreFailure {
  readonly status: number | null
  readonly error: { readonly code: string }
}

export interface TranscriptTarget {
  readonly live: WebLive | null
  readonly sim: Sim
}

/** A refused or unanswered request: the status and the codes. It never holds a text of the transcript. */
export interface TranscriptFailure {
  readonly ok: false
  readonly status: number | null
  readonly code: string
  /** The failed Live call (the Core's envelope), for the presenter; null in Simulated mode or for an unreadable answer. */
  readonly failure: CoreFailure | null
}
export type TranscriptAnswer<T> = { readonly ok: true; readonly data: T } | TranscriptFailure

const transcriptPath = (evidenceId: string): string => `/api/v1/evidence/${encodeURIComponent(evidenceId)}/transcript`
const UNREADABLE: TranscriptFailure = { ok: false, status: 200, code: 'ANSWER_UNREADABLE', failure: null }

function simFailure(response: { readonly status: number; readonly body: unknown }): TranscriptFailure {
  const error = (response.body as { error?: { code?: unknown } } | null)?.error
  return { ok: false, status: response.status, code: typeof error?.code === 'string' ? error.code : 'SIMULATOR_ERROR', failure: null }
}
const liveFailure = (answer: CoreFailure): TranscriptFailure => ({ ok: false, status: answer.status, code: answer.error.code, failure: answer })

function parsed<T>(data: T | null): TranscriptAnswer<T> {
  return data === null ? UNREADABLE : { ok: true, data }
}

/** Operation 84. */
export async function fetchTranscript(target: TranscriptTarget, evidenceId: string): Promise<TranscriptAnswer<TranscriptDocument>> {
  if (target.live !== null) {
    const answer = await target.live.client.call('getTranscript', { params: { id: evidenceId } })
    return answer.ok ? parsed(readTranscriptDocument(answer.data)) : liveFailure(answer)
  }
  const response = target.sim.request({ method: 'GET', path: transcriptPath(evidenceId) })
  return response.status === 200 ? parsed(readTranscriptDocument(response.body)) : simFailure(response)
}

/** Operation 86, newest first. */
export async function fetchTranscriptRevisions(target: TranscriptTarget, evidenceId: string): Promise<TranscriptAnswer<TranscriptRevision[]>> {
  if (target.live !== null) {
    const answer = await target.live.client.call('listTranscriptRevisions', { params: { id: evidenceId } })
    return answer.ok ? parsed(readTranscriptRevisions(answer.data)) : liveFailure(answer)
  }
  const response = target.sim.request({ method: 'GET', path: `${transcriptPath(evidenceId)}/revisions` })
  return response.status === 200 ? parsed(readTranscriptRevisions(response.body)) : simFailure(response)
}

/** Operation 85: ONE request; nothing here repeats it. */
export async function createTranscriptRevision(target: TranscriptTarget, evidenceId: string, request: RevisionRequest): Promise<TranscriptAnswer<TranscriptRevision>> {
  const body = { baseRevision: request.baseRevision, changes: request.changes.map((change) => ({ ...change })), note: request.note }
  if (target.live !== null) {
    const answer = await target.live.client.call('createTranscriptRevision', { params: { id: evidenceId }, body })
    return answer.ok ? parsed(readTranscriptRevision(answer.data)) : liveFailure(answer)
  }
  const response = target.sim.request({ method: 'POST', path: `${transcriptPath(evidenceId)}/revisions`, body })
  return response.status === 201 ? parsed(readTranscriptRevision(response.body)) : simFailure(response)
}

/** A failed read, carried through the query's error: the status and the code, never a text. */
export class TranscriptReadError extends Error {
  override readonly name = 'TranscriptReadError'
  readonly status: number | null
  readonly code: string
  readonly refusal: TranscriptReadRefusal
  readonly failure: CoreFailure | null
  constructor(failure: TranscriptFailure) {
    super('The transcript of an evidence item could not be read.')
    this.status = failure.status
    this.code = failure.code
    this.refusal = readRefusalOf(failure.status, failure.code)
    this.failure = failure.failure
  }
}

const modeKey = (live: WebLive | null): string => (live === null ? 'sim' : 'live')
export const transcriptQueryKey = (evidenceId: string, live: WebLive | null): QueryKey => [...CORE_QUERY_KEY, 'evidence-transcript', modeKey(live), evidenceId]
export const transcriptRevisionsQueryKey = (evidenceId: string, live: WebLive | null): QueryKey => [...CORE_QUERY_KEY, 'evidence-transcript-revisions', modeKey(live), evidenceId]

function useTranscriptTarget(): TranscriptTarget & { readonly enabled: boolean } {
  const live = useWebLive()
  const sim = useSimInstance()
  const signedIn = useCoreSignedIn()
  // Simulated mode reads the in-app simulator at once; Live mode reads only while signed in (D176).
  return { live, sim, enabled: live === null || signedIn }
}

/** The transcript document (operation 84). `enabled: false` asks nothing (a DISABLED transcript has no document). */
export function useTranscript(evidenceId: string, enabled: boolean) {
  const target = useTranscriptTarget()
  return useQuery<TranscriptDocument, TranscriptReadError>({
    queryKey: transcriptQueryKey(evidenceId, target.live),
    enabled: enabled && target.enabled,
    retry: false,
    queryFn: async () => {
      const answer = await fetchTranscript(target, evidenceId)
      if (!answer.ok) throw new TranscriptReadError(answer)
      return answer.data
    },
  })
}

/** The append-only revisions (operation 86), newest first. */
export function useTranscriptRevisions(evidenceId: string, enabled: boolean) {
  const target = useTranscriptTarget()
  return useQuery<TranscriptRevision[], TranscriptReadError>({
    queryKey: transcriptRevisionsQueryKey(evidenceId, target.live),
    enabled: enabled && target.enabled,
    retry: false,
    queryFn: async () => {
      const answer = await fetchTranscriptRevisions(target, evidenceId)
      if (!answer.ok) throw new TranscriptReadError(answer)
      return answer.data
    },
  })
}

/**
 * Both reads of the item are fetched again when `transcript.revision` of the item in the replicated
 * slice MOVES (integration pass D10; pass D6 item 6): operation 85 on a Core publishes the new head,
 * so a revision ANOTHER operator appended reaches a pane that is open. The first value a pane sees
 * asks nothing (the reads of the mount are that value's); another item asks nothing either (its
 * reads have keys of their own). `null` = the item carries no summary.
 */
export function useTranscriptFollowsRevision(evidenceId: string, revision: number | null): void {
  const live = useWebLive()
  const queryClient = useQueryClient()
  const seen = useRef({ evidenceId, revision })
  useEffect(() => {
    const before = seen.current
    if (before.evidenceId !== evidenceId) {
      seen.current = { evidenceId, revision }
      return undefined
    }
    if (before.revision === revision) return undefined
    // A query refresh from an effect starts through `deferEffectStart` (plan row W0; the static
    // guard of `live-strict-mode-starts.test.tsx`). The value seen is moved INSIDE the start: a
    // start cancelled by a dependency change within the task leaves the move still to be answered.
    return deferEffectStart(() => {
      seen.current = { evidenceId, revision }
      void queryClient.invalidateQueries({ queryKey: transcriptQueryKey(evidenceId, live) })
      void queryClient.invalidateQueries({ queryKey: transcriptRevisionsQueryKey(evidenceId, live) })
    })
  }, [evidenceId, live, queryClient, revision])
}

export type ReviseOutcome =
  | { readonly ok: true; readonly revision: TranscriptRevision }
  | { readonly ok: false; readonly refusal: ReviseRefusal; readonly status: number | null; readonly code: string; readonly failure: CoreFailure | null }

/** Sends one revision, then has both reads of the item fetched again (also after a conflict: the pane never hides a newer revision). */
export function useReviseTranscript(evidenceId: string): (request: RevisionRequest) => Promise<ReviseOutcome> {
  const target = useTranscriptTarget()
  const queryClient = useQueryClient()
  const { live, sim } = target
  return useCallback(
    async (request) => {
      const answer = await createTranscriptRevision({ live, sim }, evidenceId, request)
      const refusal = answer.ok ? null : reviseRefusalOf(answer.status, answer.code)
      if (answer.ok || refusal === 'CONFLICT') {
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: transcriptQueryKey(evidenceId, live) }),
          queryClient.invalidateQueries({ queryKey: transcriptRevisionsQueryKey(evidenceId, live) }),
        ])
      }
      if (answer.ok) return { ok: true, revision: answer.data }
      return { ok: false, refusal: refusal ?? 'OTHER', status: answer.status, code: answer.code, failure: answer.failure }
    },
    [evidenceId, live, queryClient, sim],
  )
}
