/**
 * Simulator operators → the contract's `AuthOperator` (04_mobile_specs §6.1; dataset in
 * 12_sim_contract §4: OPR-001 budi.santoso INVESTIGATOR, OPR-002 andi.pratama SUPERVISOR,
 * OPR-003 rina.wijaya TECHNICIAN).
 */
import type { SimOperator } from '@dems/shared/sim';
import type { AuthOperator } from '@/runtime';

export function toAuthOperator(operator: SimOperator): AuthOperator {
  return {
    id: operator.id,
    displayName: operator.displayName,
    initials: operator.initials,
    role: operator.role,
    username: operator.username,
  };
}

export function findAuthOperator(operators: readonly SimOperator[], operatorId: string | null | undefined): AuthOperator | null {
  if (!operatorId) return null;
  const operator = operators.find((candidate) => candidate.id === operatorId);
  return operator ? toAuthOperator(operator) : null;
}
