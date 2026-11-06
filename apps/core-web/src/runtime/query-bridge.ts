/**
 * The query bridge: what the Live source tells the TanStack Query cache (backend task
 * 04_client_integration_spec §10.1 PG-6, PG-6a; §5.6 WS-12; §6.3 RC-3; AC-C-106; security design
 * review SD-20; plan row W50).
 *
 * The administration pages keep their lists in the query cache under keys that start with
 * `'core'`. The console is a single-page app: another operator can sign in on the same page
 * load. So the cache is told two different things:
 *
 * | Event of the Live source | Cache | Why |
 * |--------------------------|-------|-----|
 * | `admin.changed` `USERS` | `['core','users']` is INVALIDATED | The list changed on the Core: refetch it |
 * | `admin.changed` `DEVICES` | `['core','paired-devices']` and `['core','pairing-code']` are invalidated | |
 * | `admin.changed` `PAIRING_CODE` | `['core','pairing-code']` is invalidated | |
 * | The socket resynchronised (`RESYNCED`) | Every `['core', …]` entry and `['health']` are invalidated | A message may have been missed while the link was down |
 * | A session ended: this console's sign-out or Lock, `session.ended` with any reason, an end decided here while the Core could not be told | Every `['core', …]` entry is REMOVED; every mutation is dropped | An invalidation would keep the earlier operator's rows until the refetch answers. Nothing of one operator may be rendered for the next |
 * | The session lost `USER_ADMIN` or `PAIRING_MANAGE` (a role change, a permission refresh) | The same removal | RC-3: no row of the page that was lost stays in memory |
 * | Another operator owns the session now (a sign-in in another tab, heard on the open socket: no session end is reported for it) | The same removal | The same reason as a session end |
 *
 * The removal runs in the turn in which the Live source reports the change, which is the turn of
 * its store update: before React renders anything, and before a route guard can redirect.
 *
 * `removeQueries` drops the entries; a page that is still mounted keeps what it rendered until it
 * renders again, so the shell leaves that page (its own leave path on a session end, the route
 * guard on a lost permission). A feature that holds something OUTSIDE the cache (the pairing code
 * of the Paired Devices page) subscribes with `onCoreQueriesCleared` and drops it in the same turn.
 *
 * No query of a `['core', …]` key is repeated automatically (`CORE_QUERY_DEFAULTS`): a call that
 * was answered 401 has ended the session, every 403 starts a permission refresh, and the Core
 * audits every refusal (brief list row 22). A page offers its Retry button on the cooldown.
 */
import type { QueryClient, QueryKey } from '@tanstack/react-query'
import { AdminResource, HEALTH_QUERY_KEY } from '@dems/shared/api'
import type { LiveSim } from '@dems/shared/live/source'
import { Permission } from '@dems/shared/sim'

/** First element of every key the administration pages use (PG-6). */
export const CORE_QUERY_ROOT = 'core'
/** The prefix that matches every Core query. */
export const CORE_QUERY_KEY = [CORE_QUERY_ROOT] as const

/** The keys of PG-6. A page uses these and adds nothing in front of `'core'`. */
export const CORE_QUERY_KEYS = {
  users: [CORE_QUERY_ROOT, 'users'],
  roleMatrix: [CORE_QUERY_ROOT, 'role-matrix'],
  pairedDevices: [CORE_QUERY_ROOT, 'paired-devices'],
  /** Whether a code is active, and until when. NEVER the code itself (§10.3, AC-C-96). */
  pairingCode: [CORE_QUERY_ROOT, 'pairing-code'],
  /** Task 3 M4 (blueprint row 67; WB-11, E-17): operations 76 and 77, the capture device selector. */
  captureConfig: [CORE_QUERY_ROOT, 'capture-config'],
  captureDevices: [CORE_QUERY_ROOT, 'capture-devices'],
} as const satisfies Record<string, QueryKey>

/** PG-6: the lists an `admin.changed` names. */
export const ADMIN_CHANGED_QUERY_KEYS: Readonly<Record<AdminResource, readonly QueryKey[]>> = {
  [AdminResource.USERS]: [CORE_QUERY_KEYS.users],
  [AdminResource.DEVICES]: [CORE_QUERY_KEYS.pairedDevices, CORE_QUERY_KEYS.pairingCode],
  [AdminResource.PAIRING_CODE]: [CORE_QUERY_KEYS.pairingCode],
}

/** The two permissions whose loss empties the cache (PG-6a): each opens one administration page. */
export const CORE_QUERY_PERMISSIONS: readonly Permission[] = [Permission.USER_ADMIN, Permission.PAIRING_MANAGE]

/** Defaults of every `['core', …]` query: never repeated by itself (brief list row 22). */
export const CORE_QUERY_DEFAULTS = { retry: false } as const

/** Sets `CORE_QUERY_DEFAULTS` on a query client. Idempotent. The router factory calls it for a Live source. */
export function applyCoreQueryDefaults(queryClient: QueryClient): void {
  queryClient.setQueryDefaults(CORE_QUERY_KEY, CORE_QUERY_DEFAULTS)
}

/** The part of a session the removal rule reads. */
export interface BridgeSession {
  readonly operatorId: string
  readonly permissions: readonly string[]
}

/**
 * PG-6a for a session that goes on: is the cache emptied when the session changes from
 * `previous` to `next`? (The end of a session always empties it.)
 */
export function sessionChangeClearsCoreQueries(previous: BridgeSession, next: BridgeSession): boolean {
  if (previous.operatorId !== next.operatorId) return true
  return CORE_QUERY_PERMISSIONS.some((permission) => previous.permissions.includes(permission) && !next.permissions.includes(permission))
}

const clearedListeners = new WeakMap<QueryClient, Set<() => void>>()

/**
 * Calls `listener` right after the bridge emptied the cache of `queryClient`, in the same turn.
 * For what a feature keeps outside the cache (PG-6a: the pairing code). Returns the unsubscribe.
 */
export function onCoreQueriesCleared(queryClient: QueryClient, listener: () => void): () => void {
  let listeners = clearedListeners.get(queryClient)
  if (listeners === undefined) {
    listeners = new Set()
    clearedListeners.set(queryClient, listeners)
  }
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** PG-6a: removes every `['core', …]` entry, drops every mutation, and tells the features. */
export function clearCoreQueries(queryClient: QueryClient): void {
  queryClient.removeQueries({ queryKey: CORE_QUERY_KEY })
  // The answer of a command (a pairing code) would otherwise stay in the mutation cache for its
  // garbage-collection time. No mutation outlives the session that sent it.
  queryClient.getMutationCache().clear()
  for (const listener of Array.from(clearedListeners.get(queryClient) ?? [])) {
    try {
      listener()
    } catch {
      // One feature's listener must not keep the others from dropping what they hold.
    }
  }
}

const sessionOf = (live: Pick<LiveSim, 'session'>): BridgeSession | null =>
  live.session === null ? null : { operatorId: live.session.operator.id, permissions: live.session.permissions }

/**
 * Connects a Live source to a query client. Returns the function that ends the connection.
 * `__root.tsx` mounts it for the lifetime of the app; a test calls it directly.
 */
export function attachQueryBridge(
  live: Pick<LiveSim, 'session' | 'onControl' | 'onSessionEnd' | 'onLiveChange' | 'onResync'>,
  queryClient: QueryClient,
): () => void {
  let known = sessionOf(live)

  const stopControl = live.onControl((message) => {
    if (message.type !== 'admin.changed') return
    for (const queryKey of ADMIN_CHANGED_QUERY_KEYS[message.resource] ?? []) void queryClient.invalidateQueries({ queryKey })
  })

  // Every end of a session, whatever told it: a control message, a close, a REST answer, this
  // console's own sign-out, or an end decided here while the Core could not be told.
  const stopEnd = live.onSessionEnd(() => {
    known = null
    clearCoreQueries(queryClient)
  })

  // A session that goes on with fewer permissions, or as another operator.
  const stopChange = live.onLiveChange(() => {
    const next = sessionOf(live)
    const previous = known
    known = next
    if (previous !== null && next !== null && sessionChangeClearsCoreQueries(previous, next)) clearCoreQueries(queryClient)
  })

  const stopResync = live.onResync((event) => {
    if (event.phase !== 'RESYNCED') return
    void queryClient.invalidateQueries({ queryKey: HEALTH_QUERY_KEY })
    void queryClient.invalidateQueries({ queryKey: CORE_QUERY_KEY })
  })

  return () => {
    stopControl()
    stopEnd()
    stopChange()
    stopResync()
  }
}
