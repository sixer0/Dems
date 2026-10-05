/**
 * Users & Roles: the pure rules of the page (backend task 04_client_integration_spec §10.2; plan
 * row W77). No React, no I/O: what the panels and dialogs compute from the two answers of the Core
 * server, `listUsers` (operation 11, `AdminUserList`) and `getRoleMatrix` (operation 10,
 * `RoleMatrix`).
 *
 * | Rule | Function | Source |
 * |------|----------|--------|
 * | The rows of the cached answer, never trusting its shape | `usersOf` | PG-6a: another feature or a test may hold an older shape under the key |
 * | "n users · m enabled" | `summaryOf` | §10.2 Header |
 * | The role chip tone of the Login list | `roleTone` | §10.2 Role column; `features/login/auth-card.tsx:538-542` |
 * | What a role holds, from the STORED matrix (never `ROLE_PERMISSIONS`) | `permissionsOfRole` | [SP:RB-9]; the server decides by its matrix |
 * | "Gains" and "Loses" of the role-change dialog | `roleDiff` | §10.2 role-change dialog |
 * | The last-administrator hint | `isLastAdministrator`, `blockedRolesFor` | §10.2 "Last administrator"; [SP:RB-8]. A hint only: the server's 409 `LAST_ADMIN` decides |
 * | Which rows changed between two answers (the gold highlight, M-C-07) | `changedRowIds` | §10.2 "Live update" |
 */
import type { AdminUser, AdminUserList, RoleMatrix } from '@dems/shared/api'
import { OperatorRole, Permission } from '@dems/shared/sim'

/** The three roles in the order of the Core's matrix when it gives none (least privileged first, as the presenter orders them). */
export const ROLE_ORDER: readonly OperatorRole[] = [OperatorRole.INVESTIGATOR, OperatorRole.SUPERVISOR, OperatorRole.TECHNICIAN]

/** The rows of a cached `listUsers` answer. Anything that is not the contract's `{ users: [...] }` gives no row. */
export function usersOf(data: unknown): readonly AdminUser[] {
  if (typeof data !== 'object' || data === null) return []
  const users = (data as Partial<AdminUserList>).users
  if (!Array.isArray(users)) return []
  return users.filter((user): user is AdminUser => typeof user === 'object' && user !== null && typeof user.id === 'string' && typeof user.role === 'string')
}

/** A cached `getRoleMatrix` answer, or `null` when it is not the contract's shape. */
export function matrixOf(data: unknown): RoleMatrix | null {
  if (typeof data !== 'object' || data === null) return null
  const { roles, permissions, grants } = data as Partial<RoleMatrix>
  return Array.isArray(roles) && Array.isArray(permissions) && Array.isArray(grants) ? (data as RoleMatrix) : null
}

export interface UsersSummary {
  readonly users: number
  readonly enabled: number
}

export function summaryOf(users: readonly AdminUser[]): UsersSummary {
  return { users: users.length, enabled: users.filter((user) => user.enabled).length }
}

export type RoleTone = 'accent' | 'success' | 'default'

/** The tone of a role chip, as the Login list shows it (`features/login/auth-card.tsx:538-542`). */
export function roleTone(role: OperatorRole): RoleTone {
  if (role === OperatorRole.SUPERVISOR) return 'accent'
  if (role === OperatorRole.INVESTIGATOR) return 'success'
  return 'default'
}

/** The permissions `role` holds in the matrix, in the matrix's permission order. */
export function permissionsOfRole(matrix: RoleMatrix, role: OperatorRole): Permission[] {
  const held = new Set(matrix.grants.filter((grant) => grant.role === role).map((grant) => grant.permission))
  return matrix.permissions.filter((permission) => held.has(permission))
}

export function holds(matrix: RoleMatrix, role: OperatorRole, permission: Permission): boolean {
  return matrix.grants.some((grant) => grant.role === role && grant.permission === permission)
}

export interface RoleDiff {
  readonly gains: Permission[]
  readonly loses: Permission[]
}

/** What an operator gains and loses when `from` becomes `to`, in the matrix's permission order. */
export function roleDiff(matrix: RoleMatrix, from: OperatorRole, to: OperatorRole): RoleDiff {
  const before = new Set(permissionsOfRole(matrix, from))
  const after = new Set(permissionsOfRole(matrix, to))
  return {
    gains: matrix.permissions.filter((permission) => after.has(permission) && !before.has(permission)),
    loses: matrix.permissions.filter((permission) => before.has(permission) && !after.has(permission)),
  }
}

/** The enabled operators whose role holds `USER_ADMIN` in the matrix. */
export function administratorsOf(users: readonly AdminUser[], matrix: RoleMatrix): AdminUser[] {
  return users.filter((user) => user.enabled && holds(matrix, user.role, Permission.USER_ADMIN))
}

/**
 * The hint of [SP:RB-8]: `target` is the only enabled holder of `USER_ADMIN`, so demoting it to a
 * role without that permission, or disabling it, would leave nobody to administer users. Without
 * the matrix nothing is known and nothing is blocked: the server's 409 still decides.
 */
export function isLastAdministrator(target: AdminUser, users: readonly AdminUser[], matrix: RoleMatrix | null): boolean {
  if (matrix === null) return false
  const administrators = administratorsOf(users, matrix)
  return administrators.length === 1 && administrators[0]!.id === target.id
}

/** The roles the role-change dialog disables for `target` (the hint above): those without `USER_ADMIN`. */
export function blockedRolesFor(target: AdminUser, users: readonly AdminUser[], matrix: RoleMatrix | null): Set<OperatorRole> {
  if (matrix === null || !isLastAdministrator(target, users, matrix)) return new Set()
  return new Set(matrix.roles.filter((role) => !holds(matrix, role, Permission.USER_ADMIN)))
}

/** The members of a row the page shows; a change of one of them highlights the row. */
const SHOWN: readonly (keyof AdminUser)[] = ['role', 'enabled', 'activeSessions', 'lastSignInAt', 'roleChangedAt', 'displayName', 'username', 'initials']

/** The IDs of rows that are new in `next` or whose shown members differ from `previous`. */
export function changedRowIds(previous: readonly AdminUser[], next: readonly AdminUser[]): string[] {
  const before = new Map(previous.map((user) => [user.id, user]))
  return next
    .filter((user) => {
      const earlier = before.get(user.id)
      return earlier === undefined || SHOWN.some((member) => earlier[member] !== user[member])
    })
    .map((user) => user.id)
}

/** The roles of the matrix in its own order, or the default order when there is no matrix. */
export function rolesOf(matrix: RoleMatrix | null): readonly OperatorRole[] {
  return matrix === null || matrix.roles.length === 0 ? ROLE_ORDER : matrix.roles
}
