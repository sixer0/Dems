import { useMemo } from 'react'
import { CoreMode, useCoreMode, useLiveSelector, type LiveHandle } from '@dems/shared/live'
import type { NavItem } from './nav-items'

const readPermissions = (live: LiveHandle | null) => live?.session?.permissions ?? null

/**
 * PG-4 (backend task 04_client_integration_spec §10.1; AC-C-51): the items of `items` that are
 * rendered now. A `liveOnly` item needs Live mode; an item with a `permission` needs that
 * permission in the Core server's list of the signed-in operator, the same hint
 * `useCorePermission` reads. The list follows `session.updated`, so an entry appears and
 * disappears without a reload. In Simulated mode the server's list does not exist: an item that
 * names a permission is not rendered.
 */
export function useVisibleNavItems(items: readonly NavItem[]): readonly NavItem[] {
  const live = useCoreMode() === CoreMode.LIVE
  const permissions = useLiveSelector(readPermissions)
  return useMemo(
    () =>
      items.filter(
        (item) => (item.liveOnly !== true || live) && (item.permission === undefined || (permissions?.includes(item.permission) ?? false)),
      ),
    [items, live, permissions],
  )
}
