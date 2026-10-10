import { useQuery } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { SttConfigSchema, type SttConfig } from '@dems/shared/api';
import { selectIsSignedIn, useSim, useSimInstance, type Sim } from '@dems/shared/sim';
import { operatorScope, useOperatorId } from '@/lib/operator-query-scope';
import { reportRuntimeIssue, useMobileLive, type MobileLiveSim } from '@/runtime';
import { selectSttAuditMark, sttStatusOf, type SttStatusView } from './stt-status-model';

/**
 * The backstop of the status read. The realtime signals below cover a save made on the web console
 * (its audit row), a link that came back and a screen that was opened. A connection test (op 92)
 * leaves no audit row, so its result reaches this device on the next read; this interval bounds how
 * long that takes. It is the query library's own interval, not a timer of this folder.
 */
export const STT_STATUS_BACKSTOP_MS = 30_000;

export type SttConfigPhase = 'signed-out' | 'loading' | 'ready' | 'error';

export interface SttConfigRead {
  readonly phase: SttConfigPhase;
  /** The last good answer, also while a later read failed (`stale`). Null before the first answer. */
  readonly view: SttStatusView | null;
  /** The newest read failed but an earlier answer is shown. */
  readonly stale: boolean;
  /** Reads again now. The caller owns the rate limit (the section's cooldown). */
  retry(): void;
}

/**
 * Operation 90 `getSttConfig` for the Settings status block (blueprint row 118; C3 §2.5; ux §8a).
 *
 * - READ ONLY: this folder never imports an update or a test-connection call; the only operation it
 *   names is `getSttConfig` (the static test pins it).
 * - LIVE: the typed client of the Live source (`live.client`), as `features/home/use-health.ts`. The
 *   client validates the answer against the contract, so a shape outside it is never shown.
 * - SIMULATED and HEARTBEAT: the in-app simulator answers the same operation (`sim.request`), and
 *   the answer is checked against the same schema here.
 * - FOLLOWS A WEB EDIT: operation 91 appends one `STT_CONFIG_CHANGED` audit row; the `audit` slice
 *   carries it to this device (the replicated state in LIVE, the one store in the simulator), and
 *   the change of `selectSttAuditMark` reads the configuration again. A RESYNCED socket (the link
 *   came back, or the replica was rebuilt) reads it again, and so does every mount of the screen.
 * - The query key names the service that answered, so an answer of the simulator never shows as the
 *   Core's after a change of the Core link source.
 */
export function useSttConfig(): SttConfigRead {
  const live = useMobileLive();
  const sim = useSimInstance();
  const signedIn = useSim(selectIsSignedIn);
  const auditMark = useSim(selectSttAuditMark);
  const operatorId = useOperatorId();

  const query = useQuery({
    // The operator ends the key (fix wave K, G81b-02): the read needs a signed-in operator and its answer is that operator's.
    queryKey: [...(live ? STT_CONFIG_KEY_LIVE : STT_CONFIG_KEY_SIMULATED), operatorScope(operatorId)] as const,
    queryFn: () => (live ? readFromCore(live) : readFromSimulator(sim)),
    enabled: signedIn,
    refetchInterval: STT_STATUS_BACKSTOP_MS,
  });
  const { refetch, data, error, errorUpdatedAt, status } = query;

  // A web edit: a new `STT_CONFIG_CHANGED` row in the audit slice. The mark at mount is the baseline.
  const seenMark = useRef(auditMark);
  useEffect(() => {
    if (auditMark === seenMark.current) return;
    seenMark.current = auditMark;
    if (signedIn) void refetch();
  }, [auditMark, refetch, signedIn]);

  // LIVE: the link came back or the replica was resynchronised. One request, however many readers.
  useEffect(() => {
    if (!live || !signedIn) return undefined;
    return live.onResync((event) => {
      if (event.phase === 'RESYNCED') void refetch({ cancelRefetch: false });
    });
  }, [live, refetch, signedIn]);

  // Layer 2 of the error rules: every NEW failure is one record in the persistent runtime log.
  const reported = useRef(0);
  useEffect(() => {
    if (status !== 'error' || errorUpdatedAt === reported.current) return;
    reported.current = errorUpdatedAt;
    reportRuntimeIssue('warn', 'transcription.status.read', error, { mode: live ? 'LIVE' : 'SIMULATED' });
  }, [status, error, errorUpdatedAt, live]);

  const view = data === undefined ? null : sttStatusOf(data);
  const phase: SttConfigPhase = view !== null ? 'ready' : status === 'error' ? 'error' : signedIn ? 'loading' : 'signed-out';
  return {
    phase,
    view,
    stale: view !== null && status === 'error',
    retry: () => {
      if (signedIn) void refetch({ cancelRefetch: false });
    },
  };
}

const STT_CONFIG_KEY_LIVE = ['stt-config', 'core-server'] as const;
const STT_CONFIG_KEY_SIMULATED = ['stt-config', 'simulated'] as const;

/** `GET /api/v1/transcription/config` of the Core server through the typed client. */
async function readFromCore(live: MobileLiveSim): Promise<SttConfig> {
  const answer = await live.client.call('getSttConfig');
  if (answer.ok) return answer.data;
  // The class of the failure and its status only (the typed client has already reported a failure
  // that is no answer of the contract); never the text of an answer.
  throw new Error(`getSttConfig -> ${answer.kind}${answer.status === null ? '' : ` (HTTP ${answer.status})`}`);
}

/** The same operation answered by the in-app simulator, checked against the contract's schema. */
function readFromSimulator(sim: Sim): SttConfig {
  const response = sim.request({ method: 'GET', path: '/api/v1/transcription/config' });
  if (response.status !== 200) throw new Error(`getSttConfig -> simulator (HTTP ${response.status})`);
  const parsed = SttConfigSchema.safeParse(response.body);
  if (!parsed.success) throw new Error('getSttConfig -> simulator (outside the contract)');
  return parsed.data;
}
