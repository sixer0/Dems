/**
 * One role gate for the controls ruling R2 locks on the phone and the tablet (E-fix row FX-M2;
 * decision D201 R2, which amends 04_client_integration_spec §6.3's mobile list): Start Session (Home
 * quick action, Sessions hub, any start entry) needs `SESSION_START`; Install update needs
 * `MAINTENANCE`. The web console locks the same controls (`selectCan` plus "Requires the X role",
 * `apps/core-web/src/features/dashboard/active-session-panel.tsx`), and the Core refuses them with 403.
 *
 * The existing mobile pattern (device restart, archive, storage policy): the control stays in place,
 * disabled, with the sentence "Requires the X role" naming the least privileged role that holds the
 * permission (`requiredRoleFor`, the refusal presenter's own rule). The role is the store's
 * (`selectCan`): in Live mode the replica's `operators` slice, which the Core replaces with the
 * `session.updated` of a role change, so the gate follows a role change at once and without a new
 * sign-in; in Simulated mode the simulator's signed-in operator.
 *
 * `known` is false while no signed-in operator is in the store (Live mode before the first
 * snapshot). Ruling W93-11 (decision D243, post-review fix FXR-M): ONE rule for the buttons and the
 * route — the client never lets a gated action through on an unknown role. The control is disabled WITH
 * the reason "Checking your permissions…" (`hint`), and a deep link to the wizard waits for the role
 * (`useStartEntryGuard` returns `'checking'`), then applies the same gate. Before, the buttons were
 * disabled with no reason while the deep link opened the wizard ("the Core decides").
 */
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { roleHas, selectRole, useSim, type OperatorRole, type Permission } from '@dems/shared/sim';
import { requiredRoleFor } from '@/runtime';

export interface RoleGateState {
  /** The signed-in operator's role holds the permission. */
  readonly allowed: boolean;
  /** A signed-in operator's role is known. */
  readonly known: boolean;
  /** The role is known and lacks the permission: the control is locked and says why. */
  readonly locked: boolean;
  /** The least privileged role that holds the permission (the one the sentence names), or null. */
  readonly requiredRole: OperatorRole | null;
}

/** The gate for a role and a permission (pure; the hook below reads the role from the store). */
export function roleGateFor(role: OperatorRole | null, permission: Permission): RoleGateState {
  const allowed = roleHas(role, permission);
  const known = role !== null;
  return { allowed, known, locked: known && !allowed, requiredRole: requiredRoleFor(permission) };
}

export interface RoleGate extends RoleGateState {
  /** "Requires the X role" while locked, "Checking your permissions…" while the role is unknown, else null. */
  readonly hint: string | null;
}

export function useRoleGate(permission: Permission): RoleGate {
  const { t } = useTranslation();
  const role = useSim(selectRole);
  return useMemo(() => {
    const gate = roleGateFor(role, permission);
    const hint = !gate.known
      ? t('mobile.rbac.checking')
      : gate.locked && gate.requiredRole !== null
        ? t('common.rbac.requiresRole', { role: t(`common.roles.${gate.requiredRole}`) })
        : null;
    return { ...gate, hint };
  }, [role, permission, t]);
}
