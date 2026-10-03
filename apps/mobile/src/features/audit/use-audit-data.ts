/**
 * Simulator reads for the Operator Audit View (04_mobile_specs §4.16, §5.1; step 87).
 *
 * Relay F74-13 (flat selectors): every `useSim` selector returns a primitive or a store-held
 * reference (the ring array, the operator list), never a fresh object; derived views are memoised
 * here. Every function that calls a hook is named `use…` (D66: the device build runs the React
 * Compiler). The chain status comes from the simulator's own `selectAuditChainBreak` (the AUDIT_TAMPER
 * row, EVT-30), reduced to its `seq`.
 */
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { selectAuditChainBreak, useSim, type AuditRow } from '@dems/shared/sim';
import { actorKindOf, authMethodOf, faultKindOf, filterAuditRows, rowRefs, type AuditQuery } from './audit-model';

/** The audit ring as the simulator holds it (oldest first, ≤ 1,000 rows). */
export function useAuditRingRows(): readonly AuditRow[] {
  return useSim((s) => s.audit.rows);
}

/** Rows ever appended (`seq` of the newest row). */
export function useAuditTotal(): number {
  return useSim((s) => s.audit.total);
}

/** The chain head hash (the newest row's hash, or genesis). */
export function useAuditHead(): string {
  return useSim((s) => s.audit.head);
}

/** `seq` of the row AUDIT_TAMPER altered, or null while the chain is intact. */
export function useChainBreakSeq(): number | null {
  return useSim((s) => selectAuditChainBreak(s)?.seq ?? null);
}

/** Display names of operators by ID, and the operator list for the filter menu. */
export function useAuditOperators(): { names: Readonly<Record<string, string>>; ids: readonly string[] } {
  const operators = useSim((s) => s.operators);
  return useMemo(
    () => ({
      names: Object.fromEntries(operators.map((operator) => [operator.id, operator.displayName])),
      ids: operators.map((operator) => operator.id),
    }),
    [operators],
  );
}

export interface AuditText {
  /** The event label by code (`common.auditType.<TYPE>`). */
  label: (row: AuditRow) => string;
  /** Operator name, "System" or "Unverified user". */
  actor: (row: AuditRow) => string;
  /** The line under the event: sign-in method, fault kind, then reference IDs. */
  secondary: (row: AuditRow) => string;
}

/** Translated row text. Labels come from i18n by code, never from the row's English `message`. */
export function useAuditText(names: Readonly<Record<string, string>>): AuditText {
  const { t } = useTranslation();
  return useMemo<AuditText>(() => {
    const actor = (row: AuditRow) => {
      switch (actorKindOf(row)) {
        case 'OPERATOR':
          return names[row.actorId ?? ''] ?? row.actorId ?? '';
        case 'UNVERIFIED':
          return t('securityAudit.audit.unverifiedUser');
        case 'SYSTEM':
          return t('securityAudit.audit.system');
      }
    };
    const secondary = (row: AuditRow) => {
      const parts: string[] = [];
      const method = authMethodOf(row);
      if (method) parts.push(t(`common.authMethod.${method}`));
      const fault = faultKindOf(row);
      if (fault) parts.push(t(`common.faultKind.${fault}`));
      parts.push(...rowRefs(row));
      return parts.join(' · ');
    };
    return { label: (row) => t(`common.auditType.${row.type}`), actor, secondary };
  }, [t, names]);
}

export interface AuditFeed {
  /** The rows the view shows: the live ring, or the ring as it was when Live was switched off. */
  readonly source: readonly AuditRow[];
  /** Entries written since Live was switched off (0 while live). */
  readonly pending: number;
  /** Visible rows for the query, newest first. */
  readonly rows: AuditRow[];
}

/**
 * The visible rows. With Live off the list holds still: new entries are counted, not inserted,
 * until Live is switched back on (the web page's Live switch, 30_page_security_audit §2).
 */
export function useAuditFeed(live: boolean, query: AuditQuery, text: AuditText): AuditFeed {
  const ring = useAuditRingRows();
  const total = useAuditTotal();
  const [held, setHeld] = useState<{ rows: readonly AuditRow[]; total: number } | null>(null);
  const [previousLive, setPreviousLive] = useState(live);
  // React's "adjust state when a prop changes", during render rather than in an effect.
  if (previousLive !== live) {
    setPreviousLive(live);
    setHeld(live ? null : { rows: ring, total });
  }
  const source = live || held === null ? ring : held.rows;
  const pending = live || held === null ? 0 : Math.max(0, total - held.total);
  const textOf = useCallback((row: AuditRow) => `${text.label(row)} ${text.actor(row)} ${text.secondary(row)}`, [text]);
  const rows = useMemo(() => filterAuditRows(source, query, textOf), [source, query, textOf]);
  return { source, pending, rows };
}
