/**
 * One integrity verification on the Core server, for Live mode (backend task W74;
 * 04_client_integration_spec §8.5 "verify", §14 point 7, §8.1 LB-2, LB-5, LB-6; AC-C-61).
 *
 * - The ONE way in (rule 1 of the mobile page rows): the `verify` action of `useCoreActions()`
 *   through `settle`. In Live mode it is operation 41 `verifyEvidence`; no demo control is called
 *   before it, after it or instead of it (D-1 of the web).
 * - The verdict of record is the Core's `EvidenceVerifyResult`, handed over as it came: nothing is
 *   computed into it here, and the tablet's own check of a bundled package never replaces it.
 * - LB-2: the "asking the Core" state spans the real request and lasts at least `minAskMs` on the
 *   store's clock (rule 7), so a quick answer does not flash.
 * - A rejection goes to the refusal presenter first (rule 2); what it leaves is the caller's
 *   (`onNoVerdict(false)`), and every rejection gets one record in the persistent runtime log.
 *
 * Simulated mode does not use this hook: the Simulated tab keeps its own paced flow and the guard
 * of `sim-adapter.ts`.
 */
import { useCallback, useState } from 'react';
import { settle, useCoreActions } from '@dems/shared/live';
import { useSimInstance, type EpochMs } from '@dems/shared/sim';
import { newCorrelationId, reportRuntimeIssue, useCoreErrorPresenter } from '@/runtime';
import type { CoreVerdict } from './evidence-model';
import { useClockDue } from './use-clock-due';

type Answer =
  | { readonly kind: 'verdict'; readonly verdict: CoreVerdict; readonly correlationId: string }
  | { readonly kind: 'error'; readonly error: unknown; readonly correlationId: string };

export interface CoreVerifyHandlers {
  /** The Core's verdict, at the later of its answer and `minAskMs` after the press. */
  readonly onVerdict: (verdict: CoreVerdict) => void;
  /** No verdict. `presented`: the presenter showed (or coalesced) the refusal; false: the caller words it. */
  readonly onNoVerdict: (presented: boolean) => void;
}

export interface CoreVerify {
  /** From the press until the verdict (or its absence) was handed over. */
  readonly asking: boolean;
  /** Sends one verification unless one is out. Returns whether it was sent. */
  run(): boolean;
}

export function useCoreVerify(evidenceId: string, minAskMs: number, { onVerdict, onNoVerdict }: CoreVerifyHandlers): CoreVerify {
  const sim = useSimInstance();
  const actions = useCoreActions();
  const presentCoreError = useCoreErrorPresenter();
  /** The store's clock at the press of the verification that is out; null while idle. */
  const [askedAt, setAskedAt] = useState<EpochMs | null>(null);
  const [answer, setAnswer] = useState<Answer | null>(null);

  const run = useCallback((): boolean => {
    if (askedAt !== null) return false;
    const correlationId = newCorrelationId('verify');
    setAnswer(null);
    setAskedAt(sim.store.getState().clock.now);
    settle(() => actions.verify(evidenceId), {
      ok: (verdict) => setAnswer({ kind: 'verdict', verdict, correlationId }),
      fail: (error) => setAnswer({ kind: 'error', error, correlationId }),
    });
    return true;
  }, [askedAt, sim, actions, evidenceId]);

  const handOver = useCallback(() => {
    if (answer === null) return;
    setAskedAt(null);
    setAnswer(null);
    if (answer.kind === 'verdict') {
      onVerdict(answer.verdict);
      return;
    }
    const presented = presentCoreError(answer.error);
    // The Live source reported the rejection itself (CL-24); this record names the screen's reading of it.
    reportRuntimeIssue(presented ? 'warn' : 'error', 'evidence.verify.core', answer.error, { evidenceId, presented }, answer.correlationId);
    onNoVerdict(presented);
  }, [answer, evidenceId, onVerdict, onNoVerdict, presentCoreError]);

  useClockDue(askedAt !== null && answer !== null ? askedAt : null, minAskMs, handOver);

  return { asking: askedAt !== null, run };
}
