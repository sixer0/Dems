/**
 * The transcript of a sealed item and its revisions: operations 84, 85 and 86 in both data modes
 * (blueprint row 92, M8-W3; UX spec flow 6; API contract C3 §2.3; decision OD-15).
 *
 * | Rule | How |
 * |------|-----|
 * | The ONE way to call an operation that is no simulator action | `useMobileLive()?.client.call(…)` in Live mode; the simulator's own router (`sim.request`) otherwise, which answers the same three operations |
 * | Every answer is read defensively | `transcript-model.ts`; an answer that cannot be read whole is a failed read, never a partial list |
 * | A revision NEVER edits the sealed transcript | The request carries the corrected text of one segment and the revision number it was built on; the Core appends and signs. Nothing here writes a segment |
 * | A read is no command | A failed read shows no toast (LB-6 words commands): the pane says its state, and one record with the status and the code goes to the persistent runtime log |
 * | The typed text is never logged | A record holds the segment index and the lengths only |
 */
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef } from 'react';
import { useSimInstance, type Sim } from '@dems/shared/sim';
import { reportRuntimeIssue, useMobileLive, type MobileLiveSim } from '@/runtime';
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
} from './transcript-model';

export interface TranscriptTarget {
  readonly live: MobileLiveSim | null;
  readonly sim: Sim;
}

/** A refused or unanswered request: the status and the codes. It never holds a text of the transcript. */
export interface TranscriptFailure {
  readonly ok: false;
  readonly status: number | null;
  readonly code: string;
  /** The failed Live call (the Core's envelope), for the presenter; null outside Live mode or for an unreadable answer. */
  readonly failure: unknown;
}
export type TranscriptAnswer<T> = { readonly ok: true; readonly data: T } | TranscriptFailure;

const transcriptPath = (evidenceId: string): string => `/api/v1/evidence/${encodeURIComponent(evidenceId)}/transcript`;
const UNREADABLE: TranscriptFailure = { ok: false, status: 200, code: 'ANSWER_UNREADABLE', failure: null };

function simFailure(response: { readonly status: number; readonly body: unknown }): TranscriptFailure {
  const error = (response.body as { error?: { code?: unknown } } | null)?.error;
  return { ok: false, status: response.status, code: typeof error?.code === 'string' ? error.code : 'SIMULATOR_ERROR', failure: null };
}
const liveFailure = (answer: { readonly status: number | null; readonly error: { readonly code: string } }): TranscriptFailure => ({ ok: false, status: answer.status, code: answer.error.code, failure: answer });
const parsed = <T,>(data: T | null): TranscriptAnswer<T> => (data === null ? UNREADABLE : { ok: true, data });

/** Operation 84. */
export async function fetchTranscript(target: TranscriptTarget, evidenceId: string): Promise<TranscriptAnswer<TranscriptDocument>> {
  if (target.live !== null) {
    const answer = await target.live.client.call('getTranscript', { params: { id: evidenceId } });
    return answer.ok ? parsed(readTranscriptDocument(answer.data)) : liveFailure(answer);
  }
  const response = target.sim.request({ method: 'GET', path: transcriptPath(evidenceId) });
  return response.status === 200 ? parsed(readTranscriptDocument(response.body)) : simFailure(response);
}

/** Operation 86, newest first. */
export async function fetchTranscriptRevisions(target: TranscriptTarget, evidenceId: string): Promise<TranscriptAnswer<TranscriptRevision[]>> {
  if (target.live !== null) {
    const answer = await target.live.client.call('listTranscriptRevisions', { params: { id: evidenceId } });
    return answer.ok ? parsed(readTranscriptRevisions(answer.data)) : liveFailure(answer);
  }
  const response = target.sim.request({ method: 'GET', path: `${transcriptPath(evidenceId)}/revisions` });
  return response.status === 200 ? parsed(readTranscriptRevisions(response.body)) : simFailure(response);
}

/** Operation 85: ONE request; nothing here repeats it. */
export async function createTranscriptRevision(target: TranscriptTarget, evidenceId: string, request: RevisionRequest): Promise<TranscriptAnswer<TranscriptRevision>> {
  const body = { baseRevision: request.baseRevision, changes: request.changes.map((change) => ({ ...change })), note: request.note };
  if (target.live !== null) {
    const answer = await target.live.client.call('createTranscriptRevision', { params: { id: evidenceId }, body });
    return answer.ok ? parsed(readTranscriptRevision(answer.data)) : liveFailure(answer);
  }
  const response = target.sim.request({ method: 'POST', path: `${transcriptPath(evidenceId)}/revisions`, body });
  return response.status === 201 ? parsed(readTranscriptRevision(response.body)) : simFailure(response);
}

/** A failed read, carried through the query's error: the status and the code, never a text. */
export class TranscriptReadError extends Error {
  override readonly name = 'TranscriptReadError';
  readonly status: number | null;
  readonly code: string;
  readonly refusal: TranscriptReadRefusal;
  constructor(failure: TranscriptFailure) {
    super('The transcript of an evidence item could not be read.');
    this.status = failure.status;
    this.code = failure.code;
    this.refusal = readRefusalOf(failure.status, failure.code);
  }
}

const modeKey = (live: MobileLiveSim | null): string => (live === null ? 'sim' : 'live');
export const transcriptQueryKey = (evidenceId: string, live: MobileLiveSim | null) => ['core-server', 'evidence-transcript', modeKey(live), evidenceId] as const;
export const transcriptRevisionsQueryKey = (evidenceId: string, live: MobileLiveSim | null) => ['core-server', 'evidence-transcript-revisions', modeKey(live), evidenceId] as const;

function failed(source: string, evidenceId: string, failure: TranscriptFailure): TranscriptReadError {
  const error = new TranscriptReadError(failure);
  // "Not available yet" is a state of the item, said by the pane; it is no failure to record.
  if (error.refusal !== 'NOT_READY') reportRuntimeIssue('warn', source, `transcript read -> ${failure.code}`, { evidenceId, status: failure.status, code: failure.code });
  return error;
}

/** The transcript document (operation 84). `enabled: false` asks nothing (a DISABLED transcript has no document). */
export function useTranscript(evidenceId: string, enabled: boolean) {
  const live = useMobileLive();
  const sim = useSimInstance();
  return useQuery<TranscriptDocument, TranscriptReadError>({
    queryKey: transcriptQueryKey(evidenceId, live),
    enabled,
    retry: false,
    queryFn: async () => {
      const answer = await fetchTranscript({ live, sim }, evidenceId);
      if (!answer.ok) throw failed('evidence.transcript.read', evidenceId, answer);
      return answer.data;
    },
  });
}

/** The append-only revisions (operation 86), newest first. */
export function useTranscriptRevisions(evidenceId: string, enabled: boolean) {
  const live = useMobileLive();
  const sim = useSimInstance();
  return useQuery<TranscriptRevision[], TranscriptReadError>({
    queryKey: transcriptRevisionsQueryKey(evidenceId, live),
    enabled,
    retry: false,
    queryFn: async () => {
      const answer = await fetchTranscriptRevisions({ live, sim }, evidenceId);
      if (!answer.ok) throw failed('evidence.transcript.revisions', evidenceId, answer);
      return answer.data;
    },
  });
}

export type ReviseOutcome =
  | { readonly ok: true; readonly revision: TranscriptRevision }
  | { readonly ok: false; readonly refusal: ReviseRefusal; readonly status: number | null; readonly code: string; readonly failure: unknown };

/**
 * Both reads of the item are fetched again when `transcript.revision` of the item in the replicated
 * slice MOVES (integration pass D10; pass D6 item 6): operation 85 on a Core publishes the new head,
 * so a revision ANOTHER operator appended reaches a pane that is open. The first value a pane sees
 * asks nothing (the reads of the mount are that value's); another item asks nothing either (its
 * reads have keys of their own). `null` = the item carries no summary.
 */
export function useTranscriptFollowsRevision(evidenceId: string, revision: number | null): void {
  const live = useMobileLive();
  const queryClient = useQueryClient();
  const seen = useRef({ evidenceId, revision });
  useEffect(() => {
    const before = seen.current;
    seen.current = { evidenceId, revision };
    if (before.evidenceId !== evidenceId || before.revision === revision) return;
    void queryClient.invalidateQueries({ queryKey: transcriptQueryKey(evidenceId, live) });
    void queryClient.invalidateQueries({ queryKey: transcriptRevisionsQueryKey(evidenceId, live) });
  }, [evidenceId, live, queryClient, revision]);
}

/** Sends one revision, then has both reads of the item fetched again (also after a conflict: the pane never hides a newer revision). */
export function useReviseTranscript(evidenceId: string): (request: RevisionRequest) => Promise<ReviseOutcome> {
  const live = useMobileLive();
  const sim = useSimInstance();
  const queryClient = useQueryClient();
  return useCallback(
    async (request) => {
      const answer = await createTranscriptRevision({ live, sim }, evidenceId, request);
      const refusal = answer.ok ? null : reviseRefusalOf(answer.status, answer.code);
      if (answer.ok || refusal === 'CONFLICT') {
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: transcriptQueryKey(evidenceId, live) }),
          queryClient.invalidateQueries({ queryKey: transcriptRevisionsQueryKey(evidenceId, live) }),
        ]);
      }
      if (answer.ok) return { ok: true, revision: answer.data };
      return { ok: false, refusal: refusal ?? 'OTHER', status: answer.status, code: answer.code, failure: answer.failure };
    },
    [evidenceId, live, queryClient, sim],
  );
}
