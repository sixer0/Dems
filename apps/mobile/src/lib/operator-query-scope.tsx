/**
 * The operator in the key of every cached answer that depends on who asked (fix wave K, driver M2;
 * gate finding G81b-02, ruling D221 (3)).
 *
 * What went wrong: operation 40's answer (`access`, `exports`) was cached under a key without the
 * operator. After a change of operator on one tablet the next operator's first view of the item the
 * previous one had open drew the PREVIOUS operator's `access` while it was read again, so the page
 * view asked operations 84 / 86 - and the Core wrote two `ACCESS_DENIED` rows against the new
 * operator for a page view.
 *
 * | Rule | How |
 * |------|-----|
 * | A cached answer that depends on the signed-in operator's role or case scope carries the operator in its key | `operatorScope(id)` is the LAST element of the key; another operator has another key, so nothing of the previous one is drawn or used "while it refetches" |
 * | Nothing of an operator outlives the sign-in | `OperatorQueryScope` (mounted once, in `AppProviders`) removes every query with an operator scope when the operator changes or signs out |
 *
 * The scope is an identifier of the operator (`OPR-…`), never a name, a role or a token.
 */
import { useQueryClient, type QueryClient, type QueryKey } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { selectOperator, useSim } from '@dems/shared/sim';

const PREFIX = 'operator:';
const NONE = 'none';

/** The key element of one operator; `null` = nobody is signed in. */
export function operatorScope(operatorId: string | null): string {
  return `${PREFIX}${operatorId ?? NONE}`;
}

/** Whether a query key carries an operator scope. */
export function isOperatorScoped(queryKey: QueryKey): boolean {
  return queryKey.some((part) => typeof part === 'string' && part.startsWith(PREFIX));
}

/** The ID of the signed-in operator, or null. A primitive: a component re-renders only when it changes. */
export function useOperatorId(): string | null {
  return useSim((state) => selectOperator(state)?.id ?? null);
}

/** Removes every cached answer that was read for an operator. */
export function clearOperatorQueries(client: QueryClient): void {
  client.removeQueries({ predicate: (query) => isOperatorScoped(query.queryKey) });
}

/**
 * Mounted once under the query client and the simulator: when the operator changes (sign-out, or
 * another operator signs in), every operator-scoped answer is removed from the cache. Draws nothing.
 */
export function OperatorQueryScope(): null {
  const client = useQueryClient();
  const operatorId = useOperatorId();
  const seen = useRef(operatorId);
  useEffect(() => {
    if (seen.current === operatorId) return;
    const previous = seen.current;
    seen.current = operatorId;
    // The first sign-in of a process has nothing to remove; every later change has.
    if (previous !== null) clearOperatorQueries(client);
  }, [client, operatorId]);
  return null;
}
