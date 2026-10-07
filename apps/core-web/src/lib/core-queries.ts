/**
 * One query definition per Core key that more than one page reads (FXR-W, findings W92-3, W92-4 and
 * W92-8 of `verification/11_code_review_shared_web.md`; decision D242).
 *
 * In TanStack Query the observer that starts a fetch decides which `queryFn` runs. Two pages that
 * defined the same key each with their own `queryFn`, `enabled` and error reporting therefore read
 * and reported the same failure differently depending on which one mounted first. Here each key has
 * ONE factory, and its gate is inside it:
 *
 * | Key | Factory | Gate (all must hold) | Readers |
 * |-----|---------|----------------------|---------|
 * | `CORE_QUERY_KEYS.pairedDevices` (operation 19) | `pairedDevicesQueryOptions` | Live, signed in (D176), link up (rule 6), `PAIRING_MANAGE` | Paired Devices page, Devices drawer |
 * | `CORE_QUERY_KEYS.roleMatrix` (operation 10, AUTHENTICATED) | `roleMatrixQueryOptions` | Live, signed in (D176), link up (rule 6) | Users & Roles page (and `USER_ADMIN`, its page gate), Security & Audit RBAC panel |
 *
 * - **The `queryFn` only reads.** It calls the operation through `live.client.call(…)` (rule 1) and
 *   throws a `CoreReadError` (operation, status and code; never the answer's text) on a failure.
 *   What a failure means to the operator is said by the component through `useQueryFailure`: the
 *   presenter first (rule 2), then the page's own record. Each observer presents each NEW failure
 *   once, so a remount over a cached failure says nothing twice and StrictMode says nothing twice.
 * - **Retry respects the gate** (W92-4). `query.refetch()` ignores `enabled` and so the signed-in,
 *   permission and link gates. `retryCoreQuery` invalidates the key instead, which refetches only
 *   the queries that have an enabled observer.
 */
import { useEffect, useEffectEvent, useRef } from 'react'
import { queryOptions, type QueryClient, type QueryKey, type UseQueryResult } from '@tanstack/react-query'
import type { PairedDeviceList, RoleMatrix } from '@dems/shared/api'
import type { CoreCallFailure } from '@dems/shared/client'
import { LiveLinkState, useCorePermission, useLiveLink, useLiveSelector } from '@dems/shared/live'
import { Permission, selectIsSignedIn, useSim } from '@dems/shared/sim'
import { CORE_QUERY_KEYS, useWebLive, type WebLive } from '@/runtime'

/** The operations whose reads fail with a `CoreReadError` (the shared keys here; a page's own read may use it too). */
export type CoreReadOperation = 'listPairedDevices' | 'getRoleMatrix' | 'getPairingCodeStatus'

/**
 * A failed read, carried through the query's error: the operation, the status and the code, never
 * the answer's text. The failed call itself, which the refusal presenter takes, is kept off the
 * enumerable members (`failure`), so a dump of the query cache shows the status and code only.
 */
export class CoreReadError extends Error {
  override readonly name = 'CoreReadError'
  readonly operationId: CoreReadOperation
  readonly status: number | null
  readonly code: string
  declare readonly failure: CoreCallFailure | null
  constructor(operationId: CoreReadOperation, failure: CoreCallFailure | null) {
    super(`A read of the Core (${operationId}) failed.`)
    this.operationId = operationId
    this.status = failure?.status ?? null
    this.code = failure?.error.code ?? 'NOT_LIVE'
    Object.defineProperty(this, 'failure', { value: failure, enumerable: false, writable: false })
  }
}

/** Whether a read was refused for the role (the Forbidden state of the administration pages). */
export function isForbiddenCoreRead(error: unknown): boolean {
  return error instanceof CoreReadError && error.status === 403
}

/**
 * Signed in, by both the replicated state and the Live source (D176, finding F75-2). When a session
 * ends the bridge removes every `['core', …]` entry in the same turn; a page that is still on screen
 * until the shell leaves it re-renders, and must not ask again.
 */
export function useCoreSignedIn(): boolean {
  const replicated = useSim(selectIsSignedIn)
  const liveSession = useLiveSelector((source: WebLive | null) => source === null || source.session != null)
  return replicated && liveSession
}

/** Live mode, signed in, the link up: the gate every Core read shares. */
function useCoreReadBase(): { readonly live: WebLive | null; readonly open: boolean } {
  const live = useWebLive()
  const signedIn = useCoreSignedIn()
  const linkUp = useLiveLink() === LiveLinkState.ONLINE
  return { live, open: live !== null && signedIn && linkUp }
}

/** The gate of operation 19, `listPairedDevices`: the base gate and `PAIRING_MANAGE`. */
export function usePairedDevicesGate(): { readonly live: WebLive | null; readonly enabled: boolean } {
  const base = useCoreReadBase()
  const canManage = useCorePermission(Permission.PAIRING_MANAGE)
  return { live: base.live, enabled: base.open && canManage }
}

/** The gate of operation 10, `getRoleMatrix` (AUTHENTICATED): the base gate. */
export function useRoleMatrixGate(): { readonly live: WebLive | null; readonly enabled: boolean } {
  const base = useCoreReadBase()
  return { live: base.live, enabled: base.open }
}

async function readPairedDevices(live: WebLive | null): Promise<PairedDeviceList> {
  if (live === null) throw new CoreReadError('listPairedDevices', null)
  const answer = await live.client.call('listPairedDevices')
  if (answer.ok) return answer.data
  throw new CoreReadError('listPairedDevices', answer)
}

async function readRoleMatrix(live: WebLive | null): Promise<RoleMatrix> {
  if (live === null) throw new CoreReadError('getRoleMatrix', null)
  const answer = await live.client.call('getRoleMatrix')
  if (answer.ok) return answer.data
  throw new CoreReadError('getRoleMatrix', answer)
}

/** Operation 19 under `CORE_QUERY_KEYS.pairedDevices`, enabled by its gate (`usePairedDevicesGate`). */
export function pairedDevicesQueryOptions(gate: { readonly live: WebLive | null; readonly enabled: boolean }) {
  return queryOptions({
    queryKey: CORE_QUERY_KEYS.pairedDevices,
    enabled: gate.live !== null && gate.enabled,
    queryFn: () => readPairedDevices(gate.live),
  })
}

/**
 * Operation 10 under `CORE_QUERY_KEYS.roleMatrix`, enabled by its gate (`useRoleMatrixGate`).
 * `pageGate` lets a page narrow it further (Users & Roles reads only with `USER_ADMIN`); it can never
 * widen it.
 */
export function roleMatrixQueryOptions(gate: { readonly live: WebLive | null; readonly enabled: boolean }, pageGate = true) {
  return queryOptions({
    queryKey: CORE_QUERY_KEYS.roleMatrix,
    enabled: gate.live !== null && gate.enabled && pageGate,
    queryFn: () => readRoleMatrix(gate.live),
  })
}

/**
 * Hands each NEW failure of `query` to `present`, once per observer. A failure that was already in
 * the cache when the component mounted is not presented again (it was presented when it happened);
 * the refetch on mount that follows it is.
 */
export function useQueryFailure(query: Pick<UseQueryResult<unknown, Error>, 'error' | 'errorUpdatedAt' | 'status'>, present: (error: Error) => void): void {
  const seen = useRef(query.errorUpdatedAt)
  const onFailure = useEffectEvent(present)
  const { error, errorUpdatedAt, status } = query
  useEffect(() => {
    if (status !== 'error' || error === null || errorUpdatedAt === seen.current) return
    seen.current = errorUpdatedAt
    onFailure(error)
  }, [error, errorUpdatedAt, status])
}

/**
 * The Retry of a failed read (W92-4): invalidates the key, which refetches only queries that have an
 * enabled observer, so the signed-in, permission and link gates hold for a press as they do for a
 * mount. `query.refetch()` would ignore them.
 */
export function retryCoreQuery(queryClient: QueryClient, queryKey: QueryKey): void {
  void queryClient.invalidateQueries({ queryKey, exact: true })
}
