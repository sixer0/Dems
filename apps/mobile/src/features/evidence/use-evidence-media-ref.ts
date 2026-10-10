/**
 * Which bundled media belongs to an evidence item in Live mode (backend task W74; 01_specs §11
 * MS-2; 04_client_integration_spec §14 point 7).
 *
 * In Live mode the Core server decides whether the demo package this app bundles belongs to an
 * item: operation 40 `getEvidence` answers `EvidenceMediaRef` (`DEMO_PACKAGE` with its suffix, or
 * `NONE` for a session recorded in Live mode). The detail shows bundled media, and runs the
 * bundled-package check beside the Core's verdict, only for `DEMO_PACKAGE`; the package is looked
 * up by the suffix the Core named. Outside Live mode nothing is asked: the suffix join of
 * `evidence-model.ts` stands, as before.
 *
 * | Rule | How |
 * |------|-----|
 * | The ONE way to call an operation that is no simulator action (rule 1 of the mobile page rows) | `useMobileLive()?.client.call('getEvidence', …)` |
 * | Graceful degradation | Without an answer no bundled media is shown and the screen says so; the Core's verdict still works (operation 41 does not need it) |
 * | Logging | A failed read gets one record in the persistent runtime log, with its class and status only (never a text of the answer) |
 *
 * A read is no command: a failure shows no toast (LB-6 words commands); the media tab says the
 * reference is unavailable.
 *
 * Wave H C2 (G94-02, G94-05, G81-07): the ONE call keeps the whole of what operation 40 states
 * beside the item - the media source with its files and reason, what this caller may do, the
 * finished exports - read by the one reader `item-facts.ts` (`detail`). The query holds those facts,
 * never the item (the replicated slice is the item's source) and no path of any kind.
 */
import { useQuery } from '@tanstack/react-query';
import type { EvidenceMediaRef } from '@dems/shared/api';
import { reportRuntimeIssue, useMobileLive, type MobileLiveSim } from '@/runtime';
import { readDetailFacts, type DetailFacts } from './item-facts';

/** What the query keeps of one answer of operation 40. */
interface EvidenceDetailRead {
  readonly media: EvidenceMediaRef;
  readonly detail: DetailFacts;
}

export type EvidenceMediaRefState =
  /** Not Live: nothing is asked; the suffix join stands. */
  | { readonly status: 'not-live' }
  | { readonly status: 'loading' }
  | { readonly status: 'ready'; readonly media: EvidenceMediaRef; readonly detail: DetailFacts }
  /** No answer: no bundled media is shown. */
  | { readonly status: 'unavailable' };

const NOT_LIVE: EvidenceMediaRefState = { status: 'not-live' };
const LOADING: EvidenceMediaRefState = { status: 'loading' };
const UNAVAILABLE: EvidenceMediaRefState = { status: 'unavailable' };

/** The query key of one item's media reference on the Core server. */
export function evidenceMediaRefKey(evidenceId: string) {
  return ['core-server', 'evidence-media', evidenceId] as const;
}

async function readMediaRef(live: MobileLiveSim, evidenceId: string): Promise<EvidenceDetailRead> {
  const answer = await live.client.call('getEvidence', { params: { id: evidenceId } });
  if (answer.ok) return { media: answer.data.media, detail: readDetailFacts(answer.data) };
  reportRuntimeIssue('warn', 'evidence.mediaRef', `getEvidence -> ${answer.kind}`, { evidenceId, kind: answer.kind, status: answer.status });
  throw new Error(`getEvidence -> ${answer.kind}${answer.status === null ? '' : ` (HTTP ${answer.status})`}`);
}

export function useEvidenceMediaRef(evidenceId: string): EvidenceMediaRefState {
  const live = useMobileLive();
  const query = useQuery({
    queryKey: evidenceMediaRefKey(evidenceId),
    enabled: live !== null,
    retry: false,
    queryFn: () => {
      if (live === null) throw new Error('getEvidence: no Live source');
      return readMediaRef(live, evidenceId);
    },
  });
  if (live === null) return NOT_LIVE;
  if (query.data !== undefined) return { status: 'ready', media: query.data.media, detail: query.data.detail };
  return query.isError ? UNAVAILABLE : LOADING;
}
