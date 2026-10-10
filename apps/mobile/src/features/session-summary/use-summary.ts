/**
 * Session Summary data and the acknowledgement (04_mobile_specs §4.7, §5.6; SCR-02; D61; D73 F74-13).
 *
 * Selectors return primitives or the store's own references (the tracks array, the steps array), so
 * `useSim`'s shallow compare keeps the screen quiet while the simulator ticks audio at 20 Hz.
 * `acknowledgeSummary` runs at most once per screen (SCR-02) and a refusal is shown and written to
 * the persistent runtime log (`dems.mobile.log.v1`), never swallowed.
 * Every function that calls a hook is named `use*` (D66: the device build runs the React Compiler).
 *
 * Live mode (backend task, plan row W72; 04_client_integration_spec §8.6 S2-4, §8.7 S4-4): the store
 * is the Live source, so every read here is the Core's replicated state (`session`, `sessionHistory`,
 * `evidence`, `time`, `lastSealed*`). The one command, the acknowledgement (operation 37
 * `acknowledgeSessionSummary`), goes through `useCoreActions()` and `settle` in both modes: in Simulated
 * mode `settle` runs the continuation before it returns, exactly as the earlier synchronous call did.
 */
import { useToast } from 'heroui-native';
import { useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import type { TimeSource } from '@dems/shared/domain';
import { settle, useCoreActions } from '@dems/shared/live';
import {
  isHostClockTime,
  selectEvidenceBySessionId,
  selectOperatorById,
  selectPendingSummaryId,
  selectSessionHistoryById,
  useSim,
  useSimInstance,
  type EvidenceTrack,
  type FaultKind,
  type FinalizationStepState,
  type SessionOutcome,
  type SubjectType,
} from '@dems/shared/sim';
import { reportRuntimeIssue, useCoreErrorPresenter, useCoreLink } from '@/runtime';
import { timeSourceAt } from './sim-adapter';
import { summaryTimeSource } from './summary.model';

/** The finished session (history entry) and where the route stands, as flat values. */
export interface SummarySession {
  readonly found: boolean;
  readonly activeId: string | null;
  readonly activeState: string | null;
  readonly outcome: SessionOutcome | null;
  readonly caseNumber: string | null;
  readonly subjectName: string | null;
  readonly subjectType: SubjectType | null;
  readonly investigatorName: string | null;
  readonly room: string | null;
  readonly startedAt: number | null;
  readonly endedAt: number | null;
  readonly durationMs: number;
  readonly sizeBytes: number;
  readonly faultKind: FaultKind | null;
  /** SCR-02: this is the last sealed session and its summary is not acknowledged yet. */
  readonly pending: boolean;
  readonly startSource: TimeSource | null;
  readonly endSource: TimeSource | null;
  /** Wave H closing pass Z2: the start / end source is the Core's host system clock (`summaryTimeSource`). */
  readonly startHostClock: boolean;
  readonly endHostClock: boolean;
}

export function useSummarySession(sessionId: string): SummarySession {
  return useSim((s) => {
    const entry = selectSessionHistoryById(s, sessionId);
    // Wave H closing pass Z2: the session's own members first; the live slice's ring only for an entry without them.
    const hostClock = isHostClockTime(s.time);
    const start = summaryTimeSource({ member: entry?.startTimeSource, ring: timeSourceAt(s.time.history, entry?.startedAt ?? null), hostClock });
    const end = summaryTimeSource({ member: entry?.endTimeSource, ring: timeSourceAt(s.time.history, entry?.endedAt ?? null), hostClock });
    return {
      found: entry !== null,
      activeId: s.session?.id ?? null,
      activeState: s.session?.state ?? null,
      outcome: entry?.outcome ?? null,
      caseNumber: entry?.caseNumber ?? null,
      subjectName: entry?.subjectName ?? null,
      subjectType: entry?.subjectType ?? null,
      investigatorName: entry ? (selectOperatorById(s, entry.investigatorId)?.displayName ?? entry.investigatorId) : null,
      room: entry?.room ?? null,
      startedAt: entry?.startedAt ?? null,
      endedAt: entry?.endedAt ?? null,
      durationMs: entry?.durationMs ?? 0,
      sizeBytes: entry?.sizeBytes ?? 0,
      faultKind: entry?.faultKind ?? null,
      pending: selectPendingSummaryId(s) === sessionId,
      startSource: (start?.source ?? null) as TimeSource | null,
      endSource: (end?.source ?? null) as TimeSource | null,
      startHostClock: start?.host ?? false,
      endHostClock: end?.host ?? false,
    };
  });
}

/** The sealed evidence item of the session (book §11.3 fields), or null. */
export interface SummaryEvidence {
  readonly id: string;
  readonly manifestHash: string;
  readonly signatureValue: string;
  readonly signatureKeyId: string;
  readonly lifecycleStage: string;
  readonly sealedAt: number | null;
  readonly tracks: readonly EvidenceTrack[];
}

export function useSummaryEvidence(sessionId: string): SummaryEvidence | null {
  return useSim((s) => {
    const item = selectEvidenceBySessionId(s, sessionId);
    if (!item) return null;
    return {
      id: item.id,
      manifestHash: item.manifestHash,
      signatureValue: item.signature.value,
      signatureKeyId: item.signature.keyId,
      lifecycleStage: item.lifecycleStage,
      sealedAt: item.sealedAt,
      tracks: item.tracks,
    };
  });
}

/** The finished pipeline, kept only while this is still the simulator's current session. */
export interface SummaryFinalization {
  readonly steps: readonly FinalizationStepState[];
  readonly stoppedAt: number | null;
  readonly sealedAt: number | null;
}

export function useSummaryFinalization(sessionId: string): SummaryFinalization | null {
  return useSim((s) => {
    const session = s.session;
    if (!session || session.id !== sessionId || session.finalization.startedAt === null) return null;
    return { steps: session.finalization.steps, stoppedAt: session.stoppedAt, sealedAt: session.sealedAt };
  });
}

/** What the screen does once the acknowledgement settled (S2-4: what followed the old `if`). */
export interface AcknowledgeHandlers {
  /** The summary is acknowledged now, or needs no acknowledgement (already acknowledged, a past session). */
  readonly ok: () => void;
  /** Runs once after `ok` or a refusal, in every path: the pending control's `release`. */
  readonly done?: () => void;
}

/**
 * SCR-02 and settle site S2-4: acknowledges this summary once, then runs `ok` (the navigation). On a
 * refusal `ok` does not run: the screen stays and its control returns to idle.
 *
 * - S4-4: whether a request is needed is read from the store (the replica in LIVE) before the call; a
 *   summary that is not pending (a past session, or one another console acknowledged) sends nothing.
 * - One request at a time, whichever control asked (Done, View in Evidence, Back): a second call
 *   while one is out is released at once and sends nothing.
 * - In LIVE a rejection goes to the runtime's presenter first (the denied toast with the role, the
 *   outage, the limit; mobile rule 2) and is logged at `warn`; otherwise the step-80 toast and an
 *   `error` record, as before.
 * - Never called from an effect: only an operator's press acknowledges (decision D158, F69-1).
 */
export function useAcknowledgeSummary(sessionId: string): (handlers: AcknowledgeHandlers) => void {
  const sim = useSimInstance();
  const actions = useCoreActions();
  const live = useCoreLink().source === 'LIVE';
  const presentCoreError = useCoreErrorPresenter();
  const { toast } = useToast();
  const { t } = useTranslation();
  const acknowledged = useRef(false);
  const inFlight = useRef(false);
  return useCallback(
    ({ ok, done }: AcknowledgeHandlers) => {
      if (inFlight.current) {
        done?.();
        return;
      }
      if (acknowledged.current || selectPendingSummaryId(sim.store.getState()) !== sessionId) {
        acknowledged.current = true;
        try {
          ok();
        } finally {
          done?.();
        }
        return;
      }
      inFlight.current = true;
      settle(() => actions.acknowledgeSummary(sessionId), {
        ok: () => {
          acknowledged.current = true;
          ok();
        },
        fail: (error) => {
          if (live && presentCoreError(error)) {
            reportRuntimeIssue('warn', 'features.sessionSummary.acknowledge', error, { sessionId });
            return;
          }
          toast.show({ variant: 'danger', label: t('features.session-summary.actions.failed') });
          reportRuntimeIssue('error', 'features.sessionSummary.acknowledge', error, { sessionId });
        },
        done: () => {
          inFlight.current = false;
          done?.();
        },
      });
    },
    [sim, actions, live, presentCoreError, sessionId, toast, t],
  );
}
