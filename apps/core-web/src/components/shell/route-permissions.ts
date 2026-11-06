import { Permission } from '@dems/shared/sim'

/**
 * The routes whose own guard needs a permission (backend task 04_client_integration_spec §6.3,
 * RC-1; plan row W54). An operator who loses the permission while on such a page is sent to the
 * Dashboard by the route's guard, which the shell makes run again (`router.invalidate()`); every
 * other page stays. The shell reads this map only to say WHY in its notice: the guards decide.
 *
 * | Route | Guard | Guard reads |
 * |-------|-------|-------------|
 * | `/session/new` | `routes/_app/session/new.tsx` | The operator's role in the replicated `operators` slice (`selectCan`), in both modes |
 * | `/admin/users`, `/admin/devices` | `routes/_app/admin/-guard.ts` | The Core server's permission list of the session, in Live mode only |
 */
export const ROUTE_PERMISSIONS: Readonly<Record<string, Permission>> = {
  '/session/new': Permission.SESSION_START,
  '/admin/users': Permission.USER_ADMIN,
  '/admin/devices': Permission.PAIRING_MANAGE,
  // Task 4 row 112 (decision U10): the commissioning screen; the same guard, `routes/_app/admin/-guard.ts`.
  '/admin/commissioning': Permission.CAPTURE_COMMISSION,
}

/** The permission the guard of `pathname` needs, or `null` for a page every role may open. */
export function routePermission(pathname: string): Permission | null {
  return Object.prototype.hasOwnProperty.call(ROUTE_PERMISSIONS, pathname) ? (ROUTE_PERMISSIONS[pathname] ?? null) : null
}
