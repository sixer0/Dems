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
 * | `CORE_QUERY_KEYS.captureConfig` (operation 76, AUTHENTICATED) | `captureConfigQueryOptions` | Live, signed in (D176), link up (rule 6) | Devices & Inputs capture selector |
 * | `CORE_QUERY_KEYS.captureDevices` (operation 77, AUTHENTICATED) | `captureDevicesQueryOptions` | Live, signed in (D176), link up (rule 6) | Devices & Inputs capture selector |
 * | `audioSourceIntervalsQueryKey(sessionId)` (operation 82, AUTHENTICATED) | `audioSourceIntervalsQueryOptions` | Live, signed in (D176), link up (rule 6), an open session | Session Monitor audio-source band |
 *
 * - **The `queryFn` only reads.** It calls the operation through `live.client.call(…)` (rule 1) and
 *   throws a `CoreReadError` (operation, status and code; never the answer's text) on a failure.
 *   What a failure means to the operator is said by the component through `useQueryFailure`: the
 *   presenter first (rule 2), then the page's own record. Each observer presents each NEW failure
 *   once, so a remount over a cached failure says nothing twice and StrictMode says nothing twice.
 * - **Retry respects the gate** (W92-4). `query.refetch()` ignores `enabled` and so the signed-in,
 *   permission and link gates. `retryCoreQuery` invalidates the key instead, which refetches only
 *   the queries that have an enabled observer.
 * - **The capture keys follow their slices** (task 3 M4, blueprint row 67; WB-11, E-17; ux §2.7).
 *   Operations 76 and 77 answer with the `captureConfig` and `captureDevices` slices in their wire
 *   form, and the Core republishes those slices after every change. `useCaptureSliceRefresh` puts a
 *   republished slice into the entry its gated read already filled; it never creates an entry, so a
 *   reader that was refused (or that never asked) gets nothing from a republish.
 */
import { useEffect, useEffectEvent, useRef } from 'react'
import { queryOptions, useQueryClient, type QueryClient, type QueryKey, type UseQueryResult } from '@tanstack/react-query'
import type { AudioSourceIntervalPage, CaptureConfigSliceBody, CaptureDevicesSliceBody, PairedDeviceList, RoleMatrix } from '@dems/shared/api'
import type { CoreCallFailure } from '@dems/shared/client'
import { LiveLinkState, useCorePermission, useLiveLink, useLiveSelector } from '@dems/shared/live'
import { Permission, selectIsSignedIn, useSim } from '@dems/shared/sim'
import { CORE_QUERY_KEYS, CORE_QUERY_ROOT, useWebLive, type WebLive } from '@/runtime'

/** The operations whose reads fail with a `CoreReadError` (the shared keys here; a page's own read may use it too). */
export type CoreReadOperation = 'listPairedDevices' | 'getRoleMatrix' | 'getPairingCodeStatus' | 'getCaptureConfig' | 'getCaptureDevices' | 'listAudioSourceIntervals'

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

/**
 * The gate of operations 76 `getCaptureConfig` and 77 `getCaptureDevices` (both AUTHENTICATED; ux
 * §2.3): the base gate. `open` false in Live mode is the "waits for the link" state of ux §2.5.
 */
export function useCaptureReadGate(): { readonly live: WebLive | null; readonly enabled: boolean } {
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

async function readCaptureConfig(live: WebLive | null): Promise<CaptureConfigSliceBody> {
  if (live === null) throw new CoreReadError('getCaptureConfig', null)
  const answer = await live.client.call('getCaptureConfig')
  if (answer.ok) return answer.data
  throw new CoreReadError('getCaptureConfig', answer)
}

async function readCaptureDevices(live: WebLive | null): Promise<CaptureDevicesSliceBody> {
  if (live === null) throw new CoreReadError('getCaptureDevices', null)
  const answer = await live.client.call('getCaptureDevices')
  if (answer.ok) return answer.data
  throw new CoreReadError('getCaptureDevices', answer)
}

/** Operation 76 under `CORE_QUERY_KEYS.captureConfig`, enabled by its gate (`useCaptureReadGate`). */
export function captureConfigQueryOptions(gate: { readonly live: WebLive | null; readonly enabled: boolean }) {
  return queryOptions({
    queryKey: CORE_QUERY_KEYS.captureConfig,
    enabled: gate.live !== null && gate.enabled,
    queryFn: () => readCaptureConfig(gate.live),
  })
}

/** Operation 77 under `CORE_QUERY_KEYS.captureDevices`, enabled by its gate (`useCaptureReadGate`). */
export function captureDevicesQueryOptions(gate: { readonly live: WebLive | null; readonly enabled: boolean }) {
  return queryOptions({
    queryKey: CORE_QUERY_KEYS.captureDevices,
    enabled: gate.live !== null && gate.enabled,
    queryFn: () => readCaptureDevices(gate.live),
  })
}

/**
 * Puts `slice` into the entry of `queryKey` when a gated read filled it before; pure of React.
 *
 * - No entry, or an entry without data (never read, refused, failed): nothing. A republish must not
 *   open what the gate of the read kept closed.
 * - A read is out: the key is invalidated instead, so the answer that is on its way cannot overwrite
 *   the newer slice with an older snapshot.
 */
export function applyCaptureSlice<T>(queryClient: QueryClient, queryKey: QueryKey, slice: T): void {
  const held = queryClient.getQueryState<T>(queryKey)
  if (held === undefined || held.data === undefined) return
  if (held.fetchStatus === 'fetching') {
    void queryClient.invalidateQueries({ queryKey, exact: true })
    return
  }
  queryClient.setQueryData<T>(queryKey, slice)
}

/**
 * Live mode: keeps the two capture entries in step with the replicated slices (ux §2.7: "a stale
 * snapshot is refreshed by the slice republish, never by a client-side countdown"). The slice that
 * is in the store when the reader mounts is not applied: the read of the mount is at least as new.
 * Does nothing in Simulated mode, where the readers take the simulator's slices as they are.
 */
export function useCaptureSliceRefresh(): void {
  const live = useWebLive()
  const queryClient = useQueryClient()
  const config = useSim((state) => state.captureConfig)
  const devices = useSim((state) => state.captureDevices)
  const seenConfig = useRef(config)
  const seenDevices = useRef(devices)
  useEffect(() => {
    if (seenConfig.current === config) return
    seenConfig.current = config
    if (live !== null) applyCaptureSlice<CaptureConfigSliceBody>(queryClient, CORE_QUERY_KEYS.captureConfig, config)
  }, [config, live, queryClient])
  useEffect(() => {
    if (seenDevices.current === devices) return
    seenDevices.current = devices
    if (live !== null) applyCaptureSlice<CaptureDevicesSliceBody>(queryClient, CORE_QUERY_KEYS.captureDevices, devices)
  }, [devices, live, queryClient])
}

// ── Operation 82, the audio-source intervals of the open session (task 3 M5, blueprint row 72) ──

/**
 * The gate of operation 82 `listAudioSourceIntervals` (AUTHENTICATED; ux §3.3): the base gate. The
 * Session Monitor also reads it as "the role and the link are resolved" for the mic toggle (G4, G5):
 * while it is closed in Live mode the control says "Checking your permissions…" (E-16).
 */
export function useAudioSourceReadGate(): { readonly live: WebLive | null; readonly enabled: boolean } {
  const base = useCoreReadBase()
  return { live: base.live, enabled: base.open }
}

/** The key of operation 82 for one session. It starts with `'core'`, so the bridge empties it with a session end. */
export function audioSourceIntervalsQueryKey(sessionId: string | null): QueryKey {
  return [CORE_QUERY_ROOT, 'audio-source-intervals', sessionId]
}

async function readAudioSourceIntervals(live: WebLive | null, sessionId: string | null): Promise<AudioSourceIntervalPage> {
  if (live === null || sessionId === null) throw new CoreReadError('listAudioSourceIntervals', null)
  const answer = await live.client.call('listAudioSourceIntervals', { params: { id: sessionId } })
  if (answer.ok) return answer.data
  throw new CoreReadError('listAudioSourceIntervals', answer)
}

/**
 * Operation 82 under `audioSourceIntervalsQueryKey(sessionId)`, enabled by its gate
 * (`useAudioSourceReadGate`) and only for a session (`sessionId` not null). It reads the first page:
 * one interval per manual switch, newest first.
 */
export function audioSourceIntervalsQueryOptions(gate: { readonly live: WebLive | null; readonly enabled: boolean }, sessionId: string | null) {
  return queryOptions({
    queryKey: audioSourceIntervalsQueryKey(sessionId),
    enabled: gate.live !== null && gate.enabled && sessionId !== null,
    queryFn: () => readAudioSourceIntervals(gate.live, sessionId),
  })
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
