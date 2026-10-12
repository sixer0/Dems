/**
 * The guard of the two administration routes (backend task 04_client_integration_spec §10.1
 * PG-3; §6.1; plan row W54). The `-` prefix keeps this file out of the generated route tree.
 *
 * | Mode | The operator | Result |
 * |------|--------------|--------|
 * | Live | Holds the permission in the Core server's list of the session | The page |
 * | Live | Does not hold it | `/dashboard`, with `replace` (the style of `/session/new`) |
 * | Simulated | Anybody | The page, which shows its "Live mode only" state: the simulator has no such list |
 *
 * A hint, like every permission display of a client: the Core server decides every call of the
 * page (SR-46). The shell makes this guard run again when the session's permissions change
 * (`router.invalidate()`, RC-1), so a page whose permission was taken away is left at once.
 */
import { redirect } from '@tanstack/react-router'
import { CoreMode, coreModeOf, corePermissionOf } from '@dems/shared/live'
import type { Permission, Sim } from '@dems/shared/sim'
import { noteDeniedPage } from '@/lib/denied-page'

/** The route each permission of this guard opens: what the shell names when it says why the operator is on the Dashboard. */
const PAGE_OF: Partial<Record<Permission, string>> = { USER_ADMIN: '/admin/users', PAIRING_MANAGE: '/admin/devices' }

export function requireCorePermission(sim: Sim, permission: Permission): void {
  if (coreModeOf(sim) === CoreMode.LIVE && !corePermissionOf(sim, permission)) {
    // Fix wave J (JW-14 (d)): the leave is no longer silent - the shell says which page was refused and which role opens it.
    noteDeniedPage(PAGE_OF[permission] ?? '', permission)
    throw redirect({ to: '/dashboard', replace: true })
  }
}
