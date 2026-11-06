/**
 * Simulator reads for the Evidence screens (04_mobile_specs §5.1, §5.6; D19).
 *
 * `useSim` compares results shallowly and the engine publishes a new state every tick, so each
 * selector returns a primitive, a state-held object (kept by reference until it changes) or an
 * array of those; never a fresh nested object (relay F74-13). View-model maths live in
 * `evidence-model.ts`. Every function that calls a hook is named `use…` (D66: React Compiler).
 */
import { useMemo } from 'react';
import {
  Permission,
  selectCan,
  selectEvidence,
  selectEvidenceById,
  selectOperator,
  useSim,
  type EvidenceItem,
  type OperatorRole,
} from '@dems/shared/sim';
import { filterEvidence, type EvidenceQuery } from './evidence-model';

/** Every evidence item, as the simulator holds them. */
export function useEvidenceItems(): EvidenceItem[] {
  return useSim(selectEvidence);
}

/** The visible rows for a filter, search and sort. */
export function useEvidenceRows(query: EvidenceQuery): EvidenceItem[] {
  const items = useEvidenceItems();
  const { filter, query: text, sort } = query;
  return useMemo(() => filterEvidence(items, { filter, query: text, sort }), [items, filter, text, sort]);
}

/** One item by ID, or null (unknown ID, or not loaded). */
export function useEvidenceItem(evidenceId: string | null): EvidenceItem | null {
  return useSim((s) => (evidenceId === null ? null : selectEvidenceById(s, evidenceId)));
}

export interface SignedInOperator {
  id: string | null;
  displayName: string | null;
  role: OperatorRole | null;
}

/** The signed-in operator's ID, display name and role (flat values). */
export function useSignedInOperator(): SignedInOperator {
  const [id, displayName, role] = useSim((s) => {
    const operator = selectOperator(s);
    return [operator?.id ?? null, operator?.displayName ?? null, operator?.role ?? null] as const;
  });
  return useMemo(() => ({ id, displayName, role }), [id, displayName, role]);
}

/**
 * Archive needs EVIDENCE_REVIEW (SUPERVISOR); the UI disables it otherwise (sim `archiveEvidence`).
 *
 * Site S5-5 (backend task W74; 04_client_integration_spec §8.7, §6.1): a display hint, kept. In Live
 * mode the role is the replica's (`operators`, replaced by the Core on a role change), and the Core
 * decides the call itself (operation 43 answers 403 to a role without the permission, which the
 * archive dialog shows through the refusal presenter).
 */
export function useCanArchive(): boolean {
  return useSim((s) => selectCan(s, Permission.EVIDENCE_REVIEW));
}

/** Display names of operators by ID (custody rows), from the simulator's operator list. */
export function useOperatorNames(): Readonly<Record<string, string>> {
  const operators = useSim((s) => s.operators);
  return useMemo(() => Object.fromEntries(operators.map((operator) => [operator.id, operator.displayName])), [operators]);
}
