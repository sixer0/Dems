/**
 * Simulator reads for the Sessions hub (04_mobile_specs §4.9, §5.1, §5.6; D19).
 *
 * `useSim` compares results shallowly and the engine publishes a new state every 100 ms clock
 * tick, so each selector returns a primitive, a state-held object (kept by reference until it
 * changes), an array of those, or a tuple of primitives; never a fresh nested object (relay
 * F74-13). Timers read the simulator clock (relay F74-09). View-model rules live in
 * `sessions-model.ts`. Every function that calls a hook is named `use…` (D66: React Compiler).
 */
import { useMemo } from 'react';
import type { SessionState } from '@dems/shared/domain';
import {
  selectOperatorById,
  selectPendingSummaryId,
  selectSessionHistory,
  selectSessionHistoryById,
  startOfWibDay,
  useSim,
  type SessionHistoryEntry,
} from '@dems/shared/sim';
import { useRecordingTickerSeconds } from '@/runtime';
import {
  buildRows,
  elapsedSeconds,
  filterCounts,
  filterRows,
  historyRow,
  activeRow,
  type ActiveSessionFields,
  type HubFilter,
  type HubQuery,
  type SessionRow,
} from './sessions-model';

/** Every finished session, newest first (SEALED and INCOMPLETE). */
export function useSessionHistory(): SessionHistoryEntry[] {
  return useSim(selectSessionHistory);
}

/** The session whose summary still needs acknowledging, or null (SCR-02). */
export function usePendingSummaryId(): string | null {
  return useSim(selectPendingSummaryId);
}

/** The simulator's current session state, or null (Start button and active card). */
export function useCurrentSessionState(): SessionState | null {
  return useSim((s) => s.session?.state ?? null);
}

/** The current session's flat fields, or null when there is none (one tuple of primitives). */
export function useActiveSessionFields(): ActiveSessionFields | null {
  const [id, state, caseNumber, subjectName, subjectType, investigatorId, room, createdAt, startedAt, evidenceId, faultKind] = useSim((s) => {
    const session = s.session;
    if (!session) return [null, null, null, null, null, null, null, null, null, null, null] as const;
    return [
      session.id,
      session.state,
      session.input.caseNumber,
      session.input.subjectName,
      session.input.subjectType,
      session.input.investigatorId,
      session.input.room,
      session.createdAt,
      session.startedAt,
      session.evidenceId,
      session.fault?.kind ?? null,
    ] as const;
  });
  return useMemo(() => {
    if (id === null || state === null || createdAt === null) return null;
    return {
      id,
      state,
      caseNumber: caseNumber ?? '',
      subjectName: subjectName ?? '',
      subjectType: subjectType ?? 'LAINNYA',
      investigatorId: investigatorId ?? '',
      room: room ?? '',
      createdAt,
      startedAt,
      evidenceId,
      faultKind,
    };
  }, [id, state, caseNumber, subjectName, subjectType, investigatorId, room, createdAt, startedAt, evidenceId, faultKind]);
}

/** Start of the simulator's current WIB day (changes once a day: the Today filter). */
export function useSimDayStart(): number {
  return useSim((s) => startOfWibDay(s.clock.now));
}

/** Every hub row (current session first, then the history), newest first. */
export function useSessionRows(): SessionRow[] {
  const history = useSessionHistory();
  const active = useActiveSessionFields();
  const pendingId = usePendingSummaryId();
  return useMemo(() => buildRows(history, active, pendingId), [history, active, pendingId]);
}

export interface HubRows {
  rows: SessionRow[];
  /** Every row before the filter and search (the "no history at all" empty state). */
  total: number;
  counts: Record<HubFilter, number>;
}

/** The visible rows for a filter and search, plus the per-filter counts. */
export function useHubRows(query: HubQuery): HubRows {
  const all = useSessionRows();
  const dayStart = useSimDayStart();
  const { filter, query: text } = query;
  return useMemo(
    () => ({
      rows: filterRows(all, { filter, query: text }, dayStart),
      total: all.length,
      counts: filterCounts(all, text, dayStart),
    }),
    [all, filter, text, dayStart],
  );
}

/** One session by ID: a history row, the current session's row, or null. */
export function useSessionRow(sessionId: string | null): SessionRow | null {
  const entry = useSim((s) => (sessionId === null ? null : selectSessionHistoryById(s, sessionId)));
  const pendingId = usePendingSummaryId();
  const active = useActiveSessionFields();
  return useMemo(() => {
    if (entry) return historyRow(entry, pendingId);
    if (active && active.id === sessionId) return activeRow(active);
    return null;
  }, [entry, pendingId, active, sessionId]);
}

/**
 * Whole recording seconds of the current session on the simulator clock (1 Hz re-render). In LIVE the Core
 * clock's ticker when it is ahead while RECORDING (post-review fix FXR-M, W93-1: the same second as the monitor,
 * the Recording bar and Home; `runtime/recording-elapsed.ts`).
 */
export function useLiveElapsedSeconds(): number {
  const fromStore = useSim((s) => elapsedSeconds(s.session?.startedAt ?? null, s.session?.stoppedAt ?? null, s.clock.now));
  return Math.max(fromStore, useRecordingTickerSeconds());
}

/** An operator's display name, or null (the investigator key-value). */
export function useOperatorName(operatorId: string | null): string | null {
  return useSim((s) => (operatorId ? (selectOperatorById(s, operatorId)?.displayName ?? null) : null));
}
