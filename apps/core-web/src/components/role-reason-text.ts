/** The words of the ONE rule for "the role may not" (fix wave J, JW-14): see `role-reason.tsx`. Pure. */
import type { TFunction } from 'i18next'
import { OperatorRole, ROLE_PERMISSIONS, type Permission } from '@dems/shared/sim'

const ROLE_ORDER = [OperatorRole.INVESTIGATOR, OperatorRole.SUPERVISOR, OperatorRole.TECHNICIAN] as const

/** Every role that holds `permission`, least privileged first. */
export function rolesHolding(permission: Permission): OperatorRole[] {
  return ROLE_ORDER.filter((role) => (ROLE_PERMISSIONS[role] as readonly Permission[]).includes(permission))
}

/** "Requires the Supervisor role" / "Requires the Investigator or Supervisor role". Pure. */
export function roleReasonText(t: TFunction, permission: Permission | readonly OperatorRole[]): string {
  const roles = typeof permission === 'string' ? rolesHolding(permission) : permission
  if (roles.length === 0) return t('common.rbac.deniedTitle')
  return t('common.rbac.requiresRole', { role: roles.map((role) => t(`common.roles.${role}`)).join(` ${t('web.waveJ.rbac.or')} `) })
}

