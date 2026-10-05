/**
 * Roles, permissions and grants: the shared vocabulary as rows, and back (plan row W20; database
 * contract §4.1 to §4.3, SD-5, MG-8; spec AC-B-17).
 *
 * No migration holds a role, a permission or a grant: the seed writes them from the shared
 * vocabulary (`OperatorRole`, `Permission`, `ROLE_PERMISSIONS`), so the database can never hold
 * a matrix that differs from the one both clients and the simulator read. `sort_order` is the
 * place in the declaration (1-based). Pure: nothing here reads a clock or a database.
 */
import { OperatorRole, Permission, ROLE_PERMISSIONS } from '@dems/shared/sim';
import type { PermissionRow, RolePermissionRow, RoleRow } from '../schema';

export interface RbacRows {
  roles: RoleRow[];
  permissions: PermissionRow[];
  rolePermissions: RolePermissionRow[];
}

/** The three RBAC tables as the shared vocabulary states them, in declaration order. */
export function rbacRows(): RbacRows {
  const roleIds = Object.values(OperatorRole);
  const permissionIds = Object.values(Permission);
  return {
    roles: roleIds.map((id, index) => ({ id, sortOrder: index + 1 })),
    permissions: permissionIds.map((id, index) => ({ id, sortOrder: index + 1 })),
    rolePermissions: roleIds.flatMap((roleId) =>
      (ROLE_PERMISSIONS[roleId] as readonly Permission[]).map((permissionId) => ({ roleId, permissionId })),
    ),
  };
}

/**
 * The stored matrix in the shape of the shared `ROLE_PERMISSIONS`: every stored role (in
 * `sort_order`) with the set of its permissions, sorted by the permission's `sort_order`.
 */
export function matrixFromRows(rows: RbacRows): Record<string, string[]> {
  const permissionOrder = new Map(rows.permissions.map((permission) => [permission.id, permission.sortOrder] as const));
  const matrix: Record<string, string[]> = {};
  for (const role of [...rows.roles].sort((a, b) => a.sortOrder - b.sortOrder)) {
    matrix[role.id] = rows.rolePermissions
      .filter((grant) => grant.roleId === role.id)
      .map((grant) => grant.permissionId)
      .sort((a, b) => (permissionOrder.get(a) ?? 0) - (permissionOrder.get(b) ?? 0));
  }
  return matrix;
}
