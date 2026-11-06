/**
 * Page-local selectors. Each returns a store-owned reference (or primitives), so `useSim`'s shallow
 * comparison stays stable (review 40 rule R1).
 */
import type { SimOperator } from '@dems/shared/sim'

export const selectOperators = (s: { operators: SimOperator[] }): SimOperator[] => s.operators
