/**
 * The two reads of the Users & Roles page (backend task 04_client_integration_spec §10.1 PG-6,
 * PG-6a, the states table; §10.2; plan row W77).
 *
 * | Read | Operation | Key (PG-6, rule 3 of the page rows) | Held as |
 * |------|-----------|-------------------------------------|---------|
 * | The operators | 11 `listUsers` (USER_ADMIN) | `CORE_QUERY_KEYS.users` | The operation's own answer, `AdminUserList` |
 * | The matrix | 10 `getRoleMatrix` (AUTHENTICATED) | `CORE_QUERY_KEYS.roleMatrix` | The operation's own answer, `RoleMatrix` (the key Security & Audit shares, so both pages hold the same shape) |
 *
 * - **The one way in** (rule 1): `useWebLive()?.client.call(…)`. No typed client of the page's own.
 * - **The bridge owns the life of both entries** (rule 3, `runtime/query-bridge.ts`): `admin.changed`
 *   USERS invalidates the users list, so it is read again without a reload (AC-C-90); a socket resync
 *   invalidates both; a sign-out, any session end, another operator in this browser, or the loss of
 *   `USER_ADMIN` REMOVES both, in the turn of the store update (PG-6a, SD-20). `retry: false` is the
 *   bridge's default and is not set again.
 * - **Enabled only in Live mode, with `USER_ADMIN`, while the link is up** (PG-6; rule 6). With the
 *   link down nothing is asked: the shell says the Core is unreachable, and the last answer stays on
 *   screen (the "Offline" state of §10.1).
 * - **Every failure to the presenter first** (rule 2): a 403 names the role, an outage or a 429 is
 *   worded once (coalesced). What the presenter leaves to the page gets one record in its own log.
 *   Under StrictMode a query is fetched once (W0 §15: reads belong in `useQuery`).
 */
import { useQuery } from '@tanstack/react-query'
import type { AdminUserList, RoleMatrix } from '@dems/shared/api'
import type { CoreCallFailure } from '@dems/shared/client'
import { LiveLinkState, useCorePermission, useLiveLink } from '@dems/shared/live'
import { Permission } from '@dems/shared/sim'
import { useCoreErrorPresenter } from '@/lib/core-errors'
import { CORE_QUERY_KEYS, useWebLive } from '@/runtime'
import { reportUsersError } from './report'

/** The fixed sentences of the page's own records (never the text of an answer). */
const READ_FAILED: Record<AdminReadOperation, string> = {
  listUsers: 'The operator list of Users & Roles could not be read.',
  getRoleMatrix: 'The role matrix of Users & Roles could not be read.',
}

export type AdminReadOperation = 'listUsers' | 'getRoleMatrix'

/** A failed read, carried through the query's error: its status and code, never its text. */
export class AdminReadError extends Error {
  override readonly name = 'AdminReadError'
  readonly operationId: AdminReadOperation
  readonly status: number | null
  readonly code: string
  constructor(operationId: AdminReadOperation, failure: Pick<CoreCallFailure, 'status'> & { readonly error: { readonly code: string } }) {
    super(READ_FAILED[operationId])
    this.operationId = operationId
    this.status = failure.status
    this.code = failure.error.code
  }
}

/** The "Forbidden" state of §10.1: the read answered 403 (a stale hint; the guard normally prevents the visit). */
export function isForbiddenRead(error: unknown): boolean {
  return error instanceof AdminReadError && error.status === 403
}

const NOT_LIVE = { status: null, error: { code: 'NOT_LIVE' } } as const

/** Whether the page may read now: Live mode, `USER_ADMIN` in the session's list, the link up. */
function useReadAllowed(): boolean {
  const live = useWebLive()
  const allowed = useCorePermission(Permission.USER_ADMIN)
  const linkUp = useLiveLink() === LiveLinkState.ONLINE
  return live !== null && allowed && linkUp
}

/** Operation 11, `listUsers`, under `CORE_QUERY_KEYS.users`. */
export function useUsersQuery() {
  const live = useWebLive()
  const enabled = useReadAllowed()
  const presentCoreError = useCoreErrorPresenter()
  return useQuery({
    queryKey: CORE_QUERY_KEYS.users,
    enabled,
    queryFn: async (): Promise<AdminUserList> => {
      if (live === null) throw new AdminReadError('listUsers', NOT_LIVE)
      const answer = await live.client.call('listUsers')
      if (answer.ok) return answer.data
      if (presentCoreError(answer, { permission: Permission.USER_ADMIN }) === null) {
        reportUsersError('features/users-roles.listUsers', answer, READ_FAILED.listUsers, { operationId: 'listUsers', code: answer.error.code }, 'warn')
      }
      throw new AdminReadError('listUsers', answer)
    },
  })
}

/** Operation 10, `getRoleMatrix`, under `CORE_QUERY_KEYS.roleMatrix`. */
export function useRoleMatrixQuery() {
  const live = useWebLive()
  const enabled = useReadAllowed()
  const presentCoreError = useCoreErrorPresenter()
  return useQuery({
    queryKey: CORE_QUERY_KEYS.roleMatrix,
    enabled,
    queryFn: async (): Promise<RoleMatrix> => {
      if (live === null) throw new AdminReadError('getRoleMatrix', NOT_LIVE)
      const answer = await live.client.call('getRoleMatrix')
      if (answer.ok) return answer.data
      if (presentCoreError(answer) === null) {
        reportUsersError('features/users-roles.getRoleMatrix', answer, READ_FAILED.getRoleMatrix, { operationId: 'getRoleMatrix', code: answer.error.code }, 'warn')
      }
      throw new AdminReadError('getRoleMatrix', answer)
    },
  })
}
