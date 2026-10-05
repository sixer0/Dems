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

export function requireCorePermission(sim: Sim, permission: Permission): void {
  if (coreModeOf(sim) === CoreMode.LIVE && !corePermissionOf(sim, permission)) {
    throw redirect({ to: '/dashboard', replace: true })
  }
}
