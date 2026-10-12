/**
 * A PAGE THE ROLE MAY NOT OPEN SAYS SO (fix wave J, driver J-W; finding JW-14 (d)).
 *
 * `/admin/users`, `/admin/devices` and `/session/new`, opened by address by a role that may not open
 * them, went to the Dashboard WITHOUT A WORD. The leave itself is specified and stays (the guard of the
 * route; §6.3 RC-1 / RC-3: a page whose permission is gone is left at once and its data dropped). What
 * was missing is the sentence: the guard notes here which page was refused and for which permission,
 * and the shell says it once on the page the operator lands on - "Users & Roles is not available to
 * your role. Requires the Supervisor role."
 *
 * One note in memory, taken once; nothing about the operator is kept.
 */
import type { Permission } from '@dems/shared/sim'

export interface DeniedPage {
  readonly pathname: string
  readonly permission: Permission
}

let denied: DeniedPage | null = null

/** The guard of `pathname` refused the role for want of `permission`. */
export function noteDeniedPage(pathname: string, permission: Permission): void {
  denied = { pathname, permission }
}

/** The refusal to say, once; null when there is none. */
export function takeDeniedPage(): DeniedPage | null {
  const was = denied
  denied = null
  return was
}
