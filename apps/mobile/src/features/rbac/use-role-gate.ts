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
 *
 * M3-20 (G-12, decision D163; audit row 212): in Live mode the gate reads the Live session's OWN
 * effective permission list (`session.permissions`, register V5: the list the Core sent at sign-in
 * and replaces with every `session.updated`), not the role alone. That list already holds the
 * identity extras (D55, V3: the vendor `root` account holds CAPTURE_CONFIG whatever its role), so
 * the tablet gives `root` the capture selector and camera search as the Core and the web
 * (`usePermission(live, CAPTURE_CONFIG)`) do. The Simulated lane, and Live before a session
 * exists, keep `roleHas` on the store's role. `known` (and so "Checking your permissions…") still
 * follows the store's role, and the sentence still names the roles of the matrix.
 */
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useLiveSelector } from '@dems/shared/live';
import { roleHas, selectRole, useSim, type OperatorRole, type Permission } from '@dems/shared/sim';
import { requiredRoleFor, requiredRolesFor, roleNamesText } from '@/runtime';

export interface RoleGateState {
  /** The signed-in operator's role holds the permission. */
  readonly allowed: boolean;
  /** A signed-in operator's role is known. */
  readonly known: boolean;
  /** The role is known and lacks the permission: the control is locked and says why. */
  readonly locked: boolean;
  /** The least privileged role that holds the permission (the one the sentence names), or null. */
  readonly requiredRole: OperatorRole | null;
  /** Every role that holds the permission (JT-16: the sentence names them all). */
  readonly requiredRoles: readonly OperatorRole[];
}

/**
 * The gate for an operator (pure; M3-20). `sessionPermissions` is the Live session's own effective
 * list (V5), or null in the simulator and while no Live session exists: then the role decides
 * (`roleHas`). With a list, the list decides, so an identity grant (D55) allows and a permission
 * the Core withheld locks, whatever the role's matrix row says.
 */
export function operatorPermissionGate(
  role: OperatorRole | null,
  permission: Permission,
  sessionPermissions: readonly string[] | null,
): RoleGateState {
  const allowed = role !== null && (sessionPermissions !== null ? sessionPermissions.includes(permission) : roleHas(role, permission));
  const known = role !== null;
  return { allowed, known, locked: known && !allowed, requiredRole: requiredRoleFor(permission), requiredRoles: requiredRolesFor(permission) };
}

/** The gate for a role and a permission, by the role alone (pure; the simulator's rule). */
export function roleGateFor(role: OperatorRole | null, permission: Permission): RoleGateState {
  return operatorPermissionGate(role, permission, null);
}

/** The Live session's own permission list (a member of the source: a stable reference), or null. */
const readSessionPermissions = (live: { readonly session: { readonly permissions: readonly string[] } | null } | null): readonly string[] | null =>
  live?.session?.permissions ?? null;

export interface RoleGate extends RoleGateState {
  /** "Requires the X role" while locked, "Checking your permissions…" while the role is unknown, else null. */
  readonly hint: string | null;
}

export function useRoleGate(permission: Permission): RoleGate {
  const { t } = useTranslation();
  const role = useSim(selectRole);
  const sessionPermissions = useLiveSelector(readSessionPermissions);
  return useMemo(() => {
    const gate = operatorPermissionGate(role, permission, sessionPermissions);
    const hint = !gate.known
      ? t('mobile.rbac.checking')
      : gate.locked && gate.requiredRole !== null
        ? t('common.rbac.requiresRole', { role: roleNamesText(t, gate.requiredRoles) })
        : null;
    return { ...gate, hint };
  }, [role, permission, sessionPermissions, t]);
}
